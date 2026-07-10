import { Drug, FormState, Incident, RecordFilter } from "./types";
import { INTERVENTIONS, LOCATIONS, OUTCOMES } from "./constants";

const pad = (n: number) => String(n).padStart(2, "0");

export function today(): string {
  const d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

export function nowTime(): string {
  const d = new Date();
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
}

// ช่วงเวร: เช้า 08:00–15:59, บ่าย 16:00–ปลายวัน, ที่เหลือ = ดึก
export function shiftOf(t?: string): string {
  if (!t) return "";
  const h = parseInt(String(t).split(":")[0], 10);
  if (isNaN(h)) return "";
  if (h >= 8 && h < 16) return "เวรเช้า";
  if (h >= 16) return "เวรบ่าย";
  return "เวรดึก";
}

// วันเวลาแบบไทย (พ.ศ.) สำหรับหน้าประวัติ/แก้ไข
export function fmtThaiDateTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return (
    pad(d.getDate()) +
    "/" +
    pad(d.getMonth() + 1) +
    "/" +
    (d.getFullYear() + 543) +
    " " +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

export function emptyForm(defaultReporter: string, keep?: Partial<Pick<FormState, "hn" | "reporter">>): FormState {
  keep = keep || {};
  return {
    occurred_at: today(),
    occurred_time: nowTime(),
    hn: keep.hn || "",
    location: LOCATIONS[0],
    an: "",
    error_type: [],
    error_nature: [],
    error_nature_other: "",
    severity: "",
    drp_type: "",
    drp_type_other: "",
    cause: "",
    intervention: INTERVENTIONS[0],
    outcome: "",
    drugs: [""],
    drug: "",
    high_alert: false,
    lasa: false,
    attachment: null,
    detail: "",
    management: "",
    reporter: keep.reporter != null ? keep.reporter : defaultReporter || "",
  };
}

export function emptyFilter(): RecordFilter {
  return {
    q: "",
    type: "all",
    location: "",
    error_type: "",
    error_nature: "",
    severity: "",
    drp_type: "",
    outcome: "",
    reporter: "",
    shift: "",
    high_alert: "",
    from: "",
    to: "",
  };
}

// รวมลักษณะความคลาดเคลื่อน (array/legacy string) เป็นข้อความ
export function natureText(v: string[] | string | undefined, other?: string): string {
  const arr = Array.isArray(v) ? v.slice() : v ? [v] : [];
  if (!arr.length) return "—";
  return arr.map((x) => (x === "อื่น ๆ" && other ? "อื่น ๆ (" + other + ")" : x)).join(", ");
}

export function drugText(r: Incident): string {
  if (r.drugs && r.drugs.length) return r.drugs.filter(Boolean).join(", ");
  return r.drug || "";
}

export function drugArr(r: Incident): string[] {
  if (r.drugs && r.drugs.length) return r.drugs.filter(Boolean);
  return r.drug ? String(r.drug).split(/\s*,\s*/).filter(Boolean) : [];
}

export function outcomeLabel(k?: string): string {
  const o = OUTCOMES.find((x) => x.key === k);
  return o ? o.label : k || "";
}

export function natureToArray(v: string[] | string | undefined): string[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}

// รวมข้อมูลยาเป็นข้อความบรรทัดเดียว (ตาม mockup) สำหรับใส่ในช่องชื่อยา
export function drugFlatLine(d: Drug): string {
  let s = d.generic;
  let sv = [d.strength, d.unit].filter(Boolean).join(" ");
  // ยาสูตรผสม (ความแรงหลายค่า เช่น "500 + 125") ใส่วงเล็บให้อ่านง่าย ไม่สับสนกับ " + " ของชื่อยา
  if (sv && d.strength && d.strength.includes("+")) sv = "(" + sv + ")";
  const dose = [sv, d.percent ? d.percent + "%" : ""].filter(Boolean).join(" "); // เพิ่มความเข้มข้น (%)
  if (dose) s += " " + dose;
  if (d.form) s += " " + d.form;
  if (d.route) s += " " + d.route; // ทางให้ยา (IV/IM/oral)
  if (d.brand) s += " (" + d.brand + ")";
  if (d.preg) s += " (Preg " + d.preg + ")";
  if (d.had) s += " (HAD)";
  if (d.renal) s += " (Renal)";
  return s;
}

// ข้อความค้นหาของยา (generic + brand · lowercase) สำหรับ filter
export function drugSearchText(d: Drug): string {
  return (d.generic + " " + (d.brand || "")).toLowerCase();
}
