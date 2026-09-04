/* ============================================================================
   wizard.js — presentation-only step wizard over the DIY steel-stair configurator
   ----------------------------------------------------------------------------
   Groups the configurator inputs into steps (Shape & size → The turn → Finish &
   treads → Your price & send) with Back/Next, while the live drawings + price card
   stay pinned in the rail the whole way through. It does NOT touch calc.js — it
   only shows/hides the .wz-step wrappers and reads calc.js's own .is-sel state to
   gate the Next button. Loaded AFTER calc.js so its listeners run after the
   engine has updated the DOM.
   ========================================================================== */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var TITLES = { shape: 'Shape & size', turn: 'The turn', finish: 'Finish & treads', send: 'Your price & send' };
  var current = 'shape';
  var booting = false;

  function shapeVal() { var e = $('.opt-shape.is-sel'); return e ? e.getAttribute('data-val') : ''; }
  function steps() {
    var s = shapeVal();
    return (s === 'l' || s === 'u') ? ['shape', 'turn', 'finish', 'send'] : ['shape', 'finish', 'send'];
  }
  function num(id) { var e = $(id); if (!e) return 0; var n = parseFloat(String(e.value).replace(/[^0-9.]/g, '')); return isFinite(n) ? n : 0; }

  /* whether the current step is answered enough to move on */
  function canLeave(step) {
    if (step === 'shape') return !!shapeVal() && num('#c-height') > 0;
    if (step === 'turn') return !!$('.opt-turn.is-sel');
    if (step === 'finish') {
      var fin = !!$('.opt-finish.is-sel'), tt = $('.opt-treads.is-sel');
      if (!fin || !tt) return false;
      if (tt.getAttribute('data-val') === 'timber') {
        var sp = !!$('#c-species-cards .is-sel') || !!($('#c-species') && $('#c-species').value);
        var tf = !!$('.opt-tf.is-sel');
        return sp && tf;   // timber needs a species AND a tread finish before moving on
      }
      return true;
    }
    return true;
  }

  function showStep(name) {
    var arr = steps();
    if (arr.indexOf(name) < 0) name = arr[0];
    current = name;
    $$('.wz-step').forEach(function (el) { el.style.display = el.getAttribute('data-wz') === name ? '' : 'none'; });
    var wiz = $('.calc--wizard'); if (wiz) wiz.setAttribute('data-wzstep', name);
    var i = arr.indexOf(name);
    var prog = $('#wz-progress');
    if (prog) prog.textContent = 'Step ' + (i + 1) + ' of ' + arr.length + ' · ' + TITLES[name];
    var back = $('#wz-back'), next = $('#wz-next');
    if (back) back.style.visibility = i === 0 ? 'hidden' : 'visible';
    if (next) {
      var last = name === 'send';
      next.style.display = last ? 'none' : '';
      next.disabled = !canLeave(name);
    }
    if (!booting) {
      var anchor = $('#wz-progress') || $('#calculator');
      if (anchor) window.scrollTo({ top: Math.max(0, anchor.getBoundingClientRect().top + window.scrollY - 90), behavior: 'auto' });
    }
  }

  function go(delta) {
    var arr = steps(), i = arr.indexOf(current);
    if (delta > 0 && !canLeave(current)) return;
    showStep(arr[Math.max(0, Math.min(arr.length - 1, i + delta))]);
  }

  /* refresh gating + keep the current step valid when the shape (and so the step
     list) changes; never auto-advances the user */
  function sync() {
    var arr = steps();
    if (arr.indexOf(current) < 0) { showStep(arr[0]); return; }
    // re-render progress ("of N") + gating without moving the step or scrolling
    booting = true; showStep(current); booting = false;
  }

  function boot() {
    var back = $('#wz-back'), next = $('#wz-next');
    if (back) back.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });

    // the price card CTA jumps straight to the send step
    var cta = $('.pricecard__cta');
    if (cta) cta.addEventListener('click', function (e) { e.preventDefault(); showStep('send'); });

    // the price card's "still to choose" links can point at a field on another step —
    // switch to that step first (capture phase), so calc.js's own scroll-to-field then lands
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-need]');
      if (!a) return;
      var el = document.querySelector(a.getAttribute('data-need') || '');
      var st = el && el.closest ? el.closest('.wz-step') : null;
      if (st) {
        var nm = st.getAttribute('data-wz');
        if (nm && nm !== current) { booting = true; showStep(nm); booting = false; }
      }
    }, true);

    // re-sync after calc.js has handled the same event (it registered first)
    document.addEventListener('click', function () { setTimeout(sync, 0); });
    document.addEventListener('input', function () { setTimeout(sync, 0); });
    document.addEventListener('change', function () { setTimeout(sync, 0); });

    booting = true; showStep('shape'); booting = false;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
