// 시공사 전용: POST /api/partner/signup, POST /api/partner/login, GET /api/partner/me
// 시공사 계정은 users.role='installer' 이고, 운영자가 승인(installers.status='approved')해야 승인 상태가 된다.
// 시공사는 이 API로 본인 정보만 볼 수 있다. 고객 문의·다른 시공사 정보는 관리자 API에만 있다.
import { err, json, clean, digits, isMobile, checkPost, ensure, allow, ipKey, hashPw, unb64, b64, startSession, setSid, me } from '../../_lib/core.js';
import { alertEvent, maskPhone } from '../../_lib/notify.js';

export const REGIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

export async function onRequest(ctx) {
  const { request: req, env } = ctx, db = env.DB; if (!db) return err('서버 설정 중입니다', 503);
  const act = (ctx.params.p || [])[0], m = req.method;
  await ensure(db);

  if (act === 'me' && m === 'GET') {
    const u = await me(req, db); if (!u) return err('로그인이 필요합니다', 401);
    if (u.role !== 'installer') return err('시공사 계정이 아닙니다', 403);
    const i = await db.prepare('SELECT company,owner,phone,region,detail,status,created FROM installers WHERE user_id=?').bind(u.id).first();
    return json({ partner: i || null });
  }
  if (m !== 'POST') return err('찾을 수 없습니다', 404);
  const bad = checkPost(req); if (bad) return bad;
  let b; try { b = await req.json(); } catch { return err('잘못된 요청'); }

  if (act === 'login') {
    if (!(await allow(db, 'plogin:' + await ipKey(req), 20, 6e5))) return err('잠시 후 다시 시도해 주세요', 429);
    const u = await db.prepare('SELECT id,pw,role FROM users WHERE email=?').bind(clean(b.email, 80).toLowerCase()).first();
    const [s, h] = u ? u.pw.split(':') : ['', ''];
    if (!u || (await hashPw(String(b.pw || ''), unb64(s))) !== h) return err('이메일 또는 비밀번호가 맞지 않습니다', 401);
    if (u.role !== 'installer') return err('시공사 계정이 아닙니다. 일반 회원은 커뮤니티 로그인을 이용해 주세요', 403);
    return json({ ok: 1 }, 200, setSid(await startSession(db, u.id), 2592000));
  }

  if (act === 'signup') {
    const email = clean(b.email, 80).toLowerCase(), pw = String(b.pw || ''), company = clean(b.company, 30), owner = clean(b.owner, 20),
      phone = digits(b.phone), region = clean(b.region, 10), detail = clean(b.detail, 60);
    if (b.hp) return json({ ok: 1 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('이메일 형식을 확인해 주세요');
    if (pw.length < 8 || pw.length > 64) return err('비밀번호는 8자 이상 입력해 주세요');
    if (company.length < 2 || /[<>&"']/.test(company)) return err('업체명을 2자 이상 입력해 주세요');
    if (owner.length < 2 || /[<>&"']/.test(owner)) return err('담당자 이름을 입력해 주세요');
    if (!isMobile(phone)) return err('휴대폰 번호를 확인해 주세요 (예: 010-1234-5678)');
    if (!REGIONS.includes(region)) return err('활동 지역을 선택해 주세요');
    if (!b.agree) return err('개인정보 수집·이용에 동의해 주세요');
    if (!(await allow(db, 'psign:' + await ipKey(req), 5, 36e5))) return err('잠시 후 다시 시도해 주세요', 429);
    if (await db.prepare('SELECT 1 FROM users WHERE email=?').bind(email).first()) return err('이미 가입된 이메일입니다');
    let nick = company.slice(0, 12);
    for (let i = 0; i < 5 && await db.prepare('SELECT 1 FROM users WHERE nick=?').bind(nick).first(); i++) nick = company.slice(0, 9) + (100 + Math.floor(Math.random() * 900));
    const salt = crypto.getRandomValues(new Uint8Array(16)), now = Date.now();
    const r = await db.prepare('INSERT INTO users(email,nick,pw,role,created) VALUES(?,?,?,?,?)').bind(email, nick, b64(salt) + ':' + await hashPw(pw, salt), 'installer', now).run();
    const uid = r.meta.last_row_id;
    await db.prepare('INSERT INTO installers(user_id,company,owner,phone,region,detail,marketing,status,created) VALUES(?,?,?,?,?,?,?,?,?)').bind(uid, company, owner, phone, region, detail || null, b.marketing ? 1 : 0, 'pending', now).run();
    const p = alertEvent(env, db, 'partner', 'p' + uid, [`업체 ${company}`, `지역 ${region}`, `연락처 ${maskPhone(phone)}`]).catch(() => {});
    if (ctx.waitUntil) ctx.waitUntil(p); else await p;
    return json({ ok: 1, status: 'pending' }, 200, setSid(await startSession(db, uid), 2592000));
  }
  return err('찾을 수 없습니다', 404);
}
