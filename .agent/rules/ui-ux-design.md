# UI/UX Design Intelligence & Auto-Trigger Rules

## Trigger Keywords & Contexts
Whenever the user mentions or implies any of the following triggers:
- Keywords: `UXUI`, `ui`, `uxui`, `UI/UX`, `ดีไซน์`, `ออกแบบ`
- Aesthetic requests: `ออกแบบให้สวย`, `ทำ UI ใหม่`, `ปรับหน้าตา`, `มินิมอล`, `คลีนๆ`
- Critiques: `ยังไม่สวย` (Treat directly as a request to redesign to be modern, elegant, clean, and beautiful)
- Craft quality: `ดูไม่เหมือนเอไอ` (Human-crafted look, avoid generic AI website/component generator aesthetics)

## Action & Intelligence Skills to Consult
When any trigger above is present in the conversation, the agent MUST immediately consult and apply the design frameworks from the installed design skills in `.agent/skills/`:
1. **`ui-ux-pro-max`** (`.agent/skills/ui-ux-pro-max/SKILL.md`): Design styles, palettes, font pairings, chart styles, and component stacks.
2. **`ui-ux-design-pro`** (`.agent/skills/ui-ux-design-pro/SKILL.md`): Token architecture, depth & elevation, micro-interactions, accessibility, component patterns, and critique protocols.
3. **Jakubkrehel Design Suite** (`better-ui`, `better-typography`, `better-colors`, `better-layout`, `better-interface`, `build-design`, `interface-review`, `variant`):
   - `better-typography`: Optical rhythm, line-height, hierarchy, font pairing.
   - `better-colors`: Cohesive, intentional semantic palettes (avoiding rainbow colors).
   - `better-layout`: Intentional negative space, rhythm, responsive density.
   - `better-interface`: Human-crafted state transitions, feedback, empty states.

---

## Design Principles: "ดูไม่เหมือนเอไอ" (Human-Crafted & Anti-AI Aesthetic)

1. **Avoid Generic AI Clichés**:
   - NO clunky saturated neon purple/blue glassmorphism gradients on every card.
   - NO random rainbow badges or multi-colored icons that create visual noise.
   - NO generic template look with bloated paddings and arbitrary rounded pills.
   - NO low-contrast grey-on-white text that harms readability.

2. **Clean, Minimalist & Human-Crafted Aesthetic**:
   - **Typography & Scale**: Crisp, balanced typographic hierarchy with Thai-friendly legible fonts (e.g., Sarabun, Prompt, Inter/Sukhumvit). Clean line-height and letter-spacing.
   - **Monochrome & Subdued Accent**: Clean white/neutral background with deep graphite/slate text, and a single intentional accent color (such as sophisticated emerald or warm charcoal/indigo) used purposefully.
   - **Icons**: Monochrome or neutral stroke icons (Feather / Lucide style) that feel unified, elegant, and never compete with text.
   - **Borders & Elevation**: Crisp 1px subtle borders (`border: 1px solid rgba(0,0,0,0.06)` or `#e5e7eb`) with delicate, soft ambient shadows rather than harsh drop shadows.
   - **Rhythm & Proportions**: Purposeful whitespace (4px, 8px, 12px, 16px, 24px grid) where elements breathe naturally.

3. **Engineering Integrity**:
   - Preserve all business logic, DOM IDs, event handlers, and data structures in `index.html`, `app.js`, and `style.css`.
   - Never break working features (QR scanner, student lists, prayer check, filters, export/import, sync status) when restyling.
