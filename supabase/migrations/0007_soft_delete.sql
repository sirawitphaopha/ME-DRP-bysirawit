-- 0007: ลบรายงานแบบ 2 ชั้น (ถังขยะ)
--   ชั้น 1 — ลบแบบซ่อน (soft delete): ตั้งค่า deleted_at = now() → ซ่อนจากรายการ แต่ยังกู้คืนได้
--   ชั้น 2 — ลบถาวร (hard delete): ลบแถวออกจากฐานข้อมูลจริง (ต้องพิมพ์ยืนยัน)
-- ⚠️ ต้องรันก่อน deploy โค้ดที่มีฟีเจอร์ลบ

-- คอลัมน์เครื่องหมาย "ถูกลบเมื่อไหร่" (null = ยังใช้งานอยู่ · not null = อยู่ในถังขยะ)
alter table public.incidents add column if not exists deleted_at timestamptz;
create index if not exists incidents_deleted_idx on public.incidents (deleted_at);

-- อนุญาต hard delete — เดิม RLS มีแค่ insert/select/update ยังไม่มี policy สำหรับ delete
drop policy if exists "incidents anon delete" on public.incidents;
create policy "incidents anon delete" on public.incidents for delete to anon, authenticated using (true);
