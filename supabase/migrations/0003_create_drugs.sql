-- ============================================================
--  0003_create_drugs.sql  (v0.9.6 — คลังยาสำหรับ autocomplete)
--  ตาราง drugs = master data ค้นหายา (416 ตัว · รพ.ปรางค์กู่)
--  snapshot: เคส (incidents) เก็บชื่อยาเป็นข้อความ ไม่ผูก FK → แก้ยาไม่กระทบเคสเก่า
--  ข้อมูล 416 แถว: รันต่อด้วย scripts/drugs_seed.sql
-- ============================================================

create table if not exists public.drugs (
  id       integer primary key,
  generic  text not null,          -- ชื่อยา generic
  strength text,                    -- ความแรง เช่น "500", "500 + 125"
  unit     text,                    -- mg, g, mcg, mg/2 mL
  percent  text,                    -- Percent (%)
  form     text,                    -- tab, amp, vial, sachet, DPI ...
  route    text,                    -- oral, IV, ...
  release  text,                    -- ER, SR (การปลดปล่อย)
  brand    text,                    -- ชื่อการค้า
  had      boolean default false,   -- High Alert Drug
  preg     text,                    -- Preg category A–X
  renal    boolean default false    -- ต้องปรับขนาดตามไต
);

create index if not exists drugs_generic_idx on public.drugs (lower(generic));
create index if not exists drugs_brand_idx   on public.drugs (lower(coalesce(brand, '')));

-- RLS: อ่านได้ทุกคน (คลังยากลาง · โหลดไป autocomplete) · แก้ไขผ่าน admin/MCP เท่านั้น
alter table public.drugs enable row level security;
drop policy if exists "drugs read" on public.drugs;
create policy "drugs read" on public.drugs for select to anon, authenticated using (true);
