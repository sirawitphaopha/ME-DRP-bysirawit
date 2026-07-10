# รายงานความคลาดเคลื่อน · Med Error & DRP (v0.9.2.0)

แอปบันทึก **Med Error** และ **DRP (Drug-Related Problems)** ของห้องยา OPD + Dashboard สรุปผล
กรอกเร็ว ใช้ได้ทั้งมือถือและเว็บ เชื่อมต่อ **Supabase** และ deploy บน **Cloudflare Workers**

> โปรเจกต์นี้พัฒนาต่อจากดีไซน์ที่ทำใน Claude Design (ไฟล์ต้นฉบับอยู่ใน `project/`, บทสนทนาออกแบบอยู่ใน `chats/`)

---

## 🧱 Tech stack

| ส่วน | เทคโนโลยี |
|---|---|
| Framework | **Next.js 15** (App Router) + React 19 + TypeScript |
| ฐานข้อมูล | **Supabase** (Postgres + REST) — โปรเจกต์ `tb-calculator` ตาราง `incidents` |
| Deploy | **Cloudflare Workers** ผ่าน **OpenNext** (`@opennextjs/cloudflare`) |
| ฟอนต์ | Sarabun (ไทยมีหัว) ผ่าน `next/font` |
| ธีม | teal (หลัก) + amber (ตัวเน้น) |

**ทำไม Next.js + Cloudflare:** เป็นเครื่องมือใช้ในองค์กร (โรงพยาบาล) และมีข้อมูลผู้ป่วย (HN) —
Next.js เก็บค่า secret ฝั่ง server ได้ รองรับการต่อยอด login/สิทธิ์ผู้ใช้ (Supabase Auth) ในอนาคต
และ deploy บน Cloudflare Workers ได้ทั่วโลก (edge) ต้นทุนต่ำ

---

## ✨ ฟีเจอร์

**หน้ากรอกข้อมูล** (สลับ Med Error / DRP)
- วันที่ default เป็นวันนี้ (แก้ได้) + ป้าย "วันนี้" · **เวลาที่พบ = ปุ่มเลือกเวร** (เวรเช้า/บ่าย/ดึก · เลือกอัตโนมัติตามเวลาปัจจุบัน 08–16/16–24/00–08 · กดสลับเองได้) + นาฬิกาเดินจริง
- HN แป้นตัวเลขล้วน (inputmode numeric)
- ประเภท Error เป็นชิปกดเลย + คำอธิบายภาษาไทยเมื่อเลือก
- **ลักษณะความคลาดเคลื่อน** เลือกได้หลายอัน + คำอธิบายแบบยาวของทุกอันที่เลือก ("อื่น ๆ" มีช่องระบุ)
- **NCC MERP A–I** จัดเป็น 4 โซนมีกรอบ + สีตามความรุนแรง (เทา/เขียว/ส้ม/แดง) + ปุ่มดูความหมายครบทุกระดับ
- **ชื่อยาหลายตัว** (+ เพิ่มยา / ลบทีละแถว)
- DRP: ประเภทปัญหา + สาเหตุ + intervention (dropdown) + ผลลัพธ์ (chip)
- ธง High-alert / LASA · แนบรูป (ย่อขนาดอัตโนมัติ เก็บเป็น data URL)
- **ตรวจฟอร์มก่อนบันทึก** ไฮไลต์ช่องจำเป็นสีแดง · **บันทึกร่างอัตโนมัติ** (กู้คืนเมื่อกลับมา)
- **ผู้รายงาน** = เมนูเลือกจากรายชื่อเจ้าหน้าที่ห้องยา OPD 16 คน (v0.9.1 · กันพิมพ์ผิด)

**หน้ารายการ** (แยกจาก Dashboard)
- กรองได้ทุกฟิลด์ (ประเภท/จุดที่พบ/Error/ระดับ/DRP/ผลลัพธ์/ผู้รายงาน/ช่วงวันที่/ค้นหา)
- กดดูรายละเอียดเต็ม → **แก้ไขได้ทุกฟิลด์** + **เก็บประวัติเวอร์ชันก่อนแก้** + ป้าย ✎ แก้ไข
- Export CSV เฉพาะที่กรอง

**Dashboard**
- KPI (นับขึ้น count-up) · กราฟรายเดือน 6 เดือน · ระดับความรุนแรง
- แยกประเภท Med/DRP · ยาที่พบบ่อย · ผลลัพธ์ intervention
- แยกตาม OPD (ทั่วไป/NCD) · ช่วงเวร · ลักษณะความคลาดเคลื่อน
- Near miss (A–B) % · นับ High-alert / LASA
- เลือกช่วงเวลา (ทั้งหมด/เดือนนี้/ไตรมาส/ปีนี้/กำหนดเอง) · Export CSV · 🖨 พิมพ์สรุป (PDF)

**ตั้งค่า** — ใส่ Supabase URL + key เอง (เก็บใน localStorage) หรือปล่อยว่างเพื่อรันโหมด demo
_(v0.9.1: กำลังจะปรับหน้านี้ — ซ่อน config ฐานข้อมูลสำหรับผู้ใช้จริง + เพิ่มเกี่ยวกับแอป/จัดการรายชื่อ · ดู `docs/ROADMAP.md`)_

**📱 รองรับมือถือ (v0.9.1)** — หัวเมนู / หน้ารายการ / Dashboard ปรับเป็นการ์ด + แนวตั้งบนจอมือถืออัตโนมัติ (เดสก์ท็อปคงเดิม)

**🆕 v0.9.2.0**
- **Dropdown ผู้รายงานทำเอง** (ไม่ใช้ `<select>` ของ OS) — ชื่อยาวอยู่บรรทัดเดียว ไม่ตก 2 บรรทัดบน iOS
- **Heatmap เวร × วันในสัปดาห์** ในหน้า Dashboard — ดูว่าเวร/วันไหนเกิดเหตุบ่อย
- แก้บั๊กเส้นขอบช่องกรอก/เมนูหายหลังกด (โฟกัสใช้ `border` เต็มแทน `border-color`)
- มือถือ: วันที่เกิดเหตุจัดชิดซ้าย + ป้าย "วันนี้" ไม่ลอยตกขอบ (เดสก์ท็อปไม่แตะ)

**🆕 v0.9.2.1**
- **Dropdown ผู้รายงานเด้งขึ้น/ลงอัตโนมัติ** — ช่องอยู่ล่างจอ เมนูเด้งขึ้นบน (ไม่โดนตัดขอบล่าง)
- **แท่งกราฟ Dashboard** เป็น gradient teal + โชว์ %
- **สลับแท็บเด้งขึ้นบนสุดเสมอ** (ไม่ค้างตำแหน่งเลื่อนจากหน้าก่อน)
- **เดโม่เหลือ 10 เคส + ใช้รายชื่อผู้รายงานจริง 16 คน** (ตัวกรองไม่มีชื่อเก่า)

**🆕 v0.9.3.0**
- **เพิ่มประเภท Error "Pre-dispensing" (จัดยา)** แยกจาก Dispensing (จ่ายยา) → 5 ประเภท
- **ปุ่มประเภท Error โชว์ English (ไทย)** เช่น Pre-dispensing (จัดยา) · มือถือจัดเป็นตาราง 2 คอลัมน์
- **ประเภท Error เลือกได้หลายอัน** (เก็บเป็น array/jsonb) — ต้องรัน `supabase/migrations/0001_error_type_to_jsonb.sql` ที่ Supabase ก่อน deploy

---

## 🚀 เริ่มใช้งาน (local dev)

```bash
npm install
cp .env.example .env.local   # ใส่ค่า Supabase (มีค่า default ให้แล้วใน .env.local)
npm run dev                  # http://localhost:3000
```

### ตัวแปรสภาพแวดล้อม (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://ryewggkhunpuipgkgbfv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```
> ค่าเหล่านี้เป็นคีย์ฝั่ง client (เปิดเผยได้) การเข้าถึงจริงถูกคุมด้วย RLS ของ Supabase
> ผู้ใช้ยังตั้งค่า URL/key เองได้ที่หน้า **ตั้งค่า** หรือปล่อยว่างเพื่อรัน **โหมด demo** (localStorage + เดโม 100 เคส)

---

## 🗄️ ฐานข้อมูล Supabase

- โปรเจกต์: **tb-calculator** (`ryewggkhunpuipgkgbfv`, region ap-northeast-1)
- ตาราง: **`public.incidents`** (เก็บทั้ง Med Error และ DRP แยกด้วยคอลัมน์ `type`)
- Schema เต็ม + RLS อยู่ที่ [`supabase/schema.sql`](supabase/schema.sql)
- มีข้อมูลเดโม 100 เคส (ติดธง `is_demo = true` — ลบได้ด้วย `delete from public.incidents where is_demo;`)

พฤติกรรมการโหลดข้อมูล (`lib/data.ts` + `components/MedDrpApp.tsx`):
1. โชว์ข้อมูลในเครื่อง (cache/seed) **ทันที** ไม่บล็อกด้วย network
2. ถ้าตั้งค่า Supabase แล้ว → ดึงข้อมูลจริงมาทับเบื้องหลัง

---

## ☁️ Deploy ขึ้น Cloudflare Workers

```bash
npm run cf:preview   # build + รันจำลอง Worker ในเครื่อง
npm run cf:deploy    # build + deploy ขึ้น Cloudflare (ต้อง wrangler login ก่อน)
```

ตั้งค่า env บน Cloudflare (อย่างใดอย่างหนึ่ง):
- **Dashboard:** Workers & Pages → โปรเจกต์ → Settings → Variables → เพิ่ม
  `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **CLI:** `npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL` (และ key)

> `NEXT_PUBLIC_*` ถูกฝังตอน build — ต้องมีค่าตอนรัน `cf:deploy` (ผ่าน `.env.local` หรือ env ของ CI)

ตั้งค่า Worker อยู่ที่ [`wrangler.jsonc`](wrangler.jsonc) และ [`open-next.config.ts`](open-next.config.ts)

---

## 📁 โครงสร้างโปรเจกต์

```
app/                     # Next.js App Router (layout, page, globals.css)
components/
  MedDrpApp.tsx          # แอปหลักทั้งหมด (state + ทุกหน้า + modal) — พอร์ตจากดีไซน์ DC
  ui.tsx                 # คอมโพเนนต์ hover/focus (HButton/HInput/HSelect/...)
lib/
  constants.ts           # ค่าคงที่ (ERROR_TYPES, SEVERITY, DRP_TYPES, ...)
  types.ts               # TypeScript types
  helpers.ts             # today/nowTime/shiftOf/format/nature-drug helpers
  data.ts                # Supabase client + fetch/insert/update
  seed.ts                # เดโม 100 เคส (โหมด demo)
  style.ts               # แปลง CSS string → React style (คงดีไซน์เดิมแบบ pixel-perfect)
supabase/schema.sql      # โครงตาราง + RLS
project/                 # 🎨 ดีไซน์ต้นฉบับจาก Claude Design (อ้างอิง)
chats/                   # 💬 บทสนทนาการออกแบบ (อ้างอิง)
docs/                    # บันทึก session
```

---

## 🔒 หมายเหตุความปลอดภัย (สำคัญก่อนใช้จริง)

- ตอนนี้ RLS เปิดให้ **anon** อ่าน/เขียนได้โดยไม่ต้องล็อกอิน (เพื่อความเร็วในการทดสอบ)
- ก่อนใช้จริงกับข้อมูลผู้ป่วย แนะนำ: ทำ **Supabase Auth** + จำกัดสิทธิ์ (เภสัชกรเห็น/แก้เฉพาะของตน, หัวหน้าเห็นทั้งหมด),
  พิจารณาการเก็บ **HN แบบเข้ารหัส/ปิดบางส่วน** ให้สอดคล้อง **PDPA** และนโยบายโรงพยาบาล

---

## 🧭 สิ่งที่ทำต่อได้ (roadmap)

- คลังชื่อยา autocomplete (ลดพิมพ์ผิด + ทำให้ "ยาที่พบบ่อย" แม่นขึ้น)
- Supabase Auth + สิทธิ์ผู้ใช้ + แจ้งเตือนเคสระดับ E–I / High-alert
- สรุปรายเดือน PDF อัตโนมัติ · ค่าคงที่ (dropdown) แก้ได้เองโดยไม่ต้องแก้โค้ด
- แนบรูปขึ้น Supabase Storage แทน data URL
