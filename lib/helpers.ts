import { Drug, FormState, Incident, RecordFilter } from "./types";
import { DRP_TYPES, LOCATIONS, OUTCOMES } from "./constants";

const pad = (n: number) => String(n).padStart(2, "0");

// สร้างรหัส UUID v4 ที่ถูกต้องเสมอ (คอลัมน์ id ในฐานข้อมูลเป็นชนิด uuid — รับเฉพาะรูปแบบนี้)
// 🐛 บั๊กเดิม: fallback เป็น "r"+Date.now() ซึ่งไม่ใช่ uuid → Supabase ตีกลับ (invalid input syntax for type uuid)
//    บันทึกไม่ขึ้นระบบส่วนกลาง โดยเฉพาะ Safari รุ่นเก่า / เปิดผ่านลิงก์ที่ไม่ใช่ https / เว็บวิวในแอป
//    ที่ไม่มี crypto.randomUUID → เครื่องอื่นเลยไม่เห็นข้อมูล (bug cross-browser)
// ตัวนี้ทำงานได้ทุกเบราว์เซอร์: ใช้ crypto.randomUUID ถ้ามี, ไม่มีก็สุ่มเลขมาประกอบเป็น uuid เอง
export function uuid(): string {
  const c: Crypto | undefined = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") {
    try {
      return c.randomUUID();
    } catch {
      // บางเว็บวิว throw ตอน context ไม่ปลอดภัย → ตกไปใช้วิธีสุ่มเองด้านล่าง
    }
  }
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(b);
  } else {
    for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  }
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  const h: string[] = [];
  for (let i = 0; i < 16; i++) h.push(b[i].toString(16).padStart(2, "0"));
  return (
    h[0] + h[1] + h[2] + h[3] + "-" + h[4] + h[5] + "-" + h[6] + h[7] + "-" + h[8] + h[9] + "-" + h[10] + h[11] + h[12] + h[13] + h[14] + h[15]
  );
}

// ตรวจว่า id เป็นรูปแบบ uuid ที่ฐานข้อมูลรับได้ไหม — ใช้เช็ค id เก่าที่อาจเป็น "r..." ก่อนส่งซ้ำ
export function isUuid(v: unknown): boolean {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

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
    source_units: [],
    source_unit_other: "",
    severity: "",
    drp_type: "",
    drp_type_other: "",
    cause: "",
    intervention: "", // ต้องว่าง — เดิมค้างค่าแรกไว้ ทำให้บันทึกค่าที่ไม่ได้ตั้งใจเลือก (การบังคับกรอกไม่มีผล)
    outcome: "",
    drugs: [""],
    drug_ids: [null],
    drug: "",
    high_alert: false,
    lasa: false,
    attachment: null,
    detail: "",
    management: "",
    managed: false,
    pharmacist_only: false,
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

// แปลงรายการยาของเคสเป็น "ชื่อล่าสุด" — ถ้ามี drug_ids[i] และเจอในคลัง → ใช้ชื่อปัจจุบัน (เปลี่ยนชื่อยาแล้วตามทั้งหมด)
// ไม่มี id / เคสเก่า / พิมพ์เอง → ใช้ข้อความเดิมที่บันทึกไว้ · byId = แผนที่ id→Drug จากคลังปัจจุบัน
export function resolveDrugLines(r: Incident, byId?: Map<number, Drug>): string[] {
  const texts = drugArr(r);
  const ids = r.drug_ids || [];
  return texts.map((t, i) => {
    const id = ids[i];
    if (byId && id != null) {
      const d = byId.get(id);
      if (d) return drugFlatLine(d);
    }
    return t;
  });
}
// รหัสยาที่ผูกกับเคส (unique · ตัด null) — ใช้ group ใน Dashboard ให้เปลี่ยนชื่อแล้วไม่นับซ้ำ
export function drugIdArr(r: Incident): number[] {
  return (r.drug_ids || []).filter((x): x is number => x != null);
}

export function outcomeLabel(k?: string): string {
  const o = OUTCOMES.find((x) => x.key === k);
  return o ? o.label : k || "";
}

// แปลงค่าประเภท DRP ที่เก็บในฐานข้อมูล (key) → ป้ายที่โชว์ (ไทย + วงเล็บอังกฤษ)
// ค่าเก่าที่ไม่อยู่ในลิสต์ ให้โชว์ตามเดิม
export function drpLabel(k?: string): string {
  const t = DRP_TYPES.find((x) => x.key === k);
  return t ? t.label || t.key : k || "";
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
