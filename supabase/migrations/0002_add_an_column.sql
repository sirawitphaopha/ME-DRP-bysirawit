-- ============================================================
--  0002_add_an_column.sql  (v0.9.4)
--  เพิ่มคอลัมน์ an = เลขที่ผู้ป่วยใน (Admission Number)
--  ใช้เมื่อ "จุดที่พบ" = ห้องยา IPD (ผู้ป่วยใน)
--  เก็บเป็น text เพราะรูปแบบมีขีด เช่น 69-03004
--  รันใน Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.incidents add column if not exists an text;
