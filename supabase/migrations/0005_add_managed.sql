-- 0005: สถานะ "แก้ไขเรียบร้อยแล้ว" (Med Error)
-- เหตุผล: บางเคสแก้ไขแล้วแต่ไม่มีอะไรต้องเขียนบรรยาย — ให้ติ๊กถูกพอ
-- managed = true → ถือว่าจัดการเคสเรียบร้อย (แยกจากข้อความบรรยายในคอลัมน์ management)

alter table public.incidents add column if not exists managed boolean not null default false;
