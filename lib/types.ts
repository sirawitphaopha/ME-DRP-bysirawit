// ชนิดข้อมูลของรายงาน incident (Med Error / DRP)

export type IncidentType = "med" | "drp";

export interface Incident {
  id: string;
  type: IncidentType;
  occurred_at: string; // YYYY-MM-DD
  occurred_time?: string; // HH:MM
  shift?: string;
  hn?: string;
  reporter?: string;
  drug?: string; // ข้อความรวม (join ด้วย ", ")
  drugs?: string[]; // รายการยาหลายตัว
  high_alert?: boolean;
  lasa?: boolean;
  attachment?: string | null; // data URL
  detail?: string;

  // Med Error
  location?: string;
  an?: string; // เลขที่ผู้ป่วยใน (Admission Number) — ใช้เมื่อจุดที่พบ = ห้องยา IPD (มีได้ทั้ง Med/DRP)
  error_type?: string[] | string; // array (เลือกหลายอันได้) หรือ string (ข้อมูลเก่า)
  error_nature?: string[] | string; // array (ใหม่) หรือ string (ข้อมูลเก่า)
  error_nature_other?: string;
  severity?: string;
  management?: string;
  managed?: boolean; // ติ๊ก "แก้ไขเรียบร้อยแล้ว" (ไม่ต้องพิมพ์บรรยายก็ได้)
  pharmacist_only?: boolean; // DRP: เภสัชกรแก้ไขเอง ไม่ผ่านแพทย์ (ไม่มีผลตอบรับจากแพทย์)

  // DRP
  drp_type?: string;
  drp_type_other?: string;
  cause?: string;
  intervention?: string;
  outcome?: string;

  // แก้ไข / ประวัติ
  edited?: boolean;
  edited_at?: string;
  edit_count?: number;
  history?: Incident[];
  saved_at?: string; // ใช้ใน snapshot ของ history

  is_demo?: boolean;
  created_at?: string;
}

export interface FormState {
  occurred_at: string;
  occurred_time: string;
  hn: string;
  location: string;
  an: string;
  error_type: string[];
  error_nature: string[];
  error_nature_other: string;
  severity: string;
  drp_type: string;
  drp_type_other: string;
  cause: string;
  intervention: string;
  outcome: string;
  drugs: string[];
  drug: string;
  high_alert: boolean;
  lasa: boolean;
  attachment: string | null;
  detail: string;
  management: string;
  managed: boolean;
  pharmacist_only: boolean;
  reporter: string;
}

export interface RecordFilter {
  q: string;
  type: "all" | IncidentType;
  location: string;
  error_type: string;
  error_nature: string;
  severity: string;
  drp_type: string;
  outcome: string;
  reporter: string;
  shift: string;
  high_alert: string;
  from: string;
  to: string;
}

export interface DashRange {
  preset: "all" | "month" | "quarter" | "year" | "custom";
  from: string;
  to: string;
}

export interface SupabaseCfg {
  url: string;
  key: string;
}

// คลังยา (ตาราง drugs) — สำหรับ autocomplete ค้นหายา
export interface Drug {
  id: number;
  generic: string;
  strength?: string | null;
  unit?: string | null;
  percent?: string | null;
  form?: string | null;
  route?: string | null;
  release?: string | null;
  brand?: string | null;
  had?: boolean;
  preg?: string | null;
  renal?: boolean;
}

export type ViewName = "form" | "records" | "dashboard" | "settings" | "manage";
