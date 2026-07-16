-- 0008: เปิด Realtime (กระจายสัญญาณสด) ให้ตาราง drugs (คลังยา)
-- เหตุผล: แอดมินเพิ่ม/แก้ยาในระบบ — ทุกเครื่องที่เปิดแอปอยู่ต้องเห็นยาใหม่ทันทีโดยไม่ต้องรีเฟรช
--         (เดิมคลังยาโหลดครั้งเดียวตอนเปิดแอปแล้ว cache ในเครื่อง → ยาที่เพิ่มทีหลังไม่เห็นจนกว่าจะรีเฟรช)
-- replica identity full = ส่งข้อมูลแถวเดิมมาด้วยตอน update/delete (ไม่ใช่แค่ id)

alter table public.drugs replica identity full;

-- เพิ่มตารางเข้า publication ของ Realtime (ถ้ามีอยู่แล้วจะ error — ข้ามได้)
alter publication supabase_realtime add table public.drugs;

-- ตรวจผล: ต้องเห็นแถว public | drugs
-- select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime';
