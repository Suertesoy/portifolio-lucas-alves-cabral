/* Lucas Cabral — Home (checkpoint 11): nav, section reveal, lazy case videos, four-leaf marks.
   The hero lives in assets/hero/hero.js (ES module, WebGL). */
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

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
  const vidIO = new IntersectionObserver(entries => entries.forEach(en => {
    const v = en.target;
    if (en.isIntersecting) {
      if (!v.src) { v.src = v.dataset.src; v.preload = 'metadata'; }
      if (!reduce.matches) v.play().catch(() => {});
    } else v.pause();
  }), { rootMargin: '200px 0px', threshold: 0.2 });
  document.querySelectorAll('video.lazy-video').forEach(v => vidIO.observe(v));

  /* ------------------------------------------------------------------ four-leaf marks: the leaf a column stands for, highlighted */
  document.querySelectorAll('.leaf').forEach(li => {
    const k = +getComputedStyle(li).getPropertyValue('--leaf') || 0;
    const leaf = a => `<ellipse cx="12" cy="6.4" rx="4.3" ry="5.4" transform="rotate(${a} 12 12)"/>`;
    li.querySelector('.leaf-mark').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#4A4F4A" stroke-width="1">${[0, 90, 180, 270].map(a => leaf(a - 45)).join('')}`
      + `<g fill="#8FA58A" stroke="#3E5A4A">${leaf(k * 90 - 45)}</g></svg>`;
  });

  /* ------------------------------------------------------------------ portrait: the whole photo is a toggle (ck13)
     tap / click / Enter / Space switch grey ↔ colour (aria-pressed); a fine pointer also previews colour on hover (CSS) */
  const photo = document.getElementById('person-photo'), photoBtn = photo && photo.querySelector('.photo-toggle');
  if (photoBtn) photoBtn.addEventListener('click', () => {
    const on = photoBtn.getAttribute('aria-pressed') !== 'true';
    photoBtn.setAttribute('aria-pressed', String(on));
    photo.classList.toggle('is-color', on);
  });

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
