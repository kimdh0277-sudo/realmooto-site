// 운영자 관리 API (role='admin'만): 문의·시공사 신청·알림 기록 조회와 처리
//  GET  /api/admin/inquiries   GET /api/admin/installers   GET /api/admin/log
//  POST /api/admin/installers/:userId {status: approved|rejected|pending}
//  POST /api/admin/inquiries/:id {status: new|done}
import { err, json, checkPost, ensure, me } from '../../_lib/core.js';

export async function onRequest({ request: req, env, params }) {
  const db = env.DB; if (!db) return err('서버 설정 중입니다', 503);
  const u = await me(req, db);
  if (!u) return err('로그인이 필요합니다', 401);
  if (u.role !== 'admin') return err('권한이 없습니다', 403);
  await ensure(db);
  const [a, id] = params.a || [], m = req.method;

  if (m === 'GET') {
    if (a === 'inquiries') return json({ rows: (await db.prepare('SELECT * FROM inquiries ORDER BY id DESC LIMIT 100').all()).results });
    if (a === 'installers') return json({ rows: (await db.prepare('SELECT i.*,u.email FROM installers i JOIN users u ON u.id=i.user_id ORDER BY i.created DESC LIMIT 100').all()).results });
    if (a === 'log') return json({ rows: (await db.prepare('SELECT * FROM notify_log ORDER BY id DESC LIMIT 100').all()).results });
    return err('찾을 수 없습니다', 404);
  }
  if (m === 'POST') {
    const bad = checkPost(req); if (bad) return bad;
    let b; try { b = await req.json(); } catch { return err('잘못된 요청'); }
    if (a === 'installers' && /^\d+$/.test(id || '') && ['approved', 'rejected', 'pending'].includes(b.status)) {
      await db.prepare('UPDATE installers SET status=?,decided=? WHERE user_id=?').bind(b.status, Date.now(), +id).run();
      return json({ ok: 1 });
    }
    if (a === 'inquiries' && /^\d+$/.test(id || '') && ['new', 'done'].includes(b.status)) {
      await db.prepare('UPDATE inquiries SET status=? WHERE id=?').bind(b.status, +id).run();
      return json({ ok: 1 });
    }
  }
  return err('찾을 수 없습니다', 404);
}
