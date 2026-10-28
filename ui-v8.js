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
  const hfState = { period: 'week', gradesOpen: false, openSubj: null };

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
      byDate[l.date] = String(l.status || '');
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
    const acadYear = (now.getMonth() >= 4 ? now.getFullYear() : now.getFullYear() - 1) + 543;
    document.getElementById('hfYear').textContent = 'ปีการศึกษา ' + acadYear;
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
      '<div class="hf-att-item" style="background:' + bg + ';color:' + ink + '"><b>' + att[i] + '</b><span>' + label + '</span></div>'
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
    const deeds = [['อ่านอัลกุรอาน', fmtNum(pages) + ' หน้า', '#b45309'], ['ท่องจำสะสม', memLatest + ' ซูเราะห์', '#15803d'], ['ละหมาดสุนัต', fmtNum(rakaat) + ' ร็อกอะฮ์', '#0369a1']];
    document.getElementById('hfDeeds').innerHTML = deeds.map(([label, value, ink]) =>
      '<button type="button" class="hf-deed" onclick="switchView(\'hasanat\')"><span>' + label + '</span><b style="color:' + ink + '">' + esc(value) + '</b></button>'
    ).join('');
  }

  function renderGradesBlock(s, sid) {
    const open = hfState.gradesOpen;
    const toggle = document.getElementById('hfGradesToggle');
    const body = document.getElementById('hfGradesBody');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.getElementById('hfGradesIcon').innerHTML = '<i class="fa-solid ' + (open ? 'fa-eye' : 'fa-lock') + '"></i>';
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
      if (viewName !== 'dashboard' && hfState.gradesOpen) {
        hfState.gradesOpen = false;
        hfState.openSubj = null;
      }
      const r = origSwitch.apply(this, arguments);
      if (viewName === 'dashboard') window.renderHomeF();
      return r;
    };
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && hfState.gradesOpen) {
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
    saving: false
  };

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
    let html = '';

    if (tgState.tab === 'scores') {
      html += '<div class="tg-head"><h3>ชิ้นงาน (' + defs.length + ')</h3><span>คะแนนเต็มรวม ' + fmtNum(totalMax) + '</span></div>';
      html += '<div class="tg-chips">' + defs.map((a) => '<button type="button" class="tg-chip" data-asg="' + esc(a.id) + '" aria-pressed="' + (a.id === active) + '">' + esc(a.title) + '<small>เต็ม ' + fmtNum(a.maxScore) + '</small></button>').join('') +
        '<button type="button" class="tg-add" data-act="open-add">+ เพิ่มชิ้นงาน</button></div>';
      if (tgState.adding) {
        html += '<div class="tg-form"><div class="tg-form-row">' +
          '<label>ชื่อชิ้นงาน<input type="text" id="tgNewTitle" maxlength="120" placeholder="เช่น ใบงานที่ 4"></label>' +
          '<label>คะแนนเต็ม<input type="text" inputmode="decimal" id="tgNewMax" placeholder="10"></label></div>' +
          '<div class="tg-btns"><button type="button" class="tg-btn" data-act="cancel-add">ยกเลิก</button><button type="button" class="tg-btn is-primary" data-act="confirm-add">เพิ่มชิ้นงาน</button></div></div>';
      }
      if (!defs.length) {
        html += '<div class="tg-empty">ยังไม่มีชิ้นงาน กด "+ เพิ่มชิ้นงาน" เพื่อสร้างช่องคะแนน เช่น การบ้าน รายงาน หรือสอบ<br>หรือไปที่แท็บ "สรุปเกรด" เพื่อให้เกรดโดยตรง</div>';
      } else {
        const a = defs.find((x) => x.id === active);
        html += '<div class="tg-btns"><button type="button" class="tg-btn is-danger" data-act="remove-asg">ลบชิ้นงาน "' + esc(a.title) + '"</button></div>';
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
      html += '<p class="tg-note">เกรดแนะนำ (จุดสีฟ้า) คำนวณจากคะแนนชิ้นงานรวม: 80%+ = 4, 75% = 3.5, 70% = 3, 65% = 2.5, 60% = 2, 55% = 1.5, 50% = 1, ต่ำกว่า = 0 — แตะตัวเลขเพื่อกำหนดเกรดเอง</p>';
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
    btn.disabled = tgState.saving;
    btn.textContent = tgState.saving ? 'กำลังบันทึก...' : 'บันทึก';
    const n = subj ? tgDirtyCount(subj) : 0;
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
      if (chip) { tgState.active[subj] = chip.dataset.asg; tgState.adding = false; renderTeacherGradesV8(); return; }
      const act = e.target.closest('[data-act]');
      if (act) {
        const kind = act.dataset.act;
        if (kind === 'open-add') { tgState.adding = true; renderTeacherGradesV8(); const t = document.getElementById('tgNewTitle'); if (t) t.focus(); }
        if (kind === 'cancel-add') { tgState.adding = false; renderTeacherGradesV8(); }
        if (kind === 'confirm-add') {
          const title = (document.getElementById('tgNewTitle').value || '').trim();
          const max = parseFloat(String(document.getElementById('tgNewMax').value || '').replace(',', '.'));
          if (!title) { showToast('กรุณาตั้งชื่อชิ้นงาน', 'warning'); return; }
          if (!(max > 0)) { showToast('คะแนนเต็มต้องมากกว่า 0', 'warning'); return; }
          const defs = tgAssignments(subj).slice();
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
    body.addEventListener('input', (e) => {
      const inp = e.target.closest('input[data-sid][data-asg]');
      if (!inp) return;
      const subj = tgSubject();
      const sid = inp.dataset.sid, asg = inp.dataset.asg;
      const raw = inp.value.trim().replace(',', '.');
      const n = Number(raw);
      const bad = raw !== '' && (isNaN(n) || n < 0 || n > Number(inp.dataset.max));
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
      { n: notChecked, title: 'เช็คชื่อมาเรียนวันนี้', sub: notChecked ? 'ยังไม่เช็ค ' + notChecked + ' คน' : 'เช็คครบทุกคนแล้ว', bg: notChecked ? '#fffbeb' : '#f0fdf4', ink: notChecked ? '#b45309' : '#15803d', go: "switchTeacherTab('attendance')" },
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
    document.getElementById('k8OvTodo').innerHTML = todo.map((t) =>
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
  const DEFAULT_TXT = { 1: 'ตรวจพิกัด & เปิดกล้อง', 2: 'ถ่ายภาพและส่งบันทึก' };
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
