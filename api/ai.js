// KHALIFAH · ผู้ช่วย AI: ยิง Gemini ตรงจาก Vercel (v19.07)
// Environment Variables ที่ต้องตั้งใน Vercel (Project → Settings → Environment Variables):
//   GEMINI_API_KEY      คีย์จาก Google AI Studio (จำเป็น)
//   AI_SHARED_SECRET    ข้อความลับยาว ๆ ค่าเดียวกับ Script Property AI_SHARED_SECRET ใน Apps Script (จำเป็น)
//   GEMINI_MODEL        ไม่บังคับ (ค่าเริ่มต้น gemini-3.8-flash)
// แอปขอ "บัตรผ่าน" จาก Code.gs ครั้งเดียว (ยืนยันว่าเป็นแอดมิน · อายุ 30 นาที) แล้วส่งคำถามมาที่นี่โดยตรง
const crypto = require('crypto');

const RL = new Map(); // จำกัดความถี่ต่อผู้ใช้ (ต่ออินสแตนซ์)
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

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
  const payload = JSON.stringify(g);
  if (payload.length > 400000) return res.status(200).json({ success: false, code: 'TOO_LARGE', message: 'ข้อมูลที่ส่งให้ AI ยาวเกินไป ลองแคบช่วงวันหรือถามทีละเรื่อง' });
  const mk = String(who.u) + ':' + Math.floor(Date.now() / 60000); const n = (RL.get(mk) || 0) + 1; RL.set(mk, n);
  if (RL.size > 500) { for (const k of RL.keys()) { if (!k.endsWith(':' + Math.floor(Date.now() / 60000))) RL.delete(k); } }
  if (n > 30) return res.status(200).json({ success: false, code: 'RATE', message: 'ถามถี่เกินไป รอสักครู่แล้วลองใหม่' });
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 55000);
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(MODEL) + ':generateContent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body: payload, signal: ac.signal
    });
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
    if (!r.ok || !j) {
      const msg = (j && j.error && j.error.message) || ('HTTP ' + r.status);
      return res.status(200).json({ success: false, code: r.status === 429 ? 'QUOTA' : (r.status === 400 || r.status === 403) ? 'BAD_KEY_OR_REQUEST' : 'AI_ERROR', status: r.status, message: String(msg).slice(0, 300) });
    }
    const cand = (j.candidates || [])[0] || {};
    return res.status(200).json({ success: true, via: 'vercel', model: MODEL, content: cand.content || { role: 'model', parts: [] }, finishReason: cand.finishReason || '', usage: j.usageMetadata || null });
  } catch (e) {
    return res.status(200).json({ success: false, code: e && e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK', message: 'ติดต่อ Gemini ไม่ได้: ' + String((e && e.message) || e).slice(0, 200) });
  } finally { clearTimeout(to); }
};
module.exports.verifyTicket = verifyTicket;
