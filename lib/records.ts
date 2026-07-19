// ฟังก์ชันบริสุทธิ์เกี่ยวกับรายงาน (records) — localStorage I/O · dedup · AN format ·
// ค้นหา · ตรวจช่องบังคับ · ย้ายออกจาก components/MedDrpApp.tsx (Phase 1) · ไม่พึ่ง state
import { CONSULT_DOCTOR, IPD_LOCATION } from "@/lib/constants";
import { drpLabel, drugText, isUuid, natureText } from "@/lib/helpers";
import { FormState, Incident } from "@/lib/types";

// อ่าน/เขียนลิสต์ Incident ใน localStorage อย่างปลอดภัย (คืน [] ถ้าอ่านไม่ได้)
export function readList(key: string): Incident[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(v) ? (v as Incident[]) : [];
  } catch {
    return [];
  }
}
export function writeList(key: string, list: Incident[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {}
}

// เคสที่ยังไม่ขึ้น server (แหล่งความจริง = คิว pending) + local ที่ id ยังไม่ใช่ uuid (เคสเก่า) · dedup ด้วย id · ตัดเคสที่อยู่บน server แล้ว
export function dedupUnsynced(pending: Incident[], local: Incident[], serverIds: Set<string>): Incident[] {
  const seen = new Set<string>();
  const out: Incident[] = [];
  for (const r of [...pending, ...local.filter((x) => !isUuid(x.id))]) {
    if (r && r.id && !serverIds.has(r.id) && !seen.has(r.id)) {
      seen.add(r.id);
      out.push(r);
    }
  }
  return out;
}

// ตรวจช่องบังคับ — ใช้ร่วมทั้งหน้ากรอกใหม่ (save) และหน้าแก้ไข (saveEdit)
// #15: จัดรูปแบบ AN → "YY-NNNNN" (YY = ปี พ.ศ. 2 หลักของปีที่เกิดเหตุ · NNNNN = เลขลำดับ 5 หลัก)
// พิมพ์ "1234" → "69-01234" · พิมพ์ "1" → "69-00001" · พิมพ์เกิน 5 หลัก = ถือว่าใส่ปีมาเอง (เอา 5 ตัวท้ายเป็นลำดับ, ที่เหลือเป็นปี)
export function formatAn(raw: string, occurredAt?: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  let seq: string;
  let yy: string;
  if (digits.length > 5) {
    seq = digits.slice(-5);
    yy = digits.slice(0, digits.length - 5).slice(-2).padStart(2, "0");
  } else {
    seq = digits.padStart(5, "0");
    const y = parseInt(String(occurredAt || "").slice(0, 4), 10);
    const ce = isNaN(y) ? new Date().getFullYear() : y;
    yy = String((ce + 543) % 100).padStart(2, "0"); // แปลง ค.ศ. → พ.ศ. แล้วเอา 2 หลักท้าย
  }
  return yy + "-" + seq;
}

// #17: ค้นหาจากเฉพาะช่องที่ผู้ใช้เห็น (ไม่ใช่ JSON.stringify ทั้งก้อน) — กันพิมพ์ "med"/"true"/"uuid" แล้วเจอทุกเคส
export function matchSearch(r: Incident, q: string): boolean {
  if (!q) return true;
  const hay = [
    r.hn,
    r.an,
    r.reporter,
    r.location,
    drugText(r),
    r.detail,
    r.cause,
    r.management,
    natureText(r.error_type),
    natureText(r.error_nature, r.error_nature_other),
    natureText(r.source_units, r.source_unit_other),
    drpLabel(r.drp_type),
    r.drp_type_other,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function validateIncident(f: Partial<FormState>, type: "med" | "drp"): Record<string, boolean> {
  const errs: Record<string, boolean> = {};
  if (!String(f.hn || "").trim()) errs.hn = true;
  if (!f.occurred_at) errs.occurred_at = true;
  if (!f.location) errs.location = true;
  if (f.location === IPD_LOCATION && !/\d/.test(String(f.an || ""))) errs.an = true; // IPD → ต้องมี AN (มีตัวเลขจริง ไม่ใช่ "-" เปล่า)
  if (!f.reporter) errs.reporter = true;
  if (!f.severity) errs.severity = true; // ระดับความรุนแรง A–I — บังคับทั้ง ME และ DRP
  // หน่วยงานต้นเหตุ — บังคับเลือกอย่างน้อย 1 (ทั้ง ME/DRP) · เลือก "อื่น ๆ" ต้องระบุ
  const suArr = Array.isArray(f.source_units) ? f.source_units : f.source_units ? [f.source_units] : [];
  if (!suArr.length) errs.source_units = true;
  if (suArr.includes("อื่น ๆ") && !String(f.source_unit_other || "").trim()) errs.source_unit_other = true;
  // ประเภท Error — บังคับเลือกอย่างน้อย 1 ทั้ง ME และ DRP (ขั้นตอนที่พลาด · ใช้ร่วมกัน)
  if (!(Array.isArray(f.error_type) ? f.error_type.length : f.error_type)) errs.error_type = true;
  if (type === "med") {
    const natureArr = Array.isArray(f.error_nature) ? f.error_nature : f.error_nature ? [f.error_nature] : [];
    if (!natureArr.length) errs.error_nature = true;
    // #14: เลือก "อื่น ๆ" ต้องระบุข้อความด้วย
    if (natureArr.includes("อื่น ๆ") && !String(f.error_nature_other || "").trim()) errs.error_nature_other = true;
    if (!String(f.detail || "").trim()) errs.detail = true;
  } else {
    if (!f.drp_type) errs.drp_type = true;
    // #14: เลือกประเภท DRP "อื่น ๆ" ต้องระบุข้อความด้วย
    if (f.drp_type === "อื่น ๆ" && !String(f.drp_type_other || "").trim()) errs.drp_type_other = true;
    // บังคับผลตอบรับเฉพาะเคสที่เสนอแพทย์จริง (เลือก "ปรึกษาแพทย์ผู้สั่งใช้" และไม่ได้ติ๊กว่าเภสัชกรแก้เอง)
    if (!f.pharmacist_only && f.intervention === CONSULT_DOCTOR && !f.outcome) errs.outcome = true;
    if (!String(f.cause || "").trim()) errs.cause = true;
    if (!f.intervention) errs.intervention = true;
  }
  return errs;
}
