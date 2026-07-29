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
      'เลขพัสดุ (Tracking)': '快递号 (Tracking)',
      'เลขขนส่งจีนที่ได้มา': '收到的中国物流号',
      'ร้านค้า + ลิงก์': '店铺 + 链接',
      'จำนวนกล่อง / ชิ้น': '箱数 / 件数',
      'เพื่อตรวจรับให้ครบ': '以便准确验收',
      'รูปสินค้า (ถ้ามี)': '商品图片 (如有)',
      'ตรวจรับเร็วขึ้น': '加快验收',
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
