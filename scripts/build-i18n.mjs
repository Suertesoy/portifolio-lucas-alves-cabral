/* Static localization build (checkpoint 18) — zero dependencies.

   The Portuguese pages (index.html and the cases/<name>/index.html files) are the source of truth and are served as they are, at
   /  and  /cases/<case>/.  This script renders the same markup in English and Spanish into
   /en/…  and  /es/…  so that every URL answers with its own language in the HTML itself: <html lang>, text, <title>,
   description, canonical, hreflang, Open Graph and Twitter metadata. No JavaScript is needed to read them.

   The strings are the CK17 dictionaries (the i18n files under assets/home and cases): the elements carrying data-i18n,
   data-i18n-html and data-i18n-attr are rewritten exactly as the browser layer used to do at runtime.

   Relative URLs of a source page are rewritten to root-absolute ones in the localized copies, because those live one or
   two levels deeper; links between pages are mapped to the same language (/en/cases/pesca/ stays inside /en/).

   Usage:  node scripts/build-i18n.mjs            build (also fails if the Portuguese <head> block is out of date)
           node scripts/build-i18n.mjs --sync-pt  rewrite the generated <head> block of the Portuguese sources
           SITE_URL=https://example.com node scripts/build-i18n.mjs   (default below)                              */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = (process.env.SITE_URL || 'https://portifolio-lucas-alves-cabral.vercel.app').replace(/\/+$/, '');
const SYNC_PT = process.argv.includes('--sync-pt');

const LANGS = {
  pt: { html: 'pt-BR', hreflang: 'pt-BR', og: 'pt_BR', prefix: '' },
  en: { html: 'en', hreflang: 'en', og: 'en_US', prefix: '/en' },
  es: { html: 'es-ES', hreflang: 'es-ES', og: 'es_ES', prefix: '/es' },
};
const X_DEFAULT = 'en';   // visitors whose language is not offered land on the English version

// 1200×630 cover, one image for every language and page. Source: scripts/social-cover/cover.html (npm run cover).
const SOCIAL_IMAGE = { path: '/assets/social/cover-1200x630.jpg', width: 1200, height: 630, type: 'image/jpeg' };
const IMAGE_ALT = {
  pt: 'Lucas Cabral, Product Designer & Design Engineer, ao lado de um trevo de quatro folhas translúcido em 3D',
  en: 'Lucas Cabral, Product Designer & Design Engineer, next to a translucent 3D four-leaf clover',
  es: 'Lucas Cabral, Product Designer & Design Engineer, junto a un trébol de cuatro hojas translúcido en 3D',
};

const PAGES = [
  { id: 'home', src: 'index.html', url: '/', ogType: 'website', dicts: ['assets/home/i18n.en.js', 'assets/home/i18n.es.js'],
    pt: { title: 'Lucas Cabral — Product Designer & Design Engineer',
          desc: 'Product Designer & Design Engineer. Pesquisa, UX/UI e implementação assistida por IA, mostradas em produtos em uso: Pesca Delivery e um CRM com agente de IA.' } },
  { id: 'pesca', src: 'cases/pesca/index.html', url: '/cases/pesca/', ogType: 'article', dicts: ['cases/pesca/i18n.js', 'cases/pesca/i18n.es.js'],
    pt: { title: 'Pesca Delivery — Além da loja · Lucas Cabral',
          desc: 'Case de Product Design e Design Engineering: da personalização de um Poke pelo WhatsApp a uma experiência digital que conecta compra e operação.' } },
  { id: 'sartec', src: 'cases/sartec/index.html', url: '/cases/sartec/', ogType: 'article', dicts: ['cases/sartec/i18n.js', 'cases/sartec/i18n.es.js'],
    pt: { title: 'Sartec — CRM operacional e Agente de IA · Lucas Cabral',
          desc: 'Case de Product Design: um CRM integrado ao WhatsApp, com um agente de IA que organiza a entrada e encaminha o atendimento a uma pessoa da equipe, numa papelaria real.' } },
  { id: 'uniedu', src: 'cases/uniedu/index.html', url: '/cases/uniedu/', ogType: 'article', dicts: ['cases/uniedu/i18n.js', 'cases/uniedu/i18n.es.js'],
    pt: { title: 'UNIEDU — Pesquisa, usabilidade e Design System · Lucas Cabral',
          desc: 'Case de UX Research e Product Design: entrevistas, testes de usabilidade e um Design System no Figma conectado ao protótipo em código de um app de estudos gamificado.' } },
];

const HEAD_START = '<!-- i18n:head:start -->';
const HEAD_END = '<!-- i18n:head:end -->';

/* ------------------------------------------------------------------ helpers */
const esc = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const escText = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pageUrl = (page, lang) => LANGS[lang].prefix + page.url;
const absUrl = (page, lang) => SITE + pageUrl(page, lang);
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
function loadDicts(files) {
  const win = { I18N: {} }; const ctx = vm.createContext({ window: win });
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return win.I18N;
}
const fail = [];

/* The generated <head> block: title, description, canonical, hreflang, Open Graph, Twitter. */
function headBlock(page, lang, meta) {
  const url = absUrl(page, lang), img = SITE + SOCIAL_IMAGE.path;
  const L = [
    `<title>${escText(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.desc)}" />`,
    `<link rel="canonical" href="${url}" />`,
    ...Object.keys(LANGS).map(l => `<link rel="alternate" hreflang="${LANGS[l].hreflang}" href="${absUrl(page, l)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${absUrl(page, X_DEFAULT)}" />`,
    `<meta property="og:type" content="${page.ogType}" />`,
    `<meta property="og:site_name" content="Lucas Cabral" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.desc)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:locale" content="${LANGS[lang].og}" />`,
    ...Object.keys(LANGS).filter(l => l !== lang).map(l => `<meta property="og:locale:alternate" content="${LANGS[l].og}" />`),
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:image:type" content="${SOCIAL_IMAGE.type}" />`,
    `<meta property="og:image:width" content="${SOCIAL_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${SOCIAL_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${esc(IMAGE_ALT[lang])}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.desc)}" />`,
    `<meta name="twitter:image" content="${img}" />`,
    `<meta name="twitter:image:alt" content="${esc(IMAGE_ALT[lang])}" />`,
  ];
  return [HEAD_START, '<!-- generated by scripts/build-i18n.mjs: edit the script, not this block -->', ...L, HEAD_END].join('\n');
}
function replaceHead(html, block, label) {
  const a = html.indexOf(HEAD_START), b = html.indexOf(HEAD_END);
  if (a < 0 || b < 0) throw new Error(`${label}: missing the i18n:head markers`);
  return html.slice(0, a) + block + html.slice(b + HEAD_END.length);
}

/* Rewrites the elements that carry data-i18n / data-i18n-html / data-i18n-attr with the dictionary values. */
function translate(html, dict, label) {
  const re = /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?\bdata-i18n(-html)?="([^"]+)"[^>]*)>/g;
  let out = '', last = 0, m, n = 0;
  while ((m = re.exec(html))) {
    const [open, tag, attrs, isHtml, key] = m;
    if (!(key in dict)) { fail.push(`${label}: missing key "${key}"`); continue; }
    const val = dict[key]; n++;
    const attrM = attrs.match(/\bdata-i18n-attr="([^"]+)"/);
    if (attrM) {
      const arx = new RegExp(`(\\s${attrM[1]}=")[^"]*(")`);
      if (!arx.test(open)) { fail.push(`${label}: attribute ${attrM[1]} not found for "${key}"`); continue; }
      out += html.slice(last, m.index) + open.replace(arx, (_, p, q) => p + esc(val) + q);
      last = m.index + open.length; continue;
    }
    const start = m.index + open.length;
    const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'g'); tagRe.lastIndex = start;
    let depth = 1, t, end = -1;
    while ((t = tagRe.exec(html))) { if (t[2] === '/') continue; depth += t[1] ? -1 : 1; if (depth === 0) { end = t.index; break; } }
    if (end < 0) { fail.push(`${label}: no closing </${tag}> for "${key}"`); continue; }
    out += html.slice(last, start) + (isHtml ? val : escText(val));
    last = end; re.lastIndex = end;
  }
  return { html: out + html.slice(last), n };
}

/* Relative URLs → root-absolute; links to the three pages → the same language. */
function rewriteUrls(html, page, lang) {
  const srcDir = '/' + path.posix.dirname(page.src).replace(/^\.$/, '') + (path.posix.dirname(page.src) === '.' ? '' : '/');
  return html.replace(/(\s(?:href|src|data-src|poster)=")([^"]*)(")/g, (all, pre, ref, post) => {
    if (!ref || /^(\/|#|[a-z][a-z0-9+.-]*:)/i.test(ref)) return all;
    const u = new URL(ref, 'http://x' + srcDir);
    let p = u.pathname;
    const asDir = p.replace(/index\.html$/, '');
    const target = PAGES.find(pg => pg.url === asDir);
    if (target) p = pageUrl(target, lang);
    return pre + p + u.search + u.hash + post;
  });
}

/* Marks the current language in the PT / EN / ES switcher (plain links: they work without JavaScript). */
function markSwitcher(html, lang) {
  return html.replace(/<a\b[^>]*\bdata-lang="([a-z]{2})"[^>]*>/g, (tag, l) => {
    tag = tag.replace(/\s+aria-current="[^"]*"/, '');
    return l === lang ? tag.replace(/>$/, ' aria-current="true">') : tag;
  });
}

/* ------------------------------------------------------------------ build */
const written = [];
const write = (rel, content) => { const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); written.push(rel); };

for (const page of PAGES) {
  const src = read(page.src);
  const dicts = loadDicts(page.dicts);

  // Portuguese: the source is served as it is; its generated block must match this script.
  const ptBlock = headBlock(page, 'pt', page.pt);
  if (SYNC_PT) { const next = replaceHead(src, ptBlock, page.src); if (next !== src) { fs.writeFileSync(path.join(ROOT, page.src), next); console.log('synced', page.src); } }
  else if (replaceHead(src, ptBlock, page.src) !== src) fail.push(`${page.src}: generated <head> block is out of date — run: node scripts/build-i18n.mjs --sync-pt`);
  if (SYNC_PT) continue;

  for (const lang of ['en', 'es']) {
    const label = `${page.id}/${lang}`, dict = dicts[lang];
    if (!dict) { fail.push(`${label}: dictionary not found`); continue; }
    let { html, n } = translate(src, dict, label);
    html = replaceHead(html, headBlock(page, lang, { title: dict['doc.title'], desc: dict['doc.desc'] }), label);
    html = html.replace(/<html lang="[^"]*"/, `<html lang="${LANGS[lang].html}"`);
    html = markSwitcher(html, lang);
    html = rewriteUrls(html, page, lang);
    write(path.posix.join(LANGS[lang].prefix.slice(1), page.url, 'index.html'), html);
    console.log(`${label}: ${n} strings → ${LANGS[lang].prefix}${page.url}`);
  }
}
if (SYNC_PT) process.exit(0);
if (fail.length) { console.error('\nBUILD FAILED:\n  ' + fail.join('\n  ')); process.exit(1); }

/* robots.txt + sitemap.xml (with the language alternates) */
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
const urls = PAGES.flatMap(page => Object.keys(LANGS).map(lang => {
  const alts = [...Object.keys(LANGS).map(l => `    <xhtml:link rel="alternate" hreflang="${LANGS[l].hreflang}" href="${absUrl(page, l)}" />`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${absUrl(page, X_DEFAULT)}" />`].join('\n');
  return `  <url>\n    <loc>${absUrl(page, lang)}</loc>\n${alts}\n  </url>`;
}));
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
console.log(`done: ${written.length} files (${SITE})`);
