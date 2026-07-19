-- อัปเดตเคสเก่า: ลักษณะความคลาดเคลื่อน "ค้างยา" -> "ยาขาด/ค้างยา" (เปลี่ยนชื่อหมวด v0.9.11.x)
-- error_nature เป็น jsonb array → แทนเฉพาะสมาชิกที่เป็น "ค้างยา" ด้วย "ยาขาด/ค้างยา" (สมาชิกอื่นคงเดิม)
-- ปลอดภัย: แตะเฉพาะแถวที่มี "ค้างยา" · รันซ้ำได้ (ถ้าไม่มีแล้วจะไม่โดนแถวไหน)
UPDATE incidents
SET error_nature = (
  SELECT jsonb_agg(
    CASE WHEN elem = '"ค้างยา"'::jsonb THEN '"ยาขาด/ค้างยา"'::jsonb ELSE elem END
  )
  FROM jsonb_array_elements(error_nature) AS elem
)
WHERE error_nature @> '["ค้างยา"]'::jsonb;
