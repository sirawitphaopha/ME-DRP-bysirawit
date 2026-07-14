-- 0006: DRP — เภสัชกรแก้ไขเอง ไม่ผ่านแพทย์
-- เหตุผล: บาง DRP เภสัชกรจัดการได้เองโดยไม่ต้องเสนอแพทย์ (เช่น ให้คำแนะนำผู้ป่วยเรื่องวิธีใช้ยา)
-- ติ๊กแล้ว → ไม่ต้องกรอก "ผลตอบรับจากแพทย์" (outcome เก็บเป็น null)

alter table public.incidents add column if not exists pharmacist_only boolean not null default false;
