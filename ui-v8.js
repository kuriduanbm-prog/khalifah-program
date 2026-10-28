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
