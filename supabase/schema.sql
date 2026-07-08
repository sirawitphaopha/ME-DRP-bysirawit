-- ============================================================
--  Med Error & DRP — Supabase schema (v0.9)
--  ตรงกับ migration ที่ใช้จริงในโปรเจกต์ tb-calculator
--  รันใน Supabase → SQL Editor → New query → Run
-- ============================================================

create table if not exists public.incidents (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('med','drp')),   -- 'med' = Med Error, 'drp' = DRP
  occurred_at   date not null default current_date,            -- วันที่เกิดเหตุ (default = วันนี้)
  occurred_time text,                                          -- เวลาที่พบ (HH:MM)
  shift         text,                                          -- ช่วงเวร (เวรเช้า/เวรบ่าย/เวรดึก)
  hn            text,                                          -- HN ผู้ป่วย (ตัวเลขล้วน)
  reporter      text,                                          -- ผู้รายงาน
  drug          text,                                          -- ชื่อยา (ข้อความรวม join ด้วย ", ")
  drugs         jsonb default '[]'::jsonb,                     -- ชื่อยาหลายตัว (array)
  high_alert    boolean default false,                         -- ธงยา High-alert
  lasa          boolean default false,                         -- ธงยา LASA (ชื่อ/รูปคล้าย)
  attachment    text,                                          -- รูปแนบ (data URL / ภายหลังใช้ URL จาก Storage)
  detail        text,                                          -- รายละเอียดเหตุการณ์ / เพิ่มเติม

  -- ---------- เฉพาะ Med Error ----------
  location           text,                                     -- จุดที่พบ (OPD ทั่วไป / OPD NCD)
  error_type         text,                                     -- Prescribing / Transcribing / Dispensing / Administration
  error_nature       jsonb default '[]'::jsonb,                -- ลักษณะ (array): ผิดคน/ผิดชนิดยา/ผิดความแรง/ผิดขนาด ฯลฯ
  error_nature_other text,                                     -- ข้อความเมื่อเลือก "อื่น ๆ"
  severity           text check (severity is null or severity in ('A','B','C','D','E','F','G','H','I')), -- NCC MERP
  management         text,                                     -- การแก้ไข / จัดการ

  -- ---------- เฉพาะ DRP ----------
  drp_type       text,                                         -- ประเภทปัญหา DRP
  drp_type_other text,                                         -- ข้อความเมื่อเลือก "อื่น ๆ"
  cause          text,                                         -- สาเหตุของปัญหา
  intervention   text,                                         -- การ intervention
  outcome        text check (outcome is null or outcome in ('Accepted','Rejected','Pending')), -- ผลลัพธ์

  -- ---------- การแก้ไข / ประวัติเวอร์ชัน ----------
  edited     boolean default false,                            -- เคยถูกแก้ไขหรือไม่
  edited_at  timestamptz,                                      -- แก้ไขล่าสุดเมื่อ
  edit_count integer default 0,                                -- จำนวนครั้งที่แก้ไข
  history    jsonb default '[]'::jsonb,                        -- เวอร์ชันก่อนแก้ไข (array ของ snapshot)

  is_demo    boolean default false,                            -- true = ข้อมูลเดโม (ลบง่ายด้วย delete ... where is_demo)
  created_at timestamptz not null default now()
);

create index if not exists incidents_occurred_idx on public.incidents (occurred_at desc);
create index if not exists incidents_type_idx     on public.incidents (type);
create index if not exists incidents_demo_idx     on public.incidents (is_demo);

-- ============================================================
--  Row Level Security
--  เดโม: เปิดให้ anon/authenticated อ่าน/เพิ่ม/แก้ได้ (รายงานโดยไม่ต้องล็อกอิน)
--  ⚠ ก่อนใช้จริงกับข้อมูลผู้ป่วย ควรทำ Supabase Auth + จำกัดสิทธิ์ตามนโยบายโรงพยาบาล (PDPA)
-- ============================================================
alter table public.incidents enable row level security;

drop policy if exists "incidents anon insert" on public.incidents;
drop policy if exists "incidents anon read"   on public.incidents;
drop policy if exists "incidents anon update" on public.incidents;

create policy "incidents anon insert" on public.incidents for insert to anon, authenticated with check (true);
create policy "incidents anon read"   on public.incidents for select to anon, authenticated using (true);
create policy "incidents anon update" on public.incidents for update to anon, authenticated using (true) with check (true);

-- (ทางเลือก) ลบข้อมูลเดโมทั้งหมด:
--   delete from public.incidents where is_demo;
