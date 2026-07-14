-- 0004: เปิด Realtime (กระจายสัญญาณสด) ให้ตาราง incidents
-- เหตุผล: หลายเครื่องใช้งานพร้อมกัน — เครื่อง A บันทึกเคสใหม่ เครื่อง B ต้องเห็นทันทีโดยไม่ต้องรีเฟรช
-- replica identity full = ส่งข้อมูลแถวเดิมมาด้วยตอน update/delete (ไม่ใช่แค่ id)

alter table public.incidents replica identity full;

-- เพิ่มตารางเข้า publication ของ Realtime (ถ้ามีอยู่แล้วจะ error — ข้ามได้)
alter publication supabase_realtime add table public.incidents;

-- ตรวจผล: ต้องเห็นแถว public | incidents
-- select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime';
