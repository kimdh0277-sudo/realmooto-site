// 공용 도우미: 응답·로그인 확인·표 만들기·요청 횟수 제한
export const SITE = 'https://xn--oy2b21ac5u6lm.kr';
export const enc = new TextEncoder();
export const b64 = (u) => btoa(String.fromCharCode(...new Uint8Array(u)));
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
export const err = (m, s = 400) => json({ error: m }, s);
export const sha = async (s) => b64(await crypto.subtle.digest('SHA-256', enc.encode(s)));
export const clean = (s, n) => String(s || '').replace(/\r\n/g, '\n').trim().slice(0, n);
export const cookie = (req, n) => { const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? m[1] : ''; };
export const setSid = (v, age) => ({ 'set-cookie': `sid=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}` });
export const digits = (s) => String(s || '').replace(/\D/g, '');
export const isMobile = (s) => /^01[016789]\d{7,8}$/.test(digits(s));

export async function hashPw(pw, salt) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, k, 256));
}
export async function startSession(db, uid) {
  const raw = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[^A-Za-z0-9]/g, '');
  await db.prepare('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)').bind(await sha(raw), uid, Date.now() + 30 * 864e5).run();
  return raw;
}
export async function me(req, db) {
  const t = cookie(req, 'sid'); if (!t) return null;
  return await db.prepare('SELECT u.id,u.nick,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?').bind(await sha(t), Date.now()).first();
}

// 변경 요청은 같은 사이트에서 온 JSON만 받는다
export function checkPost(req) {
  if (!(req.headers.get('content-type') || '').includes('application/json')) return err('잘못된 요청');
  const o = req.headers.get('origin'); if (o && new URL(o).host !== new URL(req.url).host) return err('허용되지 않은 요청', 403);
  return null;
}

let ready = false;
export async function ensure(db) {
  if (ready) return;
  await db.batch([
    'CREATE TABLE IF NOT EXISTS inquiries(id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, region TEXT, service TEXT, car TEXT, part TEXT, want_date TEXT, want_time TEXT, memo TEXT, marketing INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT \'new\', created INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS installers(user_id INTEGER PRIMARY KEY, company TEXT NOT NULL, owner TEXT NOT NULL, phone TEXT NOT NULL, region TEXT NOT NULL, detail TEXT, marketing INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT \'pending\', created INTEGER NOT NULL, decided INTEGER)',
    'CREATE TABLE IF NOT EXISTS notify_log(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, channel TEXT NOT NULL, ref TEXT, ok INTEGER NOT NULL, detail TEXT, created INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS hits(k TEXT NOT NULL, t INTEGER NOT NULL)',
    'CREATE INDEX IF NOT EXISTS idx_hits ON hits(k, t)',
  ].map((s) => db.prepare(s)));
  ready = true;
}

// key로 windowMs 안에 limit번까지만 허용. 허용되면 1회 기록한다.
export async function allow(db, key, limit, windowMs) {
  const now = Date.now();
  const n = (await db.prepare('SELECT COUNT(*) n FROM hits WHERE k=? AND t>?').bind(key, now - windowMs).first()).n;
  if (n >= limit) return false;
  await db.prepare('INSERT INTO hits(k,t) VALUES(?,?)').bind(key, now).run();
  if (Math.random() < 0.02) await db.prepare('DELETE FROM hits WHERE t<?').bind(now - 864e5).run().catch(() => {});
  return true;
}
export async function ipKey(req) { return (await sha('ip:' + (req.headers.get('cf-connecting-ip') || ''))).slice(0, 16); }
