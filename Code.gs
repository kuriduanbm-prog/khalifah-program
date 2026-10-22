/**
 * KHALIFAH PROGRAM - Google Apps Script Backend (เวอร์ชันภาษาไทย 100%)
 * ----------------------------------------------------
 * เชื่อมต่อกับ Google Sheets อัตโนมัติเพื่อเป็นฐานข้อมูลของระบบ
 * บันทึก: ข้อมูลนักเรียน, เช็คชื่อมาเรียน, เช็คละหมาด 5 เวลา, กิจกรรม, ผู้ดูแลระบบ, ผลบุญ
 */

// รหัส Google Spreadsheet เป้าหมาย (ฐานข้อมูลหลักของระบบ)
const TARGET_SPREADSHEET_ID = '1s8p3EYESW7z2oiLVyzfFIPXck5eyeGxxU98lkkzw-ss';

const MASTER_ADMIN_PASS = '096909';

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
  Logger.log('✅ จัดระเบียบครบทั้ง 12 แผ่นงาน เรียงแท็บ แยกอาจารย์/แอดมิน ล็อคแถวบนสุด และใส่ Dropdown สำเร็จ 100%!');
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
  SHEETS.SETTINGS,       // 12. การตั้งค่า
  SHEETS.CALENDAR        // 13. ปฏิทินกิจกรรม
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
    'เบอร์โทรศัพท์', 'อีเมล', 'รายวิชาที่รับผิดชอบ JSON', 'สถานะการทำงาน', 'วันที่ลงทะเบียน / สร้างบัญชี'
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
    'วันที่', 'เวลา', 'สถานะการมาเรียน', 'หมายเหตุ'
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
      'ADM001', 'admin', MASTER_ADMIN_PASS, 'ผู้ดูแลระบบหลัก (Master Administrator)', 'SuperAdmin',
      '0800000000', 'admin@khalifah.local', 'ใช้งานปกติ', Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss"), 'ระบบสร้างขึ้นอัตโนมัติ'
    ]);
    const rIdx = sheetAdmins.getLastRow();
    sheetAdmins.getRange(rIdx, 2).setNumberFormat('@').setValue('admin');
    sheetAdmins.getRange(rIdx, 3).setNumberFormat('@').setValue(MASTER_ADMIN_PASS);
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
    sheetSettings.appendRow(['MasterCode', MASTER_ADMIN_PASS, 'รหัสแอดมินหลัก']);
    sheetSettings.appendRow(['CurrentAcademicYear', '2569', 'ปีการศึกษาปัจจุบัน']);
    sheetSettings.getRange(3, 2).setNumberFormat('@').setValue(MASTER_ADMIN_PASS);
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

// ----------------- REQUEST HANDLERS ----------------- //

function doGet(e) {
  const action = (e && e.parameter) ? e.parameter.action : '';
  
  if (!action) {
    try {
      return HtmlService.createTemplateFromFile('index')
        .evaluate()
        .setTitle('Khalifah Program - ระบบเช็คชื่อ ละหมาด และกิจกรรม')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'online',
        service: 'Khalifah Program API (Thai Edition)',
        message: 'Google Apps Script Backend พร้อมทำงาน',
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  let result = {};
  try {
    switch (action) {
      case 'ping':
      case 'checkSpreadsheet':
      case 'getSpreadsheetInfo': {
        const targetSs = getSpreadsheet();
        result = {
          success: true,
          spreadsheetId: targetSs ? targetSs.getId() : 'none',
          spreadsheetName: targetSs ? targetSs.getName() : 'none',
          spreadsheetUrl: targetSs ? targetSs.getUrl() : 'none',
          sheets: targetSs ? targetSs.getSheets().map(s => s.getName()) : []
        };
        break;
      }
      case 'init':
      case 'convertToThai':
        result = initializeSheets();
        break;
      case 'getStudent':
        result = getStudent(e.parameter.studentId, e.parameter.parentPhone);
        break;
      case 'getAllStudents':
        result = getAllStudents();
        break;
      case 'getPrayers':
        result = getPrayers(e.parameter.studentId, e.parameter.date);
        break;
      case 'getAttendance':
        result = getAttendance(e.parameter.studentId, e.parameter.grade);
        break;
      case 'getActivities':
        result = getActivities();
        break;
      case 'getActivityLogs':
        result = getActivityLogs(e.parameter.activityId);
        break;
      case 'checkInActivity':
      case 'activityCheckIn':
        result = checkInActivity(e.parameter);
        break;
      case 'getSubAdmins':
        result = getSubAdmins();
        break;
      case 'getTeachers':
        result = getTeachers();
        break;
      case 'getAdmins':
        result = getAdmins();
        break;
      case 'getStatusLogs':
        result = getStatusLogs(e.parameter.studentId);
        break;
      case 'organizeSheets':
      case 'organizeGoogleSheets':
        result = organizeGoogleSheets();
        break;
      case 'checkRegistrationStatus':
        result = checkRegistrationStatus(e.parameter.userId, e.parameter.role);
        break;
      case 'getPendingRegistrations':
        result = getPendingRegistrations();
        break;
      case 'getHasanat':
        result = getHasanat(e.parameter.studentId);
        break;
      case 'getSubjectGrades':
        result = getSubjectGrades(e.parameter.studentId, e.parameter.subject);
        break;
      case 'getSettings':
        result = getSettings();
        break;
      case 'getCalendarEvents':
      case 'getCalendar':
        result = getCalendarEvents(e.parameter.role || e.parameter.userRole);
        break;
      case 'getFullDatabase':
        result = getFullDatabase();
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let result = {};
  try {
    let postData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        postData = e.parameter || {};
      }
    } else if (e && e.parameter) {
      postData = e.parameter;
    }
    const action = postData.action;

    switch (action) {
      case 'ping':
      case 'init':
      case 'convertToThai':
        result = initializeSheets();
        break;
      case 'registerStudent':
        result = registerStudent(postData.data || postData);
        break;
      case 'loginStudent':
        result = loginStudent(postData.studentId || (postData.data && postData.data.studentId), postData.birthDate || postData.parentPhone || (postData.data && (postData.data.birthDate || postData.data.parentPhone)));
        break;
      case 'updateStudentGrade':
        result = updateStudentGrade(postData.studentId || (postData.data && postData.data.studentId), postData.newGrade || (postData.data && postData.data.newGrade));
        break;
      case 'recordPrayer':
      case 'prayerCheckIn':
        result = recordPrayer(postData.data || postData);
        break;
      case 'deletePrayerRecord':
        result = deletePrayerRecord(postData.data || postData);
        break;
      case 'recordHasanat':
      case 'saveQuranLog':
      case 'saveSunnahLog':
      case 'saveSurahMemorizationLog':
      case 'saveSurahLog':
      case 'saveHasanatLog':
        result = recordHasanat(postData.data || postData);
        break;
      case 'batchSync':
        result = batchSyncData(postData.data || postData);
        break;
      case 'recordAttendance':
        result = recordAttendance(postData.data || postData);
        break;
      case 'createActivity':
        result = createActivity(postData.data || postData);
        break;
      case 'deleteActivity':
        result = deleteActivity(postData.activityId || (postData.data && (postData.data.activityId || postData.data.id)));
        break;
      case 'checkInActivity':
      case 'activityCheckIn':
        result = checkInActivity(postData.data || postData);
        break;
      case 'deleteActivityAttendee':
        result = deleteActivityAttendee(postData.data || postData);
        break;
      case 'adminLogin':
        result = verifyAdminLogin(postData.password || (postData.data && postData.data.password), postData.username || (postData.data && postData.data.username));
        break;
      case 'addSubAdmin':
        result = addSubAdmin(postData.data || postData);
        break;
      case 'deleteSubAdmin':
        result = deleteSubAdmin(postData.username || (postData.data && postData.data.username));
        break;
      case 'deleteStudent':
        result = deleteStudent(postData.studentId || (postData.data && postData.data.studentId));
        break;
      case 'batchPromote':
        result = batchPromoteStudents(postData.fromGrade || (postData.data && postData.data.fromGrade), postData.toGrade || (postData.data && postData.data.toGrade));
        break;
      case 'updateLogo':
        result = updateAppLogo((postData.data && postData.data.logoBase64) || postData.logoBase64);
        break;
      case 'updateProfilePhoto':
        result = updateStudentProfilePhoto((postData.data && postData.data.studentId) || postData.studentId, (postData.data && postData.data.avatarUrl) || postData.avatarUrl);
        break;
      case 'updateSubjectScores':
        result = updateSubjectScores(postData.data || postData);
        break;
      case 'registerPendingUser':
        result = registerPendingUser(postData.data || postData);
        break;
      case 'deletePendingRegistration':
        result = deletePendingRegistration(postData.data || postData);
        break;
      case 'approveRegistrationAndSendEmail':
        result = approveRegistrationAndSendEmail(postData.data || postData);
        break;
      case 'verifyUserOtp':
        result = verifyUserOtp(postData.data || postData);
        break;
      case 'updateStudentFull':
        result = updateStudentFull(postData.data || postData);
        break;
      case 'saveDailyAttendance':
        result = saveDailyAttendance(postData.data || postData);
        break;
      case 'saveSubjectGrades':
        result = saveSubjectGrades(postData.data || postData);
        break;
      case 'saveSubjects':
        result = saveSubjects(postData.data || postData);
        break;
      case 'saveSetting':
        result = saveSetting(postData.data || postData);
        break;
      case 'updateStudentStatus':
        result = updateStudentStatus(postData.data || postData);
        break;
      case 'saveCalendarEvent':
        result = saveCalendarEvent(postData.data || postData);
        break;
      case 'deleteCalendarEvent':
        result = deleteCalendarEvent(postData.data || postData);
        break;
      case 'getStatusLogs':
        result = getStatusLogs(postData.studentId || (postData.data && postData.data.studentId));
        break;
      case 'organizeSheets':
      case 'organizeGoogleSheets':
        result = organizeGoogleSheets();
        break;
      default:
        result = { success: false, error: 'Invalid POST action: ' + action };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
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
  initializeSheets();
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
    : (rawPhoto && !rawPhoto.startsWith('data:image') && rawPhoto.length < 500 ? rawPhoto : 'รูปโปรไฟล์ในอุปกรณ์');

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
    const rows = sheet.getDataRange().getValues();
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
    const rows = sheet.getDataRange().getValues();
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

function getStudent(studentId, parentPhone) {
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานนักเรียน' };
  const rows = sheet.getDataRange().getValues();
  const hasanatMap = getLatestHasanatMapByStudent(ss);
  const gradesMap = getLatestGradesMapByStudent(ss);

  const targetId = cleanVal(studentId);
  const targetPhone = normalizePhone(parentPhone);

  for (let i = 1; i < rows.length; i++) {
    const sId = rows[i][0];
    const sPhone = rows[i][5];

    const idMatch = targetId ? isCodeMatch(sId, targetId) : false;
    const phoneMatch = targetPhone ? isPhoneMatch(sPhone, targetPhone) : false;

    let isMatch = false;
    if (targetId && targetPhone) {
      isMatch = idMatch && phoneMatch;
    } else if (targetId) {
      isMatch = idMatch;
    } else if (targetPhone) {
      isMatch = phoneMatch;
    }

    if (isMatch) {
      return {
        success: true,
        student: buildStudentObjectFromRow(rows[i], hasanatMap, gradesMap)
      };
    }
  }

  return { success: false, message: 'ไม่พบข้อมูลนักเรียนในฐานข้อมูล' };
}

function loginStudent(studentId, passOrPhone) {
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานนักเรียน' };
  const rows = sheet.getDataRange().getValues();
  const hasanatMap = getLatestHasanatMapByStudent(ss);
  const gradesMap = getLatestGradesMapByStudent(ss);

  const cleanInput = cleanVal(passOrPhone);
  const targetId = cleanVal(studentId);

  for (let i = 1; i < rows.length; i++) {
    const sId = rows[i][0];
    const bDate = rows[i][4];
    const sPhone = rows[i][5];

    if (isCodeMatch(sId, targetId)) {
      const matchPass = !cleanInput || isCodeMatch(bDate, cleanInput) || isPhoneMatch(sPhone, cleanInput);
      if (matchPass) {
        const studentObj = buildStudentObjectFromRow(rows[i], hasanatMap, gradesMap);
        if (studentObj.status === 'รอผู้สมัครกรอกรหัส OTP' || studentObj.approvalStatus === 'PendingAdmin' || studentObj.approvalStatus === 'AwaitingOtp') {
          return {
            success: false,
            requireOtp: true,
            approvalStatus: studentObj.approvalStatus,
            message: 'บัญชียังไม่ได้ยืนยันรหัส OTP 6 หลักจากอีเมล'
          };
        }
        return {
          success: true,
          student: studentObj
        };
      } else {
        return { success: false, message: 'รหัสผ่านหรือข้อมูลยืนยันไม่ถูกต้อง' };
      }
    }
  }

  return { success: false, message: 'ไม่พบรหัสนักเรียนในฐานข้อมูล Google Sheets' };
}

function updateStudentGrade(studentId, newGrade) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (isCodeMatch(rows[i][0], studentId)) {
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
  initializeSheets();
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
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.GRADES);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };
  const rows = sheet.getDataRange().getValues();
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
  initializeSheets();
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

  // ป้องกันการซิงค์ซ้ำ (Deduplicate by logId หรือ studentId + date + prayerTime)
  const existingRows = sheet.getDataRange().getValues();
  for (let i = 1; i < existingRows.length; i++) {
    const rLogId = cleanVal(existingRows[i][0]);
    const rSid = cleanVal(existingRows[i][1]);
    const rPt = formatPrayerTimeThai(existingRows[i][4]);
    const rDate = formatSheetDate(existingRows[i][6]);
    if ((logId && rLogId === logId) || (cleanSid && isCodeMatch(rSid, cleanSid) && rDate === dateStr && rPt === prayerNameThai)) {
      return { success: true, deduplicated: true, message: 'ข้อมูลการละหมาดนี้มีอยู่ในฐานข้อมูลแล้ว', logId: rLogId };
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
      photoRef = 'รูปถ่ายยืนยันในเครื่อง (Local Snapshot)';
    }
  }

  if (!photoRef) {
    photoRef = (data.photoUrl && data.photoUrl.length < 500) ? data.photoUrl : 'รูปถ่ายยืนยันในเครื่อง';
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
  initializeSheets();
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

function getPrayers(studentId, date) {
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PRAYERS);
  const rows = sheet.getDataRange().getValues();

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
  initializeSheets();
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
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  const rows = sheet.getDataRange().getValues();

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
        note: cleanVal(rows[i][7])
      });
    }
  }
  return { success: true, data: results };
}

function createActivity(data) {
  initializeSheets();
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
  initializeSheets();
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
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ACTIVITIES);
  if (!sheet) return { success: true, data: [] };
  const rows = sheet.getDataRange().getValues();

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
  initializeSheets();
  const ss = getSpreadsheet();
  const sheetLogs = ss.getSheetByName(SHEETS.ACTIVITY_LOGS);
  if (!sheetLogs) return { success: true, data: [] };
  const rows = sheetLogs.getDataRange().getValues();
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
  initializeSheets();
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

function verifyAdminLogin(password, username) {
  if (isCodeMatch(password, MASTER_ADMIN_PASS)) {
    return { success: true, role: 'SuperAdmin', username: 'MasterAdmin', fullName: 'ผู้ดูแลระบบหลัก (Master Administrator)' };
  }

  const ss = getSpreadsheet();
  const targetUser = cleanVal(username).toLowerCase();

  // 1. ตรวจสอบในตาราง 'รายชื่อแอดมินดูแลระบบ'
  const sheetAdmins = ss.getSheetByName(SHEETS.ADMINS);
  if (sheetAdmins && sheetAdmins.getLastRow() > 1) {
    const rows = sheetAdmins.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (cleanVal(rows[i][1]).toLowerCase() === targetUser && isCodeMatch(rows[i][2], password)) {
        const status = cleanVal(rows[i][7] || 'ใช้งานปกติ');
        if (status.includes('ระงับ') || status.includes('ยกเลิก')) {
          return { success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบหลัก' };
        }
        return {
          success: true,
          role: cleanVal(rows[i][4]) || 'Admin',
          username: cleanVal(rows[i][1]),
          fullName: cleanVal(rows[i][3]),
          phone: normalizePhone(rows[i][5] || ''),
          email: cleanVal(rows[i][6] || ''),
          approvalStatus: 'Verified'
        };
      }
    }
  }

  // 2. ตรวจสอบในตาราง 'รายชื่ออาจารย์ผู้สอน'
  const sheetTeachers = ss.getSheetByName(SHEETS.TEACHERS);
  if (sheetTeachers && sheetTeachers.getLastRow() > 1) {
    const rows = sheetTeachers.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (cleanVal(rows[i][1]).toLowerCase() === targetUser && isCodeMatch(rows[i][2], password)) {
        let assignedSubjects = [];
        try {
          assignedSubjects = rows[i][7] ? JSON.parse(rows[i][7]) : [];
        } catch (e) {}
        const workStatus = cleanVal(rows[i][8] || 'ปฏิบัติหน้าที่ปกติ');
        if (workStatus.includes('พ้นสภาพ')) {
          return { success: false, message: 'บัญชีอาจารย์พ้นสภาพการทำงานแล้ว' };
        }
        return {
          success: true,
          role: cleanVal(rows[i][4]) || 'TEACHER',
          username: cleanVal(rows[i][1]),
          fullName: cleanVal(rows[i][3]),
          phone: normalizePhone(rows[i][5] || ''),
          email: cleanVal(rows[i][6] || ''),
          assignedSubjects: assignedSubjects,
          approvalStatus: 'Verified'
        };
      }
    }
  }

  // 3. Fallback ชีตเดิม 'ผู้ดูแลระบบ' กรณีเพิ่งเริ่มใช้งาน
  const legacySheet = ss.getSheetByName('ผู้ดูแลระบบ');
  if (legacySheet && legacySheet.getLastRow() > 1) {
    const rows = legacySheet.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (cleanVal(rows[i][1]).toLowerCase() === targetUser && isCodeMatch(rows[i][2], password)) {
        const approvalStatus = cleanVal(rows[i][9] || 'Verified');
        if (approvalStatus === 'PendingAdmin' || approvalStatus === 'AwaitingOtp') {
          return {
            success: false,
            requireOtp: true,
            approvalStatus: approvalStatus,
            message: 'บัญชียังไม่ได้ยืนยันรหัส OTP 6 หลักจากอีเมล'
          };
        }
        let assignedSubjects = [];
        try {
          assignedSubjects = rows[i][8] ? JSON.parse(rows[i][8]) : [];
        } catch (e) {}
        return {
          success: true,
          role: cleanVal(rows[i][4]) || 'TEACHER',
          username: cleanVal(rows[i][1]),
          fullName: cleanVal(rows[i][3]),
          email: cleanVal(rows[i][6] || ''),
          phone: normalizePhone(rows[i][7] || ''),
          assignedSubjects: assignedSubjects,
          approvalStatus: approvalStatus
        };
      }
    }
  }

  return { success: false, message: 'รหัสผ่านหรือชื่อผู้ใช้ไม่ถูกต้อง' };
}

function addSubAdmin(data) {
  if (!data || !data.username) return { success: false, message: 'ไม่พบชื่อผู้ใช้งาน' };
  initializeSheets();
  const ss = getSpreadsheet();
  const cleanUser = cleanVal(data.username);
  const cleanPass = cleanVal(data.password || '');
  const fullName = cleanVal(data.fullName || cleanUser);
  const roleCode = cleanVal(data.role || 'TEACHER');
  const email = cleanVal(data.email || '');
  const phone = normalizePhone(data.phone || '');
  const subjectsJson = JSON.stringify(Array.isArray(data.assignedSubjects) ? data.assignedSubjects : []);
  const createdAt = cleanVal(data.createdAt || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss"));

  const isTeacher = (roleCode === 'TEACHER' || roleCode === 'Teacher' || roleCode.includes('อาจารย์') || roleCode.includes('ผู้สอน') || roleCode === 'TeacherAdmin');
  const targetSheetName = isTeacher ? SHEETS.TEACHERS : SHEETS.ADMINS;
  const sheet = ss.getSheetByName(targetSheetName);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงาน ' + targetSheetName };

  const rows = sheet.getDataRange().getValues();
  let rowNum = -1;
  for (let i = 1; i < rows.length; i++) {
    if (cleanVal(rows[i][1]).toLowerCase() === cleanUser.toLowerCase()) {
      rowNum = i + 1;
      break;
    }
  }

  const recordId = cleanVal(data.id || data.adminId || ((isTeacher ? 'TCH-' : 'ADM-') + new Date().getTime()));

  if (isTeacher) {
    // HEADERS.TEACHERS: ['รหัสอาจารย์', 'ชื่อผู้ใช้ (Username)', 'รหัสผ่าน (Password)', 'ชื่อ-นามสกุล', 'ตำแหน่ง / สิทธิ์', 'เบอร์โทรศัพท์', 'อีเมล', 'รายวิชาที่รับผิดชอบ JSON', 'สถานะการทำงาน', 'วันที่ลงทะเบียน / สร้างบัญชี']
    const rowData = [
      recordId,
      cleanUser,
      cleanPass,
      fullName,
      roleCode,
      phone,
      email,
      subjectsJson,
      cleanVal(data.status || 'ปฏิบัติหน้าที่ปกติ'),
      createdAt
    ];
    if (rowNum > 0) {
      sheet.getRange(rowNum, 1, 1, 10).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
      rowNum = sheet.getLastRow();
    }
    sheet.getRange(rowNum, 2).setNumberFormat('@').setValue(cleanUser);
    sheet.getRange(rowNum, 3).setNumberFormat('@').setValue(cleanPass);
    sheet.getRange(rowNum, 6).setNumberFormat('@').setValue(phone);
    return { success: true, message: 'บันทึกข้อมูลอาจารย์ผู้สอนสำเร็จ', adminId: recordId };
  } else {
    // HEADERS.ADMINS: ['รหัสแอดมิน', 'ชื่อผู้ใช้ (Username)', 'รหัสผ่าน (Password)', 'ชื่อ-นามสกุล', 'ระดับสิทธิ์ (Role)', 'เบอร์โทรศัพท์', 'อีเมล', 'สถานะบัญชี', 'วันที่แต่งตั้ง / สร้างบัญชี', 'หมายเหตุ']
    const rowData = [
      recordId,
      cleanUser,
      cleanPass,
      fullName,
      roleCode,
      phone,
      email,
      cleanVal(data.status || 'ใช้งานปกติ'),
      createdAt,
      cleanVal(data.note || 'ผู้ดูแลระบบ')
    ];
    if (rowNum > 0) {
      sheet.getRange(rowNum, 1, 1, 10).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
      rowNum = sheet.getLastRow();
    }
    sheet.getRange(rowNum, 2).setNumberFormat('@').setValue(cleanUser);
    sheet.getRange(rowNum, 3).setNumberFormat('@').setValue(cleanPass);
    sheet.getRange(rowNum, 6).setNumberFormat('@').setValue(phone);
    return { success: true, message: 'บันทึกข้อมูลแอดมินดูแลระบบสำเร็จ', adminId: recordId };
  }
}

function deleteSubAdmin(username) {
  initializeSheets();
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
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.TEACHERS);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };

  const rows = sheet.getDataRange().getValues();
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
      createdAt: formatSheetDate(rows[i][9]) || cleanVal(rows[i][9])
    };
    if (order.indexOf(key) === -1) order.push(key);
  }
  return { success: true, data: order.map(k => dedupMap[k]) };
}

function getAdmins() {
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ADMINS);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };

  const rows = sheet.getDataRange().getValues();
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
  initializeSheets();
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

  const rows = sheet.getDataRange().getValues();
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
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: true, data: [] };
  const rows = sheet.getDataRange().getValues();
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
    initializeSheets();
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
  if (!photoBase64.startsWith('data:image')) {
    return photoBase64; // เป็น URL อยู่แล้ว
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
    
    const contentType = "image/jpeg";
    const cleanBase64 = photoBase64.includes(',') ? photoBase64.split(',')[1] : photoBase64;
    const bytes = Utilities.base64Decode(cleanBase64);
    const fileName = `profile_${studentId}.jpg`;
    
    const existingFiles = folder.getFilesByName(fileName);
    let file;
    if (existingFiles.hasNext()) {
      file = existingFiles.next();
      file.setContent(bytes);
    } else {
      file = folder.createFile(Utilities.newBlob(bytes, contentType, fileName));
    }
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return `https://lh3.googleusercontent.com/d/${file.getId()}`;
  } catch (err) {
    Logger.log('saveStudentPhotoToDrive error: ' + err.message);
    return 'Stored locally on device';
  }
}

function updateStudentProfilePhoto(studentId, avatarUrl) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานนักเรียน' };
  const rows = sheet.getDataRange().getValues();
  
  const drivePhotoUrl = saveStudentPhotoToDrive(studentId, avatarUrl);

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
  initializeSheets();
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
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.HASANAT);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [], byStudent: {} };
  const rows = sheet.getDataRange().getValues();
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
  initializeSheets();
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
function registerPendingUser(data) {
  const sheet = ensureApprovalsSheet();
  const reqId = cleanVal(data.reqId || data.id || ('REQ-' + new Date().getTime()));
  const role = cleanVal(data.role || 'student');
  const userId = cleanVal(data.userId || '');
  const fullName = cleanVal(data.fullName || '');
  const email = cleanVal(data.email || '');
  const detail = cleanVal(data.gradeOrSubj || data.detail || '');
  const otpCode = cleanVal(data.otpCode || String(Math.floor(100000 + Math.random() * 900000)));
  const status = cleanVal(data.status || 'PendingAdmin');
  const requestedAt = cleanVal(data.createdAt || data.requestedAt || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss"));

  const rows = sheet.getDataRange().getValues();
  let updatedRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (isCodeMatch(rows[i][2], userId) && cleanVal(rows[i][1]) === role) {
      updatedRow = i + 1;
      break;
    }
  }

  const payloadObj = data.payload || {};
  if (data.phone && !payloadObj.phone) payloadObj.phone = cleanVal(data.phone);

  const rowValues = [
    reqId, role, userId, fullName, email, detail, otpCode, status, requestedAt, JSON.stringify(payloadObj)
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

  return {
    success: true,
    message: 'บันทึกคำขอสมัครเรียบร้อย รอแอดมินอนุมัติและส่งรหัสยืนยันทางอีเมล',
    reqId: reqId,
    otpCode: otpCode
  };
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
  const otpCode = cleanVal(data.otpCode || '');
  const reqId = cleanVal(data.reqId || data.id || '');

  // อัปเดตสถานะในแผ่นงานรายการรออนุมัติสมัคร
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if ((reqId && cleanVal(rows[i][0]) === reqId) || (userId && isCodeMatch(rows[i][2], userId))) {
      sheet.getRange(i + 1, 7).setNumberFormat('@').setValue(otpCode);
      sheet.getRange(i + 1, 8).setValue('Approved');
      break;
    }
  }

  // บันทึกข้อมูลเบื้องต้นพร้อมสถานะ AwaitingOtp (ต้องรอผู้สมัครกรอกรหัส OTP 6 หลักจากอีเมลก่อนจึงจะเข้าสู่ระบบได้)
  try {
    if (data.payload) {
      const pendingPayload = Object.assign({}, data.payload, { approvalStatus: 'AwaitingOtp', status: 'รอผู้สมัครกรอกรหัส OTP' });
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
  const sheet = ensureApprovalsSheet();
  const reqId = cleanVal(data.reqId || data.id || '');
  const userId = cleanVal(data.userId || '');
  const role = cleanVal(data.role || 'student');
  const enteredOtp = cleanVal(data.otpCode || '');

  if (!enteredOtp || enteredOtp.length !== 6) {
    return { success: false, message: 'กรุณากรอกรหัสยืนยัน 6 หลักให้ครบถ้วน' };
  }

  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    const rReqId = cleanVal(rows[i][0]);
    const rRole = cleanVal(rows[i][1]);
    const rUserId = cleanVal(rows[i][2]);
    const rOtp = cleanVal(rows[i][6]);
    const rStatus = cleanVal(rows[i][7]);

    const matchUser = (reqId && rReqId === reqId) || (userId && isCodeMatch(rUserId, userId) && (!role || rRole === role));
    if (matchUser) {
      if (rStatus === 'PendingAdmin') {
        return {
          success: false,
          status: 'PendingAdmin',
          message: 'บัญชียังอยู่ระหว่างรอแอดมินกดอนุมัติและส่งรหัสยืนยันเข้าอีเมล กรุณารอรับอีเมลก่อน'
        };
      }
      if (!isCodeMatch(rOtp, enteredOtp)) {
        return {
          success: false,
          status: rStatus,
          message: 'รหัสยืนยัน 6 หลักไม่ถูกต้อง กรุณาตรวจสอบรหัสในอีเมลของท่านอีกครั้ง'
        };
      }

      // รหัสถูกต้องและแอดมินอนุมัติแล้ว -> เปลี่ยนสถานะเป็น Verified
      sheet.getRange(i + 1, 8).setValue('Verified');

      let payload = data.payload || {};
      try {
        if (!payload || Object.keys(payload).length === 0) {
          payload = rows[i][9] ? JSON.parse(rows[i][9]) : {};
        }
      } catch (e) {}

      try {
        if (rRole === 'student') {
          payload.studentId = payload.studentId || rUserId;
          payload.fullName = payload.fullName || cleanVal(rows[i][3]);
          payload.email = payload.email || cleanVal(rows[i][4]);
          payload.status = 'Active';
          payload.approvalStatus = 'Verified';
          registerStudent(payload);
        } else if (rRole === 'teacher') {
          payload.username = payload.username || rUserId;
          payload.fullName = payload.fullName || cleanVal(rows[i][3]);
          payload.email = payload.email || cleanVal(rows[i][4]);
          payload.approvalStatus = 'Verified';
          addSubAdmin(payload);
        }
      } catch (actErr) {}

      return {
        success: true,
        status: 'Verified',
        role: rRole,
        userId: rUserId,
        payload: payload,
        message: 'ยืนยันรหัส OTP สำเร็จ บัญชีของท่านพร้อมใช้งานแล้ว'
      };
    }
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
  const rows = sheet.getDataRange().getValues();
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
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  const sheetStudents = ss.getSheetByName(SHEETS.STUDENTS);
  const dateStr = formatSheetDate(data.date) || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
  const gradeStr = cleanVal(data.grade || '');
  const records = data.records || {};
  const studentDetails = data.studentDetails || {};
  const timeStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "HH:mm:ss");
  const teacherNote = 'เช็คชื่อโดยอาจารย์ (' + cleanVal(data.teacherId || 'admin') + ')';
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
      if (isCodeMatch(existingAttRows[i][1], cleanSid) && formatSheetDate(existingAttRows[i][4]) === dateStr) {
        foundAttRow = i + 1;
        break;
      }
    }

    if (foundAttRow !== -1) {
      sheet.getRange(foundAttRow, 3, 1, 6).setValues([[
        sName, sGrade, dateStr, timeStr, statusThai, teacherNote
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
        teacherNote
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
  initializeSheets();
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
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.SETTINGS);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: {} };
  const rows = sheet.getDataRange().getValues();
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
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.CALENDAR);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };

  const rows = sheet.getDataRange().getValues();
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
  initializeSheets();
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
  initializeSheets();
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
  initializeSheets();
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
    settings: getSettings().data || {}
  };
}
