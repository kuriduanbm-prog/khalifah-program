/**
 * KHALIFAH PROGRAM - Google Apps Script Backend
 * ----------------------------------------------------
 * เชื่อมต่อกับ Google Sheets อัตโนมัติเพื่อเป็นฐานข้อมูลของระบบ
 * บันทึก: นักเรียน, เช็คชื่อมาเรียน, เช็คละหมาด 5 เวลา, กิจกรรม, ผู้ดูแลระบบ
 */

// ชื่อแผ่นงาน (Sheet Names)
const SHEETS = {
  STUDENTS: 'Students',
  PRAYERS: 'PrayerLogs',
  ATTENDANCE: 'AttendanceLogs',
  ACTIVITIES: 'Activities',
  ADMINS: 'Admins',
  SETTINGS: 'Settings'
};

const MASTER_ADMIN_PASS = '096909';

/**
 * ฟังก์ชันสร้างแผ่นงานเริ่มต้นทั้งหมดหากยังไม่มีใน Google Sheet
 */
function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Students Sheet
  let sheetStudents = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheetStudents) {
    sheetStudents = ss.insertSheet(SHEETS.STUDENTS);
    sheetStudents.appendRow([
      'StudentId', 'FullName', 'SchoolName', 'Grade', 'BirthDate', 'ParentPhone', 'RegisteredAt', 'Status'
    ]);
    sheetStudents.setFrozenRows(1);
    sheetStudents.getRange("A1:H1").setBackground("#0284c7").setFontColor("#ffffff").setFontWeight("bold");
  }

  // 2. PrayerLogs Sheet
  let sheetPrayers = ss.getSheetByName(SHEETS.PRAYERS);
  if (!sheetPrayers) {
    sheetPrayers = ss.insertSheet(SHEETS.PRAYERS);
    sheetPrayers.appendRow([
      'LogId', 'StudentId', 'StudentName', 'Grade', 'PrayerTime', 'Timestamp', 'Date', 'Time', 
      'Latitude', 'Longitude', 'LocationName', 'DistanceMeters', 'IsWithinZone', 'PhotoUrl'
    ]);
    sheetPrayers.setFrozenRows(1);
    sheetPrayers.getRange("A1:N1").setBackground("#0284c7").setFontColor("#ffffff").setFontWeight("bold");
  }

  // 3. AttendanceLogs Sheet
  let sheetAttendance = ss.getSheetByName(SHEETS.ATTENDANCE);
  if (!sheetAttendance) {
    sheetAttendance = ss.insertSheet(SHEETS.ATTENDANCE);
    sheetAttendance.appendRow([
      'LogId', 'StudentId', 'StudentName', 'Grade', 'Date', 'Time', 'Status', 'Note'
    ]);
    sheetAttendance.setFrozenRows(1);
    sheetAttendance.getRange("A1:H1").setBackground("#0284c7").setFontColor("#ffffff").setFontWeight("bold");
  }

  // 4. Activities Sheet
  let sheetActivities = ss.getSheetByName(SHEETS.ACTIVITIES);
  if (!sheetActivities) {
    sheetActivities = ss.insertSheet(SHEETS.ACTIVITIES);
    sheetActivities.appendRow([
      'ActivityId', 'Title', 'Description', 'StartDate', 'EndDate', 'Location', 'CreatedBy', 'CreatedAt', 'AttendeesCount'
    ]);
    sheetActivities.setFrozenRows(1);
    sheetActivities.getRange("A1:I1").setBackground("#0284c7").setFontColor("#ffffff").setFontWeight("bold");
  }

  // 5. Admins Sheet
  let sheetAdmins = ss.getSheetByName(SHEETS.ADMINS);
  if (!sheetAdmins) {
    sheetAdmins = ss.insertSheet(SHEETS.ADMINS);
    sheetAdmins.appendRow([
      'AdminId', 'Username', 'Password', 'FullName', 'Role', 'CreatedAt'
    ]);
    sheetAdmins.appendRow([
      'ADM001', 'admin', MASTER_ADMIN_PASS, 'Master Administrator', 'SuperAdmin', new Date().toISOString()
    ]);
    sheetAdmins.setFrozenRows(1);
    sheetAdmins.getRange("A1:F1").setBackground("#0284c7").setFontColor("#ffffff").setFontWeight("bold");
  }

  // 6. Settings Sheet
  let sheetSettings = ss.getSheetByName(SHEETS.SETTINGS);
  if (!sheetSettings) {
    sheetSettings = ss.insertSheet(SHEETS.SETTINGS);
    sheetSettings.appendRow(['Key', 'Value', 'Description']);
    sheetSettings.appendRow(['AppName', 'Khalifah Program', 'ชื่อระบบ']);
    sheetSettings.appendRow(['MasterCode', MASTER_ADMIN_PASS, 'รหัสแอดมินหลัก']);
    sheetSettings.appendRow(['CurrentAcademicYear', '2569', 'ปีการศึกษาปัจจุบัน']);
    sheetSettings.setFrozenRows(1);
    sheetSettings.getRange("A1:C1").setBackground("#0284c7").setFontColor("#ffffff").setFontWeight("bold");
  }

  return { success: true, message: 'ฐานข้อมูล Google Sheets ถูกสร้างและพร้อมใช้งานเรียบร้อยแล้ว' };
}

/**
 * Handle GET Requests
 */
function doGet(e) {
  // หากไม่มี parameter ให้แสดงผล HTML หรือตอบกลับสถานะ
  const action = e.parameter.action;
  
  if (!action) {
    // ให้สามารถแสดงหน้าเว็บหลักได้เลยถ้าอัปโหลด index.html ร่วมใน Apps Script
    try {
      return HtmlService.createTemplateFromFile('index')
        .evaluate()
        .setTitle('Khalifah Program - ระบบเช็คชื่อ ละหมาด และกิจกรรม')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'online',
        service: 'Khalifah Program API',
        message: 'Google Apps Script Backend พร้อมทำงาน',
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  let result = {};

  try {
    switch (action) {
      case 'init':
        result = initializeSheets();
        break;
      case 'getStudent':
        result = getStudent(e.parameter.studentId);
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

/**
 * Handle POST Requests
 */
function doPost(e) {
  let result = {};
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    switch (action) {
      case 'registerStudent':
        result = registerStudent(postData.data);
        break;
      case 'loginStudent':
        result = loginStudent(postData.studentId, postData.birthDate);
        break;
      case 'updateStudentGrade':
        result = updateStudentGrade(postData.studentId, postData.newGrade);
        break;
      case 'recordPrayer':
        result = recordPrayer(postData.data);
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
      default:
        result = { success: false, error: 'Invalid POST action' };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ----------------- BUSINESS LOGIC FUNCTIONS ----------------- //

function registerStudent(data) {
  initializeSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  const rows = sheet.getDataRange().getValues();

  // ตรวจสอบว่ามีรหัสนักเรียนนี้อยู่แล้วหรือไม่ (1 คน 1 สิทธิ์)
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.studentId).trim()) {
      return { success: false, message: 'รหัสนักเรียนนี้ได้ลงทะเบียนในระบบแล้ว ไม่สามารถสมัครซ้ำได้' };
    }
  }

  const registeredAt = new Date().toISOString();
  sheet.appendRow([
    data.studentId,
    data.fullName,
    data.schoolName,
    data.grade,
    data.birthDate,
    data.parentPhone,
    registeredAt,
    'Active'
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
      parentPhone: data.parentPhone
    }
  };
}

function loginStudent(studentId, birthDate) {
  initializeSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const sId = String(rows[i][0]).trim();
    const bDate = String(rows[i][4]).trim();
    
    // ตรงกับรหัสนักเรียน และรหัสผ่านวันเดือนปีเกิด
    if (sId === String(studentId).trim()) {
      // เทียบวันเดือนปีเกิด (อาจเป็น yyyy-mm-dd หรือ dd/mm/yyyy)
      const cleanBDate = bDate.replace(/[\/\-\.]/g, '');
      const cleanInput = String(birthDate).trim().replace(/[\/\-\.]/g, '');

      if (cleanBDate === cleanInput || bDate === String(birthDate).trim()) {
        return {
          success: true,
          student: {
            studentId: rows[i][0],
            fullName: rows[i][1],
            schoolName: rows[i][2],
            grade: rows[i][3],
            birthDate: rows[i][4],
            parentPhone: rows[i][5]
          }
        };
      } else {
        return { success: false, message: 'วันเดือนปีเกิด (รหัสผ่าน) ไม่ถูกต้อง' };
      }
    }
  }

  return { success: false, message: 'ไม่พบรหัสนักเรียนในระบบ กรุณาลงทะเบียนก่อนใช้งาน' };
}

function updateStudentGrade(studentId, newGrade) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

function recordPrayer(data) {
  initializeSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PRAYERS);

  const logId = 'PRY-' + new Date().getTime();
  const timestamp = new Date().toISOString();
  const now = new Date();
  const dateStr = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd");
  const timeStr = Utilities.formatDate(now, "Asia/Bangkok", "HH:mm:ss");

  // ตรวจสอบรูปภาพ: หากมี base64 photo สามารถบันทึกลง Google Drive หรือเก็บ Data URI สั้น
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

  sheet.appendRow([
    logId,
    data.studentId,
    data.studentName,
    data.grade,
    data.prayerTime,
    timestamp,
    dateStr,
    timeStr,
    data.latitude,
    data.longitude,
    data.locationName,
    data.distanceMeters,
    data.isWithinZone ? 'ใช่' : 'ไม่ใช่',
    photoRef
  ]);

  return { success: true, message: 'บันทึกการละหมาดเวลา ' + data.prayerTime + ' สำเร็จแล้ว', logId: logId, photoUrl: photoRef };
}

function getPrayers(studentId, date) {
  initializeSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
        photoUrl: rows[i][13]
      });
    }
  }
  return { success: true, data: results };
}

function createActivity(data) {
  initializeSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
    new Date().toISOString(),
    0
  ]);

  return { success: true, message: 'ประกาศกิจกรรมใหม่เรียบร้อยแล้ว', activityId: actId };
}

function getActivities() {
  initializeSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

function verifyAdminLogin(password, username) {
  // ตรวจสอบ Master Passcode 096909
  if (String(password).trim() === MASTER_ADMIN_PASS) {
    return { success: true, role: 'SuperAdmin', username: 'MasterAdmin' };
  }

  // ตรวจสอบแอดมินรอง
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ADMINS);
  const adminId = 'ADM-' + new Date().getTime();

  sheet.appendRow([
    adminId,
    data.username,
    data.password,
    data.fullName,
    data.role || 'SubAdmin',
    new Date().toISOString()
  ]);

  return { success: true, message: 'เพิ่มผู้ดูแลระบบรองสำเร็จ' };
}

function getSubAdmins() {
  initializeSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
      status: rows[i][7]
    });
  }
  return { success: true, data: results };
}

function deleteStudent(studentId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

function updateStudentProfilePhoto(studentId, avatarUrl) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานนักเรียน' };
  const rows = sheet.getDataRange().getValues();
  if (rows[0].length < 9) {
    sheet.getRange(1, 9).setValue('ProfilePhoto');
  }
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(studentId).trim()) {
      sheet.getRange(i + 1, 9).setValue(avatarUrl);
      return { success: true, message: 'บันทึกรูปโปรไฟล์นักเรียนใน Google Sheets สำเร็จ' };
    }
  }
  return { success: false, message: 'ไม่พบรหัสนักเรียนในระบบ' };
}


