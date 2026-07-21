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
 * เปรียบเทียบใบหน้า 2 รูป (0-1 คะแนน)
 * @param {string} faceA - data URL หรือ base64
 * @param {string} faceB - data URL หรือ base64
 * @param {number} minScore - เกณฑ์ผ่าน (default 0.8)
 * @returns {Promise<{score, match, raw}>}
 */
export async function compareFaces(faceA, faceB, minScore = 0.8) {
  const fd = new FormData();
  fd.append('file1', dataUrlToBlob(faceA), 'face1.jpg');
  fd.append('file2', dataUrlToBlob(faceB), 'face2.jpg');
  fd.append('min_score', String(minScore));
  const r = await callIapp('/face-comparison', fd);
  // iApp คืน similarity หรือ score ขึ้นกับเวอร์ชัน — รองรับหลายชื่อฟิลด์
  const score = Number(r.similarity ?? r.score ?? r.confidence ?? 0);
  return { score, match: score >= minScore, raw: r };
}
