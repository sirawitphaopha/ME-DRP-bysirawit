# CLAUDE.md — คู่มือสำหรับ coding agent

ไฟล์นี้ช่วยให้ Claude Code (หรือ agent อื่น) ทำงานกับ repo นี้ได้ถูกต้องและเร็วขึ้น

---

## 🎯 กฎการทำงานกับพี่กัน (อ่านให้จบก่อนตอบข้อความแรก + ก่อน push ทุกครั้ง)

> สรุปจากสกิลกลาง `working-with-gun` · **มีสำเนาในเรโปแล้วที่ `.claude/skills/working-with-gun/SKILL.md`** (พี่กันสั่ง commit ขึ้น repo 9 ก.ค. 2569) · เวอร์ชันเต็มดั้งเดิมอยู่เครื่องพี่กัน `~/.claude/skills/` · **ถ้าแก้กฎ ต้องแก้ทั้ง CLAUDE.md + SKILL.md ให้ตรงกัน**

**ตัวตน:** ผู้ช่วยชื่อ **"แคลร์"** (ผู้หญิง · ใช้ ค่ะ/นะคะ · **ห้าม** ครับ/ผม/ฉัน/หนู · แทนตัวเอง "แคลร์") · เรียกผู้ใช้ **"พี่กัน"** (เภสัชกร รพ.ปรางค์กู่ · **ไม่มีพื้นฐานโค้ด** แต่เข้าใจ logic ดี) · พูดบ้านๆ อบอุ่น · อธิบายด้วยอนาล็อกการแพทย์ · **ทำทีละขั้น รอ "โอเค"**

**🚨🚨 แคลร์เป็นผู้หญิง — ลงท้าย ค่ะ / คะ / นะคะ / ขา เท่านั้น · ห้ามหลุด "ครับ / ผม / ฉัน / หนู" แม้แต่ครั้งเดียว ทุกข้อความทุกครั้ง** (พลาดมาแล้ว — เผลอใช้ "ครับ" ทั้งบทสนทนา · ต้องระวังทุกประโยค ห้ามซ้ำ)

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

แอป **Med Error & DRP** (v0.9.12.0) สำหรับห้องยา OPD — Next.js 15 (App Router) + React 19 + TypeScript,
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
  - **`pharmacist_only`** (boolean · migration `0006_add_pharmacist_only.sql`) = เภสัชกรแก้ไขเอง ไม่ผ่านแพทย์ → ซ่อนช่อง "ผลตอบรับจากแพทย์" + ไม่บังคับ `outcome` · ปุ่มติ๊ก **สีอำพัน** (`#F5A623`) วางอยู่**เหนือ**ช่องการแก้ไข · หน้ารายละเอียดโชว์ป้ายอำพัน "✓ เภสัชกรแก้ไขเอง" (v0.9.7.1)
  - **`CONSULT_DOCTOR`** (v0.9.7.1 · `lib/constants.ts` = "ปรึกษาแพทย์ผู้สั่งใช้") — ช่อง "ผลตอบรับจากแพทย์" **แสดง + บังคับกรอกเฉพาะเมื่อ `intervention === CONSULT_DOCTOR`** และไม่ได้ติ๊ก `pharmacist_only` · เปลี่ยน intervention ไปค่าอื่น → ล้าง `outcome` ทิ้ง (กันค่าค้างติดเคส) · ใช้กติกาเดียวกันทั้งหน้ากรอก โหมดแก้ไข และหน้ารายละเอียด (ไม่มีแถวผลตอบรับถ้าเคสไม่เกี่ยวกับแพทย์)
  - **ช่อง "การแก้ไข / จัดการ" ใน DRP** (v0.9.7.1) — ใช้คอลัมน์ `management` ร่วมกับ ME · ไม่บังคับกรอก · วางล่างสุดของฟอร์ม
  - ลำดับฟอร์ม DRP (v0.9.7.1): ประเภท DRP → ยา → รายละเอียดเหตุการณ์/สาเหตุ → ☑ เภสัชกรแก้ไขเอง → การแก้ไข (Intervention) → ผลตอบรับจากแพทย์ (มีเงื่อนไข) → การแก้ไข/จัดการ
  - ป้ายใหม่: "การ Intervention"→**"การแก้ไข (Intervention)"** (ค่าเริ่มต้นว่าง "— เลือกการแก้ไข —" · เดิมค้างค่าแรกไว้ทำให้บันทึกค่าที่ไม่ได้ตั้งใจ) · "ผลลัพธ์การ Intervention"→**"ผลตอบรับจากแพทย์"** · `OUTCOMES.label` เติมวงเล็บอังกฤษ (Accepted/Rejected/Pending)
- **ปุ่มแนบรูป = ปิดใช้งานชั่วคราว (v0.9.7.0):** เดิมฝัง base64 ลง DB (แฟ้มบวม โหลดช้าเมื่อเคสเยอะ) → ตอนนี้เป็นกล่องเทาจาง + ป้าย "ยังใช้ไม่ได้" · แผน: ย้ายไปเก็บที่ Cloudflare (แปลง webp + ย่อขนาด) แบบเดียวกับ TB Dashboard · `onAttachFile` ยังอยู่ในโค้ด (รอเปิดใช้)
- **หน้าต่างรายละเอียด — ห้ามปิดด้วย backdrop (v0.9.7.2):** `renderDetailModal` · คลิกพื้นที่ว่าง = **ไม่ปิดทุกกรณี** (โหมดแก้ไขเด้ง toast เตือน) · ปุ่ม `×` ขณะ `editMode` → ป๊อปยืนยัน `confirmDiscard` ("ปิดโดยไม่บันทึกการแก้ไข" · [ทิ้งการแก้ไข แดง ซ้าย][กลับไปแก้ต่อ ขวา] · คลิกนอกป๊อปยืนยันก็ไม่ปิด)
- **กราฟแยกตามผู้รายงาน (v0.9.7.2):** `reporterBreak` ในหน้า Dashboard — เรียงมากไปน้อย · `REPORTER_COLORS` 8 สีสด (ชมพูแดง/ส้ม/เหลือง/เขียว/ฟ้า/น้ำเงิน/ม่วง/บานเย็น · **ห้ามใช้เทลของธีม** พี่กันสั่ง) วนสีตาม index
- **คำว่า "รายการ" → "รายงาน" (v0.9.7.2)** ในเมนูและหัวข้อหน้า (เมนู `records`, "รายงานทั้งหมด", "รายงานล่าสุด", "ไม่พบรายงาน…")
- **🚨 แก้บั๊ก cross-browser + ยืนยันการส่ง (v0.9.7.3):** ต้นตอ = `id` เดิมสร้างด้วย `crypto.randomUUID ? ... : "r"+Date.now()` — เบราว์เซอร์ที่ไม่มี `randomUUID` (Safari เก่า / ไม่ใช่ https / เว็บวิว) ได้ค่าไม่ใช่ uuid → คอลัมน์ `id` ชนิด uuid ตีกลับ → `save` ดัก `catch {}` เงียบ ขึ้น "บันทึกแล้ว" หลอก → **ข้อมูลเข้าแค่ localStorage ไม่ขึ้นคลังกลาง** · แก้: `helpers.uuid()` สร้าง UUID v4 เองได้ทุกเบราว์เซอร์ + `helpers.isUuid()` · `save` ใช้ `data.pushIncident()` (คืน boolean + timeout 12s + มอง 23505 = สำเร็จ) → สำเร็จค่อยขึ้น "บันทึกและส่งขึ้นระบบเรียบร้อย ✓" ไม่งั้นเข้าคิว `PENDING_KEY` (`meddrp_pending_v1`) + แถบเตือนเหลืองบนสุด (แนะนำ Chrome) · `flushPending()` ส่งซ้ำตอน mount/online/visibilitychange (ออก uuid ใหม่ให้ id เก่าที่ผิด) · `loadRecords`/`refreshRecords` เปลี่ยนจาก "ทับ" เป็น **"รวม"** (คง localOnly ที่ `!isUuid(id)||pending` ไว้บนสุด → กู้รายงานเก่าที่หาย + ไม่ดึงเคสในถังขยะกลับ)
- **ลบรายงาน 2 ชั้น + ถังขยะ (v0.9.7.3):** คอลัมน์ `deleted_at timestamptz` (null=ใช้งาน / มีค่า=ถังขยะ) · migration `0007_soft_delete.sql` (เพิ่มคอลัมน์ + index + RLS policy **delete** เดิมไม่มี · **applied ขึ้น Supabase แล้ว**) · `data.ts`: `fetchIncidents` กรอง `.is("deleted_at",null)` · `fetchDeletedIncidents/softDeleteIncident/restoreIncident/hardDeleteIncident` · UI: ปุ่ม `🗑 ลบรายงาน` ในหน้ารายละเอียด (จาง) → ป๊อปชั้น 1 `askDelete` "ย้ายไปถังขยะ" (amber · `doSoftDelete`) · หน้า `renderManage` (ตั้งค่า) มีส่วนถังขยะ (`state.trash` · `loadTrash` ตอน mount+เข้าหน้า) ปุ่มกู้คืน (`doRestore`)/ลบถาวร → ป๊อปชั้น 2 `hardTarget` (แดง · **ต้องพิมพ์ HN ให้ตรง** ปุ่มถึงกด · ไม่มี HN ให้พิมพ์ "ลบถาวร" · `doHardDelete`) · รายงานในถังขยะไม่นับใน Dashboard (fetch กรองออกแล้ว)
- **DRP เลือกความรุนแรง A–I + HAD auto-flag + Dashboard นับ DRP (v0.9.8.0):**
  - **DRP มีช่องระดับความรุนแรง A–I** (บังคับกรอกทั้ง ME+DRP · ย้ายเงื่อนไข `!f.severity` ขึ้นส่วนบังคับร่วมใน `save`) · แยกบล็อกความรุนแรงเป็นฟังก์ชันร่วม **`renderSeverityField()`** เรียกทั้งฟอร์ม ME (ตำแหน่งเดิม) และ DRP (ถัดจาก "รายละเอียดเหตุการณ์/สาเหตุ") · โหมดแก้ไข DRP + หน้ารายละเอียด + ประวัติ + หน้ารายงาน + ตาราง Dashboard โชว์ severity ของ DRP ด้วย (เดิม gate `type==="med"` ออกแล้ว) · เหตุผล: ME เป็นซับเซ็ตของ DRP ควรให้คะแนนความรุนแรงได้เหมือนกัน
  - **เลือกยา HAD → ติดธง High-alert อัตโนมัติ:** `pickDrug()` เช็ค `d.had === true` แล้ว `setField("high_alert", true)` (ผู้ใช้ปลดเองได้ · ไม่ auto-off กันลบค่าที่ตั้งใจติด) · คลังยา `drugs` มีคอลัมน์ `had` อยู่แล้ว
  - **Dashboard กราฟความรุนแรง A–I นับรวม DRP:** `bySev` เอา `.filter(r => r.type === "med")` ออก → นับทุกเคสที่มี `severity` (respect ตัวกรอง dashType อยู่แล้ว) · **แต่** `severe` (ป้าย "ระดับ E ขึ้นไป X เคส" ใต้การ์ด Med Error) ยังนับเฉพาะ ME ตามความหมายของการ์ดนั้น
- **Safari resend + หน้าผลการส่ง + เสียง/สั่น (v0.9.8.1):**
  - **`pushIncident` ลองส่งซ้ำเองในกดครั้งเดียว** (default `attempts=3`, `timeoutMs=9000`) — ต้นเหตุ Safari "ครั้งแรกไม่ไป": log server เห็นแต่ POST 201 ไม่มี error → คำขอแรกสะดุดฝั่งเบราว์เซอร์ (cold start/ITP/เน็ตวืบ) · ใช้ **AbortController** ยกเลิกคำขอค้างก่อนลองรอบใหม่ · id เดิม = idempotent (23505 = สำเร็จ ไม่เกิดซ้ำ) · ถ้าครบ 3 รอบยังไม่ได้ค่อยเข้าคิว
  - **หน้าผลการส่งเต็มจอ** `renderResult()` (state `result: "ok"|"fail"|null` · overlay z-90 คลุมทั้งแอป · แทน toast เดิมใน `save`) — สำเร็จ = ✓ เขียว "ส่งสำเร็จ" + ปุ่ม "ส่งรายงานใหม่"(`result:null`)/"ดูรายงานทั้งหมด"(view records) · ไม่สำเร็จ = ✕ แดง "ส่งไม่สำเร็จ" ไม่หายเอง + กล่องแนะนำ Chrome (โลโก้ `chromeLogo()` inline SVG) + ปุ่ม "ส่งอีกครั้ง"(`resendResult` ส่งเคสเดิม)/"เก็บไว้ส่งทีหลัง"(`result:null` คิวยังทำงาน)
  - **เสียง+สั่นเตือน (ตอน fail):** `audioCtxRef` + `unlockAudio()` (เรียกตอนต้น `save`/`resendResult` = user gesture · iOS ต้องปลดในจังหวะกด) + `alertFail()` = `navigator.vibrate` (เฉพาะ Android · iOS ไม่รองรับ) + บี๊บ 2 จังหวะจาก Web Audio (square 640Hz)
  - **หน้ารายงาน DRP โชว์จุดที่พบ:** `recRows.place` เอา gate `type==="med"` ออก → `r.location || "—"` (จุดที่พบเป็นช่องร่วม · Dashboard `byLoc` นับทั้งคู่อยู่แล้ว)
- **🔍 ยกเครื่องตามผลตรวจโค้ดเชิงลึก (v0.9.9.0):** ทีม 4 คนอ่านทั้งระบบ เจอ 24 จุด แก้ครบ (report เก็บที่ `docs/SESSION-2026-07-14c.md`) · แบ่ง 3 ชุด:
  - **ชุด A 🔴 กันข้อมูลหาย/ผิด:** (1) `savingRef`/`savingRef.current` กันกดปุ่มบันทึกซ้ำ → เคสซ้ำ · (2) หน้าแก้ไข error_type/error_nature เป็นปุ่มเลือกหลายอัน (`efArr`/`efToggleArr`) เดิมเป็น `<select>` อันเดียว → array หด · (3) `doSoftDelete` เรียก `dequeuePending` ด้วย กันเคสในถังขยะเด้งกลับจากคิว · (4) `saveEdit` ใช้ `pushUpdate` (ยืนยันผล+ลองซ้ำ) เดิมดัก error เงียบขึ้น "บันทึกแล้ว" หลอก · (5) `saveEdit` ตรวจช่องบังคับด้วย `validateIncident` · (6) คิว/แคช race-safe: `mutatePending` (อ่าน-แก้-เขียนทีละรายการ) + `dedupUnsynced` คงเคสที่ยังไม่ซิงก์ · (22) `flushPending` พลิกหน้าผล fail→ok ถ้าคิวส่งสำเร็จ · (23) `refreshRecords` ไม่ทับ detail ตอน `editMode` · (24) `saveEdit` คง `shift` จากเวลาเดิมถ้าไม่มีค่าใหม่
  - **ชุด C 🟠 สถิติให้ตรง:** (7) สลับ ME↔DRP ตอนกรอกค้าง = ป๊อปยืนยัน (state `confirmSwitch` · `requestSwitchType`/`doSwitchType` · ฟอร์มว่างสลับเลย) · (8) การ์ด "แพทย์รับข้อเสนอ %" หารเฉพาะ DRP ที่เสนอแพทย์จริง (`intervention===CONSULT_DOCTOR && !pharmacist_only`) · (9) ตารางรายงานล่าสุด Dashboard ใช้ `natureText()` · (10) กราฟ "6 เดือน" ใช้ `monthScopeRecs` (กรองแค่ประเภท ไม่เอาช่วงวันมาบีบ) · (11) ปุ่ม CSV ใน Dashboard ส่ง `recs` (ชุดที่กรอง)
  - **ชุด D 🟡 เก็บกวาดขอบเคส:** (12) เปลี่ยนจุดที่พบออกจาก IPD ล้าง AN (`setLocation`/`setEfLocation`) · (13) ธง High-alert auto จากยา HAD ปลดเองเมื่อไม่เหลือยา HAD — state `hadAuto` แยก auto/manual · `hasHadDrug`(เช็ค "(HAD)" ใน drug line)/`clearAutoHad` · `toggleHighAlert` ติ๊กเอง=ปลด hadAuto (ไม่ลบธงที่ตั้งใจ) · (14) "อื่น ๆ" บังคับพิมพ์ระบุ (`validateIncident` เพิ่ม `error_nature_other`/`drp_type_other`) + เลิกเลือกล้างข้อความค้าง (`toggleNature`/`setDrpType`) · (15) **AN auto-format** `formatAn(raw, occurredAt)` → "YY-NNNNN" ตอน blur (YY=ปี พ.ศ.2หลักของปีที่เกิดเหตุ · NNNNN=5หลัก zero-pad · พิมพ์เกิน 5=เอา 5 ตัวท้ายเป็นลำดับ) · `save` normalize AN เสมอ + validation กัน "-" เปล่า (`/\d/`) · (16) `hasDraftContent` รวม severity/intervention/outcome/an · (17) ค้นหาใช้ `matchSearch` (whitelist ช่องที่เห็น) แทน `JSON.stringify` ทั้งก้อน · (19) ถังขยะสดข้ามเครื่อง (`refreshTrashIfOpen` ใน realtime/vis/online เมื่อ view=manage) + `restoreIncident` คืน boolean (`.select("id")`) → กู้คืนเคสที่โดนลบถาวรแล้วบอกตามจริง · (20) ปุ่มถังขยะ disabled ตอน `trashBusy` · (21) ป๊อปลบถาวรโชว์ตัวตนเคส (ประเภท/HN/วันที่/ผู้รายงาน/ยา) · (25) กัน "ระดับ —" ในการ์ด + `resume().catch()`
- **คลังยา realtime + กราฟ 12 เดือน + คอลัมน์รายละเอียด + แก้ scroll หน้าผล (v0.9.9.1):**
  - **คลังยา sync สดข้ามเครื่อง:** `subscribeDrugs(cfg, onChange)` ใน `lib/data.ts` (1 channel `drugs-live` แยกจาก `incidents-live`) · effect ใหม่ใน component → debounce 500ms → `refreshDrugs()` (ดึงคลังยาใหม่ทั้งชุด · อัปเดต state + cache `meddrp_drugs` เฉพาะตอนต่างจริง) + refetch ตอน `visibilitychange`/`online` · แอดมินเพิ่ม/แก้ยา ทุกเครื่องเห็นเองไม่ต้องรีเฟรช (เดิมคลังยาโหลดครั้งเดียวตอน mount แล้ว cache → ยาที่เพิ่มทีหลังไม่เห็นจนรีเฟรช) · ⚠️ ต้องรัน `supabase/migrations/0008_enable_drugs_realtime.sql` (`replica identity full` + เพิ่ม `drugs` เข้า publication `supabase_realtime`) — **applied ขึ้น Supabase แล้ว**
  - **กราฟรายเดือน 6 → 12 เดือน + ปุ่มเลือกปี:** state `dashYear` (ค.ศ. · 0=ปีปัจจุบัน) · กราฟโชว์ ม.ค.–ธ.ค. ของปีที่เลือก · `yearOpts` = ปีที่มีข้อมูล + ปีปัจจุบัน (จาก `monthScopeRecs`) เรียงใหม่→เก่า · ปุ่มปี พ.ศ. มุมขวาบนการ์ด · หัวข้อ "จำนวนเคสรายเดือน · ปี 2569" · แท่งแคบลง (76%) gap ชิด (มือถือ font/gap เล็กลง)
  - **หน้ารายงานเพิ่มคอลัมน์ "รายละเอียด":** `recRows.detailText` = `detail`(ME)/`cause`(DRP) · เดสก์ท็อป = คอลัมน์ใหม่ (max-width 260px · `-webkit-line-clamp:2` + `title` tooltip · ขยาย `min-width` ตาราง 860→1040) · มือถือ = บรรทัดล่างสุดของการ์ด (เส้นประคั่น)
  - **แก้ scroll หน้าผล "ส่งสำเร็จ":** ปุ่ม "ส่งรายงานใหม่" เรียก `window.scrollTo(0,0)` เอง — เดิม view คงเป็น `form` อยู่แล้ว effect scrollTo (key ที่ `view`) ไม่ทำงาน → ค้างล่างเพจ
- **หน้า "คลังยา" — จัดการ master data (v0.9.10.0 · Phase 1 ของแผนคลังยา):** view ใหม่ `"drugs"` + เมนู "คลังยา" (เดสก์ท็อป+มือถือ) · `renderDrugsAdmin` (ตาราง desktop / การ์ด mobile)
  - **CRUD:** `insertDrug`/`updateDrug` ใน `lib/data.ts` (เขียนเข้า Supabase ตรง · realtime กระจายให้ทุกเครื่อง) · ป๊อป `renderDrugEditModal` ใช้ร่วมเพิ่ม/แก้ · state `drugEdit`/`drugEditNew`/`drugEditOrig`/`drugBusy` · ค้น (`drugSearchText`) + กรอง (HAD/รูปแบบ form/Preg D-X · `getFilteredDrugs`) + ปุ่มส่งออก CSV (`exportDrugsCsv` · กัน formula injection)
  - **id auto:** `drugs.id` เป็น identity (migration `0009` · BY DEFAULT · setval เหนือ max) → เพิ่มยาใหม่ระบบออกเลขเอง ไม่ต้องกรอก · id ไม่เปลี่ยนแม้แก้แถว = ยาเดิมเสมอ (เตรียมให้ Phase 2 ผูก ID)
  - **ลบไม่ได้จากเว็บ → "ซ่อน" แทน:** ถอน RLS delete ของ anon (migration `0010`) · คอลัมน์ `hidden boolean` (migration `0011`) · `setDrugHidden(d, hidden)` ผ่าน `updateDrug` · หน้าคลังยากรอง `!d.hidden` + autocomplete ตอนกรอกกรอง `!d.hidden` · หน้าตั้งค่ามีส่วน "ยาที่ซ่อนอยู่" (กด "เอากลับมาแสดง"/"ประวัติ") · ลบจริงทำได้เฉพาะใน Supabase (พี่กันคนเดียว)
  - **Audit log:** ตาราง `drug_audit` + trigger `log_drug_change` (SECURITY DEFINER · migration `0010`) จับทุก insert/update/delete ของ drugs → เก็บ old/new (jsonb)+เวลา · **จับได้แม้แก้ตรงใน Supabase** · ปุ่ม "ประวัติ" → `fetchDrugAudit` → `renderDrugLogModal` (ไทม์ไลน์ + diff ราย field เช่น "ชื่อยา: เก่า→ใหม่", "การแสดงผล: แสดง→ซ่อน")
  - **ป๊อปแก้ไขกันปิดพลาด:** กดที่ว่างไม่ปิด + แก้ค้างแล้วกดยกเลิก = ป๊อปยืนยัน "ปิดโดยไม่บันทึก" (`drugEditOrig` เทียบ dirty · `requestCloseDrugEdit`/`forceCloseDrugEdit`)
  - migrations Phase 1: `0009_drugs_writable` · `0010_drug_audit` · `0011_drugs_hidden` — **applied ขึ้น Supabase แล้ว** (0011 พี่กันรันเองผ่าน SQL Editor · ยืนยันครบ: hidden=1, id identity=YES, policy=INSERT/SELECT/UPDATE, drug_audit=มี, trigger=1, ยา 417)
  - **Phase 3 — รื้อโหมดแก้ไขให้เหมือนฟอร์ม (v0.9.10.3):** refactor `renderDrugRows` → **`drugPickerUI(cfg)`** (รับ rows/sug/onSug/onBlur/onChangeAt/onPick/onRemove/onAdd) ใช้ร่วมทั้งหน้ากรอก + โหมดแก้ไข · โหมดแก้ไขช่องยาเดิม (text) → picker autocomplete ผูก `drug_ids` (state `efDrugSug` · handlers `setEfDrugAt`/`pickEfDrug`/`addEfDrug`/`removeEfDrug` · `startEdit` normalize `ef.drugs`/`ef.drug_ids` · `saveEdit` สร้าง drugs/drug_ids จาก picker ตรง ๆ) → **แก้เคสเก่าเลือกยาจากคลังได้ = ผูก ID ให้เคสที่ backfill อัตโนมัติไม่ได้** · ไม่ต้องมี migration
  - **Phase 2 — ผูกรหัส ID ยาเข้ากับเคส (v0.9.10.2):** เคสเก็บ `drug_ids` (jsonb array ขนานกับ `drugs[]` · migration `0012_incidents_drug_ids` · **applied**) · `pickDrug` เก็บ `d.id` · พิมพ์เอง=null · `save`/`saveEdit` จับคู่ข้อความ+id ตาม index · helper `resolveDrugLines(r, byId)` (lib/helpers) แปลงเป็น "ชื่อล่าสุด" (มี id+เจอในคลัง→`drugFlatLine` ปัจจุบัน · ไม่มี→ข้อความเดิม) ใช้ทุกจุดแสดง (รายงาน/รายละเอียด/Dashboard recent/CSV) · **Dashboard `byDrug` group ด้วย id** (label=ชื่อล่าสุด) → เปลี่ยนชื่อยาในคลังแล้วไม่นับซ้ำ · `drugsById` (Map id→Drug) คำนวณในบอดี้ render · **`backfillDrugIds`** จับคู่รหัสให้เคสเก่าอัตโนมัติ (ครั้งเดียว/เครื่อง · localStorage `meddrp_drugid_backfill_v1` · exact match drugFlatLine · เคสที่ยาเปลี่ยนชื่อ/พิมพ์เองแมตช์ไม่ได้ → ปรับเอง Phase 3)
  - **ปรับ UI ตาม feedback (v0.9.10.1):** แถบค้นหา+ตัวกรอง **sticky** (`top` เดสก์ท็อป 58/มือถือ 94 · หัวข้อไม่ตรึง) · ปุ่มลอย **↑↓** เลื่อนบนสุด/ล่างสุด (`scrollTo` smooth) · หัวคอลัมน์ **สีเข้ม teal กดเรียงได้** (`toggleDrugSort`/`sortDrugs` · id=ตัวเลข, had=boolean, ที่เหลือ localeCompare th · ลูกศร ▲▼/↕) · คอลัมน์: เพิ่ม **ID** · ย้าย **ชื่อการค้า**มาที่ 2 · "ธง"→**"HAD"** · ชื่อยากว้าง (`colgroup` · generic auto · ความแรง 104px · `table-layout:fixed`) · ตัวกรอง **เลือกหลายอัน** (`drugFilters[]` · form=OR, HAD/PregDX=AND · กดซ้ำยกเลิก) + ปุ่ม **✕ ล้างตัวกรอง** (เอา "ทั้งหมด" ออก) · ป๊อปแก้ไข **ล็อก body scroll** (กันเพจหลังเลื่อน · effect ตอน drugEdit/drugLog เปิด) · **หน่วย/รูปแบบ/ทางให้ยา เป็น dropdown** (helper `distinct` จากค่าที่มีจริงในคลัง · คงค่าปัจจุบันถ้าไม่อยู่ในลิสต์)
- **หน่วยงานต้นเหตุ + กราฟ Dashboard (v0.9.11.0):** ช่องใหม่ **`source_units`** (jsonb array · เลือกหลายอัน) + **`source_unit_other`** (text · เมื่อเลือก "อื่น ๆ") — บันทึกว่าความคลาดเคลื่อน**มาจากวิชาชีพ/หน่วยงานไหน** แยกจาก "ประเภท Error" ที่เป็น**ขั้นตอน** (เพราะวิชาชีพ ≠ ขั้นตอน 1:1 · พยาบาลบางทีคีย์คำสั่ง=prescribe · IPD เภสัชเป็นคน transcribe)
  - `SOURCE_UNITS` (`lib/constants.ts`) = 9 ตัวเลือก: แพทย์ · ทันตแพทย์ · พยาบาล · เภสัชกร · ผู้ช่วยเภสัช · ห้องแล็บ · เวชระเบียน · ผู้ป่วย / ญาติ · อื่น ๆ (เพิ่ม "ทันตแพทย์" hotfix 17 ก.ค. · ไม่ bump version)
  - **ช่องร่วม Med + DRP** · **บังคับกรอก** (validation ใน `validateIncident` — อย่างน้อย 1 · เลือก "อื่น ๆ" ต้องระบุข้อความ) · ตำแหน่ง **ถัดจาก "จุดที่พบ"** ทั้งฟอร์ม (`renderSourceUnitsField`) และโหมดแก้ไข (`renderEfSourceUnits`)
  - handler `toggleSourceUnit(k)` (mirror `toggleNature` · เลิกเลือก "อื่น ๆ" ล้าง `source_unit_other`) · โหมดแก้ไขใช้ `efArr`/`efToggleArr("source_units")` (ขยาย type รับ field นี้) · แสดงผลใช้ `natureText(source_units, source_unit_other)` (reuse) — หน้ารายละเอียด/ค้นหา (`matchSearch` hay)/CSV (`exportCsv` cols)
  - **Dashboard กราฟใหม่ "แยกตามหน่วยงานต้นเหตุ"** (`byUnit`/`unitBreak`) — นับแบบ array (1 เคสนับได้หลายหน่วย · ทั้ง Med+DRP · respect ตัวกรอง) · แท่ง gradient teal · การ์ดใหม่ถัดจาก "แยกตามผู้รายงาน"
  - ⚠️ ต้องรัน `supabase/migrations/0013_source_units.sql` (เพิ่ม 2 คอลัมน์) — **applied ขึ้น Supabase แล้ว** (พี่กันรันเองผ่าน SQL Editor · MCP ติด approval) · เคสเก่าที่ไม่มีค่า = `[]` (default) · **เข้าไปแก้เคสเก่าจะโดนบังคับเลือกหน่วยงานต้นเหตุ** (validateIncident เดียวกัน)
- **ล็อก scroll ทุก popup + ลักษณะ "ค้างยา" (v0.9.11.1):**
  - **ล็อก scroll พื้นหลังตอนเปิด popup ทุกตัว** — effect เดิม (v0.9.10.1) ล็อกแค่ป๊อปคลังยา (`drugEdit`/`drugLog`) → ขยายให้ครอบคลุม `detail` (รายละเอียด/แก้ไขเคส) · `result` (หน้าผลการส่ง) · `hardTarget` (ป๊อปลบถาวร) · `confirmSwitch` (ป๊อปสลับ ME↔DRP) ด้วย · ป๊อปที่ซ้อนใน detail (`confirmDiscard`/`askDelete`) และใน drugEdit (`drugEditConfirmClose`) ตัวแม่ล็อกให้แล้ว · เหตุผล: ป๊อปแก้ไขเคสเดิมเลื่อนพื้นหลังได้ (ไม่เคยล็อก · มีแต่ป๊อปยาที่ล็อก) → ทำให้สม่ำเสมอ
  - **เพิ่มลักษณะความคลาดเคลื่อน "ค้างยา"** ใน `ERROR_NATURE` (`lib/constants.ts` · ก่อน "อื่น ๆ") · desc = "มียาค้างจ่าย ผู้ป่วยยังไม่ได้รับยาครบตามสั่ง (เช่น ยาไม่พอ ต้องค้างจ่ายภายหลัง)" · ใช้ได้ทุกจุดอัตโนมัติ (ฟอร์ม/แก้ไข/legend ⓘ/Dashboard natureBreak/ค้นหา) เพราะทุกจุด iterate จาก `ERROR_NATURE`
- **ประเภท Error เข้า DRP + เวรตามเวลาจริง + ลักษณะใหม่ 2 อัน (v0.9.12.0):**
  - **ช่อง "ประเภท Error" ใช้ร่วม Med + DRP** — แยกบล็อกเป็นฟังก์ชันร่วม **`renderErrorTypeField()`** (ปุ่มชิปเลือกหลายอัน + กล่องอำพันคำอธิบาย) เรียกทั้ง `renderMedFields` (ช่องแรกเหมือนเดิม) และ `renderDrpFields` (**ช่องแรกของ DRP · ถัดจากหน่วยงาน/HN เหมือนหน้า ME**) · โหมดแก้ไขสาขา DRP เพิ่มปุ่ม `efToggleArr("error_type")` (เดิมมีแค่สาขา Med) · **ไม่มี migration** — คอลัมน์ `error_type` เป็น jsonb array ใช้ร่วมอยู่แล้ว (`toRow` normalize เป็น array · `COLS` มีอยู่)
  - **บังคับกรอกทั้ง Med + DRP** — ย้ายเงื่อนไข `error_type` ใน `validateIncident` ออกจากบล็อก `type==="med"` มาเป็นส่วนร่วม (บังคับทั้งคู่ · เข้าแก้เคส DRP เก่าจะโดนบังคับเลือกด้วย เหมือน source_units)
  - **หน้ารายละเอียด + ประวัติโชว์แถว "ประเภท Error" ของ DRP** (เดิม gate เฉพาะ Med) · CSV + ค้นหา (`matchSearch`) ครอบ error_type ทุก type อยู่แล้ว
  - **Dashboard การ์ด "แยกตามประเภท Error" นับรวม Med + DRP** — `byErr` เอา `.filter(r=>r.type==="med")` ออก (นับทุกเคส) · เปลี่ยนชื่อการ์ด "แยกตามประเภท Med Error" → **"แยกตามประเภท Error"** · หมายเหตุ: การ์ดนี้ยังเป็นการ์ดสลับ — ตัวกรอง Dashboard = "DRP อย่างเดียว" จะโชว์ "แยกตามประเภท DRP" (10 หมวด) แทน · ดู "ทั้งหมด"/"Med" = โชว์ประเภท Error นับรวม
  - **บั๊กเวรไม่ย้ายเช้า→บ่ายเอง** (เปิดเว็บค้างทั้งวันไม่รีเฟรช) — state ใหม่ `shiftAuto` (เริ่ม `true`) · clock tick 1s เช็ค `shiftOf(เวลาปัจจุบัน)` ต่างจากที่ตั้งไว้ → set `occurred_time` ตามจริง (auto-follow) · กดปุ่มเลือกเวรเอง = `shiftAuto:false` (หยุด follow · เคารพที่เลือก) · ฟอร์มใหม่/สลับ ME↔DRP/บันทึกเสร็จ → reset `shiftAuto:true`
  - **ลักษณะความคลาดเคลื่อน:** เปลี่ยน "ค้างยา" → **"ยาขาด/ค้างยา"** (desc ใหม่ · ยาไม่พอ/ของหมด ได้ไม่ครบ) + เพิ่ม **"ลืมจัด/จ่ายยา"** (ลืมทั้งรายการ · จัด vs จ่าย ดูช่องประเภท Error) — 2 อันก่อน "อื่น ๆ" · ⚠️ รัน `scripts/rename_kangya_error_nature.sql` เปลี่ยนชื่อเคสเก่า "ค้างยา"→"ยาขาด/ค้างยา" (jsonb · แตะเฉพาะแถวที่มีค่านี้ · รันซ้ำได้)
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
