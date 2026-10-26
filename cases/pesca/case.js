/* Case pages (Pesca, Sartec) — lightbox, reveal, language switcher hook. No dependencies. */
(function () {
  'use strict';

  /* ---------- lightbox ---------- */
  var lb = document.getElementById('lb');
  var lbImg = document.getElementById('lb-img');
  var lbCap = document.getElementById('lb-cap');
  var lbCount = document.getElementById('lb-count');
  var lbNav = lb && lb.querySelector('.lb-nav');
  // Each trigger opens the lightbox inside its own set: the prototype gallery, or (ck29) the [data-zoom] buttons of one [data-lb-group].
  var sets = [Array.prototype.slice.call(document.querySelectorAll('#gallery .shot'))];
  Array.prototype.forEach.call(document.querySelectorAll('[data-lb-group]'), function (g) {
    sets.push(Array.prototype.slice.call(g.querySelectorAll('[data-zoom]')));
  });
  var shots = [];
  var current = 0;

  function fillLightbox() {
    var shot = shots[current];
    var img = shot.querySelector('img');
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    var cap = shot.querySelector('.shot-cap');
    lbCap.textContent = cap ? cap.querySelector('span').textContent : img.alt;
    lbCount.textContent = shots.length > 1 ? (current + 1) + ' / ' + shots.length : '';
    lbNav.hidden = shots.length < 2;
  }
  function openAt(i) {
    current = (i + shots.length) % shots.length;
    fillLightbox();
    if (!lb.open) lb.showModal();
  }
  if (lb && typeof lb.showModal === 'function') {
    sets.forEach(function (set) {
      set.forEach(function (s, i) { s.addEventListener('click', function () { shots = set; openAt(i); }); });
    });
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
    sets.forEach(function (set) {
      set.forEach(function (s) {
        s.addEventListener('click', function () { window.open(s.querySelector('img').src, '_blank', 'noopener'); });
      });
    });
  }

  /* ---------- language: the page is already localized by URL (see assets/i18n/lang-kit.js) ---------- */
  LangKit.init();

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
