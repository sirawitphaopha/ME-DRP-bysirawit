-- เพิ่มยา Sofosbuvir + Velpatasvir (SOF/VEL) เข้าคลังยา — รพ.ปรางค์กู่ ใช้ยา GPO
-- ไม่ใส่ชื่อการค้า (พี่กันสั่ง) · ไม่ใส่ Pregnancy category (ยาอนุมัติปี 2016 หลัง FDA เลิกใช้ระบบ A–X)
-- คอลัมน์ id ของตาราง drugs ไม่ใช่ identity → ต้องกำหนดเลขเอง (max+1)

insert into public.drugs (id, generic, strength, unit, form, route, had, renal)
select coalesce(max(id), 0) + 1, 'Sofosbuvir + Velpatasvir', '400 + 100', 'mg', 'tab', 'oral', false, false
from public.drugs;

-- ผลที่จะเห็นในช่องค้นหายา: Sofosbuvir + Velpatasvir (400 + 100 mg) tab oral
