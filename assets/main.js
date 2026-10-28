(function () {
  var d = document, $ = function (s, r) { return (r || d).querySelector(s) }, $$ = function (s, r) { return [].slice.call((r || d).querySelectorAll(s)) };
  var hd = $('#hd'); function sc() { hd.classList.toggle('sc', scrollY > 30) } sc(); addEventListener('scroll', sc, { passive: true });
  // theme
  $('#theme').onclick = function () { var r = d.documentElement, t = r.dataset.theme === 'dark' ? 'light' : 'dark'; r.dataset.theme = t; try { localStorage.setItem('theme', t) } catch (e) { } };
  // drawer
  var dr = $('#drawer'), bg = $('#burger');
  function tog(o) { dr.classList.toggle('open', o); dr.setAttribute('aria-hidden', !o); bg.setAttribute('aria-expanded', o); d.body.style.overflow = o ? 'hidden' : '' }
  bg.onclick = function () { tog(true) }; $('#dclose').onclick = function () { tog(false) }; dr.addEventListener('click', function (e) { if (e.target === dr || e.target.closest('a')) tog(false) });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') tog(false) });
  // reveal
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target) } }) }, { threshold: .12, rootMargin: '0px 0px -6% 0px' }) : null;
  $$('.tx').forEach(function (el) { io ? io.observe(el) : el.classList.add('in') });
  $$('.rv').forEach(function (el, i) { el.style.setProperty('--d', (i % 3) * .08 + 's'); io ? io.observe(el) : el.classList.add('in') });
  // filter
  var fl = $$('.filters button');
  fl.forEach(function (b) { b.onclick = function () { fl.forEach(function (x) { x.classList.toggle('on', x === b) }); $$('#works .wk').forEach(function (c) { c.hidden = !(b.dataset.f === 'all' || c.dataset.cat === b.dataset.f) }) } });
  // lightbox
  var lb = $('#lb'), gi = $$('.gi'), cur = 0;
  if (gi.length) {
    var li = $('img', lb); function show(i) { cur = (i + gi.length) % gi.length; li.src = gi[cur].href; lb.hidden = false }
    gi.forEach(function (a, i) { a.addEventListener('click', function (e) { e.preventDefault(); show(i) }) });
    $('.lx', lb).onclick = function () { lb.hidden = true }; $('.lp', lb).onclick = function () { show(cur - 1) }; $('.ln', lb).onclick = function () { show(cur + 1) };
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.hidden = true });
    d.addEventListener('keydown', function (e) { if (lb.hidden) return; if (e.key === 'Escape') lb.hidden = true; if (e.key === 'ArrowLeft') show(cur - 1); if (e.key === 'ArrowRight') show(cur + 1) });
  }
  // reservation wizard
  var f = $('#rf'); if (!f) return;
  var st = $$('.stp', f), pg = $$('.prog i', f), n = 0, msg = $('#msg'), nx = $('#next'), pv = $('#prev');
  var q = new URLSearchParams(location.search).get('s'); if (q) { var r = $('[data-k="' + q + '"]', f); if (r) r.checked = true }
  function go(i) { n = i; st.forEach(function (s, k) { s.classList.toggle('on', k === i) }); pg.forEach(function (p, k) { p.classList.toggle('on', k <= i) }); pv.style.visibility = i ? 'visible' : 'hidden'; nx.textContent = i === st.length - 1 ? '예약 요청 보내기' : '다음'; msg.textContent = ''; scrollTo({ top: f.offsetTop - 120, behavior: 'smooth' }) }
  function ok() {
    var bad = false; msg.className = 'msg';
    $$('[required]', st[n]).forEach(function (el) { el.classList.remove('bad'); var v = el.type === 'radio' ? $$('[name=' + el.name + ']', f).some(function (x) { return x.checked }) : el.type === 'checkbox' ? el.checked : el.value.trim(); if (!v) { bad = true; el.classList.add('bad') } });
    var ph = f.phone.value.replace(/\D/g, ''); if (n === 3 && ph.length < 9) { bad = true; f.phone.classList.add('bad') }
    if (bad) { msg.className = 'msg err'; msg.textContent = '필수 항목을 확인해 주세요.' } return !bad
  }
  pv.onclick = function () { go(n - 1) };
  nx.onclick = function () {
    if (!ok()) return; if (n < st.length - 1) return go(n + 1);
    var v = function (k) { return f[k].value.trim() || '-' }, svc = ($('[name=service]:checked', f) || {}).value;
    var text = '[예약 요청]\n서비스: ' + svc + '\n차량: ' + v('car') + '\n희망: ' + v('part') + '\n방문희망: ' + v('date') + ' ' + v('time') + '\n이름: ' + v('name') + '\n연락처: ' + v('phone') + '\n요청: ' + v('memo');
    var ep = f.dataset.endpoint;
    if (ep) {
      nx.disabled = true; msg.textContent = '전송 중...';
      fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ service: svc, car: f.car.value, part: f.part.value, date: f.date.value, time: f.time.value, name: f.name.value, phone: f.phone.value, memo: f.memo.value }) })
        .then(function (r) { if (!r.ok) throw 0; f.innerHTML = '<fieldset class="stp on"><legend><span>DONE</span>예약 요청이 접수되었습니다</legend><p class="body">확인 후 입력하신 연락처로 연락드립니다. (일정은 상담 후 확정됩니다)</p></fieldset>' })
        .catch(function () { nx.disabled = false; msg.className = 'msg err'; msg.textContent = '전송에 실패했습니다. 전화로 문의해 주세요.' });
    } else {
      location.href = 'sms:' + f.dataset.sms + '?&body=' + encodeURIComponent(text);
      msg.textContent = '문자 앱이 열립니다. 문자를 "전송"해야 요청이 전달됩니다.';
    }
  };
  go(0);
})();

