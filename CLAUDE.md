# CLAUDE.md — คู่มือสำหรับ coding agent

ไฟล์นี้ช่วยให้ Claude Code (หรือ agent อื่น) ทำงานกับ repo นี้ได้ถูกต้องและเร็วขึ้น

## ภาพรวม

แอป **Med Error & DRP** (v0.9) สำหรับห้องยา OPD — Next.js 15 (App Router) + React 19 + TypeScript,
เชื่อม Supabase, deploy บน Cloudflare Workers (OpenNext) ภาษา UI เป็น **ไทย** (ศัพท์เทคนิคอังกฤษ)

โปรเจกต์นี้เกิดจากการ implement ดีไซน์ที่ทำใน Claude Design:
- ดีไซน์ต้นฉบับ (prototype HTML/CSS/JS แบบ DC): `project/Med Error DRP.dc.html`
- บทสนทนาการออกแบบ (เจตนาผู้ใช้): `chats/chat1.md`
- **ถ้าจะแก้ UI ให้ยึดดีไซน์ต้นฉบับเป็นความจริง** แล้ว match ให้ pixel-perfect

## คำสั่งที่ใช้บ่อย

```bash
npm run dev         # dev server (http://localhost:3000)
npm run build       # production build + typecheck
npm run cf:preview  # จำลอง Cloudflare Worker ในเครื่อง
npm run cf:deploy   # deploy ขึ้น Cloudflare (ต้อง wrangler login)
```

- **Typecheck คือ gate หลัก** — `npm run build` รัน `tsc` (strict) ถ้าผ่านคือ type ถูก
- ESLint ถูกปิดตอน build (`eslint.ignoreDuringBuilds`) เพราะใช้ inline-style จากดีไซน์ อย่าไปตั้ง lint ให้ fail build

## สถาปัตยกรรม (สำคัญ)

- **`components/MedDrpApp.tsx`** = แอปทั้งหมดในไฟล์เดียว (client component)
  - พอร์ตตรงจากคลาส `DCLogic` ของดีไซน์: `state` เดียว + `setState(u)` helper ที่ merge partial (เลียนแบบ React class `this.setState`)
  - อ่านค่า state ปัจจุบันแบบ sync ผ่าน `stateRef.current` (สำหรับ async เช่น `save`, `saveEdit`, `loadRecords`)
  - ค่า derived (kpis, bars, breakdowns, recRows, detailRows, historyList) คำนวณในบอดี้ render — ตรงกับ `renderVals()` เดิม
  - แต่ละหน้าเป็นฟังก์ชัน `renderForm/renderDashboard/renderRecords/renderSettings/renderDetailModal/renderEditMode`
  - **gate `mounted`**: render `<div>` ว่างก่อน mount เพื่อกัน hydration mismatch (โค้ดพึ่ง `Date`/`localStorage`)
- **`lib/style.ts` `css(str)`** = แปลง CSS declaration string จากดีไซน์ → React.CSSProperties
  ใช้เพื่อคง inline-style เดิมแบบ pixel-perfect (ห้ามใช้กับ string ที่มี data-URI ที่มี `;`)
- **`components/ui.tsx`** = wrapper ที่ทำ `:hover`/`:focus` (ซึ่ง inline style ทำไม่ได้):
  `HButton/HInput/HTextarea/HSelect/HDiv/HTr/HFileLabel` รับ `base`/`hover`/`focus` เป็น CSS string
- **`lib/data.ts`** = Supabase client (`@supabase/supabase-js`) + `fetchIncidents/insertIncident/updateIncident` + `toRow`
- **`lib/constants.ts`** = ค่าคงที่ทั้งหมด (แก้ dropdown/ชิป/คำอธิบายที่นี่)

## รูปแบบข้อมูล (`lib/types.ts` → `Incident`)

- ตารางเดียว `incidents` แยก Med/DRP ด้วย `type: 'med' | 'drp'`
- `error_nature` และ `drugs` เป็น **array** (jsonb) — โค้ดรองรับข้อมูลเก่าที่เป็น string ด้วย (ดู `helpers.natureText/drugArr`)
- ประวัติแก้ไขเก็บใน `history[]` (snapshot ก่อนแก้ พร้อม `saved_at`)
- คีย์ localStorage: `meddrp_records_v3`, `meddrp_cfg`, `meddrp_draft`

## การเชื่อม Supabase

- config มาจาก (ลำดับความสำคัญ) หน้า **ตั้งค่า** (localStorage `meddrp_cfg`) → env `NEXT_PUBLIC_SUPABASE_*`
- ถ้าไม่มี config → **โหมด demo** (seed 100 เคสในเครื่อง)
- `loadRecords`: โชว์ข้อมูล local ก่อนทันที แล้วค่อย fetch Supabase มาทับเบื้องหลัง (ห้ามทำให้ network บล็อก UI)
- ตาราง/RLS อยู่ที่ `supabase/schema.sql` · ใช้ Supabase MCP tools กับ project id `ryewggkhunpuipgkgbfv`

## ข้อควรระวัง

- **อย่าเปลี่ยนสี/ระยะ/รัศมี** ให้ตรวจกับดีไซน์ต้นฉบับก่อน (teal `#0F8A80`/`#0B655D`, amber `#F5A623`)
- แก้ฟิลด์ใหม่ต้องอัปเดต 5 จุดให้ครบ: form state (`emptyForm`) → save → `toRow`/`COLS` → schema → detail/records/CSV
- HN ต้องเป็นตัวเลขล้วน (`.replace(/\D/g,'')`)
- ก่อน commit: `npm run build` ต้องผ่าน
