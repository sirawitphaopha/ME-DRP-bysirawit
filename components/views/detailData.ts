// คำนวณข้อมูลหน้ารายละเอียดเคส (detailRows) + ประวัติการแก้ไข (historyList) — ยกออกจาก
// MedDrpApp.tsx (Phase 2e) · pure function บน AppState · ตรรกะเดิมทุกอย่าง
import { drpLabel, drugText, fmtThaiDateTime, natureText, outcomeLabel, resolveDrugLines, shiftOf } from "@/lib/helpers";
import { AppState } from "@/components/MedDrpApp.types";
import { Drug } from "@/lib/types";

export function computeDetailData(S: AppState) {
  const drugsById = new Map<number, Drug>((S.drugs || []).map((d) => [d.id, d]));
  const dt2 = S.detail;
  const isMed2 = dt2?.type === "med";
  let detailRows: { label: string; value: string; ok?: string }[] = [];
  const detailBadgeStyle = isMed2
    ? "background:#E7F3F1;color:#0B655D;font-size:12.5px;font-weight:700;padding:4px 12px;border-radius:999px;"
    : "background:#FEF3E2;color:#B45309;font-size:12.5px;font-weight:700;padding:4px 12px;border-radius:999px;";
  if (dt2) {
    const flags = [dt2.high_alert ? "High-alert" : null, dt2.lasa ? "LASA" : null].filter(Boolean).join(", ") || "—";
    const tval = dt2.shift || shiftOf(dt2.occurred_time) || "—";
    const natureDisp = natureText(dt2.error_nature, dt2.error_nature_other);
    const sourceDisp = natureText(dt2.source_units, dt2.source_unit_other); // หน่วยงานต้นเหตุ (reuse natureText · array + อื่น ๆ)
    const drugDisp = resolveDrugLines(dt2, drugsById).join(", ") || drugText(dt2); // Phase 2: โชว์ชื่อล่าสุดจากรหัสยา
    const drpDisp = dt2.drp_type === "อื่น ๆ" && dt2.drp_type_other ? "อื่น ๆ — " + dt2.drp_type_other : drpLabel(dt2.drp_type);
    const rows: [string, unknown][] = isMed2
      ? [
          ["วันที่เกิดเหตุ", dt2.occurred_at],
          ["เวลาที่พบ", tval],
          ["HN ผู้ป่วย", dt2.hn],
          ["จุดที่พบ", dt2.location],
          ...(dt2.an ? ([["AN (เลขที่ผู้ป่วยใน)", dt2.an]] as [string, unknown][]) : []),
          ["หน่วยงานต้นเหตุ", sourceDisp],
          ["ประเภท Error", natureText(dt2.error_type)],
          ["ลักษณะความคลาดเคลื่อน", natureDisp],
          ["ระดับความรุนแรง (NCC MERP)", dt2.severity],
          ["ชื่อยาที่เกี่ยวข้อง", drugDisp],
          ["ธงเตือนยา", flags],
          ["รายละเอียดเหตุการณ์", dt2.detail],
          ["การแก้ไข / จัดการ", dt2.management],
          ["ผู้รายงาน", dt2.reporter],
        ]
      : [
          ["วันที่", dt2.occurred_at],
          ["เวลาที่พบ", tval],
          ["HN ผู้ป่วย", dt2.hn],
          ["จุดที่พบ", dt2.location],
          ...(dt2.an ? ([["AN (เลขที่ผู้ป่วยใน)", dt2.an]] as [string, unknown][]) : []),
          ["หน่วยงานต้นเหตุ", sourceDisp],
          ["ประเภท Error", natureText(dt2.error_type)],
          ["ประเภทปัญหาจากการใช้ยา (DRP)", drpDisp],
          ["ระดับความรุนแรง (NCC MERP)", dt2.severity],
          ["ยาที่เกี่ยวข้อง", drugDisp],
          ["ธงเตือนยา", flags],
          ["รายละเอียดเหตุการณ์ / สาเหตุ", dt2.cause],
          ["การแก้ไข (Intervention)", dt2.intervention],
          // มีแถวผลตอบรับเฉพาะเคสที่เกี่ยวกับแพทย์: เสนอแพทย์ (มี outcome) หรือติ๊กว่าเภสัชกรแก้เอง
          ...(dt2.pharmacist_only || dt2.outcome
            ? ([
                [
                  "ผลตอบรับจากแพทย์",
                  dt2.pharmacist_only ? "เภสัชกรแก้ไขเอง ไม่ผ่านแพทย์" : outcomeLabel(dt2.outcome),
                ],
              ] as [string, unknown][])
            : []),
          ...(dt2.management ? ([["การแก้ไข / จัดการ", dt2.management]] as [string, unknown][]) : []),
          ...(dt2.detail ? ([["รายละเอียดเพิ่มเติม", dt2.detail]] as [string, unknown][]) : []), // เคสเก่าที่เคยมีช่องนี้
          ["ผู้รายงาน", dt2.reporter],
        ];
    detailRows = rows.map(([label, value]) => {
      // ป้ายเขียว: Med Error ที่ติ๊กว่าจัดการแล้ว · DRP ที่เภสัชกรแก้เอง
      let ok = "";
      if (label === "การแก้ไข / จัดการ" && dt2.managed) ok = "✓ แก้ไขแล้ว";
      if (label === "ผลตอบรับจากแพทย์" && dt2.pharmacist_only) ok = "✓ เภสัชกรแก้ไขเอง";
      const v = value === "" || value == null ? "—" : String(value);
      return { label, value: ok === "✓ เภสัชกรแก้ไขเอง" ? "—" : v, ok };
    });
  }
  const historyList = ((dt2 && dt2.history) || []).map((h, idx) => {
    const isM = h.type === "med";
    const rr: [string, unknown][] = isM
      ? [
          ["วันที่/เวลา", (h.occurred_at || "—") + " " + (h.occurred_time || "")],
          ["ประเภท Error", natureText(h.error_type)],
          ["ลักษณะ", natureText(h.error_nature, h.error_nature_other)],
          ["ระดับ", h.severity],
          ["ยา", h.drug],
          ["เหตุการณ์", h.detail],
          ["การแก้ไข", h.management],
          ["ผู้รายงาน", h.reporter],
        ]
      : [
          ["วันที่/เวลา", (h.occurred_at || "—") + " " + (h.occurred_time || "")],
          ["ประเภท Error", natureText(h.error_type)],
          ["ประเภท DRP", drpLabel(h.drp_type)],
          ["ระดับ", h.severity],
          ["รายละเอียดเหตุการณ์ / สาเหตุ", h.cause],
          ["Intervention", h.intervention],
          ["การแก้ไข / จัดการ", h.management],
          ["ผลตอบรับจากแพทย์", h.pharmacist_only ? "เภสัชกรแก้ไขเอง ไม่ผ่านแพทย์" : outcomeLabel(h.outcome)],
          ["ยา", h.drug],
          ["รายละเอียด", h.detail],
          ["ผู้รายงาน", h.reporter],
        ];
    return {
      no: idx + 1,
      at: fmtThaiDateTime(h.saved_at),
      rows: rr.map(([label, value]) => ({ label, value: value === "" || value == null ? "—" : String(value) })),
    };
  });
  return { dt2, isMed2, detailRows, detailBadgeStyle, historyList };
}
