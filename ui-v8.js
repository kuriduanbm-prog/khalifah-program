/* ---- ภาคเรียน / ปีการศึกษาปัจจุบัน (แอดมินตั้งค่าได้ · ไม่ตั้ง = คำนวณจากวันที่) ---- */
window.k8TermSetting = (function () { try { return JSON.parse(localStorage.getItem('khalifah_term_setting') || 'null'); } catch (e) { return null; } })();
window.k8Term = function () {
  const c = window.k8TermSetting;
  let t, y;
  if (c && c.mode === 'manual' && [1, 2, 3].indexOf(Number(c.term)) !== -1 && Number(c.year) >= 2500) { t = Number(c.term); y = Number(c.year); }
  else { const d = new Date(); const m = d.getMonth() + 1; const by = d.getFullYear() + 543; t = (m >= 5 && m <= 10) ? 1 : 2; y = m >= 5 ? by : by - 1; }
  const name = t === 3 ? 'ภาคฤดูร้อน' : 'ภาคเรียนที่ ' + t;
  return { term: t, year: y, key: t + '/' + y, name: name, label: name + '/' + y, manual: !!(c && c.mode === 'manual') };
};
window.k8LoadTermSetting = function () {
  try {
    const url = (typeof getGasUrl === 'function') ? getGasUrl() : '';
    if (!url) return Promise.resolve();
    return fetch(url + (url.indexOf('?') === -1 ? '?' : '&') + 'action=getSettings&_t=' + Date.now()).then((r) => r.json()).then((j) => {
      const raw = j && j.data ? j.data.CurrentTerm : null;
      let v = null; try { v = raw ? JSON.parse(raw) : null; } catch (e) {}
      const before = JSON.stringify(window.k8TermSetting || null);
      window.k8TermSetting = v;
      try { localStorage.setItem('khalifah_term_setting', JSON.stringify(v)); } catch (e) {}
      if (before !== JSON.stringify(v)) document.dispatchEvent(new CustomEvent('k8-term-changed'));
    }).catch(() => {});
  } catch (e) { return Promise.resolve(); }
};
setTimeout(() => window.k8LoadTermSetting && window.k8LoadTermSetting(), 1500);

/* =====================================================================
   KHALIFAH v8 UI
   1) หน้าแรกนักเรียนแบบ F (บัตรนักเรียน + สรุปรายวัน/สัปดาห์/เดือน + เกรดแบบหุบ)
   2) หน้าอาจารย์: คะแนนชิ้นงาน (เพิ่มได้ไม่จำกัด) + สรุปเกรด 0–4 (ขั้นละ .5)
   ไฟล์นี้โหลดหลัง app.js และใช้ฟังก์ชัน/ตัวแปรกลางของ app.js
   ===================================================================== */
(function () {
  'use strict';

  // ---------------- utilities ----------------
  const esc = (v) => (typeof escapeHtml === 'function' ? escapeHtml(v) : String(v == null ? '' : v));
  const sameId = (a, b) => (typeof isIdMatch === 'function' ? isIdMatch(a, b) : String(a) === String(b));
  const cleanId = (v) => (typeof cleanIdString === 'function' ? cleanIdString(v) : String(v || '').trim());
  const readJSON = (key, fallback) => {
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  };
  const pad2 = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const parseYMD = (s) => {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    let y = Number(m[1]);
    if (y > 2400) y -= 543;
    return new Date(y, Number(m[2]) - 1, Number(m[3]));
  };
  const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const TH_DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const thShort = (d) => d.getDate() + ' ' + TH_MONTHS[d.getMonth()];
  const fmtNum = (n) => {
    const v = Math.round(Number(n || 0) * 100) / 100;
    return String(v);
  };

  function periodRange(period, now) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'day') return { start: today, end: today, label: 'วันนี้ ' + thShort(today) };
    if (period === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start, end, label: TH_MONTHS_FULL[today.getMonth()] + ' ' + (today.getFullYear() + 543) };
    }
    const dow = (today.getDay() + 6) % 7; // จันทร์ = 0
    const start = new Date(today); start.setDate(today.getDate() - dow);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { start, end, label: thShort(start) + ' – ' + thShort(end) };
  }
  const inRange = (d, r) => !!d && d >= r.start && d <= r.end;

  // ================================================================
  //  1) หน้าแรกแบบ F
  // ================================================================
  const k8HideGrades = () => { try { return localStorage.getItem('k8_pref_hideGrades') !== '0'; } catch (e) { return true; } };
  const hfState = { period: 'day', gradesOpen: !k8HideGrades(), openSubj: null };
  window.k8HfSetGradesOpen = function (v) { hfState.gradesOpen = !!v; if (!v) hfState.openSubj = null; try { window.renderHomeF(); } catch (e) {} };

  const SLOT_ORDER = ['ซุบฮิ', 'ซุฮริ', 'อัศรฺ', 'มัฆริบ', 'อีชาอ์'];
  const slotKey = (name) => (typeof normalizePrayerSlotKey === 'function' ? normalizePrayerSlotKey(name) : name);

  function myPrayerRecords(sid) {
    const hist = readJSON('khalifah_prayer_history', []);
    const today = (typeof todayPrayers !== 'undefined' && Array.isArray(todayPrayers)) ? todayPrayers : [];
    const seen = {};
    const out = [];
    [...today, ...hist].forEach((p) => {
      if (!p || !sameId(p.studentId, sid)) return;
      const date = p.date || (p.timestamp ? String(p.timestamp).slice(0, 10) : '');
      const slot = slotKey(p.prayerTime || p.prayerName || p.timeSlot || '');
      const st = String(p.status || '');
      if (!date || !slot || st.includes('ขาด') || st.toUpperCase() === 'ABSENT') return;
      const k = date + '|' + slot;
      if (seen[k]) return;
      seen[k] = true;
      out.push({ date, d: parseYMD(date), slot });
    });
    return out;
  }

  function nextPrayerInfo(doneToday) {
    const wins = (typeof PRAYER_TIME_WINDOWS !== 'undefined') ? PRAYER_TIME_WINDOWS : [];
    if (!wins.length) return null;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const fmt = (m) => (typeof formatMinutesToHHMM === 'function' ? formatMinutesToHHMM(m) : pad2(Math.floor(m / 60)) + ':' + pad2(m % 60));
    // ช่วงที่กำลังเปิดอยู่
    for (const w of wins) {
      const isIsha = w.name === 'อีชาอ์';
      const open = isIsha ? (cur >= w.startMin || cur < wins[0].startMin) : (cur >= w.startMin && cur <= w.endMin);
      if (open) {
        const done = doneToday.indexOf(slotKey(w.name)) !== -1;
        return { name: w.name, time: fmt(w.startMin), open: true, done, until: isIsha ? 'ก่อนรุ่งอรุณ' : fmt(w.endMin) };
      }
    }
    // ช่วงถัดไป
    let next = wins.find((w) => w.startMin > cur);
    let mins;
    if (next) mins = next.startMin - cur;
    else { next = wins[0]; mins = 1440 - cur + next.startMin; }
    return { name: next.name, time: fmt(next.startMin), open: false, done: false, inMin: mins };
  }

  function myAttendance(sid, range) {
    const logs = readJSON('khalifah_attendance_logs', []);
    const counts = [0, 0, 0, 0];
    const byDate = {};
    logs.forEach((l) => {
      if (!l || !sameId(l.studentId, sid)) return;
      const d = parseYMD(l.date);
      if (!inRange(d, range)) return;
      byDate[l.date + '|' + (l.subjectCode || '')] = String(l.status || '');
    });
    Object.keys(byDate).forEach((k) => {
      const st = byDate[k];
      if (st.includes('สาย') || /LATE/i.test(st)) counts[1]++;
      else if (st.includes('ลา') || /EXCUSE|LEAVE/i.test(st)) counts[2]++;
      else if (st.includes('ขาด') || /ABSENT/i.test(st)) counts[3]++;
      else counts[0]++;
    });
    return counts;
  }

  function subjectGradeFor(s, subj) {
    const pick = (v) => (v === undefined || v === null || v === '' ? null : (typeof normalizeGrade1To4 === 'function' ? normalizeGrade1To4(v) : Number(v)));
    if (s.subjectGrades && s.subjectGrades[subj.id] !== undefined) {
      const g = pick(s.subjectGrades[subj.id]);
      if (g) return { grade: g, score: null };
    }
    const arr = Array.isArray(s.grades) ? s.grades : [];
    const hit = arr.find((g) => g && (g.code === subj.id || (subj.code && g.code === subj.code) || g.name === subj.name));
    if (hit && pick(hit.grade)) return { grade: pick(hit.grade), score: hit.score };
    const rows = readJSON('khalifah_subject_grades_rows', []);
    const r = rows.find((g) => g && sameId(g.studentId, s.studentId) && (g.subjectCode === subj.id || g.subjectCode === subj.code || g.subjectName === subj.name));
    if (r && pick(r.grade)) return { grade: pick(r.grade), score: r.score };
    return { grade: null, score: null };
  }

  const gradeTone = (g) => {
    if (g == null) return ['#f1f5f9', '#64748b'];
    if (g >= 3.5) return ['#f0fdf4', '#15803d'];
    if (g >= 2.5) return ['#eff6ff', '#1d4ed8'];
    if (g >= 1.5) return ['#fffbeb', '#b45309'];
    return ['#fef2f2', '#b91c1c'];
  };

  function renderHomeF() {
    const root = document.getElementById('homeF');
    if (!root) return;
    const s = (typeof currentStudent !== 'undefined') ? currentStudent : null;
    if (!s) return;
    const sid = cleanId(s.studentId);
    const now = new Date();
    const range = periodRange(hfState.period, now);

    // --- บัตรนักเรียน ---
    const name = String(s.fullName || '-').trim();
    const nameEl = document.getElementById('hfName');
    nameEl.textContent = name;
    nameEl.title = name;
    nameEl.classList.toggle('is-long', name.length > 28);
    document.getElementById('hfId').textContent = sid || '-';
    document.getElementById('hfGrade').textContent = s.grade || '-';
    document.getElementById('hfSchool').textContent = s.schoolName || '-';
    const tm = window.k8Term();
    document.getElementById('hfYear').textContent = (tm.term === 3 ? 'ภาคฤดูร้อน ' : 'เทอม ' + tm.term + '/') + tm.year;
    const statusText = String(s.status || 'ปกติ (กำลังศึกษา)');
    const stEl = document.getElementById('hfStatus');
    const normal = /ปกติ|กำลังศึกษา|active/i.test(statusText);
    stEl.textContent = normal ? 'กำลังศึกษา' : statusText;
    stEl.classList.toggle('is-warn', !normal);
    const photo = document.getElementById('hfPhoto');
    const url = (typeof getDirectImageUrl === 'function') ? getDirectImageUrl(s.avatarUrl || s.profilePhoto || '') : '';
    if (url) {
      photo.style.backgroundImage = 'url("' + String(url).replace(/"/g, '%22') + '")';
      photo.textContent = '';
    } else {
      photo.style.backgroundImage = '';
      const bare = name.replace(/^(นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง)\s*/, '');
      photo.textContent = bare.charAt(0) || '?';
    }

    // --- ละหมาดถัดไป ---
    const prayers = myPrayerRecords(sid);
    const todayStr = ymd(now);
    const doneToday = prayers.filter((p) => p.date === todayStr).map((p) => p.slot);
    const np = nextPrayerInfo(doneToday);
    const nextBtn = document.getElementById('hfNext');
    const nextText = document.getElementById('hfNextText');
    const nextCta = document.getElementById('hfNextCta');
    if (np) {
      if (np.open && np.done) {
        nextText.innerHTML = '<b>' + esc(np.name) + '</b> · บันทึกแล้ววันนี้';
        nextCta.textContent = '✓ เรียบร้อย';
      } else if (np.open) {
        nextText.innerHTML = '<b>' + esc(np.name) + ' ' + esc(np.time) + '</b> · เปิดถึง ' + esc(np.until);
        nextCta.textContent = 'เช็คชื่อละหมาด';
      } else {
        const h = Math.floor(np.inMin / 60), m = np.inMin % 60;
        nextText.innerHTML = '<b>' + esc(np.name) + ' ' + esc(np.time) + '</b> · อีก ' + (h ? h + ' ชม. ' : '') + m + ' นาที';
        nextCta.textContent = 'หน้าละหมาด';
      }
      nextBtn.classList.toggle('is-done', !!(np.open && np.done));
    }

    // --- แท็บช่วงเวลา ---
    document.querySelectorAll('#hfPeriods button').forEach((b) => {
      b.setAttribute('aria-selected', b.dataset.period === hfState.period ? 'true' : 'false');
    });
    document.getElementById('hfRange').textContent = range.label;

    // --- การมาเรียน ---
    const att = myAttendance(sid, range);
    const total = att.reduce((a, b) => a + b, 0);
    const attDef = [['มา', '#15803d', '#f0fdf4'], ['สาย', '#b45309', '#fffbeb'], ['ลา', '#1d4ed8', '#eff6ff'], ['ขาด', '#b91c1c', '#fef2f2']];
    document.getElementById('hfAtt').innerHTML = attDef.map(([label, ink, bg], i) =>
      '<button type="button" class="hf-att-item" style="background:' + bg + ';color:' + ink + '" onclick="k8AttDetail(' + i + ')" aria-label="ดูรายละเอียด ' + label + ' ' + att[i] + ' ครั้ง"><b>' + att[i] + '</b><span>' + label + '</span></button>'
    ).join('');
    document.getElementById('hfAttBar').innerHTML = total
      ? attDef.map(([, ink], i) => '<span style="width:' + (att[i] / total * 100) + '%;background:' + ink + '"></span>').join('')
      : '';

    // --- กราฟละหมาด ---
    let bars = [];
    let max = 5;
    let got = 0, possible = 0;
    if (hfState.period === 'day') {
      max = 1;
      bars = SLOT_ORDER.map((slot) => {
        const v = doneToday.indexOf(slot) !== -1 ? 1 : 0;
        return { label: slot, v, text: v ? '✓' : '–' };
      });
      got = doneToday.length; possible = 5;
    } else if (hfState.period === 'week') {
      for (let i = 0; i < 7; i++) {
        const d = new Date(range.start); d.setDate(range.start.getDate() + i);
        const key = ymd(d);
        const v = prayers.filter((p) => p.date === key).length;
        bars.push({ label: TH_DOW[d.getDay()], v, text: d > now ? '' : String(v), future: d > now });
        if (d <= now) { got += v; possible += 5; }
      }
    } else {
      const weeks = [];
      for (let d = new Date(range.start); d <= range.end; d.setDate(d.getDate() + 1)) {
        const w = Math.floor((d.getDate() - 1) / 7);
        weeks[w] = weeks[w] || { v: 0, days: 0 };
        if (d <= now) { weeks[w].days++; weeks[w].v += prayers.filter((p) => p.date === ymd(d)).length; }
      }
      max = 35;
      bars = weeks.map((w, i) => ({ label: 'สัปดาห์ ' + (i + 1), v: w.v, text: w.days ? String(w.v) : '', future: !w.days }));
      weeks.forEach((w) => { got += w.v; possible += w.days * 5; });
    }
    document.getElementById('hfPrayerTotal').textContent = got + ' / ' + possible + ' เวลา';
    const barsEl = document.getElementById('hfBars');
    barsEl.setAttribute('aria-label', 'ละหมาด ' + got + ' จาก ' + possible + ' เวลา');
    barsEl.innerHTML = bars.map((b) => {
      const ratio = max ? b.v / max : 0;
      const color = b.future ? '#e2e8f0' : (ratio >= 0.9 ? '#0369a1' : (ratio >= 0.6 ? '#7dd3fc' : '#fcd34d'));
      const h = Math.max(4, Math.round(ratio * 110));
      return '<div class="hf-bar"><span class="hf-bar-v">' + esc(b.text) + '</span><span class="hf-bar-col" style="height:' + h + 'px;background:' + color + '"></span><span class="hf-bar-l">' + esc(b.label) + '</span></div>';
    }).join('');

    // --- เกรด (หุบไว้) ---
    renderGradesBlock(s, sid);

    // --- กิจกรรม ---
    const logs = readJSON('khalifah_student_act_logs', []).filter((l) => l && sameId(l.studentId, sid));
    const actInRange = logs.filter((l) => inRange(parseYMD(l.formattedDate || (l.checkInTimestamp || '').slice(0, 10)), range));
    document.getElementById('hfActLink').textContent = 'เข้าร่วม ' + actInRange.length + ' ครั้ง · ดูทั้งหมด';
    const acts = (typeof activities !== 'undefined' && Array.isArray(activities)) ? activities : [];
    const todayD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const upcoming = acts
      .map((a) => ({ a, d: parseYMD(a.startDate || a.date) }))
      .filter((x) => x.d && x.d >= todayD)
      .sort((x, y) => x.d - y.d)
      .slice(0, 2)
      .map((x) => ({ d: x.d, title: x.a.title, tag: 'เร็ว ๆ นี้', bg: '#eff6ff', ink: '#1d4ed8' }));
    const joined = logs
      .map((l) => ({ d: parseYMD(l.formattedDate || ''), title: l.activityTitle || l.activityId }))
      .filter((x) => x.d)
      .sort((x, y) => y.d - x.d)
      .slice(0, 1)
      .map((x) => ({ d: x.d, title: x.title, tag: 'เข้าร่วม', bg: '#f0fdf4', ink: '#15803d' }));
    const items = [...joined, ...upcoming];
    document.getElementById('hfActs').innerHTML = items.length
      ? items.map((it) => '<div class="hf-act"><span class="hf-act-date"><b>' + it.d.getDate() + '</b>' + TH_MONTHS[it.d.getMonth()] + '</span><span class="hf-act-title" title="' + esc(it.title) + '">' + esc(it.title || '-') + '</span><span class="hf-tag" style="background:' + it.bg + ';color:' + it.ink + '">' + it.tag + '</span></div>').join('')
      : '<div class="hf-empty">ยังไม่มีกิจกรรมในช่วงนี้</div>';

    // --- ผลบุญ ---
    const rows = readJSON('khalifah_hasanat_rows', []).filter((r) => r && sameId(r.studentId, sid));
    let pages = 0, rakaat = 0, memLatest = 0;
    rows.forEach((r) => {
      const d = parseYMD(r.date);
      if (inRange(d, range)) {
        pages += Number(r.quran && r.quran.pagesToday) || 0;
        rakaat += Number(r.sunnah && r.sunnah.totalRakaat) || 0;
      }
      memLatest = Math.max(memLatest, Number(r.memorization && r.memorization.count) || 0);
    });
    const allH = readJSON('khalifah_student_hasanat', {});
    const mine = allH[sid] || {};
    if (!memLatest && mine.memorization) memLatest = Number(mine.memorization.count) || (mine.memorization.memorizedSurahs || []).length || 0;
    let memNew = memLatest;
    if (typeof window.k8HasanatStats === 'function') {
      const ymdL = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const st = window.k8HasanatStats(ymdL(range.start), ymdL(range.end));
      pages = st.pages; rakaat = st.rakaat; memNew = st.mem;
    }
    const deeds = [['อ่านอัลกุรอาน', fmtNum(pages) + ' หน้า', '#b45309'], ['ท่องจำใหม่', memNew + ' ซูเราะห์', '#15803d'], ['สุนัต', fmtNum(rakaat) + ' ร็อกอะฮ์', '#6d28d9']];
    document.getElementById('hfDeeds').innerHTML = deeds.map(([label, value, ink]) =>
      '<button type="button" class="hf-deed" onclick="switchView(\'hasanat\')"><span>' + label + '</span><b style="color:' + ink + '">' + esc(value) + '</b></button>'
    ).join('');
  }

  function renderGradesBlock(s, sid) {
    const open = hfState.gradesOpen;
    const toggle = document.getElementById('hfGradesToggle');
    const body = document.getElementById('hfGradesBody');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.getElementById('hfGradesIcon').innerHTML = open ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
    document.getElementById('hfGradesHint').textContent = open ? 'คนรอบข้างอาจเห็นได้ · ซ่อนอัตโนมัติเมื่อออกจากหน้านี้' : 'ซ่อนไว้เพื่อความเป็นส่วนตัว';
    document.getElementById('hfGradesAction').textContent = open ? 'ซ่อน' : 'แตะเพื่อดู';
    body.hidden = !open;
    if (!open) { body.innerHTML = ''; return; }

    if (typeof loadAppSubjects === 'function') loadAppSubjects();
    const subjects = (typeof appSubjects !== 'undefined' && Array.isArray(appSubjects)) ? appSubjects : [];
    const defsMap = readJSON('khalifah_subject_assignments', {});
    const scoreMap = (readJSON('khalifah_student_assignment_scores', {})[sid]) || {};
    let gpax = Number(s.gpax || s.gpa);
    if (!(gpax > 0) && typeof recalculateStudentGpa === 'function') gpax = Number(recalculateStudentGpa(s));
    let html = '<div class="hf-gpax"><span>เกรดเฉลี่ยสะสม (GPAX)</span><b>' + (gpax > 0 ? gpax.toFixed(2) : '–') + '</b></div>';
    html += subjects.map((subj) => {
      const g = subjectGradeFor(s, subj);
      const [bg, ink] = gradeTone(g.grade);
      const defs = Array.isArray(defsMap[subj.id]) ? defsMap[subj.id] : [];
      const mine = scoreMap[subj.id] || {};
      let got = 0, maxSum = 0, any = false;
      defs.forEach((a) => {
        maxSum += Number(a.maxScore) || 0;
        const v = mine[a.id];
        if (v !== '' && v !== undefined && v !== null && !isNaN(Number(v))) { got += Number(v); any = true; }
      });
      const pct = maxSum ? Math.round(got / maxSum * 100) : (g.score ? Math.min(100, Number(g.score)) : 0);
      const expanded = hfState.openSubj === subj.id;
      const canExpand = defs.length > 0;
      let detail = '';
      if (expanded && canExpand) {
        detail = '<ul class="hf-asg">' + defs.map((a) => {
          const v = mine[a.id];
          const has = v !== '' && v !== undefined && v !== null && !isNaN(Number(v));
          return '<li><span>' + esc(a.title) + '</span><b>' + (has ? fmtNum(v) : '–') + ' / ' + fmtNum(a.maxScore) + '</b></li>';
        }).join('') + '<li class="hf-asg-total"><span>รวม</span><b>' + (any ? fmtNum(got) : '–') + ' / ' + fmtNum(maxSum) + (any ? ' (' + pct + '%)' : '') + '</b></li></ul>';
      }
      return '<div class="hf-subj">' +
        '<button type="button" class="hf-subj-row" data-subj="' + esc(subj.id) + '" ' + (canExpand ? 'aria-expanded="' + expanded + '"' : 'disabled') + '>' +
        '<span class="hf-subj-name">' + esc(subj.name) + (canExpand ? '<small>' + defs.length + ' ชิ้นงาน · แตะเพื่อดูคะแนน</small>' : '') + '</span>' +
        '<span class="hf-subj-bar" aria-hidden="true"><span style="width:' + pct + '%;background:' + ink + '"></span></span>' +
        '<span class="hf-gpill' + (g.grade == null ? ' is-wait' : '') + '" style="background:' + bg + ';color:' + ink + '">' + (g.grade == null ? 'รอผล' : fmtNum(g.grade)) + '</span>' +
        '</button>' + detail + '</div>';
    }).join('');
    body.innerHTML = html;
  }

  function bindHomeF() {
    const root = document.getElementById('homeF');
    if (!root || root.dataset.bound) return;
    root.dataset.bound = '1';
    document.getElementById('hfPeriods').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-period]');
      if (!b) return;
      hfState.period = b.dataset.period;
      renderHomeF();
    });
    document.getElementById('hfGradesToggle').addEventListener('click', () => {
      hfState.gradesOpen = !hfState.gradesOpen;
      hfState.openSubj = null;
      renderHomeF();
    });
    document.getElementById('hfGradesBody').addEventListener('click', (e) => {
      const b = e.target.closest('.hf-subj-row[data-subj]');
      if (!b || b.disabled) return;
      hfState.openSubj = hfState.openSubj === b.dataset.subj ? null : b.dataset.subj;
      renderHomeF();
    });
  }

  window.renderHomeF = function () {
    try { bindHomeF(); renderHomeF(); } catch (err) { console.warn('renderHomeF error', err); }
  };

  // เรนเดอร์ใหม่ทุกครั้งที่ข้อมูลโปรไฟล์อัปเดต และหุบเกรดเมื่อออกจากหน้าแรก
  if (typeof window.renderCurrentStudentProfile === 'function') {
    const orig = window.renderCurrentStudentProfile;
    window.renderCurrentStudentProfile = function () {
      const r = orig.apply(this, arguments);
      window.renderHomeF();
      return r;
    };
  }
  if (typeof window.switchView === 'function') {
    const origSwitch = window.switchView;
    window.switchView = function (viewName) {
      if (viewName !== 'dashboard' && hfState.gradesOpen && k8HideGrades()) {
        hfState.gradesOpen = false;
        hfState.openSubj = null;
      }
      const r = origSwitch.apply(this, arguments);
      if (viewName === 'dashboard') window.renderHomeF();
      return r;
    };
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && hfState.gradesOpen && k8HideGrades()) {
      hfState.gradesOpen = false;
      hfState.openSubj = null;
      window.renderHomeF();
    }
  });
  // อัปเดตเวลาละหมาดถัดไปทุกนาที
  setInterval(() => {
    const v = document.getElementById('view-dashboard');
    if (v && v.classList.contains('active')) window.renderHomeF();
  }, 60000);

  // ================================================================
  //  2) หน้าอาจารย์: คะแนนชิ้นงาน + สรุปเกรด
  // ================================================================
  const GRADE_STEPS = [[80, 4], [75, 3.5], [70, 3], [65, 2.5], [60, 2], [55, 1.5], [50, 1], [0, 0]];
  const GRADE_VALUES = [0, 1, 1.5, 2, 2.5, 3, 3.5, 4];
  const suggestGrade = (pct) => GRADE_STEPS.find(([min]) => pct >= min)[1];

  const tgState = {
    tab: 'scores',
    active: {},        // { subjectId: assignmentId }
    adding: false,
    scores: null,      // { sid: { subj: { asg: value } } } (แก้ไขในเครื่องก่อนบันทึก)
    dirty: {},         // { subj: { sid: { asg: true } } }
    gradeEdits: {},    // { subj: { sid: number } }
    saving: false,
    search: '',
    showRule: false,
    mode: (function () { try { return localStorage.getItem('k8_tg_view') || 'grid'; } catch (e) { return 'grid'; } })()
  };

  const TG_TOTAL_MAX = 100;
  function tgLoadScores() {
    if (!tgState.scores) tgState.scores = readJSON('khalifah_student_assignment_scores', {});
    return tgState.scores;
  }
  function tgSubject() {
    const sel = document.getElementById('teacherPortalSubjectSelect');
    return sel ? sel.value : '';
  }
  function tgStudents() {
    const gsel = document.getElementById('teacherPortalGradeSelect');
    const g = gsel ? (gsel.value || 'ALL') : 'ALL';
    const list = (typeof allStudents !== 'undefined' && Array.isArray(allStudents)) ? allStudents : [];
    return list
      .filter((s) => s && s.studentId && (g === 'ALL' || s.grade === g))
      .filter((s) => !/ลาออก|สำเร็จ/.test(String(s.status || '')))
      .filter((s) => { const q = (tgState.search || '').trim().toLowerCase(); return !q || String(s.fullName || '').toLowerCase().indexOf(q) !== -1 || String(s.studentId).indexOf(q) !== -1; })
      .sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)));
  }
  function tgAssignments(subj) {
    return (typeof getSubjectAssignments === 'function') ? getSubjectAssignments(subj) : [];
  }
  function tgScoreOf(sid, subj, asgId) {
    const m = tgLoadScores();
    const v = m[sid] && m[sid][subj] ? m[sid][subj][asgId] : undefined;
    return v === undefined || v === null ? '' : v;
  }
  function tgTotals(sid, subj, defs) {
    let got = 0, max = 0, any = false;
    defs.forEach((a) => {
      max += Number(a.maxScore) || 0;
      const v = tgScoreOf(sid, subj, a.id);
      if (v !== '' && !isNaN(Number(v))) { got += Number(v); any = true; }
    });
    return { got: Math.round(got * 100) / 100, max, any, pct: max ? Math.round(got / max * 100) : 0 };
  }
  function tgSavedGrade(s, subj) {
    const subjObj = (typeof appSubjects !== 'undefined' ? appSubjects : []).find((x) => x.id === subj) || { id: subj, name: subj };
    return subjectGradeFor(s, subjObj).grade;
  }
  function tgDirtyCount(subj) {
    const d = tgState.dirty[subj] || {};
    let n = 0;
    Object.keys(d).forEach((sid) => { n += Object.keys(d[sid]).length; });
    return n + Object.keys(tgState.gradeEdits[subj] || {}).length;
  }

  function renderTeacherGradesV8() {
    const body = document.getElementById('tgBody');
    if (!body) return;
    const subj = tgSubject();
    document.querySelectorAll('#tgTabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tgState.tab ? 'true' : 'false'));
    if (!subj) { body.innerHTML = '<div class="tg-empty">ยังไม่มีรายวิชาที่รับผิดชอบ</div>'; return; }
    const defs = tgAssignments(subj);
    const students = tgStudents();
    let active = tgState.active[subj];
    if (!defs.find((a) => a.id === active)) active = tgState.active[subj] = defs.length ? defs[defs.length - 1].id : null;
    const totalMax = defs.reduce((a, d) => a + (Number(d.maxScore) || 0), 0);
    let html = '<label class="tg-search"><span class="sr-only-k8">ค้นหานักเรียน</span><input type="search" id="tgSearch" placeholder="ค้นหาชื่อหรือรหัสนักเรียน" value="' + esc(tgState.search || '') + '"></label>';

    if (tgState.tab === 'scores') {
      const left = Math.max(0, Math.round((TG_TOTAL_MAX - totalMax) * 100) / 100);
      html += '<div class="tg-head"><h3>ชิ้นงาน (' + defs.length + ')</h3><span>คะแนนเต็มรวม <b>' + fmtNum(totalMax) + '</b> / ' + TG_TOTAL_MAX + (left > 0 ? ' · เหลือ ' + fmtNum(left) : ' · ครบแล้ว') + '</span></div>';
      html += '<div class="tg-chips">' + defs.map((a) => '<button type="button" class="tg-chip" data-asg="' + esc(a.id) + '" aria-pressed="' + (a.id === active) + '">' + esc(a.title) + '<small>เต็ม ' + fmtNum(a.maxScore) + '</small></button>').join('') +
        '<button type="button" class="tg-add" data-act="open-add">+ เพิ่มชิ้นงาน</button></div>';
      if (tgState.adding) {
        html += '<div class="tg-form"><div class="tg-form-row">' +
          '<label>ชื่อชิ้นงาน<input type="text" id="tgNewTitle" maxlength="120" placeholder="เช่น ใบงานที่ 4"></label>' +
          '<label>คะแนนเต็ม (ใส่ได้อีก ' + fmtNum(left) + ')<input type="text" inputmode="decimal" id="tgNewMax" placeholder="' + (left >= 10 ? '10' : fmtNum(left)) + '"></label></div>' +
          '<div class="tg-btns"><button type="button" class="tg-btn" data-act="cancel-add">ยกเลิก</button><button type="button" class="tg-btn is-primary" data-act="confirm-add">เพิ่มชิ้นงาน</button></div></div>';
      }
      if (defs.length) html += '<div class="tg-mode" role="tablist" aria-label="รูปแบบการกรอกคะแนน">' + [['grid', 'ตารางทุกชิ้นงาน'], ['one', 'กรอกทีละชิ้นงาน']].map(([k, l]) => '<button type="button" role="tab" data-mode="' + k + '" aria-selected="' + (tgState.mode === k) + '">' + l + '</button>').join('') + '</div>';
      if (defs.length && tgState.mode === 'grid') {
        html += '<p class="tg-note">กรอกคะแนนของนักเรียนแต่ละคนแยกตามชิ้นงานได้ในตารางเดียว · กด Enter เพื่อลงไปคนถัดไปในชิ้นงานเดียวกัน</p>';
        html += '<div class="tg-grid-wrap"><table class="tg-grid"><thead><tr><th scope="col" class="tg-grid-name">นักเรียน</th>' + defs.map((a) => '<th scope="col"><span>' + esc(a.title) + '</span><small>เต็ม ' + fmtNum(a.maxScore) + '</small></th>').join('') + '<th scope="col" class="tg-grid-sum">รวม<small>' + fmtNum(totalMax) + '</small></th></tr></thead><tbody>' +
          students.map((s) => { const sid = cleanId(s.studentId); const t = tgTotals(sid, subj, defs);
            return '<tr><th scope="row" class="tg-grid-name"><b>' + esc(s.fullName || sid) + '</b><small>' + esc(sid) + '</small></th>' + defs.map((a) => { const v = tgScoreOf(sid, subj, a.id); const n = Number(v); const bad = v !== '' && (isNaN(n) || n < 0 || n > Number(a.maxScore));
              return '<td><input type="text" inputmode="decimal" autocomplete="off" class="' + (bad ? 'is-bad' : '') + '" data-sid="' + esc(sid) + '" data-asg="' + esc(a.id) + '" data-max="' + esc(a.maxScore) + '" value="' + esc(v) + '" placeholder="–" aria-label="' + esc(a.title) + ' ของ ' + esc(s.fullName || sid) + ' (เต็ม ' + fmtNum(a.maxScore) + ')"></td>'; }).join('') +
              '<td class="tg-grid-sum" data-gridsum-for="' + esc(sid) + '">' + fmtNum(t.got) + '</td></tr>'; }).join('') + '</tbody></table></div>';
        if (!students.length) html += '<div class="tg-empty">ไม่พบนักเรียนในระดับชั้นที่เลือก</div>';
      } else if (!defs.length) {
        html += '<div class="tg-empty">ยังไม่มีชิ้นงาน กด "+ เพิ่มชิ้นงาน" เพื่อสร้างช่องคะแนน เช่น การบ้าน รายงาน หรือสอบ<br>หรือไปที่แท็บ "สรุปเกรด" เพื่อให้เกรดโดยตรง</div>';
      } else {
        const a = defs.find((x) => x.id === active);
        html += '<div class="tg-asg-bar"><span>กำลังกรอก: <b>' + esc(a.title) + '</b> (เต็ม ' + fmtNum(a.maxScore) + ') · กด Enter เพื่อไปคนถัดไป</span><button type="button" class="tg-link-danger" data-act="remove-asg">ลบชิ้นงานนี้</button></div>';
        html += '<ul class="tg-list" aria-label="กรอกคะแนน ' + esc(a.title) + '">' + students.map((s) => {
          const sid = cleanId(s.studentId);
          const v = tgScoreOf(sid, subj, a.id);
          const n = Number(v);
          const bad = v !== '' && (isNaN(n) || n < 0 || n > Number(a.maxScore));
          const t = tgTotals(sid, subj, defs);
          return '<li class="tg-row"><span class="tg-row-main"><span class="tg-row-name">' + esc(s.fullName || sid) + '</span><span class="tg-row-sub" data-total-for="' + esc(sid) + '">' + esc(sid) + ' · รวม ' + fmtNum(t.got) + ' / ' + fmtNum(t.max) + '</span></span>' +
            '<label class="tg-score"><span class="sr-only-k8">คะแนน ' + esc(a.title) + ' ของ ' + esc(s.fullName || sid) + '</span>' +
            '<input type="text" inputmode="decimal" autocomplete="off" class="' + (bad ? 'is-bad' : '') + '" data-sid="' + esc(sid) + '" data-asg="' + esc(a.id) + '" data-max="' + esc(a.maxScore) + '" value="' + esc(v) + '" placeholder="–"> / ' + fmtNum(a.maxScore) + '</label></li>';
        }).join('') + '</ul>';
        if (!students.length) html += '<div class="tg-empty">ไม่พบนักเรียนในระดับชั้นที่เลือก</div>';
      }
    } else {
      html += '<div class="tg-sum-tools"><button type="button" class="tg-btn is-primary" data-act="apply-suggest"' + (defs.length ? '' : ' disabled') + '>ใช้เกรดแนะนำทั้งหมด</button><button type="button" class="tg-btn" data-act="toggle-rule" aria-expanded="' + !!tgState.showRule + '">เกณฑ์เกรด</button></div>';
      if (tgState.showRule) html += '<p class="tg-note">เกรดแนะนำ (จุดสีม่วง) คิดจากคะแนนชิ้นงานรวม: 80%+ = 4 · 75% = 3.5 · 70% = 3 · 65% = 2.5 · 60% = 2 · 55% = 1.5 · 50% = 1 · ต่ำกว่า = 0 แตะตัวเลขเพื่อเลือกเกรดเองได้</p>';
      html += '<ul class="tg-list">' + students.map((s) => {
        const sid = cleanId(s.studentId);
        const t = tgTotals(sid, subj, defs);
        const sug = t.any ? suggestGrade(t.pct) : null;
        const edits = tgState.gradeEdits[subj] || {};
        const saved = tgSavedGrade(s, subj);
        const chosen = edits[sid] !== undefined ? edits[sid] : saved;
        return '<li class="tg-sum"><div class="tg-sum-top"><span class="tg-row-name">' + esc(s.fullName || sid) + '</span><span>' + (defs.length ? fmtNum(t.got) + '/' + fmtNum(t.max) + (t.any ? ' · ' + t.pct + '%' : '') : esc(sid)) + '</span></div>' +
          '<div class="tg-grades" role="radiogroup" aria-label="เกรดของ ' + esc(s.fullName || sid) + '">' + GRADE_VALUES.map((g) =>
            '<button type="button" role="radio" class="tg-g' + (sug === g ? ' is-suggest' : '') + '" data-sid="' + esc(sid) + '" data-grade="' + g + '" aria-checked="' + (chosen === g ? 'true' : 'false') + '"' + (sug === g ? ' aria-description="เกรดที่ระบบแนะนำ"' : '') + '>' + g + '</button>'
          ).join('') + '</div></li>';
      }).join('') + '</ul>';
      if (!students.length) html += '<div class="tg-empty">ไม่พบนักเรียนในระดับชั้นที่เลือก</div>';
    }
    body.innerHTML = html;
    tgUpdateSaveBar();
  }

  function tgUpdateSaveBar() {
    const subj = tgSubject();
    const txt = document.getElementById('tgSaveText');
    const btn = document.getElementById('tgSaveBtn');
    if (!txt || !btn) return;
    const n = subj ? tgDirtyCount(subj) : 0;
    btn.disabled = tgState.saving || n === 0;
    const bar = btn.closest('.tg-save'); if (bar) bar.classList.toggle('is-dirty', n > 0 || tgState.saving);
    btn.textContent = tgState.saving ? 'กำลังบันทึก...' : (n ? 'บันทึก (' + n + ')' : 'บันทึก');
    if (n > 0) { txt.textContent = 'มีการแก้ไข ' + n + ' รายการ ยังไม่ได้บันทึก'; return; }
    if (tgState.tab === 'scores') {
      const defs = tgAssignments(subj);
      const a = defs.find((x) => x.id === tgState.active[subj]);
      if (!a) { txt.textContent = 'เพิ่มชิ้นงานเพื่อเริ่มกรอกคะแนน'; return; }
      const missing = tgStudents().filter((s) => tgScoreOf(cleanId(s.studentId), subj, a.id) === '').length;
      txt.textContent = missing ? 'ยังไม่กรอก ' + missing + ' คนในชิ้นงานนี้' : 'กรอกครบทุกคนแล้ว';
    } else {
      txt.textContent = 'จุดสีฟ้า = เกรดที่ระบบแนะนำ';
    }
  }

  function tgPersistAssignments(subj, defs) {
    if (typeof saveSubjectAssignments === 'function') saveSubjectAssignments(subj, defs);
  }

  function bindTeacherGradesV8() {
    const root = document.getElementById('tgRoot');
    if (!root || root.dataset.bound) return;
    root.dataset.bound = '1';
    document.getElementById('tgTabs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      tgState.tab = b.dataset.tab;
      tgState.adding = false;
      renderTeacherGradesV8();
    });
    const body = document.getElementById('tgBody');
    body.addEventListener('click', (e) => {
      const subj = tgSubject();
      const chip = e.target.closest('.tg-chip[data-asg]');
      if (chip) { tgState.active[subj] = chip.dataset.asg; tgState.adding = false; if (tgState.mode === 'grid') { tgState.mode = 'one'; try { localStorage.setItem('k8_tg_view', 'one'); } catch (er) {} } renderTeacherGradesV8(); return; }
      const md = e.target.closest('.tg-mode [data-mode]');
      if (md) { tgState.mode = md.dataset.mode; try { localStorage.setItem('k8_tg_view', tgState.mode); } catch (er) {} renderTeacherGradesV8(); return; }
      const act = e.target.closest('[data-act]');
      if (act) {
        const kind = act.dataset.act;
        if (kind === 'open-add') { tgState.adding = true; renderTeacherGradesV8(); const t = document.getElementById('tgNewTitle'); if (t) t.focus(); }
        if (kind === 'cancel-add') { tgState.adding = false; renderTeacherGradesV8(); }
        if (kind === 'toggle-rule') { tgState.showRule = !tgState.showRule; renderTeacherGradesV8(); }
        if (kind === 'apply-suggest') {
          const defs2 = tgAssignments(subj); let n = 0;
          tgState.gradeEdits[subj] = tgState.gradeEdits[subj] || {};
          tgStudents().forEach((s) => { const sid = cleanId(s.studentId); const t = tgTotals(sid, subj, defs2); if (t.any) { tgState.gradeEdits[subj][sid] = suggestGrade(t.pct); n++; } });
          renderTeacherGradesV8();
          showToast(n ? 'ใส่เกรดแนะนำให้ ' + n + ' คนแล้ว ตรวจสอบแล้วกดบันทึก' : 'ยังไม่มีคะแนนชิ้นงานให้คำนวณ', n ? 'success' : 'warning');
        }
        if (kind === 'confirm-add') {
          const title = (document.getElementById('tgNewTitle').value || '').trim();
          const max = parseFloat(String(document.getElementById('tgNewMax').value || '').replace(',', '.'));
          if (!title) { showToast('กรุณาตั้งชื่อชิ้นงาน', 'warning'); return; }
          if (!(max > 0)) { showToast('คะแนนเต็มต้องมากกว่า 0', 'warning'); return; }
          const defs = tgAssignments(subj).slice();
          const used = defs.reduce((t, d) => t + (Number(d.maxScore) || 0), 0);
          if (used + max > TG_TOTAL_MAX + 1e-9) { const left = Math.max(0, Math.round((TG_TOTAL_MAX - used) * 100) / 100); showToast(left > 0 ? 'คะแนนเต็มรวมทุกชิ้นงานได้ไม่เกิน ' + TG_TOTAL_MAX + ' · ชิ้นนี้ใส่ได้สูงสุด ' + left + ' คะแนน' : 'คะแนนเต็มรวมครบ ' + TG_TOTAL_MAX + ' แล้ว ลบหรือแก้ชิ้นงานเดิมก่อนเพิ่มใหม่', 'warning'); const mx = document.getElementById('tgNewMax'); if (mx && left > 0) { mx.value = left; mx.focus(); } return; }
          const id = 'asg_' + Date.now();
          defs.push({ id, title, maxScore: max });
          tgPersistAssignments(subj, defs);
          tgState.active[subj] = id;
          tgState.adding = false;
          renderTeacherGradesV8();
          showToast('เพิ่มชิ้นงาน "' + title + '" (เต็ม ' + max + ') แล้ว', 'success');
        }
        if (kind === 'remove-asg') {
          const defs = tgAssignments(subj);
          const a = defs.find((x) => x.id === tgState.active[subj]);
          if (!a) return;
          if (!confirm('ลบชิ้นงาน "' + a.title + '" และคะแนนของชิ้นงานนี้ทั้งหมดใช่หรือไม่?')) return;
          tgPersistAssignments(subj, defs.filter((x) => x.id !== a.id));
          tgState.active[subj] = null;
          renderTeacherGradesV8();
          showToast('ลบชิ้นงานแล้ว', 'info');
        }
        return;
      }
      const g = e.target.closest('.tg-g[data-grade]');
      if (g) {
        tgState.gradeEdits[subj] = tgState.gradeEdits[subj] || {};
        tgState.gradeEdits[subj][g.dataset.sid] = Number(g.dataset.grade);
        g.parentElement.querySelectorAll('.tg-g').forEach((x) => x.setAttribute('aria-checked', x === g ? 'true' : 'false'));
        tgUpdateSaveBar();
      }
    });
    body.addEventListener('keydown', (e) => {
      const inp = e.target.closest('input[data-sid][data-asg]');
      if (!inp || e.key !== 'Enter') return;
      e.preventDefault();
      const all = tgState.mode === 'grid' && inp.closest('.tg-grid')
        ? Array.from(body.querySelectorAll('input[data-asg="' + CSS.escape(inp.dataset.asg) + '"]'))
        : Array.from(body.querySelectorAll('input[data-sid][data-asg]'));
      const nx = all[all.indexOf(inp) + 1];
      if (nx) { nx.focus(); nx.select(); } else inp.blur();
    });
    body.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'tgSearch') {
        tgState.search = e.target.value;
        const pos = e.target.selectionStart;
        renderTeacherGradesV8();
        const ns = document.getElementById('tgSearch'); if (ns) { ns.focus(); try { ns.setSelectionRange(pos, pos); } catch (er) {} }
        return;
      }
      const inp = e.target.closest('input[data-sid][data-asg]');
      if (!inp) return;
      const subj = tgSubject();
      const sid = inp.dataset.sid, asg = inp.dataset.asg;
      let raw = inp.value.trim().replace(',', '.').replace(/[^0-9.]/g, '');
      const firstDot = raw.indexOf('.'); if (firstDot !== -1) raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, '');
      const mx = Number(inp.dataset.max);
      if (raw !== '' && !isNaN(Number(raw)) && Number(raw) > mx) {
        raw = String(mx);
        if (!inp.dataset.warned) { inp.dataset.warned = '1'; showToast('ชิ้นงานนี้เต็ม ' + fmtNum(mx) + ' คะแนน ใส่เกินไม่ได้', 'warning'); setTimeout(() => { delete inp.dataset.warned; }, 2500); }
      }
      if (inp.value !== raw) inp.value = raw;
      const n = Number(raw);
      const bad = raw !== '' && (isNaN(n) || n < 0 || n > mx);
      inp.classList.toggle('is-bad', bad);
      const m = tgLoadScores();
      m[sid] = m[sid] || {}; m[sid][subj] = m[sid][subj] || {};
      m[sid][subj][asg] = raw === '' ? '' : (bad ? raw : n);
      tgState.dirty[subj] = tgState.dirty[subj] || {};
      tgState.dirty[subj][sid] = tgState.dirty[subj][sid] || {};
      tgState.dirty[subj][sid][asg] = true;
      const t = tgTotals(sid, subj, tgAssignments(subj));
      const sub = body.querySelector('[data-total-for="' + CSS.escape(sid) + '"]');
      if (sub) sub.textContent = sid + ' · รวม ' + fmtNum(t.got) + ' / ' + fmtNum(t.max);
      const gsum = body.querySelector('[data-gridsum-for="' + CSS.escape(sid) + '"]');
      if (gsum) gsum.textContent = fmtNum(t.got);
      tgUpdateSaveBar();
    });
  }

  async function saveTeacherGradesV8() {
    const subj = tgSubject();
    if (!subj || tgState.saving) return;
    const defs = tgAssignments(subj);
    const subjObj = (typeof appSubjects !== 'undefined' ? appSubjects : []).find((x) => x.id === subj) || { id: subj, name: subj };
    const m = tgLoadScores();

    // ตรวจคะแนนที่ไม่ถูกต้องก่อน
    const dirty = tgState.dirty[subj] || {};
    const scores = {};
    let bad = 0;
    Object.keys(dirty).forEach((sid) => {
      Object.keys(dirty[sid]).forEach((asg) => {
        const def = defs.find((a) => a.id === asg);
        const v = m[sid] && m[sid][subj] ? m[sid][subj][asg] : '';
        if (!def) return;
        if (v !== '' && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > Number(def.maxScore))) { bad++; return; }
        scores[sid] = scores[sid] || {};
        scores[sid][asg] = v === '' ? '' : Number(v);
      });
    });
    if (bad) { showToast('มีคะแนน ' + bad + ' ช่องที่ไม่ถูกต้อง (เกินคะแนนเต็มหรือไม่ใช่ตัวเลข) กรุณาแก้ไขก่อน', 'error'); return; }

    const gradeEdits = tgState.gradeEdits[subj] || {};
    const gradeSids = Object.keys(gradeEdits);
    if (!Object.keys(scores).length && !gradeSids.length) { showToast('ยังไม่มีการแก้ไขที่ต้องบันทึก', 'info'); return; }

    tgState.saving = true;
    tgUpdateSaveBar();
    try {
      if (Object.keys(scores).length) {
        const res = await gasApiCall('saveAssignmentScores', { data: { subjectId: subj, subjectName: subjObj.name, assignments: defs, scores } });
        if (!res || !res.success) throw new Error((res && (res.message || res.error)) || 'บันทึกคะแนนไม่สำเร็จ');
        tgState.dirty[subj] = {};
        localStorage.setItem('khalifah_student_assignment_scores', JSON.stringify(m));
      }
      if (gradeSids.length) {
        const studentGrades = [];
        gradeSids.forEach((sid) => {
          const st = allStudents.find((x) => sameId(x.studentId, sid));
          if (!st) return;
          const g = gradeEdits[sid];
          const t = tgTotals(sid, subj, defs);
          st.subjectGrades = st.subjectGrades || {};
          st.skills = st.skills || {};
          st.subjectGrades[subj] = g;
          st.skills[subj] = g;
          const arr = Array.isArray(st.grades) ? st.grades.filter((x) => x && x.code !== subj) : [];
          arr.push({ code: subj, name: subjObj.name, grade: g, score: t.any ? t.pct : Math.round(g * 25) });
          st.grades = arr;
          const gpax = (typeof recalculateStudentGpa === 'function') ? recalculateStudentGpa(st) : '';
          studentGrades.push({ studentId: cleanId(st.studentId), fullName: st.fullName, grade: st.grade, gradeVal: g, score: t.any ? t.pct : Math.round(g * 25), gpax, grades: arr });
        });
        const res = await gasApiCall('saveSubjectGrades', { data: { subjectCode: subj, subjectName: subjObj.name, teacherId: currentAdmin ? currentAdmin.username : 'Teacher', studentGrades } });
        if (!res || !res.success) throw new Error((res && (res.message || res.error)) || 'บันทึกเกรดไม่สำเร็จ');
        tgState.gradeEdits[subj] = {};
        localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
      }
      if (typeof playSuccessSound === 'function') playSuccessSound();
      showToast('บันทึกคะแนนและเกรดวิชา ' + subjObj.name + ' ลง Google Sheets แล้ว', 'success');
    } catch (err) {
      showToast('บันทึกไม่สำเร็จ: ' + (err && err.message ? err.message : (typeof describeNetworkError === 'function' ? describeNetworkError(err) : err)), 'error');
    } finally {
      tgState.saving = false;
      renderTeacherGradesV8();
    }
  }

  // แทนที่ตัวเรนเดอร์/บันทึกเดิมของหน้าเกรดอาจารย์
  window.renderTeacherGradesPortalTable = function () {
    try { bindTeacherGradesV8(); renderTeacherGradesV8(); } catch (err) { console.warn('teacher grades v8 error', err); }
  };
  window.renderTeacherPortalGradesTable = window.renderTeacherGradesPortalTable;
  window.saveTeacherPortalGrades = saveTeacherGradesV8;

  // ชิ้นงานบันทึกขึ้นเซิร์ฟเวอร์ทันที เพื่อให้ทุกเครื่อง (และนักเรียน) เห็นตรงกัน
  if (typeof window.saveSubjectAssignments === 'function') {
    const origSaveAsg = window.saveSubjectAssignments;
    window.saveSubjectAssignments = function (subjectId, assignments) {
      origSaveAsg.apply(this, arguments);
      if (typeof gasApiCall === 'function' && getSessionToken && getSessionToken()) {
        gasApiCall('saveSubjectAssignments', { data: { subjectId, assignments } })
          .then((res) => { if (res && res.success === false) showToast(res.message || 'บันทึกชิ้นงานไม่สำเร็จ', 'error'); })
          .catch(() => showToast('บันทึกชิ้นงานไม่สำเร็จ (ออฟไลน์?) ลองใหม่อีกครั้ง', 'warning'));
      }
    };
  }

  // เริ่มทำงานหลังหน้าโหลด
  function boot() {
    window.renderHomeF();
    if (document.getElementById('tgRoot')) window.renderTeacherGradesPortalTable();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ---------------- v8 รอบ 2: ภาพรวมอาจารย์ (สิ่งที่ต้องทำ + ต้องติดตาม) ---------------- */
(function () {
  'use strict';
  const esc = (v) => (typeof escapeHtml === 'function' ? escapeHtml(v) : String(v == null ? '' : v));
  const readJSON = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? f : v; } catch (e) { return f; } };
  const pad2 = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());

  function renderTeacherTodo() {
    const list = document.getElementById('k8TodoList');
    const follow = document.getElementById('k8FollowList');
    if (!list || !follow) return;
    const students = (typeof allStudents !== 'undefined' && Array.isArray(allStudents)) ? allStudents.filter((s) => !/ลาออก|สำเร็จ/.test(String(s.status || ''))) : [];
    const today = ymd(new Date());

    // 1) เช็คชื่อวันนี้
    const logs = readJSON('khalifah_daily_attendance_logs', {});
    const todayMap = logs[today] || {};
    const cloudAtt = readJSON('khalifah_attendance_logs', []);
    const checkedIds = new Set(Object.keys(todayMap));
    cloudAtt.forEach((r) => { if (r && r.date === today) checkedIds.add(String(r.studentId)); });
    const notChecked = students.filter((s) => !checkedIds.has(String(s.studentId)) && !checkedIds.has(String(s.studentId).replace(/^0+/, ''))).length;

    // 2) คำขอละหมาดย้อนหลังที่รออนุมัติ
    const approvals = readJSON('khalifah_prayer_approvals', []);
    const pendingLate = approvals.filter((a) => a && String(a.status || 'pending').toLowerCase() === 'pending').length;

    // 3) ความคืบหน้าเกรดวิชาแรกที่รับผิดชอบ
    const subjSel = document.getElementById('teacherPortalSubjectSelect');
    const subjId = subjSel && subjSel.value;
    const subjName = subjSel && subjSel.selectedOptions[0] ? subjSel.selectedOptions[0].textContent : '';
    let graded = 0;
    if (subjId) {
      students.forEach((s) => {
        const g = s.subjectGrades && s.subjectGrades[subjId];
        if (g !== undefined && g !== null && g !== '' && Number(g) > 0) graded++;
      });
    }

    // 4) กิจกรรมใน 7 วัน
    const acts = (typeof activities !== 'undefined' && Array.isArray(activities)) ? activities : [];
    const now = new Date(); const in7 = new Date(now.getTime() + 7 * 864e5);
    const soon = acts.filter((a) => { const d = new Date(a.startDate || a.date); return !isNaN(d) && d >= new Date(ymd(now)) && d <= in7; }).length;

    const rows = [
      (function () {
        let a = null; try { a = currentAdmin; } catch (e) {}
        let subs = []; try { subs = appSubjects || []; } catch (e) {}
        const mine = a && Array.isArray(a.assignedSubjects) ? a.assignedSubjects.map(String) : [];
        const my = subs.filter((x) => mine.indexOf(String(x.id)) !== -1 || mine.indexOf(String(x.code)) !== -1);
        if (!my.length) return { n: notChecked, title: 'เช็คชื่อมาเรียนวันนี้', sub: notChecked ? 'ยังไม่เช็ค ' + notChecked + ' คน' : 'เช็คครบทุกคนแล้ว', bg: notChecked ? '#fffbeb' : '#f0fdf4', ink: notChecked ? '#b45309' : '#15803d', go: "switchTeacherTab('attendance')" };
        const done = new Set(cloudAtt.filter((r) => r && r.date === today && r.subjectCode).map((r) => String(r.subjectCode)));
        const left = my.filter((x) => !done.has(String(x.id)));
        return { n: left.length, title: 'เช็คชื่อรายวิชาวันนี้', sub: left.length ? 'ยังไม่เช็ค: ' + left.map((x) => x.name).join(', ') : 'เช็คครบทุกวิชาแล้ว', bg: left.length ? '#fffbeb' : '#f0fdf4', ink: left.length ? '#b45309' : '#15803d', go: "switchTeacherTab('attendance')" };
      })(),
      (typeof currentAdmin !== 'undefined' && currentAdmin && currentAdmin.role === 'SuperAdmin')
        ? { n: pendingLate, title: 'คำขอละหมาดย้อนหลัง', sub: pendingLate ? 'รออนุมัติ ' + pendingLate + ' รายการ' : 'ไม่มีคำขอค้าง', bg: '#eff6ff', ink: '#1d4ed8', go: "openPrayerApprovalsV8()" }
        : null,
      { n: subjId ? students.length - graded : 0, title: 'เกรด' + (subjName ? ' ' + subjName.replace(/^[A-Z0-9]+ - /, '') : ''), sub: subjId ? 'ให้เกรดแล้ว ' + graded + ' จาก ' + students.length + ' คน' : 'ยังไม่มีวิชาที่รับผิดชอบ', bg: '#e0f2fe', ink: '#0369a1', go: "switchTeacherTab('grades')" },
      { n: soon, title: 'กิจกรรมใกล้ถึง', sub: soon ? soon + ' กิจกรรมภายใน 7 วัน' : 'ไม่มีกิจกรรมใน 7 วัน', bg: '#f0fdf4', ink: '#15803d', go: "switchTeacherTab('calendar')" }
    ];
    list.innerHTML = rows.filter(Boolean).map((r) =>
      '<button type="button" class="k8-todo-row" onclick="' + r.go + '"><span class="k8-todo-badge" style="background:' + r.bg + ';color:' + r.ink + '">' + r.n + '</span>' +
      '<span class="k8-todo-text"><b>' + esc(r.title) + '</b><span>' + esc(r.sub) + '</span></span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>'
    ).join('');

    // ต้องติดตาม: ขาด/สาย >= 3 ครั้งในสัปดาห์นี้
    const d0 = new Date(); const dow = (d0.getDay() + 6) % 7; d0.setDate(d0.getDate() - dow);
    const start = ymd(d0);
    const counts = {};
    const bump = (sid, st, date) => {
      if (!date || date < start) return;
      const k = String(sid).replace(/^0+/, '');
      counts[k] = counts[k] || { absent: 0, late: 0 };
      if (/ขาด|absent/i.test(st)) counts[k].absent++;
      else if (/สาย|late/i.test(st)) counts[k].late++;
    };
    cloudAtt.forEach((r) => r && bump(r.studentId, String(r.status || ''), r.date));
    Object.keys(logs).forEach((date) => Object.keys(logs[date] || {}).forEach((sid) => bump(sid, logs[date][sid], date)));
    const flagged = students
      .map((s) => ({ s, c: counts[String(s.studentId).replace(/^0+/, '')] || { absent: 0, late: 0 } }))
      .filter((x) => x.c.absent >= 3 || x.c.late >= 3)
      .slice(0, 12);
    follow.innerHTML = flagged.length
      ? flagged.map((x) => {
          const isAbs = x.c.absent >= 3;
          return '<span class="k8-chip ' + (isAbs ? 'is-abs' : 'is-late') + '" title="' + esc(x.s.fullName) + '">' + esc(x.s.fullName) + ' · ' + (isAbs ? 'ขาด ' + x.c.absent : 'สาย ' + x.c.late) + '</span>';
        }).join('')
      : '<span class="k8-follow-empty">ยังไม่มีนักเรียนที่ต้องติดตามในสัปดาห์นี้</span>';
  }

  window.openPrayerApprovalsV8 = function () {
    switchView('admin');
    const btn = document.getElementById('btnAdminTabPrayers');
    if (typeof switchAdminTab === 'function') switchAdminTab('prayers-monitor', btn);
    if (typeof setAdminPrayerMode === 'function') setAdminPrayerMode('approvals');
  };
  window.renderTeacherTodoV8 = function () { try { renderTeacherTodo(); } catch (e) { console.warn('teacher todo', e); } };
  if (typeof window.renderTeacherOverviewBento === 'function') {
    const orig = window.renderTeacherOverviewBento;
    window.renderTeacherOverviewBento = function () { const r = orig.apply(this, arguments); window.renderTeacherTodoV8(); return r; };
  }
})();

/* ---------------- v8 รอบ 2: แอดมิน — ภาพรวม ---------------- */
(function () {
  'use strict';
  const esc = (v) => (typeof escapeHtml === 'function' ? escapeHtml(v) : String(v == null ? '' : v));
  const readJSON = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? f : v; } catch (e) { return f; } };
  const pad2 = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const GRADES = ['มัธยมศึกษาปีที่ 1', 'มัธยมศึกษาปีที่ 2', 'มัธยมศึกษาปีที่ 3', 'มัธยมศึกษาปีที่ 4', 'มัธยมศึกษาปีที่ 5', 'มัธยมศึกษาปีที่ 6'];

  function renderAdminOverview() {
    const kpiEl = document.getElementById('k8OvKpis');
    if (!kpiEl) return;
    const now = new Date();
    const today = ymd(now);
    document.getElementById('k8OvDate').textContent = TH_DAYS[now.getDay()] + ' ' + now.getDate() + ' ' + TH_MONTHS_FULL[now.getMonth()] + ' ' + (now.getFullYear() + 543);

    const students = (typeof allStudents !== 'undefined' ? allStudents : []).filter((s) => s && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(s.status || '')));
    const teachers = (typeof subAdmins !== 'undefined' ? subAdmins : []);
    const pendingReg = (typeof getPendingRegistrations === 'function' ? getPendingRegistrations() : []).filter((p) => p && (p.status === 'PendingAdmin' || p.status === 'pending'));
    const awaitingOtp = (typeof getPendingRegistrations === 'function' ? getPendingRegistrations() : []).filter((p) => p && p.status === 'Approved');
    const lateReq = readJSON('khalifah_prayer_approvals', []).filter((a) => a && String(a.status || 'pending').toLowerCase() === 'pending');

    // มาเรียนวันนี้
    const att = readJSON('khalifah_attendance_logs', []).filter((r) => r && r.date === today);
    const local = (readJSON('khalifah_daily_attendance_logs', {})[today]) || {};
    const status = {};
    att.forEach((r) => { status[String(r.studentId).replace(/^0+/, '')] = String(r.status || ''); });
    Object.keys(local).forEach((sid) => { status[String(sid).replace(/^0+/, '')] = local[sid]; });
    let present = 0, late = 0, leave = 0, absent = 0;
    Object.values(status).forEach((st) => {
      if (/สาย|late/i.test(st)) late++;
      else if (/ลา|leave|excuse/i.test(st)) leave++;
      else if (/ขาด|absent/i.test(st)) absent++;
      else present++;
    });
    const checked = present + late + leave + absent;
    const attPct = checked ? Math.round((present + late) / checked * 100) : 0;

    // ละหมาดวันนี้ตามชั้น (นับคนที่ละหมาดอย่างน้อย 1 เวลาในช่วงปัจจุบัน → ใช้จำนวนเวลาที่ผ่านมาแล้ว)
    const hist = readJSON('khalifah_prayer_history', []);
    const todayRec = [...(typeof todayPrayers !== 'undefined' ? todayPrayers : []), ...hist].filter((p) => p && (p.date === today || String(p.timestamp || '').startsWith(today)));
    const seen = {};
    todayRec.forEach((p) => {
      const slot = typeof normalizePrayerSlotKey === 'function' ? normalizePrayerSlotKey(p.prayerTime || p.prayerName || '') : p.prayerTime;
      seen[String(p.studentId).replace(/^0+/, '') + '|' + slot] = true;
    });
    const wins = (typeof PRAYER_TIME_WINDOWS !== 'undefined') ? PRAYER_TIME_WINDOWS : [];
    const cur = now.getHours() * 60 + now.getMinutes();
    const passed = wins.filter((w) => cur >= w.startMin).length || 1;
    let totalDone = 0;
    const byGrade = GRADES.map((g) => {
      const list = students.filter((s) => s.grade === g);
      let done = 0;
      list.forEach((s) => {
        const k = String(s.studentId).replace(/^0+/, '');
        wins.slice(0, passed).forEach((w) => { if (seen[k + '|' + w.name]) done++; });
      });
      totalDone += done;
      const possible = list.length * passed;
      return { label: g.replace('มัธยมศึกษาปีที่ ', 'ม.'), n: list.length, pct: possible ? Math.round(done / possible * 100) : 0 };
    });
    const prayPossible = students.length * passed;
    const prayPct = prayPossible ? Math.round(totalDone / prayPossible * 100) : 0;
    document.getElementById('k8OvPraySlot').textContent = passed + ' เวลาที่ผ่านมาแล้ว';

    const kpis = [
      { label: 'นักเรียนกำลังศึกษา', value: students.length + ' คน', sub: 'อาจารย์/บุคลากร ' + teachers.length + ' ท่าน', go: "switchAdminTab('students', document.getElementById('btnAdminTabStudents'))" },
      { label: 'มาเรียนวันนี้', value: checked ? attPct + '%' : '–', sub: checked ? 'มา ' + present + ' · สาย ' + late + ' · ลา ' + leave + ' · ขาด ' + absent : 'ยังไม่มีการเช็คชื่อวันนี้', go: "switchView('teacher'); switchTeacherTab('attendance')" },
      { label: 'ละหมาดวันนี้', value: prayPct + '%', sub: totalDone + ' จาก ' + prayPossible + ' ครั้งที่ควรมี', go: "switchAdminTab('prayers-monitor', document.getElementById('btnAdminTabPrayers'))" },
      { label: 'รอดำเนินการ', value: String(pendingReg.length + lateReq.length), sub: 'บัญชีใหม่ ' + pendingReg.length + ' · ละหมาดย้อนหลัง ' + lateReq.length, go: "switchAdminTab('approvals', document.getElementById('btnAdminTabApprovals'))" }
    ];
    kpiEl.innerHTML = kpis.map((k) => '<button type="button" class="k8-kpi" onclick="' + k.go + '"><span class="k8-kpi-label">' + esc(k.label) + '</span><span class="k8-kpi-val">' + esc(k.value) + '</span><span class="k8-kpi-sub">' + esc(k.sub) + '</span></button>').join('');

    const notCheckedClasses = GRADES.filter((g) => {
      const list = students.filter((s) => s.grade === g);
      return list.length && !list.some((s) => status[String(s.studentId).replace(/^0+/, '')] !== undefined);
    });
    const acts = (typeof activities !== 'undefined' ? activities : []);
    const in7 = new Date(now.getTime() + 7 * 864e5);
    const soon = acts.filter((a) => { const d = new Date(a.startDate || a.date); return !isNaN(d) && d >= new Date(today) && d <= in7; });
    const todo = [
      { n: pendingReg.length, label: 'บัญชีใหม่รออนุมัติและส่งรหัสยืนยัน', cta: 'ตรวจสอบ', bg: '#fffbeb', ink: '#b45309', go: "switchAdminTab('approvals', document.getElementById('btnAdminTabApprovals'))" },
      { n: lateReq.length, label: 'คำขอละหมาดย้อนหลัง', cta: 'ตรวจสอบ', bg: '#eff6ff', ink: '#1d4ed8', go: 'openPrayerApprovalsV8()' },
      { n: awaitingOtp.length, label: 'อนุมัติแล้ว รอผู้สมัครกรอกรหัส', cta: 'ดู', bg: '#e0f2fe', ink: '#0369a1', go: "switchAdminTab('approvals', document.getElementById('btnAdminTabApprovals'))" },
      { n: notCheckedClasses.length, label: notCheckedClasses.length ? 'ห้องที่ยังไม่เช็คชื่อ: ' + notCheckedClasses.map((g) => g.replace('มัธยมศึกษาปีที่ ', 'ม.')).join(', ') : 'ทุกห้องเช็คชื่อแล้ว', cta: 'เช็คชื่อ', bg: notCheckedClasses.length ? '#fef2f2' : '#f0fdf4', ink: notCheckedClasses.length ? '#b91c1c' : '#15803d', go: "switchView('teacher'); switchTeacherTab('attendance')" },
      { n: soon.length, label: 'กิจกรรมภายใน 7 วัน', cta: 'จัดการ', bg: '#f0fdf4', ink: '#15803d', go: "switchAdminTab('activities-admin', document.getElementById('btnTabActivitiesAdmin'))" }
    ];
    const todoShown = todo.filter((t) => +t.n > 0);
    document.getElementById('k8OvTodo').innerHTML = (todoShown.length ? '' : '<div class="k8-li-empty" style="text-align:left;padding:12px 0">ไม่มีงานค้าง เรียบร้อยดี ✓</div>') + todoShown.map((t) =>
      '<button type="button" class="k8-todo-row" onclick="' + t.go + '"><span class="k8-todo-badge" style="background:' + t.bg + ';color:' + t.ink + '">' + t.n + '</span><span class="k8-todo-text"><b>' + esc(t.label) + '</b></span><span class="k8-todo-cta">' + t.cta + '</span></button>'
    ).join('');

    document.getElementById('k8OvPray').innerHTML = byGrade.map((g) =>
      '<div class="k8-gbar"><span class="k8-gbar-l">' + g.label + '</span><span class="k8-gbar-track" role="img" aria-label="' + g.label + ' ' + g.pct + ' เปอร์เซ็นต์"><span style="width:' + g.pct + '%;background:' + (g.pct < 70 ? '#f59e0b' : '#0369a1') + '"></span></span><span class="k8-gbar-v">' + (g.n ? g.pct + '%' : '–') + '</span></div>'
    ).join('');
  }

  window.renderAdminOverviewV8 = function () { try { renderAdminOverview(); } catch (e) { console.warn('admin overview', e); } };

  if (typeof window.switchAdminTab === 'function') {
    const orig = window.switchAdminTab;
    window.switchAdminTab = function (tabName) {
      const r = orig.apply(this, arguments);
      if (tabName === 'overview') window.renderAdminOverviewV8();
      const kpi = document.getElementById('adminKpiOverviewGrid');
      if (kpi) kpi.style.display = 'none';
      return r;
    };
  }
  let adminOpenedOnce = false;
  if (typeof window.switchView === 'function') {
    const origSV = window.switchView;
    window.switchView = function (viewName) {
      const r = origSV.apply(this, arguments);
      const adminActive = document.getElementById('view-admin') && document.getElementById('view-admin').classList.contains('active');
      if (viewName === 'admin' && adminActive && !adminOpenedOnce) {
        adminOpenedOnce = true;
        window.switchAdminTab('overview', document.getElementById('btnAdminTabOverview'));
      }
      return r;
    };
  }
  if (typeof window.renderSuperAdminOverviewKpis === 'function') {
    const origK = window.renderSuperAdminOverviewKpis;
    window.renderSuperAdminOverviewKpis = function () {
      const r = origK.apply(this, arguments);
      const ov = document.getElementById('admin-tab-overview');
      if (ov && ov.style.display !== 'none') window.renderAdminOverviewV8();
      return r;
    };
  }
})();

/* ============ Round 3 · Login page (canvas Login / Register) ============ */
(function () {
  function syncAuthState() {
    const m = document.getElementById('authModal');
    if (!m) return;
    const role = (typeof currentAuthRole !== 'undefined' && currentAuthRole) || 'student';
    const regS = document.getElementById('registerFormSection');
    const regT = document.getElementById('teacherRegisterSection');
    const isReg = role === 'student' ? (regS && regS.style.display !== 'none' && regS.style.display !== '')
      : role === 'teacher' ? (regT && regT.style.display !== 'none' && regT.style.display !== '') : false;
    m.dataset.role = role;
    m.dataset.mode = isReg ? 'register' : 'login';
    const t = document.getElementById('authModalTitle');
    if (t && isReg) t.innerHTML = '<span class="k8-auth-h1">สมัครบัญชีใหม่</span><span class="k8-auth-h2">แอดมินจะตรวจสอบ แล้วส่งรหัสยืนยันทางอีเมล</span>';
  }
  ['selectAuthRole', 'toggleAuthForm', 'toggleTeacherAuthForm', 'handleAuthModeSegmentChange'].forEach(function (fn) {
    const orig = window[fn];
    if (typeof orig !== 'function') return;
    window[fn] = function () { const r = orig.apply(this, arguments); try { syncAuthState(); } catch (e) {} return r; };
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncAuthState); else syncAuthState();
})();

/* ============ Round 3 · Prayer check page (canvas Prayer) ============ */
(function () {
  const pad = n => String(n).padStart(2, '0');
  const fmtMin = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  function slotKey(x) { try { return typeof normalizePrayerSlotKey === 'function' ? normalizePrayerSlotKey(x) : x; } catch (e) { return x; } }
  function currentSlot() {
    try { if (selectedPrayerTime) return selectedPrayerTime; } catch (e) {}
    const now = new Date(), cur = now.getHours() * 60 + now.getMinutes();
    try {
      const w = PRAYER_TIME_WINDOWS.find(w => cur >= w.startMin - 30 && cur <= w.endMin + 30);
      if (w) return w.name;
      if (cur < PRAYER_TIME_WINDOWS[0].startMin) return 'อีชาอ์';
    } catch (e) {}
    return 'ซุบฮิ';
  }
  function isDone(slot) {
    try {
      const list = getStudentTodayPrayersList() || [];
      const k = slotKey(slot);
      return list.some(p => slotKey(p.prayerName || p.prayerTime || p.timeSlot || '') === k);
    } catch (e) { return false; }
  }
  const DEFAULT_TXT = { 1: 'ตรวจพิกัด & เปิดกล้อง', 2: 'ถ่ายภาพ' };
  function relabelBtn() {
    const t = document.getElementById('btnCaptureInstantText');
    if (!t) return;
    const txt = t.textContent || '';
    if (/1\.\s*ตรวจสอบพิกัด/.test(txt) && !/กำลัง/.test(txt)) t.textContent = DEFAULT_TXT[1];
    else if (/2\.\s*ถ่ายรูป/.test(txt) && !/กำลัง/.test(txt)) t.textContent = DEFAULT_TXT[2];
  }
  window.updatePrayerV8 = function () {
    const root = document.getElementById('view-prayer');
    if (!root) return;
    const slot = currentSlot();
    const title = document.getElementById('k8PrTitle');
    if (title) title.textContent = 'เช็คชื่อละหมาด' + slot;
    let range = '-';
    try {
      const w = PRAYER_TIME_WINDOWS.find(w => w.name === slotKey(slot) || w.key === slotKey(slot));
      if (w) range = slotKey(slot) === 'อีชาอ์' ? fmtMin(w.startMin) + '–ก่อนรุ่งอรุณ' : fmtMin(w.startMin) + '–' + fmtMin(w.endMin);
    } catch (e) {}
    const now = new Date();
    const sub = document.getElementById('k8PrSub');
    if (sub) sub.textContent = 'ช่วงเวลา ' + range + ' · ตอนนี้ ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ' น.';

    const done = isDone(slot);
    let step = 1;
    try { step = prayerCheckStep === 2 ? 2 : 1; } catch (e) {}
    if (done) step = 3;
    document.querySelectorAll('#k8PrSteps li').forEach((li, i) => li.classList.toggle('on', i + 1 <= step));

    const loc = document.getElementById('k8PrLoc');
    let vl = null; try { vl = verifiedLocation; } catch (e) {}
    const lt = document.getElementById('k8PrLocTitle'), ld = document.getElementById('k8PrLocDesc');
    if (loc && lt && ld) {
      if (vl && vl.isWithinZone) {
        loc.dataset.state = 'in'; lt.textContent = 'อยู่ในพื้นที่ละหมาด';
        ld.textContent = (vl.locationName || 'มัสยิด') + (isFinite(vl.distanceMeters) ? ' · ห่าง ' + Math.round(vl.distanceMeters) + ' ม.' : '');
      } else if (vl) {
        loc.dataset.state = 'out'; lt.textContent = 'อยู่นอกพื้นที่ละหมาด';
        ld.textContent = (vl.locationName || 'ตำแหน่งปัจจุบัน') + (vl.formattedMosqueDist ? ' · ห่างมัสยิด ' + vl.formattedMosqueDist : '');
      } else if (done) {
        loc.dataset.state = 'in'; lt.textContent = 'เช็คชื่อเวลานี้เรียบร้อยแล้ว';
        ld.textContent = 'ไม่ต้องตรวจพิกัดซ้ำ · รอเช็คชื่อเวลาถัดไป';
      } else {
        loc.dataset.state = 'idle'; lt.textContent = 'ยังไม่ได้ตรวจพิกัด';
        ld.textContent = 'กดปุ่มด้านล่างเพื่อตรวจพิกัดและเปิดกล้อง';
      }
    }
    // move the main action button under the camera (canvas footer)
    const foot = document.getElementById('k8PrFoot'), btn = document.getElementById('btnCaptureInstant');
    if (foot && btn && btn.parentElement !== foot) foot.insertBefore(btn, foot.firstChild);
    const doneBox = document.getElementById('k8PrDone');
    if (doneBox) {
      doneBox.hidden = !done;
      const cd = document.getElementById('k8CamDone');
      if (cd) cd.hidden = !done;
      const cs = document.getElementById('k8CamDoneSub');
      if (cs) cs.textContent = 'ละหมาด' + slot + ' · ส่งถึงอาจารย์เรียบร้อย';
    }
    // watermark (canvas)
    try {
      const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      let st = null; try { st = currentStudent; } catch (e) {}
      const gm = st && String(st.grade || '').match(/(\d)/);
      const nameEl = document.getElementById('k8WmName'), lineEl = document.getElementById('k8WmLine');
      if (nameEl) nameEl.textContent = st ? (st.fullName || '-') + (gm ? ' · ม.' + gm[1] : '') : '-';
      if (lineEl) lineEl.textContent = slot + ' · ' + now.getDate() + ' ' + M[now.getMonth()] + ' ' + (now.getFullYear() + 543) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ' · ' + ((vl && vl.locationName) || 'กำลังระบุสถานที่');
      let live = false; try { live = !!activeCameraStream && prayerCheckStep === 2; } catch (e) {}
      const ph = document.getElementById('k8CamPh'); if (ph) ph.hidden = live;
    } catch (e) {}
    if (btn) btn.classList.toggle('k8-hide', done && step === 3 && (function () { try { return prayerCheckStep !== 2; } catch (e) { return true; } })());
    relabelBtn();
  };
  function hook(fn, after) {
    const orig = window[fn];
    if (typeof orig !== 'function') return;
    window[fn] = function () {
      const r = orig.apply(this, arguments);
      if (r && typeof r.then === 'function') r.then(() => { try { after(); } catch (e) {} }, () => { try { after(); } catch (e) {} });
      else try { after(); } catch (e) {}
      return r;
    };
  }
  const upd = () => window.updatePrayerV8();
  ['selectPrayerTime', 'handlePrayerMainButtonClick', 'switchView', 'autoSelectDetectedPrayerSlot', 'verifyGeolocation'].forEach(f => hook(f, upd));
  window.k8TogglePrayerMore = function () {
    const v = document.getElementById('view-prayer'); if (!v) return;
    const on = !v.classList.contains('k8-more'); v.classList.toggle('k8-more', on);
    const b = document.getElementById('k8PrMoreBtn'); if (b) b.setAttribute('aria-expanded', on);
    if (on) setTimeout(() => { const n = document.getElementById('prayerNotesCard'); if (n) n.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  };
  const svp = window.switchView;
  if (typeof svp === 'function') window.switchView = function (v) {
    const r = svp.apply(this, arguments);
    if (v === 'prayer') { try { if (typeof autoSelectDetectedPrayerSlot === 'function') autoSelectDetectedPrayerSlot(false); } catch (e) {} upd(); }
    return r;
  };
  function boot() {
    upd();
    const t = document.getElementById('btnCaptureInstantText');
    if (t && 'MutationObserver' in window) new MutationObserver(relabelBtn).observe(t, { childList: true, characterData: true, subtree: true });
    setInterval(() => { const v = document.getElementById('view-prayer'); if (v && v.classList.contains('active')) upd(); }, 5000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

/* ============ Round 3 · Hasanat (canvas: 3 tabs) ============ */
(function () {
  let haTab = 'quran';
  function syncTabs() {
    document.querySelectorAll('#k8HaTabs button').forEach(b => {
      const on = b.dataset.tab === haTab;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const d = document.getElementById('k8HaDate'), src = document.getElementById('hasanatDateDisplay');
    if (d) {
      try { d.textContent = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) {}
    }
  }
  const orig = window.switchHasanatSubTab;
  if (typeof orig === 'function') {
    window.switchHasanatSubTab = function (tab) {
      if (!tab || tab === 'all') tab = haTab || 'quran';
      haTab = tab;
      const r = orig.call(this, tab);
      syncTabs();
      return r;
    };
  }
  const sv = window.switchView;
  if (typeof sv === 'function') {
    window.switchView = function (v) {
      const r = sv.apply(this, arguments);
      if (v === 'hasanat') try { window.switchHasanatSubTab(haTab); } catch (e) {}
      return r;
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncTabs); else syncTabs();
})();
(function () {
  function memSync() {
    const src = document.getElementById('ovMemCountVal'), dst = document.getElementById('k8MemBig');
    if (src && dst) dst.textContent = (src.textContent || '0').trim();
  }
  function boot() {
    memSync();
    const src = document.getElementById('ovMemCountVal');
    if (src && 'MutationObserver' in window) new MutationObserver(memSync).observe(src, { childList: true, characterData: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

/* ============ Round 3 · Activities (canvas) ============ */
(function () {
  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function ymd(v) {
    const m = String(v || '').match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return null;
    let y = +m[1]; if (y > 2400) y -= 543;
    return new Date(y, +m[2] - 1, +m[3]);
  }
  function hhmm(v) { const m = String(v || '').match(/(\d{1,2}):(\d{2})/); return m ? m[1].padStart(2, '0') + ':' + m[2] : ''; }
  function sameId(a, b) { try { return typeof isIdMatch === 'function' ? isIdMatch(a, b) : String(a) === String(b); } catch (e) { return String(a) === String(b); } }
  let tab = 'upcoming';
  function myLogs() {
    let logs = []; try { logs = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]'); } catch (e) {}
    let sid = null; try { sid = currentStudent && currentStudent.studentId; } catch (e) {}
    return sid ? logs.filter((l) => l && sameId(l.studentId, sid)) : [];
  }
  window.renderActivitiesV8 = function () {
    const box = document.getElementById('k8ActList');
    if (!box) return;
    const logs = myLogs();
    const cnt = document.getElementById('k8ActCount');
    if (cnt) cnt.textContent = 'เข้าร่วมแล้ว ' + logs.length + ' ครั้ง';
    document.querySelectorAll('#k8ActTabs button').forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    let rows = [];
    if (tab === 'upcoming') {
      const acts = (typeof activities !== 'undefined' && Array.isArray(activities)) ? activities : [];
      const t = new Date(); const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
      rows = acts.map((a) => ({ a, d: ymd(a.startDate || a.date) })).filter((x) => x.d && x.d >= today).sort((x, y) => x.d - y.d)
        .map((x) => ({ d: x.d, title: x.a.title || x.a.activityTitle || '-', meta: [hhmm(x.a.startTime || x.a.time || x.a.startDate), x.a.location].filter(Boolean).join(' · ') || (x.a.type || 'กิจกรรม'),
          tag: +x.d === +today ? 'วันนี้' : ((String(x.a.title || '').match(/ม\.\s?[1-6]/) || ['ทุกคน'])[0].replace(/\s/g, '')), cls: 'up' }));
    } else {
      rows = logs.map((l) => ({ d: ymd(l.formattedDate || l.checkInTimestamp || l.date), title: l.activityTitle || l.title || l.activityId || '-',
        meta: 'สแกนเมื่อ ' + (hhmm(l.formattedTime || l.checkInTimestamp) || '-'), tag: 'เข้าร่วม', cls: 'ok' }))
        .filter((x) => x.d).sort((x, y) => y.d - x.d);
    }
    box.innerHTML = rows.length ? rows.map((r) => '<div class="k8-li"><span class="k8-li-date"><b>' + r.d.getDate() + '</b>' + TH_M[r.d.getMonth()] + '</span>' +
      '<span class="k8-li-main"><span class="k8-li-title" title="' + esc(r.title) + '">' + esc(r.title) + '</span><span class="k8-li-meta">' + esc(r.meta) + '</span></span>' +
      '<span class="k8-li-tag ' + r.cls + '">' + r.tag + '</span></div>').join('')
      : '<div class="k8-li-empty">' + (tab === 'upcoming' ? 'ยังไม่มีกิจกรรมที่กำลังจะมาถึง' : 'ยังไม่เคยเข้าร่วมกิจกรรม · กด "สแกน" เพื่อเช็คชื่อ') + '</div>';
  };
  window.k8ActTab = function (t) { tab = t; window.renderActivitiesV8(); };
  function setScanning(on) { const v = document.getElementById('view-activities'); if (v) v.classList.toggle('k8-scanning', !!on); }
  window.k8StartActScan = function () {
    try { isStudentCameraLocked = false; } catch (e) {}
    setScanning(true);
    if (typeof setStudentActivityMode === 'function') setStudentActivityMode('scanner');
  };
  window.k8StopActScan = function () {
    setScanning(false);
    try { currentStudentActivityMode = 'history'; } catch (e) {}
    if (typeof stopQrScanner === 'function') stopQrScanner();
    window.renderActivitiesV8();
  };
  const sv = window.switchView;
  if (typeof sv === 'function') {
    window.switchView = function (v) {
      if (v === 'activities') { try { currentStudentActivityMode = 'history'; } catch (e) {} setScanning(false); }
      const r = sv.apply(this, arguments);
      if (v === 'activities') window.renderActivitiesV8();
      return r;
    };
  }
  ['renderStudentScannedActivities', 'fetchActivitiesAndLogsFromCloud'].forEach((fn) => {
    const o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function () {
      const r = o.apply(this, arguments);
      const after = () => { try { window.renderActivitiesV8(); } catch (e) {} };
      if (r && typeof r.then === 'function') r.then(after, after); else after();
      return r;
    };
  });
})();


/* ============ Round 3 · Profile "ฉัน" (canvas) + preferences ============ */
(function () {
  const getPref = (k, d) => { try { const v = localStorage.getItem('k8_pref_' + k); return v == null ? d : v === '1'; } catch (e) { return d; } };
  const setPrefRaw = (k, v) => { try { localStorage.setItem('k8_pref_' + k, v ? '1' : '0'); } catch (e) {} };
  function maskPhone(p) { const d = String(p || '').replace(/\D/g, ''); return d.length >= 9 ? d.slice(0, 3) + '-xxx-' + d.slice(-4) : (p || '-'); }
  function maskEmail(e) { const m = String(e || '').match(/^(.)[^@]*(@.+)$/); return m ? m[1] + '***' + m[2] : (e || '-'); }
  function shortGrade(g) { const m = String(g || '').match(/(\d)/); return /มัธยม/.test(g || '') && m ? 'ม.' + m[1] : (g || '-'); }
  window.renderProfileV8 = function () {
    let s = null; try { s = currentStudent; } catch (e) {}
    const $ = (id) => document.getElementById(id);
    if (!$('k8ProfName')) return;
    if (!s) { $('k8ProfName').textContent = 'ยังไม่ได้เข้าสู่ระบบ'; return; }
    $('k8ProfName').textContent = s.fullName || '-';
    $('k8ProfName').title = s.fullName || '';
    $('k8ProfSub').textContent = 'รหัส ' + (s.studentId || '-') + ' · ' + shortGrade(s.grade);
    $('k8ProfSchool').textContent = s.school || s.schoolName || '';
    $('k8ProfPhone').textContent = maskPhone(s.parentPhone || s.phone);
    $('k8ProfEmail').textContent = maskEmail(s.email);
    const av = $('k8ProfAv');
    let url = ''; try { url = typeof getDirectImageUrl === 'function' ? getDirectImageUrl(s.avatarUrl) : ''; } catch (e) {}
    if (url) { av.innerHTML = ''; const img = document.createElement('img'); img.src = url; img.alt = 'รูปโปรไฟล์'; av.appendChild(img); }
    else av.textContent = String(s.fullName || 'น').replace(/^(เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|นาย|นางสาว|นาง)\s*/, '').charAt(0) || 'น';
    const hg = $('k8PrefHideGrades'), nt = $('k8PrefNotify');
    if (hg) hg.checked = getPref('hideGrades', true);
    if (nt) nt.checked = getPref('notify', false) && ('Notification' in window) && Notification.permission === 'granted';
  };
  window.k8OpenGrades = function () {
    switchView('dashboard');
    if (window.k8HfSetGradesOpen) window.k8HfSetGradesOpen(true);
    setTimeout(() => { const t = document.getElementById('hfGradesToggle'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120);
  };
  window.k8SetPref = async function (key, on) {
    if (key === 'notify' && on) {
      if (!('Notification' in window)) { if (typeof showToast === 'function') showToast('อุปกรณ์นี้ไม่รองรับการแจ้งเตือน', 'warning'); on = false; }
      else if (Notification.permission !== 'granted') {
        let p = 'denied'; try { p = await Notification.requestPermission(); } catch (e) {}
        if (p !== 'granted') { if (typeof showToast === 'function') showToast('ยังไม่ได้อนุญาตการแจ้งเตือนในเบราว์เซอร์', 'warning'); on = false; }
      }
    }
    setPrefRaw(key, on);
    if (key === 'hideGrades' && window.k8HfSetGradesOpen) window.k8HfSetGradesOpen(!on);
    window.renderProfileV8();
    if (typeof showToast === 'function') showToast(on ? 'เปิดแล้ว' : 'ปิดแล้ว', 'success');
  };
  // prayer-time reminders while the app is open
  let lastFired = '';
  setInterval(() => {
    if (!getPref('notify', false) || !('Notification' in window) || Notification.permission !== 'granted') return;
    let s = null; try { s = currentStudent; } catch (e) {} if (!s) return;
    const now = new Date(), cur = now.getHours() * 60 + now.getMinutes();
    let w = null; try { w = PRAYER_TIME_WINDOWS.find((x) => x.startMin === cur); } catch (e) {}
    const key = now.toDateString() + (w && w.name);
    if (w && lastFired !== key) {
      lastFired = key;
      try { new Notification('ถึงเวลาละหมาด' + w.name, { body: 'อย่าลืมเช็คชื่อละหมาดใน KHALIFAH', icon: 'assets/logo.png' }); } catch (e) {}
    }
  }, 30000);
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) { const r = sv.apply(this, arguments); if (v === 'profile') window.renderProfileV8(); return r; };
  const rp = window.renderCurrentStudentProfile;
  if (typeof rp === 'function') window.renderCurrentStudentProfile = function () { const r = rp.apply(this, arguments); try { window.renderProfileV8(); } catch (e) {} return r; };
})();

/* ============ Round 3 · Teacher home + attendance (canvas) ============ */
(function () {
  const readJSON = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? f : v; } catch (e) { return f; } };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const DAYS_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const norm = (id) => String(id == null ? '' : id).replace(/^0+/, '');
  const cid = (id) => { try { return typeof cleanIdString === 'function' ? cleanIdString(id) : String(id); } catch (e) { return String(id); } };
  const shortG = (g) => { const m = String(g || '').match(/(\d)/); return m && /มัธยม/.test(g) ? 'ม.' + m[1] : (g || ''); };
  const initialOf = (name) => String(name || '').replace(/^(อาจารย์|อ\.|ครู|นาย|นางสาว|นาง|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.)\s*/, '').trim().charAt(0) || 'อ';
  function students() { return (typeof allStudents !== 'undefined' && Array.isArray(allStudents) ? allStudents : []).filter((s) => s && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(s.status || ''))); }

  function renderTeacherHome() {
    const nameEl = document.getElementById('k8ThName');
    if (!nameEl) return;
    let a = null; try { a = currentAdmin; } catch (e) {}
    const now = new Date(), today = ymd(now);
    const isExec = a && a.role === 'EXECUTIVE';
    const isSuper = a && /SUPER/i.test(String(a.role || ''));
    document.getElementById('k8ThDate').textContent = DAYS_FULL[now.getDay()] + ' ' + now.getDate() + ' ' + MON[now.getMonth()] + ' · ' + (isExec ? 'ผู้บริหาร' : 'อาจารย์ผู้สอน');
    const nm = a ? (a.fullName || a.username || 'อาจารย์') : 'อาจารย์';
    nameEl.textContent = nm; nameEl.title = nm;
    document.getElementById('k8ThAvatar').textContent = initialOf(nm);
    const back = document.getElementById('k8ThBackAdmin'); if (back) back.hidden = !isSuper;

    const list = students(), total = list.length;
    const ids = {}; list.forEach((s) => { ids[norm(s.studentId)] = 1; });
    const st = {};
    readJSON('khalifah_attendance_logs', []).forEach((r) => { if (r && r.date === today) st[norm(r.studentId)] = String(r.status || ''); });
    const loc = readJSON('khalifah_daily_attendance_logs', {})[today] || {};
    Object.keys(loc).forEach((k) => { st[norm(k)] = loc[k]; });
    let came = 0;
    Object.keys(st).forEach((k) => { if (ids[k] && !/ลา|leave|ขาด|absent/i.test(st[k])) came++; });
    document.getElementById('k8ThAttN').textContent = came;
    document.getElementById('k8ThAttT').textContent = ' / ' + total;
    document.getElementById('k8ThAttBar').style.width = (total ? Math.round(came / total * 100) : 0) + '%';

    let wins = []; try { wins = PRAYER_TIME_WINDOWS; } catch (e) {}
    const cur = now.getHours() * 60 + now.getMinutes();
    let w = null; wins.forEach((x) => { if (cur >= x.startMin - 30) w = x; });
    if (!w) w = wins[wins.length - 1];
    const slot = w ? w.name : '';
    const nk = (x) => { try { return normalizePrayerSlotKey(x); } catch (e) { return x; } };
    const done = {};
    let tp = []; try { tp = todayPrayers || []; } catch (e) {}
    [...tp, ...readJSON('khalifah_prayer_history', [])].forEach((p) => {
      if (!p) return;
      if (!(p.date === today || String(p.timestamp || '').startsWith(today))) return;
      if (nk(p.prayerTime || p.prayerName || '') === slot && ids[norm(p.studentId)]) done[norm(p.studentId)] = 1;
    });
    const pn = Object.keys(done).length;
    document.getElementById('k8ThPrayL').textContent = 'ละหมาด' + slot;
    document.getElementById('k8ThPrayN').textContent = pn;
    document.getElementById('k8ThPrayT').textContent = ' / ' + total;
    document.getElementById('k8ThPrayBar').style.width = (total ? Math.round(pn / total * 100) : 0) + '%';
  }
  window.renderTeacherHomeV8 = function () { try { renderTeacherHome(); } catch (e) { console.warn('teacher home', e); } };

  // ---------- attendance ----------
  const KINDS = [['present', 'มา', '#15803d', '#f0fdf4'], ['late', 'สาย', '#b45309', '#fffbeb'], ['leave', 'ลา', '#1d4ed8', '#eff6ff'], ['absent', 'ขาด', '#b91c1c', '#fef2f2']];
  window.k8TaSetGrade = function (v) { const g = document.getElementById('teacherAttGradeSelect'); if (g) { g.value = v; renderTeacherAttendanceTable(); } };
  window.k8TaSetDate = function (v) { const d = document.getElementById('teacherAttDateInput'); if (d && v) { d.value = v; renderTeacherAttendanceTable(); } };
  window.k8TaMark = function (sid, k) { if (typeof setStudentDailyAttendance === 'function') setStudentDailyAttendance(sid, k); };
  function renderAtt() {
    const listEl = document.getElementById('k8TaList');
    if (!listEl) return;
    const gSel = document.getElementById('teacherAttGradeSelect');
    const dIn = document.getElementById('teacherAttDateInput');
    const grade = gSel ? gSel.value : 'ALL';
    const date = (dIn && dIn.value) || ymd(new Date());
    const dd = new Date(date + 'T00:00:00');
    document.getElementById('k8TaDateText').textContent = DAYS[dd.getDay()] + ' ' + dd.getDate() + ' ' + MON[dd.getMonth()] + ' ' + (dd.getFullYear() + 543) + (date === ymd(new Date()) ? '' : ' · ย้อนหลัง');
    const k8d = document.getElementById('k8TaDateInput'); if (k8d) k8d.value = date;
    const all = (typeof allStudents !== 'undefined' ? allStudents : []);
    const sel = document.getElementById('k8TaGrade');
    if (sel && gSel) {
      sel.innerHTML = Array.from(gSel.options).map((o) => {
        const n = o.value === 'ALL' ? all.length : all.filter((s) => s.grade === o.value).length;
        return '<option value="' + esc(o.value) + '"' + (o.value === grade ? ' selected' : '') + '>' + esc(o.value === 'ALL' ? 'ทุกระดับชั้น' : o.value) + ' · ' + n + ' คน</option>';
      }).join('');
    }
    const rows = all.filter((s) => grade === 'ALL' || !grade || s.grade === grade);
    let draft = {}; try { draft = teacherDailyAttendanceDraft || {}; } catch (e) {}
    const saved = readJSON('khalifah_daily_attendance_logs', {})[date] || {};
    const cnt = { present: 0, late: 0, leave: 0, absent: 0 };
    let pending = 0;
    listEl.innerHTML = rows.length ? rows.map((s) => {
      const id = cid(s.studentId);
      const cur = draft[id] || saved[id] || 'present';
      if (cnt[cur] != null) cnt[cur]++;
      if (!saved[id]) pending++;
      return '<li class="k8-ta-card"><div class="k8-ta-top"><span class="k8-ta-av">' + esc(initialOf(s.fullName)) + '</span><span class="k8-ta-name" title="' + esc(s.fullName) + '">' + esc(s.fullName) + '</span><span class="k8-ta-id">' + esc(id) + (grade === 'ALL' ? ' · ' + esc(shortG(s.grade)) : '') + '</span></div>' +
        '<div class="k8-ta-opts" role="radiogroup" aria-label="สถานะการมาเรียน">' + KINDS.map(([k, label, ink, bg]) => {
          const on = cur === k;
          return '<button type="button" role="radio" aria-checked="' + on + '" style="' + (on ? 'background:' + ink + ';color:#fff;border-color:' + ink : 'background:' + bg + ';color:' + ink + ';border-color:' + bg) + '" onclick="k8TaMark(\'' + esc(id) + '\',\'' + k + '\')">' + label + '</button>';
        }).join('') + '</div></li>';
    }).join('') : '<li class="k8-li-empty">ไม่พบรายชื่อนักเรียนในระดับชั้นนี้</li>';
    document.getElementById('k8TaSum').innerHTML = KINDS.map(([k, label, ink, bg]) => '<div style="background:' + bg + ';color:' + ink + '"><b>' + cnt[k] + '</b><span>' + label + '</span></div>').join('');
    const pe = document.getElementById('k8TaPending');
    pe.textContent = pending > 0 ? 'ยังไม่เช็ค ' + pending + ' คน' : 'เช็คครบทุกคนแล้ว';
    pe.style.color = pending > 0 ? '#b45309' : '#15803d';
  }
  window.renderTeacherAttV8 = function () { try { renderAtt(); } catch (e) { console.warn('teacher att', e); } };
  function wrap(fn, after) {
    const o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function () {
      const r = o.apply(this, arguments);
      const f = () => { try { after(); } catch (e) {} };
      if (r && typeof r.then === 'function') r.then(f, f); else f();
      return r;
    };
  }
  wrap('renderTeacherAttendanceTable', window.renderTeacherAttV8);
  wrap('saveTeacherAttendanceBatch', () => { window.renderTeacherAttV8(); window.renderTeacherHomeV8(); });
  wrap('initTeacherPortalView', window.renderTeacherHomeV8);
  wrap('renderTeacherOverviewBento', window.renderTeacherHomeV8);
  wrap('switchTeacherTab', () => { window.renderTeacherHomeV8(); window.renderTeacherAttV8(); });
})();

/* ============ Round 3 · Admin students (canvas AdminStudents) ============ */
(function () {
  const readJSON = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? f : v; } catch (e) { return f; } };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (id) => String(id == null ? '' : id).replace(/^0+/, '');
  const cid = (id) => { try { return cleanIdString(id); } catch (e) { return String(id); } };
  const shortG = (g) => { const m = String(g || '').match(/(\d)/); return m && /มัธยม/.test(g) ? 'ม.' + m[1] : (g || '-'); };
  const initialOf = (name) => String(name || '').replace(/^(เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|นาย|นางสาว|นาง)\s*/, '').trim().charAt(0) || 'น';
  const GR = ['มัธยมศึกษาปีที่ 1', 'มัธยมศึกษาปีที่ 2', 'มัธยมศึกษาปีที่ 3', 'มัธยมศึกษาปีที่ 4', 'มัธยมศึกษาปีที่ 5', 'มัธยมศึกษาปีที่ 6'];
  let lastList = null, selId = null;
  function statusPill(st) {
    st = String(st || 'ปกติ (กำลังศึกษา)');
    if (/ปกติ|กำลังศึกษา|active/i.test(st)) return ['ปกติ', '#f0fdf4', '#15803d'];
    if (/พัก/.test(st)) return ['พักการเรียน', '#fffbeb', '#b45309'];
    if (/ลาออก|พ้นสภาพ/.test(st)) return ['ลาออก', '#fef2f2', '#b91c1c'];
    if (/สำเร็จ/.test(st)) return ['จบแล้ว', '#eff6ff', '#1d4ed8'];
    return [st, '#f1f5f9', '#475569'];
  }
  function prayer7() {
    const now = new Date(); const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const pad = (n) => String(n).padStart(2, '0');
    const fromS = from.getFullYear() + '-' + pad(from.getMonth() + 1) + '-' + pad(from.getDate());
    const map = {}; const seen = {};
    let tp = []; try { tp = todayPrayers || []; } catch (e) {}
    [...readJSON('khalifah_prayer_history', []), ...tp].forEach((p) => {
      if (!p) return;
      const d = String(p.date || p.timestamp || '').slice(0, 10);
      if (!d || d < fromS) return;
      const k = norm(p.studentId) + '|' + d + '|' + (p.prayerTime || p.prayerName || '');
      if (seen[k]) return; seen[k] = 1;
      map[norm(p.studentId)] = (map[norm(p.studentId)] || 0) + 1;
    });
    return map;
  }
  function attPct(s) {
    const a = s.attendance || {}; const t = (+a.present || 0) + (+a.late || 0) + (+a.leave || 0) + (+a.absent || 0);
    return t ? Math.round(((+a.present || 0) + (+a.late || 0)) / t * 100) : null;
  }
  function gpax(s) { const v = parseFloat(s.gpax || s.gpa); return isFinite(v) && v > 0 ? v.toFixed(2) : '-'; }
  function render(list) {
    const body = document.getElementById('k8AsRows');
    if (!body) return;
    const all = (typeof allStudents !== 'undefined' ? allStudents : []);
    list = Array.isArray(list) ? list : all;
    lastList = list;
    document.getElementById('k8AsSub').textContent = 'แสดง ' + list.length + ' คน · กดแถวเพื่อดูรายละเอียด';
    const gSel = document.getElementById('filterGradeSelect');
    const g = gSel ? gSel.value : '';
    document.getElementById('k8AsChips').innerHTML = [['', 'ทั้งหมด'], ...GR.map((x) => [x, shortG(x)])].map(([v, l]) =>
      '<button type="button" aria-pressed="' + (v === g) + '" onclick="k8AsGrade(\'' + v + '\')">' + l + '</button>').join('');
    const pr = prayer7();
    if (!selId || !list.some((s) => cid(s.studentId) === selId)) selId = list[0] ? cid(list[0].studentId) : null;
    body.innerHTML = list.length ? list.map((s) => {
      const id = cid(s.studentId); const [stL, stBg, stInk] = statusPill(s.status);
      const ap = attPct(s); const pn = pr[norm(s.studentId)] || 0; const pp = Math.min(100, Math.round(pn / 35 * 100));
      return '<tr class="' + (id === selId ? 'is-sel' : '') + '" onclick="k8AsSelect(\'' + esc(id) + '\')">' +
        '<td><button type="button" class="k8-as-name" onclick="event.stopPropagation();k8AsSelect(\'' + esc(id) + '\')"><b title="' + esc(s.fullName) + '">' + esc(s.fullName) + '</b><span>' + esc(id) + '</span></button></td>' +
        '<td>' + esc(shortG(s.grade)) + '</td>' +
        '<td><span class="k8-pill" style="background:' + stBg + ';color:' + stInk + '">' + esc(stL) + '</span></td>' +
        '<td class="b" style="color:' + (ap == null ? '#64748b' : ap >= 90 ? '#15803d' : ap >= 75 ? '#b45309' : '#b91c1c') + '">' + (ap == null ? '-' : ap + '%') + '</td>' +
        '<td><span class="k8-as-pr"><span class="k8-as-prbar"><span style="width:' + pp + '%"></span></span><span>' + pn + '/35</span></span></td>' +
        '<td class="r b">' + gpax(s) + '</td></tr>';
    }).join('') : '<tr><td colspan="6" class="k8-li-empty">ไม่พบนักเรียนตามเงื่อนไข</td></tr>';
    renderDetail(pr);
  }
  function renderDetail(pr) {
    const box = document.getElementById('k8AsDetail');
    const all = (typeof allStudents !== 'undefined' ? allStudents : []);
    const s = all.find((x) => cid(x.studentId) === selId);
    if (!s) { box.innerHTML = '<div class="k8-li-empty">เลือกนักเรียนจากตาราง</div>'; return; }
    pr = pr || prayer7();
    const id = cid(s.studentId); const ap = attPct(s); const a = s.attendance || {};
    box.innerHTML = '<div class="k8-as-dh"><span class="k8-as-av">' + esc(initialOf(s.fullName)) + '</span><span class="k8-as-dt"><b>' + esc(s.fullName) + '</b><span>' + esc(id) + ' · ' + esc(shortG(s.grade)) + '</span></span></div>' +
      '<dl class="k8-as-dl"><dt>ผู้ปกครอง</dt><dd>' + esc(s.parentPhone || '-') + '</dd><dt>มาเรียน</dt><dd>' + (ap == null ? '-' : ap + '% (มา ' + (a.present || 0) + ' · สาย ' + (a.late || 0) + ' · ลา ' + (a.leave || 0) + ' · ขาด ' + (a.absent || 0) + ')') + '</dd>' +
      '<dt>ละหมาด 7 วัน</dt><dd>' + (pr[norm(s.studentId)] || 0) + ' / 35 เวลา</dd><dt>GPAX</dt><dd>' + gpax(s) + '</dd></dl>' +
      '<div class="k8-as-acts"><button type="button" class="k8-btn-pri" onclick="openAdminEditStudentModal(\'' + esc(id) + '\')">แก้ไขข้อมูล</button>' +
      '<button type="button" class="k8-btn-line" onclick="openStudentQuickStatusModal(\'' + esc(id) + '\')">ปรับสถานะ</button>' +
      '<button type="button" class="k8-btn-line" onclick="k8AsPrayerHistory(\'' + esc(id) + '\')">ดูประวัติละหมาด</button>' +
      '<button type="button" class="k8-btn-line is-danger" onclick="deleteStudent(\'' + esc(id) + '\')">ลบนักเรียน</button></div>';
  }
  window.k8AsSelect = function (id) { selId = id; render(lastList); };
  window.k8AsGrade = function (v) { const g = document.getElementById('filterGradeSelect'); if (g) { g.value = v; filterAdminStudents(); } };
  window.k8AsSearch = function (v) { const i = document.getElementById('searchStudentInput'); if (i) { i.value = v; filterAdminStudents(); } };
  window.k8AsPrayerHistory = function (id) {
    if (typeof switchAdminTab === 'function') switchAdminTab('prayers-monitor', document.getElementById('btnAdminTabPrayers'));
    if (typeof setAdminPrayerMode === 'function') setAdminPrayerMode('individual');
    const sel = document.getElementById('adminPrayerStudentSelect');
    if (sel) { const opt = Array.from(sel.options).find((o) => cid(o.value) === id); if (opt) { sel.value = opt.value; if (typeof onAdminPrayerStudentSelectChange === 'function') onAdminPrayerStudentSelectChange(); } }
  };
  const o = window.renderAdminStudentsTable;
  if (typeof o === 'function') window.renderAdminStudentsTable = function (filtered) { const r = o.apply(this, arguments); try { render(filtered); } catch (e) { console.warn('k8 students', e); } return r; };
})();

/* ============ Round 3 · Admin approvals (canvas AdminApprovals) ============ */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const js = (v) => esc(String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
  let tab = 'accounts';
  function fmtWhen(v) {
    if (!v) return '-';
    const d = new Date(v); if (isNaN(d)) return String(v);
    const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return d.getDate() + ' ' + M[d.getMonth()] + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  const ns = (st) => { try { return normalizeApprovalStatus(st); } catch (e) { return String(st || 'pending').toLowerCase(); } };
  function regs() { try { return (getPendingRegistrations() || []).filter((x) => x && x.status !== 'Verified'); } catch (e) { return []; } }
  function lates() { try { return getPrayerApprovalsList() || []; } catch (e) { return []; } }
  function render() {
    const grid = document.getElementById('k8ApGrid');
    if (!grid) return;
    const R = regs(), L = lates();
    const rp = R.filter((x) => !/approved/i.test(x.status)).length;
    const lp = L.filter((x) => ns(x.status) === 'pending').length;
    document.querySelectorAll('#k8ApTabs button').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.setAttribute('aria-selected', on);
      b.textContent = b.dataset.tab === 'accounts' ? 'บัญชีใหม่ (' + rp + ')' : 'ละหมาดย้อนหลัง (' + lp + ')';
    });
    if (tab === 'accounts') {
      grid.innerHTML = R.length ? R.map((a) => {
        const key = a.reqId || a.id || a.userId;
        const sent = /approved/i.test(a.status);
        const st = sent ? ['ส่งรหัสแล้ว', '#f0fdf4', '#15803d'] : ['รออนุมัติ', '#fffbeb', '#b45309'];
        return '<article class="k8-ap-card"><div class="k8-ap-h"><div class="k8-ap-ht"><b>' + esc(a.fullName || '-') + '</b><span>' + (a.role === 'teacher' ? 'อาจารย์' : 'นักเรียน') + ' · รหัส ' + esc(a.userId || '-') + '</span></div>' +
          '<span class="k8-pill" style="background:' + st[1] + ';color:' + st[2] + '">' + st[0] + '</span></div>' +
          '<dl class="k8-ap-dl"><dt>อีเมล</dt><dd>' + esc(a.email || '-') + '</dd><dt>รายละเอียด</dt><dd>' + esc(a.gradeOrSubj || a.detail || '-') + '</dd><dt>สมัครเมื่อ</dt><dd>' + esc(fmtWhen(a.createdAt || a.timestamp || a.submittedAt || a.requestedAt)) + '</dd></dl>' +
          (sent
            ? '<div class="k8-ap-sent"><span>รอผู้สมัครกรอกรหัสยืนยัน</span><button type="button" onclick="adminApproveRegistration(\'' + js(key) + '\')">ส่งรหัสอีกครั้ง</button></div>'
            : '<div class="k8-ap-acts"><button type="button" class="is-ok" onclick="adminApproveRegistration(\'' + js(key) + '\')">อนุมัติ &amp; ส่งรหัสทางอีเมล</button><button type="button" class="is-no" onclick="adminRejectRegistration(\'' + js(key) + '\')">ปฏิเสธ</button></div>') +
          '</article>';
      }).join('') : '<div class="k8-li-empty">ไม่มีบัญชีใหม่ที่รออนุมัติ</div>';
    } else {
      const sorted = L.slice().sort((a, b) => (ns(a.status) === 'pending' ? 0 : 1) - (ns(b.status) === 'pending' ? 0 : 1));
      grid.innerHTML = sorted.length ? sorted.map((l) => {
        const s = ns(l.status);
        const photo = l.photoUrl ? '<button type="button" class="k8-ap-photo" onclick="viewPhotoInNewTab(\'' + js(l.photoUrl) + '\')" aria-label="ดูภาพหลักฐาน"><img src="' + esc(l.photoUrl) + '" alt="ภาพหลักฐาน" loading="lazy"></button>' : '<div class="k8-ap-photo is-empty">ไม่มีภาพ</div>';
        return '<article class="k8-ap-card k8-ap-late">' + photo + '<div class="k8-ap-lb"><b>' + esc(l.studentName || l.studentId) + (l.grade ? ' · ' + esc(String(l.grade).replace('มัธยมศึกษาปีที่ ', 'ม.')) : '') + '</b>' +
          '<span class="k8-ap-meta">' + esc(l.prayerSlot || '-') + ' · ' + esc(l.date || '-') + '</span><span class="k8-ap-why">เหตุผล: ' + esc([l.reasonPreset, l.reasonDetail].filter(Boolean).join(' · ') || '-') + '</span>' +
          (s === 'pending'
            ? '<div class="k8-ap-acts2"><button type="button" class="is-ok" onclick="adminApprovePrayerRequest(\'' + js(l.id) + '\')">อนุมัติ</button><button type="button" class="is-no" onclick="adminRejectPrayerRequest(\'' + js(l.id) + '\')">ไม่อนุมัติ</button></div>'
            : '<span class="k8-ap-done" style="color:' + (s === 'approved' ? '#15803d' : '#b91c1c') + '">' + (s === 'approved' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ') + (l.approvedBy || l.rejectedBy ? ' โดย ' + esc(l.approvedBy || l.rejectedBy) : '') + '</span>') +
          '</div></article>';
      }).join('') : '<div class="k8-li-empty">ไม่มีคำขอละหมาดย้อนหลัง</div>';
    }
  }
  window.renderApprovalsV8 = function () { try { render(); } catch (e) { console.warn('k8 approvals', e); } };
  window.k8ApTab = function (t) { tab = t; if (t === 'prayers' && typeof fetchPrayerApprovalsFromCloud === 'function') { try { fetchPrayerApprovalsFromCloud(true); } catch (e) {} } window.renderApprovalsV8(); };
  function wrap(fn) {
    const o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function () {
      const r = o.apply(this, arguments);
      const f = () => window.renderApprovalsV8();
      if (r && typeof r.then === 'function') r.then(f, f); else f();
      return r;
    };
  }
  ['renderPendingApprovalsTable', 'renderAdminPrayerApprovals', 'fetchPrayerApprovalsFromCloud', 'fetchPendingApprovalsFromCloud', 'adminApproveRegistration', 'adminRejectRegistration', 'adminApprovePrayerRequest', 'adminRejectPrayerRequest'].forEach(wrap);
  const sat = window.switchAdminTab;
  if (typeof sat === 'function') window.switchAdminTab = function (t) { const r = sat.apply(this, arguments); if (t === 'approvals') { try { fetchPrayerApprovalsFromCloud(false); } catch (e) {} window.renderApprovalsV8(); } return r; };
})();

/* ============ Round 3 · OTP page (canvas Otp) ============ */
(function () {
  function sync() {
    const inp = document.getElementById('otpVerifyCodeInput'), boxes = document.querySelectorAll('#k8OtpBoxes span');
    if (!inp || !boxes.length) return;
    const v = String(inp.value || '').replace(/\D/g, '').slice(0, 6);
    if (inp.value !== v) inp.value = v;
    const vb = document.querySelector('#otpVerifyModal .btn-primary.btn-block'); if (vb) vb.classList.toggle('k8-dim', v.length < 6);
    boxes.forEach((b, i) => { b.textContent = v[i] || ''; b.classList.toggle('on', i === Math.min(v.length, 5) && document.activeElement === inp); b.classList.toggle('filled', !!v[i]); });
  }
  window.k8OtpKey = function (k) {
    const inp = document.getElementById('otpVerifyCodeInput'); if (!inp) return;
    let v = String(inp.value || '').replace(/\D/g, '');
    if (k === 'del') v = v.slice(0, -1); else if (v.length < 6) v += k;
    inp.value = v; sync();
    if (v.length === 6 && typeof verifyRegistrationOtpCode === 'function') { const id = document.getElementById('otpLookupIdInput'); const g = document.getElementById('otpLookupIdGroup'); if (!g || g.style.display === 'none' || (id && id.value.trim())) verifyRegistrationOtpCode(); }
  };
  window.k8OtpNoEmail = function () { if (typeof showToast === 'function') showToast('ตรวจสอบโฟลเดอร์จดหมายขยะ (Spam) หากยังไม่ได้รับ ติดต่อแอดมินให้กด "ส่งรหัสอีกครั้ง"', 'info'); };
  function boot() {
    const inp = document.getElementById('otpVerifyCodeInput');
    if (!inp) return;
    ['input', 'focus', 'blur', 'keyup'].forEach((ev) => inp.addEventListener(ev, sync));
    const o = window.openOtpVerifyModalPrompt;
    if (typeof o === 'function') window.openOtpVerifyModalPrompt = function () { const r = o.apply(this, arguments); sync(); setTimeout(() => { const l = document.getElementById('otpLookupIdInput'); if (l) l.focus(); }, 50); return r; };
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

/* ============ Round 3 · Late prayer request (canvas LateRequest) ============ */
(function () {
  const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const modal = () => document.getElementById('prayerLateApprovalModal');
  function setSent(on) { const m = modal(); if (!m) return; m.classList.toggle('k8-sent', !!on); const p = document.getElementById('k8LrSent'); if (p) p.hidden = !on; }
  window.k8LrAgain = function () { setSent(false); if (typeof openPrayerLateApprovalModal === 'function') openPrayerLateApprovalModal(); };
  const op = window.openPrayerLateApprovalModal;
  if (typeof op === 'function') window.openPrayerLateApprovalModal = function () { setSent(false); return op.apply(this, arguments); };
  let justSent = null;
  const sb = window.submitPrayerLateApprovalRequest;
  if (typeof sb === 'function') window.submitPrayerLateApprovalRequest = async function () {
    const slot = (document.getElementById('lateReqSelectedSlot') || {}).value || '';
    const date = (document.getElementById('lateReqDate') || {}).value || '';
    let before = 0; try { before = getPrayerApprovalsList().length; } catch (e) {}
    const r = await sb.apply(this, arguments);
    let after = 0; try { after = getPrayerApprovalsList().length; } catch (e) {}
    if (after > before) justSent = { slot, date };
    return r;
  };
  const cm = window.closeModal;
  if (typeof cm === 'function') window.closeModal = function (id) {
    if (id === 'prayerLateApprovalModal' && justSent) {
      const js = justSent; justSent = null;
      const d = new Date(js.date + 'T00:00:00');
      const t = document.getElementById('k8LrSentText');
      if (t) t.innerHTML = 'ละหมาด' + js.slot + ' · ' + d.getDate() + ' ' + M[d.getMonth()] + ' ' + (d.getFullYear() + 543) + '<br>สถานะ: รออาจารย์อนุมัติ';
      const b = document.getElementById('btnSubmitLateReq'); if (b) setTimeout(() => { b.textContent = 'ส่งคำขอ'; }, 0);
      setSent(true);
      return;
    }
    if (id === 'prayerLateApprovalModal') setSent(false);
    return cm.apply(this, arguments);
  };
})();

/* ============ Round 3 · School calendar (canvas Calendar) ============ */
(function () {
  const MF = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const DOW = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  const DOWF = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const COLORS = [['#0369a1', '#e0f2fe'], ['#15803d', '#f0fdf4'], ['#b45309', '#fffbeb'], ['#5b21b6', '#ede9fe'], ['#b91c1c', '#fef2f2']];
  const catColor = (c) => { const s = String(c || ''); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return /สอบ|exam/i.test(s) ? COLORS[4] : /หยุด|holiday/i.test(s) ? COLORS[2] : COLORS[h % 4]; };
  const now = new Date();
  let ym = { y: now.getFullYear(), m: now.getMonth() }, sel = ymd(now);
  function events() { try { return getVisibleCalendarEvents() || []; } catch (e) { try { return calendarEvents || []; } catch (e2) { return []; } } }
  function on(ev, day) { const s = String(ev.startDate || '').slice(0, 10), e = String(ev.endDate || ev.startDate || '').slice(0, 10); return s && day >= s && day <= (e || s); }
  function render() {
    const grid = document.getElementById('k8CalGrid'); if (!grid) return;
    const evs = events();
    document.getElementById('k8CalMonth').textContent = MF[ym.m] + ' ' + (ym.y + 543);
    const first = new Date(ym.y, ym.m, 1), days = new Date(ym.y, ym.m + 1, 0).getDate(), today = ymd(new Date());
    let html = DOW.map((d) => '<span class="k8-cal-dow">' + d + '</span>').join('');
    for (let i = 0; i < (first.getDay() + 6) % 7; i++) html += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const key = ymd(new Date(ym.y, ym.m, d));
      const has = evs.find((e) => on(e, key));
      const cls = (key === sel ? ' is-sel' : '') + (key === today ? ' is-today' : '');
      html += '<button type="button" class="k8-cal-cell' + cls + '" aria-pressed="' + (key === sel) + '" aria-label="' + d + ' ' + MF[ym.m] + (has ? ' มีกิจกรรม' : '') + '" onclick="k8CalPick(\'' + key + '\')"><span>' + d + '</span><i style="background:' + (has ? (key === sel ? '#fff' : catColor(has.category)[0]) : 'transparent') + '"></i></button>';
    }
    grid.innerHTML = html;
    const sd = new Date(sel + 'T00:00:00');
    document.getElementById('k8CalDayLabel').textContent = sd.getDate() + ' ' + MF[sd.getMonth()] + ' ' + (sd.getFullYear() + 543);
    const list = evs.filter((e) => on(e, sel));
    document.getElementById('k8CalDayList').innerHTML = list.length ? list.map((e) => {
      const [ink, bg] = catColor(e.category);
      const meta = [e.startTime ? e.startTime + (e.endTime ? '–' + e.endTime : '') : 'ทั้งวัน', e.location, e.targetAudienceLabel].filter(Boolean).join(' · ');
      return '<div class="k8-cal-ev"><span class="k8-cal-ev-bar" style="background:' + ink + '"></span><span class="k8-cal-ev-main"><b>' + esc(e.title || '-') + '</b><span>' + esc(meta) + '</span></span>' + (e.category ? '<span class="k8-pill" style="background:' + bg + ';color:' + ink + '">' + esc(e.category) + '</span>' : '') + '</div>';
    }).join('') : '<p class="k8-cal-none">ไม่มีกิจกรรมในวันนี้</p>';
    const add = document.getElementById('k8CalAdd');
    if (add) { let can = false; try { can = canManageCalendar(); } catch (e) {} add.hidden = !can; }
  }
  window.k8CalShift = function (n) { ym.m += n; if (ym.m < 0) { ym.m = 11; ym.y--; } if (ym.m > 11) { ym.m = 0; ym.y++; } const t = new Date(); sel = (ym.y === t.getFullYear() && ym.m === t.getMonth()) ? ymd(t) : ymd(new Date(ym.y, ym.m, 1)); render(); };
  window.k8CalPick = function (k) { sel = k; render(); };
  window.renderCalendarV8 = function () { try { render(); } catch (e) { console.warn('k8 cal', e); } };
  const o = window.openSchoolCalendarModal;
  if (typeof o === 'function') window.openSchoolCalendarModal = function () { const r = o.apply(this, arguments); const t = new Date(); ym = { y: t.getFullYear(), m: t.getMonth() }; sel = ymd(t); window.renderCalendarV8(); return r; };
  const rc = window.renderCalendar;
  if (typeof rc === 'function') window.renderCalendar = function () { const r = rc.apply(this, arguments); window.renderCalendarV8(); return r; };
})();

/* ============ Round 4 · Hasanat Quran = canvas exact ============ */
(function () {
  const num = (id) => { const el = document.getElementById(id); return el ? (parseInt(String(el.value != null && el.tagName === 'INPUT' ? el.value : el.textContent).replace(/[^\d]/g, ''), 10) || 0) : 0; };
  function sync() {
    const saved = num('kpiQuranPageText');
    const today = num('quranPagesTodayInput');
    const cur = num('quranCurrentPageInput') || Math.min(604, saved + today);
    const st = document.getElementById('k8QSaveText');
    if (st) st.textContent = today > 0 ? 'บันทึก · จะอ่านถึงหน้า ' + Math.min(604, cur) : 'บันทึก';
    const juzDoneTxt = (document.getElementById('juzCompletedOverviewText') || {}).textContent || '';
    const m = juzDoneTxt.match(/(\d+)\s*\/\s*30/) || juzDoneTxt.match(/จบแล้ว\s*(\d+)/); const juzDone = m ? +m[1] : 0;
    const stars = document.getElementById('k8QStars'); if (stars) stars.textContent = '★ ' + juzDone + ' ดาว';
    const juzNow = Math.min(30, Math.floor(Math.max(0, saved - 1) / 20) + 1);
    const kh = num('quranKhatamCountInput');
    const meta = document.getElementById('k8QMeta'); if (meta) meta.textContent = 'ยุซที่ ' + juzNow + ' · ค็อตม์ ' + kh + ' ครั้ง';
    const ot = document.querySelector('#view-hasanat .juz-overview-title'); if (ot && !ot.dataset.k8) { ot.dataset.k8 = '1'; ot.textContent = 'ความคืบหน้า 30 ยุซ'; }
    const oc = document.getElementById('juzCompletedOverviewText'); if (oc && m) { const t = 'จบแล้ว ' + juzDone + ' ยุซ'; if (oc.textContent !== t) oc.textContent = t; }
    const hd = document.getElementById('k8HaDate'), src = document.getElementById('hasanatDateDisplay');
    if (hd && src) { const t = src.textContent.replace(/^วันที่\s*/, '').replace(/^(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์)\s*/, ''); if (t && t.indexOf('-') === -1 && hd.textContent !== t) hd.textContent = t; }
  }
  window.k8HasanatSync = sync;
  function boot() {
    const today = document.getElementById('quranPagesTodayInput');
    if (today) today.addEventListener('input', () => {
      const saved = num('kpiQuranPageText'); const t = num('quranPagesTodayInput');
      const cp = document.getElementById('quranCurrentPageInput');
      if (cp) { cp.value = t > 0 ? Math.min(604, saved + t) : (saved || ''); try { autoCalculateJuzFromPage(); } catch (e) {} }
      sync();
    });
    const hd = document.getElementById('k8HaDate');
    if (hd) { hd.setAttribute('role', 'button'); hd.tabIndex = 0; hd.title = 'เลือกวันที่'; hd.addEventListener('click', () => { try { triggerHasanatDatePicker(); } catch (e) {} }); }
    ['kpiQuranPageText', 'juzCompletedOverviewText', 'hasanatDateDisplay', 'quranKhatamCountInput'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && 'MutationObserver' in window) new MutationObserver(() => setTimeout(sync, 0)).observe(el, { childList: true, characterData: true, subtree: true, attributes: true });
    });
    ['adjustPagesToday', 'setPagesToday', 'adjustKhatamCount', 'switchHasanatSubTab', 'onHasanatDateChange', 'shiftHasanatDate'].forEach((fn) => {
      const o = window[fn]; if (typeof o !== 'function') return;
      window[fn] = function () { const r = o.apply(this, arguments); setTimeout(sync, 0); return r; };
    });
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
(function () {
  const o = window.setLateReqReasonPreset;
  if (typeof o !== 'function') return;
  window.setLateReqReasonPreset = function (t) {
    const r = o.apply(this, arguments);
    document.querySelectorAll('.btn-reason-preset').forEach((b) => {
      const m = String(b.getAttribute('onclick') || '').match(/setLateReqReasonPreset\('([^']*)'\)/);
      b.classList.toggle('active', !!m && (m[1] === t || m[1].normalize('NFC') === String(t).normalize('NFC')));
    });
    return r;
  };
})();

/* ============ Round 4 · Register = canvas (native date → BE selects) ============ */
window.k8RegBirthChange = function (v) {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return;
  try { if (typeof initBirthDatePicker === 'function') initBirthDatePicker(); } catch (e) {}
  const d = document.getElementById('regBirthDay'), mo = document.getElementById('regBirthMonth'), y = document.getElementById('regBirthYear');
  if (!d || !mo || !y) return;
  const be = String(+m[1] + 543);
  if (!Array.from(y.options).some((o) => o.value === be)) { const o = document.createElement('option'); o.value = be; o.textContent = be; y.appendChild(o); }
  d.value = m[3]; mo.value = m[2]; y.value = be;
  try { syncBirthDatePicker(); } catch (e) {}
};
(function () {
  function term() {
    const el = document.getElementById('tgTerm'); if (!el) return;
    el.textContent = window.k8Term().label;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', term); else term();
})();

/* ============ Round 4 · Admin overview extras (search, term, recent feed) ============ */
(function () {
  const readJSON = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? f : v; } catch (e) { return f; } };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.k8OvSearchGo = function (q) {
    if (typeof switchAdminTab === 'function') switchAdminTab('students', document.getElementById('btnAdminTabStudents'));
    const k = document.getElementById('k8AsSearch'); if (k) k.value = q;
    if (typeof k8AsSearch === 'function') k8AsSearch(q);
  };
  function ts(v) { const d = new Date(v); return isNaN(d) ? null : d; }
  function feed() {
    const box = document.getElementById('k8OvFeed'); if (!box) return;
    const items = [];
    readJSON('khalifah_prayer_approvals', []).forEach((r) => { const d = ts(r.approvedAt || r.createdAt || r.submittedAt); if (d) items.push([d, (r.studentName || r.studentId) + ' ส่งคำขอละหมาดย้อนหลัง (' + (r.prayerSlot || '-') + ')' + (/approved/i.test(r.status) ? ' · อนุมัติแล้ว' : '')]); });
    readJSON('khalifah_pending_registrations', []).forEach((r) => { const d = ts(r.approvedAt || r.createdAt || r.timestamp); if (d) items.push([d, 'สมัครบัญชีใหม่: ' + (r.fullName || r.userId) + (/approved/i.test(r.status) ? ' · ส่งรหัสแล้ว' : '')]); });
    readJSON('khalifah_student_act_logs', []).forEach((r) => { const d = ts(r.checkInTimestamp || ((r.formattedDate || '') + 'T' + (r.formattedTime || '00:00'))); if (d) items.push([d, (r.studentName || r.studentId) + ' เข้าร่วม ' + (r.activityTitle || 'กิจกรรม')]); });
    readJSON('khalifah_attendance_logs', []).slice(-200).forEach((r) => { const d = ts(r.timestamp || ((r.date || '') + 'T' + (r.time || '00:00:00'))); if (d) items.push([d, 'เช็คชื่อมาเรียน: ' + (r.studentName || r.studentId) + ' · ' + (r.status || '')]); });
    items.sort((a, b) => b[0] - a[0]);
    const today = new Date().toDateString();
    const pad = (n) => String(n).padStart(2, '0');
    box.innerHTML = items.length ? items.slice(0, 5).map(([d, t]) => '<div class="k8-feed-row"><span class="k8-feed-t">' + (d.toDateString() === today ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : d.getDate() + '/' + (d.getMonth() + 1)) + '</span><span class="k8-feed-x">' + esc(t) + '</span></div>').join('')
      : '<div class="k8-li-empty" style="text-align:left;padding:8px 0">ยังไม่มีความเคลื่อนไหว</div>';
    const dt = document.getElementById('k8OvDate');
    if (dt) { dt.textContent = dt.textContent.replace(/ · (ภาคเรียนที่|ภาคฤดูร้อน).*$/, '') + ' · ' + window.k8Term().label; }
  }
  const o = window.renderAdminOverviewV8;
  if (typeof o === 'function') window.renderAdminOverviewV8 = function () { const r = o.apply(this, arguments); try { feed(); } catch (e) {} return r; };
})();

/* ============ Round 5 · Home F calendar button: next event preview ============ */
(function () {
  const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function upd() {
    const el = document.getElementById('hfCalNext'); if (!el) return;
    let evs = []; try { evs = getVisibleCalendarEvents() || []; } catch (e) { try { evs = calendarEvents || []; } catch (e2) {} }
    const t = new Date(); const today = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    const next = evs.filter((e) => String(e.endDate || e.startDate || '').slice(0, 10) >= today && e.startDate).sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))[0];
    if (!next) { el.textContent = 'ดูวันสำคัญและกิจกรรมทั้งเดือน'; return; }
    const d = new Date(String(next.startDate).slice(0, 10) + 'T00:00:00');
    el.textContent = (String(next.startDate).slice(0, 10) <= today ? 'วันนี้' : 'ถัดไป ' + d.getDate() + ' ' + M[d.getMonth()]) + ' · ' + (next.title || '');
  }
  const o = window.renderHomeF;
  if (typeof o === 'function') window.renderHomeF = function () { const r = o.apply(this, arguments); try { upd(); } catch (e) {} return r; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', upd); else upd();
})();

/* ============ Round 6 · Admin: canvas page headers for the remaining tabs ============ */
(function () {
  const HEAD = {
    'admin-tab-subadmins': ['อาจารย์ & ผู้บริหาร', 'เพิ่มบัญชี กำหนดสิทธิ์ และรายวิชาที่รับผิดชอบ'],
    'admin-tab-prayers-monitor': ['ละหมาด', 'ติดตามการเช็คชื่อละหมาด 5 เวลา รายวันและรายบุคคล'],
    'admin-tab-notify': ['แจ้งเตือน & ข้อตกลง', 'ส่งแจ้งเตือนถึงทุกคน รายชั้นปี หรือรายบุคคล และติดตามการยินยอมกฎระเบียบหอพัก'],
    'admin-tab-docs': ['เอกสารประกอบการเรียน', 'เชื่อมโฟลเดอร์ Google Drive ของ ม.1–ม.6 ให้นักเรียนเปิดดูในแอป'],
    'admin-tab-term': ['ภาคเรียน & ปีการศึกษา', 'เลือกว่าตอนนี้เป็นภาคเรียนไหน ปีการศึกษาอะไร ทั้งระบบจะใช้ค่านี้'],
    'admin-tab-behavior': ['คะแนนพฤติกรรม', 'นักเรียนเริ่มที่ 100 คะแนนทุกภาคเรียน · ผู้ตรวจการหัก/เพิ่มคะแนนตามหัวข้อที่ตั้งไว้'],
    'admin-tab-prayer-rank': ['อันดับการละหมาด', 'ดูว่าใครละหมาดสม่ำเสมอ และใครที่ควรติดตามดูแล'],
    'admin-tab-activities-admin': ['กิจกรรม & สแกน QR', 'สร้างกิจกรรม เปิด QR ให้นักเรียนสแกน และดูผู้เข้าร่วม'],
    'admin-tab-calendar-admin': ['ปฏิทินโรงเรียน', 'วันสำคัญ วันสอบ และกิจกรรมที่แสดงให้นักเรียนและอาจารย์'],
    'admin-tab-grading': ['เกรดรายวิชา', 'ดูและแก้ไขเกรดของนักเรียนแต่ละวิชา'],
    'admin-tab-subjects': ['รายวิชา', 'รายวิชาทั้งหมดในโรงเรียนและหมวดทักษะ'],
    'admin-tab-promote': ['เลื่อนชั้น', 'เลื่อนระดับชั้นทั้งโรงเรียน รายระดับ หรือรายคน'],
    'admin-tab-reports': ['ส่งออกรายงาน', 'ดาวน์โหลดข้อมูลเป็น Excel, Word หรือ PDF'],
    'admin-tab-logo': ['ตั้งค่า & โลโก้', 'โลโก้ที่แสดงบนแอปและเอกสาร']
  };
  function boot() {
    Object.keys(HEAD).forEach((id) => {
      const tab = document.getElementById(id);
      if (!tab || tab.querySelector(':scope > .k8-page-head')) return;
      const h = document.createElement('div');
      h.className = 'k8-page-head';
      h.innerHTML = '<h1>' + HEAD[id][0] + '</h1><div class="k8-as-sub">' + HEAD[id][1] + '</div>';
      tab.insertBefore(h, tab.firstChild);
    });
    const tg = document.getElementById('admin-tab-grading');
    if (tg && !document.getElementById('k8GradeTip')) {
      const tip = document.createElement('div');
      tip.id = 'k8GradeTip'; tip.className = 'k8-tip';
      tip.innerHTML = '<span>อยากกรอกคะแนนชิ้นงานและให้เกรด .5 (เช่น 3.5)? ใช้หน้า <b>คะแนน &amp; เกรด</b> ของระบบอาจารย์</span><button type="button" class="k8-btn-pri" onclick="switchView(\'teacher\'); switchTeacherTab(\'grades\')">เปิดหน้าคะแนน &amp; เกรด</button>';
      tg.insertBefore(tip, tg.children[1] || null);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

/* ============ Round 6 · Reusable canvas calendar (teacher tab) ============ */
(function () {
  const MF = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const DOW = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const COLORS = [['#0369a1', '#e0f2fe'], ['#15803d', '#f0fdf4'], ['#b45309', '#fffbeb'], ['#5b21b6', '#ede9fe'], ['#b91c1c', '#fef2f2']];
  const catColor = (c) => { const s = String(c || ''); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return /สอบ|ประเมิน|exam/i.test(s) ? COLORS[4] : /หยุด|holiday/i.test(s) ? COLORS[2] : /ศาสน/.test(s) ? COLORS[1] : COLORS[h % 4 === 1 ? 0 : h % 4]; };
  const st = {}; window.k8CalSel = {};
  function events() { try { return getVisibleCalendarEvents() || []; } catch (e) { try { return calendarEvents || []; } catch (e2) { return []; } } }
  const on = (ev, day) => { const s = String(ev.startDate || '').slice(0, 10), e = String(ev.endDate || ev.startDate || '').slice(0, 10); return s && day >= s && day <= (e || s); };
  function render(key) {
    const root = document.querySelector('[data-k8cal="' + key + '"]'); if (!root) return;
    const t = new Date();
    const s = st[key] || (st[key] = { y: t.getFullYear(), m: t.getMonth(), sel: ymd(t) });
    window.k8CalSel[key] = s.sel;
    const evs = events();
    root.querySelector('[data-k8cal-month]').textContent = MF[s.m] + ' ' + (s.y + 543);
    const first = new Date(s.y, s.m, 1), days = new Date(s.y, s.m + 1, 0).getDate(), today = ymd(t);
    let html = DOW.map((d) => '<span class="k8-cal-dow">' + d + '</span>').join('');
    for (let i = 0; i < (first.getDay() + 6) % 7; i++) html += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const k = ymd(new Date(s.y, s.m, d)); const has = evs.find((e) => on(e, k));
      html += '<button type="button" class="k8-cal-cell' + (k === s.sel ? ' is-sel' : '') + (k === today ? ' is-today' : '') + '" aria-pressed="' + (k === s.sel) + '" onclick="k8CalPickOf(\'' + key + '\',\'' + k + '\')"><span>' + d + '</span><i style="background:' + (has ? (k === s.sel ? '#fff' : catColor(has.category)[0]) : 'transparent') + '"></i></button>';
    }
    root.querySelector('[data-k8cal-grid]').innerHTML = html;
    const sd = new Date(s.sel + 'T00:00:00');
    root.querySelector('[data-k8cal-label]').textContent = sd.getDate() + ' ' + MF[sd.getMonth()] + ' ' + (sd.getFullYear() + 543);
    const list = evs.filter((e) => on(e, s.sel));
    root.querySelector('[data-k8cal-list]').innerHTML = list.length ? list.map((e) => {
      const [ink, bg] = catColor(e.category);
      const meta = [e.startTime ? e.startTime + (e.endTime ? '–' + e.endTime : '') : 'ทั้งวัน', e.location, e.targetAudienceLabel].filter(Boolean).join(' · ');
      return '<button type="button" class="k8-cal-ev" onclick="if(typeof openCalendarEventDetail===\'function\')openCalendarEventDetail(\'' + esc(e.id) + '\')"><span class="k8-cal-ev-bar" style="background:' + ink + '"></span><span class="k8-cal-ev-main"><b>' + esc(e.title || '-') + '</b><span>' + esc(meta) + '</span></span>' + (e.category ? '<span class="k8-pill" style="background:' + bg + ';color:' + ink + '">' + esc(e.category) + '</span>' : '') + '</button>';
    }).join('') : '<p class="k8-cal-none">ไม่มีกิจกรรมในวันนี้</p>';
    const add = root.querySelector('[data-k8cal-add]'); if (add) { let can = false; try { can = canManageCalendar(); } catch (e) {} add.hidden = !can; }
  }
  window.k8CalShiftOf = function (key, n) { const s = st[key]; if (!s) return; s.m += n; if (s.m < 0) { s.m = 11; s.y--; } if (s.m > 11) { s.m = 0; s.y++; } const t = new Date(); s.sel = (s.y === t.getFullYear() && s.m === t.getMonth()) ? ymd(t) : ymd(new Date(s.y, s.m, 1)); render(key); };
  window.k8CalPickOf = function (key, k) { if (st[key]) st[key].sel = k; render(key); };
  const rc = window.renderCalendar;
  if (typeof rc === 'function') window.renderCalendar = function () { const r = rc.apply(this, arguments); try { render('t'); } catch (e) {} return r; };
  const stt = window.switchTeacherTab;
  if (typeof stt === 'function') window.switchTeacherTab = function (t) { const r = stt.apply(this, arguments); if (t === 'calendar') try { render('t'); } catch (e) {} return r; };
})();

/* ============ Round 7 · Admin mobile: slide-in side drawer ============ */
(function () {
  const mq = window.matchMedia ? window.matchMedia('(max-width: 992px)') : { matches: false };
  window.k8AdmNav = function (open) {
    const nav = document.getElementById('k8AdminNav'), bd = document.getElementById('k8AdmBackdrop'), bt = document.getElementById('k8AdmBurger');
    if (!nav) return;
    const isOpen = open && mq.matches;
    document.body.classList.toggle('k8-adm-open', !!isOpen);
    if (bd) bd.hidden = !isOpen;
    if (bt) bt.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) { const a = nav.querySelector('.admin-tab-btn.active') || nav.querySelector('.admin-tab-btn'); if (a) setTimeout(() => a.focus(), 50); }
    else if (open === false && bt && mq.matches) bt.focus();
  };
  function syncTitle() {
    const a = document.querySelector('#k8AdminNav .admin-tab-btn.active');
    const t = document.getElementById('k8AdmBarTitle');
    if (a && t) t.textContent = (a.childNodes.length ? Array.from(a.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ') : a.textContent).replace(/\s+/g, ' ').trim() || 'เมนูแอดมิน';
    const pill = document.getElementById('adminTabPendingBadge'), bb = document.getElementById('k8AdmBarBadge');
    if (bb) { const n = pill && pill.style.display !== 'none' ? (pill.textContent || '').trim() : ''; bb.hidden = !n || n === '0'; bb.textContent = n ? n + ' รออนุมัติ' : ''; }
  }
  const o = window.switchAdminTab;
  if (typeof o === 'function') window.switchAdminTab = function () { const r = o.apply(this, arguments); window.k8AdmNav(false); setTimeout(syncTitle, 0); return r; };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('k8-adm-open')) window.k8AdmNav(false); });
  if (mq.addEventListener) mq.addEventListener('change', () => window.k8AdmNav(false));
  // swipe from the left edge to open, swipe left to close
  let sx = null, sy = 0;
  document.addEventListener('touchstart', (e) => { const v = document.getElementById('view-admin'); if (!v || !v.classList.contains('active') || !mq.matches) return; const t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (sx == null) return; const t = e.changedTouches[0]; const dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    if (dy < 60) { if (!document.body.classList.contains('k8-adm-open') && sx < 24 && dx > 60) window.k8AdmNav(true); else if (document.body.classList.contains('k8-adm-open') && dx < -60) window.k8AdmNav(false); }
    sx = null;
  }, { passive: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncTitle); else syncTitle();
  setInterval(() => { const v = document.getElementById('view-admin'); if (v && v.classList.contains('active')) syncTitle(); }, 4000);
})();

/* ============ Round 8 · Teacher attendance per subject + date + history ============ */
(function () {
  const readJSON = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? f : v; } catch (e) { return f; } };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const js = (v) => esc(String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const KINDS = [['present', 'มา', '#15803d', '#f0fdf4'], ['late', 'สาย', '#b45309', '#fffbeb'], ['leave', 'ลา', '#1d4ed8', '#eff6ff'], ['absent', 'ขาด', '#b91c1c', '#fef2f2']];
  const cid = (id) => { try { return cleanIdString(id); } catch (e) { return String(id); } };
  const norm = (id) => String(id == null ? '' : id).replace(/^0+/, '');
  const toKey = (st) => { st = String(st || ''); return /สาย|late/i.test(st) ? 'late' : /ลา|leave|excuse/i.test(st) ? 'leave' : /ขาด|absent/i.test(st) ? 'absent' : 'present'; };
  const initialOf = (n) => String(n || '').replace(/^(เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|นาย|นางสาว|นาง)\s*/, '').trim().charAt(0) || 'น';
  const shortG = (g) => { const m = String(g || '').match(/(\d)/); return m && /มัธยม/.test(g) ? 'ม.' + m[1] : (g || ''); };
  const S = { subject: null, date: ymd(new Date()), grade: 'ALL', draft: {} };
  window.k8TaState = S;

  function subjects() {
    let subs = []; try { subs = appSubjects || []; } catch (e) {}
    let a = null; try { a = currentAdmin; } catch (e) {}
    const isSuper = a && /SUPER|^admin$/i.test(String(a.role || ''));
    const mine = a && Array.isArray(a.assignedSubjects) ? a.assignedSubjects.map(String) : [];
    let list = subs.filter((x) => isSuper || !mine.length || mine.indexOf(String(x.id)) !== -1 || mine.indexOf(String(x.code)) !== -1);
    if (!list.length) list = subs.slice();
    return [{ id: '', code: '', name: 'โฮมรูม / ทั้งวัน' }].concat(list);
  }
  function subjLabel(id) { const x = subjects().find((s) => String(s.id) === String(id)); return x ? (x.code ? x.code + ' · ' : '') + x.name : (id || 'โฮมรูม / ทั้งวัน'); }
  function logs() { return readJSON('khalifah_attendance_logs', []); }
  function savedMap(date, subj) {
    const m = {};
    logs().forEach((r) => { if (r && r.date === date && String(r.subjectCode || '') === String(subj || '')) m[norm(r.studentId)] = toKey(r.status); });
    if (!subj) { const loc = (readJSON('khalifah_daily_attendance_logs', {})[date]) || {}; Object.keys(loc).forEach((k) => { if (!m[norm(k)]) m[norm(k)] = loc[k]; }); }
    return m;
  }
  const dkey = () => S.date + '|' + (S.subject || '');
  function rows() { const all = (typeof allStudents !== 'undefined' ? allStudents : []).filter((s) => s && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(s.status || ''))); return all.filter((s) => S.grade === 'ALL' || s.grade === S.grade); }

  function render() {
    const listEl = document.getElementById('k8TaList'); if (!listEl) return;
    const subs = subjects();
    if (S.subject == null || !subs.some((x) => String(x.id) === String(S.subject))) S.subject = subs[1] ? subs[1].id : '';
    const ss = document.getElementById('k8TaSubject');
    if (ss) ss.innerHTML = subs.map((x) => '<option value="' + esc(x.id) + '"' + (String(x.id) === String(S.subject) ? ' selected' : '') + '>' + esc((x.code ? x.code + ' · ' : '') + x.name) + '</option>').join('');
    const di = document.getElementById('k8TaDateInput'); if (di) { di.value = S.date; di.removeAttribute('max'); }
    const all = (typeof allStudents !== 'undefined' ? allStudents : []);
    const gs = document.getElementById('k8TaGrade');
    const GR = ['ALL', 'มัธยมศึกษาปีที่ 1', 'มัธยมศึกษาปีที่ 2', 'มัธยมศึกษาปีที่ 3', 'มัธยมศึกษาปีที่ 4', 'มัธยมศึกษาปีที่ 5', 'มัธยมศึกษาปีที่ 6'];
    if (gs) gs.innerHTML = GR.map((g) => { const n = g === 'ALL' ? all.length : all.filter((s) => s.grade === g).length; return (g === 'ALL' || n) ? '<option value="' + g + '"' + (g === S.grade ? ' selected' : '') + '>' + (g === 'ALL' ? 'ทุกระดับชั้น' : g) + ' · ' + n + ' คน</option>' : ''; }).join('');
    const saved = savedMap(S.date, S.subject);
    const draft = S.draft[dkey()] || (S.draft[dkey()] = {});
    const cnt = { present: 0, late: 0, leave: 0, absent: 0 }; let unsaved = 0, changed = 0;
    const list = rows();
    listEl.innerHTML = list.length ? list.map((s) => {
      const id = cid(s.studentId), k = norm(s.studentId);
      const cur = draft[k] || saved[k] || 'present';
      cnt[cur]++; if (!saved[k]) unsaved++; else if (draft[k] && draft[k] !== saved[k]) changed++;
      return '<li class="k8-ta-card' + (saved[k] ? ' is-saved' : '') + '"><div class="k8-ta-top"><span class="k8-ta-av">' + esc(initialOf(s.fullName)) + '</span><span class="k8-ta-name" title="' + esc(s.fullName) + '">' + esc(s.fullName) + '</span><span class="k8-ta-id">' + esc(id) + (S.grade === 'ALL' ? ' · ' + esc(shortG(s.grade)) : '') + '</span></div>' +
        '<div class="k8-ta-opts" role="radiogroup" aria-label="สถานะของ ' + esc(s.fullName) + '">' + KINDS.map(([kk, label, ink, bg]) => { const on = cur === kk; return '<button type="button" role="radio" aria-checked="' + on + '" style="' + (on ? 'background:' + ink + ';color:#fff;border-color:' + ink : 'background:' + bg + ';color:' + ink + ';border-color:' + bg) + '" onclick="k8TaMark(\'' + js(k) + '\',\'' + kk + '\')">' + label + '</button>'; }).join('') + '</div></li>';
    }).join('') : '<li class="k8-li-empty">ไม่มีนักเรียนในระดับชั้นนี้</li>';
    document.getElementById('k8TaSum').innerHTML = KINDS.map(([kk, label, ink, bg]) => '<div style="background:' + bg + ';color:' + ink + '"><b>' + cnt[kk] + '</b><span>' + label + '</span></div>').join('');
    const pe = document.getElementById('k8TaPending');
    pe.textContent = unsaved ? 'ยังไม่บันทึก ' + unsaved + ' คน' : changed ? 'แก้ไข ' + changed + ' คน ยังไม่บันทึก' : 'บันทึกครบทุกคนแล้ว';
    pe.style.color = (unsaved || changed) ? '#b45309' : '#15803d';
    document.getElementById('k8TaFootSub').textContent = subjLabel(S.subject) + ' · ' + fmtDate(S.date);
    const note = document.getElementById('k8TaSavedNote');
    const anySaved = Object.keys(saved).length > 0;
    note.hidden = !anySaved;
    if (anySaved) note.textContent = 'วันนี้วิชานี้เคยเช็คชื่อแล้ว ' + Object.keys(saved).length + ' คน · แก้ไขแล้วกดบันทึกเพื่ออัปเดต';
  }
  function fmtDate(d) { const x = new Date(d + 'T00:00:00'); return DAYS[x.getDay()] + ' ' + x.getDate() + ' ' + MON[x.getMonth()] + ' ' + (x.getFullYear() + 543) + (d === ymd(new Date()) ? ' (วันนี้)' : ''); }

  window.k8TaSet = function (k, v) { if (k === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) return; S[k] = v; render(); };
  window.k8TaDay = function (n) { const d = new Date(S.date + 'T00:00:00'); d.setDate(d.getDate() + n); S.date = ymd(d); render(); };
  window.k8TaMark = function (k, st) { (S.draft[dkey()] = S.draft[dkey()] || {})[k] = st; render(); };
  window.k8TaAll = function (st) { const d = S.draft[dkey()] = S.draft[dkey()] || {}; rows().forEach((s) => { d[norm(s.studentId)] = st; }); render(); if (typeof showToast === 'function') showToast('ตั้งเป็น "มา" ทุกคนแล้ว กดบันทึกเพื่อยืนยัน', 'info'); };
  window.k8TaSave = async function () {
    const list = rows(); if (!list.length) return;
    if (S.date > ymd(new Date())) { if (typeof showToast === 'function') showToast('ยังไม่ถึงวันที่เลือก · บันทึกการเช็คชื่อล่วงหน้าไม่ได้', 'warning'); return; }
    const saved = savedMap(S.date, S.subject), draft = S.draft[dkey()] || {};
    const records = {}, details = {};
    list.forEach((s) => { const k = norm(s.studentId), id = cid(s.studentId); records[id] = draft[k] || saved[k] || 'present'; details[id] = { fullName: s.fullName, grade: s.grade }; });
    const subj = subjects().find((x) => String(x.id) === String(S.subject)) || {};
    let a = null; try { a = currentAdmin; } catch (e) {}
    const btn = document.getElementById('k8TaSaveBtn'); if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก…'; }
    let res = null;
    try {
      res = await gasApiCall('saveDailyAttendance', { date: S.date, grade: S.grade === 'ALL' ? '' : S.grade, subjectCode: subj.id || '', subjectName: subj.name || '', teacherId: a ? a.username : '', teacherName: a ? (a.fullName || a.username) : '', records: records, studentDetails: details });
    } catch (e) { res = { success: false, message: (typeof describeNetworkError === 'function' ? describeNetworkError(e) : 'เชื่อมต่อไม่สำเร็จ') }; }
    if (btn) { btn.disabled = false; btn.textContent = 'บันทึก'; }
    if (!res || !res.success) { if (typeof showToast === 'function') showToast((res && res.message) || 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 'error'); return; }
    // อัปเดตแคชในเครื่อง
    const L = logs().filter((r) => !(r && r.date === S.date && String(r.subjectCode || '') === String(subj.id || '') && records[cid(r.studentId)] !== undefined));
    const TH = { present: 'มา', late: 'มาสาย', leave: 'ลา', absent: 'ขาด' };
    const now = new Date();
    Object.keys(records).forEach((id) => L.push({ studentId: id, studentName: details[id].fullName, grade: details[id].grade, date: S.date, time: pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':00', status: TH[records[id]], subjectCode: subj.id || '', subjectName: subj.name || '', checkedBy: a ? (a.fullName || a.username) : '' }));
    try { localStorage.setItem('khalifah_attendance_logs', JSON.stringify(L)); } catch (e) {}
    S.draft[dkey()] = {};
    render();
    try { if (typeof playSuccessSound === 'function') playSuccessSound(); } catch (e) {}
    if (typeof showToast === 'function') showToast('บันทึกเช็คชื่อ ' + subjLabel(S.subject) + ' · ' + fmtDate(S.date) + ' (' + Object.keys(records).length + ' คน) แล้ว', 'success');
    try { window.renderTeacherHomeV8 && window.renderTeacherHomeV8(); window.renderTeacherTodoV8 && window.renderTeacherTodoV8(); } catch (e) {}
  };
  window.k8TaOpenHistory = function () {
    const body = document.getElementById('k8TaHistBody'); if (!body) return;
    document.getElementById('k8TaHistSub').textContent = subjLabel(S.subject) + (S.grade === 'ALL' ? '' : ' · ' + shortG(S.grade));
    const ids = {}; rows().forEach((s) => { ids[norm(s.studentId)] = 1; });
    const byDate = {};
    logs().forEach((r) => {
      if (!r || String(r.subjectCode || '') !== String(S.subject || '') || !ids[norm(r.studentId)]) return;
      const d = byDate[r.date] || (byDate[r.date] = { present: 0, late: 0, leave: 0, absent: 0, by: r.checkedBy || '' });
      d[toKey(r.status)]++;
    });
    const dates = Object.keys(byDate).sort().reverse();
    body.innerHTML = dates.length ? dates.map((d) => { const x = byDate[d]; return '<button type="button" class="k8-hist-row" onclick="k8TaGoDate(\'' + d + '\')"><span class="k8-hist-d"><b>' + fmtDate(d) + '</b>' + (x.by ? '<small>โดย ' + esc(x.by) + '</small>' : '') + '</span><span class="k8-hist-c">' + KINDS.map(([kk, l, ink, bg]) => '<i style="background:' + bg + ';color:' + ink + '">' + l + ' ' + x[kk] + '</i>').join('') + '</span></button>'; }).join('')
      : '<p class="k8-li-empty">ยังไม่เคยเช็คชื่อวิชานี้</p>';
    openModal('k8TaHistoryModal');
  };
  window.k8TaGoDate = function (d) { S.date = d; closeModal('k8TaHistoryModal'); render(); };
  // แทนที่ระบบเช็คชื่อเดิม
  window.renderTeacherAttendanceTable = function () { try { render(); } catch (e) { console.warn('k8 att', e); } };
  window.renderTeacherAttV8 = window.renderTeacherAttendanceTable;
  window.saveTeacherAttendanceBatch = window.k8TaSave;
  window.saveTeacherDailyAttendance = window.k8TaSave;
  window.markAllTeacherAttendance = function (st) { window.k8TaAll(st || 'present'); };
  window.markAllStudentsPresentInClass = window.markAllTeacherAttendance;
})();

/* ============ Round 8 · Student attendance drill-down (by subject, period, history) ============ */
(function () {
  const readJSON = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? f : v; } catch (e) { return f; } };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const MF = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const K = [['present', 'มา', '#15803d', '#f0fdf4'], ['late', 'สาย', '#b45309', '#fffbeb'], ['leave', 'ลา', '#1d4ed8', '#eff6ff'], ['absent', 'ขาด', '#b91c1c', '#fef2f2']];
  const toKey = (st) => { st = String(st || ''); return /สาย|late/i.test(st) ? 'late' : /ลา|leave|excuse/i.test(st) ? 'leave' : /ขาด|absent/i.test(st) ? 'absent' : 'present'; };
  const sameId = (a, b) => String(a || '').replace(/^0+/, '') === String(b || '').replace(/^0+/, '');
  const st = { period: 'day', offset: 0, filter: 'all' };
  function range() {
    const t = new Date(); const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    if (st.period === 'day') { const d = new Date(today); d.setDate(d.getDate() + st.offset); return { s: d, e: d, label: DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + (d.getFullYear() + 543) }; }
    if (st.period === 'month') { const s = new Date(today.getFullYear(), today.getMonth() + st.offset, 1); const e = new Date(s.getFullYear(), s.getMonth() + 1, 0); return { s, e, label: MF[s.getMonth()] + ' ' + (s.getFullYear() + 543) }; }
    const dow = (today.getDay() + 6) % 7; const s = new Date(today); s.setDate(today.getDate() - dow + st.offset * 7); const e = new Date(s); e.setDate(s.getDate() + 6);
    return { s, e, label: s.getDate() + ' ' + MON[s.getMonth()] + ' – ' + e.getDate() + ' ' + MON[e.getMonth()] + ' ' + (e.getFullYear() + 543) };
  }
  function subjName(code, fallback) {
    if (!code) return 'โฮมรูม / ทั้งวัน';
    let subs = []; try { subs = appSubjects || []; } catch (e) {}
    const x = subs.find((y) => String(y.id) === String(code) || String(y.code) === String(code));
    return x ? x.name : (fallback || code);
  }
  function render() {
    let s = null; try { s = currentStudent; } catch (e) {}
    if (!s) return;
    const r = range(); const from = ymd(r.s), to = ymd(r.e);
    document.querySelectorAll('#k8AttPeriods button').forEach((b) => { const on = b.dataset.p === st.period; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    document.getElementById('k8AttRange').textContent = r.label + (st.offset === 0 ? '' : '');
    document.getElementById('k8AttNext').disabled = false;
    const uniq = {};
    readJSON('khalifah_attendance_logs', []).forEach((l) => {
      if (!l || !sameId(l.studentId, s.studentId) || !l.date || l.date < from || l.date > to) return;
      uniq[l.date + '|' + (l.subjectCode || '')] = l;
    });
    const recs = Object.values(uniq).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
    const cnt = { present: 0, late: 0, leave: 0, absent: 0 };
    recs.forEach((l) => cnt[toKey(l.status)]++);
    document.getElementById('k8AttChips').innerHTML = [['all', 'ทั้งหมด', '#0f172a', '#f1f5f9']].concat(K).map(([k, l, ink, bg]) => {
      const on = st.filter === k; const n = k === 'all' ? recs.length : cnt[k];
      return '<button type="button" aria-pressed="' + on + '" style="' + (on ? 'background:' + ink + ';color:#fff;border-color:' + ink : 'background:' + bg + ';color:' + ink + ';border-color:' + bg) + '" onclick="k8AttSet(\'filter\',\'' + k + '\')">' + l + ' ' + n + '</button>';
    }).join('');
    const bySub = {};
    recs.forEach((l) => { const key = l.subjectCode || ''; const g = bySub[key] || (bySub[key] = { name: subjName(key, l.subjectName), present: 0, late: 0, leave: 0, absent: 0 }); g[toKey(l.status)]++; });
    const subKeys = Object.keys(bySub).sort((a, b) => bySub[a].name.localeCompare(bySub[b].name, 'th'));
    document.getElementById('k8AttSubjects').innerHTML = subKeys.length ? subKeys.map((k) => { const g = bySub[k]; const tot = g.present + g.late + g.leave + g.absent; const pct = tot ? Math.round((g.present + g.late) / tot * 100) : 0;
      return '<div class="k8-att-sub"><div class="k8-att-sub-top"><b>' + esc(g.name) + '</b><span>มาเรียน ' + pct + '%</span></div><div class="k8-att-sub-c">' + K.map(([kk, l, ink, bg]) => g[kk] ? '<i style="background:' + bg + ';color:' + ink + '">' + l + ' ' + g[kk] + '</i>' : '').join('') + '</div></div>'; }).join('')
      : '<p class="k8-li-empty" style="text-align:left;padding:4px 0">ยังไม่มีการเช็คชื่อในช่วงนี้</p>';
    const shown = recs.filter((l) => st.filter === 'all' || toKey(l.status) === st.filter);
    document.getElementById('k8AttList').innerHTML = shown.length ? shown.map((l) => { const kk = toKey(l.status); const k = K.find((x) => x[0] === kk); const d = new Date(l.date + 'T00:00:00');
      return '<div class="k8-att-row"><span class="k8-att-date"><b>' + d.getDate() + '</b>' + MON[d.getMonth()] + '</span><span class="k8-att-main"><b>' + esc(subjName(l.subjectCode, l.subjectName)) + '</b><span>' + DAYS[d.getDay()] + (l.time ? ' · ' + String(l.time).slice(0, 5) + ' น.' : '') + (l.checkedBy ? ' · ' + esc(l.checkedBy) : '') + '</span></span><span class="k8-pill" style="background:' + k[3] + ';color:' + k[2] + '">' + k[1] + '</span></div>'; }).join('')
      : '<p class="k8-li-empty" style="text-align:left;padding:4px 0">ไม่มีรายการ</p>';
  }
  window.k8AttSet = function (k, v) {
    if (k === 'period') { st.period = v; st.offset = 0; }
    else if (k === 'shift') { st.offset = st.offset + v; }
    else if (k === 'filter') st.filter = v;
    render();
  };
  window.k8AttDetail = function (i) {
    let p = 'week'; try { const sel = document.querySelector('#hfPeriods button[aria-selected="true"]'); if (sel) p = sel.dataset.period; } catch (e) {}
    st.period = p; st.offset = 0; st.filter = ['present', 'late', 'leave', 'absent'][i] || 'all';
    render(); openModal('k8AttModal');
  };
})();

/* ============ Round 8 · ผลบุญ (Hasanat) — redesigned ============ */
(function () {
  const readJSON = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? f : v; } catch (e) { return f; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const PAGES = 604, PER_JUZ = 20;
  const sameId = (a, b) => String(a || '').replace(/^0+/, '') === String(b || '').replace(/^0+/, '');
  const RAWATIB = [['subhBefore', 'ก่อนซุบฮิ', 2, true], ['dhuhrBefore', 'ก่อนซุฮริ', 4, true], ['dhuhrAfter', 'หลังซุฮริ', 2, true], ['asrBefore', 'ก่อนอัศริ', 4, false], ['maghribBefore', 'ก่อนมัฆริบ', 2, false], ['maghribAfter', 'หลังมัฆริบ', 2, true], ['ishaBefore', 'ก่อนอิชาอ์', 2, false], ['ishaAfter', 'หลังอิชาอ์', 2, true]];
  const EXTRA = [['duha', 'ดุฮา', [0, 2, 4, 6, 8]], ['witr', 'วิตร์', [0, 1, 3, 5, 7]], ['tahajjud', 'ตะฮัจญุด', [0, 2, 4, 6, 8]]];
  const S = { tab: 'quran', date: null, add: 0, editPage: false, period: 'day', memFilter: 'all', memQ: '', sun: null, sunDate: null };
  window.k8HasState = S;

  function stu() { try { return currentStudent || null; } catch (e) { return null; } }
  function H() { const s = stu(); if (!s) return null; try { return getStudentHasanat(s.studentId); } catch (e) { return null; } }
  function saveH(h) { const s = stu(); if (h && s && !h.studentId) h.studentId = s.studentId; try { saveStudentHasanat(h); } catch (e) {} }
  function rows() { const s = stu(); return s ? readJSON('khalifah_hasanat_rows', []).filter((r) => r && sameId(r.studentId, s.studentId)) : []; }
  function rowOf(date) { return rows().find((r) => r.date === date) || null; }
  function upsertRow(date, patch) {
    const s = stu(); if (!s) return;
    const all = readJSON('khalifah_hasanat_rows', []);
    let r = all.find((x) => x && sameId(x.studentId, s.studentId) && x.date === date);
    if (!r) { r = { studentId: s.studentId, date: date, quran: {}, memorization: {}, sunnah: {} }; all.push(r); }
    ['quran', 'memorization', 'sunnah'].forEach((k) => { if (patch[k]) r[k] = Object.assign({}, r[k] || {}, patch[k]); });
    writeJSON('khalifah_hasanat_rows', all);
  }
  const today = () => ymd(new Date());
  const memList = (h) => {
    let SUR = []; try { SUR = QURAN_SURAHS || []; } catch (e) {}
    const clean = (t) => String(t || '').replace(/[\s\-อัลอันอัรอัซอัชอัฏอัฎ]/g, '');
    return Array.from(new Set(((h && h.memorization && h.memorization.memorizedSurahs) || []).map((x) => {
      const n = Number(x); if (n >= 1 && n <= 114) return n;
      const m = SUR.find((y) => y.name === x || clean(y.name) === clean(x)); return m ? m.num : 0;
    }).filter((x) => x >= 1 && x <= 114))).sort((a, b) => a - b);
  };
  function quranState(h) {
    const page = Math.max(0, Math.min(PAGES, Number(h && h.quran && h.quran.currentPage) || 0));
    const khatam = Math.max(0, Number(h && h.quran && h.quran.khatamCount) || 0);
    const done = Math.min(30, Math.floor(page / PER_JUZ));
    return { page, khatam, done, juz: Math.min(30, done + 1), stars: done };
  }
  function dayPages(date) { const h = H(); const d = h && h.dailyLogs && h.dailyLogs[date]; if (d && typeof d.quranPages === 'number') return d.quranPages; if (d && typeof d.pagesToday === 'number') return d.pagesToday; const r = rowOf(date); return r && r.quran ? Number(r.quran.pagesToday) || 0 : 0; }
  function daySunnah(date) { const h = H(); const d = h && h.dailyLogs && h.dailyLogs[date]; if (d && d.sunnah) return d.sunnah; const r = rowOf(date); if (r && r.sunnah) { const rw = r.sunnah.rawatib || {}; return { rawatib: rw, duhaRakaat: Number(rw.duhaRakaat) || 0, witrRakaat: Number(rw.witrRakaat) || 0, tahajjudRakaat: Number(rw.tahajjudRakaat) || 0, totalRakaat: Number(r.sunnah.totalRakaat) || 0 }; } return null; }
  function sunTotal(x) { let t = 0; RAWATIB.forEach(([k, , n]) => { if (x.rawatib && x.rawatib[k]) t += n; }); return t + (Number(x.duhaRakaat) || 0) + (Number(x.witrRakaat) || 0) + (Number(x.tahajjudRakaat) || 0); }
  function range() {
    const t = new Date(); const d0 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    if (S.period === 'day') return [ymd(d0), ymd(d0), 'วันนี้'];
    if (S.period === 'month') return [ymd(new Date(d0.getFullYear(), d0.getMonth(), 1)), ymd(new Date(d0.getFullYear(), d0.getMonth() + 1, 0)), 'เดือนนี้'];
    const s = new Date(d0); s.setDate(d0.getDate() - (d0.getDay() + 6) % 7); const e = new Date(s); e.setDate(s.getDate() + 6);
    return [ymd(s), ymd(e), 'สัปดาห์นี้'];
  }
  // ใช้ร่วมกับหน้าแรก: อ่าน n หน้า / ท่องจำใหม่ n / สุนัต n ในช่วงเวลา
  window.k8HasanatStats = function (from, to) {
    const h = H(); if (!h) return { pages: 0, mem: 0, rakaat: 0 };
    const dates = {};
    rows().forEach((r) => { if (r.date >= from && r.date <= to) dates[r.date] = 1; });
    Object.keys(h.dailyLogs || {}).forEach((d) => { if (d >= from && d <= to) dates[d] = 1; });
    let pages = 0, rakaat = 0, mem = 0;
    Object.keys(dates).forEach((d) => { pages += dayPages(d); const su = daySunnah(d); if (su) rakaat += Number(su.totalRakaat) || sunTotal(su); });
    Object.keys(h.dailyLogs || {}).forEach((d) => { if (d >= from && d <= to) mem += ((h.dailyLogs[d].memNew) || []).length; });
    if (!mem) { // ข้อมูลเก่าจากชีต: นับจากจำนวนสะสมที่เพิ่มขึ้น
      const rs = rows().filter((r) => r.memorization && r.memorization.count != null).sort((a, b) => a.date.localeCompare(b.date));
      const before = rs.filter((r) => r.date < from).pop(); const inR = rs.filter((r) => r.date >= from && r.date <= to).pop();
      if (inR) mem = Math.max(0, (Number(inR.memorization.count) || 0) - (before ? Number(before.memorization.count) || 0 : 0));
    }
    return { pages, mem, rakaat };
  };

  async function push(date, extra) {
    const s = stu(), h = H(); if (!s || !h) return;
    const q = quranState(h); const su = daySunnah(date) || { rawatib: {}, totalRakaat: 0 };
    const rawatib = Object.assign({}, su.rawatib || {}, { duhaRakaat: su.duhaRakaat || 0, witrRakaat: su.witrRakaat || 0, tahajjudRakaat: su.tahajjudRakaat || 0 });
    const payload = { date: date, studentName: s.fullName, grade: s.grade,
      quran: { pagesToday: dayPages(date), currentPage: q.page, juzCompleted: q.done, stars: q.stars, khatamCount: q.khatam },
      memorization: { count: memList(h).length, memorizedSurahs: memList(h) },
      sunnah: { totalRakaat: Number(su.totalRakaat) || 0, rawatib: rawatib } };
    upsertRow(date, payload);
    try { if (typeof renderHomeF === 'function') renderHomeF(); } catch (e) {}
    let res = null;
    try { res = await gasApiCall('saveHasanatLog', payload); } catch (e) { res = { success: false }; }
    if (!res || !res.success) { if (typeof showToast === 'function') showToast('บันทึกในเครื่องแล้ว แต่ยังส่งขึ้นระบบไม่สำเร็จ จะลองใหม่เมื่อออนไลน์', 'warning'); }
    else if (extra && typeof showToast === 'function') showToast(extra, 'success');
  }

  function header() {
    const d = new Date(S.date + 'T00:00:00'); const isToday = S.date === today();
    const [from, to, lbl] = range(); const st = window.k8HasanatStats(from, to);
    return '<header class="k8h-head"><h1>ผลบุญของฉัน</h1>' +
      '<div class="k8h-date"><button type="button" aria-label="วันก่อนหน้า" onclick="k8HasDay(-1)">‹</button><label><span>' + (isToday ? 'วันนี้ · ' : '') + DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + '</span><input type="date" value="' + S.date + '" onchange="k8HasDate(this.value)" aria-label="เลือกวันที่บันทึก"></label><button type="button" aria-label="วันถัดไป" onclick="k8HasDay(1)">›</button></div></header>' +
      (S.date > today() ? '<p class="k8h-future">วันที่เลือกยังมาไม่ถึง · ดูได้อย่างเดียว บันทึกได้เมื่อถึงวันนั้น <button type="button" onclick="k8HasDate(\'' + today() + '\')">กลับวันนี้</button></p>' : (!isToday ? '<p class="k8h-future is-past">กำลังดูวันย้อนหลัง <button type="button" onclick="k8HasDate(\'' + today() + '\')">กลับวันนี้</button></p>' : '')) +
      '<section class="k8h-sum"><div class="k8h-sum-top"><b>สรุปผลบุญ</b><div class="k8h-mini-seg">' + [['day', 'วันนี้'], ['week', 'สัปดาห์'], ['month', 'เดือน']].map(([k, l]) => '<button type="button" aria-pressed="' + (S.period === k) + '" onclick="k8HasSet(\'period\',\'' + k + '\')">' + l + '</button>').join('') + '</div></div>' +
      '<div class="k8h-sum-grid"><div><span>อ่านอัลกุรอาน</span><b style="color:#b45309">' + st.pages + ' <small>หน้า</small></b></div><div><span>ท่องจำใหม่</span><b style="color:#15803d">' + st.mem + ' <small>ซูเราะห์</small></b></div><div><span>สุนัต</span><b style="color:#6d28d9">' + st.rakaat + ' <small>ร็อกอะฮ์</small></b></div></div></section>' +
      '<div class="k8-seg k8h-tabs" role="tablist">' + [['quran', 'อัลกุรอาน'], ['memorize', 'ท่องจำ'], ['sunnah', 'สุนัต']].map(([k, l]) => '<button type="button" role="tab" class="' + (S.tab === k ? 'on' : '') + '" aria-selected="' + (S.tab === k) + '" onclick="k8HasSet(\'tab\',\'' + k + '\')">' + l + '</button>').join('') + '</div>';
  }
  function quranTab() {
    const h = H(); const q = quranState(h); const add = Math.max(0, S.add | 0);
    let next = q.page + add, kh = q.khatam; while (next > PAGES) { next -= PAGES; kh++; }
    const finishing = q.page + add >= PAGES;
    const dp = dayPages(S.date);
    let html = '<section class="k8h-card"><div class="k8h-q-top"><div><span class="k8h-lbl">อ่านถึงหน้าที่</span><div class="k8h-big">' + q.page + ' <small>/ ' + PAGES + '</small></div></div>' +
      '<div class="k8h-q-meta"><span class="k8h-star">★ ' + q.stars + ' ดาว</span><span>ยุซที่ ' + q.juz + ' · ค็อตม์ ' + q.khatam + ' ครั้ง</span></div></div>' +
      '<div class="k8h-bar"><span style="width:' + (q.page / PAGES * 100).toFixed(1) + '%"></span></div>' +
      '<p class="k8h-hint">อ่านจบ 1 ยุซ (20 หน้า) ได้ 1 ดาว · อ่านครบ 604 หน้า = ค็อตม์ 1 ครั้ง แล้วเริ่มรอบใหม่</p>' +
      (S.editPage ? '<div class="k8h-edit"><label>หน้าปัจจุบัน<input type="number" id="k8hEditPage" min="0" max="604" value="' + q.page + '"></label><label>ค็อตม์ (ครั้ง)<input type="number" id="k8hEditKh" min="0" max="99" value="' + q.khatam + '"></label><div class="k8h-row"><button type="button" class="k8-btn-line" onclick="k8HasSet(\'editPage\',false)">ยกเลิก</button><button type="button" class="k8-btn-pri" onclick="k8HasSaveEdit()">บันทึกการแก้ไข</button></div></div>'
        : '<button type="button" class="k8h-link" onclick="k8HasSet(\'editPage\',true)">แก้ไขหน้าปัจจุบัน / จำนวนค็อตม์</button>') + '</section>';
    html += '<section class="k8h-card"><div class="k8h-row-b"><h2>' + (S.date === today() ? 'วันนี้อ่านเพิ่ม' : 'อ่านเพิ่มวันที่เลือก') + '</h2><span class="k8h-muted">' + (dp ? 'บันทึกแล้ว ' + dp + ' หน้า' : 'ยังไม่ได้บันทึก') + '</span></div>' +
      '<div class="k8h-step"><button type="button" aria-label="ลด 1 หน้า" onclick="k8HasAdd(-1)">−</button><div><b>' + add + '</b><span>หน้า</span></div><button type="button" class="is-plus" aria-label="เพิ่ม 1 หน้า" onclick="k8HasAdd(1)">+</button></div>' +
      '<div class="k8h-quick"><button type="button" onclick="k8HasAdd(5)">+5 หน้า</button><button type="button" onclick="k8HasAdd(10)">+10 หน้า</button><button type="button" onclick="k8HasAdd(20)">+1 ยุซ</button><button type="button" class="is-clear" onclick="k8HasSet(\'add\',0)">ล้าง</button></div>' +
      '<button type="button" class="k8h-save" onclick="k8HasSaveQuran()"' + (add ? '' : ' disabled') + '>' + (add ? (finishing ? '🎉 บันทึก · อ่านจบ 30 ยุซ!' : 'บันทึก · จะอ่านถึงหน้า ' + next) : 'กด + เพื่อเพิ่มจำนวนหน้าที่อ่าน') + '</button></section>';
    html += '<section class="k8h-card"><div class="k8h-row-b"><h2>ความคืบหน้า 30 ยุซ</h2><span class="k8h-muted">จบแล้ว ' + q.done + ' ยุซ</span></div><div class="k8h-juz">' +
      Array.from({ length: 30 }, (_, i) => { const n = i + 1; const cls = n <= q.done ? 'done' : (n === q.juz && q.done < 30 ? 'cur' : ''); return '<span class="' + cls + '" title="ยุซที่ ' + n + '">' + n + '</span>'; }).join('') + '</div></section>';
    return html;
  }
  function memTab() {
    const h = H(); const mem = new Set(memList(h)); let list = [];
    try { list = QURAN_SURAHS || []; } catch (e) {}
    const q = (S.memQ || '').trim();
    const shown = list.filter((x) => (S.memFilter === 'all' || (S.memFilter === 'amma' && x.num >= 78) || (S.memFilter === 'done' && mem.has(x.num)) || (S.memFilter === 'todo' && !mem.has(x.num))) && (!q || String(x.num) === q || x.name.indexOf(q) !== -1 || (x.arabic || '').indexOf(q) !== -1));
    const newToday = ((h.dailyLogs || {})[S.date] || {}).memNew || [];
    return '<section class="k8h-card"><span class="k8h-lbl">ท่องจำได้แล้ว</span><div class="k8h-big">' + mem.size + ' <small>/ 114 ซูเราะห์</small></div><div class="k8h-bar is-green"><span style="width:' + (mem.size / 114 * 100).toFixed(1) + '%"></span></div>' +
      '<p class="k8h-hint">' + (newToday.length ? 'วันที่เลือกท่องจำใหม่ ' + newToday.length + ' ซูเราะห์' : 'แตะซูเราะห์ที่ท่องจำได้ ระบบบันทึกให้อัตโนมัติ') + '</p></section>' +
      '<section class="k8h-card"><input type="search" class="k8h-search" placeholder="ค้นหาชื่อซูเราะห์ หรือเลขลำดับ" value="' + esc(S.memQ) + '" oninput="k8HasMemQ(this)">' +
      '<div class="k8h-chips">' + [['all', 'ทั้งหมด'], ['amma', 'ยุซอัมมา'], ['todo', 'ยังไม่ได้ท่อง'], ['done', 'ท่องแล้ว']].map(([k, l]) => '<button type="button" aria-pressed="' + (S.memFilter === k) + '" onclick="k8HasSet(\'memFilter\',\'' + k + '\')">' + l + '</button>').join('') + '</div>' +
      '<ul class="k8h-surahs">' + (shown.length ? shown.map((x) => { const on = mem.has(x.num); return '<li><button type="button" aria-pressed="' + on + '" onclick="k8HasToggleSurah(' + x.num + ')"><span class="k8h-sn">' + x.num + '</span><span class="k8h-st"><b>' + esc(x.name) + '</b><small>ยุซ ' + x.juz + ' · ' + x.ayahs + ' อายะฮ์</small></span><span class="k8h-ar">' + esc(x.arabic || '') + '</span><span class="k8h-ck" aria-hidden="true">' + (on ? '✓' : '') + '</span></button></li>'; }).join('') : '<li class="k8-li-empty">ไม่พบซูเราะห์</li>') + '</ul></section>';
  }
  function sunTab() {
    if (!S.sun || S.sunDate !== S.date) { const d = daySunnah(S.date); S.sun = d ? JSON.parse(JSON.stringify({ rawatib: d.rawatib || {}, duhaRakaat: d.duhaRakaat || 0, witrRakaat: d.witrRakaat || 0, tahajjudRakaat: d.tahajjudRakaat || 0 })) : { rawatib: {}, duhaRakaat: 0, witrRakaat: 0, tahajjudRakaat: 0 }; S.sunDate = S.date; }
    const x = S.sun; const total = sunTotal(x); const saved = daySunnah(S.date); const dirty = !saved || sunTotal(saved) !== total || JSON.stringify(saved.rawatib || {}) !== JSON.stringify(x.rawatib);
    return '<section class="k8h-card"><div class="k8h-row-b"><h2>' + (S.date === today() ? 'ละหมาดสุนัตวันนี้' : 'ละหมาดสุนัตวันที่เลือก') + '</h2><span class="k8h-sun-total">' + total + ' ร็อกอะฮ์</span></div><div class="k8h-bar is-purple"><span style="width:' + Math.min(100, total / 12 * 100) + '%"></span></div><p class="k8h-hint">เป้าหมายรอติบมุอักกัด 12 ร็อกอะฮ์ต่อวัน</p>' +
      '<h3 class="k8h-sub">รอติบ (ก่อน-หลังฟัรฎู)</h3><ul class="k8h-checks">' + RAWATIB.map(([k, l, n, mu]) => '<li><label><input type="checkbox"' + (x.rawatib[k] ? ' checked' : '') + ' onchange="k8HasSun(\'' + k + '\', this.checked)"><span><b>' + l + '</b><small>' + n + ' ร็อกอะฮ์' + (mu ? ' · มุอักกัด' : '') + '</small></span></label></li>').join('') + '</ul>' +
      EXTRA.map(([k, l, opts]) => '<h3 class="k8h-sub">' + l + '</h3><div class="k8h-chips">' + opts.map((o) => '<button type="button" aria-pressed="' + ((Number(x[k + 'Rakaat']) || 0) === o) + '" onclick="k8HasSunN(\'' + k + '\',' + o + ')">' + (o ? o + ' ร็อกอะฮ์' : 'ไม่ได้ทำ') + '</button>').join('') + '</div>').join('') +
      '<button type="button" class="k8h-save is-purple" onclick="k8HasSaveSun()"' + (dirty ? '' : ' disabled') + '>' + (dirty ? 'บันทึกละหมาดสุนัต (' + total + ' ร็อกอะฮ์)' : '✓ บันทึกแล้ว') + '</button></section>';
  }
  function render() {
    const root = document.getElementById('k8Has'); if (!root) return;
    if (!stu()) { root.innerHTML = '<p class="k8-li-empty">กรุณาเข้าสู่ระบบ</p>'; return; }
    if (!S.date) S.date = today();
    root.innerHTML = header() + (S.tab === 'quran' ? quranTab() : S.tab === 'memorize' ? memTab() : sunTab()) +
      '<button type="button" class="k8h-reset-btn" onclick="k8HasAskReset()">รีเซ็ตข้อมูลผลบุญทั้งหมด</button>';
  }
  window.renderHasanatV9 = render;
  window.k8HasSet = function (k, v) { S[k] = v; render(); };
  window.k8HasDate = function (v) { if (/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) { S.date = v; S.add = 0; render(); } };
  const future = () => { if (S.date > today()) { if (typeof showToast === 'function') showToast('ยังไม่ถึงวันที่เลือก · บันทึกล่วงหน้าไม่ได้', 'warning'); return true; } return false; };
  window.k8HasDay = function (n) { const d = new Date(S.date + 'T00:00:00'); d.setDate(d.getDate() + n); S.date = ymd(d); S.add = 0; render(); };
  window.k8HasAdd = function (n) { S.add = Math.max(0, Math.min(PAGES, (S.add | 0) + n)); render(); };
  window.k8HasMemQ = function (el) { S.memQ = el.value; const pos = el.selectionStart; render(); const n = document.querySelector('.k8h-search'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } };
  window.k8HasSaveQuran = function () {
    const h = H(); if (!h || !S.add || future()) return;
    const q = quranState(h); let page = q.page + S.add, kh = q.khatam, finished = 0;
    while (page > PAGES) { page -= PAGES; kh++; finished++; }
    if (page === PAGES) { page = 0; kh++; finished++; }
    h.quran = Object.assign({}, h.quran, { currentPage: page, khatamCount: kh, juzCompleted: Math.min(30, Math.floor(page / PER_JUZ)), stars: Math.min(30, Math.floor(page / PER_JUZ)), lastUpdated: new Date().toISOString() });
    h.dailyLogs = h.dailyLogs || {}; const dl = h.dailyLogs[S.date] = Object.assign({}, h.dailyLogs[S.date] || {}, { date: S.date });
    dl.quranPages = (typeof dl.quranPages === 'number' ? dl.quranPages : (typeof dl.pagesToday === 'number' ? dl.pagesToday : dayPages(S.date))) + S.add; dl.pagesToday = dl.quranPages; dl.currentPage = page;
    if (S.date === today()) h.quran.pagesToday = dl.quranPages;
    saveH(h); const added = S.add; S.add = 0; render();
    push(S.date, finished ? '🎉 ขอแสดงความยินดี อ่านจบ 30 ยุซ! ค็อตม์ครั้งที่ ' + kh : 'บันทึกการอ่าน ' + added + ' หน้าแล้ว · ★ ' + Math.min(30, Math.floor(page / PER_JUZ)) + ' ดาว');
  };
  window.k8HasSaveEdit = function () {
    const h = H(); if (!h) return;
    const p = Math.max(0, Math.min(PAGES, parseInt(document.getElementById('k8hEditPage').value, 10) || 0));
    const k = Math.max(0, Math.min(99, parseInt(document.getElementById('k8hEditKh').value, 10) || 0));
    h.quran = Object.assign({}, h.quran, { currentPage: p, khatamCount: k, juzCompleted: Math.min(30, Math.floor(p / PER_JUZ)), stars: Math.min(30, Math.floor(p / PER_JUZ)) });
    saveH(h); S.editPage = false; render(); push(S.date, 'อัปเดตหน้าปัจจุบันเป็นหน้า ' + p + ' แล้ว');
  };
  let memTimer = null;
  window.k8HasToggleSurah = function (num) {
    const h = H(); if (!h || future()) return;
    const mem = new Set(memList(h)); const on = !mem.has(num);
    if (on) mem.add(num); else mem.delete(num);
    const arr = Array.from(mem).sort((a, b) => a - b);
    h.memorization = Object.assign({}, h.memorization, { memorizedSurahs: arr, count: arr.length, lastUpdated: new Date().toISOString() });
    h.dailyLogs = h.dailyLogs || {}; const dl = h.dailyLogs[S.date] = Object.assign({}, h.dailyLogs[S.date] || {}, { date: S.date });
    const nw = new Set(dl.memNew || []); if (on) nw.add(num); else nw.delete(num); dl.memNew = Array.from(nw);
    saveH(h);
    // คงตำแหน่งเลื่อนของรายการซูเราะห์และหน้าจอไว้ ไม่ให้เด้งขึ้นด้านบนหลังติ๊ก
    const ul = document.querySelector('.k8h-surahs'); const st = ul ? ul.scrollTop : 0; const wy = window.scrollY;
    render();
    const ul2 = document.querySelector('.k8h-surahs'); if (ul2) ul2.scrollTop = st;
    if (Math.abs(window.scrollY - wy) > 1) window.scrollTo(0, wy);
    const btn = ul2 && ul2.querySelector('button[onclick="k8HasToggleSurah(' + num + ')"]'); if (btn) try { btn.focus({ preventScroll: true }); } catch (e) {}
    clearTimeout(memTimer); memTimer = setTimeout(() => push(S.date, 'บันทึกการท่องจำแล้ว · รวม ' + arr.length + ' ซูเราะห์'), 900);
  };
  window.k8HasSun = function (k, v) { S.sun.rawatib[k] = !!v; render(); };
  window.k8HasSunN = function (k, n) { S.sun[k + 'Rakaat'] = n; render(); };
  window.k8HasSaveSun = function () {
    const h = H(); if (!h || !S.sun || future()) return;
    const rec = { date: S.date, rawatib: Object.assign({}, S.sun.rawatib), duhaRakaat: S.sun.duhaRakaat || 0, witrRakaat: S.sun.witrRakaat || 0, tahajjudRakaat: S.sun.tahajjudRakaat || 0, lastUpdated: new Date().toISOString() };
    rec.totalRakaat = sunTotal(rec);
    h.dailyLogs = h.dailyLogs || {}; h.dailyLogs[S.date] = Object.assign({}, h.dailyLogs[S.date] || {}, { date: S.date, sunnah: rec });
    if (S.date === today()) h.sunnah = rec;
    saveH(h); render(); push(S.date, 'บันทึกละหมาดสุนัต ' + rec.totalRakaat + ' ร็อกอะฮ์แล้ว');
  };
  window.k8HasAskReset = function () { const i = document.getElementById('k8HasResetInput'); if (i) i.value = ''; const g = document.getElementById('k8HasResetGo'); if (g) g.disabled = true; openModal('k8HasResetModal'); setTimeout(() => i && i.focus(), 60); };
  window.k8HasDoReset = async function () {
    const s = stu(); if (!s) return;
    const g = document.getElementById('k8HasResetGo'); if (g) { g.disabled = true; g.textContent = 'กำลังลบ…'; }
    let res = null; try { res = await gasApiCall('resetMyHasanat', {}); } catch (e) { res = { success: false }; }
    if (g) g.textContent = 'ลบข้อมูลทั้งหมด';
    if (!res || !res.success) { if (typeof showToast === 'function') showToast((res && res.message) || 'รีเซ็ตไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', 'error'); return; }
    const all = readJSON('khalifah_student_hasanat', {}); Object.keys(all).forEach((k) => { if (sameId(k, s.studentId)) delete all[k]; }); writeJSON('khalifah_student_hasanat', all);
    writeJSON('khalifah_hasanat_rows', readJSON('khalifah_hasanat_rows', []).filter((r) => !(r && sameId(r.studentId, s.studentId))));
    S.add = 0; S.sun = null; closeModal('k8HasResetModal'); render();
    try { if (typeof renderHomeF === 'function') renderHomeF(); } catch (e) {}
    if (typeof showToast === 'function') showToast('รีเซ็ตข้อมูลผลบุญเรียบร้อยแล้ว', 'success');
  };
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) { const r = sv.apply(this, arguments); if (v === 'hasanat') { S.date = today(); S.add = 0; S.sun = null; render(); } return r; };
})();

/* ============ Round 8 · Teacher evaluation (anonymous) ============ */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const js = (v) => esc(String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
  const E = { targets: [], items: [], term: '', done: [], cur: null, scores: [], comment: '' };
  const LABELS = ['ควรปรับปรุง', 'พอใช้', 'ปานกลาง', 'ดี', 'ดีมาก'];
  async function load() {
    const [t, d] = await Promise.all([gasApiCall('getEvaluationTargets', {}), gasApiCall('getMyEvaluationStatus', {})]);
    if (t && t.success) { E.targets = t.data || []; E.items = t.items || []; E.term = t.term; }
    if (d && d.success) E.done = d.done || [];
    badge();
  }
  function badge() { const b = document.getElementById('k8EvalBadge'); if (!b) return; const left = E.targets.filter((x) => E.done.indexOf(x.subjectCode + '|' + x.teacher) === -1).length; b.textContent = E.targets.length ? (left ? 'ค้าง ' + left + ' วิชา' : 'ครบแล้ว ✓') : ''; b.className = 'k8-pl-badge' + (left ? ' is-todo' : ''); }
  function list() {
    const body = document.getElementById('k8EvalBody');
    document.getElementById('k8EvalSub').textContent = 'ภาคเรียนที่ ' + (E.term || '-') + ' · ไม่ระบุชื่อผู้ประเมิน';
    if (!E.targets.length) { body.innerHTML = '<p class="k8-li-empty">ยังไม่มีรายวิชาที่มีอาจารย์ผู้สอน</p>'; return; }
    body.innerHTML = '<p class="k8-eval-note">คำตอบของคุณจะไม่ถูกเชื่อมกับชื่อหรือรหัสนักเรียน อาจารย์จะเห็นเฉพาะค่าเฉลี่ยและความคิดเห็นรวม</p>' + E.targets.map((x) => {
      const done = E.done.indexOf(x.subjectCode + '|' + x.teacher) !== -1;
      return '<button type="button" class="k8-eval-row"' + (done ? ' disabled' : '') + ' onclick="k8EvalStart(\'' + js(x.subjectCode) + '\',\'' + js(x.teacher) + '\')"><span class="k8-eval-main"><b>' + esc(x.subjectName) + '</b><span>' + esc(x.teacherName || x.teacher) + '</span></span><span class="k8-pill" style="' + (done ? 'background:#f0fdf4;color:#15803d' : 'background:#f5f3ff;color:#5b21b6') + '">' + (done ? 'ประเมินแล้ว' : 'ประเมิน') + '</span></button>';
    }).join('');
  }
  function form() {
    const x = E.cur; const body = document.getElementById('k8EvalBody');
    body.innerHTML = '<button type="button" class="k8h-link" onclick="k8EvalBack()">‹ กลับไปรายวิชา</button><div class="k8-eval-who"><b>' + esc(x.subjectName) + '</b><span>' + esc(x.teacherName || x.teacher) + '</span></div>' +
      E.items.map((it, i) => '<fieldset class="k8-eval-q"><legend>' + (i + 1) + '. ' + esc(it) + '</legend><div class="k8-eval-scale">' + [1, 2, 3, 4, 5].map((n) => '<button type="button" aria-pressed="' + (E.scores[i] === n) + '" aria-label="' + n + ' ' + LABELS[n - 1] + '" onclick="k8EvalScore(' + i + ',' + n + ')">' + n + '</button>').join('') + '</div><div class="k8-eval-scale-l"><span>ควรปรับปรุง</span><span>ดีมาก</span></div></fieldset>').join('') +
      '<label class="k8-eval-c">ความคิดเห็นเพิ่มเติม (ไม่บังคับ)<textarea id="k8EvalComment" rows="3" maxlength="500" placeholder="สิ่งที่ชอบ หรือสิ่งที่อยากให้ปรับ">' + esc(E.comment) + '</textarea></label>' +
      '<button type="button" class="k8h-save is-purple" id="k8EvalSend" onclick="k8EvalSend()"' + (E.scores.filter(Boolean).length === E.items.length ? '' : ' disabled') + '>ส่งแบบประเมิน</button>';
  }
  window.k8EvalOpen = async function () {
    openModal('k8EvalModal');
    document.getElementById('k8EvalBody').innerHTML = '<p class="k8-li-empty">กำลังโหลด…</p>';
    try { await load(); } catch (e) {}
    E.cur = null; list();
  };
  window.k8EvalStart = function (code, teacher) { E.cur = E.targets.find((x) => x.subjectCode === code && x.teacher === teacher); E.scores = []; E.comment = ''; form(); };
  window.k8EvalBack = function () { E.cur = null; list(); };
  window.k8EvalScore = function (i, n) { const c = document.getElementById('k8EvalComment'); if (c) E.comment = c.value; E.scores[i] = n; form(); };
  window.k8EvalSend = async function () {
    const c = document.getElementById('k8EvalComment'); if (c) E.comment = c.value;
    const btn = document.getElementById('k8EvalSend'); if (btn) { btn.disabled = true; btn.textContent = 'กำลังส่ง…'; }
    let r = null; try { r = await gasApiCall('submitTeacherEvaluation', { subjectCode: E.cur.subjectCode, teacher: E.cur.teacher, scores: E.scores, comment: E.comment }); } catch (e) { r = { success: false }; }
    if (r && (r.success || r.already)) { E.done.push(E.cur.subjectCode + '|' + E.cur.teacher); badge(); if (typeof showToast === 'function') showToast(r.message || 'ส่งแบบประเมินแล้ว', r.success ? 'success' : 'info'); E.cur = null; list(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'ส่งแบบประเมิน'; } if (typeof showToast === 'function') showToast((r && r.message) || 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง', 'error'); }
  };
  window.k8EvalSummary = async function () {
    openModal('k8EvalSumModal');
    const body = document.getElementById('k8EvalSumBody'); body.innerHTML = '<p class="k8-li-empty">กำลังโหลด…</p>';
    let r = null; try { r = await gasApiCall('getTeacherEvaluationSummary', {}); } catch (e) {}
    if (!r || !r.success) { body.innerHTML = '<p class="k8-li-empty">' + esc((r && r.message) || 'โหลดไม่สำเร็จ') + '</p>'; return; }
    document.getElementById('k8EvalSumSub').textContent = 'ภาคเรียนที่ ' + r.term + ' · ' + (r.note || '');
    body.innerHTML = r.data.length ? r.data.map((g) => '<section class="k8-eval-res"><div class="k8-eval-res-top"><span><b>' + esc(g.subjectName) + '</b><small>' + esc(g.teacherName || g.teacher) + ' · ' + g.count + ' คนประเมิน</small></span><span class="k8-eval-avg">' + g.average.toFixed(2) + '<small>/5</small></span></div>' +
      (r.items || []).map((it, i) => '<div class="k8-eval-bar"><span>' + esc(it) + '</span><i><em style="width:' + (g.items[i] / 5 * 100) + '%"></em></i><b>' + (g.items[i] || 0).toFixed(1) + '</b></div>').join('') +
      (g.comments.length ? '<h4>ความคิดเห็น</h4><ul class="k8-eval-cm">' + g.comments.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul>' : (g.count < 3 ? '<p class="k8h-hint">ความคิดเห็นจะแสดงเมื่อมีผู้ประเมินอย่างน้อย 3 คน</p>' : '')) + '</section>').join('')
      : '<p class="k8-li-empty">ยังไม่มีผลประเมินในภาคเรียนนี้</p>';
  };
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) { const r = sv.apply(this, arguments); if (v === 'profile') { let s = null; try { s = currentStudent; } catch (e) {} if (s) load().catch(() => {}); } return r; };
})();

/* ============ Round 8 · Prayer tier list (teachers & admin only) ============ */
(function () {
  const readJSON = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? f : v; } catch (e) { return f; } };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const norm = (id) => String(id == null ? '' : id).replace(/^0+/, '');
  const T = { days: 7, grade: 'ALL', open: {} };
  function slotKey(x) { try { return normalizePrayerSlotKey(x); } catch (e) { return x; } }
  function compute() {
    const studs = (typeof allStudents !== 'undefined' ? allStudents : []).filter((s) => s && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(s.status || '')) && (T.grade === 'ALL' || s.grade === T.grade));
    const now = new Date(); const end = ymd(now);
    const startD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (T.days - 1)); const start = ymd(startD);
    let wins = []; try { wins = PRAYER_TIME_WINDOWS; } catch (e) {}
    const cur = now.getHours() * 60 + now.getMinutes();
    const todaySlots = Math.max(0, wins.filter((w) => cur >= w.endMin).length);
    const expected = (T.days - 1) * 5 + todaySlots;
    let tp = []; try { tp = todayPrayers || []; } catch (e) {}
    const recs = {};
    [...readJSON('khalifah_prayer_history', []), ...tp].forEach((p) => {
      if (!p) return; const d = String(p.date || p.timestamp || '').slice(0, 10); if (!d || d < start || d > end) return;
      const k = norm(p.studentId) + '|' + d + '|' + slotKey(p.prayerTime || p.prayerName || ''); recs[k] = p;
    });
    readJSON('khalifah_prayer_approvals', []).forEach((a) => { if (!a || !/approved|อนุมัติ/i.test(String(a.status || '')) || !a.date || a.date < start || a.date > end) return; const k = norm(a.studentId) + '|' + a.date + '|' + slotKey(a.prayerSlot || ''); if (!recs[k]) recs[k] = { studentId: a.studentId, status: 'อนุมัติย้อนหลัง', note: [a.reasonPreset, a.reasonDetail].filter(Boolean).join(' · '), date: a.date }; });
    const by = {}; studs.forEach((s) => { by[norm(s.studentId)] = { s, on: 0, late: 0, excused: 0, notes: [] }; });
    Object.keys(recs).forEach((k) => {
      const x = by[k.split('|')[0]]; if (!x) return; const p = recs[k]; const st = String(p.status || '');
      // ระวัง: "ตรงเวลา" มีคำว่า "ลา" อยู่ข้างใน จึงต้องตรวจสถานะตรงเวลา/สายก่อน
      if (/ตรงเวลา|on.?time/i.test(st)) x.on++;
      else if (/สาย|late/i.test(st)) x.late++;
      else if (/อุซุร|ประจำเดือน|ป่วย|^ลา|ลากิจ|ลาป่วย|อนุมัติ|excus|leave/i.test(st) || p.note) { x.excused++; const n = p.note || st; if (n && x.notes.indexOf(n) === -1) x.notes.push(n); }
      else x.on++;
    });
    const tiers = { s: [], late: [], miss: [], note: [], mid: [] };
    Object.values(by).forEach((x) => {
      const done = x.on + x.late; const miss = Math.max(0, expected - done - x.excused);
      x.miss = miss; x.rate = expected ? Math.round(x.on / expected * 100) : 0;
      if (expected && miss / expected >= 0.4) (x.notes.length ? tiers.note : tiers.miss).push(x);
      else if (x.late >= 3 && done && x.late / done >= 0.3) tiers.late.push(x);
      else if (expected && x.on / expected >= 0.8) tiers.s.push(x);
      else if (x.excused && x.notes.length) tiers.note.push(x);
      else tiers.mid.push(x);
    });
    tiers.s.sort((a, b) => b.rate - a.rate); tiers.late.sort((a, b) => b.late - a.late); tiers.miss.sort((a, b) => b.miss - a.miss); tiers.note.sort((a, b) => b.miss - a.miss); tiers.mid.sort((a, b) => b.rate - a.rate);
    return { tiers, expected, start, end };
  }
  const GR = ['ALL', 'มัธยมศึกษาปีที่ 1', 'มัธยมศึกษาปีที่ 2', 'มัธยมศึกษาปีที่ 3', 'มัธยมศึกษาปีที่ 4', 'มัธยมศึกษาปีที่ 5', 'มัธยมศึกษาปีที่ 6'];
  const shortG = (g) => String(g || '').replace('มัธยมศึกษาปีที่ ', 'ม.');
  T.view = 'rank'; T.q = ''; T.limit = 50;
  function tierOf(score) { return score >= 90 ? ['S', '#15803d', '#dcfce7'] : score >= 75 ? ['A', '#1d4ed8', '#dbeafe'] : score >= 60 ? ['B', '#7c3aed', '#ede9fe'] : score >= 40 ? ['C', '#b45309', '#fef3c7'] : ['D', '#b91c1c', '#fee2e2']; }
  function ranked() {
    const { tiers, expected } = compute();
    const all = [].concat(tiers.s, tiers.late, tiers.miss, tiers.note, tiers.mid);
    all.forEach((x) => { const denom = Math.max(0, expected - x.excused); x.score = denom ? Math.min(100, Math.round((x.on + 0.5 * x.late) / denom * 1000) / 10) : 100; x.denom = denom; });
    all.sort((a, b) => b.score - a.score || b.on - a.on || a.miss - b.miss || a.late - b.late || String(a.s.fullName).localeCompare(String(b.s.fullName), 'th'));
    let rank = 0, prev = null;
    all.forEach((x, i) => { const key = x.score + '|' + x.on + '|' + x.miss + '|' + x.late; if (key !== prev) { rank = i + 1; prev = key; } x.rank = rank; });
    return { all, tiers, expected };
  }
  T.level = 'all';
  const LV = { good: ['ดีมาก', '#15803d', '#dcfce7'], mid: ['พอใช้', '#b45309', '#fef3c7'], low: ['ต้องติดตาม', '#b91c1c', '#fee2e2'] };
  const levelOf = (score) => score >= 80 ? 'good' : score >= 50 ? 'mid' : 'low';
  function tools(id) {
    return '<div class="k8-rk-tools"><div class="k8h-mini-seg" aria-label="ช่วงเวลา">' + [[7, '7 วัน'], [14, '14 วัน'], [30, '30 วัน']].map(([n, l]) => '<button type="button" aria-pressed="' + (T.days === n) + '" onclick="k8TierSet(\'days\',' + n + ')">' + l + '</button>').join('') + '</div>' +
      '<select onchange="k8TierSet(\'grade\', this.value)" aria-label="ระดับชั้น">' + GR.map((g) => '<option value="' + g + '"' + (g === T.grade ? ' selected' : '') + '>' + (g === 'ALL' ? 'ทุกระดับชั้น' : shortG(g)) + '</option>').join('') + '</select>' +
      (T.view === 'rank' ? '<input type="search" class="k8-rank-q" id="' + id + 'Q" placeholder="ค้นหาชื่อหรือรหัสนักเรียน" value="' + esc(T.q) + '" oninput="k8TierQ(this)" aria-label="ค้นหานักเรียน">' : '') +
      '<button type="button" class="k8-rk-switch" onclick="k8TierSet(\'view\',\'' + (T.view === 'rank' ? 'group' : 'rank') + '\')">' + (T.view === 'rank' ? 'ดูแบบแบ่งกลุ่ม' : 'ดูแบบจัดอันดับ') + '</button></div>';
  }
  function rankHtml(id) {
    const { all, expected } = ranked();
    if (!all.length) return tools(id) + '<p class="k8-tier-empty">ยังไม่มีข้อมูลนักเรียน</p>';
    const cnt = { good: 0, mid: 0, low: 0 }; all.forEach((x) => { x.level = levelOf(x.score); cnt[x.level]++; });
    const q = T.q.trim().toLowerCase();
    let list = all.filter((x) => T.level === 'all' || x.level === T.level);
    if (q) list = list.filter((x) => String(x.s.fullName || '').toLowerCase().includes(q) || norm(x.s.studentId).includes(q.replace(/^0+/, '')));
    const intro = '<div class="k8-rk-intro"><p>ช่วง <b>' + T.days + ' วันล่าสุด</b> นักเรียนแต่ละคนควรละหมาด <b>' + expected + ' เวลา</b> · เรียงจากคนที่ละหมาดตรงเวลามากที่สุด</p>' +
      '<div class="k8-rk-levels" role="group" aria-label="กรองตามระดับ">' +
      '<button type="button" aria-pressed="' + (T.level === 'all') + '" onclick="k8TierSet(\'level\',\'all\')"><b>' + all.length + '</b><span>ทั้งหมด</span></button>' +
      ['good', 'mid', 'low'].map((k) => '<button type="button" aria-pressed="' + (T.level === k) + '" style="--c:' + LV[k][1] + ';--bg:' + LV[k][2] + '" onclick="k8TierSet(\'level\',\'' + k + '\')"><b>' + cnt[k] + '</b><span>' + LV[k][0] + '</span><small>' + (k === 'good' ? '80% ขึ้นไป' : k === 'mid' ? '50–79%' : 'ต่ำกว่า 50%') + '</small></button>').join('') + '</div></div>';
    const legend = '<div class="k8-rk-legend"><span><i style="background:#16a34a"></i>ตรงเวลา</span><span><i style="background:#f59e0b"></i>สาย</span><span><i style="background:#60a5fa"></i>ลา/อุซุร</span><span><i style="background:#ef4444"></i>ขาด</span></div>';
    const shown = list.slice(0, T.limit);
    const pct = (n) => expected ? (n / expected * 100) : 0;
    const rows = shown.map((x) => { const lv = LV[x.level]; const done = x.on + x.late;
      return '<li class="k8-rk-row">' +
        (function () { const medal = x.rank <= 3 && x.score > 0; return '<span class="k8-rk-no' + (medal ? ' is-medal' : '') + '" aria-label="อันดับ ' + x.rank + '">' + (medal ? ['🥇', '🥈', '🥉'][x.rank - 1] : x.rank) + '</span>'; })() +
        '<span class="k8-rk-who"><b>' + esc(x.s.fullName) + '</b><small>' + esc(shortG(x.s.grade)) + ' · ' + esc(String(x.s.studentId || '')) + '</small></span>' +
        '<span class="k8-rk-bar" role="img" aria-label="ตรงเวลา ' + x.on + ' สาย ' + x.late + ' ลา ' + x.excused + ' ขาด ' + x.miss + ' จาก ' + expected + ' เวลา">' +
          '<span class="k8-rk-track"><i style="width:' + pct(x.on) + '%;background:#16a34a"></i><i style="width:' + pct(x.late) + '%;background:#f59e0b"></i><i style="width:' + pct(x.excused) + '%;background:#60a5fa"></i><i style="width:' + pct(x.miss) + '%;background:#ef4444"></i></span>' +
          '<span class="k8-rk-nums"><em class="ok">ตรงเวลา ' + x.on + '</em><em class="late">สาย ' + x.late + '</em>' + (x.excused ? '<em class="ex" title="' + esc(x.notes.slice(0, 3).join(' / ')) + '">ลา ' + x.excused + '</em>' : '') + '<em class="miss">ขาด ' + x.miss + '</em></span></span>' +
        '<span class="k8-rk-score"><b>' + Math.round(x.score) + '%</b><span style="color:' + lv[1] + ';background:' + lv[2] + '">' + lv[0] + '</span><small>ละหมาดแล้ว ' + done + '/' + expected + '</small></span></li>'; }).join('');
    return tools(id) + intro + legend +
      (list.length ? '<ol class="k8-rk-list">' + rows + '</ol>' : '<p class="k8-tier-empty">ไม่พบนักเรียน</p>') +
      (list.length > shown.length ? '<button type="button" class="k8-rank-more" onclick="k8TierSet(\'limit\',' + (T.limit + 50) + ')">แสดงเพิ่ม (' + (list.length - shown.length) + ' คน)</button>' : '') +
      '<p class="k8-rk-foot">คะแนน % คิดจากเวลาที่ละหมาดตรงเวลา (นับเต็ม) และมาสาย (นับครึ่ง) เทียบกับเวลาที่ต้องละหมาด โดยไม่นับเวลาที่ลาหรืออุซุร · คะแนนเท่ากันได้อันดับเดียวกัน</p>';
  }
  function groupHtml(id) {
    const { tiers } = compute();
    const DEF = [['s', '⭐ ตรงเวลาเป็นประจำ', 'ละหมาดตรงเวลาอย่างน้อย 80%', '#15803d', '#f0fdf4'], ['late', '⏰ มาละหมาดสายเป็นประจำ', 'สาย 3 ครั้งขึ้นไป และเกิน 30% ของที่ละหมาด', '#b45309', '#fffbeb'], ['miss', '⚠️ ขาดละหมาดบ่อย', 'ขาด 40% ขึ้นไป โดยไม่มีหมายเหตุ', '#b91c1c', '#fef2f2'], ['note', '📝 ขาด/ลา มีหมายเหตุ', 'อุซุร ลาป่วย หรือได้รับอนุมัติย้อนหลัง', '#1d4ed8', '#eff6ff'], ['mid', 'ปกติ', 'กลุ่มทั่วไป', '#475569', '#f8fafc']];
    return tools(id) + DEF.map(([k, title, desc, ink, bg]) => { const list = tiers[k]; const open = T.open[k] !== undefined ? T.open[k] : k !== 'mid';
      return '<section class="k8-tier" style="--ink:' + ink + ';--bg:' + bg + '"><button type="button" class="k8-tier-h" aria-expanded="' + open + '" onclick="k8TierSet(\'toggle\',\'' + k + '\')"><span><b>' + title + '</b><small>' + desc + '</small></span><span class="k8-tier-n">' + list.length + '</span></button>' +
        (open ? (list.length ? '<ul>' + list.map((x) => '<li><span class="k8-tier-name"><b>' + esc(x.s.fullName) + '</b><small>' + esc(shortG(x.s.grade)) + ' · ตรงเวลา ' + x.on + ' · สาย ' + x.late + ' · ขาด ' + x.miss + (x.excused ? ' · มีหมายเหตุ ' + x.excused : '') + '</small>' + (k === 'note' && x.notes.length ? '<em>' + esc(x.notes.slice(0, 3).join(' / ')) + '</em>' : '') + '</span><span class="k8-tier-rate">' + x.rate + '%</span></li>').join('') + '</ul>' : '<p class="k8-tier-empty">ไม่มีนักเรียนในกลุ่มนี้</p>') : '') + '</section>'; }).join('');
  }
  function render() {
    const targets = [['k8TierBody', document.getElementById('k8TierModal') && document.getElementById('k8TierModal').classList.contains('active')], ['k8RankAdmin', true]];
    targets.forEach(([id]) => { const el = document.getElementById(id); if (!el) return; el.innerHTML = T.view === 'group' ? groupHtml(id) : rankHtml(id); });
    const sub = document.getElementById('k8TierSub'); if (sub) sub.textContent = 'ย้อนหลัง ' + T.days + ' วัน · เห็นเฉพาะอาจารย์และแอดมิน';
  }
  window.k8TierSet = function (k, v) { if (k === 'toggle') { const cur = T.open[v] !== undefined ? T.open[v] : v !== 'mid'; T.open[v] = !cur; } else { T[k] = v; if (k !== 'limit') T.limit = 50; } render(); };
  let qT = null;
  window.k8TierQ = function (el) { const id = el.id, pos = el.selectionStart; T.q = el.value; T.limit = 50; clearTimeout(qT); qT = setTimeout(() => { render(); const n = document.getElementById(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }, 200); };
  window.k8TierOpen = function () { T.view = 'rank'; render(); openModal('k8TierModal'); };
  window.k8RankRender = render;
  if (typeof window.switchAdminTab === 'function') {
    const sat = window.switchAdminTab;
    window.switchAdminTab = function (tab) { const r = sat.apply(this, arguments); if (tab === 'prayer-rank') render(); return r; };
  }
})();

/* ============ Round 9 · Sub-admin UI + simple account creation (students / staff) ============ */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const me = () => { try { return currentAdmin || null; } catch (e) { return null; } };
  const isOwner = () => { const a = me(); return !!a && a.role === 'SuperAdmin' && !a.isSubAdmin; };
  function markRole() {
    const a = me();
    document.body.classList.toggle('k8-subadmin', !!(a && a.isSubAdmin));
    const sub = document.querySelector('.k8-nav-brand-sub');
    if (sub) sub.textContent = a && a.isSubAdmin ? 'แอดมินรอง · ' + (a.fullName || a.username) : 'ศูนย์ควบคุมแอดมิน';
  }
  const uv = window.updateAdminUIVisibility;
  if (typeof uv === 'function') window.updateAdminUIVisibility = function () { const r = uv.apply(this, arguments); try { markRole(); } catch (e) {} return r; };
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) { const r = sv.apply(this, arguments); try { markRole(); } catch (e) {} return r; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', markRole); else markRole();

  function showErr(id, msg) { const e = document.getElementById(id); if (!e) return; e.hidden = !msg; e.textContent = msg || ''; }

  // ---------- เพิ่มนักเรียน ----------
  let nsGrade = 'มัธยมศึกษาปีที่ 1';
  window.k8NsGrade = function (b) { nsGrade = b.dataset.g; document.querySelectorAll('#k8NsGrades button').forEach((x) => x.setAttribute('aria-pressed', x === b)); };
  window.openAdminAddStudentModal = function () {
    ['k8NsId', 'k8NsPhone', 'k8NsName', 'k8NsBirth', 'k8NsEmail'].forEach((id) => { const e = document.getElementById(id); if (e) { e.value = ''; e.classList.remove('is-bad'); } });
    const all = (typeof allStudents !== 'undefined' ? allStudents : []);
    const counts = {}; all.forEach((s) => { const n = s.schoolName || s.school; if (n) counts[n] = (counts[n] || 0) + 1; });
    const schools = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    document.getElementById('k8SchoolList').innerHTML = schools.map((n) => '<option value="' + esc(n) + '">').join('');
    document.getElementById('k8NsSchool').value = schools[0] || '';
    const gf = document.getElementById('filterGradeSelect'); nsGrade = (gf && gf.value) || 'มัธยมศึกษาปีที่ 1';
    document.querySelectorAll('#k8NsGrades button').forEach((x) => x.setAttribute('aria-pressed', x.dataset.g === nsGrade));
    showErr('k8NsErr', '');
    openModal('k8NewStudentModal');
    setTimeout(() => document.getElementById('k8NsId').focus(), 80);
  };
  window.openAdminEditStudentModal = function (id) { if (!id) return window.openAdminAddStudentModal(); return viewStudentDetails(id); };
  window.k8NsSave = async function () {
    const v = (id) => (document.getElementById(id).value || '').trim();
    const sid = (typeof cleanIdString === 'function' ? cleanIdString(v('k8NsId')) : v('k8NsId'));
    const phone = v('k8NsPhone').replace(/\D/g, ''), name = v('k8NsName'), birth = v('k8NsBirth'), email = v('k8NsEmail'), school = v('k8NsSchool');
    const bad = [];
    if (!sid) bad.push(['k8NsId', 'กรอกรหัสนักเรียน']);
    if (phone.length < 9 || phone.length > 10) bad.push(['k8NsPhone', 'เบอร์ผู้ปกครองต้องเป็นตัวเลข 9–10 หลัก']);
    if (!name) bad.push(['k8NsName', 'กรอกชื่อ-นามสกุล']);
    if (!birth) bad.push(['k8NsBirth', 'เลือกวันเกิด']);
    if (!school) bad.push(['k8NsSchool', 'กรอกชื่อโรงเรียน']);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad.push(['k8NsEmail', 'รูปแบบอีเมลไม่ถูกต้อง']);
    const all = (typeof allStudents !== 'undefined' ? allStudents : []);
    if (sid && all.some((s) => String(s.studentId).replace(/^0+/, '') === sid.replace(/^0+/, ''))) bad.push(['k8NsId', 'มีรหัสนักเรียนนี้ในระบบแล้ว']);
    document.querySelectorAll('#k8NsForm input').forEach((e) => e.classList.remove('is-bad'));
    if (bad.length) { bad.forEach(([id]) => document.getElementById(id).classList.add('is-bad')); showErr('k8NsErr', bad.map((b) => b[1]).join(' · ')); document.getElementById(bad[0][0]).focus(); return; }
    const [y, m, d] = birth.split('-');
    const payload = { createOnly: true, studentId: sid, fullName: name, grade: nsGrade, schoolName: school, school: school, parentPhone: phone, email: email, birthDate: d + m + (Number(y) + 543), status: 'Active', approvalStatus: 'Verified' };
    const btn = document.getElementById('k8NsSaveBtn'); btn.disabled = true; btn.textContent = 'กำลังสร้าง…';
    let r = null; try { r = await gasApiCall('registerStudent', payload); } catch (e) { r = { success: false, message: (typeof describeNetworkError === 'function' ? describeNetworkError(e) : 'เชื่อมต่อไม่สำเร็จ') }; }
    btn.disabled = false; btn.textContent = 'สร้างบัญชีนักเรียน';
    if (!r || !r.success) { if (r && r.field) document.getElementById('k8NsId').classList.add('is-bad'); showErr('k8NsErr', (r && r.message) || 'สร้างบัญชีไม่สำเร็จ'); return; }
    all.unshift({ studentId: sid, fullName: name, grade: nsGrade, schoolName: school, parentPhone: phone, email: email, birthDate: payload.birthDate, status: 'ปกติ (กำลังศึกษา)', approvalStatus: 'Verified', registeredAt: new Date().toISOString(), attendance: { present: 0, late: 0, leave: 0, absent: 0 }, subjectGrades: {}, skills: {}, gpa: '0.00' });
    try { localStorage.setItem('khalifah_all_students', JSON.stringify(all)); } catch (e) {}
    closeModal('k8NewStudentModal');
    try { renderAdminStudentsTable(); } catch (e) {}
    if (typeof showToast === 'function') showToast('สร้างบัญชี ' + name + ' แล้ว · เข้าสู่ระบบด้วยเบอร์ ' + phone + ' + รหัส ' + sid, 'success');
    try { if (typeof syncAllDataFromCloud === 'function') syncAllDataFromCloud(false); } catch (e) {}
  };

  // ---------- เพิ่มบุคลากร ----------
  const ROLES = [
    ['TEACHER', 'อาจารย์ผู้สอน', 'เช็คชื่อ กรอกคะแนนและเกรดวิชาที่สอน', false],
    ['TeacherAdmin', 'ครูประจำชั้น', 'เหมือนอาจารย์ + ดูสถิติห้องเรียน', false],
    ['EXECUTIVE', 'ผู้บริหาร', 'ดูสถิติภาพรวม รายงาน และผลประเมิน (เข้าทางแท็บแอดมิน ใช้รหัสผ่านอย่างเดียว)', false],
    ['ActivityAdmin', 'ฝ่ายกิจกรรม', 'สร้างกิจกรรมและเปิดสแกน QR', false],
    ['INSPECTOR', 'ผู้ตรวจการ', 'ตรวจเครื่องแต่งกาย หอพัก ห้องน้ำ ความประพฤติ · หัก/เพิ่มคะแนนพฤติกรรม (เข้าทางแท็บแอดมิน ใช้รหัสผ่านอย่างเดียว)', false],
    ['SubAdmin', 'แอดมินรอง', 'เข้าระบบแอดมินได้ ยกเว้นตั้งค่าระบบและจัดการแอดมิน (เข้าทางแท็บแอดมิน ใช้รหัสผ่านอย่างเดียว)', true]
  ];
  const PW_ONLY = ['EXECUTIVE', 'INSPECTOR', 'SubAdmin'];
  const pwOnly = () => PW_ONLY.indexOf(nfRole) !== -1;
  let nfRole = 'TEACHER'; const nfSubj = new Set();
  function drawRoles() {
    document.getElementById('k8NfRoles').innerHTML = ROLES.filter((r) => !r[3] || isOwner()).map(([k, t, d]) => '<button type="button" class="k8-role" aria-pressed="' + (nfRole === k) + '" onclick="k8NfRole(\'' + k + '\')"><b>' + t + '</b><small>' + d + '</small></button>').join('');
    const showSubj = nfRole === 'TEACHER' || nfRole === 'TeacherAdmin';
    document.getElementById('k8NfSubjWrap').hidden = !showSubj;
    const uw = document.getElementById('k8NfUser').closest('label'); if (uw) uw.hidden = pwOnly();
    const pi = document.getElementById('k8NfPass');
    if (pwOnly()) { if (pi.value.length < 8) window.k8NfGen(); pi.placeholder = 'อย่างน้อย 8 ตัว (กดสุ่มได้)'; } else pi.placeholder = 'อย่างน้อย 6 ตัว';
    const ph = pi.closest('label').querySelector('small'); if (ph) ph.textContent = pwOnly() ? 'บัญชีนี้เข้าระบบทางแท็บแอดมินด้วยรหัสผ่านนี้อย่างเดียว ไม่ต้องใช้ชื่อผู้ใช้' : 'แจ้งรหัสนี้ให้เจ้าของบัญชี';
  }
  function drawSubj() {
    let subs = []; try { subs = appSubjects || []; } catch (e) {}
    document.getElementById('k8NfSubjects').innerHTML = subs.map((x) => '<button type="button" aria-pressed="' + nfSubj.has(String(x.id)) + '" onclick="k8NfSubj(\'' + esc(x.id) + '\')">' + esc(x.name) + '</button>').join('') || '<small>ยังไม่มีรายวิชา เพิ่มได้ที่เมนู "รายวิชา"</small>';
  }
  window.k8NfRole = function (k) { nfRole = k; drawRoles(); };
  window.k8NfSubj = function (id) { id = String(id); if (nfSubj.has(id)) nfSubj.delete(id); else nfSubj.add(id); drawSubj(); };
  window.k8NfGen = function () { const c = 'abcdefghjkmnpqrstuvwxyz23456789'; let p = ''; const a = new Uint32Array(8); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.random() * 1e9; }); a.forEach((n) => { p += c[n % c.length]; }); document.getElementById('k8NfPass').value = p; };
  window.k8NewStaff = function () {
    nfRole = 'TEACHER'; nfSubj.clear();
    ['k8NfName', 'k8NfUser', 'k8NfPass', 'k8NfPhone', 'k8NfEmail'].forEach((id) => { const e = document.getElementById(id); e.value = ''; e.classList.remove('is-bad'); });
    const eb = document.getElementById('k8NfErr'); if (eb) eb.classList.remove('is-ok');
    const sb = document.getElementById('k8NfSaveBtn'); if (sb) { sb.onclick = () => window.k8NfSave(); sb.textContent = 'สร้างบัญชี'; }
    try { if (typeof loadAppSubjects === 'function') loadAppSubjects(); } catch (e) {}
    drawRoles(); drawSubj(); showErr('k8NfErr', ''); openModal('k8NewStaffModal');
    setTimeout(() => document.getElementById('k8NfName').focus(), 80);
  };
  window.k8NfSave = async function () {
    const v = (id) => (document.getElementById(id).value || '').trim();
    const name = v('k8NfName'), pass = v('k8NfPass'), phone = v('k8NfPhone').replace(/\D/g, ''), email = v('k8NfEmail');
    let user = v('k8NfUser');
    if (pwOnly()) { const pre = { EXECUTIVE: 'exec', INSPECTOR: 'insp', SubAdmin: 'sub' }[nfRole] || 'staff'; const c = 'abcdefghjkmnpqrstuvwxyz23456789'; let r = ''; for (let i = 0; i < 5; i++) r += c[Math.floor(Math.random() * c.length)]; user = pre + '-' + r; }
    const bad = [];
    if (!name) bad.push(['k8NfName', 'กรอกชื่อ-นามสกุล']);
    if (!pwOnly() && !/^[A-Za-z0-9._-]{3,30}$/.test(user)) bad.push(['k8NfUser', 'ชื่อผู้ใช้ 3–30 ตัว ใช้ a-z 0-9 . _ - เท่านั้น']);
    if (pass.length < (pwOnly() ? 8 : 6)) bad.push(['k8NfPass', 'รหัสผ่านอย่างน้อย ' + (pwOnly() ? 8 : 6) + ' ตัว']);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad.push(['k8NfEmail', 'รูปแบบอีเมลไม่ถูกต้อง']);
    let staff = []; try { staff = subAdmins || []; } catch (e) {}
    if (user && staff.some((x) => String(x.username || '').toLowerCase() === user.toLowerCase())) bad.push(['k8NfUser', 'ชื่อผู้ใช้นี้มีอยู่แล้ว']);
    document.querySelectorAll('#k8NewStaffModal input').forEach((e) => e.classList.remove('is-bad'));
    if (bad.length) { bad.forEach(([id]) => document.getElementById(id).classList.add('is-bad')); showErr('k8NfErr', bad.map((b) => b[1]).join(' · ')); document.getElementById(bad[0][0]).focus(); return; }
    const subjects = (nfRole === 'TEACHER' || nfRole === 'TeacherAdmin') ? Array.from(nfSubj) : [];
    let allSubs = []; try { allSubs = nfRole === 'INSPECTOR' ? [] : (appSubjects || []).map((x) => String(x.id)); } catch (e) {}
    const payload = { adminId: 'TCH-' + Date.now(), username: user, password: pass, fullName: name, email: email, phone: phone, role: nfRole, assignedSubjects: subjects.length ? subjects : allSubs, assignedSubject: (subjects[0] || allSubs[0] || ''), status: 'Active', approvalStatus: 'Verified', createdAt: new Date().toLocaleDateString('sv-SE') };
    const btn = document.getElementById('k8NfSaveBtn'); btn.disabled = true; btn.textContent = 'กำลังสร้าง…';
    let r = null; try { r = await gasApiCall('addSubAdmin', payload); } catch (e) { r = { success: false, message: (typeof describeNetworkError === 'function' ? describeNetworkError(e) : 'เชื่อมต่อไม่สำเร็จ') }; }
    btn.disabled = false; btn.textContent = 'สร้างบัญชี';
    if (!r || !r.success) { showErr('k8NfErr', (r && r.message) || 'สร้างบัญชีไม่สำเร็จ'); return; }
    const local = Object.assign({}, payload); delete local.password;
    try { staff.unshift(local); localStorage.setItem('khalifah_sub_admins', JSON.stringify(staff)); renderSubAdminsTable(); } catch (e) {}
    const roleName = (ROLES.find((x) => x[0] === nfRole) || [])[1] || 'บุคลากร';
    if (pwOnly()) {
      // แสดงรหัสผ่านให้แอดมินจดหรือคัดลอกก่อนปิด
      const box = document.getElementById('k8NfErr');
      box.hidden = false; box.classList.add('is-ok');
      box.innerHTML = 'สร้างบัญชี' + roleName + ' "' + esc(name) + '" แล้ว<br>เข้าระบบทางแท็บแอดมินด้วยรหัสผ่าน: <b class="k8-nf-pw">' + esc(pass) + '</b> <button type="button" class="k8-bh-link" onclick="navigator.clipboard&&navigator.clipboard.writeText(\'' + esc(pass) + '\').then(()=>showToast(\'คัดลอกรหัสผ่านแล้ว\',\'success\'))">คัดลอก</button>';
      try { box.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
      btn.textContent = 'ปิด'; btn.onclick = () => { box.classList.remove('is-ok'); btn.onclick = () => window.k8NfSave(); btn.textContent = 'สร้างบัญชี'; closeModal('k8NewStaffModal'); };
      try { if (typeof fetchSubAdminsFromCloud === 'function') fetchSubAdminsFromCloud(true); } catch (e) {}
      return;
    }
    closeModal('k8NewStaffModal');
    if (typeof showToast === 'function') showToast('สร้างบัญชี' + roleName + ' "' + name + '" แล้ว · ชื่อผู้ใช้ ' + user + (nfRole === 'SubAdmin' || nfRole === 'INSPECTOR' ? ' (เข้าทางแท็บแอดมิน)' : ' (เข้าทางแท็บอาจารย์)'), 'success');
    try { if (typeof fetchSubAdminsFromCloud === 'function') fetchSubAdminsFromCloud(true); } catch (e) {}
  };
  // ปุ่มในหน้า "อาจารย์ & ผู้บริหาร"
  function addStaffButton() {
    const head = document.querySelector('#admin-tab-subadmins > .k8-page-head');
    if (!head || head.querySelector('.k8-btn-pri')) return;
    head.classList.add('k8-page-head-row');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'k8-btn-pri'; b.textContent = '+ เพิ่มบัญชีบุคลากร'; b.onclick = window.k8NewStaff;
    head.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(addStaffButton, 0)); else setTimeout(addStaffButton, 0);
})();

/* ============ Round 10 · Toasts that never cover content ============ */
(function () {
  const ICON = {
    success: '<path d="m5 12 4 4 10-10"/>',
    error: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
    warning: '<path d="M12 3 2 20h20zM12 10v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'
  };
  const queue = []; let showing = null, timer = null, lastMsg = '', lastAt = 0;
  function container() {
    let c = document.getElementById('k8Toasts');
    if (!c) { c = document.createElement('div'); c.id = 'k8Toasts'; c.setAttribute('role', 'status'); c.setAttribute('aria-live', 'polite'); document.body.appendChild(c); }
    return c;
  }
  // วางเหนือแถบเมนูล่างที่มองเห็นอยู่ เพื่อไม่ให้บังหัวข้อหรือปุ่มเมนู
  function placeAbove(c) {
    let top = window.innerHeight;
    document.querySelectorAll('nav, [class*="bottom-nav"], [class*="bnav"]').forEach((n) => {
      const cs = getComputedStyle(n); if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = n.getBoundingClientRect(); if (r.height && r.bottom >= window.innerHeight - 48 && r.top > window.innerHeight * 0.6) top = Math.min(top, r.top);
    });
    document.querySelectorAll('.tg-save.is-dirty button').forEach((n) => { const r = n.getBoundingClientRect(); if (r.height && getComputedStyle(n).position === 'fixed' && r.top > window.innerHeight * 0.5) top = Math.min(top, r.top); });
    c.style.setProperty('--k8-toast-b', (window.innerHeight - top + 12) + 'px');
  }
  function next() {
    if (showing || !queue.length) return;
    const { msg, type } = queue.shift();
    const el = document.createElement('button'); el.type = 'button'; el.className = 'k8-toast is-' + type;
    el.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[type] || ICON.info) + '</svg><span></span>';
    el.querySelector('span').textContent = String(msg).replace(/<[^>]*>/g, '');
    el.setAttribute('aria-label', el.textContent + ' (แตะเพื่อปิด)');
    el.onclick = hide;
    let sx = null; el.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', (e) => { if (sx != null && Math.abs(e.changedTouches[0].clientX - sx) > 50) hide(); sx = null; }, { passive: true });
    const c = container(); placeAbove(c); c.appendChild(el); showing = el;
    requestAnimationFrame(() => el.classList.add('in'));
    const dur = Math.min(6000, 2200 + String(msg).length * 35) + (type === 'error' ? 1500 : 0);
    timer = setTimeout(hide, dur);
  }
  function hide() {
    // ปลดกล่องที่กำลังแสดงทันที กันการซ้อนกันจนมีแจ้งเตือนค้างบนจอ
    clearTimeout(timer); const el = showing; if (!el) return;
    showing = null;
    el.classList.remove('in'); el.classList.add('out');
    setTimeout(() => { el.remove(); next(); }, 200);
  }
  // กันพลาด: กล่องแจ้งเตือนที่ค้างเกิน 8 วินาทีจะถูกเก็บออก
  setInterval(() => { document.querySelectorAll('#k8Toasts .k8-toast').forEach((t) => { if (t !== showing) { if (!t.dataset.born) t.dataset.born = Date.now(); else if (Date.now() - t.dataset.born > 3000) t.remove(); } else if (!t.dataset.born) t.dataset.born = Date.now(); else if (Date.now() - t.dataset.born > 8000) hide(); }); }, 1000);
  window.showToast = function (message, type) {
    type = type || 'info';
    const msg = String(message == null ? '' : message);
    const now = Date.now();
    if (msg === lastMsg && now - lastAt < 2500) return; // กันแจ้งเตือนซ้ำ
    lastMsg = msg; lastAt = now;
    // ข้อความใหม่ที่สำคัญกว่าแทนที่ข้อความเดิมทันที, คิวไม่เกิน 2 ข้อความ
    if (showing && (type === 'error' || type === 'warning' || queue.length >= 2)) { queue.length = Math.min(queue.length, 1); queue.unshift({ msg, type }); hide(); return; }
    queue.push({ msg, type }); if (queue.length > 2) queue.splice(0, queue.length - 2);
    next();
  };
})();

/* ============ Round 10 · Remembered login · fast login · live update & sync · install guide ============ */
(function () {
  const APP_VERSION = '11.3';
  window.K8_APP_VERSION = APP_VERSION;
  const loggedIn = () => !!(window.getSessionToken && getSessionToken()) && !!(window.currentStudent || window.currentAdmin ||
    localStorage.getItem('khalifah_current_student') || localStorage.getItem('khalifah_current_admin'));
  const call = (a, p, t) => (typeof gasApiCall === 'function' ? gasApiCall(a, p || {}, t || 10000) : Promise.reject(new Error('no api')));
  const isBusy = () => !!(document.querySelector('.modal-overlay.active:not(#authModal)') ||
    (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)));

  /* ---- 1) จำการเข้าสู่ระบบ: ต่ออายุโทเค็นเงียบ ๆ (ออกจากระบบเฉพาะเมื่อเซิร์ฟเวอร์ปฏิเสธจริง หรือกดออกเอง) ---- */
  const REFRESH_KEY = 'khalifah_token_refreshed_at';
  function refreshToken(force) {
    if (!loggedIn() || !navigator.onLine) return;
    let last = 0; try { last = Number(localStorage.getItem(REFRESH_KEY) || 0); } catch (e) {}
    if (!force && Date.now() - last < 12 * 3600 * 1000) return;
    call('whoami', {}, 15000).then((r) => {
      if (r && r.success && r.token && typeof setSessionToken === 'function') {
        setSessionToken(r.token);
        try { localStorage.setItem(REFRESH_KEY, String(Date.now())); } catch (e) {}
      }
    }).catch(() => { /* เครือข่ายมีปัญหา: คงสถานะเข้าสู่ระบบไว้ ไม่ออกจากระบบ */ });
  }

  /* ---- 2) เข้าสู่ระบบไว: ปลุกเซิร์ฟเวอร์ล่วงหน้าตั้งแต่เปิดหน้าเข้าสู่ระบบ ---- */
  let lastWarm = 0;
  function warm() {
    if (!navigator.onLine || Date.now() - lastWarm < 90000) return;
    lastWarm = Date.now();
    call('ping', {}, 12000).then(onPing).catch(() => {});
  }
  document.addEventListener('focusin', (e) => {
    if (e.target && e.target.closest && e.target.closest('#authModal')) warm();
  });

  /* ---- 3) ข้อมูลสด: ตรวจเวอร์ชันข้อมูลเป็นระยะ ดึงใหม่เมื่อมีคนแก้ไข ---- */
  let dataVer = null, lastSyncAt = 0;
  function onPing(r) {
    if (!r || !r.dataVersion) return;
    const changed = dataVer && r.dataVersion !== dataVer;
    dataVer = r.dataVersion;
    if (changed && loggedIn()) { try { if (window.k8BehaviorReload) window.k8BehaviorReload(); } catch (e) {} try { if (window.k8NotifReload) window.k8NotifReload(); } catch (e) {} }
    if (changed && loggedIn() && typeof syncAllDataFromCloud === 'function' && Date.now() - lastSyncAt > 20000) {
      lastSyncAt = Date.now();
      Promise.resolve(syncAllDataFromCloud(false)).catch(() => {});
    }
  }
  function pollData() {
    if (document.hidden || !navigator.onLine || !loggedIn()) return;
    call('ping', {}, 12000).then(onPing).catch(() => {});
  }

  /* ---- 4) อัปเดตแอปทันทีเมื่อมีเวอร์ชันใหม่ ---- */
  let swReg = null, pendingReload = false;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then((r) => { swReg = r || null; }).catch(() => {});
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) { hadController = true; return; }
      scheduleReload();
    });
  }
  // อัปเดตแบบไม่รบกวน: โหลดใหม่ตอนผู้ใช้สลับออกจากแอป หรือเมื่อไม่ได้แตะหน้าจอสักพัก (ไม่โหลดใหม่ระหว่างกดเปลี่ยนหน้า)
  let lastTouch = Date.now();
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach((ev) => window.addEventListener(ev, () => { lastTouch = Date.now(); }, { passive: true, capture: true }));
  function scheduleReload() {
    if (pendingReload) return;
    pendingReload = true;
    const doReload = () => { try { sessionStorage.setItem('k8_just_updated', '1'); } catch (e) {} location.reload(); };
    if (document.hidden) return doReload();
    document.addEventListener('visibilitychange', () => { if (document.hidden) doReload(); });
    const idle = () => { if (Date.now() - lastTouch > 45000 && !isBusy()) doReload(); else setTimeout(idle, 5000); };
    setTimeout(idle, 5000);
  }
  try { if (sessionStorage.getItem('k8_just_updated')) { sessionStorage.removeItem('k8_just_updated'); setTimeout(() => showToast('อัปเดตแอปเป็นเวอร์ชันล่าสุดแล้ว', 'success'), 1500); } } catch (e) {}
  function checkVersion() {
    if (!navigator.onLine || pendingReload) return;
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((j) => {
      if (!j || !j.v || j.v === APP_VERSION) return;
      const reg = swReg;
      if (reg) reg.update().catch(() => {}).finally(() => setTimeout(() => { if (!pendingReload) scheduleReload(); }, 4000));
      else scheduleReload();
    }).catch(() => {});
  }

  /* ---- 5) สถานะการเชื่อมต่อ ---- */
  window.addEventListener('offline', () => showToast('ออฟไลน์อยู่ · ข้อมูลจะซิงค์อัตโนมัติเมื่อกลับมาออนไลน์', 'warning'));
  window.addEventListener('online', () => {
    showToast('กลับมาออนไลน์แล้ว · กำลังซิงค์ข้อมูล', 'success');
    if (loggedIn() && typeof syncAllDataFromCloud === 'function') { lastSyncAt = Date.now(); syncAllDataFromCloud(false); }
    refreshToken(false); checkVersion();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    checkVersion(); refreshToken(false); pollData();
    if (document.body.classList.contains('auth-locked')) warm();
  });
  setInterval(pollData, 45000);
  setInterval(checkVersion, 5 * 60000);

  /* ---- 6) คำแนะนำติดตั้ง PWA บนหน้าเข้าสู่ระบบ ---- */
  const ua = navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  let bip = null;
  window.addEventListener('beforeinstallprompt', (e) => { bip = e; renderInstall(); });
  window.addEventListener('appinstalled', () => { const c = document.getElementById('k8Install'); if (c) c.hidden = true; showToast('ติดตั้งแอปเรียบร้อยแล้ว', 'success'); });
  function renderInstall() {
    const c = document.getElementById('k8Install'); if (!c) return;
    let hidden = false; try { hidden = localStorage.getItem('khalifah_install_hint_hidden') === '1'; } catch (e) {}
    if (standalone() || hidden) { c.hidden = true; return; }
    const steps = document.getElementById('k8InstallSteps'), btn = document.getElementById('k8InstallBtn');
    const inApp = /line\/|fbav|fban|instagram/i.test(ua);
    if (bip || window.deferredPwaPrompt) { steps.hidden = true; btn.hidden = false; btn.textContent = 'ติดตั้ง'; }
    else {
      btn.hidden = false; btn.textContent = 'วิธีติดตั้ง';
      steps.innerHTML = inApp
        ? '<li>แตะเมนู ⋯ แล้วเลือก “เปิดในเบราว์เซอร์” (Safari / Chrome)</li><li>ทำตามขั้นตอนติดตั้งในเบราว์เซอร์</li>'
        : isIOS
          ? '<li>เปิดใน <b>Safari</b> แล้วแตะปุ่มแชร์ <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px"><path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg></li><li>เลือก <b>“เพิ่มไปยังหน้าจอโฮม”</b></li><li>แตะ <b>“เพิ่ม”</b> แล้วเปิดแอปจากไอคอน KHALIFAH</li>'
          : '<li>แตะเมนู ⋮ ของ Chrome</li><li>เลือก <b>“ติดตั้งแอป”</b> หรือ “เพิ่มไปยังหน้าจอหลัก”</li><li>เปิดแอปจากไอคอน KHALIFAH</li>';
    }
    c.hidden = false;
  }
  window.k8InstallNow = function () {
    const p = bip || window.deferredPwaPrompt;
    if (p && p.prompt) {
      p.prompt();
      Promise.resolve(p.userChoice).then((ch) => { if (ch && ch.outcome === 'accepted') { const c = document.getElementById('k8Install'); if (c) c.hidden = true; } });
      bip = null; window.deferredPwaPrompt = null; return;
    }
    const s = document.getElementById('k8InstallSteps'); if (s) s.hidden = !s.hidden;
  };
  window.k8InstallHide = function () {
    const c = document.getElementById('k8Install'); if (c) c.hidden = true;
    try { localStorage.setItem('khalifah_install_hint_hidden', '1'); } catch (e) {}
  };

  function start() {
    renderInstall();
    if (document.body.classList.contains('auth-locked')) warm();
    else { refreshToken(false); pollData(); }
    setTimeout(checkVersion, 4000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* ---- กันเบราว์เซอร์เติมรหัสผ่าน/ชื่อผู้ใช้ที่บันทึกไว้ลงในช่องค้นหา ---- */
(function () {
  function guard() {
    document.querySelectorAll('input[type="search"], input[placeholder*="ค้นหา"]').forEach((el) => {
      el.setAttribute('autocomplete', 'off'); el.setAttribute('data-lpignore', 'true'); el.setAttribute('data-1p-ignore', '');
      if (!el.name) el.name = 'q-' + (el.id || Math.random().toString(36).slice(2, 8));
      if (el.dataset.k8static && !el.dataset.k8typed) {
        if (el.value && document.activeElement !== el) el.value = '';
        if (!el.dataset.k8g) { el.dataset.k8g = '1'; el.addEventListener('keydown', () => { el.dataset.k8typed = '1'; }); }
      }
    });
  }
  function markStatic() { document.querySelectorAll('input[type="search"], input[placeholder*="ค้นหา"]').forEach((el) => { el.dataset.k8static = '1'; }); guard(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', markStatic); else markStatic();
  [800, 2500, 5000].forEach((t) => setTimeout(guard, t));
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function () { const r = sv.apply(this, arguments); setTimeout(guard, 300); setTimeout(guard, 1500); return r; };
})();

/* ---- เลิกซ่อนหน้าจอหลังแอปเตรียมหน้าของผู้ใช้เสร็จ ---- */
(function () {
  const done = () => setTimeout(() => document.documentElement.classList.remove('k8-restoring'), 60);
  if (document.readyState === 'complete') done(); else window.addEventListener('load', done);
})();

/* ---- บัญชีอาจารย์เข้าหน้าแอดมินไม่ได้ ไม่ว่าจะกดจากปุ่มไหน ---- */
(function () {
  const isAdminUser = () => { try { return !!currentAdmin && currentAdmin.role === 'SuperAdmin'; } catch (e) { return false; } };
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) {
    if (v === 'admin' && !isAdminUser()) {
      let staff = false; try { staff = !!currentAdmin; } catch (e) {}
      if (staff) { if (typeof showToast === 'function') showToast('หน้านี้สำหรับแอดมินเท่านั้น', 'warning'); return sv.call(this, 'teacher'); }
      return sv.call(this, 'dashboard');
    }
    return sv.apply(this, arguments);
  };
})();

/* ============ Round 11 · คะแนนพฤติกรรม (ผู้ตรวจการ / แอดมิน / นักเรียน) ============ */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const js = (v) => String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const norm = (id) => String(id == null ? '' : id).replace(/^0+/, '');
  const shortG = (g) => String(g || '').replace('มัธยมศึกษาปีที่ ', 'ม.');
  const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const fmtD = (s) => { const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? s : d.getDate() + ' ' + MON[d.getMonth()]; };
  const ICO = {
    dress: '<path d="M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3a4 4 0 0 1-8 0z"/>',
    dorm: '<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18h18M3 18v3M21 18v3M6 10V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4"/>',
    toilet: '<path d="M7 3h6v7H7zM5 10h14a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6zM9 16l-1 5h8l-1-5"/>',
    conduct: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    good: '<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/>'
  };
  const CATS = [['dress', 'เครื่องแต่งกาย', '#1d4ed8', '#eff6ff'], ['dorm', 'ความสะอาดหอพัก', '#7c3aed', '#f5f3ff'], ['toilet', 'ห้องน้ำ', '#0e7490', '#ecfeff'], ['conduct', 'ความประพฤติ', '#b45309', '#fffbeb'], ['good', 'ทำความดี (เพิ่มคะแนน)', '#15803d', '#f0fdf4']];
  const catOf = (k) => CATS.find((c) => c[0] === k) || CATS[3];
  const svg = (k, s) => '<svg width="' + (s || 20) + '" height="' + (s || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICO[k] || ICO.conduct) + '</svg>';
  // ใช้ภาคเรียนจากเซิร์ฟเวอร์เป็นหลัก (ตรงกับที่บันทึกในชีต) ถ้ายังไม่ได้โหลดใช้ค่าในเครื่อง
  let serverTerm = '';
  function term() { return serverTerm || window.k8Term().key; }
  const level = (sc) => sc >= 90 ? ['ดีมาก', '#15803d', '#dcfce7'] : sc >= 70 ? ['ปกติ', '#1d4ed8', '#dbeafe'] : sc >= 50 ? ['ต้องดูแล', '#b45309', '#fef3c7'] : ['ต้องติดตามใกล้ชิด', '#b91c1c', '#fee2e2'];
  const me = () => { try { return currentAdmin || null; } catch (e) { return null; } };
  const isInspector = () => { const a = me(); return !!a && /INSPECTOR|ผู้ตรวจการ/i.test(String(a.realRole || a.role || '')); };
  const isAdmin = () => { const a = me(); return !!a && a.role === 'SuperAdmin'; };
  const api = (a, p) => (typeof gasApiCall === 'function' ? gasApiCall(a, p || {}, 25000) : Promise.reject(new Error('no api')));
  const toast = (m, t) => { if (typeof showToast === 'function') showToast(m, t); };

  const B = { rules: [], logs: [], students: [], loaded: false, loading: false, tab: 'record', cat: 'dress', ruleId: '', sel: new Set(), q: '', grade: 'ALL', note: '', date: ymd(new Date()), custom: { title: '', points: -5 }, saving: false, hq: '', hRange: 'today', hMine: true, sq: '', sGrade: 'ALL', sLevel: 'all', editRules: null };

  function scoreMap() {
    const t = term(); const m = {};
    B.logs.forEach((l) => { if (!l || l.status === 'cancelled' || (l.term && l.term !== t)) return; const k = norm(l.studentId); m[k] = (m[k] || 0) + (Number(l.points) || 0); });
    return m;
  }
  const clamp = (n) => Math.max(0, Math.min(100, n));
  function students() { let list = B.students; if (!list || !list.length) { try { list = allStudents || []; } catch (e) { list = []; } } return list.filter((s) => s && s.studentId && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(s.status || ''))); }
  const GR = ['ALL', 'มัธยมศึกษาปีที่ 1', 'มัธยมศึกษาปีที่ 2', 'มัธยมศึกษาปีที่ 3', 'มัธยมศึกษาปีที่ 4', 'มัธยมศึกษาปีที่ 5', 'มัธยมศึกษาปีที่ 6'];
  const gradeSelect = (val, key) => '<select onchange="k8BhSet(\'' + key + '\', this.value)" aria-label="ระดับชั้น">' + GR.map((g) => '<option value="' + g + '"' + (g === val ? ' selected' : '') + '>' + (g === 'ALL' ? 'ทุกชั้น' : shortG(g)) + '</option>').join('') + '</select>';

  async function load(force) {
    if (B.loading || (B.loaded && !force)) return;
    B.loading = true;
    try {
      const r = await api('getBehaviorData');
      if (r && r.success) { if (r.term) serverTerm = r.term; B.rules = r.rules || []; B.logs = r.logs || []; if (r.students && r.students.length) B.students = r.students; B.loaded = true; try { localStorage.setItem('khalifah_behavior_cache', JSON.stringify({ rules: B.rules, logs: B.logs, students: B.students })); } catch (e) {} }
      else if (r && r.message) toast(r.message, 'error');
    } catch (e) {
      try { const c = JSON.parse(localStorage.getItem('khalifah_behavior_cache') || 'null'); if (c) { B.rules = c.rules || []; B.logs = c.logs || []; B.students = c.students || []; } } catch (er) {}
      toast('โหลดข้อมูลพฤติกรรมไม่สำเร็จ · แสดงข้อมูลล่าสุดในเครื่อง', 'warning');
    }
    B.loading = false; render();
  }

  function roots() { return ['k8BhInsp', 'k8BhAdmin'].map((id) => document.getElementById(id)).filter((el) => el && el.offsetParent !== null); }
  function render() {
    const keep = {}; ['.k8-bh-stu', '.k8-bh-list', '.k8-bh-hist'].forEach((sel) => { const el = document.querySelector(sel); if (el) keep[sel] = el.scrollTop; });
    const wy = window.scrollY;
    renderInner();
    Object.keys(keep).forEach((sel) => { const el = document.querySelector(sel); if (el) el.scrollTop = keep[sel]; });
    if (Math.abs(window.scrollY - wy) > 1) window.scrollTo(0, wy);
  }
  function renderInner() {
    roots().forEach((root) => {
      const admin = root.dataset.mode === 'admin';
      const tabs = admin ? [['record', 'บันทึก'], ['scores', 'คะแนนนักเรียน'], ['history', 'ประวัติ'], ['rules', 'ตั้งค่าหัวข้อ']] : null;
      if (!admin && B.tab === 'rules') B.tab = 'record';
      let html = admin ? '<div class="k8-bh-tabs" role="tablist">' + tabs.map(([k, l]) => '<button type="button" role="tab" aria-selected="' + (B.tab === k) + '" onclick="k8BhTab(\'' + k + '\')">' + l + '</button>').join('') + '</div>' : '';
      if (!B.loaded && B.loading) html += '<div class="k8-bh-card k8-bh-empty">กำลังโหลด…</div>';
      else html += B.tab === 'record' ? recordHtml() : B.tab === 'scores' ? scoresHtml() : B.tab === 'history' ? historyHtml(admin) : rulesHtml();
      root.innerHTML = html;
    });
    document.querySelectorAll('#k8InspNav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === B.tab));
  }

  function recordHtml() {
    const sm = scoreMap();
    const rules = B.rules.filter((r) => r.cat === B.cat);
    const custom = B.ruleId === '__custom';
    const rule = custom ? { title: B.custom.title, points: Number(B.custom.points) || 0, cat: B.cat } : B.rules.find((r) => r.id === B.ruleId);
    const q = B.q.trim().toLowerCase();
    const list = students().filter((s) => (B.grade === 'ALL' || s.grade === B.grade) && (!q || String(s.fullName || '').toLowerCase().includes(q) || norm(s.studentId).includes(q.replace(/^0+/, ''))))
      .sort((a, b) => String(a.grade).localeCompare(String(b.grade)) || String(a.fullName).localeCompare(String(b.fullName), 'th'));
    const selN = B.sel.size;
    let h = '<section class="k8-bh-card"><h2 class="k8-bh-h"><span class="k8-bh-step">1</span>เลือกหมวดที่ตรวจ</h2><div class="k8-bh-cats">' +
      CATS.map(([k, l, ink, bg]) => '<button type="button" aria-pressed="' + (B.cat === k) + '" style="--ink:' + ink + ';--bg:' + bg + '" onclick="k8BhSet(\'cat\',\'' + k + '\')">' + svg(k, 22) + '<span>' + l + '</span></button>').join('') + '</div></section>';
    h += '<section class="k8-bh-card"><h2 class="k8-bh-h"><span class="k8-bh-step">2</span>เลือกหัวข้อ</h2><div class="k8-bh-rules">' +
      rules.map((r) => '<button type="button" aria-pressed="' + (B.ruleId === r.id) + '" onclick="k8BhSet(\'ruleId\',\'' + js(r.id) + '\')"><span>' + esc(r.title) + '</span><b class="' + (r.points > 0 ? 'is-plus' : 'is-minus') + '">' + (r.points > 0 ? '+' : '') + r.points + '</b></button>').join('') +
      '<button type="button" class="k8-bh-other" aria-pressed="' + custom + '" onclick="k8BhSet(\'ruleId\',\'__custom\')"><span>อื่น ๆ (ระบุเอง)</span><b>✎</b></button></div>' +
      (custom ? '<div class="k8-bh-custom"><input type="text" maxlength="120" placeholder="ระบุสิ่งที่ตรวจพบ" value="' + esc(B.custom.title) + '" oninput="k8BhCustom(\'title\', this.value)"><label>คะแนน<input type="number" inputmode="numeric" min="-20" max="20" value="' + esc(B.custom.points) + '" oninput="k8BhCustom(\'points\', this.value)"></label><small>ติดลบ = หักคะแนน · บวก = เพิ่มคะแนน (ครั้งละไม่เกิน 20)</small></div>' : '') + '</section>';
    h += '<section class="k8-bh-card"><div class="k8-bh-h-row"><h2 class="k8-bh-h"><span class="k8-bh-step">3</span>เลือกนักเรียน</h2>' + (selN ? '<button type="button" class="k8-bh-link" onclick="k8BhClearSel()">ล้างที่เลือก (' + selN + ')</button>' : '') + '</div>' +
      '<div class="k8-bh-filter"><input type="search" id="k8BhQ" placeholder="ค้นหาชื่อหรือรหัส" value="' + esc(B.q) + '" oninput="k8BhQ(this)" autocomplete="off">' + gradeSelect(B.grade, 'grade') + '</div>' +
      (list.length ? '<button type="button" class="k8-bh-link k8-bh-all" onclick="k8BhSelAll()">' + (list.every((s) => B.sel.has(norm(s.studentId))) ? 'ยกเลิกเลือกทั้งหมดในรายการ' : 'เลือกทั้งหมดในรายการ (' + list.length + ' คน)') + '</button>' : '') +
      '<ul class="k8-bh-stu">' + (list.length ? list.slice(0, 200).map((s) => { const k = norm(s.studentId); const sc = clamp(100 + (sm[k] || 0)); const on = B.sel.has(k); const lv = level(sc);
        return '<li><button type="button" role="checkbox" aria-checked="' + on + '" onclick="k8BhToggle(\'' + js(k) + '\')"><span class="k8-bh-chk">' + (on ? '✓' : '') + '</span><span class="k8-bh-who"><b>' + esc(s.fullName) + '</b><small>' + esc(shortG(s.grade)) + ' · ' + esc(s.studentId) + '</small></span><span class="k8-bh-sc" style="color:' + lv[1] + ';background:' + lv[2] + '">' + sc + '</span></button></li>'; }).join('') : '<li class="k8-bh-empty">ไม่พบนักเรียน</li>') + '</ul></section>';
    const ready = rule && rule.title && rule.points && selN;
    h += '<section class="k8-bh-card"><h2 class="k8-bh-h"><span class="k8-bh-step">4</span>ยืนยันการบันทึก</h2>' +
      '<div class="k8-bh-confirm"><label>วันที่<input type="date" value="' + B.date + '" max="' + ymd(new Date()) + '" onchange="k8BhSet(\'date\', this.value)"></label><label>หมายเหตุ (ถ้ามี)<input type="text" maxlength="300" placeholder="เช่น ห้อง 204 ตรวจรอบเช้า" value="' + esc(B.note) + '" oninput="k8BhNote(this.value)"></label></div>' +
      '<p class="k8-bh-summary">' + (ready ? '<b class="' + (rule.points > 0 ? 'is-plus' : 'is-minus') + '">' + (rule.points > 0 ? 'เพิ่ม ' + rule.points : 'หัก ' + Math.abs(rule.points)) + ' คะแนน</b> · ' + esc(rule.title) + ' · นักเรียน ' + selN + ' คน' : 'เลือกหัวข้อและนักเรียนให้ครบก่อน') + '</p>' +
      '<button type="button" class="k8-bh-go ' + (rule && rule.points > 0 ? 'is-plus' : '') + '" ' + (ready && !B.saving ? '' : 'disabled') + ' onclick="k8BhSubmit()">' + (B.saving ? 'กำลังบันทึก…' : ready ? (rule.points > 0 ? 'เพิ่มคะแนน' : 'หักคะแนน') + ' ' + selN + ' คน' : 'บันทึก') + '</button></section>';
    return h;
  }

  function scoresHtml() {
    const sm = scoreMap();
    const q = B.sq.trim().toLowerCase();
    const all = students().filter((s) => B.sGrade === 'ALL' || s.grade === B.sGrade).map((s) => { const sc = clamp(100 + (sm[norm(s.studentId)] || 0)); return { s, sc, lv: level(sc) }; });
    const cnt = { all: all.length, good: 0, ok: 0, watch: 0 };
    all.forEach((x) => { if (x.sc >= 90) cnt.good++; else if (x.sc >= 70) cnt.ok++; else cnt.watch++; });
    let list = all.filter((x) => B.sLevel === 'all' || (B.sLevel === 'good' ? x.sc >= 90 : B.sLevel === 'ok' ? x.sc >= 70 && x.sc < 90 : x.sc < 70));
    if (q) list = list.filter((x) => String(x.s.fullName || '').toLowerCase().includes(q) || norm(x.s.studentId).includes(q.replace(/^0+/, '')));
    list.sort((a, b) => a.sc - b.sc || String(a.s.fullName).localeCompare(String(b.s.fullName), 'th'));
    const lvBtn = (k, n, l, sub, c, bg) => '<button type="button" aria-pressed="' + (B.sLevel === k) + '" style="--c:' + c + ';--bg:' + bg + '" onclick="k8BhSet(\'sLevel\',\'' + k + '\')"><b>' + n + '</b><span>' + l + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</button>';
    return '<section class="k8-bh-card"><p class="k8-bh-intro">คะแนนพฤติกรรมเริ่มที่ <b>100</b> ทุกภาคเรียน (' + window.k8Term().label + ') · เรียงจากคะแนนน้อยไปมาก เพื่อให้เห็นคนที่ต้องดูแลก่อน</p>' +
      '<div class="k8-rk-levels">' + lvBtn('all', cnt.all, 'ทั้งหมด', '', '#0f172a', '#f8fafc') + lvBtn('good', cnt.good, 'ดีมาก', '90–100', '#15803d', '#dcfce7') + lvBtn('ok', cnt.ok, 'ปกติ', '70–89', '#1d4ed8', '#dbeafe') + lvBtn('watch', cnt.watch, 'ต้องดูแล', 'ต่ำกว่า 70', '#b91c1c', '#fee2e2') + '</div>' +
      '<div class="k8-bh-filter"><input type="search" placeholder="ค้นหาชื่อหรือรหัส" value="' + esc(B.sq) + '" oninput="k8BhSQ(this)" id="k8BhSQ" autocomplete="off">' + gradeSelect(B.sGrade, 'sGrade') + '</div>' +
      '<ul class="k8-bh-list">' + (list.length ? list.slice(0, 300).map((x) => '<li><button type="button" onclick="k8BhOpen(\'' + js(norm(x.s.studentId)) + '\')"><span class="k8-bh-ring" style="--p:' + x.sc + ';--c:' + x.lv[1] + '"><b>' + x.sc + '</b></span><span class="k8-bh-who"><b>' + esc(x.s.fullName) + '</b><small>' + esc(shortG(x.s.grade)) + ' · ' + esc(x.s.studentId) + '</small></span><span class="k8-bh-lv" style="color:' + x.lv[1] + ';background:' + x.lv[2] + '">' + x.lv[0] + '</span></button></li>').join('') : '<li class="k8-bh-empty">ไม่พบนักเรียน</li>') + '</ul></section>';
  }

  function historyHtml(admin) {
    const a = me(); const uid = a ? String(a.username || a.adminId || '').toLowerCase() : '';
    const today = ymd(new Date()); const wk = new Date(); wk.setDate(wk.getDate() - 6); const wkS = ymd(wk);
    const q = B.hq.trim().toLowerCase();
    let list = B.logs.slice().filter((l) => B.hRange === 'today' ? l.date === today : B.hRange === 'week' ? l.date >= wkS : l.term === term());
    if (!admin || B.hMine) list = list.filter((l) => !admin || String(l.by || '').toLowerCase() === uid);
    if (q) list = list.filter((l) => String(l.studentName || '').toLowerCase().includes(q) || String(l.title || '').toLowerCase().includes(q) || norm(l.studentId).includes(q.replace(/^0+/, '')));
    list.sort((x, y) => String(y.time || y.date).localeCompare(String(x.time || x.date)));
    const minus = list.filter((l) => l.status !== 'cancelled' && l.points < 0).length, plus = list.filter((l) => l.status !== 'cancelled' && l.points > 0).length;
    return '<section class="k8-bh-card"><div class="k8-bh-filter"><div class="k8h-mini-seg">' + [['today', 'วันนี้'], ['week', '7 วัน'], ['term', 'ภาคเรียนนี้']].map(([k, l]) => '<button type="button" aria-pressed="' + (B.hRange === k) + '" onclick="k8BhSet(\'hRange\',\'' + k + '\')">' + l + '</button>').join('') + '</div>' +
      (admin ? '<div class="k8h-mini-seg">' + [[true, 'ของฉัน'], [false, 'ทุกคน']].map(([k, l]) => '<button type="button" aria-pressed="' + (B.hMine === k) + '" onclick="k8BhSet(\'hMine\',' + k + ')">' + l + '</button>').join('') + '</div>' : '') +
      '<input type="search" placeholder="ค้นหาชื่อนักเรียนหรือหัวข้อ" value="' + esc(B.hq) + '" oninput="k8BhHQ(this)" id="k8BhHQ" autocomplete="off"></div>' +
      '<p class="k8-bh-intro">' + list.length + ' รายการ · หักคะแนน ' + minus + ' · เพิ่มคะแนน ' + plus + (admin ? '' : ' · ยกเลิกรายการที่บันทึกผิดได้') + '</p>' +
      '<ul class="k8-bh-hist">' + (list.length ? list.slice(0, 300).map((l) => { const c = catOf(l.cat); const own = String(l.by || '').toLowerCase() === uid; const can = l.status !== 'cancelled' && (own || isAdmin());
        return '<li class="' + (l.status === 'cancelled' ? 'is-cancel' : '') + '"><span class="k8-bh-hico" style="color:' + c[2] + ';background:' + c[3] + '">' + svg(l.cat, 18) + '</span><span class="k8-bh-who"><b>' + esc(l.studentName || l.studentId) + ' <small>' + esc(shortG(l.grade)) + '</small></b><small>' + esc(l.title) + (l.note ? ' · ' + esc(l.note) : '') + '</small><small class="k8-bh-meta">' + fmtD(l.date) + ' ' + esc(String(l.time || '').slice(11, 16)) + ' · ' + esc(l.byName || l.by) + (l.status === 'cancelled' ? ' · ยกเลิกแล้ว' : '') + '</small></span><span class="k8-bh-pts ' + (l.points > 0 ? 'is-plus' : 'is-minus') + '">' + (l.points > 0 ? '+' : '') + l.points + '</span>' + (can ? '<button type="button" class="k8-bh-undo" onclick="k8BhCancel(\'' + js(l.id) + '\')" aria-label="ยกเลิกรายการนี้">ยกเลิก</button>' : '') + '</li>'; }).join('') : '<li class="k8-bh-empty">ยังไม่มีรายการในช่วงนี้</li>') + '</ul></section>';
  }

  function rulesHtml() {
    if (!B.editRules) B.editRules = B.rules.map((r) => Object.assign({}, r));
    return '<section class="k8-bh-card"><p class="k8-bh-intro">ตั้งหัวข้อที่ผู้ตรวจการใช้ และกำหนดว่าแต่ละข้อหักหรือเพิ่มกี่คะแนน (1–50) · หมวด "ทำความดี" เป็นการเพิ่มคะแนน หมวดอื่นเป็นการหักคะแนน</p>' +
      CATS.map(([k, l, ink, bg]) => { const rows = B.editRules.map((r, i) => [r, i]).filter(([r]) => r.cat === k);
        return '<div class="k8-bh-rcat"><h3 style="color:' + ink + '">' + svg(k, 18) + ' ' + l + '</h3>' + rows.map(([r, i]) => '<div class="k8-bh-rrow"><input type="text" maxlength="120" value="' + esc(r.title) + '" oninput="k8BhRule(' + i + ',\'title\',this.value)" aria-label="หัวข้อ"><span class="k8-bh-rpts ' + (k === 'good' ? 'is-plus' : 'is-minus') + '">' + (k === 'good' ? '+' : '−') + '<input type="number" min="1" max="50" value="' + Math.abs(Number(r.points) || 0) + '" oninput="k8BhRule(' + i + ',\'points\',this.value)" aria-label="คะแนน"></span><button type="button" class="k8-bh-rdel" onclick="k8BhRuleDel(' + i + ')" aria-label="ลบหัวข้อ">✕</button></div>').join('') +
          '<button type="button" class="k8-bh-link" onclick="k8BhRuleAdd(\'' + k + '\')">+ เพิ่มหัวข้อ</button></div>'; }).join('') +
      '<button type="button" class="k8-bh-go" onclick="k8BhRulesSave()">บันทึกหัวข้อทั้งหมด</button></section>';
  }

  function openStudent(k) {
    const s = students().find((x) => norm(x.studentId) === k) || { fullName: k, studentId: k };
    const t = term();
    const logs = B.logs.filter((l) => norm(l.studentId) === k && (!l.term || l.term === t)).sort((x, y) => String(y.time || y.date).localeCompare(String(x.time || x.date)));
    const sc = clamp(100 + logs.filter((l) => l.status !== 'cancelled').reduce((a, l) => a + (Number(l.points) || 0), 0));
    document.getElementById('k8BhModalTitle').textContent = s.fullName || k;
    document.getElementById('k8BhModalSub').textContent = shortG(s.grade) + ' · ' + (s.studentId || k) + ' · ' + window.k8Term().label;
    document.getElementById('k8BhModalBody').innerHTML = detailHtml(sc, logs) + (me() ? '<button type="button" class="k8-bh-go" onclick="k8BhRecordFor(\'' + js(k) + '\')">บันทึกพฤติกรรมให้คนนี้</button>' : '');
    openModal('k8BhModal');
  }
  function detailHtml(sc, logs) {
    const lv = level(sc); const act = logs.filter((l) => l.status !== 'cancelled');
    const minus = act.filter((l) => l.points < 0).reduce((a, l) => a + l.points, 0), plus = act.filter((l) => l.points > 0).reduce((a, l) => a + l.points, 0);
    return '<div class="k8-bh-hero"><span class="k8-bh-ring is-big" style="--p:' + sc + ';--c:' + lv[1] + '"><b>' + sc + '</b><small>/100</small></span><div><span class="k8-bh-lv" style="color:' + lv[1] + ';background:' + lv[2] + '">' + lv[0] + '</span><p>เริ่มต้น 100 · ถูกหัก <b class="is-minus">' + Math.abs(minus) + '</b> · ได้เพิ่ม <b class="is-plus">' + plus + '</b></p></div></div>' +
      '<ul class="k8-bh-hist">' + (logs.length ? logs.map((l) => { const c = catOf(l.cat); return '<li class="' + (l.status === 'cancelled' ? 'is-cancel' : '') + '"><span class="k8-bh-hico" style="color:' + c[2] + ';background:' + c[3] + '">' + svg(l.cat, 18) + '</span><span class="k8-bh-who"><b>' + esc(l.title) + '</b><small>' + fmtD(l.date) + ' · ' + esc(c[1]) + (l.note ? ' · ' + esc(l.note) : '') + (l.status === 'cancelled' ? ' · ยกเลิกแล้ว' : '') + '</small></span><span class="k8-bh-pts ' + (l.points > 0 ? 'is-plus' : 'is-minus') + '">' + (l.points > 0 ? '+' : '') + l.points + '</span></li>'; }).join('') : '<li class="k8-bh-empty">ยังไม่มีบันทึกในภาคเรียนนี้ · รักษาคะแนนเต็มไว้นะ</li>') + '</ul>';
  }

  // ---------- actions ----------
  window.k8BhTab = function (t) { B.tab = t; if (t !== 'rules') B.editRules = null; render(); try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) {} };
  window.k8BhSet = function (k, v) { B[k] = v; if (k === 'cat') B.ruleId = ''; render(); };
  window.k8BhCustom = function (k, v) { B.custom[k] = v; const sum = document.querySelector('.k8-bh-summary'); if (sum) { render(); const el = document.querySelector('.k8-bh-custom ' + (k === 'title' ? 'input[type=text]' : 'input[type=number]')); if (el) { el.focus(); try { const n = el.value.length; el.setSelectionRange && el.type === 'text' && el.setSelectionRange(n, n); } catch (e) {} } } };
  window.k8BhNote = function (v) { B.note = v; };
  function refocus(id, el) { const pos = el.selectionStart; render(); const n = document.getElementById(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }
  let qt = null;
  window.k8BhQ = function (el) { B.q = el.value; clearTimeout(qt); qt = setTimeout(() => refocus('k8BhQ', el), 150); };
  window.k8BhSQ = function (el) { B.sq = el.value; clearTimeout(qt); qt = setTimeout(() => refocus('k8BhSQ', el), 150); };
  window.k8BhHQ = function (el) { B.hq = el.value; clearTimeout(qt); qt = setTimeout(() => refocus('k8BhHQ', el), 150); };
  window.k8BhToggle = function (k) { if (B.sel.has(k)) B.sel.delete(k); else B.sel.add(k); render(); };
  window.k8BhClearSel = function () { B.sel.clear(); render(); };
  window.k8BhSelAll = function () {
    const q = B.q.trim().toLowerCase();
    const list = students().filter((s) => (B.grade === 'ALL' || s.grade === B.grade) && (!q || String(s.fullName || '').toLowerCase().includes(q) || norm(s.studentId).includes(q.replace(/^0+/, ''))));
    const allOn = list.every((s) => B.sel.has(norm(s.studentId)));
    list.forEach((s) => { if (allOn) B.sel.delete(norm(s.studentId)); else B.sel.add(norm(s.studentId)); });
    render();
  };
  window.k8BhSubmit = async function () {
    const custom = B.ruleId === '__custom';
    const rule = custom ? null : B.rules.find((r) => r.id === B.ruleId);
    if (!B.sel.size || (!rule && !(custom && B.custom.title && Number(B.custom.points)))) return;
    const ids = students().filter((s) => B.sel.has(norm(s.studentId))).map((s) => s.studentId);
    B.saving = true; render();
    try {
      const payload = { studentIds: ids, note: B.note, date: B.date };
      if (custom) { payload.title = B.custom.title; payload.points = Number(B.custom.points); } else payload.ruleId = rule.id;
      const r = await api('addBehaviorLogs', { data: payload });
      if (!r || !r.success) throw new Error((r && r.message) || 'บันทึกไม่สำเร็จ');
      B.logs = B.logs.concat(r.logs || []);
      B.sel.clear(); B.note = '';
      toast('บันทึกแล้ว · ' + r.message, 'success');
    } catch (e) { toast(e.message || 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 'error'); }
    B.saving = false; render();
  };
  window.k8BhCancel = async function (id) {
    const l = B.logs.find((x) => x.id === id); if (!l) return;
    if (!window.confirm('ยกเลิกรายการ "' + l.title + '" ของ ' + (l.studentName || l.studentId) + ' ?\nคะแนนจะถูกคืนให้นักเรียน')) return;
    try {
      const r = await api('cancelBehaviorLog', { data: { logId: id } });
      if (!r || !r.success) throw new Error((r && r.message) || 'ยกเลิกไม่สำเร็จ');
      l.status = 'cancelled'; toast(r.message, 'success'); render();
    } catch (e) { toast(e.message, 'error'); }
  };
  window.k8BhOpen = openStudent;
  window.k8BhRecordFor = function (k) { closeModal('k8BhModal'); B.sel = new Set([k]); B.tab = 'record'; render(); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} };
  window.k8BhRule = function (i, k, v) { const r = B.editRules[i]; if (!r) return; if (k === 'points') { const n = Math.max(1, Math.min(50, Math.abs(parseInt(v, 10) || 0))); r.points = r.cat === 'good' ? n : -n; } else r.title = v; };
  window.k8BhRuleAdd = function (cat) { B.editRules.push({ id: '', cat, title: '', points: cat === 'good' ? 3 : -5 }); render(); const ins = document.querySelectorAll('.k8-bh-rrow input[type=text]'); const last = Array.from(ins).filter((x) => !x.value).pop(); if (last) last.focus(); };
  window.k8BhRuleDel = function (i) { B.editRules.splice(i, 1); render(); };
  window.k8BhRulesSave = async function () {
    const rules = B.editRules.filter((r) => String(r.title || '').trim());
    try {
      const r = await api('saveBehaviorRules', { data: { rules } });
      if (!r || !r.success) throw new Error((r && r.message) || 'บันทึกไม่สำเร็จ');
      B.rules = r.rules; B.editRules = null; toast(r.message, 'success'); render();
    } catch (e) { toast(e.message, 'error'); }
  };

  // ---------- นักเรียน: กล่องคะแนนพฤติกรรมหน้าแรก ----------
  let mine = null;
  try { mine = JSON.parse(localStorage.getItem('khalifah_behavior_me') || 'null'); } catch (e) {}
  const curSid = () => { try { return currentStudent ? norm(currentStudent.studentId) : ''; } catch (e) { return ''; } };
  const mineOk = () => !!mine && (!mine.sid || mine.sid === curSid());
  function myScore() { if (!mineOk()) return null; const t = mine.term || term(); return clamp(100 + (mine.logs || []).filter((l) => l.status !== 'cancelled' && (!l.term || l.term === t)).reduce((a, l) => a + (Number(l.points) || 0), 0)); }
  function paintMine() {
    const el = document.getElementById('hfBehScore'); if (!el) return;
    const sc = myScore();
    if (sc == null) { el.textContent = '…'; const sub0 = document.getElementById('hfBehSub'); if (sub0) sub0.textContent = 'กำลังโหลดคะแนนล่าสุด'; const lv0 = document.getElementById('hfBehLv'); if (lv0) lv0.textContent = ''; return; }
    const lv = level(sc);
    el.textContent = sc;
    const box = document.getElementById('hfBeh'); if (box) box.setAttribute('aria-label', 'คะแนนพฤติกรรม ' + sc + ' จาก 100 · ' + lv[0]);
    const ring = document.getElementById('hfBehRing'); if (ring) { ring.style.setProperty('--p', sc); ring.style.setProperty('--c', lv[1]); }
    const lvEl = document.getElementById('hfBehLv'); if (lvEl) { lvEl.textContent = lv[0]; lvEl.style.color = lv[1]; lvEl.style.background = lv[2]; }
    const t = (mine && mine.term) || term(); const act = ((mine && mine.logs) || []).filter((l) => l.status !== 'cancelled' && (!l.term || l.term === t));
    const minus = act.filter((l) => l.points < 0).reduce((a, l) => a + l.points, 0), plus = act.filter((l) => l.points > 0).reduce((a, l) => a + l.points, 0);
    const sub = document.getElementById('hfBehSub'); if (sub) sub.textContent = act.length ? 'ถูกหัก ' + Math.abs(minus) + ' · ได้เพิ่ม ' + plus + ' · ภาคเรียนนี้' : 'เต็ม 100 · ยังไม่มีการหักคะแนนภาคเรียนนี้';
  }
  let mineAt = 0;
  async function loadMine(force) {
    let st = null; try { st = currentStudent; } catch (e) {}
    if (!st || (!force && Date.now() - mineAt < 15000)) { paintMine(); return; }
    mineAt = Date.now();
    try { const r = await api('getMyBehavior'); if (r && r.success) { if (r.term) serverTerm = r.term; mine = { logs: r.logs || [], term: r.term, sid: curSid() }; try { localStorage.setItem('khalifah_behavior_me', JSON.stringify(mine)); } catch (e) {} } } catch (e) {}
    paintMine();
  }
  window.k8BehOpenMine = function () {
    let st = null; try { st = currentStudent; } catch (e) {}
    const t = (mine && mine.term) || term();
    const logs = ((mine && mine.logs) || []).filter((l) => !l.term || l.term === t).sort((x, y) => String(y.time || y.date).localeCompare(String(x.time || x.date)));
    document.getElementById('k8BhModalTitle').textContent = 'คะแนนพฤติกรรมของฉัน';
    document.getElementById('k8BhModalSub').textContent = window.k8Term().label + ' · เริ่มต้น 100 คะแนน';
    document.getElementById('k8BhModalBody').innerHTML = detailHtml(myScore() == null ? 100 : myScore(), logs) + '<p class="k8-bh-intro">คะแนนจะถูกหักเมื่อแต่งกายผิดระเบียบ ไม่รักษาความสะอาดหอพัก/ห้องน้ำ หรือประพฤติไม่เหมาะสม และได้เพิ่มเมื่อทำความดี มีวินัย</p>';
    openModal('k8BhModal');
    if (st) loadMine(true).then(() => { if (document.getElementById('k8BhModal').classList.contains('open')) { const t2 = (mine && mine.term) || term(); const l2 = ((mine && mine.logs) || []).filter((l) => !l.term || l.term === t2).sort((x, y) => String(y.time || y.date).localeCompare(String(x.time || x.date))); document.getElementById('k8BhModalBody').innerHTML = detailHtml(myScore() == null ? 100 : myScore(), l2) + '<p class="k8-bh-intro">คะแนนจะถูกหักเมื่อแต่งกายผิดระเบียบ ไม่รักษาความสะอาดหอพัก/ห้องน้ำ หรือประพฤติไม่เหมาะสม และได้เพิ่มเมื่อทำความดี มีวินัย</p>'; } });
  };

  // ---------- บัญชีผู้ตรวจการ: ล็อกไว้ที่หน้าผู้ตรวจการเท่านั้น ----------
  function paintHead() {
    const a = me(); if (!a) return;
    const n = document.getElementById('k8InspName'); if (n) n.textContent = a.fullName || a.username || 'ผู้ตรวจการ';
    const av = document.getElementById('k8InspAvatar'); if (av) av.textContent = String(a.fullName || a.username || 'ต').trim().charAt(0);
    const d = new Date(); const dt = document.getElementById('k8InspDate'); if (dt) dt.textContent = 'ผู้ตรวจการ · ' + DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()];
  }
  function markRole() { document.body.classList.toggle('k8-inspector', isInspector()); if (isInspector()) document.body.classList.remove('portal-mode-teacher', 'teacher-portal-active'); }
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) {
    if (isInspector() && v !== 'inspector') v = 'inspector';
    const r = sv.call(this, v);
    markRole();
    if (v === 'inspector') { paintHead(); render(); load(false); }
    if (v === 'dashboard') loadMine(false);
    return r;
  };
  const uav = window.updateAdminUIVisibility;
  if (typeof uav === 'function') window.updateAdminUIVisibility = function () { const r = uav.apply(this, arguments); markRole(); return r; };
  if (typeof window.switchAdminTab === 'function') {
    const sat = window.switchAdminTab;
    window.switchAdminTab = function (tab) { const r = sat.apply(this, arguments); if (tab === 'behavior') { if (B.tab === 'rules') B.editRules = null; render(); load(true); } return r; };
  }
  function boot() {
    markRole();
    if (isInspector()) { try { window.switchView('inspector'); } catch (e) {} }
    else { let st = null; try { st = currentStudent; } catch (e) {} if (st) loadMine(true); else paintMine(); }
  }
  if (document.readyState === 'complete') setTimeout(boot, 0); else window.addEventListener('load', () => setTimeout(boot, 0));
  // ข้อมูลสด: เมื่อมีการเปลี่ยนแปลงจากเครื่องอื่น ให้โหลดใหม่ตอนเปิดหน้าอีกครั้ง
  document.addEventListener('visibilitychange', () => { if (document.hidden) return; if (isInspector()) load(true); else loadMine(false); });
  // แสดงคะแนนล่าสุดที่จำไว้ในเครื่องทันทีตอนเปิดแอป แล้วค่อยอัปเดตจากเซิร์ฟเวอร์
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(paintMine, 0)); else paintMine();
  window.k8BehaviorReload = function () { if (isInspector() || (document.getElementById('k8BhAdmin') && document.getElementById('k8BhAdmin').offsetParent)) load(true); loadMine(true); };
  document.addEventListener('k8-term-changed', () => { paintMine(); render(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadMine(true); });
})();

/* ============ Round 12 · จัดการภาคเรียน / ปีการศึกษา (แอดมิน) ============ */
(function () {
  const T = { mode: 'auto', term: 1, year: 2569, saving: false };
  function sync() { const c = window.k8TermSetting; const cur = window.k8Term(); T.mode = c && c.mode === 'manual' ? 'manual' : 'auto'; T.term = cur.term; T.year = cur.year; }
  const nameOf = (t) => t === 3 ? 'ภาคฤดูร้อน' : 'ภาคเรียนที่ ' + t;
  function autoNow() { const d = new Date(); const m = d.getMonth() + 1; const by = d.getFullYear() + 543; return { term: (m >= 5 && m <= 10) ? 1 : 2, year: m >= 5 ? by : by - 1 }; }
  function render() {
    const root = document.getElementById('k8TermAdmin'); if (!root) return;
    const cur = window.k8Term(); const a = autoNow();
    const pick = T.mode === 'manual' ? { term: T.term, year: T.year } : a;
    const changed = pick.term + '/' + pick.year !== cur.key;
    const c = window.k8TermSetting;
    root.innerHTML =
      '<section class="k8-term-now"><span>ตอนนี้ระบบใช้</span><b>' + cur.label + '</b><small>' + (cur.manual ? 'กำหนดเองโดยแอดมิน' : 'อัตโนมัติตามวันที่') + (c && c.updatedAt ? ' · อัปเดต ' + c.updatedAt : '') + '</small></section>' +
      '<section class="k8-bh-card"><h2 class="k8-bh-h">วิธีกำหนดภาคเรียน</h2>' +
      '<div class="k8-term-modes">' +
        '<button type="button" aria-pressed="' + (T.mode === 'auto') + '" onclick="k8TermSet(\'mode\',\'auto\')"><b>อัตโนมัติตามวันที่</b><small>พ.ค.–ต.ค. = เทอม 1 · พ.ย.–เม.ย. = เทอม 2 · ตอนนี้คือ ' + nameOf(a.term) + '/' + a.year + '</small></button>' +
        '<button type="button" aria-pressed="' + (T.mode === 'manual') + '" onclick="k8TermSet(\'mode\',\'manual\')"><b>กำหนดเอง</b><small>เลือกภาคเรียนและปีการศึกษาเอง เช่น เปิดเทอมเร็ว/ช้ากว่าปกติ หรือภาคฤดูร้อน</small></button>' +
      '</div>' +
      (T.mode === 'manual' ?
        '<div class="k8-term-pick"><span class="k8-term-lbl">ภาคเรียน</span><div class="k8-term-chips">' + [1, 2, 3].map((t) => '<button type="button" aria-pressed="' + (T.term === t) + '" onclick="k8TermSet(\'term\',' + t + ')">' + nameOf(t) + '</button>').join('') + '</div>' +
        '<span class="k8-term-lbl">ปีการศึกษา (พ.ศ.)</span><div class="k8-term-year"><button type="button" aria-label="ปีก่อนหน้า" onclick="k8TermSet(\'year\',' + (T.year - 1) + ')">‹</button><b>' + T.year + '</b><button type="button" aria-label="ปีถัดไป" onclick="k8TermSet(\'year\',' + (T.year + 1) + ')">›</button></div>' +
        '<button type="button" class="k8-bh-link" onclick="k8TermNext()">เลื่อนไปภาคเรียนถัดไป →</button></div>' : '') +
      '<div class="k8-term-preview' + (changed ? ' is-change' : '') + '">' + (changed ? 'เมื่อบันทึก ระบบจะเปลี่ยนจาก <b>' + cur.label + '</b> เป็น <b>' + nameOf(pick.term) + '/' + pick.year + '</b>' : 'ค่าที่เลือกตรงกับที่ระบบใช้อยู่แล้ว') + '</div>' +
      '<button type="button" class="k8-bh-go k8-term-save" ' + (T.saving ? 'disabled' : '') + ' onclick="k8TermSave()">' + (T.saving ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า') + '</button></section>' +
      '<section class="k8-bh-card"><h2 class="k8-bh-h">ค่านี้มีผลกับ</h2><ul class="k8-term-fx">' +
        '<li><b>คะแนนพฤติกรรม</b> เริ่มที่ 100 ใหม่ทุกภาคเรียน · ประวัติภาคเรียนก่อนยังเก็บไว้ใน Google Sheets</li>' +
        '<li><b>ประเมินอาจารย์</b> นักเรียนประเมินได้ 1 ครั้งต่อวิชาต่อภาคเรียน · เปลี่ยนภาคเรียนแล้วจะเปิดให้ประเมินรอบใหม่</li>' +
        '<li><b>ป้ายภาคเรียน/ปีการศึกษา</b> บนบัตรนักเรียน หน้าเกรดของอาจารย์ และหน้าภาพรวมแอดมิน</li>' +
      '</ul></section>';
  }
  window.k8TermSet = function (k, v) { T[k] = v; if (k === 'mode' && v === 'manual') { const cur = window.k8Term(); T.term = cur.term; T.year = cur.year; } render(); };
  window.k8TermNext = function () { if (T.term === 1) T.term = 2; else { T.term = 1; T.year += 1; } render(); };
  window.k8TermSave = async function () {
    T.saving = true; render();
    try {
      const r = await gasApiCall('saveCurrentTerm', { data: { mode: T.mode, term: T.term, year: T.year } });
      if (!r || !r.success) throw new Error((r && r.message) || 'บันทึกไม่สำเร็จ');
      window.k8TermSetting = r.setting;
      try { localStorage.setItem('khalifah_term_setting', JSON.stringify(r.setting)); } catch (e) {}
      document.dispatchEvent(new CustomEvent('k8-term-changed'));
      if (typeof showToast === 'function') showToast(r.message, 'success');
    } catch (e) { if (typeof showToast === 'function') showToast(e.message || 'บันทึกไม่สำเร็จ', 'error'); }
    T.saving = false; sync(); render();
  };
  if (typeof window.switchAdminTab === 'function') {
    const sat = window.switchAdminTab;
    window.switchAdminTab = function (tab) { const r = sat.apply(this, arguments); if (tab === 'term') { sync(); render(); if (window.k8LoadTermSetting) window.k8LoadTermSetting().then(() => { sync(); render(); }); } return r; };
  }
  document.addEventListener('k8-term-changed', () => {
    const el = document.getElementById('tgTerm'); if (el) el.textContent = window.k8Term().label;
    try { if (typeof renderCurrentStudentProfile === 'function') renderCurrentStudentProfile(); } catch (e) {}
    try { if (typeof window.renderAdminOverviewV8 === 'function' && document.getElementById('admin-tab-overview') && document.getElementById('admin-tab-overview').style.display !== 'none') window.renderAdminOverviewV8(); } catch (e) {}
  });
})();

/* ============ Round 13 · เอกสารประกอบการเรียน (Google Drive ในแอป) v2 ============ */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const js = (v) => String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const fmtD = (s) => { const d = new Date(String(s || '').slice(0, 10) + 'T00:00:00'); return isNaN(d) ? '' : d.getDate() + ' ' + MON[d.getMonth()] + ' ' + String(d.getFullYear() + 543).slice(2); };
  const fmtSize = (n) => !n ? '' : n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB';
  // เรียก API แบบไม่ให้ตัวดักข้อผิดพลาดกลางแสดงแจ้งเตือนซ้ำ (หน้าเอกสารแสดงข้อความเอง)
  const api = (a, p) => gasApiCall(a, p || {}, 30000);
  const TYPES = [
    [/pdf/, 'PDF', '#b91c1c', '#fee2e2'], [/presentation|powerpoint/, 'สไลด์', '#c2410c', '#ffedd5'], [/spreadsheet|excel|csv/, 'ตาราง', '#15803d', '#dcfce7'],
    [/document|word|text/, 'เอกสาร', '#1d4ed8', '#dbeafe'], [/image/, 'รูปภาพ', '#7c3aed', '#ede9fe'], [/video/, 'วิดีโอ', '#be123c', '#ffe4e6'], [/audio/, 'เสียง', '#0e7490', '#cffafe']
  ];
  const typeOf = (m) => TYPES.find((t) => t[0].test(String(m || ''))) || [null, 'ไฟล์', '#475569', '#f1f5f9'];
  const myGrade = () => { try { const g = String((currentStudent && currentStudent.grade) || '').match(/([1-6])/); return g ? g[1] : ''; } catch (e) { return ''; } };
  // nav = รายการโฟลเดอร์ที่เปิดซ้อนกัน [{id, name}] (ว่าง = โฟลเดอร์หลักของชั้น)
  const D = { grade: '', nav: [], view: {}, loading: '', err: {}, q: '', config: null, open: false, timer: null, seq: 0 };
  const curKey = () => D.nav.length ? D.nav[D.nav.length - 1].id : 'g' + D.grade;
  const store = (k, v) => { try { localStorage.setItem('khalifah_docs_' + k, JSON.stringify(v)); } catch (e) {} };
  const restore = (k) => { try { return JSON.parse(localStorage.getItem('khalifah_docs_' + k) || 'null'); } catch (e) { return null; } };

  async function loadConfig(force) {
    if (D.config && !force) return D.config;
    if (!D.config) D.config = restore('cfg');
    try { const r = await api('getStudyDocsConfig'); if (r && r.success) { D.config = r.folders || {}; store('cfg', D.config); } } catch (e) {}
    return D.config || {};
  }
  async function fetchFolder(key, quiet) {
    const cfg = D.config || {};
    if (key.charAt(0) === 'g' && !cfg[key.slice(1)]) { D.view[key] = { empty: true, folders: [], files: [] }; if (key === curKey()) render(); return; }
    if (!D.view[key]) { const c = restore(key); if (c) D.view[key] = c; }
    const seq = ++D.seq;
    if (!quiet) { D.loading = key; render(); }
    try {
      const r = await api('listStudyDocs', key.charAt(0) === 'g' ? { grade: key.slice(1), refresh: quiet ? 1 : '' } : { folderId: key, refresh: quiet ? 1 : '' });
      if (!r || !r.success) throw new Error((r && r.message) || 'โหลดเอกสารไม่สำเร็จ');
      const before = JSON.stringify(D.view[key] && { f: D.view[key].folders, x: D.view[key].files });
      D.view[key] = r; store(key, r); delete D.err[key];
      if (D.loading === key) D.loading = '';
      // วาดใหม่เฉพาะเมื่อรายการเปลี่ยนจริง เพื่อไม่ให้หน้ากระพริบ
      if (key === curKey() && (!quiet || before !== JSON.stringify({ f: r.folders, x: r.files }))) render();
    } catch (e) {
      if (D.loading === key) D.loading = '';
      if (!quiet) { D.err[key] = e.message || 'โหลดเอกสารไม่สำเร็จ'; if (key === curKey()) render(); }
    }
  }
  function listHtml() {
    const key = curKey(); const v = D.view[key]; const cfg = D.config || {};
    if (!v && D.loading === key) return '<div class="k8-docs-skel">' + '<div></div>'.repeat(5) + '</div>';
    if (!v && D.err[key]) return '<div class="k8-docs-empty is-err"><b>เปิดโฟลเดอร์ไม่สำเร็จ</b><span>' + esc(D.err[key]) + '</span><button type="button" onclick="k8DocsRefresh()">ลองอีกครั้ง</button>' + (!D.nav.length && cfg[D.grade] ? '<button type="button" class="is-alt" onclick="k8DocsEmbed()">เปิดแบบสำรอง</button>' : '') + '</div>';
    if (!v) return '<div class="k8-docs-skel">' + '<div></div>'.repeat(5) + '</div>';
    if (v.empty) return '<div class="k8-docs-empty"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><b>ยังไม่มีเอกสารสำหรับ ม.' + D.grade + '</b><span>อาจารย์จะเพิ่มเอกสารเร็ว ๆ นี้ · ลองดูชั้นอื่นที่มีเอกสารแล้วได้</span></div>';
    const q = D.q.trim().toLowerCase();
    const folders = v.folders.filter((f) => !q || f.name.toLowerCase().includes(q));
    const files = v.files.filter((f) => !q || f.name.toLowerCase().includes(q));
    let h = '';
    if (D.err[key]) h += '<p class="k8-docs-note">แสดงรายการล่าสุดที่จำไว้ · ' + esc(D.err[key]) + '</p>';
    if (folders.length) h += '<h3 class="k8-docs-h">โฟลเดอร์ (' + folders.length + ')</h3><ul class="k8-docs-folders">' + folders.map((f) => '<li><button type="button" onclick="k8DocsFolder(\'' + js(f.id) + '\',\'' + js(f.name) + '\')"><span class="k8-docs-fic"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4.2l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></span><span class="k8-docs-fname"><b>' + esc(f.name) + '</b>' + (f.files != null ? '<small>' + f.files + ' ไฟล์' + (f.folders ? ' · ' + f.folders + ' โฟลเดอร์' : '') + '</small>' : '') + '</span>' + (f.files != null ? '<span class="k8-docs-cnt' + (f.files ? '' : ' is-zero') + '">' + f.files + '</span>' : '') + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button></li>').join('') + '</ul>';
    if (files.length) h += '<h3 class="k8-docs-h">ไฟล์ (' + files.length + ')</h3><ul class="k8-docs-files">' + files.map((f) => { const t = typeOf(f.mime);
      return '<li><button type="button" onclick="k8DocsFile(\'' + js(f.id) + '\')"><span class="k8-docs-tic" style="color:' + t[2] + ';background:' + t[3] + '">' + t[1] + '</span><span class="k8-docs-fn"><b>' + esc(f.name) + '</b><small>' + [fmtD(f.updated), fmtSize(f.size)].filter(Boolean).join(' · ') + '</small></span></button></li>'; }).join('') + '</ul>';
    if (!folders.length && !files.length) h += '<div class="k8-docs-empty"><b>' + (q ? 'ไม่พบเอกสารที่ค้นหา' : 'โฟลเดอร์นี้ยังว่าง') + '</b></div>';
    return h;
  }
  function render() {
    const body = document.getElementById('k8DocsBody'); if (!body || !D.open) return;
    const cfg = D.config || {}; const key = curKey(); const v = D.view[key];
    const here = D.nav.length ? D.nav[D.nav.length - 1].name : 'ม.' + D.grade;
    document.getElementById('k8DocsTitle').textContent = D.nav.length ? here : 'เอกสารประกอบการเรียน';
    document.getElementById('k8DocsSub').textContent = D.nav.length ? 'ม.' + D.grade + ' › ' + D.nav.map((n) => n.name).join(' › ') : 'ม.' + D.grade + (v && !v.empty ? ' · ' + (v.folders.length + v.files.length) + ' รายการ' : '');
    let h = '';
    if (!D.nav.length) h += '<div class="k8-docs-grades" role="tablist" aria-label="ระดับชั้น">' + ['1', '2', '3', '4', '5', '6'].map((g) => '<button type="button" role="tab" aria-selected="' + (D.grade === g) + '" class="' + (cfg[g] ? 'has' : 'none') + '" onclick="k8DocsGrade(\'' + g + '\')">ม.' + g + (g === myGrade() ? '<small>ชั้นของฉัน</small>' : '') + '</button>').join('') + '</div>';
    else h += '<button type="button" class="k8-docs-up" onclick="k8DocsBack()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>ย้อนกลับไป ' + esc(D.nav.length > 1 ? D.nav[D.nav.length - 2].name : 'ม.' + D.grade) + '</button>';
    if (v && !v.empty && (v.files.length + v.folders.length) > 6) h += '<input type="search" class="k8-docs-q" id="k8DocsQ" placeholder="ค้นหาชื่อเอกสาร" value="' + esc(D.q) + '" oninput="k8DocsQ(this)" autocomplete="off">';
    h += '<div id="k8DocsList">' + listHtml() + '</div>';
    if (D.loading === key && v) h += '<p class="k8-docs-note">กำลังตรวจหาเอกสารใหม่…</p>';
    const keepQ = document.activeElement && document.activeElement.id === 'k8DocsQ';
    body.innerHTML = h;
    if (keepQ) { const n = document.getElementById('k8DocsQ'); if (n) { n.focus(); try { n.setSelectionRange(n.value.length, n.value.length); } catch (e) {} } }
  }
  function startLive() { stopLive(); D.timer = setInterval(() => { if (D.open && !document.hidden && document.getElementById('k8DocsViewer').hidden) fetchFolder(curKey(), true); }, 30000); }
  function stopLive() { if (D.timer) { clearInterval(D.timer); D.timer = null; } }

  // ประวัติการย้อนกลับ: ทุกครั้งที่เข้าโฟลเดอร์/เปิดไฟล์ จะเพิ่ม 1 ขั้น ปุ่มย้อนกลับของมือถือจึงถอยทีละขั้น
  const push = (tag) => { try { history.pushState({ k8docs: tag }, ''); } catch (e) {} };
  window.k8DocsOpen = async function (grade) {
    const el = document.getElementById('k8Docs'); if (!el) return;
    el.hidden = false; D.open = true; document.documentElement.classList.add('k8-docs-open'); push('root');
    D.q = ''; D.nav = [];
    if (!D.config) D.config = restore('cfg');
    D.grade = grade || myGrade() || Object.keys(D.config || {})[0] || '4';
    render();
    const before = JSON.stringify(D.config || {});
    await loadConfig(true);
    if (!grade && !(D.config || {})[D.grade] && Object.keys(D.config || {}).length && !myGrade()) D.grade = Object.keys(D.config)[0];
    if (before !== JSON.stringify(D.config || {})) render();
    fetchFolder(curKey(), false); startLive();
  };
  window.k8DocsGrade = function (g) { if (D.grade === g) return; D.grade = g; D.q = ''; if (!D.view[curKey()]) { const c = restore(curKey()); if (c) D.view[curKey()] = c; } render(); fetchFolder(curKey(), !!D.view[curKey()]); };
  window.k8DocsFolder = function (id, name) {
    D.nav.push({ id, name }); D.q = ''; push('folder');
    render(); try { document.getElementById('k8DocsBody').scrollTop = 0; } catch (e) {}
    fetchFolder(id, false);
  };
  window.k8DocsRefresh = function () { if (!document.getElementById('k8DocsViewer').hidden) return; delete D.err[curKey()]; fetchFolder(curKey(), false); };
  let qt = null;
  window.k8DocsQ = function (el) { D.q = el.value; clearTimeout(qt); qt = setTimeout(() => { const l = document.getElementById('k8DocsList'); if (l) l.innerHTML = listHtml(); }, 120); };
  function openViewer(src, name, sub, dl) {
    const v = document.getElementById('k8DocsViewer'), ld = document.getElementById('k8DocsFrameLoading');
    const old = document.getElementById('k8DocsFrame'); const f = document.createElement('iframe');
    f.id = 'k8DocsFrame'; f.title = 'ตัวอย่างเอกสาร'; f.setAttribute('allow', 'autoplay; fullscreen'); f.setAttribute('referrerpolicy', 'no-referrer');
    if (old) old.replaceWith(f);
    document.getElementById('k8DocsFileName').textContent = name; document.getElementById('k8DocsFileSub').textContent = sub || '';
    const a = document.getElementById('k8DocsDl'); a.hidden = !dl; if (dl) a.href = dl;
    ld.hidden = false; f.onload = () => { ld.hidden = true; }; f.src = src; v.hidden = false; push('file');
  }
  window.k8DocsFile = function (id) {
    const v = D.view[curKey()]; const f = ((v && v.files) || []).find((x) => x.id === id); if (!f) return;
    // เปิดผ่านระบบของแอป: ไม่ต้องเข้าสู่ระบบ Google ซูมและขีดเขียนได้
    if (window.k8PvOpen) { window.k8PvOpen(f); return; }
    const t = typeOf(f.mime); const isGoogle = /google-apps/.test(f.mime || '');
    openViewer('https://drive.google.com/file/d/' + encodeURIComponent(id) + '/preview', f.name, t[1] + (f.size ? ' · ' + fmtSize(f.size) : ''), isGoogle ? '' : 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(id));
  };
  window.k8DocsEmbed = function () { const id = (D.config || {})[D.grade]; if (id) openViewer('https://drive.google.com/embeddedfolderview?id=' + encodeURIComponent(id) + '#list', 'เอกสาร ม.' + D.grade, 'โหมดสำรอง (แสดงจาก Google Drive)', ''); };
  function closeFile() { const v = document.getElementById('k8DocsViewer'); if (!v || v.hidden) return false; v.hidden = true; const f = document.getElementById('k8DocsFrame'); if (f) { const n = document.createElement('iframe'); n.id = 'k8DocsFrame'; n.title = 'ตัวอย่างเอกสาร'; f.replaceWith(n); } return true; }
  function closeAll() { const el = document.getElementById('k8Docs'); if (el) el.hidden = true; D.open = false; stopLive(); closeFile(); document.documentElement.classList.remove('k8-docs-open'); }
  window.k8DocsCloseFile = function () { history.back(); };
  window.k8DocsBack = function () { history.back(); };
  window.addEventListener('popstate', () => {
    if (!D.open) return;
    if (window.k8PvIsOpen && window.k8PvIsOpen()) return;
    if (closeFile()) return;
    if (D.nav.length) { D.nav.pop(); D.q = ''; render(); const k = curKey(); if (D.view[k]) fetchFolder(k, true); else fetchFolder(k, false); return; }
    closeAll();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && D.open) history.back(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && D.open) fetchFolder(curKey(), true); });

  async function paintHomeBtn() {
    const sub = document.getElementById('hfDocsSub'); if (!sub) return;
    const g = myGrade(); if (!g) return;
    const cfg = await loadConfig(false);
    sub.textContent = cfg[g] ? 'ของชั้น ม.' + g + ' · แตะเพื่อเปิดดูในแอป' : 'ม.' + g + ' ยังไม่มีเอกสาร · ดูชั้นอื่นได้';
  }
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) { if (D.open) closeAll(); const r = sv.apply(this, arguments); if (v === 'dashboard') paintHomeBtn(); return r; };

  // ---------- แอดมิน: ตั้งค่าโฟลเดอร์ ม.1–ม.6 ----------
  async function renderAdmin() {
    const root = document.getElementById('k8DocsAdmin'); if (!root) return;
    const cfg = await loadConfig(true);
    root.innerHTML = '<section class="k8-bh-card"><h2 class="k8-bh-h">โฟลเดอร์ Google Drive ของแต่ละชั้น</h2>' +
      '<p class="k8-bh-intro">วางลิงก์โฟลเดอร์ Google Drive ของแต่ละชั้น นักเรียนและอาจารย์จะเปิดดูเอกสารได้ในแอปทันทีโดยไม่ต้องออกไปหน้า Drive · เพิ่มหรือลบไฟล์ในโฟลเดอร์ได้ตามปกติ แอปจะอัปเดตรายการเองภายในไม่ถึง 1 นาทีขณะเปิดดูอยู่</p>' +
      '<div class="k8-docs-cfg">' + ['1', '2', '3', '4', '5', '6'].map((g) => '<label><span>ม.' + g + '</span><input type="url" id="k8DocsCfg' + g + '" placeholder="https://drive.google.com/drive/folders/…" value="' + (cfg[g] ? 'https://drive.google.com/drive/folders/' + esc(cfg[g]) : '') + '" autocomplete="off"><button type="button" class="k8-bh-link" ' + (cfg[g] ? '' : 'disabled') + ' onclick="k8DocsOpen(\'' + g + '\')">เปิดดู</button></label>').join('') + '</div>' +
      '<div class="k8-term-preview">สำคัญ: ตั้งค่าแชร์โฟลเดอร์เป็น <b>"ทุกคนที่มีลิงก์ · ผู้มีสิทธิ์อ่าน"</b> เพื่อให้นักเรียนเปิดดูไฟล์ได้โดยไม่ต้องเข้าสู่ระบบ Google</div>' +
      '<button type="button" class="k8-bh-go k8-term-save" onclick="k8DocsCfgSave()">บันทึกโฟลเดอร์</button></section>';
  }
  window.k8DocsCfgSave = async function () {
    const folders = {}; ['1', '2', '3', '4', '5', '6'].forEach((g) => { const v = (document.getElementById('k8DocsCfg' + g).value || '').trim(); if (v) folders[g] = v; });
    try {
      const r = await api('saveStudyDocsFolders', { data: { folders } });
      if (!r || !r.success) throw new Error((r && r.message) || 'บันทึกไม่สำเร็จ');
      D.config = r.folders; D.view = {}; store('cfg', r.folders);
      try { Object.keys(localStorage).filter((k) => k.indexOf('khalifah_docs_g') === 0).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
      showToast(r.message, 'success'); renderAdmin();
    } catch (e) { showToast(e.message, 'error'); }
  };
  if (typeof window.switchAdminTab === 'function') {
    const sat = window.switchAdminTab;
    window.switchAdminTab = function (tab) { const r = sat.apply(this, arguments); if (tab === 'docs') renderAdmin(); return r; };
  }
  if (document.readyState === 'complete') setTimeout(paintHomeBtn, 800); else window.addEventListener('load', () => setTimeout(paintHomeBtn, 800));
})();

/* ============ Round 14 · แจ้งเตือน (กระดิ่ง) + ข้อตกลงหอพัก ============ */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const js = (v) => String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const norm = (id) => String(id == null ? '' : id).replace(/^0+/, '');
  const shortG = (g) => String(g || '').replace('มัธยมศึกษาปีที่ ', 'ม.');
  const api = (a, p) => gasApiCall(a, p || {}, 25000);
  const toast = (m, t) => { if (typeof showToast === 'function') showToast(m, t); };
  const stu = () => { try { return currentStudent || null; } catch (e) { return null; } };
  const adm = () => { try { return currentAdmin || null; } catch (e) { return null; } };
  const isSuper = () => { const a = adm(); return !!a && a.role === 'SuperAdmin'; };
  const N = { list: [], pending: [], unread: 0, loaded: false, loading: false, pop: null };
  function ago(s) {
    const d = new Date(String(s).replace(' ', 'T')); if (isNaN(d)) return s || '';
    const m = Math.round((Date.now() - d.getTime()) / 60000);
    if (m < 1) return 'เมื่อสักครู่'; if (m < 60) return m + ' นาทีที่แล้ว'; const h = Math.round(m / 60); if (h < 24) return h + ' ชั่วโมงที่แล้ว';
    const dd = Math.round(h / 24); if (dd < 7) return dd + ' วันที่แล้ว';
    const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; return d.getDate() + ' ' + MON[d.getMonth()];
  }
  const popped = () => { try { return JSON.parse(localStorage.getItem('k8_notif_popped') || '[]'); } catch (e) { return []; } };
  const markPopped = (id) => { try { const a = popped(); if (a.indexOf(id) === -1) { a.push(id); localStorage.setItem('k8_notif_popped', JSON.stringify(a.slice(-200))); } } catch (e) {} };

  // ---------- วางกระดิ่งในส่วนหัวของแต่ละหน้า ----------
  function placeBell() {
    const bell = document.getElementById('k8Bell'); if (!bell) return;
    const s = stu(), a = adm();
    if (!(s || (a && !isSuper()))) { bell.hidden = true; return; }
    let host = null;
    if (s) {
      let row = document.getElementById('k8HomeTop');
      const hf = document.getElementById('homeF');
      if (!row && hf) { row = document.createElement('div'); row.id = 'k8HomeTop'; row.className = 'k8-home-top'; row.innerHTML = '<div><span class="k8-home-hi">อัสลามุอะลัยกุม</span><b id="k8HomeName"></b></div>'; hf.insertBefore(row, hf.firstChild); }
      const nm = document.getElementById('k8HomeName'); if (nm) nm.textContent = String(s.fullName || '').replace(/^(นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง)\s*/, '').split(/\s+/)[0] || '';
      host = row;
    } else {
      const ins = document.querySelector('#view-inspector.active .k8-insp-head') || document.querySelector('#view-teacher .k8-th-head');
      host = ins;
    }
    if (host && bell.parentElement !== host) { const acct = host.querySelector('.k8-acct'); if (acct) host.insertBefore(bell, acct); else host.appendChild(bell); }
    bell.hidden = !host;
  }
  function paintBadge() {
    const n = N.unread, el = document.getElementById('k8BellN');
    if (el) { el.hidden = !n; el.textContent = n > 99 ? '99+' : String(n); }
    const b = document.getElementById('k8Bell'); if (b) { b.setAttribute('aria-label', 'การแจ้งเตือน' + (n ? ' ยังไม่อ่าน ' + n + ' รายการ' : '')); b.classList.toggle('has-new', !!n); }
    try { if (navigator.setAppBadge) { if (n) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (e) {}
    const ps = document.getElementById('k8PolicyStatus'), pc = document.getElementById('k8PolicyCard');
    if (ps && stu()) { const pend = N.pending.length > 0; ps.textContent = pend ? 'ยังไม่ได้ยินยอม · แตะเพื่ออ่านและกดยินยอม' : (N.ackAt ? 'ยินยอมแล้ว · ' + N.ackAt.slice(0, 16) : 'อ่านข้อตกลงได้ทุกเมื่อ'); if (pc) pc.classList.toggle('is-pending', pend); }
  }
  async function load(force) {
    const s = stu(), a = adm();
    if (!(s || (a && !isSuper())) || N.loading) { placeBell(); return; }
    if (!force && N.loaded && Date.now() - N.at < 15000) { placeBell(); paintBadge(); return; }
    N.loading = true;
    try {
      const r = await api('getMyNotifications');
      if (r && r.success) {
        N.list = r.notifications || []; N.pending = r.pendingPolicies || []; N.unread = r.unread || 0; N.loaded = true; N.at = Date.now();
        try { localStorage.setItem('k8_notif_cache_' + (s ? 'S' + norm(s.studentId) : 'U' + (a.username || '')), JSON.stringify({ list: N.list, pending: N.pending, unread: N.unread })); } catch (e) {}
      }
    } catch (e) {}
    N.loading = false; placeBell(); paintBadge(); maybePop();
    if (document.getElementById('k8NotifModal') && document.getElementById('k8NotifModal').classList.contains('open')) renderSheet();
  }
  function loadCache() {
    const s = stu(), a = adm(); if (!(s || a)) return;
    try { const c = JSON.parse(localStorage.getItem('k8_notif_cache_' + (s ? 'S' + norm(s.studentId) : 'U' + (a.username || ''))) || 'null'); if (c) { N.list = c.list || []; N.pending = c.pending || []; N.unread = c.unread || 0; } } catch (e) {}
    placeBell(); paintBadge();
  }

  // ---------- ป๊อปอัปเด้งเมื่อมีแจ้งเตือนใหม่ ----------
  function maybePop() {
    if (!document.getElementById('k8Pop').hidden || document.querySelector('.modal-overlay.open') || !document.getElementById('k8Policy').hidden) return;
    const done = popped();
    let item = null;
    if (N.pending.length && done.indexOf('policy:' + N.pending[0].id + ':' + new Date().toDateString()) === -1) item = { kind: 'policy', id: 'policy:' + N.pending[0].id + ':' + new Date().toDateString(), title: N.pending[0].title, body: 'กรุณาอ่านและกดยินยอมข้อตกลงฉบับ ' + (N.pending[0].subtitle || '') + ' แจ้งเตือนนี้จะยังอยู่จนกว่าจะกดยินยอม', tag: 'ต้องอ่านและกดยินยอม' };
    else { const n = N.list.find((x) => !x.read && done.indexOf(x.id) === -1); if (n) item = { kind: 'notif', id: n.id, nid: n.id, title: n.title, body: n.body, tag: n.priority === 'urgent' ? 'แจ้งเตือนสำคัญ' : 'แจ้งเตือนใหม่', urgent: n.priority === 'urgent' }; }
    if (!item) return;
    N.pop = item; markPopped(item.id);
    document.getElementById('k8PopTag').textContent = item.tag;
    document.getElementById('k8PopTitle').textContent = item.title;
    document.getElementById('k8PopBody').textContent = String(item.body || '').slice(0, 220) + (String(item.body || '').length > 220 ? '…' : '');
    document.getElementById('k8PopGo').textContent = item.kind === 'policy' ? 'อ่านข้อตกลง' : 'เปิดดู';
    const pop = document.getElementById('k8Pop'); pop.classList.toggle('is-urgent', !!item.urgent || item.kind === 'policy'); pop.hidden = false;
    try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) {}
  }
  window.k8PopClose = function () { document.getElementById('k8Pop').hidden = true; };
  window.k8PopGo = function () { const it = N.pop; window.k8PopClose(); if (!it) return; if (it.kind === 'policy') window.k8PolicyOpen(); else window.k8NotifOpen(it.nid); };

  // ---------- รายการแจ้งเตือน ----------
  function renderSheet(focusId) {
    const body = document.getElementById('k8NotifBody'); if (!body) return;
    document.getElementById('k8NotifSub').textContent = N.unread ? 'ยังไม่อ่าน ' + N.unread + ' รายการ' : 'อ่านครบแล้ว';
    let h = '';
    N.pending.forEach((p) => { h += '<button type="button" class="k8-nt-pin" onclick="k8PolicyOpen(\'' + js(p.id) + '\')"><span class="k8-nt-pin-tag">ต้องอ่านและกดยินยอม · ลบไม่ได้จนกว่าจะยินยอม</span><b>' + esc(p.title) + '</b><small>' + esc(p.subtitle || '') + ' · แตะเพื่ออ่าน</small></button>'; });
    if (!N.list.length && !N.pending.length) h += '<div class="k8-docs-empty"><b>ยังไม่มีการแจ้งเตือน</b><span>เมื่อโรงเรียนประกาศข่าวสาร จะแสดงที่นี่</span></div>';
    h += '<ul class="k8-nt-list">' + N.list.map((n) => '<li class="' + (n.read ? '' : 'is-new') + (n.priority === 'urgent' ? ' is-urgent' : '') + (focusId === n.id ? ' is-focus' : '') + '" id="k8nt-' + esc(n.id) + '"><div class="k8-nt-top">' + (n.priority === 'urgent' ? '<span class="k8-nt-tag">สำคัญ</span>' : '') + '<b>' + esc(n.title) + '</b></div>' + (n.body ? '<p>' + esc(n.body).replace(/\n/g, '<br>') + '</p>' : '') + '<div class="k8-nt-meta"><span>' + esc(ago(n.createdAt)) + (n.byName ? ' · ' + esc(n.byName) : '') + '</span><button type="button" onclick="k8NotifHide(\'' + js(n.id) + '\')">ลบ</button></div></li>').join('') + '</ul>';
    body.innerHTML = h;
    if (focusId) { const el = document.getElementById('k8nt-' + focusId); if (el) try { el.scrollIntoView({ block: 'center' }); } catch (e) {} }
  }
  window.k8NotifOpen = function (focusId) {
    renderSheet(focusId); openModal('k8NotifModal');
    const ids = N.list.filter((n) => !n.read).map((n) => n.id);
    if (ids.length) {
      N.list.forEach((n) => { n.read = true; }); N.unread = N.pending.length; paintBadge();
      api('markNotificationRead', { data: { ids } }).catch(() => {});
      setTimeout(() => renderSheet(), 1600);
    }
    load(true);
  };
  window.k8NotifHide = function (id) {
    N.list = N.list.filter((n) => n.id !== id); renderSheet(); paintBadge();
    api('markNotificationRead', { data: { ids: [id], hide: true } }).catch(() => {});
  };

  // ---------- อ่านข้อตกลงและกดยินยอม ----------
  const P = { data: null, ackAt: '', canAgree: false };
  window.k8PolicyOpen = async function (pid) {
    closeModal('k8NotifModal');
    const el = document.getElementById('k8Policy'); el.hidden = false; document.documentElement.classList.add('k8-docs-open');
    try { history.pushState({ k8policy: 1 }, ''); } catch (e) {}
    const body = document.getElementById('k8PolicyBody');
    try { P.data = JSON.parse(localStorage.getItem('k8_policy_cache') || 'null'); } catch (e) {}
    if (P.data) renderPolicy(); else body.innerHTML = '<div class="k8-docs-skel"><div></div><div></div><div></div></div>';
    try {
      const r = await api('getPolicy', { policyId: pid || '' });
      if (r && r.success) { P.data = r.policy; P.ackAt = r.acknowledgedAt || ''; N.ackAt = P.ackAt; try { localStorage.setItem('k8_policy_cache', JSON.stringify(r.policy)); } catch (e) {} renderPolicy(); paintBadge(); }
      else if (!P.data) body.innerHTML = '<div class="k8-docs-empty is-err"><b>เปิดข้อตกลงไม่สำเร็จ</b><span>' + esc((r && r.message) || '') + '</span></div>';
    } catch (e) { if (!P.data) body.innerHTML = '<div class="k8-docs-empty is-err"><b>เปิดข้อตกลงไม่สำเร็จ</b><span>ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่</span></div>'; }
  };
  function renderPolicy() {
    const p = P.data; if (!p) return;
    const isStu = !!stu();
    document.getElementById('k8PolicyTitle').textContent = p.title; document.getElementById('k8PolicySub').textContent = p.subtitle;
    const body = document.getElementById('k8PolicyBody');
    body.innerHTML = '<section class="k8-pol-head"><h1>' + esc(p.title) + '</h1><p class="k8-pol-sub">' + esc(p.subtitle) + '</p><dl><div><dt>สถานศึกษา/หอพัก</dt><dd>' + esc(p.place) + '</dd></div><div><dt>ประกาศใช้วันที่</dt><dd>' + esc(p.effective) + '</dd></div></dl><p class="k8-pol-purpose"><b>วัตถุประสงค์</b> ' + esc(p.purpose) + '</p></section>' +
      '<ol class="k8-pol-list">' + p.items.map((it, i) => '<li><h3><span>' + (i + 1) + '</span>' + esc(it.t) + '</h3><ul>' + it.d.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' + (it.m ? '<p class="k8-pol-m"><b>มาตรการ</b> ' + esc(it.m) + '</p>' : '') + (it.r ? '<p class="k8-pol-r"><b>รางวัล/คำชื่นชม</b> ' + esc(it.r) + '</p>' : '') + '</li>').join('') + '</ol>' +
      (isStu ? (P.ackAt ? '<section class="k8-pol-done"><b>✓ ยินยอมข้อตกลงแล้ว</b><span>เมื่อ ' + esc(P.ackAt) + '</span></section>' :
        '<section class="k8-pol-agree" id="k8PolAgree"><label class="k8-pol-check"><input type="checkbox" id="k8PolChk" disabled onchange="k8PolicyChk(this)"><span>' + esc(p.consent) + '</span></label><p class="k8-pol-hint" id="k8PolHint">เลื่อนอ่านให้ถึงข้อสุดท้ายก่อน จึงจะกดยินยอมได้</p><button type="button" class="k8-bh-go" id="k8PolBtn" disabled onclick="k8PolicyAgree()">ยินยอมข้อตกลง</button></section>') : '');
    body.scrollTop = 0;
    if (isStu && !P.ackAt) {
      const check = () => { if (body.scrollTop + body.clientHeight >= body.scrollHeight - 80) { const c = document.getElementById('k8PolChk'); if (c && c.disabled) { c.disabled = false; const h = document.getElementById('k8PolHint'); if (h) h.textContent = 'ติ๊กช่องด้านบนแล้วกด "ยินยอมข้อตกลง"'; } } };
      body.onscroll = check; setTimeout(check, 300);
    }
  }
  window.k8PolicyChk = function (c) { const b = document.getElementById('k8PolBtn'); if (b) b.disabled = !c.checked; };
  window.k8PolicyAgree = async function () {
    const b = document.getElementById('k8PolBtn'); if (!b || b.disabled) return;
    b.disabled = true; b.textContent = 'กำลังบันทึก…';
    try {
      const r = await api('acknowledgePolicy', { policyId: P.data.id, version: P.data.version });
      if (!r || !r.success) throw new Error((r && r.message) || 'บันทึกไม่สำเร็จ');
      P.ackAt = r.acknowledgedAt; N.ackAt = P.ackAt; N.pending = N.pending.filter((x) => x.id !== P.data.id); N.unread = Math.max(0, N.unread - 1);
      renderPolicy(); paintBadge(); toast(r.message, 'success');
      try { document.getElementById('k8PolicyBody').scrollTop = document.getElementById('k8PolicyBody').scrollHeight; } catch (e) {}
    } catch (e) { b.disabled = false; b.textContent = 'ยินยอมข้อตกลง'; toast(e.message, 'error'); }
  };
  function closePolicy() { const el = document.getElementById('k8Policy'); if (!el || el.hidden) return false; el.hidden = true; document.documentElement.classList.remove('k8-docs-open'); return true; }
  window.k8PolicyClose = function () { try { history.back(); } catch (e) { closePolicy(); } };
  window.addEventListener('popstate', () => { closePolicy(); });

  // ---------- แอดมิน: ส่งแจ้งเตือน + ติดตามการยินยอม ----------
  const A = { title: '', body: '', priority: 'normal', audience: 'all', grades: new Set(), people: new Map(), q: '', expires: '', sent: [], summary: null, sending: false, ackGrade: 'ALL', showNot: true };
  const AUD = [['all', 'นักเรียนทุกคน'], ['grade', 'รายชั้นปี'], ['students', 'รายบุคคล'], ['staff', 'อาจารย์/บุคลากร'], ['everyone', 'ทุกคน (นักเรียน+บุคลากร)']];
  const audLabel = (n) => n.audience === 'grade' ? 'ชั้น ' + String(n.audienceValue).split(',').map((g) => 'ม.' + g).join(', ') : n.audience === 'students' ? 'นักเรียน ' + String(n.audienceValue).split(',').filter(Boolean).length + ' คน' : (AUD.find((x) => x[0] === n.audience) || [0, n.audience])[1];
  function allStu() { try { return (allStudents || []).filter((s) => s && s.studentId && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(s.status || ''))); } catch (e) { return []; } }
  function renderAdmin() {
    const root = document.getElementById('k8NotifAdmin'); if (!root) return;
    const q = A.q.trim().toLowerCase();
    const found = A.audience === 'students' && q ? allStu().filter((s) => String(s.fullName || '').toLowerCase().includes(q) || norm(s.studentId).includes(q.replace(/^0+/, ''))).slice(0, 8) : [];
    const sum = A.summary;
    let h = '<section class="k8-bh-card"><h2 class="k8-bh-h">ส่งแจ้งเตือนใหม่</h2>' +
      '<label class="k8-nf-f"><span>หัวข้อ *</span><input type="text" maxlength="120" id="k8NaTitle" value="' + esc(A.title) + '" placeholder="เช่น งดเรียนวันศุกร์นี้" oninput="k8NaSet(\'title\', this.value, 1)"></label>' +
      '<label class="k8-nf-f"><span>ข้อความ</span><textarea rows="4" maxlength="2000" id="k8NaBody" placeholder="รายละเอียดที่ต้องการแจ้ง" oninput="k8NaSet(\'body\', this.value, 1)">' + esc(A.body) + '</textarea></label>' +
      '<div class="k8-nf-f"><span>ความสำคัญ</span><div class="k8h-mini-seg">' + [['normal', 'ทั่วไป'], ['urgent', 'สำคัญ (เด้งเด่นชัด)']].map(([k, l]) => '<button type="button" aria-pressed="' + (A.priority === k) + '" onclick="k8NaSet(\'priority\',\'' + k + '\')">' + l + '</button>').join('') + '</div></div>' +
      '<div class="k8-nf-f"><span>ส่งถึง</span><div class="k8-na-aud">' + AUD.map(([k, l]) => '<button type="button" aria-pressed="' + (A.audience === k) + '" onclick="k8NaSet(\'audience\',\'' + k + '\')">' + l + '</button>').join('') + '</div></div>';
    if (A.audience === 'grade') h += '<div class="k8-na-chips">' + ['1', '2', '3', '4', '5', '6'].map((g) => '<button type="button" aria-pressed="' + A.grades.has(g) + '" onclick="k8NaGrade(\'' + g + '\')">ม.' + g + ' <small>' + allStu().filter((s) => String(s.grade || '').indexOf(g) !== -1).length + ' คน</small></button>').join('') + '</div>';
    if (A.audience === 'students') h += '<div class="k8-na-people">' + Array.from(A.people.entries()).map(([id, nm]) => '<span>' + esc(nm) + '<button type="button" aria-label="เอาออก" onclick="k8NaPerson(\'' + js(id) + '\')">✕</button></span>').join('') + '</div><input type="search" class="k8-docs-q" id="k8NaQ" placeholder="พิมพ์ชื่อหรือรหัสนักเรียนเพื่อเพิ่ม" value="' + esc(A.q) + '" oninput="k8NaQ(this)" autocomplete="off">' + (found.length ? '<ul class="k8-na-found">' + found.map((s) => '<li><button type="button" onclick="k8NaPerson(\'' + js(s.studentId) + '\',\'' + js(s.fullName) + '\')"><b>' + esc(s.fullName) + '</b><small>' + esc(shortG(s.grade)) + ' · ' + esc(s.studentId) + '</small><span>' + (A.people.has(String(s.studentId)) ? '✓' : '+ เพิ่ม') + '</span></button></li>').join('') + '</ul>' : '');
    h += '<label class="k8-nf-f"><span>แสดงถึงวันที่ (ไม่บังคับ)</span><input type="date" value="' + esc(A.expires) + '" onchange="k8NaSet(\'expires\', this.value)"></label>' +
      '<button type="button" class="k8-bh-go k8-term-save" ' + (A.sending ? 'disabled' : '') + ' onclick="k8NaSend()">' + (A.sending ? 'กำลังส่ง…' : 'ส่งแจ้งเตือน') + '</button></section>';
    h += '<section class="k8-bh-card"><h2 class="k8-bh-h">การยินยอมกฎระเบียบหอพัก</h2>';
    if (!sum) h += '<p class="k8-bh-intro">กำลังโหลด…</p>';
    else {
      const pct = sum.total ? Math.round(sum.acknowledged / sum.total * 100) : 0;
      const list = sum.students.filter((s) => (A.ackGrade === 'ALL' || s.grade === A.ackGrade) && (A.showNot ? !s.ackAt : !!s.ackAt));
      h += '<div class="k8-na-prog"><b>' + sum.acknowledged + ' / ' + sum.total + ' คน</b><span>ยินยอมแล้ว ' + pct + '%</span><i><em style="width:' + pct + '%"></em></i></div>' +
        '<div class="k8-bh-filter"><div class="k8h-mini-seg">' + [[true, 'ยังไม่ยินยอม'], [false, 'ยินยอมแล้ว']].map(([k, l]) => '<button type="button" aria-pressed="' + (A.showNot === k) + '" onclick="k8NaSet(\'showNot\',' + k + ')">' + l + '</button>').join('') + '</div><select onchange="k8NaSet(\'ackGrade\', this.value)">' + ['ALL', 'มัธยมศึกษาปีที่ 1', 'มัธยมศึกษาปีที่ 2', 'มัธยมศึกษาปีที่ 3', 'มัธยมศึกษาปีที่ 4', 'มัธยมศึกษาปีที่ 5', 'มัธยมศึกษาปีที่ 6'].map((g) => '<option value="' + g + '"' + (g === A.ackGrade ? ' selected' : '') + '>' + (g === 'ALL' ? 'ทุกชั้น' : shortG(g)) + '</option>').join('') + '</select></div>' +
        '<ul class="k8-na-acks">' + (list.length ? list.slice(0, 300).map((s) => '<li><b>' + esc(s.fullName) + '</b><small>' + esc(shortG(s.grade)) + ' · ' + esc(s.studentId) + (s.ackAt ? ' · ' + esc(s.ackAt.slice(0, 16)) : '') + '</small></li>').join('') : '<li class="k8-bh-empty">' + (A.showNot ? 'ทุกคนยินยอมแล้ว' : 'ยังไม่มีผู้ยินยอม') + '</li>') + '</ul>' +
        (A.showNot && list.length ? '<button type="button" class="k8-bh-link" onclick="k8NaRemind()">ส่งแจ้งเตือนถึงคนที่ยังไม่ยินยอม (' + list.length + ' คน)</button>' : '');
    }
    h += '</section><section class="k8-bh-card"><h2 class="k8-bh-h">แจ้งเตือนที่ส่งแล้ว</h2><ul class="k8-na-sent">' + (A.sent.length ? A.sent.map((n) => '<li><div><b>' + (n.priority === 'urgent' ? '<span class="k8-nt-tag">สำคัญ</span> ' : '') + esc(n.title) + '</b><small>' + esc(audLabel(n)) + ' · ' + esc(ago(n.createdAt)) + (n.expires ? ' · ถึง ' + esc(n.expires) : '') + '</small></div><span class="k8-na-read">' + (n.recipients ? 'อ่าน ' + Math.min(n.reads, n.recipients) + '/' + n.recipients : 'อ่าน ' + n.reads) + '</span><button type="button" class="k8-bh-undo" onclick="k8NaDel(\'' + js(n.id) + '\')">ลบ</button></li>').join('') : '<li class="k8-bh-empty">ยังไม่มีแจ้งเตือนที่ส่ง</li>') + '</ul></section>';
    root.innerHTML = h;
  }
  async function loadAdmin() {
    renderAdmin();
    try { const [a, b] = await Promise.all([api('listSentNotifications'), api('getPolicyAckSummary')]); if (a && a.success) A.sent = a.data || []; if (b && b.success) A.summary = b; } catch (e) {}
    renderAdmin();
  }
  window.k8NaSet = function (k, v, quiet) { A[k] = v; if (!quiet) renderAdmin(); };
  window.k8NaGrade = function (g) { if (A.grades.has(g)) A.grades.delete(g); else A.grades.add(g); renderAdmin(); };
  window.k8NaPerson = function (id, nm) { id = String(id); if (A.people.has(id) && !nm) A.people.delete(id); else if (nm) { if (A.people.has(id)) A.people.delete(id); else A.people.set(id, nm); } renderAdmin(); const q = document.getElementById('k8NaQ'); if (q) q.focus(); };
  let qt = null;
  window.k8NaQ = function (el) { A.q = el.value; clearTimeout(qt); qt = setTimeout(() => { const pos = el.selectionStart; renderAdmin(); const n = document.getElementById('k8NaQ'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }, 150); };
  window.k8NaRemind = function () {
    const list = A.summary.students.filter((s) => !s.ackAt && (A.ackGrade === 'ALL' || s.grade === A.ackGrade));
    A.audience = 'students'; A.people = new Map(list.map((s) => [String(s.studentId), s.fullName]));
    A.title = 'กรุณาอ่านและกดยินยอมกฎระเบียบหอพัก'; A.body = 'เข้าไปที่เมนู "ฉัน" แล้วแตะ "กฎระเบียบหอพักนักเรียนและแนวทางส่งเสริมพฤติกรรม" อ่านให้ครบแล้วกดยินยอมข้อตกลง'; A.priority = 'urgent';
    renderAdmin(); try { document.getElementById('k8NaTitle').scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
  };
  window.k8NaSend = async function () {
    const title = A.title.trim(); if (!title) { toast('กรุณาใส่หัวข้อแจ้งเตือน', 'warning'); document.getElementById('k8NaTitle').focus(); return; }
    const values = A.audience === 'grade' ? Array.from(A.grades) : A.audience === 'students' ? Array.from(A.people.keys()) : [];
    if (A.audience === 'grade' && !values.length) { toast('เลือกชั้นปีอย่างน้อย 1 ชั้น', 'warning'); return; }
    if (A.audience === 'students' && !values.length) { toast('เพิ่มนักเรียนอย่างน้อย 1 คน', 'warning'); return; }
    A.sending = true; renderAdmin();
    try {
      const r = await api('sendNotification', { data: { title, body: A.body, priority: A.priority, audience: A.audience, values, expires: A.expires } });
      if (!r || !r.success) throw new Error((r && r.message) || 'ส่งไม่สำเร็จ');
      toast('ส่งแจ้งเตือนแล้ว', 'success'); A.title = ''; A.body = ''; A.people = new Map(); A.q = ''; A.expires = '';
      await loadAdmin();
    } catch (e) { toast(e.message, 'error'); }
    A.sending = false; renderAdmin();
  };
  window.k8NaDel = async function (id) {
    if (!window.confirm('ลบแจ้งเตือนนี้? ผู้รับจะไม่เห็นอีก')) return;
    try { const r = await api('deleteNotification', { data: { id } }); if (!r || !r.success) throw new Error((r && r.message) || 'ลบไม่สำเร็จ'); A.sent = A.sent.filter((n) => n.id !== id); renderAdmin(); toast(r.message, 'success'); } catch (e) { toast(e.message, 'error'); }
  };
  if (typeof window.switchAdminTab === 'function') {
    const sat = window.switchAdminTab;
    window.switchAdminTab = function (tab) { const r = sat.apply(this, arguments); if (tab === 'notify') loadAdmin(); return r; };
  }

  // ---------- ผูกกับวงจรของแอป ----------
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function () { const r = sv.apply(this, arguments); setTimeout(() => { placeBell(); load(false); }, 0); return r; };
  window.k8NotifReload = function () { load(true); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(true); });
  function boot() { loadCache(); load(true); }
  if (document.readyState === 'complete') setTimeout(boot, 200); else window.addEventListener('load', () => setTimeout(boot, 200));
  setInterval(() => { if (!document.hidden) load(true); }, 120000);
})();

/* ============ Round 15 · ความใฝ่ฝัน (อาชีพในฝัน + ไอคอน) ============ */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const js = (v) => String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  // [ชื่อ, ไอคอน Font Awesome, หมวด, คำค้นเพิ่มเติม] · จัดเป็นหมวดเพื่อให้เด็กเห็นว่าโลกนี้มีอาชีพหลากหลาย
  const C = [
    ['แพทย์', 'user-doctor', 'health', 'หมอ doctor ศัลยแพทย์'],
    ['พยาบาล', 'user-nurse', 'health', 'nurse'],
    ['ทันตแพทย์', 'tooth', 'health', 'หมอฟัน dentist'],
    ['เภสัชกร', 'pills', 'health', 'ยา pharmacist'],
    ['สัตวแพทย์', 'paw', 'health', 'หมอสัตว์ vet'],
    ['กุมารแพทย์', 'baby', 'health', 'หมอเด็ก'],
    ['จักษุแพทย์ / นักทัศนมาตร', 'eye', 'health', 'หมอตา แว่นตา'],
    ['แพทย์ฉุกเฉิน / กู้ชีพ', 'truck-medical', 'health', 'กู้ภัย paramedic ฉุกเฉิน'],
    ['นักกายภาพบำบัด', 'person-walking-with-cane', 'health', 'กายภาพ'],
    ['นักจิตวิทยา', 'brain', 'health', 'จิตแพทย์ psychologist'],
    ['นักเทคนิคการแพทย์', 'microscope', 'health', 'แล็บ'],
    ['นักโภชนาการ', 'bowl-food', 'health', 'อาหาร'],
    ['นักรังสีเทคนิค', 'heart-pulse', 'health', 'เอกซเรย์ x-ray'],
    ['แพทย์แผนไทย', 'leaf', 'health', 'สมุนไพร นวดแผนไทย'],
    ['นักพันธุศาสตร์', 'dna', 'health', 'ยีน dna'],
    ['นักบำบัดสปา', 'spa', 'health', 'สปา นวด'],
    ['นักวิทยาศาสตร์', 'flask', 'sci', 'scientist เคมี ฟิสิกส์ ชีวะ'],
    ['นักวิจัย', 'magnifying-glass-chart', 'sci', 'research'],
    ['นักดาราศาสตร์', 'satellite', 'sci', 'ดาว อวกาศ astronomer'],
    ['นักบินอวกาศ', 'user-astronaut', 'sci', 'อวกาศ astronaut'],
    ['นักธรณีวิทยา', 'mountain-sun', 'sci', 'หิน แร่ ภูเขาไฟ'],
    ['นักอุตุนิยมวิทยา', 'cloud-sun-rain', 'sci', 'พยากรณ์อากาศ'],
    ['นักกีฏวิทยา', 'bugs', 'sci', 'แมลง'],
    ['นักชีววิทยาทางทะเล', 'fish', 'sci', 'ทะเล ปลา'],
    ['โปรแกรมเมอร์', 'laptop-code', 'tech', 'นักพัฒนา developer coder เขียนโปรแกรม software'],
    ['นักพัฒนาแอปมือถือ', 'mobile-screen', 'tech', 'app แอป mobile'],
    ['นักวิทยาศาสตร์ข้อมูล', 'chart-line', 'tech', 'data scientist ข้อมูล'],
    ['วิศวกร AI', 'robot', 'tech', 'ai ปัญญาประดิษฐ์ machine learning'],
    ['นักความปลอดภัยไซเบอร์', 'shield-halved', 'tech', 'cyber security แฮกเกอร์'],
    ['นักพัฒนาเกม', 'gamepad', 'tech', 'game developer เกม'],
    ['วิศวกรคลาวด์', 'cloud', 'tech', 'cloud'],
    ['ผู้ดูแลฐานข้อมูล', 'database', 'tech', 'database'],
    ['วิศวกรเครือข่าย', 'network-wired', 'tech', 'network'],
    ['DevOps', 'code-branch', 'tech', 'devops'],
    ['นักพัฒนา AR/VR', 'vr-cardboard', 'tech', 'vr ar metaverse'],
    ['ผู้ดูแลระบบ', 'server', 'tech', 'system admin it'],
    ['วิศวกรโยธา', 'helmet-safety', 'eng', 'engineer วิศวะ โยธา ก่อสร้าง'],
    ['วิศวกรไฟฟ้า', 'bolt', 'eng', 'ไฟฟ้า electrical'],
    ['วิศวกรเครื่องกล', 'gears', 'eng', 'เครื่องกล mechanical'],
    ['วิศวกรคอมพิวเตอร์', 'microchip', 'eng', 'ชิป hardware'],
    ['วิศวกรการบิน', 'plane', 'eng', 'อากาศยาน aerospace'],
    ['วิศวกรพลังงานทดแทน', 'solar-panel', 'eng', 'โซลาร์ พลังงาน'],
    ['สถาปนิก', 'compass-drafting', 'eng', 'architect ออกแบบบ้าน'],
    ['มัณฑนากร', 'swatchbook', 'eng', 'ออกแบบภายใน interior'],
    ['ครู', 'chalkboard-user', 'edu', 'อาจารย์ teacher'],
    ['ครูอนุบาล', 'children', 'edu', 'เด็กเล็ก'],
    ['ติวเตอร์', 'person-chalkboard', 'edu', 'สอนพิเศษ tutor'],
    ['ศาสตราจารย์', 'graduation-cap', 'edu', 'อาจารย์มหาวิทยาลัย professor ด็อกเตอร์'],
    ['บรรณารักษ์', 'book', 'edu', 'ห้องสมุด librarian'],
    ['นักแปล / ล่าม', 'language', 'edu', 'แปล ล่าม อาหรับ อังกฤษ translator'],
    ['นักประวัติศาสตร์', 'scroll', 'edu', 'ประวัติศาสตร์'],
    ['นักการทูต', 'earth-asia', 'edu', 'ทูต diplomat ต่างประเทศ'],
    ['อุสตาซ / อุสตาซะห์', 'mosque', 'faith', 'อุสตาซ อุสตาซะห์ บาบอ โต๊ะครู อิหม่าม ศาสนา imam'],
    ['ฮาฟิซอัลกุรอาน', 'book-quran', 'faith', 'ฮาฟิซ ฮาฟิซะห์ กุรอาน hafiz'],
    ['นักเผยแผ่ศาสนา (ดาอี)', 'hands-praying', 'faith', 'ดะอ์วะห์ ดาอี'],
    ['ผู้นำทัวร์ฮัจญ์/อุมเราะห์', 'kaaba', 'faith', 'ฮัจญ์ อุมเราะห์ มักกะห์'],
    ['ทหาร', 'person-military-rifle', 'gov', 'soldier ทหารบก'],
    ['ทหารอากาศ / นักบินขับไล่', 'jet-fighter', 'gov', 'กองทัพอากาศ'],
    ['ทหารเรือ', 'anchor', 'gov', 'กองทัพเรือ navy'],
    ['ตำรวจ', 'user-shield', 'gov', 'police'],
    ['นักสืบ', 'user-secret', 'gov', 'สืบสวน detective'],
    ['นักดับเพลิง', 'fire-extinguisher', 'gov', 'ดับเพลิง firefighter'],
    ['ทนายความ', 'scale-balanced', 'gov', 'lawyer กฎหมาย นิติ'],
    ['ผู้พิพากษา / อัยการ', 'gavel', 'gov', 'judge ศาล'],
    ['ข้าราชการ', 'landmark', 'gov', 'รับราชการ ปลัด นายอำเภอ'],
    ['เจ้าหน้าที่ตรวจคนเข้าเมือง', 'passport', 'gov', 'ตม. ศุลกากร'],
    ['เจ้าหน้าที่ราชทัณฑ์', 'handcuffs', 'gov', 'เรือนจำ'],
    ['นักบิน', 'plane-departure', 'gov', 'pilot บิน'],
    ['กัปตันเรือ', 'ship', 'gov', 'เรือ กะลาสี'],
    ['นักธุรกิจ', 'briefcase', 'biz', 'business เจ้าของกิจการ ผู้ประกอบการ'],
    ['ผู้บริหาร / CEO', 'user-tie', 'biz', 'ceo ผู้จัดการ manager'],
    ['แม่ค้าออนไลน์', 'store', 'biz', 'ขายของออนไลน์ ค้าขาย ร้านค้า'],
    ['อีคอมเมิร์ซ', 'cart-shopping', 'biz', 'e-commerce ร้านออนไลน์'],
    ['นักบัญชี', 'calculator', 'biz', 'บัญชี accountant'],
    ['ผู้สอบบัญชี', 'file-invoice-dollar', 'biz', 'audit'],
    ['นักการเงิน / นักลงทุน', 'sack-dollar', 'biz', 'การเงิน ลงทุน investor'],
    ['พนักงานธนาคาร', 'coins', 'biz', 'ธนาคาร bank'],
    ['นักวิเคราะห์การเงิน', 'chart-pie', 'biz', 'analyst'],
    ['นักการตลาด', 'bullhorn', 'biz', 'marketing การตลาด'],
    ['นักขาย / ฝ่ายบุคคล', 'handshake', 'biz', 'sales hr'],
    ['ผู้จัดการโครงการ', 'clipboard-list', 'biz', 'project manager pm'],
    ['นักโลจิสติกส์', 'box', 'biz', 'ขนส่ง logistics'],
    ['นายหน้าอสังหาริมทรัพย์', 'building', 'biz', 'อสังหา บ้าน คอนโด'],
    ['ยูทูบเบอร์ / ครีเอเตอร์', 'video', 'art', 'youtuber tiktoker สตรีมเมอร์ อินฟลูเอนเซอร์ creator'],
    ['นักกีฬาอีสปอร์ต', 'headset', 'art', 'esports เกมเมอร์ gamer'],
    ['นักออกแบบกราฟิก', 'pen-ruler', 'art', 'graphic designer ดีไซเนอร์ ux ui'],
    ['ศิลปิน / นักวาด', 'palette', 'art', 'artist วาดรูป การ์ตูน illustrator'],
    ['แอนิเมเตอร์', 'wand-magic-sparkles', 'art', 'animation แอนิเมชัน'],
    ['นักออกแบบ 3 มิติ', 'cube', 'art', '3d'],
    ['ช่างภาพ', 'camera', 'art', 'photographer ถ่ายรูป'],
    ['ตัดต่อวิดีโอ', 'photo-film', 'art', 'editor ตัดต่อ'],
    ['ผู้กำกับ', 'clapperboard', 'art', 'director ภาพยนตร์'],
    ['นักแสดง', 'masks-theater', 'art', 'ดารา actor ละคร'],
    ['นักร้อง / พิธีกร', 'microphone', 'art', 'singer นักร้อง อนาชีด mc'],
    ['นักดนตรี', 'guitar', 'art', 'ดนตรี musician'],
    ['มือกลอง', 'drum', 'art', 'กลอง'],
    ['นักจัดพอดแคสต์', 'podcast', 'art', 'podcast'],
    ['นักเขียน', 'pen-nib', 'art', 'writer นิยาย'],
    ['นักข่าว', 'newspaper', 'art', 'journalist ผู้ประกาศข่าว'],
    ['ดีไซเนอร์แฟชั่น', 'shirt', 'art', 'แฟชั่น fashion'],
    ['นักออกแบบเครื่องประดับ', 'gem', 'art', 'จิวเวลรี่'],
    ['เชฟ', 'kitchen-set', 'svc', 'chef ทำอาหาร พ่อครัว'],
    ['เจ้าของร้านอาหาร', 'utensils', 'svc', 'ร้านอาหาร restaurant'],
    ['บาริสต้า', 'mug-hot', 'svc', 'กาแฟ barista คาเฟ่'],
    ['เบเกอร์', 'bread-slice', 'svc', 'ขนมปัง เบเกอรี่'],
    ['นักทำขนม / เค้ก', 'cake-candles', 'svc', 'ขนม เค้ก'],
    ['มัคคุเทศก์', 'suitcase-rolling', 'svc', 'ไกด์ ท่องเที่ยว travel'],
    ['พนักงานโรงแรม', 'bell-concierge', 'svc', 'โรงแรม hotel'],
    ['ผู้จัดการโรงแรม', 'hotel', 'svc', 'โรงแรม รีสอร์ท'],
    ['พนักงานต้อนรับบนเครื่องบิน', 'plane', 'svc', 'แอร์โฮสเตส สจ๊วต flight attendant'],
    ['นักฟุตบอล', 'futbol', 'sport', 'ฟุตบอล นักบอล football'],
    ['นักบาสเกตบอล', 'basketball', 'sport', 'บาส'],
    ['นักวอลเลย์บอล', 'volleyball', 'sport', 'วอลเลย์'],
    ['นักว่ายน้ำ', 'person-swimming', 'sport', 'ว่ายน้ำ'],
    ['นักวิ่ง', 'person-running', 'sport', 'วิ่ง กรีฑา'],
    ['นักปั่นจักรยาน', 'person-biking', 'sport', 'จักรยาน'],
    ['นักเทเบิลเทนนิส', 'table-tennis-paddle-ball', 'sport', 'ปิงปอง'],
    ['นักหมากรุก', 'chess', 'sport', 'หมากรุก'],
    ['โค้ช / ผู้ฝึกสอน', 'stopwatch', 'sport', 'โค้ช coach'],
    ['เทรนเนอร์ฟิตเนส', 'dumbbell', 'sport', 'fitness ออกกำลังกาย'],
    ['นักกีฬา', 'medal', 'sport', 'sport athlete'],
    ['ไกด์เดินป่า', 'person-hiking', 'sport', 'เดินป่า'],
    ['เกษตรกร', 'seedling', 'agri', 'ทำสวน ทำนา ยางพารา farmer'],
    ['นักเกษตรสมัยใหม่', 'tractor', 'agri', 'smart farm ฟาร์ม'],
    ['ชาวประมง', 'fish', 'agri', 'ประมง ทะเล'],
    ['ปศุสัตว์', 'cow', 'agri', 'เลี้ยงวัว ฟาร์ม'],
    ['นักวิชาการป่าไม้', 'tree', 'agri', 'ป่าไม้'],
    ['นักสิ่งแวดล้อม', 'recycle', 'agri', 'สิ่งแวดล้อม รีไซเคิล'],
    ['นักทรัพยากรน้ำ', 'water', 'agri', 'น้ำ'],
    ['นักปรับปรุงพันธุ์พืช', 'wheat-awn', 'agri', 'ข้าว พันธุ์พืช'],
    ['ช่างยนต์', 'screwdriver-wrench', 'trade', 'ช่าง mechanic ซ่อมรถ'],
    ['ช่างไฟฟ้า', 'plug', 'trade', 'ช่างไฟ'],
    ['ช่างประปา', 'faucet-drip', 'trade', 'ประปา'],
    ['ช่างไม้', 'hammer', 'trade', 'ไม้ เฟอร์นิเจอร์'],
    ['ช่างทาสี', 'paint-roller', 'trade', 'ทาสี'],
    ['ช่างตัดผม', 'scissors', 'trade', 'barber ช่างเสริมสวย'],
    ['คนขับรถ', 'car', 'trade', 'ขับรถ แท็กซี่'],
    ['ไรเดอร์', 'motorcycle', 'trade', 'ส่งอาหาร rider'],
    ['คนขับรถบรรทุก', 'truck', 'trade', 'ขนส่ง'],
    ['พี่เลี้ยงเด็ก', 'baby-carriage', 'trade', 'เลี้ยงเด็ก'],
    ['นักสังคมสงเคราะห์', 'hand-holding-heart', 'trade', 'จิตอาสา ช่วยเหลือ social'],
    ['นักพัฒนาชุมชน', 'people-roof', 'trade', 'ชุมชน'],
    ['อาสากู้ภัย', 'hand-holding-medical', 'trade', 'กู้ภัย มูลนิธิ']
  ];
  const CATS = [['all', 'ทั้งหมด'], ['health', 'สุขภาพ/การแพทย์'], ['sci', 'วิทยาศาสตร์'], ['tech', 'เทคโนโลยี/ดิจิทัล'], ['eng', 'วิศวกรรม/พลังงาน'], ['edu', 'การศึกษา/ภาษา'], ['faith', 'ศาสนา'], ['gov', 'ราชการ/กฎหมาย/ความปลอดภัย'], ['biz', 'ธุรกิจ/การเงิน'], ['art', 'สื่อ/ศิลปะ/บันเทิง'], ['svc', 'อาหาร/ท่องเที่ยว/บริการ'], ['sport', 'กีฬา'], ['agri', 'เกษตร/สิ่งแวดล้อม'], ['trade', 'ช่าง/อาชีพอิสระ/สังคม']];
  const iconHtml = (ic) => '<i class="' + (ic === 'youtube' ? 'fa-brands' : 'fa-solid') + ' fa-' + esc(ic || 'star') + '" aria-hidden="true"></i>';
  function match(text) {
    const t = String(text || '').trim().toLowerCase(); if (!t) return null;
    return C.find((c) => c[0].toLowerCase() === t) || C.find((c) => t.includes(c[0].toLowerCase()) || c[0].toLowerCase().includes(t)) || C.find((c) => c[3].toLowerCase().split(/\s+/).some((k) => k && (t.includes(k) || (k.length > 2 && k.includes(t))))) || null;
  }
  const S = { data: null, draft: null, cat: 'all', saving: false };
  const sid = () => { try { return currentStudent ? String(currentStudent.studentId).replace(/^0+/, '') : ''; } catch (e) { return ''; } };
  function cacheGet() { try { const c = JSON.parse(localStorage.getItem('k8_dream_' + sid()) || 'null'); return c; } catch (e) { return null; } }
  function paint() {
    const d = S.data || cacheGet() || { dream: '' };
    const has = !!d.dream; const ic = d.icon || (match(d.dream) || [0, 'star'])[1];
    const t = document.getElementById('k8DreamText'), w = document.getElementById('k8DreamWhy'), i = document.getElementById('k8DreamIco'), card = document.getElementById('k8DreamCard');
    if (t) t.textContent = has ? d.dream : 'ยังไม่ได้ระบุ';
    if (w) w.textContent = has ? (d.reason || 'แตะเพื่อเพิ่มเหตุผลหรือเป้าหมาย') : 'แตะเพื่อบอกอาชีพหรือสิ่งที่อยากเป็น';
    if (i) i.innerHTML = iconHtml(has ? ic : 'star');
    if (card) card.classList.toggle('is-empty', !has);
    const chip = document.getElementById('hfDream');
    if (chip) { chip.hidden = !has; if (has) { chip.innerHTML = iconHtml(ic) + '<span>' + esc(d.dream) + '</span>'; chip.setAttribute('aria-label', 'ความใฝ่ฝัน ' + d.dream + ' · แตะเพื่อแก้ไข'); } }
  }
  async function load() {
    if (!sid()) return;
    paint();
    const c = cacheGet();
    if (c && c.pending) { try { const r = await gasApiCall('saveMyDream', { data: { dream: c.dream, icon: c.icon, reason: c.reason } }, 20000); if (r && r.success) { S.data = r.dream; try { localStorage.setItem('k8_dream_' + sid(), JSON.stringify(r.dream)); } catch (e) {} paint(); return; } } catch (e) {} return; }
    try { const r = await gasApiCall('getMyDream', {}, 20000); if (r && r.success) { S.data = r.dream; try { localStorage.setItem('k8_dream_' + sid(), JSON.stringify(r.dream)); } catch (e) {} paint(); } } catch (e) {}
  }
  function renderEditor() {
    const body = document.getElementById('k8DreamBody'); if (!body) return;
    const d = S.draft; const m = match(d.dream); const ic = d.icon || (m ? m[1] : 'star');
    const q = String(d.dream || '').trim().toLowerCase();
    let list = C.filter((c) => S.cat === 'all' || c[2] === S.cat);
    if (q && S.cat === 'all') { const hit = list.filter((c) => (c[0] + ' ' + c[3]).toLowerCase().includes(q)); if (hit.length) list = hit.concat(list.filter((c) => hit.indexOf(c) === -1)); }
    body.innerHTML = '<div class="k8-dr-input"><span class="k8-dr-big">' + iconHtml(ic) + '</span><label><span>อาชีพหรือสิ่งที่อยากเป็น</span><input type="text" id="k8DrIn" maxlength="80" placeholder="เช่น แพทย์ โปรแกรมเมอร์ อุสตาซ" value="' + esc(d.dream) + '" oninput="k8DreamType(this)" autocomplete="off"></label></div>' +
      '<p class="k8-dr-hint">' + (d.dream ? (m ? 'ไอคอนจับคู่กับ "' + esc(m[0]) + '" · เลือกไอคอนอื่นจากรายการด้านล่างได้' : 'ไม่พบไอคอนที่ตรง ใช้ดาวแทน · เลือกจากรายการด้านล่างได้') : 'พิมพ์เอง หรือแตะเลือกจากอาชีพยอดนิยมด้านล่าง') + '</p>' +
      '<div class="k8-dr-cats" role="tablist">' + CATS.map(([k, l]) => '<button type="button" role="tab" aria-selected="' + (S.cat === k) + '" onclick="k8DreamCat(\'' + k + '\')">' + l + ' <small>' + (k === 'all' ? C.length : C.filter((c) => c[2] === k).length) + '</small></button>').join('') + '</div>' +
      '<div class="k8-dr-grid" id="k8DrGrid">' + gridHtml(list, d, q) + '</div>' +
      '<label class="k8-nf-f"><span>เหตุผลหรือเป้าหมาย (ไม่บังคับ)</span><textarea id="k8DrWhy" rows="2" maxlength="300" placeholder="เช่น อยากช่วยรักษาคนในชุมชน" oninput="k8DreamWhy(this.value)">' + esc(d.reason) + '</textarea></label>' +
      '<div class="k8-dr-btns">' + ((S.data && S.data.dream) ? '<button type="button" class="is-alt" onclick="k8DreamClear()">ลบความใฝ่ฝัน</button>' : '') + '<button type="button" ' + (S.saving ? 'disabled' : '') + ' onclick="k8DreamSave()">' + (S.saving ? 'กำลังบันทึก…' : 'บันทึก') + '</button></div>';
  }
  const card = (c, d) => '<button type="button" aria-pressed="' + (d.dream === c[0]) + '" onclick="k8DreamPick(\'' + js(c[0]) + '\',\'' + c[1] + '\')">' + iconHtml(c[1]) + '<span>' + esc(c[0]) + '</span></button>';
  // หมวด "ทั้งหมด": แสดงหัวข้อหมวดคั่น เพื่อให้เห็นว่ามีสายงานหลากหลาย
  function gridHtml(list, d, q) {
    if (S.cat !== 'all' || q) return list.map((c) => card(c, d)).join('');
    return CATS.slice(1).map(([k, l]) => { const items = C.filter((c) => c[2] === k); return '<h4 class="k8-dr-gh">' + esc(l) + ' <small>' + items.length + ' อาชีพ</small></h4>' + items.map((c) => card(c, d)).join(''); }).join('');
  }
  window.k8DreamEdit = function () {
    const d = S.data || cacheGet() || {};
    S.draft = { dream: d.dream || '', icon: d.icon || '', reason: d.reason || '' }; S.cat = 'all';
    renderEditor(); openModal('k8DreamModal');
  };
  let tt = null;
  window.k8DreamType = function (el) { S.draft.dream = el.value; S.draft.icon = ''; clearTimeout(tt); tt = setTimeout(() => { const pos = el.selectionStart; const why = document.getElementById('k8DrWhy'); if (why) S.draft.reason = why.value; renderEditor(); const n = document.getElementById('k8DrIn'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }, 220); };
  window.k8DreamWhy = function (v) { S.draft.reason = v; };
  window.k8DreamCat = function (k) { const why = document.getElementById('k8DrWhy'); if (why) S.draft.reason = why.value; S.cat = k; renderEditor(); };
  window.k8DreamPick = function (name, ic) { const why = document.getElementById('k8DrWhy'); if (why) S.draft.reason = why.value; S.draft.dream = name; S.draft.icon = ic; renderEditor(); };
  function saveLocal(d, pending) {
    S.data = Object.assign({}, d, { updatedAt: new Date().toISOString(), pending: !!pending });
    try { localStorage.setItem('k8_dream_' + sid(), JSON.stringify(S.data)); } catch (e) {}
  }
  async function save(d) {
    S.saving = true; renderEditor();
    try {
      let r = null;
      try { r = await gasApiCall('saveMyDream', { data: d }, 20000); }
      catch (netErr) { r = { success: false, offline: true }; }
      if (!r || !r.success) {
        // ระบบหลังบ้านยังไม่อัปเดต หรือออฟไลน์: เก็บไว้ในเครื่องก่อน แล้วส่งให้อัตโนมัติภายหลัง
        if (r && (r.offline || /Unknown action/i.test(String(r.error || r.message || '')))) {
          saveLocal(d, true); paint(); closeModal('k8DreamModal');
          if (typeof showToast === 'function') showToast('บันทึกในเครื่องแล้ว · จะส่งขึ้นระบบอัตโนมัติเมื่อเชื่อมต่อได้', 'info');
          S.saving = false; return;
        }
        throw new Error((r && (r.message || r.error)) || 'บันทึกไม่สำเร็จ');
      }
      S.data = r.dream; try { localStorage.setItem('k8_dream_' + sid(), JSON.stringify(r.dream)); } catch (e) {}
      paint(); closeModal('k8DreamModal'); if (typeof showToast === 'function') showToast(r.message, 'success');
    } catch (e) { if (typeof showToast === 'function') showToast(e.message, 'error'); }
    S.saving = false; if (document.getElementById('k8DreamModal').classList.contains('open')) renderEditor();
  }
  window.k8DreamSave = function () {
    const why = document.getElementById('k8DrWhy'); if (why) S.draft.reason = why.value;
    const d = S.draft; if (!String(d.dream || '').trim()) { if (typeof showToast === 'function') showToast('พิมพ์หรือเลือกอาชีพในฝันก่อน', 'warning'); return; }
    const clean = d.dream.trim().replace(/^(ฉัน|หนู|ผม)?\s*(อยากเป็น|อยากจะเป็น|ฝันอยากเป็น|อยากทำงานเป็น)\s*/, '').trim() || d.dream.trim();
    const m = match(clean); save({ dream: clean, icon: d.icon || (m ? m[1] : 'star'), reason: d.reason });
  };
  window.k8DreamClear = function () { save({ dream: '', icon: '', reason: '' }); };
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) { const r = sv.apply(this, arguments); if (v === 'profile' || v === 'dashboard') setTimeout(load, 0); return r; };
  if (document.readyState === 'complete') setTimeout(load, 600); else window.addEventListener('load', () => setTimeout(load, 600));
})();

/* ============ Round 16 · ตัวอ่านเอกสารในแอป: ซูม + ขีดเขียน (บันทึกเฉพาะเครื่อง) ============ */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t) => { if (typeof showToast === 'function') showToast(m, t); };
  const PENS = ['#0f172a', '#1d4ed8', '#dc2626', '#15803d', '#7c3aed', '#ea580c'];
  const HLS = ['#facc15', '#4ade80', '#f472b6', '#60a5fa', '#fb923c'];
  const SIZES = { pen: [0.0025, 0.0045, 0.008], hl: [0.012, 0.02, 0.03], eraser: [0.02, 0.035, 0.06] };
  const V = { open: false, file: null, bytes: null, kind: '', pages: [], ink: {}, undo: [], redo: [], tool: 'pan', color: PENS[1], hl: HLS[0], size: 1, zoom: 1, doc: null, img: null, penSeen: false, saveT: null, renderT: null };
  let pdfjs = null, PDFLib = null;

  // ---------- โหลดไลบรารีจากในแอปเอง (ไม่พึ่ง CDN) ----------
  async function loadPdfjs() {
    if (pdfjs) return pdfjs;
    pdfjs = await import(new URL('vendor/pdfjs/pdf.min.mjs', location.href).href);
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.min.mjs', location.href).href;
    return pdfjs;
  }
  function loadPdfLib() {
    if (PDFLib || window.PDFLib) return Promise.resolve(PDFLib = window.PDFLib);
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/pdf-lib/pdf-lib.min.js'; s.onload = () => res(PDFLib = window.PDFLib); s.onerror = () => rej(new Error('โหลดตัวสร้าง PDF ไม่สำเร็จ')); document.head.appendChild(s); });
  }
  // ---------- เก็บไฟล์ไว้ในเครื่อง (IndexedDB) เปิดซ้ำได้ทันที ----------
  function idb() { return new Promise((res, rej) => { const r = indexedDB.open('k8docs', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function idbGet(k) { try { const db = await idb(); return await new Promise((res) => { const q = db.transaction('files').objectStore('files').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch (e) { return null; } }
  async function idbPut(k, v) { try { const db = await idb(); db.transaction('files', 'readwrite').objectStore('files').put(v, k); } catch (e) {} }
  const inkKey = () => 'k8ink_' + V.file.id;
  function loadInk() { try { V.ink = JSON.parse(localStorage.getItem(inkKey()) || '{}') || {}; } catch (e) { V.ink = {}; } }
  function saveInk() {
    clearTimeout(V.saveT);
    V.saveT = setTimeout(() => {
      try { localStorage.setItem(inkKey(), JSON.stringify(V.ink)); flash('บันทึกแล้ว'); }
      catch (e) { flash('พื้นที่ในเครื่องเต็ม บันทึกไม่ได้'); }
    }, 250);
  }
  function flash(t) { const el = document.getElementById('k8PvSaved'); if (!el) return; el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 1200); }
  const b64ToBytes = (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

  // ---------- โครงหน้าจอ ----------
  function shell() {
    let el = document.getElementById('k8Pv'); if (el) return el;
    el = document.createElement('div'); el.id = 'k8Pv'; el.className = 'k8-pv'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML =
      '<header class="k8-docs-bar"><button type="button" class="k8-docs-back" onclick="k8PvBack()" aria-label="กลับ"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>' +
      '<div class="k8-docs-ttl"><h2 id="k8PvName">-</h2><span id="k8PvSub">-</span></div><span class="k8-pv-saved" id="k8PvSaved" aria-live="polite"></span>' +
      '<button type="button" class="k8-docs-icon" onclick="k8PvDlMenu()" aria-label="ดาวน์โหลด"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg></button></header>' +
      '<div class="k8-pv-scroll" id="k8PvScroll"><div class="k8-pv-pages" id="k8PvPages"></div></div>' +
      '<div class="k8-pv-tools" id="k8PvTools"></div>' +
      '<div class="k8-pv-menu" id="k8PvMenu" hidden><div class="k8-pv-menu-card"><b>ดาวน์โหลดไฟล์</b>' +
      '<button type="button" onclick="k8PvDownload(false)"><span>ไฟล์ต้นฉบับ</span><small>ไม่มีสิ่งที่ฉันขีดเขียน</small></button>' +
      '<button type="button" onclick="k8PvDownload(true)"><span>ไฟล์พร้อมที่ฉันขีดเขียน</span><small>รวมปากกาและไฮไลต์ไว้ในไฟล์</small></button>' +
      '<button type="button" class="is-alt" onclick="document.getElementById(\'k8PvMenu\').hidden=true">ยกเลิก</button></div></div>';
    document.body.appendChild(el);
    bindGestures(el.querySelector('#k8PvScroll'));
    return el;
  }
  function tools() {
    const t = document.getElementById('k8PvTools'); if (!t) return;
    const canInk = V.kind === 'pdf' || V.kind === 'image';
    const btn = (k, label, svgPath) => '<button type="button" class="k8-pv-t' + (V.tool === k ? ' on' : '') + '" onclick="k8PvTool(\'' + k + '\')" aria-pressed="' + (V.tool === k) + '" aria-label="' + label + '"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + svgPath + '</svg><span>' + label + '</span></button>';
    const colors = V.tool === 'hl' ? HLS : PENS; const cur = V.tool === 'hl' ? V.hl : V.color;
    t.innerHTML = '<div class="k8-pv-row">' +
      btn('pan', 'เลื่อน', '<path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>') +
      (canInk ? btn('pen', 'ปากกา', '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>') + btn('hl', 'ไฮไลต์', '<path d="m9 11-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>') + btn('eraser', 'ยางลบ', '<path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 19M22 21H7M5 11l9 9"/>') : '') +
      '<span class="k8-pv-sep"></span>' +
      '<button type="button" class="k8-pv-t" onclick="k8PvZoom(-1)" aria-label="ย่อ"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button><button type="button" class="k8-pv-zoom" onclick="k8PvZoomReset()" aria-label="ขนาดพอดีจอ">' + Math.round(V.zoom * 100) + '%</button><button type="button" class="k8-pv-t" onclick="k8PvZoom(1)" aria-label="ขยาย"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>' +
      '</div>' +
      (canInk && V.tool !== 'pan' ? '<div class="k8-pv-row k8-pv-sub">' +
        (V.tool !== 'eraser' ? colors.map((c) => '<button type="button" class="k8-pv-c' + (c === cur ? ' on' : '') + '" style="--c:' + c + '" onclick="k8PvColor(\'' + c + '\')" aria-label="สี ' + c + '"></button>').join('') + '<span class="k8-pv-sep"></span>' : '') +
        [0, 1, 2].map((i) => '<button type="button" class="k8-pv-s' + (V.size === i ? ' on' : '') + '" onclick="k8PvSize(' + i + ')" aria-label="ขนาด ' + (i + 1) + '"><i style="width:' + (6 + i * 5) + 'px;height:' + (6 + i * 5) + 'px"></i></button>').join('') +
        '<span class="k8-pv-sep"></span><button type="button" class="k8-pv-t" onclick="k8PvUndo()" aria-label="ย้อนกลับ" ' + (V.undo.length ? '' : 'disabled') + '><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg></button><button type="button" class="k8-pv-t" onclick="k8PvRedo()" aria-label="ทำซ้ำ" ' + (V.redo.length ? '' : 'disabled') + '><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg></button>' +
        '</div>' : '');
    const sc = document.getElementById('k8PvScroll'); if (sc) sc.dataset.tool = V.tool;
  }

  // ---------- เปิดไฟล์ ----------
  window.k8PvIsOpen = () => V.open;
  window.k8PvOpen = async function (f) {
    const el = shell(); el.hidden = false; V.open = true; V.file = f; V.undo = []; V.redo = []; V.zoom = 1; V.tool = 'pan'; V.pages = []; V.doc = null; V.img = null; V.bytes = null;
    try { history.pushState({ k8pv: 1 }, ''); } catch (e) {}
    document.getElementById('k8PvName').textContent = f.name; document.getElementById('k8PvSub').textContent = 'กำลังโหลดไฟล์…';
    document.getElementById('k8PvPages').innerHTML = '<div class="k8-pv-loading"><span class="k8-pv-spin" aria-hidden="true"></span>กำลังเปิดเอกสาร…</div>';
    loadInk(); tools();
    const key = f.id + '|' + (f.updated || '') + '|' + (f.size || '');
    let rec = await idbGet(key);
    if (!rec) {
      try {
        const r = await gasApiCall('getStudyFile', { fileId: f.id }, 120000);
        if (!r || !r.success) throw new Error((r && r.message) || 'เปิดไฟล์ไม่สำเร็จ');
        rec = { name: r.name, mime: r.mime, converted: r.converted, bytes: b64ToBytes(r.data) };
        idbPut(key, rec);
      } catch (e) {
        if (!V.open || V.file !== f) return;
        document.getElementById('k8PvSub').textContent = 'เปิดไม่สำเร็จ';
        document.getElementById('k8PvPages').innerHTML = '<div class="k8-docs-empty is-err"><b>เปิดไฟล์ไม่สำเร็จ</b><span>' + esc(e.message || '') + '</span><button type="button" onclick="k8PvRetry()">ลองอีกครั้ง</button></div>';
        return;
      }
    }
    if (!V.open || V.file !== f) return;
    V.bytes = rec.bytes; V.fileName = rec.name || f.name; V.mime = rec.mime;
    if (/pdf/.test(rec.mime)) await openPdf();
    else if (/^image\//.test(rec.mime)) await openImage();
    else {
      V.kind = 'other'; tools();
      document.getElementById('k8PvSub').textContent = 'เปิดดูในแอปไม่ได้ · ดาวน์โหลดได้';
      document.getElementById('k8PvPages').innerHTML = '<div class="k8-docs-empty"><b>ไฟล์ชนิดนี้แสดงในแอปไม่ได้</b><span>' + esc(V.fileName) + '</span><button type="button" onclick="k8PvDownload(false)">ดาวน์โหลดไฟล์</button></div>';
    }
  };
  window.k8PvRetry = function () { if (V.file) window.k8PvOpen(V.file); };
  async function openPdf() {
    V.kind = 'pdf'; tools();
    try {
      const lib = await loadPdfjs();
      V.doc = await lib.getDocument({ data: V.bytes.slice(0), cMapUrl: new URL('vendor/pdfjs/cmaps/', location.href).href, cMapPacked: true, standardFontDataUrl: new URL('vendor/pdfjs/standard_fonts/', location.href).href, wasmUrl: new URL('vendor/pdfjs/wasm/', location.href).href, isEvalSupported: false, enableScripting: false }).promise;
    } catch (e) {
      document.getElementById('k8PvPages').innerHTML = '<div class="k8-docs-empty is-err"><b>แสดงไฟล์ PDF ไม่สำเร็จ</b><span>' + esc(e.message || '') + '</span><button type="button" onclick="k8PvDownload(false)">ดาวน์โหลดไฟล์แทน</button></div>'; return;
    }
    const n = V.doc.numPages; const wrap = document.getElementById('k8PvPages'); wrap.innerHTML = '';
    document.getElementById('k8PvSub').textContent = n + ' หน้า · แตะ "ปากกา" เพื่อจดบนเอกสาร';
    for (let i = 1; i <= n; i++) {
      const page = await V.doc.getPage(i); const vp = page.getViewport({ scale: 1 });
      V.pages.push(makePage(i, vp.width, vp.height, page));
    }
    layout(); renderVisible();
  }
  async function openImage() {
    V.kind = 'image'; tools();
    const url = URL.createObjectURL(new Blob([V.bytes], { type: V.mime }));
    const img = new Image(); img.src = url; await img.decode().catch(() => {});
    V.img = img; const wrap = document.getElementById('k8PvPages'); wrap.innerHTML = '';
    document.getElementById('k8PvSub').textContent = 'รูปภาพ · แตะ "ปากกา" เพื่อจด';
    V.pages.push(makePage(1, img.naturalWidth || 800, img.naturalHeight || 600, null)); layout(); renderVisible();
  }
  function makePage(no, w, h, pdfPage) {
    const box = document.createElement('div'); box.className = 'k8-pv-page'; box.dataset.no = no;
    const c = document.createElement('canvas'); c.className = 'k8-pv-bg';
    const ink = document.createElement('canvas'); ink.className = 'k8-pv-ink';
    const lab = document.createElement('span'); lab.className = 'k8-pv-no'; lab.textContent = no;
    box.appendChild(c); box.appendChild(ink); box.appendChild(lab);
    document.getElementById('k8PvPages').appendChild(box);
    const p = { no, w, h, pdfPage, box, c, ink, renderedAt: 0 };
    bindDraw(p);
    return p;
  }
  function baseWidth() { const sc = document.getElementById('k8PvScroll'); return Math.max(240, Math.min(980, (sc ? sc.clientWidth : 360) - 24)); }
  function layout() {
    const bw = baseWidth() * V.zoom;
    V.pages.forEach((p) => { const cw = bw, ch = bw * p.h / p.w; p.cssW = cw; p.cssH = ch; p.box.style.width = cw + 'px'; p.box.style.height = ch + 'px'; });
    const z = document.querySelector('#k8PvTools .k8-pv-zoom'); if (z) z.textContent = Math.round(V.zoom * 100) + '%';
  }
  function renderVisible() {
    clearTimeout(V.renderT);
    V.renderT = setTimeout(async () => {
      const sc = document.getElementById('k8PvScroll'); if (!sc) return;
      const top = sc.scrollTop - 600, bottom = sc.scrollTop + sc.clientHeight + 600;
      for (const p of V.pages) {
        const y = p.box.offsetTop, yb = y + p.box.offsetHeight;
        const want = Math.round(p.cssW);
        if (yb < top || y > bottom) continue;
        drawInk(p);
        if (p.renderedAt === want || p.rendering) continue;
        p.rendering = true;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const pxW = Math.min(4096, Math.round(p.cssW * dpr)), scale = pxW / p.w;
        try {
          if (p.pdfPage) {
            const vp = p.pdfPage.getViewport({ scale });
            const off = document.createElement('canvas'); off.width = Math.round(vp.width); off.height = Math.round(vp.height);
            await p.pdfPage.render({ canvasContext: off.getContext('2d'), viewport: vp }).promise;
            p.c.width = off.width; p.c.height = off.height; p.c.getContext('2d').drawImage(off, 0, 0);
          } else if (V.img) {
            p.c.width = pxW; p.c.height = Math.round(pxW * p.h / p.w); p.c.getContext('2d').drawImage(V.img, 0, 0, p.c.width, p.c.height);
          }
          p.renderedAt = want;
        } catch (e) {}
        p.rendering = false;
      }
    }, 60);
  }
  // ---------- วาดเส้น ----------
  function strokePath(ctx, s, W, H) {
    const pts = s.p; if (!pts.length) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = s.c; ctx.lineWidth = Math.max(1, s.w * W);
    if (s.t === 'hl') { ctx.globalAlpha = 0.38; ctx.globalCompositeOperation = 'multiply'; ctx.lineCap = 'butt'; }
    ctx.beginPath(); ctx.moveTo(pts[0][0] * W, pts[0][1] * H);
    if (pts.length === 1) ctx.lineTo(pts[0][0] * W + 0.1, pts[0][1] * H + 0.1);
    for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2 * W, my = (pts[i][1] + pts[i + 1][1]) / 2 * H; ctx.quadraticCurveTo(pts[i][0] * W, pts[i][1] * H, mx, my); }
    if (pts.length > 1) { const l = pts[pts.length - 1]; ctx.lineTo(l[0] * W, l[1] * H); }
    ctx.stroke(); ctx.restore();
  }
  function drawInk(p, live) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(p.cssW * dpr), H = Math.round(p.cssH * dpr);
    if (p.ink.width !== W || p.ink.height !== H) { p.ink.width = W; p.ink.height = H; }
    const ctx = p.ink.getContext('2d'); ctx.clearRect(0, 0, W, H);
    (V.ink[p.no] || []).forEach((s) => strokePath(ctx, s, W, H));
    if (live) strokePath(ctx, live, W, H);
  }
  function bindDraw(p) {
    let cur = null, pid = null;
    const pos = (e) => { const r = p.ink.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
    p.ink.addEventListener('pointerdown', (e) => {
      if (V.tool === 'pan' || V.pinching) return;
      if (e.pointerType === 'pen') V.penSeen = true;
      if (e.pointerType === 'touch' && V.penSeen) return; // มีปากกาสไตลัส: นิ้วใช้เลื่อนหน้า
      if (V.touches > 1) return;
      e.preventDefault(); pid = e.pointerId; try { p.ink.setPointerCapture(pid); } catch (er) {}
      if (V.tool === 'eraser') { cur = { erase: true }; eraseAt(p, pos(e)); return; }
      cur = { t: V.tool, c: V.tool === 'hl' ? V.hl : V.color, w: SIZES[V.tool][V.size], p: [pos(e)] };
      drawInk(p, cur);
    });
    p.ink.addEventListener('pointermove', (e) => {
      if (!cur || e.pointerId !== pid) return;
      if (V.pinching) { cur = null; drawInk(p); return; }
      e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      if (cur.erase) { evs.forEach((ev) => eraseAt(p, pos(ev))); return; }
      evs.forEach((ev) => { const q = pos(ev); const l = cur.p[cur.p.length - 1]; if (Math.abs(q[0] - l[0]) + Math.abs(q[1] - l[1]) > 0.0012) cur.p.push(q); });
      if (cur.t === 'hl' && cur.p.length > 2) { /* ไฮไลต์ให้เส้นตรงตามแนวนอนอ่านง่าย */ }
      drawInk(p, cur);
    });
    const end = (e) => {
      if (!cur || e.pointerId !== pid) return;
      if (!cur.erase && !V.pinching) {
        cur.p = cur.p.map((q) => [Math.round(q[0] * 10000) / 10000, Math.round(q[1] * 10000) / 10000]);
        (V.ink[p.no] = V.ink[p.no] || []).push(cur); V.undo.push({ type: 'add', page: p.no, s: cur }); V.redo = []; saveInk(); tools();
      }
      cur = null; pid = null; drawInk(p);
    };
    p.ink.addEventListener('pointerup', end); p.ink.addEventListener('pointercancel', end);
  }
  function eraseAt(p, q) {
    const list = V.ink[p.no] || []; const r = SIZES.eraser[V.size]; const ar = p.h / p.w;
    const keep = [], gone = [];
    list.forEach((s) => { const hit = s.p.some((pt) => Math.hypot(pt[0] - q[0], (pt[1] - q[1]) * ar) < r + s.w / 2); (hit ? gone : keep).push(s); });
    if (gone.length) { V.ink[p.no] = keep; V.undo.push({ type: 'erase', page: p.no, list: gone }); V.redo = []; drawInk(p); saveInk(); tools(); }
  }
  window.k8PvUndo = function () { const a = V.undo.pop(); if (!a) return; const L = V.ink[a.page] = V.ink[a.page] || []; if (a.type === 'add') { const i = L.lastIndexOf(a.s); if (i !== -1) L.splice(i, 1); } else L.push(...a.list); V.redo.push(a); redrawAll(); saveInk(); tools(); };
  window.k8PvRedo = function () { const a = V.redo.pop(); if (!a) return; const L = V.ink[a.page] = V.ink[a.page] || []; if (a.type === 'add') L.push(a.s); else V.ink[a.page] = L.filter((s) => a.list.indexOf(s) === -1); V.undo.push(a); redrawAll(); saveInk(); tools(); };
  function redrawAll() { V.pages.forEach((p) => drawInk(p)); }
  window.k8PvTool = function (t) { V.tool = t; tools(); };
  window.k8PvColor = function (c) { if (V.tool === 'hl') V.hl = c; else V.color = c; tools(); };
  window.k8PvSize = function (i) { V.size = i; tools(); };

  // ---------- ซูม: ปุ่ม, ถ่างสองนิ้ว, Ctrl+ล้อเมาส์ ----------
  function setZoom(z, fx, fy) {
    const sc = document.getElementById('k8PvScroll'); const old = V.zoom; z = Math.max(0.5, Math.min(4, z)); if (Math.abs(z - old) < 0.001) return;
    const r = sc.getBoundingClientRect(); fx = fx == null ? sc.clientWidth / 2 : fx - r.left; fy = fy == null ? sc.clientHeight / 2 : fy - r.top;
    const cx = (sc.scrollLeft + fx) / old, cy = (sc.scrollTop + fy) / old;
    V.zoom = z; layout(); redrawAll();
    sc.scrollLeft = cx * z - fx; sc.scrollTop = cy * z - fy; renderVisible();
  }
  window.k8PvZoom = function (d) { setZoom(V.zoom * (d > 0 ? 1.25 : 0.8)); };
  window.k8PvZoomReset = function () { setZoom(1); };
  function bindGestures(sc) {
    const pts = new Map(); let start = null;
    sc.addEventListener('scroll', () => renderVisible(), { passive: true });
    sc.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return; pts.set(e.pointerId, [e.clientX, e.clientY]); V.touches = pts.size;
      if (pts.size === 2) { const [a, b] = Array.from(pts.values()); start = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: V.zoom }; V.pinching = true; }
    }, true);
    sc.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2 && start) { e.preventDefault(); const [a, b] = Array.from(pts.values()); const d = Math.hypot(a[0] - b[0], a[1] - b[1]); setZoom(start.z * d / start.d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    }, true);
    const up = (e) => { pts.delete(e.pointerId); V.touches = pts.size; if (pts.size < 2) { start = null; setTimeout(() => { if (pts.size < 2) V.pinching = false; }, 50); } };
    sc.addEventListener('pointerup', up, true); sc.addEventListener('pointercancel', up, true);
    sc.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); setZoom(V.zoom * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX, e.clientY); }, { passive: false });
    window.addEventListener('resize', () => { if (V.open) { layout(); redrawAll(); renderVisible(); } });
  }

  // ---------- ดาวน์โหลด 2 แบบ ----------
  window.k8PvDlMenu = function () { if (!V.bytes) return; const m = document.getElementById('k8PvMenu'); m.hidden = false; };
  function save(blob, name) {
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  window.k8PvDownload = async function (withInk) {
    document.getElementById('k8PvMenu').hidden = true;
    if (!V.bytes) return;
    const has = Object.keys(V.ink).some((k) => (V.ink[k] || []).length);
    if (!withInk || !has) { if (withInk && !has) toast('ยังไม่มีสิ่งที่ขีดเขียน จึงดาวน์โหลดไฟล์ต้นฉบับ', 'info'); save(new Blob([V.bytes], { type: V.mime || 'application/octet-stream' }), V.fileName); return; }
    try {
      if (V.kind === 'image') {
        const p = V.pages[0]; const c = document.createElement('canvas'); c.width = p.w; c.height = p.h; const ctx = c.getContext('2d'); ctx.drawImage(V.img, 0, 0, p.w, p.h);
        (V.ink[1] || []).forEach((s) => strokePath(ctx, s, p.w, p.h));
        c.toBlob((b) => save(b, V.fileName.replace(/\.[^.]+$/, '') + ' (โน้ตของฉัน).png'), 'image/png'); return;
      }
      toast('กำลังสร้างไฟล์พร้อมโน้ต…', 'info');
      const L = await loadPdfLib();
      const pdf = await L.PDFDocument.load(V.bytes.slice(0), { ignoreEncryption: true });
      const pages = pdf.getPages();
      pages.forEach((pg, i) => {
        const strokes = V.ink[i + 1] || []; if (!strokes.length) return;
        const { width: W, height: H } = pg.getSize();
        strokes.forEach((s) => {
          if (!s.p.length) return;
          let d = 'M ' + (s.p[0][0] * W).toFixed(2) + ' ' + (s.p[0][1] * H).toFixed(2);
          if (s.p.length === 1) d += ' L ' + (s.p[0][0] * W + 0.2).toFixed(2) + ' ' + (s.p[0][1] * H + 0.2).toFixed(2);
          for (let k = 1; k < s.p.length; k++) d += ' L ' + (s.p[k][0] * W).toFixed(2) + ' ' + (s.p[k][1] * H).toFixed(2);
          const [r, g, b] = hexRgb(s.c);
          const opt = { x: 0, y: H, borderColor: L.rgb(r, g, b), borderWidth: Math.max(0.5, s.w * W), borderOpacity: s.t === 'hl' ? 0.38 : 1, borderLineCap: s.t === 'hl' ? L.LineCapStyle.Butt : L.LineCapStyle.Round };
          if (s.t === 'hl' && L.BlendMode) opt.blendMode = L.BlendMode.Multiply;
          pg.drawSvgPath(d, opt);
        });
      });
      const out = await pdf.save();
      save(new Blob([out], { type: 'application/pdf' }), V.fileName.replace(/\.pdf$/i, '') + ' (โน้ตของฉัน).pdf');
    } catch (e) { toast('สร้างไฟล์พร้อมโน้ตไม่สำเร็จ: ' + (e.message || ''), 'error'); }
  };

  // ---------- ปิด / ปุ่มย้อนกลับของมือถือ ----------
  function close() { const el = document.getElementById('k8Pv'); if (el) el.hidden = true; V.open = false; V.doc = null; V.pages = []; V.bytes = null; const w = document.getElementById('k8PvPages'); if (w) w.innerHTML = ''; }
  window.k8PvBack = function () { history.back(); };
  window.addEventListener('popstate', () => {
    const m = document.getElementById('k8PvMenu'); if (m && !m.hidden) { m.hidden = true; }
    if (V.open) close();
  });
  document.addEventListener('keydown', (e) => { if (!V.open) return; if (e.key === 'Escape') history.back(); if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? window.k8PvRedo() : window.k8PvUndo(); } });
})();

/* ============ Round 17 · หะละเกาะฮฺอัลกุรอาน (สแกน QR + ประวัติ + จัดการโดยอาจารย์/แอดมิน) ============ */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const js = (v) => String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const api = (a, p, t) => gasApiCall(a, p || {}, t || 25000);
  const toast = (m, t) => { if (typeof showToast === 'function') showToast(m, t); };
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const fmtD = (s) => { const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? s : DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; };
  const SLOTS = [['subuh', 'หลังศุบฮิ'], ['zuhur', 'หลังซุฮริ'], ['asr', 'หลังอัศริ'], ['maghrib', 'หลังมัฆริบ'], ['isha', 'หลังอิชาอ์'], ['other', 'ช่วงเวลาอื่น']];
  const ST = { present: ['มาแล้ว', '#15803d', '#dcfce7'], late: ['มาสาย', '#b45309', '#fef3c7'], excused: ['ลา', '#1d4ed8', '#dbeafe'], absent: ['ขาด', '#b91c1c', '#fee2e2'] };
  const toMin = (t) => { const m = String(t || '').match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : -1; };

  // ================= นักเรียน: แท็บหะละเกาะฮฺในหน้ากิจกรรม =================
  let hqOn = false; let my = null;
  try { my = JSON.parse(localStorage.getItem('k8_hq_my') || 'null'); } catch (e) {}
  function setTabs() { document.querySelectorAll('#k8ActTabs button').forEach((b) => { const on = hqOn ? b.dataset.tab === 'halaqah' : b.classList.contains('on') && b.dataset.tab !== 'halaqah'; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }); }
  function studentHtml() {
    if (!my) return '<div class="k8-li-empty">กำลังโหลดหะละเกาะฮฺ…</div>';
    const now = new Date(); const today = ymd(now), wd = String(now.getDay()), nowMin = now.getHours() * 60 + now.getMinutes();
    const todays = (my.sessions || []).filter((s) => s.days.indexOf(wd) !== -1).sort((a, b) => toMin(a.start) - toMin(b.start));
    const logT = {}; (my.logs || []).forEach((l) => { if (l.date === today) logT[l.sessionId] = l; });
    // สถิติเดือนนี้: ครั้งที่ควรเข้า (วันที่ผ่านมาแล้วตามตาราง) เทียบกับที่บันทึกไว้
    const first = new Date(now.getFullYear(), now.getMonth(), 1); let expected = 0;
    for (let d = new Date(first); d <= now; d.setDate(d.getDate() + 1)) {
      const k = String(d.getDay()), ds = ymd(d);
      (my.sessions || []).forEach((s) => { if (s.days.indexOf(k) !== -1 && (!s.createdAt || ds >= s.createdAt) && (ds < today || toMin(s.end) < nowMin)) expected++; });
    }
    const monthLogs = (my.logs || []).filter((l) => l.date >= ymd(first));
    const came = monthLogs.filter((l) => l.status === 'present' || l.status === 'late').length, excused = monthLogs.filter((l) => l.status === 'excused').length;
    const pct = expected ? Math.min(100, Math.round(came / Math.max(1, expected - excused) * 100)) : 0;
    let h = '<div class="k8-hq-stu">';
    h += '<section class="k8-hq-sum"><div><b>' + came + '</b><span>ครั้งที่เข้าเดือนนี้</span></div><div><b>' + (expected ? pct + '%' : '–') + '</b><span>ความสม่ำเสมอ</span></div><div><b>' + monthLogs.filter((l) => l.status === 'late').length + '</b><span>มาสาย</span></div></section>';
    h += '<h3 class="k8-hq-h">วันนี้ · ' + fmtD(today) + '</h3>';
    if (!todays.length) h += '<div class="k8-li-empty">วันนี้ไม่มีหะละเกาะฮฺตามตาราง</div>';
    else h += '<ul class="k8-hq-today">' + todays.map((s) => {
      const l = logT[s.id]; const sMin = toMin(s.start), eMin = toMin(s.end);
      let chip;
      if (l) chip = '<span class="k8-hq-chip" style="color:' + ST[l.status][1] + ';background:' + ST[l.status][2] + '">' + ST[l.status][0] + (l.time ? ' ' + esc(l.time) : '') + '</span>';
      else if (nowMin >= sMin - 20 && nowMin <= eMin + 10) chip = '<button type="button" class="k8-hq-scan" onclick="k8StartActScan()">สแกนเข้า</button>';
      else if (nowMin < sMin - 20) chip = '<span class="k8-hq-chip is-wait">ยังไม่ถึงเวลา</span>';
      else chip = '<span class="k8-hq-chip" style="color:#b91c1c;background:#fee2e2">ไม่ได้เข้า</span>';
      return '<li><span class="k8-hq-time"><b>' + esc(s.start) + '</b><small>' + esc(s.end) + '</small></span><span class="k8-hq-main"><b>' + esc(s.name) + '</b><small>' + esc([s.location, s.teacherName].filter(Boolean).join(' · ') || 'หะละเกาะฮฺอัลกุรอาน') + '</small></span>' + chip + '</li>';
    }).join('') + '</ul>';
    h += '<p class="k8-hq-tip">สแกน QR ที่อาจารย์ผู้ดูแลเปิดให้ ตั้งแต่ 20 นาทีก่อนเริ่มจนถึง 10 นาทีหลังจบ · สแกนหลังเริ่มเกิน 15 นาทีนับเป็นมาสาย</p>';
    const hist = (my.logs || []).slice(0, 40);
    h += '<h3 class="k8-hq-h">ประวัติการเข้าหะละเกาะฮฺ</h3>';
    h += hist.length ? '<ul class="k8-hq-hist">' + hist.map((l) => '<li><span class="k8-hq-d">' + fmtD(l.date) + '</span><span class="k8-hq-main"><b>' + esc(l.sessionName) + '</b><small>' + (l.time ? 'เวลา ' + esc(l.time) + ' · ' : '') + (l.method === 'qr' ? 'สแกน QR' : 'อาจารย์บันทึก') + '</small></span><span class="k8-hq-chip" style="color:' + (ST[l.status] || ST.present)[1] + ';background:' + (ST[l.status] || ST.present)[2] + '">' + (ST[l.status] || ST.present)[0] + '</span></li>').join('') + '</ul>' : '<div class="k8-li-empty">ยังไม่มีประวัติ · สแกน QR ครั้งแรกเมื่อเข้าหะละเกาะฮฺ</div>';
    return h + '</div>';
  }
  function paintStudent() { if (!hqOn) return; const box = document.getElementById('k8ActList'); if (box) box.innerHTML = studentHtml(); setTabs(); }
  async function loadMine() {
    try { const r = await api('getMyHalaqah'); if (r && r.success) { my = r; try { localStorage.setItem('k8_hq_my', JSON.stringify({ sessions: r.sessions, logs: r.logs })); } catch (e) {} } } catch (e) {}
    paintStudent();
  }
  window.k8HqTab = function () { hqOn = true; paintStudent(); loadMine(); };
  const oTab = window.k8ActTab; window.k8ActTab = function (t) { hqOn = false; const r = oTab ? oTab.apply(this, arguments) : null; setTabs(); return r; };
  const oRender = window.renderActivitiesV8; if (typeof oRender === 'function') window.renderActivitiesV8 = function () { if (hqOn) { paintStudent(); return; } return oRender.apply(this, arguments); };
  // สแกน QR หะละเกาะฮฺด้วยกล้องเดียวกับกิจกรรม
  const oQr = window.handleQrCodeDetected;
  if (typeof oQr === 'function') window.handleQrCodeDetected = async function (data) {
    if (String(data || '').indexOf('KHALIFAH_HLQ:') !== 0) return oQr.apply(this, arguments);
    try { if (typeof stopQrScanner === 'function') stopQrScanner(); } catch (e) {}
    try { if (window.k8StopActScan) window.k8StopActScan(); } catch (e) {}
    hqOn = true; paintStudent();
    try {
      const r = await api('halaqahCheckIn', { qr: String(data) });
      if (r && r.success) { toast(r.message, r.already ? 'info' : 'success'); try { if (navigator.vibrate) navigator.vibrate([30, 40, 30]); } catch (e) {} }
      else toast((r && r.message) || 'บันทึกไม่สำเร็จ', 'error');
    } catch (e) { toast('เชื่อมต่อไม่สำเร็จ ลองสแกนใหม่อีกครั้ง', 'error'); }
    loadMine();
  };
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) { if (v === 'activities') hqOn = false; const r = sv.apply(this, arguments); if (H.open) closeHq(); return r; };

  // ================= อาจารย์/แอดมิน: จัดการหะละเกาะฮฺ =================
  const H = { open: false, view: 'list', sessions: [], edit: null, cur: null, date: ymd(new Date()), roster: null, marks: {}, qrTimer: null, clockTimer: null, saving: false };
  function stack(tag) { try { history.pushState({ k8hq: tag }, ''); } catch (e) {} }
  window.k8HqOpen = async function () {
    const el = document.getElementById('k8Hq'); if (!el) return;
    el.hidden = false; H.open = true; H.view = 'list'; document.documentElement.classList.add('k8-docs-open'); stack('list');
    render(); await loadSessions(); render();
  };
  async function loadSessions() { try { const r = await api('getHalaqahSessions'); if (r && r.success) H.sessions = r.sessions || []; } catch (e) {} }
  function stopTimers() { clearInterval(H.qrTimer); clearInterval(H.clockTimer); H.qrTimer = H.clockTimer = null; }
  function closeHq() { stopTimers(); const el = document.getElementById('k8Hq'); if (el) el.hidden = true; H.open = false; document.documentElement.classList.remove('k8-docs-open'); }
  window.k8HqBack = function () { history.back(); };
  window.addEventListener('popstate', () => {
    if (!H.open) return;
    if (H.view !== 'list') { stopTimers(); H.view = 'list'; render(); loadSessions().then(render); return; }
    closeHq();
  });
  const slotName = (k) => (SLOTS.find((x) => x[0] === k) || SLOTS[5])[1];
  function render() {
    const body = document.getElementById('k8HqBody'); if (!body) return;
    const sub = document.getElementById('k8HqSub'), title = document.getElementById('k8HqTitle');
    if (H.view === 'list') {
      title.textContent = 'หะละเกาะฮฺอัลกุรอาน'; sub.textContent = H.sessions.length + ' รอบ · ตั้งเวลา แสดง QR และเช็ครายชื่อ';
      const wd = String(new Date().getDay());
      body.innerHTML = '<button type="button" class="k8-hq-add" onclick="k8HqEdit()">+ เพิ่มหะละเกาะฮฺ</button>' +
        (H.sessions.length ? '<ul class="k8-hq-list">' + H.sessions.slice().sort((a, b) => toMin(a.start) - toMin(b.start)).map((s) => '<li><div class="k8-hq-li-top"><span class="k8-hq-slot">' + esc(slotName(s.slot)) + '</span>' + (s.days.indexOf(wd) !== -1 ? '<span class="k8-hq-chip" style="color:#047857;background:#d1fae5">มีวันนี้</span>' : '') + '</div><b>' + esc(s.name) + '</b><small>' + esc(s.start) + '–' + esc(s.end) + ' · ' + (s.days.length === 7 ? 'ทุกวัน' : s.days.map((d) => DAYS[+d]).join(' ')) + ' · ' + (s.grades.length ? s.grades.map((g) => 'ม.' + g).join(', ') : 'ทุกชั้น') + (s.location ? ' · ' + esc(s.location) : '') + '</small>' +
          '<div class="k8-hq-acts"><button type="button" class="is-pri" onclick="k8HqQr(\'' + js(s.id) + '\')">แสดง QR</button><button type="button" onclick="k8HqRoster(\'' + js(s.id) + '\')">เช็ครายชื่อ</button><button type="button" onclick="k8HqEdit(\'' + js(s.id) + '\')">แก้ไข</button></div></li>').join('') + '</ul>'
          : '<div class="k8-docs-empty"><b>ยังไม่มีหะละเกาะฮฺ</b><span>เพิ่มรอบแรก เช่น หะละเกาะฮฺหลังศุบฮิ 05:30–06:30 ทุกวัน</span></div>');
    } else if (H.view === 'edit') {
      const e = H.edit; title.textContent = e.id ? 'แก้ไขหะละเกาะฮฺ' : 'เพิ่มหะละเกาะฮฺ'; sub.textContent = 'กำหนดช่วงเวลา วัน และชั้นที่เข้าร่วม';
      body.innerHTML = '<section class="k8-bh-card">' +
        '<div class="k8-nf-f"><span>ช่วงเวลา</span><div class="k8-na-aud">' + SLOTS.map(([k, l]) => '<button type="button" aria-pressed="' + (e.slot === k) + '" onclick="k8HqSet(\'slot\',\'' + k + '\')">' + l + '</button>').join('') + '</div></div>' +
        '<label class="k8-nf-f"><span>ชื่อ</span><input type="text" id="k8HqName" maxlength="80" value="' + esc(e.name) + '" placeholder="เช่น หะละเกาะฮฺหลังศุบฮิ"></label>' +
        '<div class="k8-hq-times"><label class="k8-nf-f"><span>เริ่ม</span><input type="time" id="k8HqStart" value="' + esc(e.start) + '"></label><label class="k8-nf-f"><span>สิ้นสุด</span><input type="time" id="k8HqEnd" value="' + esc(e.end) + '"></label></div>' +
        '<div class="k8-nf-f"><span>วัน</span><div class="k8-na-chips">' + DAYS.map((d, i) => '<button type="button" aria-pressed="' + (e.days.indexOf(String(i)) !== -1) + '" onclick="k8HqDay(\'' + i + '\')">' + d + '</button>').join('') + '<button type="button" onclick="k8HqDay(\'all\')">ทุกวัน</button></div></div>' +
        '<div class="k8-nf-f"><span>ชั้นที่เข้าร่วม (ไม่เลือก = ทุกชั้น)</span><div class="k8-na-chips">' + ['1', '2', '3', '4', '5', '6'].map((g) => '<button type="button" aria-pressed="' + (e.grades.indexOf(g) !== -1) + '" onclick="k8HqGrade(\'' + g + '\')">ม.' + g + '</button>').join('') + '</div></div>' +
        '<label class="k8-nf-f"><span>สถานที่ (ไม่บังคับ)</span><input type="text" id="k8HqLoc" maxlength="80" value="' + esc(e.location) + '" placeholder="เช่น มัสยิด ชั้น 2"></label>' +
        '<div class="k8-dr-btns">' + (e.id ? '<button type="button" class="is-alt" onclick="k8HqDelete()">ลบ</button>' : '') + '<button type="button" class="k8-hq-save" ' + (H.saving ? 'disabled' : '') + ' onclick="k8HqSave()">' + (H.saving ? 'กำลังบันทึก…' : 'บันทึก') + '</button></div></section>';
    } else if (H.view === 'qr') {
      const s = H.cur; title.textContent = s.name; sub.textContent = s.start + '–' + s.end + ' · ' + fmtD(H.date);
      const n = H.roster ? H.roster.students.filter((x) => x.status === 'present' || x.status === 'late').length : 0, total = H.roster ? H.roster.students.length : 0;
      body.innerHTML = '<section class="k8-hq-qr"><div class="k8-hq-qrbox" id="k8HqQrBox" aria-label="QR สำหรับสแกนเข้าหะละเกาะฮฺ"></div><b class="k8-hq-clock" id="k8HqClock"></b><p>ให้นักเรียนเปิดแอป › กิจกรรม › สแกน QR</p><div class="k8-hq-count"><b>' + n + '</b> / ' + total + ' คน สแกนแล้ว</div>' +
        '<ul class="k8-hq-recent">' + (H.roster ? H.roster.students.filter((x) => x.status).sort((a, b) => String(b.time).localeCompare(String(a.time))).slice(0, 8).map((x) => '<li><span>' + esc(x.fullName) + '</span><span class="k8-hq-chip" style="color:' + ST[x.status][1] + ';background:' + ST[x.status][2] + '">' + ST[x.status][0] + ' ' + esc(x.time) + '</span></li>').join('') : '') + '</ul>' +
        '<button type="button" class="k8-bh-link" onclick="k8HqRoster(\'' + js(s.id) + '\')">เช็ครายชื่อ / บันทึกเอง</button></section>';
      drawQr();
    } else if (H.view === 'roster') {
      const s = H.cur; title.textContent = 'เช็ครายชื่อ · ' + s.name; sub.textContent = s.start + '–' + s.end;
      const R = H.roster; const list = R ? R.students : [];
      const cnt = { present: 0, late: 0, excused: 0, absent: 0, none: 0 };
      list.forEach((x) => { const st = H.marks[x.studentId] || x.status; cnt[st || 'none']++; });
      const dirty = Object.keys(H.marks).length;
      body.innerHTML = '<div class="k8-bh-filter"><label class="k8-nf-f" style="flex:1"><span>วันที่</span><input type="date" value="' + H.date + '" max="' + ymd(new Date()) + '" onchange="k8HqDate(this.value)"></label></div>' +
        '<div class="k8-hq-sum k8-hq-sum5"><div style="color:#15803d"><b>' + cnt.present + '</b><span>มา</span></div><div style="color:#b45309"><b>' + cnt.late + '</b><span>สาย</span></div><div style="color:#1d4ed8"><b>' + cnt.excused + '</b><span>ลา</span></div><div style="color:#b91c1c"><b>' + cnt.absent + '</b><span>ขาด</span></div><div style="color:#64748b"><b>' + cnt.none + '</b><span>ยังไม่บันทึก</span></div></div>' +
        (list.length && cnt.none ? '<button type="button" class="k8-bh-link" onclick="k8HqRest(\'absent\')">ตั้งคนที่ยังไม่บันทึกเป็น "ขาด" (' + cnt.none + ' คน)</button>' : '') +
        '<ul class="k8-hq-roster">' + (R ? list.map((x) => { const st = H.marks[x.studentId] || x.status; return '<li><span class="k8-hq-main"><b>' + esc(x.fullName) + '</b><small>' + esc(String(x.grade).replace('มัธยมศึกษาปีที่ ', 'ม.')) + (x.time && !H.marks[x.studentId] ? ' · ' + (x.method === 'qr' ? 'สแกน ' : '') + esc(x.time) : '') + '</small></span><span class="k8-hq-opts">' + Object.keys(ST).map((k) => '<button type="button" aria-pressed="' + (st === k) + '" style="--c:' + ST[k][1] + ';--bg:' + ST[k][2] + '" onclick="k8HqMark(\'' + js(x.studentId) + '\',\'' + k + '\')">' + ST[k][0].replace('แล้ว', '') + '</button>').join('') + '</span></li>'; }).join('') : '<li class="k8-bh-empty">กำลังโหลด…</li>') + '</ul>' +
        '<button type="button" class="k8-bh-go k8-hq-save" ' + (dirty && !H.saving ? '' : 'disabled') + ' onclick="k8HqSaveMarks()">' + (H.saving ? 'กำลังบันทึก…' : dirty ? 'บันทึก (' + dirty + ' คน)' : 'ไม่มีการเปลี่ยนแปลง') + '</button>';
    }
  }
  window.k8HqEdit = function (id) {
    const s = id ? H.sessions.find((x) => x.id === id) : null;
    H.edit = s ? JSON.parse(JSON.stringify(s)) : { id: '', name: 'หะละเกาะฮฺหลังศุบฮิ', slot: 'subuh', start: '05:30', end: '06:30', days: ['0', '1', '2', '3', '4', '5', '6'], grades: [], location: '' };
    H.view = 'edit'; stack('edit'); render();
  };
  function grab() { const e = H.edit; if (!e) return; const g = (id) => (document.getElementById(id) || {}).value; e.name = g('k8HqName') ?? e.name; e.start = g('k8HqStart') ?? e.start; e.end = g('k8HqEnd') ?? e.end; e.location = g('k8HqLoc') ?? e.location; }
  window.k8HqSet = function (k, v) { grab(); const e = H.edit; const was = slotName(e.slot); e[k] = v; if (k === 'slot' && (!e.name || e.name === 'หะละเกาะฮฺ' + was)) e.name = 'หะละเกาะฮฺ' + slotName(v); render(); };
  window.k8HqDay = function (d) { grab(); const e = H.edit; if (d === 'all') e.days = e.days.length === 7 ? [] : ['0', '1', '2', '3', '4', '5', '6']; else { const i = e.days.indexOf(d); if (i === -1) e.days.push(d); else e.days.splice(i, 1); } render(); };
  window.k8HqGrade = function (g) { grab(); const e = H.edit; const i = e.grades.indexOf(g); if (i === -1) e.grades.push(g); else e.grades.splice(i, 1); render(); };
  window.k8HqSave = async function () {
    grab(); H.saving = true; render();
    try { const r = await api('saveHalaqahSession', { data: H.edit }); if (!r || !r.success) throw new Error((r && r.message) || 'บันทึกไม่สำเร็จ'); toast(r.message, 'success'); H.saving = false; history.back(); }
    catch (e) { H.saving = false; toast(e.message, 'error'); render(); }
  };
  window.k8HqDelete = async function () {
    if (!window.confirm('ลบหะละเกาะฮฺ "' + H.edit.name + '"? ประวัติการเข้าที่บันทึกไว้ยังเก็บไว้ใน Google Sheets')) return;
    try { const r = await api('deleteHalaqahSession', { data: { id: H.edit.id } }); if (!r || !r.success) throw new Error((r && r.message) || 'ลบไม่สำเร็จ'); toast(r.message, 'success'); history.back(); } catch (e) { toast(e.message, 'error'); }
  };
  async function loadRoster() { try { const r = await api('getHalaqahRoster', { id: H.cur.id, date: H.date }); if (r && r.success) H.roster = r; } catch (e) {} if (H.open && (H.view === 'qr' || H.view === 'roster')) render(); }
  let qrText = '';
  async function drawQr() {
    const box = document.getElementById('k8HqQrBox'); if (!box) return;
    if (!qrText) { box.innerHTML = '<span class="k8-pv-spin"></span>'; return; }
    box.innerHTML = '';
    try { new QRCode(box, { text: qrText, width: 260, height: 260, correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : undefined }); }
    catch (e) { box.innerHTML = '<p class="k8-hq-tip">แสดง QR ไม่ได้ในอุปกรณ์นี้</p>'; }
    const tick = () => { const c = document.getElementById('k8HqClock'); if (c) { const d = new Date(); c.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); } };
    tick(); clearInterval(H.clockTimer); H.clockTimer = setInterval(tick, 1000);
  }
  window.k8HqQr = async function (id) {
    H.cur = H.sessions.find((x) => x.id === id); if (!H.cur) return;
    H.date = ymd(new Date()); H.view = 'qr'; H.roster = null; qrText = ''; stack('qr'); render();
    try { const r = await api('getHalaqahQr', { id }); if (!r || !r.success) throw new Error((r && r.message) || 'สร้าง QR ไม่สำเร็จ'); qrText = r.qr; } catch (e) { toast(e.message, 'error'); }
    render(); loadRoster();
    clearInterval(H.qrTimer); H.qrTimer = setInterval(() => { if (!document.hidden && H.view === 'qr') { if (ymd(new Date()) !== H.date) { k8HqQr(id); return; } loadRoster(); } }, 8000);
  };
  window.k8HqRoster = function (id) {
    H.cur = H.sessions.find((x) => x.id === id) || H.cur; if (!H.cur) return;
    stopTimers(); H.view = 'roster'; H.marks = {}; H.roster = null; stack('roster'); render(); loadRoster();
  };
  window.k8HqDate = function (v) { if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return; H.date = v; H.marks = {}; H.roster = null; render(); loadRoster(); };
  window.k8HqMark = function (sid, st) { const x = H.roster && H.roster.students.find((s) => s.studentId === sid); if (x && x.status === st) delete H.marks[sid]; else H.marks[sid] = st; render(); };
  window.k8HqRest = function (st) { (H.roster ? H.roster.students : []).forEach((x) => { if (!x.status && !H.marks[x.studentId]) H.marks[x.studentId] = st; }); render(); };
  window.k8HqSaveMarks = async function () {
    H.saving = true; render();
    try { const r = await api('markHalaqah', { data: { id: H.cur.id, date: H.date, marks: H.marks } }, 45000); if (!r || !r.success) throw new Error((r && r.message) || 'บันทึกไม่สำเร็จ'); toast(r.message, 'success'); H.marks = {}; }
    catch (e) { toast(e.message, 'error'); }
    H.saving = false; render(); loadRoster();
  };
})();

/* ============ Round 18 · หน้าแรก: ปฏิทินโรงเรียนแบบสัปดาห์นี้ (แบบ 3A) ============ */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const W = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
  const WF = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
  const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  function events() { let evs = []; try { evs = getVisibleCalendarEvents() || []; } catch (e) { try { evs = calendarEvents || []; } catch (e2) {} } return evs.filter((e) => e && e.startDate); }
  const onDay = (e, ds) => { const s = String(e.startDate).slice(0, 10), en = String(e.endDate || e.startDate).slice(0, 10); return s <= ds && ds <= en; };
  function render() {
    const box = document.getElementById('hfWeekDays'); if (!box) return;
    const now = new Date(); const today = ymd(now);
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const evs = events();
    let h = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i); const ds = ymd(d);
      const list = evs.filter((e) => onDay(e, ds));
      const label = WF[d.getDay()] + ' ' + d.getDate() + ' ' + M[d.getMonth()] + (list.length ? ' · ' + list.map((e) => e.title).join(', ') : ' · ไม่มีกิจกรรม');
      h += '<button type="button" class="hf-wd' + (ds === today ? ' is-today' : '') + (ds < today ? ' is-past' : '') + '" onclick="openSchoolCalendarModal()" aria-label="' + esc(label) + '" title="' + esc(label) + '"><span>' + W[i] + '</span><b>' + d.getDate() + '</b><i' + (list.length ? '' : ' class="none"') + '></i></button>';
    }
    box.innerHTML = h;
    // เรื่องถัดไป + นับวัน
    const up = evs.filter((e) => String(e.endDate || e.startDate).slice(0, 10) >= today).sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
    const next = document.getElementById('hfWeekNext');
    if (!next) return;
    if (!up.length) { next.classList.add('is-empty'); next.innerHTML = '<span>ยังไม่มีกิจกรรมที่กำลังจะมาถึง · ดูปฏิทินทั้งเดือน</span>'; return; }
    next.classList.remove('is-empty');
    const e = up[0]; const sd = String(e.startDate).slice(0, 10); const d0 = new Date(sd + 'T00:00:00');
    const days = Math.round((new Date(sd + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
    const chip = days <= 0 ? 'วันนี้' : days === 1 ? 'พรุ่งนี้' : 'อีก ' + days + ' วัน';
    const second = up[1] ? (() => { const d2 = new Date(String(up[1].startDate).slice(0, 10) + 'T00:00:00'); return '+ ' + up[1].title + ' ' + WF[d2.getDay()] + ' ' + d2.getDate() + ' ' + M[d2.getMonth()]; })() : '';
    next.innerHTML = '<span class="hf-wn-chip' + (days <= 0 ? ' is-now' : '') + '">' + chip + '</span><span class="hf-wn-txt"><b>' + esc(WF[d0.getDay()] + ' ' + d0.getDate() + ' ' + M[d0.getMonth()] + ' · ' + (e.title || 'กิจกรรม')) + '</b>' + (second ? '<small>' + esc(second) + '</small>' : '') + '</span>';
  }
  const o = window.renderHomeF;
  if (typeof o === 'function') window.renderHomeF = function () { const r = o.apply(this, arguments); try { render(); } catch (e) {} return r; };
  ['renderCalendar', 'syncAllDataFromCloud'].forEach((fn) => { const f = window[fn]; if (typeof f === 'function') window[fn] = function () { const r = f.apply(this, arguments); try { Promise.resolve(r).then(() => setTimeout(render, 0)); } catch (e) {} return r; }; });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
  setInterval(() => { if (!document.hidden) render(); }, 60000);
})();

/* ---- ล็อกการเลื่อนหน้าหลังเมื่อเปิดหน้าต่าง (ไม่ให้พื้นหลังเลื่อนตาม) ---- */
(function () {
  function sync() { document.documentElement.classList.toggle('k8-modal-open', !!document.querySelector('.modal-overlay.open')); }
  ['openModal', 'closeModal'].forEach((fn) => { const f = window[fn]; if (typeof f === 'function') window[fn] = function () { const r = f.apply(this, arguments); setTimeout(sync, 0); return r; }; });
  if ('MutationObserver' in window) {
    const start = () => document.querySelectorAll('.modal-overlay').forEach((m) => new MutationObserver(sync).observe(m, { attributes: true, attributeFilter: ['class'] }));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
})();
