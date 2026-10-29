// 리얼무토 커뮤니티 API (Cloudflare Pages Functions + D1)
const BOARDS = { magazine: 1, free: 0, review: 0, qna: 0, jobs: 0, club: 0 }; // 1 = 관리자만 글쓰기
const PAGE = 15;
const enc = new TextEncoder();
const b64 = (u) => btoa(String.fromCharCode(...new Uint8Array(u)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const err = (m, s = 400) => json({ error: m }, s);

async function hashPw(pw, salt) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, k, 256));
}
async function sha(s) { return b64(await crypto.subtle.digest('SHA-256', enc.encode(s))); }
function cookie(req, n) { const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? m[1] : ''; }
const setSid = (v, age) => ({ 'set-cookie': `sid=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}` });

async function me(req, db) {
  const t = cookie(req, 'sid'); if (!t) return null;
  return await db.prepare('SELECT u.id,u.nick,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?').bind(await sha(t), Date.now()).first();
}
async function startSession(db, uid) {
  const raw = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[^A-Za-z0-9]/g, '');
  await db.prepare('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)').bind(await sha(raw), uid, Date.now() + 30 * 864e5).run();
  return raw;
}
const clean = (s, n) => String(s || '').replace(/\r\n/g, '\n').trim().slice(0, n);

export async function onRequest({ request: req, env, params }) {
  const db = env.DB; if (!db) return err('서버 설정 중입니다', 503);
  const path = (params.path || []).join('/'), m = req.method, url = new URL(req.url);
  if (m !== 'GET' && !(req.headers.get('content-type') || '').includes('application/json')) return err('잘못된 요청');
  if (m !== 'GET') { const o = req.headers.get('origin'); if (o && new URL(o).host !== url.host) return err('허용되지 않은 요청', 403); }
  let body = {}; if (m !== 'GET') { try { body = await req.json(); } catch { return err('잘못된 요청'); } }

  if (path === 'signup' && m === 'POST') {
    const email = clean(body.email, 80).toLowerCase(), nick = clean(body.nick, 12), pw = String(body.pw || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('이메일 형식을 확인해 주세요');
    if (nick.length < 2 || /[<>&"']/.test(nick)) return err('닉네임은 2~12자로 입력해 주세요');
    if (pw.length < 8 || pw.length > 64) return err('비밀번호는 8자 이상 입력해 주세요');
    if (await db.prepare('SELECT 1 FROM users WHERE email=? OR nick=?').bind(email, nick).first()) return err('이미 사용 중인 이메일 또는 닉네임입니다');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const r = await db.prepare('INSERT INTO users(email,nick,pw,role,created) VALUES(?,?,?,?,?)').bind(email, nick, b64(salt) + ':' + await hashPw(pw, salt), 'user', Date.now()).run();
    return json({ ok: 1 }, 200, setSid(await startSession(db, r.meta.last_row_id), 2592000));
  }
  if (path === 'login' && m === 'POST') {
    const u = await db.prepare('SELECT id,pw FROM users WHERE email=?').bind(clean(body.email, 80).toLowerCase()).first();
    const [s, h] = u ? u.pw.split(':') : ['', ''];
    if (!u || (await hashPw(String(body.pw || ''), unb64(s))) !== h) return err('이메일 또는 비밀번호가 맞지 않습니다', 401);
    return json({ ok: 1 }, 200, setSid(await startSession(db, u.id), 2592000));
  }
  if (path === 'logout' && m === 'POST') {
    const t = cookie(req, 'sid'); if (t) await db.prepare('DELETE FROM sessions WHERE token=?').bind(await sha(t)).run();
    return json({ ok: 1 }, 200, setSid('', 0));
  }
  const user = await me(req, db);
  if (path === 'me') return json({ user });

  // 사진 첨부: 브라우저에서 줄인 JPEG를 D1에 base64로 저장 (shortcut: 글을 지워도 사진 행은 남음, 사진이 많아지면 R2로 이전)
  if (path === 'images' && m === 'POST') {
    if (!user) return err('로그인이 필요합니다', 401);
    const d = String(body.data || '');
    if (d.length > 600000 || !/^[A-Za-z0-9+/]+=*$/.test(d)) return err('사진이 너무 크거나 형식이 맞지 않습니다');
    let bytes; try { bytes = unb64(d); } catch { return err('사진 형식이 맞지 않습니다'); }
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return err('JPG 사진만 올릴 수 있습니다');
    await db.prepare('CREATE TABLE IF NOT EXISTS images(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, data TEXT NOT NULL, created INTEGER NOT NULL)').run();
    if (user.role !== 'admin' && (await db.prepare('SELECT COUNT(*) n FROM images WHERE user_id=? AND created>?').bind(user.id, Date.now() - 6e5).first()).n >= 20) return err('잠시 후 다시 올려 주세요', 429);
    const r = await db.prepare('INSERT INTO images(user_id,data,created) VALUES(?,?,?)').bind(user.id, d, Date.now()).run();
    return json({ id: r.meta.last_row_id });
  }

  if (path === 'posts' && m === 'GET') {
    const board = url.searchParams.get('board') || '', pg = Math.max(1, +url.searchParams.get('page') || 1);
    const w = board in BOARDS ? 'WHERE p.board=?' : '', a = board in BOARDS ? [board] : [];
    const rows = await db.prepare(`SELECT p.id,p.board,p.title,p.created,p.views,u.nick,(SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) cc FROM posts p JOIN users u ON u.id=p.user_id ${w} ORDER BY p.id DESC LIMIT ? OFFSET ?`).bind(...a, PAGE + 1, (pg - 1) * PAGE).all();
    return json({ posts: rows.results.slice(0, PAGE), more: rows.results.length > PAGE });
  }
  if (path === 'posts' && m === 'POST') {
    if (!user) return err('로그인이 필요합니다', 401);
    const board = String(body.board || ''), title = clean(body.title, 80), text = clean(body.body, user.role === 'admin' ? 12000 : 5000), motion = user.role === 'admin' && body.motion === 0 ? 0 : 1;
    if (!(board in BOARDS)) return err('게시판을 선택해 주세요');
    if (BOARDS[board] && user.role !== 'admin') return err('관리자만 작성할 수 있습니다', 403);
    if (!title || !text) return err('제목과 내용을 입력해 주세요');
    if ((text.match(/\[img:\d+[|\]]/g) || []).length > (user.role === 'admin' ? 24 : 4)) return err('사진은 최대 4장까지 올릴 수 있습니다');
    if (user.role !== 'admin' && (await db.prepare('SELECT COUNT(*) n FROM posts WHERE user_id=? AND created>?').bind(user.id, Date.now() - 6e5).first()).n >= 5) return err('잠시 후 다시 작성해 주세요', 429);
    const r = await db.prepare('INSERT INTO posts(board,user_id,title,body,created,motion) VALUES(?,?,?,?,?,?)').bind(board, user.id, title, text, Date.now(), motion).run();
    return json({ id: r.meta.last_row_id });
  }
  let mm;
  if ((mm = path.match(/^img\/(\d+)$/)) && m === 'GET') {
    const row = await db.prepare('SELECT data FROM images WHERE id=?').bind(+mm[1]).first().catch(() => null);
    if (!row) return err('사진을 찾을 수 없습니다', 404);
    return new Response(unb64(row.data), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
  }
  if ((mm = path.match(/^posts\/(\d+)$/))) {
    const id = +mm[1];
    if (m === 'GET') {
      const p = await db.prepare('SELECT p.id,p.board,p.title,p.body,p.created,p.views,p.motion,p.user_id,u.nick FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=?').bind(id).first();
      if (!p) return err('글을 찾을 수 없습니다', 404);
      await db.prepare('UPDATE posts SET views=views+1 WHERE id=?').bind(id).run();
      const c = await db.prepare('SELECT c.id,c.body,c.created,c.user_id,u.nick FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.id').bind(id).all();
      return json({ post: p, comments: c.results, me: user });
    }
    if (m === 'DELETE') {
      const p = await db.prepare('SELECT user_id FROM posts WHERE id=?').bind(id).first();
      if (!user || !p || (p.user_id !== user.id && user.role !== 'admin')) return err('권한이 없습니다', 403);
      await db.batch([db.prepare('DELETE FROM comments WHERE post_id=?').bind(id), db.prepare('DELETE FROM posts WHERE id=?').bind(id)]);
      return json({ ok: 1 });
    }
  }
  if ((mm = path.match(/^posts\/(\d+)\/comments$/)) && m === 'POST') {
    if (!user) return err('로그인이 필요합니다', 401);
    const text = clean(body.body, 1000); if (!text) return err('댓글 내용을 입력해 주세요');
    if (!(await db.prepare('SELECT 1 FROM posts WHERE id=?').bind(+mm[1]).first())) return err('글을 찾을 수 없습니다', 404);
    await db.prepare('INSERT INTO comments(post_id,user_id,body,created) VALUES(?,?,?,?)').bind(+mm[1], user.id, text, Date.now()).run();
    return json({ ok: 1 });
  }
  if ((mm = path.match(/^comments\/(\d+)$/)) && m === 'DELETE') {
    const c = await db.prepare('SELECT user_id FROM comments WHERE id=?').bind(+mm[1]).first();
    if (!user || !c || (c.user_id !== user.id && user.role !== 'admin')) return err('권한이 없습니다', 403);
    await db.prepare('DELETE FROM comments WHERE id=?').bind(+mm[1]).run();
    return json({ ok: 1 });
  }
  return err('찾을 수 없습니다', 404);
}
