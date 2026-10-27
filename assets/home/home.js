/* Lucas Cabral — Home (checkpoint 11): nav, section reveal, lazy case videos, four-leaf marks, Living Grid beyond the hero.
   The hero lives in assets/hero/hero.js (ES module, WebGL). */
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)'), root0 = document.documentElement;

  /* ------------------------------------------------------------------ language
     The page is already localized by its URL (/, /en/, /es/ — see assets/i18n/lang-kit.js and scripts/build-i18n.mjs). */
  LangKit.init();

  /* ------------------------------------------------------------------ nav: solid after the hero top, mobile menu, active section */
  const nav = document.getElementById('nav'), menuBtn = document.getElementById('menu-btn');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const setMenu = open => { nav.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
  menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  document.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  const links = new Map([...document.querySelectorAll('.nav-links a')].map(a => [a.getAttribute('href').slice(1), a]));
  const secIO = new IntersectionObserver(entries => entries.forEach(en => {
    const a = links.get(en.target.id); if (!a) return;
    if (en.isIntersecting) { links.forEach(l => l.classList.remove('active')); a.classList.add('active'); }
  }), { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((_, id) => { const s = document.getElementById(id); if (s) secIO.observe(s); });

  /* ------------------------------------------------------------------ reveal on scroll */
  const revIO = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); revIO.unobserve(en.target); } }),
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => revIO.observe(el));

  /* ------------------------------------------------------------------ case videos: load when near, play only while visible */
  // a video in a project card that another card covers (the stacked room below) stays paused: on screen is not the same as visible
  const playIfShown = v => { if (v.dataset.seen && !reduce.matches && !v.closest('.is-covered')) v.play().catch(() => {}); else v.pause(); };
  const vidIO = new IntersectionObserver(entries => entries.forEach(en => {
    const v = en.target;
    if (en.isIntersecting) {
      if (!v.src) { v.src = v.dataset.src; v.preload = 'metadata'; }
      v.dataset.seen = '1';
    } else delete v.dataset.seen;
    playIfShown(v);
  }), { rootMargin: '200px 0px', threshold: 0.2 });
  document.querySelectorAll('video.lazy-video').forEach(v => vidIO.observe(v));

  /* ------------------------------------------------------------------ the projects' dark room (Ciclo 4B.1)
     The stacking is CSS (position: sticky; the recede is a scroll-driven animation where supported) and needs none of this to work.
     This only covers what CSS cannot know, on events, never per frame:
     - focus: a sticky card can rest under the next one, so when focus enters a card that is covered (or off screen), the page goes
       back to that card's resting place (its anchor in the flow) — the focused element is never left hidden behind another card;
     - fit: a card taller than the screen would stick with its button below the fold; it then sticks by its bottom edge instead;
     - covered: a card under the next one is marked .is-covered (its video pauses);
     - the nav turns dark while it sits over the room. */
  const room = document.getElementById('room');
  if (room) {
    const stacked = matchMedia('(prefers-reduced-motion: no-preference) and (min-height: 650px)');   // = the CSS
    const cards = [...room.querySelectorAll('.ficha')], anchors = cards.map(c => c.previousElementSibling);
    const navH = () => nav.offsetHeight;

    const fit = () => {
      cards.forEach(c => c.style.removeProperty('--fit'));
      if (!stacked.matches) return;
      const limit = root0.clientHeight - 12;   // the layout viewport: stable while a mobile toolbar slides in and out
      cards.forEach(c => {
        const top = parseFloat(getComputedStyle(c).top) || 0, h = c.offsetHeight;
        if (top + h > limit) c.style.setProperty('--fit', Math.round(limit - h) + 'px');
      });
    };
    const ro = new ResizeObserver(fit); cards.forEach(c => ro.observe(c));
    addEventListener('resize', fit, { passive: true });
    stacked.addEventListener('change', fit);

    // the act's curtains (CSS) can be dark over the index while the entry act is still on screen, or over the last card while the exit
    // act begins: focus arriving there brings the element to where the curtain has lifted
    const actIn = room.querySelector('.room-act--in'), actOut = room.querySelector('.room-act--out'), index = room.querySelector('.room-index');
    room.addEventListener('focusin', e => {
      const card = e.target.closest('.ficha');
      if (!stacked.matches || !(card || index.contains(e.target))) return;
      requestAnimationFrame(() => {   // after the browser's own scroll-into-view
        const ch = root0.clientHeight;
        if (!card) { if (actIn.getBoundingClientRect().bottom > ch * 0.3) index.scrollIntoView({ block: 'start' }); return; }
        const i = cards.indexOf(card), r = e.target.getBoundingClientRect();
        const covered = cards.slice(i + 1).some(n => { const q = n.getBoundingClientRect(); return q.top < r.bottom && q.bottom > r.top; });
        if (covered || r.top < navH() || r.bottom > ch || actOut.getBoundingClientRect().top < ch) anchors[i].scrollIntoView({ block: 'start' });
      });
    });

    // card i is covered once the next card's anchor has risen past the upper fifth of the screen
    const covIO = new IntersectionObserver(entries => entries.forEach(en => {
      const prev = cards[anchors.indexOf(en.target) - 1]; if (!prev) return;
      prev.classList.toggle('is-covered', stacked.matches && !en.isIntersecting && en.boundingClientRect.top < en.rootBounds.top);
      prev.querySelectorAll('video.lazy-video').forEach(playIfShown);
    }), { rootMargin: '-20% 0px 0px 0px' });
    anchors.forEach(a => covIO.observe(a));

    // the nav over the dark: the entry act or the room's body under the middle of the nav bar. With the act, the atmosphere turns at
    // the entry act's top and at the exit act's top, both while the screen is black — the exit act itself is already light.
    const darkZones = [room.querySelector('.room-act--in'), room.querySelector('.room-body')], under = new Set();
    let darkIO;
    const watchDark = () => {
      if (darkIO) darkIO.disconnect();
      under.clear();
      const mid = Math.round(navH() / 2);
      darkIO = new IntersectionObserver(entries => {
        entries.forEach(en => { en.isIntersecting ? under.add(en.target) : under.delete(en.target); });
        nav.classList.toggle('on-dark', under.size > 0);
      }, { rootMargin: `-${mid}px 0px -${Math.max(0, root0.clientHeight - mid - 1)}px 0px` });
      darkZones.forEach(z => darkIO.observe(z));
    };
    watchDark(); addEventListener('resize', watchDark, { passive: true });
  }

  /* ------------------------------------------------------------------ four-leaf marks: the leaf a column stands for, highlighted */
  document.querySelectorAll('.leaf').forEach(li => {
    const k = +getComputedStyle(li).getPropertyValue('--leaf') || 0;
    const leaf = a => `<ellipse cx="12" cy="6.4" rx="4.3" ry="5.4" transform="rotate(${a} 12 12)"/>`;
    li.querySelector('.leaf-mark').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#4A4F4A" stroke-width="1">${[0, 90, 180, 270].map(a => leaf(a - 45)).join('')}`
      + `<g fill="#8FA58A" stroke="#3E5A4A">${leaf(k * 90 - 45)}</g></svg>`;
  });

  /* a principle leans its leaf (the mark's quadrant) toward the reader on the 3D clover — pointer only; the clover is the hero's renderer */
  const leafApi = k => { const h = window.__hero; if (h && h.api && h.api.leaf) h.api.leaf(k); };
  document.querySelectorAll('.leaf').forEach(li => {
    const k = +getComputedStyle(li).getPropertyValue('--leaf') || 0;
    li.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') leafApi(k); });
    li.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') leafApi(null); });
  });

  /* ------------------------------------------------------------------ small screens: the still clover marks (ck21)
     Where the 3D clover would be too big for the layout (≤ 899 px, the same breakpoint kinetic.js uses to draw no stage), the
     work / method / contact headers carry the navbar's symbol instead. No WebGL here: a quarter turn, a small entrance, both a pure
     function of where the mark stands in the viewport (compositor-only transform), written only while a mark is on screen.
     Reduced motion: the mark stands still, fully shown (the CSS defaults). */
  const marks = [...document.querySelectorAll('.clover-mark')], small = matchMedia('(max-width: 899px)');
  if (marks.length) {
    const near = new Set(); let queued = false;
    const clamp01 = v => Math.min(1, Math.max(0, v));
    const paint = () => {
      queued = false;
      const still = reduce.matches || !small.matches;
      near.forEach(m => {
        if (still) { m.style.removeProperty('--mk-r'); m.style.removeProperty('--mk-s'); m.style.removeProperty('--mk-o'); return; }
        const r = m.getBoundingClientRect(); if (!r.height) return;
        const c = clamp01(1 - (r.top + r.height / 2) / innerHeight);   // 0 as the mark rises into the viewport, 1 as it leaves at the top
        const e = clamp01(c / 0.2), s = e * e * (3 - 2 * e);           // the entrance: over the first fifth of its passage
        m.style.setProperty('--mk-r', ((c - 0.5) * 90).toFixed(1) + 'deg');   // a quarter turn: the symbol has four equal leaves
        m.style.setProperty('--mk-s', (0.7 + 0.3 * s).toFixed(3));
        m.style.setProperty('--mk-o', s.toFixed(3));
      });
    };
    const queue = () => { if (!queued && near.size) { queued = true; requestAnimationFrame(paint); } };
    const markIO = new IntersectionObserver(entries => { entries.forEach(en => { en.isIntersecting ? near.add(en.target) : near.delete(en.target); }); queue(); }, { rootMargin: '12% 0px' });
    marks.forEach(m => markIO.observe(m));
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue, { passive: true });
    reduce.addEventListener('change', queue);
  }

  /* ------------------------------------------------------------------ "Ver cases" on small screens (ck21)
     The tap gives the clover a push toward the reader (kinetic.js: cta); the page then goes to #cases with the browser's own anchor
     navigation, a beat into the push. Anywhere the push cannot run — desktop, reduced motion, no WebGL, the module not started, the
     clover not at the top — the link is left alone and the browser follows it as it always did. */
  const ctaCases = document.querySelector('.hb-ctas a[href="#cases"]');
  if (ctaCases) ctaCases.addEventListener('click', e => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const h = window.__hero, push = h && h.api && h.api.push;
    if (!small.matches || reduce.matches || !push) return;
    const delay = push();   // ms until the page should start moving; false when the push cannot run
    if (delay === false) return;
    e.preventDefault();
    const y0 = scrollY;
    setTimeout(() => {
      if (Math.abs(scrollY - y0) > 40) return;   // the reader took over in that beat: the page is where they put it
      if (location.hash !== '#cases') location.hash = 'cases'; else document.getElementById('cases').scrollIntoView();
    }, delay);
  });

  /* The portrait has no control of its own (ck20): its colour is led by the clover (assets/hero/kinetic.js). It starts grey
     (html.kx-want, set in the head); if the hero module never starts (CDN down), the portrait goes back to colour. */
  addEventListener('load', () => setTimeout(() => { if (!window.__hero) root0.classList.remove('kx-want'); }, 8000));

  /* ------------------------------------------------------------------ Living Grid beyond the hero (ck13)
     The hero paints the full Living Grid in WebGL (assets/hero/living-grid.js). Below it the same modular grid goes on as
     a still surface: .page-grid columns + rows of the same module (CSS), fading with depth. With a fine pointer, a damped
     sage light reveals the grid around the cursor: one fixed layer holding a copy of the grid, moved with transforms only
     (compositor, no repaint, no second WebGL scene). Calmer over the case studies; off on touch and with reduced motion. */
  const pg = document.querySelector('.page-grid'), pgWrap = pg && pg.querySelector('.wrap'), root = document.documentElement;
  if (pgWrap) {
    const metrics = () => {
      const col = pgWrap.querySelector('i');
      root.style.setProperty('--lg-field', col.getBoundingClientRect().width + 'px');
      root.style.setProperty('--lg-gut', (parseFloat(getComputedStyle(pgWrap).columnGap) || 0) + 'px');
      root.style.setProperty('--lg-vw', root.clientWidth + 'px');
    };
    metrics(); root.classList.add('lg-rows');
    addEventListener('resize', metrics, { passive: true });

    // depth: rows (and the light) lose intensity from the end of the hero to the end of the page
    const hero = document.getElementById('hb');
    let depth = 1;
    const updDepth = () => {
      const h0 = hero ? hero.offsetHeight : 0, span = Math.max(1, root.scrollHeight - innerHeight - h0);
      depth = 1 - 0.5 * Math.min(1, Math.max(0, (scrollY - h0) / span));
      pg.style.setProperty('--lg-depth', depth.toFixed(3));
    };
    updDepth();

    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    if (fine.matches && !reduce.matches) {
      const S = 560, light = document.createElement('div'), plane = document.createElement('div');
      light.className = 'grid-light'; light.setAttribute('aria-hidden', 'true'); plane.className = 'grid-light-plane';
      plane.appendChild(pgWrap.cloneNode(true)); light.appendChild(plane); pg.after(light);
      // how present the light is over each section (the work section stays calm for reading)
      const WEIGHT = { hb: 0, person: 0.9, cases: 0.45, method: 0.85, journey: 0.75, contact: 0.85 };
      let zones = [];
      const measure = () => { zones = [...document.querySelectorAll('main > section')].map(s => ({ w: WEIGHT[s.id] ?? 0.6, top: s.offsetTop, bottom: s.offsetTop + s.offsetHeight })); };
      measure(); new ResizeObserver(measure).observe(document.body);
      const st = { x: -999, y: -999, o: 0, tx: -999, ty: -999, to: 0, on: false }; let raf = 0, last = 0;
      const target = () => {
        if (!st.on) return 0;
        const y = st.ty + scrollY, z = zones.find(z => y >= z.top && y < z.bottom);
        return (z ? z.w : 0.6) * (0.55 + 0.45 * depth);
      };
      const frame = now => {
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
        const kp = 1 - Math.exp(-dt / 0.12), ko = 1 - Math.exp(-dt / 0.28);   // damped follow, slower fade
        st.to = target();
        st.x += (st.tx - st.x) * kp; st.y += (st.ty - st.y) * kp; st.o += (st.to - st.o) * ko;
        const x0 = Math.round(st.x - S / 2), y0 = Math.round(st.y - S / 2);
        light.style.transform = `translate3d(${x0}px, ${y0}px, 0)`;
        plane.style.transform = `translate3d(${-x0}px, ${-y0}px, 0)`;   // the grid stays put, the window over it moves
        light.style.opacity = st.o.toFixed(3);
        const settled = Math.abs(st.tx - st.x) < 0.5 && Math.abs(st.ty - st.y) < 0.5 && Math.abs(st.to - st.o) < 0.004;
        raf = settled ? 0 : requestAnimationFrame(frame); if (!raf) last = 0;
      };
      const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
      addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        if (st.o < 0.01) { st.x = e.clientX; st.y = e.clientY; }   // appears where the hand is, no sweep from far away
        st.tx = e.clientX; st.ty = e.clientY; st.on = true; kick();
      }, { passive: true });
      root.addEventListener('mouseleave', () => { st.on = false; kick(); });
      addEventListener('scroll', () => { updDepth(); kick(); }, { passive: true });
      window.__grid = { light, state: st };   // evaluation hook (tests)
    } else addEventListener('scroll', updDepth, { passive: true });
  }
})();
