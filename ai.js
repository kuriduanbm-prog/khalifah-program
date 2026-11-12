/* KHALIFAH · ถามข้อมูล (ผู้ช่วย AI) · v19.09 (ตัวกรอง · เลือกช่วงเวลา · เทียบช่วงก่อน · แนวโน้ม · เทียบ 2 กลุ่ม · สัญญาณเตือน · ถามต่อ · รายงานรวม · ปักหมุด · พูดถาม)
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
    if (keys.indexOf('pr') !== -1 && window.k8PrayExcReady) jobs.push(Promise.resolve(window.k8PrayExcReady()).catch(() => {}));
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
    const out = { on: 0, late: 0, ex: 0, miss: 0, den: 0, pct: null, slot: {}, days: [], streak: {} };
    SLOTS.forEach((s) => { out.slot[s] = { on: 0, late: 0, ex: 0, miss: 0 }; out.streak[s] = { cur: 0, max: 0, end: '' }; });
    let wins = []; try { wins = PRAYER_TIME_WINDOWS; } catch (e) {}
    const now = new Date(); const cur = now.getHours() * 60 + now.getMinutes();
    const CX = window.k8PrayCtx ? window.k8PrayCtx() : { today: t, cur };
    for (let d = a, i = 0; d <= end && i < 400; d = addD(d, 1), i++) {
      if (new Date(d + 'T00:00:00').getDay() === 6) continue; // เสาร์ = วันหยุดประจำสัปดาห์ ไม่นับ
      let done = 0, ex = 0, of = 0;
      SLOTS.forEach((s, x) => {
        const v = R[k + '|' + d + '|' + s]; let c = window.k8PrayCell ? window.k8PrayCell(st, d, x, v ? { status: v } : null, CX) : (v ? PK(v) : 'miss');
        if (c === 'skip') return; if (c === 'per' || c === 'lv') c = 'ex'; of++;
        out[c]++; out.slot[s][c]++; if (c === 'on' || c === 'late') done++; if (c === 'ex') ex++;
        const z = out.streak[s]; if (c === 'miss') { z.cur++; if (z.cur > z.max) { z.max = z.cur; z.end = d; } } else if (c !== 'ex') z.cur = 0;
      });
      if (of) out.days.push({ d, n: done, ex, of });
      continue;
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
    o.pct = pctOf(o.present + o.late, o.present + o.late + o.absent); return o; // ไม่นับวันลา
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
  async function studentReport(sid, from, to, opt) {
    const st = studentById(sid); if (!st) return { error: 'ไม่พบนักเรียนรหัส ' + sid };
    await need(['att', 'bh', 'tt', 'lv', 'pr', 'hq'], from, to);
    const pr = prevRange(from, to); await need(['hq'], pr.from, pr.to);
    const P = prayerOf(st, from, to), A = attOf(st, from, to), B = bhOf(st, from, to), H = hqOf(st, from, to);
    const pP = prayerOf(st, pr.from, pr.to), pA = attOf(st, pr.from, pr.to), pB = bhOf(st, pr.from, pr.to), pH = hqOf(st, pr.from, pr.to);
    const prev = { from: pr.from, to: pr.to, p: pP.pct, a: pA.pct, minus: pB.minus, h: pH.pct };
    return { kind: 'student', st, from, to, topic: opt && opt.topic || 'all', P, A, B, H, prev, trend: trendOf([st], from, to), alerts: alertsOf(st, P, A, B, pP.pct), L: leavesOf(st, from, to), S: subjectsOf(st), grades: (st.grades || []).filter((x) => x && (x.grade !== '' || x.score !== '')), gpa: st.gpax || st.gpa || '' };
  }
  // ตัวกรองกลุ่ม: schools[] grades[] gender · รองรับ school/grade แบบข้อความ (เช่น "4,5")
  function normF(f) {
    f = Object.assign({}, f || {});
    let sc = Array.isArray(f.schools) ? f.schools.slice() : []; if (f.school) String(f.school).split(/\s*[,|]\s*/).filter(Boolean).forEach((x) => sc.push(x));
    sc = sc.map((x) => matchSchool(x) || x).filter((x, i, a) => x && a.indexOf(x) === i);
    let gr = Array.isArray(f.grades) ? f.grades.map(String) : []; if (f.grade) String(f.grade).split(/[^1-6]+/).filter(Boolean).forEach((x) => gr.push(x));
    gr = gr.map(gNum).filter((x, i, a) => x && a.indexOf(x) === i).sort();
    const gd = /หญิง|f|girl/i.test(String(f.gender || '')) ? 'หญิง' : /ชาย|m|boy/i.test(String(f.gender || '')) ? 'ชาย' : '';
    return { schools: sc, grades: gr, gender: gd, topic: TOPICS[f.topic] ? f.topic : 'all' };
  }
  const sexOf = (s) => { try { return (window.k8SexOf ? window.k8SexOf(s) : '') || s.gender || ''; } catch (e) { return s.gender || ''; } };
  function filterStudents(F) { return students().filter((s) => (!F.schools.length || F.schools.indexOf(schoolOf(s)) !== -1) && (!F.grades.length || F.grades.indexOf(gNum(s.grade)) !== -1) && (!F.gender || sexOf(s) === F.gender)); }
  function fTitle(F) { const p = []; p.push(F.schools.length ? F.schools.join(' + ') : 'ทุกโรงเรียน'); if (F.grades.length) p.push('ม.' + F.grades.join(', ม.')); if (F.gender) p.push('นักเรียน' + F.gender); return p.join(' · '); }
  const TOPICS = { all: 'ทุกหัวข้อ', prayer: 'ละหมาด', attendance: 'การมาเรียน', behavior: 'พฤติกรรม', halaqah: 'หะละเกาะฮฺ' };
  function prevRange(from, to) { const n = Math.round((new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 864e5) + 1; return { from: addD(from, -n), to: addD(from, -1) }; }
  const daysOf = (from, to) => Math.round((new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 864e5) + 1;
  function buckets(from, to) {
    const t = today(); const end = to < t ? to : t; const n = daysOf(from, end); if (n < 14) return null; const out = [];
    if (n <= 120) { for (let a = from; a <= end; a = addD(a, 7)) { const b = addD(a, 6) < end ? addD(a, 6) : end; out.push({ from: a, to: b, l: (+a.slice(8)) + ' ' + MTH[+a.slice(5, 7) - 1] }); } }
    else { let y = +from.slice(0, 4), m = +from.slice(5, 7) - 1; for (let i = 0; i < 40; i++) { const a0 = ymd(new Date(y, m, 1)); const b0 = ymd(new Date(y, m + 1, 0)); const a = a0 < from ? from : a0, b = b0 > end ? end : b0; if (a > end) break; out.push({ from: a, to: b, l: MTH[m] + ' ' + String(y + 543).slice(2) }); m++; if (m > 11) { m = 0; y++; } } }
    return out;
  }
  function trendOf(list, from, to) {
    const B = buckets(from, to); if (!B) return null;
    return B.map((b) => { let pOn = 0, pDen = 0, aOk = 0, aD = 0, minus = 0; list.forEach((st) => { const P = prayerOf(st, b.from, b.to); pOn += P.on + P.late; pDen += P.den; const A = attOf(st, b.from, b.to); aOk += A.present + A.late; aD += A.present + A.late + A.absent; minus += bhOf(st, b.from, b.to).minus; }); return { l: b.l, from: b.from, to: b.to, p: pctOf(pOn, pDen), a: pctOf(aOk, aD), minus }; });
  }
  function alertsOf(st, P, A, B, prevP) {
    const L = [];
    const cur = SLOTS.filter((s) => P.streak[s].cur >= 3), past = SLOTS.filter((s) => P.streak[s].cur < 3 && P.streak[s].max >= 3);
    if (cur.length) L.push({ lv: 3, t: 'ขาดละหมาดติดต่อกันถึงวันล่าสุด: ' + cur.map((s) => s + ' ' + P.streak[s].cur + ' วัน').join(' · ') });
    if (past.length) L.push({ lv: 2, t: 'เคยขาดละหมาดติดกัน 3 วันขึ้นไป: ' + past.map((s) => s + ' ' + P.streak[s].max + ' วัน (ถึง ' + dTh(P.streak[s].end) + ')').join(' · ') });
    if (P.pct != null && P.pct < 70) L.push({ lv: 2, t: 'ละหมาดรวม ' + P.pct + '% ต่ำกว่าเกณฑ์ 70%' });
    if (prevP != null && P.pct != null && prevP - P.pct >= 15) L.push({ lv: 2, t: 'ละหมาดลดลง ' + (prevP - P.pct) + '% จากช่วงก่อน' });
    if (A.absent >= 3) L.push({ lv: 2, t: 'ขาดเรียน ' + A.absent + ' ครั้งในช่วงนี้' });
    if (B.minusPts <= -10) L.push({ lv: 2, t: 'ถูกหักคะแนนพฤติกรรม ' + Math.abs(B.minusPts) + ' คะแนนในช่วงนี้' });
    if (B.score < 80) L.push({ lv: 3, t: 'คะแนนพฤติกรรมเหลือ ' + B.score + ' (ต่ำกว่า 80)' });
    return L.sort((a, b) => b.lv - a.lv);
  }
  function matchSchool(q) {
    const L = schools(); if (!q) return null; const k = (s) => String(s).replace(/โรงเรียน|รร\.?|\s/g, '').toLowerCase(); const qk = k(q);
    let best = null, bs = 0;
    L.forEach((x) => { const sk = k(x.name); let sc = 0; if (sk === qk) sc = 1000; else if (sk.indexOf(qk) !== -1) sc = 500 + qk.length; else if (qk.indexOf(sk) !== -1) sc = 400 + sk.length; else { const l = lcs(sk, qk); if (l >= 4 && l >= sk.length * 0.4) sc = l; } if (sc > bs) { bs = sc; best = x.name; } });
    return best;
  }
  function lcs(a, b) { let m = 0; const p = new Array(b.length + 1).fill(0); for (let i = 1; i <= a.length; i++) { let prev = 0; for (let j = 1; j <= b.length; j++) { const tmp = p[j]; p[j] = a[i - 1] === b[j - 1] ? prev + 1 : 0; if (p[j] > m) m = p[j]; prev = tmp; } } return m; }
  async function groupReport(f, from, to) {
    const F = normF(f); const L = filterStudents(F);
    if ((f && (f.school || (f.schools && f.schools.length))) && !L.length) return { error: 'ไม่พบนักเรียนของ "' + fTitle(F) + '"', schools: schools().map((x) => x.name) };
    const pr = prevRange(from, to);
    await need(['att', 'bh', 'pr', 'hq'], from, to); await need(['hq'], pr.from, pr.to);
    const rows = L.map((st) => ({ st, P: prayerOf(st, from, to), A: attOf(st, from, to), B: bhOf(st, from, to), H: hqOf(st, from, to) }));
    const agg = { n: rows.length, pOn: 0, pDen: 0, aOk: 0, aN: 0, sc: 0, minus: 0, low: 0, hOk: 0, hN: 0, slot: {}, byG: {}, dist: { hi: 0, mid: 0, lo: 0, na: 0 }, abs: 0, late: 0 };
    SLOTS.forEach((s) => { agg.slot[s] = { ok: 0, den: 0 }; });
    rows.forEach((r) => {
      agg.pOn += r.P.on + r.P.late; agg.pDen += r.P.den; agg.aOk += r.A.present + r.A.late; agg.aN += r.A.present + r.A.late + r.A.absent; agg.aChk = (agg.aChk || 0) + r.A.n; agg.lv = (agg.lv || 0) + r.A.leave; agg.abs += r.A.absent; agg.late += r.A.late;
      agg.sc += r.B.score; agg.minus += r.B.minus; if (r.B.score < 80) agg.low++;
      agg.hOk += r.H.c.present + r.H.c.late; agg.hN += r.H.c.present + r.H.c.late + r.H.c.absent + r.H.c.none;
      SLOTS.forEach((s) => { const x = r.P.slot[s]; agg.slot[s].ok += x.on + x.late; agg.slot[s].den += x.on + x.late + x.miss; });
      const p = r.P.pct; agg.dist[p == null ? 'na' : p >= 90 ? 'hi' : p >= 70 ? 'mid' : 'lo']++;
      const g = shortG(r.st.grade) || 'ไม่ระบุชั้น'; const b = agg.byG[g] || (agg.byG[g] = { n: 0, pOn: 0, pDen: 0, aOk: 0, aN: 0, sc: 0 }); b.n++; b.pOn += r.P.on + r.P.late; b.pDen += r.P.den; b.aOk += r.A.present + r.A.late; b.aN += r.A.present + r.A.late + r.A.absent; b.sc += r.B.score;
    });
    agg.pPct = pctOf(agg.pOn, agg.pDen); agg.aPct = pctOf(agg.aOk, agg.aN); agg.scAvg = rows.length ? Math.round(agg.sc / rows.length) : null; agg.hPct = pctOf(agg.hOk, agg.hN);
    // ช่วงก่อนหน้า (เทียบ) + แนวโน้ม + สัญญาณเตือนรายคน
    let ppOn = 0, ppDen = 0, paOk = 0, paD = 0, psc = 0, pmin = 0, phOk = 0, phN = 0;
    rows.forEach((r) => { const P2 = prayerOf(r.st, pr.from, pr.to), A2 = attOf(r.st, pr.from, pr.to), B2 = bhOf(r.st, pr.from, pr.to), H2 = hqOf(r.st, pr.from, pr.to); r.prevP = P2.pct; ppOn += P2.on + P2.late; ppDen += P2.den; paOk += A2.present + A2.late; paD += A2.present + A2.late + A2.absent; psc += B2.score; pmin += B2.minus; phOk += H2.c.present + H2.c.late; phN += H2.c.present + H2.c.late + H2.c.absent + H2.c.none; r.alerts = alertsOf(r.st, r.P, r.A, r.B, P2.pct); });
    const prev = { from: pr.from, to: pr.to, p: pctOf(ppOn, ppDen), a: pctOf(paOk, paD), sc: rows.length ? Math.round(psc / rows.length) : null, minus: pmin, h: pctOf(phOk, phN) };
    const alerts = []; rows.forEach((r) => r.alerts.forEach((x) => alerts.push({ lv: x.lv, t: x.t, st: r.st }))); alerts.sort((x, y) => y.lv - x.lv || nameOf(x.st).localeCompare(nameOf(y.st), 'th'));
    return { kind: 'group', F, school: F.schools.length === 1 ? F.schools[0] : '', grade: F.grades.join(','), title: fTitle(F), from, to, topic: F.topic, rows, agg, prev, alerts, trend: rows.length <= 400 ? trendOf(L, from, to) : null };
  }
  const METRIC = {
    prayer: { l: 'ละหมาด', v: (r) => r.P.pct, txt: (r) => pctTxt(r.P.pct) + ' (ละหมาด ' + (r.P.on + r.P.late) + ' · ลา/อุซุร ' + r.P.ex + ' · ขาด ' + r.P.miss + ')' },
    attendance: { l: 'การมาเรียน', v: (r) => r.A.pct, txt: (r) => pctTxt(r.A.pct) + ' (มา ' + r.A.present + ' · สาย ' + r.A.late + ' · ลา ' + r.A.leave + ' · ขาด ' + r.A.absent + ')' },
    behavior: { l: 'คะแนนพฤติกรรม', v: (r) => r.B.score, txt: (r) => r.B.score + ' คะแนน (ถูกหัก ' + r.B.minus + ' ครั้ง)' },
    halaqah: { l: 'หะละเกาะฮฺ', v: (r) => r.H.pct, txt: (r) => pctTxt(r.H.pct) }
  };
  async function rankReport(f, from, to) {
    f = f || {}; const m = METRIC[f.metric] ? f.metric : 'prayer'; const G = await groupReport(f, from, to); if (G.error) return G;
    const best = f.order === 'best'; const lim = Math.max(1, Math.min(50, Number(f.limit) || 10));
    const L = G.rows.filter((r) => METRIC[m].v(r) != null).sort((a, b) => (best ? -1 : 1) * (METRIC[m].v(a) - METRIC[m].v(b)) || nameOf(a.st).localeCompare(nameOf(b.st), 'th')).slice(0, lim);
    return { kind: 'rank', metric: m, order: best ? 'best' : 'worst', title: METRIC[m].l + (best ? ' สูงสุด ' : ' ต่ำสุด ') + L.length + ' คน · ' + G.title, from, to, rows: L, group: G };
  }
  async function compareReport(fa, fb, from, to) {
    const A = await groupReport(fa, from, to); if (A.error) return A; const B = await groupReport(fb, from, to); if (B.error) return B;
    return { kind: 'compare', from, to, A, B, title: A.title + '  เทียบกับ  ' + B.title };
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
        grades: rep.grades.slice(0, 25).map((x) => ({ subject: x.name || x.code, grade: x.grade, score: x.score })), gpa: rep.gpa,
        previous_period: rep.prev ? { from: rep.prev.from, to: rep.prev.to, prayer_percent: rep.prev.p, attendance_percent: rep.prev.a, behavior_deductions: rep.prev.minus, halaqah_percent: rep.prev.h } : null,
        alerts: (rep.alerts || []).map((x) => x.t), trend: rep.trend ? rep.trend.map((b) => ({ period: b.l, prayer: b.p, attendance: b.a, deductions: b.minus })) : null };
    }
    if (rep.kind === 'group') {
      const a = rep.agg;
      return { scope: rep.title, range: { from: rep.from, to: rep.to }, students: a.n,
        prayer_percent: a.pPct, attendance_percent: a.aPct, behavior_avg: a.scAvg, halaqah_percent: a.hPct, behavior_below_80: a.low, deductions_in_range: a.minus, absences: a.abs, lates: a.late,
        prayer_by_slot_percent: Object.fromEntries(SLOTS.map((s) => [s, pctOf(a.slot[s].ok, a.slot[s].den)])),
        prayer_distribution: { '90%+': a.dist.hi, '70-89%': a.dist.mid, 'below 70%': a.dist.lo },
        by_grade: Object.fromEntries(Object.keys(a.byG).sort().map((g) => { const b = a.byG[g]; return [g, { students: b.n, prayer: pctOf(b.pOn, b.pDen), attendance: pctOf(b.aOk, b.aN), behavior_avg: Math.round(b.sc / b.n) }]; })),
        students_list: rep.rows.slice().sort((x, y) => (x.P.pct ?? 999) - (y.P.pct ?? 999)).slice(0, 60).map((r) => ({ id: r.st.studentId, name: nameOf(r.st), grade: shortG(r.st.grade), prayer: r.P.pct, attendance: r.A.pct, behavior: r.B.score, halaqah: r.H.pct })),
        previous_period: rep.prev ? { from: rep.prev.from, to: rep.prev.to, prayer_percent: rep.prev.p, attendance_percent: rep.prev.a, behavior_avg: rep.prev.sc, deductions: rep.prev.minus, halaqah_percent: rep.prev.h } : null,
        alerts: (rep.alerts || []).slice(0, 20).map((x) => nameOf(x.st) + ': ' + x.t), trend: rep.trend ? rep.trend.map((b) => ({ period: b.l, prayer: b.p, attendance: b.a, deductions: b.minus })) : null };
    }
    if (rep.kind === 'compare') return { compare: true, A: compact(rep.A), B: compact(rep.B) };
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
    return '<div class="k8ai-hb">' + items.map((x) => '<div class="k8ai-hbr ' + (x.t || '') + '"><span>' + esc(x.l) + '</span><i><i style="width:' + Math.max(0, Math.min(100, x.v || 0)) + '%"></i></i><b>' + (x.v == null ? '–' : x.v + (x.u != null ? x.u : unit == null ? '%' : unit)) + '</b>' + (x.s ? '<small>' + esc(x.s) + '</small>' : '') + '</div>').join('') + '</div>';
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
  function lineChart(T, series) {
    if (!T || T.length < 2) return '';
    const W = 640, H = 150, L = 34, R = 10, top = 10; const iw = W - L - R; const n = T.length; const xs = (i) => L + (n === 1 ? iw / 2 : i * iw / (n - 1)); const ys = (v) => top + (100 - v) / 100 * (H - top);
    const step = Math.ceil(n / 8);
    let g = [0, 50, 100].map((v) => '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + ys(v).toFixed(1) + '" y2="' + ys(v).toFixed(1) + '" class="k8ai-grid"/><text x="' + (L - 6) + '" y="' + (ys(v) + 4).toFixed(1) + '" text-anchor="end" class="k8ai-ax">' + v + '%</text>').join('');
    g += T.map((b, i) => i % step === 0 || i === n - 1 ? '<text x="' + xs(i).toFixed(1) + '" y="' + (H + 18) + '" text-anchor="middle" class="k8ai-ax">' + esc(b.l) + '</text>' : '').join('');
    series.forEach((se) => {
      const pts = T.map((b, i) => b[se.k] == null ? null : [xs(i), ys(b[se.k]), b[se.k], b.l]);
      let d = '', pen = false; pts.forEach((p) => { if (!p) { pen = false; return; } d += (pen ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); pen = true; });
      g += '<path d="' + d + '" fill="none" stroke="' + se.c + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' + pts.map((p) => p ? '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.5" fill="#fff" stroke="' + se.c + '" stroke-width="2"><title>' + esc(se.l + ' ' + p[3] + ': ' + p[2] + '%') + '</title></circle>' : '').join('');
    });
    return '<div class="k8ai-line"><svg viewBox="0 0 ' + W + ' ' + (H + 26) + '" role="img" aria-label="กราฟแนวโน้ม">' + g + '</svg><p class="k8ai-cap">' + series.map((se) => '<i style="background:' + se.c + '"></i>' + se.l).join(' ') + '</p></div>';
  }
  const SER = [{ k: 'p', l: 'ละหมาด', c: '#0369a1' }, { k: 'a', l: 'มาเรียน', c: '#0d9488' }];
  function delta(cur, prev, unit, label) {
    if (cur == null || prev == null) return '';
    const d = Math.round(cur - prev); if (!d) return '<em class="k8ai-d">เท่าเดิม' + (label ? ' ' + label : '') + '</em>';
    return '<em class="k8ai-d ' + (d > 0 ? 'is-up' : 'is-down') + '">' + (d > 0 ? '▲ ' : '▼ ') + Math.abs(d) + (unit == null ? '%' : unit) + (label ? ' ' + label : '') + '</em>';
  }
  const kpi = (l, v, s, t, dl) => '<div class="k8ai-k ' + (t || '') + '"><small>' + esc(l) + '</small><b>' + esc(v) + '</b>' + (dl || '') + (s ? '<span>' + esc(s) + '</span>' : '') + '</div>';
  const IC = {
    pin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5M9 3h6l-1 7 4 3H6l4-3z"/></svg>',
    add: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 12v6M9 15h6"/></svg>',
    warn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    user: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>',
    sch: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18M5 21V10l7-5 7 5v11"/><path d="M9 21v-5h6v5"/></svg>',
    rank: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/></svg>',
    cmp: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>'
  };

  // ================= การ์ดผลลัพธ์ =================
  const CARDS = {}; let cardSeq = 0;
  const showSec = (rep, k) => !rep.topic || rep.topic === 'all' || rep.topic === k;
  function cardHead(id, icon, title, sub, rep) {
    return '<header class="k8ai-ch"><span class="k8ai-av">' + icon + '</span><div><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></div>' +
      '<div class="k8ai-cha"><em>' + esc(rangeTxt(rep.from, rep.to)) + (rep.topic && rep.topic !== 'all' ? ' · ' + esc(TOPICS[rep.topic]) : '') + '</em>' +
      '<button type="button" class="k8ai-ib" onclick="k8AiPin(\'' + id + '\', this)" aria-pressed="false" title="ปักหมุดรายงานนี้">' + IC.pin + '<span>ปักหมุด</span></button>' +
      '<button type="button" class="k8ai-ib" onclick="k8AiBasket(\'' + id + '\', this)" aria-pressed="false" title="เพิ่มในรายงานรวม">' + IC.add + '<span>รายงานรวม</span></button></div></header>';
  }
  function cardShell(rep, inner, aiText) { const id = rep.__id; CARDS[id] = { rep, aiText: aiText || '' }; return '<article class="k8ai-card" data-card="' + id + '">' + inner + exportBar(id) + '</article>'; }
  function exportBar(id) {
    const F = [['xlsx', 'Excel'], ['doc', 'Word'], ['pdf', 'PDF'], ['jpg', 'JPG']];
    return '<footer class="k8ai-x"><span>บันทึกเป็น</span><div class="k8ai-xf">' + F.map(([k, l]) => '<label><input type="checkbox" value="' + k + '"' + (k === 'pdf' ? ' checked' : '') + '><i>' + l + '</i></label>').join('') + '</div><button type="button" onclick="k8AiExport(\'' + id + '\', this)">บันทึกไฟล์</button></footer>';
  }
  function alertBox(list, withName) {
    if (!list || !list.length) return '';
    const top = list.slice(0, 6);
    const li = (x) => '<li class="lv' + x.lv + '">' + (withName ? '<button type="button" class="k8ai-who" onclick="k8AiAskStudent(\'' + esc(x.st.studentId) + '\')">' + esc(nameOf(x.st)) + '</button> · ' : '') + esc(x.t) + '</li>';
    return '<section class="k8ai-alert"><h4>' + IC.warn + 'ข้อควรระวัง <small>' + list.length + ' รายการ</small></h4><ul>' + top.map(li).join('') + '</ul>' +
      (list.length > 6 ? '<details><summary>ดูทั้งหมด ' + list.length + ' รายการ</summary><ul>' + list.slice(6, 80).map(li).join('') + '</ul></details>' : '') + '</section>';
  }
  function trendSec(rep) {
    if (!rep.trend || rep.trend.length < 2) return '';
    const wk = rep.trend.length && daysOf(rep.trend[0].from, rep.trend[0].to) <= 7;
    return '<section class="k8ai-sec"><h4>แนวโน้ม' + (wk ? 'รายสัปดาห์' : 'รายเดือน') + '</h4>' + lineChart(rep.trend, SER) + '</section>';
  }
  function studentCard(rep, aiText) {
    const s = rep.st, P = rep.P, A = rep.A, B = rep.B, H = rep.H, pv = rep.prev || {};
    let h = cardHead(rep.__id, IC.user, nameOf(s), shortG(s.grade) + ' · ' + s.studentId + ' · ' + schoolOf(s), rep);
    h += '<div class="k8ai-ks">' + kpi('ละหมาด', pctTxt(P.pct), (P.on + P.late) + ' จาก ' + P.den + ' เวลา', tone(P.pct, 90, 70), delta(P.pct, pv.p)) +
      kpi('มาเรียน', A.n && A.pct == null ? 'ลาทั้งหมด' : pctTxt(A.pct), A.n ? 'มา ' + (A.present + A.late) + ' · ลา ' + A.leave + ' · ขาด ' + A.absent : 'ยังไม่มีการเช็คชื่อ', tone(A.pct, 90, 80), delta(A.pct, pv.a)) +
      kpi('พฤติกรรม', String(B.score), 'ช่วงนี้ถูกหัก ' + B.minus + ' ครั้ง', tone(B.score, 90, 80)) +
      kpi('หะละเกาะฮฺ', pctTxt(H.pct), H.n ? H.n + ' ครั้ง' : 'ไม่มีข้อมูล', tone(H.pct, 90, 70), delta(H.pct, pv.h)) + '</div>';
    if (rep.prev) h += '<p class="k8ai-cmpnote">ลูกศร ▲▼ เทียบกับช่วงก่อนหน้า ' + esc(rangeTxt(rep.prev.from, rep.prev.to)) + '</p>';
    h += alertBox(rep.alerts, false);
    if (showSec(rep, 'prayer') || showSec(rep, 'attendance')) h += trendSec(rep);
    if (showSec(rep, 'prayer')) h += '<section class="k8ai-sec"><h4>การละหมาด</h4><div class="k8ai-row">' + donut([{ l: 'ตรงเวลา', v: P.on, c: '#16a34a' }, { l: 'สาย', v: P.late, c: '#f59e0b' }, { l: 'ลา/อุซุร', v: P.ex, c: '#93c5fd' }, { l: 'ไม่ได้เช็ค/ขาด', v: P.miss, c: '#ef4444' }], pctTxt(P.pct), 'ละหมาด') +
      '<div class="k8ai-grow"><h5>แยกตามเวลา</h5>' + hbars(SLOTS.map((k) => { const x = P.slot[k]; const p = pctOf(x.on + x.late, x.on + x.late + x.miss); return { l: k, v: p, t: tone(p, 90, 70), s: 'ละหมาด ' + (x.on + x.late) + ' · ลา/อุซุร ' + x.ex + ' · ขาด ' + x.miss }; })) + '</div></div>' +
      (P.days.length > 1 ? '<h5>รายวัน (จำนวนเวลาที่ละหมาด)</h5>' + cols(P.days) : '') + '</section>';
    const subj = Object.keys(A.subj); const ATT = [['present', 'มา', '#16a34a'], ['late', 'สาย', '#f59e0b'], ['leave', 'ลา', '#93c5fd'], ['absent', 'ขาด', '#ef4444']];
    if (showSec(rep, 'attendance')) h += '<section class="k8ai-sec"><h4>การมาเรียน <small>ร้อยละไม่นับวันลา</small></h4>' + (A.n ? '<div class="k8ai-stack" role="img" aria-label="' + ATT.map(([k, l]) => l + ' ' + A[k]).join(' ') + '">' + ATT.map(([k, l, c]) => A[k] ? '<i style="flex:' + A[k] + ';background:' + c + '" title="' + l + ' ' + A[k] + '"></i>' : '').join('') + '</div><p class="k8ai-cap">' + ATT.map(([k, l, c]) => '<i style="background:' + c + '"></i>' + l + ' ' + A[k]).join(' ') + '</p>' +
      (subj.length > 1 || (subj[0] && subj[0] !== 'เช็คชื่อรายวัน') ? '<h5>รายวิชา</h5>' + hbars(subj.sort((a, b) => A.subj[b].n - A.subj[a].n).slice(0, 12).map((k) => { const x = A.subj[k]; const p = pctOf(x.present + x.late, x.present + x.late + x.absent); return { l: k, v: p, t: tone(p, 90, 80), s: 'มา ' + x.present + ' · สาย ' + x.late + ' · ลา ' + x.leave + ' · ขาด ' + x.absent }; })) : '') : '<p class="k8ai-empty">ยังไม่มีการเช็คชื่อในช่วงนี้</p>') + '</section>';
    if (showSec(rep, 'behavior')) h += '<section class="k8ai-sec"><h4>พฤติกรรม <small>คะแนนภาคเรียน ' + B.score + ' · ช่วงนี้ถูกหัก ' + B.minus + ' ครั้ง (' + B.minusPts + ') · ได้เพิ่ม ' + B.plus + ' ครั้ง</small></h4>' +
      (B.items.length ? '<ul class="k8ai-list">' + B.items.slice(0, 12).map((l) => { const p = Number(l.points) || 0; return '<li><span>' + esc(dTh(l.date)) + '</span><b>' + esc(l.title || l.ruleTitle || '-') + '</b><em class="' + (p < 0 ? 'is-bad' : 'is-ok') + '">' + (p > 0 ? '+' : '') + p + '</em></li>'; }).join('') + '</ul>' + (B.items.length > 12 ? '<p class="k8ai-more">และอีก ' + (B.items.length - 12) + ' รายการ (ดูทั้งหมดในไฟล์ที่ส่งออก)</p>' : '') : '<p class="k8ai-empty">ไม่มีรายการพฤติกรรมในช่วงนี้</p>') + '</section>';
    if (showSec(rep, 'halaqah') || rep.topic === 'all') h += '<section class="k8ai-sec k8ai-two"><div><h4>หะละเกาะฮฺ</h4>' + (H.n ? hbars([{ l: 'มา', v: H.c.present, t: 'is-ok' }, { l: 'สาย', v: H.c.late, t: 'is-mid' }, { l: 'ลา', v: H.c.leave }, { l: 'ขาด', v: H.c.absent + H.c.none, t: 'is-bad' }].map((x) => ({ l: x.l, v: H.n ? Math.round(x.v / H.n * 100) : 0, t: x.t, s: x.v + ' ครั้ง' }))) + (H.groups.length ? '<p class="k8ai-cap">' + esc(H.groups.join(' · ')) + '</p>' : '') : '<p class="k8ai-empty">ไม่มีข้อมูลหะละเกาะฮฺในช่วงนี้</p>') + '</div>' +
      '<div><h4>การลา</h4>' + (rep.L.length ? '<ul class="k8ai-list">' + rep.L.slice(0, 6).map((x) => '<li><span>' + esc(rangeTxt(x.from, x.to || x.from)) + '</span><b>' + esc(x.type || 'ลา') + '</b><em>' + esc(x.where || '') + '</em></li>').join('') + '</ul>' : '<p class="k8ai-empty">ไม่มีการลาในช่วงนี้</p>') + '</div></section>';
    if (rep.topic === 'all') h += '<section class="k8ai-sec"><h4>วิชาที่เรียน' + (rep.gpa ? ' <small>เกรดเฉลี่ย ' + esc(rep.gpa) + '</small>' : '') + '</h4>' + (rep.S.length ? '<div class="k8ai-chips">' + rep.S.map((x) => { const g = rep.grades.find((y) => y.name === x.sn || y.code === x.sn); return '<span><b>' + esc(x.sn) + '</b>' + (x.tn ? '<small>' + esc(x.tn) + '</small>' : '') + '<small>' + x.n + ' คาบ/สัปดาห์' + (x.other ? ' · เรียนร่วม ม.' + esc(x.other) : '') + '</small>' + (g && g.grade !== '' ? '<em>เกรด ' + esc(g.grade) + '</em>' : '') + '</span>'; }).join('') + '</div>' : (rep.grades.length ? '' : '<p class="k8ai-empty">ยังไม่มีวิชาในตารางสอน</p>')) +
      (rep.grades.length && !rep.S.length ? '<div class="k8ai-chips">' + rep.grades.map((g) => '<span><b>' + esc(g.name || g.code) + '</b><em>เกรด ' + esc(g.grade) + '</em><small>คะแนน ' + esc(g.score) + '</small></span>').join('') + '</div>' : '') + '</section>';
    h += '<p class="k8ai-acts"><button type="button" onclick="k8AiWho(\'' + esc(s.studentId) + '\')">เปิดประวัติในหน้านักเรียน ›</button></p>';
    return cardShell(rep, h, aiText);
  }
  function groupCard(rep, aiText) {
    const a = rep.agg, pv = rep.prev || {};
    let h = cardHead(rep.__id, IC.sch, rep.title, 'นักเรียน ' + a.n + ' คน', rep);
    if (!a.n) return cardShell(rep, h + '<p class="k8ai-empty">ไม่มีนักเรียนตามตัวกรองนี้</p>', aiText);
    h += '<div class="k8ai-ks">' + kpi('ละหมาด', pctTxt(a.pPct), a.pOn + ' จาก ' + a.pDen + ' เวลา', tone(a.pPct, 90, 70), delta(a.pPct, pv.p)) + kpi('มาเรียน', pctTxt(a.aPct), a.aChk ? 'ขาด ' + a.abs + ' · สาย ' + a.late + ' · ลา ' + (a.lv || 0) : 'ยังไม่มีการเช็คชื่อ', tone(a.aPct, 90, 80), delta(a.aPct, pv.a)) + kpi('พฤติกรรมเฉลี่ย', a.scAvg == null ? '–' : String(a.scAvg), 'ต่ำกว่า 80: ' + a.low + ' คน', tone(a.scAvg, 90, 80)) + kpi('หะละเกาะฮฺ', pctTxt(a.hPct), a.hN ? a.hN + ' ครั้ง' : 'ไม่มีข้อมูล', tone(a.hPct, 90, 70), delta(a.hPct, pv.h)) + '</div>';
    if (rep.prev) h += '<p class="k8ai-cmpnote">ลูกศร ▲▼ เทียบกับช่วงก่อนหน้า ' + esc(rangeTxt(rep.prev.from, rep.prev.to)) + '</p>';
    h += alertBox(rep.alerts, true);
    h += trendSec(rep);
    const G = Object.keys(a.byG).sort();
    if (showSec(rep, 'prayer')) h += '<section class="k8ai-sec"><h4>การละหมาด</h4><div class="k8ai-row">' + donut([{ l: '90% ขึ้นไป', v: a.dist.hi, c: '#16a34a' }, { l: '70–89%', v: a.dist.mid, c: '#f59e0b' }, { l: 'ต่ำกว่า 70%', v: a.dist.lo, c: '#ef4444' }], String(a.n), 'คน') +
      '<div class="k8ai-grow"><h5>แยกตามเวลา</h5>' + hbars(SLOTS.map((s) => { const p = pctOf(a.slot[s].ok, a.slot[s].den); return { l: s, v: p, t: tone(p, 90, 70), s: a.slot[s].ok + ' จาก ' + a.slot[s].den + ' เวลา' }; })) + '</div></div></section>';
    if (G.length > 1) h += '<section class="k8ai-sec"><h4>เทียบรายชั้น</h4><div class="k8ai-gg">' + G.map((g) => { const b = a.byG[g]; const pp = pctOf(b.pOn, b.pDen), ap = pctOf(b.aOk, b.aN), sc = Math.round(b.sc / b.n); return '<div><b>' + esc(g) + ' <small>' + b.n + ' คน</small></b>' + hbars([showSec(rep, 'prayer') && { l: 'ละหมาด', v: pp, t: tone(pp, 90, 70) }, showSec(rep, 'attendance') && { l: 'มาเรียน', v: ap, t: tone(ap, 90, 80) }, showSec(rep, 'behavior') && { l: 'พฤติกรรม', v: sc, t: tone(sc, 90, 80), u: '' }].filter(Boolean)) + '</div>'; }).join('') + '</div></section>';
    const R = rep.rows.slice().sort((x, y) => String(x.st.grade).localeCompare(String(y.st.grade), 'th') || nameOf(x.st).localeCompare(nameOf(y.st), 'th'));
    const C = [['prayer', 'ละหมาด', (r) => pctTxt(r.P.pct), (r) => tone(r.P.pct, 90, 70)], ['attendance', 'มาเรียน', (r) => pctTxt(r.A.pct), (r) => tone(r.A.pct, 90, 80)], ['behavior', 'พฤติกรรม', (r) => r.B.score, (r) => tone(r.B.score, 90, 80)], ['halaqah', 'หะละเกาะฮฺ', (r) => pctTxt(r.H.pct), (r) => tone(r.H.pct, 90, 70)]].filter((c) => showSec(rep, c[0]));
    h += '<details class="k8ai-sec k8ai-det"' + (R.length <= 12 ? ' open' : '') + '><summary>รายชื่อนักเรียนทั้งหมด ' + R.length + ' คน</summary><div class="k8ai-tw"><table class="k8ai-t"><thead><tr><th>นักเรียน</th><th>ชั้น</th>' + C.map((c) => '<th>' + c[1] + '</th>').join('') + '</tr></thead><tbody>' +
      R.map((r) => '<tr><td><button type="button" class="k8ai-who" onclick="k8AiAskStudent(\'' + esc(r.st.studentId) + '\')">' + esc(nameOf(r.st)) + '</button>' + (r.alerts.length ? ' <i class="k8ai-dot" title="' + esc(r.alerts.map((x) => x.t).join(' · ')) + '"></i>' : '') + '</td><td>' + esc(shortG(r.st.grade)) + '</td>' + C.map((c) => '<td class="' + c[3](r) + '">' + c[2](r) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div></details>';
    return cardShell(rep, h, aiText);
  }
  function rankCard(rep, aiText) {
    const M = METRIC[rep.metric];
    let h = cardHead(rep.__id, IC.rank, rep.title, M.l + (rep.order === 'best' ? ' · สูงสุด' : ' · ต่ำสุด'), rep);
    h += rep.rows.length ? '<ol class="k8ai-rank">' + rep.rows.map((r) => { const v = M.v(r); const t = rep.metric === 'behavior' ? tone(v, 90, 80) : tone(v, 90, 70); return '<li><div><button type="button" class="k8ai-who" onclick="k8AiAskStudent(\'' + esc(r.st.studentId) + '\')">' + esc(nameOf(r.st)) + '</button><small>' + esc(shortG(r.st.grade)) + ' · ' + esc(schoolOf(r.st)) + '</small></div><div class="k8ai-hbr ' + t + '"><i><i style="width:' + Math.max(0, Math.min(100, v || 0)) + '%"></i></i><b>' + esc(M.txt(r)) + '</b></div></li>'; }).join('') + '</ol>' : '<p class="k8ai-empty">ไม่มีข้อมูลในช่วงนี้</p>';
    return cardShell(rep, h, aiText);
  }
  function compareCard(rep, aiText) {
    const A = rep.A, B = rep.B, a = A.agg, b = B.agg;
    let h = cardHead(rep.__id, IC.cmp, 'เทียบ 2 กลุ่ม', A.title + '  กับ  ' + B.title, rep);
    const row = (l, va, vb, unit) => { const ma = va == null ? 0 : va, mb = vb == null ? 0 : vb; const win = va != null && vb != null && va !== vb ? (va > vb ? 'a' : 'b') : ''; return '<div class="k8ai-cr"><span>' + esc(l) + '</span><div><i class="ca"><i style="width:' + Math.min(100, ma) + '%"></i></i><b class="' + (win === 'a' ? 'is-win' : '') + '">' + (va == null ? '–' : va + (unit == null ? '%' : unit)) + '</b></div><div><i class="cb"><i style="width:' + Math.min(100, mb) + '%"></i></i><b class="' + (win === 'b' ? 'is-win' : '') + '">' + (vb == null ? '–' : vb + (unit == null ? '%' : unit)) + '</b></div></div>'; };
    h += '<div class="k8ai-cmp"><div class="k8ai-crh"><span></span><b><i class="ca"></i>' + esc(A.title) + ' <small>' + a.n + ' คน</small></b><b><i class="cb"></i>' + esc(B.title) + ' <small>' + b.n + ' คน</small></b></div>' +
      row('ละหมาด', a.pPct, b.pPct) + row('มาเรียน', a.aPct, b.aPct) + row('พฤติกรรมเฉลี่ย', a.scAvg, b.scAvg, '') + row('หะละเกาะฮฺ', a.hPct, b.hPct) +
      '<h5>ละหมาดแยกตามเวลา</h5>' + SLOTS.map((s) => row(s, pctOf(a.slot[s].ok, a.slot[s].den), pctOf(b.slot[s].ok, b.slot[s].den))).join('') +
      row('ละหมาดต่ำกว่า 70% (คน)', a.dist.lo, b.dist.lo, ' คน') + row('พฤติกรรมต่ำกว่า 80 (คน)', a.low, b.low, ' คน') + '</div>';
    return cardShell(rep, h, aiText);
  }
  function chooserCard(list, q) {
    return '<article class="k8ai-card k8ai-choose"><p>พบนักเรียนที่ชื่อคล้าย "' + esc(q) + '" หลายคน เลือกคนที่ต้องการ:</p><div>' + list.map((s) => '<button type="button" onclick="k8AiAskStudent(\'' + esc(s.studentId) + '\')"><b>' + esc(nameOf(s)) + '</b><small>' + esc(shortG(s.grade)) + ' · ' + esc(s.studentId) + ' · ' + esc(schoolOf(s)) + '</small></button>').join('') + '</div></article>';
  }
  function renderRep(rep, aiText) {
    if (!rep || rep.error) return ''; if (!rep.__id) rep.__id = 'c' + (++cardSeq);
    const html = rep.kind === 'student' ? studentCard(rep, aiText) : rep.kind === 'group' ? groupCard(rep, aiText) : rep.kind === 'rank' ? rankCard(rep, aiText) : rep.kind === 'compare' ? compareCard(rep, aiText) : '';
    return html + followUps(rep);
  }
  // ปุ่มถามต่อ (ทำงานทันที ไม่ต้องรอ AI)
  function followUps(rep) {
    const L = []; const sp = rep.spec || {};
    const pr = prevRange(rep.from, rep.to);
    if (rep.kind === 'student') {
      L.push(['เทียบกับช่วงก่อนหน้า', { t: 'student', sid: rep.st.studentId, r: pr, topic: rep.topic }]);
      L.push(['เพื่อนร่วมชั้นทั้งหมด', { t: 'group', f: { schools: [schoolOf(rep.st)], grades: [gNum(rep.st.grade)] }, r: { from: rep.from, to: rep.to } }]);
      if (rep.topic === 'all') { L.push(['ดูเฉพาะละหมาด', { t: 'student', sid: rep.st.studentId, r: { from: rep.from, to: rep.to }, topic: 'prayer' }]); L.push(['ดูเฉพาะพฤติกรรม', { t: 'student', sid: rep.st.studentId, r: { from: rep.from, to: rep.to }, topic: 'behavior' }]); }
    } else if (rep.kind === 'group') {
      const f = rep.F;
      L.push(['ใครละหมาดต่ำสุด', { t: 'rank', f: Object.assign({ metric: 'prayer', order: 'worst' }, f), r: { from: rep.from, to: rep.to } }]);
      L.push(['ใครขาดเรียนมากสุด', { t: 'rank', f: Object.assign({ metric: 'attendance', order: 'worst' }, f), r: { from: rep.from, to: rep.to } }]);
      L.push(['พฤติกรรมดีที่สุด', { t: 'rank', f: Object.assign({ metric: 'behavior', order: 'best' }, f), r: { from: rep.from, to: rep.to } }]);
      L.push(['ดูช่วงก่อนหน้า', { t: 'group', f, r: pr }]);
      if (!f.grades.length) Object.keys(rep.agg.byG).sort().slice(0, 6).forEach((g) => { const n = gNum(g); if (n) L.push(['เฉพาะ ' + g, { t: 'group', f: Object.assign({}, f, { grades: [n] }), r: { from: rep.from, to: rep.to } }]); });
    } else if (rep.kind === 'rank') {
      L.push(['ดูสรุปทั้งกลุ่ม', { t: 'group', f: rep.group.F, r: { from: rep.from, to: rep.to } }]);
      if (rep.rows[0]) L.push(['ดูข้อมูล ' + bare(rep.rows[0].st).split(' ')[0], { t: 'student', sid: rep.rows[0].st.studentId, r: { from: rep.from, to: rep.to } }]);
      L.push([rep.order === 'best' ? 'ดูอันดับต่ำสุด' : 'ดูอันดับสูงสุด', { t: 'rank', f: Object.assign({}, rep.group.F, { metric: rep.metric, order: rep.order === 'best' ? 'worst' : 'best' }), r: { from: rep.from, to: rep.to } }]);
    } else if (rep.kind === 'compare') {
      L.push(['ดูสรุป ' + rep.A.title, { t: 'group', f: rep.A.F, r: { from: rep.from, to: rep.to } }]); L.push(['ดูสรุป ' + rep.B.title, { t: 'group', f: rep.B.F, r: { from: rep.from, to: rep.to } }]);
    }
    if (!L.length) return '';
    return '<div class="k8ai-fu"><span>ถามต่อ</span>' + L.map(([l, spec]) => '<button type="button" onclick="k8AiAct(' + esc(JSON.stringify(JSON.stringify(spec))) + ', ' + esc(JSON.stringify(l)) + ')">' + esc(l) + '</button>').join('') + '</div>';
  }

  // ================= ข้อมูลสำหรับไฟล์ส่งออก =================
  function stripMd(t) { return String(t || '').replace(/\*\*|__|`/g, '').replace(/^#+\s*/gm, '').replace(/^\s*[-*•]\s+/gm, '• ').trim(); }
  function extraSecs(rep, sections, withName) {
    if (rep.alerts && rep.alerts.length) sections.push({ key: 'al', title: 'ข้อควรระวัง', color: '#b45309', cols: withName ? [['ที่', 6, 'c'], ['นักเรียน', 34, 'l'], ['ชั้น', 8, 'c'], ['เรื่อง', 52, 'l']] : [['ที่', 8, 'c'], ['เรื่อง', 92, 'l']], rows: rep.alerts.slice(0, 200).map((x, i) => ({ v: withName ? [i + 1, nameOf(x.st), shortG(x.st.grade), x.t] : [i + 1, x.t], bad: x.lv >= 3 ? [withName ? 3 : 1] : [] })) });
    if (rep.trend && rep.trend.length > 1) sections.push({ key: 'tr', title: 'แนวโน้ม' + (daysOf(rep.trend[0].from, rep.trend[0].to) <= 7 ? 'รายสัปดาห์' : 'รายเดือน'), color: '#0369a1', cols: [['ช่วง', 28, 'c'], ['ละหมาด %', 24, 'c'], ['มาเรียน %', 24, 'c'], ['ถูกหักพฤติกรรม (ครั้ง)', 24, 'c']], rows: rep.trend.map((b) => ({ v: [rangeTxt(b.from, b.to), b.p == null ? '–' : b.p, b.a == null ? '–' : b.a, b.minus], bad: [b.p != null && b.p < 70 ? 1 : -1, b.a != null && b.a < 80 ? 2 : -1] })) });
  }
  const dTxt = (cur, prev, unit) => (cur == null || prev == null) ? '' : (Math.round(cur - prev) === 0 ? ' · เท่าช่วงก่อน' : ' · ' + (cur > prev ? '▲' : '▼') + Math.abs(Math.round(cur - prev)) + (unit == null ? '%' : unit) + ' จากช่วงก่อน');
  const want = (rep, k) => !rep.topic || rep.topic === 'all' || rep.topic === k;
  function docOf(rep, aiText) {
    const range = rangeTxt(rep.from, rep.to); const sections = [];
    if (aiText) sections.push({ type: 'text', title: 'สรุปจากผู้ช่วย', color: '#0369a1', lines: stripMd(aiText).split(/\n+/).filter(Boolean) });
    if (rep.kind === 'student') {
      const s = rep.st, P = rep.P, A = rep.A, B = rep.B, H = rep.H, pv = rep.prev || {};
      extraSecs(rep, sections, false);
      if (want(rep, 'prayer')) sections.push({ type: 'bars', title: 'ละหมาดแยกตามเวลา', color: '#0f766e', items: SLOTS.map((k) => { const x = P.slot[k]; const p = pctOf(x.on + x.late, x.on + x.late + x.miss); return { l: k, v: p, t: tone(p, 90, 70), s: 'ตรงเวลา ' + x.on + ' · สาย ' + x.late + ' · ลา ' + x.ex + ' · ขาด ' + x.miss }; }), note: 'รวม: ตรงเวลา ' + P.on + ' · สาย ' + P.late + ' · ลา/อุซุร ' + P.ex + ' · ไม่ได้เช็ค/ขาด ' + P.miss });
      if (want(rep, 'prayer')) sections.push({ key: 'pd', title: 'ละหมาดรายวัน', color: '#0f766e', cols: [['วันที่', 18, 'c'], ['ละหมาด (เวลา)', 18, 'c'], ['ลา/อุซุร', 14, 'c'], ['ขาด/ไม่ได้เช็ค', 18, 'c']], rows: P.days.slice().reverse().map((d) => ({ v: [dTh(d.d), d.n + '/' + d.of, d.ex, d.of - d.n - d.ex], bad: [d.of - d.n - d.ex > 0 ? 3 : -1] })) });
      const subj = Object.keys(A.subj);
      if (want(rep, 'attendance')) sections.push({ key: 'att', title: 'การมาเรียน (มา ' + A.present + ' · สาย ' + A.late + ' · ลา ' + A.leave + ' · ขาด ' + A.absent + ')', color: '#1d4ed8', cols: [['วิชา', 40, 'l'], ['มา', 10, 'c'], ['สาย', 10, 'c'], ['ลา', 10, 'c'], ['ขาด', 10, 'c'], ['ร้อยละ', 12, 'c']], rows: subj.map((k) => { const x = A.subj[k]; const p = pctOf(x.present + x.late, x.present + x.late + x.absent); return { v: [k, x.present, x.late, x.leave, x.absent, p == null ? '–' : p], bad: [x.absent ? 4 : -1, p != null && p < 80 ? 5 : -1] }; }), note: A.absDates.length ? 'วันที่ขาด: ' + A.absDates.slice(0, 30).map((x) => dTh(x.slice(0, 10)) + x.slice(10)).join(' · ') : '' });
      if (want(rep, 'behavior')) sections.push({ key: 'bh', title: 'พฤติกรรม (คะแนนภาคเรียน ' + B.score + ')', color: '#be123c', cols: [['วันที่', 14, 'c'], ['หัวข้อ', 56, 'l'], ['คะแนน', 12, 'c'], ['ผู้บันทึก', 18, 'l']], rows: B.items.map((l) => { const p = Number(l.points) || 0; return { v: [dTh(l.date), l.title || l.ruleTitle || '-', (p > 0 ? '+' : '') + p, l.byName || l.by || ''], bad: [p < 0 ? 2 : -1], good: [p > 0 ? 2 : -1] }; }), note: 'ช่วงนี้ถูกหัก ' + B.minus + ' ครั้ง (' + B.minusPts + ' คะแนน) · ได้เพิ่ม ' + B.plus + ' ครั้ง' });
      if (want(rep, 'halaqah')) sections.push({ key: 'hq', title: 'หะละเกาะฮฺ', color: '#7c3aed', cols: [['มา', 20, 'c'], ['สาย', 20, 'c'], ['ลา', 20, 'c'], ['ขาด/ไม่ได้เช็ค', 20, 'c'], ['ร้อยละ', 20, 'c']], rows: H.n ? [{ v: [H.c.present, H.c.late, H.c.leave, H.c.absent + H.c.none, H.pct == null ? '–' : H.pct] }] : [], note: H.groups.join(' · ') });
      if (rep.L.length && rep.topic === 'all') sections.push({ key: 'lv', title: 'การลา', color: '#0369a1', cols: [['ช่วงวันที่', 30, 'c'], ['ประเภท', 25, 'l'], ['อยู่ที่', 45, 'l']], rows: rep.L.map((x) => ({ v: [rangeTxt(x.from, x.to || x.from), x.type || 'ลา', x.where || ''] })) });
      if (rep.topic === 'all') sections.push({ key: 'subj', title: 'วิชาที่เรียน' + (rep.gpa ? ' (เกรดเฉลี่ย ' + rep.gpa + ')' : ''), color: '#4f46e5', cols: [['วิชา', 40, 'l'], ['ผู้สอน', 30, 'l'], ['คาบ/สัปดาห์', 14, 'c'], ['เกรด', 16, 'c']], rows: (rep.S.length ? rep.S.map((x) => { const g = rep.grades.find((y) => y.name === x.sn || y.code === x.sn); return { v: [x.sn + (x.other ? ' (เรียนร่วม ม.' + x.other + ')' : ''), x.tn || '', x.n, g && g.grade !== '' ? g.grade : '–'] }; }) : rep.grades.map((g) => ({ v: [g.name || g.code, '', '–', g.grade] }))) });
      return { name: nameOf(s), title: 'รายงานข้อมูลนักเรียนรายบุคคล', sub: shortG(s.grade) + ' · รหัส ' + s.studentId + ' · ' + schoolOf(s), range,
        kpis: [{ l: 'ละหมาด', v: pctTxt(P.pct), s: (P.on + P.late) + '/' + P.den + ' เวลา' + dTxt(P.pct, pv.p), t: tone(P.pct, 90, 70) }, { l: 'มาเรียน', v: pctTxt(A.pct), s: 'ลา ' + A.leave + ' · ขาด ' + A.absent + dTxt(A.pct, pv.a), t: tone(A.pct, 90, 80) }, { l: 'พฤติกรรม', v: String(B.score), s: 'ถูกหัก ' + B.minus + ' ครั้ง', t: tone(B.score, 90, 80) }, { l: 'หะละเกาะฮฺ', v: pctTxt(H.pct), s: H.n + ' ครั้ง' + dTxt(H.pct, pv.h), t: tone(H.pct, 90, 70) }], sections };
    }
    if (rep.kind === 'group') {
      const a = rep.agg; const G = Object.keys(a.byG).sort(); const pv = rep.prev || {};
      extraSecs(rep, sections, true);
      if (want(rep, 'prayer')) sections.push({ type: 'bars', title: 'ละหมาดแยกตามเวลา', color: '#0f766e', items: SLOTS.map((s) => { const p = pctOf(a.slot[s].ok, a.slot[s].den); return { l: s, v: p, t: tone(p, 90, 70), s: a.slot[s].ok + ' จาก ' + a.slot[s].den }; }), note: 'นักเรียนที่ละหมาด 90% ขึ้นไป ' + a.dist.hi + ' คน · 70–89% ' + a.dist.mid + ' คน · ต่ำกว่า 70% ' + a.dist.lo + ' คน' });
      if (G.length > 1) sections.push({ key: 'g', title: 'เทียบรายชั้น', color: '#0369a1', cols: [['ชั้น', 16, 'c'], ['นักเรียน', 14, 'c'], ['ละหมาด %', 18, 'c'], ['มาเรียน %', 18, 'c'], ['พฤติกรรมเฉลี่ย', 18, 'c']], rows: G.map((g) => { const b = a.byG[g]; const pp = pctOf(b.pOn, b.pDen), ap = pctOf(b.aOk, b.aN); return { v: [g, b.n, pp == null ? '–' : pp, ap == null ? '–' : ap, Math.round(b.sc / b.n)], bad: [pp != null && pp < 70 ? 2 : -1, ap != null && ap < 80 ? 3 : -1] }; }) });
      const R = rep.rows.slice().sort((x, y) => String(x.st.grade).localeCompare(String(y.st.grade), 'th') || nameOf(x.st).localeCompare(nameOf(y.st), 'th'));
      const sc = [['ที่', 5, 'c'], ['ชื่อ - สกุล', 33, 'l'], ['ชั้น', 7, 'c'], ['รหัส', 9, 'c']];
      sections.push({ key: 'all', title: 'สรุปรายคน', color: '#0c4a6e', cols: sc.concat([['ละหมาด %', 11, 'c'], ['มาเรียน %', 11, 'c'], ['พฤติกรรม', 11, 'c'], ['หะละเกาะฮฺ %', 13, 'c']]), rows: R.map((r, i) => ({ v: [i + 1, nameOf(r.st), shortG(r.st.grade), r.st.studentId, r.P.pct == null ? '–' : r.P.pct, r.A.pct == null ? '–' : r.A.pct, r.B.score, r.H.pct == null ? '–' : r.H.pct], low: (r.P.pct != null && r.P.pct < 70) || r.B.score < 80, bad: [r.P.pct != null && r.P.pct < 70 ? 4 : -1, r.A.pct != null && r.A.pct < 80 ? 5 : -1, r.B.score < 80 ? 6 : -1, r.H.pct != null && r.H.pct < 70 ? 7 : -1] })), note: 'ตัวเลขสีแดง = ต่ำกว่าเกณฑ์ (ละหมาด/หะละเกาะฮฺ 70% · มาเรียน 80% · พฤติกรรม 80 คะแนน)' });
      if (want(rep, 'prayer')) sections.push({ key: 'pr', title: 'การละหมาด', color: '#0f766e', cols: sc.concat([['ตรงเวลา', 9, 'c'], ['สาย', 8, 'c'], ['ลา/อุซุร', 10, 'c'], ['ขาด', 8, 'c'], ['ร้อยละ', 9, 'c']]), rows: R.map((r, i) => ({ v: [i + 1, nameOf(r.st), shortG(r.st.grade), r.st.studentId, r.P.on, r.P.late, r.P.ex, r.P.miss, r.P.pct == null ? '–' : r.P.pct], low: r.P.pct != null && r.P.pct < 70, bad: [r.P.miss ? 7 : -1, r.P.pct != null && r.P.pct < 70 ? 8 : -1] })) });
      if (want(rep, 'behavior')) sections.push({ key: 'bh', title: 'พฤติกรรม', color: '#be123c', cols: sc.concat([['คะแนนภาคเรียน', 13, 'c'], ['ถูกหัก (ครั้ง)', 11, 'c'], ['ถูกหัก (คะแนน)', 12, 'c'], ['ได้เพิ่ม (ครั้ง)', 12, 'c']]), rows: R.map((r, i) => ({ v: [i + 1, nameOf(r.st), shortG(r.st.grade), r.st.studentId, r.B.score, r.B.minus, r.B.minusPts, r.B.plus], low: r.B.score < 80, bad: [r.B.score < 80 ? 4 : -1, r.B.minus ? 5 : -1] })) });
      if (want(rep, 'attendance')) sections.push({ key: 'att', title: 'การมาเรียน', color: '#1d4ed8', cols: sc.concat([['มา', 9, 'c'], ['สาย', 8, 'c'], ['ลา', 8, 'c'], ['ขาด', 8, 'c'], ['ร้อยละ', 11, 'c']]), rows: R.map((r, i) => ({ v: [i + 1, nameOf(r.st), shortG(r.st.grade), r.st.studentId, r.A.present, r.A.late, r.A.leave, r.A.absent, r.A.pct == null ? '–' : r.A.pct], low: r.A.pct != null && r.A.pct < 80, bad: [r.A.absent ? 7 : -1, r.A.pct != null && r.A.pct < 80 ? 8 : -1] })) });
      const items = []; R.forEach((r) => r.B.items.forEach((l) => items.push({ r, l }))); items.sort((x, y) => String(x.l.date).localeCompare(String(y.l.date)));
      if (items.length && want(rep, 'behavior')) sections.push({ key: 'bhl', title: 'รายการพฤติกรรมในช่วงนี้', color: '#9f1239', cols: [['ที่', 5, 'c'], ['วันที่', 11, 'c'], ['ชื่อ - สกุล', 28, 'l'], ['ชั้น', 7, 'c'], ['หัวข้อ', 37, 'l'], ['คะแนน', 12, 'c']], rows: items.map((x, i) => { const p = Number(x.l.points) || 0; return { v: [i + 1, dTh(x.l.date), nameOf(x.r.st), shortG(x.r.st.grade), x.l.title || x.l.ruleTitle || '-', (p > 0 ? '+' : '') + p], bad: [p < 0 ? 5 : -1], good: [p > 0 ? 5 : -1] }; }) });
      return { name: rep.title, title: 'รายงานสรุปข้อมูลนักเรียน', sub: 'นักเรียน ' + a.n + ' คน', range,
        kpis: [{ l: 'ละหมาด', v: pctTxt(a.pPct), s: a.pOn + '/' + a.pDen + ' เวลา' + dTxt(a.pPct, pv.p), t: tone(a.pPct, 90, 70) }, { l: 'มาเรียน', v: pctTxt(a.aPct), s: 'ขาด ' + a.abs + ' · ลา ' + (a.lv || 0) + dTxt(a.aPct, pv.a), t: tone(a.aPct, 90, 80) }, { l: 'พฤติกรรมเฉลี่ย', v: a.scAvg == null ? '–' : String(a.scAvg), s: 'ต่ำกว่า 80: ' + a.low + ' คน', t: tone(a.scAvg, 90, 80) }, { l: 'หะละเกาะฮฺ', v: pctTxt(a.hPct), s: a.hN + ' ครั้ง' + dTxt(a.hPct, pv.h), t: tone(a.hPct, 90, 70) }], sections };
    }
    if (rep.kind === 'compare') {
      const A = rep.A.agg, B = rep.B.agg; const v = (x) => x == null ? '–' : x;
      const rows = [['นักเรียน (คน)', A.n, B.n], ['ละหมาด %', v(A.pPct), v(B.pPct)], ['มาเรียน %', v(A.aPct), v(B.aPct)], ['พฤติกรรมเฉลี่ย', v(A.scAvg), v(B.scAvg)], ['หะละเกาะฮฺ %', v(A.hPct), v(B.hPct)]].concat(SLOTS.map((s) => ['ละหมาด' + s + ' %', v(pctOf(A.slot[s].ok, A.slot[s].den)), v(pctOf(B.slot[s].ok, B.slot[s].den))])).concat([['ละหมาดต่ำกว่า 70% (คน)', A.dist.lo, B.dist.lo], ['พฤติกรรมต่ำกว่า 80 (คน)', A.low, B.low]]);
      sections.push({ key: 'cmp', title: 'เปรียบเทียบ', color: '#0369a1', cols: [['หัวข้อ', 40, 'l'], [rep.A.title, 30, 'c'], [rep.B.title, 30, 'c']], rows: rows.map((r) => ({ v: r })) });
      return { name: rep.A.title + ' กับ ' + rep.B.title, title: 'รายงานเปรียบเทียบ 2 กลุ่ม', sub: '', range, kpis: [], sections };
    }
    if (rep.kind === 'rank') {
      const M = METRIC[rep.metric];
      sections.push({ key: 'rk', title: rep.title, color: '#0369a1', cols: [['อันดับ', 8, 'c'], ['ชื่อ - สกุล', 32, 'l'], ['ชั้น', 8, 'c'], ['โรงเรียน', 26, 'l'], [M.l, 26, 'c']], rows: rep.rows.map((r, i) => ({ v: [i + 1, nameOf(r.st), shortG(r.st.grade), schoolOf(r.st), M.txt(r)] })) });
      return { name: rep.group.title, title: 'รายงานจัดอันดับ · ' + M.l, sub: rep.order === 'best' ? 'สูงสุด' : 'ต่ำสุด', range, kpis: [], sections };
    }
    return null;
  }

  // รวมหลายการ์ดเป็นไฟล์เดียว: แต่ละการ์ดขึ้นต้นด้วยหัวข้อใหญ่ (part)
  function combineDocs(list) {
    const D = { name: 'รายงานรวม ' + list.length + ' รายการ', title: 'รายงานรวม', sub: list.map((x) => x.name).join(' · ').slice(0, 160), range: Array.from(new Set(list.map((x) => x.range))).join(' / '), kpis: [], sections: [] };
    list.forEach((x, i) => { D.sections.push({ type: 'part', n: i + 1, title: x.name, sub: x.title + (x.sub ? ' · ' + x.sub : '') + ' · ' + x.range, kpis: x.kpis || [] }); x.sections.forEach((sec) => D.sections.push(Object.assign({}, sec, { prefix: (i + 1) + '. ' }))); });
    return D;
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
    D.sections.filter((s) => s.type === 'part').forEach((s) => { sum.push([], [s.n + '. ' + s.title], [s.sub]); (s.kpis || []).forEach((k) => sum.push([k.l, k.v, k.s || ''])); });
    D.sections.filter((s) => s.type === 'text').forEach((s) => { sum.push([], [(s.prefix || '') + s.title]); s.lines.forEach((l) => sum.push([l])); });
    D.sections.filter((s) => s.type === 'bars').forEach((s) => { sum.push([], [(s.prefix || '') + s.title], ['หัวข้อ', 'ร้อยละ', 'รายละเอียด']); s.items.forEach((x) => sum.push([x.l, x.v == null ? '' : x.v, x.s || ''])); if (s.note) sum.push([s.note]); });
    add(sum, 'สรุป', [22, 40, 44], [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]);
    D.sections.filter((s) => !s.type).forEach((sec) => {
      const aoa = [[sec.title + ' · ' + D.name], ['ช่วงวันที่ ' + D.range], [], sec.cols.map((c) => c[0])].concat(sec.rows.map((r) => r.v.map((v) => v === '–' ? '' : v)));
      if (sec.note) aoa.push([], [sec.note]);
      const last = Math.max(0, sec.cols.length - 1);
      add(aoa, (sec.prefix || '') + sec.title.replace(/\s*\(.*\)$/, ''), sec.cols.map((c) => c[2] === 'l' ? Math.max(14, Math.round(c[1] * 1.3)) : Math.max(8, Math.round(c[1] * 1.1))), [{ s: { r: 0, c: 0 }, e: { r: 0, c: last } }, { s: { r: 1, c: 0 }, e: { r: 1, c: last } }],
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
    let firstPart = true;
    D.sections.forEach((sec) => {
      if (sec.type === 'part') { h += '<div style="' + (firstPart ? '' : 'page-break-before:always;') + 'margin-top:14pt;padding:8pt 10pt;background:#0c4a6e;color:#fff"><span style="font-size:18pt;font-weight:bold">' + sec.n + '. ' + esc(sec.title) + '</span><br><span style="font-size:12pt;color:#bae6fd">' + esc(sec.sub) + '</span></div>' + (sec.kpis && sec.kpis.length ? '<table class="k"><tr>' + sec.kpis.map((k) => '<td style="width:' + Math.floor(100 / sec.kpis.length) + '%"><span style="color:#475569">' + esc(k.l) + '</span><b style="color:' + (TONE_C[k.t] || '#0c4a6e') + '">' + esc(k.v) + '</b><span style="color:#64748b;font-size:12pt">' + esc(k.s || '') + '</span></td>').join('') + '</tr></table>' : ''); firstPart = false; return; }
      h += '<h2 style="border-left-color:' + sec.color + '">' + esc((sec.prefix || '') + sec.title) + '</h2>';
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
    const head = (sec, cont, n) => { x.fillStyle = sec.color || '#0369a1'; x.fillRect(M, y + 6, 8, 34); x.fillStyle = '#0f172a'; font('700', 28); x.fillText(fit((sec.prefix || '') + sec.title + (cont ? ' (ต่อ)' : ''), TW - 200), M + 22, y + 24); if (!cont && n != null) { x.fillStyle = '#64748b'; font('400', 18); x.textAlign = 'right'; x.fillText(n + ' รายการ', W - M, y + 24); x.textAlign = 'left'; } y += 56; };
    const thead = (X) => { rr(M, y, TW, HH, 10, '#0c4a6e'); x.fillStyle = '#fff'; font('600', 18); X.forEach((cl) => { x.textAlign = cl.al === 'l' ? 'left' : 'center'; x.fillText(fit(cl.t, cl.w - 16), cl.al === 'l' ? cl.x + 12 : cl.x + cl.w / 2, y + HH / 2); }); x.textAlign = 'left'; y += HH; };
    const note = (t) => { if (!t) return; font('400', 17); x.fillStyle = '#64748b'; const lines = wrap(t, TW); if (room() < 14 + lines.length * 26) newPage(false); y += 14; lines.forEach((l) => { x.fillStyle = '#64748b'; font('400', 17); x.fillText(l, M, y + 12); y += 26; }); };
    newPage(true);
    D.sections.forEach((sec, si) => {
      if (sec.type === 'part') {
        if (y > M + 300) newPage(false);
        rr(M, y, TW, 110, 18, '#0c4a6e'); x.fillStyle = '#fff'; font('700', 32); x.fillText(fit(sec.n + '. ' + sec.title, TW - 48), M + 24, y + 40); x.fillStyle = '#bae6fd'; font('400', 19); x.fillText(fit(sec.sub, TW - 48), M + 24, y + 80); y += 128;
        if (sec.kpis && sec.kpis.length) { const n = sec.kpis.length, kw = (TW - (n - 1) * 18) / n; sec.kpis.forEach((k, i) => { const X = M + i * (kw + 18); rr(X, y, kw, 116, 16, '#f8fafc', '#e2e8f0'); x.fillStyle = '#475569'; font('500', 19); x.fillText(k.l, X + 20, y + 28); x.fillStyle = TONE_C[k.t] || '#0c4a6e'; font('700', 38); x.fillText(k.v, X + 20, y + 66); if (k.s) { x.fillStyle = '#64748b'; font('400', 16); x.fillText(fit(k.s, kw - 40), X + 20, y + 98); } }); y += 136; }
        return;
      }
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
  const GP = { school: { type: 'string', description: 'ชื่อโรงเรียน (บางส่วนก็ได้) หลายโรงเรียนคั่นด้วย ,' }, grade: { type: 'string', description: 'ชั้น 1-6 หลายชั้นคั่นด้วย , เช่น 4,5' }, gender: { type: 'string', enum: ['ชาย', 'หญิง'] } };
  const DR = { from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD' } };
  const TP = { topic: { type: 'string', enum: ['all', 'prayer', 'attendance', 'behavior', 'halaqah'], description: 'หัวข้อที่ต้องการเน้น' } };
  const TOOLS = [
    { name: 'find_students', description: 'ค้นหานักเรียนจากชื่อ นามสกุล หรือรหัส คืนรายชื่อที่ตรง (รหัส ชื่อ ชั้น โรงเรียน) ใช้ก่อน student_report เมื่อไม่แน่ใจว่าเป็นใคร', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'list_schools', description: 'รายชื่อโรงเรียนต้นสังกัดทั้งหมด พร้อมจำนวนนักเรียน', parameters: { type: 'object', properties: {} } },
    { name: 'student_report', description: 'ข้อมูลทั้งหมดของนักเรียน 1 คนในช่วงวันที่ พร้อมเทียบช่วงก่อนหน้า แนวโน้ม และสัญญาณเตือน (ละหมาดแยกเวลา การมาเรียนแยกวิชา พฤติกรรม หะละเกาะฮฺ การลา วิชาที่เรียน เกรด) · แอปแสดงการ์ดพร้อมกราฟอัตโนมัติ', parameters: { type: 'object', properties: Object.assign({ student_id: { type: 'string' } }, DR, TP), required: ['student_id'] } },
    { name: 'group_report', description: 'สรุปนักเรียนทั้งกลุ่มตามโรงเรียน/ชั้น/เพศ (ไม่ระบุ = ใช้ตัวกรองที่ผู้ใช้เลือกไว้) พร้อมเทียบช่วงก่อนหน้า แนวโน้ม สัญญาณเตือน แยกเวลา แยกชั้น และรายชื่อทุกคน · แอปแสดงการ์ดพร้อมกราฟอัตโนมัติ', parameters: { type: 'object', properties: Object.assign({}, GP, DR, TP) } },
    { name: 'rank_students', description: 'จัดอันดับนักเรียนตามตัวชี้วัด เช่น ใครขาดละหมาดมากสุด ใครมาเรียนน้อยสุด ใครพฤติกรรมดีที่สุด · แอปแสดงการ์ดอันดับอัตโนมัติ', parameters: { type: 'object', properties: Object.assign({ metric: { type: 'string', enum: ['prayer', 'attendance', 'behavior', 'halaqah'] }, order: { type: 'string', enum: ['worst', 'best'] }, limit: { type: 'integer' } }, GP, DR), required: ['metric'] } },
    { name: 'compare_groups', description: 'เทียบ 2 กลุ่มแบบวางข้างกัน เช่น โรงเรียน A กับ B หรือ ม.4 กับ ม.5 หรือ ชายกับหญิง · แอปแสดงการ์ดเปรียบเทียบอัตโนมัติ', parameters: { type: 'object', properties: Object.assign({ a_school: { type: 'string' }, a_grade: { type: 'string' }, a_gender: { type: 'string', enum: ['ชาย', 'หญิง'] }, b_school: { type: 'string' }, b_grade: { type: 'string' }, b_gender: { type: 'string', enum: ['ชาย', 'หญิง'] } }, DR) } }
  ];
  function filterTxt() {
    const f = S.f; const p = [];
    if (f.schools.length) p.push('โรงเรียน: ' + f.schools.join(', ')); if (f.grades.length) p.push('ชั้น: ม.' + f.grades.join(', ม.')); if (f.gender) p.push('เพศ: ' + f.gender); if (f.topic !== 'all') p.push('หัวข้อ: ' + TOPICS[f.topic]);
    if (f.sid) { const s = studentById(f.sid); if (s) p.push('นักเรียนที่เลือก: ' + nameOf(s) + ' (รหัส ' + s.studentId + ')'); }
    return p.length ? p.join(' · ') : 'ไม่ได้เลือก (ทุกคน)';
  }
  function systemPrompt() {
    const r = S.range; const sc = schools().slice(0, 30).map((x) => x.name + ' (' + x.students + ' คน)').join(', ');
    return 'คุณคือผู้ช่วยข้อมูลของระบบ KHALIFAH (หอพัก/โครงการนักเรียนมุสลิม) ตอบแอดมินเป็นภาษาไทย สุภาพ กระชับ อ่านง่าย\n' +
      'วันนี้คือ ' + today() + ' (เวลาประเทศไทย) · ช่วงวันที่ที่ผู้ใช้เลือกไว้: ' + r.from + ' ถึง ' + r.to + ' (' + r.label + ') ใช้เมื่อคำถามไม่ระบุช่วงเวลา · ถ้าคำถามระบุ (เช่น สัปดาห์นี้ เดือนตุลาคม ปีนี้) ให้คำนวณเป็น YYYY-MM-DD เอง\n' +
      'ตัวกรองที่ผู้ใช้เลือกไว้: ' + filterTxt() + ' · เครื่องมือจะใช้ตัวกรองนี้อัตโนมัติถ้าไม่ส่ง school/grade/gender มา ถ้าคำถามพูดถึงกลุ่มอื่นให้ส่งค่าใหม่ ถ้าผู้ใช้เลือกนักเรียนไว้และถามสั้นๆ (เช่น "เป็นยังไงบ้าง") ให้เรียก student_report ของคนนั้น\n' +
      'โรงเรียนในระบบ: ' + sc + '\n' +
      'กฎ: 1) ตัวเลขทุกตัวต้องมาจากเครื่องมือเท่านั้น ห้ามเดา 2) ถ้าชื่อนักเรียนกำกวม เรียก find_students ก่อน ถ้าพบหลายคนให้ถามกลับสั้นๆ พร้อมรายชื่อ 3) แอปแสดงการ์ดพร้อมกราฟ ตาราง เทียบช่วงก่อน และสัญญาณเตือนให้ผู้ใช้เองทุกครั้งที่เรียกเครื่องมือรายงาน จึงไม่ต้องเขียนตารางซ้ำ ให้สรุปประเด็นสำคัญ 3–6 ข้อ เน้นการเปลี่ยนแปลงจากช่วงก่อน จุดที่น่าเป็นห่วง (alerts) และข้อเสนอแนะสั้นๆ 4) ร้อยละละหมาด = (ตรงเวลา+สาย) ÷ เวลาที่ต้องละหมาด ไม่นับเวลาที่ลา/มีประจำเดือน · ร้อยละมาเรียน = (มา+สาย) ÷ (มา+สาย+ขาด) ไม่นับวันลา 5) ส่งออกไฟล์: กดปุ่ม "บันทึกไฟล์" ใต้การ์ด หรือกด "รายงานรวม" ที่หลายการ์ดเพื่อรวมเป็นไฟล์เดียว 6) ไม่ตอบเรื่องที่ไม่เกี่ยวกับข้อมูลนักเรียนในระบบ 7) ใช้ markdown แบบง่าย (ตัวหนา และรายการ) เท่านั้น';
  }
  const baseF = (a) => ({ schools: a.school ? String(a.school).split(/\s*,\s*/) : S.f.schools.slice(), grades: a.grade ? String(a.grade).split(/[^1-6]+/).filter(Boolean) : S.f.grades.slice(), gender: a.gender || (a.school || a.grade ? '' : S.f.gender), topic: a.topic || S.f.topic });
  async function runTool(name, args, ctx) {
    args = args || {};
    const rf = okDate(args.from) ? args.from : S.range.from, rt = okDate(args.to) ? args.to : S.range.to;
    const from = rf <= rt ? rf : rt, to = rf <= rt ? rt : rf; const r = { from, to };
    if (name === 'find_students') { const L = findStudents(args.query, 10); return { matches: L.map((s) => ({ id: s.studentId, name: nameOf(s), grade: shortG(s.grade), school: schoolOf(s) })) }; }
    if (name === 'list_schools') return { schools: schools() };
    if (name === 'student_report') { let id = args.student_id; if (!studentById(id)) { const L = findStudents(id, 2); if (L.length === 1) id = L[0].studentId; else return { error: 'ไม่พบนักเรียน "' + id + '"', candidates: L.map((s) => ({ id: s.studentId, name: nameOf(s) })) }; } const spec = { t: 'student', sid: id, topic: args.topic || S.f.topic, r }; const rep = await runSpec(spec); if (!rep.error) ctx.reps.push(rep); return compact(rep); }
    if (name === 'group_report') { const spec = { t: 'group', f: baseF(args), r }; const rep = await runSpec(spec); if (!rep.error) ctx.reps.push(rep); return compact(rep); }
    if (name === 'rank_students') { const spec = { t: 'rank', f: Object.assign(baseF(args), { metric: args.metric, order: args.order, limit: args.limit }), r }; const rep = await runSpec(spec); if (!rep.error) ctx.reps.push(rep); return compact(rep); }
    if (name === 'compare_groups') { const spec = { t: 'compare', a: { school: args.a_school, grade: args.a_grade, gender: args.a_gender }, b: { school: args.b_school, grade: args.b_grade, gender: args.b_gender }, r }; const rep = await runSpec(spec); if (!rep.error) ctx.reps.push(rep); return compact(rep); }
    return { error: 'ไม่รู้จักเครื่องมือ ' + name };
  }
  async function runSpec(spec) {
    const r = spec.r && okDate(spec.r.from) ? spec.r : S.range; let rep;
    if (spec.t === 'student') rep = await studentReport(spec.sid, r.from, r.to, { topic: spec.topic || 'all' });
    else if (spec.t === 'group') rep = await groupReport(spec.f || {}, r.from, r.to);
    else if (spec.t === 'rank') rep = await rankReport(spec.f || {}, r.from, r.to);
    else if (spec.t === 'compare') rep = await compareReport(spec.a || {}, spec.b || {}, r.from, r.to);
    else rep = { error: 'ไม่รู้จักรายงาน' };
    if (rep && !rep.error) rep.spec = Object.assign({ rm: S.rm }, spec, { r: { from: r.from, to: r.to } });
    return rep;
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
      for (const p of calls) { const fc = p.functionCall; setStatus('กำลังดึงข้อมูล: ' + ({ find_students: 'ค้นหานักเรียน', list_schools: 'รายชื่อโรงเรียน', student_report: 'ข้อมูลนักเรียน', group_report: 'สรุปกลุ่ม', rank_students: 'จัดอันดับ', compare_groups: 'เปรียบเทียบ' }[fc.name] || fc.name) + '…'); let out; try { out = await runTool(fc.name, fc.args, ctx); } catch (e) { out = { error: String(e && e.message || e) }; } const fr = { name: fc.name, response: { result: out } }; if (fc.id) fr.id = fc.id; resp.push({ functionResponse: fr }); }
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
    const rr = rangeFromText(q); const r = rr || S.range; const qs = q.replace(/\s+/g, ' ');
    const gm = qs.match(/(?:ม\.|มัธยมศึกษาปีที่|ชั้น\s*ม?\.?)\s*([1-6])/g);
    const grades = gm ? gm.map((x) => gNum(x)) : null;
    const met = /ละหมาด/.test(qs) ? 'prayer' : /มาเรียน|ขาดเรียน|เข้าเรียน|เช็คชื่อ/.test(qs) ? 'attendance' : /พฤติกรรม|คะแนน|ความประพฤติ/.test(qs) ? 'behavior' : /หะละเกาะ|ฮะลาเกาะ|ฮาลาเกาะ/.test(qs) ? 'halaqah' : '';
    const isRank = /อันดับ|มากสุด|มากที่สุด|น้อยสุด|น้อยที่สุด|ต่ำสุด|ต่ำที่สุด|สูงสุด|สูงที่สุด|ดีที่สุด|แย่|ใครขาด|ใครบ้าง|top/i.test(qs);
    const isCmp = /เทียบ|เปรียบเทียบ|vs/i.test(qs);
    const sch = /โรงเรียน|รร\./.test(qs) ? matchSchool(qs.replace(/.*?(โรงเรียน|รร\.)/, '')) || matchSchool(qs) : matchSchool(qs);
    const gender = /ผู้หญิง|นักเรียนหญิง|\bหญิง/.test(qs) ? 'หญิง' : /ผู้ชาย|นักเรียนชาย|\bชาย/.test(qs) ? 'ชาย' : '';
    const F = { schools: sch ? [sch] : S.f.schools.slice(), grades: grades || S.f.grades.slice(), gender: gender || S.f.gender, topic: met || S.f.topic };
    const stuL = findStudents(qs.replace(/สรุป|ข้อมูล|ของ|ขอ|ดู|นักเรียน|ชื่อ|เดือนนี้|สัปดาห์นี้|วันนี้|ปีนี้|ภาคเรียนนี้|ทั้งหมด|หน่อย|ครับ|ค่ะ|คะ|เป็นยังไง|บ้าง/g, ' ').trim(), 6);
    const run = async (spec) => { if (rr) spec.r = { from: rr.from, to: rr.to }; const rep = await runSpec(spec); if (rep.error) return { err: rep.error }; ctx.reps.push(rep); return { rep }; };
    if (isCmp && grades && grades.length >= 2) { const o = await run({ t: 'compare', a: { school: F.schools.join(','), grade: grades[0], gender: F.gender }, b: { school: F.schools.join(','), grade: grades[1], gender: F.gender } }); return o.err || 'เทียบ ม.' + grades[0] + ' กับ ม.' + grades[1] + ' ช่วง' + r.label; }
    if (isCmp && /ชาย/.test(qs) && /หญิง/.test(qs)) { const o = await run({ t: 'compare', a: { school: F.schools.join(','), grade: F.grades.join(','), gender: 'ชาย' }, b: { school: F.schools.join(','), grade: F.grades.join(','), gender: 'หญิง' } }); return o.err || 'เทียบนักเรียนชายกับหญิง ช่วง' + r.label; }
    if (isRank && met) {
      const best = /ดีที่สุด|สูงสุด|สูงที่สุด|มากที่สุด(?!.*ขาด)|เยอะ(?!.*ขาด)/.test(qs) && !/ขาด|ต่ำ|น้อย|แย่/.test(qs);
      const o = await run({ t: 'rank', f: Object.assign({}, F, { metric: met, order: best ? 'best' : 'worst', limit: (qs.match(/(\d+)\s*คน/) || [])[1] || 10 }) }); if (o.err) return o.err;
      return 'นี่คือ' + o.rep.title + ' ช่วง' + r.label + (o.rep.rows[0] ? ' · อันดับแรกคือ **' + nameOf(o.rep.rows[0].st) + '** (' + METRIC[met].txt(o.rep.rows[0]) + ')' : '');
    }
    if (stuL.length && (!sch || /นักเรียน|ของ/.test(qs) || stuL.length === 1)) {
      const strong = stuL.filter((s) => qs.indexOf(bare(s)) !== -1 || qs.indexOf(String(s.studentId)) !== -1 || (qs.match(/\d{3,}/) && norm(qs.match(/\d{3,}/)[0]) === norm(s.studentId)));
      const L = strong.length ? strong : stuL;
      if (L.length > 1) { ctx.html.push(chooserCard(L, qs)); return 'พบนักเรียนที่ชื่อคล้ายกัน ' + L.length + ' คน เลือกคนที่ต้องการได้เลย'; }
      const o = await run({ t: 'student', sid: L[0].studentId, topic: met || 'all' }); return o.err || localStudentText(o.rep, rr ? rr.label : S.range.label);
    }
    if (S.f.sid && !sch && !grades && !/ทุกคน|ทั้งหมด|ภาพรวม|ทุกโรงเรียน/.test(qs)) { const o = await run({ t: 'student', sid: S.f.sid, topic: met || S.f.topic }); return o.err || localStudentText(o.rep, rr ? rr.label : S.range.label); }
    if (sch || grades || gender || met || /ทุกคน|ทั้งหมด|ภาพรวม|ทุกโรงเรียน|สรุป/.test(qs) || S.f.schools.length || S.f.grades.length) { const o = await run({ t: 'group', f: F }); return o.err || localGroupText(o.rep, rr ? rr.label : S.range.label); }
    return 'ยังไม่เข้าใจคำถามนี้ ลองเลือกตัวกรองทางซ้ายแล้วกด **สรุป** หรือพิมพ์ เช่น **"สรุปโรงเรียน' + (schools()[0] ? schools()[0].name.replace(/^โรงเรียน/, '') : 'สาธิต') + ' เดือนนี้"**, **"ข้อมูลของ' + (students()[0] ? bare(students()[0]).split(' ')[0] : 'อาหมัด') + '"**, **"เทียบ ม.4 กับ ม.5"** หรือ **"ใครขาดละหมาดมากที่สุดสัปดาห์นี้"**';
  }
  const dWord = (cur, prev) => (cur == null || prev == null) ? '' : Math.round(cur - prev) === 0 ? ' (เท่าช่วงก่อน)' : ' (' + (cur > prev ? '▲' : '▼') + Math.abs(Math.round(cur - prev)) + '% จากช่วงก่อน)';
  function localStudentText(rep, label) {
    const P = rep.P, A = rep.A, B = rep.B, pv = rep.prev || {}; const L = [];
    L.push('**' + nameOf(rep.st) + '** (' + shortG(rep.st.grade) + ') ช่วง' + label + ':');
    L.push('• ละหมาด ' + pctTxt(P.pct) + dWord(P.pct, pv.p) + ' · ตรงเวลา ' + P.on + ' · สาย ' + P.late + ' · ลา/อุซุร ' + P.ex + ' · ไม่ได้เช็ค ' + P.miss);
    L.push('• มาเรียน ' + (A.n ? pctTxt(A.pct) + dWord(A.pct, pv.a) + ' · ขาด ' + A.absent + ' · สาย ' + A.late + ' · ลา ' + A.leave : 'ยังไม่มีการเช็คชื่อ'));
    L.push('• พฤติกรรม ' + B.score + ' คะแนน' + (B.minus ? ' · ช่วงนี้ถูกหัก ' + B.minus + ' ครั้ง' : ' · ช่วงนี้ไม่ถูกหักคะแนน'));
    if (rep.H.n) L.push('• หะละเกาะฮฺ ' + pctTxt(rep.H.pct));
    if (rep.alerts.length) L.push('• ⚠️ ' + rep.alerts.slice(0, 2).map((x) => x.t).join(' · '));
    return L.join('\n');
  }
  function localGroupText(rep, label) {
    const a = rep.agg, pv = rep.prev || {}; const L = ['**' + rep.title + '** ช่วง' + label + ' · นักเรียน ' + a.n + ' คน'];
    L.push('• ละหมาดเฉลี่ย ' + pctTxt(a.pPct) + dWord(a.pPct, pv.p) + ' · มาเรียน ' + pctTxt(a.aPct) + dWord(a.aPct, pv.a));
    L.push('• พฤติกรรมเฉลี่ย ' + (a.scAvg == null ? '–' : a.scAvg) + (a.hN ? ' · หะละเกาะฮฺ ' + pctTxt(a.hPct) : ''));
    const ws = SLOTS.map((s) => ({ s, p: pctOf(a.slot[s].ok, a.slot[s].den) })).filter((x) => x.p != null).sort((x, y) => x.p - y.p)[0]; if (ws) L.push('• เวลาละหมาดที่ต่ำสุด: ' + ws.s + ' (' + ws.p + '%)');
    if (rep.alerts.length) L.push('• ⚠️ มีสัญญาณเตือน ' + rep.alerts.length + ' รายการ จากนักเรียน ' + new Set(rep.alerts.map((x) => x.st.studentId)).size + ' คน');
    return L.join('\n');
  }

  // ================= หน้าจอ =================
  const TH_D = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  function rangeOf(mode, anchor) {
    const t = today(); const a = okDate(anchor) ? anchor : t; const d = new Date(a + 'T00:00:00'); const clip = (x) => x > t ? t : x;
    if (mode === 'day') return { from: a, to: a, label: TH_D[d.getDay()] + ' ' + dTh(a) };
    if (mode === 'week') { const w = (d.getDay() + 6) % 7; const f = addD(a, -w); const e = addD(f, 6); return { from: f, to: clip(e), label: 'สัปดาห์ ' + rangeTxt(f, e) }; }
    if (mode === 'month') { const f = ymd(new Date(d.getFullYear(), d.getMonth(), 1)); const e = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)); return { from: f, to: clip(e), label: MTHF[d.getMonth()] + ' ' + (d.getFullYear() + 543) }; }
    if (mode === 'year') return { from: d.getFullYear() + '-01-01', to: clip(d.getFullYear() + '-12-31'), label: 'ปี ' + (d.getFullYear() + 543) };
    if (mode === 'term') { const r = range('term'); return { from: r.from, to: r.to, label: 'ภาคเรียนนี้' }; }
    return { from: S.cf || addD(t, -29), to: S.ct || t, label: rangeTxt(S.cf || addD(t, -29), S.ct || t) };
  }
  function shiftAnchor(dir) {
    const a = new Date(S.anchor + 'T00:00:00');
    if (S.rm === 'day') a.setDate(a.getDate() + dir); else if (S.rm === 'week') a.setDate(a.getDate() + 7 * dir); else if (S.rm === 'month') { a.setDate(1); a.setMonth(a.getMonth() + dir); } else if (S.rm === 'year') { a.setMonth(0, 1); a.setFullYear(a.getFullYear() + dir); }
    let n = ymd(a); if (n > today()) n = today(); return n;
  }
  const S = { rm: 'month', anchor: today(), cf: '', ct: '', range: null, f: { schools: [], grades: [], gender: '', topic: 'all', sid: '' }, schQ: '', stuQ: '', cmpOpen: false, cmpB: { school: '', grades: [] }, hist: [], busy: false, ready: null, model: '', msgs: 0, route: '', gasReady: false, tk: null, basket: [], panel: false, drawer: '' };
  S.range = rangeOf('month', today());
  const LS_H = 'k8ai_hist_v1', LS_P = 'k8ai_pins_v1';
  const lsGet = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  function md(t) {
    const lines = esc(t).split('\n'); let h = '', inL = false;
    lines.forEach((l) => { const m = l.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/); const b = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\s)\*(\S.+?\S)\*(?=\s|$)/g, '$1<i>$2</i>'); if (m) { if (!inL) { h += '<ul>'; inL = true; } h += '<li>' + b(m[1]) + '</li>'; } else { if (inL) { h += '</ul>'; inL = false; } if (l.trim()) h += '<p>' + b(l.replace(/^#+\s*/, '')) + '</p>'; } });
    if (inL) h += '</ul>'; return h;
  }
  const $ = (id) => document.getElementById(id);
  const SV = (d, w) => '<svg width="' + (w || 18) + '" height="' + (w || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const ICN = { back: '<path d="M15 18l-6-6 6-6"/>', l: '<path d="M15 18l-6-6 6-6"/>', r: '<path d="M9 18l6-6-6-6"/>', filt: '<path d="M4 5h16l-6 8v5l-4 2v-7z"/>', hist: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>', send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>', mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>', plus: '<path d="M12 5v14M5 12h14"/>', spark: '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/>' };
  function ensureDom() {
    if ($('k8Ai')) return;
    const el = document.createElement('div'); el.className = 'k8-asum k8ai'; el.id = 'k8Ai'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'k8AiT');
    el.innerHTML = '<div class="k8ai-shell">' +
      '<header class="k8ai-top"><button type="button" class="k8-pg-back" aria-label="ปิด" onclick="history.back()">' + SV(ICN.back, 22) + '</button><div class="k8ai-tt"><h2 id="k8AiT">ถามข้อมูล</h2><small id="k8AiSt">กำลังตรวจสอบ…</small></div>' +
      '<button type="button" class="k8ai-tb k8ai-only-m" onclick="k8AiPanel(true)" aria-controls="k8AiSide">' + SV(ICN.filt) + '<span>ตัวกรอง</span><b id="k8AiFN" hidden></b></button>' +
      '<button type="button" class="k8ai-tb" onclick="k8AiDrawer(\'pins\')" aria-controls="k8AiDw">' + SV(ICN.hist) + '<span>ประวัติ</span></button><button type="button" class="k8ai-tb" onclick="k8AiReset()">' + SV(ICN.plus) + '<span>เริ่มใหม่</span></button></header>' +
      '<div class="k8ai-body"><aside class="k8ai-side" id="k8AiSide" aria-label="ตัวกรองข้อมูล"></aside><div class="k8ai-scrim" onclick="k8AiPanel(false)"></div>' +
      '<main class="k8ai-main"><div class="k8ai-scope" id="k8AiScope"></div><div class="k8ai-log" id="k8AiLog" aria-live="polite"></div><div class="k8ai-bk" id="k8AiBk" hidden></div>' +
      '<form class="k8ai-comp" onsubmit="event.preventDefault();k8AiSend()"><button type="button" class="k8ai-mic" id="k8AiMic" onclick="k8AiMic()" aria-label="พูดถามด้วยเสียง" hidden>' + SV(ICN.mic, 20) + '</button><textarea id="k8AiQ" rows="1" placeholder="ถามได้เลย เช่น ใครน่าเป็นห่วงที่สุด" aria-label="คำถาม" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey&&!event.isComposing){event.preventDefault();k8AiSend()}" oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,140)+\'px\'"></textarea><button type="submit" id="k8AiGo" aria-label="ส่งคำถาม">' + SV(ICN.send, 20) + '</button></form></main></div>' +
      '<div class="k8ai-dw" id="k8AiDw" hidden role="dialog" aria-label="ประวัติและรายงานที่ปักหมุด"></div></div>';
    document.body.appendChild(el);
    window.addEventListener('popstate', () => { const e = $('k8Ai'); if (e && !e.hidden) { e.hidden = true; document.documentElement.classList.remove('k8-docs-open'); stopMic(); } });
    if (window.SpeechRecognition || window.webkitSpeechRecognition) $('k8AiMic').hidden = false;
  }
  // ---------- แผงตัวกรอง
  function stuPool() { return filterStudents(normF({ schools: S.f.schools, grades: S.f.grades, gender: S.f.gender })); }
  function paintSide() {
    const el = $('k8AiSide'); if (!el) return; const SC = schools(); const f = S.f;
    const seg = (name, items, cur, fn) => '<div class="k8ai-seg" role="group" aria-label="' + name + '">' + items.map(([k, l]) => '<button type="button" aria-pressed="' + (cur === k) + '" onclick="' + fn + '(\'' + k + '\')">' + l + '</button>').join('') + '</div>';
    let nav = '';
    const r = S.range; const canNext = r.to < today() && S.rm !== 'custom' && S.rm !== 'term';
    if (S.rm === 'custom') nav = '<div class="k8ai-dr"><label><span>ตั้งแต่</span><input type="date" value="' + r.from + '" max="' + today() + '" onchange="k8AiCustom(this.value, null)"></label><label><span>ถึง</span><input type="date" value="' + r.to + '" max="' + today() + '" onchange="k8AiCustom(null, this.value)"></label></div>';
    else if (S.rm === 'term') nav = '<p class="k8ai-rv">' + esc(rangeTxt(r.from, r.to)) + '</p>';
    else {
      let pick = '';
      const d = new Date(S.anchor + 'T00:00:00'); const yNow = new Date().getFullYear();
      if (S.rm === 'day' || S.rm === 'week') pick = '<input type="date" class="k8ai-pk" aria-label="เลือกวัน" value="' + S.anchor + '" max="' + today() + '" onchange="k8AiAnchor(this.value)">';
      else if (S.rm === 'month') pick = '<span class="k8ai-pk2"><select aria-label="เดือน" onchange="k8AiAnchor(\'m\', this.value)">' + MTHF.map((m, i) => '<option value="' + i + '"' + (i === d.getMonth() ? ' selected' : '') + '>' + m + '</option>').join('') + '</select><select aria-label="ปี" onchange="k8AiAnchor(\'y\', this.value)">' + [0, 1, 2, 3].map((k) => yNow - k).map((y) => '<option value="' + y + '"' + (y === d.getFullYear() ? ' selected' : '') + '>' + (y + 543) + '</option>').join('') + '</select></span>';
      else if (S.rm === 'year') pick = '<span class="k8ai-pk2"><select aria-label="ปี" onchange="k8AiAnchor(\'y\', this.value)">' + [0, 1, 2, 3].map((k) => yNow - k).map((y) => '<option value="' + y + '"' + (y === d.getFullYear() ? ' selected' : '') + '>' + (y + 543) + '</option>').join('') + '</select></span>';
      nav = '<div class="k8ai-nav"><button type="button" class="k8ai-nb" aria-label="ช่วงก่อนหน้า" onclick="k8AiShift(-1)">' + SV(ICN.l) + '</button><div class="k8ai-nl"><b>' + esc(r.label) + '</b>' + pick + '</div><button type="button" class="k8ai-nb" aria-label="ช่วงถัดไป" onclick="k8AiShift(1)"' + (canNext ? '' : ' disabled') + '>' + SV(ICN.r) + '</button></div>';
    }
    const scL = SC.filter((x) => !S.schQ || x.name.toLowerCase().indexOf(S.schQ.toLowerCase()) !== -1);
    const gCount = {}; filterStudents(normF({ schools: f.schools, gender: f.gender })).forEach((s) => { const g = gNum(s.grade); if (g) gCount[g] = (gCount[g] || 0) + 1; });
    const st = f.sid ? studentById(f.sid) : null;
    const pool = stuPool(); const sug = !st && S.stuQ ? findStudents(S.stuQ, 40).filter((s) => pool.indexOf(s) !== -1).slice(0, 8) : [];
    el.innerHTML = '<div class="k8ai-sh"><b>ตัวกรอง</b><button type="button" class="k8ai-only-m k8ai-x0" onclick="k8AiPanel(false)" aria-label="ปิดตัวกรอง">' + SV(ICN.x) + '</button></div>' +
      '<section class="k8ai-fs"><h3>ช่วงเวลา</h3>' + seg('ช่วงเวลา', [['day', 'วัน'], ['week', 'สัปดาห์'], ['month', 'เดือน'], ['term', 'ภาคเรียน'], ['year', 'ปี'], ['custom', 'กำหนดเอง']], S.rm, 'k8AiMode') + nav + '</section>' +
      '<section class="k8ai-fs"><h3>โรงเรียน <small>' + (f.schools.length ? 'เลือก ' + f.schools.length : 'ทั้งหมด ' + SC.length) + '</small>' + (f.schools.length ? '<button type="button" class="k8ai-clr" onclick="k8AiSch(null)">ล้าง</button>' : '') + '</h3>' +
      (SC.length > 6 ? '<label class="k8ai-srch">' + SV(ICN.search, 16) + '<input type="search" placeholder="ค้นหาโรงเรียน" value="' + esc(S.schQ) + '" oninput="k8AiSchQ(this)" aria-label="ค้นหาโรงเรียน"></label>' : '') +
      '<div class="k8ai-ckl">' + (scL.length ? scL.map((x) => '<label><input type="checkbox"' + (f.schools.indexOf(x.name) !== -1 ? ' checked' : '') + ' onchange="k8AiSch(' + esc(JSON.stringify(x.name)) + ')"><span>' + esc(x.name) + '</span><em>' + x.students + '</em></label>').join('') : '<p class="k8ai-empty">ไม่พบโรงเรียน</p>') + '</div></section>' +
      '<section class="k8ai-fs"><h3>ชั้นปี' + (f.grades.length ? '<button type="button" class="k8ai-clr" onclick="k8AiGrade(null)">ล้าง</button>' : '') + '</h3><div class="k8ai-gch">' + ['1', '2', '3', '4', '5', '6'].map((g) => '<button type="button" aria-pressed="' + (f.grades.indexOf(g) !== -1) + '" onclick="k8AiGrade(\'' + g + '\')"' + (gCount[g] ? '' : ' class="is-empty"') + '>ม.' + g + '<small>' + (gCount[g] || 0) + '</small></button>').join('') + '</div></section>' +
      '<section class="k8ai-fs"><h3>เพศ</h3>' + seg('เพศ', [['', 'ทั้งหมด'], ['ชาย', 'ชาย'], ['หญิง', 'หญิง']], f.gender, 'k8AiGender') + '</section>' +
      '<section class="k8ai-fs"><h3>นักเรียน <small>' + pool.length + ' คนตามตัวกรอง</small></h3>' + (st ? '<div class="k8ai-stc"><span class="k8ai-av sm">' + esc(bare(st).slice(0, 1)) + '</span><div><b>' + esc(nameOf(st)) + '</b><small>' + esc(shortG(st.grade)) + ' · ' + esc(st.studentId) + '</small></div><button type="button" onclick="k8AiStu(\'\')" aria-label="เอาออก">' + SV(ICN.x, 16) + '</button></div>' :
        '<div class="k8ai-ac"><label class="k8ai-srch">' + SV(ICN.search, 16) + '<input type="search" id="k8AiStuQ" placeholder="พิมพ์ชื่อหรือรหัส" value="' + esc(S.stuQ) + '" oninput="k8AiStuQ(this)" autocomplete="off" aria-label="ค้นหานักเรียน" aria-autocomplete="list"></label>' + (sug.length ? '<ul class="k8ai-acl" role="listbox">' + sug.map((s) => '<li><button type="button" onclick="k8AiStu(\'' + esc(s.studentId) + '\')"><b>' + esc(nameOf(s)) + '</b><small>' + esc(shortG(s.grade)) + ' · ' + esc(s.studentId) + ' · ' + esc(schoolOf(s)) + '</small></button></li>').join('') + '</ul>' : (S.stuQ ? '<p class="k8ai-empty">ไม่พบนักเรียนตามตัวกรองนี้</p>' : '')) + '</div>') + '</section>' +
      '<section class="k8ai-fs"><h3>หัวข้อ</h3><div class="k8ai-tch">' + Object.keys(TOPICS).map((k) => '<button type="button" aria-pressed="' + (f.topic === k) + '" onclick="k8AiTopic(\'' + k + '\')">' + TOPICS[k] + '</button>').join('') + '</div></section>' +
      '<div class="k8ai-fa"><button type="button" class="k8ai-go" onclick="k8AiSummary()">' + SV(ICN.spark) + (st ? 'สรุปข้อมูลนักเรียนคนนี้' : 'สรุปตามตัวกรอง') + '</button>' +
      (!st ? '<button type="button" class="k8ai-go2" aria-expanded="' + S.cmpOpen + '" onclick="k8AiCmpOpen()">เทียบกับกลุ่มอื่น</button>' : '') +
      (S.cmpOpen && !st ? '<div class="k8ai-cmpb"><p>กลุ่ม B</p><select aria-label="โรงเรียนกลุ่ม B" onchange="k8AiCmpB(\'school\', this.value)"><option value="">ทุกโรงเรียน</option>' + SC.map((x) => '<option' + (S.cmpB.school === x.name ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select><div class="k8ai-gch sm">' + ['1', '2', '3', '4', '5', '6'].map((g) => '<button type="button" aria-pressed="' + (S.cmpB.grades.indexOf(g) !== -1) + '" onclick="k8AiCmpB(\'grade\', \'' + g + '\')">ม.' + g + '</button>').join('') + '</div><button type="button" class="k8ai-go" onclick="k8AiCompare()">เทียบ: ' + esc(fTitle(normF(S.f))) + ' กับ ' + esc(fTitle(normF({ schools: S.cmpB.school ? [S.cmpB.school] : [], grades: S.cmpB.grades }))) + '</button></div>' : '') +
      ((f.schools.length || f.grades.length || f.gender || f.sid || f.topic !== 'all') ? '<button type="button" class="k8ai-clr2" onclick="k8AiClear()">ล้างตัวกรองทั้งหมด</button>' : '') + '</div>';
    paintScope();
  }
  function paintScope() {
    const n = (S.f.schools.length ? 1 : 0) + (S.f.grades.length ? 1 : 0) + (S.f.gender ? 1 : 0) + (S.f.sid ? 1 : 0) + (S.f.topic !== 'all' ? 1 : 0);
    const b = $('k8AiFN'); if (b) { b.hidden = !n; b.textContent = n; }
    const st = S.f.sid ? studentById(S.f.sid) : null; const sc = $('k8AiScope'); if (!sc) return;
    const chips = [S.range.label, st ? nameOf(st) : fTitle(normF(S.f))]; if (S.f.topic !== 'all') chips.push(TOPICS[S.f.topic]);
    sc.innerHTML = '<span>ขอบเขต</span>' + chips.map((c) => '<b>' + esc(c) + '</b>').join('') + '<button type="button" class="k8ai-only-m" onclick="k8AiPanel(true)">แก้ไข</button>';
  }
  const repaint = () => { paintSide(); };
  window.k8AiMode = function (m) { S.rm = m; if (m === 'custom' && !S.cf) { S.cf = S.range.from; S.ct = S.range.to; } S.range = rangeOf(m, S.anchor); repaint(); };
  window.k8AiShift = function (d) { S.anchor = shiftAnchor(d); S.range = rangeOf(S.rm, S.anchor); repaint(); };
  window.k8AiAnchor = function (k, v) { if (k === 'm' || k === 'y') { const d = new Date(S.anchor + 'T00:00:00'); if (k === 'm') { d.setDate(1); d.setMonth(+v); } else { d.setFullYear(+v); if (S.rm === 'year') d.setMonth(0, 1); } let n = ymd(d); if (n > today()) n = today(); S.anchor = n; } else if (okDate(k)) S.anchor = k > today() ? today() : k; S.range = rangeOf(S.rm, S.anchor); repaint(); };
  window.k8AiCustom = function (a, b) { if (a) S.cf = a; if (b) S.ct = b; if (S.cf > S.ct) { const x = S.cf; S.cf = S.ct; S.ct = x; } S.range = rangeOf('custom'); repaint(); };
  window.k8AiSch = function (n) { if (n == null) S.f.schools = []; else { const i = S.f.schools.indexOf(n); if (i === -1) S.f.schools.push(n); else S.f.schools.splice(i, 1); } dropStu(); repaint(); };
  let qt = null; window.k8AiSchQ = function (el) { clearTimeout(qt); qt = setTimeout(() => { S.schQ = el.value; const pos = el.selectionStart; paintSide(); const n = document.querySelector('#k8AiSide .k8ai-srch input'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }, 150); };
  window.k8AiGrade = function (g) { if (g == null) S.f.grades = []; else { const i = S.f.grades.indexOf(g); if (i === -1) S.f.grades.push(g); else S.f.grades.splice(i, 1); S.f.grades.sort(); } dropStu(); repaint(); };
  window.k8AiGender = function (g) { S.f.gender = g; dropStu(); repaint(); };
  window.k8AiTopic = function (t) { S.f.topic = t; repaint(); };
  function dropStu() { if (S.f.sid) { const s = studentById(S.f.sid); if (!s || stuPool().indexOf(s) === -1) S.f.sid = ''; } }
  let qt2 = null; window.k8AiStuQ = function (el) { clearTimeout(qt2); qt2 = setTimeout(() => { S.stuQ = el.value; const pos = el.selectionStart; paintSide(); const n = $('k8AiStuQ'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }, 150); };
  window.k8AiStu = function (sid) { S.f.sid = sid || ''; S.stuQ = ''; repaint(); };
  window.k8AiClear = function () { S.f = { schools: [], grades: [], gender: '', topic: 'all', sid: '' }; S.schQ = ''; S.stuQ = ''; S.cmpOpen = false; repaint(); };
  window.k8AiCmpOpen = function () { S.cmpOpen = !S.cmpOpen; repaint(); };
  window.k8AiCmpB = function (k, v) { if (k === 'school') S.cmpB.school = v; else { const i = S.cmpB.grades.indexOf(v); if (i === -1) S.cmpB.grades.push(v); else S.cmpB.grades.splice(i, 1); S.cmpB.grades.sort(); } repaint(); };
  window.k8AiPanel = function (on) { const e = $('k8Ai'); if (e) e.classList.toggle('is-panel', !!on); if (on) setTimeout(() => { const b = document.querySelector('#k8AiSide .k8ai-x0'); if (b) b.focus(); }, 50); };
  const specRange = () => ({ from: S.range.from, to: S.range.to });
  window.k8AiSummary = function () {
    window.k8AiPanel(false); const st = S.f.sid ? studentById(S.f.sid) : null;
    if (st) return window.k8AiAct(JSON.stringify({ t: 'student', sid: st.studentId, topic: S.f.topic, r: specRange() }), 'สรุปข้อมูล ' + nameOf(st) + ' · ' + S.range.label + (S.f.topic !== 'all' ? ' · ' + TOPICS[S.f.topic] : ''));
    const F = normF(S.f); window.k8AiAct(JSON.stringify({ t: 'group', f: { schools: F.schools, grades: F.grades, gender: F.gender, topic: F.topic }, r: specRange() }), 'สรุป ' + fTitle(F) + ' · ' + S.range.label + (F.topic !== 'all' ? ' · ' + TOPICS[F.topic] : ''));
  };
  window.k8AiCompare = function () {
    window.k8AiPanel(false); const A = normF(S.f), B = normF({ schools: S.cmpB.school ? [S.cmpB.school] : [], grades: S.cmpB.grades });
    window.k8AiAct(JSON.stringify({ t: 'compare', a: { school: A.schools.join(','), grade: A.grades.join(','), gender: A.gender }, b: { school: B.schools.join(','), grade: B.grades.join(',') }, r: specRange() }), 'เทียบ ' + fTitle(A) + ' กับ ' + fTitle(B) + ' · ' + S.range.label);
  };
  // ---------- บทสนทนา
  function setStatus(t) { const e = document.querySelector('#k8AiLog .k8ai-typing span'); if (e) e.textContent = t; }
  function welcome() {
    const sc = schools(); const st = students(); const s0 = sc[0] ? sc[0].name : ''; const n0 = st[0] ? bare(st[0]).split(' ')[0] : '';
    const sug = [s0 && 'สรุปข้อมูล' + s0 + ' เดือนนี้', n0 && 'ข้อมูลทั้งหมดของ ' + n0 + ' สัปดาห์นี้', 'ใครขาดละหมาดมากที่สุดเดือนนี้', 'เทียบ ม.4 กับ ม.5 เดือนนี้', 'เทียบนักเรียนชายกับหญิง', 'ใครมาเรียนน้อยที่สุด 10 คน'].filter(Boolean);
    const pins = lsGet(LS_P).slice(0, 4);
    return '<div class="k8ai-hi"><span class="k8ai-hii">' + SV(ICN.spark, 22) + '</span><b>ถามข้อมูลนักเรียนได้เลย</b><p>เลือกโรงเรียน ชั้นปี นักเรียน และช่วงเวลาที่แถบตัวกรอง แล้วกด <b>สรุปตามตัวกรอง</b> หรือพิมพ์ถามเป็นภาษาไทย ระบบจะสรุปละหมาด การมาเรียน พฤติกรรม หะละเกาะฮฺ เทียบกับช่วงก่อน พร้อมกราฟและสัญญาณเตือน แล้วบันทึกเป็น Excel / Word / PDF / JPG ได้</p>' +
      (pins.length ? '<h4>รายงานที่ปักหมุด</h4><div class="k8ai-sug">' + pins.map((p, i) => '<button type="button" class="is-pin" onclick="k8AiRunPin(' + i + ')">' + esc(p.title) + '</button>').join('') + '</div>' : '') +
      '<h4>ลองถาม</h4><div class="k8ai-sug">' + sug.map((x) => '<button type="button" onclick="k8AiAsk(' + esc(JSON.stringify(x)) + ')">' + esc(x) + '</button>').join('') + '</div></div>';
  }
  function scrollTo(el) { requestAnimationFrame(() => { if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }); }
  function paintStatus() {
    const st = $('k8AiSt'); if (st) st.textContent = S.ready ? 'Gemini พร้อมใช้งาน' + (S.route === 'vercel' ? ' · ส่งตรงผ่าน Vercel' : ' · ผ่าน Apps Script') : 'โหมดค้นหาในเครื่อง · ตั้งค่า Gemini เพื่อถามแบบอิสระได้มากขึ้น';
    const t = $('k8AiT'); if (t) t.classList.toggle('is-on', !!S.ready);
  }
  async function checkReady() {
    const vq = (async () => { try { const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 6000); const r = await fetch('/api/ai', { cache: 'no-store', signal: ac.signal }); clearTimeout(t); if (!r.ok) return null; const j = await r.json(); return j && j.success ? j : null; } catch (e) { return null; } })();
    const gq = gasApiCall('aiStatus', {}, 20000).catch(() => null);
    const [v, g] = await Promise.all([vq, gq]);
    S.gasReady = !!(g && g.success && g.ready);
    const direct = !!(v && v.ready && g && g.success && g.direct);
    S.route = direct ? 'vercel' : S.gasReady ? 'gas' : ''; S.ready = !!S.route; S.model = (direct ? v.model : g && g.model) || '';
    if (direct) ticket(false); paintStatus();
  }
  window.k8AiOpen = function (q) {
    ensureDom(); const el = $('k8Ai'); el.hidden = false; document.documentElement.classList.add('k8-docs-open'); try { history.pushState({ k8ai: 1 }, ''); } catch (e) {}
    paintSide(); paintBasket(); if (!S.msgs) $('k8AiLog').innerHTML = welcome(); if (S.ready == null) checkReady();
    need(['att', 'bh', 'pr'], S.range.from, S.range.to);
    setTimeout(() => { const t = $('k8AiQ'); if (t && !q && window.matchMedia('(pointer:fine)').matches) t.focus(); }, 60); if (q) window.k8AiAsk(q);
  };
  window.k8AiReset = function () { S.hist = []; S.msgs = 0; Object.keys(CARDS).forEach((k) => { if (S.basket.indexOf(k) === -1) delete CARDS[k]; }); $('k8AiLog').innerHTML = welcome(); };
  window.k8AiAsk = function (q) { const t = $('k8AiQ'); if (t) t.value = q; window.k8AiSend(); };
  window.k8AiAskStudent = function (sid) { const s = studentById(sid); if (!s) return; window.k8AiAct(JSON.stringify({ t: 'student', sid: s.studentId, r: specRange() }), 'ข้อมูลทั้งหมดของ ' + nameOf(s) + ' · ' + S.range.label); };
  window.k8AiWho = function (sid) { try { history.back(); } catch (e) {} setTimeout(() => { try { switchAdminTab('students', document.getElementById('btnAdminTabStudents')); } catch (e) {} setTimeout(() => { try { window.k8PdWho(sid); } catch (e) {} }, 150); }, 120); };
  function bubble(q) {
    const log = $('k8AiLog'); if (!S.msgs) log.innerHTML = ''; S.msgs++;
    const u = document.createElement('div'); u.className = 'k8ai-m is-u'; u.innerHTML = '<p>' + esc(q) + '</p>'; log.appendChild(u);
    const a = document.createElement('div'); a.className = 'k8ai-m is-a'; a.innerHTML = '<p class="k8ai-typing"><i></i><i></i><i></i><span>กำลังคิด…</span></p>'; log.appendChild(a); scrollTo(u);
    return a;
  }
  function finish(a, text, note, ctx) {
    a.innerHTML = (note ? '<p class="k8ai-note">' + esc(note) + '</p>' : '') + (text ? '<div class="k8ai-txt">' + md(text) + '</div>' : '') + ctx.html.join('') + ctx.reps.map((r, i) => renderRep(r, i === ctx.reps.length - 1 ? text : '')).join('');
    S.busy = false; $('k8AiGo').disabled = false; scrollTo(a);
  }
  function pushHist(q) { const H = lsGet(LS_H).filter((x) => x.q !== q); H.unshift({ q, at: Date.now() }); lsSet(LS_H, H.slice(0, 30)); }
  window.k8AiSend = async function () {
    const t = $('k8AiQ'); const q = String((t && t.value) || '').trim(); if (!q || S.busy) return;
    S.busy = true; t.value = ''; t.style.height = 'auto'; $('k8AiGo').disabled = true; stopMic(); pushHist(q);
    const a = bubble(q); const ctx = { reps: [], html: [], usage: { in: 0, out: 0 } }; let text = '', note = '';
    try {
      if (S.ready == null) await checkReady();
      if (S.ready) {
        try { text = await askGemini(q, ctx); if (S.route === 'vercel') gasApiCall('aiLog', { data: { q, model: S.model + ' (vercel)', usage: { promptTokenCount: ctx.usage.in, candidatesTokenCount: ctx.usage.out } } }, 20000).catch(() => {}); }
        catch (e) { note = e.code === 'NO_KEY' ? '' : 'Gemini ตอบไม่ได้ (' + (e.message || e.code || 'error') + ') · ใช้การค้นหาในเครื่องแทน'; if (e.code === 'NO_KEY') { S.ready = false; paintStatus(); } ctx.reps = []; text = await askLocal(q, ctx); }
      } else text = await askLocal(q, ctx);
    } catch (e) { console.warn('k8Ai', e); text = 'เกิดข้อผิดพลาด: ' + (e && e.message || e); }
    finish(a, text, note, ctx);
  };
  // ปุ่มสรุป/ถามต่อ/ปักหมุด: เรียกรายงานโดยตรง (เร็ว ไม่ต้องรอ AI)
  window.k8AiAct = async function (specJson, label) {
    if (S.busy) return; let spec; try { spec = JSON.parse(specJson); } catch (e) { return; }
    S.busy = true; $('k8AiGo').disabled = true; const a = bubble(label); const ctx = { reps: [], html: [] }; let text = '';
    try {
      const rep = await runSpec(spec); if (rep.error) text = rep.error; else { ctx.reps.push(rep); const lb = rangeTxt(rep.from, rep.to); text = rep.kind === 'student' ? localStudentText(rep, ' ' + lb) : rep.kind === 'group' ? localGroupText(rep, ' ' + lb) : rep.kind === 'rank' ? rep.title + (rep.rows[0] ? ' · อันดับแรกคือ **' + nameOf(rep.rows[0].st) + '** (' + METRIC[rep.metric].txt(rep.rows[0]) + ')' : '') : 'เทียบ **' + rep.A.title + '** กับ **' + rep.B.title + '** ช่วง ' + lb; }
      // ให้ AI รู้บริบทล่าสุด (ถามต่อแบบพิมพ์ได้)
      if (S.ready && !rep.error) S.hist.push({ role: 'user', parts: [{ text: '[ผู้ใช้เปิดรายงาน: ' + label + ']' }] }, { role: 'model', parts: [{ text: 'สรุปข้อมูล: ' + JSON.stringify(compact(rep)).slice(0, 6000) }] });
    } catch (e) { console.warn('k8AiAct', e); text = 'เกิดข้อผิดพลาด: ' + (e && e.message || e); }
    finish(a, text, '', ctx);
  };
  // ---------- ส่งออก
  function baseName(rep, D) { return (rep.kind === 'student' ? 'ข้อมูลนักเรียน_' : rep.kind === 'rank' ? 'อันดับ_' : rep.kind === 'compare' ? 'เปรียบเทียบ_' : 'สรุป_') + safeName(D.name) + '_' + rep.from + (rep.from !== rep.to ? '_' + rep.to : ''); }
  async function exportFmts(F, D, base, btn) {
    const old = btn ? btn.textContent : ''; if (btn) btn.disabled = true; const done = [];
    for (const f of F) { if (btn) btn.textContent = 'กำลังสร้าง ' + K.label[f] + '…'; try { await K.run(f, D, base); done.push(K.label[f]); await new Promise((r) => setTimeout(r, 400)); } catch (e) { console.warn('export', f, e); toast('สร้างไฟล์ ' + K.label[f] + ' ไม่สำเร็จ' + (/load/.test(String(e && e.message)) ? ' (ต้องต่อเน็ต)' : ''), 'error'); } }
    if (btn) { btn.disabled = false; btn.textContent = old; } if (done.length) toast('บันทึกไฟล์แล้ว: ' + done.join(', '), 'success');
  }
  window.k8AiExport = async function (id, btn) {
    const C = CARDS[id]; if (!C) return; const F = Array.from(btn.closest('.k8ai-x').querySelectorAll('input:checked')).map((i) => i.value);
    if (!F.length) { toast('เลือกชนิดไฟล์อย่างน้อย 1 แบบ', 'warning'); return; }
    const D = docOf(C.rep, C.aiText); if (D) await exportFmts(F, D, baseName(C.rep, D), btn);
  };
  // ---------- รายงานรวม (ตะกร้า)
  function cardTitle(rep) { return rep.kind === 'student' ? nameOf(rep.st) : rep.kind === 'group' ? rep.title : rep.kind === 'rank' ? rep.title : rep.title; }
  function paintBasket() {
    const el = $('k8AiBk'); if (!el) return; S.basket = S.basket.filter((k) => CARDS[k]);
    document.querySelectorAll('#k8AiLog .k8ai-card').forEach((c) => { const b = c.querySelector('.k8ai-ib[onclick^="k8AiBasket"]'); if (b) b.setAttribute('aria-pressed', String(S.basket.indexOf(c.dataset.card) !== -1)); });
    if (!S.basket.length) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<div class="k8ai-bkh">' + SV(ICN.doc) + '<b>รายงานรวม ' + S.basket.length + ' รายการ</b><span class="k8ai-bkl">' + S.basket.map((k) => '<em>' + esc(cardTitle(CARDS[k].rep)) + '<button type="button" onclick="k8AiBasket(\'' + k + '\')" aria-label="เอาออก">' + SV(ICN.x, 12) + '</button></em>').join('') + '</span></div>' +
      '<div class="k8ai-x k8ai-bkx"><div class="k8ai-xf">' + [['xlsx', 'Excel'], ['doc', 'Word'], ['pdf', 'PDF'], ['jpg', 'JPG']].map(([k, l]) => '<label><input type="checkbox" value="' + k + '"' + (k === 'pdf' ? ' checked' : '') + '><i>' + l + '</i></label>').join('') + '</div><button type="button" onclick="k8AiExportAll(this)">บันทึกเป็นไฟล์เดียว</button><button type="button" class="k8ai-bkc" onclick="k8AiBasketClear()">ล้าง</button></div>';
  }
  window.k8AiBasket = function (id) { const i = S.basket.indexOf(id); if (i === -1) { S.basket.push(id); toast('เพิ่มในรายงานรวมแล้ว (' + S.basket.length + ')'); } else S.basket.splice(i, 1); paintBasket(); };
  window.k8AiBasketClear = function () { S.basket = []; paintBasket(); };
  window.k8AiExportAll = async function (btn) {
    const F = Array.from(btn.closest('.k8ai-x').querySelectorAll('input:checked')).map((i) => i.value); if (!F.length) { toast('เลือกชนิดไฟล์อย่างน้อย 1 แบบ', 'warning'); return; }
    const L = S.basket.map((k) => CARDS[k] && docOf(CARDS[k].rep, CARDS[k].aiText)).filter(Boolean); if (!L.length) return;
    const D = L.length === 1 ? L[0] : combineDocs(L); await exportFmts(F, D, 'รายงานรวม_' + today(), btn);
  };
  // ---------- ปักหมุด / ประวัติ
  window.k8AiPin = function (id, btn) {
    const C = CARDS[id]; if (!C || !C.rep.spec) return; const P = lsGet(LS_P); const sp = C.rep.spec;
    const title = cardTitle(C.rep) + (sp.topic && sp.topic !== 'all' ? ' · ' + TOPICS[sp.topic] : '') + ' · ' + ({ day: 'รายวัน', week: 'รายสัปดาห์', month: 'รายเดือน', term: 'ภาคเรียน', year: 'รายปี' }[sp.rm] || rangeTxt(sp.r.from, sp.r.to));
    const key = JSON.stringify(Object.assign({}, sp, { r: sp.rm === 'custom' ? sp.r : null }));
    const i = P.findIndex((x) => x.key === key);
    if (i !== -1) { P.splice(i, 1); toast('เลิกปักหมุดแล้ว'); if (btn) btn.setAttribute('aria-pressed', 'false'); } else { P.unshift({ key, title, spec: sp, at: Date.now() }); toast('ปักหมุดแล้ว · เปิดได้จากปุ่ม "ประวัติ"', 'success'); if (btn) btn.setAttribute('aria-pressed', 'true'); }
    lsSet(LS_P, P.slice(0, 20));
  };
  window.k8AiRunPin = function (i) {
    const p = lsGet(LS_P)[i]; if (!p) return; const sp = Object.assign({}, p.spec);
    if (sp.rm && sp.rm !== 'custom') { const r = sp.rm === 'term' ? rangeOf('term') : rangeOf(sp.rm, today()); sp.r = { from: r.from, to: r.to }; }
    window.k8AiDrawer(''); window.k8AiAct(JSON.stringify(sp), p.title + ' · ' + rangeTxt(sp.r.from, sp.r.to));
  };
  window.k8AiDrawer = function (tab) {
    const el = $('k8AiDw'); if (!el) return; if (!tab) { el.hidden = true; return; }
    const P = lsGet(LS_P), H = lsGet(LS_H);
    const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'เมื่อสักครู่' : m < 60 ? m + ' นาทีที่แล้ว' : m < 1440 ? Math.round(m / 60) + ' ชั่วโมงที่แล้ว' : Math.round(m / 1440) + ' วันที่แล้ว'; };
    el.hidden = false;
    el.innerHTML = '<div class="k8ai-dwi"><header><b>ประวัติ</b><button type="button" onclick="k8AiDrawer(\'\')" aria-label="ปิด">' + SV(ICN.x) + '</button></header><div class="k8ai-seg" role="tablist"><button type="button" role="tab" aria-pressed="' + (tab === 'pins') + '" onclick="k8AiDrawer(\'pins\')">ปักหมุด ' + P.length + '</button><button type="button" role="tab" aria-pressed="' + (tab === 'hist') + '" onclick="k8AiDrawer(\'hist\')">คำถามล่าสุด ' + H.length + '</button></div>' +
      (tab === 'pins' ? (P.length ? '<ul class="k8ai-dl">' + P.map((p, i) => '<li><button type="button" onclick="k8AiRunPin(' + i + ')"><b>' + esc(p.title) + '</b><small>ปักหมุด ' + ago(p.at) + ' · เปิดด้วยช่วงเวลาปัจจุบัน</small></button><button type="button" class="k8ai-dx" onclick="k8AiUnpin(' + i + ')" aria-label="เลิกปักหมุด">' + SV(ICN.x, 14) + '</button></li>').join('') + '</ul>' : '<p class="k8ai-empty">ยังไม่มีรายงานที่ปักหมุด · กดปุ่ม "ปักหมุด" ที่มุมการ์ดเพื่อเก็บไว้เปิดซ้ำ</p>') :
        (H.length ? '<ul class="k8ai-dl">' + H.map((h, i) => '<li><button type="button" onclick="k8AiDrawer(\'\');k8AiAsk(' + esc(JSON.stringify(h.q)) + ')"><b>' + esc(h.q) + '</b><small>' + ago(h.at) + '</small></button></li>').join('') + '</ul><button type="button" class="k8ai-clr2" onclick="k8AiHistClear()">ล้างประวัติคำถาม</button>' : '<p class="k8ai-empty">ยังไม่มีคำถาม</p>')) + '</div>';
    setTimeout(() => { const b = el.querySelector('header button'); if (b) b.focus(); }, 30);
  };
  window.k8AiUnpin = function (i) { const P = lsGet(LS_P); P.splice(i, 1); lsSet(LS_P, P); window.k8AiDrawer('pins'); };
  window.k8AiHistClear = function () { lsSet(LS_H, []); window.k8AiDrawer('hist'); };
  // ---------- พูดถามด้วยเสียง
  let REC = null;
  function stopMic() { if (REC) { try { REC.stop(); } catch (e) {} REC = null; } const b = $('k8AiMic'); if (b) b.classList.remove('is-on'); }
  window.k8AiMic = function () {
    if (REC) { stopMic(); return; } const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    const r = new SR(); r.lang = 'th-TH'; r.interimResults = true; r.continuous = false; const t = $('k8AiQ'); const base = t.value ? t.value + ' ' : '';
    r.onresult = (e) => { let s = ''; for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript; t.value = base + s; t.dispatchEvent(new Event('input')); };
    r.onerror = (e) => { stopMic(); if (e.error === 'not-allowed') toast('ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน', 'warning'); };
    r.onend = () => { stopMic(); if (t.value.trim()) t.focus(); };
    try { r.start(); REC = r; $('k8AiMic').classList.add('is-on'); toast('กำลังฟัง… พูดคำถามได้เลย'); } catch (e) { stopMic(); }
  };
  document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; const dw = $('k8AiDw'); if (dw && !dw.hidden) { window.k8AiDrawer(''); return; } const el = $('k8Ai'); if (el && el.classList.contains('is-panel')) window.k8AiPanel(false); });
  // สำหรับทดสอบ/ต่อยอด
  window.k8AiApi = { studentReport, groupReport, rankReport, compareReport, runSpec, findStudents, matchSchool, rangeFromText, rangeOf, docOf, combineDocs, compact, schools, state: S };
})();
