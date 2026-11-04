/* 운영자 관리 화면: 문의·시공사 신청·알림 기록. 권한은 서버(/api/admin/*)가 확인하고, 이 화면은 보여주기만 한다. */
(function () {
  var d = document, root = d.getElementById('ad');
  function el(tag, cls, txt) { var n = d.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n }
  function api(path, body) {
    var o = { credentials: 'same-origin' }; if (body) { o.method = 'POST'; o.headers = { 'content-type': 'application/json' }; o.body = JSON.stringify(body) }
    return fetch('/api/admin/' + path, o).then(function (r) { return r.json().catch(function () { return {} }).then(function (j) { if (!r.ok) { var e = new Error(j.error || '오류'); e.status = r.status; throw e } return j }) });
  }
  var T = { q: '문의', p: '시공사 신청', l: '알림 기록' }, cur = 'q';
  var time = function (t) { return t ? new Date(t + 9 * 36e5).toISOString().replace('T', ' ').slice(5, 16) : '-' };
  function table(head, rows) {
    var t = el('table', 'ad-t'), h = el('tr'); head.forEach(function (x) { h.appendChild(el('th', null, x)) }); t.appendChild(h);
    rows.forEach(function (r) { t.appendChild(r) }); var w = el('div', 'ad-w'); w.appendChild(t); return w;
  }
  function row(id, cells) { var r = el('tr'); if (id) r.id = id; cells.forEach(function (c) { var td = el('td'); if (c && c.nodeType) td.appendChild(c); else td.textContent = c == null ? '-' : c; r.appendChild(td) }); return r }
  function btn(txt, fn) { var b = el('button', 'btn sm ghost', txt); b.type = 'button'; b.onclick = fn; return b }

  function render() {
    root.innerHTML = '';
    var bar = el('div', 'ad-tabs'); ['q', 'p', 'l'].forEach(function (k) { var b = el('button', k === cur ? 'on' : '', T[k]); b.type = 'button'; b.onclick = function () { cur = k; render() }; bar.appendChild(b) }); root.appendChild(bar);
    var box = el('div'); root.appendChild(box); box.appendChild(el('p', 'cm-msg', '불러오는 중…'));
    var path = { q: 'inquiries', p: 'installers', l: 'log' }[cur];
    api(path).then(function (j) {
      box.innerHTML = '';
      if (!j.rows.length) return box.appendChild(el('p', 'cm-msg', '아직 없습니다.'));
      if (cur === 'q') box.appendChild(table(['번호', '접수', '유형', '이름', '연락처', '지역', '서비스', '차량·내용', '상태'], j.rows.map(function (r) {
        var st = btn(r.status === 'done' ? '처리 완료 ✓' : '처리 완료로', function () { api('inquiries/' + r.id, { status: r.status === 'done' ? 'new' : 'done' }).then(render) });
        var tel = el('a', null, r.phone); tel.href = 'tel:' + r.phone;
        return row('q' + r.id, [r.id, time(r.created), r.type === 'work' ? '시공' : '상담', r.name, tel, r.region, r.service, [r.car, r.part, r.want_date && ('희망 ' + r.want_date + ' ' + (r.want_time || '')), r.memo, r.marketing ? '(마케팅 동의)' : ''].filter(Boolean).join(' / '), st]);
      })));
      if (cur === 'p') box.appendChild(table(['번호', '신청', '업체', '담당자', '연락처', '지역', '이메일', '상태', '처리'], j.rows.map(function (r) {
        var act = el('span', 'ad-act'); [['approved', '승인'], ['rejected', '보류'], ['pending', '대기']].forEach(function (s) { if (s[0] !== r.status) act.appendChild(btn(s[1], function () { api('installers/' + r.user_id, { status: s[0] }).then(render) })) });
        return row('p' + r.user_id, [r.user_id, time(r.created), r.company, r.owner, r.phone, r.region + (r.detail ? ' · ' + r.detail : ''), r.email, { approved: '승인', rejected: '보류', pending: '대기' }[r.status], act]);
      })));
      if (cur === 'l') box.appendChild(table(['시각', '종류', '채널', '대상', '결과', '내용'], j.rows.map(function (r) { return row(null, [time(r.created), r.kind, r.channel, r.ref, r.ok ? '성공' : '실패', r.detail]) })));
      var h = location.hash.slice(1), t = h && d.getElementById(h); if (t) { t.classList.add('hit'); t.scrollIntoView({ block: 'center' }) }
    }).catch(function (e) {
      box.innerHTML = '';
      if (e.status === 401) { box.appendChild(el('p', 'body', '운영자 로그인이 필요합니다.')); var a = el('a', 'btn gold', '로그인'); a.href = 'community.html#/login'; return box.appendChild(a) }
      box.appendChild(el('p', 'body', e.status === 403 ? '운영자 권한이 없는 계정입니다.' : '불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    });
  }
  var h0 = location.hash.slice(1); if (/^p\d/.test(h0)) cur = 'p';
  render();
})();
