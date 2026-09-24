
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

  const photoSrc = record.photo || record.photoUrl;
  if (photoSrc && photoSrc.length > 50) {
    if (pPhoto) pPhoto.src = photoSrc;
    if (pPhotoWrap) pPhotoWrap.style.display = 'block';
  } else {
    if (pPhotoWrap) pPhotoWrap.style.display = 'none';
  }

  openModal('prayerDetailModal');
}

// ----------------- ENHANCED HASANAT INTERACTIVE CONTROLS ----------------- //

function switchHasanatSubTab(tabName) {
  const tabs = ['quran', 'memorize', 'sunnah'];
  tabs.forEach(t => {
    const content = document.getElementById(`subtab-${t}`);
    if (content) {
      content.style.display = (t === tabName) ? 'block' : 'none';
    }
  });

  const btnMap = {
    'quran': 'btnSubHasanatQuran',
    'memorize': 'btnSubHasanatMemorize',
    'sunnah': 'btnSubHasanatSunnah'
  };

  Object.keys(btnMap).forEach(k => {
    const btn = document.getElementById(btnMap[k]);
    if (btn) {
      if (k === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });

  if (tabName === 'memorize') {
    if (typeof renderSurahChecklist === 'function') {
      const searchInput = document.getElementById('searchSurahInput');
      renderSurahChecklist(searchInput ? searchInput.value : '');
    }
  } else if (tabName === 'sunnah') {
    if (typeof calculateDailySunnahRakaat === 'function') calculateDailySunnahRakaat(false);
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
  let allHasanat = {};
  try {
    allHasanat = JSON.parse(localStorage.getItem('khalifah_student_hasanat') || '{}');
  } catch (e) {
    allHasanat = {};
  }
  if (!allHasanat[studentId]) {
    allHasanat[studentId] = {
      studentId: studentId,
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
  if (!allHasanat[studentId].quran) {
    allHasanat[studentId].quran = { pagesToday: 0, currentPage: 0, juzCompleted: 0, stars: 0, khatamCount: 0 };
  }
  if (typeof allHasanat[studentId].quran.khatamCount !== 'number') {
    allHasanat[studentId].quran.khatamCount = (allHasanat[studentId].quran.juzCompleted >= 30) ? 1 : 0;
  }
  if (!allHasanat[studentId].memorization) {
    allHasanat[studentId].memorization = { count: 0, memorizedSurahs: [] };
  }
  if (!allHasanat[studentId].sunnah) {
    allHasanat[studentId].sunnah = { rawatib: {}, duhaRakaat: 0, witrRakaat: 3, tahajjudRakaat: 0, totalRakaat: 0 };
  }
  return allHasanat[studentId];
}

/**
 * บันทึกข้อมูลผลบุญลง LocalStorage และซิงค์ไปยัง Google Sheet
 */
function saveStudentHasanat(hasanatObj) {
  if (!hasanatObj || !hasanatObj.studentId) return;
  let allHasanat = {};
  try {
    allHasanat = JSON.parse(localStorage.getItem('khalifah_student_hasanat') || '{}');
  } catch (e) {
    allHasanat = {};
  }
  allHasanat[hasanatObj.studentId] = hasanatObj;
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
  if (mBadge) mBadge.innerText = `${h.memorization.count || 0}/114`;

  // 2. Memorization tab
  const memBadge = document.getElementById('memorizedSurahsBadge');
  if (memBadge) {
    memBadge.innerText = `ท่องจำได้ ${h.memorization.count || 0} / 114 ซูเราะห์`;
  }

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
}

function renderHasanatStarsShowcase(stars, currentPage, khatamCount = 0) {
  const showcase = document.getElementById('hasanatStarsShowcase');
  const badge = document.getElementById('hasanatJuzBadge');
  const percentText = document.getElementById('hasanatQuranPercentText');
  const kpiPage = document.getElementById('kpiQuranPageText');
  const kpiJuz = document.getElementById('kpiQuranJuzText');
  const kpiKhatam = document.getElementById('kpiQuranKhatamText');

  if (badge) {
    badge.innerText = `⭐ ${stars} ดาว (${stars}/30 ยุซ)`;
  }

  const curP = parseInt(currentPage) || 0;
  const pct = ((curP / 604) * 100).toFixed(1);

  if (percentText) {
    percentText.innerText = `${curP} / 604 หน้า (${pct}%) • ${stars} ยุซ`;
  }

  if (kpiPage) {
    kpiPage.innerHTML = `${curP} <span class="quran-kpi-sub">/ 604</span>`;
  }
  if (kpiJuz) {
    kpiJuz.innerHTML = `${stars} <span class="quran-kpi-sub">/ 30 ยุซ</span>`;
  }
  if (kpiKhatam) {
    kpiKhatam.innerHTML = `${khatamCount} <span class="quran-kpi-sub">ครั้ง</span>`;
  }

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
    khatamCount: khatamVal
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
          <span style="font-family: 'Traditional Arabic', serif; font-size: 1.1rem; color: #059669; direction: rtl;">${s.arabic}</span>
          <input type="checkbox" ${isMem ? 'checked' : ''} onclick="event.stopPropagation(); toggleSurahMemorized(${s.num})" style="cursor: pointer; width: 19px; height: 19px; accent-color: #059669;">
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

  renderSurahChecklist(document.getElementById('searchSurahInput') ? document.getElementById('searchSurahInput').value : '');
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
      tahajjudRakaat: tahajjud
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
    const photoSrc = p.photo || p.photoUrl;

    return `
      <div class="prayer-history-item prayer-history-card-clickable" onclick="openPrayerHistoryDetailModal('${cardId}')" title="แตะเพื่อดูรายละเอียดเต็มและพิกัดแผนที่" style="margin-bottom: 0.65rem;">
        <div style="display: flex; align-items: center; gap: 0.85rem; flex: 1; min-width: 220px;">
          ${(photoSrc && photoSrc.length > 50) ? `<img src="${photoSrc}" alt="Photo" style="width: 50px; height: 50px; object-fit: cover; border-radius: var(--radius-md); border: 1px solid var(--border-light);">` : `<div style="width: 50px; height: 50px; border-radius: var(--radius-md); background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 1.2rem;"><i class="fa-solid fa-mosque"></i></div>`}
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
  if (!currentStudent && !currentAdmin) {
    document.body.classList.add('auth-locked');
    openModal('authModal');
  }
}

const DEFAULT_LOGO_BASE64 = 'data:image/png;base64,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lo4PLIShPEydQd/73vf8zf7njk8tCP++qBuvvgItbHevtwWVpCSTuqhMBxxoIzNmvBynnrKdnQ/fcd4OJwPfPe3u+J4MH+y80MdplAbHHnuscdIsC6nREMKj5NefWR9OKvJStOmKazqajelBnpmCmg3NBpqP5qamjryb0R5xRwsybty40OwgKK/iU5BvfstbbJMPf9j23W+/0OwgpG6/ww7evlsifqTv7Uam3tM35ld7W82efuZZ+5arhpDmj/zUp+ztG7zDffJ//iJABwbNX64jnhsdBDTiCxp8r08AABAASURBVJoFnFcEGBj5tko5vQI/hBLe5LBLwhgUSb3Dej9qVTXF4kN4yoNEB1vP0d28r+1y8Uh8pRVNNEIT6wUYSMgn+ZUK4YkI1UrV+NgbdkkmFcQ96UDsxuCrt/VuuENSF692T3fmrFn28MMP2te/foldc9VV1trcNKCQAF9JMeh4BqznJRV5CuHFn0vOVMFOOAZVyolgeMEFF4TGijKSN/zrqXSTVO88X+1lGgMx7RaO7EA9InULU+dHUKjOKayEL8uOHaL+EdrQIqHRe/755+zf/37CtUuPxG5XNpbcfPP/xTQNA/lpp51qRx55hO237z62+2672e67724HHXSgnerufL379ttvj6/1wo+0SDjqwjUgpNfzvnRDoJDkAkhTTPsgcCBgjEID0twca0CqHRoQ3PkwImerLL/c8rbmGq+z9d6ynvE15+233972329/O/qoT9upXzjF+KDiZZddZuTtuuuvs9O/eLoRhqP4211raB1ASW6pOPl/p6akzFy7Z/7lGTPiC37f/d73bN9997Ptt9uOsiQtEAS8FhYI35HBNEuRCMwLAgyIaAVYXEqnKhWDdNnflea8pFGpVm3s2DExuEt9P89Slx/pkifWXJBHhBK+IcZZJwxS+EMIOnzwDXu7T31gkldJISRwP2bM6Ng+in9b25zQhGCXutJra2uz56c/b3/8wx+M3RwIQu9///uttXVU5Bs+1scVXFzYCG8XbMKs++kZl7RLb/woH+a0adPsnHPOibd+wuBWhsOUIiWsndQzTKfHXFqk3mk0YiUNHE4qwvSXR/woK98wor7ZJs2RGmwh/8c//mEcuHfnnXcaC5/ZaXPhhRfFMgkWt+6xxx6xABSTNSMnn3yyXXrpZfbTn/7M7r77Hhde/h1HuTc1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';

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
  initAppLogo();
  updateAdminUIVisibility(false);
  setupEventListeners();
  renderCurrentStudentProfile();
  renderDashboardCharts();
  renderActivitiesList();
  renderTodayPrayerTable();
  renderDashboardQuranStars();
  initHasanatView();
  renderPrayerHistory();
  initExportDateDefaults();
  enforceMandatoryLogin();

  // ตรวจสอบว่ามี #admin ใน URL หรือไม่
  if (window.location.hash === '#admin') {
    openModal('adminAuthModal');
  }
});

function loadStoredData() {
  // 1. Load current student (Clean start: null if legacy mock student or not logged in)
  const savedStudent = localStorage.getItem('khalifah_current_student');
  if (savedStudent) {
    try {
      const parsed = JSON.parse(savedStudent);
      // Purge any mock/dummy student IDs or sample names
      if (!parsed || parsed.studentId === 'STD-256901' || parsed.studentId === 'STD-256902' || (parsed.fullName && parsed.fullName.startsWith('นายมูฮัมหมัด ซอ'))) {
        localStorage.removeItem('khalifah_current_student');
        currentStudent = null;
      } else {
        currentStudent = parsed;
      }
    } catch (e) {
      currentStudent = null;
    }
  } else {
    currentStudent = null;
  }

  // 2. Load all students (Filter out dummy students)
  const savedAllStudents = localStorage.getItem('khalifah_all_students');
  if (savedAllStudents) {
    try {
      let parsed = JSON.parse(savedAllStudents);
      parsed = parsed.filter(s => s.studentId !== 'STD-256901' && s.studentId !== 'STD-256902' && s.studentId !== 'STD-256903');
      allStudents = parsed;
      localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
    } catch (e) {
      allStudents = [];
    }
  } else {
    allStudents = [];
  }

  // 3. Load activities (Clean start: empty)
  const savedActs = localStorage.getItem('khalifah_activities');
  if (savedActs) {
    try {
      let parsed = JSON.parse(savedActs);
      parsed = parsed.filter(a => a.activityId !== 'ACT-101' && a.activityId !== 'ACT-102');
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
  // Enforce login for students before switching views (except when admin is logged in)
  if (!currentStudent && !currentAdmin && viewName !== 'dashboard') {
    showToast('กรุณาเข้าสู่ระบบนักเรียนก่อนเริ่มใช้งาน', 'warning');
    enforceMandatoryLogin();
    return;
  }
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
  } else if (viewName === 'hasanat') {
    initHasanatView();
  } else if (viewName === 'prayer') {
    renderPrayerHistory();
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
    startQrScanner();
    renderStudentActivitiesHistory();
  } else if (viewName === 'admin') {
    renderAdminStudentsTable();
    renderSubAdminsTable();
    populateGradingSubjectSelect();
  }

  if (viewName !== 'activities') {
    stopQrScanner();
  }
  if (viewName !== 'prayer') {
    stopCameraStream();
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

  statusTitle.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบพิกัดความถูกต้อง...';
  statusDesc.innerText = 'กำลังคำนวณตำแหน่งผ่านสัญญาณดาวเทียม GPS กรุณารอสักครู่';

  const btnCenter = document.getElementById('btnCenterVerifyGeo');
  if (btnCenter) {
    btnCenter.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบพิกัด...';
    btnCenter.disabled = true;
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

      // ซ่อน Overlay กลางกล้อง และเปิดกล้องทันที
      const centerOverlay = document.getElementById('camCenterActionOverlay');
      if (centerOverlay) centerOverlay.style.display = 'none';

      initLiveCamera();

      // แสดงผล UI
      if (statusBox) {
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
      }

      if (detailsDiv) {
        detailsDiv.style.display = 'block';
        detailsDiv.innerHTML = `พิกัดปัจจุบัน: ${userLat.toFixed(6)}, ${userLng.toFixed(6)} | แม่นยำ: ±${Math.round(accuracy)}ม. ${isMockSuspected ? '⚠️ กรุณาปิด Mock Location' : '✓ ตรวจสอบผ่าน'}`;
      }

      showToast(`ระบุพิกัดสำเร็จ: ${isWithinZone ? 'อยู่ในพื้นที่' : 'อยู่นอกพื้นที่'}`, isWithinZone ? 'success' : 'warning');
      checkPrayerUnlockState();

      // ปลดล็อกปุ่มถ่ายรูปละหมาดทันที
      const btnCapture = document.getElementById('btnCaptureInstant');
      if (btnCapture) {
        btnCapture.disabled = false;
        btnCapture.classList.remove('btn-locked');
        btnCapture.innerHTML = '<i class="fa-solid fa-camera"></i> ถ่ายรูปเช็คชื่อละหมาดทันที';
      }
    },
    (error) => {
      if (statusTitle) statusTitle.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ไม่สามารถเข้าถึงพิกัด GPS ได้';
      if (statusDesc) statusDesc.innerText = 'กรุณาอนุญาตให้เบราว์เซอร์เข้าถึง Location/GPS บนอุปกรณ์ของท่าน';
      showToast('ไม่สามารถดึงพิกัดได้: ' + error.message, 'error');

      if (btnCenter) {
        btnCenter.disabled = false;
        btnCenter.innerHTML = '<i class="fa-solid fa-rotate-right"></i> ลองตรวจสอบพิกัดอีกครั้ง';
      }

      const btnCapture = document.getElementById('btnCaptureInstant');
      if (btnCapture) {
        btnCapture.disabled = true;
        btnCapture.classList.add('btn-locked');
        btnCapture.innerHTML = '<i class="fa-solid fa-lock"></i> กดตรวจสอบพิกัดที่กลางกล้องก่อนถ่ายรูป';
      }
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
function captureAndSavePrayerInstant() {
  if (!currentStudent) {
    showToast('กรุณาเข้าสู่ระบบนักเรียนก่อนเช็คชื่อละหมาด', 'warning');
    openModal('authModal');
    return;
  }

  if (!selectedPrayerTime) {
    // Default to the first unfinished prayer time or Subh
    selectedPrayerTime = 'ซุบฮิ';
    selectPrayerTime('ซุบฮิ', document.getElementById('ptime-ซุบฮิ'));
  }

  // Strict Geofence check: cannot capture without verified location
  if (!verifiedLocation) {
    showToast('กรุณากดปุ่ม "ตรวจสอบตำแหน่งปัจจุบัน" ด้านบนก่อนถ่ายรูป', 'warning');
    return;
  }

  const video = document.getElementById('cameraStream');
  const canvas = document.getElementById('snapshotCanvas');

  if (!video || !video.videoWidth) {
    showToast('กำลังเชื่อมต่อกล้องถ่ายรูป กรุณาลองใหม่อีกครั้ง', 'warning');
    initLiveCamera();
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');

  // Draw camera frame with correct mirroring
  if (currentFacingMode === 'user') {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
  } else {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
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

  // Save prayer record
  const prayerRecord = {
    id: 'PRY-' + Date.now(),
    studentId: currentStudent.studentId,
    studentName: currentStudent.fullName,
    grade: currentStudent.grade,
    prayerName: selectedPrayerTime,
    status: prayerStatus,
    note: prayerNote,
    timestamp: now.toISOString(),
    locationName: accurateLocName,
    isWithinZone: verifiedLocation ? verifiedLocation.isWithinZone : false,
    lat: verifiedLocation ? verifiedLocation.lat : null,
    lng: verifiedLocation ? verifiedLocation.lng : null,
    photo: photoBase64
  };

  // Replace or add today's prayer for this time
  const existingIdx = todayPrayers.findIndex(p => p.studentId === currentStudent.studentId && p.prayerName === selectedPrayerTime);
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
  localStorage.setItem('khalifah_prayer_history', JSON.stringify(historyList.slice(0, 100)));

  // Update UI Chip
  const chipEl = document.getElementById(`ptime-${selectedPrayerTime}`);
  if (chipEl) {
    chipEl.classList.add('done');
    const statusEl = document.getElementById(`pstatus-${selectedPrayerTime}`);
    if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-check"></i> เช็คแล้ว';
  }

  renderTodayPrayerTable();
  renderDashboardCharts();
  renderCurrentStudentProfile();

  // Play beep sound
  playSuccessSound();

  if (document.getElementById('prayerNoteInput')) {
    document.getElementById('prayerNoteInput').value = '';
  }
  renderPrayerHistory();
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

  const myHistory = historyList.filter(p => p.studentId === currentStudent.studentId);

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
              <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-dark);">ละหมาด: ${p.prayerName}</div>
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

let selectedPrayerNoteTimeSlot = null;

function selectPrayerNoteTime(time) {
  selectedPrayerNoteTimeSlot = time;
  document.querySelectorAll('.prayer-note-time-chip').forEach(chip => {
    if (chip.getAttribute('data-time') === time) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });

  const selectedTextEl = document.getElementById('prayerNoteTimeSelectedText');
  if (selectedTextEl) {
    selectedTextEl.innerHTML = `<span style="color: #059669; font-weight: 700;"><i class="fa-solid fa-check"></i> เลือก: ${time}</span>`;
  }
}

function savePrayerNoteOnly() {
  if (!currentStudent) {
    showToast('กรุณาเข้าสู่ระบบนักเรียนก่อนบันทึก', 'warning');
    enforceMandatoryLogin();
    return;
  }

  if (!selectedPrayerNoteTimeSlot) {
    showToast('⚠️ กรุณาเลือกเวลาละหมาดก่อนบันทึกหมายเหตุ (ซุบฮิ, ซุฮริ, อัศรฺ, มัฆริบ, อีชาอ์)', 'warning');
    const groupEl = document.querySelector('.prayer-time-select-group');
    if (groupEl) {
      groupEl.style.outline = '2px solid #ef4444';
      groupEl.style.borderRadius = '12px';
      groupEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { groupEl.style.outline = 'none'; }, 2200);
    }
    return;
  }

  const pTime = selectedPrayerNoteTimeSlot;
  const noteInput = document.getElementById('prayerNoteInput');
  const prayerNote = noteInput ? noteInput.value.trim() : '';

  const prayerStatus = prayerNote ? `ตรงเวลา (${prayerNote})` : 'ตรงเวลา';
  const locName = (verifiedLocation && verifiedLocation.locationName) ? verifiedLocation.locationName : 'มัสยิด / สถานที่ละหมาด';

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString('th-TH');

  const existingIdx = todayPrayers.findIndex(p => p.studentId === currentStudent.studentId && p.prayerTime === pTime && p.date === dateStr);

  const prayerRecord = {
    logId: existingIdx !== -1 ? todayPrayers[existingIdx].logId : ('PRY-' + Date.now()),
    studentId: currentStudent.studentId,
    studentName: currentStudent.fullName,
    grade: currentStudent.grade,
    prayerTime: pTime,
    status: prayerStatus,
    note: prayerNote,
    timestamp: now.toISOString(),
    date: dateStr,
    time: timeStr,
    latitude: verifiedLocation ? verifiedLocation.lat : 6.78652,
    longitude: verifiedLocation ? verifiedLocation.lng : 101.24641,
    locationName: locName,
    distanceMeters: verifiedLocation ? verifiedLocation.distanceMeters : 0,
    isWithinZone: verifiedLocation ? verifiedLocation.isWithinZone : true,
    photoUrl: existingIdx !== -1 ? todayPrayers[existingIdx].photoUrl : ''
  };

  if (existingIdx !== -1) {
    todayPrayers[existingIdx] = prayerRecord;
  } else {
    todayPrayers.unshift(prayerRecord);
  }

  localStorage.setItem('khalifah_today_prayers', JSON.stringify(todayPrayers));

  let historyList = [];
  try {
    historyList = JSON.parse(localStorage.getItem('khalifah_prayer_history') || '[]');
  } catch (e) { historyList = []; }
  const histIdx = historyList.findIndex(p => p.studentId === currentStudent.studentId && p.prayerTime === pTime && p.date === dateStr);
  if (histIdx !== -1) {
    historyList[histIdx] = prayerRecord;
  } else {
    historyList.unshift(prayerRecord);
  }
  localStorage.setItem('khalifah_prayer_history', JSON.stringify(historyList));

  const prayerCard = document.getElementById(`ptime-${pTime}`);
  if (prayerCard) {
    prayerCard.classList.add('done');
    const statusSpan = document.getElementById(`pstatus-${pTime}`);
    if (statusSpan) statusSpan.innerText = '✓ บันทึกแล้ว';
  }

  // Clear note input after saving
  if (noteInput) noteInput.value = '';

  renderTodayPrayerTable();
  renderPrayerHistory();
  renderDashboardCharts();

  syncRecordToGoogleSheet('recordPrayer', prayerRecord);

  playSuccessSound();
  showToast(`บันทึกหมายเหตุการละหมาดเวลา ${pTime} เรียบร้อยแล้ว (บันทึกลงฐานข้อมูลแล้ว)`, 'success');
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
  const ctx = document.getElementById('skillRadarChart');
  if (!ctx) return;

  if (skillChartInstance) skillChartInstance.destroy();

  loadAppSubjects();

  const labels = appSubjects.map(s => formatRadarLabelMultiLine(s.name));
  const dataScores = appSubjects.map(s => {
    if (currentStudent && currentStudent.skills) {
      if (currentStudent.skills[s.id] !== undefined) {
        return currentStudent.skills[s.id];
      }
      // fallback for old keys
      if (s.id === 'religious' && currentStudent.skills.religious !== undefined) return currentStudent.skills.religious;
      if (s.id === 'science' && currentStudent.skills.science !== undefined) return currentStudent.skills.science;
      if (s.id === 'math' && currentStudent.skills.math !== undefined) return currentStudent.skills.math;
      if (s.id === 'language' && currentStudent.skills.language !== undefined) return currentStudent.skills.language;
      if (s.id === 'social' && currentStudent.skills.social !== undefined) return currentStudent.skills.social;
      if (s.id === 'tech' && currentStudent.skills.tech !== undefined) return currentStudent.skills.tech;
    }
    return 75; // Default competency baseline
  });

  skillChartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'ระดับสมรรถนะทักษะ (คะแนนเต็ม 100)',
        data: dataScores,
        backgroundColor: 'rgba(2, 132, 199, 0.22)',
        borderColor: '#0284c7',
        borderWidth: 2.5,
        pointBackgroundColor: '#0369a1',
        pointBorderColor: '#ffffff',
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: '#0369a1',
        pointRadius: 4.5
      }]
    },
    options: {
      animation: {
        duration: 1400,
        easing: 'easeOutQuart'
      },
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 12, bottom: 12, left: 20, right: 20 }
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { stepSize: 25, display: false },
          pointLabels: {
            font: { family: 'Kanit', size: 10.5, weight: '600' },
            color: '#1e293b',
            padding: 8
          },
          grid: { color: 'rgba(203, 213, 225, 0.85)' },
          angleLines: { color: 'rgba(203, 213, 225, 0.85)' }
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

  // คำนวณตามจริงของนักเรียนที่ล็อกอิน
  const myTodayCount = currentStudent ? todayPrayers.filter(p => p.studentId === currentStudent.studentId).length : 0;
  const barData = currentStudent ? [0, 0, 0, 0, 0, 0, myTodayCount] : [0, 0, 0, 0, 0, 0, 0];

  prayerChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'],
      datasets: [{
        label: 'จำนวนเวลาที่ละหมาด (เต็ม 5)',
        data: barData,
        backgroundColor: '#0284c7',
        borderRadius: 8
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
    if (currentStudent.avatarUrl) {
      headerAvatar.innerHTML = `<img src="${currentStudent.avatarUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
      headerAvatar.innerText = currentStudent.fullName.charAt(currentStudent.fullName.startsWith('นาย') ? 3 : (currentStudent.fullName.startsWith('นางสาว') ? 6 : 0));
    }
  }

  const bannerAvatar = document.getElementById('dashBannerAvatar');
  if (bannerAvatar) {
    if (currentStudent.avatarUrl) {
      bannerAvatar.innerHTML = `<img src="${currentStudent.avatarUrl}" alt="${currentStudent.fullName}">`;
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

  // Real stats calculation
  const myPrayersToday = todayPrayers.filter(p => p.studentId === currentStudent.studentId);
  const myActs = activities.filter(a => a.checkedIn);
  const att = currentStudent.attendance || { present: 0, late: 0, leave: 0, absent: 0 };
  const totalDays = att.present + att.late + att.leave + att.absent;
  const attRate = totalDays > 0 ? ((att.present / totalDays) * 100).toFixed(1) + '%' : '0%';

  if (statAtt) statAtt.innerText = attRate;
  if (statPry) statPry.innerText = `${myPrayersToday.length} / 5`;
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
    if (currentStudent.avatarUrl) {
      profAvatar.innerHTML = `<img src="${currentStudent.avatarUrl}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      profAvatar.innerText = headerAvatar ? headerAvatar.innerText : 'น';
    }
  }
  if (selectNewGrade) selectNewGrade.value = currentStudent.grade;

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
  if (currentStudent) {
    openStudentAccountModal();
  } else {
    openModal('authModal');
  }
}

function openStudentAccountModal() {
  if (!currentStudent) return;
  const nameEl = document.getElementById('accSheetFullName');
  const detailsEl = document.getElementById('accSheetDetails');
  const avatarEl = document.getElementById('accSheetAvatar');

  if (nameEl) nameEl.innerText = currentStudent.fullName;
  if (detailsEl) detailsEl.innerText = `รหัส: ${currentStudent.studentId} • ${currentStudent.grade} • ${currentStudent.schoolName || ''}`;
  if (avatarEl) {
    if (currentStudent.avatarUrl) {
      avatarEl.innerHTML = `<img src="${currentStudent.avatarUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
      avatarEl.innerHTML = `<i class="fa-solid fa-user"></i>`;
    }
  }
  openModal('studentAccountModal');
}

function studentLogout() {
  if (!confirm('ต้องการออกจากระบบนักเรียนใช่หรือไม่?')) return;
  currentStudent = null;
  localStorage.removeItem('khalifah_current_student');
  closeModal('studentAccountModal');
  renderCurrentStudentProfile();
  renderDashboardCharts();
  renderActivitiesList();
  renderTodayPrayerTable();
  switchView('dashboard');
  showToast('ออกจากระบบนักเรียนเรียบร้อยแล้ว', 'info');
  document.body.classList.add('auth-locked');
  toggleAuthForm('login');
  openModal('authModal');
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

function toggleAuthForm(formType) {
  const loginSection = document.getElementById('loginFormSection');
  const regSection = document.getElementById('registerFormSection');
  const title = document.getElementById('authModalTitle');

  if (formType === 'register') {
    loginSection.style.display = 'none';
    regSection.style.display = 'block';
    title.innerText = 'ลงทะเบียนนักเรียนใหม่';
    initBirthDatePicker();
  } else {
    loginSection.style.display = 'block';
    regSection.style.display = 'none';
    title.innerText = 'เข้าสู่ระบบนักเรียน';
  }
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

  // Populate days 1-31 if not already populated
  if (daySelect.options.length <= 1) {
    for (let d = 1; d <= 31; d++) {
      const opt = document.createElement('option');
      const val = String(d).padStart(2, '0');
      opt.value = val;
      opt.textContent = `${d}`;
      daySelect.appendChild(opt);
    }
  }

  // Populate Buddhist years (พ.ศ.) 2568 down to 2530
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
  const summaryBadge = document.getElementById('birthDateSummaryBadge');

  if (!daySelect || !monthSelect || !yearSelect || !hiddenInput) return;

  const d = daySelect.value;
  const m = monthSelect.value;
  const y = yearSelect.value;

  // Visual selection indicator
  [daySelect, monthSelect, yearSelect].forEach(sel => {
    if (sel.value) sel.classList.add('selected');
    else sel.classList.remove('selected');
  });

  // Smart day adjustment based on selected month & leap year
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

    const mIdx = parseInt(m, 10);
    const monthName = THAI_MONTH_NAMES_LIST[mIdx] || m;
    const formattedThaiDate = `${parseInt(cleanDay, 10)} ${monthName} ${y}`;

    if (previewText) previewText.textContent = formattedThaiDate;
    if (codeBadge) codeBadge.textContent = bdCode;
    if (pill) pill.style.display = 'inline-flex';
    if (defaultHint) defaultHint.style.display = 'none';
    if (summaryBadge) {
      summaryBadge.textContent = `พ.ศ. ${y}`;
      summaryBadge.style.display = 'inline-block';
    }
  } else {
    hiddenInput.value = '';
    if (pill) pill.style.display = 'none';
    if (defaultHint) defaultHint.style.display = 'flex';
    if (summaryBadge) summaryBadge.style.display = 'none';
  }
}

function resetBirthDatePicker() {
  const daySelect = document.getElementById('regBirthDay');
  const monthSelect = document.getElementById('regBirthMonth');
  const yearSelect = document.getElementById('regBirthYear');
  const hiddenInput = document.getElementById('regBirthDate');
  const pill = document.getElementById('birthDateSelectedPill');
  const defaultHint = document.getElementById('birthDateDefaultHint');
  const summaryBadge = document.getElementById('birthDateSummaryBadge');

  if (daySelect) { daySelect.value = ''; daySelect.classList.remove('selected'); }
  if (monthSelect) { monthSelect.value = ''; monthSelect.classList.remove('selected'); }
  if (yearSelect) { yearSelect.value = ''; yearSelect.classList.remove('selected'); }
  if (hiddenInput) hiddenInput.value = '';
  if (pill) pill.style.display = 'none';
  if (defaultHint) defaultHint.style.display = 'flex';
  if (summaryBadge) summaryBadge.style.display = 'none';
}

async function handleStudentLogin() {
  const parentPhoneInput = (document.getElementById('loginParentPhone')?.value || '').trim();
  const studentIdInput = (document.getElementById('loginStudentId')?.value || '').trim();

  if (!parentPhoneInput || !studentIdInput) {
    showToast('กรุณากรอกเบอร์โทรศัพท์ผู้ปกครอง (User) และรหัสนักเรียน (รหัสผ่าน)', 'warning');
    return;
  }

  const cleanInputPhone = parentPhoneInput.replace(/[^0-9]/g, '');

  let found = allStudents.find(s => {
    const cleanSPhone = String(s.parentPhone || '').replace(/[^0-9]/g, '');
    const sId = String(s.studentId || '').trim().toLowerCase();
    const matchId = (sId === studentIdInput.toLowerCase());
    const matchPhone = (cleanSPhone === cleanInputPhone || String(s.parentPhone || '').trim() === parentPhoneInput);
    return matchId && matchPhone;
  });

  if (!found) {
    // If not found in local device, check Google Sheets backend
    const url = gasApiUrl || localStorage.getItem('khalifah_gas_url');
    if (url && !url.includes('docs.google.com/spreadsheets')) {
      showToast('กำลังค้นหาข้อมูลนักเรียนจากฐานข้อมูลกลาง...', 'info');
      try {
        const resp = await fetch(`${url}?action=getStudent&studentId=${encodeURIComponent(studentIdInput)}&parentPhone=${encodeURIComponent(cleanInputPhone)}`);
        const json = await resp.json();
        if (json && json.success && json.student) {
          const remoteStudent = json.student;
          const cleanRemotePhone = String(remoteStudent.parentPhone || '').replace(/[^0-9]/g, '');
          const remoteId = String(remoteStudent.studentId || '').trim().toLowerCase();
          if (remoteId === studentIdInput.toLowerCase() && (cleanRemotePhone === cleanInputPhone || String(remoteStudent.parentPhone || '').trim() === parentPhoneInput)) {
            found = remoteStudent;
            const existIdx = allStudents.findIndex(s => s.studentId.toLowerCase() === studentIdInput.toLowerCase());
            if (existIdx !== -1) {
              allStudents[existIdx] = found;
            } else {
              allStudents.push(found);
            }
            localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
          }
        }
      } catch (e) {
        console.warn('Remote student lookup failed:', e);
      }
    }
  }

  if (found) {
    currentStudent = found;
    localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
    renderCurrentStudentProfile();
    renderDashboardCharts();
    renderTodayPrayerTable();
    renderActivitiesList();
    renderPrayerHistory();
    document.body.classList.remove('auth-locked');
    closeModal('authModal');
    showToast(`ยินดีต้อนรับ ${currentStudent.fullName}`, 'success');
  } else {
    showToast('เบอร์โทรศัพท์ผู้ปกครอง (User) หรือรหัสนักเรียน (รหัสผ่าน) ไม่ถูกต้อง', 'error');
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
    showToast('กรุณากรอกข้อมูลให้ครบถ้วน และเลือกวันเดือนปีเกิด', 'warning');
    return;
  }

  const cleanBD = birthDate.replace(/[^0-9]/g, '');
  if (cleanBD.length !== 8) {
    showToast('กรุณาเลือกวัน เดือน และปี พ.ศ. เกิดให้ครบถ้วน', 'warning');
    return;
  }

  const day = parseInt(cleanBD.substring(0, 2), 10);
  const month = parseInt(cleanBD.substring(2, 4), 10);
  const year = parseInt(cleanBD.substring(4, 8), 10);

  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2450 || year > 2600) {
    showToast('วันเดือนปีเกิดไม่ถูกต้อง กรุณาเลือกใหม่', 'warning');
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
    birthDate: cleanBD, // บันทึกเป็น 8 หลัก เช่น 01012540
    parentPhone: parentPhone,
    status: 'Active',
    registeredAt: new Date().toISOString(),
    avatarUrl: registerAvatarBase64 || '',
    skills: { religious: 0, science: 0, math: 0, language: 0, social: 0, tech: 0 },
    gpa: '0.00',
    attendance: { present: 0, late: 0, leave: 0, absent: 0 }
  };

  allStudents.push(newStudent);
  localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));

  currentStudent = newStudent;
  localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));

  // Reset register avatar and birthdate picker
  registerAvatarBase64 = '';
  const preview = document.getElementById('regAvatarPreview');
  if (preview) {
    preview.innerHTML = '<i class="fa-solid fa-camera"></i>';
  }
  resetBirthDatePicker();

  renderCurrentStudentProfile();
  renderDashboardCharts();
  document.body.classList.remove('auth-locked');
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

function updateAdminUIVisibility(isAdmin) {
  const navAdmin = document.getElementById('nav-admin');
  const mNavAdmin = document.getElementById('m-nav-admin');
  const btnSettings = document.getElementById('btnSettingsHeader');
  const btnTabLogo = document.getElementById('btnTabLogo');

  if (navAdmin) navAdmin.style.display = isAdmin ? 'inline-flex' : 'none';
  if (mNavAdmin) mNavAdmin.style.display = isAdmin ? 'flex' : 'none';
  if (btnSettings) btnSettings.style.display = isAdmin ? 'flex' : 'none';
  if (btnTabLogo) {
    btnTabLogo.style.display = (isAdmin && currentAdmin && currentAdmin.role === 'SuperAdmin') ? 'inline-block' : 'none';
  }
}

function handleAdminLogin() {
  const pass = document.getElementById('adminPassInput').value.trim();
  const user = document.getElementById('subAdminUserInput').value.trim();

  if (pass === MASTER_ADMIN_PASS) {
    currentAdmin = { username: 'MasterAdmin', role: 'SuperAdmin' };
    updateAdminUIVisibility(true);
    closeModal('adminAuthModal');
    switchView('admin');
    showToast('เข้าสู่ระบบผู้ดูแลระบบหลักสำเร็จ', 'success');
    return;
  }

  // ตรวจสอบแอดมินรอง
  const foundSub = subAdmins.find(s => s.username === user && s.password === pass);
  if (foundSub) {
    currentAdmin = foundSub;
    updateAdminUIVisibility(true);
    closeModal('adminAuthModal');
    switchView('admin');
    showToast(`เข้าสู่ระบบแอดมินรอง: ${foundSub.fullName}`, 'success');
    return;
  }

  showToast('รหัสผ่านหรือชื่อผู้ใช้ไม่ถูกต้อง', 'error');
}

function adminLogout() {
  currentAdmin = null;
  updateAdminUIVisibility(false);
  switchView('dashboard');
  showToast('ออกจากระบบแอดมินแล้ว', 'info');
}

// ทางลัดสำหรับคุณครู/แอดมิน: คลิกโลโก้ 3 ครั้งเปิดหน้าต่างใส่รหัสแอดมินทันที
let brandClickCount = 0;
let brandClickTimer = null;
function handleBrandLogoClick() {
  brandClickCount++;
  if (brandClickCount === 1) {
    brandClickTimer = setTimeout(() => {
      brandClickCount = 0;
      switchView('dashboard');
    }, 600);
  } else if (brandClickCount >= 3) {
    clearTimeout(brandClickTimer);
    brandClickCount = 0;
    openModal('adminAuthModal');
  }
}

function switchAdminTab(tabName, element) {
  document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.admin-content-tab').forEach(tab => tab.style.display = 'none');

  if (element) element.classList.add('active');
  const target = document.getElementById(`admin-tab-${tabName}`);
  if (target) target.style.display = 'block';

  if (tabName === 'grading') {
    populateGradingSubjectSelect();
    renderGradingStudentsTable();
  } else if (tabName === 'subjects') {
    renderAdminSubjectsTable();
  } else if (tabName === 'subadmins') {
    renderSubAdminsTable();
    populateGradingSubjectSelect();
  } else if (tabName === 'students') {
    renderAdminStudentsTable();
  }
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
  const hasanat = getStudentHasanat(student.studentId);
  const qStars = (hasanat && hasanat.quran && hasanat.quran.stars) || 0;
  const qJuz = (hasanat && hasanat.quran && hasanat.quran.juzCompleted) || 0;
  const qPage = (hasanat && hasanat.quran && hasanat.quran.currentPage) || 0;
  const memCount = (hasanat && hasanat.memorization && hasanat.memorization.count) || 0;
  const sunnahRakaat = (hasanat && hasanat.sunnah && hasanat.sunnah.totalRakaat) || 0;

  content.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.2rem;">
      <div><b>โรงเรียน:</b> ${student.schoolName}</div>
      <div><b>ระดับชั้น:</b> ${student.grade}</div>
      <div><b>วันเดือนปีเกิด:</b> ${student.birthDate}</div>
      <div><b>เบอร์โทรผู้ปกครอง:</b> ${student.parentPhone}</div>
      <div><b>เกรดเฉลี่ย (GPA):</b> ${student.gpa || '-'}</div>
      <div><b>สถานะ:</b> ${student.status}</div>
    </div>
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
      <div style="font-weight: 700; color: #166534; margin-bottom: 0.4rem;"><i class="fa-solid fa-hands-praying"></i> สถิติผลบุญและศาสนกิจ (KHALIFAH HASANAT):</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; font-size: 0.88rem;">
        <div>⭐ <b>ดาวกุรอานสะสม:</b> ${qStars} ดาว (จบ ${qJuz}/30 ยุซ)</div>
        <div>📖 <b>อ่านถึงหน้า:</b> ${qPage}/604 หน้า</div>
        <div>🧠 <b>ท่องจำซูเราะห์:</b> ${memCount}/114 ซูเราะห์</div>
        <div>🕌 <b>ละหมาดสุนัตล่าสุด:</b> ${sunnahRakaat} ร็อกอะฮ์/วัน</div>
      </div>
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

function toggleSubAdminSubjectField() {
  const roleSelect = document.getElementById('subRole');
  const group = document.getElementById('subSubjectGroup');
  if (!roleSelect || !group) return;
  group.style.display = (roleSelect.value === 'TEACHER') ? 'block' : 'none';
}

function submitAddSubAdmin() {
  const fullName = document.getElementById('subFullName').value.trim();
  const username = document.getElementById('subUsername').value.trim();
  const pass = document.getElementById('subPassword').value.trim();
  const role = document.getElementById('subRole').value;
  const assignedSubj = document.getElementById('subAssignedSubject') ? document.getElementById('subAssignedSubject').value : '';

  if (!fullName || !username || !pass) {
    showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');
    return;
  }

  const newSub = {
    adminId: 'ADM-' + Date.now(),
    username: username,
    password: pass,
    fullName: fullName,
    role: role,
    assignedSubject: role === 'TEACHER' ? assignedSubj : '',
    createdAt: new Date().toISOString().split('T')[0]
  };

  subAdmins.push(newSub);
  localStorage.setItem('khalifah_sub_admins', JSON.stringify(subAdmins));

  closeModal('addSubAdminModal');
  renderSubAdminsTable();
  showToast(`เพิ่มผู้ดูแล/อาจารย์ผู้สอน ${fullName} สำเร็จ`, 'success');

  syncRecordToGoogleSheet('addSubAdmin', newSub);
}

function renderSubAdminsTable() {
  const tbody = document.getElementById('subAdminsTableBody');
  if (!tbody) return;
  loadAppSubjects();

  if (subAdmins.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">ยังไม่มีรายชื่อผู้ดูแลระบบรอง / อาจารย์ผู้สอน</td></tr>`;
    return;
  }

  tbody.innerHTML = subAdmins.map(a => {
    let roleText = a.role || 'SubAdmin';
    if (a.role === 'TEACHER') {
      const subj = appSubjects.find(s => s.id === a.assignedSubject);
      const subjName = subj ? subj.name : (a.assignedSubject || 'ทุกวิชา');
      roleText = `อาจารย์ผู้สอน (${subjName})`;
    } else if (a.role === 'TeacherAdmin') {
      roleText = 'อาจารย์ประจำชั้น';
    } else if (a.role === 'ActivityAdmin') {
      roleText = 'ฝ่ายกิจกรรม';
    }

    return `
      <tr>
        <td><b>${a.username}</b></td>
        <td>${a.fullName}</td>
        <td><span class="activity-badge badge-active">${roleText}</span></td>
        <td>${a.createdAt || '-'}</td>
        <td style="text-align: right;">
          <button class="btn btn-danger btn-sm" style="padding: 0.25rem 0.55rem; font-size: 0.8rem;" onclick="deleteSubAdmin('${a.username}')">
            <i class="fa-solid fa-trash"></i> ลบ
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function deleteSubAdmin(username) {
  if (!confirm(`ต้องการลบบัญชี ${username} ใช่หรือไม่?`)) return;
  subAdmins = subAdmins.filter(s => s.username !== username);
  localStorage.setItem('khalifah_sub_admins', JSON.stringify(subAdmins));
  renderSubAdminsTable();
  showToast('ลบบัญชีเรียบร้อยแล้ว', 'success');
}

// ----------------- TEACHER COMPETENCY GRADING & SUBJECTS ----------------- //

function populateGradingSubjectSelect() {
  const select = document.getElementById('gradingSubjectSelect');
  const subSelect = document.getElementById('subAssignedSubject');
  loadAppSubjects();

  const options = appSubjects.map(s => `<option value="${s.id}">${s.code ? s.code + ' - ' : ''}${s.name}</option>`).join('');

  if (select) {
    select.innerHTML = options;
    if (currentAdmin && currentAdmin.assignedSubject) {
      select.value = currentAdmin.assignedSubject;
    }
  }
  if (subSelect) {
    subSelect.innerHTML = options;
  }
}

function renderGradingStudentsTable() {
  const tbody = document.getElementById('teacherGradingTableBody');
  const subjSelect = document.getElementById('gradingSubjectSelect');
  const gradeSelect = document.getElementById('gradingGradeSelect');
  if (!tbody || !subjSelect || !gradeSelect) return;

  const currentSubj = subjSelect.value;
  const currentGrade = gradeSelect.value;

  const filtered = allStudents.filter(s => s.grade === currentGrade);

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          ไม่พบรายชื่อนักเรียนในระดับชั้น ${currentGrade}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const studentScore = (s.skills && s.skills[currentSubj] !== undefined) ? s.skills[currentSubj] : 75;
    return `
      <tr>
        <td><b>${s.studentId}</b></td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            ${s.avatarUrl ? `<img src="${s.avatarUrl}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">` : `<div style="width: 32px; height: 32px; border-radius: 50%; background: #e0f2fe; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #0284c7; font-size: 0.8rem;">${s.fullName.charAt(0)}</div>`}
            <div>
              <div style="font-weight: 600; color: var(--text-dark);">${s.fullName}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${s.schoolName || ''}</div>
            </div>
          </div>
        </td>
        <td><span class="badge-sub">${s.grade}</span></td>
        <td style="text-align: center;">
          <input type="number" min="0" max="100" class="form-control grading-score-input" data-student-id="${s.studentId}" value="${studentScore}" style="width: 90px; margin: 0 auto; text-align: center; font-weight: 700; font-size: 1rem; color: #0284c7; height: 38px;">
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="setQuickScore('${s.studentId}', 80)" style="padding: 0.2rem 0.45rem; font-size: 0.75rem;">80</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="setQuickScore('${s.studentId}', 90)" style="padding: 0.2rem 0.45rem; font-size: 0.75rem;">90</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="setQuickScore('${s.studentId}', 100)" style="padding: 0.2rem 0.45rem; font-size: 0.75rem;">100</button>
        </td>
      </tr>
    `;
  }).join('');
}

function setQuickScore(studentId, score) {
  const input = document.querySelector(`.grading-score-input[data-student-id="${studentId}"]`);
  if (input) input.value = score;
}

function saveTeacherGradingScores() {
  const subjSelect = document.getElementById('gradingSubjectSelect');
  if (!subjSelect) return;
  const currentSubj = subjSelect.value;
  const inputs = document.querySelectorAll('.grading-score-input');

  if (inputs.length === 0) {
    showToast('ไม่มีรายชื่อนักเรียนให้บันทึกคะแนน', 'warning');
    return;
  }

  let updatedCount = 0;
  inputs.forEach(inp => {
    const sId = inp.getAttribute('data-student-id');
    const val = parseInt(inp.value, 10);
    const score = isNaN(val) ? 0 : Math.max(0, Math.min(100, val));

    const sIdx = allStudents.findIndex(s => s.studentId === sId);
    if (sIdx !== -1) {
      if (!allStudents[sIdx].skills) allStudents[sIdx].skills = {};
      allStudents[sIdx].skills[currentSubj] = score;
      updatedCount++;

      if (currentStudent && currentStudent.studentId === sId) {
        if (!currentStudent.skills) currentStudent.skills = {};
        currentStudent.skills[currentSubj] = score;
        localStorage.setItem('khalifah_current_student', JSON.stringify(currentStudent));
      }
    }
  });

  localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
  renderSkillRadarChart();

  syncRecordToGoogleSheet('updateSubjectScores', {
    subjectId: currentSubj,
    updatedCount: updatedCount,
    timestamp: new Date().toISOString()
  });

  playSuccessSound();
  showToast(`บันทึกคะแนนสมรรถนะนักเรียน ${updatedCount} คน สำเร็จแล้ว!`, 'success');
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

  const payload = {
    students: allStudents,
    prayers: historyList,
    hasanat: hasanatArray
  };

  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'batchSync', data: payload })
    });

    showToast(`ซิงค์สำเร็จ! ส่งข้อมูลนักเรียน ${allStudents.length} คน, ละหมาด ${historyList.length} รายการ, ผลบุญ ${hasanatArray.length} รายการ ลง Google Sheet แล้ว`, 'success');
  } catch (err) {
    showToast('เกิดข้อผิดพลาดในการซิงค์: ' + err.message, 'error');
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
  const url = gasApiUrl || localStorage.getItem('khalifah_gas_url');
  if (!url) {
    console.log(`[Offline Local] GAS URL not configured. Data saved locally in device.`);
    return;
  }

  if (url.includes('docs.google.com/spreadsheets')) {
    console.warn('[Invalid GAS URL] Spreadsheet link configured instead of Web App URL');
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
  } catch (err) {
    console.warn(`Sync ${action} failed:`, err);
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

// ----------------- ACTIVITIES LIVE QR CODE SCANNER (STUDENT VIEW) ----------------- //
let qrScannerStream = null;
let qrScanAnimationId = null;
let qrFacingMode = 'environment'; // Default back camera for QR code scanning
let lastScannedQrCode = '';
let qrCooldownTimer = null;

async function startQrScanner() {
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
    qrScannerStream.getTracks().forEach(t => t.stop());
    qrScannerStream = null;
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
 * ประมวลผลเมื่อสแกนพบ QR Code: สแกนซ้ำได้ ข้อมูลเวลาและวันที่จะถูกแทนที่ทันที
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
  let act = activities.find(a => a.id === actId || a.title === actTitle);
  if (!act) {
    act = {
      id: actId,
      title: actTitle,
      type: 'ทั่วไป',
      date: new Date().toISOString().split('T')[0],
      location: 'โรงเรียน/สถาบัน',
      checkedIn: true
    };
    activities.push(act);
  } else {
    act.checkedIn = true;
  }

  // Load student's activity check-in log
  let actLogs = [];
  try {
    actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
  } catch (e) { actLogs = []; }

  const now = new Date();
  const existingIndex = actLogs.findIndex(l => l.studentId === currentStudent.studentId && (l.activityId === act.id || l.activityTitle === act.title));

  const logEntry = {
    id: 'ACTLOG-' + Date.now(),
    studentId: currentStudent.studentId,
    studentName: currentStudent.fullName,
    grade: currentStudent.grade,
    activityId: act.id,
    activityTitle: act.title,
    checkInTimestamp: now.toISOString(),
    formattedDate: now.toLocaleDateString('th-TH'),
    formattedTime: now.toLocaleTimeString('th-TH')
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

  renderStudentScannedActivities();
  renderDashboardCharts();
  renderCurrentStudentProfile();

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

  let myLogs = actLogs.filter(l => l.studentId === currentStudent.studentId);

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

// ----------------- ADMIN ACTIVITIES & QR CODE GENERATOR ----------------- //
function adminCreateNewActivity() {
  const title = document.getElementById('newActTitle').value.trim();
  const type = document.getElementById('newActType').value;
  const location = document.getElementById('newActLocation').value.trim() || 'มัสยิดอัลฮารอมัยน์';
  const date = document.getElementById('newActDate').value || new Date().toISOString().split('T')[0];

  if (!title) {
    showToast('กรุณากรอกชื่อกิจกรรม', 'warning');
    return;
  }

  const newAct = {
    id: 'ACT-' + Date.now().toString().slice(-6),
    title: title,
    type: type,
    location: location,
    date: date,
    checkedIn: false
  };

  activities.unshift(newAct);
  localStorage.setItem('khalifah_activities', JSON.stringify(activities));

  document.getElementById('newActTitle').value = '';
  renderAdminActivitiesTable();
  showToast(`สร้างกิจกรรม "${title}" เรียบร้อยแล้ว`, 'success');

  // Open QR modal right away for printing
  openActivityQrModal(newAct.id);

  syncRecordToGoogleSheet('createActivity', newAct);
}

function openActivityQrModal(actId) {
  const act = activities.find(a => a.id === actId);
  if (!act) return;

  const displayEl = document.getElementById('activityQrCodeDisplay');
  const titleEl = document.getElementById('activityQrName');
  const subEl = document.getElementById('activityQrSub');

  if (titleEl) titleEl.innerText = act.title;
  if (subEl) subEl.innerText = `ประเภท: ${act.type} • วันที่: ${act.date} • สถานที่: ${act.location}`;

  if (displayEl) {
    displayEl.innerHTML = '';
    if (window.QRCode) {
      new QRCode(displayEl, {
        text: `KHALIFAH_ACT:${act.id}:${act.title}`,
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
  const stdId = document.getElementById('manualStudentIdInput').value.trim();

  if (!actId || !stdId) {
    showToast('กรุณาเลือกกิจกรรมและระบุรหัสนักเรียน', 'warning');
    return;
  }

  const student = allStudents.find(s => s.studentId.toLowerCase() === stdId.toLowerCase());
  const act = activities.find(a => a.id === actId);

  if (!act) {
    showToast('ไม่พบกิจกรรมที่เลือก', 'error');
    return;
  }

  const studentName = student ? student.fullName : ('นักเรียน (' + stdId + ')');
  const studentGrade = student ? student.grade : '-';

  let actLogs = [];
  try {
    actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
  } catch (e) { actLogs = []; }

  const now = new Date();
  const existingIndex = actLogs.findIndex(l => l.studentId.toLowerCase() === stdId.toLowerCase() && l.activityId === act.id);

  const logEntry = {
    id: 'ACTLOG-' + Date.now(),
    studentId: stdId,
    studentName: studentName,
    grade: studentGrade,
    activityId: act.id,
    activityTitle: act.title,
    checkInTimestamp: now.toISOString(),
    formattedDate: now.toLocaleDateString('th-TH'),
    formattedTime: now.toLocaleTimeString('th-TH')
  };

  if (existingIndex !== -1) {
    actLogs[existingIndex] = logEntry;
  } else {
    actLogs.unshift(logEntry);
  }

  localStorage.setItem('khalifah_student_act_logs', JSON.stringify(actLogs));
  document.getElementById('manualStudentIdInput').value = '';
  renderAdminActivitiesTable();
  showToast(`เช็คชื่อ ${studentName} เข้ากิจกรรม "${act.title}" เรียบร้อย!`, 'success');

  syncRecordToGoogleSheet('activityCheckIn', logEntry);
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
    const participantsCount = actLogs.filter(l => l.activityId === a.id || l.activityTitle === a.title).length;
    return `
      <tr>
        <td><b>${a.id}</b></td>
        <td>${a.title}</td>
        <td><span class="activity-badge badge-upcoming">${a.type || 'กิจกรรม'}</span></td>
        <td>${a.location || '-'}</td>
        <td>${a.date || '-'}</td>
        <td>
          <span style="font-weight: 700; color: #0369a1; background: #e0f2fe; padding: 0.25rem 0.65rem; border-radius: 9999px; border: 1px solid #bae6fd; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 0.35rem;">
            <i class="fa-solid fa-users"></i> ${participantsCount} คน
          </span>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="openActivityAttendeesModal('${a.id}')" style="padding: 0.3rem 0.65rem; font-size: 0.78rem; margin-right: 0.35rem;" title="ดูรายชื่อนักเรียนที่สแกนเข้าร่วม">
            <i class="fa-solid fa-users-viewfinder"></i> รายชื่อ (${participantsCount})
          </button>
          <button class="btn btn-primary btn-sm" onclick="openActivityQrModal('${a.id}')" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;">
            <i class="fa-solid fa-qrcode"></i> พิมพ์ QR
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (selectEl) {
    selectEl.innerHTML = activities.map(a => `<option value="${a.id}">${a.title} (${a.date})</option>`).join('');
  }
}

function openActivityAttendeesModal(actId) {
  currentViewingActivityId = actId;
  const act = activities.find(a => a.id === actId);
  const titleEl = document.getElementById('actAttendeesModalTitle');
  const subEl = document.getElementById('actAttendeesModalSubtitle');
  const searchInput = document.getElementById('attendeesSearchInput');

  if (titleEl) {
    titleEl.innerHTML = `<i class="fa-solid fa-users-viewfinder" style="color: var(--primary);"></i> รายชื่อผู้เข้าร่วมกิจกรรม`;
  }
  if (subEl) {
    subEl.innerText = `กิจกรรม: ${act ? act.title : actId} | วันที่: ${act ? act.date : '-'}`;
  }
  if (searchInput) searchInput.value = '';

  let actLogs = [];
  try {
    actLogs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]');
  } catch (e) { actLogs = []; }

  currentAttendeesList = actLogs.filter(l => l.activityId === actId || (act && l.activityTitle === act.title));
  renderAttendeesTable(currentAttendeesList);
  openModal('activityAttendeesModal');
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
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
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
      <td><b>${item.studentId}</b></td>
      <td>${item.studentName}</td>
      <td><span class="badge" style="background: #f1f5f9; color: var(--text-dark); font-size: 0.78rem;">${item.grade || '-'}</span></td>
      <td>${item.formattedDate || '-'}</td>
      <td><span style="color: #059669; font-weight: 600;">${item.formattedTime || '-'}</span></td>
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
    const act = activities.find(a => a.id === currentViewingActivityId);
    currentAttendeesList = actLogs.filter(l => l.activityId === currentViewingActivityId || (act && l.activityTitle === act.title));
    renderAttendeesTable(currentAttendeesList);
  }
  renderAdminActivitiesTable();
  showToast('ลบรายการเช็คชื่อเรียบร้อยแล้ว', 'info');
}

function exportAttendeesToExcel() {
  if (!currentAttendeesList || currentAttendeesList.length === 0) {
    showToast('ไม่มีข้อมูลนักเรียนสำหรับส่งออก', 'warning');
    return;
  }
  const act = activities.find(a => a.id === currentViewingActivityId);
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

// Initialize minimalist date of birth picker
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBirthDatePicker);
} else {
  initBirthDatePicker();
}
