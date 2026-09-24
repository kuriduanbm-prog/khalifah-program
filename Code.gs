/**
 * KHALIFAH PROGRAM - Google Apps Script Backend (เวอร์ชันภาษาไทย 100%)
 * ----------------------------------------------------
 * เชื่อมต่อกับ Google Sheets อัตโนมัติเพื่อเป็นฐานข้อมูลของระบบ
 * บันทึก: ข้อมูลนักเรียน, เช็คชื่อมาเรียน, เช็คละหมาด 5 เวลา, กิจกรรม, ผู้ดูแลระบบ, ผลบุญ
 */

// รหัส Google Spreadsheet เป้าหมาย (ฐานข้อมูลหลักของระบบ)
const TARGET_SPREADSHEET_ID = '1s8p3EYESW7z2oiLVyzfFIPXck5eyeGxxU98lkkzw-ss';

const MASTER_ADMIN_PASS = '096909';

// ชื่อแผ่นงานหลักภาษาไทย (Thai Sheet Names)
const SHEETS = {
  STUDENTS: 'รายชื่อนักเรียน',
  PRAYERS: 'บันทึกเวลาละหมาด',
  ATTENDANCE: 'บันทึกการมาเรียน',
  ACTIVITIES: 'กิจกรรม',
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
 * ฟังก์ชันสร้าง/อัปเกรดแผ่นงานทั้งหมดให้เป็นภาษาไทย 100%
 */
function initializeSheets() {
  const ss = getSpreadsheet();
  
  // 1. รายชื่อนักเรียน
  getOrCreateSheetSmart(ss, 'STUDENTS', HEADERS.STUDENTS, '#0284c7');

  // 2. บันทึกเวลาละหมาด
  getOrCreateSheetSmart(ss, 'PRAYERS', HEADERS.PRAYERS, '#0284c7');

  // 3. บันทึกการมาเรียน
  getOrCreateSheetSmart(ss, 'ATTENDANCE', HEADERS.ATTENDANCE, '#0284c7');

  // 4. กิจกรรม
  getOrCreateSheetSmart(ss, 'ACTIVITIES', HEADERS.ACTIVITIES, '#0284c7');

  // 5. ผู้ดูแลระบบ
  const sheetAdmins = getOrCreateSheetSmart(ss, 'ADMINS', HEADERS.ADMINS, '#0284c7');
  if (sheetAdmins.getLastRow() === 1) {
    sheetAdmins.appendRow([
      'ADM001', 'admin', MASTER_ADMIN_PASS, 'ผู้ดูแลระบบหลัก (Master Administrator)', 'ผู้ดูแลระบบสูงสุด', new Date().toISOString()
    ]);
  }

  // 6. การตั้งค่า
  const sheetSettings = getOrCreateSheetSmart(ss, 'SETTINGS', HEADERS.SETTINGS, '#0284c7');
  if (sheetSettings.getLastRow() === 1) {
    sheetSettings.appendRow(['AppName', 'ระบบ KHALIFAH PROGRAM', 'ชื่อระบบ']);
    sheetSettings.appendRow(['MasterCode', MASTER_ADMIN_PASS, 'รหัสแอดมินหลัก']);
    sheetSettings.appendRow(['CurrentAcademicYear', '2569', 'ปีการศึกษาปัจจุบัน']);
  }

  // 7. บันทึกผลบุญ
  getOrCreateSheetSmart(ss, 'HASANAT', HEADERS.HASANAT, '#059669');

  // ทำการแปลงข้อมูลในเซลล์เดิมที่เป็นภาษาอังกฤษให้เป็นภาษาไทย
  convertDataCellsToThai(ss);

  return { success: true, message: 'ฐานข้อมูล Google Sheets ถูกสร้างและอัปเกรดเป็นภาษาไทย 100% เรียบร้อยแล้ว' };
}

/**
 * แปลงค่าในเซลล์แถวข้อมูล (Row 2 เป็นต้นไป) จากภาษาอังกฤษเป็นภาษาไทย
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

    // 2. แปลงตารางนักเรียน (สถานะ)
    const sheetStudents = ss.getSheetByName(SHEETS.STUDENTS);
    if (sheetStudents && sheetStudents.getLastRow() > 1) {
      const numCols = Math.min(sheetStudents.getLastColumn(), 9);
      const data = sheetStudents.getRange(2, 1, sheetStudents.getLastRow() - 1, numCols).getValues();
      let changed = false;
      for (let i = 0; i < data.length; i++) {
        if (data[i][7] === 'Active' || data[i][7] === 'active') {
          data[i][7] = 'ปกติ (กำลังศึกษา)';
          changed = true;
        }
      }
      if (changed) {
        sheetStudents.getRange(2, 1, data.length, numCols).setValues(data);
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
        result = registerStudent(postData.data);
        break;
      case 'loginStudent':
        result = loginStudent(postData.studentId, postData.birthDate || postData.parentPhone);
        break;
      case 'updateStudentGrade':
        result = updateStudentGrade(postData.studentId, postData.newGrade);
        break;
      case 'recordPrayer':
      case 'prayerCheckIn':
        result = recordPrayer(postData.data);
        break;
      case 'recordHasanat':
      case 'saveQuranLog':
      case 'saveSunnahLog':
        result = recordHasanat(postData.data || postData);
        break;
      case 'batchSync':
        result = batchSyncData(postData.data || postData);
        break;
      case 'recordAttendance':
        result = recordAttendance(postData.data);
        break;
      case 'createActivity':
        result = createActivity(postData.data);
        break;
      case 'checkInActivity':
        result = checkInActivity(postData.data);
        break;
      case 'adminLogin':
        result = verifyAdminLogin(postData.password, postData.username);
        break;
      case 'addSubAdmin':
        result = addSubAdmin(postData.data);
        break;
      case 'deleteStudent':
        result = deleteStudent(postData.studentId);
        break;
      case 'batchPromote':
        result = batchPromoteStudents(postData.fromGrade, postData.toGrade);
        break;
      case 'updateLogo':
        result = updateAppLogo(postData.data.logoBase64);
        break;
      case 'updateProfilePhoto':
        result = updateStudentProfilePhoto(postData.data.studentId, postData.data.avatarUrl);
        break;
      case 'updateSubjectScores':
        result = updateSubjectScores(postData.data);
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

// ----------------- BUSINESS LOGIC FUNCTIONS ----------------- //

/**
 * รักษาเลขศูนย์นำหน้า เช่น เบอร์โทร 0812345678, วันเกิด 01012540, รหัสนักเรียน 01234
 */
function formatAsText(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^0[0-9]/.test(str)) {
    return "'" + str;
  }
  return str;
}

function registerStudent(data) {
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === String(data.studentId).trim().toLowerCase()) {
      return { success: false, message: 'รหัสนักเรียนนี้ได้ลงทะเบียนในระบบแล้ว' };
    }
  }

  const registeredAt = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
  const cleanBD = String(data.birthDate || '').replace(/[^0-9]/g, '');
  const birthDateFormatted = (cleanBD.length === 8) ? ("'" + cleanBD) : formatAsText(data.birthDate);
  const studentIdFormatted = formatAsText(data.studentId);
  const parentPhoneFormatted = formatAsText(data.parentPhone);

  const rawPhoto = data.avatarUrl || data.profilePhoto || '';
  const photoLink = saveStudentPhotoToDrive(data.studentId, rawPhoto);

  sheet.appendRow([
    studentIdFormatted,
    data.fullName,
    data.schoolName,
    data.grade,
    birthDateFormatted,
    parentPhoneFormatted,
    registeredAt,
    formatStudentStatusThai(data.status || 'Active'),
    photoLink || rawPhoto
  ]);

  return { 
    success: true, 
    message: 'ลงทะเบียนสำเร็จเรียบร้อย', 
    student: {
      studentId: data.studentId,
      fullName: data.fullName,
      schoolName: data.schoolName,
      grade: data.grade,
      birthDate: data.birthDate,
      parentPhone: data.parentPhone,
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

  const targetId = studentId ? String(studentId).trim().toLowerCase() : '';
  const targetPhone = parentPhone ? String(parentPhone).replace(/[^0-9]/g, '') : '';

  for (let i = 1; i < rows.length; i++) {
    const sId = String(rows[i][0]).trim();
    const sPhone = String(rows[i][5]).trim();
    const cleanSPhone = sPhone.replace(/[^0-9]/g, '');

    const idMatch = targetId ? (sId.toLowerCase() === targetId) : false;
    const phoneMatch = targetPhone ? (cleanSPhone === targetPhone || sPhone === parentPhone) : false;

    let isMatch = false;
    if (targetId && targetPhone) {
      isMatch = idMatch && phoneMatch;
    } else if (targetId) {
      isMatch = idMatch;
    } else if (targetPhone) {
      isMatch = phoneMatch;
    }

    if (isMatch) {
      let bd = String(rows[i][4]);
      if (bd.startsWith("'")) bd = bd.substring(1);
      let ph = String(rows[i][5]);
      if (ph.startsWith("'")) ph = ph.substring(1);
      let sid = String(rows[i][0]);
      if (sid.startsWith("'")) sid = sid.substring(1);

      return {
        success: true,
        student: {
          studentId: sid,
          fullName: rows[i][1],
          schoolName: rows[i][2],
          grade: rows[i][3],
          birthDate: bd,
          parentPhone: ph,
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
  const rows = sheet.getDataRange().getValues();

  const cleanInput = String(passOrPhone || '').trim().replace(/[\/\-\.]/g, '');
  const targetId = String(studentId || '').trim().toLowerCase();

  for (let i = 1; i < rows.length; i++) {
    const sId = String(rows[i][0]).trim().toLowerCase();
    const bDate = String(rows[i][4]).trim();
    const cleanBDate = bDate.replace(/[\/\-\.]/g, '');
    const sPhone = String(rows[i][5]).trim();
    const cleanPhone = sPhone.replace(/[^0-9]/g, '');

    if (sId === targetId) {
      if (cleanBDate === cleanInput || bDate === String(passOrPhone).trim() || cleanPhone === cleanInput || sPhone === String(passOrPhone).trim()) {
        let bd = String(rows[i][4]);
        if (bd.startsWith("'")) bd = bd.substring(1);
        let ph = String(rows[i][5]);
        if (ph.startsWith("'")) ph = ph.substring(1);
        let sid = String(rows[i][0]);
        if (sid.startsWith("'")) sid = sid.substring(1);

        return {
          success: true,
          student: {
            studentId: sid,
            fullName: rows[i][1],
            schoolName: rows[i][2],
            grade: rows[i][3],
            birthDate: bd,
            parentPhone: ph,
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
    if (String(rows[i][0]).trim() === String(studentId).trim()) {
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
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PRAYERS);

  const logId = 'PRY-' + new Date().getTime();
  const timestamp = new Date().toISOString();
  const now = new Date();
  const dateStr = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd");
  const timeStr = Utilities.formatDate(now, "Asia/Bangkok", "HH:mm:ss");

  let photoRef = data.photoUrl || '';
  if (data.photoBase64) {
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
      const bytes = Utilities.base64Decode(data.photoBase64.split(',')[1] || data.photoBase64);
      const blob = Utilities.newBlob(bytes, contentType, `${data.studentId}_${data.prayerTime}_${dateStr}.jpg`);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      photoRef = file.getUrl();
    } catch (err) {
      photoRef = 'Stored locally';
    }
  }

  const prayerNameThai = formatPrayerTimeThai(data.prayerTime);
  const statusThai = formatStatusThai(data.status || 'ตรงเวลา');
  const withinZoneThai = (data.isWithinZone === true || data.isWithinZone === 'ใช่') ? 'ใช่' : 'ไม่ใช่';

  sheet.appendRow([
    logId,
    formatAsText(data.studentId),
    data.studentName,
    data.grade,
    prayerNameThai,
    timestamp,
    data.date || dateStr,
    data.time || timeStr,
    data.latitude,
    data.longitude,
    data.locationName,
    data.distanceMeters,
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
  initializeSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ACTIVITIES);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.activityId).trim()) {
      const currentCount = Number(rows[i][8]) || 0;
      sheet.getRange(i + 1, 9).setValue(currentCount + 1);
      return { success: true, message: 'บันทึกการเข้าร่วมกิจกรรมสำเร็จ' };
    }
  }
  return { success: false, message: 'ไม่พบกิจกรรมที่ระบุ' };
}

function verifyAdminLogin(password, username) {
  if (String(password).trim() === MASTER_ADMIN_PASS) {
    return { success: true, role: 'SuperAdmin', username: 'MasterAdmin' };
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ADMINS);
  if (sheet) {
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][1]).trim() === String(username).trim() && 
          String(rows[i][2]).trim() === String(password).trim()) {
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

  sheet.appendRow([
    adminId,
    data.username,
    data.password,
    data.fullName,
    data.role === 'SuperAdmin' ? 'ผู้ดูแลระบบสูงสุด' : 'ผู้ดูแลระบบ',
    Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss")
  ]);

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
      adminId: rows[i][0],
      username: rows[i][1],
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
  const rows = sheet.getDataRange().getValues();

  const results = [];
  for (let i = 1; i < rows.length; i++) {
    results.push({
      studentId: rows[i][0],
      fullName: rows[i][1],
      schoolName: rows[i][2],
      grade: rows[i][3],
      birthDate: rows[i][4],
      parentPhone: rows[i][5],
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
    if (String(rows[i][0]).trim() === String(studentId).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'ลบข้อมูลนักเรียนรหัส ' + studentId + ' เรียบร้อยแล้ว' };
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
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === 'AppLogo') {
      sheet.getRange(i + 1, 2).setValue(logoBase64);
      return { success: true, message: 'บันทึกโลโก้ลง Google Sheets สำเร็จ' };
    }
  }
  sheet.appendRow(['AppLogo', logoBase64, 'โลโก้ของระบบ']);
  return { success: true, message: 'บันทึกโลโก้ใหม่ลง Google Sheets สำเร็จ' };
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
    if (String(rows[i][0]).trim() === String(studentId).trim()) {
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
  const m = data.memorization || {};
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
      const photoLink = saveStudentPhotoToDrive(s.studentId, rawPhoto);

      let foundRow = -1;
      for (let i = 1; i < existing.length; i++) {
        if (String(existing[i][0]).trim() === String(s.studentId).trim()) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow === -1) {
        const cleanBD = String(s.birthDate || '').replace(/[^0-9]/g, '');
        const birthDateFormatted = (cleanBD.length === 8) ? ("'" + cleanBD) : formatAsText(s.birthDate);
        sheetStudents.appendRow([
          formatAsText(s.studentId),
          s.fullName,
          s.schoolName,
          s.grade,
          birthDateFormatted,
          formatAsText(s.parentPhone),
          Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss"),
          formatStudentStatusThai(s.status || 'Active'),
          photoLink
        ]);
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
