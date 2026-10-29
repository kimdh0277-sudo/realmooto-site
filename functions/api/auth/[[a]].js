// 소셜 로그인(카카오·네이버·구글): /api/auth/providers, /api/auth/{p}/start, /api/auth/{p}/callback
// 키는 Cloudflare Pages 환경변수: KAKAO_ID/KAKAO_SECRET, NAVER_ID/NAVER_SECRET, GOOGLE_ID/GOOGLE_SECRET
const SITE = 'https://xn--oy2b21ac5u6lm.kr';
const P = {
  kakao: { auth: 'https://kauth.kakao.com/oauth/authorize', token: 'https://kauth.kakao.com/oauth/token', me: 'https://kapi.kakao.com/v2/user/me', scope: '',
    parse: (j) => ({ pid: String(j.id), nick: j.kakao_account?.profile?.nickname || j.properties?.nickname, email: j.kakao_account?.email }) },
  naver: { auth: 'https://nid.naver.com/oauth2.0/authorize', token: 'https://nid.naver.com/oauth2.0/token', me: 'https://openapi.naver.com/v1/nid/me', scope: '',
    parse: (j) => ({ pid: j.resultcode === '00' ? String(j.response?.id) : '', nick: j.response?.nickname || j.response?.name, email: j.response?.email }) },
  google: { auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', me: 'https://openidconnect.googleapis.com/v1/userinfo', scope: 'openid email profile',
    parse: (j) => ({ pid: String(j.sub), nick: j.name, email: j.email }) },
};
const enc = new TextEncoder();
const b64 = (u) => btoa(String.fromCharCode(...new Uint8Array(u)));
const rand = () => b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[^A-Za-z0-9]/g, '');
const sha = async (s) => b64(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const cookie = (req, n) => ((req.headers.get('cookie') || '').match(new RegExp('(?:^|; )' + n + '=([^;]*)')) || [])[1] || '';
const ck = (n, v, age) => `${n}=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const keys = (env, p) => [env[p.toUpperCase() + '_ID'], env[p.toUpperCase() + '_SECRET']];
const ready = (env, p) => keys(env, p).every(Boolean); // ID와 시크릿이 둘 다 있어야 켜짐

export async function onRequest({ request: req, env, params }) {
  const [p, act] = params.a || [], url = new URL(req.url);
  if (p === 'providers') return Response.json(Object.fromEntries(Object.keys(P).map((k) => [k, ready(env, k)])), { headers: { 'cache-control': 'no-store' } });
  const cfg = P[p]; const [id, secret] = cfg ? keys(env, p) : [];
  if (!cfg || !ready(env, p) || !['start', 'callback'].includes(act)) return new Response('not found', { status: 404 });
  if (url.origin !== SITE) return Response.redirect(`${SITE}/api/auth/${p}/${act}${url.search}`, 302); // 쿠키·등록 주소를 대표 주소 하나로 고정
  const redirect_uri = `${SITE}/api/auth/${p}/callback`;

  if (act === 'start') {
    const state = rand();
    const q = new URLSearchParams({ client_id: id, redirect_uri, response_type: 'code', state });
    if (cfg.scope) q.set('scope', cfg.scope);
    return new Response(null, { status: 302, headers: { Location: `${cfg.auth}?${q}`, 'set-cookie': ck('oauth_state', state, 600) } });
  }

  const fail = (e = 1) => new Response(null, { status: 302, headers: { Location: `${SITE}/community.html#/login?e=${e}`, 'set-cookie': ck('oauth_state', '', 0) } });
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  if (url.searchParams.get('error') && state && state === cookie(req, 'oauth_state')) return fail(2); // 동의 거부·취소
  if (!code || !state || state !== cookie(req, 'oauth_state')) return fail();
  try {
    const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: id, redirect_uri, code, state });
    if (secret) body.set('client_secret', secret);
    let t = await (await fetch(cfg.token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })).json().catch(() => ({}));
    if (!t.access_token && p === 'naver') t = await (await fetch(`${cfg.token}?${body}`)).json().catch(() => ({})); // shortcut: 네이버 토큰 API의 POST/GET 허용을 공식 문서로 확인 못 함, 실제 로그인 확인 뒤 불필요하면 삭제
    if (!t.access_token) return fail();
    const prof = cfg.parse(await (await fetch(cfg.me, { headers: { authorization: `Bearer ${t.access_token}` } })).json());
    if (!prof.pid || prof.pid === 'undefined') return fail();

    const db = env.DB; let u = await db.prepare('SELECT id FROM users WHERE provider=? AND pid=?').bind(p, prof.pid).first();
    if (!u) {
      let base = String(prof.nick || '').replace(/[<>&"'\s]/g, '').slice(0, 9); if (base.length < 2) base = '회원';
      let nick = base; for (let i = 0; i < 5 && await db.prepare('SELECT 1 FROM users WHERE nick=?').bind(nick).first(); i++) nick = base + (100 + Math.floor(Math.random() * 900));
      let email = String(prof.email || '').toLowerCase().slice(0, 80);
      if (!email || await db.prepare('SELECT 1 FROM users WHERE email=?').bind(email).first()) email = `${p}_${prof.pid}@social.invalid`; // 기존 계정과 자동 합치지 않음
      const r = await db.prepare('INSERT INTO users(email,nick,pw,role,created,provider,pid) VALUES(?,?,?,?,?,?,?)').bind(email, nick, 'AAAA:none', 'user', Date.now(), p, prof.pid).run();
      u = { id: r.meta.last_row_id };
    }
    const sid = rand();
    await db.prepare('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)').bind(await sha(sid), u.id, Date.now() + 30 * 864e5).run();
    const h = new Headers({ Location: `${SITE}/community.html#/` });
    h.append('set-cookie', ck('sid', sid, 2592000)); h.append('set-cookie', ck('oauth_state', '', 0));
    return new Response(null, { status: 302, headers: h });
  } catch (e) { return fail(); }
}
