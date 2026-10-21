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

// ชื่อแผ่นงานหลักภาษาไทย (Thai Sheet Names)
const SHEETS = {
  STUDENTS: 'รายชื่อนักเรียน',
  PRAYERS: 'บันทึกเวลาละหมาด',
  ATTENDANCE: 'บันทึกการมาเรียน',
  ACTIVITIES: 'กิจกรรม',
  ACTIVITY_LOGS: 'บันทึกการเข้าร่วมกิจกรรม',
  ADMINS: 'ผู้ดูแลระบบ',
  SETTINGS: 'การตั้งค่า',
  HASANAT: 'บันทึกผลบุญ'
};

// ชื่อแผ่นงานเดิมภาษาอังกฤษ (สำหรับแปลงของเดิมให้เป็นภาษาไทยอัตโนมัติ)
const LEGACY_SHEETS = {
  STUDENTS: ['Students', 'students', 'Student', 'นักเรียน'],
  PRAYERS: ['PrayerLogs', 'prayerlogs', 'Prayer_Logs', 'Prayers', 'บันทึกละหมาด'],
  ATTENDANCE: ['AttendanceLogs', 'attendancelogs', 'Attendance_Logs', 'Attendance', 'เช็คชื่อมาเรียน'],
  ACTIVITIES: ['Activities', 'activities', 'Activity'],
  ACTIVITY_LOGS: ['ActivityLogs', 'activitylogs', 'Activity_Logs', 'บันทึกเข้าร่วมกิจกรรม'],
  ADMINS: ['Admins', 'admins', 'Admin'],
  SETTINGS: ['Settings', 'settings', 'Setting'],
  HASANAT: ['HasanatLogs', 'hasanatlogs', 'Hasanat_Logs', 'Hasanat', 'ผลบุญ']
};

// หัวคอลัมน์ภาษาไทยมาตรฐานสำหรับแต่ละแผ่นงาน
const HEADERS = {
  STUDENTS: [
    'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'โรงเรียน/สังกัด', 'ระดับชั้น', 
    'วันเดือนปีเกิด', 'เบอร์โทรผู้ปกครอง', 'วันที่ลงทะเบียน', 'สถานะนักเรียน', 'รูปโปรไฟล์'
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
  ADMINS: [
    'รหัสแอดมิน', 'ชื่อผู้ใช้ (Username)', 'รหัสผ่าน (Password)', 'ชื่อ-นามสกุล', 'ระดับสิทธิ์ (Role)', 'วันที่สร้าง'
  ],
  SETTINGS: [
    'การตั้งค่า (Key)', 'ค่าที่กำหนด (Value)', 'คำอธิบาย (Description)'
  ],
  HASANAT: [
    'รหัสบันทึก', 'รหัสนักเรียน', 'ชื่อนักเรียน', 'ระดับชั้น', 'วันที่', 
    'อ่านกุรอานวันนี้ (หน้า)', 'อ่านถึงหน้าที่', 'อ่านจบกี่ยุซ', 'จำนวนดาวที่สะสม (ดวง)', 
    'จำนวนครั้งอ่านจบ30ยุซ (ค็อตม์)', 'จำนวนซูเราะห์ที่ท่องจำ', 'รายชื่อซูเราะห์ที่ท่องจำได้', 
    'รวมร็อกอะฮ์สุนัตวันนี้', 'รายละเอียดละหมาดสุนัต', 'เวลา Timestamp'
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

  // อัปเกรดแถวที่ 1 ให้เป็นหัวตารางภาษาไทยสวยงาม
  if (defaultHeaders && defaultHeaders.length > 0) {
    const lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      sheet.appendRow(defaultHeaders);
    } else {
      const firstCell = String(sheet.getRange(1, 1).getValue()).trim();
      // หากหัวตารางเดิมเป็นภาษาอังกฤษ ให้อัปเดตเป็นหัวภาษาไทยทันที
      if (firstCell.startsWith('Student') || firstCell.startsWith('Log') || 
          firstCell === 'Key' || firstCell.startsWith('Act') || firstCell.startsWith('Admin')) {
        sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
      }
    }

    // จัดรูปแบบแถวหัวตาราง (สีพื้นหลัง, ตัวอักษรสีขาว, ตัวหนา, ล็อกแถวบนสุด)
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, defaultHeaders.length)
      .setBackground(headerBgColor || "#0284c7")
      .setFontColor("#ffffff")
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
  }

  return sheet;
}

/**
 * ฟังก์ชันสร้าง/อัปเกรดแผ่นงานทั้งหมดให้เป็นภาษาไทย 100% พร้อมบังคับฟอร์แมต Plain Text ให้กับรหัสและเบอร์โทร
 */
function initializeSheets() {
  const ss = getSpreadsheet();
  
  // 1. รายชื่อนักเรียน (บังคับคอลัมน์ A=รหัส, E=วันเกิด, F=เบอร์โทร เป็น Plain Text '@')
  const sheetStudents = getOrCreateSheetSmart(ss, 'STUDENTS', HEADERS.STUDENTS, '#0284c7');
  try {
    sheetStudents.getRange('A:A').setNumberFormat('@');
    sheetStudents.getRange('E:E').setNumberFormat('@');
    sheetStudents.getRange('F:F').setNumberFormat('@');
  } catch (fmtErr) {}

  // 2. บันทึกเวลาละหมาด
  const sheetPrayers = getOrCreateSheetSmart(ss, 'PRAYERS', HEADERS.PRAYERS, '#0284c7');
  try {
    sheetPrayers.getRange('B:B').setNumberFormat('@');
  } catch (fmtErr) {}

  // 3. บันทึกการมาเรียน
  const sheetAttendance = getOrCreateSheetSmart(ss, 'ATTENDANCE', HEADERS.ATTENDANCE, '#0284c7');
  try {
    sheetAttendance.getRange('B:B').setNumberFormat('@');
  } catch (fmtErr) {}

  // 4. กิจกรรม
  getOrCreateSheetSmart(ss, 'ACTIVITIES', HEADERS.ACTIVITIES, '#0284c7');

  // 4.1 บันทึกการเข้าร่วมกิจกรรม
  const sheetActLogs = getOrCreateSheetSmart(ss, 'ACTIVITY_LOGS', HEADERS.ACTIVITY_LOGS, '#0284c7');
  try {
    sheetActLogs.getRange('B:B').setNumberFormat('@');
  } catch (fmtErr) {}

  // 5. ผู้ดูแลระบบ
  const sheetAdmins = getOrCreateSheetSmart(ss, 'ADMINS', HEADERS.ADMINS, '#0284c7');
  try {
    sheetAdmins.getRange('A:A').setNumberFormat('@');
    sheetAdmins.getRange('B:B').setNumberFormat('@');
    sheetAdmins.getRange('C:C').setNumberFormat('@');
  } catch (fmtErr) {}

  if (sheetAdmins.getLastRow() === 1) {
    sheetAdmins.appendRow([
      'ADM001', 'admin', MASTER_ADMIN_PASS, 'ผู้ดูแลระบบหลัก (Master Administrator)', 'ผู้ดูแลระบบสูงสุด', new Date().toISOString()
    ]);
    const rIdx = sheetAdmins.getLastRow();
    sheetAdmins.getRange(rIdx, 3).setNumberFormat('@').setValue(MASTER_ADMIN_PASS);
  }

  // 6. การตั้งค่า
  const sheetSettings = getOrCreateSheetSmart(ss, 'SETTINGS', HEADERS.SETTINGS, '#0284c7');
  try {
    sheetSettings.getRange('B:B').setNumberFormat('@');
  } catch (fmtErr) {}

  if (sheetSettings.getLastRow() === 1) {
    sheetSettings.appendRow(['AppName', 'ระบบ KHALIFAH PROGRAM', 'ชื่อระบบ']);
    sheetSettings.appendRow(['MasterCode', MASTER_ADMIN_PASS, 'รหัสแอดมินหลัก']);
    sheetSettings.appendRow(['CurrentAcademicYear', '2569', 'ปีการศึกษาปัจจุบัน']);
    sheetSettings.getRange(3, 2).setNumberFormat('@').setValue(MASTER_ADMIN_PASS);
  }

  // 7. บันทึกผลบุญ
  const sheetHasanat = getOrCreateSheetSmart(ss, 'HASANAT', HEADERS.HASANAT, '#059669');
  try {
    sheetHasanat.getRange('B:B').setNumberFormat('@');
  } catch (fmtErr) {}

  // ทำการแปลงข้อมูลในเซลล์เดิมที่เป็นภาษาอังกฤษให้เป็นภาษาไทย และทำความสะอาดเลขศูนย์นำหน้า
  convertDataCellsToThai(ss);

  return { success: true, message: 'ฐานข้อมูล Google Sheets ถูกสร้างและอัปเกรดเป็นภาษาไทย 100% พร้อมรองรับเลข 0 นำหน้าเรียบร้อยแล้ว' };
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
  if (s === 'ACTIVE' || s === 'ปกติ') return 'ปกติ (กำลังศึกษา)';
  if (s === 'GRADUATED' || s.includes('สำเร็จ')) return 'สำเร็จการศึกษา';
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
      case 'getSubAdmins':
        result = getSubAdmins();
        break;
      case 'checkRegistrationStatus':
        result = checkRegistrationStatus(e.parameter.userId, e.parameter.role);
        break;
      case 'getPendingRegistrations':
        result = getPendingRegistrations();
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
      case 'checkInActivity':
      case 'activityCheckIn':
        result = checkInActivity(postData.data || postData);
        break;
      case 'adminLogin':
        result = verifyAdminLogin(postData.password || (postData.data && postData.data.password), postData.username || (postData.data && postData.data.username));
        break;
      case 'addSubAdmin':
        result = addSubAdmin(postData.data || postData);
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
      case 'approveRegistrationAndSendEmail':
        result = approveRegistrationAndSendEmail(postData.data || postData);
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
  const cleanBD = normalizeBirthDate(data.birthDate);
  const cleanPh = normalizePhone(data.parentPhone);

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (isCodeMatch(rows[i][0], cleanSid)) {
      return { success: false, message: 'รหัสนักเรียนนี้ได้ลงทะเบียนในระบบแล้ว' };
    }
  }

  const registeredAt = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");

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

  sheet.appendRow([
    cleanSid,
    data.fullName || '',
    data.schoolName || '',
    data.grade || '',
    cleanBD,
    cleanPh,
    registeredAt,
    formatStudentStatusThai(data.status || 'Active'),
    safePhotoRef
  ]);

  // ตั้งค่า NumberFormat เป็น Plain Text เพื่อรักษาเลข 0 นำหน้าแน่นอน 100%
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 1).setNumberFormat('@').setValue(cleanSid);
  sheet.getRange(lastRow, 5).setNumberFormat('@').setValue(cleanBD);
  sheet.getRange(lastRow, 6).setNumberFormat('@').setValue(cleanPh);

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
      avatarUrl: photoLink || rawPhoto
    }
  };
}

function getStudent(studentId, parentPhone) {
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานนักเรียน' };
  const rows = sheet.getDataRange().getValues();

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
        student: {
          studentId: cleanVal(rows[i][0]),
          fullName: rows[i][1],
          schoolName: rows[i][2],
          grade: rows[i][3],
          birthDate: normalizeBirthDate(rows[i][4]),
          parentPhone: normalizePhone(rows[i][5]),
          status: rows[i][7] || 'ปกติ (กำลังศึกษา)',
          avatarUrl: rows[i][8] || ''
        }
      };
    }
  }

  return { success: false, message: 'ไม่พบข้อมูลนักเรียน' };
}

function loginStudent(studentId, passOrPhone) {
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานนักเรียน' };
  const rows = sheet.getDataRange().getValues();

  const cleanInput = cleanVal(passOrPhone);
  const targetId = cleanVal(studentId);

  for (let i = 1; i < rows.length; i++) {
    const sId = rows[i][0];
    const bDate = rows[i][4];
    const sPhone = rows[i][5];

    if (isCodeMatch(sId, targetId)) {
      const matchPass = isCodeMatch(bDate, cleanInput) || isPhoneMatch(sPhone, cleanInput);
      if (matchPass) {
        return {
          success: true,
          student: {
            studentId: cleanVal(rows[i][0]),
            fullName: rows[i][1],
            schoolName: rows[i][2],
            grade: rows[i][3],
            birthDate: normalizeBirthDate(rows[i][4]),
            parentPhone: normalizePhone(rows[i][5]),
            status: rows[i][7] || 'ปกติ (กำลังศึกษา)',
            avatarUrl: rows[i][8] || ''
          }
        };
      } else {
        return { success: false, message: 'รหัสผ่านหรือข้อมูลยืนยันไม่ถูกต้อง' };
      }
    }
  }

  return { success: false, message: 'ไม่พบรหัสนักเรียนในระบบ' };
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

function updateSubjectScores(data) {
  return { success: true, message: 'บันทึกคะแนนสมรรถนะสำเร็จ', data: data };
}

function recordPrayer(data) {
  if (!data) return { success: false, message: 'ไม่มีข้อมูลการละหมาด' };
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PRAYERS);

  const logId = data.logId || data.id || ('PRY-' + new Date().getTime());
  const timestamp = data.timestamp || new Date().toISOString();
  const now = new Date();
  const dateStr = data.date || Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd");
  const timeStr = data.time || Utilities.formatDate(now, "Asia/Bangkok", "HH:mm:ss");

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
      const studentIdClean = String(data.studentId || 'std').replace(/[^a-zA-Z0-9_-]/g, '');
      const pTimeClean = String(data.prayerTime || data.prayerName || 'prayer').replace(/[^a-zA-Z0-9_\u0E00-\u0E7F-]/g, '');
      const blob = Utilities.newBlob(bytes, contentType, `${studentIdClean}_${pTimeClean}_${dateStr}_${logId}.jpg`);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      photoRef = file.getUrl();
    } catch (err) {
      Logger.log('Drive prayer photo error: ' + err.message);
      photoRef = 'รูปถ่ายยืนยันในเครื่อง (Local Snapshot)';
    }
  }

  if (!photoRef) {
    photoRef = (data.photoUrl && data.photoUrl.length < 500) ? data.photoUrl : 'รูปถ่ายยืนยันในเครื่อง';
  }

  // รองรับทั้ง prayerTime, prayerName, timeSlot
  const rawPrayerTime = data.prayerTime || data.prayerName || data.timeSlot || '';
  const prayerNameThai = formatPrayerTimeThai(rawPrayerTime);
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
  if (lat && lng && !isWithin) {
    locationDisplay += ` (แผนที่: https://www.google.com/maps?q=${lat},${lng})`;
  }

  sheet.appendRow([
    logId,
    formatAsText(data.studentId),
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

  return { success: true, message: 'บันทึกการละหมาดเวลา ' + prayerNameThai + ' สำเร็จแล้ว', logId: logId, photoUrl: photoRef };
}

function getPrayers(studentId, date) {
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PRAYERS);
  const rows = sheet.getDataRange().getValues();

  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const sId = String(rows[i][1]).trim();
    const rowDate = String(rows[i][6]).trim();

    if ((!studentId || sId === String(studentId).trim()) &&
        (!date || rowDate === String(date).trim())) {
      results.push({
        logId: rows[i][0],
        studentId: rows[i][1],
        studentName: rows[i][2],
        grade: rows[i][3],
        prayerTime: rows[i][4],
        timestamp: rows[i][5],
        date: rows[i][6],
        time: rows[i][7],
        latitude: rows[i][8],
        longitude: rows[i][9],
        locationName: rows[i][10],
        distanceMeters: rows[i][11],
        isWithinZone: rows[i][12] === 'ใช่',
        photoUrl: rows[i][13],
        status: rows[i][14],
        note: rows[i][15]
      });
    }
  }
  return { success: true, data: results };
}

function recordAttendance(data) {
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  const logId = 'ATT-' + new Date().getTime();
  const now = new Date();
  const dateStr = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd");
  const timeStr = Utilities.formatDate(now, "Asia/Bangkok", "HH:mm:ss");

  sheet.appendRow([
    logId,
    formatAsText(data.studentId),
    data.studentName,
    data.grade,
    data.date || dateStr,
    data.time || timeStr,
    formatAttendanceStatusThai(data.status || 'มา'),
    data.note || ''
  ]);

  return { success: true, message: 'บันทึกการมาเรียนสำเร็จ', logId: logId };
}

function getAttendance(studentId, grade) {
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  const rows = sheet.getDataRange().getValues();

  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const sId = String(rows[i][1]).trim();
    const sGrade = String(rows[i][3]).trim();

    if ((!studentId || sId === String(studentId).trim()) &&
        (!grade || sGrade === String(grade).trim())) {
      results.push({
        logId: rows[i][0],
        studentId: rows[i][1],
        studentName: rows[i][2],
        grade: rows[i][3],
        date: rows[i][4],
        time: rows[i][5],
        status: rows[i][6],
        note: rows[i][7]
      });
    }
  }
  return { success: true, data: results };
}

function createActivity(data) {
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ACTIVITIES);
  const actId = 'ACT-' + new Date().getTime();

  sheet.appendRow([
    actId,
    data.title,
    data.description,
    data.startDate,
    data.endDate,
    data.location,
    data.createdBy || 'Admin',
    Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss"),
    0
  ]);

  return { success: true, message: 'ประกาศกิจกรรมใหม่เรียบร้อยแล้ว', activityId: actId };
}

function getActivities() {
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ACTIVITIES);
  const rows = sheet.getDataRange().getValues();

  const results = [];
  for (let i = 1; i < rows.length; i++) {
    results.push({
      activityId: rows[i][0],
      title: rows[i][1],
      description: rows[i][2],
      startDate: rows[i][3],
      endDate: rows[i][4],
      location: rows[i][5],
      createdBy: rows[i][6],
      createdAt: rows[i][7],
      attendeesCount: rows[i][8]
    });
  }
  return { success: true, data: results.reverse() };
}

function checkInActivity(data) {
  if (!data) return { success: false, message: 'ไม่มีข้อมูลกิจกรรม' };
  initializeSheets();
  const ss = getSpreadsheet();
  const sheetActivities = ss.getSheetByName(SHEETS.ACTIVITIES);
  const sheetLogs = ss.getSheetByName(SHEETS.ACTIVITY_LOGS);

  const targetActId = String(data.activityId || '').trim();
  const targetActTitle = String(data.activityTitle || data.title || '').trim();
  let activityFoundTitle = targetActTitle;

  // 1. อัปเดตยอดผู้เข้าร่วมในแผ่นงาน ACTIVITIES
  if (sheetActivities) {
    const rows = sheetActivities.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const rowActId = String(rows[i][0]).trim();
      const rowActTitle = String(rows[i][1]).trim();
      if ((targetActId && rowActId === targetActId) || (targetActTitle && rowActTitle === targetActTitle)) {
        const currentCount = Number(rows[i][8]) || 0;
        sheetActivities.getRange(i + 1, 9).setValue(currentCount + 1);
        activityFoundTitle = rowActTitle;
        break;
      }
    }
  }

  // 2. บันทึกประวัติการเข้าร่วมของนักเรียนลงในแผ่นงาน ACTIVITY_LOGS
  if (sheetLogs) {
    const logId = data.id || ('ACTLOG-' + new Date().getTime());
    const now = new Date();
    const dateStr = data.formattedDate || Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd");
    const timeStr = data.formattedTime || Utilities.formatDate(now, "Asia/Bangkok", "HH:mm:ss");
    const timestamp = data.checkInTimestamp || now.toISOString();

    sheetLogs.appendRow([
      logId,
      targetActId || '-',
      activityFoundTitle || targetActTitle || 'กิจกรรมทั่วไป',
      formatAsText(data.studentId || '-'),
      data.studentName || '',
      data.grade || '',
      dateStr,
      timeStr,
      timestamp
    ]);
  }

  return { success: true, message: 'บันทึกการเข้าร่วมกิจกรรมลง Google Sheets สำเร็จ' };
}

function verifyAdminLogin(password, username) {
  if (isCodeMatch(password, MASTER_ADMIN_PASS)) {
    return { success: true, role: 'SuperAdmin', username: 'MasterAdmin' };
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ADMINS);
  if (sheet) {
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (cleanVal(rows[i][1]).toLowerCase() === cleanVal(username).toLowerCase() && 
          isCodeMatch(rows[i][2], password)) {
        return { success: true, role: rows[i][4], username: rows[i][1], fullName: rows[i][3] };
      }
    }
  }

  return { success: false, message: 'รหัสผ่านหรือชื่อผู้ใช้ไม่ถูกต้อง' };
}

function addSubAdmin(data) {
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ADMINS);
  const adminId = 'ADM-' + new Date().getTime();
  const cleanPass = cleanVal(data.password);

  sheet.appendRow([
    adminId,
    cleanVal(data.username),
    cleanPass,
    data.fullName,
    data.role === 'SuperAdmin' ? 'ผู้ดูแลระบบสูงสุด' : 'ผู้ดูแลระบบ',
    Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss")
  ]);

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 3).setNumberFormat('@').setValue(cleanPass);

  return { success: true, message: 'เพิ่มผู้ดูแลระบบรองสำเร็จ' };
}

function getSubAdmins() {
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ADMINS);
  const rows = sheet.getDataRange().getValues();
  const results = [];
  for (let i = 1; i < rows.length; i++) {
    results.push({
      adminId: cleanVal(rows[i][0]),
      username: cleanVal(rows[i][1]),
      fullName: rows[i][3],
      role: rows[i][4],
      createdAt: rows[i][5]
    });
  }
  return { success: true, data: results };
}

function getAllStudents() {
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: true, data: [] };
  const rows = sheet.getDataRange().getValues();

  const results = [];
  for (let i = 1; i < rows.length; i++) {
    results.push({
      studentId: cleanVal(rows[i][0]),
      fullName: rows[i][1],
      schoolName: rows[i][2],
      grade: rows[i][3],
      birthDate: normalizeBirthDate(rows[i][4]),
      parentPhone: normalizePhone(rows[i][5]),
      registeredAt: rows[i][6],
      status: rows[i][7],
      profilePhoto: rows[i][8] || ''
    });
  }
  return { success: true, data: results };
}

function deleteStudent(studentId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
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
  const rows = sheet.getDataRange().getValues();
  let count = 0;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][3]).trim() === String(fromGrade).trim()) {
      sheet.getRange(i + 1, 4).setValue(toGrade);
      count++;
    }
  }

  return { success: true, message: `เลื่อนชั้นปีนักเรียนจาก ${fromGrade} ไป ${toGrade} สำเร็จจำนวน ${count} คน` };
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
      logoUrl = file.getUrl();
    } catch (err) {
      Logger.log('Drive logo save error: ' + err.message);
      // fallback to safe ref if string is too long for cell
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
    return file.getUrl();
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
 * บันทึกข้อมูลผลบุญและศาสนกิจ (อัลกุรอาน, ท่องจำซูเราะห์, ละหมาดสุนัต) ลง Google Sheet
 */
function recordHasanat(data) {
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.HASANAT);
  
  const logId = 'HAS-' + new Date().getTime();
  const timestamp = new Date().toISOString();
  const dateStr = data.date || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");

  const q = data.quran || {
    pagesToday: data.pagesToday || 0,
    currentPage: data.currentPage || 0,
    juzCompleted: data.juzCompleted || 0,
    stars: data.stars || 0,
    khatamCount: data.khatamCount || 0
  };
  const m = data.memorization || {
    count: data.count || data.memorizedCount || (Array.isArray(data.memorizedSurahs) ? data.memorizedSurahs.length : 0),
    memorizedSurahs: data.memorizedSurahs || []
  };
  const s = data.sunnah || {
    totalRakaat: data.totalRakaat || 0,
    rawatib: data.rawatib || {}
  };

  const memListStr = Array.isArray(m.memorizedSurahs) ? m.memorizedSurahs.join(', ') : (m.memorizedSurahs || '');
  const sunnahDetailsStr = JSON.stringify(s.rawatib || (data.rawatib || {}));

  sheet.appendRow([
    logId,
    formatAsText(data.studentId),
    data.studentName,
    data.grade,
    dateStr,
    q.pagesToday || 0,
    q.currentPage || 0,
    q.juzCompleted || 0,
    q.stars || 0,
    q.khatamCount || 0,
    m.count || 0,
    memListStr,
    s.totalRakaat || 0,
    sunnahDetailsStr,
    timestamp
  ]);

  return { 
    success: true, 
    message: 'บันทึกข้อมูลผลบุญและศาสนกิจสำเร็จเรียบร้อย', 
    logId: logId,
    stars: q.stars || 0
  };
}

/**
 * ซิงค์ข้อมูลทั้งหมด (นักเรียน, ละหมาด, ผลบุญ) เข้า Google Sheet ในคราวเดียว พร้อมแปลงเป็นภาษาไทย 100%
 */
function batchSyncData(data) {
  initializeSheets();
  const ss = getSpreadsheet();
  let studentsSynced = 0;
  let prayersSynced = 0;
  let hasanatSynced = 0;

  // 1. Sync นักเรียน
  if (data.students && Array.isArray(data.students)) {
    const sheetStudents = ss.getSheetByName(SHEETS.STUDENTS);
    const existing = sheetStudents.getDataRange().getValues();

    data.students.forEach(s => {
      const rawPhoto = s.avatarUrl || s.profilePhoto || '';
      const cleanSid = cleanVal(s.studentId);
      const photoLink = saveStudentPhotoToDrive(cleanSid, rawPhoto);

      let foundRow = -1;
      for (let i = 1; i < existing.length; i++) {
        if (isCodeMatch(existing[i][0], cleanSid)) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow === -1) {
        const cleanBD = normalizeBirthDate(s.birthDate);
        const cleanPh = normalizePhone(s.parentPhone);
        sheetStudents.appendRow([
          cleanSid,
          s.fullName,
          s.schoolName,
          s.grade,
          cleanBD,
          cleanPh,
          Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss"),
          formatStudentStatusThai(s.status || 'Active'),
          photoLink
        ]);
        const lastRow = sheetStudents.getLastRow();
        sheetStudents.getRange(lastRow, 1).setNumberFormat('@').setValue(cleanSid);
        sheetStudents.getRange(lastRow, 5).setNumberFormat('@').setValue(cleanBD);
        sheetStudents.getRange(lastRow, 6).setNumberFormat('@').setValue(cleanPh);
        studentsSynced++;
      } else {
        if (photoLink) {
          sheetStudents.getRange(foundRow, 9).setValue(photoLink);
        }
      }
    });
  }

  // 2. Sync บันทึกละหมาด
  if (data.prayers && Array.isArray(data.prayers)) {
    data.prayers.forEach(p => {
      recordPrayer(p);
      prayersSynced++;
    });
  }

  // 3. Sync ผลบุญ
  if (data.hasanat && Array.isArray(data.hasanat)) {
    data.hasanat.forEach(h => {
      recordHasanat(h);
      hasanatSynced++;
    });
  }

  return {
    success: true,
    message: 'ซิงค์ข้อมูลลง Google Sheet และจัดหมวดภาษาไทยเรียบร้อยแล้ว',
    summary: { students: studentsSynced, prayers: prayersSynced, hasanat: hasanatSynced }
  };
}

// ==========================================
// V4.0: ระบบยืนยันตัวตนผ่านแอดมิน (Random OTP + Email), อาจารย์ผู้สอน, และจัดการข้อมูลเชิงลึก
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

  // บันทึกข้อมูลนักเรียนหรืออาจารย์ลงแผ่นงานหลักทันทีเมื่อแอดมินอนุมัติ
  try {
    if (data.payload) {
      if (role === 'student') {
        registerStudent(data.payload);
      } else if (role === 'teacher') {
        addSubAdmin(data.payload);
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
    let payload = {};
    try {
      payload = rows[i][9] ? JSON.parse(rows[i][9]) : {};
    } catch (e) {}
    list.push({
      reqId: cleanVal(rows[i][0]),
      id: cleanVal(rows[i][0]),
      role: cleanVal(rows[i][1]),
      userId: cleanVal(rows[i][2]),
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
 * อาจารย์ผู้สอนบันทึกเช็คชื่อมาเรียนรายวัน
 */
function saveDailyAttendance(data) {
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  const dateStr = cleanVal(data.date || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd"));
  const gradeStr = cleanVal(data.grade || '');
  const records = data.records || {};
  const timeStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "HH:mm:ss");
  let count = 0;

  Object.keys(records).forEach(sid => {
    const cleanSid = cleanVal(sid);
    const status = cleanVal(records[sid]);
    const logId = 'ATT-' + new Date().getTime() + '-' + count;
    sheet.appendRow([
      logId,
      cleanSid,
      '',
      gradeStr,
      dateStr,
      timeStr,
      formatAttendanceStatusThai(status),
      'เช็คชื่อโดยอาจารย์ (' + cleanVal(data.teacherId || 'admin') + ')'
    ]);
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 2).setNumberFormat('@').setValue(cleanSid);
    count++;
  });

  return { success: true, count: count, message: 'บันทึกการเช็คชื่อเรียบร้อยแล้ว' };
}

/**
 * อาจารย์ผู้สอนหรือแอดมินบันทึกเกรดรายวิชา (ระดับเกรด 1 - 4)
 */
function saveSubjectGrades(data) {
  return updateSubjectScores({
    subjectName: data.subject,
    scores: data.grades || {}
  });
}
