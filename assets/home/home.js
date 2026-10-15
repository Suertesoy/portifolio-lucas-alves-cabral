/* Lucas Cabral — Home (checkpoint 11): i18n PT/EN, nav, section reveal, lazy case videos, four-leaf marks.
   The hero lives in assets/hero/hero.js (ES module, WebGL). */
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------------ i18n (PT is the markup; EN mirrors it) */
  const EN = {
    'nav.skip': 'Skip to the case studies', 'nav.cases': 'Work', 'nav.about': 'About', 'nav.method': 'How I think', 'nav.contact': 'Contact', 'nav.cta': "Let's talk", 'nav.menu': 'Menu',
    'hero.kicker': 'Portfolio — 2026', 'hero.status': 'Available for opportunities', 'hero.fig': 'Fig. 01 — Four-leaf clover', 'hero.figLeaves': 'UX · UI · AI · Empathy',
    'hero.hint': 'Drag to rotate', 'hero.hintTouch': 'Swipe to rotate',
    'hero.desc': 'I design interfaces, flows and product systems, and use AI with judgment to speed up implementation all the way to real production.',
    'hero.ctaWork': 'View work',
    'person.kicker': 'Who designs', 'person.photoAlt': 'Portrait of Lucas Cabral',
    'person.colorBtn': 'See the portrait in colour', 'person.hintClick': 'Click to see in colour', 'person.hintTap': 'Tap to see in colour', 'person.hintBack': 'Back to black and white',
    'person.statement': 'I connect real operations, research, interface, product, AI and functional implementation.',
    'person.lead': "I grew up following the daily routine of Sartec, my family's business, seeing service, orders, clients, communication, sales and operations up close, every day.",
    'person.body': 'That contact with real problems shaped how I look at product before I ever worked formally with design. Today I design products and lead their implementation with AI — from the problem to the working interface.',
    'person.f1k': 'Role', 'person.f2k': 'Disciplines', 'person.f2v': 'Product Design · UX/UI · Design Systems · Applied AI', 'person.f3k': 'Languages', 'person.f3v': 'Portuguese · English',
    'work.kicker': 'Selected work', 'work.count': '05 projects', 'work.title': 'From the problem to the interface running in production.',
    'work.gA': 'Products and systems', 'work.gAdesc': 'Interfaces with rules, states and operations behind them — from the order to the panel.',
    'work.gB': 'Websites and web experiences', 'work.gBdesc': 'Information architecture, visual direction and web implementation for real businesses.',
    'pesca.kicker': 'Lead case · 2026', 'pesca.badge': 'Live', 'pesca.lede': 'From customizing a poke bowl over WhatsApp to a digital experience that connects buying and operations.',
    'pesca.m1': 'Role', 'pesca.m2': 'Disciplines', 'pesca.m3': 'Process', 'pesca.m3v': 'AI-assisted development', 'pesca.mapAria': 'System map',
    'pesca.n1k': 'Storefront', 'pesca.n1t': 'Where the customer decides', 'pesca.n2k': 'Shared rules', 'pesca.n2t': 'What is true', 'pesca.n3k': 'Panel', 'pesca.n3t': 'Where operations act',
    'pesca.cta': 'View full case', 'pesca.note': 'Captures of the public store in production · Oct 2026',
    'pesca.shotStore': 'Storefront', 'pesca.shotStoreAlt': 'Pesca Delivery store home screen, with the From the sea and Poke paths.',
    'pesca.shotBuilder': 'Poke builder', 'pesca.shotBuilderAlt': 'Poke builder: extra proteins, the bowl price and the add-to-cart button.',
    'crm.kicker': 'Internal system · Applied AI', 'crm.badge': 'Shipped', 'crm.title': 'Operational CRM + AI Agent', 'crm.videoAlt': 'Sartec CRM: the “Who is attending now?” window, where the attendant picks their own name before taking over the conversations.',
    'crm.sum': 'An internal system to centralize service requests, statuses, priorities and workflow, integrated with a WhatsApp AI agent for initial triage and handoff to the human team.',
    'crm.t1': 'Research with operations', 'crm.t2': 'Flow states', 'crm.t3': 'Human handoff', 'crm.cta': 'View full case',
    'uniedu.kicker': 'UX Research · Design System', 'uniedu.badge': 'Full case', 'uniedu.title': 'UNIEDU Platform', 'uniedu.videoAlt': 'UNIEDU app preview',
    'uniedu.sum': 'A gamified education product, shaped by research with students to turn study consistency into real progress. Product strategy, design system and a navigable prototype validated with the target audience.',
    'uniedu.cta': 'View full case', 'uniedu.cta2': 'Open prototype', 'uniedu.credit': 'A project in partnership with',
    'site.ia': 'Architecture', 'site.visual': 'Visual direction', 'site.build': 'Implementation',
    'papelaria.kicker': 'Website + digital ecosystem', 'papelaria.badge': 'Live', 'papelaria.open': 'Open the Sartec Papelaria website in a new tab',
    'papelaria.alt': 'Sartec Papelaria website home page: the main headline, buttons to explore products and send a school list, and the illustrated shopfront.',
    'papelaria.sum': 'The website of a stationery shop with over 30 years in São José dos Campos. It organizes what visitors come for — products, school lists, companies, copies — and leads everything to a single WhatsApp channel, the front door of the same operation served by the CRM + AI Agent.',
    'papelaria.ia': 'Navigation built on the real reasons to visit, with the school list up front', 'papelaria.visual': "The brand's identity applied to the web, with the shopfront as the opening image",
    'papelaria.build': 'Live website, integrated with WhatsApp', 'papelaria.cta': 'Visit the website',
    'almeida.kicker': 'Institutional website · PT/EN', 'almeida.badge': 'In staging', 'almeida.open': "Open the Grupo Almeida website's staging environment in a new tab",
    'almeida.alt': 'Grupo Almeida website home page: an aerial photo of the headquarters, the headline Turning waste into results and the PT/EN language switch.',
    'almeida.sum': "The institutional website of an environmental-sector group that brings together Almeida Ambiental, Almeida Equipamentos and Saturno Ambiental. It presents the group without fragmenting navigation or erasing each company's identity. It is in a staging environment for client validation.",
    'almeida.ia': 'Three companies as parts of one group', 'almeida.visual': 'Solidity and scale: photography of the operation and institutional typography',
    'almeida.build': 'Bilingual website, Portuguese and English', 'almeida.cta': 'View in staging',
    'method.kicker': 'How I think', 'method.title': 'Four leaves, one product.',
    'method.lede': 'The clover is not decoration: each leaf is a dimension that has to be present for a product to really work.',
    'method.ux': 'Clear interfaces, consistent flows and digital experiences driven by research, usability and product decisions.',
    'method.ui': 'Visual and behavioral consistency — componentization, interface patterns and documentation that scale with the team.',
    'method.aiT': 'AI', 'method.ai': 'I use AI to speed up triage, decisions and implementation, always with human handoff and clear usage judgment.',
    'method.empathyT': 'Empathy', 'method.empathy': 'User research and real operational experience: understanding the context and the work of the people who operate it before any interface.',
    'method.stepsLabel': 'Method',
    'method.s1t': 'Understand the problem', 'method.s1': 'I dive into the real context and operation before any interface.',
    'method.s2t': 'Map the flow', 'method.s2': 'Users, context, journey and the real work of who operates it.',
    'method.s3t': 'Design the states', 'method.s3': 'Architecture, hierarchy, states, microcopy and responsiveness.',
    'method.s4t': 'Validate and evolve', 'method.s4': 'I test in real use, document decisions and evolve the delivery.',
    'journey.kicker': 'Journey', 'journey.title': 'Product, operations and implementation.',
    'journey.p1': 'In Biology, I learned to observe systems, context and relationships. In UX/UI Design, I found the professional path where that curiosity became method: studying screens, talking to users, investigating hidden pain points and turning learnings into clearer, more functional digital solutions.',
    'journey.p2': 'I like learning, testing, evolving and seeing each delivery turn out better resolved than the last.',
    'journey.photoAlt': 'Lucas Cabral diving at Arvoredo Island, Santa Catarina', 'journey.tools': 'Tools',
    'xp.sartec': 'Operational experience, customer service and business processes', 'xp.sartecTag': 'Real operations',
    'xp.crm': 'Product Design, operational UX and Design Engineering', 'xp.crmTag': 'Internal system',
    'xp.agentName': 'Sartec WhatsApp Agent', 'xp.agent': 'Applied AI, triage and human handoff', 'xp.agentTag': 'Applied AI',
    'xp.uniedu': 'UX Research, Product Design and educational prototype',
    'xp.pesca': 'Product Design, Design Engineering and AI-assisted implementation', 'xp.pescaTag': 'Live',
    'contact.kicker': 'Contact', 'contact.status': 'Available for product and design opportunities',
    'contact.title': 'Looking for a Product Designer who blends UX, UI, AI and implementation?',
    'contact.desc': "I'm open to conversations with teams building digital products, internal tools and AI-driven experiences. Let's talk about product, design and functional interfaces.",
    'contact.cta': 'Send an email', 'contact.studioNote': 'I also run a separate commercial venture for digital projects:',
    'foot.top': 'Back to top ↑',
  };
  const PT = {};   // captured from the markup on first run
  const nodes = [...document.querySelectorAll('[data-i18n]')];
  nodes.forEach(el => { const a = el.getAttribute('data-i18n-attr'); PT[el.dataset.i18n] = a ? el.getAttribute(a) : el.textContent; });
  function applyLang(lang) {
    const dict = lang === 'en' ? EN : PT;
    document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
    nodes.forEach(el => {
      const v = dict[el.dataset.i18n] ?? PT[el.dataset.i18n];
      const a = el.getAttribute('data-i18n-attr');
      if (a) el.setAttribute(a, v); else el.textContent = v;
    });
    document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    try { localStorage.setItem('lang', lang); } catch (e) {}
  }
  let saved = null; try { saved = localStorage.getItem('lang'); } catch (e) {}
  if (saved === 'en') applyLang('en');
  document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => applyLang(b.dataset.lang)));

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
