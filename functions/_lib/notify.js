// 운영자 알림: 문자(솔라피)와 텔레그램. 키·번호·채팅 ID는 전부 서버 환경변수에서만 읽는다.
// 환경변수: SOLAPI_API_KEY, SOLAPI_API_SECRET, SMS_FROM(등록된 발신번호), OPERATOR_PHONE(운영자 수신번호),
//          SMS_CUSTOMER_ACK=1 (고객 접수확인 문자, 기본 꺼짐), TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
import { SITE, enc, digits } from './core.js';

const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const kst = () => new Date(Date.now() + 9 * 36e5).toISOString().replace('T', ' ').slice(0, 16) + ' KST';
export const maskPhone = (p) => digits(p).replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-****-$3');
export const maskName = (n) => { const a = [...String(n || '')]; return a.length < 2 ? '*' : a.length === 2 ? a[0] + '*' : a[0] + '*'.repeat(a.length - 2) + a[a.length - 1]; };
const TYPE = { work: '시공문의', consult: '상담문의' };

export async function sendTelegram(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return { ok: false, detail: 'not_configured' };
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
    });
    return r.ok ? { ok: true } : { ok: false, detail: 'http_' + r.status };
  } catch (e) { return { ok: false, detail: 'error_' + (e && e.name || 'x') }; }
}

// 솔라피(Solapi) 단건 발송. 발신번호는 솔라피에서 사전 등록·인증된 번호여야 한다.
export async function sendSms(env, to, text, subject) {
  const key = env.SOLAPI_API_KEY, secret = env.SOLAPI_API_SECRET, from = digits(env.SMS_FROM), dest = digits(to);
  if (!key || !secret || !from || !dest) return { ok: false, detail: 'not_configured' };
  try {
    const date = new Date().toISOString(), salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = hex(await crypto.subtle.sign('HMAC', k, enc.encode(date + salt)));
    const bytes = [...text].reduce((n, c) => n + (c.charCodeAt(0) > 127 ? 2 : 1), 0);
    const message = { to: dest, from, text, type: bytes > 90 ? 'LMS' : 'SMS' };
    if (bytes > 90) message.subject = subject || '리얼무토';
    const r = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST', signal: AbortSignal.timeout(5000),
      headers: { 'content-type': 'application/json', authorization: `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${sig}` },
      body: JSON.stringify({ message }),
    });
    if (r.ok) return { ok: true };
    const j = await r.json().catch(() => ({}));
    return { ok: false, detail: 'http_' + r.status + (j.errorCode ? ':' + String(j.errorCode).slice(0, 40) : '') };
  } catch (e) { return { ok: false, detail: 'error_' + (e && e.name || 'x') }; }
}

async function log(db, kind, channel, ref, res) {
  try { await db.prepare('INSERT INTO notify_log(kind,channel,ref,ok,detail,created) VALUES(?,?,?,?,?,?)').bind(kind, channel, ref, res.ok ? 1 : 0, res.detail || null, Date.now()).run(); } catch {}
}
async function tg(env, db, kind, ref, text) { const r = await sendTelegram(env, text); await log(db, kind, 'telegram', ref, r); return r; }

// 가입·신청 알림(텔레그램만). 개인정보는 마스킹하고 자세한 내용은 관리 화면에서 본다.
const EVT = { signup: '신규 회원가입', partner: '시공사 가입 신청' };
export function alertEvent(env, db, kind, ref, lines) {
  return tg(env, db, kind, ref, `[리얼무토] ${EVT[kind]}\n접수 ${kst()}\n${lines.join('\n')}\n관리: ${SITE}/admin#${ref}`);
}

// 문의 알림: 운영자 텔레그램(마스킹) + 운영자 문자(전체 정보) + 선택적으로 고객 접수확인 문자.
// 한 곳이 실패해도 다른 곳은 보내고, 결과는 notify_log에 남긴다. 호출한 쪽은 이 결과와 무관하게 접수를 성공 처리한다.
export async function alertInquiry(env, db, q) {
  const ref = 'q' + q.id, label = TYPE[q.type] || '문의';
  const memo = String(q.memo || '').replace(/\s+/g, ' ').slice(0, 60);
  const tgText = `[리얼무토] 새 ${label}\n접수 ${kst()}\n이름 ${maskName(q.name)} / ${maskPhone(q.phone)}\n지역 ${q.region || '-'} / ${q.service || '-'}\n관리: ${SITE}/admin#${ref}`;
  const smsText = `[리얼무토 ${label}]\n${q.name} ${q.phone}\n지역 ${q.region || '-'} / ${q.service || '-'}\n${memo || '-'}\n${SITE}/admin#${ref}`;
  const jobs = [tg(env, db, 'inquiry', ref, tgText)];
  jobs.push(sendSms(env, env.OPERATOR_PHONE, smsText, label).then(async (r) => { await log(db, 'inquiry', 'sms', ref, r); return r; }));
  if (env.SMS_CUSTOMER_ACK === '1') {
    jobs.push(sendSms(env, q.phone, `[리얼무토] ${q.name}님, ${label}이 접수되었습니다. 확인 후 연락드리겠습니다.`, '접수 안내').then(async (r) => { await log(db, 'inquiry_ack', 'sms', ref, r); return r; }));
  }
  return Promise.allSettled(jobs);
}
