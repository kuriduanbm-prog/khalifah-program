// KHALIFAH · ผู้ช่วย AI: ยิง Gemini ตรงจาก Vercel (v19.07)
// Environment Variables ที่ต้องตั้งใน Vercel (Project → Settings → Environment Variables):
//   GEMINI_API_KEY      คีย์จาก Google AI Studio (จำเป็น)
//   AI_SHARED_SECRET    ข้อความลับยาว ๆ ค่าเดียวกับ Script Property AI_SHARED_SECRET ใน Apps Script (จำเป็น)
//   GEMINI_MODEL        ไม่บังคับ (ค่าเริ่มต้น gemini-3.8-flash)
//   GEMINI_FALLBACK_MODELS ไม่บังคับ · รุ่นสำรองเมื่อรุ่นหลักมีคนใช้เยอะ คั่นด้วย , (ค่าเริ่มต้น gemini-flash-latest,gemini-2.5-flash)
// แอปขอ "บัตรผ่าน" จาก Code.gs ครั้งเดียว (ยืนยันว่าเป็นแอดมิน · อายุ 30 นาที) แล้วส่งคำถามมาที่นี่โดยตรง
const crypto = require('crypto');

const RL = new Map(); // จำกัดความถี่ต่อผู้ใช้ (ต่ออินสแตนซ์)
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// v19.29 · ให้ตอบเร็วขึ้น: ลดการ "คิด" ของโมเดล (Gemini 3 = thinkingLevel low · 2.5 Flash = ปิด · 2.5 Pro = ขั้นต่ำ)
function fastThinking(model) {
  const m = String(model || '').toLowerCase();
  if (/gemini-3/.test(m)) return { thinkingLevel: 'low' };
  if (/2\.5-flash/.test(m)) return { thinkingBudget: 0 };
  if (/2\.5-pro/.test(m)) return { thinkingBudget: 128 };
  return null;
}
function verifyTicket(t, secret) {
  if (typeof t !== 'string' || t.length > 2000 || t.indexOf('.') < 1) return null;
  const [p, sig] = t.split('.');
  const want = b64u(crypto.createHmac('sha256', secret).update(p).digest());
  const a = Buffer.from(String(sig || '')), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let o = null;
  try { o = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch (e) { return null; }
  if (!o || o.r !== 'admin' || !(o.exp > Date.now())) return null;
  if (o.l && o.l !== 'exec') return null;
  return o;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const KEY = process.env.GEMINI_API_KEY || '';
  const SECRET = process.env.AI_SHARED_SECRET || '';
  const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  if (req.method === 'GET') return res.status(200).json({ success: true, ready: !!(KEY && SECRET), model: MODEL });
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'method' });
  if (!KEY || !SECRET) return res.status(200).json({ success: false, code: 'NO_KEY', message: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY / AI_SHARED_SECRET ใน Vercel' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ success: false, message: 'bad body' });
  const who = verifyTicket(body.ticket, SECRET);
  if (!who) return res.status(200).json({ success: false, code: 'TICKET', message: 'บัตรผ่านหมดอายุหรือไม่ถูกต้อง' });
  const contents = Array.isArray(body.contents) ? body.contents : [];
  if (!contents.length || contents.length > 60) return res.status(400).json({ success: false, message: 'บทสนทนาไม่ถูกต้อง' });
  const g = { contents };
  if (body.system) g.systemInstruction = { parts: [{ text: String(body.system).slice(0, 12000) }] };
  if (Array.isArray(body.tools) && body.tools.length) g.tools = [{ functionDeclarations: body.tools.slice(0, 20) }];
  // v19.23 · ตั้งค่าการตอบ (เช่น ขอผลเป็น JSON) + รองรับรูปภาพ (inlineData) สำหรับอ่านรูปตารางสอน
  const gc = body.generationConfig && typeof body.generationConfig === 'object' ? body.generationConfig : null;
  if (gc) { const o = {}; if (gc.responseMimeType === 'application/json') o.responseMimeType = 'application/json'; if (typeof gc.temperature === 'number') o.temperature = Math.max(0, Math.min(1, gc.temperature)); if (typeof gc.maxOutputTokens === 'number') o.maxOutputTokens = Math.max(256, Math.min(16384, gc.maxOutputTokens | 0)); if (Object.keys(o).length) g.generationConfig = o; }
  const hasImg = contents.some((c) => c && Array.isArray(c.parts) && c.parts.some((p) => p && p.inlineData));
  const payload = JSON.stringify(g);
  if (payload.length > (hasImg ? 3500000 : 400000)) return res.status(200).json({ success: false, code: 'TOO_LARGE', message: 'ข้อมูลที่ส่งให้ AI ยาวเกินไป ลองแคบช่วงวันหรือถามทีละเรื่อง' });
  const mk = String(who.u) + ':' + Math.floor(Date.now() / 60000); const n = (RL.get(mk) || 0) + 1; RL.set(mk, n);
  if (RL.size > 500) { for (const k of RL.keys()) { if (!k.endsWith(':' + Math.floor(Date.now() / 60000))) RL.delete(k); } }
  if (n > 30) return res.status(200).json({ success: false, code: 'RATE', message: 'ถามถี่เกินไป รอสักครู่แล้วลองใหม่' });
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 55000); const t0 = Date.now();
  // v19.30 · Gemini คนใช้เยอะ (503/500/429 ชั่วคราว) → รอแล้วลองใหม่ 1 ครั้ง แล้วสลับไปรุ่นสำรอง
  const FALL = String(process.env.GEMINI_FALLBACK_MODELS || 'gemini-flash-latest,gemini-2.5-flash').split(',').map((x) => x.trim()).filter((x) => x && x !== MODEL);
  const plan = [MODEL, MODEL].concat(FALL);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const call = async (model) => {
    const tc = body.deep ? null : fastThinking(model);
    const send = (pl) => fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body: pl, signal: ac.signal });
    let r = await send(tc ? JSON.stringify(Object.assign({}, g, { generationConfig: Object.assign({}, g.generationConfig || {}, { thinkingConfig: tc }) })) : payload);
    let txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
    if (tc && r.status === 400 && /think/i.test(String((j && j.error && j.error.message) || txt))) { r = await send(payload); txt = await r.text(); j = null; try { j = JSON.parse(txt); } catch (e) {} }
    return { r, j, txt };
  };
  const busy = (st, msg) => st === 503 || st === 500 || st === 502 || st === 504 || (st === 429 && /overload|high demand|try again later|resource.?exhausted.*(?:temporar|later)/i.test(msg)) || /high demand|overloaded/i.test(msg);
  try {
    let last = null, used = MODEL;
    for (let i = 0; i < plan.length; i++) {
      if (i && Date.now() - t0 > 38000) break;
      if (i === 1) await sleep(1500);
      used = plan[i];
      const { r, j } = await call(used);
      if (r.ok && j) {
        const cand = (j.candidates || [])[0] || {};
        return res.status(200).json({ success: true, via: 'vercel', model: used, fallback: used !== MODEL, content: cand.content || { role: 'model', parts: [] }, finishReason: cand.finishReason || '', usage: j.usageMetadata || null });
      }
      const msg = String((j && j.error && j.error.message) || ('HTTP ' + r.status));
      last = { st: r.status, msg };
      if (!busy(r.status, msg)) { if (i >= 2 && r.status === 404) continue; break; } // รุ่นสำรองไม่มี → ลองรุ่นถัดไป
    }
    const st = last ? last.st : 0, msg = last ? last.msg : 'AI error';
    const code = busy(st, msg) ? 'BUSY' : st === 429 ? 'QUOTA' : (st === 400 || st === 403) ? 'BAD_KEY_OR_REQUEST' : 'AI_ERROR';
    return res.status(200).json({ success: false, code, status: st, model: used, message: msg.slice(0, 300) });
  } catch (e) {
    return res.status(200).json({ success: false, code: e && e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK', message: 'ติดต่อ Gemini ไม่ได้: ' + String((e && e.message) || e).slice(0, 200) });
  } finally { clearTimeout(to); }
};
module.exports.verifyTicket = verifyTicket;
module.exports.fastThinking = fastThinking;
