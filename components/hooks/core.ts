// Core ที่ hook ต่าง ๆ ใช้ร่วม (Phase 3) — state ยังเป็นก้อนเดียว · แก้ผ่าน setState/stateRef เหมือนเดิม
import { MutableRefObject } from "react";
import { AppState } from "@/components/MedDrpApp.types";
import { SetState } from "@/components/MedDrpContext";

export interface Core {
  setState: SetState;
  stateRef: MutableRefObject<AppState>;
}
