-- ============================================================
--  Med Error & DRP — Supabase schema
--  รันไฟล์นี้ใน Supabase → SQL Editor → New query → Run
-- ============================================================

-- ตารางเดียวเก็บทั้ง Med Error และ DRP (แยกด้วยคอลัมน์ type)
create table if not exists public.incidents (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('med','drp')),   -- 'med' = Med Error, 'drp' = DRP
  occurred_at   date not null default current_date,            -- วันที่เกิดเหตุ (default = วันนี้)
  occurred_time text,                                          -- เวลาที่พบ (HH:MM)
  shift         text,                                          -- ช่วงเวร (เวรเช้า/เวรบ่าย/เวรดึก)
  hn            text,                                          -- HN ผู้ป่วย
  reporter      text,                                          -- ผู้รายงาน
  drug          text,                                          -- ชื่อยาที่เกี่ยวข้อง
  high_alert    boolean default false,                         -- ธงยา High-alert
  lasa          boolean default false,                         -- ธงยา LASA (ชื่อ/รูปคล้าย)
  attachment    text,                                          -- รูปแนบ (data URL / ภายหลังใช้ URL จาก Storage)
  detail        text,                                          -- รายละเอียดเหตุการณ์ / เพิ่มเติม

  -- ---------- เฉพาะ Med Error ----------
  location          text,                                      -- จุดที่พบ (OPD ทั่วไป / OPD NCD)
  error_type        jsonb default '[]'::jsonb,                  -- ประเภท (array เลือกหลายอัน): Prescribing / Transcribing / Pre-dispensing / Dispensing / Administration
  error_nature      text,                                      -- ลักษณะ: ผิดคน/ผิดชนิดยา/ผิดความแรง/ผิดขนาด ฯลฯ
  error_nature_other text,                                     -- ข้อความเมื่อเลือก "อื่น ๆ"
  severity          text check (severity is null or severity in ('A','B','C','D','E','F','G','H','I')), -- NCC MERP
  management        text,                                      -- การแก้ไข / จัดการ

  -- ---------- เฉพาะ DRP ----------
  drp_type       text,                                         -- ประเภทปัญหา DRP
  drp_type_other text,                                         -- ข้อความเมื่อเลือก "อื่น ๆ"
  cause          text,                                         -- สาเหตุของปัญหา
  intervention   text,                                         -- การ intervention
  outcome        text check (outcome is null or outcome in ('Accepted','Rejected','Pending')), -- ผลลัพธ์

  -- ---------- การแก้ไข / ประวัติเวอร์ชัน ----------
  edited        boolean default false,                         -- เคยถูกแก้ไขหรือไม่
  edited_at     timestamptz,                                   -- แก้ไขล่าสุดเมื่อ
  edit_count    integer default 0,                             -- จำนวนครั้งที่แก้ไข
  history       jsonb default '[]'::jsonb,                     -- เวอร์ชันก่อนแก้ไข (array ของ snapshot)

  created_at    timestamptz not null default now()
);

-- Index สำหรับ dashboard (กรอง/เรียงตามวันและประเภท)
create index if not exists incidents_occurred_idx on public.incidents (occurred_at desc);
create index if not exists incidents_type_idx     on public.incidents (type);

-- ============================================================
--  Row Level Security
--  เดโม: เปิดให้ anon key อ่าน/เพิ่มได้ (รายงานแบบไม่ต้องล็อกอิน)
--  โปรดปรับตามนโยบายความปลอดภัยของโรงพยาบาลก่อนใช้จริง
-- ============================================================
alter table public.incidents enable row level security;

create policy "anon can insert" on public.incidents
  for insert to anon with check (true);

create policy "anon can read" on public.incidents
  for select to anon using (true);

-- (ทางเลือก) ให้แก้/ลบได้ด้วย — เปิดเมื่อจำเป็น
-- create policy "anon can update" on public.incidents for update to anon using (true) with check (true);
-- create policy "anon can delete" on public.incidents for delete to anon using (true);
