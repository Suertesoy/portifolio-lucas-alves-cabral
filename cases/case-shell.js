/* CASE SHELL — shared behaviour of the internal cases (checkpoint 14): the Before/After switcher.
   Markup: [data-cmp] > .cmp-tabs [role=tab aria-controls] + .cmp-stage > [role=tabpanel].
   Without JS both panels stay visible (nothing is hidden in the markup). Tabs follow the ARIA pattern:
   click / Enter / Space select, ← → Home End move between tabs. */
(function () {
  'use strict';
  Array.prototype.forEach.call(document.querySelectorAll('[data-cmp]'), function (root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    function select(i, focus) {
      tabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (panels[k]) panels[k].hidden = !on;
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i, false); });
      t.addEventListener('keydown', function (e) {
        var k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (k === undefined) return;
        e.preventDefault(); select((k + tabs.length) % tabs.length, true);
      });
    });
    var start = tabs.findIndex(function (t) { return t.getAttribute('aria-selected') === 'true'; });
    select(start < 0 ? 0 : start, false);
  });
})();
