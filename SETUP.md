# 🚀 OVERSEA PENGATE — ขั้นตอน Deploy ทั้งระบบ

## โครงสร้างไฟล์
```
oversea-pengate/
├── index.html          ← หน้าหลัก (ลูกค้า)
├── admin.html          ← หน้าแอดมิน
├── vercel.json         ← config routing + CORS
├── package.json
├── .env.example        ← ตัวอย่าง env vars
├── lib/
│   └── redis.js        ← Upstash Redis helper
└── api/
    ├── orders.js           POST /api/orders  (รับออเดอร์)
    │                       GET  /api/orders  (แอดมินดูรายการ)
    ├── orders/
    │   ├── track.js        GET  /api/orders/track?no=OPXXXXXX
    │   └── update.js       PATCH /api/orders/update?no=OPXXXXXX
```

---

## ขั้นตอนที่ 1 — สร้าง Upstash Redis ฟรี

1. ไปที่ https://console.upstash.com
2. สมัคร/ล็อกอิน (ใช้ Google ได้)
3. กด **Create Database**
   - Name: `oversea-pengate`
   - Region: **Asia Pacific (Singapore)** ← ใกล้ไทยสุด
   - Type: **Regional**
4. เสร็จแล้วไปที่ tab **REST API**
5. คัดลอก **UPSTASH_REDIS_REST_URL** และ **UPSTASH_REDIS_REST_TOKEN**

---

## ขั้นตอนที่ 2 — Deploy บน Vercel

### Option A: Drag & Drop (ง่ายสุด)
1. ไปที่ https://vercel.com → New Project
2. Drag โฟลเดอร์ทั้งหมดขึ้น หรือ connect GitHub repo

### Option B: CLI
```bash
npm install -g vercel
cd oversea-pengate
vercel login
vercel --prod
```

---

## ขั้นตอนที่ 3 — ตั้งค่า Environment Variables บน Vercel

ใน Vercel Dashboard → Project → **Settings → Environment Variables**

| Variable | Value |
|----------|-------|
| `UPSTASH_REDIS_REST_URL` | URL จาก Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Token จาก Upstash |
| `ADMIN_SECRET_KEY` | รหัสผ่านแอดมินที่คุณตั้งเอง เช่น `OPG-Admin-2025!` |

จากนั้น **Redeploy** หนึ่งรอบ

---

## ขั้นตอนที่ 4 — อัปเดต index.html

แก้ไขบรรทัด:
```js
const API_BASE = "";  // ← เปลี่ยนเป็น URL ของคุณ
```
เป็น:
```js
const API_BASE = "https://your-project.vercel.app";
```

เช่นเดียวกับ admin.html บรรทัดเดียวกัน

---

## API Endpoints สรุป

| Method | Path | Auth | คำอธิบาย |
|--------|------|------|----------|
| `POST` | `/api/orders` | — | ส่งออเดอร์ใหม่จากหน้าเว็บ |
| `GET`  | `/api/orders` | x-admin-key | ดูรายการออเดอร์ทั้งหมด (แอดมิน) |
| `GET`  | `/api/orders/track?no=OP...` | — | ตรวจสถานะออเดอร์ (ลูกค้า) |
| `PATCH`| `/api/orders/update?no=OP...` | x-admin-key | อัปเดตสถานะ/ราคา (แอดมิน) |

---

## สถานะออเดอร์

| Code | ความหมาย |
|------|----------|
| `NEW` | รอเช็คราคา |
| `QUOTED` | แจ้งราคาแล้ว รอชำระเงิน |
| `PAID` | ชำระเงินแล้ว |
| `ORDERED` | สั่งซื้อกับร้านจีนแล้ว |
| `SHIPPED` | กำลังจัดส่ง |
| `DONE` | สำเร็จ |
| `CANCELLED` | ยกเลิก |

---

## ทดสอบ Local

```bash
cp .env.example .env
# แก้ไข .env ใส่ค่าจริง
npm install
npx vercel dev
# เปิด http://localhost:3000
```
