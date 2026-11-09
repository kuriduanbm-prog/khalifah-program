/**
 * KHALIFAH PROGRAM - Google Apps Script Backend (เวอร์ชันภาษาไทย 100%)
 * ----------------------------------------------------
 * เชื่อมต่อกับ Google Sheets อัตโนมัติเพื่อเป็นฐานข้อมูลของระบบ
 * บันทึก: ข้อมูลนักเรียน, เช็คชื่อมาเรียน, เช็คละหมาด 5 เวลา, กิจกรรม, ผู้ดูแลระบบ, ผลบุญ
 */

// รหัส Google Spreadsheet เป้าหมาย (ฐานข้อมูลหลักของระบบ)
const TARGET_SPREADSHEET_ID = '1s8p3EYESW7z2oiLVyzfFIPXck5eyeGxxU98lkkzw-ss';

// ⚠️ รหัสแอดมินหลักไม่ได้เก็บไว้ในโค้ดอีกต่อไป
// ตั้งค่าที่: Apps Script > ⚙️ Project Settings > Script Properties > เพิ่ม MASTER_ADMIN_PASS
// (ดูฟังก์ชัน setupSecurity() ด้านล่างสำหรับขั้นตอนตั้งค่าครั้งแรก)
const SCHEMA_VERSION = '11.0';
const CODE_VERSION = '18.67'; // รุ่นของไฟล์ Code.gs · แอปใช้ตรวจว่า Deploy ตัวล่าสุดแล้วหรือยัง

/**
 * ฟังก์ชันสำหรับกด "เรียกใช้ (Run)" ครั้งแรกใน Apps Script เพื่อเปิดสิทธิ์ส่งอีเมลอัตโนมัติ (GmailApp & MailApp)
 */
function authorizeEmailPermission() {
  const quota = MailApp.getRemainingDailyQuota();
  try {
    GmailApp.getAliases();
  } catch (e) {}
  Logger.log('เปิดสิทธิ์ส่งอีเมลสำเร็จ! โควต้าส่งอีเมลคงเหลือวันนี้: ' + quota + ' ฉบับ');
  return quota;
}

/**
 * ============================================================================
 * ⭐ ฟังก์ชันสำหรับกด "เรียกใช้" (Run) ใน Google Apps Script โดยตรงได้ทันที!
 * เลือกชื่อฟังก์ชัน: runOrganizeGoogleSheetsDirectly จากเมนูด้านบน แล้วกด Run ได้เลยครับ
 * ============================================================================
 */
function runOrganizeGoogleSheetsDirectly() {
  Logger.log('🚀 เริ่มต้นจัดระเบียบโครงสร้าง Google Sheets ทันที...');
  const result = initializeSheets();
  Logger.log('ผลการดำเนินการ: ' + JSON.stringify(result));
  Logger.log('✅ จัดระเบียบครบทั้ง 13 แผ่นงาน (รวมแท็บปฏิทินกิจกรรม) เรียงแท็บ แยกอาจารย์/แอดมิน ล็อคแถวบนสุด และใส่ Dropdown สำเร็จ 100%!');
  return result;
}

// ชื่อแผ่นงานหลักภาษาไทย (Thai Sheet Names) - จัดเรียงและแบ่งหมวดหมู่เป็นระเบียบชัดเจน
const SHEETS = {
  STUDENTS: 'รายชื่อนักเรียน',
  TEACHERS: 'รายชื่ออาจารย์ผู้สอน',
  ADMINS: 'รายชื่อแอดมินดูแลระบบ',
  STATUS_LOGS: 'บันทึกสถานะของนักเรียน',
  PRAYERS: 'บันทึกเวลาละหมาด',
  ACTIVITIES: 'กิจกรรม',
  ACTIVITY_LOGS: 'บันทึกการเข้าร่วมกิจกรรม',
  ATTENDANCE: 'บันทึกการมาเรียน',
  GRADES: 'ผลการเรียนรายวิชา',
  HASANAT: 'บันทึกผลบุญ',
  APPROVALS: 'รายการรออนุมัติสมัคร',
  PRAYER_APPROVALS: 'คำขออนุมัติละหมาด',
  ASSIGNMENT_SCORES: 'คะแนนชิ้นงาน',
  TEACHER_EVALS: 'ประเมินอาจารย์',
  BEHAVIOR: 'บันทึกคะแนนพฤติกรรม',
  NOTIFS: 'การแจ้งเตือน',
  NOTIF_READS: 'การอ่านแจ้งเตือน',
  POLICY_ACKS: 'การยินยอมข้อตกลง',
  DREAMS: 'ความใฝ่ฝันนักเรียน',
  HALAQAH: 'ตารางหะละเกาะฮฺ',
  HALAQAH_LOGS: 'บันทึกการเข้าหะละเกาะฮฺ',
  SETTINGS: 'การตั้งค่า',
  CALENDAR: 'ปฏิทินกิจกรรม'
};

// ลำดับแท็บมาตรฐานใน Google Sheets เพื่อความสะอาด เป็นหมวดหมู่ และค้นหาง่าย
const SHEET_ORDER = [
  SHEETS.STUDENTS,       // 1. รายชื่อนักเรียน
  SHEETS.TEACHERS,       // 2. รายชื่ออาจารย์ผู้สอน
  SHEETS.ADMINS,         // 3. รายชื่อแอดมินดูแลระบบ
  SHEETS.STATUS_LOGS,    // 4. บันทึกสถานะของนักเรียน
  SHEETS.PRAYERS,        // 5. บันทึกเวลาละหมาด
  SHEETS.ACTIVITIES,     // 6. กิจกรรม
  SHEETS.ACTIVITY_LOGS,  // 7. บันทึกการเข้าร่วมกิจกรรม
  SHEETS.ATTENDANCE,     // 8. บันทึกการมาเรียน
  SHEETS.GRADES,         // 9. ผลการเรียนรายวิชา
  SHEETS.HASANAT,        // 10. บันทึกผลบุญ
  SHEETS.APPROVALS,      // 11. รายการรออนุมัติสมัคร
  SHEETS.PRAYER_APPROVALS, // 12. คำขออนุมัติละหมาด
  SHEETS.ASSIGNMENT_SCORES, // คะแนนชิ้นงานรายวิชา
  SHEETS.TEACHER_EVALS,  // ประเมินอาจารย์ (ไม่ระบุชื่อ)
  SHEETS.BEHAVIOR,       // บันทึกคะแนนพฤติกรรม (ผู้ตรวจการ)
  SHEETS.NOTIFS,         // การแจ้งเตือน (กระดิ่ง)
  SHEETS.NOTIF_READS,    // การอ่าน/ซ่อนแจ้งเตือนของแต่ละคน
  SHEETS.POLICY_ACKS,    // การยินยอมกฎระเบียบหอพัก
  SHEETS.DREAMS,         // ความใฝ่ฝัน/อาชีพในฝันของนักเรียน
  SHEETS.HALAQAH,        // ตารางหะละเกาะฮฺอัลกุรอาน
  SHEETS.HALAQAH_LOGS,   // บันทึกการเข้าหะละเกาะฮฺ
  SHEETS.SETTINGS,       // 13. การตั้งค่า
  SHEETS.CALENDAR        // 14. ปฏิทินกิจกรรม
];

// ชื่อแผ่นงานเดิมภาษาอังกฤษ / ชื่อเดิม (สำหรับแปลงของเดิมให้เป็นโครงสร้างใหม่เป็นระเบียบอัตโนมัติ)
const LEGACY_SHEETS = {
  STUDENTS: ['Students', 'students', 'Student', 'นักเรียน'],
  TEACHERS: ['Teachers', 'teachers', 'Teacher', 'อาจารย์ผู้สอน', 'รายชื่ออาจารย์'],
  ADMINS: ['Admins', 'admins', 'Admin', 'ผู้ดูแลระบบ', 'แอดมินดูแลระบบ'],
  STATUS_LOGS: ['StatusLogs', 'statuslogs', 'StudentStatusLogs', 'บันทึกการเปลี่ยนสถานะนักเรียน', 'สถานะนักเรียน'],
  PRAYERS: ['PrayerLogs', 'prayerlogs', 'Prayer_Logs', 'Prayers', 'บันทึกละหมาด'],
  ATTENDANCE: ['AttendanceLogs', 'attendancelogs', 'Attendance_Logs', 'Attendance', 'เช็คชื่อมาเรียน'],
  ACTIVITIES: ['Activities', 'activities', 'Activity'],
  ACTIVITY_LOGS: ['ActivityLogs', 'activitylogs', 'Activity_Logs', 'บันทึกเข้าร่วมกิจกรรม'],
  SETTINGS: ['Settings', 'settings', 'Setting'],
  HASANAT: ['HasanatLogs', 'hasanatlogs', 'Hasanat_Logs', 'Hasanat', 'ผลบุญ'],
  GRADES: ['Grades', 'grades', 'SubjectGrades', 'ผลการเรียน'],
  APPROVALS: ['PendingApprovals', 'pendingapprovals', 'Pending_Approvals', 'รออนุมัติ'],
  PRAYER_APPROVALS: ['PrayerApprovals', 'prayerapprovals', 'Prayer_Approvals', 'คำขออนุมัติละหมาดย้อนหลัง', 'คำขออนุมัติ'],
  TEACHERS: ['Teachers', 'teachers', 'Teacher', 'อาจารย์ผู้สอน', 'รายชื่ออาจารย์'],
  ADMINS: ['Admins', 'admins', 'Admin', 'ผู้ดูแลระบบ', 'แอดมินดูแลระบบ'],
  STATUS_LOGS: ['StatusLogs', 'statuslogs', 'StudentStatusLogs', 'บันทึกการเปลี่ยนสถานะนักเรียน', 'สถานะนักเรียน'],
  PRAYERS: ['PrayerLogs', 'prayerlogs', 'Prayer_Logs', 'Prayers', 'บันทึกละหมาด'],
  ATTENDANCE: ['AttendanceLogs', 'attendancelogs', 'Attendance_Logs', 'Attendance', 'เช็คชื่อมาเรียน'],
  ACTIVITIES: ['Activities', 'activities', 'Activity'],
  ACTIVITY_LOGS: ['ActivityLogs', 'activitylogs', 'Activity_Logs', 'บันทึกเข้าร่วมกิจกรรม'],
  SETTINGS: ['Settings', 'settings', 'Setting'],
  HASANAT: ['HasanatLogs', 'hasanatlogs', 'Hasanat_Logs', 'Hasanat', 'ผลบุญ'],
  GRADES: ['Grades', 'grades', 'SubjectGrades', 'ผลการเรียน'],
  APPROVALS: ['Approvals', 'approvals', 'PendingApprovals'],
  CALENDAR: ['CalendarEvents', 'calendarevents', 'Calendar', 'ปฏิทิน', 'กิจกรรมปฏิทิน', 'ปฏิทินโรงเรียน']
};

// หัวคอลัมน์ภาษาไทยมาตรฐานสำหรับแต่ละแผ่นงาน
const HEADERS = {
  STUDENTS: [
    'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'โรงเรียน/สังกัด', 'ระดับชั้น', 
    'วันเดือนปีเกิด', 'เบอร์โทรผู้ปกครอง', 'วันที่ลงทะเบียน', 'สถานะนักเรียน', 'รูปโปรไฟล์',
    'อีเมล', 'GPAX', 'สถิติมาเรียน JSON', 'เกรดรายวิชา JSON', 'สถานะยืนยันตัวตน',
    'มีผล ณ วันที่', 'หมายเหตุสถานะ', 'เพศ', 'คำนำหน้า'
  ],
  TEACHERS: [
    'รหัสอาจารย์', 'ชื่อผู้ใช้ (Username)', 'รหัสผ่าน (Password)', 'ชื่อ-นามสกุล', 'ตำแหน่ง / สิทธิ์',
    'เบอร์โทรศัพท์', 'อีเมล', 'รายวิชาที่รับผิดชอบ JSON', 'สถานะการทำงาน', 'วันที่ลงทะเบียน / สร้างบัญชี',
    'รูปโปรไฟล์'
  ],
  ADMINS: [
    'รหัสแอดมิน', 'ชื่อผู้ใช้ (Username)', 'รหัสผ่าน (Password)', 'ชื่อ-นามสกุล', 'ระดับสิทธิ์ (Role)',
    'เบอร์โทรศัพท์', 'อีเมล', 'สถานะบัญชี', 'วันที่แต่งตั้ง / สร้างบัญชี', 'หมายเหตุ'
  ],
  STATUS_LOGS: [
    'รหัสบันทึก', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ระดับชั้น',
    'สถานะเดิม', 'สถานะใหม่', 'มีผล ณ วันที่', 'เหตุผล / หมายเหตุ',
    'ผู้บันทึก / แอดมิน', 'วันเวลาที่บันทึก'
  ],
  PRAYERS: [
    'รหัสบันทึก', 'รหัสนักเรียน', 'ชื่อนักเรียน', 'ระดับชั้น', 'เวลาละหมาด', 
    'เวลา Timestamp', 'วันที่', 'เวลาบันทึก', 'ละติจูด (Lat)', 'ลองจิจูด (Lng)', 
    'สถานที่ละหมาด', 'ระยะห่าง (เมตร)', 'อยู่ในพิกัด', 'ลิงก์รูปถ่ายพยาน', 'สถานะการละหมาด', 'หมายเหตุ'
  ],
  ATTENDANCE: [
    'รหัสบันทึก', 'รหัสนักเรียน', 'ชื่อนักเรียน', 'ระดับชั้น', 
    'วันที่', 'เวลา', 'สถานะการมาเรียน', 'หมายเหตุ', 'รหัสวิชา', 'ชื่อวิชา', 'ผู้เช็คชื่อ', 'คาบ'
  ],
  ACTIVITIES: [
    'รหัสกิจกรรม', 'ชื่อกิจกรรม', 'รายละเอียด', 'วันเริ่มต้น', 'วันสิ้นสุด', 
    'สถานที่จัดกิจกรรม', 'ผู้สร้างกิจกรรม', 'วันที่สร้าง', 'จำนวนผู้เข้าร่วม', 'กลุ่มเป้าหมาย'
  ],
  ACTIVITY_LOGS: [
    'รหัสบันทึก', 'รหัสกิจกรรม', 'ชื่อกิจกรรม', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 
    'ระดับชั้น', 'วันที่เช็คชื่อ', 'เวลาเช็คชื่อ', 'เวลา Timestamp'
  ],
  SETTINGS: [
    'การตั้งค่า (Key)', 'ค่าที่กำหนด (Value)', 'คำอธิบาย (Description)'
  ],
  HASANAT: [
    'รหัสบันทึก', 'รหัสนักเรียน', 'ชื่อนักเรียน', 'ระดับชั้น', 'วันที่', 
    'อ่านกุรอานวันนี้ (หน้า)', 'อ่านถึงหน้าที่', 'อ่านจบกี่ยุซ', 'จำนวนดาวที่สะสม (ดวง)', 
    'จำนวนครั้งอ่านจบ30ยุซ (ค็อตม์)', 'จำนวนซูเราะห์ที่ท่องจำ', 'รายชื่อซูเราะห์ที่ท่องจำได้', 
    'รวมร็อกอะฮ์สุนัตวันนี้', 'รายละเอียดละหมาดสุนัต', 'เวลา Timestamp'
  ],
  GRADES: [
    'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ระดับชั้น', 'รหัสวิชา', 'ชื่อรายวิชา',
    'ระดับเกรด (1-4)', 'คะแนน (เต็ม 100)', 'ผู้ประเมิน', 'เวลาอัปเดต'
  ],
  APPROVALS: [
    'รหัสคำขอ', 'ประเภทผู้ใช้', 'รหัสประจำตัว', 'ชื่อ-นามสกุล', 'อีเมล',
    'รายละเอียดเพิ่มเติม', 'รหัสยืนยันสุ่ม (OTP)', 'สถานะ', 'เวลาที่สมัคร', 'ข้อมูล JSON'
  ],
  NOTIFS: [
    'รหัสแจ้งเตือน', 'เวลาสร้าง', 'หัวข้อ', 'ข้อความ', 'ผู้รับ (ประเภท)', 'ผู้รับ (ค่า)', 'ความสำคัญ',
    'ผู้ส่ง (username)', 'ชื่อผู้ส่ง', 'สถานะ', 'หมดอายุ', 'รูปแบบการแสดง', 'ตำแหน่งป้าย'
  ],
  NOTIF_READS: ['รหัสแจ้งเตือน', 'ผู้ใช้', 'อ่านเมื่อ', 'ซ่อน'],
  HALAQAH: ['รหัสหะละเกาะฮฺ', 'ชื่อ', 'ช่วงเวลา', 'วัน (0=อา.)', 'เริ่ม', 'สิ้นสุด', 'ระดับชั้น', 'ผู้ดูแล (username)', 'ชื่อผู้ดูแล', 'สถานที่', 'สถานะ', 'สร้างเมื่อ', 'ผู้เรียน (รหัสนักเรียน)', 'วันที่จัด'],
  HALAQAH_LOGS: ['รหัสบันทึก', 'รหัสหะละเกาะฮฺ', 'ชื่อหะละเกาะฮฺ', 'วันที่', 'เวลา', 'รหัสนักเรียน', 'ชื่อนักเรียน', 'ระดับชั้น', 'วิธีบันทึก', 'ผู้บันทึก', 'สถานะ', 'หมายเหตุ'],
  DREAMS: ['รหัสนักเรียน', 'ชื่อนักเรียน', 'ระดับชั้น', 'ความใฝ่ฝัน', 'ไอคอน', 'เหตุผล/เป้าหมาย', 'อัปเดตเมื่อ'],
  POLICY_ACKS: ['รหัสยินยอม', 'รหัสข้อตกลง', 'ฉบับ', 'รหัสนักเรียน', 'ชื่อนักเรียน', 'ระดับชั้น', 'ยินยอมเมื่อ'],
  BEHAVIOR: [
    'รหัสบันทึก', 'วันที่', 'เวลาบันทึก', 'ภาคเรียน', 'รหัสนักเรียน', 'ชื่อนักเรียน', 'ระดับชั้น',
    'หมวด', 'รหัสหัวข้อ', 'หัวข้อ', 'คะแนน (+/-)', 'หมายเหตุ', 'ผู้บันทึก (username)', 'ชื่อผู้บันทึก', 'สถานะ', 'ผู้ยกเลิก', 'รูปหลักฐาน', 'ที่มาของรูป'
  ],
  TEACHER_EVALS: [
    'รหัสประเมิน', 'ภาคเรียน', 'รหัสวิชา', 'ชื่อวิชา', 'อาจารย์ (username)', 'ชื่ออาจารย์',
    'คะแนนเฉลี่ย', 'คะแนนรายข้อ (JSON)', 'ความคิดเห็น', 'ระดับชั้น', 'เวลาที่ประเมิน', 'รหัสอ้างอิงผู้ประเมิน (แฮช)'
  ],
  ASSIGNMENT_SCORES: [
    'รหัสบันทึก', 'รหัสวิชา', 'ชื่อวิชา', 'รหัสชิ้นงาน', 'ชื่อชิ้นงาน', 'คะแนนเต็ม',
    'รหัสนักเรียน', 'ชื่อนักเรียน', 'ระดับชั้น', 'คะแนนที่ได้', 'ผู้บันทึก', 'เวลาอัปเดต'
  ],
  PRAYER_APPROVALS: [
    'รหัสคำขอ', 'รหัสนักเรียน', 'ชื่อนักเรียน', 'ระดับชั้น', 'เบอร์ผู้ปกครอง',
    'เวลาละหมาด', 'วันที่ละหมาด', 'เหตุผลหลัก', 'รายละเอียดเหตุผล', 'ลิงก์รูปถ่ายพยาน',
    'สถานะคำขอ', 'เวลาที่ส่งคำขอ', 'ผู้อนุมัติ', 'เวลาที่อนุมัติ', 'หมายเหตุอาจารย์', 'ที่มาของรูป'
  ],
  CALENDAR: [
    'รหัสกิจกรรม', 'ชื่อกิจกรรม', 'วันที่เริ่มต้น', 'วันที่สิ้นสุด', 'เวลาเริ่มต้น', 'เวลาสิ้นสุด',
    'สถานที่', 'หมวดหมู่', 'กลุ่มเป้าหมาย', 'รายละเอียด', 'ผู้สร้าง', 'อัปเดตล่าสุด'
  ]
};

/**
 * ดึงออบเจ็กต์ Spreadsheet ที่เชื่อมโยงกับฐานข้อมูล
 */
function getSpreadsheet() {
  try {
    if (TARGET_SPREADSHEET_ID && TARGET_SPREADSHEET_ID.trim() !== '') {
      return SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
    }
  } catch (err) {
    Logger.log('Could not open target spreadsheet by ID: ' + err.message);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * ฟังก์ชันค้นหาหรือสร้างแผ่นงาน พร้อมเปลี่ยนชื่อเดิมเป็นภาษาไทยอัตโนมัติ
 */
function getOrCreateSheetSmart(ss, key, defaultHeaders, headerBgColor) {
  const primaryName = SHEETS[key];
  let sheet = ss.getSheetByName(primaryName);

  // ถ้ายังไม่พบแผ่นงานชื่อภาษาไทย ให้ค้นหาชื่อภาษาอังกฤษเดิม
  if (!sheet && LEGACY_SHEETS[key]) {
    for (let i = 0; i < LEGACY_SHEETS[key].length; i++) {
      const oldSheet = ss.getSheetByName(LEGACY_SHEETS[key][i]);
      if (oldSheet) {
        try {
          oldSheet.setName(primaryName); // เปลี่ยนชื่อแท็บเดิมเป็นภาษาไทยทันที!
        } catch (e) {
          Logger.log('Could not rename sheet: ' + e.message);
        }
        sheet = oldSheet;
        break;
      }
    }
  }

  // หากยังไม่มีแผ่นงานนี้ ให้สร้างใหม่ด้วยชื่อภาษาไทย
  if (!sheet) {
    sheet = ss.insertSheet(primaryName);
    if (defaultHeaders && defaultHeaders.length > 0) {
      sheet.appendRow(defaultHeaders);
    }
  }

  // อัปเกรดแถวที่ 1 ให้เป็นหัวตารางภาษาไทยสวยงามและครบทุกคอลัมน์
  if (defaultHeaders && defaultHeaders.length > 0) {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow === 0) {
      sheet.appendRow(defaultHeaders);
    } else {
      const firstCell = String(sheet.getRange(1, 1).getValue()).trim();
      // หากหัวตารางเดิมเป็นภาษาอังกฤษ หรือจำนวนคอลัมน์น้อยกว่ามาตรฐานใหม่ ให้อัปเดตเป็นหัวภาษาไทยครบทุกคอลัมน์ทันที
      if (firstCell.startsWith('Student') || firstCell.startsWith('Log') || 
          firstCell === 'Key' || firstCell.startsWith('Act') || firstCell.startsWith('Admin') ||
          lastCol < defaultHeaders.length) {
        sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
      }
    }

    // จัดรูปแบบแถวหัวตาราง (สีพื้นหลังโทนสุขุม เรียบหรู สะอาดตา ไม่ฉูดฉาด ตัวอักษรสีขาว ตัวหนา ล็อกแถวบนสุด)
    sheet.setFrozenRows(1);
    try {
      sheet.setRowHeight(1, 34);
    } catch (e) {}
    sheet.getRange(1, 1, 1, defaultHeaders.length)
      .setBackground(headerBgColor || "#1e293b")
      .setFontColor("#ffffff")
      .setFontWeight("bold")
      .setFontSize(10)
      .setVerticalAlignment("middle")
      .setHorizontalAlignment("center");
  }

  return sheet;
}

/**
 * ฟังก์ชันสร้าง/อัปเกรดแผ่นงานทั้งหมดให้เป็นระเบียบ แบ่งหมวดหมู่ชัดเจน และคงฟอร์แมต Plain Text รหัส/เบอร์โทร
 */
function initializeSheets() {
  const ss = getSpreadsheet();
  if (!ss) return { success: false, message: 'ไม่สามารถเปิดสเปรดชีตฐานข้อมูลได้' };
  
  // 1. รายชื่อนักเรียน (บังคับคอลัมน์ A=รหัส, E=วันเกิด, F=เบอร์โทร, O=มีผล ณ วันที่ เป็น Plain Text '@')
  const sheetStudents = getOrCreateSheetSmart(ss, 'STUDENTS', HEADERS.STUDENTS, '#1e293b');
  try {
    sheetStudents.getRange('A:A').setNumberFormat('@');
    sheetStudents.getRange('E:E').setNumberFormat('@');
    sheetStudents.getRange('F:F').setNumberFormat('@');
    sheetStudents.getRange('O:O').setNumberFormat('@');
  } catch (fmtErr) {}

  // 2. รายชื่ออาจารย์ผู้สอน (แยกหมวดหมู่เฉพาะอาจารย์และบุคลากรการสอน)
  const sheetTeachers = getOrCreateSheetSmart(ss, 'TEACHERS', HEADERS.TEACHERS, '#312e81');
  try {
    sheetTeachers.getRange('A:A').setNumberFormat('@');
    sheetTeachers.getRange('B:B').setNumberFormat('@');
    sheetTeachers.getRange('C:C').setNumberFormat('@');
    sheetTeachers.getRange('F:F').setNumberFormat('@');
  } catch (fmtErr) {}

  // 3. รายชื่อแอดมินดูแลระบบ (แยกหมวดหมู่เฉพาะผู้ดูแลระบบและแอดมินสูงสุด)
  const sheetAdmins = getOrCreateSheetSmart(ss, 'ADMINS', HEADERS.ADMINS, '#0f172a');
  try {
    sheetAdmins.getRange('A:A').setNumberFormat('@');
    sheetAdmins.getRange('B:B').setNumberFormat('@');
    sheetAdmins.getRange('C:C').setNumberFormat('@');
    sheetAdmins.getRange('F:F').setNumberFormat('@');
  } catch (fmtErr) {}

  if (sheetAdmins.getLastRow() === 1) {
    sheetAdmins.appendRow([
      'ADM001', 'admin', hashPassword_(getMasterPassword_() || Utilities.getUuid()), 'ผู้ดูแลระบบหลัก (Master Administrator)', 'SuperAdmin',
      '0800000000', 'admin@khalifah.local', 'ใช้งานปกติ', Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss"), 'ระบบสร้างขึ้นอัตโนมัติ'
    ]);
    const rIdx = sheetAdmins.getLastRow();
    sheetAdmins.getRange(rIdx, 2).setNumberFormat('@').setValue('admin');
  }

  // 4. บันทึกสถานะของนักเรียน (ประวัติการเปลี่ยนสถานะ: ปกติ, สำเร็จการศึกษา, ลาออก, พักการเรียน พร้อมวันที่มีผลและเหตุผล)
  const sheetStatusLogs = getOrCreateSheetSmart(ss, 'STATUS_LOGS', HEADERS.STATUS_LOGS, '#334155');
  try {
    sheetStatusLogs.getRange('A:A').setNumberFormat('@');
    sheetStatusLogs.getRange('B:B').setNumberFormat('@');
    sheetStatusLogs.getRange('G:G').setNumberFormat('@');
  } catch (fmtErr) {}

  // 5. บันทึกเวลาละหมาด
  const sheetPrayers = getOrCreateSheetSmart(ss, 'PRAYERS', HEADERS.PRAYERS, '#064e3b');
  try {
    sheetPrayers.getRange('A:A').setNumberFormat('@');
    sheetPrayers.getRange('B:B').setNumberFormat('@');
  } catch (fmtErr) {}

  // 6. กิจกรรม
  getOrCreateSheetSmart(ss, 'ACTIVITIES', HEADERS.ACTIVITIES, '#0369a1');

  // 7. บันทึกการเข้าร่วมกิจกรรม
  const sheetActLogs = getOrCreateSheetSmart(ss, 'ACTIVITY_LOGS', HEADERS.ACTIVITY_LOGS, '#0284c7');
  try {
    sheetActLogs.getRange('B:B').setNumberFormat('@');
    sheetActLogs.getRange('D:D').setNumberFormat('@');
  } catch (fmtErr) {}

  // 8. บันทึกการมาเรียน
  const sheetAttendance = getOrCreateSheetSmart(ss, 'ATTENDANCE', HEADERS.ATTENDANCE, '#334155');
  try {
    sheetAttendance.getRange('B:B').setNumberFormat('@');
  } catch (fmtErr) {}

  // 9. ผลการเรียนรายวิชา
  const sheetGrades = getOrCreateSheetSmart(ss, 'GRADES', HEADERS.GRADES, '#4338ca');
  try {
    sheetGrades.getRange('A:A').setNumberFormat('@');
  } catch (fmtErr) {}

  // 10. บันทึกผลบุญ
  const sheetHasanat = getOrCreateSheetSmart(ss, 'HASANAT', HEADERS.HASANAT, '#047857');
  try {
    sheetHasanat.getRange('B:B').setNumberFormat('@');
  } catch (fmtErr) {}

  // 11. รายการรออนุมัติสมัคร
  ensureApprovalsSheet();

  // 12. การตั้งค่า
  const sheetSettings = getOrCreateSheetSmart(ss, 'SETTINGS', HEADERS.SETTINGS, '#334155');
  try {
    sheetSettings.getRange('B:B').setNumberFormat('@');
  } catch (fmtErr) {}

  if (sheetSettings.getLastRow() === 1) {
    sheetSettings.appendRow(['AppName', 'ระบบ KHALIFAH PROGRAM', 'ชื่อระบบ']);
    sheetSettings.appendRow(['CurrentAcademicYear', '2569', 'ปีการศึกษาปัจจุบัน']);
  }

  // 13. ปฏิทินกิจกรรม
  const sheetCal = getOrCreateSheetSmart(ss, 'CALENDAR', HEADERS.CALENDAR, '#0284c7');
  try {
    sheetCal.getRange('A:A').setNumberFormat('@');
    sheetCal.getRange('C:C').setNumberFormat('@');
    sheetCal.getRange('D:D').setNumberFormat('@');
    sheetCal.getRange('E:E').setNumberFormat('@');
    sheetCal.getRange('F:F').setNumberFormat('@');
  } catch (fmtErr) {}

  // 14. คำขออนุมัติละหมาด (กรณีลืมเช็คชื่อ)
  const sheetNo = getOrCreateSheetSmart(ss, 'NOTIFS', HEADERS.NOTIFS, '#ea580c');
  try { sheetNo.getRange('A:B').setNumberFormat('@'); sheetNo.getRange('F:F').setNumberFormat('@'); } catch (fmtErr) {}
  const sheetNr = getOrCreateSheetSmart(ss, 'NOTIF_READS', HEADERS.NOTIF_READS, '#fb923c');
  try { sheetNr.getRange('A:C').setNumberFormat('@'); } catch (fmtErr) {}
  const sheetHq = getOrCreateSheetSmart(ss, 'HALAQAH', HEADERS.HALAQAH, '#047857');
  try { sheetHq.getRange('A:H').setNumberFormat('@'); } catch (fmtErr) {}
  const sheetHl = getOrCreateSheetSmart(ss, 'HALAQAH_LOGS', HEADERS.HALAQAH_LOGS, '#10b981');
  try { sheetHl.getRange('A:F').setNumberFormat('@'); } catch (fmtErr) {}
  const sheetDr = getOrCreateSheetSmart(ss, 'DREAMS', HEADERS.DREAMS, '#db2777');
  try { sheetDr.getRange('A:A').setNumberFormat('@'); } catch (fmtErr) {}
  const sheetPa = getOrCreateSheetSmart(ss, 'POLICY_ACKS', HEADERS.POLICY_ACKS, '#16a34a');
  try { sheetPa.getRange('A:D').setNumberFormat('@'); } catch (fmtErr) {}
  const sheetBeh = getOrCreateSheetSmart(ss, 'BEHAVIOR', HEADERS.BEHAVIOR, '#0f766e');
  try { sheetBeh.getRange('A:I').setNumberFormat('@'); } catch (fmtErr) {}
  const sheetEval = getOrCreateSheetSmart(ss, 'TEACHER_EVALS', HEADERS.TEACHER_EVALS, '#7c3aed');
  try { sheetEval.getRange('A:F').setNumberFormat('@'); sheetEval.getRange('L:L').setNumberFormat('@'); } catch (fmtErr) {}
  const sheetAsg = getOrCreateSheetSmart(ss, 'ASSIGNMENT_SCORES', HEADERS.ASSIGNMENT_SCORES, '#4338ca');
  try {
    sheetAsg.getRange('A:A').setNumberFormat('@');
    sheetAsg.getRange('B:B').setNumberFormat('@');
    sheetAsg.getRange('D:D').setNumberFormat('@');
    sheetAsg.getRange('G:G').setNumberFormat('@');
  } catch (fmtErr) {}

  const sheetPrayerApprovals = getOrCreateSheetSmart(ss, 'PRAYER_APPROVALS', HEADERS.PRAYER_APPROVALS, '#0284c7');
  try {
    sheetPrayerApprovals.getRange('A:A').setNumberFormat('@');
    sheetPrayerApprovals.getRange('B:B').setNumberFormat('@');
    sheetPrayerApprovals.getRange('E:E').setNumberFormat('@');
    sheetPrayerApprovals.getRange('G:G').setNumberFormat('@');
  } catch (fmtErr) {}

  // อพยพข้อมูลจากชีตเดิมแบบแยกตารางอาจารย์และแอดมิน
  migrateLegacyAdminsAndTeachers(ss);

  // ทำการแปลงข้อมูลในเซลล์เดิมที่เป็นภาษาอังกฤษให้เป็นภาษาไทย และทำความสะอาดเลขศูนย์นำหน้า
  convertDataCellsToThai(ss);

  // ใส่ Data Validation Dropdown ใน Google Sheets เพื่อการคีย์ข้อมูลที่แม่นยำและเป็นระเบียบ
  applySheetFormattingAndValidations(ss);

  // เรียงลำดับแท็บใน Google Sheets ให้สะอาด เป็นหมวดหมู่ และค้นหาง่าย
  reorderSheets(ss);

  return { success: true, message: 'ฐานข้อมูล Google Sheets ถูกจัดระเบียบและเรียบเรียงเป็นหมวดหมู่อย่างสวยงาม 100% เรียบร้อยแล้ว' };
}

/**
 * เรียงลำดับแผ่นงานใน Google Sheets ตามโครงสร้างมาตรฐาน
 */
function reorderSheets(ss) {
  try {
    for (let i = 0; i < SHEET_ORDER.length; i++) {
      const sheetName = SHEET_ORDER[i];
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        try {
          sheet.setIndex(i + 1);
        } catch (e) {
          Logger.log('Could not reorder sheet ' + sheetName + ': ' + e.message);
        }
      }
    }
  } catch (err) {
    Logger.log('reorderSheets error: ' + err.message);
  }
}

/**
 * ใส่ Data Validation Dropdown ให้กับคอลัมน์สำคัญใน Google Sheets
 */
function applyListValidation(sheet, startRow, colIndex, numRows, optionsList) {
  try {
    if (!sheet || numRows < 1) return;
    const range = sheet.getRange(startRow, colIndex, numRows, 1);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(optionsList, true)
      .setAllowInvalid(true)
      .build();
    range.setDataValidation(rule);
  } catch (err) {
    Logger.log('applyListValidation error: ' + err.message);
  }
}

/**
 * กำหนด Dropdown Validation ให้กับแต่ละชีตเพื่อความเป็นระเบียบและลดข้อผิดพลาดในการกรอกข้อมูล
 */
function applySheetFormattingAndValidations(ss) {
  try {
    // 1. รายชื่อนักเรียน: Dropdown สถานะนักเรียน (Col 8)
    const sheetStudents = ss.getSheetByName(SHEETS.STUDENTS);
    if (sheetStudents) {
      applyListValidation(sheetStudents, 2, 8, Math.max(500, sheetStudents.getMaxRows() - 1), [
        'ปกติ (กำลังศึกษา)',
        'สำเร็จการศึกษา',
        'ลาออก',
        'พักการเรียน'
      ]);
    }

    // 2. รายชื่ออาจารย์ผู้สอน: Dropdown ตำแหน่ง/สิทธิ์ (Col 5) และ สถานะการทำงาน (Col 9)
    const sheetTeachers = ss.getSheetByName(SHEETS.TEACHERS);
    if (sheetTeachers) {
      applyListValidation(sheetTeachers, 2, 5, Math.max(50, sheetTeachers.getMaxRows() - 1), [
        'อาจารย์ผู้สอน',
        'อาจารย์ประจำชั้น',
        'อาจารย์ฝ่ายวิชาการ',
        'อาจารย์ฝ่ายกิจกรรม',
        'ผู้บริหาร'
      ]);
      applyListValidation(sheetTeachers, 2, 9, Math.max(50, sheetTeachers.getMaxRows() - 1), [
        'ปฏิบัติหน้าที่ปกติ',
        'ลาศึกษาต่อ',
        'พ้นสภาพ'
      ]);
    }

    // 3. รายชื่อแอดมินดูแลระบบ: Dropdown สิทธิ์ (Col 5) และ สถานะบัญชี (Col 8)
    const sheetAdmins = ss.getSheetByName(SHEETS.ADMINS);
    if (sheetAdmins) {
      applyListValidation(sheetAdmins, 2, 5, Math.max(50, sheetAdmins.getMaxRows() - 1), [
        'SuperAdmin',
        'Admin',
        'ผู้ดูแลระบบหลัก',
        'ผู้ช่วยแอดมิน'
      ]);
      applyListValidation(sheetAdmins, 2, 8, Math.max(50, sheetAdmins.getMaxRows() - 1), [
        'ใช้งานปกติ',
        'ระงับการใช้งานชั่วคราว',
        'ยกเลิกสิทธิ์'
      ]);
    }

    // 4. บันทึกสถานะของนักเรียน: Dropdown สถานะเดิม (Col 5) และ สถานะใหม่ (Col 6)
    const sheetStatusLogs = ss.getSheetByName(SHEETS.STATUS_LOGS);
    if (sheetStatusLogs) {
      const statusOptions = ['ปกติ (กำลังศึกษา)', 'สำเร็จการศึกษา', 'ลาออก', 'พักการเรียน'];
      applyListValidation(sheetStatusLogs, 2, 5, Math.max(100, sheetStatusLogs.getMaxRows() - 1), statusOptions);
      applyListValidation(sheetStatusLogs, 2, 6, Math.max(100, sheetStatusLogs.getMaxRows() - 1), statusOptions);
    }

    // 5. บันทึกเวลาละหมาด: Dropdown เวลาละหมาด (Col 5), อยู่ในพิกัด (Col 13), สถานะละหมาด (Col 15)
    const sheetPrayers = ss.getSheetByName(SHEETS.PRAYERS);
    if (sheetPrayers) {
      applyListValidation(sheetPrayers, 2, 5, Math.max(100, sheetPrayers.getMaxRows() - 1), [
        'ศุบฮิ (ซุบฮิ)',
        'ซุฮริ (ดุฮริ)',
        'อัศริ',
        'มัฆริบ',
        'อิชาอ์'
      ]);
      applyListValidation(sheetPrayers, 2, 13, Math.max(100, sheetPrayers.getMaxRows() - 1), [
        'ใช่',
        'ไม่ใช่'
      ]);
      applyListValidation(sheetPrayers, 2, 15, Math.max(100, sheetPrayers.getMaxRows() - 1), [
        'ตรงเวลา',
        'มาสาย',
        'ลา/มีเหตุจำเป็น',
        'ขาด'
      ]);
    }

    // 6. บันทึกการมาเรียน: Dropdown สถานะการมาเรียน (Col 7)
    const sheetAttendance = ss.getSheetByName(SHEETS.ATTENDANCE);
    if (sheetAttendance) {
      applyListValidation(sheetAttendance, 2, 7, Math.max(100, sheetAttendance.getMaxRows() - 1), [
        'มา',
        'มาสาย',
        'ลา/มีเหตุจำเป็น',
        'ขาด'
      ]);
    }

    // 7. ปฏิทินกิจกรรม: Dropdown หมวดหมู่ (Col 8) และ กลุ่มเป้าหมาย (Col 9)
    const sheetCal = ss.getSheetByName(SHEETS.CALENDAR);
    if (sheetCal) {
      applyListValidation(sheetCal, 2, 8, Math.max(100, sheetCal.getMaxRows() - 1), [
        'กิจกรรมทั่วไป',
        'การเรียนการสอน',
        'การสอบ / ประเมินผล',
        'ละหมาด / ศาสนกิจ',
        'วันหยุด / ปิดภาคเรียน',
        'ประชุม / สัมมนา'
      ]);
      applyListValidation(sheetCal, 2, 9, Math.max(100, sheetCal.getMaxRows() - 1), [
        'ทุกคน (นักเรียนและอาจารย์)',
        'เฉพาะนักเรียน',
        'เฉพาะอาจารย์และผู้บริหาร'
      ]);
    }
  } catch (err) {
    Logger.log('applySheetFormattingAndValidations error: ' + err.message);
  }
}

/**
 * แยกข้อมูลอาจารย์และแอดมินจากชีต 'ผู้ดูแลระบบ' เดิม ออกเป็น 2 ชีตอย่างเป็นสัดส่วน
 */
function migrateLegacyAdminsAndTeachers(ss) {
  try {
    const legacySheet = ss.getSheetByName('ผู้ดูแลระบบ');
    if (!legacySheet) return;

    const sheetTeachers = ss.getSheetByName(SHEETS.TEACHERS);
    const sheetAdmins = ss.getSheetByName(SHEETS.ADMINS);
    if (!sheetTeachers || !sheetAdmins) return;

    const lastRow = legacySheet.getLastRow();
    if (lastRow <= 1) return;

    const rows = legacySheet.getDataRange().getValues();
    const existingTeachers = sheetTeachers.getLastRow() > 1 
      ? sheetTeachers.getRange(2, 2, sheetTeachers.getLastRow() - 1, 1).getValues().map(r => cleanVal(r[0]).toLowerCase())
      : [];
    const existingAdmins = sheetAdmins.getLastRow() > 1
      ? sheetAdmins.getRange(2, 2, sheetAdmins.getLastRow() - 1, 1).getValues().map(r => cleanVal(r[0]).toLowerCase())
      : [];

    for (let i = 1; i < rows.length; i++) {
      const id = cleanVal(rows[i][0]);
      const username = cleanVal(rows[i][1]);
      const pass = cleanVal(rows[i][2]);
      const fullName = cleanVal(rows[i][3]);
      const role = cleanVal(rows[i][4]);
      const createdAt = formatSheetDate(rows[i][5]) || cleanVal(rows[i][5]);
      const email = cleanVal(rows[i][6]);
      const phone = normalizePhone(rows[i][7]);
      const subjectsJson = rows[i][8] || '[]';

      if (!username) continue;
      const uLower = username.toLowerCase();

      const isTeacher = (role === 'TEACHER' || role === 'Teacher' || role.includes('อาจารย์') || role.includes('ผู้สอน'));

      if (isTeacher) {
        if (existingTeachers.indexOf(uLower) === -1) {
          sheetTeachers.appendRow([
            id || ('TCH-' + new Date().getTime()),
            username,
            pass,
            fullName,
            role || 'อาจารย์ผู้สอน',
            phone,
            email,
            subjectsJson,
            'ปฏิบัติหน้าที่ปกติ',
            createdAt || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss")
          ]);
          existingTeachers.push(uLower);
          const rIdx = sheetTeachers.getLastRow();
          sheetTeachers.getRange(rIdx, 2).setNumberFormat('@').setValue(username);
          sheetTeachers.getRange(rIdx, 3).setNumberFormat('@').setValue(pass);
          sheetTeachers.getRange(rIdx, 6).setNumberFormat('@').setValue(phone);
        }
      } else {
        if (existingAdmins.indexOf(uLower) === -1) {
          sheetAdmins.appendRow([
            id || ('ADM-' + new Date().getTime()),
            username,
            pass,
            fullName,
            role || 'Admin',
            phone,
            email,
            'ใช้งานปกติ',
            createdAt || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss"),
            'ย้ายข้อมูลจากระบบเดิม'
          ]);
          existingAdmins.push(uLower);
          const rIdx = sheetAdmins.getLastRow();
          sheetAdmins.getRange(rIdx, 2).setNumberFormat('@').setValue(username);
          sheetAdmins.getRange(rIdx, 3).setNumberFormat('@').setValue(pass);
          sheetAdmins.getRange(rIdx, 6).setNumberFormat('@').setValue(phone);
        }
      }
    }
  } catch (err) {
    Logger.log('migrateLegacyAdminsAndTeachers error: ' + err.message);
  }
}

/**
 * ฟังก์ชันจัดระเบียบ Google Sheets ทันที (สามารถเรียกผ่านปุ่มในระบบแอดมิน หรือกด Run ใน Apps Script)
 */
function organizeGoogleSheets() {
  return initializeSheets();
}

/**
 * แปลงค่าในเซลล์แถวข้อมูล (Row 2 เป็นต้นไป) จากภาษาอังกฤษเป็นภาษาไทย และทำความสะอาดเลข 0 นำหน้า
 */
function convertDataCellsToThai(ss) {
  try {
    // 1. แปลงตารางบันทึกละหมาด
    const sheetPrayers = ss.getSheetByName(SHEETS.PRAYERS);
    if (sheetPrayers && sheetPrayers.getLastRow() > 1) {
      const data = sheetPrayers.getRange(2, 1, sheetPrayers.getLastRow() - 1, 16).getValues();
      let changed = false;
      for (let i = 0; i < data.length; i++) {
        // เวลาละหมาด (Col 5)
        const thaiPt = formatPrayerTimeThai(data[i][4]);
        if (thaiPt !== data[i][4]) { data[i][4] = thaiPt; changed = true; }
        
        // อยู่ในพิกัด (Col 13)
        if (data[i][12] === true || data[i][12] === 'true' || data[i][12] === 'yes') {
          data[i][12] = 'ใช่'; changed = true;
        } else if (data[i][12] === false || data[i][12] === 'false' || data[i][12] === 'no') {
          data[i][12] = 'ไม่ใช่'; changed = true;
        }

        // สถานะละหมาด (Col 15)
        const thaiSt = formatStatusThai(data[i][14]);
        if (thaiSt !== data[i][14]) { data[i][14] = thaiSt; changed = true; }
      }
      if (changed) {
        sheetPrayers.getRange(2, 1, data.length, 16).setValues(data);
      }
    }

    // 2. แปลงตารางนักเรียน (สถานะ และจัดฟอร์แมตรหัสนักเรียน/เบอร์โทร/วันเกิด ให้เป็น Plain Text ที่คงเลข 0 นำหน้า)
    const sheetStudents = ss.getSheetByName(SHEETS.STUDENTS);
    if (sheetStudents && sheetStudents.getLastRow() > 1) {
      const numRows = sheetStudents.getLastRow() - 1;
      const numCols = Math.min(sheetStudents.getLastColumn(), 9);
      const data = sheetStudents.getRange(2, 1, numRows, numCols).getValues();
      let changed = false;
      for (let i = 0; i < data.length; i++) {
        // ทำความสะอาดรหัสนักเรียน (Col 1)
        const cleanSid = cleanVal(data[i][0]);
        if (cleanSid !== data[i][0]) {
          data[i][0] = cleanSid;
          changed = true;
        }

        // ทำความสะอาดวันเกิด (Col 5)
        const cleanBD = normalizeBirthDate(data[i][4]);
        if (cleanBD !== data[i][4]) {
          data[i][4] = cleanBD;
          changed = true;
        }

        // ทำความสะอาดเบอร์โทรศัพท์ (Col 6)
        const cleanPh = normalizePhone(data[i][5]);
        if (cleanPh !== data[i][5]) {
          data[i][5] = cleanPh;
          changed = true;
        }

        // สถานะ (Col 8)
        if (data[i][7] === 'Active' || data[i][7] === 'active') {
          data[i][7] = 'ปกติ (กำลังศึกษา)';
          changed = true;
        }
      }
      if (changed) {
        sheetStudents.getRange(2, 1, numRows, numCols).setNumberFormat('@').setValues(data);
      }
    }
  } catch (err) {
    Logger.log('convertDataCellsToThai error: ' + err.message);
  }
}

/**
 * ฟังก์ชันสำหรับผู้ดูแลระบบกด "เรียกใช้ (Run)" ใน Apps Script ได้โดยตรง
 */
function convertToThaiLanguage() {
  const result = initializeSheets();
  Logger.log(result.message);
  return result;
}

// ----------------- ตัวแปลงข้อความเป็นภาษาไทย ----------------- //

function formatPrayerTimeThai(pt) {
  if (!pt) return '';
  const s = String(pt).toUpperCase().trim();
  if (s === 'FAJR' || s === 'SUBAH' || s.includes('ศุบฮิ') || s.includes('ซุบฮิ')) return 'ศุบฮิ (ซุบฮิ)';
  if (s === 'DHUHR' || s === 'ZUHR' || s.includes('ซุฮริ') || s.includes('ดุฮริ')) return 'ซุฮริ (ดุฮริ)';
  if (s === 'ASR' || s.includes('อัศริ')) return 'อัศริ';
  if (s === 'MAGHRIB' || s.includes('มัฆริบ')) return 'มัฆริบ';
  if (s === 'ISHA' || s.includes('อิชาอ์')) return 'อิชาอ์';
  return pt;
}

function formatStatusThai(status) {
  if (!status) return 'ตรงเวลา';
  const s = String(status).toUpperCase().trim();
  if (s === 'ON_TIME' || s === 'ONTIME' || s === 'ตรงเวลา') return 'ตรงเวลา';
  if (s === 'LATE' || s === 'สาย' || s === 'มาสาย') return 'มาสาย';
  if (s === 'EXCUSED' || s === 'ลา' || s.includes('เหตุจำเป็น')) return 'ลา/มีเหตุจำเป็น';
  if (s === 'ABSENT' || s === 'ขาด') return 'ขาด';
  if (s === 'PRESENT' || s === 'มา') return 'ตรงเวลา';
  return status;
}

function formatStudentStatusThai(status) {
  if (!status) return 'ปกติ (กำลังศึกษา)';
  const s = String(status).toUpperCase().trim();
  if (s === 'ACTIVE' || s === 'ปกติ' || s.includes('กำลังศึกษา')) return 'ปกติ (กำลังศึกษา)';
  if (s === 'GRADUATED' || s.includes('สำเร็จ')) return 'สำเร็จการศึกษา';
  if (s === 'RESIGNED' || s.includes('ลาออก') || s.includes('ออก')) return 'ลาออก';
  if (s === 'SUSPENDED' || s.includes('พัก')) return 'พักการเรียน';
  return status;
}

function formatAttendanceStatusThai(status) {
  if (!status) return 'มา';
  const s = String(status).toUpperCase().trim();
  if (s === 'PRESENT' || s === 'มา') return 'มา';
  if (s === 'LATE' || s === 'สาย') return 'มาสาย';
  if (s === 'EXCUSED' || s === 'ลา') return 'ลา/มีเหตุจำเป็น';
  if (s === 'ABSENT' || s === 'ขาด') return 'ขาด';
  return status;
}

// =====================================================================
//  🔐 SECURITY LAYER (v8.0)
//  - ทุกคำขอที่อ่าน/เขียนข้อมูลส่วนบุคคล ต้องแนบ token ที่ได้จากการเข้าสู่ระบบ
//  - token ลงลายมือชื่อด้วย HMAC-SHA256 (ปลอมแปลงไม่ได้) หมดอายุใน 30 วัน
//  - ไม่ส่งรหัสผ่าน / รหัส OTP กลับไปยังเบราว์เซอร์อีกต่อไป
//  - รหัสผ่านอาจารย์/แอดมินถูกเก็บเป็นค่าแฮช (sha256$...) อัตโนมัติเมื่อเข้าสู่ระบบสำเร็จ
// =====================================================================

const SESSION_TTL_MS = 400 * 24 * 60 * 60 * 1000; // จำการเข้าสู่ระบบจนกว่าจะกดออกจากระบบเอง (ต่ออายุอัตโนมัติเมื่อใช้งาน)
const ADMIN_ROLE_VALUES = ['superadmin', 'admin', 'subadmin', 'ผู้ดูแลระบบหลัก', 'ผู้ช่วยแอดมิน', 'ผู้ดูแลระบบ', 'แอดมินรอง'];
const OWNER_ROLE_VALUES = ['superadmin', 'ผู้ดูแลระบบหลัก'];
function isOwnerRole_(v) { return OWNER_ROLE_VALUES.indexOf(cleanVal(v).toLowerCase()) !== -1; }
function isAdminRole_(v) { return ADMIN_ROLE_VALUES.indexOf(cleanVal(v).toLowerCase()) !== -1; }
const LOGIN_MAX_FAILS = 8;          // ล็อกชั่วคราวหลังกรอกผิดติดกัน
const LOGIN_LOCK_SECONDS = 15 * 60; // 15 นาที
const FULL_DB_CACHE_SECONDS = 90;   // แคชผลลัพธ์ฐานข้อมูลรวม (ล้างอัตโนมัติเมื่อมีการบันทึก)

/**
 * ⭐ กด "เรียกใช้ (Run)" ฟังก์ชันนี้ 1 ครั้งหลังวางโค้ดเวอร์ชันใหม่
 * 1) สร้างกุญแจลับสำหรับ token
 * 2) แปลงรหัสผ่านอาจารย์/แอดมินในชีตทั้งหมดให้เป็นค่าแฮช (ไม่มีใครอ่านรหัสจริงได้อีก)
 * 3) ลบแถว MasterCode ออกจากแผ่นงาน "การตั้งค่า"
 * 4) จัดโครงสร้างชีตตามเวอร์ชันใหม่
 */
function setupSecurity() {
  getTokenSecret_();
  initializeSheets();
  setProp_('SCHEMA_VERSION', SCHEMA_VERSION);
  const ss = getSpreadsheet();
  let hashed = 0;
  [SHEETS.TEACHERS, SHEETS.ADMINS].forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    const rng = sh.getRange(2, 3, sh.getLastRow() - 1, 1);
    const vals = rng.getValues();
    let changed = false;
    for (let i = 0; i < vals.length; i++) {
      const v = cleanVal(vals[i][0]);
      if (v && v.indexOf('sha256$') !== 0) { vals[i][0] = hashPassword_(v); hashed++; changed = true; }
    }
    if (changed) rng.setNumberFormat('@').setValues(vals);
  });
  const st = ss.getSheetByName(SHEETS.SETTINGS);
  if (st && st.getLastRow() > 1) {
    const rows = st.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (cleanVal(rows[i][0]) === 'MasterCode') st.deleteRow(i + 1);
    }
  }
  bumpDataVersion_();
  const msg = 'ตั้งค่าความปลอดภัยสำเร็จ: แฮชรหัสผ่าน ' + hashed + ' บัญชี' +
    (isUsingLegacyMaster_() ? ' ❌ ยังไม่ได้ตั้ง MASTER_ADMIN_PASS — แอดมินหลักจะเข้าสู่ระบบไม่ได้จนกว่าจะตั้ง' : ' ✅ ใช้รหัสแอดมินหลักจาก Script Properties');
  Logger.log(msg);
  return msg;
}

/** กด Run เพื่อบังคับให้ทุกคนออกจากระบบ (เช่น เมื่อสงสัยว่ารหัสรั่ว) */
function logoutAllSessions() {
  setProp_('SESSION_EPOCH', String(Date.now()));
  Logger.log('ยกเลิก token ทั้งหมดแล้ว ผู้ใช้ทุกคนต้องเข้าสู่ระบบใหม่');
}

function getProp_(k) {
  try { return PropertiesService.getScriptProperties().getProperty(k) || ''; } catch (e) { return ''; }
}
function setProp_(k, v) {
  PropertiesService.getScriptProperties().setProperty(k, String(v));
}
function getMasterPassword_() {
  // รหัสแอดมินหลักอ่านจาก Script Properties เท่านั้น (ไม่มีรหัสฝังในโค้ด)
  return String(getProp_('MASTER_ADMIN_PASS') || '').trim();
}
function isUsingLegacyMaster_() {
  return !getMasterPassword_();
}
/** รันใน Apps Script เพื่อตรวจว่าตั้งรหัสแอดมินหลักถูกต้องหรือยัง (ไม่แสดงรหัส) */
function checkSecurityStatus() {
  const raw = String(getProp_('MASTER_ADMIN_PASS') || '');
  let msg;
  if (!raw) msg = '❌ ยังไม่พบ Script Property ชื่อ MASTER_ADMIN_PASS (ตรวจตัวสะกด/ช่องว่าง) — ตอนนี้แอดมินหลักเข้าสู่ระบบไม่ได้';
  else msg = '✅ ตั้ง MASTER_ADMIN_PASS แล้ว (ยาว ' + raw.trim().length + ' ตัวอักษร)';
  const keys = PropertiesService.getScriptProperties().getKeys().join(', ');
  Logger.log(msg + '\nชื่อ Script Properties ที่มีอยู่: ' + keys);
  return msg;
}
function getTokenSecret_() {
  let s = getProp_('TOKEN_SECRET');
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    setProp_('TOKEN_SECRET', s);
  }
  return s;
}

function b64urlEncode_(strOrBytes) {
  const bytes = (typeof strOrBytes === 'string') ? Utilities.newBlob(strOrBytes).getBytes() : strOrBytes;
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}
function b64urlDecodeToString_(s) {
  let str = String(s);
  while (str.length % 4) str += '=';
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(str)).getDataAsString();
}
function safeEquals_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function signToken_(body) {
  return b64urlEncode_(Utilities.computeHmacSha256Signature(body, getTokenSecret_()));
}

/** role: 'student' | 'teacher' | 'admin' */
function issueToken_(role, userId, name, owner, preview, limit) {
  const payload = {
    r: role,
    o: owner ? 1 : 0,
    u: cleanVal(userId),
    n: cleanVal(name || ''),
    exp: Date.now() + (preview ? 3 * 3600 * 1000 : SESSION_TTL_MS),
    ep: getProp_('SESSION_EPOCH') || '0'
  };
  if (limit) payload.x = limit; // v17.48 · บัญชีสิทธิ์จำกัดที่เข้าทางแท็บแอดมิน: 'exec' ผู้บริหาร · 'act' ฝ่ายกิจกรรม
  if (preview) payload.pv = 1; // โหมดดูตัวอย่างของแอดมิน: อ่านได้อย่างเดียว
  const body = b64urlEncode_(JSON.stringify(payload));
  return 'v1.' + body + '.' + signToken_(body);
}

function verifyToken_(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  if (!safeEquals_(signToken_(parts[1]), parts[2])) return null;
  try {
    const p = JSON.parse(b64urlDecodeToString_(parts[1]));
    if (!p || !p.r || !p.u) return null;
    if (Date.now() > Number(p.exp || 0)) return null;
    if ((p.ep || '0') !== (getProp_('SESSION_EPOCH') || '0')) return null;
    return { role: p.r, userId: p.u, name: p.n || '', owner: !p.x && p.r === 'admin' && (!!p.o || p.u === 'MasterAdmin'), preview: !!p.pv, limit: p.x || '' };
  } catch (e) {
    return null;
  }
}

const INSPECTOR_ROLE_VALUES = ['inspector', 'ผู้ตรวจการ'];
function isInspectorRole_(v) { return INSPECTOR_ROLE_VALUES.indexOf(cleanVal(v).toLowerCase()) !== -1; }
// บทบาทที่เข้าระบบทางแท็บแอดมินด้วยรหัสผ่านอย่างเดียว
const PASSWORD_ONLY_ROLE_VALUES = ['superadmin', 'subadmin', 'admin', 'ผู้ช่วยแอดมิน', 'ผู้ดูแลระบบ', 'แอดมินรอง', 'executive', 'ผู้บริหาร', 'inspector', 'ผู้ตรวจการ', 'activityadmin', 'activity', 'ฝ่ายกิจกรรม', 'nightduty', 'ครูเวรหอพักกลางคืน', 'ครูเวรหอพัก'];
// v17.48 · บัญชีสิทธิ์จำกัด (เข้าทางแท็บแอดมิน เห็นเฉพาะเมนูของตน · เซิร์ฟเวอร์ตรวจทุกคำสั่ง)
function limitOfRole_(v) { const r = cleanVal(v).toLowerCase(); if (r === 'executive' || r === 'ผู้บริหาร') return 'exec'; if (r === 'activityadmin' || r === 'activity' || r === 'ฝ่ายกิจกรรม') return 'act'; if (r === 'nightduty' || r === 'ครูเวรหอพักกลางคืน' || r === 'ครูเวรหอพัก') return 'night'; return ''; }
const LIMIT_COMMON_ACTIONS_ = ['whoami', 'getMyNotifications', 'markNotificationRead', 'hideNotification', 'updateSubAdminPhoto', 'getFullDatabase', 'getSettings', 'getCalendarEvents', 'getPolicy'];
// ผู้บริหาร: ดูได้ทุกอย่าง (อ่านอย่างเดียว) · แก้ได้เฉพาะตารางสอน และอนุมัติลาสอน
const LIMIT_EXEC_WRITES_ = ['saveTimetable', 'saveTimetableExtra', 'deleteTimetableExtra', 'saveTimetableConfig', 'approveTeacherLeave'];
// ฝ่ายกิจกรรม: ดูกิจกรรม + สแกน/เช็คชื่อเข้ากิจกรรม (เพิ่ม/ลบกิจกรรมไม่ได้)
const LIMIT_ACT_ACTIONS_ = ['getActivities', 'getActivityLogs', 'activityCheckIn', 'checkInActivity', 'getAllStudents'];
// v17.79 · ครูเวรหอพักกลางคืน: สร้าง/ลบกิจกรรม + เปิด QR/เช็คชื่อ · บันทึกคะแนนพฤติกรรม (แก้หัวข้อไม่ได้)
const LIMIT_NIGHT_ACTIONS_ = LIMIT_ACT_ACTIONS_.concat(['createActivity', 'deleteActivity', 'deleteActivityAttendee', 'getBehaviorData', 'addBehaviorLogs', 'cancelBehaviorLog']);
function limitAllows_(limit, action) {
  if (LIMIT_COMMON_ACTIONS_.indexOf(action) !== -1) return true;
  if (limit === 'exec') return READ_ONLY_ACTIONS.indexOf(action) !== -1 || LIMIT_EXEC_WRITES_.indexOf(action) !== -1;
  if (limit === 'act') return LIMIT_ACT_ACTIONS_.indexOf(action) !== -1;
  if (limit === 'night') return LIMIT_NIGHT_ACTIONS_.indexOf(action) !== -1;
  return true;
}
function isPasswordOnlyRole_(v) { return PASSWORD_ONLY_ROLE_VALUES.indexOf(cleanVal(v).toLowerCase()) !== -1; }
function passwordOnlyRows_() {
  const ss = getSpreadsheet(); const out = [];
  [SHEETS.ADMINS, SHEETS.TEACHERS].forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() <= 1) return;
    sh.getDataRange().getValues().slice(1).forEach(function (r) { if (cleanVal(r[1]) && isPasswordOnlyRole_(r[4])) out.push(r); });
  });
  return out;
}
/** คืนชื่อผู้ใช้ของบัญชีกลุ่มรหัสผ่านอย่างเดียวที่รหัสตรง (ต้องตรงเพียงบัญชีเดียว) */
function findPasswordOnlyAccount_(pass) {
  const hits = passwordOnlyRows_().filter(function (r) { return verifyPassword_(r[2], pass); });
  return hits.length === 1 ? cleanVal(hits[0][1]) : '';
}
function staffTokenRole_(roleValue) {
  const r = cleanVal(roleValue).toLowerCase();
  if (INSPECTOR_ROLE_VALUES.indexOf(r) !== -1) return 'inspector';
  return ADMIN_ROLE_VALUES.indexOf(r) !== -1 ? 'admin' : 'teacher';
}

// ---------- รหัสผ่าน (แฮช + รองรับรหัสเดิมแบบข้อความ) ----------
function normalizePasswordInput_(p) {
  let s = cleanVal(p).toLowerCase(); // ระบบเดิมเทียบรหัสแบบไม่สนตัวพิมพ์เล็ก/ใหญ่ และไม่สนเลข 0 นำหน้า
  if (/^\d+$/.test(s)) s = s.replace(/^0+/, '') || '0';
  return s;
}
function sha256Hex_(text) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return raw.map(function (b) { const v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
}
function hashPassword_(plain) {
  const salt = Utilities.getUuid().replace(/-/g, '').substring(0, 12);
  return 'sha256$' + salt + '$' + sha256Hex_(salt + normalizePasswordInput_(plain));
}
function isHashedPassword_(stored) {
  return cleanVal(stored).indexOf('sha256$') === 0;
}
function verifyPassword_(stored, plain) {
  const st = cleanVal(stored);
  if (!st || !cleanVal(plain)) return false;
  if (isHashedPassword_(st)) {
    const parts = st.split('$');
    if (parts.length !== 3) return false;
    return safeEquals_(sha256Hex_(parts[1] + normalizePasswordInput_(plain)), parts[2]);
  }
  return isCodeMatch(st, plain);
}

// ---------- ป้องกันการเดารหัส (Rate limit) ----------
function loginLocked_(key) {
  try {
    const n = Number(CacheService.getScriptCache().get('rl_' + key) || 0);
    return n >= LOGIN_MAX_FAILS;
  } catch (e) { return false; }
}
function loginFailed_(key) {
  try {
    const c = CacheService.getScriptCache();
    const n = Number(c.get('rl_' + key) || 0) + 1;
    c.put('rl_' + key, String(n), LOGIN_LOCK_SECONDS);
  } catch (e) {}
}
function loginSucceeded_(key) {
  try { CacheService.getScriptCache().remove('rl_' + key); } catch (e) {}
}
const LOCKED_MESSAGE = 'กรอกข้อมูลผิดหลายครั้งเกินไป ระบบล็อกชั่วคราว 15 นาที กรุณาลองใหม่ภายหลัง';

// ---------- แคชข้อมูลรวม ----------
function bumpDataVersion_() {
  try { CacheService.getScriptCache().put('DATA_VER', Utilities.getUuid(), 21600); } catch (e) {}
}
function getDataVersion_() {
  try {
    const c = CacheService.getScriptCache();
    let v = c.get('DATA_VER');
    if (!v) { v = Utilities.getUuid(); c.put('DATA_VER', v, 21600); }
    return v;
  } catch (e) { return 'nocache'; }
}
function cacheGetJson_(key) {
  try {
    const c = CacheService.getScriptCache();
    const meta = c.get(key + '_n');
    if (!meta) return null;
    const n = Number(meta);
    const keys = [];
    for (let i = 0; i < n; i++) keys.push(key + '_' + i);
    const parts = c.getAll(keys);
    let s = '';
    for (let i = 0; i < n; i++) {
      if (parts[keys[i]] === undefined || parts[keys[i]] === null) return null;
      s += parts[keys[i]];
    }
    return JSON.parse(s);
  } catch (e) { return null; }
}
function cachePutJson_(key, obj, seconds) {
  try {
    const s = JSON.stringify(obj);
    if (s.length > 4 * 1024 * 1024) return; // ใหญ่เกินไปสำหรับแคช
    const size = 90000;
    const map = {};
    let n = 0;
    for (let i = 0; i < s.length; i += size) { map[key + '_' + n] = s.substring(i, i + size); n++; }
    map[key + '_n'] = String(n);
    CacheService.getScriptCache().putAll(map, seconds);
  } catch (e) {}
}

// ---------- อ่านชีตแบบจำค่าในคำขอเดียว (ลดการอ่านซ้ำ) ----------
let __ROWS_MEMO = null;
function readAllRows_(sheet) {
  if (!sheet) return [];
  if (__ROWS_MEMO) {
    const k = sheet.getName();
    if (!__ROWS_MEMO[k]) __ROWS_MEMO[k] = sheet.getDataRange().getValues();
    return __ROWS_MEMO[k];
  }
  return sheet.getDataRange().getValues();
}

// ---------- ตรวจโครงสร้างชีตแบบเบา (แทนการจัดรูปแบบใหม่ทุกคำขอ) ----------
let __SCHEMA_OK = false;
function ensureSchema() {
  if (__SCHEMA_OK) return;
  let cache = null;
  try {
    cache = CacheService.getScriptCache();
    if (cache.get('SCHEMA_OK_' + SCHEMA_VERSION)) { __SCHEMA_OK = true; return; }
  } catch (e) {}
  const ss = getSpreadsheet();
  const names = ss.getSheets().map(function (sh) { return sh.getName(); });
  const missing = Object.keys(SHEETS).some(function (k) { return names.indexOf(SHEETS[k]) === -1; });
  if (missing || getProp_('SCHEMA_VERSION') !== SCHEMA_VERSION) {
    const lock = LockService.getScriptLock();
    try { lock.waitLock(20000); } catch (e) {}
    try {
      if (missing || getProp_('SCHEMA_VERSION') !== SCHEMA_VERSION) {
        initializeSheets();
        setProp_('SCHEMA_VERSION', SCHEMA_VERSION);
      }
    } finally {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
  __SCHEMA_OK = true;
  try { if (cache) cache.put('SCHEMA_OK_' + SCHEMA_VERSION, '1', 600); } catch (e) {}
}

// ---------- ล้างข้อมูลลับก่อนส่งออก ----------
function publicStaff_(s, includeContact) {
  if (!s) return s;
  const o = {};
  Object.keys(s).forEach(function (k) {
    if (k === 'password' || k === 'otpCode') return;
    if (!includeContact && (k === 'phone' || k === 'email')) return;
    o[k] = s[k];
  });
  return o;
}
function publicSettings_(settings) {
  const o = {};
  Object.keys(settings || {}).forEach(function (k) {
    if (/master|password|secret|token|otp/i.test(k)) return;
    if (/^TeacherLeaves$|^EnrollCodes$|^Enrollments$|^PeriodEpisodes$|^StudentDorms$|^StudentLeaves$/.test(k)) return; // ลาสอน / ลงทะเบียนรายวิชา: ไม่เปิดสาธารณะ
    if (/^Timetable/.test(k)) return; // ตารางสอน: อ่านผ่าน getTimetable (มีสิทธิ์และการเปิด/ปิดการมองเห็น)
    o[k] = settings[k];
  });
  return o;
}
function maskEmail_(email) {
  const e = cleanVal(email);
  const at = e.indexOf('@');
  if (at < 1) return e ? '***' : '';
  return e.charAt(0) + '***' + e.substring(at);
}
function publicRegistration_(r, withOtp) {
  const o = Object.assign({}, r);
  if (!withOtp) delete o.otpCode;
  if (o.payload) {
    o.payload = Object.assign({}, o.payload);
    delete o.payload.password;
    delete o.payload.otpCode;
  }
  return o;
}

// =====================================================================
//  🧭 ROUTER + สิทธิ์การใช้งานของแต่ละคำสั่ง
//  public  = ไม่ต้องล็อกอิน | student = นักเรียน(เฉพาะข้อมูลตนเอง)หรือบุคลากร
//  staff   = อาจารย์/ผู้บริหาร/แอดมิน | admin = แอดมินเท่านั้น
// =====================================================================
const ACTION_ACCESS = {
  // public
  ping: 'public', checkSpreadsheet: 'public', getSpreadsheetInfo: 'public',
  loginStudent: 'public', getStudent: 'public', adminLogin: 'public', staffLogin: 'public',
  registerPendingUser: 'public', verifyUserOtp: 'public', checkRegistrationStatus: 'public',
  getActivities: 'public', getCalendarEvents: 'public', getCalendar: 'public', getSettings: 'public',
  whoami: 'public',
  // นักเรียน (เฉพาะข้อมูลของตนเอง) หรือบุคลากร
  getFullDatabase: 'student', getPrayers: 'student', getAttendance: 'student', getHasanat: 'student',
  getSubjectGrades: 'student', getAssignmentScores: 'student', getStatusLogs: 'student', getActivityLogs: 'student', getPrayerApprovals: 'student',
  recordPrayer: 'student', prayerCheckIn: 'student',
  recordHasanat: 'student', saveQuranLog: 'student', saveSunnahLog: 'student', saveSurahMemorizationLog: 'student',
  saveSurahLog: 'student', saveHasanatLog: 'student',
  checkInActivity: 'student', activityCheckIn: 'student',
  updateProfilePhoto: 'student', prayerLateRequest: 'student', getMySubjects: 'student', updateStudentGrade: 'student',
  resetMyHasanat: 'student', submitTeacherEvaluation: 'student', getMyEvaluationStatus: 'student', getEvaluationTargets: 'student',
  getTeacherEvaluationSummary: 'staff',
  // คะแนนพฤติกรรม: ผู้ตรวจการ อาจารย์ และแอดมิน บันทึก/ยกเลิก (ยกเลิกได้เฉพาะรายการของตนเอง ยกเว้นแอดมิน) · แอดมินตั้งค่าหัวข้อ
  addBehaviorLogs: 'inspector', cancelBehaviorLog: 'inspector', getBehaviorData: 'inspector', getMyBehavior: 'student',
  saveBehaviorRules: 'inspector', // แอดมิน + ผู้ตรวจการ (ตรวจสิทธิ์ซ้ำในคำสั่ง)
  // แอดมิน/อาจารย์แก้ไขหรือเพิ่มบันทึกละหมาดของนักเรียน · แอดมินตั้งช่วงเวลาละหมาด
  updatePrayerRecord: 'staff', addPrayerForStudent: 'staff', markPrayersLate: 'staff', getTeacherLeaves: 'staff', saveTeacherLeave: 'staff', takeTeacherLeave: 'staff', deleteTeacherLeave: 'staff', approveTeacherLeave: 'admin', getMyTeaching: 'staff', getHasanatDay: 'admin', saveHasanatBatch: 'admin', getEnrollRoom: 'staff', setEnrollOpen: 'staff', removeEnrollment: 'staff', getEnrollments: 'staff', getMyEnrollments: 'student', enrollSubject: 'student', periodStart: 'student', periodEnd: 'student', periodCancel: 'student', getMyPeriod: 'student', getPeriodEpisodes: 'staff', savePrayerWindows: 'admin',
  // เช็คชื่อละหมาดแทนนักเรียนทั้งห้อง (เช่น ซุบฮิ ที่นักเรียนไม่มีโทรศัพท์)
  getPrayerRoll: 'staff', savePrayerRoll: 'staff', previewAsStudent: 'admin', previewAsStaff: 'admin', setEvalOpen: 'admin', saveGeoZones: 'admin', getPreviewAllowed: 'admin', savePreviewAllowed: 'owner',
  // ตารางสอน: แอดมินสร้าง · อาจารย์และนักเรียนดู (ตามที่แอดมินเปิดการมองเห็น)
  getTimetable: 'student', saveTimetable: 'admin', saveTimetableConfig: 'admin', saveTimetableExtra: 'admin', deleteTimetableExtra: 'admin',
  // บุคลากร
  getAllStudents: 'staff', getSubAdmins: 'staff', getTeachers: 'staff', getPendingRegistrations: 'staff',
  registerStudent: 'staff', updateStudentFull: 'staff', setStudentGenders: 'admin', normalizeStudentNames: 'admin', updateStudentStatus: 'staff',
  deletePrayerRecord: 'staff', recordAttendance: 'staff', saveDailyAttendance: 'staff',
  saveSubjectGrades: 'staff', updateSubjectScores: 'staff',
  createActivity: 'staff', deleteActivity: 'staff', deleteActivityAttendee: 'staff',
  saveCalendarEvent: 'staff', deleteCalendarEvent: 'staff', updatePrayerLateRequestStatus: 'staff', deletePrayerLateRequest: 'staff',
  approveRegistrationAndSendEmail: 'staff', saveSubjectAssignments: 'staff', saveGradeCriteria: 'staff', saveAssignmentScores: 'staff', deletePendingRegistration: 'staff', updateSubAdminPhoto: 'staff',
  // แอดมิน (หลัก + รอง)
  getAdmins: 'admin', addSubAdmin: 'admin', deleteSubAdmin: 'admin', deleteStudent: 'admin',
  batchPromote: 'admin', fullSchoolBatchPromote: 'admin',
  saveSetting: 'admin', saveSubjects: 'admin', saveCurrentTerm: 'admin', saveStudyDocsFolders: 'admin',
  listStudyDocs: 'student', getStudyDocsConfig: 'student', getStudyFile: 'student',
  getMyDream: 'student', saveMyDream: 'student', getDreams: 'staff',
  getHalaqahSessions: 'student', halaqahCheckIn: 'student', getMyHalaqah: 'student',
  saveHalaqahSession: 'staff', deleteHalaqahSession: 'staff', getHalaqahQr: 'staff', getHalaqahRoster: 'staff', markHalaqah: 'staff', deleteHalaqahDay: 'staff', skipHalaqahDay: 'staff',
  getMyNotifications: 'student', getMyClassLeaves: 'student', getMyDorm: 'student', getHalaqahReport: 'admin', requestStudentLeave: 'student', getMyStudentLeaves: 'student', cancelStudentLeave: 'student', getStudentLeaves: 'staff', respondStudentLeave: 'admin', setStudentDorm: 'admin', requestPeriodSwap: 'staff', respondPeriodSwap: 'staff', getPeriodSwaps: 'staff', getMyPortfolio: 'student', addPortfolio: 'staff', deletePortfolio: 'staff', getPortfolioList: 'staff', markNotificationRead: 'student', getPolicy: 'student', acknowledgePolicy: 'student',
  sendNotification: 'admin', listSentNotifications: 'admin', deleteNotification: 'admin', getPolicyAckSummary: 'staff',
  // แอดมินหลักเท่านั้น
  updateLogo: 'owner', batchSync: 'owner',
  init: 'owner', convertToThai: 'owner', organizeSheets: 'owner', organizeGoogleSheets: 'owner'
};

// คำสั่งที่เขียนข้อมูล (ล้างแคชเมื่อสำเร็จ)
const READ_ONLY_ACTIONS = ['ping', 'checkSpreadsheet', 'getSpreadsheetInfo', 'getStudent', 'getActivities',
  'getCalendarEvents', 'getCalendar', 'getSettings', 'whoami', 'getFullDatabase', 'getPrayers', 'getAttendance',
  'getHasanat', 'getTeacherLeaves', 'getSubjectGrades', 'getMyEvaluationStatus', 'getEvaluationTargets', 'getTeacherEvaluationSummary', 'getAssignmentScores', 'getStatusLogs', 'getActivityLogs', 'getPrayerApprovals', 'getAllStudents',
  'getSubAdmins', 'getTeachers', 'getPendingRegistrations', 'getAdmins', 'checkRegistrationStatus',
  'loginStudent', 'adminLogin', 'staffLogin'];

const INSPECTOR_EXTRA_ACTIONS = ['getFullDatabase', 'whoami', 'getMyNotifications', 'markNotificationRead', 'updateSubAdminPhoto'];
READ_ONLY_ACTIONS.push('getPrayerRoll', 'getTimetable', 'getMySubjects', 'getMyTeaching', 'getHasanatDay', 'getEnrollments', 'getMyEnrollments', 'getHalaqahSessions', 'getMyHalaqah', 'getHalaqahQr', 'getHalaqahRoster', 'getStudyFile', 'getMyDream', 'getDreams', 'getBehaviorData', 'getMyBehavior', 'listStudyDocs', 'getStudyDocsConfig', 'getMyNotifications', 'getPolicy', 'listSentNotifications', 'getPolicyAckSummary');

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  if (!params.action) {
    return jsonOut_({
      status: 'online',
      service: 'Khalifah Program API',
      version: SCHEMA_VERSION,
      timestamp: new Date().toISOString()
    });
  }
  return jsonOut_(routeRequest_(params.action, params, 'GET'));
}

function doPost(e) {
  let postData = {};
  if (e && e.postData && e.postData.contents) {
    try {
      postData = JSON.parse(e.postData.contents);
    } catch (jsonErr) {
      postData = (e && e.parameter) || {};
    }
  } else if (e && e.parameter) {
    postData = e.parameter;
  }
  return jsonOut_(routeRequest_(postData.action, postData, 'POST'));
}

function routeRequest_(action, req, method) {
  try {
    action = cleanVal(action);
    const access = ACTION_ACCESS[action];
    if (!access) return { success: false, error: 'Unknown action: ' + action };

    const token = req.token || (req.data && typeof req.data === 'object' ? req.data.token : '') || '';
    const session = verifyToken_(token);
    const isStaff = !!session && (session.role === 'teacher' || session.role === 'admin');
    const isAdmin = !!session && session.role === 'admin';
    const isOwner = !!session && !!session.owner;

    if (access !== 'public') {
      if (!session) {
        return { success: false, authRequired: true, code: 'AUTH_REQUIRED', message: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง (เซสชันหมดอายุหรือไม่ได้เข้าสู่ระบบ)' };
      }
      const isInspector = session.role === 'inspector';
      // ผู้ตรวจการใช้ได้เฉพาะคำสั่งของผู้ตรวจการเท่านั้น
      if (isInspector && access !== 'inspector' && INSPECTOR_EXTRA_ACTIONS.indexOf(action) === -1) {
        return { success: false, forbidden: true, code: 'FORBIDDEN', message: 'บัญชีผู้ตรวจการไม่มีสิทธิ์ใช้งานคำสั่งนี้' };
      }
      if ((access === 'staff' && !isStaff && !(isInspector && INSPECTOR_EXTRA_ACTIONS.indexOf(action) !== -1)) || (access === 'admin' && !isAdmin) || (access === 'owner' && !isOwner) || (access === 'inspector' && !isInspector && !isStaff)) {
        return { success: false, forbidden: true, code: 'FORBIDDEN', message: 'บัญชีของท่านไม่มีสิทธิ์ใช้งานคำสั่งนี้' };
      }
      if (session.limit && !limitAllows_(session.limit, action)) {
        return { success: false, forbidden: true, code: 'FORBIDDEN', message: session.limit === 'act' ? 'บัญชีฝ่ายกิจกรรมใช้ได้เฉพาะดูกิจกรรมและสแกนเช็คชื่อ' : session.limit === 'night' ? 'บัญชีครูเวรหอพักกลางคืนใช้ได้เฉพาะกิจกรรม/QR และบันทึกคะแนนพฤติกรรม' : 'บัญชีผู้บริหารดูข้อมูลได้ · แก้ไขได้เฉพาะตารางสอนและอนุมัติลาสอน' };
      }
    }

    if (session) prayerPenaltyMaybe_(); // v18.29 · หักคะแนนไม่เช็คละหมาด (ทำงานไม่เกินทุก 10 นาที)
    // โหมดดูตัวอย่าง (แอดมินดูแอปแบบนักเรียน): ห้ามเขียนข้อมูลใด ๆ
    if (session && session.preview && READ_ONLY_ACTIONS.indexOf(action) === -1 && ['whoami', 'refreshToken'].indexOf(action) === -1 && !/^get[A-Z]/.test(action)) { // v18.03 · อ่านได้ทุกคำสั่ง get*
      return { success: false, preview: true, code: 'PREVIEW', message: 'โหมดดูตัวอย่าง · ไม่ได้บันทึกจริง' };
    }
    stripMarkup_(req, 0);
    const data = (req.data && typeof req.data === 'object') ? req.data : req;
    if (data && data.token) delete data.token;

    const result = dispatchAction_(action, req, data, session, { isStaff: isStaff, isAdmin: isAdmin && !(session && session.limit), isOwner: isOwner, method: method });
    if (result && result.success !== false && READ_ONLY_ACTIONS.indexOf(action) === -1) {
      bumpDataVersion_();
    }
    return result;
  } catch (error) {
    Logger.log('routeRequest_ error [' + action + ']: ' + (error && error.stack ? error.stack : error));
    return { success: false, error: String(error && error.message ? error.message : error) };
  }
}

/** กัน XSS: ตัดเครื่องหมาย < > ออกจากข้อความทุกช่องที่ส่งเข้ามา (ยกเว้นรหัสผ่าน) ก่อนบันทึกลงชีต */
const MARKUP_SKIP_KEYS_ = { password: 1, newPassword: 1, oldPassword: 1, token: 1 };
function stripMarkup_(obj, depth) {
  if (!obj || typeof obj !== 'object' || depth > 6) return;
  Object.keys(obj).forEach(function (k) {
    const v = obj[k];
    if (typeof v === 'string') { if (!MARKUP_SKIP_KEYS_[k] && /[<>]/.test(v)) obj[k] = v.replace(/[<>]/g, ''); }
    else if (v && typeof v === 'object') stripMarkup_(v, depth + 1);
  });
}

/** สำหรับนักเรียน: บังคับให้ใช้รหัสของตนเองเสมอ */
function ownStudentId_(session, ctx, requested) {
  if (session && session.role === 'student') return session.userId;
  return cleanVal(requested || '');
}

function dispatchAction_(action, req, data, session, ctx) {
  const isStudent = !!session && session.role === 'student';
  const pick = function (k) { return (req[k] !== undefined && req[k] !== null && req[k] !== '') ? req[k] : (data ? data[k] : undefined); };

  switch (action) {
    case 'ping':
    case 'checkSpreadsheet':
    case 'getSpreadsheetInfo': {
      const out = { success: true, status: 'online', version: SCHEMA_VERSION, codeVersion: CODE_VERSION, dataVersion: getDataVersion_() };
      if (ctx.isAdmin) {
        const ss = getSpreadsheet();
        out.spreadsheetName = ss ? ss.getName() : 'none';
        out.sheets = ss ? ss.getSheets().map(function (s) { return s.getName(); }) : [];
      }
      return out;
    }
    case 'whoami':
      // ต่ออายุโทเค็นทุกครั้งที่แอปเปิด เพื่อให้อยู่ในระบบได้ต่อเนื่องจนกว่าจะออกจากระบบเอง
      return session ? { success: true, session: { role: session.role, userId: session.userId, name: session.name, owner: !!session.owner }, token: issueToken_(session.role, session.userId, session.name, !!session.owner, !!session.preview, session.limit || ''), preview: !!session.preview, limit: session.limit || '' } : { success: false, authRequired: true, code: 'AUTH_REQUIRED' };

    // ---------- เข้าสู่ระบบ ----------
    case 'loginStudent':
      return loginStudent(pick('studentId'), pick('parentPhone') || pick('birthDate') || pick('password'));
    case 'getStudent': {
      if (ctx.isStaff) return getStudentForStaff_(pick('studentId'));
      if (isStudent && !pick('parentPhone')) return getStudentForStaff_(session.userId);
      return loginStudent(pick('studentId'), pick('parentPhone'));
    }
    case 'adminLogin':
    case 'staffLogin':
      return verifyAdminLogin(pick('password'), pick('username'));

    // ---------- สมัครสมาชิก / OTP ----------
    case 'registerPendingUser':
      return registerPendingUser(data, ctx.isStaff);
    case 'verifyUserOtp':
      return verifyUserOtp(data);
    case 'checkRegistrationStatus': {
      const r = checkRegistrationStatus(pick('userId'), pick('role'));
      if (r && r.registration) {
        r.registration = publicRegistration_(r.registration, ctx.isAdmin);
        if (!ctx.isStaff) {
          delete r.registration.payload;
          r.registration.email = maskEmail_(r.registration.email);
        }
      }
      if (r && !ctx.isAdmin) delete r.otpCode;
      return r;
    }
    case 'getPendingRegistrations': {
      const r = getPendingRegistrations();
      r.data = (r.data || []).map(function (x) { return publicRegistration_(x, ctx.isAdmin); });
      return r;
    }
    case 'approveRegistrationAndSendEmail': {
      const r = approveRegistrationAndSendEmail(data);
      if (!ctx.isAdmin) delete r.otpCode;
      return r;
    }
    case 'deletePendingRegistration':
      return deletePendingRegistration(data);

    // ---------- อ่านข้อมูลรวม ----------
    case 'getFullDatabase':
      return getFullDatabaseForSession_(session);
    case 'getSettings': {
      const r = getSettings();
      r.data = publicSettings_(r.data);
      return r;
    }
    case 'getActivities':
      return getActivities();
    case 'getCalendarEvents':
    case 'getCalendar':
      return getCalendarEvents(ctx.isStaff ? 'staff' : 'student');
    case 'getAllStudents':
      return getAllStudents();
    case 'getTeachers': {
      const r = getTeachers();
      r.data = (r.data || []).map(function (t) { return publicStaff_(t, true); });
      return r;
    }
    case 'getAdmins': {
      const r = getAdmins();
      r.data = (r.data || []).map(function (t) { return publicStaff_(t, true); });
      return r;
    }
    case 'getSubAdmins': {
      const r = getSubAdmins();
      r.data = (r.data || []).map(function (t) { return publicStaff_(t, true); });
      return r;
    }
    case 'getPrayers':
      return getPrayers(ownStudentId_(session, ctx, pick('studentId')), pick('date'));
    case 'getAttendance':
      return getAttendance(ownStudentId_(session, ctx, pick('studentId')), isStudent ? '' : pick('grade'));
    case 'getHasanat': {
      const r = getHasanat(ownStudentId_(session, ctx, pick('studentId')));
      if (isStudent) {
        const own = {};
        if (r.byStudent && r.byStudent[session.userId]) own[session.userId] = r.byStudent[session.userId];
        r.byStudent = own;
      }
      return r;
    }
    case 'getSubjectGrades':
      return getSubjectGrades(ownStudentId_(session, ctx, pick('studentId')), pick('subject'));
    case 'getStatusLogs':
      return getStatusLogs(ownStudentId_(session, ctx, pick('studentId')));
    case 'getAssignmentScores':
      return getAssignmentScores(ownStudentId_(session, ctx, pick('studentId')), pick('subjectId'));
    case 'saveSubjectAssignments':
      return saveSubjectAssignments(data);
    case 'saveGradeCriteria':
      return saveGradeCriteria(data);
    case 'addBehaviorLogs':
      return addBehaviorLogs_(data, session);
    case 'cancelBehaviorLog':
      return cancelBehaviorLog_(pick('logId'), session, ctx.isAdmin);
    case 'getBehaviorData':
      return { success: true, photoMax: 4, codeVersion: CODE_VERSION, rules: getBehaviorRules_(), logs: getBehaviorLogs_(), term: currentTerm_(),
        students: (getAllStudents().data || []).map(function (x) { return { studentId: x.studentId, fullName: x.fullName, grade: x.grade, status: x.status }; }) };
    case 'getMyBehavior': {
      const me = ownStudentId_(session, ctx, pick('studentId'));
      if (!me) return { success: false, message: 'ไม่พบรหัสนักเรียน' };
      return { success: true, term: currentTerm_(), rules: getBehaviorRules_(), logs: getBehaviorLogs_().filter(function (x) { return isCodeMatch(x.studentId, me); }) };
    }
    case 'getHalaqahSessions': {
      const L = halaqahSessions_(isStudent ? studentGradeNum_(session.userId).grade : '', !isStudent, isStudent ? session.userId : '');
      return { success: true, sessions: isStudent || session.role === 'admin' ? L : L.filter(function (h) { return hqIsOwner_(h, session); }), today: hqToday_(), mine: session.role !== 'admin' };
    }
    case 'saveHalaqahSession':
      return saveHalaqahSession_(data, session);
    case 'deleteHalaqahSession':
      return hqOwnCheck_(pick('id'), session) || deleteHalaqahSession_(pick('id'));
    case 'getHalaqahQr':
      return hqOwnCheck_(pick('id'), session) || getHalaqahQr_(pick('id'), pick('date'));
    case 'halaqahCheckIn':
      if (!isStudent) return { success: false, message: 'สแกนเข้าหะละเกาะฮฺได้เฉพาะบัญชีนักเรียน' };
      return halaqahCheckIn_(session, pick('qr'));
    case 'getMyHalaqah':
      return getMyHalaqah_(ownStudentId_(session, ctx, pick('studentId')));
    case 'getHalaqahRoster':
      return hqOwnCheck_(pick('id'), session) || getHalaqahRoster_(pick('id'), pick('date'));
    case 'markHalaqah':
      return hqOwnCheck_((data || {}).id, session) || markHalaqah_(data, session);
    case 'skipHalaqahDay':
      return hqOwnCheck_(pick('id'), session) || skipHalaqahDay_(pick('id'), pick('date'), pick('undo'));
    case 'deleteHalaqahDay':
      return hqOwnCheck_(pick('id'), session) || deleteHalaqahDay_(pick('id'), pick('date'));
    case 'getMyDream':
      return { success: true, dream: getDreamOf_(ownStudentId_(session, ctx, pick('studentId'))) };
    case 'saveMyDream':
      if (!isStudent) return { success: false, message: 'สำหรับนักเรียนเท่านั้น' };
      return saveMyDream_(session.userId, data);
    case 'getDreams':
      return { success: true, data: sheetRows_(SHEETS.DREAMS, 7).filter(function (r) { return cleanVal(r[0]) && cleanVal(r[3]); }).map(function (r) { return { studentId: cleanVal(r[0]), fullName: cleanVal(r[1]), grade: cleanVal(r[2]), dream: cleanVal(r[3]), icon: cleanVal(r[4]), reason: cleanVal(r[5]), updatedAt: cleanVal(r[6]) }; }) };
    case 'getMyNotifications':
      return getMyNotifications_(session);
    case 'markNotificationRead':
      return markNotificationRead_(session, data.ids || [pick('id')], !!(data.hide || pick('hide')));
    case 'getPolicy':
      return getPolicyForSession_(session, pick('policyId'));
    case 'acknowledgePolicy':
      if (!isStudent) return { success: false, message: 'สำหรับนักเรียนเท่านั้น' };
      return acknowledgePolicy_(session, pick('policyId'), pick('version'));
    case 'sendNotification':
      return sendNotification_(data, session);
    case 'listSentNotifications':
      return listSentNotifications_();
    case 'deleteNotification':
      return deleteNotification_(pick('id'));
    case 'getPolicyAckSummary':
      return getPolicyAckSummary_(pick('policyId'));
    case 'getStudyFile':
      return getStudyFile_(pick('fileId'), pick('asPdf'));
    case 'listStudyDocs':
      return listStudyDocs_(pick('grade'), pick('folderId'), pick('refresh'));
    case 'getStudyDocsConfig':
      return { success: true, folders: getStudyDocsFolders_() };
    case 'saveStudyDocsFolders':
      return saveStudyDocsFolders_(data.folders);
    case 'saveCurrentTerm':
      return saveCurrentTerm_(data);
    case 'saveBehaviorRules':
      if (!ctx.isAdmin && !(session && session.role === 'inspector')) return { success: false, forbidden: true, code: 'FORBIDDEN', message: 'แก้ไขหัวข้อได้เฉพาะแอดมินและผู้ตรวจการ' };
      return saveBehaviorRules_(data.rules);
    case 'resetMyHasanat':
      if (!isStudent) return { success: false, message: 'สำหรับนักเรียนเท่านั้น' };
      return resetMyHasanat_(session.userId);
    case 'setEvalOpen': {
      const on = !!(data && (data.open === true || data.open === '1' || data.open === 1));
      saveSetting({ key: 'EvalOpen', value: on ? '1' : '0', description: 'เปิดให้นักเรียนประเมินอาจารย์ (1=เปิด 0=ปิด)' });
      return { success: true, open: on, message: on ? 'เปิดให้นักเรียนประเมินอาจารย์แล้ว' : 'ปิดการประเมินอาจารย์แล้ว' };
    }
    case 'getEvaluationTargets':
      return getEvaluationTargets_();
    case 'getMyEvaluationStatus':
      if (!isStudent) return { success: false, message: 'สำหรับนักเรียนเท่านั้น' };
      return getMyEvaluationStatus_(session.userId, pick('term'));
    case 'submitTeacherEvaluation':
      if (!isStudent) return { success: false, message: 'สำหรับนักเรียนเท่านั้น' };
      return submitTeacherEvaluation_(session.userId, data);
    case 'getTeacherEvaluationSummary':
      return getTeacherEvaluationSummary_(session, ctx, pick('term'));
    case 'saveAssignmentScores':
      if (!data.teacherId) data.teacherId = session.name || session.userId;
      return saveAssignmentScores(data);
    case 'getActivityLogs': {
      const r = getActivityLogs(pick('activityId'));
      if (isStudent) r.data = (r.data || []).filter(function (x) { return isCodeMatch(x.studentId, session.userId); });
      return r;
    }
    case 'getPrayerApprovals': {
      const r = getPrayerApprovals();
      if (isStudent) r.data = (r.data || []).filter(function (x) { return isCodeMatch(x.studentId, session.userId); });
      return r;
    }

    // ---------- นักเรียนบันทึกข้อมูลของตนเอง ----------
    case 'recordPrayer':
    case 'prayerCheckIn':
      if (isStudent && isWeeklyHoliday_()) return { success: false, holiday: true, message: 'วันเสาร์เป็นวันหยุดประจำสัปดาห์ · งดเช็คชื่อละหมาด' };
      if (isStudent) data.studentId = session.userId;
      return recordPrayer(data);
    case 'recordHasanat':
    case 'saveQuranLog':
    case 'saveSunnahLog':
    case 'saveSurahMemorizationLog':
    case 'saveSurahLog':
    case 'saveHasanatLog':
      // v18.55 · นักเรียนบันทึกผลบุญของตัวเองได้ (บังคับเป็นรหัสของตัวเอง) · แอดมินบันทึกแทนได้เหมือนเดิม
      if (isStudent) {
        data = Object.assign({}, data || {}, { studentId: session.userId });
        // v18.56 · นักเรียนบันทึกย้อนหลังได้ไม่เกิน 7 วัน และบันทึกล่วงหน้าไม่ได้
        const tdy = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'), min7 = Utilities.formatDate(new Date(Date.now() - 7 * 864e5), 'Asia/Bangkok', 'yyyy-MM-dd');
        const dd = formatSheetDate(data.date) || tdy;
        if (dd > tdy) return { success: false, message: 'บันทึกล่วงหน้าไม่ได้' };
        if (dd < min7) return { success: false, message: 'บันทึกย้อนหลังได้ไม่เกิน 7 วัน · ถ้าจำเป็นให้แจ้งแอดมิน' };
      }
      return recordHasanat(data, isStudent ? 'นักเรียน' : ('แอดมิน' + (session && session.name ? ' · ' + session.name : '')));
    case 'checkInActivity':
    case 'activityCheckIn':
      if (isStudent) {
        data.studentId = session.userId;
        // v17.36 · กิจกรรมเฉพาะชั้นปี/รายบุคคล: นักเรียนนอกกลุ่มเช็คชื่อไม่ได้
        const gate = activityAudienceAllows_(data.activityId || '', data.activityTitle || data.title || '', session.userId);
        if (!gate.ok) return { success: false, code: 'NOT_IN_AUDIENCE', message: gate.message };
      }
      return checkInActivity(data);
    case 'updateProfilePhoto':
      return updateStudentProfilePhoto(ownStudentId_(session, ctx, pick('studentId')), pick('avatarUrl') || pick('profilePhoto') || pick('photo'));
    case 'prayerLateRequest':
      if (isStudent && /ประจำเดือน|อุซุร/.test(cleanVal(data.reasonPreset) + ' ' + cleanVal(data.reasonDetail)) && !periodIsGirl_((getStudentForStaff_(session.userId) || {}).student)) {
        return { success: false, code: 'GIRLS_ONLY', message: 'เหตุผล "มีประจำเดือน" ใช้ได้เฉพาะนักเรียนหญิง' };
      }
      if (isStudent) {
        data.studentId = session.userId;
        data.status = 'pending';
        data.approvedBy = '';
        data.approvedAt = '';
      }
      return savePrayerLateRequest(data);
    case 'updateStudentGrade':
      return updateStudentGrade(ownStudentId_(session, ctx, pick('studentId')), pick('newGrade') || pick('grade'), isStudent);

    // ---------- บุคลากร ----------
    case 'registerStudent':
      if (data && data.createOnly) {
        const ex = getStudentForStaff_(data.studentId);
        if (ex && ex.success) return { success: false, duplicate: true, field: 'studentId', message: 'มีรหัสนักเรียน ' + cleanVal(data.studentId) + ' ในระบบแล้ว' };
      }
      return registerStudent(data);
    case 'updateStudentFull':
      return updateStudentFull(data);
    case 'setStudentGenders':
      return setStudentGenders_(data.items || []);
    case 'normalizeStudentNames':
      return normalizeStudentNames_();
    case 'updateStudentStatus':
      if (!data.adminUser) data.adminUser = session.name || session.userId;
      return updateStudentStatus(data);
    case 'deletePrayerRecord':
      return deletePrayerRecord(data);
    case 'updatePrayerRecord':
      return updatePrayerRecord_(data, session);
    case 'markPrayersLate':
      return markPrayersLate_(data);
    case 'getTeacherLeaves':
      return { success: true, data: readLeaves_() };
    case 'getMyPortfolio':
      return myPortfolio_(isStudent ? session.userId : (pick('studentId') || session.userId));
    case 'addPortfolio':
      return addPortfolio_(data, session);
    case 'deletePortfolio':
      return deletePortfolio_(pick('id'), session);
    case 'getPortfolioList':
      return { success: true, data: pfRows_().filter(function (x) { return session.role === 'admin' || x.by === session.userId || !!pick('all'); }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 300) };
    case 'requestPeriodSwap':
      return requestPeriodSwap_(data, session);
    case 'respondPeriodSwap':
      return respondPeriodSwap_(data, session);
    case 'getPeriodSwaps':
      return { success: true, data: swapsFor_(session) };
    case 'requestStudentLeave':
      if (!isStudent) return { success: false, message: 'สำหรับนักเรียนเท่านั้น' };
      return requestStudentLeave_(data, session);
    case 'getMyStudentLeaves': {
      const me = slKey_(session.userId);
      return { success: true, data: readStuLeaves_().filter(function (x) { return slKey_(x.sid) === me; }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 60) };
    }
    case 'cancelStudentLeave':
      return cancelStudentLeave_(pick('id'), session);
    case 'getStudentLeaves': {
      const L = readStuLeaves_();
      if (session.role === 'admin' && !session.limit) return { success: true, data: L.slice().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }) };
      return { success: true, data: L.filter(function (x) { return x.status === 'approved'; }).map(function (x) { return { id: x.id, sid: x.sid, name: x.name, grade: x.grade, from: x.from, to: x.to, allDay: x.allDay, tFrom: x.tFrom, tTo: x.tTo, type: x.type, where: x.where, reason: x.reason }; }) };
    }
    case 'respondStudentLeave':
      return respondStudentLeave_(data, session);
    case 'getHalaqahReport':
      return halaqahReport_(pick('from'), pick('to'));
    case 'getMyDorm': {
      const dm = readDorms_();
      if (!isStudent) return { success: true, data: dm };
      return { success: true, dorm: dm[dormKey_(session.userId)] || '' };
    }
    case 'setStudentDorm':
      return setStudentDorm_(data);
    case 'getMyClassLeaves':
      return { success: true, data: isStudent ? myClassLeaves_(session.userId) : [] };
    case 'saveTeacherLeave':
      return saveTeacherLeave_(data, session, !!session && session.role === 'admin');
    case 'takeTeacherLeave':
      return takeTeacherLeave_(data, session);
    case 'getEnrollRoom':
      return getEnrollRoom_(data, session);
    case 'setEnrollOpen':
      return setEnrollOpen_(data);
    case 'removeEnrollment':
      return removeEnrollment_(data);
    case 'getEnrollments':
      return { success: true, data: enrollIdsBySubject_() };
    // v17.39 · ประจำเดือน: นักเรียนหญิงแจ้งวันเริ่ม → กดสิ้นสุด → ระบบบันทึกอุซุรย้อนหลังครบทุกเวลา
    case 'periodStart':
    case 'periodEnd':
    case 'periodCancel':
    case 'getMyPeriod':
      if (!isStudent) return { success: false, message: 'สำหรับนักเรียนเท่านั้น' };
      return periodAction_(action, data || {}, session);
    case 'getPeriodEpisodes':
      return { success: true, data: periodList_().slice(-200).reverse() };
    case 'getMyEnrollments':
      if (!isStudent) return { success: false, message: 'สำหรับนักเรียนเท่านั้น' };
      return getMyEnrollments_(session.userId);
    case 'enrollSubject':
      if (!isStudent) return { success: false, message: 'สำหรับนักเรียนเท่านั้น' };
      return enrollSubject_(data, session.userId);
    case 'getHasanatDay':
      return getHasanatDay_(pick('date') || data.date);
    case 'saveHasanatBatch':
      return saveHasanatBatch_(data);
    case 'getMyTeaching':
      return getMyTeaching_(session);
    case 'approveTeacherLeave':
      return approveTeacherLeave_(data, session);
    case 'deleteTeacherLeave':
      return deleteTeacherLeave_(data, session, !!session && session.role === 'admin');
    case 'addPrayerForStudent':
      if (/ประจำเดือน/.test(cleanVal(data.status)) && !periodIsGirl_((getStudentForStaff_(data.studentId) || {}).student)) return { success: false, code: 'GIRLS_ONLY', message: 'สถานะ "มีประจำเดือน" ใช้ได้เฉพาะนักเรียนหญิง' };
      return addPrayerForStudent_(data, session);
    case 'savePrayerWindows':
      return savePrayerWindows_(data.windows);
    case 'getTimetable':
      return getTimetable_(session, isStudent, ctx.isAdmin || (session && session.limit === 'exec'));
    case 'getMySubjects':
      return getMySubjects_(isStudent ? session.userId : (data.studentId || ''));
    case 'saveGeoZones': {
      const zs = (Array.isArray((data || {}).zones) ? data.zones : []).slice(0, 20);
      const out = [];
      for (let i = 0; i < zs.length; i++) {
        const z = zs[i] || {}; const lat = Number(z.lat), lng = Number(z.lng), r = Math.round(Number(z.radius));
        const name = cleanVal(z.name).slice(0, 80);
        if (!name) return { success: false, message: 'จุดที่ ' + (i + 1) + ': ตั้งชื่อจุดก่อน' };
        if (!isFinite(lat) || lat < -90 || lat > 90 || !isFinite(lng) || lng < -180 || lng > 180) return { success: false, message: '"' + name + '": ละติจูด/ลองจิจูดไม่ถูกต้อง' };
        if (!isFinite(r) || r < 5 || r > 2000) return { success: false, message: '"' + name + '": รัศมีต้องอยู่ระหว่าง 5–2000 เมตร' };
        out.push({ name: name, lat: Math.round(lat * 1e7) / 1e7, lng: Math.round(lng * 1e7) / 1e7, radius: r, main: !!z.main });
      }
      if (!out.length) return { success: false, message: 'ต้องมีอย่างน้อย 1 จุด' };
      if (!out.some(function (z) { return z.main; })) out[0].main = true;
      saveSetting({ key: 'GeoZones', value: JSON.stringify(out), description: 'จุดพิกัดเช็คชื่อละหมาด: ชื่อ ละติจูด ลองจิจูด รัศมี (JSON)' });
      return { success: true, zones: out, message: 'บันทึกจุดพิกัดแล้ว · นักเรียนจะใช้จุดใหม่ทันที' };
    }
    case 'getPreviewAllowed': {
      let l = []; try { l = JSON.parse((getSettings().data || {}).PreviewAllowedAdmins || '[]') || []; } catch (e) {}
      return { success: true, list: l, owner: !!ctx.isOwner, canPreview: !!ctx.isOwner || l.indexOf(String(session.userId).toLowerCase()) !== -1 };
    }
    case 'savePreviewAllowed': {
      const l = (Array.isArray((data || {}).list) ? data.list : []).map(function (x) { return cleanVal(x).toLowerCase(); }).filter(Boolean).slice(0, 50);
      saveSetting({ key: 'PreviewAllowedAdmins', value: JSON.stringify(l), description: 'แอดมินที่ได้สิทธิ์ดูแอปในมุมมองนักเรียน (JSON)' });
      return { success: true, list: l, message: 'บันทึกสิทธิ์แล้ว' };
    }
    case 'previewAsStaff': {
      // v18.03 · แอดมินดูแอปในมุมมองอาจารย์/บุคลากร (อ่านอย่างเดียว) · สิทธิ์เดียวกับดูมุมมองนักเรียน
      if (!ctx.isOwner) { let l = []; try { l = JSON.parse((getSettings().data || {}).PreviewAllowedAdmins || '[]') || []; } catch (e) {} if (l.indexOf(String(session.userId).toLowerCase()) === -1) return { success: false, code: 'FORBIDDEN', message: 'เฉพาะแอดมินสูงสุด หรือแอดมินที่ได้รับสิทธิ์เท่านั้น' }; }
      return previewAsStaff_(cleanVal((data || {}).username));
    }
    case 'previewAsStudent': {
      // เฉพาะแอดมินสูงสุด หรือแอดมินที่แอดมินสูงสุดให้สิทธิ์
      if (!ctx.isOwner) { let l = []; try { l = JSON.parse((getSettings().data || {}).PreviewAllowedAdmins || '[]') || []; } catch (e) {} if (l.indexOf(String(session.userId).toLowerCase()) === -1) return { success: false, code: 'FORBIDDEN', message: 'เฉพาะแอดมินสูงสุด หรือแอดมินที่ได้รับสิทธิ์เท่านั้น' }; }
      const sid = cleanVal((data || {}).studentId);
      if (!sid || sid === 'DEMO') { // นักเรียนตัวอย่าง (ไม่ต้องเลือกนักเรียนจริง)
        const g = String(cleanVal((data || {}).grade) || '1').replace(/\D/g, '') || '1';
        const demo = { studentId: 'DEMO', fullName: 'นักเรียนตัวอย่าง', grade: 'มัธยมศึกษาปีที่ ' + g, schoolName: 'โหมดดูตัวอย่าง', status: 'ปกติ (กำลังศึกษา)', approvalStatus: 'Verified', parentPhone: '', birthDate: '', avatarUrl: '', email: '', gpax: 0 };
        return { success: true, token: issueToken_('student', 'DEMO', demo.fullName, false, true), student: demo, preview: true };
      }
      const ss = getSpreadsheet(); const sh = ss.getSheetByName(SHEETS.STUDENTS);
      const rows = sh ? sh.getDataRange().getValues() : [];
      for (let i = 1; i < rows.length; i++) {
        if (!isCodeMatch(rows[i][0], sid)) continue;
        const st = buildStudentObjectFromRow(rows[i], getLatestHasanatMapByStudent(ss), getLatestGradesMapByStudent(ss));
        return { success: true, token: issueToken_('student', st.studentId, st.fullName, false, true), student: st, preview: true };
      }
      return { success: false, message: 'ไม่พบนักเรียนรหัสนี้' };
    }
    case 'getPrayerRoll':
      return getPrayerRoll_(data || req);
    case 'savePrayerRoll':
      return savePrayerRoll_(data, session);
    case 'saveTimetable':
      return saveTimetable_(data, session);
    case 'saveTimetableExtra':
      return saveTimetableExtra_(data, session);
    case 'deleteTimetableExtra':
      return deleteTimetableExtra_(data);
    case 'saveTimetableConfig':
      return saveTimetableConfig_(data);
    case 'recordAttendance':
      return recordAttendance(data);
    case 'saveDailyAttendance':
      return saveDailyAttendance(data);
    case 'saveSubjectGrades':
      return saveSubjectGrades(data);
    case 'updateSubjectScores':
      return updateSubjectScores(data);
    case 'createActivity':
      return createActivity(data, session);
    case 'deleteActivity':
      return deleteActivity(pick('activityId') || pick('id'));
    case 'deleteActivityAttendee':
      return deleteActivityAttendee(data);
    case 'saveCalendarEvent':
      return saveCalendarEvent(data);
    case 'deleteCalendarEvent':
      return deleteCalendarEvent(data);
    case 'deletePrayerLateRequest':
      return deletePrayerLateRequest_(data);
    case 'updatePrayerLateRequestStatus':
      return updatePrayerLateRequestStatus(data);
    case 'updateSubAdminPhoto': {
      // อาจารย์แก้ได้เฉพาะรูปของตนเอง แอดมินแก้ได้ทุกคน
      const uname = ctx.isAdmin ? (pick('username') || session.userId) : session.userId;
      return updateSubAdminPhoto(uname, pick('photo') || pick('avatarUrl'));
    }

    // ---------- แอดมิน ----------
    case 'addSubAdmin':
      if (!ctx.isOwner && (isAdminRole_(data.role) || isAdminStaff_(data.username))) return { success: false, code: 'FORBIDDEN', message: 'เฉพาะแอดมินหลักเท่านั้นที่สร้างหรือแก้ไขบัญชีแอดมินได้' };
      return addSubAdmin(data);
    case 'deleteSubAdmin':
      if (!ctx.isOwner && isAdminStaff_(pick('username'))) return { success: false, code: 'FORBIDDEN', message: 'เฉพาะแอดมินหลักเท่านั้นที่ลบบัญชีแอดมินได้' };
      return deleteSubAdmin(pick('username'));
    case 'deleteStudent':
      return deleteStudent(pick('studentId'));
    case 'batchPromote':
      return batchPromoteStudents(pick('fromGrade'), pick('toGrade'));
    case 'fullSchoolBatchPromote':
      return fullSchoolBatchPromote(session.name || session.userId);
    case 'updateLogo':
      return updateAppLogo(pick('logoBase64'));
    case 'saveSetting':
      if (/master|password|secret|token/i.test(String(data.key || ''))) {
        return { success: false, message: 'ไม่อนุญาตให้บันทึกค่านี้ผ่านเว็บ' };
      }
      return saveSetting(data);
    case 'saveSubjects':
      return saveSubjects(data);
    case 'batchSync':
      return batchSyncData(data);
    case 'init':
    case 'convertToThai':
    case 'organizeSheets':
    case 'organizeGoogleSheets': {
      const r = initializeSheets();
      setProp_('SCHEMA_VERSION', SCHEMA_VERSION);
      return r;
    }
  }
  return { success: false, error: 'Unhandled action: ' + action };
}

/**
 * ดึงฐานข้อมูลรวมตามสิทธิ์ของผู้ใช้
 * - บุคลากร: ทุกตาราง (ไม่มีรหัสผ่าน; OTP เห็นเฉพาะแอดมิน)
 * - นักเรียน: เฉพาะข้อมูลของตนเอง + กิจกรรม/ปฏิทินสาธารณะ
 */
function getFullDatabaseForSession_(session) {
  const ver = getDataVersion_();
  const cacheKey = 'FULLDB_' + ver;
  let db = cacheGetJson_(cacheKey);
  if (!db) {
    db = buildFullDatabaseRaw_();
    cachePutJson_(cacheKey, db, FULL_DB_CACHE_SECONDS);
  }
  return scopeDatabase_(db, session);
}

function buildFullDatabaseRaw_() {
  ensureSchema();
  __ROWS_MEMO = {};
  try {
    const teachers = (getTeachers().data || []).map(function (t) { return publicStaff_(t, true); });
    const admins = (getAdmins().data || []).map(function (t) { return publicStaff_(t, true); });
    const subAdmins = (getSubAdmins().data || []).map(function (t) { return publicStaff_(t, true); });
    return {
      success: true,
      timestamp: new Date().toISOString(),
      students: getAllStudents().data || [],
      teachers: teachers,
      admins: admins,
      subAdmins: subAdmins,
      statusLogs: getStatusLogs().data || [],
      pendingRegistrations: getPendingRegistrations().data || [],
      activities: getActivities().data || [],
      activityLogs: getActivityLogs().data || [],
      prayers: getPrayers().data || [],
      behaviorLogs: getBehaviorLogs_(),
      behaviorRules: getBehaviorRules_(),
      attendance: getAttendance().data || [],
      hasanat: getHasanat().data || [],
      subjectGrades: getSubjectGrades().data || [],
      assignmentScores: getAssignmentScores().data || [],
      calendarEvents: getCalendarEvents('staff').data || [],
      prayerApprovals: getPrayerApprovals().data || [],
      settings: publicSettings_(getSettings().data || {})
    };
  } finally {
    __ROWS_MEMO = null;
  }
}

function scopeDatabase_(db, session) {
  const role = session.limit ? 'teacher' : session.role; // บัญชีสิทธิ์จำกัด: ไม่เห็นรหัส OTP/ข้อมูลลับของแอดมิน
  if (role === 'admin') return db;
  if (role === 'inspector') {
    return {
      success: true, scope: 'inspector', timestamp: db.timestamp,
      students: (db.students || []).map(function (x) { return { studentId: x.studentId, fullName: x.fullName, grade: x.grade, status: x.status, avatarUrl: x.avatarUrl || '' }; }),
      behaviorLogs: db.behaviorLogs || [], behaviorRules: db.behaviorRules || getBehaviorRules_(),
      teachers: [], admins: [], subAdmins: [], pendingRegistrations: [], statusLogs: [], activities: [], activityLogs: [],
      prayers: [], attendance: [], hasanat: [], subjectGrades: [], assignmentScores: [], prayerApprovals: [],
      calendarEvents: (db.calendarEvents || []).filter(function (ev) { return ev.targetAudience !== 'teachers'; }),
      settings: db.settings || {}
    };
  }
  if (role === 'teacher') {
    const out = Object.assign({}, db);
    out.pendingRegistrations = (db.pendingRegistrations || []).map(function (x) { return publicRegistration_(x, false); });
    out.admins = (db.admins || []).map(function (a) { return publicStaff_(a, false); });
    return out;
  }
  // student
  const sid = session.userId;
  const mine = function (x) { return x && isCodeMatch(x.studentId, sid); };
  return {
    success: true,
    scope: 'student',
    timestamp: db.timestamp,
    students: (db.students || []).filter(mine),
    teachers: (db.teachers || []).map(function (t) {
      return { username: t.username, fullName: t.fullName, role: t.role, assignedSubjects: t.assignedSubjects, avatarUrl: t.avatarUrl || '' };
    }),
    admins: [],
    subAdmins: [],
    statusLogs: (db.statusLogs || []).filter(mine),
    pendingRegistrations: [],
    activities: db.activities || [],
    activityLogs: (db.activityLogs || []).filter(mine),
    prayers: (db.prayers || []).filter(mine),
    behaviorLogs: (db.behaviorLogs || []).filter(mine),
    behaviorRules: db.behaviorRules || [],
    attendance: (db.attendance || []).filter(mine),
    hasanat: (db.hasanat || []).filter(mine),
    subjectGrades: (db.subjectGrades || []).filter(mine),
    assignmentScores: (db.assignmentScores || []).filter(mine),
    calendarEvents: (db.calendarEvents || []).filter(function (ev) { return ev.targetAudience !== 'teachers'; }),
    prayerApprovals: (db.prayerApprovals || []).filter(mine),
    settings: db.settings || {}
  };
}

function getStudentForStaff_(studentId) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานนักเรียน' };
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (isCodeMatch(rows[i][0], studentId)) {
      return { success: true, student: buildStudentObjectFromRow(rows[i], getLatestHasanatMapByStudent(ss), getLatestGradesMapByStudent(ss)) };
    }
  }
  return { success: false, message: 'ไม่พบข้อมูลนักเรียนในฐานข้อมูล' };
}

/** เลื่อนชั้นทั้งโรงเรียน ม.1-ม.5 ขึ้น 1 ระดับ และ ม.6 สำเร็จการศึกษา (ทำงานฝั่งเซิร์ฟเวอร์ในครั้งเดียว) */
function fullSchoolBatchPromote(adminName) {
  ensureSchema();
  const lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) {}
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS.STUDENTS);
    if (!sheet || sheet.getLastRow() < 2) return { success: true, message: 'ไม่มีนักเรียนในระบบ', count: 0 };
    const n = sheet.getLastRow() - 1;
    const rng = sheet.getRange(2, 1, n, 16);
    const rows = rng.getValues();
    const next = {
      'มัธยมศึกษาปีที่ 1': 'มัธยมศึกษาปีที่ 2',
      'มัธยมศึกษาปีที่ 2': 'มัธยมศึกษาปีที่ 3',
      'มัธยมศึกษาปีที่ 3': 'มัธยมศึกษาปีที่ 4',
      'มัธยมศึกษาปีที่ 4': 'มัธยมศึกษาปีที่ 5',
      'มัธยมศึกษาปีที่ 5': 'มัธยมศึกษาปีที่ 6'
    };
    const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
    const logs = [];
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      const gr = cleanVal(rows[i][3]);
      if (gr === 'มัธยมศึกษาปีที่ 6') {
        logs.push([rows[i][0], rows[i][1], gr, cleanVal(rows[i][7]) || 'ปกติ (กำลังศึกษา)']);
        rows[i][3] = 'สำเร็จการศึกษา';
        rows[i][7] = 'สำเร็จการศึกษา';
        rows[i][14] = today;
        rows[i][15] = 'สำเร็จการศึกษาจากการเลื่อนระดับชั้นประจำปี';
        count++;
      } else if (next[gr]) {
        rows[i][3] = next[gr];
        count++;
      }
      rows[i][0] = cleanVal(rows[i][0]);
    }
    sheet.getRange(2, 1, n, 1).setNumberFormat('@');
    sheet.getRange(2, 15, n, 1).setNumberFormat('@');
    rng.setValues(rows);
    logs.forEach(function (l) {
      logStudentStatusChange(l[0], l[1], l[2], l[3], 'สำเร็จการศึกษา', today, 'สำเร็จการศึกษาจากการเลื่อนระดับชั้นประจำปี', adminName || 'Admin');
    });
    SpreadsheetApp.flush();
    return { success: true, count: count, message: 'เลื่อนระดับชั้นทั้งโรงเรียนสำเร็จ ' + count + ' คน' };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/** บันทึกรูปโปรไฟล์อาจารย์ลง Google Drive และคอลัมน์ "รูปโปรไฟล์" ในชีตอาจารย์ */
function updateSubAdminPhoto(username, photo) {
  ensureSchema();
  const target = cleanVal(username).toLowerCase();
  if (!target) return { success: false, message: 'ไม่พบชื่อผู้ใช้' };
  const url = saveStudentPhotoToDrive('staff_' + target.replace(/[^a-z0-9_-]/g, ''), photo);
  if (!url) return { success: false, message: 'บันทึกรูปลง Google Drive ไม่สำเร็จ' };
  const ss = getSpreadsheet();
  // อาจารย์อยู่ในแผ่นงานอาจารย์ · ผู้ตรวจการ/ผู้บริหาร/แอดมินรองอยู่ในแผ่นงานแอดมิน (คอลัมน์ที่ 11 = รูปโปรไฟล์)
  const sheetsToCheck = [SHEETS.TEACHERS, SHEETS.ADMINS];
  for (let si = 0; si < sheetsToCheck.length; si++) {
    const sheet = ss.getSheetByName(sheetsToCheck[si]);
    if (!sheet || sheet.getLastRow() <= 1) continue;
    const rows = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (cleanVal(rows[i][0]).toLowerCase() === target) {
        if (si === 1 && sheet.getRange(1, 11).getValue() === '') sheet.getRange(1, 11).setValue('รูปโปรไฟล์');
        sheet.getRange(i + 2, 11).setValue(url);
        return { success: true, photoUrl: url, message: 'บันทึกรูปโปรไฟล์สำเร็จ' };
      }
    }
  }
  return { success: true, photoUrl: url, message: 'บันทึกรูปลง Drive แล้ว (ไม่พบแถวในชีตอาจารย์)' };
}

// ----------------- BUSINESS LOGIC FUNCTIONS & STRING HELPERS ----------------- //

/**
 * ทำความสะอาดข้อความ ลบเครื่องหมายคำพูดเดี่ยว (') ที่หัวข้อความ และตัดช่องว่าง
 */
function cleanVal(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str.startsWith("'")) {
    str = str.replace(/^'+/, '');
  }
  return str.trim();
}

/**
 * ปรับเบอร์โทรศัพท์ให้อยู่ในรูปแบบที่ถูกต้อง โดยเติมเลข 0 นำหน้ากรณีถูก Google Sheets ตัด
 */
function normalizePhone(val) {
  if (val === null || val === undefined) return '';
  let str = cleanVal(val).replace(/[^0-9]/g, '');
  if (str.length === 9 && (str.startsWith('8') || str.startsWith('6') || str.startsWith('9'))) {
    str = '0' + str;
  } else if (str.length === 8 && str.startsWith('2')) {
    str = '0' + str;
  }
  return str;
}

/**
 * ปรับวันเกิด 8 หลัก (ววดดปปปป) ให้อยู่ในรูปแบบที่ถูกต้อง โดยเติมเลข 0 นำหน้ากรณีถูกตัด
 */
function normalizeBirthDate(val) {
  if (val === null || val === undefined) return '';
  let str = cleanVal(val).replace(/[^0-9]/g, '');
  if (str.length === 7) {
    str = '0' + str;
  }
  return str;
}

/**
 * ตรวจสอบความตรงกันของรหัส (Student ID, Code) โดยรองรับเลข 0 นำหน้า
 */
function isCodeMatch(c1, c2) {
  const s1 = cleanVal(c1).toLowerCase();
  const s2 = cleanVal(c2).toLowerCase();
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;
  // ถ้าเป็นตัวเลขทั้งคู่ ตรวจสอบแบบตัดศูนย์นำหน้า
  if (/^\d+$/.test(s1) && /^\d+$/.test(s2)) {
    return s1.replace(/^0+/, '') === s2.replace(/^0+/, '');
  }
  return false;
}

/**
 * ตรวจสอบความตรงกันของเบอร์โทรศัพท์ โดยรองรับเบอร์ที่มี/ไม่มีเลข 0 นำหน้า
 */
function isPhoneMatch(p1, p2) {
  const s1 = normalizePhone(p1);
  const s2 = normalizePhone(p2);
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;
  const n1 = s1.replace(/^0+/, '');
  const n2 = s2.replace(/^0+/, '');
  if (n1 && n2 && n1 === n2) return true;
  return false;
}

/**
 * แปลงค่าให้เป็นข้อความ Plain Text อย่างปลอดภัย
 */
function formatAsText(val) {
  if (val === null || val === undefined) return '';
  return cleanVal(val);
}

/**
 * แปลงค่าวันที่จาก Google Sheets Date Object หรือ String ให้เป็นรูปแบบมาตรฐาน YYYY-MM-DD
 */
function formatSheetDate(val) {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    let yr = val.getFullYear();
    if (yr > 2400) {
      const adjusted = new Date(val.getTime());
      adjusted.setFullYear(yr - 543);
      return Utilities.formatDate(adjusted, "Asia/Bangkok", "yyyy-MM-dd");
    }
    return Utilities.formatDate(val, "Asia/Bangkok", "yyyy-MM-dd");
  }
  const s = cleanVal(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
    let yr = parsed.getFullYear();
    if (yr > 2400) parsed.setFullYear(yr - 543);
    return Utilities.formatDate(parsed, "Asia/Bangkok", "yyyy-MM-dd");
  }
  return s;
}

/**
 * แปลงค่าเวลาจาก Google Sheets Date Object (1899-12-30) หรือ String ให้เป็น HH:mm:ss
 */
function formatSheetTime(val) {
  if (!val) return '';
  const p2 = function (n) { return ('0' + n).slice(-2); };
  // v17.86 · เซลล์เวลาของชีตเป็นวันที่ปี 1899 · ใช้ชั่วโมง/นาทีตามที่แสดงในชีต (กันเวลาเพี้ยนจากเขตเวลาสมัยก่อน)
  if (val instanceof Date && !isNaN(val.getTime())) {
    if (val.getFullYear() < 1950) return p2(val.getHours()) + ':' + p2(val.getMinutes()) + ':' + p2(val.getSeconds());
    return Utilities.formatDate(val, "Asia/Bangkok", "HH:mm:ss");
  }
  const s = cleanVal(val);
  // v17.86 · รองรับชั่วโมงหลักเดียว เช่น "5:54:37" (เดิมจับได้ "54:37" ทำให้เวลาแสดงผิด)
  const match = s.match(/(^|[^\d])(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match && +match[2] < 24) return p2(match[2]) + ':' + match[3] + (match[4] ? ':' + match[4] : '');
  return s;
}

// v17.42 · เพศนักเรียน (คอลัมน์ Q) · 'ชาย' / 'หญิง' / '' (ยังไม่ระบุ)
function normGender_(v) { const g = cleanVal(v); if (/^(หญิง|female|f|ญ)$/i.test(g)) return 'หญิง'; if (/^(ชาย|male|m|ช)$/i.test(g)) return 'ชาย'; return ''; }
function setStudentGenders_(items) {
  ensureSchema();
  const sheet = getSpreadsheet().getSheetByName(SHEETS.STUDENTS); if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานนักเรียน' };
  try { if (cleanVal(sheet.getRange(1, 17).getValue()) !== 'เพศ') sheet.getRange(1, 17).setValue('เพศ'); } catch (e) {}
  const want = {}; (items || []).forEach(function (x) { const id = cleanVal(x && x.studentId); if (id) want[id.replace(/^0+/, '')] = normGender_(x.gender); });
  const last = sheet.getLastRow(); if (last < 2) return { success: true, updated: 0 };
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  const cur = sheet.getRange(2, 17, last - 1, 1).getValues();
  let n = 0;
  for (let i = 0; i < ids.length; i++) { const k = cleanVal(ids[i][0]).replace(/^0+/, ''); if (k && Object.prototype.hasOwnProperty.call(want, k) && cleanVal(cur[i][0]) !== want[k]) { cur[i][0] = want[k]; n++; } }
  if (n) sheet.getRange(2, 17, last - 1, 1).setValues(cur);
  return { success: true, updated: n, message: 'บันทึกเพศนักเรียนแล้ว ' + n + ' คน' };
}
// แยกคำนำหน้าออกจากชื่อ (ทั้งที่อยู่หน้าชื่อ และกรณีพิมพ์ต่อท้าย เช่น "ซุลฟา บนีอาดัมนางสาว")
const NAME_PREFIX_MAP_ = { 'ด.ช.': 'เด็กชาย', 'ด.ญ.': 'เด็กหญิง', 'น.ส.': 'นางสาว' };
function splitNamePrefix_(name) {
  let n = cleanVal(name).replace(/\s+/g, ' '), p = '';
  let m = n.match(/^(เด็กชาย|เด็กหญิง|นางสาว|นาย|นาง|ด\.ช\.|ด\.ญ\.|น\.ส\.)\s*/);
  if (m) { p = m[1]; n = n.slice(m[0].length).trim(); }
  else {
    m = n.match(/\s*(นางสาว|เด็กหญิง|เด็กชาย)$/) || n.match(/\s+(นาย|นาง)$/);
    if (m && n.length - m[0].length >= 2) { p = m[1]; n = n.slice(0, n.length - m[0].length).trim(); }
  }
  return { prefix: NAME_PREFIX_MAP_[p] || p, name: n };
}
function genderFromPrefix_(p) { if (/^(นาย|เด็กชาย)$/.test(p)) return 'ชาย'; if (/^(นางสาว|นาง|เด็กหญิง)$/.test(p)) return 'หญิง'; return ''; }
function setStudentPrefix_(studentId, prefix) {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.STUDENTS); if (!sheet) return;
  try { if (cleanVal(sheet.getRange(1, 18).getValue()) !== 'คำนำหน้า') sheet.getRange(1, 18).setValue('คำนำหน้า'); } catch (e) {}
  const last = sheet.getLastRow(); if (last < 2) return;
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (isCodeMatch(ids[i][0], studentId)) { sheet.getRange(i + 2, 18).setValue(prefix); return; }
}
function registerStudent(data) {
  let prefix = '';
  if (data && (data.fullName || data.prefix)) {
    const sp = splitNamePrefix_(data.fullName || '');
    prefix = NAME_PREFIX_MAP_[cleanVal(data.prefix)] || cleanVal(data.prefix) || sp.prefix;
    if (prefix && data.fullName) data = Object.assign({}, data, { fullName: sp.name });
  }
  const r = registerStudentCore_(data);
  try {
    if (r && r.success !== false && data) {
      if (prefix) setStudentPrefix_(data.studentId, prefix);
      const g = normGender_(data.gender) || '';
      if (g) setStudentGenders_([{ studentId: data.studentId, gender: g }]);
    }
  } catch (e) {}
  return r;
}
/** v17.43 · ย้ายคำนำหน้าที่พิมพ์ปนในชื่อไปไว้คอลัมน์คำนำหน้า + เติมเพศจากคำนำหน้า (เรียกซ้ำได้ ไม่เสียหาย) */
function normalizeStudentNames_() {
  ensureSchema();
  const sheet = getSpreadsheet().getSheetByName(SHEETS.STUDENTS); if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานนักเรียน' };
  try { if (cleanVal(sheet.getRange(1, 17).getValue()) !== 'เพศ') sheet.getRange(1, 17).setValue('เพศ'); if (cleanVal(sheet.getRange(1, 18).getValue()) !== 'คำนำหน้า') sheet.getRange(1, 18).setValue('คำนำหน้า'); } catch (e) {}
  const last = sheet.getLastRow(); if (last < 2) return { success: true, moved: 0, gendered: 0 };
  const names = sheet.getRange(2, 2, last - 1, 1).getValues();
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  const qr = sheet.getRange(2, 17, last - 1, 2).getValues();
  let moved = 0, gendered = 0;
  const FORCE_MALE = ['มูฮำหมัดมับรูรหลังปูเต๊ะ']; // แอดมินแจ้ง 2 พ.ย. 2569
  for (let i = 0; i < names.length; i++) {
    if (!cleanVal(ids[i][0])) continue;
    const sp = splitNamePrefix_(names[i][0]);
    if (sp.prefix) { names[i][0] = sp.name; if (!cleanVal(qr[i][1])) qr[i][1] = sp.prefix; moved++; }
    else if (cleanVal(qr[i][1]) && NAME_PREFIX_MAP_[cleanVal(qr[i][1])]) qr[i][1] = NAME_PREFIX_MAP_[cleanVal(qr[i][1])];
    const key = String(sp.name).replace(/\s+/g, '');
    if (FORCE_MALE.indexOf(key) !== -1 && normGender_(qr[i][0]) !== 'ชาย') { qr[i][0] = 'ชาย'; gendered++; }
    else if (!normGender_(qr[i][0])) { const g = genderFromPrefix_(cleanVal(qr[i][1])); if (g) { qr[i][0] = g; gendered++; } }
  }
  if (moved) sheet.getRange(2, 2, last - 1, 1).setValues(names);
  if (moved || gendered) sheet.getRange(2, 17, last - 1, 2).setValues(qr);
  return { success: true, moved: moved, gendered: gendered, message: 'ย้ายคำนำหน้า ' + moved + ' คน · เติมเพศ ' + gendered + ' คน' };
}
function registerStudentCore_(data) {
  if (!data) return { success: false, message: 'ไม่มีข้อมูลนักเรียน' };
  ensureSchema();
  const ss = getSpreadsheet();
  if (!ss) return { success: false, message: 'ไม่สามารถเปิดสเปรดชีตฐานข้อมูลได้' };
  
  let sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) {
    sheet = getOrCreateSheetSmart(ss, 'STUDENTS', HEADERS.STUDENTS, '#0284c7');
  }

  const cleanSid = cleanVal(data.studentId);
  if (!cleanSid) return { success: false, message: 'ไม่พบรหัสนักเรียน' };
  const cleanBD = normalizeBirthDate(data.birthDate);
  const cleanPh = normalizePhone(data.parentPhone || data.phone);
  const statusThai = data.status === 'รอผู้สมัครกรอกรหัส OTP'
    ? 'รอผู้สมัครกรอกรหัส OTP'
    : formatStudentStatusThai(data.status || 'Active');

  const rawPhoto = data.avatarUrl || data.profilePhoto || '';
  let photoLink = '';
  try {
    photoLink = saveStudentPhotoToDrive(cleanSid, rawPhoto);
  } catch (photoErr) {
    Logger.log('Drive photo save error: ' + photoErr.message);
  }

  const safePhotoRef = (photoLink && !photoLink.startsWith('data:image')) 
    ? photoLink 
    : (rawPhoto && !rawPhoto.startsWith('data:image') && rawPhoto.length < 500 ? rawPhoto : '');

  const emailVal = cleanVal(data.email || '');
  const gpaxVal = (data.gpax !== undefined && data.gpax !== null && data.gpax !== '') ? String(data.gpax) : '';
  const attendanceJson = data.attendance ? JSON.stringify(data.attendance) : '';
  const gradesJson = Array.isArray(data.grades) ? JSON.stringify(data.grades) : '';
  const approvalStatusVal = cleanVal(data.approvalStatus || (statusThai === 'รอผู้สมัครกรอกรหัส OTP' ? 'AwaitingOtp' : 'Verified'));

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (isCodeMatch(rows[i][0], cleanSid)) {
      const rowNum = i + 1;
      const existingRegDate = cleanVal(rows[i][6]) || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
      const finalPhoto = (safePhotoRef && safePhotoRef !== 'รูปโปรไฟล์ในอุปกรณ์') ? safePhotoRef : (cleanVal(rows[i][8]) || safePhotoRef);
      const finalEmail = emailVal || cleanVal(rows[i][9] || '');
      const finalGpax = gpaxVal || cleanVal(rows[i][10] || '0.00');
      const finalAttJson = attendanceJson || cleanVal(rows[i][11] || '{"present":0,"late":0,"leave":0,"absent":0}');
      const finalGradesJson = gradesJson || cleanVal(rows[i][12] || '[]');
      const finalApproval = data.approvalStatus ? approvalStatusVal : (cleanVal(rows[i][13]) || approvalStatusVal);
      const existingStatusEffectiveDate = formatSheetDate(rows[i][14]) || cleanVal(rows[i][14] || '');
      const existingStatusNote = cleanVal(rows[i][15] || '');
      const finalStatusDate = data.statusEffectiveDate || data.statusDate || existingStatusEffectiveDate;
      const finalStatusNote = (data.statusNote !== undefined && data.statusNote !== null) ? cleanVal(data.statusNote) : existingStatusNote;
      const oldStatus = cleanVal(rows[i][7]) || 'ปกติ (กำลังศึกษา)';

      sheet.getRange(rowNum, 1, 1, 16).setValues([[
        cleanSid,
        data.fullName || rows[i][1] || '',
        data.schoolName || rows[i][2] || '',
        data.grade || rows[i][3] || '',
        cleanBD || normalizeBirthDate(rows[i][4]),
        cleanPh || normalizePhone(rows[i][5]),
        existingRegDate,
        statusThai,
        finalPhoto,
        finalEmail,
        finalGpax,
        finalAttJson,
        finalGradesJson,
        finalApproval,
        finalStatusDate,
        finalStatusNote
      ]]);
      sheet.getRange(rowNum, 1).setNumberFormat('@').setValue(cleanSid);
      sheet.getRange(rowNum, 5).setNumberFormat('@').setValue(cleanBD || normalizeBirthDate(rows[i][4]));
      sheet.getRange(rowNum, 6).setNumberFormat('@').setValue(cleanPh || normalizePhone(rows[i][5]));
      sheet.getRange(rowNum, 15).setNumberFormat('@').setValue(finalStatusDate);

      // บันทึกประวัติการเปลี่ยนสถานะลงชีต 'บันทึกสถานะของนักเรียน' หากสถานะเปลี่ยนแปลง
      if (statusThai !== oldStatus && statusThai !== 'รอผู้สมัครกรอกรหัส OTP') {
        logStudentStatusChange(cleanSid, data.fullName || rows[i][1] || '', data.grade || rows[i][3] || '', oldStatus, statusThai, finalStatusDate, finalStatusNote, data.adminUser || 'Admin');
      }

      if (data.hasanat) {
        try {
          recordHasanat({
            studentId: cleanSid,
            studentName: data.fullName || rows[i][1] || '',
            grade: data.grade || rows[i][3] || '',
            quran: data.hasanat.quran,
            memorization: data.hasanat.memorization,
            sunnah: data.hasanat.sunnah
          });
        } catch (hErr) {}
      }
      if (Array.isArray(data.grades) && data.grades.length > 0) {
        try {
          syncStudentGradesArrayToSheet(cleanSid, data.fullName || rows[i][1] || '', data.grade || rows[i][3] || '', data.grades, 'Admin/System');
        } catch (gErr) {}
      }

      return {
        success: true,
        updated: true,
        message: 'อัปเดตข้อมูลนักเรียนสำเร็จเรียบร้อย',
        student: {
          studentId: cleanSid,
          fullName: data.fullName || rows[i][1],
          schoolName: data.schoolName || rows[i][2],
          grade: data.grade || rows[i][3],
          birthDate: cleanBD || normalizeBirthDate(rows[i][4]),
          parentPhone: cleanPh || normalizePhone(rows[i][5]),
          status: statusThai,
          statusEffectiveDate: finalStatusDate,
          statusDate: finalStatusDate,
          statusNote: finalStatusNote,
          avatarUrl: photoLink || rawPhoto || rows[i][8],
          email: finalEmail,
          gpax: Number(finalGpax) || 0,
          approvalStatus: finalApproval
        }
      };
    }
  }

  const registeredAt = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
  const statusDate = data.statusEffectiveDate || data.statusDate || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
  const statusNote = cleanVal(data.statusNote || 'ลงทะเบียนนักเรียนใหม่');

  sheet.appendRow([
    cleanSid,
    data.fullName || '',
    data.schoolName || '',
    data.grade || '',
    cleanBD,
    cleanPh,
    registeredAt,
    statusThai,
    safePhotoRef,
    emailVal,
    gpaxVal || '0.00',
    attendanceJson || '{"present":0,"late":0,"leave":0,"absent":0}',
    gradesJson || '[]',
    approvalStatusVal,
    statusDate,
    statusNote
  ]);

  // ตั้งค่า NumberFormat เป็น Plain Text เพื่อรักษาเลข 0 นำหน้าแน่นอน 100%
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 1).setNumberFormat('@').setValue(cleanSid);
  sheet.getRange(lastRow, 5).setNumberFormat('@').setValue(cleanBD);
  sheet.getRange(lastRow, 6).setNumberFormat('@').setValue(cleanPh);
  sheet.getRange(lastRow, 15).setNumberFormat('@').setValue(statusDate);

  if (statusThai !== 'รอผู้สมัครกรอกรหัส OTP') {
    logStudentStatusChange(cleanSid, data.fullName || '', data.grade || '', 'ลงทะเบียนใหม่', statusThai, statusDate, statusNote, data.adminUser || 'ระบบลงทะเบียน');
  }

  if (data.hasanat) {
    try {
      recordHasanat({
        studentId: cleanSid,
        studentName: data.fullName || '',
        grade: data.grade || '',
        quran: data.hasanat.quran,
        memorization: data.hasanat.memorization,
        sunnah: data.hasanat.sunnah
      });
    } catch (hErr) {}
  }
  if (Array.isArray(data.grades) && data.grades.length > 0) {
    try {
      syncStudentGradesArrayToSheet(cleanSid, data.fullName || '', data.grade || '', data.grades, 'Admin/System');
    } catch (gErr) {}
  }

  return { 
    success: true, 
    message: 'ลงทะเบียนสำเร็จเรียบร้อย', 
    student: {
      studentId: cleanSid,
      fullName: data.fullName,
      schoolName: data.schoolName,
      grade: data.grade,
      birthDate: cleanBD,
      parentPhone: cleanPh,
      status: statusThai,
      statusEffectiveDate: statusDate,
      statusDate: statusDate,
      statusNote: statusNote,
      avatarUrl: photoLink || rawPhoto,
      email: emailVal,
      gpax: Number(gpaxVal) || 0,
      approvalStatus: approvalStatusVal
    }
  };
}

function buildStudentObjectFromRow(row, hasanatMap, gradesMap) {
  const sid = cleanVal(row[0]);
  let attendance = { present: 0, late: 0, leave: 0, absent: 0 };
  try {
    if (row[11]) attendance = JSON.parse(row[11]);
  } catch (e) {}

  let grades = [];
  try {
    if (row[12]) grades = JSON.parse(row[12]);
  } catch (e) {}
  if ((!Array.isArray(grades) || grades.length === 0) && gradesMap && gradesMap[sid]) {
    grades = gradesMap[sid];
  }

  let gpax = parseFloat(row[10]);
  if (isNaN(gpax) && Array.isArray(grades) && grades.length > 0) {
    const sum = grades.reduce((acc, g) => acc + (parseFloat(g.grade) || 0), 0);
    gpax = Number((sum / grades.length).toFixed(2));
  } else if (isNaN(gpax)) {
    gpax = 0;
  }

  const defaultHasanat = {
    quran: { pagesToday: 0, currentPage: 1, juzCompleted: 0, stars: 0, khatamCount: 0 },
    memorization: { count: 0, memorizedSurahs: [] },
    sunnah: { totalRakaat: 0, rawatib: {} }
  };

  const statusVal = formatStudentStatusThai(cleanVal(row[7]) || 'ปกติ (กำลังศึกษา)');
  const statusEffectiveDate = formatSheetDate(row[14]) || cleanVal(row[14] || '');
  const statusNote = cleanVal(row[15] || '');

  // v17.43 · คำนำหน้าแยกคอลัมน์ R · ชื่อในคอลัมน์ B ไม่มีคำนำหน้า · fullName = คำนำหน้า + ชื่อ (ใช้แสดงผลเหมือนเดิม)
  const pfx = cleanVal(row[17] || '');
  const sp0 = splitNamePrefix_(cleanVal(row[1]));
  const bareName = pfx ? sp0.name : cleanVal(row[1]);
  return {
    studentId: sid,
    fullName: pfx ? pfx + bareName : cleanVal(row[1]),
    prefix: pfx || sp0.prefix,
    nameOnly: sp0.name,
    schoolName: cleanVal(row[2]),
    grade: cleanVal(row[3]),
    birthDate: normalizeBirthDate(row[4]),
    parentPhone: normalizePhone(row[5]),
    registeredAt: formatSheetDate(row[6]) || cleanVal(row[6]),
    status: statusVal,
    statusEffectiveDate: statusEffectiveDate,
    statusDate: statusEffectiveDate,
    statusNote: statusNote,
    profilePhoto: cleanVal(row[8] || ''),
    avatarUrl: cleanVal(row[8] || ''),
    email: cleanVal(row[9] || ''),
    gpax: gpax,
    attendance: attendance,
    grades: Array.isArray(grades) ? grades : [],
    approvalStatus: cleanVal(row[13] || (statusVal === 'รอผู้สมัครกรอกรหัส OTP' ? 'AwaitingOtp' : 'Verified')),
    gender: normGender_(row[16]),
    hasanat: (hasanatMap && hasanatMap[sid]) ? hasanatMap[sid] : defaultHasanat
  };
}

function getLatestHasanatMapByStudent(ss) {
  const map = {};
  try {
    const sheet = ss.getSheetByName(SHEETS.HASANAT);
    if (!sheet || sheet.getLastRow() <= 1) return map;
    const rows = readAllRows_(sheet);
    for (let i = 1; i < rows.length; i++) {
      const sid = cleanVal(rows[i][1]);
      if (!sid) continue;
      const prev = map[sid] || {
        quran: { pagesToday: 0, currentPage: 1, juzCompleted: 0, stars: 0, khatamCount: 0 },
        memorization: { count: 0, memorizedSurahs: [] },
        sunnah: { totalRakaat: 0, rawatib: {} }
      };

      const pagesToday = Number(rows[i][5]) || 0;
      const currentPage = Number(rows[i][6]) || prev.quran.currentPage || 1;
      const juzCompleted = Number(rows[i][7]) || prev.quran.juzCompleted || 0;
      const stars = Math.max(Number(rows[i][8]) || 0, prev.quran.stars || 0);
      const khatamCount = Math.max(Number(rows[i][9]) || 0, prev.quran.khatamCount || 0);

      let memList = prev.memorization.memorizedSurahs || [];
      const rawMemStr = cleanVal(rows[i][11]);
      if (rawMemStr) {
        const parsedList = rawMemStr.split(',').map(s => s.trim()).filter(Boolean);
        if (parsedList.length > 0) memList = parsedList;
      }
      const memCount = Math.max(Number(rows[i][10]) || 0, memList.length);

      let rawatib = prev.sunnah.rawatib || {};
      try {
        if (rows[i][13]) {
          const parsedRawatib = JSON.parse(rows[i][13]);
          if (parsedRawatib && Object.keys(parsedRawatib).length > 0) rawatib = parsedRawatib;
        }
      } catch (e) {}
      const totalRakaat = Number(rows[i][12]) || prev.sunnah.totalRakaat || 0;

      map[sid] = {
        quran: {
          pagesToday: pagesToday,
          currentPage: currentPage,
          juzCompleted: juzCompleted,
          stars: stars,
          khatamCount: khatamCount,
          lastReadDate: formatSheetDate(rows[i][4])
        },
        memorization: {
          count: memCount,
          memorizedSurahs: memList,
          lastUpdate: cleanVal(rows[i][14])
        },
        sunnah: {
          totalRakaat: totalRakaat,
          rawatib: rawatib,
          lastSunnahDate: formatSheetDate(rows[i][4])
        }
      };
    }
  } catch (err) {}
  return map;
}

function getLatestGradesMapByStudent(ss) {
  const map = {};
  try {
    const sheet = ss.getSheetByName(SHEETS.GRADES);
    if (!sheet || sheet.getLastRow() <= 1) return map;
    const rows = readAllRows_(sheet);
    for (let i = 1; i < rows.length; i++) {
      const sid = cleanVal(rows[i][0]);
      const subjCode = cleanVal(rows[i][3]);
      const subjName = cleanVal(rows[i][4]);
      const gradeVal = parseFloat(rows[i][5]) || 0;
      const scoreVal = parseFloat(rows[i][6]) || 0;
      if (!sid || (!subjCode && !subjName)) continue;
      if (!map[sid]) map[sid] = [];
      const existingIdx = map[sid].findIndex(g => (subjCode && g.code === subjCode) || (subjName && g.name === subjName));
      const entry = {
        code: subjCode || subjName,
        name: subjName || subjCode,
        grade: gradeVal,
        score: scoreVal
      };
      if (existingIdx !== -1) {
        map[sid][existingIdx] = entry;
      } else {
        map[sid].push(entry);
      }
    }
  } catch (err) {}
  return map;
}

/**
 * เข้าสู่ระบบนักเรียน: ต้องระบุรหัสนักเรียน + (เบอร์โทรผู้ปกครอง หรือ วันเกิด) เสมอ
 * สำเร็จแล้วจะได้ token สำหรับใช้งานระบบ
 */
function loginStudent(studentId, passOrPhone) {
  const targetId = cleanVal(studentId);
  const cleanInput = cleanVal(passOrPhone);
  if (!targetId || !cleanInput) {
    return { success: false, message: 'กรุณากรอกรหัสนักเรียนและเบอร์โทรศัพท์ผู้ปกครองให้ครบถ้วน' };
  }
  const rlKey = 'stu_' + targetId.toLowerCase().replace(/^0+/, '');
  if (loginLocked_(rlKey)) return { success: false, locked: true, message: LOCKED_MESSAGE };

  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานนักเรียน' };
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (!isCodeMatch(rows[i][0], targetId)) continue;
    const matchPass = isPhoneMatch(rows[i][5], cleanInput) ||
      (cleanVal(rows[i][4]) && isCodeMatch(normalizeBirthDate(rows[i][4]), normalizeBirthDate(cleanInput)));
    if (!matchPass) {
      loginFailed_(rlKey);
      return { success: false, field: 'phone', message: 'เบอร์โทรศัพท์ผู้ปกครองไม่ตรงกับรหัสนักเรียนนี้' };
    }
    const studentObj = buildStudentObjectFromRow(rows[i], getLatestHasanatMapByStudent(ss), getLatestGradesMapByStudent(ss));
    if (studentObj.status === 'รอผู้สมัครกรอกรหัส OTP' || studentObj.approvalStatus === 'PendingAdmin' || studentObj.approvalStatus === 'AwaitingOtp') {
      return {
        success: false,
        requireOtp: true,
        approvalStatus: studentObj.approvalStatus,
        registration: { role: 'student', userId: studentObj.studentId, fullName: studentObj.fullName, email: studentObj.email, status: studentObj.approvalStatus === 'AwaitingOtp' ? 'Approved' : 'PendingAdmin' },
        message: 'บัญชียังไม่ได้ยืนยันรหัส OTP 6 หลักจากอีเมล'
      };
    }
    loginSucceeded_(rlKey);
    return {
      success: true,
      token: issueToken_('student', studentObj.studentId, studentObj.fullName),
      role: 'student',
      student: studentObj
    };
  }
  loginFailed_(rlKey);
  return { success: false, field: 'id', message: 'ไม่พบรหัสนักเรียนนี้ในระบบ' };
}

const GRADE_LEVELS_ = ['มัธยมศึกษาปีที่ 1', 'มัธยมศึกษาปีที่ 2', 'มัธยมศึกษาปีที่ 3', 'มัธยมศึกษาปีที่ 4', 'มัธยมศึกษาปีที่ 5', 'มัธยมศึกษาปีที่ 6'];
function gradeIndex_(g) {
  const s = cleanVal(g);
  let i = GRADE_LEVELS_.indexOf(s);
  if (i === -1) { const m = s.match(/^ม\.?\s*([1-6])$/); if (m) i = Number(m[1]) - 1; }
  return i;
}
function updateStudentGrade(studentId, newGrade, selfService) {
  const target = gradeIndex_(newGrade);
  if (target === -1) return { success: false, message: 'ระดับชั้นไม่ถูกต้อง' };
  newGrade = GRADE_LEVELS_[target];
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (isCodeMatch(rows[i][0], studentId)) {
      if (selfService) {
        // นักเรียนเลื่อนชั้นตัวเองได้ครั้งละ 1 ชั้นเท่านั้น (ห้ามข้ามชั้นหรือย้อนชั้น)
        const cur = gradeIndex_(rows[i][3]);
        if (cur !== -1 && target !== cur && target !== cur + 1) {
          return { success: false, code: 'FORBIDDEN', message: 'เลื่อนชั้นได้ครั้งละ 1 ชั้นเท่านั้น หากต้องการเปลี่ยนมากกว่านี้ กรุณาติดต่อแอดมิน' };
        }
      }
      sheet.getRange(i + 1, 4).setValue(newGrade);
      return { success: true, message: 'อัปเดตชั้นปีเป็น ' + newGrade + ' เรียบร้อยแล้ว' };
    }
  }
  return { success: false, message: 'ไม่พบรหัสนักเรียน' };
}

function syncStudentGradesArrayToSheet(studentId, studentName, gradeLevel, gradesArray, evaluator) {
  if (!Array.isArray(gradesArray) || gradesArray.length === 0) return;
  const ss = getSpreadsheet();
  const sheetGrades = getOrCreateSheetSmart(ss, 'GRADES', HEADERS.GRADES, '#4f46e5');
  const rows = sheetGrades.getDataRange().getValues();
  const nowStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
  const cleanSid = cleanVal(studentId);

  gradesArray.forEach(g => {
    const subjCode = cleanVal(g.code || g.subjectCode || g.name || '');
    const subjName = cleanVal(g.name || g.subjectName || subjCode);
    const gradeVal = (g.grade !== undefined && g.grade !== null) ? Number(g.grade) : 0;
    const scoreVal = (g.score !== undefined && g.score !== null) ? Number(g.score) : (gradeVal * 25);
    if (!subjCode && !subjName) return;

    let foundRow = -1;
    for (let i = 1; i < rows.length; i++) {
      if (isCodeMatch(rows[i][0], cleanSid) &&
          ((subjCode && cleanVal(rows[i][3]) === subjCode) || (subjName && cleanVal(rows[i][4]) === subjName))) {
        foundRow = i + 1;
        break;
      }
    }

    const rowData = [
      cleanSid,
      studentName || '',
      gradeLevel || '',
      subjCode,
      subjName,
      gradeVal,
      scoreVal,
      evaluator || 'Teacher',
      nowStr
    ];

    if (foundRow !== -1) {
      sheetGrades.getRange(foundRow, 1, 1, 9).setValues([rowData]);
      sheetGrades.getRange(foundRow, 1).setNumberFormat('@').setValue(cleanSid);
    } else {
      sheetGrades.appendRow(rowData);
      const lastRow = sheetGrades.getLastRow();
      sheetGrades.getRange(lastRow, 1).setNumberFormat('@').setValue(cleanSid);
    }
  });
}

function updateSubjectScores(data) {
  if (!data) return { success: false, message: 'ไม่มีข้อมูลคะแนนรายวิชา' };
  ensureSchema();
  const ss = getSpreadsheet();
  const sheetStudents = ss.getSheetByName(SHEETS.STUDENTS);
  const sheetGrades = getOrCreateSheetSmart(ss, 'GRADES', HEADERS.GRADES, '#4f46e5');
  const nowStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");

  const subjCode = cleanVal(data.subjectCode || data.subject || data.subjectName || '');
  const subjName = cleanVal(data.subjectName || data.subject || subjCode);
  const evaluator = cleanVal(data.teacherId || data.evaluator || 'อาจารย์ผู้สอน');
  let updatedCount = 0;

  const studentRows = sheetStudents ? sheetStudents.getDataRange().getValues() : [];

  // กรณีที่ 1: ส่งมาเป็น studentGrades Array (จาก saveTeacherGradingScores)
  if (Array.isArray(data.studentGrades)) {
    data.studentGrades.forEach(item => {
      const cleanSid = cleanVal(item.studentId);
      if (!cleanSid) return;
      if (Array.isArray(item.grades)) {
        syncStudentGradesArrayToSheet(cleanSid, item.fullName || '', item.grade || '', item.grades, evaluator);
      } else if (subjCode || subjName) {
        syncStudentGradesArrayToSheet(cleanSid, item.fullName || '', item.grade || '', [{
          code: subjCode,
          name: subjName,
          grade: item.gradeVal !== undefined ? item.gradeVal : item.grade,
          score: item.score
        }], evaluator);
      }

      // อัปเดตในแผ่นงาน รายชื่อนักเรียน (GPAX + เกรดรายวิชา JSON)
      for (let i = 1; i < studentRows.length; i++) {
        if (isCodeMatch(studentRows[i][0], cleanSid)) {
          if (item.gpax !== undefined) {
            sheetStudents.getRange(i + 1, 11).setValue(String(item.gpax));
          }
          if (Array.isArray(item.grades)) {
            sheetStudents.getRange(i + 1, 13).setValue(JSON.stringify(item.grades));
          }
          break;
        }
      }
      updatedCount++;
    });
  }

  // กรณีที่ 2: ส่งมาเป็น scores / grades Object Map { studentId: gradeVal } (จาก saveTeacherPortalGrades)
  const scoresMap = data.scores || data.grades || {};
  if (scoresMap && typeof scoresMap === 'object' && !Array.isArray(scoresMap)) {
    Object.keys(scoresMap).forEach(sid => {
      const cleanSid = cleanVal(sid);
      const gradeVal = Number(scoresMap[sid]) || 0;
      const scoreVal = gradeVal === 4 ? 85 : (gradeVal === 3 ? 75 : (gradeVal === 2 ? 65 : 55));
      let sName = '';
      let sGradeLevel = cleanVal(data.gradeFilter || '');

      for (let i = 1; i < studentRows.length; i++) {
        if (isCodeMatch(studentRows[i][0], cleanSid)) {
          sName = cleanVal(studentRows[i][1]);
          sGradeLevel = cleanVal(studentRows[i][3]) || sGradeLevel;
          let existingGrades = [];
          try {
            if (studentRows[i][12]) existingGrades = JSON.parse(studentRows[i][12]);
          } catch (e) {}
          if (!Array.isArray(existingGrades)) existingGrades = [];
          const gIdx = existingGrades.findIndex(g => g.name === subjName || g.code === subjCode);
          if (gIdx !== -1) {
            existingGrades[gIdx].grade = gradeVal;
            existingGrades[gIdx].score = scoreVal;
          } else {
            existingGrades.push({ code: subjCode || subjName, name: subjName || subjCode, grade: gradeVal, score: scoreVal });
          }
          const avgGpax = existingGrades.length > 0
            ? (existingGrades.reduce((acc, g) => acc + (Number(g.grade) || 0), 0) / existingGrades.length).toFixed(2)
            : '0.00';
          sheetStudents.getRange(i + 1, 11).setValue(String(avgGpax));
          sheetStudents.getRange(i + 1, 13).setValue(JSON.stringify(existingGrades));
          break;
        }
      }

      syncStudentGradesArrayToSheet(cleanSid, sName, sGradeLevel, [{
        code: subjCode || subjName,
        name: subjName || subjCode,
        grade: gradeVal,
        score: scoreVal
      }], evaluator);
      updatedCount++;
    });
  }

  return {
    success: true,
    updatedCount: updatedCount,
    message: 'บันทึกคะแนนและเกรดรายวิชาลง Google Sheets สำเร็จ (' + updatedCount + ' รายการ)'
  };
}

function getSubjectGrades(studentId, subject) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.GRADES);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };
  const rows = readAllRows_(sheet);
  const targetSid = cleanVal(studentId || '');
  const targetSubj = cleanVal(subject || '');
  const results = [];

  for (let i = 1; i < rows.length; i++) {
    const sid = cleanVal(rows[i][0]);
    const subjCode = cleanVal(rows[i][3]);
    const subjName = cleanVal(rows[i][4]);
    if (!sid) continue;
    if (targetSid && !isCodeMatch(sid, targetSid)) continue;
    if (targetSubj && subjCode !== targetSubj && subjName !== targetSubj) continue;

    results.push({
      studentId: sid,
      studentName: cleanVal(rows[i][1]),
      gradeLevel: cleanVal(rows[i][2]),
      subjectCode: subjCode,
      subjectName: subjName,
      grade: Number(rows[i][5]) || 0,
      score: Number(rows[i][6]) || 0,
      evaluator: cleanVal(rows[i][7]),
      updatedAt: cleanVal(rows[i][8])
    });
  }
  return { success: true, data: results };
}

function recordPrayer(data) {
  if (!data) return { success: false, message: 'ไม่มีข้อมูลการละหมาด' };
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PRAYERS);

  const logId = cleanVal(data.logId || data.id || ('PRY-' + new Date().getTime()));
  const timestamp = data.timestamp || new Date().toISOString();
  const now = new Date();
  const dateStr = formatSheetDate(data.date) || Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd");
  const timeStr = formatSheetTime(data.time) || Utilities.formatDate(now, "Asia/Bangkok", "HH:mm:ss");
  const cleanSid = formatAsText(data.studentId);

  // รองรับทั้ง prayerTime, prayerName, timeSlot
  const rawPrayerTime = data.prayerTime || data.prayerName || data.timeSlot || '';
  const prayerNameThai = formatPrayerTimeThai(rawPrayerTime);

  // ตรวจสอบเฉพาะกรณีรหัส logId ซ้ำเดิมเป๊ะๆ เพื่อป้องกัน packet ซ้ำจากเน็ตกระตุก
  // แต่หากเป็นการกดบันทึกซ้ำครั้งใหม่ (logId ใหม่) จะบันทึกเป็นประวัติการเช็คชื่อซ้ำตามที่ผู้ใช้ต้องการ
  const existingRows = sheet.getDataRange().getValues();
  for (let i = 1; i < existingRows.length; i++) {
    const rLogId = cleanVal(existingRows[i][0]);
    if (logId && rLogId === logId) {
      return { success: true, deduplicated: true, message: 'ข้อมูลการละหมาดรหัสนี้มีอยู่ในฐานข้อมูลแล้ว', logId: rLogId };
    }
  }

  // จัดการรูปถ่ายพยานการละหมาด
  const rawBase64 = data.photoBase64 || data.photo || (data.photoUrl && data.photoUrl.startsWith('data:image') ? data.photoUrl : '');
  let photoRef = '';
  if (data.photoUrl && !data.photoUrl.startsWith('data:image')) {
    photoRef = data.photoUrl;
  }

  if (rawBase64 && rawBase64.startsWith('data:image')) {
    try {
      const folderName = "Khalifah_Prayer_Photos";
      let folder;
      const folders = DriveApp.getFoldersByName(folderName);
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder(folderName);
      }
      
      const contentType = "image/jpeg";
      const cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
      const bytes = Utilities.base64Decode(cleanBase64);
      const studentIdClean = String(cleanSid || 'std').replace(/[^a-zA-Z0-9_-]/g, '');
      const pTimeClean = String(rawPrayerTime || 'prayer').replace(/[^a-zA-Z0-9_\u0E00-\u0E7F-]/g, '');
      const blob = Utilities.newBlob(bytes, contentType, `${studentIdClean}_${pTimeClean}_${dateStr}_${logId}.jpg`);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const fileId = file.getId();
      photoRef = `https://lh3.googleusercontent.com/d/${fileId}`;
    } catch (err) {
      Logger.log('Drive prayer photo error: ' + err.message);
      // หากบันทึกลง Google Drive ไม่สำเร็จ (เช่น สิทธิ์ Drive ยังไม่เปิด) ให้บันทึกรูป Base64 ลงเซลล์ Google Sheet ตรงๆ ได้ทันที
      if (rawBase64.length < 49000) {
        photoRef = rawBase64;
      } else {
        photoRef = '';
      }
    }
  }

  if (!photoRef) {
    if (rawBase64 && rawBase64.length < 49000) {
      photoRef = rawBase64;
    } else if (data.photoUrl && data.photoUrl.startsWith('data:image') && data.photoUrl.length < 49000) {
      photoRef = data.photoUrl;
    } else if (data.photoUrl && data.photoUrl.length < 500) {
      photoRef = data.photoUrl;
    }
  }

  const statusThai = formatStatusThai(data.status || 'ตรงเวลา');
  const isWithin = (data.isWithinZone === true || data.isWithinZone === 'ใช่' || data.isWithinZone === 'true');
  const withinZoneThai = isWithin ? 'ใช่' : 'ไม่ใช่';

  // รองรับทั้ง latitude/longitude และ lat/lng
  const lat = (data.latitude !== undefined && data.latitude !== null && data.latitude !== '') 
    ? data.latitude 
    : ((data.lat !== undefined && data.lat !== null && data.lat !== '') ? data.lat : '');
  const lng = (data.longitude !== undefined && data.longitude !== null && data.longitude !== '') 
    ? data.longitude 
    : ((data.lng !== undefined && data.lng !== null && data.lng !== '') ? data.lng : '');

  // ระบุสถานที่และพิกัด Google Maps หากอยู่นอกพื้นที่
  let locationDisplay = data.locationName || '';
  if (lat && lng && !isWithin && locationDisplay.indexOf('maps?q=') === -1) {
    locationDisplay += ` (แผนที่: https://www.google.com/maps?q=${lat},${lng})`;
  }

  sheet.appendRow([
    logId,
    cleanSid,
    data.studentName || '',
    data.grade || '',
    prayerNameThai,
    timestamp,
    dateStr,
    timeStr,
    lat,
    lng,
    locationDisplay,
    data.distanceMeters || 0,
    withinZoneThai,
    photoRef,
    statusThai,
    data.note || ''
  ]);
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 2).setNumberFormat('@').setValue(cleanSid);

  return { success: true, message: 'บันทึกการละหมาดเวลา ' + prayerNameThai + ' สำเร็จแล้ว', logId: logId, photoUrl: photoRef };
}

function deletePrayerRecord(data) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PRAYERS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานบันทึกเวลาละหมาด' };

  const targetLogId = cleanVal(data.logId || data.id || '');
  const targetSid = cleanVal(data.studentId || '');
  const targetTimestamp = cleanVal(data.timestamp || '');
  const targetDate = formatSheetDate(data.date || '');
  const targetPrayer = formatPrayerTimeThai(data.prayerTime || data.prayerName || '');

  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    const rLogId = cleanVal(rows[i][0]);
    const rSid = cleanVal(rows[i][1]);
    const rPt = formatPrayerTimeThai(rows[i][4]);
    const rTs = cleanVal(rows[i][5]);
    const rDate = formatSheetDate(rows[i][6]);

    const matchById = targetLogId && rLogId === targetLogId;
    const matchByTs = targetSid && targetTimestamp && isCodeMatch(rSid, targetSid) && rTs === targetTimestamp;
    const matchByDatePt = targetSid && targetDate && targetPrayer && isCodeMatch(rSid, targetSid) && rDate === targetDate && rPt === targetPrayer;

    if (matchById || matchByTs || matchByDatePt) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'ลบบันทึกเวลาละหมาดเรียบร้อยแล้ว' };
    }
  }
  return { success: false, message: 'ไม่พบรายการละหมาดที่ต้องการลบ' };
}

/** แก้ไขบันทึกละหมาด (เวลาละหมาด วันที่ เวลา สถานะ หมายเหตุ) พร้อมบันทึกว่าใครแก้ไข */
function updatePrayerRecord_(data, session) {
  data = data || {};
  ensureSchema();
  const sheet = getSpreadsheet().getSheetByName(SHEETS.PRAYERS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานบันทึกเวลาละหมาด' };
  const logId = cleanVal(data.logId || data.id || '');
  if (!logId) return { success: false, message: 'ไม่พบรหัสรายการ' };
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) {}
  try {
    const n = sheet.getLastRow();
    if (n < 2) return { success: false, message: 'ไม่พบรายการละหมาดที่ต้องการแก้ไข' };
    const ids = sheet.getRange(2, 1, n - 1, 1).getValues();
    let row = -1;
    for (let i = ids.length - 1; i >= 0; i--) { if (cleanVal(ids[i][0]) === logId) { row = i + 2; break; } }
    if (row === -1) return { success: false, message: 'ไม่พบรายการละหมาดที่ต้องการแก้ไข (อาจถูกลบไปแล้ว)' };
    const cur = sheet.getRange(row, 1, 1, 16).getValues()[0];
    const pt = data.prayerTime ? formatPrayerTimeThai(data.prayerTime) : cur[4];
    const date = data.date ? formatSheetDate(data.date) : formatSheetDate(cur[6]);
    if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, message: 'วันที่ไม่ถูกต้อง' };
    let time = data.time ? String(data.time).trim() : formatSheetTime(cur[7]);
    if (data.time) { if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(time)) return { success: false, message: 'เวลาไม่ถูกต้อง' }; if (time.length <= 5) time = ('0' + time).slice(-5) + ':00'; }
    const status = data.status ? formatStatusThai(data.status) : cur[14];
    let note = data.note !== undefined ? String(data.note).slice(0, 300) : String(cur[15] || '');
    note = note.replace(/\s*\[แก้ไขโดย [^\]]*\]\s*$/, '');
    const who = (session && (session.name || session.userId)) || 'แอดมิน';
    note = (note ? note + ' ' : '') + '[แก้ไขโดย ' + who + ' ' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM HH:mm') + ']';
    sheet.getRange(row, 5).setValue(pt);
    sheet.getRange(row, 7, 1, 2).setNumberFormat('@').setValues([[date, time]]);
    sheet.getRange(row, 15, 1, 2).setValues([[status, note]]);
    return { success: true, message: 'แก้ไขบันทึกละหมาดแล้ว', record: { logId: logId, studentId: cleanVal(cur[1]), prayerTime: pt, date: date, time: time, status: status, note: note } };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

/* ===================== v17.26 · ลงทะเบียนรายวิชา (อาจารย์เปิด QR/ลิงก์ · นักเรียนสแกนหรือดึงจากระบบ) =====================
   Settings: EnrollCodes = { subjectId: { code, open, name, by, byName } } · Enrollments = { subjectId: { sid: [at, via] } } */
function enrollRead_(key) { let v = {}; try { v = JSON.parse((getSettings().data || {})[key] || '{}') || {}; } catch (e) { v = {}; } return (v && typeof v === 'object') ? v : {}; }
function enrollWrite_(key, v) { saveSetting({ key: key, value: JSON.stringify(v), description: key === 'EnrollCodes' ? 'รหัสลงทะเบียนรายวิชา (JSON)' : 'นักเรียนที่ลงทะเบียนรายวิชา (JSON)' }); }
const ENROLL_NORM_ = function (v) { return String(cleanVal(v)).replace(/\D/g, '').replace(/^0+/, ''); };
function enrollLock_(fn) { const l = LockService.getScriptLock(); try { l.waitLock(10000); } catch (e) { return { success: false, message: 'ระบบกำลังบันทึก ลองใหม่อีกครั้ง' }; } try { return fn(); } finally { try { l.releaseLock(); } catch (e) {} } }
function enrollIdsBySubject_() { const e = enrollRead_('Enrollments'); const out = {}; Object.keys(e).forEach(function (k) { out[k] = Object.keys(e[k] || {}); }); return out; }
function enrollStudents_(subjectId) {
  const e = enrollRead_('Enrollments')[subjectId] || {};
  const info = {}; sheetRows_(SHEETS.STUDENTS, 4).forEach(function (r) { const k = ENROLL_NORM_(r[0]); if (k) info[k] = { id: cleanVal(r[0]), name: cleanVal(r[1]), grade: cleanVal(r[3]) }; });
  return Object.keys(e).map(function (sid) { const i = info[sid] || { id: sid, name: sid, grade: '' }; return { studentId: i.id, fullName: i.name, grade: i.grade, at: (e[sid] || [])[0] || '', via: (e[sid] || [])[1] || '', reason: (e[sid] || [])[2] || '' }; })
    .sort(function (a, b) { return String(a.grade).localeCompare(String(b.grade)) || String(a.fullName).localeCompare(String(b.fullName)); });
}
function getEnrollRoom_(d, session) {
  d = d || {}; const sid = cleanVal(d.subjectId || '').substring(0, 60); if (!sid) return { success: false, message: 'เลือกวิชาก่อน' };
  const res = enrollLock_(function () {
    const codes = enrollRead_('EnrollCodes');
    let c = codes[sid];
    if (!c || !c.code) {
      const used = {}; Object.keys(codes).forEach(function (k) { if (codes[k] && codes[k].code) used[codes[k].code] = 1; });
      const AL = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let code = '';
      do { code = ''; for (let i = 0; i < 6; i++) code += AL.charAt(Math.floor(Math.random() * AL.length)); } while (used[code]);
      c = codes[sid] = { code: code, open: true, name: cleanVal(d.subjectName || sid).substring(0, 80), by: session.userId, byName: cleanVal(session.name || session.userId) };
      enrollWrite_('EnrollCodes', codes);
    } else if (d.subjectName && c.name !== d.subjectName) { c.name = cleanVal(d.subjectName).substring(0, 80); enrollWrite_('EnrollCodes', codes); }
    return { success: true, code: c.code, open: c.open !== false, name: c.name };
  });
  if (res.success) res.students = enrollStudents_(sid);
  return res;
}
function setEnrollOpen_(d) {
  const sid = cleanVal((d || {}).subjectId || '');
  return enrollLock_(function () { const codes = enrollRead_('EnrollCodes'); if (!codes[sid]) return { success: false, message: 'ยังไม่ได้เปิดลงทะเบียนวิชานี้' }; codes[sid].open = !!d.open; enrollWrite_('EnrollCodes', codes); return { success: true, open: codes[sid].open, message: codes[sid].open ? 'เปิดรับลงทะเบียนแล้ว' : 'ปิดรับลงทะเบียนแล้ว' }; });
}
function removeEnrollment_(d) {
  const sid = cleanVal((d || {}).subjectId || ''), st = ENROLL_NORM_((d || {}).studentId);
  const r = enrollLock_(function () { const e = enrollRead_('Enrollments'); if (e[sid] && e[sid][st]) { delete e[sid][st]; enrollWrite_('Enrollments', e); } return { success: true, message: 'นำออกจากรายวิชาแล้ว' }; });
  if (r.success) r.students = enrollStudents_(sid);
  return r;
}
function enrollSubjectsAll_() {
  let subjects = []; try { subjects = JSON.parse((getSettings().data || {}).AppSubjects || '[]') || []; } catch (e) {}
  return subjects.map(function (x) { return { id: cleanVal(x.id || x.code || x.name), name: cleanVal(x.name || x.id) }; }).filter(function (x) { return x.id; });
}
function getMyEnrollments_(studentId) {
  const me = ENROLL_NORM_(studentId); const e = enrollRead_('Enrollments'); const codes = enrollRead_('EnrollCodes');
  const all = enrollSubjectsAll_(); const nameOf = {}; all.forEach(function (x) { nameOf[x.id] = x.name; });
  const enrolled = Object.keys(e).filter(function (k) { return e[k] && e[k][me]; }).map(function (k) { return { subjectId: k, name: (codes[k] && codes[k].name) || nameOf[k] || k, teacher: (codes[k] && codes[k].byName) || '', at: e[k][me][0], via: e[k][me][1], reason: e[k][me][2] || '' }; });
  const mine = getMySubjects_(studentId).subjects;
  const sys = (mine || []).map(function (t) { const m = all.find(function (x) { return (t.id && x.id === t.id) || x.name === t.name; }); return { id: m ? m.id : (t.id || t.name), name: t.name }; });
  return { success: true, enrolled: enrolled, available: mine ? sys : [], fromTimetable: !!mine };
}
function enrollSubject_(d, studentId) {
  d = d || {}; const me = ENROLL_NORM_(studentId);
  const codes = enrollRead_('EnrollCodes');
  let list = [], via = 'system';
  if (d.code) {
    const code = String(d.code).toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 12);
    const subj = Object.keys(codes).find(function (k) { return codes[k] && codes[k].code === code; });
    if (!subj) return { success: false, message: 'ไม่พบรหัสลงทะเบียนนี้ · ตรวจสอบกับอาจารย์อีกครั้ง' };
    if (codes[subj].open === false) return { success: false, message: 'อาจารย์ปิดรับลงทะเบียนวิชานี้แล้ว' };
    list = [subj]; via = 'qr';
    // v17.60 · สแกนวิชาที่มีอยู่แล้ว → แจ้งเตือนนักเรียน (ไม่ลงซ้ำ)
    const eNow = enrollRead_('Enrollments');
    const nmQ = codes[subj].name || subj;
    // v17.61 · เรียนซ้ำชั้น / แก้เกรด: ลงทะเบียนวิชาเดิมได้ โดยบันทึกเหตุผลไว้ให้อาจารย์เห็น
    const why = ({ repeat: 'repeat', regrade: 'regrade' })[cleanVal(d.retake || '')] || '';
    if (why) {
      const now2 = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
      const rr = enrollLock_(function () { const e2 = enrollRead_('Enrollments'); e2[subj] = e2[subj] || {}; e2[subj][me] = [now2, 'qr', why]; enrollWrite_('Enrollments', e2); return { success: true }; });
      if (!rr.success) return rr;
      const o2 = getMyEnrollments_(studentId); o2.message = 'ลงทะเบียนวิชา ' + nmQ + ' เพื่อ' + (why === 'repeat' ? 'เรียนซ้ำชั้น' : 'แก้เกรด') + 'แล้ว'; return o2;
    }
    const dupWarn = function (msg) { const o = getMyEnrollments_(studentId); o.warn = true; o.canRetake = true; o.code = codes[subj].code; o.subjectName = nmQ; o.message = msg; return o; };
    if (eNow[subj] && eNow[subj][me]) return dupWarn('คุณลงทะเบียนวิชา ' + nmQ + ' ไว้แล้ว');
    const mineQ = getMySubjects_(studentId).subjects || [];
    const inTt = mineQ.some(function (t) { return (t.id && t.id === subj) || cleanVal(t.name) === cleanVal(nmQ); });
    if (inTt) { d.__warnTt = 'วิชา ' + nmQ + ' มีอยู่ในตารางเรียนของคุณแล้ว · บันทึกการลงทะเบียนให้อาจารย์แล้ว'; d.__code = codes[subj].code; d.__nm = nmQ; }
  } else {
    return { success: false, message: 'ลงทะเบียนรายวิชาได้เฉพาะการสแกน QR Code หรือรหัสของอาจารย์' }; // v18.10 · ยกเลิก "ดึงจากระบบ"
    const want = (Array.isArray(d.subjectIds) ? d.subjectIds : [d.subjectId]).map(function (x) { return cleanVal(x); }).filter(Boolean);
    const mine = getMySubjects_(studentId).subjects;
    const okIds = {}; (mine ? getMyEnrollments_(studentId).available : []).forEach(function (x) { okIds[x.id] = 1; }); // v17.60 · ลงทะเบียนจากระบบได้เฉพาะวิชาในตารางเรียน
    list = want.filter(function (x) { return okIds[x]; });
    if (!list.length) return { success: false, message: mine ? 'ไม่พบวิชาที่ลงทะเบียนได้จากระบบ' : 'ยังไม่มีวิชาในตารางเรียนของคุณ · รอแอดมินจัดตารางเรียนก่อน' };
  }
  const now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
  const r = enrollLock_(function () {
    const e = enrollRead_('Enrollments'); let added = 0;
    list.forEach(function (sj) { e[sj] = e[sj] || {}; if (!e[sj][me]) { e[sj][me] = [now, via]; added++; } });
    if (added) enrollWrite_('Enrollments', e);
    return { success: true, added: added };
  });
  if (!r.success) return r;
  const out = getMyEnrollments_(studentId);
  const nm = list.map(function (k) { return (codes[k] && codes[k].name) || (out.enrolled.find(function (x) { return x.subjectId === k; }) || {}).name || k; });
  out.message = r.added ? 'ลงทะเบียนแล้ว: ' + nm.join(', ') : 'ลงทะเบียนวิชานี้ไว้แล้ว';
  if (d.__warnTt) { out.warn = true; out.canRetake = true; out.code = d.__code; out.subjectName = d.__nm; out.message = d.__warnTt; }
  else if (!r.added) out.warn = true;
  return out;
}

/* ===================== v17.11 · ลาสอน (อาจารย์แจ้งลา · ท่านอื่นรับสอนแทน) =====================
   เก็บใน Settings คีย์ TeacherLeaves (JSON) · ลบรายการที่เก่ากว่า 60 วันอัตโนมัติ */
// =====================================================================
//  🔁 v17.94 · สลับคาบระหว่างอาจารย์ (ชั่วคราว: วันเดียวหรือช่วงวันที่) · ขอ → อีกฝ่ายตอบรับ → ใช้ในตารางชั่วคราว
// =====================================================================
// =====================================================================
//  🏅 v17.95 · แฟ้มสะสมผลงาน: กิจกรรมที่เข้าร่วม + เกียรติบัตรที่อาจารย์สแกนเก็บให้
// =====================================================================
const PF_SHEET_ = 'ผลงานนักเรียน';
const PF_HEAD_ = ['รหัส', 'รหัสนักเรียน', 'ชื่อนักเรียน', 'ระดับชั้น', 'ชื่อผลงาน/เกียรติบัตร', 'ประเภท', 'ระดับ', 'วันที่', 'รางวัล', 'ไฟล์ (ลิงก์)', 'หมายเหตุ', 'ผู้บันทึก', 'ชื่อผู้บันทึก', 'บันทึกเมื่อ', 'สถานะ'];
const PF_CATS_ = ['academic', 'sport', 'religion', 'art', 'virtue', 'volunteer', 'other'];
const PF_LEVELS_ = ['school', 'district', 'province', 'region', 'nation', 'intl'];
function pfSheet_() { const ss = getSpreadsheet(); let sh = ss.getSheetByName(PF_SHEET_); if (!sh) { sh = ss.insertSheet(PF_SHEET_); sh.getRange(1, 1, 1, PF_HEAD_.length).setValues([PF_HEAD_]).setFontWeight('bold').setBackground('#0369a1').setFontColor('#ffffff'); sh.setFrozenRows(1); } return sh; }
function pfRows_() { const sh = pfSheet_(); if (sh.getLastRow() < 2) return []; return sh.getRange(2, 1, sh.getLastRow() - 1, PF_HEAD_.length).getValues().filter(function (r) { return cleanVal(r[0]) && cleanVal(r[14]) !== 'deleted'; }).map(function (r) {
  return { id: cleanVal(r[0]), studentId: cleanVal(r[1]), studentName: cleanVal(r[2]), grade: cleanVal(r[3]), title: cleanVal(r[4]), cat: cleanVal(r[5]) || 'other', level: cleanVal(r[6]) || 'school', date: normalizeDateStr_(r[7]) || cleanVal(r[7]), award: cleanVal(r[8]), files: String(r[9] || '').split(/\s*\n\s*/).filter(Boolean), note: cleanVal(r[10]), by: cleanVal(r[11]), byName: cleanVal(r[12]), createdAt: cleanVal(r[13]) }; }); }
function addPortfolio_(d, session) {
  d = d || {};
  const title = cleanVal(d.title).substring(0, 160); if (!title) return { success: false, message: 'กรุณาใส่ชื่อผลงาน/เกียรติบัตร' };
  const ids = (Array.isArray(d.studentIds) ? d.studentIds : []).map(cleanVal).filter(Boolean).slice(0, 300);
  if (!ids.length) return { success: false, message: 'เลือกนักเรียนอย่างน้อย 1 คน' };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(cleanVal(d.date)) ? cleanVal(d.date) : Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const cat = PF_CATS_.indexOf(cleanVal(d.cat)) !== -1 ? cleanVal(d.cat) : 'other';
  const level = PF_LEVELS_.indexOf(cleanVal(d.level)) !== -1 ? cleanVal(d.level) : 'school';
  const photos = (Array.isArray(d.photos) ? d.photos : []).slice(0, 4);
  const urls = []; photos.forEach(function (p, i) { const u = savePhotoToDrive_(p && p.data ? p.data : p, 'Khalifah_Portfolio', 'pf_' + Date.now() + '_' + (i + 1)); if (u) urls.push(u); });
  const info = {}; const stu = getSpreadsheet().getSheetByName(SHEETS.STUDENTS);
  if (stu && stu.getLastRow() > 1) stu.getRange(2, 1, stu.getLastRow() - 1, 4).getValues().forEach(function (r) { info[cleanVal(r[0]).replace(/^0+/, '')] = { id: cleanVal(r[0]), name: cleanVal(r[1]), grade: cleanVal(r[3]) }; });
  const now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  const rows = []; const miss = [];
  ids.forEach(function (sid, i) { const st = info[sid.replace(/^0+/, '')]; if (!st) { miss.push(sid); return; } rows.push(['PF-' + Date.now() + '-' + i, st.id, st.name, st.grade, title, cat, level, date, cleanVal(d.award).substring(0, 120), urls.join('\n'), cleanVal(d.note).substring(0, 300), session.userId, cleanVal(session.name || session.userId), now, 'active']); });
  if (!rows.length) return { success: false, message: 'ไม่พบนักเรียนที่เลือก' };
  const sh = pfSheet_(); const nr = sh.getLastRow() + 1;
  sh.getRange(nr, 2, rows.length, 1).setNumberFormat('@'); sh.getRange(nr, 1, rows.length, PF_HEAD_.length).setValues(rows);
  return { success: true, added: rows.length, files: urls.length, missing: miss, message: 'เก็บผลงาน "' + title + '" ให้นักเรียน ' + rows.length + ' คนแล้ว' + (urls.length ? ' · รูป ' + urls.length + ' รูป' : '') };
}
function deletePortfolio_(id, session) {
  const sh = pfSheet_(); if (sh.getLastRow() < 2) return { success: false, message: 'ไม่พบรายการ' };
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 12).getValues();
  for (let i = 0; i < rows.length; i++) if (cleanVal(rows[i][0]) === cleanVal(id)) {
    if (session.role !== 'admin' && cleanVal(rows[i][11]) !== session.userId) return { success: false, code: 'FORBIDDEN', message: 'ลบได้เฉพาะรายการที่คุณบันทึก' };
    sh.getRange(i + 2, 15).setValue('deleted'); return { success: true, message: 'ลบรายการแล้ว' };
  }
  return { success: false, message: 'ไม่พบรายการ' };
}
function myPortfolio_(sid) {
  const items = pfRows_().filter(function (x) { return isCodeMatch(x.studentId, sid); });
  const acts = {}; try { (getActivities().data || []).forEach(function (a) { acts[cleanVal(a.id || a.activityId)] = a; }); } catch (e) {}
  const logs = (getActivityLogs('').data || []).filter(function (l) { return isCodeMatch(l.studentId, sid); }).map(function (l) { const a = acts[l.activityId] || {}; return { activityId: l.activityId, title: a.title || a.name || l.activityTitle || 'กิจกรรม', date: l.formattedDate, time: l.formattedTime, location: a.location || '', organizer: a.creator || a.createdBy || '' }; });
  const seen = {}; const activities = logs.filter(function (x) { const k = x.activityId + '|' + x.date; if (seen[k]) return false; seen[k] = 1; return true; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  return { success: true, items: items.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }), activities: activities };
}
// v17.98 · หอพักนักเรียน (หญิง: อิบนูอัฟฟาน / หอ 5 · ชายทั้งหมด: หอคณะวิทยาศาสตร์ฯ อัตโนมัติ)
const DORMS_ = ['sci', 'ibnu', 'h5'];
function dormKey_(id) { return String(id == null ? '' : id).trim().replace(/^0+/, ''); }
function readDorms_() { let v = {}; try { v = JSON.parse((getSettings().data || {}).StudentDorms || '{}'); } catch (e) { v = {}; } return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
function setStudentDorm_(d) {
  d = d || {};
  const items = Array.isArray(d.items) ? d.items : [{ studentId: d.studentId, dorm: d.dorm }];
  const dm = readDorms_();
  let n = 0;
  items.forEach(function (it) {
    const k = dormKey_(it && it.studentId); if (!k) return;
    const v = String((it && it.dorm) || '');
    if (!v) { delete dm[k]; n++; return; }
    if (DORMS_.indexOf(v) === -1) return;
    dm[k] = v; n++;
  });
  saveSetting({ key: 'StudentDorms', value: JSON.stringify(dm), description: 'หอพักนักเรียน (JSON: รหัส → sci/ibnu/h5)' });
  return { success: true, message: 'บันทึกหอพักแล้ว ' + n + ' คน', data: dm };
}
// v18.08 · นักเรียนแจ้งลาเรียน (วันเดียว/ช่วงวัน · ทั้งวัน/ช่วงเวลา) → แอดมินอนุมัติ → อาจารย์เห็นตอนเช็คชื่อ
function slKey_(v) { return String(v == null ? '' : v).trim().replace(/^0+/, ''); }
function readStuLeaves_() { let v = []; try { v = JSON.parse((getSettings().data || {}).StudentLeaves || '[]'); } catch (e) { v = []; } return Array.isArray(v) ? v : []; }
function writeStuLeaves_(list) {
  const cut = Utilities.formatDate(new Date(Date.now() - 120 * 864e5), 'Asia/Bangkok', 'yyyy-MM-dd');
  list = list.filter(function (x) { return x && String(x.to) >= cut; }).slice(-800);
  saveSetting({ key: 'StudentLeaves', value: JSON.stringify(list), description: 'คำขอลาเรียนของนักเรียน (JSON)' });
  return list;
}
const SL_TYPES_ = ['ป่วย', 'ลากิจ', 'กลับบ้าน', 'กิจกรรมนอกโรงเรียน', 'อื่น ๆ'];
function requestStudentLeave_(d, session) {
  d = d || {};
  const from = cleanVal(d.from), to = cleanVal(d.to || d.from);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return { success: false, message: 'เลือกวันที่ลาให้ถูกต้อง' };
  const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  if (to < today) return { success: false, message: 'วันที่ลาผ่านไปแล้ว' };
  const allDay = d.allDay !== false && String(d.allDay) !== 'false';
  const tFrom = allDay ? '' : cleanVal(d.tFrom), tTo = allDay ? '' : cleanVal(d.tTo);
  if (!allDay && (!/^\d{2}:\d{2}$/.test(tFrom) || !/^\d{2}:\d{2}$/.test(tTo) || tTo <= tFrom)) return { success: false, message: 'เลือกช่วงเวลาให้ถูกต้อง' };
  const type = SL_TYPES_.indexOf(cleanVal(d.type)) !== -1 ? cleanVal(d.type) : 'อื่น ๆ';
  const where = cleanVal(d.where).substring(0, 120), reason = cleanVal(d.reason).substring(0, 300);
  if (!reason && type === 'อื่น ๆ') return { success: false, message: 'เลือก "อื่น ๆ" ต้องกรอกรายละเอียดด้วย' }; // v18.23 · รายละเอียดบังคับเฉพาะ "อื่น ๆ"
  const sid = String(session.userId), g = studentGradeNum_(sid);
  let name = cleanVal(session.name || ''), grade = '';
  try { const rows = sheetRows_(SHEETS.STUDENTS, 4); for (let i = 0; i < rows.length; i++) if (slKey_(rows[i][0]) === slKey_(sid)) { name = cleanVal(rows[i][1]) || name; grade = cleanVal(rows[i][3]); break; } } catch (e) {}
  const item = { id: 'SL' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), sid: sid, name: name || sid, grade: grade || (g.grade ? 'ม.' + g.grade : ''), from: from, to: to, allDay: allDay, tFrom: tFrom, tTo: tTo, type: type, where: where, reason: reason, status: 'pending', createdAt: new Date().toISOString() };
  const r = leaveLock_(function () {
    const L = readStuLeaves_();
    if (L.some(function (x) { return slKey_(x.sid) === slKey_(sid) && (x.status === 'pending' || x.status === 'approved') && !(x.to < from || x.from > to) && (x.allDay || allDay || !(x.tTo <= tFrom || x.tFrom >= tTo)); })) return { success: false, message: 'มีคำขอลาในช่วงนี้อยู่แล้ว' };
    L.push(item); writeStuLeaves_(L); return { success: true };
  });
  if (!r.success) return r;
  try { sendNotification_({ title: 'คำขอลาเรียน · ' + item.name, body: slTxt_(item) + ' · ' + type + (where ? ' · ไป ' + where : '') + (reason && reason !== type ? ' · ' + reason : '') + ' · อนุมัติได้ที่เมนู "นักเรียน"', audience: 'admins', values: [], expires: to }, { userId: sid, name: item.name }); } catch (e) {}
  return { success: true, item: item, message: 'ส่งคำขอลาแล้ว · รอแอดมินอนุมัติ' };
}
function slTxt_(x) { return (x.from === x.to ? leaveDateTh_(x.from) : leaveDateTh_(x.from) + ' ถึง ' + leaveDateTh_(x.to)) + (x.allDay ? ' (ทั้งวัน)' : ' เวลา ' + x.tFrom + '–' + x.tTo + ' น.'); }
function cancelStudentLeave_(id, session) {
  id = cleanVal(id);
  return leaveLock_(function () {
    const L = readStuLeaves_(); const it = L.filter(function (x) { return x.id === id; })[0];
    if (!it) return { success: false, message: 'ไม่พบคำขอนี้' };
    if (slKey_(it.sid) !== slKey_(session.userId)) return { success: false, code: 'FORBIDDEN', message: 'ยกเลิกได้เฉพาะคำขอของตัวเอง' };
    if (it.status !== 'pending' && it.status !== 'approved') return { success: false, message: 'คำขอนี้ปิดไปแล้ว' };
    const was = it.status; it.status = 'cancelled'; it.at = new Date().toISOString(); it.by = 'นักเรียน (' + (it.name || it.sid) + ')'; it.note = ''; writeStuLeaves_(L);
    // v18.23 · ยกเลิกคำขอที่อนุมัติแล้ว → แจ้งแอดมินให้ทราบ
    if (was === 'approved') { try { sendNotification_({ title: 'นักเรียนยกเลิกการลา · ' + it.name, body: slTxt_(it) + ' · ' + it.type, audience: 'admins', values: [], expires: it.to }, { userId: session.userId, name: it.name }); } catch (e) {} }
    return { success: true, message: 'ยกเลิกคำขอลาแล้ว' };
  });
}
function respondStudentLeave_(d, session) {
  d = d || {}; const id = cleanVal(d.id); const act = cleanVal(d.action);
  if (['approve', 'reject', 'revoke'].indexOf(act) === -1) return { success: false, message: 'คำสั่งไม่ถูกต้อง' }; // v18.23
  let it = null;
  const r = leaveLock_(function () {
    const L = readStuLeaves_(); it = L.filter(function (x) { return x.id === id; })[0];
    if (!it) return { success: false, message: 'ไม่พบคำขอนี้' };
    if (act === 'revoke') { if (it.status !== 'approved') return { success: false, message: 'ยกเลิกได้เฉพาะคำขอที่อนุมัติแล้ว' }; it.status = 'cancelled'; }
    else { if (it.status !== 'pending') return { success: false, message: 'คำขอนี้พิจารณาไปแล้ว' }; it.status = act === 'approve' ? 'approved' : 'rejected'; }
    it.by = cleanVal(session.name || session.userId); it.at = new Date().toISOString(); it.note = cleanVal(d.note || '').substring(0, 200);
    writeStuLeaves_(L); return { success: true };
  });
  if (!r.success) return r;
  const msg = it.status === 'approved' ? 'อนุมัติการลาแล้ว' : it.status === 'rejected' ? 'ไม่อนุมัติการลา' : 'ยกเลิกการลาแล้ว';
  try { sendNotification_({ title: msg, body: slTxt_(it) + ' · ' + it.type + (it.note ? ' · หมายเหตุ: ' + it.note : '') + ' · โดย ' + it.by, audience: 'students', values: [it.sid], expires: it.to }, { userId: session.userId, name: it.by }); } catch (e) {}
  return { success: true, item: it, message: msg + ' · ' + it.name };
}
function readSwaps_() { let v = []; try { v = JSON.parse((getSettings().data || {}).PeriodSwaps || '[]'); } catch (e) { v = []; } return Array.isArray(v) ? v : []; }
function writeSwaps_(list) {
  const cut = Utilities.formatDate(new Date(Date.now() - 90 * 864e5), 'Asia/Bangkok', 'yyyy-MM-dd');
  list = list.filter(function (x) { return x && String(x.to) >= cut; }).slice(-300);
  saveSetting({ key: 'PeriodSwaps', value: JSON.stringify(list), description: 'สลับคาบระหว่างอาจารย์ (JSON)' });
  return list;
}
// v18.06 · สลับคาบข้ามชั้น/ข้ามวันได้: คาบ A (ของผู้ขอ: gA/dowA) ⇄ คาบ B (อาจารย์อีกท่าน: gB/dowB)
//   ชั้นเดียวกัน → นักเรียนเรียนสลับวิชากัน · ต่างชั้น → สอนแทนกัน (B สอนคาบ A, A สอนคาบ B)
//   วันที่ from/to เป็นของคาบ A · คาบ B = วันเดียวกันในสัปดาห์เดียวกัน (เลื่อน off วัน)
function swapNorm_(x) { const gB = x.gB || x.grade, dB = (x.dowB === 0 || x.dowB) ? Number(x.dowB) : Number(x.dow); return { gA: String(x.grade), dA: Number(x.dow), gB: String(gB), dB: dB, off: dB - Number(x.dow) }; }
function swapAdd_(ds, n) { const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + n); return Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd'); }
function swapTxt_(x) { const n = swapNorm_(x); const d = x.from === x.to ? leaveDateTh_(x.from) : leaveDateTh_(x.from) + ' ถึง ' + leaveDateTh_(x.to) + ' (ทุกวัน' + LEAVE_DAYN_[n.dA] + ')';
  if (n.gA === n.gB && n.dA === n.dB) return d + ' · ม.' + x.grade + ' · คาบ ' + x.pA + ' ' + (x.snA || '') + ' ⇄ คาบ ' + x.pB + ' ' + (x.snB || '');
  return d + ' · ม.' + n.gA + ' วัน' + LEAVE_DAYN_[n.dA] + ' คาบ ' + x.pA + ' ' + (x.snA || '') + ' ⇄ ม.' + n.gB + ' วัน' + LEAVE_DAYN_[n.dB] + ' คาบ ' + x.pB + ' ' + (x.snB || ''); }
function requestPeriodSwap_(d, session) {
  d = d || {};
  const from = cleanVal(d.from), to = cleanVal(d.to || d.from);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return { success: false, message: 'เลือกวันที่ให้ถูกต้อง' };
  const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const g = cleanVal(d.grade).replace(/\D/g, ''); const pA = Number(d.pA), pB = Number(d.pB);
  const dow = new Date(from + 'T00:00:00').getDay();
  const gB = cleanVal(d.gradeB || d.grade).replace(/\D/g, '');
  const dowB = (d.dowB === 0 || d.dowB) && String(d.dowB) !== '' ? Number(d.dowB) : dow;
  if (!/^[1-6]$/.test(g) || !/^[1-6]$/.test(gB) || !(dowB >= 0 && dowB <= 6) || !(pA >= 1 && pA <= 12) || !(pB >= 1 && pB <= 12) || (g === gB && dow === dowB && pA === pB)) return { success: false, message: 'เลือกคาบของตัวเองและคาบที่ต้องการสลับ' };
  const off = dowB - dow;
  if (from < today || swapAdd_(from, off) < today) return { success: false, message: 'วันที่ของคาบใดคาบหนึ่งผ่านไปแล้ว · เลือกสัปดาห์ถัดไป' };
  const ttOf = function (gg) { let tt = null; try { tt = JSON.parse((getSettings().data || {})['Timetable_M' + gg] || 'null'); } catch (e) {} return tt; };
  const ttA = ttOf(g), ttB = gB === g ? ttA : ttOf(gB);
  const cell = function (tt, dw, p) { const v = tt && tt.cells ? tt.cells[dw + '-' + p] : null; return Array.isArray(v) ? v : v ? [v] : []; };
  const me = String(session.userId);
  const a = cell(ttA, dow, pA).filter(function (e) { return String(e.t || '') === me; })[0];
  if (!a && session.role !== 'admin') return { success: false, message: 'คาบ ' + pA + ' วัน' + LEAVE_DAYN_[dow] + ' ม.' + g + ' ไม่ใช่คาบที่คุณสอน' };
  const b = cell(ttB, dowB, pB).filter(function (e) { return e.t && String(e.t) !== me && (!d.toTeacher || String(e.t) === cleanVal(d.toTeacher)); })[0];
  if (!b) return { success: false, message: 'คาบ ' + pB + ' วัน' + LEAVE_DAYN_[dowB] + ' ม.' + gB + ' ไม่มีอาจารย์ท่านอื่นสอน' };
  const item = { id: 'SW' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), grade: g, dow: dow, gB: gB, dowB: dowB, from: from, to: to,
    pA: pA, sA: a ? a.s || '' : '', snA: a ? a.sn || '' : '', tA: me, tnA: cleanVal(session.name || me),
    pB: pB, sB: b.s || '', snB: b.sn || '', tB: String(b.t), tnB: cleanVal(b.tn || b.t),
    note: cleanVal(d.note || '').substring(0, 160), status: 'pending', createdAt: new Date().toISOString() };
  const slotsOf = function (x) { const n = swapNorm_(x); return [[n.gA, n.dA, Number(x.pA), x.from, x.to], [n.gB, n.dB, Number(x.pB), swapAdd_(x.from, n.off), swapAdd_(x.to, n.off)]]; };
  const mine = slotsOf(item);
  const lock = LockService.getScriptLock(); try { lock.waitLock(10000); } catch (e) { return { success: false, message: 'ระบบกำลังบันทึก ลองใหม่อีกครั้ง' }; }
  try {
    const list = readSwaps_();
    const clash = list.some(function (x) { if (x.status === 'rejected' || x.status === 'cancelled') return false; return slotsOf(x).some(function (s1) { return mine.some(function (s2) { return s1[0] === s2[0] && s1[1] === s2[1] && s1[2] === s2[2] && !(s1[4] < s2[3] || s1[3] > s2[4]); }); }); });
    if (clash) return { success: false, message: 'คาบนี้มีคำขอสลับในช่วงวันที่นี้อยู่แล้ว' };
    list.push(item); writeSwaps_(list);
  } finally { lock.releaseLock(); }
  try { sendNotification_({ title: 'คำขอสลับคาบจาก ' + item.tnA, body: swapTxt_(item) + (item.note ? ' · ' + item.note : '') + ' · เปิดเมนู "สลับคาบ" เพื่อตอบรับ', audience: 'users', values: [item.tB], expires: item.to }, { userId: session.userId, name: item.tnA }); } catch (e) {}
  return { success: true, item: item, message: 'ส่งคำขอสลับคาบถึง ' + item.tnB + ' แล้ว' };
}
function respondPeriodSwap_(d, session) {
  d = d || {}; const id = cleanVal(d.id); const act = cleanVal(d.action);
  const lock = LockService.getScriptLock(); try { lock.waitLock(10000); } catch (e) { return { success: false, message: 'ระบบกำลังบันทึก ลองใหม่อีกครั้ง' }; }
  let it = null;
  try {
    const list = readSwaps_(); it = list.filter(function (x) { return x.id === id; })[0];
    if (!it) return { success: false, message: 'ไม่พบคำขอนี้' };
    const isAdm = session.role === 'admin', me = String(session.userId);
    if (act === 'cancel') { if (it.tA !== me && it.tB !== me && !isAdm) return { success: false, code: 'FORBIDDEN', message: 'ยกเลิกได้เฉพาะผู้เกี่ยวข้อง' }; it.status = 'cancelled'; }
    else { if (it.tB !== me && !isAdm) return { success: false, code: 'FORBIDDEN', message: 'ตอบรับได้เฉพาะ ' + it.tnB }; if (it.status !== 'pending') return { success: false, message: 'คำขอนี้ตอบไปแล้ว' }; it.status = act === 'accept' ? 'approved' : 'rejected'; }
    it.by = cleanVal(session.name || me); it.at = new Date().toISOString(); writeSwaps_(list);
  } finally { lock.releaseLock(); }
  const msg = it.status === 'approved' ? 'ตอบรับสลับคาบแล้ว' : it.status === 'rejected' ? 'ปฏิเสธการสลับคาบ' : 'ยกเลิกการสลับคาบแล้ว';
  try { sendNotification_({ title: msg + ' · ' + it.by, body: swapTxt_(it), audience: 'users', values: [it.tA, it.tB].filter(function (u) { return u !== session.userId; }), expires: it.to }, { userId: session.userId, name: it.by }); } catch (e) {}
  if (it.status === 'approved') {
    const n = swapNorm_(it);
    try {
      if (n.gA === n.gB) sendNotification_({ title: 'สลับคาบ ม.' + it.grade + ' · ' + leaveDateTh_(it.from), body: swapTxt_(it) + ' · ' + (it.snB || '') + ' (' + it.tnB + ') ⇄ ' + (it.snA || '') + ' (' + it.tnA + ')', audience: 'grade', values: [it.grade], expires: swapAdd_(it.to, Math.max(0, n.off)) }, { userId: session.userId, name: it.by });
      else {
        sendNotification_({ title: 'สอนแทน ม.' + n.gA + ' · ' + leaveDateTh_(it.from), body: 'คาบ ' + it.pA + ' ' + (it.snA || '') + ' · ' + it.tnB + ' สอนแทน ' + it.tnA + (it.from !== it.to ? ' · ถึง ' + leaveDateTh_(it.to) : ''), audience: 'grade', values: [n.gA], expires: it.to }, { userId: session.userId, name: it.by });
        sendNotification_({ title: 'สอนแทน ม.' + n.gB + ' · ' + leaveDateTh_(swapAdd_(it.from, n.off)), body: 'คาบ ' + it.pB + ' ' + (it.snB || '') + ' · ' + it.tnA + ' สอนแทน ' + it.tnB, audience: 'grade', values: [n.gB], expires: swapAdd_(it.to, n.off) }, { userId: session.userId, name: it.by });
      }
    } catch (e) {}
  }
  return { success: true, item: it, message: msg };
}
function swapsFor_(session) { const L = readSwaps_(); if (session.role === 'admin') return L; const me = String(session.userId); return L.filter(function (x) { return x.tA === me || x.tB === me; }); }
function activeSwaps_() { const cut = Utilities.formatDate(new Date(Date.now() - 14 * 864e5), 'Asia/Bangkok', 'yyyy-MM-dd'); return readSwaps_().filter(function (x) { return x.status === 'approved' && x.to >= cut; }).map(function (x) { const n = swapNorm_(x); return { grade: x.grade, dow: x.dow, gB: n.gB, dowB: n.dB, from: x.from, to: x.to, pA: x.pA, pB: x.pB, tA: x.tA, tB: x.tB, tnA: x.tnA, tnB: x.tnB }; }); }
function readLeaves_() {
  let v = []; try { v = JSON.parse((getSettings().data || {}).TeacherLeaves || '[]'); } catch (e) { v = []; }
  return Array.isArray(v) ? v : [];
}
function writeLeaves_(list) {
  const cut = Utilities.formatDate(new Date(Date.now() - 60 * 864e5), 'Asia/Bangkok', 'yyyy-MM-dd');
  list = list.filter(function (x) { return x && String(x.date) >= cut; }).slice(-400);
  saveSetting({ key: 'TeacherLeaves', value: JSON.stringify(list), description: 'ลาสอนของอาจารย์ (JSON)' });
  return list;
}
function leaveLock_(fn) { const l = LockService.getScriptLock(); try { l.waitLock(10000); } catch (e) { return { success: false, message: 'ระบบกำลังบันทึก ลองใหม่อีกครั้ง' }; } try { return fn(); } finally { try { l.releaseLock(); } catch (e) {} } }
const LEAVE_DAYN_ = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const LEAVE_MON_ = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function leaveDateTh_(ymd) { const d = new Date(ymd + 'T00:00:00'); return isNaN(d) ? ymd : 'วัน' + LEAVE_DAYN_[d.getDay()] + 'ที่ ' + d.getDate() + ' ' + LEAVE_MON_[d.getMonth()] + ' ' + (d.getFullYear() + 543); }
function leaveSummary_(it) {
  const when = it.allDay ? 'ทั้งวัน' : (it.slots && it.slots.length ? it.slots.map(function (x) { return 'คาบ ' + x.p + (x.sn ? ' ' + x.sn : '') + (x.g && !/^(x|hq):/.test(x.g) ? ' ม.' + x.g : '') + (x.subn ? ' (แทน: ' + x.subn + ')' : ''); }).join(', ') : 'คาบ ' + (it.periods || []).join(', ') + (it.subject ? ' · ' + it.subject : '') + (it.grade ? ' · ' + it.grade : ''));
  return leaveDateTh_(it.date) + ' · ' + when;
}
/** อีเมลถึงแอดมิน/ผู้บริหาร (แจ้งเข้ามือถือผ่านแอป Gmail) */
function leaveMailApprovers_(subject, text) {
  const to = {};
  try { (getAdmins().data || []).forEach(function (a) { const e = cleanVal(a.email || ''); if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && cleanVal(a.status || '') !== 'ปิดใช้งาน') to[e.toLowerCase()] = 1; }); } catch (e) {}
  try { const own = Session.getEffectiveUser().getEmail(); if (own) to[own.toLowerCase()] = 1; } catch (e) {}
  const list = Object.keys(to).slice(0, 20); if (!list.length) return 0;
  try {
    MailApp.sendEmail({ to: list.join(','), subject: subject, name: 'KHALIFAH', body: text + '\n\nเปิดแอปเพื่ออนุมัติ: https://khalifah-program.vercel.app' });
    try { logEmail_(list.join(','), subject, true, '', MailApp.getRemainingDailyQuota()); } catch (e) {}
    return list.length;
  } catch (err) { try { logEmail_(list.join(','), subject, false, err.message, ''); } catch (e) {} return 0; }
}
/** นักเรียนที่เรียนในคาบที่อาจารย์ลา (ตามตารางเรียน · เคารพ เฉพาะบางคน/ละเว้น) */
function leaveStudents_(it) {
  const st = (getSettings().data) || {};
  const d = new Date(it.date + 'T00:00:00'); const dow = d.getDay();
  const rows = sheetRows_(SHEETS.STUDENTS, 8).filter(function (r) { return cleanVal(r[0]) && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(r[7])); });
  const byGrade = {}; rows.forEach(function (r) { const m = String(r[3]).match(/([1-6])/); if (m) (byGrade[m[1]] = byGrade[m[1]] || []).push(String(cleanVal(r[0])).replace(/\D/g, '').replace(/^0+/, '')); });
  const out = {};
  (it.slots || []).forEach(function (sl) {
    let cells = null, base = [];
    if (/^hq:/.test(String(sl.g))) { const h = readHalaqah_().filter(function (y) { return 'hq:' + y.id === String(sl.g); })[0]; if (!h) return; (h.members.length ? h.members : [].concat.apply([], (h.grades.length ? h.grades : ['1', '2', '3', '4', '5', '6']).map(function (gg) { return byGrade[gg] || []; }))).forEach(function (id) { if (id) out[String(id).replace(/^0+/, '')] = 1; }); return; }
    if (/^x:/.test(String(sl.g))) { let x = null; try { x = JSON.parse(st['TimetableX_' + String(sl.g).slice(2)] || 'null'); } catch (e) {} if (!x) return; cells = x.cells || {}; base = (x.students || []).slice(); }
    else { let v = null; try { v = JSON.parse(st['Timetable_M' + sl.g] || 'null'); } catch (e) {} cells = (v && v.cells) || {}; base = (byGrade[String(sl.g)] || []).slice(); }
    const list = cells[dow + '-' + sl.p]; const arr = Array.isArray(list) ? list : (list ? [list] : []);
    const e = arr.find(function (c) { return c && ((sl.s && c.s === sl.s) || (sl.sn && c.sn === sl.sn)); }) || arr[0];
    let ids = base;
    if (e && e.o && e.o.length) ids = e.o.slice();
    if (e && e.x && e.x.length) ids = ids.filter(function (id) { return e.x.indexOf(id) === -1; });
    ids.forEach(function (id) { if (id) out[id] = 1; });
  });
  return Object.keys(out);
}
function cleanSlots_(arr) {
  return (Array.isArray(arr) ? arr : []).slice(0, 20).map(function (x) {
    const p = Number(x && x.p); if (!(p >= 1 && p <= 12)) return null;
    const g = cleanVal(x.g || '').substring(0, 40);
    const o = { p: p, g: g, s: cleanVal(x.s || '').substring(0, 40), sn: cleanVal(x.sn || '').substring(0, 80), r: cleanVal(x.r || '').substring(0, 40), t: cleanVal(x.t || '').substring(0, 20) };
    // v18.47 · ผู้สอนแทนรายคาบ (sub = username ในระบบ · subn = ชื่อ · ว่าง sub = อาจารย์ภายนอก/ไม่มีในรายชื่อ)
    const subn = cleanVal(x.subn || '').substring(0, 80); if (subn) { o.subn = subn; const sub = cleanVal(x.sub || '').substring(0, 60); if (sub) o.sub = sub; }
    return o;
  }).filter(Boolean);
}
function saveTeacherLeave_(d, session, isAdmin) {
  d = d || {};
  const date = String(d.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, message: 'เลือกวันที่ลา' };
  const slots = cleanSlots_(d.slots);
  let periods = (Array.isArray(d.periods) ? d.periods : []).map(Number).filter(function (n) { return n >= 1 && n <= 12; });
  if (slots.length) periods = slots.map(function (x) { return x.p; });
  const allDay = !!d.allDay && !slots.length;
  if (!allDay && !periods.length) return { success: false, message: 'เลือกคาบที่ลาอย่างน้อย 1 คาบ หรือเลือกทั้งวัน' };
  let subject = cleanVal(d.subject || '').substring(0, 120);
  if (slots.length) subject = slots.map(function (x) { return x.sn; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; }).join(', ');
  if (!subject) return { success: false, message: 'ระบุวิชา' };
  let grade = cleanVal(d.grade || '').substring(0, 60);
  if (slots.length) grade = slots.map(function (x) { return /^hq:/.test(x.g) ? 'หะละเกาะฮฺ' : /^x:/.test(x.g) ? 'ตารางพิเศษ' : x.g ? 'ม.' + x.g : ''; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ');
  // v18.47 · ประเภทการลา (ลาป่วย/ลากิจ/อื่น ๆ) · "อื่น ๆ" ต้องระบุเหตุผล · ต้องมีผู้สอนแทนทุกคาบ (ฟอร์มใหม่ส่ง needSub)
  const LV_TYPES = ['ลาป่วย', 'ลากิจ', 'อื่น ๆ'];
  const reasonType = LV_TYPES.indexOf(cleanVal(d.reasonType)) !== -1 ? cleanVal(d.reasonType) : '';
  if (d.needSub && !reasonType) return { success: false, message: 'เลือกเหตุผลการลา (ลาป่วย / ลากิจ / อื่น ๆ)' };
  if (reasonType === 'อื่น ๆ' && !cleanVal(d.reason)) return { success: false, message: 'ระบุเหตุผลเมื่อเลือก "อื่น ๆ"' };
  let subNameAll = cleanVal(d.subName || '').substring(0, 80), subIdAll = cleanVal(d.subId || '').substring(0, 60);
  if (slots.some(function (x) { return x.subn; })) {
    const names = slots.map(function (x) { return x.subn || ''; });
    if (d.needSub && names.some(function (n) { return !n; })) return { success: false, message: 'เลือกผู้สอนแทนให้ครบทุกคาบ' };
    const uniq = names.filter(function (v, i, a) { return v && a.indexOf(v) === i; });
    subNameAll = uniq.join(', ').substring(0, 160);
    const ids = slots.map(function (x) { return x.sub || ''; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    subIdAll = ids.length === 1 ? ids[0] : '';
  } else if (d.needSub && !subNameAll) return { success: false, message: 'เลือกผู้สอนแทนก่อนส่งคำขอลา' };
  const res = leaveLock_(function () {
    const list = readLeaves_();
    const id = cleanVal(d.id || '');
    const old = id ? list.find(function (x) { return x.id === id; }) : null;
    if (old && old.teacherId !== session.userId && !isAdmin) return { success: false, code: 'FORBIDDEN', message: 'แก้ไขได้เฉพาะรายการของตัวเอง' };
    // v18.23 · กันลาซ้ำ: วันเดียวกัน คาบทับกัน (หรือทั้งวัน) ของอาจารย์คนเดียวกัน
    const owner = old ? old.teacherId : session.userId;
    const dup = list.find(function (x) { return x.id !== (old && old.id) && x.teacherId === owner && x.date === date && x.status !== 'rejected' && (x.allDay || allDay || (x.periods || []).some(function (p) { return periods.indexOf(Number(p)) !== -1; })); });
    if (dup) return { success: false, message: 'มีคำขอลาสอนวันนี้ในคาบเดียวกันอยู่แล้ว · แก้ไขรายการเดิมแทน' };
    const item = {
      id: old ? old.id : 'LV' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      teacherId: old ? old.teacherId : session.userId, teacherName: old ? old.teacherName : (cleanVal(session.name || session.userId)),
      date: date, allDay: allDay, periods: allDay ? [] : periods.sort(function (a, b) { return a - b; }), slots: slots,
      timeText: cleanVal(d.timeText || '').substring(0, 60), subject: subject, grade: grade,
      reason: cleanVal(d.reason || '').substring(0, 160), reasonType: reasonType,
      subName: subNameAll, subId: subIdAll,
      status: (old && isAdmin && old.status) ? old.status : 'pending', approvedBy: (old && isAdmin) ? (old.approvedBy || '') : '', approvedAt: (old && isAdmin) ? (old.approvedAt || '') : '', note: '',
      createdAt: old ? old.createdAt : new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    const out = old ? list.map(function (x) { return x.id === item.id ? item : x; }) : list.concat([item]);
    return { success: true, message: (old ? 'แก้ไขการลาแล้ว' : 'ส่งคำขอลาสอนแล้ว') + (item.status === 'pending' ? ' · รอแอดมิน/ผู้บริหารอนุมัติ' : ''), item: item, data: writeLeaves_(out), isNew: !old };
  });
  if (res.success && res.item.status === 'pending') {
    const it = res.item, txt = it.teacherName + ' แจ้งลาสอน ' + leaveSummary_(it) + (it.reasonType || it.reason ? ' · เหตุผล: ' + [it.reasonType, it.reason].filter(Boolean).join(' · ') : '') + (it.subName ? ' · สอนแทน: ' + it.subName : ' · ยังไม่มีผู้สอนแทน');
    try { sendNotification_({ title: 'คำขอลาสอน (รออนุมัติ) · ' + it.teacherName, body: txt, audience: 'admins', priority: 'urgent', expires: it.date }, { userId: session.userId, name: it.teacherName }); } catch (e) {}
    res.mailed = leaveMailApprovers_('[KHALIFAH] คำขอลาสอนรออนุมัติ · ' + it.teacherName, txt);
  }
  return res;
}
function approveTeacherLeave_(d, session) {
  d = d || {}; const id = cleanVal(d.id || ''); const ok = !!d.approve; const note = cleanVal(d.note || '').substring(0, 160);
  const res = leaveLock_(function () {
    const list = readLeaves_(); const it = list.find(function (x) { return x.id === id; });
    if (!it) return { success: false, message: 'ไม่พบรายการลานี้' };
    if (it.status === (ok ? 'approved' : 'rejected')) return { success: false, message: ok ? 'รายการนี้อนุมัติไปแล้ว' : 'รายการนี้ไม่อนุมัติไปแล้ว' }; // v18.23 · กันแจ้งเตือนซ้ำ
    it.status = ok ? 'approved' : 'rejected'; it.approvedBy = cleanVal(session.name || session.userId); it.approvedAt = new Date().toISOString(); it.note = note; it.updatedAt = it.approvedAt;
    return { success: true, message: ok ? 'อนุมัติการลาแล้ว · แจ้งนักเรียนที่เรียนคาบนั้นแล้ว' : 'ไม่อนุมัติการลา', item: it, data: writeLeaves_(list) };
  });
  if (!res.success) return res;
  const it = res.item, by = { userId: session.userId, name: it.approvedBy };
  const users = [it.teacherId].concat(it.subId ? [it.subId] : []).concat((it.slots || []).map(function (x) { return x.sub || ''; })).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
  try { sendNotification_({ title: ok ? 'อนุมัติการลาสอนแล้ว' : 'ไม่อนุมัติการลาสอน', body: leaveSummary_(it) + (note ? ' · หมายเหตุ: ' + note : '') + ' · โดย ' + it.approvedBy, audience: 'users', values: users, expires: it.date }, by); } catch (e) {}
  // อีเมลแจ้งอาจารย์ผู้ลา (ถ้ามีอีเมลในระบบ)
  try {
    const t = (getTeachers().data || []).concat(getAdmins().data || []).find(function (x) { return String(x.username || '').toLowerCase() === String(it.teacherId).toLowerCase(); });
    const em = t && cleanVal(t.email || '');
    if (em && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
      const subj = '[KHALIFAH] ' + (ok ? 'อนุมัติการลาสอนแล้ว' : 'ไม่อนุมัติการลาสอน');
      MailApp.sendEmail({ to: em, subject: subj, name: 'KHALIFAH', body: 'เรียน ' + it.teacherName + '\n\n' + (ok ? 'คำขอลาสอนของท่านได้รับการอนุมัติแล้ว' : 'คำขอลาสอนของท่านไม่ได้รับการอนุมัติ') + '\n' + leaveSummary_(it) + (note ? '\nหมายเหตุ: ' + note : '') + '\nโดย ' + it.approvedBy + '\n\nhttps://khalifah-program.vercel.app' });
      try { logEmail_(em, subj, true, '', MailApp.getRemainingDailyQuota()); } catch (e) {}
    }
  } catch (e) {}
  if (ok) {
    const ids = leaveStudents_(it);
    res.notified = ids.length;
    if (ids.length) {
      const per = (it.slots || []).map(function (x) { return 'คาบ ' + x.p + (x.t ? ' (' + x.t + ')' : '') + ' ' + x.sn + (/^(x|hq):/.test(x.g) ? '' : ' ม.' + x.g); }).join('\n');
      try { sendNotification_({ title: 'อาจารย์ลาสอน · ' + it.teacherName, body: leaveDateTh_(it.date) + '\n' + per + '\n' + (it.subName ? 'สอนแทนโดย ' + it.subName : 'รอประกาศผู้สอนแทน / ทำงานที่ได้รับมอบหมาย'), audience: 'students', values: ids, priority: 'urgent', expires: it.date }, by); } catch (e) {}
    }
  }
  return res;
}
function takeTeacherLeave_(d, session) {
  const id = cleanVal((d || {}).id || ''); const undo = !!(d || {}).undo;
  const res = leaveLock_(function () {
    const list = readLeaves_(); const it = list.find(function (x) { return x.id === id; });
    if (!it) return { success: false, message: 'ไม่พบรายการลานี้ (อาจถูกลบแล้ว)' };
    if (it.teacherId === session.userId) return { success: false, message: 'รับสอนแทนตัวเองไม่ได้' };
    if (undo) { if (it.subId !== session.userId) return { success: false, message: 'ยกเลิกได้เฉพาะคนที่รับสอนแทน' }; it.subId = ''; it.subName = ''; }
    else { if (it.subName && it.subId !== session.userId) return { success: false, message: 'มีอาจารย์รับสอนแทนแล้ว: ' + it.subName }; it.subId = session.userId; it.subName = cleanVal(session.name || session.userId); }
    it.updatedAt = new Date().toISOString();
    return { success: true, message: undo ? 'ยกเลิกการรับสอนแทนแล้ว' : 'รับสอนแทนแล้ว ขอบคุณครับ', item: it, data: writeLeaves_(list) };
  });
  const r = res;
  if (r && r.success) { try { sendNotification_({ title: undo ? 'ยกเลิกการรับสอนแทน' : 'มีผู้รับสอนแทนแล้ว', body: leaveSummary_(r.item) + ' · ' + (undo ? cleanVal(session.name || session.userId) + ' ยกเลิกการรับสอน' : 'สอนแทนโดย ' + r.item.subName), audience: 'users', values: [r.item.teacherId], expires: r.item.date }, { userId: session.userId, name: cleanVal(session.name || session.userId) }); } catch (e) {} }
  return r;
}
function deleteTeacherLeave_(d, session, isAdmin) {
  const id = cleanVal((d || {}).id || '');
  return leaveLock_(function () {
    const list = readLeaves_(); const it = list.find(function (x) { return x.id === id; });
    if (!it) return { success: true, data: list };
    if (it.teacherId !== session.userId && !isAdmin) return { success: false, code: 'FORBIDDEN', message: 'ลบได้เฉพาะรายการของตัวเอง' };
    const out = { success: true, message: 'ยกเลิกการลาแล้ว', data: writeLeaves_(list.filter(function (x) { return x.id !== id; })) };
    // v18.23 · ยกเลิกการลาที่อนุมัติแล้ว (ยังไม่ถึงวัน) → แจ้งผู้สอนแทน + นักเรียนที่เคยได้รับแจ้ง
    const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
    if (it.date >= today) {
      const by = { userId: session.userId, name: cleanVal(session.name || session.userId) };
      if (it.subId && it.subId !== session.userId) { try { sendNotification_({ title: 'ยกเลิกการลาสอน · ไม่ต้องสอนแทนแล้ว', body: leaveSummary_(it) + ' · ' + it.teacherName, audience: 'users', values: [it.subId], expires: it.date }, by); } catch (e) {} }
      if (it.status === 'approved') { try { const ids = leaveStudents_(it); if (ids.length) sendNotification_({ title: 'ยกเลิกการลาสอน · ' + it.teacherName, body: leaveDateTh_(it.date) + ' · เรียนตามปกติ', audience: 'students', values: ids, expires: it.date }, by); } catch (e) {} }
      if (it.status === 'pending' && it.teacherId === session.userId) { try { sendNotification_({ title: 'อาจารย์ยกเลิกคำขอลาสอน · ' + it.teacherName, body: leaveSummary_(it), audience: 'admins', values: [], expires: it.date }, by); } catch (e) {} }
    }
    return out;
  });
}

/** v17.10 · ปรับรายการที่เช็คชื่อหลังเวลาสาย (บันทึกเป็น "ตรงเวลา" ก่อนมีเกณฑ์) ให้เป็น "มาสาย" · ไม่แตะรายการที่แอดมินแก้เอง */
function markPrayersLate_(data) {
  const ids = (Array.isArray((data || {}).ids) ? data.ids : []).map(function (x) { return cleanVal(x); }).filter(Boolean).slice(0, 500);
  if (!ids.length) return { success: true, updated: 0 };
  const sheet = getSpreadsheet().getSheetByName(SHEETS.PRAYERS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานบันทึกเวลาละหมาด' };
  const want = {}; ids.forEach(function (i) { want[i] = true; });
  const toOnTime = String((data || {}).status || '') === 'ontime';
  const lock = LockService.getScriptLock(); try { lock.waitLock(10000); } catch (e) {}
  try {
    const n = sheet.getLastRow(); if (n < 2) return { success: true, updated: 0 };
    const rows = sheet.getRange(2, 1, n - 1, 16).getValues();
    let updated = 0;
    for (let i = 0; i < rows.length; i++) {
      const id = cleanVal(rows[i][0]); if (!want[id]) continue;
      const st = String(rows[i][14] || ''), note = String(rows[i][15] || '');
      if (/แก้ไขโดย|เช็คโดย/.test(note)) continue;
      if (toOnTime) {
        if (!/^(มาสาย|สาย)$/.test(st.trim())) continue;
        sheet.getRange(i + 2, 15, 1, 2).setValues([['ตรงเวลา (ญะมาอะฮ์/มัสยิด)', note.replace(/\s*\(ปรับเป็นมาสายตามเกณฑ์เวลา\)/, '') + ' (ปรับเป็นตรงเวลาตามเกณฑ์ใหม่)']]);
      } else {
        if (!/^ตรงเวลา/.test(st)) continue;
        sheet.getRange(i + 2, 15, 1, 2).setValues([['มาสาย', note.replace(/\s*\(ปรับเป็นตรงเวลาตามเกณฑ์ใหม่\)/, '') + ' (ปรับเป็นมาสายตามเกณฑ์เวลา)']]);
      }
      updated++;
    }
    return { success: true, updated: updated };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

/* ===================== เช็คชื่อละหมาดแทนนักเรียน (ทั้งห้อง) =====================
   ใช้กับละหมาดที่นักเรียนบันทึกเองไม่ได้ เช่น ซุบฮิ (โทรศัพท์ถูกเก็บ) · สถานะ: ตรงเวลา / มาสาย / ขาด */
const PRAYER_SLOTS_ = ['ซุบฮิ', 'ซุฮริ', 'อัศรฺ', 'มัฆริบ', 'อีชาอ์'];
function prayerRollKey_(sid, date, slot) { return String(sid).replace(/\D/g, '').replace(/^0+/, '') + '|' + date + '|' + slot; }
function readPrayerRows_(sheet) {
  const n = sheet.getLastRow();
  return n < 2 ? [] : sheet.getRange(2, 1, n - 1, 16).getValues();
}
function getPrayerRoll_(data) {
  data = data || {};
  ensureSchema();
  const date = formatSheetDate(data.date) || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const slot = formatPrayerTimeThai(data.slot || 'ซุบฮิ');
  const sheet = getSpreadsheet().getSheetByName(SHEETS.PRAYERS);
  const marks = {};
  if (sheet) readPrayerRows_(sheet).forEach(function (r) {
    if (formatSheetDate(r[6]) !== date || formatPrayerTimeThai(r[4]) !== slot) return;
    const k = String(r[1]).replace(/\D/g, '').replace(/^0+/, ''); if (!k) return;
    const st = String(r[14] || '');
    marks[k] = { status: /^\s*ลา/.test(st) ? 'leave' : /ขาด/.test(st) ? 'absent' : /สาย/.test(st) ? 'late' : 'ontime', logId: cleanVal(r[0]), by: /\[เช็คโดย/.test(String(r[15] || '')) ? 'roll' : 'self' };
  });
  return { success: true, date: date, slot: slot, marks: marks };
}
function savePrayerRoll_(data, session) {
  data = data || {};
  ensureSchema();
  const date = formatSheetDate(data.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return { success: false, message: 'วันที่ไม่ถูกต้อง' };
  const slot = formatPrayerTimeThai(data.slot || 'ซุบฮิ');
  const si = PRAYER_SLOTS_.map(formatPrayerTimeThai).indexOf(slot);
  if (si === -1) return { success: false, message: 'ไม่รู้จักเวลาละหมาดนี้' };
  const marks = (data.marks && typeof data.marks === 'object') ? data.marks : {};
  const keys = Object.keys(marks).slice(0, 600);
  if (!keys.length) return { success: false, message: 'ยังไม่ได้เช็คชื่อนักเรียน' };
  const ST = { ontime: 'ตรงเวลา', late: 'มาสาย', absent: 'ขาด', leave: 'ลา' };
  const roster = {};
  (getAllStudents().data || []).forEach(function (s) { roster[String(s.studentId).replace(/\D/g, '').replace(/^0+/, '')] = s; });
  const sheet = getSpreadsheet().getSheetByName(SHEETS.PRAYERS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานบันทึกละหมาด' };
  const who = (session && (session.name || session.userId)) || 'แอดมิน';
  const stamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM HH:mm');
  const lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) {}
  try {
    const rows = readPrayerRows_(sheet);
    const at = {};
    rows.forEach(function (r, i) { if (formatSheetDate(r[6]) === date && formatPrayerTimeThai(r[4]) === slot) { const k = prayerRollKey_(r[1], date, slot); if (at[k] === undefined) at[k] = i; } });
    const adds = [], dels = [], out = [];
    let updated = 0;
    keys.forEach(function (raw) {
      const nid = String(raw).replace(/\D/g, '').replace(/^0+/, ''); if (!nid) return;
      const v = String(marks[raw] || '');
      const k = prayerRollKey_(nid, date, slot); const idx = at[k];
      if (!v) { // ล้างการเช็ค: ลบเฉพาะรายการที่เช็คแทน ไม่ลบรายการที่นักเรียนบันทึกเอง
        if (idx !== undefined && /\[เช็คโดย/.test(String(rows[idx][15] || ''))) { dels.push(idx + 2); out.push({ studentId: nid, removed: true, logId: cleanVal(rows[idx][0]) }); }
        return;
      }
      if (!ST[v]) return;
      const note = '[เช็คโดย ' + who + ' ' + stamp + ']';
      if (idx !== undefined) {
        const keepNote = String(rows[idx][15] || '').replace(/\s*\[เช็คโดย [^\]]*\]\s*$/, '');
        sheet.getRange(idx + 2, 15, 1, 2).setValues([[ST[v], (keepNote ? keepNote + ' ' : '') + note]]);
        updated++;
        out.push({ studentId: cleanVal(rows[idx][1]), logId: cleanVal(rows[idx][0]), status: ST[v] });
        return;
      }
      const s = roster[nid] || {};
      const sid = s.studentId ? formatAsText(s.studentId) : String(raw);
      const logId = 'PRY-ROLL-' + date.replace(/-/g, '') + '-' + si + '-' + nid;
      adds.push([logId, sid, s.fullName || '', s.grade || '', slot, new Date().toISOString(), date, Utilities.formatDate(new Date(), 'Asia/Bangkok', 'HH:mm:ss'), '', '', 'เช็คชื่อโดยแอดมิน', 0, 'ใช่', '', ST[v], note]);
      out.push({ studentId: sid, logId: logId, status: ST[v], studentName: s.fullName || '', grade: s.grade || '' });
    });
    if (adds.length) {
      const start = sheet.getLastRow() + 1;
      sheet.getRange(start, 1, adds.length, 16).setValues(adds);
      sheet.getRange(start, 2, adds.length, 1).setNumberFormat('@');
      sheet.getRange(start, 7, adds.length, 2).setNumberFormat('@');
    }
    dels.sort(function (a, b) { return b - a; }).forEach(function (r) { sheet.deleteRow(r); });
    try { if (typeof bumpDataVersion_ === 'function') bumpDataVersion_(); } catch (e) {}
    return { success: true, date: date, slot: slot, added: adds.length, updated: updated, removed: dels.length, records: out, message: 'บันทึกการเช็คชื่อละหมาด' + slot + 'แล้ว ' + (adds.length + updated) + ' คน' };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

/** แอดมิน/อาจารย์เพิ่มบันทึกละหมาดแทนนักเรียน (เช่น ลืมเช็คชื่อ เครื่องเสีย) */
function addPrayerForStudent_(data, session) {
  data = data || {};
  const sid = cleanVal(data.studentId);
  if (!sid || !data.prayerTime || !data.date) return { success: false, message: 'ข้อมูลไม่ครบ (นักเรียน เวลาละหมาด วันที่)' };
  const who = (session && (session.name || session.userId)) || 'แอดมิน';
  const id = 'PRY-ADM-' + Date.now();
  const r = recordPrayer({
    logId: id, studentId: sid, studentName: data.studentName || '', grade: data.grade || '',
    prayerTime: data.prayerTime, date: data.date, time: data.time || '', timestamp: new Date().toISOString(),
    status: data.status || 'ตรงเวลา', locationName: 'บันทึกโดยแอดมิน', isWithinZone: true,
    note: (data.note ? String(data.note).slice(0, 300) + ' ' : '') + '[เพิ่มโดย ' + who + ']'
  });
  if (r && r.success) r.message = 'เพิ่มบันทึกละหมาดให้นักเรียนแล้ว';
  return r;
}

/** ช่วงเวลาละหมาด 5 เวลา (แอดมินปรับได้ตามฤดูกาล) เก็บใน Settings: PrayerWindows */
function savePrayerWindows_(windows) {
  if (windows === null) { saveSetting({ key: 'PrayerWindows', value: '', description: 'ช่วงเวลาละหมาด (JSON) · ว่าง = ค่าเริ่มต้น' }); return { success: true, message: 'กลับไปใช้เวลาเริ่มต้นแล้ว' }; }
  if (!Array.isArray(windows) || windows.length !== 5) return { success: false, message: 'ต้องมีครบ 5 เวลา' };
  const toMin = function (t) { const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/); if (!m) return NaN; const h = +m[1], mi = +m[2]; return (h < 24 && mi < 60) ? h * 60 + mi : NaN; };
  const out = [];
  for (let i = 0; i < 5; i++) {
    const w = windows[i] || {}; const a = toMin(w.start), b = toMin(w.end);
    if (isNaN(a) || isNaN(b) || b <= a) return { success: false, message: 'เวลาของ ' + cleanVal(w.key || ('ช่วงที่ ' + (i + 1))) + ' ไม่ถูกต้อง (เวลาสิ้นสุดต้องหลังเวลาเริ่ม)' };
    if (out.length && a <= out[out.length - 1].endMin) return { success: false, message: 'ช่วงเวลา ' + cleanVal(w.key) + ' ซ้อนกับเวลาก่อนหน้า' };
    out.push({ key: cleanVal(w.key), start: w.start, end: w.end, startMin: a, endMin: b });
  }
  saveSetting({ key: 'PrayerWindows', value: JSON.stringify(out.map(function (w) { return { key: w.key, start: w.start, end: w.end }; })), description: 'ช่วงเวลาละหมาด (JSON) · ว่าง = ค่าเริ่มต้น' });
  return { success: true, message: 'บันทึกช่วงเวลาละหมาดแล้ว · นักเรียนจะเห็นเวลาใหม่ทันที' };
}

/* ===================== ตารางสอน ===================== */
// วันละ 5 วิชา = 5 คาบ
const TT_MAX_PERIODS = 5;
const TT_DEFAULT_PERIODS = [
  { start: '08:30', end: '09:30' }, { start: '09:40', end: '10:40' }, { start: '10:50', end: '11:50' },
  { start: '13:00', end: '14:00' }, { start: '14:10', end: '15:10' }
];
function ttConfig_(settings) {
  let c = null; try { c = JSON.parse(settings.TimetableConfig || 'null'); } catch (e) {}
  c = c || {};
  return {
    periods: (Array.isArray(c.periods) && c.periods.length ? c.periods : TT_DEFAULT_PERIODS).slice(0, TT_MAX_PERIODS),
    days: Array.isArray(c.days) && c.days.length ? c.days : [1, 2, 3, 4, 5],
    showStudents: c.showStudents !== false, showTeachers: c.showTeachers !== false,
    updatedAt: c.updatedAt || ''
  };
}
/** v17.12 · วิชาของนักเรียนตามชั้นปี (จากตารางเรียนของชั้น + ตารางพิเศษที่ตัวเองอยู่ · ไม่รวมวิชาที่ถูกละเว้น)
 *  ไม่ขึ้นกับการเปิด/ปิดการมองเห็นตาราง · ถ้ายังไม่มีตารางของชั้นนั้น subjects = null (ให้แสดงทุกวิชาเหมือนเดิม) */
/** v17.14 · คาบสอนของอาจารย์ (ทุกชั้น + ตารางพิเศษ) สำหรับเลือกตอนแจ้งลา · ไม่ขึ้นกับการเปิด/ปิดการมองเห็นตาราง */
function getMyTeaching_(session) {
  const st = (getSettings().data) || {};
  const cfg = ttConfig_(st);
  const uid = String(session.userId || '').toLowerCase(), nm = cleanVal(session.name || '');
  const mine = function (e) { return ttTeaches_(e, uid, nm); };
  const out = [];
  const scan = function (cells, g, gname) {
    Object.keys(cells || {}).forEach(function (k) {
      const m = k.match(/^(\d)-(\d+)$/); if (!m) return;
      (Array.isArray(cells[k]) ? cells[k] : [cells[k]]).forEach(function (e) { if (mine(e)) out.push({ d: +m[1], p: +m[2], g: g, gn: gname, s: cleanVal(e.s || ''), sn: cleanVal(e.sn || ''), r: cleanVal(e.r || '') }); });
    });
  };
  ['1', '2', '3', '4', '5', '6'].forEach(function (g) { let v = null; try { v = JSON.parse(st['Timetable_M' + g] || 'null'); } catch (e) {} if (v && v.cells) scan(v.cells, g, 'ม.' + g); });
  let ids = []; try { ids = JSON.parse(st.TimetableExtras || '[]') || []; } catch (e) {}
  ids.forEach(function (id) { let x = null; try { x = JSON.parse(st['TimetableX_' + id] || 'null'); } catch (e) {} if (x && x.cells) scan(x.cells, 'x:' + id, cleanVal(x.name || 'ตารางพิเศษ')); });
  // v18.40 · คาบหะละเกาะฮฺที่อาจารย์เป็นผู้ดูแล (จับคู่เวลาหะละเกาะฮฺกับช่วงเวลาคาบ) · ให้เลือกแจ้งลาได้
  try {
    const pm = function (t) { const m = String(t || '').match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : -1; };
    const own = readHalaqah_().filter(function (h) { return String(h.teacher || '').toLowerCase() === uid || (!!hqNm_(h.teacherName) && hqNm_(h.teacherName) === hqNm_(session.name)); });
    own.forEach(function (h) {
      const hs = pm(h.start), he = pm(h.end); if (hs < 0 || he <= hs) return;
      const dows = {}; (h.dates && h.dates.length ? h.dates.map(function (x) { return String(new Date(x + 'T00:00:00').getDay()); }) : h.days).forEach(function (x) { dows[x] = 1; });
      (cfg.periods || []).forEach(function (pp, i) {
        const ps = pm(pp && pp.start), pe = pm(pp && pp.end); if (ps < 0 || pe <= ps || Math.min(he, pe) - Math.max(hs, ps) < 15) return;
        Object.keys(dows).forEach(function (dw) {
          const d = +dw, p = i + 1;
          if (out.some(function (o) { return o.d === d && o.p === p && (String(o.g) === 'hq:' + h.id || /halaq|หะละเกาะ|ฮะละเกาะ|หะลาเกาะ|ฮาละเกาะ/i.test(o.sn + ' ' + o.s)); })) return;
          out.push({ d: d, p: p, g: 'hq:' + h.id, gn: h.grades.length ? 'หะละเกาะฮฺ ม.' + h.grades.join(',') : 'หะละเกาะฮฺ', s: '', sn: h.name || 'หะละเกาะฮฺ', r: h.location || '' });
        });
      });
    });
  } catch (e) {}
  return { success: true, config: cfg, slots: out };
}

function getMySubjects_(sid) {
  const st = (getSettings().data) || {};
  const g = studentGradeNum_(sid).grade;
  const me = String(sid).replace(/\D/g, '').replace(/^0+/, '');
  const out = {}; let has = false;
  const add = function (e) { if (!e) return; const sn = cleanVal(e.sn || ''); if (!sn) return; const k = cleanVal(e.s || '') || sn; if (!out[k]) out[k] = { id: cleanVal(e.s || ''), name: sn }; };
  const take = function (cells, checkOnly) {
    Object.keys(cells || {}).forEach(function (k) {
      const list = Array.isArray(cells[k]) ? cells[k] : [cells[k]];
      list.forEach(function (e) { if (!e) return; if (e.x && e.x.indexOf(me) !== -1) return; if (checkOnly && e.o && e.o.length && e.o.indexOf(me) === -1) return; add(e); });
    });
  };
  let v = null; try { v = JSON.parse(st['Timetable_M' + g] || 'null'); } catch (e) {}
  if (v && v.cells && Object.keys(v.cells).length) { has = true; take(v.cells, true); }
  let ids = []; try { ids = JSON.parse(st.TimetableExtras || '[]') || []; } catch (e) {}
  ids.forEach(function (id) { let x = null; try { x = JSON.parse(st['TimetableX_' + id] || 'null'); } catch (e) {} if (x && (x.students || []).indexOf(me) !== -1) { has = true; take(x.cells, false); } });
  return { success: true, grade: g, subjects: has ? Object.keys(out).map(function (k) { return out[k]; }) : null };
}

function getTimetable_(session, isStudent, isAdmin) {
  const st = (getSettings().data) || {};
  const cfg = ttConfig_(st);
  const grades = {};
  ['1', '2', '3', '4', '5', '6'].forEach(function (g) { let v = null; try { v = JSON.parse(st['Timetable_M' + g] || 'null'); } catch (e) {} if (v && v.cells) grades[g] = v; });
  // ตารางพิเศษ (แยกจากตารางชั้น) สำหรับนักเรียนที่เลือกเฉพาะ
  let ids = []; try { ids = JSON.parse(st.TimetableExtras || '[]') || []; } catch (e) {}
  const extras = ids.map(function (id) { let v = null; try { v = JSON.parse(st['TimetableX_' + id] || 'null'); } catch (e) {} return v; }).filter(function (v) { return v && v.id; });
  if (isStudent) {
    const g = studentGradeNum_(session.userId).grade;
    const meX = String(session.userId).replace(/\D/g, '').replace(/^0+/, '');
    const myExtras = cfg.showStudents ? extras.filter(function (x) { return (x.students || []).indexOf(meX) !== -1; }).map(function (x) { const cs = {}; Object.keys(x.cells || {}).forEach(function (k) { const e = x.cells[k]; if (!e || (e.x && e.x.indexOf(meX) !== -1)) return; const c = Object.assign({}, e); delete c.x; cs[k] = c; }); return { id: x.id, name: x.name, cells: cs, updatedAt: x.updatedAt }; }) : [];
    if (!cfg.showStudents) return { success: true, hidden: true, config: cfg, grade: g, grades: {} };
    const one = {};
    if (g && grades[g]) {
      // นักเรียนเห็นเฉพาะกลุ่มที่ตัวเองเรียน · ไม่ส่งรายชื่อคนอื่นกลับไป
      const me = String(session.userId).replace(/\D/g, '').replace(/^0+/, '');
      const myGx = studentGx_(session.userId);
      const cells = {};
      Object.keys(grades[g].cells || {}).forEach(function (k) {
        const list = Array.isArray(grades[g].cells[k]) ? grades[g].cells[k] : [grades[g].cells[k]];
        const mine = list.filter(function (e) { return e && (!e.o || !e.o.length || e.o.indexOf(me) !== -1) && !(e.x && e.x.indexOf(me) !== -1) && (!e.gx || !myGx || e.gx === myGx); });
        // v17.84 · ส่งทุกวิชาที่ตรงกับนักเรียน (อาจมีหลายช่วงวันที่) · แอปเลือกตามวันที่เอง
        if (mine.length) { const L = mine.map(function (m) { const e = Object.assign({}, m); if (e.o) { e.only = true; delete e.o; } delete e.x; return e; }); cells[k] = L.length === 1 ? L[0] : L; }
      });
      one[g] = { grade: g, cells: cells, updatedAt: grades[g].updatedAt };
    }
    return { success: true, config: cfg, grade: g, grades: one, extras: myExtras, swaps: activeSwaps_().filter(function (x) { return x.grade === g; }) };
  }
  if (!isAdmin && !cfg.showTeachers) return { success: true, hidden: true, config: cfg, grades: {} };
  return { success: true, config: cfg, grades: grades, extras: extras, swaps: activeSwaps_() };
}
// v18.41 · อาจารย์ผู้สอนร่วม (ts = username, tns = ชื่อ) · ใช้กับคาบที่มีผู้สอนหลายคน เช่น หะละเกาะฮฺ
function ttCo_(c, e) {
  const ts = (Array.isArray(c.ts) ? c.ts : []).map(function (x) { return cleanVal(x).slice(0, 60); }).slice(0, 30);
  const tns = (Array.isArray(c.tns) ? c.tns : []).map(function (x) { return cleanVal(x).slice(0, 80); }).slice(0, 30);
  const T = [], N = [];
  ts.forEach(function (u, i) { if (!u || u === e.t || T.indexOf(u) !== -1) return; T.push(u); N.push(tns[i] || u); });
  if (T.length) { e.ts = T; e.tns = N; }
  return e;
}
function ttTeaches_(e, uid, nm) { if (!e) return false; uid = String(uid || '').toLowerCase(); if (uid && e.t && String(e.t).toLowerCase() === uid) return true; if (nm && e.tn && cleanVal(e.tn) === nm) return true; if (Array.isArray(e.ts) && uid && e.ts.some(function (u) { return String(u).toLowerCase() === uid; })) return true; return !!(nm && Array.isArray(e.tns) && e.tns.indexOf(nm) !== -1); }
// v18.42 · คาบหะละเกาะฮฺ: แก้ผู้สอน (หลัก + ร่วม) ในชั้นใดชั้นหนึ่ง → ใช้กับคาบหะละเกาะฮฺเวลาเดียวกันทุกชั้น
// ทำเฉพาะช่องที่ผู้สอนเปลี่ยนจากค่าเดิม (กันการบันทึกจากข้อมูลเก่าของชั้นอื่นทับกลับ)
function ttIsHq_(e) { return !!e && /halaq|halak|หะละเกาะ|ฮะละเกาะ|หะลาเกาะ|ฮาลาเกาะ|ฮาละเกาะ/i.test(String(e.s || '') + ' ' + String(e.sn || '')); }
function ttHqOf_(c) { return (Array.isArray(c) ? c : c ? [c] : []).filter(ttIsHq_)[0] || null; }
function ttSig_(e) { return e ? JSON.stringify([e.t || '', e.tn || '', e.ts || [], e.tns || []]) : ''; }
function ttSyncHalaqah_(g, cells, prevCells, session) {
  const changed = {};
  Object.keys(cells).forEach(function (k) { const e = ttHqOf_(cells[k]), was = ttHqOf_(prevCells[k]); if (!e || ttSig_(e) === ttSig_(was)) return; if (!was && !e.t && !e.tn && !(e.ts && e.ts.length)) return; changed[k] = e; });
  const keys = Object.keys(changed); if (!keys.length) return {};
  const st = (getSettings().data) || {}; const out = {};
  ['1', '2', '3', '4', '5', '6'].forEach(function (og) {
    if (og === String(g)) return;
    let v = null; try { v = JSON.parse(st['Timetable_M' + og] || 'null'); } catch (e) {} if (!v || !v.cells) return;
    let dirty = false;
    keys.forEach(function (k) {
      const src = changed[k]; const list = Array.isArray(v.cells[k]) ? v.cells[k] : v.cells[k] ? [v.cells[k]] : [];
      list.forEach(function (e) { if (!ttIsHq_(e) || ttSig_(e) === ttSig_(src)) return; e.t = src.t || ''; e.tn = src.tn || ''; if (src.ts && src.ts.length) { e.ts = src.ts.slice(); e.tns = (src.tns || []).slice(); } else { delete e.ts; delete e.tns; } dirty = true; });
    });
    if (!dirty) return;
    v.updatedAt = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'); v.by = (session && (session.name || session.userId)) || '';
    const json = JSON.stringify(v); if (json.length > 45000) return;
    saveSetting({ key: 'Timetable_M' + og, value: json, description: 'ตารางสอน ม.' + og + ' (JSON)' });
    out[og] = v;
  });
  return out;
}
function ttIds_(a) { const o = (Array.isArray(a) ? a : []).map(function (x) { return cleanVal(x).replace(/\D/g, '').replace(/^0+/, ''); }).filter(Boolean).slice(0, 300); return o.filter(function (x, i) { return o.indexOf(x) === i; }); }
function ttCleanCells_(src) {
  const cells = {};
  src = (src && typeof src === 'object') ? src : {};
  Object.keys(src).forEach(function (k) {
    if (!/^[0-6]-([1-9]|1[0-2])$/.test(k)) return;
    const c = Array.isArray(src[k]) ? src[k][0] : src[k]; if (!c) return;
    const sn = cleanVal(c.subjectName || c.sn).slice(0, 80); if (!sn) return;
    cells[k] = { s: cleanVal(c.subjectId || c.s).slice(0, 40), sn: sn, t: cleanVal(c.teacher || c.t).slice(0, 60), tn: cleanVal(c.teacherName || c.tn).slice(0, 80), r: cleanVal(c.room || c.r).slice(0, 40) };
    const x = ttIds_(c.x); if (x.length) cells[k].x = x;
    ttCo_(c, cells[k]);
  });
  return cells;
}
/** ตารางพิเศษ: ตั้งชื่อ เลือกนักเรียน (ข้ามชั้นได้) และลงคาบแยกจากตารางชั้น */
function saveTimetableExtra_(data, session) {
  data = data || {};
  const name = cleanVal(data.name).slice(0, 60);
  if (!name) return { success: false, message: 'ตั้งชื่อตารางก่อน เช่น ภาษาจีน (วิชาเลือก)' };
  const students = (Array.isArray(data.students) ? data.students : []).map(function (x) { return cleanVal(x).replace(/\D/g, '').replace(/^0+/, ''); }).filter(Boolean);
  const uniq = students.filter(function (x, i) { return students.indexOf(x) === i; }).slice(0, 400);
  if (!uniq.length) return { success: false, message: 'เลือกนักเรียนอย่างน้อย 1 คน' };
  const st = (getSettings().data) || {};
  let ids = []; try { ids = JSON.parse(st.TimetableExtras || '[]') || []; } catch (e) {}
  let id = cleanVal(data.id).replace(/[^A-Za-z0-9_-]/g, '');
  if (!id || ids.indexOf(id) === -1) { id = 'X' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); ids.push(id); }
  if (ids.length > 30) return { success: false, message: 'มีตารางพิเศษได้สูงสุด 30 ตาราง' };
  const value = { id: id, name: name, students: uniq, cells: ttCleanCells_(data.cells), updatedAt: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'), by: (session && (session.name || session.userId)) || '' };
  const json = JSON.stringify(value);
  if (json.length > 45000) return { success: false, message: 'ตารางยาวเกินไป' };
  saveSetting({ key: 'TimetableX_' + id, value: json, description: 'ตารางพิเศษ: ' + name + ' (JSON)' });
  saveSetting({ key: 'TimetableExtras', value: JSON.stringify(ids), description: 'รายการตารางพิเศษ (JSON)' });
  return { success: true, message: 'บันทึกตาราง "' + name + '" แล้ว', extra: value };
}
function deleteTimetableExtra_(data) {
  const id = cleanVal((data || {}).id);
  const st = (getSettings().data) || {};
  let ids = []; try { ids = JSON.parse(st.TimetableExtras || '[]') || []; } catch (e) {}
  if (ids.indexOf(id) === -1) return { success: false, message: 'ไม่พบตารางนี้' };
  ids = ids.filter(function (x) { return x !== id; });
  saveSetting({ key: 'TimetableExtras', value: JSON.stringify(ids), description: 'รายการตารางพิเศษ (JSON)' });
  saveSetting({ key: 'TimetableX_' + id, value: '', description: 'ลบแล้ว' });
  return { success: true, message: 'ลบตารางพิเศษแล้ว' };
}
function saveTimetable_(data, session) {
  data = data || {};
  const g = String(cleanVal(data.grade)).replace(/\D/g, '');
  if (!/^[1-6]$/.test(g)) return { success: false, message: 'เลือกชั้นเรียน ม.1–ม.6' };
  const cells = {};
  const src = (data.cells && typeof data.cells === 'object') ? data.cells : {};
  // แต่ละคาบมีได้หลายกลุ่ม (เช่น วิชาเลือก) · o = รหัสนักเรียนที่เรียนกลุ่มนี้ (ว่าง = ทั้งชั้น)
  const clean1 = function (c) {
    c = c || {};
    const sn = cleanVal(c.subjectName || c.sn).slice(0, 80);
    if (!sn) return null;
    const o = (Array.isArray(c.o) ? c.o : []).map(function (x) { return cleanVal(x).replace(/\D/g, '').replace(/^0+/, ''); }).filter(Boolean).slice(0, 300);
    const e = { s: cleanVal(c.subjectId || c.s).slice(0, 40), sn: sn, t: cleanVal(c.teacher || c.t).slice(0, 60), tn: cleanVal(c.teacherName || c.tn).slice(0, 80), r: cleanVal(c.room || c.r).slice(0, 40) };
    if (o.length) e.o = o.filter(function (x, i) { return o.indexOf(x) === i; });
    const x = ttIds_(c.x); if (x.length) e.x = x; // x = นักเรียนที่ละเว้นวิชานี้
    ttCo_(c, e);
    // v17.84 · gx = เฉพาะเพศ (m/f) · from/to = ช่วงวันที่ใช้วิชานี้ (ว่าง = ตลอดภาคเรียน)
    const gx = cleanVal(c.gx); if (gx === 'm' || gx === 'f') e.gx = gx;
    const d1 = cleanVal(c.from), d2 = cleanVal(c.to);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d1)) e.from = d1; if (/^\d{4}-\d{2}-\d{2}$/.test(d2)) e.to = d2;
    if (e.from && e.to && e.to < e.from) { const t = e.from; e.from = e.to; e.to = t; }
    return e;
  };
  Object.keys(src).forEach(function (k) {
    if (!/^[0-6]-([1-9]|1[0-2])$/.test(k)) return;
    const list = (Array.isArray(src[k]) ? src[k] : [src[k]]).map(clean1).filter(Boolean).slice(0, 6);
    if (list.length) cells[k] = list.length === 1 && !list[0].o && !list[0].gx && !list[0].from && !list[0].to ? list[0] : list;
  });
  const value = { grade: g, cells: cells, updatedAt: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'), by: (session && (session.name || session.userId)) || '' };
  const json = JSON.stringify(value);
  if (json.length > 45000) return { success: false, message: 'ตารางยาวเกินไป ลองย่อชื่อวิชาหรือห้องเรียน' };
  let prevCells = {}; try { prevCells = (JSON.parse(((getSettings().data) || {})['Timetable_M' + g] || 'null') || {}).cells || {}; } catch (e) {}
  saveSetting({ key: 'Timetable_M' + g, value: json, description: 'ตารางสอน ม.' + g + ' (JSON)' });
  let synced = {}; try { if (!data.noSync) synced = ttSyncHalaqah_(g, cells, prevCells, session); } catch (e) {}
  return { success: true, message: 'บันทึกตารางสอน ม.' + g + ' แล้ว' + (Object.keys(synced).length ? ' · อัปเดตผู้สอนหะละเกาะฮฺใน ม.' + Object.keys(synced).join(', ม.') + ' ด้วย' : ''), timetable: value, synced: synced };
}
function saveTimetableConfig_(data) {
  data = data || {};
  const toMin = function (t) { const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/); return m && +m[1] < 24 && +m[2] < 60 ? (+m[1]) * 60 + (+m[2]) : NaN; };
  const cur = ttConfig_((getSettings().data) || {});
  let periods = cur.periods;
  if (Array.isArray(data.periods)) {
    if (!data.periods.length || data.periods.length > TT_MAX_PERIODS) return { success: false, message: 'จำนวนคาบต้องอยู่ระหว่าง 1–' + TT_MAX_PERIODS + ' คาบ' };
    periods = [];
    for (let i = 0; i < data.periods.length; i++) {
      const p = data.periods[i] || {}; const a = toMin(p.start), b = toMin(p.end);
      if (isNaN(a) || isNaN(b) || b <= a) return { success: false, message: 'เวลาคาบที่ ' + (i + 1) + ' ไม่ถูกต้อง (เวลาจบต้องหลังเวลาเริ่ม)' };
      if (i && a < toMin(periods[i - 1].end)) return { success: false, message: 'คาบที่ ' + (i + 1) + ' เริ่มก่อนคาบที่ ' + i + ' จบ' };
      periods.push({ start: p.start, end: p.end });
    }
  }
  // ลบคาบ: map[i] = เลขคาบเดิมของคาบใหม่ที่ i (0 = คาบใหม่) · ย้ายข้อมูลในตารางทุกชั้นและตารางพิเศษให้ตรงคาบ
  if (Array.isArray(data.map) && data.map.length === periods.length) {
    const map = data.map.map(Number);
    const ident = map.every(function (v, i) { return v === i + 1; }) && periods.length >= cur.periods.length;
    if (!ident) {
      const st = (getSettings().data) || {};
      const remap = function (cells) { const out = {}; Object.keys(cells || {}).forEach(function (k) { const m = k.match(/^(\d)-(\d+)$/); if (!m) return; const ni = map.indexOf(+m[2]); if (ni !== -1) out[m[1] + '-' + (ni + 1)] = cells[k]; }); return out; };
      ['1', '2', '3', '4', '5', '6'].forEach(function (g) { let v = null; try { v = JSON.parse(st['Timetable_M' + g] || 'null'); } catch (e) {} if (v && v.cells) { v.cells = remap(v.cells); saveSetting({ key: 'Timetable_M' + g, value: JSON.stringify(v), description: 'ตารางสอน ม.' + g + ' (JSON)' }); } });
      let ids = []; try { ids = JSON.parse(st.TimetableExtras || '[]') || []; } catch (e) {}
      ids.forEach(function (id) { let v = null; try { v = JSON.parse(st['TimetableX_' + id] || 'null'); } catch (e) {} if (v && v.cells) { v.cells = remap(v.cells); saveSetting({ key: 'TimetableX_' + id, value: JSON.stringify(v), description: 'ตารางพิเศษ ' + (v.name || '') + ' (JSON)' }); } });
    }
  }
  let days = cur.days;
  if (Array.isArray(data.days)) { days = data.days.map(Number).filter(function (d) { return d >= 0 && d <= 6; }); days = days.filter(function (d, i) { return days.indexOf(d) === i; }).sort(function (a, b) { return ((a + 6) % 7) - ((b + 6) % 7); }); if (!days.length) return { success: false, message: 'เลือกวันเรียนอย่างน้อย 1 วัน' }; }
  const value = { periods: periods, days: days, showStudents: data.showStudents !== undefined ? !!data.showStudents : cur.showStudents, showTeachers: data.showTeachers !== undefined ? !!data.showTeachers : cur.showTeachers, updatedAt: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm') };
  saveSetting({ key: 'TimetableConfig', value: JSON.stringify(value), description: 'ตั้งค่าตารางสอน: คาบ วันเรียน การมองเห็น (JSON)' });
  return { success: true, config: value, message: 'บันทึกการตั้งค่าตารางสอนแล้ว' };
}

function getPrayers(studentId, date) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PRAYERS);
  const rows = readAllRows_(sheet);

  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const sId = cleanVal(rows[i][1]);
    const rowDate = formatSheetDate(rows[i][6]);
    const rowTime = formatSheetTime(rows[i][7]);

    if ((!studentId || isCodeMatch(sId, studentId)) &&
        (!date || rowDate === formatSheetDate(date))) {
      results.push({
        logId: cleanVal(rows[i][0]),
        studentId: sId,
        studentName: cleanVal(rows[i][2]),
        grade: cleanVal(rows[i][3]),
        prayerTime: cleanVal(rows[i][4]),
        timestamp: cleanVal(rows[i][5]),
        date: rowDate,
        time: rowTime,
        latitude: rows[i][8],
        longitude: rows[i][9],
        locationName: cleanVal(rows[i][10]),
        distanceMeters: rows[i][11],
        isWithinZone: rows[i][12] === 'ใช่' || rows[i][12] === true,
        photoUrl: cleanVal(rows[i][13]),
        status: cleanVal(rows[i][14]),
        note: cleanVal(rows[i][15])
      });
    }
  }
  return { success: true, data: results };
}

function recordAttendance(data) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  const logId = cleanVal(data.logId || ('ATT-' + new Date().getTime()));
  const now = new Date();
  const dateStr = formatSheetDate(data.date) || Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd");
  const timeStr = formatSheetTime(data.time) || Utilities.formatDate(now, "Asia/Bangkok", "HH:mm:ss");
  const cleanSid = formatAsText(data.studentId);

  sheet.appendRow([
    logId,
    cleanSid,
    data.studentName || '',
    data.grade || '',
    dateStr,
    timeStr,
    formatAttendanceStatusThai(data.status || 'มา'),
    data.note || ''
  ]);
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 2).setNumberFormat('@').setValue(cleanSid);

  return { success: true, message: 'บันทึกการมาเรียนสำเร็จ', logId: logId };
}

function getAttendance(studentId, grade) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  const rows = readAllRows_(sheet);

  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const sId = cleanVal(rows[i][1]);
    const sGrade = cleanVal(rows[i][3]);

    if ((!studentId || isCodeMatch(sId, studentId)) &&
        (!grade || sGrade === cleanVal(grade))) {
      results.push({
        logId: cleanVal(rows[i][0]),
        studentId: sId,
        studentName: cleanVal(rows[i][2]),
        grade: sGrade,
        date: formatSheetDate(rows[i][4]),
        time: formatSheetTime(rows[i][5]),
        status: cleanVal(rows[i][6]),
        note: cleanVal(rows[i][7]),
        subjectCode: cleanVal(rows[i][8] || ''),
        subjectName: cleanVal(rows[i][9] || ''),
        checkedBy: cleanVal(rows[i][10] || ''),
        period: cleanVal(rows[i][11] || '')
      });
    }
  }
  return { success: true, data: results };
}

// v17.36 · กลุ่มเป้าหมายของกิจกรรม: ทุกคน / เฉพาะชั้นปี / รายบุคคล (เก็บเป็น JSON ในคอลัมน์ J)
function normActivityAudience_(a) {
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch (e) { a = null; } }
  a = a || {};
  const type = ['grades', 'students'].indexOf(cleanVal(a.type)) !== -1 ? cleanVal(a.type) : 'all';
  const sex = ['m', 'f'].indexOf(cleanVal(a.sex)) !== -1 ? cleanVal(a.sex) : ''; // v18.28 · จำกัดเพศ (m=ชาย f=หญิง)
  const withSex = function (o) { if (sex && o.type !== 'students') o.sex = sex; return o; };
  if (type === 'grades') {
    const g = (Array.isArray(a.grades) ? a.grades : []).map(function (v) { return String(v).replace(/\D/g, ''); }).filter(function (v, i, arr) { return /^[1-6]$/.test(v) && arr.indexOf(v) === i; }).sort();
    return withSex(g.length ? { type: 'grades', grades: g } : { type: 'all' });
  }
  if (type === 'students') {
    const seen = {};
    const st = (Array.isArray(a.students) ? a.students : []).map(function (x) { return { id: cleanVal(x && (x.id || x.studentId) || x), name: cleanVal(x && (x.name || x.fullName) || '') }; }).filter(function (x) { if (!x.id || seen[x.id]) return false; seen[x.id] = 1; return true; }).slice(0, 500);
    return st.length ? { type: 'students', students: st } : withSex({ type: 'all' });
  }
  return withSex({ type: 'all' });
}
function activityAudienceAllows_(activityId, title, studentId) {
  try {
    const parsed = stripKhalifahQrPrefix(title || '', activityId || '');
    const id = cleanVal(parsed.activityId || activityId), t = cleanVal(parsed.title || title);
    const sheet = getSpreadsheet().getSheetByName(SHEETS.ACTIVITIES); if (!sheet) return { ok: true };
    const rows = sheet.getDataRange().getValues(); let aud = null;
    for (let i = 1; i < rows.length; i++) { if ((id && cleanVal(rows[i][0]) === id) || (!id && t && cleanVal(rows[i][1]) === t)) { aud = normActivityAudience_(rows[i][9]); break; } }
    if (!aud || aud.type === 'all') return { ok: true };
    if (aud.type === 'students') return aud.students.some(function (x) { return isCodeMatch(x.id, studentId); }) ? { ok: true } : { ok: false, message: 'กิจกรรมนี้สำหรับนักเรียนที่ถูกเลือกเท่านั้น' };
    const st = getStudentForStaff_(studentId); const g = st && st.student ? String(st.student.grade || '').match(/([1-6])/) : null;
    return g && aud.grades.indexOf(g[1]) !== -1 ? { ok: true } : { ok: false, message: 'กิจกรรมนี้สำหรับนักเรียนชั้น ม.' + aud.grades.join(', ม.') + ' เท่านั้น' };
  } catch (e) { return { ok: true }; }
}

function createActivity(data, session) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ACTIVITIES);
  const actId = cleanVal(data.id || data.activityId || ('ACT-' + new Date().getTime()));
  const title = cleanVal(data.title || 'กิจกรรม');
  const desc = cleanVal(data.description || data.type || 'กิจกรรมทั่วไป');
  const startDate = formatSheetDate(data.startDate || data.date) || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
  const endDate = formatSheetDate(data.endDate || data.date) || startDate;
  const location = cleanVal(data.location || 'ลานกิจกรรมหลัก KHALIFAH');
  const createdBy = cleanVal(data.createdBy || 'Admin');
  const createdAt = cleanVal(data.createdAt || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss"));

  const aud = normActivityAudience_(data.audience);
  const audStr = aud.type === 'all' && !aud.sex ? '' : JSON.stringify(aud);
  try { if (!cleanVal(sheet.getRange(1, 10).getValue())) sheet.getRange(1, 10).setValue('กลุ่มเป้าหมาย'); } catch (e) {}

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (cleanVal(rows[i][0]) === actId) {
      sheet.getRange(i + 1, 2, 1, 6).setValues([[title, desc, startDate, endDate, location, createdBy]]);
      if (data.audience !== undefined) sheet.getRange(i + 1, 10).setValue(audStr);
      return { success: true, message: 'อัปเดตกิจกรรมเรียบร้อยแล้ว', activityId: actId, id: actId, audience: aud };
    }
  }

  sheet.appendRow([
    actId,
    title,
    desc,
    startDate,
    endDate,
    location,
    createdBy,
    createdAt,
    0,
    audStr
  ]);

  // แจ้งเตือนเฉพาะกลุ่มเป้าหมาย (กระดิ่งในแอปนักเรียน)
  if (session && (aud.type !== 'all' || aud.sex)) {
    try {
      let audT = aud.type === 'grades' ? 'grade' : 'students', vals = aud.type === 'grades' ? aud.grades : aud.type === 'students' ? aud.students.map(function (x) { return x.id; }) : [];
      // v18.28 · จำกัดเพศ → แจ้งเฉพาะนักเรียนเพศนั้น (ในชั้นที่เลือก)
      if (aud.sex && aud.type !== 'students') {
        const sh = getSpreadsheet().getSheetByName(SHEETS.STUDENTS); vals = [];
        if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(17, sh.getLastColumn())).getValues().forEach(function (r) {
          const id = cleanVal(r[0]); if (!id) return; const gd = cleanVal(r[16] || ''), nm = cleanVal(r[1]);
          const girl = /หญิง|^f/i.test(gd) || (!/ชาย|^m/i.test(gd) && /^\s*(นางสาว|น\.ส\.|นาง|เด็กหญิง|ด\.ญ\.)/.test(nm));
          if ((aud.sex === 'f') !== girl) return;
          if (aud.type === 'grades') { const m = cleanVal(r[3]).match(/([1-6])/); if (!m || aud.grades.indexOf(m[1]) === -1) return; }
          vals.push(id);
        });
        audT = 'students';
      }
      if (vals.length) sendNotification_({ title: 'กิจกรรมใหม่: ' + title, body: (startDate ? 'วันที่ ' + startDate : '') + (location ? ' · ' + location : ''), audience: audT, values: vals }, session);
    } catch (e) {}
  }

  return { success: true, message: 'ประกาศกิจกรรมใหม่เรียบร้อยแล้ว', activityId: actId, id: actId, audience: aud };
}

function deleteActivity(activityId) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ACTIVITIES);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานกิจกรรม' };
  const targetId = cleanVal(activityId);
  if (!targetId) return { success: false, message: 'ไม่พบรหัสกิจกรรม' };
  const n = deleteRowsWhere_(sheet, function (r) { return cleanVal(r[0]) === targetId; });
  return { success: true, deleted: n, message: n ? 'ลบกิจกรรมเรียบร้อยแล้ว' : 'ไม่มีกิจกรรมนี้ในระบบแล้ว' };
}

function getActivities() {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ACTIVITIES);
  if (!sheet) return { success: true, data: [] };
  const rows = readAllRows_(sheet);

  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const actId = cleanVal(rows[i][0]);
    if (!actId) continue;
    results.push({
      id: actId,
      activityId: actId,
      title: cleanVal(rows[i][1]),
      type: cleanVal(rows[i][2]) || 'กิจกรรมทั่วไป',
      description: cleanVal(rows[i][2]) || 'กิจกรรมทั่วไป',
      date: formatSheetDate(rows[i][3]) || cleanVal(rows[i][3]),
      startDate: formatSheetDate(rows[i][3]) || cleanVal(rows[i][3]),
      endDate: formatSheetDate(rows[i][4]) || cleanVal(rows[i][4]),
      location: cleanVal(rows[i][5]) || 'ลานกิจกรรมหลัก',
      createdBy: cleanVal(rows[i][6]) || 'Admin',
      createdAt: cleanVal(rows[i][7]),
      attendeesCount: Number(rows[i][8]) || 0,
      audience: normActivityAudience_(rows[i][9])
    });
  }
  return { success: true, data: results.reverse() };
}

function stripKhalifahQrPrefix(rawTitle, fallbackActId) {
  let title = cleanVal(rawTitle);
  let extractedActId = cleanVal(fallbackActId);
  if (title.toUpperCase().startsWith('KHALIFAH_ACT:')) {
    const parts = title.split(':');
    if (parts.length >= 3) {
      if (!extractedActId || extractedActId === '-') extractedActId = parts[1].trim();
      title = parts.slice(2).join(':').trim();
    }
  }
  return { title: title, activityId: extractedActId };
}

function getActivityLogs(activityId) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheetLogs = ss.getSheetByName(SHEETS.ACTIVITY_LOGS);
  if (!sheetLogs) return { success: true, data: [] };
  const rows = readAllRows_(sheetLogs);
  const targetActId = cleanVal(activityId || '');

  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const parsedQr = stripKhalifahQrPrefix(rows[i][2], rows[i][1]);
    const rowActId = parsedQr.activityId;
    if (targetActId && rowActId !== targetActId) continue;
    const logId = cleanVal(rows[i][0]);
    const sid = cleanVal(rows[i][3]);
    if (!sid && !logId) continue;
    results.push({
      id: logId || ('ACTLOG-' + i),
      logId: logId || ('ACTLOG-' + i),
      activityId: rowActId,
      activityTitle: parsedQr.title,
      studentId: sid,
      studentName: cleanVal(rows[i][4]),
      grade: cleanVal(rows[i][5]),
      formattedDate: formatSheetDate(rows[i][6]) || cleanVal(rows[i][6]),
      formattedTime: formatSheetTime(rows[i][7]) || cleanVal(rows[i][7]),
      checkInTimestamp: cleanVal(rows[i][8])
    });
  }
  return { success: true, data: results.reverse() };
}

/**
 * เช็คชื่อเข้าร่วมกิจกรรม - ความเร็วสูงระดับมิลลิวินาที + ล็อก Concurrency ป้องกันข้อมูลชนกัน
 * รองรับการสแกนพร้อมกันหลายๆ เครื่องในเสี้ยววินาที และบันทึกเข้า Google Sheets ทันที (SpreadsheetApp.flush)
 */
function checkInActivity(data) {
  if (!data) return { success: false, message: 'ไม่มีข้อมูลกิจกรรม' };

  // 1. Script Lock: รอคิวล็อกได้สูงสุด 15 วินาที เพื่อให้บันทึกได้ครบทุกเครื่อง 100% ไม่หลุดแม้สแกนพร้อมกันในมิลลิวินาที
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (lockErr) {
    Logger.log('Lock wait timeout (proceeding): ' + lockErr.message);
  }

  try {
    const ss = getSpreadsheet();
    if (!ss) return { success: false, message: 'ไม่สามารถเปิดสเปรดชีตได้' };

    // ดึงชีตโดยตรงแบบความเร็วสูง ไม่เรียก initializeSheets() ซ้ำซ้อนให้หน่วงเวลา
    let sheetLogs = ss.getSheetByName(SHEETS.ACTIVITY_LOGS);
    if (!sheetLogs) {
      sheetLogs = ss.getSheetByName('บันทึกการเข้าร่วมกิจกรรม') || ss.getSheetByName('ActivityLogs');
      if (!sheetLogs) {
        sheetLogs = getOrCreateSheetSmart(ss, 'ACTIVITY_LOGS', HEADERS.ACTIVITY_LOGS, '#1e293b');
      }
    }

    let sheetActivities = ss.getSheetByName(SHEETS.ACTIVITIES);
    if (!sheetActivities) {
      sheetActivities = ss.getSheetByName('กิจกรรม') || ss.getSheetByName('Activities');
    }

    const parsedQr = stripKhalifahQrPrefix(data.activityTitle || data.title || '', data.activityId || '');
    const targetActId = cleanVal(parsedQr.activityId || data.activityId || '');
    const targetActTitle = cleanVal(parsedQr.title || data.activityTitle || data.title || '');
    const cleanSid = formatAsText(data.studentId || '-');
    const studentName = cleanVal(data.studentName || '');
    const studentGrade = cleanVal(data.grade || '-');
    const now = new Date();
    const dateStr = formatSheetDate(data.formattedDate) || Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd");
    const timeStr = formatSheetTime(data.formattedTime) || Utilities.formatDate(now, "Asia/Bangkok", "HH:mm:ss");
    const timestamp = cleanVal(data.checkInTimestamp || now.toISOString());
    const logId = cleanVal(data.id || ('ACTLOG-' + now.getTime() + '-' + Math.floor(Math.random() * 1000)));

    let matchedActivityRow = -1;
    let activityFoundTitle = targetActTitle;

    // หาแถวกิจกรรมในชีตกิจกรรม (ถ้ามี)
    if (sheetActivities && sheetActivities.getLastRow() > 1) {
      const actValues = sheetActivities.getRange(2, 1, sheetActivities.getLastRow() - 1, 9).getValues();
      for (let i = 0; i < actValues.length; i++) {
        const rowActId = cleanVal(actValues[i][0]);
        const rowActTitle = cleanVal(actValues[i][1]);
        if ((targetActId && rowActId === targetActId) || (targetActTitle && rowActTitle === targetActTitle)) {
          matchedActivityRow = i + 2;
          activityFoundTitle = rowActTitle || targetActTitle;
          break;
        }
      }
    }

    // ตรวจสอบประวัติการสแกนซ้ำในชีตบันทึก (อ่านเฉพาะ 9 คอลัมน์ ไม่ดึงทั้งชีต)
    let alreadyCheckedInRow = -1;
    let totalForThisAct = 0;
    const lastRow = sheetLogs.getLastRow();

    if (lastRow > 1) {
      const logValues = sheetLogs.getRange(2, 1, lastRow - 1, 9).getValues();
      for (let i = logValues.length - 1; i >= 0; i--) {
        const rParsed = stripKhalifahQrPrefix(logValues[i][2], logValues[i][1]);
        const rActId = rParsed.activityId;
        const rActTitle = rParsed.title;
        const rSid = cleanVal(logValues[i][3]);
        const sameAct = (targetActId && rActId === targetActId) || (!targetActId && targetActTitle && rActTitle === targetActTitle);

        if (sameAct) {
          totalForThisAct++;
          if (isCodeMatch(rSid, cleanSid)) {
            alreadyCheckedInRow = i + 2; // แถวจริงในชีต
          }
        }
      }
    }

    if (alreadyCheckedInRow !== -1) {
      // สแกนซ้ำ: อัปเดตเวลาและ Timestamp ให้เป็นข้อมูลล่าสุดทันที
      sheetLogs.getRange(alreadyCheckedInRow, 7).setNumberFormat('@').setValue(dateStr);
      sheetLogs.getRange(alreadyCheckedInRow, 8).setNumberFormat('@').setValue(timeStr);
      sheetLogs.getRange(alreadyCheckedInRow, 9).setNumberFormat('@').setValue(timestamp);
      SpreadsheetApp.flush(); // บันทึกลงชีตทันที 100%!
      return {
        success: true,
        alreadyCheckedIn: true,
        attendeesCount: totalForThisAct,
        message: 'อัปเดตเวลาเช็คชื่อกิจกรรมล่าสุดเรียบร้อยแล้ว'
      };
    }

    // สแกนใหม่: เพิ่มแถวลงชีตทันทีแบบ Plain Text
    sheetLogs.appendRow([
      logId,
      targetActId || '-',
      activityFoundTitle || targetActTitle || 'กิจกรรมทั่วไป',
      cleanSid,
      studentName,
      studentGrade,
      dateStr,
      timeStr,
      timestamp
    ]);

    const newRowIdx = sheetLogs.getLastRow();
    sheetLogs.getRange(newRowIdx, 1).setNumberFormat('@');
    sheetLogs.getRange(newRowIdx, 2).setNumberFormat('@');
    sheetLogs.getRange(newRowIdx, 4).setNumberFormat('@');
    sheetLogs.getRange(newRowIdx, 7).setNumberFormat('@');
    sheetLogs.getRange(newRowIdx, 8).setNumberFormat('@');
    totalForThisAct++;

    // อัปเดตจำนวนผู้เข้าร่วมในตารางกิจกรรม
    if (sheetActivities && matchedActivityRow !== -1) {
      sheetActivities.getRange(matchedActivityRow, 9).setValue(totalForThisAct);
    }

    // บังคับ Flush ให้ข้อมูลเขียนลง Google Sheets ทันที ไม่ค้างในคิว!
    SpreadsheetApp.flush();

    return {
      success: true,
      alreadyCheckedIn: false,
      attendeesCount: totalForThisAct,
      message: 'บันทึกการเข้าร่วมกิจกรรมลง Google Sheets สำเร็จทันที'
    };
  } catch (err) {
    Logger.log('checkInActivity error: ' + err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึก: ' + err.message };
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function deleteActivityAttendee(data) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheetLogs = ss.getSheetByName(SHEETS.ACTIVITY_LOGS);
  if (!sheetLogs) return { success: false, message: 'ไม่พบแผ่นงานบันทึกการเข้าร่วมกิจกรรม' };

  const targetLogId = cleanVal(data.logId || data.id || '');
  const targetActId = cleanVal(data.activityId || '');
  const targetSid = cleanVal(data.studentId || '');
  const n = deleteRowsWhere_(sheetLogs, function (r) {
    const rParsed = stripKhalifahQrPrefix(r[2], r[1]);
    return (targetLogId && cleanVal(r[0]) === targetLogId) || (targetActId && targetSid && rParsed.activityId === targetActId && isCodeMatch(cleanVal(r[3]), targetSid));
  });
  return { success: true, deleted: n, message: n ? 'ลบรายชื่อผู้เข้าร่วมกิจกรรมเรียบร้อยแล้ว' : 'ไม่มีรายชื่อนี้แล้ว' };
}

/**
 * เข้าสู่ระบบอาจารย์ / ผู้บริหาร / แอดมิน
 * - แอดมินหลัก: ไม่ต้องกรอกชื่อผู้ใช้ (หรือใช้ชื่อ admin) + รหัส MASTER_ADMIN_PASS จาก Script Properties
 * - บัญชีอื่น: ต้องกรอกชื่อผู้ใช้ (หรือเบอร์โทร) + รหัสผ่าน เสมอ
 * สำเร็จแล้วจะได้ token และข้อมูลโปรไฟล์ (ไม่มีรหัสผ่าน)
 */
function verifyAdminLogin(password, username) {
  const pass = cleanVal(password);
  const user = cleanVal(username);
  const targetUser = user.toLowerCase();
  if (!pass) return { success: false, field: 'password', message: 'กรุณากรอกรหัสผ่าน' };

  const rlKey = 'staff_' + (targetUser || '__master__');
  if (loginLocked_(rlKey)) return { success: false, locked: true, message: LOCKED_MESSAGE };

  // 1) แอดมินหลัก (Master)
  const masterPass = getMasterPassword_();
  if ((!targetUser || targetUser === 'masteradmin') && masterPass && safeEquals_(normalizePasswordInput_(pass), normalizePasswordInput_(masterPass))) {
    loginSucceeded_(rlKey);
    const out = {
      success: true,
      token: issueToken_('admin', 'MasterAdmin', 'ผู้ดูแลระบบหลัก (Master Administrator)', true),
      role: 'SuperAdmin',
      isOwner: true,
      username: 'MasterAdmin',
      fullName: 'ผู้ดูแลระบบหลัก (Master Administrator)',
      approvalStatus: 'Verified'
    };
    return out;
  }
  if (!targetUser) {
    // แอดมินรอง / ผู้บริหาร / ผู้ตรวจการ เข้าด้วยรหัสผ่านอย่างเดียวได้ (รหัสของบัญชีกลุ่มนี้ไม่ซ้ำกัน)
    const owner = findPasswordOnlyAccount_(pass);
    if (owner) return verifyAdminLogin(pass, owner);
    loginFailed_(rlKey);
    return { success: false, field: 'password', message: 'รหัสผ่านไม่ถูกต้อง' };
  }

  ensureSchema();
  const ss = getSpreadsheet();
  const sources = [
    { name: SHEETS.ADMINS, kind: 'admin' },
    { name: SHEETS.TEACHERS, kind: 'teacher' },
    { name: 'ผู้ดูแลระบบ', kind: 'legacy' }
  ];

  let userFound = false;
  for (let s = 0; s < sources.length; s++) {
    const sheet = ss.getSheetByName(sources[s].name);
    if (!sheet || sheet.getLastRow() <= 1) continue;
    const rows = sheet.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      const rowUser = cleanVal(rows[i][1]).toLowerCase();
      const phoneCol = sources[s].kind === 'legacy' ? 7 : 5;
      const matchUser = rowUser && (rowUser === targetUser || (normalizePhone(user).length >= 9 && isPhoneMatch(rows[i][phoneCol], user)));
      if (!matchUser) continue;
      userFound = true;
      if (!verifyPassword_(rows[i][2], pass)) continue;

      // ตรวจสถานะบัญชี
      const kind = sources[s].kind;
      const statusCol = kind === 'admin' ? 7 : (kind === 'teacher' ? 8 : 9);
      const status = cleanVal(rows[i][statusCol] || '');
      if (status.indexOf('ระงับ') !== -1 || status.indexOf('ยกเลิก') !== -1 || status.indexOf('พ้นสภาพ') !== -1) {
        return { success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบหลัก' };
      }
      if (status === 'PendingAdmin' || status === 'AwaitingOtp' || status.indexOf('OTP') !== -1) {
        return {
          success: false,
          requireOtp: true,
          approvalStatus: status === 'PendingAdmin' ? 'PendingAdmin' : 'AwaitingOtp',
          registration: { role: 'teacher', userId: cleanVal(rows[i][1]), fullName: cleanVal(rows[i][3]), email: cleanVal(rows[i][kind === 'legacy' ? 6 : 6]), status: status === 'PendingAdmin' ? 'PendingAdmin' : 'Approved' },
          message: 'บัญชียังไม่ได้ยืนยันรหัส OTP 6 หลักจากอีเมล'
        };
      }

      // อัปเกรดรหัสผ่านข้อความธรรมดาให้เป็นค่าแฮชทันที
      if (!isHashedPassword_(rows[i][2])) {
        try { sheet.getRange(i + 1, 3).setNumberFormat('@').setValue(hashPassword_(cleanVal(rows[i][2]))); } catch (e) {}
      }

      let assignedSubjects = [];
      const subjCol = kind === 'teacher' ? 7 : (kind === 'legacy' ? 8 : -1);
      if (subjCol !== -1) {
        try { assignedSubjects = rows[i][subjCol] ? JSON.parse(rows[i][subjCol]) : []; } catch (e) {}
      }
      const roleVal = cleanVal(rows[i][4]) || (kind === 'admin' ? 'Admin' : 'TEACHER');
      const lim = limitOfRole_(roleVal);
      const tokenRole = lim === 'exec' ? 'admin' : (lim === 'act' || lim === 'night') ? 'teacher' : staffTokenRole_(roleVal);
      loginSucceeded_(rlKey);
      return {
        success: true,
        token: issueToken_(tokenRole, cleanVal(rows[i][1]), cleanVal(rows[i][3]), !lim && tokenRole === 'admin' && isOwnerRole_(roleVal), false, lim),
        limited: lim,
        isSubAdmin: !lim && tokenRole === 'admin' && !isOwnerRole_(roleVal),
        isOwner: tokenRole === 'admin' && isOwnerRole_(roleVal),
        role: roleVal,
        id: cleanVal(rows[i][0]),
        username: cleanVal(rows[i][1]),
        fullName: cleanVal(rows[i][3]),
        phone: normalizePhone(rows[i][kind === 'legacy' ? 7 : 5] || ''),
        email: cleanVal(rows[i][6] || ''),
        assignedSubjects: Array.isArray(assignedSubjects) ? assignedSubjects : [],
        avatarUrl: (kind === 'teacher' || kind === 'admin') ? cleanVal(rows[i][10] || '') : '',
        status: status || 'Active',
        approvalStatus: 'Verified'
      };
    }
  }
  loginFailed_(rlKey);
  return userFound
    ? { success: false, field: 'password', message: 'รหัสผ่านไม่ถูกต้อง' }
    : { success: false, field: 'username', message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ' };
}

function previewAsStaff_(username) {
  const u = cleanVal(username).toLowerCase();
  if (!u) return { success: false, message: 'ไม่พบชื่อผู้ใช้' };
  const ss = getSpreadsheet();
  const sources = [{ name: SHEETS.ADMINS, kind: 'admin' }, { name: SHEETS.TEACHERS, kind: 'teacher' }, { name: 'ผู้ดูแลระบบ', kind: 'legacy' }];
  for (let s = 0; s < sources.length; s++) {
    const sheet = ss.getSheetByName(sources[s].name);
    if (!sheet || sheet.getLastRow() <= 1) continue;
    const rows = sheet.getDataRange().getValues(); const kind = sources[s].kind;
    for (let i = rows.length - 1; i >= 1; i--) {
      if (cleanVal(rows[i][1]).toLowerCase() !== u) continue;
      const roleVal = cleanVal(rows[i][4]) || (kind === 'admin' ? 'Admin' : 'TEACHER');
      if (isOwnerRole_(roleVal)) return { success: false, message: 'ดูมุมมองของแอดมินสูงสุดไม่ได้' };
      let subj = []; const sc = kind === 'teacher' ? 7 : (kind === 'legacy' ? 8 : -1);
      if (sc !== -1) { try { subj = rows[i][sc] ? JSON.parse(rows[i][sc]) : []; } catch (e) {} }
      const lim = limitOfRole_(roleVal);
      const tokenRole = lim === 'exec' ? 'admin' : (lim === 'act' || lim === 'night') ? 'teacher' : staffTokenRole_(roleVal);
      return { success: true, preview: true,
        token: issueToken_(tokenRole, cleanVal(rows[i][1]), cleanVal(rows[i][3]), false, true, lim),
        limited: lim, isSubAdmin: !lim && tokenRole === 'admin', isOwner: false, role: roleVal, id: cleanVal(rows[i][0]),
        username: cleanVal(rows[i][1]), fullName: cleanVal(rows[i][3]), phone: normalizePhone(rows[i][kind === 'legacy' ? 7 : 5] || ''), email: cleanVal(rows[i][6] || ''),
        assignedSubjects: Array.isArray(subj) ? subj : [], avatarUrl: (kind === 'teacher' || kind === 'admin') ? cleanVal(rows[i][10] || '') : '' };
    }
  }
  return { success: false, message: 'ไม่พบบัญชีนี้' };
}

function addSubAdmin(data) {
  if (!data || !data.username) return { success: false, message: 'ไม่พบชื่อผู้ใช้งาน' };
  ensureSchema();
  const ss = getSpreadsheet();
  const cleanUser = cleanVal(data.username);
  const roleCode = cleanVal(data.role || 'TEACHER');
  const isTeacher = (roleCode === 'TEACHER' || roleCode === 'Teacher' || roleCode.includes('อาจารย์') || roleCode.includes('ผู้สอน') || roleCode === 'TeacherAdmin');
  const targetSheetName = isTeacher ? SHEETS.TEACHERS : SHEETS.ADMINS;
  const sheet = ss.getSheetByName(targetSheetName);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงาน ' + targetSheetName };

  const rows = sheet.getDataRange().getValues();
  let rowNum = -1;
  let existing = null;
  for (let i = 1; i < rows.length; i++) {
    if (cleanVal(rows[i][1]).toLowerCase() === cleanUser.toLowerCase()) {
      rowNum = i + 1;
      existing = rows[i];
      break;
    }
  }
  // เปลี่ยนตำแหน่งข้ามประเภท (อาจารย์ ↔ ผู้ตรวจการ/ผู้บริหาร/แอดมินรอง): ย้ายข้อมูลจากอีกแผ่นงาน แล้วลบแถวเดิม
  const otherSheet = ss.getSheetByName(isTeacher ? SHEETS.ADMINS : SHEETS.TEACHERS);
  let otherRow = -1;
  if (otherSheet && otherSheet.getLastRow() > 1) {
    const orows = otherSheet.getDataRange().getValues();
    for (let i = 1; i < orows.length; i++) if (cleanVal(orows[i][1]).toLowerCase() === cleanUser.toLowerCase()) {
      otherRow = i + 1;
      if (!existing) { const o = orows[i]; existing = [o[0], o[1], o[2], o[3], o[4], o[5], o[6], isTeacher ? '[]' : (o[8] || ''), isTeacher ? (o[8] || '') : (o[9] || ''), isTeacher ? (o[9] || '') : '']; }
      break;
    }
  }

  // ค่าที่ไม่ได้ส่งมา = คงค่าเดิมในชีต (ป้องกันข้อมูลหาย เช่น รหัสผ่านที่ไม่ได้ส่งกลับไปที่เบราว์เซอร์)
  const keep = function (val, idx, def) {
    const v = (val === undefined || val === null) ? '' : cleanVal(val);
    if (v) return v;
    if (existing && cleanVal(existing[idx])) return cleanVal(existing[idx]);
    return def;
  };
  const rawPass = cleanVal(data.password || '');
  if (rawPass && isPasswordOnlyRole_(roleCode) && !isHashedPassword_(rawPass)) {
    if (rawPass.length < 8) return { success: false, field: 'password', message: 'บัญชีที่เข้าด้วยรหัสผ่านอย่างเดียวต้องใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร' };
    const master = getMasterPassword_();
    const clash = (master && safeEquals_(normalizePasswordInput_(rawPass), normalizePasswordInput_(master))) ||
      passwordOnlyRows_().some(function (r) { return cleanVal(r[1]).toLowerCase() !== cleanUser.toLowerCase() && verifyPassword_(r[2], rawPass); });
    if (clash) return { success: false, field: 'password', message: 'รหัสผ่านนี้ซ้ำกับบัญชีอื่น กรุณาสุ่มรหัสใหม่' };
  }
  let storedPass;
  if (rawPass) {
    storedPass = isHashedPassword_(rawPass) ? rawPass : hashPassword_(rawPass);
  } else if (existing && cleanVal(existing[2])) {
    storedPass = cleanVal(existing[2]);
  } else {
    return { success: false, message: 'กรุณากำหนดรหัสผ่านสำหรับบัญชีใหม่' };
  }

  const recordId = keep(data.id || data.adminId, 0, (isTeacher ? 'TCH-' : 'ADM-') + new Date().getTime());
  const fullName = keep(data.fullName, 3, cleanUser);
  const phone = normalizePhone(keep(data.phone, 5, ''));
  const email = keep(data.email, 6, '');
  const createdAt = keep(data.createdAt, isTeacher ? 9 : 8, Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss"));
  const statusIn = cleanVal(data.status || '');
  const normalizedStatus = (statusIn === 'Active' || statusIn === 'active') ? '' : statusIn;

  let rowData;
  if (isTeacher) {
    const subjectsJson = Array.isArray(data.assignedSubjects)
      ? JSON.stringify(data.assignedSubjects)
      : (existing && existing[7] ? String(existing[7]) : '[]');
    rowData = [
      recordId, cleanUser, storedPass, fullName, roleCode, phone, email, subjectsJson,
      normalizedStatus || keep('', 8, 'ปฏิบัติหน้าที่ปกติ'),
      createdAt
    ];
  } else {
    rowData = [
      recordId, cleanUser, storedPass, fullName, roleCode, phone, email,
      normalizedStatus || keep('', 7, 'ใช้งานปกติ'),
      createdAt,
      keep(data.note, 9, 'ผู้ดูแลระบบ')
    ];
  }

  if (rowNum > 0) {
    sheet.getRange(rowNum, 1, 1, 10).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
    rowNum = sheet.getLastRow();
  }
  sheet.getRange(rowNum, 2).setNumberFormat('@').setValue(cleanUser);
  sheet.getRange(rowNum, 3).setNumberFormat('@').setValue(storedPass);
  sheet.getRange(rowNum, 6).setNumberFormat('@').setValue(phone);
  if (otherRow > 0) { try { otherSheet.deleteRow(otherRow); } catch (e) {} }
  return {
    success: true,
    role: roleCode,
    message: isTeacher ? 'บันทึกข้อมูลอาจารย์ผู้สอนสำเร็จ' : 'บันทึกข้อมูลแอดมินดูแลระบบสำเร็จ',
    adminId: recordId
  };
}

function deleteSubAdmin(username) {
  ensureSchema();
  const ss = getSpreadsheet();
  const targetUser = cleanVal(username).toLowerCase();
  let deleted = false;

  const sheetsToSearch = [SHEETS.TEACHERS, SHEETS.ADMINS];
  const legacy = ss.getSheetByName('ผู้ดูแลระบบ');
  if (legacy) sheetsToSearch.push('ผู้ดูแลระบบ');

  sheetsToSearch.forEach(sName => {
    const sheet = ss.getSheetByName(sName);
    if (!sheet) return;
    const rows = sheet.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (cleanVal(rows[i][1]).toLowerCase() === targetUser) {
        sheet.deleteRow(i + 1);
        deleted = true;
      }
    }
  });

  if (deleted) return { success: true, message: 'ลบบัญชีบุคลากรเรียบร้อยแล้ว' };
  return { success: true, deleted: 0, message: 'ไม่มีบัญชีนี้ในระบบแล้ว' };
}

function getTeachers() {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.TEACHERS);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };

  const rows = readAllRows_(sheet);
  const dedupMap = {};
  const order = [];

  for (let i = 1; i < rows.length; i++) {
    const uname = cleanVal(rows[i][1]);
    if (!uname) continue;
    const key = uname.toLowerCase();
    let assignedSubjects = [];
    try {
      assignedSubjects = rows[i][7] ? JSON.parse(rows[i][7]) : [];
    } catch (e) {}

    dedupMap[key] = {
      id: cleanVal(rows[i][0]),
      adminId: cleanVal(rows[i][0]),
      username: uname,
      password: cleanVal(rows[i][2]),
      fullName: cleanVal(rows[i][3]) || uname,
      role: cleanVal(rows[i][4]) || 'TEACHER',
      phone: normalizePhone(rows[i][5] || ''),
      email: cleanVal(rows[i][6] || ''),
      assignedSubjects: Array.isArray(assignedSubjects) ? assignedSubjects : [],
      status: cleanVal(rows[i][8]) || 'ปฏิบัติหน้าที่ปกติ',
      createdAt: formatSheetDate(rows[i][9]) || cleanVal(rows[i][9]),
      avatarUrl: cleanVal(rows[i][10] || ''),
      photo: cleanVal(rows[i][10] || '')
    };
    if (order.indexOf(key) === -1) order.push(key);
  }
  return { success: true, data: order.map(k => dedupMap[k]) };
}

function getAdmins() {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ADMINS);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };

  const rows = readAllRows_(sheet);
  const dedupMap = {};
  const order = [];

  for (let i = 1; i < rows.length; i++) {
    const uname = cleanVal(rows[i][1]);
    if (!uname) continue;
    const key = uname.toLowerCase();

    dedupMap[key] = {
      id: cleanVal(rows[i][0]),
      adminId: cleanVal(rows[i][0]),
      username: uname,
      password: cleanVal(rows[i][2]),
      fullName: cleanVal(rows[i][3]) || uname,
      role: cleanVal(rows[i][4]) || 'Admin',
      phone: normalizePhone(rows[i][5] || ''),
      email: cleanVal(rows[i][6] || ''),
      status: cleanVal(rows[i][7]) || 'ใช้งานปกติ',
      createdAt: formatSheetDate(rows[i][8]) || cleanVal(rows[i][8]),
      note: cleanVal(rows[i][9] || ''),
      avatarUrl: cleanVal(rows[i][10] || ''),
      photo: cleanVal(rows[i][10] || '')
    };
    if (order.indexOf(key) === -1) order.push(key);
  }
  return { success: true, data: order.map(k => dedupMap[k]) };
}

function getSubAdmins() {
  ensureSchema();
  const teachers = getTeachers().data || [];
  const admins = getAdmins().data || [];
  const allList = [];
  const map = {};

  admins.forEach(a => {
    if (a.username.toLowerCase() !== 'admin') {
      const key = a.username.toLowerCase();
      if (!map[key]) {
        map[key] = true;
        allList.push(a);
      }
    }
  });

  teachers.forEach(t => {
    const key = t.username.toLowerCase();
    if (!map[key]) {
      map[key] = true;
      allList.push(t);
    }
  });

  return { success: true, data: allList };
}

function logStudentStatusChange(studentId, studentName, grade, oldStatus, newStatus, effectiveDate, note, adminUser) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(SHEETS.STATUS_LOGS);
    if (!sheet) {
      sheet = getOrCreateSheetSmart(ss, 'STATUS_LOGS', HEADERS.STATUS_LOGS, '#334155');
    }
    const logId = 'STLOG-' + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd-HHmmss") + '-' + Math.floor(Math.random() * 1000);
    const dateStr = effectiveDate ? formatSheetDate(effectiveDate) : Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
    const recordedAt = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");

    sheet.appendRow([
      logId,
      cleanVal(studentId),
      cleanVal(studentName),
      cleanVal(grade),
      cleanVal(oldStatus || 'ปกติ (กำลังศึกษา)'),
      cleanVal(newStatus || 'ปกติ (กำลังศึกษา)'),
      dateStr,
      cleanVal(note || '-'),
      cleanVal(adminUser || 'Admin/ระบบ'),
      recordedAt
    ]);

    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 2).setNumberFormat('@').setValue(cleanVal(studentId));
    sheet.getRange(lastRow, 7).setNumberFormat('@').setValue(dateStr);
    return { success: true, logId: logId };
  } catch (err) {
    Logger.log('logStudentStatusChange error: ' + err.message);
    return { success: false, error: err.message };
  }
}

function updateStudentStatus(data) {
  if (!data || !data.studentId) return { success: false, message: 'ไม่พบรหัสนักเรียน' };
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานรายชื่อนักเรียน' };

  const targetId = cleanVal(data.studentId);
  const newStatus = formatStudentStatusThai(data.status || data.newStatus || 'ปกติ (กำลังศึกษา)');
  const effectiveDate = data.statusEffectiveDate || data.statusDate || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
  const note = cleanVal(data.statusNote || data.note || '');
  const adminUser = cleanVal(data.adminUser || 'Admin');

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (isCodeMatch(rows[i][0], targetId)) {
      const rowNum = i + 1;
      const oldStatus = cleanVal(rows[i][7]) || 'ปกติ (กำลังศึกษา)';
      const studentName = cleanVal(rows[i][1]);
      const grade = cleanVal(rows[i][3]);

      sheet.getRange(rowNum, 8).setValue(newStatus);
      sheet.getRange(rowNum, 15).setNumberFormat('@').setValue(effectiveDate);
      sheet.getRange(rowNum, 16).setValue(note);

      // ใส่ Dropdown Validation ให้เซลล์สถานะนี้โดยตรงเพื่อความสวยงามใน Google Sheets
      applyListValidation(sheet, rowNum, 8, 1, [
        'ปกติ (กำลังศึกษา)',
        'สำเร็จการศึกษา',
        'ลาออก',
        'พักการเรียน'
      ]);

      logStudentStatusChange(targetId, studentName, grade, oldStatus, newStatus, effectiveDate, note, adminUser);
      SpreadsheetApp.flush(); // บันทึกลง Google Sheets ทันที ไม่ค้างในแคช

      return {
        success: true,
        message: `อัปเดตสถานะของ ${studentName} เป็น "${newStatus}" มีผล ณ วันที่ ${effectiveDate} สำเร็จ`,
        studentId: targetId,
        status: newStatus,
        statusEffectiveDate: effectiveDate,
        statusNote: note
      };
    }
  }

  return { success: false, message: 'ไม่พบนักเรียนรหัส ' + targetId };
}

function getStatusLogs(studentId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STATUS_LOGS);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };

  const rows = readAllRows_(sheet);
  const results = [];
  const targetId = studentId ? cleanVal(studentId) : null;

  for (let i = 1; i < rows.length; i++) {
    const sId = cleanVal(rows[i][1]);
    if (!targetId || isCodeMatch(sId, targetId)) {
      results.push({
        logId: cleanVal(rows[i][0]),
        studentId: sId,
        studentName: cleanVal(rows[i][2]),
        grade: cleanVal(rows[i][3]),
        oldStatus: cleanVal(rows[i][4]),
        newStatus: cleanVal(rows[i][5]),
        effectiveDate: formatSheetDate(rows[i][6]) || cleanVal(rows[i][6]),
        note: cleanVal(rows[i][7]),
        recordedBy: cleanVal(rows[i][8]),
        timestamp: cleanVal(rows[i][9])
      });
    }
  }
  results.reverse();
  return { success: true, data: results };
}

function getAllStudents() {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: true, data: [] };
  const rows = readAllRows_(sheet);
  const hasanatMap = getLatestHasanatMapByStudent(ss);
  const gradesMap = getLatestGradesMapByStudent(ss);

  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const sid = cleanVal(rows[i][0]);
    if (!sid) continue;
    results.push(buildStudentObjectFromRow(rows[i], hasanatMap, gradesMap));
  }
  return { success: true, data: results };
}


// v17.46 · ลบทุกแถวที่ตรงเงื่อนไข (กันแถวซ้ำที่ทำให้ "ลบแล้วกลับมา" ต้องกดลบหลายครั้ง) · ล็อกกันลบพร้อมกัน
function deleteRowsWhere_(sheet, match) {
  const lock = LockService.getScriptLock(); try { lock.waitLock(15000); } catch (e) {}
  try {
    const rows = sheet.getDataRange().getValues(); let n = 0;
    for (let i = rows.length - 1; i >= 1; i--) if (match(rows[i])) { sheet.deleteRow(i + 1); n++; }
    if (n) { try { SpreadsheetApp.flush(); } catch (e) {} if (typeof __ROWS_MEMO !== 'undefined' && __ROWS_MEMO) delete __ROWS_MEMO[sheet.getName()]; }
    return n;
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
function deleteStudent(studentId) {
  if (!cleanVal(studentId)) return { success: false, message: 'ไม่พบรหัสนักเรียน' };
  const sheet = getSpreadsheet().getSheetByName(SHEETS.STUDENTS);
  const n = deleteRowsWhere_(sheet, function (r) { return isCodeMatch(r[0], studentId); });
  return { success: true, deleted: n, message: n ? 'ลบข้อมูลนักเรียนรหัส ' + cleanVal(studentId) + ' เรียบร้อยแล้ว' : 'ไม่มีนักเรียนรหัสนี้ในระบบแล้ว' };
}

function batchPromoteStudents(fromGrade, toGrade) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานรายชื่อนักเรียน' };

  const rows = sheet.getDataRange().getValues();
  let count = 0;
  const isGraduating = (toGrade === 'สำเร็จการศึกษา' || String(toGrade).includes('สำเร็จ'));
  const todayStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][3]).trim() === String(fromGrade).trim()) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 4).setValue(toGrade);
      count++;

      if (isGraduating) {
        const oldStatus = cleanVal(rows[i][7]) || 'ปกติ (กำลังศึกษา)';
        sheet.getRange(rowNum, 8).setValue('สำเร็จการศึกษา');
        sheet.getRange(rowNum, 15).setNumberFormat('@').setValue(todayStr);
        sheet.getRange(rowNum, 16).setValue('สำเร็จการศึกษาจากการเลื่อนระดับชั้น');
        logStudentStatusChange(rows[i][0], rows[i][1], fromGrade, oldStatus, 'สำเร็จการศึกษา', todayStr, 'สำเร็จการศึกษาจากการเลื่อนระดับชั้น', 'MasterAdmin');
      }
    }
  }

  return { 
    success: true, 
    message: `เลื่อนชั้นปีนักเรียนจาก ${fromGrade} ไป ${toGrade} สำเร็จจำนวน ${count} คน` + (isGraduating ? ' พร้อมบันทึกสถานะ "สำเร็จการศึกษา"' : '')
  };
}

function updateAppLogo(logoBase64) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.SETTINGS);
  if (!sheet) {
    ensureSchema();
    sheet = ss.getSheetByName(SHEETS.SETTINGS);
  }

  let logoUrl = logoBase64;
  if (logoBase64 && typeof logoBase64 === 'string' && logoBase64.startsWith('data:image')) {
    try {
      const folderName = "Khalifah_System_Assets";
      let folder;
      const folders = DriveApp.getFoldersByName(folderName);
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder(folderName);
      }
      const contentType = "image/png";
      const cleanBase64 = logoBase64.includes(',') ? logoBase64.split(',')[1] : logoBase64;
      const bytes = Utilities.base64Decode(cleanBase64);
      const fileName = `system_logo.png`;
      const existing = folder.getFilesByName(fileName);
      let file;
      if (existing.hasNext()) {
        file = existing.next();
        file.setContent(bytes);
      } else {
        file = folder.createFile(Utilities.newBlob(bytes, contentType, fileName));
      }
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      logoUrl = `https://lh3.googleusercontent.com/d/${file.getId()}`;
    } catch (err) {
      Logger.log('Drive logo save error: ' + err.message);
      if (logoBase64.length > 5000) {
        logoUrl = 'โลโก้ของระบบ (บันทึกในอุปกรณ์)';
      }
    }
  }

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === 'AppLogo') {
      sheet.getRange(i + 1, 2).setValue(logoUrl);
      return { success: true, message: 'บันทึกโลโก้ลง Google Drive และ Sheets สำเร็จ', logoUrl: logoUrl };
    }
  }
  sheet.appendRow(['AppLogo', logoUrl, 'โลโก้ของระบบ']);
  return { success: true, message: 'บันทึกโลโก้ใหม่ลง Google Drive และ Sheets สำเร็จ', logoUrl: logoUrl };
}

/**
 * บันทึกรูปภาพโปรไฟล์นักเรียนลง Google Drive โฟลเดอร์ Khalifah_Profile_Photos
 */
function saveStudentPhotoToDrive(studentId, photoBase64) {
  if (!photoBase64 || typeof photoBase64 !== 'string') return '';
  const trimmed = photoBase64.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed; // เป็น URL อยู่แล้ว (เช่น ลิงก์ Google Drive หรือ CDN)
  }
  if (!trimmed.startsWith('data:image')) {
    return ''; // ไม่ใช่รูปภาพ
  }
  try {
    const folderName = "Khalifah_Profile_Photos";
    let folder;
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }

    // PNG คงพื้นหลังโปร่งใสไว้ · อื่นๆ เก็บเป็น JPEG
    const isPng = /^data:image\/png/i.test(trimmed);
    const contentType = isPng ? "image/png" : "image/jpeg";
    const cleanBase64 = trimmed.includes(',') ? trimmed.split(',')[1] : trimmed;
    const bytes = Utilities.base64Decode(cleanBase64);
    const baseName = `profile_${studentId}`;
    ['.jpg', '.png'].forEach(function (ext) {
      const old = folder.getFilesByName(baseName + ext);
      while (old.hasNext()) { try { old.next().setTrashed(true); } catch (e) {} }
    });
    const file = folder.createFile(Utilities.newBlob(bytes, contentType, baseName + (isPng ? '.png' : '.jpg')));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return `https://lh3.googleusercontent.com/d/${file.getId()}` + (isPng ? '#png' : '');
  } catch (err) {
    Logger.log('saveStudentPhotoToDrive error: ' + err.message);
    return '';
  }
}

function updateStudentProfilePhoto(studentId, avatarUrl) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานนักเรียน' };
  const rows = sheet.getDataRange().getValues();
  
  const drivePhotoUrl = saveStudentPhotoToDrive(studentId, avatarUrl);
  if (!drivePhotoUrl) {
    return { success: false, message: 'บันทึกรูปภาพลง Google Drive ไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ Drive' };
  }

  for (let i = 1; i < rows.length; i++) {
    if (isCodeMatch(rows[i][0], studentId)) {
      sheet.getRange(i + 1, 9).setValue(drivePhotoUrl);
      return { success: true, message: 'บันทึกรูปโปรไฟล์นักเรียนลง Google Drive และ Sheets สำเร็จ', photoUrl: drivePhotoUrl };
    }
  }
  return { success: false, message: 'ไม่พบรหัสนักเรียนในระบบ' };
}

/**
 * บันทึกข้อมูลผลบุญและศาสนกิจ (อัลกุรอาน, ท่องจำซูเราะห์, ละหมาดสุนัต) ลง Google Sheet แบบผสานข้อมูลทั้ง 3 ด้านไม่ให้ทับกันเป็น 0
 */
/* ===================== v17.17 · ผลบุญ (แอดมินบันทึกรายวัน) =====================
   ค่าต่อวัน: อ่าน (หน้า) · ท่องจำใหม่ (ซูเราะห์) · สุนัต (ร็อกอะฮ์)
   ในชีต: คอลัมน์ "จำนวนซูเราะห์" เป็นยอดสะสม จึงคำนวณ ท่องจำใหม่ = สะสมวันนั้น − สะสมก่อนหน้า */
const HAS_NORM_ = function (v) { return String(cleanVal(v)).replace(/\D/g, '').replace(/^0+/, ''); };
function hasanatIndex_(rows) {
  const by = {};
  for (let i = 1; i < rows.length; i++) {
    const sid = HAS_NORM_(rows[i][1]); if (!sid) continue;
    (by[sid] = by[sid] || []).push({ i: i, date: formatSheetDate(rows[i][4]) || cleanVal(rows[i][4]), pages: Number(rows[i][5]) || 0, cur: Number(rows[i][6]) || 0, khatam: Number(rows[i][9]) || 0, mem: Number(rows[i][10]) || 0, rak: Number(rows[i][12]) || 0 });
  }
  Object.keys(by).forEach(function (k) { by[k].sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }); });
  return by;
}
function getHasanatDay_(date) {
  date = String(date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, message: 'วันที่ไม่ถูกต้อง' };
  ensureSchema();
  const sh = getSpreadsheet().getSheetByName(SHEETS.HASANAT);
  const rows = sh && sh.getLastRow() > 1 ? sh.getDataRange().getValues() : [[]];
  const by = hasanatIndex_(rows), out = {};
  Object.keys(by).forEach(function (sid) {
    const list = by[sid]; let before = null, at = null;
    list.forEach(function (r) { if (r.date < date) before = r; else if (r.date === date) at = r; });
    if (at) out[sid] = { pages: at.pages, mem: Math.max(0, at.mem - (before ? before.mem : 0)), rakaat: at.rak };
    out[sid] = Object.assign(out[sid] || { pages: 0, mem: 0, rakaat: 0 }, { totalMem: (at || before || { mem: 0 }).mem, page: (at || before || { cur: 0 }).cur, has: !!at });
  });
  return { success: true, date: date, data: out };
}
function saveHasanatBatch_(data) {
  data = data || {};
  const date = String(data.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, message: 'วันที่ไม่ถูกต้อง' };
  const entries = (Array.isArray(data.entries) ? data.entries : []).slice(0, 400);
  if (!entries.length) return { success: true, saved: 0 };
  ensureSchema();
  const ss = getSpreadsheet(); const sh = ss.getSheetByName(SHEETS.HASANAT);
  const stuRows = sheetRows_(SHEETS.STUDENTS, 4); const info = {};
  stuRows.forEach(function (r) { const k = HAS_NORM_(r[0]); if (k) info[k] = { id: cleanVal(r[0]), name: cleanVal(r[1]), grade: cleanVal(r[3]) }; });
  const lock = LockService.getScriptLock(); try { lock.waitLock(20000); } catch (e) { return { success: false, message: 'ระบบกำลังบันทึก ลองใหม่อีกครั้ง' }; }
  try {
    const rows = sh.getLastRow() > 1 ? sh.getDataRange().getValues() : [[]];
    const by = hasanatIndex_(rows);
    const now = new Date().toISOString();
    const updates = [], appends = []; let saved = 0;
    entries.forEach(function (e) {
      const sid = HAS_NORM_(e.studentId); if (!sid || !info[sid]) return;
      const pages = Math.max(0, Math.min(604, Math.round(Number(e.pages) || 0)));
      const mem = Math.max(0, Math.min(114, Math.round(Number(e.mem) || 0)));
      const rak = Math.max(0, Math.min(200, Math.round(Number(e.rakaat) || 0)));
      const list = by[sid] || []; let before = null, at = null; const after = [];
      list.forEach(function (r) { if (r.date < date) before = r; else if (r.date === date) at = r; else after.push(r); });
      if (!at && !pages && !mem && !rak) return;
      const prevMem = before ? before.mem : 0, prevPage = before ? before.cur : 0, prevKh = before ? before.khatam : 0;
      let cur = prevPage + pages, kh = prevKh; while (cur > 604) { cur -= 604; kh++; }
      const newMem = Math.min(114, prevMem + mem);
      const oldMem = at ? at.mem : prevMem, oldCur = at ? at.cur : prevPage;
      const dMem = newMem - oldMem, dCur = cur - oldCur;
      if (at) updates.push({ i: at.i, vals: { 5: pages, 6: cur || 1, 7: Math.floor(cur / 20.13), 9: kh, 10: newMem, 12: rak, 14: now } });
      else appends.push(['HAS-' + Date.now() + '-' + sid, formatAsText(info[sid].id), info[sid].name, info[sid].grade, date, pages, cur || 1, Math.floor(cur / 20.13), 0, kh, newMem, '', rak, '{}', now]);
      after.forEach(function (r) { if (dMem || dCur) updates.push({ i: r.i, vals: { 10: Math.max(0, Math.min(114, r.mem + dMem)), 6: Math.max(1, Math.min(604, r.cur + dCur)) } }); });
      saved++;
    });
    updates.forEach(function (u) { Object.keys(u.vals).forEach(function (c) { sh.getRange(u.i + 1, Number(c) + 1).setValue(u.vals[c]); }); });
    if (appends.length) { const start = sh.getLastRow() + 1; sh.getRange(start, 1, appends.length, 15).setValues(appends); sh.getRange(start, 2, appends.length, 1).setNumberFormat('@'); }
    return { success: true, saved: saved, message: 'บันทึกผลบุญ ' + saved + ' คนแล้ว' };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

// v18.56 · คอลัมน์ที่ 16 "ผู้บันทึก" (นักเรียน / แอดมิน · ชื่อ)
function hasanatBy_(sheet, row, by) {
  if (!by || !sheet) return;
  try { if (sheet.getMaxColumns() < 16) sheet.insertColumnsAfter(sheet.getMaxColumns(), 16 - sheet.getMaxColumns()); if (!cleanVal(sheet.getRange(1, 16).getValue())) sheet.getRange(1, 16).setValue('ผู้บันทึก'); sheet.getRange(row, 16).setValue(String(by).substring(0, 80)); } catch (e) {}
}
function recordHasanat(data, by) {
  if (!data) return { success: false, message: 'ไม่มีข้อมูลผลบุญ' };
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.HASANAT);
  
  const cleanSid = formatAsText(data.studentId);
  if (!cleanSid) return { success: false, message: 'ไม่พบรหัสนักเรียน' };
  const timestamp = new Date().toISOString();
  const dateStr = formatSheetDate(data.date) || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");

  // ดึงข้อมูลสะสมล่าสุดของนักเรียนคนนี้จากแผ่นงานเพื่อไม่ให้ค่าสะสม (เช่น currentPage, stars, memorizedSurahs) ถูกรีเซ็ตเป็น 0
  const hasanatMap = getLatestHasanatMapByStudent(ss);
  const prev = hasanatMap[cleanSid] || {
    quran: { pagesToday: 0, currentPage: 1, juzCompleted: 0, stars: 0, khatamCount: 0 },
    memorization: { count: 0, memorizedSurahs: [] },
    sunnah: { totalRakaat: 0, rawatib: {} }
  };

  const qIn = data.quran || {};
  const mIn = data.memorization || {};
  const sIn = data.sunnah || {};

  const pagesToday = (qIn.pagesToday !== undefined) ? qIn.pagesToday : ((data.pagesToday !== undefined) ? data.pagesToday : prev.quran.pagesToday);
  const currentPage = (qIn.currentPage !== undefined) ? qIn.currentPage : ((data.currentPage !== undefined) ? data.currentPage : prev.quran.currentPage);
  const juzCompleted = (qIn.juzCompleted !== undefined) ? qIn.juzCompleted : ((data.juzCompleted !== undefined) ? data.juzCompleted : prev.quran.juzCompleted);
  const stars = (qIn.stars !== undefined) ? qIn.stars : ((data.stars !== undefined) ? data.stars : prev.quran.stars);
  const khatamCount = (qIn.khatamCount !== undefined) ? qIn.khatamCount : ((data.khatamCount !== undefined) ? data.khatamCount : prev.quran.khatamCount);

  const memSurahs = Array.isArray(mIn.memorizedSurahs)
    ? mIn.memorizedSurahs
    : (Array.isArray(data.memorizedSurahs) ? data.memorizedSurahs : prev.memorization.memorizedSurahs);
  const memCount = (mIn.count !== undefined)
    ? mIn.count
    : ((data.count !== undefined) ? data.count : ((data.memorizedCount !== undefined) ? data.memorizedCount : memSurahs.length));

  const totalRakaat = (sIn.totalRakaat !== undefined) ? sIn.totalRakaat : ((data.totalRakaat !== undefined) ? data.totalRakaat : prev.sunnah.totalRakaat);
  const rawatibObj = sIn.rawatib || data.rawatib || prev.sunnah.rawatib || {};

  const memListStr = Array.isArray(memSurahs) ? memSurahs.join(', ') : String(memSurahs || '');
  const sunnahDetailsStr = JSON.stringify(rawatibObj);

  // ค้นหาว่ามีแถวของนักเรียนคนนี้ในวันนี้หรือยัง ถ้ามีให้อัปเดตแถวเดิมแทนการสร้างซ้ำ
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    const rSid = cleanVal(rows[i][1]);
    const rDate = formatSheetDate(rows[i][4]);
    if (isCodeMatch(rSid, cleanSid) && rDate === dateStr) {
      const existingLogId = cleanVal(rows[i][0]) || ('HAS-' + new Date().getTime());
      const rowValues = [
        existingLogId,
        cleanSid,
        data.studentName || cleanVal(rows[i][2]) || '',
        data.grade || cleanVal(rows[i][3]) || '',
        dateStr,
        pagesToday || 0,
        currentPage || 1,
        juzCompleted || 0,
        stars || 0,
        khatamCount || 0,
        memCount || 0,
        memListStr,
        totalRakaat || 0,
        sunnahDetailsStr,
        timestamp
      ];
      sheet.getRange(i + 1, 1, 1, 15).setValues([rowValues]);
      sheet.getRange(i + 1, 2).setNumberFormat('@').setValue(cleanSid);
      hasanatBy_(sheet, i + 1, by);
      return {
        success: true,
        updated: true,
        message: 'อัปเดตข้อมูลผลบุญและศาสนกิจสำเร็จเรียบร้อย',
        logId: existingLogId,
        stars: stars || 0
      };
    }
  }

  const logId = 'HAS-' + new Date().getTime();
  sheet.appendRow([
    logId,
    cleanSid,
    data.studentName || '',
    data.grade || '',
    dateStr,
    pagesToday || 0,
    currentPage || 1,
    juzCompleted || 0,
    stars || 0,
    khatamCount || 0,
    memCount || 0,
    memListStr,
    totalRakaat || 0,
    sunnahDetailsStr,
    timestamp
  ]);
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 2).setNumberFormat('@').setValue(cleanSid);
  hasanatBy_(sheet, lastRow, by);

  return { 
    success: true, 
    message: 'บันทึกข้อมูลผลบุญและศาสนกิจสำเร็จเรียบร้อย', 
    logId: logId,
    stars: stars || 0
  };
}

function getHasanat(studentId) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.HASANAT);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [], byStudent: {} };
  const rows = readAllRows_(sheet);
  const targetSid = cleanVal(studentId || '');
  const list = [];

  for (let i = 1; i < rows.length; i++) {
    const sid = cleanVal(rows[i][1]);
    if (!sid) continue;
    if (targetSid && !isCodeMatch(sid, targetSid)) continue;
    let rawatib = {};
    try {
      if (rows[i][13]) rawatib = JSON.parse(rows[i][13]);
    } catch (e) {}
    const memStr = cleanVal(rows[i][11]);
    const memArr = memStr ? memStr.split(',').map(s => s.trim()).filter(Boolean) : [];

    list.push({
      logId: cleanVal(rows[i][0]),
      studentId: sid,
      studentName: cleanVal(rows[i][2]),
      grade: cleanVal(rows[i][3]),
      date: formatSheetDate(rows[i][4]),
      by: cleanVal(rows[i][15] || ''),
      quran: {
        pagesToday: Number(rows[i][5]) || 0,
        currentPage: Number(rows[i][6]) || 1,
        juzCompleted: Number(rows[i][7]) || 0,
        stars: Number(rows[i][8]) || 0,
        khatamCount: Number(rows[i][9]) || 0
      },
      memorization: {
        count: Number(rows[i][10]) || memArr.length,
        memorizedSurahs: memArr
      },
      sunnah: {
        totalRakaat: Number(rows[i][12]) || 0,
        rawatib: rawatib
      },
      timestamp: cleanVal(rows[i][14])
    });
  }

  return {
    success: true,
    data: list,
    byStudent: getLatestHasanatMapByStudent(ss)
  };
}

/**
 * ซิงค์ข้อมูลทั้งหมด (นักเรียน, บุคลากร, กิจกรรม, ละหมาด, ผลบุญ, มาเรียน, รายวิชา) เข้า Google Sheet ในคราวเดียว
 */
function batchSyncData(data) {
  ensureSchema();
  const ss = getSpreadsheet();
  let studentsSynced = 0;
  let prayersSynced = 0;
  let hasanatSynced = 0;
  let adminsSynced = 0;
  let activitiesSynced = 0;

  // 1. Sync นักเรียน (ทั้งเพิ่มใหม่และอัปเดตแถวเดิมครบทุกคอลัมน์)
  if (data.students && Array.isArray(data.students)) {
    data.students.forEach(s => {
      if (s && s.studentId) {
        registerStudent(s);
        studentsSynced++;
      }
    });
  }

  // 2. Sync บุคลากร/อาจารย์ (subAdmins)
  if (data.subAdmins && Array.isArray(data.subAdmins)) {
    data.subAdmins.forEach(adm => {
      if (adm && adm.username) {
        addSubAdmin(adm);
        adminsSynced++;
      }
    });
  }

  // 3. Sync กิจกรรม
  if (data.activities && Array.isArray(data.activities)) {
    data.activities.forEach(act => {
      if (act && (act.id || act.activityId || act.title)) {
        createActivity(act);
        activitiesSynced++;
      }
    });
  }

  // 4. Sync บันทึกละหมาด
  if (data.prayers && Array.isArray(data.prayers)) {
    data.prayers.forEach(p => {
      if (p && p.studentId) {
        recordPrayer(p);
        prayersSynced++;
      }
    });
  }

  // 5. Sync ผลบุญ
  if (data.hasanat && Array.isArray(data.hasanat)) {
    data.hasanat.forEach(h => {
      if (h && h.studentId) {
        recordHasanat(h);
        hasanatSynced++;
      }
    });
  }

  // 6. Sync รายวิชา (Subjects)
  if (data.subjects && Array.isArray(data.subjects)) {
    saveSubjects({ subjects: data.subjects });
  }

  return {
    success: true,
    message: 'ซิงค์ข้อมูลทุกหมวดลง Google Sheets สำเร็จเรียบร้อยแล้ว',
    summary: {
      students: studentsSynced,
      subAdmins: adminsSynced,
      activities: activitiesSynced,
      prayers: prayersSynced,
      hasanat: hasanatSynced
    }
  };
}

// ==========================================
// V4.0 - V4.5: ระบบยืนยันตัวตนผ่านแอดมิน (Random OTP + Email), อาจารย์ผู้สอน, รายวิชา, และการตั้งค่าทั้งหมด
// ==========================================

function ensureApprovalsSheet() {
  const ss = getSpreadsheet();
  const sheetName = 'รายการรออนุมัติสมัคร';
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow([
      'รหัสคำขอ', 'ประเภทผู้ใช้', 'รหัสประจำตัว', 'ชื่อ-นามสกุล', 'อีเมล',
      'รายละเอียดเพิ่มเติม', 'รหัสยืนยันสุ่ม (OTP)', 'สถานะ', 'เวลาที่สมัคร', 'ข้อมูล JSON'
    ]);
  }
  return sheet;
}

/**
 * บันทึกคำขอสมัครสมาชิกใหม่ (นักเรียน / อาจารย์ผู้สอน) พร้อมรหัสสุ่ม 6 หลักสำหรับแอดมินอนุมัติ
 */
function sanitizeRegistrationPayload_(role, payload, fallback) {
  const p = payload || {};
  const f = fallback || {};
  if (role === 'teacher') {
    const pw = cleanVal(p.password || '');
    return {
      adminId: cleanVal(p.adminId || p.id || ''),
      username: cleanVal(p.username || f.userId || ''),
      password: pw ? (isHashedPassword_(pw) ? pw : hashPassword_(pw)) : '',
      fullName: cleanVal(p.fullName || f.fullName || ''),
      email: cleanVal(p.email || f.email || ''),
      phone: normalizePhone(p.phone || f.phone || ''),
      role: 'TEACHER', // สมัครเองได้เฉพาะสิทธิ์อาจารย์ผู้สอน (แอดมินปรับสิทธิ์ภายหลังได้)
      assignedSubjects: Array.isArray(p.assignedSubjects) ? p.assignedSubjects.map(cleanVal).slice(0, 50) : [],
      createdAt: cleanVal(p.createdAt || '')
    };
  }
  return {
    studentId: cleanVal(p.studentId || f.userId || ''),
    fullName: cleanVal(p.fullName || f.fullName || ''),
    schoolName: cleanVal(p.schoolName || ''),
    grade: cleanVal(p.grade || ''),
    birthDate: normalizeBirthDate(p.birthDate || ''),
    parentPhone: normalizePhone(p.parentPhone || p.phone || f.phone || ''),
    email: cleanVal(p.email || f.email || ''),
    gender: normGender_(p.gender),
    avatarUrl: (typeof p.avatarUrl === 'string' && p.avatarUrl.length < 300000) ? p.avatarUrl : ''
  };
}

/**
 * บันทึกคำขอสมัครสมาชิกใหม่ (นักเรียน / อาจารย์ผู้สอน)
 * - รหัส OTP สุ่มโดยเซิร์ฟเวอร์ และไม่ส่งกลับไปยังผู้สมัคร (ส่งทางอีเมลหลังแอดมินอนุมัติเท่านั้น)
 * - บุคลากร (มี token) สามารถสั่งสุ่มรหัสใหม่ได้
 */
function registerPendingUser(data, byStaff) {
  data = data || {};
  const sheet = ensureApprovalsSheet();
  const role = cleanVal(data.role || 'student') === 'teacher' ? 'teacher' : 'student';
  const userId = cleanVal(data.userId || '');
  if (!userId) return { success: false, message: 'ไม่พบรหัสประจำตัวผู้สมัคร' };
  const fullName = cleanVal(data.fullName || '');
  const email = cleanVal(data.email || '');
  const detail = cleanVal(data.gradeOrSubj || data.detail || '');
  const requestedAt = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");

  const rows = sheet.getDataRange().getValues();
  let updatedRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (isCodeMatch(rows[i][2], userId) && cleanVal(rows[i][1]) === role) {
      updatedRow = i + 1;
      break;
    }
  }

  if (!byStaff) {
    // ป้องกันการสมัครทับบัญชีที่มีอยู่แล้ว หรือคำขอที่แอดมินอนุมัติไปแล้ว
    if (updatedRow !== -1) {
      const st = cleanVal(rows[updatedRow - 1][7]);
      if (st === 'Approved' || st === 'Verified') {
        return { success: false, message: 'รหัสนี้ได้รับการอนุมัติแล้ว กรุณากรอกรหัสยืนยันจากอีเมล หรือเข้าสู่ระบบ' };
      }
    }
    ensureSchema();
    const ss = getSpreadsheet();
    if (role === 'student') {
      const st = ss.getSheetByName(SHEETS.STUDENTS);
      const ids = st && st.getLastRow() > 1 ? st.getRange(2, 1, st.getLastRow() - 1, 1).getValues() : [];
      if (ids.some(function (r) { return isCodeMatch(r[0], userId); })) {
        return { success: false, exists: true, message: 'รหัสนักเรียนนี้มีบัญชีในระบบแล้ว กรุณาเข้าสู่ระบบ' };
      }
    } else {
      const exists = [SHEETS.TEACHERS, SHEETS.ADMINS].some(function (n) {
        const sh = ss.getSheetByName(n);
        if (!sh || sh.getLastRow() < 2) return false;
        return sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().some(function (r) { return cleanVal(r[0]).toLowerCase() === userId.toLowerCase(); });
      });
      if (exists) return { success: false, exists: true, message: 'ชื่อผู้ใช้นี้มีบัญชีในระบบแล้ว กรุณาเข้าสู่ระบบ' };
    }
  }

  const reqId = (updatedRow !== -1 ? cleanVal(rows[updatedRow - 1][0]) : '') || cleanVal(data.reqId || data.id || ('REQ-' + new Date().getTime()));
  const otpCode = (byStaff && /^\d{6}$/.test(cleanVal(data.otpCode || ''))) ? cleanVal(data.otpCode) : String(Math.floor(100000 + Math.random() * 900000));
  const status = byStaff ? cleanVal(data.status || 'PendingAdmin') : 'PendingAdmin';

  let payloadObj = data.payload || {};
  if (byStaff && updatedRow !== -1) {
    // บุคลากรสั่งสุ่มรหัสใหม่: คงข้อมูลเดิมไว้ (รวมถึงรหัสผ่านที่แฮชแล้วซึ่งไม่ได้ส่งไปที่เบราว์เซอร์)
    let stored = {};
    try { stored = JSON.parse(rows[updatedRow - 1][9] || '{}'); } catch (e) {}
    payloadObj = Object.assign({}, stored);
    Object.keys(data.payload || {}).forEach(function (k) {
      const v = data.payload[k];
      if (v !== undefined && v !== null && v !== '' && k !== 'password') payloadObj[k] = v;
    });
  }
  const cleanPayload = sanitizeRegistrationPayload_(role, payloadObj, { userId: userId, fullName: fullName, email: email, phone: data.phone });

  const rowValues = [
    reqId, role, userId, fullName, email, detail, otpCode, status, requestedAt, JSON.stringify(cleanPayload)
  ];

  if (updatedRow !== -1) {
    sheet.getRange(updatedRow, 1, 1, rowValues.length).setValues([rowValues]);
    sheet.getRange(updatedRow, 3).setNumberFormat('@').setValue(userId);
    sheet.getRange(updatedRow, 7).setNumberFormat('@').setValue(otpCode);
  } else {
    sheet.appendRow(rowValues);
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 3).setNumberFormat('@').setValue(userId);
    sheet.getRange(lastRow, 7).setNumberFormat('@').setValue(otpCode);
  }

  const out = {
    success: true,
    message: 'บันทึกคำขอสมัครเรียบร้อย รอแอดมินอนุมัติและส่งรหัสยืนยันทางอีเมล',
    reqId: reqId,
    status: status
  };
  if (byStaff) out.otpCode = otpCode;
  return out;
}

function deletePendingRegistration(data) {
  const sheet = ensureApprovalsSheet();
  const targetReqId = cleanVal(data.reqId || data.id || '');
  const targetUserId = cleanVal(data.userId || '');
  if (!targetReqId && !targetUserId) return { success: false, message: 'ไม่พบคำขอสมัครที่ต้องการลบ' };
  const n = deleteRowsWhere_(sheet, function (r) { return (targetReqId && cleanVal(r[0]) === targetReqId) || (targetUserId && isCodeMatch(cleanVal(r[2]), targetUserId)); });
  return { success: true, deleted: n, message: n ? 'ลบคำขอสมัครออกจากฐานข้อมูลเรียบร้อยแล้ว' : 'ไม่มีคำขอสมัครนี้แล้ว' };
}

/**
 * แอดมินกดยินยอม (Approve) และส่งรหัสยืนยันแบบสุ่มเข้าอีเมลของผู้สมัครอัตโนมัติทันที
 */
function approveRegistrationAndSendEmail(data) {
  const sheet = ensureApprovalsSheet();
  const email = cleanVal(data.email || '');
  const fullName = cleanVal(data.fullName || 'ผู้สมัคร');
  const userId = cleanVal(data.userId || '');
  const role = cleanVal(data.role || 'student');
  const roleLabel = cleanVal(data.roleLabel || (role === 'teacher' ? 'อาจารย์ผู้สอน' : 'นักเรียน'));
  let otpCode = /^\d{6}$/.test(cleanVal(data.otpCode || '')) ? cleanVal(data.otpCode) : '';
  const reqId = cleanVal(data.reqId || data.id || '');
  let storedPayload = null;

  // อัปเดตสถานะในแผ่นงานรายการรออนุมัติสมัคร (ใช้รหัส OTP ที่เซิร์ฟเวอร์เก็บไว้เป็นหลัก)
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if ((reqId && cleanVal(rows[i][0]) === reqId) || (userId && isCodeMatch(rows[i][2], userId))) {
      if (!otpCode) otpCode = /^\d{6}$/.test(cleanVal(rows[i][6])) ? cleanVal(rows[i][6]) : String(Math.floor(100000 + Math.random() * 900000));
      try { storedPayload = rows[i][9] ? JSON.parse(rows[i][9]) : null; } catch (e) {}
      sheet.getRange(i + 1, 7).setNumberFormat('@').setValue(otpCode);
      sheet.getRange(i + 1, 8).setValue('Approved');
      break;
    }
  }
  if (!otpCode) otpCode = String(Math.floor(100000 + Math.random() * 900000));

  // บันทึกข้อมูลเบื้องต้นพร้อมสถานะ AwaitingOtp (ต้องรอผู้สมัครกรอกรหัส OTP 6 หลักจากอีเมลก่อนจึงจะเข้าสู่ระบบได้)
  try {
    const basePayload = sanitizeRegistrationPayload_(role, storedPayload || data.payload || {}, { userId: userId, fullName: fullName, email: email });
    if (basePayload) {
      const pendingPayload = Object.assign({}, basePayload, { approvalStatus: 'AwaitingOtp', status: 'รอผู้สมัครกรอกรหัส OTP' });
      if (role === 'student') {
        registerStudent(pendingPayload);
      } else if (role === 'teacher') {
        addSubAdmin(pendingPayload);
      }
    }
  } catch (syncErr) {}

  // ส่งอีเมลอัตโนมัติผ่าน GmailApp / MailApp พร้อมโครงสร้าง Multipart (Plain Text + HTML) และชื่อผู้ส่ง KHALIFAH PROGRAM เพื่อป้องกันการเข้าจดหมายขยะ (Spam)
  let emailSent = false;
  let emailError = '';
  let quotaLeft = -1;
  try { quotaLeft = MailApp.getRemainingDailyQuota(); } catch (e) {}
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) emailError = 'อีเมลของผู้สมัครไม่ถูกต้อง (' + (email || 'ว่าง') + ')';
  else if (quotaLeft === 0) emailError = 'โควตาส่งอีเมลของวันนี้หมดแล้ว (Google จำกัดจำนวนต่อวัน) · ให้แจ้งรหัสกับผู้สมัครโดยตรง หรือส่งใหม่พรุ่งนี้';
  if (!emailError) {
    // อีเมลสั้น เรียบ เหมือนจดหมายจากคน (ลดโอกาสเข้าจดหมายขยะ): หัวเรื่องสั้น ไม่มีรูป ไม่มีปุ่ม HTML หนัก ๆ เนื้อหา text/HTML ตรงกัน
    const senderName = 'KHALIFAH โรงเรียน';
    const subject = 'รหัสยืนยันบัญชี KHALIFAH ของ ' + fullName;
    const plainBody =
      'อัสสลามุอะลัยกุม ' + fullName + '\n\n' +
      'บัญชี' + roleLabel + ' รหัส ' + userId + ' ได้รับการอนุมัติแล้ว\n' +
      'รหัสยืนยันของคุณคือ ' + otpCode + '\n\n' +
      'นำรหัสนี้ไปกรอกในแอป KHALIFAH (khalifah-program.vercel.app) ที่หน้า "มีรหัสยืนยัน 6 หลักจากอีเมลแล้ว"\n' +
      'ถ้าไม่ได้สมัคร ไม่ต้องทำอะไร\n\n' +
      'ฝ่ายทะเบียน KHALIFAH';
    const h_ = function (v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    const htmlBody =
      '<div style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.7;color:#111">' +
      '<p>อัสสลามุอะลัยกุม ' + h_(fullName) + '</p>' +
      '<p>บัญชี' + h_(roleLabel) + ' รหัส ' + h_(userId) + ' ได้รับการอนุมัติแล้ว<br>รหัสยืนยันของคุณคือ <b style="font-size:20px;letter-spacing:2px">' + otpCode + '</b></p>' +
      '<p>นำรหัสนี้ไปกรอกในแอป KHALIFAH (khalifah-program.vercel.app) ที่หน้า "มีรหัสยืนยัน 6 หลักจากอีเมลแล้ว"<br>ถ้าไม่ได้สมัคร ไม่ต้องทำอะไร</p>' +
      '<p>ฝ่ายทะเบียน KHALIFAH</p></div>';
    let replyTo = '';
    try { replyTo = Session.getEffectiveUser().getEmail() || ''; } catch (e) {}

    try {
      const opt = { htmlBody: htmlBody, name: senderName };
      if (replyTo) opt.replyTo = replyTo;
      GmailApp.sendEmail(email, subject, plainBody, opt);
      emailSent = true;
    } catch (gmailErr) {
      try {
        MailApp.sendEmail({
          to: email,
          name: senderName,
          subject: subject,
          body: plainBody,
          htmlBody: htmlBody
        });
        emailSent = true;
      } catch (mailErr) {
        emailError = /authoriz|permission|สิทธิ์/i.test(String(mailErr)) ? 'Apps Script ยังไม่ได้รับสิทธิ์ส่งอีเมล · เปิด Apps Script แล้วกด Run ฟังก์ชัน authorizeEmailPermission หนึ่งครั้ง' : String(mailErr && mailErr.message || mailErr);
      }
    }
  }
  logEmail_(email, 'OTP ' + roleLabel + ' ' + userId, emailSent, emailError, quotaLeft);

  return {
    success: true,
    emailSent: emailSent,
    emailError: emailError,
    email: email,
    quotaLeft: quotaLeft,
    otpCode: otpCode,
    message: emailSent
      ? 'อนุมัติและส่งรหัสยืนยัน (' + otpCode + ') ไปยังอีเมล ' + email + ' เรียบร้อยแล้ว'
      : 'อนุมัติเรียบร้อยแล้ว แต่ส่งอีเมลไม่สำเร็จ: ' + emailError
  };
}

/** บันทึกประวัติการส่งอีเมลลงแผ่นงาน "EmailLog" ไว้ตรวจย้อนหลังว่าส่งออกจริงหรือไม่ */
function logEmail_(to, what, ok, err, quota) {
  try {
    const ss = getSpreadsheet();
    let sh = ss.getSheetByName('EmailLog');
    if (!sh) { sh = ss.insertSheet('EmailLog'); sh.appendRow(['เวลา', 'ถึง', 'เรื่อง', 'สถานะ', 'ข้อผิดพลาด', 'โควตาคงเหลือ']); sh.setFrozenRows(1); }
    sh.appendRow([Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'), to || '', what || '', ok ? 'ส่งแล้ว' : 'ไม่สำเร็จ', err || '', quota]);
    if (sh.getLastRow() > 1000) sh.deleteRows(2, sh.getLastRow() - 1000);
  } catch (e) {}
}

/**
 * ผู้สมัครกรอกรหัส OTP 6 หลักที่ได้รับทางอีเมลเพื่อเปิดใช้งานบัญชีอย่างสมบูรณ์ (Verified)
 */
function verifyUserOtp(data) {
  data = data || {};
  const sheet = ensureApprovalsSheet();
  const reqId = cleanVal(data.reqId || data.id || '');
  const userId = cleanVal(data.userId || '');
  const role = cleanVal(data.role || '');
  const enteredOtp = cleanVal(data.otpCode || '');

  if (!/^\d{6}$/.test(enteredOtp)) {
    return { success: false, message: 'กรุณากรอกรหัสยืนยัน 6 หลักให้ครบถ้วน' };
  }
  let rlKey = 'otp_' + (userId || reqId).toLowerCase();
  if (loginLocked_(rlKey)) return { success: false, locked: true, message: LOCKED_MESSAGE };

  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    const rReqId = cleanVal(rows[i][0]);
    const rRole = cleanVal(rows[i][1]);
    const rUserId = cleanVal(rows[i][2]);
    const rOtp = cleanVal(rows[i][6]);
    const rStatus = cleanVal(rows[i][7]);

    const matchUser = (reqId && rReqId === reqId) || (userId && isCodeMatch(rUserId, userId) && (!role || rRole === role));
    if (!matchUser) continue;
    // นับการเดาผิดตามคำขอจริง ไม่ว่าจะอ้างด้วยรหัสคำขอหรือรหัสผู้ใช้ (กันสลับวิธีอ้างเพื่อเดาต่อ)
    if (rReqId) { rlKey = 'otp_req_' + rReqId.toLowerCase(); if (loginLocked_(rlKey)) return { success: false, locked: true, message: LOCKED_MESSAGE }; }

    if (rStatus === 'PendingAdmin') {
      return {
        success: false,
        status: 'PendingAdmin',
        message: 'บัญชียังอยู่ระหว่างรอแอดมินกดอนุมัติและส่งรหัสยืนยันเข้าอีเมล กรุณารอรับอีเมลก่อน'
      };
    }
    if (rStatus === 'Verified') {
      return { success: false, status: 'Verified', alreadyVerified: true, role: rRole, message: 'บัญชีนี้ยืนยันตัวตนแล้ว กรุณาเข้าสู่ระบบตามปกติ' };
    }
    if (!safeEquals_(rOtp, enteredOtp)) {
      loginFailed_(rlKey);
      return {
        success: false,
        status: rStatus,
        message: 'รหัสยืนยัน 6 หลักไม่ถูกต้อง กรุณาตรวจสอบรหัสในอีเมลของท่านอีกครั้ง'
      };
    }
    loginSucceeded_(rlKey);

    // รหัสถูกต้องและแอดมินอนุมัติแล้ว -> เปลี่ยนสถานะเป็น Verified
    sheet.getRange(i + 1, 8).setValue('Verified');

    let stored = {};
    try { stored = rows[i][9] ? JSON.parse(rows[i][9]) : {}; } catch (e) {}
    const payload = sanitizeRegistrationPayload_(rRole, stored, { userId: rUserId, fullName: cleanVal(rows[i][3]), email: cleanVal(rows[i][4]) });

    let profile = null;
    let token = '';
    if (rRole === 'student') {
      payload.studentId = payload.studentId || rUserId;
      payload.status = 'Active';
      payload.approvalStatus = 'Verified';
      const res = registerStudent(payload);
      profile = (res && res.student) ? res.student : payload;
      token = issueToken_('student', profile.studentId || rUserId, profile.fullName || '');
    } else {
      payload.username = payload.username || rUserId;
      payload.status = 'ปฏิบัติหน้าที่ปกติ';
      addSubAdmin(payload);
      profile = publicStaff_(Object.assign({}, payload, { approvalStatus: 'Verified', status: 'Active' }), true);
      token = issueToken_('teacher', payload.username, payload.fullName || '');
    }

    return {
      success: true,
      status: 'Verified',
      role: rRole,
      userId: rUserId,
      token: token,
      profile: profile,
      payload: profile,
      message: 'ยืนยันรหัส OTP สำเร็จ บัญชีของท่านพร้อมใช้งานแล้ว'
    };
  }

  return { success: false, message: 'ไม่พบรายการคำขอสมัครในระบบ' };
}

/**
 * ตรวจสอบสถานะการอนุมัติของผู้สมัครจากรหัสประจำตัว
 */
function checkRegistrationStatus(userId, role) {
  const sheet = ensureApprovalsSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (isCodeMatch(rows[i][2], userId) && (!role || cleanVal(rows[i][1]) === cleanVal(role))) {
      let payload = {};
      try {
        payload = rows[i][9] ? JSON.parse(rows[i][9]) : {};
      } catch (e) {}
      const regObj = {
        reqId: cleanVal(rows[i][0]),
        role: cleanVal(rows[i][1]),
        userId: cleanVal(rows[i][2]),
        fullName: cleanVal(rows[i][3]),
        email: cleanVal(rows[i][4]),
        gradeOrSubj: cleanVal(rows[i][5]),
        otpCode: cleanVal(rows[i][6]),
        status: cleanVal(rows[i][7]),
        requestedAt: cleanVal(rows[i][8]),
        payload: payload
      };
      return {
        success: true,
        status: regObj.status,
        otpCode: regObj.otpCode,
        userId: regObj.userId,
        role: regObj.role,
        registration: regObj
      };
    }
  }
  return { success: false, status: 'not_found' };
}

function getPendingRegistrations() {
  const sheet = ensureApprovalsSheet();
  const rows = readAllRows_(sheet);
  const list = [];
  for (let i = 1; i < rows.length; i++) {
    const reqId = cleanVal(rows[i][0]);
    const userId = cleanVal(rows[i][2]);
    if (!reqId && !userId) continue;
    let payload = {};
    try {
      payload = rows[i][9] ? JSON.parse(rows[i][9]) : {};
    } catch (e) {}
    list.push({
      reqId: reqId,
      id: reqId,
      role: cleanVal(rows[i][1]),
      userId: userId,
      fullName: cleanVal(rows[i][3]),
      email: cleanVal(rows[i][4]),
      phone: cleanVal(payload.phone || payload.parentPhone || ''),
      gradeOrSubj: cleanVal(rows[i][5]),
      detail: cleanVal(rows[i][5]),
      otpCode: cleanVal(rows[i][6]),
      status: cleanVal(rows[i][7]),
      requestedAt: cleanVal(rows[i][8]),
      payload: payload
    });
  }
  return { success: true, data: list };
}

/**
 * แอดมินสูงสุดแก้ไขข้อมูลนักเรียนเชิงลึกครบทุกส่วน
 */
function updateStudentFull(student) {
  if (!student || !student.studentId) {
    return { success: false, error: 'ไม่พบรหัสนักเรียน' };
  }
  // v17.90 · แอดมินแก้รหัสนักเรียน: เปลี่ยนรหัสในแถวเดิม (เดิมสร้างแถวใหม่ แถวรหัสเก่ายังอยู่ แล้วค่าเก่าเด้งกลับ)
  const oldId = cleanVal(student.originalId || '');
  const newId = cleanVal(student.studentId);
  if (oldId && !isCodeMatch(oldId, newId)) {
    const sh = getSpreadsheet().getSheetByName(SHEETS.STUDENTS);
    if (sh && sh.getLastRow() > 1) {
      const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
      let oldRow = -1, clash = false;
      for (let i = 0; i < ids.length; i++) { if (isCodeMatch(ids[i][0], newId)) clash = true; if (oldRow === -1 && isCodeMatch(ids[i][0], oldId)) oldRow = i + 2; }
      if (clash) return { success: false, duplicate: true, message: 'มีรหัสนักเรียน ' + newId + ' อยู่ในระบบแล้ว' };
      if (oldRow !== -1) sh.getRange(oldRow, 1).setNumberFormat('@').setValue(newId);
    }
  }
  const copy = Object.assign({}, student); delete copy.originalId;
  return registerStudent(copy);
}

/**
 * อาจารย์ผู้สอนบันทึกเช็คชื่อมาเรียนรายวัน พร้อมอัปเดตสถิติมาเรียนในแผ่นงานรายชื่อนักเรียน
 */
function saveDailyAttendance(data) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  const sheetStudents = ss.getSheetByName(SHEETS.STUDENTS);
  const dateStr = formatSheetDate(data.date) || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
  const gradeStr = cleanVal(data.grade || '');
  const records = data.records || {};
  const studentDetails = data.studentDetails || {};
  const timeStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "HH:mm:ss");
  // v17.69 · สอนแทน: ผู้ที่สอนแทนอาจารย์ประจำวิชา → บันทึกว่า "เช็คชื่อแทน"
  const subFor = cleanVal(data.subFor || '').substring(0, 80);
  const teacherNote = subFor ? 'เช็คชื่อแทน ' + subFor + ' (โดย ' + cleanVal(data.teacherName || data.teacherId || '') + ')' : 'เช็คชื่อโดยอาจารย์ (' + cleanVal(data.teacherId || 'admin') + ')';
  const subjCode = cleanVal(data.subjectCode || '');
  const subjName = cleanVal(data.subjectName || '');
  const checkedBy = cleanVal(data.teacherName || data.teacherId || '');
  // v17.90 · แยกตามคาบ: วิชาเดียวกันวันเดียวกันหลายคาบ ไม่ทับกัน (เดิมคาบ 2 ไปอ่าน/เขียนทับคาบ 1)
  const period = cleanVal(data.period || '').replace(/[^0-9]/g, '').substring(0, 2);
  if (period && sheet.getLastColumn() < 12) sheet.getRange(1, 12).setValue('คาบ');
  let count = 0;

  const studentRows = sheetStudents ? sheetStudents.getDataRange().getValues() : [];
  const studentNameMap = {};
  const studentGradeMap = {};
  for (let i = 1; i < studentRows.length; i++) {
    const sid = cleanVal(studentRows[i][0]);
    studentNameMap[sid] = cleanVal(studentRows[i][1]);
    studentGradeMap[sid] = cleanVal(studentRows[i][3]);
  }

  const existingAttRows = sheet.getDataRange().getValues();

  Object.keys(records).forEach(sid => {
    const cleanSid = cleanVal(sid);
    const status = cleanVal(records[sid]);
    const statusThai = formatAttendanceStatusThai(status);
    const detail = studentDetails[cleanSid] || {};
    const sName = cleanVal(detail.fullName || studentNameMap[cleanSid] || '');
    const sGrade = cleanVal(detail.grade || gradeStr || studentGradeMap[cleanSid] || '');

    // ตรวจสอบว่าเคยเช็คชื่อวันนี้ไปแล้วหรือยัง ถ้ามีให้อัปเดตแถวเดิม
    let foundAttRow = -1, legacyRow = -1;
    for (let i = existingAttRows.length - 1; i >= 1; i--) {
      if (isCodeMatch(existingAttRows[i][1], cleanSid) && formatSheetDate(existingAttRows[i][4]) === dateStr && cleanVal(existingAttRows[i][8] || '') === subjCode) {
        const rp = cleanVal(existingAttRows[i][11] || '');
        if (rp === period) { foundAttRow = i + 1; break; }
        if (!rp && legacyRow === -1) legacyRow = i + 1; // แถวเก่าที่ยังไม่มีเลขคาบ
      }
    }
    if (foundAttRow === -1 && legacyRow !== -1) { foundAttRow = legacyRow; existingAttRows[legacyRow - 1][11] = period; }

    if (foundAttRow !== -1) {
      sheet.getRange(foundAttRow, 3, 1, 10).setValues([[
        sName, sGrade, dateStr, timeStr, statusThai, teacherNote, subjCode, subjName, checkedBy, period
      ]]);
    } else {
      const logId = 'ATT-' + new Date().getTime() + '-' + count;
      sheet.appendRow([
        logId,
        cleanSid,
        sName,
        sGrade,
        dateStr,
        timeStr,
        statusThai,
        teacherNote,
        subjCode,
        subjName,
        checkedBy,
        period
      ]);
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 2).setNumberFormat('@').setValue(cleanSid);
    }

    // อัปเดตสถิติมาเรียน JSON ในแผ่นงาน รายชื่อนักเรียน
    if (sheetStudents && detail.attendance) {
      for (let i = 1; i < studentRows.length; i++) {
        if (isCodeMatch(studentRows[i][0], cleanSid)) {
          sheetStudents.getRange(i + 1, 12).setValue(JSON.stringify(detail.attendance));
          break;
        }
      }
    }
    count++;
  });

  return { success: true, count: count, message: 'บันทึกการเช็คชื่อลง Google Sheets เรียบร้อยแล้ว (' + count + ' คน)' };
}

/**
 * อาจารย์ผู้สอนหรือแอดมินบันทึกเกรดรายวิชา (ระดับเกรด 1 - 4)
 */
function saveSubjectGrades(data) {
  return updateSubjectScores({
    subjectCode: data.subjectCode || data.subject,
    subjectName: data.subjectName || data.subject,
    teacherId: data.teacherId || 'Teacher',
    gradeFilter: data.gradeFilter || '',
    scores: data.grades || data.scores || {},
    studentGrades: data.studentGrades
  });
}

/**
 * บันทึกรายวิชาทั้งหมดของระบบลงในแผ่นงาน การตั้งค่า (Key = AppSubjects)
 */
function saveSubjects(data) {
  if (!data || !Array.isArray(data.subjects)) {
    return { success: false, message: 'ไม่มีข้อมูลรายวิชา' };
  }
  return saveSetting({
    key: 'AppSubjects',
    value: JSON.stringify(data.subjects),
    description: 'รายวิชาทั้งหมดของระบบ (JSON)'
  });
}

/**
 * บันทึกค่าการตั้งค่าลงแผ่นงาน การตั้งค่า (Key-Value)
 */
function saveSetting(data) {
  if (!data || !data.key) return { success: false, message: 'ไม่พบคีย์การตั้งค่า' };
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.SETTINGS);
  const key = cleanVal(data.key);
  const val = (typeof data.value === 'object') ? JSON.stringify(data.value) : String(data.value !== undefined ? data.value : '');
  const desc = cleanVal(data.description || 'การตั้งค่าระบบ');

  const lock = LockService.getScriptLock();
  let locked = false; try { locked = lock.tryLock(10000); } catch (e) {}
  try {
    const rows = sheet.getDataRange().getValues();
    // คีย์ซ้ำหลายแถว (เกิดจากบันทึกพร้อมกัน) ทำให้อ่านได้ค่าเก่า เช่น ลบตารางพิเศษแล้วกลับมา → เก็บแถวแรก ลบแถวซ้ำ
    const hit = [];
    for (let i = 1; i < rows.length; i++) if (cleanVal(rows[i][0]) === key) hit.push(i + 1);
    if (hit.length) {
      sheet.getRange(hit[0], 2).setNumberFormat('@').setValue(val);
      if (data.description) sheet.getRange(hit[0], 3).setValue(desc);
      for (let j = hit.length - 1; j >= 1; j--) sheet.deleteRow(hit[j]);
      if (typeof __ROWS_MEMO !== 'undefined' && __ROWS_MEMO) delete __ROWS_MEMO[sheet.getName()];
      return { success: true, message: 'อัปเดตการตั้งค่า ' + key + ' สำเร็จ' };
    }
    sheet.appendRow([key, val, desc]);
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 2).setNumberFormat('@').setValue(val);
    if (typeof __ROWS_MEMO !== 'undefined' && __ROWS_MEMO) delete __ROWS_MEMO[sheet.getName()];
    return { success: true, message: 'บันทึกการตั้งค่า ' + key + ' สำเร็จ' };
  } finally { if (locked) { try { lock.releaseLock(); } catch (e) {} } }
}

function getSettings() {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.SETTINGS);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: {} };
  const rows = readAllRows_(sheet);
  const settings = {};
  for (let i = 1; i < rows.length; i++) {
    const k = cleanVal(rows[i][0]);
    if (!k) continue;
    settings[k] = cleanVal(rows[i][1]);
  }
  return { success: true, data: settings };
}

/**
 * -------------------------------------------------------------
 * ระบบปฏิทินกิจกรรมโรงเรียน (CALENDAR EVENTS)
 * รองรับการเลือกกลุ่มเป้าหมาย (ทุกคน, เฉพาะนักเรียน, เฉพาะอาจารย์/ผู้บริหาร)
 * ซิงค์กับชีต 'ปฏิทินกิจกรรม'
 * -------------------------------------------------------------
 */

function normalizeTargetAudience(val) {
  if (!val) return 'all';
  const s = String(val).toLowerCase().trim();
  if (s === 'students' || s === 'student' || s.includes('เฉพาะนักเรียน') || s === 'นักเรียน') {
    return 'students';
  }
  if (s === 'teachers' || s === 'teacher' || s.includes('เฉพาะอาจารย์') || s.includes('ผู้บริหาร') || s === 'อาจารย์') {
    return 'teachers';
  }
  return 'all';
}

function formatTargetAudienceThai(val) {
  const norm = normalizeTargetAudience(val);
  if (norm === 'students') return 'เฉพาะนักเรียน';
  if (norm === 'teachers') return 'เฉพาะอาจารย์และผู้บริหาร';
  return 'ทุกคน (นักเรียนและอาจารย์)';
}

function getCalendarEvents(userRole) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.CALENDAR);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };

  const rows = readAllRows_(sheet);
  const results = [];
  const isStudent = (userRole === 'STUDENT' || userRole === 'student' || userRole === 'นักเรียน');

  for (let i = 1; i < rows.length; i++) {
    const id = cleanVal(rows[i][0]);
    if (!id) continue;
    const title = cleanVal(rows[i][1]);
    const startDate = formatSheetDate(rows[i][2]) || cleanVal(rows[i][2]);
    const endDate = formatSheetDate(rows[i][3]) || startDate;
    const startTime = cleanVal(rows[i][4]);
    const endTime = cleanVal(rows[i][5]);
    const location = cleanVal(rows[i][6]);
    const category = cleanVal(rows[i][7]) || 'กิจกรรมทั่วไป';
    const targetAudienceRaw = cleanVal(rows[i][8]);
    const targetAudience = normalizeTargetAudience(targetAudienceRaw);
    const description = cleanVal(rows[i][9]);
    const createdBy = cleanVal(rows[i][10]);
    const updatedAt = cleanVal(rows[i][11]);

    // หากผู้เรียกเป็นนักเรียน และกิจกรรมนี้มีกลุ่มเป้าหมายเฉพาะอาจารย์/ผู้บริหาร จะไม่ส่งข้อมูลให้
    if (isStudent && targetAudience === 'teachers') {
      continue;
    }

    results.push({
      id: id,
      title: title,
      startDate: startDate,
      endDate: endDate,
      startTime: startTime,
      endTime: endTime,
      location: location,
      category: category,
      targetAudience: targetAudience,
      targetAudienceLabel: formatTargetAudienceThai(targetAudience),
      description: description,
      createdBy: createdBy,
      updatedAt: updatedAt
    });
  }

  // เรียงลำดับตามวันที่เริ่มต้น
  results.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

  return { success: true, data: results };
}

function saveCalendarEvent(data) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.CALENDAR);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานปฏิทินกิจกรรม' };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'ระบบกำลังมีผู้ใช้งานพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง' };
  }

  try {
    const eventId = cleanVal(data.id || data.eventId || ('CAL-' + new Date().getTime()));
    const title = cleanVal(data.title || 'กิจกรรมปฏิทิน');
    const startDate = formatSheetDate(data.startDate || data.date) || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
    const endDate = formatSheetDate(data.endDate || data.date) || startDate;
    const startTime = cleanVal(data.startTime || '');
    const endTime = cleanVal(data.endTime || '');
    const location = cleanVal(data.location || '');
    const category = cleanVal(data.category || 'กิจกรรมทั่วไป');
    const targetAudience = normalizeTargetAudience(data.targetAudience);
    const targetAudienceLabel = formatTargetAudienceThai(targetAudience);
    const description = cleanVal(data.description || '');
    const createdBy = cleanVal(data.createdBy || 'ผู้ดูแลระบบ');
    const updatedAt = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");

    const rows = sheet.getDataRange().getValues();
    let updated = false;

    for (let i = 1; i < rows.length; i++) {
      if (cleanVal(rows[i][0]) === eventId) {
        sheet.getRange(i + 1, 2, 1, 11).setValues([[
          title,
          startDate,
          endDate,
          startTime,
          endTime,
          location,
          category,
          targetAudienceLabel,
          description,
          createdBy,
          updatedAt
        ]]);
        sheet.getRange(i + 1, 3).setNumberFormat('@');
        sheet.getRange(i + 1, 4).setNumberFormat('@');
        sheet.getRange(i + 1, 5).setNumberFormat('@');
        sheet.getRange(i + 1, 6).setNumberFormat('@');
        updated = true;
        break;
      }
    }

    if (!updated) {
      sheet.appendRow([
        eventId,
        title,
        startDate,
        endDate,
        startTime,
        endTime,
        location,
        category,
        targetAudienceLabel,
        description,
        createdBy,
        updatedAt
      ]);
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 1).setNumberFormat('@');
      sheet.getRange(lastRow, 3).setNumberFormat('@');
      sheet.getRange(lastRow, 4).setNumberFormat('@');
      sheet.getRange(lastRow, 5).setNumberFormat('@');
      sheet.getRange(lastRow, 6).setNumberFormat('@');
    }

    SpreadsheetApp.flush();
    return {
      success: true,
      message: updated ? 'แก้ไขกิจกรรมปฏิทินเรียบร้อยแล้ว' : 'บันทึกกิจกรรมปฏิทินลง Google Sheets สำเร็จ',
      id: eventId,
      eventId: eventId,
      event: {
        id: eventId,
        title: title,
        startDate: startDate,
        endDate: endDate,
        startTime: startTime,
        endTime: endTime,
        location: location,
        category: category,
        targetAudience: targetAudience,
        targetAudienceLabel: targetAudienceLabel,
        description: description,
        createdBy: createdBy,
        updatedAt: updatedAt
      }
    };
  } catch (err) {
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกปฏิทิน: ' + err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function deleteCalendarEvent(data) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.CALENDAR);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานปฏิทินกิจกรรม' };

  const eventId = cleanVal(typeof data === 'string' ? data : (data.id || data.eventId));
  if (!eventId) return { success: false, message: 'ไม่พบรหัสกิจกรรมที่ต้องการลบ' };

  try {
    const n = deleteRowsWhere_(sheet, function (r) { return cleanVal(r[0]) === eventId; });
    return { success: true, deleted: n, id: eventId, message: n ? 'ลบกิจกรรมออกจากปฏิทินเรียบร้อยแล้ว' : 'ไม่มีกิจกรรมนี้ในปฏิทินแล้ว' };
  } catch (err) {
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบกิจกรรม: ' + err.message };
  }
}

/**
 * ดึงข้อมูลทุกตารางจาก Google Sheets ในครั้งเดียว เพื่อให้เว็บแอปซิงค์ฐานข้อมูลล่าสุดแบบเรียลไทม์ 100%
 */
function getFullDatabase() {
  ensureSchema();
  return {
    success: true,
    timestamp: new Date().toISOString(),
    students: getAllStudents().data || [],
    teachers: getTeachers().data || [],
    admins: getAdmins().data || [],
    subAdmins: getSubAdmins().data || [],
    statusLogs: getStatusLogs().data || [],
    pendingRegistrations: getPendingRegistrations().data || [],
    activities: getActivities().data || [],
    activityLogs: getActivityLogs().data || [],
    prayers: getPrayers().data || [],
    attendance: getAttendance().data || [],
    hasanat: getHasanat().data || [],
    subjectGrades: getSubjectGrades().data || [],
    calendarEvents: getCalendarEvents().data || [],
    prayerApprovals: getPrayerApprovals().data || [],
    settings: getSettings().data || {}
  };
}

/**
 * ดึงรายการคำขออนุมัติละหมาดย้อนหลังทั้งหมดจาก Google Sheets
 */
function getPrayerApprovals() {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PRAYER_APPROVALS);
  if (!sheet) return { success: true, status: 'success', data: [] };

  const rows = readAllRows_(sheet);
  if (rows.length <= 1) return { success: true, status: 'success', data: [] };

  const list = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    list.push({
      id: cleanVal(row[0]),
      studentId: cleanVal(row[1]),
      studentName: cleanVal(row[2]),
      grade: cleanVal(row[3]),
      parentPhone: cleanVal(row[4]),
      prayerSlot: cleanVal(row[5]),
      date: formatSheetDate(row[6]) || cleanVal(row[6]),
      reasonPreset: cleanVal(row[7]),
      reasonDetail: cleanVal(row[8]),
      photoUrl: cleanVal(row[9]),
      status: cleanVal(row[10]) || 'pending',
      createdAt: cleanVal(row[11]),
      submittedAtFormatted: cleanVal(row[11]),
      approvedBy: cleanVal(row[12]) || null,
      approvedAt: cleanVal(row[13]) || null,
      adminNote: cleanVal(row[14]) || '',
      photoSource: cleanVal(row[15]) || ''
    });
  }
  return { success: true, status: 'success', data: list };
}

/** v17.2 · รูปหลักฐานคำร้องละหมาด: เก็บลง Google Drive (ไม่ยัดรูปใหญ่ลงเซลล์) */
/** v17.21 · บันทึกรูป base64 ลงโฟลเดอร์ Google Drive แล้วคืนลิงก์รูป (ถ้า Drive ใช้ไม่ได้และรูปเล็ก ให้เก็บ base64) */
function savePhotoToDrive_(raw, folderName, baseName) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//.test(v)) return v.substring(0, 500);
  if (!/^data:image\//.test(v)) return '';
  try {
    const it = DriveApp.getFoldersByName(folderName);
    const folder = it.hasNext() ? it.next() : DriveApp.createFolder(folderName);
    const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(v.split(',')[1] || ''), 'image/jpeg', String(baseName || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '') + '.jpg'));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://lh3.googleusercontent.com/d/' + file.getId();
  } catch (e) { Logger.log('photo: ' + e.message); return v.length < 49000 ? v : ''; }
}
function savePrayerRequestPhoto_(raw, studentId, reqId) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//.test(v)) return v.substring(0, 500);
  if (!/^data:image\//.test(v)) return '';
  try {
    const it = DriveApp.getFoldersByName('Khalifah_Prayer_Request_Photos');
    const folder = it.hasNext() ? it.next() : DriveApp.createFolder('Khalifah_Prayer_Request_Photos');
    const bytes = Utilities.base64Decode(v.split(',')[1] || '');
    const name = String(studentId || 'std').replace(/[^a-zA-Z0-9_-]/g, '') + '_' + String(reqId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '') + '.jpg';
    const file = folder.createFile(Utilities.newBlob(bytes, 'image/jpeg', name));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://lh3.googleusercontent.com/d/' + file.getId();
  } catch (e) {
    Logger.log('prayer request photo: ' + e.message);
    return v.length < 49000 ? v : '';
  }
}

/**
 * บันทึกคำขออนุมัติละหมาดย้อนหลังลง Google Sheets
 */
function savePrayerLateRequest(data) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PRAYER_APPROVALS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานคำขออนุมัติละหมาด' };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'ระบบกำลังมีผู้ใช้งานพร้อมกันจำนวนมาก' };
  }

  try {
    const id = cleanVal(data.id || ('PREQ-' + Date.now()));
    const studentId = cleanVal(data.studentId || '');
    const studentName = cleanVal(data.studentName || '');
    const grade = cleanVal(data.grade || '');
    const parentPhone = cleanVal(data.parentPhone || '');
    const prayerSlot = cleanVal(data.prayerSlot || '');
    const date = formatSheetDate(data.date) || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
    const reasonPreset = cleanVal(data.reasonPreset || 'ละหมาดแล้วแต่ลืมกดเช็คชื่อ');
    const reasonDetail = cleanVal(data.reasonDetail || '');
    const photoUrl = savePrayerRequestPhoto_(data.photoUrl || '', studentId, id);
    const photoSource = /^(camera|gallery)$/.test(String(data.photoSource || '')) ? (data.photoSource === 'camera' ? 'ถ่ายจากกล้อง' : 'แนบจากเครื่อง') : (photoUrl ? cleanVal(data.photoSource || '') : '');
    if (prayerSlot.length > 20) return { success: false, message: 'เวลาละหมาดไม่ถูกต้อง' };
    const status = cleanVal(data.status || 'pending');
    const submittedAt = data.submittedAtFormatted || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
    const approvedBy = cleanVal(data.approvedBy || '');
    const approvedAt = cleanVal(data.approvedAt || '');
    const adminNote = cleanVal(data.adminNote || '');

    const rows = sheet.getDataRange().getValues();
    let updated = false;
    for (let i = 1; i < rows.length; i++) {
      if (cleanVal(rows[i][0]) === id) {
        sheet.getRange(i + 1, 2, 1, 15).setValues([[
          studentId, studentName, grade, parentPhone, prayerSlot, date,
          reasonPreset, reasonDetail, photoUrl, status, submittedAt, approvedBy, approvedAt, adminNote, photoSource
        ]]);
        updated = true;
        break;
      }
    }

    if (!updated) {
      sheet.appendRow([
        id, studentId, studentName, grade, parentPhone, prayerSlot, date,
        reasonPreset, reasonDetail, photoUrl, status, submittedAt, approvedBy, approvedAt, adminNote, photoSource
      ]);
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 1).setNumberFormat('@');
      sheet.getRange(lastRow, 2).setNumberFormat('@');
      sheet.getRange(lastRow, 5).setNumberFormat('@');
      sheet.getRange(lastRow, 7).setNumberFormat('@');
    }

    return { success: true, message: 'บันทึกคำขออนุมัติเรียบร้อย', id: id, photoUrl: /^https?:/.test(photoUrl) ? photoUrl : '', photoSource: photoSource };
  } catch (err) {
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * อัปเดตสถานะคำขออนุมัติละหมาดใน Google Sheets
 */
/** แอดมิน/อาจารย์ลบคำขอบันทึกละหมาดย้อนหลัง (ลบทิ้งทั้งแถว) */
function deletePrayerLateRequest_(data) {
  // v18.27 · ลบหลายรายการพร้อมกันได้ (reqIds: [...]) · ยังรองรับ reqId เดี่ยวเหมือนเดิม
  const ids = {}; let k = 0;
  (Array.isArray((data || {}).reqIds) ? data.reqIds : [(data || {}).reqId || (data || {}).id]).slice(0, 2000).forEach(function (x) { const v = cleanVal(x); if (v && !ids[v]) { ids[v] = true; k++; } });
  if (!k) return { success: false, message: 'ไม่พบรหัสคำขอ' };
  const sheet = getSpreadsheet().getSheetByName(SHEETS.PRAYER_APPROVALS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานคำขออนุมัติละหมาด' };
  const n = deleteRowsWhere_(sheet, function (r) { return !!ids[cleanVal(r[0])]; });
  if (k > 1) return { success: true, deleted: n, message: 'ลบคำขอแล้ว ' + n + ' รายการ' };
  return { success: true, deleted: n, message: n ? 'ลบคำขอแล้ว' : 'ไม่มีคำขอนี้ในระบบแล้ว' };
}

function updatePrayerLateRequestStatus(data) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PRAYER_APPROVALS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานคำขออนุมัติละหมาด' };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {}

  try {
    const reqId = cleanVal(data.reqId || data.id);
    const status = cleanVal(data.status || 'approved');
    const approver = cleanVal(data.approvedBy || data.rejectedBy || 'อาจารย์/แอดมิน');
    const actionAt = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
    const adminNote = cleanVal(data.adminNote || '');

    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (cleanVal(rows[i][0]) === reqId) {
        sheet.getRange(i + 1, 11).setValue(status);
        sheet.getRange(i + 1, 13).setValue(approver);
        sheet.getRange(i + 1, 14).setValue(actionAt);
        sheet.getRange(i + 1, 15).setValue(adminNote);
        return { success: true, message: 'อัปเดตสถานะคำขอเรียบร้อย' };
      }
    }
    return { success: false, message: 'ไม่พบคำขอรหัส ' + reqId };
  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


// =====================================================================
//  📝 คะแนนชิ้นงานรายวิชา (อาจารย์เพิ่มชิ้นงานได้เองไม่จำกัด)
//  - นิยามชิ้นงานเก็บใน "การตั้งค่า" คีย์ SubjectAssignments = { รหัสวิชา: [{id,title,maxScore}] }
//  - คะแนนรายคนเก็บในแผ่นงาน "คะแนนชิ้นงาน" (1 แถว = นักเรียน 1 คน × ชิ้นงาน 1 ชิ้น)
// =====================================================================
const ASSIGNMENT_TOTAL_MAX = 100; // คะแนนเต็มรวมของทุกชิ้นงานในหนึ่งวิชาไม่เกิน 100
function assignmentsTotal_(list) { return (list || []).reduce(function (t, a) { return t + (Number(a.maxScore) || 0); }, 0); }
function sanitizeAssignments_(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = {};
  list.forEach(function (a) {
    if (!a) return;
    const id = cleanVal(a.id || '').substring(0, 60);
    const title = cleanVal(a.title || a.name || '').substring(0, 120);
    const max = Number(a.maxScore || a.max);
    if (!id || !title || !(max > 0) || max > ASSIGNMENT_TOTAL_MAX || seen[id]) return;
    seen[id] = true;
    out.push({ id: id, title: title, maxScore: Math.round(max * 100) / 100 });
  });
  return out.slice(0, 100);
}

function getAssignmentDefinitionsMap_() {
  const settings = getSettings().data || {};
  try {
    const m = JSON.parse(settings.SubjectAssignments || '{}');
    return (m && typeof m === 'object') ? m : {};
  } catch (e) {
    return {};
  }
}

/**
 * v17.52 · เกณฑ์ตัดเกรดรายวิชา (ไม่บังคับ) · การตั้งค่า คีย์ GradeCriteria = { รหัสวิชา: [ร้อยละขั้นต่ำของเกรด 4, 3.5, 3, 2.5, 2, 1.5, 1] }
 * data = { subjectIds: [...], mins: [7 ตัวเลขเรียงจากมากไปน้อย] | null (= กลับไปใช้ค่าเริ่มต้น) }
 */
function saveGradeCriteria(data) {
  const ids = (Array.isArray(data && data.subjectIds) ? data.subjectIds : [data && data.subjectId]).map(function (x) { return cleanVal(x || ''); }).filter(Boolean).slice(0, 60);
  if (!ids.length) return { success: false, message: 'ไม่พบรหัสวิชา' };
  let mins = data && data.mins;
  if (mins !== null && mins !== undefined) {
    if (!Array.isArray(mins) || mins.length !== 7) return { success: false, message: 'เกณฑ์ต้องมี 7 ขั้น (เกรด 4 ถึง 1)' };
    mins = mins.map(function (v) { return Math.round(Number(v) * 100) / 100; });
    for (let i = 0; i < 7; i++) {
      if (!isFinite(mins[i]) || mins[i] <= 0 || mins[i] > 100) return { success: false, message: 'ร้อยละต้องอยู่ระหว่าง 1–100' };
      if (i && mins[i] >= mins[i - 1]) return { success: false, message: 'เกณฑ์ของเกรดที่ต่ำกว่าต้องน้อยกว่าเกรดที่สูงกว่า' };
    }
  } else mins = null;
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) {}
  try {
    let map = {};
    try { map = JSON.parse(getSettings().data.GradeCriteria || '{}') || {}; } catch (e) { map = {}; }
    ids.forEach(function (id) { if (mins) map[id] = mins; else delete map[id]; });
    saveSetting({ key: 'GradeCriteria', value: JSON.stringify(map), description: 'เกณฑ์ตัดเกรดรายวิชา (ร้อยละขั้นต่ำ เกรด 4 → 1)' });
    return { success: true, criteria: map };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function saveSubjectAssignments(data) {
  const subjectId = cleanVal(data && (data.subjectId || data.subjectCode) || '');
  if (!subjectId) return { success: false, message: 'ไม่พบรหัสวิชา' };
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) {}
  try {
    const map = getAssignmentDefinitionsMap_();
    const clean = sanitizeAssignments_(data.assignments);
    if (assignmentsTotal_(clean) > ASSIGNMENT_TOTAL_MAX + 1e-9) return { success: false, message: 'คะแนนเต็มรวมของทุกชิ้นงานต้องไม่เกิน ' + ASSIGNMENT_TOTAL_MAX + ' คะแนน' };
    map[subjectId] = clean;
    saveSetting({ key: 'SubjectAssignments', value: JSON.stringify(map), description: 'ชิ้นงาน/ช่องคะแนนของแต่ละรายวิชา (JSON)' });
    return { success: true, message: 'บันทึกรายการชิ้นงานของวิชาเรียบร้อย', assignments: map[subjectId] };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * บันทึกคะแนนชิ้นงาน: data = { subjectId, subjectName, assignments:[...], scores: { studentId: { assignmentId: number|'' } } }
 * เขียนแบบรวดเดียว (อัปเดตแถวเดิม + ต่อท้ายแถวใหม่) เพื่อความเร็ว
 */
function saveAssignmentScores(data) {
  data = data || {};
  const subjectId = cleanVal(data.subjectId || data.subjectCode || '');
  if (!subjectId) return { success: false, message: 'ไม่พบรหัสวิชา' };
  ensureSchema();
  const lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) {}
  try {
    if (Array.isArray(data.assignments)) {
      const map = getAssignmentDefinitionsMap_();
      const clean = sanitizeAssignments_(data.assignments);
      if (assignmentsTotal_(clean) > ASSIGNMENT_TOTAL_MAX + 1e-9) return { success: false, message: 'คะแนนเต็มรวมของทุกชิ้นงานต้องไม่เกิน ' + ASSIGNMENT_TOTAL_MAX + ' คะแนน' };
      map[subjectId] = clean;
      saveSetting({ key: 'SubjectAssignments', value: JSON.stringify(map), description: 'ชิ้นงาน/ช่องคะแนนของแต่ละรายวิชา (JSON)' });
    }
    const defs = getAssignmentDefinitionsMap_()[subjectId] || [];
    const defById = {};
    defs.forEach(function (a) { defById[a.id] = a; });

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS.ASSIGNMENT_SCORES);
    const students = ss.getSheetByName(SHEETS.STUDENTS);
    const stuInfo = {};
    if (students && students.getLastRow() > 1) {
      students.getRange(2, 1, students.getLastRow() - 1, 4).getValues().forEach(function (r) {
        stuInfo[cleanVal(r[0])] = { name: cleanVal(r[1]), grade: cleanVal(r[3]) };
      });
    }
    const findStu = function (sid) {
      if (stuInfo[sid]) return stuInfo[sid];
      const keys = Object.keys(stuInfo);
      for (let i = 0; i < keys.length; i++) if (isCodeMatch(keys[i], sid)) return stuInfo[keys[i]];
      return { name: '', grade: '' };
    };

    const width = HEADERS.ASSIGNMENT_SCORES.length;
    const lastRow = sheet.getLastRow();
    const existing = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, width).getValues() : [];
    const index = {};
    existing.forEach(function (r, i) { index[cleanVal(r[1]) + '|' + cleanVal(r[3]) + '|' + cleanVal(r[6]).replace(/^0+/, '')] = i; });

    const now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    const teacher = cleanVal(data.teacherId || 'อาจารย์');
    const subjectName = cleanVal(data.subjectName || subjectId);
    const appendRows = [];
    let changed = 0, rejected = 0;
    const scores = (data.scores && typeof data.scores === 'object') ? data.scores : {};

    Object.keys(scores).forEach(function (rawSid) {
      const sid = cleanVal(rawSid);
      const perAsg = scores[rawSid] || {};
      Object.keys(perAsg).forEach(function (asgId) {
        const def = defById[cleanVal(asgId)];
        if (!def) { rejected++; return; }
        const raw = perAsg[asgId];
        let val = '';
        if (raw !== '' && raw !== null && raw !== undefined) {
          const n = Number(raw);
          if (isNaN(n) || n < 0 || n > def.maxScore) { rejected++; return; }
          val = Math.round(n * 100) / 100;
        }
        const info = findStu(sid);
        const row = ['ASG-' + subjectId + '-' + def.id + '-' + sid, subjectId, subjectName, def.id, def.title, def.maxScore, sid, info.name, info.grade, val, teacher, now];
        const key = subjectId + '|' + def.id + '|' + sid.replace(/^0+/, '');
        if (index[key] !== undefined) {
          existing[index[key]] = row;
        } else {
          index[key] = existing.length + appendRows.length;
          appendRows.push(row);
        }
        changed++;
      });
    });

    if (existing.length) {
      sheet.getRange(2, 1, existing.length, width).setValues(existing);
    }
    if (appendRows.length) {
      const start = sheet.getLastRow() + 1;
      const rng = sheet.getRange(start, 1, appendRows.length, width);
      sheet.getRange(start, 1, appendRows.length, 1).setNumberFormat('@');
      sheet.getRange(start, 7, appendRows.length, 1).setNumberFormat('@');
      rng.setValues(appendRows);
    }
    SpreadsheetApp.flush();
    return {
      success: true,
      saved: changed,
      rejected: rejected,
      message: 'บันทึกคะแนนชิ้นงาน ' + changed + ' รายการ' + (rejected ? ' (ข้าม ' + rejected + ' รายการที่ไม่ถูกต้อง)' : '')
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function getAssignmentScores(studentId, subjectId) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ASSIGNMENT_SCORES);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };
  const defs = getAssignmentDefinitionsMap_();
  const rows = readAllRows_(sheet);
  const targetSid = cleanVal(studentId || '');
  const targetSubj = cleanVal(subjectId || '');
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const subj = cleanVal(rows[i][1]);
    const asgId = cleanVal(rows[i][3]);
    const sid = cleanVal(rows[i][6]);
    if (!subj || !asgId || !sid) continue;
    if (targetSid && !isCodeMatch(sid, targetSid)) continue;
    if (targetSubj && subj !== targetSubj) continue;
    const def = (defs[subj] || []).filter(function (a) { return a.id === asgId; })[0];
    if (!def) continue; // ชิ้นงานที่ถูกลบแล้ว
    const raw = rows[i][9];
    out.push({
      studentId: sid,
      subjectId: subj,
      subjectName: cleanVal(rows[i][2]),
      assignmentId: asgId,
      title: def.title,
      maxScore: def.maxScore,
      score: (raw === '' || raw === null) ? null : Number(raw),
      updatedAt: cleanVal(rows[i][11])
    });
  }
  return { success: true, data: out };
}


/* =====================================================================
 * ประเมินอาจารย์ผู้สอน (ไม่ระบุชื่อ) — v9.0
 * เก็บเฉพาะแฮชของ (รหัสนักเรียน + ภาคเรียน + วิชา + อาจารย์) เพื่อกันประเมินซ้ำ
 * อาจารย์/แอดมินเห็นเฉพาะค่าเฉลี่ยและความคิดเห็น ไม่เห็นตัวตนผู้ประเมิน
 * ===================================================================== */
const EVAL_ITEMS = [
  'อธิบายเนื้อหาเข้าใจง่าย',
  'เตรียมการสอนและตรงต่อเวลา',
  'เปิดโอกาสให้ถาม/ช่วยเหลือเมื่อไม่เข้าใจ',
  'ให้คะแนนและตรวจงานอย่างยุติธรรม',
  'เป็นแบบอย่างที่ดี มีคุณธรรม'
];
function autoTerm_() {
  const d = new Date(); const m = d.getMonth() + 1; const y = d.getFullYear() + 543;
  return ((m >= 5 && m <= 10) ? 1 : 2) + '/' + (m >= 5 ? y : y - 1);
}
/** ภาคเรียนปัจจุบัน: ใช้ค่าที่แอดมินตั้งไว้ (CurrentTerm) ถ้าไม่ได้ตั้งจะคำนวณจากวันที่ */
function currentTerm_() {
  try {
    const raw = (getSettings().data || {}).CurrentTerm;
    if (raw) {
      const c = JSON.parse(raw);
      const t = Number(c.term), y = Number(c.year);
      if (c.mode === 'manual' && [1, 2, 3].indexOf(t) !== -1 && y >= 2500 && y <= 2700) return t + '/' + y;
    }
  } catch (e) {}
  return autoTerm_();
}
function saveCurrentTerm_(data) {
  data = data || {};
  const mode = data.mode === 'manual' ? 'manual' : 'auto';
  const t = Number(data.term), y = Number(data.year);
  if (mode === 'manual' && ([1, 2, 3].indexOf(t) === -1 || !(y >= 2500 && y <= 2700))) return { success: false, message: 'ภาคเรียนหรือปีการศึกษาไม่ถูกต้อง' };
  const value = { mode: mode, term: mode === 'manual' ? t : null, year: mode === 'manual' ? y : null, updatedAt: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm') };
  saveSetting({ key: 'CurrentTerm', value: JSON.stringify(value), description: 'ภาคเรียน/ปีการศึกษาปัจจุบัน (JSON)' });
  return { success: true, term: currentTerm_(), setting: value, message: 'ตั้งค่าเป็นภาคเรียนที่ ' + currentTerm_() + ' แล้ว' };
}
function evalHash_(sid, term, subj, teacher) {
  const raw = getTokenSecret_() + '|eval|' + cleanVal(sid).replace(/^0+/, '') + '|' + term + '|' + subj + '|' + teacher;
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { const v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('').slice(0, 32);
}
function getEvaluationTargets_() {
  ensureSchema();
  const ss = getSpreadsheet();
  let subjects = [];
  try {
    const st = ss.getSheetByName(SHEETS.SETTINGS);
    const rows = st ? st.getDataRange().getValues() : [];
    for (let i = 1; i < rows.length; i++) if (cleanVal(rows[i][0]) === 'AppSubjects') { subjects = JSON.parse(rows[i][1] || '[]'); break; }
  } catch (e) {}
  if (!Array.isArray(subjects) || !subjects.length) subjects = [
    { id: 'religious', code: 'ISL101', name: 'ศาสนาและจริยธรรม' }, { id: 'science', code: 'SCI101', name: 'วิทยาศาสตร์' },
    { id: 'math', code: 'MAT101', name: 'คณิตศาสตร์' }, { id: 'language', code: 'THA101', name: 'ภาษาและการสื่อสาร' },
    { id: 'social', code: 'SOC101', name: 'สังคมและวัฒนธรรม' }, { id: 'tech', code: 'TEC101', name: 'เทคโนโลยีและนวัตกรรม' }];
  const nameOf = {};
  (subjects || []).forEach(function (x) {
    const nm = cleanVal(x.name || x.subjectName || x.id || x.code);
    [x.id, x.code, x.subjectId].forEach(function (k) { k = cleanVal(k); if (k) nameOf[k] = nm; });
  });
  const sh = ss.getSheetByName(SHEETS.TEACHERS);
  const rows = sh ? sh.getDataRange().getValues() : [];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const status = cleanVal(rows[i][8] || '');
    if (/ระงับ|ยกเลิก|พ้นสภาพ|Pending|OTP/i.test(status)) continue;
    let subj = [];
    try { subj = rows[i][7] ? JSON.parse(rows[i][7]) : []; } catch (e) {}
    (Array.isArray(subj) ? subj : []).forEach(function (code) {
      code = cleanVal(code); if (!code) return;
      out.push({ subjectCode: code, subjectName: nameOf[code] || code, teacher: cleanVal(rows[i][1]), teacherName: cleanVal(rows[i][3]) });
    });
  }
  return { success: true, term: currentTerm_(), items: EVAL_ITEMS, data: out, open: evalOpen_() };
}
/** แอดมินเปิด/ปิดการประเมินอาจารย์ (ค่าเริ่มต้น: ปิด) */
function evalOpen_() { try { return String((getSettings().data || {}).EvalOpen || '') === '1'; } catch (e) { return false; } }
function getMyEvaluationStatus_(sid, term) {
  ensureSchema();
  term = cleanVal(term) || currentTerm_();
  const t = getEvaluationTargets_().data;
  const sh = getSpreadsheet().getSheetByName(SHEETS.TEACHER_EVALS);
  const rows = sh ? readAllRows_(sh) : [];
  const have = {};
  for (let i = 1; i < rows.length; i++) have[cleanVal(rows[i][11])] = true;
  const done = t.filter(function (x) { return have[evalHash_(sid, term, x.subjectCode, x.teacher)]; })
    .map(function (x) { return x.subjectCode + '|' + x.teacher; });
  return { success: true, term: term, done: done };
}
function submitTeacherEvaluation_(sid, data) {
  ensureSchema();
  const term = currentTerm_();
  if (!evalOpen_()) return { success: false, closed: true, message: 'ยังไม่เปิดให้ประเมินอาจารย์ · รอแอดมินเปิดระบบ' };
  const subj = cleanVal(data.subjectCode), teacher = cleanVal(data.teacher);
  const target = getEvaluationTargets_().data.filter(function (x) { return x.subjectCode === subj && x.teacher === teacher; })[0];
  if (!target) return { success: false, message: 'ไม่พบวิชาหรืออาจารย์ที่เลือก' };
  const scores = Array.isArray(data.scores) ? data.scores.map(function (v) { return Math.max(1, Math.min(5, parseInt(v, 10) || 0)); }) : [];
  if (scores.length !== EVAL_ITEMS.length || scores.some(function (v) { return !v; })) return { success: false, message: 'กรุณาให้คะแนนให้ครบทุกข้อ' };
  const comment = String(data.comment || '').replace(/[<>]/g, '').slice(0, 500);
  const hash = evalHash_(sid, term, subj, teacher);
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) {}
  try {
    const sh = getSpreadsheet().getSheetByName(SHEETS.TEACHER_EVALS);
    const rows = sh.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) if (cleanVal(rows[i][11]) === hash) return { success: false, already: true, message: 'คุณประเมินวิชานี้ในภาคเรียนนี้แล้ว' };
    let grade = '';
    try { const st = getStudentForStaff_(sid); grade = st && st.student ? cleanVal(st.student.grade) : ''; } catch (e) {}
    const avg = Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length * 100) / 100;
    sh.appendRow(['EV-' + Utilities.getUuid().slice(0, 8), term, subj, target.subjectName, teacher, target.teacherName, avg, JSON.stringify(scores), comment, grade, Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'), hash]);
  } finally { try { lock.releaseLock(); } catch (e) {} }
  return { success: true, message: 'ส่งแบบประเมินเรียบร้อย ขอบคุณครับ' };
}
function getTeacherEvaluationSummary_(session, ctx, term) {
  ensureSchema();
  term = cleanVal(term) || currentTerm_();
  const sh = getSpreadsheet().getSheetByName(SHEETS.TEACHER_EVALS);
  const rows = sh ? readAllRows_(sh) : [];
  const me = cleanVal(session && session.userId).toLowerCase();
  const groups = {};
  for (let i = 1; i < rows.length; i++) {
    if (cleanVal(rows[i][1]) !== term) continue;
    const teacher = cleanVal(rows[i][4]);
    if (!ctx.isAdmin && teacher.toLowerCase() !== me) continue;
    const key = cleanVal(rows[i][2]) + '|' + teacher;
    const g = groups[key] || (groups[key] = { subjectCode: cleanVal(rows[i][2]), subjectName: cleanVal(rows[i][3]), teacher: teacher, teacherName: cleanVal(rows[i][5]), count: 0, sums: EVAL_ITEMS.map(function () { return 0; }), comments: [] });
    let sc = []; try { sc = JSON.parse(rows[i][7] || '[]'); } catch (e) {}
    g.count++; sc.forEach(function (v, k) { if (k < g.sums.length) g.sums[k] += Number(v) || 0; });
    const c = cleanVal(rows[i][8]); if (c) g.comments.push(c);
  }
  const data = Object.keys(groups).map(function (k) {
    const g = groups[k];
    const items = g.sums.map(function (s) { return g.count ? Math.round(s / g.count * 100) / 100 : 0; });
    // สุ่มลำดับความคิดเห็นเพื่อไม่ให้เดาตัวผู้ประเมินจากลำดับเวลา
    const cm = g.comments.slice(); for (let j = cm.length - 1; j > 0; j--) { const r = Math.floor(Math.random() * (j + 1)); const t = cm[j]; cm[j] = cm[r]; cm[r] = t; }
    return { subjectCode: g.subjectCode, subjectName: g.subjectName, teacher: g.teacher, teacherName: g.teacherName, count: g.count,
      average: g.count ? Math.round(items.reduce(function (a, b) { return a + b; }, 0) / items.length * 100) / 100 : 0,
      items: items, comments: g.count >= 3 ? cm : [] };
  });
  return { success: true, term: term, items: EVAL_ITEMS, data: data, note: 'แสดงความคิดเห็นเมื่อมีผู้ประเมินตั้งแต่ 3 คนขึ้นไป เพื่อไม่ให้ระบุตัวตนได้' };
}


/** นักเรียนล้างข้อมูลผลบุญของตนเองทั้งหมด (ยืนยันจากหน้าแอปแล้ว) */
function resetMyHasanat_(sid) {
  ensureSchema();
  const sh = getSpreadsheet().getSheetByName(SHEETS.HASANAT);
  if (!sh || sh.getLastRow() <= 1) return { success: true, deleted: 0 };
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) {}
  let deleted = 0;
  try {
    const rows = sh.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (isCodeMatch(rows[i][1], sid)) { sh.deleteRow(i + 1); deleted++; }
    }
  } finally { try { lock.releaseLock(); } catch (e) {} }
  return { success: true, deleted: deleted, message: 'ล้างข้อมูลผลบุญแล้ว ' + deleted + ' รายการ' };
}


/** บัญชีนี้เป็นแอดมิน (ในแผ่นงานแอดมินหรือมีบทบาทแอดมิน) หรือไม่ */
function isAdminStaff_(username) {
  const u = cleanVal(username).toLowerCase(); if (!u) return false;
  const ss = getSpreadsheet();
  const sh = ss.getSheetByName(SHEETS.ADMINS);
  const rows = sh ? sh.getDataRange().getValues() : [];
  for (let i = 1; i < rows.length; i++) if (cleanVal(rows[i][1]).toLowerCase() === u && isAdminRole_(rows[i][4])) return true;
  const th = ss.getSheetByName(SHEETS.TEACHERS);
  const tr = th ? th.getDataRange().getValues() : [];
  for (let i = 1; i < tr.length; i++) if (cleanVal(tr[i][1]).toLowerCase() === u && isAdminRole_(tr[i][4])) return true;
  return false;
}


// =====================================================================
//  🧭 คะแนนพฤติกรรม (เต็ม 100 ต่อภาคเรียน) — ผู้ตรวจการหัก/เพิ่มคะแนนตามหัวข้อที่แอดมินตั้งไว้
// =====================================================================
const BEHAVIOR_CATS = ['dress', 'dorm', 'toilet', 'conduct', 'reading', 'mosque', 'good'];
// v17.79 · หมวด "การอ่านหนังสือ" ใช้กับนักเรียนชาย ม.4–ม.6 เท่านั้น
const READING_GRADES_ = ['4', '5', '6'];
const DEFAULT_BEHAVIOR_RULES = [
  { id: 'd1', cat: 'dress', title: 'แต่งกายไม่ถูกระเบียบ', points: -5 },
  { id: 'd2', cat: 'dress', title: 'ไม่สวมหมวก/ผ้าคลุมผมตามระเบียบ', points: -3 },
  { id: 'd3', cat: 'dress', title: 'ทรงผม/เล็บไม่เรียบร้อย', points: -3 },
  { id: 'r1', cat: 'dorm', title: 'หอพัก/เตียงไม่เรียบร้อย', points: -5 },
  { id: 'r2', cat: 'dorm', title: 'ไม่ทำเวรทำความสะอาดหอพัก', points: -5 },
  { id: 't1', cat: 'toilet', title: 'ห้องน้ำไม่สะอาด (เวรประจำวัน)', points: -5 },
  { id: 'c1', cat: 'conduct', title: 'มาสาย / ไม่ตรงต่อเวลา', points: -3 },
  { id: 'c2', cat: 'conduct', title: 'ไม่เข้าร่วมกิจกรรมโดยไม่แจ้ง', points: -5 },
  { id: 'c3', cat: 'conduct', title: 'พูดจาไม่สุภาพ / ทะเลาะวิวาท', points: -10 },
  { id: 'b1', cat: 'reading', title: 'ไม่อ่านหนังสือในเวลาอ่านหนังสือ', points: -3 },
  { id: 'b2', cat: 'reading', title: 'ไม่อยู่ในที่อ่านหนังสือ / ออกนอกห้องโดยไม่ขออนุญาต', points: -5 },
  { id: 'b3', cat: 'reading', title: 'คุยเสียงดัง / รบกวนผู้อื่นขณะอ่านหนังสือ', points: -3 },
  { id: 'm1', cat: 'mosque', title: 'พูดคุยเสียงดัง / เล่นในมัสยิด', points: -3 }, // v18.27 · หมวดพฤติกรรมภายในมัสยิด
  { id: 'm2', cat: 'mosque', title: 'มาละหมาดญะมาอะฮ์ไม่ทัน / ออกก่อนดุอาอ์', points: -3 },
  { id: 'm3', cat: 'mosque', title: 'แต่งกายไม่เหมาะสมในมัสยิด', points: -3 },
  { id: 'm4', cat: 'mosque', title: 'ใช้โทรศัพท์ในมัสยิด', points: -5 },
  { id: 'm5', cat: 'mosque', title: 'ไม่รักษาความสะอาด / ไม่เก็บของให้เรียบร้อย', points: -3 },
  { id: 'g1', cat: 'good', title: 'ละหมาดญะมาอะฮ์ครบทุกเวลา', points: 3 },
  { id: 'g2', cat: 'good', title: 'มีน้ำใจ ช่วยเหลือผู้อื่น', points: 3 },
  { id: 'g3', cat: 'good', title: 'มีวินัย เป็นแบบอย่างที่ดี', points: 5 }
];
function sanitizeBehaviorRules_(list) {
  if (!Array.isArray(list)) return [];
  const seen = {}; const out = [];
  list.forEach(function (r) {
    if (!r) return;
    const cat = BEHAVIOR_CATS.indexOf(cleanVal(r.cat)) !== -1 ? cleanVal(r.cat) : 'conduct';
    const title = cleanVal(r.title).substring(0, 120);
    let pts = Math.round(Number(r.points));
    if (!title || !isFinite(pts) || pts === 0) return;
    pts = Math.max(-50, Math.min(50, pts));
    if (cat === 'good') pts = Math.abs(pts); else pts = -Math.abs(pts);
    let id = cleanVal(r.id).substring(0, 40) || ('b' + Utilities.getUuid().slice(0, 8));
    if (seen[id]) id = id + '_' + out.length;
    seen[id] = true;
    out.push({ id: id, cat: cat, title: title, points: pts });
  });
  return out.slice(0, 200);
}
function getBehaviorRules_() {
  try {
    const raw = (getSettings().data || {}).BehaviorRules;
    if (raw) { const list = sanitizeBehaviorRules_(JSON.parse(raw)); if (list.length) { if (!list.some(function (r) { return r.cat === 'reading'; })) DEFAULT_BEHAVIOR_RULES.filter(function (r) { return r.cat === 'reading'; }).forEach(function (r) { if (!list.some(function (x) { return x.id === r.id; })) list.push(r); }); if (!list.some(function (r) { return r.cat === 'mosque'; })) DEFAULT_BEHAVIOR_RULES.filter(function (r) { return r.cat === 'mosque'; }).forEach(function (r) { if (!list.some(function (x) { return x.id === r.id; })) list.push(r); }); return list; } }
  } catch (e) {}
  return DEFAULT_BEHAVIOR_RULES.slice();
}
function saveBehaviorRules_(rules) {
  const clean = sanitizeBehaviorRules_(rules);
  if (!clean.length) return { success: false, message: 'ต้องมีหัวข้ออย่างน้อย 1 ข้อ' };
  saveSetting({ key: 'BehaviorRules', value: JSON.stringify(clean), description: 'หัวข้อและคะแนนพฤติกรรม (JSON)' });
  return { success: true, rules: clean, message: 'บันทึกหัวข้อคะแนนพฤติกรรมแล้ว' };
}
/* ===== v18.29 · หักคะแนนพฤติกรรมอัตโนมัติ: ไม่เช็คชื่อละหมาด (ครั้งละ 1 คะแนน) =====
 * - เริ่มนับตั้งแต่วันที่เปิดใช้ฟีเจอร์ (Script Property PRAYER_PENALTY_FROM ตั้งอัตโนมัติครั้งแรก) · ไม่หักย้อนหลัง
 * - ตรวจย้อนหลังสูงสุด 7 วัน · วันนี้ตรวจเฉพาะเวลาที่หมดช่วงแล้ว (+30 นาที) · อีชาอ์ตรวจวันถัดไป
 * - ไม่หัก: วันเสาร์ (วันหยุด) · ก่อนวันลงทะเบียน · มีบันทึกละหมาด (ตรงเวลา/สาย/ลา/อนุมัติ) · มีคำขอย้อนหลังที่รอ/อนุมัติ
 *   · ลาเรียนที่อนุมัติครอบเวลานั้น · มีประจำเดือน · ซุบฮิของนักเรียนชาย (แอดมินเช็คแทน) หักเฉพาะเมื่อแอดมินบันทึก "ขาด"
 * - ไม่หักซ้ำ (รหัสบันทึก PM-<รหัส>-<วันที่>-<เวลา>) · ถ้าแอดมินยกเลิกรายการแล้วจะไม่หักซ้ำ */
const PM_END_ = { 'ซุบฮิ': 6 * 60 + 25, 'ซุฮริ': 15 * 60 + 15, 'อัศรฺ': 18 * 60 + 5, 'มัฆริบ': 19 * 60 + 25, 'อีชาอ์': 24 * 60 };
const PM_START_ = { 'ซุบฮิ': 4 * 60 + 45, 'ซุฮริ': 12 * 60 + 10, 'อัศรฺ': 15 * 60 + 20, 'มัฆริบ': 18 * 60 + 10, 'อีชาอ์': 19 * 60 + 30 };
function prayerPenaltyMaybe_() {
  try {
    const cache = CacheService.getScriptCache();
    if (cache.get('pm_run')) return null;
    cache.put('pm_run', '1', 600);
    const lock = LockService.getScriptLock(); if (!lock.tryLock(100)) return null;
    try { return prayerPenaltyRun_(); } finally { try { lock.releaseLock(); } catch (e) {} }
  } catch (e) { return null; }
}
function prayerPenaltyRun_(nowArg) {
  const now = nowArg || new Date();
  const ymd = function (d) { return Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd'); };
  const today = ymd(now);
  let from = getProp_('PRAYER_PENALTY_FROM');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) { from = ymd(new Date(now.getTime() + 864e5)); try { setProp_('PRAYER_PENALTY_FROM', from); } catch (e) {} } // เริ่มนับวันถัดไป (ไม่หักของวันที่เปิดใช้)
  const hm = Utilities.formatDate(now, 'Asia/Bangkok', 'H:m').split(':'); const curMin = (+hm[0]) * 60 + (+hm[1]);
  const dates = [];
  for (let i = 7; i >= 0; i--) { const d = ymd(new Date(now.getTime() - i * 864e5)); if (d >= from && dates.indexOf(d) === -1) dates.push(d); }
  if (!dates.length) return { added: 0 };
  const dow = function (ds) { return new Date(ds + 'T12:00:00+07:00').getUTCDay(); };
  const ss = getSpreadsheet();
  const nid = function (v) { return String(v || '').replace(/\D/g, '').replace(/^0+/, ''); };
  const studs = (getAllStudents().data || []).filter(function (s) { return s && s.studentId && !/ลาออก|สำเร็จ|พ้นสภาพ|จำหน่าย|พักการเรียน/.test(String(s.status || '')) && /^\d{4}-\d{2}-\d{2}/.test(String(s.registeredAt || '')); });
  if (!studs.length) return { added: 0 };
  // บันทึกละหมาดที่มีอยู่
  const have = {}; const absent = {};
  const psh = ss.getSheetByName(SHEETS.PRAYERS);
  if (psh) readPrayerRows_(psh).forEach(function (r) {
    const ds = formatSheetDate(r[6]); if (dates.indexOf(ds) === -1) return;
    const k = nid(r[1]) + '|' + ds + '|' + formatPrayerTimeThai(r[4]);
    if (/ขาด/.test(String(r[14] || ''))) absent[k] = true; else have[k] = true;
  });
  const ash = ss.getSheetByName(SHEETS.PRAYER_APPROVALS);
  if (ash && ash.getLastRow() > 1) ash.getRange(2, 1, ash.getLastRow() - 1, 11).getValues().forEach(function (r) {
    if (/reject|ไม่อนุมัติ|ปฏิเสธ/i.test(String(r[10] || ''))) return;
    have[nid(r[1]) + '|' + formatSheetDate(r[6]) + '|' + formatPrayerTimeThai(r[5])] = true;
  });
  const toM = function (t) { const m = String(t || '').match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : NaN; };
  const leaves = readStuLeaves_().filter(function (x) { return x && x.status === 'approved'; });
  const onLeave = function (sid, ds, slot) {
    return leaves.some(function (x) {
      if (nid(x.sid) !== sid || ds < x.from || ds > (x.to || x.from)) return false;
      if (x.allDay) return true;
      const a = toM(x.tFrom), b = toM(x.tTo); if (isNaN(a) || isNaN(b)) return true;
      return a < PM_END_[slot] && b > PM_START_[slot];
    });
  };
  const periods = periodList_();
  const onPeriod = function (sid, ds) { return periods.some(function (x) { return nid(x.studentId) === sid && ds >= String(x.start || '') && ds <= String(x.end || x.status === 'active' && today || x.start || ''); }); };
  // รายการหักที่เคยสร้าง (รวมที่ยกเลิกแล้ว)
  const bsh = ss.getSheetByName(SHEETS.BEHAVIOR); if (!bsh) return { added: 0 };
  const done = {};
  if (bsh.getLastRow() > 1) bsh.getRange(2, 1, bsh.getLastRow() - 1, 1).getValues().forEach(function (r) { const v = String(r[0] || ''); if (v.indexOf('PM-') === 0) done[v] = true; });
  const stamp = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'); const term = currentTerm_();
  const rows = [];
  studs.forEach(function (st) {
    const sid = nid(st.studentId); const reg = String(st.registeredAt).slice(0, 10); const girl = periodIsGirl_(st);
    dates.forEach(function (ds) {
      if (ds <= reg || dow(ds) === 6) return;
      PRAYER_SLOTS_.forEach(function (slot0, si) {
        const slot = formatPrayerTimeThai(slot0);
        if (ds === today && (slot === 'อีชาอ์' || curMin < PM_END_[slot0] + 30)) return;
        const k = sid + '|' + ds + '|' + slot; if (have[k]) return;
        if (si === 0 && !girl && !absent[k]) return; // ซุบฮิชาย: แอดมินเช็คแทน · หักเฉพาะที่บันทึกว่าขาด
        const id = 'PM-' + sid + '-' + ds + '-' + si; if (done[id]) return;
        if (onLeave(sid, ds, slot0) || (girl && onPeriod(sid, ds))) return;
        done[id] = true;
        rows.push([id, ds, stamp, term, st.studentId, st.fullName || '', st.grade || '', 'conduct', 'prayer-miss', 'ไม่เช็คชื่อละหมาด' + slot0 + (absent[k] ? ' (ขาด)' : ''), -1, 'หักอัตโนมัติ: หมดเวลาละหมาดแล้วไม่ได้เช็คชื่อหรือแจ้งเหตุจำเป็น', 'system', 'ระบบอัตโนมัติ', 'active', '', '', '']);
      });
    });
  });
  if (rows.length) bsh.getRange(bsh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return { added: rows.length, from: from };
}
function getBehaviorLogs_() {
  const sh = getSpreadsheet().getSheetByName(SHEETS.BEHAVIOR);
  if (!sh || sh.getLastRow() < 2) return [];
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, HEADERS.BEHAVIOR.length).getValues();
  return rows.filter(function (r) { return cleanVal(r[0]); }).map(function (r) {
    return {
      id: cleanVal(r[0]), date: normalizeDateStr_(r[1]), time: cleanVal(r[2]), term: cleanVal(r[3]), studentId: cleanVal(r[4]), studentName: cleanVal(r[5]),
      grade: cleanVal(r[6]), cat: cleanVal(r[7]), ruleId: cleanVal(r[8]), title: cleanVal(r[9]), points: Number(r[10]) || 0, note: cleanVal(r[11]),
      by: cleanVal(r[12]), byName: cleanVal(r[13]), status: cleanVal(r[14]) || 'active', cancelledBy: cleanVal(r[15]),
      photoUrl: cleanVal(r[16] || ''), photoSource: cleanVal(r[17] || '')
    };
  });
}
function normalizeDateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd');
  return cleanVal(v).slice(0, 10);
}
function addBehaviorLogs_(data, session) {
  data = data || {};
  const ids = (Array.isArray(data.studentIds) ? data.studentIds : [data.studentId]).map(cleanVal).filter(Boolean).slice(0, 300);
  if (!ids.length) return { success: false, message: 'กรุณาเลือกนักเรียนอย่างน้อย 1 คน' };
  const rules = getBehaviorRules_();
  let rule = rules.filter(function (r) { return r.id === cleanVal(data.ruleId); })[0];
  if (!rule) {
    // หัวข้ออื่น ๆ ที่ผู้ตรวจการระบุเอง ต้องมีหมายเหตุ และจำกัดคะแนนครั้งละไม่เกิน 20
    const title = cleanVal(data.title).substring(0, 120);
    let pts = Math.round(Number(data.points));
    if (!title || !isFinite(pts) || pts === 0) return { success: false, message: 'ไม่พบหัวข้อที่เลือก' };
    pts = Math.max(-20, Math.min(20, pts));
    rule = { id: 'custom', cat: (cleanVal(data.cat) === 'reading' || cleanVal(data.cat) === 'mosque') && pts < 0 ? cleanVal(data.cat) : (pts > 0 ? 'good' : 'conduct'), title: title, points: pts };
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(cleanVal(data.date)) ? cleanVal(data.date) : Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  if (date > today) return { success: false, message: 'บันทึกล่วงหน้าไม่ได้' };
  const note = cleanVal(data.note).substring(0, 300);
  ensureSchema();
  // v17.21 · รูปหลักฐาน (ห้องน้ำ/ความสะอาดหอพัก) เก็บใน Google Drive ครั้งเดียว ใช้ร่วมกันทุกคนที่เลือก
  // v17.71 · แนบได้สูงสุด 4 รูป · เก็บ URL หลายรูปคั่นด้วยขึ้นบรรทัดใหม่ในคอลัมน์เดิม (รูปเดียวแบบเก่ายังอ่านได้)
  const srcTh = function (x) { return x === 'camera' ? 'ถ่ายจากกล้อง' : x === 'gallery' ? 'แนบจากเครื่อง' : ''; };
  const inPhotos = (Array.isArray(data.photos) ? data.photos : (data.photo ? [{ data: data.photo, source: data.photoSource }] : []))
    .filter(function (p) { return p && typeof p.data === 'string' && p.data; }).slice(0, 4);
  const urls = [], srcs = [];
  inPhotos.forEach(function (p, i) { const u = savePhotoToDrive_(p.data, 'Khalifah_Behavior_Photos', 'bhv_' + Date.now() + '_' + (i + 1)); if (u) { urls.push(u); srcs.push(srcTh(p.source)); } });
  const photoUrl = urls.join('\n');
  const photoSource = srcs.join('\n');
  const ss = getSpreadsheet();
  const sh = ss.getSheetByName(SHEETS.BEHAVIOR);
  const stuSheet = ss.getSheetByName(SHEETS.STUDENTS);
  const info = {};
  if (stuSheet && stuSheet.getLastRow() > 1) stuSheet.getRange(2, 1, stuSheet.getLastRow() - 1, Math.min(17, stuSheet.getLastColumn())).getValues().forEach(function (r) { info[cleanVal(r[0]).replace(/^0+/, '')] = { id: cleanVal(r[0]), name: cleanVal(r[1]), grade: cleanVal(r[3]), gender: cleanVal(r[16] || '') }; });
  const now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  const term = currentTerm_();
  const rows = []; const missing = []; const skipped = [];
  ids.forEach(function (sid, i) {
    const st = info[sid.replace(/^0+/, '')];
    if (!st) { missing.push(sid); return; }
    if (rule.cat === 'reading') { const gm = String(st.grade).match(/([1-6])/); const girl = /หญิง|^f/i.test(st.gender) || (!/ชาย|^m/i.test(st.gender) && /^\s*(นางสาว|น\.ส\.|นาง|เด็กหญิง|ด\.ญ\.)/.test(st.name)); if (girl || !gm || READING_GRADES_.indexOf(gm[1]) === -1) { skipped.push(st.name || sid); return; } }
    rows.push(['BHV-' + Date.now() + '-' + i, date, now, term, st.id, st.name, st.grade, rule.cat, rule.id, rule.title, rule.points, note, session.userId, session.name || session.userId, 'active', '', photoUrl, photoSource]);
  });
  if (!rows.length) return { success: false, message: skipped.length ? 'หมวดการอ่านหนังสือใช้กับนักเรียนชาย ม.4–ม.6 เท่านั้น' : 'ไม่พบรหัสนักเรียนที่เลือก' };
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) {}
  try { sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows); } finally { try { lock.releaseLock(); } catch (e) {} }
  return { success: true, photoMax: 4, photosSaved: urls.length, added: rows.length, missing: missing, skipped: skipped, points: rule.points, logs: rows.map(function (r) { return { id: r[0], date: r[1], time: r[2], term: r[3], studentId: r[4], studentName: r[5], grade: r[6], cat: r[7], ruleId: r[8], title: r[9], points: r[10], note: r[11], by: r[12], byName: r[13], status: 'active', photoUrl: r[16], photoSource: r[17] }; }),
    message: (rule.points < 0 ? 'หัก ' + Math.abs(rule.points) : 'เพิ่ม ' + rule.points) + ' คะแนน · ' + rows.length + ' คน' };
}
function cancelBehaviorLog_(logId, session, isAdmin) {
  const id = cleanVal(logId);
  const sh = getSpreadsheet().getSheetByName(SHEETS.BEHAVIOR);
  if (!id || !sh || sh.getLastRow() < 2) return { success: false, message: 'ไม่พบรายการ' };
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, HEADERS.BEHAVIOR.length).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (cleanVal(vals[i][0]) !== id) continue;
    if (!isAdmin && cleanVal(vals[i][12]).toLowerCase() !== cleanVal(session.userId).toLowerCase()) return { success: false, code: 'FORBIDDEN', message: 'ยกเลิกได้เฉพาะรายการที่ตนเองบันทึก' };
    if (cleanVal(vals[i][14]) === 'cancelled') return { success: true, message: 'รายการนี้ถูกยกเลิกแล้ว' };
    sh.getRange(i + 2, 15, 1, 2).setValues([['cancelled', (session.name || session.userId) + ' · ' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm')]]);
    return { success: true, message: 'ยกเลิกรายการแล้ว คะแนนถูกคืนให้นักเรียน' };
  }
  return { success: false, message: 'ไม่พบรายการ' };
}


// =====================================================================
//  📚 เอกสารประกอบการเรียน (Google Drive แยกโฟลเดอร์ ม.1–ม.6) — แสดงในแอปโดยไม่ต้องออกไปหน้า Drive
// =====================================================================
const DEFAULT_STUDY_FOLDERS = { '4': '1TUpCLYOzp3P_Wf3iRhLfmMLvLsYn3OPZ', '5': '1JbvNPhCkJz-we9qZE1NVKBrd9v-Aa74A' };
function extractDriveId_(v) {
  const s = cleanVal(v);
  if (!s) return '';
  const m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/) || s.match(/^([A-Za-z0-9_-]{10,})$/);
  return m ? m[1] : '';
}
function getStudyDocsFolders_() {
  let map = {};
  try { const raw = (getSettings().data || {}).StudyDocsFolders; if (raw) map = JSON.parse(raw) || {}; else map = DEFAULT_STUDY_FOLDERS; } catch (e) { map = DEFAULT_STUDY_FOLDERS; }
  const out = {};
  ['1', '2', '3', '4', '5', '6'].forEach(function (g) { const id = extractDriveId_(map[g]); if (id) out[g] = id; });
  return out;
}
function saveStudyDocsFolders_(folders) {
  const out = {}; const bad = [];
  ['1', '2', '3', '4', '5', '6'].forEach(function (g) {
    const raw = cleanVal(folders && folders[g]);
    if (!raw) return;
    const id = extractDriveId_(raw);
    if (!id) { bad.push('ม.' + g); return; }
    out[g] = id;
  });
  if (bad.length) return { success: false, message: 'ลิงก์โฟลเดอร์ไม่ถูกต้อง: ' + bad.join(', ') };
  saveSetting({ key: 'StudyDocsFolders', value: JSON.stringify(out), description: 'โฟลเดอร์เอกสารประกอบการเรียน ม.1–ม.6 (Google Drive)' });
  try { const c = CacheService.getScriptCache(); Object.keys(out).forEach(function (g) { c.remove('DOCS_' + out[g]); }); } catch (e) {}
  return { success: true, folders: out, message: 'บันทึกโฟลเดอร์เอกสารแล้ว' };
}
/** ตำแหน่งของโฟลเดอร์ย่อยในต้นไม้เอกสาร (จำจากการเปิดโฟลเดอร์แม่ หรือค้นจากโฟลเดอร์ ม.1–ม.6 ลงไป)
 *  ใช้วิธีไล่ลงจากโฟลเดอร์หลัก เพราะโฟลเดอร์ที่แชร์มาจากบัญชีอื่นมักอ่านโฟลเดอร์แม่ไม่ได้ */
function docsPlace_(id, roots) {
  const cache = CacheService.getScriptCache();
  try { const hit = cache.get('DOCS_IN_' + id); if (hit) return JSON.parse(hit); } catch (e) {}
  const queue = [];
  Object.keys(roots).forEach(function (g) { try { const f = DriveApp.getFolderById(roots[g]); queue.push({ f: f, grade: g, path: [{ id: roots[g], name: f.getName() }] }); } catch (e) {} });
  let seen = 0;
  while (queue.length && seen < 400) {
    const cur = queue.shift(); seen++;
    if (cur.path.length > 6) continue;
    const it = cur.f.getFolders();
    while (it.hasNext()) {
      const c = it.next(); const place = { grade: cur.grade, path: cur.path.concat([{ id: c.getId(), name: c.getName() }]) };
      try { cache.put('DOCS_IN_' + c.getId(), JSON.stringify(place), 21600); } catch (e) {}
      if (c.getId() === id) return place;
      queue.push({ f: c, grade: place.grade, path: place.path });
    }
  }
  return null;
}
function listStudyDocs_(grade, folderId, refresh) {
  const roots = getStudyDocsFolders_();
  const g = String(cleanVal(grade)).replace(/\D/g, '');
  let id = extractDriveId_(folderId);
  if (!id) {
    if (!roots[g]) return { success: true, empty: true, grade: g, folders: [], files: [], message: 'ยังไม่มีเอกสารสำหรับ ม.' + g };
    id = roots[g];
  }
  const cache = CacheService.getScriptCache();
  const key = 'DOCS_' + id;
  if (!refresh) { try { const hit = cache.get(key); if (hit) return JSON.parse(hit); } catch (e) {} }
  let folder;
  try { folder = DriveApp.getFolderById(id); } catch (e) {
    return { success: false, code: 'DRIVE_ACCESS', folderId: id, message: 'ระบบยังเปิดโฟลเดอร์นี้ไม่ได้ · ตรวจว่าแชร์โฟลเดอร์เป็น "ทุกคนที่มีลิงก์" หรือแชร์ให้บัญชีเจ้าของระบบ' };
  }
  let where = null;
  const rootGrade = Object.keys(roots).filter(function (k) { return roots[k] === id; })[0];
  if (rootGrade) where = { grade: rootGrade, path: [{ id: id, name: folder.getName() }] };
  else where = docsPlace_(id, roots);
  if (!where) return { success: false, code: 'NOT_IN_TREE', message: 'ไม่พบโฟลเดอร์นี้ในเอกสารประกอบการเรียน (อาจถูกย้ายหรือลบไปแล้ว)' };
  const folders = []; const files = [];
  const fi = folder.getFolders();
  while (fi.hasNext() && folders.length < 200) {
    const f = fi.next();
    // นับไฟล์และโฟลเดอร์ย่อยข้างใน เพื่อแสดงตัวเลขบนโฟลเดอร์ (0 = ว่าง)
    let nFiles = 0, nDirs = 0;
    try { const a = f.getFiles(); while (a.hasNext() && nFiles < 999) { const x = a.next(); if (!(x.isTrashed && x.isTrashed())) nFiles++; } } catch (e) {}
    try { const b = f.getFolders(); while (b.hasNext() && nDirs < 999) { b.next(); nDirs++; } } catch (e) {}
    folders.push({ id: f.getId(), name: f.getName(), files: nFiles, folders: nDirs, updated: f.getLastUpdated ? Utilities.formatDate(f.getLastUpdated(), 'Asia/Bangkok', 'yyyy-MM-dd') : '' });
    try { cache.put('DOCS_IN_' + f.getId(), JSON.stringify({ grade: where.grade, path: where.path.concat([{ id: f.getId(), name: f.getName() }]) }), 21600); } catch (e) {}
  }
  const it = folder.getFiles();
  while (it.hasNext() && files.length < 500) {
    const f = it.next();
    if (f.isTrashed && f.isTrashed()) continue;
    files.push({ id: f.getId(), name: f.getName(), mime: f.getMimeType(), size: f.getSize ? f.getSize() : 0, updated: f.getLastUpdated ? Utilities.formatDate(f.getLastUpdated(), 'Asia/Bangkok', 'yyyy-MM-dd') : '' });
    try { cache.put('DOCS_F_' + f.getId(), id, 21600); } catch (e) {}
  }
  const byName = function (a, b) { return String(a.name).localeCompare(String(b.name), 'th', { numeric: true }); };
  folders.sort(byName); files.sort(byName);
  const out = { success: true, grade: where.grade, folder: { id: id, name: folder.getName() }, path: where.path, folders: folders, files: files, cachedAt: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'HH:mm') };
  try { const js = JSON.stringify(out); if (js.length < 90000) cache.put(key, js, 60); } catch (e) {}
  return out;
}


// =====================================================================
//  🔔 การแจ้งเตือน (กระดิ่ง) + ข้อตกลงที่ต้องกดยินยอม
// =====================================================================
const POLICIES = {
  'dorm-rules-2569': {
    id: 'dorm-rules-2569', version: '1',
    title: 'กฎระเบียบหอพักนักเรียนและแนวทางส่งเสริมพฤติกรรม',
    subtitle: 'ปีการศึกษา 2569–2570',
    place: 'โปรแกรมห้องเรียนคอลีฟะห์ คณะวิทยาศาสตร์และเทคโนโลยี',
    effective: '1 พฤศจิกายน 2569',
    purpose: 'เพื่อกำหนดแนวปฏิบัติที่ชัดเจน ส่งเสริมวินัย ความรับผิดชอบ การเรียนรู้ และการอยู่ร่วมกันอย่างปลอดภัย โดยเคารพหลักศาสนา',
    items: [
      { t: 'ตารางชีวิตประจำวัน', d: ['กำหนดเวลาตื่นนอน อาบน้ำ รับประทานอาหาร เรียน ทำกิจกรรม และเข้านอนให้ชัดเจน'], m: 'ครั้งแรกตักเตือน ครั้งต่อไปบันทึกพฤติกรรมและร่วมวางแผนแก้ไข โดยพิจารณาเหตุจำเป็น' },
      { t: 'การล็อกประตูหอพัก', d: ['กำหนดเวลาเข้า–ออกและเวลาปิดประตู พร้อมแจ้งให้ทราบล่วงหน้า'], m: 'ตรวจสอบเหตุผล บันทึกเหตุการณ์ และพูดคุยเมื่อฝ่าฝืนซ้ำ' },
      { t: 'การเก็บโทรศัพท์มือถือ', d: ['กำหนดเวลาส่งคืนและรับโทรศัพท์อย่างชัดเจน และจัดเก็บอย่างปลอดภัย', 'อนุญาตให้ติดต่อผู้ปกครองได้ในกรณีจำเป็น'], m: 'หากใช้ผิดเวลา ให้ตักเตือนและดำเนินการตามระเบียบที่ประกาศ' },
      { t: 'การใช้รถและการออกนอกสถานที่', d: ['ต้องได้รับอนุญาตก่อนออกนอกสถานที่นอกเวลาที่กำหนด'], m: 'ตรวจสอบเหตุผล บันทึกเหตุการณ์ และประสานผู้ปกครองเมื่อจำเป็น หากมีความเสี่ยงให้ทบทวนสิทธิ์เป็นรายกรณี' },
      { t: 'การละหมาดศุบฮิ', d: ['จัดระบบปลุกและเตรียมตัวให้ทันเวลาละหมาด'], m: 'สอบถามสาเหตุเมื่อขาดหรือมาสาย หากขาดหรือสายครบ 3 ครั้งภายในสัปดาห์เดียวกัน จะแจ้งผู้ปกครอง' },
      { t: 'การอ่านหนังสือตอนกลางคืน', d: ['กำหนดเวลาอ่านหนังสือ ทบทวนบทเรียน และเวลาเข้านอน', 'ปรับตามความเหมาะสมเมื่อเจ็บป่วยหรืออ่อนล้า'], m: 'ติดตามงานและตักเตือนเมื่อไม่เข้าร่วมโดยไม่มีเหตุผล' },
      { t: 'การเล่นฟุตบอลและกีฬา', d: ['กำหนดวัน เวลา สนาม และการใช้อุปกรณ์ให้เหมาะสม'], m: 'หากฝ่าฝืนเวลา อาจพักการใช้สนามชั่วคราวตามความเหมาะสม', r: 'ผู้มีน้ำใจนักกีฬาและรักษากติกาจะได้รับคำชื่นชม' },
      { t: 'แอปติดตามพฤติกรรม', d: ['บันทึกการเข้าเรียน การละหมาด ความรับผิดชอบ การเข้าร่วมกิจกรรม และความก้าวหน้า'], m: 'ใช้เพื่อแจ้งเตือนและช่วยเหลือนักเรียน ตรวจสอบความถูกต้องของข้อมูล จำกัดผู้เข้าถึงข้อมูล และใช้ข้อมูลเพื่อพัฒนานักเรียนร่วมกับผู้ปกครอง' },
      { t: 'วันหยุดภาคเรียนที่ 2', d: ['แจ้งวันหยุดและแผนการเดินทางล่วงหน้า', 'วันหยุดที่กำหนด: 11–13 ธันวาคม 2569 และ 12–14 กุมภาพันธ์ 2570'], m: 'กรณีกลับช้า ให้แจ้งเหตุผลและประสานผู้ปกครอง โดยพิจารณาเหตุจำเป็น' },
      { t: 'การอยู่หอพักและการทำความสะอาด', d: ['จัดเวรทำความสะอาดห้องนอน ห้องน้ำ และพื้นที่ส่วนกลางอย่างทั่วถึง'], m: 'ผู้ที่ไม่ทำเวร ให้รับผิดชอบงานที่ค้างหรือทำเวรชดเชยอย่างเป็นธรรม' },
      { t: 'รางวัลพฤติกรรมดี', d: ['พิจารณารางวัลจากเกณฑ์ที่ชัดเจน เช่น ท่องจำอัลกุรอานได้ตามเป้าหมาย อ่านอัซการ์สม่ำเสมอ มีวินัย ขยัน และช่วยเหลือส่วนรวม'], r: 'เกียรติบัตร ของรางวัล คะแนนความดี หรือการยกย่องตามความเหมาะสม' },
      { t: 'การแต่งกายประจำวัน', d: ['กำหนดชุดนักเรียน ชุดศาสนา ชุดกีฬา และความเรียบร้อยตามวันที่กำหนด'], m: 'แจ้งเตือนและให้แก้ไขอย่างสุภาพ หากไม่มีชุดหรือมีเหตุจำเป็น ให้ช่วยกันหาทางออก' },
      { t: 'ฮะละเกาะฮ์ประจำสัปดาห์', d: ['จัดวงเรียนรู้ศาสนา ทบทวนอัลกุรอาน อัซการ์ มารยาท และแลกเปลี่ยนปัญหาการใช้ชีวิต'], m: 'ผู้ที่ขาดโดยไม่มีเหตุผล ให้ติดตามเนื้อหาที่พลาดไป', r: 'ผู้เข้าร่วมสม่ำเสมอและช่วยเหลือผู้อื่นจะได้รับคำชื่นชม' }
    ],
    consent: 'ข้าพเจ้าได้อ่านและเข้าใจกฎระเบียบหอพักนักเรียนและแนวทางส่งเสริมพฤติกรรมทั้งหมดแล้ว และยินยอมปฏิบัติตาม'
  }
};
const REQUIRED_POLICY_IDS = ['dorm-rules-2569'];

function sheetRows_(name, width) {
  const sh = getSpreadsheet().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, width).getValues();
}
function userKey_(session) { return (session.role === 'student' ? 'S:' + cleanVal(session.userId).replace(/^0+/, '') : 'U:' + cleanVal(session.userId).toLowerCase()); }
// v17.89 · วันเสาร์ = วันหยุดประจำสัปดาห์ (นับตามวันละหมาด: ก่อนรุ่งเช้ายังเป็นวันก่อนหน้า)
function isWeeklyHoliday_() {
  const now = new Date();
  const hm = Utilities.formatDate(now, 'Asia/Bangkok', 'H:m').split(':');
  const mins = (+hm[0]) * 60 + (+hm[1]);
  const d = new Date(now.getTime() - (mins < 285 ? 86400000 : 0));
  return Utilities.formatDate(d, 'Asia/Bangkok', 'u') === '6';
}
function studentGx_(sid) {
  const sh = getSpreadsheet().getSheetByName(SHEETS.STUDENTS); if (!sh || sh.getLastRow() < 2) return '';
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(18, sh.getLastColumn())).getValues();
  for (let i = 0; i < rows.length; i++) if (isCodeMatch(rows[i][0], sid)) {
    const g = normGender_(rows[i][16]) || genderFromPrefix_(cleanVal(rows[i][17] || '')) || (/^\s*(นางสาว|น\.ส\.|นาง|เด็กหญิง|ด\.ญ\.)/.test(cleanVal(rows[i][1])) ? 'หญิง' : /^\s*(นาย|เด็กชาย|ด\.ช\.)/.test(cleanVal(rows[i][1])) ? 'ชาย' : '');
    return g === 'หญิง' ? 'f' : g === 'ชาย' ? 'm' : '';
  }
  return '';
}
function studentGradeNum_(sid) {
  const rows = sheetRows_(SHEETS.STUDENTS, 4);
  for (let i = 0; i < rows.length; i++) if (isCodeMatch(rows[i][0], sid)) { const m = String(rows[i][3]).match(/([1-6])/); return { grade: m ? m[1] : '', name: cleanVal(rows[i][1]), gradeText: cleanVal(rows[i][3]) }; }
  return { grade: '', name: '', gradeText: '' };
}
function notifMatches_(n, session, gradeNum) {
  const type = n.audience;
  const vals = String(n.audienceValue || '').split(',').map(function (x) { return cleanVal(x); }).filter(Boolean);
  if (session.role === 'student') {
    if (type === 'all' || type === 'everyone') return true;
    if (type === 'grade') return vals.indexOf(gradeNum) !== -1;
    if (type === 'students') return vals.some(function (v) { return isCodeMatch(v, session.userId); });
    return false;
  }
  if (type === 'admins') return session.role === 'admin';
  if (type === 'users') return vals.some(function (v) { return String(v).toLowerCase() === String(session.userId).toLowerCase(); });
  return type === 'staff' || type === 'everyone';
}
// v18.19 · วันที่จากชีตอาจกลายเป็น Date object → แปลงเป็น yyyy-MM-dd ก่อนเทียบ (เดิมเทียบสตริง "Sun Nov…" ทำให้ประกาศไม่หมดอายุ)
function notifYmd_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd');
  const t = cleanVal(v); if (!t || /^\d{4}-\d{2}-\d{2}/.test(t)) return t.substring(0, 10);
  const d = new Date(t.replace(/\s*\(.*\)\s*$/, '')); return isNaN(d) ? t : Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
}
function notifTs_(v) { if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'); return cleanVal(v); }
// v18.19 · ประกาศที่เลยวันสิ้นสุดแล้ว → ลบอัตโนมัติ (สถานะ deleted เหมือนกดลบเอง)
function purgeExpiredNotifs_() {
  try {
    const sh = getSpreadsheet().getSheetByName(SHEETS.NOTIFS); if (!sh) return 0;
    const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
    const rows = sheetRows_(SHEETS.NOTIFS, HEADERS.NOTIFS.length); let n = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; if (!cleanVal(r[0]) || (cleanVal(r[9]) || 'active') !== 'active') continue;
      const ex = notifYmd_(r[10]); if (/^\d{4}-\d{2}-\d{2}$/.test(ex) && ex < today) { sh.getRange(i + 2, 10).setValue('deleted'); n++; }
    }
    return n;
  } catch (e) { return 0; }
}
function readNotifs_() {
  return sheetRows_(SHEETS.NOTIFS, HEADERS.NOTIFS.length).filter(function (r) { return cleanVal(r[0]); }).map(function (r) {
    return { id: cleanVal(r[0]), createdAt: notifTs_(r[1]), title: cleanVal(r[2]), body: cleanVal(r[3]), audience: cleanVal(r[4]), audienceValue: cleanVal(r[5]), priority: cleanVal(r[6]) || 'normal', by: cleanVal(r[7]), byName: cleanVal(r[8]), status: cleanVal(r[9]) || 'active', expires: notifYmd_(r[10]), mode: cleanVal(r[11]) || 'bell', place: cleanVal(r[12]) };
  });
}
// v17.90 · อาจารย์ลาสอน (อนุมัติแล้ว) ที่กระทบนักเรียนคนนี้ · ใช้ทั้งในตารางเรียนและกระดิ่ง
function myClassLeaves_(sid) {
  const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const until = Utilities.formatDate(new Date(Date.now() + 8 * 864e5), 'Asia/Bangkok', 'yyyy-MM-dd');
  const g = studentGradeNum_(sid).grade; if (!g) return [];
  const me = String(sid).replace(/\D/g, '').replace(/^0+/, '');
  const myGx = studentGx_(sid);
  const st = (getSettings().data) || {};
  let tt = null; try { tt = JSON.parse(st['Timetable_M' + g] || 'null'); } catch (e) {}
  const cells = (tt && tt.cells) || {};
  const fits = function (e) { return e && (!e.o || !e.o.length || e.o.indexOf(me) !== -1) && !(e.x && e.x.indexOf(me) !== -1) && (!e.gx || !myGx || e.gx === myGx); };
  const out = [];
  readLeaves_().forEach(function (lv) {
    if (!lv || lv.status !== 'approved' || lv.date < today || lv.date > until) return;
    const dow = new Date(lv.date + 'T00:00:00').getDay();
    const mineCells = function (p) { const v = cells[dow + '-' + p]; return (Array.isArray(v) ? v : v ? [v] : []).filter(function (e) { return fits(e) && (String(e.t || '') === String(lv.teacherId || '') || (Array.isArray(e.ts) && e.ts.indexOf(String(lv.teacherId || '')) !== -1)) && (!e.from || lv.date >= e.from) && (!e.to || lv.date <= e.to); }); };
    const hits = [];
    if (lv.slots && lv.slots.length) lv.slots.forEach(function (x) { if (String(x.g) !== String(g)) return; const c = mineCells(x.p); if (c.length || !x.s) hits.push({ p: x.p, sn: x.sn || (c[0] && c[0].sn) || '' }); });
    else for (let p = 1; p <= 12; p++) { if (lv.allDay || (lv.periods || []).indexOf(p) !== -1) mineCells(p).forEach(function (e) { hits.push({ p: p, sn: e.sn || '' }); }); }
    hits.forEach(function (h) { out.push({ id: 'LV-' + lv.id + '-' + h.p, leaveId: lv.id, date: lv.date, p: h.p, sn: h.sn, teacherName: lv.teacherName, subName: lv.subName || '' }); });
  });
  return out.sort(function (a, b) { return (a.date + a.p).localeCompare(b.date + b.p); });
}
function getMyNotifications_(session) {
  ensureSchema();
  const g = session.role === 'student' ? studentGradeNum_(session.userId).grade : '';
  const key = userKey_(session);
  const reads = {};
  sheetRows_(SHEETS.NOTIF_READS, 4).forEach(function (r) { if (cleanVal(r[1]) === key) reads[cleanVal(r[0])] = { at: cleanVal(r[2]), hidden: cleanVal(r[3]) === '1' }; });
  const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const list = readNotifs_().filter(function (n) { return n.status === 'active' && (!n.expires || n.expires >= today) && notifMatches_(n, session, g); })
    .map(function (n) { const rd = reads[n.id] || {}; return { id: n.id, createdAt: n.createdAt, title: n.title, body: n.body, priority: n.priority, byName: n.byName, mode: n.mode, place: n.place, expires: n.expires, read: !!rd.at, hidden: !!rd.hidden }; })
    .filter(function (n) { return !n.hidden; })
    .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 100);
  let classLeaves = [];
  if (session.role === 'student') {
    try { classLeaves = myClassLeaves_(session.userId); } catch (e) { classLeaves = []; }
    classLeaves.forEach(function (c) {
      const rd = reads[c.id] || {}; if (rd.hidden) return;
      const dTh = leaveDateTh_(c.date); if (list.some(function (n) { return n.kind !== 'leave' && String(n.title || '').indexOf('อาจารย์ลาสอน · ' + c.teacherName) === 0 && String(n.body || '').indexOf(dTh) !== -1 && (!c.sn || String(n.body || '').indexOf(c.sn) !== -1); })) return; // มีประกาศจากการอนุมัติแล้ว
      list.unshift({ id: c.id, createdAt: c.date + ' 00:00:00', title: (c.subName ? 'สอนแทน: ' : 'งดสอน: ') + (c.sn || 'คาบ ' + c.p) + ' · ' + leaveDateTh_(c.date), body: 'คาบ ' + c.p + (c.sn ? ' วิชา' + c.sn : '') + ' · ' + (c.teacherName || 'อาจารย์ผู้สอน') + ' ลาสอน' + (c.subName ? ' · มี ' + c.subName + ' สอนแทน' : ' · ไม่มีการเรียนการสอนในคาบนี้'), priority: 'high', byName: 'ระบบตารางเรียน', read: !!rd.at, hidden: false, kind: 'leave' });
    });
  }
  const pending = [];
  if (session.role === 'student') {
    const acks = myPolicyAcks_(session.userId);
    REQUIRED_POLICY_IDS.forEach(function (pid) { const p = POLICIES[pid]; if (p && !acks[pid + '|' + p.version]) pending.push({ id: pid, version: p.version, title: p.title, subtitle: p.subtitle }); });
  }
  return { success: true, notifications: list, classLeaves: classLeaves, pendingPolicies: pending, unread: list.filter(function (n) { return !n.read; }).length + pending.length };
}
function markNotificationRead_(session, ids, hide) {
  ids = (Array.isArray(ids) ? ids : [ids]).map(cleanVal).filter(Boolean).slice(0, 200);
  if (!ids.length) return { success: false, message: 'ไม่พบรายการ' };
  const sh = getSpreadsheet().getSheetByName(SHEETS.NOTIF_READS);
  const key = userKey_(session);
  const now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  const lock = LockService.getScriptLock(); try { lock.waitLock(10000); } catch (e) {}
  try {
    const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues() : [];
    const at = {}; rows.forEach(function (r, i) { if (cleanVal(r[1]) === key) at[cleanVal(r[0])] = i; });
    const add = [];
    ids.forEach(function (id) {
      if (at[id] !== undefined) { if (hide) sh.getRange(at[id] + 2, 4).setValue('1'); }
      else add.push([id, key, now, hide ? '1' : '']);
    });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 4).setValues(add);
  } finally { try { lock.releaseLock(); } catch (e) {} }
  return { success: true };
}
function sendNotification_(data, session) {
  data = data || {};
  const title = cleanVal(data.title).substring(0, 120), body = cleanVal(data.body).substring(0, 2000);
  if (!title) return { success: false, message: 'กรุณาใส่หัวข้อแจ้งเตือน' };
  const aud = ['all', 'grade', 'students', 'staff', 'everyone', 'admins', 'users'].indexOf(cleanVal(data.audience)) !== -1 ? cleanVal(data.audience) : 'all';
  let vals = (Array.isArray(data.values) ? data.values : String(data.values || '').split(',')).map(cleanVal).filter(Boolean);
  if (aud === 'grade') { vals = vals.map(function (v) { return String(v).replace(/\D/g, ''); }).filter(function (v) { return /^[1-6]$/.test(v); }); if (!vals.length) return { success: false, message: 'กรุณาเลือกชั้นปีอย่างน้อย 1 ชั้น' }; }
  if (aud === 'students' && !vals.length) return { success: false, message: 'กรุณาเลือกนักเรียนอย่างน้อย 1 คน' };
  const priority = data.priority === 'urgent' ? 'urgent' : 'normal';
  const expires = /^\d{4}-\d{2}-\d{2}$/.test(cleanVal(data.expires)) ? cleanVal(data.expires) : '';
  ensureSchema();
  const id = 'NTF-' + Date.now();
  // v18.07 · รูปแบบการแสดง: bell (กระดิ่ง) · full (ป้ายเต็มจอ ต้องกดรับทราบ) · banner (ป้ายในหน้า: home/card/all)
  const mode = ['bell', 'full', 'banner'].indexOf(cleanVal(data.mode)) !== -1 ? cleanVal(data.mode) : 'bell';
  const place = mode === 'banner' && ['home', 'card', 'all'].indexOf(cleanVal(data.place)) !== -1 ? cleanVal(data.place) : (mode === 'banner' ? 'home' : '');
  const row = [id, Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'), title, body, aud, vals.slice(0, 500).join(','), priority, session.userId, session.name || session.userId, 'active', expires, mode, place];
  getSpreadsheet().getSheetByName(SHEETS.NOTIFS).appendRow(row);
  return { success: true, id: id, message: 'ส่งแจ้งเตือนแล้ว' };
}
function listSentNotifications_() {
  purgeExpiredNotifs_();
  const today0 = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const reads = {};
  sheetRows_(SHEETS.NOTIF_READS, 4).forEach(function (r) { const id = cleanVal(r[0]); reads[id] = (reads[id] || 0) + 1; });
  const students = sheetRows_(SHEETS.STUDENTS, 8).filter(function (r) { return cleanVal(r[0]) && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(r[7])); });
  let staffN = 0; try { [SHEETS.ADMINS, SHEETS.TEACHERS].forEach(function (nm) { staffN += sheetRows_(nm, 2).filter(function (r) { return cleanVal(r[1]); }).length; }); } catch (e) {}
  const count = function (n) {
    const vals = String(n.audienceValue || '').split(',').filter(Boolean);
    if (n.audience === 'everyone') return students.length + staffN;
    if (n.audience === 'staff') return staffN;
    if (n.audience === 'users') return vals.length;
    if (n.audience === 'all') return students.length;
    if (n.audience === 'grade') return students.filter(function (r) { const m = String(r[3]).match(/([1-6])/); return m && vals.indexOf(m[1]) !== -1; }).length;
    if (n.audience === 'students') return vals.length;
    return 0;
  };
  const list = readNotifs_().filter(function (n) { return n.status === 'active' && !(n.expires && n.expires < today0); }).map(function (n) { return Object.assign(n, { reads: reads[n.id] || 0, recipients: count(n) }); })
    .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  return { success: true, data: list.slice(0, 200) };
}
function deleteNotification_(id) {
  id = cleanVal(id);
  const sh = getSpreadsheet().getSheetByName(SHEETS.NOTIFS);
  const rows = sheetRows_(SHEETS.NOTIFS, 1);
  for (let i = 0; i < rows.length; i++) if (cleanVal(rows[i][0]) === id) { sh.getRange(i + 2, 10).setValue('deleted'); return { success: true, message: 'ลบแจ้งเตือนแล้ว' }; }
  return { success: false, message: 'ไม่พบแจ้งเตือน' };
}
function myPolicyAcks_(sid) {
  const out = {};
  sheetRows_(SHEETS.POLICY_ACKS, 7).forEach(function (r) { if (isCodeMatch(r[3], sid)) out[cleanVal(r[1]) + '|' + cleanVal(r[2])] = cleanVal(r[6]); });
  return out;
}
function getPolicyForSession_(session, policyId) {
  const p = POLICIES[cleanVal(policyId) || REQUIRED_POLICY_IDS[0]];
  if (!p) return { success: false, message: 'ไม่พบข้อตกลง' };
  let ackAt = '';
  if (session.role === 'student') ackAt = myPolicyAcks_(session.userId)[p.id + '|' + p.version] || '';
  return { success: true, policy: p, acknowledgedAt: ackAt };
}
function acknowledgePolicy_(session, policyId, version) {
  const p = POLICIES[cleanVal(policyId)];
  if (!p) return { success: false, message: 'ไม่พบข้อตกลง' };
  if (cleanVal(version) && cleanVal(version) !== p.version) return { success: false, message: 'ข้อตกลงมีการปรับปรุง กรุณาเปิดอ่านฉบับล่าสุดอีกครั้ง' };
  const prev = myPolicyAcks_(session.userId)[p.id + '|' + p.version];
  if (prev) return { success: true, acknowledgedAt: prev, message: 'ยินยอมข้อตกลงนี้แล้ว' };
  ensureSchema();
  const st = studentGradeNum_(session.userId);
  const now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  getSpreadsheet().getSheetByName(SHEETS.POLICY_ACKS).appendRow(['ACK-' + Date.now(), p.id, p.version, session.userId, st.name || session.name || '', st.gradeText, now]);
  return { success: true, acknowledgedAt: now, message: 'บันทึกการยินยอมแล้ว ขอบคุณที่อ่านข้อตกลง' };
}
function getPolicyAckSummary_(policyId) {
  const p = POLICIES[cleanVal(policyId) || REQUIRED_POLICY_IDS[0]];
  if (!p) return { success: false, message: 'ไม่พบข้อตกลง' };
  const acked = {};
  sheetRows_(SHEETS.POLICY_ACKS, 7).forEach(function (r) { if (cleanVal(r[1]) === p.id && cleanVal(r[2]) === p.version) acked[cleanVal(r[3]).replace(/^0+/, '')] = cleanVal(r[6]); });
  const students = sheetRows_(SHEETS.STUDENTS, 8).filter(function (r) { return cleanVal(r[0]) && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(r[7])); })
    .map(function (r) { const k = cleanVal(r[0]).replace(/^0+/, ''); return { studentId: cleanVal(r[0]), fullName: cleanVal(r[1]), grade: cleanVal(r[3]), ackAt: acked[k] || '' }; });
  return { success: true, policy: { id: p.id, title: p.title, version: p.version }, total: students.length, acknowledged: students.filter(function (s) { return s.ackAt; }).length, students: students };
}


// =====================================================================
//  ✨ ความใฝ่ฝันของนักเรียน
// =====================================================================
function getDreamOf_(sid) {
  const rows = sheetRows_(SHEETS.DREAMS, 7);
  for (let i = 0; i < rows.length; i++) if (isCodeMatch(rows[i][0], sid)) return { dream: cleanVal(rows[i][3]), icon: cleanVal(rows[i][4]), reason: cleanVal(rows[i][5]), updatedAt: cleanVal(rows[i][6]) };
  return { dream: '', icon: '', reason: '', updatedAt: '' };
}
function saveMyDream_(sid, data) {
  data = data || {};
  const dream = cleanVal(data.dream).substring(0, 80);
  const icon = /^[a-z0-9-]{1,40}$/.test(cleanVal(data.icon)) ? cleanVal(data.icon) : '';
  const reason = cleanVal(data.reason).substring(0, 300);
  ensureSchema();
  const sh = getSpreadsheet().getSheetByName(SHEETS.DREAMS);
  const st = studentGradeNum_(sid);
  const now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [];
  const row = [sid, st.name, st.gradeText, dream, icon, reason, now];
  for (let i = 0; i < rows.length; i++) if (isCodeMatch(rows[i][0], sid)) { sh.getRange(i + 2, 1, 1, 7).setValues([row]); return { success: true, dream: { dream: dream, icon: icon, reason: reason, updatedAt: now }, message: dream ? 'บันทึกความใฝ่ฝันแล้ว ขอให้ฝันเป็นจริง' : 'ลบความใฝ่ฝันแล้ว' }; }
  sh.appendRow(row);
  return { success: true, dream: { dream: dream, icon: icon, reason: reason, updatedAt: now }, message: 'บันทึกความใฝ่ฝันแล้ว ขอให้ฝันเป็นจริง' };
}

/** ส่งไฟล์เอกสารผ่านระบบ (นักเรียนไม่ต้องเข้าสู่ระบบ Google) — เฉพาะไฟล์ในโฟลเดอร์เอกสารที่ตั้งไว้ */
const STUDY_FILE_MAX = 30 * 1024 * 1024;
function studyFileAllowed_(fileId) {
  const cache = CacheService.getScriptCache();
  try { if (cache.get('DOCS_F_' + fileId)) return true; } catch (e) {}
  // ยังไม่เคยเปิดโฟลเดอร์ของไฟล์นี้: ไล่ค้นจากโฟลเดอร์หลักลงไป
  const roots = getStudyDocsFolders_(); const queue = []; let seen = 0;
  Object.keys(roots).forEach(function (g) { try { queue.push({ f: DriveApp.getFolderById(roots[g]), d: 0 }); } catch (e) {} });
  while (queue.length && seen < 300) {
    const cur = queue.shift(); seen++;
    const it = cur.f.getFiles();
    while (it.hasNext()) { const x = it.next(); try { cache.put('DOCS_F_' + x.getId(), cur.f.getId(), 21600); } catch (e) {} if (x.getId() === fileId) return true; }
    if (cur.d < 6) { const fi = cur.f.getFolders(); while (fi.hasNext()) queue.push({ f: fi.next(), d: cur.d + 1 }); }
  }
  return false;
}
function getStudyFile_(fileId, asPdf) {
  const id = extractDriveId_(fileId);
  if (!id) return { success: false, message: 'ไม่พบไฟล์' };
  if (!studyFileAllowed_(id)) return { success: false, code: 'NOT_IN_TREE', message: 'ไฟล์นี้ไม่อยู่ในเอกสารประกอบการเรียน' };
  let file;
  try { file = DriveApp.getFileById(id); } catch (e) { return { success: false, message: 'เปิดไฟล์ไม่ได้ · ตรวจการแชร์โฟลเดอร์' }; }
  const mime = file.getMimeType();
  let blob = null, outMime = mime, converted = false;
  const isGoogle = /^application\/vnd\.google-apps\./.test(mime);
  try {
    if (isGoogle || (asPdf && !/pdf|image\//.test(mime))) { blob = file.getAs('application/pdf'); outMime = 'application/pdf'; converted = true; }
    else blob = file.getBlob();
  } catch (e) {
    if (isGoogle) return { success: false, message: 'ไฟล์ชนิดนี้แปลงเป็น PDF ไม่ได้' };
    blob = file.getBlob(); outMime = mime; converted = false;
  }
  const bytes = blob.getBytes();
  if (bytes.length > STUDY_FILE_MAX) return { success: false, tooBig: true, message: 'ไฟล์ใหญ่เกิน 30 MB เปิดในแอปไม่ได้' };
  let name = file.getName();
  if (converted && !/\.pdf$/i.test(name)) name = name.replace(/\.(docx?|pptx?|xlsx?)$/i, '') + '.pdf';
  return { success: true, id: id, name: name, mime: outMime, originalMime: mime, converted: converted, size: bytes.length, data: Utilities.base64Encode(bytes) };
}


// =====================================================================
//  📖 หะละเกาะฮฺอัลกุรอาน: ตารางตามช่วงเวลา + สแกน QR เข้าร่วม + ประวัติ
// =====================================================================
const HQ_SLOTS = { subuh: 'หลังศุบฮิ', zuhur: 'หลังซุฮริ', asr: 'หลังอัศริ', maghrib: 'หลังมัฆริบ', isha: 'หลังอิชาอ์', other: 'ช่วงเวลาอื่น' };
function hqToday_() { return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'); }
function hqNowMin_() { const t = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'HH:mm').split(':'); return (+t[0]) * 60 + (+t[1]); }
function hqMin_(hhmm) { const m = String(hhmm || '').match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : -1; }
function hqTime_(v) { if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Bangkok', 'HH:mm'); const m = String(v || '').match(/(\d{1,2}):(\d{2})/); return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : ''; }
// v17.80 · หะละเกาะฮฺแบบกลุ่ม: ผู้ดูแลกำหนดรายชื่อผู้เรียน (คอลัมน์ M) · ว่าง = ใช้ระดับชั้นแบบเดิม
function hqRows_() { const sh = getSpreadsheet().getSheetByName(SHEETS.HALAQAH); if (!sh || sh.getLastRow() < 2) return []; return sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(HEADERS.HALAQAH.length, sh.getMaxColumns())).getValues(); }
function hqKey_(v) { return cleanVal(v).toUpperCase().replace(/[^0-9A-Z\u0E00-\u0E7F]/g, '').replace(/^0+/, ''); }
function hqMembers_(v) { return String(v == null ? '' : v).split(/[,\n]/).map(hqKey_).filter(Boolean); }
function hqIsMember_(h, sid) { return !h.members.length || h.members.indexOf(hqKey_(sid)) !== -1; }
function readHalaqah_() {
  return hqRows_().filter(function (r) { return cleanVal(r[0]) && cleanVal(r[10]) !== 'deleted'; }).map(function (r) {
    return { id: cleanVal(r[0]), name: cleanVal(r[1]), slot: cleanVal(r[2]) || 'other', days: String(r[3] === '' ? '0,1,2,3,4,5,6' : r[3]).split(',').map(function (x) { return cleanVal(x); }).filter(function (x) { return /^[0-6]$/.test(x); }),
      start: hqTime_(r[4]), end: hqTime_(r[5]), grades: String(r[6] || '').split(',').map(function (x) { return cleanVal(x); }).filter(function (x) { return /^[1-6]$/.test(x); }),
      teacher: cleanVal(r[7]), teacherName: cleanVal(r[8]), location: cleanVal(r[9]), createdAt: normalizeDateStr_(r[11]), members: hqMembers_(r[12]),
      dates: String(r[13] == null ? '' : r[13]).split(/[,\s]+/).map(cleanVal).filter(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x); }).sort() };
  });
}
// v17.92 · อาจารย์เห็น/แก้เฉพาะกลุ่มที่ตัวเองเป็นผู้ดูแล · แอดมินเห็นทั้งหมด
// v18.01 · ผู้ดูแลตรงกับบัญชี (username) หรือชื่อผู้ดูแลตรงกับชื่อบัญชี (กรณีแอดมินสร้างกลุ่มแล้วพิมพ์ชื่ออาจารย์)
function hqNm_(v) { return cleanVal(v).replace(/^(อาจารย์|อ\.|ครู|ustaz|ustazah|อุสตาซ(ะห์)?)\s*/i, '').replace(/\s+/g, ' ').toLowerCase(); }
function hqIsOwner_(h, session) {
  if (!session) return false;
  if (session.role === 'admin') return true;
  if (String(h.teacher || '').toLowerCase() === String(session.userId || '').toLowerCase()) return true;
  const a = hqNm_(h.teacherName), b = hqNm_(session.name);
  return !!a && !!b && a === b;
}
// v18.01 · แอดมิน: สรุปการเช็คชื่อหะละเกาะฮฺรายกลุ่ม/ผู้ดูแล ในช่วงวันที่
function halaqahReport_(from, to) {
  const today = hqToday_();
  from = /^\d{4}-\d{2}-\d{2}$/.test(String(from || '')) ? String(from) : today.slice(0, 8) + '01';
  to = /^\d{4}-\d{2}-\d{2}$/.test(String(to || '')) ? String(to) : today;
  if (to > today) to = today;
  if (from > to) from = to;
  const days = [];
  let d = new Date(from + 'T00:00:00'); const end = new Date(to + 'T00:00:00');
  for (let i = 0; d <= end && i < 400; i++) { days.push(Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd')); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }
  const stu = {};
  sheetRows_(SHEETS.STUDENTS, 4).forEach(function (r) { const k = hqKey_(r[0]); if (k) stu[k] = { id: cleanVal(r[0]), name: cleanVal(r[1]), grade: cleanVal(r[3]) }; });
  const logs = hqLogs_().filter(function (l) { return l.date >= from && l.date <= to; });
  const skips = hqSkips_();
  const groups = readHalaqah_().map(function (h) {
    const lg = logs.filter(function (l) { return l.sessionId === h.id; });
    const sk = skips[h.id] || [];
    const dates = days.filter(function (x) { return hqOnDate_(h, x) && (sk.indexOf(x) === -1 || lg.some(function (l) { return l.date === x; })); });
    const ids = h.members.length ? h.members.slice() : [];
    lg.forEach(function (l) { const k = hqKey_(l.studentId); if (ids.indexOf(k) === -1) ids.push(k); });
    const tot = { present: 0, late: 0, leave: 0, absent: 0, none: 0 };
    const held = {};
    lg.forEach(function (l) { held[l.date] = 1; });
    const members = ids.map(function (k) {
      const s = stu[k] || { id: k, name: k, grade: '' };
      const c = { present: 0, late: 0, leave: 0, absent: 0, none: 0 };
      dates.forEach(function (x) {
        const l = lg.filter(function (y) { return y.date === x && hqKey_(y.studentId) === k; })[0];
        const st = !l ? 'none' : /late|สาย/i.test(l.status) ? 'late' : /leave|ลา/i.test(l.status) ? 'leave' : /absent|ขาด/i.test(l.status) ? 'absent' : 'present';
        c[st]++; tot[st]++;
      });
      return { id: s.id, name: s.name, grade: s.grade, c: c };
    }).sort(function (a, b) { return String(a.grade).localeCompare(String(b.grade)) || String(a.name).localeCompare(String(b.name)); });
    return { id: h.id, name: h.name, teacher: h.teacher, teacherName: h.teacherName, location: h.location, start: h.start, end: h.end, dates: dates, held: Object.keys(held).sort(), members: members, total: tot };
  });
  return { success: true, from: from, to: to, groups: groups };
}
function hqOwnCheck_(id, session) { const h = readHalaqah_().filter(function (x) { return x.id === cleanVal(id); })[0]; if (h && !hqIsOwner_(h, session)) return { success: false, code: 'FORBIDDEN', message: 'หะละเกาะฮฺนี้อยู่ในความดูแลของ ' + (h.teacherName || 'อาจารย์ท่านอื่น') }; return null; }
// v17.92 · วันที่จัด (กำหนดเป็นวันที่) · ว่าง = ใช้วันในสัปดาห์แบบเดิม
function hqOnDate_(h, date) { if (h.dates && h.dates.length) return h.dates.indexOf(date) !== -1; const d = new Date(date + 'T00:00:00').getDay(); return h.days.indexOf(String(d)) !== -1; }
function halaqahSessions_(grade, all, sid) { return readHalaqah_().filter(function (h) { if (all) return true; if (h.members.length) return !!sid && hqIsMember_(h, sid); return !h.grades.length || h.grades.indexOf(grade) !== -1; }); }
function saveHalaqahSession_(d, session) {
  d = d || {};
  const name = cleanVal(d.name).substring(0, 80) || HQ_SLOTS[cleanVal(d.slot)] && ('หะละเกาะฮฺ' + HQ_SLOTS[cleanVal(d.slot)]);
  if (!name) return { success: false, message: 'กรุณาตั้งชื่อหะละเกาะฮฺ' };
  const start = hqTime_(d.start), end = hqTime_(d.end);
  if (!start || !end || hqMin_(end) <= hqMin_(start)) return { success: false, message: 'กรุณาระบุเวลาเริ่มและสิ้นสุดให้ถูกต้อง' };
  const days = (Array.isArray(d.days) ? d.days : String(d.days || '').split(',')).map(String).filter(function (x) { return /^[0-6]$/.test(x); });
  const dates = (Array.isArray(d.dates) ? d.dates : String(d.dates || '').split(',')).map(cleanVal).filter(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort().slice(0, 200);
  if (!days.length && !dates.length) return { success: false, message: 'เลือกวันที่จัดหะละเกาะฮฺอย่างน้อย 1 วัน' };
  const isAdm = session && session.role === 'admin';
  if (cleanVal(d.id)) { const deny = hqOwnCheck_(d.id, session); if (deny) return deny; }
  const grades = (Array.isArray(d.grades) ? d.grades : String(d.grades || '').split(',')).map(String).filter(function (x) { return /^[1-6]$/.test(x); });
  const slot = HQ_SLOTS[cleanVal(d.slot)] ? cleanVal(d.slot) : 'other';
  ensureSchema();
  const sh = getSpreadsheet().getSheetByName(SHEETS.HALAQAH);
  const id = cleanVal(d.id) || ('HLQ-' + Date.now());
  const members = (Array.isArray(d.members) ? d.members : String(d.members || '').split(',')).map(hqKey_).filter(function (x) { return x && x.length <= 30; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 2000);
  if (sh.getMaxColumns() < HEADERS.HALAQAH.length) sh.insertColumnsAfter(sh.getMaxColumns(), HEADERS.HALAQAH.length - sh.getMaxColumns());
  if (!cleanVal(sh.getRange(1, 13).getValue())) sh.getRange(1, 13).setValue(HEADERS.HALAQAH[12]);
  const old = readHalaqah_().filter(function (x) { return x.id === id; })[0];
  const owner = isAdm ? (cleanVal(d.teacher) || (old && old.teacher) || session.userId) : ((old && old.teacher) || session.userId);
  if (!cleanVal(sh.getRange(1, 14).getValue())) sh.getRange(1, 14).setValue(HEADERS.HALAQAH[13]);
  const row = [id, name, slot, days.join(','), start, end, grades.join(','), owner, cleanVal(d.teacherName).substring(0, 80) || session.name || session.userId, cleanVal(d.location).substring(0, 80), 'active', Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'), members.join(','), dates.join(',')];
  const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [];
  for (let i = 0; i < rows.length; i++) if (cleanVal(rows[i][0]) === id) { sh.getRange(i + 2, 13, 1, 2).setNumberFormat('@'); sh.getRange(i + 2, 1, 1, row.length).setValues([row]); return { success: true, id: id, members: members.length, message: 'บันทึกหะละเกาะฮฺแล้ว' }; }
  const nr = sh.getLastRow() + 1; sh.getRange(nr, 13, 1, 2).setNumberFormat('@'); sh.getRange(nr, 1, 1, row.length).setValues([row]);
  return { success: true, id: id, message: 'เพิ่มหะละเกาะฮฺแล้ว' };
}
function deleteHalaqahSession_(id) {
  id = cleanVal(id); const sh = getSpreadsheet().getSheetByName(SHEETS.HALAQAH);
  const rows = sheetRows_(SHEETS.HALAQAH, 1);
  for (let i = 0; i < rows.length; i++) if (cleanVal(rows[i][0]) === id) { sh.getRange(i + 2, 11).setValue('deleted'); return { success: true, message: 'ลบหะละเกาะฮฺแล้ว' }; }
  return { success: false, message: 'ไม่พบหะละเกาะฮฺ' };
}
function hqSig_(id, date) { return signToken_('hlq|' + id + '|' + date).slice(0, 16); }
function getHalaqahQr_(id, date) {
  const h = readHalaqah_().filter(function (x) { return x.id === cleanVal(id); })[0];
  if (!h) return { success: false, message: 'ไม่พบหะละเกาะฮฺ' };
  date = /^\d{4}-\d{2}-\d{2}$/.test(cleanVal(date)) ? cleanVal(date) : hqToday_();
  return { success: true, session: h, date: date, qr: 'KHALIFAH_HLQ:' + h.id + ':' + date + ':' + hqSig_(h.id, date) };
}
function hqLogs_() {
  return sheetRows_(SHEETS.HALAQAH_LOGS, HEADERS.HALAQAH_LOGS.length).filter(function (r) { return cleanVal(r[0]); }).map(function (r) {
    return { id: cleanVal(r[0]), sessionId: cleanVal(r[1]), sessionName: cleanVal(r[2]), date: normalizeDateStr_(r[3]), time: hqTime_(r[4]), studentId: cleanVal(r[5]), studentName: cleanVal(r[6]), grade: cleanVal(r[7]), method: cleanVal(r[8]), by: cleanVal(r[9]), status: cleanVal(r[10]) || 'present', note: cleanVal(r[11]) };
  });
}
function hqUpsert_(h, date, st, status, method, by, note) {
  const sh = getSpreadsheet().getSheetByName(SHEETS.HALAQAH_LOGS);
  const now = hqTime_(Utilities.formatDate(new Date(), 'Asia/Bangkok', 'HH:mm'));
  const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues() : [];
  for (let i = 0; i < rows.length; i++) {
    if (cleanVal(rows[i][1]) === h.id && normalizeDateStr_(rows[i][3]) === date && isCodeMatch(rows[i][5], st.id)) {
      if (method === 'qr') return { already: true };
      sh.getRange(i + 2, 9, 1, 4).setValues([[method, by, status, note || '']]);
      return { updated: true };
    }
  }
  sh.appendRow(['HLL-' + Date.now() + '-' + Math.floor(Math.random() * 1000), h.id, h.name, date, now, st.id, st.name, st.gradeText, method, by, status, note || '']);
  return { added: true };
}
function halaqahCheckIn_(session, qr) {
  const m = String(qr || '').match(/^KHALIFAH_HLQ:([^:]+):(\d{4}-\d{2}-\d{2}):([A-Za-z0-9_-]+)$/);
  if (!m) return { success: false, message: 'QR นี้ไม่ใช่ QR หะละเกาะฮฺ' };
  const id = m[1], date = m[2];
  if (!safeEquals_(hqSig_(id, date), m[3])) return { success: false, message: 'QR ไม่ถูกต้อง' };
  if (date !== hqToday_()) return { success: false, message: 'QR นี้เป็นของวันอื่น ใช้ได้เฉพาะวันที่ ' + date };
  const h = readHalaqah_().filter(function (x) { return x.id === id; })[0];
  if (!h) return { success: false, message: 'ไม่พบหะละเกาะฮฺนี้' };
  const st = studentGradeNum_(session.userId);
  if (h.members.length && !hqIsMember_(h, session.userId)) return { success: false, message: 'คุณไม่ได้อยู่ในกลุ่ม' + h.name + (h.teacherName ? ' (ผู้ดูแล ' + h.teacherName + ')' : '') };
  if (!h.members.length && h.grades.length && h.grades.indexOf(st.grade) === -1) return { success: false, message: 'หะละเกาะฮฺนี้สำหรับชั้น ' + h.grades.map(function (g) { return 'ม.' + g; }).join(', ') + ' เท่านั้น' };
  if (!hqOnDate_(h, date)) return { success: false, message: 'วันนี้ไม่มี' + h.name + (h.dates && h.dates.length ? ' (วันที่จัด: ' + h.dates.map(function (x) { return leaveDateTh_(x); }).slice(0, 3).join(', ') + ')' : '') };
  const now = hqNowMin_(), s = hqMin_(h.start), e = hqMin_(h.end);
  if (now < s - 20) return { success: false, message: 'ยังไม่ถึงเวลาหะละเกาะฮฺ (เริ่ม ' + h.start + ')' };
  if (now > e + 10) return { success: false, message: 'เลยเวลาหะละเกาะฮฺแล้ว (ถึง ' + h.end + ') กรุณาแจ้งอาจารย์ผู้ดูแล' };
  const status = now > s + 15 ? 'late' : 'present';
  const r = hqUpsert_(h, date, { id: session.userId, name: st.name, gradeText: st.gradeText }, status, 'qr', session.userId, '');
  if (r.already) return { success: true, already: true, session: h, message: 'บันทึกการเข้า' + h.name + 'ไว้แล้ววันนี้' };
  return { success: true, session: h, status: status, message: (status === 'late' ? 'บันทึกแล้ว (มาสาย) · ' : 'บันทึกการเข้าแล้ว · ') + h.name };
}
function getMyHalaqah_(sid) {
  const st = studentGradeNum_(sid);
  const sessions = halaqahSessions_(st.grade, false, sid);
  const logs = hqLogs_().filter(function (l) { return isCodeMatch(l.studentId, sid); }).sort(function (a, b) { return (b.date + b.time).localeCompare(a.date + a.time); });
  return { success: true, sessions: sessions, logs: logs.slice(0, 400), today: hqToday_(), nowMin: hqNowMin_() };
}
function getHalaqahRoster_(id, date) {
  const h = readHalaqah_().filter(function (x) { return x.id === cleanVal(id); })[0];
  if (!h) return { success: false, message: 'ไม่พบหะละเกาะฮฺ' };
  date = /^\d{4}-\d{2}-\d{2}$/.test(cleanVal(date)) ? cleanVal(date) : hqToday_();
  const logs = {}; hqLogs_().forEach(function (l) { if (l.sessionId === h.id && l.date === date) logs[cleanVal(l.studentId).replace(/^0+/, '')] = l; });
  const students = sheetRows_(SHEETS.STUDENTS, 8).filter(function (r) { if (!cleanVal(r[0]) || /ลาออก|สำเร็จ|พ้นสภาพ/.test(String(r[7]))) return false; if (h.members.length) return hqIsMember_(h, r[0]); const m = String(r[3]).match(/([1-6])/); return !h.grades.length || (m && h.grades.indexOf(m[1]) !== -1); })
    .map(function (r) { const k = cleanVal(r[0]).replace(/^0+/, ''); const l = logs[k]; return { studentId: cleanVal(r[0]), fullName: cleanVal(r[1]), grade: cleanVal(r[3]), status: l ? l.status : '', time: l ? l.time : '', method: l ? l.method : '' }; });
  const found = {}; students.forEach(function (x) { found[hqKey_(x.studentId)] = 1; });
  const missing = h.members.filter(function (k) { return !found[k]; });
  missing.forEach(function (k) { const l = logs[k]; students.push({ studentId: k, fullName: '', grade: '', status: l ? l.status : '', time: l ? l.time : '', method: l ? l.method : '', unresolved: true }); });
  return { success: true, session: h, date: date, students: students, missing: missing };
}
// v18.67 · วันที่ "ไม่ได้จัด" (ตัดออกจากครั้งที่จัด) · เก็บใน Settings คีย์ HalaqahSkip = {id:[dates]}
function hqSkips_() { let v = {}; try { v = JSON.parse((getSettings().data || {}).HalaqahSkip || '{}'); } catch (e) { v = {}; } return v && typeof v === 'object' ? v : {}; }
function skipHalaqahDay_(id, date, undo) {
  id = cleanVal(id); date = cleanVal(date);
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, message: 'ข้อมูลไม่ครบ' };
  const v = hqSkips_(); const L = (v[id] || []).filter(function (x) { return x !== date; });
  const off = undo === true || undo === 'true' || undo === '1' || undo === 1;
  if (!off) L.push(date);
  const cut = Utilities.formatDate(new Date(Date.now() - 400 * 864e5), 'Asia/Bangkok', 'yyyy-MM-dd');
  v[id] = L.filter(function (x) { return x >= cut; }).sort(); if (!v[id].length) delete v[id];
  saveSetting({ key: 'HalaqahSkip', value: JSON.stringify(v), description: 'วันที่หะละเกาะฮฺไม่ได้จัด (JSON)' });
  return { success: true, message: off ? 'นำวันที่กลับมาแล้ว' : 'ตัดวันที่นี้ออกแล้ว (ไม่ได้จัด)' };
}
// v18.65 · ลบการเช็คชื่อหะละเกาะฮฺทั้งครั้ง (ของกลุ่มนี้ในวันที่นี้) · ใช้แก้กรณีเช็คชื่อซ้ำ/ผิดวัน
function deleteHalaqahDay_(id, date) {
  id = cleanVal(id); date = cleanVal(date);
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, message: 'ข้อมูลไม่ครบ' };
  const sh = getSpreadsheet().getSheetByName(SHEETS.HALAQAH_LOGS);
  if (!sh || sh.getLastRow() < 2) return { success: true, deleted: 0, message: 'ไม่มีบันทึกของวันนี้' };
  const lock = LockService.getScriptLock(); try { lock.waitLock(15000); } catch (e) {}
  try {
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
    const hit = []; rows.forEach(function (r, i) { if (cleanVal(r[1]) === id && normalizeDateStr_(r[3]) === date) hit.push(i + 2); });
    for (let j = hit.length - 1; j >= 0;) { let k = j; while (k > 0 && hit[k - 1] === hit[k] - 1) k--; sh.deleteRows(hit[k], hit[j] - hit[k] + 1); j = k - 1; }
    return { success: true, deleted: hit.length, message: hit.length ? 'ลบการเช็คชื่อ ' + hit.length + ' รายการแล้ว' : 'ไม่มีบันทึกของวันนี้' };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
function markHalaqah_(d, session) {
  const h = readHalaqah_().filter(function (x) { return x.id === cleanVal(d && d.id); })[0];
  if (!h) return { success: false, message: 'ไม่พบหะละเกาะฮฺ' };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(cleanVal(d.date)) ? cleanVal(d.date) : hqToday_();
  if (date > hqToday_()) return { success: false, message: 'บันทึกล่วงหน้าไม่ได้' };
  ensureSchema();
  const info = {}; sheetRows_(SHEETS.STUDENTS, 4).forEach(function (r) { if (cleanVal(r[0])) { const o = { id: cleanVal(r[0]), name: cleanVal(r[1]), gradeText: cleanVal(r[3]) }; info[cleanVal(r[0]).replace(/^0+/, '')] = o; info[hqKey_(r[0])] = o; } });
  // สมาชิกกลุ่มที่ไม่พบในชีตนักเรียน: ใช้ชื่อที่แอปส่งมา
  const nm = (d && d.names) || {}; h.members.forEach(function (k) { if (!info[k]) info[k] = { id: k, name: cleanVal(nm[k] || '').substring(0, 120) || k, gradeText: cleanVal((d.grades || {})[k] || '') }; });
  const sh = getSpreadsheet().getSheetByName(SHEETS.HALAQAH_LOGS);
  const lock = LockService.getScriptLock(); try { lock.waitLock(15000); } catch (e) {}
  try {
    const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues() : [];
    const at = {}; rows.forEach(function (r, i) { if (cleanVal(r[1]) === h.id && normalizeDateStr_(r[3]) === date) at[cleanVal(r[5]).replace(/^0+/, '')] = i; });
    const now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'HH:mm');
    const by = session.name || session.userId; const add = []; let n = 0;
    const marks = (d && d.marks) || {};
    Object.keys(marks).slice(0, 500).forEach(function (sid) {
      const status = ['present', 'late', 'excused', 'absent'].indexOf(cleanVal(marks[sid])) !== -1 ? cleanVal(marks[sid]) : '';
      const k0 = cleanVal(sid).replace(/^0+/, ''); const st = info[k0] || info[hqKey_(sid)]; const k = st ? cleanVal(st.id).replace(/^0+/, '') : k0;
      if (!status || !st) return;
      if (at[k] !== undefined) sh.getRange(at[k] + 2, 9, 1, 3).setValues([['teacher', by, status]]);
      else add.push(['HLL-' + Date.now() + '-' + add.length, h.id, h.name, date, now, st.id, st.name, st.gradeText, 'teacher', by, status, '']);
      n++;
    });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, add[0].length).setValues(add);
    return { success: true, saved: n, message: 'บันทึกการเข้าหะละเกาะฮฺ ' + n + ' คนแล้ว' };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

/* ---------- v17.39 · ช่วงมีประจำเดือน (นักเรียนหญิง) ----------
   เก็บใน Settings คีย์ PeriodEpisodes (JSON) · ตอนกดสิ้นสุด ระบบเพิ่มบันทึก "อุซุร (มีประจำเดือน)"
   ให้ทุกเวลาละหมาดตั้งแต่วันเริ่มจนถึงก่อนเวลาที่กลับมาละหมาดได้ (ข้ามเวลาที่มีบันทึกอยู่แล้ว) */
const PERIOD_SLOTS_ = ['ซุบฮิ', 'ซุฮริ', 'อัศรฺ', 'มัฆริบ', 'อีชาอ์'];
const PERIOD_STATUS_ = 'อุซุร (มีประจำเดือน)';
function periodList_() { let v = []; try { v = JSON.parse((getSettings().data || {}).PeriodEpisodes || '[]'); } catch (e) { v = []; } return Array.isArray(v) ? v : []; }
function periodSave_(list) {
  const cut = Utilities.formatDate(new Date(Date.now() - 400 * 864e5), 'Asia/Bangkok', 'yyyy-MM-dd');
  list = list.filter(function (x) { return x.status === 'active' || String(x.end || x.start) >= cut; });
  saveSetting({ key: 'PeriodEpisodes', value: JSON.stringify(list), description: 'ช่วงมีประจำเดือนของนักเรียนหญิง (JSON)' });
}
function periodYmd_(d) { return Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd'); }
function periodAddDays_(ymd, n) { const d = new Date(ymd + 'T12:00:00+07:00'); d.setDate(d.getDate() + n); return periodYmd_(d); }
function periodIsGirl_(st) {
  if (!st) return false;
  const g = String(st.gender || st.sex || '').trim();
  if (/หญิง|female|^f$/i.test(g)) return true;
  if (/ชาย|male|^m$/i.test(g)) return false;
  return /^(นางสาว|นาง|เด็กหญิง|ด\.ญ\.|น\.ส\.)/.test(String(st.fullName || st.name || '').trim());
}
function periodAction_(action, data, session) {
  const sid = cleanVal(session.userId);
  const today = periodYmd_(new Date());
  const lock = LockService.getScriptLock(); try { lock.waitLock(15000); } catch (e) {}
  try {
    const list = periodList_();
    const mine = list.filter(function (x) { return isCodeMatch(x.studentId, sid); });
    const active = mine.filter(function (x) { return x.status === 'active'; })[0] || null;
    if (action === 'getMyPeriod') return { success: true, active: active, history: mine.filter(function (x) { return x.status !== 'active'; }).slice(-5).reverse() };
    if (action === 'periodStart') {
      if (active) return { success: false, code: 'ALREADY_ACTIVE', message: 'มีช่วงประจำเดือนที่ยังไม่สิ้นสุดอยู่แล้ว (เริ่ม ' + active.start + ')', active: active };
      const st = getStudentForStaff_(sid); const stu = st && st.student;
      if (!periodIsGirl_(stu)) return { success: false, code: 'GIRLS_ONLY', message: 'เมนูนี้สำหรับนักเรียนหญิงเท่านั้น' };
      const start = formatSheetDate(data.startDate) || today;
      if (start > today) return { success: false, message: 'วันที่เริ่มต้องไม่เกินวันนี้' };
      if (start < periodAddDays_(today, -15)) return { success: false, message: 'เลือกวันเริ่มย้อนหลังได้ไม่เกิน 15 วัน' };
      const ep = { id: 'PER-' + Date.now(), studentId: sid, name: cleanVal(stu.fullName || ''), grade: cleanVal(stu.grade || ''), start: start, status: 'active', note: cleanVal(data.note || '').slice(0, 200), createdAt: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss') };
      list.push(ep); periodSave_(list);
      try { sendNotification_({ title: 'แจ้งมีประจำเดือน: ' + ep.name, body: 'เริ่ม ' + start + ' · ระบบจะบันทึกอุซุรให้อัตโนมัติเมื่อนักเรียนกดสิ้นสุด', audience: 'admins' }, { userId: sid, name: ep.name }); } catch (e) {}
      return { success: true, active: ep, message: 'บันทึกวันเริ่มแล้ว · เมื่อประจำเดือนหมด ให้กด "สิ้นสุดประจำเดือน"' };
    }
    if (!active) return { success: false, code: 'NO_ACTIVE', message: 'ไม่มีช่วงประจำเดือนที่กำลังรออยู่' };
    if (action === 'periodCancel') {
      const ix = list.indexOf(active); list.splice(ix, 1); periodSave_(list);
      return { success: true, message: 'ยกเลิกการแจ้งแล้ว' };
    }
    // periodEnd: endDate = วันที่ประจำเดือนหมด · resume = เวลาแรกที่กลับมาละหมาดได้ของวันนั้น (0–4, 5 = ทั้งวันยังมี)
    const end = formatSheetDate(data.endDate) || today;
    if (end < active.start) return { success: false, message: 'วันที่สิ้นสุดต้องไม่ก่อนวันเริ่ม (' + active.start + ')' };
    if (end > today) return { success: false, message: 'วันที่สิ้นสุดต้องไม่เกินวันนี้' };
    let resume = parseInt(data.resumeSlot, 10); if (!(resume >= 0 && resume <= 5)) resume = 0;
    const ss = getSpreadsheet(); const sheet = ss.getSheetByName(SHEETS.PRAYERS);
    const rows = sheet.getDataRange().getValues(); const have = {};
    for (let i = 1; i < rows.length; i++) {
      if (!isCodeMatch(rows[i][1], sid)) continue;
      const st = String(rows[i][14] || ''); if (/ขาด/.test(st)) continue;
      have[formatSheetDate(rows[i][6]) + '|' + formatPrayerTimeThai(rows[i][4])] = 1;
    }
    const out = []; let d = active.start, guard = 0; const stamp = new Date().toISOString();
    const note = 'บันทึกอัตโนมัติ: ช่วงมีประจำเดือน ' + active.start + ' ถึง ' + end;
    while (d <= end && guard++ < 40) {
      const n = d < end ? 5 : resume;
      for (let k = 0; k < n; k++) {
        const slot = formatPrayerTimeThai(PERIOD_SLOTS_[k]);
        if (have[d + '|' + slot]) continue;
        out.push(['PRY-PER-' + Date.now() + '-' + out.length, formatAsText(sid), active.name, active.grade, slot, stamp, d, '-', '', '', 'อุซุร · บันทึกอัตโนมัติ', 0, 'ไม่ใช่', '', PERIOD_STATUS_, note]);
      }
      d = periodAddDays_(d, 1);
    }
    if (out.length) sheet.getRange(sheet.getLastRow() + 1, 1, out.length, out[0].length).setValues(out);
    active.status = 'ended'; active.end = end; active.resumeSlot = resume; active.records = out.length; active.endedAt = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    periodSave_(list);
    try { CacheService.getScriptCache().remove('PRAYERS_ALL'); } catch (e) {}
    return { success: true, ended: active, added: out.length, message: 'บันทึกอุซุรย้อนหลังให้แล้ว ' + out.length + ' เวลา' };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
