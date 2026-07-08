import { Incident } from "./types";
import { shiftOf } from "./helpers";

// สร้างเดโม 100 เคส (ใช้เฉพาะโหมด demo ในเครื่อง เมื่อยังไม่ตั้งค่า Supabase)
export function seed(): Incident[] {
  const drugs = [
    "Amoxicillin 500 mg",
    "Warfarin 2 mg",
    "Metformin 500 mg",
    "Enalapril 5 mg",
    "Paracetamol 500 mg",
    "Simvastatin 20 mg",
    "Amlodipine 5 mg",
    "Omeprazole 20 mg",
  ];
  const errs = ["Prescribing", "Transcribing", "Dispensing", "Administration"];
  const sev = ["A", "B", "C", "C", "C", "D", "D", "E", "B", "C", "A", "F"];
  const drps = ["ขนาดยา", "Drug interaction", "ยาซ้ำซ้อน", "ADR/แพ้ยา", "Adherence", "ยาไม่เหมาะสม"];
  const iv = ["ปรึกษาแพทย์ผู้สั่งใช้", "ปรับขนาด/ความถี่ยา", "เปลี่ยนรายการยา", "ให้คำแนะนำผู้ป่วย"];
  const outc = ["Accepted", "Accepted", "Accepted", "Rejected", "Pending"];
  const reps = ["ภญ. สมหญิง", "ภก. อนุชา", "ภญ. ปิยะดา", "ภก. ธนวัฒน์"];
  const locs = ["OPD ทั่วไป", "OPD NCD"];
  const medDetail = [
    "จ่ายยาผิดความแรง",
    "หยิบยาผิดชนิด (LASA)",
    "ฉลากยาระบุวิธีใช้ผิด",
    "จำนวนยาไม่ครบตามสั่ง",
    "สั่งซ้ำรายการเดิม",
    "ขนาดยาสูงกว่าที่ควร",
  ];
  const medFix = [
    "โทรตามผู้ป่วยกลับมาเปลี่ยนยา",
    "แก้ไขก่อนส่งมอบผู้ป่วย",
    "แจ้งแพทย์และปรับคำสั่ง",
    "ทวนสอบซ้ำโดยเภสัชกร",
  ];
  const drpCause = [
    "ผู้ป่วยมีโรคไต ต้องปรับขนาด",
    "ประวัติแพ้ยาไม่ถูกบันทึก",
    "ได้รับยากลุ่มเดียวกันซ้ำ",
    "ผู้ป่วยลืมกินยา",
    "คู่ยามีปฏิกิริยาสำคัญ",
  ];
  const drpDet = ["เภสัชกรให้คำแนะนำและติดตาม", "ปรึกษาแพทย์เพื่อทบทวนการรักษา", "บันทึกประวัติแพ้ยาเพิ่มเติม"];
  const natures = ["ผิดคน", "ผิดชนิดยา", "ผิดความแรง", "ผิดขนาด/ปริมาณ", "ผิดวิธีใช้/ฉลาก", "ผิดจำนวน", "ผิดเวลา"];
  const times = ["09:15", "10:40", "11:05", "13:30", "14:50", "16:20", "18:10", "20:30", "01:15"];
  const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
  const out: Incident[] = [];
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  for (let i = 0; i < 100; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 27));
    const iso = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
    const hn = String(1000000 + Math.floor(Math.random() * 8999999));
    const tm = pick(times);
    const ha = Math.random() < 0.22;
    const la = Math.random() < 0.12;
    if (Math.random() < 0.6) {
      out.push({
        id: "seed" + i,
        type: "med",
        occurred_at: iso,
        occurred_time: tm,
        shift: shiftOf(tm),
        hn,
        location: pick(locs),
        error_type: pick(errs),
        error_nature: [pick(natures)],
        severity: pick(sev),
        drug: pick(drugs),
        high_alert: ha,
        lasa: la,
        detail: pick(medDetail),
        management: pick(medFix),
        reporter: pick(reps),
        created_at: d.toISOString(),
      });
    } else {
      out.push({
        id: "seed" + i,
        type: "drp",
        occurred_at: iso,
        occurred_time: tm,
        shift: shiftOf(tm),
        hn,
        drp_type: pick(drps),
        cause: pick(drpCause),
        drug: pick(drugs),
        high_alert: ha,
        lasa: la,
        intervention: pick(iv),
        outcome: pick(outc),
        detail: pick(drpDet),
        reporter: pick(reps),
        created_at: d.toISOString(),
      });
    }
  }
  return out.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}
