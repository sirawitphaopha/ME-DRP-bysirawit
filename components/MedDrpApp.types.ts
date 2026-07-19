// รูปสถานะทั้งหมดของแอป (AppState) — ย้ายออกจาก components/MedDrpApp.tsx (Phase 1)
// สถานะยังเป็นก้อนเดียว (setState merge เดิม) · แค่แยก type ออกมาให้ไฟล์หลักสั้นลง
import { DashRange, Drug, DrugAudit, FormState, Incident, RecordFilter, SupabaseCfg, ViewName } from "@/lib/types";

export interface AppState {
  view: ViewName;
  type: "med" | "drp";
  form: FormState;
  records: Incident[];
  search: string;
  dashType: "all" | "med" | "drp";
  dashYear: number; // ปี ค.ศ. ที่เลือกดูในกราฟรายเดือน (0 = ปีปัจจุบัน)
  cfg: SupabaseCfg;
  toast: string;
  saving: boolean;
  pending: Incident[]; // รายงานที่ยังส่งขึ้นระบบไม่สำเร็จ (รอส่งใหม่)
  syncing: boolean; // กำลังลองส่งคิวที่ค้างขึ้นระบบ
  trash: Incident[]; // รายงานในถังขยะ (ลบแบบซ่อน · กู้คืนได้)
  askDelete: boolean; // ป๊อปยืนยันลบแบบซ่อน (จากหน้ารายละเอียด)
  hardTarget: Incident | null; // รายงานที่กำลังจะลบถาวร (จากถังขยะ)
  hardInput: string; // ข้อความยืนยันลบถาวร (ต้องพิมพ์ HN ของเคสให้ตรง)
  trashBusy: boolean; // กำลังทำงานกับถังขยะ (กันกดซ้ำ)
  result: "ok" | "fail" | null; // หน้าผลการส่งเต็มจอหลังกดบันทึก (null = ไม่โชว์)
  resultRec: Incident | null; // รายงานที่รอ "ส่งอีกครั้ง" จากหน้าผล (กรณี fail)
  resending: boolean; // กำลังกด "ส่งอีกครั้ง" จากหน้าผล
  rf: RecordFilter;
  detail: Incident | null;
  editMode: boolean;
  editForm: Partial<Incident> & { drug?: string };
  showHistory: boolean;
  kpiAnim: number[];
  showSevLegend: boolean;
  showNatureLegend: boolean;
  showDrpLegend: boolean;
  confirmDiscard: boolean; // ป๊อปยืนยันตอนจะปิดหน้าต่างขณะแก้ไขค้างอยู่
  confirmSwitch: "med" | "drp" | null; // ป๊อปยืนยันตอนจะสลับ ME↔DRP ทั้งที่กรอกฟอร์มค้างอยู่
  hadAuto: boolean; // ธง High-alert ถูกติดอัตโนมัติจากยา HAD (true) vs ผู้ใช้ติ๊กเอง (false) — ใช้ตัดสินว่าจะปลดธงให้ตอนลบยาไหม
  errors: Record<string, boolean>;
  dashRange: DashRange;
  dd: string | null; // custom dropdown ที่เปิดอยู่ (id) เช่น "reporter" / "edit-reporter"
  ddUp: boolean; // เมนู dropdown เด้งขึ้นบน (true) เมื่อช่องอยู่ครึ่งล่างจอ
  shiftAuto: boolean; // เวรตามเวลาจริงอัตโนมัติ (true) จนกว่าจะกดเลือกเวรเอง (false) — เปิดค้างทั้งวันไม่ต้องรีเฟรช
  drugs: Drug[]; // คลังยา (autocomplete · โหลดครั้งเดียวแล้ว cache)
  drugSug: { i: number; term: string } | null; // ช่องยาแถวที่เปิด suggest + คำค้น (หน้ากรอก)
  efDrugSug: { i: number; term: string } | null; // suggest ช่องยาในโหมดแก้ไข (Phase 3)
  // ---- หน้า "คลังยา" (จัดการ master data · v0.9.10.0) ----
  drugSearch: string; // คำค้นในหน้าคลังยา
  drugFilters: string[]; // ตัวกรองแบบเลือกหลายอัน: "had" · "form:<value>" · "pregDX" (ว่าง = ทั้งหมด)
  drugSort: { key: string; dir: "asc" | "desc" } | null; // การเรียงคอลัมน์ (null = generic asc)
  drugEdit: Partial<Drug> | null; // ยาที่กำลังเพิ่ม/แก้ในป๊อป (null = ปิด)
  drugEditNew: boolean; // true = เพิ่มใหม่ · false = แก้ของเดิม
  drugEditOrig: Partial<Drug> | null; // สแนปช็อตตอนเปิดป๊อป (ใช้เช็คว่าแก้ค้างไหมก่อนปิด)
  drugEditConfirmClose: boolean; // ป๊อปยืนยันปิดทั้งที่แก้ค้าง
  drugLog: { drug: Drug; entries: DrugAudit[] } | null; // ป๊อปประวัติการแก้ไขของยา
  drugLogLoading: boolean; // กำลังโหลดประวัติ
  drugBusy: boolean; // กำลังบันทึก (กันกดซ้ำ + โชว์สถานะ)
}
