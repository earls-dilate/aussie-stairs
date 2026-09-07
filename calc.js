/* DIY steel staircase kit — landing page calculator.
   Reads window.SP, which prices.js derives live from the pricing back end, so any change
   made on the internal Pricing screen shows here. Sell prices only — no cost or margin.
   L-shape and U-shape geometry, fitting and drawings are ported from the internal
   Staircase Calculator (assets/js1.js) so both price the same way. */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  var SP = window.SP;

  var GOING = 250, RISER_MIN = 115, RISER_MAX = 189.08, MAX_RISERS = 18;
  var LAND_MIN = 800, LAND_MAX = 2400, GOING_MIN = GOING;
  /* Left to itself the calculator never draws a landing longer than this — past it the
     depth is better spent on another step. */
  var LAND_AUTO_MAX = 1200;
  /* Hard ceiling on the corner landing, auto or typed: past this the depth is better spent
     on another step, so the steps-before-the-turn control stops rather than the landing
     growing further. */
  var LAND_FILL_MAX = 1300;
  /* The narrowest the bottom flight is taken on auto to let the corner pack tighter. */
  var BOT_MIN = 1000;
  /* Hard floor when the flight is following a shallower corner landing down. */
  var BOT_FLOOR = 800;
  var TREAD_MAX_W = (SP && SP.treadMaxW) || 1200;

  var state = {
    height: null, width: null, avail: null, avail2: null, width2: null, gap: 0,
    shape: 'straight', turnMethod: 'landing', uLanding: 'full', uLower: 'landing', uUpper: 'landing', turnSide: 'left',
    winders: 2, landings: 1, landingSize: 1000, landingTouched: false, split: null,
    finish: 'primed', colour: 'black', treads: 'none', species: null, treadFinish: 'raw',
    delivery: false, risers: 15, risersManual: null
  };
  /* Nothing is pre-selected: every choice the customer has actually made is recorded
     here, and the price stays hidden until the mandatory ones are all in. */
  var ans = {};

  /* Mandatory answers, in the order they appear on the page. The price and the send
     form stay locked until every one of them is in. */
  var NEED_SEL = ['#fg-shape', '#fg-height', '#fg-width', '#fg-avail', '#fg-avail2', '#fg-turnmethod',
    '#fg-uland', '#fg-uturns', '#fg-dir', '#fg-finish', '#fg-colour', '#fg-treadtype', '#c-tread-detail'];
  function missingAnswers() {
    var m = [];
    function need(label, sel) { m.push(label); m.sel = m.sel || []; if (sel) m.sel.push(sel); }
    if (!ans.shape) need('stair shape', '#fg-shape');
    if (!state.height) need('floor to floor height', '#fg-height');
    if (!state.width) need('stair width', '#fg-width');
    if (ans.shape && state.shape !== 'straight') {
      /* The turn cannot be set out without the space it has to fit, so both are
         mandatory once the staircase turns. */
      if (!state.avail) need('available depth', '#fg-avail');
      if (!state.avail2) need('available width', '#fg-avail2');
      /* On a U the turn is always a landing, and the field is hidden, so there is nothing
         for the customer to answer there. */
      if (state.shape === 'l' && !ans.turn) need('how it turns', '#fg-turnmethod');
    }
    if (!ans.finish) need('frame finish', '#fg-finish');
    if (ans.finish && state.finish === 'painted' && !ans.colour) need('paint colour', '#fg-colour');
    if (!ans.treads) need('treads', '#fg-treadtype');
    if (ans.treads && state.treads === 'timber') {
      if (!ans.species) need('timber species', '#c-tread-detail');
      if (!ans.tf) need('tread finish', '#c-tread-detail');
    }
    return m;
  }
  /* Ring only what is both outstanding and on screen for the current shape. */
  function paintNeeds(miss) {
    var want = (miss && miss.sel) || [];
    NEED_SEL.forEach(function (sel) {
      var el = $(sel);
      if (el) el.classList.toggle('needs', want.indexOf(sel) >= 0);
    });
  }
  /* The send form mirrors the same outstanding list, and adds the contact fields, so a
     customer sitting at the bottom of the page can see exactly what is holding them up. */
  var CONTACT = [['name', 'your name'], ['email', 'email'], ['phone', 'phone'], ['postcode', 'delivery postcode']];
  var lastMiss = [];
  function contactMissing() {
    var f = $('#send-form'), out = [];
    if (!f) return out;
    CONTACT.forEach(function (c) {
      var el = f.querySelector('[name=' + c[0] + ']');
      if (!el) return;
      var empty = !String(el.value || '').trim();
      el.classList.toggle('is-empty', empty);
      if (empty) out.push(c[1]);
    });
    return out;
  }
  function renderSend() {
    var sel = lastMiss || [], con = contactMissing();
    var box = $('#f-need'), list = $('#f-need-list'), head = $('#f-need-h'), sub = $('#f-need-sub');
    var form = $('#send-form'), btn = form && form.querySelector('button[type=submit]');
    if (form) form.classList.toggle('is-locked', sel.length > 0);
    var items = sel.map(function (l, i) {
      var s = (sel.sel || [])[i];
      return '<li>' + (s ? '<a class="needlink" href="#" data-need="' + s + '">' + l + '</a>' : l) + ' <em>— in the calculator above</em></li>';
    }).concat(con.map(function (l) { return '<li>' + l + ' <em>— in the form below</em></li>'; }));
    if (box) {
      box.classList.toggle('is-done', items.length === 0);
      if (head) head.textContent = items.length
        ? (items.length === 1 ? '1 thing still to fill in' : items.length + ' things still to fill in')
        : 'Everything is in — ready to send';
      if (sub) sub.textContent = sel.length
        ? 'Tap any item below to jump straight to it. The form unlocks once your selections are done.'
        : (con.length ? 'Just your contact details left.' : 'Check it over and send it through.');
      if (list) { list.innerHTML = items.join(''); list.style.display = items.length ? '' : 'none'; }
    }
    if (btn) {
      btn.disabled = (sel.length + con.length) > 0;
      btn.textContent = sel.length ? 'Finish your selections above'
        : (con.length ? 'Add your details to send' : 'Send my measurements');
    }
    /* The floating button doubles as the page-wide reminder. */
    var fab = $('#fabcalc');
    if (fab) {
      /* Only nags once the customer has actually started answering — a first-time visitor
         still gets the plain "Price your staircase" call to action. */
      var started = Object.keys(ans).length > 0 || !!state.height || !!state.width;
      var n = started ? sel.length + con.length : 0;
      fab.classList.toggle('is-need', n > 0);
      fab.textContent = n ? (n === 1 ? '1 thing still to fill' : n + ' things still to fill') : 'Price your staircase';
      if (n && sel.length && (sel.sel || [])[0]) fab.setAttribute('data-need', sel.sel[0]);
      else fab.removeAttribute('data-need');
      fab.setAttribute('href', n && !sel.length ? '#sendwrap' : '#calculator');
    }
  }
  function lockPrice(miss) {
    paintNeeds(miss);
    lastMiss = miss;
    $('#c-price').textContent = '—';
    $('#c-price-sub').innerHTML = 'Still to choose: ' + miss.map(function (l, i) {
      var sel = (miss.sel || [])[i];
      return sel ? '<a class="needlink" href="#" data-need="' + sel + '">' + l + '</a>' : l;
    }).join(', ');
    $('#c-line-frame').textContent = '—';
    $('#c-line-treads').textContent = '—';
    var pr = $('#c-line-polish-row'); if (pr) pr.style.display = 'none';
    var cta = $('.pricecard__cta'); if (cta) cta.style.display = 'none';
    renderSend();
    $('#f-summary').value = '';
  }
  function unlockPrice() {
    paintNeeds(null);
    lastMiss = [];
    var cta = $('.pricecard__cta'); if (cta) cta.style.display = '';
    renderSend();
  }
  document.addEventListener('input', function (e) {
    if (e.target.closest && e.target.closest('#send-form')) renderSend();
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-need]');
    if (!a) return;
    e.preventDefault();
    var el = $(a.getAttribute('data-need'));
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.scrollY - 140;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
    setTimeout(function () { el.classList.remove('is-flash'); }, 1400);
  });

  function money(n) { return '$' + Math.round(n).toLocaleString('en-AU'); }
  function idx(steps) { return Math.max(1, Math.min(SP.maxSteps, Math.round(steps))) - 1; }

  /* ---------- public pricing shim (same API the internal engine calls) ---------- */
  var P = {
    landingSizes: function () { return (SP.landings && SP.landings.sizes) || []; },
    landingSize: function (id) {
      var s = P.landingSizes();
      for (var i = 0; i < s.length; i++) if (s[i].id === id) return s[i];
      return s[0] || null;
    },
    landingSizesFor: function (shape) {
      return P.landingSizes().filter(function (s) { return !s.shapes || s.shapes.indexOf(shape) >= 0; });
    },
    landingSizeForShape: function (shape) { var l = P.landingSizesFor(shape); return l.length ? l[0] : null; },
    landingMaxQty: function (id) {
      var L = P.landingSize(id);
      if (!L) return 1;
      var n = (L.price || []).length || 1;
      return Math.max(1, Math.min(n, Number(L.maxQty) || n));
    },
    landing: function (id, count) {
      var L = P.landingSize(id);
      if (!L) return { sell: 0, qty: 1, label: '' };
      var n = Math.max(1, Math.min(P.landingMaxQty(id), Math.round(Number(count) || 1)));
      return { sell: L.price[n - 1] || 0, qty: n, label: L.label };
    },
    tlGrades: function () {
      var t = SP.landingTops || {};
      return Object.keys(t).map(function (k) { var g = {}; for (var p in t[k]) g[p] = t[k][p]; g.id = k; return g; });
    },
    tlGrade: function (id) {
      var g = P.tlGrades();
      for (var i = 0; i < g.length; i++) if (g[i].id === id) return g[i];
      return g[g.length - 1] || null;
    },
    timberLandingGradeForSpecies: function (sid) {
      var g = P.tlGrades();
      for (var i = 0; i < g.length; i++) if ((g[i].species || []).indexOf(sid) >= 0) return g[i];
      for (var j = 0; j < g.length; j++) if (g[j]['default']) return g[j];
      return g[g.length - 1] || null;
    },
    tlSizeFor: function (gradeId, a, b) {
      var w = Math.max(Number(a) || 0, Number(b) || 0), d = Math.min(Number(a) || 0, Number(b) || 0);
      var s = (P.tlGrade(gradeId) || {}).sizes || [], best = null;
      for (var i = 0; i < s.length; i++) {
        var fx = Math.max(s[i].fitsX, s[i].fitsY), fy = Math.min(s[i].fitsX, s[i].fitsY);
        if (w <= fx && d <= fy && (!best || s[i].price < best.price)) best = s[i];
      }
      return best;
    },
    winder: function (wedges, opts) {
      opts = opts || {};
      var w = Math.max(1, Math.min(winderMax(), Math.round(Number(wedges) || 2)));
      var turns = Math.max(1, Math.round(Number(opts.turns) || 1));
      var each = Math.round(Number(((SP.winders && SP.winders.price) || [])[w - 1]) || 0);
      return { wedges: w, turns: turns, unit: each, sell: each * turns, total: each * turns, poa: !each,
        label: w + ' winder treads' + (turns > 1 ? ' \u00d7 ' + turns + ' turns' : '') };
    },
    timberLanding: function (gradeId, opts) {
      opts = opts || {};
      var g = P.tlGrade(gradeId), n = Math.max(1, Math.round(Number(opts.count) || 1));
      var wedges = Math.round(Number(opts.wedges) || 0);
      var pol = SP.turnPolish || {}, polTot = 0;
      if (wedges > 0) {
        var rows = (SP.winderTops && SP.winderTops.winders) || [], each = 0;
        for (var i = 0; i < rows.length; i++) if (Math.round(rows[i].wedges) === wedges) each = Number(rows[i].each) || 0;
        var tot = Math.round(each * wedges * n);
        if (opts.polish && pol.perWedge) polTot = Math.round(pol.perWedge * wedges * n);
        return { grade: g ? g.label : '', kind: 'winder', wedges: wedges, count: n,
          label: wedges + '-wedge winder turn', unit: Math.round(each * wedges), each: each,
          polish: polTot, total: tot + polTot, poa: !each };
      }
      var sz = P.tlSizeFor(gradeId, opts.width, opts.depth);
      var unit = sz ? Math.round(Number(sz.price) || 0) : 0;
      if (opts.polish) {
        var big = Math.max(Number(sz ? sz.fitsX : opts.width) || 0, Number(sz ? sz.fitsY : opts.depth) || 0);
        var rate = big <= (pol.smallMax || 1350) ? pol.landingSmall : pol.landingLarge;
        polTot = Math.round((rate || 0) * n);
      }
      return { grade: g ? g.label : '', kind: 'landing', count: n, sizeId: sz ? sz.id : '',
        label: sz ? sz.label : 'Oversize landing', unit: unit, polish: polTot,
        total: unit * n + polTot, poa: !sz || !unit, oversize: !sz };
    }
  };

  /* ---------- geometry (ported verbatim from the internal engine) ---------- */
  function goingPref() { return GOING; }
  /* Australian Standards caps risers per FLIGHT, not per staircase — a landing starts a new flight, so a
     turning staircase can carry a lot more than 18 risers in total. */
  function flightCount() {
    if (state.shape === 'straight') return 1;
    if (state.shape === 'l' && state.turnMethod === 'landing') return 1 + Math.max(1, Math.min(3, Number(state.landings) || 1));
    return 2;
  }
  function maxRisers() { return MAX_RISERS * flightCount(); }
  function bestRisers(height) { return Math.min(maxRisers(), Math.max(2, Math.ceil(height / RISER_MAX))); }

  function calcStairs() {
    var risers = state.risersManual != null
      ? Math.max(2, Math.min(maxRisers(), Math.round(state.risersManual)))
      : bestRisers(state.height);
    state.risers = risers;
    var riserHeight = state.height / risers;
    var treads = risers - 1;
    var going = goingPref();
    var run = treads * going;
    var pitch = Math.atan(riserHeight / going) * 180 / Math.PI;
    return { risers: risers, riserHeight: riserHeight, treads: treads, going: going, run: run, pitch: pitch,
      heightKnown: true, meets: riserHeight >= RISER_MIN && riserHeight <= RISER_MAX };
  }

  /* A landing size only counts as fixed once the customer types one — otherwise the
     landing is free to absorb whatever depth is left over, so the staircase finishes hard
     against the top slab. */
  function landingSide() { var man = state.landingTouched ? (Number(state.landingSize) || 0) : 0; return man > 0 ? Math.min(LAND_FILL_MAX, Math.max(LAND_MIN, man)) : 0; }
  function nominalLandingSize() {
    var man = state.landingTouched ? (Number(state.landingSize) || 0) : 0;
    if (man > 0) return Math.min(LAND_FILL_MAX, Math.max(LAND_MIN, man));
    var sz = P.landingSizeForShape('l');
    var d = sz && sz.label ? (sz.label.match(/\d+/g) || []).map(Number) : null;
    return d && d.length ? Math.max(LAND_MIN, d[0]) : LAND_MIN;
  }
  /* A U turn can be one full landing, or two quarter turns set independently — each
     half is either a quarter landing or 2/3 winder treads. */
  function uHalves() { return [state.uLower || 'landing', state.uUpper || 'landing']; }
  function halfRisers(h) { return h === 'w3' ? 3 : (h === 'w2' ? 2 : 1); }
  function uQuarters() { return state.shape === 'u' && state.uLanding === 'split'; }
  function uLandingHalves() { return uQuarters() ? uHalves().filter(function (h) { return h === 'landing'; }).length : 0; }
  function uWinderHalves() { return uQuarters() ? uHalves().filter(function (h) { return h !== 'landing'; }) : []; }
  function winderMax() { return Math.max(1, Math.round(Number(SP.winders && SP.winders.maxWedges) || 6)); }
  function landingDepth() { return Math.max(600, Number(state.landingSize) || Number(state.width) || 900); }
  /* On an L with a depth given and the landing on auto, the landing can only stretch to
     LAND_FILL_MAX — so below a certain number of steps before the turn the staircase would
     stop short of the slab. That count is the floor the customer can wind down to. */
  /* Left alone, the landing is kept to a sensible LAND_FILL_MAX. Once the customer sets
     the split themselves it is free to stretch to soak up the whole depth, so winding the
     steps back never leaves a gap at the top. */
  function splitFill() { return LAND_FILL_MAX; }
  function splitFloor(cap) {
    var lim = cap == null ? Infinity : Math.max(1, cap);
    if (state.shape !== 'l' || state.turnMethod === 'winders') return 1;
    var d = Number(state.avail) || 0;
    if (!d || state.landingTouched) return 1;
    /* Only a floor the flights can actually reach counts. Where the space is deeper than
       the staircase can fill, no split closes the gap, so there is nothing to protect and the
       control stays free. */
    var f = Math.ceil((d - LAND_FILL_MAX) / goingPref());
    return (f >= 1 && f < lim) ? f : 1;
  }

  function fitL(R) {
    var availD = Number(state.avail) || 0, availX = Number(state.avail2) || 0;
    /* Both space fields are optional on this page. With either blank the staircase is drawn
       unconstrained: preferred going, nominal landing, and no "doesn't fit" warning. */
    var openD = !(availD > 0), openX = !(availX > 0), open = openD || openX;
    var W = state.width || 1000, D = openD ? 1e6 : availD, X = openX ? 1e6 : availX;
    var wind = state.turnMethod === 'winders' ? Math.max(2, Math.min(3, Number(state.winders) || 2)) : 0;
    var manual = landingSide();
    /* Winder turns need a square the width of the staircase; a landing turn only needs the
       minimum panel, and it is sized off whatever depth is left. */
    var sqMin = wind ? Math.max(LAND_MIN, W) : LAND_MIN;
    var extras = wind ? 0 : Math.max(0, Math.min(2, (Number(state.landings) || 1) - 1));
    var topLand = extras >= 1, botLand = extras >= 2;
    var extraRes = nominalLandingSize();
    var resT = topLand ? extraRes : 0, resB = botLand ? extraRes : 0;
    var need = Math.max(1, (wind ? (R - 1 - wind) : (R - 2)) - extras);
    var autoA = Math.min(need, Math.ceil(Math.max(1, R - 2 - extras) / 2));
    var res = null;
    for (var g = goingPref(); g >= GOING_MIN; g--) {
      var maxA = Math.max(0, Math.floor((D - sqMin - resT) / g)), maxB = Math.max(0, Math.floor((X - W - resB) / g));
      if (maxA + maxB < need) continue;
      var nA = (manual > 0 && !openD) ? Math.floor((D - resT - Math.max(sqMin, manual)) / g) : (state.split != null ? Math.round(state.split) : autoA);
      nA = Math.max(0, Math.min(nA, maxA));
      var nB = need - nA;
      if (nB > maxB) { nB = maxB; nA = need - nB; }
      if (nA > maxA) continue;
      res = { g: g, nA: nA, nB: nB, maxA: maxA, maxB: maxB }; break;
    }
    var fits = !!res;
    if (!res) {
      var g0 = GOING_MIN, mA = Math.max(0, Math.floor((D - sqMin - resT) / g0)), mB = Math.max(0, Math.floor((X - W - resB) / g0));
      var nA0 = (manual > 0 && !openD) ? Math.floor((D - resT - Math.max(sqMin, manual)) / g0) : (state.split != null ? Math.round(state.split) : autoA);
      nA0 = Math.max(0, Math.min(nA0, need));
      res = { g: g0, nA: nA0, nB: need - nA0, maxA: mA, maxB: mB };
    }
    var gg = res.g, nAf = res.nA, nBf = res.nB;
    /* Winders eat risers out of the turn, and those come off the bottom flight — the top
       flight still runs as far down the depth as it can. */
    if (wind && !openD && state.split == null) {
      var wantA = Math.max(0, Math.min(need, res.maxA));
      if (wantA > nAf) { nBf = Math.max(0, nBf - (wantA - nAf)); nAf = need - nBf; }
    }
    /* The bottom flight is the staircase width unless the customer types a different one. Its
       width sets how deep the corner has to be, so it is needed before the split is set. */
    var W2 = Number(state.width2) > 0 ? Math.max(600, Number(state.width2)) : W;
    /* Left on auto the bottom flight may be narrowed to match a shortened corner landing:
       that trades landing depth for one more step on the top flight, so the staircase finishes
       hard against the slab instead of stopping short. It never goes under BOT_MIN. */
    var W2nom = W2, W2auto = !(Number(state.width2) > 0);
    /* Work back from the slab: the split and the landing are chosen together so the corner
       zone (the landing, or the bottom flight width if that is deeper) plus the top flight
       lands as close to the available depth as it can without going past it. */
    if (!wind && !manual && !openD && extras === 0 && state.split == null) {
      var fill = Math.max(sqMin, LAND_FILL_MAX), best = null;
      for (var cA = Math.min(res.maxA, Math.max(1, need - 1)); cA >= 1; cA--) {
        var cB = need - cA;
        if (cB < 0 || cB > res.maxB) continue;
        var remC = D - resT - cA * gg;
        if (remC < sqMin) continue;
        var lzC = Math.min(fill, remC);
        var bwC = W2auto ? Math.min(W2nom, Math.max(BOT_MIN, lzC)) : W2nom;
        var depC = cA * gg + Math.max(lzC, bwC) + resT;
        var okC = depC <= D + 0.5, wasteC = okC ? D - depC : Infinity;
        var better = !best ? true
          : (okC !== best.ok) ? okC
          : okC ? (wasteC < best.waste - 0.5 || (Math.abs(wasteC - best.waste) <= 0.5 && lzC > best.lz))
          : depC < best.dep;
        if (better) best = { nA: cA, nB: cB, lz: lzC, dep: depC, ok: okC, waste: wasteC, bw: bwC };
      }
      if (best) { nAf = best.nA; nBf = best.nB; W2 = best.bw; }
    }
    /* The bottom flight always keeps at least one step — with none it is not an L, it is a
       straight flight with a landing at the bottom. */
    if (!wind && need > 1 && nAf > need - 1) { nAf = need - 1; nBf = need - nAf; }
    var Lz = wind
      ? (openD ? sqMin : Math.min(Math.max(sqMin, LAND_AUTO_MAX), Math.max(sqMin, D - resT - nAf * gg)))
      : (extras > 0 || openD ? Math.max(sqMin, extraRes)
        : (manual > 0 ? Math.min(LAND_FILL_MAX, Math.max(sqMin, manual))
          : Math.min(Math.max(sqMin, splitFill()), Math.max(sqMin, D - resT - nAf * gg))));
    if (!wind && manual > 0) Lz = Math.min(LAND_FILL_MAX, Math.max(sqMin, manual));
    /* The landing and the bottom flight share the corner square, so on auto the flight
       follows the landing down rather than leaving the landing short of the outer edge. */
    if (!wind && W2auto && Lz < W2 - 0.5) W2 = Math.max(BOT_FLOOR, Lz);
    var manualW2 = !!(Number(state.width2) || 0);
    var LzT = topLand ? extraRes : 0, LzB = botLand ? extraRes : 0;
    var nomTurn = wind ? sqMin : extraRes;
    var nAn = Math.max(0, Math.min(need, state.split != null ? Math.round(state.split) : autoA));
    var reqD = nAn * gg + Math.max(nomTurn, manualW2 ? W2 : 0) + LzT, reqX = W + (need - nAn) * gg + LzB;
    var capacity = res.maxA + res.maxB, missing = Math.max(0, need - capacity);
    return { g: gg, Lz: Lz, W: W, W2: W2, nA: nAf, nB: nBf, mA: res.maxA, mB: res.maxB, fits: fits, need: need,
      capacity: capacity, missing: missing, autoA: autoA, extras: extras, topLand: topLand, botLand: botLand,
      LzT: LzT, LzB: LzB, reqD: reqD, reqX: reqX, winders: wind,
      depth: nAf * gg + Math.max(Lz, W2) + LzT, across: W + nBf * gg + LzB, availD: availD, availX: availX,
      shortMM: missing * GOING_MIN, manualLanding: manual > 0, manualW2: manualW2,
      botNarrow: Math.max(0, W2nom - W2), open: open, openD: openD, openX: openX };
  }

  function shapeCalc(c) {
    var sh = state.shape;
    if (sh === 'straight') return null;
    var R = c.risers;
    var wind = state.turnMethod === 'winders' ? Math.max(2, Math.min(3, Number(state.winders) || 2)) : 0;
    var uSplit = (sh === 'u' && state.turnMethod === 'landing' && state.uLanding === 'split');
    if (sh === 'l') {
      var f = fitL(R);
      /* The corner square is shared with the bottom flight, so the landing is never drawn
         shallower than that flight is wide — otherwise it would stop short of the outer
         edge. The footprint already counts the corner this way. */
      var cornerL = Math.max(f.Lz, f.W2 || f.W);
      return { shape: 'l', ghostB: f.openX, g: f.g, fit: f, rA: f.nA, rB: f.nB, tA: f.nA, tB: f.nB, winders: wind, uSplit: false,
        turnRisers: wind ? wind : 1, runA: f.nA * f.g, runB: f.nB * f.g, W: f.W, W2: f.W2, LD: wind ? f.Lz : cornerL, gap: 0,
        bbW: f.across, bbH: f.depth, timberTreads: f.nA + f.nB + (wind ? wind : 0), auto: f.autoA,
        flightRisers: f.need, turnDepth: wind ? f.Lz : cornerL, firstLeg: f.depth, devRun: f.depth + f.nB * f.g };
    }
    /* turnRisers counts the levels the turn itself takes: one per landing, one per winder
       tread. Those come out of the step count, the same way the L-shape works — a 16-riser
       U with one landing is 14 treads plus the landing, not 15 treads. */
    var turnRisers = wind ? wind : (uSplit
      ? uHalves().reduce(function (t, hh) { return t + halfRisers(hh); }, 0)
      : 1);
    var flightRisers = Math.max(0, R - turnRisers - 1);
    var gp = goingPref();
    var availD = Number(state.avail) || 0;
    /* With a depth given and the landing left on auto, the staircase is worked back from the
       slab: the flights run as far as the depth allows and whatever is left over becomes
       the landing, so the top step finishes hard against the top slab line. */
    var uAuto = (sh === 'u') && !wind && !state.landingTouched && availD > 0;
    var auto = Math.max(1, sh === 'u' ? Math.floor(flightRisers / 2) : Math.round(flightRisers / 2));
    if (uAuto) {
      /* On a U only the top flight is boxed in by the depth the customer measured — it runs
         down from the upper floor. The bottom flight carries on into the open room, so the
         split is set to keep the top flight inside the depth and the leftover treads go on
         the bottom flight. */
      var maxTop = Math.max(1, Math.floor((availD - LAND_MIN) / gp));
      var topWant = Math.max(1, Math.min(Math.ceil(flightRisers / 2), maxTop));
      auto = Math.max(1, Math.min(flightRisers - 1, flightRisers - topWant));
    }
    /* Winders take their risers off the bottom flight — the top flight still runs down
       as much of the depth as it fits. */
    if (sh === 'u' && wind && availD > 0 && state.split == null) {
      var maxTw = Math.floor((availD - (state.width || 1000)) / gp);
      if (maxTw > auto) auto = Math.max(1, Math.min(flightRisers - 1, maxTw));
    }
    var rA = state.split == null ? auto : Math.max(1, Math.min(flightRisers - 1, Math.round(state.split)));
    var rB = flightRisers - rA;
    /* On a U the return flight is the one that finishes on the slab, so it takes the
       longer half and the up flight sits in from the floor edge. */
    if (sh === 'u' && state.split == null && !uAuto && rB < rA) { var swp = rA; rA = rB; rB = swp; }
    var tA = Math.max(0, rA), tB = Math.max(0, rB);
    var timberTreads = tA + tB + (wind ? wind : 0);
    var runA = tA * gp, runB = tB * gp;
    var W = state.width || 1000, LD = landingDepth();
    if (uAuto) {
      /* The landing is sized off the depth the top flight has to sit in. */
      var left = availD - runB;
      if (left >= LAND_MIN) LD = Math.min(LAND_AUTO_MAX, left);
    }
    var gap = Math.max(0, Number(state.gap) || 0);
    var turnDepth = wind ? W : LD;
    if (wind && availD > 0 && state.split == null) {
      var leftW = availD - Math.max(runA, runB);
      if (leftW > turnDepth) turnDepth = Math.min(Math.max(W, LAND_AUTO_MAX), leftW);
    }
    var bbW = 2 * W + gap, bbH = Math.max(runA, runB) + turnDepth;
    var firstLeg = rA * gp + turnDepth, devRun = firstLeg + rB * gp;
    return { shape: sh, g: gp, turnDepth: turnDepth, firstLeg: firstLeg, devRun: devRun, rA: rA, rB: rB, tA: tA, tB: tB,
      winders: wind, uSplit: uSplit, halves: uSplit ? uHalves() : null, turnRisers: turnRisers, runA: runA, runB: runB, W: W, LD: LD, gap: gap,
      /* The top flight is the one the measured depth applies to; the bottom flight runs on
         into the room, so the two are reported separately. */
      topDepth: runB + turnDepth, botDepth: runA + turnDepth,
      bbW: bbW, bbH: bbH, timberTreads: timberTreads, auto: auto, flightRisers: flightRisers };
  }

  /* ---------- drawings (ported) ---------- */
  var DIMC = '#8d97a4';
  function dimH(x1, x2, y, label) {
    var m = (x1 + x2) / 2;
    return '<g stroke="' + DIMC + '" stroke-width=".7" fill="none"><path d="M' + x1.toFixed(1) + ' ' + y.toFixed(1) + 'h' + (x2 - x1).toFixed(1) + '"/><path d="M' + x1.toFixed(1) + ' ' + (y - 2.5).toFixed(1) + 'v5M' + x2.toFixed(1) + ' ' + (y - 2.5).toFixed(1) + 'v5"/></g>' +
      '<text x="' + m.toFixed(1) + '" y="' + (y - 3.5).toFixed(1) + '" fill="' + DIMC + '" stroke="none" font-size="8" font-weight="600" text-anchor="middle">' + label + '</text>';
  }
  function dimV(y1, y2, x, label) {
    var m = (y1 + y2) / 2;
    return '<g stroke="' + DIMC + '" stroke-width=".7" fill="none"><path d="M' + x.toFixed(1) + ' ' + y1.toFixed(1) + 'v' + (y2 - y1).toFixed(1) + '"/><path d="M' + (x - 2.5).toFixed(1) + ' ' + y1.toFixed(1) + 'h5M' + (x - 2.5).toFixed(1) + ' ' + y2.toFixed(1) + 'h5"/></g>' +
      '<text x="' + (x - 3.5).toFixed(1) + '" y="' + m.toFixed(1) + '" fill="' + DIMC + '" stroke="none" font-size="8" font-weight="600" text-anchor="middle" transform="rotate(-90 ' + (x - 3.5).toFixed(1) + ' ' + m.toFixed(1) + ')">' + label + '</text>';
  }

  function shapeElevL(s, c) {
    var vbW = 200, vbH = 140, padL = 30, padR = 20, padT = 22, padB = 30;
    var rh = c.riserHeight;
    var Lz = s.LD, g = s.g, nA = s.rA, wind = s.winders || 0;
    var wSteps = wind ? Math.max(2, wind) : 0, wDepth = wind ? Lz / wSteps : 0;
    var runMM = Lz + nA * g, riseMM = (nA + 1 + (wind ? wind : 0)) * rh;
    var k = Math.min((vbW - padL - padR) / Math.max(1, runMM), (vbH - padT - padB) / Math.max(1, riseMM));
    var x0 = padL, y0 = vbH - padB;
    var d = 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1), x = x0, y = y0;
    if (wind) { for (var w = 0; w < wSteps; w++) { d += 'v-' + (rh * k).toFixed(1) + 'h' + (wDepth * k).toFixed(1); x += wDepth * k; y -= rh * k; } }
    else { d += 'h' + (Lz * k).toFixed(1); x += Lz * k; }
    for (var i = 0; i < nA; i++) { d += ' v-' + (rh * k).toFixed(1) + 'h' + (g * k).toFixed(1); y -= rh * k; x += g * k; }
    d += ' v-' + (rh * k).toFixed(1); y -= rh * k;
    var floorY = y, floorX = x;
    var out = '<path d="M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + 'h-' + (padL - 8).toFixed(1) + '" stroke="#fff" stroke-width="1.1" stroke-dasharray="3 3" fill="none" opacity=".45"/>' +
      '<path d="M' + x0.toFixed(1) + ' ' + (y0 + 6).toFixed(1) + 'V' + (padT - 6).toFixed(1) + 'M' + floorX.toFixed(1) + ' ' + (y0 + 6).toFixed(1) + 'V' + (padT - 6).toFixed(1) + '" stroke="#8d97a4" stroke-width=".7" stroke-dasharray="4 3" fill="none" opacity=".7"/>' +
      (wind ? '' : '<rect x="' + x0.toFixed(1) + '" y="' + (y0 - 3.5).toFixed(1) + '" width="' + (Lz * k).toFixed(1) + '" height="3.5" fill="rgba(255,255,255,.2)" stroke="none"/>') +
      '<path d="' + d + '" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M' + floorX.toFixed(1) + ' ' + floorY.toFixed(1) + 'h' + (padR - 4).toFixed(1) + '" stroke="#fff" stroke-width="1.6" fill="none"/>' +
      '<text x="' + (floorX + 2).toFixed(1) + '" y="' + (floorY - 4).toFixed(1) + '" fill="#aab3bc" stroke="none" font-size="6.5" text-anchor="end">top floor</text>';
    out += dimH(x0, x0 + Lz * k, Math.max(padT - 4, y0 - riseMM * k - 9), wind ? (wind + ' winders') : (Math.round(Lz) + 'mm landing'));
    out += dimH(x0, floorX, vbH - 9, Math.round(runMM) + 'mm');
    out += dimV(floorY, y0, x0 - 11, Math.round(riseMM) + 'mm top flight');
    return out;
  }

  function shapeElev(s, c) {
    var vbW = 200, vbH = 140, padL = 30, padR = 14, padT = 14, padB = 26;
    var rh = c.riserHeight;
    var steps = [];
    for (var i = 0; i < s.rA; i++) steps.push(s.g);
    if (s.winders) { for (var w = 0; w < s.winders; w++) steps.push(s.turnDepth / s.winders); }
    else if (s.uSplit) { for (var q = 0; q < s.turnRisers; q++) steps.push(s.LD / s.turnRisers); }
    else steps.push(s.LD);
    for (var j = 0; j < s.rB; j++) steps.push(s.g);
    steps.push(0);
    var runMM = steps.reduce(function (t, v) { return t + v; }, 0), riseMM = steps.length * rh;
    var k = Math.min((vbW - padL - padR) / runMM, (vbH - padT - padB) / riseMM);
    var turnCount = s.winders ? s.winders : (s.uSplit ? s.turnRisers : 1);
    var lastSolid = s.rA + turnCount;
    var x = padL, y = vbH - padB, dA = 'M' + x.toFixed(1) + ' ' + y.toFixed(1), dB = '', lx = 0, ly = 0, legRun = 0;
    steps.forEach(function (g, i) {
      var gx = g * k, gy = rh * k;
      if (i === s.rA) { lx = x; ly = y; }
      if (i < lastSolid) { dA += ' h' + gx.toFixed(1) + ' v-' + gy.toFixed(1); legRun += g; }
      else { if (!dB) dB = 'M' + x.toFixed(1) + ' ' + y.toFixed(1); dB += ' h' + gx.toFixed(1) + ' v-' + gy.toFixed(1); }
      x += gx; y -= gy;
    });
    var solidEnd = padL + legRun * k, landW = (legRun - s.rA * s.g) * k;
    var out = '<path d="M' + padL.toFixed(1) + ' ' + (vbH - padB).toFixed(1) + 'h' + (runMM * k).toFixed(1) + 'M' + padL.toFixed(1) + ' ' + (vbH - padB).toFixed(1) + 'V' + padT.toFixed(1) + '" stroke="#fff" stroke-width="1.1" stroke-dasharray="3 3" fill="none" opacity=".5"/>';
    if (dB) out += '<path d="' + dB + '" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".28"/>';
    out += '<rect x="' + lx.toFixed(1) + '" y="' + (ly - rh * turnCount * k - 4).toFixed(1) + '" width="' + landW.toFixed(1) + '" height="' + (rh * turnCount * k + 4).toFixed(1) + '" fill="rgba(255,255,255,.14)" stroke="none"/>';
    out += '<path d="' + dA + '" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
    out += dimH(padL, solidEnd, vbH - 9, Math.round(legRun) + 'mm first leg');
    out += dimV(vbH - padB - riseMM * k, vbH - padB, padL - 11, Math.round(riseMM) + 'mm rise');
    out += dimH(lx, solidEnd, Math.max(padT + 7, ly - rh * turnCount * k - 8), (s.winders ? s.winders + ' winders' : Math.round(s.LD) + 'mm landing'));
    return out;
  }

  function shapePlan(s) {
    var pad = 26, vbW = 200, vbH = 140;
    var spanW = s.bbW, spanH = s.bbH;
    /* Draw the space the customer has given us as they type it, whichever dimension
       they have filled in so far. */
    var gw = (s.fit ? (s.fit.availX || 0) : (Number(state.avail2) || 0));
    var gh = (s.fit ? (s.fit.availD || 0) : (Number(state.avail) || 0));
    /* Only the dimensions the customer actually gave us are labelled. */
    var spaceLabel = gw && gh ? Math.round(gw) + ' × ' + Math.round(gh) + 'mm'
      : (gw ? Math.round(gw) + 'mm across · depth not given' : Math.round(gh) + 'mm deep · width not given');
    if (gw || gh) { gw = gw || s.bbW; gh = gh || s.bbH; spanW = Math.max(spanW, gw); spanH = Math.max(spanH, gh); }
    var k = Math.min((vbW - pad * 2) / spanW, (vbH - pad * 2) / spanH);
    var ox = (vbW - s.bbW * k) / 2, oy = (vbH - s.bbH * k) / 2;
    var W = s.W * k, LD = (s.shape === 'l' ? s.LD : (s.winders ? s.turnDepth : s.LD)) * k, BW = (s.W2 || s.W) * k, g = s.gap * k;
    var X = function (v) { return (ox + v * k).toFixed(1); }, Y = function (v) { return (oy + v * k).toFixed(1); };
    var out = '', labs = [], turnFill = 'fill="rgba(255,255,255,.16)"';
    function label(x, y, t, fs, fill, weight) { labs.push({ x: x, y: y, t: t, fs: fs, fill: fill, weight: weight }); }
    function fitFs(text, boxW, max, min) { return Math.max(min, Math.min(max, (boxW * 0.9) / (0.68 * text.length))); }
    function numbers(x, y, w, hh, n, horiz, startNo, rev) {
      if (!(n > 0)) return;
      var cw = horiz ? w : w / n, ch = horiz ? hh / n : hh;
      var fs = Math.min(4.6, cw * 0.5, ch * 0.72);
      if (fs < 1.7) return;
      for (var i = 0; i < n; i++) {
        var cx = horiz ? x + w / 2 : x + cw * (i + 0.5), cy = horiz ? y + ch * (i + 0.5) : y + hh / 2;
        var no = rev ? startNo + (n - 1 - i) : startNo + i;
        label(cx, cy + fs * 0.36, String(no), fs, '#8d97a4', 600);
      }
    }
    function rungs(x, y, w, hh, n, horiz) {
      var o = '';
      for (var i = 1; i < n; i++) {
        if (horiz) { var yy = y + hh * i / n; o += '<path d="M' + x.toFixed(1) + ' ' + yy.toFixed(1) + 'h' + w.toFixed(1) + '"/>'; }
        else { var xx = x + w * i / n; o += '<path d="M' + xx.toFixed(1) + ' ' + y.toFixed(1) + 'v' + hh.toFixed(1) + '"/>'; }
      }
      return o;
    }
    if (s.shape === 'l') {
      var aH = s.runA * k, bW = s.runB * k;
      var LzT = ((s.fit && s.fit.LzT) || 0) * k, LzB = ((s.fit && s.fit.LzB) || 0) * k, bBase = LzB > 0 ? 1 : 0;
      var ax = +X(0), ay = +Y(0) + LzT;
      var turnN = s.winders ? Math.max(2, s.winders) : 1;
      var topNo = bBase + s.tB + turnN + s.tA + 1;
      if (LzT > 0) {
        out += '<rect x="' + ax + '" y="' + (+Y(0)).toFixed(1) + '" width="' + W.toFixed(1) + '" height="' + LzT.toFixed(1) + '" ' + turnFill + '/>';
        var tfs = fitFs('1350mm', W, 7, 4.2);
        label(ax + W / 2, +Y(0) + LzT / 2 - tfs * 0.2, 'step ' + topNo, tfs * 0.82, '#8d97a4', 600);
        label(ax + W / 2, +Y(0) + LzT / 2 + tfs * 1.05, 'top landing', tfs * 0.82, '#aab3bc', 400);
      }
      out += '<rect x="' + ax + '" y="' + ay.toFixed(1) + '" width="' + W.toFixed(1) + '" height="' + aH.toFixed(1) + '"/>' + rungs(ax, ay, W, aH, Math.max(1, s.tA), true);
      numbers(ax, ay, W, aH, s.tA, true, bBase + s.tB + turnN + 1, true);
      var ly = ay + aH;
      out += '<rect x="' + ax + '" y="' + ly.toFixed(1) + '" width="' + W.toFixed(1) + '" height="' + LD.toFixed(1) + '" ' + turnFill + '/>';
      if (s.winders) {
        var ix = ax + W, iy = ly, n = Math.max(2, s.winders), wd = '';
        for (var q = 1; q < n; q++) {
          var t = q * (W + LD) / n, px, py;
          if (t <= LD) { px = ax; py = ly + t; } else { px = ax + (t - LD); py = ly + LD; }
          wd += '<path d="M' + ix.toFixed(1) + ' ' + iy.toFixed(1) + 'L' + px.toFixed(1) + ' ' + py.toFixed(1) + '"/>';
        }
        out += wd;
        var wfs = fitFs('steps 8\u201310', W, 7, 4.2);
        var w1 = bBase + s.tB + 1, w2 = bBase + s.tB + n;
        label(ax + W / 2, ly + LD / 2 - wfs * 0.2, 'steps ' + w1 + '\u2013' + w2, wfs, '#e6e9ec', 600);
        label(ax + W / 2, ly + LD / 2 + wfs * 1.15, n + ' winders', wfs * 0.82, '#aab3bc', 400);
      }
      /* The bottom flight runs off the outer edge of the landing, so when the landing is
         deeper than the flight is wide the flight sits flush with that outer edge. */
      var byB = ly + Math.max(0, LD - BW);
      if (s.ghostB) {
        out += '<g opacity=".4" stroke-dasharray="3 2.5"><rect x="' + (ax + W).toFixed(1) + '" y="' + byB.toFixed(1) + '" width="' + bW.toFixed(1) + '" height="' + BW.toFixed(1) + '"/>' + rungs(ax + W, byB, bW, BW, Math.max(1, s.tB), false) + '</g>';
        var gfs = Math.min(5, bW * 0.11);
        if (gfs >= 3) label(ax + W + bW / 2, byB + BW / 2, s.tB + ' steps across', gfs, '#aab3bc', 600);
      } else {
        out += '<rect x="' + (ax + W).toFixed(1) + '" y="' + byB.toFixed(1) + '" width="' + bW.toFixed(1) + '" height="' + BW.toFixed(1) + '"/>' + rungs(ax + W, byB, bW, BW, Math.max(1, s.tB), false);
        numbers(ax + W, byB, bW, BW, s.tB, false, bBase + 1, true);
      }
      if (LzB > 0) {
        out += '<rect x="' + (ax + W + bW).toFixed(1) + '" y="' + byB.toFixed(1) + '" width="' + LzB.toFixed(1) + '" height="' + BW.toFixed(1) + '" ' + turnFill + '/>';
        var bfs = Math.min(4.4, LzB * 0.28, BW * 0.16);
        if (bfs >= 2.4) {
          label(ax + W + bW + LzB / 2, byB + BW / 2 - bfs * 0.2, 'step 1', bfs, '#e6e9ec', 600);
          label(ax + W + bW + LzB / 2, byB + BW / 2 + bfs * 1.15, 'bottom landing', bfs * 0.8, '#aab3bc', 400);
        }
      }
      if (!s.winders) {
        var lt = Math.round(s.LD) + 'mm', lfs = fitFs(lt, W, 8, 5);
        var lcy = ly + LD / 2;
        label(ax + W / 2, lcy - lfs * 1.05, 'step ' + (bBase + s.tB + 1), lfs * 0.75, '#8d97a4', 600);
        label(ax + W / 2, lcy - 0.5, lt, lfs, '#e6e9ec', 600);
        label(ax + W / 2, lcy + lfs * 0.95, 'landing', lfs * 0.8, '#aab3bc', 400);
      }
    } else {
      var aH2 = s.runA * k, bH2 = s.runB * k;
      var x0 = +X(0), y0 = +Y(0), yF = y0 + LD;
      out += '<rect x="' + x0 + '" y="' + y0 + '" width="' + (2 * W + g).toFixed(1) + '" height="' + LD.toFixed(1) + '" ' + turnFill + '/>';
      if (s.uSplit) {
        out += '<path d="M' + (x0 + W + g / 2).toFixed(1) + ' ' + y0 + 'v' + LD.toFixed(1) + '"/>';
        var hw = W + g / 2, no = s.tA + 1;
        s.halves.forEach(function (hh, hi) {
          var hx = x0 + (hi === 0 ? 0 : hw), n = halfRisers(hh);
          if (hh !== 'landing') {
            /* Wedges pivot on the inner newel — the corner where this half meets the
               centre line and its flight — and fan out to the outer edge. */
            var inX = hi === 0 ? hx + hw : hx, outX = hi === 0 ? hx : hx + hw, pvY = y0 + LD;
            for (var q2 = 1; q2 < n; q2++) {
              var t = q2 * (LD + hw) / n, px, py;
              if (t <= LD) { px = outX; py = pvY - t; }
              else { px = outX + (hi === 0 ? (t - LD) : -(t - LD)); py = y0; }
              out += '<path d="M' + inX.toFixed(1) + ' ' + pvY.toFixed(1) + 'L' + px.toFixed(1) + ' ' + py.toFixed(1) + '"/>';
            }
          }
          var hfs = Math.min(4.6, hw * 0.13, LD * 0.2);
          if (hfs >= 2.2) {
            if (hh === 'landing') {
              label(hx + hw / 2, y0 + LD / 2 - hfs * 0.2, n > 1 ? 'steps ' + no + '\u2013' + (no + n - 1) : 'step ' + no, hfs, '#e6e9ec', 600);
              label(hx + hw / 2, y0 + LD / 2 + hfs * 1.15, 'quarter landing', hfs * 0.82, '#aab3bc', 400);
            } else {
              /* One short line only — the wedge fan leaves no room for a second, and the
                 winder count is spelled out in the caption under the drawing. */
              var wcx = hi === 0 ? hx + hw * 0.30 : hx + hw * 0.70;
              label(wcx, y0 + LD - hfs * 0.7, n > 1 ? 'steps ' + no + '\u2013' + (no + n - 1) : 'step ' + no, hfs * 0.9, '#e6e9ec', 600);
            }
          }
          no += n;
        });
      }
      if (s.winders) {
        out += rungs(x0, y0, 2 * W + g, LD, s.winders, false);
        numbers(x0, y0, 2 * W + g, LD, s.winders, false, s.tA + 1, false);
      }
      out += '<rect x="' + x0 + '" y="' + yF.toFixed(1) + '" width="' + W.toFixed(1) + '" height="' + aH2.toFixed(1) + '"/>' + rungs(x0, yF, W, aH2, Math.max(1, s.tA), true);
      var turnN2 = s.winders ? Math.max(2, s.winders) : (s.turnRisers || 1);
      numbers(x0, yF, W, aH2, s.tA, true, 1, true);
      var yB = yF;
      out += '<rect x="' + (x0 + W + g).toFixed(1) + '" y="' + yB.toFixed(1) + '" width="' + W.toFixed(1) + '" height="' + bH2.toFixed(1) + '"/>' + rungs(x0 + W + g, yB, W, bH2, Math.max(1, s.tB), true);
      numbers(x0 + W + g, yB, W, bH2, s.tB, true, s.tA + turnN2 + 1, false);
    }
    if (state.turnSide === 'right') out = '<g transform="translate(200,0) scale(-1,1)">' + out + '</g>';
    labs.forEach(function (l) {
      var lx = state.turnSide === 'right' ? 200 - l.x : l.x;
      out += '<text x="' + lx.toFixed(1) + '" y="' + l.y.toFixed(1) + '" fill="' + l.fill + '" stroke="none" font-size="' + l.fs.toFixed(1) + '" font-weight="' + l.weight + '" text-anchor="middle">' + l.t + '</text>';
    });
    var bx = ox, by = oy, bw = s.bbW * k, bh = s.bbH * k;
    /* Any slack between the staircase and the opening sits on the bottom flight side — that is
       the edge the customer works off. On a U the bottom flight is the near column, on an
       L it runs out to the far edge, so the two shapes align opposite ways. */
    var spaceRight = s.shape === 'u' ? state.turnSide !== 'right' : state.turnSide === 'right';
    if (gw && gh) {
      /* On a U the depth is measured down from the upper floor, so the dashed space starts
         at the top of the drawing and anything below that line has run past it. */
      var ex = spaceRight ? bx + bw - gw * k : bx;
      var ey = s.shape === 'u' ? by : by + bh - gh * k;
      out += '<rect x="' + ex.toFixed(1) + '" y="' + ey.toFixed(1) + '" width="' + (gw * k).toFixed(1) + '" height="' + (gh * k).toFixed(1) + '" fill="none" stroke="#8d97a4" stroke-width=".8" stroke-dasharray="4 3" opacity=".8"/>';
      /* The staircase can now fill the space completely, so the space size is written in the
         caption under the drawing rather than anywhere on it. Where it spills past the
         space, the strip that overruns is hatched in orange and measured, so the customer
         can see exactly how far over they are. */
      var oX = s.bbW - gw, oY = s.bbH - gh;
      if (oX > 0.5) {
        var sx = spaceRight ? bx : bx + gw * k, sw = oX * k;
        out += '<rect x="' + sx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + sw.toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="rgba(232,103,44,.12)" stroke="#e8672c" stroke-width=".9" stroke-dasharray="3 2"/>' +
          '<text x="' + (spaceRight ? bx - 4 : bx + bw + 4).toFixed(1) + '" y="' + (by + bh * 0.9).toFixed(1) + '" fill="#f2a179" stroke="none" font-size="6.4" font-weight="700" text-anchor="' + (spaceRight ? 'end' : 'start') + '">' + Math.round(oX) + 'mm over</text>';
      }
      var uTopFits = s.shape === 'u' && s.topDepth && gh >= s.topDepth - 0.5;
      if (oY > 0.5 && s.shape === 'u') {
        /* Everything below the measured depth line has run past it. On a U that is normal
           for the bottom flight, so it is marked but not called an overrun. */
        var pastY = by + gh * k, pastH = bh - gh * k, fill = uTopFits ? 'rgba(232,103,44,.10)' : 'rgba(232,103,44,.14)';
        out += '<rect x="' + bx.toFixed(1) + '" y="' + pastY.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + pastH.toFixed(1) + '" fill="' + fill + '" stroke="#e8672c" stroke-width=".9" stroke-dasharray="3 2"/>' +
          '<text x="' + (bx + bw + 4).toFixed(1) + '" y="' + (pastY + pastH / 2).toFixed(1) + '" fill="#f2a179" stroke="none" font-size="6.4" font-weight="700">' + Math.round(oY) + 'mm past</text>';
      } else if (oY > 0.5) {
        out += '<rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (oY * k).toFixed(1) + '" fill="rgba(232,103,44,.12)" stroke="#e8672c" stroke-width=".9" stroke-dasharray="3 2"/>' +
          '<text x="' + (bx + bw + 4).toFixed(1) + '" y="' + (by + oY * k / 2).toFixed(1) + '" fill="#f2a179" stroke="none" font-size="6.4" font-weight="700">' + Math.round(oY) + 'mm over</text>';
      }
    }
    out += dimH(bx, bx + bw, vbH - 9, s.ghostB ? 'add your available width' : Math.round(s.bbW) + 'mm staircase');
    out += dimV(by, by + bh, bx - 11, Math.round(s.bbH) + 'mm staircase');
    var fx = state.turnSide === 'right' ? bx + bw - W : bx;
    out += dimH(fx, fx + W, by - 7, Math.round(s.W) + 'mm wide');
    /* On an L the bottom flight can be a different width from the top one, so it is called
       out under the flight it belongs to. */
    if (s.shape === 'l' && !s.ghostB) {
      var bwMM = Math.round(s.W2 || s.W);
      out += '<text x="' + (bx + bw).toFixed(1) + '" y="' + (by + bh + 6.5).toFixed(1) + '" fill="' + DIMC + '" stroke="none" font-size="5.6" font-weight="600" text-anchor="end">bottom flight ' + bwMM + 'mm wide</text>';
    }
    /* The turn zone is always measured, landing or winders, so the customer can see how
       much depth the turn itself takes up. */
    if (LD > 0.5) {
      var turnTop = s.shape === 'l' ? by + (((s.fit && s.fit.LzT) || 0) + s.runA) * k : by;
      var turnWordMM = Math.round(LD / k) + 'mm ' +
        (s.winders ? 'winders' : 'deep');
      out += dimV(turnTop, turnTop + LD, bx + bw + 14, turnWordMM);
    }
    if (s.shape === 'u' && !s.winders && !s.uSplit) {
      var l1 = Math.round(s.bbW) + 'mm landing', cx = (bx + bw / 2);
      var fs = fitFs(l1, bw, 8, 4.5);
      out += '<text x="' + cx.toFixed(1) + '" y="' + (by + LD / 2 - 9).toFixed(1) + '" fill="#8d97a4" stroke="none" font-size="' + (fs * 0.75).toFixed(1) + '" font-weight="600" text-anchor="middle">step ' + (s.tA + 1) + '</text>' +
        '<text x="' + cx.toFixed(1) + '" y="' + (by + LD / 2 - 1).toFixed(1) + '" fill="#e6e9ec" stroke="none" font-size="' + fs.toFixed(1) + '" font-weight="600" text-anchor="middle">' + l1 + '</text>' +
        '<text x="' + cx.toFixed(1) + '" y="' + (by + LD / 2 + 7.5).toFixed(1) + '" fill="#aab3bc" stroke="none" font-size="' + (fs * 0.82).toFixed(1) + '" text-anchor="middle">full width</text>';
    }
    return out;
  }

  /* Plan view for a straight flight. */
  /* Until the customer gives us a depth there is nothing honest to draw for a turning
     staircase — every dimension of the layout comes off the space. */
  function planPrompt(line1, line2) {
    return '<g opacity=".45" stroke-dasharray="4 3"><rect x="58" y="22" width="84" height="96" stroke="#8d97a4" stroke-width=".8"/></g>' +
      '<text x="100" y="66" fill="#9fb6b5" stroke="none" font-size="7" font-weight="600" text-anchor="middle">' + (line1 || 'measure the depth') + '</text>' +
      '<text x="100" y="77" fill="#9fb6b5" stroke="none" font-size="7" font-weight="600" text-anchor="middle">' + (line2 || 'down the top flight') + '</text>';
  }

  function straightPlan(c) {
    var vbH = 140;
    var rectW = Math.max(26, Math.min(84, state.width / 1400 * 84));
    var rectH = 92, rectX = 100 - rectW / 2, rectY = 16;
    var rungs = '';
    for (var i = 1; i < c.risers; i++) {
      var y = rectY + (i / c.risers) * rectH;
      rungs += '<path d="M' + rectX.toFixed(1) + ' ' + y.toFixed(1) + 'h' + rectW.toFixed(1) + '"/>';
    }
    var out = '<rect x="' + rectX.toFixed(1) + '" y="' + rectY + '" width="' + rectW.toFixed(1) + '" height="' + rectH + '"/>' + rungs +
      '<path d="M100 ' + (rectY + rectH - 2) + 'V' + (rectY + 2) + '" stroke-dasharray="3 3" opacity=".55"/>';
    var overshoot = state.avail ? c.run - state.avail : 0;
    if (overshoot > 0) {
      var availY = rectY + Math.min(1, state.avail / c.run) * rectH;
      out += '<path d="M' + (rectX - 8).toFixed(1) + ' ' + availY.toFixed(1) + 'h' + (rectW + 16).toFixed(1) + '" stroke="#e8672c" stroke-width="1.6" stroke-dasharray="4 3"/>' +
        '<text x="' + (rectX + rectW + 10).toFixed(1) + '" y="' + (availY + 3).toFixed(1) + '" fill="#e8672c" stroke="none" font-size="8" font-weight="600">avail</text>';
    }
    out += dimH(rectX, rectX + rectW, vbH - 9, Math.round(state.width) + 'mm wide');
    out += dimV(rectY, rectY + rectH, rectX - 11, Math.round(c.run) + 'mm run');
    return out;
  }

  /* Straight-flight side elevation (unchanged). */
  function elevation(g) {
    var vbW = 300, vbH = 170, padL = 34, padR = 16, padT = 16, padB = 30;
    var k = Math.min((vbW - padL - padR) / g.run, (vbH - padT - padB) / state.height);
    var x = padL, y = vbH - padB, d = 'M' + x + ' ' + y;
    for (var i = 0; i < g.risers; i++) {
      var gy = g.riserHeight * k;
      d += ' v-' + gy.toFixed(1);
      y -= gy;
      if (i < g.treads) { var gx = GOING * k; d += ' h' + gx.toFixed(1); x += gx; }
    }
    var runW = g.run * k, riseH = state.height * k;
    return '<path d="M' + padL + ' ' + (vbH - padB) + 'h' + runW.toFixed(1) + 'M' + padL + ' ' + (vbH - padB) + 'V' + padT + '" stroke="#fff" stroke-width="1.1" stroke-dasharray="3 3" fill="none" opacity=".45"/>' +
      '<path d="' + d + '" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      dimH(padL, padL + runW, vbH - 10, Math.round(g.run) + 'mm run') +
      dimV(vbH - padB - riseH, vbH - padB, padL - 13, state.height + 'mm rise');
  }

  /* ---------- turn pricing (same rules as the internal engine) ---------- */
  function landingSizePick() {
    var sizes = P.landingSizesFor(state.shape) || [];
    if (!sizes.length) return P.landingSizeForShape('l');
    if (state.shape !== 'u') return sizes[0];
    if (state.uLanding === 'split') {
      for (var i = 0; i < sizes.length; i++) if (P.landingMaxQty(sizes[i].id) >= 2) return sizes[i];
      return sizes[0];
    }
    var sc = shapeCalc(calcStairs());
    var across = sc ? Math.round(sc.bbW) : 0, depth = sc ? Math.round(sc.LD) : 0;
    var want = [Math.max(across, depth), Math.min(across, depth)], best = null, bestArea = Infinity, big = null, bigArea = -1;
    sizes.forEach(function (s) {
      var d = ((s.label || '').match(/\d+/g) || []).map(Number);
      if (d.length < 2) return;
      var have = [Math.max(d[0], d[1]), Math.min(d[0], d[1])], area = d[0] * d[1];
      if (area > bigArea) { bigArea = area; big = s; }
      if (have[0] >= want[0] && have[1] >= want[1] && area < bestArea) { bestArea = area; best = s; }
    });
    return best || big || sizes[0];
  }
  /* On a turn the landing or winder treads are levels of their own, so the frame is
     described as flight treads plus the turn. */
  function stepWord(c, sc) {
    if (!sc) return c.treads + ' steps';
    var treads = sc.timberTreads - (sc.winders ? sc.winders : 0);
    var parts = [];
    if (sc.winders) parts.push(sc.winders + ' winders');
    else if (sc.uSplit) {
      /* Each half of the turn is counted for what it is, so a mixed turn reads
         "12 steps + 2 winders + 1 quarter landing". */
      var wedges = 0, lands = 0;
      uHalves().forEach(function (hh) {
        if (hh === 'landing') lands++; else wedges += halfRisers(hh);
      });
      if (wedges) parts.push(wedges + ' winders');
      if (lands) parts.push(lands + ' quarter landing' + (lands > 1 ? 's' : ''));
    } else {
      var n = state.shape === 'l' ? (Number(state.landings) || 1) : 1;
      parts.push(n + ' landing' + (n > 1 ? 's' : ''));
    }
    return [treads + ' steps'].concat(parts).join(' + ');
  }
  function landingQuote() {
    if (state.shape === 'straight' || state.turnMethod !== 'landing') return null;
    var sz = landingSizePick();
    if (!sz) return null;
    var want = state.shape === 'l' ? (Number(state.landings) || 1) : (uQuarters() ? uLandingHalves() : 1);
    if (!want) return null;
    var n = Math.max(1, Math.min(P.landingMaxQty(sz.id), want));
    var q = P.landing(sz.id, n);
    q.label = sz.label; q.qty = n;
    return q;
  }
  /* The timber top covers the steel landing panel being charged for, so it is sized off
     that panel — the same pairing the internal calculator prices. */
  function landingPanelDims() {
    var sz = landingSizePick();
    var d = ((sz && sz.label || '').match(/\d+/g) || []).map(Number);
    if (d.length < 2) return null;
    return { width: Math.max(d[0], d[1]), depth: Math.min(d[0], d[1]) };
  }
  function timberLandingQuote() {
    if (state.shape === 'straight' || state.treads !== 'timber') return null;
    var g = P.timberLandingGradeForSpecies(state.species);
    if (!g) return null;
    var sc = shapeCalc(calcStairs());
    if (!sc) return null;
    /* Polish is charged on the turn tops as well as the treads whenever the customer
       chooses a polished finish. */
    var pol = state.treadFinish === 'polished';
    if (state.turnMethod === 'winders') return P.timberLanding(g.id, { wedges: sc.winders, count: 1, polish: pol });
    if (uQuarters()) {
      /* Each half is priced on its own: landing tops by size, winder halves by wedge. */
      var parts = [], sum = 0, wedges = 0, lcount = uLandingHalves(), polSum = 0;
      uWinderHalves().forEach(function (hh) {
        var q = P.timberLanding(g.id, { wedges: halfRisers(hh), count: 1, polish: pol });
        if (q) { sum += q.total || 0; polSum += q.polish || 0; wedges += halfRisers(hh); parts.push(q); }
      });
      if (lcount) {
        var pd2 = landingPanelDims() || { width: Math.round(sc.W || 0), depth: Math.round(sc.LD || 0) };
        var lq2 = P.timberLanding(g.id, { width: pd2.width, depth: pd2.depth, count: lcount, polish: pol });
        if (lq2) { sum += lq2.total || 0; polSum += lq2.polish || 0; parts.push(lq2); }
      }
      if (!parts.length) return null;
      var wLabels = uWinderHalves().map(function (hh) { return halfRisers(hh) + '-wedge turn'; });
      return { total: sum, polish: polSum, kind: wedges && lcount ? 'mixed' : (wedges ? 'winder' : 'landing'),
        wedges: wedges, count: lcount, grade: parts[0].grade, halves: wLabels.length ? wLabels : null,
        sizeLabel: lcount ? (parts[parts.length - 1].label || '') : '',
        label: wLabels.length ? wLabels.join(' + ') : (parts[0].label || '') };
    }
    var n = state.shape === 'l'
      ? Math.max(1, Math.min(P.landingMaxQty((P.landingSizeForShape('l') || {}).id), Number(state.landings) || 1))
      : (sc.uSplit ? uLandingHalves() : 1);
    if (!n) return null;
    var pd = landingPanelDims() ||
      { width: Math.round(state.shape === 'u' && !sc.uSplit ? sc.bbW : sc.W || 0), depth: Math.round(sc.LD || 0) };
    return P.timberLanding(g.id, { width: pd.width, depth: pd.depth, count: n, polish: pol });
  }
  function winderQuote() {
    if (state.shape === 'straight') return null;
    if (uQuarters()) {
      var hs = uWinderHalves();
      if (!hs.length) return null;
      var sell = 0, poa = false;
      hs.forEach(function (hh) {
        var q = P.winder(halfRisers(hh), { turns: 1 });
        if (!q || q.poa) poa = true; else sell += q.sell;
      });
      return { sell: sell, poa: poa, turns: hs.length };
    }
    if (state.turnMethod !== 'winders') return null;
    var sc = shapeCalc(calcStairs());
    if (!sc) return null;
    return P.winder(sc.winders, { turns: 1 });
  }
  /* Plain words for whatever the turn happens to be. */
  function halfWord(h) { return h === 'landing' ? 'quarter landing' : (h === 'w3' ? '3 winders' : '2 winders'); }
  function turnWord(sc) {
    if (sc && sc.winders) return sc.winders + ' winders';
    if (uQuarters()) {
      var hs = uHalves();
      if (hs[0] === hs[1]) return hs[0] === 'landing' ? 'two quarter landings' : halfWord(hs[0]) + ' each side';
      return halfWord(hs[0]) + ' and ' + halfWord(hs[1]);
    }
    return 'landing';
  }

  function shapePriced() {
    if (state.shape === 'straight') return true;
    var w = winderQuote();
    if (uQuarters()) return !(w && w.poa) && (!uLandingHalves() || !!landingQuote());
    if (state.turnMethod === 'winders') return !!(w && !w.poa);
    return !!landingQuote();
  }

  /* Extra landings need their own depth/width — grey out counts the space can't take. */
  function landingSpace() {
    var old = state.landings; state.landings = 1;
    var f = fitL(state.risers); state.landings = old;
    return { freeD: (f.availD || 0) - f.reqD, freeX: (f.availX || 0) - f.reqX, nom: nominalLandingSize(), g: f.g, avail: !!(f.availD && f.availX) };
  }
  function landingsShort(n) {
    var s = landingSpace(), ex = Math.max(0, Math.min(2, n - 1));
    var each = Math.max(0, s.nom - s.g);
    return { shortD: Math.round(Math.max(0, (ex >= 1 ? each : 0) - s.freeD)), shortX: Math.round(Math.max(0, (ex >= 2 ? each : 0) - s.freeX)), avail: s.avail };
  }
  function landingsAllowed(n) {
    if (state.shape !== 'l' || state.turnMethod === 'winders' || n <= 1) return true;
    var t = landingsShort(n);
    return !(t.avail && (t.shortD > 0 || t.shortX > 0));
  }

  /* ---------- prices ---------- */
  /* Price rows are read by step count (treads), matching the back end. */
  function framePrice(c) {
    var i = idx(c.treads);
    var n = SP.base[i] + (SP.finish[state.finish] || SP.finish.primed)[i];
    var q = landingQuote(), w = winderQuote();
    return n + (q ? q.sell : 0) + (w ? w.sell : 0);
  }
  /* Winder treads are charged as timber wedges in the turn line, so they are not counted
     again in the flight treads. */
  function treadQty(c) {
    var s = shapeCalc(c);
    if (!s) return Math.max(1, c.treads);
    return Math.max(1, s.timberTreads - (s.winders ? s.winders : 0));
  }
  function treadPrice(c) {
    if (state.treads === 'none' || !state.species) return { total: 0, poa: false, unit: 0 };
    var sp = SP.treads[state.species];
    if (!sp) return { total: 0, poa: true, unit: 0 };
    var steps = treadQty(c), base = 0, poa = false;
    if (sp.mode === 'metre') {
      var wmm = Number(state.width) || 0, isB = /^redOakB/.test(state.species);
      if (!isB && wmm < TREAD_MAX_W) wmm = TREAD_MAX_W;
      if (isB && wmm < 1000) wmm = 1000;
      base = Math.round((sp.rate || 0) * (wmm / 1000) * steps);
      poa = !sp.rate;
    } else if (sp.mode === 'widthBands') {
      var band = null, bands = sp.bands || [];
      for (var b = 0; b < bands.length; b++) {
        if (state.width <= Number(bands[b].maxW) && (!band || Number(bands[b].maxW) < Number(band.maxW))) band = bands[b];
      }
      var each = band ? Math.round(Number(band.each) || 0) : 0;
      base = each * steps; poa = !each;
    } else {
      base = (sp.steps || [])[idx(steps)] || 0;
      poa = !base;
    }
    var pol = 0;
    if (state.treadFinish === 'polished') pol = SP.treadFinish.polished[idx(steps)] || 0;
    if (state.treadFinish === 'stained') pol = SP.treadFinish.stained[idx(steps)] || 0;
    base += pol;
    return { total: base, polish: pol, poa: poa, unit: Math.round(base / steps), steps: steps, maxW: Math.min(sp.maxW || TREAD_MAX_W, TREAD_MAX_W) };
  }

  var FINISH_LABEL = { primed: 'Etch primed', painted: 'Painted', galvanised: 'Galvanised', galvpaint: 'Galvanised and painted' };
  var COLOUR_LABEL = { black: 'Matt black', white: 'Satin white' };
  var TF_LABEL = { raw: 'Raw / unfinished', polished: 'Polished', stained: 'Stained' };
  var SHAPE_LABEL = { straight: 'Straight', l: 'L-shape (90° turn)', u: 'U-shape (180° turn)' };

  /* The public page offers four timbers only. The back end keeps the full list. */
  var PUBLIC_TREADS = [
    { id: 'tassieVic42', family: 'Tassie Oak' },
    { id: 'amerOak42', family: 'American Oak' },
    { id: 'amerOak65', family: 'American Oak' },
    { id: 'merbau42_m', family: 'Merbau' },
    { id: 'merbau66_m', family: 'Merbau' }
  ].filter(function (o) { return SP.treads[o.id]; });
  function publicFamily(id) {
    for (var i = 0; i < PUBLIC_TREADS.length; i++) if (PUBLIC_TREADS[i].id === id) return PUBLIC_TREADS[i].family;
    return (SP.treads[id] || {}).label || id;
  }
  function speciesOptions() {
    var byFamily = {};
    PUBLIC_TREADS.forEach(function (o) {
      (byFamily[o.family] = byFamily[o.family] || []).push({ id: o.id, sp: SP.treads[o.id] });
    });
    return byFamily;
  }
  function speciesLabel(id) {
    var sp = SP.treads[id] || {};
    var l = publicFamily(id);
    if (sp.thick && l.indexOf(sp.thick + 'mm') < 0) l += ' · ' + sp.thick + 'mm';
    return l;
  }
  /* One photo per thickness, so 42mm and 65mm show the boards they actually are. */
  var SPECIES_IMG = { amerOak42: 'assets/amer-oak-42.png', amerOak65: 'https://cdn.prod.website-files.com/67becbfecbf559dfc99e4932/6a9a67dac163d5584771097a_img11.jpg',
    tassieVic42: 'https://cdn.prod.website-files.com/67becbfecbf559dfc99e4932/6a9a67ed96bb2c7ac030a87e_img04.jpg', merbau42_m: 'https://cdn.prod.website-files.com/67becbfecbf559dfc99e4932/6a9a680f833d25a03551d811_merbau-42-tread.png', merbau66_m: 'assets/merbau-42-tread.png' };
  function fillSpeciesCards() {
    var wrap = $('#c-species-cards');
    if (!wrap || wrap.dataset.filled) return;
    wrap.innerHTML = PUBLIC_TREADS.map(function (o) {
      var fam = publicFamily(o.id), th = (SP.treads[o.id] || {}).thick;
      return '<div class="spc opt-species" data-val="' + o.id + '">' +
        '<span class="spc__img"><img src="' + (SPECIES_IMG[o.id] || '') + '" alt="' + fam + ' timber tread"></span>' +
        '<span class="spc__t"><b>' + fam + '</b><em>' + (th ? th + 'mm thick' : '') + '</em></span></div>';
    }).join('');
    wrap.dataset.filled = '1';
    $$('.opt-species').forEach(function (el) {
      el.onclick = function () { state.species = el.dataset.val; ans.species = 1; render(); };
    });
  }
  function fillSpecies() {
    var sel = $('#c-species');
    if (!sel || sel.dataset.filled) return;
    sel.innerHTML = '<option value="">Choose your timber</option>' + PUBLIC_TREADS.map(function (o) {
      return '<option value="' + o.id + '">' + speciesLabel(o.id) + '</option>';
    }).join('');
    sel.dataset.filled = '1';
    state.species = state.species || PUBLIC_TREADS[0].id;
  }
  function renderThickness() {
    var row = $('#c-thickness');
    var sp = SP.treads[state.species];
    if (!sp) { row.innerHTML = ''; return; }
    var sibs = speciesOptions()[publicFamily(state.species)] || [];
    row.innerHTML = sibs.map(function (o) {
      return '<button type="button" class="chip' + (o.id === state.species ? ' is-sel' : '') + '" data-id="' + o.id + '">' +
        (o.sp.thick ? o.sp.thick + 'mm' : 'Steel') + (o.sp.size ? '<span>' + o.sp.size + '</span>' : '') + '</button>';
    }).join('');
    row.style.display = sibs.length > 1 ? '' : 'none';
    [].forEach.call(row.querySelectorAll('.chip'), function (el) {
      el.onclick = function () { state.species = el.dataset.id; render(); };
    });
  }

  function paintLandingOptions() {
    [2, 3].forEach(function (n) {
      var el = document.querySelector('.opt-lqty[data-val="' + n + '"]');
      if (!el) return;
      var t = landingsShort(n), ok = landingsAllowed(n);
      el.classList.toggle('is-off', !ok);
      el.style.opacity = ok ? '' : '.45';
      var hint = el.querySelector('em');
      if (hint) hint.textContent = ok ? '' : ('needs ' + Math.max(t.shortD, t.shortX) + 'mm more');
    });
  }

  /* Nothing is priced until we have a height and a width. */
  function renderEmpty() {
    ['#c-risers', '#c-riser-h', '#c-going', '#c-treadcount', '#c-run', '#c-pitch'].forEach(function (id) { $(id).textContent = '—'; });
    $('#c-elev').innerHTML = '';
    $('#c-elev-cap').textContent = 'Enter your floor to floor height to see the staircase';
    $('#c-plan-card').style.display = '';
    $('#c-plan').innerHTML = planPrompt('start with your', 'floor to floor height');
    $('#c-plan-cap').textContent = 'Waiting on your measurements';
    $('#c-warn').style.display = 'none';
    $('#c-kit').innerHTML = '';
    var m0 = missingAnswers();
    lockPrice(m0.length ? m0 : ['your measurements']);
    $('#c-line-frame').textContent = '—';
    $('#c-line-treads').textContent = '—';
    var pr0 = $('#c-line-polish-row'); if (pr0) pr0.style.display = 'none';
    $('#f-summary').value = '';
    var isTurn = ans.shape && state.shape !== 'straight';
    $$('.opt-shape').forEach(function (el) { el.classList.toggle('is-sel', !!ans.shape && el.dataset.val === state.shape); });
    /* Same gating as the full render, so nothing looks chosen before it has been. */
    $$('.opt-turn').forEach(function (el) { el.classList.toggle('is-sel', !!ans.turn && el.dataset.val === state.turnMethod); });
    $$('.opt-uland').forEach(function (el) { el.classList.toggle('is-sel', !!ans.uland && el.dataset.val === state.uLanding); });
    $$('.opt-ulower').forEach(function (el) { el.classList.toggle('is-sel', !!ans.ulower && el.dataset.val === state.uLower); });
    $$('.opt-uupper').forEach(function (el) { el.classList.toggle('is-sel', !!ans.uupper && el.dataset.val === state.uUpper); });
    $$('.opt-dir').forEach(function (el) { el.classList.toggle('is-sel', !!ans.dir && el.dataset.val === state.turnSide); });
    $$('.opt-finish').forEach(function (el) { el.classList.toggle('is-sel', !!ans.finish && el.dataset.val === state.finish); });
    $$('.opt-colour').forEach(function (el) { el.classList.toggle('is-sel', !!ans.colour && el.dataset.val === state.colour); });
    $$('.opt-treads').forEach(function (el) { el.classList.toggle('is-sel', !!ans.treads && el.dataset.val === state.treads); });
    $$('.opt-tf').forEach(function (el) { el.classList.toggle('is-sel', !!ans.tf && el.dataset.val === state.treadFinish); });
    var cg0 = $('#fg-colour'); if (cg0) cg0.style.display = (ans.finish && state.finish === 'painted') ? '' : 'none';
    var td0 = $('#c-tread-detail'); if (td0) td0.style.display = (ans.treads && state.treads === 'timber') ? '' : 'none';
    $('#c-turn').style.display = isTurn ? '' : 'none';
    $('#fg-avail2').style.display = isTurn ? '' : 'none';
  }

  /* A straight flight is easier to read on a straight-stair photo, so the height guide
     follows the shape the customer picked. */
  function syncHeightPhoto() {
    var straight = ans.shape && state.shape === 'straight';
    var img = $('#height-photo');
    if (!img) return;
    var want = straight ? 'https://cdn.prod.website-files.com/67becbfecbf559dfc99e4932/6a9a69ebcc2393f510b3801a_height-measure.jpg'
      : (state.shape === 'u' ? 'https://cdn.prod.website-files.com/67becbfecbf559dfc99e4932/6a9e301e06537b1ec267ea6a_height-measure-u.jpg' : 'https://cdn.prod.website-files.com/67becbfecbf559dfc99e4932/6a9a69ebcc2393f510b3801a_height-measure.jpg');
    if (img.getAttribute('src') !== want) img.setAttribute('src', want);
  }

  function render() {
    if (state.treads === 'timber') { fillSpecies(); fillSpeciesCards(); }
    syncHeightPhoto();
    /* Turn direction and the shape of each half are already drawn on the plan from the
       measurements, so they come pre-set as soon as the numbers are in — the customer can
       still change any of them. */
    if (state.height && state.width) { ans.dir = ans.dir || 1; ans.uland = ans.uland || 1; ans.ulower = ans.ulower || 1; ans.uupper = ans.uupper || 1; }
    if (!state.height || !state.width) { renderEmpty(); return; }
    var c = calcStairs();
    if (state.split != null) {
      var capSplit = Math.max(1, c.risers - 2);
      state.split = Math.min(capSplit, Math.max(splitFloor(capSplit), Math.round(state.split)));
    }
    var isTurn = ans.shape && state.shape !== 'straight';
    var wind = state.turnMethod === 'winders';
    if (isTurn && !wind) { while (state.landings > 1 && !landingsAllowed(Number(state.landings))) state.landings = Number(state.landings) - 1; }
    var sc = shapeCalc(c);
    var frame = framePrice(c);
    var tp = treadPrice(c);
    var tl = timberLandingQuote();
    var tlTotal = tl ? tl.total : 0;
    var total = frame + tp.total + tlTotal;

    $('#c-risers').textContent = c.risers;
    $('#c-riser-h').textContent = Math.round(c.riserHeight) + 'mm';
    $('#c-going').textContent = (sc ? sc.g : c.going) + 'mm';
    $('#c-treadcount').textContent = c.treads;
    $('#c-run').textContent = sc
      ? (Math.round(sc.bbH) + ' × ' + Math.round(sc.bbW) + 'mm')
      : (c.run / 1000).toFixed(2) + 'm';
    $('#c-pitch').textContent = Math.round(c.pitch) + '°';

    var elev = $('#c-elev');
    elev.setAttribute('viewBox', sc ? '0 0 200 140' : '0 0 300 170');
    elev.innerHTML = sc ? (sc.shape === 'l' ? shapeElevL(sc, c) : shapeElev(sc, c)) : elevation(c);
    $('#c-viz-title').textContent = sc ? (sc.shape === 'l' ? 'Section — top flight' : 'Section through the turn') : 'Side elevation';
    $('#c-elev-cap').textContent = sc
      ? state.height + 'mm rise · ' + c.risers + ' risers · ' + sc.tA + (sc.tA === 1 ? ' tread to the ' : ' treads to the ') + turnWord(sc) + ' · ' + sc.tB + ' after it'
      : state.height + 'mm rise · ' + c.risers + ' risers · ' + Math.round(c.pitch) + '°';

    $('#c-plan-card').style.display = '';
    var needDepth = isTurn && !(Number(state.avail) > 0);
    $('#c-plan').innerHTML = needDepth ? planPrompt() : (sc ? shapePlan(sc) : straightPlan(c));
    var landEl2 = $('#c-landing');
    if (landEl2 && !state.landingTouched && sc && state.turnMethod === 'landing') landEl2.placeholder = Math.round(sc.LD || 0);
    var av1 = Number(state.avail) || 0, av2 = isTurn ? (Number(state.avail2) || 0) : 0;
    var spaceCap = av1 && av2 ? ' · your space ' + Math.round(av2) + ' × ' + Math.round(av1) + 'mm'
      : av2 ? ' · your space ' + Math.round(av2) + 'mm across'
      : av1 ? ' · your space ' + Math.round(av1) + 'mm deep' : '';
    /* On a U the depth only governs the top flight; the bottom flight is free to run on
       into the room, so it is reported as a run-on, not as being over the space. */
    var depthRef = (sc && sc.shape === 'u' && sc.topDepth) ? sc.topDepth : (sc ? sc.bbH : 0);
    var overW = sc && av2 ? sc.bbW - av2 : 0, overD = sc && av1 ? depthRef - av1 : 0;
    var botRunOn = (sc && sc.shape === 'u' && av1) ? sc.bbH - av1 : 0;
    if (overW > 0.5) spaceCap += ' · ' + Math.round(overW) + 'mm over your width';
    if (overD > 0.5) spaceCap += ' · ' + Math.round(overD) + 'mm over your depth';
    else if (botRunOn > 0.5) spaceCap += ' · bottom flight runs ' + Math.round(botRunOn) + 'mm past it';
    $('#c-plan-cap').textContent = needDepth
      ? 'Add your available depth and we will set the staircase out in your space'
      : (sc
        ? Math.round(sc.bbH) + ' × ' + Math.round(sc.bbW) + 'mm footprint' + spaceCap + ' · ' + turnWord(sc) + ' · turns ' + state.turnSide + (sc.ghostB ? ' · width still to come' : '')
        : state.width + 'mm wide · ' + Math.round(c.run) + 'mm run' + spaceCap);

    $$('.opt-shape').forEach(function (el) { el.classList.toggle('is-sel', !!ans.shape && el.dataset.val === state.shape); });
    $$('.opt-turn').forEach(function (el) { el.classList.toggle('is-sel', !!ans.turn && el.dataset.val === state.turnMethod); });
    $$('.opt-uland').forEach(function (el) { el.classList.toggle('is-sel', !!ans.uland && el.dataset.val === state.uLanding); });
    $$('.opt-ulower').forEach(function (el) { el.classList.toggle('is-sel', !!ans.ulower && el.dataset.val === state.uLower); });
    $$('.opt-uupper').forEach(function (el) { el.classList.toggle('is-sel', !!ans.uupper && el.dataset.val === state.uUpper); });
    $$('.opt-wedges').forEach(function (el) { el.classList.toggle('is-sel', Number(el.dataset.val) === Number(state.winders)); });
    $$('.opt-dir').forEach(function (el) { el.classList.toggle('is-sel', !!ans.dir && el.dataset.val === state.turnSide); });
    $$('.opt-lqty').forEach(function (el) { el.classList.toggle('is-sel', Number(el.dataset.val) === Number(state.landings)); });
    $$('.opt-finish').forEach(function (el) { el.classList.toggle('is-sel', !!ans.finish && el.dataset.val === state.finish); });
    $$('.opt-colour').forEach(function (el) { el.classList.toggle('is-sel', !!ans.colour && el.dataset.val === state.colour); });
    var cg = $('#fg-colour'); if (cg) cg.style.display = (ans.finish && state.finish === 'painted') ? '' : 'none';
    $$('.opt-treads').forEach(function (el) { el.classList.toggle('is-sel', !!ans.treads && el.dataset.val === state.treads); });
    $$('.opt-tf').forEach(function (el) { el.classList.toggle('is-sel', !!ans.tf && el.dataset.val === state.treadFinish); });

    $('#c-turn').style.display = isTurn ? '' : 'none';
    $('#fg-avail2').style.display = isTurn ? '' : 'none';
    $('#lbl-avail').textContent = isTurn
      ? 'Available depth — down the top flight'
      : 'Floor space available for the staircase to land in';
    $('#c-avail').placeholder = isTurn ? 'e.g. 3000' : 'optional';
    var av2El = $('#c-avail2'); if (av2El) av2El.placeholder = 'e.g. 2500';
    var isU = state.shape === 'u';
    if (isU && state.turnMethod !== 'landing') state.turnMethod = 'landing';
    $('#fg-turnmethod').style.display = isU ? 'none' : '';
    $('#fg-uland').style.display = isU ? '' : 'none';
    $('#fg-uturns').style.display = (isU && state.uLanding === 'split') ? '' : 'none';
    $('#fg-lqty').style.display = (state.shape === 'l' && !wind) ? '' : 'none';
    $('#fg-landingsize').style.display = (isTurn && !wind && !(isU && uQuarters() && !uLandingHalves())) ? '' : 'none';
    $('#fg-winders').style.display = (isTurn && wind) ? '' : 'none';
    $('#fg-width2').style.display = (state.shape === 'l') ? '' : 'none';
    $('#fg-gap').style.display = (state.shape === 'u') ? '' : 'none';
    $('#lbl-avail2').textContent = state.shape === 'u'
      ? 'Total opening width (both flights side by side)'
      : 'Available width — across the bottom flight';
    if (state.shape === 'l' && !wind) paintLandingOptions();
    var rEl = $('#c-risers-in');
    rEl.placeholder = 'auto (' + (bestRisers(state.height) - 1) + ')';
    rEl.max = maxRisers() - 1;
    if (rEl !== document.activeElement) rEl.value = state.risersManual == null ? '' : c.treads;
    var autoEl = $('#r-auto');
    if (autoEl) autoEl.style.display = state.risersManual == null ? 'none' : '';
    var rn = $('#riser-note');
    if (c.meets) {
      rn.className = 'f-hint';
      rn.removeAttribute('style');
      rn.style.marginTop = '7px';
      rn.textContent = c.treads + ' steps · ' + c.risers + ' risers at ' + Math.round(c.riserHeight) + 'mm each, ' + Math.round(c.pitch) + '° pitch — inside Australian Standards.';
    } else {
      rn.className = '';
      rn.setAttribute('style', 'margin-top:12px;display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;padding:16px 18px;border-radius:12px;background:#fdece4;border:2px solid #e8672c;color:#7c2d12');
      rn.innerHTML = '<span style="font-size:22px;line-height:1">\u26a0</span><span>' +
        '<b style="display:block;font-family:var(--display);font-size:17px;margin-bottom:4px">Outside Australian Standards — this staircase is not compliant</b>' +
        c.treads + ' steps (' + c.risers + ' risers) over ' + state.height + 'mm gives a ' + Math.round(c.riserHeight) + 'mm rise at ' + Math.round(c.pitch) + '°, ' +
        (c.riserHeight > RISER_MAX ? 'steeper' : 'shallower') + ' than the ' + RISER_MIN + '–' + Math.round(RISER_MAX) + 'mm range. ' +
        (state.risersManual != null ? 'Go back to ' + (bestRisers(state.height) - 1) + ' steps to comply.' : 'Send it through and we will work it out with you.') +
        '</span>';
    }
    if (sc) {
      var splitEl = $('#c-split');
      var maxSplit = (sc.fit ? sc.fit.need : sc.flightRisers) - 1;
      if (state.split != null) state.split = Math.min(maxSplit, Math.max(splitFloor(maxSplit), Math.round(state.split)));
      /* Show the split that is actually drawn — the flights can only hold so many, so a
         typed number past that would otherwise sit in the field looking accepted. */
      if (state.split != null) {
        var drawnA = sc.fit ? sc.fit.nA : sc.rA;
        if (drawnA >= 1) state.split = Math.round(drawnA);
      }
      splitEl.placeholder = 'auto (' + (sc.fit ? sc.fit.autoA : sc.auto) + ')';
      splitEl.max = maxSplit;
      if (splitEl !== document.activeElement) splitEl.value = state.split == null ? '' : state.split;
      var sFloor = splitFloor(maxSplit);
      splitEl.min = sFloor;
      $('#split-note').textContent = sc.tA + (sc.tA === 1 ? ' tread' : ' treads') + ' up to the ' + turnWord(sc) +
        ', then ' + sc.tB + ' after it. Leave it blank and we ' +
        (state.shape === 'u' ? 'set the return flight to finish on the slab.'
          : (Number(state.avail) > 0
            ? 'run the top flight down to the slab and set the landing from what is left.' +
              (sFloor > 1 && sc.tA <= sFloor ? '' : ' Type a lower number to move steps onto the top flight, or set the landing depth yourself beside it.')
            : 'split the flights evenly.')) +
        (sFloor > 1 && sc.tA <= sFloor
          ? ' This is as few as it goes: the landing is already at its ' + LAND_FILL_MAX +
            'mm limit, and any fewer steps would leave the staircase short of your ' + state.avail + 'mm.'
          : '');
    }

    var wantTreads = state.treads === 'timber';
    $('#c-tread-detail').style.display = (ans.treads && wantTreads) ? '' : 'none';
    if (wantTreads) $('#c-species').value = ans.species ? state.species : '';
    $$('.opt-species').forEach(function (el) { el.classList.toggle('is-sel', !!ans.species && el.dataset.val === state.species); });

    /* warnings — same rules as the internal engine */
    var warn = [];
    if (!c.meets) {
      warn.push('<b>Outside Australian Standards:</b> ' + c.treads + ' steps over ' + state.height + 'mm gives a ' + Math.round(c.riserHeight) +
        'mm rise, ' + (c.riserHeight > RISER_MAX ? 'steeper' : 'shallower') + ' than the ' + RISER_MIN + '–' + Math.round(RISER_MAX) +
        'mm range. ' + (state.risersManual != null ? 'Try ' + (bestRisers(state.height) - 1) + ' steps, or send it through and we will work it out with you.' : 'Send it through and we will work it out with you.'));
    }
    var fitWarned = false;
    if (sc && sc.fit) {
      var f = sc.fit, msgs = [];
      if (!f.fits && !f.open) msgs.push('all ' + f.need + ' treads are drawn at the standard ' + GOING + 'mm going, but they do not fit the space you have given us');
      if (f.availD && f.depth > f.availD + 0.5) msgs.push('it runs ' + Math.round(f.depth - f.availD) + 'mm past your depth (needs ' + Math.round(f.depth) + 'mm, you have ' + f.availD + 'mm)');
      if (f.availX && f.across > f.availX + 0.5) msgs.push('it runs ' + Math.round(f.across - f.availX) + 'mm past your width (needs ' + Math.round(f.across) + 'mm, you have ' + f.availX + 'mm)');
      fitWarned = msgs.length > 0;
      if (msgs.length) warn.push('<b>Doesn\u2019t fit:</b> ' + msgs.join('. Also, ') + '. Options are a taller riser (fewer steps), winders instead of a landing, or more space — add a note in the form and our team will work it through with you.');
    } else if (sc) {
      /* Quote the footprint the plan draws, so the numbers on the drawing and in the
         warning are the same. */
      var fitA = (sc.shape === 'u' && sc.topDepth) ? sc.topDepth : sc.bbH;
      var overA = state.avail ? fitA - state.avail : 0;
      var secondNeed = sc.bbW, overB = state.avail2 ? secondNeed - state.avail2 : 0;
      if (overA > 0 || overB > 0) {
        var landingHint = (overA > 0 && state.landingTouched && Number(state.landingSize) > LAND_MIN)
          ? ' Your ' + Math.round(state.landingSize) + 'mm landing is taking up ' +
            Math.round((Number(state.landingSize) / fitA) * 100) + '% of that depth — clear the landing field and we will size it to your space.'
          : '';
        fitWarned = true;
        warn.push('<b>Heads up:</b> ' + [overA > 0 ? ('it needs ' + Math.round(fitA) + 'mm of depth but you have ' + state.avail + 'mm') : '',
          overB > 0 ? (state.shape === 'u'
            ? ('across both flights the staircase measures ' + Math.round(secondNeed) + 'mm but your opening is ' + state.avail2 + 'mm \u2014 ' + Math.round(overB) + 'mm over. Dropping the staircase width to ' + Math.max(700, Math.floor((state.avail2 - (sc.gap || 0)) / 2)) + 'mm per flight brings it inside your opening')
            : ('the staircase measures ' + Math.round(secondNeed) + 'mm across but your opening is ' + state.avail2 + 'mm \u2014 ' + Math.round(overB) + 'mm over')) : ''].filter(Boolean).join(', and ') +
          '. The turn can move earlier or later — add a note in the form and our team will set it out with you.' + landingHint);
      }
      /* A U whose top flight fits but whose bottom flight runs on past the measured depth
         is normal — it just needs clear floor. Say so, and give the ways to shorten it. */
      var botOver = (sc.shape === 'u' && state.avail && sc.botDepth) ? sc.botDepth - state.avail : 0;
      if (overA <= 0 && botOver > 0.5) {
        warn.push('<b>Bottom flight runs on:</b> the top flight sits inside your ' + state.avail +
          'mm, and the bottom flight carries ' + Math.round(botOver) +
          'mm further into the room (' + Math.round(sc.botDepth) + 'mm in total). That is fine if the floor is clear there. ' +
          'If it is not, a split turn (two quarter landings) or winders shortens the bottom flight — or add a note and our team will set it out with you.');
      }
    } else if (state.avail && c.run > state.avail) {
      warn.push('The staircase needs ' + Math.round(c.run) + 'mm of floor space but you have ' + state.avail +
        'mm. Every tread is a standard ' + GOING + 'mm going, so the staircase needs to turn at a landing to fit.');
    }
    /* Where the corner was packed tighter, say so — the bottom flight ends up narrower than
       the top one, and that is a real change to the kit. Held back while the staircase does not
       fit the space at all: the space is the story then, not the corner. */
    if (sc && sc.fit && sc.fit.botNarrow > 0.5 && !fitWarned) {
      var packed = !state.landingTouched && state.split == null && state.avail && Math.abs(sc.fit.depth - state.avail) < 1;
      warn.push('<b>Bottom flight narrowed to ' + Math.round(sc.W2) + 'mm:</b> ' + (packed
        ? 'that lets the corner landing come back to ' + Math.round(sc.LD) +
          'mm and puts one more step on the top flight, so the staircase finishes hard against your ' + state.avail + 'mm.'
        : 'the landing and the bottom flight share the corner, so the flight follows your ' +
          Math.round(sc.LD) + 'mm landing and the corner stays square.') +
        ' If you want the bottom flight kept at ' + Math.round(sc.W) +
        'mm, type it into the second flight width field and we will hold it there.');
    }
    if (isTurn && wind && !shapePriced()) {
      warn.push('<b>That winder turn isn\u2019t priced online.</b> The price below covers the flights and treads. Send the measurements through and our team will price the turn with you.');
    }
    if (wantTreads && tp.maxW && state.width > tp.maxW) {
      warn.push('Timber treads are made to a maximum of ' + tp.maxW + 'mm wide. Choose a narrower staircase, or frame only and supply your own treads.');
    }
    var wEl = $('#c-warn');
    wEl.style.display = warn.length ? '' : 'none';
    wEl.innerHTML = warn.map(function (w) { return '<p>' + w + '</p>'; }).join('') +
      (warn.length ? '<p>Rather talk it through? Call <a href="tel:+61861535353">(08) 6153 5353</a> and we will sort it with you.</p>' : '');

    /* kit list */
    var lq = landingQuote();
    var items = [
      ['Stringers', 'Pair, cut and folded to suit ' + stepWord(c, sc) + ', ready to bolt down'],
      ['Finish', FINISH_LABEL[state.finish] + (state.finish === 'painted' ? ' · ' + COLOUR_LABEL[state.colour] : '')]
    ];
    if (isTurn) {
      var turnRow = wind
        ? ['Winder turn', sc.winders + ' tapered treads, ' + (state.shape === 'l' ? '90°' : '180°') + ', turns ' + state.turnSide]
        : (uQuarters()
          ? ['Turn', turnWord(sc) + ' · ' + Math.round(sc.W) + ' × ' + Math.round(sc.LD) + 'mm per half · turns ' + state.turnSide]
          : ['Steel landing', (lq ? lq.qty : 1) + ' × ' + Math.round(sc.W) + ' × ' + Math.round(sc.LD) + 'mm · turns ' + state.turnSide]);
      items.splice(0, 0, turnRow);
    }
    var sumEl = $('#c-kit-sum');
    if (sumEl) {
      sumEl.textContent = SHAPE_LABEL[state.shape] + ' · ' + stepWord(c, sc) + ' · ' +
        state.width + 'mm wide · ' + Math.round(c.riserHeight) + 'mm rise';
    }
    items.push(['Fixings and top plate', 'All fixings supplied with your kit'], ['Shop drawing', 'Issued for your approval before fabrication']);
    if (wantTreads) {
      var sp = SP.treads[state.species] || {};
      items.push(['Timber treads', tp.steps + ' × ' + speciesLabel(state.species) + ' · ' + TF_LABEL[state.treadFinish]]);
      if (tl && tl.total > 0) {
        /* Sizes shown here are the landing as drawn on the plan, so the kit list and the
           drawing always agree. */
        var drawnLand = Math.round(sc.W) + ' × ' + Math.round(sc.LD) + 'mm';
        items.push([tl.kind === 'winder' ? 'Timber winder treads' : (tl.kind === 'mixed' ? 'Timber turn tops' : 'Timber landing top'),
          tl.halves && tl.halves.length
            ? tl.halves.join(' + ') + (tl.count ? ' + ' + tl.count + ' × ' + drawnLand : '') + ' · ' + tl.grade
            : (tl.kind === 'winder' ? tl.wedges + ' wedges · ' + tl.grade : tl.count + ' × ' + drawnLand + ' · ' + tl.grade)]);
      }
    } else {
      items.push(['Treads', 'Not included — frame only']);
    }
    items.push(['Delivery', 'Quoted once we have your measurements and address']);
    $('#c-kit').innerHTML = items.map(function (r) { return '<li><span>' + r[0] + '</span><b>' + r[1] + '</b></li>'; }).join('');

    var miss = missingAnswers();
    if (miss.length) { lockPrice(miss); return; }
    unlockPrice();

    var poa = (wantTreads && tp.poa) || (tl && tl.poa);
    $('#c-price').textContent = poa ? 'Quote' : money(total);
    $('#c-price-sub').textContent = poa
      ? 'DIY kit price on application for that selection'
      : 'DIY kit, ex GST, delivery not included · ' + money(total * (1 + SP.gst / 100)) + ' inc GST';
    $('#c-line-frame').textContent = money(frame);
    /* Timber landing tops and winder wedges sit with the treads, so the two visible lines
       add up to the total. */
    var polTotal = (wantTreads ? (tp.polish || 0) : 0) + (wantTreads && tl ? (tl.polish || 0) : 0);
    var treadTotal = tp.total + (wantTreads ? tlTotal : 0) - polTotal;
    $('#c-line-treads-lbl').textContent = (wantTreads && tlTotal)
      ? (tl.kind === 'winder' ? 'Timber treads and winder treads'
        : (tl.kind === 'mixed' ? 'Timber treads, landing and winder tops'
          : 'Timber treads and landing top' + (tl.count > 1 ? 's' : '')))
      : 'Timber treads';
    $('#c-line-treads').textContent = wantTreads ? (tp.poa || (tl && tl.poa) ? 'Quote' : money(treadTotal)) : '—';
    var polRow = $('#c-line-polish-row');
    if (polRow) {
      polRow.style.display = polTotal ? '' : 'none';
      $('#c-line-polish-lbl').textContent = 'Polishing · ' + tp.steps + ' treads' +
        (tl && tl.polish ? (tl.kind === 'winder' ? ' and winder treads' : (tl.kind === 'mixed' ? ' and landing and winder tops' : ' and landing top' + (tl.count > 1 ? 's' : ''))) : '');
      $('#c-line-polish').textContent = money(polTotal);
    }

    $('#f-summary').value = summary(c, sc, frame, tp, lq, tl, total, poa);
    /* Send the drawings with the enquiry so the team can check the set-out. */
    $('#f-elev-svg').value = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + $('#c-elev').getAttribute('viewBox') +
      '" fill="none" stroke="#fff" stroke-width="1.4"><rect width="100%" height="100%" fill="#0d4a45" stroke="none"/>' + $('#c-elev').innerHTML + '</svg>';
    $('#f-plan-svg').value = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="none" stroke="#fff" stroke-width="1.4"><rect width="100%" height="100%" fill="#0d4a45" stroke="none"/>' + $('#c-plan').innerHTML + '</svg>';
  }

  function summary(c, sc, frame, tp, lq, tl, total, poa) {
    var sp = SP.treads[state.species] || {};
    var L = [
      'DIY STEEL STAIR KIT — MEASUREMENTS',
      'Floor to floor height: ' + state.height + 'mm',
      'Stair width: ' + state.width + 'mm',
      'Stair shape: ' + SHAPE_LABEL[state.shape]
    ];
    if (sc) {
      L.push('Turns: ' + state.turnSide + ' on ' + turnWord(sc) +
        (uQuarters() ? ' · ' + Math.round(sc.W) + ' × ' + Math.round(sc.LD) + 'mm each side'
          : (state.turnMethod === 'winders' ? '' : ' ' + Math.round(state.shape === 'u' ? sc.bbW : sc.W) + ' × ' + Math.round(sc.LD) + 'mm as drawn')));
      L.push('Flights: ' + sc.tA + ' treads to the turn, ' + sc.tB + ' after it, ' + sc.g + 'mm going');
      L.push('Footprint: ' + Math.round(sc.bbH) + 'mm × ' + Math.round(sc.bbW) + 'mm');
      if (state.shape === 'l') L.push('Second flight width: ' + (state.width2 ? state.width2 + 'mm' : 'auto (' + Math.round(sc.W2) + 'mm)'));
      if (state.shape === 'u') L.push('Gap between flights: ' + sc.gap + 'mm');
      L.push('Space available: ' + (state.avail ? state.avail + 'mm deep' : 'not given') + ' × ' + (state.avail2 ? state.avail2 + 'mm across' : 'not given'));
      if (sc.fit && !sc.fit.fits) L.push('NOTE: does not fit the space given — needs checking');
    } else {
      L.push('Available going: ' + (state.avail ? state.avail + 'mm' : 'not given'));
      L.push('Total run: ' + Math.round(c.run) + 'mm');
    }
    L.push('Steps: ' + stepWord(c, sc) + ' (' + c.risers + ' risers @ ' + Math.round(c.riserHeight) + 'mm)',
      'Going: ' + (sc ? sc.g : c.going) + 'mm · pitch ' + Math.round(c.pitch) + '° · ' + (sc ? sc.timberTreads : c.treads) + ' tread positions',
      'Frame finish: ' + FINISH_LABEL[state.finish] + (state.finish === 'painted' ? ' \u00b7 ' + COLOUR_LABEL[state.colour] : ''),
      'Timber treads: ' + (state.treads === 'timber' ? speciesLabel(state.species) + ' · ' + TF_LABEL[state.treadFinish] : 'none — frame only'));
    if (tl && tl.total > 0) L.push((tl.kind === 'winder' ? 'Timber winder wedges: ' : 'Timber landing top: ') + tl.label + ' · ' + tl.grade + ' · ' + money(tl.total));
    if (state.turnMethod === 'winders' && state.shape !== 'straight') L.push('Winder turn: not priced online — team to quote');
    L.push('Delivery: to be confirmed by the team',
      'Indicative price: ' + (poa ? 'quote required' : money(total) + ' ex GST'));
    return L.join('\n');
  }

  function num(sel, key, min, max) {
    var el = $(sel);
    if (!el) return;
    el.min = min; el.max = max;
    /* A browser that restores a typed value on reload must not leave the state blank. */
    if (el.value !== '') state[key] = Math.max(min, Math.min(max, Number(el.value)));
    el.addEventListener('input', function () {
      /* Never rewrite the box mid-typing — an over-max digit used to snap the whole field
         to the maximum. The value is clamped for the drawing and tidied up on blur. */
      var v = el.value === '' ? null : Number(el.value);
      state[key] = v == null ? null : Math.min(max, v);
      render();
    });
    el.addEventListener('blur', function () {
      if (el.value === '') { state[key] = null; render(); return; }
      var v = Math.max(min, Math.min(max, Number(el.value)));
      el.value = v; state[key] = v; render();
    });
  }

  function boot() {
    if (!window.SP) return;
    num('#c-height', 'height', 1800, 4200);
    num('#c-width', 'width', 700, 1200);
    num('#c-avail', 'avail', 1000, 12000);
    num('#c-avail2', 'avail2', 1000, 12000);
    num('#c-width2', 'width2', 600, 1200);
    var landEl = $('#c-landing');
    if (landEl) {
      var touch = function () { state.landingTouched = landEl.value !== ''; };
      landEl.addEventListener('input', touch, true);
      landEl.addEventListener('blur', touch, true);
    }
    num('#c-landing', 'landingSize', LAND_MIN, LAND_FILL_MAX);
    num('#c-gap', 'gap', 0, 600);
    num('#c-split', 'split', 1, MAX_RISERS * 4);
    var stepsEl = $('#c-risers-in');
    stepsEl.addEventListener('input', function () {
      state.risersManual = stepsEl.value === '' ? null : Math.max(2, Math.min(maxRisers(), Number(stepsEl.value) + 1));
      render();
    });
    function bump(d) {
      if (!state.height) return;
      var cur = state.risersManual == null ? bestRisers(state.height) : state.risersManual;
      state.risersManual = Math.max(2, Math.min(maxRisers(), cur + d));
      render();
    }
    $('#r-up').onclick = function () { bump(1); };
    $('#r-down').onclick = function () { bump(-1); };
    var autoBtn = $('#r-auto');
    if (autoBtn) autoBtn.onclick = function () { state.risersManual = null; stepsEl.value = ''; render(); };
    /* Steps up and down work off the split that is actually drawn, not the stored one, so
       the first press moves one step from where the customer can see it — and it never
       runs past what the flights can hold. */
    function bumpSplit(d) {
      var sc = shapeCalc(calcStairs());
      if (!sc) return;
      var max = Math.max(1, (sc.fit ? sc.fit.need : sc.flightRisers) - 1);
      var floor = splitFloor(max);
      var cur = sc.fit ? sc.fit.nA : sc.rA;
      state.split = Math.min(max, Math.max(floor, Math.round(cur) + d));
      render();
    }
    $('#sp-up').onclick = function () { bumpSplit(1); };
    $('#sp-down').onclick = function () { bumpSplit(-1); };

    $$('.opt-shape').forEach(function (el) { el.onclick = function () { state.shape = el.dataset.val; ans.shape = 1; state.split = null; render(); }; });
    $$('.opt-turn').forEach(function (el) { el.onclick = function () { state.turnMethod = el.dataset.val; ans.turn = 1; state.split = null; render(); }; });
    $$('.opt-uland').forEach(function (el) { el.onclick = function () { state.uLanding = el.dataset.val; ans.uland = 1; state.split = null; render(); }; });
    $$('.opt-ulower').forEach(function (el) { el.onclick = function () { state.uLower = el.dataset.val; ans.ulower = 1; state.split = null; render(); }; });
    $$('.opt-uupper').forEach(function (el) { el.onclick = function () { state.uUpper = el.dataset.val; ans.uupper = 1; state.split = null; render(); }; });
    $$('.opt-wedges').forEach(function (el) { el.onclick = function () { state.winders = Number(el.dataset.val); render(); }; });
    $$('.opt-dir').forEach(function (el) { el.onclick = function () { state.turnSide = el.dataset.val; ans.dir = 1; render(); }; });
    $$('.opt-lqty').forEach(function (el) {
      el.onclick = function () { if (!landingsAllowed(Number(el.dataset.val))) return; state.landings = Number(el.dataset.val); render(); };
    });
    $$('.opt-finish').forEach(function (el) { el.onclick = function () { state.finish = el.dataset.val; ans.finish = 1; render(); }; });
    $$('.opt-colour').forEach(function (el) { el.onclick = function () { state.colour = el.dataset.val; ans.colour = 1; render(); }; });
    $$('.opt-treads').forEach(function (el) { el.onclick = function () { state.treads = el.dataset.val; ans.treads = 1; render(); }; });
    $$('.opt-tf').forEach(function (el) { el.onclick = function () { state.treadFinish = el.dataset.val; ans.tf = 1; render(); }; });
    $$('.opt-freight').forEach(function (el) {
      el.onclick = function () {
        $$('.opt-freight').forEach(function (o) { o.classList.toggle('is-sel', o === el); });
        var f = $('#f-freight'); if (f) f.value = el.dataset.val;
      };
    });
    $('#c-species').onchange = function (e) { if (!e.target.value) return; state.species = e.target.value; ans.species = 1; render(); };

    /* Attachments: plans, sketches, site photos. Multiple files, drag and drop. */
    var files = [], input = $('#f-files'), drop = document.querySelector('.upload__drop');
    function syncFiles() {
      var dt = new DataTransfer();
      files.forEach(function (f) { dt.items.add(f); });
      input.files = dt.files;
      $('#f-file-list').innerHTML = files.map(function (f, i) {
        return '<li><b>' + f.name + '</b><span>' + (f.size < 1048576 ? Math.max(1, Math.round(f.size / 1024)) + ' KB' : (f.size / 1048576).toFixed(1) + ' MB') + ' <button type="button" data-i="' + i + '" aria-label="Remove">×</button></span></li>';
      }).join('');
      [].forEach.call($('#f-file-list').querySelectorAll('button'), function (b) {
        b.onclick = function () { files.splice(Number(b.dataset.i), 1); syncFiles(); };
      });
    }
    function addFiles(list) {
      [].forEach.call(list, function (f) {
        if (!files.some(function (x) { return x.name === f.name && x.size === f.size; })) files.push(f);
      });
      syncFiles();
    }
    input.addEventListener('change', function () { addFiles(input.files); });
    ['dragenter', 'dragover'].forEach(function (e) {
      drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (e) {
      drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('is-over'); });
    });
    drop.addEventListener('drop', function (ev) { if (ev.dataTransfer) addFiles(ev.dataTransfer.files); });

    var fromEl = document.getElementById('hero-from');
    /* "From" quotes a realistic smallest job — a 13-step straight flight, etch primed. */
    if (fromEl) { var fi = idx(13); fromEl.textContent = money(SP.base[fi] + SP.finish.primed[fi]); }

    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
