// คำนวณรายการรายงานที่ผ่านตัวกรอง (rlist) + แถวสำหรับตาราง/การ์ด (recRows) ของหน้า "รายงาน"
// ยกออกจาก MedDrpApp.tsx (Phase 2d) · pure function บน AppState · ตรรกะเดิมทุกอย่าง
import { drpLabel, natureText, natureToArray, resolveDrugLines } from "@/lib/helpers";
import { matchSearch } from "@/lib/records";
import { badgeDrp, badgeMed } from "@/lib/styles";
import { AppState } from "@/components/MedDrpApp.types";
import { Drug } from "@/lib/types";

export function computeRecordsData(S: AppState) {
  const drugsById = new Map<number, Drug>((S.drugs || []).map((d) => [d.id, d]));
  const rf = S.rf;
  const rq = (rf.q || "").toLowerCase();
  const rlist = (S.records || []).filter((r) => {
    if (rf.type !== "all" && r.type !== rf.type) return false;
    if (rf.location && r.location !== rf.location) return false;
    if (rf.error_type && !natureToArray(r.error_type).includes(rf.error_type)) return false;
    if (rf.error_nature) {
      const en = r.error_nature;
      const has = Array.isArray(en) ? en.includes(rf.error_nature) : en === rf.error_nature;
      if (!has) return false;
    }
    if (rf.severity && r.severity !== rf.severity) return false;
    if (rf.drp_type && r.drp_type !== rf.drp_type) return false;
    if (rf.outcome && r.outcome !== rf.outcome) return false;
    if (rf.reporter && r.reporter !== rf.reporter) return false;
    if (rf.shift && r.shift !== rf.shift) return false;
    if (rf.high_alert === "yes" && !r.high_alert) return false;
    if (rf.high_alert === "lasa" && !r.lasa) return false;
    if (rf.from && (r.occurred_at || "") < rf.from) return false;
    if (rf.to && (r.occurred_at || "") > rf.to) return false;
    if (!matchSearch(r, rq)) return false;
    return true;
  });
  const recRows = rlist.map((r) => ({
    r,
    date: r.occurred_at,
    typeLabel: r.type === "med" ? "Med Error" : "DRP",
    badgeStyle: r.type === "med" ? badgeMed : badgeDrp,
    hn: r.hn || "—",
    place: r.location || "—", // จุดที่พบ — DRP ก็มี (จุดที่พบเป็นช่องร่วม ME+DRP) เดิม gate เฉพาะ med ทำให้ DRP โชว์ "—"
    cat:
      r.type === "med"
        ? natureText(r.error_type)
        : r.drp_type === "อื่น ๆ" && r.drp_type_other
        ? "อื่น ๆ: " + r.drp_type_other
        : drpLabel(r.drp_type) || "—",
    severity: r.severity || "—",
    drug: (resolveDrugLines(r, drugsById).join(", ") || "—") + (r.high_alert ? " ⚠" : "") + (r.lasa ? " 🔁" : ""),
    reporter: r.reporter || "—",
    // รายละเอียดเหตุการณ์ที่พิมพ์ไว้ — Med ใช้ detail · DRP ใช้ cause (ช่อง "รายละเอียดเหตุการณ์/สาเหตุ")
    detailText: (r.type === "med" ? r.detail : r.cause) || "",
    edited: !!r.edited,
  }));
  return { rlist, recRows };
}
