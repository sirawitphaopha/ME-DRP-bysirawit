"use client";
// Context กลางของแอป (Phase 2) — root MedDrpApp provide state/handler/ค่า derived ครั้งเดียว
// แต่ละ view (components/views/*.tsx) เรียก useMedDrp() ดึงไปใช้ แทนการอ้าง closure เดิม
// สถานะยังเป็นก้อนเดียว (setState merge เดิม) · type นี้จะขยายเพิ่มทีละหน้าที่แยกออกมา
import { createContext, useContext } from "react";
import { AppState } from "@/components/MedDrpApp.types";
import { DashRange, Drug, Incident } from "@/lib/types";

export type SetState = (u: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;

export interface MedDrpCtx {
  S: AppState;
  isMobile: boolean;
  cfgConfigured: boolean;
  setState: SetState;
  // ---- ตั้งค่า / ถังขยะ / ยาที่ซ่อน (ManageView) ----
  doRestore: (id: string) => void;
  setDrugHidden: (d: Drug, hidden: boolean) => void;
  openDrugLog: (d: Drug) => void;
  // ---- คลังยา (DrugsAdminView + DrugEditModal + DrugLogModal) ----
  getFilteredDrugs: (s: AppState) => Drug[];
  exportDrugsCsv: () => void;
  openAddDrug: () => void;
  openEditDrug: (d: Drug) => void;
  toggleDrugFilter: (key: string) => void;
  clearDrugFilters: () => void;
  toggleDrugSort: (key: string) => void;
  setDrugField: (k: keyof Drug, v: unknown) => void;
  requestCloseDrugEdit: () => void;
  saveDrug: () => void;
  forceCloseDrugEdit: () => void;
  // ---- Dashboard (DashboardView) ----
  orgName: string;
  animateKpi: (idx: number, target: number) => void;
  exportCsv: (subset?: Incident[]) => void;
  setDashPreset: (p: DashRange["preset"]) => void;
}

export const MedDrpContext = createContext<MedDrpCtx | null>(null);

export function useMedDrp(): MedDrpCtx {
  const ctx = useContext(MedDrpContext);
  if (!ctx) throw new Error("useMedDrp ต้องอยู่ภายใน <MedDrpContext.Provider>");
  return ctx;
}
