-- 0012: ผูกรหัสยา (drug_ids) เข้ากับเคส — Phase 2 ของแผนคลังยา
-- เหตุผล: เดิมเคสเก็บชื่อยาเป็นข้อความ snapshot → เปลี่ยนชื่อยาในคลังแล้ว Dashboard เห็นเป็น 2 ตัว
--         เพิ่ม drug_ids (array ขนานกับ drugs[]) เก็บ drugs.id ของยาที่เลือกจากคลัง
--         → เวลาแสดง/นับ ใช้ id ดึง "ชื่อล่าสุด" จากคลัง (เปลี่ยนชื่อแล้วตามทั้งหมด ไม่นับซ้ำ)
-- ยาที่พิมพ์เอง / เคสเก่าที่ยังไม่ผูก = null → fallback ใช้ข้อความเดิม

alter table public.incidents add column if not exists drug_ids jsonb not null default '[]'::jsonb;
