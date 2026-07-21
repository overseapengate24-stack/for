/**
 * lib/iapp.js — Wrapper for iApp Technology e-KYC APIs
 * Requires: process.env.IAPP_API_KEY
 * Docs: https://iapp.co.th/docs/ekyc
 */

const IAPP_BASE = 'https://api.iapp.co.th/v3/store/ekyc';
const KEY = () => (process.env.IAPP_API_KEY || '').trim();

/* แปลง data URL หรือ base64 ธรรมดา → Blob สำหรับส่งเข้า multipart form */
function dataUrlToBlob(dataUrl, fallbackType = 'image/jpeg') {
  const s = String(dataUrl || '');
  const m = s.match(/^data:([^;]+);base64,(.+)$/);
  const type = m ? m[1] : fallbackType;
  const b64 = m ? m[2] : s.replace(/^data:.*;base64,/, '');
  const bytes = Buffer.from(b64, 'base64');
  return new Blob([bytes], { type });
}

async function callIapp(path, formData, timeoutMs = 30000) {
  const key = KEY();
  if (!key) throw new Error('IAPP_API_KEY ยังไม่ได้ตั้งค่าในระบบ');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${IAPP_BASE}${path}`, {
      method: 'POST',
      headers: { apikey: key },
      body: formData,
      signal: ctrl.signal,
    });
  } finally { clearTimeout(timer); }
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `iApp HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.raw = text.slice(0, 500);
    // ช่วย debug บน Vercel logs
    try { console.error('[iapp]', path, res.status, text.slice(0, 300)); } catch {}
    throw err;
  }
  return data || {};
}

/**
 * OCR หน้าบัตรประชาชนไทย
 * @param {string} imageDataUrl - data URL หรือ base64 ล้วน
 * @returns {Promise<{idNumber, thName, enName, dob, faceBase64, raw}>}
 */
export async function ocrThaiIdFront(imageDataUrl) {
  const fd = new FormData();
  fd.append('file', dataUrlToBlob(imageDataUrl), 'idcard.jpg');
  const r = await callIapp('/thai-national-id-card/front', fd);
  return {
    idNumber: String(r.id_number || '').replace(/\s+/g, ''),
    thName: r.th_name || '',
    enName: r.en_name || '',
    dob: r.th_dob || r.en_dob || '',
    faceBase64: r.face || '',
    detectionScore: Number(r.detection_score) || 0,
    raw: r,
  };
}

/**
 * เปรียบเทียบใบหน้า 2 รูป — ใช้ endpoint face-verification (ราคาถูก 0.3 IC)
 * @param {string} faceA - data URL หรือ base64
 * @param {string} faceB - data URL หรือ base64
 * @param {number} minScore - เกณฑ์ผ่าน 0-1 (default 0.5 ≈ threshold 50)
 * @returns {Promise<{score, match, raw}>} score คืน 0-1 ปกติแม้ iApp คืน 0-100
 */
export async function compareFaces(faceA, faceB, minScore = 0.5) {
  const fd = new FormData();
  fd.append('file1', dataUrlToBlob(faceA), 'face1.jpg');
  fd.append('file2', dataUrlToBlob(faceB), 'face2.jpg');
  // iApp face-verification ใช้ threshold แบบ 0-100 (default 36-37)
  fd.append('threshold', String(Math.round(minScore * 100)));
  const r = await callIapp('/face-verification', fd);
  // iApp face-verification คืน { matched: bool, score: 0-100, threshold }
  // face-comparison (legacy) คืน { similarity_score: 0-1 } — รองรับทั้งคู่กันเหนียว
  const rawScore = Number(
    r.score ?? r.similarity_score ?? r.comparison_score ?? r.similarity ?? 0
  );
  // แปลงเป็น 0-1 ให้เป็นมาตรฐานเดียว
  const score = rawScore > 1 ? rawScore / 100 : rawScore;
  const match = typeof r.matched === 'boolean' ? r.matched : (score >= minScore);
  return { score, match, raw: r };
}
