/*
  ПодоЛайн — приём заявок с сайта и отправка в мессенджер MAX.
  Без внешних зависимостей, нужен Node.js 18+.

  Переменные окружения (задаются в настройках приложения в Timeweb, НЕ в коде):
    MAX_TOKEN       — токен бота из кабинета MAX для бизнеса
    MAX_CHAT_ID     — ID группового чата, куда слать заявки
      или
    MAX_USER_ID     — ID пользователя, если слать в личные сообщения
    ALLOWED_ORIGINS — с каких сайтов принимать заявки, через запятую
                      (по умолчанию https://podoline.ru,https://www.podoline.ru)
    PORT            — порт (если не задан, слушаем 3000 и 8080)

  Пока задан только MAX_TOKEN, сервер при запуске сам ищет чаты, куда добавлен бот,
  и пишет их ID в «Логи приложения».
*/
'use strict';
const http = require('http');
const https = require('https');
const tls = require('tls');
const fs = require('fs');

const MAX_TOKEN = (process.env.MAX_TOKEN || '').trim();
const MAX_CHAT_ID = (process.env.MAX_CHAT_ID || '').trim();
const MAX_USER_ID = (process.env.MAX_USER_ID || '').trim();
const MAX_API = process.env.MAX_API || 'https://platform-api2.max.ru';
const PORTS = process.env.PORT ? [Number(process.env.PORT)] : [3000, 8080];
const ALLOWED = (process.env.ALLOWED_ORIGINS || 'https://podoline.ru,https://www.podoline.ru')
  .split(',').map(s => s.trim()).filter(Boolean);
const CONFIGURED = Boolean(MAX_TOKEN && (MAX_CHAT_ID || MAX_USER_ID));

// API MAX может использовать сертификаты Минцифры: доверяем и стандартным, и системным
// (в Timeweb включена опция «Сертификаты Минцифры и ТЦИ», они лежат в системном хранилище)
const ca = [...tls.rootCertificates];
['/etc/ssl/certs/ca-certificates.crt', '/etc/pki/tls/certs/ca-bundle.crt', '/etc/ssl/cert.pem'].forEach(f => {
  try { ca.push(fs.readFileSync(f, 'utf8')); } catch (e) { /* файла нет — пропускаем */ }
});
const agent = new https.Agent({ ca, keepAlive: true });

function maxRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(MAX_API + path);
    const data = body ? JSON.stringify(body) : null;
    const mod = url.protocol === 'http:' ? http : https; // http — только для локальных тестов
    const req = mod.request(url, {
      method, agent: url.protocol === 'http:' ? undefined : agent, timeout: 15000,
      headers: Object.assign({ Authorization: MAX_TOKEN }, data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {})
    }, res => {
      let txt = '';
      res.on('data', c => { txt += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(txt); } catch (e) { /* не JSON */ }
        resolve({ status: res.statusCode, json, text: txt.slice(0, 500) });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Не больше 5 заявок с одного адреса за 10 минут — защита от спама
const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 5;
}

function send(res, code, obj, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (origin && ALLOWED.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  res.writeHead(code, headers);
  res.end(JSON.stringify(obj));
}

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

const handler = (req, res) => {
  const origin = req.headers.origin || '';

  if (req.method === 'OPTIONS') {
    const h = { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };
    if (ALLOWED.includes(origin)) { h['Access-Control-Allow-Origin'] = origin; h['Vary'] = 'Origin'; }
    res.writeHead(204, h);
    return res.end();
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    return send(res, 200, { ok: true, service: 'podoline-api', channel: 'max', configured: CONFIGURED }, origin);
  }

  if (req.method !== 'POST' || req.url.split('?')[0] !== '/lead') {
    return send(res, 404, { ok: false, error: 'not_found' }, origin);
  }
  if (!ALLOWED.includes(origin)) return send(res, 403, { ok: false, error: 'forbidden' }, origin);

  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 10000) { req.destroy(); }
  });
  req.on('end', async () => {
    let data;
    try { data = JSON.parse(body || '{}'); } catch (e) { return send(res, 400, { ok: false, error: 'bad_json' }, origin); }

    // Скрытое поле-ловушка: люди его не видят, боты заполняют
    if (clean(data.website, 200)) return send(res, 200, { ok: true }, origin);

    const name = clean(data.name, 80);
    const phone = clean(data.phone, 40);
    const topic = clean(data.topic, 120);
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) return send(res, 400, { ok: false, error: 'bad_phone' }, origin);
    if (!data.consent) return send(res, 400, { ok: false, error: 'no_consent' }, origin);

    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (tooMany(ip)) return send(res, 429, { ok: false, error: 'too_many' }, origin);

    if (!CONFIGURED) {
      console.error('Заявка не отправлена: не заданы MAX_TOKEN и MAX_CHAT_ID/MAX_USER_ID');
      return send(res, 500, { ok: false, error: 'not_configured' }, origin);
    }

    const time = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Vladivostok', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const text = [
      'Новая заявка с сайта podoline.ru',
      '',
      'Имя: ' + (name || 'не указано'),
      'Телефон: +' + digits.replace(/^8(\d{10})$/, '7$1'),
      'Что беспокоит: ' + (topic || 'не указано'),
      '',
      time + ' · согласие на обработку ПД получено'
    ].join('\n');

    const target = MAX_CHAT_ID ? 'chat_id=' + encodeURIComponent(MAX_CHAT_ID) : 'user_id=' + encodeURIComponent(MAX_USER_ID);
    try {
      const r = await maxRequest('POST', '/messages?' + target, { text: text, notify: true });
      if (r.status < 200 || r.status >= 300) {
        console.error('MAX error:', r.status, r.text);
        return send(res, 502, { ok: false, error: 'max' }, origin);
      }
      return send(res, 200, { ok: true }, origin);
    } catch (e) {
      console.error('MAX request failed:', e.code || '', e.message);
      return send(res, 502, { ok: false, error: 'max' }, origin);
    }
  });
};

// Помощник настройки: пока не указан чат, ищем ID чатов и пользователей в событиях бота
function collectIds(obj, out) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if ((k === 'chat_id' || k === 'user_id') && (typeof v === 'number' || typeof v === 'string')) {
      const title = obj.title || obj.name || (obj.first_name ? (obj.first_name + ' ' + (obj.last_name || '')).trim() : '');
      out.add(k + '=' + v + (title ? ' (' + title + ')' : ''));
    } else if (typeof v === 'object') collectIds(v, out);
  }
}
async function discover() {
  console.log('MAX_CHAT_ID не задан. Добавьте бота в группу или напишите ему — ищу ID…');
  const found = new Set();
  for (let i = 0; i < 40; i++) { // ~20 минут
    try {
      const r = await maxRequest('GET', '/updates?timeout=30&limit=100');
      if (r.status === 401 || r.status === 403) { console.error('MAX: токен не подходит (' + r.status + '): ' + r.text); return; }
      if (r.json) {
        const before = found.size;
        collectIds(r.json.updates || r.json, found);
        if (found.size > before) console.log('Найдено в MAX: ' + Array.from(found).join(' | '));
      }
    } catch (e) {
      console.error('MAX updates failed:', e.code || '', e.message);
      await new Promise(r => setTimeout(r, 15000));
    }
  }
}

PORTS.forEach(port => {
  const srv = http.createServer(handler);
  srv.on('error', e => console.error('Port ' + port + ' unavailable: ' + e.message));
  srv.listen(port, () => console.log('podoline-api listening on ' + port + (CONFIGURED ? '' : ' (MAX not configured)')));
});
if (MAX_TOKEN && !MAX_CHAT_ID && !MAX_USER_ID) discover();
