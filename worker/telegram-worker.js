// Cloudflare Worker: принимает заявку с сайта ПодоЛайн и отправляет её в Telegram.
//
// Переменные окружения (Settings → Variables and Secrets):
//   BOT_TOKEN      — токен бота от @BotFather (добавить как Secret)
//   CHAT_ID        — id чата, куда слать заявки (ваш личный или группы)
//   ALLOWED_ORIGIN — адрес сайта, например https://podoline.ru

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ ok: false, error: "Только POST" }, 405, cors);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ ok: false, error: "Неверный формат" }, 400, cors);
    }

    // Ловушка для ботов: скрытое поле, которое человек не заполняет.
    if (data.website) {
      return json({ ok: true }, 200, cors);
    }

    const name = clean(data.name, 80);
    const phone = clean(data.phone, 30);
    const topic = clean(data.topic, 100);

    if (phone.replace(/\D/g, "").length < 10) {
      return json({ ok: false, error: "Укажите телефон" }, 400, cors);
    }

    const time = new Date().toLocaleString("ru-RU", { timeZone: "Asia/Vladivostok" });
    const text =
      "🦶 Новая заявка с сайта ПодоЛайн\n\n" +
      `Имя: ${name || "не указано"}\n` +
      `Телефон: ${phone}\n` +
      `Что беспокоит: ${topic || "не указано"}\n\n` +
      `Время: ${time}`;

    const tg = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.CHAT_ID, text }),
    });

    if (!tg.ok) {
      return json({ ok: false, error: "Не удалось отправить" }, 502, cors);
    }
    return json({ ok: true }, 200, cors);
  },
};

function clean(value, max) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}
