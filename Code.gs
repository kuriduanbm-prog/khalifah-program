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
    'มีผล ณ วันที่', 'หมายเหตุสถานะ'
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
    'วันที่', 'เวลา', 'สถานะการมาเรียน', 'หมายเหตุ', 'รหัสวิชา', 'ชื่อวิชา', 'ผู้เช็คชื่อ'
  ],
  ACTIVITIES: [
    'รหัสกิจกรรม', 'ชื่อกิจกรรม', 'รายละเอียด', 'วันเริ่มต้น', 'วันสิ้นสุด', 
    'สถานที่จัดกิจกรรม', 'ผู้สร้างกิจกรรม', 'วันที่สร้าง', 'จำนวนผู้เข้าร่วม'
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
    'ผู้ส่ง (username)', 'ชื่อผู้ส่ง', 'สถานะ', 'หมดอายุ'
  ],
  NOTIF_READS: ['รหัสแจ้งเตือน', 'ผู้ใช้', 'อ่านเมื่อ', 'ซ่อน'],
  HALAQAH: ['รหัสหะละเกาะฮฺ', 'ชื่อ', 'ช่วงเวลา', 'วัน (0=อา.)', 'เริ่ม', 'สิ้นสุด', 'ระดับชั้น', 'ผู้ดูแล (username)', 'ชื่อผู้ดูแล', 'สถานที่', 'สถานะ', 'สร้างเมื่อ'],
  HALAQAH_LOGS: ['รหัสบันทึก', 'รหัสหะละเกาะฮฺ', 'ชื่อหะละเกาะฮฺ', 'วันที่', 'เวลา', 'รหัสนักเรียน', 'ชื่อนักเรียน', 'ระดับชั้น', 'วิธีบันทึก', 'ผู้บันทึก', 'สถานะ', 'หมายเหตุ'],
  DREAMS: ['รหัสนักเรียน', 'ชื่อนักเรียน', 'ระดับชั้น', 'ความใฝ่ฝัน', 'ไอคอน', 'เหตุผล/เป้าหมาย', 'อัปเดตเมื่อ'],
  POLICY_ACKS: ['รหัสยินยอม', 'รหัสข้อตกลง', 'ฉบับ', 'รหัสนักเรียน', 'ชื่อนักเรียน', 'ระดับชั้น', 'ยินยอมเมื่อ'],
  BEHAVIOR: [
    'รหัสบันทึก', 'วันที่', 'เวลาบันทึก', 'ภาคเรียน', 'รหัสนักเรียน', 'ชื่อนักเรียน', 'ระดับชั้น',
    'หมวด', 'รหัสหัวข้อ', 'หัวข้อ', 'คะแนน (+/-)', 'หมายเหตุ', 'ผู้บันทึก (username)', 'ชื่อผู้บันทึก', 'สถานะ', 'ผู้ยกเลิก'
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
    'สถานะคำขอ', 'เวลาที่ส่งคำขอ', 'ผู้อนุมัติ', 'เวลาที่อนุมัติ', 'หมายเหตุอาจารย์'
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
function issueToken_(role, userId, name, owner) {
  const payload = {
    r: role,
    o: owner ? 1 : 0,
    u: cleanVal(userId),
    n: cleanVal(name || ''),
    exp: Date.now() + SESSION_TTL_MS,
    ep: getProp_('SESSION_EPOCH') || '0'
  };
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
    return { role: p.r, userId: p.u, name: p.n || '', owner: p.r === 'admin' && (!!p.o || p.u === 'MasterAdmin') };
  } catch (e) {
    return null;
  }
}

const INSPECTOR_ROLE_VALUES = ['inspector', 'ผู้ตรวจการ'];
function isInspectorRole_(v) { return INSPECTOR_ROLE_VALUES.indexOf(cleanVal(v).toLowerCase()) !== -1; }
// บทบาทที่เข้าระบบทางแท็บแอดมินด้วยรหัสผ่านอย่างเดียว
const PASSWORD_ONLY_ROLE_VALUES = ['subadmin', 'admin', 'ผู้ช่วยแอดมิน', 'ผู้ดูแลระบบ', 'แอดมินรอง', 'executive', 'ผู้บริหาร', 'inspector', 'ผู้ตรวจการ'];
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
  updateProfilePhoto: 'student', prayerLateRequest: 'student', updateStudentGrade: 'student',
  resetMyHasanat: 'student', submitTeacherEvaluation: 'student', getMyEvaluationStatus: 'student', getEvaluationTargets: 'student',
  getTeacherEvaluationSummary: 'staff',
  // คะแนนพฤติกรรม: ผู้ตรวจการ (และแอดมิน) บันทึก/ยกเลิก · แอดมินตั้งค่าหัวข้อ
  addBehaviorLogs: 'inspector', cancelBehaviorLog: 'inspector', getBehaviorData: 'inspector', getMyBehavior: 'student',
  saveBehaviorRules: 'admin',
  // แอดมิน/อาจารย์แก้ไขหรือเพิ่มบันทึกละหมาดของนักเรียน · แอดมินตั้งช่วงเวลาละหมาด
  updatePrayerRecord: 'staff', addPrayerForStudent: 'staff', savePrayerWindows: 'admin',
  // ตารางสอน: แอดมินสร้าง · อาจารย์และนักเรียนดู (ตามที่แอดมินเปิดการมองเห็น)
  getTimetable: 'student', saveTimetable: 'admin', saveTimetableConfig: 'admin',
  // บุคลากร
  getAllStudents: 'staff', getSubAdmins: 'staff', getTeachers: 'staff', getPendingRegistrations: 'staff',
  registerStudent: 'staff', updateStudentFull: 'staff', updateStudentStatus: 'staff',
  deletePrayerRecord: 'staff', recordAttendance: 'staff', saveDailyAttendance: 'staff',
  saveSubjectGrades: 'staff', updateSubjectScores: 'staff',
  createActivity: 'staff', deleteActivity: 'staff', deleteActivityAttendee: 'staff',
  saveCalendarEvent: 'staff', deleteCalendarEvent: 'staff', updatePrayerLateRequestStatus: 'staff',
  approveRegistrationAndSendEmail: 'staff', saveSubjectAssignments: 'staff', saveAssignmentScores: 'staff', deletePendingRegistration: 'staff', updateSubAdminPhoto: 'staff',
  // แอดมิน (หลัก + รอง)
  getAdmins: 'admin', addSubAdmin: 'admin', deleteSubAdmin: 'admin', deleteStudent: 'admin',
  batchPromote: 'admin', fullSchoolBatchPromote: 'admin',
  saveSetting: 'admin', saveSubjects: 'admin', saveCurrentTerm: 'admin', saveStudyDocsFolders: 'admin',
  listStudyDocs: 'student', getStudyDocsConfig: 'student', getStudyFile: 'student',
  getMyDream: 'student', saveMyDream: 'student', getDreams: 'staff',
  getHalaqahSessions: 'student', halaqahCheckIn: 'student', getMyHalaqah: 'student',
  saveHalaqahSession: 'staff', deleteHalaqahSession: 'staff', getHalaqahQr: 'staff', getHalaqahRoster: 'staff', markHalaqah: 'staff',
  getMyNotifications: 'student', markNotificationRead: 'student', getPolicy: 'student', acknowledgePolicy: 'student',
  sendNotification: 'admin', listSentNotifications: 'admin', deleteNotification: 'admin', getPolicyAckSummary: 'staff',
  // แอดมินหลักเท่านั้น
  updateLogo: 'owner', batchSync: 'owner',
  init: 'owner', convertToThai: 'owner', organizeSheets: 'owner', organizeGoogleSheets: 'owner'
};

// คำสั่งที่เขียนข้อมูล (ล้างแคชเมื่อสำเร็จ)
const READ_ONLY_ACTIONS = ['ping', 'checkSpreadsheet', 'getSpreadsheetInfo', 'getStudent', 'getActivities',
  'getCalendarEvents', 'getCalendar', 'getSettings', 'whoami', 'getFullDatabase', 'getPrayers', 'getAttendance',
  'getHasanat', 'getSubjectGrades', 'getMyEvaluationStatus', 'getEvaluationTargets', 'getTeacherEvaluationSummary', 'getAssignmentScores', 'getStatusLogs', 'getActivityLogs', 'getPrayerApprovals', 'getAllStudents',
  'getSubAdmins', 'getTeachers', 'getPendingRegistrations', 'getAdmins', 'checkRegistrationStatus',
  'loginStudent', 'adminLogin', 'staffLogin'];

const INSPECTOR_EXTRA_ACTIONS = ['getFullDatabase', 'whoami', 'getMyNotifications', 'markNotificationRead'];
READ_ONLY_ACTIONS.push('getTimetable', 'getHalaqahSessions', 'getMyHalaqah', 'getHalaqahQr', 'getHalaqahRoster', 'getStudyFile', 'getMyDream', 'getDreams', 'getBehaviorData', 'getMyBehavior', 'listStudyDocs', 'getStudyDocsConfig', 'getMyNotifications', 'getPolicy', 'listSentNotifications', 'getPolicyAckSummary');

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
      if ((access === 'staff' && !isStaff) || (access === 'admin' && !isAdmin) || (access === 'owner' && !isOwner) || (access === 'inspector' && !isInspector && !isAdmin)) {
        return { success: false, forbidden: true, code: 'FORBIDDEN', message: 'บัญชีของท่านไม่มีสิทธิ์ใช้งานคำสั่งนี้' };
      }
    }

    stripMarkup_(req, 0);
    const data = (req.data && typeof req.data === 'object') ? req.data : req;
    if (data && data.token) delete data.token;

    const result = dispatchAction_(action, req, data, session, { isStaff: isStaff, isAdmin: isAdmin, isOwner: isOwner, method: method });
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
      const out = { success: true, status: 'online', version: SCHEMA_VERSION, dataVersion: getDataVersion_() };
      if (ctx.isAdmin) {
        const ss = getSpreadsheet();
        out.spreadsheetName = ss ? ss.getName() : 'none';
        out.sheets = ss ? ss.getSheets().map(function (s) { return s.getName(); }) : [];
      }
      return out;
    }
    case 'whoami':
      // ต่ออายุโทเค็นทุกครั้งที่แอปเปิด เพื่อให้อยู่ในระบบได้ต่อเนื่องจนกว่าจะออกจากระบบเอง
      return session ? { success: true, session: { role: session.role, userId: session.userId, name: session.name, owner: !!session.owner }, token: issueToken_(session.role, session.userId, session.name, !!session.owner) } : { success: false, authRequired: true, code: 'AUTH_REQUIRED' };

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
    case 'addBehaviorLogs':
      return addBehaviorLogs_(data, session);
    case 'cancelBehaviorLog':
      return cancelBehaviorLog_(pick('logId'), session, ctx.isAdmin);
    case 'getBehaviorData':
      return { success: true, rules: getBehaviorRules_(), logs: getBehaviorLogs_(), term: currentTerm_(),
        students: (getAllStudents().data || []).map(function (x) { return { studentId: x.studentId, fullName: x.fullName, grade: x.grade, status: x.status }; }) };
    case 'getMyBehavior': {
      const me = ownStudentId_(session, ctx, pick('studentId'));
      if (!me) return { success: false, message: 'ไม่พบรหัสนักเรียน' };
      return { success: true, term: currentTerm_(), rules: getBehaviorRules_(), logs: getBehaviorLogs_().filter(function (x) { return isCodeMatch(x.studentId, me); }) };
    }
    case 'getHalaqahSessions':
      return { success: true, sessions: halaqahSessions_(isStudent ? studentGradeNum_(session.userId).grade : '', !isStudent), today: hqToday_() };
    case 'saveHalaqahSession':
      return saveHalaqahSession_(data, session);
    case 'deleteHalaqahSession':
      return deleteHalaqahSession_(pick('id'));
    case 'getHalaqahQr':
      return getHalaqahQr_(pick('id'), pick('date'));
    case 'halaqahCheckIn':
      if (!isStudent) return { success: false, message: 'สแกนเข้าหะละเกาะฮฺได้เฉพาะบัญชีนักเรียน' };
      return halaqahCheckIn_(session, pick('qr'));
    case 'getMyHalaqah':
      return getMyHalaqah_(ownStudentId_(session, ctx, pick('studentId')));
    case 'getHalaqahRoster':
      return getHalaqahRoster_(pick('id'), pick('date'));
    case 'markHalaqah':
      return markHalaqah_(data, session);
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
      return saveBehaviorRules_(data.rules);
    case 'resetMyHasanat':
      if (!isStudent) return { success: false, message: 'สำหรับนักเรียนเท่านั้น' };
      return resetMyHasanat_(session.userId);
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
      if (isStudent) data.studentId = session.userId;
      return recordPrayer(data);
    case 'recordHasanat':
    case 'saveQuranLog':
    case 'saveSunnahLog':
    case 'saveSurahMemorizationLog':
    case 'saveSurahLog':
    case 'saveHasanatLog':
      if (isStudent) data.studentId = session.userId;
      return recordHasanat(data);
    case 'checkInActivity':
    case 'activityCheckIn':
      if (isStudent) data.studentId = session.userId;
      return checkInActivity(data);
    case 'updateProfilePhoto':
      return updateStudentProfilePhoto(ownStudentId_(session, ctx, pick('studentId')), pick('avatarUrl') || pick('profilePhoto') || pick('photo'));
    case 'prayerLateRequest':
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
    case 'updateStudentStatus':
      if (!data.adminUser) data.adminUser = session.name || session.userId;
      return updateStudentStatus(data);
    case 'deletePrayerRecord':
      return deletePrayerRecord(data);
    case 'updatePrayerRecord':
      return updatePrayerRecord_(data, session);
    case 'addPrayerForStudent':
      return addPrayerForStudent_(data, session);
    case 'savePrayerWindows':
      return savePrayerWindows_(data.windows);
    case 'getTimetable':
      return getTimetable_(session, isStudent, ctx.isAdmin);
    case 'saveTimetable':
      return saveTimetable_(data, session);
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
      return createActivity(data);
    case 'deleteActivity':
      return deleteActivity(pick('activityId') || pick('id'));
    case 'deleteActivityAttendee':
      return deleteActivityAttendee(data);
    case 'saveCalendarEvent':
      return saveCalendarEvent(data);
    case 'deleteCalendarEvent':
      return deleteCalendarEvent(data);
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
  const role = session.role;
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
  const sheet = ss.getSheetByName(SHEETS.TEACHERS);
  if (sheet && sheet.getLastRow() > 1) {
    const rows = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (cleanVal(rows[i][0]).toLowerCase() === target) {
        sheet.getRange(i + 2, 11).setValue(url);
        return { success: true, photoUrl: url, message: 'บันทึกรูปโปรไฟล์อาจารย์สำเร็จ' };
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
  if (val instanceof Date && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, "Asia/Bangkok", "HH:mm:ss");
  }
  const s = cleanVal(val);
  const match = s.match(/(\d{2}:\d{2}(?::\d{2})?)/);
  if (match) return match[1];
  return s;
}

function registerStudent(data) {
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

  return {
    studentId: sid,
    fullName: cleanVal(row[1]),
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
const TT_DEFAULT_PERIODS = [
  { start: '08:30', end: '09:20' }, { start: '09:20', end: '10:10' }, { start: '10:20', end: '11:10' }, { start: '11:10', end: '12:00' },
  { start: '13:00', end: '13:50' }, { start: '13:50', end: '14:40' }, { start: '14:50', end: '15:40' }, { start: '15:40', end: '16:30' }
];
function ttConfig_(settings) {
  let c = null; try { c = JSON.parse(settings.TimetableConfig || 'null'); } catch (e) {}
  c = c || {};
  return {
    periods: Array.isArray(c.periods) && c.periods.length ? c.periods : TT_DEFAULT_PERIODS,
    days: Array.isArray(c.days) && c.days.length ? c.days : [1, 2, 3, 4, 5],
    showStudents: c.showStudents !== false, showTeachers: c.showTeachers !== false,
    updatedAt: c.updatedAt || ''
  };
}
function getTimetable_(session, isStudent, isAdmin) {
  const st = (getSettings().data) || {};
  const cfg = ttConfig_(st);
  const grades = {};
  ['1', '2', '3', '4', '5', '6'].forEach(function (g) { let v = null; try { v = JSON.parse(st['Timetable_M' + g] || 'null'); } catch (e) {} if (v && v.cells) grades[g] = v; });
  if (isStudent) {
    const g = studentGradeNum_(session.userId).grade;
    if (!cfg.showStudents) return { success: true, hidden: true, config: cfg, grade: g, grades: {} };
    const one = {}; if (g && grades[g]) one[g] = grades[g];
    return { success: true, config: cfg, grade: g, grades: one };
  }
  if (!isAdmin && !cfg.showTeachers) return { success: true, hidden: true, config: cfg, grades: {} };
  return { success: true, config: cfg, grades: grades };
}
function saveTimetable_(data, session) {
  data = data || {};
  const g = String(cleanVal(data.grade)).replace(/\D/g, '');
  if (!/^[1-6]$/.test(g)) return { success: false, message: 'เลือกชั้นเรียน ม.1–ม.6' };
  const cells = {};
  const src = (data.cells && typeof data.cells === 'object') ? data.cells : {};
  Object.keys(src).forEach(function (k) {
    if (!/^[0-6]-([1-9]|1[0-2])$/.test(k)) return;
    const c = src[k] || {};
    const sn = cleanVal(c.subjectName || c.sn).slice(0, 80);
    if (!sn) return;
    cells[k] = { s: cleanVal(c.subjectId || c.s).slice(0, 40), sn: sn, t: cleanVal(c.teacher || c.t).slice(0, 60), tn: cleanVal(c.teacherName || c.tn).slice(0, 80), r: cleanVal(c.room || c.r).slice(0, 40) };
  });
  const value = { grade: g, cells: cells, updatedAt: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'), by: (session && (session.name || session.userId)) || '' };
  const json = JSON.stringify(value);
  if (json.length > 45000) return { success: false, message: 'ตารางยาวเกินไป ลองย่อชื่อวิชาหรือห้องเรียน' };
  saveSetting({ key: 'Timetable_M' + g, value: json, description: 'ตารางสอน ม.' + g + ' (JSON)' });
  return { success: true, message: 'บันทึกตารางสอน ม.' + g + ' แล้ว', timetable: value };
}
function saveTimetableConfig_(data) {
  data = data || {};
  const toMin = function (t) { const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/); return m && +m[1] < 24 && +m[2] < 60 ? (+m[1]) * 60 + (+m[2]) : NaN; };
  const cur = ttConfig_((getSettings().data) || {});
  let periods = cur.periods;
  if (Array.isArray(data.periods)) {
    if (!data.periods.length || data.periods.length > 12) return { success: false, message: 'จำนวนคาบต้องอยู่ระหว่าง 1–12 คาบ' };
    periods = [];
    for (let i = 0; i < data.periods.length; i++) {
      const p = data.periods[i] || {}; const a = toMin(p.start), b = toMin(p.end);
      if (isNaN(a) || isNaN(b) || b <= a) return { success: false, message: 'เวลาคาบที่ ' + (i + 1) + ' ไม่ถูกต้อง (เวลาจบต้องหลังเวลาเริ่ม)' };
      if (i && a < toMin(periods[i - 1].end)) return { success: false, message: 'คาบที่ ' + (i + 1) + ' เริ่มก่อนคาบที่ ' + i + ' จบ' };
      periods.push({ start: p.start, end: p.end });
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
        checkedBy: cleanVal(rows[i][10] || '')
      });
    }
  }
  return { success: true, data: results };
}

function createActivity(data) {
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

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (cleanVal(rows[i][0]) === actId) {
      sheet.getRange(i + 1, 2, 1, 6).setValues([[title, desc, startDate, endDate, location, createdBy]]);
      return { success: true, message: 'อัปเดตกิจกรรมเรียบร้อยแล้ว', activityId: actId, id: actId };
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
    0
  ]);

  return { success: true, message: 'ประกาศกิจกรรมใหม่เรียบร้อยแล้ว', activityId: actId, id: actId };
}

function deleteActivity(activityId) {
  ensureSchema();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ACTIVITIES);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานกิจกรรม' };
  const targetId = cleanVal(activityId);
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (cleanVal(rows[i][0]) === targetId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'ลบกิจกรรมเรียบร้อยแล้ว' };
    }
  }
  return { success: false, message: 'ไม่พบรหัสกิจกรรม' };
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
      attendeesCount: Number(rows[i][8]) || 0
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
  const rows = sheetLogs.getDataRange().getValues();

  for (let i = rows.length - 1; i >= 1; i--) {
    const rLogId = cleanVal(rows[i][0]);
    const rParsed = stripKhalifahQrPrefix(rows[i][2], rows[i][1]);
    const rSid = cleanVal(rows[i][3]);

    if ((targetLogId && rLogId === targetLogId) ||
        (targetActId && targetSid && rParsed.activityId === targetActId && isCodeMatch(rSid, targetSid))) {
      sheetLogs.deleteRow(i + 1);
      return { success: true, message: 'ลบรายชื่อผู้เข้าร่วมกิจกรรมเรียบร้อยแล้ว' };
    }
  }
  return { success: false, message: 'ไม่พบรายชื่อผู้เข้าร่วมที่ต้องการลบ' };
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
      const tokenRole = staffTokenRole_(roleVal);
      loginSucceeded_(rlKey);
      return {
        success: true,
        token: issueToken_(tokenRole, cleanVal(rows[i][1]), cleanVal(rows[i][3]), tokenRole === 'admin' && isOwnerRole_(roleVal)),
        isSubAdmin: tokenRole === 'admin' && !isOwnerRole_(roleVal),
        isOwner: tokenRole === 'admin' && isOwnerRole_(roleVal),
        role: roleVal,
        id: cleanVal(rows[i][0]),
        username: cleanVal(rows[i][1]),
        fullName: cleanVal(rows[i][3]),
        phone: normalizePhone(rows[i][kind === 'legacy' ? 7 : 5] || ''),
        email: cleanVal(rows[i][6] || ''),
        assignedSubjects: Array.isArray(assignedSubjects) ? assignedSubjects : [],
        avatarUrl: kind === 'teacher' ? cleanVal(rows[i][10] || '') : '',
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
  return {
    success: true,
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
  return { success: false, message: 'ไม่พบบัญชีที่ต้องการลบ' };
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
      note: cleanVal(rows[i][9] || '')
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

function deleteStudent(studentId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  const rows = sheet.getDataRange().getValues();

  for (let i = rows.length - 1; i >= 1; i--) {
    if (isCodeMatch(rows[i][0], studentId)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'ลบข้อมูลนักเรียนรหัส ' + cleanVal(studentId) + ' เรียบร้อยแล้ว' };
    }
  }
  return { success: false, message: 'ไม่พบรหัสนักเรียน' };
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
function recordHasanat(data) {
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
  const rows = sheet.getDataRange().getValues();

  for (let i = rows.length - 1; i >= 1; i--) {
    const rReqId = cleanVal(rows[i][0]);
    const rUserId = cleanVal(rows[i][2]);
    if ((targetReqId && rReqId === targetReqId) || (targetUserId && isCodeMatch(rUserId, targetUserId))) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'ลบคำขอสมัครออกจากฐานข้อมูลเรียบร้อยแล้ว' };
    }
  }
  return { success: false, message: 'ไม่พบคำขอสมัครที่ต้องการลบ' };
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
  if (email && email.indexOf('@') !== -1) {
    const senderName = 'KHALIFAH PROGRAM';
    const subject = 'แจ้งผลการอนุมัติบัญชีและรหัสยืนยันเข้าใช้งาน KHALIFAH PROGRAM (' + fullName + ')';
    const plainBody =
      'อัสสลามุอะลัยกุม คุณ ' + fullName + '\n\n' +
      'KHALIFAH PROGRAM ได้ตรวจสอบและกดยินยอมรับรองการสมัครบัญชี ' + roleLabel + ' (รหัสประจำตัว: ' + userId + ') ของคุณเรียบร้อยแล้ว\n\n' +
      'รหัสยืนยัน 6 หลักของคุณคือ: ' + otpCode + '\n\n' +
      'กรุณานำรหัสยืนยัน 6 หลักนี้ไปกรอกในหน้าต่างยืนยันรหัสบนเว็บไซต์ https://khalifah-program.vercel.app เพื่อเข้าใช้งานระบบได้ทันที\n\n' +
      'ขอแสดงความนับถือ\n' +
      'KHALIFAH PROGRAM';

    const htmlBody =
      '<div style="font-family: Sarabun, Tahoma, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px 24px; border: 1px solid #e2e8f0; border-radius: 12px; color: #0f172a; background-color: #ffffff; line-height: 1.6;">' +
      '<div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; margin-bottom: 18px;">' +
      '<strong style="font-size: 18px; color: #0f172a; letter-spacing: 0.3px;">KHALIFAH PROGRAM</strong>' +
      '<div style="font-size: 12px; color: #64748b;">แจ้งผลการอนุมัติบัญชีผู้ใช้งานและรหัสยืนยันตัวตน</div>' +
      '</div>' +
      '<p style="font-size: 15px; color: #1e293b; margin: 0 0 12px 0;">อัสสลามุอะลัยกุม คุณ <strong>' + fullName + '</strong></p>' +
      '<p style="font-size: 14px; color: #334155; margin: 0 0 18px 0;">ผู้ดูแลระบบได้ตรวจสอบข้อมูลและกดยินยอมรับรองการสมัครบัญชี <strong>' + roleLabel + '</strong> (รหัสประจำตัว: <strong>' + userId + '</strong>) ของท่านเรียบร้อยแล้ว</p>' +
      '<div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px; text-align: center; margin: 20px 0;">' +
      '<div style="font-size: 13px; color: #475569; margin-bottom: 6px;">รหัสยืนยันสำหรับเข้าใช้งานระบบ (6 หลัก)</div>' +
      '<div style="font-size: 30px; font-weight: 700; letter-spacing: 6px; color: #0f172a; font-family: Consolas, monospace;">' + otpCode + '</div>' +
      '</div>' +
      '<p style="font-size: 13.5px; color: #475569; margin: 0 0 18px 0;">ท่านสามารถนำรหัสยืนยัน 6 หลักด้านบนไปกรอกในหน้าต่างยืนยันรหัสบนเว็บไซต์ เพื่อเข้าใช้งานระบบได้ทันที</p>' +
      '<div style="border-top: 1px solid #f1f5f9; padding-top: 14px; margin-top: 20px; font-size: 12px; color: #64748b;">' +
      'ขอแสดงความนับถือ<br><strong>KHALIFAH PROGRAM</strong>' +
      '</div>' +
      '</div>';

    try {
      GmailApp.sendEmail(email, subject, plainBody, {
        htmlBody: htmlBody,
        name: senderName
      });
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
        emailError = mailErr.toString();
      }
    }
  }

  return {
    success: true,
    emailSent: emailSent,
    emailError: emailError,
    otpCode: otpCode,
    message: emailSent
      ? 'อนุมัติและส่งรหัสยืนยัน (' + otpCode + ') ไปยังอีเมล ' + email + ' เรียบร้อยแล้ว'
      : 'อนุมัติเรียบร้อยแล้ว แต่ส่งอีเมลไม่สำเร็จ: ' + emailError
  };
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
  return registerStudent(student);
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
  const teacherNote = 'เช็คชื่อโดยอาจารย์ (' + cleanVal(data.teacherId || 'admin') + ')';
  const subjCode = cleanVal(data.subjectCode || '');
  const subjName = cleanVal(data.subjectName || '');
  const checkedBy = cleanVal(data.teacherName || data.teacherId || '');
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
    let foundAttRow = -1;
    for (let i = existingAttRows.length - 1; i >= 1; i--) {
      if (isCodeMatch(existingAttRows[i][1], cleanSid) && formatSheetDate(existingAttRows[i][4]) === dateStr && cleanVal(existingAttRows[i][8] || '') === subjCode) {
        foundAttRow = i + 1;
        break;
      }
    }

    if (foundAttRow !== -1) {
      sheet.getRange(foundAttRow, 3, 1, 9).setValues([[
        sName, sGrade, dateStr, timeStr, statusThai, teacherNote, subjCode, subjName, checkedBy
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
        checkedBy
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

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (cleanVal(rows[i][0]) === key) {
      sheet.getRange(i + 1, 2).setNumberFormat('@').setValue(val);
      if (data.description) sheet.getRange(i + 1, 3).setValue(desc);
      return { success: true, message: 'อัปเดตการตั้งค่า ' + key + ' สำเร็จ' };
    }
  }
  sheet.appendRow([key, val, desc]);
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 2).setNumberFormat('@').setValue(val);
  return { success: true, message: 'บันทึกการตั้งค่า ' + key + ' สำเร็จ' };
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

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'ระบบกำลังมีผู้ใช้งานพร้อมกันจำนวนมาก' };
  }

  try {
    const rows = sheet.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (cleanVal(rows[i][0]) === eventId) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { success: true, message: 'ลบกิจกรรมออกจากปฏิทินเรียบร้อยแล้ว', id: eventId };
      }
    }
    return { success: false, message: 'ไม่พบกิจกรรมรหัส ' + eventId + ' ในฐานข้อมูล' };
  } catch (err) {
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบกิจกรรม: ' + err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
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
      adminNote: cleanVal(row[14]) || ''
    });
  }
  return { success: true, status: 'success', data: list };
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
    const photoUrl = cleanVal(data.photoUrl || '');
    const status = cleanVal(data.status || 'pending');
    const submittedAt = data.submittedAtFormatted || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
    const approvedBy = cleanVal(data.approvedBy || '');
    const approvedAt = cleanVal(data.approvedAt || '');
    const adminNote = cleanVal(data.adminNote || '');

    const rows = sheet.getDataRange().getValues();
    let updated = false;
    for (let i = 1; i < rows.length; i++) {
      if (cleanVal(rows[i][0]) === id) {
        sheet.getRange(i + 1, 2, 1, 14).setValues([[
          studentId, studentName, grade, parentPhone, prayerSlot, date,
          reasonPreset, reasonDetail, photoUrl, status, submittedAt, approvedBy, approvedAt, adminNote
        ]]);
        updated = true;
        break;
      }
    }

    if (!updated) {
      sheet.appendRow([
        id, studentId, studentName, grade, parentPhone, prayerSlot, date,
        reasonPreset, reasonDetail, photoUrl, status, submittedAt, approvedBy, approvedAt, adminNote
      ]);
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 1).setNumberFormat('@');
      sheet.getRange(lastRow, 2).setNumberFormat('@');
      sheet.getRange(lastRow, 5).setNumberFormat('@');
      sheet.getRange(lastRow, 7).setNumberFormat('@');
    }

    return { success: true, message: 'บันทึกคำขออนุมัติเรียบร้อย', id: id };
  } catch (err) {
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * อัปเดตสถานะคำขออนุมัติละหมาดใน Google Sheets
 */
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
  return { success: true, term: currentTerm_(), items: EVAL_ITEMS, data: out };
}
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
const BEHAVIOR_CATS = ['dress', 'dorm', 'toilet', 'conduct', 'good'];
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
    if (raw) { const list = sanitizeBehaviorRules_(JSON.parse(raw)); if (list.length) return list; }
  } catch (e) {}
  return DEFAULT_BEHAVIOR_RULES.slice();
}
function saveBehaviorRules_(rules) {
  const clean = sanitizeBehaviorRules_(rules);
  if (!clean.length) return { success: false, message: 'ต้องมีหัวข้ออย่างน้อย 1 ข้อ' };
  saveSetting({ key: 'BehaviorRules', value: JSON.stringify(clean), description: 'หัวข้อและคะแนนพฤติกรรม (JSON)' });
  return { success: true, rules: clean, message: 'บันทึกหัวข้อคะแนนพฤติกรรมแล้ว' };
}
function getBehaviorLogs_() {
  const sh = getSpreadsheet().getSheetByName(SHEETS.BEHAVIOR);
  if (!sh || sh.getLastRow() < 2) return [];
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, HEADERS.BEHAVIOR.length).getValues();
  return rows.filter(function (r) { return cleanVal(r[0]); }).map(function (r) {
    return {
      id: cleanVal(r[0]), date: normalizeDateStr_(r[1]), time: cleanVal(r[2]), term: cleanVal(r[3]), studentId: cleanVal(r[4]), studentName: cleanVal(r[5]),
      grade: cleanVal(r[6]), cat: cleanVal(r[7]), ruleId: cleanVal(r[8]), title: cleanVal(r[9]), points: Number(r[10]) || 0, note: cleanVal(r[11]),
      by: cleanVal(r[12]), byName: cleanVal(r[13]), status: cleanVal(r[14]) || 'active', cancelledBy: cleanVal(r[15])
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
    rule = { id: 'custom', cat: pts > 0 ? 'good' : 'conduct', title: title, points: pts };
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(cleanVal(data.date)) ? cleanVal(data.date) : Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  if (date > today) return { success: false, message: 'บันทึกล่วงหน้าไม่ได้' };
  const note = cleanVal(data.note).substring(0, 300);
  ensureSchema();
  const ss = getSpreadsheet();
  const sh = ss.getSheetByName(SHEETS.BEHAVIOR);
  const stuSheet = ss.getSheetByName(SHEETS.STUDENTS);
  const info = {};
  if (stuSheet && stuSheet.getLastRow() > 1) stuSheet.getRange(2, 1, stuSheet.getLastRow() - 1, 4).getValues().forEach(function (r) { info[cleanVal(r[0]).replace(/^0+/, '')] = { id: cleanVal(r[0]), name: cleanVal(r[1]), grade: cleanVal(r[3]) }; });
  const now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  const term = currentTerm_();
  const rows = []; const missing = [];
  ids.forEach(function (sid, i) {
    const st = info[sid.replace(/^0+/, '')];
    if (!st) { missing.push(sid); return; }
    rows.push(['BHV-' + Date.now() + '-' + i, date, now, term, st.id, st.name, st.grade, rule.cat, rule.id, rule.title, rule.points, note, session.userId, session.name || session.userId, 'active', '']);
  });
  if (!rows.length) return { success: false, message: 'ไม่พบรหัสนักเรียนที่เลือก' };
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) {}
  try { sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows); } finally { try { lock.releaseLock(); } catch (e) {} }
  return { success: true, added: rows.length, missing: missing, points: rule.points, logs: rows.map(function (r) { return { id: r[0], date: r[1], time: r[2], term: r[3], studentId: r[4], studentName: r[5], grade: r[6], cat: r[7], ruleId: r[8], title: r[9], points: r[10], note: r[11], by: r[12], byName: r[13], status: 'active' }; }),
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
  return type === 'staff' || type === 'everyone';
}
function readNotifs_() {
  return sheetRows_(SHEETS.NOTIFS, HEADERS.NOTIFS.length).filter(function (r) { return cleanVal(r[0]); }).map(function (r) {
    return { id: cleanVal(r[0]), createdAt: cleanVal(r[1]), title: cleanVal(r[2]), body: cleanVal(r[3]), audience: cleanVal(r[4]), audienceValue: cleanVal(r[5]), priority: cleanVal(r[6]) || 'normal', by: cleanVal(r[7]), byName: cleanVal(r[8]), status: cleanVal(r[9]) || 'active', expires: cleanVal(r[10]) };
  });
}
function getMyNotifications_(session) {
  ensureSchema();
  const g = session.role === 'student' ? studentGradeNum_(session.userId).grade : '';
  const key = userKey_(session);
  const reads = {};
  sheetRows_(SHEETS.NOTIF_READS, 4).forEach(function (r) { if (cleanVal(r[1]) === key) reads[cleanVal(r[0])] = { at: cleanVal(r[2]), hidden: cleanVal(r[3]) === '1' }; });
  const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const list = readNotifs_().filter(function (n) { return n.status === 'active' && (!n.expires || n.expires >= today) && notifMatches_(n, session, g); })
    .map(function (n) { const rd = reads[n.id] || {}; return { id: n.id, createdAt: n.createdAt, title: n.title, body: n.body, priority: n.priority, byName: n.byName, read: !!rd.at, hidden: !!rd.hidden }; })
    .filter(function (n) { return !n.hidden; })
    .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 100);
  const pending = [];
  if (session.role === 'student') {
    const acks = myPolicyAcks_(session.userId);
    REQUIRED_POLICY_IDS.forEach(function (pid) { const p = POLICIES[pid]; if (p && !acks[pid + '|' + p.version]) pending.push({ id: pid, version: p.version, title: p.title, subtitle: p.subtitle }); });
  }
  return { success: true, notifications: list, pendingPolicies: pending, unread: list.filter(function (n) { return !n.read; }).length + pending.length };
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
  const aud = ['all', 'grade', 'students', 'staff', 'everyone'].indexOf(cleanVal(data.audience)) !== -1 ? cleanVal(data.audience) : 'all';
  let vals = (Array.isArray(data.values) ? data.values : String(data.values || '').split(',')).map(cleanVal).filter(Boolean);
  if (aud === 'grade') { vals = vals.map(function (v) { return String(v).replace(/\D/g, ''); }).filter(function (v) { return /^[1-6]$/.test(v); }); if (!vals.length) return { success: false, message: 'กรุณาเลือกชั้นปีอย่างน้อย 1 ชั้น' }; }
  if (aud === 'students' && !vals.length) return { success: false, message: 'กรุณาเลือกนักเรียนอย่างน้อย 1 คน' };
  const priority = data.priority === 'urgent' ? 'urgent' : 'normal';
  const expires = /^\d{4}-\d{2}-\d{2}$/.test(cleanVal(data.expires)) ? cleanVal(data.expires) : '';
  ensureSchema();
  const id = 'NTF-' + Date.now();
  const row = [id, Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'), title, body, aud, vals.slice(0, 500).join(','), priority, session.userId, session.name || session.userId, 'active', expires];
  getSpreadsheet().getSheetByName(SHEETS.NOTIFS).appendRow(row);
  return { success: true, id: id, message: 'ส่งแจ้งเตือนแล้ว' };
}
function listSentNotifications_() {
  const reads = {};
  sheetRows_(SHEETS.NOTIF_READS, 4).forEach(function (r) { const id = cleanVal(r[0]); reads[id] = (reads[id] || 0) + 1; });
  const students = sheetRows_(SHEETS.STUDENTS, 8).filter(function (r) { return cleanVal(r[0]) && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(r[7])); });
  const count = function (n) {
    const vals = String(n.audienceValue || '').split(',').filter(Boolean);
    if (n.audience === 'all' || n.audience === 'everyone') return students.length;
    if (n.audience === 'grade') return students.filter(function (r) { const m = String(r[3]).match(/([1-6])/); return m && vals.indexOf(m[1]) !== -1; }).length;
    if (n.audience === 'students') return vals.length;
    return 0;
  };
  const list = readNotifs_().filter(function (n) { return n.status === 'active'; }).map(function (n) { return Object.assign(n, { reads: reads[n.id] || 0, recipients: count(n) }); })
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
function readHalaqah_() {
  return sheetRows_(SHEETS.HALAQAH, HEADERS.HALAQAH.length).filter(function (r) { return cleanVal(r[0]) && cleanVal(r[10]) !== 'deleted'; }).map(function (r) {
    return { id: cleanVal(r[0]), name: cleanVal(r[1]), slot: cleanVal(r[2]) || 'other', days: String(r[3] === '' ? '0,1,2,3,4,5,6' : r[3]).split(',').map(function (x) { return cleanVal(x); }).filter(function (x) { return /^[0-6]$/.test(x); }),
      start: hqTime_(r[4]), end: hqTime_(r[5]), grades: String(r[6] || '').split(',').map(function (x) { return cleanVal(x); }).filter(function (x) { return /^[1-6]$/.test(x); }),
      teacher: cleanVal(r[7]), teacherName: cleanVal(r[8]), location: cleanVal(r[9]), createdAt: normalizeDateStr_(r[11]) };
  });
}
function halaqahSessions_(grade, all) { return readHalaqah_().filter(function (h) { return all || !h.grades.length || h.grades.indexOf(grade) !== -1; }); }
function saveHalaqahSession_(d, session) {
  d = d || {};
  const name = cleanVal(d.name).substring(0, 80) || HQ_SLOTS[cleanVal(d.slot)] && ('หะละเกาะฮฺ' + HQ_SLOTS[cleanVal(d.slot)]);
  if (!name) return { success: false, message: 'กรุณาตั้งชื่อหะละเกาะฮฺ' };
  const start = hqTime_(d.start), end = hqTime_(d.end);
  if (!start || !end || hqMin_(end) <= hqMin_(start)) return { success: false, message: 'กรุณาระบุเวลาเริ่มและสิ้นสุดให้ถูกต้อง' };
  const days = (Array.isArray(d.days) ? d.days : String(d.days || '').split(',')).map(String).filter(function (x) { return /^[0-6]$/.test(x); });
  if (!days.length) return { success: false, message: 'เลือกวันอย่างน้อย 1 วัน' };
  const grades = (Array.isArray(d.grades) ? d.grades : String(d.grades || '').split(',')).map(String).filter(function (x) { return /^[1-6]$/.test(x); });
  const slot = HQ_SLOTS[cleanVal(d.slot)] ? cleanVal(d.slot) : 'other';
  ensureSchema();
  const sh = getSpreadsheet().getSheetByName(SHEETS.HALAQAH);
  const id = cleanVal(d.id) || ('HLQ-' + Date.now());
  const row = [id, name, slot, days.join(','), start, end, grades.join(','), cleanVal(d.teacher) || session.userId, cleanVal(d.teacherName) || session.name || session.userId, cleanVal(d.location).substring(0, 80), 'active', Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss')];
  const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [];
  for (let i = 0; i < rows.length; i++) if (cleanVal(rows[i][0]) === id) { sh.getRange(i + 2, 1, 1, row.length).setValues([row]); return { success: true, id: id, message: 'บันทึกหะละเกาะฮฺแล้ว' }; }
  sh.appendRow(row);
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
  if (h.grades.length && h.grades.indexOf(st.grade) === -1) return { success: false, message: 'หะละเกาะฮฺนี้สำหรับชั้น ' + h.grades.map(function (g) { return 'ม.' + g; }).join(', ') + ' เท่านั้น' };
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
  const sessions = halaqahSessions_(st.grade, false);
  const logs = hqLogs_().filter(function (l) { return isCodeMatch(l.studentId, sid); }).sort(function (a, b) { return (b.date + b.time).localeCompare(a.date + a.time); });
  return { success: true, sessions: sessions, logs: logs.slice(0, 400), today: hqToday_(), nowMin: hqNowMin_() };
}
function getHalaqahRoster_(id, date) {
  const h = readHalaqah_().filter(function (x) { return x.id === cleanVal(id); })[0];
  if (!h) return { success: false, message: 'ไม่พบหะละเกาะฮฺ' };
  date = /^\d{4}-\d{2}-\d{2}$/.test(cleanVal(date)) ? cleanVal(date) : hqToday_();
  const logs = {}; hqLogs_().forEach(function (l) { if (l.sessionId === h.id && l.date === date) logs[cleanVal(l.studentId).replace(/^0+/, '')] = l; });
  const students = sheetRows_(SHEETS.STUDENTS, 8).filter(function (r) { if (!cleanVal(r[0]) || /ลาออก|สำเร็จ|พ้นสภาพ/.test(String(r[7]))) return false; const m = String(r[3]).match(/([1-6])/); return !h.grades.length || (m && h.grades.indexOf(m[1]) !== -1); })
    .map(function (r) { const k = cleanVal(r[0]).replace(/^0+/, ''); const l = logs[k]; return { studentId: cleanVal(r[0]), fullName: cleanVal(r[1]), grade: cleanVal(r[3]), status: l ? l.status : '', time: l ? l.time : '', method: l ? l.method : '' }; });
  return { success: true, session: h, date: date, students: students };
}
function markHalaqah_(d, session) {
  const h = readHalaqah_().filter(function (x) { return x.id === cleanVal(d && d.id); })[0];
  if (!h) return { success: false, message: 'ไม่พบหะละเกาะฮฺ' };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(cleanVal(d.date)) ? cleanVal(d.date) : hqToday_();
  if (date > hqToday_()) return { success: false, message: 'บันทึกล่วงหน้าไม่ได้' };
  ensureSchema();
  const info = {}; sheetRows_(SHEETS.STUDENTS, 4).forEach(function (r) { if (cleanVal(r[0])) info[cleanVal(r[0]).replace(/^0+/, '')] = { id: cleanVal(r[0]), name: cleanVal(r[1]), gradeText: cleanVal(r[3]) }; });
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
      const k = cleanVal(sid).replace(/^0+/, ''); const st = info[k];
      if (!status || !st) return;
      if (at[k] !== undefined) sh.getRange(at[k] + 2, 9, 1, 3).setValues([['teacher', by, status]]);
      else add.push(['HLL-' + Date.now() + '-' + add.length, h.id, h.name, date, now, st.id, st.name, st.gradeText, 'teacher', by, status, '']);
      n++;
    });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, add[0].length).setValues(add);
    return { success: true, saved: n, message: 'บันทึกการเข้าหะละเกาะฮฺ ' + n + ' คนแล้ว' };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
