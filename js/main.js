/* ПодоЛайн — анимации при прокрутке, прогулка по кабинету, отзывы и форма записи */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Прогулка по кабинету ---------- */
  var TOUR_KEYS = [
    { p: 0, z: 0, x: 0 },
    { p: 0.25, z: 350, x: -260 },
    { p: 0.5, z: 1000, x: 300 },
    { p: 0.75, z: 1750, x: -120 },
    { p: 1, z: 2450, x: 200 }
  ];
  var TOUR_STOPS = [
    { title: 'Добро пожаловать', text: 'Листайте вниз, чтобы пройти по студии.' },
    { title: 'Ресепшен', text: 'Встречаем, даём бахилы и уточняем, что беспокоит.' },
    { title: 'Зона ожидания', text: 'Если пришли раньше, можно выпить воды и заполнить анкету.' },
    { title: 'Кресло подолога', text: 'Кресло с регулировкой, лампа-лупа и аппарат с пылесосом: пыль не летит.' },
    { title: 'Стерилизационная', text: 'Воздушный стерилизатор: сухой горячий воздух. Инструмент ждёт вас в запечатанном крафт-пакете.' }
  ];
  var PILL_BASE = 'padding: 6px 14px; border-radius: 999px; font-size: 14px; font-weight: 500; ';
  var PILL_ON = PILL_BASE + 'background: #141118; color: #F3EFF8';
  var PILL_OFF = PILL_BASE + 'background: rgba(255,255,255,0.85); color: #141118';

  var hero = document.getElementById('top');
  var logo = document.getElementById('hero-logo');
  var tour = document.getElementById('tour');
  var world = document.getElementById('tour-world');
  var tourItems = tour ? tour.querySelectorAll('[data-z]') : [];
  var pills = document.querySelectorAll('.tour-pill');
  var capN = document.getElementById('cap-n');
  var capTitle = document.getElementById('cap-title');
  var capText = document.getElementById('cap-text');
  var currentStop = -1;

  function updateLogo() {
    if (!hero || !logo || reduceMotion) return;
    var r = hero.getBoundingClientRect();
    var q = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
    logo.style.transform = 'translateY(' + (q * 180).toFixed(1) + 'px) scale(' + (1 - q * 0.3).toFixed(3) + ') rotate(' + (-q * 4).toFixed(2) + 'deg)';
    logo.style.opacity = String(1 - q * 0.75);
  }

  function updateTour() {
    if (!tour || !world) return;
    var r = tour.getBoundingClientRect();
    var total = r.height - 720;
    var p = Math.min(1, Math.max(0, -r.top / total));
    var i = Math.min(TOUR_KEYS.length - 2, Math.floor(p * 4));
    var a = TOUR_KEYS[i], b = TOUR_KEYS[i + 1];
    var t = (p - a.p) / (b.p - a.p);
    t = t * t * (3 - 2 * t);
    var z = a.z + (b.z - a.z) * t;
    var x = a.x + (b.x - a.x) * t;
    world.style.transform = 'translate3d(' + (-x) + 'px, 0, ' + z + 'px)';

    for (var k = 0; k < tourItems.length; k++) {
      var el = tourItems[k];
      var eff = Number(el.getAttribute('data-z')) + z;
      if (el.getAttribute('data-k') === 'seg') {
        el.style.visibility = eff > 760 ? 'hidden' : 'visible';
      } else {
        var o = Math.min(1, Math.max(0, (150 - eff) / 250));
        el.style.opacity = String(o);
        el.style.visibility = o === 0 ? 'hidden' : 'visible';
      }
    }

    var stop = Math.round(p * 4);
    if (stop !== currentStop) {
      currentStop = stop;
      for (var s = 0; s < pills.length; s++) pills[s].setAttribute('style', s === stop ? PILL_ON : PILL_OFF);
      if (capN) capN.textContent = (stop + 1) + ' из ' + TOUR_STOPS.length;
      if (capTitle) capTitle.textContent = TOUR_STOPS[stop].title;
      if (capText) capText.textContent = TOUR_STOPS[stop].text;
    }
  }

  var raf = 0;
  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; updateLogo(); updateTour(); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  updateLogo();
  updateTour();

  /* ---------- Стопка отзывов ---------- */
  var cards = document.querySelectorAll('.review-card');
  var counter = document.getElementById('review-counter');
  var reviewIndex = 0;
  var CARD_BASE = 'position: absolute; left: 0; top: 0; width: calc(100% - 48px); height: 310px; box-sizing: border-box; padding: 28px 30px; border-radius: 24px; display: flex; flex-direction: column; gap: 18px; transition: transform 0.45s ease, opacity 0.45s ease, background 0.45s ease; ';
  var CARD_TOP = 'background: #F3EFF8; color: #140F1A; box-shadow: 0 24px 60px rgba(0,0,0,0.45); cursor: default; ';
  var CARD_BACK = 'background: #17131D; color: #F3EFF8; border: 1px solid #2A2433; cursor: pointer; ';

  function layoutReviews() {
    var n = cards.length;
    if (!n) return;
    for (var idx = 0; idx < n; idx++) {
      var d = (idx - reviewIndex + n) % n;
      cards[idx].setAttribute('style', CARD_BASE + (d === 0 ? CARD_TOP : CARD_BACK) +
        'z-index: ' + (n - d) + '; opacity: ' + (d > 2 ? 0 : 1) +
        '; transform: translate(' + (d * 16) + 'px, ' + (d * 18) + 'px) rotate(' + (d * 2.5) + 'deg);');
      cards[idx].setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
    }
    if (counter) counter.textContent = (reviewIndex + 1) + ' / ' + n;
  }
  function showReview(i) {
    var n = cards.length;
    reviewIndex = ((i % n) + n) % n;
    layoutReviews();
  }
  document.querySelectorAll('[data-action="next-review"]').forEach(function (b) {
    b.addEventListener('click', function () { showReview(reviewIndex + 1); });
  });
  document.querySelectorAll('[data-action="prev-review"]').forEach(function (b) {
    b.addEventListener('click', function () { showReview(reviewIndex - 1); });
  });
  cards.forEach(function (card) {
    card.addEventListener('click', function () { showReview(Number(card.getAttribute('data-index'))); });
  });
  layoutReviews();

  /* ---------- Форма записи → Telegram ---------- */
  var form = document.getElementById('booking-form');
  var btn = document.getElementById('b-submit');
  var status = document.getElementById('b-status');
  var WORKER_URL = (window.PODOLINE_CONFIG || {}).workerUrl || '';

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });

      if (String(data.phone || '').replace(/\D/g, '').length < 10) {
        status.textContent = 'Введите номер телефона полностью, например +7 914 000-00-00.';
        return;
      }
      if (!WORKER_URL) {
        status.textContent = 'Форма пока не подключена. Позвоните нам: +7 914 161-03-48.';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Отправляем…';
      status.textContent = '';

      fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (res) { return res.json(); })
        .then(function (out) {
          if (!out.ok) throw new Error(out.error || 'error');
          form.reset();
          status.textContent = 'Заявка отправлена. Перезвоним в течение рабочего дня.';
          btn.textContent = 'Отправлено';
        })
        .catch(function () {
          status.textContent = 'Не получилось отправить. Позвоните нам: +7 914 161-03-48.';
          btn.disabled = false;
          btn.textContent = 'Отправить заявку';
        });
    });
  }
})();
