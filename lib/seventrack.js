/**
 * lib/seventrack.js
 * เชื่อมต่อ 17TRACK API (v2.2) — ลงทะเบียน + ดึงสถานะพัสดุจีน
 * ใช้ env: SEVENTEENTRACK_KEY (Security Key จาก 17track)
 */

const KEY  = (process.env.SEVENTEENTRACK_KEY || '').trim();
const BASE = 'https://api.17track.net/track/v2.2';

async function call(path, body) {
  const r = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { '17token': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

/* ลงทะเบียนเลขพัสดุกับ 17track (ทำครั้งเดียวต่อเลข) */
export async function registerTracking(number) {
  if (!KEY || !number) return null;
  try { return await call('register', [{ number }]); }
  catch (e) { return null; }
}

/* ดึงข้อมูลสถานะพัสดุ */
export async function getTrackInfo(number) {
  if (!KEY || !number) return null;
  try { return await call('gettrackinfo', [{ number }]); }
  catch (e) { return null; }
}

/* แปลง events จาก track_info (รูปแบบใหม่ v2.4) ให้อยู่ในรูปแบบมาตรฐาน */
export function normalizeEvents(trackInfo) {
  const providers = trackInfo?.tracking?.providers || [];
  const evs = providers[0]?.events || [];
  return evs.map(ev => ({
    time:     ev.time_iso || ev.time_utc || '',
    location: ev.location || '',
    detail:   ev.description || '',
    stage:    ev.stage || '',
  }));
}

/* หาเวลาที่พัสดุถูกส่งถึง (Delivered) จาก milestone หรือ latest_event */
export function deliveredTime(trackInfo) {
  const mil = (trackInfo?.milestone || []).find(m => m.key_stage === 'Delivered');
  return mil?.time_utc || trackInfo?.latest_event?.time_utc || null;
}
