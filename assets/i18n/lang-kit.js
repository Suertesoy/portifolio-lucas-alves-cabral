/* LangKit — the language layer shared by the Home and the internal cases (checkpoint 17).
   Portuguese is the markup itself (source of truth and the no-JS fallback). English and Spanish (es-ES) are dictionaries
   registered on window.I18N.{en,es} by the i18n*.js files; init() snapshots the Portuguese from the DOM and swaps on demand.

   Which language opens (first match wins):
     1. ?lang=pt|en|es in the URL   — an explicit link; it is also remembered
     2. the visitor's saved choice  — localStorage, falling back to sessionStorage (in-app browsers often block the first)
     3. the browser's language list — pt / es / en; any other language gets English
     4. Portuguese                  — when the browser reports nothing
   Internal links are rewritten with ?lang=… so the choice also survives where storage is blocked.

   This script runs in <head>, before first paint: it sets <html lang> and, for a non-Portuguese visitor, keeps the body
   hidden for the instant it takes to swap the strings (so Portuguese never flashes). A timer releases it regardless. */
(function (w, d) {
  'use strict';
  var LANGS = ['pt', 'en', 'es'];
  var HTML_LANG = { pt: 'pt-BR', en: 'en', es: 'es-ES' };
  var OG_LOCALE = { pt: 'pt_BR', en: 'en_US', es: 'es_ES' };
  var root = d.documentElement;

  function norm(v) {
    if (!v) return null;
    v = String(v).toLowerCase().slice(0, 2);
    return LANGS.indexOf(v) > -1 ? v : null;
  }
  function fromUrl() {
    try { return norm(new URLSearchParams(w.location.search).get('lang')); } catch (e) { return null; }
  }
  function fromStore() {
    var v = null;
    try { v = norm(w.localStorage.getItem('lang')); } catch (e) {}
    if (!v) { try { v = norm(w.sessionStorage.getItem('lang')); } catch (e) {} }
    return v;
  }
  function fromBrowser() {
    var list = (w.navigator && (w.navigator.languages || [w.navigator.language])) || [];
    for (var i = 0; i < list.length; i++) { var n = norm(list[i]); if (n) return n; }
    return list.length && list[0] ? 'en' : null;
  }
  function persist(lang) {
    try { w.localStorage.setItem('lang', lang); } catch (e) {}
    try { w.sessionStorage.setItem('lang', lang); } catch (e) {}
  }

  var urlLang = fromUrl();
  var current = urlLang || fromStore() || fromBrowser() || 'pt';
  if (urlLang) persist(urlLang);
  root.lang = HTML_LANG[current];

  // Keep the body hidden only while a non-Portuguese visitor waits for the swap.
  var releaseTimer = 0;
  function release() {
    if (releaseTimer) { w.clearTimeout(releaseTimer); releaseTimer = 0; }
    root.classList.remove('lang-pending');
  }
  if (current !== 'pt') {
    var st = d.createElement('style');
    st.textContent = 'html.lang-pending body{visibility:hidden}';
    d.head.appendChild(st);
    root.classList.add('lang-pending');
    releaseTimer = w.setTimeout(release, 2500);
  }

  /* ---------- links: carry the language to the other internal pages ---------- */
  function withLang(href, lang) {
    var h = href.indexOf('#'), hash = h > -1 ? href.slice(h) : '', rest = h > -1 ? href.slice(0, h) : href;
    var q = rest.indexOf('?'), base = q > -1 ? rest.slice(0, q) : rest;
    var query = (q > -1 ? rest.slice(q + 1) : '').split('&').filter(function (p) { return p && p.split('=')[0] !== 'lang'; });
    query.push('lang=' + lang);
    return base + '?' + query.join('&') + hash;
  }
  function decorateLinks(lang) {
    Array.prototype.forEach.call(d.querySelectorAll('a[href]'), function (a) {
      var href = a.getAttribute('href');
      if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href) || a.hasAttribute('data-no-lang')) return;
      if (a.origin !== w.location.origin) return;
      if (/\.(mp4|webm|webp|png|jpe?g|svg|pdf)(\?|#|$)/i.test(a.pathname)) return;
      a.setAttribute('href', withLang(href, lang));
    });
  }
  function syncUrl(lang) {
    try {
      var u = new URL(w.location.href);
      u.searchParams.set('lang', lang);
      w.history.replaceState(w.history.state, '', u.pathname + u.search + u.hash);
    } catch (e) {}
  }

  /* ---------- metadata: title, description, Open Graph / Twitter ---------- */
  function setMeta(sel, attr, value) {
    var el = d.querySelector(sel);
    if (el && value) el.setAttribute(attr, value);
  }

  var kit = {
    langs: LANGS,
    get: function () { return current; },
    missing: null
  };

  kit.init = function (opts) {
    opts = opts || {};
    var dicts = w.I18N || {};
    var nodes = Array.prototype.slice.call(d.querySelectorAll('[data-i18n], [data-i18n-html]'));
    var PT = {};
    var metaDesc = d.querySelector('meta[name="description"]');
    var ptTitle = d.title, ptDesc = metaDesc ? metaDesc.getAttribute('content') : '';

    function slotOf(el) {
      var key = el.getAttribute('data-i18n') || el.getAttribute('data-i18n-html');
      var attr = el.getAttribute('data-i18n-attr');
      return { key: key, attr: attr, html: el.hasAttribute('data-i18n-html'), slot: key + (attr ? '@' + attr : '') };
    }
    nodes.forEach(function (el) {
      var s = slotOf(el);
      // The same key may sit on several elements; the first snapshot wins.
      if (!(s.slot in PT)) PT[s.slot] = s.attr ? el.getAttribute(s.attr) : (s.html ? el.innerHTML : el.textContent);
    });

    kit.missing = function (lang) {
      var dict = dicts[lang] || {}, out = [];
      nodes.forEach(function (el) { var k = slotOf(el).key; if (!(k in dict) && out.indexOf(k) < 0) out.push(k); });
      ['doc.title', 'doc.desc'].forEach(function (k) { if (!(k in dict)) out.push(k); });
      return out;
    };

    function apply(lang) {
      var dict = lang === 'pt' ? null : dicts[lang];
      // If a dictionary failed to load, the page stays Portuguese and says so (never a Spanish <html lang> over Portuguese text).
      if (lang !== 'pt' && !dict) lang = 'pt';
      current = lang;
      root.lang = HTML_LANG[lang];
      nodes.forEach(function (el) {
        var s = slotOf(el);
        var v = dict && s.key in dict ? dict[s.key] : PT[s.slot];
        if (v === undefined) return;
        if (s.attr) el.setAttribute(s.attr, v);
        else if (s.html) el.innerHTML = v;
        else el.textContent = v;
      });
      var title = (dict && dict['doc.title']) || ptTitle, desc = (dict && dict['doc.desc']) || ptDesc;
      d.title = title;
      setMeta('meta[name="description"]', 'content', desc);
      setMeta('meta[property="og:title"]', 'content', title);
      setMeta('meta[property="og:description"]', 'content', desc);
      setMeta('meta[property="og:locale"]', 'content', OG_LOCALE[lang]);
      setMeta('meta[name="twitter:title"]', 'content', title);
      setMeta('meta[name="twitter:description"]', 'content', desc);
      Array.prototype.forEach.call(d.querySelectorAll('[data-lang]'), function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang));
      });
      decorateLinks(lang);
      if (opts.onApply) opts.onApply(lang);
      w.requestAnimationFrame ? w.requestAnimationFrame(release) : release();
    }
    kit.set = function (lang) {
      lang = norm(lang);
      if (!lang) return;
      persist(lang);
      syncUrl(lang);
      apply(lang);
    };

    Array.prototype.forEach.call(d.querySelectorAll('[data-lang]'), function (b) {
      b.addEventListener('click', function () { kit.set(b.getAttribute('data-lang')); });
    });
    apply(current);

    var host = w.location.hostname;
    if (current !== 'pt' && (host === 'localhost' || host === '127.0.0.1' || /[?&]i18ndebug/.test(w.location.search))) {
      var miss = kit.missing(current);
      if (miss.length) w.console.warn('[LangKit] ' + current + ': ' + miss.length + ' missing key(s):', miss.join(', '));
    }
  };

  w.LangKit = kit;
})(window, document);
