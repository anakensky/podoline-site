/* ПодоЛайн — анимации при прокрутке, прогулка по студии, отзывы и форма записи */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Прогулка по студии (фотографии) ---------- */
  var TOUR_STOPS = [
    { title: 'Добро пожаловать', text: 'Проспект Копылова, 33, вход с торца здания. Листайте вниз, чтобы пройти внутрь.' },
    { title: 'Зона ожидания', text: 'Если пришли чуть раньше, присядьте в кресло. Есть вода, конфеты и вешалка для верхней одежды.' },
    { title: 'Кабинет подолога', text: 'Кресло с регулировкой, лампа-лупа и аппарат с пылесосом: пыль от обработки не разлетается по кабинету.' },
    { title: 'Стерилизационная', text: 'Инструмент проходит очистку и стерилизацию сухим горячим воздухом, а потом ждёт вас в запечатанном крафт-пакете.' }
  ];

  var hero = document.getElementById('top');
  var logo = document.getElementById('hero-logo');
  var tour = document.getElementById('tour');
  var slides = tour ? tour.querySelectorAll('.ptour-slide') : [];
  var stage = tour ? tour.querySelector('.ptour-stage') : null;
  var pills = document.querySelectorAll('.tour-pill');
  var capN = document.getElementById('cap-n');
  var capTitle = document.getElementById('cap-title');
  var capText = document.getElementById('cap-text');
  var currentStop = -1;
  var landscape = window.matchMedia ? window.matchMedia('(orientation: landscape)') : { matches: true };

  function clamp01(v) { return Math.min(1, Math.max(0, v)); }
  function smooth(t) { return t * t * (3 - 2 * t); }

  function updateLogo() {
    if (!hero || !logo || reduceMotion) return;
    var r = hero.getBoundingClientRect();
    var q = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
    logo.style.transform = 'translateY(' + (q * 180).toFixed(1) + 'px) scale(' + (1 - q * 0.3).toFixed(3) + ') rotate(' + (-q * 4).toFixed(2) + 'deg)';
    logo.style.opacity = String(1 - q * 0.75);
  }

  function updateTour() {
    if (!tour || !stage || !slides.length) return;
    var n = slides.length;
    var r = tour.getBoundingClientRect();
    var p = clamp01(-r.top / Math.max(1, r.height - stage.offsetHeight));
    var f = p * (n - 1); // 0 … n-1: где мы между остановками

    for (var k = 0; k < n; k++) {
      var slide = slides[k];
      // следующее фото плавно проявляется на последней трети пути
      var o = k === 0 ? 1 : smooth(clamp01((f - (k - 1) - 0.55) / 0.45));
      slide.style.opacity = o.toFixed(3);
      slide.style.visibility = o === 0 ? 'hidden' : 'visible';
      if (o === 0 || reduceMotion) continue;

      // «шаг вперёд»: фото медленно приближается, на телефоне ещё и панорама слева направо
      var local = clamp01((f - k + 1) / 2);
      var img = slide.querySelector('.ptour-img');
      var tall = slide.classList.contains('ptour-slide--tall');
      var scale = tall && landscape.matches ? 1 + 0.04 * local : 1.02 + 0.1 * local;
      img.style.transform = 'scale(' + scale.toFixed(4) + ')';
      if (!landscape.matches) {
        var pan = (slide.getAttribute('data-pan') || '50 50').split(' ');
        var x = Number(pan[0]) + (Number(pan[1]) - Number(pan[0])) * local;
        img.style.objectPosition = x.toFixed(1) + '% 50%';
      } else {
        img.style.objectPosition = '';
      }
    }

    var stop = Math.min(n - 1, Math.floor(f + 0.25));
    if (stop !== currentStop) {
      currentStop = stop;
      for (var s = 0; s < pills.length; s++) pills[s].classList.toggle('is-on', s === stop);
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
