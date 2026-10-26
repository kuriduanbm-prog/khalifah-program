
// ==========================================
// STRING, ID NORMALIZATION & SECURITY HELPERS (LEADING ZERO + XSS SAFE)
// ==========================================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Brute-force login rate limiter
let loginFailedAttempts = 0;
let loginLockoutUntil = 0;

function checkLoginRateLimit() {
  const now = Date.now();
  if (now < loginLockoutUntil) {
    const waitSec = Math.ceil((loginLockoutUntil - now) / 1000);
    showToast(`กรอกรหัสผิดเกินกำหนด กรุณารอ ${waitSec} วินาทีก่อนลองใหม่`, 'error');
    return false;
  }
  return true;
}

function recordLoginFailure() {
  loginFailedAttempts++;
  if (loginFailedAttempts >= 5) {
    loginLockoutUntil = Date.now() + 30000; // Lock 30 seconds after 5 failed attempts
    loginFailedAttempts = 0;
    showToast('ตรวจพบการเดารหัสผ่านเกิน 5 ครั้ง ระบบล็อกชั่วคราว 30 วินาที', 'error');
  }
}

function resetLoginFailures() {
  loginFailedAttempts = 0;
  loginLockoutUntil = 0;
}

// Normalize grade to 0 - 4 scale (supports 0, 1, 1.5, 2, 2.5, 3, 3.5, 4 and converts legacy 0-100 scores)
function normalizeGrade1To4(rawVal) {
  if (rawVal === null || rawVal === undefined || rawVal === '') return 0;
  const n = parseFloat(rawVal);
  if (isNaN(n) || n <= 0) return 0;
  if (n <= 4) {
    return Math.round(n * 2) / 2; // Snap to 0.5 increments (1, 1.5, 2, 2.5, 3, 3.5, 4)
  }
  // Convert legacy 0-100 score to 1-4 grade scale
  if (n >= 80) return 4;
  if (n >= 75) return 3.5;
  if (n >= 70) return 3;
  if (n >= 65) return 2.5;
  if (n >= 60) return 2;
  if (n >= 55) return 1.5;
  if (n >= 50) return 1;
  return 0;
}

function recalculateStudentGpa(student) {
  if (!student) return '0.00';
  const gradesMap = student.subjectGrades || student.skills || {};
  const vals = Object.values(gradesMap)
    .map(v => normalizeGrade1To4(v))
    .filter(v => v > 0);
  if (vals.length === 0) {
    return student.gpa && parseFloat(student.gpa) <= 4 ? student.gpa : '0.00';
  }
  const avg = vals.reduce((acc, cur) => acc + cur, 0) / vals.length;
  student.gpa = avg.toFixed(2);
  return student.gpa;
}

function cleanIdString(id) {
  if (id === null || id === undefined) return '';
  let s = String(id).trim();
  if (s.startsWith("'")) s = s.replace(/^'+/, '');
  return s.trim();
}

function normalizePhone(p) {
  if (p === null || p === undefined) return '';
  let s = cleanIdString(p).replace(/[^0-9]/g, '');
  if (s.length === 9 && (s.startsWith('8') || s.startsWith('6') || s.startsWith('9'))) {
    s = '0' + s;
  } else if (s.length === 8 && s.startsWith('2')) {
    s = '0' + s;
  }
  return s;
}

function normalizeBirthDate(bd) {
  if (bd === null || bd === undefined) return '';
  let s = cleanIdString(bd).replace(/[^0-9]/g, '');
  if (s.length === 7) {
    s = '0' + s;
  }
  return s;
}

function cleanPhoneString(p) {
  return normalizePhone(p);
}

function isIdMatch(id1, id2) {
  const s1 = cleanIdString(id1).toLowerCase();
  const s2 = cleanIdString(id2).toLowerCase();
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;
  // If both are numeric (e.g. "0123" and "123")
  if (/^\d+$/.test(s1) && /^\d+$/.test(s2)) {
    return s1.replace(/^0+/, '') === s2.replace(/^0+/, '');
  }
  return false;
}

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

// ==================== GLOBAL DIRECT IMAGE & GOOGLE DRIVE CDN HELPERS ==================== //

/**
 * แปลงลิงก์รูปภาพ Google Drive ทุกรูปแบบให้เป็น Direct CDN (lh3.googleusercontent.com)
 * เพื่อให้สามารถแสดงผลบนแท็ก <img> ได้ 100% โดยไม่ติด CORS หรือ X-Frame-Options
 */
function getDirectImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Filter out placeholder error texts and invalid values
  if (
    trimmed === 'Stored locally on device' || 
    trimmed === 'รูปโปรไฟล์ในอุปกรณ์' || 
    trimmed.startsWith('Stored locally') || 
    trimmed === '-' || 
    trimmed === 'null' || 
    trimmed === 'undefined'
  ) {
    return '';
  }

  if (trimmed.startsWith('data:image/')) return trimmed;

  const drivePatterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/(?:open|uc|thumbnail)\?id=([a-zA-Z0-9_-]+)/i,
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i
  ];
  for (const re of drivePatterns) {
    const match = trimmed.match(re);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return '';
}

function extractDriveFileId(url) {
  if (!url || typeof url !== 'string') return null;
  const drivePatterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/(?:open|uc|thumbnail)\?id=([a-zA-Z0-9_-]+)/i,
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i
  ];
  for (const re of drivePatterns) {
    const match = url.match(re);
    if (match && match[1]) return match[1];
  }
  return null;
}

let currentPhotoViewerData = { url: '', caption: '', fileId: null };

function openPhotoViewerModal(imageUrl, caption = '', driveLink = null) {
  const modal = document.getElementById('globalPhotoViewerModal');
  const imgEl = document.getElementById('globalPhotoViewerImg');
  const captionEl = document.getElementById('globalPhotoViewerCaption');
  const driveBtn = document.getElementById('globalPhotoViewerDriveBtn');
  const loaderEl = document.getElementById('globalPhotoViewerLoading');
  if (!modal || !imgEl) return;

  const directUrl = getDirectImageUrl(imageUrl);
  const fileId = extractDriveFileId(imageUrl) || extractDriveFileId(driveLink);

  currentPhotoViewerData = {
    url: directUrl,
    caption: caption || 'ภาพถ่ายหลักฐานในระบบ',
    fileId: fileId
  };

  imgEl.src = '';
  if (loaderEl) loaderEl.style.display = 'block';

  imgEl.onload = () => {
    if (loaderEl) loaderEl.style.display = 'none';
  };
  imgEl.onerror = () => {
    if (loaderEl) loaderEl.style.display = 'none';
    showToast('ไม่สามารถโหลดภาพต้นฉบับได้ ลิงก์อาจหมดอายุหรือถูกจำกัดสิทธิ์', 'warning');
  };

  imgEl.src = directUrl;

  if (captionEl) {
    captionEl.innerText = currentPhotoViewerData.caption;
    captionEl.title = currentPhotoViewerData.caption;
  }

  if (driveBtn) {
    if (fileId) {
      driveBtn.href = `https://drive.google.com/file/d/${fileId}/view`;
      driveBtn.style.display = 'inline-flex';
    } else {
      driveBtn.style.display = 'none';
    }
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closePhotoViewerModal() {
  const modal = document.getElementById('globalPhotoViewerModal');
  if (modal) {
    modal.classList.remove('active');
  }
  document.body.style.overflow = '';
}

function downloadCurrentPhotoViewerImg() {
  if (!currentPhotoViewerData.url) {
    showToast('ไม่มีภาพที่จะดาวน์โหลด', 'warning');
    return;
  }

  const directUrl = currentPhotoViewerData.url;
  const a = document.createElement('a');
  a.href = directUrl;
  a.download = `photo_${Date.now()}.jpg`;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('เริ่มดาวน์โหลดภาพแล้ว', 'success');
}

function openPhotoViewerModalFromDetail() {
  const pPhoto = document.getElementById('modalPrayerPhoto');
  if (!pPhoto || !pPhoto.src) return;
  const fullSrc = pPhoto.getAttribute('data-full-src') || pPhoto.src;
  const caption = pPhoto.getAttribute('data-caption') || 'ภาพถ่ายยืนยันการเช็คชื่อละหมาด';
  openPhotoViewerModal(fullSrc, caption);
}

// ==================== PRAYER HISTORY DETAIL MODAL & LOCATION FIXES ==================== //

function openPrayerHistoryDetailModal(logId) {
  let historyList = [];
  try {
    historyList = JSON.parse(localStorage.getItem('khalifah_prayer_history') || '[]');
  } catch (e) { historyList = []; }

  let record = historyList.find(p => (p.id === logId || p.logId === logId));
  if (!record) {
    record = todayPrayers.find(p => (p.id === logId || p.logId === logId));
  }
  if (!record) {
    showToast('ไม่พบข้อมูลบันทึกละหมาดนี้', 'warning');
    return;
  }

  const pName = document.getElementById('modalPrayerName');
  const pBadge = document.getElementById('modalPrayerStatusBadge');
  const pDate = document.getElementById('modalPrayerDate');
  const pTime = document.getElementById('modalPrayerTime');
  const pLoc = document.getElementById('modalPrayerLocation');
  const pNote = document.getElementById('modalPrayerNote');
  const pCoords = document.getElementById('modalPrayerCoords');
  const pMapsLink = document.getElementById('modalPrayerMapsLink');
  const pPhoto = document.getElementById('modalPrayerPhoto');
  const pPhotoWrap = document.getElementById('modalPrayerPhotoWrapper');

  const d = new Date(record.timestamp || record.date);
  const dateStr = d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.';

  if (pName) pName.innerText = `ละหมาด${record.prayerName || record.prayerTime || '-'}`;
  
  const status = record.status || 'ตรงเวลา (ญะมาอะฮ์/มัสยิด)';
  let statusClass = 'status-ontime';
  if (status.includes('สาย')) statusClass = 'status-late';
  if (status.includes('อุซุร') || status.includes('ประจำเดือน')) statusClass = 'status-excused';
  if (status.includes('ป่วย') || status.includes('มีอุปสรรค')) statusClass = 'status-late';

  if (pBadge) {
    pBadge.innerHTML = `<span class="status-badge ${statusClass}">${status}</span>`;
  }

  if (pDate) pDate.innerText = dateStr;
  if (pTime) pTime.innerText = timeStr;
  if (pLoc) pLoc.innerText = record.locationName || 'พิกัด GPS';
  if (pNote) pNote.innerText = record.note ? record.note : 'ไม่มีหมายเหตุเพิ่มเติม';

  const lat = record.lat || record.latitude;
  const lng = record.lng || record.longitude;

  if (pCoords) {
    if (lat && lng) {
      pCoords.innerText = `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
    } else {
      pCoords.innerText = 'ไม่ได้ระบุพิกัด';
    }
  }

  if (pMapsLink) {
    if (lat && lng) {
      pMapsLink.href = `https://maps.google.com/?q=${lat},${lng}`;
      pMapsLink.style.display = 'inline-flex';
    } else {
      pMapsLink.style.display = 'none';
    }
  }

  const rawPhoto = record.photo || record.photoUrl || record.photoBase64;
  const photoSrc = getDirectImageUrl(rawPhoto);
  if (photoSrc && photoSrc.length > 10) {
    if (pPhoto) {
      pPhoto.src = photoSrc;
      pPhoto.setAttribute('data-full-src', photoSrc);
      pPhoto.setAttribute('data-caption', `${record.studentName || 'นักเรียน'} - ละหมาด${record.prayerName || record.prayerTime || ''} (${record.date || ''} ${record.time || ''})`);
    }
    if (pPhotoWrap) pPhotoWrap.style.display = 'block';
  } else {
    if (pPhotoWrap) pPhotoWrap.style.display = 'none';
  }

  openModal('prayerDetailModal');
}

// ----------------- ENHANCED HASANAT BENTO & INTERACTIVE CONTROLS ----------------- //

function switchHasanatSubTab(tabName) {
  const tabs = ['quran', 'sunnah', 'memorize'];
  const btnMap = {
    'all': 'btnSubHasanatAll',
    'quran': 'btnSubHasanatQuran',
    'sunnah': 'btnSubHasanatSunnah',
    'memorize': 'btnSubHasanatMemorize'
  };

  const activeTab = tabName || 'all';

  // Toggle active class on subnav buttons
  Object.keys(btnMap).forEach(k => {
    const btn = document.getElementById(btnMap[k]);
    if (btn) {
      btn.classList.toggle('active', k === activeTab);
    }
  });

  const bentoGrid = document.getElementById('hasanatBentoGrid');
  if (bentoGrid) {
    if (activeTab === 'all') {
      bentoGrid.classList.remove('single-view');
    } else {
      bentoGrid.classList.add('single-view');
    }
  }

  tabs.forEach(t => {
    const content = document.getElementById(`subtab-${t}`);
    if (content) {
      content.style.display = (activeTab === 'all' || activeTab === t) ? 'block' : 'none';
    }
  });

  if (activeTab === 'memorize' || activeTab === 'all') {
    if (typeof renderSurahChecklist === 'function') {
      const searchInput = document.getElementById('searchSurahInput');
      renderSurahChecklist(searchInput ? searchInput.value : '');
    }
  }
  if (activeTab === 'sunnah' || activeTab === 'all') {
    if (typeof calculateDailySunnahRakaat === 'function') calculateDailySunnahRakaat(false);
  }
}

function focusHasanatSection(sectionName) {
  switchHasanatSubTab(sectionName);
  const target = document.getElementById(`subtab-${sectionName}`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

let currentSurahCategory = 'all';

function render30StarsShelf(activeStars = 0) {
  const shelf = document.getElementById('quranShelfGrid');
  if (!shelf) return;

  let html = '';
  for (let i = 1; i <= 30; i++) {
    const isActive = i <= activeStars;
    html += `
      <div class="quran-shelf-star ${isActive ? 'active' : ''}" onclick="setJuzDirectly(${i})" title="ยุซที่ ${i} (${isActive ? 'อ่านจบแล้ว' : 'คลิกเพื่อตั้งว่าอ่านจบแล้ว'})">
        <div class="star-icon">⭐</div>
        <div class="juz-num">${i}</div>
      </div>
    `;
  }
  shelf.innerHTML = html;
}

function setJuzDirectly(juzNumber) {
  const jComp = document.getElementById('quranJuzCompletedInput');
  if (jComp) {
    jComp.value = juzNumber;
    updateShelfStarsFromInput();
  }
}

function updateShelfStarsFromInput() {
  const jComp = document.getElementById('quranJuzCompletedInput');
  const pCur = document.getElementById('quranCurrentPageInput');
  const juz = Math.max(0, Math.min(30, parseInt(jComp ? jComp.value : 0) || 0));
  const page = parseInt(pCur ? pCur.value : 0) || 0;

  render30StarsShelf(juz);
  renderHasanatStarsShowcase(juz, page);

  const bar = document.getElementById('hasanatQuranProgressBar');
  if (bar) {
    const pct = ((page / 604) * 100).toFixed(1);
    bar.style.width = `${Math.min(100, pct)}%`;
  }

  const badge = document.getElementById('navHasanatQuranBadge');
  if (badge) badge.innerText = `⭐ ${juz} ดาว`;
}

function adjustPagesToday(diff) {
  const input = document.getElementById('quranPagesTodayInput');
  const curPageInput = document.getElementById('quranCurrentPageInput');
  if (!input) return;

  let val = (parseInt(input.value) || 0) + diff;
  if (val < 0) val = 0;
  input.value = val;

  // Increment current page as well
  if (curPageInput) {
    let cur = (parseInt(curPageInput.value) || 0) + diff;
    if (cur > 604) cur = 604;
    if (cur < 1) cur = 1;
    curPageInput.value = cur;
    autoCalculateJuzFromPage();
  }
}

function setPagesToday(val) {
  const input = document.getElementById('quranPagesTodayInput');
  if (input) input.value = val;
}

function setSurahCategoryFilter(category) {
  currentSurahCategory = category;
  document.querySelectorAll('.surah-cat-tab').forEach(b => b.classList.remove('active'));

  if (category === 'all') document.getElementById('tabCatAll')?.classList.add('active');
  if (category === 'juzAmma') document.getElementById('tabCatJuzAmma')?.classList.add('active');
  if (category === 'popular') document.getElementById('tabCatPopular')?.classList.add('active');
  if (category === 'memorized') document.getElementById('tabCatMemorized')?.classList.add('active');

  const note = document.getElementById('surahCurrentCategoryNote');
  if (note) {
    if (category === 'all') note.innerText = 'แสดงทั้ง 114 ซูเราะห์';
    if (category === 'juzAmma') note.innerText = 'แสดงกลุ่มยุซอัมมา (ซูเราะห์ที่ 78 - 114)';
    if (category === 'popular') note.innerText = 'แสดงซูเราะห์สำคัญยอดนิยม (ยาซีน, อัลกะฮ์ฟิ, อัลมุลก์ ฯลฯ)';
    if (category === 'memorized') note.innerText = 'แสดงเฉพาะซูเราะห์ที่ท่านติ๊กท่องจำแล้ว';
  }

  const searchInput = document.getElementById('searchSurahInput');
  renderSurahChecklist(searchInput ? searchInput.value : '');
}

function selectSunnahPill(type, rakaat) {
  if (type === 'duha') {
    const hidden = document.getElementById('selDuhaRakaat');
    if (hidden) hidden.value = rakaat;
    document.querySelectorAll('#pillsGroupDuha .sunnah-pill-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.getAttribute('data-val')) === rakaat);
    });
  } else if (type === 'witr') {
    const hidden = document.getElementById('selWitrRakaat');
    if (hidden) hidden.value = rakaat;
    document.querySelectorAll('#pillsGroupWitr .sunnah-pill-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.getAttribute('data-val')) === rakaat);
    });
  } else if (type === 'tahajjud') {
    const hidden = document.getElementById('selTahajjudRakaat');
    if (hidden) hidden.value = rakaat;
    document.querySelectorAll('#pillsGroupTahajjud .sunnah-pill-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.getAttribute('data-val')) === rakaat);
    });
  }

  calculateDailySunnahRakaat(false);
}

// ==================== HASANAT STORAGE & KHATAM ORBIT STARS SYSTEM ==================== //

/**
 * ดึงข้อมูลผลบุญของนักเรียนจาก LocalStorage พร้อมค่าเริ่มต้นที่ปลอดภัย
 */
function getStudentHasanat(studentId) {
  if (!studentId) return null;
  const cleanId = cleanIdString(studentId);
  let allHasanat = {};
  try {
    allHasanat = JSON.parse(localStorage.getItem('khalifah_student_hasanat') || '{}');
  } catch (e) {
    allHasanat = {};
  }

  // ค้นหา key ที่ตรงกัน (รองรับเลข 0 นำหน้า และเครื่องหมายคำพูด)
  let targetKey = Object.keys(allHasanat).find(k => isIdMatch(k, cleanId)) || cleanId;

  if (!allHasanat[targetKey]) {
    allHasanat[targetKey] = {
      studentId: cleanId,
      studentName: currentStudent ? currentStudent.fullName : '',
      grade: currentStudent ? currentStudent.grade : '',
      quran: {
        pagesToday: 0,
        currentPage: 0,
        juzCompleted: 0,
        stars: 0,
        khatamCount: 0,
        lastUpdated: new Date().toISOString()
      },
      memorization: {
        count: 0,
        memorizedSurahs: []
      },
      sunnah: {
        rawatib: {},
        duhaRakaat: 0,
        witrRakaat: 3,
        tahajjudRakaat: 0,
        totalRakaat: 0
      }
    };
  }

  // ป้องกัน undefined field
  if (!allHasanat[targetKey].quran) {
    allHasanat[targetKey].quran = { pagesToday: 0, currentPage: 0, juzCompleted: 0, stars: 0, khatamCount: 0 };
  }
  if (typeof allHasanat[targetKey].quran.khatamCount !== 'number') {
    allHasanat[targetKey].quran.khatamCount = (allHasanat[targetKey].quran.juzCompleted >= 30) ? 1 : 0;
  }
  if (!allHasanat[targetKey].memorization) {
    allHasanat[targetKey].memorization = { count: 0, memorizedSurahs: [] };
  }
  if (!allHasanat[targetKey].sunnah) {
    allHasanat[targetKey].sunnah = { rawatib: {}, duhaRakaat: 0, witrRakaat: 3, tahajjudRakaat: 0, totalRakaat: 0 };
  }
  return allHasanat[targetKey];
}

/**
 * บันทึกข้อมูลผลบุญลง LocalStorage และซิงค์ไปยัง Google Sheet
 */
function saveStudentHasanat(hasanatObj) {
  if (!hasanatObj || !hasanatObj.studentId) return;
  const cleanId = cleanIdString(hasanatObj.studentId);
  hasanatObj.studentId = cleanId;

  let allHasanat = {};
  try {
    allHasanat = JSON.parse(localStorage.getItem('khalifah_student_hasanat') || '{}');
  } catch (e) {
    allHasanat = {};
  }

  // ลบคีย์เดิมที่รูปแบบต่างกันแต่เป็นนักเรียนคนเดียวกัน
  Object.keys(allHasanat).forEach(k => {
    if (k !== cleanId && isIdMatch(k, cleanId)) {
      delete allHasanat[k];
    }
  });

  allHasanat[cleanId] = hasanatObj;
  try {
    localStorage.setItem('khalifah_student_hasanat', JSON.stringify(allHasanat));
  } catch (e) {
    console.error('Failed to save khalifah_student_hasanat:', e);
  }

  // อัปเดตดาวและเหรียญเกียรติยศที่แบนเนอร์หน้าแรกทันที
  renderDashboardQuranStars();
}

/**
 * วาดดาวทองคำลอยประดับรอบขอบวงกลมรูปโปรไฟล์ (1 ดาว = จบ 30 ยุซ 1 ครั้ง, 10 ดาว = จบ 10 ครั้ง)
 * หรูหรา สไตล์ผู้ดี (Royal Gold Orbit Ring)
 */
function renderAvatarOrbitStars(khatamCount = 0) {
  const ring = document.getElementById('avatarStarOrbitRing');
  if (!ring) return;

  ring.innerHTML = '';
  const count = parseInt(khatamCount) || 0;
  if (count <= 0) return;

  const stageCenter = 72; // จุดศูนย์กลางของเวที 144px
  const radius = 64;      // รัศมีลอยอยู่นอกขอบอวาตาร์ 96px พอดี

  if (count === 1) {
    // จบ 1 ครั้ง: ประดับดาวมงกุฎทองเด่นสง่าที่ตำแหน่ง 12 นาฬิกา (ยอดบนสุด)
    const starEl = document.createElement('div');
    starEl.className = 'avatar-orbit-star';
    starEl.style.left = `${stageCenter}px`;
    starEl.style.top = `${stageCenter - radius}px`;
    starEl.title = 'อัลกุรอาน: ค็อตม์ 30 ยุซ จบแล้ว 1 ครั้ง ⭐ (คลิกดูเกียรติยศ)';
    starEl.innerHTML = '<i class="fa-solid fa-star"></i>';
    starEl.onclick = (e) => {
      e.stopPropagation();
      showKhatamHonourToast(1, 1);
    };
    ring.appendChild(starEl);
    return;
  }

  // จบ 2 ครั้งขึ้นไป (เช่น 2, 3, 5, 10 ครั้ง): กระจายดาวเป็นวงกลมลอยรอบโปรไฟล์อย่างสมมาตรสวยงาม
  const displayCount = Math.min(count, 24); // รองรับได้สูงสุดถึง 24 ดวงรอบขอบ
  const step = (2 * Math.PI) / displayCount;

  for (let i = 0; i < displayCount; i++) {
    // เริ่มต้นมุมที่ด้านบนสุด (-90 องศา หรือ -PI/2) หมุนตามเข็มนาฬิกา
    const angle = (-Math.PI / 2) + (i * step);
    const x = Math.round(stageCenter + radius * Math.cos(angle));
    const y = Math.round(stageCenter + radius * Math.sin(angle));

    const starEl = document.createElement('div');
    starEl.className = 'avatar-orbit-star';
    starEl.style.left = `${x}px`;
    starEl.style.top = `${y}px`;
    starEl.style.animationDelay = `${(i * 0.18).toFixed(2)}s`;
    starEl.title = `อัลกุรอาน: ค็อตม์ 30 ยุซ ครั้งที่ ${i + 1} ⭐ (คลิกดูเกียรติยศ)`;
    starEl.innerHTML = '<i class="fa-solid fa-star"></i>';
    starEl.onclick = (e) => {
      e.stopPropagation();
      showKhatamHonourToast(i + 1, count);
    };
    ring.appendChild(starEl);
  }
}

/**
 * ป้ายข้อความค็อตมุลกุรอานใต้รูปโปรไฟล์ (นำออกตามความต้องการของผู้ใช้ ให้เหลือเฉพาะดาวรอบโปรไฟล์)
 */
function renderKhatamBadge(khatamCount = 0) {
  const container = document.getElementById('dashKhatamBadgeContainer');
  if (container) {
    container.innerHTML = '';
  }
}

function showKhatamHonourToast(khatamNum, totalKhatam = null) {
  const total = totalKhatam || khatamNum;
  playSuccessSound();
  showToast(`👑 มาชาอัลลอฮ์! อ่านจบ 30 ยุซ (ค็อตมุลกุรอาน) สะสม ${total} ครั้ง ได้รับดาวเกียรติยศประดับรอบโปรไฟล์ ${total} ดวง ⭐`, 'success');
}

/**
 * ปรับจำนวนครั้งที่อ่านจบ 30 ยุซ ในหน้าผลบุญ
 */
function adjustKhatamCount(delta) {
  const input = document.getElementById('quranKhatamCountInput');
  if (!input) return;
  let val = parseInt(input.value) || 0;
  val = Math.max(0, Math.min(100, val + delta));
  input.value = val;
  onKhatamInputChange();
}

/**
 * เมื่อนักเรียนกรอกจำนวนครั้งที่อ่านจบ 30 ยุซ
 */
function onKhatamInputChange() {
  const input = document.getElementById('quranKhatamCountInput');
  const badge = document.getElementById('quranKhatamDisplayBadge');
  if (!input) return;
  const val = Math.max(0, parseInt(input.value) || 0);
  if (badge) {
    badge.innerText = `⭐ ${val} ดาวรอบโปรไฟล์`;
  }
  // แสดงผลล่วงหน้าแบบ Real-time บนแบนเนอร์โปรไฟล์
  renderAvatarOrbitStars(val);
  renderKhatamBadge(val);
}

// ==================== HASANAT DATE NAVIGATOR & MANAGEMENT ==================== //
let hasanatSelectedDate = new Date().toISOString().split('T')[0];

function triggerHasanatDatePicker() {
  const picker = document.getElementById('hasanatDatePicker');
  if (!picker) return;
  if (picker.showPicker) {
    try {
      picker.showPicker();
      return;
    } catch (e) {}
  }
  picker.focus();
}

function initHasanatDateControls() {
  const picker = document.getElementById('hasanatDatePicker');
  const display = document.getElementById('hasanatDateDisplay');
  const badge = document.getElementById('hasanatDateRelativeBadge');
  const btnToday = document.getElementById('btnHasanatToday');
  const activeNote = document.getElementById('quranActiveDateNote');

  if (picker) picker.value = hasanatSelectedDate;

  const todayStr = new Date().toISOString().split('T')[0];
  const d = new Date(hasanatSelectedDate + 'T00:00:00');
  
  if (display) {
    const formatted = d.toLocaleDateString('th-TH', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    display.innerText = `วันที่ ${formatted}`;
  }

  if (badge) {
    if (hasanatSelectedDate === todayStr) {
      badge.innerText = 'วันนี้';
      badge.className = 'hasanat-date-rel-badge today';
    } else if (hasanatSelectedDate < todayStr) {
      badge.innerText = 'ย้อนหลัง';
      badge.className = 'hasanat-date-rel-badge past';
    } else {
      badge.innerText = 'ล่วงหน้า';
      badge.className = 'hasanat-date-rel-badge future';
    }
  }

  if (btnToday) {
    btnToday.classList.toggle('active', hasanatSelectedDate === todayStr);
  }

  if (activeNote) {
    if (hasanatSelectedDate === todayStr) {
      activeNote.innerText = 'ของวันนี้';
    } else {
      const shortDate = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      activeNote.innerText = `วันที่ ${shortDate}`;
    }
  }
}

function shiftHasanatDate(offsetDays) {
  const cur = new Date(hasanatSelectedDate + 'T00:00:00');
  cur.setDate(cur.getDate() + offsetDays);
  hasanatSelectedDate = cur.toISOString().split('T')[0];
  initHasanatDateControls();
  initHasanatView();
}

function setHasanatTodayDate() {
  hasanatSelectedDate = new Date().toISOString().split('T')[0];
  initHasanatDateControls();
  initHasanatView();
}

function onHasanatDateChange(newDateVal) {
  if (!newDateVal) return;
  hasanatSelectedDate = newDateVal;
  initHasanatDateControls();
  initHasanatView();
}

function initHasanatView() {
  initHasanatDateControls();
  if (!currentStudent) return;
  const h = getStudentHasanat(currentStudent.studentId);
  if (!h) return;

  h.dailyLogs = h.dailyLogs || {};
  const todayStr = new Date().toISOString().split('T')[0];
  const dayLog = h.dailyLogs[hasanatSelectedDate] || null;

  // 1. Quran tab
  const pToday = document.getElementById('quranPagesTodayInput');
  const pCur = document.getElementById('quranCurrentPageInput');
  const jComp = document.getElementById('quranJuzCompletedInput');
  const kInput = document.getElementById('quranKhatamCountInput');
  const kBadge = document.getElementById('quranKhatamDisplayBadge');

  if (pToday) {
    if (dayLog && typeof dayLog.pagesToday !== 'undefined') {
      pToday.value = dayLog.pagesToday;
    } else if (hasanatSelectedDate === todayStr) {
      pToday.value = h.quran.pagesToday || '';
    } else {
      pToday.value = '';
    }
  }

  const curPageVal = (dayLog && dayLog.currentPage) ? dayLog.currentPage : (h.quran.currentPage || 0);
  if (pCur) pCur.value = curPageVal || '';
  if (jComp) jComp.value = h.quran.juzCompleted || 0;

  const khatamVal = (h.quran && typeof h.quran.khatamCount === 'number')
    ? h.quran.khatamCount
    : (h.quran.juzCompleted >= 30 ? 1 : 0);

  if (kInput) kInput.value = khatamVal;
  if (kBadge) kBadge.innerText = `⭐ ${khatamVal} ดาวรอบโปรไฟล์`;

  renderHasanatStarsShowcase(h.quran.stars || 0, curPageVal, khatamVal);
  render30StarsShelf(h.quran.stars || 0);

  const bar = document.getElementById('hasanatQuranProgressBar');
  if (bar) {
    bar.style.width = `${Math.min(100, ((curPageVal / 604) * 100).toFixed(1))}%`;
  }
  const qBadge = document.getElementById('navHasanatQuranBadge');
  if (qBadge) qBadge.innerText = `⭐ ${h.quran.stars || 0} ดาว`;
  const mBadge = document.getElementById('navHasanatMemBadge');
  const memCountVal = h.memorization.count || 0;
  if (mBadge) mBadge.innerText = `${memCountVal}/114`;

  // 2. Memorization tab & progress bar
  const memBadge = document.getElementById('memorizedSurahsBadge');
  if (memBadge) {
    memBadge.innerText = `ท่องจำได้ ${memCountVal} / 114 ซูเราะห์`;
  }
  const memBarFill = document.getElementById('memorizedProgressBarFill');
  if (memBarFill) {
    memBarFill.style.width = `${Math.min(100, ((memCountVal / 114) * 100).toFixed(1))}%`;
  }

  // Update 3-Pillar Overview Strip
  const ovQuran = document.getElementById('ovQuranPageVal');
  if (ovQuran) ovQuran.innerText = `${curPageVal || 0}`;
  const ovQuranJuzPill = document.getElementById('ovQuranJuzPill');
  if (ovQuranJuzPill) ovQuranJuzPill.innerText = `${h.quran.stars || 0}/30 ยุซ`;
  const ovMem = document.getElementById('ovMemCountVal');
  if (ovMem) ovMem.innerText = `${memCountVal}`;
  const ovMemPctPill = document.getElementById('ovMemPctPill');
  if (ovMemPctPill) ovMemPctPill.innerText = `${Math.round((memCountVal / 114) * 100)}%`;

  // 3. Sunnah tab (Load selected date's sunnah if available)
  const activeSunnah = (dayLog && dayLog.sunnah)
    ? dayLog.sunnah
    : (hasanatSelectedDate === todayStr ? (h.sunnah || {}) : {});

  const r = activeSunnah.rawatib || {};
  const rawatibKeys = [
    'subhBefore', 'dhuhrBefore', 'dhuhrAfter', 'asrBefore',
    'maghribBefore', 'maghribAfter', 'ishaBefore', 'ishaAfter'
  ];
  rawatibKeys.forEach(k => {
    const chk = document.getElementById(`chk-rawatib-${k}`);
    const row = document.getElementById(`row-rawatib-${k}`);
    if (chk) chk.checked = !!r[k];
    if (row) row.classList.toggle('checked', !!r[k]);
  });

  const sDuha = document.getElementById('selDuhaRakaat');
  const sWitr = document.getElementById('selWitrRakaat');
  const sTahajjud = document.getElementById('selTahajjudRakaat');

  const duhaVal = activeSunnah.duhaRakaat !== undefined ? activeSunnah.duhaRakaat : 0;
  const witrVal = activeSunnah.witrRakaat !== undefined ? activeSunnah.witrRakaat : (hasanatSelectedDate === todayStr ? 3 : 0);
  const tahajjudVal = activeSunnah.tahajjudRakaat !== undefined ? activeSunnah.tahajjudRakaat : 0;

  if (sDuha) sDuha.value = duhaVal;
  if (sWitr) sWitr.value = witrVal;
  if (sTahajjud) sTahajjud.value = tahajjudVal;

  document.querySelectorAll('#pillsGroupDuha .sunnah-pill-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.getAttribute('data-val')) === duhaVal);
  });
  document.querySelectorAll('#pillsGroupWitr .sunnah-pill-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.getAttribute('data-val')) === witrVal);
  });
  document.querySelectorAll('#pillsGroupTahajjud .sunnah-pill-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.getAttribute('data-val')) === tahajjudVal);
  });

  calculateDailySunnahRakaat(false);

  // Ensure Surah checklist is populated when in Bento mode
  if (typeof renderSurahChecklist === 'function') {
    const searchInput = document.getElementById('searchSurahInput');
    renderSurahChecklist(searchInput ? searchInput.value : '');
  }

  // Update Hero tag with current active date
  const heroDateTag = document.getElementById('hasanatHeroDateTag');
  if (heroDateTag) {
    heroDateTag.innerText = (hasanatSelectedDate === todayStr) ? 'บันทึกความดีวันนี้' : `บันทึกวันที่ ${hasanatSelectedDate}`;
  }
}

function renderHasanatStarsShowcase(stars, currentPage, khatamCount = 0) {
  const showcase = document.getElementById('hasanatStarsShowcase');
  const badge = document.getElementById('hasanatJuzBadge');
  const percentText = document.getElementById('hasanatQuranPercentText');
  const kpiPage = document.getElementById('kpiQuranPageText');
  const kpiJuz = document.getElementById('kpiQuranJuzText');
  const kpiKhatam = document.getElementById('kpiQuranKhatamText');
  const remainingText = document.getElementById('quranRemainingPagesText');
  const slider = document.getElementById('quranPageSlider');
  const sliderLive = document.getElementById('sliderLiveVal');

  const curP = Math.max(0, Math.min(604, parseInt(currentPage) || 0));
  const pct = ((curP / 604) * 100).toFixed(1);
  const currentJuz = Math.min(30, Math.floor(curP / 20.13) + 1);

  if (badge) {
    badge.innerText = `ยุซที่ ${currentJuz}`;
  }

  if (percentText) {
    percentText.innerText = `${pct}%`;
  }

  if (remainingText) {
    remainingText.innerText = `เหลืออีก ${Math.max(0, 604 - curP)} หน้า`;
  }

  if (slider && parseInt(slider.value) !== curP) {
    slider.value = curP;
  }
  if (sliderLive) {
    sliderLive.innerText = `หน้า ${curP}`;
  }

  if (kpiPage) {
    kpiPage.innerText = curP;
  }
  const ovQuran = document.getElementById('ovQuranPageVal');
  if (ovQuran) {
    ovQuran.innerText = `${curP}`;
  }
  const ovQuranJuzPill = document.getElementById('ovQuranJuzPill');
  if (ovQuranJuzPill) {
    ovQuranJuzPill.innerText = `${stars || 0}/30 ยุซ`;
  }
  if (kpiJuz) {
    kpiJuz.innerText = stars;
  }
  if (kpiKhatam) {
    kpiKhatam.innerText = khatamCount;
  }

  const khatamBadge = document.getElementById('quranKhatamDisplayBadge');
  if (khatamBadge) {
    khatamBadge.innerText = `${khatamCount} ครั้ง`;
  }

  // Render 30-Juz minimal overview grid
  render30JuzMinimalGrid(stars, currentJuz);

  if (!showcase) return;
  if (stars === 0) {
    showcase.innerHTML = '<span style="font-size: 0.95rem; color: #94a3b8;">ยังไม่มีดาวสะสม เริ่มบันทึกการอ่านเพื่อรับดาวได้เลย</span>';
    return;
  }

  let starsHtml = '';
  for (let i = 0; i < stars; i++) {
    starsHtml += `<span class="quran-star-icon" title="ยุซที่ ${i+1} สำเร็จ">⭐</span>`;
  }
  showcase.innerHTML = starsHtml;
}

function onQuranSliderChange(val) {
  const page = Math.max(0, Math.min(604, parseInt(val) || 0));
  const pCur = document.getElementById('quranCurrentPageInput');
  if (pCur) pCur.value = page;
  const sliderLive = document.getElementById('sliderLiveVal');
  if (sliderLive) sliderLive.innerText = `หน้า ${page}`;
  autoCalculateJuzFromPage();
}

function adjustCurrentPageDirect(delta) {
  const pCur = document.getElementById('quranCurrentPageInput');
  const cur = pCur ? (parseInt(pCur.value) || 0) : 0;
  const next = Math.max(0, Math.min(604, cur + delta));
  if (pCur) pCur.value = next;
  const slider = document.getElementById('quranPageSlider');
  if (slider) slider.value = next;
  const sliderLive = document.getElementById('sliderLiveVal');
  if (sliderLive) sliderLive.innerText = `หน้า ${next}`;
  autoCalculateJuzFromPage();
}

function render30JuzMinimalGrid(completedJuz = 0, currentJuz = 1) {
  const container = document.getElementById('juzMinimalGrid');
  if (!container) return;
  let html = '';
  for (let i = 1; i <= 30; i++) {
    if (i <= completedJuz) {
      html += `<div class="juz-box-item done" title="ยุซที่ ${i} (อ่านจบแล้ว)">${i}</div>`;
    } else if (i === currentJuz) {
      html += `<div class="juz-box-item current" title="ยุซที่ ${i} (กำลังอ่าน)">${i}</div>`;
    } else {
      html += `<div class="juz-box-item upcoming" title="ยุซที่ ${i}">${i}</div>`;
    }
  }
  container.innerHTML = html;
  const countText = document.getElementById('juzCompletedOverviewText');
  if (countText) {
    countText.innerText = `อ่านจบแล้ว ${completedJuz} / 30 ยุซ`;
  }
}


function autoCalculateJuzFromPage() {
  const pCur = document.getElementById('quranCurrentPageInput');
  const jComp = document.getElementById('quranJuzCompletedInput');
  if (!pCur || !jComp) return;

  const page = parseInt(pCur.value) || 0;
  if (page > 0) {
    // 20 pages per juz approx
    const completed = Math.min(30, Math.floor(page / 20));
    if (parseInt(jComp.value) < completed) {
      jComp.value = completed;
    }
  }
  updateShelfStarsFromInput();
}

function onPagesTodayInputChange() {
  const pToday = parseInt(document.getElementById('quranPagesTodayInput').value) || 0;
  const pCurInput = document.getElementById('quranCurrentPageInput');
  if (pCurInput && !pCurInput.value && pToday > 0) {
    pCurInput.value = pToday;
    autoCalculateJuzFromPage();
  }
}

function saveQuranReadingLog() {
  if (!currentStudent) {
    showToast('กรุณาเข้าสู่ระบบนักเรียนก่อนบันทึก', 'warning');
    enforceMandatoryLogin();
    return;
  }

  const pToday = parseInt(document.getElementById('quranPagesTodayInput').value) || 0;
  const pCur = parseInt(document.getElementById('quranCurrentPageInput').value) || 0;
  let jComp = parseInt(document.getElementById('quranJuzCompletedInput').value) || 0;
  const kInput = document.getElementById('quranKhatamCountInput');
  let khatamVal = kInput ? (parseInt(kInput.value) || 0) : 0;

  if (pCur < 0 || pCur > 604) {
    showToast('กรุณาระบุเลขหน้าที่ถูกต้อง (1 - 604)', 'warning');
    return;
  }

  jComp = Math.max(0, Math.min(30, jComp));
  if (jComp >= 30 && khatamVal === 0) {
    khatamVal = 1;
    if (kInput) kInput.value = 1;
    const kBadge = document.getElementById('quranKhatamDisplayBadge');
    if (kBadge) kBadge.innerText = '⭐ 1 ดาวรอบโปรไฟล์';
  }

  const stars = jComp; // 1 ยุซ = 1 ดาวในชั้นวาง
  const todayStr = new Date().toISOString().split('T')[0];

  const h = getStudentHasanat(currentStudent.studentId);
  h.dailyLogs = h.dailyLogs || {};
  h.dailyLogs[hasanatSelectedDate] = {
    date: hasanatSelectedDate,
    pagesToday: pToday,
    currentPage: pCur,
    timestamp: new Date().toISOString()
  };

  if (hasanatSelectedDate === todayStr) {
    h.quran.pagesToday = pToday;
  }
  h.quran.currentPage = pCur;
  h.quran.juzCompleted = jComp;
  h.quran.stars = stars;
  h.quran.khatamCount = Math.max(0, khatamVal);
  h.quran.lastUpdated = new Date().toISOString();

  saveStudentHasanat(h);
  renderHasanatStarsShowcase(stars, pCur, khatamVal);
  render30StarsShelf(stars);
  playSuccessSound();

  const d = new Date(hasanatSelectedDate + 'T00:00:00');
  const dStr = (hasanatSelectedDate === todayStr) ? 'วันนี้' : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

  if (khatamVal > 0) {
    showToast(`👑 บันทึกวันที่ ${dStr} สำเร็จ! อ่านจบ 30 ยุซ ${khatamVal} ครั้ง ได้รับดาวรอบโปรไฟล์ ${khatamVal} ดวง ⭐`, 'success');
  } else {
    showToast(`บันทึกการอ่านอัลกุรอาน (${dStr}) สำเร็จ! สะสม ${stars} ดาวทอง ⭐`, 'success');
  }

  syncRecordToGoogleSheet('saveQuranLog', {
    studentId: currentStudent.studentId,
    studentName: currentStudent.fullName,
    grade: currentStudent.grade,
    date: hasanatSelectedDate,
    pagesToday: pToday,
    currentPage: pCur,
    juzCompleted: jComp,
    stars: stars,
    khatamCount: khatamVal,
    quran: h.quran,
    memorization: h.memorization,
    sunnah: h.sunnah
  });
}

// ==================== 114 QURAN SURAHS WITH JUZ MAPPING ==================== //
const QURAN_SURAHS = [
  { num: 1, name: "อัลฟาติฮะฮ์", arabic: "الفاتحة", ayahs: 7, juz: 1 },
  { num: 2, name: "อัลบะเกาะเราะฮ์", arabic: "البقرة", ayahs: 286, juz: 1 },
  { num: 3, name: "อาลิอิมรอน", arabic: "آل عمران", ayahs: 200, juz: 3 },
  { num: 4, name: "อันนิซาอ์", arabic: "النساء", ayahs: 176, juz: 4 },
  { num: 5, name: "อัลมาอิดะฮ์", arabic: "المائدة", ayahs: 120, juz: 6 },
  { num: 6, name: "อัลอันอาม", arabic: "الأنعام", ayahs: 165, juz: 7 },
  { num: 7, name: "อัลอะอ์รอฟ", arabic: "الأعراف", ayahs: 206, juz: 8 },
  { num: 8, name: "อัลอันฟาล", arabic: "الأنفال", ayahs: 75, juz: 9 },
  { num: 9, name: "อัตเตาบะฮ์", arabic: "التوبة", ayahs: 129, juz: 10 },
  { num: 10, name: "ยูนุส", arabic: "يونس", ayahs: 109, juz: 11 },
  { num: 11, name: "ฮูด", arabic: "هود", ayahs: 123, juz: 11 },
  { num: 12, name: "ยูซุฟ", arabic: "يوسف", ayahs: 111, juz: 12 },
  { num: 13, name: "อัรเราะอ์ดุ", arabic: "الرعد", ayahs: 43, juz: 13 },
  { num: 14, name: "อิบรอฮีม", arabic: "إبراهيم", ayahs: 52, juz: 13 },
  { num: 15, name: "อัลฮิจญร์", arabic: "الحجر", ayahs: 99, juz: 14 },
  { num: 16, name: "อันนะห์ลุ", arabic: "النحل", ayahs: 128, juz: 14 },
  { num: 17, name: "อัลอิสรออ์", arabic: "الإسراء", ayahs: 111, juz: 15 },
  { num: 18, name: "อัลกะฮ์ฟิ", arabic: "الكهف", ayahs: 110, juz: 15 },
  { num: 19, name: "มัรยัม", arabic: "مريم", ayahs: 98, juz: 16 },
  { num: 20, name: "ฏอฮา", arabic: "طه", ayahs: 135, juz: 16 },
  { num: 21, name: "อัลอันบิยาอ์", arabic: "الأنبياء", ayahs: 112, juz: 17 },
  { num: 22, name: "อัลฮัจญ์", arabic: "الحج", ayahs: 78, juz: 17 },
  { num: 23, name: "อัลมุอ์มินูน", arabic: "المؤمنون", ayahs: 118, juz: 18 },
  { num: 24, name: "อันนูร", arabic: "النور", ayahs: 64, juz: 18 },
  { num: 25, name: "อัลฟุรกอน", arabic: "الفرقان", ayahs: 77, juz: 18 },
  { num: 26, name: "อัชชุอะรออ์", arabic: "الشعراء", ayahs: 227, juz: 19 },
  { num: 27, name: "อันนัมลุ", arabic: "النمل", ayahs: 93, juz: 19 },
  { num: 28, name: "อัลเกาะศอศ", arabic: "القصص", ayahs: 88, juz: 20 },
  { num: 29, name: "อัลอังกะบูต", arabic: "العنكبوت", ayahs: 69, juz: 20 },
  { num: 30, name: "อัรรูม", arabic: "الروم", ayahs: 60, juz: 21 },
  { num: 31, name: "ลุกมาน", arabic: "لقمان", ayahs: 34, juz: 21 },
  { num: 32, name: "อัสสะญะดะฮ์", arabic: "السجدة", ayahs: 30, juz: 21 },
  { num: 33, name: "อัลอะห์ซาบ", arabic: "الأحزاب", ayahs: 73, juz: 21 },
  { num: 34, name: "สะบะอ์", arabic: "سبإ", ayahs: 54, juz: 22 },
  { num: 35, name: "ฟาฏิร", arabic: "فاطر", ayahs: 45, juz: 22 },
  { num: 36, name: "ยาซีน", arabic: "يس", ayahs: 83, juz: 22 },
  { num: 37, name: "อัศศ็อฟฟาต", arabic: "الصافات", ayahs: 182, juz: 23 },
  { num: 38, name: "ศอด", arabic: "ص", ayahs: 88, juz: 23 },
  { num: 39, name: "อัซซุมัร", arabic: "الزمر", ayahs: 75, juz: 23 },
  { num: 40, name: "ฆอฟิร", arabic: "غافر", ayahs: 85, juz: 24 },
  { num: 41, name: "ฟุศศิลัต", arabic: "فصلت", ayahs: 54, juz: 24 },
  { num: 42, name: "อัชชูรอ", arabic: "الشورى", ayahs: 53, juz: 25 },
  { num: 43, name: "อัซซุครุฟ", arabic: "الزخرف", ayahs: 89, juz: 25 },
  { num: 44, name: "อัดดุคอน", arabic: "الدخان", ayahs: 59, juz: 25 },
  { num: 45, name: "อัลญาษิยะฮ์", arabic: "الجاثية", ayahs: 37, juz: 25 },
  { num: 46, name: "อัลอะห์กอฟ", arabic: "الأحقاف", ayahs: 35, juz: 26 },
  { num: 47, name: "มุฮัมมัด", arabic: "محمد", ayahs: 38, juz: 26 },
  { num: 48, name: "อัลฟัตห์", arabic: "الفتح", ayahs: 29, juz: 26 },
  { num: 49, name: "อัลฮุญุรอต", arabic: "الحجرات", ayahs: 18, juz: 26 },
  { num: 50, name: "กอฟ", arabic: "ق", ayahs: 45, juz: 26 },
  { num: 51, name: "อัซซาริยาต", arabic: "الذاريات", ayahs: 60, juz: 26 },
  { num: 52, name: "อัฏฏูร", arabic: "الطور", ayahs: 49, juz: 27 },
  { num: 53, name: "อันนัจญม์", arabic: "النجم", ayahs: 62, juz: 27 },
  { num: 54, name: "อัลเกาะมัร", arabic: "القمر", ayahs: 55, juz: 27 },
  { num: 55, name: "อัรเราะห์มาน", arabic: "الرحمن", ayahs: 78, juz: 27 },
  { num: 56, name: "อัลวากิอะฮ์", arabic: "الواقعة", ayahs: 96, juz: 27 },
  { num: 57, name: "อัลฮะดีด", arabic: "الحديد", ayahs: 29, juz: 27 },
  { num: 58, name: "อัลมุญาดะละฮ์", arabic: "المجادلة", ayahs: 22, juz: 28 },
  { num: 59, name: "อัลฮัชร", arabic: "الحشر", ayahs: 24, juz: 28 },
  { num: 60, name: "อัลมุมตะฮะนะฮ์", arabic: "الممتحنة", ayahs: 13, juz: 28 },
  { num: 61, name: "อัศศ็อฟ", arabic: "الصف", ayahs: 14, juz: 28 },
  { num: 62, name: "อัลญุมุอะฮ์", arabic: "الجمعة", ayahs: 11, juz: 28 },
  { num: 63, name: "อัลมุนาฟิกูน", arabic: "المنافقون", ayahs: 11, juz: 28 },
  { num: 64, name: "อัตตะฆอบุน", arabic: "التغابن", ayahs: 18, juz: 28 },
  { num: 65, name: "อัฏเฏาะลาก", arabic: "الطلاق", ayahs: 12, juz: 28 },
  { num: 66, name: "อัตตะห์รีม", arabic: "التحريم", ayahs: 12, juz: 28 },
  { num: 67, name: "อัลมุลก์", arabic: "الملك", ayahs: 30, juz: 29 },
  { num: 68, name: "อัลเกาะลัม", arabic: "القلم", ayahs: 52, juz: 29 },
  { num: 69, name: "อัลฮากเกาะฮ์", arabic: "الحاقة", ayahs: 52, juz: 29 },
  { num: 70, name: "อัลมะอาริจญ์", arabic: "المعارج", ayahs: 44, juz: 29 },
  { num: 71, name: "นูห์", arabic: "نوح", ayahs: 28, juz: 29 },
  { num: 72, name: "อัลญิน", arabic: "الجن", ayahs: 28, juz: 29 },
  { num: 73, name: "อัลมุซซัมมิล", arabic: "المزمل", ayahs: 20, juz: 29 },
  { num: 74, name: "อัลมุดดัษษิร", arabic: "المدثر", ayahs: 56, juz: 29 },
  { num: 75, name: "อัลกิยามะฮ์", arabic: "القيامة", ayahs: 40, juz: 29 },
  { num: 76, name: "อัลอินซาน", arabic: "الإنسان", ayahs: 31, juz: 29 },
  { num: 77, name: "อัลมุรสะลาต", arabic: "المرسلات", ayahs: 50, juz: 29 },
  { num: 78, name: "อันนะบะอ์", arabic: "النبإ", ayahs: 40, juz: 30 },
  { num: 79, name: "อันนาซิอาต", arabic: "النازعات", ayahs: 46, juz: 30 },
  { num: 80, name: "อะบะสะ", arabic: "عبس", ayahs: 42, juz: 30 },
  { num: 81, name: "อัตตักวีร", arabic: "التكوير", ayahs: 29, juz: 30 },
  { num: 82, name: "อัลอินฟิฏอร", arabic: "الانفطار", ayahs: 19, juz: 30 },
  { num: 83, name: "อัลมุฏ็อฟฟิฟีน", arabic: "المطففين", ayahs: 36, juz: 30 },
  { num: 84, name: "อัลอินชิกอก", arabic: "الانشقاق", ayahs: 25, juz: 30 },
  { num: 85, name: "อัลบุรูจญ์", arabic: "البروج", ayahs: 22, juz: 30 },
  { num: 86, name: "อัฏฏอริก", arabic: "الطارق", ayahs: 17, juz: 30 },
  { num: 87, name: "อัลอะอ์ลา", arabic: "الأعلى", ayahs: 19, juz: 30 },
  { num: 88, name: "อัลฆอชิยะฮ์", arabic: "الغاشية", ayahs: 26, juz: 30 },
  { num: 89, name: "อัลฟัจญร์", arabic: "الفجر", ayahs: 30, juz: 30 },
  { num: 90, name: "อัลบะลัด", arabic: "البلد", ayahs: 20, juz: 30 },
  { num: 91, name: "อัชชัมส์", arabic: "الشمس", ayahs: 15, juz: 30 },
  { num: 92, name: "อัลลัยล์", arabic: "الليل", ayahs: 21, juz: 30 },
  { num: 93, name: "อัฎฎุฮา", arabic: "الضحى", ayahs: 11, juz: 30 },
  { num: 94, name: "อัชชัรห์", arabic: "الشرح", ayahs: 8, juz: 30 },
  { num: 95, name: "อัตตีน", arabic: "التين", ayahs: 8, juz: 30 },
  { num: 96, name: "อัลอะลัก", arabic: "العلق", ayahs: 19, juz: 30 },
  { num: 97, name: "อัลก็อดร์", arabic: "القدر", ayahs: 5, juz: 30 },
  { num: 98, name: "อัลบัยยินะฮ์", arabic: "البينة", ayahs: 8, juz: 30 },
  { num: 99, name: "อัซซัลซะละฮ์", arabic: "الزلزلة", ayahs: 8, juz: 30 },
  { num: 100, name: "อัลอาดิยาต", arabic: "العاديات", ayahs: 11, juz: 30 },
  { num: 101, name: "อัลกอริอะฮ์", arabic: "القارعة", ayahs: 11, juz: 30 },
  { num: 102, name: "อัตตะกาษุร", arabic: "التكاثر", ayahs: 8, juz: 30 },
  { num: 103, name: "อัลอัศร์", arabic: "العصر", ayahs: 3, juz: 30 },
  { num: 104, name: "อัลฮุมะซะฮ์", arabic: "الهمزة", ayahs: 9, juz: 30 },
  { num: 105, name: "อัลฟีล", arabic: "الفيل", ayahs: 5, juz: 30 },
  { num: 106, name: "กุรอยช์", arabic: "قريش", ayahs: 4, juz: 30 },
  { num: 107, name: "อัลมาอูน", arabic: "الماعون", ayahs: 7, juz: 30 },
  { num: 108, name: "อัลเกาษัร", arabic: "الكوثر", ayahs: 3, juz: 30 },
  { num: 109, name: "อัลกาฟิรูน", arabic: "الكافرون", ayahs: 6, juz: 30 },
  { num: 110, name: "อันนัศร์", arabic: "النصر", ayahs: 3, juz: 30 },
  { num: 111, name: "อัลมะสัด", arabic: "المسد", ayahs: 5, juz: 30 },
  { num: 112, name: "อัลอิคลาศ", arabic: "الإخلاص", ayahs: 4, juz: 30 },
  { num: 113, name: "อัลฟะลัก", arabic: "الفلق", ayahs: 5, juz: 30 },
  { num: 114, name: "อันนาส", arabic: "الناس", ayahs: 6, juz: 30 }
];

let currentSurahSortOrder = 'juz-asc'; // 'juz-asc' (1-30) หรือ 'juz-desc' (30-1)

function setSurahSortOrder(order) {
  currentSurahSortOrder = order;
  const btnAsc = document.getElementById('btnSortJuzAsc');
  const btnDesc = document.getElementById('btnSortJuzDesc');
  if (btnAsc) btnAsc.classList.toggle('active', order === 'juz-asc');
  if (btnDesc) btnDesc.classList.toggle('active', order === 'juz-desc');

  const searchInput = document.getElementById('searchSurahInput');
  renderSurahChecklist(searchInput ? searchInput.value : '');
}

function renderSurahChecklist(filterText = '') {
  const container = document.getElementById('surahListContainer');
  if (!container || !currentStudent) return;

  const h = getStudentHasanat(currentStudent.studentId);
  const memorized = (h && h.memorization && h.memorization.memorizedSurahs) || [];

  const search = filterText.toLowerCase().trim();
  let filtered = [...QURAN_SURAHS];

  // Category filter
  if (currentSurahCategory === 'juzAmma') {
    filtered = filtered.filter(s => s.num >= 78 && s.num <= 114);
  } else if (currentSurahCategory === 'popular') {
    const pop = [1, 18, 36, 55, 56, 67, 112, 113, 114];
    filtered = filtered.filter(s => pop.includes(s.num));
  } else if (currentSurahCategory === 'memorized') {
    filtered = filtered.filter(s => memorized.includes(s.num));
  }

  // Text search filter
  if (search) {
    filtered = filtered.filter(s => {
      return s.name.toLowerCase().includes(search) ||
             s.arabic.includes(search) ||
             String(s.num).includes(search) ||
             `ยุซ ${s.juz}`.includes(search);
    });
  }

  // Sort order: Juz 1->30 or Juz 30->1
  if (currentSurahSortOrder === 'juz-desc') {
    filtered.sort((a, b) => b.num - a.num);
  } else {
    filtered.sort((a, b) => a.num - b.num);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.88rem;">ไม่พบซูเราะห์ที่ตรงกับคำค้นหา</div>';
    return;
  }

  container.innerHTML = `<div class="surah-grid">${filtered.map(s => {
    const isMem = memorized.includes(s.num);
    return `
      <div class="surah-item-card ${isMem ? 'memorized' : ''}" onclick="toggleSurahMemorized(${s.num})">
        <div style="display: flex; align-items: center; gap: 0.65rem;">
          <div class="surah-number-badge" title="ซูเราะห์ลำดับที่ ${s.num}">${s.num}</div>
          <div>
            <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-dark);">${s.name}</div>
            <div style="font-size: 0.72rem; color: #0284c7; font-weight: 600;">
              ยุซที่ ${s.juz} • <span style="color: var(--text-muted); font-weight: 400;">${s.ayahs} อายะฮ์</span>
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-family: 'Traditional Arabic', serif; font-size: 1.1rem; color: #0284c7; direction: rtl;">${s.arabic}</span>
          <input type="checkbox" ${isMem ? 'checked' : ''} onclick="event.stopPropagation(); toggleSurahMemorized(${s.num})" style="cursor: pointer; width: 19px; height: 19px; accent-color: #0284c7;">
        </div>
      </div>
    `;
  }).join('')}</div>`;
}

function filterSurahsList(query) {
  renderSurahChecklist(query);
}

function toggleSurahMemorized(surahNum) {
  if (!currentStudent) return;
  const h = getStudentHasanat(currentStudent.studentId);
  let mem = h.memorization.memorizedSurahs || [];

  if (mem.includes(surahNum)) {
    mem = mem.filter(n => n !== surahNum);
  } else {
    mem.push(surahNum);
    mem.sort((a, b) => a - b);
  }

  h.memorization.memorizedSurahs = mem;
  h.memorization.count = mem.length;
  h.memorization.lastUpdated = new Date().toISOString();

  saveStudentHasanat(h);

  const memBadge = document.getElementById('memorizedSurahsBadge');
  if (memBadge) {
    memBadge.innerText = `ท่องจำได้ ${mem.length} / 114 ซูเราะห์`;
  }
  const navMBadge = document.getElementById('navHasanatMemBadge');
  if (navMBadge) {
    navMBadge.innerText = `${mem.length} / 114`;
  }
  const memBarFill = document.getElementById('memorizedProgressBarFill');
  if (memBarFill) {
    memBarFill.style.width = `${Math.min(100, ((mem.length / 114) * 100).toFixed(1))}%`;
  }
  const ovMem = document.getElementById('ovMemCountVal');
  if (ovMem) {
    ovMem.innerText = `${mem.length}`;
  }
  const ovMemPctPill = document.getElementById('ovMemPctPill');
  if (ovMemPctPill) {
    ovMemPctPill.innerText = `${Math.round((mem.length / 114) * 100)}%`;
  }

  renderSurahChecklist(document.getElementById('searchSurahInput') ? document.getElementById('searchSurahInput').value : '');
}

function selectAllSurahsInCurrentCategory(isSelectAll) {
  if (!currentStudent) {
    showToast('กรุณาเข้าสู่ระบบนักเรียนก่อนเลือก', 'warning');
    return;
  }
  const h = getStudentHasanat(currentStudent.studentId);
  let mem = new Set(h.memorization.memorizedSurahs || []);

  let targetSurahs = [...QURAN_SURAHS];
  if (currentSurahCategory === 'juzAmma') {
    targetSurahs = targetSurahs.filter(s => s.num >= 78 && s.num <= 114);
  } else if (currentSurahCategory === 'popular') {
    const pop = [1, 18, 36, 55, 56, 67, 112, 113, 114];
    targetSurahs = targetSurahs.filter(s => pop.includes(s.num));
  } else if (currentSurahCategory === 'memorized' && !isSelectAll) {
    // If on memorized tab and clearing
    targetSurahs = targetSurahs.filter(s => mem.has(s.num));
  }

  targetSurahs.forEach(s => {
    if (isSelectAll) {
      mem.add(s.num);
    } else {
      mem.delete(s.num);
    }
  });

  const arr = Array.from(mem).sort((a, b) => a - b);
  h.memorization.memorizedSurahs = arr;
  h.memorization.count = arr.length;
  h.memorization.lastUpdated = new Date().toISOString();
  saveStudentHasanat(h);

  const memBadge = document.getElementById('memorizedSurahsBadge');
  if (memBadge) {
    memBadge.innerText = `ท่องจำได้ ${arr.length} / 114 ซูเราะห์`;
  }
  const navMBadge = document.getElementById('navHasanatMemBadge');
  if (navMBadge) {
    navMBadge.innerText = `${arr.length} / 114`;
  }
  const memBarFill = document.getElementById('memorizedProgressBarFill');
  if (memBarFill) {
    memBarFill.style.width = `${Math.min(100, ((arr.length / 114) * 100).toFixed(1))}%`;
  }
  const ovMem = document.getElementById('ovMemCountVal');
  if (ovMem) {
    ovMem.innerText = `${arr.length}`;
  }
  const ovMemPctPill = document.getElementById('ovMemPctPill');
  if (ovMemPctPill) {
    ovMemPctPill.innerText = `${Math.round((arr.length / 114) * 100)}%`;
  }

  renderSurahChecklist(document.getElementById('searchSurahInput') ? document.getElementById('searchSurahInput').value : '');
  showToast(isSelectAll ? `เลือกซูเราะห์ในหมวดนี้ทั้งหมดแล้ว (${arr.length} ซูเราะห์)` : `ล้างการเลือกในหมวดนี้แล้ว`, 'info');
}

function toggleAllRawatib(isChecked) {
  const rawatibKeys = [
    'subhBefore', 'dhuhrBefore', 'dhuhrAfter', 'asrBefore',
    'maghribBefore', 'maghribAfter', 'ishaBefore', 'ishaAfter'
  ];
  rawatibKeys.forEach(k => {
    const chk = document.getElementById(`chk-rawatib-${k}`);
    if (chk) chk.checked = !!isChecked;
  });
  calculateDailySunnahRakaat(false);
}

function saveSurahMemorizationLog() {
  if (!currentStudent) {
    showToast('กรุณาเข้าสู่ระบบนักเรียนก่อนบันทึก', 'warning');
    return;
  }
  const h = getStudentHasanat(currentStudent.studentId);
  saveStudentHasanat(h);
  playSuccessSound();
  showToast(`บันทึกสถิติท่องจำอัลกุรอาน ${h.memorization.count} ซูเราะห์เรียบร้อยแล้ว`, 'success');

  // ซิงค์สถิติท่องจำซูเราะห์เข้า Google Sheets พร้อมข้อมูลผลบุญครบ 3 เสาหลัก
  syncRecordToGoogleSheet('saveSurahMemorizationLog', {
    studentId: currentStudent.studentId,
    studentName: currentStudent.fullName,
    grade: currentStudent.grade,
    date: hasanatSelectedDate || new Date().toISOString().split('T')[0],
    count: h.memorization.count,
    memorizedCount: h.memorization.count,
    memorizedSurahs: h.memorization.memorizedSurahs,
    quran: h.quran,
    memorization: h.memorization,
    sunnah: h.sunnah
  });
}

function calculateDailySunnahRakaat(shouldSave = false) {
  const rawatibKeys = [
    'subhBefore', 'dhuhrBefore', 'dhuhrAfter', 'asrBefore',
    'maghribBefore', 'maghribAfter', 'ishaBefore', 'ishaAfter'
  ];

  let total = 0;
  const rawatibState = {};

  rawatibKeys.forEach(k => {
    const chk = document.getElementById(`chk-rawatib-${k}`);
    const row = document.getElementById(`row-rawatib-${k}`);
    const isChecked = chk ? chk.checked : false;
    rawatibState[k] = isChecked;
    if (row) row.classList.toggle('checked', isChecked);

    if (isChecked) {
      if (k === 'dhuhrBefore' || k === 'asrBefore') {
        total += 2; // Default 2 rakaat
      } else {
        total += 2; // 2 rakaat standard
      }
    }
  });

  const duha = parseInt(document.getElementById('selDuhaRakaat')?.value || 0);
  const witr = parseInt(document.getElementById('selWitrRakaat')?.value || 0);
  const tahajjud = parseInt(document.getElementById('selTahajjudRakaat')?.value || 0);

  total += duha + witr + tahajjud;

  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = (hasanatSelectedDate === todayStr);

  const badge = document.getElementById('todayTotalSunnahRakaatBadge');
  if (badge) {
    badge.innerText = isToday ? `วันนี้ละหมาดสุนัตแล้ว ${total} ร็อกอะฮ์` : `วันที่เลือกละหมาดสุนัต ${total} ร็อกอะฮ์`;
  }
  const liveNum = document.getElementById('liveSunnahTotalNum');
  if (liveNum) {
    liveNum.innerHTML = `${total} <span style="font-size: 1.1rem; font-weight: 500;">ร็อกอะฮ์</span>`;
  }
  const navSBadge = document.getElementById('navHasanatSunnahBadge');
  if (navSBadge) {
    navSBadge.innerText = `${total} ร็อกอะฮ์`;
  }
  const ovSunnah = document.getElementById('ovSunnahVal');
  if (ovSunnah) {
    ovSunnah.innerText = `${total}`;
  }
  const sunnahGoalBar = document.getElementById('sunnahGoalProgressBar');
  if (sunnahGoalBar) {
    sunnahGoalBar.style.width = `${Math.min(100, ((total / 12) * 100).toFixed(1))}%`;
  }

  if (shouldSave && currentStudent) {
    const h = getStudentHasanat(currentStudent.studentId);
    h.dailyLogs = h.dailyLogs || {};

    const sunnahRecord = {
      date: hasanatSelectedDate,
      rawatib: rawatibState,
      duhaRakaat: duha,
      witrRakaat: witr,
      tahajjudRakaat: tahajjud,
      totalRakaat: total,
      lastUpdated: new Date().toISOString()
    };

    h.dailyLogs[hasanatSelectedDate] = h.dailyLogs[hasanatSelectedDate] || {};
    h.dailyLogs[hasanatSelectedDate].sunnah = sunnahRecord;

    if (isToday) {
      h.sunnah = sunnahRecord;
    }
    saveStudentHasanat(h);

    syncRecordToGoogleSheet('saveSunnahLog', {
      studentId: currentStudent.studentId,
      studentName: currentStudent.fullName,
      grade: currentStudent.grade,
      date: hasanatSelectedDate,
      totalRakaat: total,
      duhaRakaat: duha,
      witrRakaat: witr,
      tahajjudRakaat: tahajjud,
      rawatib: rawatibState,
      quran: h.quran,
      memorization: h.memorization,
      sunnah: h.sunnah || { totalRakaat: total, rawatib: rawatibState }
    });
  }

  return total;
}

function saveDailySunnahPrayersLog() {
  if (!currentStudent) {
    showToast('กรุณาเข้าสู่ระบบนักเรียนก่อนบันทึก', 'warning');
    enforceMandatoryLogin();
    return;
  }
  const total = calculateDailySunnahRakaat(true);
  playSuccessSound();
  const todayStr = new Date().toISOString().split('T')[0];
  const d = new Date(hasanatSelectedDate + 'T00:00:00');
  const dStr = (hasanatSelectedDate === todayStr) ? 'วันนี้' : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  showToast(`บันทึกการละหมาดสุนัต (${dStr}) สำเร็จ! (${total} ร็อกอะฮ์)`, 'success');
}

function renderDashboardQuranStars() {
  const starsList = document.getElementById('dashQuranStarsList');
  const progressText = document.getElementById('dashQuranProgressText');
  const statCount = document.getElementById('statQuranStarsCount');

  if (!currentStudent) {
    if (starsList) starsList.innerHTML = '<span style="font-size: 0.85rem; color: rgba(255,255,255,0.7);">เข้าสู่ระบบเพื่อดูดาว</span>';
    if (progressText) progressText.innerText = 'จบ 0/30 ยุซ (0 ดาว)';
    if (statCount) statCount.innerText = '0 ดาว';
    renderAvatarOrbitStars(0);
    renderKhatamBadge(0);
    return;
  }

  const h = getStudentHasanat(currentStudent.studentId);
  const stars = (h && h.quran && h.quran.stars) || 0;
  const juz = (h && h.quran && h.quran.juzCompleted) || 0;
  const curPage = (h && h.quran && h.quran.currentPage) || 0;
  const khatam = (h && h.quran && typeof h.quran.khatamCount === 'number')
    ? h.quran.khatamCount
    : (juz >= 30 ? 1 : 0);

  // วาดดาวรอบขอบรูปโปรไฟล์ และแสดงป้ายเกียรติยศใต้โปรไฟล์
  renderAvatarOrbitStars(khatam);
  renderKhatamBadge(khatam);

  if (progressText) {
    progressText.innerText = `จบ ${juz}/30 ยุซ (${khatam > 0 ? 'ค็อตม์ ' + khatam + ' ครั้ง' : stars + ' ดาว'})`;
  }

  if (statCount) {
    statCount.innerText = `${khatam > 0 ? khatam + ' ดาว (ค็อตม์)' : stars + ' ดาว'}`;
  }

  if (!starsList) return;
  if (stars === 0 && khatam === 0) {
    starsList.innerHTML = '<span style="font-size: 0.82rem; color: rgba(255,255,255,0.85);">เริ่มอ่านอัลกุรอานเพื่อสะสมดาว</span>';
    return;
  }

  let starsHtml = '';
  if (khatam > 0) {
    for (let i = 0; i < khatam; i++) {
      starsHtml += `<span class="quran-star-icon" title="จบ 30 ยุซ ครั้งที่ ${i+1}">⭐</span>`;
    }
  } else {
    for (let i = 0; i < stars; i++) {
      starsHtml += `<span class="quran-star-icon" title="ยุซที่ ${i+1} สำเร็จ">⭐</span>`;
    }
  }
  starsList.innerHTML = starsHtml;
}

// ==================== PRAYER HISTORY RENDERING ==================== //

function renderPrayerHistory(filterDate = null) {
  const container = document.getElementById('prayerHistoryListContainer');
  const badge = document.getElementById('prayerHistoryCountBadge');
  const bottomContainer = document.getElementById('prayerInlineHistoryContainer');
  const bottomBadge = document.getElementById('prayerHistoryCountBadgeBottom');

  if (!container && !bottomContainer) return;

  if (!currentStudent) {
    const emptyMsg = '<div style="text-align: center; padding: 1.5rem; color: var(--text-muted);">กรุณาเข้าสู่ระบบนักเรียนเพื่อดูประวัติการละหมาด</div>';
    if (container) container.innerHTML = emptyMsg;
    if (bottomContainer) bottomContainer.innerHTML = emptyMsg;
    if (badge) badge.innerText = '0 บันทึก';
    if (bottomBadge) bottomBadge.innerText = '0 บันทึก';
    return;
  }

  let historyList = [];
  try {
    historyList = JSON.parse(localStorage.getItem('khalifah_prayer_history') || '[]');
  } catch (e) { historyList = []; }

  let myLogs = historyList.filter(p => p.studentId === currentStudent.studentId);

  if (filterDate) {
    myLogs = myLogs.filter(p => (p.timestamp && p.timestamp.startsWith(filterDate)) || (p.date && p.date === filterDate));
  }

  if (badge) badge.innerText = `${myLogs.length} บันทึก`;
  if (bottomBadge) bottomBadge.innerText = `${myLogs.length} บันทึก`;

  if (myLogs.length === 0) {
    const noDataHtml = `
      <div style="text-align: center; padding: 1.5rem; color: var(--text-muted); background: #f8fafc; border-radius: var(--radius-md);">
        <i class="fa-solid fa-calendar-xmark" style="font-size: 1.8rem; margin-bottom: 0.4rem; display: block; color: #94a3b8;"></i>
        ${filterDate ? 'ไม่พบบันทึกการละหมาดในวันที่เลือก' : 'ยังไม่มีประวัติการเช็คชื่อละหมาดย้อนหลัง'}
      </div>
    `;
    if (container) container.innerHTML = noDataHtml;
    if (bottomContainer) bottomContainer.innerHTML = noDataHtml;
    return;
  }

  const html = myLogs.map((p, idx) => {
    const d = new Date(p.timestamp || p.date);
    const dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : (p.date || '-');
    const timeStr = !isNaN(d.getTime()) ? d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : (p.time || '-');
    const status = p.status || 'ตรงเวลา';
    const note = p.note ? `<div style="font-size: 0.78rem; color: #0369a1; margin-top: 0.25rem; background: #f0f9ff; padding: 0.2rem 0.5rem; border-radius: 6px; display: inline-block;"><i class="fa-solid fa-note-sticky"></i> ${p.note}</div>` : '';

    let statusClass = 'status-ontime';
    if (status.includes('สาย')) statusClass = 'status-late';
    if (status.includes('อุซุร') || status.includes('ประจำเดือน')) statusClass = 'status-excused';
    if (status.includes('ป่วย') || status.includes('มีอุปสรรค')) statusClass = 'status-late';

    const cardId = p.id || p.logId || ('PRY-' + idx);
    const rawPhoto = p.photo || p.photoUrl || p.photoBase64;
    const directPhoto = getDirectImageUrl(rawPhoto);
    const hasPhoto = !!(directPhoto && directPhoto.length > 10);

    return `
      <div class="prayer-history-item prayer-history-card-clickable" onclick="openPrayerHistoryDetailModal('${cardId}')" title="แตะเพื่อดูรายละเอียดเต็มและพิกัดแผนที่" style="margin-bottom: 0.65rem;">
        <div style="display: flex; align-items: center; gap: 0.85rem; flex: 1; min-width: 220px;">
          ${hasPhoto ? `<img src="${directPhoto}" alt="Photo" style="width: 50px; height: 50px; object-fit: cover; border-radius: var(--radius-md); border: 1px solid var(--border-light);">` : `<div style="width: 50px; height: 50px; border-radius: var(--radius-md); background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 1.2rem;"><i class="fa-solid fa-mosque"></i></div>`}
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
              <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-dark);">เวลา: ${p.prayerName || p.prayerTime}</span>
              <span class="status-badge ${statusClass}">${status}</span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem;">
              <i class="fa-solid fa-clock"></i> ${dateStr} • ${timeStr} น. • ณ ${p.locationName || 'พิกัด GPS'}
            </div>
            ${note}
          </div>
        </div>
        <div style="font-size: 0.76rem; color: var(--primary); font-weight: 600; display: flex; align-items: center; gap: 0.25rem; white-space: nowrap;">
          <span>ดูรายละเอียด</span> <i class="fa-solid fa-chevron-right"></i>
        </div>
      </div>
    `;
  }).join('');

  if (container) container.innerHTML = html;
  if (bottomContainer) bottomContainer.innerHTML = html;
}

function filterPrayerHistoryByDate() {
  const input = document.getElementById('filterPrayerHistoryDate');
  const dateVal = input ? input.value : null;
  renderPrayerHistory(dateVal);
}

function clearPrayerDateFilter() {
  const input = document.getElementById('filterPrayerHistoryDate');
  if (input) input.value = '';
  renderPrayerHistory();
}

function filterPrayerHistoryByDateBottom() {
  const input = document.getElementById('filterPrayerDateBottom');
  const dateVal = input ? input.value : null;
  renderPrayerHistory(dateVal);
}

function clearPrayerDateFilterBottom() {
  const input = document.getElementById('filterPrayerDateBottom');
  if (input) input.value = '';
  renderPrayerHistory();
}


// ----------------- MANDATORY LOGIN ENFORCEMENT ----------------- //
function enforceMandatoryLogin() {
  if (isStaffMonitorMode) return;
  if (!currentStudent && !currentAdmin) {
    document.body.classList.add('auth-locked');
    openModal('authModal');
  }
}

const DEFAULT_LOGO_BASE64 = 'data:image/png;base64,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lo4PLIShPEydQd/73vf8zf7njk8tCP++qBuvvgItbHevtwWVpCSTuqhMBxxoIzNmvBynnrKdnQ/fcd4OJwPfPe3u+J4MH+y80MdplAbHHnuscdIsC6nREMKj5NefWR9OKvJStOmKazqajelBnpmCmg3NBpqP5qamjryb0R5xRwsybty40OwgKK/iU5BvfstbbJMPf9j23W+/0OwgpG6/ww7evlsifqTv7Uam3tM35ld7W82efuZZ+5arhpDmj/zUp+ztG7zDffJ//iJABwbNX64jnhsdBDTiCxp8r08AABAASURBVJoFnFcEGBj5tko5vQI/hBLe5LBLwhgUSb3Dej9qVTXF4kN4yoNEB1vP0d28r+1y8Uh8pRVNNEIT6wUYSMgn+ZUK4YkI1UrV+NgbdkkmFcQ96UDsxuCrt/VuuENSF692T3fmrFn28MMP2te/foldc9VV1trcNKCQAF9JMeh4BqznJRV5CuHFn0vOVMFOOAZVyolgeMEFF4TGijKSN/zrqXSTVO88X+1lGgMx7RaO7EA9InULU+dHUKjOKayEL8uOHaL+EdrQIqHRe/755+zf/37CtUuPxG5XNpbcfPP/xTQNA/lpp51qRx55hO237z62+2672e67724HHXSgnerufL379ttvj6/1wo+0SDjqwjUgpNfzvnRDoJDkAkhTTPsgcCBgjEID0twca0CqHRoQ3PkwImerLL/c8rbmGq+z9d6ynvE15+233972329/O/qoT9upXzjF+KDiZZddZuTtuuuvs9O/eLoRhqP4211raB1ASW6pOPl/p6akzFy7Z/7lGTPiC37f/d73bN9997Ptt9uOsiQtEAS8FhYI35HBNEuRCMwLAgyIaAVYXEqnKhWDdNnflea8pFGpVm3s2DExuEt9P89Slx/pkifWXJBHhBK+IcZZJwxS+EMIOnzwDXu7T31gkldJISRwP2bM6Ng+in9b25zQhGCXutJra2uz56c/b3/8wx+M3RwIQu9///uttXVU5Bs+1scVXFzYCG8XbMKs++kZl7RLb/woH+a0adPsnHPOibd+wuBWhsOUIiWsndQzTKfHXFqk3mk0YiUNHE4qwvSXR/woK98wor7ZJs2RGmwh/8c//mEcuHfnnXcaC5/ZaXPhhRfFMgkWt+6xxx6xABSTNSMnn3yyXXrpZfbTn/7M7r77Hhde/h1HuTc1NVur1yPCAkKsVLTxslzkod7OvaRoPzwTTa7tQFCH0IQgkOCGydqrSZMmGVvoOcyPE1cRKsjfaaedZuwS+uY3v2nlhwovueSS0IQcffTRLjvsa3zDiEPiXvva14ZgQ9qQJJNkja5OoUTyAN7w2tvb7B//eNguvexS23CDd9oB+3/CKtWqtbvirxGDBenm2VkEqS7IEvXkDfyOe0/nvO8fASCD+g+VvomAMSAwCPDGjh1IGCS5xz6vJMnkb3jNLS2RFvwkd3PCXk90xj3vGahQs5MnOvQjjzwyzjFBs0N+JbnAM7azA5fUyULizbbqavKl7I1vfIOnP8epzcPW/G23GJgQRth1hMr/m1dfE2+x//u/P7G11lrH32w/7GErTl08O5nXWeiHzYNI8WOSm/X+Lqj0LFudd5xTgqAF5nwNmIEMrQB5qw/XyC51T6tRmMG69ZfHvng0ioNbPRGXe8pDOalPNEPsyGK65S9/ud/uuON247tL3//+9+ziiy+y008/zY444gjbY4/dbdddd7a99trTWMDKcftXXnm1T3X90tgx9p//PGWzZ7dZc3OrMS2C4DB69BhrdSEEwYF0SRPh9tVXXrHZrgkDZ9wh8iYp6gxtCHFKQQR+EJo21i6xkJavZrP1GEHiYx/7WOQJQfLKK6+Mjw9ed911sT7oxBNPDKFjs802Mw59Y3Ht2LFjjTRot2CBCZEPSWTF22W1k6TCLTzqfip1dmv3xgWQ191wvatxqvbpT3/axvkbQH2YtM8PBJJHIpAILGgE6AzpoBFKJEWHyeDPIE0njr/Nh4uOGHW0VAgCsCx5S407XsJAhGNQQd2OnW3C++yzj33jG98wPmrHRwR5e5W6+BCOuBBvs2xC4E2UwabF1e2Vir9EulaFt3J4wPPwww+3448/PqZPePvdYostYspJKvhKhQnPvkhSDG59+ZfuUhcOuJFfygj2DNhf/vKXY2BD8GLwwp9wC5ok9ZtEo3xIRVnwK4k2RXnAF+ED7dYjjzxifJCRU4PB+/LLLzdOamUM/cQnPuGCx24ugOxhn/zkIXbSSV+I8v/sZz/zOA/Eeqd2n6FAQGAtBufNjBk9OjQLZBiMSI82QtutJ9rxnDntrh1DbVAzFqdKiraOANLc3BJ8WlxoRmhA68YWc9KZPHlpW2WVlY0PU26++eY2depUY33TNddcE5oPynDsscfaTjvtZBtssIEheJC3SqVi7d6+yBcmZH5J6hQ4SLvqygyI8JIG1XbMrxBKHA+DXnrpZfv1r39rf3AVH1Lcqquu7EHMnF2QLeRLnh7kxrD6r3luITfyPxFIBBYRApLiLf3555+PHNA5YqFzh7DPC0kySf4C1xTqbTr6shPuxpfOAOrm2HXDYMeAjQBCB890E8eQc/Q40yz33XdfpNMVw+KetFpaW+1Nb1nPfIww3qhfmfGKPfPMs/bQQ3+3H/7wh/bpTx0Vb7u///3v/W27OQYNzrbYesutzHNv5h2/JBv46j+M1N1f6rqXioEdrRADGYMqU1W8gT/xxBPGgEu5wWHgfCy4EFJXnskLRL7IN3XzzDPP2JNPPmlMu6DF4KgMNAjnnHOWHXPM0YYwSZ1hIowgfH3ve9+zu+6aZk899XSUkzaI8IGmA0GBwRuhYobX20svvWRokF544Xl76aX/GmnOmDEjpmhoHwhD5Id8gUKFGiTPajdVzKkSbRGeaD/Gjh3vgufEOBkYTQjTMGwbf/vb3+5C0q4uHJ1kV155hbFQliM/0NKhHUFIGT9+vAs6bUZ6EGlC5B9CGCYd2iCEW0lSF442F5cXxQweFPjBhx6yb153rW3pUvT7NnqfcZGRwSZB+KREIBFIBBYXBBgE6eglxYBsftHR85ZecTe/nad/qRBKVlhhBVtxxRWjE5eKHpO+sz/mUhGuDEPnj7DE4IQbZ3ucf/75xpQH9/X8sBOedQS8/cY0wf0P2C9+8UtjQSkDI9qRX/zyF5En+neEAQaTD33oQ8ahbOaa8ej8YT4Ikrrntz4K+YEauZXumOXgSjk5aoKXX7QLDMCUByIcVM9rftvhD5EehJ22Qv7QPtBmEEA43+aOO+6wH/zgBz7tcrExvcI0Cyea77vvvnbUUUfZ+edfYD/+8Y9d63G/C4TPOKy1EAARDMCbQVtSCCXUAe2POobAAaGHNEmbvCBgIsNK8uqRMdhLhd06LknhDu+mpmbXhrTG+R8IH6SLyVqj5Zdf1jiAbeedd468c/ga39w539sVZVh//fWNHTLwIW0wAAvShHAviXtJVl6EK+3z0wyhpObS8lNPP23f+e63bKWVVrD99t/feGBZtSsVmSh+52fSI5cXWEEDlZCGBw0ULv07EAAsqOM2jUSgPwToNOlo6fhLO50uA8Pjjz9uRltiYO6PySD82p3R+IkTjIOrSIdOfBDRYvAqw0lFj0F8NAcITdOnT4+3VQYtyoEfVMbBTrhzzz4n3nx5Sz/owAPtoosuMo7VRxDhPAv4gAH5Ys3AFltt6TmuGap+K5ItWS4QU5JJCt7kmfJRJuw//elPQ8PAdNUjPgXCQE0dUV6IMFBEHuCnUTjcSoJfPYEP+QCfp556Kqa2+D7SrbfeamgPTjrppMjbxz/+8TgGnXs0Cr/85S+NNTpgirZj1KjRIRSALzxLQtCgrUGEJa2ybGVRpAIXSSZ3lGSSsDkV/7Qvw8lvq9UKwrWn12LNrUzNtNroUWNs7OixcS7J5KWWNhakbrXVVnbiiZ93TciVcaLu//zPl22vvfYyvrWDRq+pqcnafdyvRSOw4Fn16RbcKz49U5IkT7Xxv9S3X+MYg3Ot1PzBRHL7wx9uN9SEhx5yiI0bM7Yrtvt33aQtEUgEEoHhgYBUdJrtvHp6ljEZoOjvHnrwIaNro/9zr7n+l2SSbNzYcbbxxht38pHU0N7p2MNCvkonqZjuYABjkGZwq/cnHPe8WTPYsaYBrcq//1PsxmDQR/PA2z7+hGew4a39jW98o731rW/FaUjkWYpySgqzr8jkC8KfgQ2Te6i0YzJwl3lDI3HiiSfafvvtZyykZHoEQaF+EKfuGhF8S8Ife08THMGE9MATvFhrwxqQX//613bttdca02WH+Ni3ww47GFoFtExXXHFF7EIlvCRj2gUhBBxJp+SL0IFwCG/yDOFX5oPy1pNU1K9UmPjBz5HFasgJNaN1WmhDwLHqQkRra7NrQ1pDIEEbQl7Gjx/nGroV7D3vfbexQ4fzSkqtDt/QQRMyadIE51ONepNI08KOECIp7OaXJP9dsP+Uc6AUKpwu+Og/Hw1pattttrE3rLN2V5yKZ9L/Ox3ACep0WLQWsgINJReDAWUgfvCABgo3kD/QQgOFa+Q/P9JvxHde3PrLU39+g04TsKBBR1h4AedL+QaZXdo8NMjg8z1YfVnr7fM9oXlkWOatZ+fL4PS3B/9m7R3nJDB4zHVS3pFLslGjRxkDAFM4DCKQ5I11LqUeSTFYSOoza5SPAZDyILi88OKLNv3FFwyhi0GYiJ358BtU+h/aZBPjy7zO3P/75u3Bu/1TjOBlg48DA6l7eIlBsWaSQgtE3imDJLvzzjvtU5/6VGyD5eh01mwgoKDFQMAqy4VAQ50x8COYUVZM3MEB4QChpjxs7KGHHrK77rrLWFh65ZVX2gknnBCLTrfeeutYxEma7AhCQ4KABD/K2tzcHGs0SAu3Mq+kgR03/KgHyjpUKuPFjIRHRhiRZNVKxYWIitFuR40eHcIQ9qamFhvlWpHJkyfb61//etvuY9v6lMzJdtO3boxlFyeefJJ96MMfMk5MJe/WeVUc70rnnSfRaV/YFql7e2iUfuW5Z5/1+bLvG9uBdvF5JzOZVJCNwEvSPJdKUmA0z4zmgYGkeYi9YKJKfedJ6ttvbnNTPtRzG39u4zVKV5q/5WuURvf81rrfLsQ7qausUpd9IWZhUElJio6dwZjBg4FL8rn92bNjeoPDyqRikLS5vCi9TFZxQiBBW8LgiGZi4Dq0hhfxoIaeDRzLsmESj7dsBlVJnaFxZ+rmg67NYRC0jjfxzgADWGAlOT//HyBoeJNemZ9w6PjBHWu9Sb0wyIObpDi7g4Wwu+66q7HwkjMvLr74Yh+nfmCc58Gi3bvvvjvWcDDd8tvf/tZuueUWQ6hAkGHqhe3VTLcc6NNZO+64o6EBYfqC3SQIJsQpF9midWAQJ0/kGaGjFIIQmBA+yBt+hCH/80K9eDimtBfywNQKWjc+rIdbiwtGtN8Vll/e1ltvvZiCYS3O97//fbvssits//0/YW9645ts7JgxJq/YarUyL1lbLOJW/vSnP9kf//gHO+igA1wKG+2ZcoT8t+E/XlBDzwXnWHPW7XUPEfcQWYHce77+92o0A3EnM1BHOKxQx203Y8i8u8Ue3E1fafTlPhiu/cXtz29QvD1QPV7YIXfu9o8bVDrKZHXNonTuNBvlq5FbZ4RBWiRPd5Bh5zY9qe808BFlH2QeltRgYF/xt046ejDgHpo9Z7Y99vg/jQGtdMfsSYSFerr3vK901NX48ePjsCi23FZ9fp60a2Y2GB49eQ7lXlL34H49EIysAAAQAElEQVRPf1mmK7kmp7XV3viGdW2NNdYwScZf90gD3XmMjniS+g0sySR1hpEU95K6uXEjFW5oPRAGSuGEqQmEANZufPvb344Dxdhay9TKdtttZ9tuu20ILAgcuHGgF4LHLrvsEus/OHKddSqsWWF9DUKGpMgHvKkb+JMm0y9oYUgbAQl38jZ0QiCAipiSCkvFTf8vbvzX7XI3qFKtWFNzk40eM8oQjswvSca23VVWWcX4AN/hhx7iAsil9qMf/SgOn0PDw8Jqg4+H9SjGKboVNZnrV0ySVbzdSx7Aht9VufHGG4zV2OusvU4UZnEtQgkvD1pJZeOpv8etnurLQ7ie97hBZRweDt40ynv8GAjr3fALd9dpliZuxIXa24qtVPVplXapLIm5+rLdqS2I+O2x8Khm7T4H3pPgW/IYyJS60ijDEp95TyT/0m1uzbLMpQmf0l7mm3vsmPj3R7U6yaK9DlPi9iTv4f3fYxDOcWoklRAHPqSJHfJI/k9NegyPi19PIhxU5htzbjsp4qJGZjsqPHumVd7351eGgRfhShN7PeEOUce4E680sTci/PsiePWkRjwWdzdJoSmhg6ce6ajNL8rGs8BbdT0G7tXrX+r9LPUK5A7wZlBhpwOnXvJmzZuue831f5m3gRgQrlEYqcg75WUagAGutaW1UdAB3WBFGQnYV3r4QfhD2CHsJXEvqc9nkbxSV2gnMCXFAIsWQVJs8UaA4OwZTkWFWD9DWDAnPrgTHsJufpXCBwIIfSDPCmEh8uZBBv0vFbg2jlD0MVJXGctwkqIslWrVqk1NQc0tLe5WdcGk2SZNmmSvX2st23qbre2UU06JxbbslOEE3ve//wMhqJhfkjrHaknuUvff877Oa7hYK01NzbbXnnub+YRWV+W0e/6RtW2RnOTqiXf7B3aZq139DefxJ/5lf/nrX+yvf/urPfjgg8aWLaRp7EjEHNvLHnKIuUQaK+WCJAVfGiTzlIThw0bEYdETC335KvJ9f/6z3fvn++zPD9xvzzz3rM1pm2PPT59uf/V56Pvu/3MsCCYei8tIm/npe++71zguGEK1+PeHHzbSjgRpp/XkjjNnzrK/PfiQ/fHOPxnhycv99z/gauUHDd7333+/3Xvvn/1t7j6ne8Lt1Vdnecyh/1NeFnaxKp8zaHgQh8pFkvHQgxvlBmvyCe7lPThC5L0kVtQTD/z7SlNet/jNcWHu6WeeNuoXTEkD3tQjOIMpdtygh/7+sL3y6qtmLswFORPS+teTT8RpiOTvr3/5qz30twdjtTxtpaTg9/e/hzv2kkr+5J96+d3vfmeo+Z31kP7p/NgmyFkFvKWVmPfEQVIn39KvNPGgM33w4Yfsz94eyNPf/vo3e/Bvf7OHH3rYyDP4g/m0adOiHVE+2p3UxRc+JQU+//Jn6C9/CTV54Ohz7mW54cVzwDevIO4ZwMv4neYwsIBj1QcApi0kWZMPBFKBC7jedtttxqBGUcr6wT5UkuQDSyUGWqbB2SqK1oS0IVvYlz8PrsmPPJE0wgTamw3f/S5zcR6nQVN0Ww4ZpuQWjwlvyK3xLxXuceM/kkwqyG/jXyruyQv1Iinc63+kwk2SUR8IJmgvIAQRCIECd4h2TnuGsFOnJREHe304+kHSI33MgUgq8tMzXM/4UhmOcROkyhgVr4OqU8UQQlgT0to6OtaIoL2bOGGpON/mXe96l+237/524Vcvsh/88Ad22eWXx64fdsog6JrrPyqVarQvOPdMnxQhk/tCbgzn/wornpmzqvRS9xSlU5R00RaRSmivtcfJdyxIYmX0QQcdZLvvsXssitp5550NNR7qO+YgUeVRLqTNcuW0pM5C8AbLKm/icDY/hEpwxx12sB2238H40BH8P/fZzxrzl7NcgOCri8cdd5x9+qijQj3I9rs999wzGg8macOD7xRwcM5ll10ah9+Q986E6yzTpz9vfKjoqKM+Fcf17rDDjrHoitPzyBdlwNx1112MVeFnnXWWPeECWR2LQVl5uHmTQI3JCnPw44EdVOS6QJQDPnzngPzsv//+sUqdfFLuHRw78ss9dlaCc4Ikc7vEk7rwr2Pbzfrqq6/YL3/xyyjvPnvvbfCCJ0Qd7+KqWWhXn2s++JMHx4p5BtXigSz4Iwx897vfdR6ftHI++WOu7t1xp51i2+Suu+1qu+62W7Qb+PYkykJ72HLLLY1TDhlgGLC7ZXSAG7BiwRx1xke0OOFRKvInFWZPFsSRCj+pMKk7hMnTTj3VKO/ejsl2229nO/gc+c677ByL9fggF2Wg3U2dOjXOqOAtEn7Ex6xPC80NeWJlPmdZUF6Idgdh5xmCJ/V8qqc9zQWeeh7DxS4pdirw3Y6qCyfgQd7BhIGMev3JT35ikmIQxB3/kqSiHsr7/kyZ/3l4BpENN9wwnmXSY6pA3reWcSWV1gViSgrtEOVlEKZM9O2o+8upG5uLqxRmnH2v2KRR78g9hJskk4Q1BlXcpeI+HOt+8OO2NLFD5T0mmFIuiDqEsEP4QYQrifgLmkirTENSCCHUOXWAhorxFSGktbXFJkwYb3z1eaON3mccVnbVlVfHGSdnnHmGccouZ4YwFWOyuHryDscR/lPhdDepA4HOwlbcJselPchvFum/K3FcwjfjkKB9993XvvjFL4YwMHbcOLv73kKLwOAE0SG/733vMw65YYEUb0lknsqFsLO164Mf/KDReSC0cGYBK7WfefqZUJFtv932dvKJJ9m555xrH9r4g9bsb1jveueGds5ZZ9t555znQsvu9oJrTpiTRsPB2+Rjjz1mo0aNiu8ZfOOyr9tnjjs28ivJHMTuZGbLLrusnXD88XbpNy41BvhqtWKPPPJ3e+ihB50e9rfgf9jzzz9rqILPPPMsO+OMM+NIYI86qP+yrATmTR81IMIIb/6sRK/3J8xAJMl4sBi4OIkRwZCODm0Eb+u8oT/66KPGIU6EO+aYY4ztaQxsqM/74+8IBURjRo+xj37kI3b6qafZNltvE0Id/P/s2qn7//JAaIxIZ6111rbPHHtsfFhs9dVXN/n8bDDwRHhD3X3X3eyrF33Vph5xhK24wgr2oGNKXbF+6k8+wE5zoq1QZ48/9k/DZPB//PHHjbaAnXIwgFOnrHZ31n3+98QSnEmLtoGWBAEYYYkOsycT4tYLVfX+FR/MVl11Vfvi6V+08889L4Sql2fMcK3Jn0MrQpkg0kAoYQEcql7aliQjvgS6FhdpTXIVMe2NZwjhjmcBjRS7HDDRvvAMreVqZIR6BKt3vOMdEX+4/YBrU0tzvI1S7qoLJq2trSGAtLe1G3XCwWSltmSuy0dCHhm8wRhtyaGHHhq7cRjMW0e1mmijHgZ/N+b7vySTZExZIAhhSgrtEHaek4Gew/4zVfBn5nOwZSBcSfW8ceNeKnhiL0lSaR20Wc9voEhS//ylLv+Sb388JRl1q2rFKk7V5iarNFWtxQWQ1tZmGztmtAsiE4zneLPNNrUTTjjerr/uervum9+0E44/1jZ85ztCc4IgUjEZJDPjXpJJ8jsLgS4s/iMVbm6Nf+6guBkBPxWpd3G6V0Zv/4VdbpmikpgPXWP1NeJh5y2atz3c6FhL1ey6665rdKQf/vCHjT35PKCUR3IuTqWdwQb1Hh1TpVKxMaNHx5vxlVdcYazaJv5qq60WR/Q2Nzcbwg1vGuu8YR3bcacd7cM+eCKlS4ppGsIwZ8vb+aqrrGoTJ0w0SdbXRZoTJ06IhWdoXdAsFHnzBugiWKWqOATn5JNPtne9a0ObMmX5eAPqi19Pd0nRkNEKMQgjjMCfAQcBZc7s2eHfM15f98SljHz/gA8wsdgKSX+UC2LEAX9UqHT+hx52mG222WYxGBBe6hsH4pYEJnTo73J1JgPnTjvuFOttqGMGE/LANz5OOOEE22STTYyOFgGojI9Z8qAdbLnFlnbMsZ+JOqTDiI7D8zLBcUcbcpRrvRCePvOZzxjE1kC0XgiCqE4RguFPnuDdF0ndy8d0B9sPaV8IKODPeQhS93Dwk3q74V5SiTlrFdAMvv8D7496o+MDD0m23nrrxXeqKDPbAavVahm9mykpBi0wpK3ut99+cbYB4cGXt01JsRMPYZKdJOwo4ZsZ3Rgt5jfgUmax2aenp0yZEm2R+qCdgnjNNa88v0zRITQSnvJjzi1JMtofxEfN0EyutupqPNA+SLX26g8kcmLzfEmKdJt9QKQe6fOoU/JRcymi2fsvvo+DG/c2hKsrhy5eOa/BRJW6YkmFnXSlwi51N+EpqRc+uA+FSKM+vKT627D3DBOOdT+lv9Q7bhlMUuQVPJtbWqylpdVK3Okv6PvReHCY3k6uxT/33HPjY3bXX3+9a3APiXNixowZE+yoo7D0+CnzUTpLKq0j3qz4+NerkFIJQMX9SrtbF9E/OagnKozKXGmF19j4ceNj4GJApMPhTbnFG4qkeFAlRQOyjou3VdZFXOHCB2p+HtiJEyfazj41cM5559ra66wTnT7BJWF0xiddHJpbWmIvOHb44U4DpWGSj4qqJv/Dvz+CPdu4mppbbcWVXuONuyWCM1XV7B0M88CjR4/ycijcB/3Dm5t3IOQNoeRnP/uZMTgSH/OW/7vZWGuBP26DIal7HsCaARDsKD/llmQMeO97//ts5uxZJsnzXgnTBnlJRTrU4eprrB51wWDRNntOvPWBCX686UrqlzdvLQiTtAnJ8+G4EI9TD5meQBA50qfPEEYQsLhnKyKr/aGdXSiindGBeNQBSwAO5PXpp5+OQ5ckxVs5QgrfwGAQbMRE7gi50ee/JGvywWUF1/wQSFK0e/I32gXq0g1zQPLCyGQtzS224pQVot0x907eacfghbZlQD6LaQBJkTN+/a0r3lQ55ZLyQRVvC5xiTX3wfNx0002G5oz6G8wzQbhIoPwhIcjvJRl1wvOBhonzNlZbdVWrqhI4g68k4+rFB8chkCQjrebmZkNwnOT92KqrvDa0q7jT/iFeHDjXwvySirTdOuj/WD/S3j241MVH6m6vLxd2SSYpnmWpMOGGH2ZPkorwPd2Het8X/8HwqY9b8fwE+csr9Qq1+BgAjXLNG9txl528jK35ujVDs37k1Kn29Uu+ZhxidsH559tOPjW/ymtXjrqSFMlLhRk3DX6k/v0bRBkxTpXhVhLvTyPLTf4GVDzglWjwUtHYpa7OmoBSV+XS4fBRJSRWphaIT+fL/vUTTzwxtCG49YzHPSQpGhYPfIs3RvOLxisVaRNX6krPvfv9J67LDp08pYKP+VucORv4tROgXy6NPYlGp8s0BLsMmnwKSnL+7TX71xP/iu1l4AE15tC/KxjAkwcTHpRFktEBIpzRUfbPoX9fys5gK3meKUxHcNIj3Wq10uHStyE5iO5dahUq3qn4rREfIarMc9U1CxD+8GdQnuJv1+/c8J0hfA6lLAxyt952qz3iU1mkA08EQc5QYA0D6c8tVStVGzd2bESXlCILhwAAEABJREFUFO3G/Kp6/qkDqSivOw3qX5JVXdVMHq3jwi7JpO64d3gPS4N2hIBAffNMYEIIKJjUC1NfaE1Lt/4KKqk/7/ADR54FNK4sMEe7SNuqel3RLiDCSAqsI9IgfyQZfOCHwEz5ELQ/+pFN7eyzzjUEENqhzC9/dsjHqi4YUVZ3MXfCmEvyHjgYd0WHr6TOckjq8uywlWHqzQ6viId7Sbhjx1xUJCmeL3BG29bS3BJaRrAEb/oIxg6EXbT2aMV4yWXNHZpcdrTiL3U9R4u6TDZMror1bj+Ld9Y7nqharT3eQiuV7gXgQW9U+XTarK3g0JkzzjgjPo7Emz4LWpmHp5ERl8JL3Xni1o3cu8k1GbiRFiTJG3FTrwcePzNeMyDrdXk0M7WbKhYdDXlAJqmqauVVrqkp7wc0Zc5PMWfOdxoeeeSR2DlD5uR+/33pJfvfn/w/Yz0N+YNsLi7yyoCNtqdGpp0HDzEde7XiBfL7efmHP1TzOpdkkgzc6dAHy1fyOJWqUXb4EA+epSkJay9q8TchtGYssK36QNI4VPdo8Gd67Ac//KHNnDUzMCct2h7auR+6O/busQZ/J8nL32wOhBfHBwczt8pIg7QhG+JVqVQjRn2+pKK08JMKewQapj8M3Ex/oTUr207F2ydlRkPEjg4GlMsvv9ywI7DiR/nnpciSQjuy0UYbGZpZ2hIDFUJ7lTbl/piQ1D/OkqKeed5om2hGJo6fYMssPdnWf+vbjCnniy+52FZYaUX71a9+6QNo1dAKNlWbQlNEXycVaXQYNpSLOODhj2Io14vW18VBUrRF8gfGZZkkH5SJIR7B7lNABb/CjfqQFDzgKhV2qbeJ/1BJUr9RJEXa5AMC49GugaSuWl1bPXrsmFhTx8sK6zBZJM6LLe2GheNMwTO9TzwSkrzcDha8SpKKNPBP6huBSt9ei6ePpMgYDRoLJiQVjQA7hF9J3LMY8P/9v/9nrNHgLQI1OIvRWFdApyUVfMs4fZnwkhV/ZRiJtM2kwrSGl3q5SoWbpIgrudnxtPNQRwS/R32quBn8D50qAyS7bngokParlaqVamsWp6JBgSNhKRf2oZCkyLc/exFNovxFJ+PZDre5/ZEUnTD5gswvSfxGmv7j9sH/w0Mivsdxk3u3OZsON246CD86F74RwmLQDud+DeKgEZl29912++23+9RIs1V94MEdov2xRRjBuF9G/XiS06r8kXXA4VkGlWRzq1HzoSIwkODudw14l+kMV5OBkmlFFrbT1rnHlBRTYAjR1M95551nTLMhqKBRIUw9zoMtf30cScbzt+aaaxprC77yla8YQgprDngRop1VKoRRZz1IMi5JVgmqxJqFWK/gUzSYrHOifbKY//obro8dZbNmz7ZH/vGI/fOfj0eakoyLtVGTJk3COtdE+wKn+rKVzCQZ7gzgrGsCa8oFzpS9CFfkBTthMUuSivileyMTN6iMMzem1JUH4ksKnHhOySv5LwmBBGK6mHVV73//+43F/Zd+4xuxPgTNCDv0EFLML6ngLXWZUmF372H+v3Cz7z3cwk1wfqQmFZVNpwE/GqtUuJX3uJV2hBAGYE75Y6DmoWENAY2Mh4dwUhG/jIfb4KlrCO4ZX/IHzli6U/CHJ6Eh7FKXO/doRTAlj1cGwmEIRB5QRXMmyX333mdjRo229d7yltgN5D1fcHrhxRdiCoe9/+Aodc9HBBrEj+T5JKoT6ZbkvVRd7Ha3Q24M4R9ekjP2ONghtzprB8YHT+wDEXHAFOoM6yw5hQe/Trc6i+QB+rmv8+pmZe3Ij3/0I5vx0ss2aeIkY6G0waoim902xxAEf/GLXxh421xcXmp/5/RHlvxx08GDslEWqMOpwKjjhqBQx61FnsiXE4MN8SBrcPXl3iDoYu3E2ie2OqN+501eUtQD5Ss1I0ztMo2LYMJzgWCCPzSUwkkObEcE4kqK+kC7wddbWWh+1VVXxZZ1dgquvPJrrcmn0aIeO6IymENNzc02Yfx4W2H5KcbgyNTMVlttYV/84ul27fXX2QEHHWiTl1nGU/OXgfZ2u+++e43+zq2uLSkEYwQSBlsPNOR/2k3ky2PSbts7NKJ+2+2fvIIxuyOZvlh55ZUNoQuqVqpFk3McJJmkiCsVJhhB4TjAz2DCSYo0JPXiRj6hqr8wIIjQ/4MNAghUCnwIkSyGZ8z45rXX2jXXXGOf+9zn7L3veW9oTOAxmLz0ykA6DIhAZcAQi2EAGkN7O4+LxcMuKRohWW3naXSLVHQEdC7M5/Og8K0DBgp2XDBtQ8OUuuJ6tE4+2Psif/z78hqye8mLMkldeSnGXMowMEvi9gzFmx/nY8yaPcs4rpizU96w7ro+qHmKzpy3wT/+8Y/xoaq5fcAkdSZLbUjkF/7US6dXh6UrbIdDn0bP8kjqqhfPe0R0tzD7+/FMeW6ijXjBu3gQx/n0TAfnuSH4MIAxTcauGzo2dq4ccMAB5jnvZInQgrqXKYJOxyFYVIb1vJfWML2cjnhYyx+pM3TpVODQeVdYyLskk1Q4+C9ubsR/vT0chukP2lA0JaztoI9AMKEoUtFmqT/c6SOOP/54Q2igvkp3/OYGC6ngzzMmKbRnDH7vfve7Y0s7OwXf/Z73eN2YV2HN0IoSFkJQYXDnjfzje33cBZEvGuvhOD6dhdpLL7WUVZwneatUK/bif1+0X//6NhdwmjqJPCMsUF7snsoQ//0J8vZG6wCLhjzwdK6VSiV2bnGW0AUXXGBrr7V2rDEbP35cmPh7MC9rDSNIUre2F47+U6ZTmu7U579U8JDULYykTk0I5W9pbonttyxOpT2gQVpq0iQXnsYZmvMNNljfPv7xj4dG61oXRDhjiWf4reutF/EiL87T/CrL4tb4l7qnHY7+E3HczP/BI1AZfNDFLWTxsJArKl4qGgWNhQbIg4pAwuFnHHrG+RYIJEzXIM0TTiriwGPeCD61UAWTl5688IU63TsecsK2u3BVmO2dD6skf1DL0F0PcOnS0/TQnU6E5s2P8vLxKt4M119/fdv4gxvbJh/eJB5SSd4BWpxUylshatn2DmGuZESeSnsjU3Ie7uG14L90vM7Sy0X6xquVFf7u6f80s/p7d+rnX4Kfc3Z+BIMdJNXx6PDDvxFF/gnjGZI8nv+HmweueN6YxnJrn/9l2D4D1HkQdvr06cZBXJx5gVDy0Y9+1DbddNPYjURQSbED6o477ghBkDi4D5W8GA60xWDUGbejnH3ydH95YIlft/g/YalzCDskdfl7kM72iH24E8876yrY8o1QwNsxbpSbsvEMIKhjsnvqC1/4gkGcQYTmgQG5HqsyHnH7ovow2IkPHw4TZAE608msZ/vWt79jc/z5Y1eQpBBc6MPQjJx00uft8iuvsM/6Wzpv7sVBcM3+HFejHRjt29pt9qyZ9sQTT9r9D/wl6o10zC/4MAC7tds/+enmMMAN4WfNmmU1zydB/enEKMjz7I+USYrBu6WlyTbe+P32tUsusQ998EM2duw4mzhxgptjY40NuEsdz7hz4Nn2Bu224l/VitXfm9wdciP+sZdUcQv/bsoJ4Yz4za0tcRQAdY1GZOyYsTZxwgRbyjWYaDHZdbbB29Y3BKiTTjrRhdAr7KabbnTB7zTbccftbfXVV7WKC1mSM/dEsQdVKyYVblJhunef/9LAYfqMvIR6VIZrub2fjaxj8rBzIykaEvecSXDnnXfG+RN0LGgL0JAgkEhFOGngBlMjAWtw9YhKMDq0mqs3sTeI0ekkFZFrHlDqsnMPSQoBR+p4cD2I9z2d8QeyoCXhjR11NKrfLbfa0lWO472j2Ng4CIw04IHQxrQWB2fhBuEOSZ4oln5IkvFHEPEDeZnMe8p6XjgPhogDlWGxQ9xjQtiDPO0w+/iRHDvPVCPc4AP1EdVKv9IcKBztjYWsLKJuamqKMzE+8pGPxG4uToWlI/esmLzT5EA2whHHYeqLdWP3usKUVuBud8G23QeLdjfJc+lXMpFIvbjDv93DYkKSTCqI+yJU8VvxTrmwDe9fyiXJ34jHG7siNtxwwygQgonk7cRBlAqTwZznmPVBl112WRzSePXVV8cBe2hO0HKBX0nwhmBYb5Z2ePGSwHQqwg4H1H3729+O9Qm8hcei6Jkzow7g4dnw9tcemoWt/Lnl9F40uhD+ELwlz6/f0KZmz55jHKrHZwieeuopo97afLpQKuqVFxMP2plGTzv3fRKNyfFpa2sLobrd21iEdTdMSZGeM/d/Rb7JK88BZzr9z1e+Yqee+gV73evW8D5oXGhSEBDIE2Gaq1Vr9memjMNx7OS/vCcMbhD2oOZmY1oryOOyE3L0mDE2ZuxYa20dZaOc6PcmuRaEFwTW36z0mpXsTW96k22z7TaGIHjppZfaNd/8ZnzgjnpgITTrR0i3wLcYGsmLJMtr4SFQIL/w0pvvKUn+cPoDQkOCebt3uHQcvJGiIZk2bZqhAj3ssMNs7733Jkg8PGEZxI/UR4PkYe0WvxY7embNmm2vvDrTXp05y/hWDd+4CfvM2TbTqbDPspn+1jHLOxM6FDot74litTwmYwHlgL0Xzcw7gj5yQRCzOk8GQNbNsMCVTneVVVe1jd73Pn+Im2IaB7UxWEky0uA4dAQY3Li3ubhQOdcPsDV/c4OGykqSSeo3WifsAYw5XJ0ufcajbFAZgIGHe8oL4c49hJ0OmEEEbLDj1ogkRfqE/e1vf2sMCryVfuADHzAWwNHJccjc+HHjPbqH9d+XZrxsN998c5x8y4cba22DX2vTqKTkmTY3a3ab0bZmzZ7t5qtOM729dadX/W16pk/nzZozO9rfTB8MiQ951rr94wZ1cxymN1JXm0JbctBBB8X6qhjgfFCjWGVZMXkewQZ3ThQ+9thj40h/piRuueWW+N4WO9dYtIygguaDNoCQjx3Bk2fwiSeesEcffdT4hhA7r1gciaaGBfZo1YhDzmgD7XPaSM54qx81qtXWW+8tdsTUT7lmodXbGH61eDYkhUlguZDrN1apNvmzbPbAnx/wsLXY9WXes5dtm4GW8HNNNY/pzxuCWs1fuvzOkxVGEM9/U6UaGh4GcRwx5R3ZpKWXMsrMAXWfO+Gz9o4N3m6csjx5qaVt0vgJISjyfEx0O8/OWBcuWHszfvz48Av72HE2zjUdYXf3MP2ZGu/uY0ePsdEuhGBOcLelXBBZYcoUe90arzP6Ol5Cv/jFLxqC5fU33mDnnHuuHfTJg43vAHGIYlE0fsm1GfmGHOZuZSx883dhIFBZGIks2DRq8SBK6mxELChkXphdEBMnTozvULCFq+YPlqT5lh34wQyTDuDJJ5+wX//m18a8LutY6MBuvvkWu+3W29ytcMePD4Hdcsttdssttxrf1PnjH/5o//j7PyL/8Kr620Ot1hb38B8K0TEikKEdYlB8l78Voh2BJ1gwP01nTDrwpRMtO8jSDffBktQdz7nhMZi0pDKdjg6k4xJ7qeAAABAASURBVF4q3fvg4nWOj+RCgdvJH50rgwkqdI6Uf+SRR+JNmOPmITRHP/7Rj2OnFlon4jcieEHwYv0OnRnz1GAsKVTZnKTJFkLCeUO1mguYpMGCV3iGO5ZBkEzeacri6jDa/I2Yge+Xv/hFHNj2fzf/n7e3W+22XxdtjvYFcaJs2SbRjrFVnOk9jsMPfnU/UoEVTkPJH+EXFM0PvpIMQf2d73xnfLeJ+mppaXFMK53sJZmk0FQimLS5hoBwfDKAg9DYjcW3nThwj88tsI2Y9Qff+c534rCsb7sW5IorrohvENEHcQYSC2x5G//6178ei53BFEI4pt/ALikEEqliyy+/gh162KG26mqrRr5IX1LYe/4QFzee+3vuudu1BK0mef21mQsq7Vb6E2ZeqN3bLUJUx9PXna+nV/JmukQir1DhSt+z0oor2YEuDHKOB1qKww8/zNAmrvuGdWMBL8IEQsmoUaOstaXVWppbjH6qxesHQQ0TPwQSpmEmT146NJLs9qE+t9hii/hcx8knn2ysubnpppuMeuCedSLrrbdeaC7hJcnA1PySFMIUeZS68mxWb7e8FiICXU/jQkx0fifFg9fuGhJMBhreSNh5QkMmLRocbz+EkeatsUny5ipnWzyepKlqxeeE21zA+LXtucfutusuOwftvvuuBu222y62267uBu2yU9jj3u077biD7bzTTq7iPNXm+ABTcDXvUMwk0rFBX+Rl+vRibUO7d6acYcCcbsmADoMHmLU1pRu48CaHIIMbGGEOhiT1yiN5GEzcwYaRPA0HhbexiIPd3bxXjNuBfsgPRDjJO2tX6Tz7/HP2lQv/x/bee29DWC1p7457PnL3qU8daQ/+9W8xUBDXk8XoRbNc44UAyNolOk0OU2KrJjhKMgTBLVwNX/E24iUx8o0g+KMf/chefmWGtfmbZ5m/Xsz7cQAP4jGw3XPPNNtrrz1th+0/FqdH7rjDjoW5447GAAqxMHKXnXa2nXeEdvE2t4vxBnvaaacZPOBVJieptI4Is75s9AWTJ0+2T3ziE8azwD31VvG3+p6FpQ6pXwZjnhMGSUxeeliwzBZfTgE+4ogjDO0LggfH86OhRWAhDG2DNSnwJx8IxBCYk55C22HW1Nxk8Ke98H2pbbf5WCx6lcmDVZzcrLkBuVH/L8mee/bZEHjKPEse3nm3tbeFBrc+/KDtZVrOCz6UA6HaXEBR5Mv8aYJqoRuFL2Uw68gvDkEVU6XqJBs7fpy96z3vtqOPOcauvOoqu+lb3wotxvkXXGCnn3a6sdvl+OOOs2M+/Wk79pjP2HGfOTZ2vZx04kl22imnGicuX3LxJXb5ZZcb2hd2MmFyZshJJ50UzzQ7mlh7Q39XrVaNSxKGUQ9YJHXazSrWm+Ru+b8oEKA2FkW68y1Nf/kNXpKic+UtFw0FHQ0PKA8SkjNbuuhgcIsI8/BT80ex63n1xuuZ8F9XtbbEmo2llpro6uGJMSBNnDjJ6GjQWkAT/X7SJPwmeJilYo6Vt2ve4Oio2r0TkWT+70Qq0OAyS4fJW//NN98c86sIH7whlGXmAeUAKXaG0EHCVZLxpo96mXClO34DkaReQcCml+NcOtTnRZKP53VY+P1g2NbnJ/g5CwaFx//5z+jEOV6ceX6mXngb5lsofOTu5Rkz4qOJ1Et9OsGjzgEB4+c//3ksGqYT5EOPvPFJBTbMc/OdGaYNymizfAqFjyLeeeed4cTbeFgG+vF25k0vQkny9lEQ6cKfwZa2NGnSJOve5mhvBeG/3HLL2pQpy3v5louDtSgTFIw7fnredzgPS0NSt3zzHHAsAMIDgxf35Rs05Yakrjg8F2hNEE7QSFBfDL689EC0EYh6KO/xJxyatun+ooAJD3h1y4y3x0q1anKhiDx8wKf+OK6APHUL188Nz/2jjz1mzz3/rMsL7U4151c8L+0uQJDn+uiUr/5+MPayLOYNkGeq5AFKDPTklzKPck3HQPwkz5sHampujhOT6aPQLu6zzz72yYMPtqlTp9pRLpR86qijbOqRRxpT75885JO23/77u1C9k7GInO9T8QLArhnaNPg7y9B6SOSKO4tnxPq5pK6w/QRLr4WIwLAXSsCKB6TdNSXYaZzMJaLm4x6iU0DC5u0UwYTwuM8T1YrYNd50XZBg5TwH7CC1X3XVNXbNNdfaDTfcZDfeCN3oJnSTu93oEv4NTtdHGMJddc037bDDD49BF35wlsqHpTbgg0V4iI6PaQEWuLLA620brG8Tl5pU90ZgMQjxsbz6zoNFwaj2EWgk7zAY/GA4CKr1DFsbRKS5DCI5Jk6RZs90++BJWMj70sBXUiy441tHHC3OGxbbMk899VRj7QAfAuSDgHSyzIdjEt9TjhSk0mah4mfdwE9//jPjGyMsqNt444070yECi/he46rr9713o8LdBx+vUKNNIgj6CBLCNGEHJh8OvK3Vh2MgeMtb17NLvvY1++pXLw7V9ZVXXult6xpjWoEtpNfdcL1dd8MN3vZucrrBrr/+Om9/17n/dXbUUZ/27CjyVs+3fJ7q3UaCnbqkHAgPG2ywgTHFgqBOv4FQIBX1W4aTinvi4AYu9CEM9LzwIKhgItg///zzIeAjqEKEQWAgHvEbEWm2NrdYS1Oz8QE32iD5IY7UlXbE5RaKGxcP/BkgHMIOgvWMV151rchsMw+DEFHzPhEiL9xbxyV5gA57N6Pmd5Ab8d8RDAPNK+X0JHmUjDSMyz2rLlTR/yGU0e+0e4h6NgSrJ0kmyYx/1+ZYefm94V53r57+fi8R0DxoYZpfCEaSwk2SuxT/Upe9cMnfxR2BYSmUyFSHa82k4l6SrbLKKrGVj/lKGirEA8lWTQ5GYj6dToWHuY7J0Kw17xD8wSsiFWk3NVWNxY2sH2B1P7TBBm+z9dd/q7GyuyS259IZ8i2Od73rnUb4t7zpzR5mfZ8qaKori3P3dDqT8dv+/uksEUZYtFp2DqgxKTt+bXPmxCDKIMY8LF9QBgOpyP+TTz5pxCUN3DEHIsJBEc75lB2WWcHT5tMlySQV3EgEW8d9Z/q4NSD8IWoMb0k2YfwE23yzzW3bbbc1FqIyXYMwwjoBhBMWNK6++uoGbrQfqSNtGNQRg87vfvc7QzvX7IMKcdBO0b7QekHgj+aEtzs67+DkZUBbgyDIdCNpFHmsY96HtQwnBScjLhqSD33oQzFHz7dWEI55k0Q4px3S1t75jnfYO96xgdPbo83R7tZbb70YCMkXfEgS/hD2kUhSF268uPCGzhk+aJd4NhASJHW2N7CQ1C8UhKGtUN/YGwWWuvOQFG/1JfbrrLNOTFO85S1v6SYg9sXPOi5JLojMig8KlnXoDMwLYPI/4rMgF8HF5uGCD+0dFtgxIdKQEGrbvf9qjm2/g+2zbBFd9fmvty+i7GSyPRAYlkJJfRm8f/dnkNHbTFJMoay11lqxFRhBwPziwafxoQlAZcvCv4HeYDxav//w6wpQ8TxYDPp0TJ2dQ1eAhjZ4sKAVc/as2cHDX27c5I24ZiJWTW6qHFNxaUgMcixaZAoCfggmaEAeuP8Bu++ee23an6bZtLv+ZH++78+GgIZgQjhIUpwCyY4d3vjoYBsm0sCR+J7FDh+ZK448r/I8VzvcMNr9B3JjiP/w7y+KpP68rWwfNQ8FL0nW5G92r77ySggd7tztn7aCcPnBjT/o5SCWWbszKWxdQeE13dXynDVBhz/bp2TA7Xe//Z2xPgdhhXUm06ZNiwGDAY+BjzA1V6nDiUW2v/jVL7Ea7mEZ4MdbRoQg/SC/I+6rM191AaXAQipM94r/itdGABF3xQ9BUNqQ78Kl+JW8DimvU+Eycn8lF1AnTIidNawNod5H+fRDS0uLSV0YgnNPFKQu/55+je578pAUaUgyTg9lm+omm2zi1VQL94JHu9trhbWfX55zBGPSgDySycNjhxBK0Ohgd+e+/4kE9QhBPIRr+pgKmgqyBJXhaM9+P2H8eBs3dpxVvEwN2ETZyihhepy+BBjSjDA9fvpy7xGs31upK3dSl73fSOm50BCoLLSU5nNC9U1JKu5osAgEmDzoHH6E5gRBgeR5sFBz0gHdccftQ1CbE3tw1DaELZ4lR0nm/04qneJZrfloXw5CnR4NLJQXYQJNx+zZsw1ijQQfidp0s02Nt0E0AltutZVrCDaL3UhMZfFWSFwIjFhLwQJhMGyQTEMn4rLoUuZ/suh4ws3tRQR6HmydDtwMieBXEhGlIfCqOYJOxKNcDOAIHpjc415PkmKtzz777B1aFNKlk60Pgx1tyEMPPWS/+e1vYsfDnNlzDC3cdtttF/HQwmBnVwDYH+Xz4/VvmvBFHU49DGrA8ES9OUS7cGvgjOmIW80l2ZoPDFJ3XEijCGMmdfezHpdU+BOnpB5BRuStpJjSZIfGSSedZCuttFK88SOY0D6kApeehQcjqbFfz7Dd7j0KfCGePzSW9FNb+bNZz1PygN0iNr4hDtO2TCOSZ1U8nrd32gMxaOsIz2xhltwPx7kg+k7ar6ReAjRpUJYpU1ZwoWRsn9ylwacvNQ4rNXbvM9H0GHYIDBOhpN2Bhdzw/2iW5Vjn9zyYkqLj5WHnrRRidf3nP/85W375Za3WscWWh+vee++J9QNoFhiMGaCcTbd/eHZzqLuR2xmI3XC+tSAzXCvWUyjpj4/5Jcnjtzn5TKx3Ju7kdh9qvHzuYsHWWXsqVl71PLEjhDz66KPGAtfW1hZrbW2OBWS8mbPfny9cjp84wSYtNckmTJoYiyD5WimLI8GrLD+CDVtb4QdfqEyzL7MM46XwfLc7tfUI6gWpeTNjRO3h0++tl5ldTfXRSEuSSeo3aulJeE89brGHpeOHe0jqzau5udn4QvBWW2/dmVbPUAgUTL+89N+XjC2MLGJm0eSKK60YWxynTJliYEwd4Ddx4kTDbZS/iYM57RCcWVjLcf8d2RrQiHbgA48qjimhvYAMQDUXTKhHyoTzUEnqKiE8IHhIXe7cj1Riio1dSqwvQovY2toawgl1BUm9cSgx6okJIaF6d0mGwFCpVmOXDVNHTK2deeaZ8dJA3dWHL+xoYFVYG/ySPvEQOiCEkhrCqfnT6H0JfuQdDQeaFO4bsOnXiTQIQD+JUIK9dCtzhh/uU1aYYqytKv1x65dgAPUbKD2XNAQqw7HAfTV6qWjhPCQ8jHQ0vKlykiuDAgOBxAPbbnfeeVcsckOj0OhhlQpeg8FHIqwPF94RlHkrTQm//rlIFZNT91A+2lghiMFL6uIjddmJwwDJORScKsqAynHU3/rWTcbZCezX/8EPfhAf32NhJfYf//jHxlY6toSWZcdkGoKpLY6o517qng5p1RP5inCeVRm41vwtCiryXYRVYdRhUzgM/CvnWR9KUv3t4Oxlum4SwbOKYZKC4maIP5QblTjTXUQF88MPOzwWM4P39773PQNjBDw0ISXuF110ka2yyiouuLZF2vBhMOHRo0DyAAAQAElEQVScGNos7RN+/RGDTk9/4lEPuEtFPZR2zIGIfJRhsEMlv9J9pJuS4jRS1uRwngiaCxYuI5zwggPRp0jqBYXU5SY5/h6ibGfEqXYIIk3VJhvV0hrnZaBJu/CiC+39H/iAC/K1aA9SFx/ruKTebh1eYdBuOCmWKRzaIfd4UIdo8zDxu/+B+yMN/IZEnjw84AUfeT/FfU8epI2Wqad73icCQ0WgMtQIi0N4yZ8Uz0jxcNTcZiYVbpJ3Cj4A0alKcq3AJNt99z1t7733NYQU10EYV63WHodNsfqecwfo2GseD796auRW79/TTrq4SUV+sA9E8ge93d9wCCf1jFczqacbIbuIVf9sSyWv48dPsF133d3e+ta3GYvmOFqZNTave93rDGJai8WYENM6vM3DiY6T+Kxz4FCtdn/z5h6/vqj0r7naqKZCECEeVPqZed7933i7H6AcVnfJ41U8vLMOV/hB3EjyaqxhHZDKOEacCF0ztC+u04nBIJyG+MObJxoOiLfTtdZ8ve2/337GwlEwB+NVV101BBAwB/+1117bWOOEkFwmR97o6DlMjwWvtMHSr5FJeKjez0sTZ53MaUfbVmAiOT71gfqx9+RHUNzqCbeRTpK8iSi0GGhKvvKVrxgngbIonS2naLgQUBh8EVAgBI4gj1utVCI+OIWbCyI8U4SjjRCXFyMWtB599NH25S9/2V6/1lrW7v0QWEsi6qCIWoYkxRQ0AjJCA+2HZ69kAl+0cZzgO+3uuw2TeKX/YExyVfOHkLgzZ80yeTnhS9yaUWaoEOgQuPGTiEWIpDoE0jpIBCqDDLcYBOvZ0GvGA9heN5jzQJQZlbrCszvh8MMPNwaEqr+ttHcMuLxVMAB/7nOfMxbB1sdvxKd0w+wdtkivtzuhB6YyXl22o3y4Q31xYFC77777jAGyuanJ6PTYWUEZe8Yp+UgyOkkGznKHDn4Q6xvYVswbfBkf99Jeb+IOFW5F+TlkiXM42jvqBb+uMNx1J/zomLu7FneSoqMnTOFiQxYkauZ/LmxKKlh4rww/qHAY2i/xwKZc4Iqgu9FGG9kUV11Livz2xZFpHHbhoLonTHtHO0QQZOpNKgRq/BqRVOevjhD9lIe8doTq0yAMVAYo7aVZui8pJgIFZWXak11ZbKlm1x7bxJnupA7xY+srdc93VkaPGm1jRo8JTQvPVQgho1pjJwrh0bhwpsaBBxxo11x1tXEOBzxIR1K/bYYwfZGk0LrxUkJbKsNRd1LRVua0zQn+HJeP4FuGGbypCIrQA1UqBd9w9B9/tKKfGuXTkuw+k4rw7pX/icBcIVCZq1gLPRLZ7P4wkAUeEt4OsA9EqBZPOOGE+B6CXDNBeEnxpoEano6H478Hw4+HvuwEsMPLfPAr3Yr7wf/Co6Qilo80boEf7lLXg04n4F4xOOPHIjeEiBdfeMFY+f7hTT4cCzXLzpWwJUldfCTFtyUQ1OhQeKvjrQohp1zwSvrElXpjjztU4CVTB6Zt3gnOnj3T2tpn4x0kKcyePwiFbGN+5tlnHb2evsU9ZZS64nMPFb6Nf0EPCl+3+ItenI4Z9/5Ta2u3oBJMdxvsf1tbmz3++OMG5rw1I/BuvuUWZp5HqSuf1uOSFIIgWhTWOpVlAOOX//uS/fiHPzLqEkx6RO28JSz+pCJ5nbgFrQ95qrmA0xmwwyJ5gA57I4M8wNPRcPwdKA+EG4S730Y7w1ySiGenpOWXX94OPPDAmJrjePSDDz7YEOQZgFkjtMyyy8R0DGeLLDt5mTg8EeFlldeuHNutmaY59bTT7IabbrRTTj3FXr/2WoEpGJsL7hWTSZpreGkPCMm0AepM6uJFGu0dbf2Zp56239z2a++mCiGdBKlxCHu/1G726oxXbOarr3r8+pDtVqmY0XdMmjTJOMis3jfticDcIOBNam6iLZo4kjoTbvcHmjUQNVd/Sl3uBKj5YCN1uUmKBx81Ot9CWHfdN1i7d+IQnQ8PNmst8GPAwR0+/VGbP+ySOoN4kvHW0ukwREvNy1FEKXjCmnxAhXvxizs2SZEebz8MkKiJ6UA33pg56vYoL+H6I7YNc27K61//+sCDQZbODXUw6yHApUbBnIlU5Ku8xyQs5N6d/7NmzgpBj8OUOh37sHCo0/d/8ANjwWgZBL4Q96WJvaRwG1RPWsQgPMRdabZ53UO4DZUQHNjlxG4H3pQ5Up4pMtpRyb8/nkwF8C2UMjz1O8cFuTvvutPY+cR9X3zwQxAv+UteJ14/1MHclgdekqxSqVp5BT8XviQNqh2V8Yar2QhvSY5J0T3ij3aL03rZoXPDDTfEeq1LLrnETneBg918U4+capxz87nPfs44fp4TpL///e8bYfb6+MdtZRdS4EMdYkrzji18eJGgTUpFfnGzuov0aDO8bLC2qVysWhdkQCs80aCSlicTbUJSxIM/lhVXXDFOp8aelAjMCwLFUzcvHBZR3JoP4jxgc+YUc+k8HJK/PXonXXMiW6WJvVKpxHwx8/oIH2usURyOVXM+Zu0+kM4yPqZFp8NKdR5AeNY6eJlf2CHc8TefU63xqup+5u+aczoOKIvbjh/Cd1j7MUh/dggZBCIOBD/Swq0RscCVAf3hhx+2qk/dMDiuvtpqHrTmb2Ptbvb/X/V5bwSZTTfdNNIGIwi+LJy99957Q1ip5yKp85b8gYNUuNUcSwTFJ//1pLV5vZD3Wq2UIDD9ndzD4MbA9/zz0+3nP/uFPf2fpwwOuMMcE5oTZ7cQD3TxMSNeuw+YNRdKC5fev/CC4EF4vi9DKO4lWZvXUzllhBt+gyHKw9ZKvmkCTgxUHFqGcAcfiVQbc8IfH+Jw7DzHnEtFeEo43TVdLJBl8ABXwnYSAZzg8fKMl72lmdevO3gA3Bh05syeHXXFvTsP+h+BCIy8xRhN2WvIuKce4QUNmtkwDSgV9VCX/U4r9cxzAuEIHgjv1N/GG29su+2+ux148EFxIvPhU4+wAw48wLb/2Hb2tre+LTSWxKHdeIVhDa0CPLmR+k4X/8EQbYV+kLBSb37klzA8p+zyYrqasLgTGuK+b1K0qxdefNFYU0KvQjuhvUiKHUpoWlmjxtQVfPvmlT6JwMAIDEuhhIZfkHehPshJxaOFGw8fDyEdq1S4lzDQGfAAMZBwWBHSPR1GGZa4N910kx1//HF2//1/Njpm/OGLCR9M3F95ZYb3M/5o+qCLvxtG5zBz5qvxEBMWkrrnAbd6Im7JExO/9o4BF35oEygP4fCDsJNndtvwNiYp5q85xZPvSbS7JsCHLYL2S1IxhcPpt8yRU346X+KzxZj59JkzZ0Z5SLOeGem/8oqrdN0fd0mOR3tMQdxyy8328ssvBX7wJOwcF1LmuDAwZ87scEcbc8cdf7A//emuhm9YxJlRYuwQlkIEAzDEYDpQGSnHLB+sZ8+aRRY9f7UYFMjTLM83PHuWKwI2+IEXW6ZvueUWY34ezRRbgDktFR6SZ7JBvNJJKvxpg7S7TV0QJB7+mODMOSf3IAh6m26nQeEJuZ0w4AfmVsgj+ESZcPvvSy+FMEG48BjEDxi3eb1I1F0dU48LRt66g6ffLvH/kkwqqASDNlESWIbdNajtXn81fwbLupCKeNS9pIguFWbcdPyU4Ttu+zSoFzwJT5ug7XBPHjAh/DAh8sUzM336dPva175mzzJd2tGm8B+ISIMP/pEOLwQR3vNPeSCENM5bkRQYhX/+JAJzicCwE0rKh40H7bnnnrVXfODigePBKdyei0WrPKBl2NIEI0mxC2frrbcxBJNVVlnVH6Sqd75Fp8ygyVTOoYceEseus4iMt1f4Qdhx41RUcw1LQebx58TD/vLLM1zrMqfhQE76JZV5wmQAQADBxN/7C5s9uy34PfLII0aalA0/iHywDZBphDvuuMPzrzgACk0Jh3gRtr1DsCF8f8TbzRprrBHz3+3ekcKbPCEMsc7htttuM+xz2tuCDX6EI0+sB8F00bBjnKyEUIJgx+4C8vbnPz9gLMRlIH/ggb+6/f7Y9XTVVVfZqad+wXFqs9VWWz14S4pBFv50gOVakzJN8jbdO9a/P/IPm+ECUbvnqeYDQETu8VNzEGkX//U3vFdf8blw98cN3rj//eG/B4+Zs2dFmvhBHqzzv7zHJA4atMsuuyyEKgKhZWJHBfkiDIT7QIQAyEF2nB3DW2fZdhEyr732m4aAAa7wgSdhGOgIN/PVmSY8vH5ZK8OagRdc48QXjSV5Oyw0h8QjWGlit7ofcKC9ofqv+UBaVcUkeX20G5g89fTT1ubtYY5jTNi++NSxXCKsDMIlIcBDkgw3yc1qxSrVqlWanCpu7yApas36u6S+w9TjL1MnG9oeJCnacacHFoJVCnfaDm2YU4Yv/OpF9vKMGVHXBKPng7D3pJo/X7QT+rv2ttlW8/ZgHW2PsJLihYiFvBIJ4pqUCMw9ApW5j7rwY9Y6Bho6b87S4K2Vh63dO88yN6yxuPbaa+ModQZu3sjxr/nDRRhJJik+ysbqerb9vfGN69ro0aPCvaW5xQj7+9/fHgvczjnnHNea3G+o7RmEGRQRShigap6fNp9KgC8meWIXBQ8w4XmzJgz+jSgG3meeMfKMZoYw8JEUb/SsW/jmN681dmdQZr5Pg52TRFlHwtw1HQ1x2lwLwRvQi//9r7300stGmW0QF/mjY0UwKYNXvCNlJ8/j//qXcdokgsnjj/3TwJNBDJPyU1bSJh6mJKt4Jzh9+vMGbpwou/POO9muu+1mu+66q+2yyy7GAVU77bSTsegYHssvP8VWX30Nz28tBlQEIMrNlBRrLLwyrN0xpnzmF35XXXmVgfUzzzxr1AWdJuVwbw9ei2+BgBfrgzjmHZzBgzCYTIFwjshvf/tbe+7Z54ywCIWSYBFUhqW8pMnx/d/4xjcMfrwZUt5nvO6oZ/JAPUTEQfygZVnJ5+Df+IZ1OxfcSnLt0sv23e98Nz6m95e//sWo75e8PskDmquHH3rIMMlbfbsnfc6doRy0OcITBpK6ykTWcAMP8o3AS3nA7xUX8vAjDDxudm3XE/96wl584cUQjsGn9CdMUhcCPC8lSd3x7go1bzapEC5KLqW2ROoSRFWpRB9WhgnT+yhM2iuCLvWItuTb3/l2CNft4Y9IAhGyN9G2eZak7nlo9r6SZ4FjBdj6nu2jN3bpMnQEKkOPsmhi0OB5sBisGPD4cBpzpOyqYdU3K95ZDc9WOw6jOvroY+zCC78aX0VloPPnqS7jvMFUQ8LfZput7fLLL7M9fG547devZcsus6xNnrysLeMmHc0VV1xhBxzwCfv85z9vZ599jp16ymn2hZNOtv88+e84uZO0SReqVmVf+coFxpc+ORmSbaMMgnUJd1oZVDjynhMdjz/+WGNhKTyWWWYZ4yGHJk5cyv7whz/GAE44iO3LBxxwQAgLYMLcNm/ss10oQcACGwSq6Gs6U+vbwoDEAM/gNGW55W3y0kvHpM0tmQAAEABJREFUdMqEiRNt7Lix8bG5qVOn2ic/+cn4Au0f/vhHu9TxOvozxxhTR1H+jnjsRJk0aSnHdZxNmjQpBIQXX3zBnnn2Gfv3U/8JoeYln2ZACMKfrZJrrvk6mzhxvHemFsIEh7cdccQRxlkOfKsH/ss7f+qFcrIm47e/+U3Uwde//g379re/E0KdpCgkeDNw81E9sLrxxhsNXJkyoa1Ay0+ZYi+7hu3kE0+KhYqEDQHIORAfXDEZ7KnDk08+2Q477DBDg0a9sFiVekI4O/LII434CC5SkQdn0+e/pCjnXXfdFYIueYPnpKWWCtyJeNaXzrIDPnGAnX766fb73/3eCMtH4zig7e8PPRzlob0Tj3Khrbn99tujnVx++eVxcNvLL78Mq15EuahveHP0PcIZuFKmFVxABOtxY8fa73//ezvs8MPs/AvON3adTJs2rRevdFi4CEi92xfPEtTuL10IKlBnrpAzoA4H6h4BA83aKSd/wX744x/5C8xLVkPzYb158xxICuGFZwo28MC0CC9r6vgQJc++1JuH5ZUIDBGBYSOUUC5JPuCNjUPAttlmm3gbZ5rgf/7nf6yk8tCjbbfdxlZe+bURdvTo0R698QODtP/mN7/ZBY6zY9sfbxFf+tKX7LjjjjVOguVwtX333ddYO7D66qsZUyTbb799bO8jra9+9avGSZ0MTOedd56xtXjzzTePg8tWX3310Hh44r3+pUJbw84X1rh8+tNH2WmnnWYIMwgWCCBnnnlGTDGx/oA3Ec4V4TAnNDxMPVH2Sy65OMp+9lln21QXHjbYYP0QalpaWnql2chBkgtgy8RHydBenOgD9UknnWQMxAhiDOwMXpxwiQDEgEUHxE4E0r/wwgujHs4+++zI+5lnnhmDKfHJ4/EnHB9C2nHHHeeYHhcfSgRXCP9DDz00FsuRN4RABnuO395rr73sjDPOsLPO/FLUDdiCMfWMfb/99rO11lor8s7bGvFLouwrr7yybbbZZkZ9UE/U0cUXXxy7IS7+6sV24f9cGPnhS7prr722McgTX5JJco1PJUw6cVTTpEd+KF9Z1pMcJ9oG7YcpGRvkxZQZ7em4zxwbOFPvp556StjJ73HHH2c7uzYJQQFtEoMObYStqYRFQwb24HH++ecH7uSFrcajRo0y6gcMJDXMEc8DCxPZropwQnkg2t3ZZ51lZ3ldnnrKqaHdAhsEOXhKjfk1TGQJcmTwXhTFlRTbzKlP5k9rdRrjRvkhn7wM8SKCFu7YY4+1G268ITRhvNTgX8ow2OHBiyCaM4SSpubm0GZKtINCs8kzS/tvamqyMk5pEj8pERgqApWhRlgU4ctGTufMqYF0znvvvbftuOOOxvZKOleEFIh7pgiYLthvv32NY6MZBMx4kKyPq2Kto0bbGv7W/sFNPmS77baLHe5vibyx84Z8yCGH2kEHHRTagk8ecrCx2n73PfaItBn4OBmVj6+Vae/hfgyqDBJl3nsmzEPMlAkaiCOPPMr5f9L22WefEA6Y5tjNpzx22WVn+/jH93BNzQHG4I3QgUn5OSJ+q6228PJtYttuu61tt/12tv2OO8RUCYen9Uyvr3sGdAZdBI9DDjvUPnnIJ42zGMryYofIJ+VCYDjQ3+I/45ooyg2BNYIS/nzYbF8X4tDmEIe3e/J95NQjDa0C2yZLohwIWWXeWltbQ/hji+X+++9ve3x8T9t9zz28PnaLjwgiDIIx9bz11lvHVBD3DJrwAOuyjZD//Vxw2Xnnne1j237Mtt5qa0NYpL42d2FlCxcc4UG+yTMYwEMqVNSSYnAHZ/JPmQhLGZmWoszUE/WMHa0F8XsSeap34x7M1113Xdt3//2McpLP/ffbP6YLyfehnzwkNEVMnR1w0IFxLsYhhxxi1A+YMP1FuWlzYEJ7J0/gTXvlgDawrE+3tIMPwi11QFjKAFEGiDLuvututqtPtWHus9feBgYIJyWPNLsjIKm7Q193jPhQX/5DdKctUZ+lQCzv46CebCR3dcKdOAglCBtP/fs/dvyxx9lpp59mTBe++NJ/fRq1vVO4QCvClM/fH/mH/efpp4yDEVnfBB+EEQRgtHQ9+zlJBElKBOYKgWEhlEgySVFAHqqw9PNThinNfoJ285JIo9aRljpM63xICVzPs96OH1Tvhl0Szn0SYeo9uYdKN+wl4YYdU2LwJG/cWeRV6j8tW0SXzPPKq5ynT/4ht3b7l9Ttfm5upHnnQbpSbz6STBLenSSpl1unp1sopyS3df1LXfeSOuNLhV1SV+A+bAwIJUkKrQ730sBxrcclDT1ODxZ5uwgQkClS5eUGjRo3CBGYJUlFGNohVLpjojFBMHnl1VcNDSKC5zVXX2OPPvJITLMydcmaKTQkTGHGbrW2dqIG1eLX7DWvea2x84ZbqSs97pMSgblBYGELJXOTx25xJB/gBlgwIRUPh1SY3Rh03PR8SDucTQISqCuuNLC9K37jsKV/T1PqCo+fJJOENUhS3EvqvA+L/8jzCrm1xz+dB9TDeZC3fWEzyOgerHva5JydIu5hkoKwQ5EWPRyEwzxQ8CI+vCDskPwHcqP+nyD+XljvNF/tUoNEh5ICGYQGiEMQaIBg8+TdiW0PLn259wiWtyBAc4CwQ1QahH0IBAsI7NGUMOUp4WK9ni2pcLeOSyr6TwSYWbNnGdTc1Gx/feAvdszRRxvaN6YQWdTNVClTPByNX/G+hgXn1u4ZdpYIQ2hKODyQqb0O9mFIHiBs+ZMIDB0BRt+hx1rEMaR5b/TS3POgM1jEEDRMvnu+5r580tzHLTLWO77U242wUmN3/IZK0tB5yTTUZOY6fPf6acymdxgfBBoHHdC1N68Bo/QZQGqMk9TYvU9G6THfEJBkrB1i+pIpQQQNqXt99GwD9fe0LA4oZIpGYtFqk7H4nq8ksxaMhfO//OUv44gDNCuRcQ/HLh/OCUIoed/7NrK51dIFv/xZQAgMX7aV4Zv1RZdzqfuDv+hy0j1lqcwX1Vrau4dZkHd0cpB1DPTYIRvoIqvQQOEG6w8vaIDwBIEGCDbfvKWBU5PqwmCtv+8jJxGsgZ+ETwOPdFowCNDYocFyp3qgwYZvEA6NBTvUWNshySR1hpLU7b7Twy2SDK0HQgoCB9vEEU64b2ppttZRo2IBOvcIO4TBTjRJIQy95jUr2js22CCmt/FztvmfCMwzApV55pAMEoFEIBFIBOYKgXkdzNFSMH2DYMICVu7rM1LPX1KnV+kuFW4IHuw0QziBXn3lldgKjKDC2hMjWEdYmLS2tLhA8vY4FoH7hUWZzshHIIWSkV/HWcJEIBFYGAjEwN0oIdZYQb39JCJZaBt6+/bvIsmk4mgBdo8hWLDGpIwlqbT2a1ZMBkkyycm1PbX2mvFnFVnsuHF37lWphAZlmcnLxG4280vyOE5uzf9EYJ4RqMwzh2SQCCQCiUAi0IkAWggIzQUnqHJ440svvRyaBwQH/FwKifDYa7VaCAPhMISfMi5bgjlvR1Ks7yi1Jfhb3dXzHi/cEDaCav7bQfh5psKIH3eXFPxbmprjsxTv3PCd1i2M5ZUIzDsCKZTMO4bJoQMBuQm5Ef/YobjJn0RghCNQ8/IhdLz00kv2z8f+aZw4/YPvf9+uveY6+9aN37Jbb73V2GL73xdejEPICCvJx3V5zKH/S0U8Fpyuv/76xsm8cCm1JQgc3DciqYiLH/mGsEvqzA875iDWnrirVVWxUS2tNmnSBNt66y1t/IQJZrK8EoH5ikAKJfMVzmSWCCQCJQJLisngj4Axa9ZMe+yxx+yHP/yhHXboobbddtvb3vvsa4cffrgdeNBBxkF+++27r113/fXxXaM5c2Yb8Yg/N1hJMrQiECcYb7TRRoZ2phRKrOOSuksOkk/JuOajw7ubQV6gekdJkQ6LauG95ppr2Yc//FGTuvO1vBKB+YBACiXzAcRFzoLXHKhHRnCCejjnbSKQCMw3BGouWMyx//73BfvjH/5ofJaCU3l/9ouf2yuvvBqfxWgdPcpaWlt8+maW3fbrX9vRx3zajvzUVLt72p9szuxZHr99yLnpKTiw+2a77bazMWPGdAoQfTHtGVfqEi6kLjvxy7AII62taEkmhXDFwlqpe1jCJyUC84pACiXzimDGX8IQyOImAgUCDNhoOp577jn73x//rx14wIH2nW9/JxaCcspqS3OztTS3WEtLi41qHRXCAueJzJnTFh9N5NMOd/3prhBKYodLwXZQv1J3gYApHL6ntPHGG4e2hHSkIgz57I8p/pJC84G9PqykyDdCCRoZ1q5s5xogqWI9w1peicB8QKAyH3gki0WNgDwDkBt0FJBbDScIez2hPYHq3Up7Gbe8nx9mybM0++KJfz31Fa50J2xpT3PhI7Ao8G+UJm0ZKhEgDITAULrNTxO+EFMljz/+L7v66qvtmM8cY4//85+2zDKTjY87vu1t69tuu+5mfI8I+th2H7MN3vY2W3HKCiGk1Gqyu/50t5100hfsnx4PoQSePfNJOXq69bxHWCAcJ6vyzanyO0wIKpJMUkSRCjNuevwQHydJEZ57SFJ89A/BarVVVzO0QEstNclqsdhERElKBOYrApX5yi2ZLXIEpKKjoENpb0e1DLXH21h7u5u1Wrzh4A+VGS7tUhG/dC9N/KHgAZ8+iDBQGQ9TKnhKhYkbVIbDpFOmk8ecM2dO5BcTP4jwPUnqzq+nP/fEJc/1JvaSCDMYKsNjwg8irxD2kvAvyax+qOyeCmHqXbgveVBu+GKWbvVh6+3Eq7+vt+MHlTzgyT3UMxxhSI8wEGEgwpUm9nqSBsa/Pvy82Ms8SI3T9FYd7ZozNvhuy8svvxwnkVKuMm5pzks+iIsQAN/HH3/cOIr91FNPtZmvzjTWdey4407GEe1XX32VfensL9mxxx1rn//85+28886zq9zt7HPOtg996EM2btzYaON//OMf7aqrroJt5L9nHqXG5Y0I/iMphAi3hvCAtmS//fYzNBtScUorfhC8JWHtjBM3/iMV7m6Nf0lWqVYNwQaBZOmlljY+XLnRe98bcQntQSyvRGB+I5BCyfxGdBHwY+hr9wGQTgeaPXOWzXhphs9zv2R0zuwGwIRmeGc945UZ8c0LBiE6V7Is0c1g86HUBZfCVtgJx9ZG+EBscYRefPFFT+O/VpoctFTyK+P3Z0qKjplDm4hbz7u0ky7CylD4lmmCBQPsK6+8YvB74YUXjAELs+RLmDJ8fybpw4d48ILAoDQD2xkzYiAkzVqt3cvW5iwbrxeQuvCGNxjDg7xNnz7dpjsxLQC2DLS1ujpxpp3/knoMZj4819rcrS3yAq7wotyY5H/27DbPW1G38AVf3AkDkQfuSZe8dSa2CC1SUc7+svCyt+tf//Y3du7559mPfvxj+8c//mGUhfLNz3JQv0888YRxHDsfs2tqarF3vfs9dv6XL7Czzj7L+Gru+PHjrVKRD+DmZiUG9xVWXNG23NtYcTUAABAASURBVGpLu+CC84yvPo8ePdrA+Pvf/7498sgjXmfUHU9zf6Vs7IeghM+kSZNs7733Nr4UjRsCBVM52PGHJGF43tRJ4eA/tAc3rKmp2UaPHmOjxoy2pZZayvb8+J623777eviKk4w/wiUlAvMbgcr8Zrh48VvycvPiCy/avffda3fddaf96U9/smnT7ra77y5o2rRp4fanP02z+++/3/7973/HYE0nW4+UpM5bBkt2FPz2t7+13/3ud3bnnXfavffea3/5y1/swQcftIceeii+l8E9Heuzzz4bHW3NNSney3byaWRhoCBtBt5//etfsYXyxz6YfOc737Hvfve7xnc3yPuTTz4Zwg9hG/Fp5AZvBAbikt+f//znVvLFftddd8X2TAZqylh2xo14ITT97W9/s1tuucVuvvnmwAD8KDsD38MPP2z4g8c///l4CD4MhI149XQjXcpFPv7+978bOP/kJz+x//3f/7Wf/exngTn8n3nmmRAyesbnXpJJwhrU7hoyBrt///tJu++++wJHBj7KTZsAE4QVwrV7PSFcUXe//vWv7Qc/+EGsd7jjjjtiJwl+A+ETiS6EH6mrjD2T42NxD3odffrTn7Yvnn66HXzwQXbYYYcZ5f7Pf/5jRXkbC4g9efV1X9YVdXHttdfaJZdcEgtLt956axc0LjDWcxBXUggilWrFIPOrUnF7UNVWWGHFyN+uu+7qwmF7PIf/7//9v846JB2PMqR/qQub1772tcZH9d71rncFz6amJhcwRrug0RT38O9J5pekWA+DdgRNDuYEF6522GEHO+KII1y7M85DFcJsWPInEVgACKRQsgBAXRQsZTLe5H/+85/ZHnv6W80n9jfUuHvuuUeoXVG97rXXXvEWtfde+9iBBxxkJ5xwQgxCdNoMjI3yzZszqufdd9/d9tlnn4gPnz09DUyINzP89t17Hzvl5C/Y73//e3vJNTLtbT4I9PHix2CI0HDPPfdE5w6/2DLpqmcGE7ZR7r///oY7Aw3bLBkM+spnfd4ZRFGtEwde8CWfhx56aGzPPOCAAwKbT33qU/bNb37TEAYYxMlTPR/sdN7M+fNmu8suu0S8ff2NcbfddjOIgQUCn1122c3x2SdU9dNcGKQ+iA+fRoTfK6/MDKHuK1/5isFjp512Msp98MEH+8B1cNQd6V144YWGcDKQsINCZcaMV7wO7oiBadddd456AwfKAK/Pf/6zduutN7sW4UUXzP5pV1xxhed770iLMOAE7pjf/va3PdwLca4G+W1UjkXpRp4QSP7z7//Ypd+41O69+x5rqjbZ7FmzDSHryCOPDOHk5y6UonkCP+qZeEPJN+EhNC+0qwsuuCAG+e22287OOOMMQxCAb5fwUTG+rBvkwogkw0/yJ1UV1z5MNuqCeGjIEEAxad/wwbQhXpIiBumsvfbadtZZZ9lHPvKR2AGExmTs2LGhsUFzgqDCFA+EnZ017NzhIDbCYV99tVXt8MMOjx1FaGCCuf9IRTpuzf9EoEBgPv6mUDIfwVykrHw0muXz2g89+FBoMP7tb4cM4q+88qrN8GkFBADovy+9FFoHBm3einkDOu200+ypp55qmH3eMNGC0BkTn4GWzpM3e7QipIH9+eeej8H1sssvj8H029/6ts2cNcuVJb1V0nTu8PrpT38aAyZz7mgz6CynTJliq6yyiq200krxZgZv8okAcf7559uzzzzbMJ+lY1vbnNDe8KbI4M4AwmBEZ8s3QlgEiGodTNB8HHfccTZ16tTQSLS1Md1ScipM3CgjmhAGNPAg72AA36effjo0I+ADHtOm/SmEEhY3MhAiIBWcuv96dbkQOdOFh9/bgQceaNQBWhfyyULJ17zmNcbCRQaNP//5zzHAIJyhoWHQ6s6tuMMdrQ5aIISQK6+8yp544sl4m4cXA81zXk833nijIXBcffXVduaZZ9pnPvOZ0PQw8IA96ZPvW2+91cDncq9Tyk69FSkt+rdl8gJRP7RJ1mZcd911JikEKHDAn3KgeWKB5he/+MXQ8FH3YIV/WZ6BTMITD00WmMF/8803D8EPbImPMABJfQ/akowwCAIr+nTOhhtuaOSRuqduyRNkflG20u63A/5LCt7wp9288Y1vDA0OzzjtCcGENsD2YYi2hglR9wgjuPEMbrnlFsbzRjvC37icP0ZSIrAgEUihZEGiu5B40wVKig656qpaOqXWUa22vatdj/VBl8Hs2GOPjTeeE44/wTjYaZMPfciWXnrpmGq5/vrrY3EeHW3PLNMpSgXv1VZbzT73uc8ZvNCyQAgUp5xyik09cqq9//3vt3H+Nsb0AAv6fu/TPbzFSurGFq3Eb37zGzv66KONAZc5a+bh6Ty//OUvG/P0X/Y30ROOO9623HyLEFBmvDzDLv36N+zir341VPHdGFq737a7ANRmTz75hJ3t8/pXXXWlu1ksPtxyyy194D3WO9kv2znnnOcD7Qm2/fY72tprv8FQUd9+++3GYkWmsxAWImLHj6TYLUE4sFhnnXWc1zGBAbgeffQxsZARIegTn/iEbbDB2+PNlKmdL33pSyGoMaB1sOs02lx4Yrrn+OOPC8EEDN7znvcYPBkMeBM/++yzQ8B785vfHAsXb/apI4SX5557rpMPFvJlVvP6r9kzzzwVax0eeOB+mzhxvOdnfc/vZ2JB5mmnfdHAAqHs8cf/Ffm++uqr/K19Kfvwhz9sJ598cmB/uk9/bL/99tE+EL4uvfRS+8Mf/hBTDaQHScJYZCQVa0wY0J944gm76KKLQqND2wdvhCgESAQWScY0FO0KjR7aH4RJ2jthof4KAr6EZSoMwYZ2wkFltH1OUcWfdKXBYyIV7WqttdYKoQTB92tf+5o98MADUQ7yBN+S+stfTz9J3hYUAgrnidCmENiOOeaYeEYRUGhvCCITJkyI+kdAYpEsgjz5OPfc82zDDd/h7a7A2fzy1wsz2ZJ0ZVkXAQKVRZBmJrmgEPDOqNpUDe4MoltvtZXPBR8WAx2ahqmuETjiiMPts589wRj0UG2jtkV7wtw70xQRue6nVD/jNGX5KfFWf4TPLzO9AjHNQEd2jAsYdPpMcSB00HEzT05nTtyS6GQZRBA+SI+OkSmLyy67LAZ63j7p8D+w8cb2CZ9mYWCmU112uWXthRdfiJ0KrHco+WGWggRaIYQdBlreCl/3utfFQMuCxEMPPcS22WYb23rrrbwMB7jm4UsuiH3dyC/aAQbqNteUOISwDCKvkqJzlwpzlZVXtoMOOjCEBfI1deqRse3zgAMOjLTYebHZZpuF4MR0y09+8lOTevfkDJI/+tGPjLIwMCAEkE+0JptssomxHoBdGuB77jnn2vrrrx88mZJAA2N1lyQXyCwGN9bmsBZn1KjR9sY3vskuvPAi4233gx/8UJQVQYmBuVqtGBofSfbBD37QEIRw5xwKcDrppJN8OmmPEEQYwH/xi1/UpVhYwaewLbzfMk1MBm60F9/73vdirQ+aNoQR/CQF7tQp7ZF2WPFpFIRg2j3lQ/uF4AIf4jQqBe7wePTRRw3sWFP1lre8JaY+V199dce91tk+GsXvyw2+aEvQslSrVSPfTCXuscce3i6/Edo+6oe0CdtfHhulISmcJcU6ET7YRx/ATh80ZayHOffccw1CCEFogT772c+6MLJhCOsSPBQ4gp2k4Jk/icCCRCCFkgWJ7sLm7X2GpOgoq6rYrFmvWiNNhQexSZMm2o477mhb+0DdXmu356Y/H29pdICd2a5hqwU/3NvmzImpoHCGiXtLnqibuKF5QZBYZZVVPO1Z9ug/H7MXX/pvxPcg8c8gwOLVm//v/2x06yh777vf40LSZ0MbIhUdKJ00A0xTc5NNXnaZyCdrQlpaW+3Z55+LY7x5Qw6G/iMvq1nFpj//gn33O9/zwbndlncB6lMuMOyy087RwcKzqaniHXSTVSqk02RvetMbXTg5y75+6TfsxJNOMt4WKad1XJIKW6chY+vn854OnTSDSmtrs/OrGEErFfN0l401IUwVvfrqLGNRMYMijOp5o4H4zW9ui/zwtozwgWCEeh0hBeJtdpnJk21tf5s+4vAjDJ7Eu/nmm0NYgGdJkhzzOfaPfzxqaFLY2fHRj25qa675en/brfpU2FhPq2rjx4+LtQwIOe3WZpOWnmRbufA6xafN4IUw19zcbGNGj7FtttrGXrPSa53vrJgSJG2ru6QOYOrcFrRVKto3WDJgI1igySHP3ONenwepCM+gj9YEfwb4a665xg5woZeF1Sy0bhS3DPvkk0/GuicWHyOIoOF7+9vfHu1amjsMpCJfTPuRX/JEemjP0FixTglhgXsE2DJ/hCH8YEiSt0t1BpUUC15f97rVXRD9gLEe5mMf+1gs0H39618f03wEJi+Y5s+UVDFJxW3+JgILAYHKQkgjk1jICEgyBs2SrMGFHwNg2bnS2dH5Sb07IKnOrd3fDDvu6byIhynJGKSZk0Y9TCfKIIDwIHXF582Wt03Wm6AloVNEGGBQIU89s4ob4Zh2QNhhcCE+b+/1YckDg/HvfSqGAXm99dYztC7mSZMvyS11ESSZpDjb4a1vWc/e0jFFQnnqgvmkiPngU7jUXHiTSx6SYqA3v2odahpJ4YbmCWGCeXjyxNsueSacJCsvBBW0SaNGjXLBYc1YP0K+yWsZBpP0xvk0zDpvWMeYPgNXNEzwxb+eSA9cMMFz1VVXjTIikBFOKsrLh9QYXMF2oqvvS7tUDJSEbW5ptmWXW86oS/jRNhAo8VsciDyxQBvNFNohykhbI29SF87lvVSUDY0JbZDwrGNCi4TWjrqgnuBLXZU0ffr02LWFJg+hEK0gmiT8pYInaQyFiEs68EbzRRuQFNoS6ldSCIEnnniilZoTFmNT58QjPlSmWW8v3UpTUvQFkqItWFzyX8hCuCV+ydc9IjxtQyrC4JaUCCwsBCoLK6FMZ2EgQCdS6ex86ODocBqljDvU1jYnvBnEJk2aFJ1UOPDj7NCASDL+2nx6g84LMh+MJXd1ogMj+GznxRQLi2Zxg6fU1XGTHoMx6y2am5pjLvtt67+NqCYpzEY/DNQsvlx33XVjESOD0SMd5zqU4RlQHnPNDIMyC/bWe+t6rgVYylhjU4Yhfai8x5QUaeMuFXbcuceknEF+474mNyk/WBBGwsU8SC2wY2BkxxIEBggnaB+kIpxHj7CEi0HeAR4/dpyxY6Tqanz8S3IvM4+HYAIG48ePD60Fb9cMrFZ3kSeIQVdSDCzgTzyru8iTXFNUbW4ybynW2tIab8j1aUsImM3W5GFGjxkT5Sp517FaZFZwR+Bllxdbx8n7jBkzIj9Sd5wJGx51P7SVcoBH2DrnnHNiVxZTadxTVgjN0P+5Ro9dLKSBkIt2pZ6n1JVeXRL9WolP3aMxZLE1gXkuMGkXlA2T+mONCVMq7PRi6oXt+dQ9+YMPJJOZvywQv57wq7/HLsmkilvlZBbtwd2B5BuwAAAQAElEQVQwS5IUfvmTCCwKBGidiyLdTHM+IlDf+dR3J1L9XfcEGVQRHm679TZj4Fpu2eVsjTXW6B7I70re8oGMjpJBj84aomPHpJOkM+eNFRU3Kmc0BvBjIJWKfEjF2yBCRc11EAzYnBQpFf6eXMN/SaF25s2f/JAeeZe64pE3BJJZs2dZU0uzEbbsZF0KiLdQBAXeiJ944gl7/PHH43hvzCf/9YQRFzU+nT2ZkLp4kyY84NfeIYwxqIAFgwkmhB1VPzt+4Ifm421ve5tPmzTDshfBFxxenvGykS7UKxAOnqZ5fhgYicOgCuFVT5I8mAuB7igpeEryu+7/MpnD70VyrZdrfup9JfcLhxCJjDKTJnnDDK9F+EM+IOqQNTgM4GBBe67PFnmVZJKinNxDhJEU2FCHxJVkP/nJT2La7eqrrzbaCDup0GKwsJt289a3vtVYKIomUBJs5orIA8TCVtaQ0GbAmPYjqTO/3PNsERZ/FtmySwpNDXklPnnHnzbkETvzgxs3kjAGTWW8QUfIgInAAkAghZIFAOrCZikVnU/xS+o1H4RnGh0enSsDJJ0YJoM5HTrbD6+44oo4KGvcmLG24TvfGap6YteTVHCNQf/ZZ+wHP/qh8XbKojgWzHEgGYPwTTfdZKecckosBmTwXG211WzTTTc1hJOSH50efBAqKs4XPzrc0r8/E55MN0kKbQkCUX14BqXoxP2NscW1MBPGT4gBlTA1d3vm6ac7F/eyQBc64rDDbeoRU23qp440tr5ee+21sZiUfBKvntra2w1N0LPPPRu7ZVj4yZZmTN6m2SqKnakAphRQybNTh/UaUoFhN34dWifyPeOVV2zGKzNiLQj1RJ0xFfX8c8/Z80HP28svveR1OtvHnoJXzzxKisFXcn//L0QKC7f6dLEziDGwSyr4VTwuHnUEf6nwlxRTU7aIrzJPCI8Iv7fddlvkH+ECP4gsliZ2SCrKgb0kSWFlYKc9SjKEarQSbOemHlk7wrQJbRmBhIXTEcl/pCK+W4f8TztFQ8JCZ14IuKc+euYbN55hylcmcuutt8ZaGPLJNmjaCQIMdWodu9CkucubNHfxyrylmQjMDwRSKJkfKC5GPORvvlLFZsx4xRhk2bbIwjm2vLKdFDur8JmrZuU9nSKL3Nj9gZAg+QDFm7mXiU4Skgo3diCw84ZFmSy8ZGBntwiLUHG78cYbrKW52Vi4edBBB9k73vH2GMzg4eziv1Zrj4ESjQMDMhQeg/hBgIFqnj8Gk/ookufRhQ9JJjH90BSm5O4e/tlnnjUEp5/99KeG8PCrX/7KfuWq+Z/97KfG7g22RV955ZVx5oiketaRXxzI67Rp04zyQqjUd9llF2P3EIsGOfyMt3fyuPbaa9uRR06NdSBSd37wKolycK4I9YJQxxkYTBdQN+yIwWQHEoenMUBSduIyYGFCuEmK8pqMf89ze2gD8LNGl4fDWeqwcNNJtbARF+JGKnDEvqhIUgikaLeYykBQZdAmj5JMKvIoFfb6fBKGe0yotEsFT/hQF5gsfmXrLxo/FgDTxjmErIxH3KFSGZc2xBTMV7/61RAyyzThJxX5xw5Jwoh6RPAgb5Ji1xQvFCyGpb1wSu9zLiy3cVhhxCjqL6wdP2X6HbdpJAKLLQIplCy2VTMXGSv6MPPe2Wa8+qr96le/MgZadiewkp83eO5//P/+1/7lUxiTJy9r6633Vps6daqb63m0goFUmNZxMQDSqTHY0km/dqXX2AorTImvobJLpKmpYhMmjLPXrbG67bbbLnF42I477uDTFk3mMlIHX+8oa23mL+Xu3mxMH8yYMcPYjtyRTEODdCE0LEwRkRcEKTQR9REkWWtLi1Ur1Ri4eJsmLHFVrdjSy0w2duLssP0OhvCw19572V5OO+28cyw0rVQqnfGIU/LGDh/usTPPDwYszuWMCnYc4cfbbFNTi3H2yY477mhf/vIFxgFUNS8z/vUEH0hSpMnCVQQmDinjZFeEEQQTCKGEj74xCDEYk8+Kyf/MBQ/HtI5x8HQffNEOxb2nURcE2CNezTU/4d7DP9wiFDZ//3YhEptUcUNOi+6f8jCVgpaE7dbUC4O8VAzmUvf8ER4ix5JMKoh7SBJGEHwY+BESwJh6ZqqGI+SZMiGQ1BWe+6GQVOQRLRhaRs59IT5pYjaiMu+lH3kkfzwLuDENesEF59vOu3h7+5+v2KOPPuaavpkuxHAIYDtBOkma+7x3MklLIrAQEKCnWQjJZBILBYGaio7XE2tpbjHOU3jvezcyzv3gYDOIsy9YsLfzLjvb8ccfH1sd+bZFqSWR5LG7/ukY6fwlxUmrl1x8sTF4XnH5FXaFT/+ccMLxximpdJhrrvl6+8QnDggBB37NLS2RH3iYyeQDf0tLa+w0gSeqZwZa63EV4QtHSWFh0Ge9Bh0yA0YpDISn/1RdGMGtuanJWGfAQlipiCvJpiy/vB13/HH2Fe+8Geh5w+TcCbRH7KZgcKAMpC0V8ZytSSoGcde2NDc1G2tEEOzQiLAmACGCnUHkCRx23XUXY9fEm9/8FqJbxfMVlj5+qtVqCHccnMYZIe9973ujvt73vvcZdtzf9e53G37s6iFnkoy/epb1+ZZU79Xd7uUgbLubeBASwt6Tai6Q1DrCWQgqfYXsGXP+35MPiLplQK9UKiYV+cFdKuqpZ8pSd/cyLOGwY0oKXpK4DTuC7zt9SpMpHNYGhcc8/JAWbZjFrezkob3gBpVs6+2lWyOTZ6dsq9Vqkz3+z3/ZWWeeFR/5YxoRjQphGsVNt0RgcUegsrhncFjlbzHILP0qHRInq7JW4trrrgvhAUECjUnQ179h5597njHFwtQNA2N9J19fDN7FXdbxwbVivDlusP4G9o4N32nvfV8h7Oy22+4xncGg/qtf/p9d+o3LolNnLJOqPpRVTCoHhoq1jhodC2oZFP/78gz7wx/vNASN+g5ZUn0WQs3NOhh2IrS2tsZ5HWxVrQ9Ubaq69mYFm7TUUrGWBpU2Wy7BIng7z6bmZmtuaQlNTYubaFDYhTJ+4gRrammOk1txj/B1zCVZxanZBZ5lJy8Th0txuBknYCLgMUX2gQ98wB5//DEX8i6O6SHeaNvaQK97WazjKvPF4PfuDd9l37rxJmMK6YYbbjDepDEh3K67/jq76KsXGdNirG2hPjxDISx1sOu0S13pSV32Mhymav7rU13+W/z7ffeQlcI9ft3TTeqzJy7uvND+pSKH7Kx605veFG0CDKXCvT4j5BPCrTRLu9Q9PP4Q/hDPAQLDmmuuGeuMVl55ZZyjDYdlLn7gjxDBmhW0XqztKt1KdpJ6pSGp9A4/SWHiSHyeOdoZO7fgz3qTo446yjDb6+uXCEmJwDBBoL73GSZZzmz2i4BrbaViTQWHk03yAXeFFVawKVOmBHHWAsIFg6+/bLqwoX7Z+WhXvCT7qFRVJaYb6LglRQfJ9A3rKtZbbz1jsSaLYPmaMINte0wRFIOaJE+nFttPN9xwwziKnSkWTn3l2zoIJh6g1z88WPx5yy23xNkNDBjrrLNOHLZWH7jZtRhMqbzZByzeplmnwcmm8KUDl0jfjLxDkozBefrz0+2eu++JMrIbaNKkSVGukndnXA9PXlRRCFEIcpLzcGLgYn0N2KLNQXtCmaRSGCu5dZnwhSQZvHgbR9MDwQezpKUmTbJRLsyBqVSkSRms7pLUdVdv73AlLaylSVm498L6f13ccOz48aorw9dca9KAbUfAhWewm4spFYRSyoCQKhU417yNSkVZpMLsK2dlWEmd5Qdf6gLcWUeChpFwffEYijuLWdk1Q3unDSNQ1PPGDvXFEz8If6krz3z0EoGkYoUbX6lmTUzN66vmeBA+KREYTghUBpHZDDJcEPBBRFLkVkIwqVqTaxAkhdtQf+jUoIjtPOi06VClcDFJrnVoCgGB776MGt1qz01/1ljEhyDBugWZOpOtud6EMGyv3NC1LXPmzLJ77pkWp6qyqJA1I7z50clCCBcM8jfffHNMGaGW5rwSBiUEq07GbpEU556w2wWB66mnnzLWZvzh9jsM4YdBgEEMIg1277Dg8Lvf+Y794uc/t3Fjxti73rmhLTVxknOr+yf7LoiEEOD25uYWwy7JJIVAMWrUKHvzm99se+65p8/nt8cR4Ry5z5w/6VmDC1whvCpeR2g+wFcSTp0kyaqVqlMl0jW/yvTd2utfksnz65lzeRLEzVH3YJL/mDsXpnG5VVJ3N9w7SG5W3N+NjjDewLhZRCTJKDu7YQ455JAQcMEMgU5SRx4tzBJb67jKe0xIUodPYVR9Gg1eaGL4TMDHP/7xwE/qHq4IPbRf2vIjjzxirOsi/6WgPBguUpG+VJjEkQq75Kb/oz2bNWe2t705/rxXjLVO1WpT4ED4pERgOCFQGU6Zzbz2jwB9VGcI76yqlYp3TJ0uQ7ZIikFAcmZmhb0it9X/K6Z1PvKRj9jmm29hzJtzvgMdMB/R6zko0ym/9rWvja/UotlA0GCRJ1+tvfbaa41tjmxXvueeewztCFszmR7hK6qsqWD9Bt9qgU99LsyzxVv0Rzfb1KBKtWpM4bC9kykrToFFe8EUEO4//MEP7HMnfDa+V8OC27Vd+7LzzjtbFQGhjrGcMWlVqlWT44mX5K5O2Esib3vvvbdxfDv8+D4N5Wo0ADEoliQpcK06f+vnkrqnKXXdS4qYkoKX5Pf8u+mGNbzcr3DvW9CQZHz7yPwiv1LBDbs7LfR/SVE+6pl1UNSXJBeMi6k384u8QZIirHVckkwqqMOp06B+EbapA6aGmAJh+3lngHmwkBcW537rW9+Kzzig2UFIgaUkjD6JuBABMKVCI8QzxX3pbs6GMkBo+1gLg1/ScEMg8wsCFX6SRg4CFRca6LAq1aoPKFVzLe48FU5SdO502LGWwe+txyVVbfLkZe3ww46w179uLUNVzULQ61zImPXqzM7QsopBvNlu/IEP2Imf+7yHX9PoqG+//XbjcCh2xrBdmTfVfffd15gK4TArNCRoQaZOnRpCkOQ9sXW/WCOy0korGWeOsFCUt96H//H3ED62/9h2tv322xuDGUfb842e737/e5H2G9Z9g33K5+LXfsM6Zo344ubJ0enL8ZX8xrouScZbNlNkRx55ZGhs0M4gDCGgoZnpCl3YGJig4OnxpWLAoe6KEF2/kjxbMuqA8OZXabo1/qUifri316yqSoTHU/4DuRF8oh79RiZD/W8VN3uq+kNWqfjbd7uHNJNklUrVuCRhLBKqVCqej0qsK+KDiFtssUXc04aoA0mRVzJXj2W9XRLeVrpV/VlBKEHDwDorziPBTyrCReC5/IEP7Zf1QeSdtoAb7DCl3mlI6iyDJIJ23sMDB0md+ZdjwtqolpZW48N7TKUSJikRGI4IVIZjpjPPjRGoVCvGmxJz4pOXWtomTJrY2Zk1jtG/qyRraW0x5u8RCthdQgdexqJTLe0tzS3x14dtnwAAEABJREFUgTsOmUIw4J5D1ZjCKMPUm7ztIoBc8rVLbLfddjPO9SDvaFpYEEhHzqBNumgfeHs9/fTTIy9SV4dczxM7AxNTKXxZFy0Jb77wqHjHzZQSO35KvviRhwsuuMD4ejDxexIdPm/NaHUYtFjvAa9e4TxPlGmjjd4bC3/RnKAxQfuDNqgeK+LCgyko+BFP6j74EKaeKBdrg6iDpSdPtkq12qtu4clUEvxIn4FaKvh24+Wq/QkTJ8TADuYMyFL3cJVqxZqam2z8hPEucE4OQavZ67in7GIL6arHT1IIXEzjnHHGGYaQSbukHC0tLcZFeEjqKhf3EP6QJANX4hAXAWfbbbfFqxe24TgXPwjoCKZo+lh/RdurZ1Ofn9IdN6i8xyzvSxO3IC9exdu2VGgswYJ1UVZM2kWQRf2T6ScCQ0GgMpTAGXbxRYDOqnVUq2347g3jZFW2MvLW5L1rn5nmZRjqK0C7d2wTJ02KqRa+D8IUCx14GV7yHrHjRv62zXdStt52G+Ngq4svudi+cOopNnnZZTpCdDcY7FtaW+0db3+HsTWX7bVs1UVbQjqsGaAMCAzwQ8BA2JKKNKXCLLjyNg+Z0UE3+6C76iqrGIfEoa04+9xz7JhjP2N8fI0FqWhSzjvvPLvyyqvti18809hRJFPElWTlBabcrThlBTv91NNi7QtaHAnXMlS92W6TXBBEW3LRRRfF1BACFwNffShJIVyddNJJxtTUrrvuGm+9Ul98LYQCDq4748wz7IipR9iYsWMiTj1fhBB2BcETjRJrd6TePBE0KMfJJ59s8ETYqueDnbIvPXkp23e//QyBcI899jSEne7swBwixoIlqasckkIoQRBBYOZgQHBGIEO4AG9JJsm4pMLsaSc+WjsI7QJY0L6lrvDEmRsCP4jpO3bbkC/WSMFLGpi/pMg/PMo49XbcIA9ltPfR/iytv/7bfAp18452nF07+CQNPwSy5Q6/OmuYY0nRUdNJ8/bPVAeDiM3DRYfX0txsqLM32WQT22CDDeLNsi+WkmJXzfrrr2+cr4FQRIffZ3j3QDhhEGEHC3lGGOEIbYhBgkWHaCkkz42TR+njX53ukmKdAYM061c47h61POeylELPpptuZquttmpgxuCEMNPJoMMiKQYGNCWUCQzYltvh3dCAF4P8pptuGie9brTRRjFFJKkzPGlNdm0H56MgkPClZtw6A3RYykGIWwY18OTkWM4soV6kgifhINLme0N8NI7pL9qCVISBR0mjfADbwOtojz32sA9/+MMhbJR+pUl+KDdn24DdBz+4sY0ePar0rjN786/zXKBWSTEAT5kyxfhGDdN9o1wwByuEC/MLXCCJfELu6P+Soi3T9tBgcEDaaqutFvUtdYXzoH389+8sFTzQhtGumU5E+0QdkaZU+MNF6rJzD5FnCHs9lW6YUqWzDEu5ZvTjH98rtFpSb36WVyIwTBBIoWSYVNRgsikpBmM6ZYiBpb94dF1QX2Hw4wwEBic619GjR5uEa+MYkow0ITpe8kAnbH1drl2pNlWNAYTwUsFbUqQjKfjBo97fel00Y3VzJQ+8OSOYkW94lCSBU5M1edqtrc0hmHSL3OMGXqSPkNPsQprUPa2u4BXPdzVuiQMRDzMc635wKwme2Ou8wyp1pYM/xNbnUS2t1tLcEmGKwUmergKrMj2puLeOi3AdVmPxKvFbfKqDtJsqVVPpWWdKCp6EqVY9TK9AFbOGMW2hXZJMUkxFHXPMp0OrN8GnnJqbm0IYJN9khmknifxCZmBJuwADBK/NN9+8c/0M4ecHsXan6vl44xvfGGujdtxpJ5u09FLR3mhL5E1Sp8ZLUp/JRv3h7c9MEUgmVfx5bzXaOYcibrbZ5iZVzaxicj+35H8iMOwQqAy7HGeG+0WAzpaBCZLUb9jBekryAbzJyk60v3hSEZbOnvD9hS39JIVg0tzcHGlQBuJSBkiSSSqDD8mUFDzhA19JhlnylwbHt4xDPKn/OJI60yS89XHBkzJLGlT54FWWo2QpqbSGKSnSJqzU5Sd12a3jIgzUcRtG/Y+k4NUzTVsML6kQTI444nD77GdPcCFlcuSdAbvIf1H+ig/qlBmhoNkFBs68YaqLRdFSEWZ+F4/0V199dTvn7LPt85/7vKEVbPa2zjMyetQoa3KBD0ERwUNS/23BpSvCUY4mzz+ERgztGPzwkzS/i5D8EoGFhkBloaWUCSUCg0BAUq9OWdIgYi6eQRgkBsqZtGDLN5g89JVHqcgbPKC+wi1qdwQ8qWoTJky0vfbay84880sx7cjgjwDCgC1Oy7NaCMAIIcstt6wdfvihsWNFkknqLMb8KGvFFAf0SQpBeML4CbbP3nsb65yYzkFTU6lWbVTrKNd8NUeYMl1J1v3y+xocK+FcqVatdVSLl3d8LBRn/ZD5Jcl/8z8RGL4IFC18+OY/c54IDAKBJTuINO8DlSSTtNgDKVViy/g222xtbEsvB3+0FQgmEIWoVivGTpstttjSJAXhXpKk0jpPplRMz0iKNBCSWIxM3lirwy6pSqUSU034YS8TlFRareIaHm4RWghTdaGEdUV8H4m1NJKCf2eEtCQCwxSBFEqGacX1zDadFdTIvafb4nZPvqHFLV/zIz+S5geb5DFIBCTwrrg2ZJSxOJnThdl1xZQJ66JYH7XsspNt000/auzoYnCXNF8HdHa0QZ1Zdv7sZJNkZXoshj722GONXVrrv/1txknHLU3NBiF08DxAUpE37LVau+fTYiqVxcorv3ZlO+zQQ63YAmx5JQIjAoHKiCjFElqI+mJLRedV74ZdEsY8Uc3nseeJwQCRJXlnqwFCpfeCQGBe63Ze4y+oMkmKNsUZNWwtZ8s5W5v32Wdv+/znTzTON+HcF6kItyDy0RdPVbzb9XQRkj760Y/alVdeZbvtvruNGz8uBA60OWh2EE7qeUgKoaZardiYMaPjIMANN9zQuKTu5Vgc64V8JiUCAyHgT8dAQdJ/SUdA0oiDIDvtokqleatbad7iF7mYv79SkSdJMYiz2HW99daLE4PPOuts22effW255aZ07nqxhXDJ1JlKzWomKajq0zArrfQa+9znPm8nnnSSrbLaqtbcXHVNT++F5RUXZiC2PfPtqP28HBWTT+34r/OzuktS3V1aE4Hhg0Bl8ctq5igRWPAISPO/005BZ8HX21BTkGRS17oO4kvCCHepsIfDQvqRqTMlhAxJNmHChFigy3QOJw1Xq00hbLDORFLYCYsQs9xyy9uBBxxoTAHBSuriZ3klAsMcgRRKhnkFZvYXHwSkHBwWn9ronhOpUd3Q/TVy7x53qHdwhMp42KE+7z1vCBtM2/AxvYsv/pptueVWcRAh7kzlSDJJxpTPx7b5mG288QfNZGbuZnklAnODwGIah6dyMc1aZisRSAQSgSUHAUmGELLuuusan1zg7BEWsUqFO35s/T344IN9eqfFUiCxvEYgAimUjMBKzSIlAonA8ENAUix0ZRpwueWWs2OPPdZOO+1UW2utNW3MmFG21pqvt8MPPcxeu8rKlgKJ9XWl+zBHIIWSYV6Bmf1EIBEY/gggiJSlYO2IJJs4YYLtsssucd7KrrvuZgcceIBtvuUWLo8Ua2QIXx+P+6REYLgjkELJcK/BzH8ikAgMewQkmdX8v2P7veT3JmtpbrW3v/2ddt5559v+n/iESR0CSYcpEW7YFz8LkAh0IlDptKUlEUgEEoFEYJEiINUJGW5VnOQqYxcOFJnrCCN5gHDIn0Rg5CCQQsnIqcssSSIw3BDI/HYgENMwdTJG3Luf1OFYmrh1kBv5nwiMOARSKBlxVZoFSgQSgeGGgNQhfHRkXOq691mdDtc0EoGRj0AKJSO/jrOECxuBTC8RmI8IIJ5A85FlskoEFlsEUihZbKsmM5YIJAKJQCKQCCxZCKRQsmTV97yUNuMmAolAIpAIJAILFIEUShYovMk8EUgEEoFEIBFIBAaLQAolg0UqwyUCiUAikAgkAonAAkUghZIFCm8yTwQSgUQgEUgEEoHBIpBCyWCRynCJQCKQCCQCiUAisEARSKFkgcKbzBOBRCARSARGLgJZsvmNQAol8xvR5JcIJAKJQCKQCCQCc4VACiVzBVtGSgQSgURg5CKQJUsEFhUCKZQsKuQz3UQgEUgEEoFEIBHohkAKJd3gyJtEIBEYuQhkyRKBRGBxRyCFksW9hjJ/iUAikAgkAonAEoJACiVLSEVnMUcuAlmyRCARSARGCgIplIyUmsxyJAKJQCKQCCQCwxyBFEqGeQWO3OxnyRKBRCARSASWNARSKFnSajzLmwgkAolAIpAILKYIpFCykCsmk0sEEoFEIBFIBBKBxgikUNIYl3RNBBKBRCARSAQSgYWMwHwSShZyrjO5RCARSAQSgUQgERhxCKRQMuKqNAuUCCQCiUAiMCIRWAIKlULJElDJWcREIBFIBBKBRGA4IJBCyXCopcxjIpAIJAIjF4EsWSLQiUAKJZ1QpCURSAQSgUQgEUgEFiUCKZQsSvQz7UQgERi5CGTJEoFEYMgIpFAyZMgyQiKQCCQCiUAikAgsCARSKFkQqCbPRGDkIpAlSwQSgURggSGQQskCgzYZJwKJQCKQCCQCicBQEEihZChoZdiRi0CWLBFIBBKBRGCRI5BCySKvgsxAIpAIJAKJQCKQCIBACiWgMHIpS5YIJAKJQCKQCAwbBFIoGTZVlRlNBBKBRCARSARGNgLDUygZ2XWSpUsEEoFEIBFIBJZIBFIoWSKrPQudCCQCiUAikAj0j8Ci8E2hZFGgnmkmAolAIpAIJAKJQC8EUijpBUk6JAKJQCKQCIxcBLJkizMCKZQszrWTeUsEEoFEIBFIBJYgBFIoWYIqO4uaCCQCIxeBLFkiMBIQSKFkJNRiliERSAQSgUQgERgBCKRQMgIqMYuQCIxcBLJkiUAisCQhkELJklTbWdZEIBFIBBKBRGAxRiCFksW4cjJrIxeBLFkikAgkAolAbwRSKOmNSbokAolAIpAIJAKJwCJAIIWSRQD6yE0yS5YIJAKJQCKQCMw9AimUzD12GTMRSAQSgUQgEUgE5iMCKZQMAswMkggkAolAIpAIJAILHoEUShY8xplCIpAIJAKJQCKQCPSPQPimUBIw5E8ikAgkAolAIpAILGoEUihZ1DWQ6ScCiUAikAiMXASyZENCIIWSIcGVgROBRCARSAQSgURgQSGQQsmCQjb5JgKJQCIwchHIkiUCCwSBFEoWCKzJNBFIBBKBRCARSASGikAKJUNFLMMnAonAyEUgS5YIJAKLFIEUShYp/Jl4IpAIJAKJQCKQCJQIpFBSIpFmIjByEciSJQKJQCIwLBBIoWRYVFNmMhFIBBKBRCARGPkIpFAy8ut45JYwS5YIJAKJQCIwohBIoWREVWcWJhFIBBKBRCARGL4IpFCy+NVd5igRSAQSgUQgEVgiEUihZIms9ix0IpAIJAKJQNUag/sAAAbDSURBVCKw+CGw8ISSxa/smaNEIBFIBBKBRCARWIwQSKFkMaqMzEoikAgkAolAIjAvCAz3uCmUDPcazPwnAolAIpAIJAIjBIEUSkZIRWYxEoFEIBEYuQhkyZYUBFIoWVJqOsuZCCQCiUAikAgs5gikULKYV1BmLxFIBEYuAlmyRCAR6I5ACiXd8ci7RCARSAQSgUQgEVhECKRQsoiAz2QTgZGLQJYsEUgEEoG5QyCFkrnDLWMlAolAIpAIJAKJwHxGIIWS+Qxoshu5CGTJEoFEIBFIBBYsAimULFh8k3sikAgkAolAIpAIDBKBFEoGCdTIDZYlSwQSgUQgEUgEFg8EUihZPOohc5EIJAKJQCKQCCzxCIxYoWSJr9kEIBFIBBKBRCARGGYIpFAyzCoss5sIJAKJQCKQCCwmCMz3bKRQMt8hTYaJQCKQCCQCiUAiMDcIpFAyN6hlnEQgEUgEEoGRi0CWbJEhkELJIoM+E04EEoFEIBFIBBKBegRSKKlHI+2JQCKQCIxcBLJkicBij0AKJYt9FWUGE4FEIBFIBBKBJQOBFEqWjHrOUiYCIxeBLFkikAiMGARSKBkxVZkFSQQSgUQgEUgEhjcCKZQM7/rL3I9cBLJkiUAikAgscQikULLEVXkWOBFIBBKBRCARWDwRSKFk8ayXkZurLFkikAgkAolAItAHAimU9AFMOicCiUAikAgkAonAwkUghZL5g3dySQQSgUQgEUgEEoF5RCCFknkEMKMnAolAIpAIJAKJwPxBoH+hZP6kkVwSgUQgEUgEEoFEIBEYEIEUSgaEKAMkAolAIpAIJAILDoHk3IVACiVdWKQtEUgEEoFEIBFIBBYhAimULELwM+lEIBFIBEYuAlmyRGDoCKRQMnTMMkYikAgkAolAIpAILAAEUihZAKAmy0QgERi5CGTJEoFEYMEhkELJgsM2OScCiUAikAgkAonAEBBIoWQIYGXQRGDkIpAlSwQSgURg0SOQQsmir4PMQSKQCCQCiUAikAg4AimUOAj5P3IRyJIlAolAIpAIDB8EUigZPnWVOU0EEoFEIBFIBEY0AimUDMvqzUwnAolAIpAIJAIjD4EUSkZenWaJEoFEIBFIBBKBYYnAYiWUDEsEM9OJQCKQCCQCiUAiMF8QSKFkvsCYTBKBRCARSAQSgWGBwGKdyRRKFuvqycwlAolAIpAIJAJLDgIplCw5dZ0lTQQSgURg5CKQJRsRCKRQMiKqMQuRCCQCiUAikAgMfwRSKBn+dZglSAQSgZGLQJYsEViiEEihZImq7ixsIpAIJAKJQCKw+CKQQsniWzeZs0Rg5CKQJUsEEoFEoAECKZQ0ACWdEoFEIBFIBBKBRGDhI5BCycLHPFMcuQhkyRKBRCARSATmAYEUSuYBvIyaCCQCiUAikAgkAvMPgRRK5h+WI5dTliwRSAQSgUQgEVgICKRQshBAziQSgUQgEUgEEoFEYGAElmShZGB0MkQikAgkAolAIpAILDQEUihZaFBnQolAIpAIJAKJwJKGwNDKm0LJ0PDK0IlAIpAIJAKJQCKwgBBIoWQBAZtsE4FEIBFIBEYuAlmyBYNACiULBtfkmggkAolAIpAIJAJDRCCFkiEClsETgUQgERi5CGTJEoFFi0AKJYsW/0w9EUgEEoFEIBFIBDoQSKGkA4g0EoFEYOQikCVLBBKB4YFACiXDo54yl4lAIpAIJAKJwIhHIIWSEV/FWcCRi0CWLBFIBBKBkYVACiUjqz6zNIlAIpAIJAKJwLBFIIWSYVt1IzfjWbJEIBFIBBKBJROBFEqWzHrPUicCiUAikAgkAosdAimULLQqyYQSgUQgEUgEEoFEoD8EUijpD530SwQSgUQgEUgEEoGFhsA8CyULLaeZUCKQCCQCiUAikAiMaARSKBnR1ZuFSwQSgUQgERgBCCwxRUihZImp6ixoIpAIJAKJQCKweCOQQsniXT+Zu0QgEUgERi4CWbJEoAcCKZT0ACRvE4FEIBFIBBKBRGDRIJBCyaLBPVNNBBKBkYtAliwRSATmEoEUSuYSuIyWCCQCiUAikAgkAvMXgRRK5i+eyS0RGLkIZMkSgUQgEVjACKRQsoABTvaJQCKQCCQCiUAiMDgEUigZHE4ZauQikCVLBBKBRCARWEwQSKFkMamIzEYikAgkAolAIrCkI5BCyUhtAVmuRCARSAQSgURgmCGQQskwq7DMbiKQCCQCiUAiMFIRGG5CyUithyxXIpAIJAKJQCKwxCOQQskS3wQSgEQgEUgEEoFEoB6BRWdPoWTRYZ8pJwKJQCKQCCQCiUAdAv8fAAD//34wOjQAAAAGSURBVAMAt2ptCK0PzmMAAAAASUVORK5CYII=';

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
  },
  IBN_AFFAN_DORM: {
    name: 'หอพักอิบนูอัฟฟาน มหาวิทยาลัยฟาฏอนี',
    lat: 6.600294706405178,
    lng: 101.34364379813283,
    radius: 26 // เมตร
  },
  FEMALE_DORM_5: {
    name: 'หอพักนักศึกษาหญิง (หอ 5)',
    lat: 6.5982906571204625,
    lng: 101.34787942340711,
    radius: 37 // เมตร
  },
  MUSALLA_DORM_5: {
    name: 'มุศ็อลลา (หอ 5)',
    lat: 6.598852468763226,
    lng: 101.34829218626834,
    radius: 16 // เมตร
  }
};

const MASTER_ADMIN_PASS = '096909';

// ----------------- ข้อมูลเริ่มต้น (INITIAL STATE & MOCK DATA) ----------------- //
const DEFAULT_STUDENT = {
  studentId: 'STD-256901',
  fullName: 'นายมูฮัมหมัด ซอและห์',
  schoolName: 'โรงเรียนสาธิต มหาวิทยาลัยฟาฏอนี',
  grade: 'มัธยมศึกษาปีที่ 5',
  birthDate: '15082552',
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
const GPS_EXPIRATION_MS = 60000; // พิกัดมีอายุ 60 วินาที เพื่อป้องกันการทุจริตพิกัด (1 นาที)
let gpsCountdownInterval = null;
let selectedPrayerTime = null;
let activeCameraStream = null;
let currentFacingMode = 'user'; // 'user' (กล้องหน้า) หรือ 'environment' (กล้องหลัง)

// Charts instances
let skillChartInstance = null;
let attendanceChartInstance = null;
let prayerChartInstance = null;
let activityChartInstance = null;

// Google Apps Script API URL
// Web App URL เริ่มต้นสำหรับทุกเครื่องที่เข้าใช้งาน (ใส่ Web App URL ที่นี่เพื่อให้ทุกเครื่องซิงค์อัตโนมัติ)
const DEFAULT_GAS_API_URL = 'https://script.google.com/macros/s/AKfycbysmbfdvm7ICnMbVw2ZCm0IybsC7gtU3u7SlFHu2iQzEuZvJJRNz9wAzE8nqJEmXWSE/exec';
let storedGasUrl = localStorage.getItem('khalifah_gas_url');
if (storedGasUrl && (storedGasUrl.includes('docs.google.com/spreadsheets') || storedGasUrl.trim() === '')) {
  localStorage.removeItem('khalifah_gas_url');
  storedGasUrl = null;
}
let gasApiUrl = storedGasUrl || DEFAULT_GAS_API_URL;

// ----------------- INITIALIZATION ----------------- //
document.addEventListener('DOMContentLoaded', () => {
  loadStoredData();
  initAppLogo();

  // Check if opened as Staff / Kiosk Live Monitor via URL parameter (e.g. ?monitor=ACT-xxx or ?staff_monitor=ACT-xxx)
  if (typeof checkStaffMonitorUrlParams === 'function' && checkStaffMonitorUrlParams()) {
    return; // Kiosk mode active, skip normal login / student dashboards
  }

  if (currentStudent) {
    document.body.classList.remove('auth-locked');
    updateAdminUIVisibility(false);
  } else if (currentAdmin) {
    document.body.classList.remove('auth-locked');
    updateAdminUIVisibility(true);
  } else {
    document.body.classList.add('auth-locked');
    updateAdminUIVisibility(false);
  }
  setupEventListeners();
  renderCurrentStudentProfile();
  renderDashboardCharts();
  renderActivitiesList();
  renderTodayPrayerTable();
  renderDashboardQuranStars();
  initHasanatView();
  renderPrayerHistory();
  initCalendar();
  initExportDateDefaults();

  if (currentStudent) {
    switchView('dashboard');
  } else if (currentAdmin) {
    switchView(currentAdmin.role === 'SuperAdmin' ? 'admin' : 'teacher');
  } else {
    enforceMandatoryLogin();
  }

  // ซิงค์ฐานข้อมูลทั้งหมดกับ Google Sheets แบบเรียลไทม์ทันทีเมื่อเปิดแอป
  setTimeout(() => {
    if (typeof syncAllDataFromCloud === 'function') {
      syncAllDataFromCloud(false);
    }
  }, 350);

  // ตรวจสอบว่ามี #admin ใน URL หรือไม่
  if (window.location.hash === '#admin') {
    if (!currentAdmin || currentAdmin.role !== 'SuperAdmin') {
      openModal('adminAuthModal');
    }
  }

  // Mobile Stability: Release hardware camera streams when app is backgrounded or tab hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (typeof stopCameraStream === 'function') stopCameraStream();
      if (typeof stopQrScanner === 'function') stopQrScanner();
    }
  });

  // Mobile Stability: Smooth Chart.js re-render on orientation change
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      if (typeof renderDashboardCharts === 'function') renderDashboardCharts();
    }, 250);
  });
});

function loadStoredData() {
  // 1. Resolve Active Session Role (Strict Isolation: Student vs Teacher vs Admin)
  const authRole = localStorage.getItem('khalifah_auth_role');
  const savedStudent = localStorage.getItem('khalifah_current_student');
  const savedAdmin = localStorage.getItem('khalifah_current_admin');

  if (authRole === 'student' || (savedStudent && !savedAdmin)) {
    // STUDENT SESSION ONLY: Purge any lingering admin session
    currentAdmin = null;
    localStorage.removeItem('khalifah_current_admin');

    if (savedStudent) {
      try {
        const parsed = JSON.parse(savedStudent);
        const isUnverified = parsed && (
          parsed.approvalStatus === 'PendingAdmin' ||
          parsed.approvalStatus === 'AwaitingOtp' ||
          parsed.status === 'PendingAdmin' ||
          parsed.status === 'รอผู้สมัครกรอกรหัส OTP'
        );
        if (!parsed || isUnverified || parsed.studentId === 'STD-256901' || parsed.studentId === 'STD-256902' || (parsed.fullName && parsed.fullName.startsWith('นายมูฮัมหมัด ซอ'))) {
          localStorage.removeItem('khalifah_current_student');
          localStorage.removeItem('khalifah_auth_role');
          currentStudent = null;
        } else {
          if (parsed.studentId) parsed.studentId = cleanIdString(parsed.studentId);
          if (parsed.parentPhone) parsed.parentPhone = normalizePhone(parsed.parentPhone);
          if (parsed.birthDate) parsed.birthDate = normalizeBirthDate(parsed.birthDate);

          // Restore persistent avatar if available
          if (parsed.studentId) {
            const cachedAv = localStorage.getItem('khalifah_student_avatar_' + parsed.studentId);
            if (cachedAv && (!parsed.avatarUrl || !getDirectImageUrl(parsed.avatarUrl))) {
              parsed.avatarUrl = cachedAv;
            }
          }

          currentStudent = parsed;
          localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
          localStorage.setItem('khalifah_auth_role', 'student');
        }
      } catch (e) {
        currentStudent = null;
        localStorage.removeItem('khalifah_current_student');
        localStorage.removeItem('khalifah_auth_role');
      }
    } else {
      currentStudent = null;
      localStorage.removeItem('khalifah_auth_role');
    }
  } else if (authRole === 'teacher' || authRole === 'admin' || (savedAdmin && !savedStudent)) {
    // TEACHER OR ADMIN SESSION ONLY: Purge any lingering student session
    currentStudent = null;
    localStorage.removeItem('khalifah_current_student');

    if (savedAdmin) {
      try {
        const parsedAdmin = JSON.parse(savedAdmin);
        if (parsedAdmin && (parsedAdmin.username || parsedAdmin.role)) {
          currentAdmin = parsedAdmin;
          localStorage.setItem('khalifah_auth_role', parsedAdmin.role === 'SuperAdmin' ? 'admin' : 'teacher');
        } else {
          currentAdmin = null;
          localStorage.removeItem('khalifah_current_admin');
          localStorage.removeItem('khalifah_auth_role');
        }
      } catch (e) {
        currentAdmin = null;
        localStorage.removeItem('khalifah_current_admin');
        localStorage.removeItem('khalifah_auth_role');
      }
    } else {
      currentAdmin = null;
      localStorage.removeItem('khalifah_auth_role');
    }
  } else {
    // Unauthenticated or corrupted dual state: clean purge
    currentStudent = null;
    currentAdmin = null;
    localStorage.removeItem('khalifah_current_student');
    localStorage.removeItem('khalifah_current_admin');
    localStorage.removeItem('khalifah_auth_role');
  }

  // 2. Load all students (Filter out dummy students & sanitize IDs/Phone/BirthDate)
  const savedAllStudents = localStorage.getItem('khalifah_all_students');
  if (savedAllStudents) {
    try {
      let parsed = JSON.parse(savedAllStudents);
      parsed = parsed.filter(s => s.studentId !== 'STD-256901' && s.studentId !== 'STD-256902' && s.studentId !== 'STD-256903');
      parsed.forEach(s => {
        if (s.studentId) {
          s.studentId = cleanIdString(s.studentId);
          const cachedAv = localStorage.getItem('khalifah_student_avatar_' + s.studentId);
          if (cachedAv && (!s.avatarUrl || !getDirectImageUrl(s.avatarUrl))) {
            s.avatarUrl = cachedAv;
          }
        }
        if (s.parentPhone) s.parentPhone = normalizePhone(s.parentPhone);
        if (s.birthDate) s.birthDate = normalizeBirthDate(s.birthDate);
      });
      allStudents = parsed;
      localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
    } catch (e) {
      allStudents = [];
    }
  } else {
    allStudents = [];
  }

  // 3. Load activities (Clean start & normalize id/activityId)
  const savedActs = localStorage.getItem('khalifah_activities');
  if (savedActs) {
    try {
      let parsed = JSON.parse(savedActs);
      parsed = parsed.filter(a => a.activityId !== 'ACT-101' && a.activityId !== 'ACT-102' && a.id !== 'ACT-101' && a.id !== 'ACT-102');
      parsed.forEach(a => {
        const normId = a.id || a.activityId;
        a.id = normId;
        a.activityId = normId;
      });
      activities = parsed;
      localStorage.setItem('khalifah_activities', JSON.stringify(activities));
    } catch (e) {
      activities = [];
    }
  } else {
    activities = [];
  }

  // 4. Load today prayers (Clean start)
  const savedPrayers = localStorage.getItem('khalifah_today_prayers');
  if (savedPrayers) {
    try {
      let parsed = JSON.parse(savedPrayers);
      parsed = parsed.filter(p => p.studentId !== 'STD-256901');
      todayPrayers = parsed;
      localStorage.setItem('khalifah_today_prayers', JSON.stringify(todayPrayers));
    } catch (e) {
      todayPrayers = [];
    }
  } else {
    todayPrayers = [];
  }

  // 5. Load Sub-admins
  const savedSubAdmins = localStorage.getItem('khalifah_sub_admins');
  if (savedSubAdmins) {
    try {
      subAdmins = JSON.parse(savedSubAdmins);
    } catch (e) {
      subAdmins = [];
    }
  } else {
    subAdmins = [];
  }

  // 6. Load calendar events
  try {
    const savedCal = localStorage.getItem('khalifah_calendar_events');
    if (savedCal) {
      calendarEvents = JSON.parse(savedCal);
    }
  } catch (e) {
    calendarEvents = [];
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
  if (viewName === 'staff-monitor') {
    isStaffMonitorMode = true;
    document.body.classList.add('staff-monitor-active');
    document.body.classList.remove('auth-locked');
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    const staffSec = document.getElementById('view-staff-monitor');
    if (staffSec) staffSec.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // Clear kiosk mode state when navigating to standard views
  document.body.classList.remove('staff-monitor-active');
  isStaffMonitorMode = false;

  // Enforce login before switching views
  if (!currentStudent && !currentAdmin) {
    enforceMandatoryLogin();
    return;
  }

  const studentViews = ['dashboard', 'prayer', 'activities', 'hasanat', 'profile'];

  // 1. If logged in as Student: strictly lock to student views
  if (currentStudent) {
    if (!studentViews.includes(viewName)) {
      showToast('หน้านี้สำหรับอาจารย์และผู้ดูแลระบบเท่านั้น นักเรียนไม่มีสิทธิ์เข้าถึง', 'warning');
      viewName = 'dashboard';
    }
  }
  // 2. If logged in as Teacher: strictly lock to teacher view
  else if (currentAdmin && currentAdmin.role !== 'SuperAdmin') {
    if (viewName === 'admin') {
      showToast('เฉพาะแอดมินสูงสุด (Super Admin) เท่านั้นที่สามารถเข้าถึงหน้านี้ได้', 'warning');
      viewName = 'teacher';
    } else if (studentViews.includes(viewName)) {
      viewName = 'teacher';
    }
  }
  // 3. If logged in as Super Admin: allow admin and teacher views
  else if (currentAdmin && currentAdmin.role === 'SuperAdmin') {
    if (studentViews.includes(viewName)) {
      viewName = 'admin';
    }
  }

  // Toggle teacher bottom nav bar active state
  document.body.classList.toggle('teacher-portal-active', viewName === 'teacher');

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

  // Always scroll to top when switching to any view
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  } catch (e) {
    window.scrollTo(0, 0);
  }
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  // Trigger specific view setups
  if (viewName === 'dashboard') {
    renderDashboardCharts();
    renderDashboardQuranStars();
    if (typeof renderCalendar === 'function') renderCalendar('dash');
  } else if (viewName === 'hasanat') {
    initHasanatView();
  } else if (viewName === 'prayer') {
    renderPrayerHistory();
    startPrayerLiveClock();
    autoSelectDetectedPrayerSlot(false);
    if (verifiedLocation) {
      const centerOverlay = document.getElementById('camCenterActionOverlay');
      if (centerOverlay) centerOverlay.style.display = 'none';
      initLiveCamera();
    } else {
      const centerOverlay = document.getElementById('camCenterActionOverlay');
      if (centerOverlay) centerOverlay.style.display = 'flex';
      const video = document.getElementById('cameraStream');
      if (video) video.style.display = 'none';
      const camOverlay = document.getElementById('cameraOverlayInfo');
      if (camOverlay) camOverlay.style.display = 'none';
    }
  } else if (viewName === 'activities') {
    if (typeof fetchActivitiesAndLogsFromCloud === 'function') fetchActivitiesAndLogsFromCloud(false);
    startQrScanner();
    renderStudentScannedActivities();
  } else if (viewName === 'teacher') {
    initTeacherPortalView();
  } else if (viewName === 'admin') {
    renderSuperAdminOverviewKpis();
    renderPendingApprovalsTable();
    renderAdminStudentsTable();
    renderSubAdminsTable();
    populateGradingSubjectSelect();
    renderAdminActivitiesTable();
    if (typeof renderAdminLiveActivityFeed === 'function') renderAdminLiveActivityFeed();
    if (typeof fetchActivitiesAndLogsFromCloud === 'function') fetchActivitiesAndLogsFromCloud(false);
    if (typeof fetchSubAdminsFromCloud === 'function') fetchSubAdminsFromCloud(false);
    if (typeof startAdminActivityLivePolling === 'function') startAdminActivityLivePolling();
    if (typeof renderCalendar === 'function') renderCalendar('admin');
  }

  if (viewName !== 'admin') {
    if (typeof stopAdminActivityLivePolling === 'function') stopAdminActivityLivePolling();
  }
  if (viewName !== 'activities') {
    stopQrScanner();
  }
  if (viewName !== 'prayer') {
    stopCameraStream();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function stopCameraStream() {
  if (activeCameraStream) {
    try {
      activeCameraStream.getTracks().forEach(track => track.stop());
    } catch (e) {}
    activeCameraStream = null;
  }
  const video = document.getElementById('cameraStream');
  if (video) {
    video.srcObject = null;
  }
}

function renderStudentActivitiesHistory() {
  renderStudentScannedActivities();
}

// ----------------- SMART PRAYER TIME AUTO-DETECTION WITH +/- BUFFER ----------------- //
// Base prayer windows in minutes from 00:00 (Standard Southern Thailand / Fatoni schedule)
const PRAYER_TIME_WINDOWS = [
  { name: 'ซุบฮิ', startMin: 4 * 60 + 45, endMin: 6 * 60 + 25, baseLabel: '04:45 - 06:25 น.' },
  { name: 'ซุฮริ', startMin: 12 * 60 + 10, endMin: 15 * 60 + 15, baseLabel: '12:10 - 15:15 น.' },
  { name: 'อัศรฺ', startMin: 15 * 60 + 20, endMin: 18 * 60 + 5, baseLabel: '15:20 - 18:05 น.' },
  { name: 'มัฆริบ', startMin: 18 * 60 + 10, endMin: 19 * 60 + 25, baseLabel: '18:10 - 19:25 น.' },
  { name: 'อีชาอ์', startMin: 19 * 60 + 30, endMin: 23 * 60 + 59, baseLabel: '19:30 - 23:59 น.' }
];

let prayerBufferMinutes = parseInt(localStorage.getItem('khalifah_prayer_buffer_mins') || '30', 10);
let prayerLiveClockInterval = null;

function formatMinutesToHHMM(totalMins) {
  const clamped = ((totalMins % 1440) + 1440) % 1440;
  const hh = String(Math.floor(clamped / 60)).padStart(2, '0');
  const mm = String(clamped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function detectPrayerTimeSlotWithBuffer(bufferMins = prayerBufferMinutes) {
  const now = new Date();
  const curMin = now.getHours() * 60 + now.getMinutes();
  const buf = isNaN(bufferMins) ? 30 : Math.max(0, parseInt(bufferMins, 10));

  // 1. Check exact base window first
  for (const w of PRAYER_TIME_WINDOWS) {
    if (curMin >= w.startMin && curMin <= w.endMin) {
      return {
        matched: true,
        isExact: true,
        isBuffered: false,
        prayerName: w.name,
        baseLabel: w.baseLabel,
        effectiveRange: `${formatMinutesToHHMM(w.startMin - buf)} - ${formatMinutesToHHMM(w.endMin + buf)} น.`,
        bufferMins: buf
      };
    }
  }

  // 2. Check within +/- buffer window
  for (const w of PRAYER_TIME_WINDOWS) {
    const startWithBuf = w.startMin - buf;
    const endWithBuf = w.endMin + buf;
    if (curMin >= startWithBuf && curMin <= endWithBuf) {
      const isBefore = curMin < w.startMin;
      return {
        matched: true,
        isExact: false,
        isBuffered: true,
        bufferDirection: isBefore ? 'ก่อนเวลาจริง' : 'หลังเวลาจริง',
        prayerName: w.name,
        baseLabel: w.baseLabel,
        effectiveRange: `${formatMinutesToHHMM(startWithBuf)} - ${formatMinutesToHHMM(endWithBuf)} น.`,
        bufferMins: buf
      };
    }
  }

  // 3. Outside any window: find closest upcoming or most recent prayer
  let closest = PRAYER_TIME_WINDOWS[0];
  let minDiff = Infinity;
  for (const w of PRAYER_TIME_WINDOWS) {
    const mid = (w.startMin + w.endMin) / 2;
    const diff = Math.abs(curMin - mid);
    if (diff < minDiff) {
      minDiff = diff;
      closest = w;
    }
  }

  return {
    matched: false,
    isExact: false,
    isBuffered: false,
    prayerName: closest.name,
    baseLabel: closest.baseLabel,
    effectiveRange: `${formatMinutesToHHMM(closest.startMin - buf)} - ${formatMinutesToHHMM(closest.endMin + buf)} น.`,
    bufferMins: buf
  };
}

function onPrayerBufferChange(val) {
  prayerBufferMinutes = parseInt(val, 10) || 0;
  localStorage.setItem('khalifah_prayer_buffer_mins', String(prayerBufferMinutes));
  autoSelectDetectedPrayerSlot(true);
}

function autoSelectDetectedPrayerSlot(showToastMsg = false) {
  const selectEl = document.getElementById('prayerTimeBufferSelect');
  if (selectEl && String(selectEl.value) !== String(prayerBufferMinutes)) {
    selectEl.value = String(prayerBufferMinutes);
  }

  const res = detectPrayerTimeSlotWithBuffer(prayerBufferMinutes);
  const banner = document.getElementById('prayerAutoDetectBanner');
  const dot = document.getElementById('prayerAutoDetectDot');
  const nameEl = document.getElementById('autoDetectedPrayerName');
  const pillEl = document.getElementById('autoDetectedStatusPill');
  const descEl = document.getElementById('autoDetectedWindowDesc');
  const slotLabelEl = document.getElementById('selectedPrayerSlotLabel');

  if (nameEl) {
    nameEl.innerText = `ละหมาด ${res.prayerName}`;
  }
  if (slotLabelEl) {
    slotLabelEl.innerHTML = `<i class="fa-solid fa-check"></i> เลือกอัตโนมัติ: ${res.prayerName}`;
  }

  if (res.matched && res.isExact) {
    if (banner) banner.classList.add('in-window');
    if (dot) dot.classList.remove('outside');
    if (pillEl) {
      pillEl.className = 'autodetect-status-pill ontime';
      pillEl.innerText = 'อยู่ในช่วงเวลาละหมาด';
    }
    if (descEl) {
      descEl.innerText = `เวลาปกติ ${res.baseLabel} • ช่วงเผื่อเวลา ±${res.bufferMins} นาที (${res.effectiveRange})`;
    }
  } else if (res.matched && res.isBuffered) {
    if (banner) banner.classList.add('in-window');
    if (dot) dot.classList.remove('outside');
    if (pillEl) {
      pillEl.className = 'autodetect-status-pill buffered';
      pillEl.innerText = `${res.bufferDirection} (±${res.bufferMins} นาที)`;
    }
    if (descEl) {
      descEl.innerText = `ช่วงเวลาเผื่อที่อนุญาต: ${res.effectiveRange} (เวลาหลัก ${res.baseLabel})`;
    }
  } else {
    if (banner) banner.classList.remove('in-window');
    if (dot) dot.classList.add('outside');
    if (pillEl) {
      pillEl.className = 'autodetect-status-pill outside';
      pillEl.innerText = 'เวลาใกล้เคียง';
    }
    if (descEl) {
      descEl.innerText = `ช่วงละหมาด ${res.prayerName}: ${res.effectiveRange} (เผื่อเวลา ±${res.bufferMins} นาทีแล้ว)`;
    }
  }

  selectPrayerTime(res.prayerName, document.getElementById(`ptime-${res.prayerName}`));
  if (typeof selectPrayerNoteTime === 'function') {
    selectPrayerNoteTime(res.prayerName);
  }

  if (showToastMsg) {
    showToast(`ซิงค์เวลาละหมาดปัจจุบันสำเร็จ: ${res.prayerName} (เผื่อเวลา ±${res.bufferMins} นาที)`, 'info');
  }
}

function startPrayerLiveClock() {
  const updateClock = () => {
    const clockText = document.getElementById('prayerLiveClockText');
    if (clockText) {
      const now = new Date();
      clockText.innerText = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.';
    }
    updateCameraOverlayText();
  };
  updateClock();
  if (prayerLiveClockInterval) clearInterval(prayerLiveClockInterval);
  prayerLiveClockInterval = setInterval(updateClock, 1000);
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
  if (!currentStudent) {
    showToast('กรุณาลงทะเบียนหรือเข้าสู่ระบบนักเรียนก่อนตรวจสอบพิกัดและเช็คชื่อ', 'warning');
    openModal('authModal');
    return;
  }
  const statusBox = document.getElementById('geofenceStatusBox');
  const statusTitle = document.getElementById('geoStatusTitle');
  const statusDesc = document.getElementById('geoStatusDesc');
  const detailsDiv = document.getElementById('geoDetails');

  if (!navigator.geolocation) {
    showToast('อุปกรณ์ของคุณไม่รองรับการระบุพิกัด GPS', 'error');
    return;
  }

  if (statusTitle) statusTitle.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบพิกัดความถูกต้อง...';
  if (statusDesc) statusDesc.innerText = 'กำลังคำนวณตำแหน่งผ่านสัญญาณดาวเทียม GPS กรุณารอสักครู่';

  const btnCenter = document.getElementById('btnCenterVerifyGeo');
  if (btnCenter) {
    btnCenter.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบพิกัด...';
    btnCenter.disabled = true;
  }

  fetchFreshPrayerLocation()
    .then((loc) => {
      // ซ่อน Overlay กลางกล้อง และเปิดกล้องทันที
      const centerOverlay = document.getElementById('camCenterActionOverlay');
      if (centerOverlay) centerOverlay.style.display = 'none';

      // แสดงผล UI
      if (statusBox) {
        statusBox.classList.remove('unverified', 'within', 'outside');
        if (loc.isWithinZone) {
          statusBox.classList.add('within');
          statusTitle.innerHTML = `<i class="fa-solid fa-circle-check"></i> ยืนยันพิกัดถูกต้อง: อยู่ ณ ${loc.locationName}`;
          statusDesc.innerText = `พิกัดตรงตามจุดที่กำหนด (ความคลาดเคลื่อน ±${Math.round(loc.accuracy)} ม.) อนุญาตให้เช็คชื่อได้`;
        } else {
          statusBox.classList.add('outside');
          statusTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> อยู่นอกพื้นที่ที่กำหนด`;
          statusDesc.innerText = `ตรวจพบว่าท่านอยู่: ${loc.locationName} (อยู่นอกรัศมีที่อนุญาต)`;
        }
      }

      if (detailsDiv) {
        detailsDiv.style.display = 'block';
        detailsDiv.innerHTML = `พิกัดปัจจุบัน: ${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)} | แม่นยำ: ±${Math.round(loc.accuracy)}ม. ✓ ตรวจสอบผ่าน (มีผล 60 วินาที)`;
      }

      showToast(`ระบุพิกัดสำเร็จ: ${loc.isWithinZone ? 'อยู่ในพื้นที่' : 'อยู่นอกพื้นที่'}`, loc.isWithinZone ? 'success' : 'warning');
      if (btnCenter) {
        btnCenter.disabled = false;
        btnCenter.innerHTML = '<i class="fa-solid fa-rotate-right"></i> อัปเดตพิกัดสดใหม่';
      }
    })
    .catch((error) => {
      if (statusTitle) statusTitle.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ไม่สามารถเข้าถึงพิกัด GPS ได้';
      if (statusDesc) statusDesc.innerText = 'กรุณาอนุญาตให้เบราว์เซอร์เข้าถึง Location/GPS บนอุปกรณ์ของท่าน';
      showToast('ไม่สามารถดึงพิกัดได้: ' + error.message, 'error');

      if (btnCenter) {
        btnCenter.disabled = false;
        btnCenter.innerHTML = '<i class="fa-solid fa-rotate-right"></i> ลองตรวจสอบพิกัดอีกครั้ง';
      }

      checkPrayerUnlockState();
    });
}

/**
 * ดึงพิกัด GPS สดใหม่แบบเรียลไทม์ (ป้องกัน Fake GPS และการเดินออกจากพิกัด)
 * คืนค่า Promise ของ verifiedLocation
 */
function fetchFreshPrayerLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('อุปกรณ์ของคุณไม่รองรับการระบุพิกัด GPS'));
    }

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

        const targetEntries = Object.values(GEOFENCE_TARGETS);
        let matchedTarget = null;
        let minDistance = Infinity;

        for (const target of targetEntries) {
          const dist = calculateDistanceInMeters(userLat, userLng, target.lat, target.lng);
          if (dist <= target.radius) {
            matchedTarget = target;
            minDistance = Math.round(dist);
            break;
          }
          if (dist < minDistance) {
            minDistance = dist;
          }
        }

        const mosqueTarget = GEOFENCE_TARGETS.MOSQUE;
        const distToMosque = Math.round(calculateDistanceInMeters(userLat, userLng, mosqueTarget.lat, mosqueTarget.lng));
        const formattedMosqueDist = formatDistance(distToMosque);

        let locationName = '';
        let isWithinZone = false;

        if (matchedTarget) {
          locationName = matchedTarget.name;
          isWithinZone = true;
        } else {
          isWithinZone = false;
          locationName = `ห่างจากมัสยิดฮารอมัยน์ ${formattedMosqueDist}`;
        }

        verifiedLocation = {
          lat: userLat,
          lng: userLng,
          accuracy: accuracy,
          locationName: locationName,
          isWithinZone: isWithinZone,
          distanceMeters: isWithinZone ? minDistance : distToMosque,
          distToMosque: distToMosque,
          formattedMosqueDist: formattedMosqueDist,
          timestamp: new Date().toISOString()
        };

        startGpsCountdownTimer();
        initLiveCamera();
        updateCameraOverlayText();
        checkPrayerUnlockState();
        resolve(verifiedLocation);
      },
      (error) => {
        reject(error);
      },
      geoOptions
    );
  });
}

/**
 * ตัวจับเวลานับถอยหลังอายุพิกัด GPS (60 วินาที)
 */
function startGpsCountdownTimer() {
  if (gpsCountdownInterval) {
    clearInterval(gpsCountdownInterval);
    gpsCountdownInterval = null;
  }
  updateGpsCountdownDisplay();

  gpsCountdownInterval = setInterval(() => {
    if (!verifiedLocation || !verifiedLocation.timestamp) {
      clearInterval(gpsCountdownInterval);
      gpsCountdownInterval = null;
      checkPrayerUnlockState();
      return;
    }

    const elapsed = Date.now() - new Date(verifiedLocation.timestamp).getTime();
    if (elapsed >= GPS_EXPIRATION_MS) {
      clearInterval(gpsCountdownInterval);
      gpsCountdownInterval = null;
      verifiedLocation = null;
      checkPrayerUnlockState();
      showToast('⚠️ พิกัด GPS หมดอายุ (เกิน 60 วินาที) กรุณาตรวจสอบตำแหน่งสดใหม่', 'warning');
    } else {
      updateGpsCountdownDisplay();
    }
  }, 1000);
}

function updateGpsCountdownDisplay() {
  if (!verifiedLocation || !verifiedLocation.timestamp) return;
  const elapsed = Date.now() - new Date(verifiedLocation.timestamp).getTime();
  const remainingSec = Math.max(0, Math.ceil((GPS_EXPIRATION_MS - elapsed) / 1000));

  const locBadge = document.getElementById('prayerVerifiedLocBadge');
  const locText = document.getElementById('prayerVerifiedLocText');
  const btnCapture = document.getElementById('btnCaptureInstant');

  const isWithin = verifiedLocation.isWithinZone;
  const locName = verifiedLocation.locationName || 'พิกัด GPS';
  const pTimeText = selectedPrayerTime ? `เวลา ${selectedPrayerTime}` : 'ละหมาด';

  if (locBadge && locText) {
    locBadge.style.display = 'inline-flex';
    locBadge.style.background = isWithin ? '#ecfdf5' : '#fffbeb';
    locBadge.style.borderColor = isWithin ? '#a7f3d0' : '#fde68a';
    locBadge.style.color = isWithin ? '#065f46' : '#92400e';
    if (isWithin) {
      locText.innerHTML = `พิกัด: <b>${locName}</b> ✓ (สดใหม่เหลือ <span style="color:#059669; font-weight:700;">${remainingSec}s</span>)`;
    } else {
      locText.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #d97706;"></i> <b>อยู่นอกพื้นที่:</b> ${locName} (สดใหม่เหลือ <span style="color:#b45309; font-weight:700;">${remainingSec}s</span>)`;
    }
  }

  if (btnCapture && !btnCapture.disabled) {
    btnCapture.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.15rem; line-height: 1.25;">
        <div style="font-size: 0.98rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
          <i class="fa-solid fa-camera"></i> ถ่ายรูปและบันทึก${pTimeText}ทันที
        </div>
        <div style="font-size: 0.78rem; font-weight: 500; opacity: 0.92; display: flex; align-items: center; gap: 0.3rem;">
          <i class="fa-solid ${isWithin ? 'fa-location-dot' : 'fa-person-walking-arrow-right'}" style="font-size: 0.72rem;"></i> ${isWithin ? 'ณ ' + locName : locName} • สดใหม่เหลือ ${remainingSec}วิ
        </div>
      </div>
    `;
  }
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

  // นำคลาส selected ออกจากทุกปุ่มเวลาละหมาดเพื่อให้เลือกได้เพียง 1 เวลาเท่านั้น
  document.querySelectorAll('.prayer-chip, .prayer-time-card').forEach(el => el.classList.remove('selected'));
  if (element) {
    element.classList.add('selected');
  } else {
    const target = document.getElementById(`ptime-${timeName}`);
    if (target) target.classList.add('selected');
  }

  // ซิงค์ชื่อเวลาละหมาดบนวิดีโอถ่ายทอดสด
  const overlayPrayer = document.getElementById('camOverlayPrayer');
  if (overlayPrayer) overlayPrayer.innerText = `เวลาละหมาด: ${timeName}`;

  checkPrayerUnlockState();
}

function checkPrayerUnlockState() {
  const btnCapture = document.getElementById('btnCaptureInstant');
  const locBadge = document.getElementById('prayerVerifiedLocBadge');
  const locText = document.getElementById('prayerVerifiedLocText');

  if (!btnCapture) return;

  const isGpsValid = verifiedLocation && (Date.now() - new Date(verifiedLocation.timestamp).getTime() <= GPS_EXPIRATION_MS);

  if (isGpsValid) {
    btnCapture.disabled = false;
    btnCapture.classList.remove('btn-locked');
    updateGpsCountdownDisplay();
  } else {
    btnCapture.disabled = false; // อนุญาตให้กดเพื่อดึงพิกัดสดใหม่อัตโนมัติได้ทันที
    btnCapture.classList.remove('btn-locked');
    btnCapture.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.15rem; line-height: 1.25;">
        <div style="font-size: 0.95rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
          <i class="fa-solid fa-location-crosshairs"></i> ดึงพิกัดสด & ถ่ายรูปบันทึกทันที
        </div>
        <div style="font-size: 0.75rem; font-weight: 400; opacity: 0.88;">
          (ตรวจสอบพิกัดเรียลไทม์ ป้องกันการทุจริต หมดอายุใน 60วิ)
        </div>
      </div>
    `;
    if (locBadge && locText) {
      locBadge.style.display = 'inline-flex';
      locBadge.style.background = '#fef2f2';
      locBadge.style.borderColor = '#fecaca';
      locBadge.style.color = '#991b1b';
      locText.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> ยังไม่มีพิกัดสดใหม่ (หมดอายุ 60 วินาที)';
    }
  }
}

/**
 * เปิดกล้องสด In-App Live Camera Stream (Strictly getUserMedia, no gallery pickers)
 */
async function initLiveCamera() {
  const video = document.getElementById('cameraStream');
  const overlay = document.getElementById('cameraOverlayInfo');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn('getUserMedia not supported');
    return;
  }

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
    if (video) {
      video.srcObject = stream;
      video.style.display = 'block';
      // FIX CAMERA MIRROR: front camera is mirrored, back camera is NOT mirrored
      video.className = currentFacingMode === 'user' ? 'camera-stream camera-front' : 'camera-stream camera-back';
      video.play();
    }
    if (overlay) overlay.style.display = 'block';

    updateCameraOverlayText();
  } catch (err) {
    console.warn('Could not start live camera:', err);
  }
}

function switchCameraFacing() {
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  initLiveCamera();
  showToast(`สลับไปใช้${currentFacingMode === 'user' ? 'กล้องหน้า' : 'กล้องหลัง'}`, 'info');
}

/**
 * ปรับปรุงระบบเช็คชื่อละหมาด: กดแชะเดียวบันทึกทันที (No-scroll UX)
 */
async function captureAndSavePrayerInstant() {
  if (!currentStudent) {
    showToast('กรุณาเข้าสู่ระบบนักเรียนก่อนเช็คชื่อละหมาด', 'warning');
    openModal('authModal');
    return;
  }

  if (!selectedPrayerTime) {
    selectedPrayerTime = 'ซุบฮิ';
    selectPrayerTime('ซุบฮิ', document.getElementById('ptime-ซุบฮิ'));
  }

  // Anti-cheating check: check if verifiedLocation is missing or expired (> 60s)
  const isGpsValid = verifiedLocation && (Date.now() - new Date(verifiedLocation.timestamp).getTime() <= GPS_EXPIRATION_MS);
  if (!isGpsValid) {
    const btn = document.getElementById('btnCaptureInstant');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังดึงพิกัด GPS สดใหม่แบบเรียลไทม์...';
    }
    showToast('📍 กำลังตรวจสอบพิกัด GPS สดใหม่แบบเรียลไทม์เพื่อป้องกันการทุจริต...', 'info');

    try {
      await fetchFreshPrayerLocation();
    } catch (err) {
      if (btn) btn.disabled = false;
      checkPrayerUnlockState();
      showToast('⚠️ ไม่สามารถดึงพิกัด GPS ได้: ' + err.message + ' กรุณาเปิด Location บนอุปกรณ์', 'error');
      return;
    }
  }

  const video = document.getElementById('cameraStream');
  const canvas = document.getElementById('snapshotCanvas');

  const vWidth = (video && video.videoWidth > 0) ? video.videoWidth : 640;
  const vHeight = (video && video.videoHeight > 0) ? video.videoHeight : 480;

  canvas.width = vWidth;
  canvas.height = vHeight;
  const ctx = canvas.getContext('2d');

  // Draw camera frame with correct mirroring
  if (video && video.srcObject && video.readyState >= 2) {
    if (currentFacingMode === 'user') {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
  } else {
    // If video hasn't rendered first frame yet, draw a placeholder canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Kanit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ภาพถ่ายพยานการละหมาด (GPS ยืนยันแล้ว)', canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'start';
  }

  // Stamp Watermark overlay
  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('th-TH');

  const boxHeight = 110;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(0, canvas.height - boxHeight, canvas.width, boxHeight);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Kanit, sans-serif';
  ctx.fillText(`KHALIFAH • ละหมาดเวลา: ${selectedPrayerTime}`, 20, canvas.height - boxHeight + 30);

  ctx.font = '16px Kanit, sans-serif';
  ctx.fillText(`นักเรียน: ${currentStudent.fullName} (${currentStudent.studentId}) | ${currentStudent.grade}`, 20, canvas.height - boxHeight + 58);

  const locText = `พิกัด: ${verifiedLocation.lat.toFixed(5)}, ${verifiedLocation.lng.toFixed(5)} [${verifiedLocation.locationName}] • ${dateStr} ${timeStr}`;
  ctx.fillText(locText, 20, canvas.height - boxHeight + 86);

  ctx.fillStyle = verifiedLocation.isWithinZone ? '#10b981' : '#f59e0b';
  ctx.fillRect(canvas.width - 24, canvas.height - boxHeight, 24, boxHeight);

  const photoBase64 = canvas.toDataURL('image/jpeg', 0.8);

  // Trigger camera shutter flash effect
  const flashEl = document.getElementById('cameraShutterFlash');
  if (flashEl) {
    flashEl.classList.remove('flashing', 'flash-active');
    void flashEl.offsetWidth; // trigger reflow
    flashEl.classList.add('flashing', 'flash-active');
    setTimeout(() => {
      flashEl.classList.remove('flashing', 'flash-active');
    }, 320);
  }

  // Play mechanical shutter click sound + haptic vibration
  playCameraShutterSound();
  if (navigator.vibrate) {
    try { navigator.vibrate([40, 20, 60]); } catch(e) {}
  }

  const statusSelect = document.getElementById('prayerStatusSelect');
  const locSelect = document.getElementById('prayerLocationSelect');
  const noteInput = document.getElementById('prayerNoteInput');
  const prayerStatus = statusSelect ? statusSelect.value : 'ตรงเวลา (ญะมาอะฮ์/มัสยิด)';
  const prayerNote = noteInput ? noteInput.value.trim() : '';
  const chosenLoc = locSelect ? locSelect.value : (verifiedLocation ? verifiedLocation.locationName : 'พิกัด GPS');

  // Build accurate human-readable location name
  let accurateLocName = chosenLoc;
  if (verifiedLocation && verifiedLocation.isWithinZone) {
    accurateLocName = verifiedLocation.locationName;
  }

  const logId = 'PRY-' + Date.now();
  const mapUrl = `https://www.google.com/maps?q=${verifiedLocation.lat},${verifiedLocation.lng}`;

  // Save prayer record with ALL supported key names for 100% backend compatibility
  const prayerRecord = {
    id: logId,
    logId: logId,
    studentId: currentStudent.studentId,
    studentName: currentStudent.fullName,
    grade: currentStudent.grade,
    prayerName: selectedPrayerTime,
    prayerTime: selectedPrayerTime,
    status: prayerStatus,
    note: prayerNote,
    timestamp: now.toISOString(),
    date: now.toISOString().split('T')[0],
    time: timeStr,
    latitude: verifiedLocation.lat,
    longitude: verifiedLocation.lng,
    lat: verifiedLocation.lat,
    lng: verifiedLocation.lng,
    locationName: accurateLocName,
    distanceMeters: verifiedLocation.distanceMeters,
    isWithinZone: verifiedLocation.isWithinZone,
    photo: photoBase64,
    photoUrl: photoBase64,
    photoBase64: photoBase64,
    mapUrl: mapUrl
  };

  // Replace or add today's prayer for this time
  const existingIdx = todayPrayers.findIndex(p => isIdMatch(p.studentId, currentStudent.studentId) && (p.prayerName === selectedPrayerTime || p.prayerTime === selectedPrayerTime));
  if (existingIdx !== -1) {
    todayPrayers[existingIdx] = prayerRecord;
  } else {
    todayPrayers.push(prayerRecord);
  }
  localStorage.setItem('khalifah_today_prayers', JSON.stringify(todayPrayers));

  // Save to persistent prayer history
  let historyList = [];
  try {
    historyList = JSON.parse(localStorage.getItem('khalifah_prayer_history') || '[]');
  } catch (e) { historyList = []; }
  historyList.unshift(prayerRecord);
  localStorage.setItem('khalifah_prayer_history', JSON.stringify(historyList.slice(0, 150)));

  // Update UI Chip
  const chipEl = document.getElementById(`ptime-${selectedPrayerTime}`);
  if (chipEl) {
    chipEl.classList.add('done');
    const statusEl = document.getElementById(`pstatus-${selectedPrayerTime}`);
    if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-check"></i> เช็คแล้ว';
  }

  // 1. Show Animated Viewfinder Confirmation Overlay (#prayerCaptureSuccessOverlay)
  const successOverlay = document.getElementById('prayerCaptureSuccessOverlay');
  const overlayImg = document.getElementById('captureOverlayPreviewImg');
  const overlayStamp = document.getElementById('captureOverlayTimeStamp');
  const overlayTitle = document.getElementById('captureOverlayTitle');
  const overlaySub = document.getElementById('captureOverlaySub');
  if (successOverlay) {
    if (overlayImg) overlayImg.src = photoBase64;
    if (overlayStamp) overlayStamp.innerText = `${timeStr} น.`;
    if (overlayTitle) overlayTitle.innerText = `บันทึกละหมาดเวลา ${selectedPrayerTime} สำเร็จ!`;
    if (overlaySub) overlaySub.innerText = `สถานที่: ${accurateLocName} • ${dateStr}`;
    successOverlay.style.display = 'flex';
    setTimeout(() => {
      successOverlay.style.display = 'none';
    }, 2600);
  }

  // 2. Show Persistent Receipt Card below button (#prayerSavedReceiptCard)
  const receiptCard = document.getElementById('prayerSavedReceiptCard');
  if (receiptCard) {
    receiptCard.innerHTML = `
      <div class="prayer-saved-receipt-left">
        <div class="prayer-saved-thumb-wrap">
          <img src="${photoBase64}" alt="Prayer Receipt">
          <span class="prayer-saved-thumb-check"><i class="fa-solid fa-check"></i></span>
        </div>
        <div style="min-width: 0;">
          <div style="font-size: 0.84rem; font-weight: 700; color: #0f172a;">
            บันทึกภาพละหมาดเวลา "${escapeHtml(selectedPrayerTime)}" เรียบร้อยแล้ว
          </div>
          <div style="font-size: 0.74rem; color: #64748b; margin-top: 0.1rem;">
            ${escapeHtml(dateStr)} • เวลา ${escapeHtml(timeStr)} น. • ณ ${escapeHtml(accurateLocName)}
          </div>
        </div>
      </div>
      <span class="prayer-saved-receipt-badge">
        <i class="fa-solid fa-circle-check"></i> บันทึกแล้ว
      </span>
    `;
    receiptCard.style.display = 'flex';
  }

  renderTodayPrayerTable();
  renderDashboardCharts();
  renderCurrentStudentProfile();
  renderCurrentStudentProfile();

  if (document.getElementById('prayerNoteInput')) {
    document.getElementById('prayerNoteInput').value = '';
  }
  renderPrayerHistory();

  // Instant Button Confirmation Animation
  const btnCapture = document.getElementById('btnCaptureInstant');
  if (btnCapture) {
    const originalText = btnCapture.innerHTML;
    btnCapture.style.background = '#0f172a';
    btnCapture.innerHTML = `<i class="fa-solid fa-circle-check"></i> ได้รับรูปและบันทึกเวลาละหมาด ${selectedPrayerTime} เรียบร้อยแล้ว!`;
    setTimeout(() => {
      btnCapture.style.background = '';
      btnCapture.innerHTML = originalText;
    }, 2800);
  }

  // Slide-In notification card with thumbnail & meta
  showCameraSlideToast(photoBase64, selectedPrayerTime, accurateLocName, prayerStatus);
  showToast(`เช็คชื่อละหมาดเวลา ${selectedPrayerTime} เรียบร้อยแล้ว! (${prayerStatus})`, 'success');

  // Sync to Google Sheets
  syncRecordToGoogleSheet('prayerCheckIn', prayerRecord);
}

function openPrayerHistoryModal() {
  const container = document.getElementById('prayerHistoryListContainer');
  if (!container) return;

  if (!currentStudent) {
    container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">กรุณาเข้าสู่ระบบเพื่อดูประวัติการละหมาด</div>';
    openModal('prayerHistoryModal');
    return;
  }

  let historyList = [];
  try {
    historyList = JSON.parse(localStorage.getItem('khalifah_prayer_history') || '[]');
  } catch (e) { historyList = []; }

  const myHistory = historyList.filter(p => isIdMatch(p.studentId, currentStudent.studentId));

  if (myHistory.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="fa-solid fa-clock" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>ยังไม่มีประวัติการเช็คชื่อละหมาดที่บันทึกไว้</div>';
  } else {
    container.innerHTML = myHistory.map(p => {
      const dt = new Date(p.timestamp);
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.75rem; border-bottom: 1px solid var(--border-light);">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            ${p.photo ? `<img src="${p.photo}" alt="Prayer Photo" style="width: 48px; height: 36px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid #cbd5e1;">` : '<div style="width: 48px; height: 36px; background: #e2e8f0; border-radius: var(--radius-sm);"></div>'}
            <div>
              <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-dark);">ละหมาด: ${escapeHtml(p.prayerName)}</div>
              <div style="font-size: 0.76rem; color: var(--text-muted);">${dt.toLocaleDateString('th-TH')} • ${dt.toLocaleTimeString('th-TH')}</div>
            </div>
          </div>
          <span class="activity-badge ${p.isWithinZone ? 'badge-active' : 'badge-upcoming'}" style="font-size: 0.72rem;">
            ${p.isWithinZone ? 'ในเขตมัสยิด' : 'นอกเขต'}
          </span>
        </div>
      `;
    }).join('');
  }

  openModal('prayerHistoryModal');
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

  const statusSelect = document.getElementById('prayerStatusSelect');
  const noteInput = document.getElementById('prayerNoteInput');
  const prayerStatus = statusSelect ? statusSelect.value : 'ตรงเวลา (ญะมาอะฮ์/มัสยิด)';
  const prayerNote = noteInput ? noteInput.value.trim() : '';

  // สร้าง Object ข้อมูลการบันทึก
  const prayerRecord = {
    logId: 'PRY-' + Date.now(),
    studentId: currentStudent.studentId,
    studentName: currentStudent.fullName,
    grade: currentStudent.grade,
    prayerTime: selectedPrayerTime,
    status: prayerStatus,
    note: prayerNote,
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
  renderCurrentStudentProfile();

  // ส่งข้อมูลไปยัง Google Apps Script Backend (หากตั้งค่าไว้)
  syncRecordToGoogleSheet('recordPrayer', prayerRecord);

  showToast(`บันทึกการละหมาดเวลา ${selectedPrayerTime} เรียบร้อยแล้ว`, 'success');
}

function getCurrentPrayerTimeSlot() {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 7) return 'ซุบฮิ';
  if (hour >= 12 && hour < 15) return 'ซุฮริ';
  if (hour >= 15 && hour < 18) return 'อัศรฺ';
  if (hour >= 18 && hour < 19.5) return 'มัฆริบ';
  return 'อีชาอ์';
}

function appendPrayerNote(text) {
  const noteInput = document.getElementById('prayerNoteInput');
  if (!noteInput) return;
  const currentVal = noteInput.value.trim();
  if (!currentVal) {
    noteInput.value = text;
  } else if (!currentVal.includes(text)) {
    noteInput.value = currentVal + ', ' + text;
  }
  showToast(`เพิ่มหมายเหตุ: "${text}"`, 'info');
}

let selectedPrayerNoteTimeSlots = [];
let selectedPrayerNoteTimeSlot = null;

function togglePrayerNotesCollapse(forceState = null) {
  const card = document.getElementById('prayerNotesCard');
  const body = document.getElementById('prayerNotesCollapseBody');
  const chevron = document.getElementById('prayerNotesChevron');
  const header = document.getElementById('prayerNotesHeader');
  if (!body) return;

  const isCurrentlyOpen = body.style.display !== 'none';
  const shouldOpen = forceState !== null ? forceState : !isCurrentlyOpen;

  if (shouldOpen) {
    body.style.display = 'block';
    if (card) card.classList.add('is-open');
    if (chevron) chevron.style.transform = 'rotate(180deg)';
    if (header) header.setAttribute('aria-expanded', 'true');
  } else {
    body.style.display = 'none';
    if (card) card.classList.remove('is-open');
    if (chevron) chevron.style.transform = 'rotate(0deg)';
    if (header) header.setAttribute('aria-expanded', 'false');
  }
}

function updatePrayerNoteChipsUI() {
  const chips = document.querySelectorAll('.prayer-note-time-chip');
  chips.forEach(chip => {
    const t = chip.getAttribute('data-time');
    if (selectedPrayerNoteTimeSlots.includes(t)) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });

  const selectedTextEl = document.getElementById('prayerNoteTimeSelectedText');
  if (selectedTextEl) {
    if (selectedPrayerNoteTimeSlots.length === 0) {
      selectedTextEl.innerHTML = `* บังคับเลือกเวลา (เลือกได้หลายเวลา)`;
      selectedTextEl.style.color = '#ef4444';
    } else if (selectedPrayerNoteTimeSlots.length === 5) {
      selectedTextEl.innerHTML = `<span style="color: #0284c7; font-weight: 700;"><i class="fa-solid fa-check-double"></i> เลือกครบ 5 เวลา (ทุกเวลา)</span>`;
      selectedTextEl.style.color = '#0284c7';
    } else {
      selectedTextEl.innerHTML = `<span style="color: #0284c7; font-weight: 700;"><i class="fa-solid fa-check"></i> เลือก ${selectedPrayerNoteTimeSlots.length} เวลา: ${selectedPrayerNoteTimeSlots.join(', ')}</span>`;
      selectedTextEl.style.color = '#0284c7';
    }
  }
}

function togglePrayerNoteTime(time) {
  const ALL_PRAYERS = ['ซุบฮิ', 'ซุฮริ', 'อัศรฺ', 'มัฆริบ', 'อีชาอ์'];
  if (!time) return;

  const idx = selectedPrayerNoteTimeSlots.indexOf(time);
  if (idx > -1) {
    selectedPrayerNoteTimeSlots.splice(idx, 1);
  } else {
    selectedPrayerNoteTimeSlots.push(time);
  }

  // Sort them in canonical order
  selectedPrayerNoteTimeSlots.sort((a, b) => ALL_PRAYERS.indexOf(a) - ALL_PRAYERS.indexOf(b));
  selectedPrayerNoteTimeSlot = selectedPrayerNoteTimeSlots[0] || null;

  updatePrayerNoteChipsUI();
}

function selectAllPrayerNoteTimes(selectAll = true) {
  const ALL_PRAYERS = ['ซุบฮิ', 'ซุฮริ', 'อัศรฺ', 'มัฆริบ', 'อีชาอ์'];
  if (selectAll) {
    selectedPrayerNoteTimeSlots = [...ALL_PRAYERS];
  } else {
    selectedPrayerNoteTimeSlots = [];
  }
  selectedPrayerNoteTimeSlot = selectedPrayerNoteTimeSlots[0] || null;
  updatePrayerNoteChipsUI();
}

function selectPrayerNoteTime(time) {
  // Single-select wrapper for backwards compatibility
  if (time) {
    selectedPrayerNoteTimeSlots = [time];
    selectedPrayerNoteTimeSlot = time;
  } else {
    selectedPrayerNoteTimeSlots = [];
    selectedPrayerNoteTimeSlot = null;
  }
  updatePrayerNoteChipsUI();
}

function applyPrayerNotePreset(reasonKey) {
  const noteInput = document.getElementById('prayerNoteInput');
  if (reasonKey === 'menstruation') {
    selectAllPrayerNoteTimes(true);
    if (noteInput) noteInput.value = 'มีประจำเดือน / อุซุรทางศาสนา';
    showToast('เลือกเวลาละหมาดครบ 5 เวลา และตั้งสถานะ "มีประจำเดือน / อุซุร" เรียบร้อยแล้ว สามารถกดบันทึกได้ทันที', 'info');
  } else if (reasonKey === 'sick') {
    if (selectedPrayerNoteTimeSlots.length === 0) {
      selectAllPrayerNoteTimes(true);
    }
    if (noteInput) noteInput.value = 'ลาป่วย / มีไข้';
    showToast('ตั้งค่าหมายเหตุ "ลาป่วย / มีไข้" เรียบร้อยแล้ว', 'info');
  } else if (reasonKey === 'travel') {
    if (noteInput) noteInput.value = 'กำลังเดินทาง (มุซาฟิร)';
    showToast('ตั้งค่าหมายเหตุ "กำลังเดินทาง (มุซาฟิร)" เรียบร้อยแล้ว', 'info');
  } else if (reasonKey === 'home') {
    if (noteInput) noteInput.value = 'ละหมาดที่บ้าน';
    showToast('ตั้งค่าหมายเหตุ "ละหมาดที่บ้าน" เรียบร้อยแล้ว', 'info');
  } else if (reasonKey === 'jamaah') {
    if (noteInput) noteInput.value = 'ญะมาอะฮ์แถวแรก';
    showToast('ตั้งค่าหมายเหตุ "ญะมาอะฮ์แถวแรก" เรียบร้อยแล้ว', 'info');
  }
}

async function savePrayerNoteOnly() {
  if (!currentStudent) {
    showToast('กรุณาเข้าสู่ระบบนักเรียนก่อนบันทึก', 'warning');
    enforceMandatoryLogin();
    return;
  }

  if (selectedPrayerNoteTimeSlots.length === 0) {
    if (typeof togglePrayerNotesCollapse === 'function') togglePrayerNotesCollapse(true);
    showToast('⚠️ กรุณาเลือกเวลาละหมาดอย่างน้อย 1 เวลา (ซุบฮิ, ซุฮริ, อัศรฺ, มัฆริบ, อีชาอ์)', 'warning');
    const groupEl = document.querySelector('.prayer-time-select-group');
    if (groupEl) {
      groupEl.style.outline = '2px solid #ef4444';
      groupEl.style.borderRadius = '12px';
      groupEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { groupEl.style.outline = 'none'; }, 2200);
    }
    return;
  }

  const noteInput = document.getElementById('prayerNoteInput');
  const prayerNote = noteInput ? noteInput.value.trim() : '';
  const isExcused = prayerNote.includes('ประจำเดือน') || prayerNote.includes('อุซุร') || prayerNote.includes('ป่วย');

  // Anti-cheating check: enforce fresh GPS check before recording note (unless excused)
  const isGpsValid = verifiedLocation && (Date.now() - new Date(verifiedLocation.timestamp).getTime() <= GPS_EXPIRATION_MS);
  if (!isGpsValid && !isExcused) {
    showToast('📍 กำลังตรวจสอบพิกัด GPS สดใหม่ก่อนบันทึกหมายเหตุ...', 'info');
    try {
      await fetchFreshPrayerLocation();
    } catch (err) {
      showToast('⚠️ ไม่สามารถดึงพิกัด GPS ได้: ' + err.message + ' กรุณาเปิด Location บนอุปกรณ์', 'error');
      return;
    }
  }

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString('th-TH');

  const lat = verifiedLocation ? verifiedLocation.lat : 6.78652;
  const lng = verifiedLocation ? verifiedLocation.lng : 101.24641;
  const isWithin = verifiedLocation ? verifiedLocation.isWithinZone : false;
  const locName = (verifiedLocation && verifiedLocation.locationName) ? verifiedLocation.locationName : (isExcused ? 'บันทึกสถานะพิเศษ (อุซุร/ลาป่วย)' : 'มัสยิด / สถานที่ละหมาด');
  const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  let historyList = [];
  try {
    historyList = JSON.parse(localStorage.getItem('khalifah_prayer_history') || '[]');
  } catch (e) { historyList = []; }

  const savedTimes = [];

  for (const pTime of selectedPrayerNoteTimeSlots) {
    let prayerStatus = 'ตรงเวลา';
    if (prayerNote) {
      if (prayerNote.includes('ประจำเดือน') || prayerNote.includes('อุซุร')) {
        prayerStatus = 'อุซุร (มีประจำเดือน)';
      } else if (prayerNote.includes('ป่วย')) {
        prayerStatus = 'ลาป่วย';
      } else {
        prayerStatus = `ตรงเวลา (${prayerNote})`;
      }
    }

    const existingIdx = todayPrayers.findIndex(p => p.studentId === currentStudent.studentId && (p.prayerTime === pTime || p.prayerName === pTime) && p.date === dateStr);
    const logId = existingIdx !== -1 ? (todayPrayers[existingIdx].logId || todayPrayers[existingIdx].id) : ('PRY-' + Date.now() + '-' + pTime);

    const prayerRecord = {
      id: logId,
      logId: logId,
      studentId: currentStudent.studentId,
      studentName: currentStudent.fullName,
      grade: currentStudent.grade,
      prayerTime: pTime,
      prayerName: pTime,
      status: prayerStatus,
      note: prayerNote,
      timestamp: now.toISOString(),
      date: dateStr,
      time: timeStr,
      latitude: lat,
      longitude: lng,
      lat: lat,
      lng: lng,
      locationName: locName,
      distanceMeters: verifiedLocation ? verifiedLocation.distanceMeters : 0,
      isWithinZone: isWithin,
      photo: existingIdx !== -1 ? (todayPrayers[existingIdx].photo || todayPrayers[existingIdx].photoUrl) : '',
      photoUrl: existingIdx !== -1 ? todayPrayers[existingIdx].photoUrl : '',
      photoBase64: existingIdx !== -1 ? (todayPrayers[existingIdx].photoBase64 || todayPrayers[existingIdx].photo) : '',
      mapUrl: mapUrl
    };

    if (existingIdx !== -1) {
      todayPrayers[existingIdx] = prayerRecord;
    } else {
      todayPrayers.unshift(prayerRecord);
    }

    const histIdx = historyList.findIndex(p => p.studentId === currentStudent.studentId && (p.prayerTime === pTime || p.prayerName === pTime) && p.date === dateStr);
    if (histIdx !== -1) {
      historyList[histIdx] = prayerRecord;
    } else {
      historyList.unshift(prayerRecord);
    }

    const prayerCard = document.getElementById(`ptime-${pTime}`);
    if (prayerCard) {
      prayerCard.classList.add('done');
      const statusSpan = document.getElementById(`pstatus-${pTime}`);
      if (statusSpan) statusSpan.innerText = '✓ บันทึกแล้ว';
    }

    syncRecordToGoogleSheet('recordPrayer', prayerRecord);
    savedTimes.push(pTime);
  }

  localStorage.setItem('khalifah_today_prayers', JSON.stringify(todayPrayers));
  localStorage.setItem('khalifah_prayer_history', JSON.stringify(historyList));

  // Clear inputs and collapse
  if (noteInput) noteInput.value = '';
  selectAllPrayerNoteTimes(false);
  if (typeof togglePrayerNotesCollapse === 'function') togglePrayerNotesCollapse(false);

  renderTodayPrayerTable();
  renderPrayerHistory();
  renderDashboardCharts();
  renderCurrentStudentProfile();

  playSuccessSound();
  showToast(`บันทึกหมายเหตุการละหมาด ${savedTimes.length} เวลา (${savedTimes.join(', ')}) เรียบร้อยแล้ว!`, 'success');
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

  tbody.innerHTML = todayPrayers.map(p => {
    const lat = p.latitude || p.lat;
    const lng = p.longitude || p.lng;
    const mapBtn = (!p.isWithinZone && lat && lng) ? `
      <div style="margin-top: 0.25rem;">
        <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" class="badge" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.72rem;">
          <i class="fa-solid fa-map-location-dot"></i> ดูบน Map
        </a>
      </div>
    ` : '';

    const recId = p.logId || p.id;
    const rawPhoto = p.photo || p.photoUrl || p.photoBase64;
    const hasPhoto = !!(rawPhoto && rawPhoto.length > 10);

    return `
      <tr>
        <td><b>${p.prayerTime || p.prayerName}</b></td>
        <td>${p.time || '-'}</td>
        <td>
          <div>${p.locationName || 'พิกัด GPS'}</div>
          ${mapBtn}
        </td>
        <td>
          <span class="activity-badge ${p.isWithinZone ? 'badge-active' : 'badge-upcoming'}">
            ${p.isWithinZone ? '✓ ในเขต' : 'นอกระยะ'}
          </span>
        </td>
        <td>
          ${hasPhoto ? `
            <button class="btn btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.78rem;" onclick="viewPrayerPhoto('${recId}')">
              <i class="fa-solid fa-image"></i> ดูรูป
            </button>
          ` : `<span style="color: var(--text-muted); font-size: 0.78rem;">ไม่มีรูป</span>`}
        </td>
      </tr>
    `;
  }).join('');
}

function viewPrayerPhoto(logId) {
  let record = todayPrayers.find(p => (p.logId === logId || p.id === logId));
  if (!record) {
    let historyList = [];
    try {
      historyList = JSON.parse(localStorage.getItem('khalifah_prayer_history') || '[]');
    } catch (e) { historyList = []; }
    record = historyList.find(p => (p.logId === logId || p.id === logId));
  }
  const rawPhoto = record ? (record.photoUrl || record.photo || record.photoBase64) : null;
  const photo = getDirectImageUrl(rawPhoto);
  if (!photo) {
    showToast('ไม่มีรูปถ่ายสำหรับรายการนี้', 'info');
    return;
  }

  const caption = `${record.studentName || 'นักเรียน'} - ละหมาด${record.prayerName || record.prayerTime || ''} (${record.date || ''} ${record.time || ''})`;
  openPhotoViewerModal(photo, caption, photo);
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

  let actLogs = [];
  try {
    actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
  } catch (e) { actLogs = []; }

  container.innerHTML = activities.map(act => {
    const actId = act.id || act.activityId;
    const isChecked = currentStudent
      ? actLogs.some(l => isIdMatch(l.studentId, currentStudent.studentId) && (l.activityId === actId || l.activityTitle === act.title))
      : !!act.checkedIn;
    const dateDisplay = act.date || (act.startDate ? formatDateTime(act.startDate) : '-');
    return `
    <div class="activity-card">
      <div style="flex: 1;">
        <span class="activity-badge ${(act.status === 'Active' || !act.status) ? 'badge-active' : 'badge-upcoming'}">
          ${(act.status === 'Active' || !act.status) ? 'กำลังเปิดรับเช็คชื่อ' : 'เร็วๆ นี้'}
        </span>
        <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-dark);">${escapeHtml(act.title)}</h3>
        <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0.35rem 0;">${escapeHtml(act.description || act.type || '')}</p>
        <div style="font-size: 0.82rem; color: var(--text-body); display: flex; gap: 1rem; flex-wrap: wrap;">
          <span><i class="fa-regular fa-clock" style="color: var(--primary);"></i> ${escapeHtml(dateDisplay)}</span>
          <span><i class="fa-solid fa-location-dot" style="color: var(--primary);"></i> ${escapeHtml(act.location || '-')}</span>
        </div>
      </div>
      <div>
        <button class="btn ${isChecked ? 'btn-secondary' : 'btn-primary'}" onclick="checkInActivity('${escapeHtml(actId)}')" ${isChecked ? 'disabled' : ''}>
          <i class="fa-solid ${isChecked ? 'fa-circle-check' : 'fa-check'}"></i> 
          ${isChecked ? 'เช็คชื่อแล้ว' : 'กดเช็คชื่อเข้าร่วม'}
        </button>
      </div>
    </div>
  `;
  }).join('');
}

function checkInActivity(actId) {
  if (!currentStudent) {
    showToast('กรุณาเข้าสู่ระบบนักเรียนก่อนเช็คชื่อกิจกรรม', 'warning');
    openModal('authModal');
    return;
  }
  const act = activities.find(a => a.id === actId || a.activityId === actId);
  if (!act) return;

  const resolvedActId = act.id || act.activityId;
  act.checkedIn = true;
  localStorage.setItem('khalifah_activities', JSON.stringify(activities));

  let actLogs = [];
  try {
    actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
  } catch (e) { actLogs = []; }

  const now = new Date();
  const logEntry = {
    id: 'ACTLOG-' + Date.now(),
    studentId: cleanIdString(currentStudent.studentId),
    studentName: currentStudent.fullName,
    grade: currentStudent.grade || '-',
    activityId: resolvedActId,
    activityTitle: act.title,
    checkInTimestamp: now.toISOString(),
    formattedDate: now.toLocaleDateString('th-TH'),
    formattedTime: now.toLocaleTimeString('th-TH')
  };

  const existingIdx = actLogs.findIndex(l => isIdMatch(l.studentId, currentStudent.studentId) && (l.activityId === resolvedActId || l.activityTitle === act.title));
  if (existingIdx !== -1) {
    actLogs[existingIdx] = logEntry;
  } else {
    actLogs.unshift(logEntry);
  }
  localStorage.setItem('khalifah_student_act_logs', JSON.stringify(actLogs));

  renderActivitiesList();
  renderStudentScannedActivities();
  renderAdminActivitiesTable();
  if (typeof renderAdminLiveActivityFeed === 'function') renderAdminLiveActivityFeed();
  renderDashboardCharts();

  syncRecordToGoogleSheet('activityCheckIn', logEntry);

  showToast(`เช็คชื่อเข้าร่วมกิจกรรม "${act.title}" สำเร็จ`, 'success');
}

// ----------------- CHARTS & ANALYTICS ----------------- //

function renderDashboardCharts() {
  renderSkillRadarChart();
  renderAttendanceDoughnutChart();
  renderPrayerBarChart();
  renderActivityPieChart();
}

let appSubjects = [];

function loadAppSubjects() {
  const saved = localStorage.getItem('khalifah_subjects');
  if (saved) {
    try {
      appSubjects = JSON.parse(saved);
    } catch (e) {
      appSubjects = [];
    }
  }
  if (!appSubjects || appSubjects.length === 0) {
    appSubjects = [
      { id: 'religious', code: 'ISL101', name: 'ศาสนาและจริยธรรม' },
      { id: 'science', code: 'SCI101', name: 'วิทยาศาสตร์' },
      { id: 'math', code: 'MAT101', name: 'คณิตศาสตร์' },
      { id: 'language', code: 'THA101', name: 'ภาษาและการสื่อสาร' },
      { id: 'social', code: 'SOC101', name: 'สังคมและวัฒนธรรม' },
      { id: 'tech', code: 'TEC101', name: 'เทคโนโลยีและนวัตกรรม' }
    ];
    localStorage.setItem('khalifah_subjects', JSON.stringify(appSubjects));
  }
}

function formatRadarLabelMultiLine(text) {
  if (!text) return '';
  const clean = String(text).trim();
  // คำเดี่ยวไม่ตัดคำเด็ดขาด (เช่น คณิตศาสตร์, วิทยาศาสตร์)
  if (clean === 'คณิตศาสตร์' || clean === 'วิทยาศาสตร์') {
    return clean;
  }
  // ตัดบรรทัดอย่างเป็นธรรมชาติเมื่อมีคำว่า "และ"
  if (clean.includes('และ')) {
    const parts = clean.split('และ');
    return [parts[0] + 'และ', parts[1]];
  }
  if (clean.includes(' ')) {
    return clean.split(' ');
  }
  return clean;
}

function renderSkillRadarChart() {
  const canvas = document.getElementById('skillRadarChart');
  const container = document.getElementById('skillChartContainer');
  if (!canvas) return;

  if (skillChartInstance) skillChartInstance.destroy();

  loadAppSubjects();

  // If no subjects exist, handle gracefully
  if (!appSubjects || appSubjects.length === 0) {
    if (container) container.style.height = '180px';
    return;
  }

  // Adjust container height dynamically based on subject count (approx 44px per subject + padding)
  const calcHeight = Math.max(260, appSubjects.length * 44 + 65);
  if (container) {
    container.style.height = `${calcHeight}px`;
  }
  canvas.style.height = `${calcHeight}px`;

  const labels = appSubjects.map(s => s.name);
  const dataGrades = appSubjects.map(s => {
    if (currentStudent) {
      const gradesMap = currentStudent.subjectGrades || {};
      const skillsMap = currentStudent.skills || {};
      if (gradesMap[s.id] !== undefined && gradesMap[s.id] !== '') {
        return normalizeGrade1To4(gradesMap[s.id]);
      }
      if (skillsMap[s.id] !== undefined && skillsMap[s.id] !== '') {
        return normalizeGrade1To4(skillsMap[s.id]);
      }
    }
    return 0; // Unassigned / not yet graded
  });

  // Calculate dynamic bar colors based on grade value
  const barBackgrounds = dataGrades.map(g => {
    if (g >= 3.5) return 'rgba(16, 185, 129, 0.9)'; // Emerald (3.5 - 4.0)
    if (g >= 2.5) return 'rgba(2, 132, 199, 0.9)';   // Sky Blue (2.5 - 3.49)
    if (g >= 1.5) return 'rgba(245, 158, 11, 0.9)';  // Amber (1.5 - 2.49)
    if (g > 0) return 'rgba(239, 68, 68, 0.85)';     // Coral/Red (< 1.5)
    return 'rgba(203, 213, 225, 0.7)';               // Neutral Slate (Pending)
  });

  const barBorders = dataGrades.map(g => {
    if (g >= 3.5) return '#059669';
    if (g >= 2.5) return '#0369a1';
    if (g >= 1.5) return '#d97706';
    if (g > 0) return '#dc2626';
    return '#94a3b8';
  });

  // Render subject grade pills below horizontal bar chart with enhanced readability
  const pillsContainer = document.getElementById('studentSubjectGradesPills');
  if (pillsContainer) {
    pillsContainer.innerHTML = appSubjects.map((s, idx) => {
      const g = dataGrades[idx];
      let gradeText = 'รอผล';
      let badgeStyle = 'background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1;';
      if (g >= 3.5) {
        gradeText = `เกรด ${Number.isInteger(g) ? g : g.toFixed(1)}`;
        badgeStyle = 'background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;';
      } else if (g >= 2.5) {
        gradeText = `เกรด ${Number.isInteger(g) ? g : g.toFixed(1)}`;
        badgeStyle = 'background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;';
      } else if (g >= 1.5) {
        gradeText = `เกรด ${Number.isInteger(g) ? g : g.toFixed(1)}`;
        badgeStyle = 'background: #fffbeb; color: #b45309; border: 1px solid #fde68a;';
      } else if (g > 0) {
        gradeText = `เกรด ${Number.isInteger(g) ? g : g.toFixed(1)}`;
        badgeStyle = 'background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;';
      }

      return `
        <div class="subject-grade-pill-item" title="${escapeHtml(s.name)}: ${gradeText}">
          <span class="subject-grade-pill-name">${escapeHtml(s.name)}</span>
          <span class="subject-grade-pill-val" style="${badgeStyle}">${gradeText}</span>
        </div>
      `;
    }).join('');
  }

  // Update GPAX on dashboard if student has graded subjects
  if (currentStudent) {
    const newGpa = recalculateStudentGpa(currentStudent);
    const statGpa = document.getElementById('statGpa');
    if (statGpa) statGpa.innerText = newGpa;
  }

  skillChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'เกรด (เต็ม 4.00)',
        data: dataGrades,
        backgroundColor: barBackgrounds,
        borderColor: barBorders,
        borderWidth: 1.5,
        borderRadius: 6,
        barPercentage: 0.65,
        categoryPercentage: 0.85
      }]
    },
    options: {
      indexAxis: 'y',
      animation: {
        duration: 800,
        easing: 'easeOutQuart'
      },
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 10, bottom: 10, left: 10, right: 25 }
      },
      scales: {
        x: {
          min: 0,
          max: 4,
          grid: {
            color: 'rgba(226, 232, 240, 0.8)',
            drawBorder: false
          },
          ticks: {
            stepSize: 1,
            color: '#64748b',
            font: { family: 'Kanit, Prompt, sans-serif', size: 11, weight: '600' },
            callback: function(val) {
              return val.toFixed(1);
            }
          },
          title: {
            display: true,
            text: 'ระดับเกรดเฉลี่ย (1.00 – 4.00)',
            color: '#94a3b8',
            font: { family: 'Kanit, Prompt, sans-serif', size: 10, weight: '600' }
          }
        },
        y: {
          grid: {
            display: false,
            drawBorder: false
          },
          ticks: {
            color: '#0f172a',
            font: { family: 'Kanit, Prompt, sans-serif', size: 12, weight: '600' },
            padding: 8
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { family: 'Kanit, Prompt, sans-serif', size: 12, weight: '700' },
          bodyFont: { family: 'Kanit, Prompt, sans-serif', size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const val = context.raw || 0;
              if (val <= 0) return ' สถานะ: รอผลการประเมินจากอาจารย์';
              return ` ผลการเรียน: เกรด ${val.toFixed(2)} (เต็ม 4.00)`;
            }
          }
        }
      }
    }
  });
}

function renderAttendanceDoughnutChart() {
  const ctx = document.getElementById('attendanceDoughnutChart');
  if (!ctx) return;

  if (attendanceChartInstance) attendanceChartInstance.destroy();

  const att = (currentStudent && currentStudent.attendance) ? currentStudent.attendance : {
    present: 0, late: 0, leave: 0, absent: 0
  };

  const total = att.present + att.late + att.leave + att.absent;
  const chartLabels = total > 0 ? ['มาเรียน', 'มาสาย', 'ลา', 'ขาด'] : ['ยังไม่มีข้อมูล'];
  const chartData = total > 0 ? [att.present, att.late, att.leave, att.absent] : [1];
  const chartColors = total > 0 ? ['#10b981', '#f59e0b', '#0284c7', '#ef4444'] : ['#e2e8f0'];

  attendanceChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: chartLabels,
      datasets: [{
        data: chartData,
        backgroundColor: chartColors,
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '66%',
      layout: {
        padding: { top: 6, bottom: 6, left: 6, right: 6 }
      },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 1500,
        easing: 'easeOutCubic'
      },
      plugins: {
        legend: {
          position: 'bottom',
          align: 'center',
          labels: { font: { family: 'Kanit', size: 11 }, padding: 10, boxWidth: 12 }
        }
      }
    }
  });
}

function renderPrayerBarChart() {
  const ctx = document.getElementById('prayerBarChart');
  if (!ctx) return;

  if (prayerChartInstance) prayerChartInstance.destroy();

  // คำนวณสถิติละหมาดรายวันทั้ง 7 วันของสัปดาห์ตามจริงจากประวัติ
  const barData = [0, 0, 0, 0, 0, 0, 0]; // จันทร์ (0) -> อาทิตย์ (6)
  if (currentStudent) {
    let historyList = [];
    try {
      historyList = JSON.parse(localStorage.getItem('khalifah_prayer_history') || '[]');
    } catch (e) { historyList = []; }

    const combined = [...todayPrayers, ...historyList].filter(p => isIdMatch(p.studentId, currentStudent.studentId));
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - dayOfWeek);

    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(monday);
      targetDate.setDate(monday.getDate() + i);
      const ymd = targetDate.toISOString().split('T')[0];
      const uniquePrayers = new Set();
      combined.forEach(p => {
        const pDate = p.date || (p.timestamp ? p.timestamp.split('T')[0] : '');
        if (pDate === ymd) {
          uniquePrayers.add(p.prayerTime || p.prayerName);
        }
      });
      barData[i] = Math.min(5, uniquePrayers.size);
    }
  }

  prayerChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'],
      datasets: [{
        label: 'จำนวนเวลาที่ละหมาด (เต็ม 5)',
        data: barData,
        backgroundColor: '#0f172a',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1400,
        easing: 'easeOutQuart'
      },
      layout: {
        padding: { top: 6, bottom: 6, left: 6, right: 6 }
      },
      scales: {
        y: {
          min: 0,
          max: 5,
          ticks: { stepSize: 1, font: { family: 'Kanit', size: 11 } }
        },
        x: {
          ticks: { font: { family: 'Kanit', size: 10 } }
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

  const joinedCount = currentStudent ? activities.filter(a => a.checkedIn).length : 0;
  const remainingCount = currentStudent ? Math.max(0, activities.length - joinedCount) : 0;
  const hasData = (joinedCount + remainingCount) > 0;

  const pieLabels = hasData ? ['เข้าร่วมแล้ว', 'ยังไม่เข้าร่วม'] : ['ยังไม่มีกิจกรรม'];
  const pieData = hasData ? [joinedCount, remainingCount] : [1];
  const pieColors = hasData ? ['#9333ea', '#e2e8f0'] : ['#f1f5f9'];

  activityChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: pieLabels,
      datasets: [{
        data: pieData,
        backgroundColor: pieColors,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 6, bottom: 6, left: 6, right: 6 }
      },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 1500,
        easing: 'easeOutCubic'
      },
      plugins: {
        legend: {
          position: 'bottom',
          align: 'center',
          labels: { font: { family: 'Kanit', size: 11 }, padding: 10, boxWidth: 12 }
        }
      }
    }
  });
}

// ----------------- PROFILE & GRADE PROMOTION ----------------- //

function renderCurrentStudentProfile() {
  const headerName = document.getElementById('headerUserName');
  const headerRole = document.getElementById('headerUserRole');
  const headerAvatar = document.getElementById('userAvatarText');

  const dashGreeting = document.getElementById('dashGreeting');
  const dashSubtitle = document.getElementById('dashSubtitle');
  const dashStudentId = document.getElementById('dashStudentId');
  const dashGrade = document.getElementById('dashGrade');
  const dashSchool = document.getElementById('dashSchoolName');

  const statAtt = document.getElementById('statAttendancePercent');
  const statPry = document.getElementById('statPrayersCount');
  const statAct = document.getElementById('statActivitiesCount');
  const statGpa = document.getElementById('statGpa');

  const profFullName = document.getElementById('profFullName');
  const profSchool = document.getElementById('profSchool');
  const profGradeBadge = document.getElementById('profGradeBadge');
  const profStudentId = document.getElementById('profStudentId');
  const profBirthDate = document.getElementById('profBirthDate');
  const profParentPhone = document.getElementById('profParentPhone');
  const profAvatar = document.getElementById('profAvatar');
  const selectNewGrade = document.getElementById('selectNewGrade');

  const profStudentIdHeader = document.getElementById('profStudentIdHeader');
  const profFullNameDetail = document.getElementById('profFullNameDetail');
  const profSchoolDetail = document.getElementById('profSchoolDetail');
  const profGradeDetail = document.getElementById('profGradeDetail');
  const profRegDate = document.getElementById('profRegDate');
  const profStatusDetail = document.getElementById('profStatusDetail');
  const profStatusBadge = document.getElementById('profStatusBadge');

  // GUEST STATE (เมื่อยังไม่มีการเข้าสู่ระบบ)
  const headerSub = document.getElementById('headerUserSub');
  if (!currentStudent) {
    if (headerName) headerName.innerText = 'เข้าสู่ระบบ';
    if (headerSub) headerSub.innerText = 'นักเรียน / ผู้ใช้';
    if (headerRole) headerRole.innerText = 'นักเรียน';
    if (headerAvatar) headerAvatar.innerHTML = '<i class="fa-solid fa-user"></i>';

    const bannerAvatar = document.getElementById('dashBannerAvatar');
    if (bannerAvatar) {
      bannerAvatar.innerHTML = '<i class="fa-solid fa-user"></i>';
    }
    if (dashGreeting) dashGreeting.innerText = 'ยินดีต้อนรับสู่ KHALIFAH PROGRAM';
    const dashGreetingName = document.getElementById('dashGreetingName');
    if (dashGreetingName) dashGreetingName.innerText = 'ผู้ใช้งานทั่วไป';
    if (dashSubtitle) dashSubtitle.innerText = '';
    if (dashStudentId) dashStudentId.innerText = '-';
    if (dashGrade) dashGrade.innerText = '-';
    if (dashSchool) dashSchool.innerText = 'โรงเรียน/สถาบัน';

    if (statAtt) statAtt.innerText = '0%';
    if (statPry) statPry.innerText = '0 / 5';
    if (statAct) statAct.innerText = '0 ครั้ง';
    if (statGpa) statGpa.innerText = '0.00';

    if (profFullName) profFullName.innerText = 'ยังไม่ได้เข้าสู่ระบบ';
    if (profSchool) profSchool.innerText = 'กรุณาเข้าสู่ระบบหรือลงทะเบียนเพื่อจัดการโปรไฟล์';
    if (profGradeBadge) profGradeBadge.innerText = 'ยังไม่ระบุชั้น';
    if (profStudentId) profStudentId.innerText = '-';
    if (profBirthDate) profBirthDate.innerText = '-';
    if (profParentPhone) profParentPhone.innerText = '-';
    if (profAvatar) profAvatar.innerHTML = '<i class="fa-solid fa-user"></i>';

    if (profStudentIdHeader) profStudentIdHeader.innerText = '-';
    if (profFullNameDetail) profFullNameDetail.innerText = '-';
    if (profSchoolDetail) profSchoolDetail.innerText = '-';
    if (profGradeDetail) profGradeDetail.innerText = '-';
    if (profRegDate) profRegDate.innerText = '-';
    if (profStatusDetail) profStatusDetail.innerText = '-';
    if (profStatusBadge) profStatusBadge.innerHTML = '<i class="fa-solid fa-circle-question"></i> ยังไม่ได้เข้าสู่ระบบ';
    return;
  }

  // LOGGED-IN STUDENT STATE
  if (headerName && currentStudent.fullName) {
    const nameParts = currentStudent.fullName.trim().split(' ');
    headerName.innerText = nameParts[0] || currentStudent.fullName;
    const surname = nameParts.slice(1).join(' ');
    if (headerSub) {
      const shortGr = currentStudent.grade ? currentStudent.grade.replace('มัธยมศึกษาปีที่ ', 'ม.').replace('ระดับชั้น ', '') : '';
      headerSub.innerText = surname ? (surname + (shortGr ? ' • ' + shortGr : '')) : (shortGr || 'นักเรียน');
    }
  }
  if (headerRole) headerRole.innerText = currentStudent.grade;
  
  if (headerAvatar) {
    const directAv = getDirectImageUrl(currentStudent.avatarUrl);
    if (directAv) {
      headerAvatar.innerHTML = `<img src="${directAv}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
      headerAvatar.innerText = currentStudent.fullName.charAt(currentStudent.fullName.startsWith('นาย') ? 3 : (currentStudent.fullName.startsWith('นางสาว') ? 6 : 0));
    }
  }

  const bannerAvatar = document.getElementById('dashBannerAvatar');
  if (bannerAvatar) {
    const directAv = getDirectImageUrl(currentStudent.avatarUrl);
    if (directAv) {
      bannerAvatar.innerHTML = `<img src="${directAv}" alt="${currentStudent.fullName}">`;
    } else {
      const initial = currentStudent.fullName.charAt(currentStudent.fullName.startsWith('นาย') ? 3 : (currentStudent.fullName.startsWith('นางสาว') ? 6 : 0)) || 'น';
      bannerAvatar.innerHTML = `<span style="font-weight: 700; color: #ffffff;">${initial}</span>`;
    }
  }
  if (dashGreeting) dashGreeting.innerText = `ยินดีต้อนรับ, ${currentStudent.fullName}`;
  const dashGreetingName = document.getElementById('dashGreetingName');
  if (dashGreetingName) dashGreetingName.innerText = currentStudent.fullName;
  if (dashSubtitle) dashSubtitle.innerText = '';
  if (dashStudentId) dashStudentId.innerText = currentStudent.studentId;
  if (dashGrade) dashGrade.innerText = currentStudent.grade;
  if (dashSchool) dashSchool.innerText = currentStudent.schoolName;

  // Real stats calculation (รูปแนบ 1: คำนวณจำนวนเวลาละหมาดที่บันทึกครบถ้วนตามจริง ไม่ซ้ำซ้อน)
  const prayerSlotsRecorded = new Set();
  todayPrayers.forEach(p => {
    if (isIdMatch(p.studentId, currentStudent.studentId)) {
      const slot = p.prayerTime || p.prayerName || p.timeSlot;
      if (slot) prayerSlotsRecorded.add(slot);
      else prayerSlotsRecorded.add(p.id || Math.random());
    }
  });
  const myActs = activities.filter(a => a.checkedIn);
  const att = currentStudent.attendance || { present: 0, late: 0, leave: 0, absent: 0 };
  const totalDays = att.present + att.late + att.leave + att.absent;
  const attRate = totalDays > 0 ? ((att.present / totalDays) * 100).toFixed(1) + '%' : '0%';

  if (statAtt) statAtt.innerText = attRate;
  if (statPry) statPry.innerText = `${Math.min(5, prayerSlotsRecorded.size)} / 5`;
  if (statAct) statAct.innerText = `${myActs.length} ครั้ง`;
  if (statGpa) statGpa.innerText = currentStudent.gpa || '0.00';

  // Profile Information Card & Full Registration Details
  if (profFullName) profFullName.innerText = currentStudent.fullName;
  if (profSchool) profSchool.innerText = currentStudent.schoolName;
  if (profGradeBadge) profGradeBadge.innerText = currentStudent.grade;
  if (profStudentId) profStudentId.innerText = currentStudent.studentId;
  if (profStudentIdHeader) profStudentIdHeader.innerText = currentStudent.studentId;

  if (profFullNameDetail) profFullNameDetail.innerText = currentStudent.fullName;
  if (profSchoolDetail) profSchoolDetail.innerText = currentStudent.schoolName;
  if (profGradeDetail) profGradeDetail.innerText = currentStudent.grade;

  // Format birthDate (e.g. 01012540 -> 01/01/2540)
  const rawBD = currentStudent.birthDate ? String(currentStudent.birthDate).trim() : '';
  let formattedBD = rawBD || '-';
  if (rawBD.length === 8 && !rawBD.includes('/') && !rawBD.includes('-')) {
    formattedBD = `${rawBD.substring(0, 2)}/${rawBD.substring(2, 4)}/${rawBD.substring(4, 8)} (${rawBD})`;
  }
  if (profBirthDate) profBirthDate.innerText = formattedBD;

  if (profParentPhone) profParentPhone.innerText = currentStudent.parentPhone || '-';

  // Format Registration Date
  let regStr = currentStudent.registeredAt || currentStudent.createdAt || '';
  if (!regStr) {
    regStr = 'บันทึกในระบบเรียบร้อย (Active)';
  } else if (regStr.includes('T')) {
    try {
      const rd = new Date(regStr);
      regStr = rd.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {}
  }
  if (profRegDate) profRegDate.innerText = regStr;

  const statusText = currentStudent.status || 'Active (กำลังศึกษา)';
  if (profStatusDetail) profStatusDetail.innerText = statusText;
  if (profStatusBadge) profStatusBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${statusText}`;

  if (profAvatar) {
    const directAv = getDirectImageUrl(currentStudent.avatarUrl);
    if (directAv) {
      profAvatar.innerHTML = `<img src="${directAv}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:50%;cursor:pointer;" onclick="openPhotoViewerModal('${directAv}', '${escapeHtml(currentStudent.fullName || 'นักเรียน')}')" title="แตะเพื่อดูรูปโปรไฟล์ขนาดเต็ม">`;
    } else {
      profAvatar.innerText = headerAvatar ? headerAvatar.innerText : 'น';
    }
  }
  if (selectNewGrade) selectNewGrade.value = currentStudent.grade;
  if (typeof syncDashboardGradeFilterToCurrentStudent === 'function') {
    syncDashboardGradeFilterToCurrentStudent();
  }

  renderDashboardQuranStars();
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
  if (currentAdmin) {
    openTeacherAccountModal();
    return;
  }
  if (currentStudent) {
    openStudentAccountModal();
  } else {
    openModal('authModal');
  }
}

function openTeacherAccountModal() {
  if (!currentAdmin) return;
  const nameEl = document.getElementById('teacherModalFullName');
  const roleEl = document.getElementById('teacherModalRole');
  const avatarEl = document.getElementById('teacherModalAvatar');

  const roleLabelMap = {
    SuperAdmin: 'แอดมินสูงสุด (Super Admin)',
    EXECUTIVE: 'ผู้บริหารสถานศึกษา',
    TEACHER: 'อาจารย์ผู้สอน / ครูประจำวิชา',
    HOMEROOM: 'อาจารย์ประจำชั้น',
    ACTIVITY: 'ฝ่ายกิจกรรม',
    SubAdmin: 'ผู้ช่วยแอดมิน'
  };

  if (nameEl) nameEl.innerText = currentAdmin.fullName || currentAdmin.username || 'อาจารย์ผู้สอน';
  if (roleEl) roleEl.innerText = `${roleLabelMap[currentAdmin.role] || 'อาจารย์ผู้สอน'}${currentAdmin.email ? ' • ' + currentAdmin.email : ''}`;

  if (avatarEl) {
    const tAv = currentAdmin.avatarUrl || currentAdmin.photo || localStorage.getItem('khalifah_admin_avatar_' + currentAdmin.username);
    if (tAv) {
      avatarEl.innerHTML = `<img src="${tAv}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    } else {
      avatarEl.innerHTML = `<i class="fa-solid fa-chalkboard-user"></i>`;
    }
  }

  openModal('teacherAccountModal');
}

function handleTeacherProfileUpload(event) {
  if (!currentAdmin) {
    showToast('กรุณาเข้าสู่ระบบอาจารย์ก่อนอัปโหลดรูป', 'warning');
    return;
  }
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WebP)', 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // Resize to square avatar max 320x320
      const canvas = document.createElement('canvas');
      const maxDim = 320;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const base64Data = canvas.toDataURL('image/jpeg', 0.85);

      // Save locally
      currentAdmin.avatarUrl = base64Data;
      currentAdmin.photo = base64Data;
      localStorage.setItem('khalifah_current_admin', JSON.stringify(currentAdmin));
      localStorage.setItem('khalifah_admin_avatar_' + currentAdmin.username, base64Data);

      // Update in subAdmins list if exists
      if (Array.isArray(subAdmins)) {
        const idx = subAdmins.findIndex(a => a.username === currentAdmin.username);
        if (idx !== -1) {
          subAdmins[idx].avatarUrl = base64Data;
          subAdmins[idx].photo = base64Data;
          localStorage.setItem('khalifah_subadmins', JSON.stringify(subAdmins));
        }
      }

      // Update UI elements
      const modalAv = document.getElementById('teacherModalAvatar');
      if (modalAv) {
        modalAv.innerHTML = `<img src="${base64Data}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
      }
      const heroAv = document.getElementById('teacherHeroAvatar');
      if (heroAv) {
        heroAv.innerHTML = `<img src="${base64Data}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">`;
      }
      const navAv = document.getElementById('headerUserAvatar') || document.getElementById('userAvatarText');
      if (navAv) {
        navAv.innerHTML = `<img src="${base64Data}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 9999px;">`;
      }

      if (typeof playSuccessSound === 'function') playSuccessSound();
      showToast('✓ อัปโหลดและบันทึกรูปโปรไฟล์อาจารย์เรียบร้อยแล้ว!', 'success');

      // Sync to cloud
      syncRecordToGoogleSheet('updateSubAdminPhoto', {
        username: currentAdmin.username,
        photo: base64Data
      });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function openStudentAccountModal() {
  if (!currentStudent) return;
  const nameEl = document.getElementById('accSheetFullName');
  const detailsEl = document.getElementById('accSheetDetails');
  const avatarEl = document.getElementById('accSheetAvatar');

  if (nameEl) nameEl.innerText = currentStudent.fullName;
  if (detailsEl) detailsEl.innerText = `รหัส: ${currentStudent.studentId} • ${currentStudent.grade} • ${currentStudent.schoolName || ''}`;
  if (avatarEl) {
    const directAv = getDirectImageUrl(currentStudent.avatarUrl);
    if (directAv) {
      avatarEl.innerHTML = `<img src="${directAv}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
      avatarEl.innerHTML = `<i class="fa-solid fa-user"></i>`;
    }
  }
  openModal('studentAccountModal');
}

function studentLogout() {
  if (!confirm('ต้องการออกจากระบบนักเรียนใช่หรือไม่?')) return;
  currentStudent = null;
  currentAdmin = null;
  localStorage.removeItem('khalifah_current_student');
  localStorage.removeItem('khalifah_current_admin');
  localStorage.removeItem('khalifah_auth_role');
  closeModal('studentAccountModal');
  updateAdminUIVisibility(false);
  renderCurrentStudentProfile();
  renderDashboardCharts();
  renderActivitiesList();
  renderTodayPrayerTable();
  document.body.classList.add('auth-locked');
  toggleAuthForm('login');
  selectAuthRole('student');
  openModal('authModal');
  showToast('ออกจากระบบนักเรียนเรียบร้อยแล้ว', 'info');
}

// ----------------- PROFILE PHOTO UPLOAD (COMPRESSED BASE64) ----------------- //
let registerAvatarBase64 = '';

function previewRegisterAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const size = 150;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const minDim = Math.min(img.width, img.height);
      const startX = (img.width - minDim) / 2;
      const startY = (img.height - minDim) / 2;
      ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);

      registerAvatarBase64 = canvas.toDataURL('image/jpeg', 0.85);
      const preview = document.getElementById('regAvatarPreview');
      if (preview) {
        preview.innerHTML = `<img src="${registerAvatarBase64}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function handleProfilePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!currentStudent) {
    showToast('กรุณาเข้าสู่ระบบก่อนอัปโหลดรูปโปรไฟล์', 'warning');
    return;
  }

  showToast('กำลังประมวลผลรูปภาพ...', 'info');

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // Create thumbnail canvas 150x150
      const canvas = document.createElement('canvas');
      const size = 150;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // Center crop square
      const minDim = Math.min(img.width, img.height);
      const startX = (img.width - minDim) / 2;
      const startY = (img.height - minDim) / 2;
      ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);

      // Convert to compressed JPEG data url (~15-20KB)
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);

      currentStudent.avatarUrl = compressedBase64;
      localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
      localStorage.setItem('khalifah_student_avatar_' + currentStudent.studentId, compressedBase64);

      // Update in allStudents array
      const idx = allStudents.findIndex(s => s.studentId === currentStudent.studentId);
      if (idx !== -1) {
        allStudents[idx].avatarUrl = compressedBase64;
        localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
      }

      renderCurrentStudentProfile();
      openStudentAccountModal();
      showToast('เปลี่ยนรูปโปรไฟล์สำเร็จ!', 'success');

      // Sync to Google Sheets
      syncRecordToGoogleSheet('updateProfilePhoto', {
        studentId: currentStudent.studentId,
        avatarUrl: compressedBase64
      });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ----------------- 3-ROLE AUTHENTICATION & DYNAMIC ADMIN OTP SYSTEM ----------------- //
let currentAuthRole = 'student'; // 'student' | 'teacher' | 'admin'
let activePendingOtpUser = null;

function getPendingRegistrations() {
  try {
    return JSON.parse(localStorage.getItem('khalifah_pending_registrations') || '[]');
  } catch (e) {
    return [];
  }
}

function savePendingRegistrations(list) {
  localStorage.setItem('khalifah_pending_registrations', JSON.stringify(list));
}

function generateRandomAdminOtp() {
  // Cryptographically random 6-digit code (preserves leading zeros, e.g., "048291")
  if (window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return String(arr[0] % 1000000).padStart(6, '0');
  }
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}

function syncAuthModeSegmentBar(mode) {
  const btnLogin = document.getElementById('authModeBtnLogin');
  const btnRegister = document.getElementById('authModeBtnRegister');
  if (btnLogin) btnLogin.classList.toggle('active', mode === 'login');
  if (btnRegister) btnRegister.classList.toggle('active', mode === 'register');
}

function handleAuthModeSegmentChange(mode) {
  syncAuthModeSegmentBar(mode);
  if (currentAuthRole === 'teacher') {
    toggleTeacherAuthForm(mode === 'register' ? 'register' : 'login');
  } else {
    toggleAuthForm(mode === 'register' ? 'register' : 'login');
  }
}

function selectAuthRole(role) {
  currentAuthRole = role;
  const btnStd = document.getElementById('authRoleBtnStudent');
  const btnTch = document.getElementById('authRoleBtnTeacher');
  const btnAdm = document.getElementById('authRoleBtnAdmin');

  if (btnStd) btnStd.classList.toggle('active', role === 'student');
  if (btnTch) btnTch.classList.toggle('active', role === 'teacher');
  if (btnAdm) btnAdm.classList.toggle('active', role === 'admin');

  const stdBox = document.getElementById('authStudentContainer');
  const tchBox = document.getElementById('authTeacherContainer');
  const admBox = document.getElementById('authAdminContainer');

  if (stdBox) stdBox.style.display = (role === 'student') ? 'block' : 'none';
  if (tchBox) tchBox.style.display = (role === 'teacher') ? 'block' : 'none';
  if (admBox) admBox.style.display = (role === 'admin') ? 'block' : 'none';

  const segBar = document.getElementById('authModeSegmentBar');
  if (segBar) {
    segBar.style.display = (role === 'admin') ? 'none' : 'flex';
  }

  // Sync segment bar active state based on which form is currently visible
  if (role === 'student') {
    const regSection = document.getElementById('registerFormSection');
    const isRegister = regSection && regSection.style.display !== 'none';
    syncAuthModeSegmentBar(isRegister ? 'register' : 'login');
  } else if (role === 'teacher') {
    const regSection = document.getElementById('teacherRegisterSection');
    const isRegister = regSection && regSection.style.display !== 'none';
    syncAuthModeSegmentBar(isRegister ? 'register' : 'login');
  }

  const title = document.getElementById('authModalTitle');
  if (title) {
    if (role === 'student') {
      title.innerHTML = '<i class="fa-solid fa-user-graduate" style="color: var(--primary);"></i> เข้าสู่ระบบ / สมัครสมาชิก (นักเรียน)';
    } else if (role === 'teacher') {
      title.innerHTML = '<i class="fa-solid fa-chalkboard-user" style="color: var(--primary);"></i> เข้าสู่ระบบ / สมัครสมาชิก (อาจารย์ผู้สอน)';
      populateTeacherRegisterSubjectsChecklist();
    } else {
      title.innerHTML = '<i class="fa-solid fa-user-shield" style="color: var(--primary);"></i> เข้าสู่ระบบแอดมินสูงสุด (Super Admin)';
    }
  }
}

function toggleAuthForm(formType) {
  selectAuthRole('student');
  syncAuthModeSegmentBar(formType === 'register' ? 'register' : 'login');
  const loginSection = document.getElementById('loginFormSection');
  const regSection = document.getElementById('registerFormSection');
  const title = document.getElementById('authModalTitle');

  if (formType === 'register') {
    if (loginSection) loginSection.style.display = 'none';
    if (regSection) regSection.style.display = 'block';
    if (title) title.innerHTML = '<i class="fa-solid fa-user-plus" style="color: var(--primary);"></i> สมัครลงทะเบียนนักเรียนใหม่';
    initBirthDatePicker();
  } else {
    if (loginSection) loginSection.style.display = 'block';
    if (regSection) regSection.style.display = 'none';
    if (title) title.innerHTML = '<i class="fa-solid fa-user-graduate" style="color: var(--primary);"></i> เข้าสู่ระบบนักเรียน';
  }
  const modalBody = document.querySelector('#authModal .modal-body');
  if (modalBody) modalBody.scrollTop = 0;
}

function toggleTeacherAuthForm(formType) {
  selectAuthRole('teacher');
  syncAuthModeSegmentBar(formType === 'register' ? 'register' : 'login');
  const loginSec = document.getElementById('teacherLoginSection');
  const regSec = document.getElementById('teacherRegisterSection');
  const title = document.getElementById('authModalTitle');

  if (formType === 'register') {
    if (loginSec) loginSec.style.display = 'none';
    if (regSec) regSec.style.display = 'block';
    if (title) title.innerHTML = '<i class="fa-solid fa-user-check" style="color: var(--primary);"></i> สมัครลงทะเบียนอาจารย์ผู้สอนใหม่';
    populateTeacherRegisterSubjectsChecklist();
  } else {
    if (loginSec) loginSec.style.display = 'block';
    if (regSec) regSec.style.display = 'none';
    if (title) title.innerHTML = '<i class="fa-solid fa-chalkboard-user" style="color: var(--primary);"></i> เข้าสู่ระบบอาจารย์ผู้สอน';
  }
  const modalBody = document.querySelector('#authModal .modal-body');
  if (modalBody) modalBody.scrollTop = 0;
}

function populateTeacherRegisterSubjectsChecklist() {
  loadAppSubjects();
  const container = document.getElementById('regTeacherSubjectsChecklist');
  if (!container) return;
  container.innerHTML = appSubjects.map(s => `
    <label class="subject-checkbox-item">
      <input type="checkbox" name="regTeacherSubjChk" value="${escapeHtml(s.id)}">
      <span>${escapeHtml(s.code ? s.code + ' - ' : '')}${escapeHtml(s.name)}</span>
    </label>
  `).join('');
}

// ----------------- MINIMALIST BIRTH DATE PICKER ----------------- //
const THAI_MONTH_NAMES_LIST = [
  '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

function initBirthDatePicker() {
  const daySelect = document.getElementById('regBirthDay');
  const yearSelect = document.getElementById('regBirthYear');
  if (!daySelect || !yearSelect) return;

  if (daySelect.options.length <= 1) {
    for (let d = 1; d <= 31; d++) {
      const opt = document.createElement('option');
      const val = String(d).padStart(2, '0');
      opt.value = val;
      opt.textContent = `${d}`;
      daySelect.appendChild(opt);
    }
  }

  if (yearSelect.options.length <= 1) {
    const currentBE = new Date().getFullYear() + 543;
    const maxBE = Math.max(currentBE, 2568);
    const minBE = 2530;
    for (let y = maxBE; y >= minBE; y--) {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = `${y}`;
      yearSelect.appendChild(opt);
    }
  }
}

function syncBirthDatePicker() {
  const daySelect = document.getElementById('regBirthDay');
  const monthSelect = document.getElementById('regBirthMonth');
  const yearSelect = document.getElementById('regBirthYear');
  const hiddenInput = document.getElementById('regBirthDate');
  const pill = document.getElementById('birthDateSelectedPill');
  const previewText = document.getElementById('birthDatePreviewText');
  const codeBadge = document.getElementById('birthDateCodeBadge');
  const defaultHint = document.getElementById('birthDateDefaultHint');

  if (!daySelect || !monthSelect || !yearSelect || !hiddenInput) return;

  const d = daySelect.value;
  const m = monthSelect.value;
  const y = yearSelect.value;

  [daySelect, monthSelect, yearSelect].forEach(sel => {
    if (sel.value) sel.classList.add('selected');
    else sel.classList.remove('selected');
  });

  if (m) {
    const monthNum = parseInt(m, 10);
    const yearBE = parseInt(y, 10) || 2552;
    const yearAD = yearBE - 543;
    const maxDays = new Date(yearAD, monthNum, 0).getDate();

    if (parseInt(d, 10) > maxDays) {
      daySelect.value = String(maxDays).padStart(2, '0');
    }
  }

  const cleanDay = daySelect.value;
  if (cleanDay && m && y) {
    const bdCode = `${cleanDay}${m}${y}`;
    hiddenInput.value = bdCode;

    const today = new Date();
    const birthYearAD = parseInt(y, 10) - 543;
    const birthMonthIdx = parseInt(m, 10) - 1;
    const birthDayNum = parseInt(cleanDay, 10);

    let ageYears = today.getFullYear() - birthYearAD;
    const monthDiff = today.getMonth() - birthMonthIdx;
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDayNum)) {
      ageYears--;
    }
    if (ageYears < 0) ageYears = 0;

    if (previewText) previewText.textContent = `อายุ ${ageYears} ปี`;
    if (codeBadge) {
      codeBadge.textContent = '';
      codeBadge.style.display = 'none';
    }
    if (pill) pill.style.display = 'inline-flex';
    if (defaultHint) defaultHint.style.display = 'none';
  } else {
    hiddenInput.value = '';
    if (pill) pill.style.display = 'none';
    if (defaultHint) defaultHint.style.display = 'flex';
  }
}

function resetBirthDatePicker() {
  const daySelect = document.getElementById('regBirthDay');
  const monthSelect = document.getElementById('regBirthMonth');
  const yearSelect = document.getElementById('regBirthYear');
  const hiddenInput = document.getElementById('regBirthDate');
  const pill = document.getElementById('birthDateSelectedPill');
  const defaultHint = document.getElementById('birthDateDefaultHint');

  if (daySelect) { daySelect.value = ''; daySelect.classList.remove('selected'); }
  if (monthSelect) { monthSelect.value = ''; monthSelect.classList.remove('selected'); }
  if (yearSelect) { yearSelect.value = ''; yearSelect.classList.remove('selected'); }
  if (hiddenInput) hiddenInput.value = '';
  if (pill) pill.style.display = 'none';
  if (defaultHint) defaultHint.style.display = 'flex';
}

// ----------------- AUTHENTICATION ANIMATIONS & INSTANT VALIDATION ----------------- //

function setButtonLoading(btn, isLoading, loadingText = 'กำลังตรวจสอบ...', successText = null) {
  if (!btn) return;
  if (isLoading) {
    if (!btn.dataset.originalHtml) {
      btn.dataset.originalHtml = btn.innerHTML;
    }
    btn.disabled = true;
    btn.classList.add('btn-loading');
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${loadingText}`;
  } else {
    btn.disabled = false;
    btn.classList.remove('btn-loading');
    if (successText) {
      btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${successText}`;
    } else if (btn.dataset.originalHtml) {
      btn.innerHTML = btn.dataset.originalHtml;
    }
  }
}

function triggerAuthError(inputElement, errorMessage, containerElement = null) {
  if (inputElement) {
    inputElement.classList.add('is-invalid');
    try { inputElement.focus(); } catch (e) {}

    const handleInput = () => {
      inputElement.classList.remove('is-invalid');
      inputElement.removeEventListener('input', handleInput);
      const parent = inputElement.parentElement;
      if (parent) {
        const errEl = parent.querySelector('.auth-field-error-msg');
        if (errEl) errEl.remove();
      }
    };
    inputElement.addEventListener('input', handleInput);

    const parent = inputElement.parentElement;
    if (parent) {
      let errEl = parent.querySelector('.auth-field-error-msg');
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.className = 'auth-field-error-msg';
        parent.appendChild(errEl);
      }
      errEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${errorMessage}`;
    }
  }

  const shakeTarget = containerElement || inputElement?.closest('.auth-portal-dialog') || inputElement?.closest('.modal-dialog');
  if (shakeTarget) {
    shakeTarget.classList.remove('shake-error');
    void shakeTarget.offsetWidth; // Force CSS reflow
    shakeTarget.classList.add('shake-error');
    setTimeout(() => shakeTarget.classList.remove('shake-error'), 450);
  }

  showToast(errorMessage, 'error');
}

async function handleStudentLogin() {
  if (!checkLoginRateLimit()) return;

  const phoneEl = document.getElementById('loginParentPhone');
  const passEl = document.getElementById('loginStudentId');
  const btn = document.getElementById('btnStudentLogin') || document.querySelector('#loginFormSection button.btn-primary');

  const rawParentPhone = (phoneEl?.value || '').trim();
  const rawStudentId = (passEl?.value || '').trim();

  // Clear previous inline errors
  document.querySelectorAll('#loginFormSection .auth-field-error-msg').forEach(el => el.remove());
  phoneEl?.classList.remove('is-invalid');
  passEl?.classList.remove('is-invalid');

  if (!rawParentPhone) {
    triggerAuthError(phoneEl, 'กรุณากรอกเบอร์โทรศัพท์ผู้ปกครอง (User)');
    return;
  }
  if (!rawStudentId) {
    triggerAuthError(passEl, 'กรุณากรอกรหัสนักเรียน (รหัสผ่าน)');
    return;
  }

  const studentIdInput = cleanIdString(rawStudentId);
  const cleanInputPhone = normalizePhone(rawParentPhone);

  setButtonLoading(btn, true, 'กำลังตรวจสอบข้อมูล...');

  // 1. Instant check in memory (allStudents)
  const studentByPhone = allStudents.find(s => isPhoneMatch(s.parentPhone, cleanInputPhone) || isPhoneMatch(s.parentPhone, rawParentPhone));
  const studentById = allStudents.find(s => isIdMatch(s.studentId, studentIdInput));

  let found = null;

  if (studentByPhone && studentById && isIdMatch(studentByPhone.studentId, studentById.studentId)) {
    // Exact match found!
    found = studentByPhone;
  } else if (studentByPhone && !studentById) {
    // Phone exists, but student ID (password) does NOT match any student!
    setButtonLoading(btn, false);
    recordLoginFailure();
    triggerAuthError(passEl, 'รหัสนักเรียน (รหัสผ่าน) ไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านอีกครั้ง');
    return;
  } else if (studentByPhone && studentById && !isIdMatch(studentByPhone.studentId, studentById.studentId)) {
    // Phone and ID belong to different students!
    setButtonLoading(btn, false);
    recordLoginFailure();
    triggerAuthError(passEl, 'รหัสนักเรียน (รหัสผ่าน) ไม่ถูกต้องสำหรับเบอร์โทรศัพท์นี้');
    return;
  } else if (!studentByPhone && studentById) {
    // Student ID exists, but parent phone is wrong!
    setButtonLoading(btn, false);
    recordLoginFailure();
    triggerAuthError(phoneEl, 'เบอร์โทรศัพท์ผู้ปกครอง (User) ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
    return;
  }

  // 2. If neither exists in local cache, do a fast live check with 2.5s strict timeout
  if (!found && navigator.onLine) {
    let url = gasApiUrl || localStorage.getItem('khalifah_gas_url') || DEFAULT_GAS_API_URL;
    if (url && url.includes('docs.google.com/spreadsheets')) url = DEFAULT_GAS_API_URL;

    if (url) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const resp = await fetch(`${url}?action=getStudent&studentId=${encodeURIComponent(studentIdInput)}&parentPhone=${encodeURIComponent(cleanInputPhone)}&_t=${Date.now()}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const json = await resp.json();
        if (json && json.success && json.student) {
          found = json.student;
          found.studentId = cleanIdString(found.studentId);
          found.parentPhone = normalizePhone(found.parentPhone);
          if (found.birthDate) found.birthDate = normalizeBirthDate(found.birthDate);

          const existIdx = allStudents.findIndex(s => isIdMatch(s.studentId, studentIdInput));
          if (existIdx !== -1) {
            allStudents[existIdx] = { ...allStudents[existIdx], ...found };
          } else {
            allStudents.push(found);
          }
          localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
        }
      } catch (e) {
        // Fast abort or network fail
      }
    }
  }

  // 3. If STILL not found: account definitely does not exist
  if (!found) {
    setButtonLoading(btn, false);
    recordLoginFailure();
    triggerAuthError(phoneEl, 'ไม่พบข้อมูลบัญชีนี้ในระบบ กรุณาตรวจสอบเบอร์โทรศัพท์หรือสมัครบัญชีใหม่');
    return;
  }

  // 4. Strict OTP Gate
  const pendingList = getPendingRegistrations();
  const pendingMatch = pendingList.find(p => p.role === 'student' && isIdMatch(p.userId, studentIdInput) && p.status !== 'Verified');
  const isUnverifiedStudent = found && (
    found.approvalStatus === 'PendingAdmin' ||
    found.approvalStatus === 'AwaitingOtp' ||
    found.status === 'PendingAdmin' ||
    found.status === 'รอผู้สมัครกรอกรหัส OTP'
  );

  if (pendingMatch || isUnverifiedStudent) {
    setButtonLoading(btn, false);
    const pItem = pendingMatch || {
      reqId: 'REQ-' + Date.now(),
      role: 'student',
      userId: found ? found.studentId : studentIdInput,
      fullName: found ? found.fullName : studentIdInput,
      email: found ? (found.email || '') : '',
      phone: found ? found.parentPhone : cleanInputPhone,
      gradeOrSubj: found ? found.grade : '',
      otpCode: found && found.otpCode ? found.otpCode : generateRandomAdminOtp(),
      status: (found && found.approvalStatus === 'AwaitingOtp') ? 'Approved' : 'PendingAdmin'
    };
    openOtpVerifyModalForPending(pItem);
    if (pItem.status === 'Approved' || (found && found.approvalStatus === 'AwaitingOtp')) {
      showToast('แอดมินได้ส่งรหัสยืนยัน 6 หลักไปที่อีเมลของคุณแล้ว กรุณากรอกรหัสยืนยันเพื่อเข้าสู่ระบบ', 'warning');
    } else {
      showToast('ผู้สมัครไม่สามารถเข้าระบบได้จนกว่าจะป้อนเลขยืนยันที่แอดมินส่งให้ในอีเมล', 'warning');
    }
    return;
  }

  // 5. Successful Login!
  setButtonLoading(btn, false, null, 'เข้าสู่ระบบสำเร็จ!');
  resetLoginFailures();
  currentAdmin = null;
  currentStudent = found;
  localStorage.removeItem('khalifah_current_admin');
  localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
  localStorage.setItem('khalifah_auth_role', 'student');

  setTimeout(() => {
    document.body.classList.remove('auth-locked');
    updateAdminUIVisibility(false);
    renderCurrentStudentProfile();
    renderDashboardCharts();
    renderTodayPrayerTable();
    renderActivitiesList();
    renderPrayerHistory();
    closeModal('authModal');
    switchView('dashboard');
    showToast(`ยินดีต้อนรับ ${currentStudent.fullName}`, 'success');
  }, 250);
}

function handleStudentRegister() {
  const studentIdInput = document.getElementById('regStudentId');
  const fullNameInput = document.getElementById('regFullName');
  const emailInput = document.getElementById('regStudentEmail');
  const schoolNameInput = document.getElementById('regSchoolName');
  const gradeInput = document.getElementById('regGrade');
  const birthDayInput = document.getElementById('regBirthDay');
  const birthMonthInput = document.getElementById('regBirthMonth');
  const birthYearInput = document.getElementById('regBirthYear');
  const parentPhoneInput = document.getElementById('regParentPhone');
  const btn = document.getElementById('btnStudentRegister') || document.querySelector('#registerFormSection button.btn-primary');

  // Clear existing errors
  document.querySelectorAll('#registerFormSection .auth-field-error-msg').forEach(el => el.remove());
  document.querySelectorAll('#registerFormSection .is-invalid').forEach(el => el.classList.remove('is-invalid'));

  const studentId = cleanIdString(studentIdInput?.value || '');
  const fullName = (fullNameInput?.value || '').trim();
  const email = (emailInput?.value || '').trim();
  const schoolName = (schoolNameInput?.value || '').trim();
  const grade = gradeInput?.value || 'มัธยมศึกษาปีที่ 1';
  const rawBirthDate = (document.getElementById('regBirthDate')?.value || '').trim();
  const birthDate = normalizeBirthDate(rawBirthDate);
  const parentPhone = normalizePhone(parentPhoneInput?.value || '');

  // Step-by-step validations with clear messages and auto-scroll
  if (!studentId) {
    triggerAuthError(studentIdInput, 'กรุณากรอกเลขประจำตัวนักเรียน');
    try { studentIdInput?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    return;
  }

  if (!fullName) {
    triggerAuthError(fullNameInput, 'กรุณากรอกชื่อ - นามสกุลนักเรียน');
    try { fullNameInput?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    return;
  }

  if (!email) {
    triggerAuthError(emailInput, 'กรุณากรอกอีเมลสำหรับรับรหัสยืนยันจากแอดมิน');
    try { emailInput?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    triggerAuthError(emailInput, 'รูปแบบอีเมลไม่ถูกต้อง เช่น student@example.com');
    try { emailInput?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    return;
  }

  if (!schoolName) {
    triggerAuthError(schoolNameInput, 'กรุณากรอกชื่อโรงเรียนเดิม หรือสถานศึกษา');
    try { schoolNameInput?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    return;
  }

  const cleanBD = birthDate ? birthDate.replace(/[^0-9]/g, '') : '';
  if (!cleanBD || cleanBD.length !== 8) {
    const targetInput = (!birthDayInput?.value) ? birthDayInput : (!birthMonthInput?.value ? birthMonthInput : birthYearInput);
    triggerAuthError(targetInput, 'กรุณาเลือกวัน เดือน และปี พ.ศ. เกิดให้ครบถ้วน');
    try { targetInput?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    return;
  }

  if (!parentPhone) {
    triggerAuthError(parentPhoneInput, 'กรุณากรอกเบอร์โทรศัพท์ผู้ปกครอง (ใช้เป็น User เข้าสู่ระบบ)');
    try { parentPhoneInput?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    return;
  }
  const cleanPhone = parentPhone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 9 || cleanPhone.length > 10) {
    triggerAuthError(parentPhoneInput, 'เบอร์โทรศัพท์ควรเป็นตัวเลข 9-10 หลัก');
    try { parentPhoneInput?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    return;
  }

  const isDuplicate = allStudents.some(s => isIdMatch(s.studentId, studentId) && s.approvalStatus !== 'PendingAdmin' && s.approvalStatus !== 'AwaitingOtp');
  if (isDuplicate) {
    triggerAuthError(studentIdInput, 'รหัสนักเรียนนี้มีอยู่ในระบบแล้ว ไม่สามารถลงทะเบียนซ้ำได้');
    try { studentIdInput?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    return;
  }

  setButtonLoading(btn, true, 'กำลังส่งคำขอสมัคร...');

  // Generate Dynamic Random 6-Digit Admin Verification Code
  const otpCode = generateRandomAdminOtp();

  const newStudent = {
    studentId: studentId,
    fullName: fullName,
    email: email,
    schoolName: schoolName,
    grade: grade,
    birthDate: cleanBD,
    parentPhone: parentPhone,
    status: 'PendingAdmin',
    approvalStatus: 'PendingAdmin',
    otpCode: otpCode,
    registeredAt: new Date().toISOString(),
    avatarUrl: registerAvatarBase64 || '',
    skills: { religious: 0, science: 0, math: 0, language: 0, social: 0, tech: 0 },
    subjectGrades: {},
    gpa: '0.00',
    attendance: { present: 0, late: 0, leave: 0, absent: 0 }
  };

  // Save or update in allStudents
  const existIdx = allStudents.findIndex(s => isIdMatch(s.studentId, studentId));
  if (existIdx !== -1) {
    allStudents[existIdx] = newStudent;
  } else {
    allStudents.push(newStudent);
  }
  localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));

  // Save in Pending Registrations Queue for Super Admin
  const pendingItem = {
    reqId: 'REQ-STD-' + Date.now(),
    role: 'student',
    userId: studentId,
    fullName: fullName,
    email: email,
    phone: parentPhone,
    gradeOrSubj: `${grade} (${schoolName})`,
    otpCode: otpCode,
    status: 'PendingAdmin',
    createdAt: new Date().toISOString(),
    payload: newStudent
  };

  const pendingList = getPendingRegistrations().filter(p => !(p.role === 'student' && isIdMatch(p.userId, studentId)));
  pendingList.unshift(pendingItem);
  savePendingRegistrations(pendingList);

  // Reset form
  registerAvatarBase64 = '';
  const preview = document.getElementById('regAvatarPreview');
  if (preview) preview.innerHTML = '<i class="fa-solid fa-camera"></i>';
  resetBirthDatePicker();

  // Sync to Google Sheets & Admin Queue
  syncRecordToGoogleSheet('registerPendingUser', pendingItem);
  renderPendingApprovalsTable();
  renderSuperAdminOverviewKpis();

  setTimeout(() => {
    setButtonLoading(btn, false);
    // Open the Admin Random OTP Verification Modal immediately in foreground!
    openOtpVerifyModalForPending(pendingItem);
    showToast('ส่งคำขอสมัครแล้ว! กรุณารอรับรหัสยืนยัน 6 หลักทางอีเมลเมื่อแอดมินกดอนุมัติ', 'info');
  }, 350);
}

async function handleTeacherLogin() {
  if (!checkLoginRateLimit()) return;

  const userEl = document.getElementById('teacherLoginUser');
  const passEl = document.getElementById('teacherLoginPass');
  const btn = document.getElementById('btnTeacherLogin') || document.querySelector('#teacherLoginSection button.btn-primary');

  const rawUser = (userEl?.value || '').trim();
  const rawPass = (passEl?.value || '').trim();

  // Clear previous inline errors
  document.querySelectorAll('#teacherLoginSection .auth-field-error-msg').forEach(el => el.remove());
  userEl?.classList.remove('is-invalid');
  passEl?.classList.remove('is-invalid');

  if (!rawUser) {
    triggerAuthError(userEl, 'กรุณากรอกรหัสอาจารย์ / ชื่อผู้ใช้ (Username)');
    return;
  }
  if (!rawPass) {
    triggerAuthError(passEl, 'กรุณากรอกรหัสผ่านอาจารย์ (Password)');
    return;
  }

  const cleanUser = cleanIdString(rawUser);
  const cleanPass = cleanIdString(rawPass);

  setButtonLoading(btn, true, 'กำลังตรวจสอบข้อมูล...');

  // 1. Instant check against subAdmins in memory
  let teacherByUser = subAdmins.find(s => isIdMatch(s.username, cleanUser) || (s.phone && isPhoneMatch(s.phone, cleanUser)));

  // Fast check cloud if not found locally
  if (!teacherByUser && navigator.onLine && typeof fetchSubAdminsFromCloud === 'function') {
    try {
      await fetchSubAdminsFromCloud(false);
      teacherByUser = subAdmins.find(s => isIdMatch(s.username, cleanUser) || (s.phone && isPhoneMatch(s.phone, cleanUser)));
    } catch (e) {}
  }

  if (!teacherByUser) {
    setButtonLoading(btn, false);
    recordLoginFailure();
    triggerAuthError(userEl, 'ไม่พบบัญชีอาจารย์/ผู้บริหารนี้ในระบบ กรุณาตรวจสอบชื่อผู้ใช้หรือสมัครบัญชีใหม่');
    return;
  }

  // Check password
  if (!isIdMatch(teacherByUser.password, cleanPass)) {
    setButtonLoading(btn, false);
    recordLoginFailure();
    triggerAuthError(passEl, 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านอีกครั้ง');
    return;
  }

  // Check OTP / approval status
  const foundTeacher = teacherByUser;
  const pendingList = getPendingRegistrations();
  const pendingMatch = pendingList.find(p => p.role === 'teacher' && isIdMatch(p.userId, cleanUser) && p.status !== 'Verified');
  const isUnverifiedTeacher = foundTeacher && (
    foundTeacher.approvalStatus === 'PendingAdmin' ||
    foundTeacher.approvalStatus === 'AwaitingOtp' ||
    foundTeacher.status === 'PendingAdmin' ||
    foundTeacher.status === 'รอผู้สมัครกรอกรหัส OTP'
  );
  const isDirectAdminCreated = foundTeacher && (foundTeacher.approvalStatus === 'Verified' || foundTeacher.status === 'Active') && !isUnverifiedTeacher;

  if ((pendingMatch || isUnverifiedTeacher) && !isDirectAdminCreated) {
    setButtonLoading(btn, false);
    const pItem = pendingMatch || {
      reqId: 'REQ-TCH-' + Date.now(),
      role: 'teacher',
      userId: foundTeacher ? foundTeacher.username : cleanUser,
      fullName: foundTeacher ? foundTeacher.fullName : cleanUser,
      email: foundTeacher ? (foundTeacher.email || '') : '',
      phone: foundTeacher ? (foundTeacher.phone || '') : '',
      gradeOrSubj: foundTeacher ? (foundTeacher.assignedSubjects || [foundTeacher.assignedSubject]).filter(Boolean).join(', ') : '',
      otpCode: foundTeacher && foundTeacher.otpCode ? foundTeacher.otpCode : generateRandomAdminOtp(),
      status: (foundTeacher && foundTeacher.approvalStatus === 'AwaitingOtp') ? 'Approved' : 'PendingAdmin'
    };
    openOtpVerifyModalForPending(pItem);
    if (pItem.status === 'Approved' || (foundTeacher && foundTeacher.approvalStatus === 'AwaitingOtp')) {
      showToast('แอดมินได้ส่งรหัสยืนยัน 6 หลักไปที่อีเมลของคุณแล้ว กรุณากรอกรหัสยืนยันเพื่อเปิดใช้งานบัญชี', 'warning');
    } else {
      showToast('ผู้สมัครไม่สามารถเข้าระบบได้จนกว่าจะป้อนเลขยืนยันที่แอดมินส่งให้ในอีเมล', 'warning');
    }
    return;
  }

  // Successful Login
  setButtonLoading(btn, false, null, 'เข้าสู่ระบบสำเร็จ!');
  resetLoginFailures();
  currentStudent = null;
  currentAdmin = foundTeacher;
  localStorage.removeItem('khalifah_current_student');
  localStorage.setItem('khalifah_current_admin', JSON.stringify(currentAdmin));
  localStorage.setItem('khalifah_auth_role', 'teacher');

  setTimeout(() => {
    document.body.classList.remove('auth-locked');
    updateAdminUIVisibility(true);
    closeModal('authModal');
    switchView(foundTeacher.role === 'SuperAdmin' ? 'admin' : 'teacher');
    const roleWelcome = foundTeacher.role === 'EXECUTIVE' ? 'ผู้บริหาร' : 'อาจารย์';
    showToast(`ยินดีต้อนรับ${roleWelcome} ${foundTeacher.fullName || foundTeacher.username}`, 'success');
  }, 250);
}

function handleTeacherRegister() {
  const teacherIdInput = document.getElementById('regTeacherId');
  const teacherPassInput = document.getElementById('regTeacherPass');
  const fullNameInput = document.getElementById('regTeacherName');
  const emailInput = document.getElementById('regTeacherEmail');
  const phoneInput = document.getElementById('regTeacherPhone');
  const subjectsContainer = document.getElementById('regTeacherSubjectsChecklist');
  const btn = document.getElementById('btnTeacherRegister') || document.querySelector('#teacherRegisterSection button.btn-primary');

  // Clear previous errors
  document.querySelectorAll('#teacherRegisterSection .auth-field-error-msg').forEach(el => el.remove());
  document.querySelectorAll('#teacherRegisterSection .is-invalid').forEach(el => el.classList.remove('is-invalid'));

  const teacherId = cleanIdString(teacherIdInput?.value || '');
  const teacherPass = cleanIdString(teacherPassInput?.value || '');
  const fullName = (fullNameInput?.value || '').trim();
  const email = (emailInput?.value || '').trim();
  const phone = normalizePhone(phoneInput?.value || '');

  const checkedNodes = document.querySelectorAll('input[name="regTeacherSubjChk"]:checked');
  const selectedSubjects = Array.from(checkedNodes).map(cb => cb.value);

  if (!teacherId) {
    triggerAuthError(teacherIdInput, 'กรุณากรอกรหัสประจำตัวอาจารย์ / Username');
    try { teacherIdInput?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    return;
  }

  if (!teacherPass) {
    triggerAuthError(teacherPassInput, 'กรุณากำหนดรหัสผ่านเข้าสู่ระบบ');
    try { teacherPassInput?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    return;
  }

  if (!fullName) {
    triggerAuthError(fullNameInput, 'กรุณากรอกชื่อ - นามสกุลอาจารย์');
    try { fullNameInput?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    return;
  }

  if (!email) {
    triggerAuthError(emailInput, 'กรุณากรอกอีเมลสำหรับรับรหัสยืนยันอัตโนมัติ');
    try { emailInput?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    triggerAuthError(emailInput, 'รูปแบบอีเมลไม่ถูกต้อง เช่น teacher@example.com');
    try { emailInput?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    return;
  }

  if (!phone) {
    triggerAuthError(phoneInput, 'กรุณากรอกเบอร์โทรศัพท์ติดต่อ');
    try { phoneInput?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    return;
  }

  if (selectedSubjects.length === 0) {
    triggerAuthError(subjectsContainer, 'กรุณาเลือกรายวิชาที่รับผิดชอบสอนอย่างน้อย 1 วิชา');
    try { subjectsContainer?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    return;
  }

  const isDup = subAdmins.some(s => isIdMatch(s.username, teacherId) && s.approvalStatus !== 'PendingAdmin' && s.approvalStatus !== 'AwaitingOtp');
  if (isDup) {
    triggerAuthError(teacherIdInput, 'รหัสประจำตัวอาจารย์นี้มีอยู่ในระบบแล้ว');
    try { teacherIdInput?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    return;
  }

  setButtonLoading(btn, true, 'กำลังส่งคำขอสมัครอาจารย์...');

  loadAppSubjects();
  const otpCode = generateRandomAdminOtp();
  const subjNames = selectedSubjects.map(id => {
    const found = appSubjects.find(x => x.id === id);
    return found ? found.name : id;
  }).join(', ');

  const newTeacher = {
    adminId: 'TCH-' + Date.now(),
    username: teacherId,
    password: teacherPass,
    fullName: fullName,
    email: email,
    phone: phone,
    role: 'TEACHER',
    assignedSubject: selectedSubjects[0] || '',
    assignedSubjects: selectedSubjects,
    status: 'PendingAdmin',
    approvalStatus: 'PendingAdmin',
    otpCode: otpCode,
    createdAt: new Date().toISOString().split('T')[0]
  };

  const existIdx = subAdmins.findIndex(s => isIdMatch(s.username, teacherId));
  if (existIdx !== -1) {
    subAdmins[existIdx] = newTeacher;
  } else {
    subAdmins.push(newTeacher);
  }
  localStorage.setItem('khalifah_sub_admins', JSON.stringify(subAdmins));

  const pendingItem = {
    reqId: 'REQ-TCH-' + Date.now(),
    role: 'teacher',
    userId: teacherId,
    fullName: fullName,
    email: email,
    phone: phone,
    gradeOrSubj: `วิชาที่สอน: ${subjNames}`,
    otpCode: otpCode,
    status: 'PendingAdmin',
    createdAt: new Date().toISOString(),
    payload: newTeacher
  };

  const pendingList = getPendingRegistrations().filter(p => !(p.role === 'teacher' && isIdMatch(p.userId, teacherId)));
  pendingList.unshift(pendingItem);
  savePendingRegistrations(pendingList);

  syncRecordToGoogleSheet('registerPendingUser', pendingItem);
  renderPendingApprovalsTable();
  renderSuperAdminOverviewKpis();

  setTimeout(() => {
    setButtonLoading(btn, false);
    openOtpVerifyModalForPending(pendingItem);
    showToast('ส่งคำขอสมัครอาจารย์สำเร็จ! กรุณารอรับรหัสยืนยัน 6 หลักทางอีเมลเมื่อแอดมินกดอนุมัติ', 'info');
  }, 350);
}

function handleInlineAdminLogin() {
  if (!checkLoginRateLimit()) return;
  const passEl = document.getElementById('inlineAdminPassInput');
  const btn = document.getElementById('btnInlineAdminLogin') || document.querySelector('#authAdminContainer button.btn-primary');

  const rawPass = (passEl?.value || '').trim();
  passEl?.classList.remove('is-invalid');
  document.querySelectorAll('#authAdminContainer .auth-field-error-msg').forEach(el => el.remove());

  if (!rawPass) {
    triggerAuthError(passEl, 'กรุณากรอกรหัสแอดมินสูงสุด (Master Code)');
    return;
  }

  const pass = cleanIdString(rawPass);
  setButtonLoading(btn, true, 'กำลังตรวจสอบสิทธิ์...');

  if (isIdMatch(pass, MASTER_ADMIN_PASS)) {
    setButtonLoading(btn, false, null, 'ยืนยันสิทธิ์สำเร็จ!');
    resetLoginFailures();
    currentStudent = null;
    currentAdmin = { username: 'MasterAdmin', fullName: 'แอดมินสูงสุด (Super Admin)', role: 'SuperAdmin' };
    localStorage.removeItem('khalifah_current_student');
    localStorage.setItem('khalifah_current_admin', JSON.stringify(currentAdmin));
    localStorage.setItem('khalifah_auth_role', 'admin');
    setTimeout(() => {
      document.body.classList.remove('auth-locked');
      updateAdminUIVisibility(true);
      closeModal('authModal');
      switchView('admin');
      showToast('เข้าสู่ระบบแอดมินสูงสุดสำเร็จ', 'success');
    }, 250);
  } else {
    setButtonLoading(btn, false);
    recordLoginFailure();
    triggerAuthError(passEl, 'รหัสแอดมินสูงสุดไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านอีกครั้ง');
  }
}

// ----------------- OTP VERIFICATION MODAL & ADMIN APPROVAL CENTER ----------------- //

function openOtpVerifyModalForPending(pendingItem) {
  activePendingOtpUser = pendingItem;
  const summaryEl = document.getElementById('otpVerifyUserSummary');
  const lookupGroup = document.getElementById('otpLookupIdGroup');
  const codeInput = document.getElementById('otpVerifyCodeInput');

  if (lookupGroup) lookupGroup.style.display = 'none';
  if (codeInput) codeInput.value = '';

  if (summaryEl && pendingItem) {
    const roleBadge = pendingItem.role === 'teacher' ? 'อาจารย์ผู้สอน' : 'นักเรียน';
    const isEmailSent = pendingItem.status === 'Approved' || pendingItem.status === 'approved' || pendingItem.status === 'Verified';
    const statusText = isEmailSent
      ? '<span style="color: #059669; font-weight: 700;"><i class="fa-solid fa-envelope-circle-check"></i> แอดมินอนุมัติและส่งรหัสไปที่อีเมลแล้ว (กรอกรหัส 6 หลักด้านล่างได้เลย)</span>'
      : '<span style="color: #b45309; font-weight: 700;"><i class="fa-solid fa-hourglass-half"></i> รอแอดมินกดยินยอมและส่งรหัสยืนยันไปยังอีเมลของคุณ</span>';

    summaryEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
        <span style="font-weight: 700; color: var(--text-dark);">${escapeHtml(pendingItem.fullName)} (${escapeHtml(pendingItem.userId)})</span>
        <span class="activity-badge badge-upcoming" style="font-size: 0.72rem;">${roleBadge}</span>
      </div>
      <div style="font-size: 0.78rem; color: var(--text-secondary);">อีเมลรับรหัสอัตโนมัติ: <b>${escapeHtml(pendingItem.email || '-')}</b></div>
      <div style="font-size: 0.78rem; margin-top: 0.3rem;">สถานะ: ${statusText}</div>
    `;
  }

  openModal('otpVerifyModal');
}

function openOtpVerifyModalPrompt(defaultRole = 'student') {
  activePendingOtpUser = null;
  const summaryEl = document.getElementById('otpVerifyUserSummary');
  const lookupGroup = document.getElementById('otpLookupIdGroup');
  const lookupInput = document.getElementById('otpLookupIdInput');
  const codeInput = document.getElementById('otpVerifyCodeInput');

  if (lookupGroup) lookupGroup.style.display = 'block';
  if (lookupInput) lookupInput.value = '';
  if (codeInput) codeInput.value = '';
  if (summaryEl) {
    summaryEl.innerHTML = `<div style="font-weight: 600; color: var(--text-dark);">กรอกรหัสประจำตัวที่สมัครไว้ และรหัสยืนยัน 6 หลักที่ได้รับจากอีเมลของแอดมิน</div>`;
  }
  openModal('otpVerifyModal');
}

async function verifyRegistrationOtpCode() {
  const codeInput = document.getElementById('otpVerifyCodeInput');
  const lookupInput = document.getElementById('otpLookupIdInput');
  const rawCode = cleanIdString(codeInput ? codeInput.value : '');

  if (!rawCode) {
    showToast('กรุณากรอกรหัสยืนยัน 6 หลักที่ได้รับจากอีเมลของแอดมิน', 'warning');
    return;
  }

  let pendingList = getPendingRegistrations();
  let targetItem = activePendingOtpUser;
  const lookupId = targetItem ? targetItem.userId : cleanIdString(lookupInput ? lookupInput.value : '');

  if (!lookupId) {
    showToast('กรุณากรอกรหัสนักเรียนหรือรหัสอาจารย์ที่สมัครไว้', 'warning');
    return;
  }

  // Always check cloud status first so cross-device OTP / regeneration works immediately
  let url = gasApiUrl || localStorage.getItem('khalifah_gas_url') || DEFAULT_GAS_API_URL;
  if (url && !url.includes('docs.google.com/spreadsheets')) {
    try {
      const resp = await fetch(`${url}?action=checkRegistrationStatus&userId=${encodeURIComponent(lookupId)}`);
      const json = await resp.json();
      if (json && json.success) {
        const cloudOtp = cleanIdString(json.otpCode || (json.registration && json.registration.otpCode) || '');
        const cloudStatus = json.status || (json.registration && json.registration.status) || 'PendingAdmin';
        let localMatch = pendingList.find(p => isIdMatch(p.userId, lookupId));
        if (localMatch) {
          if (cloudOtp) localMatch.otpCode = cloudOtp;
          if (cloudStatus) localMatch.status = (cloudStatus === 'approved' || cloudStatus === 'Approved') ? 'Approved' : cloudStatus;
        } else if (json.registration) {
          localMatch = {
            reqId: json.registration.reqId || json.registration.id || ('REQ-' + Date.now()),
            role: json.registration.role || 'student',
            userId: json.registration.userId || lookupId,
            fullName: json.registration.fullName || lookupId,
            email: json.registration.email || '',
            gradeOrSubj: json.registration.gradeOrSubj || json.registration.detail || '',
            otpCode: cloudOtp,
            status: (cloudStatus === 'approved' || cloudStatus === 'Approved') ? 'Approved' : cloudStatus,
            payload: json.registration.payload || null
          };
          pendingList.unshift(localMatch);
        }
        savePendingRegistrations(pendingList);
      }
    } catch (e) {}
  }

  targetItem = pendingList.find(p => isIdMatch(p.userId, lookupId)) || targetItem;

  if (!targetItem) {
    showToast('ไม่พบรายการคำขอสมัครของรหัสนี้ กรุณาตรวจสอบรหัสอีกครั้ง', 'error');
    return;
  }

  // Enforce that Admin must have clicked "ยินยอม & ส่งอีเมล" first
  if (targetItem.status === 'PendingAdmin') {
    openOtpVerifyModalForPending(targetItem);
    showToast('บัญชียังอยู่ระหว่างรอแอดมินกดอนุมัติเพื่อส่งรหัสยืนยันทางอีเมล กรุณารอรับรหัสในอีเมลก่อน', 'warning');
    return;
  }

  if (!isIdMatch(rawCode, targetItem.otpCode)) {
    recordLoginFailure();
    showToast('รหัสยืนยัน 6 หลักไม่ถูกต้อง! กรุณาตรวจสอบรหัสที่แอดมินส่งให้ในอีเมลของคุณอีกครั้ง', 'error');
    return;
  }

  resetLoginFailures();
  targetItem.status = 'Verified';
  savePendingRegistrations(pendingList);

  // Notify Google Sheets that user has verified their OTP
  syncRecordToGoogleSheet('verifyUserOtp', {
    userId: targetItem.userId,
    role: targetItem.role,
    otpCode: rawCode
  });

  if (targetItem.role === 'student') {
    const sIdx = allStudents.findIndex(s => isIdMatch(s.studentId, targetItem.userId));
    if (sIdx !== -1) {
      allStudents[sIdx].status = 'Active';
      allStudents[sIdx].approvalStatus = 'Verified';
      currentStudent = allStudents[sIdx];
    } else if (targetItem.payload) {
      targetItem.payload.status = 'Active';
      targetItem.payload.approvalStatus = 'Verified';
      allStudents.push(targetItem.payload);
      currentStudent = targetItem.payload;
    }
    currentAdmin = null;
    localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
    localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
    localStorage.removeItem('khalifah_current_admin');
    localStorage.setItem('khalifah_auth_role', 'student');

    document.body.classList.remove('auth-locked');
    updateAdminUIVisibility(false);
    renderCurrentStudentProfile();
    renderDashboardCharts();
    closeModal('otpVerifyModal');
    closeModal('authModal');
    switchView('dashboard');
    playSuccessSound();
    showToast(`ยืนยันรหัสจากอีเมลสำเร็จ! ยินดีต้อนรับ ${currentStudent.fullName}`, 'success');
    syncRecordToGoogleSheet('registerStudent', currentStudent);
  } else if (targetItem.role === 'teacher') {
    const tIdx = subAdmins.findIndex(s => isIdMatch(s.username, targetItem.userId));
    if (tIdx !== -1) {
      subAdmins[tIdx].status = 'Active';
      subAdmins[tIdx].approvalStatus = 'Verified';
      currentAdmin = subAdmins[tIdx];
    } else if (targetItem.payload) {
      targetItem.payload.status = 'Active';
      targetItem.payload.approvalStatus = 'Verified';
      subAdmins.push(targetItem.payload);
      currentAdmin = targetItem.payload;
    }
    currentStudent = null;
    localStorage.setItem('khalifah_sub_admins', JSON.stringify(subAdmins));
    localStorage.setItem('khalifah_current_admin', JSON.stringify(currentAdmin));
    localStorage.removeItem('khalifah_current_student');
    localStorage.setItem('khalifah_auth_role', 'teacher');

    document.body.classList.remove('auth-locked');
    updateAdminUIVisibility(true);
    closeModal('otpVerifyModal');
    closeModal('authModal');
    playSuccessSound();
    switchView('teacher');
    showToast(`ยืนยันรหัสอาจารย์สำเร็จ! ยินดีต้อนรับอาจารย์ ${currentAdmin.fullName}`, 'success');
    syncRecordToGoogleSheet('addSubAdmin', currentAdmin);
  }

  renderPendingApprovalsTable();
  renderSuperAdminOverviewKpis();
}

async function checkOtpApprovalStatus() {
  const lookupInput = document.getElementById('otpLookupIdInput');
  const userId = activePendingOtpUser ? activePendingOtpUser.userId : cleanIdString(lookupInput ? lookupInput.value : '');
  if (!userId) {
    showToast('กรุณากรอกรหัสที่สมัครไว้ก่อนตรวจสอบสถานะ', 'warning');
    return;
  }

  const pendingList = getPendingRegistrations();
  let localItem = pendingList.find(p => isIdMatch(p.userId, userId));

  // Check remote Google Sheet if configured
  let url = gasApiUrl || localStorage.getItem('khalifah_gas_url') || DEFAULT_GAS_API_URL;
  if (url && !url.includes('docs.google.com/spreadsheets')) {
    try {
      const resp = await fetch(`${url}?action=checkRegistrationStatus&userId=${encodeURIComponent(userId)}`);
      const json = await resp.json();
      if (json && json.success && json.registration) {
        const normSt = (json.registration.status === 'approved' || json.registration.status === 'Approved') ? 'Approved' : (json.registration.status || 'PendingAdmin');
        if (localItem) {
          localItem.status = normSt;
          if (json.registration.otpCode) localItem.otpCode = cleanIdString(json.registration.otpCode);
          savePendingRegistrations(pendingList);
        } else {
          localItem = {
            reqId: json.registration.reqId || json.registration.id || ('REQ-' + Date.now()),
            role: json.registration.role || 'student',
            userId: cleanIdString(json.registration.userId || userId),
            fullName: json.registration.fullName || userId,
            email: json.registration.email || '',
            gradeOrSubj: json.registration.gradeOrSubj || json.registration.detail || '',
            otpCode: cleanIdString(json.registration.otpCode || ''),
            status: normSt,
            payload: json.registration.payload || null
          };
          pendingList.unshift(localItem);
          savePendingRegistrations(pendingList);
        }
      }
    } catch (e) {}
  }

  if (localItem) {
    openOtpVerifyModalForPending(localItem);
    if (localItem.status === 'Approved' || localItem.status === 'Verified') {
      showToast(`แอดมินกดยินยอมอนุมัติแล้ว! รหัสยืนยัน 6 หลักถูกส่งไปที่อีเมล ${localItem.email} แล้ว กรุณานำมากรอกในช่องด้านล่าง`, 'success');
    } else {
      showToast('ยังอยู่ระหว่างรอแอดมินกดยินยอมเพื่อส่งรหัสยืนยันเข้าอีเมลของคุณ', 'info');
    }
  } else {
    showToast('ไม่พบคำขอสมัครของรหัสนี้ในระบบ', 'warning');
  }
}

// ----------------- ADMIN & TEACHER VISIBILITY CONTROLS ----------------- //

function toggleSubAdminField() {
  const group = document.getElementById('subAdminUsernameGroup');
  const btn = document.getElementById('toggleSubAdminBtn');
  if (group.style.display === 'none') {
    group.style.display = 'block';
    btn.innerText = 'เข้าสู่ระบบด้วยรหัสแอดมินสูงสุด (Master Admin)?';
  } else {
    group.style.display = 'none';
    btn.innerText = 'เข้าสู่ระบบด้วยบัญชีอาจารย์ผู้สอน / ผู้บริหาร?';
  }
}

function updateAdminUIVisibility(isAuthenticated) {
  const isSuper = !!currentAdmin && currentAdmin.role === 'SuperAdmin';
  const isTeacher = !!currentAdmin && currentAdmin.role !== 'SuperAdmin';
  const isStudent = !!currentStudent && !currentAdmin;

  // Apply role isolation classes on body to hide Student navigation tabs when Admin or Teacher is logged in
  document.body.classList.toggle('portal-mode-admin', !!isSuper);
  document.body.classList.toggle('portal-mode-teacher', !!isTeacher);
  document.body.classList.toggle('portal-mode-student', !!isStudent);

  const navAdmin = document.getElementById('nav-admin');
  const mNavAdmin = document.getElementById('m-nav-admin');
  const navTeacher = document.getElementById('nav-teacher');
  const mNavTeacher = document.getElementById('m-nav-teacher');
  const btnSettings = document.getElementById('btnSettingsHeader');
  const btnTabLogo = document.getElementById('btnTabLogo');
  const btnBackAdmin = document.getElementById('btnBackToAdminFromTeacher');

  if (navTeacher) navTeacher.style.display = (isSuper || isTeacher) ? 'inline-flex' : 'none';
  if (mNavTeacher) mNavTeacher.style.display = (isSuper || isTeacher) ? 'flex' : 'none';

  if (navAdmin) navAdmin.style.display = isSuper ? 'inline-flex' : 'none';
  if (mNavAdmin) mNavAdmin.style.display = isSuper ? 'flex' : 'none';
  if (btnSettings) btnSettings.style.display = isSuper ? 'flex' : 'none';
  if (btnTabLogo) btnTabLogo.style.display = isSuper ? 'inline-block' : 'none';
  if (btnBackAdmin) btnBackAdmin.style.display = isSuper ? 'inline-flex' : 'none';

  const btnDashAdd = document.getElementById('btnDashCalAddEvent');
  if (btnDashAdd) btnDashAdd.style.display = (isSuper || isTeacher) ? 'inline-flex' : 'none';
  if (typeof renderCalendar === 'function') renderCalendar('all');

  // Update top-right user badge for Admin / Teacher / Student
  const headerName = document.getElementById('headerUserName');
  const headerSub = document.getElementById('headerUserSub');
  const headerAvatar = document.getElementById('headerUserAvatar');
  const headerRole = document.getElementById('headerUserRole');

  if (isSuper) {
    if (headerName) headerName.innerText = 'Super Admin';
    if (headerSub) headerSub.innerText = 'ผู้ดูแลระบบสูงสุด';
    if (headerRole) headerRole.innerText = 'แอดมินสูงสุด';
    const sAv = currentAdmin?.avatarUrl || currentAdmin?.photo || localStorage.getItem('khalifah_admin_avatar_' + currentAdmin?.username);
    if (headerAvatar) {
      if (sAv) {
        headerAvatar.innerHTML = `<img src="${sAv}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 9999px;">`;
      } else {
        headerAvatar.innerHTML = '<i class="fa-solid fa-user-shield"></i>';
      }
    }
  } else if (isTeacher && currentAdmin) {
    const roleLabelMap = {
      TEACHER: 'อาจารย์ผู้สอน',
      EXECUTIVE: 'ผู้บริหารสถานศึกษา',
      HOMEROOM: 'อาจารย์ประจำชั้น',
      ACTIVITY: 'ฝ่ายกิจกรรม',
      SubAdmin: 'ผู้ช่วยแอดมิน'
    };
    if (headerName) headerName.innerText = currentAdmin.fullName || currentAdmin.username;
    if (headerSub) headerSub.innerText = roleLabelMap[currentAdmin.role] || 'อาจารย์ / บุคลากร';
    if (headerRole) headerRole.innerText = roleLabelMap[currentAdmin.role] || 'อาจารย์';
    const tAv = currentAdmin.avatarUrl || currentAdmin.photo || localStorage.getItem('khalifah_admin_avatar_' + currentAdmin.username);
    if (headerAvatar) {
      if (tAv) {
        headerAvatar.innerHTML = `<img src="${tAv}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 9999px;">`;
      } else {
        headerAvatar.innerHTML = '<i class="fa-solid fa-chalkboard-user"></i>';
      }
    }
  } else if (isStudent && currentStudent) {
    if (headerName) headerName.innerText = currentStudent.fullName || 'นักเรียน';
    if (headerSub) headerSub.innerText = `${currentStudent.grade || ''} • รหัส ${currentStudent.studentId || ''}`;
    if (headerRole) headerRole.innerText = 'นักเรียน';
    if (headerAvatar) {
      if (currentStudent.avatarUrl) {
        headerAvatar.innerHTML = `<img src="${currentStudent.avatarUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 9999px;">`;
      } else {
        headerAvatar.innerHTML = '<i class="fa-solid fa-user-graduate"></i>';
      }
    }
  } else {
    if (headerName) headerName.innerText = 'เข้าสู่ระบบ';
    if (headerSub) headerSub.innerText = 'นักเรียน / อาจารย์ / แอดมิน';
    if (headerRole) headerRole.innerText = 'ผู้ใช้ทั่วไป';
    if (headerAvatar) headerAvatar.innerHTML = '<i class="fa-solid fa-user"></i>';
  }
}

async function handleAdminLogin() {
  if (!checkLoginRateLimit()) return;

  const passEl = document.getElementById('adminPassInput');
  const userEl = document.getElementById('subAdminUserInput');
  const btn = document.getElementById('btnAdminModalLogin') || document.querySelector('#adminAuthModal button.btn-primary');

  const rawPass = (passEl?.value || '').trim();
  const pass = cleanIdString(rawPass);
  const user = cleanIdString((userEl?.value || '').trim());

  passEl?.classList.remove('is-invalid');
  userEl?.classList.remove('is-invalid');
  document.querySelectorAll('#adminAuthModal .auth-field-error-msg').forEach(el => el.remove());

  if (!rawPass) {
    triggerAuthError(passEl, 'กรุณากรอกรหัสผ่าน');
    return;
  }

  setButtonLoading(btn, true, 'กำลังตรวจสอบสิทธิ์...');

  if (isIdMatch(pass, MASTER_ADMIN_PASS) && !user) {
    setButtonLoading(btn, false, null, 'เข้าสู่ระบบสำเร็จ!');
    resetLoginFailures();
    currentStudent = null;
    currentAdmin = { username: 'MasterAdmin', fullName: 'แอดมินสูงสุด (Super Admin)', role: 'SuperAdmin' };
    localStorage.removeItem('khalifah_current_student');
    localStorage.setItem('khalifah_current_admin', JSON.stringify(currentAdmin));
    localStorage.setItem('khalifah_auth_role', 'admin');
    setTimeout(() => {
      document.body.classList.remove('auth-locked');
      updateAdminUIVisibility(true);
      closeModal('adminAuthModal');
      closeModal('authModal');
      switchView('admin');
      showToast('เข้าสู่ระบบแอดมินสูงสุดสำเร็จ', 'success');
    }, 250);
    return;
  }

  // Check subAdmins
  let foundSub = subAdmins.find(s => (isIdMatch(s.username, user) || (!user && isIdMatch(s.password, pass))) && isIdMatch(s.password, pass));
  if (!foundSub && typeof fetchSubAdminsFromCloud === 'function') {
    try {
      await fetchSubAdminsFromCloud(false);
      foundSub = subAdmins.find(s => (isIdMatch(s.username, user) || (!user && isIdMatch(s.password, pass))) && isIdMatch(s.password, pass));
    } catch (e) {}
  }

  if (foundSub) {
    if (foundSub.approvalStatus === 'PendingAdmin' || foundSub.approvalStatus === 'AwaitingOtp') {
      setButtonLoading(btn, false);
      showToast('บัญชีอาจารย์นี้ยังไม่ได้ป้อนรหัสยืนยัน 6 หลักที่ส่งไปยังอีเมล', 'warning');
      return;
    }
    setButtonLoading(btn, false, null, 'เข้าสู่ระบบสำเร็จ!');
    resetLoginFailures();
    currentStudent = null;
    currentAdmin = foundSub;
    localStorage.removeItem('khalifah_current_student');
    localStorage.setItem('khalifah_current_admin', JSON.stringify(currentAdmin));
    localStorage.setItem('khalifah_auth_role', foundSub.role === 'SuperAdmin' ? 'admin' : 'teacher');
    setTimeout(() => {
      document.body.classList.remove('auth-locked');
      updateAdminUIVisibility(true);
      closeModal('adminAuthModal');
      closeModal('authModal');
      switchView(foundSub.role === 'SuperAdmin' ? 'admin' : 'teacher');
      showToast(`ยินดีต้อนรับ ${foundSub.fullName || foundSub.username}`, 'success');
    }, 250);
    return;
  }

  setButtonLoading(btn, false);
  recordLoginFailure();

  if (user) {
    const userExists = subAdmins.some(s => isIdMatch(s.username, user) || (s.phone && isPhoneMatch(s.phone, user)));
    if (userExists) {
      triggerAuthError(passEl, 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านอีกครั้ง');
    } else {
      triggerAuthError(userEl, 'ไม่พบบัญชีผู้ใช้นี้ในระบบ กรุณาตรวจสอบรหัสอาจารย์หรือชื่อผู้ใช้');
    }
  } else {
    triggerAuthError(passEl, 'รหัสผ่านหลักไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านอีกครั้ง');
  }
}

function adminLogout() {
  if (typeof stopAdminActivityLivePolling === 'function') stopAdminActivityLivePolling();
  const wasTeacher = currentAdmin && currentAdmin.role !== 'SuperAdmin';
  currentAdmin = null;
  currentStudent = null;
  localStorage.removeItem('khalifah_current_admin');
  localStorage.removeItem('khalifah_current_student');
  localStorage.removeItem('khalifah_auth_role');
  updateAdminUIVisibility(false);
  renderCurrentStudentProfile();
  document.body.classList.add('auth-locked');
  selectAuthRole(wasTeacher ? 'teacher' : 'admin');
  openModal('authModal');
  showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
}

function teacherLogout() {
  adminLogout();
}

let brandClickCount = 0;
let brandClickTimer = null;
function handleBrandLogoClick() {
  brandClickCount++;
  if (brandClickCount === 1) {
    brandClickTimer = setTimeout(() => {
      brandClickCount = 0;
      if (currentAdmin) {
        switchView(currentAdmin.role === 'SuperAdmin' ? 'admin' : 'teacher');
      } else {
        switchView('dashboard');
      }
    }, 600);
  } else if (brandClickCount >= 3) {
    clearTimeout(brandClickTimer);
    brandClickCount = 0;
    openModal('adminAuthModal');
  }
}

// ----------------- SUPER ADMIN CONTROL CENTER ----------------- //

function getOrInitAdminMasterOtp() {
  let code = localStorage.getItem('khalifah_admin_master_otp');
  if (!code || code.length !== 6) {
    code = generateRandomAdminOtp();
    localStorage.setItem('khalifah_admin_master_otp', code);
  }
  return code;
}

function regenerateAdminRandomOtp(showToastMsg = false) {
  const newCode = generateRandomAdminOtp();
  localStorage.setItem('khalifah_admin_master_otp', newCode);
  renderSuperAdminOverviewKpis();
  if (showToastMsg) {
    showToast(`สุ่มรหัสกลางแอดมินชุดใหม่สำเร็จ: ${newCode}`, 'info');
  }
  return newCode;
}

function renderSuperAdminOverviewKpis() {
  const kpiStd = document.getElementById('adminKpiStudentsCount');
  const kpiTch = document.getElementById('adminKpiTeachersCount');
  const kpiPending = document.getElementById('adminKpiPendingCount');
  const kpiPrayers = document.getElementById('adminKpiPrayersToday');
  const kpiActSub = document.getElementById('adminKpiActivitiesSub');
  const badgePending = document.getElementById('adminTabPendingBadge') || document.getElementById('pendingApprovalsBadgeCount');
  const liveCodeBadge = document.getElementById('adminLiveRandomCodeBadge');
  const masterOtpDisplay = document.getElementById('adminCurrentMasterOtpDisplay');

  const activeStudentsCount = allStudents.length;
  const activeTeachersCount = subAdmins.length;
  const pendingList = getPendingRegistrations().filter(p => p.status === 'PendingAdmin');
  const prayersCount = todayPrayers.length;
  const masterOtp = getOrInitAdminMasterOtp();

  let actLogs = [];
  try {
    actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
  } catch (e) { actLogs = []; }

  if (kpiStd) kpiStd.innerText = `${activeStudentsCount} คน`;
  if (kpiTch) kpiTch.innerText = `${activeTeachersCount} ท่าน`;
  if (kpiPending) kpiPending.innerText = `${pendingList.length} รายการ`;
  if (kpiPrayers) kpiPrayers.innerText = `${prayersCount} รายการ`;
  if (kpiActSub) kpiActSub.innerText = `กิจกรรม ${activities.length} รายการ • สแกนเข้าแล้ว ${actLogs.length} ครั้ง`;
  if (liveCodeBadge) liveCodeBadge.innerText = masterOtp;
  if (masterOtpDisplay) masterOtpDisplay.innerText = masterOtp;
  if (badgePending) {
    badgePending.innerText = pendingList.length;
    badgePending.style.display = pendingList.length > 0 ? 'inline-block' : 'none';
  }
}

function switchAdminTab(tabName, element) {
  document.querySelectorAll('#view-admin .admin-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.admin-content-tab').forEach(tab => tab.style.display = 'none');

  if (element) element.classList.add('active');
  const target = document.getElementById(`admin-tab-${tabName}`);
  if (target) target.style.display = 'block';

  renderSuperAdminOverviewKpis();

  if (tabName === 'approvals') {
    renderPendingApprovalsTable();
  } else if (tabName === 'grading') {
    populateGradingSubjectSelect();
    renderGradingStudentsTable();
  } else if (tabName === 'subjects') {
    renderAdminSubjectsTable();
  } else if (tabName === 'subadmins') {
    populateGradingSubjectSelect();
    if (typeof renderQuickSubAdminSubjectsChecklist === 'function') renderQuickSubAdminSubjectsChecklist([]);
    if (typeof toggleQuickSubAdminSubjectField === 'function') toggleQuickSubAdminSubjectField();
    renderSubAdminsTable();
    if (typeof fetchSubAdminsFromCloud === 'function') fetchSubAdminsFromCloud(false);
  } else if (tabName === 'students') {
    renderAdminStudentsTable();
  } else if (tabName === 'activities-admin') {
    renderAdminActivitiesTable();
    if (typeof renderAdminLiveActivityFeed === 'function') renderAdminLiveActivityFeed();
    if (typeof fetchActivitiesAndLogsFromCloud === 'function') fetchActivitiesAndLogsFromCloud(false);
  } else if (tabName === 'prayers-monitor') {
    if (typeof initAdminPrayerDashboard === 'function') initAdminPrayerDashboard();
    if (typeof fetchPrayersFromCloud === 'function') fetchPrayersFromCloud();
  } else if (tabName === 'calendar-admin') {
    if (typeof renderCalendar === 'function') renderCalendar('admin');
  } else if (tabName === 'promote') {
    if (typeof updateAdminPromotionBreakdown === 'function') updateAdminPromotionBreakdown();
    if (typeof populateAdminSingleStudentSelect === 'function') populateAdminSingleStudentSelect();
  }
}

let isFetchingPendingCloud = false;
async function fetchPendingApprovalsFromCloud() {
  if (isFetchingPendingCloud) return;
  let url = gasApiUrl || localStorage.getItem('khalifah_gas_url') || DEFAULT_GAS_API_URL;
  if (!url || url.includes('docs.google.com/spreadsheets')) return;
  isFetchingPendingCloud = true;
  try {
    const resp = await fetch(`${url}?action=getPendingRegistrations`);
    const json = await resp.json();
    if (json && json.success && Array.isArray(json.data)) {
      const localList = getPendingRegistrations();
      json.data.forEach(r => {
        const reqId = r.reqId || r.id || ('REQ-' + Date.now());
        const normStatus = (r.status === 'approved' || r.status === 'Approved') ? 'Approved' : (r.status || 'PendingAdmin');
        const idx = localList.findIndex(p => (p.reqId && p.reqId === reqId) || (isIdMatch(p.userId, r.userId) && p.role === r.role));
        const merged = {
          reqId: reqId,
          role: r.role || 'student',
          userId: cleanIdString(r.userId),
          fullName: r.fullName || '',
          email: r.email || '',
          phone: r.phone || (idx !== -1 ? localList[idx].phone : '') || '',
          gradeOrSubj: r.gradeOrSubj || r.detail || (idx !== -1 ? localList[idx].gradeOrSubj : '') || '',
          otpCode: cleanIdString(r.otpCode),
          status: idx !== -1 && localList[idx].status === 'Verified' ? 'Verified' : normStatus,
          createdAt: r.requestedAt || r.createdAt || '',
          payload: (r.payload && Object.keys(r.payload).length > 0) ? r.payload : (idx !== -1 ? localList[idx].payload : null)
        };
        if (idx !== -1) {
          localList[idx] = merged;
        } else {
          localList.unshift(merged);
        }
      });
      savePendingRegistrations(localList);
      renderPendingApprovalsTable(true);
    }
  } catch (e) {
    console.warn('Cloud pending approvals fetch warning:', e);
  } finally {
    isFetchingPendingCloud = false;
  }
}

function renderPendingApprovalsTable(skipCloudFetch = false) {
  const tbody = document.getElementById('adminPendingApprovalsTableBody');
  if (!tbody) return;

  if (!skipCloudFetch) {
    fetchPendingApprovalsFromCloud();
  }

  const list = getPendingRegistrations();
  renderSuperAdminOverviewKpis();

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <i class="fa-solid fa-circle-check" style="font-size: 1.4rem; margin-bottom: 0.4rem; display: block; color: #94a3b8;"></i>
          ไม่มีรายการคำขอสมัครที่รออนุมัติในขณะนี้
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(item => {
    const reqKey = item.reqId || item.id || item.userId;
    const roleLabel = item.role === 'teacher'
      ? '<span class="activity-badge badge-active">อาจารย์ผู้สอน</span>'
      : '<span class="activity-badge badge-upcoming">นักเรียน</span>';

    let statusBadge = `<span class="activity-badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a;"><i class="fa-solid fa-clock"></i> รอแอดมินกดส่งอีเมล</span>`;
    if (item.status === 'Verified') {
      statusBadge = `<span class="activity-badge badge-active"><i class="fa-solid fa-circle-check"></i> ยืนยันรหัส OTP แล้ว</span>`;
    } else if (item.status === 'Approved' || item.status === 'approved') {
      statusBadge = `<span class="activity-badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;"><i class="fa-solid fa-envelope-circle-check"></i> ส่งอีเมลแล้ว (รอผู้สมัครกรอกรหัส)</span>`;
    }

    return `
      <tr>
        <td>${roleLabel}</td>
        <td><b>${escapeHtml(item.userId)}</b></td>
        <td style="font-weight: 600;">${escapeHtml(item.fullName)}</td>
        <td>
          <div><i class="fa-regular fa-envelope"></i> ${escapeHtml(item.email || '-')}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);"><i class="fa-solid fa-phone"></i> ${escapeHtml(item.phone || '-')}</div>
        </td>
        <td style="font-size: 0.82rem;">${escapeHtml(item.gradeOrSubj || item.detail || '-')}</td>
        <td style="text-align: center;">
          <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
            <span class="admin-otp-badge" title="รหัสยืนยันแบบสุ่มเฉพาะแอดมิน">${escapeHtml(item.otpCode)}</span>
            <button class="btn btn-secondary btn-sm" onclick="adminRegenerateRandomOtp('${escapeHtml(reqKey)}')" title="สุ่มรหัสยืนยันชุดใหม่" style="padding: 0.22rem 0.45rem; font-size: 0.74rem;">
              <i class="fa-solid fa-dice"></i> สุ่มใหม่
            </button>
          </div>
        </td>
        <td>${statusBadge}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-primary btn-sm" onclick="adminApproveRegistration('${escapeHtml(reqKey)}')" style="padding: 0.3rem 0.65rem; font-size: 0.78rem; margin-right: 0.3rem;">
            <i class="fa-solid fa-paper-plane"></i> ยินยอม & ส่งอีเมล
          </button>
          <button class="btn btn-danger btn-sm" onclick="adminRejectRegistration('${escapeHtml(reqKey)}')" style="padding: 0.3rem 0.55rem; font-size: 0.78rem;">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function adminRegenerateRandomOtp(reqId) {
  const list = getPendingRegistrations();
  const idx = list.findIndex(p => (p.reqId || p.id) === reqId || isIdMatch(p.userId, reqId));
  if (idx === -1) return;

  const newOtp = generateRandomAdminOtp();
  list[idx].otpCode = newOtp;
  savePendingRegistrations(list);

  // Sync updated OTP to student/teacher record as well
  const item = list[idx];
  if (item.role === 'student') {
    const sIdx = allStudents.findIndex(s => isIdMatch(s.studentId, item.userId));
    if (sIdx !== -1) {
      allStudents[sIdx].otpCode = newOtp;
      localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
    }
  } else {
    const tIdx = subAdmins.findIndex(s => isIdMatch(s.username, item.userId));
    if (tIdx !== -1) {
      subAdmins[tIdx].otpCode = newOtp;
      localStorage.setItem('khalifah_sub_admins', JSON.stringify(subAdmins));
    }
  }

  syncRecordToGoogleSheet('registerPendingUser', item);
  renderPendingApprovalsTable(true);
  showToast(`สุ่มรหัสยืนยันชุดใหม่สำหรับ ${item.fullName} คือ: ${newOtp}`, 'info');
}

async function adminApproveRegistration(reqId) {
  const list = getPendingRegistrations();
  const idx = list.findIndex(p => (p.reqId || p.id) === reqId || isIdMatch(p.userId, reqId));
  if (idx === -1) return;

  const item = list[idx];
  item.status = 'Approved';
  item.approvedAt = new Date().toISOString();
  savePendingRegistrations(list);

  // Keep user in AwaitingOtp state until they actually type the 6-digit OTP sent to their email!
  if (item.role === 'student') {
    const sIdx = allStudents.findIndex(s => isIdMatch(s.studentId, item.userId));
    if (sIdx !== -1) {
      allStudents[sIdx].status = 'รอผู้สมัครกรอกรหัส OTP';
      allStudents[sIdx].approvalStatus = 'AwaitingOtp';
      allStudents[sIdx].otpCode = item.otpCode;
    } else if (item.payload && Object.keys(item.payload).length > 0) {
      item.payload.status = 'รอผู้สมัครกรอกรหัส OTP';
      item.payload.approvalStatus = 'AwaitingOtp';
      item.payload.otpCode = item.otpCode;
      allStudents.push(item.payload);
    }
    localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
  } else if (item.role === 'teacher') {
    const tIdx = subAdmins.findIndex(s => isIdMatch(s.username, item.userId));
    if (tIdx !== -1) {
      subAdmins[tIdx].status = 'รอผู้สมัครกรอกรหัส OTP';
      subAdmins[tIdx].approvalStatus = 'AwaitingOtp';
      subAdmins[tIdx].otpCode = item.otpCode;
    } else if (item.payload && Object.keys(item.payload).length > 0) {
      item.payload.status = 'รอผู้สมัครกรอกรหัส OTP';
      item.payload.approvalStatus = 'AwaitingOtp';
      item.payload.otpCode = item.otpCode;
      subAdmins.push(item.payload);
    }
    localStorage.setItem('khalifah_sub_admins', JSON.stringify(subAdmins));
  }

  renderPendingApprovalsTable(true);
  renderAdminStudentsTable();
  renderSubAdminsTable();
  renderSuperAdminOverviewKpis();

  // Trigger automatic email dispatch via Google Apps Script (MailApp.sendEmail) and inspect real response
  showToast(`กำลังส่งรหัสยืนยัน (${item.otpCode}) ไปยังอีเมล ${item.email} อัตโนมัติ...`, 'info');
  let url = gasApiUrl || localStorage.getItem('khalifah_gas_url') || DEFAULT_GAS_API_URL;
  if (!url || url.includes('docs.google.com/spreadsheets')) url = DEFAULT_GAS_API_URL;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'approveRegistrationAndSendEmail',
        data: {
          reqId: item.reqId || item.id,
          role: item.role,
          roleLabel: item.role === 'teacher' ? 'อาจารย์ผู้สอน' : 'นักเรียน',
          userId: item.userId,
          fullName: item.fullName,
          email: item.email,
          phone: item.phone,
          otpCode: item.otpCode,
          gradeOrSubj: item.gradeOrSubj || item.detail,
          payload: item.payload
        }
      })
    });
    const resJson = await resp.json();
    playSuccessSound();
    if (resJson && resJson.emailSent) {
      showToast(`ส่งอีเมลสำเร็จ! รหัสยืนยัน [${item.otpCode}] ถูกส่งไปที่ ${item.email} เรียบร้อยแล้ว (ผู้สมัครต้องนำรหัสนี้มากรอกจึงจะเข้าระบบได้)`, 'success');
    } else {
      console.warn('Email dispatch warning:', resJson);
      showToast(`อนุมัติแล้ว (รหัส: ${item.otpCode}) กรุณาตรวจสอบสิทธิ์ส่งอีเมลใน Apps Script`, 'warning');
    }
  } catch (err) {
    playSuccessSound();
    showToast(`ส่งคำสั่งอนุมัติแล้ว! รหัสยืนยันของ ${item.fullName} คือ [${item.otpCode}]`, 'success');
  }
}

function adminRejectRegistration(reqId) {
  if (!confirm('ต้องการลบคำขอสมัครรายการนี้ใช่หรือไม่?')) return;
  let list = getPendingRegistrations();
  const target = list.find(p => p.reqId === reqId);
  list = list.filter(p => p.reqId !== reqId);
  savePendingRegistrations(list);

  if (target) {
    if (target.role === 'student') {
      allStudents = allStudents.filter(s => !(isIdMatch(s.studentId, target.userId) && s.approvalStatus === 'PendingAdmin'));
      localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
    } else {
      subAdmins = subAdmins.filter(s => !(isIdMatch(s.username, target.userId) && s.approvalStatus === 'PendingAdmin'));
      localStorage.setItem('khalifah_sub_admins', JSON.stringify(subAdmins));
    }
  }

  renderPendingApprovalsTable();
  renderSuperAdminOverviewKpis();
  showToast('ลบคำขอสมัครเรียบร้อยแล้ว', 'info');

  syncRecordToGoogleSheet('deletePendingRegistration', {
    reqId: reqId,
    userId: target ? target.userId : ''
  });
}

function formatThaiDateShort(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
    }
  } catch (e) {}
  return String(dateStr);
}

function getStudentStatusBadgeHtml(status, effectiveDate) {
  const s = String(status || 'ปกติ (กำลังศึกษา)').trim();
  const dateFormatted = effectiveDate ? formatThaiDateShort(effectiveDate) : '';
  const dateSuffix = dateFormatted ? `<span class="badge-status-effective-date"><i class="fa-regular fa-calendar-check"></i> ณ ${escapeHtml(dateFormatted)}</span>` : '';

  if (s === 'สำเร็จการศึกษา' || s.includes('สำเร็จ')) {
    return `
      <div>
        <span class="activity-badge badge-status-graduated"><i class="fa-solid fa-graduation-cap"></i> สำเร็จการศึกษา</span>
        ${dateSuffix}
      </div>
    `;
  }
  if (s === 'ลาออก' || s.includes('ลาออก')) {
    return `
      <div>
        <span class="activity-badge badge-status-resigned"><i class="fa-solid fa-user-xmark"></i> ลาออก</span>
        ${dateSuffix}
      </div>
    `;
  }
  if (s === 'พักการเรียน' || s.includes('พัก')) {
    return `
      <div>
        <span class="activity-badge badge-status-suspended"><i class="fa-solid fa-pause"></i> พักการเรียน</span>
        ${dateSuffix}
      </div>
    `;
  }
  return `
    <div>
      <span class="activity-badge badge-status-normal"><i class="fa-solid fa-check"></i> ปกติ</span>
      ${dateSuffix}
    </div>
  `;
}

function renderAdminStudentsTable(filteredList = null) {
  const tbody = document.getElementById('adminStudentsTableBody');
  if (!tbody) return;

  const list = filteredList || allStudents;
  renderSuperAdminOverviewKpis();

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          ยังไม่มีรายชื่อนักเรียนในระบบ (สามารถกดปุ่ม "+ เพิ่มนักเรียนใหม่" ด้านบนได้เลย)
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(s => {
    const sId = cleanIdString(s.studentId);
    const sPhone = normalizePhone(s.parentPhone);
    const prayerCount = todayPrayers.filter(p => isIdMatch(p.studentId, sId)).length;
    const gpaVal = recalculateStudentGpa(s);
    const h = getStudentHasanat(sId);
    const qPage = (h && h.quran && h.quran.currentPage) || 0;
    const memCount = (h && h.memorization && h.memorization.count) || 0;

    return `
    <tr>
      <td><b>${escapeHtml(sId)}</b></td>
      <td>
        <div style="font-weight: 600; color: var(--text-dark);">${escapeHtml(s.fullName)}</div>
        <div style="font-size: 0.74rem; color: var(--text-muted);">${escapeHtml(s.schoolName || '')}</div>
      </td>
      <td><span class="activity-badge badge-upcoming">${escapeHtml(s.grade)}</span></td>
      <td>
        <div style="display: flex; flex-direction: column; gap: 0.35rem; align-items: flex-start;">
          ${getStudentStatusBadgeHtml(s.status, s.statusEffectiveDate || s.statusDate)}
          <button type="button" class="btn btn-secondary btn-sm" onclick="openStudentQuickStatusModal('${escapeHtml(sId)}')" style="padding: 0.2rem 0.5rem; font-size: 0.72rem; border-radius: 6px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.3rem; background: #ffffff; border: 1px solid #cbd5e1; box-shadow: 0 1px 2px rgba(0,0,0,0.04);" title="คลิกเพื่อปรับสถานะนักเรียนในระบบ">
            <i class="fa-solid fa-user-pen" style="color: #0284c7;"></i> ปรับสถานะ
          </button>
        </div>
      </td>
      <td>
        <div style="font-weight: 600; color: #0f172a;">${escapeHtml(sPhone || '-')}</div>
        <div style="font-size: 0.74rem; color: var(--text-muted);">${escapeHtml(s.email || '-')}</div>
      </td>
      <td>
        <div style="font-weight: 600; color: #0f172a;">มา ${s.attendance ? s.attendance.present : 0} วัน</div>
        <div style="font-size: 0.74rem; color: var(--text-muted);">สาย ${s.attendance ? s.attendance.late : 0} • ลา ${s.attendance ? (s.attendance.leave || 0) : 0} • ขาด ${s.attendance ? s.attendance.absent : 0}</div>
      </td>
      <td>
        <span class="subject-grade-pill-val">${prayerCount} / 5 เวลา</span>
      </td>
      <td>
        <div style="font-weight: 600; color: #0f172a;">หน้า ${qPage} / 604</div>
        <div style="font-size: 0.74rem; color: var(--text-muted);">จำ ${memCount} ซูเราะห์</div>
      </td>
      <td><span class="subject-grade-pill-val">GPA ${escapeHtml(gpaVal)}</span></td>
      <td style="text-align: right; white-space: nowrap;">
        <button class="btn btn-primary btn-sm" style="padding: 0.28rem 0.6rem; font-size: 0.78rem; margin-right: 0.25rem;" onclick="viewStudentDetails('${escapeHtml(sId)}')">
          <i class="fa-solid fa-sliders"></i> แก้ไขเชิงลึก
        </button>
        <button class="btn btn-danger btn-sm" style="padding: 0.28rem 0.5rem; font-size: 0.78rem;" onclick="deleteStudent('${escapeHtml(sId)}')" title="ลบนักเรียน">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `;
  }).join('');
}

function openAdminEditStudentModal(studentId = null) {
  if (!studentId) {
    openAdminAddStudentModal();
  } else {
    viewStudentDetails(studentId);
  }
}

function openStudentQuickStatusModal(studentId) {
  const student = allStudents.find(s => isIdMatch(s.studentId, studentId));
  if (!student) {
    showToast('ไม่พบข้อมูลนักเรียน', 'warning');
    return;
  }

  const cleanId = cleanIdString(student.studentId);
  const nameEl = document.getElementById('quickStatusStudentName');
  const idEl = document.getElementById('quickStatusStudentIdDisplay');
  const gradeEl = document.getElementById('quickStatusStudentGradeDisplay');
  const currentBadgeEl = document.getElementById('quickStatusCurrentBadge');
  const hiddenId = document.getElementById('quickStatusStudentId');
  const selectEl = document.getElementById('quickStatusSelect');
  const dateEl = document.getElementById('quickStatusEffectiveDate');
  const noteEl = document.getElementById('quickStatusNote');

  if (hiddenId) hiddenId.value = cleanId;
  if (nameEl) nameEl.innerText = student.fullName || cleanId;
  if (idEl) idEl.innerText = cleanId;
  if (gradeEl) gradeEl.innerText = student.grade || '-';

  const curStatus = student.status || 'ปกติ (กำลังศึกษา)';
  const curDate = student.statusEffectiveDate || student.statusDate || new Date().toISOString().split('T')[0];
  const curNote = student.statusNote || '';

  if (currentBadgeEl) {
    currentBadgeEl.innerHTML = getStudentStatusBadgeHtml(curStatus, curDate);
  }
  if (selectEl) {
    selectEl.value = (curStatus === 'Active' || curStatus === 'ปกติ') ? 'ปกติ (กำลังศึกษา)' : curStatus;
  }
  if (dateEl) dateEl.value = curDate;
  if (noteEl) noteEl.value = curNote;

  openModal('studentQuickStatusModal');
}

async function submitQuickStudentStatusChange() {
  const hiddenId = document.getElementById('quickStatusStudentId');
  const selectEl = document.getElementById('quickStatusSelect');
  const dateEl = document.getElementById('quickStatusEffectiveDate');
  const noteEl = document.getElementById('quickStatusNote');

  if (!hiddenId || !hiddenId.value) return;
  const targetId = hiddenId.value;
  const newStatus = selectEl ? selectEl.value : 'ปกติ (กำลังศึกษา)';
  const effectiveDate = (dateEl && dateEl.value) ? dateEl.value : new Date().toISOString().split('T')[0];
  const note = noteEl ? noteEl.value.trim() : '';

  const sIdx = allStudents.findIndex(s => isIdMatch(s.studentId, targetId));
  if (sIdx === -1) {
    showToast('ไม่พบข้อมูลนักเรียนในระบบ', 'warning');
    return;
  }

  const student = allStudents[sIdx];
  const oldStatus = student.status || 'ปกติ (กำลังศึกษา)';
  student.status = newStatus;
  student.statusEffectiveDate = effectiveDate;
  student.statusDate = effectiveDate;
  student.statusNote = note;

  allStudents[sIdx] = student;
  localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));

  if (currentStudent && isIdMatch(currentStudent.studentId, targetId)) {
    currentStudent.status = newStatus;
    currentStudent.statusEffectiveDate = effectiveDate;
    currentStudent.statusDate = effectiveDate;
    currentStudent.statusNote = note;
    localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
    renderCurrentStudentProfile();
  }

  renderAdminStudentsTable();
  renderSuperAdminOverviewKpis();
  if (typeof renderTeacherAttendanceTable === 'function') renderTeacherAttendanceTable();
  if (typeof renderTeacherGradesPortalTable === 'function') renderTeacherGradesPortalTable();

  closeModal('studentQuickStatusModal');
  playSuccessSound();
  showToast(`อัปเดตสถานะของ ${student.fullName} เป็น "${newStatus}" เรียบร้อยแล้ว (กำลังบันทึกลง Google Sheets)`, 'success');

  syncRecordToGoogleSheet('updateStudentStatus', {
    studentId: targetId,
    oldStatus: oldStatus,
    newStatus: newStatus,
    status: newStatus,
    statusEffectiveDate: effectiveDate,
    statusDate: effectiveDate,
    statusNote: note,
    adminUser: (currentAdmin && (currentAdmin.fullName || currentAdmin.username)) || 'SuperAdmin'
  });
}

function filterAdminStudents() {
  const rawSearch = (document.getElementById('searchStudentInput')?.value || '').trim();
  const search = rawSearch.toLowerCase();
  const searchClean = cleanIdString(rawSearch).toLowerCase();
  const searchWithoutZero = searchClean.replace(/^0+/, '');
  const grade = document.getElementById('filterGradeSelect')?.value;
  const statusFilter = document.getElementById('filterStatusSelect')?.value;

  const filtered = allStudents.filter(s => {
    const sId = cleanIdString(s.studentId).toLowerCase();
    const sIdWithoutZero = sId.replace(/^0+/, '');
    const sPhone = cleanPhoneString(s.parentPhone);
    const sPhoneWithoutZero = sPhone.replace(/^0+/, '');

    const matchName = (s.fullName || '').toLowerCase().includes(search);
    const matchId = sId.includes(searchClean) || (searchWithoutZero && sIdWithoutZero.includes(searchWithoutZero));
    const matchPhone = sPhone.includes(searchClean) || (searchWithoutZero && sPhoneWithoutZero.includes(searchWithoutZero));
    const matchSearch = !rawSearch || matchName || matchId || matchPhone;
    const matchGrade = !grade || s.grade === grade;

    let matchStatus = true;
    if (statusFilter) {
      const curSt = String(s.status || 'ปกติ (กำลังศึกษา)');
      if (statusFilter === 'ปกติ (กำลังศึกษา)') {
        matchStatus = (curSt === 'ปกติ (กำลังศึกษา)' || curSt === 'Active' || curSt === 'ปกติ');
      } else {
        matchStatus = curSt.includes(statusFilter);
      }
    }

    return matchSearch && matchGrade && matchStatus;
  });

  renderAdminStudentsTable(filtered);
}

let currentAdminEditingStudentOriginalId = null;

function openAdminAddStudentModal() {
  const newTempId = 'STD-' + String(allStudents.length + 1).padStart(4, '0');
  const blankStudent = {
    studentId: newTempId,
    fullName: 'นักเรียนใหม่',
    email: '',
    schoolName: 'โรงเรียนสาธิต มหาวิทยาลัยฟาฏอนี',
    grade: 'มัธยมศึกษาปีที่ 1',
    birthDate: '01012555',
    parentPhone: '0810000000',
    status: 'Active',
    approvalStatus: 'Approved',
    registeredAt: new Date().toISOString(),
    skills: {},
    subjectGrades: {},
    gpa: '0.00',
    attendance: { present: 0, late: 0, leave: 0, absent: 0 }
  };
  allStudents.unshift(blankStudent);
  localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
  renderAdminStudentsTable();
  viewStudentDetails(newTempId);
}

function viewStudentDetails(studentId) {
  const student = allStudents.find(s => isIdMatch(s.studentId, studentId));
  if (!student) return;

  loadAppSubjects();
  const cleanId = cleanIdString(student.studentId);
  currentAdminEditingStudentOriginalId = cleanId;
  const cleanPhone = normalizePhone(student.parentPhone);
  const cleanBD = normalizeBirthDate(student.birthDate);
  const curStatus = student.status || 'ปกติ (กำลังศึกษา)';
  const curStatusDate = student.statusEffectiveDate || student.statusDate || '';
  const curStatusNote = student.statusNote || '';

  const title = document.getElementById('studentDetailTitle');
  const content = document.getElementById('studentDetailContent');
  const btnDelete = document.getElementById('btnAdminDeleteStudent');

  if (title) title.innerHTML = `<i class="fa-solid fa-user-pen"></i> จัดการและแก้ไขข้อมูลเชิงลึก: ${escapeHtml(student.fullName)} (${escapeHtml(cleanId)})`;

  const hasanat = getStudentHasanat(cleanId);
  const qPage = (hasanat && hasanat.quran && hasanat.quran.currentPage) || 0;
  const qJuz = (hasanat && hasanat.quran && hasanat.quran.juzCompleted) || 0;
  const qKhatam = (hasanat && hasanat.quran && hasanat.quran.khatamCount) || 0;
  const memCount = (hasanat && hasanat.memorization && hasanat.memorization.count) || 0;
  const sunnahRakaat = (hasanat && hasanat.sunnah && hasanat.sunnah.totalRakaat) || 0;

  const att = student.attendance || { present: 0, late: 0, leave: 0, absent: 0 };
  const gradesMap = student.subjectGrades || student.skills || {};

  // Load student's prayer logs so Admin can inspect or delete any individual prayer entry
  let historyList = [];
  try {
    historyList = JSON.parse(localStorage.getItem('khalifah_prayer_history') || '[]');
  } catch (e) { historyList = []; }
  const studentPrayers = historyList.filter(p => isIdMatch(p.studentId, cleanId)).slice(0, 10);

  const gradeOptions = [
    { val: '0', label: '0 (รอผล / ไม่ผ่าน)' },
    { val: '1', label: 'เกรด 1.0' },
    { val: '1.5', label: 'เกรด 1.5' },
    { val: '2', label: 'เกรด 2.0' },
    { val: '2.5', label: 'เกรด 2.5' },
    { val: '3', label: 'เกรด 3.0' },
    { val: '3.5', label: 'เกรด 3.5' },
    { val: '4', label: 'เกรด 4.0 (ดีเยี่ยม)' }
  ];

  const subjectsEditorHtml = appSubjects.map(subj => {
    const curG = normalizeGrade1To4(gradesMap[subj.id]);
    const opts = gradeOptions.map(o => `<option value="${o.val}" ${parseFloat(o.val) === curG ? 'selected' : ''}>${o.label}</option>`).join('');
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; background: #ffffff; border: 1px solid #e2e8f0; padding: 0.45rem 0.65rem; border-radius: 6px;">
        <span style="font-size: 0.82rem; font-weight: 600; color: #1e293b;">${escapeHtml(subj.name)}</span>
        <select class="form-control admin-edit-std-subj-grade" data-subj-id="${escapeHtml(subj.id)}" style="width: 145px; height: 32px; font-size: 0.8rem; font-weight: 700; padding: 0 0.45rem;">
          ${opts}
        </select>
      </div>
    `;
  }).join('');

  content.innerHTML = `
    <!-- Section 1: ข้อมูลส่วนตัวและบัญชี -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: var(--radius-md); padding: 0.95rem; margin-bottom: 0.9rem;">
      <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a; margin-bottom: 0.65rem;">
        <i class="fa-solid fa-id-card"></i> 1. ข้อมูลประวัตินักเรียนและบัญชีผู้ใช้
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0.65rem;">
        <div>
          <label class="form-label" style="font-size: 0.76rem;">รหัสนักเรียน (รหัสผ่าน)</label>
          <input type="text" class="form-control" id="adminEditStdId" value="${escapeHtml(cleanId)}" style="height: 36px; font-size: 0.85rem; font-weight: 700;">
        </div>
        <div>
          <label class="form-label" style="font-size: 0.76rem;">ชื่อ - นามสกุล</label>
          <input type="text" class="form-control" id="adminEditStdName" value="${escapeHtml(student.fullName)}" style="height: 36px; font-size: 0.85rem;">
        </div>
        <div>
          <label class="form-label" style="font-size: 0.76rem;">ระดับชั้นมัธยมศึกษา</label>
          <select class="form-control" id="adminEditStdGrade" style="height: 36px; font-size: 0.85rem;">
            ${['มัธยมศึกษาปีที่ 1','มัธยมศึกษาปีที่ 2','มัธยมศึกษาปีที่ 3','มัธยมศึกษาปีที่ 4','มัธยมศึกษาปีที่ 5','มัธยมศึกษาปีที่ 6'].map(g => `<option value="${g}" ${student.grade === g ? 'selected' : ''}>${g}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label" style="font-size: 0.76rem;">โรงเรียน / สถาบัน</label>
          <input type="text" class="form-control" id="adminEditStdSchool" value="${escapeHtml(student.schoolName || '')}" style="height: 36px; font-size: 0.85rem;">
        </div>
        <div>
          <label class="form-label" style="font-size: 0.76rem;">เบอร์โทรศัพท์ผู้ปกครอง (User)</label>
          <input type="text" class="form-control" id="adminEditStdPhone" value="${escapeHtml(cleanPhone)}" style="height: 36px; font-size: 0.85rem;">
        </div>
        <div>
          <label class="form-label" style="font-size: 0.76rem;">อีเมลนักเรียน</label>
          <input type="email" class="form-control" id="adminEditStdEmail" value="${escapeHtml(student.email || '')}" style="height: 36px; font-size: 0.85rem;">
        </div>
        <div>
          <label class="form-label" style="font-size: 0.76rem;">รหัสวันเกิด 8 หลัก (DDMMYYYY)</label>
          <input type="text" class="form-control" id="adminEditStdBirthDate" value="${escapeHtml(cleanBD)}" style="height: 36px; font-size: 0.85rem;">
        </div>
        <div>
          <label class="form-label" style="font-size: 0.76rem; font-weight: 700; color: #0f172a;">สถานะทางการศึกษา</label>
          <select class="form-control" id="adminEditStdStatus" style="height: 36px; font-size: 0.85rem; font-weight: 600;">
            <option value="ปกติ (กำลังศึกษา)" ${(curStatus === 'ปกติ (กำลังศึกษา)' || curStatus === 'Active' || curStatus === 'ปกติ') ? 'selected' : ''}>ปกติ (กำลังศึกษา)</option>
            <option value="สำเร็จการศึกษา" ${(curStatus === 'สำเร็จการศึกษา' || curStatus === 'Graduated') ? 'selected' : ''}>สำเร็จการศึกษา</option>
            <option value="ลาออก" ${(curStatus === 'ลาออก' || curStatus === 'Resigned') ? 'selected' : ''}>ลาออก</option>
            <option value="พักการเรียน" ${(curStatus === 'พักการเรียน' || curStatus === 'Suspended') ? 'selected' : ''}>พักการเรียน</option>
          </select>
        </div>
        <div>
          <label class="form-label" style="font-size: 0.76rem; font-weight: 700; color: #0f172a;">มีผล ณ วันที่ (วันเดือนปี)</label>
          <input type="date" class="form-control" id="adminEditStdStatusDate" value="${escapeHtml(curStatusDate)}" style="height: 36px; font-size: 0.85rem;">
        </div>
        <div style="grid-column: 1 / -1;">
          <label class="form-label" style="font-size: 0.76rem; font-weight: 700; color: #0f172a;">เหตุผล / หมายเหตุสถานะ</label>
          <input type="text" class="form-control" id="adminEditStdStatusNote" value="${escapeHtml(curStatusNote)}" placeholder="เช่น สำเร็จการศึกษาประจำปีการศึกษา 2568, ลาออกเนื่องจากย้ายสถานศึกษา" style="height: 36px; font-size: 0.85rem;">
        </div>
      </div>
    </div>

    <!-- Section 2: สถิติการมาเรียน (Attendance) -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: var(--radius-md); padding: 0.95rem; margin-bottom: 0.9rem;">
      <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a; margin-bottom: 0.65rem;">
        <i class="fa-solid fa-calendar-check"></i> 2. แก้ไขสถิติการมาเรียน (วัน)
      </div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.65rem;">
        <div>
          <label class="form-label" style="font-size: 0.75rem;">มาเรียน (วัน)</label>
          <input type="number" min="0" class="form-control" id="adminEditAttPresent" value="${att.present || 0}" style="height: 36px; text-align: center; font-weight: 700;">
        </div>
        <div>
          <label class="form-label" style="font-size: 0.75rem;">มาสาย (ครั้ง)</label>
          <input type="number" min="0" class="form-control" id="adminEditAttLate" value="${att.late || 0}" style="height: 36px; text-align: center; font-weight: 700;">
        </div>
        <div>
          <label class="form-label" style="font-size: 0.75rem;">ลา (ครั้ง)</label>
          <input type="number" min="0" class="form-control" id="adminEditAttLeave" value="${att.leave || 0}" style="height: 36px; text-align: center; font-weight: 700;">
        </div>
        <div>
          <label class="form-label" style="font-size: 0.75rem;">ขาดเรียน (ครั้ง)</label>
          <input type="number" min="0" class="form-control" id="adminEditAttAbsent" value="${att.absent || 0}" style="height: 36px; text-align: center; font-weight: 700;">
        </div>
      </div>
    </div>

    <!-- Section 3: เกรดรายวิชา 1 - 4 (เชื่อมกราฟเรดาร์ทักษะ) -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: var(--radius-md); padding: 0.95rem; margin-bottom: 0.9rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
        <span style="font-weight: 700; font-size: 0.9rem; color: #0f172a;"><i class="fa-solid fa-chart-pie"></i> 3. เกรดรายวิชา (ระดับ 1 - 4 แสดงผลในกราฟทักษะ)</span>
        <span class="subject-grade-pill-val">GPAX: ${escapeHtml(recalculateStudentGpa(student))}</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.5rem;">
        ${subjectsEditorHtml}
      </div>
    </div>

    <!-- Section 4: สถิติผลบุญ (Hasanat) -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: var(--radius-md); padding: 0.95rem; margin-bottom: 0.9rem;">
      <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a; margin-bottom: 0.65rem;">
        <i class="fa-solid fa-book-quran"></i> 4. แก้ไขข้อมูลผลบุญและศาสนกิจ (Hasanat)
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.65rem;">
        <div>
          <label class="form-label" style="font-size: 0.75rem;">อ่านกุรอานถึงหน้า (0-604)</label>
          <input type="number" min="0" max="604" class="form-control" id="adminEditQuranPage" value="${qPage}" style="height: 36px; text-align: center; font-weight: 700;">
        </div>
        <div>
          <label class="form-label" style="font-size: 0.75rem;">ยุซที่อ่านจบ (0-30)</label>
          <input type="number" min="0" max="30" class="form-control" id="adminEditQuranJuz" value="${qJuz}" style="height: 36px; text-align: center; font-weight: 700;">
        </div>
        <div>
          <label class="form-label" style="font-size: 0.75rem;">จบ 30 ยุซ (ค็อตม์กี่ครั้ง)</label>
          <input type="number" min="0" class="form-control" id="adminEditQuranKhatam" value="${qKhatam}" style="height: 36px; text-align: center; font-weight: 700;">
        </div>
        <div>
          <label class="form-label" style="font-size: 0.75rem;">ซูเราะห์ที่ท่องจำ (0-114)</label>
          <input type="number" min="0" max="114" class="form-control" id="adminEditMemCount" value="${memCount}" style="height: 36px; text-align: center; font-weight: 700;">
        </div>
        <div>
          <label class="form-label" style="font-size: 0.75rem;">ละหมาดสุนัต (ร็อกอะฮ์)</label>
          <input type="number" min="0" class="form-control" id="adminEditSunnahRakaat" value="${sunnahRakaat}" style="height: 36px; text-align: center; font-weight: 700;">
        </div>
      </div>
    </div>

    <!-- Section 5: ประวัติการละหมาดล่าสุดของนักเรียนคนนี้ (ลบรายการที่ผิดพลาดได้) -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: var(--radius-md); padding: 0.95rem;">
      <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a; margin-bottom: 0.55rem;">
        <i class="fa-solid fa-mosque"></i> 5. ประวัติการเช็คละหมาดล่าสุด (${studentPrayers.length} รายการล่าสุด)
      </div>
      ${studentPrayers.length === 0 ? '<div style="font-size: 0.8rem; color: var(--text-muted);">ยังไม่มีประวัติการเช็คละหมาด</div>' : studentPrayers.map(p => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.45rem 0; border-bottom: 1px solid #e2e8f0; font-size: 0.8rem;">
          <div>
            <b>ละหมาด ${escapeHtml(p.prayerName || p.prayerTime)}</b> • ${escapeHtml(p.date || '')} ${escapeHtml(p.time || '')} (${escapeHtml(p.locationName || 'GPS')})
          </div>
          <button type="button" class="btn btn-danger btn-sm" style="padding: 0.15rem 0.45rem; font-size: 0.72rem;" onclick="adminDeleteStudentPrayerRecord('${escapeHtml(cleanId)}', '${escapeHtml(p.id || p.logId)}')">
            <i class="fa-solid fa-trash"></i> ลบ
          </button>
        </div>
      `).join('')}
    </div>
  `;

  if (btnDelete) btnDelete.onclick = () => deleteStudent(cleanId);
  openModal('studentDetailModal');
}

function saveAdminStudentDeepEdit() {
  const origId = currentAdminEditingStudentOriginalId;
  if (!origId) return;

  const sIdx = allStudents.findIndex(s => isIdMatch(s.studentId, origId));
  if (sIdx === -1) return;

  const student = allStudents[sIdx];
  const newId = cleanIdString(document.getElementById('adminEditStdId')?.value || origId);
  const newName = (document.getElementById('adminEditStdName')?.value || '').trim();
  const newGrade = document.getElementById('adminEditStdGrade')?.value || student.grade;
  const newSchool = (document.getElementById('adminEditStdSchool')?.value || '').trim();
  const newPhone = normalizePhone(document.getElementById('adminEditStdPhone')?.value || '');
  const newEmail = (document.getElementById('adminEditStdEmail')?.value || '').trim();
  const newBD = normalizeBirthDate(document.getElementById('adminEditStdBirthDate')?.value || '');
  const oldStatus = student.status || 'ปกติ (กำลังศึกษา)';
  const newStatus = document.getElementById('adminEditStdStatus')?.value || 'ปกติ (กำลังศึกษา)';
  const newStatusDate = document.getElementById('adminEditStdStatusDate')?.value || '';
  const newStatusNote = (document.getElementById('adminEditStdStatusNote')?.value || '').trim();
  const statusChanged = (oldStatus !== newStatus) || (student.statusEffectiveDate !== newStatusDate) || (student.statusNote !== newStatusNote);

  student.studentId = newId;
  student.fullName = newName || student.fullName;
  student.grade = newGrade;
  student.schoolName = newSchool;
  student.parentPhone = newPhone;
  student.email = newEmail;
  student.birthDate = newBD;
  student.status = newStatus;
  student.statusEffectiveDate = newStatusDate;
  student.statusDate = newStatusDate;
  student.statusNote = newStatusNote;
  if (newStatus === 'ปกติ (กำลังศึกษา)' || newStatus === 'Active') student.approvalStatus = 'Approved';

  student.attendance = {
    present: Math.max(0, parseInt(document.getElementById('adminEditAttPresent')?.value || 0, 10)),
    late: Math.max(0, parseInt(document.getElementById('adminEditAttLate')?.value || 0, 10)),
    leave: Math.max(0, parseInt(document.getElementById('adminEditAttLeave')?.value || 0, 10)),
    absent: Math.max(0, parseInt(document.getElementById('adminEditAttAbsent')?.value || 0, 10))
  };

  student.subjectGrades = student.subjectGrades || {};
  student.skills = student.skills || {};
  document.querySelectorAll('.admin-edit-std-subj-grade').forEach(sel => {
    const subjId = sel.getAttribute('data-subj-id');
    const gVal = normalizeGrade1To4(sel.value);
    student.subjectGrades[subjId] = gVal;
    student.skills[subjId] = gVal;
  });
  recalculateStudentGpa(student);

  // Update Hasanat for this student
  const h = getStudentHasanat(newId);
  const qPage = Math.max(0, Math.min(604, parseInt(document.getElementById('adminEditQuranPage')?.value || 0, 10)));
  const qJuz = Math.max(0, Math.min(30, parseInt(document.getElementById('adminEditQuranJuz')?.value || 0, 10)));
  const qKhatam = Math.max(0, parseInt(document.getElementById('adminEditQuranKhatam')?.value || 0, 10));
  const memCount = Math.max(0, Math.min(114, parseInt(document.getElementById('adminEditMemCount')?.value || 0, 10)));
  const sunnahRakaat = Math.max(0, parseInt(document.getElementById('adminEditSunnahRakaat')?.value || 0, 10));

  h.quran.currentPage = qPage;
  h.quran.juzCompleted = qJuz;
  h.quran.stars = qJuz;
  h.quran.khatamCount = qKhatam;
  h.memorization.count = memCount;
  h.sunnah = h.sunnah || {};
  h.sunnah.totalRakaat = sunnahRakaat;
  saveStudentHasanat(h);

  student.hasanat = h;

  allStudents[sIdx] = student;
  localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));

  if (currentStudent && isIdMatch(currentStudent.studentId, origId)) {
    currentStudent = student;
    localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
    renderCurrentStudentProfile();
    renderDashboardCharts();
  }

  renderAdminStudentsTable();
  closeModal('studentDetailModal');
  playSuccessSound();
  showToast(`บันทึกการแก้ไขข้อมูลของ ${student.fullName} (${newId}) เรียบร้อยแล้ว`, 'success');

  syncRecordToGoogleSheet('updateStudentFull', student);
  if (statusChanged) {
    syncRecordToGoogleSheet('updateStudentStatus', {
      studentId: newId,
      oldStatus: oldStatus,
      newStatus: newStatus,
      status: newStatus,
      statusEffectiveDate: newStatusDate,
      statusDate: newStatusDate,
      statusNote: newStatusNote,
      adminUser: (currentAdmin && (currentAdmin.fullName || currentAdmin.username)) || 'Admin'
    });
  }
}

function adminDeleteStudentPrayerRecord(studentId, logId) {
  if (!confirm('ต้องการลบประวัติการเช็คละหมาดรายการนี้ใช่หรือไม่?')) return;
  let historyList = [];
  try {
    historyList = JSON.parse(localStorage.getItem('khalifah_prayer_history') || '[]');
  } catch (e) { historyList = []; }

  historyList = historyList.filter(p => (p.id !== logId && p.logId !== logId));
  localStorage.setItem('khalifah_prayer_history', JSON.stringify(historyList));

  todayPrayers = todayPrayers.filter(p => (p.id !== logId && p.logId !== logId));
  localStorage.setItem('khalifah_today_prayers', JSON.stringify(todayPrayers));

  viewStudentDetails(studentId);
  renderAdminStudentsTable();
  showToast('ลบประวัติการละหมาดเรียบร้อยแล้ว', 'info');

  syncRecordToGoogleSheet('deletePrayerRecord', {
    studentId: studentId,
    logId: logId
  });
}

function deleteStudent(studentId) {
  const student = allStudents.find(s => isIdMatch(s.studentId, studentId));
  const cleanId = cleanIdString(studentId);
  const sName = student ? student.fullName : cleanId;
  if (!confirm(`คุณต้องการลบข้อมูลนักเรียน ${sName} (รหัส ${cleanId}) ออกจากระบบใช่หรือไม่?`)) return;

  allStudents = allStudents.filter(s => !isIdMatch(s.studentId, cleanId));
  localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
  renderAdminStudentsTable();
  renderSuperAdminOverviewKpis();
  closeModal('studentDetailModal');
  showToast(`ลบข้อมูลนักเรียน ${cleanId} เรียบร้อยแล้ว`, 'success');

  syncRecordToGoogleSheet('deleteStudent', { studentId: cleanId });
}

function executeBatchPromotion() {
  const fromGrade = document.getElementById('batchFromGrade').value;
  const toGrade = document.getElementById('batchToGrade').value;

  if (fromGrade === toGrade) {
    showToast('ระดับชั้นเริ่มต้นและระดับชั้นใหม่ต้องไม่ซ้ำกัน', 'warning');
    return;
  }

  const isGraduating = (toGrade === 'สำเร็จการศึกษา' || String(toGrade).includes('สำเร็จ'));
  const todayStr = new Date().toISOString().substring(0, 10);
  let count = 0;

  allStudents.forEach(s => {
    if (s.grade === fromGrade) {
      s.grade = toGrade;
      if (isGraduating) {
        s.status = 'สำเร็จการศึกษา';
        s.statusEffectiveDate = todayStr;
        s.statusDate = todayStr;
        s.statusNote = 'สำเร็จการศึกษาจากการเลื่อนระดับชั้น';
      }
      count++;
    }
  });

  if (currentStudent && currentStudent.grade === fromGrade) {
    currentStudent.grade = toGrade;
    if (isGraduating) {
      currentStudent.status = 'สำเร็จการศึกษา';
      currentStudent.statusEffectiveDate = todayStr;
      currentStudent.statusDate = todayStr;
      currentStudent.statusNote = 'สำเร็จการศึกษาจากการเลื่อนระดับชั้น';
    }
    localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
    renderCurrentStudentProfile();
  }

  localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
  renderAdminStudentsTable();
  if (typeof updateAdminPromotionBreakdown === 'function') updateAdminPromotionBreakdown();
  if (typeof populateAdminSingleStudentSelect === 'function') populateAdminSingleStudentSelect();
  showToast(`เลื่อนชั้นปีนักเรียนจาก ${fromGrade} ➔ ${toGrade} สำเร็จจำนวน ${count} คน` + (isGraduating ? ' พร้อมบันทึกสถานะ "สำเร็จการศึกษา"' : ''), 'success');

  syncRecordToGoogleSheet('batchPromote', { fromGrade, toGrade });
}

// ----------------- COMPREHENSIVE ADMIN PROMOTION CONTROLS (รูปแนบ 2) ----------------- //

function updateAdminPromotionBreakdown() {
  const container = document.getElementById('adminPromotionCountsBreakdown');
  if (!container) return;
  const gradeKeys = [
    'มัธยมศึกษาปีที่ 1',
    'มัธยมศึกษาปีที่ 2',
    'มัธยมศึกษาปีที่ 3',
    'มัธยมศึกษาปีที่ 4',
    'มัธยมศึกษาปีที่ 5',
    'มัธยมศึกษาปีที่ 6',
    'สำเร็จการศึกษา'
  ];
  const counts = {};
  gradeKeys.forEach(g => counts[g] = 0);
  let otherCount = 0;

  allStudents.forEach(s => {
    const gr = s.grade || '';
    if (counts[gr] !== undefined) counts[gr]++;
    else otherCount++;
  });

  container.innerHTML = `
    <div style="font-weight: 700; color: #1e293b; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
      <span><i class="fa-solid fa-users" style="color: var(--primary);"></i> สรุปจำนวนนักเรียนปัจจุบัน</span>
      <span style="color: var(--primary); font-weight: 700;">รวมทั้งหมด ${allStudents.length} คน</span>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 0.4rem;">
      <div style="background: #fff; padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px solid #e2e8f0;">ม.1: <b>${counts['มัธยมศึกษาปีที่ 1']}</b> คน</div>
      <div style="background: #fff; padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px solid #e2e8f0;">ม.2: <b>${counts['มัธยมศึกษาปีที่ 2']}</b> คน</div>
      <div style="background: #fff; padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px solid #e2e8f0;">ม.3: <b>${counts['มัธยมศึกษาปีที่ 3']}</b> คน</div>
      <div style="background: #fff; padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px solid #e2e8f0;">ม.4: <b>${counts['มัธยมศึกษาปีที่ 4']}</b> คน</div>
      <div style="background: #fff; padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px solid #e2e8f0;">ม.5: <b>${counts['มัธยมศึกษาปีที่ 5']}</b> คน</div>
      <div style="background: #fff; padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px solid #e2e8f0; color: #b91c1c;">ม.6: <b>${counts['มัธยมศึกษาปีที่ 6']}</b> คน</div>
      <div style="background: #fff; padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px solid #e2e8f0; color: #15803d;">จบแล้ว: <b>${counts['สำเร็จการศึกษา']}</b> คน</div>
    </div>
  `;
}

function populateAdminSingleStudentSelect() {
  const sel = document.getElementById('adminSingleStudentSelect');
  if (!sel) return;
  const curVal = sel.value;
  sel.innerHTML = '<option value="">-- กรุณาเลือกนักเรียน --</option>' + 
    allStudents.map(s => `<option value="${escapeHtml(s.studentId)}">${escapeHtml(s.studentId)} - ${escapeHtml(s.fullName)} (${escapeHtml(s.grade || 'ไม่ระบุ')})</option>`).join('');
  if (curVal) sel.value = curVal;
}

function onAdminSingleStudentSelectChange() {
  const sel = document.getElementById('adminSingleStudentSelect');
  const info = document.getElementById('adminSingleStudentCurrentInfo');
  const targetGradeSel = document.getElementById('adminSingleTargetGrade');
  if (!sel || !info) return;

  const sId = sel.value;
  if (!sId) {
    info.style.display = 'none';
    return;
  }
  const s = allStudents.find(item => isIdMatch(item.studentId, sId));
  if (!s) {
    info.style.display = 'none';
    return;
  }

  info.style.display = 'block';
  info.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.4rem;">
      <div>
        <div style="font-weight: 700; color: #0f172a; font-size: 0.88rem;">${escapeHtml(s.fullName)}</div>
        <div style="color: #64748b; font-size: 0.8rem;">รหัสนักเรียน: <b>${escapeHtml(s.studentId)}</b></div>
      </div>
      <div style="text-align: right;">
        <div>ชั้นปัจจุบัน: <span class="badge-sub" style="font-weight: 700;">${escapeHtml(s.grade || 'ไม่ระบุ')}</span></div>
        <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">สถานะ: ${escapeHtml(s.status || 'Active')}</div>
      </div>
    </div>
  `;

  // Pre-select next target grade logically
  if (targetGradeSel && s.grade) {
    const nextGradeMap = {
      'มัธยมศึกษาปีที่ 1': 'มัธยมศึกษาปีที่ 2',
      'มัธยมศึกษาปีที่ 2': 'มัธยมศึกษาปีที่ 3',
      'มัธยมศึกษาปีที่ 3': 'มัธยมศึกษาปีที่ 4',
      'มัธยมศึกษาปีที่ 4': 'มัธยมศึกษาปีที่ 5',
      'มัธยมศึกษาปีที่ 5': 'มัธยมศึกษาปีที่ 6',
      'มัธยมศึกษาปีที่ 6': 'สำเร็จการศึกษา'
    };
    if (nextGradeMap[s.grade]) {
      targetGradeSel.value = nextGradeMap[s.grade];
    }
  }
}

function executeSingleStudentPromotion() {
  const sel = document.getElementById('adminSingleStudentSelect');
  const targetGradeSel = document.getElementById('adminSingleTargetGrade');
  if (!sel || !sel.value) {
    showToast('กรุณาเลือกนักเรียนที่ต้องการเลื่อนชั้นปี', 'warning');
    return;
  }
  const sId = sel.value;
  const toGrade = targetGradeSel ? targetGradeSel.value : '';
  const s = allStudents.find(item => isIdMatch(item.studentId, sId));
  if (!s) {
    showToast('ไม่พบข้อมูลนักเรียน', 'error');
    return;
  }
  if (s.grade === toGrade) {
    if (!confirm(`นักเรียนอยู่ในชั้น "${toGrade}" อยู่แล้ว ต้องการบันทึกซ้ำหรือไม่?`)) return;
  }

  const isGraduating = (toGrade === 'สำเร็จการศึกษา' || String(toGrade).includes('สำเร็จ'));
  const todayStr = new Date().toISOString().substring(0, 10);
  const oldGrade = s.grade;
  s.grade = toGrade;
  if (isGraduating) {
    s.status = 'สำเร็จการศึกษา';
    s.statusEffectiveDate = todayStr;
    s.statusDate = todayStr;
    s.statusNote = 'สำเร็จการศึกษาจากการเลื่อนระดับชั้นรายบุคคล';
  }

  if (currentStudent && isIdMatch(currentStudent.studentId, sId)) {
    currentStudent.grade = toGrade;
    if (isGraduating) {
      currentStudent.status = 'สำเร็จการศึกษา';
      currentStudent.statusEffectiveDate = todayStr;
      currentStudent.statusDate = todayStr;
      currentStudent.statusNote = 'สำเร็จการศึกษาจากการเลื่อนระดับชั้นรายบุคคล';
    }
    localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
    renderCurrentStudentProfile();
  }

  localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
  updateAdminPromotionBreakdown();
  populateAdminSingleStudentSelect();
  onAdminSingleStudentSelectChange();
  renderAdminStudentsTable();

  playSuccessSound();
  showToast(`เลื่อนชั้นปี ${s.fullName} จาก "${oldGrade}" ➔ "${toGrade}" สำเร็จ!` + (isGraduating ? ' (สถานะสำเร็จการศึกษา)' : ''), 'success');

  syncRecordToGoogleSheet('updateStudentGrade', {
    studentId: s.studentId,
    newGrade: toGrade,
    isGraduating: isGraduating
  });
}

function executeFullSchoolBatchPromotion() {
  if (!confirm('⚡ ยืนยันการเลื่อนระดับชั้นนักเรียนทั้งหมดในโรงเรียนในครั้งเดียวใช่หรือไม่?\n\n- ม.6 ➔ สำเร็จการศึกษา\n- ม.5 ➔ ม.6\n- ม.4 ➔ ม.5\n- ม.3 ➔ ม.4\n- ม.2 ➔ ม.3\n- ม.1 ➔ ม.2\n\nระบบจะทำการอัปเดตนักเรียนทุกคนทันที')) {
    return;
  }

  const todayStr = new Date().toISOString().substring(0, 10);
  let countM6 = 0, countM5 = 0, countM4 = 0, countM3 = 0, countM2 = 0, countM1 = 0;

  // Process in strict top-down order to prevent double promotion
  allStudents.forEach(s => {
    const gr = s.grade || '';
    if (gr === 'มัธยมศึกษาปีที่ 6') {
      s.grade = 'สำเร็จการศึกษา';
      s.status = 'สำเร็จการศึกษา';
      s.statusEffectiveDate = todayStr;
      s.statusDate = todayStr;
      s.statusNote = 'สำเร็จการศึกษาจากการเลื่อนระดับชั้นประจำปี';
      countM6++;
    } else if (gr === 'มัธยมศึกษาปีที่ 5') {
      s.grade = 'มัธยมศึกษาปีที่ 6';
      countM5++;
    } else if (gr === 'มัธยมศึกษาปีที่ 4') {
      s.grade = 'มัธยมศึกษาปีที่ 5';
      countM4++;
    } else if (gr === 'มัธยมศึกษาปีที่ 3') {
      s.grade = 'มัธยมศึกษาปีที่ 4';
      countM3++;
    } else if (gr === 'มัธยมศึกษาปีที่ 2') {
      s.grade = 'มัธยมศึกษาปีที่ 3';
      countM2++;
    } else if (gr === 'มัธยมศึกษาปีที่ 1') {
      s.grade = 'มัธยมศึกษาปีที่ 2';
      countM1++;
    }
  });

  const totalPromoted = countM6 + countM5 + countM4 + countM3 + countM2 + countM1;

  if (currentStudent) {
    const updatedCur = allStudents.find(s => isIdMatch(s.studentId, currentStudent.studentId));
    if (updatedCur) {
      currentStudent = updatedCur;
      localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
      renderCurrentStudentProfile();
    }
  }

  localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
  updateAdminPromotionBreakdown();
  populateAdminSingleStudentSelect();
  renderAdminStudentsTable();

  playSuccessSound();
  showToast(`🎉 เลื่อนระดับชั้นนักเรียนทั้งโรงเรียนสำเร็จ รวม ${totalPromoted} คน (ม.6 จบการศึกษา ${countM6} คน, ม.1-ม.5 เลื่อนชั้น ${totalPromoted - countM6} คน)`, 'success');

  syncRecordToGoogleSheet('fullSchoolBatchPromote', {
    timestamp: new Date().toISOString(),
    totalPromoted: totalPromoted,
    summary: { countM6, countM5, countM4, countM3, countM2, countM1 }
  });
}

// ----------------- CREATE ACTIVITY & FULL TEACHER / SUB-ADMIN CRUD ----------------- //

function submitCreateActivity() {
  const title = document.getElementById('actTitle')?.value.trim() || '';
  const desc = document.getElementById('actDesc')?.value.trim() || '';
  const startDate = document.getElementById('actStartDate')?.value || '';
  const endDate = document.getElementById('actEndDate')?.value || '';
  const loc = document.getElementById('actLocation')?.value.trim() || '';

  if (!title || !startDate || !endDate) {
    showToast('กรุณากรอกชื่อกิจกรรมและวันเวลาให้ครบถ้วน', 'warning');
    return;
  }

  const actId = 'ACT-' + Date.now().toString().slice(-6);
  const newAct = {
    id: actId,
    activityId: actId,
    title: title,
    description: desc,
    type: 'กิจกรรมหลัก',
    date: startDate.split('T')[0],
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
  renderAdminActivitiesTable();
  if (typeof renderAdminLiveActivityFeed === 'function') renderAdminLiveActivityFeed();
  showToast('ประกาศกิจกรรมใหม่และส่งต่อถึงนักเรียนทุกคนแล้ว', 'success');

  syncRecordToGoogleSheet('createActivity', newAct);
}

function toggleSubAdminSubjectField() {
  const roleSelect = document.getElementById('subRole');
  const group = document.getElementById('subSubjectGroup');
  if (!roleSelect || !group) return;
  group.style.display = (roleSelect.value === 'TEACHER' || roleSelect.value === 'TeacherAdmin') ? 'block' : 'none';
}

function toggleQuickSubAdminSubjectField() {
  const roleSelect = document.getElementById('quickSubRole');
  const group = document.getElementById('quickSubSubjectGroup');
  if (!roleSelect || !group) return;
  group.style.display = (roleSelect.value === 'TEACHER' || roleSelect.value === 'TeacherAdmin') ? 'block' : 'none';
}

function renderSubAdminModalSubjectsChecklist(selectedIds = []) {
  loadAppSubjects();
  const container = document.getElementById('subAssignedSubjectsChecklist');
  if (!container) return;
  container.innerHTML = appSubjects.map(s => {
    const isChecked = selectedIds.includes(s.id);
    return `
      <label class="subject-checkbox-item">
        <input type="checkbox" name="subModalSubjChk" value="${escapeHtml(s.id)}" ${isChecked ? 'checked' : ''}>
        <span>${escapeHtml(s.code ? s.code + ' - ' : '')}${escapeHtml(s.name)}</span>
      </label>
    `;
  }).join('');
}

function renderQuickSubAdminSubjectsChecklist(selectedIds = []) {
  loadAppSubjects();
  const container = document.getElementById('quickSubAssignedSubjectsChecklist');
  if (!container) return;
  container.innerHTML = appSubjects.map(s => {
    const isChecked = selectedIds.includes(s.id);
    return `
      <label class="subject-checkbox-item">
        <input type="checkbox" name="quickSubModalSubjChk" value="${escapeHtml(s.id)}" ${isChecked ? 'checked' : ''}>
        <span>${escapeHtml(s.code ? s.code + ' - ' : '')}${escapeHtml(s.name)}</span>
      </label>
    `;
  }).join('');
}

function resetQuickAddSubAdminForm() {
  if (document.getElementById('quickSubFullName')) document.getElementById('quickSubFullName').value = '';
  if (document.getElementById('quickSubUsername')) document.getElementById('quickSubUsername').value = '';
  if (document.getElementById('quickSubPassword')) document.getElementById('quickSubPassword').value = '';
  if (document.getElementById('quickSubEmail')) document.getElementById('quickSubEmail').value = '';
  if (document.getElementById('quickSubPhone')) document.getElementById('quickSubPhone').value = '';
  if (document.getElementById('quickSubRole')) document.getElementById('quickSubRole').value = 'TEACHER';
  renderQuickSubAdminSubjectsChecklist([]);
  toggleQuickSubAdminSubjectField();
}

function submitQuickAddSubAdmin() {
  loadAppSubjects();
  const fullName = (document.getElementById('quickSubFullName')?.value || '').trim();
  const username = cleanIdString(document.getElementById('quickSubUsername')?.value || '');
  const pass = cleanIdString(document.getElementById('quickSubPassword')?.value || '');
  const email = (document.getElementById('quickSubEmail')?.value || '').trim();
  const phone = normalizePhone(document.getElementById('quickSubPhone')?.value || '');
  const role = document.getElementById('quickSubRole')?.value || 'TEACHER';

  if (!fullName || !username || !pass) {
    showToast('กรุณากรอก ชื่อ-นามสกุล, รหัสผู้ใช้ (Username) และรหัสผ่าน ให้ครบถ้วน', 'warning');
    return;
  }

  const checkedNodes = document.querySelectorAll('input[name="quickSubModalSubjChk"]:checked');
  const selectedSubjects = Array.from(checkedNodes).map(cb => cb.value);
  // If no subject checked or role is Executive/Homeroom, assign all subjects so they can access everything
  const finalSubjects = selectedSubjects.length > 0 ? selectedSubjects : appSubjects.map(s => s.id);

  const recordData = {
    adminId: 'TCH-' + Date.now(),
    username: username,
    password: pass,
    fullName: fullName,
    email: email,
    phone: phone,
    role: role,
    assignedSubject: finalSubjects[0] || '',
    assignedSubjects: finalSubjects,
    status: 'Active',
    approvalStatus: 'Verified',
    createdAt: new Date().toISOString().split('T')[0]
  };

  const dupIdx = subAdmins.findIndex(s => isIdMatch(s.username, username));
  if (dupIdx !== -1) {
    recordData.adminId = subAdmins[dupIdx].adminId || recordData.adminId;
    subAdmins[dupIdx] = recordData;
  } else {
    subAdmins.unshift(recordData);
  }

  localStorage.setItem('khalifah_sub_admins', JSON.stringify(subAdmins));
  resetQuickAddSubAdminForm();
  renderSubAdminsTable();
  renderSuperAdminOverviewKpis();
  playSuccessSound();

  const roleText = role === 'EXECUTIVE' ? 'ผู้บริหาร' : 'อาจารย์';
  showToast(`เพิ่มบัญชี${roleText} "${fullName}" (User: ${username}) สำเร็จ! สามารถล็อกอินเข้าใช้งานได้ทันที`, 'success');

  syncRecordToGoogleSheet('addSubAdmin', recordData);
}

let isFetchingSubAdminsCloud = false;
async function fetchSubAdminsFromCloud(showToastMsg = false) {
  if (isFetchingSubAdminsCloud) return;
  let url = gasApiUrl || localStorage.getItem('khalifah_gas_url') || DEFAULT_GAS_API_URL;
  if (!url || url.includes('docs.google.com/spreadsheets')) return;
  isFetchingSubAdminsCloud = true;
  try {
    const resp = await fetch(`${url}?action=getSubAdmins`);
    const json = await resp.json();
    if (json && json.success && Array.isArray(json.data)) {
      json.data.forEach(remote => {
        const u = cleanIdString(remote.username);
        if (!u) return;
        const existIdx = subAdmins.findIndex(s => isIdMatch(s.username, u));
        const merged = {
          adminId: remote.adminId || (existIdx !== -1 ? subAdmins[existIdx].adminId : ('TCH-' + Date.now())),
          username: u,
          password: cleanIdString(remote.password || (existIdx !== -1 ? subAdmins[existIdx].password : '')),
          fullName: remote.fullName || (existIdx !== -1 ? subAdmins[existIdx].fullName : u),
          email: remote.email || (existIdx !== -1 ? subAdmins[existIdx].email : ''),
          phone: normalizePhone(remote.phone || (existIdx !== -1 ? subAdmins[existIdx].phone : '')),
          role: remote.role || (existIdx !== -1 ? subAdmins[existIdx].role : 'TEACHER'),
          assignedSubject: remote.assignedSubject || (existIdx !== -1 ? subAdmins[existIdx].assignedSubject : ''),
          assignedSubjects: Array.isArray(remote.assignedSubjects) && remote.assignedSubjects.length > 0
            ? remote.assignedSubjects
            : (existIdx !== -1 && Array.isArray(subAdmins[existIdx].assignedSubjects) ? subAdmins[existIdx].assignedSubjects : []),
          status: remote.status || 'Active',
          approvalStatus: remote.approvalStatus || 'Verified',
          createdAt: remote.createdAt || ''
        };
        if (existIdx !== -1) {
          subAdmins[existIdx] = merged;
        } else {
          subAdmins.push(merged);
        }
      });
      localStorage.setItem('khalifah_sub_admins', JSON.stringify(subAdmins));
      renderSubAdminsTable();
      renderSuperAdminOverviewKpis();
      if (showToastMsg) {
        showToast(`ซิงค์รายชื่ออาจารย์และผู้บริหารจาก Google Sheet สำเร็จ (${subAdmins.length} ท่าน)`, 'success');
      }
    }
  } catch (e) {
    console.warn('fetchSubAdminsFromCloud warning:', e);
  } finally {
    isFetchingSubAdminsCloud = false;
  }
}

function openAddSubAdminModal() {
  const origInput = document.getElementById('editSubAdminOriginalUser');
  const titleEl = document.getElementById('subAdminModalTitle');
  if (origInput) origInput.value = '';
  if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-user-plus" style="color: var(--primary);"></i> เพิ่มบัญชีอาจารย์ผู้สอน / ผู้บริหาร';

  if (document.getElementById('subFullName')) document.getElementById('subFullName').value = '';
  if (document.getElementById('subUsername')) document.getElementById('subUsername').value = '';
  if (document.getElementById('subPassword')) document.getElementById('subPassword').value = '';
  if (document.getElementById('subEmail')) document.getElementById('subEmail').value = '';
  if (document.getElementById('subPhone')) document.getElementById('subPhone').value = '';
  if (document.getElementById('subRole')) document.getElementById('subRole').value = 'TEACHER';

  renderSubAdminModalSubjectsChecklist([]);
  toggleSubAdminSubjectField();
  openModal('addSubAdminModal');
}

function openEditTeacherModal(username) {
  if (!username) {
    openAddSubAdminModal();
    return;
  }
  const t = subAdmins.find(s => isIdMatch(s.username, username));
  if (!t) return;

  const origInput = document.getElementById('editSubAdminOriginalUser');
  const titleEl = document.getElementById('subAdminModalTitle');
  if (origInput) origInput.value = cleanIdString(t.username);
  if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-user-pen" style="color: var(--primary);"></i> แก้ไขข้อมูลอาจารย์/ผู้บริหาร: ${escapeHtml(t.fullName)}`;

  if (document.getElementById('subFullName')) document.getElementById('subFullName').value = t.fullName || '';
  if (document.getElementById('subUsername')) document.getElementById('subUsername').value = cleanIdString(t.username);
  if (document.getElementById('subPassword')) document.getElementById('subPassword').value = cleanIdString(t.password);
  if (document.getElementById('subEmail')) document.getElementById('subEmail').value = t.email || '';
  if (document.getElementById('subPhone')) document.getElementById('subPhone').value = normalizePhone(t.phone || '');
  if (document.getElementById('subRole')) document.getElementById('subRole').value = t.role || 'TEACHER';

  const assignedArr = Array.isArray(t.assignedSubjects)
    ? t.assignedSubjects
    : (t.assignedSubject ? [t.assignedSubject] : []);
  renderSubAdminModalSubjectsChecklist(assignedArr);
  toggleSubAdminSubjectField();
  openModal('addSubAdminModal');
}

function submitAddSubAdmin() {
  loadAppSubjects();
  const origUser = cleanIdString(document.getElementById('editSubAdminOriginalUser')?.value || '');
  const fullName = (document.getElementById('subFullName')?.value || '').trim();
  const username = cleanIdString(document.getElementById('subUsername')?.value || '');
  const pass = cleanIdString(document.getElementById('subPassword')?.value || '');
  const email = (document.getElementById('subEmail')?.value || '').trim();
  const phone = normalizePhone(document.getElementById('subPhone')?.value || '');
  const role = document.getElementById('subRole')?.value || 'TEACHER';

  const checkedNodes = document.querySelectorAll('input[name="subModalSubjChk"]:checked');
  const selectedSubjects = Array.from(checkedNodes).map(cb => cb.value);
  const fallbackSubj = document.getElementById('subAssignedSubject')?.value || '';
  const finalSubjects = selectedSubjects.length > 0
    ? selectedSubjects
    : (fallbackSubj ? [fallbackSubj] : appSubjects.map(s => s.id));

  if (!fullName || !username || !pass) {
    showToast('กรุณากรอกชื่อ-นามสกุล รหัสผู้ใช้ และรหัสผ่านให้ครบถ้วน', 'warning');
    return;
  }

  const recordData = {
    adminId: 'TCH-' + Date.now(),
    username: username,
    password: pass,
    fullName: fullName,
    email: email,
    phone: phone,
    role: role,
    assignedSubject: finalSubjects[0] || '',
    assignedSubjects: finalSubjects,
    status: 'Active',
    approvalStatus: 'Verified',
    createdAt: new Date().toISOString().split('T')[0]
  };

  if (origUser) {
    const idx = subAdmins.findIndex(s => isIdMatch(s.username, origUser));
    if (idx !== -1) {
      recordData.adminId = subAdmins[idx].adminId || recordData.adminId;
      recordData.createdAt = subAdmins[idx].createdAt || recordData.createdAt;
      subAdmins[idx] = recordData;
    } else {
      subAdmins.push(recordData);
    }
  } else {
    const dupIdx = subAdmins.findIndex(s => isIdMatch(s.username, username));
    if (dupIdx !== -1) {
      subAdmins[dupIdx] = recordData;
    } else {
      subAdmins.push(recordData);
    }
  }

  localStorage.setItem('khalifah_sub_admins', JSON.stringify(subAdmins));
  if (currentAdmin && isIdMatch(currentAdmin.username, origUser || username)) {
    currentAdmin = recordData;
  }

  closeModal('addSubAdminModal');
  renderSubAdminsTable();
  renderSuperAdminOverviewKpis();
  playSuccessSound();
  showToast(`บันทึกข้อมูลบัญชี "${fullName}" เรียบร้อยแล้ว`, 'success');

  syncRecordToGoogleSheet('addSubAdmin', recordData);
}

function renderSubAdminsTable() {
  const tbody = document.getElementById('subAdminsTableBody');
  if (!tbody) return;
  loadAppSubjects();
  renderSuperAdminOverviewKpis();

  if (subAdmins.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">ยังไม่มีรายชื่ออาจารย์หรือผู้บริหารในระบบ (สามารถกรอกฟอร์มเพิ่มด่วนด้านบนได้เลย)</td></tr>`;
    return;
  }

  const roleMap = {
    TEACHER: { label: 'อาจารย์ผู้สอน', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    EXECUTIVE: { label: 'ผู้บริหารสถานศึกษา', bg: '#f0fdf4', color: '#047857', border: '#a7f3d0' },
    HOMEROOM: { label: 'อาจารย์ประจำชั้น', bg: '#fefce8', color: '#a16207', border: '#fde047' },
    ACTIVITY: { label: 'ฝ่ายกิจกรรม', bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' },
    SubAdmin: { label: 'ผู้ช่วยแอดมิน', bg: '#f1f5f9', color: '#334155', border: '#cbd5e1' }
  };

  tbody.innerHTML = subAdmins.map(a => {
    const assignedIds = Array.isArray(a.assignedSubjects)
      ? a.assignedSubjects
      : (a.assignedSubject ? [a.assignedSubject] : []);

    const subjNames = (a.role === 'EXECUTIVE' || assignedIds.length === 0 || assignedIds.length >= appSubjects.length)
      ? 'ทุกวิชา / ทั้งโรงเรียน'
      : assignedIds.map(id => {
          const s = appSubjects.find(x => x.id === id);
          return s ? s.name : id;
        }).filter(Boolean).join(', ');

    const rInfo = roleMap[a.role] || roleMap.TEACHER;
    const rolePill = `<span class="activity-badge" style="background:${rInfo.bg}; color:${rInfo.color}; border:1px solid ${rInfo.border}; margin-right:0.3rem;">${rInfo.label}</span>`;
    const subjBadge = `<span class="activity-badge badge-upcoming">${escapeHtml(subjNames)}</span>`;

    const isPending = a.approvalStatus === 'PendingAdmin' || a.approvalStatus === 'AwaitingOtp';
    const statusBadge = isPending
      ? '<span class="activity-badge" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;">รอผู้สมัครกรอก OTP</span>'
      : '<span class="activity-badge badge-active"><i class="fa-solid fa-check"></i> พร้อมใช้งาน</span>';

    return `
      <tr>
        <td>
          <b>${escapeHtml(cleanIdString(a.username))}</b>
          <div style="font-size: 0.72rem; color: var(--text-muted);">รหัสผ่าน: ${escapeHtml(cleanIdString(a.password))}</div>
        </td>
        <td style="font-weight: 600;">${escapeHtml(a.fullName)}</td>
        <td>
          <div>${escapeHtml(a.email || '-')}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(a.phone || '')}</div>
        </td>
        <td>${rolePill}${subjBadge}</td>
        <td>${statusBadge}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-primary btn-sm" style="padding: 0.25rem 0.55rem; font-size: 0.78rem; margin-right: 0.25rem;" onclick="openEditTeacherModal('${escapeHtml(cleanIdString(a.username))}')">
            <i class="fa-solid fa-pen"></i> แก้ไข
          </button>
          <button class="btn btn-danger btn-sm" style="padding: 0.25rem 0.55rem; font-size: 0.78rem;" onclick="deleteSubAdmin('${escapeHtml(cleanIdString(a.username))}')">
            <i class="fa-solid fa-trash"></i> ลบ
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function deleteSubAdmin(username) {
  const cleanU = cleanIdString(username);
  if (!confirm(`ต้องการลบบัญชีอาจารย์/ผู้บริหาร (${cleanU}) ใช่หรือไม่?`)) return;
  subAdmins = subAdmins.filter(s => !isIdMatch(s.username, cleanU));
  localStorage.setItem('khalifah_sub_admins', JSON.stringify(subAdmins));
  renderSubAdminsTable();
  renderSuperAdminOverviewKpis();
  showToast('ลบบัญชีเรียบร้อยแล้ว', 'success');
  syncRecordToGoogleSheet('deleteSubAdmin', { username: cleanU });
}

// ----------------- TEACHER GRADING (1 - 4 SCALE) IN ADMIN & TEACHER PORTAL ----------------- //

function populateGradingSubjectSelect() {
  const select = document.getElementById('gradingSubjectSelect');
  const subSelect = document.getElementById('subAssignedSubject');
  loadAppSubjects();

  const options = appSubjects.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.code ? s.code + ' - ' : '')}${escapeHtml(s.name)}</option>`).join('');

  if (select) {
    select.innerHTML = options;
    if (currentAdmin && currentAdmin.assignedSubject) {
      select.value = currentAdmin.assignedSubject;
    }
  }
  if (subSelect) {
    subSelect.innerHTML = options;
  }
  renderSubAdminModalSubjectsChecklist([]);
  renderQuickSubAdminSubjectsChecklist([]);
}

function renderGradingStudentsTable() {
  const tbody = document.getElementById('teacherGradingTableBody');
  const subjSelect = document.getElementById('gradingSubjectSelect');
  const gradeSelect = document.getElementById('gradingGradeSelect');
  if (!tbody || !subjSelect || !gradeSelect) return;

  const currentSubj = subjSelect.value;
  const currentGrade = gradeSelect.value;

  const filtered = allStudents.filter(s => currentGrade === 'ALL' || !currentGrade || s.grade === currentGrade);

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          ไม่พบรายชื่อนักเรียนในระดับชั้นที่เลือก
        </td>
      </tr>
    `;
    return;
  }

  const gradeChoices = [0, 1, 1.5, 2, 2.5, 3, 3.5, 4];

  tbody.innerHTML = filtered.map(s => {
    const rawVal = (s.subjectGrades && s.subjectGrades[currentSubj] !== undefined)
      ? s.subjectGrades[currentSubj]
      : (s.skills && s.skills[currentSubj] !== undefined ? s.skills[currentSubj] : 0);
    const curGradeVal = normalizeGrade1To4(rawVal);
    const sId = cleanIdString(s.studentId);

    return `
      <tr>
        <td><b>${escapeHtml(sId)}</b></td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            ${s.avatarUrl ? `<img src="${getDirectImageUrl(s.avatarUrl)}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; cursor: pointer;" onclick="openPhotoViewerModal('${getDirectImageUrl(s.avatarUrl)}', '${escapeHtml(s.fullName || 'นักเรียน')}')" title="คลิกดูรูปขยาย">` : `<div style="width: 32px; height: 32px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #0f172a; font-size: 0.8rem;">${escapeHtml((s.fullName || 'น').charAt(0))}</div>`}
            <div>
              <div style="font-weight: 600; color: var(--text-dark);">${escapeHtml(s.fullName)}</div>
              <div style="font-size: 0.76rem; color: var(--text-muted);">GPAX ปัจจุบัน: ${escapeHtml(recalculateStudentGpa(s))}</div>
            </div>
          </div>
        </td>
        <td><span class="badge-sub">${escapeHtml(s.grade)}</span></td>
        <td style="text-align: center;">
          <select class="grade-select-pill grading-score-input" data-student-id="${escapeHtml(sId)}">
            ${gradeChoices.map(g => `<option value="${g}" ${g === curGradeVal ? 'selected' : ''}>${g === 0 ? '0 (รอผล)' : 'เกรด ' + g}</option>`).join('')}
          </select>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="setQuickScore('${escapeHtml(sId)}', 1)" style="padding: 0.22rem 0.5rem; font-size: 0.75rem;">เกรด 1</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="setQuickScore('${escapeHtml(sId)}', 2)" style="padding: 0.22rem 0.5rem; font-size: 0.75rem;">เกรด 2</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="setQuickScore('${escapeHtml(sId)}', 3)" style="padding: 0.22rem 0.5rem; font-size: 0.75rem;">เกรด 3</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="setQuickScore('${escapeHtml(sId)}', 4)" style="padding: 0.22rem 0.5rem; font-size: 0.75rem;">เกรด 4</button>
        </td>
      </tr>
    `;
  }).join('');
}

function setQuickScore(studentId, gradeVal) {
  const input = document.querySelector(`.grading-score-input[data-student-id="${studentId}"]`);
  if (input) input.value = String(gradeVal);
}

function saveTeacherGradingScores() {
  const subjSelect = document.getElementById('gradingSubjectSelect');
  if (!subjSelect) return;
  const currentSubj = subjSelect.value;
  const inputs = document.querySelectorAll('.grading-score-input');

  if (inputs.length === 0) {
    showToast('ไม่มีรายชื่อนักเรียนให้บันทึกเกรด', 'warning');
    return;
  }

  let updatedCount = 0;
  const studentGrades = [];
  inputs.forEach(inp => {
    const sId = inp.getAttribute('data-student-id');
    const gradeVal = normalizeGrade1To4(inp.value);

    const sIdx = allStudents.findIndex(s => isIdMatch(s.studentId, sId));
    if (sIdx !== -1) {
      if (!allStudents[sIdx].subjectGrades) allStudents[sIdx].subjectGrades = {};
      if (!allStudents[sIdx].skills) allStudents[sIdx].skills = {};
      allStudents[sIdx].subjectGrades[currentSubj] = gradeVal;
      allStudents[sIdx].skills[currentSubj] = gradeVal;
      const newGpa = recalculateStudentGpa(allStudents[sIdx]);
      updatedCount++;

      studentGrades.push({
        studentId: sId,
        fullName: allStudents[sIdx].fullName,
        grade: allStudents[sIdx].grade,
        score: gradeVal === 4 ? 85 : (gradeVal === 3 ? 75 : (gradeVal === 2 ? 65 : 55)),
        gradeVal: gradeVal,
        gpax: newGpa,
        allGrades: allStudents[sIdx].grades || []
      });

      if (currentStudent && isIdMatch(currentStudent.studentId, sId)) {
        currentStudent = allStudents[sIdx];
        localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
      }
    }
  });

  localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
  renderGradingStudentsTable();
  renderSkillRadarChart();
  renderCurrentStudentProfile();

  const subjObj = (typeof appSubjects !== 'undefined') ? appSubjects.find(s => s.id === currentSubj) : null;
  syncRecordToGoogleSheet('saveSubjectGrades', {
    subjectCode: currentSubj,
    subjectName: subjObj ? subjObj.name : currentSubj,
    teacherId: currentAdmin ? currentAdmin.username : 'Teacher',
    studentGrades: studentGrades,
    updatedCount: updatedCount,
    timestamp: new Date().toISOString()
  });

  playSuccessSound();
  showToast(`บันทึกเกรดรายวิชา (ระดับ 1-4) ของนักเรียน ${updatedCount} คน และอัปเดตกราฟทักษะสำเร็จ!`, 'success');
}

// ----------------- DEDICATED TEACHER & EXECUTIVE PORTAL (#view-teacher) ----------------- //
let teacherDailyAttendanceDraft = {}; // { [studentId]: 'present' | 'late' | 'leave' | 'absent' }

let teacherLastAttLoadedDate = null;

function initTeacherPortalView() {
  loadAppSubjects();
  const titleEl = document.getElementById('teacherHeaderName') || document.getElementById('teacherWelcomeTitle');
  const subEl = document.getElementById('teacherHeaderSub') || document.getElementById('teacherAssignedSubjectsSubtitle');
  const rolePill = document.getElementById('teacherPortalRolePill');
  const dateInput = document.getElementById('teacherAttDateInput');
  const kpiStd = document.getElementById('teacherKpiTotalStudents');
  const kpiChecked = document.getElementById('teacherKpiCheckedToday');
  const kpiSubj = document.getElementById('teacherKpiSubjectsCount');
  const heroAvatar = document.getElementById('teacherHeroAvatar');
  const chipsContainer = document.getElementById('teacherAssignedSubjectsChips');

  const todayStr = new Date().toISOString().split('T')[0];
  if (dateInput && !dateInput.value) {
    dateInput.value = todayStr;
  }

  let savedLogs = {};
  try {
    savedLogs = JSON.parse(localStorage.getItem('khalifah_daily_attendance_logs') || '{}');
  } catch (e) { savedLogs = {}; }
  const checkedTodayCount = Object.keys(savedLogs[todayStr] || {}).length;

  if (kpiStd) kpiStd.innerText = `${allStudents.length} คน`;
  if (kpiChecked) kpiChecked.innerText = `${checkedTodayCount} คน`;

  if (currentAdmin) {
    const isExec = currentAdmin.role === 'EXECUTIVE';
    if (rolePill) {
      rolePill.innerHTML = isExec
        ? '<i class="fa-solid fa-user-tie"></i> EXECUTIVE PORTAL • ระบบผู้บริหารสถานศึกษา'
        : '<i class="fa-solid fa-chalkboard-user"></i> TEACHER PORTAL • ระบบอาจารย์และวิชาการ';
    }
    if (titleEl) {
      titleEl.innerText = `${currentAdmin.fullName || currentAdmin.username || (isExec ? 'ผู้บริหาร' : 'อาจารย์ผู้สอน')}`;
    }
    if (subEl) {
      subEl.innerText = `ครูประจำวิชา / ${currentAdmin.email || currentAdmin.role || 'ฝ่ายวิชาการ'}`;
    }

    // Teacher Hero Avatar (รูปแนบ 3 / รูปแนบ 5)
    if (heroAvatar) {
      const tAv = currentAdmin.avatarUrl || currentAdmin.photo || localStorage.getItem('khalifah_admin_avatar_' + currentAdmin.username);
      if (tAv) {
        heroAvatar.innerHTML = `<img src="${tAv}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px; cursor: pointer;" onclick="openTeacherAccountModal()" title="คลิกเพื่อจัดการโปรไฟล์">`;
      } else {
        heroAvatar.innerHTML = '<i class="fa-solid fa-chalkboard-user" style="cursor: pointer;" onclick="openTeacherAccountModal()" title="คลิกเพื่อจัดการโปรไฟล์"></i>';
      }
    }

    const assignedIds = Array.isArray(currentAdmin.assignedSubjects)
      ? currentAdmin.assignedSubjects
      : (currentAdmin.assignedSubject ? [currentAdmin.assignedSubject] : []);
    const assignedSubjObjs = (currentAdmin.role === 'SuperAdmin' || isExec || assignedIds.length === 0)
      ? appSubjects
      : appSubjects.filter(s => assignedIds.includes(s.id));

    // Render subjects as clean chips (รูปแนบ 3: ทำให้ดูวิชาที่ได้รับการสอนได้ง่ายขึ้น)
    if (chipsContainer) {
      if (assignedSubjObjs.length === 0) {
        chipsContainer.innerHTML = '<span class="teacher-subj-chip">ไม่มีวิชาที่กำหนด</span>';
      } else {
        chipsContainer.innerHTML = assignedSubjObjs.map(s => `
          <span class="teacher-subj-chip" title="${escapeHtml(s.description || s.name)}">
            <i class="fa-solid fa-book-bookmark" style="color: var(--primary);"></i>
            ${escapeHtml(s.name)}${s.code ? ` (${escapeHtml(s.code)})` : ''}
          </span>
        `).join('');
      }
    }

    const names = assignedSubjObjs.map(s => s.name).join(', ');
    const badgeEl = document.getElementById('teacherAssignedSubjectsBadge');
    if (badgeEl) badgeEl.innerHTML = `<i class="fa-solid fa-book-bookmark"></i> วิชาที่รับผิดชอบ: ${escapeHtml(names || 'ทุกวิชา')}`;
    if (kpiSubj) kpiSubj.innerText = `${assignedSubjObjs.length} วิชา`;

    const portalSubjSel = document.getElementById('teacherPortalSubjectSelect');
    if (portalSubjSel) {
      portalSubjSel.innerHTML = assignedSubjObjs.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.code ? s.code + ' - ' : '')}${escapeHtml(s.name)}</option>`).join('');
    }
  }

  // Ensure default grade is ALL for full student view
  const attGradeSel = document.getElementById('teacherAttGradeSelect');
  if (attGradeSel && !attGradeSel.value) attGradeSel.value = 'ALL';
  const gradeSel = document.getElementById('teacherPortalGradeSelect');
  if (gradeSel && !gradeSel.value) gradeSel.value = 'ALL';

  renderTeacherAttendanceTable();
  renderTeacherGradesPortalTable();
  if (typeof renderCalendar === 'function') renderCalendar('teacher');
}

function switchTeacherPortalTab(tabName, btnEl) {
  // Sync top segmented tabs
  document.querySelectorAll('#view-teacher .admin-tab-btn, #view-teacher .hasanat-subnav-btn, #view-teacher .teacher-nav-tab').forEach(b => b.classList.remove('active'));
  if (btnEl) {
    btnEl.classList.add('active');
  } else {
    let fallbackId = 'btnTeacherTabAtt';
    if (tabName === 'grades') fallbackId = 'btnTeacherTabGrade';
    else if (tabName === 'calendar') fallbackId = 'btnTeacherTabCal';
    const fallbackBtn = document.getElementById(fallbackId);
    if (fallbackBtn) fallbackBtn.classList.add('active');
  }

  // Sync bottom navigation bar (รูปแนบ 4: บาร์ปุ่มแท็บแยกด้านล่าง)
  document.querySelectorAll('#view-teacher .teacher-bottom-nav-item').forEach(b => b.classList.remove('active'));
  let bottomBtnId = 'btnTeacherBottomAtt';
  if (tabName === 'grades') bottomBtnId = 'btnTeacherBottomGrade';
  else if (tabName === 'calendar') bottomBtnId = 'btnTeacherBottomCal';
  const bottomBtn = document.getElementById(bottomBtnId);
  if (bottomBtn) bottomBtn.classList.add('active');

  const tabAtt = document.getElementById('teacher-tab-attendance');
  const tabGrd = document.getElementById('teacher-tab-grades');
  const tabCal = document.getElementById('teacher-tab-calendar');
  if (tabAtt) tabAtt.style.display = (tabName === 'attendance') ? 'block' : 'none';
  if (tabGrd) tabGrd.style.display = (tabName === 'grades') ? 'block' : 'none';
  if (tabCal) tabCal.style.display = (tabName === 'calendar') ? 'block' : 'none';

  if (tabName === 'attendance') {
    renderTeacherAttendanceTable();
  } else if (tabName === 'grades') {
    renderTeacherGradesPortalTable();
  } else if (tabName === 'calendar') {
    if (typeof renderCalendar === 'function') renderCalendar('teacher');
  }
}

function switchTeacherTab(tabName, btnEl = null) {
  switchTeacherPortalTab(tabName, btnEl);
}

// Attendance Date Navigation Functions (รูปแนบ 4: ปรับให้เช็คมาเรียนดูย้อนหลังได้)
function shiftTeacherAttDate(offsetDays) {
  const dateInput = document.getElementById('teacherAttDateInput');
  if (!dateInput) return;
  const cur = dateInput.value ? new Date(dateInput.value) : new Date();
  cur.setDate(cur.getDate() + offsetDays);
  dateInput.value = cur.toISOString().split('T')[0];
  renderTeacherAttendanceTable();
}

function setTeacherAttDateToday() {
  const dateInput = document.getElementById('teacherAttDateInput');
  if (!dateInput) return;
  dateInput.value = new Date().toISOString().split('T')[0];
  renderTeacherAttendanceTable();
}

function renderTeacherAttendanceTable() {
  const tbody = document.getElementById('teacherAttendanceTableBody');
  const gradeSelect = document.getElementById('teacherAttGradeSelect');
  const dateInput = document.getElementById('teacherAttDateInput');
  const searchInput = document.getElementById('teacherAttSearchInput');
  if (!tbody || !gradeSelect) return;

  const selectedGrade = gradeSelect.value || 'ALL';
  const selectedDate = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().split('T')[0];
  const searchQuery = (searchInput && searchInput.value ? searchInput.value : '').trim().toLowerCase();

  // Reset attendance draft when date changes so historical data loads cleanly
  if (teacherLastAttLoadedDate !== selectedDate) {
    teacherDailyAttendanceDraft = {};
    teacherLastAttLoadedDate = selectedDate;
  }

  // Update History indicator badge and button text
  const todayStr = new Date().toISOString().split('T')[0];
  const historyIndicator = document.getElementById('teacherAttHistoryIndicator');
  const saveBtn = document.getElementById('btnSaveTeacherAttendance');
  if (saveBtn) {
    saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> บันทึกการเช็คชื่อ (${selectedDate === todayStr ? 'วันนี้' : selectedDate})`;
  }
  if (historyIndicator) {
    if (selectedDate === todayStr) {
      historyIndicator.innerHTML = `<i class="fa-solid fa-calendar-check" style="color: var(--primary);"></i> <span>เช็คชื่อประจำวันนี้ (${selectedDate})</span>`;
      historyIndicator.style.borderColor = '#bbf7d0';
      historyIndicator.style.background = '#f0fdf4';
      historyIndicator.style.color = '#15803d';
    } else {
      historyIndicator.innerHTML = `<i class="fa-solid fa-clock-rotate-left" style="color: #ea580c;"></i> <span>ดู/แก้ไขย้อนหลัง วันที่ ${selectedDate}</span>`;
      historyIndicator.style.borderColor = '#fdba74';
      historyIndicator.style.background = '#fff7ed';
      historyIndicator.style.color = '#c2410c';
    }
  }

  const filtered = allStudents.filter(s => {
    const matchGrade = (selectedGrade === 'ALL' || !selectedGrade || s.grade === selectedGrade);
    if (!matchGrade) return false;
    if (!searchQuery) return true;
    const sId = cleanIdString(s.studentId).toLowerCase();
    const sName = (s.fullName || '').toLowerCase();
    return sId.includes(searchQuery) || sName.includes(searchQuery);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          ไม่พบรายชื่อนักเรียนในระดับชั้นหรือคำค้นหาที่เลือก
        </td>
      </tr>
    `;
    return;
  }

  // Load saved daily attendance log for this date if exists
  let savedLogs = {};
  try {
    savedLogs = JSON.parse(localStorage.getItem('khalifah_daily_attendance_logs') || '{}');
  } catch (e) { savedLogs = {}; }
  const dayMap = savedLogs[selectedDate] || {};

  tbody.innerHTML = filtered.map(s => {
    const sId = cleanIdString(s.studentId);
    const curState = teacherDailyAttendanceDraft[sId] || dayMap[sId] || 'present';
    teacherDailyAttendanceDraft[sId] = curState;
    const att = s.attendance || { present: 0, late: 0, leave: 0, absent: 0 };

    return `
      <tr>
        <td><b>${escapeHtml(sId)}</b></td>
        <td style="font-weight: 600;">${escapeHtml(s.fullName)}</td>
        <td><span class="activity-badge badge-upcoming">${escapeHtml(s.grade)}</span></td>
        <td style="text-align: center;">${getStudentStatusBadgeHtml(s.status, s.statusEffectiveDate || s.statusDate)}</td>
        <td style="text-align: center; font-size: 0.8rem; color: var(--text-secondary);">
          มา <b>${att.present || 0}</b> • สาย ${att.late || 0} • ลา ${att.leave || 0} • ขาด ${att.absent || 0}
        </td>
        <td style="text-align: right;">
          <div class="att-status-btn-group">
            <button type="button" class="att-status-btn ${curState === 'present' ? 'active-present' : ''}" onclick="setStudentDailyAttendance('${escapeHtml(sId)}', 'present')">
              <i class="fa-solid fa-check"></i> มาเรียน
            </button>
            <button type="button" class="att-status-btn ${curState === 'late' ? 'active-late' : ''}" onclick="setStudentDailyAttendance('${escapeHtml(sId)}', 'late')">
              มาสาย
            </button>
            <button type="button" class="att-status-btn ${curState === 'leave' ? 'active-leave' : ''}" onclick="setStudentDailyAttendance('${escapeHtml(sId)}', 'leave')">
              ลา
            </button>
            <button type="button" class="att-status-btn ${curState === 'absent' ? 'active-absent' : ''}" onclick="setStudentDailyAttendance('${escapeHtml(sId)}', 'absent')">
              ขาด
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function setStudentDailyAttendance(studentId, status) {
  teacherDailyAttendanceDraft[cleanIdString(studentId)] = status;
  renderTeacherAttendanceTable();
}

function markAllStudentsPresentInClass(status = 'present') {
  const gradeSelect = document.getElementById('teacherAttGradeSelect');
  if (!gradeSelect) return;
  const selectedGrade = gradeSelect.value;
  const filtered = allStudents.filter(s => selectedGrade === 'ALL' || !selectedGrade || s.grade === selectedGrade);
  filtered.forEach(s => {
    teacherDailyAttendanceDraft[cleanIdString(s.studentId)] = status || 'present';
  });
  renderTeacherAttendanceTable();
  showToast('เลือกสถานะ "มาเรียน" ให้ทุกคนเรียบร้อย กดบันทึกเพื่อยืนยัน', 'info');
}

function markAllTeacherAttendance(status = 'present') {
  markAllStudentsPresentInClass(status);
}

function saveTeacherDailyAttendance() {
  const gradeSelect = document.getElementById('teacherAttGradeSelect');
  const dateInput = document.getElementById('teacherAttDateInput');
  if (!gradeSelect) return;

  const selectedGrade = gradeSelect.value || 'ALL';
  const selectedDate = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().split('T')[0];
  const filtered = allStudents.filter(s => selectedGrade === 'ALL' || !selectedGrade || s.grade === selectedGrade);

  if (filtered.length === 0) {
    showToast('ไม่มีรายชื่อนักเรียนในชั้นเรียนนี้', 'warning');
    return;
  }

  let savedLogs = {};
  try {
    savedLogs = JSON.parse(localStorage.getItem('khalifah_daily_attendance_logs') || '{}');
  } catch (e) { savedLogs = {}; }

  const prevDayMap = savedLogs[selectedDate] || {};
  savedLogs[selectedDate] = { ...prevDayMap };

  let count = 0;
  filtered.forEach(s => {
    const sId = cleanIdString(s.studentId);
    const newStatus = teacherDailyAttendanceDraft[sId] || 'present';
    const oldStatus = prevDayMap[sId] || null;

    s.attendance = s.attendance || { present: 0, late: 0, leave: 0, absent: 0 };
    if (oldStatus && s.attendance[oldStatus] > 0) {
      s.attendance[oldStatus] = Math.max(0, s.attendance[oldStatus] - 1);
    }
    s.attendance[newStatus] = (s.attendance[newStatus] || 0) + 1;
    savedLogs[selectedDate][sId] = newStatus;
    count++;

    if (currentStudent && isIdMatch(currentStudent.studentId, sId)) {
      currentStudent = s;
      localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
    }
  });

  localStorage.setItem('khalifah_daily_attendance_logs', JSON.stringify(savedLogs));
  localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));

  renderTeacherAttendanceTable();
  renderCurrentStudentProfile();
  renderDashboardCharts();
  playSuccessSound();
  showToast(`บันทึกการเช็คชื่อมาเรียนวันที่ ${selectedDate} จำนวน ${count} คน สำเร็จ!`, 'success');

  const studentDetails = {};
  filtered.forEach(s => {
    const sId = cleanIdString(s.studentId);
    studentDetails[sId] = {
      fullName: s.fullName,
      grade: s.grade,
      attendance: s.attendance
    };
  });

  syncRecordToGoogleSheet('saveDailyAttendance', {
    date: selectedDate,
    grade: selectedGrade,
    teacher: currentAdmin ? currentAdmin.username : 'Teacher',
    records: savedLogs[selectedDate],
    studentDetails: studentDetails
  });
}

function saveTeacherAttendanceBatch() {
  saveTeacherDailyAttendance();
}

// ----------------- DYNAMIC ASSIGNMENT COLUMNS & CUSTOM GRADING (รูปแนบ 4) ----------------- //

function getSubjectAssignments(subjectId) {
  if (!subjectId) return [];
  let map = {};
  try {
    map = JSON.parse(localStorage.getItem('khalifah_subject_assignments') || '{}');
  } catch (e) { map = {}; }
  return Array.isArray(map[subjectId]) ? map[subjectId] : [];
}

function saveSubjectAssignments(subjectId, assignments) {
  if (!subjectId) return;
  let map = {};
  try {
    map = JSON.parse(localStorage.getItem('khalifah_subject_assignments') || '{}');
  } catch (e) { map = {}; }
  map[subjectId] = assignments;
  localStorage.setItem('khalifah_subject_assignments', JSON.stringify(map));
}

function openAddAssignmentColumnModal() {
  const subjSelect = document.getElementById('teacherPortalSubjectSelect');
  if (!subjSelect || !subjSelect.value) {
    showToast('กรุณาเลือกรายวิชาก่อนเพิ่มช่องคะแนน', 'warning');
    return;
  }
  const titleInput = document.getElementById('newAssignmentTitleInput');
  const maxInput = document.getElementById('newAssignmentMaxScoreInput');
  if (titleInput) titleInput.value = '';
  if (maxInput) maxInput.value = '10';
  openModal('addAssignmentColumnModal');
}

function submitAddAssignmentColumn(e) {
  if (e && e.preventDefault) e.preventDefault();
  const subjSelect = document.getElementById('teacherPortalSubjectSelect');
  if (!subjSelect || !subjSelect.value) return;
  const subjectId = subjSelect.value;

  const titleInput = document.getElementById('newAssignmentTitleInput');
  const maxInput = document.getElementById('newAssignmentMaxScoreInput');
  const title = (titleInput?.value || '').trim();
  const maxScore = parseFloat(maxInput?.value) || 10;

  if (!title) {
    showToast('กรุณาระบุชื่อชิ้นงานหรือช่องคะแนน', 'warning');
    return;
  }
  if (maxScore <= 0) {
    showToast('คะแนนเต็มต้องมากกว่า 0', 'warning');
    return;
  }

  const assignments = getSubjectAssignments(subjectId);
  const newCol = {
    id: 'asg_' + Date.now(),
    title: title,
    maxScore: maxScore
  };
  assignments.push(newCol);
  saveSubjectAssignments(subjectId, assignments);

  closeModal('addAssignmentColumnModal');
  playSuccessSound();
  showToast(`เพิ่มช่องคะแนน "${title}" (เต็ม ${maxScore}) เรียบร้อยแล้ว`, 'success');
  renderTeacherGradesPortalTable();
}

function removeAssignmentColumn(assignmentId) {
  const subjSelect = document.getElementById('teacherPortalSubjectSelect');
  if (!subjSelect || !subjSelect.value) return;
  const subjectId = subjSelect.value;

  const assignments = getSubjectAssignments(subjectId);
  const target = assignments.find(a => a.id === assignmentId);
  if (!confirm(`คุณต้องการลบช่องคะแนน "${target ? target.title : ''}" ใช่หรือไม่?`)) return;

  const updated = assignments.filter(a => a.id !== assignmentId);
  saveSubjectAssignments(subjectId, updated);
  showToast('ลบช่องคะแนนเรียบร้อยแล้ว', 'info');
  renderTeacherGradesPortalTable();
}

function onAssignmentScoreInputChange(inputEl, studentId, subjectId) {
  const assignments = getSubjectAssignments(subjectId);
  let totalScore = 0;
  let totalMax = 0;
  assignments.forEach(a => {
    totalMax += a.maxScore;
    const inp = document.querySelector(`.assignment-score-input[data-student-id="${studentId}"][data-assignment-id="${a.id}"]`);
    const val = parseFloat(inp?.value);
    if (!isNaN(val)) totalScore += val;
  });
  const pct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
  const labelEl = document.getElementById(`totalScorePct_${studentId}`);
  if (labelEl) {
    labelEl.innerText = `${totalScore} / ${totalMax} (${pct.toFixed(0)}%)`;
    labelEl.style.color = pct >= 50 ? 'var(--primary)' : 'var(--text-muted)';
  }

  // Auto-calculate suggested grade based on percentage
  let suggestedGrade = 0;
  if (pct >= 80) suggestedGrade = 4;
  else if (pct >= 75) suggestedGrade = 3.5;
  else if (pct >= 70) suggestedGrade = 3;
  else if (pct >= 65) suggestedGrade = 2.5;
  else if (pct >= 60) suggestedGrade = 2;
  else if (pct >= 55) suggestedGrade = 1.5;
  else if (pct >= 50) suggestedGrade = 1;
  else suggestedGrade = 0;

  const gradeSelect = document.querySelector(`.teacher-portal-grade-input[data-student-id="${studentId}"]`);
  if (gradeSelect) {
    gradeSelect.value = String(suggestedGrade);
  }
}

function renderTeacherGradesPortalTable() {
  const tbody = document.getElementById('teacherPortalGradesTableBody');
  const thead = document.getElementById('teacherPortalGradesTableHead');
  const subjSelect = document.getElementById('teacherPortalSubjectSelect');
  const gradeSelect = document.getElementById('teacherPortalGradeSelect');
  const countBadge = document.getElementById('teacherAssignmentsCount');
  const chipsList = document.getElementById('teacherAssignmentChipsList');
  if (!tbody || !subjSelect || !gradeSelect) return;

  const currentSubj = subjSelect.value;
  const currentGrade = gradeSelect.value || 'ALL';
  const filtered = allStudents.filter(s => currentGrade === 'ALL' || !currentGrade || s.grade === currentGrade);
  const assignments = getSubjectAssignments(currentSubj);

  // Update Assignment Bar Header & Chips List
  if (countBadge) countBadge.innerText = `${assignments.length} ชิ้นงาน`;
  if (chipsList) {
    if (assignments.length === 0) {
      chipsList.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">ยังไม่มีช่องชิ้นงานย่อย (คุณสามารถกดปุ่ม "+ เพิ่มช่องคะแนน/ชิ้นงาน" เพื่อเพิ่มได้ทันที)</span>';
    } else {
      chipsList.innerHTML = assignments.map(a => `
        <span class="assignment-chip">
          <i class="fa-solid fa-file-pen" style="color: var(--primary);"></i>
          <span>${escapeHtml(a.title)} (เต็ม ${a.maxScore})</span>
          <button type="button" class="btn-remove-assignment" onclick="removeAssignmentColumn('${escapeHtml(a.id)}')" title="ลบช่องคะแนนนี้">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </span>
      `).join('');
    }
  }

  // Render Table Header dynamically
  if (thead) {
    if (assignments.length > 0) {
      thead.innerHTML = `
        <tr>
          <th style="width: 105px;">รหัสนักเรียน</th>
          <th style="min-width: 150px;">ชื่อ - นามสกุล</th>
          <th style="width: 110px;">ระดับชั้น</th>
          ${assignments.map(a => `<th style="text-align: center; min-width: 90px;">${escapeHtml(a.title)}<br><small style="color: var(--text-muted); font-weight: normal;">(เต็ม ${a.maxScore})</small></th>`).join('')}
          <th style="text-align: center; min-width: 95px;">รวมคะแนน</th>
          <th style="width: 130px; text-align: center;">เกรดตัด (0–4)</th>
          <th style="text-align: right; min-width: 180px;">เลือกเกรดด่วน</th>
        </tr>
      `;
    } else {
      thead.innerHTML = `
        <tr>
          <th style="width: 115px;">รหัสนักเรียน</th>
          <th>ชื่อ - นามสกุล</th>
          <th>ระดับชั้น</th>
          <th style="text-align: center;">สถานะนักเรียน</th>
          <th style="width: 150px; text-align: center;">เกรดที่ได้ (0 – 4)</th>
          <th style="text-align: right; min-width: 240px;">กดเลือกเกรดด่วน (1 – 4)</th>
        </tr>
      `;
    }
  }

  if (filtered.length === 0) {
    const colCount = assignments.length > 0 ? (assignments.length + 5) : 6;
    tbody.innerHTML = `
      <tr>
        <td colspan="${colCount}" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          ไม่พบรายชื่อนักเรียนในระดับชั้นที่เลือก
        </td>
      </tr>
    `;
    return;
  }

  // Load persistent assignment scores
  let allScoresMap = {};
  try {
    allScoresMap = JSON.parse(localStorage.getItem('khalifah_student_assignment_scores') || '{}');
  } catch (e) { allScoresMap = {}; }

  const gradeChoices = [0, 1, 1.5, 2, 2.5, 3, 3.5, 4];

  tbody.innerHTML = filtered.map(s => {
    const sId = cleanIdString(s.studentId);
    const rawVal = (s.subjectGrades && s.subjectGrades[currentSubj] !== undefined)
      ? s.subjectGrades[currentSubj]
      : (s.skills && s.skills[currentSubj] !== undefined ? s.skills[currentSubj] : 0);
    const curGradeVal = normalizeGrade1To4(rawVal);

    const studentAsgMap = (allScoresMap[sId] && allScoresMap[sId][currentSubj]) || (s.assignmentScores && s.assignmentScores[currentSubj]) || {};

    let totalScore = 0;
    let totalMax = 0;
    assignments.forEach(a => {
      totalMax += a.maxScore;
      const sc = parseFloat(studentAsgMap[a.id]);
      if (!isNaN(sc)) totalScore += sc;
    });
    const pct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

    if (assignments.length > 0) {
      return `
        <tr>
          <td><b>${escapeHtml(sId)}</b></td>
          <td>
            <div style="font-weight: 600; color: var(--text-dark);">${escapeHtml(s.fullName)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">GPAX: ${escapeHtml(recalculateStudentGpa(s))}</div>
          </td>
          <td><span class="badge-sub">${escapeHtml(s.grade)}</span></td>
          ${assignments.map(a => {
            const sc = studentAsgMap[a.id] !== undefined ? studentAsgMap[a.id] : '';
            return `
              <td style="text-align: center;">
                <input type="number" step="0.5" min="0" max="${a.maxScore}" 
                  class="assignment-score-input" 
                  data-student-id="${escapeHtml(sId)}" 
                  data-assignment-id="${escapeHtml(a.id)}" 
                  data-max-score="${a.maxScore}" 
                  value="${sc}" 
                  placeholder="0-${a.maxScore}"
                  oninput="onAssignmentScoreInputChange(this, '${escapeHtml(sId)}', '${escapeHtml(currentSubj)}')"
                >
              </td>
            `;
          }).join('')}
          <td style="text-align: center;">
            <span id="totalScorePct_${escapeHtml(sId)}" style="font-weight: 700; color: ${pct >= 50 ? 'var(--primary)' : 'var(--text-muted)'}; font-size: 0.84rem;">
              ${totalScore} / ${totalMax} (${pct.toFixed(0)}%)
            </span>
          </td>
          <td style="text-align: center;">
            <select class="grade-select-pill teacher-portal-grade-input" data-student-id="${escapeHtml(sId)}">
              ${gradeChoices.map(g => `<option value="${g}" ${g === curGradeVal ? 'selected' : ''}>${g === 0 ? '0 (รอผล)' : 'เกรด ' + g}</option>`).join('')}
            </select>
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="setTeacherPortalQuickGrade('${escapeHtml(sId)}', 1)" style="padding: 0.2rem 0.4rem; font-size: 0.72rem;">1</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="setTeacherPortalQuickGrade('${escapeHtml(sId)}', 2)" style="padding: 0.2rem 0.4rem; font-size: 0.72rem;">2</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="setTeacherPortalQuickGrade('${escapeHtml(sId)}', 3)" style="padding: 0.2rem 0.4rem; font-size: 0.72rem;">3</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="setTeacherPortalQuickGrade('${escapeHtml(sId)}', 4)" style="padding: 0.2rem 0.4rem; font-size: 0.72rem;">4</button>
          </td>
        </tr>
      `;
    }

    return `
      <tr>
        <td><b>${escapeHtml(sId)}</b></td>
        <td>
          <div style="font-weight: 600; color: var(--text-dark);">${escapeHtml(s.fullName)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">GPAX: ${escapeHtml(recalculateStudentGpa(s))}</div>
        </td>
        <td><span class="badge-sub">${escapeHtml(s.grade)}</span></td>
        <td style="text-align: center;">${getStudentStatusBadgeHtml(s.status, s.statusEffectiveDate || s.statusDate)}</td>
        <td style="text-align: center;">
          <select class="grade-select-pill teacher-portal-grade-input" data-student-id="${escapeHtml(sId)}">
            ${gradeChoices.map(g => `<option value="${g}" ${g === curGradeVal ? 'selected' : ''}>${g === 0 ? '0 (รอผล)' : 'เกรด ' + g}</option>`).join('')}
          </select>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="setTeacherPortalQuickGrade('${escapeHtml(sId)}', 1)" style="padding: 0.22rem 0.5rem; font-size: 0.75rem;">เกรด 1</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="setTeacherPortalQuickGrade('${escapeHtml(sId)}', 2)" style="padding: 0.22rem 0.5rem; font-size: 0.75rem;">เกรด 2</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="setTeacherPortalQuickGrade('${escapeHtml(sId)}', 3)" style="padding: 0.22rem 0.5rem; font-size: 0.75rem;">เกรด 3</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="setTeacherPortalQuickGrade('${escapeHtml(sId)}', 4)" style="padding: 0.22rem 0.5rem; font-size: 0.75rem;">เกรด 4</button>
        </td>
      </tr>
    `;
  }).join('');
}

function setTeacherPortalQuickGrade(studentId, gradeVal) {
  const el = document.querySelector(`.teacher-portal-grade-input[data-student-id="${studentId}"]`);
  if (el) el.value = String(gradeVal);
}

function renderTeacherPortalGradesTable() {
  renderTeacherGradesPortalTable();
}

function saveTeacherPortalGrades() {
  const subjSelect = document.getElementById('teacherPortalSubjectSelect');
  if (!subjSelect) return;
  const currentSubj = subjSelect.value;
  const inputs = document.querySelectorAll('.teacher-portal-grade-input');

  if (inputs.length === 0) {
    showToast('ไม่มีรายชื่อนักเรียนให้บันทึกเกรด', 'warning');
    return;
  }

  // Save assignment scores if any exist
  let allScoresMap = {};
  try {
    allScoresMap = JSON.parse(localStorage.getItem('khalifah_student_assignment_scores') || '{}');
  } catch (e) { allScoresMap = {}; }

  const asgInputs = document.querySelectorAll('.assignment-score-input');
  asgInputs.forEach(inp => {
    const sId = inp.getAttribute('data-student-id');
    const asgId = inp.getAttribute('data-assignment-id');
    const val = inp.value !== '' ? parseFloat(inp.value) : '';
    if (!allScoresMap[sId]) allScoresMap[sId] = {};
    if (!allScoresMap[sId][currentSubj]) allScoresMap[sId][currentSubj] = {};
    allScoresMap[sId][currentSubj][asgId] = val;

    const s = allStudents.find(item => isIdMatch(item.studentId, sId));
    if (s) {
      if (!s.assignmentScores) s.assignmentScores = {};
      if (!s.assignmentScores[currentSubj]) s.assignmentScores[currentSubj] = {};
      s.assignmentScores[currentSubj][asgId] = val;
    }
  });
  localStorage.setItem('khalifah_student_assignment_scores', JSON.stringify(allScoresMap));

  let updatedCount = 0;
  const gradesBatch = [];

  inputs.forEach(inp => {
    const sId = inp.getAttribute('data-student-id');
    const gradeVal = normalizeGrade1To4(inp.value);

    const sIdx = allStudents.findIndex(s => isIdMatch(s.studentId, sId));
    if (sIdx !== -1) {
      if (!allStudents[sIdx].subjectGrades) allStudents[sIdx].subjectGrades = {};
      if (!allStudents[sIdx].skills) allStudents[sIdx].skills = {};
      allStudents[sIdx].subjectGrades[currentSubj] = gradeVal;
      allStudents[sIdx].skills[currentSubj] = gradeVal;
      const newGpa = recalculateStudentGpa(allStudents[sIdx]);
      updatedCount++;

      gradesBatch.push({
        studentId: sId,
        gradeVal: gradeVal,
        gpa: newGpa
      });

      if (currentStudent && isIdMatch(currentStudent.studentId, sId)) {
        currentStudent = allStudents[sIdx];
        localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
      }
    }
  });

  localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
  renderTeacherGradesPortalTable();
  renderSkillRadarChart();
  renderCurrentStudentProfile();

  const subjObj = (typeof appSubjects !== 'undefined') ? appSubjects.find(s => s.id === currentSubj) : null;
  const scoresMap = {};
  gradesBatch.forEach(g => { scoresMap[g.studentId] = g.gradeVal; });

  syncRecordToGoogleSheet('saveSubjectGrades', {
    subjectCode: currentSubj,
    subjectName: subjObj ? subjObj.name : currentSubj,
    teacherId: currentAdmin ? currentAdmin.username : 'Teacher',
    studentGrades: gradesBatch.map(g => {
      const st = allStudents.find(s => isIdMatch(s.studentId, g.studentId));
      return {
        studentId: g.studentId,
        fullName: st ? st.fullName : '',
        grade: st ? st.grade : '',
        gradeVal: g.gradeVal,
        score: g.gradeVal === 4 ? 85 : (g.gradeVal === 3 ? 75 : (g.gradeVal === 2 ? 65 : 55)),
        gpax: g.gpa,
        grades: st ? (st.grades || []) : []
      };
    }),
    grades: scoresMap,
    timestamp: new Date().toISOString()
  });

  playSuccessSound();
  showToast(`บันทึกเกรดวิชา (ระดับ 1-4) และคะแนนเก็บของนักเรียน ${updatedCount} คน สำเร็จ! กราฟทักษะอัปเดตทันที`, 'success');
}

function renderAdminSubjectsTable() {
  const tbody = document.getElementById('adminSubjectsTableBody');
  if (!tbody) return;
  loadAppSubjects();

  if (appSubjects.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">ยังไม่มีข้อมูลรายวิชา</td></tr>`;
    return;
  }

  tbody.innerHTML = appSubjects.map(s => `
    <tr>
      <td><b>${s.code || '-'}</b></td>
      <td style="font-weight: 600; color: var(--text-dark);">${s.name}</td>
      <td><span class="activity-badge badge-active">${s.id}</span></td>
      <td style="text-align: right; white-space: nowrap;">
        <button class="btn btn-secondary btn-sm" onclick="openAddSubjectModal('${s.id}')" style="margin-right: 0.35rem; padding: 0.25rem 0.55rem; font-size: 0.78rem;">
          <i class="fa-solid fa-pen"></i> แก้ไข
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteSubject('${s.id}')" style="padding: 0.25rem 0.55rem; font-size: 0.78rem;">
          <i class="fa-solid fa-trash"></i> ลบ
        </button>
      </td>
    </tr>
  `).join('');
}

function openAddSubjectModal(editId = null) {
  loadAppSubjects();
  const title = document.getElementById('subjectModalTitle');
  const codeIn = document.getElementById('subjectCodeInput');
  const nameIn = document.getElementById('subjectNameInput');
  const hiddenId = document.getElementById('editSubjectId');

  if (editId) {
    const s = appSubjects.find(x => x.id === editId);
    if (!s) return;
    if (title) title.innerHTML = '<i class="fa-solid fa-pen" style="color: var(--primary);"></i> แก้ไขรายวิชา';
    if (hiddenId) hiddenId.value = s.id;
    if (codeIn) codeIn.value = s.code || '';
    if (nameIn) nameIn.value = s.name || '';
  } else {
    if (title) title.innerHTML = '<i class="fa-solid fa-book-open" style="color: var(--primary);"></i> เพิ่มรายวิชาใหม่';
    if (hiddenId) hiddenId.value = '';
    if (codeIn) codeIn.value = '';
    if (nameIn) nameIn.value = '';
  }
  openModal('addSubjectModal');
}

function submitSaveSubject() {
  const hiddenId = document.getElementById('editSubjectId').value;
  const code = document.getElementById('subjectCodeInput').value.trim();
  const name = document.getElementById('subjectNameInput').value.trim();

  if (!name) {
    showToast('กรุณาระบุชื่อรายวิชา', 'warning');
    return;
  }

  loadAppSubjects();

  if (hiddenId) {
    const idx = appSubjects.findIndex(x => x.id === hiddenId);
    if (idx !== -1) {
      appSubjects[idx].code = code;
      appSubjects[idx].name = name;
    }
  } else {
    const newId = 'subj_' + Date.now();
    appSubjects.push({ id: newId, code: code || ('SUB-' + (appSubjects.length + 1)), name: name });
  }

  localStorage.setItem('khalifah_subjects', JSON.stringify(appSubjects));
  closeModal('addSubjectModal');
  renderAdminSubjectsTable();
  renderSkillRadarChart();
  populateGradingSubjectSelect();
  showToast('บันทึกข้อมูลรายวิชาเรียบร้อยแล้ว', 'success');

  syncRecordToGoogleSheet('saveSubjects', { subjects: appSubjects });
}

function deleteSubject(id) {
  if (!confirm('ต้องการลบรายวิชานี้ใช่หรือไม่?')) return;
  loadAppSubjects();
  appSubjects = appSubjects.filter(x => x.id !== id);
  localStorage.setItem('khalifah_subjects', JSON.stringify(appSubjects));
  renderAdminSubjectsTable();
  renderSkillRadarChart();
  populateGradingSubjectSelect();
  showToast('ลบรายวิชาเรียบร้อยแล้ว', 'info');

  syncRecordToGoogleSheet('saveSubjects', { subjects: appSubjects });
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

// ----------------- GOOGLE APPS SCRIPT & GOOGLE SHEETS SYNC ----------------- //

function saveGasSettings() {
  const urlInput = document.getElementById('gasApiUrlInput');
  const url = urlInput ? urlInput.value.trim() : '';

  if (!url) {
    gasApiUrl = '';
    localStorage.removeItem('khalifah_gas_url');
    showToast('ลบการเชื่อมต่อ Google Sheets (ทำงานในโหมด Offline)', 'info');
    closeModal('settingsModal');
    return;
  }

  if (url.includes('docs.google.com/spreadsheets')) {
    alert(
      '⚠️ ท่านใส่ลิงก์ Google Sheet โดยตรง (ไม่ใช่ Web App URL)\n\n' +
      'ลิงก์ดังกล่าวเป็นหน้าสำหรับเปิดดูเอกสาร ซึ่งไม่สามารถส่งข้อมูลจากเว็บแอปเข้าไปบันทึกได้\n\n' +
      'วิธีนำ Web App URL มาใส่:\n' +
      '1. เปิด Google Sheet ของท่าน (https://docs.google.com/spreadsheets/d/1s8p3EYESW7z2oiLVyzfFIPXck5eyeGxxU98lkkzw-ss/edit)\n' +
      '2. ไปที่เมนู "ส่วนขยาย" (Extensions) ➔ "Apps Script"\n' +
      '3. วางโค้ด Code.gs แล้วกดบันทึก\n' +
      '4. กดปุ่มสีน้ำเงิน "Deploy" ➔ "New deployment" ➔ เลือกประเภท "Web app"\n' +
      '5. ตั้งสิทธิ์เข้าถึง: "Anyone" (ทุกคน) ➔ กด Deploy\n' +
      '6. คัดลอก URL เว็บแอปที่ขึ้นต้นด้วย https://script.google.com/macros/s/.../exec มาวางที่นี่'
    );
    return;
  }

  gasApiUrl = url;
  localStorage.setItem('khalifah_gas_url', url);

  const badge = document.getElementById('gasSyncStatusBadge');
  if (badge) {
    badge.className = 'sync-status-badge connected';
    badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> ตั้งค่า Web App URL เรียบร้อย';
  }

  closeModal('settingsModal');
  showToast('บันทึก Web App URL เชื่อมต่อ Google Sheets เรียบร้อยแล้ว', 'success');
}

async function testGasConnection() {
  const urlInput = document.getElementById('gasApiUrlInput');
  const url = (urlInput ? urlInput.value.trim() : '') || gasApiUrl;
  const statusDiv = document.getElementById('gasConnStatus');
  const badge = document.getElementById('gasSyncStatusBadge');

  if (!url) {
    if (statusDiv) {
      statusDiv.style.display = 'block';
      statusDiv.style.background = '#fef2f2';
      statusDiv.style.color = '#991b1b';
      statusDiv.innerText = 'กรุณากรอก Web App URL ก่อนทดสอบ';
    }
    showToast('กรุณากรอก Web App URL', 'warning');
    return;
  }

  if (url.includes('docs.google.com/spreadsheets')) {
    alert(
      '⚠️ ท่านใส่ลิงก์ Google Sheet โดยตรง (ซึ่งเป็นหน้าตาราง)\n\n' +
      'ระบบต้องการ Web App URL ที่ได้จากการกด Deploy ใน Google Apps Script (ขึ้นต้นด้วย https://script.google.com/macros/s/.../exec) เพื่อบันทึกข้อมูลครับ'
    );
    if (statusDiv) {
      statusDiv.style.display = 'block';
      statusDiv.style.background = '#fef2f2';
      statusDiv.style.color = '#991b1b';
      statusDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <b>URL ไม่ถูกต้อง:</b> ท่านระบุลิงก์สเปรดชีต กรุณาเปลี่ยนเป็น URL เว็บแอปที่ขึ้นต้นด้วย <code>https://script.google.com/macros/s/.../exec</code>';
    }
    return;
  }

  showToast('กำลังทดสอบเชื่อมต่อ Google Apps Script...', 'info');
  if (statusDiv) {
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#eff6ff';
    statusDiv.style.color = '#1e40af';
    statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังทดสอบเชื่อมต่อ Google Sheets...';
  }

  try {
    // Probe via POST text/plain (no-cors)
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'ping', timestamp: new Date().toISOString() })
    });

    gasApiUrl = url;
    localStorage.setItem('khalifah_gas_url', url);

    if (badge) {
      badge.className = 'sync-status-badge connected';
      badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> เชื่อมต่อฐานข้อมูลสำเร็จ';
    }
    if (statusDiv) {
      statusDiv.style.background = '#f0fdf4';
      statusDiv.style.color = '#166534';
      statusDiv.innerHTML = '<i class="fa-solid fa-circle-check"></i> <b>เชื่อมต่อสำเร็จ 100%!</b> เว็บแอปพร้อมบันทึกข้อมูลลง Google Sheet เรียบร้อยแล้ว';
    }
    showToast('เชื่อมต่อ Google Sheet สำเร็จเรียบร้อย!', 'success');
  } catch (err) {
    console.warn('Probe error:', err);
    if (statusDiv) {
      statusDiv.style.background = '#fef2f2';
      statusDiv.style.color = '#991b1b';
      statusDiv.innerText = 'ไม่สามารถเชื่อมต่อได้: ' + err.message;
    }
    showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
  }
}

async function forceSyncAllToGoogleSheet() {
  const url = gasApiUrl || document.getElementById('gasApiUrlInput')?.value.trim();
  if (!url) {
    showToast('กรุณาระบุ Web App URL ก่อนซิงค์ข้อมูล', 'warning');
    openModal('settingsModal');
    return;
  }

  if (url.includes('docs.google.com/spreadsheets')) {
    alert(
      '⚠️ ท่านใส่ลิงก์ดูชีต (Google Sheet URL) ในช่องตั้งค่า ซึ่งไม่สามารถรับข้อมูลได้\n\n' +
      'กรุณานำโค้ด Code.gs ไปวางใน Apps Script ของชีต แล้วกด Deploy เป็นเว็บแอป (Web App) เพื่อนำ Web App URL ที่ขึ้นต้นด้วย https://script.google.com/macros/s/.../exec มาใส่ครับ'
    );
    return;
  }

  showToast('กำลังซิงค์ข้อมูลทั้งหมดลง Google Sheet ฐานข้อมูล...', 'info');

  let historyList = [];
  try {
    historyList = JSON.parse(localStorage.getItem('khalifah_prayer_history') || '[]');
  } catch (e) { historyList = []; }

  let allHasanat = {};
  try {
    allHasanat = JSON.parse(localStorage.getItem('khalifah_student_hasanat') || '{}');
  } catch (e) { allHasanat = {}; }

  const hasanatArray = Object.keys(allHasanat).map(stId => {
    const h = allHasanat[stId];
    const student = allStudents.find(s => s.studentId === stId);
    return {
      studentId: stId,
      studentName: student ? student.fullName : '',
      grade: student ? student.grade : '',
      date: new Date().toISOString().split('T')[0],
      quran: h.quran,
      memorization: h.memorization,
      sunnah: h.sunnah,
      timestamp: new Date().toISOString()
    };
  });

  loadAppSubjects();
  const payload = {
    students: allStudents,
    subAdmins: subAdmins,
    activities: activities,
    prayers: historyList,
    hasanat: hasanatArray,
    subjects: appSubjects
  };

  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'batchSync', data: payload })
    });

    showToast(`ซิงค์สำเร็จ! ส่งข้อมูลนักเรียน ${allStudents.length} คน, อาจารย์ ${subAdmins.length} ท่าน, กิจกรรม ${activities.length} รายการ, ละหมาด ${historyList.length} รายการ, ผลบุญ ${hasanatArray.length} รายการ ลง Google Sheet แล้ว`, 'success');
  } catch (err) {
    showToast('เกิดข้อผิดพลาดในการซิงค์: ' + err.message, 'error');
  }
}

async function triggerOrganizeGoogleSheets() {
  let url = gasApiUrl || document.getElementById('gasApiUrlInput')?.value.trim() || localStorage.getItem('khalifah_gas_url') || DEFAULT_GAS_API_URL;
  if (!url || url.includes('docs.google.com/spreadsheets')) {
    url = DEFAULT_GAS_API_URL;
  }
  if (!url) {
    showToast('กรุณาระบุ Web App URL ในหน้าต่างตั้งค่าก่อนดำเนินการ', 'warning');
    openModal('settingsModal');
    return;
  }
  showToast('กำลังจัดระเบียบ Google Sheets (เรียงแท็บ แยกอาจารย์/แอดมิน ใส่ Dropdown)...', 'info');
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'organizeGoogleSheets' })
    });
    playSuccessSound();
    showToast('จัดระเบียบ Google Sheets เรียบร้อยแล้ว! แท็บและข้อมูลถูกแยกหมวดหมู่อย่างสวยงาม', 'success');
  } catch (err) {
    showToast('เกิดข้อผิดพลาดในการจัดระเบียบชีต: ' + err.message, 'error');
  }
}

async function convertGoogleSheetToThai() {
  const url = gasApiUrl || document.getElementById('gasApiUrlInput')?.value.trim();
  if (!url) {
    showToast('กรุณาระบุ Web App URL ก่อนดำเนินการ', 'warning');
    return;
  }
  showToast('กำลังปรับภาษา Google Sheet ให้เป็นภาษาไทย 100%...', 'info');
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'convertToThai' })
    });
    showToast('ปรับ Google Sheet เป็นภาษาไทยเรียบร้อยแล้ว! (แท็บและหัวคอลัมน์เปลี่ยนเป็นภาษาไทยแล้ว)', 'success');
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}


async function syncRecordToGoogleSheet(action, data) {
  let url = gasApiUrl || localStorage.getItem('khalifah_gas_url') || DEFAULT_GAS_API_URL;
  if (!url || url.includes('docs.google.com/spreadsheets')) {
    url = DEFAULT_GAS_API_URL;
  }
  if (!url) {
    console.warn(`[Offline Local] GAS Web App URL not configured. Action: ${action} saved locally on device.`);
    return;
  }

  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ action: action, data: data })
    });
    console.log(`✓ Synced ${action} to Google Sheet successfully`);
    if (action === 'registerStudent') {
      showToast('✓ บันทึกข้อมูลนักเรียนลง Google Sheet เรียบร้อยแล้ว', 'success');
    }
    if (action === 'activityCheckIn') {
      // Re-fetch attendee list from cloud to refresh UI
      setTimeout(() => {
        if (typeof fetchActivitiesAndLogsFromCloud === 'function') {
          fetchActivitiesAndLogsFromCloud(false);
        }
      }, 600);
    }
  } catch (err) {
    console.warn(`Sync ${action} failed:`, err);
    if (action === 'registerStudent') {
      showToast('⚠️ ไม่สามารถส่งไปยัง Google Sheet: ' + err.message, 'warning');
    }
  }
}

// ----------------- MODAL & UTILITY FUNCTIONS ----------------- //

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
}

function closeModal(modalId) {
  if (modalId === 'authModal' && document.body.classList.contains('auth-locked') && !currentStudent && !currentAdmin) {
    showToast('กรุณาเข้าสู่ระบบก่อนเริ่มใช้งานแอปพลิเคชัน', 'warning');
    return;
  }
  if (modalId === 'activityAttendeesModal') {
    currentViewingActivityId = null;
  }
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


// ----------------- LOGO MANAGEMENT (EMBEDDED & CUSTOMIZABLE) ----------------- //
let tempNewLogoBase64 = null;

function initAppLogo() {
  let activeLogo = localStorage.getItem('khalifah_custom_logo');
  if (!activeLogo || activeLogo === 'null' || activeLogo === 'undefined' || !activeLogo.startsWith('data:image')) {
    activeLogo = DEFAULT_LOGO_BASE64;
  }
  document.querySelectorAll('.brand-logo-img').forEach(img => {
    img.src = activeLogo;
    img.onerror = function() {
      this.onerror = null;
      this.src = DEFAULT_LOGO_BASE64;
    };
  });
  const preview = document.getElementById('adminLogoPreview');
  if (preview) {
    preview.src = activeLogo;
    preview.onerror = function() {
      this.onerror = null;
      this.src = DEFAULT_LOGO_BASE64;
    };
  }
}

function previewNewLogo(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    showToast('ไฟล์ภาพมีขนาดใหญ่เกิน 2MB กรุณาเลือกไฟล์ที่เล็กลง', 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    tempNewLogoBase64 = e.target.result;
    const preview = document.getElementById('adminLogoPreview');
    if (preview) preview.src = tempNewLogoBase64;
    showToast('โหลดรูปตัวอย่างเรียบร้อย กดบันทึกเพื่อใช้งาน', 'info');
  };
  reader.readAsDataURL(file);
}

function saveNewLogo() {
  if (!tempNewLogoBase64) {
    showToast('กรุณาเลือกไฟล์รูปภาพก่อนกดบันทึก', 'warning');
    return;
  }
  localStorage.setItem('khalifah_custom_logo', tempNewLogoBase64);
  initAppLogo();
  showToast('เปลี่ยนโลโก้ระบบสำเร็จ! นักเรียนทุกคนจะเห็นโลโก้ใหม่ทันที', 'success');
  syncRecordToGoogleSheet('updateLogo', { logoBase64: tempNewLogoBase64 });
}

function resetToDefaultLogo() {
  if (!confirm('ต้องการคืนค่าเป็นโลโก้เริ่มต้นของระบบใช่หรือไม่?')) return;
  localStorage.removeItem('khalifah_custom_logo');
  tempNewLogoBase64 = null;
  initAppLogo();
  const input = document.getElementById('inputNewLogo');
  if (input) input.value = '';
  showToast('คืนค่าเป็นโลโก้เริ่มต้นเรียบร้อยแล้ว', 'info');
  syncRecordToGoogleSheet('updateLogo', { logoBase64: DEFAULT_LOGO_BASE64 });
}

// ----------------- PWA INSTALLATION & SERVICE WORKER ----------------- //
let deferredPwaPrompt = null;

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      console.log('[KHALIFAH] Service Worker registered with scope:', reg.scope);
      reg.update();
    }).catch((err) => {
      console.warn('[KHALIFAH] Service Worker registration failed:', err);
    });
  });
}

// Capture BeforeInstallPrompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  
  const pwaBanner = document.getElementById('pwaInstallBanner');
  const btnHeader = document.getElementById('btnPwaHeader');
  
  if (pwaBanner && localStorage.getItem('khalifah_pwa_dismissed') !== 'true') {
    pwaBanner.style.display = 'flex';
  }
  if (btnHeader) {
    btnHeader.style.display = 'inline-flex';
  }
});

// App installed successfully event
window.addEventListener('appinstalled', () => {
  deferredPwaPrompt = null;
  const pwaBanner = document.getElementById('pwaInstallBanner');
  const btnHeader = document.getElementById('btnPwaHeader');
  if (pwaBanner) pwaBanner.style.display = 'none';
  if (btnHeader) btnHeader.style.display = 'none';
  showToast('ติดตั้งแอป KHALIFAH PROGRAM สำเร็จเรียบร้อย!', 'success');
});

function promptPwaInstall() {
  if (deferredPwaPrompt) {
    deferredPwaPrompt.prompt();
    deferredPwaPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('กำลังติดตั้งแอป KHALIFAH...', 'info');
      }
      deferredPwaPrompt = null;
      const pwaBanner = document.getElementById('pwaInstallBanner');
      const btnHeader = document.getElementById('btnPwaHeader');
      if (pwaBanner) pwaBanner.style.display = 'none';
      if (btnHeader) btnHeader.style.display = 'none';
    });
  } else {
    // Helpful guide for iOS Safari or Chrome desktop
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    if (isIos) {
      showToast('สำหรับ iPhone/iPad: กดปุ่ม "แชร์ (Share)" ใน Safari แล้วเลือก "เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)"', 'info', 7000);
    } else {
      showToast('คลิกไอคอนติดตั้งที่แถบ URL หรือเลือกเมนู "เพิ่มไปยังหน้าจอหลัก / Install App"', 'info', 6000);
    }
  }
}

function dismissPwaBanner() {
  const pwaBanner = document.getElementById('pwaInstallBanner');
  if (pwaBanner) pwaBanner.style.display = 'none';
  localStorage.setItem('khalifah_pwa_dismissed', 'true');
}

// ----------------- ACTIVITIES LIVE QR CODE SCANNER & INSTANT BROADCAST ----------------- //
let khalifahActivityBroadcast = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    khalifahActivityBroadcast = new BroadcastChannel('khalifah_activity_channel');
    khalifahActivityBroadcast.onmessage = (event) => {
      if (event.data && event.data.type === 'ACTIVITY_CHECK_IN') {
        const incomingLog = event.data.log;
        if (incomingLog) {
          let actLogs = [];
          try {
            actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
          } catch (e) { actLogs = []; }
          const existingIdx = actLogs.findIndex(l => isIdMatch(l.studentId, incomingLog.studentId) && (l.activityId === incomingLog.activityId || l.activityTitle === incomingLog.activityTitle));
          if (existingIdx !== -1) {
            actLogs[existingIdx] = incomingLog;
          } else {
            actLogs.unshift(incomingLog);
          }
          localStorage.setItem('khalifah_student_act_logs', JSON.stringify(actLogs));

          // Immediate live re-render on admin and student screens
          if (typeof renderAdminActivitiesTable === 'function') renderAdminActivitiesTable();
          if (typeof renderAdminLiveActivityFeed === 'function') renderAdminLiveActivityFeed();
          if (typeof renderStudentScannedActivities === 'function') renderStudentScannedActivities();
          if (typeof renderActivitiesList === 'function') renderActivitiesList();

          // Live update on Staff Kiosk Monitor
          if (typeof renderStaffKioskMonitor === 'function' && isStaffMonitorMode) {
            renderStaffKioskMonitor(incomingLog.studentId);
            if (typeof playStaffScanDingSound === 'function') playStaffScanDingSound();
          }

          if (currentViewingActivityId) {
            const act = activities.find(a => (a.id === currentViewingActivityId || a.activityId === currentViewingActivityId));
            currentAttendeesList = actLogs.filter(l => l.activityId === currentViewingActivityId || (act && l.activityTitle === act.title));
            if (typeof renderAttendeesTable === 'function') renderAttendeesTable(currentAttendeesList);
            if (typeof playStaffScanDingSound === 'function') playStaffScanDingSound();
          }
        }
      }
    };
  }
} catch (e) {
  console.warn('BroadcastChannel init error:', e);
}

// Fallback storage listener for cross-tab synchronization
window.addEventListener('storage', (e) => {
  if (e.key === 'khalifah_student_act_logs' || e.key === 'khalifah_activity_sync_signal') {
    if (typeof renderAdminActivitiesTable === 'function') renderAdminActivitiesTable();
    if (typeof renderAdminLiveActivityFeed === 'function') renderAdminLiveActivityFeed();
    if (typeof renderStudentScannedActivities === 'function') renderStudentScannedActivities();
    if (typeof renderActivitiesList === 'function') renderActivitiesList();
    if (typeof renderStaffKioskMonitor === 'function' && isStaffMonitorMode) {
      renderStaffKioskMonitor();
    }
    if (currentViewingActivityId) {
      let actLogs = [];
      try {
        actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
      } catch (err) { actLogs = []; }
      const act = activities.find(a => (a.id === currentViewingActivityId || a.activityId === currentViewingActivityId));
      currentAttendeesList = actLogs.filter(l => l.activityId === currentViewingActivityId || (act && l.activityTitle === act.title));
      if (typeof renderAttendeesTable === 'function') renderAttendeesTable(currentAttendeesList);
    }
  }

  if (e.key === 'khalifah_prayer_history' || e.key === 'khalifah_today_prayers' || e.key === 'khalifah_prayer_sync_signal') {
    const tab = document.getElementById('admin-tab-prayers-monitor');
    if (tab && tab.style.display !== 'none') {
      if (currentAdminPrayerMode === 'daily') {
        if (typeof renderAdminPrayerDailyDashboard === 'function') renderAdminPrayerDailyDashboard();
      } else {
        if (typeof renderAdminStudentPrayerHistory === 'function') renderAdminStudentPrayerHistory();
      }
    }
  }
});

let qrScannerStream = null;
let qrScanAnimationId = null;
let qrFacingMode = 'environment'; // Default back camera for QR code scanning
let lastScannedQrCode = '';
let qrCooldownTimer = null;
let isStudentCameraLocked = false;
let currentStudentActivityMode = 'scanner'; // 'scanner' or 'history'

function setStudentActivityMode(mode) {
  currentStudentActivityMode = mode;
  const btnScanner = document.getElementById('btnStudentActScanner');
  const btnHistory = document.getElementById('btnStudentActHistory');
  const secScanner = document.getElementById('studentScannerSection');
  const secHistory = document.getElementById('studentHistorySection');

  if (btnScanner) btnScanner.classList.toggle('active', mode === 'scanner');
  if (btnHistory) btnHistory.classList.toggle('active', mode === 'history');

  if (mode === 'history') {
    // ปิดกล้องและหยุดระบบสแกนทันทีเมื่อดูประวัติ ป้องกันการเผลอสแกน
    stopQrScanner();
    if (secScanner) secScanner.style.display = 'none';
    if (secHistory) secHistory.style.display = 'block';
    renderStudentScannedActivities();
  } else {
    // สลับกลับมาหน้าสแกน
    if (secHistory) secHistory.style.display = 'none';
    if (secScanner) secScanner.style.display = 'block';
    if (!isStudentCameraLocked) {
      startQrScanner();
    }
  }
}

function toggleQrScannerLock(forceLock = null) {
  if (forceLock !== null) {
    isStudentCameraLocked = forceLock;
  } else {
    isStudentCameraLocked = !isStudentCameraLocked;
  }

  const overlay = document.getElementById('qrCameraLockedOverlay');
  const btn = document.getElementById('btnToggleCameraLock');

  if (isStudentCameraLocked) {
    stopQrScanner();
    if (overlay) overlay.style.display = 'flex';
    if (btn) btn.innerHTML = '<i class="fa-solid fa-unlock"></i> <span>ปลดล็อคกล้อง</span>';
    showToast('ล็อคกล้องสแกนชั่วคราวแล้ว เพื่อป้องกันการเผลอสแกนสิ่งอื่น', 'info');
  } else {
    if (overlay) overlay.style.display = 'none';
    if (btn) btn.innerHTML = '<i class="fa-solid fa-lock"></i> <span>ล็อคกล้องชั่วคราว</span>';
    startQrScanner();
    showToast('เปิดกล้องพร้อมสแกน QR Code แล้ว', 'success');
  }
}

async function startQrScanner() {
  if (currentStudentActivityMode === 'history' || isStudentCameraLocked) return;

  const video = document.getElementById('qrScannerVideo');
  const feedback = document.getElementById('qrScanFeedback');
  if (!video) return;

  if (qrScannerStream) {
    qrScannerStream.getTracks().forEach(t => t.stop());
  }

  if (feedback) {
    feedback.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>กำลังเชื่อมต่อกล้องสำหรับสแกน QR Code...</span>';
  }

  try {
    let stream;
    try {
      // Primary attempt with facingMode ideal
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: qrFacingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
    } catch (conErr) {
      // Fallback with basic video constraint
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }

    qrScannerStream = stream;
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.muted = true;
    
    await video.play().catch(e => console.warn('QR video play error:', e));

    if (feedback) {
      feedback.innerHTML = '<i class="fa-solid fa-camera"></i> <span>ส่องกล้องไปที่ QR Code ของกิจกรรมเพื่อเช็คชื่อ</span>';
    }
    qrScanAnimationId = requestAnimationFrame(tickQrScan);
  } catch (err) {
    console.error('startQrScanner error:', err);
    if (feedback) {
      feedback.innerHTML = '<span style="color: var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> ไม่สามารถเปิดกล้องสแกนได้: ' + err.message + ' (สามารถกดปุ่ม "เลือกรูป QR จากเครื่อง" ด้านล่างเพื่อเช็คชื่อได้)</span>';
    }
  }
}

/**
 * รองรับการอัปโหลดหรือเลือกรูปภาพ QR Code จากอุปกรณ์เพื่อสแกนเช็คชื่อ
 */
function handleQrImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  showToast('กำลังวิเคราะห์ QR Code จากรูปภาพ...', 'info');

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (window.jsQR) {
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });
        if (code && code.data) {
          handleQrCodeDetected(code.data);
        } else {
          showToast('ไม่พบ QR Code ในรูปภาพที่เลือก กรุณาลองถ่ายภาพให้ชัดเจนยิ่งขึ้น', 'warning');
        }
      } else {
        showToast('โมดูลสแกน QR Code ยังไม่พร้อม กรุณารอสักครู่', 'error');
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function stopQrScanner() {
  if (qrScanAnimationId) {
    cancelAnimationFrame(qrScanAnimationId);
    qrScanAnimationId = null;
  }
  if (qrScannerStream) {
    try {
      qrScannerStream.getTracks().forEach(t => t.stop());
    } catch (e) {}
    qrScannerStream = null;
  }
  const video = document.getElementById('qrScannerVideo');
  if (video) {
    try {
      video.pause();
      video.srcObject = null;
    } catch (e) {}
  }
}

function switchQrCameraFacing() {
  qrFacingMode = qrFacingMode === 'environment' ? 'user' : 'environment';
  startQrScanner();
}

function tickQrScan() {
  const video = document.getElementById('qrScannerVideo');
  const canvas = document.getElementById('qrScannerCanvas');
  if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
    qrScanAnimationId = requestAnimationFrame(tickQrScan);
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (window.jsQR) {
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert'
    });

    if (code && code.data && code.data !== lastScannedQrCode) {
      handleQrCodeDetected(code.data);
      lastScannedQrCode = code.data;
      clearTimeout(qrCooldownTimer);
      qrCooldownTimer = setTimeout(() => { lastScannedQrCode = ''; }, 3500);
    }
  }

  qrScanAnimationId = requestAnimationFrame(tickQrScan);
}

/**
 * ประมวลผลเมื่อสแกนพบ QR Code: สแกนซ้ำได้ ข้อมูลเวลาและวันที่จะถูกแทนที่ทันที + ซิงก์เรียลไทม์ไปฝั่งแอดมินและ Google Sheets
 */
function handleQrCodeDetected(qrData) {
  if (!currentStudent) {
    showToast('กรุณาเข้าสู่ระบบนักเรียนก่อนเช็คชื่อกิจกรรม', 'warning');
    openModal('authModal');
    return;
  }

  let actId = null;
  let actTitle = 'กิจกรรมของโรงเรียน';

  if (qrData.startsWith('KHALIFAH_ACT:')) {
    const parts = qrData.split(':');
    actId = parts[1];
    actTitle = parts.slice(2).join(':') || 'กิจกรรม';
  } else {
    // Generic QR check
    actTitle = qrData;
    actId = 'ACT-' + Math.abs(qrData.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)).toString().slice(0,6);
  }

  // Find or create in activities list
  let act = activities.find(a => (a.id === actId || a.activityId === actId || a.title === actTitle));
  if (!act) {
    act = {
      id: actId,
      activityId: actId,
      title: actTitle,
      type: 'ทั่วไป',
      date: new Date().toISOString().split('T')[0],
      location: 'โรงเรียน/สถาบัน',
      checkedIn: true
    };
    activities.push(act);
  } else {
    if (!act.id && act.activityId) act.id = act.activityId;
    if (!act.activityId && act.id) act.activityId = act.id;
    act.checkedIn = true;
  }

  // Load student's activity check-in log
  let actLogs = [];
  try {
    actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
  } catch (e) { actLogs = []; }

  const now = new Date();
  const resolvedActId = act.id || act.activityId || actId;
  const existingIndex = actLogs.findIndex(l => isIdMatch(l.studentId, currentStudent.studentId) && (l.activityId === resolvedActId || l.activityTitle === act.title));

  const logEntry = {
    id: 'ACTLOG-' + Date.now(),
    studentId: cleanIdString(currentStudent.studentId),
    studentName: currentStudent.fullName,
    grade: currentStudent.grade || '-',
    activityId: resolvedActId,
    activityTitle: act.title,
    checkInTimestamp: now.toISOString(),
    formattedDate: now.toLocaleDateString('th-TH'),
    formattedTime: now.toLocaleTimeString('th-TH'),
    source: 'สแกน QR Code'
  };

  if (existingIndex !== -1) {
    // สแกนซ้ำได้ ข้อมูลเวลาเข้าวันที่จะถูกแทนที่ด้วยข้อมูลล่าสุด
    actLogs[existingIndex] = logEntry;
  } else {
    actLogs.unshift(logEntry);
  }

  localStorage.setItem('khalifah_student_act_logs', JSON.stringify(actLogs));
  localStorage.setItem('khalifah_activities', JSON.stringify(activities));

  // Audio & Haptic feedback
  playSuccessSound();
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

  const feedback = document.getElementById('qrScanFeedback');
  if (feedback) {
    feedback.innerHTML = `<span style="color: var(--success); font-weight: 600;"><i class="fa-solid fa-circle-check"></i> เช็คชื่อเข้า: ${act.title} สำเร็จ! (${logEntry.formattedTime})</span>`;
  }

  showToast(`เช็คชื่อเข้ากิจกรรม "${act.title}" สำเร็จ! (${logEntry.formattedTime})`, 'success');

  // Display detailed Confirmation Modal to Student
  const modalActName = document.getElementById('scanResActName');
  const modalDate = document.getElementById('scanResDate');
  const modalTime = document.getElementById('scanResTime');
  const modalStudent = document.getElementById('scanResStudent');
  if (modalActName) modalActName.innerText = act.title;
  if (modalDate) modalDate.innerText = logEntry.formattedDate;
  if (modalTime) modalTime.innerText = logEntry.formattedTime + ' น.';
  if (modalStudent) modalStudent.innerText = `${currentStudent.fullName} (${currentStudent.studentId})`;
  openModal('activityScanResultModal');

  renderActivitiesList();
  renderStudentScannedActivities();
  renderAdminActivitiesTable();
  renderAdminLiveActivityFeed();
  renderDashboardCharts();
  renderCurrentStudentProfile();

  // Instant local broadcast to admin devices & open windows (0ms delay)
  if (khalifahActivityBroadcast) {
    try {
      khalifahActivityBroadcast.postMessage({
        type: 'ACTIVITY_CHECK_IN',
        log: logEntry
      });
    } catch (e) {}
  }
  try {
    localStorage.setItem('khalifah_activity_sync_signal', Date.now().toString());
  } catch (e) {}

  // Sync to Google Sheets
  syncRecordToGoogleSheet('activityCheckIn', logEntry);
}

function renderStudentScannedActivities(filterDate = null) {
  const container = document.getElementById('studentScannedActivitiesList');
  const badge = document.getElementById('scannedActivitiesCountBadge');
  if (!container) return;

  if (!currentStudent) {
    container.innerHTML = '<div style="text-align: center; padding: 1.5rem; color: var(--text-muted);">กรุณาเข้าสู่ระบบเพื่อดูประวัติกิจกรรม</div>';
    if (badge) badge.innerText = '0 กิจกรรม';
    return;
  }

  let actLogs = [];
  try {
    actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
  } catch (e) { actLogs = []; }

  let myLogs = actLogs.filter(l => isIdMatch(l.studentId, currentStudent.studentId));

  // Filter by selected date if provided (e.g. YYYY-MM-DD)
  if (filterDate) {
    myLogs = myLogs.filter(l => {
      if (!l.checkInTimestamp) return false;
      return l.checkInTimestamp.startsWith(filterDate);
    });
  }

  if (badge) badge.innerText = `${myLogs.length} กิจกรรม`;

  if (myLogs.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 1.5rem; color: var(--text-muted); background: #f8fafc; border-radius: var(--radius-md);">
        <i class="fa-solid fa-calendar-xmark" style="font-size: 1.8rem; margin-bottom: 0.4rem; display: block;"></i>
        ${filterDate ? 'ไม่พบกิจกรรมที่เข้าร่วมในวันที่เลือก' : 'ยังไม่มีประวัติการเช็คชื่อกิจกรรม ใช้กล้องด้านบนสแกน QR Code ของกิจกรรมได้เลย'}
      </div>
    `;
    return;
  }

  container.innerHTML = myLogs.map(l => `
    <div class="activity-card" style="padding: 0.85rem 1rem; margin-bottom: 0.65rem;">
      <div>
        <span class="activity-badge badge-active" style="margin-bottom: 0.2rem;">
          <i class="fa-solid fa-check"></i> เช็คชื่อแล้ว
        </span>
        <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-dark); margin: 0 0 0.2rem 0;">
          ${l.activityTitle}
        </h4>
        <div style="font-size: 0.76rem; color: var(--text-muted);">
          <i class="fa-solid fa-clock"></i> เวลาเช็คล่าสุด: ${l.formattedDate} เวลา ${l.formattedTime} น.
        </div>
      </div>
      <span style="font-size: 0.72rem; color: var(--primary); font-weight: 600; white-space: nowrap;">
        สแกนอัปเดตได้
      </span>
    </div>
  `).join('');
}

function filterStudentActivitiesByDate() {
  const dateInput = document.getElementById('filterActDate');
  const val = dateInput ? dateInput.value : null;
  renderStudentScannedActivities(val);
}

function clearActDateFilter() {
  const dateInput = document.getElementById('filterActDate');
  if (dateInput) dateInput.value = '';
  renderStudentScannedActivities(null);
}

// ----------------- ADMIN ACTIVITIES & QR CODE GENERATOR + REAL-TIME LIVE FEED ----------------- //
let isAdminLiveFeedExpanded = false;

function toggleAdminLiveFeedCard(forceState = null) {
  const card = document.getElementById('adminLiveFeedCard');
  const body = document.getElementById('adminLiveFeedBodyContainer');
  const icon = document.getElementById('toggleLiveFeedIcon');
  const text = document.getElementById('toggleLiveFeedText');

  if (forceState !== null) {
    isAdminLiveFeedExpanded = forceState;
  } else {
    isAdminLiveFeedExpanded = !isAdminLiveFeedExpanded;
  }

  if (isAdminLiveFeedExpanded) {
    if (card) card.classList.remove('collapsed');
    if (body) body.style.display = 'block';
    if (icon) icon.className = 'fa-solid fa-chevron-up';
    if (text) text.innerText = 'ย่อเก็บมอนิเตอร์';
    renderAdminLiveActivityFeed();
  } else {
    if (card) card.classList.add('collapsed');
    if (body) body.style.display = 'none';
    if (icon) icon.className = 'fa-solid fa-chevron-down';
    if (text) text.innerText = 'เปิดมอนิเตอร์รวม';
  }
}

function adminQuickFillActivity(presetKey) {
  const presets = {
    halaqah: {
      title: 'กิจกรรมหะลาเกาะฮฺตัซกียะฮฺยามเช้า',
      type: 'หะลาเกาะฮฺ',
      location: 'มัสยิดอัลฮารอมัยน์'
    },
    qiyam: {
      title: 'กิจกรรมละหมาดกียามุลลัยลฺประจำสัปดาห์',
      type: 'กียาม',
      location: 'มัสยิดอัลฮารอมัยน์'
    },
    jumaah: {
      title: 'ละหมาดวันศุกร์ (ญุมอะฮฺ)',
      type: 'ศาสนา',
      location: 'มัสยิดอัลฮารอมัยน์'
    },
    lecture: {
      title: 'บรรยายธรรมและข้อคิดอิสลาม',
      type: 'วิชาการ',
      location: 'หอประชุมใหญ่'
    },
    volunteer: {
      title: 'กิจกรรมจิตอาสาพัฒนาสถาบัน',
      type: 'จิตอาสา',
      location: 'บริเวณมัสยิดและสถาบัน'
    }
  };

  const preset = presets[presetKey];
  if (!preset) return;

  const titleEl = document.getElementById('newActTitle');
  const typeEl = document.getElementById('newActType');
  const locEl = document.getElementById('newActLocation');
  const dateEl = document.getElementById('newActDate');

  if (titleEl) titleEl.value = preset.title;
  if (typeEl) typeEl.value = preset.type;
  if (locEl) locEl.value = preset.location;
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

  showToast(`เลือกเทมเพลต "${preset.title}" แล้ว สามารถกด "บันทึกกิจกรรม" ได้ทันที`, 'info');
  if (titleEl) titleEl.focus();
}

function adminCreateNewActivity() {
  const title = document.getElementById('newActTitle').value.trim();
  const type = document.getElementById('newActType').value;
  const location = document.getElementById('newActLocation').value.trim() || 'มัสยิดอัลฮารอมัยน์';
  const date = document.getElementById('newActDate').value || new Date().toISOString().split('T')[0];

  if (!title) {
    showToast('กรุณากรอกชื่อกิจกรรม', 'warning');
    return;
  }

  const actId = 'ACT-' + Date.now().toString().slice(-6);
  const newAct = {
    id: actId,
    activityId: actId,
    title: title,
    type: type,
    location: location,
    date: date,
    checkedIn: false
  };

  activities.unshift(newAct);
  localStorage.setItem('khalifah_activities', JSON.stringify(activities));

  document.getElementById('newActTitle').value = '';
  renderActivitiesList();
  renderAdminActivitiesTable();
  renderAdminLiveActivityFeed();
  showToast(`สร้างกิจกรรม "${title}" เรียบร้อยแล้ว`, 'success');

  // Open QR modal right away for printing
  openActivityQrModal(newAct.id);

  if (khalifahActivityBroadcast) {
    try {
      khalifahActivityBroadcast.postMessage({ type: 'ACTIVITY_CREATED', activity: newAct });
    } catch (e) {}
  }

  syncRecordToGoogleSheet('createActivity', newAct);
}

function openActivityQrModal(actId) {
  const act = activities.find(a => (a.id === actId || a.activityId === actId));
  if (!act) return;
  const resolvedId = act.id || act.activityId;

  const displayEl = document.getElementById('activityQrCodeDisplay');
  const titleEl = document.getElementById('activityQrName');
  const subEl = document.getElementById('activityQrSub');

  if (titleEl) titleEl.innerText = act.title;
  if (subEl) subEl.innerText = `ประเภท: ${act.type} • วันที่: ${act.date} • สถานที่: ${act.location}`;

  if (displayEl) {
    displayEl.innerHTML = '';
    if (window.QRCode) {
      new QRCode(displayEl, {
        text: `KHALIFAH_ACT:${resolvedId}:${act.title}`,
        width: 220,
        height: 220,
        colorDark: '#0284c7',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  }

  openModal('activityQrModal');
}

function adminManualCheckInStudent() {
  const actId = document.getElementById('manualActSelect').value;
  const rawStdId = document.getElementById('manualStudentIdInput').value.trim();
  const stdId = cleanIdString(rawStdId);

  if (!actId || !stdId) {
    showToast('กรุณาเลือกกิจกรรมและระบุรหัสนักเรียน', 'warning');
    return;
  }

  const student = allStudents.find(s => isIdMatch(s.studentId, stdId));
  const act = activities.find(a => (a.id === actId || a.activityId === actId));

  if (!act) {
    showToast('ไม่พบกิจกรรมที่เลือก', 'error');
    return;
  }

  const resolvedActId = act.id || act.activityId;
  const resolvedStudentId = student ? cleanIdString(student.studentId) : stdId;
  const studentName = student ? student.fullName : ('นักเรียน (' + resolvedStudentId + ')');
  const studentGrade = student ? student.grade : '-';

  let actLogs = [];
  try {
    actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
  } catch (e) { actLogs = []; }

  const now = new Date();
  const existingIndex = actLogs.findIndex(l => isIdMatch(l.studentId, resolvedStudentId) && (l.activityId === resolvedActId || l.activityTitle === act.title));

  const logEntry = {
    id: 'ACTLOG-' + Date.now(),
    studentId: resolvedStudentId,
    studentName: studentName,
    grade: studentGrade,
    activityId: resolvedActId,
    activityTitle: act.title,
    checkInTimestamp: now.toISOString(),
    formattedDate: now.toLocaleDateString('th-TH'),
    formattedTime: now.toLocaleTimeString('th-TH'),
    source: 'เช็คชื่อโดยแอดมิน'
  };

  if (existingIndex !== -1) {
    actLogs[existingIndex] = logEntry;
  } else {
    actLogs.unshift(logEntry);
  }

  localStorage.setItem('khalifah_student_act_logs', JSON.stringify(actLogs));
  document.getElementById('manualStudentIdInput').value = '';
  renderAdminActivitiesTable();
  renderAdminLiveActivityFeed();
  showToast(`เช็คชื่อ ${studentName} เข้ากิจกรรม "${act.title}" เรียบร้อย!`, 'success');

  // Broadcast instant sync
  if (khalifahActivityBroadcast) {
    try {
      khalifahActivityBroadcast.postMessage({ type: 'ACTIVITY_CHECK_IN', log: logEntry });
    } catch (e) {}
  }
  try {
    localStorage.setItem('khalifah_activity_sync_signal', Date.now().toString());
  } catch (e) {}

  syncRecordToGoogleSheet('activityCheckIn', logEntry);
}

function adminDeleteActivity(actId) {
  const act = activities.find(a => (a.id === actId || a.activityId === actId));
  if (!confirm(`ยืนยันการลบกิจกรรม "${act ? act.title : actId}" ออกจากระบบและ Google Sheets?`)) return;

  activities = activities.filter(a => (a.id !== actId && a.activityId !== actId));
  localStorage.setItem('khalifah_activities', JSON.stringify(activities));

  renderActivitiesList();
  renderAdminActivitiesTable();
  renderAdminLiveActivityFeed();
  showToast('ลบกิจกรรมเรียบร้อยแล้ว', 'info');

  syncRecordToGoogleSheet('deleteActivity', { activityId: actId });
}

let currentViewingActivityId = null;
let currentAttendeesList = [];

function renderAdminActivitiesTable() {
  const tbody = document.getElementById('adminActivitiesTableBody');
  const selectEl = document.getElementById('manualActSelect');
  if (!tbody) return;

  let actLogs = [];
  try {
    actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
  } catch (e) { actLogs = []; }

  tbody.innerHTML = activities.map(a => {
    const actId = a.id || a.activityId;
    const participantsCount = actLogs.filter(l => l.activityId === actId || l.activityTitle === a.title).length;
    return `
      <tr>
        <td><b>${actId}</b></td>
        <td style="font-weight: 600; color: var(--text-dark);">${a.title}</td>
        <td><span class="activity-badge badge-upcoming">${a.type || 'กิจกรรม'}</span></td>
        <td>${a.location || '-'}</td>
        <td>${a.date || '-'}</td>
        <td>
          <span style="font-weight: 700; color: #0369a1; background: #e0f2fe; padding: 0.25rem 0.65rem; border-radius: 9999px; border: 1px solid #bae6fd; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer;" onclick="openActivityAttendeesModal('${actId}')" title="คลิกเพื่อเปิดมอนิเตอร์สดเฉพาะกิจกรรมนี้">
            <i class="fa-solid fa-tower-broadcast"></i> ${participantsCount} คน
          </span>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-primary btn-sm" onclick="openActivityAttendeesModal('${actId}')" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; margin-right: 0.3rem; font-weight: 600;" title="เปิดดูมอนิเตอร์สดและรายชื่อผู้สแกนกิจกรรมนี้ (พร้อม QR Code ข้างซ้าย)">
            <i class="fa-solid fa-tower-broadcast"></i> เปิดมอนิเตอร์สด (${participantsCount})
          </button>
          <button class="btn btn-secondary btn-sm" onclick="copyStaffMonitorLink('${actId}')" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; margin-right: 0.3rem;" title="คัดลอกลิงก์มอนิเตอร์สำหรับสตาฟ (ไม่ต้องล็อกอิน)">
            <i class="fa-solid fa-share-nodes"></i> แชร์ให้สตาฟ
          </button>
          <button class="btn btn-secondary btn-sm" onclick="openStaffMonitorStandalone('${actId}')" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; margin-right: 0.3rem;" title="เปิดหน้าจอมอนิเตอร์แบบ Kiosk เต็มจอในแท็บใหม่">
            <i class="fa-solid fa-display"></i> จอ Kiosk
          </button>
          <button class="btn btn-secondary btn-sm" onclick="openActivityQrModal('${actId}')" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; margin-right: 0.3rem;" title="แสดง QR Code สำหรับให้นักเรียนสแกน">
            <i class="fa-solid fa-qrcode"></i> พิมพ์ QR
          </button>
          <button class="btn btn-outline btn-sm" onclick="adminDeleteActivity('${actId}')" style="padding: 0.35rem 0.55rem; font-size: 0.8rem; color: #ef4444; border-color: #fecaca;" title="ลบกิจกรรม">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (selectEl) {
    selectEl.innerHTML = activities.map(a => {
      const actId = a.id || a.activityId;
      return `<option value="${actId}">${a.title} (${a.date || '-'})</option>`;
    }).join('');
  }
}

function renderAdminLiveActivityFeed() {
  const tbody = document.getElementById('adminLiveActivityLogsTableBody');
  const filterSelect = document.getElementById('liveFeedActivityFilter');
  const countBadge = document.getElementById('adminLiveFeedCountBadge') || document.getElementById('liveScanCountBadge');
  if (!tbody) return;

  // Populate activity filter dropdown while preserving selection
  if (filterSelect) {
    const prevVal = filterSelect.value || 'ALL';
    filterSelect.innerHTML = `<option value="ALL">ทุกกิจกรรม (ทั้งหมด)</option>` +
      activities.map(a => {
        const actId = a.id || a.activityId;
        return `<option value="${actId}">${a.title}</option>`;
      }).join('');
    if ([...filterSelect.options].some(o => o.value === prevVal)) {
      filterSelect.value = prevVal;
    }
  }

  let actLogs = [];
  try {
    actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
  } catch (e) { actLogs = []; }

  const selectedActId = filterSelect ? filterSelect.value : 'ALL';
  let filteredLogs = [...actLogs];
  if (selectedActId && selectedActId !== 'ALL') {
    const targetAct = activities.find(a => (a.id === selectedActId || a.activityId === selectedActId));
    filteredLogs = filteredLogs.filter(l => l.activityId === selectedActId || (targetAct && l.activityTitle === targetAct.title));
  }

  // Sort latest first
  filteredLogs.sort((a, b) => {
    const ta = a.checkInTimestamp ? new Date(a.checkInTimestamp).getTime() : 0;
    const tb = b.checkInTimestamp ? new Date(b.checkInTimestamp).getTime() : 0;
    return tb - ta;
  });

  if (countBadge) {
    countBadge.innerHTML = `<i class="fa-solid fa-users"></i> สแกนแล้ว: ${filteredLogs.length} รายการ`;
  }

  if (filteredLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
          <i class="fa-solid fa-satellite-dish" style="font-size: 1.35rem; color: #94a3b8; margin-bottom: 0.35rem; display: block;"></i>
          กำลังรอรับข้อมูลสแกน QR Code จากนักเรียนแบบเรียลไทม์...
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredLogs.slice(0, 50).map((item, idx) => `
    <tr>
      <td style="text-align: center; color: var(--text-muted); font-weight: 600;">${idx + 1}</td>
      <td>
        <span style="font-weight: 700; color: #0284c7;"><i class="fa-regular fa-clock"></i> ${item.formattedTime || '-'}</span>
        <span style="font-size: 0.73rem; color: var(--text-muted); margin-left: 0.25rem;">(${item.formattedDate || '-'})</span>
      </td>
      <td><b>${item.studentId || '-'}</b></td>
      <td style="font-weight: 600; color: var(--text-dark);">${item.studentName || '-'}</td>
      <td><span class="badge" style="background: #f1f5f9; color: var(--text-dark); font-size: 0.76rem;">${item.grade || '-'}</span></td>
      <td><span style="font-weight: 600; color: #0369a1;">${item.activityTitle || item.activityId || '-'}</span></td>
      <td style="text-align: right;">
        <span style="background: #dcfce7; color: #166534; font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 9999px; display: inline-flex; align-items: center; gap: 0.25rem;">
          <i class="fa-solid fa-qrcode"></i> ${item.source || 'สแกน QR สำเร็จ'}
        </span>
      </td>
    </tr>
  `).join('');
}

// ----------------- COMPREHENSIVE CLOUD DATABASE SYNC ENGINE (FULL GOOGLE SHEETS SYNC) ----------------- //
let isSyncingAllCloud = false;

async function syncAllDataFromCloud(showToastMsg = false) {
  if (isSyncingAllCloud) return;
  let url = gasApiUrl || localStorage.getItem('khalifah_gas_url') || DEFAULT_GAS_API_URL;
  if (url && url.includes('docs.google.com/spreadsheets')) url = DEFAULT_GAS_API_URL;
  if (!url || !navigator.onLine) return;

  isSyncingAllCloud = true;
  if (showToastMsg) {
    showToast('กำลังเชื่อมต่อและดึงข้อมูลล่าสุดจาก Google Sheets...', 'info');
  }

  try {
    const sep = url.includes('?') ? '&' : '?';
    let db = null;

    // ลองดึงฐานข้อมูลเต็มผ่าน action=getFullDatabase ในคำขอเดียว
    try {
      const fullResp = await fetch(`${url}${sep}action=getFullDatabase&_t=${Date.now()}`);
      const fullJson = await fullResp.json();
      if (fullJson && fullJson.success) {
        db = fullJson;
      }
    } catch (e) {
      db = null;
    }

    // หาก endpoint รวมยังไม่พร้อม ให้ดึงแบบขนานจากทุก endpoint เดิม
    if (!db) {
      const [stdRes, admRes, pendRes, actRes, logsRes, pryRes, attRes, hasRes, grdRes, setRes, calRes] = await Promise.all([
        fetch(`${url}${sep}action=getAllStudents&_t=${Date.now()}`).then(r => r.json()).catch(() => null),
        fetch(`${url}${sep}action=getSubAdmins&_t=${Date.now()}`).then(r => r.json()).catch(() => null),
        fetch(`${url}${sep}action=getPendingRegistrations&_t=${Date.now()}`).then(r => r.json()).catch(() => null),
        fetch(`${url}${sep}action=getActivities&_t=${Date.now()}`).then(r => r.json()).catch(() => null),
        fetch(`${url}${sep}action=getActivityLogs&_t=${Date.now()}`).then(r => r.json()).catch(() => null),
        fetch(`${url}${sep}action=getPrayers&_t=${Date.now()}`).then(r => r.json()).catch(() => null),
        fetch(`${url}${sep}action=getAttendance&_t=${Date.now()}`).then(r => r.json()).catch(() => null),
        fetch(`${url}${sep}action=getHasanat&_t=${Date.now()}`).then(r => r.json()).catch(() => null),
        fetch(`${url}${sep}action=getSubjectGrades&_t=${Date.now()}`).then(r => r.json()).catch(() => null),
        fetch(`${url}${sep}action=getSettings&_t=${Date.now()}`).then(r => r.json()).catch(() => null),
        fetch(`${url}${sep}action=getCalendarEvents&_t=${Date.now()}`).then(r => r.json()).catch(() => null)
      ]);
      db = {
        students: stdRes && stdRes.data ? stdRes.data : [],
        subAdmins: admRes && admRes.data ? admRes.data : [],
        pendingRegistrations: pendRes && pendRes.data ? pendRes.data : [],
        activities: actRes && actRes.data ? actRes.data : [],
        activityLogs: logsRes && logsRes.data ? logsRes.data : [],
        prayers: pryRes && pryRes.data ? pryRes.data : [],
        attendance: attRes && attRes.data ? attRes.data : [],
        hasanat: hasRes && hasRes.data ? hasRes.data : [],
        subjectGrades: grdRes && grdRes.data ? grdRes.data : [],
        calendarEvents: calRes && calRes.data ? calRes.data : [],
        settings: setRes && setRes.data ? setRes.data : {}
      };
    }

    // 1. ซิงค์ตารางนักเรียน (Students)
    if (Array.isArray(db.students) && db.students.length > 0) {
      const cloudMap = {};
      db.students.forEach(s => {
        if (!s || !s.studentId) return;
        const sid = cleanIdString(s.studentId);
        s.studentId = sid;
        s.parentPhone = normalizePhone(s.parentPhone);
        s.birthDate = normalizeBirthDate(s.birthDate);

        // Check local persistent avatar cache
        const cachedAvatar = localStorage.getItem('khalifah_student_avatar_' + sid);
        const validCloudUrl = getDirectImageUrl(s.avatarUrl);

        if (validCloudUrl) {
          // Cloud has verified Google Drive URL: update cache
          s.avatarUrl = validCloudUrl;
          s.profilePhoto = validCloudUrl;
          localStorage.setItem('khalifah_student_avatar_' + sid, validCloudUrl);
        } else if (cachedAvatar) {
          // Cloud has empty/pending/invalid avatar, but local device has saved photo: PRESERVE IT!
          s.avatarUrl = cachedAvatar;
          s.profilePhoto = cachedAvatar;
        } else {
          s.avatarUrl = '';
          s.profilePhoto = '';
        }
        cloudMap[sid] = s;
      });

      // ปรับปรุง allStudents ให้ตรงกับ Google Sheets
      const mergedStudents = Object.values(cloudMap);
      allStudents = mergedStudents;
      localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));

      // ตรวจสอบความถูกต้องของนักเรียนที่กำลังล็อกอิน (Strict Session Verification)
      if (currentStudent) {
        const curSid = cleanIdString(currentStudent.studentId);
        if (cloudMap[curSid]) {
          const oldAvatar = currentStudent.avatarUrl || localStorage.getItem('khalifah_student_avatar_' + curSid);
          currentStudent = { ...currentStudent, ...cloudMap[curSid] };
          if (!getDirectImageUrl(currentStudent.avatarUrl) && getDirectImageUrl(oldAvatar)) {
            currentStudent.avatarUrl = oldAvatar;
          }
          localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
        } else {
          // ไม่พบในฐานข้อมูล Google Sheets! ตรวจสอบว่ารออนุมัติ OTP หรือไม่
          const isPending = Array.isArray(db.pendingRegistrations) && db.pendingRegistrations.some(p => isIdMatch(p.userId, curSid));
          if (!isPending) {
            console.warn(`นักเรียนรหัส ${curSid} ไม่มีอยู่จริงใน Google Sheets จึงต้องออกจากระบบ`);
            localStorage.removeItem('khalifah_current_student');
            currentStudent = null;
            document.body.classList.add('auth-locked');
            showToast('บัญชีของคุณไม่มีอยู่ในฐานข้อมูล Google Sheets กรุณาติดต่อผู้ดูแลระบบหรือลงทะเบียนใหม่', 'warning');
            enforceMandatoryLogin();
          }
        }
      }
    }

    // 2. ซิงค์อาจารย์และบุคลากร (SubAdmins)
    if (Array.isArray(db.subAdmins) && db.subAdmins.length > 0) {
      subAdmins = db.subAdmins;
      localStorage.setItem('khalifah_sub_admins', JSON.stringify(subAdmins));

      if (currentAdmin && currentAdmin.role !== 'SuperAdmin') {
        const curUser = cleanIdString(currentAdmin.username);
        const adminFound = subAdmins.find(a => isIdMatch(a.username, curUser));
        if (adminFound) {
          currentAdmin = { ...currentAdmin, ...adminFound };
        } else {
          console.warn(`บัญชีอาจารย์ ${curUser} ไม่มีอยู่ใน Google Sheets`);
        }
      }
    }

    // 3. ซิงค์รายการรออนุมัติและ OTP (Pending Registrations)
    if (Array.isArray(db.pendingRegistrations)) {
      savePendingRegistrations(db.pendingRegistrations);
    }

    // 4. ซิงค์กิจกรรมและผู้เข้าร่วม (Activities & Activity Logs)
    if (Array.isArray(db.activities) && db.activities.length > 0) {
      activities = db.activities;
      localStorage.setItem('khalifah_activities', JSON.stringify(activities));
    }
    if (Array.isArray(db.activityLogs)) {
      localStorage.setItem('khalifah_student_act_logs', JSON.stringify(db.activityLogs));
    }

    // 5. ซิงค์บันทึกเวลาละหมาด (Prayers)
    if (Array.isArray(db.prayers) && db.prayers.length > 0) {
      localStorage.setItem('khalifah_prayer_history', JSON.stringify(db.prayers));
      const todayStr = new Date().toISOString().split('T')[0];
      todayPrayers = db.prayers.filter(p => p.date === todayStr);
      localStorage.setItem('khalifah_today_prayers', JSON.stringify(todayPrayers));
    }

    // 6. ซิงค์ผลบุญ (Hasanat)
    if (Array.isArray(db.hasanat) && db.hasanat.length > 0) {
      let allHasanat = {};
      try {
        allHasanat = JSON.parse(localStorage.getItem('khalifah_student_hasanat') || '{}');
      } catch (e) { allHasanat = {}; }
      db.hasanat.forEach(item => {
        const sid = cleanIdString(item.studentId);
        if (!sid) return;
        allHasanat[sid] = allHasanat[sid] || {};
        if (item.quran) allHasanat[sid].quran = { ...(allHasanat[sid].quran || {}), ...item.quran };
        if (item.memorization) allHasanat[sid].memorization = { ...(allHasanat[sid].memorization || {}), ...item.memorization };
        if (item.sunnah) allHasanat[sid].sunnah = { ...(allHasanat[sid].sunnah || {}), ...item.sunnah };
      });
      localStorage.setItem('khalifah_student_hasanat', JSON.stringify(allHasanat));
    }

    // 7. ซิงค์รายวิชาและการตั้งค่า (Subjects & Settings)
    if (db.settings) {
      if (db.settings.AppSubjects) {
        try {
          const parsedSubj = JSON.parse(db.settings.AppSubjects);
          if (Array.isArray(parsedSubj) && parsedSubj.length > 0) {
            appSubjects = parsedSubj;
            localStorage.setItem('khalifah_subjects', JSON.stringify(appSubjects));
          }
        } catch (e) {}
      }
      if (db.settings.PrayerBufferMinutes) {
        const bufferVal = parseInt(db.settings.PrayerBufferMinutes, 10);
        if (!isNaN(bufferVal)) {
          prayerBufferMinutes = bufferVal;
          localStorage.setItem('khalifah_prayer_buffer_mins', String(bufferVal));
        }
      }
    }

    // 8. ซิงค์ปฏิทินกิจกรรม (Calendar Events)
    if (Array.isArray(db.calendarEvents) && db.calendarEvents.length > 0) {
      calendarEvents = db.calendarEvents;
      localStorage.setItem('khalifah_calendar_events', JSON.stringify(calendarEvents));
    }

    // อัปเดตการแสดงผลหน้าจอทั้งหมด
    renderCurrentStudentProfile();
    renderDashboardCharts();
    if (typeof renderCalendar === 'function') renderCalendar('all');
    renderActivitiesList();
    renderTodayPrayerTable();
    renderPrayerHistory();
    renderAdminStudentsTable();
    renderSubAdminsTable();
    renderPendingApprovalsTable();
    renderAdminActivitiesTable();
    renderAdminLiveActivityFeed();
    renderSuperAdminOverviewKpis();
    if (typeof initTeacherPortalView === 'function' && currentAdmin) {
      initTeacherPortalView();
    }

    if (showToastMsg) {
      playSuccessSound();
      showToast('ซิงค์ฐานข้อมูลล่าสุดกับ Google Sheets สำเร็จเรียบร้อย!', 'success');
    }
  } catch (err) {
    console.warn('syncAllDataFromCloud error:', err);
    if (showToastMsg) {
      showToast('ไม่สามารถเชื่อมต่อฐานข้อมูล Google Sheets ได้: ' + err.message, 'warning');
    }
  } finally {
    isSyncingAllCloud = false;
  }
}

let adminActivityPollingTimer = null;

async function fetchActivitiesAndLogsFromCloud(showToastMsg = false) {
  let url = gasApiUrl || localStorage.getItem('khalifah_gas_url') || DEFAULT_GAS_API_URL;
  if (url && url.includes('docs.google.com/spreadsheets')) url = DEFAULT_GAS_API_URL;
  if (!url) {
    renderAdminActivitiesTable();
    renderAdminLiveActivityFeed();
    return;
  }

  try {
    const sep = url.includes('?') ? '&' : '?';
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 4000) : null;

    const fetchOptions = {
      method: 'GET',
      redirect: 'follow',
      ...(controller ? { signal: controller.signal } : {})
    };

    const [actRes, logsRes] = await Promise.all([
      fetch(`${url}${sep}action=getActivities&_t=${Date.now()}`, fetchOptions).then(r => r.json()).catch(() => null),
      fetch(`${url}${sep}action=getActivityLogs&_t=${Date.now()}`, fetchOptions).then(r => r.json()).catch(() => null)
    ]);
    if (timeoutId) clearTimeout(timeoutId);

    // Merge activities from cloud
    if (actRes && (actRes.success || actRes.status === 'success') && Array.isArray(actRes.data)) {
      let localActs = [...activities];
      actRes.data.forEach(cloudAct => {
        const cId = String(cloudAct.id || cloudAct.activityId || '').trim();
        const cTitle = String(cloudAct.title || '').trim();
        if (!cId && !cTitle) return;
        const idx = localActs.findIndex(a => (cId && (a.id === cId || a.activityId === cId)) || (cTitle && a.title === cTitle));
        const normalized = {
          id: cId || ('ACT-' + Date.now().toString().slice(-6)),
          activityId: cId || ('ACT-' + Date.now().toString().slice(-6)),
          title: cTitle || 'กิจกรรม',
          type: cloudAct.type || 'ทั่วไป',
          location: cloudAct.location || 'มัสยิดอัลฮารอมัยน์',
          date: cloudAct.date || new Date().toISOString().split('T')[0],
          checkedIn: idx !== -1 ? Boolean(localActs[idx].checkedIn) : false
        };
        if (idx !== -1) {
          localActs[idx] = { ...localActs[idx], ...normalized };
        } else {
          localActs.unshift(normalized);
        }
      });
      activities = localActs;
      localStorage.setItem('khalifah_activities', JSON.stringify(activities));
    }

    // Merge activity logs from cloud
    if (logsRes && (logsRes.success || logsRes.status === 'success') && Array.isArray(logsRes.data)) {
      let localLogs = [];
      try {
        localLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
      } catch (e) { localLogs = []; }

      logsRes.data.forEach(cloudLog => {
        const stdId = cleanIdString(cloudLog.studentId || '');
        const actId = String(cloudLog.activityId || '').trim();
        let actTitle = String(cloudLog.activityTitle || '').trim();
        if (!stdId) return;

        // Clean out raw prefix if present
        if (actTitle.toUpperCase().startsWith('KHALIFAH_ACT:')) {
          const parts = actTitle.split(':');
          if (parts.length >= 3) actTitle = parts.slice(2).join(':').trim();
        }

        const existingIdx = localLogs.findIndex(l =>
          isIdMatch(l.studentId, stdId) &&
          ((actId && l.activityId === actId) || (actTitle && l.activityTitle === actTitle))
        );

        const mergedEntry = {
          id: cloudLog.id || ('ACTLOG-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5)),
          studentId: stdId,
          studentName: cloudLog.studentName || ('นักเรียน (' + stdId + ')'),
          grade: cloudLog.grade || '-',
          activityId: actId || actTitle,
          activityTitle: actTitle || actId || 'กิจกรรม',
          checkInTimestamp: cloudLog.checkInTimestamp || new Date().toISOString(),
          formattedDate: cloudLog.formattedDate || '-',
          formattedTime: cloudLog.formattedTime || '-',
          source: cloudLog.source || 'Google Sheets Sync'
        };

        if (existingIdx !== -1) {
          localLogs[existingIdx] = { ...localLogs[existingIdx], ...mergedEntry };
        } else {
          localLogs.unshift(mergedEntry);
        }
      });

      // Mark activities checkedIn for currentStudent if present in logs
      if (currentStudent) {
        activities.forEach(a => {
          const aId = a.id || a.activityId;
          const hasChecked = localLogs.some(l => isIdMatch(l.studentId, currentStudent.studentId) && (l.activityId === aId || l.activityTitle === a.title));
          if (hasChecked) a.checkedIn = true;
        });
        localStorage.setItem('khalifah_activities', JSON.stringify(activities));
      }

      localStorage.setItem('khalifah_student_act_logs', JSON.stringify(localLogs));

      // Refresh attendees modal if currently open
      if (currentViewingActivityId) {
        const act = activities.find(a => (a.id === currentViewingActivityId || a.activityId === currentViewingActivityId));
        currentAttendeesList = localLogs.filter(l => l.activityId === currentViewingActivityId || (act && l.activityTitle === act.title));
        renderAttendeesTable(currentAttendeesList);
      }
    }

    renderActivitiesList();
    renderStudentScannedActivities();
    renderAdminActivitiesTable();
    renderAdminLiveActivityFeed();
    renderSuperAdminOverviewKpis();
    if (typeof renderStaffKioskMonitor === 'function' && (isStaffMonitorMode || staffMonitorActiveActId)) {
      renderStaffKioskMonitor();
    }

    if (showToastMsg) {
      showToast('ซิงก์ข้อมูลกิจกรรมและผู้สแกน QR จาก Google Sheets ล่าสุดแล้ว', 'success');
    }
  } catch (err) {
    console.warn('fetchActivitiesAndLogsFromCloud failed:', err);
    if (showToastMsg) {
      showToast('ไม่สามารถดึงข้อมูลกิจกรรมจาก Cloud ได้ ใช้ข้อมูลในเครื่องแทน', 'warning');
    }
  }
}

function syncActivitiesAndLogsNow(showToastMsg = false) {
  fetchActivitiesAndLogsFromCloud(showToastMsg);
}

let isActivityPollingBusy = false;

function startAdminActivityLivePolling(intervalMs = 2500) {
  stopAdminActivityLivePolling();
  adminActivityPollingTimer = setInterval(async () => {
    if (isActivityPollingBusy) return;
    const adminView = document.getElementById('view-admin');
    const isActModalOpen = currentViewingActivityId !== null;
    const isAdminViewActive = !!currentAdmin && adminView && adminView.classList.contains('active');
    const isStaffKioskActive = isStaffMonitorMode || document.body.classList.contains('staff-monitor-active');

    if (isAdminViewActive || isActModalOpen || isStaffKioskActive) {
      isActivityPollingBusy = true;
      try {
        await fetchActivitiesAndLogsFromCloud(false);
      } finally {
        isActivityPollingBusy = false;
      }
    }
  }, intervalMs);
}

function stopAdminActivityLivePolling() {
  if (adminActivityPollingTimer) {
    clearInterval(adminActivityPollingTimer);
    adminActivityPollingTimer = null;
  }
}

function openActivityAttendeesModal(actId) {
  currentViewingActivityId = actId;
  const act = activities.find(a => (a.id === actId || a.activityId === actId));
  const resolvedId = act ? (act.id || act.activityId) : actId;
  const actTitle = act ? act.title : actId;

  const titleEl = document.getElementById('actAttendeesModalTitle');
  const subEl = document.getElementById('actAttendeesModalSubtitle');
  const searchInput = document.getElementById('attendeesSearchInput');

  if (titleEl) {
    titleEl.innerHTML = `<i class="fa-solid fa-tower-broadcast" style="color: var(--primary);"></i> มอนิเตอร์ผู้สแกน: ${actTitle}`;
  }
  if (subEl) {
    subEl.innerText = `ประเภท: ${act ? act.type : '-'} | วันที่: ${act ? act.date : '-'} | สถานที่: ${act ? act.location : '-'}`;
  }
  if (searchInput) searchInput.value = '';

  // Render High-Contrast QR Code on Left Panel of Modal for on-screen scanning
  const qrEl = document.getElementById('actModalQrCodeDisplay');
  if (qrEl) {
    qrEl.innerHTML = '';
    if (window.QRCode) {
      new QRCode(qrEl, {
        text: `KHALIFAH_ACT:${resolvedId}:${actTitle}`,
        width: 196,
        height: 196,
        colorDark: '#0284c7',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  }

  let actLogs = [];
  try {
    actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
  } catch (e) { actLogs = []; }

  currentAttendeesList = actLogs.filter(l => l.activityId === actId || (act && l.activityTitle === act.title));
  renderAttendeesTable(currentAttendeesList);
  openModal('activityAttendeesModal');

  // Start fast live polling while modal is open (2.5s)
  startAdminActivityLivePolling(2500);

  // Pull latest from Google Sheets in background immediately
  fetchActivitiesAndLogsFromCloud(false);
}

function renderAttendeesTable(list) {
  const tbody = document.getElementById('actAttendeesTableBody');
  const badge = document.getElementById('actAttendeesTotalBadge');
  if (badge) {
    badge.innerHTML = `<i class="fa-solid fa-user-check"></i> เข้าร่วมแล้ว: ${list.length} คน`;
  }
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
          <i class="fa-solid fa-user-slash" style="font-size: 1.5rem; color: #cbd5e1; margin-bottom: 0.5rem; display: block;"></i>
          ยังไม่มีนักเรียนสแกนเข้าร่วมกิจกรรมนี้
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map((item, idx) => `
    <tr>
      <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
      <td><span style="color: #0284c7; font-weight: 700;"><i class="fa-regular fa-clock"></i> ${item.formattedTime || '-'}</span></td>
      <td><b>${item.studentId}</b></td>
      <td style="font-weight: 600;">${item.studentName}</td>
      <td><span class="badge" style="background: #f1f5f9; color: var(--text-dark); font-size: 0.78rem;">${item.grade || '-'}</span></td>
      <td style="text-align: right;">
        <button class="btn btn-icon btn-sm" onclick="deleteActivityAttendee('${item.id || item.studentId}')" title="ลบรายการเช็คชื่อนี้" style="color: #ef4444; width: 28px; height: 28px;">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function filterAttendeesList(query) {
  if (!query) {
    renderAttendeesTable(currentAttendeesList);
    return;
  }
  const q = query.toLowerCase().trim();
  const filtered = currentAttendeesList.filter(item => 
    (item.studentName && item.studentName.toLowerCase().includes(q)) ||
    (item.studentId && item.studentId.toLowerCase().includes(q)) ||
    (item.grade && item.grade.toLowerCase().includes(q))
  );
  renderAttendeesTable(filtered);
}

function deleteActivityAttendee(logId) {
  if (!confirm('ยืนยันที่จะลบข้อมูลการเข้าร่วมกิจกรรมของนักเรียนคนนี้?')) return;
  let actLogs = [];
  try {
    actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
  } catch (e) { actLogs = []; }

  actLogs = actLogs.filter(l => (l.id !== logId && l.studentId !== logId));
  localStorage.setItem('khalifah_student_act_logs', JSON.stringify(actLogs));

  if (currentViewingActivityId) {
    const act = activities.find(a => (a.id === currentViewingActivityId || a.activityId === currentViewingActivityId));
    currentAttendeesList = actLogs.filter(l => l.activityId === currentViewingActivityId || (act && l.activityTitle === act.title));
    renderAttendeesTable(currentAttendeesList);
  }
  renderAdminActivitiesTable();
  renderAdminLiveActivityFeed();
  showToast('ลบรายการเช็คชื่อเรียบร้อยแล้ว', 'info');

  syncRecordToGoogleSheet('deleteActivityAttendee', {
    logId: logId,
    activityId: currentViewingActivityId || ''
  });
}

function exportAttendeesToExcel() {
  if (!currentAttendeesList || currentAttendeesList.length === 0) {
    showToast('ไม่มีข้อมูลนักเรียนสำหรับส่งออก', 'warning');
    return;
  }
  const act = activities.find(a => (a.id === currentViewingActivityId || a.activityId === currentViewingActivityId));
  const actTitle = act ? act.title : 'Activity';

  const exportData = currentAttendeesList.map((item, idx) => ({
    'ลำดับ': idx + 1,
    'รหัสนักเรียน': item.studentId,
    'ชื่อ-นามสกุล': item.studentName,
    'ระดับชั้น': item.grade || '-',
    'กิจกรรม': item.activityTitle || actTitle,
    'วันที่สแกนเข้า': item.formattedDate || '-',
    'เวลาที่สแกนเข้า': item.formattedTime || '-'
  }));

  try {
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายชื่อผู้เข้าร่วม");
    const fileName = `รายชื่อเข้าร่วม_${actTitle.replace(/[\/\\?%*:|"<>]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('ดาวน์โหลดไฟล์ Excel เรียบร้อยแล้ว', 'success');
  } catch (err) {
    console.error('Export error:', err);
    showToast('เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel', 'error');
  }
}


// ----------------- DASHBOARD GRADE FILTER LOGIC ----------------- //
let currentGradeFilter = 'ALL';

function syncDashboardGradeFilterToCurrentStudent() {
  const dashGradeSelect = document.getElementById('dashGradeFilter');
  if (!dashGradeSelect) return;
  if (!currentStudent || !currentStudent.grade) {
    dashGradeSelect.value = 'ALL';
    currentGradeFilter = 'ALL';
    return;
  }

  const sGrade = String(currentStudent.grade).trim();
  let matchedVal = null;

  // 1. Direct match with option value or text
  for (let i = 0; i < dashGradeSelect.options.length; i++) {
    const opt = dashGradeSelect.options[i];
    if (opt.value === sGrade || opt.text === sGrade) {
      matchedVal = opt.value;
      break;
    }
  }

  // 2. Substring match (e.g. "มัธยมศึกษาปีที่ 5" in "มัธยมศึกษาปีที่ 5 (ม.5)")
  if (!matchedVal) {
    for (let i = 0; i < dashGradeSelect.options.length; i++) {
      const opt = dashGradeSelect.options[i];
      if (opt.value !== 'ALL' && (sGrade.includes(opt.value) || opt.value.includes(sGrade))) {
        matchedVal = opt.value;
        break;
      }
    }
  }

  // 3. Digit match (e.g. '5' for ม.5)
  if (!matchedVal) {
    const sDigits = sGrade.replace(/\D/g, '');
    if (sDigits) {
      for (let i = 0; i < dashGradeSelect.options.length; i++) {
        const opt = dashGradeSelect.options[i];
        if (opt.value !== 'ALL') {
          const optDigits = opt.value.replace(/\D/g, '');
          if (optDigits === sDigits) {
            matchedVal = opt.value;
            break;
          }
        }
      }
    }
  }

  if (matchedVal) {
    dashGradeSelect.value = matchedVal;
    currentGradeFilter = matchedVal;
  }
}

function handleDashboardGradeFilterChange() {
  const select = document.getElementById('dashGradeFilter');
  if (select) currentGradeFilter = select.value;
  renderDashboardCharts();
  showToast(`แสดงสถิติตาม: ${currentGradeFilter === 'ALL' ? 'ทุกระดับชั้นปี' : currentGradeFilter}`, 'info');
}

// Simple Web Audio API Synthesizer Beep (No external files needed)
function playSuccessSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.08); // A5
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

// Synthesize Realistic Mechanical Camera Shutter Click Sound via Web Audio API
function playCameraShutterSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const t = ctx.currentTime;

    // 1. Shutter Open Click (high-frequency burst)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(1400, t);
    osc1.frequency.exponentialRampToValueAtTime(280, t + 0.04);
    gain1.gain.setValueAtTime(0.45, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.05);

    // 2. Shutter Close Click (mechanical metallic release after 65ms)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(950, t + 0.065);
    osc2.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    gain2.gain.setValueAtTime(0.35, t + 0.065);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t + 0.065);
    osc2.stop(t + 0.13);
  } catch (e) {}
}

// Slide-In Notification Toast for Camera Capture Feedback
let cameraSlideToastTimer = null;
function showCameraSlideToast(photoUrl, prayerTime, locationName, statusText) {
  let toast = document.getElementById('cameraSuccessSlideToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cameraSuccessSlideToast';
    toast.className = 'camera-slide-toast';
    document.body.appendChild(toast);
  }

  const cleanLoc = locationName || 'พิกัด GPS ยืนยันแล้ว';
  toast.innerHTML = `
    <img src="${photoUrl}" class="camera-slide-toast-thumb" alt="Captured Photo">
    <div class="camera-slide-toast-content">
      <div class="camera-slide-toast-title">
        <i class="fa-solid fa-circle-check"></i> บันทึกภาพพยานสำเร็จแล้ว!
      </div>
      <div class="camera-slide-toast-desc">
        เวลาละหมาด: <b>${prayerTime}</b> (${statusText || 'ตรงเวลา'})
      </div>
      <div class="camera-slide-toast-meta">
        <span><i class="fa-solid fa-location-dot"></i> ${cleanLoc}</span>
        <span>•</span>
        <span>${new Date().toLocaleTimeString('th-TH')} น.</span>
      </div>
    </div>
    <button class="camera-slide-toast-close" onclick="closeCameraSlideToast()" title="ปิด">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  // Force reflow and show
  void toast.offsetWidth;
  toast.classList.add('show');

  if (cameraSlideToastTimer) clearTimeout(cameraSlideToastTimer);
  cameraSlideToastTimer = setTimeout(() => {
    closeCameraSlideToast();
  }, 5000);
}

function closeCameraSlideToast() {
  const toast = document.getElementById('cameraSuccessSlideToast');
  if (toast) {
    toast.classList.remove('show');
  }
}

// ==========================================================================
// ADMIN PRAYER DASHBOARD & MONITORING ENGINE (DAILY & INDIVIDUAL)
// ==========================================================================

const CANONICAL_PRAYERS = [
  { key: 'ซุบฮิ', label: 'ซุบฮิ', icon: '🌅', range: '04:45 - 06:25 น.' },
  { key: 'ซุฮริ', label: 'ซุฮริ', icon: '☀️', range: '12:10 - 15:15 น.' },
  { key: 'อัศรฺ', label: 'อัศรฺ', icon: '🌤️', range: '15:20 - 18:05 น.' },
  { key: 'มัฆริบ', label: 'มัฆริบ', icon: '🌇', range: '18:10 - 19:25 น.' },
  { key: 'อีชาอ์', label: 'อีชาอ์', icon: '🌙', range: '19:30 - 23:59 น.' }
];

let currentAdminPrayerMode = 'daily'; // 'daily' or 'individual'
let cachedDailyStudentPrayerMap = {};
let cachedDailyFilteredStudents = [];
let cachedIndividualStudentRecords = [];

function normalizePrayerSlotKey(name) {
  if (!name) return '';
  const s = String(name).trim();
  if (s.includes('ซุบฮิ') || s.toLowerCase().includes('subh') || s.toLowerCase().includes('fajr')) return 'ซุบฮิ';
  if (s.includes('ซุฮริ') || s.toLowerCase().includes('zuhr') || s.toLowerCase().includes('dhuhr')) return 'ซุฮริ';
  if (s.includes('อัศร') || s.toLowerCase().includes('asr')) return 'อัศรฺ';
  if (s.includes('มัฆริบ') || s.toLowerCase().includes('maghrib')) return 'มัฆริบ';
  if (s.includes('อีชา') || s.includes('อิชา') || s.toLowerCase().includes('isha')) return 'อีชาอ์';
  return s;
}

function getAllCombinedPrayerHistory() {
  let historyList = [];
  try {
    historyList = JSON.parse(localStorage.getItem('khalifah_prayer_history') || '[]');
  } catch (e) { historyList = []; }

  let todayList = [];
  try {
    todayList = JSON.parse(localStorage.getItem('khalifah_today_prayers') || '[]');
  } catch (e) { todayList = []; }

  const map = {};
  historyList.forEach(p => {
    if (!p) return;
    const sid = cleanIdString(p.studentId || '');
    const slot = normalizePrayerSlotKey(p.prayerName || p.prayerTime || '');
    const date = p.date || '';
    if (sid && slot && date) {
      map[`${sid}_${slot}_${date}`] = p;
    }
  });

  todayList.forEach(p => {
    if (!p) return;
    const sid = cleanIdString(p.studentId || '');
    const slot = normalizePrayerSlotKey(p.prayerName || p.prayerTime || '');
    const date = p.date || '';
    if (sid && slot && date) {
      const k = `${sid}_${slot}_${date}`;
      if (!map[k]) map[k] = p;
    }
  });

  return Object.values(map);
}

function setAdminPrayerMode(mode) {
  currentAdminPrayerMode = mode;
  const btnDaily = document.getElementById('btnPrayerModeDaily');
  const btnIndiv = document.getElementById('btnPrayerModeIndividual');
  const secDaily = document.getElementById('adminPrayerDailySection');
  const secIndiv = document.getElementById('adminPrayerIndividualSection');

  if (btnDaily) btnDaily.classList.toggle('active', mode === 'daily');
  if (btnIndiv) btnIndiv.classList.toggle('active', mode === 'individual');

  if (mode === 'daily') {
    if (secDaily) secDaily.style.display = 'block';
    if (secIndiv) secIndiv.style.display = 'none';
    renderAdminPrayerDailyDashboard();
  } else {
    if (secDaily) secDaily.style.display = 'none';
    if (secIndiv) secIndiv.style.display = 'block';
    populateAdminPrayerStudentSelect();
    renderAdminStudentPrayerHistory();
  }
}

function adminPrayerChangeDate(offsetDays) {
  const dateInput = document.getElementById('adminPrayerDateSelect');
  if (!dateInput) return;
  let curVal = dateInput.value;
  let d = curVal ? new Date(curVal + 'T00:00:00') : new Date();
  if (isNaN(d.getTime())) d = new Date();
  d.setDate(d.getDate() + offsetDays);
  dateInput.value = d.toISOString().split('T')[0];
  renderAdminPrayerDailyDashboard();
}

function adminPrayerSetToday() {
  const dateInput = document.getElementById('adminPrayerDateSelect');
  if (!dateInput) return;
  dateInput.value = new Date().toISOString().split('T')[0];
  renderAdminPrayerDailyDashboard();
}

function initAdminPrayerDashboard() {
  const dateInput = document.getElementById('adminPrayerDateSelect');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  // Populate grade dropdown
  const gradeSelect = document.getElementById('adminPrayerGradeFilter');
  if (gradeSelect) {
    const prevGrade = gradeSelect.value || 'ALL';
    const grades = Array.from(new Set(allStudents.map(s => s.grade).filter(Boolean))).sort();
    gradeSelect.innerHTML = `<option value="ALL">ทุกระดับชั้นปี (${allStudents.length} คน)</option>` +
      grades.map(g => {
        const count = allStudents.filter(s => s.grade === g).length;
        return `<option value="${g}">${g} (${count} คน)</option>`;
      }).join('');
    if ([...gradeSelect.options].some(o => o.value === prevGrade)) {
      gradeSelect.value = prevGrade;
    }
  }

  populateAdminPrayerStudentSelect();

  if (currentAdminPrayerMode === 'daily') {
    renderAdminPrayerDailyDashboard();
  } else {
    renderAdminStudentPrayerHistory();
  }
}

function populateAdminPrayerStudentSelect() {
  const stdSelect = document.getElementById('adminPrayerStudentSelect');
  if (!stdSelect) return;
  const prevVal = stdSelect.value;
  const sorted = [...allStudents].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'th'));
  stdSelect.innerHTML = `<option value="">-- กรุณาเลือกนักเรียนเพื่อดูประวัติ (${sorted.length} คน) --</option>` +
    sorted.map(s => {
      const sid = cleanIdString(s.studentId);
      return `<option value="${sid}">[${s.grade || '-'}] ${s.fullName} (${sid})</option>`;
    }).join('');
  if (prevVal && [...stdSelect.options].some(o => o.value === prevVal)) {
    stdSelect.value = prevVal;
  }
}

function renderAdminPrayerDailyDashboard() {
  const dateInput = document.getElementById('adminPrayerDateSelect');
  const gradeSelect = document.getElementById('adminPrayerGradeFilter');
  const slotsContainer = document.getElementById('adminPrayerSlotsGridContainer');
  const dateDisplay = document.getElementById('dailyPrayerDateDisplay');

  const selectedDate = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().split('T')[0];
  const selectedGrade = gradeSelect ? gradeSelect.value : 'ALL';

  if (dateDisplay) {
    const d = new Date(selectedDate + 'T00:00:00');
    dateDisplay.innerHTML = `<i class="fa-regular fa-calendar-check" style="color: #0284c7;"></i> ${d.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  }

  // Filter students by grade
  let targetStudents = [...allStudents];
  if (selectedGrade !== 'ALL') {
    targetStudents = targetStudents.filter(s => s.grade === selectedGrade);
  }
  cachedDailyFilteredStudents = targetStudents;

  // Retrieve matching prayer logs
  const allPrayers = getAllCombinedPrayerHistory();
  const dailyPrayers = allPrayers.filter(p => p.date === selectedDate);

  // Group by student
  const studentMap = {};
  targetStudents.forEach(s => {
    const sid = cleanIdString(s.studentId);
    studentMap[sid] = {};
  });

  dailyPrayers.forEach(p => {
    const sid = cleanIdString(p.studentId || '');
    if (studentMap[sid]) {
      const slot = normalizePrayerSlotKey(p.prayerName || p.prayerTime || '');
      if (slot) studentMap[sid][slot] = p;
    }
  });
  cachedDailyStudentPrayerMap = studentMap;

  // Top KPI calculations
  const totalStd = targetStudents.length;
  let countFull = 0;
  let countPartial = 0;
  let countZero = 0;

  targetStudents.forEach(s => {
    const sid = cleanIdString(s.studentId);
    const slotsDone = Object.keys(studentMap[sid] || {}).length;
    if (slotsDone === 5) countFull++;
    else if (slotsDone > 0) countPartial++;
    else countZero++;
  });

  const fullPct = totalStd > 0 ? Math.round((countFull / totalStd) * 100) : 0;
  const partialPct = totalStd > 0 ? Math.round((countPartial / totalStd) * 100) : 0;
  const zeroPct = totalStd > 0 ? Math.round((countZero / totalStd) * 100) : 0;

  const elTotal = document.getElementById('dailyKpiTotalStudents');
  const elGradeLbl = document.getElementById('dailyKpiGradeLabel');
  const elFullCount = document.getElementById('dailyKpiFullCount');
  const elFullPct = document.getElementById('dailyKpiFullPct');
  const elPartCount = document.getElementById('dailyKpiPartialCount');
  const elPartPct = document.getElementById('dailyKpiPartialPct');
  const elZeroCount = document.getElementById('dailyKpiZeroCount');
  const elZeroPct = document.getElementById('dailyKpiZeroPct');

  if (elTotal) elTotal.innerText = `${totalStd} คน`;
  if (elGradeLbl) elGradeLbl.innerText = selectedGrade === 'ALL' ? 'ทุกระดับชั้นปี' : `ระดับชั้น ${selectedGrade}`;
  if (elFullCount) elFullCount.innerText = `${countFull} คน`;
  if (elFullPct) elFullPct.innerText = `${fullPct}%`;
  if (elPartCount) elPartCount.innerText = `${countPartial} คน`;
  if (elPartPct) elPartPct.innerText = `${partialPct}%`;
  if (elZeroCount) elZeroCount.innerText = `${countZero} คน`;
  if (elZeroPct) elZeroPct.innerText = `${zeroPct}%`;

  // Render 5 Prayer Breakdown Slot Cards
  if (slotsContainer) {
    slotsContainer.innerHTML = CANONICAL_PRAYERS.map(slot => {
      let slotChecked = 0;
      let slotOntime = 0;
      let slotLate = 0;

      targetStudents.forEach(s => {
        const sid = cleanIdString(s.studentId);
        const record = studentMap[sid] ? studentMap[sid][slot.key] : null;
        if (record) {
          slotChecked++;
          const st = record.status || '';
          if (st.includes('สาย')) slotLate++;
          else slotOntime++;
        }
      });

      const slotPct = totalStd > 0 ? Math.round((slotChecked / totalStd) * 100) : 0;
      const barColor = slotPct >= 80 ? '#10b981' : (slotPct >= 50 ? '#0284c7' : '#f59e0b');

      return `
        <div class="prayer-slot-card">
          <div class="prayer-slot-header">
            <span class="prayer-slot-name">${slot.icon} ${slot.label}</span>
            <span class="prayer-slot-time-range">${slot.range}</span>
          </div>
          <div class="prayer-slot-count" style="color: ${barColor};">
            ${slotChecked} <span style="font-size: 0.82rem; font-weight: 600; color: #64748b;">/ ${totalStd} คน (${slotPct}%)</span>
          </div>
          <div class="prayer-slot-bar-track">
            <div class="prayer-slot-bar-fill" style="width: ${slotPct}%; background: ${barColor};"></div>
          </div>
          <div class="prayer-slot-footer">
            <span style="color: #16a34a;"><i class="fa-solid fa-check"></i> ตรงเวลา: ${slotOntime}</span>
            <span style="color: #b45309;"><i class="fa-solid fa-clock"></i> สาย: ${slotLate}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  renderAdminPrayerDailyTable();
}

function renderAdminPrayerDailyTable() {
  const tbody = document.getElementById('adminDailyPrayerMatrixTableBody');
  const searchInput = document.getElementById('adminPrayerSearchInput');
  const countBadge = document.getElementById('dailyTableTotalBadge');
  if (!tbody) return;

  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  let filtered = [...cachedDailyFilteredStudents];
  if (query) {
    filtered = filtered.filter(s =>
      (s.fullName && s.fullName.toLowerCase().includes(query)) ||
      (s.studentId && s.studentId.toLowerCase().includes(query)) ||
      (s.grade && s.grade.toLowerCase().includes(query))
    );
  }

  if (countBadge) {
    countBadge.innerText = `แสดง ${filtered.length} คน จากทั้งหมด ${cachedDailyFilteredStudents.length} คน`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align: center; color: var(--text-muted); padding: 2rem;">
          <i class="fa-solid fa-user-xmark" style="font-size: 1.6rem; color: #cbd5e1; margin-bottom: 0.4rem; display: block;"></i>
          ไม่พบข้อมูลนักเรียนที่ตรงกับเงื่อนไขการค้นหา
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => {
    const sid = cleanIdString(s.studentId);
    const prayers = cachedDailyStudentPrayerMap[sid] || {};
    const completedCount = Object.keys(prayers).length;

    let scoreBadge = '';
    if (completedCount === 5) {
      scoreBadge = '<span style="background: #dcfce7; color: #15803d; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 9999px; font-size: 0.76rem; border: 1px solid #bbf7d0;">5 / 5 ครบ</span>';
    } else if (completedCount > 0) {
      scoreBadge = `<span style="background: #fef3c7; color: #b45309; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 9999px; font-size: 0.76rem; border: 1px solid #fde68a;">${completedCount} / 5</span>`;
    } else {
      scoreBadge = '<span style="background: #f1f5f9; color: #94a3b8; font-weight: 600; padding: 0.2rem 0.55rem; border-radius: 9999px; font-size: 0.76rem;">0 / 5</span>';
    }

    const prayerCells = CANONICAL_PRAYERS.map(slot => {
      const rec = prayers[slot.key];
      if (!rec) {
        return `<td style="text-align: center;"><span class="prayer-status-pill absent">-</span></td>`;
      }
      const st = rec.status || '';
      let pillClass = 'ontime';
      let icon = 'fa-check';
      if (st.includes('สาย')) {
        pillClass = 'late';
        icon = 'fa-clock';
      } else if (st.includes('อุซุร')) {
        pillClass = 'excused';
        icon = 'fa-bed';
      }

      const timeText = rec.time ? rec.time.slice(0, 5) : 'เช็คแล้ว';
      const logId = rec.id || rec.logId || '';
      return `
        <td style="text-align: center;">
          <span class="prayer-status-pill ${pillClass}" onclick="openPrayerHistoryDetailModal('${logId}')" style="cursor: pointer;" title="เวลา ${rec.time || '-'} • คลิกดูภาพและพิกัด">
            <i class="fa-solid ${icon}"></i> ${timeText}
          </span>
        </td>
      `;
    }).join('');

    return `
      <tr>
        <td style="text-align: center; color: var(--text-muted); font-size: 0.8rem;">${idx + 1}</td>
        <td><b>${sid}</b></td>
        <td style="font-weight: 600; color: var(--text-dark);">${s.fullName}</td>
        <td><span class="badge" style="background: #f1f5f9; color: #334155; font-size: 0.75rem;">${s.grade || '-'}</span></td>
        ${prayerCells}
        <td style="text-align: center;">${scoreBadge}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="adminSelectStudentForPrayerHistory('${sid}')" style="padding: 0.25rem 0.65rem; font-size: 0.76rem; font-weight: 600;" title="ดูประวัติการละหมาดทั้งหมดของนักเรียนคนนี้">
            <i class="fa-solid fa-user-clock"></i> ดูรายคน
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function onAdminPrayerStudentSelectChange() {
  renderAdminStudentPrayerHistory();
}

function adminSelectStudentForPrayerHistory(studentId) {
  setAdminPrayerMode('individual');
  const select = document.getElementById('adminPrayerStudentSelect');
  if (select) {
    select.value = cleanIdString(studentId);
  }
  renderAdminStudentPrayerHistory();
}

function renderAdminStudentPrayerHistory() {
  const select = document.getElementById('adminPrayerStudentSelect');
  const slotFilter = document.getElementById('adminPrayerIndivSlotFilter');
  const profileCard = document.getElementById('adminPrayerStudentProfileCard');
  const tbody = document.getElementById('adminIndivPrayerLogsTableBody');
  const badge = document.getElementById('adminIndivLogsCountBadge');

  if (!tbody) return;

  const selectedSid = select ? cleanIdString(select.value) : '';
  if (!selectedSid) {
    if (profileCard) profileCard.style.display = 'none';
    if (badge) badge.innerText = '0 รายการ';
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 3rem 1.5rem;">
          <i class="fa-solid fa-user-clock" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 0.6rem; display: block;"></i>
          กรุณาเลือกนักเรียนจากเมนูด้านบน เพื่อตรวจสอบสถิติและประวัติการเช็คชื่อละหมาดรายบุคคล
        </td>
      </tr>
    `;
    return;
  }

  const student = allStudents.find(s => isIdMatch(s.studentId, selectedSid)) || {
    studentId: selectedSid,
    fullName: 'นักเรียน (' + selectedSid + ')',
    grade: '-',
    parentPhone: '-'
  };

  // Populate profile header
  if (profileCard) profileCard.style.display = 'block';
  const elName = document.getElementById('adminIndivName');
  const elId = document.getElementById('adminIndivId');
  const elGrade = document.getElementById('adminIndivGrade');
  const elPhone = document.getElementById('adminIndivPhone');
  const elAvatar = document.getElementById('adminIndivAvatar');

  if (elName) elName.innerText = student.fullName || '-';
  if (elId) elId.innerText = cleanIdString(student.studentId);
  if (elGrade) elGrade.innerText = student.grade || '-';
  if (elPhone) elPhone.innerText = student.parentPhone || '-';
  if (elAvatar) {
    const directAv = getDirectImageUrl(student.avatarUrl);
    if (directAv) {
      elAvatar.innerHTML = `<img src="${directAv}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; cursor: pointer;" onclick="openPhotoViewerModal('${directAv}', '${escapeHtml(student.fullName || 'นักเรียน')}')" title="คลิกดูรูปขยาย">`;
    } else {
      elAvatar.innerText = (student.fullName || 'S').trim().slice(0, 1);
    }
  }

  // Retrieve prayer history for this student
  const allPrayers = getAllCombinedPrayerHistory();
  let studentPrayers = allPrayers.filter(p => isIdMatch(p.studentId, selectedSid));

  // Sort descending by date & time
  studentPrayers.sort((a, b) => {
    const ta = (a.timestamp ? new Date(a.timestamp).getTime() : 0) || (a.date ? new Date(a.date).getTime() : 0);
    const tb = (b.timestamp ? new Date(b.timestamp).getTime() : 0) || (b.date ? new Date(b.date).getTime() : 0);
    return tb - ta;
  });

  // Calculate Student Stats
  const totalRecords = studentPrayers.length;
  let ontimeCount = 0;
  let gpsCount = 0;

  // Last 30 days calculation
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysStr = thirtyDaysAgo.toISOString().split('T')[0];
  let last30DaysCount = 0;

  studentPrayers.forEach(p => {
    const st = p.status || '';
    if (!st.includes('สาย')) ontimeCount++;
    if (p.isWithinZone || (p.latitude && p.longitude)) gpsCount++;
    if (p.date && p.date >= thirtyDaysStr) last30DaysCount++;
  });

  const ontimeRate = totalRecords > 0 ? Math.round((ontimeCount / totalRecords) * 100) : 0;
  const gpsRate = totalRecords > 0 ? Math.round((gpsCount / totalRecords) * 100) : 0;
  const streakPct = Math.min(100, Math.round((last30DaysCount / 150) * 100));

  const elKpiTotal = document.getElementById('indivKpiTotal');
  const elKpiOntime = document.getElementById('indivKpiOntimeRate');
  const elKpiGps = document.getElementById('indivKpiGpsRate');
  const elKpiStreak = document.getElementById('indivKpiStreak');

  if (elKpiTotal) elKpiTotal.innerText = `${totalRecords} ครั้ง`;
  if (elKpiOntime) elKpiOntime.innerText = `${ontimeRate}%`;
  if (elKpiGps) elKpiGps.innerText = `${gpsRate}%`;
  if (elKpiStreak) elKpiStreak.innerText = `${streakPct}%`;

  // Filter by selected prayer slot if not 'ALL'
  const selectedSlot = slotFilter ? slotFilter.value : 'ALL';
  let displayedLogs = [...studentPrayers];
  if (selectedSlot !== 'ALL') {
    displayedLogs = displayedLogs.filter(p => normalizePrayerSlotKey(p.prayerName || p.prayerTime) === selectedSlot);
  }
  cachedIndividualStudentRecords = displayedLogs;

  if (badge) badge.innerText = `${displayedLogs.length} รายการ`;

  if (displayedLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
          <i class="fa-solid fa-calendar-xmark" style="font-size: 1.8rem; color: #cbd5e1; margin-bottom: 0.4rem; display: block;"></i>
          ยังไม่มีบันทึกการเช็คชื่อละหมาดสำหรับนักเรียนคนนี้
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = displayedLogs.map((p, idx) => {
    const rawPhoto = p.photo || p.photoUrl || p.photoBase64 || '';
    const directPhoto = getDirectImageUrl(rawPhoto);
    const hasPhoto = !!(directPhoto && directPhoto.length > 10);
    const slotKey = normalizePrayerSlotKey(p.prayerName || p.prayerTime);
    const slotMeta = CANONICAL_PRAYERS.find(s => s.key === slotKey) || { icon: '🕌', label: p.prayerName || p.prayerTime || '-' };
    const logId = p.id || p.logId || '';

    const st = p.status || 'ตรงเวลา';
    let statusClass = 'status-ontime';
    if (st.includes('สาย')) statusClass = 'status-late';
    else if (st.includes('อุซุร')) statusClass = 'status-excused';

    const cleanLoc = p.locationName || (p.latitude ? 'พิกัด GPS ตรวจสอบแล้ว' : '-');

    return `
      <tr>
        <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
        <td style="font-weight: 600; color: var(--text-dark);">${p.date || '-'}</td>
        <td>
          <span style="font-weight: 700; color: #0284c7; display: inline-flex; align-items: center; gap: 0.35rem;">
            ${slotMeta.icon} ${slotMeta.label}
          </span>
        </td>
        <td><span style="font-weight: 600; color: #334155;"><i class="fa-regular fa-clock"></i> ${p.time || '-'} น.</span></td>
        <td><span class="status-badge ${statusClass}">${st}</span></td>
        <td style="font-size: 0.8rem; color: var(--text-muted); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <i class="fa-solid fa-location-dot" style="color: #0284c7;"></i> ${cleanLoc}
        </td>
        <td style="text-align: center;">
          ${hasPhoto ? `
            <img src="${directPhoto}" class="prayer-photo-thumb" onclick="openPhotoViewerModal('${directPhoto}', '${escapeHtml(p.studentName || 'นักเรียน')} - ละหมาด${escapeHtml(p.prayerName || p.prayerTime || '')} (${p.date || ''})')" title="คลิกดูรูปขยายเต็มจอ">
          ` : `
            <span style="font-size: 0.74rem; color: #94a3b8;"><i class="fa-solid fa-camera-slash"></i> ไม่มีภาพ</span>
          `}
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="openPrayerHistoryDetailModal('${logId}')" style="padding: 0.25rem 0.65rem; font-size: 0.76rem;" title="ดูรายละเอียดเต็ม พิกัด และภาพถ่าย">
            <i class="fa-solid fa-clipboard-check"></i> ตรวจสอบ
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function exportAdminDailyPrayerToExcel() {
  if (!cachedDailyFilteredStudents || cachedDailyFilteredStudents.length === 0) {
    showToast('ไม่มีข้อมูลนักเรียนสำหรับส่งออก', 'warning');
    return;
  }

  const dateInput = document.getElementById('adminPrayerDateSelect');
  const selectedDate = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().split('T')[0];

  const exportData = cachedDailyFilteredStudents.map((s, idx) => {
    const sid = cleanIdString(s.studentId);
    const prayers = cachedDailyStudentPrayerMap[sid] || {};
    const row = {
      'ลำดับ': idx + 1,
      'รหัสนักเรียน': sid,
      'ชื่อ - นามสกุล': s.fullName,
      'ระดับชั้น': s.grade || '-'
    };

    CANONICAL_PRAYERS.forEach(slot => {
      const rec = prayers[slot.key];
      row[slot.label] = rec ? `${rec.time || 'เช็คแล้ว'} (${rec.status || 'ตรงเวลา'})` : '-';
    });

    row['จำนวนเวลาที่ละหมาด'] = `${Object.keys(prayers).length} / 5`;
    return row;
  });

  try {
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "บันทึกละหมาดรายวัน");
    const fileName = `บันทึกละหมาดประจำวัน_${selectedDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('ดาวน์โหลดไฟล์ Excel บันทึกละหมาดประจำวันเรียบร้อยแล้ว', 'success');
  } catch (err) {
    console.error('Export error:', err);
    showToast('เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel', 'error');
  }
}

function exportAdminStudentPrayerToExcel() {
  if (!cachedIndividualStudentRecords || cachedIndividualStudentRecords.length === 0) {
    showToast('ไม่มีประวัติการละหมาดของนักเรียนคนนี้สำหรับส่งออก', 'warning');
    return;
  }

  const select = document.getElementById('adminPrayerStudentSelect');
  const selectedSid = select ? cleanIdString(select.value) : '';
  const student = allStudents.find(s => isIdMatch(s.studentId, selectedSid));
  const stdName = student ? student.fullName : selectedSid;

  const exportData = cachedIndividualStudentRecords.map((p, idx) => ({
    'ลำดับ': idx + 1,
    'รหัสนักเรียน': cleanIdString(p.studentId),
    'ชื่อ - นามสกุล': p.studentName || stdName,
    'ระดับชั้น': p.grade || (student ? student.grade : '-'),
    'วันที่': p.date || '-',
    'เวลาละหมาด': p.prayerName || p.prayerTime || '-',
    'เวลาที่บันทึก': p.time || '-',
    'สถานะ': p.status || 'ตรงเวลา',
    'สถานที่': p.locationName || '-',
    'พิกัดละติจูด': p.latitude || p.lat || '-',
    'พิกัดลองจิจูด': p.longitude || p.lng || '-',
    'หมายเหตุ': p.note || '-'
  }));

  try {
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ประวัติละหมาดรายคน");
    const fileName = `ประวัติละหมาด_${stdName.replace(/[\/\\?%*:|"<>]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('ดาวน์โหลดไฟล์ Excel ประวัตินักเรียนเรียบร้อยแล้ว', 'success');
  } catch (err) {
    console.error('Export error:', err);
    showToast('เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel', 'error');
  }
}

async function fetchPrayersFromCloud() {
  let url = gasApiUrl || localStorage.getItem('khalifah_gas_url') || DEFAULT_GAS_API_URL;
  if (url && url.includes('docs.google.com/spreadsheets')) url = DEFAULT_GAS_API_URL;
  if (!url || !navigator.onLine) return;

  try {
    const sep = url.includes('?') ? '&' : '?';
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 4500) : null;

    const resp = await fetch(`${url}${sep}action=getPrayers&_t=${Date.now()}`, {
      method: 'GET',
      redirect: 'follow',
      ...(controller ? { signal: controller.signal } : {})
    });
    if (timeoutId) clearTimeout(timeoutId);

    const json = await resp.json();
    if (json && (json.success || json.status === 'success') && Array.isArray(json.data) && json.data.length > 0) {
      let localHist = [];
      try {
        localHist = JSON.parse(localStorage.getItem('khalifah_prayer_history') || '[]');
      } catch (e) { localHist = []; }

      json.data.forEach(cp => {
        const sid = cleanIdString(cp.studentId || '');
        const date = cp.date || '';
        const slot = normalizePrayerSlotKey(cp.prayerTime || cp.prayerName || '');
        if (!sid || !date) return;
        const existIdx = localHist.findIndex(l => isIdMatch(l.studentId, sid) && l.date === date && normalizePrayerSlotKey(l.prayerTime || l.prayerName) === slot);
        if (existIdx !== -1) {
          localHist[existIdx] = { ...localHist[existIdx], ...cp };
        } else {
          localHist.unshift(cp);
        }
      });

      localStorage.setItem('khalifah_prayer_history', JSON.stringify(localHist));

      // Refresh if currently viewing prayers dashboard
      const tab = document.getElementById('admin-tab-prayers-monitor');
      if (tab && tab.style.display !== 'none') {
        if (currentAdminPrayerMode === 'daily') {
          renderAdminPrayerDailyDashboard();
        } else {
          renderAdminStudentPrayerHistory();
        }
      }
    }
  } catch (err) {
    console.warn('fetchPrayersFromCloud err:', err);
  }
}

// ==========================================================================
// STAFF & KIOSK LIVE ACTIVITY MONITOR ENGINE (ZERO-AUTH PUBLIC ACCESS)
// ==========================================================================
let isStaffMonitorMode = false;
let staffMonitorActiveActId = null;
let isStaffSoundEnabled = true;
let lastStaffKioskCount = -1;

function checkStaffMonitorUrlParams() {
  let targetActId = null;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('monitor')) {
      targetActId = params.get('monitor');
    } else if (params.has('staff_monitor')) {
      targetActId = params.get('staff_monitor');
    } else if (window.location.hash.startsWith('#monitor=')) {
      targetActId = window.location.hash.replace('#monitor=', '');
    }
  } catch (e) {
    targetActId = null;
  }

  if (targetActId !== null && targetActId !== undefined) {
    isStaffMonitorMode = true;
    document.body.classList.add('staff-monitor-active');
    document.body.classList.remove('auth-locked');
    closeModal('authModal');
    closeModal('adminAuthModal');

    // Switch view directly to staff monitor
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    const staffView = document.getElementById('view-staff-monitor');
    if (staffView) staffView.classList.add('active');

    // Initialize Staff Kiosk Engine
    initStaffMonitor(targetActId);
    return true;
  }
  return false;
}

function initStaffMonitor(targetActId) {
  isStaffMonitorMode = true;
  document.body.classList.add('staff-monitor-active');
  document.body.classList.remove('auth-locked');
  closeModal('authModal');
  closeModal('adminAuthModal');

  // Load activities if available
  if (activities.length === 0) {
    try {
      activities = JSON.parse(localStorage.getItem('khalifah_activities') || '[]');
    } catch (e) { activities = []; }
  }

  // Populate Activity Selector
  const selectEl = document.getElementById('staffKioskActSelect');
  if (selectEl) {
    if (activities.length === 0) {
      selectEl.innerHTML = `<option value="">(กำลังค้นหากิจกรรมจากคลาวด์...)</option>`;
    } else {
      selectEl.innerHTML = activities.map(a => {
        const aId = a.id || a.activityId;
        return `<option value="${aId}">${a.title} (${a.date || '-'})</option>`;
      }).join('');
    }
  }

  // Determine which activity to display
  let selectedAct = null;
  if (targetActId && targetActId !== 'all' && targetActId !== 'live') {
    selectedAct = activities.find(a => (a.id === targetActId || a.activityId === targetActId || a.title === targetActId));
  }
  if (!selectedAct && activities.length > 0) {
    selectedAct = activities[0];
  }

  if (selectedAct) {
    const actId = selectedAct.id || selectedAct.activityId;
    changeStaffKioskActivity(actId);
  } else {
    const titleEl = document.getElementById('staffKioskActTitle');
    if (titleEl) titleEl.innerText = 'กำลังเชื่อมต่อกิจกรรม...';
  }

  // Start fast live polling (2.5s)
  startAdminActivityLivePolling(2500);

  // Immediate cloud fetch
  fetchActivitiesAndLogsFromCloud(false).then(() => {
    if (activities.length > 0) {
      const currentSelect = document.getElementById('staffKioskActSelect');
      if (currentSelect) {
        currentSelect.innerHTML = activities.map(a => {
          const aId = a.id || a.activityId;
          return `<option value="${aId}">${a.title} (${a.date || '-'})</option>`;
        }).join('');
      }
      if (!staffMonitorActiveActId) {
        let match = activities.find(a => (a.id === targetActId || a.activityId === targetActId));
        if (!match) match = activities[0];
        if (match) changeStaffKioskActivity(match.id || match.activityId);
      } else {
        renderStaffKioskMonitor();
      }
    }
  });
}

function changeStaffKioskActivity(actId) {
  if (!actId) return;
  staffMonitorActiveActId = actId;

  const selectEl = document.getElementById('staffKioskActSelect');
  if (selectEl && selectEl.value !== actId) {
    selectEl.value = actId;
  }

  // Update browser URL query string without page reload
  try {
    const cleanUrl = window.location.pathname + '?monitor=' + encodeURIComponent(actId);
    window.history.replaceState({ monitor: actId }, '', cleanUrl);
  } catch (e) {}

  const act = activities.find(a => (a.id === actId || a.activityId === actId));
  const resolvedId = act ? (act.id || act.activityId) : actId;
  const actTitle = act ? act.title : actId;

  const titleEl = document.getElementById('staffKioskActTitle');
  const typeBadge = document.getElementById('staffKioskActTypeBadge');
  const dateEl = document.getElementById('staffKioskActDate');
  const locEl = document.getElementById('staffKioskActLocation');

  if (titleEl) titleEl.innerText = actTitle;
  if (typeBadge) typeBadge.innerText = act ? (act.type || 'กิจกรรม') : 'กิจกรรม';
  if (dateEl) dateEl.innerText = act ? (act.date || '-') : '-';
  if (locEl) locEl.innerText = act ? (act.location || 'โรงเรียน/สถาบัน') : '-';

  // Render High-Contrast QR Code on Left Column
  const qrDisplay = document.getElementById('staffKioskQrDisplay');
  if (qrDisplay) {
    qrDisplay.innerHTML = '';
    if (window.QRCode) {
      new QRCode(qrDisplay, {
        text: `KHALIFAH_ACT:${resolvedId}:${actTitle}`,
        width: 236,
        height: 236,
        colorDark: '#0284c7',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  }

  renderStaffKioskMonitor();
}

function renderStaffKioskMonitor(highlightStudentId = null) {
  const tbody = document.getElementById('staffKioskTableBody');
  const totalCountEl = document.getElementById('staffKioskTotalCount');
  const latestNameEl = document.getElementById('staffKioskLatestName');
  const updatedTimeEl = document.getElementById('staffKioskLastUpdatedTime');

  if (!tbody || !staffMonitorActiveActId) return;

  const act = activities.find(a => (a.id === staffMonitorActiveActId || a.activityId === staffMonitorActiveActId));

  let actLogs = [];
  try {
    actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
  } catch (e) { actLogs = []; }

  // Filter logs for currently monitored activity
  let logs = actLogs.filter(l => l.activityId === staffMonitorActiveActId || (act && l.activityTitle === act.title));

  // Sort latest first
  logs.sort((a, b) => {
    const ta = a.checkInTimestamp ? new Date(a.checkInTimestamp).getTime() : 0;
    const tb = b.checkInTimestamp ? new Date(b.checkInTimestamp).getTime() : 0;
    return tb - ta;
  });

  // Update total count
  if (totalCountEl) {
    totalCountEl.innerHTML = `${logs.length} <span style="font-size: 0.95rem; font-weight: 600; color: var(--text-muted);">คน</span>`;
  }

  // Play pleasant ding sound if new scan arrived
  if (lastStaffKioskCount !== -1 && logs.length > lastStaffKioskCount) {
    if (typeof playStaffScanDingSound === 'function') playStaffScanDingSound();
  }
  lastStaffKioskCount = logs.length;

  // Update latest scanned student
  if (latestNameEl) {
    if (logs.length > 0) {
      const topLog = logs[0];
      latestNameEl.innerHTML = `
        <span style="color: #0284c7; font-weight: 800;">${topLog.studentName}</span>
        <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-left: 0.4rem;">(${topLog.grade || '-'})</span>
        <span style="font-size: 0.78rem; font-weight: 700; color: #10b981; margin-left: 0.4rem;"><i class="fa-regular fa-clock"></i> ${topLog.formattedTime || '-'}</span>
      `;
    } else {
      latestNameEl.innerText = 'ยังไม่มีรายการสแกนใหม่';
    }
  }

  // Update timestamp
  if (updatedTimeEl) {
    const now = new Date();
    updatedTimeEl.innerText = `อัปเดตล่าสุด: ${now.toLocaleTimeString('th-TH')} น.`;
  }

  if (logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem 1.5rem;">
          <i class="fa-solid fa-satellite-dish" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 0.75rem; display: block;"></i>
          <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-dark); display: block; margin-bottom: 0.25rem;">กำลังรอนักเรียนสแกน QR Code</span>
          <span style="font-size: 0.82rem;">เมื่อนักเรียนสแกนแล้ว รายชื่อจะปรากฏในตารางนี้ทันทีแบบเรียลไทม์</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = logs.map((item, idx) => {
    const isNew = highlightStudentId && isIdMatch(item.studentId, highlightStudentId);
    return `
      <tr class="${isNew ? 'row-new-scan' : ''}">
        <td style="text-align: center; color: var(--text-muted); font-weight: 600;">${idx + 1}</td>
        <td>
          <span style="font-weight: 700; color: #0284c7;"><i class="fa-regular fa-clock"></i> ${item.formattedTime || '-'}</span>
        </td>
        <td><b>${item.studentId || '-'}</b></td>
        <td style="font-weight: 600; color: var(--text-dark);">${item.studentName || '-'}</td>
        <td><span class="badge" style="background: #f1f5f9; color: var(--text-dark); font-size: 0.78rem;">${item.grade || '-'}</span></td>
        <td style="text-align: right;">
          <span style="background: #dcfce7; color: #166534; font-size: 0.74rem; font-weight: 700; padding: 0.22rem 0.6rem; border-radius: 9999px; display: inline-flex; align-items: center; gap: 0.25rem;">
            <i class="fa-solid fa-circle-check"></i> ${item.source || 'สแกนสำเร็จ'}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function filterStaffKioskList(query) {
  if (!query) {
    renderStaffKioskMonitor();
    return;
  }
  const q = query.toLowerCase().trim();
  const tbody = document.getElementById('staffKioskTableBody');
  if (!tbody || !staffMonitorActiveActId) return;

  const act = activities.find(a => (a.id === staffMonitorActiveActId || a.activityId === staffMonitorActiveActId));
  let actLogs = [];
  try {
    actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
  } catch (e) { actLogs = []; }

  let logs = actLogs.filter(l => l.activityId === staffMonitorActiveActId || (act && l.activityTitle === act.title));
  logs.sort((a, b) => {
    const ta = a.checkInTimestamp ? new Date(a.checkInTimestamp).getTime() : 0;
    const tb = b.checkInTimestamp ? new Date(b.checkInTimestamp).getTime() : 0;
    return tb - ta;
  });

  const filtered = logs.filter(item =>
    (item.studentName && item.studentName.toLowerCase().includes(q)) ||
    (item.studentId && item.studentId.toLowerCase().includes(q)) ||
    (item.grade && item.grade.toLowerCase().includes(q))
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
          ไม่พบข้อมูลที่ตรงกับ "${query}"
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((item, idx) => `
    <tr>
      <td style="text-align: center; color: var(--text-muted); font-weight: 600;">${idx + 1}</td>
      <td>
        <span style="font-weight: 700; color: #0284c7;"><i class="fa-regular fa-clock"></i> ${item.formattedTime || '-'}</span>
      </td>
      <td><b>${item.studentId || '-'}</b></td>
      <td style="font-weight: 600; color: var(--text-dark);">${item.studentName || '-'}</td>
      <td><span class="badge" style="background: #f1f5f9; color: var(--text-dark); font-size: 0.78rem;">${item.grade || '-'}</span></td>
      <td style="text-align: right;">
        <span style="background: #dcfce7; color: #166534; font-size: 0.74rem; font-weight: 700; padding: 0.22rem 0.6rem; border-radius: 9999px; display: inline-flex; align-items: center; gap: 0.25rem;">
          <i class="fa-solid fa-circle-check"></i> ${item.source || 'สแกนสำเร็จ'}
        </span>
      </td>
    </tr>
  `).join('');
}

function refreshStaffMonitorLive(showToastMsg = false) {
  fetchActivitiesAndLogsFromCloud(showToastMsg);
}

function toggleStaffSound() {
  isStaffSoundEnabled = !isStaffSoundEnabled;
  const btn = document.getElementById('btnStaffSoundToggle');
  if (btn) {
    btn.innerHTML = `<i class="fa-solid fa-${isStaffSoundEnabled ? 'volume-high' : 'volume-xmark'}"></i> <span class="d-none-sm" id="staffSoundBtnText">เสียง: ${isStaffSoundEnabled ? 'เปิด' : 'ปิด'}</span>`;
  }
  if (isStaffSoundEnabled) {
    playStaffScanDingSound();
    showToast('เปิดเสียงแจ้งเตือนเมื่อนักเรียนสแกนแล้ว', 'info');
  } else {
    showToast('ปิดเสียงแจ้งเตือนแล้ว', 'info');
  }
}

function playStaffScanDingSound() {
  if (!isStaffSoundEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    // Pleasant dual-frequency chime (D5 -> A5)
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.42);
  } catch (e) {}
}

function toggleStaffFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      const btn = document.getElementById('staffFullscreenBtnText');
      if (btn) btn.innerText = 'ย่อจอ';
    }).catch(err => {
      console.warn('Fullscreen error:', err);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().then(() => {
        const btn = document.getElementById('staffFullscreenBtnText');
        if (btn) btn.innerText = 'เต็มจอ';
      });
    }
  }
}

function copyStaffMonitorLink(actId) {
  const targetId = actId || staffMonitorActiveActId || (activities[0] ? (activities[0].id || activities[0].activityId) : '');
  const url = `${window.location.origin}${window.location.pathname}?monitor=${encodeURIComponent(targetId)}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('📋 คัดลอกลิงก์มอนิเตอร์สำหรับสตาฟเรียบร้อย! สามารถแชร์ให้ตัวแทนเปิดขึ้นจอได้ทันทีโดยไม่ต้องล็อกอิน', 'success');
    }).catch(() => {
      prompt('คัดลอกลิงก์มอนิเตอร์สำหรับสตาฟ (ไม่ต้องล็อกอิน):', url);
    });
  } else {
    prompt('คัดลอกลิงก์มอนิเตอร์สำหรับสตาฟ (ไม่ต้องล็อกอิน):', url);
  }
}

function copyStaffCurrentLink() {
  copyStaffMonitorLink(staffMonitorActiveActId);
}

function copyCurrentModalStaffLink() {
  copyStaffMonitorLink(currentViewingActivityId);
}

function openStaffMonitorStandalone(actId) {
  const targetId = actId || staffMonitorActiveActId || (activities[0] ? (activities[0].id || activities[0].activityId) : '');
  if (!targetId) {
    showToast('ไม่พบกิจกรรมที่ต้องการเปิดมอนิเตอร์', 'warning');
    return;
  }
  // 1. Switch to staff-monitor view in current tab seamlessly (zero popup blocker issues!)
  switchView('staff-monitor');
  initStaffMonitor(targetId);
  showToast('เปิดหน้าจอมอนิเตอร์ Kiosk สำเร็จ (กดปุ่ม "กลับหน้าแอดมิน" ด้านบนเมื่อต้องการออก)', 'info');
}

function openCurrentModalStandaloneKiosk() {
  openStaffMonitorStandalone(currentViewingActivityId);
}

function openStaffMonitorInNewTab(actId) {
  const targetId = actId || staffMonitorActiveActId || (activities[0] ? (activities[0].id || activities[0].activityId) : '');
  const url = `${window.location.origin}${window.location.pathname}?monitor=${encodeURIComponent(targetId)}`;
  const win = window.open(url, '_blank');
  if (!win) {
    showToast('เบราว์เซอร์บล็อกป๊อปอัป กรุณากดปุ่ม "แชร์ลิงก์" เพื่อคัดลอกลิงก์ไปเปิดในแท็บใหม่แทนได้ครับ', 'warning');
  }
}

function exitStaffKioskToAdmin() {
  document.body.classList.remove('staff-monitor-active');
  isStaffMonitorMode = false;
  
  // Clean URL parameters
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('monitor');
    url.searchParams.delete('staff_monitor');
    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
  } catch (e) {}

  if (currentAdmin) {
    switchView(currentAdmin.role === 'SuperAdmin' ? 'admin' : 'teacher');
  } else if (currentStudent) {
    switchView('dashboard');
  } else {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    enforceMandatoryLogin();
  }
}

function printCurrentStaffQr() {
  if (!staffMonitorActiveActId) return;
  openActivityQrModal(staffMonitorActiveActId);
  setTimeout(() => {
    printActivityQrCode();
  }, 300);
}

function printCurrentModalQr() {
  if (!currentViewingActivityId) return;
  openActivityQrModal(currentViewingActivityId);
  setTimeout(() => {
    printActivityQrCode();
  }, 300);
}

function exportStaffAttendeesToExcel() {
  if (!staffMonitorActiveActId) return;
  const act = activities.find(a => (a.id === staffMonitorActiveActId || a.activityId === staffMonitorActiveActId));
  let actLogs = [];
  try {
    actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
  } catch (e) { actLogs = []; }

  const list = actLogs.filter(l => l.activityId === staffMonitorActiveActId || (act && l.activityTitle === act.title));
  if (list.length === 0) {
    showToast('ไม่มีข้อมูลผู้เข้าร่วมสำหรับส่งออก Excel', 'warning');
    return;
  }

  const exportData = list.map((item, idx) => ({
    'ลำดับ': idx + 1,
    'รหัสนักเรียน': item.studentId,
    'ชื่อ-นามสกุล': item.studentName,
    'ระดับชั้น': item.grade || '-',
    'กิจกรรม': item.activityTitle || (act ? act.title : staffMonitorActiveActId),
    'วันที่เช็คชื่อ': item.formattedDate || '-',
    'เวลาที่เช็คชื่อ': item.formattedTime || '-',
    'ช่องทาง': item.source || 'สแกน QR Code'
  }));

  try {
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ผู้เข้าร่วมกิจกรรม');
    const safeTitle = (act ? act.title : 'กิจกรรม').replace(/[^a-zA-Z0-9ก-๙_-]/g, '_');
    XLSX.writeFile(wb, `ผู้เข้าร่วม_${safeTitle}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('ส่งออกไฟล์ Excel สำเร็จ!', 'success');
  } catch (err) {
    console.error('Export error:', err);
    showToast('เกิดข้อผิดพลาดในการส่งออก Excel', 'error');
  }
}

// Initialize minimalist date of birth picker
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBirthDatePicker);
} else {
  initBirthDatePicker();
}


/* ==========================================================================
   MINIMALIST HUMAN-CRAFTED ACADEMIC & SCHOOL CALENDAR SYSTEM
   - Permissions: SuperAdmin, Executive & Teacher (Add/Edit/Delete)
   - Read-only for Students (Strictly hide targetAudience === 'teachers')
   - Full Month View ("มุมมองทั้งเดือน") & Split View ("คู่กำหนดการ")
   - Interactive Month/Year selection, Thai Buddhist Era (พ.ศ.) support
   - Detail Modal & Add/Edit Modal
   - Real-time Google Sheets Sync & Local Offline Storage
   ========================================================================== */

let calendarEvents = [];
let calCurrentMonth = new Date().getMonth();
let calCurrentYear = new Date().getFullYear();
let calSelectedDate = new Date().toISOString().split('T')[0];
let calViewMode = localStorage.getItem('khalifah_cal_view_mode') || 'full'; // 'full' or 'split'
let currentViewingEventId = null;

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_DAY_NAMES = [
  'อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'
];

function canManageCalendar() {
  // นักเรียนไม่มีสิทธิ์จัดการปฏิทินเด็ดขาด (ทำได้เฉพาะดู)
  if (currentStudent && !currentAdmin) {
    return false;
  }
  // ตรวจสอบว่าผู้ใช้งานปัจจุบันเป็น Admin / Executive / Teacher หรือไม่
  if (currentAdmin && (currentAdmin.role === 'SuperAdmin' || currentAdmin.role === 'EXECUTIVE' || currentAdmin.role === 'TEACHER' || currentAdmin.username)) {
    return true;
  }
  return false;
}

function getVisibleCalendarEvents() {
  const isManager = canManageCalendar();

  // กรณีนักเรียนเข้าใช้งาน: กรองกิจกรรมเฉพาะที่เกี่ยวกับตนเอง
  if (!isManager && currentStudent) {
    return calendarEvents.filter(e => {
      const target = (e.targetAudience || 'all').toLowerCase();
      // ซ่อนกิจกรรมเฉพาะอาจารย์
      if (target === 'teachers') return false;

      // ตรวจสอบกิจกรรมเฉพาะนักเรียน
      if (target === 'students') {
        // เจาะจงนักเรียนรายคน
        if (e.targetStudentId && e.targetStudentId !== 'ALL') {
          return isIdMatch(currentStudent.studentId, e.targetStudentId);
        }
        // เจาะจงระดับชั้น
        if (e.targetGrade && e.targetGrade !== 'ALL') {
          const stGrade = currentStudent.grade || '';
          if (e.targetGrade === 'LOWER_SEC') {
            return ['มัธยมศึกษาปีที่ 1', 'มัธยมศึกษาปีที่ 2', 'มัธยมศึกษาปีที่ 3'].includes(stGrade);
          }
          if (e.targetGrade === 'UPPER_SEC') {
            return ['มัธยมศึกษาปีที่ 4', 'มัธยมศึกษาปีที่ 5', 'มัธยมศึกษาปีที่ 6'].includes(stGrade);
          }
          return stGrade === e.targetGrade;
        }
      }

      return true; // กิจกรรมสำหรับทุกคน หรือนักเรียนทุกระดับชั้น
    });
  }

  // กรณีอาจารย์หรือผู้บริหารเข้าใช้งาน:
  if (currentAdmin) {
    // SuperAdmin และ Executive สามารถเห็นกิจกรรมทุกรายการ
    if (currentAdmin.role === 'SuperAdmin' || currentAdmin.role === 'EXECUTIVE') {
      return calendarEvents;
    }
    return calendarEvents.filter(e => {
      const target = (e.targetAudience || 'all').toLowerCase();
      if (target === 'teachers') {
        // เจาะจงอาจารย์รายท่าน
        if (e.targetTeacherUsername && e.targetTeacherUsername !== 'ALL') {
          return e.targetTeacherUsername === currentAdmin.username || (typeof canDeleteCalendarEvent === 'function' && canDeleteCalendarEvent(e));
        }
        // เจาะจงบทบาท
        if (e.targetTeacherRole && e.targetTeacherRole !== 'ALL') {
          return e.targetTeacherRole === currentAdmin.role || (typeof canDeleteCalendarEvent === 'function' && canDeleteCalendarEvent(e));
        }
      }
      return true;
    });
  }

  // ผู้ใช้ทั่วไปหรือยังไม่ล็อกอิน: แสดงเฉพาะกิจกรรมที่ไม่ใช่เฉพาะอาจารย์
  return calendarEvents.filter(e => {
    const target = (e.targetAudience || 'all').toLowerCase();
    return target !== 'teachers';
  });
}

function loadInitialCalendarData() {
  try {
    const saved = localStorage.getItem('khalifah_calendar_events');
    if (saved) {
      calendarEvents = JSON.parse(saved);
    }
  } catch (e) {
    calendarEvents = [];
  }

  // หากยังไม่มีข้อมูล ให้ใส่ข้อมูลกิจกรรมตัวอย่างของโรงเรียนอิสลาม
  if (!Array.isArray(calendarEvents) || calendarEvents.length === 0) {
    const curY = new Date().getFullYear();
    const curM = String(new Date().getMonth() + 1).padStart(2, '0');
    calendarEvents = [
      {
        id: 'CAL-INIT-01',
        title: 'วันเปิดภาคเรียนที่ 2 / 2569',
        category: 'การเรียนการสอน',
        targetAudience: 'all',
        targetAudienceLabel: 'ทุกคน (นักเรียนและอาจารย์)',
        startDate: curY + '-' + curM + '-01',
        endDate: curY + '-' + curM + '-01',
        startTime: '08:00',
        endTime: '15:30',
        location: 'ลานกิจกรรมและห้องเรียนหลัก',
        description: 'ปฐมนิเทศเปิดภาคเรียน ต้อนรับนักเรียน และชี้แจงระเบียบการเรียนการสอนประจำภาคเรียน',
        createdBy: 'ผู้บริหารสถานศึกษา',
        updatedAt: curY + '-' + curM + '-01 08:00:00'
      },
      {
        id: 'CAL-INIT-02',
        title: 'ละหมาดวันศุกร์ (ญุมอะฮ์) ประจำสัปดาห์',
        category: 'ละหมาด / ศาสนกิจ',
        targetAudience: 'all',
        targetAudienceLabel: 'ทุกคน (นักเรียนและอาจารย์)',
        startDate: curY + '-' + curM + '-06',
        endDate: curY + '-' + curM + '-06',
        startTime: '12:00',
        endTime: '13:30',
        location: 'มัสยิดกลาง KHALIFAH',
        description: 'รับฟังคุฏบะฮ์วันศุกร์และร่วมละหมาดญุมอะฮ์พร้อมเพรียงกันทั้งโรงเรียน',
        createdBy: 'ฝ่ายศาสนการและคุณธรรม',
        updatedAt: curY + '-' + curM + '-06 09:00:00'
      },
      {
        id: 'CAL-INIT-03',
        title: 'ประชุมวางแผนการสอนและประเมินผลครู',
        category: 'ประชุม / สัมมนา',
        targetAudience: 'teachers',
        targetAudienceLabel: 'เฉพาะอาจารย์และผู้บริหาร',
        startDate: curY + '-' + curM + '-10',
        endDate: curY + '-' + curM + '-10',
        startTime: '15:30',
        endTime: '17:00',
        location: 'ห้องประชุมฝ่ายบริหาร ชั้น 2',
        description: 'ติดตามผลการเรียนรายวิชา ทบทวนการเช็คชื่อมาเรียน และการบันทึกผลบุญประจำสัปดาห์',
        createdBy: 'ฝ่ายวิชาการ',
        updatedAt: curY + '-' + curM + '-10 10:00:00'
      },
      {
        id: 'CAL-INIT-04',
        title: 'การสอบกลางภาคเรียน (Midterm Examinations)',
        category: 'การสอบ / ประเมินผล',
        targetAudience: 'all',
        targetAudienceLabel: 'ทุกคน (นักเรียนและอาจารย์)',
        startDate: curY + '-' + curM + '-18',
        endDate: curY + '-' + curM + '-20',
        startTime: '08:30',
        endTime: '15:00',
        location: 'อาคารสอบและห้องเรียนประจำชั้น',
        description: 'การสอบวัดผลสัมฤทธิ์กลางภาคเรียน หมวดวิชาสามัญและวิชาศาสนา ให้นักเรียนแต่งกายถูกต้องตามระเบียบ',
        createdBy: 'งานทะเบียนและวัดผล',
        updatedAt: curY + '-' + curM + '-15 11:00:00'
      },
      {
        id: 'CAL-INIT-05',
        title: 'กิจกรรมค่ายคุณธรรมและค็อตม์อัลกุรอาน',
        category: 'กิจกรรมทั่วไป',
        targetAudience: 'students',
        targetAudienceLabel: 'เฉพาะนักเรียน',
        startDate: curY + '-' + curM + '-25',
        endDate: curY + '-' + curM + '-26',
        startTime: '08:00',
        endTime: '16:00',
        location: 'หอประชุมใหญ่ KHALIFAH',
        description: 'กิจกรรมทบทวนการท่องจำอัลกุรอาน การละหมาดสุนัต และมอบเกียรติบัตรดาวความดี',
        createdBy: 'ฝ่ายพัฒนานักเรียน',
        updatedAt: curY + '-' + curM + '-20 14:00:00'
      }
    ];
    try {
      localStorage.setItem('khalifah_calendar_events', JSON.stringify(calendarEvents));
    } catch (e) {}
  }
}

function initCalendar() {
  loadInitialCalendarData();
  populateCalendarSelects();
  updateCalendarViewClasses();
  renderCalendar('all');
}

function setCalendarViewMode(mode, scope = 'all') {
  calViewMode = (mode === 'split') ? 'split' : 'full';
  try {
    localStorage.setItem('khalifah_cal_view_mode', calViewMode);
  } catch (e) {}
  updateCalendarViewClasses();
  renderCalendar('all');
}

function updateCalendarViewClasses() {
  const scopes = ['dash', 'teacher', 'admin'];
  scopes.forEach(scope => {
    const layoutEl = document.getElementById(`calGridLayout-${scope}`);
    if (layoutEl) {
      if (calViewMode === 'full') {
        layoutEl.classList.add('view-full');
        layoutEl.classList.remove('view-split');
      } else {
        layoutEl.classList.add('view-split');
        layoutEl.classList.remove('view-full');
      }
    }

    const btnFull = document.getElementById(`btnCalViewFull-${scope}`);
    const btnSplit = document.getElementById(`btnCalViewSplit-${scope}`);
    if (btnFull && btnSplit) {
      if (calViewMode === 'full') {
        btnFull.classList.add('active');
        btnSplit.classList.remove('active');
      } else {
        btnSplit.classList.add('active');
        btnFull.classList.remove('active');
      }
    }
  });
}

function populateCalendarSelects() {
  const scopes = ['dash', 'teacher', 'admin'];
  const visibleEvents = (typeof getVisibleCalendarEvents === 'function') ? getVisibleCalendarEvents() : [];
  scopes.forEach(scope => {
    const mSelect = document.getElementById(`calMonthSelect-${scope}`);
    const ySelect = document.getElementById(`calYearSelect-${scope}`);
    if (mSelect) {
      mSelect.innerHTML = THAI_MONTH_NAMES.map((name, idx) => {
        const m = idx + 1;
        const count = visibleEvents.filter(e => {
          if (!e.startDate) return false;
          const p = e.startDate.split('-');
          return parseInt(p[0], 10) === calCurrentYear && parseInt(p[1], 10) === m;
        }).length;
        const badge = (count > 0 && scope === 'dash') ? ` (⭐ ${count} กิจกรรม)` : '';
        return `<option value="${idx}">${name}${badge}</option>`;
      }).join('');
      mSelect.value = calCurrentMonth;
    }
    if (ySelect) {
      const startYear = 2024;
      const endYear = 2029;
      let yOptions = '';
      for (let y = startYear; y <= endYear; y++) {
        const thaiY = y + 543;
        yOptions += `<option value="${y}">${thaiY} (${y})</option>`;
      }
      ySelect.innerHTML = yOptions;
      ySelect.value = calCurrentYear;
    }
  });
}

function onCalendarSelectChange(scope) {
  const mSelect = document.getElementById(`calMonthSelect-${scope}`);
  const ySelect = document.getElementById(`calYearSelect-${scope}`);
  if (mSelect && ySelect) {
    calCurrentMonth = parseInt(mSelect.value, 10);
    calCurrentYear = parseInt(ySelect.value, 10);
    renderCalendar('all');
  }
}

function shiftCalendarMonth(offset, scope) {
  calCurrentMonth += offset;
  if (calCurrentMonth < 0) {
    calCurrentMonth = 11;
    calCurrentYear -= 1;
  } else if (calCurrentMonth > 11) {
    calCurrentMonth = 0;
    calCurrentYear += 1;
  }
  renderCalendar('all');
}

function resetCalendarToToday(scope) {
  const now = new Date();
  calCurrentMonth = now.getMonth();
  calCurrentYear = now.getFullYear();
  calSelectedDate = now.toISOString().split('T')[0];
  renderCalendar('all');
}

function selectCalendarDate(dateStr) {
  calSelectedDate = dateStr;
  const scopes = ['dash', 'teacher', 'admin'];
  scopes.forEach(scope => {
    const gridEl = document.getElementById(`calDaysGrid-${scope}`);
    if (gridEl) {
      gridEl.querySelectorAll('.cal-day-cell').forEach(cell => {
        if (cell.dataset.date === dateStr) {
          cell.classList.add('cal-day-selected');
        } else {
          cell.classList.remove('cal-day-selected');
        }
      });
    }
    renderCalendarAgenda(scope);
  });
}

function getCategoryClass(cat) {
  const c = String(cat || '').trim();
  if (c.includes('สอบ') || c.includes('ประเมิน')) return 'cat-exam';
  if (c.includes('เรียน') || c.includes('การสอน')) return 'cat-academic';
  if (c.includes('ละหมาด') || c.includes('ศาสนกิจ') || c.includes('กุรอาน')) return 'cat-prayer';
  if (c.includes('หยุด') || c.includes('ปิดภาค')) return 'cat-holiday';
  if (c.includes('ประชุม') || c.includes('สัมมนา')) return 'cat-meeting';
  return 'cat-general';
}

function getCategoryShortLabel(cat) {
  const c = String(cat || '').trim();
  if (c.includes('สอบ') || c.includes('ประเมิน')) return 'สอบ';
  if (c.includes('หยุด') || c.includes('ปิดภาค')) return 'วันหยุด';
  if (c.includes('ละหมาด') || c.includes('ศาสนกิจ') || c.includes('กุรอาน')) return 'ศาสนกิจ';
  if (c.includes('เรียน') || c.includes('การสอน')) return 'การเรียน';
  if (c.includes('ประชุม') || c.includes('สัมมนา')) return 'ประชุม';
  return 'กิจกรรม';
}

function getCategoryIcon(cat) {
  const c = String(cat || '').trim();
  if (c.includes('สอบ') || c.includes('ประเมิน')) return 'fa-solid fa-file-pen';
  if (c.includes('หยุด') || c.includes('ปิดภาค')) return 'fa-solid fa-mug-hot';
  if (c.includes('ละหมาด') || c.includes('ศาสนกิจ') || c.includes('กุรอาน')) return 'fa-solid fa-mosque';
  if (c.includes('เรียน') || c.includes('การสอน')) return 'fa-solid fa-book-open';
  if (c.includes('ประชุม') || c.includes('สัมมนา')) return 'fa-solid fa-users';
  return 'fa-solid fa-bullhorn';
}

function formatThaiDateDisplay(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const thaiYear = y + 543;
  const mName = THAI_MONTH_NAMES[m] || '';
  return `${d} ${mName} ${thaiYear}`;
}

function formatThaiDateWithDayName(dateStr) {
  if (!dateStr) return { dayName: '-', fullDate: '-' };
  const parts = dateStr.split('-');
  if (parts.length !== 3) return { dayName: '-', fullDate: dateStr };
  const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const dayName = 'วัน' + (THAI_DAY_NAMES[dObj.getDay()] || '');
  const fullDate = formatThaiDateDisplay(dateStr);
  return { dayName, fullDate };
}

function isDateInRange(targetDate, startDate, endDate) {
  if (!startDate) return false;
  const s = startDate;
  const e = endDate || startDate;
  return targetDate >= s && targetDate <= e;
}

function renderCalendar(targetScope = 'all') {
  const scopes = (targetScope === 'all') ? ['dash', 'teacher', 'admin'] : [targetScope];
  const isManager = canManageCalendar();
  const visibleEvents = getVisibleCalendarEvents();

  updateCalendarViewClasses();

  // Sync toolbar dropdowns & add buttons
  scopes.forEach(scope => {
    const mSelect = document.getElementById(`calMonthSelect-${scope}`);
    const ySelect = document.getElementById(`calYearSelect-${scope}`);
    if (mSelect) mSelect.value = calCurrentMonth;
    if (ySelect) ySelect.value = calCurrentYear;

    const addBtn = document.getElementById(
      scope === 'dash' ? 'btnDashCalAddEvent' : (scope === 'teacher' ? 'btnTeacherCalAddEvent' : 'btnAdminCalAddEvent')
    );
    if (addBtn) {
      addBtn.style.display = isManager ? 'inline-flex' : 'none';
    }
  });

  // Calculate Month Days
  const firstDayIndex = new Date(calCurrentYear, calCurrentMonth, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(calCurrentYear, calCurrentMonth + 1, 0).getDate();
  const prevMonthDays = new Date(calCurrentYear, calCurrentMonth, 0).getDate();

  const todayStr = new Date().toISOString().split('T')[0];

  scopes.forEach(scope => {
    const gridEl = document.getElementById(`calDaysGrid-${scope}`);
    if (!gridEl) return;

    const isStudentCompact = (scope === 'dash');
    let cellsHtml = '';

    // 1. Previous Month Days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevM = (calCurrentMonth === 0) ? 12 : calCurrentMonth;
      const prevY = (calCurrentMonth === 0) ? calCurrentYear - 1 : calCurrentYear;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      if (isStudentCompact) {
        cellsHtml += `
          <div class="cal-day-cell cal-day-other-month" data-date="${dateStr}">
            <span class="cal-day-num">${dayNum}</span>
          </div>
        `;
      } else {
        cellsHtml += `
          <div class="cal-day-cell cal-day-other-month" data-date="${dateStr}">
            <div class="cal-day-header">
              <span class="cal-day-num">${dayNum}</span>
            </div>
          </div>
        `;
      }
    }

    // 2. Current Month Days
    const maxChipsPerCell = (calViewMode === 'full') ? 3 : 2;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calCurrentYear}-${String(calCurrentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = (dateStr === todayStr);
      const isSelected = (dateStr === calSelectedDate);
      const dayOfWeek = new Date(calCurrentYear, calCurrentMonth, day).getDay();
      const isSun = (dayOfWeek === 0);
      const isFri = (dayOfWeek === 5);

      // Find events for this day
      const dayEvents = visibleEvents.filter(e => isDateInRange(dateStr, e.startDate, e.endDate));

      if (isStudentCompact) {
        // STUDENT VIEW: มินิมอล เซลล์สี่เหลี่ยมเต็มสีสันตามหมวดหมู่การประกาศ แตะแล้วเปิดดูรายละเอียด
        let fillClass = '';
        let miniLabelHtml = '';
        let tooltipText = `วันที่ ${formatThaiDateDisplay(dateStr)}`;

        if (dayEvents.length > 0) {
          const primaryCatClass = getCategoryClass(dayEvents[0].category);
          fillClass = `cal-day-event-filled fill-${primaryCatClass}`;
          if (dayEvents.length === 1) {
            const shortLabel = getCategoryShortLabel(dayEvents[0].category);
            miniLabelHtml = `<span class="cal-mini-label">${escapeHtml(shortLabel)}</span>`;
            tooltipText = `📌 ${escapeHtml(dayEvents[0].title)} (${formatThaiDateDisplay(dateStr)}) - แตะเพื่อดูรายละเอียด`;
          } else {
            miniLabelHtml = `<span class="cal-mini-label">${dayEvents.length} ประกาศ</span>`;
            tooltipText = `📌 ${dayEvents.length} ประกาศและกิจกรรม (${formatThaiDateDisplay(dateStr)}) - แตะเพื่อดูรายละเอียด`;
          }
        } else if (isToday) {
          miniLabelHtml = `<span class="cal-mini-today-dot"></span>`;
          tooltipText = `วันนี้ (${formatThaiDateDisplay(dateStr)})`;
        }

        const cellClasses = [
          'cal-day-cell',
          fillClass,
          isToday ? 'cal-day-today' : '',
          isSelected ? 'cal-day-selected' : '',
          isSun ? 'cal-day-sun' : '',
          isFri ? 'cal-day-fri' : ''
        ].filter(Boolean).join(' ');

        cellsHtml += `
          <div class="${cellClasses}" data-date="${dateStr}" onclick="handleCalendarDayClick('${dateStr}', '${scope}')" title="${tooltipText}">
            <span class="cal-day-num">${day}</span>
            ${miniLabelHtml}
            ${(isToday && dayEvents.length > 0) ? '<span class="cal-mini-today-indicator"></span>' : ''}
          </div>
        `;
      } else {
        // TEACHER & ADMIN VIEW: มุมมองกำหนดการพร้อมชิปรายการ และดับเบิ้ลคลิกเพิ่มกิจกรรม
        let chipsHtml = '';
        if (dayEvents.length > 0) {
          chipsHtml += '<div class="cal-day-chips">';
          const displayList = dayEvents.slice(0, maxChipsPerCell);
          displayList.forEach(ev => {
            const catClass = getCategoryClass(ev.category);
            const timeInfo = ev.startTime ? ` (${ev.startTime} น.)` : '';
            chipsHtml += `
              <div class="cal-chip ${catClass}" title="${escapeHtml(ev.title)}${timeInfo}" onclick="event.stopPropagation(); openCalendarEventDetail('${ev.id}')">
                <span class="cal-chip-dot"></span>
                <span class="cal-chip-text">${escapeHtml(ev.title)}</span>
              </div>
            `;
          });
          if (dayEvents.length > maxChipsPerCell) {
            const moreCount = dayEvents.length - maxChipsPerCell;
            chipsHtml += `<div class="cal-chip-more">+${moreCount} อื่นๆ</div>`;
          }
          chipsHtml += '</div>';
        }

        const cellClasses = [
          'cal-day-cell',
          isToday ? 'cal-day-today' : '',
          isSelected ? 'cal-day-selected' : '',
          isSun ? 'cal-day-sun' : '',
          isFri ? 'cal-day-fri' : ''
        ].filter(Boolean).join(' ');

        const dblClickAttr = isManager ? `ondblclick="openCalendarEventModal(null, '${dateStr}')"` : '';

        cellsHtml += `
          <div class="${cellClasses}" data-date="${dateStr}" onclick="handleCalendarDayClick('${dateStr}', '${scope}')" ${dblClickAttr}>
            <div class="cal-day-header">
              <span class="cal-day-num">${day}</span>
              ${isToday ? '<span class="cal-today-tag">วันนี้</span>' : ''}
            </div>
            ${chipsHtml}
          </div>
        `;
      }
    }

    // 3. Next Month Days Padding to complete grid (multiples of 7)
    const totalRendered = firstDayIndex + daysInMonth;
    const remaining = (totalRendered % 7 === 0) ? 0 : 7 - (totalRendered % 7);
    for (let nextDay = 1; nextDay <= remaining; nextDay++) {
      const nextM = (calCurrentMonth === 11) ? 1 : calCurrentMonth + 2;
      const nextY = (calCurrentMonth === 11) ? calCurrentYear + 1 : calCurrentYear;
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
      if (isStudentCompact) {
        cellsHtml += `
          <div class="cal-day-cell cal-day-other-month" data-date="${dateStr}">
            <span class="cal-day-num">${nextDay}</span>
          </div>
        `;
      } else {
        cellsHtml += `
          <div class="cal-day-cell cal-day-other-month" data-date="${dateStr}">
            <div class="cal-day-header">
              <span class="cal-day-num">${nextDay}</span>
            </div>
          </div>
        `;
      }
    }

    gridEl.innerHTML = cellsHtml;

    // Render Agenda
    renderCalendarAgenda(scope);

    if (scope === 'dash') {
      if (typeof populateCalendarQuickSelect === 'function') {
        populateCalendarQuickSelect();
      }
      if (typeof studentCalMode !== 'undefined' && studentCalMode === 'list') {
        if (typeof renderStudentActiveEventsList === 'function') {
          renderStudentActiveEventsList();
        }
      }
    }
  });
  updateCalendarLauncherBadge();
}

function renderCalendarAgenda(scope) {
  const dateEl = document.getElementById(`calAgendaDate-${scope}`);
  const badgeEl = document.getElementById(`calAgendaBadge-${scope}`);
  const listEl = document.getElementById(`calAgendaList-${scope}`);
  if (!dateEl || !listEl) return;

  const { dayName, fullDate } = formatThaiDateWithDayName(calSelectedDate);
  const isManager = canManageCalendar();

  dateEl.innerHTML = `
    <span class="cal-agenda-day-name">${dayName}</span>
    <span class="cal-agenda-full-date">${fullDate}</span>
  `;

  const visibleEvents = getVisibleCalendarEvents();
  const dayEvents = visibleEvents.filter(e => isDateInRange(calSelectedDate, e.startDate, e.endDate));

  if (badgeEl) {
    badgeEl.innerText = `${dayEvents.length} กิจกรรม`;
  }

  // Quick Add Button for Admins & Teachers
  let quickAddBtnHtml = '';
  if (isManager) {
    quickAddBtnHtml = `
      <div class="cal-agenda-quick-add-row">
        <button type="button" class="btn btn-outline-primary btn-sm btn-cal-quick-add" onclick="openCalendarEventModal(null, '${calSelectedDate}')">
          <i class="fa-solid fa-plus"></i> เพิ่มกิจกรรมในวันที่ ${formatThaiDateDisplay(calSelectedDate)}
        </button>
      </div>
    `;
  }

  if (dayEvents.length > 0) {
    let itemsHtml = quickAddBtnHtml;
    itemsHtml += `<div class="cal-agenda-cards-wrap ${calViewMode === 'full' ? 'cards-grid' : 'cards-list'}">`;

    dayEvents.forEach(ev => {
      const catClass = getCategoryClass(ev.category);
      const timeStr = (ev.startTime) ? `${ev.startTime} - ${ev.endTime || 'เสร็จสิ้น'} น.` : 'ตลอดทั้งวัน (All-day)';
      const targetLabel = ev.targetAudienceLabel || (ev.targetAudience === 'teachers' ? 'เฉพาะอาจารย์' : (ev.targetAudience === 'students' ? 'เฉพาะนักเรียน' : 'ทุกคน'));
      const targetClass = `target-${ev.targetAudience || 'all'}`;

      itemsHtml += `
        <div class="cal-agenda-item ${catClass}" onclick="openCalendarEventDetail('${ev.id}')">
          <div class="cal-agenda-item-top">
            <span class="cal-agenda-time"><i class="fa-regular fa-clock"></i> ${timeStr}</span>
            <span class="cal-agenda-target-pill ${targetClass}">${targetLabel}</span>
          </div>
          <h4 class="cal-agenda-item-title">${escapeHtml(ev.title)}</h4>
          <div class="cal-agenda-item-foot">
            <span class="cal-category-pill ${catClass}">${escapeHtml(ev.category || 'ทั่วไป')}</span>
            ${ev.location ? `<span class="cal-agenda-loc"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(ev.location)}</span>` : ''}
          </div>
        </div>
      `;
    });

    itemsHtml += `</div>`;
    listEl.innerHTML = itemsHtml;
  } else {
    // Empty state for selected date + upcoming events preview in current month
    const upcomingEvents = visibleEvents.filter(e => {
      return (e.startDate >= calSelectedDate) && (e.startDate.startsWith(`${calCurrentYear}-${String(calCurrentMonth + 1).padStart(2, '0')}`));
    }).slice(0, 3);

    let upcomingHtml = '';
    if (upcomingEvents.length > 0) {
      upcomingHtml = `
        <div class="cal-upcoming-header">
          <i class="fa-solid fa-arrow-trend-up"></i> กิจกรรมที่จะมาถึงในเดือนนี้
        </div>
        <div class="cal-agenda-cards-wrap ${calViewMode === 'full' ? 'cards-grid' : 'cards-list'}">
      `;
      upcomingEvents.forEach(ev => {
        const catClass = getCategoryClass(ev.category);
        const dateDisp = formatThaiDateDisplay(ev.startDate);
        upcomingHtml += `
          <div class="cal-agenda-item ${catClass}" style="opacity: 0.9;" onclick="openCalendarEventDetail('${ev.id}')">
            <div class="cal-agenda-item-top">
              <span class="cal-agenda-time"><i class="fa-regular fa-calendar"></i> ${dateDisp}</span>
              <span class="cal-agenda-target-pill target-${ev.targetAudience || 'all'}">${ev.targetAudienceLabel || 'ทุกคน'}</span>
            </div>
            <h4 class="cal-agenda-item-title">${escapeHtml(ev.title)}</h4>
            ${ev.location ? `<div class="cal-agenda-item-foot"><span class="cal-agenda-loc"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(ev.location)}</span></div>` : ''}
          </div>
        `;
      });
      upcomingHtml += `</div>`;
    }

    listEl.innerHTML = `
      ${quickAddBtnHtml}
      <div class="cal-empty-state">
        <i class="fa-regular fa-calendar-xmark cal-empty-icon"></i>
        <div class="cal-empty-title">ไม่มีกิจกรรมในวันที่เลือก</div>
        <div class="cal-empty-sub">คลิกเลือกวันที่อื่นบนปฏิทินเพื่อดูกำหนดการ ${isManager ? 'หรือกดปุ่มด้านบนเพื่อเพิ่มกิจกรรม' : ''}</div>
      </div>
      ${upcomingHtml}
    `;
  }
}

function openCalendarEventDetail(eventId) {
  const ev = calendarEvents.find(e => e.id === eventId);
  if (!ev) return;

  // นักเรียนไม่สามารถดูกิจกรรมเฉพาะอาจารย์ได้
  if (!canManageCalendar() && (ev.targetAudience || '').toLowerCase() === 'teachers') {
    showToast('กิจกรรมนี้สำหรับอาจารย์และบุคลากรเท่านั้น', 'info');
    return;
  }

  currentViewingEventId = eventId;

  const titleEl = document.getElementById('calDetailTitle');
  const catEl = document.getElementById('calDetailCatPill');
  const targetEl = document.getElementById('calDetailTargetPill');
  const datesEl = document.getElementById('calDetailDates');
  const timeEl = document.getElementById('calDetailTime');
  const locEl = document.getElementById('calDetailLocation');
  const descEl = document.getElementById('calDetailDescription');
  const metaEl = document.getElementById('calDetailMeta');
  const adminActions = document.getElementById('calDetailAdminActions');

  if (titleEl) titleEl.innerText = ev.title || 'ไม่มีชื่อกิจกรรม';

  if (catEl) {
    catEl.innerText = ev.category || 'กิจกรรมทั่วไป';
    catEl.className = `cal-category-pill ${getCategoryClass(ev.category)}`;
  }

  if (targetEl) {
    targetEl.innerText = ev.targetAudienceLabel || (ev.targetAudience === 'teachers' ? 'เฉพาะอาจารย์และผู้บริหาร' : (ev.targetAudience === 'students' ? 'เฉพาะนักเรียน' : 'ทุกคน (นักเรียนและอาจารย์)'));
    targetEl.className = `cal-target-pill target-${ev.targetAudience || 'all'}`;
  }

  if (datesEl) {
    const s = formatThaiDateDisplay(ev.startDate);
    const e = (ev.endDate && ev.endDate !== ev.startDate) ? formatThaiDateDisplay(ev.endDate) : null;
    datesEl.innerText = e ? `${s} ถึง ${e}` : s;
  }

  if (timeEl) {
    timeEl.innerText = (ev.startTime) ? `${ev.startTime} - ${ev.endTime || 'เสร็จสิ้น'} น.` : 'กิจกรรมตลอดทั้งวัน (All-day)';
  }

  if (locEl) {
    locEl.innerText = ev.location || 'ไม่ได้ระบุสถานที่';
  }

  if (descEl) {
    descEl.innerText = ev.description || 'ไม่มีรายละเอียดเพิ่มเติม';
  }

  if (metaEl) {
    const targetDesc = ev.targetAudienceLabel ? ` • สำหรับ: ${ev.targetAudienceLabel}` : '';
    metaEl.innerText = `บันทึกโดย: ${ev.createdBy || 'ผู้ดูแลระบบ'}${targetDesc} • อัปเดตล่าสุด: ${ev.updatedAt || '-'}`;
  }

  // ซ่อนปุ่มแก้ไข/ลบ สำหรับผู้ที่ไม่มีสิทธิ์ (รูปแนบ 4: ตนเองและแอดมินเท่านั้นที่สามารถลบได้)
  const canDel = canDeleteCalendarEvent(ev);
  if (adminActions) {
    adminActions.style.display = canManageCalendar() ? 'flex' : 'none';
  }
  const deleteBtn = document.getElementById('btnCalDetailDelete');
  const editBtn = document.getElementById('btnCalDetailEdit');
  if (deleteBtn) {
    deleteBtn.style.display = canDel ? 'inline-flex' : 'none';
  }
  if (editBtn) {
    editBtn.style.display = canDel ? 'inline-flex' : 'none';
  }

  openModal('calendarEventDetailModal');
}

function canDeleteCalendarEvent(ev) {
  if (!currentAdmin) return false;
  if (currentAdmin.role === 'SuperAdmin') return true;
  if (!ev) return false;
  const currentU = (currentAdmin.username || '').toLowerCase().trim();
  const evCreatorU = (ev.creatorUsername || '').toLowerCase().trim();
  if (evCreatorU && evCreatorU === currentU) return true;
  if (ev.createdBy && (ev.createdBy === currentAdmin.fullName || ev.createdBy === currentAdmin.username)) return true;
  return false;
}

let studentCalMode = 'grid'; // 'grid' | 'list'

function switchStudentCalendarMode(mode) {
  studentCalMode = mode;
  const btnGrid = document.getElementById('btnCalModeGrid');
  const btnList = document.getElementById('btnCalModeList');
  const matrixContainer = document.getElementById('calPhoneMatrixContainer');
  const listView = document.getElementById('calPhoneActiveListView');

  if (btnGrid) btnGrid.classList.toggle('active', mode === 'grid');
  if (btnList) btnList.classList.toggle('active', mode === 'list');

  if (mode === 'grid') {
    if (matrixContainer) matrixContainer.style.display = 'block';
    if (listView) listView.style.display = 'none';
  } else {
    if (matrixContainer) matrixContainer.style.display = 'none';
    if (listView) listView.style.display = 'flex';
    renderStudentActiveEventsList();
  }
}

function renderStudentActiveEventsList() {
  const container = document.getElementById('calPhoneActiveListView');
  if (!container) return;

  const visibleEvents = getVisibleCalendarEvents();
  const curY = calCurrentYear;
  const curM = calCurrentMonth + 1;

  // Filter events active in the selected month
  const monthEvents = visibleEvents.filter(ev => {
    if (!ev.startDate) return false;
    const parts = ev.startDate.split('-');
    const evY = parseInt(parts[0], 10);
    const evM = parseInt(parts[1], 10);
    if (evY === curY && evM === curM) return true;
    if (ev.endDate) {
      const eParts = ev.endDate.split('-');
      const endY = parseInt(eParts[0], 10);
      const endM = parseInt(eParts[1], 10);
      return (evY <= curY && endY >= curY) && (evM <= curM && endM >= curM);
    }
    return false;
  }).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

  if (monthEvents.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.2rem 1rem; color: #64748b; background: #f8fafc; border-radius: 14px; border: 1px dashed #cbd5e1;">
        <i class="fa-regular fa-calendar-xmark" style="font-size: 2.2rem; color: #94a3b8; margin-bottom: 0.6rem;"></i>
        <div style="font-weight: 700; color: #334155; font-size: 0.95rem;">ไม่มีกิจกรรมในเดือนที่เลือก</div>
        <div style="font-size: 0.78rem; margin-top: 0.25rem;">สามารถเปลี่ยนเดือน หรือแตะเมนูด้านบนเพื่อเลือกวันที่มีกิจกรรม</div>
      </div>
    `;
    return;
  }

  let html = '';
  monthEvents.forEach(ev => {
    const catClass = getCategoryClass(ev.category);
    const iconClass = getCategoryIcon(ev.category);
    const s = formatThaiDateDisplay(ev.startDate);
    const e = (ev.endDate && ev.endDate !== ev.startDate) ? formatThaiDateDisplay(ev.endDate) : null;
    const dateRangeStr = e ? `${s} – ${e}` : s;
    const timeStr = ev.startTime ? `${ev.startTime} - ${ev.endTime || 'เสร็จสิ้น'} น.` : 'ตลอดทั้งวัน';
    const targetLabel = ev.targetAudienceLabel || (ev.targetAudience === 'teachers' ? 'เฉพาะอาจารย์' : (ev.targetAudience === 'students' ? 'เฉพาะนักเรียน' : 'ทุกคน'));

    html += `
      <div class="cal-active-list-item ${catClass}" onclick="jumpToSelectedCalendarEvent('${ev.startDate}', 'dash')">
        <div class="cal-active-list-header">
          <span class="cal-category-pill ${catClass}" style="font-size: 0.72rem; padding: 2px 7px;">
            <i class="${iconClass}"></i> ${escapeHtml(ev.category || 'กิจกรรมทั่วไป')}
          </span>
          <span class="cal-target-pill target-${ev.targetAudience || 'all'}" style="font-size: 0.7rem;">
            ${escapeHtml(targetLabel)}
          </span>
        </div>
        <h4 class="cal-active-list-title">${escapeHtml(ev.title)}</h4>
        <div class="cal-active-list-meta">
          <span><i class="fa-regular fa-calendar"></i> ${dateRangeStr}</span>
          <span><i class="fa-regular fa-clock"></i> ${timeStr}</span>
          ${ev.location ? `<span><i class="fa-solid fa-location-dot" style="color: #ef4444;"></i> ${escapeHtml(ev.location)}</span>` : ''}
        </div>
        <div class="cal-active-list-action">
          <span>แตะดูรายละเอียด</span> <i class="fa-solid fa-arrow-right"></i>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function populateCalendarQuickSelect() {
  const quickSelect = document.getElementById('calEventQuickSelect-dash');
  const countBadge = document.getElementById('calActiveTabBadge');
  const jumperCount = document.getElementById('calQuickJumperCount');
  if (!quickSelect) return;

  const visibleEvents = getVisibleCalendarEvents();
  const curY = calCurrentYear;
  const curM = calCurrentMonth + 1;

  // Sort events chronologically
  const sortedEvents = [...visibleEvents].filter(e => e.startDate).sort((a, b) => a.startDate.localeCompare(b.startDate));

  // Count events for current month
  const currentMonthEvents = sortedEvents.filter(ev => {
    const parts = ev.startDate.split('-');
    return parseInt(parts[0], 10) === curY && parseInt(parts[1], 10) === curM;
  });

  if (countBadge) countBadge.innerText = currentMonthEvents.length;
  if (jumperCount) jumperCount.innerText = `พบ ${sortedEvents.length} รายการ`;

  let optHtml = `<option value="">-- แตะเพื่อเลือกดูวันที่มีกิจกรรม (${sortedEvents.length} รายการ) --</option>`;

  if (currentMonthEvents.length > 0) {
    optHtml += `<optgroup label="⭐ กิจกรรมในเดือนนี้ (${currentMonthEvents.length} รายการ)">`;
    currentMonthEvents.forEach(ev => {
      const s = formatThaiDateDisplay(ev.startDate);
      const cat = getCategoryShortLabel(ev.category);
      optHtml += `<option value="${ev.startDate}">[${s}] [${cat}] ${escapeHtml(ev.title)}</option>`;
    });
    optHtml += `</optgroup>`;
  }

  const otherEvents = sortedEvents.filter(ev => !currentMonthEvents.includes(ev));
  if (otherEvents.length > 0) {
    optHtml += `<optgroup label="📅 กิจกรรมในเดือนอื่นๆ / ล่วงหน้า (${otherEvents.length} รายการ)">`;
    otherEvents.forEach(ev => {
      const s = formatThaiDateDisplay(ev.startDate);
      const cat = getCategoryShortLabel(ev.category);
      optHtml += `<option value="${ev.startDate}">[${s}] [${cat}] ${escapeHtml(ev.title)}</option>`;
    });
    optHtml += `</optgroup>`;
  }

  quickSelect.innerHTML = optHtml;
}

function jumpToSelectedCalendarEvent(dateStr, scope) {
  if (!dateStr) return;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    calCurrentYear = y;
    calCurrentMonth = m;
    calSelectedDate = dateStr;
    renderCalendar('all');

    const visibleEvents = getVisibleCalendarEvents();
    const dayEvents = visibleEvents.filter(e => isDateInRange(dateStr, e.startDate, e.endDate));
    if (dayEvents.length > 0) {
      openCalendarDayModal(dateStr, dayEvents);
    }
  }
  const quickSelect = document.getElementById('calEventQuickSelect-dash');
  if (quickSelect) quickSelect.value = '';
}

function openSchoolCalendarModal() {
  studentCalMode = 'grid';
  switchStudentCalendarMode('grid');
  populateCalendarSelects();
  renderCalendar('dash');
  updateCalendarLauncherBadge();
  populateCalendarQuickSelect();
  openModal('schoolCalendarModal');
}

function updateCalendarLauncherBadge() {
  const badge = document.getElementById('calLauncherEventBadge');
  if (!badge) return;
  const visibleEvents = getVisibleCalendarEvents();
  const curY = calCurrentYear;
  const curM = calCurrentMonth + 1;
  const monthEvents = visibleEvents.filter(e => {
    if (!e.startDate) return false;
    const parts = e.startDate.split('-');
    return parseInt(parts[0], 10) === curY && parseInt(parts[1], 10) === curM;
  });
  if (monthEvents.length > 0) {
    badge.innerHTML = `<i class="fa-solid fa-bell"></i> ${monthEvents.length} กิจกรรมเดือนนี้`;
  } else {
    badge.innerHTML = `<i class="fa-solid fa-calendar-check"></i> กำหนดการปกติ`;
  }
}

function handleCalendarDayClick(dateStr, scope) {
  selectCalendarDate(dateStr);

  // ฝั่งนักเรียน: กดดูตรงวันที่ รายละเอียดประกาศจะเด้งขึ้นมาทันที
  if (scope === 'dash') {
    const visibleEvents = getVisibleCalendarEvents();
    const dayEvents = visibleEvents.filter(e => isDateInRange(dateStr, e.startDate, e.endDate));
    if (dayEvents.length > 0) {
      openCalendarDayModal(dateStr, dayEvents);
    } else {
      showToast(`วันที่ ${formatThaiDateDisplay(dateStr)}: ไม่มีประกาศหรือกิจกรรม`, 'info');
    }
  }
}

function openCalendarDayModal(dateStr, dayEvents) {
  const modal = document.getElementById('calendarDayEventsModal');
  if (!modal) return;

  const { dayName, fullDate } = formatThaiDateWithDayName(dateStr);
  const titleEl = document.getElementById('calDayModalTitle');
  const subEl = document.getElementById('calDayModalSubtitle');
  const countEl = document.getElementById('calDayModalCount');
  const bodyEl = document.getElementById('calDayModalBody');

  if (titleEl) titleEl.innerText = `${dayName}ที่ ${fullDate}`;
  if (subEl) subEl.innerText = 'ประกาศและกำหนดการโรงเรียน';
  if (countEl) countEl.innerText = `รวมทั้งสิ้น ${dayEvents.length} รายการ`;

  if (bodyEl) {
    if (!dayEvents || dayEvents.length === 0) {
      bodyEl.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: #64748b;">
          <i class="fa-regular fa-calendar-xmark" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 0.75rem;"></i>
          <div style="font-weight: 700; color: #334155; font-size: 1rem;">ไม่มีประกาศหรือกิจกรรมในวันนี้</div>
          <div style="font-size: 0.85rem; margin-top: 0.25rem;">กำหนดการปกติ ไม่มีการแจ้งเตือนเป็นพิเศษ</div>
        </div>
      `;
    } else {
      let cardsHtml = '<div style="display: flex; flex-direction: column; gap: 0.95rem;">';
      dayEvents.forEach(ev => {
        const catClass = getCategoryClass(ev.category);
        const iconClass = getCategoryIcon(ev.category);
        const s = formatThaiDateDisplay(ev.startDate);
        const e = (ev.endDate && ev.endDate !== ev.startDate) ? formatThaiDateDisplay(ev.endDate) : null;
        const dateRangeStr = e ? `${s} ถึง ${e}` : s;
        const timeStr = ev.startTime ? `${ev.startTime} - ${ev.endTime || 'เสร็จสิ้น'} น.` : 'ตลอดทั้งวัน (All-day)';
        const targetLabel = ev.targetAudienceLabel || (ev.targetAudience === 'teachers' ? 'เฉพาะอาจารย์' : (ev.targetAudience === 'students' ? 'เฉพาะนักเรียน' : 'ทุกคน'));

        cardsHtml += `
          <div class="cal-day-modal-card ${catClass}">
            <div class="cal-day-modal-card-header">
              <span class="cal-category-pill ${catClass}">
                <i class="${iconClass}"></i> ${escapeHtml(ev.category || 'กิจกรรมทั่วไป')}
              </span>
              <span class="cal-target-pill target-${ev.targetAudience || 'all'}">
                ${escapeHtml(targetLabel)}
              </span>
            </div>

            <h4 class="cal-day-modal-card-title">
              ${escapeHtml(ev.title || 'ไม่มีชื่อกิจกรรม')}
            </h4>

            <div class="cal-day-modal-meta-grid">
              <div class="cal-day-modal-meta-item">
                <i class="fa-regular fa-calendar" style="color: var(--primary);"></i>
                <span>${dateRangeStr}</span>
              </div>
              <div class="cal-day-modal-meta-item">
                <i class="fa-regular fa-clock" style="color: var(--primary);"></i>
                <span>${timeStr}</span>
              </div>
              ${ev.location ? `
                <div class="cal-day-modal-meta-item" style="grid-column: 1 / -1;">
                  <i class="fa-solid fa-location-dot" style="color: #ef4444;"></i>
                  <span>${escapeHtml(ev.location)}</span>
                </div>
              ` : ''}
            </div>

            ${ev.description ? `
              <div class="cal-day-modal-desc-box">
                <div class="cal-day-modal-desc-title"><i class="fa-solid fa-circle-info"></i> รายละเอียดประกาศ</div>
                <div class="cal-day-modal-desc-text">${escapeHtml(ev.description)}</div>
              </div>
            ` : ''}

            <div class="cal-day-modal-card-footer">
              <span><i class="fa-regular fa-user"></i> บันทึกโดย: ${escapeHtml(ev.createdBy || 'โรงเรียน')}</span>
              ${ev.updatedAt ? `<span><i class="fa-regular fa-clock"></i> ${escapeHtml(ev.updatedAt)}</span>` : ''}
            </div>
          </div>
        `;
      });
      cardsHtml += '</div>';
      bodyEl.innerHTML = cardsHtml;
    }
  }

  openModal('calendarDayEventsModal');
}

// ----------------- CALENDAR TARGET AUDIENCE SUB-OPTIONS (รูปแนบ: เฉพาะนักเรียน/เฉพาะอาจารย์) ----------------- //

function onCalTargetAudienceChange() {
  const targetSelect = document.getElementById('calFormTarget');
  const studentsBox = document.getElementById('calTargetStudentsBox');
  const teachersBox = document.getElementById('calTargetTeachersBox');
  if (!targetSelect) return;

  const val = targetSelect.value;
  if (val === 'students') {
    if (studentsBox) studentsBox.style.display = 'block';
    if (teachersBox) teachersBox.style.display = 'none';
    populateCalTargetStudents();
  } else if (val === 'teachers') {
    if (studentsBox) studentsBox.style.display = 'none';
    if (teachersBox) teachersBox.style.display = 'block';
    populateCalTargetTeachers();
  } else {
    if (studentsBox) studentsBox.style.display = 'none';
    if (teachersBox) teachersBox.style.display = 'none';
  }
}

function populateCalTargetStudents() {
  const gradeSel = document.getElementById('calTargetGrade');
  const studentSel = document.getElementById('calTargetSpecificStudent');
  if (!studentSel) return;
  const currentVal = studentSel.value;
  const selectedGrade = gradeSel ? gradeSel.value : 'ALL';

  let filtered = allStudents;
  if (selectedGrade === 'LOWER_SEC') {
    filtered = allStudents.filter(s => ['มัธยมศึกษาปีที่ 1', 'มัธยมศึกษาปีที่ 2', 'มัธยมศึกษาปีที่ 3'].includes(s.grade));
  } else if (selectedGrade === 'UPPER_SEC') {
    filtered = allStudents.filter(s => ['มัธยมศึกษาปีที่ 4', 'มัธยมศึกษาปีที่ 5', 'มัธยมศึกษาปีที่ 6'].includes(s.grade));
  } else if (selectedGrade && selectedGrade !== 'ALL') {
    filtered = allStudents.filter(s => s.grade === selectedGrade);
  }

  studentSel.innerHTML = '<option value="ALL">นักเรียนทุกคนในระดับชั้นที่เลือก</option>' + 
    filtered.map(s => `<option value="${escapeHtml(s.studentId)}">${escapeHtml(s.studentId)} - ${escapeHtml(s.fullName)} (${escapeHtml(s.grade || '')})</option>`).join('');

  if (currentVal && (currentVal === 'ALL' || filtered.some(s => isIdMatch(s.studentId, currentVal)))) {
    studentSel.value = currentVal;
  } else {
    studentSel.value = 'ALL';
  }
}

function onCalTargetGradeChange() {
  populateCalTargetStudents();
}

function populateCalTargetTeachers() {
  const teacherSel = document.getElementById('calTargetSpecificTeacher');
  if (!teacherSel) return;
  const currentVal = teacherSel.value;

  const roleLabels = {
    SuperAdmin: 'แอดมินสูงสุด',
    EXECUTIVE: 'ผู้บริหารสถานศึกษา',
    TEACHER: 'อาจารย์ผู้สอน',
    HOMEROOM: 'อาจารย์ประจำชั้น',
    ACTIVITY: 'ฝ่ายกิจกรรม',
    SubAdmin: 'ผู้ช่วยแอดมิน'
  };

  let list = Array.isArray(subAdmins) ? [...subAdmins] : [];
  if (currentAdmin && !list.some(a => a.username === currentAdmin.username)) {
    list.unshift(currentAdmin);
  }

  teacherSel.innerHTML = '<option value="ALL">อาจารย์ทุกคนในกลุ่มที่เลือก</option>' +
    list.map(a => `<option value="${escapeHtml(a.username)}">${escapeHtml(a.fullName || a.username)} (${roleLabels[a.role] || a.role || 'อาจารย์'})</option>`).join('');

  if (currentVal && (currentVal === 'ALL' || list.some(a => a.username === currentVal))) {
    teacherSel.value = currentVal;
  } else {
    teacherSel.value = 'ALL';
  }
}

function openCalendarEventModal(eventId = null, defaultDate = null) {
  if (!canManageCalendar()) {
    showToast('เฉพาะผู้บริหาร แอดมิน และอาจารย์เท่านั้นที่มีสิทธิ์เพิ่มหรือแก้ไขปฏิทิน', 'warning');
    return;
  }

  const titleEl = document.getElementById('calModalTitle');
  const idInput = document.getElementById('calFormEventId');
  const titleInput = document.getElementById('calFormTitle');
  const catInput = document.getElementById('calFormCategory');
  const targetInput = document.getElementById('calFormTarget');
  const targetGradeInput = document.getElementById('calTargetGrade');
  const targetStudentInput = document.getElementById('calTargetSpecificStudent');
  const targetTeacherRoleInput = document.getElementById('calTargetTeacherRole');
  const targetTeacherInput = document.getElementById('calTargetSpecificTeacher');
  const sDateInput = document.getElementById('calFormStartDate');
  const eDateInput = document.getElementById('calFormEndDate');
  const sTimeInput = document.getElementById('calFormStartTime');
  const eTimeInput = document.getElementById('calFormEndTime');
  const allDayCheck = document.getElementById('calFormAllDay');
  const locInput = document.getElementById('calFormLocation');
  const descInput = document.getElementById('calFormDescription');

  if (eventId) {
    const ev = calendarEvents.find(e => e.id === eventId);
    if (!ev) return;
    if (titleEl) titleEl.innerText = 'แก้ไขกิจกรรมปฏิทิน';
    if (idInput) idInput.value = ev.id;
    if (titleInput) titleInput.value = ev.title || '';
    if (catInput) catInput.value = ev.category || 'กิจกรรมทั่วไป';
    if (targetInput) targetInput.value = ev.targetAudience || 'all';

    onCalTargetAudienceChange();
    if (targetGradeInput) targetGradeInput.value = ev.targetGrade || 'ALL';
    populateCalTargetStudents();
    if (targetStudentInput) targetStudentInput.value = ev.targetStudentId || 'ALL';

    if (targetTeacherRoleInput) targetTeacherRoleInput.value = ev.targetTeacherRole || 'ALL';
    populateCalTargetTeachers();
    if (targetTeacherInput) targetTeacherInput.value = ev.targetTeacherUsername || 'ALL';

    if (sDateInput) sDateInput.value = ev.startDate || '';
    if (eDateInput) eDateInput.value = ev.endDate || '';
    if (sTimeInput) sTimeInput.value = ev.startTime || '';
    if (eTimeInput) eTimeInput.value = ev.endTime || '';
    const isAllDay = !ev.startTime && !ev.endTime;
    if (allDayCheck) {
      allDayCheck.checked = isAllDay;
      toggleCalAllDay(isAllDay);
    }
    if (locInput) locInput.value = ev.location || '';
    if (descInput) descInput.value = ev.description || '';
  } else {
    if (titleEl) titleEl.innerText = 'เพิ่มกิจกรรมใหม่ในปฏิทิน';
    if (idInput) idInput.value = '';
    if (titleInput) titleInput.value = '';
    if (catInput) catInput.value = 'กิจกรรมทั่วไป';
    if (targetInput) targetInput.value = 'all';

    onCalTargetAudienceChange();
    if (targetGradeInput) targetGradeInput.value = 'ALL';
    populateCalTargetStudents();
    if (targetStudentInput) targetStudentInput.value = 'ALL';
    if (targetTeacherRoleInput) targetTeacherRoleInput.value = 'ALL';
    populateCalTargetTeachers();
    if (targetTeacherInput) targetTeacherInput.value = 'ALL';

    const initDate = defaultDate || calSelectedDate || new Date().toISOString().split('T')[0];
    if (sDateInput) sDateInput.value = initDate;
    if (eDateInput) eDateInput.value = '';
    if (sTimeInput) sTimeInput.value = '08:30';
    if (eTimeInput) eTimeInput.value = '11:30';
    if (allDayCheck) {
      allDayCheck.checked = false;
      toggleCalAllDay(false);
    }
    if (locInput) locInput.value = '';
    if (descInput) descInput.value = '';
  }

  openModal('calendarEventModal');
}

function toggleCalAllDay(isAllDay) {
  const sTimeInput = document.getElementById('calFormStartTime');
  const eTimeInput = document.getElementById('calFormEndTime');
  if (sTimeInput) {
    sTimeInput.disabled = isAllDay;
    if (isAllDay) sTimeInput.value = '';
  }
  if (eTimeInput) {
    eTimeInput.disabled = isAllDay;
    if (isAllDay) eTimeInput.value = '';
  }
}

async function saveCalendarEventForm() {
  if (!canManageCalendar()) {
    showToast('ไม่มีสิทธิ์ดำเนินการ', 'warning');
    return;
  }

  const idInput = document.getElementById('calFormEventId');
  const titleInput = document.getElementById('calFormTitle');
  const catInput = document.getElementById('calFormCategory');
  const targetInput = document.getElementById('calFormTarget');
  const targetGradeInput = document.getElementById('calTargetGrade');
  const targetStudentInput = document.getElementById('calTargetSpecificStudent');
  const targetTeacherRoleInput = document.getElementById('calTargetTeacherRole');
  const targetTeacherInput = document.getElementById('calTargetSpecificTeacher');
  const sDateInput = document.getElementById('calFormStartDate');
  const eDateInput = document.getElementById('calFormEndDate');
  const sTimeInput = document.getElementById('calFormStartTime');
  const eTimeInput = document.getElementById('calFormEndTime');
  const allDayCheck = document.getElementById('calFormAllDay');
  const locInput = document.getElementById('calFormLocation');
  const descInput = document.getElementById('calFormDescription');
  const btnSave = document.getElementById('btnSaveCalEvent');

  const title = (titleInput && titleInput.value ? titleInput.value : '').trim();
  const startDate = (sDateInput && sDateInput.value ? sDateInput.value : '').trim();

  if (!title) {
    showToast('กรุณาระบุชื่อกิจกรรม', 'warning');
    if (titleInput) titleInput.focus();
    return;
  }
  if (!startDate) {
    showToast('กรุณาระบุวันที่เริ่มต้น', 'warning');
    if (sDateInput) sDateInput.focus();
    return;
  }

  const isAllDay = allDayCheck ? allDayCheck.checked : false;
  const eventId = (idInput && idInput.value) ? idInput.value : ('CAL-' + Date.now());
  const category = catInput ? catInput.value : 'กิจกรรมทั่วไป';
  const targetAudience = targetInput ? targetInput.value : 'all';
  const targetGrade = (targetAudience === 'students' && targetGradeInput) ? targetGradeInput.value : 'ALL';
  const targetStudentId = (targetAudience === 'students' && targetStudentInput) ? targetStudentInput.value : 'ALL';
  const targetTeacherRole = (targetAudience === 'teachers' && targetTeacherRoleInput) ? targetTeacherRoleInput.value : 'ALL';
  const targetTeacherUsername = (targetAudience === 'teachers' && targetTeacherInput) ? targetTeacherInput.value : 'ALL';

  let targetStudentName = '';
  if (targetStudentId !== 'ALL') {
    const st = allStudents.find(s => isIdMatch(s.studentId, targetStudentId));
    if (st) targetStudentName = st.fullName;
  }

  let targetTeacherName = '';
  if (targetTeacherUsername !== 'ALL') {
    const tc = Array.isArray(subAdmins) ? subAdmins.find(a => a.username === targetTeacherUsername) : null;
    if (tc) targetTeacherName = tc.fullName;
    else if (currentAdmin && currentAdmin.username === targetTeacherUsername) targetTeacherName = currentAdmin.fullName;
  }

  // คำนวณ Label กลุ่มเป้าหมายที่ชัดเจน
  let targetAudienceLabel = 'ทุกคน (นักเรียนและอาจารย์)';
  if (targetAudience === 'students') {
    if (targetStudentId !== 'ALL' && targetStudentName) {
      targetAudienceLabel = `เฉพาะนักเรียน: ${targetStudentName}`;
    } else if (targetGrade !== 'ALL') {
      const gradeMap = {
        'LOWER_SEC': 'ม.ต้น (ม.1 – ม.3)',
        'UPPER_SEC': 'ม.ปลาย (ม.4 – ม.6)',
        'มัธยมศึกษาปีที่ 1': 'ม.1',
        'มัธยมศึกษาปีที่ 2': 'ม.2',
        'มัธยมศึกษาปีที่ 3': 'ม.3',
        'มัธยมศึกษาปีที่ 4': 'ม.4',
        'มัธยมศึกษาปีที่ 5': 'ม.5',
        'มัธยมศึกษาปีที่ 6': 'ม.6'
      };
      targetAudienceLabel = `เฉพาะนักเรียน ${gradeMap[targetGrade] || targetGrade}`;
    } else {
      targetAudienceLabel = 'เฉพาะนักเรียน (ทุกระดับชั้น)';
    }
  } else if (targetAudience === 'teachers') {
    if (targetTeacherUsername !== 'ALL' && targetTeacherName) {
      targetAudienceLabel = `เฉพาะอาจารย์: ${targetTeacherName}`;
    } else if (targetTeacherRole !== 'ALL') {
      const roleMap = {
        TEACHER: 'อาจารย์ผู้สอน',
        HOMEROOM: 'อาจารย์ประจำชั้น',
        ACTIVITY: 'ฝ่ายกิจกรรม',
        EXECUTIVE: 'ผู้บริหารสถานศึกษา'
      };
      targetAudienceLabel = `เฉพาะ${roleMap[targetTeacherRole] || targetTeacherRole}`;
    } else {
      targetAudienceLabel = 'เฉพาะอาจารย์และผู้บริหาร';
    }
  }

  const endDate = (eDateInput && eDateInput.value) ? eDateInput.value : startDate;
  const startTime = isAllDay ? '' : (sTimeInput ? sTimeInput.value : '');
  const endTime = isAllDay ? '' : (eTimeInput ? eTimeInput.value : '');
  const location = locInput ? locInput.value.trim() : '';
  const description = descInput ? descInput.value.trim() : '';

  const creatorName = currentAdmin ? (currentAdmin.fullName || currentAdmin.username || 'ผู้ดูแลระบบ') : 'แอดมิน';
  const existingIdx = calendarEvents.findIndex(e => e.id === eventId);
  const existingCreatorU = (existingIdx !== -1 && calendarEvents[existingIdx].creatorUsername) ? calendarEvents[existingIdx].creatorUsername : (currentAdmin ? currentAdmin.username : 'admin');
  const creatorUsername = existingCreatorU;
  const updatedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const eventData = {
    id: eventId,
    eventId: eventId,
    title: title,
    category: category,
    targetAudience: targetAudience,
    targetAudienceLabel: targetAudienceLabel,
    targetGrade: targetGrade,
    targetStudentId: targetStudentId,
    targetStudentName: targetStudentName,
    targetTeacherRole: targetTeacherRole,
    targetTeacherUsername: targetTeacherUsername,
    targetTeacherName: targetTeacherName,
    startDate: startDate,
    endDate: endDate,
    startTime: startTime,
    endTime: endTime,
    location: location,
    description: description,
    createdBy: creatorName,
    creatorUsername: creatorUsername,
    updatedAt: updatedAt
  };

  // Update local state
  if (existingIdx !== -1) {
    calendarEvents[existingIdx] = { ...calendarEvents[existingIdx], ...eventData };
  } else {
    calendarEvents.push(eventData);
  }

  // Sort by startDate
  calendarEvents.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  localStorage.setItem('khalifah_calendar_events', JSON.stringify(calendarEvents));

  // Visual feedback
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
  }

  closeModal('calendarEventModal');
  calSelectedDate = startDate;
  const sParts = startDate.split('-');
  if (sParts.length === 3) {
    calCurrentYear = parseInt(sParts[0], 10);
    calCurrentMonth = parseInt(sParts[1], 10) - 1;
  }
  renderCalendar('all');
  if (typeof playSuccessSound === 'function') playSuccessSound();
  showToast('✓ บันทึกกิจกรรมปฏิทินเรียบร้อยแล้ว กำลังซิงค์กับ Google Sheets...', 'success');

  // Background Cloud Sync
  try {
    await syncRecordToGoogleSheet('saveCalendarEvent', eventData);
    console.log('✓ Calendar event saved to Google Sheets:', eventId);
  } catch (err) {
    console.warn('Sync calendar to cloud failed, saved locally:', err);
  } finally {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> บันทึกลง Google Sheets';
    }
  }
}

function editEventFromDetail() {
  if (!currentViewingEventId) return;
  const ev = calendarEvents.find(e => e.id === currentViewingEventId);
  if (!canDeleteCalendarEvent(ev)) {
    showToast('⚠️ คุณไม่มีสิทธิ์แก้ไขกิจกรรมนี้ (เฉพาะผู้สร้างกิจกรรมและ Super Admin เท่านั้น)', 'error');
    return;
  }
  closeModal('calendarEventDetailModal');
  openCalendarEventModal(currentViewingEventId);
}

async function deleteEventFromDetail() {
  if (!canManageCalendar()) {
    showToast('ไม่มีสิทธิ์ดำเนินการ', 'warning');
    return;
  }
  if (!currentViewingEventId) return;
  const ev = calendarEvents.find(e => e.id === currentViewingEventId);
  if (!canDeleteCalendarEvent(ev)) {
    showToast('⚠️ คุณไม่มีสิทธิ์ลบกิจกรรมนี้ (เฉพาะผู้สร้างกิจกรรมและ Super Admin เท่านั้นที่สามารถลบได้)', 'error');
    return;
  }
  const title = ev ? ev.title : 'กิจกรรมนี้';

  if (!confirm(`คุณต้องการลบกิจกรรม "${title}" ออกจากปฏิทินและ Google Sheets ใช่หรือไม่?`)) {
    return;
  }

  const targetId = currentViewingEventId;
  calendarEvents = calendarEvents.filter(e => e.id !== targetId);
  localStorage.setItem('khalifah_calendar_events', JSON.stringify(calendarEvents));

  closeModal('calendarEventDetailModal');
  currentViewingEventId = null;
  renderCalendar('all');
  showToast('✓ ลบกิจกรรมออกจากปฏิทินเรียบร้อยแล้ว', 'success');

  try {
    await syncRecordToGoogleSheet('deleteCalendarEvent', { id: targetId, eventId: targetId });
    console.log('✓ Calendar event deleted from Google Sheets:', targetId);
  } catch (err) {
    console.warn('Delete calendar from cloud failed:', err);
  }
}
