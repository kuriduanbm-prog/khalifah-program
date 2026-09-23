/**
 * KHALIFAH PROGRAM - Application Logic
 * ----------------------------------------------------
 * ระบบบันทึกการมาเรียน ละหมาด 5 เวลา (Geofence + In-App Live Camera) และกิจกรรม
 */

// ----------------- พิกัดเป้าหมาย (GEOFENCE TARGETS) ----------------- //
const GEOFENCE_TARGETS = {
  MOSQUE: {
    name: 'มัสยิดอัลฮารอมัยน์ มหาวิทยาลัยฟาฏอนี',
    lat: 6.59672012361964,
    lng: 101.34435959075795,
    radius: 18 // เมตร
  },
  SCIENCE_FACULTY: {
    name: 'คณะวิทยาศาสตร์และเทคโนโลยี',
    lat: 6.595447179117194,
    lng: 101.34457407757654,
    radius: 40 // เมตร
  }
};

const MASTER_ADMIN_PASS = '096909';

// ----------------- ข้อมูลเริ่มต้น (INITIAL STATE & MOCK DATA) ----------------- //
const DEFAULT_STUDENT = {
  studentId: 'STD-256901',
  fullName: 'นายมูฮัมหมัด ซอและห์',
  schoolName: 'โรงเรียนสาธิต มหาวิทยาลัยฟาฏอนี',
  grade: 'มัธยมศึกษาปีที่ 5',
  birthDate: '15/08/2552',
  parentPhone: '081-234-5678',
  status: 'Active',
  skills: {
    religious: 92,   // ด้านศาสนาและจริยธรรม
    science: 85,     // ด้านวิทยาศาสตร์
    math: 78,        // ด้านคณิตศาสตร์
    language: 88,    // ด้านภาษาและการสื่อสาร
    social: 90,      // ด้านสังคมและวัฒนธรรม
    tech: 95         // ด้านเทคโนโลยีและนวัตกรรม
  },
  gpa: '3.85',
  attendance: {
    present: 42,
    late: 2,
    leave: 1,
    absent: 0
  }
};

const SAMPLE_ACTIVITIES = [
  {
    activityId: 'ACT-101',
    title: 'กิจกรรมค่ายวิชาการและคุณธรรม ประจำปี 2569',
    description: 'พัฒนาศักยภาพผู้เรียนสู่ความเป็นเลิศทั้งด้านวิชาการและจริยธรรมอิสลาม',
    startDate: '2026-09-25T08:30',
    endDate: '2026-09-25T16:30',
    location: 'หอประชุมใหญ่ มหาวิทยาลัยฟาฏอนี',
    createdBy: 'Admin',
    status: 'Active',
    checkedIn: false
  },
  {
    activityId: 'ACT-102',
    title: 'อบรมพัฒนาทักษะการใช้เทคโนโลยี AI เพื่อการศึกษา',
    description: 'การประยุกต์ใช้ปัญญาประดิษฐ์ในการเรียนรู้และการทำงานอย่างมีคุณธรรม',
    startDate: '2026-10-02T09:00',
    endDate: '2026-10-02T12:00',
    location: 'ห้องประชุมคณะวิทยาศาสตร์และเทคโนโลยี',
    createdBy: 'Admin',
    status: 'Upcoming',
    checkedIn: false
  }
];

// ----------------- APP STATE ----------------- //
let currentStudent = null;
let currentAdmin = null;
let allStudents = [];
let activities = [];
let todayPrayers = [];
let subAdmins = [];

// Geolocation & Camera State
let verifiedLocation = null;
let selectedPrayerTime = null;
let activeCameraStream = null;
let currentFacingMode = 'user'; // 'user' (กล้องหน้า) หรือ 'environment' (กล้องหลัง)

// Charts instances
let skillChartInstance = null;
let attendanceChartInstance = null;
let prayerChartInstance = null;
let activityChartInstance = null;

// Google Apps Script API URL
let gasApiUrl = localStorage.getItem('khalifah_gas_url') || '';

// ----------------- INITIALIZATION ----------------- //
document.addEventListener('DOMContentLoaded', () => {
  loadStoredData();
  setupEventListeners();
  renderCurrentStudentProfile();
  renderDashboardCharts();
  renderActivitiesList();
  renderTodayPrayerTable();
  initExportDateDefaults();
});

function loadStoredData() {
  // Load current student
  const savedStudent = localStorage.getItem('khalifah_current_student');
  if (savedStudent) {
    try {
      currentStudent = JSON.parse(savedStudent);
    } catch (e) {
      currentStudent = DEFAULT_STUDENT;
    }
  } else {
    currentStudent = DEFAULT_STUDENT;
    localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
  }

  // Load all students
  const savedAllStudents = localStorage.getItem('khalifah_all_students');
  if (savedAllStudents) {
    try {
      allStudents = JSON.parse(savedAllStudents);
    } catch (e) {
      allStudents = [DEFAULT_STUDENT];
    }
  } else {
    allStudents = [
      DEFAULT_STUDENT,
      {
        studentId: 'STD-256902',
        fullName: 'นางสาวฟาตีมะห์ ดาโอ๊ะ',
        schoolName: 'โรงเรียนสาธิต มหาวิทยาลัยฟาฏอนี',
        grade: 'มัธยมศึกษาปีที่ 5',
        birthDate: '20/05/2552',
        parentPhone: '089-876-5432',
        status: 'Active',
        skills: { religious: 95, science: 88, math: 82, language: 91, social: 89, tech: 86 },
        gpa: '3.90',
        attendance: { present: 44, late: 1, leave: 0, absent: 0 }
      },
      {
        studentId: 'STD-256903',
        fullName: 'นายอับดุลเลาะห์ ยามา',
        schoolName: 'โรงเรียนสาธิต มหาวิทยาลัยฟาฏอนี',
        grade: 'มัธยมศึกษาปีที่ 4',
        birthDate: '10/11/2553',
        parentPhone: '082-345-6789',
        status: 'Active',
        skills: { religious: 88, science: 79, math: 85, language: 80, social: 85, tech: 90 },
        gpa: '3.65',
        attendance: { present: 40, late: 3, leave: 2, absent: 0 }
      }
    ];
    localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
  }

  // Load activities
  const savedActs = localStorage.getItem('khalifah_activities');
  if (savedActs) {
    try {
      activities = JSON.parse(savedActs);
    } catch (e) {
      activities = SAMPLE_ACTIVITIES;
    }
  } else {
    activities = SAMPLE_ACTIVITIES;
    localStorage.setItem('khalifah_activities', JSON.stringify(activities));
  }

  // Load today prayers
  const savedPrayers = localStorage.getItem('khalifah_today_prayers');
  if (savedPrayers) {
    try {
      todayPrayers = JSON.parse(savedPrayers);
    } catch (e) {
      todayPrayers = [];
    }
  }

  // Load Sub-admins
  const savedSubAdmins = localStorage.getItem('khalifah_sub_admins');
  if (savedSubAdmins) {
    try {
      subAdmins = JSON.parse(savedSubAdmins);
    } catch (e) {
      subAdmins = [];
    }
  } else {
    subAdmins = [
      {
        username: 'teacher_hasan',
        fullName: 'อาจารย์ฮะซัน สมาน',
        role: 'TeacherAdmin',
        createdAt: '2026-09-01'
      }
    ];
    localStorage.setItem('khalifah_sub_admins', JSON.stringify(subAdmins));
  }

  // Set input gas URL if present
  const gasInput = document.getElementById('gasApiUrlInput');
  if (gasInput && gasApiUrl) {
    gasInput.value = gasApiUrl;
  }
}

function setupEventListeners() {
  // Any specific global event handlers
}

// ----------------- VIEW ROUTING ----------------- //
function switchView(viewName) {
  // If attempting to switch to admin and not authenticated, show passcode modal
  if (viewName === 'admin' && !currentAdmin) {
    openModal('adminAuthModal');
    return;
  }

  // Update tabs active state
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));

  const targetSection = document.getElementById(`view-${viewName}`);
  if (targetSection) targetSection.classList.add('active');

  const navItem = document.getElementById(`nav-${viewName}`);
  if (navItem) navItem.classList.add('active');

  const mNavItem = document.getElementById(`m-nav-${viewName}`);
  if (mNavItem) mNavItem.classList.add('active');

  // Trigger specific view setups
  if (viewName === 'dashboard') {
    renderDashboardCharts();
  } else if (viewName === 'admin') {
    renderAdminStudentsTable();
    renderSubAdminsTable();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ----------------- HAVERSINE FORMULA & GEOFENCING ----------------- //

/**
 * คำนวณระยะห่างระหว่าง 2 พิกัดเป็นเมตร ด้วย Haversine Formula
 */
function calculateDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // รัศมีโลกเป็นเมตร
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // ระยะทางเป็นเมตร
}

/**
 * ฟังก์ชันตรวจสอบตำแหน่งปัจจุบัน (Geofencing) และตรวจจับการปลอมแปลงพิกัด
 */
function verifyGeolocation() {
  const statusBox = document.getElementById('geofenceStatusBox');
  const statusTitle = document.getElementById('geoStatusTitle');
  const statusDesc = document.getElementById('geoStatusDesc');
  const detailsDiv = document.getElementById('geoDetails');

  if (!navigator.geolocation) {
    showToast('อุปกรณ์ของคุณไม่รองรับการระบุพิกัด GPS', 'error');
    return;
  }

  statusTitle.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบพิกัดความถูกต้อง...';
  statusDesc.innerText = 'กำลังคำนวณตำแหน่งผ่านสัญญาณดาวเทียม GPS กรุณารอสักครู่';

  const geoOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  };

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      // ตรวจจับ Fake GPS เบื้องต้น
      let isMockSuspected = false;
      if (accuracy > 150) {
        // ค่าความคลาดเคลื่อนสูงผิดปกติ
        isMockSuspected = true;
      }

      // คำนวณระยะห่างจากเป้าหมายทั้ง 2 แห่ง
      const distMosque = calculateDistanceInMeters(
        userLat, userLng,
        GEOFENCE_TARGETS.MOSQUE.lat, GEOFENCE_TARGETS.MOSQUE.lng
      );

      const distScience = calculateDistanceInMeters(
        userLat, userLng,
        GEOFENCE_TARGETS.SCIENCE_FACULTY.lat, GEOFENCE_TARGETS.SCIENCE_FACULTY.lng
      );

      let locationName = '';
      let isWithinZone = false;
      let minDistance = 0;

      if (distMosque <= GEOFENCE_TARGETS.MOSQUE.radius) {
        // อยู่ในเขตมัสยิดอัลฮารอมัยน์ 18 เมตร
        locationName = GEOFENCE_TARGETS.MOSQUE.name;
        isWithinZone = true;
        minDistance = Math.round(distMosque);
      } else if (distScience <= GEOFENCE_TARGETS.SCIENCE_FACULTY.radius) {
        // อยู่ในเขตคณะวิทยาศาสตร์และเทคโนโลยี 40 เมตร
        locationName = GEOFENCE_TARGETS.SCIENCE_FACULTY.name;
        isWithinZone = true;
        minDistance = Math.round(distScience);
      } else {
        // อยู่นอกระยะทั้ง 2 จุด
        isWithinZone = false;
        if (distMosque < distScience) {
          minDistance = Math.round(distMosque);
          locationName = `ห่างจาก${GEOFENCE_TARGETS.MOSQUE.name} ${formatDistance(minDistance)}`;
        } else {
          minDistance = Math.round(distScience);
          locationName = `ห่างจาก${GEOFENCE_TARGETS.SCIENCE_FACULTY.name} ${formatDistance(minDistance)}`;
        }
      }

      verifiedLocation = {
        lat: userLat,
        lng: userLng,
        accuracy: accuracy,
        locationName: locationName,
        isWithinZone: isWithinZone,
        distanceMeters: minDistance,
        timestamp: new Date().toISOString()
      };

      // แสดงผล UI
      statusBox.classList.remove('unverified', 'within', 'outside');
      if (isWithinZone) {
        statusBox.classList.add('within');
        statusTitle.innerHTML = `<i class="fa-solid fa-circle-check"></i> ยืนยันพิกัดถูกต้อง: อยู่ ณ ${locationName}`;
        statusDesc.innerText = `พิกัดตรงตามจุดที่กำหนด (ความคลาดเคลื่อน ±${Math.round(accuracy)} ม.) อนุญาตให้เช็คชื่อได้`;
      } else {
        statusBox.classList.add('outside');
        statusTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> อยู่นอกพื้นที่ที่กำหนด`;
        statusDesc.innerText = `ตรวจพบว่าท่านอยู่: ${locationName} (อยู่นอกรัศมีที่อนุญาต)`;
      }

      detailsDiv.style.display = 'block';
      detailsDiv.innerHTML = `พิกัดปัจจุบัน: ${userLat.toFixed(6)}, ${userLng.toFixed(6)} | แม่นยำ: ±${Math.round(accuracy)}ม. ${isMockSuspected ? '⚠️ กรุณาปิด Mock Location' : '✓ ตรวจสอบผ่าน'}`;

      showToast(`ระบุพิกัดสำเร็จ: ${isWithinZone ? 'อยู่ในพื้นที่' : 'อยู่นอกพื้นที่'}`, isWithinZone ? 'success' : 'warning');
      checkPrayerUnlockState();
    },
    (error) => {
      statusTitle.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ไม่สามารถเข้าถึงพิกัด GPS ได้';
      statusDesc.innerText = 'กรุณาอนุญาตให้เบราว์เซอร์เข้าถึง Location/GPS บนอุปกรณ์ของท่าน';
      showToast('ไม่สามารถดึงพิกัดได้: ' + error.message, 'error');
    },
    geoOptions
  );
}

function formatDistance(meters) {
  if (meters >= 1000) {
    return (meters / 1000).toFixed(2) + ' กิโลเมตร';
  }
  return meters + ' เมตร';
}

// ----------------- PRAYER CHECK-IN LOGIC ----------------- //

function selectPrayerTime(timeName, element) {
  selectedPrayerTime = timeName;

  document.querySelectorAll('.prayer-time-card').forEach(el => el.classList.remove('selected'));
  if (element) element.classList.add('selected');

  checkPrayerUnlockState();
}

function checkPrayerUnlockState() {
  const btnStartCamera = document.getElementById('btnStartCamera');
  const cameraPlaceholder = document.getElementById('cameraPlaceholder');

  if (verifiedLocation && selectedPrayerTime) {
    btnStartCamera.disabled = false;
    cameraPlaceholder.querySelector('div:last-child').innerText = `พร้อมแล้ว! กดปุ่ม "เปิดกล้องสด" เพื่อบันทึกการละหมาดเวลา ${selectedPrayerTime}`;
  } else {
    btnStartCamera.disabled = true;
  }
}

/**
 * เปิดกล้องสด In-App Live Camera Stream (Strictly getUserMedia, no gallery pickers)
 */
async function initLiveCamera() {
  const video = document.getElementById('cameraStream');
  const placeholder = document.getElementById('cameraPlaceholder');
  const btnCapture = document.getElementById('btnCapture');
  const btnSwitch = document.getElementById('btnSwitchCamera');
  const overlay = document.getElementById('cameraOverlayInfo');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('เบราว์เซอร์ของคุณไม่รองรับกล้องสตรีมสด', 'error');
    return;
  }

  // ปิด stream เก่าถ้ามี
  if (activeCameraStream) {
    activeCameraStream.getTracks().forEach(track => track.stop());
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: currentFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    activeCameraStream = stream;
    video.srcObject = stream;
    video.style.display = 'block';
    placeholder.style.display = 'none';
    btnCapture.disabled = false;
    btnSwitch.style.display = 'inline-flex';
    overlay.style.display = 'block';

    updateCameraOverlayText();
    showToast('เปิดกล้องสดเรียบร้อยแล้ว กรุณากดถ่ายภาพ', 'success');
  } catch (err) {
    showToast('ไม่สามารถเปิดกล้องได้: ' + err.message, 'error');
  }
}

function switchCameraFacing() {
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  initLiveCamera();
}

function updateCameraOverlayText() {
  const overlayStudent = document.getElementById('camOverlayStudent');
  const overlayPrayer = document.getElementById('camOverlayPrayer');
  const overlayLocation = document.getElementById('camOverlayLocation');
  const overlayDateTime = document.getElementById('camOverlayDateTime');

  if (currentStudent) {
    overlayStudent.innerText = `นักเรียน: ${currentStudent.fullName} (${currentStudent.studentId})`;
  }
  overlayPrayer.innerText = `เวลาละหมาด: ${selectedPrayerTime || '-'}`;
  if (verifiedLocation) {
    overlayLocation.innerText = `สถานที่: ${verifiedLocation.locationName} (${verifiedLocation.isWithinZone ? 'ในเขต' : 'นอกระยะ'})`;
  }
  const now = new Date();
  overlayDateTime.innerText = `วัน-เวลา: ${now.toLocaleDateString('th-TH')} ${now.toLocaleTimeString('th-TH')}`;
}

/**
 * บันทึกภาพพร้อมปั๊มลายน้ำ (Canvas Watermark) และบันทึกลงระบบทันที
 */
function captureAndRecordPrayer() {
  const video = document.getElementById('cameraStream');
  const canvas = document.getElementById('snapshotCanvas');

  if (!video || !video.videoWidth) {
    showToast('กล้องยังไม่พร้อมใช้งาน', 'error');
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');

  // วาดภาพจากกล้อง
  if (currentFacingMode === 'user') {
    // กลับด้านภาพให้อ่านตัวหนังสือถูกทิศ
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
  } else {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  // ปั๊มลายน้ำ (Watermark Overlay)
  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('th-TH');

  // แถบดำกึ่งโปร่งใสด้านล่าง
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  const boxHeight = 110;
  ctx.fillRect(0, canvas.height - boxHeight, canvas.width, boxHeight);

  // ข้อมูลตัวอักษร
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Kanit, sans-serif';
  ctx.fillText(`KHALIFAH PROGRAM • เช็คละหมาด: เวลา ${selectedPrayerTime}`, 20, canvas.height - boxHeight + 30);

  ctx.font = '16px Kanit, sans-serif';
  ctx.fillText(`นักเรียน: ${currentStudent.fullName} (${currentStudent.studentId}) | ระดับชั้น: ${currentStudent.grade}`, 20, canvas.height - boxHeight + 58);

  const locText = `พิกัด: ${verifiedLocation.lat.toFixed(5)}, ${verifiedLocation.lng.toFixed(5)} [${verifiedLocation.locationName}] • ${dateStr} ${timeStr}`;
  ctx.fillText(locText, 20, canvas.height - boxHeight + 86);

  // แถบสีสถานะขวามือ
  ctx.fillStyle = verifiedLocation.isWithinZone ? '#10b981' : '#f59e0b';
  ctx.fillRect(canvas.width - 200, canvas.height - boxHeight + 20, 180, 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px Kanit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(verifiedLocation.isWithinZone ? '✓ ในพื้นที่กำหนด' : '⚠️ นอกพื้นที่กำหนด', canvas.width - 110, canvas.height - boxHeight + 46);
  ctx.textAlign = 'start';

  // แปลงภาพเป็น Base64
  const photoBase64 = canvas.toDataURL('image/jpeg', 0.8);

  // สร้าง Object ข้อมูลการบันทึก
  const prayerRecord = {
    logId: 'PRY-' + Date.now(),
    studentId: currentStudent.studentId,
    studentName: currentStudent.fullName,
    grade: currentStudent.grade,
    prayerTime: selectedPrayerTime,
    timestamp: now.toISOString(),
    date: now.toISOString().split('T')[0],
    time: timeStr,
    latitude: verifiedLocation.lat,
    longitude: verifiedLocation.lng,
    locationName: verifiedLocation.locationName,
    distanceMeters: verifiedLocation.distanceMeters,
    isWithinZone: verifiedLocation.isWithinZone,
    photoUrl: photoBase64
  };

  // บันทึกลง Local State
  todayPrayers.unshift(prayerRecord);
  localStorage.setItem('khalifah_today_prayers', JSON.stringify(todayPrayers));

  // ปิดกล้องสด
  if (activeCameraStream) {
    activeCameraStream.getTracks().forEach(track => track.stop());
    activeCameraStream = null;
  }
  video.style.display = 'none';
  document.getElementById('cameraPlaceholder').style.display = 'block';
  document.getElementById('btnCapture').disabled = true;
  document.getElementById('btnStartCamera').disabled = true;

  // อัปเดต UI หน้าเช็คละหมาด
  const prayerCard = document.getElementById(`ptime-${selectedPrayerTime}`);
  if (prayerCard) {
    prayerCard.classList.add('done');
    const statusSpan = document.getElementById(`pstatus-${selectedPrayerTime}`);
    if (statusSpan) statusSpan.innerText = '✓ เช็คแล้ว';
  }

  renderTodayPrayerTable();
  renderDashboardCharts();

  // ส่งข้อมูลไปยัง Google Apps Script Backend (หากตั้งค่าไว้)
  syncRecordToGoogleSheet('recordPrayer', prayerRecord);

  showToast(`บันทึกการละหมาดเวลา ${selectedPrayerTime} เรียบร้อยแล้ว`, 'success');
}

function renderTodayPrayerTable() {
  const tbody = document.getElementById('todayPrayerTableBody');
  if (!tbody) return;

  if (todayPrayers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
          ยังไม่มีประวัติการละหมาดวันนี้
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = todayPrayers.map(p => `
    <tr>
      <td><b>${p.prayerTime}</b></td>
      <td>${p.time}</td>
      <td>${p.locationName}</td>
      <td>
        <span class="activity-badge ${p.isWithinZone ? 'badge-active' : 'badge-upcoming'}">
          ${p.isWithinZone ? '✓ ในเขต' : 'นอกระยะ'}
        </span>
      </td>
      <td>
        <button class="btn btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.78rem;" onclick="viewPrayerPhoto('${p.logId}')">
          <i class="fa-solid fa-image"></i> ดูรูป
        </button>
      </td>
    </tr>
  `).join('');
}

function viewPrayerPhoto(logId) {
  const record = todayPrayers.find(p => p.logId === logId);
  if (!record || !record.photoUrl) return;

  const w = window.open('');
  w.document.write(`<img src="${record.photoUrl}" style="max-width:100%; height:auto; display:block; margin:auto;" />`);
}

// ----------------- ACTIVITIES ----------------- //

function renderActivitiesList() {
  const container = document.getElementById('activitiesListContainer');
  if (!container) return;

  if (activities.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; color: var(--text-muted); padding: 2rem;">
        ขณะนี้ยังไม่มีกิจกรรมที่ประกาศ
      </div>
    `;
    return;
  }

  container.innerHTML = activities.map(act => `
    <div class="activity-card">
      <div style="flex: 1;">
        <span class="activity-badge ${act.status === 'Active' ? 'badge-active' : 'badge-upcoming'}">
          ${act.status === 'Active' ? 'กำลังเปิดรับเช็คชื่อ' : 'เร็วๆ นี้'}
        </span>
        <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-dark);">${act.title}</h3>
        <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0.35rem 0;">${act.description}</p>
        <div style="font-size: 0.82rem; color: var(--text-body); display: flex; gap: 1rem; flex-wrap: wrap;">
          <span><i class="fa-regular fa-clock" style="color: var(--primary);"></i> ${formatDateTime(act.startDate)} - ${formatDateTime(act.endDate)}</span>
          <span><i class="fa-solid fa-location-dot" style="color: var(--primary);"></i> ${act.location}</span>
        </div>
      </div>
      <div>
        <button class="btn ${act.checkedIn ? 'btn-secondary' : 'btn-primary'}" onclick="checkInActivity('${act.activityId}')" ${act.checkedIn ? 'disabled' : ''}>
          <i class="fa-solid ${act.checkedIn ? 'fa-circle-check' : 'fa-check'}"></i> 
          ${act.checkedIn ? 'เช็คชื่อแล้ว' : 'กดเช็คชื่อเข้าร่วม'}
        </button>
      </div>
    </div>
  `).join('');
}

function checkInActivity(actId) {
  const act = activities.find(a => a.activityId === actId);
  if (!act) return;

  act.checkedIn = true;
  localStorage.setItem('khalifah_activities', JSON.stringify(activities));
  renderActivitiesList();
  renderDashboardCharts();

  syncRecordToGoogleSheet('checkInActivity', {
    activityId: actId,
    studentId: currentStudent.studentId,
    studentName: currentStudent.fullName
  });

  showToast(`เช็คชื่อเข้าร่วมกิจกรรม "${act.title}" สำเร็จ`, 'success');
}

// ----------------- CHARTS & ANALYTICS ----------------- //

function renderDashboardCharts() {
  renderSkillRadarChart();
  renderAttendanceDoughnutChart();
  renderPrayerBarChart();
  renderActivityPieChart();
}

function renderSkillRadarChart() {
  const ctx = document.getElementById('skillRadarChart');
  if (!ctx) return;

  if (skillChartInstance) skillChartInstance.destroy();

  const skills = currentStudent.skills || DEFAULT_STUDENT.skills;

  skillChartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: [
        'ศาสนาและจริยธรรม',
        'วิทยาศาสตร์',
        'คณิตศาสตร์',
        'ภาษาและการสื่อสาร',
        'สังคมและวัฒนธรรม',
        'เทคโนโลยีและนวัตกรรม'
      ],
      datasets: [{
        label: 'ระดับสมรรถนะทักษะ (คะแนนเต็ม 100)',
        data: [
          skills.religious,
          skills.science,
          skills.math,
          skills.language,
          skills.social,
          skills.tech
        ],
        backgroundColor: 'rgba(2, 132, 199, 0.2)',
        borderColor: '#0284c7',
        borderWidth: 2.5,
        pointBackgroundColor: '#0369a1',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#0369a1',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { stepSize: 20, display: false },
          pointLabels: {
            font: { family: 'Kanit', size: 12, weight: '500' },
            color: '#334155'
          },
          grid: { color: 'rgba(226, 232, 240, 0.8)' },
          angleLines: { color: 'rgba(226, 232, 240, 0.8)' }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderAttendanceDoughnutChart() {
  const ctx = document.getElementById('attendanceDoughnutChart');
  if (!ctx) return;

  if (attendanceChartInstance) attendanceChartInstance.destroy();

  const att = currentStudent.attendance || DEFAULT_STUDENT.attendance;

  attendanceChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['มาเรียน', 'มาสาย', 'ลา', 'ขาด'],
      datasets: [{
        data: [att.present, att.late, att.leave, att.absent],
        backgroundColor: [
          '#10b981', // เขียว - มาเรียน
          '#f59e0b', // ส้ม - มาสาย
          '#0284c7', // ฟ้า - ลา
          '#ef4444'  // แดง - ขาด
        ],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Kanit', size: 12 }, padding: 14 }
        }
      }
    }
  });
}

function renderPrayerBarChart() {
  const ctx = document.getElementById('prayerBarChart');
  if (!ctx) return;

  if (prayerChartInstance) prayerChartInstance.destroy();

  prayerChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'],
      datasets: [{
        label: 'จำนวนเวลาที่ละหมาด (เต็ม 5)',
        data: [5, 4, 5, 5, 5, 4, 5],
        backgroundColor: '#0284c7',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 5,
          ticks: { stepSize: 1, font: { family: 'Kanit' } }
        },
        x: {
          ticks: { font: { family: 'Kanit' } }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderActivityPieChart() {
  const ctx = document.getElementById('activityPieChart');
  if (!ctx) return;

  if (activityChartInstance) activityChartInstance.destroy();

  activityChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['เข้าร่วมแล้ว', 'ยังไม่เข้าร่วม'],
      datasets: [{
        data: [8, 2],
        backgroundColor: ['#9333ea', '#e2e8f0'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Kanit', size: 12 } }
        }
      }
    }
  });
}

// ----------------- PROFILE & GRADE PROMOTION ----------------- //

function renderCurrentStudentProfile() {
  if (!currentStudent) return;

  // Header Elements
  const headerName = document.getElementById('headerUserName');
  const headerRole = document.getElementById('headerUserRole');
  const headerAvatar = document.getElementById('userAvatarText');

  if (headerName) headerName.innerText = currentStudent.fullName;
  if (headerRole) headerRole.innerText = currentStudent.grade;
  if (headerAvatar) headerAvatar.innerText = currentStudent.fullName.charAt(currentStudent.fullName.startsWith('นาย') ? 3 : (currentStudent.fullName.startsWith('นางสาว') ? 6 : 0));

  // Dashboard Banner Elements
  const dashStudentId = document.getElementById('dashStudentId');
  const dashGrade = document.getElementById('dashGrade');
  const dashSchool = document.getElementById('dashSchoolName');
  if (dashStudentId) dashStudentId.innerText = currentStudent.studentId;
  if (dashGrade) dashGrade.innerText = currentStudent.grade;
  if (dashSchool) dashSchool.innerText = currentStudent.schoolName;

  // Profile View Elements
  const profFullName = document.getElementById('profFullName');
  const profSchool = document.getElementById('profSchool');
  const profGradeBadge = document.getElementById('profGradeBadge');
  const profStudentId = document.getElementById('profStudentId');
  const profBirthDate = document.getElementById('profBirthDate');
  const profParentPhone = document.getElementById('profParentPhone');
  const profAvatar = document.getElementById('profAvatar');
  const selectNewGrade = document.getElementById('selectNewGrade');

  if (profFullName) profFullName.innerText = currentStudent.fullName;
  if (profSchool) profSchool.innerText = currentStudent.schoolName;
  if (profGradeBadge) profGradeBadge.innerText = currentStudent.grade;
  if (profStudentId) profStudentId.innerText = currentStudent.studentId;
  if (profBirthDate) profBirthDate.innerText = currentStudent.birthDate;
  if (profParentPhone) profParentPhone.innerText = currentStudent.parentPhone;
  if (profAvatar) profAvatar.innerText = headerAvatar ? headerAvatar.innerText : 'น';
  if (selectNewGrade) selectNewGrade.value = currentStudent.grade;
}

/**
 * อัปเดตข้อมูล / เลื่อนชั้นปีการศึกษา (ฝั่งนักเรียน ม.5 -> ม.6)
 */
function updateStudentGrade() {
  const select = document.getElementById('selectNewGrade');
  if (!select) return;

  const newGrade = select.value;
  if (newGrade === currentStudent.grade) {
    showToast('ระดับชั้นเป็น ' + newGrade + ' อยู่แล้ว', 'warning');
    return;
  }

  currentStudent.grade = newGrade;
  localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));

  // อัปเดตใน list รวมด้วย
  const idx = allStudents.findIndex(s => s.studentId === currentStudent.studentId);
  if (idx !== -1) {
    allStudents[idx].grade = newGrade;
    localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
  }

  renderCurrentStudentProfile();
  showToast('เลื่อนระดับชั้นเป็น ' + newGrade + ' สำเร็จแล้ว!', 'success');

  syncRecordToGoogleSheet('updateStudentGrade', {
    studentId: currentStudent.studentId,
    newGrade: newGrade
  });
}

// ----------------- AUTHENTICATION (STUDENT / ADMIN) ----------------- //

function handleUserBadgeClick() {
  openModal('authModal');
}

function toggleAuthForm(formType) {
  const loginSection = document.getElementById('loginFormSection');
  const regSection = document.getElementById('registerFormSection');
  const title = document.getElementById('authModalTitle');

  if (formType === 'register') {
    loginSection.style.display = 'none';
    regSection.style.display = 'block';
    title.innerText = 'ลงทะเบียนนักเรียนใหม่';
  } else {
    loginSection.style.display = 'block';
    regSection.style.display = 'none';
    title.innerText = 'เข้าสู่ระบบนักเรียน';
  }
}

function handleStudentLogin() {
  const studentId = document.getElementById('loginStudentId').value.trim();
  const birthDate = document.getElementById('loginBirthDate').value.trim();

  if (!studentId || !birthDate) {
    showToast('กรุณากรอกรหัสนักเรียนและวันเดือนปีเกิด', 'warning');
    return;
  }

  const cleanInput = birthDate.replace(/[\/\-\.]/g, '');

  const found = allStudents.find(s => {
    const cleanBDate = s.birthDate.replace(/[\/\-\.]/g, '');
    return s.studentId.toLowerCase() === studentId.toLowerCase() &&
           (cleanBDate === cleanInput || s.birthDate === birthDate);
  });

  if (found) {
    currentStudent = found;
    localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
    renderCurrentStudentProfile();
    renderDashboardCharts();
    closeModal('authModal');
    showToast(`ยินดีต้อนรับ ${currentStudent.fullName}`, 'success');
  } else {
    showToast('รหัสนักเรียนหรือวันเดือนปีเกิดไม่ถูกต้อง', 'error');
  }
}

function handleStudentRegister() {
  const studentId = document.getElementById('regStudentId').value.trim();
  const fullName = document.getElementById('regFullName').value.trim();
  const schoolName = document.getElementById('regSchoolName').value.trim();
  const grade = document.getElementById('regGrade').value;
  const birthDate = document.getElementById('regBirthDate').value.trim();
  const parentPhone = document.getElementById('regParentPhone').value.trim();

  if (!studentId || !fullName || !schoolName || !birthDate || !parentPhone) {
    showToast('กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง', 'warning');
    return;
  }

  // ตรวจสอบรหัสซ้ำ (1 คน 1 สิทธิ์)
  const isDuplicate = allStudents.some(s => s.studentId.toLowerCase() === studentId.toLowerCase());
  if (isDuplicate) {
    showToast('รหัสนักเรียนนี้มีอยู่ในระบบแล้ว ไม่สามารถลงทะเบียนซ้ำได้', 'error');
    return;
  }

  const newStudent = {
    studentId: studentId,
    fullName: fullName,
    schoolName: schoolName,
    grade: grade,
    birthDate: birthDate,
    parentPhone: parentPhone,
    status: 'Active',
    skills: { religious: 85, science: 80, math: 80, language: 85, social: 85, tech: 85 },
    gpa: '3.50',
    attendance: { present: 1, late: 0, leave: 0, absent: 0 }
  };

  allStudents.push(newStudent);
  localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));

  currentStudent = newStudent;
  localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));

  renderCurrentStudentProfile();
  renderDashboardCharts();
  closeModal('authModal');
  showToast('ลงทะเบียนสำเร็จเรียบร้อยแล้ว', 'success');

  syncRecordToGoogleSheet('registerStudent', newStudent);
}

// ----------------- ADMIN CONTROLS ----------------- //

function toggleSubAdminField() {
  const group = document.getElementById('subAdminUsernameGroup');
  const btn = document.getElementById('toggleSubAdminBtn');
  if (group.style.display === 'none') {
    group.style.display = 'block';
    btn.innerText = 'เข้าสู่ระบบด้วยรหัส Master Admin?';
  } else {
    group.style.display = 'none';
    btn.innerText = 'เข้าสู่ระบบด้วยบัญชีแอดมินรอง?';
  }
}

function handleAdminLogin() {
  const pass = document.getElementById('adminPassInput').value.trim();
  const user = document.getElementById('subAdminUserInput').value.trim();

  if (pass === MASTER_ADMIN_PASS) {
    currentAdmin = { username: 'MasterAdmin', role: 'SuperAdmin' };
    closeModal('adminAuthModal');
    switchView('admin');
    showToast('เข้าสู่ระบบผู้ดูแลระบบหลักสำเร็จ', 'success');
    return;
  }

  // ตรวจสอบแอดมินรอง
  const foundSub = subAdmins.find(s => s.username === user && s.password === pass);
  if (foundSub) {
    currentAdmin = foundSub;
    closeModal('adminAuthModal');
    switchView('admin');
    showToast(`เข้าสู่ระบบแอดมินรอง: ${foundSub.fullName}`, 'success');
    return;
  }

  showToast('รหัสผ่านหรือชื่อผู้ใช้ไม่ถูกต้อง', 'error');
}

function adminLogout() {
  currentAdmin = null;
  switchView('dashboard');
  showToast('ออกจากระบบแอดมินแล้ว', 'info');
}

function switchAdminTab(tabName, element) {
  document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.admin-content-tab').forEach(tab => tab.style.display = 'none');

  if (element) element.classList.add('active');
  const target = document.getElementById(`admin-tab-${tabName}`);
  if (target) target.style.display = 'block';
}

function renderAdminStudentsTable(filteredList = null) {
  const tbody = document.getElementById('adminStudentsTableBody');
  if (!tbody) return;

  const list = filteredList || allStudents;

  tbody.innerHTML = list.map(s => `
    <tr>
      <td><b>${s.studentId}</b></td>
      <td>${s.fullName}</td>
      <td><span class="activity-badge badge-upcoming">${s.grade}</span></td>
      <td>${s.schoolName}</td>
      <td>${s.parentPhone}</td>
      <td>${s.attendance ? s.attendance.present : 0} วัน</td>
      <td>${todayPrayers.filter(p => p.studentId === s.studentId).length} เวลา</td>
      <td>${activities.filter(a => a.checkedIn).length} รายการ</td>
      <td style="text-align: right;">
        <button class="btn btn-secondary" style="padding: 0.25rem 0.55rem; font-size: 0.8rem;" onclick="viewStudentDetails('${s.studentId}')">
          <i class="fa-solid fa-eye"></i> ดูข้อมูล
        </button>
      </td>
    </tr>
  `).join('');
}

function filterAdminStudents() {
  const search = document.getElementById('searchStudentInput').value.toLowerCase().trim();
  const grade = document.getElementById('filterGradeSelect').value;

  const filtered = allStudents.filter(s => {
    const matchSearch = s.fullName.toLowerCase().includes(search) || s.studentId.toLowerCase().includes(search);
    const matchGrade = !grade || s.grade === grade;
    return matchSearch && matchGrade;
  });

  renderAdminStudentsTable(filtered);
}

function viewStudentDetails(studentId) {
  const student = allStudents.find(s => s.studentId === studentId);
  if (!student) return;

  const modal = document.getElementById('studentDetailModal');
  const title = document.getElementById('studentDetailTitle');
  const content = document.getElementById('studentDetailContent');
  const btnDelete = document.getElementById('btnAdminDeleteStudent');

  title.innerText = `ข้อมูลนักเรียน: ${student.fullName} (${student.studentId})`;
  content.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
      <div><b>โรงเรียน:</b> ${student.schoolName}</div>
      <div><b>ระดับชั้น:</b> ${student.grade}</div>
      <div><b>วันเดือนปีเกิด:</b> ${student.birthDate}</div>
      <div><b>เบอร์โทรผู้ปกครอง:</b> ${student.parentPhone}</div>
      <div><b>เกรดเฉลี่ย (GPA):</b> ${student.gpa || '-'}</div>
      <div><b>สถานะ:</b> ${student.status}</div>
    </div>
    <div style="background: #f8fafc; padding: 1rem; border-radius: var(--radius-md);">
      <b>สถิติการมาเรียน:</b> มาเรียน ${student.attendance ? student.attendance.present : 0} วัน, 
      มาสาย ${student.attendance ? student.attendance.late : 0}, 
      ลา ${student.attendance ? student.attendance.leave : 0}, 
      ขาด ${student.attendance ? student.attendance.absent : 0}
    </div>
  `;

  btnDelete.onclick = () => deleteStudent(student.studentId);
  openModal('studentDetailModal');
}

function deleteStudent(studentId) {
  if (!confirm(`คุณต้องการลบข้อมูลนักเรียนรหัส ${studentId} ใช่หรือไม่?`)) return;

  allStudents = allStudents.filter(s => s.studentId !== studentId);
  localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
  renderAdminStudentsTable();
  closeModal('studentDetailModal');
  showToast(`ลบข้อมูลนักเรียน ${studentId} เรียบร้อยแล้ว`, 'success');

  syncRecordToGoogleSheet('deleteStudent', { studentId });
}

/**
 * เลื่อนชั้นปีการศึกษาแบบยกห้องโดยแอดมิน (Batch Grade Promotion)
 */
function executeBatchPromotion() {
  const fromGrade = document.getElementById('batchFromGrade').value;
  const toGrade = document.getElementById('batchToGrade').value;

  if (fromGrade === toGrade) {
    showToast('ระดับชั้นเริ่มต้นและระดับชั้นใหม่ต้องไม่ซ้ำกัน', 'warning');
    return;
  }

  let count = 0;
  allStudents.forEach(s => {
    if (s.grade === fromGrade) {
      s.grade = toGrade;
      count++;
    }
  });

  if (currentStudent && currentStudent.grade === fromGrade) {
    currentStudent.grade = toGrade;
    localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
    renderCurrentStudentProfile();
  }

  localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
  renderAdminStudentsTable();
  showToast(`เลื่อนชั้นปีนักเรียนจาก ${fromGrade} ➔ ${toGrade} สำเร็จจำนวน ${count} คน`, 'success');

  syncRecordToGoogleSheet('batchPromote', { fromGrade, toGrade });
}

// ----------------- CREATE ACTIVITY & SUB-ADMINS ----------------- //

function submitCreateActivity() {
  const title = document.getElementById('actTitle').value.trim();
  const desc = document.getElementById('actDesc').value.trim();
  const startDate = document.getElementById('actStartDate').value;
  const endDate = document.getElementById('actEndDate').value;
  const loc = document.getElementById('actLocation').value.trim();

  if (!title || !startDate || !endDate) {
    showToast('กรุณากรอกชื่อกิจกรรมและวันเวลาให้ครบถ้วน', 'warning');
    return;
  }

  const newAct = {
    activityId: 'ACT-' + Date.now(),
    title: title,
    description: desc,
    startDate: startDate,
    endDate: endDate,
    location: loc || 'มหาวิทยาลัยฟาฏอนี',
    createdBy: currentAdmin ? currentAdmin.username : 'Admin',
    status: 'Active',
    checkedIn: false
  };

  activities.unshift(newAct);
  localStorage.setItem('khalifah_activities', JSON.stringify(activities));

  closeModal('createActivityModal');
  renderActivitiesList();
  showToast('ประกาศกิจกรรมใหม่และส่งต่อถึงนักเรียนทุกคนแล้ว', 'success');

  syncRecordToGoogleSheet('createActivity', newAct);
}

function submitAddSubAdmin() {
  const fullName = document.getElementById('subFullName').value.trim();
  const username = document.getElementById('subUsername').value.trim();
  const pass = document.getElementById('subPassword').value.trim();
  const role = document.getElementById('subRole').value;

  if (!fullName || !username || !pass) {
    showToast('กรุณากรอกข้อมูลแอดมินรองให้ครบถ้วน', 'warning');
    return;
  }

  const newSub = {
    adminId: 'ADM-' + Date.now(),
    username: username,
    password: pass,
    fullName: fullName,
    role: role,
    createdAt: new Date().toISOString().split('T')[0]
  };

  subAdmins.push(newSub);
  localStorage.setItem('khalifah_sub_admins', JSON.stringify(subAdmins));

  closeModal('addSubAdminModal');
  renderSubAdminsTable();
  showToast(`เพิ่มแอดมินรอง ${fullName} สำเร็จ`, 'success');

  syncRecordToGoogleSheet('addSubAdmin', newSub);
}

function renderSubAdminsTable() {
  const tbody = document.getElementById('subAdminsTableBody');
  if (!tbody) return;

  tbody.innerHTML = subAdmins.map(a => `
    <tr>
      <td><b>${a.username}</b></td>
      <td>${a.fullName}</td>
      <td><span class="activity-badge badge-active">${a.role}</span></td>
      <td>${a.createdAt}</td>
      <td style="text-align: right;">
        <button class="btn btn-danger" style="padding: 0.25rem 0.55rem; font-size: 0.8rem;" onclick="deleteSubAdmin('${a.username}')">
          <i class="fa-solid fa-trash"></i> ลบ
        </button>
      </td>
    </tr>
  `).join('');
}

function deleteSubAdmin(username) {
  if (!confirm(`ต้องการลบแอดมินรอง ${username} ใช่หรือไม่?`)) return;
  subAdmins = subAdmins.filter(s => s.username !== username);
  localStorage.setItem('khalifah_sub_admins', JSON.stringify(subAdmins));
  renderSubAdminsTable();
  showToast('ลบแอดมินรองเรียบร้อยแล้ว', 'success');
}

// ----------------- REPORT EXPORT ENGINE (WORD / EXCEL / PDF) ----------------- //

function initExportDateDefaults() {
  const start = document.getElementById('exportStartDate');
  const end = document.getElementById('exportEndDate');
  if (start && end) {
    const today = new Date().toISOString().split('T')[0];
    start.value = today;
    end.value = today;
  }
}

function getFilteredReportData() {
  const grade = document.getElementById('exportGradeSelect').value;
  let students = allStudents;
  if (grade !== 'all') {
    students = students.filter(s => s.grade === grade);
  }
  return { students, prayers: todayPrayers, activities };
}

/**
 * ส่งออกเป็นไฟล์ Excel (.xlsx) ด้วย SheetJS
 */
function exportToExcel() {
  const { students, prayers } = getFilteredReportData();

  const wb = XLSX.utils.book_new();

  // Sheet 1: นักเรียน
  const studentRows = students.map(s => ({
    'รหัสนักเรียน': s.studentId,
    'ชื่อ-นามสกุล': s.fullName,
    'ระดับชั้น': s.grade,
    'โรงเรียน': s.schoolName,
    'เบอร์โทรผู้ปกครอง': s.parentPhone,
    'เกรดเฉลี่ย (GPA)': s.gpa || '3.50',
    'สถานะ': s.status
  }));
  const wsStudents = XLSX.utils.json_to_sheet(studentRows);
  XLSX.utils.book_append_sheet(wb, wsStudents, 'รายชื่อนักเรียน');

  // Sheet 2: การละหมาด
  const prayerRows = prayers.map(p => ({
    'รหัสนักเรียน': p.studentId,
    'ชื่อนักเรียน': p.studentName,
    'เวลาละหมาด': p.prayerTime,
    'วันที่': p.date,
    'เวลา': p.time,
    'สถานที่': p.locationName,
    'ในเขตพิกัด': p.isWithinZone ? 'ใช่' : 'ไม่ใช่'
  }));
  const wsPrayers = XLSX.utils.json_to_sheet(prayerRows);
  XLSX.utils.book_append_sheet(wb, wsPrayers, 'บันทึกการละหมาด');

  XLSX.writeFile(wb, `รายงาน_Khalifah_Program_${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('ส่งออกไฟล์ Excel สำเร็จ', 'success');
}

/**
 * ส่งออกเป็นเอกสาร Microsoft Word (.doc)
 */
function exportToWord() {
  const { students } = getFilteredReportData();
  const now = new Date().toLocaleDateString('th-TH');

  const content = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>รายงานผล KHALIFAH PROGRAM</title>
      <style>
        body { font-family: 'TH Sarabun New', Kanit, sans-serif; font-size: 16pt; }
        h1 { text-align: center; color: #0284c7; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #333; padding: 8px; text-align: left; }
        th { background-color: #f1f5f9; }
      </style>
    </head>
    <body>
      <h1>รายงานสรุปผล KHALIFAH PROGRAM</h1>
      <p style="text-align: center;">วันที่ออกรายงาน: ${now}</p>
      <hr/>
      <h3>ตารางรายชื่อและสถิตินักเรียน</h3>
      <table>
        <thead>
          <tr>
            <th>รหัสนักเรียน</th>
            <th>ชื่อ - นามสกุล</th>
            <th>ระดับชั้น</th>
            <th>โรงเรียน</th>
            <th>เบอร์ผู้ปกครอง</th>
          </tr>
        </thead>
        <tbody>
          ${students.map(s => `
            <tr>
              <td>${s.studentId}</td>
              <td>${s.fullName}</td>
              <td>${s.grade}</td>
              <td>${s.schoolName}</td>
              <td>${s.parentPhone}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + content], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `รายงาน_Khalifah_Program_${new Date().toISOString().split('T')[0]}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('ส่งออกไฟล์ Word (.doc) สำเร็จ', 'success');
}

/**
 * สั่งพิมพ์หรือบันทึกเป็น PDF (Print-to-PDF Window)
 */
function exportToPdfPrint() {
  window.print();
}

// ----------------- GOOGLE APPS SCRIPT SYNC ----------------- //

function saveGasSettings() {
  const url = document.getElementById('gasApiUrlInput').value.trim();
  gasApiUrl = url;
  localStorage.setItem('khalifah_gas_url', url);
  closeModal('settingsModal');
  showToast('บันทึก URL เชื่อมต่อ Google Sheets เรียบร้อย', 'success');
}

async function testGasConnection() {
  const url = document.getElementById('gasApiUrlInput').value.trim();
  const statusDiv = document.getElementById('gasConnStatus');

  if (!url) {
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#fef2f2';
    statusDiv.style.color = '#991b1b';
    statusDiv.innerText = 'กรุณาใส่ URL ของ Google Apps Script ก่อนทดสอบ';
    return;
  }

  statusDiv.style.display = 'block';
  statusDiv.style.background = '#eff6ff';
  statusDiv.style.color = '#1e40af';
  statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังทดสอบเชื่อมต่อ Google Apps Script...';

  try {
    const res = await fetch(`${url}?action=init`);
    const data = await res.json();
    if (data.success || data.status === 'online') {
      statusDiv.style.background = '#f0fdf4';
      statusDiv.style.color = '#166534';
      statusDiv.innerText = '✓ เชื่อมต่อกับ Google Sheets สำเร็จเรียบร้อย!';
    } else {
      statusDiv.style.background = '#fffbeb';
      statusDiv.style.color = '#92400e';
      statusDiv.innerText = 'ได้รับผลตอบกลับ: ' + JSON.stringify(data);
    }
  } catch (err) {
    statusDiv.style.background = '#fef2f2';
    statusDiv.style.color = '#991b1b';
    statusDiv.innerText = 'เชื่อมต่อไม่สำเร็จ: ' + err.message + ' (ตรวจดูว่าสิทธิ์เป็น Anyone แล้วหรือยัง)';
  }
}

async function syncRecordToGoogleSheet(action, data) {
  if (!gasApiUrl) return; // ทำงานในโหมด Offline Local

  try {
    await fetch(gasApiUrl, {
      method: 'POST',
      mode: 'no-cors', // Apps script CORS bypass
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, data: data })
    });
  } catch (err) {
    console.log('Background sync to Google Sheets:', err);
  }
}

// ----------------- MODAL & UTILITY FUNCTIONS ----------------- //

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-xmark';
  if (type === 'warning') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}
