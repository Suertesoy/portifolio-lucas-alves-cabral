/* LangKit (checkpoint 18) — what is left of the language layer in the browser.

   Since CK18 the language of a page is decided by its URL and is already in the HTML the server sends:
     /  /cases/…  → Portuguese      /en/…  → English      /es/…  → Spanish (es-ES)
   (scripts/build-i18n.mjs renders the localized pages; the dictionaries are build inputs, not runtime code.)
   Nothing here reads localStorage or the browser's language: an /en/ link always shows English.

   Two small jobs remain:
     1. Old links. Before CK18 a language was chosen with ?lang=en / ?lang=es on the Portuguese URLs. Vercel redirects
        those on the server (vercel.json); this is the same rule for any host that does not (and for local previews).
     2. The PT / EN / ES switcher is made of plain links (they work without JavaScript). On click we only add the
        current #fragment so the visitor keeps their place in the page. */
(function (w, d) {
  'use strict';
  var pageLang = ((d.documentElement.lang || 'pt').slice(0, 2)).toLowerCase();

  try {
    var q = new URLSearchParams(w.location.search), legacy = q.get('lang');
    if (pageLang === 'pt' && (legacy === 'en' || legacy === 'es')) {
      q.delete('lang');
      var path = w.location.pathname.replace(/index\.html$/, '');
      if (!/\/$/.test(path)) path += '/';
      var rest = q.toString();
      w.location.replace('/' + legacy + path + (rest ? '?' + rest : '') + w.location.hash);
    }
  } catch (e) { /* no URL API: the visitor simply stays on the Portuguese page and can use the switcher */ }

  w.LangKit = {
    lang: pageLang,
    init: function () {
      Array.prototype.forEach.call(d.querySelectorAll('a[data-lang]'), function (a) {
        a.addEventListener('click', function () {
          if (w.location.hash) a.setAttribute('href', a.getAttribute('href').split('#')[0] + w.location.hash);
        });
      });
    }
  };
})(window, document);
