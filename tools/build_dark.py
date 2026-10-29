#!/usr/bin/env python3
"""สร้าง dark.css อัตโนมัติจาก style.css + ui-v8.css + สีที่เขียนแบบ inline ใน JS/HTML
ใช้: python3 tools/build_dark.py   (รันใหม่ทุกครั้งที่แก้สีใน CSS)"""
import re, colorsys, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = 'html[data-theme="dark"]'
BG = (11, 18, 32)  # พื้นหลังหลัก

def parse(c):
    c = c.strip().lower()
    if c in ('white',): return (255, 255, 255, 1)
    if c in ('black',): return (0, 0, 0, 1)
    m = re.fullmatch(r'#([0-9a-f]{3,8})', c)
    if m:
        h = m.group(1)
        if len(h) in (3, 4): h = ''.join(x * 2 for x in h)
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
    m = re.fullmatch(r'rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)', c)
    if m:
        a = m.group(4); a = (float(a[:-1]) / 100 if a and a.endswith('%') else float(a)) if a else 1
        return (float(m.group(1)), float(m.group(2)), float(m.group(3)), a)
    return None

def fmt(r, g, b, a):
    r, g, b = [max(0, min(255, round(x))) for x in (r, g, b)]
    return '#%02x%02x%02x' % (r, g, b) if a >= 0.999 else 'rgba(%d,%d,%d,%.3g)' % (r, g, b, a)

def hls(rgb): return colorsys.rgb_to_hls(*(x / 255 for x in rgb[:3]))
def back(h, l, s, a): r, g, b = colorsys.hls_to_rgb(h, l, s); return fmt(r * 255, g * 255, b * 255, a)

def as_bg(c):
    h, l, s = hls(c); a = c[3]
    if l >= 0.80:                       # พื้นสว่าง → พื้นเข้ม (คงโทนสีไว้เล็กน้อย)
        nl = 0.07 + (1 - l) * 0.55
        ns = s * (0.55 if s > 0.2 else 0.25)
        if a < 1 and l > 0.97: return back(h, 0.12, ns, min(1, a + 0.05))
        return back(h, nl if s < 0.2 else min(0.22, nl + 0.04), ns, a)
    return None                          # สีกลาง/เข้ม (เช่นปุ่มฟ้า) คงเดิม

def as_fg(c):
    h, l, s = hls(c); a = c[3]
    if l <= 0.42 and (s < 0.35 or l < 0.25):  # ตัวหนังสือเทาเข้ม/ดำ/กรมท่า → สว่าง
        return back(h, 0.93 - l * 0.55, s * 0.5, a)
    if l <= 0.45:                        # ตัวหนังสือมีสี (เขียว ส้ม แดง ฟ้าเข้ม) → สว่างขึ้นให้อ่านบนพื้นมืด
        return back(h, 0.70, min(1, s * 0.9 + 0.1), a)
    if 0.45 < l < 0.62 and s < 0.3:     # เทากลาง → เทาอ่อน
        return back(h, 0.70, s, a)
    return None

def as_border(c):
    h, l, s = hls(c)
    if l >= 0.75: return back(h, 0.20 + (1 - l) * 0.3, s * 0.4, c[3])
    return None

COLOR_RE = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\bwhite\b')
BG_PROPS = ('background', 'background-color')
BORDER_PROPS = ('border', 'border-color', 'border-top', 'border-bottom', 'border-left', 'border-right', 'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color', 'outline', 'outline-color')
FG_PROPS = ('color', 'fill', 'stroke', '-webkit-text-fill-color', 'caret-color')

def map_value(prop, val):
    if 'url(' in val: return None
    if prop in BG_PROPS: fn = as_bg
    elif prop in BORDER_PROPS: fn = as_border
    elif prop in FG_PROPS: fn = as_fg
    elif prop == 'box-shadow' and 'inset' in val: fn = as_border
    elif prop.startswith('--'):
        cs = [parse(x) for x in COLOR_RE.findall(val)]
        if len(cs) != 1 or not cs[0]: return None
        h, l, s = hls(cs[0])
        fn = as_bg if l >= 0.8 else (as_fg if ((l <= 0.40 and s < 0.65) or (l < 0.62 and s < 0.3)) else None)
        if not fn: return None
    else: return None
    changed = False
    def rep(m):
        nonlocal changed
        c = parse(m.group(0))
        if not c: return m.group(0)
        if 'gradient' in val and prop in BG_PROPS:
            n = as_bg(c)
        else:
            n = fn(c)
        if n: changed = True; return n
        return m.group(0)
    out = COLOR_RE.sub(rep, val)
    if prop == 'background' and changed and 'gradient' not in val:
        # background รวมหลายค่า: ใช้แค่สีเพื่อไม่ทับรูป/ตำแหน่ง
        cs = [x for x in COLOR_RE.findall(out)]
        if cs: return ('background-color', cs[0])
    return (prop, out) if changed else None

def prefix(sel):
    out = []
    for s in [x.strip() for x in split_sel(sel)]:
        if not s: continue
        if s.startswith(':root'): out.append(P + s[5:])
        elif re.match(r'html\b', s): out.append(P + s[4:])
        elif re.match(r'body\b', s): out.append(P + ' ' + s)
        else: out.append(P + ' ' + s)
    return ', '.join(out)

def split_sel(sel):
    depth = 0; cur = ''; res = []
    for ch in sel:
        if ch in '([': depth += 1
        elif ch in ')]': depth -= 1
        if ch == ',' and depth == 0: res.append(cur); cur = ''
        else: cur += ch
    res.append(cur); return res

def process(css):
    css = re.sub(r'/\*[\s\S]*?\*/', '', css)
    out = []; i = 0; n = len(css)
    def block(text):
        res = []; pos = 0
        while pos < len(text):
            ob = text.find('{', pos)
            if ob < 0: break
            sel = text[pos:ob].strip()
            depth = 1; j = ob + 1
            while j < len(text) and depth:
                if text[j] == '{': depth += 1
                elif text[j] == '}': depth -= 1
                j += 1
            body = text[ob + 1:j - 1]
            if sel.startswith('@media') or sel.startswith('@supports'):
                inner = block(body)
                if inner: res.append(sel + ' {\n' + inner + '\n}')
            elif sel.startswith('@'):
                pass
            else:
                decls = []
                for d in body.split(';'):
                    if ':' not in d: continue
                    p, v = d.split(':', 1); p = p.strip().lower(); v = v.replace('!important', '').strip()
                    m = map_value(p, v)
                    if m: decls.append('%s: %s !important' % m)
                if decls and sel: res.append(prefix(sel) + ' { ' + '; '.join(decls) + '; }')
            pos = j
        return '\n'.join(res)
    return block(css)

def inline_rules():
    # สีที่เขียนแบบ inline ใน JS/HTML (style="...") → ใช้ attribute selector
    txt = ''
    for f in ('ui-v8.js', 'app.js', 'index.html'):
        txt += open(os.path.join(ROOT, f), encoding='utf-8').read()
    rules = []; seen = set()
    for prop, fn, out in (('background', as_bg, 'background-color'), ('background-color', as_bg, 'background-color'), ('color', as_fg, 'color'), ('border-color', as_border, 'border-color')):
        for m in re.finditer(r'(?<![\w-])' + re.escape(prop) + r'\s*:\s*(#[0-9a-fA-F]{3,6})\b', txt):
            c = m.group(1).lower()
            key = (prop, c)
            if key in seen: continue
            seen.add(key)
            mc = fn(parse(c)) if parse(c) else None
            if not mc: continue
            sels = []
            for sp in ('', ' '):
                v = prop + ':' + sp + c
                if prop == 'color':
                    sels += ['[style^="%s"]' % v, '[style*="; %s"]' % v, '[style*=";%s"]' % v]
                else:
                    sels += ['[style*="%s"]' % v]
                    sels += ['[style*="%s"]' % (prop + ':' + sp + c.upper())]
            rules.append(', '.join(P + ' ' + s for s in sels) + ' { %s: %s !important; }' % (out, mc))
    return '\n'.join(rules)

if __name__ == '__main__':
    parts = ['/* สร้างอัตโนมัติโดย tools/build_dark.py — อย่าแก้ไฟล์นี้ด้วยมือ (แก้ใน dark-extra ด้านล่างของ ui-v8.css แทน) */']
    for f in ('style.css', 'ui-v8.css'):
        parts.append('/* ---- จาก %s ---- */' % f)
        parts.append(process(open(os.path.join(ROOT, f), encoding='utf-8').read()))
    parts.append('/* ---- inline styles ---- */')
    parts.append(inline_rules())
    base = """$P { color-scheme: dark; }
$P, $P body { background-color: #0b1220 !important; color: #e2e8f0; }
$P input, $P select, $P textarea { background-color: #0f1729 !important; color: #e2e8f0 !important; border-color: #263452 !important; }
$P ::placeholder { color: #64748b !important; }
:where($P) :where(h1, h2, h3, h4, h5, b, strong, dt, dd, th, td, label, p, li, summary, legend) { color: #e2e8f0; }
$P body .mobile-nav, $P body.teacher-portal-active .teacher-bottom-nav-bar, $P body.k8-inspector #view-inspector.active .k8-insp-nav { background: rgba(17,26,46,.62) !important; border-color: rgba(255,255,255,.08) !important; box-shadow: 0 10px 30px rgba(0,0,0,.45) !important; }
$P body .mobile-nav .mobile-nav-item:not(.active), $P body .teacher-bottom-nav-bar .teacher-bottom-nav-item:not(.active) { color: #e2e8f0 !important; }
""".replace('$P', P)
    open(os.path.join(ROOT, 'dark.css'), 'w', encoding='utf-8').write(base + '\n'.join(parts) + '\n')
    print('dark.css', os.path.getsize(os.path.join(ROOT, 'dark.css')), 'bytes')
