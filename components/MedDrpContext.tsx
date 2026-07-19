"use client";
// Context กลางของแอป (Phase 2) — root MedDrpApp provide state/handler/ค่า derived ครั้งเดียว
// แต่ละ view (components/views/*.tsx) เรียก useMedDrp() ดึงไปใช้ แทนการอ้าง closure เดิม
// สถานะยังเป็นก้อนเดียว (setState merge เดิม) · type นี้จะขยายเพิ่มทีละหน้าที่แยกออกมา
import { createContext, ReactNode, useContext } from "react";
import { AppState } from "@/components/MedDrpApp.types";
import { DashRange, Drug, FormState, Incident } from "@/lib/types";

export type SetState = (u: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;

// พารามิเตอร์ของ drugPickerUI (ช่องเลือกยา autocomplete · ใช้ร่วมหน้ากรอก + โหมดแก้ไข)
export interface DrugPickerCfg {
  rows: string[];
  sug: { i: number; term: string } | null;
  onSug: (v: { i: number; term: string } | null) => void;
  onBlur: (i: number) => void;
  onChangeAt: (i: number, v: string) => void;
  onPick: (i: number, d: Drug) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
  placeholder?: string;
}
export type EfArrField = "error_type" | "error_nature" | "source_units";

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
  // ---- รายละเอียด + โหมดแก้ไข (DetailModal) ----
  flash: (msg: string) => void;
  doSoftDelete: () => void;
  startEdit: () => void;
  cancelEdit: () => void;
  saveEdit: () => void;
  setEf: (k: string, v: unknown) => void;
  setEfLocation: (v: string) => void;
  efArr: (field: EfArrField) => string[];
  efToggleArr: (field: EfArrField, val: string) => void;
  setEfDrugAt: (i: number, v: string) => void;
  pickEfDrug: (i: number, d: Drug) => void;
  addEfDrug: () => void;
  removeEfDrug: (i: number) => void;
  // render helper ที่ใช้ร่วมกับหน้ากรอก (ส่งเป็นฟังก์ชันคืน JSX)
  renderReporterDD: (id: string, value: string, onChange: (v: string) => void, err: boolean) => ReactNode;
  drugPickerUI: (cfg: DrugPickerCfg) => ReactNode;
  // ---- หน้ากรอก (FormView) + หน้าผลการส่ง (ResultOverlay) ----
  clock: string;
  setField: (k: keyof FormState, v: unknown) => void;
  requestSwitchType: (t: "med" | "drp") => void;
  toggleHighAlert: () => void;
  save: () => void;
  toggleSourceUnit: (k: string) => void;
  toggleErrType: (k: string) => void;
  toggleNature: (k: string) => void;
  setLocation: (v: string) => void;
  setDrpType: (k: string) => void;
  setDrugAt: (i: number, v: string) => void;
  pickDrug: (i: number, d: Drug) => void;
  removeDrug: (i: number) => void;
  addDrug: () => void;
  resendResult: () => void;
}

export const MedDrpContext = createContext<MedDrpCtx | null>(null);

export function useMedDrp(): MedDrpCtx {
  const ctx = useContext(MedDrpContext);
  if (!ctx) throw new Error("useMedDrp ต้องอยู่ภายใน <MedDrpContext.Provider>");
  return ctx;
}
