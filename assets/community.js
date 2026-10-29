(function () {
  var root = document.getElementById('cm'); if (!root) return;
  var BOARDS = [['all', '전체'], ['magazine', '매거진'], ['free', '게시판'], ['review', '시공후기'], ['qna', '질문'], ['jobs', '구인/구직'], ['club', '동호회/모임']];
  var NAME = {}; BOARDS.forEach(function (b) { NAME[b[0]] = b[1]; });
  var user = null;

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) { if (k === 'text') e.textContent = attrs[k]; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function api(path, method, data) {
    return fetch('/api/' + path, { method: method || 'GET', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: data ? JSON.stringify(data) : undefined })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || '오류가 발생했습니다'); return j; }); });
  }
  function date(t) { var d = new Date(t), n = new Date(); return d.toDateString() === n.toDateString() ? ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) : d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2); }
  function go(hash) { location.hash = hash; }
  function mount(nodes) { root.textContent = ''; nodes.forEach(function (n) { root.appendChild(n); }); window.scrollTo(0, 0); }
  function msg(text) { return h('p', { class: 'cm-msg', text: text }); }

  function bar() {
    var right = user
      ? [h('span', { class: 'cm-who', text: user.nick + (user.role === 'admin' ? ' (관리자)' : '') + '님' }), h('button', { class: 'btn sm ghost', text: '로그아웃', onclick: function () { api('logout', 'POST', {}).then(function () { user = null; location.reload(); }); } })]
      : [h('a', { class: 'btn sm ghost', href: '#/login', text: '로그인' }), h('a', { class: 'btn sm', href: '#/signup', text: '회원가입' })];
    return h('div', { class: 'cm-bar' }, right);
  }
  function tabs(cur) {
    return h('div', { class: 'cm-tabs' }, BOARDS.map(function (b) { return h('a', { href: '#/' + (b[0] === 'all' ? '' : 'b/' + b[0]), class: b[0] === cur ? 'on' : '', text: b[1] }); }));
  }

  function list(board, page) {
    var head = [bar(), tabs(board)];
    mount(head.concat([msg('불러오는 중…')]));
    api('posts?board=' + (board === 'all' ? '' : board) + '&page=' + page).then(function (d) {
      var rows = d.posts.map(function (p) {
        return h('a', { class: 'cm-row', href: '#/p/' + p.id }, [
          h('span', { class: 'cm-tag', text: NAME[p.board] }),
          h('b', { text: p.title }),
          h('span', { class: 'cm-cc', text: p.cc ? '[' + p.cc + ']' : '' }),
          h('small', { text: p.nick + ' · ' + date(p.created) + ' · 조회 ' + p.views })]);
      });
      var canWrite = user && (board !== 'magazine' || user.role === 'admin');
      var foot = h('div', { class: 'cm-foot' }, [
        page > 1 ? h('a', { class: 'btn sm ghost', href: '#/' + (board === 'all' ? '' : 'b/' + board) + (page > 2 ? '?page=' + (page - 1) : ''), text: '이전' }) : null,
        d.more ? h('a', { class: 'btn sm ghost', href: '#/' + (board === 'all' ? '' : 'b/' + board) + '?page=' + (page + 1), text: '다음' }) : null,
        user ? (canWrite || board === 'all' ? h('a', { class: 'btn sm gold', href: '#/write' + (board === 'all' ? '' : '/' + board), text: '글쓰기' }) : null) : h('a', { class: 'btn sm gold', href: '#/login', text: '로그인 후 글쓰기' })]);
      mount(head.concat([rows.length ? h('div', { class: 'cm-list' }, rows) : msg('아직 글이 없습니다.'), foot]));
    }).catch(function (e) { mount(head.concat([msg(e.message)])); });
  }

  // 공개 화면과 미리보기가 같은 함수를 쓴다 (motion=false면 모션 없음)
  function article(p, motion, meta) {
    function e(i, n) { n.classList.add('mo-e'); n.style.setProperty('--mo-i', i); return n }
    return h('article', { class: 'cm-post' + (motion ? '' : ' no-mo') }, [
      e(0, h('span', { class: 'cm-tag', text: NAME[p.board] })), e(1, h('h2', { text: p.title })), e(2, h('small', { text: meta })), e(3, bodyNode(p.body))]);
  }
  // 본문의 [img:번호] 줄은 첨부 사진으로 그린다 (번호는 숫자만 허용)
  function bodyNode(t) {
    var d = h('div', { class: 'cm-body' });
    String(t).split(/\[img:(\d+)\]/).forEach(function (s, i) {
      if (i % 2) d.appendChild(h('img', { src: '/api/img/' + s, alt: '첨부 사진', loading: 'lazy' }));
      else if (s.trim()) d.appendChild(document.createTextNode(s.replace(/^\n+|\n+$/g, '')));
    });
    return d;
  }

  function post(id) {
    mount([bar(), msg('불러오는 중…')]);
    api('posts/' + id).then(function (d) {
      var p = d.post, me = d.me;
      user = me || user;
      var ta = h('textarea', { rows: '3', maxlength: '1000', placeholder: '댓글을 입력하세요' });
      var cms = d.comments.map(function (c) {
        return h('div', { class: 'cm-cmt' }, [h('b', { text: c.nick }), h('small', { text: ' ' + date(c.created) }),
          (me && (me.id === c.user_id || me.role === 'admin')) ? h('button', { class: 'cm-x', text: '삭제', onclick: function () { if (confirm('댓글을 삭제할까요?')) api('comments/' + c.id, 'DELETE').then(function () { post(id); }); } }) : null,
          h('p', { text: c.body })]);
      });
      var form = me ? h('div', { class: 'cm-cform' }, [ta, h('button', { class: 'btn sm gold', text: '댓글 등록', onclick: function () { api('posts/' + id + '/comments', 'POST', { body: ta.value }).then(function () { post(id); }).catch(function (e) { alert(e.message); }); } })])
        : h('p', { class: 'cm-msg' }, [h('a', { href: '#/login', text: '로그인' }), ' 후 댓글을 쓸 수 있습니다.']);
      mount([bar(), article(p, p.motion !== 0, p.nick + ' · ' + date(p.created) + ' · 조회 ' + (p.views + 1)),
        h('div', { class: 'cm-foot' }, [h('a', { class: 'btn sm ghost', href: '#/b/' + p.board, text: '목록' }),
          (me && (me.id === p.user_id || me.role === 'admin')) ? h('button', { class: 'btn sm ghost', text: '삭제', onclick: function () { if (confirm('글을 삭제할까요?')) api('posts/' + id, 'DELETE').then(function () { go('#/b/' + p.board); }); } }) : null]),
        h('h3', { class: 'cm-h', text: '댓글 ' + d.comments.length }), h('div', {}, cms), form]);
    }).catch(function (e) { mount([bar(), msg(e.message)]); });
  }

  function write(board) {
    if (!user) return go('#/login');
    var opts = BOARDS.filter(function (b) { return b[0] !== 'all' && (b[0] !== 'magazine' || user.role === 'admin'); });
    var sel = h('select', {}, opts.map(function (b) { var o = h('option', { value: b[0], text: b[1] }); if (b[0] === board) o.selected = true; return o; }));
    var t = h('input', { type: 'text', maxlength: '80', placeholder: '제목' }), b = h('textarea', { rows: '12', maxlength: '5000', placeholder: '내용을 입력하세요 (광고·홍보성 글은 삭제될 수 있습니다)' }), er = h('p', { class: 'cm-err' });
    var admin = user.role === 'admin';
    var mo = h('select', { 'aria-label': '모션' }, [h('option', { value: '1', text: '모션: 기본 모션' }), h('option', { value: '0', text: '모션: 모션 없음' })]);
    var pv = h('div', { class: 'cm-prev' });
    var ids = [], th = h('div', { class: 'cm-th' }), fi = h('input', { type: 'file', accept: 'image/*', multiple: 'multiple', style: 'display:none' });
    function full() { return b.value + ids.map(function (i) { return '\n[img:' + i + ']'; }).join(''); }
    function shrink(f) {
      return new Promise(function (ok, no) {
        var im = new Image(), u = URL.createObjectURL(f);
        im.onload = function () {
          URL.revokeObjectURL(u);
          var s = Math.min(1, 1280 / Math.max(im.width, im.height)), c = document.createElement('canvas'), q = .8, d;
          c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          do { d = c.toDataURL('image/jpeg', q).split(',')[1]; q -= .15; } while (d.length > 550000 && q > .3);
          ok(d);
        };
        im.onerror = function () { URL.revokeObjectURL(u); no(new Error('사진을 읽을 수 없습니다 (JPG·PNG 사진만 가능)')); };
        im.src = u;
      });
    }
    fi.addEventListener('change', function () {
      var files = Array.prototype.slice.call(fi.files); fi.value = '';
      files.reduce(function (p, f) {
        return p.then(function () {
          if (ids.length >= 4) throw new Error('사진은 최대 4장까지 올릴 수 있습니다');
          er.textContent = '사진 올리는 중…';
          return shrink(f).then(function (d) { return api('images', 'POST', { data: d }); }).then(function (r) {
            ids.push(r.id);
            var w = h('div', { class: 'cm-t' }, [h('img', { src: '/api/img/' + r.id, alt: '첨부 사진' }), h('button', { type: 'button', 'aria-label': '사진 삭제', text: '×', onclick: function () { ids = ids.filter(function (x) { return x !== r.id; }); w.remove(); } })]);
            th.appendChild(w); er.textContent = '';
          });
        });
      }, Promise.resolve()).catch(function (e) { er.textContent = e.message; });
    });
    function preview() {
      pv.textContent = '';
      if (!t.value.trim() && !b.value.trim()) { er.textContent = '제목이나 내용을 입력하면 미리볼 수 있습니다'; return; }
      er.textContent = '';
      pv.appendChild(h('p', { class: 'cm-msg', text: '미리보기 (실제 공개 화면과 동일)' }));
      pv.appendChild(article({ board: sel.value, title: t.value || '(제목 없음)', body: full() }, mo.value !== '0', user.nick + ' · 방금 · 조회 0'));
    }
    mount([bar(), h('h2', { class: 'cm-h', text: '글쓰기' }), h('div', { class: 'cm-form' }, [sel, admin ? mo : null, t, b, h('button', { class: 'btn ghost', type: 'button', text: '사진 첨부 (최대 4장)', onclick: function () { fi.click(); } }), fi, th, er,
      h('div', { class: 'cm-act' }, [admin ? h('button', { class: 'btn ghost', type: 'button', text: '미리보기', onclick: preview }) : null,
        h('button', { class: 'btn gold', text: '등록', onclick: function () { api('posts', 'POST', { board: sel.value, title: t.value, body: full(), motion: admin && mo.value === '0' ? 0 : 1 }).then(function (r) { go('#/p/' + r.id); }).catch(function (e) { er.textContent = e.message; }); } })]), pv])]);
  }

  function auth(signup) {
    var f = { email: h('input', { type: 'email', placeholder: '이메일', autocomplete: 'email' }), pw: h('input', { type: 'password', placeholder: signup ? '비밀번호 (8자 이상)' : '비밀번호', autocomplete: signup ? 'new-password' : 'current-password' }), nick: h('input', { type: 'text', placeholder: '닉네임 (2~12자)', maxlength: '12' }) };
    var er = h('p', { class: 'cm-err' }), soc = h('div', { class: 'cm-soc' });
    function submit() { api(signup ? 'signup' : 'login', 'POST', { email: f.email.value, pw: f.pw.value, nick: f.nick.value }).then(function () { return api('me'); }).then(function (d) { user = d.user; location.hash = '#/'; location.reload(); }).catch(function (e) { er.textContent = e.message; }); }
    f.pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    mount([bar(), h('h2', { class: 'cm-h', text: signup ? '회원가입' : '로그인' }), h('div', { class: 'cm-form' }, [f.email, signup ? f.nick : null, f.pw, er, h('button', { class: 'btn gold', text: signup ? '가입하기' : '로그인', onclick: submit }),
      h('a', { class: 'cm-sw', href: signup ? '#/login' : '#/signup', text: signup ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입' })]), soc]);
    if (/e=2/.test(location.hash)) er.textContent = '간편 로그인을 취소했습니다.'; else if (/e=1/.test(location.hash)) er.textContent = '간편 로그인에 실패했습니다. 다시 시도해 주세요.';
    fetch('/api/auth/providers').then(function (r) { return r.json() }).then(function (o) {
      [['kakao', '카카오로 시작하기'], ['naver', '네이버로 시작하기'], ['google', '구글로 시작하기']].forEach(function (p) { if (o[p[0]]) soc.appendChild(h('a', { class: 'cm-s ' + p[0], href: '/api/auth/' + p[0] + '/start', text: p[1] })) });
      if (soc.firstChild) soc.insertBefore(h('p', { class: 'cm-or', text: '또는 간편하게' }), soc.firstChild);
    }).catch(function () { });
  }

  function route() {
    var raw = location.hash.replace(/^#\/?/, ''), q = raw.split('?'), parts = q[0].split('/'), page = +(new URLSearchParams(q[1] || '').get('page')) || 1;
    if (parts[0] === 'p' && parts[1]) return post(+parts[1]);
    if (parts[0] === 'write') return write(parts[1] || 'free');
    if (parts[0] === 'login') return auth(false);
    if (parts[0] === 'signup') return auth(true);
    list(parts[0] === 'b' && NAME[parts[1]] ? parts[1] : 'all', page);
  }
  window.addEventListener('hashchange', route);
  api('me').then(function (d) { user = d.user; }).catch(function () {}).then(route);
})();
