// 시공문의·상담문의 접수: POST /api/inquiries
// 순서: 검증 → DB 저장 → (응답 후) 문자·텔레그램 알림. 알림이 실패해도 문의는 저장되어 있다.
import { err, json, clean, digits, isMobile, checkPost, ensure, allow, ipKey } from '../_lib/core.js';
import { alertInquiry } from '../_lib/notify.js';

export async function onRequestPost(ctx) {
  const { request: req, env } = ctx, db = env.DB; if (!db) return err('서버 설정 중입니다', 503);
  const bad = checkPost(req); if (bad) return bad;
  let b; try { b = await req.json(); } catch { return err('잘못된 요청'); }
  if (b.hp) return json({ ok: 1 }); // 숨은 칸을 채운 자동 입력은 조용히 무시
  const q = {
    type: b.type === 'consult' ? 'consult' : 'work', name: clean(b.name, 20), phone: digits(b.phone),
    region: clean(b.region, 20), service: clean(b.service, 20), car: clean(b.car, 40), part: clean(b.part, 60),
    want_date: clean(b.date, 12), want_time: clean(b.time, 10), memo: clean(b.memo, 500), marketing: b.marketing ? 1 : 0,
  };
  if (!b.agree) return err('개인정보 수집·이용에 동의해 주세요');
  if (q.name.length < 2 || /[<>]/.test(q.name)) return err('이름을 확인해 주세요');
  if (!isMobile(q.phone)) return err('휴대폰 번호를 확인해 주세요 (예: 010-1234-5678)');
  if (q.type === 'work' && !q.service) return err('시공 서비스를 선택해 주세요');
  await ensure(db);

  const dup = await db.prepare('SELECT id FROM inquiries WHERE phone=? AND type=? AND service IS ? AND memo IS ? AND created>?')
    .bind(q.phone, q.type, q.service || null, q.memo || null, Date.now() - 6e5).first();
  if (dup) return json({ ok: 1, dup: 1 }); // 같은 내용 중복 제출
  if (!(await allow(db, 'inq-ip:' + await ipKey(req), 5, 6e5)) || !(await allow(db, 'inq-ph:' + q.phone, 3, 36e5))) return err('잠시 후 다시 시도해 주세요', 429);

  const r = await db.prepare('INSERT INTO inquiries(type,name,phone,region,service,car,part,want_date,want_time,memo,marketing,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(q.type, q.name, q.phone, q.region || null, q.service || null, q.car || null, q.part || null, q.want_date || null, q.want_time || null, q.memo || null, q.marketing, Date.now()).run();
  q.id = r.meta.last_row_id;
  const p = alertInquiry(env, db, q).catch(() => {});
  if (ctx.waitUntil) ctx.waitUntil(p); else await p;
  return json({ ok: 1 });
}
