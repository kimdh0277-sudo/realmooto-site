(function () {
  var d = document, $ = function (s, r) { return (r || d).querySelector(s) }, $$ = function (s, r) { return [].slice.call((r || d).querySelectorAll(s)) };
  var hd = $('#hd'); function sc() { hd.classList.toggle('sc', scrollY > 30) } sc(); addEventListener('scroll', sc, { passive: true });
  // theme
  $$('.th').forEach(function (b) { b.onclick = function () { var r = d.documentElement, t = r.dataset.theme === 'dark' ? 'light' : 'dark'; r.dataset.theme = t; try { localStorage.setItem('theme', t) } catch (e) { } var m = $('meta[name=theme-color]'); if (m) m.content = t === 'dark' ? '#0B0D10' : '#ffffff' } });
  // drawer
  var dr = $('#drawer'), bg = $('#burger');
  function tog(o) { dr.classList.toggle('open', o); dr.setAttribute('aria-hidden', !o); bg.setAttribute('aria-expanded', o); d.body.style.overflow = o ? 'hidden' : '' }
  bg.onclick = function () { tog(true) }; $('#dclose').onclick = function () { tog(false) }; dr.addEventListener('click', function (e) { if (e.target === dr || e.target.closest('a')) tog(false) });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') tog(false) });
  // reveal
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target) } }) }, { threshold: .12, rootMargin: '0px 0px -6% 0px' }) : null;
  $$('.tx').forEach(function (el) { io ? io.observe(el) : el.classList.add('in') });
  $$('.rv').forEach(function (el, i) { el.style.setProperty('--d', (i % 3) * .08 + 's'); io ? io.observe(el) : el.classList.add('in') });
  // 시공사례 필터·검색 (카테고리 + 차량명, 결과 개수 안내)
  var pw = $('#works.pf-grid');
  if (pw) {
    var cards = $$('.wk', pw), chips = $$('.filters button'), qi = $('#pq'), cnt = $('#pcnt'), emp = $('#pempty'), cat = 'all';
    var norm = function (t) { return String(t).toLowerCase().replace(/[\s\-_.·]/g, '') };
    cards.forEach(function (c) { c._k = norm(c.dataset.name) });
    function apply(push) {
      var q = norm(qi.value), shown = 0, per = { all: 0 };
      cards.forEach(function (c) {
        var okq = !q || c._k.indexOf(q) > -1, okc = cat === 'all' || c.dataset.cat === cat;
        if (okq) { per.all++; per[c.dataset.cat] = (per[c.dataset.cat] || 0) + 1 }
        c.hidden = !(okq && okc); if (okq && okc) shown++;
      });
      chips.forEach(function (b) { var on = b.dataset.f === cat; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); var n = $('em', b); if (n) n.textContent = per[b.dataset.f] || 0 });
      var name = cat === 'all' ? '전체' : $('[data-f="' + cat + '"]').firstChild.textContent;
      cnt.textContent = (q ? '“' + qi.value.trim() + '” ' : '') + name + ' ' + shown + '건';
      emp.hidden = shown > 0;
      if (push) { cards.forEach(function (c) { c.classList.add('in', 'q') }) }
      if (push) { var u = new URLSearchParams(); if (cat !== 'all') u.set('cat', cat); if (qi.value.trim()) u.set('q', qi.value.trim()); try { history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u : '')) } catch (e) { } }
    }
    chips.forEach(function (b) { b.addEventListener('click', function () { cat = b.dataset.f; apply(true) }) });
    qi.addEventListener('input', function () { apply(true) });
    $('#preset').addEventListener('click', function () { cat = 'all'; qi.value = ''; apply(true); qi.focus() });
    var sp = new URLSearchParams(location.search); if (sp.get('cat') && $('[data-f="' + sp.get('cat') + '"]')) cat = sp.get('cat'); if (sp.get('q')) qi.value = sp.get('q');
    apply(false);
  }  // lightbox
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
  f.dataset.tel = '010-8072-3550';
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
    var svc = ($('[name=service]:checked', f) || {}).value;
    nx.disabled = true; msg.className = 'msg'; msg.textContent = '전송 중...';
    sendInq({ type: 'work', service: svc, car: f.car.value, part: f.part.value, region: f.region.value, date: f.date.value, time: f.time.value, name: f.name.value, phone: f.phone.value, memo: f.memo.value, agree: f.agree.checked, marketing: f.marketing.checked, hp: f.hp.value })
      .then(function () { f.innerHTML = '<fieldset class="stp on"><legend>문의가 접수되었습니다</legend><p class="body">확인 후 입력하신 연락처로 연락드립니다. 일정은 상담 후 확정됩니다.</p><div class="cta"><a class="btn ghost" href="/portfolio">시공 사례 더 보기</a></div></fieldset>' })
      .catch(function (x) { nx.disabled = false; msg.className = 'msg err'; msg.textContent = x.message.replace(/\.?$/, '.') + ' 급하시면 ' + f.dataset.tel + '로 전화해 주세요.' });
  };
  var rq = new URLSearchParams(location.search).get('r'); if (rq && f.region) f.region.value = rq.slice(0, 20);
  go(0);
})();


/* 로그인 상태 표시 */
(function(){fetch('/api/me',{credentials:'same-origin'}).then(function(r){return r.ok?r.json():null}).then(function(d){
  if(!d||!d.user)return;
  document.querySelectorAll('[data-auth=join]').forEach(function(a){a.textContent=d.user.nick+'님';a.href=d.user.role==='installer'?'/partner':a.href.replace('#/signup','#/')});
  document.querySelectorAll('[data-auth=login]').forEach(function(a){a.textContent='로그아웃';a.href='#';a.addEventListener('click',function(e){e.preventDefault();fetch('/api/logout',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{}'}).then(function(){location.reload()})})});
}).catch(function(){})})();

/* 모션: 스크롤 등장(한 번만) + 읽기 진행 표시줄. 실패하면 내용은 그대로 보인다. */
(function () {
  var d = document, root = d.documentElement, body = d.body;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var els = [].slice.call(d.querySelectorAll('.mo'));
  if (els.length && !reduce && !body.classList.contains('no-mo') && 'IntersectionObserver' in window) {
    root.classList.add('mo-on');
    var first = true;
    var io = new IntersectionObserver(function (es) {
      var vis = es.filter(function (x) { return x.isIntersecting });
      if (!vis.length) return;
      var base = first ? 0.22 : 0; first = false;
      vis.forEach(function (x, i) { x.target.style.setProperty('--mo-d', (base + Math.min(i, 4) * 0.06).toFixed(2) + 's'); x.target.classList.add('in'); io.unobserve(x.target) });
    }, { threshold: .08, rootMargin: '0px 0px -4% 0px' });
    els.forEach(function (el) { io.observe(el) });
    setTimeout(function () { els.forEach(function (el) { el.classList.add('in') }) }, 4000); // 안전장치
  }
  var hd = d.getElementById('hd');
  if (hd && d.querySelector('.gal')) {
    var bar = d.createElement('div'); bar.className = 'rp'; bar.setAttribute('aria-hidden', 'true'); bar.innerHTML = '<i></i>'; hd.appendChild(bar);
    var fill = bar.firstChild;
    function upd() { var h = root.scrollHeight - innerHeight; fill.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')' }
    addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
  }
})();

/* 문의 접수 공용: 서버가 보낸 오류 문구를 그대로 보여준다 */
function sendInq(body) {
  return fetch('/api/inquiries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) {
    return r.json().catch(function () { return {} }).then(function (j) { if (!r.ok) throw new Error(j.error || '전송에 실패했습니다.'); return j });
  }, function () { throw new Error('인터넷 연결을 확인한 뒤 다시 시도해 주세요.') });
}

/* 상담문의(연락처 페이지) 폼 */
(function () {
  var f = document.getElementById('qf'); if (!f) return;
  var m = f.querySelector('.msg'), b = f.querySelector('button[type=submit]');
  var rq = new URLSearchParams(location.search).get('r'); if (rq) f.region.value = rq.slice(0, 20);
  function bad(el, t) { m.className = 'msg err'; m.textContent = t; if (el) { el.classList.add('bad'); el.focus() } return false }
  f.addEventListener('submit', function (e) {
    e.preventDefault(); [].forEach.call(f.querySelectorAll('.bad'), function (x) { x.classList.remove('bad') }); m.className = 'msg'; m.textContent = '';
    if (f.name.value.trim().length < 2) return bad(f.name, '이름을 입력해 주세요.');
    if (!/^01[016789]\d{7,8}$/.test(f.phone.value.replace(/\D/g, ''))) return bad(f.phone, '휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)');
    if (!f.memo.value.trim()) return bad(f.memo, '문의 내용을 입력해 주세요.');
    if (!f.agree.checked) return bad(f.agree, '개인정보 수집·이용에 동의해 주세요.');
    b.disabled = true; m.textContent = '전송 중...';
    sendInq({ type: 'consult', name: f.name.value, phone: f.phone.value, region: f.region.value, memo: f.memo.value, agree: true, marketing: f.marketing.checked, hp: f.hp.value })
      .then(function () { f.reset(); m.className = 'msg'; m.textContent = '상담문의가 접수되었습니다. 확인 후 연락드립니다.' })
      .catch(function (x) { m.className = 'msg err'; m.textContent = x.message }).then(function () { b.disabled = false });
  });
})();

/* 내 지역 확인: 시·도 선택 / 시·군·구 입력 / 내 위치 사용(눌렀을 때만 위치 권한 요청, 좌표는 저장·전송하지 않음) */
(function () {
  var box = document.getElementById('loc'); if (!box) return;
  var D = JSON.parse(document.getElementById('loc-data').textContent), sel = document.getElementById('loc-sel'), q = document.getElementById('loc-q'),
    gps = document.getElementById('loc-gps'), msg = document.getElementById('loc-m'), out = document.getElementById('loc-r');
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n }
  function link(h, t, c) { var a = el('a', c || 'btn ghost', t); a.href = h; return a }
  function show(slug, title, region) {
    var rg = D.rg[slug]; out.innerHTML = ''; if (!rg) { out.hidden = true; return }
    out.appendChild(el('h3', null, title + ' 안내'));
    out.appendChild(el('p', 'body', '전국 상담이 가능합니다. 방문·시공 일정은 상담 후 안내해 드립니다. (' + rg.n + ' 지역 페이지로 연결됩니다)'));
    var kw = el('div', 'kw'); Object.keys(rg.u).forEach(function (k) { kw.appendChild(link('/' + rg.u[k], rg.n + ' ' + D.kw[k], '')) }); out.appendChild(kw);
    var cta = el('div', 'cta'); cta.appendChild(link('/reservation?r=' + encodeURIComponent(region || title), '이 지역으로 시공 문의', 'btn gold')); cta.appendChild(link('/portfolio', '시공 사례 보기')); out.appendChild(cta);
    out.appendChild(el('p', 'note', '시공 사례는 지역별로 나누어 두지 않아 전체 사례를 보여드립니다.'));
    out.hidden = false;
  }
  function byProv(name) { var p = D.p.filter(function (x) { return x[0] === name })[0]; return p && p[1] }
  sel.addEventListener('change', function () { q.value = ''; msg.textContent = ''; if (!sel.value) { out.hidden = true; return } show(byProv(sel.value), sel.value, sel.value) });
  function fromText() {
    var t = q.value.trim(); if (!t) return;
    var n = t.replace(/\s+/g, ''), g = D.g.filter(function (x) { var k = x[0].replace(/\s+/g, ''); return k === n || x[0].split(' ').pop() === t })[0];
    if (g) { sel.value = ''; msg.textContent = ''; return show(g[1], g[0], g[0]) }
    var p = D.p.filter(function (x) { return t.indexOf(x[0]) === 0 || x[0] === t.slice(0, 2) })[0];
    if (p) { sel.value = p[0]; msg.textContent = ''; return show(p[1], p[0], t) }
    out.hidden = true; msg.textContent = '목록에서 찾지 못했습니다. 시·도를 선택해 주세요. 전국 상담이 가능하니 전화로도 문의하실 수 있습니다.';
  }
  q.addEventListener('change', fromText); q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); fromText() } });
  var rad = function (x) { return x * Math.PI / 180 };
  gps.addEventListener('click', function () {
    if (!navigator.geolocation) { msg.textContent = '이 브라우저는 위치 기능을 지원하지 않습니다. 지역을 직접 선택해 주세요.'; sel.focus(); return }
    msg.textContent = '위치를 확인하는 중입니다. 브라우저가 물으면 「허용」을 눌러 주세요.'; gps.disabled = true;
    navigator.geolocation.getCurrentPosition(function (p) {
      gps.disabled = false; var best = null, bd = 1e9, la = p.coords.latitude, lo = p.coords.longitude;
      D.pts.forEach(function (x) { var dl = rad(x[1] - la), dn = rad(x[2] - lo), a = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(rad(la)) * Math.cos(rad(x[1])) * Math.sin(dn / 2) * Math.sin(dn / 2), km = 12742 * Math.asin(Math.sqrt(a)); if (km < bd) { bd = km; best = x[0] } });
      if (!best || bd > 150) { msg.textContent = '현재 위치에서 가까운 지역을 찾지 못했습니다. 지역을 직접 선택해 주세요.'; sel.focus(); return }
      sel.value = best; q.value = ''; show(byProv(best), best, best);
      msg.textContent = '현재 위치와 가까운 지역은 ' + best + '입니다. 대략적인 위치 기준이며, 다르면 위에서 바꿔 주세요. 위치 정보는 저장하지 않습니다.';
    }, function (e) {
      gps.disabled = false; msg.textContent = (e && e.code === 1 ? '위치 사용이 허용되지 않았습니다. ' : '위치를 확인하지 못했습니다. ') + '지역을 직접 선택하거나 입력해 주세요.'; sel.focus();
    }, { timeout: 10000, maximumAge: 600000 });
  });
})();

/* 앱 설치(PWA): 설치창을 띄울 수 있으면 바로 설치, 아니면 기기·브라우저에 맞는 안내를 보여준다 */
(function () {
  var d = document, btns = [d.getElementById('inst'), d.getElementById('inst2')].filter(Boolean), dlg = d.getElementById('instd'); if (!btns.length || !dlg) return;
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  if (standalone) { btns.forEach(function (b) { b.hidden = true }); return }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function () { });
  var ev = null, ua = navigator.userAgent, body = d.getElementById('instb'), ok = d.getElementById('instok');
  addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); ev = e });
  addEventListener('appinstalled', function () { btns.forEach(function (b) { b.hidden = true }); if (dlg.open) dlg.close() });
  function steps(list) { body.innerHTML = ''; var ol = d.createElement('ol'); ol.className = 'inst-l'; list.forEach(function (t) { var li = d.createElement('li'); li.textContent = t; ol.appendChild(li) }); body.appendChild(ol) }
  function guide() {
    ok.hidden = true;
    var inapp = /KAKAOTALK|NAVER\(inapp|FBAN|FBAV|Instagram|Line\//i.test(ua), ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (inapp) return steps(['지금 보고 계신 화면은 앱 안의 브라우저라 설치할 수 없습니다.', '오른쪽 위 메뉴에서 「다른 브라우저로 열기」를 눌러 Chrome 또는 Safari로 열어 주세요.', '열린 뒤 다시 「앱 설치」를 눌러 주세요.']);
    if (ios) return steps(['Safari로 이 사이트를 엽니다.', '화면 아래(또는 위)의 공유 버튼을 누릅니다.', '「홈 화면에 추가」를 선택하고 「추가」를 누릅니다.']);
    if (/Android/.test(ua)) return steps(['Chrome 오른쪽 위 ⋮ 메뉴를 누릅니다.', '「앱 설치」 또는 「홈 화면에 추가」를 선택합니다.', '이미 설치했다면 홈 화면에서 「리얼무토」를 찾아 주세요.']);
    if (/Firefox/.test(ua)) return steps(['Firefox 데스크톱은 앱 설치를 지원하지 않습니다.', 'Chrome 또는 Edge로 열면 주소창 오른쪽에 설치 아이콘이 나타납니다.']);
    steps(['주소창 오른쪽의 설치 아이콘(모니터 모양)을 누릅니다.', '아이콘이 없으면 브라우저 메뉴에서 「앱 설치」 또는 「리얼무토 설치」를 선택합니다.', '이미 설치했다면 바탕화면이나 시작 메뉴에서 「리얼무토」를 찾아 주세요.']);
  }
  btns.forEach(function (b) { b.addEventListener('click', function () {
    if (ev) { body.textContent = '설치하면 홈 화면에서 바로 열 수 있습니다.'; ok.hidden = false } else guide();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }) });
  ok.addEventListener('click', function () { if (!ev) return; ev.prompt(); ev.userChoice.then(function () { ev = null; dlg.close() }) });
  d.getElementById('instx').addEventListener('click', function () { dlg.close ? dlg.close() : dlg.removeAttribute('open') });
})();
