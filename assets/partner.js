/* 시공사 로그인·가입·내 정보. 화면 문구는 textContent로만 넣는다. */
(function () {
  var d = document, $ = function (s, r) { return (r || d).querySelector(s) };
  var tabs = [].slice.call(d.querySelectorAll('.pt-tabs button')), L = $('#pl'), S = $('#ps'), V = $('#pv'), T = $('.pt-tabs');
  var ST = { pending: ['승인 대기', '운영자가 확인 중입니다. 승인되면 이 화면의 상태가 바뀝니다.'], approved: ['승인 완료', '승인되었습니다. 현재 제공되는 시공사 기능은 내 정보 확인입니다. 추가 기능은 준비 중입니다.'], rejected: ['승인 보류', '승인되지 않았습니다. 자세한 내용은 리얼무토로 문의해 주세요.'] };

  function tab(t) {
    tabs.forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); b.setAttribute('aria-selected', b.dataset.t === t) });
    L.hidden = t !== 'login'; S.hidden = t !== 'signup'; V.hidden = true; T.hidden = false;
    try { history.replaceState(null, '', '#' + t) } catch (e) { }
  }
  tabs.forEach(function (b) { b.addEventListener('click', function () { tab(b.dataset.t) }) });

  function post(url, body) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {} }).then(function (j) { if (!r.ok) throw new Error(j.error || '요청에 실패했습니다. 잠시 후 다시 시도해 주세요.'); return j }) },
        function () { throw new Error('인터넷 연결을 확인한 뒤 다시 시도해 주세요.') });
  }
  function fail(f, el, msg) { var m = $('.msg', f); m.className = 'msg err'; m.textContent = msg; if (el) { el.classList.add('bad'); el.focus() } }
  function clear(f) { [].forEach.call(f.querySelectorAll('.bad'), function (x) { x.classList.remove('bad') }); var m = $('.msg', f); m.className = 'msg'; m.textContent = '' }
  var digits = function (s) { return String(s).replace(/\D/g, '') };

  L.addEventListener('submit', function (e) {
    e.preventDefault(); clear(L);
    if (!L.email.value.trim()) return fail(L, L.email, '이메일을 입력해 주세요.');
    if (!L.pw.value) return fail(L, L.pw, '비밀번호를 입력해 주세요.');
    var b = $('button[type=submit]', L); b.disabled = true;
    post('/api/partner/login', { email: L.email.value, pw: L.pw.value }).then(function () { L.reset(); me() }).catch(function (x) { fail(L, null, x.message) }).then(function () { b.disabled = false });
  });

  S.addEventListener('submit', function (e) {
    e.preventDefault(); clear(S);
    var f = S;
    if (f.company.value.trim().length < 2) return fail(S, f.company, '업체명을 2자 이상 입력해 주세요.');
    if (f.owner.value.trim().length < 2) return fail(S, f.owner, '담당자 이름을 입력해 주세요.');
    if (!/^01[016789]\d{7,8}$/.test(digits(f.phone.value))) return fail(S, f.phone, '휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)');
    if (!f.region.value) return fail(S, f.region, '활동 지역을 선택해 주세요.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) return fail(S, f.email, '이메일 형식을 확인해 주세요.');
    if (f.pw.value.length < 8) return fail(S, f.pw, '비밀번호는 8자 이상 입력해 주세요.');
    if (!f.agree.checked) return fail(S, f.agree, '개인정보 수집·이용에 동의해 주세요.');
    var b = $('button[type=submit]', S); b.disabled = true;
    post('/api/partner/signup', { company: f.company.value, owner: f.owner.value, phone: f.phone.value, region: f.region.value, detail: f.detail.value, email: f.email.value, pw: f.pw.value, agree: true, marketing: f.marketing.checked, hp: f.hp.value })
      .then(function () { S.reset(); me(true) }).catch(function (x) { fail(S, null, x.message) }).then(function () { b.disabled = false });
  });

  function el(tag, cls, txt) { var n = d.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n }
  function logout() { post('/api/logout', {}).then(function () { location.href = 'partner.html#login'; location.reload() }) }

  function show(p, justJoined) {
    V.innerHTML = ''; T.hidden = true; L.hidden = true; S.hidden = true; V.hidden = false;
    var st = ST[p.status] || ST.pending;
    if (justJoined) V.appendChild(el('p', 'msg', '가입 신청이 접수되었습니다.'));
    var box = el('div', 'pv-st s-' + p.status); box.appendChild(el('b', null, st[0])); box.appendChild(el('span', null, st[1])); V.appendChild(box);
    var dl = el('dl', 'info');
    [['업체명', p.company], ['담당자', p.owner], ['연락처', p.phone], ['활동 지역', p.region + (p.detail ? ' · ' + p.detail : '')]].forEach(function (r) { var row = el('div'); row.appendChild(el('dt', null, r[0])); row.appendChild(el('dd', null, r[1])); dl.appendChild(row) });
    V.appendChild(dl);
    var b = el('button', 'btn ghost', '로그아웃'); b.type = 'button'; b.onclick = logout; V.appendChild(b);
  }
  function other(msg) {
    V.innerHTML = ''; T.hidden = true; L.hidden = true; S.hidden = true; V.hidden = false;
    V.appendChild(el('p', 'body', msg));
    var b = el('button', 'btn ghost', '로그아웃'); b.type = 'button'; b.onclick = logout; V.appendChild(b);
  }
  function me(justJoined) {
    fetch('/api/partner/me', { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401) { tab(location.hash === '#signup' ? 'signup' : 'login'); return }
      if (r.status === 403) return other('일반 회원 계정으로 로그인되어 있습니다. 시공사 계정을 쓰려면 로그아웃한 뒤 시공사 로그인을 이용해 주세요.');
      return r.json().then(function (j) { j.partner ? show(j.partner, justJoined) : other('시공사 정보를 찾을 수 없습니다. 리얼무토로 문의해 주세요.') });
    }).catch(function () { tab('login') });
  }
  tab(location.hash === '#signup' ? 'signup' : 'login'); me();
})();
