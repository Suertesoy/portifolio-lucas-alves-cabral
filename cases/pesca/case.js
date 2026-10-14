/* Pesca case — language switch, lightbox, reveal. No dependencies. */
(function () {
  'use strict';

  /* ---------- i18n ----------
     PT lives in the markup. On load we snapshot it, then swap from CASE_EN.
     Shares the portfolio's `lang` key ('pt' | 'en') so the choice carries over from the Home. */
  var EN = window.CASE_EN || {};
  var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-i18n], [data-i18n-html]'));
  var PT = {};
  var ptTitle = document.title;

  nodes.forEach(function (el) {
    var key = el.getAttribute('data-i18n') || el.getAttribute('data-i18n-html');
    var attr = el.getAttribute('data-i18n-attr');
    var html = el.hasAttribute('data-i18n-html');
    // The same key can be used on several elements; the first snapshot wins.
    var slot = key + (attr ? '@' + attr : '');
    if (!(slot in PT)) PT[slot] = attr ? el.getAttribute(attr) : (html ? el.innerHTML : el.textContent);
  });

  function applyLang(lang) {
    var en = lang === 'en';
    document.documentElement.lang = en ? 'en' : 'pt-BR';
    document.title = en ? EN['doc.title'] : ptTitle;
    nodes.forEach(function (el) {
      var key = el.getAttribute('data-i18n') || el.getAttribute('data-i18n-html');
      var attr = el.getAttribute('data-i18n-attr');
      var html = el.hasAttribute('data-i18n-html');
      var slot = key + (attr ? '@' + attr : '');
      var value = en ? EN[key] : PT[slot];
      if (value === undefined) return;
      if (attr) el.setAttribute(attr, value);
      else if (html) el.innerHTML = value;
      else el.textContent = value;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang));
    });
    try { localStorage.setItem('lang', lang); } catch (e) {}
    if (lb && lb.open) fillLightbox();   // cases without a gallery have no lightbox
  }

  /* ---------- lightbox ---------- */
  var lb = document.getElementById('lb');
  var lbImg = document.getElementById('lb-img');
  var lbCap = document.getElementById('lb-cap');
  var lbCount = document.getElementById('lb-count');
  var shots = Array.prototype.slice.call(document.querySelectorAll('#gallery .shot'));
  var current = 0;

  function fillLightbox() {
    var shot = shots[current];
    var img = shot.querySelector('img');
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    var cap = shot.querySelector('.shot-cap');
    lbCap.textContent = cap.querySelector('span').textContent;
    lbCount.textContent = (current + 1) + ' / ' + shots.length;
  }
  function openAt(i) {
    current = (i + shots.length) % shots.length;
    fillLightbox();
    if (!lb.open) lb.showModal();
  }
  if (lb && typeof lb.showModal === 'function') {
    shots.forEach(function (s, i) { s.addEventListener('click', function () { openAt(i); }); });
    document.getElementById('lb-close').addEventListener('click', function () { lb.close(); });
    document.getElementById('lb-prev').addEventListener('click', function () { openAt(current - 1); });
    document.getElementById('lb-next').addEventListener('click', function () { openAt(current + 1); });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); openAt(current - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); openAt(current + 1); }
    });
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.classList.contains('lb-in') || e.target.classList.contains('lb-stage')) lb.close();
    });
    lb.addEventListener('close', function () { lbImg.removeAttribute('src'); });
  } else {
    // Old browsers without <dialog>: open the image itself in the same tab.
    shots.forEach(function (s) {
      s.addEventListener('click', function () { window.open(s.querySelector('img').src, '_blank', 'noopener'); });
    });
  }

  /* ---------- init language ---------- */
  var saved = null;
  try { saved = localStorage.getItem('lang'); } catch (e) {}
  applyLang(saved === 'en' ? 'en' : 'pt');
  Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (b) {
    b.addEventListener('click', function () { applyLang(b.getAttribute('data-lang')); });
  });

  /* ---------- reveal on scroll (content stays visible without JS / with reduced motion) ---------- */
  var items = document.querySelectorAll('.reveal');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    items.forEach(function (el) { io.observe(el); });
    // Safety net: never leave content hidden.
    setTimeout(function () { items.forEach(function (el) { el.classList.add('in'); }); }, 4000);
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }
})();
