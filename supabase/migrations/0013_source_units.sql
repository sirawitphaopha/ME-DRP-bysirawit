-- 0013: หน่วยงานต้นเหตุ (source_units) — วิชาชีพ/หน่วยงานที่เป็นต้นตอของความคลาดเคลื่อน
-- เหตุผล: เดิมมีแต่ "ประเภท Error" (ขั้นตอน: Prescribing/Dispensing/...) ซึ่งไม่ตรงกับวิชาชีพ 1:1
--         (พยาบาลบางทีคีย์คำสั่ง=prescribe · IPD เภสัชเป็นคน transcribe) → เพิ่มช่องใหม่แยกต่างหาก
--   source_units      = array (jsonb · เลือกหลายอัน · แพทย์/พยาบาล/เภสัชกร/ผู้ช่วยเภสัช/ห้องแล็บ/เวชระเบียน/ผู้ป่วย ญาติ/อื่น ๆ)
--   source_unit_other = ข้อความเมื่อเลือก "อื่น ๆ"
-- ใช้ทั้ง Med + DRP · บังคับกรอก (validation ฝั่งแอป) · เคสเก่าที่ไม่มีค่า = [] (default)

alter table public.incidents
  add column if not exists source_units jsonb not null default '[]'::jsonb,
  add column if not exists source_unit_other text;
