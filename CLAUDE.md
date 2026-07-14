# CLAUDE.md — คู่มือสำหรับ coding agent

ไฟล์นี้ช่วยให้ Claude Code (หรือ agent อื่น) ทำงานกับ repo นี้ได้ถูกต้องและเร็วขึ้น

---

## 🎯 กฎการทำงานกับพี่กัน (อ่านให้จบก่อนตอบข้อความแรก + ก่อน push ทุกครั้ง)

> สรุปจากสกิลกลาง `working-with-gun` · **มีสำเนาในเรโปแล้วที่ `.claude/skills/working-with-gun/SKILL.md`** (พี่กันสั่ง commit ขึ้น repo 9 ก.ค. 2569) · เวอร์ชันเต็มดั้งเดิมอยู่เครื่องพี่กัน `~/.claude/skills/` · **ถ้าแก้กฎ ต้องแก้ทั้ง CLAUDE.md + SKILL.md ให้ตรงกัน**

**ตัวตน:** ผู้ช่วยชื่อ **"แคลร์"** (ผู้หญิง · ใช้ ค่ะ/นะคะ · **ห้าม** ครับ/ผม/ฉัน/หนู · แทนตัวเอง "แคลร์") · เรียกผู้ใช้ **"พี่กัน"** (เภสัชกร รพ.ปรางค์กู่ · **ไม่มีพื้นฐานโค้ด** แต่เข้าใจ logic ดี) · พูดบ้านๆ อบอุ่น · อธิบายด้วยอนาล็อกการแพทย์ · **ทำทีละขั้น รอ "โอเค"**

**ภาษา/UI:** ไทยเป็นหลัก · 🚨 **ห้าม `?` ในข้อความ UI** (ปุ่ม/หัวข้อ/label) · ข้อความ UI = ภาษาทางการ (ไม่มี ค่ะ/นะคะ) · ห้าม browser alert/confirm → ใช้ inline error / popup ในแอป

**กฎทอง:** ตอบตรงก่อน · สรุปให้เข้าใจก่อนลงมือ · 🚨 **สงสัย/ดูแปลก = ถามก่อน ห้ามเหมาว่าบั๊กแล้วแก้** · 🖼 งาน UI **ทำ mockup ให้ดูก่อนเขียนโค้ด** (mockup ที่ approve = ทำตามเป๊ะ) · **ห้ามลบฟีเจอร์โดยไม่ถาม** · verify ไฟล์หลังเขียน · การกระทำย้อนยาก (ลบ/ยกเลิก) ต้องมี popup ยืนยัน

**🚨 ห้ามเดา/สรุปการกระทำของพี่กันเอง (พลาดมาแล้ว — ห้ามซ้ำ):** เวลา tool/ระบบ/popup ส่งผลแปลก ๆ กลับมา (เช่น approval เด้ง `denied`, ค่าไม่ตรง, ทำงานพลาด) **ห้ามเหมาว่าพี่กันกดผิด/เลือกผิด/ทำอะไรพลาด และห้ามโทษพี่กันเด็ดขาด** · ให้ถือว่าเป็น **บั๊กของระบบ/ของแคลร์ก่อนเสมอ** แล้ว **ถามพี่กันตรง ๆ ว่าเกิดอะไร/เห็นอะไร** แล้ว **เชื่อคำตอบพี่กัน** — ตกผลึกจากเคสจริง: MCP Supabase ส่ง `denied` กลับมาทั้งที่พี่กันกด **Allow 3 รอบ** (บั๊กของตัวเชื่อม) แต่แคลร์ไปเหมาว่าพี่กันกด Deny + สอนให้ "กดปุ่มให้ถูก" → **ผิดมหันต์** · หลักคิด: **system error ≠ user error**

**🚨 push / version (พลาดบ่อย — อ่านให้ดี):**
- **ห้าม push ก่อนพี่กันเทส** · **push ได้เฉพาะเมื่อพี่กันพิมพ์คำว่า "push / พุช" ตรงๆ** ("ทำต่อ/ทำเลย/เอาขึ้นเมน" ≠ อนุญาต)
- **ก่อน push ทุกครั้ง: อัปเดต `CLAUDE.md` + `README.md` ให้ตรงสิ่งที่แก้ก่อนเสมอ** + เตือน checklist (env Cloudflare / SQL ที่ต้องรัน)
- **push เสร็จ = เขียน `docs/SESSION-YYYY-MM-DD.md` ทันที** (ไม่ต้องถาม)
- **commit message ละเอียดที่สุด** (ไทย+อังกฤษ · file-by-file + เหตุผล · จบด้วย `Co-Authored-By:`) · subject `vX.Y.Z:` เฉพาะ commit ที่ bump version จริง
- **ห้าม bump version เอง** (รอสั่ง) · ก่อน bump รัน `git log --oneline` เช็คของจริง
- 🌿 **production branch ของ repo นี้ = `main`** — push ตัวนี้ถึง deploy (Cloudflare Workers Builds + GitHub default = `main` · ย้ายจาก `claude/chat-reading-push-32m9nv` มา `main` เมื่อ 9 ก.ค. 2569) · หลัง push verify `git rev-list --left-right --count origin/main...HEAD` = `0 0`
- **เวอร์ชัน repo นี้ = 4 ตำแหน่ง `X.Y.Z.B`** (เช่น `0.9.2.0` · พี่กันสั่งเปลี่ยนจาก 3 ตำแหน่ง เมื่อ 9 ก.ค. 2569) · แก้ที่ `lib/constants.ts` `APP_VERSION` (โชว์หัวเว็บทั้งเดสก์ท็อป+มือถือ)

**ห้ามซ้ำ:** push ก่อนเทส · แก้ UI เบี่ยงจาก mockup · เหมาว่าแปลก=บั๊กแล้วแก้ · **เดาการกระทำพี่กัน/โทษพี่กันตอนระบบพัง** (เคส MCP approval เด้ง denied ทั้งที่กด Allow — บั๊กระบบ ไม่ใช่พี่กัน) · **อ่านกฎทีละท่อน (ต้องอ่านทั้งไฟล์)** · PowerShell แก้ไฟล์ไทย (mojibake → ใช้ Bash) · ลืม redact secret ก่อน commit เอกสาร

---

## ภาพรวม

แอป **Med Error & DRP** (v0.9.7.0) สำหรับห้องยา OPD — Next.js 15 (App Router) + React 19 + TypeScript,
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
  - **Responsive มือถือ (v0.9.1):** state `isMobile` (`matchMedia('(max-width:640px)')`) สลับ layout เฉพาะจอแคบ — หัวเมนูมือถือ 2 แถว (helper `navM` + เฟือง⚙=ตั้งค่า), หน้ารายการ + ตารางล่าสุด/Dashboard เป็น**การ์ด**, KPI 4→2 คอลัมน์ · **เดสก์ท็อปแยก branch — ห้ามแตะ**
  - **นาฬิกาเดินจริง (v0.9.1):** state `clock` + `setInterval` 1s (เฉพาะ `view==='form'`) แสดงเวลาปัจจุบันในหน้ากรอก
- **`lib/style.ts` `css(str)`** = แปลง CSS declaration string จากดีไซน์ → React.CSSProperties
  ใช้เพื่อคง inline-style เดิมแบบ pixel-perfect (ห้ามใช้กับ string ที่มี data-URI ที่มี `;`)
- **`components/ui.tsx`** = wrapper ที่ทำ `:hover`/`:focus` (ซึ่ง inline style ทำไม่ได้):
  `HButton/HInput/HTextarea/HSelect/HDiv/HTr/HFileLabel` รับ `base`/`hover`/`focus` เป็น CSS string
- **`lib/data.ts`** = Supabase client (`@supabase/supabase-js`) + `fetchIncidents/insertIncident/updateIncident` + `toRow`
- **`lib/constants.ts`** = ค่าคงที่ทั้งหมด (แก้ dropdown/ชิป/คำอธิบายที่นี่) · **`REPORTERS`** = รายชื่อผู้รายงาน 16 คน (v0.9.1 — ช่องผู้รายงานเป็น dropdown)

## รูปแบบข้อมูล (`lib/types.ts` → `Incident`)

- ตารางเดียว `incidents` แยก Med/DRP ด้วย `type: 'med' | 'drp'`
- `error_nature`, `error_type` และ `drugs` เป็น **array** (jsonb) — โค้ดรองรับข้อมูลเก่าที่เป็น string ด้วย (ดู `helpers.natureText/natureToArray/drugArr`)
- **ประเภท Error (v0.9.3.0):** `ERROR_TYPES` = 5 อัน (เพิ่ม `Pre-dispensing`=จัดยา แยกจาก `Dispensing`=จ่ายยา) · แต่ละอันมี `th` (ป้ายไทยโชว์ในวงเล็บบนปุ่ม · ค่าที่บันทึกยังเป็น key อังกฤษ) · **เลือกหลายอันได้** (`error_type` เป็น array/jsonb เหมือน error_nature · ปุ่ม `toggleErrType`) · มือถือ = grid 2 คอลัมน์ (ปุ่มคี่ตัวสุดท้าย span เต็มแถวอยู่กลาง) · ⚠️ ต้องรัน `supabase/migrations/0001_error_type_to_jsonb.sql` (text→jsonb) ก่อน deploy
- **บันทึก null (v0.9.4.0):** `toRow` แปลง `severity`/`outcome` ที่เป็น `""` → `null` ก่อนส่ง (คอลัมน์มี CHECK constraint · `""` ไม่ผ่าน → error 400 บันทึกไม่เข้า) — บั๊กนี้เคยทำให้ "กรอกแล้วไม่เข้า Supabase"
- **บังคับกรอก (v0.9.4.0):** validation ใน `save` set `errors` → ดาวแดง `*` + เตือนใต้ช่อง · บังคับ: HN/วันที่/จุดที่พบ/ผู้รายงาน + Med(ประเภท Error/ลักษณะ/ความรุนแรง/รายละเอียดเหตุการณ์) + DRP(ประเภท DRP/รายละเอียดเหตุการณ์-สาเหตุ/การแก้ไข/ผลตอบรับจากแพทย์ — **เว้นเมื่อติ๊ก `pharmacist_only`**) · **ไม่บังคับ:** การแก้ไข/จัดการ · ชื่อยา · รูป · HAD/LASA
- **จุดที่พบ + AN (v0.9.4.0):** `LOCATIONS` = ห้องยา OPD ทั่วไป/OPD NCD/**IPD** (`IPD_LOCATION`) · `renderLocationField()` ใช้ร่วม Med+DRP วางก่อน HN · **AN** (คอลัมน์ `an` text · รูปแบบ `69-01234` มีขีด · filter `[^0-9-]`) อยู่แถวเดียวกับ HN · `disabled` จนเลือก IPD แล้วบังคับ · ⚠️ ต้องรัน `supabase/migrations/0002_add_an_column.sql`
- **ปุ่มดูความหมายลักษณะ (v0.9.4.0):** state `showNatureLegend` + ปุ่ม `ⓘ ดูความหมาย` กางคำอธิบาย `ERROR_NATURE` ทั้งหมด (เหมือน `showSevLegend` ของ A–I)
- **หน้าเกี่ยวกับ/ตั้งค่า (v0.9.5.0):** `renderSettings()` = หน้า **เกี่ยวกับ** (view `settings` · label เมนู "เกี่ยวกับ" · ข้อมูลแอป/ผู้พัฒนา/Supabase+โลโก้/tech stack/PDPA · **เอาช่องกรอก Supabase config ออก**) · `renderManage()` = หน้า **ตั้งค่า** (view `manage` · placeholder 3 หัวข้อ + badge "เร็ว ๆ นี้" ยังไม่ทำเนื้อหา) · เมนู: view `settings`→label "เกี่ยวกับ" + เพิ่มปุ่ม "ตั้งค่า"→view `manage` (มือถือ ⚙+ⓘ / เดสก์ท็อป) · `ORG_NAME`="ห้องยา รพ.ปรางค์กู่" (หัวเว็บ+dashboard) · tab title มี รพ.ปรางค์กู่ (`app/layout.tsx`)
- **คลังยา + autocomplete (v0.9.6.0):** ตาราง `drugs` (416 ยา · master data · RLS read-only) · `fetchDrugs` โหลดครั้งเดียว → cache localStorage `meddrp_drugs` (โหลดทุก mount ถ้า configured) · `renderDrugRows` มี suggest dropdown (filter `drugSearchText`=generic+brand · ไฮไลต์คำค้น · `pregColor` เรียงสี A→X) · `drugFlatLine` รวมเป็นข้อความบรรทัดเดียว (snapshot ลง incident · **แก้คลังยาไม่กระทบเคสเก่า** · สูตรผสมใส่วงเล็บ + %) · SQL: `supabase/migrations/0003_create_drugs.sql` + `scripts/drugs_seed.sql`
- **Realtime ข้อมูลสดข้ามเครื่อง (v0.9.7.0):** `subscribeIncidents(cfg, onChange)` ใน `lib/data.ts` — 1 channel ต่อ 1 ตาราง (`incidents-live`) · ได้ event `*` → debounce 400ms → `refreshRecords()` **ดึงข้อมูลใหม่ทั้งชุดผ่าน API** (ไม่ patch จาก payload) → ทับ state + cache + แจ้ง toast เฉพาะตอนข้อมูลต่างจริง · กันสัญญาณหลุดด้วย `visibilitychange` + `online` → refetch · ⚠️ ต้องรัน `supabase/migrations/0004_enable_realtime.sql` (`replica identity full` + เพิ่มตารางเข้า publication `supabase_realtime`) ไม่งั้นไม่มี event ส่งมาเลย
- **ติ๊ก "แก้ไขเรียบร้อยแล้ว" — Med Error (v0.9.7.0):** คอลัมน์ `managed` (boolean · migration `0005_add_managed.sql`) แยกจากข้อความ `management` เดิม · บางเคสแก้แล้วไม่มีอะไรต้องบรรยาย → ติ๊กพอ (พิมพ์เพิ่มก็ได้) · หน้ารายละเอียดโชว์ป้ายเขียว "✓ แก้ไขแล้ว" (`detailRows[].ok` = ข้อความบนป้าย)
- **DRP ยกเครื่อง (v0.9.7.0):**
  - `DRP_TYPES` = **10 หมวดตาม Hepler & Strand** (เพิ่ม Untreated indication / Drug use without indication / แยกขนาดยาสูง-ต่ำ) · `KeyDesc.label` = ป้ายที่โชว์ (ไทย + วงเล็บอังกฤษ) แยกจาก `key` = ค่าที่บันทึกจริง — **ห้ามแก้ key ของหมวดเดิม** (`ยาไม่เหมาะสม`, `ADR/แพ้ยา`, `Drug interaction`, `ยาซ้ำซ้อน`, `อื่น ๆ`) ไม่งั้นเคสเก่าเพี้ยน · helper `drpLabel(key)` ใช้แปลงทุกจุดที่แสดงผล (ตาราง/รายละเอียด/ประวัติ/Dashboard/ตัวกรอง)
  - ปุ่ม `ⓘ ดูความหมาย` (state `showDrpLegend`) กางคำอธิบายครบ 10 หมวด — รูปแบบเดียวกับ `showNatureLegend` ของ ME
  - **ยุบ "สาเหตุของปัญหา" + "รายละเอียดเพิ่มเติม" เหลือช่องเดียว** = "รายละเอียดเหตุการณ์ / สาเหตุ" (เก็บที่คอลัมน์ `cause` เหมือนเดิม) · เคสเก่าที่มี `detail` ยังโชว์ในหน้ารายละเอียด
  - **`pharmacist_only`** (boolean · migration `0006_add_pharmacist_only.sql`) = เภสัชกรแก้ไขเอง ไม่ผ่านแพทย์ → ซ่อนช่อง "ผลตอบรับจากแพทย์" + ไม่บังคับ `outcome` · หน้ารายละเอียดโชว์ป้าย "✓ เภสัชกรแก้ไขเอง"
  - ป้ายใหม่: "การ Intervention"→**"การแก้ไข (Intervention)"** (ค่าเริ่มต้นว่าง "— เลือกการแก้ไข —" · เดิมค้างค่าแรกไว้ทำให้บันทึกค่าที่ไม่ได้ตั้งใจ) · "ผลลัพธ์การ Intervention"→**"ผลตอบรับจากแพทย์"** · `OUTCOMES.label` เติมวงเล็บอังกฤษ (Accepted/Rejected/Pending)
- **ปุ่มแนบรูป = ปิดใช้งานชั่วคราว (v0.9.7.0):** เดิมฝัง base64 ลง DB (แฟ้มบวม โหลดช้าเมื่อเคสเยอะ) → ตอนนี้เป็นกล่องเทาจาง + ป้าย "ยังใช้ไม่ได้" · แผน: ย้ายไปเก็บที่ Cloudflare (แปลง webp + ย่อขนาด) แบบเดียวกับ TB Dashboard · `onAttachFile` ยังอยู่ในโค้ด (รอเปิดใช้)
- ประวัติแก้ไขเก็บใน `history[]` (snapshot ก่อนแก้ พร้อม `saved_at`)
- คีย์ localStorage: `meddrp_records_v4` (v4 = เดโม 10 เคส + ชื่อจริง · bump ล้าง cache เก่า), `meddrp_cfg`, `meddrp_draft`
- **ผู้รายงาน (v0.9.2.1):** custom dropdown ทำเอง `renderReporterDD` (ไม่ใช้ `<select>` ของ OS — กัน iOS ตัดชื่อยาว 2 บรรทัด) เลือกจาก `REPORTERS` · ใช้ทั้งหน้ากรอก + โหมดแก้ไข · **เมนู absolute เด้งขึ้น/ลงอัตโนมัติ** (state `ddUp` · ตอนกดวัด `getBoundingClientRect` เทียบครึ่งจอ ช่องล่างจอ→เด้งขึ้น กันโดนตัดขอบล่าง) · ค่าเดิมนอกลิสต์ยังแสดง (guard)
- **Heatmap เวร × วันในสัปดาห์ (v0.9.2.0):** ในหน้า Dashboard — `hmMatrix[3][7]` นับจาก `occurred_at` (วันในสัปดาห์ จ=0) × `shift` · สีเข้ม = เกิดบ่อย (`hmColor`) · **รวมทุกสัปดาห์ในช่วงที่เลือก**
- **แท่งกราฟแนวนอน (v0.9.2.1):** `renderBarList` ใช้ gradient teal (`linear-gradient(90deg,#12A093,#0B655D)`) + โชว์ % ข้างจำนวน · แท่ง "ลักษณะ" คง amber เป็น accent
- **สลับแท็บ (v0.9.2.1):** `useEffect` on `state.view` → `window.scrollTo(0,0)` เด้งขึ้นบนสุดทุกครั้งที่เปลี่ยนหน้า
- **เส้นขอบ input/select (v0.9.2.0):** `INPUT_FOCUS` ใช้ `border` เต็ม (ไม่ใช่ `border-color`) — กัน React ผสม shorthand/longhand แล้วเส้นขอบหายตอน blur บน iOS
- **วันที่มือถือ (v0.9.2.0):** เมื่อ `isMobile` date input `text-align:left` + ป้าย "วันนี้" ชิดมุม กันค่าลอยตกขอบตอนช่องเต็มความกว้าง (เดสก์ท็อปไม่แตะ)
- **เวลาที่พบ/เวร (v0.9.1):** ไม่มีช่องนาฬิกาแล้ว → ปุ่มเลือกเวร 3 ปุ่ม (helper `shiftBtn`) · auto ตามเวลาปัจจุบันตอนเปิดฟอร์ม (`shiftOf`: 08–16 เช้า / 16–24 บ่าย / 00–08 ดึก) · กดเลือก = set `occurred_time` เป็น**เวลาตัวแทน** (`SHIFT_TIME` เช้า 12:00/บ่าย 20:00/ดึก 04:00) → บันทึก `shift = shiftOf(occurred_time)` เดิม (dashboard/CSV ไม่กระทบ) · หน้ารายละเอียดโชว์แค่ `shift`

## การเชื่อม Supabase

- config มาจาก (ลำดับความสำคัญ) หน้า **ตั้งค่า** (localStorage `meddrp_cfg`) → env `NEXT_PUBLIC_SUPABASE_*`
- ถ้าไม่มี config → **โหมด demo** (seed **10 เคส** ในเครื่อง · v0.9.2.1 · ใช้ชื่อจาก `REPORTERS`)
- `loadRecords`: โชว์ข้อมูล local ก่อนทันที แล้วค่อย fetch Supabase มาทับเบื้องหลัง (ห้ามทำให้ network บล็อก UI)
- ตาราง/RLS อยู่ที่ `supabase/schema.sql` · ใช้ Supabase MCP tools กับ project id `ryewggkhunpuipgkgbfv`

## ข้อควรระวัง

- **อย่าเปลี่ยนสี/ระยะ/รัศมี** ให้ตรวจกับดีไซน์ต้นฉบับก่อน (teal `#0F8A80`/`#0B655D`, amber `#F5A623`)
- แก้ฟิลด์ใหม่ต้องอัปเดต 5 จุดให้ครบ: form state (`emptyForm`) → save → `toRow`/`COLS` → schema → detail/records/CSV
- HN ต้องเป็นตัวเลขล้วน (`.replace(/\D/g,'')`)
- ก่อน commit: `npm run build` ต้องผ่าน
