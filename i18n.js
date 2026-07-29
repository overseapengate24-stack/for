/**
 * i18n.js — Thai / English / Chinese switcher
 * Include this on every page: <script src="/i18n.js" defer></script>
 *
 * How it works:
 *  - Language stored in localStorage.opg_lang (persists across pages)
 *  - On load: walks text nodes + common attrs (placeholder/title/alt/aria-label)
 *    replacing Thai strings that exist in the dictionary
 *  - MutationObserver catches JS-added nodes (orders/bills/admin render lists)
 *
 * Adding translations: just extend TRANSLATIONS[<lang>] with { "ไทย": "..." }
 * Keys must match the TRIMMED text as it appears in HTML/DOM (whitespace at
 * ends is preserved in the DOM node so we replace only the trimmed portion).
 */
(function () {
  var LANG_KEY = 'opg_lang';
  var currentLang = localStorage.getItem(LANG_KEY) || 'th';

  /* ────────────── DICTIONARY ────────────── */
  var TRANSLATIONS = {
    en: {
      /* --- header / nav / sidebar --- */
      'หน้าหลัก': 'Home',
      'หน้าแรก': 'Home',
      'วิธีสั่งซื้อ': 'How to Order',
      'คำนวณค่าส่ง': 'Shipping Calculator',
      'สั่งซื้อ': 'Order',
      'ตรวจสอบสถานะออเดอร์': 'Track Order',
      'ตรวจสอบสถานะ': 'Track Order',
      'ตรวจสอบสถานะสินค้า': 'Track Shipment',
      'ติดตามสถานะสินค้า': 'Track Shipment',
      'รายการสั่งซื้อสินค้าจีน': 'China Orders',
      'รายการบิลค่าขนส่ง': 'Shipping Bills',
      'ที่อยู่ของฉัน': 'My Addresses',
      'รีวิว': 'Reviews',
      'ติดต่อ': 'Contact',
      'ติดต่อเรา': 'Contact Us',
      'การเงิน (เติมเงิน)': 'Wallet (Top up)',
      'เพิ่มเพื่อน LINE': 'Add LINE Friend',
      'เข้าสู่ระบบ': 'Log In',
      'สมัครสมาชิก': 'Sign Up',
      'ออก': 'Log Out',
      'ยังไม่เข้าสู่ระบบ': 'Not signed in',
      'ภาษา': 'Language',

      /* --- hero / homepage --- */
      'นำเข้าสินค้าจากจีน': 'Import from China',
      'ส่งถึงมือคุณ': 'Delivered to you',
      'แค่วางลิงก์สินค้าที่อยากได้ ทีมงาน Oversea PenGate จะเช็คราคารวมค่าส่งให้':
        'Just paste the product link and our team quotes total shipping-included price.',
      'ฝากสั่งสินค้า + จ่ายเงิน': 'Purchase + Pay-on-behalf',
      'วางลิงก์ + รูป + อธิบาย': 'Paste link + photo + notes',
      'ฝากจ่ายเงิน': 'Pay-on-behalf',
      'เราจ่ายหยวน · จ่ายบาทตามเรท': 'We pay CNY · You pay THB at rate',
      'บริการชิปปิ้ง': 'Shipping Service',
      'จีน → ไทย → ส่งถึงบ้าน': 'China → Thailand → Door delivery',

      /* --- steps --- */
      'ขั้นตอนง่าย ๆ': 'Easy Steps',
      'วิธีสั่งซื้อ & นำเข้าสินค้า': 'How to Order & Import',
      'เลือกบริการที่เหมาะกับคุณ — สั่งซื้อจากเว็บจีน หรือให้เราสั่งให้ก็ได้':
        'Choose the service that fits — order from China yourself or let us order for you',

      /* --- LINE banner --- */
      'แจ้งราคาทาง LINE': 'Quote via LINE',
      'ภายใน 24 ชม.': 'Within 24 hours',
      'วางลิงก์สินค้า': 'Paste product link',
      'ส่งถึงบ้าน': 'Deliver to home',
      'รวดเร็ว ปลอดภัย': 'Fast & Safe',
      'กำลังดำเนินการ': 'In progress',

      /* --- login/register modal --- */
      'กรอกอีเมลและรหัสผ่านเพื่อเข้าสู่ระบบ': 'Enter email/phone and password to log in',
      'กรอกข้อมูลเพื่อสมัครสมาชิกใหม่': 'Fill in details to create a new account',
      'อีเมล หรือ เบอร์โทร': 'Email or Phone',
      'อีเมล': 'Email',
      'รหัสผ่าน': 'Password',
      'ตั้งรหัสผ่าน (อย่างน้อย 6 ตัว)': 'Set password (at least 6 chars)',
      'ยืนยันรหัสผ่าน': 'Confirm password',
      'เบอร์โทรศัพท์ (เช่น 0812345678)': 'Phone (e.g. 0812345678)',
      'ส่ง OTP': 'Send OTP',
      'ส่งอีกครั้ง': 'Resend',
      'รหัสส่งไปที่ SMS แล้ว': 'Code sent via SMS',
      'รหัสส่งไปที่ SMS แล้ว (หมดอายุใน 5 นาที)': 'Code sent via SMS (expires in 5 min)',
      '📷 ถ่ายรูป / เลือกรูปบัตรประชาชน': '📷 Take / Choose ID card photo',
      '✅ ตรวจสอบบัตรผ่านแล้ว — กดเพื่อเปลี่ยนรูป': '✅ ID verified — tap to change photo',
      '🤝 ลงทะเบียน': '🤝 Register',
      '🔑 เข้าสู่ระบบ': '🔑 Log In',
      'ยังไม่มีบัญชี?': "Don't have an account?",
      'มีบัญชีอยู่แล้ว?': 'Already have an account?',
      'เข้าชมเว็บก่อน': 'Browse first',
      'ข้อมูลถูกเก็บอย่างปลอดภัย': 'Data stored securely',
      'นโยบายความเป็นส่วนตัว': 'Privacy Policy',

      /* --- ID verify screen --- */
      '🔍 กำลังตรวจสอบบัตรประชาชน': '🔍 Verifying ID card',
      'กรุณารอสักครู่…': 'Please wait…',
      'กำลังตรวจสอบบัตร…': 'Verifying card…',
      'ตรวจสอบเสร็จ — กดปุ่มเพื่อไปกรอกข้อมูลต่อ': 'Done — tap the button to continue',
      'ตรวจสอบสำเร็จ': 'Verified',
      'ตรวจสอบไม่ผ่าน': 'Verification failed',
      '✅ กลับไปกรอกข้อมูลสมัคร': '✅ Continue registration',
      '🔁 ถ่ายใหม่': '🔁 Retake',

      /* --- common actions --- */
      'บันทึก': 'Save',
      'ยกเลิก': 'Cancel',
      'ยืนยัน': 'Confirm',
      'ลบ': 'Delete',
      'แก้ไข': 'Edit',
      'ปิด': 'Close',
      'ค้นหา': 'Search',
      'ทั้งหมด': 'All',
      'ต่อไป': 'Next',
      'ย้อนกลับ': 'Back',
      'ถัดไป': 'Next',
      'ดู': 'View',
      'ดาวน์โหลด': 'Download',
      'ก็อปปี้': 'Copy',
      'คัดลอก': 'Copy',
      'คัดลอกที่อยู่': 'Copy Address',
      'อัปโหลด': 'Upload',
      'ส่ง': 'Send',
      'พิมพ์': 'Print',
      'รีเฟรช': 'Refresh',

      /* --- order form (homepage) --- */
      'สั่งซื้อสินค้า': 'Order Product',
      'วางลิงก์สินค้าที่อยากได้': 'Paste the product link you want',
      'รองรับ Taobao, Tmall, 1688 — ระบบจะตรวจจับร้านค้าให้อัตโนมัติ': 'Supports Taobao, Tmall, 1688 — shop auto-detected',
      'รายการสั่งซื้อของคุณ': 'Your Order Items',
      'ยินดีต้อนรับ': 'Welcome',
      'กรอกข้อมูลสินค้า': 'Fill product details',
      'กรอกข้อมูลให้ครบแล้วกด "บันทึก" ด้านล่าง': 'Fill all fields then press "Save" below',
      'รอวางลิงก์': 'Awaiting link',
      'ชื่อร้าน': 'Shop name',
      '— เลือกร้านค้า —': '— Select shop —',
      'ลิงก์สินค้า Taobao / 1688 / Tmall...': 'Product link Taobao / 1688 / Tmall...',
      'รูปสินค้า (อัปโหลดจากเครื่อง)': 'Product photo (upload)',
      '📷 เลือกรูป / ถ่ายรูป': '📷 Choose / Take photo',
      'อธิบายสิ่งที่อยากได้ (สี / ไซต์ / รุ่น / จำนวน / รายละเอียด)': 'Describe what you want (color / size / model / qty / details)',
      'เพิ่มสินค้า': 'Add item',
      'เพิ่มรายการสินค้า': 'Add item',
      'จำนวน': 'Quantity',
      'สี': 'Color',
      'ไซต์': 'Size',
      'รุ่น': 'Model',
      'รายละเอียด': 'Details',
      'ราคา': 'Price',
      'ราคาโดยประมาณ': 'Estimated price',
      'ยอดรวม': 'Total',
      'รวมทั้งสิ้น': 'Grand total',
      'ค่าส่ง': 'Shipping',
      'ค่าขนส่ง': 'Shipping fee',
      'บาท': 'THB',
      'หยวน': 'CNY',
      'กิโลกรัม': 'kg',
      'กก.': 'kg',
      'ตะกร้าสินค้า': 'Cart',
      'ตะกร้า': 'Cart',
      'ตีลังไม้': 'Wood crate',
      'ตรวจสอบคุณภาพ (QC)': 'Quality check (QC)',
      'บันทึกออเดอร์': 'Save order',
      'ส่งออเดอร์': 'Submit order',
      'ยืนยันการสั่งซื้อ': 'Confirm order',
      'สำเร็จ': 'Success',
      'ล้มเหลว': 'Failed',
      'กรุณากรอกข้อมูลให้ครบ': 'Please fill all fields',

      /* --- status labels --- */
      'สถานะ': 'Status',
      'รอตรวจสอบ': 'Pending review',
      'รอชำระเงิน': 'Awaiting payment',
      'ชำระแล้ว': 'Paid',
      'กำลังจัดส่ง': 'Shipping',
      'จัดส่งสำเร็จ': 'Delivered',
      'ถึงโกดังไทย': 'Arrived at TH warehouse',
      'ถึงโกดังจีน': 'Arrived at CN warehouse',
      'รอเลขขนส่งจีน': 'Awaiting CN tracking',
      'สินค้าออกจากจีน': 'Departed China',
      'ส่งเข้าโกดัง': 'To warehouse',
      'ฝากจ่ายเงินสำเร็จ': 'Pay-on-behalf completed',
      'ยกเลิกออเดอร์': 'Cancelled',
      'ทั้งหมด': 'All',

      /* --- topup / wallet --- */
      'เติมเงิน': 'Top up',
      'เครดิตของฉัน': 'My Credit',
      'ยอดเครดิต': 'Credit balance',
      'จำนวนเงินที่ต้องการเติม': 'Amount to top up',
      'อัปโหลดสลิป': 'Upload slip',
      'แนบสลิปการโอน': 'Attach transfer slip',
      'แจ้งเติมเงิน': 'Report top up',
      'ประวัติการเติมเงิน': 'Top up history',
      'วันที่': 'Date',
      'จำนวน': 'Amount',
      'สถานะ': 'Status',
      'รออนุมัติ': 'Awaiting approval',
      'อนุมัติแล้ว': 'Approved',
      'ปฏิเสธ': 'Rejected',

      /* --- how-ship page (Chinese warehouse) --- */
      'วิธีส่งสินค้าเข้าโกดังเรา': 'How to ship goods to our warehouse',
      'สั่งซื้อสินค้ากับร้านจีน': 'Order from a Chinese shop',
      'หรือมีสินค้าที่ต้องการนำเข้าอยู่แล้ว': 'or have goods to import already',
      'ส่งสินค้ามาที่อยู่โกดังของเรา': 'Ship to our warehouse address',
      'ใช้ที่อยู่ด้านล่างเป็นที่อยู่ผู้รับตอนกรอกในร้านจีน/ขนส่ง': 'Use the address below as the recipient when placing the order',
      'แจ้งเลขพัสดุกับทีมงาน': 'Notify us of the tracking number',
      'เพื่อให้เราติดตามและรับของเข้าโกดังให้': 'So we can track and receive the goods',
      'ของเข้าโกดัง → ส่งมาไทย': 'Warehouse in → Ship to Thailand',
      'ทีมงานแจ้งยอดค่าขนส่ง แล้วจัดส่งถึงคุณ': 'We quote shipping fee then deliver to you',
      'ที่อยู่โกดังจีนสำหรับส่งสินค้า': 'China warehouse address',
      'ผู้รับ / ที่อยู่จัดส่ง': 'Recipient / Shipping address',
      '📋 คัดลอกที่อยู่': '📋 Copy address',
      '✅ คัดลอกแล้ว': '✅ Copied',
      'ข้อมูลที่ต้องแจ้งเรา (หลังส่งของ)': 'Info to send us (after shipping)',
      'เลขพัสดุ (Tracking)': 'Tracking number',
      'เลขขนส่งจีนที่ได้มา': 'China tracking number received',
      'ร้านค้า + ลิงก์': 'Shop + link',
      'จำนวนกล่อง / ชิ้น': 'Boxes / pieces',
      'เพื่อตรวจรับให้ครบ': 'For accurate receipt check',
      'รูปสินค้า (ถ้ามี)': 'Product photo (if any)',
      'ตรวจรับเร็วขึ้น': 'Faster receipt',
      'แจ้งส่งของเข้าโกดัง': 'Notify shipping to warehouse',
      'แจ้งส่งของเข้าโกดัง': 'Notify shipping to warehouse',
      'ทางรถ': 'By road',
      'ทางเรือ': 'By sea',
      'การจัดส่ง': 'Shipping method',
      'ประเภทสินค้า': 'Product type',
      'สินค้าทั่วไป': 'General goods',
      'สินค้าแบรนด์/ลิขสิทธิ์': 'Brand/Licensed goods',
      'จำนวนชิ้น': 'Item quantity',
      'ลิงก์สินค้า': 'Product link',
      'กรุณากรอกเลขพัสดุ (Tracking)': 'Please fill tracking number',
      'กรุณาเข้าสู่ระบบก่อน': 'Please log in first',
      '📤 แจ้งส่งของเข้าโกดัง': '📤 Notify warehouse shipping',
      'กำลังส่ง…': 'Sending…',

      /* --- orders / bills / general lists --- */
      'ยังไม่มีรายการสั่งซื้อ': 'No orders yet',
      'ยังไม่มีรายการ': 'No records',
      'ไม่มีรายการในสถานะนี้': 'No items in this status',
      'ไม่พบข้อมูล': 'No data found',
      'ค้นหาข้อมูล': 'Search',
      'รายการวางบิล': 'Bill entries',
      'รายการรวมบิล': 'Combined bills',
      'สถานะทั้งหมด': 'All statuses',
      'เลขที่บิล': 'Bill No.',
      'เลขที่กลุ่มบิล': 'Bill group No.',
      'จำนวนรายการ': 'Item count',
      'ประเภทจัดส่ง': 'Shipping type',
      'ยอดชำระ THB': 'Amount THB',
      'เลขแทรคส่งของ': 'Tracking No.',
      'เจ้าหน้าที่ หมายเหตุ': 'Staff · Note',
      'วันที่ออกบิล': 'Bill date',
      'วันที่สั่งซื้อ': 'Order date',
      'สร้างกลุ่มบิล': 'Create bill group',
      'ประวัติบิล': 'Bill history',
      'เลขที่ออเดอร์': 'Order No.',
      'เลขออเดอร์': 'Order No.',
      'เลขที่พัสดุ': 'Package No.',

      /* --- calc --- */
      'คำนวณค่าขนส่ง': 'Shipping Calculator',
      'ทางรถ (ถูกกว่า)': 'By road (cheaper)',
      'ทางเรือ (ประหยัดสุด)': 'By sea (most economical)',
      'น้ำหนัก': 'Weight',
      'ปริมาตร (คิว)': 'Volume (m³)',
      'กว้าง': 'Width',
      'ยาว': 'Length',
      'สูง': 'Height',
      'เซนติเมตร': 'centimeters',
      'ซม.': 'cm',
      'คำนวณ': 'Calculate',
      'ผลการคำนวณ': 'Result',
      'ราคารวมค่าส่งประมาณ': 'Estimated total incl. shipping',
      'อัตราค่าส่ง': 'Shipping rate',

      /* --- po (purchase order detail) --- */
      'ตรวจสอบสถานะ PO': 'PO Status',
      'เลข PO': 'PO No.',
      'สถานะปัจจุบัน': 'Current status',
      'กำลังตรวจสอบ': 'Under review',
      'ทีมงานจะตรวจสอบและแจ้งราคา/ค่าส่งกลับทาง LINE': 'Our team will review and reply the price/shipping via LINE',
      'เก็บเลข PO นี้ไว้ตรวจสอบสถานะภายหลังได้': 'Save this PO number to check status later',
      'ชำระเงินก่อนวันที่': 'Pay before',
      'เจ้าหน้าที่': 'Staff',
      'หมายเหตุ': 'Note',

      /* --- topup --- */
      'บัญชีธนาคารสำหรับโอน': 'Bank account for transfer',
      'ธนาคาร': 'Bank',
      'เลขบัญชี': 'Account number',
      'ชื่อบัญชี': 'Account name',
      'จำนวนเงินที่โอน': 'Transferred amount',
      'แนบสลิป': 'Attach slip',
      'เลือกไฟล์สลิป': 'Choose slip file',
      '📸 อัปโหลดสลิป': '📸 Upload slip',
      'กำลังตรวจสอบสลิป': 'Verifying slip',

      /* --- track --- */
      'ค้นหาสถานะออเดอร์': 'Search order status',
      'พิมพ์เลขออเดอร์': 'Enter order number',
      'ไม่พบออเดอร์': 'Order not found',
      'พบออเดอร์': 'Order found',
      'ประวัติสถานะ': 'Status history',
      'สรุปออเดอร์': 'Order summary',

      /* --- cart --- */
      'ตะกร้าสินค้าของคุณ': 'Your cart',
      'สั่งเพิ่ม': 'Add more',
      'ค่าตีลังไม้': 'Crate fee',
      'ค่าตรวจ QC': 'QC fee',
      'ยอดสินค้ารวม': 'Items total',
      'ยอดขนส่งรวม': 'Shipping total',
      'มากกว่า': 'More than',
      'ตีลังไม้เริ่มต้นที่ 50 หยวน ต่อ ลัง': 'Crating starts at 50 CNY per crate',
      '*ทุกๆ +0.1 คิว จะเพิ่มค่าตีลังไม้ 20 หยวน': '*Every +0.1 m³ adds 20 CNY crate fee',
      '*รายการสั่งซื้อสินค้าสูงสุดได้ 100 รายการ / บิล เท่านั้น': '*Max 100 items per bill',

      /* --- admin --- */
      'แอดมิน': 'Admin',
      'แดชบอร์ด': 'Dashboard',
      'สมาชิก': 'Members',
      'ออเดอร์': 'Orders',
      'บิล': 'Bills',
      'เติมเงิน': 'Top up',
      'ตั้งค่า': 'Settings',
      'ออกจากระบบ': 'Log out',
      'ค้นหาสมาชิก': 'Search members',
      'ค้นหาออเดอร์': 'Search orders',
      'รหัสสมาชิก': 'Member code',
      'ชื่อ': 'Name',
      'เบอร์': 'Phone',
      'อีเมล': 'Email',
      'เลขบัตร ปชช': 'ID number',
      'รูปบัตร': 'ID photo',
      'ดูรูปบัตร': 'View ID photo',
      'สร้างเมื่อ': 'Created at',
      'เข้าสู่ระบบล่าสุด': 'Last login',
      'จำนวนออเดอร์': 'Total orders',
      'ยอดขายรวม': 'Total sales',
      'รีเซ็ตการยืนยันตัวตนทั้งหมด': 'Reset all KYC',
      'รีเซ็ตเครดิตทั้งหมด': 'Reset all credits',
      'เติมรหัสสมาชิกให้บัญชีเก่า': 'Backfill member codes',
      'จัดการออเดอร์': 'Manage orders',
      'อัปเดตสถานะ': 'Update status',
      'บันทึกการเปลี่ยนแปลง': 'Save changes',
      'อนุมัติ': 'Approve',
      'ปฏิเสธการเติมเงิน': 'Reject top up',
      'อนุมัติการเติมเงิน': 'Approve top up',
      'ระบุยอดเติมเงิน': 'Set amount',
      'รอแอดมินระบุยอด': 'Awaiting admin amount',

      /* --- reviews --- */
      'รีวิวจากลูกค้าจริง': 'Reviews from real customers',
      'เขียนรีวิว': 'Write review',
      'ส่งรีวิว': 'Submit review',
      'ให้คะแนน': 'Rating',
      'ยังไม่มีรีวิว': 'No reviews yet',

      /* --- misc / footer --- */
      'สงวนลิขสิทธิ์': 'All rights reserved',
      'ทั้งหมด': 'All',
      'กรุณาเข้าสู่ระบบ': 'Please log in',
      'เข้าสู่ระบบเพื่อดูข้อมูล': 'Log in to see your data',
      'ยินดีต้อนรับ คุณ': 'Welcome,',
      'ออกจากระบบเรียบร้อย': 'Logged out successfully',
      'บันทึกสำเร็จ': 'Saved successfully',
      'ลบสำเร็จ': 'Deleted successfully',
      'มีข้อผิดพลาด': 'An error occurred',
      'กรุณาลองใหม่': 'Please try again',
    },

    zh: {
      /* --- header / nav / sidebar --- */
      'หน้าหลัก': '首页',
      'หน้าแรก': '首页',
      'วิธีสั่งซื้อ': '订购方式',
      'คำนวณค่าส่ง': '运费计算',
      'สั่งซื้อ': '下单',
      'ตรวจสอบสถานะออเดอร์': '订单状态',
      'ตรวจสอบสถานะ': '订单状态',
      'ตรวจสอบสถานะสินค้า': '货物追踪',
      'ติดตามสถานะสินค้า': '货物追踪',
      'รายการสั่งซื้อสินค้าจีน': '中国商品订单',
      'รายการบิลค่าขนส่ง': '运费账单',
      'ที่อยู่ของฉัน': '我的地址',
      'รีวิว': '评价',
      'ติดต่อ': '联系',
      'ติดต่อเรา': '联系我们',
      'การเงิน (เติมเงิน)': '钱包 (充值)',
      'เพิ่มเพื่อน LINE': '添加 LINE 好友',
      'เข้าสู่ระบบ': '登录',
      'สมัครสมาชิก': '注册',
      'ออก': '退出',
      'ยังไม่เข้าสู่ระบบ': '未登录',
      'ภาษา': '语言',

      /* --- hero / homepage --- */
      'นำเข้าสินค้าจากจีน': '从中国进口商品',
      'ส่งถึงมือคุณ': '送货上门',
      'แค่วางลิงก์สินค้าที่อยากได้ ทีมงาน Oversea PenGate จะเช็คราคารวมค่าส่งให้':
        '只需粘贴商品链接,Oversea PenGate 团队将为您报含运费总价。',
      'ฝากสั่งสินค้า + จ่ายเงิน': '代购 + 代付',
      'วางลิงก์ + รูป + อธิบาย': '粘贴链接 + 图片 + 说明',
      'ฝากจ่ายเงิน': '代付',
      'เราจ่ายหยวน · จ่ายบาทตามเรท': '我们付人民币 · 您按汇率付泰铢',
      'บริการชิปปิ้ง': '集运服务',
      'จีน → ไทย → ส่งถึงบ้าน': '中国 → 泰国 → 送货上门',

      /* --- steps --- */
      'ขั้นตอนง่าย ๆ': '简单步骤',
      'วิธีสั่งซื้อ & นำเข้าสินค้า': '订购与进口流程',
      'เลือกบริการที่เหมาะกับคุณ — สั่งซื้อจากเว็บจีน หรือให้เราสั่งให้ก็ได้':
        '选择适合的服务 — 自行下单或委托我们代购',

      /* --- LINE banner --- */
      'แจ้งราคาทาง LINE': 'LINE 报价',
      'ภายใน 24 ชม.': '24 小时内',
      'วางลิงก์สินค้า': '粘贴商品链接',
      'ส่งถึงบ้าน': '送货上门',
      'รวดเร็ว ปลอดภัย': '快速安全',
      'กำลังดำเนินการ': '进行中',

      /* --- login/register modal --- */
      'กรอกอีเมลและรหัสผ่านเพื่อเข้าสู่ระบบ': '请输入邮箱/手机号和密码登录',
      'กรอกข้อมูลเพื่อสมัครสมาชิกใหม่': '请填写信息注册新账号',
      'อีเมล หรือ เบอร์โทร': '邮箱或手机号',
      'อีเมล': '邮箱',
      'รหัสผ่าน': '密码',
      'ตั้งรหัสผ่าน (อย่างน้อย 6 ตัว)': '设置密码 (至少6位)',
      'ยืนยันรหัสผ่าน': '确认密码',
      'เบอร์โทรศัพท์ (เช่น 0812345678)': '手机号 (如 0812345678)',
      'ส่ง OTP': '发送验证码',
      'ส่งอีกครั้ง': '重新发送',
      'รหัสส่งไปที่ SMS แล้ว': '验证码已发送',
      'รหัสส่งไปที่ SMS แล้ว (หมดอายุใน 5 นาที)': '验证码已发送 (5分钟内有效)',
      '📷 ถ่ายรูป / เลือกรูปบัตรประชาชน': '📷 拍摄 / 选择身份证照片',
      '✅ ตรวจสอบบัตรผ่านแล้ว — กดเพื่อเปลี่ยนรูป': '✅ 已验证 — 点击更换照片',
      '🤝 ลงทะเบียน': '🤝 注册',
      '🔑 เข้าสู่ระบบ': '🔑 登录',
      'ยังไม่มีบัญชี?': '还没有账号?',
      'มีบัญชีอยู่แล้ว?': '已有账号?',
      'เข้าชมเว็บก่อน': '先浏览',
      'ข้อมูลถูกเก็บอย่างปลอดภัย': '数据安全存储',
      'นโยบายความเป็นส่วนตัว': '隐私政策',

      /* --- ID verify screen --- */
      '🔍 กำลังตรวจสอบบัตรประชาชน': '🔍 正在验证身份证',
      'กรุณารอสักครู่…': '请稍候…',
      'กำลังตรวจสอบบัตร…': '正在验证…',
      'ตรวจสอบเสร็จ — กดปุ่มเพื่อไปกรอกข้อมูลต่อ': '完成 — 点击按钮继续',
      'ตรวจสอบสำเร็จ': '验证成功',
      'ตรวจสอบไม่ผ่าน': '验证失败',
      '✅ กลับไปกรอกข้อมูลสมัคร': '✅ 继续注册',
      '🔁 ถ่ายใหม่': '🔁 重新拍摄',

      /* --- common actions --- */
      'บันทึก': '保存',
      'ยกเลิก': '取消',
      'ยืนยัน': '确认',
      'ลบ': '删除',
      'แก้ไข': '编辑',
      'ปิด': '关闭',
      'ค้นหา': '搜索',
      'ทั้งหมด': '全部',
      'ต่อไป': '下一步',
      'ย้อนกลับ': '返回',
      'ถัดไป': '下一步',
      'ดู': '查看',
      'ดาวน์โหลด': '下载',
      'ก็อปปี้': '复制',
      'คัดลอก': '复制',
      'คัดลอกที่อยู่': '复制地址',
      'อัปโหลด': '上传',
      'ส่ง': '发送',
      'พิมพ์': '打印',
      'รีเฟรช': '刷新',

      /* --- order form (homepage) --- */
      'สั่งซื้อสินค้า': '订购商品',
      'วางลิงก์สินค้าที่อยากได้': '粘贴您想要的商品链接',
      'รองรับ Taobao, Tmall, 1688 — ระบบจะตรวจจับร้านค้าให้อัตโนมัติ': '支持淘宝、天猫、1688 — 系统自动识别店铺',
      'รายการสั่งซื้อของคุณ': '您的订单',
      'ยินดีต้อนรับ': '欢迎',
      'กรอกข้อมูลสินค้า': '填写商品信息',
      'กรอกข้อมูลให้ครบแล้วกด "บันทึก" ด้านล่าง': '填写完整后按下方"保存"',
      'รอวางลิงก์': '等待粘贴链接',
      'ชื่อร้าน': '店铺名称',
      '— เลือกร้านค้า —': '— 选择店铺 —',
      'ลิงก์สินค้า Taobao / 1688 / Tmall...': '商品链接 淘宝 / 1688 / 天猫...',
      'รูปสินค้า (อัปโหลดจากเครื่อง)': '商品图片 (上传)',
      '📷 เลือกรูป / ถ่ายรูป': '📷 选择 / 拍照',
      'อธิบายสิ่งที่อยากได้ (สี / ไซต์ / รุ่น / จำนวน / รายละเอียด)': '描述需求 (颜色 / 尺码 / 型号 / 数量 / 详情)',
      'เพิ่มสินค้า': '添加商品',
      'เพิ่มรายการสินค้า': '添加商品',
      'จำนวน': '数量',
      'สี': '颜色',
      'ไซต์': '尺码',
      'รุ่น': '型号',
      'รายละเอียด': '详情',
      'ราคา': '价格',
      'ราคาโดยประมาณ': '估价',
      'ยอดรวม': '总计',
      'รวมทั้งสิ้น': '合计',
      'ค่าส่ง': '运费',
      'ค่าขนส่ง': '运费',
      'บาท': '泰铢',
      'หยวน': '人民币',
      'กิโลกรัม': '公斤',
      'กก.': '公斤',
      'ตะกร้าสินค้า': '购物车',
      'ตะกร้า': '购物车',
      'ตีลังไม้': '木架',
      'ตรวจสอบคุณภาพ (QC)': '品检 (QC)',
      'บันทึกออเดอร์': '保存订单',
      'ส่งออเดอร์': '提交订单',
      'ยืนยันการสั่งซื้อ': '确认订单',
      'สำเร็จ': '成功',
      'ล้มเหลว': '失败',
      'กรุณากรอกข้อมูลให้ครบ': '请填写完整信息',

      /* --- status labels --- */
      'สถานะ': '状态',
      'รอตรวจสอบ': '待审核',
      'รอชำระเงิน': '待付款',
      'ชำระแล้ว': '已付款',
      'กำลังจัดส่ง': '配送中',
      'จัดส่งสำเร็จ': '已送达',
      'ถึงโกดังไทย': '已到泰国仓',
      'ถึงโกดังจีน': '已到中国仓',
      'รอเลขขนส่งจีน': '等待中国物流号',
      'สินค้าออกจากจีน': '已离开中国',
      'ส่งเข้าโกดัง': '送往仓库',
      'ฝากจ่ายเงินสำเร็จ': '代付成功',
      'ยกเลิกออเดอร์': '已取消',

      /* --- topup / wallet --- */
      'เติมเงิน': '充值',
      'เครดิตของฉัน': '我的余额',
      'ยอดเครดิต': '余额',
      'จำนวนเงินที่ต้องการเติม': '充值金额',
      'อัปโหลดสลิป': '上传凭证',
      'แนบสลิปการโอน': '附上转账凭证',
      'แจ้งเติมเงิน': '提交充值',
      'ประวัติการเติมเงิน': '充值记录',
      'วันที่': '日期',
      'จำนวน': '数量',
      'รออนุมัติ': '待审核',
      'อนุมัติแล้ว': '已批准',
      'ปฏิเสธ': '已拒绝',

      /* --- how-ship page (Chinese warehouse) --- */
      'วิธีส่งสินค้าเข้าโกดังเรา': '如何将货物寄送到我们的仓库',
      'สั่งซื้อสินค้ากับร้านจีน': '在中国店铺下单',
      'หรือมีสินค้าที่ต้องการนำเข้าอยู่แล้ว': '或已有需要进口的商品',
      'ส่งสินค้ามาที่อยู่โกดังของเรา': '寄送到我们的仓库地址',
      'ใช้ที่อยู่ด้านล่างเป็นที่อยู่ผู้รับตอนกรอกในร้านจีน/ขนส่ง': '下单时使用下方地址作为收货人',
      'แจ้งเลขพัสดุกับทีมงาน': '将快递号告知我们',
      'เพื่อให้เราติดตามและรับของเข้าโกดังให้': '以便我们跟踪并收货',
      'ของเข้าโกดัง → ส่งมาไทย': '入仓 → 发送到泰国',
      'ทีมงานแจ้งยอดค่าขนส่ง แล้วจัดส่งถึงคุณ': '我们报运费后送货给您',
      'ที่อยู่โกดังจีนสำหรับส่งสินค้า': '中国仓库收货地址',
      'ผู้รับ / ที่อยู่จัดส่ง': '收件人 / 收货地址',
      '📋 คัดลอกที่อยู่': '📋 复制地址',
      '✅ คัดลอกแล้ว': '✅ 已复制',
      'ข้อมูลที่ต้องแจ้งเรา (หลังส่งของ)': '发货后需要告知我们的信息',
      'เลขพัสดุ (Tracking)': '快递号',
      'เลขขนส่งจีนที่ได้มา': '收到的中国物流号',
      'ร้านค้า + ลิงก์': '店铺 + 链接',
      'จำนวนกล่อง / ชิ้น': '箱数 / 件数',
      'เพื่อตรวจรับให้ครบ': '以便准确验收',
      'รูปสินค้า (ถ้ามี)': '商品图片 (如有)',
      'ตรวจรับเร็วขึ้น': '加快验收',
      'แจ้งส่งของเข้าโกดัง': '通知发货到仓库',
      'ทางรถ': '陆运',
      'ทางเรือ': '海运',
      'การจัดส่ง': '运输方式',
      'ประเภทสินค้า': '商品类别',
      'สินค้าทั่วไป': '普通商品',
      'สินค้าแบรนด์/ลิขสิทธิ์': '品牌/授权商品',
      'จำนวนชิ้น': '件数',
      'ลิงก์สินค้า': '商品链接',
      'กรุณากรอกเลขพัสดุ (Tracking)': '请填写快递号',
      'กรุณาเข้าสู่ระบบก่อน': '请先登录',
      '📤 แจ้งส่งของเข้าโกดัง': '📤 通知发货到仓库',
      'กำลังส่ง…': '发送中…',

      /* --- orders / bills / general lists --- */
      'ยังไม่มีรายการสั่งซื้อ': '暂无订单',
      'ยังไม่มีรายการ': '暂无记录',
      'ไม่มีรายการในสถานะนี้': '此状态下没有记录',
      'ไม่พบข้อมูล': '未找到数据',
      'ค้นหาข้อมูล': '搜索',
      'รายการวางบิล': '账单列表',
      'รายการรวมบิล': '合并账单',
      'สถานะทั้งหมด': '所有状态',
      'เลขที่บิล': '账单号',
      'เลขที่กลุ่มบิล': '账单组号',
      'จำนวนรายการ': '项目数',
      'ประเภทจัดส่ง': '运输方式',
      'ยอดชำระ THB': '金额 (泰铢)',
      'เลขแทรคส่งของ': '物流号',
      'เจ้าหน้าที่ หมายเหตุ': '客服 · 备注',
      'วันที่ออกบิล': '出账日期',
      'วันที่สั่งซื้อ': '下单日期',
      'สร้างกลุ่มบิล': '创建账单组',
      'ประวัติบิล': '账单历史',
      'เลขที่ออเดอร์': '订单号',
      'เลขออเดอร์': '订单号',
      'เลขที่พัสดุ': '包裹号',

      /* --- calc --- */
      'คำนวณค่าขนส่ง': '运费计算',
      'ทางรถ (ถูกกว่า)': '陆运 (较便宜)',
      'ทางเรือ (ประหยัดสุด)': '海运 (最经济)',
      'น้ำหนัก': '重量',
      'ปริมาตร (คิว)': '体积 (立方米)',
      'กว้าง': '宽',
      'ยาว': '长',
      'สูง': '高',
      'เซนติเมตร': '厘米',
      'ซม.': '厘米',
      'คำนวณ': '计算',
      'ผลการคำนวณ': '计算结果',
      'ราคารวมค่าส่งประมาณ': '预估含运费总价',
      'อัตราค่าส่ง': '运费费率',

      /* --- po --- */
      'ตรวจสอบสถานะ PO': 'PO 状态查询',
      'เลข PO': 'PO 号',
      'สถานะปัจจุบัน': '当前状态',
      'กำลังตรวจสอบ': '审核中',
      'ทีมงานจะตรวจสอบและแจ้งราคา/ค่าส่งกลับทาง LINE': '我们会审核并通过 LINE 告知价格/运费',
      'เก็บเลข PO นี้ไว้ตรวจสอบสถานะภายหลังได้': '请保存此 PO 号以便日后查询',
      'ชำระเงินก่อนวันที่': '请在此日期前付款',
      'เจ้าหน้าที่': '客服',
      'หมายเหตุ': '备注',

      /* --- topup --- */
      'บัญชีธนาคารสำหรับโอน': '收款银行账户',
      'ธนาคาร': '银行',
      'เลขบัญชี': '账号',
      'ชื่อบัญชี': '账户名',
      'จำนวนเงินที่โอน': '转账金额',
      'แนบสลิป': '附上凭证',
      'เลือกไฟล์สลิป': '选择凭证文件',
      '📸 อัปโหลดสลิป': '📸 上传凭证',
      'กำลังตรวจสอบสลิป': '正在验证凭证',

      /* --- track --- */
      'ค้นหาสถานะออเดอร์': '查询订单状态',
      'พิมพ์เลขออเดอร์': '输入订单号',
      'ไม่พบออเดอร์': '未找到订单',
      'พบออเดอร์': '找到订单',
      'ประวัติสถานะ': '状态历史',
      'สรุปออเดอร์': '订单汇总',

      /* --- cart --- */
      'ตะกร้าสินค้าของคุณ': '您的购物车',
      'สั่งเพิ่ม': '继续添加',
      'ค่าตีลังไม้': '木架费',
      'ค่าตรวจ QC': '品检费',
      'ยอดสินค้ารวม': '商品合计',
      'ยอดขนส่งรวม': '运费合计',
      'มากกว่า': '大于',
      'ตีลังไม้เริ่มต้นที่ 50 หยวน ต่อ ลัง': '打木架起价 50 元/个',
      '*ทุกๆ +0.1 คิว จะเพิ่มค่าตีลังไม้ 20 หยวน': '*每增加 0.1 立方米加收 20 元木架费',
      '*รายการสั่งซื้อสินค้าสูงสุดได้ 100 รายการ / บิล เท่านั้น': '*每张账单最多 100 项',

      /* --- admin --- */
      'แอดมิน': '管理员',
      'แดชบอร์ด': '仪表盘',
      'สมาชิก': '会员',
      'ออเดอร์': '订单',
      'บิล': '账单',
      'ตั้งค่า': '设置',
      'ออกจากระบบ': '退出登录',
      'ค้นหาสมาชิก': '搜索会员',
      'ค้นหาออเดอร์': '搜索订单',
      'รหัสสมาชิก': '会员编号',
      'ชื่อ': '姓名',
      'เบอร์': '电话',
      'เลขบัตร ปชช': '身份证号',
      'รูปบัตร': '身份证照片',
      'ดูรูปบัตร': '查看身份证',
      'สร้างเมื่อ': '创建时间',
      'เข้าสู่ระบบล่าสุด': '上次登录',
      'จำนวนออเดอร์': '订单数',
      'ยอดขายรวม': '总销售额',
      'รีเซ็ตการยืนยันตัวตนทั้งหมด': '重置所有 KYC',
      'รีเซ็ตเครดิตทั้งหมด': '重置所有余额',
      'เติมรหัสสมาชิกให้บัญชีเก่า': '补齐会员编号',
      'จัดการออเดอร์': '订单管理',
      'อัปเดตสถานะ': '更新状态',
      'บันทึกการเปลี่ยนแปลง': '保存更改',
      'อนุมัติ': '批准',
      'ปฏิเสธการเติมเงิน': '拒绝充值',
      'อนุมัติการเติมเงิน': '批准充值',
      'ระบุยอดเติมเงิน': '设置金额',
      'รอแอดมินระบุยอด': '待管理员设置金额',

      /* --- reviews --- */
      'รีวิวจากลูกค้าจริง': '真实客户评价',
      'เขียนรีวิว': '写评价',
      'ส่งรีวิว': '提交评价',
      'ให้คะแนน': '评分',
      'ยังไม่มีรีวิว': '暂无评价',

      /* --- misc --- */
      'สงวนลิขสิทธิ์': '版权所有',
      'กรุณาเข้าสู่ระบบ': '请登录',
      'เข้าสู่ระบบเพื่อดูข้อมูล': '登录以查看数据',
      'ยินดีต้อนรับ คุณ': '欢迎,',
      'ออกจากระบบเรียบร้อย': '已退出登录',
      'บันทึกสำเร็จ': '保存成功',
      'ลบสำเร็จ': '删除成功',
      'มีข้อผิดพลาด': '发生错误',
      'กรุณาลองใหม่': '请重试',
    },
  };

  var ATTR_LIST = ['placeholder', 'title', 'alt', 'aria-label'];
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };

  /* Match a trimmed string against the dictionary. Falls back to stripping
     a leading emoji/symbol chunk so keys can be typed as plain Thai. */
  var EMOJI_PREFIX = /^([\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}←-⇿ -⁯]+\s*)/u;
  function lookup(dict, text) {
    if (dict[text]) return { hit: dict[text], prefix: '' };
    var m = text.match(EMOJI_PREFIX);
    if (m) {
      var rest = text.slice(m[0].length);
      if (dict[rest]) return { hit: dict[rest], prefix: m[0] };
    }
    return null;
  }

  function translateSubtree(root, dict) {
    if (!root || !dict) return;
    /* text nodes */
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.parentElement) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS[n.parentElement.tagName]) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walker.nextNode())) {
      var raw = n.nodeValue;
      var trimmed = raw.trim();
      if (!trimmed) continue;
      var hit = lookup(dict, trimmed);
      if (hit) {
        n.nodeValue = raw.replace(trimmed, hit.prefix + hit.hit);
      }
    }
    /* attributes */
    if (root.nodeType === 1) {
      ATTR_LIST.forEach(function (a) {
        if (root.hasAttribute && root.hasAttribute(a)) {
          var v = root.getAttribute(a);
          var t = v && v.trim();
          if (t && dict[t]) root.setAttribute(a, dict[t]);
        }
      });
    }
    if (root.querySelectorAll) {
      ATTR_LIST.forEach(function (a) {
        root.querySelectorAll('[' + a + ']').forEach(function (el) {
          var v = el.getAttribute(a);
          var t = v && v.trim();
          if (!t) return;
          var hit = lookup(dict, t);
          if (hit) el.setAttribute(a, hit.prefix + hit.hit);
        });
      });
    }
  }

  function translateAll() {
    if (currentLang === 'th') return;
    var dict = TRANSLATIONS[currentLang];
    if (!dict) return;
    translateSubtree(document.body, dict);
  }

  function setLang(lang) {
    if (!lang || lang === currentLang) return;
    localStorage.setItem(LANG_KEY, lang);
    location.reload();
  }

  /* Inject a compact language switcher — inside sidebar if #opgLangSlot
     exists, otherwise as a floating button in the bottom-right corner. */
  function mountSwitcher() {
    var slot = document.getElementById('opgLangSlot');
    if (slot && !slot.dataset.mounted) {
      slot.dataset.mounted = '1';
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:6px;padding:10px 20px;border-top:1px solid rgba(255,255,255,.08);margin-top:auto';
      ['th', 'en', 'zh'].forEach(function (code) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = code === 'th' ? '🇹🇭 ไทย' : code === 'en' ? '🇬🇧 EN' : '🇨🇳 中文';
        b.style.cssText = 'flex:1;padding:6px 4px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:' +
          (code === currentLang ? '#9C8654' : 'transparent') + ';color:#fff;font-size:12px;cursor:pointer';
        b.addEventListener('click', function () { setLang(code); });
        wrap.appendChild(b);
      });
      slot.appendChild(wrap);
      return;
    }
    /* Fallback: floating pill on pages without a sidebar */
    if (document.getElementById('opgLangFab')) return;
    var fab = document.createElement('div');
    fab.id = 'opgLangFab';
    fab.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:1300;background:rgba(60,42,14,.95);border-radius:999px;padding:6px;display:flex;gap:4px;box-shadow:0 4px 14px rgba(0,0,0,.28)';
    ['th', 'en', 'zh'].forEach(function (code) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = code === 'th' ? '🇹🇭' : code === 'en' ? '🇬🇧' : '🇨🇳';
      b.title = code === 'th' ? 'ไทย' : code === 'en' ? 'English' : '中文';
      b.style.cssText = 'border:0;border-radius:999px;width:34px;height:34px;font-size:16px;cursor:pointer;background:' +
        (code === currentLang ? '#9C8654' : 'transparent') + ';color:#fff';
      b.addEventListener('click', function () { setLang(code); });
      fab.appendChild(b);
    });
    document.body.appendChild(fab);
  }

  window.OPGi18n = { setLang: setLang, current: function () { return currentLang; } };

  function init() {
    translateAll();
    mountSwitcher();
    /* Catch JS-rendered content (order lists, admin tables, modals) */
    if (currentLang !== 'th' && window.MutationObserver) {
      var dict = TRANSLATIONS[currentLang];
      var obs = new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          m.addedNodes.forEach(function (nd) {
            if (nd.nodeType === 1) translateSubtree(nd, dict);
            else if (nd.nodeType === 3 && nd.parentElement && !SKIP_TAGS[nd.parentElement.tagName]) {
              var t = nd.nodeValue.trim();
              if (!t) return;
              var hit = lookup(dict, t);
              if (hit) nd.nodeValue = nd.nodeValue.replace(t, hit.prefix + hit.hit);
            }
          });
        });
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
