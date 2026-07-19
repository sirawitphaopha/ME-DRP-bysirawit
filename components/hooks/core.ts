// Core ที่ hook ต่าง ๆ ใช้ร่วม (Phase 3) — state ยังเป็นก้อนเดียว · แก้ผ่าน setState/stateRef เหมือนเดิม
import { MutableRefObject } from "react";
import { AppState } from "@/components/MedDrpApp.types";
import { SetState } from "@/components/MedDrpContext";

export interface Core {
  setState: SetState;
  stateRef: MutableRefObject<AppState>;
}

// จัด drug_ids ให้ยาวเท่า drugs เสมอ (เผื่อร่างเก่า/ฟอร์มไม่มี) — ใช้ร่วม useFormMutations + useEditForm
export function alignIds(ids: (number | null)[], len: number): (number | null)[] {
  const a = ids.slice();
  while (a.length < len) a.push(null);
  return a;
}
