-- Migration: error_type  text -> jsonb (array)
-- เหตุผล: ให้เลือก "ประเภท Error" ได้หลายอัน (เหมือน error_nature)
-- ผลต่อข้อมูลเดิม: ค่าเดิมที่เป็น string เดี่ยว (เช่น 'Prescribing') จะกลายเป็น array 1 สมาชิก (["Prescribing"])
--                 ค่าว่าง/NULL -> []  · ข้อมูลไม่หาย
-- รันครั้งเดียว (idempotent-ish: ถ้าเป็น jsonb อยู่แล้วจะข้าม)

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name = 'incidents' AND column_name = 'error_type') = 'text' THEN

    ALTER TABLE incidents ALTER COLUMN error_type DROP DEFAULT;

    ALTER TABLE incidents
      ALTER COLUMN error_type TYPE jsonb USING (
        CASE
          WHEN error_type IS NULL OR btrim(error_type) = '' THEN '[]'::jsonb
          WHEN left(btrim(error_type), 1) = '[' THEN error_type::jsonb
          ELSE jsonb_build_array(error_type)
        END
      );

    ALTER TABLE incidents ALTER COLUMN error_type SET DEFAULT '[]'::jsonb;
  END IF;
END $$;
