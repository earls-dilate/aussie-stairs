(function () {
  var dlg = document.getElementById('measure-dlg');
  document.getElementById('open-measure').addEventListener('click', function () { dlg.showModal(); });
  var hd = document.getElementById('height-dlg');
  var hb = document.getElementById('open-height');
  if (hd && hb) {
    hb.addEventListener('click', function () { hd.showModal(); });
    document.getElementById('close-height').addEventListener('click', function () { hd.close(); });
    hd.addEventListener('click', function (e) { if (e.target === hd) hd.close(); });
  }
  var SPACE_PHOTO = {
    depth: { straight: 'https://cdn.prod.website-files.com/67becbfecbf559dfc99e4932/6a9e31edca22e050708d3dbe_space-measure-straight.jpg', u: 'https://cdn.prod.website-files.com/67becbfecbf559dfc99e4932/6a9e31ed06537b1ec268539d_space-measure-u.jpg', l: 'https://cdn.prod.website-files.com/67becbfecbf559dfc99e4932/6a9e31ecd5457a941f4229ed_space-measure.jpg' },
    width: { straight: 'https://cdn.prod.website-files.com/67becbfecbf559dfc99e4932/6a9e31ecd5457a941f4229ed_space-measure.jpg', u: 'https://cdn.prod.website-files.com/67becbfecbf559dfc99e4932/6a9e31edda2e8ae853da4e15_space-width-u.jpg', l: 'https://cdn.prod.website-files.com/67becbfecbf559dfc99e4932/6a9e31ecd5457a941f4229ed_space-measure.jpg' }
  };
  var PORTRAIT = { 'https://cdn.prod.website-files.com/67becbfecbf559dfc99e4932/6a9e31edca22e050708d3dbe_space-measure-straight.jpg': 1, 'https://cdn.prod.website-files.com/67becbfecbf559dfc99e4932/6a9e31ed06537b1ec268539d_space-measure-u.jpg': 1, 'https://cdn.prod.website-files.com/67becbfecbf559dfc99e4932/6a9e31edda2e8ae853da4e15_space-width-u.jpg': 1 };
  Array.prototype.forEach.call(document.querySelectorAll('.open-space'), function (b) {
    b.addEventListener('click', function () {
      var sel = document.querySelector('.opt-shape.is-sel');
      var shape = (sel && sel.dataset.val) || 'l';
      var src = (SPACE_PHOTO[b.dataset.kind || 'depth'] || {})[shape] || 'https://cdn.prod.website-files.com/67becbfecbf559dfc99e4932/6a9e31ecd5457a941f4229ed_space-measure.jpg';
      var img = document.getElementById('space-photo');
      if (img && img.getAttribute('src') !== src) img.setAttribute('src', src);
      dlg.classList.toggle('mdlg--tall', !!PORTRAIT[src]);
      dlg.showModal();
    });
  });
  ['open-measure-2'].forEach(function (id) {
    var link = document.getElementById(id);
    if (link) link.addEventListener('click', function (e) { e.preventDefault(); dlg.showModal(); });
  });
  document.getElementById('close-measure').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
})();

<!-- Floating shortcut to the calculator. Drop this block (button + style + script)
     into any other page on the site and point the href at this page's #calculator. -->
<a class="fabcalc" id="fabcalc" href="#calculator">Price your staircase</a>

(function () {
  var fab = document.getElementById('fabcalc');
  if (!fab) return;
  /* Shown from the moment the customer scrolls off the hero, and kept there \u2014 the only
     place it steps out of the way is over the send form, where the page has its own
     button. */
  var form = document.getElementById('sendwrap'), calc = document.getElementById('calculator');
  var band = document.querySelector('section.band');
  function covers(el, frac) {
    if (!el) return false;
    var r = el.getBoundingClientRect(), h = window.innerHeight;
    var vis = Math.min(r.bottom, h) - Math.max(r.top, 0);
    return vis > h * frac;
  }
  function upd() {
    /* Only out of the way when the customer is actually working in the calculator or
       filling in the form — everywhere else on the page it stays put. */
    var on = window.scrollY > 320 && !covers(calc, 0.3) && !covers(form, 0.15) && !covers(band, 0.1);
    fab.classList.toggle('is-on', on);
  }
  upd();
  window.addEventListener('scroll', upd, { passive: true });
  window.addEventListener('resize', upd);
})();
