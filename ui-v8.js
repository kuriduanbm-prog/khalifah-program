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
      // v17.20 · ประเภทเพื่อลงสีกราฟ: ตรงเวลา / สาย / อนุมัติย้อนหลัง / ลา
      const id = String(p.logId || p.id || '');
      let kind = 'ok';
      if (/อนุมัติ/.test(st) || /^PRY-APPR/.test(id)) kind = 'appr';
      else if (/อุซุร|ประจำเดือน|ป่วย|^ลา/.test(st)) kind = 'ex';
      else if (typeof window.k8ShouldBeOnTime === 'function' && window.k8ShouldBeOnTime(Object.assign({}, p, { date: date }))) kind = 'ok';
      else if (/สาย|ช้า/.test(st) || (typeof window.k8ShouldBeLate === 'function' && window.k8ShouldBeLate(Object.assign({}, p, { date: date })))) kind = 'late';
      out.push({ date, d: parseYMD(date), slot, kind, id: String(p.logId || p.id || '') });
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

  // v17.35 · ชื่อเวลาละหมาดภาษาอาหรับจาง ๆ ที่มุมขวา (สีพื้นน้ำเงินเดียว)
  const AR = { fajr: 'الفجر', zuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
  const SKY = {}; Object.keys(AR).forEach((k) => { SKY[k] = '<span class="hf-pt-ar" lang="ar" dir="rtl">' + AR[k] + '</span>'; });
  // v17.29 · การ์ดละหมาดวันนี้ (ไทม์ไลน์ E): เวลาอะซาน/อิกอมะฮ์ตามพิกัด + สถานะ 5 เวลา
  function renderPtCard(prayers, todayStr, now, st) {
    const box = document.getElementById('hfPt'); if (!box || typeof window.k8PrayerDay !== 'function') return;
    const day = window.k8PrayerDay(now), cur = now.getHours() * 60 + now.getMinutes();
    const fmt = (m) => pad2(Math.floor(((m % 1440) + 1440) % 1440 / 60)) + ':' + pad2(((m % 1440) + 1440) % 1440 % 60);
    const dur = (m) => { const h = Math.floor(m / 60), x = m % 60; return h ? h + ' ชม.' + (x ? ' ' + x + ' นาที' : '') : x + ' นาที'; };
    const rec = (k) => prayers.find((p) => p.date === todayStr && p.slot === k);
    const isOpen = (w) => w.key === 'อีชาอ์' ? (cur >= w.start || cur < day[0].start) : (cur >= w.start && cur <= w.end);
    const roll = (k) => !!(window.k8IsRollSlot && window.k8IsRollSlot(k));
    const open = day.find(isOpen) || null;
    const DN = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'], MN = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const done = SLOT_ORDER.filter((k) => rec(k)).length;
    // หัวการ์ด
    let lab = '', big = '', sub = '', subCls = '', cta = null;
    if (open && !rec(open.key) && roll(open.key)) { lab = open.key + ' · อิกอมะฮ์'; big = fmt(open.iqamah); sub = 'แอดมินเช็คชื่อให้'; }
    else if (open && !rec(open.key)) {
      lab = open.key + ' · อิกอมะฮ์'; big = fmt(open.iqamah);
      if (cur < open.iqamah) sub = 'อีก ' + dur(open.iqamah - cur);
      else if (window.k8IsLateNow && window.k8IsLateNow(open.key)) { sub = 'เลยเวลาแล้ว · นับว่ามาสาย'; subCls = ' is-late'; }
      else sub = 'ตรงเวลาถึง ' + fmt(open.cutoff) + ' น.';
      cta = open;
    } else {
      let nx = day.find((w) => w.start > cur && (!open || w.start > open.start)); let mins;
      if (nx) mins = nx.start - cur; else { nx = day[0]; mins = 1440 - cur + nx.start; }
      lab = (open ? open.key + ' ✓ · ถัดไป ' : 'ถัดไป · ') + nx.key; big = fmt(nx.adhan); sub = 'อีก ' + dur(mins);
    }
    if (window.k8WeeklyHoliday && window.k8WeeklyHoliday()) { cta = null; lab = 'วันเสาร์ · วันหยุดประจำสัปดาห์'; big = ''; sub = 'งดเช็คชื่อละหมาดและถ่ายรูป'; subCls = ''; }
    const perOn = !!(window.k8PeriodActive && window.k8PeriodActive());
    if (perOn) { cta = null; lab = '🌸 กำลังมีประจำเดือน'; big = ''; sub = 'ไม่ต้องเช็คชื่อ · กดสิ้นสุดเมื่อหมด'; subCls = ''; }
    // v17.96 · การ์ดละหมาด: หัวน้ำเงินแถบสีบางตามช่วงเวลา (มินิมอล 3) + ไทล์ 5 เวลา + ปฏิทินสัปดาห์ (สไตล์ 5)
    const sky = cur < day[0].start ? 'isha' : cur <= day[0].end ? 'fajr' : cur < day[2].start ? 'zuhr' : cur < day[3].start ? 'asr' : cur < day[4].start ? 'maghrib' : 'isha';
    const far = !!(window.k8MyPrayerLoc && window.k8MyPrayerLoc());
    const SKC = { fajr: '#a78bfa', zuhr: '#38bdf8', asr: '#f59e0b', maghrib: '#f97316', isha: '#facc15' };
    const c = SKC[sky];
    const ICO = {
      fajr: '<path d="M30 8A14 14 0 1 0 30 36A18 18 0 0 1 30 8Z" fill="' + c + '"/>',
      zuhr: '<circle cx="22" cy="22" r="11" fill="' + c + '"/><circle cx="22" cy="22" r="18" fill="none" stroke="' + c + '" stroke-width="1.5" opacity=".4"/>',
      asr: '<circle cx="22" cy="22" r="11" fill="' + c + '"/>',
      maghrib: '<path d="M9 28a13 13 0 0 1 26 0z" fill="' + c + '"/><path d="M3 28h38" stroke="' + c + '" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>',
      isha: '<path d="M30 8A14 14 0 1 0 30 36A18 18 0 0 1 30 8Z" fill="' + c + '"/><path d="M36 6l1.4 3.2 3.4.3-2.6 2.2.8 3.3-3-1.8-3 1.8.8-3.3-2.6-2.2 3.4-.3z" fill="' + c + '"/>'
    };
    const regOf = () => { const v = String((st && (st.registeredAt || st.registerDate)) || ''); let m = v.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) { const y = +m[1] > 2400 ? +m[1] - 543 : +m[1]; return y + '-' + m[2] + '-' + m[3]; } m = v.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) { const y = +m[3] > 2400 ? +m[3] - 543 : +m[3]; return y + '-' + pad2(m[2]) + '-' + pad2(m[1]); } return ''; };
    const reg = regOf();
    const sat = !!(window.k8WeeklyHoliday && window.k8WeeklyHoliday());
    const LBL = { ok: '✓', late: 'สาย', appr: 'ย้อนหลัง', ex: 'ลา' };
    const tile = (w) => {
      const r = rec(w.key), k = w.key;
      let cls = 'is-wait', sub = fmt(w.iqamah), act = '';
      if (r) { cls = 'is-' + r.kind; sub = LBL[r.kind] || '✓'; act = "k8HfBarOpen('" + esc(r.id) + "','" + esc(todayStr) + "')"; }
      else if (perOn) { cls = 'is-ex'; sub = '🌸'; act = 'k8PerGo()'; }
      else if (sat) { cls = 'is-off'; sub = 'วันหยุด'; }
      else if (open && open.key === k) { cls = 'is-now'; sub = roll(k) ? 'แอดมินเช็ค' : 'เช็คเลย'; act = roll(k) ? '' : "switchView('prayer')"; }
      else if (k !== 'อีชาอ์' && cur > w.end && !roll(k) && !(reg && reg >= todayStr)) { cls = 'is-miss'; sub = '✕'; act = "k8HfMiss('" + esc(k) + "')"; }
      return '<button type="button" class="hf-p5-t ' + cls + '"' + (act ? ' onclick="' + act + '"' : ' disabled') + ' aria-label="' + esc(k) + ' ' + esc(sub === '✕' ? 'ไม่ได้เช็ค' : sub) + '"><b>' + esc(k) + '</b><span>' + esc(sub) + '</span></button>';
    };
    // ปฏิทิน 7 วันล่าสุด (วันนี้อยู่ขวาสุด)
    const TD = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const days7 = []; for (let i = 6; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i); days7.push(d); }
    const KC = { ok: 1, late: 1, appr: 1, ex: 1 };
    let nOk = 0, nLate = 0, nMiss = 0;
    const cell = (d, w) => {
      const ds = ymd(d), isT = ds === todayStr, k = w.key;
      const r = prayers.find((p) => p.date === ds && p.slot === k);
      if (r && KC[r.kind]) { if (r.kind === 'late') nLate++; else if (r.kind === 'ok' || r.kind === 'appr') nOk++; return '<button type="button" class="hf-p5-c is-' + r.kind + '" onclick="k8HfBarOpen(\'' + esc(r.id) + '\',\'' + ds + '\')" aria-label="' + TD[d.getDay()] + ' ' + esc(k) + ' ' + (LBL[r.kind] || '') + '"></button>'; }
      if (reg && reg >= ds) return '<span class="hf-p5-c is-none"></span>';
      if (d.getDay() === 6) return '<span class="hf-p5-c is-off" title="วันหยุด"></span>';
      if (isT && open && open.key === k && !roll(k)) return '<span class="hf-p5-c is-now"></span>';
      const over = !isT || (k !== 'อีชาอ์' && cur > w.end);
      if (over && !roll(k)) { nMiss++; return '<span class="hf-p5-c is-miss" aria-label="' + TD[d.getDay()] + ' ' + esc(k) + ' ไม่ได้เช็ค">✕</span>'; }
      return '<span class="hf-p5-c is-none"></span>';
    };
    const grid = day.map((w) => '<span class="hf-p5-rl">' + esc(w.key) + '</span>' + days7.map((d) => cell(d, w)).join('')).join('');
    box.className = 'hf-card hf-p5 is-sky-' + sky;
    box.innerHTML = '<div class="hf-p5-sk" style="--sk:' + c + '"><div class="hf-p5-sk-r"><span class="hf-p5-ttl">ละหมาดวันนี้</span><span class="hf-p5-sk-i"><svg width="30" height="30" viewBox="0 0 44 44" aria-hidden="true">' + ICO[sky] + '</svg><span class="hf-p5-cnt">' + done + ' / 5</span></span></div>' +
      '<div class="hf-p5-hero"><span class="hf-p5-lab">' + esc(lab) + '</span>' + (big ? '<b>' + big + '</b>' : '') + '<span class="hf-p5-sub' + subCls + '">' + esc(sub) + '</span></div>' +
      '<small class="hf-p5-place">' + DN[now.getDay()] + ' ' + now.getDate() + ' ' + MN[now.getMonth()] + ' ' + (now.getFullYear() + 543) + ' · ' + esc(window.k8PrayerPlace ? window.k8PrayerPlace() : 'ต.เขาตูม อ.ยะรัง จ.ปัตตานี') + (far ? ' (ตามพิกัดล่าสุด)' : '') + '</small></div>' +
      '<div class="hf-p5-b"><div class="hf-p5-tiles">' + day.map(tile).join('') + '</div>' +
      (perOn ? '<button type="button" class="hf-pt-cta is-per" onclick="k8PerGo()">🌸 สิ้นสุดประจำเดือน</button>' : '') +
      '<div class="hf-p5-wh"><b>สัปดาห์นี้</b><span>ตรงเวลา ' + nOk + ' · สาย ' + nLate + ' · ไม่ได้เช็ค ' + nMiss + '</span></div>' +
      '<div class="hf-p5-grid"><span></span>' + days7.map((d) => '<span class="hf-p5-dh' + (ymd(d) === todayStr ? ' is-today' : '') + '">' + TD[d.getDay()] + '</span>').join('') + grid + '</div>' +
      '<div class="hf-p5-lg"><span class="is-ok">ตรงเวลา</span><span class="is-late">สาย</span><span class="is-appr">อนุมัติย้อนหลัง</span><span class="is-ex">ลา</span><span class="is-miss">ไม่ได้เช็ค</span></div></div>';
  }

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
    document.getElementById('hfGrade').textContent = String(s.grade || '-').replace('มัธยมศึกษาปีที่ ', 'ม.');
    document.getElementById('hfSchool').textContent = s.schoolName || '-';
    const tm = window.k8Term();
    document.getElementById('hfYear').textContent = (tm.term === 3 ? 'ภาคฤดูร้อน ' : 'เทอม ' + tm.term + '/') + tm.year;
    // v17.98 · บัตรโลโก้ 1: ปีการศึกษา · เพศ · หอพัก
    const acy = document.getElementById('hfAcYear'); if (acy) acy.textContent = tm.year || '-';
    const girl = !!(window.k8IsGirl && window.k8IsGirl(s));
    const sx = document.getElementById('hfSex'); if (sx) { sx.textContent = '● ' + (girl ? 'นักเรียนหญิง' : 'นักเรียนชาย') + ' · นักเรียนประจำ'; sx.classList.toggle('is-f', girl); }
    const dk = window.k8DormOf ? window.k8DormOf(s) : '';
    const dEl = document.getElementById('hfDorm');
    if (dEl) { dEl.hidden = !dk; dEl.classList.toggle('is-f', girl); const dn = document.getElementById('hfDormName'); if (dn) dn.textContent = (window.K8_DORMS && window.K8_DORMS[dk]) || ''; }
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
      photo.classList.add('has-img');
      photo.classList.toggle('is-png', /^data:image\/(png|webp|gif)|#png$|\.png(\?|$)/i.test(url));
    } else {
      photo.style.backgroundImage = '';
      photo.classList.remove('has-img', 'is-png');
      const bare = name.replace(/^(นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง)\s*/, '');
      photo.textContent = bare.charAt(0) || '?';
    }

    // --- ละหมาดถัดไป ---
    const prayers = myPrayerRecords(sid);
    const todayStr = ymd(now);
    const doneToday = prayers.filter((p) => p.date === todayStr).map((p) => p.slot);
    renderPtCard(prayers, todayStr, now, s);
    const prCard = document.getElementById('hfPrayerCard'); if (prCard) prCard.hidden = hfState.period === 'day' || hfState.period === 'week'; // v17.96 · วัน/สัปดาห์ ดูในการ์ดละหมาดแล้ว

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
      const curMin = now.getHours() * 60 + now.getMinutes();
      const wins = (typeof PRAYER_TIME_WINDOWS !== 'undefined') ? PRAYER_TIME_WINDOWS : [];
      bars = SLOT_ORDER.map((slot) => {
        const rec = prayers.find((p) => p.date === todayStr && p.slot === slot);
        if (rec) return { label: slot, v: 1, kind: rec.kind, id: rec.id, date: todayStr, text: rec.kind === 'late' ? 'สาย' : rec.kind === 'appr' ? 'ย้อนหลัง' : rec.kind === 'ex' ? 'ลา' : '✓' };
        const w = wins.find((x) => slotKey(x.key || x.name) === slot);
        const over = w && slot !== 'อีชาอ์' && curMin > w.endMin;
        return { label: slot, v: 0, miss: !!over, text: over ? '' : '–', date: todayStr };
      });
      got = doneToday.length; possible = 5;
    } else if (hfState.period === 'week') {
      for (let i = 0; i < 7; i++) {
        const d = new Date(range.start); d.setDate(range.start.getDate() + i);
        const key = ymd(d);
        const dayRecs = prayers.filter((p) => p.date === key); const v = dayRecs.length;
        const segs = {}; dayRecs.forEach((p) => { segs[p.kind] = (segs[p.kind] || 0) + 1; });
        bars.push({ label: TH_DOW[d.getDay()], v, segs, text: d > now ? '' : String(v), future: d > now, date: key });
        if (d <= now) { got += v; possible += 5; }
      }
    } else {
      const weeks = [];
      for (let d = new Date(range.start); d <= range.end; d.setDate(d.getDate() + 1)) {
        const w = Math.floor((d.getDate() - 1) / 7);
        weeks[w] = weeks[w] || { v: 0, days: 0, date: ymd(d) };
        if (d <= now) { weeks[w].days++; const recs = prayers.filter((p) => p.date === ymd(d)); weeks[w].v += recs.length; weeks[w].segs = weeks[w].segs || {}; recs.forEach((p) => { weeks[w].segs[p.kind] = (weeks[w].segs[p.kind] || 0) + 1; }); }
      }
      max = 35;
      bars = weeks.map((w, i) => ({ label: 'สัปดาห์ ' + (i + 1), v: w.v, segs: w.segs || {}, text: w.days ? String(w.v) : '', future: !w.days, date: w.date }));
      weeks.forEach((w) => { got += w.v; possible += w.days * 5; });
    }
    document.getElementById('hfPrayerTotal').textContent = got + ' / ' + possible + ' เวลา';
    const barsEl = document.getElementById('hfBars');
    barsEl.setAttribute('aria-label', 'ละหมาด ' + got + ' จาก ' + possible + ' เวลา');
    const KC = { ok: '#16a34a', late: '#f97316', appr: '#7c3aed', ex: '#2563eb' };
    barsEl.innerHTML = bars.map((b) => {
      const ratio = max ? Math.min(1, b.v / max) : 0;
      const h = Math.max(4, Math.round(ratio * 110));
      const act = b.future ? '' : ' onclick="k8HfBarOpen(\'' + esc(b.id || '') + '\',\'' + esc(b.date || '') + '\')" role="button" tabindex="0" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click()}" title="แตะเพื่อดูประวัติ"';
      if (b.miss) return '<div class="hf-bar is-miss is-tap" onclick="k8HfMiss(\'' + esc(b.label) + '\')" role="button" tabindex="0" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click()}" title="หมดเวลาแล้ว · เช็คชื่อย้อนหลังไม่ได้"><span class="hf-bar-v"></span><span class="hf-bar-x" aria-label="ไม่ได้เช็คชื่อ หมดเวลาแล้ว">✕</span><span class="hf-bar-l">' + esc(b.label) + '</span></div>';
      let col;
      if (b.kind) col = '<span class="hf-bar-col" style="height:' + h + 'px;background:' + KC[b.kind] + '"></span>';
      else if (b.segs && b.v) col = '<span class="hf-bar-col is-stack" style="height:' + h + 'px">' + ['ok', 'late', 'appr', 'ex'].filter((k) => b.segs[k]).map((k) => '<i style="flex:' + b.segs[k] + ';background:' + KC[k] + '"></i>').join('') + '</span>';
      else col = '<span class="hf-bar-col" style="height:' + h + 'px;background:' + (b.future ? '#e2e8f0' : '#cbd5e1') + '"></span>';
      return '<div class="hf-bar' + (b.kind ? ' is-' + b.kind : '') + (b.future ? '' : ' is-tap') + '"' + act + '><span class="hf-bar-v">' + esc(b.text) + '</span>' + col + '<span class="hf-bar-l">' + esc(b.label) + '</span></div>';
    }).join('');
    let lg = document.getElementById('hfBarsLegend');
    if (!lg) { lg = document.createElement('div'); lg.id = 'hfBarsLegend'; lg.className = 'hf-bars-legend'; barsEl.after(lg); }
    lg.innerHTML = '<span class="is-ok">ตรงเวลา</span><span class="is-late">สาย</span><span class="is-appr">อนุมัติย้อนหลัง</span><span class="is-ex">ลา</span><span class="is-miss">ไม่ได้เช็ค</span>';

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
    { const sec = document.getElementById('hfGrades'), qk = document.getElementById('hfGradesQk'); if (sec) sec.hidden = !open; if (qk) qk.classList.toggle('is-on', !!open); }
    const body = document.getElementById('hfGradesBody');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.getElementById('hfGradesIcon').innerHTML = open ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
    document.getElementById('hfGradesHint').textContent = open ? 'คนรอบข้างอาจเห็นได้ · ซ่อนอัตโนมัติเมื่อออกจากหน้านี้' : 'ซ่อนไว้เพื่อความเป็นส่วนตัว';
    document.getElementById('hfGradesAction').textContent = open ? 'ซ่อน' : 'แตะเพื่อดู';
    body.hidden = !open;
    if (!open) { body.innerHTML = ''; return; }

    if (typeof loadAppSubjects === 'function') loadAppSubjects();
    const allSubj = (typeof appSubjects !== 'undefined' && Array.isArray(appSubjects)) ? appSubjects : [];
    const subjects = typeof window.k8MySubjects === 'function' ? window.k8MySubjects(allSubj) : allSubj;
    const defsMap = readJSON('khalifah_subject_assignments', {});
    const scoreMap = (readJSON('khalifah_student_assignment_scores', {})[sid]) || {};
    let gpax = Number(s.gpax || s.gpa);
    if (!(gpax > 0) && typeof recalculateStudentGpa === 'function') gpax = Number(recalculateStudentGpa(s));
    let html = '<div class="hf-gpax"><span>เกรดเฉลี่ยสะสม (GPAX)</span><b>' + (gpax > 0 ? gpax.toFixed(2) : '–') + '</b></div>';
    try { const info = window.k8MySubjectsInfo && window.k8MySubjectsInfo(); if (info) html += '<p class="hf-subj-note">' + esc(info) + '</p>'; } catch (e) {}
    if (!subjects.length) html += '<p class="hf-subj-note">ยังไม่มีรายวิชาของชั้นนี้ในตารางเรียน</p>';
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
  // v17.52 · เกรดคิดอัตโนมัติจากคะแนนชิ้นงานรวม · เกณฑ์ปรับได้รายวิชา (ค่าเริ่มต้น 80/75/70/65/60/55/50)
  const GC_DEF = [80, 75, 70, 65, 60, 55, 50], GC_G = [4, 3.5, 3, 2.5, 2, 1.5, 1];
  const gcMap = () => { const m = readJSON('khalifah_grade_criteria', {}); return m && typeof m === 'object' ? m : {}; };
  const gcCustom = (subj) => { const m = gcMap()[subj]; return Array.isArray(m) && m.length === 7; };
  const gcMins = (subj) => (gcCustom(subj) ? gcMap()[subj].map(Number) : GC_DEF.slice());
  const gcGrade = (pct, subj) => { const mins = gcMins(subj); for (let i = 0; i < 7; i++) if (pct >= mins[i] - 1e-9) return GC_G[i]; return 0; };

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

  function gcCell(sid, subj, defs) { const g = gcFor(sid, subj, defs); if (g === null) return '–'; const t = gradeTone(g); return '<span class="gc-g" style="background:' + t[0] + ';color:' + t[1] + '">' + g + '</span>'; }
  function gcTxt(sid, subj, defs) { const g = gcFor(sid, subj, defs); return g === null ? '' : ' · เกรด ' + g; }
  function gcFor(sid, subj, defs) { const t = tgTotals(sid, subj, defs); return t.any && t.max ? gcGrade(t.got / t.max * 100, subj) : null; }
  function tgAutoEdits(subj, defs) {
    const out = {};
    const pool = ((typeof allStudents !== 'undefined' && Array.isArray(allStudents)) ? allStudents : []).filter((x) => x && x.studentId && !/ลาออก|สำเร็จ/.test(String(x.status || '')));
    pool.forEach((s) => {
      const sid = cleanId(s.studentId); const g = gcFor(sid, subj, defs); if (g === null) return;
      const raw = s.subjectGrades ? s.subjectGrades[subj] : undefined;
      if (raw !== undefined && raw !== null && raw !== '' && Number(raw) === g) return;
      if (tgSavedGrade(s, subj) === g) return;
      out[sid] = g;
    });
    return out;
  }
  async function tgPushGrades(subj, edits, defs) {
    const subjObj = (typeof appSubjects !== 'undefined' ? appSubjects : []).find((x) => x.id === subj) || { id: subj, name: subj };
    const studentGrades = [];
    Object.keys(edits).forEach((sid) => {
      const st = allStudents.find((x) => sameId(x.studentId, sid)); if (!st) return;
      const g = edits[sid]; const t = tgTotals(sid, subj, defs);
      st.subjectGrades = st.subjectGrades || {}; st.skills = st.skills || {};
      st.subjectGrades[subj] = g; st.skills[subj] = g;
      const arr = Array.isArray(st.grades) ? st.grades.filter((x) => x && x.code !== subj) : [];
      arr.push({ code: subj, name: subjObj.name, grade: g, score: t.any ? t.pct : Math.round(g * 25) });
      st.grades = arr;
      const gpax = (typeof recalculateStudentGpa === 'function') ? recalculateStudentGpa(st) : '';
      studentGrades.push({ studentId: cleanId(st.studentId), fullName: st.fullName, grade: st.grade, gradeVal: g, score: t.any ? t.pct : Math.round(g * 25), gpax, grades: arr });
    });
    if (!studentGrades.length) return 0;
    const res = await gasApiCall('saveSubjectGrades', { data: { subjectCode: subj, subjectName: subjObj.name, teacherId: currentAdmin ? currentAdmin.username : 'Teacher', studentGrades } });
    if (!res || !res.success) throw new Error((res && (res.message || res.error)) || 'บันทึกเกรดไม่สำเร็จ');
    localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents));
    return studentGrades.length;
  }
  function gcBarHTML(subj) {
    const mins = gcMins(subj), custom = gcCustom(subj);
    let h = '<div class="gc-bar"><div class="gc-bar-t"><b>เกรดคิดให้อัตโนมัติ</b><span>จากคะแนนรวมทุกชิ้นงาน · เกณฑ์' + (custom ? 'ที่ปรับเอง' : 'มาตรฐาน') + '</span></div>' +
      '<button type="button" class="tg-btn" data-act="gc-open" aria-expanded="' + !!tgState.gcOpen + '">' + (tgState.gcOpen ? 'ปิด' : 'ปรับเกณฑ์') + '</button></div>';
    if (!tgState.gcOpen) {
      h += '<div class="gc-chips" aria-label="เกณฑ์เกรดปัจจุบัน">' + GC_G.map((g, i) => '<span><b>' + g + '</b> ' + fmtNum(mins[i]) + '%+</span>').join('') + '<span><b>0</b> ต่ำกว่า ' + fmtNum(mins[6]) + '%</span></div>';
      return h;
    }
    const n = gsMySubjects().length;
    h += '<div class="gc-edit"><p class="tg-note">ใส่ร้อยละขั้นต่ำของแต่ละเกรด (คะแนนรวม ÷ คะแนนเต็มรวม) · ไม่จำเป็นต้องปรับ ถ้าใช้เกณฑ์มาตรฐานอยู่แล้ว</p><div class="gc-grid">' +
      GC_G.map((g, i) => '<label><span>เกรด <b>' + g + '</b></span><span class="gc-in"><input type="text" inputmode="decimal" data-gc="' + i + '" value="' + fmtNum(mins[i]) + '" aria-label="ร้อยละขั้นต่ำของเกรด ' + g + '">%+</span></label>').join('') +
      '<label class="is-zero"><span>เกรด <b>0</b></span><span class="gc-in">ต่ำกว่าเกรด 1</span></label></div>' +
      '<fieldset class="gc-scope"><legend>ใช้กับ</legend><label><input type="radio" name="tgGcScope" value="one" checked> เฉพาะวิชานี้</label>' + (n > 1 ? '<label><input type="radio" name="tgGcScope" value="all"> ทุกวิชาที่ฉันสอน (' + n + ' วิชา)</label>' : '') + '</fieldset>' +
      '<p class="gc-err" id="tgGcErr" role="alert" hidden></p>' +
      '<div class="tg-btns"><button type="button" class="tg-btn" data-act="gc-reset"' + (tgState.gcBusy ? ' disabled' : '') + '>ใช้เกณฑ์มาตรฐาน</button><button type="button" class="tg-btn is-primary" data-act="gc-save"' + (tgState.gcBusy ? ' disabled' : '') + '>' + (tgState.gcBusy ? 'กำลังบันทึก...' : 'บันทึกเกณฑ์') + '</button></div></div>';
    return h;
  }
  async function gcApply(mins) {
    const subj = tgSubject(); if (!subj || tgState.gcBusy) return;
    const scope = (document.querySelector('input[name="tgGcScope"]:checked') || {}).value || 'one';
    const ids = scope === 'all' ? gsMySubjects().map((x) => String(x.id)) : [subj];
    tgState.gcBusy = true; renderTeacherGradesV8();
    try {
      const res = await gasApiCall('saveGradeCriteria', { data: { subjectIds: ids, mins } });
      if (!res || !res.success) throw new Error((res && (res.message || res.error)) || 'บันทึกเกณฑ์ไม่สำเร็จ');
      try { localStorage.setItem('khalifah_grade_criteria', JSON.stringify(res.criteria || {})); } catch (e) {}
      let n = 0;
      for (const id of ids) { const defs = tgAssignments(id); if (defs.length) n += await tgPushGrades(id, tgAutoEdits(id, defs), defs); }
      tgState.gcOpen = false;
      showToast('บันทึกเกณฑ์แล้ว' + (n ? ' · คิดเกรดใหม่ ' + n + ' คน' : ''), 'success');
    } catch (err) {
      showToast('บันทึกเกณฑ์ไม่สำเร็จ: ' + (err && err.message ? err.message : err), 'error');
    } finally { tgState.gcBusy = false; renderTeacherGradesV8(); }
  }

  // ---------- v17.50 · สรุปเกรด GS10 ----------
  const GS_GR = ['1', '2', '3', '4', '5', '6'];
  const gsNum = (g) => { const m = String(g || '').match(/([1-6])/); return m ? m[1] : ''; };
  const gsBare = (s) => (window.k8BareName ? window.k8BareName(s) : String(s.fullName || ''));
  function gsMySubjects() {
    const sel = document.getElementById('teacherPortalSubjectSelect');
    const subs = (typeof appSubjects !== 'undefined' && Array.isArray(appSubjects)) ? appSubjects : [];
    return sel ? Array.from(sel.options).map((o) => subs.find((x) => String(x.id) === o.value) || { id: o.value, name: o.textContent }) : [];
  }
  function gsPool() {
    return ((typeof allStudents !== 'undefined' && Array.isArray(allStudents)) ? allStudents : []).filter((x) => x && x.studentId && !/ลาออก|สำเร็จ/.test(String(x.status || '')));
  }
  function gsGradeOf(s, subj) {
    const e = tgState.gradeEdits[subj.id] || {}; const sid = cleanId(s.studentId);
    if (e[sid] !== undefined) return e[sid];
    const g = subjectGradeFor(s, subj).grade; return g == null ? null : g;
  }
  // ผูกวิชากับชั้นจากตารางสอน (ช่องของฉันก่อน) · นักเรียนที่มีเกรดแล้วนับรวมด้วยเสมอ
  function gsModel() {
    let tt = null; try { tt = JSON.parse(localStorage.getItem('khalifah_timetable') || 'null'); } catch (e) {}
    let me = {}; try { me = currentAdmin || {}; } catch (e) {}
    const un = String(me.username || '').toLowerCase(), fn = String(me.fullName || me.name || '').trim();
    const mine = (c) => (un && String(c.t || '').toLowerCase() === un) || (fn && String(c.tn || '').trim() === fn);
    const pool = gsPool(); const subs = gsMySubjects();
    const cells = []; // {g, c}
    if (tt && tt.grades) GS_GR.forEach((g) => { const cs = (tt.grades[g] && tt.grades[g].cells) || {}; Object.keys(cs).forEach((k) => { (Array.isArray(cs[k]) ? cs[k] : [cs[k]]).forEach((c) => { if (c && c.s) cells.push({ g, c }); }); }); });
    const cls = {}; GS_GR.concat(['?']).forEach((g) => { cls[g] = { g, rows: [], studs: {} }; });
    subs.forEach((subj) => {
      const all = cells.filter((x) => String(x.c.s) === String(subj.id));
      const use = all.some((x) => mine(x.c)) ? all.filter((x) => mine(x.c)) : all;
      const per = {}; // g -> Set(sid)
      use.forEach((x) => {
        per[x.g] = per[x.g] || {};
        const only = Array.isArray(x.c.o) && x.c.o.length ? x.c.o.map((v) => cleanId(v)) : null;
        pool.forEach((s) => { if (gsNum(s.grade) === x.g && (!only || only.indexOf(cleanId(s.studentId)) !== -1)) per[x.g][cleanId(s.studentId)] = s; });
      });
      pool.forEach((s) => { if (gsGradeOf(s, subj) != null) { const g = gsNum(s.grade) || '?'; per[g] = per[g] || {}; per[g][cleanId(s.studentId)] = s; } });
      const gs = Object.keys(per);
      if (!gs.length) { cls['?'].rows.push({ subj, studs: [], done: 0 }); return; }
      gs.forEach((g) => {
        const studs = Object.keys(per[g]).map((k) => per[g][k]);
        const done = studs.filter((s) => gsGradeOf(s, subj) != null).length;
        cls[g].rows.push({ subj, studs, done });
        studs.forEach((s) => { cls[g].studs[cleanId(s.studentId)] = s; });
      });
    });
    return GS_GR.concat(['?']).map((g) => cls[g]).filter((c) => c.rows.length);
  }
  const gsStat = (done, tot) => (tot && done >= tot ? 'done' : done ? 'part' : 'none');
  const GS_PILL = { done: ['ครบแล้ว', 'is-done'], part: ['ยังไม่ครบ', 'is-part'], none: ['ยังไม่กรอก', 'is-none'] };
  const gsPill = (k) => '<span class="gs-pill ' + GS_PILL[k][1] + '">' + GS_PILL[k][0] + '</span>';
  function gsRing(pct) {
    const col = pct >= 100 ? '#15803d' : pct > 0 ? '#f59e0b' : '#e2e8f0';
    return '<svg class="gs-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" stroke-width="4"/><circle cx="18" cy="18" r="15.9" fill="none" stroke="' + col + '" stroke-width="4" stroke-dasharray="' + pct + ' 100" stroke-linecap="' + (pct > 0 && pct < 100 ? 'round' : 'butt') + '" transform="rotate(-90 18 18)"/><text x="18" y="21" text-anchor="middle" font-size="8.5" font-weight="700" fill="currentColor">' + pct + '%</text></svg>';
  }
  function gsClassInfo(c) {
    const tot = c.rows.reduce((a, r) => a + r.studs.length, 0), done = c.rows.reduce((a, r) => a + r.done, 0);
    let sum = 0, n = 0; c.rows.forEach((r) => r.studs.forEach((s) => { const g = gsGradeOf(s, r.subj); if (g != null) { sum += Number(g); n++; } }));
    return { tot, done, pct: tot ? Math.round(done * 100 / tot) : 0, avg: n ? (sum / n).toFixed(2) : '', n: Object.keys(c.studs).length };
  }
  function tgOverviewHTML() {
    const model = gsModel();
    if (tgState.cls) { const c = model.find((x) => x.g === tgState.cls); if (c) return gsClassHTML(c); tgState.cls = ''; }
    if (!model.length) return '<div class="tg-empty">ยังไม่มีรายวิชาที่รับผิดชอบ</div>';
    let all = 0, miss = 0; model.forEach((c) => c.rows.forEach((r) => { all++; if (gsStat(r.done, r.studs.length) !== 'done') miss++; }));
    let html = '<p class="gs-lead">' + (miss ? 'ยังกรอกไม่ครบ <b>' + miss + '</b> จาก ' + all + ' รายการ' : 'กรอกเกรดครบทุกวิชาแล้ว') + ' · แตะวิชาเพื่อกรอกเกรด</p>';
    html += model.map((c) => {
      const i = gsClassInfo(c);
      const name = c.g === '?' ? 'ยังไม่ระบุชั้น' : 'ม.' + c.g;
      const head = c.g === '?' ? '<div class="gs-head"><div class="gs-hd-t"><b>' + name + '</b><span>วิชาที่ยังไม่ได้อยู่ในตารางสอน</span></div></div>'
        : '<button type="button" class="gs-head" data-gs-cls="' + c.g + '" aria-label="ดูเกรดทุกวิชารายคน ชั้น ' + name + '">' + gsRing(i.pct) + '<div class="gs-hd-t"><b>' + name + '</b><span>' + i.n + ' คน · ' + c.rows.length + ' วิชา' + (i.avg ? ' · เฉลี่ยชั้น ' + i.avg : '') + '</span></div><span class="gs-chev" aria-hidden="true">›</span></button>';
      return '<section class="gs-card">' + head + c.rows.map((r) => {
        const k = gsStat(r.done, r.studs.length);
        return '<button type="button" class="gs-row" data-gs-subj="' + esc(r.subj.id) + '" data-gs-g="' + c.g + '"><span class="gs-sn">' + esc(r.subj.name) + '</span><span class="gs-cnt">' + (c.g === '?' ? '' : r.done + '/' + r.studs.length) + '</span>' + gsPill(k) + '</button>';
      }).join('') + '</section>';
    }).join('');
    return html;
  }
  function gsClassHTML(c) {
    const i = gsClassInfo(c);
    const q = (tgState.search || '').trim().toLowerCase();
    const studs = Object.keys(c.studs).map((k) => c.studs[k])
      .filter((s) => !q || String(s.fullName || '').toLowerCase().indexOf(q) !== -1 || String(s.studentId).indexOf(q) !== -1)
      .sort((a, b) => gsBare(a).localeCompare(gsBare(b), 'th'));
    let html = '<div class="gs-back"><button type="button" data-gs="back">‹ สรุปเกรด</button><div><b>ม.' + c.g + '</b><span>' + i.n + ' คน · ' + c.rows.length + ' วิชา' + (i.avg ? ' · เฉลี่ยชั้น ' + i.avg : '') + '</span></div>' + gsRing(i.pct) + '</div>';
    html += '<label class="tg-search"><span class="sr-only-k8">ค้นหานักเรียน</span><input type="search" id="tgSearch" placeholder="ค้นหาชื่อหรือรหัสนักเรียน" value="' + esc(tgState.search || '') + '"></label>';
    html += '<ul class="gs-stu">' + studs.map((s) => {
      const sid = cleanId(s.studentId);
      let missN = 0;
      const chips = c.rows.filter((r) => r.studs.some((x) => cleanId(x.studentId) === sid)).map((r) => {
        const g = gsGradeOf(s, r.subj); if (g == null) missN++;
        const t = gradeTone(g);
        return '<span class="gs-g' + (g == null ? ' is-miss' : '') + '" style="background:' + t[0] + ';color:' + t[1] + '"><small>' + esc(r.subj.name) + '</small><b>' + (g == null ? '–' : g) + '</b></span>';
      }).join('');
      return '<li><div class="gs-stu-top"><span class="gs-stu-n">' + esc(s.fullName || sid) + '</span>' + (missN ? '<span class="gs-pill is-none">ขาด ' + missN + ' วิชา</span>' : '<span class="gs-pill is-done">ครบ</span>') + '</div><div class="gs-gs">' + chips + '</div></li>';
    }).join('') + '</ul>';
    if (!studs.length) html += '<div class="tg-empty">ไม่พบนักเรียน</div>';
    return html;
  }
  function tgMarkView() {
    const root = document.getElementById('tgRoot'); if (!root) return;
    root.classList.toggle('gs-ov', tgState.tab === 'summary' && !tgState.entry);
  }
  window.k8GsModel = gsModel;
  window.k8GsGradeOf = gsGradeOf;

  function renderTeacherGradesV8() {
    tgState.tab = 'scores'; tgState.entry = false; // v17.51 · ไม่มีแท็บสรุปเกรดแล้ว
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
      html += gcBarHTML(subj);
      html += '<div class="tg-chips">' + defs.map((a) => '<button type="button" class="tg-chip" data-asg="' + esc(a.id) + '" aria-pressed="' + (a.id === active) + '">' + esc(a.title) + '<small>เต็ม ' + fmtNum(a.maxScore) + '</small></button>').join('') +
        '<button type="button" class="tg-add" data-act="open-add" aria-label="เพิ่มชิ้นงาน">+ เพิ่ม</button></div>';
      if (tgState.adding) {
        html += '<div class="tg-form"><div class="tg-form-row">' +
          '<label>ชื่อชิ้นงาน<input type="text" id="tgNewTitle" maxlength="120" placeholder="เช่น ใบงานที่ 4"></label>' +
          '<label>คะแนนเต็ม<input type="text" inputmode="decimal" id="tgNewMax" placeholder="' + (left >= 10 ? '10' : fmtNum(left)) + '"' + (left <= 0 ? ' disabled' : '') + '></label></div>' +
          '<p class="tg-form-hint' + (left <= 0 ? ' is-full' : '') + '">' + (left <= 0 ? 'คะแนนเต็มรวมครบ 100 แล้ว · ลดคะแนนชิ้นงานเดิมก่อนจึงจะเพิ่มชิ้นใหม่ได้' : 'ใส่คะแนนเต็มได้อีก ' + fmtNum(left) + ' คะแนน (รวมทุกชิ้นไม่เกิน 100)') + '</p>' +
          '<div class="tg-btns"><button type="button" class="tg-btn" data-act="cancel-add">ยกเลิก</button><button type="button" class="tg-btn is-primary" data-act="confirm-add">เพิ่มชิ้นงาน</button></div></div>';
      }
      // หัวการ์ดตาราง: ชื่อโหมดที่ใช้อยู่ + ลิงก์สลับไปอีกโหมด
      if (defs.length) html += '<div class="tg-mode tg-mode-hdr" role="tablist" aria-label="รูปแบบการกรอกคะแนน">' + [['grid', 'ตารางทุกชิ้นงาน', 'ดูตารางทุกชิ้น ›'], ['one', 'กรอกทีละชิ้นงาน', 'กรอกทีละชิ้น ›']].sort((a, b) => (b[0] === tgState.mode) - (a[0] === tgState.mode)).map(([k, l, link]) => '<button type="button" role="tab" data-mode="' + k + '" aria-selected="' + (tgState.mode === k) + '">' + (tgState.mode === k ? l : link) + '</button>').join('') + '</div>';
      if (defs.length && tgState.mode === 'grid') {
        html += '<p class="tg-note tg-note-grid">กด Enter เพื่อลงไปคนถัดไปในชิ้นงานเดียวกัน</p>';
        html += '<div class="tg-grid-wrap"><table class="tg-grid"><thead><tr><th scope="col" class="tg-grid-name">นักเรียน</th>' + defs.map((a) => '<th scope="col"><span>' + esc(a.title) + '</span><small>เต็ม ' + fmtNum(a.maxScore) + '</small></th>').join('') + '<th scope="col" class="tg-grid-sum">รวม<small>' + fmtNum(totalMax) + '</small></th><th scope="col" class="tg-grid-sum tg-grid-gr">เกรด</th></tr></thead><tbody>' +
          students.map((s) => { const sid = cleanId(s.studentId); const t = tgTotals(sid, subj, defs);
            return '<tr><th scope="row" class="tg-grid-name"><b>' + esc(s.fullName || sid) + '</b><small>' + esc(sid) + '</small></th>' + defs.map((a) => { const v = tgScoreOf(sid, subj, a.id); const n = Number(v); const bad = v !== '' && (isNaN(n) || n < 0 || n > Number(a.maxScore));
              return '<td><input type="text" inputmode="decimal" autocomplete="off" class="' + (bad ? 'is-bad' : '') + '" data-sid="' + esc(sid) + '" data-asg="' + esc(a.id) + '" data-max="' + esc(a.maxScore) + '" value="' + esc(v) + '" placeholder="–" aria-label="' + esc(a.title) + ' ของ ' + esc(s.fullName || sid) + ' (เต็ม ' + fmtNum(a.maxScore) + ')"></td>'; }).join('') +
              '<td class="tg-grid-sum" data-gridsum-for="' + esc(sid) + '">' + fmtNum(t.got) + '</td><td class="tg-grid-sum tg-grid-gr" data-gridgr-for="' + esc(sid) + '">' + gcCell(sid, subj, defs) + '</td></tr>'; }).join('') + '</tbody></table></div>';
        if (!students.length) html += '<div class="tg-empty">ไม่พบนักเรียนในระดับชั้นที่เลือก</div>';
      } else if (!defs.length) {
        html += '<div class="tg-empty">ยังไม่มีชิ้นงาน กด "+ เพิ่มชิ้นงาน" เพื่อสร้างช่องคะแนน เช่น การบ้าน รายงาน หรือสอบ</div>';
      } else {
        const a = defs.find((x) => x.id === active);
        html += '<div class="tg-asg-bar"><span>กำลังกรอก: <b>' + esc(a.title) + '</b> (เต็ม ' + fmtNum(a.maxScore) + ') · กด Enter เพื่อไปคนถัดไป</span><button type="button" class="tg-link-danger" data-act="remove-asg">ลบชิ้นงานนี้</button></div>';
        html += '<ul class="tg-list" aria-label="กรอกคะแนน ' + esc(a.title) + '">' + students.map((s) => {
          const sid = cleanId(s.studentId);
          const v = tgScoreOf(sid, subj, a.id);
          const n = Number(v);
          const bad = v !== '' && (isNaN(n) || n < 0 || n > Number(a.maxScore));
          const t = tgTotals(sid, subj, defs);
          return '<li class="tg-row"><span class="tg-row-main"><span class="tg-row-name">' + esc(s.fullName || sid) + '</span><span class="tg-row-sub" data-total-for="' + esc(sid) + '">' + esc(sid) + ' · รวม ' + fmtNum(t.got) + ' / ' + fmtNum(t.max) + gcTxt(sid, subj, defs) + '</span></span>' +
            '<label class="tg-score"><span class="sr-only-k8">คะแนน ' + esc(a.title) + ' ของ ' + esc(s.fullName || sid) + '</span>' +
            '<input type="text" inputmode="decimal" autocomplete="off" class="' + (bad ? 'is-bad' : '') + '" data-sid="' + esc(sid) + '" data-asg="' + esc(a.id) + '" data-max="' + esc(a.maxScore) + '" value="' + esc(v) + '" placeholder="–"> / ' + fmtNum(a.maxScore) + '</label></li>';
        }).join('') + '</ul>';
        if (!students.length) html += '<div class="tg-empty">ไม่พบนักเรียนในระดับชั้นที่เลือก</div>';
      }
    } else {
      // v17.50 · สรุปเกรดแยกตามชั้นเรียน (GS10) → แตะวิชาเพื่อกรอกเกรด · แตะชั้นเพื่อดูเกรดทุกวิชารายคน
      if (!tgState.entry) { body.innerHTML = tgOverviewHTML(); tgUpdateSaveBar(); tgMarkView(); return; }
      const subjName = ((typeof appSubjects !== 'undefined' ? appSubjects : []).find((x) => x.id === subj) || {}).name || subj;
      const gsel = document.getElementById('teacherPortalGradeSelect'); const gv = gsel ? (gsel.value || 'ALL') : 'ALL';
      html = '<div class="gs-back"><button type="button" data-gs="back">‹ สรุปเกรด</button><div><b>' + esc(subjName) + '</b><span>' + (gv === 'ALL' ? 'ทุกระดับชั้น' : 'ม.' + (String(gv).match(/[1-6]/) || [''])[0]) + ' · ' + students.length + ' คน</span></div></div>' + html;
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
    tgUpdateSaveBar(); tgMarkView();
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
      tgState.adding = false; tgState.entry = false; tgState.cls = '';
      renderTeacherGradesV8();
    });
    const body = document.getElementById('tgBody');
    body.addEventListener('click', (e) => {
      const bk = e.target.closest('[data-gs="back"]');
      if (bk) { if (tgState.entry) { tgState.entry = false; } else tgState.cls = ''; tgState.search = ''; renderTeacherGradesV8(); window.scrollTo(0, 0); return; }
      const cl = e.target.closest('[data-gs-cls]');
      if (cl) { tgState.cls = cl.dataset.gsCls; tgState.search = ''; renderTeacherGradesV8(); window.scrollTo(0, 0); return; }
      const sr = e.target.closest('[data-gs-subj]');
      if (sr) {
        const ss = document.getElementById('teacherPortalSubjectSelect'); if (ss) ss.value = sr.dataset.gsSubj;
        const gs = document.getElementById('teacherPortalGradeSelect'); if (gs) gs.value = sr.dataset.gsG === '?' ? 'ALL' : 'มัธยมศึกษาปีที่ ' + sr.dataset.gsG;
        tgState.entry = true; tgState.cls = ''; tgState.search = ''; renderTeacherGradesV8(); window.scrollTo(0, 0); return;
      }
    });
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
        if (kind === 'gc-open') { tgState.gcOpen = !tgState.gcOpen; renderTeacherGradesV8(); const f = document.querySelector('[data-gc="0"]'); if (f) f.focus(); }
        if (kind === 'gc-reset') gcApply(null);
        if (kind === 'gc-save') {
          const v = Array.from(document.querySelectorAll('[data-gc]')).map((x) => Number(String(x.value).trim()));
          let err = '';
          if (v.length !== 7 || v.some((x) => !isFinite(x) || x <= 0 || x > 100)) err = 'กรอกร้อยละ 1–100 ให้ครบทุกเกรด';
          else for (let i = 1; i < 7; i++) if (v[i] >= v[i - 1]) { err = 'เกณฑ์ของเกรด ' + GC_G[i] + ' ต้องน้อยกว่าเกรด ' + GC_G[i - 1]; break; }
          const box = document.getElementById('tgGcErr'); if (box) { box.textContent = err; box.hidden = !err; }
          if (!err) gcApply(v);
        }
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
      const gdefs = tgAssignments(subj);
      if (sub) sub.textContent += gcTxt(sid, subj, gdefs);
      const ggr = body.querySelector('[data-gridgr-for="' + CSS.escape(sid) + '"]'); if (ggr) ggr.innerHTML = gcCell(sid, subj, gdefs);
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

    const gradeEdits = tgAutoEdits(subj, defs); // v17.52 · ระบบคิดเกรดให้เอง
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
      if (gradeSids.length) { await tgPushGrades(subj, gradeEdits, defs); tgState.gradeEdits[subj] = {}; }
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
    const acts = (typeof activities !== 'undefined' && Array.isArray(activities)) ? activities.filter((a) => !window.k8ActForMe || window.k8ActForMe(a)) : [];
    const now = new Date(); const in7 = new Date(now.getTime() + 7 * 864e5);
    const soon = acts.filter((a) => { const d = new Date(a.startDate || a.date); return !isNaN(d) && d >= new Date(ymd(now)) && d <= in7; }).length;

    // v17.62 · ต้องทำ: เฉพาะงานจริงของวันนี้ (คาบที่สอนวันนี้ · คะแนนที่ยังขาด · กิจกรรมใกล้ถึง) · ซ่อนรายการที่เป็น 0
    const gOf = {}; students.forEach((s) => { const m = String(s.grade || '').match(/([1-6])/); gOf[String(s.studentId).replace(/^0+/, '')] = m ? m[1] : ''; });
    const per = (window.k8TtMineToday && window.k8TtMineToday()) || [];
    const lblG = (g) => (String(g).indexOf('x:') === 0 ? 'กลุ่มพิเศษ' : 'ม.' + g);
    const perDone = (x) => cloudAtt.some((r) => r && r.date === today && String(r.subjectCode || '') === String(x.c.s || '') && (String(x.g).indexOf('x:') === 0 || gOf[String(r.studentId).replace(/^0+/, '')] === String(x.g)));
    const perLeft = per.filter((x) => !perDone(x));
    let gm = []; try { gm = window.k8GsModel ? window.k8GsModel() : []; } catch (e) { gm = []; }
    const gLeft = [];
    gm.forEach((c) => c.rows.forEach((r) => { const miss = r.studs.length - r.done; if (r.studs.length && miss > 0 && c.g !== '?') gLeft.push({ name: r.subj.name, g: c.g, miss }); }));
    gLeft.sort((x, y) => y.miss - x.miss);
    const gMiss = gLeft.reduce((t, x) => t + x.miss, 0);
    const more = (n) => (n > 0 ? ' และอีก ' + n : '');
    const rows = [
      perLeft.length ? { n: perLeft.length, title: 'เช็คชื่อคาบที่สอนวันนี้', sub: perLeft.slice(0, 2).map((x) => x.start + ' ' + x.c.sn + ' ' + lblG(x.g)).join(' · ') + more(perLeft.length - 2), bg: '#fffbeb', ink: '#b45309', go: "switchTeacherTab('attendance')" } : null,
      gLeft.length ? { n: gMiss, title: 'คะแนนที่ยังกรอกไม่ครบ', sub: gLeft.slice(0, 2).map((x) => x.name + ' ม.' + x.g + ' ขาด ' + x.miss + ' คน').join(' · ') + more(gLeft.length - 2 > 0 ? gLeft.length - 2 : 0) + (gLeft.length > 2 ? ' วิชา' : ''), bg: '#e0f2fe', ink: '#0369a1', go: "switchTeacherTab('grades')" } : null,
      soon ? { n: soon, title: 'กิจกรรมใกล้ถึง', sub: soon + ' กิจกรรมภายใน 7 วัน', bg: '#f0fdf4', ink: '#15803d', go: "switchTeacherTab('calendar')" } : null
    ];
    if (!rows.some(Boolean)) { list.innerHTML = '<p class="k8-todo-empty">' + (per.length ? 'เช็คชื่อครบทุกคาบแล้ว · ' : '') + 'ไม่มีงานค้างวันนี้ ✓</p>'; }
    else
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
      return { label: g.replace('มัธยมศึกษาปีที่ ', 'ม.'), n: list.length, done: done, possible: possible, pct: possible ? Math.round(done / possible * 100) : 0 };
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
    const KICO = ['<path d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM21 20v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>', '<path d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>', '<path d="M12 3c-3 3-5 5-5 8a5 5 0 0 0 10 0c0-3-2-5-5-8z"/><path d="M4 21h16"/>', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'];
    const KTONE = ['blue', 'green', 'teal', 'orange'];
    kpiEl.innerHTML = kpis.map((k, i) => '<button type="button" class="k8-kpi is-' + KTONE[i % 4] + '" onclick="' + k.go + '"><span class="k8-kpi-ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + KICO[i % 4] + '</svg></span><span class="k8-kpi-label">' + esc(k.label) + '</span><span class="k8-kpi-val">' + esc(k.value) + '</span><span class="k8-kpi-sub">' + esc(k.sub) + '</span></button>').join('');

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
      (function () { const L = window.k8SubjNoTeacher ? window.k8SubjNoTeacher() : []; return { n: L.length, label: 'วิชาที่ยังไม่ระบุผู้สอน: ' + L.slice(0, 4).map((x) => x.name).join(', ') + (L.length > 4 ? ' และอีก ' + (L.length - 4) + ' วิชา' : ''), cta: 'ดู', bg: '#fef2f2', ink: '#b91c1c', go: "switchAdminTab('subjects', document.getElementById('btnAdminTabSubjects'))" }; })(),
      { n: soon.length, label: 'กิจกรรมภายใน 7 วัน', cta: 'จัดการ', bg: '#f0fdf4', ink: '#15803d', go: "switchAdminTab('activities-admin', document.getElementById('btnTabActivitiesAdmin'))" }
    ];
    const todoShown = todo.filter((t) => +t.n > 0);
    document.getElementById('k8OvTodo').innerHTML = (todoShown.length ? '' : '<div class="k8-li-empty" style="text-align:left;padding:12px 0">ไม่มีงานค้าง เรียบร้อยดี ✓</div>') + todoShown.map((t) =>
      '<button type="button" class="k8-todo-row" onclick="' + t.go + '"><span class="k8-todo-badge" style="background:' + t.bg + ';color:' + t.ink + '">' + t.n + '</span><span class="k8-todo-text"><b>' + esc(t.label) + '</b></span><span class="k8-todo-cta">' + t.cta + '</span></button>'
    ).join('');

    const slotNames = wins.slice(0, passed).map((w) => w.name).join(', ');
    document.getElementById('k8OvPray').innerHTML = '<p class="k8-gbar-hint">เช็คชื่อแล้วกี่ครั้ง จากที่ควรมี (นักเรียนในชั้น × เวลาที่ผ่านมาแล้ว: ' + esc(slotNames) + ')</p>' + byGrade.map((g) =>
      '<div class="k8-gbar"><span class="k8-gbar-l">' + g.label + '</span><span class="k8-gbar-track" role="img" aria-label="' + g.label + ' เช็คแล้ว ' + g.done + ' จาก ' + g.possible + ' ครั้ง"><span style="width:' + g.pct + '%;background:' + (g.pct < 70 ? '#f59e0b' : '#0369a1') + '"></span></span><span class="k8-gbar-v">' + (g.n ? '<b>' + g.done + '/' + g.possible + '</b><small>' + g.pct + '%</small>' : '<small>ไม่มีนักเรียน</small>') + '</span></div>'
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
        ld.textContent = (vl.locationName || 'ตำแหน่งปัจจุบัน') + (vl.formattedMosqueDist && !vl.isWithinZone ? ' · ห่าง ' + vl.formattedMosqueDist : '');
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
      if (cs) cs.textContent = 'ละหมาด' + slot + ((window.k8OutboxStuck && window.k8OutboxStuck()) ? ' · เก็บในเครื่องแล้ว จะส่งอัตโนมัติเมื่อมีเน็ต' : ' · บันทึกเรียบร้อย');
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
    // v17.3 · ซ่อนปุ่มด้วย class บน footer (โค้ดเดิมรีเซ็ต className ของปุ่มบ่อย ทำให้ปุ่มกะพริบ)
    const hideBtn = done && step === 3 && (function () { try { return prayerCheckStep !== 2; } catch (e) { return true; } })();
    if (foot) foot.classList.toggle('k8-done', hideBtn);
    if (btn) btn.classList.remove('k8-hide');
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
      const acts = (typeof activities !== 'undefined' && Array.isArray(activities)) ? activities.filter((a) => !window.k8ActForMe || window.k8ActForMe(a)) : [];
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
    window.k8ThAvatarPaint && window.k8ThAvatarPaint();
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
    if (document.getElementById('k8ThPrayN')) {
      document.getElementById('k8ThPrayL').textContent = 'ละหมาด' + slot;
      document.getElementById('k8ThPrayN').textContent = pn;
      document.getElementById('k8ThPrayT').textContent = ' / ' + total;
      document.getElementById('k8ThPrayBar').style.width = (total ? Math.round(pn / total * 100) : 0) + '%';
    }
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
          return '<button type="button" role="radio" aria-label="' + label + '" data-s="' + label.charAt(0) + '" aria-checked="' + on + '" style="' + (on ? 'background:' + ink + ';color:#fff;border-color:' + ink : 'background:' + bg + ';color:' + ink + ';border-color:' + bg) + '" onclick="k8TaMark(\'' + esc(id) + '\',\'' + k + '\')">' + label + '</button>';
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
    // v17.43 · แบ่งกลุ่ม ชาย / หญิง / ยังไม่ระบุ · เรียง ก–ฮ โดยไม่นับคำนำหน้า
    const SEXK = { 'ชาย': 0, 'หญิง': 1, '': 2 };
    const sexOf = (s) => window.k8SexOf ? window.k8SexOf(s) : '';
    const bare = (s) => (window.k8BareName ? window.k8BareName(s) : String(s.fullName || ''));
    list = list.slice().sort((a, b) => (SEXK[sexOf(a)] - SEXK[sexOf(b)]) || bare(a).localeCompare(bare(b), 'th'));
    lastList = list;
    document.getElementById('k8AsSub').textContent = 'แสดง ' + list.length + ' คน · กดแถวเพื่อดูรายละเอียด';
    const gSel = document.getElementById('filterGradeSelect');
    const g = gSel ? gSel.value : '';
    document.getElementById('k8AsChips').innerHTML = [['', 'ทั้งหมด'], ...GR.map((x) => [x, shortG(x)])].map(([v, l]) =>
      '<button type="button" aria-pressed="' + (v === g) + '" onclick="k8AsGrade(\'' + v + '\')">' + l + '</button>').join('');
    const pr = prayer7();
    if (!selId || !list.some((s) => cid(s.studentId) === selId)) selId = list[0] ? cid(list[0].studentId) : null;
    const cnt = { 'ชาย': 0, 'หญิง': 0, '': 0 }; list.forEach((s) => { cnt[sexOf(s)]++; });
    let lastSex = null;
    body.innerHTML = list.length ? list.map((s) => {
      const sx = sexOf(s); let grp = '';
      if (sx !== lastSex) { lastSex = sx; grp = '<tr class="k8-as-grp is-' + (sx === 'ชาย' ? 'm' : sx === 'หญิง' ? 'f' : 'u') + '"><td colspan="6"><span>' + (sx ? 'นักเรียน' + sx : 'ยังไม่ระบุเพศ') + '</span><b>' + cnt[sx] + ' คน</b>' + (sx ? '' : '<button type="button" onclick="event.stopPropagation();k8GxOpen()">ระบุเพศ ›</button>') + '</td></tr>'; }
      const id = cid(s.studentId); const [stL, stBg, stInk] = statusPill(s.status);
      const ap = attPct(s); const pn = pr[norm(s.studentId)] || 0; const pp = Math.min(100, Math.round(pn / 35 * 100));
      return grp + '<tr class="' + (id === selId ? 'is-sel' : '') + '" onclick="k8AsSelect(\'' + esc(id) + '\')">' +
        '<td><button type="button" class="k8-as-name" onclick="event.stopPropagation();k8AsSelect(\'' + esc(id) + '\')"><b title="' + esc(s.fullName) + '">' + esc(s.fullName) + '</b><span>' + esc(id) + '</span></button></td>' +
        '<td>' + esc(shortG(s.grade)) + '</td>' +
        '<td><span class="k8-pill" style="background:' + stBg + ';color:' + stInk + '">' + esc(stL) + '</span></td>' +
        '<td class="b" style="color:' + (ap == null ? '#64748b' : ap >= 90 ? '#15803d' : ap >= 75 ? '#b45309' : '#b91c1c') + '">' + (ap == null ? '-' : ap + '%') + '</td>' +
        '<td><span class="k8-as-pr"><span class="k8-as-prbar"><span style="width:' + pp + '%"></span></span><span>' + pn + '/35</span></span></td>' +
        '<td class="r b">' + gpax(s) + '</td></tr>';
    }).join('') : '<tr><td colspan="6" class="k8-li-empty">ไม่พบนักเรียนตามเงื่อนไข</td></tr>';
    renderSplit(list, pr, cnt, sexOf);
    renderDetail(pr);
  }
  // v17.44 · แบ่งฝั่ง: ชายซ้าย หญิงขวา (ยังไม่ระบุเพศอยู่ด้านล่าง)
  function renderSplit(list, pr, cnt, sexOf) {
    const box = document.getElementById('k8AsSplit'); if (!box) return;
    const pic = (s) => { let u = ''; try { u = getDirectImageUrl((s.avatarUrl || s.profilePhoto) || ''); } catch (e) {} const ini = String(window.k8BareName ? window.k8BareName(s) : s.fullName || '?').charAt(0) || '?'; return u ? '<span class="k8-ss-pic has-img" style="background-image:url(&quot;' + esc(u) + '&quot;)" aria-hidden="true"></span>' : '<span class="k8-ss-pic" aria-hidden="true">' + esc(ini) + '</span>'; };
    const card = (s) => {
      const id = cid(s.studentId); const [stL, stBg, stInk] = statusPill(s.status); const pn = pr[norm(s.studentId)] || 0;
      const odd = !/ปกติ|กำลังศึกษา/.test(stL);
      return '<button type="button" class="k8-ss-row" onclick="k8AsSelect(\'' + esc(id) + '\')">' + pic(s) +
        '<span class="k8-ss-t"><b>' + esc(s.fullName || id) + '</b><small>' + esc(shortG(s.grade)) + ' · ' + esc(id) + (odd ? ' · <i style="color:' + stInk + '">' + esc(stL) + '</i>' : '') + '</small></span>' +
        '<span class="k8-ss-pr" title="ละหมาด 7 วัน"><b>' + pn + '</b>/35</span></button>';
    };
    const col = (sx, cls, title) => { const l = list.filter((s) => sexOf(s) === sx); return '<section class="k8-ss-col ' + cls + '" aria-label="' + title + '"><header><span class="k8-ss-dot" aria-hidden="true"></span><b>' + title + '</b><em>' + l.length + ' คน</em></header>' + (l.length ? '<div class="k8-ss-list">' + l.map(card).join('') + '</div>' : '<p class="k8-ss-empty">ไม่มีนักเรียนตามเงื่อนไข</p>') + '</section>'; };
    const un = list.filter((s) => !sexOf(s));
    box.innerHTML = '<div class="k8-ss-cols">' + col('ชาย', 'is-m', 'นักเรียนชาย') + col('หญิง', 'is-f', 'นักเรียนหญิง') + '</div>' +
      (un.length ? '<section class="k8-ss-col is-u"><header><span class="k8-ss-dot" aria-hidden="true"></span><b>ยังไม่ระบุเพศ</b><em>' + un.length + ' คน</em><button type="button" onclick="k8GxOpen()">ระบุเพศ ›</button></header><div class="k8-ss-list is-grid">' + un.map(card).join('') + '</div></section>' : '');
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
      '<dt>วันเกิด</dt><dd>' + (function () { const a = window.k8AgeOf && window.k8AgeOf(s.birthDate); if (!a) return '-'; const MN = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; return a.d + ' ' + MN[a.mo - 1] + ' ' + a.be + ' · <b>อายุ ' + a.y + ' ปี</b>'; })() + '</dd>' +
      '<dt>ละหมาด 7 วัน</dt><dd>' + (pr[norm(s.studentId)] || 0) + ' / 35 เวลา</dd><dt>GPAX</dt><dd>' + gpax(s) + '</dd></dl>' +
      '<div class="k8-as-acts"><button type="button" class="k8-btn-pri" onclick="openAdminEditStudentModal(\'' + esc(id) + '\')">แก้ไขข้อมูล</button>' +
      '<button type="button" class="k8-btn-line" onclick="openStudentQuickStatusModal(\'' + esc(id) + '\')">ปรับสถานะ</button>' +
      '<button type="button" class="k8-btn-line" onclick="k8AsPrayerHistory(\'' + esc(id) + '\')">ดูประวัติละหมาด</button>' +
      '<button type="button" class="k8-btn-line is-danger" onclick="deleteStudent(\'' + esc(id) + '\')">ลบนักเรียน</button></div>' +
      '<button type="button" class="k8-as-preview" hidden onclick="k8PreviewStudent(\'' + esc(id) + '\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>ดูแอปในมุมมองของนักเรียนคนนี้</button>';
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
  let refilter = false;
  // v17.85 · การซิงค์/บันทึกที่สั่งวาดตารางใหม่แบบไม่ส่งตัวกรอง เคยแสดงนักเรียนทุกชั้นทับตัวกรองที่เลือกไว้ (เด้งไปมา) · ใช้ตัวกรองปัจจุบันเสมอ
  if (typeof o === 'function') window.renderAdminStudentsTable = function (filtered) { if (filtered == null && !refilter && typeof filterAdminStudents === 'function') { refilter = true; try { return filterAdminStudents(); } finally { refilter = false; } } const r = o.apply(this, arguments); try { render(filtered); } catch (e) { console.warn('k8 students', e); } return r; };
})();

/* ============ Round 3 · Admin approvals (canvas AdminApprovals) ============ */
(function () {
  const TRASH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';
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
  window.k8ApCounts = function () { const R = regs(), L = lates(); return { accounts: R.filter((x) => !/approved/i.test(x.status)).length, prayers: L.filter((x) => ns(x.status) === 'pending').length }; };
  function render() {
    const grid = document.getElementById('k8ApGrid');
    if (!grid) return;
    const R = regs(), L = lates();
    const rp = R.filter((x) => !/approved/i.test(x.status)).length;
    const lp = L.filter((x) => ns(x.status) === 'pending').length;
    document.querySelectorAll('#k8ApTabs button').forEach((b) => {
      if (b.dataset.tab === 'leaves') { b.setAttribute('aria-selected', 'false'); return; }
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
            ? '<div class="k8-ap-otp"><span class="k8-ap-otp-l">รหัสยืนยัน</span><b class="k8-ap-otp-v">' + esc(/^\d{6}$/.test(String(a.otpCode || '')) ? a.otpCode : '------') + '</b><button type="button" onclick="k8ApCopy(\'' + js(a.otpCode || '') + '\')">คัดลอก</button></div>' +
              (a.emailError ? '<p class="k8-ap-mail is-bad">ส่งอีเมลไม่สำเร็จ: ' + esc(a.emailError) + '</p>' : a.emailSent ? '<p class="k8-ap-mail">ส่งอีเมลแล้ว · ถ้าผู้สมัครยังไม่ได้รับ ให้ดูในจดหมายขยะ (Spam) หรือแจ้งรหัสนี้ให้โดยตรง</p>' : '<p class="k8-ap-mail">ถ้าอีเมลไม่เข้า แจ้งรหัสนี้ให้ผู้สมัครกรอกเอง หรือกด "ยืนยันบัญชีแทน"</p>') +
              '<div class="k8-ap-sent"><button type="button" class="is-ok" onclick="k8ApVerify(\'' + js(key) + '\')">ยืนยันบัญชีแทน</button><button type="button" onclick="adminApproveRegistration(\'' + js(key) + '\')">ส่งอีเมลอีกครั้ง</button></div>' +
              '<button type="button" class="k8-ap-del" onclick="adminRejectRegistration(\'' + js(key) + '\')">' + TRASH + 'ลบคำขอนี้</button>'
            : '<div class="k8-ap-acts"><button type="button" class="is-ok" onclick="adminApproveRegistration(\'' + js(key) + '\')">อนุมัติ &amp; ส่งรหัสทางอีเมล</button><button type="button" class="is-no" onclick="adminRejectRegistration(\'' + js(key) + '\')">ปฏิเสธ</button></div>') +
          '</article>';
      }).join('') : '<div class="k8-li-empty">ไม่มีบัญชีใหม่ที่รออนุมัติ</div>';
    } else {
      const sorted = L.slice().sort((a, b) => (ns(a.status) === 'pending' ? 0 : 1) - (ns(b.status) === 'pending' ? 0 : 1));
      grid.innerHTML = sorted.length ? sorted.map((l) => {
        const s = ns(l.status);
        const photo = l.photoUrl ? '<button type="button" class="k8-ap-photo" onclick="viewPhotoInNewTab(\'' + js(l.photoUrl) + '\')" aria-label="ดูภาพหลักฐาน"><img src="' + esc(l.photoUrl) + '" alt="ภาพหลักฐาน" loading="lazy"></button>' : '<div class="k8-ap-photo is-empty">ไม่มีภาพ</div>';
        return '<article class="k8-ap-card k8-ap-late">' + photo + '<div class="k8-ap-lb"><b>' + esc(l.studentName || l.studentId) + (l.grade ? ' · ' + esc(String(l.grade).replace('มัธยมศึกษาปีที่ ', 'ม.')) : '') + '</b>' +
          '<span class="k8-ap-meta">' + esc(l.prayerSlot || '-') + ' · ' + esc(l.date || '-') + '</span>' + (l.photoUrl ? (function () { const ps = String(l.photoSource || ''); const cam = /camera|กล้อง/.test(ps); const gal = /gallery|แนบ/.test(ps); return '<span class="k8-ap-src ' + (cam ? 'is-cam' : gal ? 'is-gal' : '') + '">' + (cam ? '📷 ถ่ายจากกล้อง' : gal ? '🖼️ แนบจากเครื่อง' : 'รูปแนบ (ไม่ทราบที่มา)') + '</span>'; })() : '') + '<span class="k8-ap-why">เหตุผล: ' + esc([l.reasonPreset, l.reasonDetail].filter(Boolean).join(' · ') || '-') + '</span>' +
          (s === 'pending'
            ? '<div class="k8-ap-acts2"><button type="button" class="is-ok" onclick="adminApprovePrayerRequest(\'' + js(l.id) + '\')">อนุมัติ</button><button type="button" class="is-no" onclick="adminRejectPrayerRequest(\'' + js(l.id) + '\')">ไม่อนุมัติ</button></div>'
            : '<span class="k8-ap-done" style="color:' + (s === 'approved' ? '#15803d' : '#b91c1c') + '">' + (s === 'approved' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ') + (l.approvedBy || l.rejectedBy ? ' โดย ' + esc(l.approvedBy || l.rejectedBy) : '') + '</span>') +
          '<button type="button" class="k8-ap-del" onclick="k8ApDelLate(\'' + js(l.id) + '\')">' + TRASH + 'ลบ</button>' +
          '</div></article>';
      }).join('') : '<div class="k8-li-empty">ไม่มีคำขอละหมาดย้อนหลัง</div>';
    }
  }
  window.k8ApDelLate = async function (id) {
    let list = []; try { list = getPrayerApprovalsList(); } catch (e) {}
    const l = list.find((x) => x.id === id);
    if (!confirm('ลบคำขอละหมาดย้อนหลังของ ' + ((l && (l.studentName || l.studentId)) || '') + ' ใช่ไหม?\nลบแล้วกู้คืนไม่ได้ (บันทึกละหมาดที่อนุมัติไปแล้วจะยังอยู่)')) return;
    try { savePrayerApprovalsList(list.filter((x) => x.id !== id)); } catch (e) {}
    window.renderApprovalsV8();
    let r = null; try { r = await gasApiCall('deletePrayerLateRequest', { data: { reqId: id } }, 20000); } catch (e) { r = null; }
    try { showToast(r && r.success ? 'ลบคำขอแล้ว' : 'ลบในเครื่องแล้ว · ระบบหลังบ้านยังไม่ได้อัปเดต (Deploy Code.gs ตัวล่าสุด)', r && r.success ? 'success' : 'warning'); } catch (e) {}
    try { if (typeof renderSuperAdminOverviewKpis === 'function') renderSuperAdminOverviewKpis(); } catch (e) {}
  };
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
  window.k8ApCopy = function (code) {
    if (!/^\d{6}$/.test(String(code))) { try { showToast('ยังไม่มีรหัส · กด "ส่งอีเมลอีกครั้ง" เพื่อสร้างรหัส', 'warning'); } catch (e) {} return; }
    const done = () => { try { showToast('คัดลอกรหัส ' + code + ' แล้ว', 'success'); } catch (e) {} };
    try { navigator.clipboard.writeText(String(code)).then(done, () => prompt('คัดลอกรหัสยืนยัน', code)); } catch (e) { prompt('คัดลอกรหัสยืนยัน', code); }
  };
  // แอดมินยืนยันบัญชีแทนผู้สมัคร (ใช้รหัสยืนยันที่ระบบสร้าง) · ไม่ต้องรออีเมล
  window.k8ApVerify = async function (key) {
    let L = []; try { L = getPendingRegistrations(); } catch (e) {}
    const a = L.find((p) => (p.reqId || p.id || p.userId) === key); if (!a) return;
    if (!/^\d{6}$/.test(String(a.otpCode || ''))) { try { showToast('ยังไม่มีรหัสยืนยัน · กด "ส่งอีเมลอีกครั้ง" ก่อน', 'warning'); } catch (e) {} return; }
    if (!confirm('ยืนยันบัญชีของ ' + (a.fullName || a.userId) + ' แทนผู้สมัครเลยใช่ไหม?\nหลังจากนี้ผู้สมัครเข้าสู่ระบบได้ทันทีโดยไม่ต้องกรอกรหัส')) return;
    let r = null; try { r = await gasApiCall('verifyUserOtp', { data: { reqId: a.reqId || a.id, userId: a.userId, role: a.role, otpCode: String(a.otpCode) } }, 25000); } catch (e) { r = null; }
    if (r && (r.success || r.alreadyVerified)) {
      try { const L2 = getPendingRegistrations().filter((p) => (p.reqId || p.id || p.userId) !== key); savePendingRegistrations(L2); } catch (e) {}
      try { if (typeof fetchPendingApprovalsFromCloud === 'function') fetchPendingApprovalsFromCloud(); if (typeof syncAllDataFromCloud === 'function') syncAllDataFromCloud(); } catch (e) {}
      try { renderPendingApprovalsTable(true); } catch (e) {}
      try { showToast('ยืนยันบัญชีของ ' + (a.fullName || a.userId) + ' แล้ว · เข้าสู่ระบบได้ทันที', 'success'); } catch (e) {}
    } else {
      try { showToast((r && r.message) || 'ยืนยันไม่สำเร็จ ลองใหม่อีกครั้ง', 'error'); } catch (e) {}
    }
  };
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
  window.k8OtpNoEmail = function () { if (typeof showToast === 'function') showToast('ยังไม่ได้รับอีเมล? ดูในโฟลเดอร์จดหมายขยะ (Spam) หรือ "โปรโมชัน" ก่อน · ถ้ายังไม่มี ขอรหัส 6 หลักจากแอดมินได้เลย แอดมินดูรหัสได้ในหน้าอนุมัติบัญชี', 'info'); };
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
/* อายุจากวันเกิด "DDMMYYYY" (ปี พ.ศ. หรือ ค.ศ.) → { y, m } */
window.k8AgeOf = function (bd) {
  const t = String(bd || '').replace(/\D/g, ''); let d, mo, y;
  if (t.length === 8 && +t.slice(0, 4) > 1800) { y = +t.slice(0, 4); mo = +t.slice(4, 6); d = +t.slice(6, 8); } else if (t.length === 8 || t.length === 7) { const p = t.padStart(8, '0'); d = +p.slice(0, 2); mo = +p.slice(2, 4); y = +p.slice(4, 8); } else return null;
  if (y > 2400) y -= 543;
  if (!d || !mo || mo > 12 || d > 31 || y < 1900) return null;
  const now = new Date(); let yy = now.getFullYear() - y, mm = now.getMonth() + 1 - mo;
  if (now.getDate() < d) mm--; if (mm < 0) { yy--; mm += 12; }
  return yy < 0 || yy > 120 ? null : { y: yy, m: mm, d, mo, be: y + 543 };
};
window.k8RegBirthChange = function (v) {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) { const h = document.getElementById('regBirthDate'); if (h && !v) h.value = ''; return; }
  if (+m[1] > 2400) m[1] = String(+m[1] - 543); // บางเครื่องตั้งปฏิทินพุทธ ส่งปี พ.ศ. มา
  try { if (typeof initBirthDatePicker === 'function') initBirthDatePicker(); } catch (e) {}
  const d = document.getElementById('regBirthDay'), mo = document.getElementById('regBirthMonth'), y = document.getElementById('regBirthYear');
  if (!d || !mo || !y) return;
  const be = String(+m[1] + 543);
  if (!Array.from(y.options).some((o) => o.value === be)) { const o = document.createElement('option'); o.value = be; o.textContent = be; y.appendChild(o); }
  d.value = m[3]; mo.value = m[2]; y.value = be;
  try { syncBirthDatePicker(); } catch (e) {}
  const ag = document.getElementById('k8RegAge');
  if (ag) { const a = window.k8AgeOf(m[3] + m[2] + be); ag.hidden = a == null; if (a != null) { const MN = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']; ag.innerHTML = 'เกิด ' + (+m[3]) + ' ' + MN[+m[2] - 1] + ' ' + be + ' · <b>อายุ ' + a.y + ' ปี' + (a.m ? ' ' + a.m + ' เดือน' : '') + '</b>'; } }
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
    'admin-tab-timetable': ['ตารางสอน', 'จัดตารางเรียน ม.1–ม.6 รายคาบ เลือกวิชา อาจารย์ ห้องเรียน แล้วเปิดให้อาจารย์และนักเรียนดูได้'],
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
    const list = (window.k8TeacherSubjects ? window.k8TeacherSubjects(a) : subs).slice(); // v17.60 · เฉพาะวิชาที่อาจารย์สอน
    if (S.sub && S.subject && !list.some((x) => String(x.id) === String(S.subject))) { const o = subs.find((x) => String(x.id) === String(S.subject)); list.push(o || { id: S.subject, name: S.subName || S.subject }); } // สอนแทน
    return list; // v17.65 · ไม่มี "โฮมรูม / ทั้งวัน" แล้ว (เช็คชื่อตามรายวิชา/คาบสอนเท่านั้น)
  }
  function subjLabel(id) { const x = subjects().find((s) => String(s.id) === String(id)); return x ? x.name : (id === '__none' || !id ? 'ยังไม่ได้เลือกคาบ' : id); }
  function logs() { return readJSON('khalifah_attendance_logs', []); }
  // v17.90 · แยกตามคาบ (period) · แถวเก่าที่ไม่มีเลขคาบ ใช้เป็นค่าของคาบแรกที่ยังไม่มีบันทึก
  function savedMap(date, subj, per) {
    const m = {}; per = per == null ? S.period : per; per = per ? String(per) : '';
    const L = logs().filter((r) => r && r.date === date && String(r.subjectCode || '') === String(subj || ''));
    const exact = L.filter((r) => String(r.period || '') === per);
    const hasAnyPer = L.some((r) => r.period);
    (exact.length ? exact : (!hasAnyPer || !per ? L.filter((r) => !r.period) : [])).forEach((r) => { m[norm(r.studentId)] = toKey(r.status); });
    if (!subj) { const loc = (readJSON('khalifah_daily_attendance_logs', {})[date]) || {}; Object.keys(loc).forEach((k) => { if (!m[norm(k)]) m[norm(k)] = loc[k]; }); }
    return m;
  }
  const dkey = () => S.date + '|' + (S.subject || '') + '|' + (S.period || '');
  // v17.26 · ถ้าวิชานี้มีนักเรียนลงทะเบียนแล้ว แสดงเฉพาะคนที่ลงทะเบียน (สลับดูทุกคนได้)
  const EN = { map: null, loading: false, all: false };
  async function loadEnroll(force) {
    if (EN.loading || (EN.map && !force)) return; EN.loading = true;
    let r = null; try { r = await gasApiCall('getEnrollments', {}, 20000); } catch (e) {}
    EN.loading = false; EN.map = (r && r.success) ? (r.data || {}) : (EN.map || {});
    render();
  }
  window.k8TaLoadEnroll = loadEnroll;
  window.k8TaEnAll = function (on) { EN.all = !!on; render(); };
  const enrolledFor = () => (S.subject && EN.map && Array.isArray(EN.map[S.subject]) && EN.map[S.subject].length) ? EN.map[S.subject] : null;
  // v17.85 · รายชื่อ = นักเรียนตามตารางเรียนของคาบนี้ (ชั้น + เพศ + เฉพาะ/ละเว้นบางคน) + คนที่สแกนลงทะเบียนเพิ่ม (เช่น เรียนซ้ำ/แก้เกรด)
  //           เดิมถ้ามีคนลงทะเบียนแล้ว จะแสดงเฉพาะคนที่ลงทะเบียน ทำให้คนที่ยังไม่สแกนหายไปจากรายชื่อ
  function rows() {
    const all = (typeof allStudents !== 'undefined' ? allStudents : []).filter((s) => s && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(s.status || '')));
    const inGrade = all.filter((s) => S.grade === 'ALL' || s.grade === S.grade);
    if (EN.all) return inGrade;
    const P = periods().filter((x) => String(x.subj) === String(S.subject) && x.grade === S.grade && x.c);
    const girl = (st) => !!(window.k8IsGirl && window.k8IsGirl(st));
    const fits = (st, c) => { const id = norm(st.studentId); if (c.o && c.o.length && c.o.map(norm).indexOf(id) === -1) return false; if (c.x && c.x.map(norm).indexOf(id) !== -1) return false; if (c.gx === 'm' && girl(st)) return false; if (c.gx === 'f' && !girl(st)) return false; return true; };
    const base = P.length ? inGrade.filter((st) => P.some((x) => fits(st, x.c))) : inGrade;
    const en = enrolledFor();
    if (en) { const have = new Set(base.map((st) => norm(st.studentId))); all.forEach((st) => { const id = norm(st.studentId); if (!have.has(id) && en.indexOf(id) !== -1) { base.push(st); have.add(id); } }); }
    return base;
  }

  function render() {
    const listEl = document.getElementById('k8TaList'); if (!listEl) return;
    const subs = subjects();
    if (S.subject !== '__none' && (S.subject == null || !subs.some((x) => String(x.id) === String(S.subject)))) S.subject = subs[0] ? subs[0].id : '';
    if (!subs.length && !S.subMode) { listEl.innerHTML = '<li class="k8-li-empty">ยังไม่มีวิชาที่คุณสอน · ให้แอดมินระบุชื่อคุณในตารางสอน หรือกำหนดวิชาให้ในข้อมูลอาจารย์</li>'; const ss0 = document.getElementById('k8TaSubject'); if (ss0) ss0.innerHTML = ''; return; }
    const ss = document.getElementById('k8TaSubject');
    if (ss) ss.innerHTML = subs.map((x) => '<option value="' + esc(x.id) + '"' + (String(x.id) === String(S.subject) ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('');
    const di = document.getElementById('k8TaDateInput'); if (di) { di.value = S.date; di.removeAttribute('max'); }
    const dl = document.getElementById('k8TaDateLbl');
    if (dl) { const dd = new Date(S.date + 'T00:00:00'); const TD = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']; const TM = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; const t = ymd(new Date()); dl.textContent = TD[dd.getDay()] + ' ' + dd.getDate() + ' ' + TM[dd.getMonth()] + (dd.getFullYear() !== new Date().getFullYear() ? ' ' + (dd.getFullYear() + 543) : '') + (S.date === t ? ' · วันนี้' : ''); dl.parentElement.title = 'แตะเพื่อเลือกวันที่'; dl.parentElement.classList.toggle('is-today', S.date === t); }
    const all = (typeof allStudents !== 'undefined' ? allStudents : []);
    const gs = document.getElementById('k8TaGrade');
    const GR = ['ALL', 'มัธยมศึกษาปีที่ 1', 'มัธยมศึกษาปีที่ 2', 'มัธยมศึกษาปีที่ 3', 'มัธยมศึกษาปีที่ 4', 'มัธยมศึกษาปีที่ 5', 'มัธยมศึกษาปีที่ 6'];
    if (gs) gs.innerHTML = GR.map((g) => { const n = g === 'ALL' ? all.length : all.filter((s) => s.grade === g).length; return (g === 'ALL' || n) ? '<option value="' + g + '"' + (g === S.grade ? ' selected' : '') + '>' + (g === 'ALL' ? 'ทุกระดับชั้น' : g) + ' · ' + n + ' คน</option>' : ''; }).join('');
    const saved = savedMap(S.date, S.subject);
    const draft = S.draft[dkey()] || (S.draft[dkey()] = {});
    const cnt = { present: 0, late: 0, leave: 0, absent: 0 }; let unsaved = 0, changed = 0;
    if (EN.map === null) loadEnroll();
    // v17.68 · แสดงรายชื่อเฉพาะเมื่อเลือกคาบสอน (ของตัวเอง หรือคาบที่รับสอนแทน) ของวันนั้น
    const Pm = periods();
    const gate = Pm.some((x) => String(x.subj) === String(S.subject) && x.grade === S.grade);
    const list = gate ? rows() : [];
    const en = enrolledFor();
    const enBar = gate ? '<li class="k8-ro-bar"><span>' + (EN.all ? 'แสดงนักเรียนทั้งชั้น' : 'ตามตารางเรียน <b>' + list.length + '</b> คน' + (en ? ' · สแกนลงทะเบียนแล้ว ' + en.length : '')) + '</span><button type="button" onclick="k8TaEnAll(' + (EN.all ? 'false' : 'true') + ')">' + (EN.all ? 'เฉพาะตามตาราง' : 'แสดงทั้งชั้น') + '</button></li>' : '';
    listEl.innerHTML = enBar + (list.length ? list.map((s, ix) => {
      const id = cid(s.studentId), k = norm(s.studentId);
      const cur = draft[k] || saved[k] || 'present';
      cnt[cur]++; if (!saved[k]) unsaved++; else if (draft[k] && draft[k] !== saved[k]) changed++;
      return '<li class="k8-ta-card' + (saved[k] ? ' is-saved' : '') + '"><span class="k8-ta-no" aria-hidden="true">' + (ix + 1) + '</span><div class="k8-ta-top"><span class="k8-ta-av">' + esc(initialOf(s.fullName)) + '</span><span class="k8-ta-name" title="' + esc(s.fullName) + '">' + esc(s.fullName) + '</span><span class="k8-ta-id">' + esc(id) + (S.grade === 'ALL' ? ' · ' + esc(shortG(s.grade)) : '') + '</span></div>' +
        '<div class="k8-ta-opts" role="radiogroup" aria-label="สถานะของ ' + esc(s.fullName) + '">' + KINDS.map(([kk, label, ink, bg]) => { const on = cur === kk; return '<button type="button" role="radio" aria-checked="' + on + '" style="' + (on ? 'background:' + ink + ';color:#fff;border-color:' + ink : 'background:' + bg + ';color:' + ink + ';border-color:' + bg) + '" onclick="k8TaMark(\'' + js(k) + '\',\'' + kk + '\')"><span class="k8-ta-lf">' + label + '</span><span class="k8-ta-ls" aria-hidden="true">' + label.charAt(0) + '</span></button>'; }).join('') + '</div></li>';
    }).join('') : '<li class="k8-li-empty k8-ta-none">' + (gate ? 'ไม่มีนักเรียนในระดับชั้นนี้' : !Pm.length ? (S.subMode ? 'ไม่มีคาบของอาจารย์ท่านอื่นใน' + (S.date === ymd(new Date()) ? 'วันนี้' : 'วันที่ ' + fmtDate(S.date)) : '<b>ไม่มีคาบสอนของคุณใน' + (S.date === ymd(new Date()) ? 'วันนี้' : 'วันที่ ' + fmtDate(S.date)) + '</b><span>ถ้าต้องสอนแทนกะทันหัน กดปุ่ม "สอนแทน" เพื่อดูทุกคาบของ' + (S.date === ymd(new Date()) ? 'วันนี้' : 'วันนั้น') + '</span>') : 'เลือกคาบสอนจากแถบด้านบนเพื่อเช็คชื่อ') + '</li>');
    document.getElementById('k8TaSum').innerHTML = KINDS.map(([kk, label, ink, bg]) => '<div style="background:' + bg + ';color:' + ink + '"><b>' + cnt[kk] + '</b><span>' + label + '</span></div>').join('');
    const pe = document.getElementById('k8TaPending');
    pe.textContent = unsaved ? 'ยังไม่บันทึก ' + unsaved + ' คน' : changed ? 'แก้ไข ' + changed + ' คน ยังไม่บันทึก' : 'บันทึกครบทุกคนแล้ว';
    pe.style.color = (unsaved || changed) ? '#b45309' : '#15803d';
    document.getElementById('k8TaFootSub').textContent = subjLabel(S.subject) + ' · ' + fmtDate(S.date);
    const note = document.getElementById('k8TaSavedNote');
    const anySaved = Object.keys(saved).length > 0;
    note.hidden = !anySaved;
    if (anySaved) note.textContent = 'วันนี้วิชานี้เคยเช็คชื่อแล้ว ' + Object.keys(saved).length + ' คน · แก้ไขแล้วกดบันทึกเพื่ออัปเดต';
    try { tpPaint(cnt, list.length, unsaved, changed); } catch (e) { console.warn('k8 ta tp', e); }
    // v17.64 · ลำดับการปรับบนมือถือ: ปุ่มคำเต็ม → ชื่อ 2 บรรทัด → ถ้ายังไม่พอ ย่อปุ่มเป็น ม ส ล ข (เฉพาะแถวนั้น)
    requestAnimationFrame(() => {
      const desk = document.documentElement.classList.contains('k8-tpd');
      listEl.querySelectorAll('.k8-ta-card').forEach((c) => {
        c.classList.remove('is-short'); if (desk) return;
        const n = c.querySelector('.k8-ta-name'); if (!n) return;
        const lh = parseFloat(getComputedStyle(n).lineHeight) || 19;
        if (n.offsetHeight > lh * 2 + 2 && getComputedStyle(c).flexDirection === 'row') c.classList.add('is-short');
      });
    });
  }
  // ---------- v17.63 · คอมพิวเตอร์ (PD1): คาบสอนวันนี้ทางซ้าย + ตารางรายชื่อทางขวา ----------
  const GN = (g) => (String(g).indexOf('x:') === 0 ? 'ALL' : 'มัธยมศึกษาปีที่ ' + g);
  const toMin = (t) => { const m = String(t || '').match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : NaN; };
  function periods() {
    const L = S.subMode ? ((window.k8TtAllOn && window.k8TtAllOn(S.date)) || []).filter((x) => !x.mine) : ((window.k8TtMineOn && window.k8TtMineOn(S.date)) || []);
    const today = S.date; const realToday = ymd(new Date()); const nowM = S.date < realToday ? 24 * 60 : S.date > realToday ? -1 : new Date().getHours() * 60 + new Date().getMinutes();
    const all = (typeof allStudents !== 'undefined' ? allStudents : []);
    return L.map((x, i) => {
      const grade = GN(x.g);
      const sv = savedMap(today, x.c.s || '', x.p);
      const ids = all.filter((st) => grade === 'ALL' || st.grade === grade).map((st) => norm(st.studentId));
      const done = ids.some((id) => sv[id]);
      const st = toMin(x.start), en = toMin(x.end);
      const state = done ? 'done' : (nowM >= st && nowM < en) ? 'now' : nowM >= en ? (S.date < realToday ? 'miss' : 'late') : 'next';
      return { i, subj: x.c.s || '', name: x.c.sn || subjLabel(x.c.s), g: x.g, grade, start: x.start, end: x.end, room: x.c.r || '', state, left: en - nowM, tn: x.c.tn || x.c.t || '', c: x.c, p: x.p };
    });
  }
  const PST = { miss: ['ยังไม่ได้เช็คชื่อ', 'is-late'], done: ['เช็คแล้ว ✓', 'is-done'], now: ['ตอนนี้ · ยังไม่เช็ค', 'is-now'], late: ['เลยเวลาแล้ว · ยังไม่เช็ค', 'is-late'], next: ['ยังไม่ถึงเวลา', 'is-next'] };
  let rzT = 0; window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { const t = document.getElementById('teacher-tab-attendance'); if (t && t.offsetParent) render(); }, 150); });
  window.k8TaMore = function () { S.showF = !S.showF; render(); };
  window.k8TaPick = function (subj, grade, tn, per) { S.subject = subj; S.grade = grade; S.period = per || ''; S.picked = true; S.sub = S.subMode ? { tn: tn || 'อาจารย์ประจำวิชา' } : null; S.subName = S.sub ? (P_NAME[subj + '|' + grade] || '') : ''; render(); };
  const P_NAME = {};
  window.k8TaSubMode = function (on) { S.subMode = !!on; S.sub = null; S.subject = on ? '__none' : null; if (!on) S.autoDone = false; render(); }; // v17.65 · คงวันที่ที่เลือกไว้ (เช็คย้อนหลังได้)
  function autoPick(P) {
    if (S.subMode || S.autoDone || !P.length) return; S.autoDone = true;
    const c = P.find((x) => x.state === 'now') || P.find((x) => x.state === 'late') || P.find((x) => x.state === 'next');
    if (c && S.date === ymd(new Date())) { S.subject = c.subj; S.grade = c.grade; S.period = c.p || ''; setTimeout(render, 0); } else S.autoDone = S.date === ymd(new Date());
  }
  function tpPaint(cnt, n, unsaved, changed) {
    const root = document.querySelector('#teacher-tab-attendance .k8-ta'); if (!root) return;
    let aside = document.getElementById('k8TaPer');
    if (!aside) {
      aside = document.createElement('aside'); aside.id = 'k8TaPer'; aside.className = 'k8-ta-per'; aside.setAttribute('aria-label', 'คาบสอนวันนี้');
      const main = document.createElement('div'); main.className = 'k8-ta-main';
      while (root.firstChild) main.appendChild(root.firstChild);
      main.insertAdjacentHTML('afterbegin', '<div class="k8-ta-dh" id="k8TaDh"></div>');
      root.appendChild(aside); root.appendChild(main);
    }
    // v17.64 · มือถือ: แถบคาบอยู่ใต้หัวข้อ "เช็คชื่อมาเรียน" (แบบ PM1/PM7) · คอม: คอลัมน์ซ้าย
    const desk = document.documentElement.classList.contains('k8-tpd');
    const headRow = root.querySelector('.k8-ta-head > .k8-ta-row');
    if (desk) { if (aside.parentElement !== root || root.firstChild !== aside) root.insertBefore(aside, root.firstChild); }
    else if (headRow && aside.previousElementSibling !== headRow) headRow.after(aside);
    // v17.67 · มือถือ: แถบบันทึกอยู่ท้ายรายชื่อ และติดด้านล่างจอ (เหนือแถบเมนู) เสมอ
    const foot = root.querySelector('.k8-ta-foot'), lst = root.querySelector('#k8TaList');
    if (foot && lst && lst.nextElementSibling !== foot) lst.after(foot);

    const P = periods(); autoPick(P);
    const isToday = S.date === ymd(new Date()); const onDay = true;
    aside.innerHTML = '<div class="k8-ta-per-hd"><b class="k8-ta-per-h">' + (S.subMode ? 'สอนแทน · ทุกคาบ' : 'คาบสอน') + (isToday ? 'วันนี้' : ' ' + esc(fmtDate(S.date))) + '</b>' +
      (S.subMode ? '<button type="button" class="k8-ta-subbtn is-on" onclick="k8TaSubMode(false)">‹ คาบของฉัน</button>' : '<button type="button" class="k8-ta-subbtn" onclick="k8TaSubMode(true)">สอนแทน</button>') + '</div>' + (P.length ? P.map((x) => {
      const on = onDay && String(S.subject) === String(x.subj) && S.grade === x.grade;
      P_NAME[x.subj + '|' + x.grade] = x.name;
      return '<button type="button" class="k8-ta-pc ' + PST[x.state][1] + (on ? ' is-on' : '') + (S.subMode ? ' is-sub' : '') + '" aria-pressed="' + on + '" onclick="k8TaPick(\'' + js(x.subj) + '\',\'' + js(x.grade) + '\',\'' + js(x.tn) + '\',\'' + (x.p || '') + '\')"><span class="k8-ta-pc-t"><span>' + esc(x.start + '–' + x.end) + '</span><span>คาบ ' + (x.i + 1) + '</span></span><b>' + esc(x.name) + ' · ' + esc(x.grade === 'ALL' ? 'กลุ่มพิเศษ' : shortG(x.grade)) + '</b>' + (S.subMode ? '<small class="k8-ta-pc-tn">แทน ' + esc(x.tn || 'ยังไม่ระบุผู้สอน') + '</small>' : '') + '<small>' + PST[x.state][0] + (x.state === 'now' && x.left > 0 ? ' · เหลือ ' + x.left + ' นาที' : '') + '</small></button>';
    }).join('') : '<p class="k8-ta-per-empty">' + (S.subMode ? 'ไม่มีคาบของอาจารย์ท่านอื่น' : (isToday ? 'วันนี้' : 'วันนั้น') + 'ไม่มีคาบสอนของคุณ') + '</p>');
    const cur = P.find((x) => String(S.subject) === String(x.subj) && S.grade === x.grade);
    const title = cur ? subjLabel(S.subject) + ' · ' + (S.grade === 'ALL' ? 'ทุกชั้น' : shortG(S.grade)) : (S.subMode ? 'สอนแทน · เลือกคาบ' : 'ไม่มีคาบสอน');
    root.classList.toggle('no-roster', !cur);
    const sub = [fmtDate(S.date), cur ? cur.start + '–' + cur.end + (cur.state === 'now' && cur.left > 0 ? ' · เหลือ ' + cur.left + ' นาที' : '') : '', n + ' คน', unsaved ? 'ยังไม่บันทึก ' + unsaved + ' คน' : changed ? 'แก้ไข ' + changed + ' คน' : 'บันทึกแล้ว'].filter(Boolean).join(' · ');
    document.getElementById('k8TaDh').innerHTML = '<div class="k8-ta-dh-t"><h2>' + esc(title) + (S.sub && cur ? ' <em class="k8-ta-subtag">เช็คชื่อแทน ' + esc(S.sub.tn) + '</em>' : '') + '</h2><span>' + esc(sub) + '</span></div><div class="k8-ta-dh-c">' +
      KINDS.map(([kk, label, ink, bg]) => '<span style="background:' + bg + ';color:' + ink + '"><b>' + cnt[kk] + '</b> ' + label + '</span>').join('') + '</div>' +
      '<button type="button" class="k8-ta-dh-b is-hist" onclick="k8TaOpenHistory()">ประวัติ</button><button type="button" class="k8-ta-dh-b is-all" onclick="k8TaAll(\'present\')">ทุกคนมา</button><button type="button" class="k8-ta-dh-b is-save" onclick="k8TaSave()">บันทึก</button>';
    // v17.64 · มือถือแบบ PM7: หัวข้อสั้น + วันที่ · แถบคาบ · สรุปบรรทัดเดียว + ทุกคนมา · ตัวเลือกวิชา/วันที่พับเก็บ
    if (!desk && headRow) {
      let sub = document.getElementById('k8TaMSub');
      if (!sub) { headRow.querySelector('h1').insertAdjacentHTML('afterend', '<span class="k8-ta-msub" id="k8TaMSub"></span>'); sub = document.getElementById('k8TaMSub'); const h = headRow.querySelector('h1'); const w = document.createElement('div'); w.className = 'k8-ta-mt'; h.before(w); w.appendChild(h); w.appendChild(sub); }
      sub.textContent = fmtDate(S.date).replace(' (วันนี้)', '') + (isToday ? ' · วันนี้สอน ' + P.length + ' คาบ' : ' · ย้อนหลัง · สอน ' + P.length + ' คาบ');
      let ms = document.getElementById('k8TaMSum');
      if (!ms) { aside.insertAdjacentHTML('afterend', '<div class="k8-ta-msum" id="k8TaMSum"></div>'); ms = document.getElementById('k8TaMSum'); }
      else if (ms.previousElementSibling !== aside) aside.after(ms);
      const cur2 = P.find((x) => String(S.subject) === String(x.subj) && S.grade === x.grade);
      ms.innerHTML = (S.sub && cur2 ? '<div class="k8-ta-subnote">เช็คชื่อแทน <b>' + esc(S.sub.tn) + '</b> · ระบบจะบันทึกว่าเป็นการเช็คชื่อแทน</div>' : '') + '<span class="k8-ta-msum-c">' + KINDS.map(([kk, label, ink]) => '<span><b style="color:' + ink + '">' + cnt[kk] + '</b> ' + label + '</span>').join('') + '</span>' +
        '<button type="button" class="k8-ta-mall" onclick="k8TaAll(\'present\')">ทุกคนมา</button><span class="k8-ta-br"></span>' +
        '<button type="button" class="k8-ta-mmore" aria-expanded="' + !!S.showF + '" onclick="k8TaMore()">' + (S.showF ? 'ซ่อน ⌃' : 'เปลี่ยนวันที่ · เช็คย้อนหลัง ⌄') + '</button>' +
        (isToday ? '' : '<button type="button" class="k8-ta-mtoday" onclick="k8TaSet(\'date\',\'' + ymd(new Date()) + '\')">กลับไปวันนี้</button>');
      root.classList.toggle('show-f', !!S.showF);
    }
  }
  function fmtDate(d) { const x = new Date(d + 'T00:00:00'); return DAYS[x.getDay()] + ' ' + x.getDate() + ' ' + MON[x.getMonth()] + ' ' + (x.getFullYear() + 543) + (d === ymd(new Date()) ? ' (วันนี้)' : ''); }

  window.k8TaSet = function (k, v) { if (k === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) return; S[k] = v; render(); };
  window.k8TaDay = function (n) { const d = new Date(S.date + 'T00:00:00'); d.setDate(d.getDate() + n); S.date = ymd(d); render(); };
  window.k8TaMark = function (k, st) { (S.draft[dkey()] = S.draft[dkey()] || {})[k] = st; render(); };
  window.k8TaAll = function (st) { const d = S.draft[dkey()] = S.draft[dkey()] || {}; rows().forEach((s) => { d[norm(s.studentId)] = st; }); render(); if (typeof showToast === 'function') showToast('ตั้งเป็น "มา" ทุกคนแล้ว กดบันทึกเพื่อยืนยัน', 'info'); };
  window.k8TaSave = async function () {
    if (!periods().some((x) => String(x.subj) === String(S.subject) && x.grade === S.grade)) { if (typeof showToast === 'function') showToast('เลือกคาบสอนก่อนเช็คชื่อ', 'warning'); return; }
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
      res = await gasApiCall('saveDailyAttendance', { subFor: S.sub ? S.sub.tn : '', date: S.date, grade: S.grade === 'ALL' ? '' : S.grade, subjectCode: subj.id || '', subjectName: subj.name || '', period: S.period || '', teacherId: a ? a.username : '', teacherName: a ? (a.fullName || a.username) : '', records: records, studentDetails: details });
    } catch (e) { res = { success: false, message: (typeof describeNetworkError === 'function' ? describeNetworkError(e) : 'เชื่อมต่อไม่สำเร็จ') }; }
    if (btn) { btn.disabled = false; btn.textContent = 'บันทึก'; }
    if (!res || !res.success) { if (typeof showToast === 'function') showToast((res && res.message) || 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 'error'); return; }
    // อัปเดตแคชในเครื่อง
    const L = logs().filter((r) => !(r && r.date === S.date && String(r.subjectCode || '') === String(subj.id || '') && String(r.period || '') === String(S.period || '') && records[cid(r.studentId)] !== undefined));
    const TH = { present: 'มา', late: 'มาสาย', leave: 'ลา', absent: 'ขาด' };
    const now = new Date();
    Object.keys(records).forEach((id) => L.push({ studentId: id, studentName: details[id].fullName, grade: details[id].grade, date: S.date, time: pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':00', status: TH[records[id]], note: S.sub ? 'เช็คชื่อแทน ' + S.sub.tn : '', subjectCode: subj.id || '', subjectName: subj.name || '', period: S.period || '', checkedBy: a ? (a.fullName || a.username) : '' }));
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
      if (/ฝากเช็คชื่อ|เช็คชื่อแทน/.test(String(r.note || ''))) d.sub = String(r.note).replace(/\s*\(โดย.*$/, ''); // v17.68
      d[toKey(r.status)]++;
    });
    const dates = Object.keys(byDate).sort().reverse();
    body.innerHTML = dates.length ? dates.map((d) => { const x = byDate[d]; return '<button type="button" class="k8-hist-row" onclick="k8TaGoDate(\'' + d + '\')"><span class="k8-hist-d"><b>' + fmtDate(d) + '</b>' + (x.sub ? '<small class="k8-hist-sub">' + esc(x.sub) + '</small>' : '') + (x.by ? '<small>โดย ' + esc(x.by) + '</small>' : '') + '</span><span class="k8-hist-c">' + KINDS.map(([kk, l, ink, bg]) => '<i style="background:' + bg + ';color:' + ink + '">' + l + ' ' + x[kk] + '</i>').join('') + '</span></button>'; }).join('')
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

  // v17.18 · แอดมินเลือกนักเรียนแล้วบันทึกแทน (window.k8HasTarget) · นักเรียนดูได้อย่างเดียว
  function admin() { try { return currentAdmin || null; } catch (e) { return null; } }
  function stu() { if (admin() && window.k8HasTarget) return window.k8HasTarget; try { return currentStudent || null; } catch (e) { return null; } }
  const RO = () => !(admin() && window.k8HasTarget);
  window.k8HasRO = RO;
  const roMsg = () => { if (typeof showToast === 'function') showToast('ข้อมูลผลบุญบันทึกโดยแอดมิน · นักเรียนดูได้อย่างเดียว', 'info'); };
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
  function dayPages(date) { if (RO()) { const r0 = rowOf(date); return r0 ? Number(r0.quran && r0.quran.pagesToday) || 0 : 0; } const h = H(); const d = h && h.dailyLogs && h.dailyLogs[date]; if (d && typeof d.quranPages === 'number') return d.quranPages; if (d && typeof d.pagesToday === 'number') return d.pagesToday; const r = rowOf(date); return r && r.quran ? Number(r.quran.pagesToday) || 0 : 0; }
  function daySunnah(date) { const h = H(); const d = !RO() && h && h.dailyLogs && h.dailyLogs[date]; if (d && d.sunnah) return d.sunnah; const r = rowOf(date); if (r && r.sunnah) { const rw = r.sunnah.rawatib || {}; return { rawatib: rw, duhaRakaat: Number(rw.duhaRakaat) || 0, witrRakaat: Number(rw.witrRakaat) || 0, tahajjudRakaat: Number(rw.tahajjudRakaat) || 0, totalRakaat: Number(r.sunnah.totalRakaat) || 0 }; } return null; }
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
    if (!RO()) Object.keys(h.dailyLogs || {}).forEach((d) => { if (d >= from && d <= to) mem += ((h.dailyLogs[d].memNew) || []).length; });
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
    if (RO()) return;
    const payload = { studentId: s.studentId, date: date, studentName: s.fullName, grade: s.grade,
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
    const tg = !RO() ? stu() : null;
    return (tg ? '<div class="k8h-as"><span>กำลังบันทึกให้ <b>' + esc(tg.fullName || tg.studentId) + '</b> · ' + esc(String(tg.grade || '').replace('มัธยมศึกษาปีที่ ', 'ม.')) + '</span><button type="button" onclick="k8HasBack()">‹ กลับไปเลือกนักเรียน</button></div>' : '') + '<header class="k8h-head"><h1>' + (tg ? 'บันทึกผลบุญ' : 'ผลบุญของฉัน') + '</h1>' + (RO() ? '<p class="k8h-ro-note">บันทึกโดยแอดมิน · ดูได้อย่างเดียว</p>' : '') +
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
    const shown = list.filter((x) => (S.memFilter === 'all' || (S.memFilter === 'amma' && x.num >= 78) || (S.memFilter === 'done' && mem.has(x.num)) || (S.memFilter === 'todo' && !mem.has(x.num))) && (!q || String(x.num) === q || x.name.indexOf(q) !== -1 || (x.arabic || '').indexOf(q) !== -1)).slice().sort((a, b) => b.num - a.num); // v17.76 · เรียงจากซูเราะห์ท้าย (114) ขึ้นบนสุด
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
      '<h3 class="k8h-sub">รอติบ (ก่อน-หลังฟัรฎู)</h3><ul class="k8h-checks">' + RAWATIB.map(([k, l, n, mu]) => '<li><label><input type="checkbox"' + (x.rawatib[k] ? ' checked' : '') + (RO() ? ' disabled' : '') + ' onchange="k8HasSun(\'' + k + '\', this.checked)"><span><b>' + l + '</b><small>' + n + ' ร็อกอะฮ์' + (mu ? ' · มุอักกัด' : '') + '</small></span></label></li>').join('') + '</ul>' +
      EXTRA.map(([k, l, opts]) => '<h3 class="k8h-sub">' + l + '</h3><div class="k8h-chips">' + opts.map((o) => '<button type="button" aria-pressed="' + ((Number(x[k + 'Rakaat']) || 0) === o) + '" onclick="k8HasSunN(\'' + k + '\',' + o + ')">' + (o ? o + ' ร็อกอะฮ์' : 'ไม่ได้ทำ') + '</button>').join('') + '</div>').join('') +
      '<button type="button" class="k8h-save is-purple" onclick="k8HasSaveSun()"' + (dirty ? '' : ' disabled') + '>' + (dirty ? 'บันทึกละหมาดสุนัต (' + total + ' ร็อกอะฮ์)' : '✓ บันทึกแล้ว') + '</button></section>';
  }
  function render() {
    const root = document.getElementById('k8Has'); if (!root) return;
    if (!stu()) { root.innerHTML = '<p class="k8-li-empty">กรุณาเข้าสู่ระบบ</p>'; return; }
    if (!S.date) S.date = today();
    document.documentElement.classList.toggle('k8-has-readonly', RO());
    root.innerHTML = header() + (S.tab === 'quran' ? quranTab() : S.tab === 'memorize' ? memTab() : sunTab());
  }
  window.renderHasanatV9 = render;
  // v17.76 · ปุ่ม "ออก" ลอยขึ้นมาเมื่อเลื่อนหน้าผลบุญ
  window.k8HasExit = function () { if (admin() && window.k8HasTarget) return window.k8HasBack(); try { switchView('dashboard'); } catch (e) {} try { window.scrollTo({ top: 0 }); } catch (e) {} };
  (function () {
    let btn = null, raf = 0;
    const tick = () => { raf = 0; const v = document.getElementById('view-hasanat'); const on = !!(v && v.classList.contains('active') && document.getElementById('k8Has') && window.scrollY > 240);
      if (on && !btn) { btn = document.createElement('button'); btn.type = 'button'; btn.className = 'k8h-exit'; btn.setAttribute('aria-label', 'ออกจากหน้านี้'); btn.innerHTML = '<span aria-hidden="true">✕</span> ออก'; btn.onclick = () => window.k8HasExit(); document.body.appendChild(btn); }
      if (btn) btn.classList.toggle('is-on', on); };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
    document.addEventListener('click', () => setTimeout(tick, 60), true);
  })();
  window.k8HasSet = function (k, v) { S[k] = v; render(); };
  window.k8HasDate = function (v) { if (/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) { S.date = v; S.add = 0; render(); } };
  const future = () => { if (S.date > today()) { if (typeof showToast === 'function') showToast('ยังไม่ถึงวันที่เลือก · บันทึกล่วงหน้าไม่ได้', 'warning'); return true; } return false; };
  window.k8HasDay = function (n) { const d = new Date(S.date + 'T00:00:00'); d.setDate(d.getDate() + n); S.date = ymd(d); S.add = 0; render(); };
  window.k8HasAdd = function (n) { if (RO()) { roMsg(); return; } S.add = Math.max(0, Math.min(PAGES, (S.add | 0) + n)); render(); };
  window.k8HasMemQ = function (el) { S.memQ = el.value; const pos = el.selectionStart; render(); const n = document.querySelector('.k8h-search'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } };
  window.k8HasSaveQuran = function () { if (RO()) { roMsg(); return; }
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
  window.k8HasSaveEdit = function () { if (RO()) { roMsg(); return; }
    const h = H(); if (!h) return;
    const p = Math.max(0, Math.min(PAGES, parseInt(document.getElementById('k8hEditPage').value, 10) || 0));
    const k = Math.max(0, Math.min(99, parseInt(document.getElementById('k8hEditKh').value, 10) || 0));
    h.quran = Object.assign({}, h.quran, { currentPage: p, khatamCount: k, juzCompleted: Math.min(30, Math.floor(p / PER_JUZ)), stars: Math.min(30, Math.floor(p / PER_JUZ)) });
    saveH(h); S.editPage = false; render(); push(S.date, 'อัปเดตหน้าปัจจุบันเป็นหน้า ' + p + ' แล้ว');
  };
  let memTimer = null;
  window.k8HasToggleSurah = function (num) { if (RO()) { roMsg(); return; }
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
  window.k8HasSun = function (k, v) { if (RO()) { roMsg(); render(); return; } S.sun.rawatib[k] = !!v; render(); };
  window.k8HasSunN = function (k, n) { if (RO()) { roMsg(); return; } S.sun[k + 'Rakaat'] = n; render(); };
  window.k8HasSaveSun = function () { if (RO()) { roMsg(); return; }
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
  if (typeof sv === 'function') window.switchView = function (v) { const r = sv.apply(this, arguments); if (v === 'hasanat') { S.date = today(); S.add = 0; S.sun = null; S.tab = S.tab || 'quran'; render(); } else if (v !== 'hasanat' && window.k8HasTarget && v !== 'admin') { window.k8HasTarget = null; } return r; };
  window.k8HasBack = function () { window.k8HasTarget = null; try { switchView('admin'); switchAdminTab('hasanat-admin', document.getElementById('btnAdminTabHasanat')); } catch (e) {} };
})();

/* ============ Round 8 · Teacher evaluation (anonymous) ============ */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const js = (v) => esc(String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
  const E = { targets: [], items: [], term: '', done: [], cur: null, scores: [], comment: '' };
  const LABELS = ['ควรปรับปรุง', 'พอใช้', 'ปานกลาง', 'ดี', 'ดีมาก'];
  async function load() {
    const [t, d] = await Promise.all([gasApiCall('getEvaluationTargets', {}), gasApiCall('getMyEvaluationStatus', {})]);
    if (t && t.success) { E.targets = t.data || []; E.items = t.items || []; E.term = t.term; E.open = t.open === undefined ? true : !!t.open; }
    if (d && d.success) E.done = d.done || [];
    badge();
  }
  function badge() { const b = document.getElementById('k8EvalBadge'); if (!b) return; if (E.open === false) { b.textContent = 'ยังไม่เปิด'; return; } const left = E.targets.filter((x) => E.done.indexOf(x.subjectCode + '|' + x.teacher) === -1).length; b.textContent = E.targets.length ? (left ? 'ค้าง ' + left + ' วิชา' : 'ครบแล้ว ✓') : ''; b.className = 'k8-pl-badge' + (left ? ' is-todo' : ''); }
  function list() {
    const body = document.getElementById('k8EvalBody');
    document.getElementById('k8EvalSub').textContent = 'ภาคเรียนที่ ' + (E.term || '-') + ' · ไม่ระบุชื่อผู้ประเมิน';
    if (E.open === false) { body.innerHTML = '<div class="k8-eval-closed"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><b>ยังไม่เปิดให้ประเมินอาจารย์</b><span>แอดมินจะเปิดระบบเมื่อถึงช่วงประเมิน แล้วกลับมาที่นี่อีกครั้ง</span></div>'; return; }
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
    // นักเรียนที่เพิ่งสมัคร/เพิ่งเข้าระบบ: นับเวลาที่ต้องละหมาดตั้งแต่วันถัดจากวันที่สมัครเท่านั้น
    const joinOf = (st) => { const m = String(st.registeredAt || st.createdAt || '').match(/(\d{4})-(\d{2})-(\d{2})/); if (!m) return ''; let y = +m[1]; if (y > 2400) y -= 543; return y + '-' + m[2] + '-' + m[3]; };
    const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
    const expFor = (st) => { const j = joinOf(st); if (!j || j < start) return expected; if (j >= end) return 0; return Math.max(0, dayDiff(j, end) - 1) * 5 + todaySlots; };
    let tp = []; try { tp = todayPrayers || []; } catch (e) {}
    const recs = {};
    [...readJSON('khalifah_prayer_history', []), ...tp].forEach((p) => {
      if (!p) return; const d = String(p.date || p.timestamp || '').slice(0, 10); if (!d || d < start || d > end) return;
      const k = norm(p.studentId) + '|' + d + '|' + slotKey(p.prayerTime || p.prayerName || ''); recs[k] = p;
    });
    readJSON('khalifah_prayer_approvals', []).forEach((a) => { if (!a || !/approved|อนุมัติ/i.test(String(a.status || '')) || !a.date || a.date < start || a.date > end) return; const k = norm(a.studentId) + '|' + a.date + '|' + slotKey(a.prayerSlot || ''); if (!recs[k]) recs[k] = { studentId: a.studentId, status: 'อนุมัติย้อนหลัง', note: [a.reasonPreset, a.reasonDetail].filter(Boolean).join(' · '), date: a.date }; });
    const by = {}; studs.forEach((s) => { by[norm(s.studentId)] = { s, on: 0, late: 0, excused: 0, notes: [], exp: expFor(s), join: joinOf(s) }; });
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
      const E = Math.max(x.exp, x.on + x.late + x.excused); x.exp = E; x.isNew = x.exp === 0;
      const done = x.on + x.late; const miss = Math.max(0, E - done - x.excused);
      x.miss = miss; x.rate = E ? Math.round(x.on / E * 100) : 0;
      if (x.isNew) tiers.mid.push(x);
      else if (E && miss / E >= 0.4) (x.notes.length ? tiers.note : tiers.miss).push(x);
      else if (x.late >= 3 && done && x.late / done >= 0.3) tiers.late.push(x);
      else if (E && x.on / E >= 0.8) tiers.s.push(x);
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
    all.forEach((x) => { const denom = Math.max(0, x.exp - x.excused); x.score = denom ? Math.min(100, Math.round((x.on + 0.5 * x.late) / denom * 1000) / 10) : (x.isNew ? -1 : 100); x.denom = denom; });
    all.sort((a, b) => (a.isNew - b.isNew) || b.score - a.score || b.on - a.on || a.miss - b.miss || a.late - b.late || String(a.s.fullName).localeCompare(String(b.s.fullName), 'th'));
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
    const cnt = { good: 0, mid: 0, low: 0, new: 0 }; all.forEach((x) => { x.level = x.isNew ? 'new' : levelOf(x.score); cnt[x.level]++; });
    const q = T.q.trim().toLowerCase();
    let list = all.filter((x) => T.level === 'all' || x.level === T.level);
    if (q) list = list.filter((x) => String(x.s.fullName || '').toLowerCase().includes(q) || norm(x.s.studentId).includes(q.replace(/^0+/, '')));
    const intro = '<div class="k8-rk-intro"><p>ช่วง <b>' + T.days + ' วันล่าสุด</b> นักเรียนแต่ละคนควรละหมาด <b>' + expected + ' เวลา</b>' + (cnt.new ? ' · <b>' + cnt.new + ' คน</b>เพิ่งเข้าระบบ ยังไม่นับ' : '') + ' · คนที่สมัครระหว่างช่วงนี้นับตั้งแต่วันที่สมัคร'+' · เรียงจากคนที่ละหมาดตรงเวลามากที่สุด</p>' +
      '<div class="k8-rk-levels" role="group" aria-label="กรองตามระดับ">' +
      '<button type="button" aria-pressed="' + (T.level === 'all') + '" onclick="k8TierSet(\'level\',\'all\')"><b>' + all.length + '</b><span>ทั้งหมด</span></button>' +
      ['good', 'mid', 'low'].map((k) => '<button type="button" aria-pressed="' + (T.level === k) + '" style="--c:' + LV[k][1] + ';--bg:' + LV[k][2] + '" onclick="k8TierSet(\'level\',\'' + k + '\')"><b>' + cnt[k] + '</b><span>' + LV[k][0] + '</span><small>' + (k === 'good' ? '80% ขึ้นไป' : k === 'mid' ? '50–79%' : 'ต่ำกว่า 50%') + '</small></button>').join('') + '</div></div>';
    const legend = '<div class="k8-rk-legend"><span><i style="background:#16a34a"></i>ตรงเวลา</span><span><i style="background:#f59e0b"></i>สาย</span><span><i style="background:#60a5fa"></i>ลา/อุซุร</span><span><i style="background:#ef4444"></i>ขาด</span></div>';
    const shown = list.slice(0, T.limit);
    const rows = shown.map((x) => { const lv = LV[x.level] || ['เพิ่งเข้าระบบ', '#475569', '#f1f5f9']; const done = x.on + x.late; const pct = (n) => x.exp ? (n / x.exp * 100) : 0;
      if (x.isNew) return '<li class="k8-rk-row is-new"><span class="k8-rk-no">–</span><span class="k8-rk-who"><b>' + esc(x.s.fullName) + '</b><small>' + esc(shortG(x.s.grade)) + ' · ' + esc(String(x.s.studentId || '')) + '</small></span><span class="k8-rk-bar"><span class="k8-rk-newtxt">เพิ่งเข้าระบบ' + (x.join ? ' เมื่อ ' + (function () { const p = x.join.split('-'); return +p[2] + '/' + +p[1] + '/' + (+p[0] + 543); })() : '') + ' · เริ่มนับตั้งแต่วันถัดไป</span></span><span class="k8-rk-score"><b>–</b><span style="color:#475569;background:#f1f5f9">ใหม่</span><small>ละหมาดแล้ว ' + done + '</small></span></li>';
      return '<li class="k8-rk-row">' +
        (function () { const medal = x.rank <= 3 && x.score > 0; return '<span class="k8-rk-no' + (medal ? ' is-medal' : '') + '" aria-label="อันดับ ' + x.rank + '">' + (medal ? ['🥇', '🥈', '🥉'][x.rank - 1] : x.rank) + '</span>'; })() +
        '<span class="k8-rk-who"><b>' + esc(x.s.fullName) + '</b><small>' + esc(shortG(x.s.grade)) + ' · ' + esc(String(x.s.studentId || '')) + '</small></span>' +
        '<span class="k8-rk-bar" role="img" aria-label="ตรงเวลา ' + x.on + ' สาย ' + x.late + ' ลา ' + x.excused + ' ขาด ' + x.miss + ' จาก ' + x.exp + ' เวลา">' +
          '<span class="k8-rk-track"><i style="width:' + pct(x.on) + '%;background:#16a34a"></i><i style="width:' + pct(x.late) + '%;background:#f59e0b"></i><i style="width:' + pct(x.excused) + '%;background:#60a5fa"></i><i style="width:' + pct(x.miss) + '%;background:#ef4444"></i></span>' +
          '<span class="k8-rk-nums"><em class="ok">ตรงเวลา ' + x.on + '</em><em class="late">สาย ' + x.late + '</em>' + (x.excused ? '<em class="ex" title="' + esc(x.notes.slice(0, 3).join(' / ')) + '">ลา ' + x.excused + '</em>' : '') + '<em class="miss">ขาด ' + x.miss + '</em></span></span>' +
        '<span class="k8-rk-score"><b>' + Math.round(x.score) + '%</b><span style="color:' + lv[1] + ';background:' + lv[2] + '">' + lv[0] + '</span><small>ละหมาดแล้ว ' + done + '/' + x.exp + (x.exp < expected ? ' · นับตั้งแต่สมัคร' : '') + '</small></span></li>'; }).join('');
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
    if (sub) sub.textContent = a && a.limited ? (a.limited === 'exec' ? 'ผู้บริหาร' : 'ฝ่ายกิจกรรม') + ' · ' + (a.fullName || a.username) : a && a.isSubAdmin ? 'แอดมินรอง · ' + (a.fullName || a.username) : 'ศูนย์ควบคุมแอดมิน';
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
    ['EXECUTIVE', 'ผู้บริหาร', 'ดูนักเรียน อาจารย์ ละหมาด อันดับ พฤติกรรม รายวิชา เกรด หะละเกาะฮฺ · แก้ตารางสอนและอนุมัติลาสอนได้ (เข้าทางแท็บแอดมิน ใช้รหัสผ่านอย่างเดียว)', false],
    ['ActivityAdmin', 'ฝ่ายกิจกรรม', 'ดูกิจกรรมและสแกน/เช็คชื่อเข้ากิจกรรม · เพิ่มหรือลบกิจกรรมไม่ได้ (เข้าทางแท็บแอดมิน ใช้รหัสผ่านอย่างเดียว)', false],
    ['NIGHTDUTY', 'ครูเวรหอพักกลางคืน', 'บันทึกคะแนนพฤติกรรม (รวมหมวดการอ่านหนังสือ ชาย ม.4–6) · สร้างกิจกรรมและเปิด QR ให้นักเรียนสแกน (เข้าทางแท็บแอดมิน ใช้รหัสผ่านอย่างเดียว)', false],
    ['INSPECTOR', 'ผู้ตรวจการ', 'ตรวจเครื่องแต่งกาย หอพัก ห้องน้ำ ความประพฤติ · หัก/เพิ่มคะแนนพฤติกรรม (เข้าทางแท็บแอดมิน ใช้รหัสผ่านอย่างเดียว)', false],
    ['SubAdmin', 'แอดมินรอง', 'เข้าระบบแอดมินได้ ยกเว้นตั้งค่าระบบและจัดการแอดมิน (เข้าทางแท็บแอดมิน ใช้รหัสผ่านอย่างเดียว)', true],
    ['SuperAdmin', 'แอดมิน (สิทธิ์เท่าแอดมินหลัก)', 'ทำได้ทุกอย่างเหมือนแอดมินหลัก รวมถึงตั้งค่าระบบ จัดการแอดมิน และให้สิทธิ์ผู้อื่น (เข้าทางแท็บแอดมิน ใช้รหัสผ่านอย่างเดียว) · เฉพาะแอดมินหลักเลือกได้', true]
  ];
  const PW_ONLY = ['EXECUTIVE', 'ActivityAdmin', 'NIGHTDUTY', 'INSPECTOR', 'SubAdmin', 'SuperAdmin'];
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
    if (pwOnly()) { const pre = { EXECUTIVE: 'exec', INSPECTOR: 'insp', SubAdmin: 'sub', SuperAdmin: 'adm' }[nfRole] || 'staff'; const c = 'abcdefghjkmnpqrstuvwxyz23456789'; let r = ''; for (let i = 0; i < 5; i++) r += c[Math.floor(Math.random() * c.length)]; user = pre + '-' + r; }
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
    const payload = { adminId: 'TCH-' + Date.now(), username: user, password: pass, fullName: name, email: email, phone: phone, role: nfRole, assignedSubjects: subjects, /* v17.60 · ไม่เลือก = ยังไม่กำหนดวิชา (ไม่ใช่ทุกวิชา) */ assignedSubject: (subjects[0] || allSubs[0] || ''), status: 'Active', approvalStatus: 'Verified', createdAt: new Date().toLocaleDateString('sv-SE') };
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
    if (typeof showToast === 'function') showToast('สร้างบัญชี' + roleName + ' "' + name + '" แล้ว · ชื่อผู้ใช้ ' + user + (pwOnly() ? ' (เข้าทางแท็บแอดมิน ใช้รหัสผ่านอย่างเดียว)' : ' (เข้าทางแท็บอาจารย์)'), 'success');
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
  const APP_VERSION = '17.99b';
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
          : /SamsungBrowser/i.test(ua)
            ? '<li>แตะไอคอน <b>ติดตั้ง ⤓</b> ที่แถบที่อยู่ด้านบน (ถ้ามี) หรือแตะเมนู <b>≡</b> ขวาล่าง → <b>“เพิ่มหน้าไปที่”</b> → <b>“หน้าจอหลัก”</b> แล้วกด <b>ติดตั้ง</b></li><li>ถ้าเคยเพิ่มไว้แล้วแต่เปิดแล้วยังเห็นลิงก์ด้านบน ให้ลบไอคอนเดิมออกก่อน แล้วติดตั้งใหม่</li><li>เปิดแอปจากไอคอน KHALIFAH (จะเต็มจอ ไม่มีแถบลิงก์)</li>'
            : /Firefox|FxiOS/i.test(ua)
              ? '<li>แตะเมนู <b>⋮</b> → <b>“ติดตั้ง”</b> หรือ “เพิ่มไปยังหน้าจอหลัก”</li><li>เปิดแอปจากไอคอน KHALIFAH</li>'
              : /EdgA|Edg\//i.test(ua)
                ? '<li>แตะเมนู <b>⋯</b> ด้านล่าง → <b>“เพิ่มลงในโทรศัพท์”</b> / “ติดตั้งแอป”</li><li>เปิดแอปจากไอคอน KHALIFAH</li>'
                : /MiuiBrowser|HuaweiBrowser|HeyTapBrowser|VivoBrowser|OPR\//i.test(ua)
                  ? '<li>เบราว์เซอร์นี้ติดตั้งแอปแบบเต็มจอไม่ได้ทุกรุ่น · แนะนำเปิดลิงก์นี้ใน <b>Chrome</b></li><li>ใน Chrome แตะเมนู ⋮ → <b>“ติดตั้งแอป”</b></li>'
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
    reading: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    dress: '<path d="M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3a4 4 0 0 1-8 0z"/>',
    dorm: '<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18h18M3 18v3M21 18v3M6 10V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4"/>',
    toilet: '<path d="M7 3h6v7H7zM5 10h14a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6zM9 16l-1 5h8l-1-5"/>',
    conduct: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    good: '<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/>'
  };
  const CATS = [['dress', 'เครื่องแต่งกาย', '#1d4ed8', '#eff6ff'], ['dorm', 'ความสะอาดหอพัก', '#7c3aed', '#f5f3ff'], ['toilet', 'ห้องน้ำ', '#0e7490', '#ecfeff'], ['conduct', 'ความประพฤติ', '#b45309', '#fffbeb'], ['reading', 'การอ่านหนังสือ', '#4338ca', '#eef2ff'], ['good', 'ทำความดี (เพิ่มคะแนน)', '#15803d', '#f0fdf4']];
  const catOf = (k) => CATS.find((c) => c[0] === k) || CATS[3];
  const svg = (k, s) => '<svg width="' + (s || 20) + '" height="' + (s || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICO[k] || ICO.conduct) + '</svg>';
  // ใช้ภาคเรียนจากเซิร์ฟเวอร์เป็นหลัก (ตรงกับที่บันทึกในชีต) ถ้ายังไม่ได้โหลดใช้ค่าในเครื่อง
  let serverTerm = '';
  function term() { return serverTerm || window.k8Term().key; }
  const level = (sc) => sc >= 90 ? ['ดีมาก', '#15803d', '#dcfce7'] : sc >= 70 ? ['ปกติ', '#1d4ed8', '#dbeafe'] : sc >= 50 ? ['ต้องดูแล', '#b45309', '#fef3c7'] : ['ต้องติดตามใกล้ชิด', '#b91c1c', '#fee2e2'];
  const me = () => { try { return currentAdmin || null; } catch (e) { return null; } };
  const isInspector = () => { const a = me(); return !!a && /INSPECTOR|ผู้ตรวจการ/i.test(String(a.realRole || a.role || '')); };
  const isAdmin = () => { const a = me(); return !!a && a.role === 'SuperAdmin' && !a.limited; };
  // v17.79 · หมวดการอ่านหนังสือ: เฉพาะนักเรียนชาย ม.4–ม.6
  const eligible = (s) => { if (B.cat !== 'reading') return true; const m = String((s && s.grade) || '').match(/([1-6])/); return !!m && +m[1] >= 4 && !(window.k8IsGirl && window.k8IsGirl(s)); };
  const api = (a, p) => (typeof gasApiCall === 'function' ? gasApiCall(a, p || {}, 25000) : Promise.reject(new Error('no api')));
  const toast = (m, t) => { if (typeof showToast === 'function') showToast(m, t); };

  const B = { rules: [], logs: [], students: [], loaded: false, loading: false, tab: 'record', cat: 'dress', ruleId: '', sel: new Set(), q: '', grade: 'ALL', note: '', date: ymd(new Date()), custom: { title: '', points: -5 }, saving: false, hq: '', hRange: 'today', hMine: false, sq: '', sGrade: 'ALL', sLevel: 'all', editRules: null };

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
      if (r && r.success) { B.oldBackend = !r.photoMax; B.codeVersion = r.codeVersion || ''; if (r.term) serverTerm = r.term; B.rules = r.rules || []; B.logs = r.logs || []; if (r.students && r.students.length) B.students = r.students; B.loaded = true; try { localStorage.setItem('khalifah_behavior_cache', JSON.stringify({ rules: B.rules, logs: B.logs, students: B.students })); } catch (e) {} }
      else if (r && r.message) toast(r.message, 'error');
    } catch (e) {
      try { const c = JSON.parse(localStorage.getItem('khalifah_behavior_cache') || 'null'); if (c) { B.rules = c.rules || []; B.logs = c.logs || []; B.students = c.students || []; } } catch (er) {}
      toast('โหลดข้อมูลพฤติกรรมไม่สำเร็จ · แสดงข้อมูลล่าสุดในเครื่อง', 'warning');
    }
    B.loading = false; render();
  }

  function roots() { return ['k8BhInsp', 'k8BhAdmin', 'k8BhTeach'].map((id) => document.getElementById(id)).filter((el) => el && el.offsetParent !== null); }
  function render() {
    const keep = {}; ['.k8-bh-stu', '.k8-bh-list', '.k8-bh-hist'].forEach((sel) => { const el = document.querySelector(sel); if (el) keep[sel] = el.scrollTop; });
    const wy = window.scrollY;
    renderInner();
    Object.keys(keep).forEach((sel) => { const el = document.querySelector(sel); if (el) el.scrollTop = keep[sel]; });
    if (Math.abs(window.scrollY - wy) > 1) window.scrollTo(0, wy);
  }
  function renderInner() {
    roots().forEach((root) => {
      const admin = root.dataset.mode === 'admin'; const teach = root.dataset.mode === 'teacher';
      const tabs = admin ? [['record', 'บันทึก'], ['scores', 'คะแนนนักเรียน'], ['history', 'ประวัติ']].concat(me() && me().limited ? [] : [['rules', 'ตั้งค่าหัวข้อ']]) : teach ? [['record', 'บันทึก'], ['scores', 'คะแนนนักเรียน'], ['history', 'ประวัติ']] : null;
      if ((!admin || (me() && me().limited)) && B.tab === 'rules') B.tab = 'record';
      let html = tabs ? '<div class="k8-bh-tabs" role="tablist">' + tabs.map(([k, l]) => '<button type="button" role="tab" aria-selected="' + (B.tab === k) + '" onclick="k8BhTab(\'' + k + '\')">' + l + '</button>').join('') + '</div>' : '';
      if (B.oldBackend && B.loaded) html += '<div class="k8-tt-warn" role="alert"><b>Code.gs ที่ใช้งานอยู่ยังเป็นรุ่นเก่า · รูปหลักฐานเก็บได้แค่ 1 รูป</b><span>แอดมิน: วาง Code.gs ตัวล่าสุด แล้วไปที่ Deploy → Manage deployments → กดไอคอนดินสอของ deployment เดิม → Version: New version → Deploy (ห้ามกด New deployment เพราะจะได้ลิงก์ใหม่ที่แอปไม่ได้ใช้)</span></div>';
      if (!B.loaded && B.loading) html += '<div class="k8-bh-card k8-bh-empty">กำลังโหลด…</div>';
      else html += B.tab === 'record' ? recordHtml() : B.tab === 'scores' ? scoresHtml() : B.tab === 'history' ? historyHtml(admin) : rulesHtml();
      root.innerHTML = html;
    });
    document.querySelectorAll('#k8InspNav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === B.tab));
  }

  function recordHtml() {
    const sm = scoreMap();
    const girlOf = (s) => !!(window.k8IsGirl && window.k8IsGirl(s));
    const rules = B.rules.filter((r) => r.cat === B.cat);
    const custom = B.ruleId === '__custom';
    const rule = custom ? { title: B.custom.title, points: Number(B.custom.points) || 0, cat: B.cat } : B.rules.find((r) => r.id === B.ruleId);
    const q = B.q.trim().toLowerCase();
    const list = students().filter((s) => eligible(s) && (B.grade === 'ALL' || s.grade === B.grade) && (!q || String(s.fullName || '').toLowerCase().includes(q) || norm(s.studentId).includes(q.replace(/^0+/, ''))))
      .sort((a, b) => String(a.grade).localeCompare(String(b.grade)) || String(a.fullName).localeCompare(String(b.fullName), 'th'));
    const selN = B.sel.size;
    let h = '<section class="k8-bh-card"><h2 class="k8-bh-h"><span class="k8-bh-step">1</span>เลือกหมวดที่ตรวจ</h2><div class="k8-bh-cats">' +
      CATS.map(([k, l, ink, bg]) => '<button type="button" aria-pressed="' + (B.cat === k) + '" style="--ink:' + ink + ';--bg:' + bg + '" onclick="k8BhSet(\'cat\',\'' + k + '\')">' + svg(k, 22) + '<span>' + l + '</span></button>').join('') + '</div></section>';
    const canEdit = (() => { const a = me(); return !!a && !a.limited && (isInspector() || /SUPER|^admin$|SubAdmin/i.test(String(a.role || ''))); })();
    if (B.editCat && B.editRules) {
      const cat = CATS.find((c) => c[0] === B.cat) || CATS[0]; const rows = B.editRules.map((r, i) => [r, i]).filter(([r]) => r.cat === B.cat);
      h += '<section class="k8-bh-card k8-bh-editcat"><div class="k8-bh-stick"><h2 class="k8-bh-h"><span class="k8-bh-step">2</span>แก้ไขหัวข้อ · ' + cat[1] + '</h2><div class="k8-bh-editbtns"><button type="button" class="is-alt" onclick="k8BhEditCat(false)">ยกเลิก</button><button type="button" onclick="k8BhRulesSave()">บันทึก</button></div></div><p class="k8-bh-intro">' + (B.cat === 'good' ? 'แต่ละข้อเพิ่มคะแนน' : 'แต่ละข้อหักคะแนน') + ' 1–50 · บันทึกแล้วใช้ได้ทันทีทั้งผู้ตรวจการและแอดมิน</p>' +
        rows.map(([r, i]) => '<div class="k8-bh-rrow"><input type="text" maxlength="120" value="' + esc(r.title) + '" oninput="k8BhRule(' + i + ',\'title\',this.value)" aria-label="หัวข้อ" placeholder="ชื่อหัวข้อ"><span class="k8-bh-rpts ' + (B.cat === 'good' ? 'is-plus' : 'is-minus') + '">' + (B.cat === 'good' ? '+' : '−') + '<input type="number" min="1" max="50" inputmode="numeric" value="' + Math.abs(Number(r.points) || 0) + '" oninput="k8BhRule(' + i + ',\'points\',this.value)" aria-label="คะแนน"></span><button type="button" class="k8-bh-rdel" onclick="k8BhRuleDel(' + i + ')" aria-label="ลบหัวข้อ">✕</button></div>').join('') +
        '<button type="button" class="k8-bh-link" onclick="k8BhRuleAdd(\'' + B.cat + '\')">+ เพิ่มหัวข้อ</button></section>';
    } else
    h += '<section class="k8-bh-card"><div class="k8-bh-stick' + (canEdit ? '' : ' is-plain') + '"><h2 class="k8-bh-h"><span class="k8-bh-step">2</span>เลือกหัวข้อ' + (canEdit ? '<button type="button" class="k8-bh-editlink" onclick="k8BhEditCat(true)">✎ แก้ไขหัวข้อ</button>' : '') + '</h2></div><div class="k8-bh-rules">' +
      rules.map((r) => '<button type="button" aria-pressed="' + (B.ruleId === r.id) + '" onclick="k8BhSet(\'ruleId\',\'' + js(r.id) + '\')"><span>' + esc(r.title) + '</span><b class="' + (r.points > 0 ? 'is-plus' : 'is-minus') + '">' + (r.points > 0 ? '+' : '') + r.points + '</b></button>').join('') +
      '<button type="button" class="k8-bh-other" aria-pressed="' + custom + '" onclick="k8BhSet(\'ruleId\',\'__custom\')"><span>อื่น ๆ (ระบุเอง)</span><b>✎</b></button></div>' +
      (custom ? '<div class="k8-bh-custom"><input type="text" maxlength="120" placeholder="ระบุสิ่งที่ตรวจพบ" value="' + esc(B.custom.title) + '" oninput="k8BhCustom(\'title\', this.value)"><label>คะแนน<input type="number" inputmode="numeric" min="-20" max="20" value="' + esc(B.custom.points) + '" oninput="k8BhCustom(\'points\', this.value)"></label><small>ติดลบ = หักคะแนน · บวก = เพิ่มคะแนน (ครั้งละไม่เกิน 20)</small></div>' : '') + '</section>';
    h += '<section class="k8-bh-card"><div class="k8-bh-h-row"><h2 class="k8-bh-h"><span class="k8-bh-step">3</span>เลือกนักเรียน</h2>' + (selN ? '<button type="button" class="k8-bh-link" onclick="k8BhClearSel()">ล้างที่เลือก (' + selN + ')</button>' : '') + '</div>' +
      '<div class="k8-bh-filter"><input type="search" id="k8BhQ" placeholder="ค้นหาชื่อหรือรหัส" value="' + esc(B.q) + '" oninput="k8BhQ(this)" autocomplete="off">' + gradeSelect(B.grade, 'grade') + '</div>' +
      // v17.72 · ผู้ตรวจการ · แยกนักเรียนชาย (ซ้าย) / หญิง (ขวา) · เลือกทั้งหมดแยกตามฝั่ง
      (B.cat === 'reading' ? '<p class="k8-bh-intro k8-bh-rdnote">📖 หมวดการอ่านหนังสือ · แสดงเฉพาะนักเรียนชาย ม.4–ม.6</p>' : '') + '<div class="k8-bh-gcols' + (B.cat === 'reading' ? ' is-one' : '') + '">' + (B.cat === 'reading' ? [['m', 'ชาย ม.4–6', list]] : [['m', 'ชาย', list.filter((s) => !girlOf(s))], ['f', 'หญิง', list.filter(girlOf)]]).map(([g, l, L]) => {
        const allOn = L.length && L.every((s) => B.sel.has(norm(s.studentId)));
        return '<div class="k8-bh-gcol is-' + g + '"><div class="k8-bh-ghead"><b>' + l + '</b><span>' + L.length + ' คน</span></div>' +
          '<ul class="k8-bh-stu">' + (L.length ? L.slice(0, 200).map((s) => { const k = norm(s.studentId); const sc = clamp(100 + (sm[k] || 0)); const on = B.sel.has(k); const lv = level(sc);
            return '<li><button type="button" role="checkbox" aria-checked="' + on + '" onclick="k8BhToggle(\'' + js(k) + '\')"><span class="k8-bh-chk">' + (on ? '✓' : '') + '</span><span class="k8-bh-who"><b>' + esc(s.fullName) + '</b><small>' + esc(shortG(s.grade)) + ' · <i style="color:' + lv[1] + '">' + sc + '</i></small></span></button></li>'; }).join('') : '<li class="k8-bh-empty">ไม่มีนักเรียน' + l + '</li>') + '</ul>' +
          (L.length ? '<button type="button" class="k8-bh-link k8-bh-all" onclick="k8BhSelAll(\'' + g + '\')">' + (allOn ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด') + '</button>' : '') + '</div>'; }).join('') + '</div></section>';
    const ready = rule && rule.title && rule.points && selN;
    const needPhoto = (B.cat === 'dorm' || B.cat === 'toilet') && rule && Number(rule.points) < 0;
    // v17.71 · รูปหลักฐานได้สูงสุด 4 รูป
    const PH = B.photos || (B.photos = []);
    const photoBlock = needPhoto ? '<div class="k8-bh-photo"><b>รูปหลักฐาน <small>ไม่บังคับ · สูงสุด 4 รูป · แนบแล้ว ' + PH.length + '/4</small></b>' +
      (PH.length ? '<div class="k8-bh-phs">' + PH.map((p, i) => '<figure class="k8-bh-ph"><img src="' + p.data + '" alt="รูปหลักฐานที่ ' + (i + 1) + '"><figcaption class="k8-pn-src is-' + p.src + '">' + (p.src === 'camera' ? '📷 กล้อง' : '🖼️ แนบ') + '</figcaption><button type="button" class="k8-bh-phx" onclick="k8BhPhotoClear(' + i + ')" aria-label="ลบรูปที่ ' + (i + 1) + '">✕</button></figure>').join('') + '</div>' : '') +
      (PH.length < 4 ? '<div class="k8-pn-pbtns"><label class="k8-pn-pbtn"><input type="file" accept="image/*" capture="environment" onchange="k8BhPhoto(this,\'camera\')"><i aria-hidden="true">📷</i><b>ถ่ายรูป</b><small>เปิดกล้อง</small></label><label class="k8-pn-pbtn"><input type="file" accept="image/*" multiple onchange="k8BhPhoto(this,\'gallery\')"><i aria-hidden="true">🖼️</i><b>แนบรูป</b><small>เลือกได้หลายรูป</small></label></div>' : '<p class="k8-bh-phmax">ครบ 4 รูปแล้ว · ลบรูปเดิมก่อนถ้าต้องการเปลี่ยน</p>') + '</div>' : '';
    h += '<section class="k8-bh-card"><h2 class="k8-bh-h"><span class="k8-bh-step">4</span>ยืนยันการบันทึก</h2>' + photoBlock +
      '<div class="k8-bh-confirm"><label>วันที่<input type="date" value="' + B.date + '" max="' + ymd(new Date()) + '" onchange="k8BhSet(\'date\', this.value)"></label><label>หมายเหตุ (ถ้ามี)<input type="text" maxlength="300" placeholder="เช่น ห้อง 204 ตรวจรอบเช้า" value="' + esc(B.note) + '" oninput="k8BhNote(this.value)"></label></div>' +
      '<p class="k8-bh-summary">' + (ready ? '<b class="' + (rule.points > 0 ? 'is-plus' : 'is-minus') + '">' + (rule.points > 0 ? 'เพิ่ม ' + rule.points : 'หัก ' + Math.abs(rule.points)) + ' คะแนน</b> · ' + esc(rule.title) + ' · นักเรียน ' + selN + ' คน' : 'เลือกหัวข้อและนักเรียนให้ครบก่อน') + '</p>' +
      '</section>';
    // v17.49 · ปุ่มบันทึกติดด้านล่างจอเสมอ (กดได้ทันทีโดยไม่ต้องเลื่อนลงไปข้อ 4)
    h += '<div class="k8-bh-savebar"><span class="k8-bh-savebar-t">' + (ready ? '<b class="' + (rule.points > 0 ? 'is-plus' : 'is-minus') + '">' + (rule.points > 0 ? '+' + rule.points : rule.points) + ' คะแนน</b> · ' + selN + ' คน' : (!rule || !rule.title ? 'ยังไม่ได้เลือกหัวข้อ' : 'ยังไม่ได้เลือกนักเรียน')) + (selN ? (() => { const S = students().filter((x) => B.sel.has(norm(x.studentId))); const f = S.filter(girlOf).length; return '<small class="k8-bh-gsum">เลือกแล้ว ' + S.length + ' คน · ชาย ' + (S.length - f) + ' · หญิง ' + f + '</small>'; })() : '') + '</span>' +
      '<button type="button" class="k8-bh-go ' + (rule && rule.points > 0 ? 'is-plus' : '') + '" ' + (ready && !B.saving ? '' : 'disabled') + ' onclick="k8BhSubmit()">' + (B.saving ? 'กำลังบันทึก…' : ready ? (rule.points > 0 ? 'เพิ่มคะแนน' : 'หักคะแนน') + ' ' + selN + ' คน' : 'บันทึก') + '</button></div>';
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
      (admin ? '<div class="k8h-mini-seg">' + [[false, 'ทุกคน'], [true, 'ของฉัน']].map(([k, l]) => '<button type="button" aria-pressed="' + (B.hMine === k) + '" onclick="k8BhSet(\'hMine\',' + k + ')">' + l + '</button>').join('') + '</div>' : '') +
      '<input type="search" placeholder="ค้นหาชื่อนักเรียนหรือหัวข้อ" value="' + esc(B.hq) + '" oninput="k8BhHQ(this)" id="k8BhHQ" autocomplete="off"></div>' +
      '<p class="k8-bh-intro">' + (admin ? 'รายการหัก/เพิ่มคะแนนที่ผู้ตรวจการและแอดมินบันทึก · ดูได้ว่าใครบันทึก เมื่อไร พร้อมรูปหลักฐาน · ยกเลิกรายการที่บันทึกผิดได้<br>' : '') + list.length + ' รายการ · หักคะแนน ' + minus + ' · เพิ่มคะแนน ' + plus + (admin ? '' : ' · ยกเลิกรายการที่บันทึกผิดได้') + '</p>' +
      '<ul class="k8-bh-hist">' + (list.length ? list.slice(0, 300).map((l) => { const c = catOf(l.cat); const own = String(l.by || '').toLowerCase() === uid; const can = l.status !== 'cancelled' && (own || isAdmin());
        return '<li class="' + (l.status === 'cancelled' ? 'is-cancel' : '') + '"><span class="k8-bh-hico" style="color:' + c[2] + ';background:' + c[3] + '">' + svg(l.cat, 18) + '</span>' + (l.photoUrl ? '<span class="k8-bh-hphs">' + String(l.photoUrl).split(/\s*\n\s*/).filter(Boolean).slice(0, 4).map((u, i, A) => '<button type="button" class="k8-bh-hph" onclick="openPhotoViewerModal(\'' + js(u) + '\',\'รูปหลักฐาน ' + (i + 1) + '/' + A.length + '\')" title="' + esc((String(l.photoSource || '').split(/\n/)[i]) || 'รูปหลักฐาน') + '"><img src="' + esc(u) + '" alt="รูปหลักฐานที่ ' + (i + 1) + '" loading="lazy"></button>').join('') + '</span>' : '') + '<span class="k8-bh-who"><b>' + esc(l.studentName || l.studentId) + ' <small>' + esc(shortG(l.grade)) + '</small></b><small>' + esc(l.title) + (l.note ? ' · ' + esc(l.note) : '') + '</small><small class="k8-bh-meta">' + fmtD(l.date) + ' ' + esc(String(l.time || '').slice(11, 16)) + ' · ' + esc(l.byName || l.by) + (l.status === 'cancelled' ? ' · ยกเลิกแล้ว' : '') + '</small></span><span class="k8-bh-pts ' + (l.points > 0 ? 'is-plus' : 'is-minus') + '">' + (l.points > 0 ? '+' : '') + l.points + '</span>' + (can ? '<button type="button" class="k8-bh-undo" onclick="k8BhCancel(\'' + js(l.id) + '\')" aria-label="ยกเลิกรายการนี้">ยกเลิก</button>' : '') + '</li>'; }).join('') : '<li class="k8-bh-empty">ยังไม่มีรายการในช่วงนี้' + (B.hRange !== 'term' ? ' · ลองเลือก "ภาคเรียนนี้"' : '') + (admin && B.hMine ? ' หรือ "ทุกคน"' : '') + '</li>') + '</ul></section>';
  }

  function rulesHtml() {
    if (!B.editRules) B.editRules = B.rules.map((r) => Object.assign({}, r));
    return '<section class="k8-bh-card"><p class="k8-bh-intro">ตั้งหัวข้อที่ผู้ตรวจการใช้ และกำหนดว่าแต่ละข้อหักหรือเพิ่มกี่คะแนน (1–50) · หมวด "ทำความดี" เป็นการเพิ่มคะแนน หมวดอื่นเป็นการหักคะแนน</p>' +
      CATS.map(([k, l, ink, bg]) => { const rows = B.editRules.map((r, i) => [r, i]).filter(([r]) => r.cat === k);
        return '<div class="k8-bh-rcat"><h3 style="color:' + ink + '">' + svg(k, 18) + ' ' + l + '</h3>' + rows.map(([r, i]) => '<div class="k8-bh-rrow"><input type="text" maxlength="120" value="' + esc(r.title) + '" oninput="k8BhRule(' + i + ',\'title\',this.value)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();k8BhRulesSave()}" enterkeyhint="done" aria-label="หัวข้อ"><span class="k8-bh-rpts ' + (k === 'good' ? 'is-plus' : 'is-minus') + '">' + (k === 'good' ? '+' : '−') + '<input type="number" min="1" max="50" value="' + Math.abs(Number(r.points) || 0) + '" oninput="k8BhRule(' + i + ',\'points\',this.value)" aria-label="คะแนน"></span><button type="button" class="k8-bh-rdel" onclick="k8BhRuleDel(' + i + ')" aria-label="ลบหัวข้อ">✕</button></div>').join('') +
          '<button type="button" class="k8-bh-link" onclick="k8BhRuleAdd(\'' + k + '\')">+ เพิ่มหัวข้อ</button></div>'; }).join('') +
      '</section>' +
      '<div class="k8-bh-rsave" id="k8BhRSave"' + (B.rulesDirty ? '' : ' hidden') + ' role="status"><span><b>ยังไม่ได้บันทึก</b><small>แก้ไขหัวข้อแล้ว กดบันทึกเพื่อใช้งานจริง</small></span><button type="button" onclick="k8BhRulesSave()">บันทึก</button></div>';
  }

  function openStudent(k) {
    const s = students().find((x) => norm(x.studentId) === k) || { fullName: k, studentId: k };
    const t = term();
    const logs = B.logs.filter((l) => norm(l.studentId) === k && (!l.term || l.term === t)).sort((x, y) => String(y.time || y.date).localeCompare(String(x.time || x.date)));
    const sc = clamp(100 + logs.filter((l) => l.status !== 'cancelled').reduce((a, l) => a + (Number(l.points) || 0), 0));
    document.getElementById('k8BhModalTitle').textContent = s.fullName || k;
    document.getElementById('k8BhModalSub').textContent = shortG(s.grade) + ' · ' + (s.studentId || k) + ' · ' + window.k8Term().label;
    document.getElementById('k8BhModalBody').innerHTML = detailHtml(sc, logs, !!me()) + (me() ? '<button type="button" class="k8-bh-go" onclick="k8BhRecordFor(\'' + js(k) + '\')">บันทึกพฤติกรรมให้คนนี้</button>' : '');
    openModal('k8BhModal');
  }
  function detailHtml(sc, logs, staff) {
    const lv = level(sc); const act = logs.filter((l) => l.status !== 'cancelled');
    const minus = act.filter((l) => l.points < 0).reduce((a, l) => a + l.points, 0), plus = act.filter((l) => l.points > 0).reduce((a, l) => a + l.points, 0);
    return '<div class="k8-bh-hero"><span class="k8-bh-ring is-big" style="--p:' + sc + ';--c:' + lv[1] + '"><b>' + sc + '</b><small>/100</small></span><div><span class="k8-bh-lv" style="color:' + lv[1] + ';background:' + lv[2] + '">' + lv[0] + '</span><p>เริ่มต้น 100 · ถูกหัก <b class="is-minus">' + Math.abs(minus) + '</b> · ได้เพิ่ม <b class="is-plus">' + plus + '</b></p></div></div>' +
      '<ul class="k8-bh-hist">' + (logs.length ? logs.map((l) => { const c = catOf(l.cat); return '<li class="' + (l.status === 'cancelled' ? 'is-cancel' : '') + '"><span class="k8-bh-hico" style="color:' + c[2] + ';background:' + c[3] + '">' + svg(l.cat, 18) + '</span><span class="k8-bh-who"><b>' + esc(l.title) + '</b><small>' + fmtD(l.date) + (l.time ? ' ' + esc(String(l.time).slice(11, 16)) : '') + ' · ' + esc(c[1]) + (l.note ? ' · ' + esc(l.note) : '') + (l.status === 'cancelled' ? ' · ยกเลิกแล้ว' : '') + '</small>' +
        /* v17.74 · ประวัติบอกผู้ประเมิน + รูปหลักฐานที่ผู้ตรวจการแนบ */
        (staff && (l.byName || l.by) ? '<small class="k8-bh-by">ประเมินโดย <b>' + esc(l.byName || l.by) + '</b></small>' : '') +
        (staff && l.photoUrl ? (() => { const U = String(l.photoUrl).split(/\s*\n\s*/).filter(Boolean).slice(0, 4); return '<span class="k8-bh-dphs" aria-label="รูปหลักฐาน ' + U.length + ' รูป">' + U.map((u, i) => '<button type="button" class="k8-bh-hph" onclick="openPhotoViewerModal(\'' + js(u) + '\',\'รูปหลักฐาน ' + (i + 1) + '/' + U.length + '\')"><img src="' + esc(u) + '" alt="รูปหลักฐานที่ ' + (i + 1) + '" loading="lazy"></button>').join('') + '</span>'; })() : '') +
        '</span><span class="k8-bh-pts ' + (l.points > 0 ? 'is-plus' : 'is-minus') + '">' + (l.points > 0 ? '+' : '') + l.points + '</span></li>'; }).join('') : '<li class="k8-bh-empty">ยังไม่มีบันทึกในภาคเรียนนี้ · รักษาคะแนนเต็มไว้นะ</li>') + '</ul>';
  }

  // ---------- actions ----------
  window.k8BhTab = function (t) { if (B.tab === 'rules' && t !== 'rules' && B.rulesDirty && !confirm('หัวข้อที่แก้ไว้ยังไม่ได้บันทึก ออกโดยไม่บันทึกใช่ไหม?')) return; B.tab = t; if (t !== 'rules') { B.editRules = null; B.rulesDirty = false; } render(); try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) {} };
  window.k8BhSet = function (k, v) { B[k] = v; if (k === 'cat') { B.ruleId = ''; B.photos = []; if (v === 'reading') students().forEach((x) => { if (!eligible(x)) B.sel.delete(norm(x.studentId)); }); } render(); };
  window.k8BhPhoto = async function (input, mode) {
    const files = input && input.files ? Array.from(input.files) : []; if (!files.length) return;
    B.photos = B.photos || [];
    const room = 4 - B.photos.length;
    if (files.length > room) toast('แนบได้สูงสุด 4 รูป · ใช้ ' + Math.max(room, 0) + ' รูปแรก', 'warning');
    for (const f of files.slice(0, Math.max(room, 0))) {
      try { const r = await window.k8EvidencePhoto(f, mode); B.photos.push({ data: r.data, src: r.src }); } catch (e) { toast('เปิดรูปบางรูปไม่ได้ ลองรูปอื่น', 'error'); }
    }
    input.value = ''; render();
  };
  window.k8BhPhotoClear = function (i) { B.photos = (B.photos || []).filter((_, j) => j !== i); render(); };
  window.k8BhCustom = function (k, v) { B.custom[k] = v; const sum = document.querySelector('.k8-bh-summary'); if (sum) { render(); const el = document.querySelector('.k8-bh-custom ' + (k === 'title' ? 'input[type=text]' : 'input[type=number]')); if (el) { el.focus(); try { const n = el.value.length; el.setSelectionRange && el.type === 'text' && el.setSelectionRange(n, n); } catch (e) {} } } };
  window.k8BhNote = function (v) { B.note = v; };
  function refocus(id, el) { const pos = el.selectionStart; render(); const n = document.getElementById(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }
  let qt = null;
  window.k8BhQ = function (el) { B.q = el.value; clearTimeout(qt); qt = setTimeout(() => refocus('k8BhQ', el), 150); };
  window.k8BhSQ = function (el) { B.sq = el.value; clearTimeout(qt); qt = setTimeout(() => refocus('k8BhSQ', el), 150); };
  window.k8BhHQ = function (el) { B.hq = el.value; clearTimeout(qt); qt = setTimeout(() => refocus('k8BhHQ', el), 150); };
  window.k8BhToggle = function (k) { if (B.sel.has(k)) B.sel.delete(k); else B.sel.add(k); render(); };
  window.k8BhClearSel = function () { B.sel.clear(); render(); };
  window.k8BhSelAll = function (g) {
    const q = B.q.trim().toLowerCase();
    const gl = (s) => !!(window.k8IsGirl && window.k8IsGirl(s));
    const list = students().filter((s) => (B.grade === 'ALL' || s.grade === B.grade) && (!q || String(s.fullName || '').toLowerCase().includes(q) || norm(s.studentId).includes(q.replace(/^0+/, ''))) && (!g || (g === 'f') === gl(s)) && eligible(s));
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
      if ((B.photos || []).length && (B.cat === 'dorm' || B.cat === 'toilet')) { payload.photos = B.photos.map((p) => ({ data: p.data, source: p.src })); payload.photo = B.photos[0].data; payload.photoSource = B.photos[0].src; }
      if (custom) { payload.title = B.custom.title; payload.points = Number(B.custom.points); payload.cat = B.cat; } else payload.ruleId = rule.id;
      const r = await api('addBehaviorLogs', { data: payload });
      if (!r || !r.success) throw new Error((r && r.message) || 'บันทึกไม่สำเร็จ');
      B.logs = B.logs.concat(r.logs || []);
      const sent = (payload.photos || []).length, got = typeof r.photosSaved === 'number' ? r.photosSaved : (r.logs && r.logs[0] && r.logs[0].photoUrl) ? String(r.logs[0].photoUrl).split(/\s*\n\s*/).filter(Boolean).length : 0; if (!r.photoMax) B.oldBackend = true;
      B.sel.clear(); B.note = ''; B.photos = [];
      if (sent > 1 && got < sent) toast(!r.photoMax ? 'บันทึกแล้ว แต่ Code.gs ที่ใช้อยู่เป็นรุ่นเก่า เก็บได้แค่ 1 รูป · แจ้งแอดมินให้ Deploy Code.gs ตัวล่าสุด' : 'บันทึกแล้ว แต่อัปโหลดรูปขึ้น Google Drive ได้ ' + got + '/' + sent + ' รูป · ลองส่งรูปที่เหลืออีกครั้ง', 'error');
      else toast('บันทึกแล้ว · ' + r.message, 'success');
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
  const rulesDirty = () => { B.rulesDirty = true; const bar = document.getElementById('k8BhRSave'); if (bar) bar.hidden = false; };
  window.k8BhRule = function (i, k, v) { const r = B.editRules[i]; if (!r) return; rulesDirty(); if (k === 'points') { const n = Math.max(1, Math.min(50, Math.abs(parseInt(v, 10) || 0))); r.points = r.cat === 'good' ? n : -n; } else r.title = v; };
  window.k8BhRuleAdd = function (cat) { B.rulesDirty = true; B.editRules.push({ id: '', cat, title: '', points: cat === 'good' ? 3 : -5 }); render(); const ins = document.querySelectorAll('.k8-bh-rrow input[type=text]'); const last = Array.from(ins).filter((x) => !x.value).pop(); if (last) last.focus(); };
  window.k8BhEditCat = function (on) {
    if (!on && B.rulesDirty && !confirm('ยังไม่ได้บันทึกหัวข้อที่แก้ ยกเลิกใช่ไหม?')) return;
    B.editCat = !!on; B.editRules = on ? B.rules.map((r) => Object.assign({}, r)) : null; B.rulesDirty = false; render();
  };
  window.k8BhRuleDel = function (i) { B.rulesDirty = true; B.editRules.splice(i, 1); render(); };
  // บันทึกหัวข้อแบบทันใจ: ใช้ค่าที่แก้ทันทีในเครื่อง แล้วส่งขึ้นระบบเบื้องหลัง (ถ้าไม่สำเร็จจะคืนค่าเดิมและแจ้ง)
  window.k8BhRulesSave = async function () {
    const prev = B.rules.slice();
    const rules = B.editRules.filter((r) => String(r.title || '').trim()).map((r, i) => Object.assign({}, r, { title: String(r.title).trim(), id: r.id || ('tmp' + Date.now().toString(36) + i) }));
    if (!rules.length) { toast('ต้องมีหัวข้ออย่างน้อย 1 ข้อ', 'warning'); return; }
    B.rules = rules; B.editRules = null; B.rulesDirty = false; B.editCat = false;
    if (B.ruleId && B.ruleId !== '__custom' && !B.rules.some((x) => x.id === B.ruleId)) B.ruleId = '';
    const cache = () => { try { const c = JSON.parse(localStorage.getItem('khalifah_behavior_cache') || '{}'); c.rules = B.rules; localStorage.setItem('khalifah_behavior_cache', JSON.stringify(c)); } catch (e) {} };
    cache(); render(); toast('บันทึกหัวข้อแล้ว', 'success');
    let r = null; try { r = await api('saveBehaviorRules', { data: { rules: rules.map((x) => Object.assign({}, x, { id: /^tmp/.test(x.id) ? '' : x.id })) } }); } catch (e) { r = { success: false, message: e.message }; }
    if (r && r.success && Array.isArray(r.rules)) {
      // แทนรหัสชั่วคราวด้วยรหัสจากระบบ (จับคู่ตามหมวด+ชื่อ) โดยคงหัวข้อที่เลือกอยู่ไว้
      const sel = B.rules.find((x) => x.id === B.ruleId);
      B.rules = r.rules; if (sel) { const m = r.rules.find((x) => x.cat === sel.cat && x.title === sel.title); B.ruleId = m ? m.id : ''; }
      cache(); render();
    } else {
      B.rules = prev; cache(); render();
      toast(((r && (r.message || r.error)) || 'บันทึกหัวข้อไม่สำเร็จ') + ' · คืนค่าเดิมแล้ว' + (r && r.code === 'FORBIDDEN' ? ' (ให้แอดมิน Deploy Code.gs ตัวล่าสุด)' : ''), 'error');
    }
  };

  // ---------- นักเรียน: กล่องคะแนนพฤติกรรมหน้าแรก ----------
  let mine = null;
  try { mine = JSON.parse(localStorage.getItem('khalifah_behavior_me') || 'null'); } catch (e) {}
  const curSid = () => { try { return currentStudent ? norm(currentStudent.studentId) : ''; } catch (e) { return ''; } };
  const mineOk = () => !!mine && (!mine.sid || mine.sid === curSid());
  function myScore() { if (!mineOk()) return null; const t = mine.term || term(); return clamp(100 + (mine.logs || []).filter((l) => l.status !== 'cancelled' && (!l.term || l.term === t)).reduce((a, l) => a + (Number(l.points) || 0), 0)); }
  // v17.99 · ตัวเลขคะแนนนับขึ้นแบบเคลื่อนไหว (นับใหม่เมื่อคะแนนเปลี่ยน · ปิดเมื่อผู้ใช้ตั้งลดการเคลื่อนไหว)
  function k8BehCount(el, to) {
    const from = Number(el.dataset.v);
    if (el.dataset.v === String(to) && el.textContent === String(to)) return;
    el.dataset.v = String(to);
    let reduce = false; try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (reduce) { el.textContent = to; return; }
    const start = isNaN(from) ? 0 : from, dur = isNaN(from) ? 3500 : 900, t0 = performance.now();
    cancelAnimationFrame(el._raf || 0);
    const box = el.closest('.hf-beh-box'); if (box) { box.classList.remove('is-pop'); void box.offsetWidth; box.classList.add('is-pop'); }
    const step = (t) => { const p = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - p, 2); el.textContent = Math.round(start + (to - start) * e); if (p < 1) el._raf = requestAnimationFrame(step); };
    el._raf = requestAnimationFrame(step);
  }
  function paintMine() {
    const el = document.getElementById('hfBehScore'); if (!el) return;
    const sc = myScore();
    if (sc == null) { el.textContent = '…'; delete el.dataset.v; const sub0 = document.getElementById('hfBehSub'); if (sub0) sub0.textContent = 'กำลังโหลดคะแนนล่าสุด'; const lv0 = document.getElementById('hfBehLv'); if (lv0) lv0.textContent = ''; return; }
    const lv = level(sc);
    k8BehCount(el, sc);
    const box = document.getElementById('hfBeh'); if (box) box.setAttribute('aria-label', 'คะแนนพฤติกรรม ' + sc + ' จาก 100 · ' + lv[0]);
    
    const lvEl = document.getElementById('hfBehLv'); if (lvEl) { lvEl.textContent = lv[0]; lvEl.style.color = lv[1]; lvEl.style.background = lv[2]; }
    const t = (mine && mine.term) || term(); const act = ((mine && mine.logs) || []).filter((l) => l.status !== 'cancelled' && (!l.term || l.term === t));
    const minus = act.filter((l) => l.points < 0).reduce((a, l) => a + l.points, 0), plus = act.filter((l) => l.points > 0).reduce((a, l) => a + l.points, 0);
    const sub = document.getElementById('hfBehSub'); if (sub) sub.textContent = act.length ? 'ถูกหัก ' + Math.abs(minus) + ' · ได้เพิ่ม ' + plus : 'ยังไม่มีการหักคะแนน';
    const tEl = document.getElementById('hfBehTerm'); if (tEl) { let lb = ''; try { lb = window.k8Term().label; } catch (e) {} tEl.textContent = lb ? 'ภาคเรียนนี้ · ' + lb : 'ภาคเรียนนี้'; }
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
    try { window.k8ThAvatarPaint && window.k8ThAvatarPaint(); } catch (e) {}
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
  // ---------- อาจารย์: เปิดหน้าบันทึกพฤติกรรมแบบเต็มหน้า ----------
  let teachOpen = false;
  window.k8BhTeachOpen = function () {
    const el = document.getElementById('k8BhPage'); if (!el) return;
    if (B.tab === 'rules') B.tab = 'record';
    el.hidden = false; teachOpen = true; document.documentElement.classList.add('k8-docs-open');
    try { history.pushState({ k8bh: 1 }, ''); } catch (e) {}
    const b = document.getElementById('k8BhPageBody'); if (b) b.scrollTop = 0;
    render(); load(true);
  };
  function closeTeach() { const el = document.getElementById('k8BhPage'); if (el) el.hidden = true; teachOpen = false; if (!document.querySelector('.k8-docs:not([hidden])')) document.documentElement.classList.remove('k8-docs-open'); }
  window.k8BhTeachBack = function () { history.back(); };
  window.addEventListener('popstate', (e) => { if (teachOpen && !(e.state && e.state.k8bh)) closeTeach(); });
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
    if (!(s || a)) { bell.hidden = true; return; }
    let host = null;
    if (s) {
      let row = document.getElementById('k8HomeTop');
      const hf = document.getElementById('homeF');
      if (!row && hf) { row = document.createElement('div'); row.id = 'k8HomeTop'; row.className = 'k8-home-top'; row.innerHTML = '<div><span class="k8-home-hi">อัสลามุอะลัยกุม</span><b id="k8HomeName"></b></div>'; hf.insertBefore(row, hf.firstChild); }
      const nm = document.getElementById('k8HomeName'); if (nm) nm.textContent = String(s.fullName || '').replace(/^(นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง)\s*/, '').split(/\s+/)[0] || '';
      host = row;
    } else {
      const ins = document.querySelector('#view-inspector.active .k8-insp-head') || document.querySelector('#view-admin.active .k8-adm-bar') || document.querySelector('html.k8-tpd #k8TpActs') || document.querySelector('#view-teacher .k8-th-head');
      host = ins;
    }
    if (host && bell.parentElement !== host) { const acct = host.querySelector('.k8-acct, .k8-adm-me'); if (acct) host.insertBefore(bell, acct); else host.appendChild(bell); }
    bell.hidden = !host;
  }
  // v17.37 · แอดมิน: กระดิ่งนับคำขอที่รออนุมัติ (บัญชีใหม่ + ละหมาดย้อนหลัง + ลาสอน) + แจ้งเตือนอื่นที่ยังไม่อ่าน
  function reqCounts() {
    const a = adm(); if (!a || stu() || a.limited === 'act') return null;
    let c = { accounts: 0, prayers: 0 }; try { if (window.k8ApCounts) c = window.k8ApCounts(); } catch (e) {}
    let lv = null; try { lv = window.k8LvPendingN ? window.k8LvPendingN() : null; } catch (e) {}
    if (lv === null && window.k8LvLoad && !N.lvAsked) { N.lvAsked = true; try { window.k8LvLoad(); } catch (e) {} }
    c.leaves = lv || 0; if (a.limited === 'exec') { c.accounts = 0; c.prayers = 0; } c.total = c.accounts + c.prayers + c.leaves; return c;
  }
  function paintBadge() {
    const rc = reqCounts();
    const other = rc ? N.list.filter((x) => !x.read && !/คำขอลาสอน|คำขอละหมาด|บัญชีใหม่/.test(x.title || '')).length : 0;
    const perN = !rc && stu() && window.k8PeriodActive && window.k8PeriodActive() ? 1 : 0;
    const n = rc ? rc.total + other : N.unread + perN, el = document.getElementById('k8BellN');
    // v17.38 · ตัวเลขคำขอรออนุมัติที่เมนู "อนุมัติบัญชี & คำขอ"
    if (rc) { const pill = document.getElementById('adminTabPendingBadge'); if (pill) { pill.textContent = rc.total > 99 ? '99+' : String(rc.total); pill.style.display = 'inline-flex'; pill.classList.toggle('is-zero', !rc.total); pill.title = 'บัญชีใหม่ ' + rc.accounts + ' · ละหมาดย้อนหลัง ' + rc.prayers + ' · ลาสอน ' + rc.leaves; } }
    const bl = document.getElementById('k8Bell'); if (bl) { bl.classList.toggle('is-staff', !!rc); bl.title = rc ? (rc.total ? 'คำขอรออนุมัติ ' + rc.total + ' รายการ' : 'การแจ้งเตือน') : ''; }
    if (el) { el.hidden = !n; el.textContent = n > 99 ? '99+' : String(n); }
    const b = document.getElementById('k8Bell'); if (b) { b.setAttribute('aria-label', 'การแจ้งเตือน' + (n ? ' ยังไม่อ่าน ' + n + ' รายการ' : '')); b.classList.toggle('has-new', !!n); }
    try { if (navigator.setAppBadge) { if (n) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (e) {}
    const ps = document.getElementById('k8PolicyStatus'), pc = document.getElementById('k8PolicyCard');
    if (ps && stu()) { const pend = N.pending.length > 0; ps.textContent = pend ? 'ยังไม่ได้ยินยอม · แตะเพื่ออ่านและกดยินยอม' : (N.ackAt ? 'ยินยอมแล้ว · ' + N.ackAt.slice(0, 16) : 'อ่านข้อตกลงได้ทุกเมื่อ'); if (pc) pc.classList.toggle('is-pending', pend); }
  }
  async function load(force) {
    const s = stu(), a = adm();
    if (!(s || a) || N.loading) { placeBell(); return; }
    if (!force && N.loaded && Date.now() - N.at < 15000) { placeBell(); paintBadge(); return; }
    N.loading = true;
    try {
      const r = await api('getMyNotifications');
      if (r && r.success) {
        N.list = r.notifications || []; N.pending = r.pendingPolicies || []; N.unread = r.unread || 0; N.loaded = true; N.at = Date.now(); if (s) { window.k8ClassLeaves = r.classLeaves || []; try { localStorage.setItem('k8_class_leaves', JSON.stringify(window.k8ClassLeaves)); } catch (e) {} try { if (window.k8TtRerender) window.k8TtRerender(); } catch (e) {} }
        try { localStorage.setItem('k8_notif_cache_' + (s ? 'S' + norm(s.studentId) : 'U' + (a.username || '')), JSON.stringify({ list: N.list, pending: N.pending, unread: N.unread })); } catch (e) {}
      }
    } catch (e) {}
    N.loading = false; placeBell(); paintBadge(); maybePop(); osNotify();
    if (document.getElementById('k8NotifModal') && document.getElementById('k8NotifModal').classList.contains('open')) renderSheet();
  }
  function loadCache() {
    const s = stu(), a = adm(); if (!(s || a)) return;
    try { const c = JSON.parse(localStorage.getItem('k8_notif_cache_' + (s ? 'S' + norm(s.studentId) : 'U' + (a.username || ''))) || 'null'); if (c) { N.list = c.list || []; N.pending = c.pending || []; N.unread = c.unread || 0; } } catch (e) {}
    placeBell(); paintBadge();
  }

  // ---------- v17.14 · แจ้งเตือนเข้ามือถือ (การแจ้งเตือนของระบบ) ----------
  function osNotify() {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted' || !navigator.serviceWorker) return;
      if (window.k8IsPreview && window.k8IsPreview()) return;
      let seen = []; try { seen = JSON.parse(localStorage.getItem('k8_notif_os') || '[]'); } catch (e) {}
      const first = !localStorage.getItem('k8_notif_os');
      const cut = Date.now() - 2 * 864e5;
      const fresh = N.list.filter((n) => !n.read && seen.indexOf(n.id) === -1 && (Date.parse(String(n.createdAt).replace(' ', 'T')) || 0) > cut);
      const ids = seen.concat(N.list.map((n) => n.id)).filter((v, i, a) => a.indexOf(v) === i).slice(-300);
      try { localStorage.setItem('k8_notif_os', JSON.stringify(ids)); } catch (e) {}
      if (first) return; // ครั้งแรกหลังเปิดใช้: ไม่ยิงย้อนหลังทั้งหมด
      navigator.serviceWorker.ready.then((reg) => { fresh.slice(0, 3).forEach((n) => reg.showNotification(n.title, { body: String(n.body || '').slice(0, 180), icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', tag: 'k8n-' + n.id, data: { url: './' } })); }).catch(() => {});
    } catch (e) {}
  }
  window.k8EnablePush = async function () {
    if (!('Notification' in window)) { toast('อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน · ลองติดตั้งแอปลงหน้าจอหลักก่อน', 'warning'); return; }
    let p = Notification.permission; if (p !== 'granted') { try { p = await Notification.requestPermission(); } catch (e) {} }
    if (p !== 'granted') { toast('ยังไม่ได้อนุญาตการแจ้งเตือน · เปิดได้ที่การตั้งค่าเบราว์เซอร์ > การแจ้งเตือน', 'warning'); renderSheet(); return; }
    try { localStorage.setItem('k8_notif_os', JSON.stringify(N.list.map((n) => n.id))); } catch (e) {}
    try { const reg = await navigator.serviceWorker.ready; reg.showNotification('เปิดการแจ้งเตือนแล้ว', { body: 'แจ้งเตือนใหม่จะเด้งเข้ามือถือขณะเปิดแอปหรือแอปทำงานอยู่เบื้องหลัง', icon: 'assets/icon-192.png', tag: 'k8n-test' }); } catch (e) {}
    toast('เปิดการแจ้งเตือนเข้ามือถือแล้ว', 'success'); renderSheet();
  };

  // ---------- ป๊อปอัปเด้งเมื่อมีแจ้งเตือนใหม่ ----------
  function maybePop() {
    if (window.k8IsPreview && window.k8IsPreview()) return;
    if (adm() && !stu()) return; // v17.37 · ฝั่งแอดมิน/บุคลากร: ไม่เด้งป๊อปอัปกลางจอ ใช้กระดิ่งมุมขวาบนแทน // โหมดดูตัวอย่างของแอดมิน: ไม่บังคับอ่าน/ยอมรับข้อตกลง
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
  window.k8BellPaint = function () { try { paintBadge(); } catch (e) {} };
  window.k8BellPlace = function () { try { placeBell(); } catch (e) {} };
  window.k8BellGo = function (tab) {
    try { closeModal('k8NotifModal'); } catch (e) {}
    try { switchAdminTab('approvals', document.getElementById('btnAdminTabApprovals')); } catch (e) {}
    setTimeout(() => { try { window.k8ApTab && window.k8ApTab(tab); } catch (e) {} }, 60);
  };
  setInterval(() => { if (adm() && !stu()) paintBadge(); }, 20000);
  window.k8PopClose = function () { document.getElementById('k8Pop').hidden = true; };
  window.k8PopGo = function () { const it = N.pop; window.k8PopClose(); if (!it) return; if (it.kind === 'policy') window.k8PolicyOpen(); else window.k8NotifOpen(it.nid); };

  // ---------- รายการแจ้งเตือน ----------
  function renderSheet(focusId) {
    const body = document.getElementById('k8NotifBody'); if (!body) return;
    document.getElementById('k8NotifSub').textContent = N.unread ? 'ยังไม่อ่าน ' + N.unread + ' รายการ' : 'อ่านครบแล้ว';
    let h = '';
    const rc = reqCounts();
    if (rc) {
      const row = (tab, label, n) => '<button type="button" class="k8-nt-req' + (n ? ' is-on' : '') + '" onclick="k8BellGo(\'' + tab + '\')"><span>' + label + '</span><b>' + n + '</b></button>';
      h += '<div class="k8-nt-reqs"><div class="k8-nt-reqh">คำขอรออนุมัติ <b>' + rc.total + '</b></div>' + row('accounts', 'บัญชีใหม่', rc.accounts) + row('prayers', 'ละหมาดย้อนหลัง', rc.prayers) + row('leaves', 'ลาสอน', rc.leaves) + '</div>';
    }
    if ('Notification' in window && Notification.permission !== 'granted') h += '<button type="button" class="k8-nt-push" onclick="k8EnablePush()"><span aria-hidden="true">🔔</span><span><b>เปิดแจ้งเตือนเข้ามือถือ</b><small>' + (Notification.permission === 'denied' ? 'ถูกปิดไว้ · เปิดได้ที่การตั้งค่าเบราว์เซอร์ > การแจ้งเตือน' : 'ให้แจ้งเตือนเด้งขึ้นที่มือถือเมื่อมีเรื่องใหม่') + '</small></span></button>';
    try { const pe = window.k8PeriodActive && window.k8PeriodActive(); if (pe && stu()) h += '<button type="button" class="k8-nt-pin is-per" onclick="k8PerGo()"><span class="k8-nt-pin-tag">กำลังรอ · กดเมื่อประจำเดือนหมด</span><b>🌸 รอกด "สิ้นสุดประจำเดือน"</b><small>เริ่ม ' + esc(window.k8PerThDate(pe.start)) + ' · ระบบจะบันทึกอุซุรทุกเวลาให้อัตโนมัติเมื่อกดสิ้นสุด · แตะเพื่อไปกด</small></button>'; } catch (e) {}
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
  setInterval(() => { load(true); }, 60000);
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
  // บันทึกแบบทันใจ: แสดงผลและปิดหน้าต่างทันที แล้วส่งขึ้นระบบเบื้องหลัง
  // ถ้าส่งไม่สำเร็จ (เน็ตหลุด/ระบบยังไม่อัปเดต) เก็บเป็นรายการค้าง แล้วส่งใหม่อัตโนมัติ
  let sendSeq = 0;
  async function save(d) {
    const prev = S.data ? Object.assign({}, S.data) : null;
    saveLocal(d, true); paint(); closeModal('k8DreamModal');
    if (typeof showToast === 'function') showToast(d.dream ? 'บันทึกความใฝ่ฝันแล้ว' : 'ลบความใฝ่ฝันแล้ว', 'success');
    const my = ++sendSeq;
    let r = null;
    try { r = await gasApiCall('saveMyDream', { data: d }, 20000); } catch (e) { r = null; }
    if (my !== sendSeq) return; // มีการบันทึกใหม่กว่าแล้ว
    if (r && r.success && r.dream) { S.data = r.dream; try { localStorage.setItem('k8_dream_' + sid(), JSON.stringify(r.dream)); } catch (e) {} paint(); return; }
    if (!r || r.code === 'AUTH_REQUIRED' || /Unknown action/i.test(String(r.error || r.message || ''))) return; // คงสถานะค้างส่งไว้ ส่งใหม่ภายหลัง
    // ระบบปฏิเสธข้อมูล: คืนค่าเดิมและแจ้ง
    S.data = prev; try { if (prev) localStorage.setItem('k8_dream_' + sid(), JSON.stringify(prev)); else localStorage.removeItem('k8_dream_' + sid()); } catch (e) {}
    paint(); if (typeof showToast === 'function') showToast(r.message || r.error || 'บันทึกไม่สำเร็จ', 'error');
  }
  window.addEventListener('online', () => { const c = cacheGet(); if (c && c.pending) load(); });
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
    const onD = (s, ds, k) => (s.dates || []).length ? s.dates.indexOf(ds) !== -1 : s.days.indexOf(k) !== -1; // v17.92 · วันที่จัด
    const todays = (my.sessions || []).filter((s) => onD(s, ymd(new Date()), wd)).sort((a, b) => toMin(a.start) - toMin(b.start));
    const logT = {}; (my.logs || []).forEach((l) => { if (l.date === today) logT[l.sessionId] = l; });
    // สถิติเดือนนี้: ครั้งที่ควรเข้า (วันที่ผ่านมาแล้วตามตาราง) เทียบกับที่บันทึกไว้
    const first = new Date(now.getFullYear(), now.getMonth(), 1); let expected = 0;
    for (let d = new Date(first); d <= now; d.setDate(d.getDate() + 1)) {
      const k = String(d.getDay()), ds = ymd(d);
      (my.sessions || []).forEach((s) => { if (onD(s, ds, k) && (!s.createdAt || ds >= s.createdAt) && (ds < today || toMin(s.end) < nowMin)) expected++; });
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
    if (H.view === 'pick') { H.view = 'edit'; render(); return; }
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
        (H.sessions.length ? '<ul class="k8-hq-list">' + H.sessions.slice().sort((a, b) => toMin(a.start) - toMin(b.start)).map((s) => '<li><div class="k8-hq-li-top"><span class="k8-hq-slot">' + (s.teacherName ? 'ผู้ดูแล ' + esc(s.teacherName) : esc(slotName(s.slot))) + '</span>' + ((s.members || []).length ? '<span class="k8-hq-chip" style="color:#0369a1;background:#e0f2fe">ผู้เรียน ' + s.members.length + ' คน</span>' : '') + (((s.dates || []).length ? s.dates.indexOf(ymd(new Date())) !== -1 : s.days.indexOf(wd) !== -1) ? '<span class="k8-hq-chip" style="color:#047857;background:#d1fae5">มีวันนี้</span>' : '') + '</div><b>' + esc(s.name) + '</b><small>' + esc(s.start) + '–' + esc(s.end) + ' · ' + ((s.dates || []).length ? (s.dates.filter((x) => x >= ymd(new Date())).slice(0, 3).map(dTh).join(', ') || 'จัดครบทุกวันแล้ว') + (s.dates.filter((x) => x >= ymd(new Date())).length > 3 ? ' …' : '') : s.days.length === 7 ? 'ทุกวัน' : s.days.map((d) => DAYS[+d]).join(' ')) + ' · ' + ((s.members || []).length ? 'เฉพาะกลุ่ม' : s.grades.length ? s.grades.map((g) => 'ม.' + g).join(', ') : 'ทุกชั้น') + (s.location ? ' · ' + esc(s.location) : '') + '</small>' +
          '<div class="k8-hq-acts"><button type="button" class="is-pri" onclick="k8HqQr(\'' + js(s.id) + '\')">แสดง QR</button><button type="button" onclick="k8HqRoster(\'' + js(s.id) + '\')">เช็ครายชื่อ</button><button type="button" onclick="k8HqEdit(\'' + js(s.id) + '\')">แก้ไข</button></div></li>').join('') + '</ul>'
          : '<div class="k8-docs-empty"><b>ยังไม่มีหะละเกาะฮฺ</b><span>เพิ่มกลุ่มแรก ใส่ชื่อผู้ดูแล แล้วดึงรายชื่อนักเรียนเข้ากลุ่ม · ค่าเริ่มต้น วันจันทร์ 10:00–11:40</span></div>');
    } else if (H.view === 'edit') {
      const e = H.edit; title.textContent = e.id ? 'แก้ไขหะละเกาะฮฺ' : 'เพิ่มหะละเกาะฮฺ'; sub.textContent = 'ผู้ดูแล · วันเวลา · รายชื่อผู้เรียน';
      const mem = (e.members || []); const byId = {}; allStu().forEach((x) => { byId[nid(x.studentId)] = x; });
      const staff = staffNames();
      body.innerHTML = '<section class="k8-bh-card">' +
        '<label class="k8-nf-f"><span>ชื่อกลุ่ม</span><input type="text" id="k8HqName" maxlength="80" value="' + esc(e.name) + '" placeholder="เช่น หะละเกาะฮฺกลุ่ม 1"></label>' +
        '<label class="k8-nf-f"><span>ผู้ดูแล</span><input type="text" id="k8HqTeacher" maxlength="80" list="k8HqStaff" value="' + esc(e.teacherName || '') + '" placeholder="พิมพ์หรือเลือกชื่ออาจารย์ผู้ดูแล" autocomplete="off"><datalist id="k8HqStaff">' + staff.map((n) => '<option value="' + esc(n) + '"></option>').join('') + '</datalist></label>' +
        '<div class="k8-hq-times"><label class="k8-nf-f"><span>เริ่ม</span><input type="time" id="k8HqStart" value="' + esc(e.start) + '"></label><label class="k8-nf-f"><span>สิ้นสุด</span><input type="time" id="k8HqEnd" value="' + esc(e.end) + '"></label></div>' +
        // v17.92 · วันที่จัด: ทุกสัปดาห์ (เลือกวัน) หรือ เลือกวันที่จากปฏิทิน
        '<div class="k8-nf-f"><span>วันที่จัดหะละเกาะฮฺ</span><div class="k8-tt-seg2"><button type="button" aria-pressed="' + !e.byDate + '" onclick="k8HqMode(0)">ทุกสัปดาห์</button><button type="button" aria-pressed="' + !!e.byDate + '" onclick="k8HqMode(1)">📅 เลือกวันที่</button></div></div>' +
        (e.byDate ? '<div class="k8-nf-f"><div class="k8-hq-dadd"><input type="date" id="k8HqDate" value="' + esc(ymd(new Date())) + '"><button type="button" class="k8-hq-pullbtn" onclick="k8HqDateAdd()">＋ เพิ่มวันที่</button></div><div class="k8-hq-mem-list">' + ((e.dates || []).length ? e.dates.map((x) => '<span>' + esc(dTh(x)) + '<button type="button" aria-label="เอาออก" onclick="k8HqDateDel(\'' + x + '\')">✕</button></span>').join('') : '<p class="k8-hq-tip">ยังไม่ได้เลือกวันที่ · เลือกจากปฏิทินแล้วกด "เพิ่มวันที่" (เพิ่มได้หลายวัน)</p>') + '</div></div>' :
        '<div class="k8-nf-f"><div class="k8-na-chips">' + DAYS.map((d, i) => '<button type="button" aria-pressed="' + (e.days.indexOf(String(i)) !== -1) + '" onclick="k8HqDay(\'' + i + '\')">' + d + '</button>').join('') + '<button type="button" onclick="k8HqDay(\'all\')">ทุกวัน</button></div></div>') +
        '<div class="k8-nf-f"><span>ผู้เรียน</span><div class="k8-hq-mem"><div class="k8-hq-mem-top"><b>' + mem.length + ' คน</b><button type="button" class="k8-hq-pullbtn" onclick="k8HqPick()">＋ ดึงรายชื่อนักเรียน</button></div>' +
          (mem.length ? '<div class="k8-hq-mem-list">' + mem.slice(0, 60).map((id) => { const x = byId[id]; return '<span>' + esc(x ? x.fullName : id) + (x ? ' <small>' + esc(String(x.grade || '').replace('มัธยมศึกษาปีที่ ', 'ม.')) + '</small>' : '') + '<button type="button" aria-label="เอาออก" onclick="k8HqMemDel(\'' + js(id) + '\')">✕</button></span>'; }).join('') + (mem.length > 60 ? '<span>และอีก ' + (mem.length - 60) + ' คน</span>' : '') + '</div>' : '<p class="k8-hq-tip">ยังไม่มีผู้เรียน · กด "ดึงรายชื่อนักเรียน" เพื่อเลือกนักเรียนเข้ากลุ่มนี้ ระบบจะเช็คชื่อและให้สแกน QR เฉพาะคนในกลุ่ม</p>') + '</div></div>' +
        '<label class="k8-nf-f"><span>สถานที่ (ไม่บังคับ)</span><input type="text" id="k8HqLoc" maxlength="80" value="' + esc(e.location) + '" placeholder="เช่น มัสยิด ชั้น 2"></label>' +
        '<div class="k8-dr-btns">' + (e.id ? '<button type="button" class="is-alt" onclick="k8HqDelete()">ลบ</button>' : '') + '<button type="button" class="k8-hq-save" ' + (H.saving ? 'disabled' : '') + ' onclick="k8HqSave()">' + (H.saving ? 'กำลังบันทึก…' : 'บันทึก') + '</button></div></section>';
    } else if (H.view === 'pick') {
      const e = H.edit; const P = H.pick; const q = (P.q || '').trim().toLowerCase();
      title.textContent = 'ดึงรายชื่อนักเรียน'; sub.textContent = (e.name || 'หะละเกาะฮฺ') + ' · เลือกแล้ว ' + P.sel.size + ' คน';
      const L = allStu().filter((x) => (P.g === 'ALL' || gnum(x.grade) === P.g) && (P.sx === 'all' || (P.sx === 'f') === !!(window.k8IsGirl && window.k8IsGirl(x))) && (!q || String(x.fullName || '').toLowerCase().includes(q) || nid(x.studentId).includes(q.replace(/^0+/, '')))).sort((a, b) => String(a.grade).localeCompare(String(b.grade)) || String(a.fullName).localeCompare(String(b.fullName), 'th'));
      const allOn = L.length && L.every((x) => P.sel.has(nid(x.studentId)));
      body.innerHTML = '<section class="k8-bh-card"><input type="search" id="k8HqPq" class="k8h-search" placeholder="ค้นหาชื่อหรือรหัส" value="' + esc(P.q || '') + '" oninput="k8HqPq(this)" autocomplete="off">' +
        '<div class="k8-na-chips">' + ['ALL', '1', '2', '3', '4', '5', '6'].map((g) => '<button type="button" aria-pressed="' + (P.g === g) + '" onclick="k8HqPset(\'g\',\'' + g + '\')">' + (g === 'ALL' ? 'ทุกชั้น' : 'ม.' + g) + '</button>').join('') + '</div>' +
        '<div class="k8-na-chips">' + [['all', 'ทั้งหมด'], ['m', 'ชาย'], ['f', 'หญิง']].map(([k, l]) => '<button type="button" aria-pressed="' + (P.sx === k) + '" onclick="k8HqPset(\'sx\',\'' + k + '\')">' + l + '</button>').join('') + '</div>' +
        (L.length ? '<button type="button" class="k8-bh-link" onclick="k8HqPall()">' + (allOn ? 'ยกเลิกทั้งหมดในรายการ' : 'เลือกทั้งหมดในรายการ (' + L.length + ' คน)') + '</button>' : '') +
        '<ul class="k8-bh-stu k8-hq-pick">' + (L.length ? L.slice(0, 400).map((x) => { const k = nid(x.studentId); const on = P.sel.has(k); return '<li><button type="button" role="checkbox" aria-checked="' + on + '" onclick="k8HqPt(\'' + js(k) + '\')"><span class="k8-bh-chk">' + (on ? '✓' : '') + '</span><span class="k8-bh-who"><b>' + esc(x.fullName) + '</b><small>' + esc(String(x.grade || '').replace('มัธยมศึกษาปีที่ ', 'ม.')) + ' · ' + esc(x.studentId) + '</small></span></button></li>'; }).join('') : '<li class="k8-bh-empty">ไม่พบนักเรียน</li>') + '</ul></section>' +
        '<div class="k8-bh-savebar"><span class="k8-bh-savebar-t">เลือกแล้ว <b>' + P.sel.size + '</b> คน</span><button type="button" class="k8-bh-go" style="background:#0369a1" onclick="k8HqPdone()">ใช้รายชื่อนี้</button></div>';
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
    H.edit = s ? JSON.parse(JSON.stringify(s)) : { id: '', name: 'หะละเกาะฮฺ', slot: 'other', start: '10:00', end: '11:40', days: ['1'], grades: [], location: '', teacherName: myName(), members: [] };
    if (!H.edit.members) H.edit.members = [];
    H.edit.byDate = !!(H.edit.dates && H.edit.dates.length);
    H.view = 'edit'; stack('edit'); render();
  };
  function grab() { const e = H.edit; if (!e) return; const g = (id) => (document.getElementById(id) || {}).value; e.name = g('k8HqName') ?? e.name; e.start = g('k8HqStart') ?? e.start; e.end = g('k8HqEnd') ?? e.end; e.location = g('k8HqLoc') ?? e.location; e.teacherName = g('k8HqTeacher') ?? e.teacherName; }
  window.k8HqSet = function (k, v) { grab(); const e = H.edit; const was = slotName(e.slot); e[k] = v; if (k === 'slot' && (!e.name || e.name === 'หะละเกาะฮฺ' + was)) e.name = 'หะละเกาะฮฺ' + slotName(v); render(); };
  window.k8HqDay = function (d) { grab(); const e = H.edit; if (d === 'all') e.days = e.days.length === 7 ? [] : ['0', '1', '2', '3', '4', '5', '6']; else { const i = e.days.indexOf(d); if (i === -1) e.days.push(d); else e.days.splice(i, 1); } render(); };
  window.k8HqGrade = function (g) { grab(); const e = H.edit; const i = e.grades.indexOf(g); if (i === -1) e.grades.push(g); else e.grades.splice(i, 1); render(); };
  // v17.80 · ดึงรายชื่อนักเรียนเข้ากลุ่ม
  function allStu() { let l = []; try { l = allStudents || []; } catch (e) {} return l.filter((x) => x && x.studentId && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(x.status || ''))); }
  const nid = (v) => String(v || '').trim().replace(/^0+/, '');
  const gnum = (g) => { const m = String(g || '').match(/([1-6])/); return m ? m[1] : ''; };
  function myName() { try { return (currentAdmin && (currentAdmin.fullName || currentAdmin.username)) || ''; } catch (e) { return ''; } }
  function staffNames() { const out = new Set(); ['khalifah_subadmins', 'khalifah_sub_admins'].forEach((k) => { try { (JSON.parse(localStorage.getItem(k) || '[]') || []).forEach((a) => { const n = a && (a.fullName || a.name); if (n && !/INSPECTOR|ผู้ตรวจการ|EXECUTIVE|ActivityAdmin|NIGHTDUTY/i.test(String(a.role || '')) || (n && /TEACHER|อาจารย์|ครู/i.test(String(a.role || '')))) out.add(String(n).trim()); }); } catch (e) {} }); const m = myName(); if (m) out.add(m); return Array.from(out).sort((a, b) => a.localeCompare(b, 'th')); }
  window.k8HqPick = function () { grab(); H.pick = { q: '', g: 'ALL', sx: 'all', sel: new Set((H.edit.members || []).map(nid)) }; H.view = 'pick'; stack('pick'); render(); };
  window.k8HqPset = function (k, v) { H.pick[k] = v; render(); };
  window.k8HqPq = function (el) { H.pick.q = el.value; const pos = el.selectionStart; render(); const n = document.getElementById('k8HqPq'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } };
  window.k8HqPt = function (k) { const S = H.pick.sel; if (S.has(k)) S.delete(k); else S.add(k); render(); };
  window.k8HqPall = function () { const P = H.pick; const q = (P.q || '').trim().toLowerCase(); const L = allStu().filter((x) => (P.g === 'ALL' || gnum(x.grade) === P.g) && (P.sx === 'all' || (P.sx === 'f') === !!(window.k8IsGirl && window.k8IsGirl(x))) && (!q || String(x.fullName || '').toLowerCase().includes(q) || nid(x.studentId).includes(q.replace(/^0+/, '')))); const on = L.length && L.every((x) => P.sel.has(nid(x.studentId))); L.forEach((x) => { const k = nid(x.studentId); if (on) P.sel.delete(k); else P.sel.add(k); }); render(); };
  window.k8HqPdone = function () { H.edit.members = Array.from(H.pick.sel); history.back(); };
  window.k8HqMemDel = function (id) { grab(); H.edit.members = (H.edit.members || []).filter((x) => x !== id); render(); };
  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function dTh(x) { const d = new Date(x + 'T00:00:00'); return isNaN(d) ? x : DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + TH_M[d.getMonth()]; }
  window.k8HqMode = function (on) { grab(); H.edit.byDate = !!on; if (on && !H.edit.dates) H.edit.dates = []; render(); };
  window.k8HqDateAdd = function () { grab(); const v = (document.getElementById('k8HqDate') || {}).value; if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) { toast('เลือกวันที่ก่อน', 'warning'); return; } const L = H.edit.dates || (H.edit.dates = []); if (L.indexOf(v) === -1) L.push(v); L.sort(); render(); };
  window.k8HqDateDel = function (x) { grab(); H.edit.dates = (H.edit.dates || []).filter((d) => d !== x); render(); };
  function staffMap() { const m = {}; ['khalifah_subadmins', 'khalifah_sub_admins', 'khalifah_teachers'].forEach((k) => { try { (JSON.parse(localStorage.getItem(k) || '[]') || []).forEach((a) => { const n = a && (a.fullName || a.name); if (n && a.username) m[String(n).trim()] = a.username; }); } catch (e) {} }); return m; }
  window.k8HqSave = async function () {
    grab(); const E = H.edit;
    if (E.byDate && !(E.dates || []).length) { toast('เพิ่มวันที่จัดอย่างน้อย 1 วัน', 'warning'); return; }
    const out = Object.assign({}, E, { dates: E.byDate ? (E.dates || []) : [], days: E.byDate ? [] : E.days });
    let a = null; try { a = currentAdmin; } catch (e) {} const isAdm = a && /SUPER|ADMIN/i.test(String(a.role || '')) && !a.limited;
    if (isAdm) { const u = staffMap()[String(E.teacherName || '').trim()]; if (u) out.teacher = u; }
    H.saving = true; render();
    try { const r = await api('saveHalaqahSession', { data: out }); if (!r || !r.success) throw new Error((r && r.message) || 'บันทึกไม่สำเร็จ'); toast(r.message, 'success'); H.saving = false; history.back(); }
    catch (e) { H.saving = false; toast(e.message, 'error'); render(); }
  };
  window.k8HqDelete = async function () {
    if (!window.confirm('ลบหะละเกาะฮฺ "' + H.edit.name + '"? ประวัติการเข้าที่บันทึกไว้ยังเก็บไว้ใน Google Sheets')) return;
    try { const r = await api('deleteHalaqahSession', { data: { id: H.edit.id } }); if (!r || !r.success) throw new Error((r && r.message) || 'ลบไม่สำเร็จ'); toast(r.message, 'success'); history.back(); } catch (e) { toast(e.message, 'error'); }
  };
  // v17.81 · เติมชื่อผู้เรียนในกลุ่มจากรายชื่อในแอป (กรณีเซิร์ฟเวอร์จับคู่รหัสไม่ได้ หรือยังไม่คืนรายชื่อ)
  const hk = (v) => String(v == null ? '' : v).trim().toUpperCase().replace(/[^0-9A-Z\u0E00-\u0E7F]/g, '').replace(/^0+/, '');
  function fillRoster(r) {
    const mem = (H.cur && H.cur.members) || []; if (!r || !mem.length) return r;
    const by = {}; allStu().forEach((x) => { by[hk(x.studentId)] = x; });
    const have = {}; (r.students || []).forEach((x) => { if (!x.unresolved) have[hk(x.studentId)] = 1; });
    const rest = (r.students || []).filter((x) => x.unresolved).reduce((o, x) => { o[hk(x.studentId)] = x; return o; }, {});
    const out = (r.students || []).filter((x) => !x.unresolved);
    mem.forEach((k) => { if (have[k]) return; const x = by[k]; const u = rest[k] || {}; out.push({ studentId: x ? x.studentId : k, fullName: x ? x.fullName : 'รหัส ' + k, grade: x ? x.grade : '', status: u.status || '', time: u.time || '', method: u.method || '', fromApp: true }); });
    r.students = out; return r;
  }
  async function loadRoster() { try { const r = await api('getHalaqahRoster', { id: H.cur.id, date: H.date }); if (r && r.success) H.roster = fillRoster(r); } catch (e) {} if (H.open && (H.view === 'qr' || H.view === 'roster')) render(); }
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
    try { const names = {}, grades = {}; ((H.roster && H.roster.students) || []).forEach((x) => { if (x.fromApp) { names[hk(x.studentId)] = x.fullName; grades[hk(x.studentId)] = x.grade; } }); const r = await api('markHalaqah', { data: { id: H.cur.id, date: H.date, marks: H.marks, names, grades } }, 45000); if (!r || !r.success) throw new Error((r && r.message) || 'บันทึกไม่สำเร็จ'); toast(r.message, 'success'); H.marks = {}; }
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
  // นักเรียน (หน้าแรก) และอาจารย์ (ภาพรวม) ใช้การ์ดเดียวกัน
  const SLOTS = [['hfWeekDays', 'hfWeekNext', 'openSchoolCalendarModal()'], ['k8ThWeekDays', 'k8ThWeekNext', "switchTeacherTab('calendar')"]];
  function render() { SLOTS.forEach((s) => { try { renderOne(s[0], s[1], s[2]); } catch (e) {} }); }
  window.k8WeekCalRender = render;
  function renderOne(daysId, nextId, go) {
    const box = document.getElementById(daysId); if (!box) return;
    const now = new Date(); const today = ymd(now);
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const evs = events();
    let h = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i); const ds = ymd(d);
      const list = evs.filter((e) => onDay(e, ds));
      const label = WF[d.getDay()] + ' ' + d.getDate() + ' ' + M[d.getMonth()] + (list.length ? ' · ' + list.map((e) => e.title).join(', ') : ' · ไม่มีกิจกรรม');
      h += '<button type="button" class="hf-wd' + (ds === today ? ' is-today' : '') + (ds < today ? ' is-past' : '') + '" onclick="' + go + '" aria-label="' + esc(label) + '" title="' + esc(label) + '"><span>' + W[i] + '</span><b>' + d.getDate() + '</b><i' + (list.length ? '' : ' class="none"') + '></i></button>';
    }
    box.innerHTML = h;
    // เรื่องถัดไป + นับวัน
    const up = evs.filter((e) => String(e.endDate || e.startDate).slice(0, 10) >= today).sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
    const next = document.getElementById(nextId);
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

/* ============ v11.5 · คิวส่งข้อมูลกันหาย (รูปละหมาด / เช็คชื่อ) ============
   ทุกรายการถูกเก็บลง IndexedDB ในเครื่องก่อนส่งเสมอ แล้วค่อยส่งขึ้นระบบ
   - เน็ตหลุด: เก็บไว้ ส่งให้เองเมื่อกลับมาออนไลน์
   - ปิดจอ / ปัดแอปทิ้ง: Android ส่งต่อเบื้องหลังผ่าน Service Worker (Background Sync)
     ส่วน iPhone จะส่งให้ทันทีที่เปิดแอปครั้งถัดไป
   - ระบบหลังบ้านกันข้อมูลซ้ำด้วยรหัสรายการ (logId) ส่งซ้ำได้ปลอดภัย */
(function () {
  const DB = 'khalifah-outbox', ST = 'q', META = 'khalifah_outbox_meta';
  let dbp = null;
  function idb() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(ST)) r.result.createObjectStore(ST, { keyPath: 'id' }); };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    }).catch((e) => { dbp = null; throw e; });
    return dbp;
  }
  const tx = (mode, fn) => idb().then((db) => new Promise((res, rej) => { const t = db.transaction(ST, mode); const out = fn(t.objectStore(ST)); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }));
  const put = (it) => tx('readwrite', (s) => s.put(it));
  const del = (id) => tx('readwrite', (s) => s.delete(id));
  const all = () => tx('readonly', (s) => s.getAll()).then((r) => (Array.isArray(r) ? r : []).sort((a, b) => a.createdAt - b.createdAt));

  // สำเนาแบบเบาใน localStorage: ให้หน้าจอรู้ทันที (แบบ sync) ว่ามีรายการค้างส่งอะไรบ้าง
  function metaGet() { try { const m = JSON.parse(localStorage.getItem(META) || '[]'); return Array.isArray(m) ? m : []; } catch (e) { return []; } }
  function metaSet(m) { try { localStorage.setItem(META, JSON.stringify(m)); } catch (e) { try { localStorage.setItem(META, JSON.stringify(m.map((x) => Object.assign({}, x, { rec: Object.assign({}, x.rec, { photo: '', photoUrl: '', photoBase64: '' }) })))); } catch (e2) {} } paintBar(); }
  window.k8OutboxPendingRecords = function (actions) { return metaGet().filter((x) => !actions || actions.indexOf(x.action) !== -1).map((x) => x.rec); };
  const count = () => metaGet().length;
  // แสดงแถบ "รอส่ง" เฉพาะเมื่อไม่มีเน็ต หรือส่งไม่สำเร็จนานเกิน 30 วินาที · ปกติส่งเงียบๆ เบื้องหลัง นักเรียนไม่ต้องกดอะไร
  const STUCK_MS = 30000;
  const stuckCount = () => { const m = metaGet(); if (navigator.onLine === false) return m.length; const now = Date.now(); return m.filter((x) => now - (x.at || 0) > STUCK_MS).length; };
  window.k8OutboxStuck = () => stuckCount() > 0;

  function slim(action, data) {
    const d = Object.assign({}, data || {});
    if (d.photoBase64) { delete d.photo; if (String(d.photoUrl || '').indexOf('data:') === 0) delete d.photoUrl; }
    return d;
  }
  const tok = () => { try { return getSessionToken() || ''; } catch (e) { return ''; } };
  const gasUrl = () => { try { return getGasUrl(); } catch (e) { return ''; } };

  function askBgSync() {
    try { if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then((r) => r.sync && r.sync.register('k8-outbox')).catch(() => {}); } catch (e) {}
  }

  window.k8OutboxSend = async function (action, data) {
    const d = slim(action, data);
    const id = String(d.logId || d.id || (action + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)));
    const item = { id, action, url: gasUrl(), body: JSON.stringify({ action, data: d, token: tok() }), createdAt: Date.now(), tries: 0 };
    const m = metaGet().filter((x) => x.id !== id); m.push({ id, action, rec: data, at: item.createdAt }); metaSet(m);
    try { await put(item); } catch (e) { /* IndexedDB ใช้ไม่ได้ (โหมดส่วนตัวบางรุ่น): ส่งตรง */ return sendOne(item, true); }
    askBgSync();
    return flush();
  };

  // ผลลัพธ์: 'ok' ลบออกจากคิว · 'retry' เก็บไว้ส่งใหม่ · 'drop' ข้อมูลถูกปฏิเสธถาวร
  async function sendOne(item, noQueue) {
    const url = gasUrl() || item.url; if (!url) return 'retry';
    let body = item.body;
    const t = tok();
    if (t) { try { const b = JSON.parse(body); if (b.token !== t) { b.token = t; body = JSON.stringify(b); } } catch (e) {} }
    let r;
    try {
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
      r = await resp.json();
    } catch (e) { return 'retry'; }
    if (!r || r.success !== false) return 'ok';
    if (r.code === 'AUTH_REQUIRED') return 'retry';
    if (noQueue) return 'drop';
    item.tries = (item.tries || 0) + 1;
    if (item.tries >= 5 || r.code === 'FORBIDDEN' || r.code === 'VALIDATION') return 'drop';
    try { await put(item); } catch (e) {}
    return 'retry';
  }

  let busy = null;
  function flush() {
    if (busy) return busy;
    busy = (async () => {
      let items = []; try { items = await all(); } catch (e) { return; }
      // ซิงค์สำเนา meta ให้ตรงกับคิวจริง (Service Worker อาจส่งไปแล้วตอนแอปปิดอยู่)
      const ids = new Set(items.map((x) => x.id)); const m0 = metaGet(); const m1 = m0.filter((x) => ids.has(x.id));
      if (m1.length !== m0.length) metaSet(m1);
      for (const it of items) {
        if (navigator.onLine === false) break;
        const res = await sendOne(it);
        if (res === 'retry') break;
        try { await del(it.id); } catch (e) {}
        metaSet(metaGet().filter((x) => x.id !== it.id));
        if (res === 'drop' && typeof showToast === 'function') showToast('มี 1 รายการที่ระบบไม่รับ จึงนำออกจากคิวแล้ว', 'warning');
      }
    })().finally(() => { busy = null; paintBar(); });
    return busy;
  }
  window.k8OutboxFlush = function () { if (navigator.onLine === false) { if (typeof showToast === 'function') showToast('ยังไม่มีอินเทอร์เน็ต · จะส่งให้อัตโนมัติเมื่อเชื่อมต่อได้', 'info'); return; } flush(); };

  // แถบบอกสถานะบนหน้าละหมาด
  function paintBar() {
    const view = document.getElementById('view-prayer'); if (!view) return;
    let bar = document.getElementById('k8Outbox');
    const n = stuckCount();
    const cs = document.getElementById('k8CamDoneSub');
    if (cs) cs.textContent = cs.textContent.replace(n ? ' · บันทึกเรียบร้อย' : ' · เก็บในเครื่องแล้ว จะส่งอัตโนมัติเมื่อมีเน็ต', n ? ' · เก็บในเครื่องแล้ว จะส่งอัตโนมัติเมื่อมีเน็ต' : ' · บันทึกเรียบร้อย');
    if (count() && !n) setTimeout(paintBar, STUCK_MS + 500);
    if (!n) { if (bar) bar.hidden = true; return; }
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'k8Outbox'; bar.className = 'k8-outbox'; bar.setAttribute('role', 'status');
      const head = view.querySelector('.k8-pg-head');
      if (head && head.parentNode) head.parentNode.insertBefore(bar, head.nextSibling); else view.insertBefore(bar, view.firstChild);
    }
    bar.hidden = false;
    const off = navigator.onLine === false;
    bar.innerHTML = '<span class="k8-outbox-ico" aria-hidden="true">' + (busy ? '⟳' : '⏳') + '</span><span class="k8-outbox-t"><b>รอส่ง ' + n + ' รายการ</b><small>' + (off ? 'ยังไม่มีเน็ต · รูปเก็บในเครื่องแล้ว ไม่หาย ระบบจะส่งให้เอง' : (busy ? 'กำลังส่งขึ้นระบบ…' : 'สัญญาณไม่ดี · ระบบจะลองส่งให้เองเรื่อยๆ')) + '</small></span>' + (busy || off ? '' : '<button type="button" onclick="k8OutboxFlush()">ลองส่งอีกครั้ง</button>');
  }

  window.addEventListener('online', () => { paintBar(); flush(); });
  window.addEventListener('offline', paintBar);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flush(); else if (count()) askBgSync(); });
  window.addEventListener('pagehide', () => { if (count()) { askBgSync(); flush(); } });
  setInterval(() => { if (count() && document.visibilityState === 'visible') flush(); }, 45000);
  const start = () => { paintBar(); setTimeout(flush, 1500); };
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
  // เมื่อเข้าสู่ระบบใหม่ (เช่น เซสชันหมดอายุ) ส่งรายการค้างต่อทันที
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) { const r = sv.apply(this, arguments); if (v === 'prayer') paintBar(); if (count()) setTimeout(flush, 300); return r; };
})();

/* ============ v11.6 · แอดมินแก้ไข/เพิ่มบันทึกละหมาด · ตั้งช่วงเวลาละหมาด · รูปโปรไฟล์นักเรียน ============ */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t) => { if (typeof showToast === 'function') showToast(m, t || 'info'); };
  const cid = (v) => { try { return cleanIdString(v); } catch (e) { return String(v || '').trim(); } };
  const slotOf = (p) => { try { return normalizePrayerSlotKey(p.prayerName || p.prayerTime || ''); } catch (e) { return p.prayerName || p.prayerTime || ''; } };
  const isStaff = () => { try { return !!currentAdmin; } catch (e) { return false; } };
  const readJ = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const STATUSES = ['ตรงเวลา (ญะมาอะฮ์/มัสยิด)', 'ตรงเวลา (ละหมาดคนเดียว)', 'มาสาย', 'อุซุร (มีประจำเดือน)', 'ลา/มีเหตุจำเป็น', 'ขาด'];
  const slots = () => { try { return PRAYER_TIME_WINDOWS.map((w) => w.key); } catch (e) { return ['ซุบฮิ', 'ซุฮริ', 'อัศรฺ', 'มัฆริบ', 'อีชาอ์']; } };

  // ---------- ช่วงเวลาละหมาด (ตั้งค่าจากแอดมิน) ----------
  let DEF = null;
  try { DEF = PRAYER_TIME_WINDOWS.map((w) => ({ startMin: w.startMin, endMin: w.endMin, baseLabel: w.baseLabel })); } catch (e) {}
  const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const toMin = (t) => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : NaN; };
  function applyWindows(list) {
    if (!DEF) return;
    if (typeof window.k8PtApply === 'function') { window.k8PtApply(); return; } // v17.5 · ใช้เวลาละหมาดจริงแบบเรียลไทม์
    try {
      PRAYER_TIME_WINDOWS.forEach((w, i) => {
        const c = Array.isArray(list) && list[i];
        const a = c ? toMin(c.start) : NaN, b = c ? toMin(c.end) : NaN;
        if (c && !isNaN(a) && !isNaN(b) && b > a) { w.startMin = a; w.endMin = b; w.baseLabel = hhmm(a) + ' - ' + hhmm(b) + ' น.'; }
        else { w.startMin = DEF[i].startMin; w.endMin = DEF[i].endMin; w.baseLabel = DEF[i].baseLabel; }
        try { if (CANONICAL_PRAYERS[i]) CANONICAL_PRAYERS[i].range = w.baseLabel; } catch (e) {}
      });
    } catch (e) {}
    const sum = document.getElementById('k8PwSummary');
    if (sum) { try { sum.textContent = PRAYER_TIME_WINDOWS.map((w) => w.key + ' ' + hhmm(w.startMin) + '–' + hhmm(w.endMin)).join(' · '); } catch (e) {} }
  }
  let saved = null; try { saved = JSON.parse(localStorage.getItem('khalifah_prayer_windows') || 'null'); } catch (e) {}
  applyWindows(saved);
  function loadWindows() {
    try {
      const url = (typeof getGasUrl === 'function') ? getGasUrl() : ''; if (!url) return Promise.resolve();
      return fetch(url + (url.indexOf('?') === -1 ? '?' : '&') + 'action=getSettings&_t=' + Date.now()).then((r) => r.json()).then((j) => {
        const raw = j && j.data ? j.data.PrayerWindows : null; let v = null; try { v = raw ? JSON.parse(raw) : null; } catch (e) {}
        if (JSON.stringify(v) === JSON.stringify(saved)) return;
        saved = v; try { localStorage.setItem('khalifah_prayer_windows', JSON.stringify(v)); } catch (e) {}
        applyWindows(v);
        try { if (window.updatePrayerV8) window.updatePrayerV8(); } catch (e) {}
        try { if (typeof renderHomeF === 'function') renderHomeF(); } catch (e) {}
      }).catch(() => {});
    } catch (e) { return Promise.resolve(); }
  }
  setTimeout(loadWindows, 1800);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') loadWindows(); });

  window.k8PwOpen = function () {
    const body = document.getElementById('k8PwBody'); if (!body) return;
    let rows = ''; try { rows = PRAYER_TIME_WINDOWS.map((w, i) => '<div class="k8-pw-row"><b>' + esc(w.key) + '</b><label><span>เริ่ม</span><input type="time" id="k8PwS' + i + '" value="' + hhmm(w.startMin) + '"></label><label><span>สิ้นสุด</span><input type="time" id="k8PwE' + i + '" value="' + hhmm(w.endMin) + '"></label></div>').join(''); } catch (e) {}
    body.innerHTML = '<p class="k8-pw-hint">เวลาที่นักเรียนเช็คชื่อได้ในแต่ละเวลาละหมาด · ก่อนเวลาเริ่มจะยังกดไม่ได้ และหลังเวลาสิ้นสุดจะนับว่าเลยเวลา</p>' + rows +
      '<div class="k8-dr-btns"><button type="button" class="is-alt" onclick="k8PwReset()">ใช้ค่าเริ่มต้น</button><button type="button" id="k8PwSave" onclick="k8PwSave()">บันทึกเวลา</button></div>';
    openModal('k8PwModal');
  };
  async function sendWindows(list, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก…'; }
    let r = null; try { r = await gasApiCall('savePrayerWindows', { data: { windows: list } }, 20000); } catch (e) { r = { success: false, message: 'เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้ง' }; }
    if (btn) { btn.disabled = false; btn.textContent = 'บันทึกเวลา'; }
    if (!r || !r.success) { toast((r && (r.message || r.error)) || 'บันทึกไม่สำเร็จ', 'error'); return; }
    saved = list; try { localStorage.setItem('khalifah_prayer_windows', JSON.stringify(list)); } catch (e) {}
    applyWindows(list); closeModal('k8PwModal'); toast(r.message, 'success');
    try { if (typeof renderAdminPrayerDailyDashboard === 'function') renderAdminPrayerDailyDashboard(); } catch (e) {}
  }
  window.k8PwSave = function () {
    const list = slots().map((k, i) => ({ key: k, start: (document.getElementById('k8PwS' + i) || {}).value || '', end: (document.getElementById('k8PwE' + i) || {}).value || '' }));
    for (let i = 0; i < list.length; i++) {
      const a = toMin(list[i].start), b = toMin(list[i].end);
      if (isNaN(a) || isNaN(b) || b <= a) { toast('เวลา' + list[i].key + ': เวลาสิ้นสุดต้องหลังเวลาเริ่ม', 'warning'); return; }
      if (i && a <= toMin(list[i - 1].end)) { toast('เวลา' + list[i].key + ' ซ้อนกับ' + list[i - 1].key, 'warning'); return; }
    }
    sendWindows(list, document.getElementById('k8PwSave'));
  };
  window.k8PwReset = function () { if (!DEF) return; DEF.forEach((d, i) => { const s = document.getElementById('k8PwS' + i), e = document.getElementById('k8PwE' + i); if (s) s.value = hhmm(d.startMin); if (e) e.value = hhmm(d.endMin); }); toast('ใส่ค่าเริ่มต้นแล้ว · กด "บันทึกเวลา" เพื่อใช้งาน', 'info'); };

  // ---------- แก้ไข / เพิ่มบันทึกละหมาด ----------
  function findRec(id) {
    if (!id) return null;
    const hit = (p) => p && (p.id === id || p.logId === id);
    let r = readJ('khalifah_prayer_history').find(hit) || readJ('khalifah_today_prayers').find(hit);
    if (!r) { try { r = (todayPrayers || []).find(hit); } catch (e) {} }
    if (!r) { try { Object.values(cachedDailyStudentPrayerMap || {}).some((m) => Object.values(m || {}).some((p) => (hit(p) ? (r = p) : false))); } catch (e) {} }
    if (!r) { try { r = getAllCombinedPrayerHistory().find(hit); } catch (e) {} }
    return r || null;
  }
  const studentOf = (sid) => { try { return (allStudents || []).find((s) => cid(s.studentId) === cid(sid)) || null; } catch (e) { return null; } };
  let E = null;
  function form() {
    const body = document.getElementById('k8PeBody'); if (!body) return;
    const st = E.status || STATUSES[0];
    const girlRec = (() => { const s0 = studentOf(E.studentId); return !!(s0 && window.k8IsGirl && window.k8IsGirl(s0)); })();
    const base = STATUSES.filter((o) => girlRec || !/ประจำเดือน/.test(o) || o === st); // v17.45 · มีประจำเดือน เฉพาะนักเรียนหญิง
    const opts = base.indexOf(st) === -1 ? [st].concat(base) : base;
    const sl = slots(); const cur = E.slot;
    body.innerHTML = '<div class="k8-pe-slots" role="radiogroup" aria-label="เวลาละหมาด">' + sl.map((k) => '<button type="button" role="radio" aria-checked="' + (k === cur) + '" onclick="k8PeSlot(\'' + esc(k) + '\')">' + esc(k) + '</button>').join('') + '</div>' +
      '<div class="k8-pe-2"><label class="k8-nf-f"><span>วันที่</span><input type="date" id="k8PeDate" value="' + esc(E.date) + '"></label><label class="k8-nf-f"><span>เวลาที่บันทึก</span><input type="time" id="k8PeTime" value="' + esc(String(E.time || '').slice(0, 5)) + '"></label></div>' +
      '<label class="k8-nf-f"><span>สถานะ</span><select id="k8PeStatus" class="k8-pe-sel">' + opts.map((o) => '<option' + (o === st ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select></label>' +
      '<label class="k8-nf-f"><span>หมายเหตุ (ไม่บังคับ)</span><textarea id="k8PeNote" rows="2" maxlength="300" placeholder="เช่น นักเรียนลืมเช็คชื่อ ยืนยันจากครูเวร">' + esc(String(E.note || '').replace(/\s*\[(แก้ไข|เพิ่ม)โดย [^\]]*\]\s*$/, '')) + '</textarea></label>' +
      '<p class="k8-pw-hint">ระบบจะบันทึกชื่อผู้แก้ไขและเวลาไว้ในหมายเหตุโดยอัตโนมัติ</p>' +
      '<div class="k8-dr-btns">' + (E.mode === 'edit' ? '<button type="button" class="is-alt k8-pe-del" onclick="k8PeDelete()">ลบรายการ</button>' : '') + '<button type="button" id="k8PeSave" onclick="k8PeSave()">' + (E.mode === 'edit' ? 'บันทึกการแก้ไข' : 'เพิ่มบันทึก') + '</button></div>';
  }
  function openE() {
    const s = studentOf(E.studentId);
    document.getElementById('k8PeTitle').textContent = E.mode === 'edit' ? 'แก้ไขบันทึกละหมาด' : 'เพิ่มบันทึกละหมาดแทนนักเรียน';
    document.getElementById('k8PeSub').textContent = ((s && s.fullName) || E.studentName || '') + ' · ' + cid(E.studentId);
    form(); openModal('k8PeModal');
  }
  window.k8PeEdit = function (id) {
    if (!isStaff()) return;
    const r = findRec(id); if (!r) { toast('ไม่พบรายการนี้ · ลองกดซิงค์ข้อมูลใหม่', 'warning'); return; }
    closeModal('prayerDetailModal');
    E = { mode: 'edit', id: r.logId || r.id, studentId: r.studentId, studentName: r.studentName, grade: r.grade, slot: slotOf(r), date: String(r.date || r.timestamp || '').slice(0, 10), time: r.time || '', status: r.status || '', note: r.note || '' };
    openE();
  };
  window.k8PeAdd = function (sid, slot) {
    if (!isStaff()) return;
    const d = (document.getElementById('adminPrayerDateSelect') || {}).value || new Date().toLocaleDateString('sv-SE');
    const s = studentOf(sid) || {};
    E = { mode: 'add', studentId: sid, studentName: s.fullName || '', grade: s.grade || '', slot: slot, date: d, time: '', status: STATUSES[0], note: '' };
    openE();
  };
  window.k8PeSlot = function (k) { pull(); E.slot = k; form(); };
  function pull() {
    const g = (id) => (document.getElementById(id) || {}).value;
    E.date = g('k8PeDate') || E.date; E.time = g('k8PeTime') || ''; E.status = g('k8PeStatus') || E.status; E.note = g('k8PeNote') || '';
  }
  function patchLocal(id, fn) {
    ['khalifah_prayer_history', 'khalifah_today_prayers'].forEach((k) => {
      const list = readJ(k); let ch = false; const out = [];
      list.forEach((p) => { if (p && (p.id === id || p.logId === id)) { ch = true; const n = fn(p); if (n) out.push(n); } else out.push(p); });
      if (ch) try { localStorage.setItem(k, JSON.stringify(out)); } catch (e) {}
    });
    try { const i = todayPrayers.findIndex((p) => p.id === id || p.logId === id); if (i !== -1) { const n = fn(todayPrayers[i]); if (n) todayPrayers[i] = n; else todayPrayers.splice(i, 1); } } catch (e) {}
  }
  function rerender() {
    try { if (typeof renderAdminPrayerDailyDashboard === 'function') renderAdminPrayerDailyDashboard(); } catch (e) {}
    try { if (typeof renderAdminStudentPrayerHistory === 'function') renderAdminStudentPrayerHistory(); } catch (e) {}
  }
  window.k8PeSave = async function () {
    pull();
    if (!E.slot) { toast('เลือกเวลาละหมาดก่อน', 'warning'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(E.date)) { toast('เลือกวันที่ก่อน', 'warning'); return; }
    const btn = document.getElementById('k8PeSave'); if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก…'; }
    const time = E.time ? (E.time.length === 5 ? E.time + ':00' : E.time) : '';
    let r = null;
    try {
      r = E.mode === 'edit'
        ? await gasApiCall('updatePrayerRecord', { data: { logId: E.id, prayerTime: E.slot, date: E.date, time: time, status: E.status, note: E.note } }, 20000)
        : await gasApiCall('addPrayerForStudent', { data: { studentId: E.studentId, studentName: E.studentName, grade: E.grade, prayerTime: E.slot, date: E.date, time: time, status: E.status, note: E.note } }, 20000);
    } catch (e) { r = { success: false, message: 'เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้ง' }; }
    if (btn) { btn.disabled = false; btn.textContent = E.mode === 'edit' ? 'บันทึกการแก้ไข' : 'เพิ่มบันทึก'; }
    if (!r || !r.success) { toast((r && (r.message || r.error)) || 'บันทึกไม่สำเร็จ', 'error'); return; }
    const today = new Date().toLocaleDateString('sv-SE');
    if (E.mode === 'edit') {
      const rec = r.record || {};
      patchLocal(E.id, (p) => Object.assign({}, p, { prayerName: E.slot, prayerTime: E.slot, date: E.date, time: rec.time || time || p.time, status: E.status, note: rec.note || E.note }));
    } else {
      const now = new Date();
      const rec = { id: r.logId, logId: r.logId, studentId: E.studentId, studentName: E.studentName, grade: E.grade, prayerName: E.slot, prayerTime: E.slot, date: E.date, time: time || now.toLocaleTimeString('th-TH'), timestamp: now.toISOString(), status: E.status, note: E.note, locationName: 'บันทึกโดยแอดมิน', isWithinZone: true };
      const h = readJ('khalifah_prayer_history'); h.unshift(rec); try { localStorage.setItem('khalifah_prayer_history', JSON.stringify(h)); } catch (e) {}
      if (E.date === today) { try { todayPrayers.unshift(rec); localStorage.setItem('khalifah_today_prayers', JSON.stringify(todayPrayers)); } catch (e) {} }
    }
    closeModal('k8PeModal'); toast(r.message || 'บันทึกแล้ว', 'success'); rerender();
  };
  window.k8PeDelete = async function () {
    if (!E || E.mode !== 'edit') return;
    if (!confirm('ลบบันทึกละหมาดรายการนี้ใช่หรือไม่? ลบแล้วกู้คืนไม่ได้')) return;
    let r = null; try { r = await gasApiCall('deletePrayerRecord', { data: { logId: E.id, studentId: E.studentId } }, 20000); } catch (e) { r = { success: false, message: 'เชื่อมต่อระบบไม่ได้' }; }
    if (!r || !r.success) { toast((r && (r.message || r.error)) || 'ลบไม่สำเร็จ', 'error'); return; }
    patchLocal(E.id, () => null); closeModal('k8PeModal'); toast('ลบรายการแล้ว', 'success'); rerender();
  };

  // ปุ่ม "แก้ไข" ในหน้ารายละเอียดการละหมาด (เฉพาะแอดมิน/อาจารย์)
  const od = window.openPrayerHistoryDetailModal;
  if (typeof od === 'function') window.openPrayerHistoryDetailModal = function (id) {
    window.k8PeLastDetailId = id; const r = od.apply(this, arguments);
    const b = document.getElementById('k8PeDetailEdit'); if (b) b.hidden = !isStaff();
    return r;
  };

  // ---------- รูปโปรไฟล์นักเรียนในหน้าแอดมิน ----------
  function avatarUrl(s) { try { return getDirectImageUrl((s && (s.avatarUrl || s.profilePhoto)) || ''); } catch (e) { return ''; } }
  function paintAvatars() {
    const all = (typeof allStudents !== 'undefined' ? allStudents : []);
    document.querySelectorAll('#k8AsRows .k8-as-name').forEach((btn) => {
      if (btn.querySelector('.k8-as-pic')) return;
      const idEl = btn.querySelector('span:not(.k8-as-pic)'); const id = idEl ? idEl.textContent.trim() : '';
      const s = all.find((x) => cid(x.studentId) === id); const u = avatarUrl(s);
      const pic = document.createElement('span'); pic.className = 'k8-as-pic' + (/^data:image\/(png|webp|gif)|#png$/i.test(u) ? ' is-png' : ''); pic.setAttribute('aria-hidden', 'true');
      if (u) pic.style.backgroundImage = 'url("' + u.replace(/"/g, '%22') + '")'; else pic.textContent = String((s && s.fullName) || '?').replace(/^(นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง)\s*/, '').charAt(0);
      btn.insertBefore(pic, btn.firstChild); btn.classList.add('has-pic');
    });
    const av = document.querySelector('#k8AsDetail .k8-as-av');
    if (av && !av.dataset.pic) {
      av.dataset.pic = '1';
      const name = (document.querySelector('#k8AsDetail .k8-as-dt b') || {}).textContent || '';
      const idTxt = ((document.querySelector('#k8AsDetail .k8-as-dt span') || {}).textContent || '').split('·')[0].trim();
      const s = all.find((x) => cid(x.studentId) === idTxt) || all.find((x) => x.fullName === name); const u = avatarUrl(s);
      if (u) {
        av.textContent = ''; av.classList.add('has-img'); if (/^data:image\/(png|webp|gif)|#png$/i.test(u)) av.classList.add('is-png');
        av.style.backgroundImage = 'url("' + u.replace(/"/g, '%22') + '")';
        av.setAttribute('role', 'button'); av.tabIndex = 0; av.title = 'แตะเพื่อดูรูปขยาย'; av.setAttribute('aria-label', 'ดูรูปโปรไฟล์ของ ' + name);
        const open = () => { try { openPhotoViewerModal(u, name); const h = document.getElementById('globalPhotoViewerTitle'); if (h) h.textContent = 'รูปโปรไฟล์'; } catch (e) {} };
        av.onclick = open; av.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); } };
      }
    }
  }
  const ors = window.renderAdminStudentsTable;
  if (typeof ors === 'function') window.renderAdminStudentsTable = function () { const r = ors.apply(this, arguments); try { paintAvatars(); } catch (e) {} return r; };
  const osel = window.k8AsSelect;
  if (typeof osel === 'function') window.k8AsSelect = function () { const r = osel.apply(this, arguments); try { paintAvatars(); } catch (e) {} return r; };
})();

/* ============ v11.9 · ปุ่มย้อนกลับ (Android): ต้องกด 2 ครั้งจึงออกจากแอป ============
   ลำดับ: ปิดหน้าต่างที่เปิดอยู่ → กลับหน้าแรกของบทบาท → แตะครั้งแรกขึ้นเตือน → แตะซ้ำภายใน 2 วินาทีจึงออก */
(function () {
  const GUARD = { k8guard: 1 };
  let lastBack = 0, leaving = false;
  const arm = () => { try { if (!(history.state && history.state.k8guard)) history.pushState(GUARD, ''); } catch (e) {} };
  const activeView = () => { const v = document.querySelector('.view-section.active'); return v ? v.id.replace(/^view-/, '') : ''; };
  const visible = (id) => { const el = document.getElementById(id); return !!(el && el.offsetParent !== null); };
  function closeTopModal() {
    const open = Array.from(document.querySelectorAll('.modal-overlay.open'));
    if (!open.length) return false;
    const top = open[open.length - 1];
    if (top.id === 'authModal' && document.body.classList.contains('auth-locked')) return false; // หน้าเข้าสู่ระบบ: ปล่อยให้ออกจากแอปได้
    try { closeModal(top.id); } catch (e) { top.classList.remove('open'); }
    return true;
  }
  function goHome() {
    let stu = false; try { stu = !!currentStudent; } catch (e) {}
    const v = activeView();
    if (stu) { if (v && v !== 'dashboard') { switchView('dashboard'); return true; } return false; }
    if (v === 'admin') {
      if (!visible('admin-tab-overview') && document.getElementById('btnAdminTabOverview') && document.getElementById('btnAdminTabOverview').offsetParent !== null) {
        try { switchAdminTab('overview', document.getElementById('btnAdminTabOverview')); window.scrollTo(0, 0); return true; } catch (e) {}
      }
      return false;
    }
    if (v === 'teacher' || v === 'inspector' || v === 'dashboard' || !v) return false;
    try { switchView(window.k8StaffHome || 'teacher'); return true; } catch (e) { return false; }
  }
  window.addEventListener('popstate', (e) => {
    if (leaving) return;
    const st = e.state || {};
    if (st.k8guard || st.k8docs || st.k8policy || st.k8pv || st.k8hq || st.k8tt || st.k8bh) return; // หน้าต่างพิเศษจัดการย้อนกลับเอง
    if (closeTopModal() || goHome()) { arm(); return; }
    const now = Date.now();
    if (now - lastBack < 2000) { leaving = true; try { history.back(); } catch (e2) {} return; }
    lastBack = now; arm();
    if (typeof showToast === 'function') showToast('กดย้อนกลับอีกครั้งเพื่อออกจากแอป', 'info');
  });
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) { if (v === 'admin' || v === 'teacher' || v === 'inspector') window.k8StaffHome = v; return sv.apply(this, arguments); };
  // ต้องมีการแตะหน้าจออย่างน้อย 1 ครั้งก่อน เบราว์เซอร์จึงจะนับรายการประวัติที่เพิ่มเข้ามา
  const first = () => { arm(); };
  if (document.readyState === 'complete') arm(); else window.addEventListener('load', arm);
  ['pointerdown', 'keydown'].forEach((t) => document.addEventListener(t, first, { once: true, capture: true }));
})();

/* ============ v12.0 · ตารางสอน (แอดมินจัด · อาจารย์/นักเรียนดู) ============ */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const js = (v) => String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const toast = (m, t) => { if (typeof showToast === 'function') showToast(m, t || 'info'); };
  const DAYN = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const GR = ['1', '2', '3', '4', '5', '6'];
  const CACHE = 'khalifah_timetable';
  const T = { data: null, loading: false, grade: '', day: null, view: 'day', who: 'mine', draft: null, dirty: false, teachers: null, cell: null };
  try { T.data = JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (e) {}
  const role = () => { try { if (currentStudent) return 'student'; } catch (e) {} try { if (currentAdmin) return 'staff'; } catch (e) {} return ''; };
  const me = () => { try { return currentAdmin || {}; } catch (e) { return {}; } };
  const toMin = (t) => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : NaN; };
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  // v17.78 · ตาราง TT2: จุดสีประจำวิชา (สีเดียวกันทุกหน้า) · ไฮไลต์วันนี้ + คาบที่กำลังเรียน
  const TT_PAL = ['#16a34a', '#2563eb', '#d97706', '#7c3aed', '#0d9488', '#e11d48', '#0284c7', '#c026d3', '#65a30d', '#4f46e5', '#ea580c', '#475569'];
  // v17.84 · สีประจำวิชา: ตามลำดับรายวิชาในระบบ (ไม่ซ้ำกันใน 14 วิชาแรก) · วิชาเดียวกันสีเดียวกันทุกวัน/ทุกหน้า
  const TT_PAL2 = ['#2563eb', '#16a34a', '#d97706', '#db2777', '#0d9488', '#dc2626', '#7c3aed', '#0891b2', '#65a30d', '#92400e', '#4338ca', '#475569', '#c026d3', '#0f766e'];
  const subjKey = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const subjColor = (n) => { const k = subjKey(n); let list = []; try { loadAppSubjects(); list = Array.isArray(appSubjects) ? appSubjects : []; } catch (e) {} const names = list.map((x) => subjKey(x && (x.name || x.subjectName))).filter(Boolean); let i = names.indexOf(k); if (i !== -1) return TT_PAL2[i % TT_PAL2.length];
    // วิชาที่พิมพ์เอง: ต่อท้ายตามลำดับชื่อวิชาในตาราง (เรียง ก–ฮ) เพื่อให้สีไม่ชนกัน
    const extra = new Set(); try { const gs = (T.data && T.data.grades) || {}; Object.keys(gs).forEach((g) => { Object.values(gs[g].cells || {}).forEach((c) => (Array.isArray(c) ? c : [c]).forEach((e) => { const kk = subjKey(e && e.sn); if (kk && names.indexOf(kk) === -1) extra.add(kk); })); }); } catch (e) {}
    i = Array.from(extra).sort((a, b) => a.localeCompare(b, 'th')).indexOf(k); if (i !== -1) return TT_PAL2[(names.length + i) % TT_PAL2.length]; return subjColorH(n); };
  const subjColorH = (n) => { const k = String(n || '').trim().toLowerCase().replace(/\s+/g, ' '); let h = 2166136261; for (let j = 0; j < k.length; j++) { h ^= k.charCodeAt(j); h = Math.imul(h, 16777619) >>> 0; } return TT_PAL[h % TT_PAL.length]; };
  const nowIdx = (c) => { const d = new Date().getDay(); if (!c || !(c.days || []).includes(d)) return -1; const n = nowMin(); return (c.periods || []).findIndex((p) => toMin(p.start) <= n && n < toMin(p.end)); };
  window.k8SubjColor = subjColor;
  const MAXP = 5; // วันละ 5 วิชา
  const cfg = () => { const c = (T.data && T.data.config) || { periods: [], days: [1, 2, 3, 4, 5], showStudents: true, showTeachers: true }; return (c.periods || []).length > MAXP ? Object.assign({}, c, { periods: c.periods.slice(0, MAXP) }) : c; };
  const extrasOf = () => (T.data && Array.isArray(T.data.extras)) ? T.data.extras : [];
  const xOf = (key) => extrasOf().find((x) => 'x:' + x.id === key) || (T.newX && T.newX.key === key ? T.newX : null);
  const gradeOf = (g) => { if (String(g).indexOf('x:') === 0) return xOf(g) || { cells: {} }; return (T.data && T.data.grades && T.data.grades[g]) || { cells: {} }; };
  const lbl = (g) => { if (String(g).indexOf('x:') === 0) { const x = xOf(g); return x ? x.name : 'ตารางพิเศษ'; } return 'ม.' + g; };
  const allKeys = () => GR.concat(extrasOf().map((x) => 'x:' + x.id));
  const subjects = () => { try { loadAppSubjects(); return Array.isArray(appSubjects) ? appSubjects : []; } catch (e) { return []; } };
  const arr = (x) => (Array.isArray(x) ? x : (x ? [x] : []));
  const nsid = (v) => String(v || '').replace(/\D/g, '').replace(/^0+/, '');
  // v17.84 · วิชาเฉพาะเพศ (gx) + ช่วงวันที่ (from–to) · หมดช่วงแล้วไม่ลบ ประวัติเช็คชื่อยังอยู่
  const p2 = (n) => String(n).padStart(2, '0');
  const ymdL = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const todayS = () => ymdL(new Date());
  const dateForDow = (dow) => { const t = new Date(); let diff = (dow - t.getDay() + 7) % 7; if (diff > 3) diff -= 7; t.setDate(t.getDate() + diff); return ymdL(t); };
  const actOn = (e, ds) => !!e && (!e.from || ds >= e.from) && (!e.to || ds <= e.to);
  const onDate = (raw, ds) => arr(raw).filter((e) => actOn(e, ds));
  // v17.94 · สลับคาบที่ตอบรับแล้ว (ชั่วคราวตามช่วงวันที่) → คาบ A ใช้วิชาของคาบ B และกลับกัน
  const swapsOf = () => (T.data && T.data.swaps) || [];
  function cellsOn(g, dow, p, ds) {
    const cells = gradeOf(g).cells || {};
    const base = onDate(cells[dow + '-' + p], ds);
    const gn = String(g).replace(/\D/g, ''); if (!gn || String(g).indexOf('x:') === 0) return base;
    const sw = swapsOf().find((x) => String(x.grade) === gn && Number(x.dow) === Number(dow) && ds >= x.from && ds <= x.to && (Number(x.pA) === Number(p) || Number(x.pB) === Number(p)));
    if (!sw) return base;
    const mineP = Number(sw.pA) === Number(p);
    const outT = mineP ? sw.tA : sw.tB, inT = mineP ? sw.tB : sw.tA, srcP = mineP ? sw.pB : sw.pA;
    const keep = base.filter((e) => String(e.t || '') !== String(outT));
    const moved = onDate(cells[dow + '-' + srcP], ds).filter((e) => String(e.t || '') === String(inT)).map((e) => Object.assign({}, e, { swapped: true, swapFrom: srcP }));
    return keep.concat(moved);
  }
  window.k8TtCellsOn = cellsOn;
  const MON_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const dTh = (s) => { const d = new Date(s + 'T00:00:00'); return isNaN(d) ? s : d.getDate() + ' ' + MON_S[d.getMonth()]; };
  const rangeTxt = (e) => !e || (!e.from && !e.to) ? '' : (e.from && e.to ? dTh(e.from) + '–' + dTh(e.to) : e.from ? 'ตั้งแต่ ' + dTh(e.from) : 'ถึง ' + dTh(e.to));
  const GXN = { m: 'ชาย', f: 'หญิง' };
  // v17.90 · อาจารย์ลาสอน (อนุมัติแล้ว) ที่กระทบนักเรียน · มาจากกระดิ่ง (getMyNotifications.classLeaves)
  const lvOf = (ds, p) => (window.k8ClassLeaves || []).find((l) => l.date === ds && Number(l.p) === Number(p));
  const lvTag = (ds, p) => { const l = lvOf(ds, p); return l ? '<em class="k8-tt-lv' + (l.subName ? ' is-sub' : '') + '">' + (l.subName ? 'สอนแทน · ' + esc(l.subName) : 'งดสอน · ' + esc(l.teacherName || 'อาจารย์') + ' ลา') + '</em>' : ''; };
  const bandHtml = (e, ds) => { const old = e.to && e.to < (ds || todayS()); const soon = e.from && e.from > (ds || todayS()); return '<span class="k8-tt-band' + (e.gx ? ' is-' + e.gx : (rangeTxt(e) ? ' is-r' : '')) + (old ? ' is-old' : '') + (soon ? ' is-soon' : '') + '" style="--sc:' + subjColor(e.sn) + '"><b>' + esc(e.sn) + '</b>' + (e.gx ? '<i class="k8-tt-tg is-' + e.gx + '">' + GXN[e.gx] + '</i>' : '') + (e.o && e.o.length ? '<i class="k8-tt-tg">' + e.o.length + ' คน</i>' : '') + (rangeTxt(e) ? '<i class="k8-tt-tg is-r">' + (old ? 'สิ้นสุดแล้ว · ' : '') + rangeTxt(e) + '</i>' : '') + '</span>'; };
  window.k8TtActOn = actOn;
  const isMine = (c) => { const u = me(); const un = String(u.username || '').toLowerCase(), fn = String(u.fullName || u.name || '').trim(); return !!c && ((un && String(c.t || '').toLowerCase() === un) || (fn && String(c.tn || '').trim() === fn)); };

  async function load(force) {
    if (T.loading) return; if (!force && T.data && Date.now() - (T.at || 0) < 60000) return;
    T.loading = true;
    let r = null; const w0 = T.w || 0;
    try { r = await gasApiCall('getTimetable', {}, 20000); } catch (e) { r = null; }
    if (r && r.success && (T.w || 0) !== w0) { T.loading = false; T.at = 0; return load(true); } // v17.46 · มีการบันทึก/ลบระหว่างโหลด → ข้อมูลที่ได้เก่าแล้ว โหลดใหม่
    if (r && r.success) { T.data = r; T.at = Date.now(); T.err = ''; try { localStorage.setItem(CACHE, JSON.stringify(r)); } catch (e) {} }
    else {
      // โหลดไม่ได้ (ระบบหลังบ้านยังไม่อัปเดต / เน็ตหลุด): ใช้ค่าเริ่มต้นให้ทำงานต่อได้ ไม่ค้างที่ "กำลังโหลด"
      T.err = (r && /Unknown action/i.test(String(r.error || r.message || ''))) ? 'old-backend' : 'offline';
      if (!T.data) T.data = { success: true, config: { periods: [{ start: '08:30', end: '09:30' }, { start: '09:40', end: '10:40' }, { start: '10:50', end: '11:50' }, { start: '13:00', end: '14:00' }, { start: '14:10', end: '15:10' }], days: [1, 2, 3, 4, 5], showStudents: true, showTeachers: true }, grades: {}, offline: true };
    }
    T.loading = false; paintEntry(); if (T.open) renderView();
    document.dispatchEvent(new CustomEvent('k8-tt-loaded'));
    if (document.getElementById('k8TtAdmin') && document.getElementById('k8TtAdmin').offsetParent !== null) renderAdmin();
  }

  // ---------- ปุ่มทางเข้า: บอกคาบถัดไปของวันนี้ ----------
  function todayList(grade, mineOnly, dow, ds) {
    const d = dow == null ? new Date().getDay() : dow; const c = cfg(); const out = []; ds = ds || (dow == null ? todayS() : dateForDow(d));
    if (c.days.indexOf(d) === -1) return out;
    const gs = mineOnly ? allKeys() : [grade].concat(extrasOf().map((x) => 'x:' + x.id));
    gs.forEach((g) => { const cells = gradeOf(g).cells || {}; c.periods.forEach((p, i) => { cellsOn(g, d, i + 1, ds).forEach((x) => { if (x && (!mineOnly || isMine(x))) out.push({ g, p: i + 1, start: p.start, end: p.end, c: x }); }); }); });
    return out.sort((a, b) => toMin(a.start) - toMin(b.start));
  }
  function paintEntry() {
    const r = role(); if (!r) return;
    const els = document.querySelectorAll('.k8-tt-next'); if (!els.length) return;
    let txt;
    if (T.data && T.data.hidden) txt = 'ยังไม่เปิดให้ดูตาราง';
    else {
      const list = r === 'student' ? todayList(T.data && T.data.grade, false) : todayList('', true);
      const n = nowMin(); const cur = list.find((x) => toMin(x.start) <= n && n < toMin(x.end)); const nx = list.find((x) => toMin(x.start) > n);
      if (!T.data) txt = r === 'student' ? 'ดูตารางเรียนรายวันและทั้งสัปดาห์' : 'ดูคาบสอนวันนี้และตารางของแต่ละชั้น';
      else if (cur) txt = 'ตอนนี้: ' + cur.c.sn + (r === 'student' ? (String(cur.g).indexOf('x:') === 0 ? ' · ' + lbl(cur.g) : '') : ' · ' + lbl(cur.g)) + ' (ถึง ' + cur.end + ')';
      else if (nx) txt = 'ถัดไป ' + nx.start + ' · ' + nx.c.sn + (r === 'student' ? (nx.c.r ? ' · ห้อง ' + nx.c.r : '') : ' · ' + lbl(nx.g));
      else if (list.length) txt = r === 'student' ? 'วันนี้เรียนครบทุกคาบแล้ว' : 'วันนี้สอนครบทุกคาบแล้ว';
      else txt = r === 'student' ? 'วันนี้ไม่มีคาบเรียน' : 'วันนี้ไม่มีคาบสอน';
    }
    els.forEach((e) => { e.textContent = txt; });
  }

  // ---------- หน้าดูตาราง (นักเรียน / อาจารย์) ----------
  // เปิดเป็นหน้าเต็ม (กดย้อนกลับเพื่อออก) · ค่าเริ่มต้นแสดงทั้งสัปดาห์
  window.k8TtOpen = function () {
    const el = document.getElementById('k8TtPage'); if (!el) return;
    const c = cfg(); const d = new Date().getDay();
    T.day = c.days.indexOf(d) !== -1 ? d : c.days[0]; T.view = 'week';
    if (role() === 'staff') { T.who = 'mine'; if (!T.grade) T.grade = '1'; }
    document.getElementById('k8TtTitle').textContent = role() === 'student' ? 'ตารางเรียน' : 'ตารางสอน';
    el.hidden = false; T.open = true; document.documentElement.classList.add('k8-docs-open');
    if (role() === 'student' && typeof gasApiCall === 'function') gasApiCall('getMyClassLeaves', {}).then((r) => { if (r && r.success) { window.k8ClassLeaves = r.data || []; try { localStorage.setItem('k8_class_leaves', JSON.stringify(window.k8ClassLeaves)); } catch (e) {} if (T.open) renderView(); } }).catch(() => {});
    try { history.pushState({ k8tt: 1 }, ''); } catch (e) {}
    const b = document.getElementById('k8TtBody'); if (b) b.scrollTop = 0;
    renderView(); load(true);
  };
  function closePage() { const el = document.getElementById('k8TtPage'); if (el) el.hidden = true; T.open = false; if (!document.querySelector('.k8-docs:not([hidden])')) document.documentElement.classList.remove('k8-docs-open'); }
  window.k8TtBack = function () { history.back(); };
  window.addEventListener('popstate', (e) => { if (T.open && !(e.state && e.state.k8tt)) closePage(); });
  function cellHtml(x, showGrade, g) {
    if (!x) return '<span class="k8-tt-free">ว่าง</span>';
    return '<b>' + esc(x.sn) + '</b><small>' + [showGrade ? lbl(g) : '', showGrade ? '' : x.tn, x.r ? 'ห้อง ' + x.r : '', x.gx ? 'เฉพาะนักเรียน' + GXN[x.gx] : (x.only && !x.multi ? 'เฉพาะบางคน' : ''), rangeTxt(x), x.swapped ? '⇄ สลับคาบ (ชั่วคราว)' : ''].filter(Boolean).map(esc).join(' · ') + '</small>';
  }
  try { window.k8ClassLeaves = window.k8ClassLeaves || JSON.parse(localStorage.getItem('k8_class_leaves') || '[]'); } catch (e) {}
  window.k8TtRerender = function () { try { if (T.open) renderView(); } catch (e) {} };
  function renderView() {
    const body = document.getElementById('k8TtBody'); if (!body) return;
    const r = role(); const c = cfg();
    const sub = document.getElementById('k8TtSub');
    if (!T.data) { body.innerHTML = '<p class="k8-li-empty">กำลังโหลดตาราง…</p>'; if (sub) sub.textContent = '-'; return; }
    if (T.data.offline && !Object.keys(T.data.grades || {}).length) { body.innerHTML = '<div class="k8-tt-empty"><b>ยังโหลดตารางไม่ได้</b><span>' + (T.err === 'old-backend' ? 'ระบบกำลังอัปเดต ลองใหม่ภายหลัง' : 'ตรวจสอบอินเทอร์เน็ต แล้วเปิดใหม่อีกครั้ง') + '</span></div>'; if (sub) sub.textContent = ''; return; }
    if (T.data.hidden) { body.innerHTML = '<div class="k8-tt-empty"><b>ยังไม่เปิดให้ดูตาราง</b><span>แอดมินกำลังจัดตาราง จะแจ้งให้ทราบเมื่อพร้อม</span></div>'; if (sub) sub.textContent = ''; return; }
    const staff = r !== 'student';
    const grade = staff ? T.grade : (T.vg || T.data.grade);
    const mine = staff && T.who === 'mine';
    if (sub) sub.textContent = mine ? 'เฉพาะคาบที่ฉันสอน · ทุกชั้นและตารางพิเศษ' : (grade ? lbl(grade) : 'ยังไม่ระบุชั้นเรียน');
    let h = '';
    if (staff) h += '<div class="k8-tt-seg" role="tablist"><button type="button" role="tab" aria-selected="' + mine + '" onclick="k8TtWho(\'mine\')">ของฉัน</button>' + allKeys().map((g) => '<button type="button" role="tab" aria-selected="' + (!mine && T.grade === g) + '" onclick="k8TtWho(\'' + g + '\')"' + (String(g).indexOf('x:') === 0 ? ' class="is-x"' : '') + '>' + esc(lbl(g)) + '</button>').join('') + '</div>';
    else if (extrasOf().length) h += '<div class="k8-tt-seg" role="tablist" aria-label="ตารางของฉัน">' + [T.data.grade].concat(extrasOf().map((x) => 'x:' + x.id)).map((g) => '<button type="button" role="tab" aria-selected="' + (grade === g) + '" onclick="k8TtVg(\'' + g + '\')"' + (String(g).indexOf('x:') === 0 ? ' class="is-x"' : '') + '>' + esc(String(g).indexOf('x:') === 0 ? lbl(g) : 'ตารางชั้น ' + lbl(g)) + '</button>').join('') + '</div>';
    h += '<div class="k8-tt-seg k8-tt-days" role="tablist">' + c.days.map((d) => '<button type="button" role="tab" aria-selected="' + (T.view === 'day' && T.day === d) + '" onclick="k8TtDay(' + d + ')">' + DAYS[d] + (d === new Date().getDay() ? '<i aria-hidden="true"></i>' : '') + '</button>').join('') + '<button type="button" role="tab" aria-selected="' + (T.view === 'week') + '" onclick="k8TtWeek()">ทั้งสัปดาห์</button></div>';
    const merge = (list) => { if (!list.length) return null; if (list.length === 1) return Object.assign({}, list[0], { only: list[0].only || (list[0].o && list[0].o.length) }); return { sn: list.map((e) => e.sn).join(' / '), tn: list.map((e) => (e.gx ? GXN[e.gx] + ' ' : '') + e.sn).join(' · '), r: '', only: true, multi: list }; };
    const cellOf = (d, i) => { const ds = dateForDow(d); if (!mine) return { x: merge(cellsOn(grade, d, i + 1, ds)), g: grade, ds }; for (const g of allKeys()) { const x = cellsOn(g, d, i + 1, ds).find(isMine); if (x) return { x: Object.assign({}, x, { only: x.o && x.o.length }), g, ds }; } return { x: null, g: '', ds }; };
    let me = null; try { me = currentAdmin; } catch (e) {}
    T.exp = { title: mine ? 'ตารางสอน ' + ((me && (me.fullName || me.username)) || '') : (String(grade).indexOf('x:') === 0 ? 'ตารางเรียน ' + lbl(grade) : 'ตารางเรียน ชั้น ' + lbl(grade)), cell: (d, i) => { const o = cellOf(d, i); return o.x ? { sn: o.x.sn, sub: [mine ? lbl(o.g) : (o.x.tn || ''), o.x.r ? 'ห้อง ' + o.x.r : ''].filter(Boolean).join(' · ') } : null; } };
    if (!mine && !grade) { body.innerHTML = h + '<p class="k8-li-empty">ไม่พบชั้นเรียนของคุณ · ติดต่อแอดมิน</p>'; return; }
    if (!mine && !Object.keys(gradeOf(grade).cells || {}).length) { body.innerHTML = h + '<div class="k8-tt-empty"><b>ยังไม่มีตาราง ' + esc(lbl(grade)) + '</b><span>แอดมินยังไม่ได้ลงตารางของชั้นนี้</span></div>'; return; }
    if (T.view === 'day') {
      const today = T.day === new Date().getDay(); const n = nowMin();
      const rows = c.periods.map((p, i) => { const o = cellOf(T.day, i); const live = !!o.x && today && toMin(p.start) <= n && n < toMin(p.end);
        const lv = o.x && !staff ? lvTag(o.ds, i + 1) : '';
        return '<li class="' + (o.x ? 'has ' : 'is-free ') + (live ? 'is-now' : '') + (lv ? ' is-leave' : '') + '"' + (o.x ? ' style="--sc:' + subjColor(o.x.sn) + '"' : '') + '><span class="k8-tt-time"><b>คาบ ' + (i + 1) + '</b><small>' + esc(p.start) + '–' + esc(p.end) + '</small></span><span class="k8-tt-cell">' + cellHtml(o.x, mine, o.g) + lv + (live ? '<em>' + (staff ? 'กำลังสอน' : 'กำลังเรียน') + '</em>' : '') + '</span></li>'; }).join('');
      const any = c.periods.some((p, i) => cellOf(T.day, i).x);
      h += '<h3 class="k8-tt-dh">วัน' + DAYN[T.day] + (today ? ' · วันนี้' : '') + '</h3>' + (any ? '<ol class="k8-tt-list">' + rows + '</ol>' : '<p class="k8-li-empty">' + (mine ? 'ไม่มีคาบสอนวันนี้' : 'ยังไม่มีคาบเรียนในวันนี้') + '</p>');
    } else {
      const ni = nowIdx(c), td0 = new Date().getDay();
      h += '<div class="k8-tt-gridwrap"><table class="k8-tt-grid is-tt2"><thead><tr><th scope="col">วัน</th>' + c.periods.map((p, i) => '<th scope="col"' + (i === ni ? ' class="is-now"' : '') + '>คาบ ' + (i + 1) + '<small>' + esc(p.start) + '–' + esc(p.end) + '</small>' + (i === ni ? '<em>ตอนนี้</em>' : '') + '</th>').join('') + '</tr></thead><tbody>' +
        c.days.map((d) => '<tr' + (d === td0 ? ' class="is-today"' : '') + '><th scope="row"><button type="button" class="k8-tt-dbtn" onclick="k8TtDay(' + d + ')" aria-label="ดูวัน' + DAYN[d] + 'แบบรายคาบ">' + DAYS[d] + (d === td0 ? '<small>วันนี้</small>' : '') + '</button></th>' + c.periods.map((p, i) => { const o = cellOf(d, i); const lv = o.x && !staff ? lvTag(o.ds, i + 1) : ''; return '<td class="' + (o.x ? 'has' : 'is-free') + (lv ? ' is-leave' : '') + (i === ni ? ' is-nowcol' : '') + (i === ni && d === td0 ? ' is-live' : '') + '"' + (o.x ? ' style="--sc:' + subjColor(o.x.sn) + '"' : '') + '>' + (o.x ? (o.x.multi ? '<div class="k8-tt-bands">' + o.x.multi.map((e) => bandHtml(e, o.ds)).join('') + '</div>' : '<b>' + esc(o.x.sn) + '</b><small>' + esc([mine ? lbl(o.g) : (o.x.tn || ''), o.x.r ? 'ห้อง ' + o.x.r : '', o.x.gx ? 'เฉพาะ' + GXN[o.x.gx] : '', rangeTxt(o.x), o.x.swapped ? '⇄ สลับคาบ' : ''].filter(Boolean).join(' · ')) + '</small>') + lv : '') + '</td>'; }).join('') + '</tr>').join('') + '</tbody></table></div><p class="k8-pw-hint">แตะชื่อวันเพื่อดูรายคาบของวันนั้น</p>';
    }
    if (T.view === 'week' && (mine || Object.keys(gradeOf(grade).cells || {}).length)) h += '<button type="button" class="k8-tt-img" onclick="k8TtImage(\'view\')">' + IMG_ICON + 'บันทึกเป็นรูปภาพ (A4 แนวนอน)</button>';
    body.innerHTML = h;
  }
  window.k8TtWho = function (w) { if (w === 'mine') T.who = 'mine'; else { T.who = 'grade'; T.grade = w; } renderView(); };
  // ---------- เทมเพลต Excel: ดาวน์โหลด → กรอก → นำเข้า (ม.1–ม.6) ----------
  // เขียน/อ่านไฟล์ .xlsx เอง เพื่อใส่ดรอปดาวน์ (Data Validation) รายชื่อวิชาและอาจารย์จากระบบ
  const DSHORT = { 'จ': 1, 'อ': 2, 'พ': 3, 'พฤ': 4, 'ศ': 5, 'ส': 6, 'อา': 0 };
  function dayOf(v) {
    const s = String(v || '').replace(/^วัน/, '').replace(/[.\s]/g, '').trim(); if (!s) return -1;
    for (let d = 0; d < 7; d++) { const n = DAYN[d].replace('บดี', ''); if (s.indexOf(n) === 0) return d; }
    return DSHORT[s] !== undefined ? DSHORT[s] : -1;
  }
  const XE = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const colName = (i) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }; })();
  function zipStore(files) { // files: [[name, string]] → Blob (ไม่บีบอัด)
    const enc = new TextEncoder(); const parts = []; const cen = []; let off = 0;
    files.forEach(([name, str]) => {
      const nb = enc.encode(name), data = enc.encode(str), crc = CRC(data);
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true);
      parts.push(h.buffer, nb, data);
      const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
      cen.push(c.buffer, nb); off += 30 + nb.length + data.length;
    });
    const csize = cen.reduce((a, b) => a + (b.byteLength || b.length), 0);
    const e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(cen, [e.buffer]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  // สไตล์: 0 ปกติ · 1 หัวเรื่อง · 2 หัวตาราง · 3 ช่องวัน · 4 ช่องคาบ/เวลา · 5 ช่องกรอก · 6 หมายเหตุ · 7 ช่องวัน (แถบสลับ) · 8 ช่องคาบ (แถบสลับ) · 9 ช่องกรอก (แถบสลับ)
  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="5"><font><sz val="12"/><name val="Tahoma"/></font><font><b/><sz val="16"/><color rgb="FF0C4A6E"/><name val="Tahoma"/></font><font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Tahoma"/></font><font><b/><sz val="12"/><color rgb="FF0F172A"/><name val="Tahoma"/></font><font><i/><sz val="11"/><color rgb="FF64748B"/><name val="Tahoma"/></font></fonts>' +
    '<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0369A1"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE0F2FE"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFBEB"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill></fills>' +
    '<borders count="2"><border/><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="center" wrapText="1"/><protection locked="0"/></xf>' +
    '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>' +
    '<xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="center" wrapText="1"/><protection locked="0"/></xf>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  function sheetXml(sh) {
    const rows = sh.rows.map((r, ri) => '<row r="' + (ri + 1) + '"' + (sh.heights && sh.heights[ri] ? ' ht="' + sh.heights[ri] + '" customHeight="1"' : '') + '>' + r.map((c, ci) => { if (c == null) return ''; const o = typeof c === 'object' ? c : { v: c }; const ref = colName(ci) + (ri + 1); return (o.v === '' || o.v == null) ? '<c r="' + ref + '"' + (o.s ? ' s="' + o.s + '"' : '') + '/>' : (typeof o.v === 'number' ? '<c r="' + ref + '"' + (o.s ? ' s="' + o.s + '"' : '') + '><v>' + o.v + '</v></c>' : '<c r="' + ref + '" t="inlineStr"' + (o.s ? ' s="' + o.s + '"' : '') + '><is><t xml:space="preserve">' + XE(o.v) + '</t></is></c>'); }).join('') + '</row>').join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"' + (sh.tab ? ' tabSelected="1"' : '') + '>' + (sh.freeze ? '<pane ySplit="' + sh.freeze + '" topLeftCell="A' + (sh.freeze + 1) + '" activePane="bottomLeft" state="frozen"/>' : '') + '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/>' +
      (sh.cols ? '<cols>' + sh.cols.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>' : '') +
      '<sheetData>' + rows + '</sheetData>' +
      (sh.merges && sh.merges.length ? '<mergeCells count="' + sh.merges.length + '">' + sh.merges.map((m) => '<mergeCell ref="' + m + '"/>').join('') + '</mergeCells>' : '') +
      (sh.dv && sh.dv.length ? '<dataValidations count="' + sh.dv.length + '">' + sh.dv.map((d) => '<dataValidation type="list" errorStyle="' + (d.strict ? 'stop' : 'warning') + '" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="' + XE(d.errT) + '" error="' + XE(d.err) + '" promptTitle="' + XE(d.pT) + '" prompt="' + XE(d.p) + '" sqref="' + d.ref + '"><formula1>' + XE(d.f) + '</formula1></dataValidation>').join('') + '</dataValidations>' : '') +
      '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
  }
  function buildXlsx(sheets) {
    const files = [];
    files.push(['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>']);
    files.push(['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>']);
    files.push(['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="' + Math.max(0, sheets.findIndex((s) => s.tab)) + '"/></bookViews><sheets>' + sheets.map((s, i) => '<sheet name="' + XE(s.name) + '" sheetId="' + (i + 1) + '"' + (s.hidden ? ' state="hidden"' : '') + ' r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>']);
    files.push(['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>']);
    files.push(['xl/styles.xml', STYLES]);
    sheets.forEach((s, i) => files.push(['xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(s)]));
    return zipStore(files);
  }
  // อ่าน .xlsx: แตก zip (DecompressionStream) แล้วอ่าน XML · ถ้าเบราว์เซอร์เก่าใช้ SheetJS แทน
  async function unzip(buf) {
    const dv = new DataView(buf); let e = buf.byteLength - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('not zip');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = {}; const dec = new TextDecoder();
    for (let i = 0; i < n; i++) {
      const m = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(buf, p + 46, nl)); p += 46 + nl + xl + cl;
      const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true); const raw = new Uint8Array(buf, ds, cs);
      out[name] = { m, raw };
    }
    return async (name) => { const f = out[name]; if (!f) return null; if (f.m === 0) return dec.decode(f.raw); const s = new Blob([f.raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return await new Response(s).text(); };
  }
  async function readXlsx(buf) {
    if (typeof DecompressionStream === 'undefined') { const X = await xlsxLib(); const wb = X.read(buf, { type: 'array' }); const o = {}; wb.SheetNames.forEach((nm) => { o[nm] = X.utils.sheet_to_json(wb.Sheets[nm], { header: 1, defval: '', raw: false }); }); return o; }
    const get = await unzip(buf); const P = new DOMParser(); const X = (s) => P.parseFromString(s || '<x/>', 'application/xml');
    const tag = (el, t) => Array.from(el.getElementsByTagNameNS('*', t));
    const sst = tag(X(await get('xl/sharedStrings.xml')), 'si').map((si) => tag(si, 't').map((t) => t.textContent).join(''));
    const rels = {}; tag(X(await get('xl/_rels/workbook.xml.rels')), 'Relationship').forEach((r) => { rels[r.getAttribute('Id')] = r.getAttribute('Target'); });
    const o = {};
    for (const s of tag(X(await get('xl/workbook.xml')), 'sheet')) {
      const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      let tgt = rels[rid] || ''; tgt = tgt.replace(/^\/?xl\//, '').replace(/^\//, '');
      const doc = X(await get('xl/' + tgt)); const grid = [];
      tag(doc, 'c').forEach((c) => {
        const ref = c.getAttribute('r') || ''; const mm = ref.match(/^([A-Z]+)(\d+)$/); if (!mm) return;
        let ci = 0; for (const ch of mm[1]) ci = ci * 26 + ch.charCodeAt(0) - 64; ci--; const ri = +mm[2] - 1;
        const t = c.getAttribute('t'); const v = tag(c, 'v')[0]; let val = '';
        if (t === 's') val = sst[+(v ? v.textContent : 0)] || ''; else if (t === 'inlineStr') val = tag(c, 't').map((x) => x.textContent).join(''); else val = v ? v.textContent : '';
        (grid[ri] = grid[ri] || [])[ci] = val;
      });
      for (let i = 0; i < grid.length; i++) { grid[i] = grid[i] || []; for (let j = 0; j < grid[i].length; j++) if (grid[i][j] == null) grid[i][j] = ''; }
      o[s.getAttribute('name')] = grid;
    }
    return o;
  }
  async function xlsxLib() {
    if (window.XLSX && window.XLSX.read) return window.XLSX;
    await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
    return window.XLSX;
  }
  // รายชื่ออาจารย์ในดรอปดาวน์: ชื่อจากระบบ (ชื่อซ้ำจะต่อท้ายด้วยชื่อผู้ใช้)
  function teacherOptions() {
    const tch = (T.teachers || []).filter((t) => t && t.u);
    const cnt = {}; tch.forEach((t) => { cnt[t.n] = (cnt[t.n] || 0) + 1; });
    return tch.map((t) => ({ u: t.u, n: t.n, label: cnt[t.n] > 1 ? t.n + ' (' + t.u + ')' : t.n })).sort((a, b) => a.label.localeCompare(b.label, 'th'));
  }
  window.k8TtXlTemplate = async function () {
    await loadTeachers();
    const c = cfg(); const subs = subjects().filter((s) => s && s.name); const tops = teacherOptions();
    if (!tops.length) toast('ยังไม่มีรายชื่ออาจารย์ในระบบ · ดรอปดาวน์อาจารย์จะว่าง', 'warning');
    const nS = Math.max(1, subs.length), nT = Math.max(1, tops.length);
    const sheets = [];
    const how = [[{ v: 'วิธีกรอกตารางเรียน KHALIFAH', s: 1 }], [''],
      [{ v: '1) แผ่นงาน ม.1 – ม.6 คือตารางของแต่ละชั้น · ห้ามเปลี่ยนชื่อแผ่นงาน', s: 0 }],
      [{ v: '2) แต่ละแถวคือ 1 คาบ · กรอกเฉพาะช่องสีเหลือง: วิชา · อาจารย์ผู้สอน · ห้อง', s: 0 }],
      [{ v: '3) ช่อง "วิชา" และ "อาจารย์ผู้สอน" เป็นดรอปดาวน์ คลิกที่ช่องแล้วกดลูกศร ▾ เพื่อเลือก (รายชื่อตามในระบบ)', s: 0 }],
      [{ v: '4) วิชาใหม่ที่ยังไม่มีในรายการ: พิมพ์ชื่อลงช่องได้เลย → ตอนนำเข้า ระบบจะถามว่าจะเพิ่มเป็นวิชาใหม่ในระบบ หรือใช้เป็นชื่อในตารางอย่างเดียว (เช่น โฮมรูม กิจกรรม)', s: 0 }],
      [{ v: '5) อาจารย์พิเศษ / อาจารย์ใหม่ที่ยังไม่มีบัญชี: พิมพ์ชื่อลงช่องได้ (เช่น อ.สมชาย วิทยากรภายนอก) → ชื่อจะแสดงในตารางของนักเรียน', s: 0 }],
      [{ v: '    ถ้าเป็นอาจารย์ประจำ ควรเพิ่มบัญชีในเมนู "บุคลากร" ก่อน แล้วดาวน์โหลดเทมเพลตใหม่ เพื่อให้คาบนี้ขึ้นในตารางสอนของอาจารย์', s: 6 }],
      [{ v: '6) คาบที่ไม่มีเรียน ปล่อยว่างไว้ · ห้องไม่บังคับ', s: 0 }],
      [{ v: '7) แผ่นงานของชั้นที่ไม่ต้องการแก้ ลบทิ้งได้ ระบบจะไม่แตะตารางของชั้นนั้น', s: 0 }],
      [{ v: '8) บันทึกเป็น .xlsx แล้วกด "นำเข้าไฟล์ Excel" ในหน้าตารางเรียนของแอดมิน', s: 0 }],
      [''], [{ v: 'เวลาคาบ (เหมือนกันทุกชั้น)', s: 3 }]].concat(c.periods.map((p, i) => [{ v: 'คาบ ' + (i + 1) + '   ' + p.start + ' – ' + p.end, s: 4 }]));
    sheets.push({ name: 'วิธีกรอก', rows: how, cols: [96], tab: true });
    ['1', '2', '3', '4', '5', '6'].forEach((g) => {
      const cells = (T.grade === g && T.draft) ? T.draft : (gradeOf(g).cells || {});
      const rows = [[{ v: 'ตารางเรียน ชั้น ม.' + g, s: 1 }, '', '', '', '', ''], [{ v: 'กรอกช่องสีเหลือง · วิชาและอาจารย์เลือกจากดรอปดาวน์ ▾', s: 6 }, '', '', '', '', ''],
        [{ v: 'วัน', s: 2 }, { v: 'คาบ', s: 2 }, { v: 'เวลา', s: 2 }, { v: 'วิชา', s: 2 }, { v: 'อาจารย์ผู้สอน', s: 2 }, { v: 'ห้อง', s: 2 }]];
      const merges = ['A1:F1', 'A2:F2']; const heights = [28, 20, 26];
      c.days.forEach((d, di) => {
        const alt = di % 2 === 1;
        c.periods.forEach((p, i) => {
          const x = arr(cells[d + '-' + (i + 1)])[0];
          const to = x && x.t ? tops.find((t) => t.u === x.t) : null;
          rows.push([{ v: DAYN[d], s: alt ? 7 : 3 }, { v: i + 1, s: alt ? 8 : 4 }, { v: p.start + '–' + p.end, s: alt ? 8 : 4 }, { v: x ? x.sn : '', s: alt ? 9 : 5 }, { v: to ? to.label : (x && x.tn ? x.tn : ''), s: alt ? 9 : 5 }, { v: x && x.r ? x.r : '', s: alt ? 9 : 5 }]);
          heights.push(24);
        });
      });
      const last = rows.length;
      sheets.push({ name: 'ม.' + g, rows, cols: [14, 7, 14, 34, 30, 14], freeze: 3, merges, heights, dv: [
        { ref: 'D4:D' + last, f: "'รายชื่อ'!$A$2:$A$" + (nS + 1), strict: false, pT: 'วิชา', p: 'เลือกจากรายการ ▾', errT: 'ไม่มีวิชานี้ในระบบ', err: 'ถ้าเป็นวิชาใหม่หรือกิจกรรม (เช่น โฮมรูม) กด ใช่ เพื่อใช้ชื่อนี้ · ตอนนำเข้าระบบจะถามว่าจะเพิ่มเป็นวิชาใหม่หรือไม่' },
        { ref: 'E4:E' + last, f: "'รายชื่อ'!$B$2:$B$" + (nT + 1), strict: false, pT: 'อาจารย์ผู้สอน', p: 'เลือกจากรายชื่อในระบบ ▾ · อาจารย์พิเศษ/อาจารย์ใหม่ พิมพ์ชื่อเองได้', errT: 'ไม่มีชื่อนี้ในระบบ', err: 'ถ้าเป็นอาจารย์พิเศษหรืออาจารย์ใหม่ที่ยังไม่มีบัญชี กด ใช่ เพื่อใช้ชื่อนี้ · ถ้าพิมพ์ผิด กด ไม่ใช่ แล้วเลือกจากดรอปดาวน์' }] });
    });
    const ref = [[{ v: 'วิชา', s: 2 }, { v: 'อาจารย์ผู้สอน', s: 2 }]];
    for (let i = 0; i < Math.max(nS, nT); i++) ref.push([subs[i] ? subs[i].name : '', tops[i] ? tops[i].label : '']);
    sheets.push({ name: 'รายชื่อ', rows: ref, cols: [36, 34], hidden: true });
    const blob = buildXlsx(sheets);
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'เทมเพลตตารางเรียน_ม1-ม6.xlsx'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast('ดาวน์โหลดเทมเพลตแล้ว · มีตารางเดิมใส่ไว้ให้แก้ต่อได้', 'success');
  };
  let XL = null;
  window.k8TtXlImport = async function (input) {
    const file = input.files && input.files[0]; input.value = ''; if (!file) return;
    await loadTeachers();
    let book; try { book = await readXlsx(await file.arrayBuffer()); } catch (e) { toast('อ่านไฟล์ไม่ได้ · ใช้ไฟล์ .xlsx จากปุ่ม "ดาวน์โหลดเทมเพลต"', 'error'); return; }
    const c = cfg(); const subs = subjects().filter((s) => s && s.name); const tops = teacherOptions();
    const norm = (v) => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const findSub = (n) => subs.find((s) => norm(s.name) === norm(n)) || subs.find((s) => s.id && norm(s.id) === norm(n));
    const strip = (v) => norm(v).replace(/^(อ\.|อาจารย์|ครู)\s*/, '');
    const findT = (n) => tops.find((t) => norm(t.label) === norm(n)) || tops.find((t) => norm(t.n) === norm(n) || norm(t.u) === norm(n)) || tops.find((t) => strip(t.n) === strip(n));
    const res = {}; const warn = []; const newS = {}; const newT = {}; const skipped = [];
    Object.keys(book).forEach((name) => {
      const m = String(name).match(/^\s*(?:ม\.?|มัธยม(?:ศึกษาปีที่)?|M)\s*([1-6])\s*$/i); if (!m) return;
      const g = m[1]; const rows = book[name];
      let hr = -1, col = {};
      for (let r = 0; r < Math.min(rows.length, 12) && hr === -1; r++) {
        const h = (rows[r] || []).map((v) => String(v).trim());
        if (h.some((v) => /^วัน$/.test(v)) && h.some((v) => /^วิชา/.test(v))) { hr = r; h.forEach((v, i) => { if (/^วัน$/.test(v)) col.d = i; else if (/^คาบ/.test(v)) col.p = i; else if (/^วิชา/.test(v)) col.s = i; else if (/อาจารย์|ครู|ผู้สอน/.test(v)) col.t = i; else if (/^ห้อง/.test(v)) col.r = i; }); }
      }
      if (hr === -1 || col.p === undefined) { warn.push('ม.' + g + ': ไม่พบหัวตาราง (วัน · คาบ · วิชา · อาจารย์ผู้สอน · ห้อง) · ข้ามแผ่นนี้'); return; }
      const old = gradeOf(g).cells || {}; const cells = {}; let n = 0;
      for (let r = hr + 1; r < rows.length; r++) {
        const row = rows[r] || []; const sn0 = String(row[col.s] || '').trim(); if (!sn0) continue;
        const d = dayOf(row[col.d]); const p = parseInt(String(row[col.p] || '').replace(/\D/g, ''), 10);
        const at = 'ม.' + g + (d >= 0 ? ' วัน' + DAYN[d] : '') + (p ? ' คาบ ' + p : '');
        if (d === -1 || !p) { warn.push(at + ': อ่านวันหรือคาบไม่ได้ · ข้ามแถว ' + (r + 1)); continue; }
        if (c.days.indexOf(d) === -1) { warn.push(at + ': วันนี้ไม่ได้เปิดเป็นวันเรียน · ข้าม'); continue; }
        if (p > c.periods.length) { warn.push(at + ': เกินจำนวนคาบที่ตั้งไว้ (' + c.periods.length + ' คาบ) · ข้าม'); continue; }
        const so = findSub(sn0); const sn = so ? so.name : sn0;
        const tName = col.t !== undefined ? String(row[col.t] || '').trim() : ''; const to = tName ? findT(tName) : null;
        if (!so) (newS[sn] = newS[sn] || []).push(at);
        if (tName && !to) (newT[tName] = newT[tName] || []).push(at);
        const e = { s: so ? so.id : '', sn, t: to ? to.u : '', tn: to ? to.n : tName, r: col.r !== undefined ? String(row[col.r] || '').trim() : '' };
        const prev = arr(old[d + '-' + p])[0]; // เก็บกลุ่ม/ละเว้นเดิมไว้ ถ้าเป็นวิชาเดิม
        if (prev && prev.sn === e.sn) { if (prev.o && prev.o.length) e.o = prev.o; if (prev.x && prev.x.length) e.x = prev.x; }
        if (cells[d + '-' + p]) warn.push(at + ': มีซ้ำในไฟล์ · ใช้แถวล่าสุด');
        cells[d + '-' + p] = e.o ? [e] : e; n++;
      }
      if (n) res[g] = { cells, n }; else skipped.push('ม.' + g);
    });
    const gs = Object.keys(res).sort();
    if (!gs.length && skipped.length) { toast('ไฟล์ยังไม่ได้กรอกวิชาเลย · กรอกช่องสีเหลืองแล้วนำเข้าอีกครั้ง', 'warning'); return; }
    if (!gs.length) { toast('ไม่พบแผ่นงาน ม.1–ม.6 ในไฟล์ · ใช้ไฟล์จากปุ่ม "ดาวน์โหลดเทมเพลต"', 'error'); return; }
    XL = res; XLNEW = Object.keys(newS);
    const loc = (L) => esc(L.slice(0, 3).join(' · ') + (L.length > 3 ? ' และอีก ' + (L.length - 3) + ' คาบ' : ''));
    const newHtml = (XLNEW.length ? '<section class="k8-tt-xl-new"><h3>วิชาใหม่ที่ยังไม่มีในระบบ (' + XLNEW.length + ')</h3><p>ติ๊ก = เพิ่มเป็นวิชาใหม่ในระบบ (ใช้กรอกเกรด/เช็คชื่อได้) · ไม่ติ๊ก = ใช้เป็นชื่อในตารางอย่างเดียว เช่น โฮมรูม กิจกรรม</p>' +
      XLNEW.map((n, i) => '<label class="k8-tt-xl-chk"><input type="checkbox" data-i="' + i + '"' + (/โฮมรูม|กิจกรรม|พัก|ประชุม|ชุมนุม|แนะแนว|homeroom/i.test(n) ? '' : ' checked') + '><span><b>' + esc(n) + '</b><small>' + loc(newS[n]) + '</small></span></label>').join('') + '</section>' : '') +
      (Object.keys(newT).length ? '<section class="k8-tt-xl-new is-t"><h3>อาจารย์ที่ยังไม่มีในระบบ (' + Object.keys(newT).length + ')</h3><p>จะบันทึกเป็น <b>อาจารย์พิเศษ</b> · นักเรียนเห็นชื่อในตาราง แต่ไม่ขึ้นในตารางสอนของใคร · ถ้าเป็นอาจารย์ประจำ ให้เพิ่มบัญชีในเมนู "บุคลากร" ก่อน แล้วนำเข้าอีกครั้ง</p><ul>' +
      Object.keys(newT).map((n) => '<li><b>' + esc(n) + '</b><small>' + loc(newT[n]) + '</small></li>').join('') + '</ul></section>' : '');
    document.getElementById('k8TtCellTitle').textContent = 'ตรวจก่อนนำเข้า';
    document.getElementById('k8TtCellSub').textContent = file.name;
    document.getElementById('k8TtCellBody').innerHTML =
      '<ul class="k8-tt-xl-sum">' + gs.map((g) => '<li><b>ม.' + g + '</b><span>' + (res[g].n + ' คาบ') + '</span><small>เดิม ' + Object.keys(gradeOf(g).cells || {}).length + ' คาบ</small></li>').join('') + '</ul>' +
      (warn.length ? '<details class="k8-tt-xl-warn"' + (warn.length <= 6 ? ' open' : '') + '><summary>ข้อควรตรวจ ' + warn.length + ' รายการ</summary><ul>' + warn.slice(0, 80).map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul></details>' : (newHtml ? '' : '<p class="k8-tt-xl-ok">✓ จับคู่วิชาและอาจารย์กับในระบบได้ครบทุกช่อง</p>')) + newHtml +
      '<p class="k8-pw-hint">กดบันทึกแล้ว ตารางของชั้นข้างบนจะถูกแทนที่ด้วยข้อมูลจากไฟล์' + (skipped.length ? ' · ' + skipped.join(' ') + ' ว่างในไฟล์ จะไม่แตะตารางเดิม' : '') + '</p>' +
      '<div class="k8-dr-btns"><button type="button" class="is-alt" onclick="closeModal(\'k8TtCellModal\')">ยกเลิก</button><button type="button" id="k8TtXlGo" onclick="k8TtXlSave()">บันทึก ' + gs.length + ' ชั้น</button></div>';
    openModal('k8TtCellModal');
  };
  let XLNEW = [];
  window.k8TtXlSave = async function () {
    if (!XL) return; const b = document.getElementById('k8TtXlGo');
    // วิชาใหม่ที่ติ๊กไว้ → เพิ่มเข้ารายวิชาของระบบ แล้วผูกรหัสวิชาให้คาบนั้น
    const add = Array.from(document.querySelectorAll('.k8-tt-xl-chk input:checked')).map((c) => XLNEW[+c.dataset.i]).filter(Boolean);
    if (add.length) {
      try {
        loadAppSubjects(); const map = {};
        add.forEach((n, i) => { const ex = appSubjects.find((x) => String(x.name).trim() === n); if (ex) { map[n] = ex.id; return; } const id = 'subj_' + Date.now() + '_' + i; appSubjects.push({ id, code: '', name: n }); map[n] = id; });
        localStorage.setItem('khalifah_subjects', JSON.stringify(appSubjects));
        const r = await gasApiCall('saveSubjects', { data: { subjects: appSubjects } }, 25000);
        if (!r || !r.success) throw new Error((r && r.message) || '');
        Object.keys(XL).forEach((g) => Object.keys(XL[g].cells).forEach((k) => { arr(XL[g].cells[k]).forEach((e) => { if (!e.s && map[e.sn]) e.s = map[e.sn]; }); }));
        try { renderAdminSubjectsTable(); populateGradingSubjectSelect(); } catch (e) {}
      } catch (e) { toast('เพิ่มวิชาใหม่ไม่สำเร็จ · ตารางจะใช้ชื่อวิชาที่พิมพ์ไว้', 'warning'); }
    }
    T.w = (T.w || 0) + 1;
    const gs = Object.keys(XL).sort(); const fail = [];
    for (let i = 0; i < gs.length; i++) {
      const g = gs[i]; if (b) { b.disabled = true; b.textContent = 'กำลังบันทึก ม.' + g + ' (' + (i + 1) + '/' + gs.length + ')…'; }
      let r = null; try { r = await gasApiCall('saveTimetable', { data: { grade: g, cells: XL[g].cells } }, 30000); } catch (e) { r = null; }
      if (r && r.success) { T.data.grades = T.data.grades || {}; T.data.grades[g] = r.timetable; } else fail.push('ม.' + g + ((r && r.message) ? ' (' + r.message + ')' : ''));
    }
    try { localStorage.setItem(CACHE, JSON.stringify(T.data)); } catch (e) {}
    XL = null; closeModal('k8TtCellModal'); T.dirty = false; startDraft(String(T.grade).indexOf('x:') === 0 ? '1' : (T.grade || '1')); renderAdmin();
    if (fail.length) toast('บันทึกไม่สำเร็จ: ' + fail.join(', '), 'error'); else toast('นำเข้าตารางเรียนเรียบร้อย ' + gs.length + ' ชั้น' + (add.length ? ' · เพิ่มวิชาใหม่ ' + add.length + ' วิชา' : ''), 'success');
  };
  // ---------- บันทึกตารางเป็นรูปภาพ A4 แนวนอน ----------
  const IMG_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>';
  function wrapLines(ctx, text, maxW, maxLines) {
    const segs = (typeof Intl !== 'undefined' && Intl.Segmenter) ? Array.from(new Intl.Segmenter('th', { granularity: 'word' }).segment(text), (s) => s.segment) : String(text).split(/(\s+)/);
    const lines = []; let cur = '';
    segs.forEach((w) => {
      const t = cur + w;
      if (ctx.measureText(t).width <= maxW || !cur) { cur = t; return; }
      lines.push(cur.trim()); cur = w.trimStart();
    });
    if (cur.trim()) lines.push(cur.trim());
    const out = lines.slice(0, maxLines);
    if (lines.length > maxLines) { let l = out[maxLines - 1]; while (l && ctx.measureText(l + '…').width > maxW) l = l.slice(0, -1); out[maxLines - 1] = l + '…'; }
    return out.map((l) => { while (ctx.measureText(l).width > maxW && l.length > 1) l = l.slice(0, -2) + '…'; return l; });
  }
  window.k8TtImage = async function (src) {
    const c = cfg(); let model;
    if (src === 'admin') {
      const isX = String(T.grade).indexOf('x:') === 0;
      model = { title: isX ? 'ตารางเรียน ' + ((T.xmeta && T.xmeta.name) || lbl(T.grade)) : 'ตารางเรียน ชั้น ' + lbl(T.grade), cell: (d, i) => { const L = arr(T.draft[d + '-' + (i + 1)]); if (!L.length) return null; if (L.length === 1) return { sn: L[0].sn, sub: [L[0].tn, L[0].r ? 'ห้อง ' + L[0].r : ''].filter(Boolean).join(' · ') }; return { sn: L.map((e) => e.sn).join(' / '), sub: L.length + ' กลุ่ม' }; } };
    } else model = T.exp;
    if (!model) return;
    toast('กำลังสร้างรูปภาพ…', 'info');
    const FONT = '"IBM Plex Sans Thai", sans-serif';
    try { await Promise.all(['400', '600', '700'].map((w) => document.fonts.load(w + ' 40px "IBM Plex Sans Thai"', 'กขค'))); } catch (e) {}
    const W = 3508, H = 2480, M = 140;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    // หัวกระดาษ
    ctx.fillStyle = '#0369a1'; ctx.fillRect(0, 0, W, 26);
    ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#0369a1'; ctx.font = '600 44px ' + FONT; ctx.fillText('KHALIFAH', M, M + 30);
    ctx.fillStyle = '#0f172a'; ctx.font = '700 104px ' + FONT; ctx.fillText(model.title, M, M + 150);
    const now = new Date(); const MONS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    ctx.textAlign = 'right'; ctx.fillStyle = '#475569'; ctx.font = '400 42px ' + FONT;
    ctx.fillText('ข้อมูล ณ ' + now.getDate() + ' ' + MONS[now.getMonth()] + ' ' + (now.getFullYear() + 543), W - M, M + 150);
    ctx.textAlign = 'left';
    // ตาราง
    const top = M + 230, bottom = H - M - 40, left = M, right = W - M;
    const dayW = 250, hdrH = 150; const nP = c.periods.length, nD = c.days.length;
    const colW = (right - left - dayW) / Math.max(1, nP); const rowH = (bottom - top - hdrH) / Math.max(1, nD);
    const rr = (x, y, w, h, r, fill, stroke) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); } };
    rr(left, top, right - left, bottom - top, 28, '#ffffff', '#cbd5e1');
    ctx.save(); ctx.beginPath(); ctx.rect(left, top, right - left, hdrH); ctx.clip(); rr(left, top, right - left, hdrH + 40, 28, '#0369a1'); ctx.restore();
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
    ctx.font = '600 46px ' + FONT; ctx.fillText('วัน / คาบ', left + dayW / 2, top + hdrH / 2 + 16);
    c.periods.forEach((p, i) => { const cx = left + dayW + colW * i + colW / 2; ctx.font = '600 50px ' + FONT; ctx.fillText('คาบ ' + (i + 1), cx, top + 68); ctx.font = '400 36px ' + FONT; ctx.fillText(p.start + '–' + p.end, cx, top + 120); });
    const DAYC = { 1: '#fef9c3', 2: '#fce7f3', 3: '#dcfce7', 4: '#ffedd5', 5: '#e0f2fe', 6: '#ede9fe', 0: '#fee2e2' };
    c.days.forEach((d, r) => {
      const y = top + hdrH + rowH * r;
      if (r % 2 === 1) { ctx.fillStyle = '#f8fafc'; ctx.fillRect(left + dayW, y, right - left - dayW, rowH); }
      ctx.save(); if (r === nD - 1) { ctx.beginPath(); ctx.rect(left, y, dayW, rowH); ctx.clip(); rr(left, y - 40, dayW + 40, rowH + 40, 28, DAYC[d]); } else { ctx.fillStyle = DAYC[d]; ctx.fillRect(left, y, dayW, rowH); } ctx.restore();
      ctx.fillStyle = '#0f172a'; ctx.font = '700 56px ' + FONT; ctx.fillText(DAYN[d], left + dayW / 2, y + rowH / 2 + 20);
      c.periods.forEach((p, i) => {
        const x = left + dayW + colW * i; const e = model.cell(d, i); if (!e) return;
        const pad = 22, mw = colW - pad * 2;
        let fs = Math.min(52, rowH * 0.2); ctx.font = '600 ' + fs + 'px ' + FONT;
        let L1 = wrapLines(ctx, e.sn, mw, 3);
        ctx.font = '400 ' + Math.round(fs * 0.7) + 'px ' + FONT; const L2 = e.sub ? wrapLines(ctx, e.sub, mw, 2) : [];
        const lh1 = fs * 1.3, lh2 = fs * 0.7 * 1.35; const tot = L1.length * lh1 + L2.length * lh2;
        let ty = y + rowH / 2 - tot / 2 + fs;
        ctx.fillStyle = '#0f172a'; ctx.font = '600 ' + fs + 'px ' + FONT; L1.forEach((l) => { ctx.fillText(l, x + colW / 2, ty); ty += lh1; });
        ty += lh2 - lh1 + 4; ctx.fillStyle = '#475569'; ctx.font = '400 ' + Math.round(fs * 0.7) + 'px ' + FONT; L2.forEach((l) => { ctx.fillText(l, x + colW / 2, ty); ty += lh2; });
      });
    });
    // เส้นตาราง
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 3;
    for (let i = 1; i <= nP; i++) { const x = left + dayW + colW * (i - 1); ctx.beginPath(); ctx.moveTo(x, top + hdrH); ctx.lineTo(x, bottom); ctx.stroke(); }
    for (let r = 1; r < nD; r++) { const y = top + hdrH + rowH * r; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); }
    rr(left, top, right - left, bottom - top, 28, null, '#94a3b8');
    ctx.textAlign = 'left'; ctx.fillStyle = '#94a3b8'; ctx.font = '400 32px ' + FONT; ctx.fillText('khalifah-program.vercel.app', M, H - M + 30);
    const name = (model.title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_') || 'timetable') + '.png';
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    if (!blob) { toast('สร้างรูปไม่สำเร็จ', 'error'); return; }
    const file = (typeof File === 'function') ? new File([blob], name, { type: 'image/png' }) : null;
    const touch = matchMedia('(pointer: coarse)').matches;
    if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: model.title }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast('บันทึกรูปตารางแล้ว (A4 แนวนอน)', 'success');
  };
  window.k8TtVg = function (g) { T.vg = g; renderView(); };
  window.k8TtDay = function (d) { T.view = 'day'; T.day = d; renderView(); };
  window.k8TtWeek = function () { T.view = 'week'; renderView(); };

  // ---------- แอดมิน: จัดตาราง ----------
  function adminRoot() { return document.getElementById('k8TtAdmin'); }
  function startDraft(g) { T.grade = g; const src = gradeOf(g); T.draft = JSON.parse(JSON.stringify((src.cells) || {})); T.dirty = false; T.xmeta = String(g).indexOf('x:') === 0 ? { id: src.id || '', name: src.name || '', students: (src.students || []).slice() } : null; }
  // v17.47 · รายชื่ออาจารย์: ใช้ข้อมูลในเครื่องทันที แล้วดึงจากระบบเบื้องหลัง (ไม่ต้องรอตอนกดช่องตาราง)
  function localTeachers() { try { return (subAdmins || []).filter((t) => t && t.username).map((t) => ({ u: t.username, n: t.fullName || t.username })); } catch (e) { return []; } }
  let tFetch = null;
  function loadTeachers() {
    if (!T.teachers || !T.teachers.length) T.teachers = localTeachers();
    if (!tFetch) tFetch = gasApiCall('getTeachers', {}, 20000).then((r) => { if (r && r.success) { const l = (r.data || []).filter((t) => t && t.username).map((t) => ({ u: t.username, n: t.fullName || t.username })); if (l.length) T.teachers = l; const m = document.getElementById('k8TtCellModal'); if (m && m.classList.contains('open')) { try { pullG(); renderG(); } catch (e) {} } } }).catch(() => { tFetch = null; });
    return T.teachers && T.teachers.length ? Promise.resolve() : tFetch;
  }
  function renderAdmin() {
    const el = adminRoot(); if (!el) return;
    loadTeachers();
    if (!T.data) { el.innerHTML = '<p class="k8-li-empty">กำลังโหลดตาราง…</p>'; return; }
    const c = cfg(); if (!T.grade || !T.draft) startDraft(T.grade || '1');
    const filled = Object.keys(T.draft).length;
    const warn = T.err === 'old-backend' ? '<div class="k8-tt-warn" role="alert"><b>ระบบหลังบ้านยังไม่รองรับตารางสอน</b><span>กรุณา Deploy ไฟล์ Code.gs ตัวล่าสุด (Manage deployments → New version) แล้วกด <button type="button" class="k8-bh-link" onclick="k8TtReload()">โหลดใหม่</button> · ระหว่างนี้จัดตารางได้ แต่ยังบันทึกไม่ได้</span></div>'
      : T.err === 'offline' ? '<div class="k8-tt-warn" role="alert"><b>เชื่อมต่อระบบไม่ได้</b><span>ตรวจสอบอินเทอร์เน็ต แล้วกด <button type="button" class="k8-bh-link" onclick="k8TtReload()">โหลดใหม่</button></span></div>' : '';
    const cnt = (g) => Object.keys(gradeOf(g).cells || {}).length;
    const isX = String(T.grade).indexOf('x:') === 0; const xm = isX ? (T.xmeta || {}) : {};
    el.innerHTML = warn +
      '<section class="k8-bh-card k8-tt-vis"><h2 class="k8-bh-h">การมองเห็น</h2>' +
      '<label class="k8-tt-sw"><input type="checkbox" ' + (c.showStudents ? 'checked' : '') + ' onchange="k8TtVis(\'showStudents\',this.checked)"><span><b>นักเรียนเห็นตารางเรียน</b><small>นักเรียนเห็นเฉพาะชั้นของตัวเอง</small></span></label>' +
      '<label class="k8-tt-sw"><input type="checkbox" ' + (c.showTeachers ? 'checked' : '') + ' onchange="k8TtVis(\'showTeachers\',this.checked)"><span><b>อาจารย์เห็นตารางสอน</b><small>อาจารย์เห็นคาบที่ตัวเองสอน และตารางทุกชั้น</small></span></label>' +
      '<div class="k8-tt-cfgrow"><span>วันเรียน</span><div class="k8-tt-seg">' + [1, 2, 3, 4, 5, 6, 0].map((d) => '<button type="button" aria-pressed="' + (c.days.indexOf(d) !== -1) + '" onclick="k8TtToggleDay(' + d + ')">' + DAYS[d] + '</button>').join('') + '</div></div>' +
      '<button type="button" class="k8-bh-link" onclick="k8TtPeriods()">ตั้งเวลาคาบเรียน (' + c.periods.length + ' คาบ · ' + esc(c.periods[0] ? c.periods[0].start : '') + '–' + esc(c.periods.length ? c.periods[c.periods.length - 1].end : '') + ')</button></section>' +
      '<section class="k8-bh-card k8-tt-xl"><h2 class="k8-bh-h">นำเข้าตารางจากไฟล์ Excel</h2><ol class="k8-tt-xl-steps"><li>ดาวน์โหลดเทมเพลต (มีครบ ม.1–ม.6 แยกแผ่นละชั้น)</li><li>กรอกในช่อง: <b>ชื่อวิชา / อาจารย์ / ห้อง</b></li><li>นำเข้าไฟล์ ตรวจดู แล้วกดบันทึก ระบบจะลงตารางให้ทุกชั้น</li></ol><div class="k8-tt-xl-btns"><button type="button" class="k8-tt-xl-dl" onclick="k8TtXlTemplate()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>ดาวน์โหลดเทมเพลต</button><label class="k8-tt-xl-up"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21V9M7 14l5-5 5 5M5 3h14"/></svg>นำเข้าไฟล์ Excel<input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onchange="k8TtXlImport(this)"></label></div></section>' +
      '<section class="k8-bh-card"><div class="k8-tt-seg k8-tt-grades" role="tablist">' + allKeys().concat(T.newX ? [T.newX.key] : []).map((g) => '<button type="button" role="tab" aria-selected="' + (T.grade === g) + '" onclick="k8TtGrade(\'' + g + '\')"' + (String(g).indexOf('x:') === 0 ? ' class="is-x"' : '') + '>' + esc(lbl(g)) + ' <small>' + cnt(g) + '</small></button>').join('') + '<button type="button" class="k8-tt-xadd" onclick="k8TtXNew()">+ ตารางพิเศษ</button></div>' +
      (isX ? '<div class="k8-tt-xinfo"><span><b>' + esc(xm.name || 'ตารางพิเศษ') + '</b><small>ตารางแยกสำหรับนักเรียนที่เลือก ' + (xm.students || []).length + ' คน · นักเรียนจะเห็นเป็นแท็บแยกจากตารางชั้น</small></span><button type="button" class="k8-bh-link" onclick="k8TtXEdit()">ชื่อ & รายชื่อ</button><button type="button" class="k8-bh-link k8-pe-del" onclick="k8TtXDel()">ลบตาราง</button></div>' : '') +
      '<p class="k8-pw-hint">แตะช่องเพื่อเลือกวิชา อาจารย์ และห้อง · ลงแล้ว ' + filled + ' คาบ' + (gradeOf(T.grade).updatedAt ? ' · บันทึกล่าสุด ' + esc(gradeOf(T.grade).updatedAt) : '') + '</p>' +
      '<div class="k8-tt-gridwrap"><table class="k8-tt-grid is-edit is-tt2"><thead><tr><th scope="col">วัน</th>' + c.periods.map((p, i) => '<th scope="col"' + (i === nowIdx(c) ? ' class="is-now"' : '') + '>คาบ ' + (i + 1) + '<small>' + esc(p.start) + '–' + esc(p.end) + '</small>' + (i === nowIdx(c) ? '<em>ตอนนี้</em>' : '') + '</th>').join('') + '</tr></thead><tbody>' +
      c.days.map((d) => '<tr' + (d === new Date().getDay() ? ' class="is-today"' : '') + '><th scope="row">' + DAYS[d] + (d === new Date().getDay() ? '<small>วันนี้</small>' : '') + '</th>' + c.periods.map((p, i) => { const k = d + '-' + (i + 1); const L = arr(T.draft[k]); const x = L[0]; const extra = L.length > 1 ? '+' + (L.length - 1) + ' กลุ่ม' : (x && x.o && x.o.length ? 'เฉพาะ ' + x.o.length + ' คน' : (x && x.x && x.x.length ? 'ละเว้น ' + x.x.length + ' คน' : '')); const ni = nowIdx(c); return '<td class="' + (i === ni ? 'is-nowcol' : '') + (i === ni && d === new Date().getDay() ? ' is-live' : '') + '"><button type="button"' + (x ? ' style="--sc:' + subjColor(x.sn) + '"' : '') + ' class="' + (x ? 'has' : '') + (extra ? ' is-group' : '') + ((L.length > 1 || L.some((e) => e.gx || e.from || e.to)) ? ' is-multi' : '') + '" onclick="k8TtCell(\'' + k + '\')" aria-label="วัน' + DAYN[d] + ' คาบ ' + (i + 1) + (x ? ' ' + esc(L.map((e) => e.sn).join(' และ ')) : ' ว่าง') + '">' + (x ? ((L.length > 1 || L.some((e) => e.gx || e.from || e.to)) ? '<span class="k8-tt-bands">' + L.map((e) => bandHtml(e, dateForDow(d))).join('') + '</span>' : '<b>' + esc(x.sn) + '</b><small>' + esc(x.tn || '') + (x.r ? ' · ' + esc(x.r) : '') + '</small>' + (extra ? '<em>' + esc(extra) + '</em>' : '')) : '<span aria-hidden="true">+</span>') + '</button></td>'; }).join('') + '</tr>').join('') +
      '</tbody></table></div>' +
      '<div class="k8-dr-btns k8-tt-save"><button type="button" class="is-alt" onclick="k8TtCopyFrom()">คัดลอกจากชั้นอื่น</button><button type="button" class="is-alt k8-tt-img-a" onclick="k8TtImage(\'admin\')"' + (filled ? '' : ' disabled') + '>' + IMG_ICON + 'บันทึกเป็นรูป A4</button>' + '<span class="k8-tt-autosave is-' + (T.saveSt || 'ok') + '" id="k8TtSaveSt" role="status" aria-live="polite">' + saveStText() + '</span>' + '</div></section>';
  }
  window.k8TtReload = function () { T.err = ''; T.at = 0; const el = adminRoot(); if (el) el.innerHTML = '<p class="k8-li-empty">กำลังโหลดตาราง…</p>'; load(true).then(() => { if (!T.dirty) startDraft(T.grade || '1'); renderAdmin(); }); };
  window.k8TtGrade = function (g) { if (T.dirty && !T.saving && !confirm('ตาราง ' + lbl(T.grade) + ' ยังไม่ได้บันทึก ต้องการเปลี่ยนโดยไม่บันทึกใช่ไหม?')) return; if (T.newX && g !== T.newX.key) T.newX = null; startDraft(g); renderAdmin(); };
  // ---------- ตารางพิเศษ: ตั้งชื่อ + เลือกนักเรียน (ข้ามชั้นได้) ----------
  let XP = null;
  const allStu = () => { try { return (allStudents || []).filter((st) => !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(st.status || ''))); } catch (e) { return []; } };
  function renderXP() {
    const q = (XP.q || '').toLowerCase(); const fg = XP.g || '';
    const list = allStu().filter((st) => { const m = String(st.grade || '').match(/([1-6])/); return !fg || (m && m[1] === fg); });
    document.getElementById('k8TtCellBody').innerHTML =
      '<label class="k8-nf-f"><span>ชื่อตาราง</span><input type="text" id="k8TtXName" maxlength="60" placeholder="เช่น ภาษาจีน (วิชาเลือก) · ซ่อมเสริมคณิต" value="' + esc(XP.name) + '" oninput="k8TtXName()"></label>' +
      '<fieldset class="k8-tt-who"><legend>นักเรียนในตารางนี้ <b id="k8TtXN">' + XP.sel.size + '</b> คน (เลือกข้ามชั้นได้)</legend>' +
      '<div class="k8-tt-seg">' + [''].concat(GR).map((g) => '<button type="button" aria-pressed="' + (fg === g) + '" onclick="k8TtXG(\'' + g + '\')">' + (g ? 'ม.' + g : 'ทุกชั้น') + '</button>').join('') + '</div>' +
      '<div class="k8-tt-stu-tools"><input type="search" placeholder="ค้นหาชื่อหรือรหัส" value="' + esc(XP.q || '') + '" oninput="k8TtXQ(this.value)"><button type="button" class="k8-bh-link" onclick="k8TtXAll(1)">เลือกที่แสดงทั้งหมด</button><button type="button" class="k8-bh-link" onclick="k8TtXAll(0)">ล้าง</button></div>' +
      '<div class="k8-tt-stu">' + (list.length ? list.map((st) => { const id = nsid(st.studentId); const hide = q && (st.fullName + ' ' + st.studentId).toLowerCase().indexOf(q) === -1; return '<label' + (hide ? ' hidden' : '') + '><input type="checkbox" value="' + esc(id) + '"' + (XP.sel.has(id) ? ' checked' : '') + ' onchange="k8TtXT(this)"><span>' + esc(st.fullName || id) + ' <small>' + esc(st.studentId) + ' · ' + esc(String(st.grade || '').replace('มัธยมศึกษาปีที่ ', 'ม.')) + '</small></span></label>'; }).join('') : '<p class="k8-pw-hint">ไม่พบรายชื่อนักเรียน</p>') + '</div></fieldset>' +
      '<div class="k8-dr-btns"><button type="button" class="is-alt" onclick="closeModal(\'k8TtCellModal\')">ยกเลิก</button><span class="k8-tt-autosave is-ok" id="k8TtXSt" role="status" aria-live="polite">' + (XP.isNew ? 'ตั้งชื่อและเลือกนักเรียน ระบบจะบันทึกให้เอง' : '✓ บันทึกอัตโนมัติเมื่อแก้ไข') + '</span><button type="button" id="k8TtXGo" onclick="k8TtXOk()">' + (XP.isNew ? 'สร้างตาราง' : 'เสร็จ') + '</button></div>';
  }
  function openXP(isNew) {
    XP = { isNew, name: isNew ? '' : (T.xmeta.name || ''), sel: new Set(isNew ? [] : (T.xmeta.students || []).map(nsid)), q: '', g: '' };
    document.getElementById('k8TtCellTitle').textContent = isNew ? 'สร้างตารางพิเศษ' : 'ชื่อตาราง & รายชื่อนักเรียน';
    document.getElementById('k8TtCellSub').textContent = 'ตารางแยกสำหรับวิชาที่เรียนเฉพาะบางคน';
    renderXP(); openModal('k8TtCellModal');
  }
  window.k8TtXNew = function () { if (T.dirty && !T.saving && !confirm('ตาราง ' + lbl(T.grade) + ' ยังไม่ได้บันทึก ต้องการสร้างตารางใหม่โดยไม่บันทึกใช่ไหม?')) return; openXP(true); };
  window.k8TtXEdit = function () { openXP(false); };
  window.k8TtXG = function (g) { XP.name = (document.getElementById('k8TtXName') || {}).value || XP.name; XP.g = g; renderXP(); };
  window.k8TtXQ = function (v) { XP.q = v; const q = v.toLowerCase(); document.querySelectorAll('#k8TtCellBody .k8-tt-stu label').forEach((l) => { l.hidden = !!q && l.textContent.toLowerCase().indexOf(q) === -1; }); };
  // v17.88 · เลือกนักเรียน/ตั้งชื่อตารางพิเศษ → บันทึกอัตโนมัติ (ไม่ต้องกดปุ่ม)
  let xpT = null;
  function xpStatus(t, cls) { const el = document.getElementById('k8TtXSt'); if (el) { el.className = 'k8-tt-autosave is-' + (cls || 'ok'); el.textContent = t; } }
  function applyXP(silent) {
    const name = ((document.getElementById('k8TtXName') || {}).value || XP.name || '').trim(); XP.name = name;
    if (!name) { if (!silent) toast('ตั้งชื่อตารางก่อน', 'warning'); else xpStatus('ตั้งชื่อตารางก่อน แล้วระบบจะบันทึกให้เอง', 'wait'); return false; }
    if (!XP.sel.size) { if (!silent) toast('เลือกนักเรียนอย่างน้อย 1 คน', 'warning'); else xpStatus('เลือกนักเรียนอย่างน้อย 1 คน แล้วระบบจะบันทึกให้เอง', 'wait'); return false; }
    if (XP.isNew) { T.newX = { key: 'x:new', id: '', name, students: [...XP.sel], cells: {} }; startDraft('x:new'); XP.isNew = false; }
    else { T.xmeta.name = name; T.xmeta.students = [...XP.sel]; }
    T.dirty = true; xpStatus('กำลังบันทึก…', 'saving');
    Promise.resolve(autoSave()).then(() => { xpStatus(T.saveSt === 'err' ? 'บันทึกไม่สำเร็จ · ลองอีกครั้ง' : '✓ บันทึกอัตโนมัติแล้ว · ' + XP.sel.size + ' คน', T.saveSt === 'err' ? 'err' : 'ok'); const b = document.getElementById('k8TtXGo'); if (b) b.textContent = 'เสร็จ'; });
    return true;
  }
  const xpAuto = () => { clearTimeout(xpT); xpStatus('กำลังจะบันทึก…', 'saving'); xpT = setTimeout(() => applyXP(true), 700); };
  window.k8TtXName = xpAuto;
  window.k8TtXT = function (c) { if (c.checked) XP.sel.add(c.value); else XP.sel.delete(c.value); document.getElementById('k8TtXN').textContent = XP.sel.size; xpAuto(); };
  window.k8TtXAll = function (on) { document.querySelectorAll('#k8TtCellBody .k8-tt-stu label:not([hidden]) input').forEach((c) => { c.checked = !!on; if (on) XP.sel.add(c.value); else XP.sel.delete(c.value); }); document.getElementById('k8TtXN').textContent = XP.sel.size; xpAuto(); };
  window.k8TtXOk = function () {
    clearTimeout(xpT);
    const wasNew = XP.isNew;
    if (!applyXP(false)) return;
    closeModal('k8TtCellModal'); renderAdmin();
    if (wasNew) toast('สร้างตาราง "' + XP.name + '" แล้ว · ลงคาบเรียนได้เลย ระบบบันทึกให้อัตโนมัติ', 'success');
  };
  window.k8TtXDel = async function () {
    if (!T.xmeta) return;
    if (!T.xmeta.id) { T.newX = null; T.dirty = false; startDraft('1'); renderAdmin(); return; }
    if (!confirm('ลบตาราง "' + T.xmeta.name + '" ใช่ไหม? นักเรียนในตารางนี้จะไม่เห็นตารางนี้อีก')) return;
    T.w = (T.w || 0) + 1;
    let r = null; try { r = await gasApiCall('deleteTimetableExtra', { data: { id: T.xmeta.id } }, 20000); } catch (e) { r = { success: false, message: 'เชื่อมต่อระบบไม่ได้' }; }
    if (!r || !r.success) { toast((r && (r.message || r.error)) || 'ลบไม่สำเร็จ', 'error'); return; }
    T.data.extras = extrasOf().filter((x) => x.id !== T.xmeta.id); try { localStorage.setItem(CACHE, JSON.stringify(T.data)); } catch (e) {}
    T.dirty = false; startDraft('1'); toast(r.message, 'success'); renderAdmin();
  };
  // ---------- แก้ไขคาบ: หลายกลุ่มต่อคาบ · แต่ละกลุ่มเลือกนักเรียนเฉพาะบางคนได้ ----------
  let G = [];
  const gradeStudents = () => { try { return (allStudents || []).filter((s) => { const m = String(s.grade || '').match(/([1-6])/); return m && m[1] === T.grade && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(s.status || '')); }); } catch (e) { return []; } };
  // นักเรียนที่เกี่ยวกับตารางนี้ (ตารางชั้น = ทั้งชั้น · ตารางพิเศษ = นักเรียนที่เลือกไว้)
  const poolStudents = () => {
    if (String(T.grade).indexOf('x:') !== 0) return gradeStudents();
    const ids = new Set(((T.xmeta && T.xmeta.students) || []).map(nsid));
    let all = []; try { all = allStudents || []; } catch (e) {}
    const found = all.filter((st) => ids.has(nsid(st.studentId)));
    const have = new Set(found.map((st) => nsid(st.studentId)));
    ids.forEach((id) => { if (!have.has(id)) found.push({ studentId: id, fullName: id }); });
    return found;
  };
  window.k8TtExOpen = function (i) { pullG(); if (G[i]) G[i].xOpen = true; renderG(); };
  window.k8TtExCount = function (i) { const box = document.querySelectorAll('#k8TtCellBody .k8-tt-grp')[i]; if (!box) return; const n = box.querySelectorAll('.k8-tt-xlist input:checked').length; const c = box.querySelector('.k8-tt-xn'); if (c) c.textContent = n ? 'เลือกแล้ว ' + n + ' คน' : 'ยังไม่ได้เลือก'; };
  window.k8TtExQ = function (i, v) { const box = document.querySelectorAll('#k8TtCellBody .k8-tt-grp')[i]; if (!box) return; const q = v.toLowerCase(); box.querySelectorAll('.k8-tt-xlist label').forEach((l) => { l.hidden = !!q && l.textContent.toLowerCase().indexOf(q) === -1; }); };
  function pullG() {
    document.querySelectorAll('#k8TtCellBody .k8-tt-grp').forEach((box, i) => {
      const e = G[i]; if (!e || box.classList.contains('is-fold')) return;
      const sv = box.querySelector('.k8TtSubj').value; const subs = subjects(); const so = subs.find((x) => x.id === sv);
      e.s = so ? so.id : ''; e.sn = so ? so.name : (sv === '__custom' ? box.querySelector('.k8TtCustom').value.trim() : (sv ? e.sn : ''));
      if (sv === '__custom') e.custom = true; else delete e.custom;
      const tu = box.querySelector('.k8TtTeacher').value; const t = (T.teachers || []).find((x) => x.u === tu);
      if (tu === '__guest') { e.guest = true; e.t = ''; const gi = box.querySelector('.k8TtGuest'); e.tn = gi ? gi.value.trim() : (e.tn || ''); } else { delete e.guest; e.t = tu; e.tn = t ? t.n : ''; }
      e.r = box.querySelector('.k8TtRoom').value.trim();
      e.pick = e.aud === 'some';
      if (e.rng) { const f = box.querySelector('.k8TtFrom'), t = box.querySelector('.k8TtTo'); e.from = f ? f.value : ''; e.to = t ? t.value : ''; } else { e.from = ''; e.to = ''; }
      e.o = e.pick ? Array.from(box.querySelectorAll('.k8-tt-stu:not(.k8-tt-xlist) input:checked')).map((c) => c.value) : [];
      if (box.querySelector('.k8-tt-xlist')) e.x = Array.from(box.querySelectorAll('.k8-tt-xlist input:checked')).map((c) => c.value);
    });
  }
  function exBlock(e, i) {
    const xs = new Set((e.x || []).map(nsid));
    if (!e.xOpen) return '<button type="button" class="k8-tt-exbtn" onclick="k8TtExOpen(' + i + ')"><span aria-hidden="true">⊘</span> ละเว้นวิชานี้ให้นักเรียนบางคน</button>';
    const stu = poolStudents();
    return '<fieldset class="k8-tt-who k8-tt-ex"><legend>ละเว้นวิชานี้ให้นักเรียน <small>· คนที่เลือกจะไม่เห็นวิชานี้ในตาราง</small></legend>' +
      '<div class="k8-tt-stu-tools"><input type="search" placeholder="ค้นหาชื่อหรือรหัส" oninput="k8TtExQ(' + i + ',this.value)"><b class="k8-tt-xn">' + (xs.size ? 'เลือกแล้ว ' + xs.size + ' คน' : 'ยังไม่ได้เลือก') + '</b></div>' +
      '<div class="k8-tt-stu k8-tt-xlist">' + (stu.length ? stu.map((st) => { const id = nsid(st.studentId); return '<label><input type="checkbox" value="' + esc(id) + '"' + (xs.has(id) ? ' checked' : '') + ' onchange="k8TtExCount(' + i + ')"><span>' + esc(st.fullName || id) + ' <small>' + esc(st.studentId) + '</small></span></label>'; }).join('') : '<p class="k8-pw-hint">ไม่พบรายชื่อนักเรียน · ลองซิงค์ข้อมูลนักเรียนก่อน</p>') + '</div></fieldset>';
  }
  // v17.84 · หน้าต่างแก้ช่อง (แบบ 2): หลายวิชาในคาบเดียว · ผู้เรียน ทั้งชั้น/ชาย/หญิง/เลือกเอง · ช่วงวันที่จากปฏิทิน
  const AUDS = [['all', 'ทั้งชั้น'], ['m', 'ชาย'], ['f', 'หญิง'], ['some', 'เลือกเอง']];
  const audOv = (a, b) => a === 'all' || b === 'all' || a === 'some' || b === 'some' || a === b;
  const rngOv = (a, b) => !((a.to && b.from && a.to < b.from) || (b.to && a.from && b.to < a.from));
  function checkG() {
    const L = G.filter((e) => e.sn); const warn = [];
    for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
      const x = L[a], y = L[b];
      if (x.aud === 'some' && y.aud === 'some') continue;
      if (audOv(x.aud, y.aud) && rngOv(x, y) && !(x.aud === 'some' || y.aud === 'some')) warn.push('"' + x.sn + '" กับ "' + y.sn + '" เรียนพร้อมกัน' + (x.aud === y.aud && x.aud !== 'all' ? ' (นักเรียน' + GXN[x.aud] + ')' : '') + (x.from || x.to || y.from || y.to ? ' ในช่วงวันที่ทับกัน' : '') + ' · แยกผู้เรียนหรือช่วงวันที่');
    }
    const hasM = L.some((e) => e.aud === 'm'), hasF = L.some((e) => e.aud === 'f'), hasAll = L.some((e) => e.aud === 'all');
    if (hasM && !hasF && !hasAll) warn.push('นักเรียนหญิงยังไม่มีวิชาในคาบนี้ (บันทึกได้ ถ้าตั้งใจให้ว่าง)');
    if (hasF && !hasM && !hasAll) warn.push('นักเรียนชายยังไม่มีวิชาในคาบนี้ (บันทึกได้ ถ้าตั้งใจให้ว่าง)');
    const ok = !warn.length && L.length ? (hasM || hasF ? 'ครบทุกคน: ' + ['m', 'f'].map((g) => GXN[g] + ' → ' + (L.filter((e) => e.aud === g || e.aud === 'all').map((e) => e.sn).join(' / ') || '-')).join(' · ') : L.length > 1 ? L.length + ' วิชาในคาบนี้ ไม่ชนกัน' : 'ทั้งชั้นเรียนวิชาเดียว') : '';
    return { warn, ok };
  }
  function renderG() {
    const subs = subjects(); const stu = gradeStudents();
    const q = (T.stuQ || '').toLowerCase();
    const isX = String(T.grade).indexOf('x:') === 0;
    const chk = checkG();
    document.getElementById('k8TtCellBody').innerHTML = G.map((e, i) => {
      const known = subs.some((s) => s.id === e.s); const custom = e.custom || (e.sn && !known);
      const chosen = new Set((e.o || []).map(nsid));
      const folded = G.length > 1 && i !== T.openG;
      const tags = (e.aud === 'm' || e.aud === 'f' ? '<i class="k8-tt-tg is-' + e.aud + '">' + GXN[e.aud] + '</i>' : e.aud === 'some' ? '<i class="k8-tt-tg">' + (e.o || []).length + ' คน</i>' : '') + (rangeTxt(e) ? '<i class="k8-tt-tg is-r">' + rangeTxt(e) + '</i>' : '');
      const head = '<div class="k8-tt-gh" onclick="k8TtOpenG(' + i + ')"><span class="k8-tt-gn" style="background:' + (e.sn ? subjColor(e.sn) : '#94a3b8') + '">' + (i + 1) + '</span><b>' + esc(e.sn || 'เลือกวิชา') + '</b>' + tags + (G.length > 1 ? '<button type="button" class="k8-tt-gdel" onclick="event.stopPropagation();k8TtGrpDel(' + i + ')">ลบ</button>' : '') + '</div>';
      if (folded) return '<section class="k8-tt-grp is-fold">' + head + '</section>';
      return '<section class="k8-tt-grp is-open">' + head +
        '<div class="k8-tt-g3"><label class="k8-nf-f"><span>วิชา</span><select class="k8TtSubj k8-pe-sel" onchange="k8TtGrpRe()"><option value="">— เลือกวิชา —</option>' + subs.map((s) => '<option value="' + esc(s.id) + '"' + (s.id === e.s ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '<option value="__custom"' + (custom ? ' selected' : '') + '>อื่นๆ (พิมพ์เอง เช่น โฮมรูม กิจกรรม)</option></select></label>' +
        '<label class="k8-nf-f"><span>อาจารย์</span><select class="k8TtTeacher k8-pe-sel" onchange="k8TtGrpRe()"><option value="">— ไม่ระบุ —</option>' + (T.teachers || []).map((t) => '<option value="' + esc(t.u) + '"' + (t.u === e.t ? ' selected' : '') + '>' + esc(t.n) + '</option>').join('') + '<option value="__guest"' + ((e.guest || (!e.t && e.tn)) ? ' selected' : '') + '>อาจารย์พิเศษ / ภายนอก (พิมพ์ชื่อ)</option></select></label>' +
        '<label class="k8-nf-f k8-tt-room"><span>ห้อง</span><input type="text" class="k8TtRoom" maxlength="40" placeholder="เช่น 401" value="' + esc(e.r || '') + '"></label></div>' +
        '<label class="k8-nf-f"' + (custom ? '' : ' hidden') + '><span>ชื่อวิชา/กิจกรรม</span><input type="text" class="k8TtCustom" maxlength="80" value="' + esc(known ? '' : (e.sn || '')) + '"></label>' +
        '<label class="k8-nf-f"' + ((e.guest || (!e.t && e.tn)) ? '' : ' hidden') + '><span>ชื่ออาจารย์พิเศษ</span><input type="text" class="k8TtGuest" maxlength="80" placeholder="เช่น อ.สมชาย (วิทยากรภายนอก)" value="' + esc(!e.t ? (e.tn || '') : '') + '"></label>' +
        '<div class="k8-tt-g2"><div class="k8-nf-f"><span>ผู้เรียน</span><div class="k8-tt-seg2">' + AUDS.filter((a) => !isX || a[0] === 'all' || a[0] === 'm' || a[0] === 'f').map(([k, l]) => '<button type="button" class="is-' + k + '" aria-pressed="' + (e.aud === k) + '" onclick="k8TtAud(' + i + ',\'' + k + '\')">' + l + '</button>').join('') + '</div></div>' +
        '<div class="k8-nf-f"><span>ช่วงที่เรียน</span><div class="k8-tt-seg2"><button type="button" aria-pressed="' + !e.rng + '" onclick="k8TtRng(' + i + ',0)">ตลอดภาคเรียน</button><button type="button" aria-pressed="' + !!e.rng + '" onclick="k8TtRng(' + i + ',1)">📅 กำหนดวันที่</button></div></div></div>' +
        (e.rng ? '<div class="k8-tt-dates"><label class="k8-nf-f"><span>ตั้งแต่วันที่</span><input type="date" class="k8TtFrom" value="' + esc(e.from || '') + '" onchange="k8TtGrpRe()"></label><span aria-hidden="true">→</span><label class="k8-nf-f"><span>ถึงวันที่</span><input type="date" class="k8TtTo" value="' + esc(e.to || '') + '" min="' + esc(e.from || '') + '" onchange="k8TtGrpRe()"></label></div><p class="k8-pw-hint">หลังวันสุดท้าย วิชานี้จะไม่ขึ้นในตารางของนักเรียนและอาจารย์ แต่ประวัติการเช็คชื่อที่บันทึกไว้ยังอยู่ครบ</p>' : '') +
        exBlock(e, i) +
        (e.aud === 'some' ? '<fieldset class="k8-tt-who"><legend>เลือกผู้เรียน (' + chosen.size + ' คน)</legend><div class="k8-tt-stu-tools"><input type="search" placeholder="ค้นหาชื่อหรือรหัส" value="' + esc(T.stuQ || '') + '" oninput="k8TtStuQ(this.value)"><button type="button" class="k8-bh-link" onclick="k8TtStuAll(' + i + ',1)">เลือกทั้งหมด</button><button type="button" class="k8-bh-link" onclick="k8TtStuAll(' + i + ',0)">ล้าง</button></div>' +
          '<div class="k8-tt-stu">' + (stu.length ? stu.map((st) => { const id = nsid(st.studentId); const hide = q && (st.fullName + ' ' + st.studentId).toLowerCase().indexOf(q) === -1; return '<label' + (hide ? ' hidden' : '') + '><input type="checkbox" value="' + esc(id) + '"' + (chosen.has(id) ? ' checked' : '') + ' onchange="k8TtStuCount(' + i + ')"><span>' + esc(st.fullName || id) + ' <small>' + esc(st.studentId) + '</small></span></label>'; }).join('') : '<p class="k8-pw-hint">ไม่พบรายชื่อนักเรียน ม.' + esc(T.grade) + ' · ลองซิงค์ข้อมูลนักเรียนก่อน</p>') + '</div></fieldset>' : '') +
        '</section>';
    }).join('') +
      '<button type="button" class="k8-tt-gadd" onclick="k8TtGrpAdd()">＋ เพิ่มวิชาในคาบนี้</button>' +
      '<div class="k8-tt-gfoot"><div class="k8-tt-gprev"><small>ตัวอย่างในตาราง</small><div class="k8-tt-bands">' + (G.filter((e) => e.sn).map((e) => bandHtml({ sn: e.sn, gx: e.aud === 'm' || e.aud === 'f' ? e.aud : '', o: e.aud === 'some' ? e.o : null, from: e.rng ? e.from : '', to: e.rng ? e.to : '' })).join('') || '<span class="k8-tt-band is-empty">+</span>') + '</div></div>' +
      '<div class="k8-tt-gsum">' + (chk.warn.length ? chk.warn.map((w) => '<p class="is-warn">⚠ ' + esc(w) + '</p>').join('') : chk.ok ? '<p class="is-ok">✓ ' + esc(chk.ok) + '</p>' : '') +
      '<div class="k8-dr-btns">' + (T.draft[T.cell] ? '<button type="button" class="is-alt k8-pe-del" onclick="k8TtCellClear()">ล้างช่องนี้</button>' : '') + '<button type="button" class="is-alt" onclick="closeModal(\'k8TtCellModal\')">ยกเลิก</button><button type="button" onclick="k8TtCellOk()">ใช้ค่านี้</button></div></div></div>';
  }
  window.k8TtOpenG = function (i) { pullG(); T.openG = i; renderG(); };
  window.k8TtAud = function (i, v) { pullG(); if (G[i]) { G[i].aud = v; if (v === 'some') G[i].pick = true; } T.openG = i; renderG(); };
  window.k8TtRng = function (i, on) { pullG(); if (G[i]) { G[i].rng = !!on; if (on && !G[i].from) G[i].from = todayS(); } T.openG = i; renderG(); };
  window.k8TtCell = function (k) {
    loadTeachers();
    T.cell = k; T.stuQ = ''; const [d, p] = k.split('-').map(Number); const per = cfg().periods[p - 1] || {};
    G = arr(T.draft[k]).map((e) => Object.assign({}, e, { o: (e.o || []).slice(), pick: !!(e.o && e.o.length), aud: e.o && e.o.length ? 'some' : (e.gx || 'all'), rng: !!(e.from || e.to), x: (e.x || []).slice(), xOpen: !!(e.x && e.x.length) }));
    if (!G.length) G = [{ s: '', sn: '', t: '', tn: '', r: '', o: [], pick: false, aud: 'all' }];
    T.openG = G.length - 1;
    document.getElementById('k8TtCellTitle').textContent = (String(T.grade).indexOf('x:') === 0 ? ((T.xmeta && T.xmeta.name) || lbl(T.grade)) : 'ม.' + T.grade) + ' · วัน' + DAYN[d] + ' คาบ ' + p;
    document.getElementById('k8TtCellSub').textContent = (per.start || '') + '–' + (per.end || '') + ' น.';
    renderG(); openModal('k8TtCellModal');
  };
  window.k8TtGrpRe = function () { pullG(); renderG(); };
  window.k8TtGrpAdd = function () { pullG(); const last = G[G.length - 1] || {}; G.push({ s: '', sn: '', t: '', tn: '', r: '', o: [], pick: false, aud: last.aud === 'm' ? 'f' : last.aud === 'f' ? 'm' : 'all' }); T.openG = G.length - 1; renderG(); };
  window.k8TtGrpDel = function (i) { pullG(); G.splice(i, 1); if (!G.length) G = [{ s: '', sn: '', t: '', tn: '', r: '', o: [], pick: false, aud: 'all' }]; T.openG = Math.min(T.openG || 0, G.length - 1); renderG(); };
  window.k8TtStuQ = function (v) { pullG(); T.stuQ = v; const q = v.toLowerCase(); document.querySelectorAll('#k8TtCellBody .k8-tt-stu:not(.k8-tt-xlist) label').forEach((l) => { l.hidden = !!q && l.textContent.toLowerCase().indexOf(q) === -1; }); };
  window.k8TtStuAll = function (i, on) { const box = document.querySelectorAll('#k8TtCellBody .k8-tt-grp')[i]; if (!box) return; box.querySelectorAll('.k8-tt-stu:not(.k8-tt-xlist) label:not([hidden]) input').forEach((c) => { c.checked = !!on; }); k8TtStuCount(i); };
  window.k8TtStuCount = function (i) { const box = document.querySelectorAll('#k8TtCellBody .k8-tt-grp')[i]; if (!box) return; const n = box.querySelectorAll('.k8-tt-stu:not(.k8-tt-xlist) input:checked').length; const lg = box.querySelector('.k8-tt-who legend'); if (lg) lg.textContent = 'เลือกผู้เรียน (' + n + ' คน)'; };
  window.k8TtSubjCh = function () { window.k8TtGrpRe(); };
  window.k8TtCellOk = function () {
    pullG();
    const list = [];
    for (let i = 0; i < G.length; i++) {
      const e = G[i];
      if (!e.sn) { toast((G.length > 1 ? 'กลุ่มที่ ' + (i + 1) + ': ' : '') + 'เลือกวิชาก่อน', 'warning'); return; }
      if (e.pick && !e.o.length) { toast((G.length > 1 ? 'กลุ่มที่ ' + (i + 1) + ': ' : '') + 'เลือกนักเรียนอย่างน้อย 1 คน หรือเลือก "ทั้งชั้น"', 'warning'); return; }
      if (e.guest && !e.tn) { toast((G.length > 1 ? 'กลุ่มที่ ' + (i + 1) + ': ' : '') + 'พิมพ์ชื่ออาจารย์พิเศษ หรือเลือก "ไม่ระบุ"', 'warning'); return; }
      if (e.rng && !e.from && !e.to) { toast((G.length > 1 ? 'วิชาที่ ' + (i + 1) + ': ' : '') + 'เลือกวันที่เริ่มหรือวันสุดท้าย หรือเลือก "ตลอดภาคเรียน"', 'warning'); T.openG = i; renderG(); return; }
      const out = { s: e.s, sn: e.sn, t: e.t, tn: e.tn, r: e.r }; if (e.pick) out.o = e.o; if (e.x && e.x.length) out.x = e.x;
      if (e.aud === 'm' || e.aud === 'f') out.gx = e.aud;
      if (e.rng) { let a = e.from || '', b = e.to || ''; if (a && b && b < a) { const t = a; a = b; b = t; } if (a) out.from = a; if (b) out.to = b; }
      list.push(out);
    }
    T.draft[T.cell] = list.length === 1 && !list[0].o && !list[0].gx && !list[0].from && !list[0].to ? list[0] : list;
    T.dirty = true; closeModal('k8TtCellModal'); renderAdmin(); autoSave();
  };
  window.k8TtCellClear = function () { delete T.draft[T.cell]; T.dirty = true; closeModal('k8TtCellModal'); renderAdmin(); autoSave(); };
  // v17.47 · บันทึกอัตโนมัติทุกครั้งที่แก้ (ไม่ต้องกดปุ่มบันทึก)
  function saveStText() {
    const st = T.saveSt || 'ok';
    if (st === 'saving') return '<i class="k8-tt-spin" aria-hidden="true"></i>กำลังบันทึก…';
    if (st === 'err') return 'บันทึกไม่สำเร็จ <button type="button" onclick="k8TtRetrySave()">ลองใหม่</button>';
    return '✓ บันทึกอัตโนมัติ' + (T.savedAt ? ' · ' + T.savedAt : '');
  }
  function paintSave(st) { T.saveSt = st; const el = document.getElementById('k8TtSaveSt'); if (el) { el.className = 'k8-tt-autosave is-' + st; el.innerHTML = saveStText(); } }
  async function autoSave() {
    if (T.saving) { T.again = true; return; }
    if (!T.dirty) return;
    T.saving = true; T.again = false; T.w = (T.w || 0) + 1; paintSave('saving');
    const g = T.grade, isX = String(g).indexOf('x:') === 0, snap = JSON.stringify(T.draft || {}), xm = isX ? Object.assign({}, T.xmeta) : null;
    let r = null;
    try { r = isX ? await gasApiCall('saveTimetableExtra', { data: { id: xm.id, name: xm.name, students: xm.students, cells: JSON.parse(snap) } }, 30000) : await gasApiCall('saveTimetable', { data: { grade: g, cells: JSON.parse(snap) } }, 30000); } catch (e) { r = null; }
    T.saving = false;
    if (!r || !r.success) { paintSave('err'); toast((r && (r.message || r.error)) || 'บันทึกตารางไม่สำเร็จ · ตรวจอินเทอร์เน็ตแล้วกด "ลองใหม่"', 'error'); return; }
    if (isX && r.extra) {
      T.data.extras = extrasOf().filter((e) => e.id !== r.extra.id).concat([r.extra]);
      if (T.grade === g) { T.xmeta = Object.assign({}, T.xmeta, { id: r.extra.id }); T.grade = 'x:' + r.extra.id; T.newX = null; }
    } else if (!isX) { T.data.grades = T.data.grades || {}; T.data.grades[g] = r.timetable; }
    try { localStorage.setItem(CACHE, JSON.stringify(T.data)); } catch (e) {}
    const changed = JSON.stringify(T.draft || {}) !== snap; // แก้เพิ่มระหว่างบันทึก → บันทึกรอบถัดไป
    if (!changed) T.dirty = false;
    const d = new Date(); T.savedAt = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' น.';
    paintSave('ok');
    const m = document.getElementById('k8TtCellModal'); if (!(m && m.classList.contains('open'))) { const y = window.scrollY; renderAdmin(); try { window.scrollTo(0, y); } catch (e) {} }
    if (changed || T.again) autoSave();
  }
  window.k8TtRetrySave = function () { T.dirty = true; autoSave(); };
  window.k8TtCopyFrom = function () {
    const g = prompt('คัดลอกตารางจากชั้นไหน? พิมพ์ตัวเลข 1–6', ''); if (!g) return;
    if (!/^[1-6]$/.test(g.trim()) || g.trim() === T.grade) { toast('พิมพ์เลขชั้น 1–6 ที่ไม่ใช่ชั้นปัจจุบัน', 'warning'); return; }
    T.draft = JSON.parse(JSON.stringify(gradeOf(g.trim()).cells || {})); T.dirty = true; renderAdmin(); autoSave(); toast('คัดลอกจาก ม.' + g.trim() + ' แล้ว · บันทึกอัตโนมัติ', 'info');
  };
  window.k8TtSave = async function () {
    T.w = (T.w || 0) + 1;
    const b = document.getElementById('k8TtSaveBtn'); if (b) { b.disabled = true; b.textContent = 'กำลังบันทึก…'; }
    const isX = String(T.grade).indexOf('x:') === 0;
    let r = null; try { r = isX ? await gasApiCall('saveTimetableExtra', { data: { id: T.xmeta.id, name: T.xmeta.name, students: T.xmeta.students, cells: T.draft } }, 25000) : await gasApiCall('saveTimetable', { data: { grade: T.grade, cells: T.draft } }, 25000); } catch (e) { r = { success: false, message: 'เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้ง' }; }
    if (!r || !r.success) { toast((r && (r.message || r.error)) || 'บันทึกไม่สำเร็จ', 'error'); if (b) { b.disabled = false; b.textContent = 'บันทึก'; } return; }
    if (isX) {
      const x = r.extra; T.data.extras = extrasOf().filter((e) => e.id !== x.id).concat([x]); T.newX = null; T.dirty = false; startDraft('x:' + x.id);
      try { localStorage.setItem(CACHE, JSON.stringify(T.data)); } catch (e) {}
      toast(r.message, 'success'); renderAdmin(); return;
    }
    T.data.grades = T.data.grades || {}; T.data.grades[T.grade] = r.timetable; T.dirty = false; startDraft(T.grade);
    try { localStorage.setItem(CACHE, JSON.stringify(T.data)); } catch (e) {}
    toast(r.message, 'success'); renderAdmin();
  };
  async function saveCfg(patch, okMsg) {
    T.w = (T.w || 0) + 1;
    let r = null; try { r = await gasApiCall('saveTimetableConfig', { data: patch }, 20000); } catch (e) { r = { success: false, message: 'เชื่อมต่อระบบไม่ได้' }; }
    if (!r || !r.success) { toast((r && (r.message || r.error)) || 'บันทึกไม่สำเร็จ', 'error'); renderAdmin(); return false; }
    T.data.config = r.config; try { localStorage.setItem(CACHE, JSON.stringify(T.data)); } catch (e) {}
    toast(okMsg || r.message, 'success'); renderAdmin(); return true;
  }
  window.k8TtVis = function (k, v) { const p = {}; p[k] = v; saveCfg(p, (k === 'showStudents' ? 'นักเรียน' : 'อาจารย์') + (v ? 'เห็นตารางแล้ว' : 'จะไม่เห็นตาราง')); };
  window.k8TtToggleDay = function (d) { const days = cfg().days.slice(); const i = days.indexOf(d); if (i === -1) days.push(d); else days.splice(i, 1); if (!days.length) { toast('ต้องมีวันเรียนอย่างน้อย 1 วัน', 'warning'); return; } saveCfg({ days }); };
  window.k8TtPeriods = function () {
    const ps = cfg().periods;
    document.getElementById('k8TtCellTitle').textContent = 'เวลาคาบเรียน';
    document.getElementById('k8TtCellSub').textContent = 'ใช้เหมือนกันทุกชั้น · วันละ ' + MAXP + ' คาบ (5 วิชา)';
    document.getElementById('k8TtCellBody').innerHTML = '<div id="k8TtPRows">' + ps.map((p, i) => prow(i, p)).join('') + '</div>' +
      '<div class="k8-dr-btns"><button type="button" class="is-alt" id="k8TtPAddBtn" onclick="k8TtPAdd()"' + (ps.length >= MAXP ? ' hidden' : '') + '>+ เพิ่มคาบ</button><button type="button" onclick="k8TtPSave()">บันทึกเวลา</button></div>';
    openModal('k8TtCellModal');
  };
  const prow = (i, p, src) => '<div class="k8-pw-row" data-src="' + (src === undefined ? i + 1 : src) + '"><b>คาบ ' + (i + 1) + '</b><label><span>เริ่ม</span><input type="time" class="k8TtPs" value="' + esc(p.start) + '"></label><label><span>จบ</span><input type="time" class="k8TtPe" value="' + esc(p.end) + '"></label><button type="button" class="k8-pw-x" onclick="k8TtPDel(this)" aria-label="ลบคาบ ' + (i + 1) + '"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button></div>';
  const periodUsed = (p) => ['1', '2', '3', '4', '5', '6'].map((g) => gradeOf(g).cells || {}).concat(extrasOf().map((x) => x.cells || {})).some((cells) => Object.keys(cells).some((k) => +k.split('-')[1] === p));
  window.k8TtPDel = function (btn) {
    const box = document.getElementById('k8TtPRows'); if (!box) return;
    if (box.children.length <= 1) { toast('ต้องมีอย่างน้อย 1 คาบ', 'warning'); return; }
    const row = btn.closest('.k8-pw-row'); const n = Array.from(box.children).indexOf(row) + 1; const src = +row.dataset.src;
    if (src && periodUsed(src) && !confirm('คาบ ' + n + ' มีวิชาลงไว้ในตารางแล้ว ถ้าลบ วิชาในคาบนี้จะหายจากทุกตาราง และคาบถัดไปจะเลื่อนขึ้นมาแทน · ลบเลยไหม?')) return;
    row.remove();
    { const ab = document.getElementById('k8TtPAddBtn'); if (ab) ab.hidden = box.children.length >= MAXP; }
    Array.from(box.children).forEach((r, i) => { const b = r.querySelector('b'); if (b) b.textContent = 'คาบ ' + (i + 1); const x = r.querySelector('.k8-pw-x'); if (x) x.setAttribute('aria-label', 'ลบคาบ ' + (i + 1)); });
    toast('ลบคาบแล้ว · กด "บันทึกเวลา" เพื่อยืนยัน', 'info');
  };
  window.k8TtPAdd = function () { const box = document.getElementById('k8TtPRows'); const n = box.children.length; if (n >= MAXP) { toast('สูงสุด ' + MAXP + ' คาบต่อวัน', 'warning'); return; } const ends = box.querySelectorAll('.k8TtPe'); const last = ends.length ? ends[ends.length - 1].value : '08:00'; const m = toMin(last) || 480; const f = (x) => String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); box.insertAdjacentHTML('beforeend', prow(n, { start: f(m), end: f(m + 50) }, 0)); const ab = document.getElementById('k8TtPAddBtn'); if (ab) ab.hidden = box.children.length >= MAXP; };
  window.k8TtPSave = async function () {
    const s = Array.from(document.querySelectorAll('.k8TtPs')).map((x) => x.value), e = Array.from(document.querySelectorAll('.k8TtPe')).map((x) => x.value);
    const src = Array.from(document.querySelectorAll('#k8TtPRows .k8-pw-row')).map((r) => +r.dataset.src || 0);
    const keep = s.map((v, i) => i).filter((i) => s[i] || e[i]);
    const periods = keep.map((i) => ({ start: s[i], end: e[i] })); const map = keep.map((i) => src[i]);
    const moved = map.some((v, i) => v !== 0 && v !== i + 1) || keep.length < cfg().periods.length;
    const ok = await saveCfg(moved ? { periods, map } : { periods }, 'บันทึกเวลาคาบเรียนแล้ว');
    if (!ok) return;
    closeModal('k8TtCellModal');
    if (moved) { if (T.dirty) toast('ตารางที่ยังไม่บันทึกถูกโหลดใหม่ตามคาบล่าสุด', 'info'); T.dirty = false; await load(true); startDraft(T.grade || '1'); renderAdmin(); }
  };

  const sat = window.switchAdminTab;
  if (typeof sat === 'function') window.switchAdminTab = function (tab) { const r = sat.apply(this, arguments); if (tab === 'timetable') { renderAdmin(); load(true).then(() => { if (!T.dirty) startDraft(T.grade || '1'); renderAdmin(); }); } return r; };
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) { const r = sv.apply(this, arguments); if (v === 'dashboard' || v === 'teacher') { paintEntry(); load(false); } return r; };
  setInterval(paintEntry, 60000);
  window.k8TtMineToday = function () { return (T.data && !T.data.hidden) ? todayList('', true) : null; };
  window.k8TtAllOn = function (dateStr) { const d = new Date(String(dateStr) + 'T00:00:00'); if (isNaN(d) || !T.data || T.data.hidden) return null; const c = cfg(); const dow = d.getDay(); const out = []; if (c.days.indexOf(dow) === -1) return out; const ds = ymdL(d); allKeys().forEach((g) => { const cells = gradeOf(g).cells || {}; c.periods.forEach((p, i) => { cellsOn(g, dow, i + 1, ds).forEach((x) => { if (x && (x.s || x.sn)) out.push({ g, p: i + 1, start: p.start, end: p.end, c: x, mine: isMine(x) }); }); }); }); return out.sort((a, b) => toMin(a.start) - toMin(b.start)); }; // v17.68 · สอนแทน
  window.k8TtMineOn = function (dateStr) { const d = new Date(String(dateStr) + 'T00:00:00'); if (isNaN(d)) return null; return (T.data && !T.data.hidden) ? todayList('', true, d.getDay(), ymdL(d)) : null; }; // v17.65
  window.k8TtLoad = function () { return load(false); };
  window.addEventListener('beforeunload', (e) => { if (T.dirty) { e.preventDefault(); e.returnValue = ''; } });
  const start = () => setTimeout(() => { if (role()) { paintEntry(); load(false); } }, 2500);
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
})();

/* ============ v12.4 · หน้าภาพรวมอาจารย์แบบ 7C + ไทม์ไลน์คาบสอนวันนี้ ============ */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const readJ = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? f : v; } catch (e) { return f; } };
  const toMin = (t) => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : NaN; };
  const ymd = (d) => d.toLocaleDateString('sv-SE');
  const I = {
    check: '<path d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
    bh: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    tt: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 4v17M3 14h18"/>',
    doc: '<path d="M4 19.5V5a2 2 0 0 1 2-2h8l6 6v10.5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 19.5zM14 3v6h6"/>',
    hq: '<path d="M12 7v14M3 18V4h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v14h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>'
  };
  const svg = (k) => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[k] + '</svg>';

  function build() {
    const ov = document.getElementById('teacher-tab-overview'); if (!ov) return false;
    if (document.getElementById('k8ThHero')) return true;
    const head = ov.querySelector('.k8-th-head'), kpis = ov.querySelector('.k8-th-kpis'); if (!head || !kpis) return false;
    const hero = document.createElement('div'); hero.id = 'k8ThHero'; hero.className = 'k8-th-hero';
    ov.insertBefore(hero, head); hero.appendChild(head); hero.appendChild(kpis);
    // ตัวเลขสรุป 3 ช่อง: มาเรียนวันนี้ (เดิม) · คาบสอนวันนี้ · เกรดค้าง
    kpis.insertAdjacentHTML('beforeend',
      '<button type="button" class="k8-th-kpi" onclick="k8TtOpen()"><span class="k8-th-kpi-v"><b id="k8ThPerN">-</b></span><span class="k8-th-kpi-l">คาบสอนวันนี้</span></button>' +
      '<button type="button" class="k8-th-kpi is-hl" onclick="switchTeacherTab(\'grades\')"><span class="k8-th-kpi-v"><b id="k8ThGradeN">-</b></span><span class="k8-th-kpi-l">เกรดค้าง</span></button>');
    const att = kpis.querySelector('.k8-th-kpi'); if (att) { const l = att.querySelector('.k8-th-kpi-l'); if (l) att.appendChild(l); }
    const quick = document.createElement('nav'); quick.className = 'k8-th-quick'; quick.setAttribute('aria-label', 'ทางลัด');
    quick.innerHTML = [['check', 'เช็คชื่อ', "switchTeacherTab('attendance')", '#fffbeb', '#b45309'], ['tt', 'ตารางสอน', 'k8TtOpen()', '#eef2ff', '#4338ca'], ['doc', 'เอกสาร', 'k8DocsOpen()', '#ecfeff', '#0e7490'], ['hq', 'หะละเกาะฮฺ', 'k8HqOpen()', '#d1fae5', '#047857'], ['bh', 'พฤติกรรม', 'k8BhTeachOpen()', '#f3e8ff', '#6d28d9']]
      .map(([k, l, go, bg, ink]) => '<button type="button" onclick="' + go + '"><span style="background:' + bg + ';color:' + ink + '">' + svg(k) + '</span>' + l + '</button>').join('');
    hero.after(quick);
    setTimeout(() => { try { window.k8LvPlace && window.k8LvPlace(); } catch (e) {} }, 0);
    const tl = document.createElement('section'); tl.className = 'hf-card k8-th-tl'; tl.id = 'k8ThTl'; tl.setAttribute('aria-labelledby', 'k8ThTlTitle');
    quick.after(tl);
    // ปฏิทินโรงเรียนสัปดาห์นี้ (แบบเดียวกับหน้าแรกนักเรียน)
    const wk = document.createElement('section'); wk.className = 'hf-card hf-week k8-th-week'; wk.setAttribute('aria-label', 'ปฏิทินโรงเรียน สัปดาห์นี้');
    wk.innerHTML = '<div class="hf-week-head"><span class="hf-week-ttl"><span class="hf-week-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM16 3v4M8 3v4M3 11h18"/></svg></span><b>ปฏิทินโรงเรียน</b></span><button type="button" class="hf-week-all" onclick="switchTeacherTab(\'calendar\')">ดูทั้งเดือน ›</button></div>' +
      '<div class="hf-week-days" id="k8ThWeekDays"></div><button type="button" class="hf-week-next" id="k8ThWeekNext" onclick="switchTeacherTab(\'calendar\')"><span>ดูวันสำคัญและกิจกรรมทั้งเดือน</span></button>';
    tl.after(wk);
    setTimeout(() => { try { window.k8WeekCalRender && window.k8WeekCalRender(); } catch (e) {} }, 0);
    const todo = ov.querySelector('.k8-todo'); if (todo) { const h = todo.querySelector('h2'); if (h) h.textContent = 'ต้องทำ'; }
    return true;
  }

  function doneSubjects() {
    const today = ymd(new Date());
    return new Set(readJ('khalifah_attendance_logs', []).filter((r) => r && r.date === today && r.subjectCode).map((r) => String(r.subjectCode)));
  }
  function paint() {
    if (!build()) return;
    try { window.k8WeekCalRender && window.k8WeekCalRender(); } catch (e) {}
    // เกรดค้าง (วิชาที่เลือกในหน้าเกรด)
    try {
      const sel = document.getElementById('teacherPortalSubjectSelect'); const sid = sel && sel.value;
      const st = (typeof allStudents !== 'undefined' && Array.isArray(allStudents)) ? allStudents.filter((s) => !/ลาออก|สำเร็จ/.test(String(s.status || ''))) : [];
      let left = 0; if (sid) st.forEach((s) => { const g = s.subjectGrades && s.subjectGrades[sid]; if (!(g !== undefined && g !== null && g !== '' && Number(g) > 0)) left++; });
      let miss = 0; try { (window.k8GsModel ? window.k8GsModel() : []).forEach((c) => { if (c.g !== '?') c.rows.forEach((r) => { miss += Math.max(0, r.studs.length - r.done); }); }); } catch (e) { miss = sid ? left : 0; }
      document.getElementById('k8ThGradeN').textContent = miss; // v17.62 · นับเฉพาะนักเรียนในชั้นที่สอนจริงตามตารางสอน
    } catch (e) {}
    const list = window.k8TtMineToday ? window.k8TtMineToday() : null;
    const perN = document.getElementById('k8ThPerN'); if (perN) perN.textContent = list ? list.length : '-';
    const tl = document.getElementById('k8ThTl'); if (!tl) return;
    const head = '<div class="k8-th-tl-h"><h2 id="k8ThTlTitle">คาบสอนวันนี้</h2><button type="button" class="k8-th-tl-all" onclick="k8TtOpen()">ทั้งสัปดาห์ ›</button></div>';
    if (!list) { tl.innerHTML = head + '<p class="k8-th-tl-empty">กำลังโหลดตารางสอน…</p>'; return; }
    if (!list.length) { tl.innerHTML = head + '<p class="k8-th-tl-empty">วันนี้ไม่มีคาบสอน · ดูตารางทั้งสัปดาห์ได้ที่ปุ่มด้านบน</p>'; return; }
    const n = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); })();
    const done = doneSubjects();
    let focus = list.findIndex((x) => n < toMin(x.end)); // คาบที่กำลังสอนหรือถัดไป
    tl.innerHTML = head + '<ol class="k8-th-tl-list">' + list.map((x, i) => {
      const checked = x.c.s && done.has(String(x.c.s)); const past = n >= toMin(x.end); const now = toMin(x.start) <= n && n < toMin(x.end);
      const isFocus = i === focus;
      const mins = toMin(x.start) - n;
      const tag = now ? 'กำลังสอน' : (isFocus && mins <= 120 ? 'อีก ' + mins + ' นาที' : '');
      const meta = isFocus ? 'ห้อง ' + (x.c.r || '-') + ' · ' + x.start + '–' + x.end : (checked ? 'เช็คชื่อแล้ว' + (x.c.r ? ' · ห้อง ' + x.c.r : '') : (x.c.r ? 'ห้อง ' + x.c.r + ' · ' : '') + x.start + '–' + x.end);
      return '<li class="' + (isFocus ? 'is-focus ' : '') + (checked ? 'is-done ' : '') + (past && !checked && !isFocus ? 'is-past' : '') + '">' +
        '<span class="k8-th-tl-t">' + esc(x.start) + '</span><span class="k8-th-tl-dot" aria-hidden="true"></span>' +
        '<span class="k8-th-tl-c"><span class="k8-th-tl-row"><b>' + esc(x.c.sn) + ' · ม.' + esc(x.g) + '</b>' + (tag ? '<em>' + esc(tag) + '</em>' : '') + '</span><small>' + esc(meta) + '</small>' +
        (isFocus && !checked ? '<button type="button" class="k8-th-tl-go" onclick="switchTeacherTab(\'attendance\')">เช็คชื่อคาบนี้</button>' : '') + '</span></li>';
    }).join('') + '</ol>';
  }
  window.k8ThPaint = paint;
  const r0 = window.renderTeacherHomeV8;
  if (typeof r0 === 'function') window.renderTeacherHomeV8 = function () { const r = r0.apply(this, arguments); try { paint(); } catch (e) {} return r; };
  const stt = window.switchTeacherTab;
  if (typeof stt === 'function') window.switchTeacherTab = function (t) { const r = stt.apply(this, arguments); if (t === 'overview') { try { paint(); } catch (e) {} } return r; };
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) { const r = sv.apply(this, arguments); if (v === 'teacher') { try { paint(); if (window.k8TtLoad) window.k8TtLoad(); } catch (e) {} } return r; };
  document.addEventListener('k8-tt-loaded', () => { try { paint(); } catch (e) {} });
  setInterval(() => { const v = document.getElementById('view-teacher'); if (v && v.classList.contains('active')) { try { paint(); } catch (e) {} } }, 60000);
})();

/* ============ v12.5 · โหมดจอแคบ / ตัวอักษรใหญ่ (สำหรับผู้ที่ซูมหรือขยายตัวหนังสือ) ============
   เปิดอัตโนมัติเมื่อหน้าจอแคบกว่า 380px (เช่น ซูม 150–200%) หรือเมื่อเครื่องตั้งขนาดตัวอักษรใหญ่ */
(function () {
  function fontScale() {
    try {
      const p = document.createElement('span'); p.style.cssText = 'position:absolute;visibility:hidden;font-size:16px;line-height:1;'; p.textContent = 'ก';
      document.body.appendChild(p); const fs = parseFloat(getComputedStyle(p).fontSize) || 16; const h = p.getBoundingClientRect().height || 16; p.remove();
      return fs / 16;
    } catch (e) { return 1; }
  }
  let scale = 1;
  function apply() {
    // มือถือทั่วไปกว้าง 360–430px ต้องไม่เข้าโหมดนี้ · เข้าเฉพาะเมื่อซูมจนจอแคบจริงๆ หรือขยายตัวอักษรมาก
    const narrow = window.innerWidth < 340 || scale > 1.25;
    document.documentElement.classList.toggle('k8-narrow', narrow);
    document.documentElement.classList.toggle('k8-xnarrow', window.innerWidth < 280 || scale > 1.6);
  }
  const start = () => { scale = fontScale(); apply(); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.addEventListener('resize', apply);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', apply);
})();

/* v12.6 · เมนูแอดมิน: พับ/กางหมวด (จำค่าไว้ในเครื่อง) · หมวดของหน้าที่เปิดอยู่จะกางเสมอ */
(function () {
  const KEY = 'k8_nav_collapsed';
  const get = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const set = (a) => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} };
  function paint() {
    const c = get();
    document.querySelectorAll('#k8AdminNav .k8-nav-group[data-g]').forEach((g) => {
      const hasActive = !!g.querySelector('.admin-tab-btn.active');
      const col = c.indexOf(g.dataset.g) !== -1 && !hasActive;
      g.classList.toggle('is-collapsed', col);
      const h = g.querySelector('.k8-nav-gh'); if (h) h.setAttribute('aria-expanded', String(!col));
    });
  }
  window.k8NavGroup = function (btn) {
    const g = btn.closest('.k8-nav-group'); if (!g) return;
    const c = get().filter((x) => x !== g.dataset.g);
    if (!g.classList.contains('is-collapsed')) c.push(g.dataset.g);
    set(c);
    g.classList.toggle('is-collapsed'); btn.setAttribute('aria-expanded', String(!g.classList.contains('is-collapsed')));
  };
  const o = window.switchAdminTab;
  if (typeof o === 'function') window.switchAdminTab = function () { const r = o.apply(this, arguments); setTimeout(paint, 0); return r; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint); else paint();
})();

/* ============ v12.8 · แป้นตัวเลขในแอปสำหรับกรอกคะแนน + ช่องตัวเลขทั้งแอปเปิดแป้นตัวเลขของเครื่อง ============
   - ช่องคะแนน (หน้าเกรด) บนมือถือ/แท็บเล็ต: แสดงแป้นตัวเลขขนาดใหญ่ของแอปแทนแป้นพิมพ์เครื่อง
   - ช่องตัวเลขอื่นๆ: บอกเครื่องให้เปิดแป้นตัวเลข · ช่องข้อความ (เช่น ชื่อชิ้นงาน) ใช้แป้นพิมพ์ปกติของผู้ใช้ */
(function () {
  // 1) ช่องตัวเลขทั่วแอป → แป้นตัวเลขของเครื่อง
  function tune(root) {
    (root.querySelectorAll ? root.querySelectorAll('input[type="number"]:not([inputmode])') : []).forEach((el) => {
      const step = String(el.getAttribute('step') || ''); const dec = step.indexOf('.') !== -1 || step === 'any';
      el.setAttribute('inputmode', dec ? 'decimal' : 'numeric'); if (!dec && !(Number(el.min) < 0)) el.setAttribute('pattern', '[0-9]*');
    });
    (root.querySelectorAll ? root.querySelectorAll('input[type="tel"]:not([inputmode])') : []).forEach((el) => el.setAttribute('inputmode', 'tel'));
    (root.querySelectorAll ? root.querySelectorAll('#manualStudentIdInput:not([inputmode])') : []).forEach((el) => el.setAttribute('inputmode', 'numeric'));
  }
  const startTune = () => { tune(document); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) tune(n.parentNode || n); }))).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) startTune(); else document.addEventListener('DOMContentLoaded', startTune);

  // 2) แป้นตัวเลขในแอป สำหรับช่องคะแนน
  const touch = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
  const PREF = 'k8_numpad_off';
  const off = () => { try { return localStorage.getItem(PREF) === '1'; } catch (e) { return false; } };
  let pad = null, cur = null;
  const SEL = '#teacher-tab-grades input[data-sid][data-asg]';
  function build() {
    if (pad) return pad;
    pad = document.createElement('div'); pad.id = 'k8Numpad'; pad.className = 'k8-numpad'; pad.hidden = true; pad.setAttribute('role', 'group'); pad.setAttribute('aria-label', 'แป้นตัวเลข');
    const k = (v, l, cls, aria) => '<button type="button" data-k="' + v + '"' + (cls ? ' class="' + cls + '"' : '') + (aria ? ' aria-label="' + aria + '"' : '') + '>' + l + '</button>';
    pad.innerHTML = '<div class="k8-np-top"><span class="k8-np-t" id="k8NpT">-</span><button type="button" class="k8-np-kb" data-k="kb">ใช้แป้นของเครื่อง</button></div>' +
      '<div class="k8-np-keys">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => k(d, d)).join('') + k('.', '.', '', 'จุดทศนิยม') + k('0', '0') + k('bs', '⌫', 'is-del', 'ลบ') + '</div>' +
      '<div class="k8-np-act">' + k('clear', 'ล้าง', 'is-alt') + k('done', 'เสร็จ', 'is-alt') + k('next', 'ถัดไป ↓', 'is-next') + '</div>';
    pad.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) e.preventDefault(); }); // ไม่ให้ช่องกรอกหลุดโฟกัส
    pad.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-k]'); if (!b || !cur) return;
      const v = b.dataset.k; let s = cur.value || '';
      if (v === 'kb') { try { localStorage.setItem(PREF, '1'); } catch (e2) {} const el = cur; hide(); el.setAttribute('inputmode', 'decimal'); el.blur(); setTimeout(() => el.focus(), 60); if (typeof showToast === 'function') showToast('เปลี่ยนเป็นแป้นของเครื่องแล้ว · เปิดแป้นแอปได้อีกจากปุ่ม "แป้นตัวเลขแอป" ในหน้าเกรด', 'info'); return; }
      if (v === 'done') { cur.blur(); hide(); return; }
      if (v === 'next') { cur.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return; }
      if (v === 'bs') s = s.slice(0, -1); else if (v === 'clear') s = ''; else if (v === '.') { if (s.indexOf('.') === -1) s = (s || '0') + '.'; } else s = (s === '0' ? '' : s) + v;
      if (s.replace('.', '').length > 5) return;
      cur.value = s; cur.dispatchEvent(new Event('input', { bubbles: true }));
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e3) {} }
    });
    document.body.appendChild(pad); return pad;
  }
  function label(inp) {
    const row = inp.closest('tr, .tg-row, li'); let name = '';
    if (row) { const n = row.querySelector('.tg-grid-name b, .tg-row-name, b'); if (n) name = n.textContent.trim(); }
    const max = inp.dataset.max || inp.getAttribute('data-max') || '';
    let piece = ''; try { const chip = document.querySelector('#teacher-tab-grades .tg-chip[data-asg="' + CSS.escape(inp.dataset.asg) + '"]'); if (chip) piece = chip.childNodes[0].textContent.trim(); } catch (e) {}
    return (name || 'นักเรียน') + (piece ? ' · ' + piece : '') + (max ? ' (เต็ม ' + max + ')' : '');
  }
  function show(inp) {
    build(); cur = inp; pad.hidden = false; document.documentElement.classList.add('k8-np-open');
    document.getElementById('k8NpT').textContent = label(inp);
    document.querySelectorAll(SEL + '.k8-np-cur').forEach((x) => x.classList.remove('k8-np-cur')); inp.classList.add('k8-np-cur');
    setTimeout(() => { const r = inp.getBoundingClientRect(); const top = pad.getBoundingClientRect().top; if (r.bottom > top - 12 || r.top < 70) window.scrollBy({ top: r.bottom - top + 80, behavior: 'smooth' }); }, 30);
  }
  function hide() { if (pad) pad.hidden = true; document.documentElement.classList.remove('k8-np-open'); if (cur) cur.classList.remove('k8-np-cur'); cur = null; }
  document.addEventListener('focusin', (e) => {
    const inp = e.target.closest && e.target.closest(SEL);
    if (inp && touch() && !off()) { inp.setAttribute('inputmode', 'none'); show(inp); return; }
    if (pad && !pad.hidden && !(e.target.closest && e.target.closest('#k8Numpad'))) hide();
  });
  document.addEventListener('pointerdown', (e) => { if (pad && !pad.hidden && !e.target.closest('#k8Numpad') && !e.target.closest(SEL)) hide(); });
  const stt = window.switchTeacherTab; if (typeof stt === 'function') window.switchTeacherTab = function () { hide(); return stt.apply(this, arguments); };
  // ปุ่มเปิดแป้นตัวเลขแอปกลับมา (เมื่อผู้ใช้เคยเลือกใช้แป้นของเครื่อง)
  window.k8NumpadOn = function () { try { localStorage.removeItem(PREF); } catch (e) {} document.querySelectorAll(SEL).forEach((x) => x.setAttribute('inputmode', 'decimal')); if (typeof showToast === 'function') showToast('เปิดแป้นตัวเลขของแอปแล้ว · แตะช่องคะแนนเพื่อกรอก', 'success'); paintToggle(); };
  function paintToggle() {
    const note = document.querySelector('#teacher-tab-grades .tg-note-grid, #teacher-tab-grades .tg-mode-hdr'); if (!note || !touch()) return;
    let b = document.getElementById('k8NpOn');
    if (!off()) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.id = 'k8NpOn'; b.className = 'k8-np-on'; b.textContent = 'แป้นตัวเลขแอป'; b.onclick = window.k8NumpadOn; note.after(b); }
  }
  const r0 = window.renderTeacherPortalGradesTable;
  if (typeof r0 === 'function') window.renderTeacherPortalGradesTable = function () { const r = r0.apply(this, arguments); setTimeout(paintToggle, 0); return r; };
})();

/* ============ v13.0 · โหมดมืด / สว่าง / ตามเครื่อง (จำไว้ในเครื่อง) ============ */
(function () {
  const KEY = 'k8_theme';
  const get = () => { try { return localStorage.getItem(KEY) || 'light'; } catch (e) { return 'light'; } };
  const mq = (() => { try { return matchMedia('(prefers-color-scheme: dark)'); } catch (e) { return null; } })();
  function apply() {
    const m = get(); const dark = m === 'dark' || (m === 'auto' && mq && mq.matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', dark ? '#0b1220' : '#0284c7');
    paint();
  }
  const OPTS = [['light', 'สว่าง', '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'], ['dark', 'มืด', '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'], ['auto', 'ตามเครื่อง', '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/>']];
  function paint() {
    const m = get();
    document.querySelectorAll('[data-k8-theme]').forEach((box) => {
      box.setAttribute('role', 'radiogroup'); box.setAttribute('aria-label', 'ธีมแอป');
      box.innerHTML = OPTS.map(([k, l, p]) => '<button type="button" role="radio" aria-checked="' + (m === k) + '" aria-label="ธีม' + l + '" title="' + l + '" onclick="event.stopPropagation();k8ThemeSet(\'' + k + '\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg><span>' + l + '</span></button>').join('');
    });
  }
  window.k8ThemeSet = function (m) { try { localStorage.setItem(KEY, m); } catch (e) {} apply(); };
  if (mq) { const on = () => { if (get() === 'auto') apply(); }; if (mq.addEventListener) mq.addEventListener('change', on); else if (mq.addListener) mq.addListener(on); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();

/* v13.2 · เมนูซ้ายแอดมินติดจอ: ขยับขึ้นตามการเลื่อนหน้า ไม่เหลือช่องว่างด้านบน */
(function () {
  function fit() {
    const nav = document.getElementById('k8AdminNav'); if (!nav || window.innerWidth < 993) { if (nav) nav.style.top = ''; return; }
    const h = document.querySelector('.app-header'); const hh = h && h.offsetParent !== null ? h.getBoundingClientRect().bottom : 0;
    nav.style.top = Math.max(0, Math.round(hh)) + 'px';
  }
  window.addEventListener('scroll', fit, { passive: true }); window.addEventListener('resize', fit);
  const o = window.switchAdminTab; if (typeof o === 'function') window.switchAdminTab = function () { const r = o.apply(this, arguments); setTimeout(fit, 0); return r; };
  setTimeout(fit, 500);
})();

/* ---------- v13.4 · รูปโปรไฟล์อาจารย์ที่มุมขวาบน ---------- */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function photoOf(a) {
    if (!a) return '';
    let u = a.avatarUrl || a.photo || '';
    try { u = u || localStorage.getItem('khalifah_admin_avatar_' + a.username) || ''; } catch (e) {}
    try { if (u && typeof getDirectImageUrl === 'function' && !/^data:/.test(u)) u = getDirectImageUrl(u) || u; } catch (e) {}
    return u;
  }
  window.k8ThAvatarPaint = function () {
    let a = null; try { a = currentAdmin; } catch (e) {}
    const nm = a ? (a.fullName || a.username || 'อาจารย์') : 'อาจารย์';
    const ini = (String(nm).replace(/^(อ\.|อาจารย์|ครู|นาย|นางสาว|นาง)\s*/, '').trim().charAt(0)) || 'อ';
    const u = photoOf(a);
    ['k8ThAvatar', 'k8ThMenuPic', 'k8InspAvatar', 'k8InspMenuPic', 'k8AdmAvatar', 'k8NavMeAv'].forEach((id) => {
      const el = document.getElementById(id); if (!el) return;
      el.classList.toggle('has-photo', !!u);
      el.innerHTML = u ? '<img src="' + esc(u) + '" alt="" onerror="this.remove()">' : esc(ini);
    });
  };
  window.k8ThPickPhoto = function () { const i = document.getElementById('inputTeacherPhotoModal'); if (i) { i.value = ''; i.click(); } };
  const h = window.handleTeacherProfileUpload;
  if (typeof h === 'function') window.handleTeacherProfileUpload = function () {
    const r = h.apply(this, arguments);
    let n = 0; const t = setInterval(() => { window.k8ThAvatarPaint(); if (++n > 10) clearInterval(t); }, 300);
    return r;
  };
  document.addEventListener('DOMContentLoaded', () => window.k8ThAvatarPaint());
})();

/* ---------- v14.2 · เช็คชื่อละหมาดซุบฮิแทนนักเรียน (นักเรียนไม่มีโทรศัพท์ช่วงเช้ามืด) ---------- */
(function () {
  const ROLL_SLOT = 'ซุบฮิ';
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t) => { try { showToast(m, t || 'info'); } catch (e) {} };
  const nid = (v) => String(v || '').replace(/\D/g, '').replace(/^0+/, '');
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const gnum = (g) => { const m = String(g || '').match(/([1-6])/); return m ? m[1] : ''; };
  const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const ST = [['ontime', 'ตรงเวลา'], ['late', 'มาช้า'], ['absent', 'ไม่มา']];
  const R = { date: ymd(new Date()), grade: 'ALL', q: '', saved: {}, edits: {}, loading: false, saving: false, err: '', girls: false };

  const isSubuh = (t) => { try { return normalizePrayerSlotKey(t || '') === ROLL_SLOT; } catch (e) { return /ซุบฮิ|ศุบฮิ/.test(String(t || '')); } };
  // v17.16 · นักเรียนหญิง (ดูจากเพศ/คำนำหน้าชื่อ) เช็คชื่อซุบฮิเองตามปกติ · นักเรียนชายแอดมินเช็คให้
  const isGirl = (st) => { if (!st) return false; const g = String(st.gender || st.sex || ''); if (/หญิง|^f/i.test(g)) return true; if (/ชาย|^m/i.test(g)) return false; return /^\s*(นางสาว|น\.ส\.|นาง|เด็กหญิง|ด\.ญ\.)/.test(String(st.fullName || st.name || '')); };
  window.k8IsGirl = isGirl;
  const meGirl = () => { try { return isGirl(currentStudent); } catch (e) { return false; } };
  const rollForMe = (t) => isSubuh(t) && !meGirl();
  function students() {
    let all = []; try { all = allStudents || []; } catch (e) {}
    return all.filter((s) => s && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(s.status || '')) && (R.girls || !isGirl(s))).sort((a, b) => (gnum(a.grade) + String(a.fullName || '')).localeCompare(gnum(b.grade) + String(b.fullName || ''), 'th'));
  }
  const cur = (k) => (R.edits[k] !== undefined ? R.edits[k] : (R.saved[k] || ''));
  const dirtyN = () => Object.keys(R.edits).filter((k) => R.edits[k] !== (R.saved[k] || '')).length;
  const root = () => document.getElementById('k8PrAdmin');

  async function load() {
    R.loading = true; R.err = ''; render();
    try {
      const r = await gasApiCall('getPrayerRoll', { date: R.date, slot: ROLL_SLOT }, 25000);
      if (!r || !r.success) throw new Error((r && (r.message || r.error)) || 'โหลดไม่สำเร็จ');
      R.saved = {}; Object.keys(r.marks || {}).forEach((k) => { R.saved[k] = r.marks[k].status; });
    } catch (e) { R.err = /Unknown action|ไม่รู้จัก/i.test(String(e.message)) ? 'old' : 'net'; }
    R.loading = false; render();
  }

  function render() {
    const el = root(); if (!el) return;
    const list = students();
    const shown = list.filter((s) => (R.grade === 'ALL' || gnum(s.grade) === R.grade) && (!R.q || (String(s.fullName || '') + ' ' + s.studentId).toLowerCase().indexOf(R.q.toLowerCase()) !== -1));
    const cnt = { ontime: 0, late: 0, absent: 0, none: 0 };
    shown.forEach((s) => { const v = cur(nid(s.studentId)); cnt[v || 'none']++; });
    const d = new Date(R.date + 'T00:00:00');
    const today = R.date === ymd(new Date());
    const grades = ['ALL', '1', '2', '3', '4', '5', '6'];
    let girlsN = 0; try { girlsN = (allStudents || []).filter((x) => x && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(x.status || '')) && isGirl(x)).length; } catch (e) {}
    let h = '<header class="k8-pr-head"><div><h1>เช็คชื่อละหมาดซุบฮิ</h1><p>นักเรียนชายไม่มีโทรศัพท์ช่วงเช้ามืด · แอดมินเช็คชื่อแทน แล้วกราฟของนักเรียนจะแสดงตามนี้</p></div></header>' +
      (girlsN ? '<label class="k8-pr-girls"><input type="checkbox"' + (R.girls ? ' checked' : '') + ' onchange="k8PrGirls(this.checked)"><span>แสดงนักเรียนหญิงด้วย <small>(' + girlsN + ' คน · ปกติเช็คชื่อซุบฮิเองในแอป)</small></span></label>' : '') +
      '<section class="k8-pr-bar">' +
      '<div class="k8-pr-date"><button type="button" aria-label="วันก่อนหน้า" onclick="k8PrShift(-1)">‹</button><label><span>' + DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + (d.getFullYear() + 543) + (today ? ' · วันนี้' : '') + '</span><input type="date" value="' + R.date + '" max="' + ymd(new Date()) + '" onchange="k8PrDate(this.value)" aria-label="เลือกวันที่"></label><button type="button" aria-label="วันถัดไป" onclick="k8PrShift(1)"' + (today ? ' disabled' : '') + '>›</button></div>' +
      '<div class="k8-pr-grades" role="tablist">' + grades.map((g) => '<button type="button" role="tab" aria-selected="' + (R.grade === g) + '" onclick="k8PrGrade(\'' + g + '\')">' + (g === 'ALL' ? 'ทุกชั้น' : 'ม.' + g) + '</button>').join('') + '</div>' +
      '<input type="search" class="k8-pr-q" placeholder="ค้นหาชื่อหรือรหัสนักเรียน" value="' + esc(R.q) + '" oninput="k8PrQ(this.value)">' +
      '</section>';
    if (R.err === 'old') h += '<div class="k8-tt-warn" role="alert"><b>ระบบหลังบ้านยังไม่รองรับการเช็คชื่อซุบฮิ</b><span>กรุณา Deploy ไฟล์ Code.gs ตัวล่าสุด (Manage deployments → New version)</span></div>';
    else if (R.err === 'net') h += '<div class="k8-tt-warn" role="alert"><b>โหลดข้อมูลการเช็คไม่ได้</b><span>ตรวจสอบอินเทอร์เน็ต แล้วกด <button type="button" class="k8-bh-link" onclick="k8PrReload()">โหลดใหม่</button></span></div>';
    h += '<section class="k8-pr-sum" aria-label="สรุป">' +
      '<span class="is-ontime"><b>' + cnt.ontime + '</b>ตรงเวลา</span><span class="is-late"><b>' + cnt.late + '</b>มาช้า</span><span class="is-absent"><b>' + cnt.absent + '</b>ไม่มา</span><span class="is-none"><b>' + cnt.none + '</b>ยังไม่เช็ค</span></section>';
    if (cnt.none) h += '<button type="button" class="k8-pr-all" onclick="k8PrAll()">✓ คนที่ยังไม่เช็ค ' + cnt.none + ' คน · มาตรงเวลาทั้งหมด</button>';
    h += R.loading ? '<p class="k8-li-empty">กำลังโหลด…</p>' : (shown.length ? '<ul class="k8-pr-list">' + shown.map((s) => {
      const k = nid(s.studentId); const v = cur(k); const ch = R.edits[k] !== undefined && R.edits[k] !== (R.saved[k] || '');
      return '<li class="' + (v ? 'is-' + v : '') + (ch ? ' is-changed' : '') + '"><span class="k8-pr-who"><b>' + esc(s.fullName || k) + '</b><small>ม.' + esc(gnum(s.grade) || '-') + ' · ' + esc(s.studentId) + '</small></span><span class="k8-pr-seg" role="group" aria-label="สถานะของ ' + esc(s.fullName || k) + '">' +
        ST.map(([sv, sl]) => '<button type="button" class="is-' + sv + '" aria-pressed="' + (v === sv) + '" onclick="k8PrMark(\'' + k + '\',\'' + sv + '\')">' + sl + '</button>').join('') + '</span></li>';
    }).join('') + '</ul>' : '<p class="k8-li-empty">ไม่พบนักเรียน</p>');
    const n = dirtyN();
    h += '<div class="k8-bh-rsave k8-pr-save"' + (n ? '' : ' hidden') + ' role="status"><span><b>ยังไม่บันทึก ' + n + ' คน</b><small>กดบันทึกเพื่อส่งเข้าระบบ · นักเรียนจะเห็นในกราฟละหมาด</small></span><button type="button" onclick="k8PrSave()"' + (R.saving ? ' disabled' : '') + '>' + (R.saving ? 'กำลังบันทึก…' : 'บันทึก') + '</button></div>';
    const y = window.scrollY; el.innerHTML = h; if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
  }
  const confirmLeave = () => !dirtyN() || confirm('ยังมีการเช็คชื่อที่ไม่ได้บันทึก ' + dirtyN() + ' คน · ออกโดยไม่บันทึกใช่ไหม?');
  window.k8PrMark = function (k, v) { const c = cur(k); R.edits[k] = c === v ? '' : v; render(); };
  window.k8PrAll = function () { students().filter((s) => (R.grade === 'ALL' || gnum(s.grade) === R.grade) && (!R.q || (String(s.fullName || '') + ' ' + s.studentId).toLowerCase().indexOf(R.q.toLowerCase()) !== -1)).forEach((s) => { const k = nid(s.studentId); if (!cur(k)) R.edits[k] = 'ontime'; }); render(); };
  window.k8PrGrade = function (g) { R.grade = g; render(); };
  window.k8PrGirls = function (on) { R.girls = !!on; render(); };
  window.k8PrQ = function (v) { R.q = v; render(); const q = document.querySelector('.k8-pr-q'); if (q) { q.focus(); q.setSelectionRange(v.length, v.length); } };
  window.k8PrDate = function (v) { if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !confirmLeave()) { render(); return; } R.date = v; R.edits = {}; load(); };
  window.k8PrShift = function (n) { const d = new Date(R.date + 'T00:00:00'); d.setDate(d.getDate() + n); if (ymd(d) > ymd(new Date())) return; window.k8PrDate(ymd(d)); };
  window.k8PrReload = load;
  window.k8PrSave = async function () {
    const marks = {}; Object.keys(R.edits).forEach((k) => { if (R.edits[k] !== (R.saved[k] || '')) marks[k] = R.edits[k]; });
    if (!Object.keys(marks).length) return;
    R.saving = true; render();
    let r = null; try { r = await gasApiCall('savePrayerRoll', { data: { date: R.date, slot: ROLL_SLOT, marks } }, 45000); } catch (e) { r = { success: false, message: 'เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้ง' }; }
    R.saving = false;
    if (!r || !r.success) { toast((r && (r.message || r.error)) || 'บันทึกไม่สำเร็จ', 'error'); render(); return; }
    Object.keys(marks).forEach((k) => { if (marks[k]) R.saved[k] = marks[k]; else delete R.saved[k]; });
    R.edits = {};
    // อัปเดตประวัติในเครื่อง ให้หน้าละหมาด/กราฟของแอดมินเห็นทันที
    try {
      const key = 'khalifah_prayer_history'; const hist = JSON.parse(localStorage.getItem(key) || '[]');
      const ids = new Set((r.records || []).map((x) => x.logId));
      const kept = hist.filter((p) => !ids.has(p.logId || p.id));
      (r.records || []).filter((x) => !x.removed).forEach((x) => kept.push({ logId: x.logId, studentId: x.studentId, studentName: x.studentName || '', grade: x.grade || '', prayerTime: ROLL_SLOT, prayerName: ROLL_SLOT, date: R.date, time: '', status: x.status, note: 'เช็คชื่อโดยแอดมิน' }));
      localStorage.setItem(key, JSON.stringify(kept));
    } catch (e) {}
    toast(r.message || 'บันทึกแล้ว', 'success'); render();
  };
  const sat = window.switchAdminTab;
  if (typeof sat === 'function') window.switchAdminTab = function (tab) {
    const el = document.getElementById('admin-tab-prayer-roll');
    if (tab !== 'prayer-roll' && el && el.style.display === 'block' && !confirmLeave()) return;
    if (tab !== 'prayer-roll') R.edits = {};
    const r = sat.apply(this, arguments);
    if (tab === 'prayer-roll') { render(); load(); }
    return r;
  };

  // ---------- ฝั่งนักเรียน: ซุบฮิไม่ต้องบันทึกเอง ----------
  const note = 'ละหมาดซุบฮิ แอดมินเป็นผู้เช็คชื่อให้ ไม่ต้องบันทึกเอง';
  function paintNote() {
    let sel = null; try { sel = selectedPrayerTime; } catch (e) {}
    let el = document.getElementById('k8SubuhNote');
    const box = document.getElementById('cameraBox');
    if (!el && box) { el = document.createElement('div'); el.id = 'k8SubuhNote'; el.className = 'k8-subuh-note'; el.setAttribute('role', 'status'); el.innerHTML = '<b>ซุบฮิ · แอดมินเช็คชื่อให้</b><span>ช่วงเช้ามืดนักเรียนไม่ต้องถ่ายรูปบันทึกเอง ผลจะขึ้นในกราฟหลังแอดมินเช็คชื่อ (ตรงเวลา / มาช้า / ไม่มา)</span>'; box.parentNode.insertBefore(el, box); }
    const on = rollForMe(sel);
    if (el) el.hidden = !on;
    document.documentElement.classList.toggle('k8-subuh-roll', on);
  }
  const hp = window.handlePrayerMainButtonClick;
  if (typeof hp === 'function') window.handlePrayerMainButtonClick = function () { let sel = null; try { sel = selectedPrayerTime; } catch (e) {} if (rollForMe(sel)) { toast(note, 'info'); paintNote(); return; } return hp.apply(this, arguments); };
  const lr = window.submitPrayerLateApprovalRequest;
  if (typeof lr === 'function') window.submitPrayerLateApprovalRequest = function () { let sel = null; try { sel = selectedPrayerTime; } catch (e) {} if (rollForMe(sel)) { toast(note, 'info'); return; } return lr.apply(this, arguments); };
  const spt = window.selectPrayerTime;
  if (typeof spt === 'function') window.selectPrayerTime = function () { const r = spt.apply(this, arguments); try { paintNote(); } catch (e) {} return r; };
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) { const r = sv.apply(this, arguments); if (v === 'prayer') setTimeout(paintNote, 50); return r; };
  window.k8IsRollSlot = rollForMe;
})();

/* ---------- v14.2 · แตะรูปโปรไฟล์เพื่อดูภาพขนาดจริง ---------- */
(function () {
  function urlOf(el) {
    if (!el) return '';
    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
    if (img && img.src && !/^data:,|about:blank/.test(img.src)) return img.getAttribute('src');
    const bg = (el.style && el.style.backgroundImage) || ''; const m = bg.match(/url\(["']?(.*?)["']?\)$/);
    return m ? m[1] : '';
  }
  const SEL = '#hfPhoto, #k8ProfAv, #accSheetAvatar, #teacherModalAvatar, [data-k8-zoom]';
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest(SEL); if (!el) return;
    if (e.target.closest('label, input, .btn-avatar-upload')) return;
    const u = urlOf(el); if (!u) return;
    e.preventDefault(); e.stopPropagation();
    const name = el.getAttribute('aria-label') || el.getAttribute('title') || 'รูปโปรไฟล์';
    try { openPhotoViewerModal(u.replace(/#png$/i, ''), name); const h = document.getElementById('globalPhotoViewerTitle'); if (h) h.textContent = 'รูปโปรไฟล์'; } catch (er) {}
  }, true);
  const css = document.createElement('style');
  css.textContent = '#hfPhoto.has-img, #k8ProfAv:has(img), #accSheetAvatar:has(img), #teacherModalAvatar:has(img) { cursor: zoom-in; }';
  document.head.appendChild(css);
})();

/* ---- ช่องวันเกิดตอนสมัคร: ฟังทั้ง input/change/blur (iPhone, Samsung ส่งเหตุการณ์ไม่เหมือนกัน) ---- */
(function () {
  function bind() {
    const el = document.getElementById('k8RegBirth'); if (!el || el.dataset.k8b) return; el.dataset.k8b = '1';
    const t = new Date(); el.max = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); el.min = '1987-01-01';
    ['input', 'change', 'blur'].forEach((ev) => el.addEventListener(ev, () => { try { window.k8RegBirthChange(el.value); } catch (e) {} }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();

/* ---- สมัครอาจารย์: ดึงรายวิชาจริงของโรงเรียนจากระบบ (เครื่องใหม่ยังไม่มีรายวิชาในเครื่อง จะเห็นแค่วิชาตัวอย่าง) ---- */
(function () {
  let fetched = false;
  async function refreshSubjects() {
    if (fetched) return; fetched = true;
    try {
      const r = await gasApiCall('getSettings', {}, 15000);
      const raw = r && r.success && r.data && r.data.AppSubjects;
      const list = raw ? JSON.parse(raw) : null;
      if (Array.isArray(list) && list.length) {
        const checked = Array.from(document.querySelectorAll('input[name="regTeacherSubjChk"]:checked')).map((c) => c.value);
        localStorage.setItem('khalifah_subjects', JSON.stringify(list));
        try { appSubjects = list; } catch (e) {}
        if (typeof populateTeacherRegisterSubjectsChecklist === 'function') populateTeacherRegisterSubjectsChecklist();
        checked.forEach((v) => { const c = Array.from(document.querySelectorAll('input[name="regTeacherSubjChk"]')).find((x) => x.value === v); if (c) c.checked = true; });
      }
    } catch (e) { fetched = false; }
  }
  const o = window.populateTeacherRegisterSubjectsChecklist;
  if (typeof o === 'function') window.populateTeacherRegisterSubjectsChecklist = function () { const r = o.apply(this, arguments); setTimeout(refreshSubjects, 0); return r; };
  const t = window.toggleTeacherAuthForm;
  if (typeof t === 'function') window.toggleTeacherAuthForm = function (f) { const r = t.apply(this, arguments); if (f === 'register') refreshSubjects(); return r; };
})();

/* ---------- v15.0 · หน้านักเรียน (แอดมิน): แตะรายชื่อ → ป๊อปอัปกลางจอ · แตะคนอื่น → ปิดอันเดิม เปิดอันใหม่ ---------- */
(function () {
  function setup() {
    const det = document.getElementById('k8AsDetail'); if (!det || document.getElementById('k8AsModal')) return;
    const ov = document.createElement('div'); ov.className = 'modal-overlay k8-as-modal'; ov.id = 'k8AsModal';
    const dlg = document.createElement('div'); dlg.className = 'modal-dialog k8-as-pop'; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-label', 'รายละเอียดนักเรียน');
    const x = document.createElement('button'); x.type = 'button'; x.className = 'k8-as-popx'; x.setAttribute('aria-label', 'ปิด'); x.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    x.onclick = () => closeModal('k8AsModal');
    dlg.appendChild(x); dlg.appendChild(det); ov.appendChild(dlg); document.body.appendChild(ov);
    // แตะนอกป๊อปอัป: ปิดป๊อปอัป
    ov.addEventListener('click', (e) => {
      if (e.target !== ov) return;
      closeModal('k8AsModal'); // แตะนอกกรอบ = ปิดอย่างเดียว
    });
    // ปุ่มคำสั่งในป๊อปอัป (แก้ไข/ปรับสถานะ/ประวัติ/ลบ) เปิดหน้าต่างอื่น → ปิดป๊อปอัปก่อน
    det.addEventListener('click', (e) => { if (e.target.closest('.k8-as-acts button')) closeModal('k8AsModal'); }, true);
  }
  const sel = window.k8AsSelect;
  if (typeof sel === 'function') window.k8AsSelect = function () {
    setup();
    const r = sel.apply(this, arguments);
    const dlg = document.querySelector('#k8AsModal .k8-as-pop');
    if (dlg) { dlg.classList.remove('is-in'); void dlg.offsetWidth; dlg.classList.add('is-in'); }
    openModal('k8AsModal');
    return r;
  };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const m = document.getElementById('k8AsModal'); if (m && m.classList.contains('open')) closeModal('k8AsModal'); } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();

/* ---------- v15.1 · แอดมินดูแอปในมุมมองนักเรียน (โหมดดูตัวอย่าง อ่านอย่างเดียว) ---------- */
(function () {
  const KEY = 'k8_preview_stash';
  const stash = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const isPreview = () => { let s = null; try { s = currentStudent; } catch (e) {} return !!(stash() && s); };
  window.k8IsPreview = isPreview;
  window.k8PreviewStudent = async function (id, grade) {
    try { window.k8SimClear && window.k8SimClear(); } catch (e) {}
    let r = null; try { r = await gasApiCall('previewAsStudent', { data: { studentId: id || 'DEMO', grade: grade || '1' } }, 25000); } catch (e) { r = null; }
    if (!r || !r.success || !r.token) { try { showToast((r && (r.message || r.error)) || 'เปิดโหมดดูตัวอย่างไม่ได้ · Deploy Code.gs ตัวล่าสุดก่อน', 'error'); } catch (e) {} return; }
    try {
      localStorage.setItem(KEY, JSON.stringify({ admin: localStorage.getItem('khalifah_current_admin'), token: localStorage.getItem('khalifah_session_token'), role: localStorage.getItem('khalifah_auth_role'), view: (document.querySelector('.view-section.active') || {}).id === 'view-teacher' ? 'teacher' : 'admin', name: (r.student.fullName || id) + (r.student.studentId === 'DEMO' ? ' (' + String(r.student.grade || '').replace('มัธยมศึกษาปีที่ ', 'ม.') + ')' : ''), at: Date.now() }));
      localStorage.removeItem('khalifah_current_admin');
      localStorage.setItem('khalifah_current_student', JSON.stringify(r.student));
      localStorage.setItem('khalifah_session_token', r.token);
      localStorage.setItem('khalifah_auth_role', 'student');
    } catch (e) {}
    location.reload();
  };
  // เปิดโหมดดูตัวอย่างทันที ไม่ต้องเลือกนักเรียน (เลือกชั้นได้)
  window.k8PreviewDemo = function () {
    let ov = document.getElementById('k8PvDemo');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'k8PvDemo'; ov.className = 'modal-overlay'; ov.onclick = (e) => { if (e.target === ov) closeModal('k8PvDemo'); };
      ov.innerHTML = '<div class="modal-dialog k8-pvdemo" role="dialog" aria-label="ดูแอปแบบนักเรียน"><h2>ดูแอปแบบนักเรียน</h2><p>เปิดเป็นนักเรียนตัวอย่าง · กดอะไรก็ไม่บันทึกจริง<br>อยากดูของนักเรียนคนใด ให้เปิดจากหน้า "นักเรียน" แล้วแตะชื่อ</p><div class="k8-pvdemo-g">' +
        [1, 2, 3, 4, 5, 6].map((g) => '<button type="button" onclick="closeModal(\'k8PvDemo\');k8PreviewStudent(\'DEMO\',\'' + g + '\')">ม.' + g + '</button>').join('') + '</div><button type="button" class="k8-pvdemo-x" onclick="closeModal(\'k8PvDemo\')">ยกเลิก</button></div>';
      document.body.appendChild(ov);
    }
    openModal('k8PvDemo');
  };
  window.k8PreviewExit = function () {
    const st = stash(); if (!st) return;
    try { window.k8SimClear && window.k8SimClear(); } catch (e) {} // v17.70 · ล้างทุกอย่างที่กดในโหมดจำลอง
    try {
      localStorage.removeItem('khalifah_current_student');
      if (st.admin) localStorage.setItem('khalifah_current_admin', st.admin);
      if (st.token) localStorage.setItem('khalifah_session_token', st.token);
      localStorage.setItem('khalifah_auth_role', st.role || 'admin');
      localStorage.removeItem(KEY);
      sessionStorage.setItem('k8_after_preview', st.view || 'admin');
    } catch (e) {}
    location.reload();
  };
  function banner() {
    if (!isPreview()) { const b = document.getElementById('k8PvBar'); if (b) b.remove(); document.documentElement.classList.remove('k8-preview'); return; }
    document.documentElement.classList.add('k8-preview');
    if (document.getElementById('k8PvBar')) return;
    const b = document.createElement('div'); b.id = 'k8PvBar'; b.setAttribute('role', 'status');
    b.innerHTML = '<span><b>โหมดดูตัวอย่าง</b><small>เห็นแบบ ' + String(stash().name || 'นักเรียน').replace(/[<>&"]/g, '') + ' · กดได้ทุกปุ่มแบบจำลอง ไม่บันทึกจริง · ออกแล้วล้างทิ้ง</small></span><button type="button" onclick="k8PreviewExit()">กลับหน้าแอดมิน</button>';
    document.body.appendChild(b);
  }
  const block = (what) => { try { showToast('โหมดดูตัวอย่าง · ' + (what || 'ไม่ได้บันทึกจริง'), 'info'); } catch (e) {} };
  // กันการบันทึกในเครื่องของแอดมิน (ระบบหลังบ้านก็ปฏิเสธการเขียนจากโหมดนี้อยู่แล้ว)
  // v17.70 · โหมดจำลอง: กดตรวจพิกัด/ถ่ายรูป/ส่งคำขอได้เหมือนนักเรียนจริง แต่ไม่ส่งอะไรขึ้นระบบ (เก็บไว้ชั่วคราวจนออกจากโหมด)
  ['submitPrayerLateApprovalRequest', 'syncRecordToGoogleSheet', 'k8OutboxSend'].forEach((fn) => {
    const o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function () { if (isPreview()) { if (fn === 'submitPrayerLateApprovalRequest') block('จำลองส่งคำขอแล้ว · ไม่ได้ส่งถึงแอดมินจริง'); else if (fn === 'syncRecordToGoogleSheet') block('จำลองเท่านั้น · ไม่ได้บันทึกขึ้นระบบจริง'); return Promise.resolve({ success: true, preview: true }); } return o.apply(this, arguments); };
  });
  // v17.70 · จำลองเช็คละหมาด: ทุกเวลาเปิดให้กดได้ เพื่อให้แอดมินลองตรวจพิกัด/ถ่ายรูปได้ตลอด
  if (window.k8SimOn && typeof window.getPrayerSlotTimeStatus === 'function') {
    const orig = window.getPrayerSlotTimeStatus;
    window.getPrayerSlotTimeStatus = function () { const r = orig.apply(this, arguments) || {}; return Object.assign({}, r, { isPast: false, isFuture: false, isOpen: true, isActive: true, isCurrent: true, statusText: 'เปิดให้ลอง (จำลอง)' }); };
    setTimeout(() => { try { window.checkPrayerUnlockState && window.checkPrayerUnlockState(); window.refreshPrayerChipsStatus && window.refreshPrayerChipsStatus(); } catch (e) {} }, 500);
  }
  const lo = window.studentLogout;
  if (typeof lo === 'function') window.studentLogout = function () { if (stash()) { window.k8PreviewExit(); return; } return lo.apply(this, arguments); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(banner, 0)); else setTimeout(banner, 0);
  window.addEventListener('load', () => setTimeout(banner, 300));
})();

/* ---------- สิทธิ์โหมดดูตัวอย่าง: แอดมินสูงสุด หรือแอดมินที่ได้รับสิทธิ์ ---------- */
(function () {
  let P = null, loading = false;
  async function load() {
    if (loading) return; loading = true;
    try { const r = await gasApiCall('getPreviewAllowed', {}, 15000); if (r && r.success) P = r; } catch (e) {}
    loading = false; paint();
  }
  function paint() {
    const b = document.querySelector('#k8AsDetail .k8-as-preview'); if (!b) return;
    b.hidden = !(P && P.canPreview);
    let m = document.querySelector('#k8AsDetail .k8-as-pvperm');
    if (P && P.owner && !m) { m = document.createElement('button'); m.type = 'button'; m.className = 'k8-as-pvperm'; m.textContent = 'ให้สิทธิ์แอดมินคนอื่นใช้โหมดนี้'; m.onclick = openPerm; b.after(m); }
  }
  async function openPerm() {
    try { closeModal('k8AsModal'); } catch (e) {}
    let staff = []; try { staff = (subAdmins || []).filter((t) => t && t.username && /admin|super|ผู้ช่วย|ผู้บริหาร|executive/i.test(String(t.role || ''))); } catch (e) {}
    const on = new Set(((P && P.list) || []).map((x) => String(x).toLowerCase()));
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    let ov = document.getElementById('k8PvPerm');
    if (!ov) { ov = document.createElement('div'); ov.id = 'k8PvPerm'; ov.className = 'modal-overlay'; ov.onclick = (e) => { if (e.target === ov) closeModal('k8PvPerm'); }; document.body.appendChild(ov); }
    ov.innerHTML = '<div class="modal-dialog k8-sheet" role="dialog" aria-label="สิทธิ์โหมดดูตัวอย่าง"><header class="k8-sheet-head"><div><h2>สิทธิ์ดูแอปในมุมมองนักเรียน</h2><span>แอดมินสูงสุดใช้ได้เสมอ · เลือกแอดมินอื่นที่ให้ใช้ได้</span></div><button type="button" class="btn-icon" onclick="closeModal(\'k8PvPerm\')" aria-label="ปิด">✕</button></header><div class="k8-sheet-body">' +
      (staff.length ? staff.map((t) => '<label class="k8-tt-xl-chk"><input type="checkbox" value="' + esc(String(t.username).toLowerCase()) + '"' + (on.has(String(t.username).toLowerCase()) ? ' checked' : '') + '><span><b>' + esc(t.fullName || t.username) + '</b><small>' + esc(t.username) + ' · ' + esc(t.role || '') + '</small></span></label>').join('') : '<p class="k8-li-empty">ยังไม่มีบัญชีแอดมินอื่นในระบบ</p>') +
      '<div class="k8-dr-btns"><button type="button" onclick="k8PvPermSave()">บันทึกสิทธิ์</button></div></div></div>';
    openModal('k8PvPerm');
  }
  window.k8PvPermSave = async function () {
    const list = Array.from(document.querySelectorAll('#k8PvPerm input:checked')).map((c) => c.value);
    let r = null; try { r = await gasApiCall('savePreviewAllowed', { data: { list } }, 20000); } catch (e) {}
    if (r && r.success) { P = Object.assign({}, P, { list: r.list }); closeModal('k8PvPerm'); try { showToast('บันทึกสิทธิ์แล้ว', 'success'); } catch (e) {} } else { try { showToast((r && r.message) || 'บันทึกไม่สำเร็จ', 'error'); } catch (e) {} }
  };
  const sel = window.k8AsSelect;
  if (typeof sel === 'function') window.k8AsSelect = function () { const r = sel.apply(this, arguments); if (P) paint(); else load(); return r; };
  // ปุ่ม "นักเรียน" ที่แถบล่าง + เมนูแอดมิน: แสดงเฉพาะแอดมินที่มีสิทธิ์
  function navBtn() {
    let a = null; try { a = currentAdmin; } catch (e) {}
    const ok = !!(a && P && P.canPreview && !a.limited);
    const m = document.getElementById('m-nav-preview'); if (m) m.style.display = ok ? 'flex' : 'none';
    let d = document.getElementById('btnAdminTabPreview');
    if (!d) { const grp = document.querySelector('.k8-nav-group[data-g="main"] .k8-nav-items'); if (grp) { d = document.createElement('button'); d.className = 'admin-tab-btn'; d.id = 'btnAdminTabPreview'; d.type = 'button'; d.onclick = () => window.k8PreviewDemo(); d.innerHTML = '<svg class="k8-nav-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg> ดูแอปแบบนักเรียน'; grp.appendChild(d); } }
    if (d) { if (ok) d.style.removeProperty('display'); else d.style.setProperty('display', 'none', 'important'); }
  }
  const op = paint; paint = function () { op(); navBtn(); };
  function boot() { let a = null; try { a = currentAdmin; } catch (e) {} if (a) load(); else navBtn(); }
  const uav = window.updateAdminUIVisibility;
  if (typeof uav === 'function') window.updateAdminUIVisibility = function () { const r = uav.apply(this, arguments); setTimeout(boot, 0); return r; };
  if (document.readyState === 'complete') setTimeout(boot, 500); else window.addEventListener('load', () => setTimeout(boot, 500));
})();
(function () { let v = null; try { v = sessionStorage.getItem('k8_after_preview'); sessionStorage.removeItem('k8_after_preview'); } catch (e) {} if (v === 'teacher') window.addEventListener('load', () => setTimeout(() => { try { switchView('teacher'); } catch (e) {} }, 300)); })();

/* ---------- v15.4 · พิกัดเช็คชื่อละหมาด: แอดมินตั้งชื่อจุด ละติจูด ลองจิจูด รัศมี ---------- */
(function () {
  const CK = 'k8_geo_zones';
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t) => { try { showToast(m, t || 'info'); } catch (e) {} };
  // นำจุดจากระบบไปใช้กับการตรวจตำแหน่งในหน้าละหมาด
  function apply(zones) {
    if (!Array.isArray(zones) || !zones.length || typeof GEOFENCE_TARGETS === 'undefined') return;
    const main = zones.find((z) => z.main) || zones[0];
    Object.keys(GEOFENCE_TARGETS).forEach((k) => { delete GEOFENCE_TARGETS[k]; });
    GEOFENCE_TARGETS.MOSQUE = { name: main.name, lat: +main.lat, lng: +main.lng, radius: +main.radius };
    zones.forEach((z, i) => { if (z !== main) GEOFENCE_TARGETS['ZONE_' + i] = { name: z.name, lat: +z.lat, lng: +z.lng, radius: +z.radius }; });
  }
  function current() { try { return Object.values(GEOFENCE_TARGETS).map((t, i) => ({ name: t.name, lat: t.lat, lng: t.lng, radius: t.radius, main: i === 0 })); } catch (e) { return []; } }
  try { const c = JSON.parse(localStorage.getItem(CK) || 'null'); if (c) apply(c); } catch (e) {}
  async function refresh() {
    try { const r = await gasApiCall('getSettings', {}, 15000); const raw = r && r.success && r.data && r.data.GeoZones; if (raw) { const z = JSON.parse(raw); apply(z); localStorage.setItem(CK, JSON.stringify(z)); return z; } } catch (e) {}
    return null;
  }
  if (document.readyState === 'complete') setTimeout(refresh, 1500); else window.addEventListener('load', () => setTimeout(refresh, 1500));

  // ---------- หน้าแอดมิน ----------
  const G = { zones: null, dirty: false, map: null, layers: [], sel: 0, saving: false };
  const root = () => document.getElementById('k8GeoAdmin');
  function parseLatLng(v) {
    const s = String(v || '');
    let m = s.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) || s.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) || s.match(/(-?\d{1,3}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)/);
    return m ? { lat: +m[1], lng: +m[2] } : null;
  }
  function render() {
    const el = root(); if (!el) return;
    const zs = G.zones || [];
    el.innerHTML = '<header class="k8-geo-head"><h1>พิกัดเช็คชื่อละหมาด</h1><p>นักเรียนที่กดระบุตำแหน่งในหน้าละหมาด ถ้าอยู่ในวงรัศมีของจุดใด ระบบจะขึ้นชื่อจุดนั้น · จุดหลักใช้บอกระยะห่างเมื่ออยู่นอกทุกจุด</p></header>' +
      '<div class="k8-geo-mapwrap"><div class="k8-geo-map" id="k8GeoMap"><p class="k8-li-empty">กำลังโหลดแผนที่…</p></div><div class="k8-geo-hint" id="k8GeoHint"></div></div>' +
      '<div class="k8-geo-list">' + zs.map((z, i) => '<section class="k8-geo-card' + (i === G.sel ? ' is-sel' : '') + '" onclick="k8GeoSel(' + i + ',event)">' +
        '<div class="k8-geo-ch"><span class="k8-geo-no">' + (i + 1) + '</span><input type="text" class="k8-geo-name" value="' + esc(z.name) + '" placeholder="ชื่อจุด เช่น มัสยิดประจำโรงเรียน" maxlength="80" oninput="k8GeoSet(' + i + ',\'name\',this.value)">' + (z.main ? '<span class="k8-geo-main">จุดหลัก</span>' : '<button type="button" class="k8-geo-mk" onclick="k8GeoMain(' + i + ')">ตั้งเป็นจุดหลัก</button>') + '</div>' +
        '<div class="k8-geo-ll"><label><span>ละติจูด</span><input type="text" inputmode="decimal" value="' + esc(z.lat) + '" oninput="k8GeoSet(' + i + ',\'lat\',this.value)" onpaste="k8GeoPaste(' + i + ',event)"></label><label><span>ลองจิจูด</span><input type="text" inputmode="decimal" value="' + esc(z.lng) + '" oninput="k8GeoSet(' + i + ',\'lng\',this.value)"></label></div>' +
        '<label class="k8-geo-r"><span>รัศมี <b id="k8GeoR' + i + '">' + z.radius + '</b> เมตร</span><input type="range" min="5" max="300" step="1" value="' + Math.min(300, z.radius) + '" oninput="k8GeoSet(' + i + ',\'radius\',this.value)"><input type="number" min="5" max="2000" value="' + z.radius + '" class="k8-geo-rn" oninput="k8GeoSet(' + i + ',\'radius\',this.value)" aria-label="รัศมี (เมตร)"></label>' +
        '<div class="k8-geo-acts"><button type="button" onclick="k8GeoHere(' + i + ')">📍 ใช้ตำแหน่งปัจจุบันของฉัน</button><button type="button" onclick="k8GeoPasteAsk(' + i + ')">วางลิงก์ Google Maps</button><a href="https://www.google.com/maps?q=' + encodeURIComponent(z.lat + ',' + z.lng) + '" target="_blank" rel="noopener">เปิดใน Google Maps</a>' + (zs.length > 1 ? '<button type="button" class="is-del" onclick="k8GeoDel(' + i + ')">ลบจุดนี้</button>' : '') + '</div></section>').join('') + '</div>' +
      '<button type="button" class="k8-geo-add" onclick="k8GeoAdd()">+ เพิ่มจุดใหม่</button>' +
      '<div class="k8-bh-rsave"' + (G.dirty ? '' : ' hidden') + ' role="status"><span><b>ยังไม่ได้บันทึก</b><small>บันทึกแล้วนักเรียนจะใช้จุดใหม่ทันที</small></span><button type="button" onclick="k8GeoSave()"' + (G.saving ? ' disabled' : '') + '>' + (G.saving ? 'กำลังบันทึก…' : 'บันทึก') + '</button></div>';
    drawMap();
  }
  const dirty = () => { G.dirty = true; const b = document.querySelector('#k8GeoAdmin .k8-bh-rsave'); if (b) b.hidden = false; };
  window.k8GeoSel = function (i, e) { if (e && e.target.closest('input,button,a')) { if (G.sel !== i) { G.sel = i; document.querySelectorAll('.k8-geo-card').forEach((c, j) => c.classList.toggle('is-sel', j === i)); drawMap(); } return; } G.sel = i; document.querySelectorAll('.k8-geo-card').forEach((c, j) => c.classList.toggle('is-sel', j === i)); drawMap('fit'); const mp = document.getElementById('k8GeoMap'); if (mp) mp.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  window.k8GeoSet = function (i, k, v) {
    const z = G.zones[i]; if (!z) return;
    if (k === 'name') z.name = v; else if (k === 'radius') { z.radius = Math.max(5, Math.min(2000, parseInt(v, 10) || 5)); const b = document.getElementById('k8GeoR' + i); if (b) b.textContent = z.radius; const card = document.querySelectorAll('.k8-geo-card')[i]; if (card) { card.querySelectorAll('input[type=range],.k8-geo-rn').forEach((x) => { if (x !== document.activeElement) x.value = z.radius; }); } }
    else { const p = parseLatLng(v); if (p && k === 'lat' && /,/.test(v)) { z.lat = p.lat; z.lng = p.lng; render(); dirty(); return; } z[k] = v.trim(); }
    G.sel = i; dirty(); drawMap(k === 'radius' ? 'fit' : (k === 'lat' || k === 'lng') ? true : false);
  };
  window.k8GeoPaste = function (i, e) { const t = (e.clipboardData || window.clipboardData).getData('text'); const p = parseLatLng(t); if (p && /,|maps|@/.test(t)) { e.preventDefault(); Object.assign(G.zones[i], p); G.sel = i; dirty(); render(); } };
  window.k8GeoPasteAsk = function (i) { const t = prompt('วางลิงก์ Google Maps หรือพิกัด เช่น 6.5967, 101.3443', ''); if (!t) return; const p = parseLatLng(t); if (!p) { toast('อ่านพิกัดจากข้อความนี้ไม่ได้ · ลิงก์แบบย่อ (maps.app.goo.gl) ให้เปิดในเบราว์เซอร์ก่อน แล้วคัดลอกลิงก์เต็ม', 'warning'); return; } Object.assign(G.zones[i], p); G.sel = i; dirty(); render(); };
  window.k8GeoHere = function (i) {
    if (!navigator.geolocation) { toast('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง', 'warning'); return; }
    toast('กำลังหาตำแหน่ง… ยืนอยู่ตรงจุดที่ต้องการ', 'info');
    navigator.geolocation.getCurrentPosition((p) => { Object.assign(G.zones[i], { lat: Math.round(p.coords.latitude * 1e7) / 1e7, lng: Math.round(p.coords.longitude * 1e7) / 1e7 }); G.sel = i; dirty(); render(); toast('ได้ตำแหน่งแล้ว (คลาดเคลื่อนประมาณ ' + Math.round(p.coords.accuracy) + ' ม.)', 'success'); }, () => toast('หาตำแหน่งไม่ได้ · อนุญาตการเข้าถึงตำแหน่งก่อน', 'error'), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };
  window.k8GeoMain = function (i) { G.zones.forEach((z, j) => { z.main = j === i; }); dirty(); render(); };
  window.k8GeoDel = function (i) { if (!confirm('ลบจุด "' + G.zones[i].name + '" ใช่ไหม?')) return; const wasMain = G.zones[i].main; G.zones.splice(i, 1); if (wasMain && G.zones[0]) G.zones[0].main = true; G.sel = 0; dirty(); render(); };
  window.k8GeoAdd = function () { const c = G.map ? G.map.getCenter() : null; const b = G.zones[G.sel] || G.zones[0] || { lat: 6.5967, lng: 101.3443 }; G.zones.push({ name: '', lat: c ? Math.round(c.lat * 1e7) / 1e7 : b.lat, lng: c ? Math.round(c.lng * 1e7) / 1e7 : b.lng, radius: 30, main: !G.zones.length }); G.sel = G.zones.length - 1; dirty(); render(); const n = document.querySelectorAll('.k8-geo-name'); if (n.length) n[n.length - 1].focus(); };
  window.k8GeoSave = async function () {
    for (const z of G.zones) { if (!String(z.name || '').trim()) { toast('ตั้งชื่อทุกจุดก่อนบันทึก', 'warning'); return; } if (!isFinite(+z.lat) || !isFinite(+z.lng)) { toast('"' + z.name + '": ละติจูด/ลองจิจูดไม่ถูกต้อง', 'warning'); return; } }
    G.saving = true; render();
    let r = null; try { r = await gasApiCall('saveGeoZones', { data: { zones: G.zones.map((z) => ({ name: z.name, lat: +z.lat, lng: +z.lng, radius: +z.radius, main: !!z.main })) } }, 25000); } catch (e) {}
    G.saving = false;
    if (!r || !r.success) { toast((r && (r.message || r.error)) || 'บันทึกไม่สำเร็จ · Deploy Code.gs ตัวล่าสุดก่อน', 'error'); render(); return; }
    G.zones = r.zones; G.dirty = false; apply(r.zones); try { localStorage.setItem(CK, JSON.stringify(r.zones)); } catch (e) {}
    toast(r.message, 'success'); render();
  };
  // แผนที่ (Leaflet + OpenStreetMap) · โหลดไม่ได้ก็ยังกรอกพิกัดเองได้
  async function leaflet() {
    if (window.L && window.L.map) return window.L;
    if (!document.getElementById('k8LeafCss')) { const l = document.createElement('link'); l.id = 'k8LeafCss'; l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l); }
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); setTimeout(rej, 12000); });
    return window.L;
  }
  function setPoint(i, lat, lng) {
    const z = G.zones[i]; if (!z) return;
    z.lat = Math.round(lat * 1e7) / 1e7; z.lng = Math.round(lng * 1e7) / 1e7; dirty();
    const card = document.querySelectorAll('.k8-geo-card')[i]; if (card) { const ins = card.querySelectorAll('.k8-geo-ll input'); ins[0].value = z.lat; ins[1].value = z.lng; const a = card.querySelector('.k8-geo-acts a'); if (a) a.href = 'https://www.google.com/maps?q=' + encodeURIComponent(z.lat + ',' + z.lng); }
    drawMap();
  }
  async function drawMap(fly) {
    const box = document.getElementById('k8GeoMap'); if (!box) return;
    let L; try { L = await leaflet(); } catch (e) { box.innerHTML = '<p class="k8-li-empty">โหลดแผนที่ไม่ได้ · กรอกพิกัดหรือใช้ปุ่ม "ใช้ตำแหน่งปัจจุบันของฉัน" ได้ตามปกติ</p>'; return; }
    if (!G.map || G.map.getContainer() !== box) {
      box.innerHTML = ''; const z0 = G.zones[G.sel] || G.zones[0];
      G.map = L.map(box, { zoomControl: true }).setView([+z0.lat, +z0.lng], 18);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19, attribution: '© OpenStreetMap' }).addTo(G.map);
      G.map.on('click', (e) => setPoint(G.sel, e.latlng.lat, e.latlng.lng));
    }
    G.layers.forEach((l) => l.remove()); G.layers = [];
    let selCircle = null;
    G.zones.forEach((z, i) => {
      if (!isFinite(+z.lat) || !isFinite(+z.lng)) return;
      const on = i === G.sel;
      const c = L.circle([+z.lat, +z.lng], { radius: +z.radius, color: on ? '#0369a1' : '#64748b', weight: on ? 3 : 1.5, fillOpacity: on ? 0.2 : 0.08, dashArray: on ? null : '4 4' }).addTo(G.map);
      c.on('click', (e) => { if (i !== G.sel) { L.DomEvent.stop(e); window.k8GeoSel(i); } });
      G.layers.push(c);
      if (on) {
        selCircle = c;
        // หมุดของจุดที่เลือก: ลากเพื่อย้ายได้
        const pin = L.marker([+z.lat, +z.lng], { draggable: true, autoPan: true, title: 'ลากเพื่อย้ายจุด' }).addTo(G.map).bindTooltip((i + 1) + '. ' + (z.name || 'ยังไม่ตั้งชื่อ') + ' · ' + z.radius + ' ม.', { permanent: true, direction: 'top', offset: [0, -34] });
        pin.on('drag', (e) => { const p = e.target.getLatLng(); c.setLatLng(p); });
        pin.on('dragend', (e) => { const p = e.target.getLatLng(); setPoint(i, p.lat, p.lng); });
        G.layers.push(pin);
      } else {
        const m = L.circleMarker([+z.lat, +z.lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#64748b', fillOpacity: 1 }).addTo(G.map).bindTooltip((i + 1) + '. ' + (z.name || 'ยังไม่ตั้งชื่อ'), { direction: 'top', offset: [0, -8] });
        m.on('click', (e) => { L.DomEvent.stop(e); window.k8GeoSel(i); });
        G.layers.push(m);
      }
    });
    const z = G.zones[G.sel];
    const hint = document.getElementById('k8GeoHint'); if (hint && z) hint.innerHTML = '<b>จุดที่ ' + (G.sel + 1) + (z.name ? ' · ' + esc(z.name) : '') + '</b> · แตะบนแผนที่เพื่อวางจุด หรือลากหมุด · วงสีฟ้าคือรัศมี ' + z.radius + ' ม.';
    if (z && fly === 'fit' && selCircle) G.map.fitBounds(selCircle.getBounds(), { padding: [30, 30], maxZoom: 19 });
    else if (z && fly) G.map.setView([+z.lat, +z.lng], Math.max(G.map.getZoom(), 17));
    setTimeout(() => G.map && G.map.invalidateSize(), 50);
  }
  const sat = window.switchAdminTab;
  if (typeof sat === 'function') window.switchAdminTab = function (tab) {
    const el = document.getElementById('admin-tab-geo-zones');
    if (tab !== 'geo-zones' && el && el.style.display === 'block' && G.dirty && !confirm('ยังไม่ได้บันทึกพิกัด ออกโดยไม่บันทึกใช่ไหม?')) return;
    const r = sat.apply(this, arguments);
    if (tab === 'geo-zones') { G.zones = current(); G.dirty = false; G.sel = 0; G.map = null; render(); refresh().then((z) => { if (z && !G.dirty) { G.zones = z.map((x) => Object.assign({}, x)); G.map = null; render(); } }); }
    return r;
  };
})();

/* ---- รูปโปรไฟล์ทุกบทบาทบุคลากร (ผู้ตรวจการ ผู้บริหาร แอดมิน): ทาสีใหม่เมื่อเปลี่ยนหน้า/ล็อกอิน ---- */
(function () {
  const paint = () => { try { window.k8ThAvatarPaint && window.k8ThAvatarPaint(); } catch (e) {} };
  ['switchView', 'updateAdminUIVisibility'].forEach((fn) => { const o = window[fn]; if (typeof o === 'function') window[fn] = function () { const r = o.apply(this, arguments); setTimeout(paint, 0); return r; }; });
  window.addEventListener('load', () => setTimeout(paint, 400));
})();

/* ---------- v16.3 · ยืนยันรหัส 6 หลัก: มีภาพเคลื่อนไหวระหว่างตรวจสอบ / สำเร็จ / ผิด ---------- */
(function () {
  const orig = window.verifyRegistrationOtpCode;
  if (typeof orig !== 'function') return;
  let busy = false;
  const btn = () => document.querySelector('#otpVerifyModal .btn-primary.btn-block');
  const boxes = () => document.getElementById('k8OtpBoxes');
  const isOpen = () => { const m = document.getElementById('otpVerifyModal'); return !!(m && m.classList.contains('open')); };
  function done() {
    let o = document.getElementById('k8OtpOk');
    if (!o) { o = document.createElement('div'); o.id = 'k8OtpOk'; o.setAttribute('role', 'status'); o.innerHTML = '<div class="k8-otpok-c"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-15"/></svg><b>ยืนยันสำเร็จ</b><span>กำลังเข้าสู่ระบบ…</span></div>'; document.body.appendChild(o); }
    o.classList.remove('is-on'); void o.offsetWidth; o.classList.add('is-on');
    setTimeout(() => o.classList.remove('is-on'), 1500);
  }
  window.verifyRegistrationOtpCode = async function () {
    if (busy) return;
    const inp = document.getElementById('otpVerifyCodeInput');
    if (!/^\d{6}$/.test(String((inp && inp.value) || '').trim())) return orig.apply(this, arguments);
    busy = true;
    const b = btn(), bx = boxes(); const label = b ? b.innerHTML : '';
    if (b) { b.classList.add('is-checking'); b.disabled = true; b.innerHTML = '<span class="k8-otp-spin" aria-hidden="true"></span>กำลังตรวจสอบรหัส…'; }
    if (bx) { bx.classList.remove('is-bad', 'is-good'); bx.classList.add('is-checking'); }
    const t0 = Date.now(); let r;
    try { r = await orig.apply(this, arguments); } finally {
      const wait = Math.max(0, 700 - (Date.now() - t0)); // ให้เห็นว่าระบบตรวจสอบจริง
      await new Promise((res) => setTimeout(res, wait));
      if (bx) bx.classList.remove('is-checking');
      if (b) { b.classList.remove('is-checking'); b.disabled = false; b.innerHTML = label; }
      const ok = !isOpen() && !!(window.getSessionToken && getSessionToken());
      if (ok) done();
      else if (isOpen() && bx) { bx.classList.add('is-bad'); try { if (navigator.vibrate) navigator.vibrate([60, 40, 60]); } catch (e) {} setTimeout(() => bx.classList.remove('is-bad'), 700); }
      busy = false;
    }
    return r;
  };
})();

/* ---------- v16.5 · แอดมินเปิด/ปิดการประเมินอาจารย์ ---------- */
(function () {
  const V = { open: null, busy: false };
  const toast = (m, t) => { try { showToast(m, t || 'info'); } catch (e) {} };
  function render() {
    const el = document.getElementById('k8EvalAdmin'); if (!el) return;
    const on = V.open === true;
    el.innerHTML = '<header class="k8-geo-head"><h1>ประเมินอาจารย์ผู้สอน</h1><p>นักเรียนประเมินอาจารย์ได้เฉพาะตอนที่แอดมินเปิดระบบ · คำตอบไม่ระบุชื่อผู้ประเมิน</p></header>' +
      '<section class="k8-evad-card' + (on ? ' is-on' : '') + '"><div class="k8-evad-st"><span class="k8-evad-dot"></span><span><b>' + (V.open === null ? 'กำลังโหลดสถานะ…' : on ? 'เปิดให้ประเมินอยู่' : 'ปิดอยู่ · นักเรียนยังประเมินไม่ได้') + '</b><small>' + (on ? 'นักเรียนเห็นปุ่มประเมินและส่งคำตอบได้' : 'นักเรียนจะเห็นข้อความ "ยังไม่เปิดให้ประเมิน"') + '</small></span></div>' +
      '<button type="button" class="k8-evad-btn' + (on ? ' is-close' : '') + '" onclick="k8EvalAdminSet(' + (on ? 'false' : 'true') + ')"' + (V.busy || V.open === null ? ' disabled' : '') + '>' + (V.busy ? 'กำลังบันทึก…' : on ? 'ปิดการประเมิน' : 'เปิดให้นักเรียนประเมิน') + '</button></section>' +
      '<button type="button" class="k8-evad-sum" onclick="typeof k8EvalSummary===\'function\'&&k8EvalSummary()">ดูผลประเมินจากนักเรียน ›</button>';
  }
  async function load() {
    try { const r = await gasApiCall('getSettings', {}, 15000); if (r && r.success) V.open = String((r.data || {}).EvalOpen || '') === '1'; } catch (e) {}
    if (V.open === null) V.open = false; render();
  }
  window.k8EvalAdminSet = async function (on) {
    if (on === false && !confirm('ปิดการประเมินอาจารย์ใช่ไหม? นักเรียนจะส่งแบบประเมินไม่ได้จนกว่าจะเปิดอีกครั้ง')) return;
    V.busy = true; render();
    let r = null; try { r = await gasApiCall('setEvalOpen', { data: { open: !!on } }, 20000); } catch (e) {}
    V.busy = false;
    if (r && r.success) { V.open = r.open; toast(r.message, 'success'); } else toast((r && (r.message || r.error)) || 'บันทึกไม่สำเร็จ · Deploy Code.gs ตัวล่าสุดก่อน', 'error');
    render();
  };
  const sat = window.switchAdminTab;
  if (typeof sat === 'function') window.switchAdminTab = function (tab) { const r = sat.apply(this, arguments); if (tab === 'eval-admin') { render(); load(); } return r; };
})();

/* ---------- v16.6 · หมายเหตุละหมาดแบบใหม่: ไฮไลต์เหตุผลที่เลือก / สรุปบนปุ่มบันทึก ---------- */
(function () {
  const sync = () => {
    let n = 0; try { n = (selectedPrayerNoteTimeSlots || []).length; } catch (e) {}
    const sel = document.getElementById('prayerNoteTimeSelectedText'); if (sel && !n) sel.innerHTML = '';
    const sv = document.querySelector('.k8-pn-save'); if (sv) { if (sv.disabled) return; sv.textContent = n ? 'ส่งคำร้องให้แอดมิน · ' + (n === 5 ? 'ครบ 5 เวลา' : n + ' เวลา') : 'เลือกเวลาละหมาดก่อน'; sv.classList.toggle('is-off', !n); }
    const v = ((document.getElementById('prayerNoteInput') || {}).value || '');
    let any = false;
    document.querySelectorAll('.k8-pn-reasons .prayer-preset-btn:not(.k8-pn-other)').forEach((b) => { const t = (b.querySelector('b') || {}).textContent || ''; const key = b.dataset.key || t.split('/')[0].trim().replace('กำลังเดินทาง', 'เดินทาง'); const on = !!key && v.indexOf(key) !== -1; b.classList.toggle('is-on', on); if (on) any = true; });
    const ot = document.querySelector('.k8-pn-other'); const otherOn = !any && (otherMode || !!v.trim()); if (ot) ot.classList.toggle('is-on', otherOn);
    const s3 = document.getElementById('k8PnStep3'); if (s3) s3.innerHTML = otherOn ? 'ระบุเหตุผล <small class="k8-req">จำเป็น</small>' : 'รายละเอียด <small class="k8-opt">ไม่บังคับ</small>';
  };
  let otherMode = false;
  window.k8PnOther = function () {
    otherMode = true; const inp = document.getElementById('prayerNoteInput');
    if (inp) { inp.value = ''; inp.placeholder = 'พิมพ์เหตุผล เช่น ไปงานศพ, ช่วยงานที่บ้าน'; setTimeout(() => { inp.focus(); inp.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50); }
    try { updatePrayerNoteChipsUI(); } catch (e) {} sync();
  };
  const ap = window.applyPrayerNotePreset; if (typeof ap === 'function') window.applyPrayerNotePreset = function () { otherMode = false; return ap.apply(this, arguments); };
  const sv0 = window.savePrayerNoteOnly; if (typeof sv0 === 'function') window.savePrayerNoteOnly = function () { const inp = document.getElementById('prayerNoteInput'); if (otherMode && inp && !inp.value.trim()) { try { showToast('พิมพ์เหตุผลในข้อ 3 ก่อนบันทึก', 'warning'); } catch (e) {} inp.focus(); return; } return sv0.apply(this, arguments); };
  ['updatePrayerNoteChipsUI', 'applyPrayerNotePreset', 'togglePrayerNoteTime', 'selectAllPrayerNoteTimes', 'togglePrayerNotesCollapse'].forEach((fn) => { const o = window[fn]; if (typeof o === 'function') window[fn] = function () { const r = o.apply(this, arguments); setTimeout(sync, 0); return r; }; });
  document.addEventListener('input', (e) => { if (e.target && e.target.id === 'prayerNoteInput') sync(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync); else sync();
})();

/* ---------- v16.6 · ดูรูปขยาย: เหลือแค่รูป (แตะที่ไหนก็ได้เพื่อปิด) ---------- */
(function () {
  const m = () => document.getElementById('globalPhotoViewerModal');
  function setup() { const el = m(); if (!el || el.dataset.k8min) return; el.dataset.k8min = '1'; el.classList.add('k8-pv-min'); el.addEventListener('click', () => { if (history.state && history.state.k8pv) { history.back(); return; } try { closePhotoViewerModal(); } catch (er) {} }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
  // ปุ่มย้อนกลับของมือถือปิดรูปได้
  const o = window.openPhotoViewerModal;
  if (typeof o === 'function') window.openPhotoViewerModal = function () { setup(); const r = o.apply(this, arguments); try { history.pushState({ k8pv: 1 }, ''); } catch (e) {} return r; };
  window.addEventListener('popstate', () => { const el = m(); if (el && el.classList.contains('open')) { try { closePhotoViewerModal(); } catch (e) {} } });
})();

/* ---------- v17.2 · หมายเหตุละหมาด = คำร้องถึงแอดมิน (รวม "ลืมเช็คชื่อ") · แนบ/ถ่ายรูป · เลือกได้ทุกเวลา ---------- */
(function () {
  const P = { photo: '', src: '' };
  const toast = (m, t) => { try { showToast(m, t || 'info'); } catch (e) {} };
  const $ = (id) => document.getElementById(id);
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const thDate = (s) => { const d = new Date(s + 'T00:00:00'); if (isNaN(d)) return s; return d.getDate() + ' ' + TH_M[d.getMonth()] + ' ' + (d.getFullYear() + 543); };
  function dateLbl() {
    const inp = $('k8PnDate'), l = $('k8PnDateLbl'); if (!inp || !l) return;
    const t = ymd(new Date()), y = ymd(new Date(Date.now() - 864e5));
    l.textContent = inp.value === t ? 'วันนี้' : inp.value === y ? 'เมื่อวาน' : thDate(inp.value);
  }
  function initDate() {
    const inp = $('k8PnDate'); if (!inp) return;
    const now = new Date();
    inp.max = ymd(new Date(now.getTime() + 7 * 864e5));
    inp.min = ymd(new Date(now.getTime() - 30 * 864e5));
    if (!inp.value) inp.value = ymd(now);
    if (!inp.dataset.k8) { inp.dataset.k8 = '1'; inp.addEventListener('change', dateLbl); }
    dateLbl();
  }
  function mine() {
    const el = $('k8PnMineN'); if (!el) return;
    let n = 0; try { const sid = currentStudent && currentStudent.studentId; n = (getPrayerApprovalsList() || []).filter((r) => r.studentId === sid && String(r.status || 'pending').toLowerCase() === 'pending').length; } catch (e) {}
    el.textContent = n ? '· รออนุมัติ ' + n : '';
  }
  // ปุ่มบันทึก: บอกจำนวนเวลา
  function syncSave() {
    let n = 0; try { n = (selectedPrayerNoteTimeSlots || []).length; } catch (e) {}
    const sv = document.querySelector('.k8-pn-save');
    if (sv && !sv.disabled) { sv.textContent = n ? 'ส่งคำร้องให้แอดมิน · ' + (n === 5 ? 'ครบ 5 เวลา' : n + ' เวลา') : 'เลือกเวลาละหมาดก่อน'; sv.classList.toggle('is-off', !n); }
  }
  ['updatePrayerNoteChipsUI', 'togglePrayerNoteTime', 'selectAllPrayerNoteTimes', 'applyPrayerNotePreset', 'togglePrayerNotesCollapse'].forEach((fn) => { const o = window[fn]; if (typeof o === 'function') window[fn] = function () { const r = o.apply(this, arguments); setTimeout(() => { syncSave(); initDate(); mine(); }, 1); return r; }; });

  // เหตุผล "ลืมเช็คชื่อ"
  const ap = window.applyPrayerNotePreset;
  window.applyPrayerNotePreset = function (k) {
    if (k === 'forgot') {
      const inp = $('prayerNoteInput'); if (inp) inp.value = 'ละหมาดแล้วแต่ลืมกดเช็คชื่อ';
      const r = ap ? ap.call(this, '__none__') : null; // ให้ wrapper อื่นรีเซ็ตโหมด "อื่น ๆ"
      try { updatePrayerNoteChipsUI(); } catch (e) {}
      return r;
    }
    return ap ? ap.apply(this, arguments) : null;
  };
  // ไฮไลต์ปุ่มที่มี data-key
  function hlForgot() {
    const b = document.querySelector('.k8-pn-forgot'); if (!b) return;
    const v = (($('prayerNoteInput') || {}).value || '');
    const on = v.indexOf(b.dataset.key) !== -1; b.classList.toggle('is-on', on);
    if (on) { const o = document.querySelector('.k8-pn-other'); if (o) o.classList.remove('is-on'); const s3 = $('k8PnStep3'); if (s3) s3.innerHTML = 'รายละเอียด <small class="k8-opt">ไม่บังคับ</small>'; }
  }
  document.addEventListener('input', (e) => { if (e.target && e.target.id === 'prayerNoteInput') setTimeout(hlForgot, 0); });
  ['updatePrayerNoteChipsUI', 'applyPrayerNotePreset', 'k8PnOther'].forEach((fn) => { const o = window[fn]; if (typeof o === 'function') window[fn] = function () { const r = o.apply(this, arguments); setTimeout(hlForgot, 2); return r; }; });

  // ---- รูปหลักฐาน: ถ่ายรูป / แนบรูป ----
  window.k8PnPhoto = function (input, mode) {
    const f = input && input.files && input.files[0]; if (!f) return;
    if (!/^image\//.test(f.type || 'image/')) { toast('เลือกได้เฉพาะไฟล์รูปภาพ', 'warning'); input.value = ''; return; }
    // ถ่ายจากกล้องจริง = เปิดผ่านปุ่มถ่ายรูป และไฟล์เพิ่งถูกสร้าง (ภายใน 3 นาที)
    const fresh = f.lastModified && Math.abs(Date.now() - f.lastModified) < 3 * 60 * 1000;
    const src = mode === 'camera' && fresh ? 'camera' : 'gallery';
    const note = mode === 'camera' && !fresh ? 'รูปนี้ไม่ได้ถ่ายตอนนี้ ระบบจึงระบุว่าเป็นรูปแนบ' : '';
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1000; let w = img.width, h = img.height;
        if (w > h && w > max) { h = Math.round(h * max / w); w = max; } else if (h > max) { w = Math.round(w * max / h); h = max; }
        const bar = Math.max(30, Math.round(w * 0.06));
        const c = document.createElement('canvas'); c.width = w; c.height = h + bar;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0, w, h);
        const d = new Date();
        x.fillStyle = src === 'camera' ? '#0369a1' : '#b45309'; x.fillRect(0, h, w, bar);
        x.fillStyle = '#fff'; x.font = '600 ' + Math.round(bar * 0.5) + 'px "IBM Plex Sans Thai", sans-serif'; x.textBaseline = 'middle';
        x.fillText((src === 'camera' ? 'ถ่ายจากกล้อง' : 'แนบจากเครื่อง') + ' · ' + d.getDate() + ' ' + TH_M[d.getMonth()] + ' ' + (d.getFullYear() + 543) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' น.', Math.round(bar * 0.4), h + bar / 2);
        P.photo = c.toDataURL('image/jpeg', 0.72); P.src = src;
        const pv = $('k8PnPrev'), im = $('k8PnPrevImg'), s = $('k8PnSrc'), sn = $('k8PnSrcNote'), bt = $('k8PnPBtns');
        if (im) im.src = P.photo;
        if (s) { s.textContent = src === 'camera' ? '📷 ถ่ายจากกล้อง' : '🖼️ แนบจากเครื่อง'; s.className = 'k8-pn-src is-' + src; }
        if (sn) sn.textContent = note;
        if (pv) pv.hidden = false; if (bt) bt.hidden = true;
      };
      img.onerror = () => toast('เปิดรูปนี้ไม่ได้ ลองรูปอื่น', 'error');
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
    input.value = '';
  };
  window.k8PnPhotoClear = function () {
    P.photo = ''; P.src = '';
    const pv = $('k8PnPrev'), bt = $('k8PnPBtns'), im = $('k8PnPrevImg');
    if (pv) pv.hidden = true; if (bt) bt.hidden = false; if (im) im.removeAttribute('src');
  };

  // ---- ส่งคำร้อง (แทนการบันทึกตรง) ----
  let busy = false;
  window.savePrayerNoteOnly = async function () {
    if (busy) return;
    if (typeof currentStudent === 'undefined' || !currentStudent) { toast('กรุณาเข้าสู่ระบบนักเรียนก่อน', 'warning'); return; }
    if (typeof window.k8IsPreview === 'function' && window.k8IsPreview()) { toast('จำลอง · ส่งคำขอถึงแอดมินแล้ว · ไม่ได้ส่งจริง', 'info'); return; } // v17.70
    let slots = []; try { slots = (selectedPrayerNoteTimeSlots || []).slice(); } catch (e) {}
    if (!slots.length) { toast('เลือกเวลาละหมาดอย่างน้อย 1 เวลา', 'warning'); const g = document.querySelector('.k8-pn-times'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const inp = $('prayerNoteInput'); const reason = inp ? inp.value.trim() : '';
    if (!reason) { toast('เลือกเหตุผลในข้อ 1 หรือพิมพ์เหตุผลในข้อ 3', 'warning'); if (inp) inp.focus(); return; }
    initDate();
    const date = ($('k8PnDate') || {}).value || ymd(new Date());
    const KNOWN = ['ละหมาดแล้วแต่ลืมกดเช็คชื่อ', 'มีประจำเดือน / อุซุรทางศาสนา', 'ลาป่วย / มีไข้', 'กำลังเดินทาง (มุซาฟิร)', 'ละหมาดที่บ้าน', 'ญะมาอะฮ์แถวแรก'];
    const isKnown = KNOWN.indexOf(reason) !== -1;
    const preset = isKnown ? reason : 'อื่น ๆ';
    let list = []; try { list = getPrayerApprovalsList() || []; } catch (e) {}
    const sid = currentStudent.studentId;
    const dup = slots.filter((sl) => list.some((r) => r.studentId === sid && r.prayerSlot === sl && r.date === date && String(r.status || 'pending').toLowerCase() === 'pending'));
    const todo = slots.filter((sl) => dup.indexOf(sl) === -1);
    if (!todo.length) { toast('ส่งคำร้อง ' + dup.join(', ') + ' ของวันนี้ไปแล้ว · รอแอดมินตรวจสอบ', 'warning'); return; }
    const sv = document.querySelector('.k8-pn-save');
    busy = true; if (sv) { sv.disabled = true; sv.textContent = 'กำลังส่งคำร้อง…'; }
    let photo = P.photo, ok = 0, fail = 0; const src = P.photo ? P.src : '';
    const sub = new Date().toLocaleString('th-TH');
    for (let i = 0; i < todo.length; i++) {
      const item = {
        id: 'PREQ-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        studentId: sid, studentName: currentStudent.fullName || currentStudent.name || '-', grade: currentStudent.grade || '-',
        parentPhone: currentStudent.parentPhone || currentStudent.phone || '',
        prayerSlot: todo[i], date: date, reasonPreset: preset, reasonDetail: isKnown ? '' : reason,
        photoUrl: photo || '', photoSource: src, status: 'pending', createdAt: new Date().toISOString(), submittedAtFormatted: sub,
        approvedBy: null, approvedAt: null, rejectedBy: null, rejectedAt: null, adminNote: ''
      };
      let r = null; try { r = await gasApiCall('prayerLateRequest', { data: item }, 45000); } catch (e) { r = null; }
      if (r && r.success) { ok++; if (r.photoUrl) { photo = r.photoUrl; item.photoUrl = r.photoUrl; } if (r.photoSource) item.photoSourceLabel = r.photoSource; }
      else { fail++; try { syncRecordToGoogleSheet('prayerLateRequest', item); } catch (e) {} }
      // เก็บในเครื่อง (ไม่เก็บรูป base64 ขนาดใหญ่ซ้ำทุกเวลา)
      const local = Object.assign({}, item); if (/^data:/.test(local.photoUrl) && i > 0) local.photoUrl = '';
      list.unshift(local);
    }
    try { savePrayerApprovalsList(list); } catch (e) {}
    busy = false; if (sv) sv.disabled = false;
    try { selectAllPrayerNoteTimes(false); } catch (e) {}
    if (inp) inp.value = '';
    window.k8PnPhotoClear();
    try { updatePrayerNoteChipsUI(); } catch (e) {}
    syncSave(); mine();
    try { updateStudentPendingReqBadge(); } catch (e) {}
    try { refreshPrayerChipsStatus(); } catch (e) {}
    const msg = 'ส่งคำร้อง ' + todo.join(', ') + ' (' + thDate(date) + ') แล้ว · รอแอดมินอนุมัติ' + (dup.length ? ' · ข้าม ' + dup.join(', ') + ' (ส่งไปแล้ว)' : '');
    toast(fail && !ok ? 'ส่งไม่สำเร็จ ระบบจะลองส่งใหม่อัตโนมัติ' : msg, fail && !ok ? 'warning' : 'success');
  };

  // ปุ่ม/ลิงก์ "ลืมเช็คชื่อ" เดิม → เปิดการ์ดนี้แทนหน้าต่างแยก
  const olm = window.openPrayerLateApprovalModal;
  window.openPrayerLateApprovalModal = function (slot) {
    const card = $('prayerNotesCard');
    if (!card) return olm ? olm.apply(this, arguments) : null;
    try { if (typeof switchView === 'function' && !document.querySelector('#view-prayer.active, #view-prayer[style*="block"]')) switchView('prayer'); } catch (e) {}
    try { togglePrayerNotesCollapse(true); } catch (e) {}
    window.applyPrayerNotePreset('forgot');
    if (slot) { try { selectAllPrayerNoteTimes(false); togglePrayerNoteTime(slot); } catch (e) {} }
    setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const go = () => { initDate(); syncSave(); mine(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();

/* ---------- v17.4 · ตรวจการละหมาด 5 เวลา: การ์ดรายคน ดูง่ายทั้งคอมและมือถือ ---------- */
(function () {
  const V = { f: 'all', sort: 'low' };
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const jsq = (t) => String(t == null ? '' : t).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const SHORT = { 'ซุบฮิ': 'ซุบฮิ', 'ซุฮริ': 'ซุฮริ', 'อัศรฺ': 'อัศรฺ', 'มัฆริบ': 'มัฆริบ', 'อีชาอ์': 'อีชาอ์' };
  function kind(st) { st = String(st || ''); if (/อุซุร|ประจำเดือน|ป่วย|^ลา|ลากิจ|ลาหยุด/.test(st)) return 'ex'; if (/สาย|ช้า/.test(st)) return 'late'; if (/ไม่มา|ขาด/.test(st)) return 'abs'; return 'ok'; }
  function host() {
    let el = document.getElementById('k8PdWrap');
    if (el) return el;
    const tbl = document.getElementById('adminDailyPrayerMatrixTable'); if (!tbl) return null;
    const resp = tbl.closest('.table-responsive') || tbl.parentElement;
    el = document.createElement('div'); el.id = 'k8PdWrap'; el.className = 'k8-pd';
    resp.parentElement.insertBefore(el, resp);
    resp.classList.add('k8-pd-oldtbl');
    return el;
  }
  function render() {
    const el = host(); if (!el) return;
    let all = []; let map = {}; let slots = [];
    try { all = cachedDailyFilteredStudents || []; map = cachedDailyStudentPrayerMap || {}; slots = CANONICAL_PRAYERS || []; } catch (e) { return; }
    const q = ((document.getElementById('adminPrayerSearchInput') || {}).value || '').toLowerCase().trim();
    const cid = (v) => { try { return cleanIdString(v); } catch (e) { return String(v || '').trim(); } };
    const rows = all.map((s) => { const sid = cid(s.studentId); const p = map[sid] || {}; return { s: s, sid: sid, p: p, n: slots.filter((x) => p[x.key]).length }; });
    // v17.87 · ช่องที่หมดเวลาแล้วแต่ไม่ได้เช็ค (หลังสมัครใช้แอป) → กากบาทแดง ให้แอดมินเห็นชัด
    const pd = (n) => String(n).padStart(2, '0'); const nowD = new Date(); const todayS = nowD.getFullYear() + '-' + pd(nowD.getMonth() + 1) + '-' + pd(nowD.getDate()); const nowM = nowD.getHours() * 60 + nowD.getMinutes();
    const viewD = ((document.getElementById('adminPrayerDateSelect') || {}).value) || todayS;
    const regOf = (st) => { const v = String(st.registeredAt || st.registerDate || ''); let m = v.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) { const y = +m[1] > 2400 ? +m[1] - 543 : +m[1]; return y + '-' + m[2] + '-' + m[3]; } m = v.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) { const y = +m[3] > 2400 ? +m[3] - 543 : +m[3]; return y + '-' + pd(m[2]) + '-' + pd(m[1]); } return ''; };
    const endOf = (k) => { try { const w = PRAYER_TIME_WINDOWS.find((w) => (w.key || w.name) === k); return w ? w.endMin : 0; } catch (e) { return 0; } };
    const missed = (st, k) => { if (viewD > todayS) return false; const reg = regOf(st); if (reg && reg >= viewD) return false; if (viewD < todayS) return true; return nowM > endOf(k) && k !== 'อีชาอ์'; };
    const missN = {}; rows.forEach((r) => { missN[r.sid] = slots.filter((x) => !r.p[x.key] && missed(r.s, x.key)).length; });
    const cnt = { all: rows.length, full: rows.filter((r) => r.n === 5).length, part: rows.filter((r) => r.n > 0 && r.n < 5).length, zero: rows.filter((r) => r.n === 0).length };
    let list = rows.filter((r) => V.f === 'all' || (V.f === 'full' ? r.n === 5 : V.f === 'part' ? r.n > 0 && r.n < 5 : r.n === 0));
    if (q) list = list.filter((r) => String(r.s.fullName || '').toLowerCase().includes(q) || r.sid.toLowerCase().includes(q) || String(r.s.grade || '').toLowerCase().includes(q));
    if (V.sort === 'low') list.sort((a, b) => a.n - b.n || String(a.s.fullName || '').localeCompare(String(b.s.fullName || ''), 'th'));
    else if (V.sort === 'high') list.sort((a, b) => b.n - a.n || String(a.s.fullName || '').localeCompare(String(b.s.fullName || ''), 'th'));
    else list.sort((a, b) => a.sid.localeCompare(b.sid, 'th', { numeric: true }));
    // จำนวนต่อเวลา
    const per = slots.map((x) => rows.filter((r) => r.p[x.key]).length);
    const chip = (k, l, n) => '<button type="button" class="k8-pd-chip' + (V.f === k ? ' on' : '') + ' is-' + k + '" onclick="k8PdF(\'' + k + '\')">' + l + ' <b>' + n + '</b></button>';
    const card = (r) => {
      const s = r.s; const g = String(s.grade || '').match(/(\d)/);
      const av = s.avatarUrl ? (function () { try { return getDirectImageUrl(s.avatarUrl) || s.avatarUrl; } catch (e) { return s.avatarUrl; } })() : '';
      const boxes = slots.map((x) => {
        const rec = r.p[x.key];
        if (!rec) { const miss = missed(s, x.key); return '<button type="button" class="k8-pd-b ' + (miss ? 'is-miss' : 'is-none') + '" onclick="k8PeAdd(\'' + jsq(r.sid) + '\',\'' + jsq(x.key) + '\')" title="' + esc(x.label) + (miss ? ' · ไม่ได้เช็คชื่อ (หมดเวลาแล้ว)' : ' · ยังไม่เช็คชื่อ') + ' · แตะเพื่อบันทึกแทน"><small>' + esc(SHORT[x.key] || x.label) + '</small><i>' + (miss ? '✕' : '–') + '</i></button>'; }
        const k = kind(rec.status); const tm = String(rec.time || '').match(/(^|[^\d])(\d{1,2}):(\d{2})/); const t = tm ? tm[2].padStart(2, '0') + ':' + tm[3] : '✓';
        return '<button type="button" class="k8-pd-b is-' + k + '" onclick="openPrayerHistoryDetailModal(\'' + jsq(rec.id || rec.logId || '') + '\')" title="' + esc(x.label + ' · ' + (rec.status || '') + ' · ' + (rec.time || '')) + '"><small>' + esc(SHORT[x.key] || x.label) + '</small><i>' + (k === 'ex' ? 'ลา' : k === 'late' ? t : k === 'abs' ? '✕' : t) + '</i></button>';
      }).join('');
      return '<article class="k8-pd-card n' + r.n + '"><button type="button" class="k8-pd-who" onclick="adminSelectStudentForPrayerHistory(\'' + jsq(r.sid) + '\')" title="ดูประวัติรายคน">' +
        '<span class="k8-pd-av">' + (av ? '<img src="' + esc(av) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '<em>' + esc(String(s.fullName || '?').replace(/^(นางสาว|นาย|เด็กหญิง|เด็กชาย|ด\.ญ\.|ด\.ช\.)\s*/, '').charAt(0)) + '</em></span>' +
        '<span class="k8-pd-nm"><b>' + esc(s.fullName || r.sid) + '</b><small>' + esc(r.sid) + (g ? ' · ม.' + g[1] : '') + '</small></span>' +
        '<span class="k8-pd-n">' + r.n + '<small>/5</small></span></button><div class="k8-pd-row">' + boxes + '</div></article>';
    };
    el.innerHTML = '<div class="k8-pd-top"><div class="k8-pd-chips">' + chip('all', 'ทั้งหมด', cnt.all) + chip('zero', 'ยังไม่เช็คเลย', cnt.zero) + chip('part', 'ยังไม่ครบ', cnt.part) + chip('full', 'ครบ 5', cnt.full) + '</div>' +
      '<label class="k8-pd-sort"><span>เรียง</span><select onchange="k8PdS(this.value)"><option value="low"' + (V.sort === 'low' ? ' selected' : '') + '>เช็คน้อยก่อน</option><option value="high"' + (V.sort === 'high' ? ' selected' : '') + '>เช็คมากก่อน</option><option value="id"' + (V.sort === 'id' ? ' selected' : '') + '>รหัสนักเรียน</option></select></label></div>' +
      '<div class="k8-pd-per">' + slots.map((x, i) => '<span><small>' + esc(x.label) + '</small><b>' + per[i] + '</b><em>/' + rows.length + '</em></span>').join('') + '</div>' +
      '<div class="k8-pd-legend"><span class="is-ok">ตรงเวลา</span><span class="is-late">มาช้า</span><span class="is-ex">ลา/อุซุร</span><span class="is-miss">✕ หมดเวลา ไม่ได้เช็ค</span><span class="is-none">ยังไม่ถึงเวลา/ยังไม่เช็ค · แตะเพื่อบันทึกแทน</span></div>' +
      (list.length ? '<div class="k8-pd-grid">' + list.map(card).join('') + '</div>' : '<div class="k8-li-empty">ไม่มีนักเรียนในกลุ่มนี้</div>');
    const badge = document.getElementById('dailyTableTotalBadge'); if (badge) badge.textContent = 'แสดง ' + list.length + ' จาก ' + rows.length + ' คน';
  }
  window.k8PdF = function (f) { V.f = f; render(); };
  window.k8PdS = function (s) { V.sort = s; render(); };
  window.k8PdRender = render;
  const o = window.renderAdminPrayerDailyTable;
  if (typeof o === 'function') window.renderAdminPrayerDailyTable = function () { const r = o.apply(this, arguments); try { render(); } catch (e) { console.warn('k8pd', e); } return r; };
})();

/* ---------- v17.5 · เวลาละหมาดจริงแบบเรียลไทม์ (ต.เขาตูม อ.ยะรัง จ.ปัตตานี) + เกณฑ์มาสาย ---------- */
(function () {
  // พิกัดมัสยิดอัลฮารอมัยน์ มหาวิทยาลัยฟาฏอนี ต.เขาตูม อ.ยะรัง จ.ปัตตานี · เวลาไทย UTC+7
  const SLAT = 6.5967, SLNG = 101.3444, STZ = 7;
  // ฟัจร์ 20° · อีชาอ์ 18° · อัศรฺแบบชาฟิอี · บวกเผื่อ (อิห์ติยาฏ) 2 นาที (แบบที่ใช้ในภาคใต้/มาเลเซีย)
  const FAJR = 20, ISHA = 18, IHT = 2;
  const DEF_RULE = { fajr: '05:35', zuhr: '12:51', asr: '16:21', maghrib: '19:14', offset: 10 };
  const KEYS = ['ซุบฮิ', 'ซุฮริ', 'อัศรฺ', 'มัฆริบ', 'อีชาอ์'];
  const rad = (d) => d * Math.PI / 180, deg = (r) => r * 180 / Math.PI;
  const fixA = (a) => { a = a - 360 * Math.floor(a / 360); return a < 0 ? a + 360 : a; };
  const fixH = (a) => { a = a - 24 * Math.floor(a / 24); return a < 0 ? a + 24 : a; };
  const pad = (n) => String(n).padStart(2, '0');
  const hhmm = (m) => pad(Math.floor(((m % 1440) + 1440) % 1440 / 60)) + ':' + pad(((m % 1440) + 1440) % 1440 % 60);
  const toMin = (t) => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : NaN; };
  function julian(y, m, d) { if (m <= 2) { y -= 1; m += 12; } const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4); return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5; }
  function sun(jd) {
    const D = jd - 2451545.0, g = fixA(357.529 + 0.98560028 * D), q = fixA(280.459 + 0.98564736 * D);
    const L = fixA(q + 1.915 * Math.sin(rad(g)) + 0.020 * Math.sin(rad(2 * g))), e = 23.439 - 0.00000036 * D;
    const RA = deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15;
    return { decl: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L)))), eqt: q / 15 - fixH(RA) };
  }
  // v17.29 · loc = {lat,lng} ของนักเรียน (ตรวจพิกัดล่าสุดในหน้าเช็คละหมาด) · ไม่ระบุ = มัสยิด ต.เขาตูม
  function times(date, loc) {
    const d = date || new Date();
    const LAT = loc && isFinite(loc.lat) ? +loc.lat : SLAT, LNG = loc && isFinite(loc.lng) ? +loc.lng : SLNG;
    const TZ = loc ? -d.getTimezoneOffset() / 60 : STZ;
    const jd = julian(d.getFullYear(), d.getMonth() + 1, d.getDate()) - LNG / (15 * 24);
    const mid = (t) => fixH(12 - sun(jd + t).eqt);
    const ang = (a, t, ccw) => { const s = sun(jd + t), n = mid(t); const v = deg(Math.acos((-Math.sin(rad(a)) - Math.sin(rad(s.decl)) * Math.sin(rad(LAT))) / (Math.cos(rad(s.decl)) * Math.cos(rad(LAT))))) / 15; return n + (ccw ? -v : v); };
    const asrT = (f, t) => { const s = sun(jd + t); const a = -deg(Math.atan(1 / (f + Math.tan(rad(Math.abs(LAT - s.decl)))))); return ang(a, t, false); };
    // ทำ 2 รอบให้ค่าแม่นขึ้น
    let r = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
    for (let i = 0; i < 2; i++) {
      r = { fajr: ang(FAJR, r.fajr / 24, true), sunrise: ang(0.833, r.sunrise / 24, true), dhuhr: mid(r.dhuhr / 24), asr: asrT(1, r.asr / 24), maghrib: ang(0.833, r.maghrib / 24, false), isha: ang(ISHA, r.isha / 24, false) };
    }
    const adj = (h) => h + TZ - LNG / 15;
    const out = {};
    Object.keys(r).forEach((k) => { const m = adj(r[k]) * 60; out[k] = k === 'sunrise' ? Math.floor(m) - IHT : Math.ceil(m) + IHT; });
    return out; // นาทีนับจาก 00:00
  }
  let RULE = Object.assign({}, DEF_RULE);
  try { const v = JSON.parse(localStorage.getItem('khalifah_prayer_late_rule') || 'null'); if (v) RULE = Object.assign({}, DEF_RULE, v); } catch (e) {}
  // v17.19 · มัฆริบมีเวลาสายตายตัว (เช่น 19:14) → ช่วงเช็คมัฆริบยืดถึงเวลานั้น และอีชาอ์เริ่มหลังจากนั้น
  function bounds(t) {
    const m = toMin(RULE.maghrib);
    const mEnd = isNaN(m) ? t.isha - 1 : Math.max(t.isha - 1, m);
    return { mEnd: mEnd, iStart: Math.max(t.isha, mEnd + 1) };
  }
  function cutoffs(date, loc) {
    const t = times(date, loc), off = Math.max(0, Math.min(120, parseInt(RULE.offset, 10) || 0));
    const f = toMin(RULE.fajr), z = toMin(RULE.zuhr), a = toMin(RULE.asr), m = toMin(RULE.maghrib), b = bounds(t);
    // v17.29 · เข้าเวลาแล้วเช็คชื่อ = ตรงเวลาเสมอ (กันกรณีที่อื่นเข้าเวลาช้ากว่าเกณฑ์ตายตัว)
    const fx = (v, s) => isNaN(v) ? s + off : Math.max(v, s + off);
    return { 'ซุบฮิ': fx(f, t.fajr), 'ซุฮริ': fx(z, t.dhuhr), 'อัศรฺ': fx(a, t.asr), 'มัฆริบ': fx(m, t.maghrib), 'อีชาอ์': b.iStart + off };
  }
  // ---- พิกัดของนักเรียน (บันทึกทุกครั้งที่กด "ตรวจพิกัด" ในหน้าเช็คละหมาด) ----
  const LOC_KEY = 'khalifah_prayer_loc', NEAR_KM = 3;
  const km = (a, b, c, d) => { const R = 6371, x = rad(c - a), y = rad(d - b); const h = Math.sin(x / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const isStu = () => { let st = null, ad = null; try { st = currentStudent; } catch (e) {} try { ad = currentAdmin; } catch (e) {} return !!st && !ad; };
  function readLoc() { try { const v = JSON.parse(localStorage.getItem(LOC_KEY) || 'null'); return v && isFinite(v.lat) && isFinite(v.lng) ? v : null; } catch (e) { return null; } }
  // null = ใช้เวลาของ ต.เขาตูม (อยู่โรงเรียน/ใกล้โรงเรียน หรือยังไม่เคยตรวจพิกัด)
  function myLoc() { if (!isStu()) return null; const v = readLoc(); if (!v) return null; return km(SLAT, SLNG, v.lat, v.lng) <= NEAR_KM ? null : v; }
  window.k8MyPrayerLoc = myLoc;
  window.k8PrayerPlace = function () { const v = myLoc(); if (!v) return 'ต.เขาตูม อ.ยะรัง จ.ปัตตานี'; return v.name || ('พิกัดของคุณ · ห่างโรงเรียน ' + (Math.round(km(SLAT, SLNG, v.lat, v.lng) * 10) / 10) + ' กม.'); };
  const shortTh = (t) => String(t || '').replace(/^ตำบล\s*/, 'ต.').replace(/^แขวง\s*/, 'แขวง').replace(/^อำเภอ\s*/, 'อ.').replace(/^เขต\s*/, 'เขต').replace(/^จังหวัด\s*/, 'จ.').trim();
  function placeName(v) {
    if (!v || km(SLAT, SLNG, v.lat, v.lng) <= NEAR_KM) return;
    try {
      fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=th&lat=' + v.lat + '&lon=' + v.lng).then((r) => r.json()).then((j) => {
        const a = (j && j.address) || {};
        const t = shortTh(a.suburb || a.village || a.town || a.hamlet || a.quarter || ''), am = shortTh(a.county || a.city_district || a.district || a.city || ''), pv = shortTh(a.state || a.province || '');
        const name = [t, am, pv].filter(Boolean).filter((x, i, arr) => arr.indexOf(x) === i).join(' ');
        const cur = readLoc(); if (!name || !cur || cur.lat !== v.lat || cur.lng !== v.lng) return;
        cur.name = name; try { localStorage.setItem(LOC_KEY, JSON.stringify(cur)); } catch (e) {}
        try { window.renderHomeF && window.renderHomeF(); } catch (e) {}
      }).catch(() => {});
    } catch (e) {}
  }
  window.k8SavePrayerLoc = function (lat, lng) {
    if (!isFinite(lat) || !isFinite(lng) || !isStu()) return;
    const old = readLoc(); const same = old && km(old.lat, old.lng, lat, lng) < 1;
    const v = { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, at: new Date().toISOString(), name: same ? old.name : '' };
    try { localStorage.setItem(LOC_KEY, JSON.stringify(v)); } catch (e) {}
    if (!v.name) placeName(v);
    window.k8PtApply(); try { window.updatePrayerV8 && window.updatePrayerV8(); } catch (e) {} try { window.renderHomeF && window.renderHomeF(); } catch (e) {}
  };
  const ff = window.fetchFreshPrayerLocation;
  if (typeof ff === 'function') window.fetchFreshPrayerLocation = function () {
    const pr = ff.apply(this, arguments);
    try { pr.then(() => { let v = null; try { v = verifiedLocation; } catch (e) {} if (v) window.k8SavePrayerLoc(+v.lat, +v.lng); }).catch(() => {}); } catch (e) {}
    return pr;
  };
  // อิกอมะฮ์: ซุฮริ 12:40 · อัศรฺ 16:10 (ตายตัวทุกวัน) · เวลาอื่น = อะซาน + 10 นาที
  const IQ_FIX = { 'ซุฮริ': 12 * 60 + 40, 'อัศรฺ': 16 * 60 + 10 };
  window.k8PrayerDay = function (date) {
    const d = date || new Date(), loc = myLoc(), t = times(d, loc), bd = bounds(t), c = cutoffs(d, loc);
    const adhan = [t.fajr, t.dhuhr, t.asr, t.maghrib, t.isha];
    return KEYS.map((k, i) => ({ key: k, adhan: adhan[i], iqamah: IQ_FIX[k] != null ? Math.max(IQ_FIX[k], adhan[i]) : adhan[i] + 10, cutoff: c[k], start: [t.fajr, t.dhuhr, t.asr, t.maghrib, bd.iStart][i], end: [t.sunrise, t.asr - 1, t.maghrib - 1, bd.mEnd, 23 * 60 + 59][i] }));
  };
  window.k8PrayerTimes = times;
  window.k8LateCutoffs = cutoffs;
  const norm = (k) => { try { return normalizePrayerSlotKey(k); } catch (e) { return k; } };
  window.k8IsLateNow = function (slot, at) {
    const now = at || new Date(), cur = now.getHours() * 60 + now.getMinutes(), k = norm(slot);
    const c = cutoffs(now, myLoc())[k]; if (c == null) return false;
    if (k === 'อีชาอ์' && cur < 12 * 60) return true; // หลังเที่ยงคืนถือว่าสาย
    return cur > c;
  };
  window.k8PrayerStatusNow = function (slot) { return window.k8IsLateNow(slot) ? 'มาสาย' : 'ตรงเวลา (ญะมาอะฮ์/มัสยิด)'; };
  // ช่วงเวลาเช็คชื่อ = เวลาละหมาดจริงของวันนี้
  window.k8PtApply = function () {
    let t; try { t = times(new Date(), myLoc()); } catch (e) { return; }
    const bd = bounds(t);
    const W = [[t.fajr, t.sunrise], [t.dhuhr, t.asr - 1], [t.asr, t.maghrib - 1], [t.maghrib, bd.mEnd], [bd.iStart, 23 * 60 + 59]];
    try {
      PRAYER_TIME_WINDOWS.forEach((w, i) => { w.startMin = W[i][0]; w.endMin = W[i][1]; w.baseLabel = hhmm(W[i][0]) + ' - ' + hhmm(W[i][1]) + ' น.'; try { if (CANONICAL_PRAYERS[i]) CANONICAL_PRAYERS[i].range = w.baseLabel; } catch (e) {} });
    } catch (e) {}
    const c = cutoffs(new Date(), myLoc());
    const sum = document.getElementById('k8PwSummary');
    if (sum) sum.textContent = 'เวลาจริง ' + (window.k8PrayerPlace ? window.k8PrayerPlace() : 'ต.เขาตูม') + ' · ' + KEYS.map((k, i) => k + ' ' + hhmm(W[i][0])).join(' · ');
    return { windows: W, cutoffs: c };
  };
  window.k8PtApply();
  let lastDay = new Date().getDate();
  setInterval(() => { const d = new Date().getDate(); if (d !== lastDay) { lastDay = d; window.k8PtApply(); try { window.updatePrayerV8 && window.updatePrayerV8(); } catch (e) {} } }, 60000);

  // โหลดเกณฑ์สายจากแอดมิน
  function loadRule() {
    try {
      const url = (typeof getGasUrl === 'function') ? getGasUrl() : ''; if (!url) return;
      fetch(url + (url.indexOf('?') === -1 ? '?' : '&') + 'action=getSettings&_t=' + Date.now()).then((r) => r.json()).then((j) => {
        let v = null; try { v = j && j.data && j.data.PrayerLateRule ? JSON.parse(j.data.PrayerLateRule) : null; } catch (e) {}
        RULE = Object.assign({}, DEF_RULE, v || {});
        try { localStorage.setItem('khalifah_prayer_late_rule', JSON.stringify(RULE)); } catch (e) {}
        window.k8PtApply(); try { window.updatePrayerV8 && window.updatePrayerV8(); } catch (e) {}
      }).catch(() => {});
    } catch (e) {}
  }
  setTimeout(loadRule, 2200);

  // หน้าเช็คชื่อ: บอก "สายหลัง HH:MM"
  const up = window.updatePrayerV8;
  if (typeof up === 'function') window.updatePrayerV8 = function () {
    const r = up.apply(this, arguments);
    try {
      const sub = document.getElementById('k8PrSub'); if (!sub) return r;
      let slot = ''; try { slot = selectedPrayerTime; } catch (e) {}
      const k = norm(slot || ''); const c = cutoffs(new Date(), myLoc())[k];
      if (c != null) {
        const late = window.k8IsLateNow(k);
        let tag = sub.querySelector('.k8-pt-late'); if (!tag) { tag = document.createElement('span'); tag.className = 'k8-pt-late'; sub.appendChild(tag); }
        tag.textContent = late ? ' · เลย ' + hhmm(c) + ' น. แล้ว (นับว่ามาสาย)' : ' · สายหลัง ' + hhmm(c) + ' น.';
        tag.classList.toggle('is-late', late);
      }
    } catch (e) {}
    return r;
  };

  // แอดมิน: หน้าต่าง "ช่วงเวลาละหมาด" → แสดงเวลาจริงวันนี้ + ตั้งเกณฑ์สาย
  window.k8PwOpen = function () {
    const body = document.getElementById('k8PwBody'); if (!body) return;
    const t = window.k8PtApply() || {}; const W = t.windows || [], C = t.cutoffs || {};
    const d = new Date(), M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const tt = document.getElementById('k8PwTitle'); if (tt) tt.textContent = 'เวลาละหมาด & เกณฑ์มาสาย';
    body.innerHTML = '<p class="k8-pw-hint">เวลาละหมาดจริงของ <b>ต.เขาตูม อ.ยะรัง จ.ปัตตานี</b> คำนวณอัตโนมัติทุกวัน · วันนี้ ' + d.getDate() + ' ' + M[d.getMonth()] + ' ' + (d.getFullYear() + 543) + '</p>' +
      '<div class="k8-pt-tbl"><div class="k8-pt-h"><span>เวลา</span><span>เข้าเวลา</span><span>เช็คได้ถึง</span><span>สายหลัง</span></div>' +
      KEYS.map((k, i) => '<div class="k8-pt-r"><b>' + k + '</b><span>' + hhmm(W[i][0]) + '</span><span>' + (k === 'อีชาอ์' ? 'ก่อนรุ่งอรุณ' : hhmm(W[i][1])) + '</span><span class="k8-pt-c">' + hhmm(C[k]) + '</span></div>').join('') + '</div>' +
      '<p class="k8-pw-hint">ซุบฮิ: นักเรียนชายแอดมินเช็คชื่อให้ · นักเรียนหญิงเช็คเอง · ทุกเวลานับว่า "มาสาย" เมื่อเช็คชื่อหลังเวลาในคอลัมน์ "สายหลัง"</p>' +
      '<div class="k8-pt-rule"><label><span>ซุบฮิ สายหลัง</span><input type="time" id="k8PtF" value="' + (RULE.fajr || '') + '"></label><label><span>ซุฮริ สายหลัง</span><input type="time" id="k8PtZ" value="' + (RULE.zuhr || '') + '"></label>' +
      '<label><span>อัศรฺ สายหลัง</span><input type="time" id="k8PtA" value="' + (RULE.asr || '') + '"></label>' +
      '<label><span>มัฆริบ สายหลัง</span><input type="time" id="k8PtM" value="' + (RULE.maghrib || '') + '"></label>' +
      '<label><span>อีชาอ์: สายเมื่อเลยเวลาเข้า (นาที)</span><input type="number" id="k8PtO" min="0" max="120" inputmode="numeric" value="' + (parseInt(RULE.offset, 10) || 0) + '"></label></div>' +
      '<div class="k8-dr-btns"><button type="button" class="is-alt" onclick="k8PtReset()">ค่าเริ่มต้น (05:35 · 12:51 · 16:21 · 19:14)</button><button type="button" id="k8PtSave" onclick="k8PtSave()">บันทึกเกณฑ์</button></div>';
    try { openModal('k8PwModal'); } catch (e) {}
  };
  async function saveRule(v) {
    const b = document.getElementById('k8PtSave'); if (b) { b.disabled = true; b.textContent = 'กำลังบันทึก…'; }
    let r = null; try { r = await gasApiCall('saveSetting', { data: { key: 'PrayerLateRule', value: JSON.stringify(v), description: 'เกณฑ์มาสายละหมาด (ซุบฮิ/ซุฮริ/อัศรฺ/มัฆริบ เวลาตายตัว · อีชาอ์ = เข้าเวลา + นาที)' } }, 20000); } catch (e) {}
    if (b) { b.disabled = false; b.textContent = 'บันทึกเกณฑ์'; }
    if (r && r.success !== false) {
      RULE = Object.assign({}, DEF_RULE, v); try { localStorage.setItem('khalifah_prayer_late_rule', JSON.stringify(RULE)); } catch (e) {}
      try { showToast('บันทึกเกณฑ์มาสายแล้ว', 'success'); } catch (e) {} window.k8PwOpen();
    } else { try { showToast((r && (r.message || r.error)) || 'บันทึกไม่สำเร็จ', 'error'); } catch (e) {} }
  }
  window.k8PtSave = function () {
    const fj = (document.getElementById('k8PtF') || {}).value, z = (document.getElementById('k8PtZ') || {}).value, a = (document.getElementById('k8PtA') || {}).value, m = (document.getElementById('k8PtM') || {}).value, o = parseInt((document.getElementById('k8PtO') || {}).value, 10);
    if (isNaN(toMin(fj)) || isNaN(toMin(z)) || isNaN(toMin(a)) || isNaN(toMin(m)) || isNaN(o) || o < 0 || o > 120) { try { showToast('กรอกเวลาและจำนวนนาทีให้ถูกต้อง', 'warning'); } catch (e) {} return; }
    saveRule({ fajr: fj, zuhr: z, asr: a, maghrib: m, offset: o });
  };
  window.k8PtReset = function () { saveRule(Object.assign({}, DEF_RULE)); };
})();

/* ---------- v17.8 · แถบเลือกวัน/ชั้น/ค้นหา หน้าละหมาด (แอดมิน) ---------- */
(function () {
  const D = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function lbl() {
    const inp = document.getElementById('adminPrayerDateSelect'), l = document.getElementById('k8PtDayLbl'), sub = document.getElementById('k8PtDaySub'), tb = document.getElementById('k8PtTodayBtn');
    if (!inp || !l) return;
    const v = inp.value || ymd(new Date()); const d = new Date(v + 'T00:00:00'); if (isNaN(d)) return;
    const t = ymd(new Date()), y = ymd(new Date(Date.now() - 864e5));
    const full = 'วัน' + D[d.getDay()] + ' ' + d.getDate() + ' ' + M[d.getMonth()] + ' ' + (d.getFullYear() + 543);
    l.textContent = v === t ? 'วันนี้' : v === y ? 'เมื่อวาน' : full;
    if (sub) sub.textContent = (v === t || v === y) ? full : '';
    if (tb) tb.hidden = v === t;
  }
  ['renderAdminPrayerDailyDashboard', 'adminPrayerChangeDate', 'adminPrayerSetToday'].forEach((fn) => { const o = window[fn]; if (typeof o === 'function') window[fn] = function () { const r = o.apply(this, arguments); setTimeout(lbl, 0); return r; }; });
  document.addEventListener('change', (e) => { if (e.target && e.target.id === 'adminPrayerDateSelect') lbl(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lbl); else lbl();
})();

/* ---------- v17.9 · รูปสรุปการละหมาด (เลือกเวลาเดียว/ทุกเวลา) ---------- */
(function () {
  const V = { slot: 'ALL', blob: null, url: '', name: '' };
  const FONT = '"IBM Plex Sans Thai", sans-serif';
  const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const DN = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const CAT = { ok: ['ตรงเวลา', '#16a34a', '#dcfce7', '#166534'], late: ['มาสาย', '#f59e0b', '#fef3c7', '#92400e'], ex: ['ลา / อุซุร', '#8b5cf6', '#ede9fe', '#5b21b6'], abs: ['ขาด', '#ef4444', '#fee2e2', '#991b1b'], none: ['ยังไม่เช็คชื่อ', '#94a3b8', '#f1f5f9', '#334155'] };
  const ORDER = ['ok', 'late', 'ex', 'abs', 'none'];
  const toast = (m, t) => { try { showToast(m, t || 'info'); } catch (e) {} };
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function kind(st) { st = String(st || ''); if (/อุซุร|ประจำเดือน|ป่วย|^ลา|ลากิจ|ลาหยุด/.test(st)) return 'ex'; if (/สาย|ช้า/.test(st)) return 'late'; if (/ไม่มา|ขาด/.test(st)) return 'abs'; return 'ok'; }
  const gShort = (g) => { const m = String(g || '').match(/(\d)/); return m ? 'ม.' + m[1] : String(g || '-'); };
  const tShort = (t) => { const m = String(t || '').match(/(\d{1,2})[:.](\d{2})/); return m ? m[1].padStart(2, '0') + ':' + m[2] : ''; };
  function data() {
    let all = [], map = {}, slots = [];
    try { all = cachedDailyFilteredStudents || []; map = cachedDailyStudentPrayerMap || {}; slots = CANONICAL_PRAYERS || []; } catch (e) {}
    const cid = (v) => { try { return cleanIdString(v); } catch (e) { return String(v || '').trim(); } };
    const rows = all.map((s) => { const sid = cid(s.studentId); const p = map[sid] || {}; const c = {}; slots.forEach((x) => { const r = p[x.key]; c[x.key] = r ? { k: kind(r.status), t: tShort(r.time) } : { k: 'none', t: '' }; }); return { sid: sid, name: s.fullName || sid, grade: gShort(s.grade), c: c }; });
    rows.sort((a, b) => a.grade.localeCompare(b.grade, 'th', { numeric: true }) || String(a.name).localeCompare(String(b.name), 'th'));
    const dv = ((document.getElementById('adminPrayerDateSelect') || {}).value) || new Date().toISOString().slice(0, 10);
    const d = new Date(dv + 'T00:00:00');
    const gsel = document.getElementById('adminPrayerGradeFilter');
    const gl = gsel && gsel.value !== 'ALL' ? String(gsel.options[gsel.selectedIndex].text).replace(/\s*\(.*\)\s*$/, '') : 'ทุกระดับชั้น';
    return { rows: rows, slots: slots, dateTxt: 'วัน' + DN[d.getDay()] + ' ' + d.getDate() + ' ' + M[d.getMonth()] + ' ' + (d.getFullYear() + 543), dateKey: dv, grade: gl };
  }
  const fit = (ctx, t, w) => { t = String(t); if (ctx.measureText(t).width <= w) return t; while (t.length > 1 && ctx.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; };
  function rr(ctx, x, y, w, h, r, fill, stroke, lw) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); } }
  function header(ctx, W, title, sub, D) {
    ctx.fillStyle = '#0369a1'; ctx.fillRect(0, 0, W, 220);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '600 30px ' + FONT; ctx.textAlign = 'left'; ctx.fillText('KHALIFAH · สรุปการละหมาด', 60, 70);
    ctx.fillStyle = '#fff'; ctx.font = '700 64px ' + FONT; ctx.fillText(title, 60, 150);
    ctx.font = '400 32px ' + FONT; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillText(D.dateTxt + ' · ' + D.grade + (sub ? ' · ' + sub : ''), 60, 198);
  }
  function stats(ctx, x, y, W, counts, total) {
    const gap = 16, n = ORDER.length, bw = (W - gap * (n - 1)) / n, bh = 130;
    ORDER.forEach((k, i) => {
      const bx = x + i * (bw + gap); rr(ctx, bx, y, bw, bh, 20, CAT[k][2]);
      ctx.textAlign = 'center'; ctx.fillStyle = CAT[k][3]; ctx.font = '700 56px ' + FONT; ctx.fillText(String(counts[k] || 0), bx + bw / 2, y + 66);
      ctx.font = '600 26px ' + FONT; ctx.fillText(CAT[k][0], bx + bw / 2, y + 108);
    });
    ctx.textAlign = 'left';
    return bh;
  }
  function drawSingle(D, slot) {
    const W = 1240, P = 60, IW = W - P * 2;
    const groups = {}; ORDER.forEach((k) => { groups[k] = []; });
    D.rows.forEach((r) => groups[r.c[slot.key].k].push(r));
    const COLS = 1, LH = 50, colW = IW / COLS;
    let H = 220 + 40 + 130 + 40;
    ORDER.forEach((k) => { if (groups[k].length) H += 76 + Math.ceil(groups[k].length / COLS) * LH + 30; });
    H += 90; if (!D.rows.length) H += 80;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    header(ctx, W, 'ละหมาด' + slot.label, slot.range ? String(slot.range).replace(' น.', '') + ' น.' : '', D);
    let y = 260;
    const counts = {}; ORDER.forEach((k) => { counts[k] = groups[k].length; });
    y += stats(ctx, P, y, IW, counts, D.rows.length) + 40;
    ORDER.forEach((k) => {
      const list = groups[k]; if (!list.length) return;
      rr(ctx, P, y, IW, 60, 14, CAT[k][2]);
      ctx.fillStyle = CAT[k][1]; ctx.beginPath(); ctx.arc(P + 32, y + 30, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = CAT[k][3]; ctx.font = '700 32px ' + FONT; ctx.fillText(CAT[k][0] + '  ' + list.length + ' คน', P + 56, y + 41);
      y += 76;
      list.forEach((r, i) => {
        const col = i % COLS, row = Math.floor(i / COLS); const x = P + col * colW, yy = y + row * LH + 36;
        ctx.fillStyle = '#94a3b8'; ctx.font = '400 26px ' + FONT; ctx.fillText((i + 1) + '.', x + 6, yy);
        const tail = r.grade + ((k === 'ok' || k === 'late') && r.c[slot.key].t ? ' · ' + r.c[slot.key].t : '');
        ctx.font = '400 26px ' + FONT; const tw = ctx.measureText(tail).width;
        ctx.fillStyle = '#0f172a'; ctx.font = '600 28px ' + FONT; ctx.fillText(fit(ctx, r.name, colW - tw - 90), x + 52, yy);
        ctx.fillStyle = '#64748b'; ctx.font = '400 26px ' + FONT; ctx.textAlign = 'right'; ctx.fillText(tail, x + colW - 20, yy); ctx.textAlign = 'left';
      });
      y += Math.ceil(list.length / COLS) * LH + 30;
    });
    if (!D.rows.length) { ctx.fillStyle = '#64748b'; ctx.font = '400 30px ' + FONT; ctx.fillText('ไม่มีนักเรียนในกลุ่มนี้', P, y + 40); }
    foot(ctx, W, H, D.rows.length);
    return cv;
  }
  function drawAll(D) {
    const W = 1600, P = 50, IW = W - P * 2, RH = 54, HH = 64;
    const slots = D.slots;
    const H = 220 + 30 + 210 + 30 + HH + Math.max(1, D.rows.length) * RH + 40 + 60 + 90;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    header(ctx, W, 'สรุปการละหมาด 5 เวลา', '', D);
    let y = 250;
    // สรุปต่อเวลา
    const bw = (IW - 16 * 4) / 5;
    slots.forEach((s, i) => {
      const x = P + i * (bw + 16); rr(ctx, x, y, bw, 210, 18, '#f8fafc', '#e2e8f0');
      ctx.fillStyle = '#0369a1'; ctx.font = '700 34px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(s.label, x + bw / 2, y + 46); ctx.textAlign = 'left';
      ORDER.forEach((k, j) => {
        const n = D.rows.filter((r) => r.c[s.key].k === k).length; const ly = y + 84 + j * 26;
        ctx.fillStyle = CAT[k][1]; ctx.fillRect(x + 20, ly - 15, 14, 14);
        ctx.fillStyle = '#334155'; ctx.font = '400 22px ' + FONT; ctx.fillText(CAT[k][0], x + 44, ly);
        ctx.font = '700 22px ' + FONT; ctx.textAlign = 'right'; ctx.fillText(String(n), x + bw - 20, ly); ctx.textAlign = 'left';
      });
    });
    y += 240;
    // ตาราง
    const cNo = 70, cGr = 100, cSum = 110, cSlot = 150; const cName = IW - cNo - cGr - cSum - cSlot * 5;
    rr(ctx, P, y, IW, HH, 14, '#0369a1');
    ctx.fillStyle = '#fff'; ctx.font = '600 26px ' + FONT;
    let x = P; ctx.textAlign = 'center'; ctx.fillText('#', x + cNo / 2, y + 42); x += cNo; ctx.textAlign = 'left'; ctx.fillText('ชื่อ - นามสกุล', x + 12, y + 42); x += cName; ctx.textAlign = 'center'; ctx.fillText('ชั้น', x + cGr / 2, y + 42); x += cGr;
    slots.forEach((s) => { ctx.fillText(s.label, x + cSlot / 2, y + 42); x += cSlot; }); ctx.fillText('รวม', x + cSum / 2, y + 42);
    y += HH;
    D.rows.forEach((r, i) => {
      if (i % 2) { ctx.fillStyle = '#f8fafc'; ctx.fillRect(P, y, IW, RH); }
      let x2 = P; ctx.textAlign = 'center'; ctx.fillStyle = '#94a3b8'; ctx.font = '400 24px ' + FONT; ctx.fillText(String(i + 1), x2 + cNo / 2, y + 36); x2 += cNo;
      ctx.textAlign = 'left'; ctx.fillStyle = '#0f172a'; ctx.font = '600 26px ' + FONT; ctx.fillText(fit(ctx, r.name, cName - 24), x2 + 12, y + 36); x2 += cName;
      ctx.textAlign = 'center'; ctx.fillStyle = '#475569'; ctx.font = '400 24px ' + FONT; ctx.fillText(r.grade, x2 + cGr / 2, y + 36); x2 += cGr;
      let n = 0;
      slots.forEach((s) => {
        const c = r.c[s.key]; if (c.k === 'ok' || c.k === 'late') n++;
        const t = c.k === 'ok' ? (c.t || '✓') : c.k === 'late' ? 'สาย' + (c.t ? ' ' + c.t : '') : c.k === 'ex' ? 'ลา' : c.k === 'abs' ? 'ขาด' : '–';
        if (c.k !== 'none') rr(ctx, x2 + 10, y + 8, cSlot - 20, RH - 16, 10, CAT[c.k][1]); else rr(ctx, x2 + 10, y + 8, cSlot - 20, RH - 16, 10, null, '#cbd5e1', 2);
        ctx.fillStyle = c.k === 'none' ? '#94a3b8' : '#fff'; ctx.font = '600 22px ' + FONT; ctx.fillText(fit(ctx, t, cSlot - 28), x2 + cSlot / 2, y + 35); x2 += cSlot;
      });
      ctx.fillStyle = n === 5 ? '#15803d' : n === 0 ? '#b91c1c' : '#0f172a'; ctx.font = '700 26px ' + FONT; ctx.fillText(n + '/5', x2 + cSum / 2, y + 36);
      ctx.textAlign = 'left'; y += RH;
    });
    if (!D.rows.length) { ctx.fillStyle = '#64748b'; ctx.font = '400 28px ' + FONT; ctx.fillText('ไม่มีนักเรียนในกลุ่มนี้', P + 20, y + 36); y += RH; }
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2; ctx.strokeRect(P, 250 + 240, IW, y - (250 + 240));
    // คำอธิบาย
    y += 40; let lx = P;
    ORDER.forEach((k) => { ctx.fillStyle = CAT[k][1]; rr(ctx, lx, y - 20, 22, 22, 6, k === 'none' ? null : CAT[k][1], k === 'none' ? '#cbd5e1' : null); ctx.fillStyle = '#475569'; ctx.font = '400 24px ' + FONT; ctx.fillText(CAT[k][0], lx + 32, y); lx += ctx.measureText(CAT[k][0]).width + 80; });
    ctx.fillText('· รวม = ตรงเวลา + สาย', lx, y);
    foot(ctx, W, H, D.rows.length);
    return cv;
  }
  function foot(ctx, W, H, n) {
    const d = new Date();
    ctx.fillStyle = '#94a3b8'; ctx.font = '400 22px ' + FONT; ctx.textAlign = 'left';
    ctx.fillText('นักเรียน ' + n + ' คน · สร้างเมื่อ ' + d.getDate() + ' ' + M[d.getMonth()] + ' ' + (d.getFullYear() + 543) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' น.', 50, H - 36);
    ctx.textAlign = 'right'; ctx.fillText('khalifah-program.vercel.app', W - 50, H - 36); ctx.textAlign = 'left';
  }
  async function build() {
    const prev = document.getElementById('k8PsPrev'); if (prev) prev.innerHTML = '<div class="k8-li-empty">กำลังสร้างรูป…</div>';
    try { await Promise.all(['400', '600', '700'].map((w) => document.fonts.load(w + ' 30px "IBM Plex Sans Thai"', 'กขค'))); } catch (e) {}
    const D = data();
    const slot = D.slots.find((s) => s.key === V.slot);
    const cv = slot ? drawSingle(D, slot) : drawAll(D);
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    if (V.url) URL.revokeObjectURL(V.url);
    V.blob = blob; V.url = blob ? URL.createObjectURL(blob) : '';
    V.name = 'สรุปละหมาด_' + (slot ? slot.label : '5เวลา') + '_' + D.dateKey + (D.grade !== 'ทุกระดับชั้น' ? '_' + D.grade.replace(/\s+/g, '') : '') + '.png';
    if (prev) prev.innerHTML = V.url ? '<img src="' + V.url + '" alt="รูปสรุปการละหมาด">' : '<div class="k8-li-empty">สร้างรูปไม่สำเร็จ</div>';
    const sub = document.getElementById('k8PsSub'); if (sub) sub.textContent = D.dateTxt + ' · ' + D.grade + ' · ' + D.rows.length + ' คน';
    const sh = document.getElementById('k8PsShare');
    if (sh) { let ok = false; try { ok = !!(blob && navigator.canShare && navigator.canShare({ files: [new File([blob], V.name, { type: 'image/png' })] })); } catch (e) {} sh.hidden = !ok; }
  }
  function chips() {
    const el = document.getElementById('k8PsChips'); if (!el) return;
    let slots = []; try { slots = CANONICAL_PRAYERS || []; } catch (e) {}
    el.innerHTML = [{ key: 'ALL', label: 'ทุกเวลา (5 เวลา)' }].concat(slots).map((s) => '<button type="button" role="tab" aria-selected="' + (V.slot === s.key) + '" class="' + (V.slot === s.key ? 'on' : '') + '" onclick="k8PsSlot(\'' + s.key + '\')">' + esc(s.label) + '</button>').join('');
  }
  window.k8PsOpen = function () {
    try { if (!(cachedDailyFilteredStudents || []).length && typeof renderAdminPrayerDailyDashboard === 'function') renderAdminPrayerDailyDashboard(); } catch (e) {}
    chips(); try { openModal('k8PsModal'); } catch (e) {} build();
  };
  window.k8PsSlot = function (k) { V.slot = k; chips(); build(); };
  window.k8PsSave = function () {
    if (!V.blob) return;
    const a = document.createElement('a'); a.href = V.url; a.download = V.name; document.body.appendChild(a); a.click(); a.remove();
    toast('บันทึกรูปแล้ว', 'success');
  };
  window.k8PsShare = async function () {
    if (!V.blob) return;
    try { await navigator.share({ files: [new File([V.blob], V.name, { type: 'image/png' })], title: 'สรุปการละหมาด' }); } catch (e) { if (!e || e.name !== 'AbortError') window.k8PsSave(); }
  };
})();

/* ---------- v17.10 · ตรวจรายการเก่าซ้ำตามเกณฑ์มาสาย (เช็คหลังเวลาสาย = มาสาย) ---------- */
(function () {
  const FROM = '2026-11-01'; // วันที่เริ่มใช้เกณฑ์มาสาย
  const norm = (k) => { try { return normalizePrayerSlotKey(k); } catch (e) { return k; } };
  const hm = (t) => { const m = String(t || '').match(/(\d{1,2})[:.](\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : NaN; };
  // รายการนี้ควรเป็น "มาสาย" ไหม (ใช้เวลาที่เช็คชื่อจริงของรายการ)
  // v17.22 · คำนวณใหม่จากเวลาที่เช็คชื่อจริง: true = สาย · false = ตรงเวลา · null = ไม่ต้องปรับ (แอดมินบันทึก/แก้เอง/อนุมัติ)
  function effLate(p) {
    if (!p || typeof window.k8LateCutoffs !== 'function') return null;
    const date = String(p.date || ''); if (!date || date < FROM) return null;
    const id = String(p.logId || p.id || '');
    if (/^PRY-(ROLL|ADM|APPR)/.test(id) || /แก้ไขโดย|อนุมัติ|เช็คโดย|เช็คชื่อโดยแอดมิน/.test(String(p.note || '') + String(p.time || ''))) return null;
    const slot = norm(p.prayerName || p.prayerTime || ''); if (!slot) return null;
    const t = hm(p.time); if (isNaN(t)) return null;
    const la = parseFloat(p.lat != null ? p.lat : p.latitude), ln = parseFloat(p.lng != null ? p.lng : p.longitude);
    const loc = isFinite(la) && isFinite(ln) && (Math.abs(la - 6.5967) > 0.03 || Math.abs(ln - 101.3444) > 0.03) ? { lat: la, lng: ln } : null;
    const c = window.k8LateCutoffs(new Date(date + 'T12:00:00'), loc)[slot]; if (c == null) return null;
    if (slot === 'อีชาอ์' && t < 12 * 60) return true;
    return t > c;
  }
  function shouldBeLate(p) { return !!p && /^ตรงเวลา/.test(String(p.status || '')) && effLate(p) === true; }
  function shouldBeOnTime(p) { return !!p && /^(มาสาย|สาย)$/.test(String(p.status || '').trim()) && effLate(p) === false; }
  window.k8ShouldBeLate = shouldBeLate;
  window.k8ShouldBeOnTime = shouldBeOnTime;
  const fixOne = (p) => shouldBeLate(p) ? Object.assign({}, p, { status: 'มาสาย', _k8late: 1 }) : shouldBeOnTime(p) ? Object.assign({}, p, { status: 'ตรงเวลา (ญะมาอะฮ์/มัสยิด)', _k8ontime: 1 }) : p;
  window.k8EffStatus = (p) => (p ? fixOne(p).status : '');
  const o = window.getAllCombinedPrayerHistory;
  if (typeof o === 'function') window.getAllCombinedPrayerHistory = function () {
    const list = o.apply(this, arguments) || [];
    return list.map(fixOne);
  };
  // บันทึกถาวรลงชีต + เครื่องนี้ (แอดมิน/อาจารย์เท่านั้น)
  let busy = false;
  async function persist() {
    if (busy) return; let staff = false; try { staff = !!currentAdmin; } catch (e) {} if (!staff) return;
    const late = [], ontime = [];
    const fix = (key) => { let arr = []; try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return; } let ch = false; arr.forEach((p) => { const id = String(p.logId || p.id || ''); if (shouldBeLate(p)) { p.status = 'มาสาย'; late.push(id); ch = true; } else if (shouldBeOnTime(p)) { p.status = 'ตรงเวลา (ญะมาอะฮ์/มัสยิด)'; ontime.push(id); ch = true; } }); if (ch) { try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {} } };
    fix('khalifah_prayer_history'); fix('khalifah_today_prayers');
    try { (typeof todayPrayers !== 'undefined' ? todayPrayers : []).forEach((p) => { if (shouldBeLate(p)) p.status = 'มาสาย'; else if (shouldBeOnTime(p)) p.status = 'ตรงเวลา (ญะมาอะฮ์/มัสยิด)'; }); } catch (e) {}
    const L = Array.from(new Set(late)).filter(Boolean), O = Array.from(new Set(ontime)).filter(Boolean);
    if (!L.length && !O.length) return;
    busy = true;
    try { if (L.length) await gasApiCall('markPrayersLate', { data: { ids: L } }, 30000); } catch (e) {}
    try { if (O.length) await gasApiCall('markPrayersLate', { data: { ids: O, status: 'ontime' } }, 30000); } catch (e) {}
    busy = false;
  }
  window.k8PersistLate = persist;
  const r = window.renderAdminPrayerDailyDashboard;
  if (typeof r === 'function') window.renderAdminPrayerDailyDashboard = function () { const x = r.apply(this, arguments); setTimeout(persist, 500); return x; };
})();

/* ---------- v17.11 · เตือนนักเรียน (สีแดง) เมื่อใกล้หมดเวลาละหมาดแต่ยังไม่เช็คชื่อ ---------- */
(function () {
  const WARN = 15; // นาทีสุดท้ายก่อนหมดเวลา (เช่น ซุฮริ: 15 นาทีก่อนเข้าอัศรฺ)
  const NEXT = { 'ซุฮริ': 'อัศรฺ', 'อัศรฺ': 'มัฆริบ', 'มัฆริบ': 'อีชาอ์', 'อีชาอ์': 'เที่ยงคืน' };
  const norm = (k) => { try { return normalizePrayerSlotKey(k); } catch (e) { return k; } };
  const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  function done(slot) {
    try { if ((getStudentTodayPrayersList() || []).some((p) => norm(p.prayerName || p.prayerTime || p.timeSlot || '') === slot)) return true; } catch (e) {}
    try { const d = new Date().toLocaleDateString('sv-SE'); const sid = currentStudent.studentId; if ((getPrayerApprovalsList() || []).some((r) => r.studentId === sid && r.prayerSlot === slot && r.date === d && !/reject/i.test(String(r.status)))) return true; } catch (e) {}
    return false;
  }
  function check() {
    let st = null; try { st = currentStudent; } catch (e) {}
    let adm = null; try { adm = currentAdmin; } catch (e) {}
    const els = [document.getElementById('k8PwAlertHome'), document.getElementById('k8PwAlertPr')];
    let hit = null;
    if (st && !adm && !(window.k8PeriodActive && window.k8PeriodActive())) {
      const now = new Date(), cur = now.getHours() * 60 + now.getMinutes();
      try {
        PRAYER_TIME_WINDOWS.forEach((w) => {
          const k = norm(w.key || w.name); if ((k === 'ซุบฮิ' && !(window.k8IsGirl && window.k8IsGirl(st))) || hit) return;
          const left = w.endMin - cur;
          if (cur >= w.startMin && left >= 0 && left <= WARN && !done(k)) hit = { k: k, left: left, end: w.endMin };
        });
      } catch (e) {}
    }
    const nav = [document.getElementById('m-nav-prayer'), document.getElementById('nav-prayer')];
    nav.forEach((n) => { if (n) n.classList.toggle('k8-nav-alert', !!hit); });
    els.forEach((el) => {
      if (!el) return;
      el.hidden = !hit;
      if (hit) el.innerHTML = '<span class="k8-pw-alert-ico" aria-hidden="true">!</span><span class="k8-pw-alert-t"><b>ยังไม่ได้เช็คชื่อละหมาด' + hit.k + '</b><small>เหลืออีก ' + (hit.left || '< 1') + ' นาที (หมดเวลา ' + hhmm(hit.end) + ' น. · ก่อนเข้า' + (NEXT[hit.k] || 'เวลาถัดไป') + ')</small></span><span class="k8-pw-alert-go" aria-hidden="true">›</span>';
    });
    if (hit) {
      const key = 'k8pwwarn_' + new Date().toLocaleDateString('sv-SE') + '_' + hit.k;
      let shown = false; try { shown = !!sessionStorage.getItem(key); } catch (e) {}
      if (!shown) {
        try { sessionStorage.setItem(key, '1'); } catch (e) {}
        try { showToast('⚠️ ยังไม่ได้เช็คชื่อละหมาด' + hit.k + ' · เหลืออีก ' + hit.left + ' นาที', 'error'); } catch (e) {}
        try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e) {}
        try {
          if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) navigator.serviceWorker.ready.then((r) => r.showNotification('ยังไม่ได้เช็คชื่อละหมาด' + hit.k, { body: 'เหลืออีก ' + hit.left + ' นาที ก่อนหมดเวลา', icon: 'assets/icon-192.png', tag: key }));
        } catch (e) {}
      }
    }
  }
  window.k8PrayerWarnCheck = check;
  ['switchView', 'refreshPrayerChipsStatus'].forEach((fn) => { const o = window[fn]; if (typeof o === 'function') window[fn] = function () { const r = o.apply(this, arguments); setTimeout(check, 50); return r; }; });
  setInterval(check, 30000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(check, 1500)); else setTimeout(check, 1500);
})();

/* ---------- v17.14 · ลาสอน: เลือกจากตารางสอนของตัวเอง · แอดมิน/ผู้บริหารอนุมัติ · แจ้งนักเรียน ---------- */
(function () {
  const V = { list: null, teachers: null, edit: null, busy: false, teach: null, cfg: null, sel: {}, date: '' };
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t) => { try { showToast(m, t || 'info'); } catch (e) {} };
  const DN = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'], DS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'], M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const me = () => { try { return currentAdmin || {}; } catch (e) { return {}; } };
  const myIds = () => { const a = me(); return [a.username, a.userId, a.id, a.teacherId].filter(Boolean).map((x) => String(x).toLowerCase()); };
  const isMine = (x) => myIds().indexOf(String(x.teacherId).toLowerCase()) !== -1 || (!!me().fullName && x.teacherName === me().fullName);
  const isAdm = () => { const a = me(); return /ADMIN|SUPER|EXEC/i.test(String(a.role || '')) || !!a.isOwner || !!a.isSubAdmin; };
  const ST = { pending: ['รออนุมัติ', '#fef3c7', '#92400e'], approved: ['อนุมัติแล้ว', '#dcfce7', '#166534'], rejected: ['ไม่อนุมัติ', '#fee2e2', '#991b1b'] };
  function dLabel(s) {
    const d = new Date(s + 'T00:00:00'); if (isNaN(d)) return s;
    const t = ymd(new Date()), tm = ymd(new Date(Date.now() + 864e5));
    return (s === t ? 'วันนี้ · ' : s === tm ? 'พรุ่งนี้ · ' : '') + 'วัน' + DN[d.getDay()] + ' ' + d.getDate() + ' ' + M[d.getMonth()];
  }
  const ptime = (p) => { const c = V.cfg && V.cfg.periods && V.cfg.periods[p - 1]; return c ? (c.start + '–' + c.end) : ''; };
  function whenHtml(x) {
    if (x.allDay) return '<span class="k8-lv-when">ทั้งวัน</span>';
    if (x.slots && x.slots.length) return x.slots.map((s) => '<span class="k8-lv-when">คาบ ' + s.p + (s.t ? ' · ' + esc(s.t) : '') + '</span>').join('');
    return '<span class="k8-lv-when">คาบ ' + esc((x.periods || []).join(', ')) + (x.timeText ? ' · ' + esc(x.timeText) : '') + '</span>';
  }
  async function load() {
    let r = null; try { r = await gasApiCall('getTeacherLeaves', {}, 20000); } catch (e) {}
    if (r && r.success) V.list = r.data || []; else if (!V.list) V.list = [];
    render();
  }
  function place() {
    const q = document.querySelector('#teacher-tab-overview .k8-th-quick');
    if (q) {
      let b = q.querySelector('.k8-lv-qbtn');
      if (!b) {
        q.insertAdjacentHTML('beforeend', '<button type="button" class="k8-lv-qbtn" onclick="k8LvOpen()"><span style="background:#fee2e2;color:#b91c1c"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9.5 14.5l5 5M14.5 14.5l-5 5"/></svg><em class="k8-lv-qn" hidden></em></span>ลาสอน</button>');
        b = q.querySelector('.k8-lv-qbtn');
      }
      const today = ymd(new Date());
      const up = (V.list || []).filter((x) => x.date >= today && x.status !== 'rejected');
      const need = isAdm() ? up.filter((x) => (x.status || 'pending') === 'pending').length : up.filter((x) => !x.subName).length;
      const n = b.querySelector('.k8-lv-qn'); if (n) { n.hidden = !need; n.textContent = need; }
      b.setAttribute('aria-label', 'ลาสอน' + (need ? ' · ' + need + ' รายการต้องดำเนินการ' : ''));
    }
  }
  function itemHtml(x) {
    const mine = isMine(x), canEdit = mine || isAdm(), iSub = myIds().indexOf(String(x.subId).toLowerCase()) !== -1;
    const st = ST[x.status || 'pending'] || ST.pending;
    const subjLine = x.slots && x.slots.length ? x.slots.map((s) => esc(s.sn) + (s.gn ? ' · ' + esc(s.gn) : (/^x:/.test(s.g) ? '' : ' · ม.' + esc(s.g)))).filter((v, i, a) => a.indexOf(v) === i).join(' / ') : esc(x.subject) + (x.grade ? ' · ' + esc(x.grade) : '');
    return '<article class="k8-lv-item is-' + (x.status || 'pending') + (x.subName ? ' has-sub' : '') + '">' +
      '<div class="k8-lv-top"><b>' + esc(dLabel(x.date)) + '</b><span class="k8-lv-st" style="background:' + st[1] + ';color:' + st[2] + '">' + st[0] + '</span></div>' +
      '<div class="k8-lv-whens">' + whenHtml(x) + '</div>' +
      '<div class="k8-lv-main"><span class="k8-lv-subj">' + subjLine + '</span><span class="k8-lv-who">ลาโดย ' + esc(x.teacherName || '-') + (mine ? ' (ฉัน)' : '') + (x.reason ? ' · ' + esc(x.reason) : '') + '</span>' +
      (x.status && x.status !== 'pending' && x.approvedBy ? '<span class="k8-lv-who">' + (x.status === 'approved' ? 'อนุมัติโดย ' : 'ไม่อนุมัติโดย ') + esc(x.approvedBy) + (x.note ? ' · ' + esc(x.note) : '') + '</span>' : '') + '</div>' +
      (isAdm() && (x.status || 'pending') === 'pending' ? '<div class="k8-lv-appr"><button type="button" class="is-ok" onclick="k8LvApprove(\'' + x.id + '\',1)">อนุมัติ · แจ้งนักเรียน</button><button type="button" class="is-no" onclick="k8LvApprove(\'' + x.id + '\',0)">ไม่อนุมัติ</button></div>' : '') +
      '<div class="k8-lv-sub">' + (x.subName ? '<span class="k8-lv-ok">✓ สอนแทนโดย ' + esc(x.subName) + '</span>' : '<span class="k8-lv-no">ยังไม่มีคนสอนแทน</span>') +
      '<span class="k8-lv-acts">' +
        (!mine && !x.subName && x.status !== 'rejected' ? '<button type="button" class="is-take" onclick="k8LvTake(\'' + x.id + '\')">ฉันสอนแทนได้</button>' : '') +
        (iSub ? '<button type="button" onclick="k8LvTake(\'' + x.id + '\',1)">ยกเลิกรับสอน</button>' : '') +
        (canEdit ? '<button type="button" onclick="k8LvEdit(\'' + x.id + '\')">แก้ไข</button><button type="button" class="is-del" onclick="k8LvDel(\'' + x.id + '\')">ยกเลิกลา</button>' : '') +
      '</span></div></article>';
  }
  function render() {
    place();
    const el = document.getElementById('k8LvList');
    const ap = document.getElementById('k8ApGrid');
    if (el) {
      if (V.list === null) el.innerHTML = '<div class="k8-li-empty">กำลังโหลด…</div>';
      else {
        const today = ymd(new Date());
        const up = V.list.filter((x) => x.date >= today).sort((a, b) => a.date.localeCompare(b.date) || ((a.periods || [0])[0] - (b.periods || [0])[0]));
        const pend = up.filter((x) => (x.status || 'pending') === 'pending').length;
        const head = document.querySelector('#k8LvCard .k8-lv-head h2'); if (head) head.innerHTML = 'ลาสอนที่จะถึง' + (pend ? ' <span class="k8-lv-need">รออนุมัติ ' + pend + '</span>' : '');
        el.innerHTML = up.length ? up.map(itemHtml).join('') : '<div class="k8-li-empty">ยังไม่มีการแจ้งลาสอน</div>';
      }
    }
    if (ap && window.k8ApCurTab && window.k8ApCurTab() === 'leaves') {
      const list = (V.list || []).slice().sort((a, b) => ((a.status || 'pending') === 'pending' ? 0 : 1) - ((b.status || 'pending') === 'pending' ? 0 : 1) || a.date.localeCompare(b.date));
      ap.innerHTML = list.length ? '<div class="k8-lv-aplist">' + list.map(itemHtml).join('') + '</div>' : '<div class="k8-li-empty">ยังไม่มีคำขอลาสอน</div>';
    }
    const tb = document.querySelector('#k8ApTabs [data-tab="leaves"]');
    if (tb) { const n = (V.list || []).filter((x) => (x.status || 'pending') === 'pending' && x.date >= ymd(new Date())).length; tb.textContent = 'ลาสอน (' + n + ')'; }
    try { window.k8BellPaint && window.k8BellPaint(); } catch (e) {}
  }
  window.k8LvRender = render; window.k8LvLoad = load; window.k8LvPlace = function () { try { place(); } catch (e) {} };
  window.k8LvPendingN = function () { if (V.list === null) return null; const t = ymd(new Date()); return (V.list || []).filter((x) => (x.status || 'pending') === 'pending' && x.date >= t).length; };
  async function teachers() {
    if (V.teachers) return V.teachers;
    let r = null; try { r = await gasApiCall('getTeachers', {}, 20000); } catch (e) {}
    V.teachers = r && r.success ? (r.data || []).map((t) => ({ id: String(t.username || t.id || ''), name: t.fullName || t.name || t.username })).filter((t) => t.name) : [];
    return V.teachers;
  }
  async function myTeaching() {
    if (V.teach) return V.teach;
    let r = null; try { r = await gasApiCall('getMyTeaching', {}, 20000); } catch (e) {}
    if (r && r.success) { V.teach = r.slots || []; V.cfg = r.config || null; } else V.teach = [];
    return V.teach;
  }
  const skey = (x) => x.g + '|' + x.p;
  function slotsHtml() {
    const d = new Date(V.date + 'T00:00:00'); const dow = d.getDay();
    const day = (V.teach || []).filter((x) => x.d === dow).sort((a, b) => a.p - b.p);
    if (!day.length) return '<div class="k8-lv-none">วัน' + DN[dow] + 'ไม่มีคาบสอนของคุณในตาราง · เลือกวันอื่น หรือแตะวิชาในตารางด้านล่าง</div>';
    return '<div class="k8-lv-slots">' + day.map((x) => { const on = !!V.sel[skey(x)]; return '<button type="button" class="k8-lv-slot' + (on ? ' on' : '') + '" data-k="' + esc(skey(x)) + '" onclick="k8LvSlot(this)"><span class="k8-lv-slot-p"><b>คาบ ' + x.p + '</b><small>' + esc(ptime(x.p)) + '</small></span><span class="k8-lv-slot-s"><b>' + esc(x.sn) + '</b><small>' + esc(x.gn || ('ม.' + x.g)) + (x.r ? ' · ห้อง ' + esc(x.r) : '') + '</small></span><i aria-hidden="true">' + (on ? '✓' : '') + '</i></button>'; }).join('') + '</div>' +
      (day.length > 1 ? '<button type="button" class="k8-lv-allday" onclick="k8LvAllDay()">เลือกทุกคาบของวันนี้</button>' : '');
  }
  function weekHtml() {
    const days = (V.cfg && V.cfg.days) || [1, 2, 3, 4, 5]; const np = (V.cfg && V.cfg.periods && V.cfg.periods.length) || 5;
    const T = V.teach || [];
    let h = '<div class="k8-lv-wk" style="grid-template-columns: 44px repeat(' + np + ', minmax(0, 1fr))"><span></span>';
    for (let p = 1; p <= np; p++) h += '<span class="k8-lv-wk-h">' + p + '</span>';
    days.forEach((dd) => {
      const curDow = new Date(V.date + 'T00:00:00').getDay();
      h += '<span class="k8-lv-wk-d' + (dd === curDow ? ' is-cur' : '') + '">' + DS[dd] + '</span>';
      for (let p = 1; p <= np; p++) {
        const x = T.find((y) => y.d === dd && y.p === p);
        h += x ? '<button type="button" class="k8-lv-wk-c' + (dd === curDow && V.sel[skey(x)] ? ' on' : '') + '" onclick="k8LvPick(' + dd + ',' + p + ')" title="' + esc(x.sn + ' ' + (x.gn || '')) + '"><b>' + esc(String(x.sn).slice(0, 8)) + '</b><small>' + esc(x.gn || ('ม.' + x.g)) + '</small></button>' : '<span class="k8-lv-wk-e"></span>';
      }
    });
    return h + '</div>';
  }
  function paintSlots() {
    const a = document.getElementById('k8LvSlotBox'); if (a) a.innerHTML = slotsHtml();
    const w = document.getElementById('k8LvWeek'); if (w) w.innerHTML = weekHtml();
    const l = document.getElementById('k8LvDateLbl'); if (l) l.textContent = dLabel(V.date);
  }
  function subjects() { let a = []; try { a = (appSubjects || []).map((s) => s.name || s); } catch (e) {} return Array.from(new Set(a.filter(Boolean))); }
  async function form(x) {
    V.edit = x || null; x = x || {};
    const el = document.getElementById('k8LvForm'); if (!el) return;
    el.innerHTML = '<div class="k8-li-empty">กำลังโหลดตารางสอนของคุณ…</div>';
    const tt = document.getElementById('k8LvTitle'); if (tt) tt.textContent = V.edit ? 'แก้ไขการลาสอน' : 'แจ้งลาสอน';
    const [T, TS] = await Promise.all([myTeaching(), teachers()]);
    const myName = me().fullName || '';
    V.date = x.date || ymd(new Date()); V.sel = {};
    (x.slots || []).forEach((s) => { V.sel[s.g + '|' + s.p] = 1; });
    const hasTT = T.length > 0;
    let h = '<label class="k8-lv-f"><span>วันที่ลา <b class="k8-lv-dl" id="k8LvDateLbl"></b></span><input type="date" id="k8LvDate" value="' + esc(V.date) + '" min="' + ymd(new Date(Date.now() - 7 * 864e5)) + '" onchange="k8LvDate(this.value)"></label>';
    if (hasTT) {
      h += '<div class="k8-lv-f"><span>เลือกคาบที่จะลา <small>จากตารางสอนของคุณ</small></span><div id="k8LvSlotBox"></div></div>' +
        '<details class="k8-lv-wkbox"><summary>ดูตารางสอนทั้งสัปดาห์ · แตะวิชาเพื่อเลือก</summary><div id="k8LvWeek"></div></details>';
    } else {
      const P = x.periods || [];
      h += '<p class="k8-lv-none">ยังไม่พบคาบสอนของคุณในตารางสอน · กรอกเองได้ด้านล่าง</p>' +
        '<div class="k8-lv-f"><span>คาบ</span><div class="k8-lv-pchips"><button type="button" data-p="all" class="' + (x.allDay ? 'on' : '') + '" onclick="k8LvP(this)">ทั้งวัน</button>' + [1, 2, 3, 4, 5].map((n) => '<button type="button" data-p="' + n + '" class="' + (P.indexOf(n) !== -1 ? 'on' : '') + '" onclick="k8LvP(this)">คาบ ' + n + '</button>').join('') + '</div></div>' +
        '<label class="k8-lv-f"><span>วิชา</span><input type="text" id="k8LvSubj" list="k8LvSubjList" maxlength="80" value="' + esc(x.subject || '') + '"><datalist id="k8LvSubjList">' + subjects().map((n) => '<option value="' + esc(n) + '">').join('') + '</datalist></label>' +
        '<label class="k8-lv-f"><span>ชั้น</span><select id="k8LvGrade"><option value="">— ไม่ระบุ —</option>' + ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'].map((g) => '<option' + (x.grade === g ? ' selected' : '') + '>' + g + '</option>').join('') + '</select></label>';
    }
    h += '<label class="k8-lv-f"><span>เหตุผล <small>ไม่บังคับ</small></span><input type="text" id="k8LvReason" placeholder="เช่น ไปราชการ, ลาป่วย" maxlength="160" value="' + esc(x.reason || '') + '"></label>' +
      '<label class="k8-lv-f"><span>มีคนสอนแทนแล้วหรือยัง</span><select id="k8LvSub"><option value="">ยังไม่มี · ให้อาจารย์ท่านอื่นกดรับ</option>' + TS.filter((t) => t.name !== myName).map((t) => '<option value="' + esc(t.id) + '|' + esc(t.name) + '"' + (x.subName === t.name ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('') + '</select></label>' +
      '<p class="k8-lv-hint">ส่งแล้วจะรอแอดมิน/ผู้บริหารอนุมัติ · เมื่ออนุมัติ นักเรียนที่เรียนคาบนั้นจะได้รับแจ้งเตือน</p>' +
      '<div class="k8-dr-btns"><button type="button" class="is-alt" onclick="closeModal(\'k8LvModal\')">ยกเลิก</button><button type="button" id="k8LvSave" onclick="k8LvSave()">' + (V.edit ? 'บันทึกการแก้ไข' : 'ส่งคำขอลาสอน') + '</button></div>';
    el.innerHTML = h;
    if (hasTT) paintSlots(); else { const l = document.getElementById('k8LvDateLbl'); if (l) l.textContent = dLabel(V.date); }
  }
  window.k8LvDate = function (v) { if (!v) return; if (v !== V.date) V.sel = {}; V.date = v; paintSlots(); };
  window.k8LvSlot = function (b) { const k = b.dataset.k; if (V.sel[k]) delete V.sel[k]; else V.sel[k] = 1; paintSlots(); };
  window.k8LvAllDay = function () { const dow = new Date(V.date + 'T00:00:00').getDay(); const day = (V.teach || []).filter((x) => x.d === dow); const all = day.every((x) => V.sel[skey(x)]); day.forEach((x) => { if (all) delete V.sel[skey(x)]; else V.sel[skey(x)] = 1; }); paintSlots(); };
  window.k8LvPick = function (dd, p) {
    const cur = new Date(V.date + 'T00:00:00');
    if (cur.getDay() !== dd) { const t = new Date(); t.setHours(0, 0, 0, 0); const diff = (dd - t.getDay() + 7) % 7; const nd = new Date(t.getTime() + diff * 864e5); V.date = ymd(nd); V.sel = {}; const di = document.getElementById('k8LvDate'); if (di) di.value = V.date; }
    const x = (V.teach || []).find((y) => y.d === dd && y.p === p); if (x) { if (V.sel[skey(x)]) delete V.sel[skey(x)]; else V.sel[skey(x)] = 1; }
    paintSlots();
  };
  window.k8LvP = function (b) {
    const box = b.parentElement;
    if (b.dataset.p === 'all') { const on = !b.classList.contains('on'); box.querySelectorAll('button').forEach((x) => x.classList.remove('on')); if (on) b.classList.add('on'); }
    else { box.querySelector('[data-p="all"]').classList.remove('on'); b.classList.toggle('on'); }
  };
  // v17.49 · ลาสอน: เปิดเป็นหน้าเต็ม (ไม่ใช่ป๊อปอัป) · ปุ่มย้อนกลับ/ปัดกลับของมือถือปิดหน้าได้
  let lvOpen = false;
  window.k8LvOpen = function () {
    const el = document.getElementById('k8LvPage'); if (!el) return;
    el.hidden = false; lvOpen = true; document.documentElement.classList.add('k8-docs-open');
    try { history.pushState({ k8lv: 1 }, ''); } catch (e) {}
    const b = el.querySelector('.k8-docs-body'); if (b) b.scrollTop = 0;
    render(); load();
  };
  function lvClose() { const el = document.getElementById('k8LvPage'); if (el) el.hidden = true; lvOpen = false; if (!document.querySelector('.k8-docs:not([hidden])')) document.documentElement.classList.remove('k8-docs-open'); }
  window.k8LvBack = function () { if (history.state && history.state.k8lv) history.back(); else lvClose(); };
  window.addEventListener('popstate', (e) => { if (lvOpen && !(e.state && e.state.k8lv)) lvClose(); });
  window.k8LvNew = function () { form(null); try { openModal('k8LvModal'); } catch (e) {} };
  window.k8LvEdit = function (id) { const x = (V.list || []).find((y) => y.id === id); form(x); try { openModal('k8LvModal'); } catch (e) {} };
  window.k8LvSave = async function () {
    if (V.busy) return;
    const g = (id) => (document.getElementById(id) || {}).value || '';
    const sub = g('k8LvSub').split('|');
    const data = { id: V.edit ? V.edit.id : '', date: V.date || g('k8LvDate'), reason: g('k8LvReason').trim(), subId: sub[0] || '', subName: sub[1] || '' };
    if (document.getElementById('k8LvSlotBox')) {
      const dow = new Date(data.date + 'T00:00:00').getDay();
      data.slots = (V.teach || []).filter((x) => x.d === dow && V.sel[skey(x)]).map((x) => ({ p: x.p, g: x.g, s: x.s, sn: x.sn, r: x.r, t: ptime(x.p) }));
      if (!data.slots.length) return toast('แตะเลือกคาบที่จะลาอย่างน้อย 1 คาบ', 'warning');
    } else {
      const chips = Array.from(document.querySelectorAll('.k8-lv-pchips button.on'));
      data.allDay = chips.some((c) => c.dataset.p === 'all'); data.periods = chips.filter((c) => c.dataset.p !== 'all').map((c) => +c.dataset.p);
      data.subject = g('k8LvSubj').trim(); data.grade = g('k8LvGrade');
      if (!data.allDay && !data.periods.length) return toast('เลือกคาบที่ลา หรือ "ทั้งวัน"', 'warning');
      if (!data.subject) return toast('ระบุวิชา', 'warning');
    }
    const b = document.getElementById('k8LvSave'); V.busy = true; if (b) { b.disabled = true; b.textContent = 'กำลังส่ง…'; }
    let r = null; try { r = await gasApiCall('saveTeacherLeave', { data: data }, 30000); } catch (e) {}
    V.busy = false; if (b) { b.disabled = false; b.textContent = 'ส่งคำขอลาสอน'; }
    if (r && r.success) { V.list = r.data || V.list; render(); try { closeModal('k8LvModal'); } catch (e) {} toast(r.message, 'success'); }
    else toast((r && (r.message || r.error)) || 'บันทึกไม่สำเร็จ · Deploy Code.gs ตัวล่าสุดก่อน', 'error');
  };
  window.k8LvApprove = async function (id, ok) {
    let note = '';
    if (!ok) { note = prompt('เหตุผลที่ไม่อนุมัติ (ไม่บังคับ)', '') || ''; if (note === null) return; }
    else if (!confirm('อนุมัติการลานี้ใช่ไหม?\nระบบจะแจ้งเตือนนักเรียนที่เรียนคาบนั้น และแจ้งอาจารย์ผู้ลา')) return;
    let r = null; try { r = await gasApiCall('approveTeacherLeave', { data: { id: id, approve: !!ok, note: note } }, 30000); } catch (e) {}
    if (r && r.success) { V.list = r.data || V.list; render(); toast(r.message + (ok && r.notified != null ? ' (' + r.notified + ' คน)' : ''), 'success'); try { window.k8NotifReload && window.k8NotifReload(); } catch (e) {} }
    else toast((r && (r.message || r.error)) || 'ไม่สำเร็จ · Deploy Code.gs ตัวล่าสุดก่อน', 'error');
  };
  window.k8LvTake = async function (id, undo) {
    if (undo && !confirm('ยกเลิกการรับสอนแทนใช่ไหม?')) return;
    let r = null; try { r = await gasApiCall('takeTeacherLeave', { data: { id: id, undo: !!undo } }, 20000); } catch (e) {}
    if (r && r.success) { V.list = r.data || V.list; render(); toast(r.message, 'success'); } else toast((r && (r.message || r.error)) || 'ไม่สำเร็จ', 'error');
  };
  window.k8LvDel = async function (id) {
    if (!confirm('ยกเลิกการลาสอนรายการนี้ใช่ไหม?')) return;
    let r = null; try { r = await gasApiCall('deleteTeacherLeave', { data: { id: id } }, 20000); } catch (e) {}
    if (r && r.success) { V.list = r.data || []; render(); toast(r.message || 'ยกเลิกแล้ว', 'success'); } else toast((r && (r.message || r.error)) || 'ไม่สำเร็จ', 'error');
  };
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) { const r = sv.apply(this, arguments); if (v === 'teacher') { place(); setTimeout(place, 0); setTimeout(place, 300); load(); } return r; };
  const st = window.switchTeacherTab;
  if (typeof st === 'function') window.switchTeacherTab = function (t) { const r = st.apply(this, arguments); if (t === 'overview') { place(); setTimeout(place, 0); load(); } return r; };
  // หน้า "อนุมัติบัญชี & คำขอ" ของแอดมิน: แท็บลาสอน
  const sat = window.switchAdminTab;
  if (typeof sat === 'function') window.switchAdminTab = function (t) { const r = sat.apply(this, arguments); if (t === 'approvals' || t === 'dashboard' || t === 'overview') load(); return r; };
  const apt = window.k8ApTab;
  if (typeof apt === 'function') window.k8ApTab = function (t) { if (t === 'leaves') { document.querySelectorAll('#k8ApTabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === 'leaves')); window.k8ApCurTab = () => 'leaves'; render(); load(); return; } window.k8ApCurTab = () => t; return apt.apply(this, arguments); };
  const rap = window.renderApprovalsV8;
  if (typeof rap === 'function') window.renderApprovalsV8 = function () { if (window.k8ApCurTab && window.k8ApCurTab() === 'leaves') { render(); document.querySelectorAll('#k8ApTabs button').forEach((b) => { if (b.dataset.tab !== 'leaves') b.setAttribute('aria-selected', 'false'); }); return; } const r = rap.apply(this, arguments); render(); return r; };
  setInterval(() => { const v = document.getElementById('view-teacher'), a = document.getElementById('view-admin'); if (document.visibilityState === 'visible' && ((v && v.classList.contains('active')) || (a && a.classList.contains('active')))) load(); }, 60000);
})();

/* ---------- v17.12 · วิชาของนักเรียนตามชั้นปี (จากตารางเรียนของชั้น) ---------- */
(function () {
  let busy = false;
  const sidOf = () => { try { return currentStudent && currentStudent.studentId ? String(currentStudent.studentId) : ''; } catch (e) { return ''; } };
  const key = (sid) => 'k8_mysubj_' + sid;
  const read = (sid) => { try { return JSON.parse(localStorage.getItem(key(sid)) || 'null'); } catch (e) { return null; } };
  async function refresh(sid) {
    if (busy || !sid) return; busy = true;
    let r = null; try { r = await gasApiCall('getMySubjects', {}, 20000); } catch (e) {}
    busy = false;
    if (!r || !r.success) return;
    const prev = read(sid);
    const v = { grade: r.grade, subjects: r.subjects, at: Date.now() };
    try { localStorage.setItem(key(sid), JSON.stringify(v)); } catch (e) {}
    if (!prev || JSON.stringify(prev.subjects) !== JSON.stringify(v.subjects)) {
      try { if (typeof renderHomeF === 'function') renderHomeF(); } catch (e) {}
      try { if (typeof renderSkillRadarChart === 'function' && document.getElementById('skillRadarChart')) renderSkillRadarChart(); } catch (e) {}
    }
  }
  window.k8MySubjects = function (all) {
    all = Array.isArray(all) ? all : [];
    const sid = sidOf(); if (!sid) return all;
    let adm = null; try { adm = currentAdmin; } catch (e) {}
    const c = read(sid);
    if (!c || Date.now() - (c.at || 0) > 10 * 60 * 1000) refresh(sid);
    if (!c || !Array.isArray(c.subjects)) return []; // v17.60 · แสดงเฉพาะวิชาที่อยู่ในตารางเรียนเท่านั้น (ยังไม่มีตาราง = ยังไม่มีวิชา)
    const out = [], used = {};
    c.subjects.forEach((t) => {
      const m = all.find((s) => (t.id && (String(s.id) === t.id || String(s.code) === t.id)) || String(s.name).trim() === String(t.name).trim());
      const x = m || { id: t.id || ('tt:' + t.name), name: t.name };
      if (used[x.id]) return; used[x.id] = 1; out.push(x);
    });
    return out;
  };
  window.k8MySubjectsInfo = function () {
    const sid = sidOf(); const c = sid ? read(sid) : null;
    if (!c) return 'กำลังโหลดรายวิชาจากตารางเรียน…';
    if (!Array.isArray(c.subjects)) return 'ยังไม่มีวิชาในตารางเรียนของคุณ · รอแอดมินจัดตารางเรียน';
    return 'วิชาของชั้น ม.' + (c.grade || '-') + ' ตามตารางเรียน · ' + c.subjects.length + ' วิชา';
  };
})();
try { navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'k8-open-notif' && typeof window.k8NotifOpen === 'function') window.k8NotifOpen(); }); } catch (e) {}

/* ---------- v17.18 · ผลบุญ: แอดมินเลือกนักเรียนแล้วบันทึกด้วยหน้าเดิม (ท่องจำซูเราะห์ · ยุซ · สุนัต) · นักเรียนดูได้อย่างเดียว ---------- */
(function () {
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (v) => String(v == null ? '' : v).replace(/\D/g, '').replace(/^0+/, '');
  const gnum = (g) => { const m = String(g || '').match(/([1-6])/); return m ? m[1] : ''; };
  const girl = (s) => (typeof window.k8IsGirl === 'function' ? window.k8IsGirl(s) : /^\s*(นางสาว|นาง|เด็กหญิง|ด\.ญ\.)/.test(String(s && s.fullName || '')));
  const A = { grade: 'ALL', q: '' };
  const PER_JUZ = 20;
  function students() {
    let all = []; try { all = allStudents || []; } catch (e) {}
    // ผู้ชายขึ้นก่อน แล้วเรียงตามชั้นและชื่อ
    return all.filter((s) => s && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(s.status || '')))
      .sort((a, b) => (girl(a) - girl(b)) || gnum(a.grade).localeCompare(gnum(b.grade)) || String(a.fullName || '').localeCompare(String(b.fullName || ''), 'th'));
  }
  function summary(s) {
    let h = null; try { const all = JSON.parse(localStorage.getItem('khalifah_student_hasanat') || '{}'); h = all[Object.keys(all).find((k) => norm(k) === norm(s.studentId))] || null; } catch (e) {}
    const page = Number(h && h.quran && h.quran.currentPage) || 0;
    const mem = h && h.memorization ? (Array.isArray(h.memorization.memorizedSurahs) ? h.memorization.memorizedSurahs.length : Number(h.memorization.count) || 0) : 0;
    return 'ยุซที่ ' + Math.min(30, Math.floor(page / PER_JUZ) + 1) + ' · หน้า ' + page + ' · ท่องจำ ' + mem + ' ซูเราะห์';
  }
  function host() { return document.getElementById('k8HaAdmin'); }
  function homeBack() { const k = document.getElementById('k8Has'), v = document.getElementById('view-hasanat'); if (k && v && k.parentElement !== v) v.appendChild(k); }
  function renderPicker() {
    const el = host(); if (!el) return;
    homeBack(); window.k8HasTarget = null;
    const list = students().filter((s) => (A.grade === 'ALL' || gnum(s.grade) === A.grade) && (!A.q || (String(s.fullName || '') + ' ' + s.studentId).toLowerCase().indexOf(A.q.toLowerCase()) !== -1));
    let lastG = null;
    el.innerHTML = '<header class="k8-pr-head"><div><h1>บันทึกผลบุญ</h1><p>เลือกนักเรียน แล้วบันทึกการอ่านอัลกุรอาน (ยุซ/หน้า) ซูเราะห์ที่ท่องจำ และละหมาดสุนัต · นักเรียนดูได้อย่างเดียว</p></div></header>' +
      '<section class="k8-pr-bar"><div class="k8-pr-grades" role="tablist">' + ['ALL', '1', '2', '3', '4', '5', '6'].map((g) => '<button type="button" role="tab" aria-selected="' + (A.grade === g) + '" onclick="k8HaGrade(\'' + g + '\')">' + (g === 'ALL' ? 'ทุกชั้น' : 'ม.' + g) + '</button>').join('') + '</div>' +
      '<input type="search" class="k8-pr-q" placeholder="ค้นหาชื่อหรือรหัสนักเรียน" value="' + esc(A.q) + '" oninput="k8HaQ(this.value)"></section>' +
      (list.length ? '<ul class="k8-hp-list">' + list.map((s) => {
        const g = girl(s) ? 'F' : 'M'; let head = '';
        if (g !== lastG) { head = '<li class="k8-hp-sec">' + (g === 'M' ? 'นักเรียนชาย' : 'นักเรียนหญิง') + '</li>'; lastG = g; }
        return head + '<li><button type="button" onclick="k8HaPick(\'' + esc(s.studentId) + '\')"><span class="k8-hp-av">' + esc(String(s.fullName || '?').replace(/^(นางสาว|นาง|นาย|เด็กหญิง|เด็กชาย|ด\.ญ\.|ด\.ช\.)\s*/, '').charAt(0)) + '</span><span class="k8-hp-t"><b>' + esc(s.fullName || s.studentId) + '</b><small>ม.' + esc(gnum(s.grade) || '-') + ' · ' + esc(summary(s)) + '</small></span><span class="k8-hp-go" aria-hidden="true">›</span></button></li>';
      }).join('') + '</ul>' : '<p class="k8-li-empty">ไม่พบนักเรียน</p>');
  }
  window.k8HaGrade = function (g) { A.grade = g; renderPicker(); };
  window.k8HaQ = function (v) { A.q = v; renderPicker(); const q = document.querySelector('#k8HaAdmin .k8-pr-q'); if (q) { q.focus(); q.setSelectionRange(v.length, v.length); } };
  window.k8HaPick = function (id) {
    let s = null; try { s = (allStudents || []).find((x) => norm(x.studentId) === norm(id)); } catch (e) {}
    if (!s) return;
    const el = host(), k = document.getElementById('k8Has'); if (!el || !k) return;
    window.k8HasTarget = s;
    el.innerHTML = ''; el.appendChild(k);
    try { const S = window.k8HasState; if (S) { const d = new Date(); S.date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); S.add = 0; S.sun = null; S.editPage = false; } } catch (e) {}
    try { window.renderHasanatV9(); } catch (e) {}
    window.scrollTo(0, 0);
  };
  window.k8HasBack = function () { renderPicker(); window.scrollTo(0, 0); };
  const sat = window.switchAdminTab;
  if (typeof sat === 'function') window.switchAdminTab = function (tab) {
    if (tab !== 'hasanat-admin' && window.k8HasTarget) { homeBack(); window.k8HasTarget = null; }
    const r = sat.apply(this, arguments);
    if (tab === 'hasanat-admin') renderPicker();
    return r;
  };
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) { if (window.k8HasTarget) { homeBack(); window.k8HasTarget = null; } return sv.apply(this, arguments); };
})();

/* ---------- v17.21 · รูปหลักฐาน: ย่อขนาด + แถบบอกที่มา (ถ่ายจากกล้อง/แนบจากเครื่อง) ---------- */
window.k8EvidencePhoto = function (file, mode) {
  return new Promise((resolve, reject) => {
    const fresh = file.lastModified && Math.abs(Date.now() - file.lastModified) < 3 * 60 * 1000;
    const src = mode === 'camera' && fresh ? 'camera' : 'gallery';
    const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const rd = new FileReader();
    rd.onerror = reject;
    rd.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const max = 1000; let w = img.width, h = img.height;
        if (w > h && w > max) { h = Math.round(h * max / w); w = max; } else if (h > max) { w = Math.round(w * max / h); h = max; }
        const bar = Math.max(30, Math.round(w * 0.06));
        const c = document.createElement('canvas'); c.width = w; c.height = h + bar; const x = c.getContext('2d');
        x.drawImage(img, 0, 0, w, h);
        const d = new Date();
        x.fillStyle = src === 'camera' ? '#0369a1' : '#b45309'; x.fillRect(0, h, w, bar);
        x.fillStyle = '#fff'; x.font = '600 ' + Math.round(bar * 0.5) + 'px "IBM Plex Sans Thai", sans-serif'; x.textBaseline = 'middle';
        x.fillText((src === 'camera' ? 'ถ่ายจากกล้อง' : 'แนบจากเครื่อง') + ' · ' + d.getDate() + ' ' + M[d.getMonth()] + ' ' + (d.getFullYear() + 543) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' น.', Math.round(bar * 0.4), h + bar / 2);
        resolve({ data: c.toDataURL('image/jpeg', 0.72), src: src });
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
};

/* ---------- v17.23 · แตะแท่งกราฟละหมาด → ประวัติการบันทึก ---------- */
window.k8HfBarOpen = function (id, date) {
  if (id && typeof openPrayerHistoryDetailModal === 'function') { try { openPrayerHistoryDetailModal(id); return; } catch (e) {} }
  try { switchView('prayer'); } catch (e) {}
  setTimeout(() => {
    const inp = document.getElementById('filterPrayerDateBottom');
    if (inp && date) inp.value = date;
    try { renderPrayerHistory(date || null); } catch (e) {}
    const sec = document.getElementById('prayerHistoryBottomSection');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);
};

/* ---------- v17.26 · ลงทะเบียนรายวิชา: อาจารย์เปิด QR/ลิงก์ · นักเรียนดึงจากระบบหรือสแกน ---------- */
(function () {
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t) => { try { showToast(m, t || 'info'); } catch (e) {} };
  const adm = () => { try { return currentAdmin || null; } catch (e) { return null; } };
  const stu = () => { try { return currentStudent || null; } catch (e) { return null; } };
  const shortG = (g) => { const m = String(g || '').match(/([1-6])/); return m ? 'ม.' + m[1] : String(g || ''); };
  const T = { subj: null, room: null, busy: false };
  const linkOf = (code) => location.origin + location.pathname.replace(/index\.html$/, '') + '?enroll=' + encodeURIComponent(code);
  const parseCode = (txt) => { const t = String(txt || '').trim(); let m = t.match(/[?&]enroll=([A-Za-z0-9]+)/); if (m) return m[1].toUpperCase(); m = t.match(/^KHALIFAH_ENROLL:([A-Za-z0-9]+)/i); if (m) return m[1].toUpperCase(); if (/^[A-Za-z0-9]{6}$/.test(t)) return t.toUpperCase(); return ''; };
  window.k8EnParse = parseCode;

  // ===== อาจารย์ =====
  function mySubjects() {
    let subs = []; try { loadAppSubjects(); subs = appSubjects || []; } catch (e) {}
    return window.k8TeacherSubjects ? window.k8TeacherSubjects(adm()) : subs; // v17.60
  }
  function placeBtn() {
    const q = document.querySelector('#teacher-tab-overview .k8-th-quick'); if (!q || q.querySelector('.k8-en-qbtn')) return;
    const lv = q.querySelector('.k8-lv-qbtn');
    const html = '<button type="button" class="k8-en-qbtn" onclick="k8EnOpen()"><span style="background:#e0f2fe;color:#0369a1"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4M20 17v4"/></svg></span>ลงทะเบียนวิชา</button>';
    if (lv) lv.insertAdjacentHTML('beforebegin', html); else q.insertAdjacentHTML('beforeend', html);
  }
  function renderT() {
    const el = document.getElementById('k8EnBody'); if (!el) return;
    const subs = mySubjects();
    let h = '<div class="k8-en-subjs" role="tablist" aria-label="เลือกวิชา">' + (subs.length ? subs.map((x) => '<button type="button" role="tab" aria-selected="' + (T.subj && String(T.subj.id) === String(x.id)) + '" onclick="k8EnPick(\'' + esc(x.id) + '\')">' + esc(x.name) + '</button>').join('') : '<p class="k8-li-empty">ยังไม่มีวิชาที่ได้รับมอบหมาย · ติดต่อแอดมิน</p>') + '</div>';
    if (!T.subj) h += '<p class="k8-en-hint">เลือกวิชาที่สอน แล้วระบบจะสร้าง QR Code และลิงก์ให้นักเรียนลงทะเบียน</p>';
    else if (T.busy && !T.room) h += '<p class="k8-li-empty">กำลังเปิดห้องลงทะเบียน…</p>';
    else if (T.room) {
      const R = T.room, link = linkOf(R.code);
      h += '<section class="k8-en-qr' + (R.open ? '' : ' is-closed') + '"><div id="k8EnQr" class="k8-en-qrbox" aria-label="QR Code ลงทะเบียน ' + esc(T.subj.name) + '"></div>' +
        '<div class="k8-en-info"><span>รหัสลงทะเบียน</span><b class="k8-en-code">' + esc(R.code) + '</b><span class="k8-en-st">' + (R.open ? '● เปิดรับลงทะเบียน' : '● ปิดรับแล้ว') + '</span>' +
        '<div class="k8-en-link"><input type="text" readonly value="' + esc(link) + '" onclick="this.select()" aria-label="ลิงก์ลงทะเบียน"><button type="button" onclick="k8EnCopy()">คัดลอก</button>' + (navigator.share ? '<button type="button" onclick="k8EnShare()">แชร์</button>' : '') + '</div>' +
        '<button type="button" class="k8-en-toggle' + (R.open ? '' : ' is-open') + '" onclick="k8EnToggle(' + (R.open ? 'false' : 'true') + ')">' + (R.open ? 'ปิดรับลงทะเบียน' : 'เปิดรับลงทะเบียนอีกครั้ง') + '</button></div></section>' +
        '<section class="k8-en-list"><div class="k8-en-lh"><b>ลงทะเบียนแล้ว ' + R.students.length + ' คน</b><button type="button" onclick="k8EnPick(\'' + esc(T.subj.id) + '\')">↻ รีเฟรช</button></div>' +
        (R.students.length ? '<ul>' + R.students.map((x) => '<li><span><b>' + esc(x.fullName) + '</b><small>' + esc(shortG(x.grade)) + ' · ' + esc(x.studentId) + ' · ' + (x.via === 'qr' ? 'สแกน/ลิงก์' : 'ดึงจากระบบ') + '</small>' + (x.reason ? '<em class="k8-en-why">' + (x.reason === 'repeat' ? 'เรียนซ้ำชั้น' : 'แก้เกรด') + '</em>' : '') + '</span><button type="button" onclick="k8EnRemove(\'' + esc(x.studentId) + '\')" aria-label="นำออก">นำออก</button></li>').join('') + '</ul>' : '<p class="k8-li-empty">ยังไม่มีนักเรียนลงทะเบียน · ให้นักเรียนสแกน QR หรือเปิดลิงก์</p>') + '</section>';
    }
    el.innerHTML = h;
    if (T.room) {
      const box = document.getElementById('k8EnQr');
      if (box && window.QRCode) { try { new QRCode(box, { text: linkOf(T.room.code), width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M }); } catch (e) {} }
      else if (box) box.innerHTML = '<p class="k8-li-empty">โหลดตัวสร้าง QR ไม่ได้ · ใช้ลิงก์หรือรหัสด้านขวาแทน</p>';
    }
    const sub = document.getElementById('k8EnSub'); if (sub) sub.textContent = T.subj ? T.subj.name : 'เปิด QR / ลิงก์ ให้นักเรียนลงทะเบียน';
  }
  window.k8EnOpen = function () { const subs = mySubjects(); if (!T.subj && subs.length === 1) { window.k8EnPick(subs[0].id); } renderT(); try { openModal('k8EnModal'); } catch (e) {} };
  window.k8EnPick = async function (id) {
    const x = mySubjects().find((y) => String(y.id) === String(id)); if (!x) return;
    if (!T.subj || String(T.subj.id) !== String(id)) T.room = null;
    T.subj = x; T.busy = true; renderT();
    let r = null; try { r = await gasApiCall('getEnrollRoom', { data: { subjectId: x.id, subjectName: x.name } }, 25000); } catch (e) {}
    T.busy = false;
    if (r && r.success) T.room = { code: r.code, open: r.open, students: r.students || [] };
    else toast((r && (r.message || r.error)) || 'เปิดห้องลงทะเบียนไม่ได้ · Deploy Code.gs ตัวล่าสุดก่อน', 'error');
    renderT();
  };
  window.k8EnCopy = function () { const l = linkOf(T.room.code); try { navigator.clipboard.writeText(l); toast('คัดลอกลิงก์แล้ว', 'success'); } catch (e) { toast(l, 'info'); } };
  window.k8EnShare = function () { try { navigator.share({ title: 'ลงทะเบียนวิชา ' + T.subj.name, text: 'ลงทะเบียนวิชา ' + T.subj.name + ' รหัส ' + T.room.code, url: linkOf(T.room.code) }); } catch (e) {} };
  window.k8EnToggle = async function (open) {
    let r = null; try { r = await gasApiCall('setEnrollOpen', { data: { subjectId: T.subj.id, open: !!open } }, 20000); } catch (e) {}
    if (r && r.success) { T.room.open = r.open; toast(r.message, 'success'); renderT(); } else toast((r && r.message) || 'ไม่สำเร็จ', 'error');
  };
  window.k8EnRemove = async function (sid) {
    if (!confirm('นำนักเรียนคนนี้ออกจากรายวิชา?')) return;
    let r = null; try { r = await gasApiCall('removeEnrollment', { data: { subjectId: T.subj.id, studentId: sid } }, 20000); } catch (e) {}
    if (r && r.success) { T.room.students = r.students || []; toast(r.message, 'success'); renderT(); try { window.k8TaLoadEnroll && window.k8TaLoadEnroll(true); } catch (e) {} } else toast((r && r.message) || 'ไม่สำเร็จ', 'error');
  };
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) { const r = sv.apply(this, arguments); if (v === 'teacher') setTimeout(placeBtn, 300); if (v === 'profile') setTimeout(paintCard, 100); return r; };
  const st = window.switchTeacherTab;
  if (typeof st === 'function') window.switchTeacherTab = function (t) { const r = st.apply(this, arguments); if (t === 'overview') setTimeout(placeBtn, 300); if (t === 'attendance') { try { window.k8TaLoadEnroll && window.k8TaLoadEnroll(true); } catch (e) {} } return r; };
  let tries = 0; const iv = setInterval(() => { placeBtn(); if (++tries > 20 || document.querySelector('.k8-en-qbtn')) clearInterval(iv); }, 1500);

  // ===== นักเรียน =====
  const N = { my: null, mode: 'home', sel: new Set(), busy: false, stream: null, raf: 0, pending: '' };
  async function loadMine() {
    let r = null; try { r = await gasApiCall('getMyEnrollments', {}, 20000); } catch (e) {}
    if (r && r.success) N.my = r; else if (!N.my) N.my = { enrolled: [], available: [], err: (r && (r.message || r.error)) || 'net' };
    paintCard(); renderS();
  }
  function paintCard() {
    const sub = document.getElementById('k8EnCardSub'); if (!sub) return;
    const n = N.my && N.my.enrolled ? N.my.enrolled.length : 0;
    sub.textContent = n ? 'ลงทะเบียนแล้ว ' + n + ' วิชา · แตะเพื่อเพิ่ม' : 'ดึงวิชาจากระบบ หรือสแกน QR ของอาจารย์';
  }
  function renderS() {
    const el = document.getElementById('k8EnStuBody'); if (!el) return;
    if (!N.my) { el.innerHTML = '<p class="k8-li-empty">กำลังโหลด…</p>'; return; }
    const enrolledIds = new Set((N.my.enrolled || []).map((x) => String(x.subjectId)));
    let h = '';
    if (N.mode === 'scan') {
      h += '<div class="k8-en-scan"><video id="k8EnVideo" playsinline muted></video><div class="k8-en-frame" aria-hidden="true"></div></div><p class="k8-en-hint" id="k8EnScanMsg">เล็งกล้องไปที่ QR Code ของอาจารย์</p>' +
        '<div class="k8-en-row"><label class="k8-en-alt"><input type="file" accept="image/*" onchange="k8EnScanFile(this)">เลือกรูป QR จากเครื่อง</label><button type="button" class="k8-en-alt" onclick="k8EnMode(\'home\')">กลับ</button></div>';
    } else if (N.mode === 'system') {
      const av = (N.my.available || []).filter((x) => !enrolledIds.has(String(x.id)));
      h += '<p class="k8-en-hint">' + (N.my.fromTimetable ? 'วิชาของชั้นคุณตามตารางเรียน' : 'ยังไม่มีตารางเรียนของชั้นคุณ') + ' · เลือกวิชาที่จะลงทะเบียน</p>' +
        (av.length ? '<ul class="k8-en-pick">' + av.map((x) => { const on = N.sel.has(String(x.id)); return '<li><button type="button" role="checkbox" aria-checked="' + on + '" onclick="k8EnSel(\'' + esc(x.id) + '\')"><span class="k8-ro-chk">' + (on ? '✓' : '') + '</span><b>' + esc(x.name) + '</b></button></li>'; }).join('') + '</ul>' +
          '<div class="k8-en-row"><button type="button" class="k8-en-alt" onclick="k8EnMode(\'home\')">กลับ</button><button type="button" class="k8-en-pri" onclick="k8EnSysSave()"' + (N.sel.size && !N.busy ? '' : ' disabled') + '>' + (N.busy ? 'กำลังลงทะเบียน…' : 'ลงทะเบียน ' + N.sel.size + ' วิชา') + '</button></div>'
          : '<p class="k8-li-empty">' + ((N.my.available || []).length ? 'ลงทะเบียนครบทุกวิชาจากระบบแล้ว' : 'ระบบยังไม่มีวิชาของชั้นคุณ · ใช้วิธีสแกน QR ของอาจารย์') + '</p><div class="k8-en-row"><button type="button" class="k8-en-alt" onclick="k8EnMode(\'home\')">กลับ</button></div>');
    } else {
      h += '<div class="k8-en-ways"><button type="button" onclick="k8EnMode(\'system\')"><span>📚</span><b>ดึงจากระบบ</b><small>วิชาของชั้นคุณตามตารางเรียน</small></button><button type="button" onclick="k8EnMode(\'scan\')"><span>📷</span><b>สแกนเพื่อลงทะเบียน</b><small>สแกน QR Code ของอาจารย์</small></button></div>' +
        '<div class="k8-en-row k8-en-codein"><input type="text" id="k8EnCodeIn" maxlength="6" placeholder="หรือกรอกรหัส 6 ตัว" autocomplete="off" autocapitalize="characters" value="' + esc(N.pending || '') + '"><button type="button" class="k8-en-pri" onclick="k8EnCode()"' + (N.busy ? ' disabled' : '') + '>ลงทะเบียน</button></div>' +
        '<section class="k8-en-list"><div class="k8-en-lh"><b>วิชาที่ลงทะเบียนแล้ว ' + (N.my.enrolled || []).length + ' วิชา</b></div>' + ((N.my.enrolled || []).length ? '<ul>' + N.my.enrolled.map((x) => '<li><span><b>' + esc(x.name) + '</b><small>' + (x.teacher ? esc(x.teacher) + ' · ' : '') + (x.via === 'qr' ? 'สแกน/ลิงก์' : 'ดึงจากระบบ') + ' · ' + esc(String(x.at || '').slice(0, 10)) + '</small>' + (x.reason ? '<em class="k8-en-why">' + (x.reason === 'repeat' ? 'เรียนซ้ำชั้น' : 'แก้เกรด') + '</em>' : '') + '</span><span class="k8-en-ok">✓</span></li>').join('') + '</ul>' : '<p class="k8-li-empty">ยังไม่ได้ลงทะเบียนวิชาใด</p>') + '</section>';
    }
    if (N.warn && N.mode === 'home') h = '<div class="k8-en-warn" role="alert"><b>⚠ วิชานี้มีอยู่แล้ว</b><span>' + esc(N.warn) + '</span>' +
      (N.retake ? '<span class="k8-en-rt-q">ถ้าต้องการเรียนวิชานี้อีกครั้ง เลือกเหตุผล:</span><div class="k8-en-rt"><button type="button" onclick="k8EnRetake(\'repeat\')"' + (N.busy ? ' disabled' : '') + '>เรียนซ้ำชั้น</button><button type="button" onclick="k8EnRetake(\'regrade\')"' + (N.busy ? ' disabled' : '') + '>เรียนเพื่อแก้เกรด</button></div>' : '') + '</div>' + h; // v17.60–61
    el.innerHTML = h;
    if (N.mode === 'scan') startScan();
  }
  function stopScan() { try { cancelAnimationFrame(N.raf); } catch (e) {} if (N.stream) { N.stream.getTracks().forEach((t) => t.stop()); N.stream = null; } }
  async function startScan() {
    const v = document.getElementById('k8EnVideo'); if (!v) return;
    try { N.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); } catch (e) { const m = document.getElementById('k8EnScanMsg'); if (m) m.textContent = 'เปิดกล้องไม่ได้ · อนุญาตการใช้กล้อง หรือเลือกรูป QR จากเครื่องแทน'; return; }
    v.srcObject = N.stream; try { await v.play(); } catch (e) {}
    const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
    const tick = () => {
      if (!N.stream || N.mode !== 'scan') return;
      if (v.readyState >= 2 && window.jsQR) {
        c.width = v.videoWidth; c.height = v.videoHeight; x.drawImage(v, 0, 0, c.width, c.height);
        const d = x.getImageData(0, 0, c.width, c.height); const q = jsQR(d.data, d.width, d.height, { inversionAttempts: 'dontInvert' });
        if (q && q.data) { const code = parseCode(q.data); if (code) { stopScan(); try { navigator.vibrate && navigator.vibrate(60); } catch (e) {} enrollCode(code); return; } }
      }
      N.raf = requestAnimationFrame(tick);
    };
    N.raf = requestAnimationFrame(tick);
  }
  async function enrollCode(code, retake) {
    N.busy = true; N.mode = 'home'; N.pending = retake ? '' : code; renderS();
    let r = null; try { r = await gasApiCall('enrollSubject', { data: retake ? { code: code, retake: retake } : { code: code } }, 25000); } catch (e) {}
    N.busy = false;
    N.warn = ''; N.retake = null;
    if (r && r.success) { N.my = r; N.pending = ''; if (r.warn) { N.warn = r.message; N.retake = r.canRetake ? { code: r.code, name: r.subjectName } : null; toast(r.message, 'warning'); } else toast(r.message, 'success'); } else toast((r && (r.message || r.error)) || 'ลงทะเบียนไม่สำเร็จ', 'error');
    paintCard(); renderS();
  }
  window.k8EnStuOpen = function (code) { if (!stu()) { toast('กรุณาเข้าสู่ระบบนักเรียนก่อน', 'warning'); return; } N.mode = 'home'; N.warn = ''; if (code) N.pending = code; renderS(); try { openModal('k8EnStuModal'); } catch (e) {} loadMine().then(() => { if (code) enrollCode(code); }); };
  window.k8EnStuClose = function () { stopScan(); N.mode = 'home'; try { closeModal('k8EnStuModal'); } catch (e) {} };
  window.k8EnMode = function (m) { stopScan(); N.mode = m; N.warn = ''; if (m === 'system') { N.sel = new Set(((N.my && N.my.available) || []).filter((x) => !((N.my.enrolled || []).some((y) => String(y.subjectId) === String(x.id)))).map((x) => String(x.id))); } renderS(); };
  window.k8EnSel = function (id) { if (N.sel.has(id)) N.sel.delete(id); else N.sel.add(id); renderS(); };
  window.k8EnSysSave = async function () {
    if (!N.sel.size) return; N.busy = true; renderS();
    let r = null; try { r = await gasApiCall('enrollSubject', { data: { subjectIds: Array.from(N.sel) } }, 25000); } catch (e) {}
    N.busy = false;
    if (r && r.success) { N.my = r; N.mode = 'home'; toast(r.message, 'success'); } else toast((r && (r.message || r.error)) || 'ลงทะเบียนไม่สำเร็จ · Deploy Code.gs ตัวล่าสุดก่อน', 'error');
    paintCard(); renderS();
  };
  window.k8EnRetake = function (why) { if (!N.retake || N.busy) return; enrollCode(N.retake.code, why); };
  window.k8EnCode = function () { const c = parseCode((document.getElementById('k8EnCodeIn') || {}).value || ''); if (!c) { toast('รหัสลงทะเบียนมี 6 ตัวอักษร', 'warning'); return; } enrollCode(c); };
  window.k8EnScanFile = function (input) {
    const f = input.files && input.files[0]; if (!f) return;
    const rd = new FileReader(); rd.onload = () => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height); const q = window.jsQR ? jsQR(d.data, d.width, d.height) : null; const code = q && parseCode(q.data); if (code) { stopScan(); enrollCode(code); } else toast('ไม่พบ QR ลงทะเบียนในรูปนี้', 'warning'); }; img.src = rd.result; }; rd.readAsDataURL(f);
  };
  // สแกน QR ลงทะเบียนด้วยตัวสแกนกิจกรรมเดิม → ส่งต่อมาที่นี่
  const hq = window.handleQrCodeDetected;
  if (typeof hq === 'function') window.handleQrCodeDetected = function (data) { const c = parseCode(data); if (c && /enroll/i.test(String(data))) { window.k8EnStuOpen(c); return; } return hq.apply(this, arguments); };
  // เปิดจากลิงก์ ?enroll=CODE (หรือสแกนด้วยกล้องมือถือ)
  let urlCode = ''; try { urlCode = (new URLSearchParams(location.search).get('enroll') || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); } catch (e) {}
  if (urlCode) {
    try { sessionStorage.setItem('k8_enroll_pending', urlCode); history.replaceState(null, '', location.pathname); } catch (e) {}
  }
  setInterval(() => {
    let pend = ''; try { pend = sessionStorage.getItem('k8_enroll_pending') || ''; } catch (e) {}
    if (!pend) return;
    if (adm() && !stu()) { try { sessionStorage.removeItem('k8_enroll_pending'); } catch (e) {} return; }
    if (!stu()) return;
    try { sessionStorage.removeItem('k8_enroll_pending'); } catch (e) {}
    try { switchView('profile'); } catch (e) {}
    window.k8EnStuOpen(pend);
  }, 1200);
  window.k8EnLoadMine = loadMine;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(() => { if (stu()) loadMine(); }, 2500)); else setTimeout(() => { if (stu()) loadMine(); }, 2500);
})();

/* ---------- v17.28 · แตะกากบาท (หมดเวลาไม่ได้เช็ค) → แจ้งว่าเช็คชื่อย้อนหลังไม่ได้ ---------- */
window.k8HfMiss = function (slot) {
  let end = '';
  try { const w = PRAYER_TIME_WINDOWS.find((x) => (x.key || x.name) === slot); if (w) end = String(Math.floor(w.endMin / 60)).padStart(2, '0') + ':' + String(w.endMin % 60).padStart(2, '0'); } catch (e) {}
  try { showToast('หมดเวลาละหมาด' + slot + (end ? 'แล้ว (หมดเวลา ' + end + ' น.)' : 'แล้ว') + ' · เช็คชื่อย้อนหลังไม่ได้', 'warning'); } catch (e) {}
  try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) {}
};

/* ---------- v17.36 · สร้างกิจกรรม: เลือกกลุ่มเป้าหมาย ทุกคน / เฉพาะชั้นปี / รายบุคคล ---------- */
(function () {
  const A = { type: 'all', grades: [], students: [], q: '' };
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t) => { try { showToast(m, t || 'info'); } catch (e) {} };
  const gNum = (g) => { const m = String(g || '').match(/([1-6])/); return m ? m[1] : ''; };
  const cid = (v) => String(v == null ? '' : v).trim().replace(/^0+/, '');
  function parseAud(a) { if (typeof a === 'string') { try { a = JSON.parse(a); } catch (e) { a = null; } } return a && (a.type === 'grades' || a.type === 'students') ? a : null; }
  // กิจกรรมนี้สำหรับนักเรียนที่ล็อกอินอยู่ไหม (แอดมิน/อาจารย์เห็นทุกกิจกรรม)
  window.k8ActForMe = function (act, stu) {
    const a = parseAud(act && act.audience); if (!a) return true;
    let st = stu; if (!st) { try { st = currentStudent; } catch (e) {} } if (!st) return true;
    let adm = null; try { adm = currentAdmin; } catch (e) {} if (adm && !stu) return true;
    if (a.type === 'grades') return (a.grades || []).map(String).indexOf(gNum(st.grade)) !== -1;
    return (a.students || []).some((x) => cid(x.id || x) === cid(st.studentId));
  };
  window.k8ActAudLabel = function (act) {
    const a = parseAud(act && act.audience); if (!a) return 'ทุกคน';
    if (a.type === 'grades') return 'ม.' + (a.grades || []).join(', ม.');
    return 'รายบุคคล ' + (a.students || []).length + ' คน';
  };
  function pool() { let l = []; try { l = allStudents; } catch (e) {} if (!Array.isArray(l) || !l.length) { try { l = JSON.parse(localStorage.getItem('khalifah_students') || '[]'); } catch (e) { l = []; } } return (l || []).filter((s) => s && s.studentId && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(s.status || ''))); }
  function render() {
    const box = document.getElementById('k8ActAud'); if (!box) return;
    const seg = [['all', 'ทุกคน'], ['grades', 'เฉพาะชั้นปี'], ['students', 'รายบุคคล']].map(([k, l]) => '<button type="button" role="radio" aria-checked="' + (A.type === k) + '" class="' + (A.type === k ? 'on' : '') + '" onclick="k8AudType(\'' + k + '\')">' + l + '</button>').join('');
    let h = '<div class="k8-aud-h"><span class="form-label">กลุ่มเป้าหมาย</span><div class="k8-aud-seg" role="radiogroup" aria-label="กลุ่มเป้าหมาย">' + seg + '</div></div>';
    if (A.type === 'grades') {
      h += '<div class="k8-aud-grades">' + [1, 2, 3, 4, 5, 6].map((g) => { const on = A.grades.indexOf(String(g)) !== -1; const n = pool().filter((s) => gNum(s.grade) === String(g)).length; return '<button type="button" aria-pressed="' + on + '" class="' + (on ? 'on' : '') + '" onclick="k8AudGrade(' + g + ')">ม.' + g + '<small>' + n + ' คน</small></button>'; }).join('') + '</div>';
      h += '<p class="k8-aud-sum">' + (A.grades.length ? 'นักเรียนชั้น ม.' + A.grades.join(', ม.') + ' เห็นและเช็คชื่อกิจกรรมนี้ได้ (รวม ' + pool().filter((s) => A.grades.indexOf(gNum(s.grade)) !== -1).length + ' คน)' : 'แตะเลือกชั้นปีได้มากกว่า 1 ชั้น') + '</p>';
    } else if (A.type === 'students') {
      const q = A.q.trim().toLowerCase(), sel = {}; A.students.forEach((x) => { sel[cid(x.id)] = 1; });
      const list = pool().filter((s) => !q || String(s.fullName || '').toLowerCase().indexOf(q) !== -1 || String(s.studentId).indexOf(q) !== -1).sort((a, b) => (gNum(a.grade) - gNum(b.grade)) || String(a.fullName).localeCompare(String(b.fullName), 'th')).slice(0, 60);
      h += (A.students.length ? '<div class="k8-aud-chips">' + A.students.map((x) => '<span>' + esc(x.name || x.id) + '<button type="button" aria-label="เอาออก" onclick="k8AudStu(\'' + esc(x.id) + '\')">×</button></span>').join('') + '</div>' : '');
      h += '<input type="search" class="form-control k8-aud-q" id="k8AudQ" placeholder="ค้นหาชื่อหรือรหัสนักเรียน" value="' + esc(A.q) + '" oninput="k8AudSearch(this.value)">';
      h += '<div class="k8-aud-list">' + (list.length ? list.map((s) => { const on = !!sel[cid(s.studentId)]; return '<label class="' + (on ? 'on' : '') + '"><input type="checkbox" ' + (on ? 'checked' : '') + ' onchange="k8AudStu(\'' + esc(s.studentId) + '\')"><span><b>' + esc(s.fullName || s.studentId) + '</b><small>' + esc(s.studentId) + ' · ม.' + (gNum(s.grade) || '-') + '</small></span></label>'; }).join('') : '<p class="k8-aud-empty">ไม่พบนักเรียน</p>') + '</div>';
      h += '<p class="k8-aud-sum">' + (A.students.length ? 'เลือกแล้ว ' + A.students.length + ' คน · เฉพาะคนที่เลือกเห็นและเช็คชื่อได้' : 'ติ๊กเลือกนักเรียนที่ต้องเข้าร่วม') + '</p>';
    } else h += '<p class="k8-aud-sum">นักเรียนทุกคนเห็นและเช็คชื่อกิจกรรมนี้ได้</p>';
    box.innerHTML = h;
    const btn = document.getElementById('btnAdminCreateAct');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-qrcode"></i> บันทึกกิจกรรม' + (A.type === 'all' ? '' : ' (' + (A.type === 'grades' ? (A.grades.length ? 'ม.' + A.grades.join(', ม.') : 'ยังไม่เลือกชั้น') : A.students.length + ' คน') + ')') + ' และเปิด QR Code ทันที';
  }
  window.k8AudType = function (t) { A.type = t; render(); };
  window.k8AudGrade = function (g) { g = String(g); const i = A.grades.indexOf(g); if (i === -1) A.grades.push(g); else A.grades.splice(i, 1); A.grades.sort(); render(); };
  window.k8AudStu = function (id) {
    const i = A.students.findIndex((x) => cid(x.id) === cid(id));
    if (i !== -1) A.students.splice(i, 1);
    else { const s = pool().find((x) => cid(x.studentId) === cid(id)); if (s) A.students.push({ id: String(s.studentId), name: s.fullName || '' }); }
    render(); const q = document.getElementById('k8AudQ'); if (q && A.q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  };
  window.k8AudSearch = function (v) { A.q = v || ''; render(); const q = document.getElementById('k8AudQ'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } };
  function current() { return A.type === 'grades' ? { type: 'grades', grades: A.grades.slice() } : A.type === 'students' ? { type: 'students', students: A.students.slice() } : { type: 'all' }; }
  // ส่งกลุ่มเป้าหมายไปพร้อมกิจกรรม
  const oc = window.adminCreateNewActivity;
  if (typeof oc === 'function') window.adminCreateNewActivity = function () {
    if (A.type === 'grades' && !A.grades.length) { toast('เลือกชั้นปีอย่างน้อย 1 ชั้น', 'warning'); return; }
    if (A.type === 'students' && !A.students.length) { toast('เลือกนักเรียนอย่างน้อย 1 คน', 'warning'); return; }
    const aud = current(), os = window.syncRecordToGoogleSheet;
    window.syncRecordToGoogleSheet = function (action, d) { if (action === 'createActivity' && d) d.audience = aud; return os.apply(this, arguments); };
    let r; try { r = oc.apply(this, arguments); } finally { window.syncRecordToGoogleSheet = os; }
    try { if (activities[0] && !activities[0].audience) { activities[0].audience = aud; localStorage.setItem('khalifah_activities', JSON.stringify(activities)); } } catch (e) {}
    A.type = 'all'; A.grades = []; A.students = []; A.q = ''; render();
    try { renderAdminActivitiesTable(); } catch (e) {}
    return r;
  };
  // ตารางกิจกรรม (แอดมิน): ป้ายกลุ่มเป้าหมายใต้ชื่อ
  const ot = window.renderAdminActivitiesTable;
  if (typeof ot === 'function') window.renderAdminActivitiesTable = function () {
    const r = ot.apply(this, arguments);
    try {
      const rows = document.querySelectorAll('#adminActivitiesTableBody tr');
      rows.forEach((tr, i) => { const a = activities[i]; const td = tr.children[1]; if (!a || !td || td.querySelector('.k8-aud-tag')) return; const all = !parseAud(a.audience); td.insertAdjacentHTML('beforeend', '<span class="k8-aud-tag' + (all ? '' : ' is-limited') + '">' + esc(window.k8ActAudLabel(a)) + '</span>'); });
    } catch (e) {}
    return r;
  };
  // นักเรียน: เห็นเฉพาะกิจกรรมของตัวเอง + กันเช็คชื่อกิจกรรมที่ไม่ใช่ของตัวเอง
  const ol = window.renderActivitiesList;
  if (typeof ol === 'function') window.renderActivitiesList = function () {
    let st = null, adm = null; try { st = currentStudent; } catch (e) {} try { adm = currentAdmin; } catch (e) {}
    if (!st || adm) return ol.apply(this, arguments);
    const all = activities; activities = all.filter((a) => window.k8ActForMe(a));
    try { return ol.apply(this, arguments); } finally { activities = all; }
  };
  const deny = (act) => { toast('กิจกรรมนี้สำหรับ ' + window.k8ActAudLabel(act) + ' เท่านั้น', 'warning'); };
  const oci = window.checkInActivity;
  if (typeof oci === 'function') window.checkInActivity = function (actId) {
    const act = (activities || []).find((a) => a.id === actId || a.activityId === actId);
    if (act && !window.k8ActForMe(act)) { deny(act); return; }
    return oci.apply(this, arguments);
  };
  const oq = window.handleQrCodeDetected;
  if (typeof oq === 'function') window.handleQrCodeDetected = function (qr) {
    try {
      const m = String(qr || '').match(/^KHALIFAH_ACT:([^:]*):?(.*)$/i);
      if (m) { const act = (activities || []).find((a) => a.id === m[1] || a.activityId === m[1]); if (act && !window.k8ActForMe(act)) { deny(act); return; } }
    } catch (e) {}
    return oq.apply(this, arguments);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
  ['switchView', 'switchAdminTab'].forEach((fn) => { const o = window[fn]; if (typeof o === 'function') window[fn] = function () { const r = o.apply(this, arguments); setTimeout(() => { const b = document.getElementById('k8ActAud'); if (b && !b.innerHTML) render(); }, 0); return r; }; });
})();

/* v17.38 · ตัวเลขคำขอที่เมนูอนุมัติ: วาดใหม่หลังส่วนเดิมอัปเดต */
(function () {
  ['renderSuperAdminOverviewKpis', 'renderApprovalsV8', 'switchAdminTab', 'fetchPrayerApprovalsFromCloud'].forEach((fn) => {
    const o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function () { const r = o.apply(this, arguments); setTimeout(() => { try { window.k8BellPaint && window.k8BellPaint(); } catch (e) {} }, 0); if (r && typeof r.then === 'function') r.then(() => { try { window.k8BellPaint && window.k8BellPaint(); } catch (e) {} }).catch(() => {}); return r; };
  });
})();

/* ---------- v17.39 · ประจำเดือน: แจ้งวันเริ่ม → รอกดสิ้นสุด → บันทึกอุซุรย้อนหลังอัตโนมัติ ---------- */
(function () {
  const $ = (id) => document.getElementById(id);
  const toast = (m, t) => { try { showToast(m, t || 'info'); } catch (e) {} };
  const SLOTS = ['ซุบฮิ', 'ซุฮริ', 'อัศรฺ', 'มัฆริบ', 'อีชาอ์'];
  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const thDate = (s) => { const d = new Date(s + 'T00:00:00'); if (isNaN(d)) return s || ''; const t = ymd(new Date()), y = ymd(new Date(Date.now() - 864e5)); return (s === t ? 'วันนี้ · ' : s === y ? 'เมื่อวาน · ' : '') + d.getDate() + ' ' + TH_M[d.getMonth()] + ' ' + (d.getFullYear() + 543); };
  window.k8PerThDate = thDate;
  const stu = () => { try { return currentStudent || null; } catch (e) { return null; } };
  const adm = () => { try { return currentAdmin || null; } catch (e) { return null; } };
  const girl = () => { const s = stu(); return !!s && (!!(window.k8IsPreview && window.k8IsPreview()) || !!(window.k8IsGirl && window.k8IsGirl(s))); }; // v17.70 · โหมดจำลองของแอดมินเห็นเมนูประจำเดือนเสมอ
  const key = () => { const s = stu(); return s ? 'k8_period_' + String(s.studentId).replace(/^0+/, '') : ''; };
  const S = { active: null, mode: false, endOpen: false, busy: false };
  try { const v = JSON.parse(localStorage.getItem(key()) || 'null'); if (v) S.active = v; } catch (e) {}
  const preview = () => !!(window.k8IsPreview && window.k8IsPreview());
  window.k8PeriodActive = function () { return stu() && !adm() && girl() ? S.active : null; };
  function store() { try { if (S.active) localStorage.setItem(key(), JSON.stringify(S.active)); else localStorage.removeItem(key()); } catch (e) {} }
  function repaint() { render(); try { window.renderHomeF && window.renderHomeF(); } catch (e) {} try { window.k8BellPaint && window.k8BellPaint(); } catch (e) {} try { window.k8PrayerWarnCheck && window.k8PrayerWarnCheck(); } catch (e) {} }
  async function load() {
    if (!stu() || adm() || !girl() || preview()) { render(); return; }
    let r = null; try { r = await gasApiCall('getMyPeriod', {}, 20000); } catch (e) {}
    if (r && r.success) { S.active = r.active || null; store(); }
    repaint();
  }
  // เวลาแรกที่กลับมาละหมาดได้ ถ้ากดสิ้นสุด "ตอนนี้" = เวลาที่ยังเปิดอยู่หรือเวลาถัดไป
  function resumeNow() {
    const now = new Date(), cur = now.getHours() * 60 + now.getMinutes();
    let day = []; try { day = window.k8PrayerDay(now); } catch (e) {}
    if (!day.length) return 0;
    if (cur < day[0].start) return 0;
    for (let i = 0; i < day.length; i++) if (cur <= day[i].end) return i;
    return 5;
  }
  function countRecs(start, end, resume) {
    const a = new Date(start + 'T00:00:00'), b = new Date(end + 'T00:00:00'); const days = Math.round((b - a) / 864e5);
    return Math.max(0, days) * 5 + resume;
  }
  function render() {
    const box = $('k8PerCard'); if (!box) return;
    const a = window.k8PeriodActive();
    box.hidden = !a;
    if (!a) { box.innerHTML = ''; return; }
    const days = Math.round((new Date(ymd(new Date()) + 'T00:00:00') - new Date(a.start + 'T00:00:00')) / 864e5) + 1;
    const t = ymd(new Date()), rn = resumeNow();
    let h = '<div class="k8-per-top"><span class="k8-per-ico" aria-hidden="true">🌸</span><div><b>กำลังมีประจำเดือน · วันที่ ' + days + '</b><small>เริ่ม ' + thDate(a.start) + ' · รอกดสิ้นสุด</small></div></div>' +
      '<p class="k8-per-txt">ระหว่างนี้ไม่ต้องเช็คชื่อละหมาด เมื่อประจำเดือนหมด กด <b>สิ้นสุดประจำเดือน</b> แล้วระบบจะบันทึก "อุซุร" ให้ครบทุกเวลาย้อนหลังอัตโนมัติ</p>';
    if (!S.endOpen) {
      h += '<button type="button" class="k8-per-end" onclick="k8PerEndNow()"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'กำลังบันทึก…' : 'สิ้นสุดประจำเดือน (ตอนนี้)') + '</button>' +
        '<small class="k8-per-note">' + (rn < 5 ? 'เริ่มละหมาดตามปกติตั้งแต่' + SLOTS[rn] + 'วันนี้' : 'วันนี้บันทึกอุซุรครบทั้ง 5 เวลา · เริ่มละหมาดพรุ่งนี้') + '</small>' +
        '<div class="k8-per-links"><button type="button" onclick="k8PerEndPick(true)">ลืมกด? เลือกวันที่สิ้นสุดเอง</button><button type="button" class="is-mute" onclick="k8PerCancel()">ยกเลิกการแจ้ง</button></div>';
    } else {
      h += '<div class="k8-per-pick"><label><span>ประจำเดือนหมดวันที่</span><input type="date" id="k8PerEndD" min="' + a.start + '" max="' + t + '" value="' + t + '" onchange="k8PerSum()"></label>' +
        '<label><span>เริ่มละหมาดได้ตั้งแต่เวลา</span><select id="k8PerRes" onchange="k8PerSum()">' + SLOTS.map((x, i) => '<option value="' + i + '"' + (i === 0 ? ' selected' : '') + '>' + x + '</option>').join('') + '<option value="5">ยังไม่ได้ละหมาดทั้งวันนั้น (เริ่มวันถัดไป)</option></select></label>' +
        '<p class="k8-per-sum" id="k8PerSum"></p>' +
        '<div class="k8-per-btns"><button type="button" class="is-alt" onclick="k8PerEndPick(false)">ย้อนกลับ</button><button type="button" class="k8-per-end" onclick="k8PerEndPicked()"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'กำลังบันทึก…' : 'บันทึกวันที่สิ้นสุด') + '</button></div></div>';
    }
    box.innerHTML = h;
    if (S.endOpen) window.k8PerSum();
  }
  window.k8PerSum = function () {
    const a = S.active, d = ($('k8PerEndD') || {}).value, r = parseInt(($('k8PerRes') || {}).value, 10), el = $('k8PerSum'); if (!a || !d || !el) return;
    const n = countRecs(a.start, d, isNaN(r) ? 0 : r);
    el.textContent = 'ระบบจะบันทึกอุซุร ' + n + ' เวลา (' + thDate(a.start) + ' ถึง ' + (r >= 5 ? 'ครบวัน ' + thDate(d) : 'ก่อน' + SLOTS[r] + ' ' + thDate(d)) + ') · ตั้งแต่เวลาที่เลือกเป็นต้นไปนับตามจริง';
  };
  window.k8PerGo = function () {
    try { closeModal('k8NotifModal'); } catch (e) {}
    try { switchView('prayer'); } catch (e) {}
    setTimeout(() => { render(); const b = $('k8PerCard'); if (b && !b.hidden) b.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120);
  };
  window.k8PerEndPick = function (v) { S.endOpen = !!v; render(); };
  async function end(endDate, resume) {
    if (S.busy || !S.active) return;
    const n = countRecs(S.active.start, endDate, resume);
    if (preview()) { S.active = null; S.endOpen = false; store(); toast('จำลอง · สิ้นสุดประจำเดือนแล้ว (ของจริงจะบันทึกอุซุร ' + n + ' เวลา) · ไม่ได้บันทึกจริง', 'info'); repaint(); return; }
    if (!confirm('สิ้นสุดประจำเดือน ' + thDate(endDate) + '\nระบบจะบันทึกอุซุรย้อนหลัง ' + n + ' เวลา (ข้ามเวลาที่บันทึกไว้แล้ว)\nยืนยันไหม?')) return;
    S.busy = true; render();
    let r = null; try { r = await gasApiCall('periodEnd', { data: { endDate: endDate, resumeSlot: resume } }, 45000); } catch (e) {}
    S.busy = false;
    if (r && r.success) {
      S.active = null; S.endOpen = false; store();
      toast(r.message || 'บันทึกแล้ว', 'success');
      try { if (typeof fetchStudentPrayersFromCloud === 'function') fetchStudentPrayersFromCloud(true); } catch (e) {}
      try { if (typeof syncAllDataFromCloud === 'function') syncAllDataFromCloud(); } catch (e) {}
    } else toast((r && r.message) || 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 'error');
    repaint();
  }
  window.k8PerEndNow = function () { end(ymd(new Date()), resumeNow()); };
  window.k8PerEndPicked = function () { const d = ($('k8PerEndD') || {}).value, r = parseInt(($('k8PerRes') || {}).value, 10); if (!d) { toast('เลือกวันที่สิ้นสุด', 'warning'); return; } end(d, isNaN(r) ? 0 : r); };
  window.k8PerCancel = async function () {
    if (!S.active || !confirm('ยกเลิกการแจ้งมีประจำเดือน (เริ่ม ' + thDate(S.active.start) + ')?\nจะไม่มีการบันทึกอุซุรใด ๆ')) return;
    if (preview()) { S.active = null; store(); toast('จำลอง · ยกเลิกแล้ว', 'info'); repaint(); return; }
    let r = null; try { r = await gasApiCall('periodCancel', {}, 20000); } catch (e) {}
    if (r && r.success) { S.active = null; store(); toast('ยกเลิกแล้ว', 'success'); repaint(); } else toast((r && r.message) || 'ยกเลิกไม่สำเร็จ', 'error');
  };

  // ---- การ์ดหมายเหตุ: ปุ่ม "มีประจำเดือน" (เฉพาะนักเรียนหญิง) → โหมดแจ้งวันเริ่ม ----
  function formMode(on) {
    S.mode = !!on;
    const card = $('prayerNotesCard'); if (card) card.classList.toggle('is-per-mode', S.mode);
    const di = $('k8PnDate');
    if (di) {
      const t = ymd(new Date());
      if (S.mode) { di.dataset.k8max = di.max; di.dataset.k8min = di.min; di.max = t; di.min = ymd(new Date(Date.now() - 15 * 864e5)); if (di.value > t) di.value = t; }
      else if (di.dataset.k8max) { di.max = di.dataset.k8max; di.min = di.dataset.k8min; }
      const lab = di.parentElement && di.parentElement.querySelector('span'); if (lab) lab.textContent = S.mode ? 'เริ่มมีประจำเดือนวันที่' : 'วันที่';
    }
    const intro = document.querySelector('#prayerNotesCard .k8-pn-intro span');
    if (intro) { if (!intro.dataset.k8o) intro.dataset.k8o = intro.innerHTML; intro.innerHTML = S.mode ? 'แจ้ง<b>วันเริ่ม</b>ครั้งเดียว · เมื่อหมดให้กด <b>สิ้นสุดประจำเดือน</b> ระบบจะบันทึกอุซุรย้อนหลังให้อัตโนมัติ' : intro.dataset.k8o; }
    const hint = document.querySelector('.k8-pn-step .k8-pn-hint'); if (hint) hint.textContent = S.mode ? 'เลือกครบ 5 เวลาให้อัตโนมัติ · ระบบจะบันทึกอุซุรทุกเวลาจนกว่าจะกด "สิ้นสุดประจำเดือน"' : 'เลือกได้ทุกเวลา ไม่ล็อก · แตะเลือกได้หลายเวลา';
    if (S.mode) { try { selectAllPrayerNoteTimes(true); } catch (e) {} }
    sync();
  }
  function sync() {
    const b = document.querySelector('.preset-menstruation'); labels(); if (b) { b.hidden = !girl(); b.classList.toggle('is-on', S.mode); }
    if (S.mode) { const sv = document.querySelector('.k8-pn-save'); if (sv && !S.busy) { sv.textContent = S.active ? 'มีช่วงประจำเดือนที่รอกดสิ้นสุดอยู่แล้ว' : 'แจ้งเริ่มมีประจำเดือน · ครบ 5 เวลา'; sv.classList.toggle('is-off', !!S.active); } }
  }
  const ap = window.applyPrayerNotePreset;
  window.applyPrayerNotePreset = function (k) {
    if (k === 'menstruation') {
      if (!girl()) { toast('เมนูนี้สำหรับนักเรียนหญิงเท่านั้น', 'warning'); return; }
      const r = ap ? ap.call(this, '__none__') : null;
      const inp = $('prayerNoteInput'); if (inp) inp.value = 'มีประจำเดือน / อุซุรทางศาสนา';
      formMode(true);
      if (S.active) toast('มีช่วงประจำเดือนที่รอกดสิ้นสุดอยู่แล้ว (เริ่ม ' + thDate(S.active.start) + ')', 'info');
      else { toast('เลือกวันที่เริ่มมีประจำเดือนในข้อ 2 แล้วกดแจ้ง', 'info'); setTimeout(() => { const d = $('k8PnDate'); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150); }
      return r;
    }
    if (S.mode) formMode(false);
    return ap ? ap.apply(this, arguments) : null;
  };
  ['togglePrayerNoteTime', 'selectAllPrayerNoteTimes', 'updatePrayerNoteChipsUI', 'k8PnOther'].forEach((fn) => { const o = window[fn]; if (typeof o === 'function') window[fn] = function () { const r = o.apply(this, arguments); if (S.mode && fn === 'k8PnOther') formMode(false); setTimeout(sync, 5); return r; }; });
  document.addEventListener('input', (e) => { if (S.mode && e.target && e.target.id === 'prayerNoteInput' && !/ประจำเดือน/.test(e.target.value)) formMode(false); });
  // v17.45 · ข้อความบนการ์ดไม่พูดถึงอุซุรสำหรับนักเรียนชาย
  function labels() {
    const g = girl();
    const sm = document.querySelector('#prayerNotesCard .k8-pn-t small'); if (sm) { if (!sm.dataset.k8o) sm.dataset.k8o = sm.textContent; sm.textContent = g ? sm.dataset.k8o : 'ลา · ป่วย · เดินทาง · ลืมเช็คชื่อ → ส่งให้แอดมินอนุมัติ'; }
    const mb = $('k8PrMoreBtn'); if (mb) { if (!mb.dataset.k8o) mb.dataset.k8o = mb.textContent; mb.textContent = g ? mb.dataset.k8o : mb.dataset.k8o.replace(/\s*\/\s*อุซุร/, ''); }
  }
  const sv = window.savePrayerNoteOnly;
  window.savePrayerNoteOnly = async function () {
    if (!S.mode && !girl() && /ประจำเดือน/.test((($('prayerNoteInput') || {}).value || ''))) { toast('เหตุผล "มีประจำเดือน" ใช้ได้เฉพาะนักเรียนหญิง', 'warning'); return; }
    if (!S.mode) return sv.apply(this, arguments);
    if (S.busy) return;
    if (S.active) { window.k8PerGo(); return; }
    const start = ($('k8PnDate') || {}).value || ymd(new Date());
    if (preview()) { S.active = { start: start, note: (($('prayerNoteInput') || {}).value || ''), at: new Date().toISOString(), sim: true }; store(); formMode(false); toast('จำลอง · แจ้งเริ่มมีประจำเดือน ' + thDate(start) + ' แล้ว · ไม่ได้บันทึกจริง', 'info'); repaint(); setTimeout(() => window.k8PerGo && window.k8PerGo(), 200); return; }
    S.busy = true; const b = document.querySelector('.k8-pn-save'); if (b) { b.disabled = true; b.textContent = 'กำลังส่ง…'; }
    let r = null; try { r = await gasApiCall('periodStart', { data: { startDate: start, note: (($('prayerNoteInput') || {}).value || '') } }, 30000); } catch (e) {}
    S.busy = false; if (b) b.disabled = false;
    if (r && r.success) {
      S.active = r.active; store();
      const inp = $('prayerNoteInput'); if (inp) inp.value = '';
      try { selectAllPrayerNoteTimes(false); } catch (e) {}
      formMode(false);
      try { togglePrayerNotesCollapse(false); } catch (e) {}
      toast('บันทึกวันเริ่มแล้ว · เมื่อหมดให้กด "สิ้นสุดประจำเดือน"', 'success');
      repaint(); window.k8PerGo();
    } else { if (r && r.code === 'ALREADY_ACTIVE' && r.active) { S.active = r.active; store(); repaint(); } toast((r && r.message) || 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง', 'error'); sync(); }
  };

  ['switchView', 'renderCurrentStudentProfile'].forEach((fn) => { const o = window[fn]; if (typeof o === 'function') window[fn] = function () { const r = o.apply(this, arguments); setTimeout(() => { sync(); render(); if (fn === 'renderCurrentStudentProfile' || arguments[0] === 'prayer') { if (!S.loadedAt || Date.now() - S.loadedAt > 30000) { S.loadedAt = Date.now(); load(); } } }, 30); return r; }; });
  const go = () => { sync(); render(); setTimeout(() => { S.loadedAt = Date.now(); load(); }, 2500); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();

/* ---------- v17.40 · อันดับ/เช็คชื่อซุบฮิ/พิกัด อยู่ในหน้า "ละหมาด" (ปุ่มเข้าไปดู + ปุ่มกลับ) ---------- */
(function () {
  const SUB = { 'prayer-rank': 'อันดับการละหมาด', 'prayer-roll': 'เช็คชื่อซุบฮิ', 'geo-zones': 'พิกัดละหมาด' };
  function back(tab) {
    const box = document.getElementById('admin-tab-' + tab); if (!box || box.querySelector(':scope > .k8-pr-back')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'k8-pr-back';
    b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>กลับหน้าละหมาด';
    b.onclick = () => { try { switchAdminTab('prayers-monitor', document.getElementById('btnAdminTabPrayers')); } catch (e) {} try { window.scrollTo({ top: 0 }); } catch (e) {} };
    box.insertBefore(b, box.firstChild);
  }
  const o = window.switchAdminTab;
  if (typeof o === 'function') window.switchAdminTab = function (tab) {
    const r = o.apply(this, arguments);
    if (SUB[tab]) {
      back(tab);
      setTimeout(() => {
        document.querySelectorAll('#k8AdminNav .admin-tab-btn.active').forEach((x) => x.classList.remove('active'));
        const p = document.getElementById('btnAdminTabPrayers'); if (p) p.classList.add('active');
        const t = document.getElementById('k8AdmBarTitle'); if (t) t.textContent = SUB[tab];
      }, 5);
    }
    return r;
  };
})();

/* ---------- v17.42 · เพศนักเรียน: สมัครต้องเลือกเพศ+คำนำหน้า · แอดมินระบุเพศนักเรียนเดิมแบบรวดเร็ว ---------- */
(function () {
  const $ = (id) => document.getElementById(id);
  const toast = (m, t) => { try { showToast(m, t || 'info'); } catch (e) {} };
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PRE = /^\s*(เด็กชาย|เด็กหญิง|นางสาว|นาย|นาง|ด\.ช\.|ด\.ญ\.|น\.ส\.)\s*/;
  const gnum = (g) => { const m = String(g || '').match(/([1-6])/); return m ? m[1] : ''; };
  const cid = (v) => String(v == null ? '' : v).trim().replace(/^0+/, '');
  const guess = (s) => { const n = String((s && (s.fullName || s.name)) || ''); if (/^\s*(นางสาว|น\.ส\.|นาง|เด็กหญิง|ด\.ญ\.)/.test(n)) return 'หญิง'; if (/^\s*(นาย|เด็กชาย|ด\.ช\.)/.test(n)) return 'ชาย'; return ''; };
  const saved = (s) => { const g = String((s && s.gender) || ''); return g === 'หญิง' || g === 'ชาย' ? g : ''; };
  // v17.43 · เพศสำหรับแบ่งกลุ่ม (ที่บันทึก > คำนำหน้า) · ชื่อไม่รวมคำนำหน้าสำหรับเรียง ก–ฮ
  window.k8SexOf = (s) => saved(s) || guess(s) || (/^(นาย|เด็กชาย)$/.test(String((s && s.prefix) || '')) ? 'ชาย' : /^(นางสาว|นาง|เด็กหญิง)$/.test(String((s && s.prefix) || '')) ? 'หญิง' : '');
  window.k8BareName = (s) => String((s && (s.nameOnly || s.fullName)) || '').replace(PRE, '').replace(/\s*(นางสาว|เด็กหญิง|เด็กชาย)$/, '').trim();
  async function autoNormalize() {
    let a = null; try { a = currentAdmin; } catch (e) {} if (!a || a.limited || a.role !== 'SuperAdmin' && !/admin/i.test(String(a.role || ''))) return;
    let l = []; try { l = allStudents || []; } catch (e) {} if (!l.length || !l.some((s) => 'prefix' in s)) return; // เซิร์ฟเวอร์ยังเป็นเวอร์ชันเก่า
    try { if (sessionStorage.getItem('k8_name_norm')) return; sessionStorage.setItem('k8_name_norm', '1'); } catch (e) {}
    let r = null; try { r = await gasApiCall('normalizeStudentNames', {}, 45000); } catch (e) {}
    if (r && r.success && (r.moved || r.gendered)) { toast('จัดข้อมูลนักเรียนแล้ว: ' + r.message, 'success'); try { if (typeof syncAllDataFromCloud === 'function') await syncAllDataFromCloud(false); } catch (e) {} try { filterAdminStudents(); } catch (e) {} badge(); }
  }

  // ---- ฟอร์มสมัคร ----
  let SEX = '';
  window.k8RegSex = function (v) {
    SEX = v;
    document.querySelectorAll('#k8RegSex button').forEach((b) => { const on = b.dataset.v === v; b.setAttribute('aria-checked', on); b.classList.toggle('on', on); });
    const sel = $('k8RegPrefix'); if (!sel) return;
    Array.from(sel.options).forEach((o) => { if (o.dataset.sex) o.hidden = o.disabled = !!v && o.dataset.sex !== v; });
    const cur = sel.selectedOptions[0]; if (cur && cur.dataset.sex && cur.dataset.sex !== v) sel.value = '';
    const w = document.querySelector('#k8RegSex'); if (w) { w.classList.remove('is-invalid'); const g = w.closest('.form-group'); if (g) g.querySelectorAll('.auth-field-error-msg').forEach((e) => e.remove()); }
  };
  window.k8RegPrefix = function (v) { const pe = $('k8RegPrefix'); if (pe) { pe.classList.remove('is-invalid'); const g = pe.closest('.form-group'); if (g) g.querySelectorAll('.auth-field-error-msg').forEach((e) => e.remove()); } const o = $('k8RegPrefix') && $('k8RegPrefix').selectedOptions[0]; if (o && o.dataset.sex && o.dataset.sex !== SEX) window.k8RegSex(o.dataset.sex); };
  const hr = window.handleStudentRegister;
  if (typeof hr === 'function') window.handleStudentRegister = function () {
    document.querySelectorAll('#registerFormSection .auth-field-error-msg').forEach((el) => el.remove());
    const sexBox = $('k8RegSex'), pre = $('k8RegPrefix'), nm = $('regFullName');
    const err = (el, m) => { try { triggerAuthError(el, m); } catch (e) { toast(m, 'warning'); } try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} };
    if (!SEX) { err(sexBox, 'กรุณาเลือกเพศ'); return; }
    if (!pre || !pre.value) { err(pre, 'กรุณาเลือกคำนำหน้า'); return; }
    if (nm) { const bare = nm.value.replace(PRE, '').trim(); if (bare) nm.value = pre.value + bare; }
    window.__k8RegGender = SEX;
    const r = hr.apply(this, arguments);
    try { const id = cid(($('regStudentId') || {}).value); const s = (allStudents || []).find((x) => cid(x.studentId) === id); if (s) s.gender = SEX; } catch (e) {}
    return r;
  };
  const sr = window.submitRegistrationToServer;
  if (typeof sr === 'function') window.submitRegistrationToServer = function (item) {
    if (item && item.role === 'student' && window.__k8RegGender) { item.gender = window.__k8RegGender; if (item.payload) item.payload.gender = window.__k8RegGender; }
    return sr.apply(this, arguments);
  };

  // ---- แอดมิน: ระบุเพศนักเรียน ----
  const G = { edits: {}, f: 'todo', grade: '', q: '', busy: false };
  function pool() { let l = []; try { l = allStudents || []; } catch (e) {} return l.filter((s) => s && s.studentId && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(s.status || '')) && s.approvalStatus !== 'PendingAdmin' && s.approvalStatus !== 'AwaitingOtp'); }
  const chosen = (s) => G.edits[cid(s.studentId)] || saved(s) || guess(s);
  const dirty = () => pool().filter((s) => chosen(s) && chosen(s) !== saved(s));
  function badge() {
    const n = pool().filter((s) => !saved(s) && !guess(s)).length, el = $('k8GxBtnN');
    if (el) { el.hidden = !n; el.textContent = n; }
  }
  function render() {
    const body = $('k8GxBody'); if (!body) return;
    const all = pool();
    const nSaved = all.filter((s) => saved(s)).length, nNone = all.filter((s) => !chosen(s)).length;
    $('k8GxSub').textContent = 'ระบุแล้ว ' + nSaved + ' จาก ' + all.length + ' คน' + (nNone ? ' · ยังไม่รู้เพศ ' + nNone + ' คน' : '');
    const q = G.q.trim().toLowerCase();
    const list = all.filter((s) => {
      const c = chosen(s);
      if (G.f === 'todo' && saved(s) && !G.edits[cid(s.studentId)]) return false;
      if (G.f === 'm' && c !== 'ชาย') return false; if (G.f === 'f' && c !== 'หญิง') return false;
      if (G.grade && gnum(s.grade) !== G.grade) return false;
      return !q || String(s.fullName || '').toLowerCase().indexOf(q) !== -1 || String(s.studentId).indexOf(q) !== -1;
    }).sort((a, b) => (gnum(a.grade) - gnum(b.grade)) || window.k8BareName(a).localeCompare(window.k8BareName(b), 'th'));
    const chip = (k, l) => '<button type="button" class="' + (G.f === k ? 'on' : '') + '" onclick="k8GxSet(\'f\',\'' + k + '\')">' + l + '</button>';
    let h = '<div class="k8-gx-bar"><div class="k8-gx-chips">' + chip('todo', 'ยังไม่บันทึก') + chip('all', 'ทั้งหมด') + chip('m', 'ชาย') + chip('f', 'หญิง') + '</div>' +
      '<div class="k8-gx-row2"><select aria-label="ชั้น" onchange="k8GxSet(\'grade\',this.value)"><option value="">ทุกชั้น</option>' + [1, 2, 3, 4, 5, 6].map((g) => '<option value="' + g + '"' + (G.grade === String(g) ? ' selected' : '') + '>ม.' + g + '</option>').join('') + '</select>' +
      '<input type="search" id="k8GxQ" placeholder="ค้นหาชื่อหรือรหัส" value="' + esc(G.q) + '" oninput="k8GxSet(\'q\',this.value)"></div></div>';
    h += '<p class="k8-gx-hint">ระบบเลือกให้ก่อนจากคำนำหน้าชื่อ (ป้าย "เดาจากคำนำหน้า") · ตรวจแล้วกดบันทึก · คนที่ไม่มีคำนำหน้าแตะเลือกเอง</p>';
    h += '<ul class="k8-gx-list">' + (list.length ? list.map((s) => {
      const id = cid(s.studentId), c = chosen(s), sv = saved(s), gs = !sv && !G.edits[id] && guess(s);
      const tag = !c ? '<span class="k8-gx-tag is-none">ยังไม่ระบุ</span>' : gs ? '<span class="k8-gx-tag is-guess">เดาจากคำนำหน้า</span>' : (c !== sv ? '<span class="k8-gx-tag is-new">ยังไม่บันทึก</span>' : '');
      const seg = ['ชาย', 'หญิง'].map((v) => '<button type="button" aria-pressed="' + (c === v) + '" class="' + (c === v ? 'on is-' + (v === 'ชาย' ? 'm' : 'f') : '') + '" onclick="k8GxPick(\'' + esc(id) + '\',\'' + v + '\')">' + v + '</button>').join('');
      return '<li class="' + (!c ? 'is-none' : '') + '"><span class="k8-gx-who"><b>' + esc(s.fullName || s.studentId) + '</b><small>ม.' + (gnum(s.grade) || '-') + ' · ' + esc(s.studentId) + ' ' + tag + '</small></span><span class="k8-gx-seg" role="group" aria-label="เพศของ ' + esc(s.fullName || '') + '">' + seg + '</span></li>';
    }).join('') : '<li class="k8-gx-empty">' + (G.f === 'todo' ? 'บันทึกเพศครบทุกคนแล้ว 🎉' : 'ไม่พบนักเรียน') + '</li>') + '</ul>';
    const n = dirty().length;
    h += '<div class="k8-gx-foot"><button type="button" class="k8-gx-save" onclick="k8GxSave()"' + (!n || G.busy ? ' disabled' : '') + '>' + (G.busy ? 'กำลังบันทึก…' : n ? 'บันทึก ' + n + ' คน' : 'ไม่มีรายการต้องบันทึก') + '</button></div>';
    body.innerHTML = h;
  }
  window.k8GxOpen = function () { G.edits = {}; G.f = pool().some((s) => !saved(s)) ? 'todo' : 'all'; render(); try { openModal('k8GxModal'); } catch (e) {} };
  window.k8GxSet = function (k, v) { G[k] = v; render(); if (k === 'q') { const q = $('k8GxQ'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } } };
  window.k8GxPick = function (id, v) { G.edits[id] = v; render(); };
  window.k8GxSave = async function () {
    const items = dirty().map((s) => ({ studentId: String(s.studentId), gender: chosen(s) })); if (!items.length || G.busy) return;
    G.busy = true; render();
    let r = null; try { r = await gasApiCall('setStudentGenders', { data: { items: items } }, 45000); } catch (e) {}
    G.busy = false;
    if (r && r.success) {
      const map = {}; items.forEach((x) => { map[cid(x.studentId)] = x.gender; });
      try { (allStudents || []).forEach((s) => { const g = map[cid(s.studentId)]; if (g) s.gender = g; }); localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents)); } catch (e) {}
      G.edits = {}; toast('บันทึกเพศนักเรียนแล้ว ' + items.length + ' คน', 'success');
      try { filterAdminStudents(); } catch (e) {}
    } else toast((r && r.message) || 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 'error');
    render(); badge();
  };
  ['switchAdminTab', 'renderSuperAdminOverviewKpis'].forEach((fn) => { const o = window[fn]; if (typeof o === 'function') window[fn] = function () { const r = o.apply(this, arguments); setTimeout(badge, 30); return r; }; });
  setTimeout(badge, 3000);
  setTimeout(autoNormalize, 6000);
  const osw = window.switchAdminTab; if (typeof osw === 'function') window.switchAdminTab = function (t) { const r = osw.apply(this, arguments); if (t === 'students') setTimeout(autoNormalize, 500); return r; };
})();

/* ---------- v17.46 · ลบแล้วต้องหายจริง: รอผลจากเซิร์ฟเวอร์ + ลองใหม่อัตโนมัติ + กันข้อมูลเก่าจากการซิงค์ดึงกลับมา ---------- */
(function () {
  const KEY = 'k8_tombs';
  const toast = (m, t) => { try { showToast(m, t || 'info'); } catch (e) {} };
  const cid = (v) => String(v == null ? '' : v).trim().toLowerCase().replace(/^0+(?=\d)/, '');
  const KIND = {
    deleteStudent: { k: 'stu', id: (d) => d.studentId, label: 'นักเรียน' },
    deleteSubAdmin: { k: 'adm', id: (d) => d.username, label: 'บัญชีบุคลากร' },
    deleteActivity: { k: 'act', id: (d) => d.activityId || d.id, label: 'กิจกรรม' },
    deleteCalendarEvent: { k: 'cal', id: (d) => d.id || d.eventId, label: 'กิจกรรมในปฏิทิน' },
    deleteActivityAttendee: { k: 'log', id: (d) => d.logId || d.id, label: 'รายชื่อผู้เข้าร่วม' },
    deletePrayerRecord: { k: 'pry', id: (d) => d.logId || d.id, label: 'บันทึกละหมาด' },
    deletePendingRegistration: { k: 'reg', id: (d) => d.reqId || d.id, label: 'คำขอสมัคร' }
  };
  let T = {}; try { T = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { T = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) {} };
  function prune() {
    const now = Date.now(); let ch = false;
    Object.keys(T).forEach((k) => Object.keys(T[k] || {}).forEach((id) => { const t = T[k][id]; if ((t.ok && now - t.ok > 180000) || now - t.at > 15 * 60000) { delete T[k][id]; ch = true; } }));
    if (ch) save();
  }
  const has = (k, id) => !!(T[k] && id != null && T[k][cid(id)]);
  function add(k, id) { if (id == null || id === '') return; T[k] = T[k] || {}; T[k][cid(id)] = { at: Date.now(), ok: 0 }; save(); }
  function ok(k, id) { const t = T[k] && T[k][cid(id)]; if (t) { t.ok = Date.now(); save(); } }
  function drop(k, id) { if (T[k]) { delete T[k][cid(id)]; save(); } }
  let pending = 0;

  // ซ่อนรายการที่เพิ่งลบ แม้ข้อมูลจากการซิงค์ (ที่ดึงก่อนลบเสร็จ) จะยังมีอยู่
  function apply() {
    prune();
    let ch = {};
    const filt = (arr, k, idf) => { if (!Array.isArray(arr) || !T[k] || !Object.keys(T[k]).length) return arr; const out = arr.filter((x) => !(x && idf(x).some((v) => has(k, v)))); if (out.length !== arr.length) ch[k] = 1; return out; };
    try { allStudents = filt(allStudents, 'stu', (s) => [s.studentId]); if (ch.stu) localStorage.setItem('khalifah_all_students', JSON.stringify(allStudents)); } catch (e) {}
    try { subAdmins = filt(subAdmins, 'adm', (s) => [s.username]); if (ch.adm) localStorage.setItem('khalifah_sub_admins', JSON.stringify(subAdmins)); } catch (e) {}
    try { activities = filt(activities, 'act', (a) => [a.id, a.activityId]); if (ch.act) localStorage.setItem('khalifah_activities', JSON.stringify(activities)); } catch (e) {}
    try { calendarEvents = filt(calendarEvents, 'cal', (e) => [e.id]); if (ch.cal) localStorage.setItem('khalifah_calendar_events', JSON.stringify(calendarEvents)); } catch (e) {}
    try { const l = JSON.parse(localStorage.getItem('khalifah_student_act_logs') || '[]'); const o = filt(l, 'log', (x) => [x.id, x.logId]); if (ch.log) localStorage.setItem('khalifah_student_act_logs', JSON.stringify(o)); } catch (e) {}
    try {
      const h = JSON.parse(localStorage.getItem('khalifah_prayer_history') || '[]'); const o = filt(h, 'pry', (x) => [x.id, x.logId]); if (ch.pry) localStorage.setItem('khalifah_prayer_history', JSON.stringify(o));
      const before = ch.pry; ch.pry = 0; todayPrayers = filt(todayPrayers, 'pry', (x) => [x.id, x.logId]); if (ch.pry) localStorage.setItem('khalifah_today_prayers', JSON.stringify(todayPrayers)); ch.pry = ch.pry || before;
    } catch (e) {}
    try { if (typeof getPendingRegistrations === 'function') { const l = getPendingRegistrations(); const o = filt(l, 'reg', (x) => [x.reqId, x.id]); if (ch.reg) savePendingRegistrations(o); } } catch (e) {}
    const run = (f) => { try { if (typeof window[f] === 'function') window[f](); } catch (e) {} };
    if (ch.stu) { run('filterAdminStudents'); run('renderSuperAdminOverviewKpis'); }
    if (ch.adm) run('renderSubAdminsTable');
    if (ch.act || ch.log) { run('renderAdminActivitiesTable'); run('renderActivitiesList'); run('renderAdminLiveActivityFeed'); run('renderActivitiesV8'); }
    if (ch.cal) { try { renderCalendar('all'); } catch (e) {} }
    if (ch.reg) { run('renderPendingApprovalsTable'); run('renderApprovalsV8'); }
    if (ch.pry) { run('renderAdminStudentsTable'); }
  }
  window.k8TombApply = apply;

  // ลบผ่าน API ที่รอผลจริง (แทนการส่งแบบไม่รู้ผล) · ลองใหม่ 3 ครั้ง · ไม่สำเร็จ = แจ้งและดึงข้อมูลจริงกลับมา
  async function reliable(action, data) {
    const K = KIND[action]; const id = K.id(data || {});
    add(K.k, id); pending++;
    let r = null;
    for (let i = 0; i < 3; i++) {
      try { r = await window.gasApiCall(action, { data: data }, 30000); } catch (e) { r = null; }
      if (r && r.success !== false) break;
      if (r && (r.forbidden || r.authRequired || r.code === 'FORBIDDEN')) break;
      await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
    }
    pending--;
    if (r && r.success !== false) { ok(K.k, id); }
    else {
      drop(K.k, id);
      toast('ลบ' + K.label + 'ไม่สำเร็จ' + (r && r.message ? ': ' + r.message : ' (เชื่อมต่อระบบไม่ได้)') + ' · ข้อมูลยังอยู่ในระบบ ลองใหม่อีกครั้ง', 'error');
      try { if (typeof syncAllDataFromCloud === 'function') syncAllDataFromCloud(false); } catch (e) {}
    }
    return r;
  }
  const osr = window.syncRecordToGoogleSheet;
  if (typeof osr === 'function') window.syncRecordToGoogleSheet = function (action, data) {
    if (KIND[action]) return reliable(action, data);
    return osr.apply(this, arguments);
  };
  const oga = window.gasApiCall;
  if (typeof oga === 'function') window.gasApiCall = async function (action, payload) {
    const K = KIND[action]; const d = (payload && payload.data) || payload || {};
    if (K) add(K.k, K.id(d));
    const r = await oga.apply(this, arguments);
    if (K) { if (r && r.success !== false) ok(K.k, K.id(d)); else if (!pending) drop(K.k, K.id(d)); }
    return r;
  };
  // หลังดึงข้อมูลจากเซิร์ฟเวอร์ทุกครั้ง: ซ่อนรายการที่เพิ่งลบ
  ['syncAllDataFromCloud', 'fetchActivitiesAndLogsFromCloud', 'fetchPendingApprovalsFromCloud', 'fetchPrayerApprovalsFromCloud'].forEach((fn) => {
    const o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function () { const r = o.apply(this, arguments); Promise.resolve(r).then(apply, apply); return r; };
  });
  setTimeout(apply, 1500);
})();

/* ---------- v17.48 · บัญชีสิทธิ์จำกัดในหน้าแอดมิน: ผู้บริหาร (ดูเป็นหลัก) · ฝ่ายกิจกรรม (กิจกรรม & สแกน) ---------- */
(function () {
  const lim = () => { try { return (currentAdmin && currentAdmin.limited) || ''; } catch (e) { return ''; } };
  const ALLOW = {
    exec: ['overview', 'approvals', 'students', 'subadmins', 'timetable', 'subjects', 'grading', 'prayers-monitor', 'prayer-rank', 'behavior', 'halaqah'],
    act: ['activities-admin'],
    night: ['behavior', 'activities-admin']
  };
  const HOME = { exec: 'overview', act: 'activities-admin', night: 'behavior' };
  const tabOf = (btn) => { const oc = String(btn.getAttribute('onclick') || ''); if (/k8HqOpen/.test(oc)) return 'halaqah'; const m = oc.match(/switchAdminTab\('([^']+)'/); return m ? m[1] : ''; };
  const allowed = (t) => { const l = lim(); return !l || (ALLOW[l] || []).indexOf(t) !== -1; };
  window.k8LimitAllows = allowed;
  function nav() {
    const l = lim();
    document.body.classList.toggle('k8-lim', !!l); document.body.classList.toggle('k8-lim-exec', l === 'exec'); document.body.classList.toggle('k8-lim-act', l === 'act'); document.body.classList.toggle('k8-lim-night', l === 'night');
    document.querySelectorAll('#k8AdminNav .admin-tab-btn').forEach((b) => {
      if (b.classList.contains('k8-nav-sub')) return;
      const t = tabOf(b); if (!t) return;
      const hide = !!l && !allowed(t);
      if (hide) { b.dataset.k8lim = '1'; b.style.setProperty('display', 'none', 'important'); }
      else if (b.dataset.k8lim) { delete b.dataset.k8lim; b.style.removeProperty('display'); }
    });
    document.querySelectorAll('#k8AdminNav .k8-nav-group').forEach((g) => {
      const vis = Array.from(g.querySelectorAll('.admin-tab-btn')).filter((b) => !b.dataset.k8lim && !b.classList.contains('k8-nav-sub') && !b.hidden && b.style.getPropertyValue('display') !== 'none').length;
      g.hidden = !!l && !vis;
      const c = g.querySelector('.k8-nav-gc'); if (c) { if (!c.dataset.k8o) c.dataset.k8o = c.textContent; c.textContent = l ? vis : c.dataset.k8o; }
    });
    ['m-nav-teacher', 'nav-teacher', 'm-nav-preview'].forEach((id) => { const e = document.getElementById(id); if (e && l) e.style.display = 'none'; });
    if (l) document.querySelectorAll('#k8AdminNav button, #k8AdminNav a').forEach((b) => { const oc = String(b.getAttribute('onclick') || ''); if (/k8Preview|switchView\('teacher'\)|switchView\("teacher"\)/.test(oc)) b.style.setProperty('display', 'none', 'important'); });
  }
  // ซ่อนปุ่มเพิ่ม/แก้ไข/ลบในหน้าที่ผู้บริหารดูได้อย่างเดียว · ฝ่ายกิจกรรม: ซ่อนสร้าง/ลบกิจกรรม
  const RO_EXEC = /delete|Delete|remove|Remove|openAdminEdit|openAddSubAdmin|k8NfOpen|resetPass|ResetPass|toggleSub|Status|k8GxOpen|exportTo|k8AsPromote|k8BhSubmit|k8BhCancel|saveSubject|addSubject|k8SjAdd|k8SjDel|k8SjSave|saveGrade|k8GrSave|importExcel|k8Pw|PrayerRoll|k8Hq(New|Edit|Del|Save)|k8PeAdd|k8PeEdit/;
  function readOnly() {
    const l = lim(); if (!l) return;
    const view = document.getElementById('view-admin'); if (!view) return;
    if (l === 'exec') {
      view.querySelectorAll('.admin-content-tab:not(#admin-tab-timetable) button, .admin-content-tab:not(#admin-tab-timetable) [onclick]').forEach((b) => { const oc = String(b.getAttribute('onclick') || ''); if (RO_EXEC.test(oc) && !b.dataset.k8ro) { b.dataset.k8ro = '1'; b.style.setProperty('display', 'none', 'important'); } });
      document.querySelectorAll('#k8ApTabs [data-tab]').forEach((b) => { if (b.dataset.tab !== 'leaves') b.style.setProperty('display', 'none', 'important'); });
      document.querySelectorAll('.k8-pr-tools button').forEach((b) => { const oc = String(b.getAttribute('onclick') || ''); if (!/prayer-rank/.test(oc)) b.style.setProperty('display', 'none', 'important'); });
    }
    if (l === 'act') {
      const f = document.getElementById('newActTitle'); const box = f && f.closest('div[style*="border"]'); if (box) box.style.setProperty('display', 'none', 'important');
      view.querySelectorAll('[onclick*="adminDeleteActivity"], [onclick*="deleteActivityAttendee"], [onclick*="openCreateActivity"], #k8ActAud').forEach((b) => b.style.setProperty('display', 'none', 'important'));
    }
  }
  const o = window.switchAdminTab;
  if (typeof o === 'function') window.switchAdminTab = function (t, btn) {
    const l = lim();
    if (l && !allowed(t)) { try { showToast('บัญชีนี้ไม่มีสิทธิ์ใช้เมนูนี้', 'warning'); } catch (e) {} t = HOME[l]; btn = Array.from(document.querySelectorAll('#k8AdminNav .admin-tab-btn')).find((b) => tabOf(b) === t) || btn; }
    const r = o.call(this, t, btn);
    if (l === 'exec' && t === 'approvals') setTimeout(() => { try { window.k8ApTab && window.k8ApTab('leaves'); } catch (e) {} }, 30);
    setTimeout(() => { nav(); readOnly(); }, 40);
    return r;
  };
  const hq = window.k8HqOpen; if (typeof hq === 'function') window.k8HqOpen = function () { const r = hq.apply(this, arguments); setTimeout(readOnly, 300); return r; };
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) {
    const l = lim();
    if (l && (v === 'teacher')) v = 'admin';
    const r = sv.call(this, v);
    if (l && v === 'admin') setTimeout(() => { nav(); const cur = document.querySelector('#view-admin .admin-content-tab[style*="block"], #view-admin .admin-content-tab.active'); const id = cur ? cur.id.replace('admin-tab-', '') : ''; if (!allowed(id)) window.switchAdminTab(HOME[l]); else readOnly(); }, 60);
    return r;
  };
  // หน้าเนื้อหาวาดใหม่บ่อย → ซ่อนปุ่มซ้ำเมื่อมีการเปลี่ยนแปลง
  let mo = null, tick = 0;
  function watch() { const v = document.getElementById('view-admin'); if (!v || mo) return; mo = new MutationObserver(() => { if (!lim() || tick) return; tick = setTimeout(() => { tick = 0; readOnly(); }, 120); }); mo.observe(v, { childList: true, subtree: true }); }
  const boot = () => { if (lim()) { nav(); watch(); readOnly(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 500)); else setTimeout(boot, 500);
  ['updateAdminUIVisibility'].forEach((fn) => { const f = window[fn]; if (typeof f === 'function') window[fn] = function () { const r = f.apply(this, arguments); setTimeout(boot, 50); return r; }; });
})();

/* ---------- v17.49 · หน้าสมัคร: เลือกวันเกิดด้วย 3 ช่องใหญ่ (วัน · เดือน · ปี พ.ศ.) แทนปฏิทินที่ต้องเลื่อนย้อนหลายปี ---------- */
(function () {
  const MN = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  function prep() {
    try { if (typeof initBirthDatePicker === 'function') initBirthDatePicker(); } catch (e) {}
    const y = document.getElementById('regBirthYear'), m = document.getElementById('regBirthMonth'), d = document.getElementById('regBirthDay');
    if (!y || !m || !d || y.dataset.k8) return; y.dataset.k8 = '1';
    // ปี พ.ศ.: เฉพาะช่วงอายุนักเรียน (6–30 ปี) เรียงจากปีที่น่าจะเป็นที่สุด
    const be = new Date().getFullYear() + 543, keep = y.value;
    Array.from(y.options).forEach((o) => { if (o.value) o.remove(); });
    for (let v = be - 6; v >= be - 30; v--) { const o = document.createElement('option'); o.value = String(v); o.textContent = String(v); y.appendChild(o); }
    if (keep) y.value = keep;
    Array.from(m.options).forEach((o) => { if (o.value) o.textContent = MN[+o.value - 1]; });
    const ph = { regBirthDay: 'วัน', regBirthMonth: 'เดือน', regBirthYear: 'ปี พ.ศ.' };
    [d, m, y].forEach((s) => { s.setAttribute('aria-label', ph[s.id]); const lab = document.createElement('span'); lab.className = 'k8-bd-lab'; lab.textContent = ph[s.id]; if (!s.parentElement.querySelector('.k8-bd-lab')) s.parentElement.insertBefore(lab, s); });
  }
  // วันในเดือน: ตัดวันที่ไม่มีจริง (เช่น 31 ก.พ.)
  function fixDays() {
    const y = document.getElementById('regBirthYear'), m = document.getElementById('regBirthMonth'), d = document.getElementById('regBirthDay'); if (!y || !m || !d) return;
    const yy = (+y.value || 2560) - 543, mm = +m.value || 1, max = new Date(yy, mm, 0).getDate();
    Array.from(d.options).forEach((o) => { if (o.value) o.disabled = o.hidden = +o.value > max; });
    if (+d.value > max) d.value = '';
  }
  function age() {
    const h = document.getElementById('regBirthDate'), ag = document.getElementById('k8RegAge'); if (!ag) return;
    const v = String((h && h.value) || '').replace(/\D/g, '');
    const a = v.length === 8 && window.k8AgeOf ? window.k8AgeOf(v) : null;
    ag.hidden = !a; if (a) ag.innerHTML = 'เกิด ' + (+v.slice(0, 2)) + ' ' + MN[+v.slice(2, 4) - 1] + ' ' + v.slice(4) + ' · <b>อายุ ' + a.y + ' ปี' + (a.m ? ' ' + a.m + ' เดือน' : '') + '</b>';
  }
  const os = window.syncBirthDatePicker;
  if (typeof os === 'function') window.syncBirthDatePicker = function () { fixDays(); const r = os.apply(this, arguments); setTimeout(age, 0); return r; };
  ['handleAuthModeSegmentChange', 'toggleAuthForm', 'openModal'].forEach((fn) => { const o = window[fn]; if (typeof o === 'function') window[fn] = function () { const r = o.apply(this, arguments); setTimeout(prep, 30); return r; }; });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', prep); else prep();
})();


/* ---------- v17.51 · ฝั่งอาจารย์บนแท็บเล็ต/คอมพิวเตอร์ (TP2): แถบบนขีดเส้นใต้ + 3 คอลัมน์ ---------- */
(function () {
  const TAB = 768, DESK = 993;
  const ov = () => document.getElementById('teacher-tab-overview');
  const vt = () => document.getElementById('view-teacher');
  let mode = '';
  function cols(o) {
    let l = o.querySelector(':scope > .k8-tp-l');
    if (!l) {
      l = document.createElement('div'); l.className = 'k8-tp-l';
      const c = document.createElement('div'); c.className = 'k8-tp-c';
      const r = document.createElement('div'); r.className = 'k8-tp-r';
      o.insertBefore(r, o.firstChild); o.insertBefore(l, r); o.insertBefore(c, r);
    }
    return [l, o.querySelector(':scope > .k8-tp-c'), o.querySelector(':scope > .k8-tp-r')];
  }
  const pick = (o, sel) => o.querySelector(sel);
  function enter(o) {
    const hero = pick(o, '#k8ThHero'); if (!hero) return false;
    const [l, c, r] = cols(o);
    [['#k8ThTl', l], ['#k8ThHero', c], ['.k8-th-quick', c], ['.k8-todo', r], ['.k8-th-week', r], ['.k8-follow', r], ['.k8-eval-card', r]].forEach(([sel, host]) => { const el = pick(o, sel); if (el && el.parentElement !== host) host.appendChild(el); });
    return true;
  }
  function leave(o) {
    const l = o.querySelector(':scope > .k8-tp-l'); if (!l) return;
    const anchor = l;
    ['#k8ThHero', '.k8-th-quick', '#k8ThTl', '.k8-th-week', '.k8-todo', '.k8-follow', '.k8-eval-card'].forEach((sel) => { const el = pick(o, sel); if (el) o.insertBefore(el, anchor); });
    o.querySelectorAll(':scope > .k8-tp-l, :scope > .k8-tp-c, :scope > .k8-tp-r').forEach((x) => x.remove());
  }
  // แถบบนของคอมพิวเตอร์ (TP2): โลโก้ · แท็บขีดเส้นใต้ · ค้นหานักเรียน · กระดิ่ง · บัญชี
  // v17.53 · เป็นแถบของหน้าอาจารย์เอง (หัวเว็บถูกซ่อนเมื่อเข้าด้วยบัญชีแอดมิน)
  const escH = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function bar() {
    let b = document.getElementById('k8TpBar'); const v = vt(); if (!v) return null;
    if (!b) {
      b = document.createElement('div'); b.id = 'k8TpBar'; b.className = 'k8-tp-bar';
      const img = document.querySelector('.app-header .brand-wrapper img');
      b.innerHTML = '<div class="k8-tp-in"><button type="button" class="k8-tp-brand" onclick="switchTeacherTab(\'overview\')" aria-label="หน้าภาพรวม">' + (img ? '<img src="' + img.getAttribute('src') + '" alt="">' : '') + '<b>KHALIFAH</b></button>' +
        '<span class="k8-tp-navslot"></span>' +
        '<div class="k8-tp-search" role="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" id="k8TpQ" placeholder="ค้นหานักเรียน" autocomplete="off" aria-label="ค้นหานักเรียน" aria-controls="k8TpRes"><div class="k8-tp-res" id="k8TpRes" role="listbox" hidden></div></div>' +
        '<button type="button" class="k8-tp-admin" id="k8TpAdmin" onclick="switchView(\'admin\')" hidden>ระบบแอดมิน</button>' +
        '<div class="k8-tp-acts" id="k8TpActs"></div></div>';
      v.insertBefore(b, v.firstChild);
      const q = b.querySelector('#k8TpQ'), res = b.querySelector('#k8TpRes');
      const paint = () => {
        const t = q.value.trim().toLowerCase(); if (!t) { res.hidden = true; res.innerHTML = ''; return; }
        const list = ((typeof allStudents !== 'undefined' && Array.isArray(allStudents)) ? allStudents : []).filter((x) => x && x.studentId && (String(x.fullName || '').toLowerCase().indexOf(t) !== -1 || String(x.studentId).indexOf(t) !== -1)).slice(0, 8);
        res.innerHTML = list.length ? list.map((x) => '<button type="button" role="option" data-sid="' + escH(x.studentId) + '"><b>' + escH(x.fullName || x.studentId) + '</b><small>' + escH([String(x.grade || '').replace('มัธยมศึกษาปีที่ ', 'ม.'), x.studentId].filter(Boolean).join(' · ')) + '</small></button>').join('') : '<p>ไม่พบนักเรียน</p>';
        res.hidden = false;
      };
      q.addEventListener('input', paint); q.addEventListener('focus', paint);
      q.addEventListener('keydown', (e) => { if (e.key === 'Escape') { q.value = ''; paint(); } if (e.key === 'Enter') { const f = res.querySelector('button[data-sid]'); if (f) f.click(); } });
      res.addEventListener('click', (e) => {
        if (e.target.closest('[data-tp-back]')) { paint(); q.focus(); return; }
        const o = e.target.closest('button[data-sid]'); if (!o) return;
        const na = document.getElementById('nav-admin'); let me = null; try { me = currentAdmin; } catch (er) {}
        if (na && na.style.display !== 'none' && me && !me.limited) { res.hidden = true; q.value = ''; try { viewStudentDetails(o.dataset.sid); } catch (er) {} return; }
        // อาจารย์: การ์ดข้อมูลแบบอ่านอย่างเดียว (ชั้น · รหัส · สถานะ · เกรดวิชาที่ฉันสอน)
        const st = (allStudents || []).find((x) => String(x.studentId) === o.dataset.sid); if (!st) return;
        const sel = document.getElementById('teacherPortalSubjectSelect'); const subs = (typeof appSubjects !== 'undefined' && Array.isArray(appSubjects)) ? appSubjects : [];
        const mine = sel ? Array.from(sel.options).map((op) => subs.find((x) => String(x.id) === op.value) || { id: op.value, name: op.textContent }) : [];
        const gr = mine.map((sj) => { const g = st.subjectGrades ? st.subjectGrades[sj.id] : undefined; const has = g !== undefined && g !== null && g !== ''; return '<span class="k8-tp-sg' + (has ? '' : ' is-miss') + '">' + escH(sj.name) + ' <b>' + (has ? escH(g) : '–') + '</b></span>'; }).join('');
        res.innerHTML = '<div class="k8-tp-card"><button type="button" class="k8-tp-back" data-tp-back>‹ ผลการค้นหา</button><b class="k8-tp-cn">' + escH(st.fullName || st.studentId) + '</b><small>' + escH([String(st.grade || '').replace('มัธยมศึกษาปีที่ ', 'ม.'), 'รหัส ' + st.studentId, st.status || ''].filter(Boolean).join(' · ')) + '</small>' + (gr ? '<div class="k8-tp-sgs">' + gr + '</div>' : '') + '</div>';
      });
      document.addEventListener('click', (e) => { if (!e.target.closest('.k8-tp-search')) res.hidden = true; });
    }
    return b;
  }
  function hdrIn() {
    const b = bar(); if (!b) return;
    const nav = document.querySelector('.teacher-segmented-nav'); const slot = b.querySelector('.k8-tp-navslot');
    if (nav && nav.parentElement !== slot) slot.appendChild(nav);
    const acts = b.querySelector('#k8TpActs');
    const acct = document.querySelector('#k8ThHero .k8-acct'); if (acct && acct.parentElement !== acts) acts.appendChild(acct);
    const na = document.getElementById('nav-admin'); const ab = b.querySelector('#k8TpAdmin');
    if (ab) ab.hidden = !(na && na.style.display !== 'none');
  }
  function hdrOut() {
    const b = document.getElementById('k8TpBar'); const v = vt();
    const nav = b && b.querySelector('.teacher-segmented-nav');
    if (nav && v) v.insertBefore(nav, b.nextSibling);
    const acts = document.getElementById('k8TpActs'); const head = document.querySelector('#k8ThHero .k8-th-head');
    if (acts && head) { const acct = acts.querySelector('.k8-acct'); if (acct) head.appendChild(acct); const bell = acts.querySelector('#k8Bell'); if (bell) head.insertBefore(bell, head.querySelector('.k8-acct')); }
  }
  function sync() {
    const v = vt(), o = ov(); if (!v || !o) return;
    let staff = null; try { staff = currentAdmin; } catch (e) {}
    const on = !!staff && v.classList.contains('active') && innerWidth >= TAB;
    const desk = on && innerWidth >= DESK;
    const m = on ? (desk ? 'd' : 't') : '';
    const root = document.documentElement;
    root.classList.toggle('k8-tp', on); root.classList.toggle('k8-tpd', desk);
    if (on) { if (!enter(o)) return; } else if (mode) leave(o);
    if (desk) hdrIn(); else if (mode === 'd' || document.querySelector('#k8TpBar .teacher-segmented-nav')) hdrOut();
    if (m !== mode || desk) { mode = m; try { window.k8BellPlace && window.k8BellPlace(); } catch (e) {} }
    const nm = document.getElementById('k8ThName'); if (nm) nm.dataset.hi = '';
  }
  let tmr = 0; const later = () => { clearTimeout(tmr); tmr = setTimeout(sync, 60); };
  window.addEventListener('resize', later);
  const wrap = (n) => { const f = window[n]; if (typeof f === 'function' && !f.__k8tp) { const g = function () { const r = f.apply(this, arguments); later(); return r; }; g.__k8tp = 1; window[n] = g; } };
  function arm() {
    ['switchView', 'switchTeacherTab', 'performStaffLogin', 'logout', 'handleLogout'].forEach(wrap);
    const v = vt(); if (v) new MutationObserver(later).observe(v, { attributes: true, attributeFilter: ['class'] });
    const o = ov(); if (o) new MutationObserver(() => { if (mode && o.querySelector(':scope > #k8ThHero, :scope > .k8-todo, :scope > .k8-follow, :scope > .k8-eval-card')) later(); }).observe(o, { childList: true });
    later(); setTimeout(later, 1500);
  }
  window.k8TpSync = sync;
  if (document.readyState === 'complete') arm(); else window.addEventListener('load', arm);
})();

/* ---------- v17.54 · แอดมิน: ปุ่มเข้า "โหมดอาจารย์" และ "ดูแบบนักเรียน" ย้ายมาอยู่แถบบนขวา ---------- */
(function () {
  const ICO_T = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18v11H3zM8 21h8M12 16v5"/></svg>';
  const ICO_S = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  function place() {
    const bar = document.querySelector('#view-admin .k8-adm-bar'); if (!bar || bar.querySelector('.k8-adm-modes')) return;
    const box = document.createElement('div'); box.className = 'k8-adm-modes'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'สลับโหมด');
    box.innerHTML = '<button type="button" class="k8-adm-mode" onclick="switchView(\'teacher\')" aria-label="เข้าโหมดอาจารย์" title="เข้าโหมดอาจารย์">' + ICO_T + '<span>โหมดอาจารย์</span></button>' +
      '<button type="button" class="k8-adm-mode" onclick="k8PreviewDemo()" aria-label="ดูแอปแบบนักเรียน" title="ดูแอปแบบนักเรียน">' + ICO_S + '<span>ดูแบบนักเรียน</span></button>';
    const bell = bar.querySelector('#k8Bell, .k8-adm-me');
    if (bell) bar.insertBefore(box, bell); else bar.appendChild(box);
  }
  function arm() { place(); const v = document.getElementById('view-admin'); if (v) new MutationObserver(place).observe(v, { childList: true, subtree: true }); }
  if (document.readyState === 'complete') arm(); else window.addEventListener('load', arm);
})();

/* ---------- v17.55 · ผลประเมินจากนักเรียน: ย้ายเป็นปุ่มทางลัดในกลุ่มเดียวกับ เช็คชื่อ/ตารางสอน/... ---------- */
(function () {
  const TILE = '<button type="button" class="k8-ev-qbtn" onclick="k8EvalSummary()"><span style="background:#e0f2fe;color:#0369a1"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.7 5.5 6 .9-4.35 4.25 1 6L12 16.8 6.65 19.65l1-6L3.3 9.4l6-.9z"/></svg></span>ผลประเมิน</button>';
  function place() {
    const q = document.querySelector('#teacher-tab-overview .k8-th-quick'); if (!q) return;
    // v17.57 · คำทักทาย: السلام عليكم แล้วบรรทัดถัดไปเป็นชื่ออาจารย์
    const nm = document.getElementById('k8ThName');
    if (nm && !(nm.previousElementSibling && nm.previousElementSibling.classList.contains('k8-th-salam'))) nm.insertAdjacentHTML('beforebegin', '<div class="k8-th-salam" lang="ar" dir="rtl">السلام عليكم</div>');
    if (!q.querySelector('.k8-ev-qbtn')) q.insertAdjacentHTML('beforeend', TILE);
    // ลำดับเดียวกันทุกจอ: เช็คชื่อ · ตารางสอน · เอกสาร · หะละเกาะฮฺ · พฤติกรรม · ลงทะเบียนวิชา · ลาสอน · ผลประเมิน
    const ORDER = ['attendance', 'k8TtOpen', 'k8DocsOpen', 'k8HqOpen', 'k8BhTeachOpen', 'k8-en-qbtn', 'k8-lv-qbtn', 'k8-ev-qbtn'];
    const rank = (b) => { const k = (b.getAttribute('onclick') || '') + ' ' + b.className; const i = ORDER.findIndex((x) => k.indexOf(x) !== -1); return i === -1 ? 99 : i; };
    const btns = Array.from(q.children).filter((b) => b.tagName === 'BUTTON');
    const sorted = btns.slice().sort((a, b) => rank(a) - rank(b));
    if (sorted.some((b, i) => b !== btns[i])) sorted.forEach((b) => q.appendChild(b));
  }
  function arm() {
    place();
    const o = document.getElementById('teacher-tab-overview');
    if (o) new MutationObserver(() => place()).observe(o, { childList: true, subtree: true });
  }
  if (document.readyState === 'complete') arm(); else window.addEventListener('load', arm);
})();

/* ---------- v17.59 · ลงทะเบียนรายวิชา (อาจารย์): ขยายเต็มจอ สำหรับฉาย QR หน้าชั้น ---------- */
(function () {
  const ICO_IN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
  const ICO_OUT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>';
  function paint(on) {
    const m = document.getElementById('k8EnModal'), b = document.getElementById('k8EnFullBtn'); if (!m || !b) return;
    m.classList.toggle('k8-en-full', on);
    b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'ย่อกลับ' : 'ขยายเต็มจอ'); b.title = on ? 'ย่อกลับ' : 'ขยายเต็มจอ';
    b.innerHTML = (on ? ICO_OUT : ICO_IN) + '<span>' + (on ? 'ย่อกลับ' : 'ขยายเต็มจอ') + '</span>';
  }
  window.k8EnFull = function (force) {
    const m = document.getElementById('k8EnModal'); if (!m) return;
    const on = typeof force === 'boolean' ? force : !m.classList.contains('k8-en-full');
    paint(on);
    try {
      if (on && m.requestFullscreen && !document.fullscreenElement) m.requestFullscreen().catch(() => {});
      if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch (e) {}
  };
  // ออกจากเต็มจอด้วยปุ่ม Esc ของเบราว์เซอร์ → ย่อการ์ดกลับด้วย
  document.addEventListener('fullscreenchange', () => { const m = document.getElementById('k8EnModal'); if (!document.fullscreenElement && m && m.classList.contains('k8-en-full')) paint(false); });
})();


/* ---------- v17.60 · วิชาตามตารางเรียน/ตารางสอน: อาจารย์เห็นเฉพาะวิชาที่สอน · แอดมินเห็นวิชาที่ยังไม่มีผู้สอน ---------- */
(function () {
  const subsAll = () => { try { if (typeof loadAppSubjects === 'function') loadAppSubjects(); return Array.isArray(appSubjects) ? appSubjects : []; } catch (e) { return []; } };
  const tt = () => { try { return JSON.parse(localStorage.getItem('khalifah_timetable') || 'null'); } catch (e) { return null; } };
  function cells() {
    const t = tt(); const out = []; if (!t) return out;
    const push = (cs, where) => Object.keys(cs || {}).forEach((k) => { (Array.isArray(cs[k]) ? cs[k] : [cs[k]]).forEach((c) => { if (c && (c.s || c.sn)) out.push({ c, where }); }); });
    Object.keys(t.grades || {}).forEach((g) => push((t.grades[g] || {}).cells, 'ม.' + g));
    (t.extras || []).forEach((x) => push(x && x.cells, x && x.name));
    return out;
  }
  const match = (sub, c) => (c.s && (String(c.s) === String(sub.id) || (sub.code && String(c.s) === String(sub.code)))) || (!c.s && String(c.sn || '').trim() === String(sub.name || '').trim());
  // วิชาที่กำหนดให้ "ทุกวิชา" (ค่าเริ่มต้นเดิมตอนสร้างบัญชี) ถือว่ายังไม่ได้ระบุ
  function explicitIds(a, subs) {
    const ids = a && Array.isArray(a.assignedSubjects) ? a.assignedSubjects.map(String) : (a && a.assignedSubject ? [String(a.assignedSubject)] : []);
    if (subs.length >= 2 && subs.every((x) => ids.indexOf(String(x.id)) !== -1)) return [];
    return ids;
  }
  const adminish = (a) => !!a && (/SUPER|^admin$|EXEC/i.test(String(a.role || '')) || a.isOwner);
  window.k8TeacherSubjects = function (a) {
    const subs = subsAll(); if (!a) return [];
    if (adminish(a)) return subs.slice();
    const ids = explicitIds(a, subs);
    const un = String(a.username || '').toLowerCase(), fn = String(a.fullName || a.name || '').trim();
    const mineCells = cells().filter((x) => (un && String(x.c.t || '').toLowerCase() === un) || (fn && String(x.c.tn || '').trim() === fn));
    return subs.filter((sub) => ids.indexOf(String(sub.id)) !== -1 || (sub.code && ids.indexOf(String(sub.code)) !== -1) || mineCells.some((x) => match(sub, x.c)));
  };
  // วิชาที่ยังไม่มีผู้สอน: ไม่มีอาจารย์ที่ถูกกำหนดวิชานี้ และในตารางสอนไม่มีช่องไหนระบุผู้สอนของวิชานี้
  window.k8SubjNoTeacher = function () {
    const subs = subsAll(); const all = cells();
    let staff = []; try { staff = Array.isArray(subAdmins) ? subAdmins : []; } catch (e) {}
    staff = staff.filter((x) => x && !/INSPECTOR|ACTIVITY/i.test(String(x.role || '')));
    return subs.filter((sub) => {
      if (staff.some((t) => explicitIds(t, subs).some((id) => id === String(sub.id) || (sub.code && id === String(sub.code))))) return false;
      return !all.some((x) => match(sub, x.c) && (x.c.t || x.c.tn));
    }).map((sub) => {
      const where = Array.from(new Set(all.filter((x) => match(sub, x.c)).map((x) => x.where).filter(Boolean)));
      return { id: sub.id, name: sub.name, where, inTimetable: where.length > 0 };
    });
  };
  // ตารางรายวิชาของแอดมิน: ป้ายเตือนวิชาที่ยังไม่มีผู้สอน
  function badge() {
    const body = document.getElementById('adminSubjectsTableBody'); if (!body) return;
    const L = window.k8SubjNoTeacher(); const box = document.getElementById('k8SubjWarn');
    const host = body.closest('table');
    let w = box;
    if (!w && host) { w = document.createElement('div'); w.id = 'k8SubjWarn'; w.className = 'k8-subj-warn'; w.setAttribute('role', 'status'); host.parentElement.insertBefore(w, host); }
    if (w) { w.hidden = !L.length; w.innerHTML = L.length ? '<b>วิชาที่ยังไม่ระบุผู้สอน ' + L.length + ' วิชา</b><span>กำหนดได้ที่ "อาจารย์ &amp; ผู้บริหาร" (เลือกวิชาที่สอน) หรือระบุผู้สอนในตารางสอน</span>' : ''; }
    body.querySelectorAll('tr').forEach((tr) => {
      const id = (tr.querySelector('.activity-badge') || {}).textContent; if (!id) return;
      const hit = L.find((x) => String(x.id) === id.trim());
      let tag = tr.querySelector('.k8-subj-nt');
      if (hit && !tag) { const td = tr.querySelector('td'); if (td) td.insertAdjacentHTML('beforeend', ' <span class="k8-subj-nt">ยังไม่มีผู้สอน</span>'); }
      if (!hit && tag) tag.remove();
    });
  }
  const orig = window.renderAdminSubjectsTable;
  if (typeof orig === 'function') window.renderAdminSubjectsTable = function () { const r = orig.apply(this, arguments); try { badge(); } catch (e) {} return r; };
  document.addEventListener('k8-tt-loaded', () => { try { badge(); if (window.renderAdminOverviewV8 && document.getElementById('k8OvTodo')) window.renderAdminOverviewV8(); } catch (e) {} });
  // อาจารย์: โหลดตารางสอนเสร็จ → อัปเดตรายวิชาในหน้าอาจารย์
  document.addEventListener('k8-tt-loaded', () => { try { const v = document.getElementById('view-teacher'); if (v && v.classList.contains('active') && typeof initTeacherPortalView === 'function') { const ss = document.getElementById('teacherPortalSubjectSelect'); const keep = ss ? ss.value : ''; initTeacherPortalView(); if (ss && keep && Array.from(ss.options).some((o) => o.value === keep)) { ss.value = keep; if (typeof renderTeacherPortalGradesTable === 'function') renderTeacherPortalGradesTable(); } } } catch (e) {} });
})();

/* ---------- v17.89 · วันเสาร์ = วันหยุดประจำสัปดาห์: นักเรียนเช็คชื่อละหมาด/ถ่ายรูปไม่ได้ ---------- */
(function () {
  const fajr = () => { try { const w = PRAYER_TIME_WINDOWS.find((x) => x.name === 'ซุบฮิ' || x.key === 'ซุบฮิ'); return w ? w.startMin : 285; } catch (e) { return 285; } };
  // นับตามวันละหมาด: หลังเที่ยงคืนแต่ก่อนรุ่งเช้า ยังเป็นวันก่อนหน้า (อีชาอ์คืนวันศุกร์ยังเช็คได้)
  const isHoliday = () => { const n = new Date(); const m = n.getHours() * 60 + n.getMinutes(); const d = new Date(n.getTime() - (m < fajr() ? 86400000 : 0)); return d.getDay() === 6; };
  const isStu = () => { try { return !!currentStudent && !window.k8SimOn; } catch (e) { return false; } };
  const on = () => isStu() && isHoliday();
  window.k8WeeklyHoliday = on;
  const MSG = 'วันเสาร์เป็นวันหยุดประจำสัปดาห์ · งดเช็คชื่อละหมาดและถ่ายรูป';
  const o = window.getPrayerSlotTimeStatus;
  if (typeof o === 'function') window.getPrayerSlotTimeStatus = function () { const r = o.apply(this, arguments) || {}; return on() ? Object.assign({}, r, { isActive: false, isPast: false, isFuture: true, isOpen: false, isHoliday: true, statusText: 'วันหยุด (วันเสาร์)' }) : r; };
  const og = window.gasApiCall;
  if (typeof og === 'function') window.gasApiCall = function (action) { if ((action === 'recordPrayer' || action === 'prayerCheckIn') && on()) { try { showToast(MSG, 'warning'); } catch (e) {} return Promise.resolve({ success: false, holiday: true, message: MSG }); } return og.apply(this, arguments); };
  function paint() {
    const wrap = document.querySelector('#view-prayer .k8-pr-wrap'); if (!wrap) return;
    const flag = on();
    document.documentElement.classList.toggle('k8-sat-off', flag);
    let b = document.getElementById('k8SatOff');
    if (!flag) { if (b) b.hidden = true; return; }
    if (!b) { b = document.createElement('div'); b.id = 'k8SatOff'; b.className = 'k8-sat-off'; b.setAttribute('role', 'status'); const head = wrap.querySelector('.k8-pg-head'); if (head) head.insertAdjacentElement('afterend', b); else wrap.prepend(b); }
    b.hidden = false;
    b.innerHTML = '<span class="k8-sat-ico" aria-hidden="true">🔒</span><b>วันนี้วันเสาร์ · วันหยุดประจำสัปดาห์</b><span>งดเช็คชื่อละหมาดและถ่ายรูปทุกเวลา · ระบบจะเปิดให้เช็คชื่ออีกครั้งตั้งแต่ซุบฮิวันอาทิตย์</span>';
    try { stopCameraStream(); } catch (e) {}
  }
  window.k8SatPaint = paint;
  const sv = window.switchView;
  if (typeof sv === 'function') window.switchView = function (v) { const r = sv.apply(this, arguments); if (v === 'prayer' || v === 'dashboard') setTimeout(paint, 50); return r; };
  setInterval(paint, 60000); setTimeout(paint, 1500);
})();

/* ---------- v17.93 · สรุปการมาเรียน (อาจารย์: ในเช็คชื่อ · แอดมิน: เมนูสรุปการมาเรียน) ---------- */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p2 = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const norm = (v) => String(v || '').replace(/\D/g, '').replace(/^0+/, '');
  const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const dTh = (s) => { const d = new Date(s + 'T00:00:00'); return isNaN(d) ? s : d.getDate() + ' ' + MON[d.getMonth()] + ' ' + String(d.getFullYear() + 543).slice(2); };
  const KEY = (st) => { st = String(st || ''); return /สาย/.test(st) ? 'late' : /ลา/.test(st) ? 'leave' : /ขาด/.test(st) ? 'absent' : /มา|present/i.test(st) ? 'present' : (/late/i.test(st) ? 'late' : /leave/i.test(st) ? 'leave' : /absent/i.test(st) ? 'absent' : 'present'); };
  const LBL = { present: 'มา', late: 'สาย', leave: 'ลา', absent: 'ขาด' };
  const me = () => { try { return currentAdmin; } catch (e) { return null; } };
  const isAdm = () => { const a = me(); return !!a && /SUPER|ADMIN|EXEC/i.test(String(a.role || '')) && !/^(TEACHER|INSPECTOR|NIGHTDUTY)$/i.test(String(a.realRole || '')); };
  const A = { subj: '', grade: 'ALL', from: '', to: '', preset: 'month', view: 'stu', rows: null, loading: false, q: '' };
  function subjects() {
    let all = []; try { all = (appSubjects || []).slice(); } catch (e) {}
    if (isAdm()) return all;
    return window.k8TeacherSubjects ? window.k8TeacherSubjects(me()) : all;
  }
  function setPreset(k) {
    const t = new Date(); A.preset = k; A.to = ymd(t);
    if (k === 'today') A.from = A.to;
    else if (k === 'week') { const d = new Date(t); d.setDate(d.getDate() - 6); A.from = ymd(d); }
    else if (k === 'month') A.from = ymd(new Date(t.getFullYear(), t.getMonth(), 1));
    else if (k === 'term') { let s = ''; try { s = (window.k8TermStart && window.k8TermStart()) || ''; } catch (e) {} A.from = s || ymd(new Date(t.getFullYear(), t.getMonth() - 4, 1)); }
  }
  async function load() {
    A.loading = true; render();
    let r = null; try { r = await gasApiCall('getAttendance', {}, 45000); } catch (e) {}
    let L = (r && r.success && r.data) || null;
    if (!L) { try { L = JSON.parse(localStorage.getItem('khalifah_attendance_logs') || '[]'); } catch (e) { L = []; } }
    A.rows = L; A.loading = false; render();
  }
  function filtered() {
    const subs = subjects(); const allowed = new Set(subs.map((s) => String(s.id)));
    return (A.rows || []).filter((r) => r && r.date && r.subjectCode && r.date >= A.from && r.date <= A.to &&
      (A.subj ? String(r.subjectCode) === String(A.subj) : (isAdm() || allowed.has(String(r.subjectCode)))) &&
      (A.grade === 'ALL' || String(r.grade || '').indexOf(A.grade) !== -1 || String(r.grade || '').replace(/\D/g, '') === A.grade));
  }
  function stats(list) { const c = { present: 0, late: 0, leave: 0, absent: 0 }; list.forEach((r) => { c[KEY(r.status)]++; }); c.total = list.length; c.pct = c.total ? Math.round((c.present + c.late) / c.total * 100) : 0; return c; }
  function render() {
    const B = document.getElementById('k8AsumB'); if (!B) return;
    const subs = subjects();
    const sub = document.getElementById('k8AsumS'); if (sub) sub.textContent = (isAdm() ? 'ทุกวิชา ทุกชั้น' : 'วิชาที่คุณสอน') + ' · ' + dTh(A.from) + (A.from !== A.to ? ' – ' + dTh(A.to) : '');
    const L = A.rows ? filtered() : [];
    const S = stats(L);
    const sessions = new Set(L.map((r) => r.date + '|' + r.subjectCode + '|' + (r.period || ''))).size;
    let h = '<section class="k8-asum-f">' +
      '<label><span>วิชา</span><select onchange="k8AsumSet(\'subj\', this.value)"><option value="">' + (isAdm() ? 'ทุกวิชา' : 'ทุกวิชาที่สอน') + '</option>' + subs.map((s) => '<option value="' + esc(s.id) + '"' + (String(s.id) === String(A.subj) ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select></label>' +
      '<label><span>ชั้นปี</span><select onchange="k8AsumSet(\'grade\', this.value)">' + ['ALL', '1', '2', '3', '4', '5', '6'].map((g) => '<option value="' + g + '"' + (A.grade === g ? ' selected' : '') + '>' + (g === 'ALL' ? 'ทุกชั้น' : 'ม.' + g) + '</option>').join('') + '</select></label>' +
      '<div class="k8-asum-pre">' + [['today', 'วันนี้'], ['week', '7 วัน'], ['month', 'เดือนนี้'], ['term', 'ภาคเรียน']].map(([k, l]) => '<button type="button" aria-pressed="' + (A.preset === k) + '" onclick="k8AsumPre(\'' + k + '\')">' + l + '</button>').join('') + '</div>' +
      '<div class="k8-asum-dr"><label><span>ตั้งแต่</span><input type="date" value="' + A.from + '" onchange="k8AsumSet(\'from\', this.value)"></label><label><span>ถึง</span><input type="date" value="' + A.to + '" onchange="k8AsumSet(\'to\', this.value)"></label></div></section>';
    if (A.loading && !A.rows) { B.innerHTML = h + '<p class="k8-asum-empty">กำลังโหลดข้อมูลการมาเรียน…</p>'; return; }
    h += '<section class="k8-asum-kpi"><div class="is-big"><small>อัตรามาเรียน</small><b>' + S.pct + '%</b><span>' + sessions + ' คาบ · ' + S.total + ' รายการ</span></div>' +
      ['present', 'late', 'leave', 'absent'].map((k) => '<div class="is-' + k + '"><small>' + LBL[k] + '</small><b>' + S[k] + '</b></div>').join('') + '</section>';
    h += '<div class="k8-asum-tabs" role="tablist">' + [['stu', 'รายนักเรียน'], ['day', 'รายวัน'], ['subj', 'รายวิชา']].map(([k, l]) => '<button type="button" role="tab" aria-selected="' + (A.view === k) + '" onclick="k8AsumSet(\'view\', \'' + k + '\')">' + l + '</button>').join('') + '</div>';
    if (!L.length) { B.innerHTML = h + '<p class="k8-asum-empty">ไม่มีบันทึกการเช็คชื่อในช่วงที่เลือก</p>'; return; }
    const groups = {};
    const kf = A.view === 'stu' ? (r) => norm(r.studentId) : A.view === 'day' ? (r) => r.date : (r) => String(r.subjectCode);
    L.forEach((r) => { const k = kf(r); (groups[k] = groups[k] || []).push(r); });
    let G = Object.keys(groups).map((k) => { const list = groups[k]; const st = stats(list); const r0 = list[0]; return { k, st, label: A.view === 'stu' ? (r0.studentName || r0.studentId) : A.view === 'day' ? dTh(k) : (r0.subjectName || k), sub: A.view === 'stu' ? String(r0.grade || '').replace('มัธยมศึกษาปีที่ ', 'ม.') + ' · ' + r0.studentId : A.view === 'day' ? new Set(list.map((r) => r.subjectCode + '|' + (r.period || ''))).size + ' คาบ' : new Set(list.map((r) => r.date + '|' + (r.period || ''))).size + ' คาบ' }; });
    if (A.view === 'day') G.sort((a, b) => b.k.localeCompare(a.k)); else G.sort((a, b) => a.st.pct - b.st.pct || a.label.localeCompare(b.label, 'th'));
    if (A.view === 'stu' && A.q) G = G.filter((g) => (g.label + ' ' + g.sub).toLowerCase().indexOf(A.q.toLowerCase()) !== -1);
    h += (A.view === 'stu' ? '<input type="search" class="k8-asum-q" placeholder="ค้นหาชื่อหรือรหัสนักเรียน" value="' + esc(A.q) + '" oninput="k8AsumQ(this)">' : '') +
      '<div class="k8-asum-tw"><table class="k8-asum-t"><thead><tr><th>' + (A.view === 'stu' ? 'นักเรียน' : A.view === 'day' ? 'วันที่' : 'วิชา') + '</th><th>มา</th><th>สาย</th><th>ลา</th><th>ขาด</th><th>%</th></tr></thead><tbody>' +
      G.map((g) => '<tr class="' + (g.st.pct < 80 ? 'is-low' : '') + '"><td><b>' + esc(g.label) + '</b><small>' + esc(g.sub) + '</small></td><td>' + g.st.present + '</td><td>' + g.st.late + '</td><td>' + g.st.leave + '</td><td class="' + (g.st.absent ? 'is-ab' : '') + '">' + g.st.absent + '</td><td><span class="k8-asum-pc" style="--p:' + g.st.pct + '">' + g.st.pct + '%</span></td></tr>').join('') + '</tbody></table></div>' +
      '<p class="k8-asum-note">% = (มา + สาย) ÷ ทุกครั้งที่เช็คชื่อ · แถวสีแดง = ต่ำกว่า 80%</p>';
    B.innerHTML = h; A.lastG = G;
  }
  window.k8AsumSet = function (k, v) { A[k] = v; if (k === 'from' || k === 'to') { A.preset = ''; if (A.from > A.to) { const t = A.from; A.from = A.to; A.to = t; } } render(); };
  window.k8AsumPre = function (k) { setPreset(k); render(); };
  let qt = null; window.k8AsumQ = function (el) { clearTimeout(qt); qt = setTimeout(() => { A.q = el.value; const pos = el.selectionStart; render(); const n = document.querySelector('.k8-asum-q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }, 150); };
  window.k8AsumOpen = function () {
    const el = document.getElementById('k8Asum'); if (!el) return;
    if (!A.from) setPreset('month');
    try { const st = window.k8TaState; if (st && st.picked && st.subject && st.subject !== '__none' && !isAdm()) A.subj = st.subject; } catch (e) {}
    el.hidden = false; document.documentElement.classList.add('k8-docs-open'); try { history.pushState({ k8asum: 1 }, ''); } catch (e) {}
    render(); load();
  };
  window.k8AsumClose = function () { const el = document.getElementById('k8Asum'); if (el && !el.hidden) { el.hidden = true; document.documentElement.classList.remove('k8-docs-open'); } };
  window.addEventListener('popstate', () => { const el = document.getElementById('k8Asum'); if (el && !el.hidden) window.k8AsumClose(); });
  window.k8AsumCsv = function () {
    const G = A.lastG || []; if (!G.length) { try { showToast('ยังไม่มีข้อมูลให้ดาวน์โหลด', 'warning'); } catch (e) {} return; }
    const head = [A.view === 'stu' ? 'นักเรียน' : A.view === 'day' ? 'วันที่' : 'วิชา', 'รายละเอียด', 'มา', 'สาย', 'ลา', 'ขาด', 'ร้อยละ'];
    const csv = [head].concat(G.map((g) => [g.label, g.sub, g.st.present, g.st.late, g.st.leave, g.st.absent, g.st.pct])).map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = 'สรุปการมาเรียน_' + A.from + '_' + A.to + '.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
})();

/* ---------- v17.94 · สลับคาบระหว่างอาจารย์ (ชั่วคราว) ---------- */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p2 = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const DN = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const dTh = (x) => { const d = new Date(x + 'T00:00:00'); return isNaN(d) ? x : DN[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; };
  const toast = (m, t) => { try { showToast(m, t || 'info'); } catch (e) {} };
  const me = () => { try { return currentAdmin || {}; } catch (e) { return {}; } };
  const W = { list: [], tab: 'in', form: null, busy: false, data: null };
  const ST = { pending: ['รอตอบรับ', '#fef3c7', '#92400e'], approved: ['ตอบรับแล้ว', '#dcfce7', '#166534'], rejected: ['ปฏิเสธ', '#fee2e2', '#991b1b'], cancelled: ['ยกเลิก', '#f1f5f9', '#475569'] };
  async function ttData() { if (W.data) return W.data; let r = null; try { r = await gasApiCall('getTimetable', {}, 30000); } catch (e) {} W.data = (r && r.success) ? r : { grades: {}, config: { periods: [] } }; return W.data; }
  const cellsOf = (g, dow, p) => { const v = (((W.data || {}).grades || {})[g] || {}).cells || {}; const c = v[dow + '-' + p]; return Array.isArray(c) ? c : c ? [c] : []; };
  const pTime = (p) => { const c = ((W.data || {}).config || {}).periods || []; const x = c[p - 1]; return x ? x.start + '–' + x.end : ''; };
  async function load() { let r = null; try { r = await gasApiCall('getPeriodSwaps', {}, 20000); } catch (e) {} if (r && r.success) W.list = r.data || []; render(); paintBtn(); }
  function host() { return document.getElementById('k8SwBody'); }
  function itemHtml(x) {
    const u = String(me().username || ''); const st = ST[x.status] || ST.pending;
    const canAns = x.status === 'pending' && (x.tB === u);
    const canCancel = (x.status === 'pending' || x.status === 'approved') && (x.tA === u || x.tB === u);
    return '<article class="k8-sw-it"><div class="k8-sw-top"><b>' + esc(dTh(x.from)) + (x.from !== x.to ? ' – ' + esc(dTh(x.to)) + ' <small>(ทุกวัน' + DN[x.dow] + ')</small>' : '') + '</b><span style="background:' + st[1] + ';color:' + st[2] + '">' + st[0] + '</span></div>' +
      '<div class="k8-sw-pair"><div><small>' + esc(x.tnA) + '</small><b>คาบ ' + x.pA + ' · ' + esc(x.snA || '-') + '</b></div><span aria-hidden="true">⇄</span><div><small>' + esc(x.tnB) + '</small><b>คาบ ' + x.pB + ' · ' + esc(x.snB || '-') + '</b></div></div>' +
      '<div class="k8-sw-meta">ม.' + esc(x.grade) + (x.note ? ' · ' + esc(x.note) : '') + '</div>' +
      ((canAns || canCancel) ? '<div class="k8-sw-acts">' + (canAns ? '<button type="button" class="is-ok" onclick="k8SwAns(\'' + x.id + '\',\'accept\')">ตอบรับ</button><button type="button" class="is-no" onclick="k8SwAns(\'' + x.id + '\',\'reject\')">ปฏิเสธ</button>' : '') + (canCancel && !canAns ? '<button type="button" class="is-no" onclick="k8SwAns(\'' + x.id + '\',\'cancel\')">ยกเลิก</button>' : '') + '</div>' : '') + '</article>';
  }
  function formHtml() {
    const F = W.form; const u = String(me().username || '');
    const dow = new Date(F.from + 'T00:00:00').getDay();
    const periods = (((W.data || {}).config || {}).periods || []).map((_, i) => i + 1);
    const grades = ['1', '2', '3', '4', '5', '6'].filter((g) => periods.some((p) => cellsOf(g, dow, p).some((e) => String(e.t || '') === u)));
    if (grades.indexOf(F.grade) === -1) F.grade = grades[0] || '';
    const mine = F.grade ? periods.filter((p) => cellsOf(F.grade, dow, p).some((e) => String(e.t || '') === u)) : [];
    const others = F.grade ? periods.map((p) => ({ p, e: cellsOf(F.grade, dow, p).find((e) => e.t && String(e.t) !== u) })).filter((x) => x.e) : [];
    if (mine.indexOf(Number(F.pA)) === -1) F.pA = mine[0] || '';
    if (!others.some((x) => x.p === Number(F.pB))) F.pB = others[0] ? others[0].p : '';
    const snOf = (p) => { const e = cellsOf(F.grade, dow, p).find((e) => String(e.t || '') === u); return e ? e.sn : ''; };
    return '<section class="k8-sw-form"><div class="k8-sw-dates"><label><span>ตั้งแต่วันที่</span><input type="date" value="' + F.from + '" min="' + ymd(new Date()) + '" onchange="k8SwF(\'from\', this.value)"></label><label><span>ถึงวันที่</span><input type="date" value="' + F.to + '" min="' + F.from + '" onchange="k8SwF(\'to\', this.value)"></label></div>' +
      '<p class="k8-sw-hint">วัน' + DN[dow] + (F.to !== F.from ? ' · ใช้กับทุกวัน' + DN[dow] + 'ในช่วงนี้ แล้วกลับเป็นตารางเดิม' : ' · วันเดียว แล้วกลับเป็นตารางเดิม') + '</p>' +
      (!grades.length ? '<p class="k8-asum-empty">วัน' + DN[dow] + 'คุณไม่มีคาบสอน · เลือกวันอื่น</p>' :
      '<label class="k8-sw-l"><span>ชั้นเรียน</span><select onchange="k8SwF(\'grade\', this.value)">' + grades.map((g) => '<option value="' + g + '"' + (g === F.grade ? ' selected' : '') + '>ม.' + g + '</option>').join('') + '</select></label>' +
      '<div class="k8-sw-two"><label class="k8-sw-l"><span>คาบของฉัน</span><select onchange="k8SwF(\'pA\', this.value)">' + mine.map((p) => '<option value="' + p + '"' + (p === Number(F.pA) ? ' selected' : '') + '>คาบ ' + p + ' · ' + esc(snOf(p)) + ' (' + pTime(p) + ')</option>').join('') + '</select></label><span class="k8-sw-arr" aria-hidden="true">⇄</span>' +
      '<label class="k8-sw-l"><span>สลับกับคาบ</span><select onchange="k8SwF(\'pB\', this.value)">' + (others.length ? others.map((x) => '<option value="' + x.p + '"' + (x.p === Number(F.pB) ? ' selected' : '') + '>คาบ ' + x.p + ' · ' + esc(x.e.sn) + ' · ' + esc(x.e.tn || x.e.t) + '</option>').join('') : '<option value="">ไม่มีคาบของอาจารย์ท่านอื่นในวันนี้</option>') + '</select></label></div>' +
      '<label class="k8-sw-l"><span>หมายเหตุถึงอาจารย์ (ไม่บังคับ)</span><input type="text" maxlength="160" value="' + esc(F.note || '') + '" oninput="k8SwF(\'note\', this.value, 1)" placeholder="เช่น ติดประชุมช่วงเช้า"></label>' +
      '<button type="button" class="k8-sw-go" ' + (W.busy || !F.pA || !F.pB ? 'disabled' : '') + ' onclick="k8SwSend()">' + (W.busy ? 'กำลังส่ง…' : 'ส่งคำขอสลับคาบ') + '</button>') + '</section>';
  }
  function render() {
    const B = host(); if (!B) return;
    const u = String(me().username || '');
    const inc = W.list.filter((x) => x.tB === u).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const out = W.list.filter((x) => x.tA === u).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const all = W.list.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const isAdm = /SUPER|ADMIN/i.test(String(me().role || '')) && !me().limited;
    const tabs = [['in', 'คำขอถึงฉัน', inc.filter((x) => x.status === 'pending').length], ['out', 'คำขอของฉัน', 0], ['new', '＋ ขอสลับคาบ', 0]].concat(isAdm ? [['all', 'ทั้งหมด', 0]] : []);
    let h = '<div class="k8-sw-tabs">' + tabs.map(([k, l, n]) => '<button type="button" aria-pressed="' + (W.tab === k) + '" onclick="k8SwTab(\'' + k + '\')">' + l + (n ? ' <em>' + n + '</em>' : '') + '</button>').join('') + '</div>';
    if (W.tab === 'new') h += W.data ? formHtml() : '<p class="k8-asum-empty">กำลังโหลดตารางสอน…</p>';
    else { const L = W.tab === 'in' ? inc : W.tab === 'out' ? out : all; h += L.length ? L.map(itemHtml).join('') : '<p class="k8-asum-empty">' + (W.tab === 'in' ? 'ยังไม่มีคำขอสลับคาบถึงคุณ' : 'ยังไม่มีรายการ') + '</p>'; }
    B.innerHTML = h;
  }
  function paintBtn() {
    const q = document.querySelector('#teacher-tab-overview .k8-th-quick'); if (!q) return;
    let b = q.querySelector('.k8-sw-qbtn');
    if (!b) { q.insertAdjacentHTML('beforeend', '<button type="button" class="k8-sw-qbtn k8-lv-qbtn" onclick="k8SwOpen()"><span style="background:#ede9fe;color:#6d28d9"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4L3 8l4 4"/><path d="M3 8h13a4 4 0 0 1 4 4"/><path d="M17 20l4-4-4-4"/><path d="M21 16H8a4 4 0 0 1-4-4"/></svg><em class="k8-lv-qn" hidden></em></span>สลับคาบ</button>'); b = q.querySelector('.k8-sw-qbtn'); }
    const u = String(me().username || ''); const n = W.list.filter((x) => x.tB === u && x.status === 'pending').length;
    const e = b.querySelector('.k8-lv-qn'); if (e) { e.hidden = !n; e.textContent = n; }
  }
  window.k8SwOpen = async function () {
    let m = document.getElementById('k8SwModal');
    if (!m) { document.body.insertAdjacentHTML('beforeend', '<div class="modal-overlay" id="k8SwModal" onclick="if(event.target===this)closeModal(\'k8SwModal\')"><div class="modal-dialog k8-sheet" role="dialog" aria-labelledby="k8SwT"><header class="k8-sheet-head"><div><h2 id="k8SwT">สลับคาบ</h2><span>สลับชั่วคราว วันเดียวหรือช่วงวันที่ · อีกฝ่ายต้องตอบรับก่อน · หลังวันสุดท้ายกลับเป็นตารางเดิม</span></div><button type="button" class="k8-sheet-x" aria-label="ปิด" onclick="closeModal(\'k8SwModal\')">✕</button></header><div class="k8-sheet-body" id="k8SwBody"></div></div></div>'); m = document.getElementById('k8SwModal'); }
    const u = String(me().username || '');
    W.tab = W.list.some((x) => x.tB === u && x.status === 'pending') ? 'in' : W.tab;
    openModal('k8SwModal'); render(); load(); ttData().then(render);
  };
  window.k8SwTab = function (k) { W.tab = k; if (k === 'new' && !W.form) { const t = new Date(); W.form = { from: ymd(t), to: ymd(t), grade: '', pA: '', pB: '', note: '' }; } render(); };
  window.k8SwF = function (k, v, soft) { W.form[k] = v; if (k === 'from' && W.form.to < v) W.form.to = v; if (k === 'to' && v < W.form.from) W.form.to = W.form.from; if (!soft) render(); };
  window.k8SwSend = async function () {
    const F = W.form; if (!F.pA || !F.pB) return;
    W.busy = true; render();
    let r = null; try { r = await gasApiCall('requestPeriodSwap', { data: F }, 30000); } catch (e) {}
    W.busy = false;
    if (r && r.success) { toast(r.message, 'success'); W.form = null; W.tab = 'out'; await load(); } else { toast((r && r.message) || 'ส่งคำขอไม่สำเร็จ', 'error'); render(); }
  };
  window.k8SwAns = async function (id, action) {
    if (action === 'cancel' && !window.confirm('ยกเลิกการสลับคาบนี้? ตารางจะกลับเป็นแบบเดิม')) return;
    let r = null; try { r = await gasApiCall('respondPeriodSwap', { data: { id, action } }, 30000); } catch (e) {}
    if (r && r.success) { toast(r.message, 'success'); W.data = null; try { if (window.k8TtReload) window.k8TtReload(); } catch (e) {} await load(); } else toast((r && r.message) || 'ไม่สำเร็จ', 'error');
  };
  window.k8SwRefreshBtn = function () { paintBtn(); };
  const iv = setInterval(() => { if (document.querySelector('#teacher-tab-overview .k8-th-quick')) { paintBtn(); clearInterval(iv); load(); } }, 1500);
})();

/* ---------- v17.95 · กิจกรรม & ผลงาน (แฟ้มสะสมผลงาน) · นักเรียน/ผู้ปกครองดู · อาจารย์สแกนเก็บเกียรติบัตร ---------- */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p2 = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const dTh = (s) => { const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? (s || '') : d.getDate() + ' ' + MON[d.getMonth()] + ' ' + (d.getFullYear() + 543); };
  const toast = (m, t) => { try { showToast(m, t || 'info'); } catch (e) {} };
  const norm = (v) => String(v || '').replace(/\D/g, '').replace(/^0+/, '');
  const CAT = { academic: ['วิชาการ', '#2563eb'], sport: ['กีฬา', '#16a34a'], religion: ['ศาสนา/อัลกุรอาน', '#0d9488'], art: ['ศิลปะ/ดนตรี', '#c026d3'], virtue: ['คุณธรรม', '#d97706'], volunteer: ['จิตอาสา', '#e11d48'], other: ['อื่น ๆ', '#475569'] };
  const LV = { school: 'โรงเรียน', district: 'อำเภอ/เขต', province: 'จังหวัด', region: 'ภาค', nation: 'ประเทศ', intl: 'นานาชาติ' };
  const P = { tab: 'all', data: null, loading: false };
  const stu = () => { try { return currentStudent; } catch (e) { return null; } };
  function year(d) { const x = new Date(String(d).slice(0, 10) + 'T00:00:00'); return isNaN(x) ? '' : String(x.getFullYear() + 543); }
  function render() {
    const B = document.getElementById('k8PfB'); if (!B) return;
    if (!P.data) { B.innerHTML = '<p class="k8-asum-empty">' + (P.loading ? 'กำลังโหลดแฟ้มผลงาน…' : 'ยังไม่มีข้อมูล') + '</p>'; return; }
    const items = P.data.items || [], acts = P.data.activities || [];
    const all = items.map((x) => Object.assign({ kind: 'cert' }, x)).concat(acts.map((a) => Object.assign({ kind: 'act' }, a))).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const L = P.tab === 'cert' ? all.filter((x) => x.kind === 'cert') : P.tab === 'act' ? all.filter((x) => x.kind === 'act') : all;
    const lvUp = items.filter((x) => x.level && x.level !== 'school').length;
    let h = '<section class="k8-pf-kpi"><div><b>' + acts.length + '</b><small>กิจกรรมที่เข้าร่วม</small></div><div><b>' + items.length + '</b><small>เกียรติบัตร/ผลงาน</small></div><div><b>' + lvUp + '</b><small>ระดับเขตขึ้นไป</small></div></section>' +
      '<div class="k8-asum-tabs" role="tablist">' + [['all', 'ทั้งหมด'], ['cert', 'เกียรติบัตร'], ['act', 'กิจกรรม']].map(([k, l]) => '<button type="button" role="tab" aria-selected="' + (P.tab === k) + '" onclick="k8PfTab(\'' + k + '\')">' + l + '</button>').join('') + '</div>';
    if (!L.length) { B.innerHTML = h + '<p class="k8-asum-empty">' + (P.tab === 'act' ? 'ยังไม่มีกิจกรรมที่สแกนเข้าร่วม' : 'ยังไม่มีเกียรติบัตร · อาจารย์จะสแกนเก็บไว้ให้ที่นี่') + '</p>'; return; }
    let yr = '';
    h += L.map((x) => {
      const y = year(x.date); const head = y && y !== yr ? '<h3 class="k8-pf-yr">ปี ' + y + '</h3>' : ''; yr = y || yr;
      if (x.kind === 'act') return head + '<article class="k8-pf-it is-act"><span class="k8-pf-ico" aria-hidden="true">🎯</span><div><b>' + esc(x.title) + '</b><small>' + esc(dTh(x.date)) + (x.location ? ' · ' + esc(x.location) : '') + '</small><span class="k8-pf-tag">เข้าร่วมกิจกรรม</span></div></article>';
      const c = CAT[x.cat] || CAT.other;
      return head + '<article class="k8-pf-it is-cert"><span class="k8-pf-ico" style="background:' + c[1] + '1a;color:' + c[1] + '" aria-hidden="true">🏅</span><div><b>' + esc(x.title) + '</b><small>' + esc(dTh(x.date)) + ' · ระดับ' + esc(LV[x.level] || LV.school) + (x.award ? ' · ' + esc(x.award) : '') + '</small><span class="k8-pf-tag" style="color:' + c[1] + '">' + c[0] + '</span>' + (x.note ? '<p>' + esc(x.note) + '</p>' : '') +
        ((x.files || []).length ? '<div class="k8-pf-ph">' + x.files.map((u) => '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt="เกียรติบัตร ' + esc(x.title) + '" loading="lazy"></a>').join('') + '</div>' : '') + '<small class="k8-pf-by">บันทึกโดย ' + esc(x.byName || '-') + '</small></div></article>';
    }).join('');
    B.innerHTML = h;
  }
  async function load() {
    const s = stu(); if (!s) return;
    const ck = 'k8_pf_' + norm(s.studentId);
    if (!P.data) { try { P.data = JSON.parse(localStorage.getItem(ck) || 'null'); } catch (e) {} }
    P.loading = true; render();
    let r = null; try { r = await gasApiCall('getMyPortfolio', {}, 30000); } catch (e) {}
    P.loading = false;
    if (r && r.success) { P.data = { items: r.items || [], activities: r.activities || [] }; try { localStorage.setItem(ck, JSON.stringify(P.data)); } catch (e) {} }
    render();
    const sub = document.getElementById('hfPfSub'); if (sub && P.data) sub.textContent = 'กิจกรรม ' + (P.data.activities || []).length + ' · เกียรติบัตร ' + (P.data.items || []).length;
  }
  window.k8PfOpen = function () {
    const el = document.getElementById('k8Pf'); if (!el) return;
    const s = stu(); document.getElementById('k8PfS').textContent = s ? (s.fullName || '') + ' · ' + String(s.grade || '').replace('มัธยมศึกษาปีที่ ', 'ม.') : 'แฟ้มสะสมผลงาน';
    el.hidden = false; document.documentElement.classList.add('k8-docs-open'); try { history.pushState({ k8pf: 1 }, ''); } catch (e) {}
    render(); load();
  };
  window.k8PfTab = function (k) { P.tab = k; render(); };
  window.addEventListener('popstate', () => { const el = document.getElementById('k8Pf'); if (el && !el.hidden) { el.hidden = true; document.documentElement.classList.remove('k8-docs-open'); } });

  // ---------- อาจารย์/แอดมิน: สแกนเก็บเกียรติบัตร ----------
  const F = { sel: new Map(), q: '', g: 'ALL', photos: [], title: '', cat: 'academic', level: 'school', award: '', date: '', note: '', busy: false, list: null, tab: 'new' };
  const allStu = () => { let l = []; try { l = allStudents || []; } catch (e) {} return l.filter((x) => x && x.studentId && !/ลาออก|สำเร็จ|พ้นสภาพ/.test(String(x.status || ''))); };
  const gn = (g) => { const m = String(g || '').match(/([1-6])/); return m ? m[1] : ''; };
  function sRender() {
    const B = document.getElementById('k8PfSBody'); if (!B) return;
    let h = '<div class="k8-sw-tabs">' + [['new', '＋ เก็บเกียรติบัตร'], ['mine', 'ที่บันทึกไว้']].map(([k, l]) => '<button type="button" aria-pressed="' + (F.tab === k) + '" onclick="k8PfSTab(\'' + k + '\')">' + l + '</button>').join('') + '</div>';
    if (F.tab === 'mine') {
      const L = F.list; h += !L ? '<p class="k8-asum-empty">กำลังโหลด…</p>' : !L.length ? '<p class="k8-asum-empty">ยังไม่มีรายการ</p>' :
        L.map((x) => '<article class="k8-pf-it is-cert"><span class="k8-pf-ico" aria-hidden="true">🏅</span><div><b>' + esc(x.title) + '</b><small>' + esc(x.studentName) + ' · ' + esc(String(x.grade).replace('มัธยมศึกษาปีที่ ', 'ม.')) + ' · ' + esc(dTh(x.date)) + '</small>' + ((x.files || []).length ? '<div class="k8-pf-ph">' + x.files.slice(0, 2).map((u) => '<img src="' + esc(u) + '" alt="" loading="lazy">').join('') + '</div>' : '') + '<button type="button" class="k8-pf-del" onclick="k8PfDel(\'' + esc(x.id) + '\')">ลบ</button></div></article>').join('');
      B.innerHTML = h; return;
    }
    const q = F.q.trim().toLowerCase();
    const L = allStu().filter((x) => (F.g === 'ALL' || gn(x.grade) === F.g) && (!q || String(x.fullName || '').toLowerCase().includes(q) || norm(x.studentId).includes(q.replace(/^0+/, '')))).slice(0, 300);
    h += '<section class="k8-sw-form">' +
      '<label class="k8-sw-l"><span>ชื่อเกียรติบัตร / ผลงาน *</span><input type="text" id="k8PfTitle" maxlength="160" value="' + esc(F.title) + '" placeholder="เช่น การแข่งขันอ่านอัลกุรอาน" oninput="k8PfSF(\'title\', this.value, 1)"></label>' +
      '<div class="k8-sw-dates"><label class="k8-sw-l"><span>ประเภท</span><select onchange="k8PfSF(\'cat\', this.value)">' + Object.keys(CAT).map((k) => '<option value="' + k + '"' + (F.cat === k ? ' selected' : '') + '>' + CAT[k][0] + '</option>').join('') + '</select></label><label class="k8-sw-l"><span>ระดับ</span><select onchange="k8PfSF(\'level\', this.value)">' + Object.keys(LV).map((k) => '<option value="' + k + '"' + (F.level === k ? ' selected' : '') + '>' + LV[k] + '</option>').join('') + '</select></label></div>' +
      '<div class="k8-sw-dates"><label class="k8-sw-l"><span>รางวัล (ไม่บังคับ)</span><input type="text" maxlength="120" value="' + esc(F.award) + '" placeholder="เช่น ชนะเลิศ / เหรียญทอง / เข้าร่วม" oninput="k8PfSF(\'award\', this.value, 1)"></label><label class="k8-sw-l"><span>วันที่</span><input type="date" value="' + (F.date || ymd(new Date())) + '" onchange="k8PfSF(\'date\', this.value, 1)"></label></div>' +
      '<div class="k8-sw-l"><span>รูปเกียรติบัตร (สูงสุด 4 รูป)</span><div class="k8-pf-cap">' + F.photos.map((p, i) => '<span class="k8-pf-thumb"><img src="' + p.data + '" alt=""><button type="button" aria-label="ลบรูป" onclick="k8PfPhDel(' + i + ')">✕</button></span>').join('') +
        (F.photos.length < 4 ? '<label class="k8-pf-add">📷 สแกน/ถ่ายรูป<input type="file" accept="image/*" capture="environment" hidden onchange="k8PfPh(this)"></label><label class="k8-pf-add is-alt">🖼 เลือกจากเครื่อง<input type="file" accept="image/*" multiple hidden onchange="k8PfPh(this)"></label>' : '') + '</div></div>' +
      '<label class="k8-sw-l"><span>หมายเหตุ (ไม่บังคับ)</span><input type="text" maxlength="300" value="' + esc(F.note) + '" oninput="k8PfSF(\'note\', this.value, 1)"></label>' +
      '<div class="k8-sw-l"><span>นักเรียนที่ได้รับ (' + F.sel.size + ' คน)</span>' + (F.sel.size ? '<div class="k8-hq-mem-list">' + Array.from(F.sel.entries()).slice(0, 40).map(([k, n]) => '<span>' + esc(n) + '<button type="button" aria-label="เอาออก" onclick="k8PfT(\'' + k + '\')">✕</button></span>').join('') + '</div>' : '') +
        '<input type="search" class="k8-asum-q" placeholder="ค้นหาชื่อหรือรหัสนักเรียน" value="' + esc(F.q) + '" oninput="k8PfQ(this)"><div class="k8-na-chips">' + ['ALL', '1', '2', '3', '4', '5', '6'].map((g) => '<button type="button" aria-pressed="' + (F.g === g) + '" onclick="k8PfSF(\'g\',\'' + g + '\')">' + (g === 'ALL' ? 'ทุกชั้น' : 'ม.' + g) + '</button>').join('') + '</div>' +
        '<ul class="k8-bh-stu k8-pf-stu">' + L.map((x) => { const k = norm(x.studentId); const on = F.sel.has(k); return '<li><button type="button" role="checkbox" aria-checked="' + on + '" onclick="k8PfT(\'' + k + '\')"><span class="k8-bh-chk">' + (on ? '✓' : '') + '</span><span class="k8-bh-who"><b>' + esc(x.fullName) + '</b><small>' + esc(String(x.grade || '').replace('มัธยมศึกษาปีที่ ', 'ม.')) + ' · ' + esc(x.studentId) + '</small></span></button></li>'; }).join('') + '</ul></div>' +
      '<button type="button" class="k8-sw-go" style="background:#b45309" ' + (F.busy ? 'disabled' : '') + ' onclick="k8PfSave()">' + (F.busy ? 'กำลังบันทึก…' : 'บันทึกเกียรติบัตรให้ ' + F.sel.size + ' คน') + '</button></section>';
    B.innerHTML = h;
  }
  window.k8PfStaffOpen = function () {
    let m = document.getElementById('k8PfSModal');
    if (!m) { document.body.insertAdjacentHTML('beforeend', '<div class="modal-overlay" id="k8PfSModal" onclick="if(event.target===this)closeModal(\'k8PfSModal\')"><div class="modal-dialog k8-sheet" role="dialog" aria-labelledby="k8PfST"><header class="k8-sheet-head"><div><h2 id="k8PfST">เก็บเกียรติบัตร/ผลงาน</h2><span>สแกนเกียรติบัตรเก็บไว้ในแฟ้มผลงานของนักเรียน · นักเรียนและผู้ปกครองเห็นในเมนู "กิจกรรม &amp; ผลงาน"</span></div><button type="button" class="k8-sheet-x" aria-label="ปิด" onclick="closeModal(\'k8PfSModal\')">✕</button></header><div class="k8-sheet-body" id="k8PfSBody"></div></div></div>'); }
    openModal('k8PfSModal'); sRender();
  };
  window.k8PfSTab = async function (k) { F.tab = k; sRender(); if (k === 'mine') { let r = null; try { r = await gasApiCall('getPortfolioList', {}, 30000); } catch (e) {} F.list = (r && r.success && r.data) || []; sRender(); } };
  window.k8PfSF = function (k, v, soft) { F[k] = v; if (!soft) sRender(); };
  let qt = null; window.k8PfQ = function (el) { clearTimeout(qt); qt = setTimeout(() => { F.q = el.value; const pos = el.selectionStart; sRender(); const n = document.querySelector('#k8PfSBody .k8-asum-q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }, 150); };
  window.k8PfT = function (k) { if (F.sel.has(k)) F.sel.delete(k); else { const x = allStu().find((s) => norm(s.studentId) === k); F.sel.set(k, x ? x.fullName : k); } sRender(); };
  function shrink(file) { return new Promise((res) => { const fr = new FileReader(); fr.onload = () => { const img = new Image(); img.onload = () => { const M = 1600; let w = img.width, h = img.height; if (w > M || h > M) { const r = Math.min(M / w, M / h); w = Math.round(w * r); h = Math.round(h * r); } const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); res(c.toDataURL('image/jpeg', 0.82)); }; img.onerror = () => res(''); img.src = fr.result; }; fr.onerror = () => res(''); fr.readAsDataURL(file); }); }
  window.k8PfPh = async function (inp) { const files = Array.from(inp.files || []).slice(0, 4 - F.photos.length); for (const f of files) { const d = await shrink(f); if (d) F.photos.push({ data: d }); } inp.value = ''; sRender(); };
  window.k8PfPhDel = function (i) { F.photos.splice(i, 1); sRender(); };
  window.k8PfSave = async function () {
    if (!F.title.trim()) { toast('ใส่ชื่อเกียรติบัตร/ผลงานก่อน', 'warning'); const t = document.getElementById('k8PfTitle'); if (t) t.focus(); return; }
    if (!F.sel.size) { toast('เลือกนักเรียนอย่างน้อย 1 คน', 'warning'); return; }
    F.busy = true; sRender();
    let r = null; try { r = await gasApiCall('addPortfolio', { data: { title: F.title, cat: F.cat, level: F.level, award: F.award, date: F.date || ymd(new Date()), note: F.note, studentIds: Array.from(F.sel.keys()), photos: F.photos } }, 90000); } catch (e) {}
    F.busy = false;
    if (r && r.success) { toast(r.message, 'success'); Object.assign(F, { sel: new Map(), photos: [], title: '', award: '', note: '' }); } else toast((r && r.message) || 'บันทึกไม่สำเร็จ', 'error');
    sRender();
  };
  window.k8PfDel = async function (id) { if (!window.confirm('ลบเกียรติบัตรนี้ออกจากแฟ้มผลงาน?')) return; let r = null; try { r = await gasApiCall('deletePortfolio', { id }, 30000); } catch (e) {} if (r && r.success) { toast(r.message, 'success'); F.list = (F.list || []).filter((x) => x.id !== id); sRender(); } else toast((r && r.message) || 'ลบไม่สำเร็จ', 'error'); };
  // ปุ่มในหน้าอาจารย์ (เมนูลัด)
  const iv = setInterval(() => { const q = document.querySelector('#teacher-tab-overview .k8-th-quick'); if (!q) return; if (!q.querySelector('.k8-pf-qbtn')) q.insertAdjacentHTML('beforeend', '<button type="button" class="k8-pf-qbtn k8-lv-qbtn" onclick="k8PfStaffOpen()"><span style="background:#fef3c7;color:#b45309"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/></svg></span>เกียรติบัตร</button>'); clearInterval(iv); }, 1500);
})();

/* ---------- v17.96 · สรุปเกรด GS2: ตารางนักเรียน × วิชา (วิชาที่ฉันสอน) ---------- */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cid = (v) => String(v == null ? '' : v).trim().replace(/^0+/, '');
  const G = { g: 'ALL', q: '' };
  const tone = (g) => (g == null ? '' : g >= 3.5 ? 'is-a' : g >= 2.5 ? 'is-b' : g >= 1.5 ? 'is-c' : 'is-d');
  const fmtG = (g) => { const n = Number(g); return Number.isInteger(n) ? String(n) : String(n); };
  const PILL = { done: ['ครบแล้ว', 'is-done'], part: ['ยังไม่ครบ', 'is-part'], none: ['ยังไม่กรอก', 'is-none'] };
  function render() {
    const B = document.getElementById('k8Gs2B'); if (!B) return;
    let model = []; try { model = window.k8GsModel ? window.k8GsModel() : []; } catch (e) { model = []; }
    const gOf = window.k8GsGradeOf || (() => null);
    const cols = []; model.forEach((c) => { if (c.g !== '?') c.rows.forEach((r) => cols.push({ g: c.g, subj: r.subj, set: new Set(r.studs.map((s) => cid(s.studentId))), done: r.done, tot: r.studs.length })); });
    const subjN = new Set(cols.map((x) => String(x.subj.id))).size;
    let tm = { term: 1, year: '' }; try { tm = window.k8Term(); } catch (e) {}
    document.getElementById('k8Gs2S').textContent = (tm.term === 3 ? 'ภาคฤดูร้อน ' : 'ภาคเรียน ' + tm.term + '/') + tm.year + ' · วิชาที่ฉันสอน ' + subjN + ' วิชา';
    const grades = Array.from(new Set(cols.map((x) => x.g))).sort();
    if (G.g !== 'ALL' && grades.indexOf(G.g) === -1) G.g = 'ALL';
    const C = cols.filter((x) => G.g === 'ALL' || x.g === G.g);
    if (!C.length) { B.innerHTML = '<p class="k8-asum-empty">ยังไม่มีรายวิชาในตารางสอนของคุณ</p>'; return; }
    const studs = {}; model.forEach((c) => { if (G.g === 'ALL' || c.g === G.g) Object.keys(c.studs).forEach((k) => { if (c.g !== '?') studs[cid(k)] = c.studs[k]; }); });
    const q = G.q.trim().toLowerCase();
    const bare = (s) => (window.k8BareName ? window.k8BareName(s) : String(s.fullName || ''));
    const L = Object.keys(studs).map((k) => studs[k]).filter((s) => !q || String(s.fullName || '').toLowerCase().includes(q) || cid(s.studentId).includes(cid(q)))
      .sort((a, b) => String(a.grade || '').localeCompare(String(b.grade || ''), 'th', { numeric: true }) || bare(a).localeCompare(bare(b), 'th'));
    let miss = 0; C.forEach((x) => { miss += Math.max(0, x.tot - x.done); });
    let h = '<div class="k8-gs2-bar"><div class="k8-na-chips">' + ['ALL'].concat(grades).map((g) => '<button type="button" aria-pressed="' + (G.g === g) + '" onclick="k8Gs2G(\'' + g + '\')">' + (g === 'ALL' ? 'ทุกชั้น' : 'ม.' + g) + '</button>').join('') + '</div>' +
      '<input type="search" class="k8-asum-q" id="k8Gs2Q" placeholder="ค้นหาชื่อหรือรหัส" value="' + esc(G.q) + '" oninput="k8Gs2Q(this)"></div>' +
      '<p class="k8-gs2-lead">' + (miss ? 'ยังขาดเกรดอีก <b>' + miss + '</b> ช่อง · แตะหัววิชาเพื่อไปกรอกเกรด' : 'กรอกเกรดครบทุกวิชาแล้ว ✓') + '</p>';
    h += '<div class="k8-gs2-wrap"><table class="k8-gs2-t"><thead><tr><th scope="col" class="k8-gs2-n">นักเรียน (' + L.length + ' คน)</th>' +
      C.map((x, i) => { const k = x.tot && x.done >= x.tot ? 'done' : x.done ? 'part' : 'none'; return '<th scope="col"><button type="button" onclick="k8Gs2Go(' + i + ')" title="ไปกรอกเกรดวิชานี้"><b>' + esc(x.subj.name) + '</b><small>ม.' + x.g + ' · ' + x.done + '/' + x.tot + '</small><span class="gs-pill ' + PILL[k][1] + '">' + PILL[k][0] + '</span></button></th>'; }).join('') +
      '<th scope="col" class="k8-gs2-avg">เฉลี่ย</th></tr></thead><tbody>' +
      L.map((s) => {
        const k = cid(s.studentId); let sum = 0, n = 0;
        const tds = C.map((x) => {
          if (!x.set.has(k)) return '<td class="is-na">–</td>';
          const g = gOf(s, x.subj);
          if (g == null) return '<td class="is-miss" title="ยังไม่มีเกรด">–</td>';
          sum += Number(g); n++; return '<td class="' + tone(Number(g)) + '">' + fmtG(g) + '</td>';
        }).join('');
        return '<tr><th scope="row" class="k8-gs2-n"><b>' + esc(s.fullName || k) + '</b><small>' + esc(String(s.grade || '').replace('มัธยมศึกษาปีที่ ', 'ม.')) + ' · ' + esc(s.studentId) + '</small></th>' + tds + '<td class="k8-gs2-avg">' + (n ? (sum / n).toFixed(2) : '–') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (L.length ? '' : '<p class="k8-asum-empty">ไม่พบนักเรียน</p>') +
      '<div class="k8-gs2-lg"><span>– = ยังไม่มีเกรด</span><span class="is-miss">ช่องที่ยังขาดในวิชาที่สอน</span><span class="is-na">– เทา = ไม่ได้เรียนวิชานี้</span></div>';
    B.innerHTML = h;
    render.cols = C;
  }
  window.k8Gs2Open = function () {
    const el = document.getElementById('k8Gs2'); if (!el) return;
    el.hidden = false; document.documentElement.classList.add('k8-docs-open'); try { history.pushState({ k8gs2: 1 }, ''); } catch (e) {}
    render();
  };
  window.k8Gs2G = function (g) { G.g = g; render(); };
  let qt = null; window.k8Gs2Q = function (el) { clearTimeout(qt); qt = setTimeout(() => { G.q = el.value; const pos = el.selectionStart; render(); const n = document.getElementById('k8Gs2Q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }, 150); };
  window.k8Gs2Go = function (i) {
    const x = (render.cols || [])[i]; if (!x) return;
    const ss = document.getElementById('teacherPortalSubjectSelect'), gs = document.getElementById('teacherPortalGradeSelect');
    if (ss && Array.from(ss.options).some((o) => o.value === String(x.subj.id))) ss.value = String(x.subj.id);
    if (gs) gs.value = 'มัธยมศึกษาปีที่ ' + x.g;
    history.back();
    setTimeout(() => { try { if (typeof switchTeacherTab === 'function') switchTeacherTab('grades'); if (typeof renderTeacherPortalGradesTable === 'function') renderTeacherPortalGradesTable(); } catch (e) {} }, 60);
  };
  window.addEventListener('popstate', () => { const el = document.getElementById('k8Gs2'); if (el && !el.hidden) { el.hidden = true; document.documentElement.classList.remove('k8-docs-open'); } });
})();

/* ---------- v17.97 · อาจารย์: ปุ่มลัด "สรุปเกรด" ในหน้าแรก ---------- */
(function () {
  window.k8Gs2Quick = function () {
    try { const ss = document.getElementById('teacherPortalSubjectSelect'); if (ss && !ss.options.length && typeof initTeacherPortalView === 'function') initTeacherPortalView(); } catch (e) {}
    if (window.k8Gs2Open) window.k8Gs2Open();
  };
  const iv = setInterval(() => { const q = document.querySelector('#teacher-tab-overview .k8-th-quick'); if (!q) return; if (!q.querySelector('.k8-gs2-qbtn')) q.insertAdjacentHTML('beforeend', '<button type="button" class="k8-gs2-qbtn" onclick="k8Gs2Quick()"><span style="background:#e0f2fe;color:#0369a1"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg></span>สรุปเกรด</button>'); clearInterval(iv); }, 1500);
})();

/* ---------- v17.98 · หอพักนักเรียน: ชายทั้งหมด = หอคณะวิทยาศาสตร์ฯ · หญิง = อิบนูอัฟฟาน / หอ 5 (แอดมินกำหนด) ---------- */
(function () {
  const D = { sci: 'หอพักคณะวิทยาศาสตร์และเทคโนโลยี', ibnu: 'หอพักอิบนูอัฟฟาน มหาวิทยาลัยฟาฏอนี', h5: 'หอพักนักศึกษาหญิง (หอ 5)' };
  window.K8_DORMS = D;
  const nid = (v) => String(v == null ? '' : v).trim().replace(/^0+/, '');
  let MAP = {}; try { MAP = JSON.parse(localStorage.getItem('k8_dorm_map') || '{}') || {}; } catch (e) { MAP = {}; }
  let MINE = null; try { MINE = JSON.parse(localStorage.getItem('k8_my_dorm') || 'null'); } catch (e) {}
  const girl = (s) => !!(window.k8IsGirl && window.k8IsGirl(s));
  window.k8DormOf = function (s) {
    if (!s) return '';
    const k = nid(s.studentId);
    let v = MAP[k];
    if (!v && MINE && MINE.id === k) v = MINE.dorm;
    if (v && D[v]) return v;
    return girl(s) ? '' : 'sci';
  };
  const isStu = () => { try { return !!currentStudent; } catch (e) { return false; } };
  const isAdmin = () => { try { return !!currentAdmin; } catch (e) { return false; } };
  async function loadMine() {
    let s = null; try { s = currentStudent; } catch (e) {} if (!s) return;
    let r = null; try { r = await gasApiCall('getMyDorm', {}, 15000); } catch (e) {}
    if (r && r.success) { MINE = { id: nid(s.studentId), dorm: r.dorm || '' }; try { localStorage.setItem('k8_my_dorm', JSON.stringify(MINE)); } catch (e) {} try { window.renderHomeF && window.renderHomeF(); } catch (e) {} }
  }
  async function loadMap() {
    let r = null; try { r = await gasApiCall('getMyDorm', {}, 15000); } catch (e) {}
    if (r && r.success && r.data) { MAP = r.data; try { localStorage.setItem('k8_dorm_map', JSON.stringify(MAP)); } catch (e) {} }
  }
  let did = '';
  setInterval(() => { const who = isStu() ? 's:' + nid(currentStudent.studentId) : isAdmin() ? 'a' : ''; if (!who || who === did) return; did = who; if (who === 'a') loadMap(); else loadMine(); }, 2000);
  // แอดมิน: ช่องเลือกหอพักในหน้าแก้ไขนักเรียน
  const ov = window.viewStudentDetails;
  if (typeof ov === 'function') window.viewStudentDetails = function (id) {
    const r = ov.apply(this, arguments);
    try {
      const note = document.getElementById('adminEditStdStatusNote'); if (!note || document.getElementById('adminEditStdDorm')) return r;
      const st = (allStudents || []).find((x) => nid(x.studentId) === nid(id)) || {};
      const cur = window.k8DormOf(st);
      const g = girl(st);
      const opts = [['', g ? '— ยังไม่ระบุ —' : 'อัตโนมัติ (ชาย = หอคณะวิทยาศาสตร์ฯ)']].concat(Object.keys(D).map((k) => [k, D[k]]));
      const wrap = note.parentElement;
      wrap.insertAdjacentHTML('afterend', '<div style="grid-column: 1 / -1;"><label class="form-label" for="adminEditStdDorm" style="font-size: 0.76rem; font-weight: 700; color: #0f172a;">หอพัก (แสดงบนบัตรนักเรียน)</label><select class="form-control" id="adminEditStdDorm" data-orig="' + (MAP[nid(id)] || '') + '" style="height: 36px; font-size: 0.85rem;">' + opts.map(([k, l]) => '<option value="' + k + '"' + ((MAP[nid(id)] || '') === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select><small style="font-size: 0.72rem; color: #64748b;">' + (g ? 'นักเรียนหญิง: เลือกหอพักอิบนูอัฟฟาน หรือ หอ 5' : 'นักเรียนชายอยู่หอพักคณะวิทยาศาสตร์และเทคโนโลยีโดยอัตโนมัติ') + (cur ? ' · ตอนนี้: ' + D[cur] : '') + '</small></div>');
    } catch (e) {}
    return r;
  };
  const os = window.saveAdminStudentDeepEdit;
  if (typeof os === 'function') window.saveAdminStudentDeepEdit = function () {
    let sel = null, oid = ''; try { sel = document.getElementById('adminEditStdDorm'); oid = currentAdminEditingStudentOriginalId; } catch (e) {}
    const newId = (document.getElementById('adminEditStdId') || {}).value || oid;
    const r = os.apply(this, arguments);
    if (sel && (sel.value !== sel.dataset.orig || nid(newId) !== nid(oid))) {
      const items = [{ studentId: newId, dorm: sel.value }]; if (nid(newId) !== nid(oid)) items.push({ studentId: oid, dorm: '' });
      items.forEach((it) => { if (it.dorm) MAP[nid(it.studentId)] = it.dorm; else delete MAP[nid(it.studentId)]; });
      try { localStorage.setItem('k8_dorm_map', JSON.stringify(MAP)); } catch (e) {}
      gasApiCall('setStudentDorm', { data: { items } }, 20000).then((x) => { if (!x || !x.success) { try { showToast((x && x.message) || 'บันทึกหอพักไม่สำเร็จ', 'error'); } catch (e) {} } }).catch(() => {});
    }
    return r;
  };
})();
