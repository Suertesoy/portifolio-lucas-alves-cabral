/* UNIEDU case — the ranking switch (Ciclo 4C.2). Loaded after ../pesca/case.js (lightbox, reveal) and ../case-shell.js (tabs).
   Markup: [data-rk] > button.rk-switch[role=switch][hidden] + .rk-shots > .rk-on + .rk-off.
   Without JS both real captures stay side by side and the switch stays hidden. With JS one device shows the capture that
   matches the switch, like the app's own toggle (ranking.tsx). Nothing is stored: this is a demonstration, not the app. */
(function () {
  'use strict';
  Array.prototype.forEach.call(document.querySelectorAll('[data-rk]'), function (root) {
    var sw = root.querySelector('.rk-switch');
    if (!sw) return;
    root.classList.add('rk-js');
    sw.hidden = false;
    function set(on) {
      sw.setAttribute('aria-checked', String(on));
      root.classList.toggle('is-off', !on);
    }
    sw.addEventListener('click', function () { set(sw.getAttribute('aria-checked') !== 'true'); });
    set(true);
  });
})();
