/**
 * api/reviews.js
 * GET    /api/reviews            → ดึงรีวิวทั้งหมด (page,size)
 * POST   /api/reviews            → เพิ่มรีวิว body:{ name, text, rating, image(dataURL) }
 * DELETE /api/reviews?id=...     → ลบรีวิว (แอดมิน, ต้องมี x-admin-key)
 */

import { addReview, listReviews, deleteReview } from '../lib/redis.js';

const ADMIN_KEY = (process.env.ADMIN_SECRET_KEY || 'changeme').trim();
const MAX_IMG = 700 * 1024; // ~700KB ต่อรูป (หลัง base64)

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const page = Number(req.query.page) || 0;
    const size = Math.min(Number(req.query.size) || 60, 100);
    const reviews = await listReviews(page, size);
    return res.status(200).json({ ok: true, reviews });
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    const name = String(b.name || '').slice(0, 60).trim() || 'ลูกค้า';
    const email = String(b.email || '').slice(0, 120).trim();
    let picture = String(b.picture || '').slice(0, 400).trim();
    if (picture && !/^https:\/\//.test(picture)) picture = ''; // รับเฉพาะ URL https
    const text = String(b.text || '').slice(0, 600).trim();
    const rating = Math.max(1, Math.min(5, Number(b.rating) || 5));
    const image = typeof b.image === 'string' ? b.image : '';

    if (!text && !image) {
      return res.status(400).json({ ok: false, error: 'กรุณาใส่ข้อความหรือรูปอย่างน้อย 1 อย่าง' });
    }
    if (image) {
      if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(image)) {
        return res.status(400).json({ ok: false, error: 'ไฟล์รูปไม่ถูกต้อง' });
      }
      if (image.length > MAX_IMG) {
        return res.status(400).json({ ok: false, error: 'รูปใหญ่เกินไป กรุณาลองใหม่' });
      }
    }

    const review = {
      id: 'rv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name, email, picture, text, rating, image,
      createdAt: new Date().toISOString(),
    };
    await addReview(review);
    return res.status(200).json({ ok: true, review });
  }

  if (req.method === 'DELETE') {
    if (String(req.headers['x-admin-key'] || '').trim() !== ADMIN_KEY) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const id = String(req.query.id || '').trim();
    if (!id) return res.status(400).json({ ok: false, error: 'ระบุ id' });
    const ok = await deleteReview(id);
    return res.status(200).json({ ok });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
