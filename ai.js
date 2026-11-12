/* KHALIFAH · ถามข้อมูล (ผู้ช่วย AI) · v19.07
 * - พิมพ์ถามเป็นภาษาไทย: ชื่อนักเรียน / ชื่อโรงเรียน / ชั้น / ใครต่ำสุด–สูงสุด + ช่วงวัน
 * - ตัวเลขทุกตัวคำนวณในแอปจากข้อมูลจริง (สูตรเดียวกับหน้าสรุปอื่น) · Gemini ช่วยตีความคำถามและเรียบเรียงคำตอบ
 * - ถ้ายังไม่ตั้งค่า Gemini ระบบค้นหาในเครื่องจะตอบแทน (ชื่อนักเรียน/โรงเรียน/ชั้น/อันดับ)
 * - window.k8Rep: ตัวสร้างไฟล์ Excel · Word · PDF · JPG ใช้ร่วมกับหน้าสรุปรายโรงเรียน
 */
(function () {
  'use strict';
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const addD = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
  const MTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const MTHF = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const dTh = (s) => { const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/); return m ? (+m[3]) + ' ' + MTH[+m[2] - 1] + ' ' + String(+m[1] + 543).slice(2) : String(s || ''); };
  const rangeTxt = (f, t) => f === t ? dTh(f) : dTh(f) + ' – ' + dTh(t);
  const norm = (id) => String(id == null ? '' : id).replace(/^0+/, '');
  const shortG = (g) => String(g || '').replace('มัธยมศึกษาปีที่ ', 'ม.');
  const gNum = (g) => { const m = String(g || '').match(/([1-6])\s*$/) || String(g || '').match(/([1-6])/); return m ? m[1] : ''; };
  const readJSON = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? f : v; } catch (e) { return f; } };
  const toast = (m, t) => { try { showToast(m, t || 'info'); } catch (e) {} };
  const today = () => ymd(new Date());
  const pctOf = (a, b) => b ? Math.round(a / b * 100) : null;
  const pctTxt = (p) => p == null ? '–' : p + '%';
  const tone = (p, hi, mid) => p == null ? '' : p >= hi ? 'is-ok' : p >= mid ? 'is-mid' : 'is-bad';
  const TONE_C = { 'is-ok': '#15803d', 'is-mid': '#b45309', 'is-bad': '#b91c1c' };
  const bare = (s) => String((s && (s.nameOnly || s.fullName)) || '').replace(/^(เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|นางสาว|นาย|นาง|น\.ส\.)\s*/, '').trim();
  const nameOf = (s) => String((s && s.fullName) || (s && s.studentId) || '');
  const NONE = 'ไม่ระบุโรงเรียน';
  const schoolOf = (s) => String((s && (s.schoolName || s.school)) || '').trim() || NONE;
  const joinOf = (st) => { const m = String(st.registeredAt || st.createdAt || '').match(/(\d{4})-(\d{2})-(\d{2})/); if (!m) return ''; let y = +m[1]; if (y > 2400) y -= 543; return y + '-' + m[2] + '-' + m[3]; };
  const slotKey = (x) => { try { return normalizePrayerSlotKey(x); } catch (e) { return String(x || ''); } };
  const SLOTS = ['ซุบฮิ', 'ซุฮริ', 'อัศรฺ', 'มัฆริบ', 'อีชาอ์'];

  // ================= ช่วงวันที่ =================
  function range(kind, a, b) {
    const t = today(); const d = new Date();
    if (kind === 'today') return { from: t, to: t, label: 'วันนี้' };
    if (kind === 'yesterday') { const y = addD(t, -1); return { from: y, to: y, label: 'เมื่อวาน' }; }
    if (kind === 'week') return { from: addD(t, -6), to: t, label: '7 วันล่าสุด' };
    if (kind === 'thisweek') { const w = (d.getDay() + 6) % 7; return { from: addD(t, -w), to: t, label: 'สัปดาห์นี้' }; }
    if (kind === 'lastweek') { const w = (d.getDay() + 6) % 7; return { from: addD(t, -w - 7), to: addD(t, -w - 1), label: 'สัปดาห์ที่แล้ว' }; }
    if (kind === 'month') return { from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: t, label: 'เดือนนี้' };
    if (kind === 'lastmonth') return { from: ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)), to: ymd(new Date(d.getFullYear(), d.getMonth(), 0)), label: 'เดือนที่แล้ว' };
    if (kind === 'term') { let s = ''; try { s = (window.k8TermStart && window.k8TermStart()) || ''; } catch (e) {} return { from: s || ymd(new Date(d.getFullYear(), d.getMonth() - 4, 1)), to: t, label: 'ภาคเรียนนี้' }; }
    if (kind === 'year') return { from: d.getFullYear() + '-01-01', to: t, label: 'ปีนี้' };
    if (kind === 'custom' && a && b) { if (a > b) { const x = a; a = b; b = x; } return { from: a, to: b, label: rangeTxt(a, b) }; }
    return range('month');
  }
  // ตีความช่วงวันจากข้อความภาษาไทย (ใช้ในโหมดค้นหาในเครื่อง และตรวจค่าที่ AI ส่งมา)
  function rangeFromText(q) {
    q = String(q || '');
    if (/เมื่อวาน/.test(q)) return range('yesterday');
    if (/วันนี้/.test(q)) return range('today');
    if (/สัปดาห์ที่แล้ว|อาทิตย์ที่แล้ว/.test(q)) return range('lastweek');
    if (/สัปดาห์นี้|อาทิตย์นี้/.test(q)) return range('thisweek');
    if (/7\s*วัน|เจ็ดวัน|1\s*สัปดาห์|หนึ่งสัปดาห์/.test(q)) return range('week');
    if (/เดือนที่แล้ว|เดือนก่อน/.test(q)) return range('lastmonth');
    if (/เดือนนี้/.test(q)) return range('month');
    if (/ภาคเรียน|เทอม/.test(q)) return range('term');
    if (/ปีนี้|ทั้งปี|1\s*ปี|หนึ่งปี/.test(q)) return range('year');
    for (let i = 0; i < 12; i++) {
      const re = new RegExp('(?:เดือน\\s*)?(?:' + MTHF[i] + '|' + MTH[i].replace(/\./g, '\\.') + ')(?:\\s*(\\d{2,4}))?');
      const m = q.match(re);
      if (m) {
        const now = new Date(); let y = now.getFullYear();
        if (m[1]) { y = +m[1]; if (y < 100) y += 2500; if (y > 2400) y -= 543; } else if (i > now.getMonth()) y--;
        const f = ymd(new Date(y, i, 1)); let to = ymd(new Date(y, i + 1, 0)); if (to > today()) to = today();
        return { from: f, to, label: MTHF[i] + ' ' + (y + 543) };
      }
    }
    const ds = q.match(/(\d{4}-\d{2}-\d{2}).{1,6}?(\d{4}-\d{2}-\d{2})/); if (ds) return range('custom', ds[1], ds[2]);
    return null;
  }
  const okDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

  // ================= ข้อมูล =================
  const DATA = { att: null, bh: null, tt: null, lv: null, pr: null, hq: {}, t: {} };
  const FRESH = 5 * 60 * 1000;
  async function api(action, data, ms) { try { const r = await gasApiCall(action, data || {}, ms || 45000); return r && r.success !== false ? r : null; } catch (e) { return null; } }
  async function need(keys, from, to) {
    const jobs = [];
    const stale = (k) => !DATA[k] || Date.now() - (DATA.t[k] || 0) > FRESH;
    if (keys.indexOf('att') !== -1 && stale('att')) jobs.push(api('getAttendance').then((r) => { DATA.att = (r && r.data) || readJSON('khalifah_attendance_logs', []); DATA.t.att = Date.now(); }));
    if (keys.indexOf('bh') !== -1 && stale('bh')) jobs.push(api('getBehaviorData').then((r) => { const c = readJSON('khalifah_behavior_cache', null); DATA.bh = r ? { logs: r.logs || [], term: r.term || '' } : { logs: (c && c.logs) || [], term: (c && c.term) || '' }; DATA.t.bh = Date.now(); }));
    if (keys.indexOf('tt') !== -1 && stale('tt')) jobs.push(api('getTimetable', {}, 30000).then((r) => { DATA.tt = r || { grades: {}, config: {} }; DATA.t.tt = Date.now(); }));
    if (keys.indexOf('lv') !== -1 && stale('lv')) jobs.push(api('getStudentLeaves').then((r) => { DATA.lv = (r && r.data) || []; DATA.t.lv = Date.now(); }));
    if (keys.indexOf('pr') !== -1 && stale('pr')) jobs.push(api('getPrayers', {}, 60000).then((r) => { DATA.pr = (r && r.data) || null; DATA.t.pr = Date.now(); IDX = null; }));
    if (keys.indexOf('hq') !== -1 && from) { const k = from + '|' + to; if (!DATA.hq[k]) jobs.push(api('getHalaqahReport', { from, to }, 45000).then((r) => { DATA.hq[k] = (r && r.groups) || []; })); }
    await Promise.all(jobs);
  }
  function students() { let L = []; try { L = allStudents || []; } catch (e) {} return L.filter((s) => s && !/ลาออก|สำเร็จ|พ้นสภาพ|จำหน่าย/.test(String(s.status || ''))); }
  function studentById(id) { const k = norm(id); return students().find((s) => norm(s.studentId) === k) || null; }
  function schools() { const c = {}; students().forEach((s) => { const n = schoolOf(s); c[n] = (c[n] || 0) + 1; }); return Object.keys(c).map((n) => ({ name: n, students: c[n] })).sort((a, b) => b.students - a.students); }

  // ---------- ละหมาด (หลักเดียวกับหน้าอันดับละหมาด/สรุปรายโรงเรียน)
  let IDX = null;
  function prayIdx() {
    if (IDX) return IDX;
    const recs = {};
    let tp = []; try { tp = todayPrayers || []; } catch (e) {}
    const src = (DATA.pr && DATA.pr.length ? DATA.pr : readJSON('khalifah_prayer_history', [])).concat(tp);
    src.forEach((p) => { if (!p) return; const d = String(p.date || p.timestamp || '').slice(0, 10); if (!okDate(d)) return; recs[norm(p.studentId) + '|' + d + '|' + slotKey(p.prayerTime || p.prayerName || '')] = String(p.status || 'ตรงเวลา'); });
    readJSON('khalifah_prayer_approvals', []).forEach((a) => { if (!a || !/approved|อนุมัติ/i.test(String(a.status || '')) || !okDate(a.date)) return; const k = norm(a.studentId) + '|' + a.date + '|' + slotKey(a.prayerSlot || a.prayerTime || ''); if (!recs[k]) recs[k] = 'ตรงเวลา'; });
    IDX = recs; setTimeout(() => { IDX = null; }, 60000); return recs;
  }
  const PK = (st) => { st = String(st || ''); if (/ขาด|absent/i.test(st)) return 'miss'; if (/สาย|late/i.test(st)) return 'late'; if (/อุซุร|ประจำเดือน|ป่วย|^ลา|ลากิจ|ลาป่วย|excus|leave/i.test(st)) return 'ex'; return 'on'; };
  function prayerOf(st, from, to) {
    const R = prayIdx(); const t = today(); const end = to < t ? to : t; const k = norm(st.studentId);
    let a = from; const j = joinOf(st); if (j && j >= a) a = addD(j, 1);
    const out = { on: 0, late: 0, ex: 0, miss: 0, den: 0, pct: null, slot: {}, days: [] };
    SLOTS.forEach((s) => { out.slot[s] = { on: 0, late: 0, ex: 0, miss: 0 }; });
    let wins = []; try { wins = PRAYER_TIME_WINDOWS; } catch (e) {}
    const now = new Date(); const cur = now.getHours() * 60 + now.getMinutes();
    for (let d = a, i = 0; d <= end && i < 400; d = addD(d, 1), i++) {
      const sl = d === t ? SLOTS.filter((s, x) => !wins[x] || cur >= wins[x].endMin) : SLOTS;
      let done = 0, ex = 0;
      sl.forEach((s) => { const v = R[k + '|' + d + '|' + s]; const c = v ? PK(v) : 'miss'; out[c]++; out.slot[s][c]++; if (c === 'on' || c === 'late') done++; if (c === 'ex') ex++; });
      out.days.push({ d, n: done, ex, of: sl.length });
    }
    // บันทึกที่อยู่นอกตารางช่องเวลา (ชื่อเวลาแปลก) ยังนับรวม
    out.den = out.on + out.late + out.miss; out.pct = pctOf(out.on + out.late, out.den);
    return out;
  }
  // ---------- การมาเรียนรายคาบ
  const AK = (st) => { st = String(st || ''); if (/สาย|late/i.test(st)) return 'late'; if (/ขาด|absent/i.test(st)) return 'absent'; if (/^ลา|ลากิจ|ลาป่วย|leave|excus/i.test(st)) return 'leave'; return 'present'; };
  let AIDX = null, AIDXsrc = null;
  function attIdx() { if (AIDX && AIDXsrc === DATA.att) return AIDX; const m = {}; (DATA.att || []).forEach((r) => { if (!r || !okDate(r.date)) return; (m[norm(r.studentId)] = m[norm(r.studentId)] || []).push(r); }); AIDX = m; AIDXsrc = DATA.att; return m; }
  function attOf(st, from, to) {
    const L = (attIdx()[norm(st.studentId)] || []).filter((r) => r.date >= from && r.date <= to);
    const o = { present: 0, late: 0, leave: 0, absent: 0, n: 0, pct: null, subj: {}, absDates: [] };
    L.forEach((r) => { const c = AK(r.status); o[c]++; o.n++; const sn = r.subjectName || r.subjectCode || 'เช็คชื่อรายวัน'; const s = o.subj[sn] || (o.subj[sn] = { present: 0, late: 0, leave: 0, absent: 0, n: 0 }); s[c]++; s.n++; if (c === 'absent') o.absDates.push(r.date + (r.period ? ' คาบ ' + r.period : '') + (r.subjectName ? ' · ' + r.subjectName : '')); });
    o.pct = pctOf(o.present + o.late, o.n); return o;
  }
  // ---------- พฤติกรรม
  let BIDX = null, BIDXsrc = null;
  function bhIdx() { if (BIDX && BIDXsrc === DATA.bh) return BIDX; const m = {}; ((DATA.bh && DATA.bh.logs) || []).forEach((l) => { if (!l || l.status === 'cancelled') return; (m[norm(l.studentId)] = m[norm(l.studentId)] || []).push(l); }); BIDX = m; BIDXsrc = DATA.bh; return m; }
  function bhOf(st, from, to) {
    const term = (DATA.bh && DATA.bh.term) || ''; const L = bhIdx()[norm(st.studentId)] || [];
    let sum = 0; const items = []; let minus = 0, plus = 0, minusPts = 0, plusPts = 0;
    L.forEach((l) => { const p = Number(l.points) || 0; if (!term || !l.term || l.term === term) sum += p; if (l.date && l.date >= from && l.date <= to) { items.push(l); if (p < 0) { minus++; minusPts += p; } else if (p > 0) { plus++; plusPts += p; } } });
    items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return { score: Math.max(0, Math.min(100, 100 + sum)), term, minus, plus, minusPts, plusPts, items };
  }
  // ---------- หะละเกาะฮฺ
  function hqOf(st, from, to) {
    const G = DATA.hq[from + '|' + to] || []; const k = norm(st.studentId);
    const c = { present: 0, late: 0, leave: 0, absent: 0, none: 0 }; const groups = [];
    G.forEach((g) => (g.members || []).forEach((m) => { if (norm(m.id) !== k) return; groups.push(g.name + (g.teacherName ? ' · ' + g.teacherName : '')); Object.keys(c).forEach((x) => { c[x] += (m.c && m.c[x]) || 0; }); }));
    const den = c.present + c.late + c.absent + c.none; return { c, groups, pct: pctOf(c.present + c.late, den), n: den + c.leave };
  }
  // ---------- การลา
  function leavesOf(st, from, to) { const k = norm(st.studentId); return (DATA.lv || []).filter((x) => norm(x.sid || x.studentId) === k && (!x.status || x.status === 'approved') && String(x.from || '') <= to && String(x.to || x.from || '') >= from).sort((a, b) => String(b.from).localeCompare(String(a.from))); }
  // ---------- วิชาที่เรียน (จากตารางสอน)
  function subjectsOf(st) {
    const T = DATA.tt || {}; const G = T.grades || {}; const id = norm(st.studentId); const g = gNum(st.grade);
    const girl = () => { try { return (window.k8SexOf ? window.k8SexOf(st) : st.gender) === 'หญิง'; } catch (e) { return false; } };
    const fits = (c, own) => { const o = (c.o || []).map(norm), x = (c.x || []).map(norm), ad = (c.a || []).map(norm); if (!own) return o.indexOf(id) !== -1 || ad.indexOf(id) !== -1; if (ad.indexOf(id) !== -1) return true; if (o.length && o.indexOf(id) === -1) return false; if (x.indexOf(id) !== -1) return false; if (c.gx === 'm' && girl()) return false; if (c.gx === 'f' && !girl()) return false; return true; };
    const t = today(); const out = {};
    Object.keys(G).forEach((gk) => { const cells = (G[gk] && G[gk].cells) || {}; Object.keys(cells).forEach((ck) => { const L = Array.isArray(cells[ck]) ? cells[ck] : [cells[ck]]; L.forEach((c) => { if (!c || !c.sn) return; if (c.from && c.from > t) return; if (c.to && c.to < t) return; if (!fits(c, String(gk) === g)) return; const k2 = c.sn; const r = out[k2] || (out[k2] = { sn: c.sn, tn: c.tn || '', n: 0, other: String(gk) !== g ? gk : '' }); r.n++; }); }); });
    return Object.values(out).sort((a, b) => b.n - a.n || a.sn.localeCompare(b.sn, 'th'));
  }

  // ================= รายงาน =================
  async function studentReport(sid, from, to) {
    const st = studentById(sid); if (!st) return { error: 'ไม่พบนักเรียนรหัส ' + sid };
    await need(['att', 'bh', 'tt', 'lv', 'pr', 'hq'], from, to);
    return { kind: 'student', st, from, to, P: prayerOf(st, from, to), A: attOf(st, from, to), B: bhOf(st, from, to), H: hqOf(st, from, to), L: leavesOf(st, from, to), S: subjectsOf(st), grades: (st.grades || []).filter((x) => x && (x.grade !== '' || x.score !== '')), gpa: st.gpax || st.gpa || '' };
  }
  function matchSchool(q) {
    const L = schools(); if (!q) return null; const k = (s) => String(s).replace(/โรงเรียน|รร\.?|\s/g, '').toLowerCase(); const qk = k(q);
    let best = null, bs = 0;
    L.forEach((x) => { const sk = k(x.name); let sc = 0; if (sk === qk) sc = 1000; else if (sk.indexOf(qk) !== -1) sc = 500 + qk.length; else if (qk.indexOf(sk) !== -1) sc = 400 + sk.length; else { const l = lcs(sk, qk); if (l >= 4 && l >= sk.length * 0.4) sc = l; } if (sc > bs) { bs = sc; best = x.name; } });
    return best;
  }
  function lcs(a, b) { let m = 0; const p = new Array(b.length + 1).fill(0); for (let i = 1; i <= a.length; i++) { let prev = 0; for (let j = 1; j <= b.length; j++) { const tmp = p[j]; p[j] = a[i - 1] === b[j - 1] ? prev + 1 : 0; if (p[j] > m) m = p[j]; prev = tmp; } } return m; }
  async function groupReport(f, from, to) {
    f = f || {}; const school = f.school ? (matchSchool(f.school) || f.school) : ''; const grade = f.grade ? gNum(f.grade) : '';
    let L = students(); if (school) L = L.filter((s) => schoolOf(s) === school); if (grade) L = L.filter((s) => gNum(s.grade) === grade);
    if (f.school && !L.length) return { error: 'ไม่พบโรงเรียน "' + f.school + '"', schools: schools().map((x) => x.name) };
    await need(['att', 'bh', 'pr', 'hq'], from, to);
    const rows = L.map((st) => ({ st, P: prayerOf(st, from, to), A: attOf(st, from, to), B: bhOf(st, from, to), H: hqOf(st, from, to) }));
    const agg = { n: rows.length, pOn: 0, pDen: 0, aOk: 0, aN: 0, sc: 0, minus: 0, low: 0, hOk: 0, hN: 0, slot: {}, byG: {}, dist: { hi: 0, mid: 0, lo: 0, na: 0 }, abs: 0, late: 0 };
    SLOTS.forEach((s) => { agg.slot[s] = { ok: 0, den: 0 }; });
    rows.forEach((r) => {
      agg.pOn += r.P.on + r.P.late; agg.pDen += r.P.den; agg.aOk += r.A.present + r.A.late; agg.aN += r.A.n; agg.abs += r.A.absent; agg.late += r.A.late;
      agg.sc += r.B.score; agg.minus += r.B.minus; if (r.B.score < 80) agg.low++;
      agg.hOk += r.H.c.present + r.H.c.late; agg.hN += r.H.c.present + r.H.c.late + r.H.c.absent + r.H.c.none;
      SLOTS.forEach((s) => { const x = r.P.slot[s]; agg.slot[s].ok += x.on + x.late; agg.slot[s].den += x.on + x.late + x.miss; });
      const p = r.P.pct; agg.dist[p == null ? 'na' : p >= 90 ? 'hi' : p >= 70 ? 'mid' : 'lo']++;
      const g = shortG(r.st.grade) || 'ไม่ระบุชั้น'; const b = agg.byG[g] || (agg.byG[g] = { n: 0, pOn: 0, pDen: 0, aOk: 0, aN: 0, sc: 0 }); b.n++; b.pOn += r.P.on + r.P.late; b.pDen += r.P.den; b.aOk += r.A.present + r.A.late; b.aN += r.A.n; b.sc += r.B.score;
    });
    agg.pPct = pctOf(agg.pOn, agg.pDen); agg.aPct = pctOf(agg.aOk, agg.aN); agg.scAvg = rows.length ? Math.round(agg.sc / rows.length) : null; agg.hPct = pctOf(agg.hOk, agg.hN);
    const title = (school || 'ทุกโรงเรียน') + (grade ? ' · ม.' + grade : '');
    return { kind: 'group', school, grade, title, from, to, rows, agg };
  }
  const METRIC = {
    prayer: { l: 'ละหมาด', v: (r) => r.P.pct, txt: (r) => pctTxt(r.P.pct) + ' (ขาด ' + r.P.miss + ')' },
    attendance: { l: 'การมาเรียน', v: (r) => r.A.pct, txt: (r) => pctTxt(r.A.pct) + ' (ขาด ' + r.A.absent + ' · สาย ' + r.A.late + ')' },
    behavior: { l: 'คะแนนพฤติกรรม', v: (r) => r.B.score, txt: (r) => r.B.score + ' คะแนน (ถูกหัก ' + r.B.minus + ' ครั้ง)' },
    halaqah: { l: 'หะละเกาะฮฺ', v: (r) => r.H.pct, txt: (r) => pctTxt(r.H.pct) }
  };
  async function rankReport(f, from, to) {
    f = f || {}; const m = METRIC[f.metric] ? f.metric : 'prayer'; const G = await groupReport({ school: f.school, grade: f.grade }, from, to); if (G.error) return G;
    const best = f.order === 'best'; const lim = Math.max(1, Math.min(50, Number(f.limit) || 10));
    const L = G.rows.filter((r) => METRIC[m].v(r) != null).sort((a, b) => (best ? -1 : 1) * (METRIC[m].v(a) - METRIC[m].v(b)) || nameOf(a.st).localeCompare(nameOf(b.st), 'th')).slice(0, lim);
    return { kind: 'rank', metric: m, order: best ? 'best' : 'worst', title: METRIC[m].l + (best ? ' สูงสุด ' : ' ต่ำสุด ') + L.length + ' คน · ' + G.title, from, to, rows: L, group: G };
  }
  function findStudents(q, lim) {
    q = String(q || '').trim(); if (!q) return []; const qq = q.replace(/\s+/g, ' ').toLowerCase(); const id = q.match(/\d{3,}/);
    const out = [];
    students().forEach((s) => {
      const n = bare(s).toLowerCase(), full = nameOf(s).toLowerCase(); let sc = 0;
      if (id && norm(s.studentId) === norm(id[0])) sc = 1000;
      else if (n && (qq.indexOf(n) !== -1 || n.indexOf(qq) !== -1 || full.indexOf(qq) !== -1)) sc = 300 + Math.min(n.length, qq.length);
      else { const toks = n.split(' ').filter((t) => t.length >= 2); const hit = toks.filter((t) => qq.indexOf(t) !== -1); if (hit.length) sc = 100 * hit.length + hit.join('').length; }
      if (sc) out.push({ s, sc });
    });
    return out.sort((a, b) => b.sc - a.sc).slice(0, lim || 8).map((x) => x.s);
  }

  // ================= สรุปข้อมูลแบบกระชับให้ Gemini (ไม่ส่งรายการดิบ) =================
  function compact(rep) {
    if (!rep || rep.error) return rep || { error: 'ไม่มีข้อมูล' };
    if (rep.kind === 'student') {
      const s = rep.st;
      return { student: { id: s.studentId, name: nameOf(s), grade: shortG(s.grade), school: schoolOf(s), gender: s.gender || '' }, range: { from: rep.from, to: rep.to },
        prayer: { percent: rep.P.pct, on_time: rep.P.on, late: rep.P.late, excused: rep.P.ex, missed: rep.P.miss, by_slot: Object.fromEntries(SLOTS.map((k) => { const x = rep.P.slot[k]; return [k, { done: x.on + x.late, missed: x.miss, excused: x.ex }]; })) },
        attendance: { percent: rep.A.pct, present: rep.A.present, late: rep.A.late, leave: rep.A.leave, absent: rep.A.absent, checks: rep.A.n, absent_on: rep.A.absDates.slice(0, 15), by_subject: Object.fromEntries(Object.keys(rep.A.subj).slice(0, 20).map((k) => [k, rep.A.subj[k]])) },
        behavior: { term_score: rep.B.score, term: rep.B.term, deductions_in_range: rep.B.minus, deducted_points: rep.B.minusPts, rewards_in_range: rep.B.plus, items: rep.B.items.slice(0, 15).map((l) => ({ date: l.date, title: l.title || l.ruleTitle || '', points: Number(l.points) || 0 })) },
        halaqah: { percent: rep.H.pct, counts: rep.H.c, groups: rep.H.groups },
        leaves: rep.L.slice(0, 10).map((x) => ({ from: x.from, to: x.to, type: x.type || '', where: x.where || '' })),
        subjects: rep.S.slice(0, 25).map((x) => ({ subject: x.sn, teacher: x.tn, periods_per_week: x.n })),
        grades: rep.grades.slice(0, 25).map((x) => ({ subject: x.name || x.code, grade: x.grade, score: x.score })), gpa: rep.gpa };
    }
    if (rep.kind === 'group') {
      const a = rep.agg;
      return { scope: rep.title, range: { from: rep.from, to: rep.to }, students: a.n,
        prayer_percent: a.pPct, attendance_percent: a.aPct, behavior_avg: a.scAvg, halaqah_percent: a.hPct, behavior_below_80: a.low, deductions_in_range: a.minus, absences: a.abs, lates: a.late,
        prayer_by_slot_percent: Object.fromEntries(SLOTS.map((s) => [s, pctOf(a.slot[s].ok, a.slot[s].den)])),
        prayer_distribution: { '90%+': a.dist.hi, '70-89%': a.dist.mid, 'below 70%': a.dist.lo },
        by_grade: Object.fromEntries(Object.keys(a.byG).sort().map((g) => { const b = a.byG[g]; return [g, { students: b.n, prayer: pctOf(b.pOn, b.pDen), attendance: pctOf(b.aOk, b.aN), behavior_avg: Math.round(b.sc / b.n) }]; })),
        students_list: rep.rows.slice().sort((x, y) => (x.P.pct ?? 999) - (y.P.pct ?? 999)).slice(0, 60).map((r) => ({ id: r.st.studentId, name: nameOf(r.st), grade: shortG(r.st.grade), prayer: r.P.pct, attendance: r.A.pct, behavior: r.B.score, halaqah: r.H.pct })) };
    }
    if (rep.kind === 'rank') return { title: rep.title, range: { from: rep.from, to: rep.to }, metric: rep.metric, order: rep.order, list: rep.rows.map((r, i) => ({ rank: i + 1, id: r.st.studentId, name: nameOf(r.st), grade: shortG(r.st.grade), school: schoolOf(r.st), value: METRIC[rep.metric].v(r), detail: METRIC[rep.metric].txt(r) })) };
    return rep;
  }

  // ================= กราฟ (SVG/HTML) =================
  function donut(parts, center, sub) {
    const tot = parts.reduce((a, p) => a + p.v, 0); const R = 52, C = 2 * Math.PI * R; let off = 0;
    const arcs = tot ? parts.filter((p) => p.v > 0).map((p) => { const len = p.v / tot * C; const s = '<circle r="' + R + '" cx="70" cy="70" fill="none" stroke="' + p.c + '" stroke-width="18" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 70 70)"/>'; off += len; return s; }).join('') : '<circle r="' + R + '" cx="70" cy="70" fill="none" stroke="#e2e8f0" stroke-width="18"/>';
    return '<div class="k8ai-donut"><svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label="' + esc(center + ' ' + (sub || '')) + '">' + arcs + '<text x="70" y="68" text-anchor="middle" class="k8ai-dc">' + esc(center) + '</text>' + (sub ? '<text x="70" y="88" text-anchor="middle" class="k8ai-ds">' + esc(sub) + '</text>' : '') + '</svg>' +
      '<ul class="k8ai-leg">' + parts.map((p) => '<li><i style="background:' + p.c + '"></i>' + esc(p.l) + ' <b>' + p.v + '</b></li>').join('') + '</ul></div>';
  }
  function hbars(items, unit) {
    return '<div class="k8ai-hb">' + items.map((x) => '<div class="k8ai-hbr ' + (x.t || '') + '"><span>' + esc(x.l) + '</span><i><i style="width:' + Math.max(0, Math.min(100, x.v || 0)) + '%"></i></i><b>' + (x.v == null ? '–' : x.v + (unit == null ? '%' : unit)) + '</b>' + (x.s ? '<small>' + esc(x.s) + '</small>' : '') + '</div>').join('') + '</div>';
  }
  function cols(days) {
    if (!days.length) return '<p class="k8ai-empty">ไม่มีวันในช่วงนี้</p>';
    const n = days.length; const W = Math.max(280, Math.min(720, n * 24)); const H = 120; const bw = W / n; const step = Math.ceil(n / 10); const rw = Math.min(Math.max(2, bw - 4), 22); const ox = (bw - rw) / 2;
    return '<div class="k8ai-cols"><svg viewBox="0 0 ' + W + ' ' + (H + 22) + '" preserveAspectRatio="none" style="max-width:' + W + 'px" role="img" aria-label="ละหมาดรายวัน">' +
      [0.5, 1].map((y) => '<line x1="0" x2="' + W + '" y1="' + (H - y * H) + '" y2="' + (H - y * H) + '" class="k8ai-grid"/>').join('') +
      days.map((d, i) => { const of = d.of || 5; const h = of ? d.n / of * H : 0; const eh = of ? d.ex / of * H : 0; const c = d.n + d.ex >= of ? '#16a34a' : d.n / of >= 0.6 ? '#f59e0b' : '#dc2626';
        return '<g><title>' + esc(dTh(d.d) + ' · ละหมาด ' + d.n + '/' + of + (d.ex ? ' · ลา/อุซุร ' + d.ex : '')) + '</title>' + (eh ? '<rect x="' + (i * bw + ox).toFixed(1) + '" y="' + (H - h - eh).toFixed(1) + '" width="' + rw.toFixed(1) + '" height="' + eh.toFixed(1) + '" fill="#93c5fd" rx="2"/>' : '') + '<rect x="' + (i * bw + ox).toFixed(1) + '" y="' + (H - h).toFixed(1) + '" width="' + rw.toFixed(1) + '" height="' + Math.max(h, 1.5).toFixed(1) + '" fill="' + c + '" rx="2"/>' + (i % step === 0 ? '<text x="' + (i * bw + bw / 2).toFixed(1) + '" y="' + (H + 16) + '" text-anchor="middle" class="k8ai-ax">' + (+d.d.slice(8)) + '</text>' : '') + '</g>'; }).join('') +
      '</svg><p class="k8ai-cap"><i style="background:#16a34a"></i>ครบ <i style="background:#f59e0b"></i>บางเวลา <i style="background:#dc2626"></i>น้อย/ไม่ได้เช็ค <i style="background:#93c5fd"></i>ลา/อุซุร</p></div>';
  }
  const kpi = (l, v, s, t) => '<div class="k8ai-k ' + (t || '') + '"><small>' + esc(l) + '</small><b>' + esc(v) + '</b>' + (s ? '<span>' + esc(s) + '</span>' : '') + '</div>';

  // ================= การ์ดผลลัพธ์ =================
  const CARDS = {}; let cardSeq = 0;
  function cardShell(rep, inner, aiText) {
    const id = 'c' + (++cardSeq); CARDS[id] = { rep, aiText: aiText || '' };
    return '<article class="k8ai-card" data-card="' + id + '">' + inner + exportBar(id) + '</article>';
  }
  function exportBar(id) {
    const F = [['xlsx', 'Excel'], ['doc', 'Word'], ['pdf', 'PDF'], ['jpg', 'JPG']];
    return '<footer class="k8ai-x"><span>ส่งออก</span>' + F.map(([k, l]) => '<label><input type="checkbox" value="' + k + '"' + (k === 'pdf' ? ' checked' : '') + '><i>' + l + '</i></label>').join('') + '<button type="button" onclick="k8AiExport(\'' + id + '\', this)">⬇ บันทึกไฟล์</button></footer>';
  }
  function studentCard(rep, aiText) {
    const s = rep.st, P = rep.P, A = rep.A, B = rep.B, H = rep.H;
    let h = '<header class="k8ai-ch"><span class="k8ai-av">' + esc(bare(s).slice(0, 1) || '?') + '</span><div><b>' + esc(nameOf(s)) + '</b><small>' + esc(shortG(s.grade)) + ' · ' + esc(s.studentId) + ' · ' + esc(schoolOf(s)) + '</small></div><em>' + esc(rangeTxt(rep.from, rep.to)) + '</em></header>';
    h += '<div class="k8ai-ks">' + kpi('ละหมาด', pctTxt(P.pct), (P.on + P.late) + ' จาก ' + P.den + ' เวลา', tone(P.pct, 90, 70)) + kpi('มาเรียน', pctTxt(A.pct), A.n ? A.n + ' ครั้งที่เช็คชื่อ' : 'ยังไม่มีการเช็คชื่อ', tone(A.pct, 90, 80)) + kpi('พฤติกรรม', String(B.score), 'ภาคเรียน ' + (B.term || '-'), tone(B.score, 90, 80)) + kpi('หะละเกาะฮฺ', pctTxt(H.pct), H.n ? H.n + ' ครั้ง' : 'ไม่มีข้อมูล', tone(H.pct, 90, 70)) + '</div>';
    h += '<section class="k8ai-sec"><h4>การละหมาด</h4><div class="k8ai-row">' + donut([{ l: 'ตรงเวลา', v: P.on, c: '#16a34a' }, { l: 'สาย', v: P.late, c: '#f59e0b' }, { l: 'ลา/อุซุร', v: P.ex, c: '#60a5fa' }, { l: 'ไม่ได้เช็ค/ขาด', v: P.miss, c: '#ef4444' }], pctTxt(P.pct), 'ละหมาด') +
      '<div class="k8ai-grow"><h5>แยกตามเวลา</h5>' + hbars(SLOTS.map((k) => { const x = P.slot[k]; const p = pctOf(x.on + x.late, x.on + x.late + x.miss); return { l: k, v: p, t: tone(p, 90, 70), s: 'ขาด ' + x.miss }; })) + '</div></div>' +
      (P.days.length > 1 ? '<h5>รายวัน (จำนวนเวลาที่ละหมาด)</h5>' + cols(P.days) : '') + '</section>';
    const subj = Object.keys(A.subj);
    h += '<section class="k8ai-sec"><h4>การมาเรียน</h4>' + (A.n ? '<div class="k8ai-stack" role="img" aria-label="มา ' + A.present + ' สาย ' + A.late + ' ลา ' + A.leave + ' ขาด ' + A.absent + '">' + [['present', 'มา', '#16a34a'], ['late', 'สาย', '#f59e0b'], ['leave', 'ลา', '#60a5fa'], ['absent', 'ขาด', '#ef4444']].map(([k, l, c]) => A[k] ? '<i style="flex:' + A[k] + ';background:' + c + '" title="' + l + ' ' + A[k] + '"></i>' : '').join('') + '</div><p class="k8ai-cap">' + [['present', 'มา', '#16a34a'], ['late', 'สาย', '#f59e0b'], ['leave', 'ลา', '#60a5fa'], ['absent', 'ขาด', '#ef4444']].map(([k, l, c]) => '<i style="background:' + c + '"></i>' + l + ' ' + A[k]).join(' ') + '</p>' +
      (subj.length > 1 || (subj[0] && subj[0] !== 'เช็คชื่อรายวัน') ? '<h5>รายวิชา</h5>' + hbars(subj.sort((a, b) => A.subj[b].n - A.subj[a].n).slice(0, 12).map((k) => { const x = A.subj[k]; const p = pctOf(x.present + x.late, x.n); return { l: k, v: p, t: tone(p, 90, 80), s: 'ขาด ' + x.absent + ' · สาย ' + x.late }; })) : '') : '<p class="k8ai-empty">ยังไม่มีการเช็คชื่อในช่วงนี้</p>') + '</section>';
    h += '<section class="k8ai-sec"><h4>พฤติกรรม <small>คะแนนภาคเรียน ' + B.score + ' · ช่วงนี้ถูกหัก ' + B.minus + ' ครั้ง (' + B.minusPts + ') · ได้เพิ่ม ' + B.plus + ' ครั้ง</small></h4>' +
      (B.items.length ? '<ul class="k8ai-list">' + B.items.slice(0, 12).map((l) => { const p = Number(l.points) || 0; return '<li><span>' + esc(dTh(l.date)) + '</span><b>' + esc(l.title || l.ruleTitle || '-') + '</b><em class="' + (p < 0 ? 'is-bad' : 'is-ok') + '">' + (p > 0 ? '+' : '') + p + '</em></li>'; }).join('') + '</ul>' + (B.items.length > 12 ? '<p class="k8ai-more">และอีก ' + (B.items.length - 12) + ' รายการ (ดูทั้งหมดในไฟล์ที่ส่งออก)</p>' : '') : '<p class="k8ai-empty">ไม่มีรายการพฤติกรรมในช่วงนี้</p>') + '</section>';
    h += '<section class="k8ai-sec k8ai-two"><div><h4>หะละเกาะฮฺ</h4>' + (H.n ? hbars([{ l: 'มา', v: H.c.present, t: 'is-ok' }, { l: 'สาย', v: H.c.late, t: 'is-mid' }, { l: 'ลา', v: H.c.leave }, { l: 'ขาด', v: H.c.absent + H.c.none, t: 'is-bad' }].map((x) => ({ l: x.l, v: H.n ? Math.round(x.v / H.n * 100) : 0, t: x.t, s: x.v + ' ครั้ง' }))) + (H.groups.length ? '<p class="k8ai-cap">' + esc(H.groups.join(' · ')) + '</p>' : '') : '<p class="k8ai-empty">ไม่มีข้อมูลหะละเกาะฮฺในช่วงนี้</p>') + '</div>' +
      '<div><h4>การลา</h4>' + (rep.L.length ? '<ul class="k8ai-list">' + rep.L.slice(0, 6).map((x) => '<li><span>' + esc(rangeTxt(x.from, x.to || x.from)) + '</span><b>' + esc(x.type || 'ลา') + '</b><em>' + esc(x.where || '') + '</em></li>').join('') + '</ul>' : '<p class="k8ai-empty">ไม่มีการลาในช่วงนี้</p>') + '</div></section>';
    h += '<section class="k8ai-sec"><h4>วิชาที่เรียน' + (rep.gpa ? ' <small>เกรดเฉลี่ย ' + esc(rep.gpa) + '</small>' : '') + '</h4>' + (rep.S.length ? '<div class="k8ai-chips">' + rep.S.map((x) => { const g = rep.grades.find((y) => y.name === x.sn || y.code === x.sn); return '<span><b>' + esc(x.sn) + '</b>' + (x.tn ? '<small>' + esc(x.tn) + '</small>' : '') + '<small>' + x.n + ' คาบ/สัปดาห์' + (x.other ? ' · เรียนร่วม ม.' + esc(x.other) : '') + '</small>' + (g && g.grade !== '' ? '<em>เกรด ' + esc(g.grade) + '</em>' : '') + '</span>'; }).join('') + '</div>' : (rep.grades.length ? '' : '<p class="k8ai-empty">ยังไม่มีวิชาในตารางสอน</p>')) +
      (rep.grades.length && !rep.S.length ? '<div class="k8ai-chips">' + rep.grades.map((g) => '<span><b>' + esc(g.name || g.code) + '</b><em>เกรด ' + esc(g.grade) + '</em><small>คะแนน ' + esc(g.score) + '</small></span>').join('') + '</div>' : '') + '</section>';
    h += '<p class="k8ai-acts"><button type="button" onclick="k8AiWho(\'' + esc(s.studentId) + '\')">เปิดประวัติในหน้านักเรียน ›</button></p>';
    return cardShell(rep, h, aiText);
  }
  function groupCard(rep, aiText) {
    const a = rep.agg;
    let h = '<header class="k8ai-ch"><span class="k8ai-av is-sch">' + (rep.school ? '🏫' : '👥') + '</span><div><b>' + esc(rep.title) + '</b><small>นักเรียน ' + a.n + ' คน</small></div><em>' + esc(rangeTxt(rep.from, rep.to)) + '</em></header>';
    if (!a.n) return cardShell(rep, h + '<p class="k8ai-empty">ไม่มีนักเรียนตามเงื่อนไขนี้</p>', aiText);
    h += '<div class="k8ai-ks">' + kpi('ละหมาด', pctTxt(a.pPct), a.pOn + ' จาก ' + a.pDen + ' เวลา', tone(a.pPct, 90, 70)) + kpi('มาเรียน', pctTxt(a.aPct), a.aN ? 'ขาด ' + a.abs + ' · สาย ' + a.late : 'ยังไม่มีการเช็คชื่อ', tone(a.aPct, 90, 80)) + kpi('พฤติกรรมเฉลี่ย', a.scAvg == null ? '–' : String(a.scAvg), 'ต่ำกว่า 80: ' + a.low + ' คน', tone(a.scAvg, 90, 80)) + kpi('หะละเกาะฮฺ', pctTxt(a.hPct), a.hN ? a.hN + ' ครั้ง' : 'ไม่มีข้อมูล', tone(a.hPct, 90, 70)) + '</div>';
    const G = Object.keys(a.byG).sort();
    h += '<section class="k8ai-sec"><div class="k8ai-row">' + donut([{ l: '90% ขึ้นไป', v: a.dist.hi, c: '#16a34a' }, { l: '70–89%', v: a.dist.mid, c: '#f59e0b' }, { l: 'ต่ำกว่า 70%', v: a.dist.lo, c: '#ef4444' }], String(a.n), 'คน') +
      '<div class="k8ai-grow"><h5>ละหมาดแยกตามเวลา</h5>' + hbars(SLOTS.map((s) => { const p = pctOf(a.slot[s].ok, a.slot[s].den); return { l: s, v: p, t: tone(p, 90, 70) }; })) + '</div></div>' +
      (G.length > 1 ? '<h5>เทียบรายชั้น</h5><div class="k8ai-gg">' + G.map((g) => { const b = a.byG[g]; const pp = pctOf(b.pOn, b.pDen), ap = pctOf(b.aOk, b.aN), sc = Math.round(b.sc / b.n); return '<div><b>' + esc(g) + ' <small>' + b.n + ' คน</small></b>' + hbars([{ l: 'ละหมาด', v: pp, t: tone(pp, 90, 70) }, { l: 'มาเรียน', v: ap, t: tone(ap, 90, 80) }, { l: 'พฤติกรรม', v: sc, t: tone(sc, 90, 80) }]) + '</div>'; }).join('') + '</div>' : '') + '</section>';
    const watch = rep.rows.filter((r) => (r.P.pct != null && r.P.pct < 70) || (r.A.pct != null && r.A.pct < 80) || r.B.score < 80).sort((x, y) => (x.P.pct ?? 999) - (y.P.pct ?? 999)).slice(0, 8);
    if (watch.length) h += '<section class="k8ai-sec"><h4>ควรติดตาม <small>ละหมาดต่ำกว่า 70% · มาเรียนต่ำกว่า 80% · พฤติกรรมต่ำกว่า 80</small></h4><ul class="k8ai-list">' + watch.map((r) => '<li><button type="button" class="k8ai-who" onclick="k8AiAskStudent(\'' + esc(r.st.studentId) + '\')">' + esc(nameOf(r.st)) + '</button><span>' + esc(shortG(r.st.grade)) + '</span><em class="' + tone(r.P.pct, 90, 70) + '">ละหมาด ' + pctTxt(r.P.pct) + '</em><em class="' + tone(r.A.pct, 90, 80) + '">มาเรียน ' + pctTxt(r.A.pct) + '</em><em class="' + tone(r.B.score, 90, 80) + '">พฤติกรรม ' + r.B.score + '</em></li>').join('') + '</ul></section>';
    const R = rep.rows.slice().sort((x, y) => String(x.st.grade).localeCompare(String(y.st.grade), 'th') || nameOf(x.st).localeCompare(nameOf(y.st), 'th'));
    h += '<details class="k8ai-sec k8ai-det"' + (R.length <= 12 ? ' open' : '') + '><summary>รายชื่อนักเรียนทั้งหมด ' + R.length + ' คน</summary><div class="k8ai-tw"><table class="k8ai-t"><thead><tr><th>นักเรียน</th><th>ชั้น</th><th>ละหมาด</th><th>มาเรียน</th><th>พฤติกรรม</th><th>หะละเกาะฮฺ</th></tr></thead><tbody>' +
      R.map((r) => '<tr><td><button type="button" class="k8ai-who" onclick="k8AiAskStudent(\'' + esc(r.st.studentId) + '\')">' + esc(nameOf(r.st)) + '</button></td><td>' + esc(shortG(r.st.grade)) + '</td><td class="' + tone(r.P.pct, 90, 70) + '">' + pctTxt(r.P.pct) + '</td><td class="' + tone(r.A.pct, 90, 80) + '">' + pctTxt(r.A.pct) + '</td><td class="' + tone(r.B.score, 90, 80) + '">' + r.B.score + '</td><td class="' + tone(r.H.pct, 90, 70) + '">' + pctTxt(r.H.pct) + '</td></tr>').join('') + '</tbody></table></div></details>';
    return cardShell(rep, h, aiText);
  }
  function rankCard(rep, aiText) {
    const M = METRIC[rep.metric];
    let h = '<header class="k8ai-ch"><span class="k8ai-av is-sch">' + (rep.order === 'best' ? '🏆' : '⚠️') + '</span><div><b>' + esc(rep.title) + '</b><small>' + esc(M.l) + '</small></div><em>' + esc(rangeTxt(rep.from, rep.to)) + '</em></header>';
    h += rep.rows.length ? '<ol class="k8ai-rank">' + rep.rows.map((r) => { const v = M.v(r); const t = rep.metric === 'behavior' ? tone(v, 90, 80) : tone(v, 90, 70); return '<li><div><button type="button" class="k8ai-who" onclick="k8AiAskStudent(\'' + esc(r.st.studentId) + '\')">' + esc(nameOf(r.st)) + '</button><small>' + esc(shortG(r.st.grade)) + ' · ' + esc(schoolOf(r.st)) + '</small></div><div class="k8ai-hbr ' + t + '"><i><i style="width:' + Math.max(0, Math.min(100, v || 0)) + '%"></i></i><b>' + esc(M.txt(r)) + '</b></div></li>'; }).join('') + '</ol>' : '<p class="k8ai-empty">ไม่มีข้อมูลในช่วงนี้</p>';
    return cardShell(rep, h, aiText);
  }
  function chooserCard(list, q) {
    return '<article class="k8ai-card k8ai-choose"><p>พบนักเรียนที่ชื่อคล้าย "' + esc(q) + '" หลายคน เลือกคนที่ต้องการ:</p><div>' + list.map((s) => '<button type="button" onclick="k8AiAskStudent(\'' + esc(s.studentId) + '\')"><b>' + esc(nameOf(s)) + '</b><small>' + esc(shortG(s.grade)) + ' · ' + esc(s.studentId) + ' · ' + esc(schoolOf(s)) + '</small></button>').join('') + '</div></article>';
  }
  function renderRep(rep, aiText) { if (!rep || rep.error) return ''; if (rep.kind === 'student') return studentCard(rep, aiText); if (rep.kind === 'group') return groupCard(rep, aiText); if (rep.kind === 'rank') return rankCard(rep, aiText); return ''; }

  // ================= ข้อมูลสำหรับไฟล์ส่งออก =================
  function stripMd(t) { return String(t || '').replace(/\*\*|__|`/g, '').replace(/^#+\s*/gm, '').replace(/^\s*[-*•]\s+/gm, '• ').trim(); }
  function docOf(rep, aiText) {
    const range = rangeTxt(rep.from, rep.to); const sections = [];
    if (aiText) sections.push({ type: 'text', title: 'สรุปจากผู้ช่วย', color: '#0369a1', lines: stripMd(aiText).split(/\n+/).filter(Boolean) });
    if (rep.kind === 'student') {
      const s = rep.st, P = rep.P, A = rep.A, B = rep.B, H = rep.H;
      sections.push({ type: 'bars', title: 'ละหมาดแยกตามเวลา', color: '#0f766e', items: SLOTS.map((k) => { const x = P.slot[k]; const p = pctOf(x.on + x.late, x.on + x.late + x.miss); return { l: k, v: p, t: tone(p, 90, 70), s: 'ตรงเวลา ' + x.on + ' · สาย ' + x.late + ' · ลา ' + x.ex + ' · ขาด ' + x.miss }; }), note: 'รวม: ตรงเวลา ' + P.on + ' · สาย ' + P.late + ' · ลา/อุซุร ' + P.ex + ' · ไม่ได้เช็ค/ขาด ' + P.miss });
      sections.push({ key: 'pd', title: 'ละหมาดรายวัน', color: '#0f766e', cols: [['วันที่', 18, 'c'], ['ละหมาด (เวลา)', 18, 'c'], ['ลา/อุซุร', 14, 'c'], ['ขาด/ไม่ได้เช็ค', 18, 'c']], rows: P.days.slice().reverse().map((d) => ({ v: [dTh(d.d), d.n + '/' + d.of, d.ex, d.of - d.n - d.ex], bad: [d.of - d.n - d.ex > 0 ? 3 : -1] })) });
      const subj = Object.keys(A.subj);
      sections.push({ key: 'att', title: 'การมาเรียน (มา ' + A.present + ' · สาย ' + A.late + ' · ลา ' + A.leave + ' · ขาด ' + A.absent + ')', color: '#1d4ed8', cols: [['วิชา', 40, 'l'], ['มา', 10, 'c'], ['สาย', 10, 'c'], ['ลา', 10, 'c'], ['ขาด', 10, 'c'], ['ร้อยละ', 12, 'c']], rows: subj.map((k) => { const x = A.subj[k]; const p = pctOf(x.present + x.late, x.n); return { v: [k, x.present, x.late, x.leave, x.absent, p == null ? '–' : p], bad: [x.absent ? 4 : -1, p != null && p < 80 ? 5 : -1] }; }), note: A.absDates.length ? 'วันที่ขาด: ' + A.absDates.slice(0, 30).map((x) => dTh(x.slice(0, 10)) + x.slice(10)).join(' · ') : '' });
      sections.push({ key: 'bh', title: 'พฤติกรรม (คะแนนภาคเรียน ' + B.score + ')', color: '#be123c', cols: [['วันที่', 14, 'c'], ['หัวข้อ', 56, 'l'], ['คะแนน', 12, 'c'], ['ผู้บันทึก', 18, 'l']], rows: B.items.map((l) => { const p = Number(l.points) || 0; return { v: [dTh(l.date), l.title || l.ruleTitle || '-', (p > 0 ? '+' : '') + p, l.byName || l.by || ''], bad: [p < 0 ? 2 : -1], good: [p > 0 ? 2 : -1] }; }), note: 'ช่วงนี้ถูกหัก ' + B.minus + ' ครั้ง (' + B.minusPts + ' คะแนน) · ได้เพิ่ม ' + B.plus + ' ครั้ง' });
      sections.push({ key: 'hq', title: 'หะละเกาะฮฺ', color: '#7c3aed', cols: [['มา', 20, 'c'], ['สาย', 20, 'c'], ['ลา', 20, 'c'], ['ขาด/ไม่ได้เช็ค', 20, 'c'], ['ร้อยละ', 20, 'c']], rows: H.n ? [{ v: [H.c.present, H.c.late, H.c.leave, H.c.absent + H.c.none, H.pct == null ? '–' : H.pct] }] : [], note: H.groups.join(' · ') });
      if (rep.L.length) sections.push({ key: 'lv', title: 'การลา', color: '#0369a1', cols: [['ช่วงวันที่', 30, 'c'], ['ประเภท', 25, 'l'], ['อยู่ที่', 45, 'l']], rows: rep.L.map((x) => ({ v: [rangeTxt(x.from, x.to || x.from), x.type || 'ลา', x.where || ''] })) });
      sections.push({ key: 'subj', title: 'วิชาที่เรียน' + (rep.gpa ? ' (เกรดเฉลี่ย ' + rep.gpa + ')' : ''), color: '#4f46e5', cols: [['วิชา', 40, 'l'], ['ผู้สอน', 30, 'l'], ['คาบ/สัปดาห์', 14, 'c'], ['เกรด', 16, 'c']], rows: (rep.S.length ? rep.S.map((x) => { const g = rep.grades.find((y) => y.name === x.sn || y.code === x.sn); return { v: [x.sn + (x.other ? ' (เรียนร่วม ม.' + x.other + ')' : ''), x.tn || '', x.n, g && g.grade !== '' ? g.grade : '–'] }; }) : rep.grades.map((g) => ({ v: [g.name || g.code, '', '–', g.grade] }))) });
      return { name: nameOf(s), title: 'รายงานข้อมูลนักเรียนรายบุคคล', sub: shortG(s.grade) + ' · รหัส ' + s.studentId + ' · ' + schoolOf(s), range,
        kpis: [{ l: 'ละหมาด', v: pctTxt(P.pct), s: (P.on + P.late) + ' จาก ' + P.den + ' เวลา', t: tone(P.pct, 90, 70) }, { l: 'มาเรียน', v: pctTxt(A.pct), s: A.n + ' ครั้งที่เช็คชื่อ', t: tone(A.pct, 90, 80) }, { l: 'พฤติกรรม', v: String(B.score), s: 'ถูกหัก ' + B.minus + ' ครั้ง', t: tone(B.score, 90, 80) }, { l: 'หะละเกาะฮฺ', v: pctTxt(H.pct), s: H.n + ' ครั้ง', t: tone(H.pct, 90, 70) }], sections };
    }
    if (rep.kind === 'group') {
      const a = rep.agg; const G = Object.keys(a.byG).sort();
      sections.push({ type: 'bars', title: 'ละหมาดแยกตามเวลา', color: '#0f766e', items: SLOTS.map((s) => { const p = pctOf(a.slot[s].ok, a.slot[s].den); return { l: s, v: p, t: tone(p, 90, 70), s: a.slot[s].ok + ' จาก ' + a.slot[s].den }; }), note: 'นักเรียนที่ละหมาด 90% ขึ้นไป ' + a.dist.hi + ' คน · 70–89% ' + a.dist.mid + ' คน · ต่ำกว่า 70% ' + a.dist.lo + ' คน' });
      if (G.length > 1) sections.push({ key: 'g', title: 'เทียบรายชั้น', color: '#0369a1', cols: [['ชั้น', 16, 'c'], ['นักเรียน', 14, 'c'], ['ละหมาด %', 18, 'c'], ['มาเรียน %', 18, 'c'], ['พฤติกรรมเฉลี่ย', 18, 'c']], rows: G.map((g) => { const b = a.byG[g]; const pp = pctOf(b.pOn, b.pDen), ap = pctOf(b.aOk, b.aN); return { v: [g, b.n, pp == null ? '–' : pp, ap == null ? '–' : ap, Math.round(b.sc / b.n)], bad: [pp != null && pp < 70 ? 2 : -1, ap != null && ap < 80 ? 3 : -1] }; }) });
      const R = rep.rows.slice().sort((x, y) => String(x.st.grade).localeCompare(String(y.st.grade), 'th') || nameOf(x.st).localeCompare(nameOf(y.st), 'th'));
      const sc = [['ที่', 5, 'c'], ['ชื่อ - สกุล', 33, 'l'], ['ชั้น', 7, 'c'], ['รหัส', 9, 'c']];
      sections.push({ key: 'all', title: 'สรุปรายคน', color: '#0c4a6e', cols: sc.concat([['ละหมาด %', 11, 'c'], ['มาเรียน %', 11, 'c'], ['พฤติกรรม', 11, 'c'], ['หะละเกาะฮฺ %', 13, 'c']]), rows: R.map((r, i) => ({ v: [i + 1, nameOf(r.st), shortG(r.st.grade), r.st.studentId, r.P.pct == null ? '–' : r.P.pct, r.A.pct == null ? '–' : r.A.pct, r.B.score, r.H.pct == null ? '–' : r.H.pct], low: (r.P.pct != null && r.P.pct < 70) || r.B.score < 80, bad: [r.P.pct != null && r.P.pct < 70 ? 4 : -1, r.A.pct != null && r.A.pct < 80 ? 5 : -1, r.B.score < 80 ? 6 : -1, r.H.pct != null && r.H.pct < 70 ? 7 : -1] })), note: 'ตัวเลขสีแดง = ต่ำกว่าเกณฑ์ (ละหมาด/หะละเกาะฮฺ 70% · มาเรียน 80% · พฤติกรรม 80 คะแนน)' });
      sections.push({ key: 'pr', title: 'การละหมาด', color: '#0f766e', cols: sc.concat([['ตรงเวลา', 9, 'c'], ['สาย', 8, 'c'], ['ลา/อุซุร', 10, 'c'], ['ขาด', 8, 'c'], ['ร้อยละ', 9, 'c']]), rows: R.map((r, i) => ({ v: [i + 1, nameOf(r.st), shortG(r.st.grade), r.st.studentId, r.P.on, r.P.late, r.P.ex, r.P.miss, r.P.pct == null ? '–' : r.P.pct], low: r.P.pct != null && r.P.pct < 70, bad: [r.P.miss ? 7 : -1, r.P.pct != null && r.P.pct < 70 ? 8 : -1] })) });
      sections.push({ key: 'bh', title: 'พฤติกรรม', color: '#be123c', cols: sc.concat([['คะแนนภาคเรียน', 13, 'c'], ['ถูกหัก (ครั้ง)', 11, 'c'], ['ถูกหัก (คะแนน)', 12, 'c'], ['ได้เพิ่ม (ครั้ง)', 12, 'c']]), rows: R.map((r, i) => ({ v: [i + 1, nameOf(r.st), shortG(r.st.grade), r.st.studentId, r.B.score, r.B.minus, r.B.minusPts, r.B.plus], low: r.B.score < 80, bad: [r.B.score < 80 ? 4 : -1, r.B.minus ? 5 : -1] })) });
      sections.push({ key: 'att', title: 'การมาเรียน', color: '#1d4ed8', cols: sc.concat([['มา', 9, 'c'], ['สาย', 8, 'c'], ['ลา', 8, 'c'], ['ขาด', 8, 'c'], ['ร้อยละ', 11, 'c']]), rows: R.map((r, i) => ({ v: [i + 1, nameOf(r.st), shortG(r.st.grade), r.st.studentId, r.A.present, r.A.late, r.A.leave, r.A.absent, r.A.pct == null ? '–' : r.A.pct], low: r.A.pct != null && r.A.pct < 80, bad: [r.A.absent ? 7 : -1, r.A.pct != null && r.A.pct < 80 ? 8 : -1] })) });
      const items = []; R.forEach((r) => r.B.items.forEach((l) => items.push({ r, l }))); items.sort((x, y) => String(x.l.date).localeCompare(String(y.l.date)));
      if (items.length) sections.push({ key: 'bhl', title: 'รายการพฤติกรรมในช่วงนี้', color: '#9f1239', cols: [['ที่', 5, 'c'], ['วันที่', 11, 'c'], ['ชื่อ - สกุล', 28, 'l'], ['ชั้น', 7, 'c'], ['หัวข้อ', 37, 'l'], ['คะแนน', 12, 'c']], rows: items.map((x, i) => { const p = Number(x.l.points) || 0; return { v: [i + 1, dTh(x.l.date), nameOf(x.r.st), shortG(x.r.st.grade), x.l.title || x.l.ruleTitle || '-', (p > 0 ? '+' : '') + p], bad: [p < 0 ? 5 : -1], good: [p > 0 ? 5 : -1] }; }) });
      return { name: rep.title, title: 'รายงานสรุปข้อมูลนักเรียน', sub: 'นักเรียน ' + a.n + ' คน', range,
        kpis: [{ l: 'ละหมาด', v: pctTxt(a.pPct), s: a.pOn + ' จาก ' + a.pDen + ' เวลา', t: tone(a.pPct, 90, 70) }, { l: 'มาเรียน', v: pctTxt(a.aPct), s: 'ขาด ' + a.abs + ' · สาย ' + a.late, t: tone(a.aPct, 90, 80) }, { l: 'พฤติกรรมเฉลี่ย', v: a.scAvg == null ? '–' : String(a.scAvg), s: 'ต่ำกว่า 80: ' + a.low + ' คน', t: tone(a.scAvg, 90, 80) }, { l: 'หะละเกาะฮฺ', v: pctTxt(a.hPct), s: a.hN + ' ครั้ง', t: tone(a.hPct, 90, 70) }], sections };
    }
    if (rep.kind === 'rank') {
      const M = METRIC[rep.metric];
      sections.push({ key: 'rk', title: rep.title, color: '#0369a1', cols: [['อันดับ', 8, 'c'], ['ชื่อ - สกุล', 32, 'l'], ['ชั้น', 8, 'c'], ['โรงเรียน', 26, 'l'], [M.l, 26, 'c']], rows: rep.rows.map((r, i) => ({ v: [i + 1, nameOf(r.st), shortG(r.st.grade), schoolOf(r.st), M.txt(r)] })) });
      return { name: rep.group.title, title: 'รายงานจัดอันดับ · ' + M.l, sub: rep.order === 'best' ? 'สูงสุด' : 'ต่ำสุด', range, kpis: [], sections };
    }
    return null;
  }

  // ================= ตัวสร้างไฟล์ (ใช้ร่วมกัน) =================
  const K = {};
  const fmtNow = () => { const d = new Date(); return d.getDate() + ' ' + MTH[d.getMonth()] + ' ' + String(d.getFullYear() + 543).slice(2) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' น.'; };
  const loadScript = (src, test) => test() ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); });
  function dl(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  K.xlsx = async function (D, base) {
    await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', () => window.XLSX && XLSX.utils && XLSX.utils.aoa_to_sheet && XLSX.write);
    const wb = XLSX.utils.book_new(); const used = {};
    const add = (aoa, name, widths, merges, af) => { let n = String(name).replace(/[\\\/\?\*\[\]:]/g, ' ').trim().slice(0, 28) || 'แผ่น'; let k = n, i = 2; while (used[k]) k = n.slice(0, 24) + ' (' + (i++) + ')'; used[k] = 1; const ws = XLSX.utils.aoa_to_sheet(aoa); if (widths) ws['!cols'] = widths.map((w) => ({ wch: w })); if (merges) ws['!merges'] = merges; if (af) ws['!autofilter'] = af; XLSX.utils.book_append_sheet(wb, ws, k); };
    const sum = [[D.title], [D.sub ? 'รายการ' : 'กลุ่ม', D.name + (D.sub ? ' · ' + D.sub : '')], ['ช่วงวันที่', D.range], ['ออกรายงาน', fmtNow()], []];
    if (D.kpis && D.kpis.length) sum.push(['หัวข้อ', 'ค่า', 'รายละเอียด'], ...D.kpis.map((k) => [k.l, k.v, k.s || '']));
    D.sections.filter((s) => s.type === 'text').forEach((s) => { sum.push([], [s.title]); s.lines.forEach((l) => sum.push([l])); });
    D.sections.filter((s) => s.type === 'bars').forEach((s) => { sum.push([], [s.title], ['หัวข้อ', 'ร้อยละ', 'รายละเอียด']); s.items.forEach((x) => sum.push([x.l, x.v == null ? '' : x.v, x.s || ''])); if (s.note) sum.push([s.note]); });
    add(sum, 'สรุป', [22, 40, 44], [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]);
    D.sections.filter((s) => !s.type).forEach((sec) => {
      const aoa = [[sec.title + ' · ' + D.name], ['ช่วงวันที่ ' + D.range], [], sec.cols.map((c) => c[0])].concat(sec.rows.map((r) => r.v.map((v) => v === '–' ? '' : v)));
      if (sec.note) aoa.push([], [sec.note]);
      const last = Math.max(0, sec.cols.length - 1);
      add(aoa, sec.title.replace(/\s*\(.*\)$/, ''), sec.cols.map((c) => c[2] === 'l' ? Math.max(14, Math.round(c[1] * 1.3)) : Math.max(8, Math.round(c[1] * 1.1))), [{ s: { r: 0, c: 0 }, e: { r: 0, c: last } }, { s: { r: 1, c: 0 }, e: { r: 1, c: last } }],
        sec.rows.length ? { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3 + sec.rows.length, c: last } }) } : null);
    });
    dl(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), base + '.xlsx');
  };
  K.doc = function (D, base) {
    const td = (v, al, st) => '<td style="text-align:' + (al === 'l' ? 'left' : 'center') + ';' + (st || '') + '">' + esc(v) + '</td>';
    let h = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' + esc(D.title) + '</title>' +
      '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->' +
      '<style>@page WordSection1{size:21cm 29.7cm;margin:1.6cm 1.5cm 1.6cm 1.5cm} div.WordSection1{page:WordSection1}' +
      'body{font-family:"TH Sarabun New","IBM Plex Sans Thai",Tahoma,sans-serif;font-size:14pt;color:#0f172a}' +
      'h1{font-size:20pt;color:#0c4a6e;margin:0}h2{font-size:16pt;color:#0c4a6e;margin:18pt 0 6pt;border-left:6pt solid #0369a1;padding-left:6pt}' +
      'p.sub{color:#475569;margin:2pt 0 10pt}table{border-collapse:collapse;width:100%}' +
      'table.t th{background:#0c4a6e;color:#fff;font-weight:bold;padding:4pt 5pt;border:1px solid #0c4a6e;font-size:13pt}' +
      'table.t td{border:1px solid #cbd5e1;padding:3pt 5pt;font-size:13pt}table.t tr.z td{background:#f1f5f9}' +
      'table.k td{border:1px solid #bae6fd;background:#f0f9ff;padding:6pt;text-align:center}table.k b{font-size:20pt;display:block}' +
      'table.b td{border:0;padding:2pt 4pt;font-size:13pt}p.note{color:#64748b;font-size:12pt;margin:4pt 0 0}p.ai{margin:2pt 0}</style></head><body><div class="WordSection1">';
    h += '<h1>' + esc(D.title) + '</h1><p class="sub"><b>' + esc(D.name) + '</b>' + (D.sub ? ' · ' + esc(D.sub) : '') + '<br>ช่วงวันที่ ' + esc(D.range) + ' · ออกรายงาน ' + esc(fmtNow()) + '</p>';
    if (D.kpis && D.kpis.length) h += '<table class="k"><tr>' + D.kpis.map((k) => '<td style="width:' + Math.floor(100 / D.kpis.length) + '%"><span style="color:#475569">' + esc(k.l) + '</span><b style="color:' + (TONE_C[k.t] || '#0c4a6e') + '">' + esc(k.v) + '</b><span style="color:#64748b;font-size:12pt">' + esc(k.s || '') + '</span></td>').join('') + '</tr></table>';
    D.sections.forEach((sec) => {
      h += '<h2 style="border-left-color:' + sec.color + '">' + esc(sec.title) + '</h2>';
      if (sec.type === 'text') { h += sec.lines.map((l) => '<p class="ai">' + esc(l) + '</p>').join(''); return; }
      if (sec.type === 'bars') {
        h += '<table class="b">' + sec.items.map((x) => { const w = Math.max(1, Math.round((x.v || 0) * 2.6)); return '<tr><td style="width:16%">' + esc(x.l) + '</td><td style="width:44%"><table style="border-collapse:collapse;width:' + Math.max(1, x.v || 0) + '%"><tr><td style="background:' + (TONE_C[x.t] || '#94a3b8') + ';height:10pt;font-size:4pt;width:' + w + 'pt">&nbsp;</td></tr></table></td><td style="width:10%;font-weight:bold;color:' + (TONE_C[x.t] || '#0f172a') + '">' + (x.v == null ? '–' : x.v + '%') + '</td><td style="color:#64748b;font-size:12pt">' + esc(x.s || '') + '</td></tr>'; }).join('') + '</table>' + (sec.note ? '<p class="note">' + esc(sec.note) + '</p>' : '');
        return;
      }
      h += '<table class="t"><thead><tr>' + sec.cols.map((c) => '<th style="width:' + c[1] + '%">' + esc(c[0]) + '</th>').join('') + '</tr></thead><tbody>' +
        (sec.rows.length ? sec.rows.map((r, i) => '<tr' + (i % 2 ? ' class="z"' : '') + '>' + r.v.map((v, j) => td(v, sec.cols[j][2], (r.bad && r.bad.indexOf(j) !== -1 ? 'color:#b91c1c;font-weight:bold;' : '') + (r.good && r.good.indexOf(j) !== -1 ? 'color:#15803d;font-weight:bold;' : '') + (r.low && j === 1 ? 'color:#b91c1c;' : ''))).join('') + '</tr>').join('') : '<tr><td colspan="' + sec.cols.length + '" style="text-align:center;color:#64748b">ไม่มีข้อมูล</td></tr>') +
        '</tbody></table>' + (sec.note ? '<p class="note">' + esc(sec.note) + '</p>' : '');
    });
    h += '</div></body></html>';
    dl(new Blob(['﻿' + h], { type: 'application/msword' }), base + '.doc');
  };
  K.pages = async function (D) {
    const F = '"IBM Plex Sans Thai", Tahoma, sans-serif';
    try { await Promise.all(['400', '500', '600', '700'].map((w) => document.fonts.load(w + ' 20px "IBM Plex Sans Thai"', 'กขค'))); } catch (e) {}
    const W = 1240, H = 1754, M = 64, FOOT = 56; const out = []; let c, x, y;
    const font = (w, s) => { x.font = w + ' ' + s + 'px ' + F; };
    const fit = (t, w) => { t = String(t == null ? '' : t); if (x.measureText(t).width <= w) return t; while (t.length > 1 && x.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; };
    const wrap = (t, w) => { const out2 = []; let line = ''; String(t).split(/(\s+)/).forEach((tok) => { const tt = line + tok; if (x.measureText(tt).width > w && line.trim()) { out2.push(line.trim()); line = tok.trim(); } else line = tt; }); if (line.trim()) out2.push(line.trim()); const fin = []; out2.forEach((l) => { while (x.measureText(l).width > w && l.length > 1) { let k = l.length; while (k > 1 && x.measureText(l.slice(0, k)).width > w) k--; fin.push(l.slice(0, k)); l = l.slice(k); } fin.push(l); }); return fin; };
    const rr = (X, Y, w, h, r, fill, stroke) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = 2; x.stroke(); } };
    const newPage = (first) => {
      c = document.createElement('canvas'); c.width = W; c.height = H; x = c.getContext('2d'); out.push(c); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.textBaseline = 'middle';
      if (first) {
        const hh = D.sub ? 214 : 190; rr(M, M, W - 2 * M, hh, 22, '#0c4a6e');
        x.fillStyle = '#bae6fd'; font('600', 22); x.fillText(D.title + ' · KHALIFAH', M + 34, M + 42);
        x.fillStyle = '#fff'; font('700', 40); x.fillText(fit(D.name, W - 2 * M - 68), M + 34, M + 94);
        let yy = M + 140; if (D.sub) { x.fillStyle = '#e0f2fe'; font('500', 22); x.fillText(fit(D.sub, W - 2 * M - 68), M + 34, yy); yy += 34; }
        x.fillStyle = '#bae6fd'; font('400', 20); x.fillText('ช่วงวันที่ ' + D.range + '   ·   ออกรายงาน ' + fmtNow(), M + 34, yy + 4);
        y = M + hh + 28;
        if (D.kpis && D.kpis.length) {
          const n = D.kpis.length, kw = (W - 2 * M - (n - 1) * 18) / n;
          D.kpis.forEach((k, i) => { const X = M + i * (kw + 18); rr(X, y, kw, 132, 18, '#f8fafc', '#e2e8f0'); x.fillStyle = '#475569'; font('500', 20); x.fillText(k.l, X + 22, y + 32); x.fillStyle = TONE_C[k.t] || '#0c4a6e'; font('700', 44); x.fillText(k.v, X + 22, y + 76); if (k.s) { x.fillStyle = '#64748b'; font('400', 18); x.fillText(fit(k.s, kw - 44), X + 22, y + 112); } });
          y += 152;
        }
      } else {
        x.fillStyle = '#0c4a6e'; font('600', 20); x.fillText(fit(D.title + ' · ' + D.name, W - 2 * M - 260), M, M + 10);
        x.fillStyle = '#64748b'; font('400', 18); x.textAlign = 'right'; x.fillText(D.range, W - M, M + 10); x.textAlign = 'left';
        x.fillStyle = '#e2e8f0'; x.fillRect(M, M + 34, W - 2 * M, 2); y = M + 56;
      }
    };
    const room = () => H - M - FOOT - y; const TW = W - 2 * M, HH = 46, RH = 40;
    const colX = (sec) => { const tot = sec.cols.reduce((a, cc) => a + cc[1], 0); let acc = M; return sec.cols.map((cc) => { const w = cc[1] / tot * TW; const o = { x: acc, w, al: cc[2], t: cc[0] }; acc += w; return o; }); };
    const head = (sec, cont, n) => { x.fillStyle = sec.color || '#0369a1'; x.fillRect(M, y + 6, 8, 34); x.fillStyle = '#0f172a'; font('700', 28); x.fillText(fit(sec.title + (cont ? ' (ต่อ)' : ''), TW - 200), M + 22, y + 24); if (!cont && n != null) { x.fillStyle = '#64748b'; font('400', 18); x.textAlign = 'right'; x.fillText(n + ' รายการ', W - M, y + 24); x.textAlign = 'left'; } y += 56; };
    const thead = (X) => { rr(M, y, TW, HH, 10, '#0c4a6e'); x.fillStyle = '#fff'; font('600', 18); X.forEach((cl) => { x.textAlign = cl.al === 'l' ? 'left' : 'center'; x.fillText(fit(cl.t, cl.w - 16), cl.al === 'l' ? cl.x + 12 : cl.x + cl.w / 2, y + HH / 2); }); x.textAlign = 'left'; y += HH; };
    const note = (t) => { if (!t) return; font('400', 17); x.fillStyle = '#64748b'; const lines = wrap(t, TW); if (room() < 14 + lines.length * 26) newPage(false); y += 14; lines.forEach((l) => { x.fillStyle = '#64748b'; font('400', 17); x.fillText(l, M, y + 12); y += 26; }); };
    newPage(true);
    D.sections.forEach((sec, si) => {
      if (sec.type === 'text') {
        font('400', 21); const L = []; sec.lines.forEach((l) => wrap(l, TW - 40).forEach((w2) => L.push(w2)));
        if (room() < 56 + 40) newPage(false); else if (si) y += 22;
        head(sec, false); const top = y; const hgt = Math.min(room() - 10, L.length * 32 + 24);
        rr(M, top, TW, hgt, 16, '#f0f9ff', '#bae6fd'); y += 16;
        L.forEach((l) => { if (room() < 34) { newPage(false); head(sec, true); } x.fillStyle = '#0f172a'; font('400', 21); x.fillText(l, M + 22, y + 14); y += 32; }); y += 10; return;
      }
      if (sec.type === 'bars') {
        if (room() < 56 + 50 * Math.min(3, sec.items.length)) newPage(false); else if (si) y += 22;
        head(sec, false);
        sec.items.forEach((it) => { if (room() < 48) { newPage(false); head(sec, true); } const lw = 190, bw = TW - lw - 130 - 330; x.fillStyle = '#0f172a'; font('600', 20); x.fillText(fit(it.l, lw - 10), M, y + 20); rr(M + lw, y + 10, bw, 20, 10, '#f1f5f9'); if (it.v) rr(M + lw, y + 10, Math.max(20, bw * Math.min(100, it.v) / 100), 20, 10, TONE_C[it.t] || '#94a3b8'); x.fillStyle = TONE_C[it.t] || '#0f172a'; font('700', 20); x.fillText(it.v == null ? '–' : it.v + '%', M + lw + bw + 16, y + 20); x.fillStyle = '#64748b'; font('400', 16); x.fillText(fit(it.s || '', 320), M + lw + bw + 110, y + 20); y += 46; });
        note(sec.note); return;
      }
      const X = colX(sec);
      if (room() < 56 + HH + RH * 3) newPage(false); else if (si) y += 26;
      head(sec, false, sec.rows.length); thead(X);
      if (!sec.rows.length) { x.fillStyle = '#64748b'; font('400', 20); x.textAlign = 'center'; x.fillText('ไม่มีข้อมูล', W / 2, y + 30); x.textAlign = 'left'; y += 60; }
      sec.rows.forEach((r, i) => {
        if (room() < RH) { newPage(false); head(sec, true); thead(X); }
        if (i % 2) { x.fillStyle = '#f8fafc'; x.fillRect(M, y, TW, RH); }
        x.fillStyle = '#e2e8f0'; x.fillRect(M, y + RH - 1, TW, 1);
        r.v.forEach((v, j) => { const cl = X[j]; const bad = r.bad && r.bad.indexOf(j) !== -1, good = r.good && r.good.indexOf(j) !== -1; x.fillStyle = bad ? '#b91c1c' : good ? '#15803d' : (r.low && j === 1) ? '#b91c1c' : '#0f172a'; font(bad || good ? '600' : '400', 19); x.textAlign = cl.al === 'l' ? 'left' : 'center'; x.fillText(fit(v, cl.w - 16), cl.al === 'l' ? cl.x + 12 : cl.x + cl.w / 2, y + RH / 2); });
        x.textAlign = 'left'; y += RH;
      });
      note(sec.note);
    });
    out.forEach((cv, i) => { const g = cv.getContext('2d'); g.textBaseline = 'middle'; g.font = '400 17px ' + F; g.fillStyle = '#94a3b8'; g.fillText('KHALIFAH · ' + D.name, M, H - M + 6); g.textAlign = 'right'; g.fillText('หน้า ' + (i + 1) + ' / ' + out.length, W - M, H - M + 6); g.textAlign = 'left'; });
    return out;
  };
  const b64bytes = (u) => { const s = atob(u.split(',')[1]); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
  K.pdf = async function (D, base) {
    const P = await K.pages(D); await loadScript('vendor/pdf-lib/pdf-lib.min.js', () => window.PDFLib);
    const doc = await PDFLib.PDFDocument.create(); doc.setTitle(D.title + ' · ' + D.name); doc.setCreator('KHALIFAH');
    for (const cv of P) { const img = await doc.embedJpg(b64bytes(cv.toDataURL('image/jpeg', 0.9))); const pg = doc.addPage([595.28, 841.89]); pg.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 }); }
    dl(new Blob([await doc.save()], { type: 'application/pdf' }), base + '.pdf');
  };
  K.jpg = async function (D, base) {
    const P = await K.pages(D); const gap = 24; const W = P[0].width; const Ht = P.reduce((a, cv) => a + cv.height, 0) + gap * (P.length - 1);
    const sc = Math.min(1, Math.sqrt(16e6 / (W * Ht))); const c = document.createElement('canvas'); c.width = Math.round(W * sc); c.height = Math.round(Ht * sc); const g = c.getContext('2d');
    g.fillStyle = '#e2e8f0'; g.fillRect(0, 0, c.width, c.height); let y = 0; P.forEach((cv) => { g.drawImage(cv, 0, y * sc, cv.width * sc, cv.height * sc); y += cv.height + gap; });
    dl(await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9)), base + '.jpg');
  };
  K.run = async function (fmt, D, base) { if (!K[fmt]) throw new Error('fmt'); await K[fmt](D, base); };
  K.label = { xlsx: 'Excel', doc: 'Word', pdf: 'PDF', jpg: 'JPG' };
  window.k8Rep = K;
  const safeName = (s) => String(s).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40).trim();

  // ================= Gemini =================
  const TOOLS = [
    { name: 'find_students', description: 'ค้นหานักเรียนจากชื่อ นามสกุล ชื่อเล่น หรือรหัส คืนรายชื่อที่ตรง (รหัส ชื่อ ชั้น โรงเรียน) ใช้ก่อน student_report เมื่อไม่แน่ใจว่าเป็นใคร', parameters: { type: 'object', properties: { query: { type: 'string', description: 'ชื่อหรือรหัสนักเรียน' } }, required: ['query'] } },
    { name: 'list_schools', description: 'รายชื่อโรงเรียนต้นสังกัดทั้งหมดของนักเรียนในระบบ พร้อมจำนวนนักเรียน', parameters: { type: 'object', properties: {} } },
    { name: 'student_report', description: 'ข้อมูลทั้งหมดของนักเรียน 1 คนในช่วงวันที่: ละหมาด (แยกเวลา) การมาเรียน (แยกวิชา) พฤติกรรม หะละเกาะฮฺ การลา วิชาที่เรียน เกรด · แอปจะแสดงการ์ดพร้อมกราฟให้ผู้ใช้อัตโนมัติ', parameters: { type: 'object', properties: { student_id: { type: 'string' }, from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['student_id'] } },
    { name: 'group_report', description: 'สรุปนักเรียนทั้งกลุ่ม: ทั้งโรงเรียน (school) และ/หรือ ชั้น (grade 1-6) หรือทุกคนถ้าไม่ระบุ · ค่าเฉลี่ยละหมาด มาเรียน พฤติกรรม หะละเกาะฮฺ แยกเวลา แยกชั้น และรายชื่อทุกคน · แอปจะแสดงการ์ดพร้อมกราฟอัตโนมัติ', parameters: { type: 'object', properties: { school: { type: 'string', description: 'ชื่อโรงเรียน (บางส่วนก็ได้)' }, grade: { type: 'string', description: '1-6' }, from: { type: 'string' }, to: { type: 'string' } } } },
    { name: 'rank_students', description: 'จัดอันดับนักเรียนตามตัวชี้วัด เช่น ใครขาดละหมาดมากสุด ใครมาเรียนน้อยสุด ใครพฤติกรรมดีที่สุด · แอปจะแสดงการ์ดอันดับอัตโนมัติ', parameters: { type: 'object', properties: { metric: { type: 'string', enum: ['prayer', 'attendance', 'behavior', 'halaqah'] }, order: { type: 'string', enum: ['worst', 'best'] }, school: { type: 'string' }, grade: { type: 'string' }, limit: { type: 'integer' }, from: { type: 'string' }, to: { type: 'string' } }, required: ['metric'] } }
  ];
  function systemPrompt() {
    const r = S.range; const sc = schools().slice(0, 30).map((x) => x.name + ' (' + x.students + ' คน)').join(', ');
    return 'คุณคือผู้ช่วยข้อมูลของระบบ KHALIFAH (หอพัก/โครงการนักเรียนมุสลิม) ตอบแอดมินเป็นภาษาไทย สุภาพ กระชับ อ่านง่าย\n' +
      'วันนี้คือ ' + today() + ' (เวลาประเทศไทย) · ช่วงวันที่เริ่มต้นที่ผู้ใช้เลือกไว้: ' + r.from + ' ถึง ' + r.to + ' (' + r.label + ') ใช้ช่วงนี้เมื่อคำถามไม่ระบุช่วงเวลา · ถ้าคำถามระบุ (เช่น สัปดาห์นี้ เดือนตุลาคม ปีนี้) ให้คำนวณเป็น YYYY-MM-DD เอง\n' +
      'โรงเรียนในระบบ: ' + sc + '\n' +
      'กฎ: 1) ตัวเลขทุกตัวต้องมาจากเครื่องมือเท่านั้น ห้ามเดา 2) ถ้าชื่อนักเรียนกำกวม เรียก find_students ก่อน ถ้าพบหลายคนให้ถามกลับสั้นๆ พร้อมรายชื่อ 3) แอปจะแสดงการ์ดข้อมูลพร้อมกราฟและตารางเต็มให้ผู้ใช้เองทุกครั้งที่เรียก student_report / group_report / rank_students จึงไม่ต้องเขียนตารางซ้ำ ให้สรุปประเด็นสำคัญ 3–6 ข้อ ชี้จุดที่น่าเป็นห่วง และข้อเสนอแนะสั้นๆ 4) ร้อยละละหมาด = (ตรงเวลา+สาย) ÷ เวลาที่ต้องละหมาด ไม่นับเวลาที่ลา/มีประจำเดือน 5) ถ้าผู้ใช้อยากส่งออกไฟล์ บอกให้กดปุ่ม "บันทึกไฟล์" ใต้การ์ด (เลือกได้หลายแบบ Excel/Word/PDF/JPG) 6) ไม่ตอบเรื่องที่ไม่เกี่ยวกับข้อมูลนักเรียนในระบบ 7) ใช้ markdown แบบง่าย (ตัวหนา และรายการ) เท่านั้น';
  }
  async function runTool(name, args, ctx) {
    args = args || {};
    const rf = okDate(args.from) ? args.from : S.range.from, rt = okDate(args.to) ? args.to : S.range.to;
    const from = rf <= rt ? rf : rt, to = rf <= rt ? rt : rf;
    if (name === 'find_students') { const L = findStudents(args.query, 10); return { matches: L.map((s) => ({ id: s.studentId, name: nameOf(s), grade: shortG(s.grade), school: schoolOf(s) })) }; }
    if (name === 'list_schools') return { schools: schools() };
    if (name === 'student_report') { let id = args.student_id; if (!studentById(id)) { const L = findStudents(id, 2); if (L.length === 1) id = L[0].studentId; else return { error: 'ไม่พบนักเรียน "' + id + '"', candidates: L.map((s) => ({ id: s.studentId, name: nameOf(s) })) }; } const rep = await studentReport(id, from, to); if (!rep.error) ctx.reps.push(rep); return compact(rep); }
    if (name === 'group_report') { const rep = await groupReport({ school: args.school, grade: args.grade }, from, to); if (!rep.error) ctx.reps.push(rep); return compact(rep); }
    if (name === 'rank_students') { const rep = await rankReport(args, from, to); if (!rep.error) ctx.reps.push(rep); return compact(rep); }
    return { error: 'ไม่รู้จักเครื่องมือ ' + name };
  }
  // ---------- เส้นทางส่งคำถาม: Vercel (/api/ai ยิง Gemini ตรง) → ถ้าไม่พร้อมใช้ Apps Script (aiChat)
  async function ticket(force) {
    if (!force && S.tk && S.tk.exp - Date.now() > 60000) return S.tk.ticket;
    let r = null; try { r = await gasApiCall('aiTicket', {}, 20000); } catch (e) {}
    if (r && r.success && r.ticket) { S.tk = { ticket: r.ticket, exp: r.exp }; return r.ticket; }
    S.tk = null; return '';
  }
  async function viaVercel(body) {
    const send = async (tk) => { const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 70000); try { const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ ticket: tk }, body)), signal: ac.signal, cache: 'no-store' }); if (!res.ok && res.status !== 200) return { success: false, code: 'HTTP_' + res.status, message: 'HTTP ' + res.status }; return await res.json(); } finally { clearTimeout(t); } };
    let tk = await ticket(false); if (!tk) return { success: false, code: 'TICKET', message: 'ขอบัตรผ่านไม่ได้' };
    let r = await send(tk);
    if (r && r.code === 'TICKET') { tk = await ticket(true); if (tk) r = await send(tk); }
    return r;
  }
  async function aiCall(body, q) {
    if (S.route === 'vercel') {
      let r = null; try { r = await viaVercel(body); } catch (e) { r = { success: false, code: 'NETWORK', message: String(e && e.message || e) }; }
      if (r && (r.success || ['QUOTA', 'RATE', 'TOO_LARGE', 'BAD_KEY_OR_REQUEST'].indexOf(r.code) !== -1)) return r;
      if (!S.gasReady) return r || { success: false, message: 'AI error' };
      S.route = 'gas'; paintStatus();
    }
    return gasApiCall('aiChat', { data: Object.assign({ q }, body) }, 90000).catch((e) => ({ success: false, code: 'NETWORK', message: String(e && e.message || e) }));
  }
  async function askGemini(q, ctx) {
    const h0 = S.hist.length; S.hist.push({ role: 'user', parts: [{ text: q }] });
    for (let step = 0; step < 6; step++) {
      const r = await aiCall({ contents: trimHist(S.hist), tools: TOOLS, system: systemPrompt() }, step === 0 ? q : '');
      if (r && r.usage) { ctx.usage.in += r.usage.promptTokenCount || 0; ctx.usage.out += r.usage.candidatesTokenCount || 0; }
      if (!r || !r.success) { S.hist.length = h0; const e = new Error((r && r.message) || 'AI error'); e.code = r && r.code; throw e; }
      const content = r.content || { role: 'model', parts: [] }; if (!content.role) content.role = 'model';
      S.hist.push(content);
      const calls = (content.parts || []).filter((p) => p.functionCall);
      if (!calls.length) return (content.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('\n').trim();
      const resp = [];
      for (const p of calls) { const fc = p.functionCall; setStatus('กำลังดึงข้อมูล: ' + ({ find_students: 'ค้นหานักเรียน', list_schools: 'รายชื่อโรงเรียน', student_report: 'ข้อมูลนักเรียน', group_report: 'สรุปกลุ่ม', rank_students: 'จัดอันดับ' }[fc.name] || fc.name) + '…'); let out; try { out = await runTool(fc.name, fc.args, ctx); } catch (e) { out = { error: String(e && e.message || e) }; } const fr = { name: fc.name, response: { result: out } }; if (fc.id) fr.id = fc.id; resp.push({ functionResponse: fr }); }
      S.hist.push({ role: 'user', parts: resp });
    }
    return 'ขออภัย คำถามนี้ซับซ้อนเกินไป ลองถามให้เจาะจงขึ้นอีกนิด';
  }
  function trimHist(h) {
    // เก็บบทสนทนาล่าสุดประมาณ 24 ข้อความ โดยเริ่มที่คำถามของผู้ใช้ (ไม่ตัดคู่ functionCall/functionResponse)
    if (h.length <= 24) return h;
    let i = h.length - 24; while (i < h.length && !(h[i].role === 'user' && (h[i].parts || []).some((p) => p.text))) i++;
    return h.slice(i);
  }

  // ================= โหมดค้นหาในเครื่อง (ไม่ใช้ AI) =================
  async function askLocal(q, ctx) {
    const r = rangeFromText(q) || S.range; const qs = q.replace(/\s+/g, ' ');
    const gm = qs.match(/(?:ม\.|มัธยมศึกษาปีที่|ชั้น\s*ม?\.?)\s*([1-6])/);
    const met = /ละหมาด/.test(qs) ? 'prayer' : /มาเรียน|ขาดเรียน|เข้าเรียน|เช็คชื่อ/.test(qs) ? 'attendance' : /พฤติกรรม|คะแนน|ความประพฤติ/.test(qs) ? 'behavior' : /หะละเกาะ|ฮะลาเกาะ|ฮาลาเกาะ/.test(qs) ? 'halaqah' : '';
    const isRank = /อันดับ|มากสุด|มากที่สุด|น้อยสุด|น้อยที่สุด|ต่ำสุด|ต่ำที่สุด|สูงสุด|สูงที่สุด|ดีที่สุด|แย่|ใครขาด|ใครบ้าง|top/i.test(qs);
    const sch = /โรงเรียน|รร\./.test(qs) ? matchSchool(qs.replace(/.*?(โรงเรียน|รร\.)/, '')) || matchSchool(qs) : matchSchool(qs);
    const stuL = findStudents(qs.replace(/สรุป|ข้อมูล|ของ|ขอ|ดู|นักเรียน|ชื่อ|เดือนนี้|สัปดาห์นี้|วันนี้|ปีนี้|ภาคเรียนนี้|ทั้งหมด|หน่อย|ครับ|ค่ะ|คะ/g, ' ').trim(), 6);
    if (isRank && met) {
      const best = /ดีที่สุด|สูงสุด|สูงที่สุด|มากที่สุด(?!.*ขาด)|เยอะ(?!.*ขาด)/.test(qs) && !/ขาด|ต่ำ|น้อย|แย่/.test(qs);
      const rep = await rankReport({ metric: met, order: best ? 'best' : 'worst', school: sch || '', grade: gm ? gm[1] : '', limit: (qs.match(/(\d+)\s*คน/) || [])[1] || 10 }, r.from, r.to);
      if (rep.error) return rep.error; ctx.reps.push(rep);
      return 'นี่คือ' + rep.title + ' ช่วง' + r.label + (rep.rows[0] ? ' · อันดับแรกคือ **' + nameOf(rep.rows[0].st) + '** (' + METRIC[met].txt(rep.rows[0]) + ')' : '');
    }
    if (stuL.length && (!sch || /นักเรียน|ของ/.test(qs) || stuL.length === 1)) {
      const strong = stuL.filter((s) => qs.indexOf(bare(s)) !== -1 || qs.indexOf(String(s.studentId)) !== -1 || (qs.match(/\d{3,}/) && norm(qs.match(/\d{3,}/)[0]) === norm(s.studentId)));
      const L = strong.length ? strong : stuL;
      if (L.length > 1) { ctx.html.push(chooserCard(L, qs)); return 'พบนักเรียนที่ชื่อคล้ายกัน ' + L.length + ' คน เลือกคนที่ต้องการได้เลย'; }
      const rep = await studentReport(L[0].studentId, r.from, r.to); if (rep.error) return rep.error; ctx.reps.push(rep);
      return localStudentText(rep, r.label);
    }
    if (sch || gm || /ทุกคน|ทั้งหมด|ภาพรวม|ทุกโรงเรียน/.test(qs)) {
      const rep = await groupReport({ school: sch || '', grade: gm ? gm[1] : '' }, r.from, r.to); if (rep.error) return rep.error; ctx.reps.push(rep);
      return localGroupText(rep, r.label);
    }
    return 'ยังไม่เข้าใจคำถามนี้ ลองพิมพ์ชื่อนักเรียน ชื่อโรงเรียน หรือชั้น เช่น **"สรุปโรงเรียน' + (schools()[0] ? schools()[0].name.replace(/^โรงเรียน/, '') : 'สาธิต') + ' เดือนนี้"**, **"ข้อมูลของ' + (students()[0] ? bare(students()[0]).split(' ')[0] : 'อาหมัด') + '"** หรือ **"ใครขาดละหมาดมากที่สุดสัปดาห์นี้"**';
  }
  function localStudentText(rep, label) {
    const P = rep.P, A = rep.A, B = rep.B; const L = [];
    L.push('**' + nameOf(rep.st) + '** (' + shortG(rep.st.grade) + ') ช่วง' + label + ':');
    L.push('• ละหมาด ' + pctTxt(P.pct) + ' (ตรงเวลา ' + P.on + ' · สาย ' + P.late + ' · ลา/อุซุร ' + P.ex + ' · ไม่ได้เช็ค ' + P.miss + ')');
    const worst = SLOTS.map((k) => ({ k, m: P.slot[k].miss })).sort((a, b) => b.m - a.m)[0]; if (worst && worst.m) L.push('• เวลาที่ขาดบ่อยสุด: ' + worst.k + ' (' + worst.m + ' ครั้ง)');
    L.push('• มาเรียน ' + (A.n ? pctTxt(A.pct) + ' (ขาด ' + A.absent + ' · สาย ' + A.late + ' · ลา ' + A.leave + ')' : 'ยังไม่มีการเช็คชื่อ'));
    L.push('• พฤติกรรม ' + B.score + ' คะแนน' + (B.minus ? ' · ช่วงนี้ถูกหัก ' + B.minus + ' ครั้ง' : ' · ช่วงนี้ไม่ถูกหักคะแนน'));
    if (rep.H.n) L.push('• หะละเกาะฮฺ ' + pctTxt(rep.H.pct));
    return L.join('\n');
  }
  function localGroupText(rep, label) {
    const a = rep.agg; const L = ['**' + rep.title + '** ช่วง' + label + ' · นักเรียน ' + a.n + ' คน'];
    L.push('• ละหมาดเฉลี่ย ' + pctTxt(a.pPct) + ' · มาเรียน ' + pctTxt(a.aPct) + ' · พฤติกรรมเฉลี่ย ' + (a.scAvg == null ? '–' : a.scAvg) + (a.hN ? ' · หะละเกาะฮฺ ' + pctTxt(a.hPct) : ''));
    const ws = SLOTS.map((s) => ({ s, p: pctOf(a.slot[s].ok, a.slot[s].den) })).filter((x) => x.p != null).sort((x, y) => x.p - y.p)[0]; if (ws) L.push('• เวลาละหมาดที่ต่ำสุด: ' + ws.s + ' (' + ws.p + '%)');
    if (a.dist.lo) L.push('• ละหมาดต่ำกว่า 70%: ' + a.dist.lo + ' คน'); if (a.low) L.push('• พฤติกรรมต่ำกว่า 80 คะแนน: ' + a.low + ' คน');
    return L.join('\n');
  }

  // ================= หน้าจอ =================
  const S = { range: range('month'), rk: 'month', hist: [], busy: false, ready: null, model: '', msgs: 0, route: '', gasReady: false, tk: null };
  function md(t) {
    const lines = esc(t).split('\n'); let h = '', inL = false;
    lines.forEach((l) => { const m = l.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/); const b = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\s)\*(\S.+?\S)\*(?=\s|$)/g, '$1<i>$2</i>'); if (m) { if (!inL) { h += '<ul>'; inL = true; } h += '<li>' + b(m[1]) + '</li>'; } else { if (inL) { h += '</ul>'; inL = false; } if (l.trim()) h += '<p>' + b(l.replace(/^#+\s*/, '')) + '</p>'; } });
    if (inL) h += '</ul>'; return h;
  }
  const $ = (id) => document.getElementById(id);
  function ensureDom() {
    if ($('k8Ai')) return;
    const el = document.createElement('div'); el.className = 'k8-asum k8ai'; el.id = 'k8Ai'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'k8AiT');
    el.innerHTML = '<div class="k8ai-in"><header class="k8-asum-h k8ai-h"><button type="button" class="k8-pg-back" aria-label="ปิด" onclick="history.back()"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button><div><h2 id="k8AiT">ถามข้อมูล <span class="k8ai-badge">AI</span></h2><small id="k8AiSt">กำลังตรวจสอบ…</small></div><button type="button" class="k8ai-new" onclick="k8AiReset()" title="เริ่มบทสนทนาใหม่">เริ่มใหม่</button></header>' +
      '<div class="k8ai-range" id="k8AiRange"></div><div class="k8ai-log" id="k8AiLog" aria-live="polite"></div>' +
      '<form class="k8ai-comp" onsubmit="event.preventDefault();k8AiSend()"><textarea id="k8AiQ" rows="1" placeholder="ถามได้เลย เช่น สรุปโรงเรียน… เดือนนี้" aria-label="คำถาม" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey&&!event.isComposing){event.preventDefault();k8AiSend()}" oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,140)+\'px\'"></textarea><button type="submit" id="k8AiGo" aria-label="ส่งคำถาม"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg></button></form></div>';
    document.body.appendChild(el);
    window.addEventListener('popstate', () => { const e = $('k8Ai'); if (e && !e.hidden) { e.hidden = true; document.documentElement.classList.remove('k8-docs-open'); } });
  }
  function paintRange() {
    const R = [['today', 'วันนี้'], ['thisweek', 'สัปดาห์นี้'], ['month', 'เดือนนี้'], ['term', 'ภาคเรียน'], ['year', 'ปีนี้'], ['custom', 'กำหนดเอง']];
    $('k8AiRange').innerHTML = '<span class="k8ai-rl">ช่วงวันที่</span>' + R.map(([k, l]) => '<button type="button" aria-pressed="' + (S.rk === k) + '" onclick="k8AiRange(\'' + k + '\')">' + l + '</button>').join('') +
      (S.rk === 'custom' ? '<span class="k8ai-dr"><input type="date" aria-label="ตั้งแต่" value="' + S.range.from + '" onchange="k8AiRange(\'custom\', this.value, null)"><span>–</span><input type="date" aria-label="ถึง" value="' + S.range.to + '" onchange="k8AiRange(\'custom\', null, this.value)"></span>' : '<em>' + esc(rangeTxt(S.range.from, S.range.to)) + '</em>');
  }
  function setStatus(t) { const e = document.querySelector('#k8AiLog .k8ai-typing span'); if (e) e.textContent = t; }
  function welcome() {
    const sc = schools(); const st = students(); const s0 = sc[0] ? sc[0].name : ''; const n0 = st[0] ? bare(st[0]).split(' ')[0] : '';
    const sug = [s0 && 'สรุปข้อมูล' + s0 + ' เดือนนี้', n0 && 'ข้อมูลทั้งหมดของ ' + n0 + ' สัปดาห์นี้', 'ใครขาดละหมาดมากที่สุดเดือนนี้', 'สรุปชั้น ม.4 เดือนนี้', 'ใครมาเรียนน้อยที่สุด 10 คน', 'พฤติกรรมของนักเรียนทุกคนภาคเรียนนี้'].filter(Boolean);
    return '<div class="k8ai-hi"><b>ถามข้อมูลนักเรียนได้เลย</b><p>พิมพ์ชื่อนักเรียน ชื่อโรงเรียน หรือชั้น แล้วระบุช่วงเวลา (วันนี้ สัปดาห์นี้ เดือนนี้ ปีนี้ หรือชื่อเดือน) ระบบจะสรุปละหมาด การมาเรียน พฤติกรรม หะละเกาะฮฺ วิชาที่เรียน พร้อมกราฟ และบันทึกเป็น Excel / Word / PDF / JPG ได้หลายไฟล์พร้อมกัน</p><div class="k8ai-sug">' + sug.map((x) => '<button type="button" onclick="k8AiAsk(' + esc(JSON.stringify(x)) + ')">' + esc(x) + '</button>').join('') + '</div></div>';
  }
  function scrollEnd(el) { const log = $('k8AiLog'); if (!log) return; requestAnimationFrame(() => { if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); else log.scrollTop = log.scrollHeight; }); }
  function paintStatus() {
    const st = $('k8AiSt'); if (st) st.textContent = S.ready ? 'Gemini พร้อมใช้งาน' + (S.route === 'vercel' ? ' (ส่งตรงผ่าน Vercel)' : ' (ผ่าน Apps Script)') + ' · ตัวเลขคำนวณจากข้อมูลจริงในระบบ' : 'โหมดค้นหาในเครื่อง · ตั้งค่า Gemini เพื่อถามแบบอิสระได้มากขึ้น';
    const b = document.querySelector('#k8Ai .k8ai-badge'); if (b) b.classList.toggle('is-off', !S.ready);
  }
  async function checkReady() {
    const vq = (async () => { try { const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 6000); const r = await fetch('/api/ai', { cache: 'no-store', signal: ac.signal }); clearTimeout(t); if (!r.ok) return null; const j = await r.json(); return j && j.success ? j : null; } catch (e) { return null; } })();
    const gq = gasApiCall('aiStatus', {}, 20000).catch(() => null);
    const [v, g] = await Promise.all([vq, gq]);
    S.gasReady = !!(g && g.success && g.ready);
    const direct = !!(v && v.ready && g && g.success && g.direct);
    S.route = direct ? 'vercel' : S.gasReady ? 'gas' : '';
    S.ready = !!S.route; S.model = (direct ? v.model : g && g.model) || '';
    if (direct) ticket(false);
    paintStatus();
  }
  window.k8AiOpen = function (q) {
    ensureDom(); const el = $('k8Ai'); el.hidden = false; document.documentElement.classList.add('k8-docs-open'); try { history.pushState({ k8ai: 1 }, ''); } catch (e) {}
    paintRange(); if (!S.msgs) $('k8AiLog').innerHTML = welcome(); if (S.ready == null) checkReady();
    need(['att', 'bh', 'pr'], S.range.from, S.range.to); // โหลดล่วงหน้า
    setTimeout(() => { const t = $('k8AiQ'); if (t && !q) t.focus(); }, 60); if (q) window.k8AiAsk(q);
  };
  window.k8AiRange = function (k, a, b) { if (k === 'custom') { S.rk = 'custom'; S.range = range('custom', a || S.range.from, b || S.range.to); } else { S.rk = k; S.range = range(k); } paintRange(); };
  window.k8AiReset = function () { S.hist = []; S.msgs = 0; Object.keys(CARDS).forEach((k) => delete CARDS[k]); $('k8AiLog').innerHTML = welcome(); };
  window.k8AiAsk = function (q) { const t = $('k8AiQ'); if (t) t.value = q; window.k8AiSend(); };
  window.k8AiAskStudent = function (sid) { const s = studentById(sid); if (!s) return; window.k8AiAsk('ข้อมูลทั้งหมดของ ' + nameOf(s) + ' (รหัส ' + s.studentId + ')'); };
  window.k8AiWho = function (sid) { try { history.back(); } catch (e) {} setTimeout(() => { try { switchAdminTab('students', document.getElementById('btnAdminTabStudents')); } catch (e) {} setTimeout(() => { try { window.k8PdWho(sid); } catch (e) {} }, 150); }, 120); };
  window.k8AiSend = async function () {
    const t = $('k8AiQ'); const q = String((t && t.value) || '').trim(); if (!q || S.busy) return;
    S.busy = true; t.value = ''; t.style.height = 'auto'; $('k8AiGo').disabled = true;
    const log = $('k8AiLog'); if (!S.msgs) log.innerHTML = ''; S.msgs++;
    const u = document.createElement('div'); u.className = 'k8ai-m is-u'; u.innerHTML = '<p>' + esc(q) + '</p>'; log.appendChild(u);
    const a = document.createElement('div'); a.className = 'k8ai-m is-a'; a.innerHTML = '<p class="k8ai-typing"><i></i><i></i><i></i><span>กำลังคิด…</span></p>'; log.appendChild(a); scrollEnd(u);
    const ctx = { reps: [], html: [], usage: { in: 0, out: 0 } }; let text = '', note = '';
    try {
      if (S.ready == null) await checkReady();
      if (S.ready) {
        try { text = await askGemini(q, ctx); if (S.route === 'vercel') gasApiCall('aiLog', { data: { q, model: S.model + ' (vercel)', usage: { promptTokenCount: ctx.usage.in, candidatesTokenCount: ctx.usage.out } } }, 20000).catch(() => {}); }
        catch (e) { note = e.code === 'NO_KEY' ? '' : 'Gemini ตอบไม่ได้ (' + (e.message || e.code || 'error') + ') · ใช้การค้นหาในเครื่องแทน'; if (e.code === 'NO_KEY') { S.ready = false; paintStatus(); } ctx.reps = []; text = await askLocal(q, ctx); }
      } else text = await askLocal(q, ctx);
    } catch (e) { console.warn('k8Ai', e); text = 'เกิดข้อผิดพลาด: ' + (e && e.message || e); }
    a.innerHTML = (note ? '<p class="k8ai-note">' + esc(note) + '</p>' : '') + (text ? '<div class="k8ai-txt">' + md(text) + '</div>' : '') + ctx.html.join('') + ctx.reps.map((r, i) => renderRep(r, i === ctx.reps.length - 1 ? text : '')).join('');
    S.busy = false; $('k8AiGo').disabled = false; scrollEnd(a); setTimeout(() => { if (t && window.matchMedia('(pointer:fine)').matches) t.focus(); }, 50);
  };
  window.k8AiExport = async function (id, btn) {
    const C = CARDS[id]; if (!C) return; const box = btn.closest('.k8ai-x'); const F = Array.from(box.querySelectorAll('input:checked')).map((i) => i.value);
    if (!F.length) { toast('เลือกชนิดไฟล์อย่างน้อย 1 แบบ', 'warning'); return; }
    const D = docOf(C.rep, C.aiText); if (!D) return;
    const base = (C.rep.kind === 'student' ? 'ข้อมูลนักเรียน_' : C.rep.kind === 'rank' ? 'อันดับ_' : 'สรุป_') + safeName(D.name) + '_' + C.rep.from + (C.rep.from !== C.rep.to ? '_' + C.rep.to : '');
    btn.disabled = true; const old = btn.textContent; const done = [];
    for (const f of F) { btn.textContent = 'กำลังสร้าง ' + K.label[f] + '…'; try { await K.run(f, D, base); done.push(K.label[f]); await new Promise((r) => setTimeout(r, 400)); } catch (e) { console.warn('export', f, e); toast('สร้างไฟล์ ' + K.label[f] + ' ไม่สำเร็จ' + (/load/.test(String(e && e.message)) ? ' (ต้องต่อเน็ต)' : ''), 'error'); } }
    btn.disabled = false; btn.textContent = old; if (done.length) toast('บันทึกไฟล์แล้ว: ' + done.join(', '), 'success');
  };
  // สำหรับทดสอบ/ต่อยอด
  window.k8AiApi = { studentReport, groupReport, rankReport, findStudents, matchSchool, rangeFromText, docOf, compact, schools, state: S };
})();
