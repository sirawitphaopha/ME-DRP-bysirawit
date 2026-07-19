// สไตล์/ตัวสร้างสไตล์ที่ใช้ซ้ำทั้งแอป (ย้ายออกจาก components/MedDrpApp.tsx · Phase 1)
// ทั้งหมดเป็นค่าคงที่/ฟังก์ชันบริสุทธิ์ ไม่พึ่ง state — พฤติกรรมเดิมทุกอย่าง
import { AM, AMT } from "@/lib/constants";
import { css } from "@/lib/style";

// ===== style generators (พอร์ตจาก renderVals) =====
export const chip = (sel: boolean) =>
  sel
    ? "padding:9px 14px;border-radius:999px;border:1px solid " +
      AM +
      ";font-size:14px;font-weight:600;cursor:pointer;background:" +
      AM +
      ";color:" +
      AMT +
      ";box-shadow:0 4px 12px -3px rgba(245,166,35,.55);"
    : "padding:9px 14px;border-radius:999px;border:1px solid #CFE7E2;font-size:14px;font-weight:600;cursor:pointer;background:#EAF4F1;color:#0B655D;";
export const seg = (sel: boolean) =>
  sel
    ? "flex:1;text-align:center;padding:11px;border-radius:10px;border:none;cursor:pointer;font-size:15px;font-weight:600;background:#fff;color:#0F8A80;box-shadow:0 1px 4px rgba(11,101,93,.18);"
    : "flex:1;text-align:center;padding:11px;border-radius:10px;border:none;cursor:pointer;font-size:15px;font-weight:500;background:transparent;color:#5B7C78;";
export const nav = (sel: boolean) =>
  sel
    ? "border:none;cursor:pointer;font-size:14px;font-weight:600;padding:8px 15px;border-radius:9px;background:" +
      AM +
      ";color:" +
      AMT +
      ";"
    : "border:none;cursor:pointer;font-size:14px;font-weight:500;padding:8px 15px;border-radius:9px;background:rgba(255,255,255,.14);color:#DFF1EE;";
// ปุ่มเมนูมือถือ — เต็มความกว้าง (flex:1) แบ่งเท่ากัน
export const navM = (sel: boolean) =>
  sel
    ? "flex:1;text-align:center;border:none;cursor:pointer;font-size:14px;font-weight:600;padding:9px 4px;border-radius:9px;background:" +
      AM +
      ";color:" +
      AMT +
      ";"
    : "flex:1;text-align:center;border:none;cursor:pointer;font-size:14px;font-weight:500;padding:9px 4px;border-radius:9px;background:rgba(255,255,255,.14);color:#DFF1EE;";
export const filt = (sel: boolean) =>
  sel
    ? "border:none;cursor:pointer;font-size:13px;font-weight:600;padding:8px 14px;border-radius:9px;background:#0F8A80;color:#fff;"
    : "border:none;cursor:pointer;font-size:13px;font-weight:500;padding:8px 14px;border-radius:9px;background:transparent;color:#0B655D;";
// ปุ่มเลือกเวร (แทนช่องกรอกเวลา) — active = เทลทึบ
export const shiftBtn = (active: boolean) =>
  active
    ? "flex:1;text-align:center;border:1.5px solid #0F8A80;background:#0F8A80;color:#fff;font-size:13.5px;font-weight:600;padding:10px 6px;border-radius:10px;cursor:pointer;white-space:nowrap;"
    : "flex:1;text-align:center;border:1.5px solid #DCE7E5;background:#fff;color:#475569;font-size:13.5px;font-weight:500;padding:10px 6px;border-radius:10px;cursor:pointer;white-space:nowrap;";
// เวลาตัวแทนของแต่ละเวร — กดเลือกเวร → เซ็ต occurred_time เป็นค่านี้ (shiftOf จะคืนค่าเวรนั้น) · เก็บตรรกะบันทึกเดิมไว้ทั้งหมด
export const SHIFT_TIME: Record<string, string> = { เวรเช้า: "12:00", เวรบ่าย: "20:00", เวรดึก: "04:00" };

export const INPUT_BASE =
  "width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:11px 13px;font-size:15px;color:#0F172A;background:#fff;outline:none;";
// ใช้ border เต็ม (ไม่ใช่ border-color) กัน React ผสม shorthand/longhand แล้วเส้นขอบหายตอน blur บน iOS
export const INPUT_FOCUS = "border:1.5px solid #F5A623;box-shadow:0 0 0 3px rgba(245,166,35,.2)";
export const badgeMed =
  "background:#E7F3F1;color:#0B655D;font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;white-space:nowrap;";
export const badgeDrp =
  "background:#FEF3E2;color:#B45309;font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;white-space:nowrap;";
// สีธง Preg category ตามความเสี่ยง (A ปลอดภัยสุด → X ห้ามใช้ในหญิงตั้งครรภ์)
export const pregColor = (p: string): string => {
  const m: Record<string, string> = {
    A: "background:#DCF3E3;color:#15803D;", // เขียวเข้ม
    B: "background:#E8F1DD;color:#4D7C0F;", // เขียว
    C: "background:#FEF3E2;color:#B45309;", // เหลือง/ส้ม
    D: "background:#FCE4D6;color:#C2410C;", // ส้มแดง
    X: "background:#FBE0DE;color:#B3261E;", // แดง
  };
  return m[p] || "background:#E9ECF3;color:#43526B;"; // ไม่ระบุ = เทา
};

// สไตล์ที่ใช้ซ้ำในโหมดแก้ไข
export const editLabel = css("font-size:12.5px;font-weight:600;color:#475569;display:block;margin-bottom:5px;");
export const editInput =
  "width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:10px 12px;font-size:14px;outline:none;";
export const editInputSelect =
  "width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:10px 32px 10px 12px;font-size:14px;background-color:#fff;outline:none;";
export const editTextarea =
  "width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:10px 12px;font-size:14px;outline:none;resize:vertical;line-height:1.5;";
