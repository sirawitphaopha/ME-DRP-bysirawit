"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AM,
  AMT,
  APP_VERSION,
  DRP_TYPES,
  ERROR_NATURE,
  ERROR_TYPES,
  CONSULT_DOCTOR,
  INTERVENTIONS,
  LOCATIONS,
  IPD_LOCATION,
  OUTCOMES,
  REPORTERS,
  SEVERITY,
  SEV_TIERS,
  SHIFTS,
  THMON,
} from "@/lib/constants";
import {
  drpLabel,
  drugArr,
  drugText,
  emptyFilter,
  emptyForm,
  fmtThaiDateTime,
  natureText,
  natureToArray,
  drugFlatLine,
  drugSearchText,
  nowTime,
  outcomeLabel,
  shiftOf,
  today,
  uuid,
  isUuid,
} from "@/lib/helpers";
import { seed } from "@/lib/seed";
import {
  envConfig,
  fetchDrugs,
  fetchIncidents,
  fetchDeletedIncidents,
  pushIncident,
  pushUpdate,
  softDeleteIncident,
  restoreIncident,
  hardDeleteIncident,
  isConfigured,
  subscribeIncidents,
  subscribeDrugs,
  insertDrug,
  updateDrug,
  fetchDrugAudit,
} from "@/lib/data";
import { css } from "@/lib/style";
import { HButton, HDiv, HFileLabel, HInput, HSelect, HTextarea, HTr } from "@/components/ui";
import { DashRange, Drug, DrugAudit, FormState, Incident, RecordFilter, SupabaseCfg, ViewName } from "@/lib/types";

const ORG_NAME = "ห้องยา รพ.ปรางค์กู่";
const DEFAULT_REPORTER = "";
const START_VIEW: ViewName = "form";

const REC_KEY = "meddrp_records_v6"; // v6: ล้าง demo ที่ค้างในเครื่อง (เอา seed ออกจากโค้ดแล้ว · ข้อมูลจริงดึงจาก Supabase)
const CFG_KEY = "meddrp_cfg";
const DRAFT_KEY = "meddrp_draft";
// คิวรายงานที่ยังส่งขึ้นระบบส่วนกลางไม่สำเร็จ (เก็บไว้ในเครื่องเพื่อลองส่งใหม่อัตโนมัติ · กันข้อมูลหาย)
const PENDING_KEY = "meddrp_pending_v1";

// อ่าน/เขียนลิสต์ Incident ใน localStorage อย่างปลอดภัย (คืน [] ถ้าอ่านไม่ได้)
function readList(key: string): Incident[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(v) ? (v as Incident[]) : [];
  } catch {
    return [];
  }
}
function writeList(key: string, list: Incident[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {}
}

// เคสที่ยังไม่ขึ้น server (แหล่งความจริง = คิว pending) + local ที่ id ยังไม่ใช่ uuid (เคสเก่า) · dedup ด้วย id · ตัดเคสที่อยู่บน server แล้ว
function dedupUnsynced(pending: Incident[], local: Incident[], serverIds: Set<string>): Incident[] {
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
function formatAn(raw: string, occurredAt?: string): string {
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
function matchSearch(r: Incident, q: string): boolean {
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
    drpLabel(r.drp_type),
    r.drp_type_other,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function validateIncident(f: Partial<FormState>, type: "med" | "drp"): Record<string, boolean> {
  const errs: Record<string, boolean> = {};
  if (!String(f.hn || "").trim()) errs.hn = true;
  if (!f.occurred_at) errs.occurred_at = true;
  if (!f.location) errs.location = true;
  if (f.location === IPD_LOCATION && !/\d/.test(String(f.an || ""))) errs.an = true; // IPD → ต้องมี AN (มีตัวเลขจริง ไม่ใช่ "-" เปล่า)
  if (!f.reporter) errs.reporter = true;
  if (!f.severity) errs.severity = true; // ระดับความรุนแรง A–I — บังคับทั้ง ME และ DRP
  if (type === "med") {
    if (!(Array.isArray(f.error_type) ? f.error_type.length : f.error_type)) errs.error_type = true;
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

interface AppState {
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
  drugs: Drug[]; // คลังยา (autocomplete · โหลดครั้งเดียวแล้ว cache)
  drugSug: { i: number; term: string } | null; // ช่องยาแถวที่เปิด suggest + คำค้น
  // ---- หน้า "คลังยา" (จัดการ master data · v0.9.10.0) ----
  drugSearch: string; // คำค้นในหน้าคลังยา
  drugFilter: string; // ตัวกรอง: "" = ทั้งหมด · "had" · form (tab/injection) · "pregDX"
  drugEdit: Partial<Drug> | null; // ยาที่กำลังเพิ่ม/แก้ในป๊อป (null = ปิด)
  drugEditNew: boolean; // true = เพิ่มใหม่ · false = แก้ของเดิม
  drugEditOrig: Partial<Drug> | null; // สแนปช็อตตอนเปิดป๊อป (ใช้เช็คว่าแก้ค้างไหมก่อนปิด)
  drugEditConfirmClose: boolean; // ป๊อปยืนยันปิดทั้งที่แก้ค้าง
  drugLog: { drug: Drug; entries: DrugAudit[] } | null; // ป๊อปประวัติการแก้ไขของยา
  drugLogLoading: boolean; // กำลังโหลดประวัติ
  drugBusy: boolean; // กำลังบันทึก (กันกดซ้ำ + โชว์สถานะ)
}

// ===== style generators (พอร์ตจาก renderVals) =====
const chip = (sel: boolean) =>
  sel
    ? "padding:9px 14px;border-radius:999px;border:1px solid " +
      AM +
      ";font-size:14px;font-weight:600;cursor:pointer;background:" +
      AM +
      ";color:" +
      AMT +
      ";box-shadow:0 4px 12px -3px rgba(245,166,35,.55);"
    : "padding:9px 14px;border-radius:999px;border:1px solid #CFE7E2;font-size:14px;font-weight:600;cursor:pointer;background:#EAF4F1;color:#0B655D;";
const seg = (sel: boolean) =>
  sel
    ? "flex:1;text-align:center;padding:11px;border-radius:10px;border:none;cursor:pointer;font-size:15px;font-weight:600;background:#fff;color:#0F8A80;box-shadow:0 1px 4px rgba(11,101,93,.18);"
    : "flex:1;text-align:center;padding:11px;border-radius:10px;border:none;cursor:pointer;font-size:15px;font-weight:500;background:transparent;color:#5B7C78;";
const nav = (sel: boolean) =>
  sel
    ? "border:none;cursor:pointer;font-size:14px;font-weight:600;padding:8px 15px;border-radius:9px;background:" +
      AM +
      ";color:" +
      AMT +
      ";"
    : "border:none;cursor:pointer;font-size:14px;font-weight:500;padding:8px 15px;border-radius:9px;background:rgba(255,255,255,.14);color:#DFF1EE;";
// ปุ่มเมนูมือถือ — เต็มความกว้าง (flex:1) แบ่งเท่ากัน
const navM = (sel: boolean) =>
  sel
    ? "flex:1;text-align:center;border:none;cursor:pointer;font-size:14px;font-weight:600;padding:9px 4px;border-radius:9px;background:" +
      AM +
      ";color:" +
      AMT +
      ";"
    : "flex:1;text-align:center;border:none;cursor:pointer;font-size:14px;font-weight:500;padding:9px 4px;border-radius:9px;background:rgba(255,255,255,.14);color:#DFF1EE;";
const filt = (sel: boolean) =>
  sel
    ? "border:none;cursor:pointer;font-size:13px;font-weight:600;padding:8px 14px;border-radius:9px;background:#0F8A80;color:#fff;"
    : "border:none;cursor:pointer;font-size:13px;font-weight:500;padding:8px 14px;border-radius:9px;background:transparent;color:#0B655D;";
// ปุ่มเลือกเวร (แทนช่องกรอกเวลา) — active = เทลทึบ
const shiftBtn = (active: boolean) =>
  active
    ? "flex:1;text-align:center;border:1.5px solid #0F8A80;background:#0F8A80;color:#fff;font-size:13.5px;font-weight:600;padding:10px 6px;border-radius:10px;cursor:pointer;white-space:nowrap;"
    : "flex:1;text-align:center;border:1.5px solid #DCE7E5;background:#fff;color:#475569;font-size:13.5px;font-weight:500;padding:10px 6px;border-radius:10px;cursor:pointer;white-space:nowrap;";
// เวลาตัวแทนของแต่ละเวร — กดเลือกเวร → เซ็ต occurred_time เป็นค่านี้ (shiftOf จะคืนค่าเวรนั้น) · เก็บตรรกะบันทึกเดิมไว้ทั้งหมด
const SHIFT_TIME: Record<string, string> = { เวรเช้า: "12:00", เวรบ่าย: "20:00", เวรดึก: "04:00" };

const INPUT_BASE =
  "width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:11px 13px;font-size:15px;color:#0F172A;background:#fff;outline:none;";
// ใช้ border เต็ม (ไม่ใช่ border-color) กัน React ผสม shorthand/longhand แล้วเส้นขอบหายตอน blur บน iOS
const INPUT_FOCUS = "border:1.5px solid #F5A623;box-shadow:0 0 0 3px rgba(245,166,35,.2)";
const badgeMed =
  "background:#E7F3F1;color:#0B655D;font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;white-space:nowrap;";
const badgeDrp =
  "background:#FEF3E2;color:#B45309;font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;white-space:nowrap;";
// สีธง Preg category ตามความเสี่ยง (A ปลอดภัยสุด → X ห้ามใช้ในหญิงตั้งครรภ์)
const pregColor = (p: string): string => {
  const m: Record<string, string> = {
    A: "background:#DCF3E3;color:#15803D;", // เขียวเข้ม
    B: "background:#E8F1DD;color:#4D7C0F;", // เขียว
    C: "background:#FEF3E2;color:#B45309;", // เหลือง/ส้ม
    D: "background:#FCE4D6;color:#C2410C;", // ส้มแดง
    X: "background:#FBE0DE;color:#B3261E;", // แดง
  };
  return m[p] || "background:#E9ECF3;color:#43526B;"; // ไม่ระบุ = เทา
};

export default function MedDrpApp() {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [clock, setClock] = useState("");
  const [state, setS] = useState<AppState>(() => ({
    view: START_VIEW,
    type: "med",
    form: emptyForm(DEFAULT_REPORTER),
    records: [],
    search: "",
    dashType: "all",
    dashYear: 0,
    cfg: { url: "", key: "" },
    toast: "",
    saving: false,
    pending: [],
    syncing: false,
    trash: [],
    askDelete: false,
    hardTarget: null,
    hardInput: "",
    trashBusy: false,
    result: null,
    resultRec: null,
    resending: false,
    rf: emptyFilter(),
    detail: null,
    editMode: false,
    editForm: {},
    showHistory: false,
    kpiAnim: [0, 0, 0, 0],
    showSevLegend: false,
    showNatureLegend: false,
    showDrpLegend: false,
    confirmDiscard: false,
    confirmSwitch: null,
    hadAuto: false,
    errors: {},
    dashRange: { preset: "all", from: "", to: "" },
    dd: null,
    ddUp: false,
    drugs: [],
    drugSug: null,
    drugSearch: "",
    drugFilter: "",
    drugEdit: null,
    drugEditNew: false,
    drugEditOrig: null,
    drugEditConfirmClose: false,
    drugLog: null,
    drugLogLoading: false,
    drugBusy: false,
  }));

  const stateRef = useRef(state);
  stateRef.current = state;
  const ivRef = useRef<Record<number, ReturnType<typeof setInterval> | null>>({});
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dtRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setState = useCallback((u: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    setS((prev) => {
      const patch = typeof u === "function" ? u(prev) : u;
      return { ...prev, ...patch };
    });
  }, []);

  // ---------- draft ----------
  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ type: stateRef.current.type, form: stateRef.current.form }));
    } catch {}
  }, []);
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, []);
  const draftSoon = useCallback(() => {
    if (dtRef.current) clearTimeout(dtRef.current);
    dtRef.current = setTimeout(saveDraft, 120);
  }, [saveDraft]);
  const hasDraftContent = (f: FormState | undefined) =>
    !!(
      f &&
      ((f.error_type && f.error_type.length) ||
        f.drp_type ||
        f.hn ||
        f.detail ||
        f.management ||
        f.cause ||
        f.severity || // #16: กรอกแค่ความรุนแรง/การแก้ไข/ผลตอบรับ/AN ก็ถือว่ามีร่าง (เดิมร่างหายถ้ายังไม่กรอกช่องหลัก)
        f.intervention ||
        f.outcome ||
        f.an ||
        (f.error_nature && f.error_nature.length) ||
        (f.drugs && f.drugs.some((x) => x && String(x).trim())))
    );

  // สลับประเภทฟอร์ม ME↔DRP · เคลียร์ค่าเดิม (เก็บแค่ HN/ผู้รายงาน) แล้วเริ่มฟอร์มประเภทใหม่
  const doSwitchType = (target: "med" | "drp") => {
    setState((st) => ({ type: target, form: emptyForm(DEFAULT_REPORTER, st.form), errors: {}, confirmSwitch: null, hadAuto: false }));
    draftSoon();
  };
  // #7: ถ้ากรอกฟอร์มค้างอยู่ กดสลับประเภท → เตือนก่อน (กันเผลอกดแล้วข้อมูลที่กรอกหาย) · ฟอร์มว่าง = สลับได้เลย
  const requestSwitchType = (target: "med" | "drp") => {
    if (stateRef.current.type === target) return;
    if (hasDraftContent(stateRef.current.form)) {
      setState({ confirmSwitch: target });
      return;
    }
    doSwitchType(target);
  };

  // ---------- toast ----------
  const flash = useCallback((msg: string) => {
    setState({ toast: msg });
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setState({ toast: "" }), 2200);
  }, [setState]);

  // ---------- dashboard range ----------
  const dashBounds = (s: AppState) => {
    const now = new Date();
    const dr = s.dashRange || { preset: "all", from: "", to: "" };
    const pad = (n: number) => String(n).padStart(2, "0");
    const isoD = (d: Date) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    let fromD = "",
      toD = "";
    if (dr.preset === "month") {
      fromD = isoD(new Date(now.getFullYear(), now.getMonth(), 1));
      toD = isoD(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    } else if (dr.preset === "quarter") {
      fromD = isoD(new Date(now.getFullYear(), now.getMonth() - 2, 1));
      toD = isoD(now);
    } else if (dr.preset === "year") {
      fromD = isoD(new Date(now.getFullYear(), 0, 1));
      toD = isoD(new Date(now.getFullYear(), 11, 31));
    } else if (dr.preset === "custom") {
      fromD = dr.from || "";
      toD = dr.to || "";
    }
    return { fromD, toD };
  };
  const dashRecs = (s: AppState) => {
    const all = s.records || [];
    const dt = s.dashType;
    let recs = dt === "all" ? all.slice() : all.filter((r) => r.type === dt);
    const b = dashBounds(s);
    if (b.fromD) recs = recs.filter((r) => (r.occurred_at || "") >= b.fromD);
    if (b.toD) recs = recs.filter((r) => (r.occurred_at || "") <= b.toD);
    return recs;
  };
  const computeKpiTargets = (s: AppState) => {
    const recs = dashRecs(s);
    const now = new Date();
    const curKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    return [
      recs.length,
      recs.filter((r) => (r.occurred_at || "").slice(0, 7) === curKey).length,
      recs.filter((r) => r.type === "med").length,
      recs.filter((r) => r.type === "drp").length,
    ];
  };
  const animateKpi = useCallback(
    (i: number, target: number) => {
      if (ivRef.current[i]) clearInterval(ivRef.current[i]!);
      const dur = 680;
      const start = Date.now();
      ivRef.current[i] = setInterval(() => {
        const p = Math.min(1, (Date.now() - start) / dur);
        const ease = 1 - Math.pow(1 - p, 3);
        setState((s) => {
          const a = (s.kpiAnim || [0, 0, 0, 0]).slice();
          a[i] = target * ease;
          return { kpiAnim: a };
        });
        if (p >= 1) {
          clearInterval(ivRef.current[i]!);
          ivRef.current[i] = null;
        }
      }, 24);
    },
    [setState]
  );
  const animateKpis = useCallback(() => {
    computeKpiTargets(stateRef.current).forEach((t, i) => animateKpi(i, t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateKpi]);

  // ---------- records I/O + คิวส่งขึ้นระบบ ----------
  const flushingRef = useRef(false);
  const savingRef = useRef(false); // #1 กันกดปุ่มบันทึกซ้ำระหว่างกำลังส่ง (stateRef อัปเดตหลัง render จึงต้องใช้ ref แยก)

  // อ่าน-แก้-เขียนคิว PENDING แบบ re-read ล่าสุดทุกครั้ง (กัน race: ไม่เขียนทับของที่เพิ่งเข้าคิวระหว่าง await)
  const mutatePending = useCallback(
    (fn: (list: Incident[]) => Incident[]) => {
      const next = fn(readList(PENDING_KEY));
      writeList(PENDING_KEY, next);
      setState({ pending: next });
      return next;
    },
    [setState]
  );

  // เพิ่มรายงานเข้าคิว "รอส่งขึ้นระบบ" (กันซ้ำด้วย id · re-read ล่าสุด)
  const enqueuePending = useCallback(
    (list: Incident[]) => {
      mutatePending((cur) => {
        const ids = new Set(cur.map((r) => r.id));
        const add = list.filter((r) => r && !ids.has(r.id));
        return add.length ? [...cur, ...add] : cur;
      });
    },
    [mutatePending]
  );

  // เอารายการออกจากคิว (re-read ล่าสุด · ไม่ทับทั้งชุด)
  const dequeuePending = useCallback((id: string) => mutatePending((list) => list.filter((r) => r.id !== id)), [mutatePending]);

  // ลองส่งคิวที่ค้างขึ้นระบบส่วนกลาง — เอาออก "ทีละตัวที่สำเร็จ" (re-read) ไม่เขียนทับทั้งชุด (กัน race)
  const flushPending = useCallback(async () => {
    if (flushingRef.current) return;
    const cfg = stateRef.current.cfg;
    if (!isConfigured(cfg)) return;
    const snapshot = readList(PENDING_KEY);
    if (!snapshot.length) return;
    flushingRef.current = true;
    setState({ syncing: true });
    let synced = 0;
    for (const p of snapshot) {
      let rec = p;
      let curId = p.id;
      // id เก่าที่ไม่ใช่ uuid (รายงานเก่าที่เคยส่งไม่ผ่าน) → ออกใหม่ + อัปเดตทั้ง records และ pending ก่อนส่ง
      if (!isUuid(curId)) {
        const nid = uuid();
        const oldId = curId;
        const recs = (stateRef.current.records || []).map((r) => (r.id === oldId ? { ...r, id: nid } : r));
        writeList(REC_KEY, recs);
        setState({ records: recs });
        mutatePending((list) => list.map((r) => (r.id === oldId ? { ...r, id: nid } : r)));
        rec = { ...rec, id: nid };
        curId = nid;
      }
      const ok = await pushIncident(cfg, rec);
      if (ok) {
        synced++;
        dequeuePending(curId);
      }
    }
    flushingRef.current = false;
    setState({ syncing: false });
    if (synced > 0) {
      flash(synced + " รายงานที่ค้างส่งขึ้นระบบเรียบร้อยแล้ว ✓");
      // #22: ถ้าหน้าผล "ส่งไม่สำเร็จ" ยังค้าง และเคสนั้นเพิ่งซิงก์สำเร็จ → สลับเป็นหน้าสำเร็จ
      const rr = stateRef.current.resultRec;
      if (stateRef.current.result === "fail" && rr && !readList(PENDING_KEY).some((r) => r.id === rr.id)) {
        setState({ result: "ok", resultRec: null });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setState, mutatePending, dequeuePending]);

  const loadRecords = useCallback(async () => {
    const cfg = stateRef.current.cfg;
    // 1) โชว์ข้อมูลในเครื่องทันที (ไม่บล็อกด้วย network)
    const local = readList(REC_KEY);
    if (local.length) setState({ records: local });
    // 2) ถ้าตั้งค่า Supabase แล้ว → ดึงข้อมูลจริง แล้ว "รวม" กับของในเครื่อง (ไม่ทับทิ้ง)
    if (isConfigured(cfg)) {
      try {
        const d = await fetchIncidents(cfg);
        const serverIds = new Set(d.map((r) => r.id));
        // เคสที่ยังไม่ขึ้น server = อยู่ในคิว pending (แหล่งความจริง) หรือเป็น local ที่ id ยังไม่ใช่ uuid (เคสเก่า)
        // — เคสที่ลบไปถังขยะ (มีบน server แต่ deleted_at ไม่ null) ไม่เข้าเงื่อนไขนี้ ไม่ถูกดึงกลับ
        const unsynced = dedupUnsynced(readList(PENDING_KEY), local, serverIds);
        const merged = unsynced.length ? [...unsynced, ...d] : d;
        setState({ records: merged });
        writeList(REC_KEY, merged);
        if (unsynced.length) {
          enqueuePending(unsynced);
          flushPending();
        }
      } catch {}
    }
  }, [setState, enqueuePending, flushPending]);

  // โหลดรายงานในถังขยะ (ลบแบบซ่อน) — ใช้ในหน้าตั้งค่า
  const loadTrash = useCallback(async () => {
    const cfg = stateRef.current.cfg;
    if (!isConfigured(cfg)) return;
    try {
      const d = await fetchDeletedIncidents(cfg);
      setState({ trash: d });
    } catch {}
  }, [setState]);

  // ดึงคลังยาใหม่ทั้งชุด → อัปเดต state + cache ในเครื่อง (เฉพาะตอนข้อมูลต่างจริง กัน re-render เปล่า)
  // ใช้ตอน mount + ตอน realtime แจ้งว่ามีคนแก้คลังยา + ตอนสลับกลับมาที่แอป/เน็ตกลับมา
  const refreshDrugs = useCallback(async () => {
    const cfg = stateRef.current.cfg;
    if (!isConfigured(cfg)) return;
    try {
      const list = await fetchDrugs(cfg);
      if (!list.length) return; // ดึงพลาด/ว่าง → คงคลังยาเดิมไว้ (ไม่ล้างทิ้ง)
      if (JSON.stringify(list) === JSON.stringify(stateRef.current.drugs || [])) return;
      setState({ drugs: list });
      try {
        localStorage.setItem("meddrp_drugs", JSON.stringify({ list, ts: Date.now() }));
      } catch {}
    } catch {}
  }, [setState]);

  // ---------- หน้า "คลังยา" (จัดการ master data) ----------
  const openAddDrug = () => {
    const blank = { had: false, renal: false };
    setState({ drugEdit: { ...blank }, drugEditOrig: { ...blank }, drugEditNew: true, drugEditConfirmClose: false });
  };
  const openEditDrug = (d: Drug) => setState({ drugEdit: { ...d }, drugEditOrig: { ...d }, drugEditNew: false, drugEditConfirmClose: false });
  const setDrugField = (k: keyof Drug, v: unknown) => setState((s) => ({ drugEdit: { ...(s.drugEdit || {}), [k]: v } }));
  // แก้ค้างไหม (เทียบกับตอนเปิด)
  const drugEditDirty = () => JSON.stringify(stateRef.current.drugEdit || {}) !== JSON.stringify(stateRef.current.drugEditOrig || {});
  // ขอปิดป๊อป — ถ้าแก้ค้างต้องยืนยันก่อน (กันเผลอปิดแล้วที่แก้หาย) · กดที่ว่างนอกป๊อปไม่ปิดอยู่แล้ว
  const requestCloseDrugEdit = () => {
    if (drugEditDirty()) setState({ drugEditConfirmClose: true });
    else setState({ drugEdit: null, drugEditOrig: null });
  };
  const forceCloseDrugEdit = () => setState({ drugEdit: null, drugEditOrig: null, drugEditConfirmClose: false });
  // เปิดประวัติการแก้ไขของยา
  const openDrugLog = async (d: Drug) => {
    setState({ drugLog: { drug: d, entries: [] }, drugLogLoading: true });
    const cfg = stateRef.current.cfg;
    if (!isConfigured(cfg)) {
      setState({ drugLogLoading: false });
      return;
    }
    try {
      const entries = await fetchDrugAudit(cfg, d.id);
      // กันกรณีผู้ใช้ปิดไปแล้ว/เปิดยาอื่นก่อนโหลดเสร็จ
      if (stateRef.current.drugLog && stateRef.current.drugLog.drug.id === d.id) setState({ drugLog: { drug: d, entries }, drugLogLoading: false });
    } catch {
      setState({ drugLogLoading: false });
    }
  };
  const saveDrug = async () => {
    const d = stateRef.current.drugEdit;
    const isNew = stateRef.current.drugEditNew;
    if (!d || stateRef.current.drugBusy) return;
    if (!String(d.generic || "").trim()) {
      flash("กรุณากรอกชื่อยา (generic)");
      return;
    }
    const cfg = stateRef.current.cfg;
    if (!isConfigured(cfg)) {
      flash("ยังไม่ได้เชื่อมต่อ Supabase");
      return;
    }
    setState({ drugBusy: true });
    try {
      if (isNew) await insertDrug(cfg, d);
      else await updateDrug(cfg, d as Drug);
    } catch {
      setState({ drugBusy: false });
      flash("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
      return;
    }
    await refreshDrugs();
    setState({ drugBusy: false, drugEdit: null, drugEditOrig: null, drugEditConfirmClose: false });
    flash(isNew ? "เพิ่มยาแล้ว ✓" : "บันทึกยาแล้ว ✓");
  };
  // ตัวกรอง + ค้นหา (ใช้ทั้ง render และปุ่มส่งออก)
  const drugMatchesFilter = (d: Drug, filter: string): boolean => {
    if (!filter) return true;
    if (filter === "had") return !!d.had;
    if (filter === "pregDX") return d.preg === "D" || d.preg === "X";
    if (filter.startsWith("form:")) return (d.form || "") === filter.slice(5);
    return true;
  };
  const getFilteredDrugs = (s: AppState): Drug[] => {
    const q = (s.drugSearch || "").trim().toLowerCase();
    return (s.drugs || []).filter((d) => drugMatchesFilter(d, s.drugFilter)).filter((d) => !q || drugSearchText(d).includes(q));
  };
  const exportDrugsCsv = () => {
    const list = getFilteredDrugs(stateRef.current);
    const cols = ["id", "generic", "strength", "unit", "percent", "form", "route", "release", "brand", "had", "preg", "renal"];
    const esc = (v: unknown) => {
      let s = String(v == null ? "" : v);
      if (/^[=+\-@]/.test(s)) s = "'" + s; // กัน formula injection ใน Excel/Sheets
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const rows = list.map((d) => cols.map((c) => esc((d as unknown as Record<string, unknown>)[c])).join(","));
    const csv = cols.join(",") + "\n" + rows.join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "drugs_export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ---------- mount ----------
  useEffect(() => {
    let cfg = envConfig();
    try {
      const stored = JSON.parse(localStorage.getItem(CFG_KEY) || "null");
      if (stored && stored.url && stored.key) cfg = stored;
    } catch {}
    const sv: ViewName = START_VIEW === "form" ? "form" : "form";
    let draft: { form?: FormState; type?: "med" | "drp" } | null = null;
    try {
      draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    } catch {}
    let form: FormState, type: "med" | "drp" = "med", restored = false;
    if (draft && draft.form && hasDraftContent(draft.form)) {
      form = draft.form;
      type = draft.type || "med";
      restored = true;
    } else {
      form = emptyForm(DEFAULT_REPORTER);
    }
    setState({ cfg, view: sv, type, form, pending: readList(PENDING_KEY) });
    setMounted(true);
    // load records after cfg is set (loadRecords จะ merge server + เข้าคิวรายงานที่ยังไม่ขึ้นระบบ)
    setTimeout(() => {
      loadRecords();
      flushPending(); // ส่งคิวที่ค้างจาก session ก่อนหน้าขึ้นระบบ
      loadTrash(); // โหลดถังขยะไว้ล่วงหน้า
    }, 0);
    // โหลดคลังยา (autocomplete) — เอา cache ในเครื่องขึ้นก่อน แล้วค่อย fetch มาทับ (โหลดครั้งเดียว)
    try {
      const dc = JSON.parse(localStorage.getItem("meddrp_drugs") || "null");
      if (dc && Array.isArray(dc.list) && dc.list.length) setState({ drugs: dc.list });
    } catch {}
    if (isConfigured(cfg)) {
      fetchDrugs(cfg)
        .then((list) => {
          if (list.length) setState({ drugs: list });
          try {
            localStorage.setItem("meddrp_drugs", JSON.stringify({ list, ts: Date.now() }));
          } catch {}
        })
        .catch(() => {});
    }
    if (restored) setTimeout(() => flash("กู้คืนร่างที่ค้างไว้ ✓"), 400);
    return () => {
      Object.values(ivRef.current).forEach((iv) => iv && clearInterval(iv));
      if (tRef.current) clearTimeout(tRef.current);
      if (dtRef.current) clearTimeout(dtRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Realtime: ข้อมูลสดข้ามเครื่อง ----------
  // ดึงข้อมูลใหม่ทั้งชุดแบบเงียบ (ไม่ล้างหน้าจอระหว่างรอ) แล้วทับ state + cache ในเครื่อง
  // แจ้งเตือนเฉพาะตอนข้อมูลเปลี่ยนจริง — เครื่องที่เป็นคนบันทึกเองจะไม่เด้งซ้ำ (state ตรงกับ server อยู่แล้ว)
  const refreshRecords = useCallback(async () => {
    const cfg = stateRef.current.cfg;
    if (!isConfigured(cfg)) return;
    try {
      const d = await fetchIncidents(cfg);
      const cur = stateRef.current.records || [];
      const serverIds = new Set(d.map((r) => r.id));
      // เคสที่ยังไม่ขึ้น server (คิว pending = แหล่งความจริง) + local ที่ id ยังไม่ใช่ uuid → คงไว้บนสุด
      // เคสที่ลบไปถังขยะจะหลุดจาก server active และไม่อยู่ในคิว → หายจากหน้าจอตามจริง
      const unsynced = dedupUnsynced(readList(PENDING_KEY), cur, serverIds);
      const merged = unsynced.length ? [...unsynced, ...d] : d;
      const same = JSON.stringify(merged) === JSON.stringify(cur);
      if (same) return;
      setState({ records: merged });
      // ถ้ากำลังเปิดหน้ารายละเอียดของเคสที่เพิ่งถูกแก้จากอีกเครื่อง → อัปเดตหน้าที่เปิดอยู่ด้วย
      // #23: แต่ถ้ากำลังแก้ไขค้างอยู่ ห้ามทับ detail (กันประวัติเวอร์ชันปนกับเวอร์ชันของเครื่องอื่น)
      const open = stateRef.current.detail;
      if (open && !stateRef.current.editMode) {
        const fresh = d.find((r) => r.id === open.id);
        if (fresh) setState({ detail: fresh });
      }
      writeList(REC_KEY, merged);
      flash("อัปเดตข้อมูลล่าสุดจากเครื่องอื่นแล้ว ✓");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setState]);

  useEffect(() => {
    if (!mounted) return;
    const cfg = state.cfg;
    if (!isConfigured(cfg)) return;

    // รวบ event ที่มาถี่ ๆ (บันทึกรวดเดียวหลายเคส) ให้ดึงข้อมูลรอบเดียว
    let deb: ReturnType<typeof setTimeout> | null = null;
    // #19: ถ้าเปิดหน้าตั้งค่า (ถังขยะ) อยู่ ให้ดึงถังขยะสดด้วย (เครื่องอื่นลบ/กู้คืนแล้วเห็นทันที)
    const refreshTrashIfOpen = () => {
      if (stateRef.current.view === "manage") loadTrash();
    };
    const schedule = () => {
      if (deb) clearTimeout(deb);
      deb = setTimeout(() => {
        refreshRecords();
        refreshTrashIfOpen();
      }, 400);
    };

    const unsub = subscribeIncidents(cfg, schedule);

    // กันสัญญาณหลุด (โน้ตบุ๊กพับจอ / เน็ตวืบ) — กลับมาที่แท็บ/เน็ตกลับมา = ดึงข้อมูลใหม่ + ลองส่งคิวที่ค้าง
    const onVis = () => {
      if (document.visibilityState === "visible") {
        refreshRecords();
        refreshTrashIfOpen();
        flushPending();
      }
    };
    const onOnline = () => {
      refreshRecords();
      refreshTrashIfOpen();
      flushPending();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);

    return () => {
      if (deb) clearTimeout(deb);
      unsub();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, state.cfg.url, state.cfg.key, refreshRecords, flushPending, loadTrash]);

  // ---------- Realtime คลังยา: มีคนเพิ่ม/แก้ยาในระบบ → ทุกเครื่องเห็นเองไม่ต้องรีเฟรช ----------
  useEffect(() => {
    if (!mounted) return;
    const cfg = state.cfg;
    if (!isConfigured(cfg)) return;
    let deb: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (deb) clearTimeout(deb);
      deb = setTimeout(() => refreshDrugs(), 500);
    };
    const unsub = subscribeDrugs(cfg, schedule);
    // กันสัญญาณหลุด — กลับมาที่แท็บ / เน็ตกลับมา = ดึงคลังยาใหม่ด้วย
    const onVis = () => {
      if (document.visibilityState === "visible") refreshDrugs();
    };
    const onOnline = () => refreshDrugs();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    return () => {
      if (deb) clearTimeout(deb);
      unsub();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, state.cfg.url, state.cfg.key, refreshDrugs]);

  // re-animate KPIs เมื่อเข้า dashboard / เปลี่ยนตัวกรอง/ช่วงเวลา/ข้อมูล
  useEffect(() => {
    if (mounted && state.view === "dashboard") animateKpis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.view, state.dashType, state.dashRange, state.records, mounted]);

  // ตรวจจับจอมือถือ (กว้าง ≤ 640px) — ใช้สลับ layout เฉพาะมือถือ · เดสก์ท็อปไม่แตะ
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const upd = () => setIsMobile(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  // นาฬิกาเดินจริง (โชว์เวลาปัจจุบัน วิ่งทุกวินาที) — เดินเฉพาะตอนอยู่หน้ากรอก
  useEffect(() => {
    if (state.view !== "form") return;
    const two = (n: number) => String(n).padStart(2, "0");
    const tick = () => {
      const d = new Date();
      setClock(two(d.getHours()) + ":" + two(d.getMinutes()) + ":" + two(d.getSeconds()));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.view]);

  // เปลี่ยนแท็บ/หน้า → เด้งขึ้นบนสุดเสมอ (กันค้างตำแหน่งที่เลื่อนไว้จากหน้าก่อน)
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [state.view]);

  // เข้าหน้าตั้งค่า → รีเฟรชถังขยะ (เผื่อมีเครื่องอื่นลบเพิ่ม)
  useEffect(() => {
    if (mounted && state.view === "manage") loadTrash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.view, mounted]);


  // ---------- form mutations ----------
  const setField = (k: keyof FormState, v: unknown) => {
    setState((s) => {
      const errors = { ...s.errors };
      delete errors[k as string];
      return { form: { ...s.form, [k]: v } as FormState, errors };
    });
    draftSoon();
  };
  // #12: เปลี่ยนจุดที่พบ — ถ้าไม่ใช่ IPD ให้ล้าง AN ทิ้ง (กันค่า AN ค้างติดเคสที่ไม่ใช่ IPD)
  const setLocation = (v: string) => {
    setState((s) => {
      const errors = { ...s.errors };
      delete errors.location;
      const form = { ...s.form, location: v } as FormState;
      if (v !== IPD_LOCATION) {
        form.an = "";
        delete errors.an;
      }
      return { form, errors };
    });
    draftSoon();
  };
  // ยา HAD จาก drugFlatLine จะมี "(HAD)" ต่อท้าย → ใช้ตรวจว่ายังมียา HAD เหลือในรายการไหม
  const hasHadDrug = (drugs?: string[]) => (drugs || []).some((x) => /\(HAD\)/.test(String(x)));
  // #13: ถ้าธง High-alert ถูกติดอัตโนมัติจากยา HAD แล้วยา HAD ถูกลบ/แก้ออกจนไม่เหลือ → ปลดธงให้ (แต่ถ้าผู้ใช้ติ๊กเอง hadAuto=false จะไม่แตะ)
  const clearAutoHad = (s: AppState, form: FormState) => {
    if (s.hadAuto && !hasHadDrug(form.drugs)) {
      form.high_alert = false;
      return false;
    }
    return s.hadAuto;
  };
  const setDrugAt = (i: number, v: string) => {
    setState((s) => {
      const d = (s.form.drugs || [""]).slice();
      d[i] = v;
      const form = { ...s.form, drugs: d } as FormState;
      return { form, hadAuto: clearAutoHad(s, form) };
    });
    draftSoon();
  };
  const addDrug = () => {
    setState((s) => ({ form: { ...s.form, drugs: [...(s.form.drugs || [""]), ""] } }));
    draftSoon();
  };
  // เลือกยาจากรายการ suggest → ใส่เป็นข้อความบรรทัดเดียว + ปิด suggest
  const pickDrug = (i: number, d: Drug) => {
    setState((s) => {
      const arr = (s.form.drugs || [""]).slice();
      arr[i] = drugFlatLine(d);
      const form = { ...s.form, drugs: arr } as FormState;
      let hadAuto = s.hadAuto;
      // ยา HAD (High Alert Drug) จากคลังยา → ติดธง High-alert ให้อัตโนมัติ (ผู้ใช้ปลดเองได้ถ้าไม่ต้องการ)
      if (d.had) {
        form.high_alert = true;
        hadAuto = true;
      } else {
        hadAuto = clearAutoHad(s, form); // เปลี่ยนเป็นยาไม่ HAD → ถ้าธงมาจาก auto และไม่เหลือ HAD ให้ปลด
      }
      return { form, hadAuto, drugSug: null };
    });
    draftSoon();
  };
  const removeDrug = (i: number) => {
    setState((s) => {
      const d = (s.form.drugs || [""]).slice();
      d.splice(i, 1);
      if (!d.length) d.push("");
      const form = { ...s.form, drugs: d } as FormState;
      return { form, hadAuto: clearAutoHad(s, form) };
    });
    draftSoon();
  };
  // ติ๊กธง High-alert เอง → ถือเป็นการเลือกด้วยตัวเอง (ปลด hadAuto เพื่อไม่ให้ระบบมาปลดธงให้ทีหลัง)
  const toggleHighAlert = () => {
    setState((s) => ({ form: { ...s.form, high_alert: !s.form.high_alert }, hadAuto: false }));
    draftSoon();
  };
  const toggleNature = (k: string) => {
    setState((s) => {
      const cur = Array.isArray(s.form.error_nature) ? s.form.error_nature.slice() : [];
      const i = cur.indexOf(k);
      if (i >= 0) cur.splice(i, 1);
      else cur.push(k);
      const form = { ...s.form, error_nature: cur } as FormState;
      // #14: เลิกเลือก "อื่น ๆ" → ล้างข้อความระบุทิ้ง (กันข้อความค้างติดเคสทั้งที่ไม่ได้เลือกอื่น ๆ แล้ว)
      if (!cur.includes("อื่น ๆ")) form.error_nature_other = "";
      const errors = { ...s.errors };
      delete errors.error_nature;
      delete errors.error_nature_other;
      return { form, errors };
    });
    draftSoon();
  };
  const toggleErrType = (k: string) => {
    setState((s) => {
      const cur = Array.isArray(s.form.error_type) ? s.form.error_type.slice() : s.form.error_type ? [s.form.error_type] : [];
      const i = cur.indexOf(k);
      if (i >= 0) cur.splice(i, 1);
      else cur.push(k);
      return { form: { ...s.form, error_type: cur } };
    });
    draftSoon();
  };
  const onAttachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target && e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const max = 1000;
        let w = img.width,
          h = img.height;
        if (w > max || h > max) {
          const r = Math.min(max / w, max / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d")!.drawImage(img, 0, 0, w, h);
        setField("attachment", c.toDataURL("image/jpeg", 0.7));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // ---------- เสียง + สั่นเตือน (ตอนส่งไม่สำเร็จ) ----------
  // iOS ต้องปลดล็อกเสียง "ในจังหวะกดปุ่ม" (user gesture) → เรียก unlockAudio() ตอนต้น save/resend
  const audioCtxRef = useRef<AudioContext | null>(null);
  const unlockAudio = () => {
    try {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctor = w.AudioContext || w.webkitAudioContext;
      if (!Ctor) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctor();
      if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume().catch(() => {});
    } catch {}
  };
  const alertFail = () => {
    // สั่น — ได้เฉพาะ Android (iOS/Safari ไม่รองรับ navigator.vibrate)
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate([220, 90, 220]);
    } catch {}
    // เสียงบี๊บ 2 จังหวะ (สังเคราะห์เอง ไม่ต้องมีไฟล์เสียง)
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const now = ctx.currentTime;
      [0, 0.28].forEach((t) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 640;
        g.gain.setValueAtTime(0.0001, now + t);
        g.gain.exponentialRampToValueAtTime(0.22, now + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.2);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + 0.22);
      });
    } catch {}
  };

  // ---------- save new ----------
  const save = async () => {
    if (savingRef.current) return; // #1 กันกดปุ่มบันทึกซ้ำระหว่างกำลังส่ง (กันได้เคสซ้ำ)
    savingRef.current = true;
    unlockAudio(); // ปลดล็อกเสียงในจังหวะกดปุ่ม (เผื่อผลออกมาไม่สำเร็จ จะได้มีเสียงเตือน)
    const f = stateRef.current.form,
      type = stateRef.current.type;
    const errs = validateIncident(f, type);
    if (Object.keys(errs).length) {
      setState({ errors: errs });
      flash("กรุณากรอกช่องที่จำเป็น (ไฮไลต์สีแดง)");
      savingRef.current = false;
      return;
    }
    setState({ saving: true, errors: {} });
    const drugsArr = (f.drugs || []).map((x) => String(x).trim()).filter(Boolean);
    const rec: Incident = {
      ...f,
      type,
      shift: shiftOf(f.occurred_time),
      drugs: drugsArr,
      drug: drugsArr.join(", "),
      // #15: AN เก็บในรูปแบบมาตรฐาน "YY-NNNNN" เสมอ (เผื่อกดบันทึกโดยยังไม่ blur ช่อง AN) · ไม่ใช่ IPD = ไม่เก็บ AN
      an: f.location === IPD_LOCATION ? formatAn(f.an, f.occurred_at) : "",
      id: uuid(), // UUID ที่ถูกต้องเสมอทุกเบราว์เซอร์ (แก้บั๊ก Safari กรอกแล้วไม่ขึ้นระบบ)
      created_at: new Date().toISOString(),
    };
    // #6: เก็บลงเครื่อง + เพิ่มเข้า state + เข้าคิว "ก่อน" await เสมอ
    //     (ถ้าปิดแท็บ/มี reconcile ระหว่างรอส่ง เคสจะยังอยู่ในคิว = แหล่งความจริง ไม่หาย)
    const recs = [rec, ...stateRef.current.records];
    writeList(REC_KEY, recs);
    setState({ records: recs });
    clearDraft();
    enqueuePending([rec]);
    // ส่งขึ้นระบบส่วนกลาง แล้ว "ยืนยันผลจริง" · สำเร็จค่อยเอาออกจากคิว
    const cfg = stateRef.current.cfg;
    let sent = true;
    if (isConfigured(cfg)) sent = await pushIncident(cfg, rec);
    if (sent) dequeuePending(rec.id);
    setState({ saving: false, form: emptyForm(DEFAULT_REPORTER, { hn: "", reporter: f.reporter }), hadAuto: false });
    savingRef.current = false;
    if (sent) {
      setState({ result: "ok", resultRec: null }); // หน้าผล "ส่งสำเร็จ" เต็มจอ
    } else {
      // ยังอยู่ในคิว (auto-flush ทำงานต่อ) + หน้าผล "ส่งไม่สำเร็จ" (ตัวโต ไม่หายเอง) + สั่น/เสียงเตือน
      setState({ result: "fail", resultRec: rec });
      alertFail();
    }
  };

  // กด "ส่งอีกครั้ง" จากหน้าผลที่ส่งไม่สำเร็จ — ส่งเคสเดิมซ้ำ (id เดิม = idempotent)
  const resendResult = async () => {
    const rec = stateRef.current.resultRec;
    if (!rec || stateRef.current.resending) return;
    unlockAudio();
    setState({ resending: true });
    const cfg = stateRef.current.cfg;
    const ok = isConfigured(cfg) ? await pushIncident(cfg, rec) : true;
    if (ok) {
      dequeuePending(rec.id);
      setState({ result: "ok", resultRec: null, resending: false });
      refreshRecords();
    } else {
      setState({ resending: false });
      alertFail(); // ยังไม่ไป → เตือนอีกรอบ
    }
  };

  // ---------- ลบรายงาน (2 ชั้น) ----------
  // ชั้น 1: ลบแบบซ่อน (ย้ายไปถังขยะ) — จากหน้ารายละเอียด · ยังกู้คืนได้
  const doSoftDelete = async () => {
    const rec = stateRef.current.detail;
    if (!rec) return;
    const cfg = stateRef.current.cfg;
    if (isConfigured(cfg)) {
      try {
        await softDeleteIncident(cfg, rec.id);
      } catch {
        flash("ลบไม่สำเร็จ ลองใหม่อีกครั้ง");
        return;
      }
    }
    const recs = (stateRef.current.records || []).filter((r) => r.id !== rec.id);
    writeList(REC_KEY, recs);
    dequeuePending(rec.id); // #3: เอาออกจากคิวด้วย ไม่งั้น flushPending จะส่งกลับขึ้นระบบเป็นเคสใช้งาน (เด้งกลับ)
    setState({ records: recs, detail: null, editMode: false, askDelete: false, showHistory: false });
    flash("ย้ายไปถังขยะแล้ว ✓");
    loadTrash();
  };

  // กู้คืนจากถังขยะ — กลับมาแสดงในรายการปกติ
  const doRestore = async (id: string) => {
    if (stateRef.current.trashBusy) return;
    const cfg = stateRef.current.cfg;
    setState({ trashBusy: true });
    if (isConfigured(cfg)) {
      try {
        // #19: ถ้าเครื่องอื่นลบถาวรไปแล้ว restoreIncident จะคืน false (ไม่มีแถวให้กู้) → บอกตามจริง ไม่ขึ้น "กู้คืนแล้ว" หลอก
        const ok = await restoreIncident(cfg, id);
        if (!ok) {
          setState({ trash: (stateRef.current.trash || []).filter((r) => r.id !== id), trashBusy: false });
          flash("รายงานนี้ถูกลบถาวรไปแล้ว (กู้คืนไม่ได้)");
          return;
        }
      } catch {
        flash("กู้คืนไม่สำเร็จ ลองใหม่อีกครั้ง");
        setState({ trashBusy: false });
        return;
      }
    }
    setState({ trash: (stateRef.current.trash || []).filter((r) => r.id !== id), trashBusy: false });
    flash("กู้คืนรายงานแล้ว ✓");
    refreshRecords();
  };

  // ชั้น 2: ลบถาวร — จากถังขยะ · ต้องพิมพ์ HN ยืนยันแล้วเท่านั้น (guard ที่ปุ่มด้วย)
  const doHardDelete = async () => {
    const t = stateRef.current.hardTarget;
    if (!t || stateRef.current.trashBusy) return;
    const cfg = stateRef.current.cfg;
    setState({ trashBusy: true });
    if (isConfigured(cfg)) {
      try {
        await hardDeleteIncident(cfg, t.id);
      } catch {
        flash("ลบถาวรไม่สำเร็จ ลองใหม่อีกครั้ง");
        setState({ trashBusy: false });
        return;
      }
    }
    setState({
      trash: (stateRef.current.trash || []).filter((r) => r.id !== t.id),
      hardTarget: null,
      hardInput: "",
      trashBusy: false,
    });
    flash("ลบถาวรแล้ว");
  };

  // ---------- settings ----------
  const saveCfg = () => {
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify(stateRef.current.cfg));
    } catch {}
    flash("บันทึกการตั้งค่าแล้ว ✓");
    loadRecords();
  };

  // ---------- edit ----------
  const startEdit = () => setState((s) => ({ editMode: true, showHistory: false, editForm: { ...s.detail } }));
  const cancelEdit = () => setState({ editMode: false });
  const setEf = (k: string, v: unknown) => setState((s) => ({ editForm: { ...s.editForm, [k]: v } }));
  // #12: โหมดแก้ไข — เปลี่ยนจุดที่พบเป็นไม่ใช่ IPD ให้ล้าง AN ทิ้งด้วย
  const setEfLocation = (v: string) =>
    setState((s) => ({ editForm: { ...s.editForm, location: v, ...(v !== IPD_LOCATION ? { an: "" } : {}) } }));
  // #14: เลือกประเภท DRP — กดซ้ำ= ยกเลิก · เปลี่ยนออกจาก "อื่น ๆ" ให้ล้างข้อความระบุทิ้ง
  const setDrpType = (k: string) => {
    setState((s) => {
      const next = s.form.drp_type === k ? "" : k;
      const form = { ...s.form, drp_type: next } as FormState;
      if (next !== "อื่น ๆ") form.drp_type_other = "";
      const errors = { ...s.errors };
      delete errors.drp_type;
      delete errors.drp_type_other;
      return { form, errors };
    });
    draftSoon();
  };
  // #2: หน้าแก้ไข error_type / error_nature เป็น "เลือกได้หลายอัน" (เดิมเป็น select อันเดียว → array หด เหลือค่าเดียว ข้อมูลหาย)
  const efArr = (field: "error_type" | "error_nature"): string[] => {
    const v = (stateRef.current.editForm || {})[field];
    return Array.isArray(v) ? (v as string[]) : v ? [String(v)] : [];
  };
  const efToggleArr = (field: "error_type" | "error_nature", val: string) =>
    setState((s) => {
      const raw = s.editForm[field];
      const cur = Array.isArray(raw) ? (raw as string[]) : raw ? [String(raw)] : [];
      const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
      return { editForm: { ...s.editForm, [field]: next } };
    });
  const saveEdit = async () => {
    if (savingRef.current) return; // กันกดบันทึกซ้ำ
    const ef = stateRef.current.editForm,
      det = stateRef.current.detail!;
    // #5: ตรวจช่องบังคับก่อนบันทึก (เหมือนหน้ากรอกใหม่) — กันลบข้อมูลจำเป็นทิ้งแล้วบันทึก
    const errs = validateIncident(ef as unknown as Partial<FormState>, det.type);
    if (Object.keys(errs).length) {
      flash("กรุณากรอกช่องที่จำเป็นให้ครบก่อนบันทึก");
      return;
    }
    savingRef.current = true;
    const snap: Incident = { ...det };
    delete snap.history;
    snap.saved_at = new Date().toISOString();
    const dArr = String(ef.drug || "")
      .split(/\s*,\s*/)
      .map((x) => x.trim())
      .filter(Boolean);
    const updated: Incident = {
      ...(ef as Incident),
      drugs: dArr,
      drug: dArr.join(", "),
      shift: shiftOf(ef.occurred_time) || ef.shift || det.shift, // #24: ไม่ล้างเวรถ้าเคสไม่มีเวลา (เคสเก่า)
      edited: true,
      edited_at: new Date().toISOString(),
      edit_count: (det.edit_count || 0) + 1,
      history: [...(det.history || []), snap],
    };
    const recs = (stateRef.current.records || []).map((r) => (r.id === updated.id ? updated : r));
    writeList(REC_KEY, recs);
    setState({ records: recs, detail: updated, saving: true });
    // #4: ยืนยันผลจริง + ลองซ้ำอัตโนมัติ (ไม่ขึ้น "บันทึกการแก้ไขแล้ว" หลอกอีกต่อไป)
    const cfg = stateRef.current.cfg;
    let ok = true;
    if (isConfigured(cfg)) ok = await pushUpdate(cfg, updated);
    setState({ saving: false, editMode: false });
    savingRef.current = false;
    if (ok) {
      flash("บันทึกการแก้ไขและส่งขึ้นระบบเรียบร้อย ✓");
    } else {
      flash("บันทึกในเครื่องแล้ว แต่ยังไม่ขึ้นระบบส่วนกลาง — เปิดแก้ไขแล้วบันทึกอีกครั้งเมื่อเน็ตกลับมา");
      alertFail();
    }
  };

  // ---------- CSV export ----------
  const exportCsv = (subset?: Incident[]) => {
    const data = subset && subset.length != null ? subset : stateRef.current.records;
    const cols = [
      "type",
      "occurred_at",
      "occurred_time",
      "shift",
      "hn",
      "location",
      "an",
      "error_type",
      "error_nature",
      "error_nature_other",
      "severity",
      "drp_type",
      "drp_type_other",
      "intervention",
      "outcome",
      "drug",
      "high_alert",
      "lasa",
      "detail",
      "management",
      "managed",
      "pharmacist_only",
      "cause",
      "reporter",
      "edited",
      "edited_at",
      "edit_count",
      "created_at",
    ];
    const esc = (v: unknown) => {
      let s = String(v == null ? "" : v);
      if (/^[=+\-@]/.test(s)) s = "'" + s; // #18: กัน formula injection ใน Excel/Sheets (ช่องขึ้นต้น = + - @)
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const rows = data.map((r) => cols.map((c) => esc((r as unknown as Record<string, unknown>)[c])).join(","));
    const csv = cols.join(",") + "\n" + rows.join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "med_drp_export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const setRF = (k: keyof RecordFilter, v: string) => setState((s) => ({ rf: { ...s.rf, [k]: v } }));
  const setDashPreset = (p: DashRange["preset"]) => setState((s) => ({ dashRange: { ...s.dashRange, preset: p } }));

  if (!mounted) return <div style={{ minHeight: "100vh" }} />;

  // =========================================================
  //  DERIVED VALUES (พอร์ตจาก renderVals)
  // =========================================================
  const S = state;
  const f = S.form;
  const type = S.type;
  const errTypeSel = ERROR_TYPES.filter((t) => natureToArray(f.error_type).includes(t.key));
  const sevObj = SEVERITY.find((s) => s.code === f.severity);
  const drpObj = DRP_TYPES.find((t) => t.key === f.drp_type);
  const orgName = ORG_NAME;

  const now = new Date();
  const curKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  const dr = S.dashRange;
  const recs = dashRecs(S);
  const total = recs.length;
  const thisMonth = recs.filter((r) => (r.occurred_at || "").slice(0, 7) === curKey).length;
  const medCount = recs.filter((r) => r.type === "med").length;
  const drpCount = recs.filter((r) => r.type === "drp").length;
  const severe = recs.filter((r) => r.type === "med" && ["E", "F", "G", "H", "I"].includes(r.severity || "")).length;
  // #8: "แพทย์รับข้อเสนอ %" หารด้วยเฉพาะ DRP ที่เสนอแพทย์จริง (เลือก "ปรึกษาแพทย์ผู้สั่งใช้" และไม่ได้ติ๊กเภสัชแก้เอง)
  //     เดิมหารด้วย DRP ทั้งหมด (รวมเคสที่ไม่ได้เสนอแพทย์) → % ต่ำกว่าจริงมาก
  const proposed = recs.filter((r) => r.type === "drp" && !r.pharmacist_only && r.intervention === CONSULT_DOCTOR);
  const accepted = proposed.filter((r) => r.outcome === "Accepted").length;
  const acceptRate = proposed.length ? Math.round((accepted / proposed.length) * 100) : 0;
  const anim = S.kpiAnim || [0, 0, 0, 0];
  const tg = [total, thisMonth, medCount, drpCount];
  const kpis = [
    {
      label: "เคสทั้งหมด",
      value: Math.round(anim[0]),
      sub: S.dashType === "all" ? "ทุกประเภท" : S.dashType === "med" ? "เฉพาะ Med Error" : "เฉพาะ DRP",
      idx: 0,
    },
    { label: "เดือนนี้", value: Math.round(anim[1]), sub: THMON[now.getMonth()] + " " + (now.getFullYear() + 543), idx: 1 },
    { label: "Med Error", value: Math.round(anim[2]), sub: "ระดับ E ขึ้นไป " + severe + " เคส", idx: 2 },
    { label: "DRP", value: Math.round(anim[3]), sub: "แพทย์รับข้อเสนอ " + acceptRate + "%", idx: 3 },
  ];

  // #10: กราฟรายเดือนใช้ข้อมูลกรองแค่ประเภท (med/drp) ไม่เอาช่วงวันของ dashRange มาบีบ (กราฟจะได้ไม่หดตามพรีเซ็ต)
  const monthScopeRecs = (S.records || []).filter((r) => S.dashType === "all" || r.type === S.dashType);
  // กราฟ 12 เดือน (ม.ค.–ธ.ค.) ของปีที่เลือก + ปุ่มเลือกปี (พ.ศ.) — รวมปีที่มีข้อมูล + ปีปัจจุบัน เรียงใหม่→เก่า
  const selYear = S.dashYear || now.getFullYear();
  const yearSet = new Set<number>([now.getFullYear()]);
  monthScopeRecs.forEach((r) => {
    const y = parseInt((r.occurred_at || "").slice(0, 4), 10);
    if (!isNaN(y)) yearSet.add(y);
  });
  const yearOpts = Array.from(yearSet).sort((a, b) => b - a);
  const months: { key: string; label: string }[] = [];
  for (let mo = 0; mo < 12; mo++) {
    months.push({ key: selYear + "-" + String(mo + 1).padStart(2, "0"), label: THMON[mo] });
  }
  const mc = months.map((m) => monthScopeRecs.filter((r) => (r.occurred_at || "").slice(0, 7) === m.key).length);
  const mmax = Math.max(1, ...mc);
  const monthBars = months.map((m, i) => ({
    label: m.label,
    count: mc[i],
    barStyle:
      "width:76%;border-radius:5px 5px 0 0;background:linear-gradient(#12A093,#0B655D);transition:height .6s cubic-bezier(.22,1,.36,1),filter .15s;cursor:pointer;height:" +
      Math.max(4, Math.round((mc[i] / mmax) * 118)) +
      "px;",
  }));

  // นับระดับความรุนแรง A–I รวมทั้ง Med Error และ DRP (DRP เลือกความรุนแรงได้แล้ว)
  // recs ผ่านตัวกรอง med/drp/ทั้งหมด มาแล้ว → เลือก "เฉพาะ DRP" ก็จะเห็นความรุนแรงของ DRP
  const bySev: Record<string, number> = {};
  recs.forEach((r) => {
    if (r.severity) bySev[r.severity] = (bySev[r.severity] || 0) + 1;
  });
  const smax = Math.max(1, ...Object.values(bySev), 1);
  const sevBars = SEVERITY.map((s) => ({
    code: s.code,
    count: bySev[s.code] || 0,
    barStyle:
      "width:100%;border-radius:5px 5px 0 0;background:" +
      AM +
      ";transition:height .6s cubic-bezier(.22,1,.36,1),filter .15s;cursor:pointer;height:" +
      Math.max(3, Math.round(((bySev[s.code] || 0) / smax) * 96)) +
      "px;",
  }));

  const byErr: Record<string, number> = {};
  recs.filter((r) => r.type === "med").forEach((r) => {
    natureToArray(r.error_type).forEach((k) => {
      byErr[k] = (byErr[k] || 0) + 1;
    });
  });
  const emax = Math.max(1, ...Object.values(byErr), 1);
  const errorBreak = ERROR_TYPES.map((t) => ({
    label: t.key,
    count: byErr[t.key] || 0,
    barStyle:
      "height:100%;border-radius:999px;background:linear-gradient(90deg,#12A093,#0B655D);transition:width .6s cubic-bezier(.22,1,.36,1);width:" +
      Math.round(((byErr[t.key] || 0) / emax) * 100) +
      "%;",
  }));
  const byDrp: Record<string, number> = {};
  recs.filter((r) => r.type === "drp").forEach((r) => {
    if (r.drp_type) byDrp[r.drp_type] = (byDrp[r.drp_type] || 0) + 1;
  });
  const dmax = Math.max(1, ...Object.values(byDrp), 1);
  const drpBreak = DRP_TYPES.map((t) => ({
    label: t.label || t.key,
    count: byDrp[t.key] || 0,
    barStyle:
      "height:100%;border-radius:999px;background:linear-gradient(90deg,#12A093,#0B655D);transition:width .6s cubic-bezier(.22,1,.36,1);width:" +
      Math.round(((byDrp[t.key] || 0) / dmax) * 100) +
      "%;",
  }));
  const typeBreak = S.dashType === "drp" ? drpBreak : errorBreak;
  const breakTitle = S.dashType === "drp" ? "แยกตามประเภท DRP" : "แยกตามประเภท Med Error";

  const byDrug: Record<string, number> = {};
  recs.forEach((r) => {
    drugArr(r).forEach((dn) => {
      byDrug[dn] = (byDrug[dn] || 0) + 1;
    });
  });
  const drugEntries = Object.entries(byDrug)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const gmax = Math.max(1, ...drugEntries.map((x) => x[1]), 1);
  const topDrugs = drugEntries.map(([name, count]) => ({
    name,
    count,
    barStyle:
      "height:100%;border-radius:999px;background:linear-gradient(90deg,#12A093,#0B655D);transition:width .6s cubic-bezier(.22,1,.36,1);width:" +
      Math.round((count / gmax) * 100) +
      "%;",
  }));

  const bo: Record<string, number> = { Accepted: 0, Rejected: 0, Pending: 0 };
  recs.filter((r) => r.type === "drp").forEach((r) => {
    if (r.outcome && bo[r.outcome] != null) bo[r.outcome]++;
  });
  const interv = [
    { label: "แพทย์รับข้อเสนอ", count: bo.Accepted, cardStyle: "background:#E7F3F1;color:#0B655D;border-radius:12px;padding:14px 16px;" },
    { label: "ไม่รับข้อเสนอ", count: bo.Rejected, cardStyle: "background:#FDECEC;color:#B42318;border-radius:12px;padding:14px 16px;" },
    { label: "รอผล", count: bo.Pending, cardStyle: "background:#FEF3E2;color:#B45309;border-radius:12px;padding:14px 16px;" },
  ];

  const byLoc: Record<string, number> = {};
  recs.forEach((r) => {
    if (r.location) byLoc[r.location] = (byLoc[r.location] || 0) + 1;
  });
  const locMax = Math.max(1, ...Object.values(byLoc), 1);
  const locBreak = LOCATIONS.map((l) => ({
    label: l,
    count: byLoc[l] || 0,
    barStyle:
      "height:100%;border-radius:999px;background:linear-gradient(90deg,#12A093,#0B655D);transition:width .6s cubic-bezier(.22,1,.36,1);width:" +
      Math.round(((byLoc[l] || 0) / locMax) * 100) +
      "%;",
  }));
  const byShift: Record<string, number> = {};
  recs.forEach((r) => {
    const sh = r.shift || shiftOf(r.occurred_time);
    if (sh) byShift[sh] = (byShift[sh] || 0) + 1;
  });
  const shMax = Math.max(1, ...Object.values(byShift), 1);
  const shiftBreak = SHIFTS.map((s) => ({
    label: s,
    count: byShift[s] || 0,
    barStyle:
      "height:100%;border-radius:999px;background:linear-gradient(90deg,#12A093,#0B655D);transition:width .6s cubic-bezier(.22,1,.36,1);width:" +
      Math.round(((byShift[s] || 0) / shMax) * 100) +
      "%;",
  }));
  // heatmap เวร × วันในสัปดาห์ (จ=0 … อา=6)
  const HM_DAYS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
  const hmMatrix: number[][] = [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ];
  const hmShiftIdx: Record<string, number> = { เวรเช้า: 0, เวรบ่าย: 1, เวรดึก: 2 };
  recs.forEach((r) => {
    if (!r.occurred_at) return;
    const d = new Date(r.occurred_at);
    if (isNaN(d.getTime())) return;
    const dow = (d.getDay() + 6) % 7; // getDay: อา=0 → แปลงให้ จ=0
    const si = hmShiftIdx[r.shift || shiftOf(r.occurred_time)];
    if (si === undefined) return;
    hmMatrix[si][dow] += 1;
  });
  const hmMax = Math.max(1, ...hmMatrix.flat());
  const hmTotal = hmMatrix.flat().reduce((a, b) => a + b, 0);
  const hmColor = (v: number) => {
    if (v === 0) return "#F3F8F7";
    const t = v / hmMax;
    if (t < 0.2) return "#EAF6F3";
    if (t < 0.4) return "#BFE3DA";
    if (t < 0.6) return "#7FC7B8";
    if (t < 0.8) return "#3DA593";
    return "#0B655D";
  };

  const byNat: Record<string, number> = {};
  recs.filter((r) => r.type === "med").forEach((r) => {
    const arr = Array.isArray(r.error_nature) ? r.error_nature : r.error_nature ? [r.error_nature] : [];
    arr.forEach((n) => {
      byNat[n] = (byNat[n] || 0) + 1;
    });
  });
  const natMax = Math.max(1, ...Object.values(byNat), 1);
  const natureBreak = ERROR_NATURE.map((n) => n.key).map((k) => ({
    label: k,
    count: byNat[k] || 0,
    barStyle:
      "height:100%;border-radius:999px;background:#F5A623;transition:width .6s cubic-bezier(.22,1,.36,1);width:" +
      Math.round(((byNat[k] || 0) / natMax) * 100) +
      "%;",
  }));
  // แยกตามผู้รายงาน — เรียงมากไปน้อย · สีสดคนละสีต่อแท่ง (ไม่ใช้เทลของธีม เพื่อให้แยกออกจากกราฟอื่น)
  const REPORTER_COLORS = [
    "linear-gradient(90deg,#F43F5E,#BE123C)", // ชมพูแดง
    "linear-gradient(90deg,#F97316,#C2410C)", // ส้ม
    "linear-gradient(90deg,#FACC15,#CA8A04)", // เหลือง
    "linear-gradient(90deg,#22C55E,#15803D)", // เขียว
    "linear-gradient(90deg,#06B6D4,#0E7490)", // ฟ้า
    "linear-gradient(90deg,#3B82F6,#1D4ED8)", // น้ำเงิน
    "linear-gradient(90deg,#8B5CF6,#6D28D9)", // ม่วง
    "linear-gradient(90deg,#EC4899,#BE185D)", // บานเย็น
  ];
  const byReporter: Record<string, number> = {};
  recs.forEach((r) => {
    if (r.reporter) byReporter[r.reporter] = (byReporter[r.reporter] || 0) + 1;
  });
  const repSorted = Object.entries(byReporter).sort((a, b) => b[1] - a[1]);
  const repMax = Math.max(1, ...repSorted.map(([, c]) => c));
  const reporterBreak = repSorted.map(([name, count], i) => ({
    label: name,
    count,
    barStyle:
      "height:100%;border-radius:999px;background:" +
      REPORTER_COLORS[i % REPORTER_COLORS.length] +
      ";transition:width .6s cubic-bezier(.22,1,.36,1);width:" +
      Math.round((count / repMax) * 100) +
      "%;",
  }));
  const medRecs2 = recs.filter((r) => r.type === "med");
  const nmN = medRecs2.filter((r) => ["A", "B"].includes(r.severity || "")).length;
  const nearMissPct = medRecs2.length ? Math.round((nmN / medRecs2.length) * 100) : 0;
  const haCount = recs.filter((r) => r.high_alert).length;
  const laCount = recs.filter((r) => r.lasa).length;
  const rangeLabelMap: Record<string, string> = {
    all: "ทุกช่วงเวลา",
    month: THMON[now.getMonth()] + " " + (now.getFullYear() + 543),
    quarter: "3 เดือนล่าสุด",
    year: "ปี " + (now.getFullYear() + 543),
    custom: (dr.from || "…") + " ถึง " + (dr.to || "…"),
  };
  const rangeLabel = rangeLabelMap[dr.preset] || "ทุกช่วงเวลา";

  // recent (dashboard table)
  const q = (S.search || "").toLowerCase();
  const recentFiltered = recs.filter((r) => matchSearch(r, q));
  const recent = recentFiltered.slice(0, 14).map((r) => ({
    date: r.occurred_at,
    typeLabel: r.type === "med" ? "Med Error" : "DRP",
    badgeStyle: r.type === "med" ? badgeMed : badgeDrp,
    hn: r.hn || "—",
    cat: r.type === "med" ? natureText(r.error_type) : drpLabel(r.drp_type) || "—",
    severity: r.severity || "—",
    drug: r.drug || "—",
    reporter: r.reporter || "—",
  }));

  // records view
  const rf = S.rf;
  const rq = (rf.q || "").toLowerCase();
  const rlist = (S.records || []).filter((r) => {
    if (rf.type !== "all" && r.type !== rf.type) return false;
    if (rf.location && r.location !== rf.location) return false;
    if (rf.error_type && !natureToArray(r.error_type).includes(rf.error_type)) return false;
    if (rf.error_nature) {
      const en = r.error_nature;
      const has = Array.isArray(en) ? en.includes(rf.error_nature) : en === rf.error_nature;
      if (!has) return false;
    }
    if (rf.severity && r.severity !== rf.severity) return false;
    if (rf.drp_type && r.drp_type !== rf.drp_type) return false;
    if (rf.outcome && r.outcome !== rf.outcome) return false;
    if (rf.reporter && r.reporter !== rf.reporter) return false;
    if (rf.shift && r.shift !== rf.shift) return false;
    if (rf.high_alert === "yes" && !r.high_alert) return false;
    if (rf.high_alert === "lasa" && !r.lasa) return false;
    if (rf.from && (r.occurred_at || "") < rf.from) return false;
    if (rf.to && (r.occurred_at || "") > rf.to) return false;
    if (!matchSearch(r, rq)) return false;
    return true;
  });
  const reporterOpts = Array.from(new Set((S.records || []).map((r) => r.reporter).filter(Boolean))).sort() as string[];
  const errorTypeOpts = ERROR_TYPES.map((t) => t.key);
  const errorNatureOpts = ERROR_NATURE.map((n) => n.key);
  // value = ค่าที่เก็บในฐานข้อมูล · label = ป้ายที่โชว์ (ไทย + วงเล็บอังกฤษ)
  const drpTypeOpts = DRP_TYPES.map((t) => ({ value: t.key, label: t.label || t.key }));
  const severityOpts = SEVERITY.map((s) => s.code);
  const outcomeOpts = OUTCOMES.map((o) => ({ value: o.key, label: o.label }));
  const recRows = rlist.map((r) => ({
    r,
    date: r.occurred_at,
    typeLabel: r.type === "med" ? "Med Error" : "DRP",
    badgeStyle: r.type === "med" ? badgeMed : badgeDrp,
    hn: r.hn || "—",
    place: r.location || "—", // จุดที่พบ — DRP ก็มี (จุดที่พบเป็นช่องร่วม ME+DRP) เดิม gate เฉพาะ med ทำให้ DRP โชว์ "—"
    cat:
      r.type === "med"
        ? natureText(r.error_type)
        : r.drp_type === "อื่น ๆ" && r.drp_type_other
        ? "อื่น ๆ: " + r.drp_type_other
        : drpLabel(r.drp_type) || "—",
    severity: r.severity || "—",
    drug: (r.drug || "—") + (r.high_alert ? " ⚠" : "") + (r.lasa ? " 🔁" : ""),
    reporter: r.reporter || "—",
    // รายละเอียดเหตุการณ์ที่พิมพ์ไว้ — Med ใช้ detail · DRP ใช้ cause (ช่อง "รายละเอียดเหตุการณ์/สาเหตุ")
    detailText: (r.type === "med" ? r.detail : r.cause) || "",
    edited: !!r.edited,
  }));

  // detail modal
  const dt2 = S.detail;
  const isMed2 = dt2?.type === "med";
  let detailRows: { label: string; value: string; ok?: string }[] = [];
  const detailBadgeStyle = isMed2
    ? "background:#E7F3F1;color:#0B655D;font-size:12.5px;font-weight:700;padding:4px 12px;border-radius:999px;"
    : "background:#FEF3E2;color:#B45309;font-size:12.5px;font-weight:700;padding:4px 12px;border-radius:999px;";
  if (dt2) {
    const flags = [dt2.high_alert ? "High-alert" : null, dt2.lasa ? "LASA" : null].filter(Boolean).join(", ") || "—";
    const tval = dt2.shift || shiftOf(dt2.occurred_time) || "—";
    const natureDisp = natureText(dt2.error_nature, dt2.error_nature_other);
    const drugDisp = drugText(dt2);
    const drpDisp = dt2.drp_type === "อื่น ๆ" && dt2.drp_type_other ? "อื่น ๆ — " + dt2.drp_type_other : drpLabel(dt2.drp_type);
    const rows: [string, unknown][] = isMed2
      ? [
          ["วันที่เกิดเหตุ", dt2.occurred_at],
          ["เวลาที่พบ", tval],
          ["HN ผู้ป่วย", dt2.hn],
          ["จุดที่พบ", dt2.location],
          ...(dt2.an ? ([["AN (เลขที่ผู้ป่วยใน)", dt2.an]] as [string, unknown][]) : []),
          ["ประเภท Error", natureText(dt2.error_type)],
          ["ลักษณะความคลาดเคลื่อน", natureDisp],
          ["ระดับความรุนแรง (NCC MERP)", dt2.severity],
          ["ชื่อยาที่เกี่ยวข้อง", drugDisp],
          ["ธงเตือนยา", flags],
          ["รายละเอียดเหตุการณ์", dt2.detail],
          ["การแก้ไข / จัดการ", dt2.management],
          ["ผู้รายงาน", dt2.reporter],
        ]
      : [
          ["วันที่", dt2.occurred_at],
          ["เวลาที่พบ", tval],
          ["HN ผู้ป่วย", dt2.hn],
          ["จุดที่พบ", dt2.location],
          ...(dt2.an ? ([["AN (เลขที่ผู้ป่วยใน)", dt2.an]] as [string, unknown][]) : []),
          ["ประเภทปัญหาจากการใช้ยา (DRP)", drpDisp],
          ["ระดับความรุนแรง (NCC MERP)", dt2.severity],
          ["ยาที่เกี่ยวข้อง", drugDisp],
          ["ธงเตือนยา", flags],
          ["รายละเอียดเหตุการณ์ / สาเหตุ", dt2.cause],
          ["การแก้ไข (Intervention)", dt2.intervention],
          // มีแถวผลตอบรับเฉพาะเคสที่เกี่ยวกับแพทย์: เสนอแพทย์ (มี outcome) หรือติ๊กว่าเภสัชกรแก้เอง
          ...(dt2.pharmacist_only || dt2.outcome
            ? ([
                [
                  "ผลตอบรับจากแพทย์",
                  dt2.pharmacist_only ? "เภสัชกรแก้ไขเอง ไม่ผ่านแพทย์" : outcomeLabel(dt2.outcome),
                ],
              ] as [string, unknown][])
            : []),
          ...(dt2.management ? ([["การแก้ไข / จัดการ", dt2.management]] as [string, unknown][]) : []),
          ...(dt2.detail ? ([["รายละเอียดเพิ่มเติม", dt2.detail]] as [string, unknown][]) : []), // เคสเก่าที่เคยมีช่องนี้
          ["ผู้รายงาน", dt2.reporter],
        ];
    detailRows = rows.map(([label, value]) => {
      // ป้ายเขียว: Med Error ที่ติ๊กว่าจัดการแล้ว · DRP ที่เภสัชกรแก้เอง
      let ok = "";
      if (label === "การแก้ไข / จัดการ" && dt2.managed) ok = "✓ แก้ไขแล้ว";
      if (label === "ผลตอบรับจากแพทย์" && dt2.pharmacist_only) ok = "✓ เภสัชกรแก้ไขเอง";
      const v = value === "" || value == null ? "—" : String(value);
      return { label, value: ok === "✓ เภสัชกรแก้ไขเอง" ? "—" : v, ok };
    });
  }
  const historyList = ((dt2 && dt2.history) || []).map((h, idx) => {
    const isM = h.type === "med";
    const rr: [string, unknown][] = isM
      ? [
          ["วันที่/เวลา", (h.occurred_at || "—") + " " + (h.occurred_time || "")],
          ["ประเภท Error", natureText(h.error_type)],
          ["ลักษณะ", natureText(h.error_nature, h.error_nature_other)],
          ["ระดับ", h.severity],
          ["ยา", h.drug],
          ["เหตุการณ์", h.detail],
          ["การแก้ไข", h.management],
          ["ผู้รายงาน", h.reporter],
        ]
      : [
          ["วันที่/เวลา", (h.occurred_at || "—") + " " + (h.occurred_time || "")],
          ["ประเภท DRP", drpLabel(h.drp_type)],
          ["ระดับ", h.severity],
          ["รายละเอียดเหตุการณ์ / สาเหตุ", h.cause],
          ["Intervention", h.intervention],
          ["การแก้ไข / จัดการ", h.management],
          ["ผลตอบรับจากแพทย์", h.pharmacist_only ? "เภสัชกรแก้ไขเอง ไม่ผ่านแพทย์" : outcomeLabel(h.outcome)],
          ["ยา", h.drug],
          ["รายละเอียด", h.detail],
          ["ผู้รายงาน", h.reporter],
        ];
    return {
      no: idx + 1,
      at: fmtThaiDateTime(h.saved_at),
      rows: rr.map(([label, value]) => ({ label, value: value === "" || value == null ? "—" : String(value) })),
    };
  });
  const ef = S.editForm || {};

  const cfgConfigured = isConfigured(S.cfg);

  // =========================================================
  //  RENDER
  // =========================================================
  return (
    <div style={{ minHeight: "100vh" }}>
      {/* TOP NAV */}
      {isMobile ? (
        /* ---------- หัวเมนู: มือถือ ---------- */
        <div
          className="no-print"
          style={css(
            "position:sticky;top:0;z-index:30;background:linear-gradient(100deg,#0F8A80,#0B655D);color:#Dff1ee;padding:9px 13px;box-shadow:0 2px 12px rgba(11,101,93,.3);"
          )}
        >
          <div style={css("display:flex;align-items:center;gap:9px;")}>
            <div
              style={css(
                "width:30px;height:30px;flex:none;border-radius:9px;background:linear-gradient(155deg,#FCC637,#F59012);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:17px;box-shadow:0 4px 10px -2px rgba(245,144,18,.55);"
              )}
            >
              ℞
            </div>
            <div style={css("flex:1;min-width:0;")}>
              <div style={css("font-size:15px;font-weight:700;color:#fff;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>
                Med Error &amp; DRP
              </div>
              <div style={css("font-size:10.5px;color:#AEE0DA;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>{orgName} · v{APP_VERSION}</div>
            </div>
            <button
              onClick={() => setState({ view: "manage" })}
              aria-label="ตั้งค่า"
              style={css(
                "flex:none;border:none;cursor:pointer;font-size:17px;line-height:1;padding:6px 10px;border-radius:9px;color:#fff;background:" +
                  (S.view === "manage" ? AM : "rgba(255,255,255,.14)")
              )}
            >
              ⚙
            </button>
            <button
              onClick={() => setState({ view: "settings" })}
              aria-label="เกี่ยวกับ"
              style={css(
                "flex:none;border:none;cursor:pointer;font-size:18px;line-height:1;padding:6px 10px;border-radius:9px;color:#fff;background:" +
                  (S.view === "settings" ? AM : "rgba(255,255,255,.14)")
              )}
            >
              ⓘ
            </button>
          </div>
          <div style={css("display:flex;gap:6px;margin-top:8px;")}>
            <button onClick={() => setState({ view: "form" })} style={css(navM(S.view === "form"))}>
              กรอก
            </button>
            <button onClick={() => setState({ view: "records" })} style={css(navM(S.view === "records"))}>
              รายงาน
            </button>
            <button onClick={() => setState({ view: "dashboard" })} style={css(navM(S.view === "dashboard"))}>
              สรุป
            </button>
            <button onClick={() => setState({ view: "drugs" })} style={css(navM(S.view === "drugs"))}>
              คลังยา
            </button>
          </div>
        </div>
      ) : (
        /* ---------- หัวเมนู: เดสก์ท็อป (เดิม ไม่แตะ) ---------- */
        <div
          className="no-print"
          style={css(
            "position:sticky;top:0;z-index:30;background:linear-gradient(100deg,#0F8A80,#0B655D);color:#Dff1ee;display:flex;align-items:center;gap:14px;padding:12px 20px;box-shadow:0 2px 12px rgba(11,101,93,.3);"
          )}
        >
          <div style={css("display:flex;align-items:center;gap:11px;")}>
            <div
              style={css(
                "width:36px;height:36px;border-radius:11px;background:linear-gradient(155deg,#FCC637,#F59012);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:20px;box-shadow:0 4px 10px -2px rgba(245,144,18,.55);"
              )}
            >
              ℞
            </div>
            <div>
              <div style={css("font-size:15px;font-weight:700;color:#fff;line-height:1.1;")}>รายงานความคลาดเคลื่อน</div>
              <div style={css("font-size:11.5px;color:#AEE0DA;")}>
                {orgName} · Med Error &amp; DRP <span style={{ opacity: 0.75 }}>· v{APP_VERSION}</span>
              </div>
            </div>
          </div>
          <div style={css("margin-left:auto;display:flex;gap:6px;")}>
            <button onClick={() => setState({ view: "form" })} style={css(nav(S.view === "form"))}>
              กรอกข้อมูล
            </button>
            <button onClick={() => setState({ view: "records" })} style={css(nav(S.view === "records"))}>
              รายงาน
            </button>
            <button onClick={() => setState({ view: "dashboard" })} style={css(nav(S.view === "dashboard"))}>
              Dashboard
            </button>
            <button onClick={() => setState({ view: "drugs" })} style={css(nav(S.view === "drugs"))}>
              คลังยา
            </button>
            <button onClick={() => setState({ view: "settings" })} style={css(nav(S.view === "settings"))}>
              เกี่ยวกับ
            </button>
            <button onClick={() => setState({ view: "manage" })} style={css(nav(S.view === "manage"))}>
              ตั้งค่า
            </button>
          </div>
        </div>
      )}

      {/* แถบเตือน: มีรายงานค้างที่ยังส่งขึ้นระบบส่วนกลางไม่สำเร็จ (ยืนยันการส่ง + แนะนำเบราว์เซอร์อื่น) */}
      {S.pending.length > 0 && (
        <div style={css("max-width:960px;margin:12px auto 0;padding:0 16px;box-sizing:border-box;")}>
          <div
            style={css(
              "background:#FEF3E5;border:1px solid #F5D6A6;border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;"
            )}
          >
            <span style={css("font-size:18px;line-height:1;")}>⚠</span>
            <div style={css("flex:1;min-width:200px;font-size:13px;color:#B45309;font-weight:600;line-height:1.5;")}>
              มี {S.pending.length} รายงานที่ยังไม่ขึ้นระบบส่วนกลาง (เก็บไว้ในเครื่องนี้แล้ว){" "}
              {S.syncing ? "· กำลังส่ง…" : "· หากส่งไม่สำเร็จ แนะนำให้เปิดผ่าน Google Chrome"}
            </div>
            <HButton
              onClick={() => flushPending()}
              base="border:1px solid #E4980E;background:#F5A623;color:#3B2200;font-size:13px;font-weight:700;padding:8px 14px;border-radius:9px;cursor:pointer;white-space:nowrap;"
              hover="background:#E4980E"
            >
              {S.syncing ? "กำลังส่ง…" : "ลองส่งอีกครั้ง"}
            </HButton>
          </div>
        </div>
      )}

      {S.view === "form" && renderForm()}
      {S.view === "dashboard" && renderDashboard()}
      {S.view === "records" && renderRecords()}
      {S.view === "settings" && renderSettings()}
      {S.view === "manage" && renderManage()}
      {S.view === "drugs" && renderDrugsAdmin()}
      {dt2 && renderDetailModal()}
      {S.drugEdit && renderDrugEditModal()}
      {S.drugLog && renderDrugLogModal()}

      {/* ยืนยันลบถาวร (ลบชั้น 2) — ต้องพิมพ์ HN ของเคสให้ตรง · คลิกนอกป๊อปไม่ปิด */}
      {S.hardTarget &&
        (() => {
          const t = S.hardTarget!;
          const hn = (t.hn || "").trim();
          const confWord = hn || "ลบถาวร";
          const ok = S.hardInput.trim() === confWord;
          const idLabel = t.type === "med" ? "Med Error" : "DRP";
          const drugLine = drugText(t);
          return (
            <div
              style={css(
                "position:fixed;inset:0;background:rgba(11,101,93,.5);z-index:80;display:flex;align-items:center;justify-content:center;padding:20px;"
              )}
            >
              <div style={css("background:#fff;border-radius:16px;border-top:4px solid #DC2626;width:410px;max-width:100%;padding:22px;box-shadow:0 30px 70px -20px rgba(11,101,93,.6);")}>
                <div style={css("font-size:16px;font-weight:800;color:#B91C1C;margin-bottom:8px;")}>ลบถาวร — กู้คืนไม่ได้</div>
                <div style={css("font-size:13.5px;color:#475569;line-height:1.6;margin-bottom:12px;")}>
                  รายงานนี้จะถูกลบออกจากระบบอย่างถาวร ไม่สามารถกู้คืนได้อีก
                </div>
                <div style={css("background:#FDECEC;border:1px solid #F3C5C2;border-radius:11px;padding:11px 13px;font-size:12.5px;color:#B42318;line-height:1.55;margin-bottom:14px;")}>
                  ⚠ ข้อมูลความคลาดเคลื่อนทางยาเป็นหลักฐานสำคัญ ควรลบถาวรเฉพาะกรณีกรอกซ้ำหรือกรอกผิดเท่านั้น
                </div>
                {/* #21: โชว์ว่าเป็นเคสไหน — กัน HN ซ้ำในถังขยะแล้วลบผิดเคส */}
                <div style={css("background:#F6FAF9;border:1px solid #E3EFEC;border-radius:11px;padding:10px 13px;font-size:12.5px;color:#334155;line-height:1.65;margin-bottom:14px;")}>
                  <span style={css("font-weight:700;color:#0B655D;")}>{idLabel}</span> · HN {t.hn || "—"}
                  <br />
                  วันที่ {t.occurred_at || "—"} · ผู้รายงาน {t.reporter || "—"}
                  {drugLine ? (
                    <>
                      <br />
                      ยา {drugLine}
                    </>
                  ) : null}
                </div>
                <label style={css("font-size:12.5px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
                  {hn ? "พิมพ์ HN ของเคสนี้ " : "พิมพ์คำว่า "}
                  <span style={css("font-family:ui-monospace,Menlo,monospace;background:#FEF3E5;color:#B45309;padding:1px 7px;border-radius:6px;font-weight:700;")}>{confWord}</span>
                  {" เพื่อยืนยัน"}
                </label>
                <HInput
                  value={S.hardInput}
                  onChange={(e) => setState({ hardInput: e.target.value })}
                  base={"width:100%;box-sizing:border-box;border:1.5px solid " + (ok ? "#0F8A80" : "#DCE7E5") + ";border-radius:10px;padding:11px 13px;font-size:15px;"}
                  focus={INPUT_FOCUS}
                />
                <div style={css("display:flex;gap:10px;margin-top:15px;")}>
                  <HButton
                    onClick={() => ok && !S.trashBusy && doHardDelete()}
                    base={
                      "flex:1;border:none;background:#DC2626;color:#fff;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;" +
                      (ok && !S.trashBusy ? "" : "opacity:.45;pointer-events:none;")
                    }
                    hover="background:#B91C1C"
                  >
                    {S.trashBusy ? "กำลังลบ…" : "ลบถาวร"}
                  </HButton>
                  <HButton
                    onClick={() => setState({ hardTarget: null, hardInput: "" })}
                    base="flex:1;border:1.5px solid #DCE7E5;background:#fff;color:#0B655D;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;"
                    hover="background:#F5FAF9"
                  >
                    ยกเลิก
                  </HButton>
                </div>
              </div>
            </div>
          );
        })()}

      {/* หน้าผลการส่งเต็มจอ (สำเร็จ / ไม่สำเร็จ) — คลุมทั้งแอป */}
      {S.result && renderResult()}

      {/* #7: ยืนยันสลับประเภท ME↔DRP ตอนกรอกฟอร์มค้าง — คลิกนอกป๊อปไม่ปิด ต้องกดปุ่มเอง */}
      {S.confirmSwitch && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={css(
            "position:fixed;inset:0;background:rgba(11,101,93,.45);backdrop-filter:blur(2px);z-index:80;display:flex;align-items:center;justify-content:center;padding:20px;"
          )}
        >
          <div style={css("background:#fff;border-radius:16px;width:400px;max-width:100%;padding:22px;box-shadow:0 30px 70px -20px rgba(11,101,93,.6);")}>
            <div style={css("font-size:16px;font-weight:800;color:#0B655D;margin-bottom:8px;")}>
              เปลี่ยนเป็น {S.confirmSwitch === "med" ? "Med Error" : "DRP"}
            </div>
            <div style={css("font-size:14px;color:#475569;line-height:1.6;margin-bottom:18px;")}>
              ตอนนี้กรอกข้อมูลค้างไว้อยู่ ถ้าเปลี่ยนประเภทรายงาน ข้อมูลที่กรอกจะถูกล้าง (เก็บไว้เฉพาะ HN และผู้รายงาน)
            </div>
            <div style={css("display:flex;gap:10px;")}>
              <HButton
                onClick={() => setState({ confirmSwitch: null })}
                base="flex:1;border:1.5px solid #DCE7E5;background:#fff;color:#0B655D;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;"
                hover="background:#F5FAF9"
              >
                กรอกต่อ
              </HButton>
              <HButton
                onClick={() => S.confirmSwitch && doSwitchType(S.confirmSwitch)}
                base="flex:1;border:none;background:#0F8A80;color:#fff;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;"
                hover="background:#0B655D"
              >
                เปลี่ยนประเภท
              </HButton>
            </div>
          </div>
        </div>
      )}

      {S.toast && (
        <div
          style={css(
            "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#0B655D;color:#fff;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:600;box-shadow:0 12px 30px -8px rgba(11,101,93,.6);animation:toastIn .25s ease;z-index:50;"
          )}
        >
          {S.toast}
        </div>
      )}
    </div>
  );

  // dropdown ผู้รายงาน (ทำเอง ไม่ใช้ <select> ของ OS — กัน iOS ตัดชื่อ 2 บรรทัด)
  function renderReporterDD(id: string, value: string, onChange: (v: string) => void, err: boolean) {
    const open = S.dd === id;
    const opts = value && !REPORTERS.includes(value) ? [value, ...REPORTERS] : REPORTERS;
    return (
      <div style={css("position:relative;")}>
        <button
          type="button"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const up = r.bottom > window.innerHeight * 0.5; // ช่องอยู่ครึ่งล่างจอ → เมนูเด้งขึ้นบน
            setState((st) => (st.dd === id ? { dd: null } : { dd: id, ddUp: up }));
          }}
          style={css(
            "width:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:1.5px solid " +
              (err ? "#DC2626" : open ? "#0F8A80" : "#DCE7E5") +
              ";border-radius:11px;padding:12px 14px;font-size:15px;background:#fff;cursor:pointer;color:" +
              (value ? "#0F172A" : "#94A3B8") +
              ";" +
              (err ? "box-shadow:0 0 0 3px rgba(220,38,38,.15);" : "")
          )}
        >
          <span style={css("white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>{value || "— เลือกผู้รายงาน —"}</span>
          <span style={css("color:#0F8A80;flex:none;font-size:12px;transition:transform .15s;transform:rotate(" + (open ? "180deg" : "0") + ");")}>▾</span>
        </button>
        {open && (
          // absolute + เด้งขึ้น/ลง ตามพื้นที่ (S.ddUp) — ช่องล่างจอเด้งขึ้น กันโดนตัดขอบล่าง
          <div
            id="dd-open-panel"
            style={css(
              "position:absolute;left:0;right:0;z-index:30;" +
                (S.ddUp ? "bottom:calc(100% + 6px);" : "top:calc(100% + 6px);") +
                "border:1.5px solid #CFE3DF;border-radius:12px;background:#fff;box-shadow:0 10px 26px -12px rgba(11,101,93,.4);overflow:hidden;max-height:300px;overflow-y:auto;-webkit-overflow-scrolling:touch;"
            )}
          >
            {opts.map((r) => {
              const sel = r === value;
              return (
                <HDiv
                  key={r}
                  onClick={() => {
                    onChange(r);
                    setState({ dd: null });
                  }}
                  base={
                    "display:flex;align-items:center;gap:8px;padding:13px 14px;font-size:15px;cursor:pointer;border-bottom:1px solid #F1F6F5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" +
                    (sel ? "background:#EAF6F3;color:#0B655D;font-weight:700;" : "color:#0F172A;")
                  }
                  hover="background:#F5FAF9"
                >
                  <span style={css("flex:none;width:16px;color:#0F8A80;")}>{sel ? "✓" : ""}</span>
                  <span style={css("overflow:hidden;text-overflow:ellipsis;")}>{r}</span>
                </HDiv>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---------------- FORM ----------------
  // โลโก้ Google Chrome (inline SVG · 3 พู วงแหวนขาว + แกนน้ำเงิน) — ใช้ในหน้าผล "ส่งไม่สำเร็จ"
  function chromeLogo(size: number) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" style={{ flex: "none" }} aria-hidden="true">
        <path fill="#EA4335" d="M24 24 L7.42 12.82 A20 20 0 0 1 40.58 12.82 Z" />
        <path fill="#FBBC04" d="M24 24 L41.98 15.23 A20 20 0 0 1 25.40 43.95 Z" />
        <path fill="#34A853" d="M24 24 L22.60 43.95 A20 20 0 0 1 6.02 15.23 Z" />
        <circle cx="24" cy="24" r="9.5" fill="#fff" />
        <circle cx="24" cy="24" r="7.5" fill="#4285F4" />
      </svg>
    );
  }

  // หน้าผลการส่งเต็มจอ (สำเร็จ / ไม่สำเร็จ) — เปลี่ยนเต็มหน้าจอหลังกดบันทึก
  function renderResult() {
    const ok = S.result === "ok";
    return (
      <div
        style={css(
          "position:fixed;inset:0;z-index:90;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px 26px;background:" +
            (ok ? "linear-gradient(180deg,#F3FAF8,#EAF6F2)" : "linear-gradient(180deg,#FEF2F2,#FDE7E7)") +
            ";"
        )}
      >
        {ok ? (
          <>
            <div
              style={css(
                "width:108px;height:108px;border-radius:999px;background:#E4F5EF;display:flex;align-items:center;justify-content:center;margin-bottom:22px;box-shadow:0 0 0 10px rgba(16,161,140,.10);"
              )}
            >
              <span style={css("font-size:60px;color:#12A093;line-height:1;")}>✓</span>
            </div>
            <div style={css("font-size:27px;font-weight:800;color:#0B655D;letter-spacing:-.3px;")}>ส่งสำเร็จ</div>
            <div style={css("font-size:14px;color:#5B7A73;margin-top:8px;line-height:1.55;")}>บันทึกและส่งขึ้นระบบส่วนกลางเรียบร้อย</div>
            <div style={css("width:100%;max-width:340px;margin-top:30px;display:flex;flex-direction:column;gap:11px;")}>
              <HButton
                onClick={() => {
                  // กลับหน้ากรอกใหม่ (view คงเป็น form อยู่แล้ว → effect scrollTo ไม่ทำงาน) จึงเด้งขึ้นบนสุดเอง
                  setState({ result: null, resultRec: null });
                  if (typeof window !== "undefined") window.scrollTo(0, 0);
                }}
                base="border:none;border-radius:13px;font-size:16px;font-weight:700;padding:15px;cursor:pointer;background:#0F8A80;color:#fff;box-shadow:0 10px 22px -8px rgba(15,138,128,.6);"
                hover="background:#0B655D"
              >
                ส่งรายงานใหม่
              </HButton>
              <HButton
                onClick={() => setState({ result: null, resultRec: null, view: "records" })}
                base="background:transparent;border:none;color:#0B655D;font-size:14.5px;font-weight:600;padding:11px;border-radius:11px;cursor:pointer;"
                hover="background:rgba(15,138,128,.08)"
              >
                ดูรายงานทั้งหมด
              </HButton>
            </div>
          </>
        ) : (
          <>
            <div
              style={css(
                "width:108px;height:108px;border-radius:999px;background:#FBDCDC;display:flex;align-items:center;justify-content:center;margin-bottom:20px;box-shadow:0 0 0 10px rgba(220,38,38,.10);"
              )}
            >
              <span style={css("font-size:58px;color:#DC2626;line-height:1;")}>✕</span>
            </div>
            <div style={css("font-size:30px;font-weight:800;color:#B91C1C;letter-spacing:-.4px;")}>ส่งไม่สำเร็จ</div>
            <div style={css("font-size:14px;color:#9B4444;margin-top:9px;line-height:1.55;")}>
              ข้อมูลถูกเก็บไว้ในเครื่องนี้แล้ว
              <br />
              แต่ยังไม่ขึ้นระบบส่วนกลาง
            </div>
            {/* คำแนะนำ Chrome ตัวใหญ่ + โลโก้ Chrome */}
            <div
              style={css(
                "margin-top:20px;width:100%;max-width:380px;box-sizing:border-box;background:#FEF3E5;border:1.5px solid #F5D6A6;border-radius:14px;padding:15px 18px;display:flex;align-items:center;gap:13px;"
              )}
            >
              {chromeLogo(38)}
              <div style={css("text-align:left;font-size:15.5px;font-weight:700;color:#B45309;line-height:1.45;")}>
                หากยังส่งไม่ได้ แนะนำให้เปิดผ่าน Google Chrome
              </div>
            </div>
            <div style={css("width:100%;max-width:340px;margin-top:24px;display:flex;flex-direction:column;gap:11px;")}>
              <HButton
                onClick={() => resendResult()}
                base={
                  "border:none;border-radius:13px;font-size:16px;font-weight:700;padding:15px;cursor:pointer;background:#F5A623;color:#3B2200;box-shadow:0 10px 22px -8px rgba(245,166,35,.6);" +
                  (S.resending ? "opacity:.6;pointer-events:none;" : "")
                }
                hover="background:#E4980E"
              >
                {S.resending ? "กำลังส่ง…" : "ส่งอีกครั้ง"}
              </HButton>
              <HButton
                onClick={() => setState({ result: null, resultRec: null })}
                base="background:#fff;border:1.5px solid #F3C5C2;color:#B91C1C;font-size:14.5px;font-weight:600;padding:12px;border-radius:13px;cursor:pointer;"
                hover="background:#FDECEC"
              >
                เก็บไว้ส่งทีหลัง
              </HButton>
            </div>
          </>
        )}
      </div>
    );
  }

  // ช่องเลือกระดับความรุนแรง A–I (NCC MERP) — ใช้ร่วมทั้ง Med Error และ DRP (บังคับกรอกทั้งคู่)
  function renderSeverityField() {
    return (
      <div style={css("margin-bottom:16px;")}>
        <div style={css("display:flex;align-items:center;margin-bottom:8px;gap:8px;")}>
          <label style={css("font-size:13px;font-weight:600;color:#475569;")}>
            ระดับความรุนแรง <span style={css("color:#94A3B8;font-weight:400;")}>NCC MERP</span>{" "}
            <span style={css("color:#DC2626;")}>*</span>
          </label>
          <HButton
            onClick={() => setState((st) => ({ showSevLegend: !st.showSevLegend }))}
            base="margin-left:auto;border:1px solid #F6D89A;background:#FEF7EC;color:#B45309;font-size:12px;font-weight:600;padding:4px 11px;border-radius:999px;cursor:pointer;display:flex;align-items:center;gap:5px;"
            hover="background:#FDEFD6"
          >
            ⓘ {S.showSevLegend ? "ซ่อนความหมาย A–I" : "ดูความหมาย A–I"}
          </HButton>
        </div>
        <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:8px;")}>
          {SEV_TIERS.map((gm) => (
            <div key={gm.label} style={css("border:1px solid " + gm.bd + ";background:" + gm.base + ";border-radius:11px;padding:8px 10px;")}>
              <div style={css("font-size:11px;font-weight:700;color:" + gm.tx + ";margin-bottom:6px;")}>{gm.label}</div>
              <div style={css("display:flex;gap:5px;")}>
                {gm.codes.map((code) => {
                  const sl = f.severity === code;
                  const stStr = sl
                    ? "flex:1;min-width:0;height:40px;display:flex;align-items:center;justify-content:center;border-radius:8px;border:1.5px solid " +
                      gm.sel +
                      ";background:" +
                      gm.sel +
                      ";color:#fff;font-weight:700;font-size:15px;cursor:pointer;transition:all .12s;box-shadow:0 5px 12px -3px " +
                      gm.sel +
                      "99;"
                    : "flex:1;min-width:0;height:40px;display:flex;align-items:center;justify-content:center;border-radius:8px;border:1.5px solid " +
                      gm.bd +
                      ";background:#fff;color:" +
                      gm.tx +
                      ";font-weight:700;font-size:15px;cursor:pointer;transition:all .12s;";
                  return (
                    <button key={code} onClick={() => setField("severity", sl ? "" : code)} style={css(stStr)}>
                      {code}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {sevObj && <div style={css("margin-top:9px;font-size:13px;color:#B45309;font-weight:500;line-height:1.5;")}>{sevObj.desc}</div>}
        {S.errors.severity && (
          <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาเลือกระดับความรุนแรง</div>
        )}
        {S.showSevLegend && (
          <div
            style={css(
              "margin-top:10px;background:#FBFDFC;border:1px solid #E3EFEC;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;"
            )}
          >
            <div style={css("font-size:12.5px;font-weight:700;color:#0B655D;")}>ความหมายระดับความรุนแรง (NCC MERP Index)</div>
            {SEVERITY.map((s) => {
              const gm = SEV_TIERS.find((t) => t.codes.includes(s.code))!;
              return (
                <div key={s.code} style={css("display:flex;gap:10px;align-items:flex-start;")}>
                  <span
                    style={css(
                      "flex:none;width:24px;height:24px;border-radius:7px;background:" +
                        gm.sel +
                        ";color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;"
                    )}
                  >
                    {s.code}
                  </span>
                  <span style={css("font-size:12.5px;color:#475569;line-height:1.45;padding-top:3px;")}>{s.desc}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderForm() {
    const isMed = type === "med";
    return (
      <div style={css("max-width:600px;margin:0 auto;padding:22px 16px 60px;")}>
        <div
          style={css(
            "background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 12px 34px -18px rgba(11,101,93,.4);border:1px solid #D6EAE6;"
          )}
        >
          <div style={css("background:linear-gradient(150deg,#0F8A80,#0B655D);padding:22px 24px;color:#E6F5F2;")}>
            <div style={css("font-size:22px;font-weight:700;color:#fff;")}>แบบฟอร์มรายงาน</div>
            <div style={css("font-size:13px;color:#B4E1DB;margin-top:3px;")}>บันทึกได้รวดเร็ว · ใช้ได้ทั้งมือถือและเว็บ</div>
          </div>

          <div style={css("padding:18px 22px 26px;")}>
            <div style={css("background:#E8F4F1;border-radius:13px;padding:4px;display:flex;gap:4px;margin-bottom:20px;")}>
              <button onClick={() => requestSwitchType("med")} style={css(seg(type === "med"))}>
                Med Error
              </button>
              <button onClick={() => requestSwitchType("drp")} style={css(seg(type === "drp"))}>
                DRP
              </button>
            </div>

            {/* date + time */}
            <div style={css("display:flex;gap:12px;margin-bottom:16px;" + (isMobile ? "flex-direction:column;gap:14px;" : ""))}>
              <div style={css("flex:1;min-width:0;")}>
                <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>วันที่เกิดเหตุ <span style={css("color:#DC2626;")}>*</span></label>
                <div style={css("position:relative;")}>
                  <HInput
                    type="date"
                    value={f.occurred_at}
                    onChange={(e) => setField("occurred_at", e.target.value)}
                    base={INPUT_BASE + (isMobile ? "text-align:left;" : "")}
                    focus={INPUT_FOCUS}
                  />
                  {f.occurred_at === today() && (
                    <span
                      style={css(
                        "position:absolute;right:" +
                          (isMobile ? "14px" : "40px") +
                          ";top:50%;transform:translateY(-50%);background:#FEF3E2;color:#B45309;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;pointer-events:none;"
                      )}
                    >
                      วันนี้
                    </span>
                  )}
                </div>
              </div>
              <div style={css("flex:1;min-width:0;")}>
                <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
                  เวลาที่พบ (เวร) <span style={css("color:#0F8A80;font-weight:600;")}>· ⏱ {clock}</span>
                </label>
                <div style={css("display:flex;gap:6px;")}>
                  {SHIFTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setField("occurred_time", SHIFT_TIME[s])}
                      style={css(shiftBtn(shiftOf(f.occurred_time) === s))}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* จุดที่พบ (มาก่อน HN — เลือก IPD แล้วจึงกรอก AN ได้) */}
            {renderLocationField()}

            {/* HN + AN แถวเดียว · AN กดได้เมื่อจุดที่พบ = ห้องยา IPD */}
            <div style={css("margin-bottom:16px;")}>
              <div style={css("display:flex;gap:10px;")}>
                <div style={css("flex:1;min-width:0;")}>
                  <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
                    HN ผู้ป่วย <span style={css("color:#DC2626;")}>*</span>
                  </label>
                  <HInput
                    value={f.hn}
                    onChange={(e) => setField("hn", e.target.value.replace(/\D/g, ""))}
                    placeholder="เช่น 1234567"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    base={INPUT_BASE}
                    focus={INPUT_FOCUS}
                  />
                </div>
                <div style={css("flex:1;min-width:0;")}>
                  <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
                    AN <span style={css("color:#94A3B8;font-weight:400;")}>ผู้ป่วยใน</span>
                    {f.location === IPD_LOCATION && <span style={css("color:#DC2626;")}> *</span>}
                  </label>
                  <HInput
                    value={f.an}
                    onChange={(e) => setField("an", e.target.value.replace(/[^0-9-]/g, ""))}
                    onBlur={() => setField("an", formatAn(f.an, f.occurred_at))}
                    placeholder={f.location === IPD_LOCATION ? "เช่น 69-01234" : "เลือกห้องยา IPD ก่อน"}
                    inputMode="numeric"
                    disabled={f.location !== IPD_LOCATION}
                    base={INPUT_BASE + (f.location !== IPD_LOCATION ? "background:#F1F5F4;color:#94A3B8;cursor:not-allowed;" : "")}
                    focus={INPUT_FOCUS}
                  />
                </div>
              </div>
              {S.errors.hn && (
                <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณากรอก HN ผู้ป่วย</div>
              )}
              {S.errors.an && (
                <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณากรอกเลขที่ผู้ป่วยใน (AN)</div>
              )}
            </div>

            {isMed && renderMedFields()}
            {!isMed && renderDrpFields()}

            {/* ธงเตือนยา */}
            <div style={css("margin-bottom:16px;")}>
              <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:8px;")}>ธงเตือนยา</label>
              <div style={css("display:flex;flex-wrap:wrap;gap:8px;")}>
                <button onClick={() => toggleHighAlert()} style={css(chip(!!f.high_alert))}>
                  ⚠ High-alert
                </button>
                <button onClick={() => setField("lasa", !f.lasa)} style={css(chip(!!f.lasa))}>
                  🔁 LASA (ชื่อ/รูปคล้าย)
                </button>
              </div>
            </div>

            {/* แนบรูป */}
            <div style={css("margin-bottom:20px;")}>
              <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:8px;")}>
                แนบรูป <span style={css("color:#94A3B8;font-weight:400;")}>ฉลาก / ใบสั่งยา</span>
              </label>
              {f.attachment && (
                <div style={css("position:relative;display:inline-block;")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.attachment}
                    alt="แนบ"
                    style={{ maxWidth: "100%", maxHeight: "180px", borderRadius: "12px", border: "1px solid #DCE7E5", display: "block" }}
                  />
                  <button
                    onClick={() => setField("attachment", null)}
                    style={css(
                      "position:absolute;top:6px;right:6px;border:none;background:rgba(15,23,42,.7);color:#fff;width:26px;height:26px;border-radius:8px;font-size:15px;cursor:pointer;line-height:1;"
                    )}
                  >
                    ×
                  </button>
                </div>
              )}
              {/* ปิดใช้งานชั่วคราว — รอย้ายไปเก็บรูปที่ Cloudflare (แปลง webp + ย่อขนาด) แทนการฝัง base64 ลงฐานข้อมูล */}
              <div
                style={css(
                  "display:flex;align-items:center;justify-content:center;gap:8px;border:1.5px dashed #E2E8F0;border-radius:12px;padding:14px;font-size:14px;color:#94A3B8;font-weight:600;margin-top:8px;background:#F8FAFC;cursor:not-allowed;user-select:none;"
                )}
              >
                📎 เลือกรูปเพื่อแนบ
                <span style={css("background:#E2E8F0;color:#64748B;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px;")}>
                  ยังใช้ไม่ได้
                </span>
              </div>
            </div>

            {/* ผู้รายงาน */}
            <div style={css("margin-bottom:20px;")}>
              <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
                ผู้รายงาน <span style={css("color:#DC2626;")}>*</span>
              </label>
              {renderReporterDD("reporter", f.reporter, (v) => setField("reporter", v), !!S.errors.reporter)}
              {S.errors.reporter && (
                <div style={css("margin-top:5px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาระบุผู้รายงาน</div>
              )}
            </div>

            <HButton
              onClick={() => save()}
              base={
                "width:100%;border:none;background:#F5A623;color:#3B2200;font-size:16px;font-weight:700;padding:15px;border-radius:13px;cursor:pointer;box-shadow:0 10px 22px -8px rgba(245,166,35,.7);" +
                (S.saving ? "opacity:.65;pointer-events:none;" : "") // #1 กันกดซ้ำ (ล็อกปุ่มระหว่างส่ง)
              }
              hover="background:#E4980E"
            >
              {S.saving ? "กำลังบันทึก…" : "บันทึกรายงาน"}
            </HButton>
          </div>
        </div>
      </div>
    );
  }

  function renderDrugRows() {
    const rows = f.drugs || [""];
    const sug = S.drugSug;
    return (
      <div style={css("display:flex;flex-direction:column;gap:8px;")}>
        {rows.map((val, i) => {
          const active = !!(sug && sug.i === i && sug.term.trim() !== "");
          const term = active ? sug!.term.trim().toLowerCase() : "";
          const matches = active ? S.drugs.filter((d) => drugSearchText(d).includes(term)).slice(0, 25) : [];
          // ไฮไลต์คำค้นในข้อความ (ชื่อ generic / ชื่อการค้า)
          const hl = (text: string) => {
            if (!term) return text;
            const idx = text.toLowerCase().indexOf(term);
            if (idx < 0) return text;
            return (
              <>
                {text.slice(0, idx)}
                <span style={css("color:#0E7A66;font-weight:800;")}>{text.slice(idx, idx + term.length)}</span>
                {text.slice(idx + term.length)}
              </>
            );
          };
          return (
            <div key={i} style={css("position:relative;")}>
              <div style={css("display:flex;gap:8px;align-items:center;")}>
                <HInput
                  value={val}
                  onChange={(e) => {
                    setDrugAt(i, e.target.value);
                    setState({ drugSug: { i, term: e.target.value } });
                  }}
                  onFocus={() => {
                    if (val && val.trim()) setState({ drugSug: { i, term: val } });
                  }}
                  onBlur={() => setTimeout(() => setState((s) => (s.drugSug && s.drugSug.i === i ? { drugSug: null } : {})), 180)}
                  placeholder={type === "med" ? "พิมพ์ค้นหายา เช่น Amox…" : "พิมพ์ค้นหายา เช่น Warfarin…"}
                  autoComplete="off"
                  base="flex:1;min-width:0;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:12px 14px;font-size:15px;color:#0F172A;background:#fff;outline:none;"
                  focus={INPUT_FOCUS}
                />
                {rows.length > 1 && (
                  <button
                    onClick={() => removeDrug(i)}
                    style={css(
                      "flex:none;border:1.5px solid #E2E8F0;background:#fff;color:#B42318;width:44px;height:44px;border-radius:11px;font-size:20px;cursor:pointer;line-height:1;"
                    )}
                  >
                    ×
                  </button>
                )}
              </div>
              {active && (
                <div
                  style={css(
                    "position:absolute;top:calc(100% + 6px);left:0;right:0;background:#fff;border:1px solid #E2E7E4;border-radius:12px;box-shadow:0 10px 28px rgba(11,101,93,.16);overflow:hidden;z-index:20;max-height:290px;overflow-y:auto;"
                  )}
                >
                  {matches.length === 0 ? (
                    <div style={css("padding:15px;font-size:13px;color:#9AA6A0;text-align:center;line-height:1.5;")}>
                      ไม่พบยาในระบบ — พิมพ์ชื่อเองต่อได้เลย
                    </div>
                  ) : (
                    matches.map((d) => {
                      let sv = [d.strength, d.unit].filter(Boolean).join(" ");
                      if (sv && d.strength && d.strength.includes("+")) sv = "(" + sv + ")";
                      const doseStr = [sv, d.percent ? d.percent + "%" : ""].filter(Boolean).join(" ");
                      const tag = "font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:100px;white-space:nowrap;";
                      return (
                        <div
                          key={d.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pickDrug(i, d);
                          }}
                          style={css("padding:11px 14px;border-bottom:1px solid #F0F2F0;cursor:pointer;")}
                        >
                          <div style={css("font-size:14.5px;font-weight:600;color:#16241F;line-height:1.4;")}>
                            {hl(d.generic)}
                            {doseStr ? <span style={css("font-weight:700;color:#0F172A;")}> {doseStr}</span> : null}
                            {d.form ? <span style={css("font-weight:600;color:#334155;")}> {d.form}</span> : null}
                            {d.brand ? <span style={css("color:#0E7A66;font-weight:600;")}> ({hl(d.brand)})</span> : null}
                          </div>
                          {(d.route || d.preg || d.had || d.renal) && (
                            <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:4px;")}>
                              {d.route ? <span style={css("font-size:12px;color:#8A968F;")}>{d.route}</span> : null}
                              {d.preg && <span style={css(tag + pregColor(d.preg))}>Preg {d.preg}</span>}
                              {d.had && <span style={css(tag + "background:#FCE9E8;color:#B3261E;")}>⚠ HAD</span>}
                              {d.renal && <span style={css(tag + "background:#FFF2DC;color:#8A5A00;")}>Renal</span>}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
        <HButton
          onClick={() => addDrug()}
          base="align-self:flex-start;border:1.5px dashed #C6DED9;background:#F5FAF9;color:#0B655D;font-size:13.5px;font-weight:600;padding:9px 15px;border-radius:10px;cursor:pointer;"
          hover="border-color:#F5A623;color:#B45309"
        >
          + เพิ่มยา (พิมพ์เองถ้าไม่เจอในระบบ)
        </HButton>
      </div>
    );
  }

  // จุดที่พบ — ใช้ร่วมทั้ง Med และ DRP (วางก่อน HN · เลือก IPD แล้วจึงกรอก AN ได้)
  function renderLocationField() {
    return (
      <div style={css("margin-bottom:16px;")}>
        <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
          จุดที่พบ <span style={css("color:#DC2626;")}>*</span>
        </label>
        <HSelect
          value={f.location}
          onChange={(e) => setLocation(e.target.value)}
          base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:12px 40px 12px 14px;font-size:15px;color:#0F172A;background-color:#fff;outline:none;"
          focus={INPUT_FOCUS}
        >
          {LOCATIONS.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </HSelect>
        {S.errors.location && (
          <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาเลือกจุดที่พบ</div>
        )}
      </div>
    );
  }

  function renderMedFields() {
    const natureSel = ERROR_NATURE.filter((n) => Array.isArray(f.error_nature) && f.error_nature.includes(n.key));
    const hasNatureSel = Array.isArray(f.error_nature) && f.error_nature.length > 0;
    const showNatureOther = Array.isArray(f.error_nature) && f.error_nature.includes("อื่น ๆ");
    return (
      <div>
        {/* ประเภท Error */}
        <div style={css("margin-bottom:16px;")}>
          <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:8px;")}>
            ประเภท Error <span style={css("color:#DC2626;")}>*</span>{" "}
            <span style={css("color:#94A3B8;font-weight:400;")}>เลือกได้หลายอัน</span>
          </label>
          <div style={css(isMobile ? "display:grid;grid-template-columns:1fr 1fr;gap:8px;" : "display:flex;flex-wrap:wrap;gap:8px;")}>
            {ERROR_TYPES.map((t, i) => {
              const sel = natureToArray(f.error_type).includes(t.key);
              // ปุ่มตัวสุดท้ายที่เหลือเดี่ยว (จำนวนคี่) → span เต็มแถว อยู่กลาง สมมาตร + ไม่ลดฟอนต์
              const lastOdd = isMobile && i === ERROR_TYPES.length - 1 && ERROR_TYPES.length % 2 === 1;
              return (
                <button
                  key={t.key}
                  onClick={() => toggleErrType(t.key)}
                  style={css(
                    chip(sel) +
                      (isMobile
                        ? lastOdd
                          ? "grid-column:1 / -1;width:100%;box-sizing:border-box;text-align:center;white-space:normal;line-height:1.25;padding:10px 8px;"
                          : "width:100%;box-sizing:border-box;text-align:center;font-size:12.5px;white-space:normal;line-height:1.25;padding:10px 8px;"
                        : "")
                  )}
                >
                  {t.key}
                  {t.th ? (
                    <>
                      {" "}
                      <span style={{ whiteSpace: "nowrap" }}>({t.th})</span>
                    </>
                  ) : null}
                </button>
              );
            })}
          </div>
          {errTypeSel.length > 0 && (
            <div
              style={css(
                "margin-top:9px;background:#FEF7EC;border:1px solid #F6D89A;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:9px;"
              )}
            >
              {errTypeSel.map((t) => (
                <div key={t.key} style={css("display:flex;gap:9px;align-items:flex-start;")}>
                  <span
                    style={css(
                      "flex:none;background:#F5A623;color:#3B2200;font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;white-space:nowrap;"
                    )}
                  >
                    {t.th || t.key}
                  </span>
                  <span style={css("font-size:12.5px;color:#92400E;line-height:1.5;")}>{t.desc}</span>
                </div>
              ))}
            </div>
          )}
          {S.errors.error_type && (
            <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาเลือกประเภท Error</div>
          )}
        </div>

        {/* ลักษณะความคลาดเคลื่อน (multi) */}
        <div style={css("margin-bottom:16px;")}>
          <div style={css("display:flex;align-items:center;margin-bottom:8px;gap:8px;")}>
            <label style={css("font-size:13px;font-weight:600;color:#475569;")}>
              ลักษณะความคลาดเคลื่อน <span style={css("color:#DC2626;")}>*</span> <span style={css("color:#94A3B8;font-weight:400;")}>ผิดอะไร · เลือกได้หลายอัน</span>
            </label>
            <HButton
              onClick={() => setState((st) => ({ showNatureLegend: !st.showNatureLegend }))}
              base="margin-left:auto;border:1px solid #F6D89A;background:#FEF7EC;color:#B45309;font-size:12px;font-weight:600;padding:4px 11px;border-radius:999px;cursor:pointer;display:flex;align-items:center;gap:5px;white-space:nowrap;"
              hover="background:#FDEFD6"
            >
              ⓘ {S.showNatureLegend ? "ซ่อนความหมาย" : "ดูความหมาย"}
            </HButton>
          </div>
          <div style={css("display:flex;flex-wrap:wrap;gap:8px;")}>
            {ERROR_NATURE.map((n) => (
              <button
                key={n.key}
                onClick={() => toggleNature(n.key)}
                style={css(chip(Array.isArray(f.error_nature) && f.error_nature.includes(n.key)))}
              >
                {n.key}
              </button>
            ))}
          </div>
          {hasNatureSel && (
            <div
              style={css(
                "margin-top:9px;background:#FEF7EC;border:1px solid #F6D89A;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:9px;"
              )}
            >
              {natureSel.map((n) => (
                <div key={n.key} style={css("display:flex;gap:9px;align-items:flex-start;")}>
                  <span
                    style={css(
                      "flex:none;background:#F5A623;color:#3B2200;font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;white-space:nowrap;"
                    )}
                  >
                    {n.key}
                  </span>
                  <span style={css("font-size:12.5px;color:#92400E;line-height:1.5;")}>{n.desc}</span>
                </div>
              ))}
            </div>
          )}
          {showNatureOther && (
            <>
              <HInput
                value={f.error_nature_other}
                onChange={(e) => setField("error_nature_other", e.target.value)}
                placeholder="ระบุลักษณะเพิ่มเติม…"
                base="width:100%;box-sizing:border-box;margin-top:8px;border:1.5px solid #DCE7E5;border-radius:11px;padding:11px 14px;font-size:15px;color:#0F172A;background:#fff;outline:none;"
                focus={INPUT_FOCUS}
              />
              {S.errors.error_nature_other && (
                <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาระบุลักษณะเพิ่มเติม</div>
              )}
            </>
          )}
          {S.errors.error_nature && (
            <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาเลือกลักษณะความคลาดเคลื่อน</div>
          )}
          {S.showNatureLegend && (
            <div
              style={css(
                "margin-top:10px;background:#FBFDFC;border:1px solid #E3EFEC;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;"
              )}
            >
              <div style={css("font-size:12.5px;font-weight:700;color:#0B655D;")}>ความหมายลักษณะความคลาดเคลื่อน</div>
              {ERROR_NATURE.map((n) => (
                <div key={n.key} style={css("display:flex;gap:10px;align-items:flex-start;")}>
                  <span
                    style={css(
                      "flex:none;background:#F5A623;color:#3B2200;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;white-space:nowrap;"
                    )}
                  >
                    {n.key}
                  </span>
                  <span style={css("font-size:12.5px;color:#475569;line-height:1.45;padding-top:2px;")}>{n.desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ระดับความรุนแรง A–I (ใช้ช่องร่วมกับ DRP) */}
        {renderSeverityField()}

        {/* ชื่อยา */}
        <div style={css("margin-bottom:16px;")}>
          <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
            ชื่อยาที่เกี่ยวข้อง <span style={css("color:#94A3B8;font-weight:400;")}>เพิ่มได้หลายตัว</span>
          </label>
          {renderDrugRows()}
        </div>

        {/* รายละเอียด */}
        <div style={css("margin-bottom:16px;")}>
          <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
            รายละเอียดเหตุการณ์ <span style={css("color:#DC2626;")}>*</span>
          </label>
          <HTextarea
            value={f.detail}
            onChange={(e) => setField("detail", e.target.value)}
            rows={3}
            placeholder="พิมพ์คร่าว ๆ ว่าเกิดอะไรขึ้น…"
            base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:12px 14px;font-size:15px;color:#0F172A;background:#fff;outline:none;resize:vertical;line-height:1.55;"
            focus={INPUT_FOCUS}
          />
          {S.errors.detail && (
            <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณากรอกรายละเอียดเหตุการณ์</div>
          )}
        </div>
        <div style={css("margin-bottom:18px;")}>
          <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>การแก้ไข / จัดการ</label>
          {/* ติ๊กพอ = ถือว่าจัดการเรียบร้อย (บางเคสไม่มีอะไรต้องบรรยาย) · จะพิมพ์รายละเอียดเพิ่มด้วยก็ได้ */}
          <HButton
            onClick={() => setField("managed", !f.managed)}
            base={
              "width:100%;box-sizing:border-box;display:flex;align-items:center;gap:10px;text-align:left;margin-bottom:8px;padding:11px 14px;border-radius:11px;font-size:14.5px;font-weight:600;cursor:pointer;transition:all .15s;" +
              (f.managed
                ? "border:1.5px solid #0F8A80;background:#E8F5F3;color:#0B655D;"
                : "border:1.5px solid #DCE7E5;background:#fff;color:#64748B;")
            }
            hover={f.managed ? "background:#DDEFEC;" : "border-color:#0F8A80;color:#0F8A80;"}
          >
            <span
              style={css(
                "width:20px;height:20px;flex:0 0 20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;" +
                  (f.managed ? "background:#0F8A80;color:#fff;" : "background:#fff;border:1.5px solid #CBD5E1;color:transparent;")
              )}
            >
              ✓
            </span>
            แก้ไขเรียบร้อยแล้ว
          </HButton>
          <HTextarea
            value={f.management}
            onChange={(e) => setField("management", e.target.value)}
            rows={2}
            placeholder="ดำเนินการอย่างไรต่อ… (จะพิมพ์เพิ่มหรือไม่ก็ได้)"
            base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:12px 14px;font-size:15px;color:#0F172A;background:#fff;outline:none;resize:vertical;line-height:1.55;"
            focus={INPUT_FOCUS}
          />
        </div>
      </div>
    );
  }

  function renderDrpFields() {
    const showDrpOther = f.drp_type === "อื่น ๆ";
    return (
      <div>
        <div style={css("margin-bottom:16px;")}>
          <div style={css("display:flex;align-items:center;margin-bottom:8px;gap:8px;")}>
            <label style={css("font-size:13px;font-weight:600;color:#475569;")}>
              ประเภทปัญหาจากการใช้ยา (DRP) <span style={css("color:#DC2626;")}>*</span>
            </label>
            <HButton
              onClick={() => setState((st) => ({ showDrpLegend: !st.showDrpLegend }))}
              base="margin-left:auto;border:1px solid #F6D89A;background:#FEF7EC;color:#B45309;font-size:12px;font-weight:600;padding:4px 11px;border-radius:999px;cursor:pointer;display:flex;align-items:center;gap:5px;white-space:nowrap;"
              hover="background:#FDEFD6"
            >
              ⓘ {S.showDrpLegend ? "ซ่อนความหมาย" : "ดูความหมาย"}
            </HButton>
          </div>
          {/* ความหมายฉบับเต็มทั้ง 10 หมวด — รูปแบบเดียวกับฝั่ง Med Error */}
          {S.showDrpLegend && (
            <div
              style={css(
                "margin-bottom:10px;background:#FBFDFC;border:1px solid #E3EFEC;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:9px;"
              )}
            >
              <div style={css("font-size:12.5px;font-weight:700;color:#0B655D;")}>ความหมายประเภทปัญหาจากการใช้ยา (DRP)</div>
              {DRP_TYPES.map((t) => (
                <div key={t.key} style={css("display:flex;flex-direction:column;gap:2px;")}>
                  <span style={css("font-size:12.5px;font-weight:700;color:#0B655D;")}>{t.label || t.key}</span>
                  <span style={css("font-size:12.5px;color:#475569;line-height:1.45;")}>{t.desc}</span>
                </div>
              ))}
            </div>
          )}
          <div style={css("display:flex;flex-wrap:wrap;gap:8px;")}>
            {DRP_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setDrpType(t.key)}
                style={css(chip(f.drp_type === t.key))}
              >
                {t.label || t.key}
              </button>
            ))}
          </div>
          {drpObj && (
            <div
              style={css(
                "margin-top:9px;background:#FEF7EC;border:1px solid #F6D89A;border-radius:10px;padding:9px 12px;font-size:13px;color:#92400E;line-height:1.5;"
              )}
            >
              {drpObj.desc}
            </div>
          )}
          {showDrpOther && (
            <>
              <HInput
                value={f.drp_type_other}
                onChange={(e) => setField("drp_type_other", e.target.value)}
                placeholder="ระบุปัญหา DRP เพิ่มเติม…"
                base="width:100%;box-sizing:border-box;margin-top:8px;border:1.5px solid #DCE7E5;border-radius:11px;padding:11px 14px;font-size:15px;color:#0F172A;background:#fff;outline:none;"
                focus={INPUT_FOCUS}
              />
              {S.errors.drp_type_other && (
                <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาระบุรายละเอียดปัญหา DRP</div>
              )}
            </>
          )}
          {S.errors.drp_type && (
            <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาเลือกประเภทปัญหา DRP</div>
          )}
        </div>

        <div style={css("margin-bottom:16px;")}>
          <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
            ยาที่เกี่ยวข้อง <span style={css("color:#94A3B8;font-weight:400;")}>เพิ่มได้หลายตัว</span>
          </label>
          {renderDrugRows()}
        </div>

        {/* ยุบ "สาเหตุของปัญหา" + "รายละเอียดเพิ่มเติม" เหลือช่องเดียว — เดิมซ้ำซ้อน คนกรอกงงว่าอะไรลงช่องไหน
            ยังเก็บลงคอลัมน์ cause เหมือนเดิม เคสเก่าจึงอ่านได้ตามปกติ */}
        <div style={css("margin-bottom:16px;")}>
          <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
            รายละเอียดเหตุการณ์ / สาเหตุ <span style={css("color:#DC2626;")}>*</span>
          </label>
          <HTextarea
            value={f.cause}
            onChange={(e) => setField("cause", e.target.value)}
            rows={3}
            placeholder="เล่าว่าพบปัญหาอะไร และเกิดจากอะไร…"
            base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:12px 14px;font-size:15px;color:#0F172A;background:#fff;outline:none;resize:vertical;line-height:1.55;"
            focus={INPUT_FOCUS}
          />
          {S.errors.cause && (
            <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณากรอกรายละเอียดเหตุการณ์ / สาเหตุ</div>
          )}
        </div>

        {/* ระดับความรุนแรง A–I — DRP ก็ให้เลือกได้เหมือน ME (บังคับกรอก) · บรรยายเหตุการณ์เสร็จ → ให้คะแนนความรุนแรง */}
        {renderSeverityField()}

        {/* เภสัชกรจัดการเอง → ไม่ได้เสนอแพทย์ จึงไม่มีผลตอบรับจากแพทย์ (ซ่อนช่อง + ล้างค่าเดิม) */}
        <div style={css("margin-bottom:16px;")}>
          <HButton
            onClick={() => {
              const next = !f.pharmacist_only;
              setField("pharmacist_only", next);
              if (next) setField("outcome", "");
            }}
            base={
              "width:100%;box-sizing:border-box;display:flex;align-items:center;gap:10px;text-align:left;padding:11px 14px;border-radius:11px;font-size:14.5px;font-weight:600;cursor:pointer;transition:all .15s;" +
              (f.pharmacist_only
                ? "border:1.5px solid #F5A623;background:#FEF7EC;color:#B45309;"
                : "border:1.5px solid #DCE7E5;background:#fff;color:#64748B;")
            }
            hover={f.pharmacist_only ? "background:#FDEFD6;" : "border-color:#F5A623;color:#B45309;"}
          >
            <span
              style={css(
                "width:20px;height:20px;flex:0 0 20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;" +
                  (f.pharmacist_only ? "background:#F5A623;color:#3B2200;" : "background:#fff;border:1.5px solid #CBD5E1;color:transparent;")
              )}
            >
              ✓
            </span>
            เภสัชกรแก้ไขเอง ไม่ผ่านแพทย์
          </HButton>
        </div>

        <div style={css("margin-bottom:16px;")}>
          <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
            การแก้ไข (Intervention) <span style={css("color:#DC2626;")}>*</span>
          </label>
          <HSelect
            value={f.intervention}
            onChange={(e) => {
              const v = e.target.value;
              setField("intervention", v);
              // เปลี่ยนไปการแก้ไขที่ไม่ได้เสนอแพทย์ → ล้างผลตอบรับที่เคยเลือกไว้ ไม่ให้ค้างติดไปกับเคส
              if (v !== CONSULT_DOCTOR) setField("outcome", "");
            }}
            base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:12px 40px 12px 14px;font-size:15px;color:#0F172A;background-color:#fff;outline:none;"
            focus={INPUT_FOCUS}
          >
            {/* ค่าเริ่มต้นต้องว่าง — เดิมค้างค่าแรกไว้ ทำให้บันทึกค่าที่ไม่ได้ตั้งใจเลือก */}
            <option value="">— เลือกการแก้ไข —</option>
            {INTERVENTIONS.map((iv) => (
              <option key={iv} value={iv}>
                {iv}
              </option>
            ))}
          </HSelect>
          {S.errors.intervention && (
            <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาเลือกการแก้ไข</div>
          )}
        </div>

        {/* ผลตอบรับจากแพทย์ = มีเฉพาะเมื่อเลือกการแก้ไขแบบ "ปรึกษาแพทย์ผู้สั่งใช้" (และไม่ได้ติ๊กว่าเภสัชกรแก้เอง) */}
        {!f.pharmacist_only && f.intervention === CONSULT_DOCTOR && (
          <div style={css("margin-bottom:16px;")}>
            <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:8px;")}>
              ผลตอบรับจากแพทย์ <span style={css("color:#DC2626;")}>*</span>
            </label>
            <div style={css("display:flex;gap:8px;flex-wrap:wrap;")}>
              {OUTCOMES.map((o) => (
                <button
                  key={o.key}
                  onClick={() => setField("outcome", f.outcome === o.key ? "" : o.key)}
                  style={css(chip(f.outcome === o.key))}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {S.errors.outcome && (
              <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาเลือกผลตอบรับจากแพทย์</div>
            )}
          </div>
        )}

        {/* รายละเอียดการจัดการ — ใช้คอลัมน์ management ร่วมกับฝั่ง Med Error · ไม่บังคับกรอก · อยู่ล่างสุด */}
        <div style={css("margin-bottom:18px;")}>
          <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>การแก้ไข / จัดการ</label>
          <HTextarea
            value={f.management}
            onChange={(e) => setField("management", e.target.value)}
            rows={2}
            placeholder="ดำเนินการอย่างไรต่อ… (จะพิมพ์เพิ่มหรือไม่ก็ได้)"
            base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:12px 14px;font-size:15px;color:#0F172A;background:#fff;outline:none;resize:vertical;line-height:1.55;"
            focus={INPUT_FOCUS}
          />
        </div>
      </div>
    );
  }

  // ---------------- DASHBOARD ----------------
  function renderDashboard() {
    return (
      <div style={css("max-width:1140px;margin:0 auto;padding:24px 18px 70px;")}>
        <div style={css("display:flex;align-items:flex-end;flex-wrap:wrap;gap:14px;margin-bottom:16px;")}>
          <div>
            <div style={css("font-size:24px;font-weight:700;color:#0B655D;")}>ภาพรวมข้อมูล</div>
            <div style={css("font-size:13px;color:#64748B;margin-top:2px;")}>
              Med Error &amp; DRP · {orgName} · <span style={css("color:#0F8A80;font-weight:600;")}>{rangeLabel}</span>
            </div>
          </div>
          <div
            className="no-print"
            style={css("margin-left:auto;display:flex;gap:6px;background:#E3F0ED;padding:4px;border-radius:11px;align-items:center;")}
          >
            <button onClick={() => setState({ dashType: "all" })} style={css(filt(S.dashType === "all"))}>
              ทั้งหมด
            </button>
            <button onClick={() => setState({ dashType: "med" })} style={css(filt(S.dashType === "med"))}>
              Med Error
            </button>
            <button onClick={() => setState({ dashType: "drp" })} style={css(filt(S.dashType === "drp"))}>
              DRP
            </button>
            <button
              onClick={() => exportCsv(recs)}
              style={css("margin-left:4px;border:none;background:#0B655D;color:#fff;font-size:13px;font-weight:600;padding:8px 14px;border-radius:9px;cursor:pointer;")}
            >
              ↓ CSV
            </button>
            <button
              onClick={() => {
                try {
                  window.print();
                } catch {}
              }}
              style={css("border:none;background:#F5A623;color:#3B2200;font-size:13px;font-weight:700;padding:8px 14px;border-radius:9px;cursor:pointer;")}
            >
              🖨 พิมพ์สรุป
            </button>
          </div>
        </div>

        {/* range selector */}
        <div className="no-print" style={css("display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:20px;")}>
          <span style={css("font-size:13px;color:#64748B;font-weight:600;margin-right:2px;")}>ช่วงเวลา:</span>
          <div style={css("display:flex;gap:6px;background:#EAF3F1;padding:4px;border-radius:11px;")}>
            <button onClick={() => setDashPreset("all")} style={css(filt(dr.preset === "all"))}>
              ทั้งหมด
            </button>
            <button onClick={() => setDashPreset("month")} style={css(filt(dr.preset === "month"))}>
              เดือนนี้
            </button>
            <button onClick={() => setDashPreset("quarter")} style={css(filt(dr.preset === "quarter"))}>
              ไตรมาส
            </button>
            <button onClick={() => setDashPreset("year")} style={css(filt(dr.preset === "year"))}>
              ปีนี้
            </button>
            <button onClick={() => setDashPreset("custom")} style={css(filt(dr.preset === "custom"))}>
              กำหนดเอง
            </button>
          </div>
          {dr.preset === "custom" && (
            <div style={css("display:flex;gap:6px;align-items:center;")}>
              <HInput
                type="date"
                value={dr.from}
                onChange={(e) => setState((s) => ({ dashRange: { ...s.dashRange, preset: "custom", from: e.target.value } }))}
                base="border:1.5px solid #DCE7E5;border-radius:9px;padding:7px 11px;font-size:13px;outline:none;"
                focus="border:1.5px solid #F5A623"
              />
              <span style={css("color:#94A3B8;font-size:13px;")}>ถึง</span>
              <HInput
                type="date"
                value={dr.to}
                onChange={(e) => setState((s) => ({ dashRange: { ...s.dashRange, preset: "custom", to: e.target.value } }))}
                base="border:1.5px solid #DCE7E5;border-radius:9px;padding:7px 11px;font-size:13px;outline:none;"
                focus="border:1.5px solid #F5A623"
              />
            </div>
          )}
        </div>

        {/* KPI */}
        <div style={css("display:grid;grid-template-columns:" + (isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)") + ";gap:" + (isMobile ? "10px" : "14px") + ";margin-bottom:16px;")}>
          {kpis.map((k) => (
            <HDiv
              key={k.label}
              onMouseEnter={() => animateKpi(k.idx, tg[k.idx])}
              base="background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:16px 18px;cursor:default;transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease;"
              hover="transform:translateY(-4px);box-shadow:0 14px 30px -14px rgba(11,101,93,.45);border-color:#F5A623"
            >
              <div style={css("font-size:12.5px;color:#64748B;font-weight:500;")}>{k.label}</div>
              <div style={css("font-size:30px;font-weight:700;color:#0B655D;line-height:1.2;margin-top:4px;")}>{k.value}</div>
              <div style={css("font-size:12px;color:#B45309;font-weight:600;margin-top:2px;")}>{k.sub}</div>
            </HDiv>
          ))}
        </div>

        {/* month + severity */}
        <div style={css("display:grid;grid-template-columns:" + (isMobile ? "1fr" : "1.3fr 1fr") + ";gap:14px;margin-bottom:16px;")}>
          <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;")}>
            <div style={css("display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px;")}>
              <div style={css("font-size:15px;font-weight:700;color:#0B655D;")}>จำนวนเคสรายเดือน · ปี {selYear + 543}</div>
              {/* ปุ่มเลือกปี (พ.ศ.) — โชว์เฉพาะปีที่มีข้อมูล + ปีปัจจุบัน */}
              <div style={css("display:flex;gap:6px;flex-wrap:wrap;")}>
                {yearOpts.map((y) => {
                  const on = y === selYear;
                  return (
                    <button
                      key={y}
                      onClick={() => setState({ dashYear: y })}
                      style={css(
                        "border:none;cursor:pointer;font-size:12.5px;font-weight:700;padding:5px 11px;border-radius:8px;" +
                          (on ? "background:#0B655D;color:#fff;" : "background:#EAF4F1;color:#0B655D;")
                      )}
                    >
                      {y + 543}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={css("display:flex;align-items:flex-end;gap:" + (isMobile ? "3px" : "6px") + ";height:150px;padding-top:6px;")}>
              {monthBars.map((b, i) => (
                <div key={i} style={css("flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:5px;")}>
                  <div style={css("font-size:" + (isMobile ? "9.5px" : "11px") + ";font-weight:700;color:#0B655D;")}>{b.count}</div>
                  <HDiv base={b.barStyle} hover="filter:brightness(1.14)" />
                  <div style={css("font-size:" + (isMobile ? "8.5px" : "10px") + ";color:#64748B;")}>{b.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;")}>
            <div style={css("font-size:15px;font-weight:700;color:#0B655D;margin-bottom:16px;")}>ระดับความรุนแรง (NCC MERP)</div>
            <div style={css("display:flex;align-items:flex-end;gap:5px;height:120px;")}>
              {sevBars.map((s) => (
                <div key={s.code} style={css("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:4px;")}>
                  <div style={css("font-size:11px;font-weight:700;color:#0B655D;")}>{s.count}</div>
                  <HDiv base={s.barStyle} hover="filter:brightness(1.12)" />
                  <div style={css("font-size:11px;color:#64748B;font-weight:600;")}>{s.code}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* type break + top drugs */}
        <div style={css("display:grid;grid-template-columns:" + (isMobile ? "1fr" : "1fr 1fr") + ";gap:14px;margin-bottom:16px;")}>
          <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;")}>
            <div style={css("font-size:15px;font-weight:700;color:#0B655D;margin-bottom:14px;")}>{breakTitle}</div>
            {renderBarList(typeBreak.map((t) => ({ label: t.label, count: t.count, barStyle: t.barStyle })))}
          </div>
          <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;")}>
            <div style={css("font-size:15px;font-weight:700;color:#0B655D;margin-bottom:14px;")}>ยาที่พบปัญหาบ่อยที่สุด</div>
            {renderBarList(topDrugs.map((d) => ({ label: d.name, count: d.count, barStyle: d.barStyle })))}
          </div>
        </div>

        {/* intervention outcome */}
        <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;margin-bottom:16px;")}>
          <div style={css("font-size:15px;font-weight:700;color:#0B655D;margin-bottom:14px;")}>ผลตอบรับจากแพทย์ (DRP)</div>
          <div style={css("display:grid;grid-template-columns:repeat(3,1fr);gap:12px;")}>
            {interv.map((i) => (
              <div key={i.label} style={css(i.cardStyle)}>
                <div style={css("font-size:26px;font-weight:700;")}>{i.count}</div>
                <div style={css("font-size:12.5px;font-weight:500;margin-top:2px;")}>{i.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* loc + shift */}
        <div style={css("display:grid;grid-template-columns:" + (isMobile ? "1fr" : "1fr 1fr") + ";gap:14px;margin-bottom:16px;")}>
          <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;")}>
            <div style={css("font-size:15px;font-weight:700;color:#0B655D;margin-bottom:14px;")}>แยกตามจุดที่พบ (OPD)</div>
            {renderBarList(locBreak.map((t) => ({ label: t.label, count: t.count, barStyle: t.barStyle })))}
          </div>
          <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;")}>
            <div style={css("font-size:15px;font-weight:700;color:#0B655D;margin-bottom:14px;")}>แยกตามช่วงเวร</div>
            {renderBarList(shiftBreak.map((t) => ({ label: t.label, count: t.count, barStyle: t.barStyle })))}
          </div>
        </div>

        {/* แยกตามผู้รายงาน — สีสดคนละสีต่อคน เรียงมากไปน้อย */}
        <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;margin-bottom:16px;")}>
          <div style={css("display:flex;align-items:baseline;gap:8px;margin-bottom:14px;")}>
            <div style={css("font-size:15px;font-weight:700;color:#0B655D;")}>แยกตามผู้รายงาน</div>
            <div style={css("font-size:12.5px;color:#94A3B8;")}>{reporterBreak.length} คน · เรียงจากมากไปน้อย</div>
          </div>
          {reporterBreak.length ? (
            renderBarList(
              reporterBreak.map((t) => ({ label: t.label, count: t.count, barStyle: t.barStyle })),
              10
            )
          ) : (
            <div style={css("padding:14px;text-align:center;color:#94A3B8;font-size:13.5px;")}>ยังไม่มีข้อมูลในช่วงเวลาที่เลือก</div>
          )}
        </div>

        {/* nature + near miss / HA / LASA */}
        <div style={css("display:grid;grid-template-columns:" + (isMobile ? "1fr" : "1.4fr 1fr") + ";gap:14px;margin-bottom:16px;")}>
          <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;")}>
            <div style={css("font-size:15px;font-weight:700;color:#0B655D;margin-bottom:14px;")}>ลักษณะความคลาดเคลื่อน (Med Error)</div>
            {renderBarList(natureBreak.map((t) => ({ label: t.label, count: t.count, barStyle: t.barStyle })), 10)}
          </div>
          <div style={css("display:flex;flex-direction:column;gap:12px;")}>
            <div style={css("background:#EAF6EF;border:1px solid #CBEAD6;border-radius:15px;padding:16px 18px;")}>
              <div style={css("font-size:12.5px;color:#15803D;font-weight:600;")}>Near miss (A–B: ยังไม่ถึงผู้ป่วย)</div>
              <div style={css("font-size:30px;font-weight:700;color:#15803D;line-height:1.2;margin-top:4px;")}>{nearMissPct}%</div>
              <div style={css("font-size:12px;color:#3F8F5F;margin-top:2px;")}>
                {nmN} จาก {medRecs2.length} เคส Med Error
              </div>
            </div>
            <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:12px;")}>
              <div style={css("background:#FEF3E5;border:1px solid #F5D6A6;border-radius:15px;padding:16px 18px;")}>
                <div style={css("font-size:12.5px;color:#B45309;font-weight:600;")}>⚠ High-alert</div>
                <div style={css("font-size:28px;font-weight:700;color:#B45309;line-height:1.2;margin-top:4px;")}>{haCount}</div>
                <div style={css("font-size:11.5px;color:#C2620E;")}>เคส</div>
              </div>
              <div style={css("background:#FDEBEB;border:1px solid #F3C5C2;border-radius:15px;padding:16px 18px;")}>
                <div style={css("font-size:12.5px;color:#B42318;font-weight:600;")}>🔁 LASA</div>
                <div style={css("font-size:28px;font-weight:700;color:#B42318;line-height:1.2;margin-top:4px;")}>{laCount}</div>
                <div style={css("font-size:11.5px;color:#C0453C;")}>เคส</div>
              </div>
            </div>
          </div>
        </div>

        {/* heatmap เวร × วันในสัปดาห์ */}
        <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;margin-bottom:16px;")}>
          <div style={css("font-size:15px;font-weight:700;color:#0B655D;")}>ช่วงเวลาที่เกิดเหตุบ่อย</div>
          <div style={css("font-size:12.5px;color:#64748B;margin-top:2px;margin-bottom:14px;")}>
            เวร × วันในสัปดาห์ · สีเข้ม = เกิดบ่อย{hmTotal === 0 ? " · ยังไม่มีข้อมูลในช่วงนี้" : ""}
          </div>
          <div style={css("display:grid;grid-template-columns:46px repeat(7,1fr);gap:5px;")}>
            <div />
            {HM_DAYS.map((d) => (
              <div key={"h" + d} style={css("font-size:11px;color:#64748B;text-align:center;font-weight:600;padding-bottom:2px;")}>
                {d}
              </div>
            ))}
            {SHIFTS.map((s, ri) => (
              <React.Fragment key={s}>
                <div style={css("font-size:12px;color:#475569;font-weight:600;display:flex;align-items:center;")}>{s.replace("เวร", "")}</div>
                {HM_DAYS.map((d, ci) => {
                  const v = hmMatrix[ri][ci];
                  return (
                    <div
                      key={s + d}
                      title={s + " · " + d + " · " + v + " เคส"}
                      style={css(
                        "aspect-ratio:1/1;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;background:" +
                          hmColor(v) +
                          ";color:" +
                          (v / hmMax > 0.6 ? "#EAF6F3" : "#0B655D") +
                          ";"
                      )}
                    >
                      {v || ""}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <div style={css("display:flex;align-items:center;gap:6px;margin-top:12px;font-size:11px;color:#64748B;")}>
            <span>น้อย</span>
            {["#EAF6F3", "#BFE3DA", "#7FC7B8", "#3DA593", "#0B655D"].map((c) => (
              <span key={c} style={css("width:18px;height:12px;border-radius:3px;display:inline-block;background:" + c + ";")} />
            ))}
            <span>มาก</span>
          </div>
        </div>

        {/* recent table */}
        <div className="no-print" style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;")}>
          <div style={css("display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;")}>
            <div style={css("font-size:15px;font-weight:700;color:#0B655D;")}>รายงานล่าสุด</div>
            <HInput
              value={S.search}
              onChange={(e) => setState({ search: e.target.value })}
              placeholder="ค้นหา ยา / HN / ผู้รายงาน / ประเภท…"
              base="margin-left:auto;width:280px;max-width:100%;border:1.5px solid #DCE7E5;border-radius:10px;padding:9px 13px;font-size:14px;outline:none;"
              focus={INPUT_FOCUS}
            />
          </div>
          {isMobile ? (
            <div style={css("display:flex;flex-direction:column;gap:9px;")}>
              {recent.map((r, i) => (
                <div key={i} style={css("border:1px solid #EAF3F1;border-radius:12px;padding:11px 13px;")}>
                  <div style={css("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;")}>
                    <span style={css(r.badgeStyle)}>{r.typeLabel}</span>
                    <span style={css("font-size:13px;color:#0F172A;font-weight:600;")}>{r.date}</span>
                    {r.severity && r.severity !== "—" ? (
                      <span style={css("margin-left:auto;font-size:12.5px;color:#B45309;font-weight:600;")}>ระดับ {r.severity}</span>
                    ) : null}
                  </div>
                  <div style={css("font-size:12.5px;color:#475569;line-height:1.55;")}>
                    <div>
                      <span style={css("color:#94A3B8;")}>HN</span> {r.hn}
                      {r.cat ? " · " + r.cat : ""}
                    </div>
                    {r.drug ? <div>{r.drug}</div> : null}
                    <div>
                      <span style={css("color:#94A3B8;")}>ผู้รายงาน</span> {r.reporter}
                    </div>
                  </div>
                </div>
              ))}
              {recentFiltered.length === 0 && (
                <div style={css("padding:26px;text-align:center;color:#94A3B8;font-size:14px;")}>ไม่พบรายงาน</div>
              )}
            </div>
          ) : (
            <div style={css("overflow-x:auto;")}>
              <table style={css("width:100%;border-collapse:collapse;font-size:13px;min-width:760px;")}>
                <thead>
                  <tr style={css("text-align:left;color:#64748B;border-bottom:1.5px solid #EAF3F1;")}>
                    {["วันที่", "ประเภท", "HN", "หมวด", "ระดับ", "ยา", "ผู้รายงาน"].map((h) => (
                      <th key={h} style={css("padding:8px 10px;font-weight:600;")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r, i) => (
                    <tr key={i} style={css("border-bottom:1px solid #F1F6F5;")}>
                      <td style={css("padding:9px 10px;color:#0F172A;white-space:nowrap;")}>{r.date}</td>
                      <td style={css("padding:9px 10px;")}>
                        <span style={css(r.badgeStyle)}>{r.typeLabel}</span>
                      </td>
                      <td style={css("padding:9px 10px;color:#475569;")}>{r.hn}</td>
                      <td style={css("padding:9px 10px;color:#334155;")}>{r.cat}</td>
                      <td style={css("padding:9px 10px;color:#B45309;font-weight:600;")}>{r.severity}</td>
                      <td style={css("padding:9px 10px;color:#334155;")}>{r.drug}</td>
                      <td style={css("padding:9px 10px;color:#475569;")}>{r.reporter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recentFiltered.length === 0 && (
                <div style={css("padding:26px;text-align:center;color:#94A3B8;font-size:14px;")}>ไม่พบรายงาน</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderBarList(items: { label: string; count: number; barStyle: string }[], gap = 11) {
    const total = items.reduce((a, b) => a + b.count, 0);
    return (
      <div style={css("display:flex;flex-direction:column;gap:" + gap + "px;")}>
        {items.map((t, i) => {
          const pct = total ? Math.round((t.count / total) * 100) : 0;
          return (
            <div key={i}>
              <div style={css("display:flex;justify-content:space-between;align-items:baseline;font-size:13px;margin-bottom:5px;")}>
                <span style={css("color:#334155;")}>{t.label}</span>
                <span>
                  <span style={css("color:#0B655D;font-weight:700;")}>{t.count}</span>
                  <span style={css("color:#94A3B8;font-weight:500;font-size:12px;margin-left:6px;")}>{pct}%</span>
                </span>
              </div>
              <div style={css("height:10px;background:#EAF3F1;border-radius:999px;overflow:hidden;")}>
                <div style={css(t.barStyle)} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ---------------- RECORDS ----------------
  function renderRecords() {
    return (
      <div style={css("max-width:1180px;margin:0 auto;padding:24px 18px 70px;")}>
        <div style={css("display:flex;align-items:flex-end;flex-wrap:wrap;gap:14px;margin-bottom:18px;")}>
          <div>
            <div style={css("font-size:24px;font-weight:700;color:#0B655D;")}>รายงานทั้งหมด</div>
            <div style={css("font-size:13px;color:#64748B;margin-top:2px;")}>
              แสดง {rlist.length} จาก {(S.records || []).length} รายงาน
            </div>
          </div>
          <div style={css("margin-left:auto;display:flex;gap:8px;")}>
            <HButton
              onClick={() => setState({ rf: emptyFilter() })}
              base="border:1.5px solid #DCE7E5;background:#fff;color:#475569;font-size:13px;font-weight:600;padding:9px 15px;border-radius:10px;cursor:pointer;"
              hover="border-color:#F5A623;color:#B45309"
            >
              ล้างตัวกรอง
            </HButton>
            <button
              onClick={() => exportCsv(rlist)}
              style={css("border:none;background:#0B655D;color:#fff;font-size:13px;font-weight:600;padding:9px 16px;border-radius:10px;cursor:pointer;")}
            >
              ↓ Export CSV
            </button>
          </div>
        </div>

        {/* filter bar */}
        <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:16px 18px;margin-bottom:16px;")}>
          <div style={css("display:flex;gap:6px;background:#EAF3F1;padding:4px;border-radius:11px;width:fit-content;margin-bottom:14px;")}>
            <button onClick={() => setRF("type", "all")} style={css(filt(rf.type === "all"))}>
              ทั้งหมด
            </button>
            <button onClick={() => setRF("type", "med")} style={css(filt(rf.type === "med"))}>
              Med Error
            </button>
            <button onClick={() => setRF("type", "drp")} style={css(filt(rf.type === "drp"))}>
              DRP
            </button>
          </div>
          <div style={css("display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;")}>
            {renderFilterField("ค้นหา", (
              <HInput
                value={rf.q}
                onChange={(e) => setRF("q", e.target.value)}
                placeholder="ยา / HN / ข้อความ…"
                base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:9px 12px;font-size:14px;outline:none;"
                focus={INPUT_FOCUS}
              />
            ))}
            {renderFilterField("จุดที่พบ", renderFilterSelect(rf.location, (v) => setRF("location", v), LOCATIONS))}
            {renderFilterField("ประเภท Error", renderFilterSelect(rf.error_type, (v) => setRF("error_type", v), errorTypeOpts))}
            {renderFilterField("ระดับ NCC MERP", renderFilterSelect(rf.severity, (v) => setRF("severity", v), severityOpts))}
            {renderFilterField("ประเภท DRP", renderFilterSelect(rf.drp_type, (v) => setRF("drp_type", v), drpTypeOpts))}
            {renderFilterField(
              "ผลตอบรับจากแพทย์",
              <select
                value={rf.outcome}
                onChange={(e) => setRF("outcome", e.target.value)}
                style={css("width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:9px 32px 9px 12px;font-size:14px;background-color:#fff;outline:none;")}
              >
                <option value="">ทั้งหมด</option>
                {outcomeOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            {renderFilterField("ผู้รายงาน", renderFilterSelect(rf.reporter, (v) => setRF("reporter", v), reporterOpts))}
            {renderFilterField(
              "ตั้งแต่วันที่",
              <HInput
                type="date"
                value={rf.from}
                onChange={(e) => setRF("from", e.target.value)}
                base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:8px 12px;font-size:14px;outline:none;"
                focus={INPUT_FOCUS}
              />
            )}
            {renderFilterField(
              "ถึงวันที่",
              <HInput
                type="date"
                value={rf.to}
                onChange={(e) => setRF("to", e.target.value)}
                base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:8px 12px;font-size:14px;outline:none;"
                focus={INPUT_FOCUS}
              />
            )}
          </div>
        </div>

        {/* รายการ: การ์ด (มือถือ) / ตาราง (เดสก์ท็อป) */}
        {isMobile ? (
          <div style={css("display:flex;flex-direction:column;gap:10px;")}>
            {recRows.map((r, i) => (
              <div
                key={i}
                onClick={() => setState({ detail: r.r })}
                style={css("background:#fff;border:1px solid #DEEBE8;border-radius:14px;padding:13px 15px;cursor:pointer;box-shadow:0 1px 3px rgba(11,101,93,.06);")}
              >
                <div style={css("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;")}>
                  <span style={css(r.badgeStyle)}>{r.typeLabel}</span>
                  <span style={css("font-size:13px;color:#0F172A;font-weight:600;")}>{r.date}</span>
                  {r.edited && (
                    <span style={css("background:#FEF7EC;color:#B45309;font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px;")}>
                      ✎ แก้ไข
                    </span>
                  )}
                  <span style={css("margin-left:auto;font-size:13px;color:#0F8A80;font-weight:600;white-space:nowrap;")}>ดู →</span>
                </div>
                <div style={css("font-size:13px;color:#334155;line-height:1.6;")}>
                  <div>
                    <span style={css("color:#94A3B8;")}>HN</span> {r.hn}
                    {r.place ? " · " + r.place : ""}
                  </div>
                  {r.cat ? (
                    <div>
                      <span style={css("color:#94A3B8;")}>หมวด</span> {r.cat}
                    </div>
                  ) : null}
                  {r.severity || r.drug ? (
                    <div>
                      {r.severity ? <span style={css("color:#B45309;font-weight:600;")}>ระดับ {r.severity}</span> : null}
                      {r.severity && r.drug ? " · " : ""}
                      {r.drug || ""}
                    </div>
                  ) : null}
                  <div>
                    <span style={css("color:#94A3B8;")}>ผู้รายงาน</span> {r.reporter}
                  </div>
                  {r.detailText ? (
                    <div style={css("margin-top:5px;padding-top:6px;border-top:1px dashed #E3EFEC;color:#475569;")}>
                      <span style={css("color:#94A3B8;")}>รายละเอียด</span> {r.detailText}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {rlist.length === 0 && (
              <div style={css("padding:34px;text-align:center;color:#94A3B8;font-size:14px;background:#fff;border:1px solid #DEEBE8;border-radius:14px;")}>
                ไม่พบรายงานตามเงื่อนไข
              </div>
            )}
          </div>
        ) : (
          <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:8px 8px 12px;")}>
            <div style={css("overflow-x:auto;")}>
              <table style={css("width:100%;border-collapse:collapse;font-size:13px;min-width:1040px;")}>
                <thead>
                  <tr style={css("text-align:left;color:#64748B;border-bottom:1.5px solid #EAF3F1;")}>
                    {["วันที่", "ประเภท", "HN", "จุดที่พบ", "หมวด", "ระดับ", "ยา", "รายละเอียด", "ผู้รายงาน", ""].map((h, i) => (
                      <th key={i} style={css("padding:10px 12px;font-weight:600;")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recRows.map((r, i) => (
                    <HTr
                      key={i}
                      onClick={() => setState({ detail: r.r })}
                      base="border-bottom:1px solid #F1F6F5;cursor:pointer;transition:background .12s;"
                      hover="background:#F5FAF9"
                    >
                      <td style={css("padding:10px 12px;color:#0F172A;white-space:nowrap;")}>
                        {r.date}
                        {r.edited && (
                          <span style={css("margin-left:6px;background:#FEF7EC;color:#B45309;font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px;")}>
                            ✎ แก้ไข
                          </span>
                        )}
                      </td>
                      <td style={css("padding:10px 12px;")}>
                        <span style={css(r.badgeStyle)}>{r.typeLabel}</span>
                      </td>
                      <td style={css("padding:10px 12px;color:#475569;")}>{r.hn}</td>
                      <td style={css("padding:10px 12px;color:#334155;")}>{r.place}</td>
                      <td style={css("padding:10px 12px;color:#334155;")}>{r.cat}</td>
                      <td style={css("padding:10px 12px;color:#B45309;font-weight:600;")}>{r.severity}</td>
                      <td style={css("padding:10px 12px;color:#334155;")}>{r.drug}</td>
                      <td style={css("padding:10px 12px;color:#475569;max-width:260px;")}>
                        {r.detailText ? (
                          <div
                            title={r.detailText}
                            style={css(
                              "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.45;"
                            )}
                          >
                            {r.detailText}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={css("padding:10px 12px;color:#475569;")}>{r.reporter}</td>
                      <td style={css("padding:10px 12px;color:#0F8A80;font-weight:600;white-space:nowrap;")}>ดู →</td>
                    </HTr>
                  ))}
                </tbody>
              </table>
              {rlist.length === 0 && (
                <div style={css("padding:34px;text-align:center;color:#94A3B8;font-size:14px;")}>ไม่พบรายงานตามเงื่อนไข</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderFilterField(label: string, child: React.ReactNode) {
    return (
      <div>
        <label style={css("font-size:12px;font-weight:600;color:#64748B;display:block;margin-bottom:4px;")}>{label}</label>
        {child}
      </div>
    );
  }
  // opts รับได้ทั้งข้อความล้วน และแบบแยก value (ค่าที่เก็บ) / label (ป้ายที่โชว์)
  function renderFilterSelect(value: string, onChange: (v: string) => void, opts: (string | { value: string; label: string })[]) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={css("width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:9px 32px 9px 12px;font-size:14px;background-color:#fff;outline:none;")}
      >
        <option value="">ทั้งหมด</option>
        {opts.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const lb = typeof o === "string" ? o : o.label;
          return (
            <option key={v} value={v}>
              {lb}
            </option>
          );
        })}
      </select>
    );
  }

  // ---------------- DETAIL MODAL ----------------
  function renderDetailModal() {
    if (!dt2) return null;
    const detailTitle = isMed2 ? "Med Error" : "DRP";
    const detailHeading = S.editMode ? "แก้ไขรายการ" : "รายละเอียดที่บันทึก";
    const hasHistory = !!(dt2.history && dt2.history.length);
    // 🚨 คลิกพื้นที่ว่าง (backdrop) = ไม่ปิดหน้าต่างเด็ดขาด ต้องกดปุ่มปิดเอง (กันเผลอปิดทับงานที่ยังไม่บันทึก)
    // กดปุ่ม × ขณะแก้ไขค้างอยู่ → ถามยืนยันก่อนทิ้ง
    const closeDetail = () => setState({ detail: null, editMode: false, showHistory: false, confirmDiscard: false });
    const onBackdrop = () => {
      if (S.editMode) flash("กำลังแก้ไขอยู่ กดบันทึกหรือยกเลิกก่อนปิดหน้าต่าง");
    };
    const onCloseBtn = () => {
      if (S.editMode) {
        setState({ confirmDiscard: true });
        return;
      }
      closeDetail();
    };
    return (
      <div
        onClick={onBackdrop}
        style={css(
          "position:fixed;inset:0;background:rgba(11,101,93,.35);backdrop-filter:blur(2px);z-index:60;display:flex;align-items:center;justify-content:center;padding:20px;"
        )}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={css("background:#fff;border-radius:18px;width:540px;max-width:100%;max-height:88vh;overflow:auto;box-shadow:0 30px 70px -20px rgba(11,101,93,.6);")}
        >
          {/* ยืนยันทิ้งการแก้ไข — คลิกนอกป๊อปไม่ปิด ต้องกดปุ่มเลือกเอง */}
          {S.confirmDiscard && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={css(
                "position:fixed;inset:0;background:rgba(11,101,93,.45);z-index:70;display:flex;align-items:center;justify-content:center;padding:20px;"
              )}
            >
              <div style={css("background:#fff;border-radius:16px;width:390px;max-width:100%;padding:22px;box-shadow:0 30px 70px -20px rgba(11,101,93,.6);")}>
                <div style={css("font-size:16px;font-weight:700;color:#0B655D;margin-bottom:8px;")}>ปิดโดยไม่บันทึกการแก้ไข</div>
                <div style={css("font-size:14px;color:#475569;line-height:1.55;margin-bottom:18px;")}>
                  รายงานนี้กำลังแก้ไขอยู่ ถ้าปิดตอนนี้ สิ่งที่แก้ไว้จะหายทั้งหมด
                </div>
                <div style={css("display:flex;gap:10px;")}>
                  <HButton
                    onClick={closeDetail}
                    base="flex:1;border:none;background:#DC2626;color:#fff;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;"
                    hover="background:#B91C1C"
                  >
                    ทิ้งการแก้ไข
                  </HButton>
                  <HButton
                    onClick={() => setState({ confirmDiscard: false })}
                    base="flex:1;border:1.5px solid #DCE7E5;background:#fff;color:#0B655D;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;"
                    hover="background:#F5FAF9"
                  >
                    กลับไปแก้ต่อ
                  </HButton>
                </div>
              </div>
            </div>
          )}
          {/* ยืนยันย้ายไปถังขยะ (ลบชั้น 1) — คลิกนอกป๊อปไม่ปิด ต้องกดปุ่มเอง */}
          {S.askDelete && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={css(
                "position:fixed;inset:0;background:rgba(11,101,93,.45);z-index:70;display:flex;align-items:center;justify-content:center;padding:20px;"
              )}
            >
              <div style={css("background:#fff;border-radius:16px;border-top:4px solid #F5A623;width:400px;max-width:100%;padding:22px;box-shadow:0 30px 70px -20px rgba(11,101,93,.6);")}>
                <div style={css("font-size:16px;font-weight:800;color:#B45309;margin-bottom:8px;")}>ย้ายรายงานนี้ไปถังขยะ</div>
                <div style={css("font-size:13.5px;color:#475569;line-height:1.6;margin-bottom:13px;")}>
                  รายงานจะถูกซ่อนจากรายการ แต่ยังกู้คืนได้จากถังขยะในหน้าตั้งค่า
                </div>
                <div style={css("background:#F6FAF9;border:1px solid #E3EFEC;border-radius:11px;padding:10px 13px;font-size:12.5px;color:#334155;margin-bottom:16px;")}>
                  {detailTitle} · HN {dt2.hn || "—"} · {dt2.occurred_at || ""}
                </div>
                <div style={css("display:flex;gap:10px;")}>
                  <HButton
                    onClick={() => doSoftDelete()}
                    base="flex:1;border:none;background:#F5A623;color:#3B2200;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;"
                    hover="background:#E4980E"
                  >
                    ย้ายไปถังขยะ
                  </HButton>
                  <HButton
                    onClick={() => setState({ askDelete: false })}
                    base="flex:1;border:1.5px solid #DCE7E5;background:#fff;color:#0B655D;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;"
                    hover="background:#F5FAF9"
                  >
                    ยกเลิก
                  </HButton>
                </div>
              </div>
            </div>
          )}
          <div style={css("position:sticky;top:0;background:#fff;display:flex;align-items:center;gap:12px;padding:18px 22px;border-bottom:1px solid #EEF3F1;z-index:2;")}>
            <span style={css(detailBadgeStyle)}>{detailTitle}</span>
            <div style={css("font-size:15px;font-weight:700;color:#0B655D;")}>{detailHeading}</div>
            <button
              onClick={onCloseBtn}
              style={css("margin-left:auto;border:none;background:#EEF3F1;color:#475569;width:32px;height:32px;border-radius:9px;font-size:18px;cursor:pointer;line-height:1;")}
            >
              ×
            </button>
          </div>

          {!S.editMode ? (
            <div style={css("padding:14px 22px 22px;display:flex;flex-direction:column;")}>
              {dt2.edited && (
                <div style={css("display:flex;align-items:center;gap:8px;background:#FEF7EC;border:1px solid #F6D89A;border-radius:10px;padding:9px 12px;margin-bottom:10px;font-size:12.5px;color:#92400E;font-weight:600;")}>
                  ✎ รายการนี้มีการแก้ไข {dt2.edit_count || 0} ครั้ง · ล่าสุด {fmtThaiDateTime(dt2.edited_at)}
                </div>
              )}
              {detailRows.map((d, i) => (
                <div key={i} style={css("display:flex;gap:14px;padding:11px 0;border-bottom:1px solid #F4F8F7;")}>
                  <div style={css("flex:none;width:150px;font-size:13px;color:#64748B;font-weight:600;")}>{d.label}</div>
                  <div style={css("flex:1;font-size:14px;color:#0F172A;line-height:1.5;")}>
                    {d.ok && (
                      <span
                        style={css(
                          "display:inline-block;font-size:12.5px;font-weight:700;padding:3px 10px;border-radius:999px;margin-right:8px;" +
                            // เภสัชกรแก้เอง = อำพัน (ตรงกับปุ่มติ๊กในฟอร์ม) · แก้ไขแล้ว (ME) = เทล
                            (d.ok.includes("เภสัชกร") ? "background:#FEF7EC;color:#B45309;" : "background:#E8F5F3;color:#0B655D;")
                        )}
                      >
                        {d.ok}
                      </span>
                    )}
                    {d.ok && d.value === "—" ? null : d.value}
                  </div>
                </div>
              ))}
              {dt2.attachment && (
                <div style={css("padding:14px 0 4px;")}>
                  <div style={css("font-size:13px;color:#64748B;font-weight:600;margin-bottom:8px;")}>รูปแนบ</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={dt2.attachment} alt="แนบ" style={{ maxWidth: "100%", borderRadius: "12px", border: "1px solid #DCE7E5", display: "block" }} />
                </div>
              )}

              {hasHistory && (
                <div style={css("margin-top:14px;padding-top:14px;border-top:1px dashed #DCE7E5;")}>
                  <HButton
                    onClick={() => setState((st) => ({ showHistory: !st.showHistory }))}
                    base="border:none;background:#F5FAF9;color:#0B655D;font-size:13px;font-weight:600;padding:9px 13px;border-radius:9px;cursor:pointer;width:100%;text-align:left;"
                    hover="background:#EAF3F1"
                  >
                    🕘 {(S.showHistory ? "ซ่อน" : "ดู") + "ประวัติก่อนแก้ไข (" + (dt2.history ? dt2.history.length : 0) + " เวอร์ชัน)"}
                  </HButton>
                  {S.showHistory && (
                    <div style={css("display:flex;flex-direction:column;gap:10px;margin-top:10px;")}>
                      {historyList.map((h) => (
                        <div key={h.no} style={css("background:#FBFDFC;border:1px solid #E3EFEC;border-radius:12px;padding:12px 14px;")}>
                          <div style={css("font-size:12px;font-weight:700;color:#94A3B8;margin-bottom:8px;")}>
                            เวอร์ชัน {h.no} · บันทึกเมื่อ {h.at}
                          </div>
                          {h.rows.map((hr, j) => (
                            <div key={j} style={css("display:flex;gap:12px;padding:5px 0;")}>
                              <div style={css("flex:none;width:140px;font-size:12px;color:#94A3B8;")}>{hr.label}</div>
                              <div style={css("flex:1;font-size:12.5px;color:#475569;line-height:1.45;")}>{hr.value}</div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <HButton
                onClick={() => startEdit()}
                base="margin-top:16px;border:none;background:#0F8A80;color:#fff;font-size:15px;font-weight:700;padding:13px;border-radius:12px;cursor:pointer;"
                hover="background:#0B655D"
              >
                ✎ แก้ไขรายการนี้
              </HButton>
              {/* ปุ่มลบ — สีจาง แยกจากปุ่มหลัก กันเผลอกด · เปิดป๊อปยืนยันย้ายไปถังขยะ (ชั้น 1) */}
              <HButton
                onClick={() => setState({ askDelete: true })}
                base="margin-top:10px;width:100%;box-sizing:border-box;border:none;background:none;color:#C0563F;font-size:13.5px;font-weight:600;padding:9px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;"
                hover="background:#FDECE8;"
              >
                🗑 ลบรายงาน
              </HButton>
            </div>
          ) : (
            renderEditMode()
          )}
        </div>
      </div>
    );
  }

  function renderEditMode() {
    const isEditMed = ef.type === "med";
    return (
      <div style={css("padding:14px 22px 22px;display:flex;flex-direction:column;gap:13px;")}>
        <div style={css("display:flex;gap:10px;")}>
          <div style={css("flex:1;")}>
            <label style={editLabel}>วันที่</label>
            <HInput type="date" value={ef.occurred_at || ""} onChange={(e) => setEf("occurred_at", e.target.value)} base={editInput} focus={INPUT_FOCUS} />
          </div>
          <div style={css("flex:1;")}>
            <label style={editLabel}>เวร</label>
            <div style={css("display:flex;gap:6px;")}>
              {SHIFTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setEf("occurred_time", SHIFT_TIME[s])}
                  style={css(shiftBtn(shiftOf(ef.occurred_time) === s))}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label style={editLabel}>HN ผู้ป่วย</label>
          <HInput value={ef.hn || ""} onChange={(e) => setEf("hn", e.target.value.replace(/\D/g, ""))} type="tel" inputMode="numeric" base={editInput} focus={INPUT_FOCUS} />
        </div>

        {isEditMed ? (
          <div style={css("display:flex;flex-direction:column;gap:13px;")}>
            <div>
              <label style={editLabel}>จุดที่พบ</label>
              <select value={ef.location || ""} onChange={(e) => setEfLocation(e.target.value)} style={css(editInputSelect)}>
                {LOCATIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            {ef.location === IPD_LOCATION && (
              <div>
                <label style={editLabel}>AN (เลขที่ผู้ป่วยใน)</label>
                <HInput value={(ef.an as string) || ""} onChange={(e) => setEf("an", e.target.value.replace(/[^0-9-]/g, ""))} onBlur={() => setEf("an", formatAn((ef.an as string) || "", ef.occurred_at))} placeholder="เช่น 69-01234" base={editInput} focus={INPUT_FOCUS} />
              </div>
            )}
            <div>
              <label style={editLabel}>
                ประเภท Error <span style={css("color:#94A3B8;font-weight:400;")}>เลือกได้หลายอัน</span>
              </label>
              <div style={css("display:flex;flex-wrap:wrap;gap:7px;")}>
                {ERROR_TYPES.map((t) => (
                  <button key={t.key} type="button" onClick={() => efToggleArr("error_type", t.key)} style={css(chip(efArr("error_type").includes(t.key)))}>
                    {t.key}
                    {t.th ? " (" + t.th + ")" : ""}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={editLabel}>
                ลักษณะความคลาดเคลื่อน <span style={css("color:#94A3B8;font-weight:400;")}>เลือกได้หลายอัน</span>
              </label>
              <div style={css("display:flex;flex-wrap:wrap;gap:7px;")}>
                {ERROR_NATURE.map((n) => (
                  <button key={n.key} type="button" onClick={() => efToggleArr("error_nature", n.key)} style={css(chip(efArr("error_nature").includes(n.key)))}>
                    {n.key}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={editLabel}>ระดับ NCC MERP</label>
              <select value={ef.severity || ""} onChange={(e) => setEf("severity", e.target.value)} style={css(editInputSelect)}>
                <option value="">—</option>
                {severityOpts.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div style={css("display:flex;flex-direction:column;gap:13px;")}>
            <div>
              <label style={editLabel}>จุดที่พบ</label>
              <select value={ef.location || ""} onChange={(e) => setEfLocation(e.target.value)} style={css(editInputSelect)}>
                {LOCATIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            {ef.location === IPD_LOCATION && (
              <div>
                <label style={editLabel}>AN (เลขที่ผู้ป่วยใน)</label>
                <HInput value={(ef.an as string) || ""} onChange={(e) => setEf("an", e.target.value.replace(/[^0-9-]/g, ""))} onBlur={() => setEf("an", formatAn((ef.an as string) || "", ef.occurred_at))} placeholder="เช่น 69-01234" base={editInput} focus={INPUT_FOCUS} />
              </div>
            )}
            <div>
              <label style={editLabel}>ประเภทปัญหาจากการใช้ยา (DRP)</label>
              <select value={ef.drp_type || ""} onChange={(e) => setEf("drp_type", e.target.value)} style={css(editInputSelect)}>
                <option value="">—</option>
                {drpTypeOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={editLabel}>รายละเอียดเหตุการณ์ / สาเหตุ</label>
              <HTextarea value={ef.cause || ""} onChange={(e) => setEf("cause", e.target.value)} rows={3} base={editTextarea} focus={INPUT_FOCUS} />
            </div>
            <div>
              <label style={editLabel}>ระดับ NCC MERP</label>
              <select value={ef.severity || ""} onChange={(e) => setEf("severity", e.target.value)} style={css(editInputSelect)}>
                <option value="">—</option>
                {severityOpts.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <HButton
                onClick={() => {
                  const next = !ef.pharmacist_only;
                  setEf("pharmacist_only", next);
                  if (next) setEf("outcome", "");
                }}
                base={
                  "width:100%;box-sizing:border-box;display:flex;align-items:center;gap:10px;text-align:left;padding:10px 13px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;" +
                  (ef.pharmacist_only
                    ? "border:1.5px solid #F5A623;background:#FEF7EC;color:#B45309;"
                    : "border:1.5px solid #DCE7E5;background:#fff;color:#64748B;")
                }
                hover={ef.pharmacist_only ? "background:#FDEFD6;" : "border-color:#F5A623;color:#B45309;"}
              >
                <span
                  style={css(
                    "width:19px;height:19px;flex:0 0 19px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;" +
                      (ef.pharmacist_only ? "background:#F5A623;color:#3B2200;" : "background:#fff;border:1.5px solid #CBD5E1;color:transparent;")
                  )}
                >
                  ✓
                </span>
                เภสัชกรแก้ไขเอง ไม่ผ่านแพทย์
              </HButton>
            </div>
            <div>
              <label style={editLabel}>การแก้ไข (Intervention)</label>
              <select
                value={ef.intervention || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setEf("intervention", v);
                  if (v !== CONSULT_DOCTOR) setEf("outcome", "");
                }}
                style={css(editInputSelect)}
              >
                <option value="">— เลือกการแก้ไข —</option>
                {INTERVENTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            {!ef.pharmacist_only && ef.intervention === CONSULT_DOCTOR && (
              <div>
                <label style={editLabel}>ผลตอบรับจากแพทย์</label>
                <select value={ef.outcome || ""} onChange={(e) => setEf("outcome", e.target.value)} style={css(editInputSelect)}>
                  <option value="">—</option>
                  {outcomeOpts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={editLabel}>การแก้ไข / จัดการ</label>
              <HTextarea
                value={ef.management || ""}
                onChange={(e) => setEf("management", e.target.value)}
                rows={2}
                base={editTextarea}
                focus={INPUT_FOCUS}
              />
            </div>
          </div>
        )}

        <div>
          <label style={editLabel}>ยาที่เกี่ยวข้อง</label>
          <HInput value={(ef.drug as string) || ""} onChange={(e) => setEf("drug", e.target.value)} base={editInput} focus={INPUT_FOCUS} />
        </div>
        <div style={css("display:flex;gap:8px;")}>
          <button onClick={() => setEf("high_alert", !ef.high_alert)} style={css(chip(!!ef.high_alert))}>
            ⚠ High-alert
          </button>
          <button onClick={() => setEf("lasa", !ef.lasa)} style={css(chip(!!ef.lasa))}>
            🔁 LASA
          </button>
        </div>
        <div>
          <label style={editLabel}>รายละเอียด</label>
          <HTextarea value={ef.detail || ""} onChange={(e) => setEf("detail", e.target.value)} rows={2} base={editTextarea} focus={INPUT_FOCUS} />
        </div>
        {isEditMed && (
          <div>
            <label style={editLabel}>การแก้ไข / จัดการ</label>
            <HButton
              onClick={() => setEf("managed", !ef.managed)}
              base={
                "width:100%;box-sizing:border-box;display:flex;align-items:center;gap:10px;text-align:left;margin-bottom:8px;padding:10px 13px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;" +
                (ef.managed
                  ? "border:1.5px solid #0F8A80;background:#E8F5F3;color:#0B655D;"
                  : "border:1.5px solid #DCE7E5;background:#fff;color:#64748B;")
              }
              hover={ef.managed ? "background:#DDEFEC;" : "border-color:#0F8A80;color:#0F8A80;"}
            >
              <span
                style={css(
                  "width:19px;height:19px;flex:0 0 19px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;" +
                    (ef.managed ? "background:#0F8A80;color:#fff;" : "background:#fff;border:1.5px solid #CBD5E1;color:transparent;")
                )}
              >
                ✓
              </span>
              แก้ไขเรียบร้อยแล้ว
            </HButton>
            <HTextarea value={ef.management || ""} onChange={(e) => setEf("management", e.target.value)} rows={2} base={editTextarea} focus={INPUT_FOCUS} />
          </div>
        )}
        <div>
          <label style={editLabel}>ผู้รายงาน</label>
          {renderReporterDD("edit-reporter", ef.reporter || "", (v) => setEf("reporter", v), false)}
        </div>

        <div style={css("display:flex;gap:10px;margin-top:6px;")}>
          <button
            onClick={() => cancelEdit()}
            style={css("flex:none;border:1.5px solid #DCE7E5;background:#fff;color:#475569;font-size:14px;font-weight:600;padding:12px 20px;border-radius:11px;cursor:pointer;")}
          >
            ยกเลิก
          </button>
          <HButton
            onClick={() => saveEdit()}
            base="flex:1;border:none;background:#F5A623;color:#3B2200;font-size:15px;font-weight:700;padding:12px;border-radius:11px;cursor:pointer;"
            hover="background:#E4980E"
          >
            บันทึกการแก้ไข
          </HButton>
        </div>
      </div>
    );
  }

  // ---------------- คลังยา (จัดการ master data) ----------------
  function renderDrugsAdmin() {
    const list = getFilteredDrugs(S);
    const total = (S.drugs || []).length;
    // ตัวกรองรูปแบบยา — เอา form ที่มีจริงในคลัง (บ่อยสุด 6 อันแรก)
    const formCounts: Record<string, number> = {};
    (S.drugs || []).forEach((d) => {
      if (d.form) formCounts[d.form] = (formCounts[d.form] || 0) + 1;
    });
    const forms = Object.keys(formCounts)
      .sort((a, b) => formCounts[b] - formCounts[a])
      .slice(0, 6);
    const filters: { key: string; label: string }[] = [
      { key: "", label: "ทั้งหมด" },
      { key: "had", label: "HAD" },
      ...forms.map((fm) => ({ key: "form:" + fm, label: fm })),
      { key: "pregDX", label: "Preg D/X" },
    ];
    const fchip = (on: boolean) =>
      on
        ? "border:1px solid " + AM + ";background:" + AM + ";color:" + AMT + ";border-radius:999px;padding:7px 13px;font-size:13px;font-weight:600;cursor:pointer;"
        : "border:1px solid #CFE7E2;background:#EAF4F1;color:#0B655D;border-radius:999px;padding:7px 13px;font-size:13px;font-weight:600;cursor:pointer;";
    const tag = (bg: string, fg: string) => "font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px;background:" + bg + ";color:" + fg + ";";
    const rowBtn = "border:1px solid #DCE7E5;background:#fff;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;color:#0B655D;";
    const doseText = (d: Drug) => [d.strength, d.unit].filter(Boolean).join(" ") + (d.percent ? " " + d.percent + "%" : "");

    return (
      <div style={css("max-width:1080px;margin:0 auto;padding:22px 16px 60px;")}>
        <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:16px;padding:18px 20px;")}>
          <div style={css("display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:10px;")}>
            <div>
              <div style={css("font-size:22px;font-weight:800;color:#0B655D;")}>💊 คลังยา</div>
              <div style={css("font-size:12.5px;color:#64748B;margin-top:4px;")}>รายการยาทั้งหมดในระบบ · แก้ไขแล้วเข้า Supabase ทันที · ทุกเครื่องเห็นสด</div>
            </div>
            <div style={css("display:flex;gap:9px;")}>
              <HButton onClick={() => exportDrugsCsv()} base="border:1.5px solid #DCE7E5;background:#fff;color:#0B655D;font-size:13.5px;font-weight:700;padding:10px 16px;border-radius:10px;cursor:pointer;" hover="background:#F5FAF9">
                ↓ ส่งออก CSV
              </HButton>
              <HButton onClick={() => openAddDrug()} base="border:none;background:#0F8A80;color:#fff;font-size:13.5px;font-weight:700;padding:10px 16px;border-radius:10px;cursor:pointer;" hover="background:#0B655D">
                ＋ เพิ่มยา
              </HButton>
            </div>
          </div>

          <div style={css("margin:16px 0 14px;display:flex;flex-direction:column;gap:10px;")}>
            <HInput
              value={S.drugSearch}
              onChange={(e) => setState({ drugSearch: e.target.value })}
              placeholder="ค้นหาชื่อยา / ชื่อการค้า"
              base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:11px 14px;font-size:14px;outline:none;"
              focus={INPUT_FOCUS}
            />
            <div style={css("display:flex;gap:7px;flex-wrap:wrap;")}>
              {filters.map((fl) => (
                <button key={fl.key} onClick={() => setState({ drugFilter: fl.key })} style={css(fchip(S.drugFilter === fl.key))}>
                  {fl.label}
                </button>
              ))}
            </div>
          </div>

          {isMobile ? (
            <div style={css("display:flex;flex-direction:column;gap:10px;")}>
              {list.map((d) => (
                <div key={d.id} style={css("border:1px solid #DEEBE8;border-radius:13px;padding:12px 14px;")}>
                  <div style={css("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px;")}>
                    <span style={css("font-weight:800;color:#0F172A;font-size:15px;")}>{d.generic}</span>
                    {d.had && <span style={css(tag("#FDECEC", "#B42318"))}>HAD</span>}
                    {d.preg && <span style={css(tag("#EEF2FF", "#3730A3"))}>Preg {d.preg}</span>}
                  </div>
                  <div style={css("font-size:12.5px;color:#475569;line-height:1.6;")}>
                    {[doseText(d), d.form, d.route].filter(Boolean).join(" · ")}
                    {d.brand ? " · " + d.brand : ""}
                  </div>
                  <div style={css("display:flex;gap:8px;margin-top:10px;")}>
                    <button onClick={() => openEditDrug(d)} style={css(rowBtn)}>แก้ไข</button>
                    <button onClick={() => openDrugLog(d)} style={css(rowBtn)}>ประวัติ</button>
                  </div>
                </div>
              ))}
              {list.length === 0 && <div style={css("padding:30px;text-align:center;color:#94A3B8;font-size:14px;")}>ไม่พบยาตามเงื่อนไข</div>}
            </div>
          ) : (
            <div style={css("overflow-x:auto;")}>
              <table style={css("width:100%;border-collapse:collapse;font-size:13px;min-width:820px;")}>
                <thead>
                  <tr style={css("text-align:left;color:#64748B;border-bottom:1.5px solid #EAF3F1;")}>
                    {["ชื่อยา (generic)", "ความแรง", "รูปแบบ", "ทางให้", "ชื่อการค้า", "ธง", "Preg", ""].map((h, i) => (
                      <th key={i} style={css("padding:10px 12px;font-weight:600;white-space:nowrap;")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((d) => (
                    <HTr key={d.id} base="border-bottom:1px solid #F1F6F5;" hover="background:#F9FCFB">
                      <td style={css("padding:11px 12px;color:#0F172A;font-weight:700;")}>{d.generic}</td>
                      <td style={css("padding:11px 12px;color:#334155;white-space:nowrap;")}>{doseText(d) || "—"}</td>
                      <td style={css("padding:11px 12px;color:#334155;")}>
                        {d.form || "—"}
                        {d.release ? " " + d.release : ""}
                      </td>
                      <td style={css("padding:11px 12px;color:#334155;")}>{d.route || "—"}</td>
                      <td style={css("padding:11px 12px;color:#334155;")}>{d.brand || "—"}</td>
                      <td style={css("padding:11px 12px;")}>{d.had ? <span style={css(tag("#FDECEC", "#B42318"))}>HAD</span> : ""}</td>
                      <td style={css("padding:11px 12px;")}>{d.preg ? <span style={css(tag("#EEF2FF", "#3730A3"))}>{d.preg}</span> : "—"}</td>
                      <td style={css("padding:11px 12px;white-space:nowrap;")}>
                        <button onClick={() => openEditDrug(d)} style={css(rowBtn + "margin-right:6px;")}>แก้ไข</button>
                        <button onClick={() => openDrugLog(d)} style={css(rowBtn)}>ประวัติ</button>
                      </td>
                    </HTr>
                  ))}
                </tbody>
              </table>
              {list.length === 0 && <div style={css("padding:30px;text-align:center;color:#94A3B8;font-size:14px;")}>ไม่พบยาตามเงื่อนไข</div>}
            </div>
          )}
          <div style={css("font-size:12px;color:#64748B;margin-top:12px;")}>
            แสดง {list.length} จาก {total} รายการ
          </div>
        </div>
      </div>
    );
  }

  function renderDrugEditModal() {
    const d = S.drugEdit!;
    const fld = "width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:10px 12px;font-size:14px;outline:none;";
    const lab = "font-size:12.5px;font-weight:700;color:#475569;display:block;margin-bottom:5px;";
    const tchip = (on: boolean) => chip(on) + "flex:1;text-align:center;";
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        style={css("position:fixed;inset:0;background:rgba(11,101,93,.4);backdrop-filter:blur(2px);z-index:85;display:flex;align-items:center;justify-content:center;padding:20px;")}
      >
        <div style={css("background:#fff;border-radius:18px;width:460px;max-width:100%;max-height:90vh;overflow:auto;box-shadow:0 30px 70px -20px rgba(11,101,93,.6);")}>
          <div style={css("background:linear-gradient(150deg,#0F8A80,#0B655D);color:#fff;padding:16px 20px;font-weight:800;font-size:17px;")}>{S.drugEditNew ? "เพิ่มยา" : "แก้ไขยา"}</div>
          <div style={css("padding:18px 20px;display:flex;flex-direction:column;gap:12px;")}>
            <div>
              <label style={css(lab)}>
                ชื่อยา (generic) <span style={css("color:#DC2626;")}>*</span>
              </label>
              <HInput value={d.generic || ""} onChange={(e) => setDrugField("generic", e.target.value)} base={fld} focus={INPUT_FOCUS} />
            </div>
            <div style={css("display:flex;gap:10px;")}>
              <div style={css("flex:1;")}>
                <label style={css(lab)}>ความแรง</label>
                <HInput value={d.strength || ""} onChange={(e) => setDrugField("strength", e.target.value)} placeholder="500" base={fld} focus={INPUT_FOCUS} />
              </div>
              <div style={css("flex:1;")}>
                <label style={css(lab)}>หน่วย</label>
                <HInput value={d.unit || ""} onChange={(e) => setDrugField("unit", e.target.value)} placeholder="mg" base={fld} focus={INPUT_FOCUS} />
              </div>
              <div style={css("flex:1;")}>
                <label style={css(lab)}>เข้มข้น (%)</label>
                <HInput value={d.percent || ""} onChange={(e) => setDrugField("percent", e.target.value)} base={fld} focus={INPUT_FOCUS} />
              </div>
            </div>
            <div style={css("display:flex;gap:10px;")}>
              <div style={css("flex:1;")}>
                <label style={css(lab)}>รูปแบบ</label>
                <HInput value={d.form || ""} onChange={(e) => setDrugField("form", e.target.value)} placeholder="tab, amp" base={fld} focus={INPUT_FOCUS} />
              </div>
              <div style={css("flex:1;")}>
                <label style={css(lab)}>ทางให้ยา</label>
                <HInput value={d.route || ""} onChange={(e) => setDrugField("route", e.target.value)} placeholder="oral, IV" base={fld} focus={INPUT_FOCUS} />
              </div>
              <div style={css("flex:1;")}>
                <label style={css(lab)}>ปลดปล่อย</label>
                <HInput value={d.release || ""} onChange={(e) => setDrugField("release", e.target.value)} placeholder="ER, SR" base={fld} focus={INPUT_FOCUS} />
              </div>
            </div>
            <div>
              <label style={css(lab)}>ชื่อการค้า</label>
              <HInput value={d.brand || ""} onChange={(e) => setDrugField("brand", e.target.value)} base={fld} focus={INPUT_FOCUS} />
            </div>
            <div style={css("display:flex;gap:10px;")}>
              <div style={css("flex:1;")}>
                <label style={css(lab)}>Preg category</label>
                <HSelect value={d.preg || ""} onChange={(e) => setDrugField("preg", e.target.value)} base={fld} focus={INPUT_FOCUS}>
                  {["", "A", "B", "C", "D", "X"].map((p) => (
                    <option key={p} value={p}>
                      {p || "—"}
                    </option>
                  ))}
                </HSelect>
              </div>
              <div style={css("flex:1;")}>
                <label style={css(lab)}>ปรับขนาดตามไต</label>
                <div style={css("display:flex;gap:8px;")}>
                  <button onClick={() => setDrugField("renal", false)} style={css(tchip(!d.renal))}>ไม่</button>
                  <button onClick={() => setDrugField("renal", true)} style={css(tchip(!!d.renal))}>ใช่</button>
                </div>
              </div>
            </div>
            <div>
              <label style={css(lab)}>ยา High-alert (HAD)</label>
              <div style={css("display:flex;gap:8px;")}>
                <button onClick={() => setDrugField("had", false)} style={css(tchip(!d.had))}>ไม่ใช่ HAD</button>
                <button onClick={() => setDrugField("had", true)} style={css(tchip(!!d.had))}>เป็น HAD</button>
              </div>
            </div>
            <div style={css("display:flex;gap:10px;margin-top:6px;")}>
              <HButton onClick={() => requestCloseDrugEdit()} base="flex:1;border:1.5px solid #DCE7E5;background:#fff;color:#0B655D;font-size:14px;font-weight:700;padding:12px;border-radius:11px;cursor:pointer;" hover="background:#F5FAF9">
                ยกเลิก
              </HButton>
              <HButton
                onClick={() => saveDrug()}
                base={"flex:1;border:none;background:#0F8A80;color:#fff;font-size:14px;font-weight:700;padding:12px;border-radius:11px;cursor:pointer;" + (S.drugBusy ? "opacity:.6;pointer-events:none;" : "")}
                hover="background:#0B655D"
              >
                {S.drugBusy ? "กำลังบันทึก…" : "บันทึก"}
              </HButton>
            </div>
          </div>
        </div>
        {/* ยืนยันปิดทั้งที่แก้ค้าง — คลิกนอกป๊อปไม่ปิด ต้องกดปุ่มเอง */}
        {S.drugEditConfirmClose && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={css("position:fixed;inset:0;background:rgba(11,101,93,.5);z-index:87;display:flex;align-items:center;justify-content:center;padding:20px;")}
          >
            <div style={css("background:#fff;border-radius:16px;width:380px;max-width:100%;padding:22px;box-shadow:0 30px 70px -20px rgba(11,101,93,.6);")}>
              <div style={css("font-size:16px;font-weight:800;color:#0B655D;margin-bottom:8px;")}>ปิดโดยไม่บันทึก</div>
              <div style={css("font-size:14px;color:#475569;line-height:1.55;margin-bottom:18px;")}>กำลังแก้ไขข้อมูลยาอยู่ ถ้าปิดตอนนี้ สิ่งที่แก้ไว้จะหาย</div>
              <div style={css("display:flex;gap:10px;")}>
                <HButton onClick={() => forceCloseDrugEdit()} base="flex:1;border:none;background:#DC2626;color:#fff;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;" hover="background:#B91C1C">
                  ทิ้งการแก้ไข
                </HButton>
                <HButton onClick={() => setState({ drugEditConfirmClose: false })} base="flex:1;border:1.5px solid #DCE7E5;background:#fff;color:#0B655D;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;" hover="background:#F5FAF9">
                  กลับไปแก้ต่อ
                </HButton>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ประวัติการแก้ไขของยา (audit log · อ่านอย่างเดียว · กดที่ว่างปิดได้)
  function renderDrugLogModal() {
    const lg = S.drugLog!;
    const FIELD_TH: Record<string, string> = {
      generic: "ชื่อยา",
      strength: "ความแรง",
      unit: "หน่วย",
      percent: "เข้มข้น(%)",
      form: "รูปแบบ",
      route: "ทางให้",
      release: "ปลดปล่อย",
      brand: "ชื่อการค้า",
      had: "HAD",
      preg: "Preg",
      renal: "ปรับตามไต",
    };
    const fmtVal = (k: string, v: unknown) => {
      if (v === null || v === undefined || v === "") return "—";
      if (k === "had" || k === "renal") return v ? "ใช่" : "ไม่";
      return String(v);
    };
    const diffFields = (o?: Partial<Drug> | null, n?: Partial<Drug> | null) => {
      const out: { k: string; from: string; to: string }[] = [];
      Object.keys(FIELD_TH).forEach((k) => {
        const ov = (o || {})[k as keyof Drug];
        const nv = (n || {})[k as keyof Drug];
        if (String(ov ?? "") !== String(nv ?? "")) out.push({ k, from: fmtVal(k, ov), to: fmtVal(k, nv) });
      });
      return out;
    };
    const actionLabel = (a: string) => (a === "INSERT" ? "เพิ่มเข้าคลัง" : a === "DELETE" ? "ลบออกจากคลัง" : "แก้ไข");
    const actionStyle = (a: string) =>
      "font-size:11.5px;font-weight:800;padding:2px 9px;border-radius:999px;" +
      (a === "INSERT" ? "background:#E7F3F1;color:#0B655D;" : a === "DELETE" ? "background:#FDECEC;color:#B42318;" : "background:#FEF3E2;color:#B45309;");
    return (
      <div
        onClick={() => setState({ drugLog: null })}
        style={css("position:fixed;inset:0;background:rgba(11,101,93,.4);backdrop-filter:blur(2px);z-index:86;display:flex;align-items:center;justify-content:center;padding:20px;")}
      >
        <div onClick={(e) => e.stopPropagation()} style={css("background:#fff;border-radius:18px;width:480px;max-width:100%;max-height:88vh;overflow:auto;box-shadow:0 30px 70px -20px rgba(11,101,93,.6);")}>
          <div style={css("background:linear-gradient(150deg,#0F8A80,#0B655D);color:#fff;padding:16px 20px;")}>
            <div style={css("font-weight:800;font-size:17px;")}>ประวัติการแก้ไข</div>
            <div style={css("font-size:12.5px;color:#CDEBE5;margin-top:2px;")}>{lg.drug.generic}</div>
          </div>
          <div style={css("padding:16px 20px;")}>
            {S.drugLogLoading ? (
              <div style={css("text-align:center;color:#94A3B8;font-size:14px;padding:24px;")}>กำลังโหลด…</div>
            ) : lg.entries.length === 0 ? (
              <div style={css("text-align:center;color:#94A3B8;font-size:14px;padding:24px;")}>ยังไม่มีประวัติการแก้ไข</div>
            ) : (
              <div style={css("display:flex;flex-direction:column;gap:11px;")}>
                {lg.entries.map((e) => {
                  const changes = e.action === "UPDATE" ? diffFields(e.old_data, e.new_data) : [];
                  return (
                    <div key={e.id} style={css("border:1px solid #E3EFEC;border-radius:12px;padding:11px 13px;")}>
                      <div style={css("display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap;")}>
                        <span style={css(actionStyle(e.action))}>{actionLabel(e.action)}</span>
                        <span style={css("font-size:12px;color:#64748B;")}>{fmtThaiDateTime(e.changed_at)}</span>
                      </div>
                      {e.action === "UPDATE" ? (
                        changes.length ? (
                          <div style={css("display:flex;flex-direction:column;gap:3px;")}>
                            {changes.map((c) => (
                              <div key={c.k} style={css("font-size:12.5px;color:#334155;line-height:1.5;")}>
                                <span style={css("color:#94A3B8;")}>{FIELD_TH[c.k]}:</span> {c.from} <span style={css("color:#0F8A80;font-weight:700;")}>→</span> {c.to}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={css("font-size:12.5px;color:#94A3B8;")}>ไม่มีการเปลี่ยนแปลงข้อมูล</div>
                        )
                      ) : e.action === "INSERT" ? (
                        <div style={css("font-size:12.5px;color:#475569;")}>เพิ่ม “{e.new_data?.generic || lg.drug.generic}” เข้าคลัง</div>
                      ) : (
                        <div style={css("font-size:12.5px;color:#475569;")}>ลบ “{e.old_data?.generic || lg.drug.generic}” ออกจากคลัง</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <button
              onClick={() => setState({ drugLog: null })}
              style={css("width:100%;margin-top:14px;border:1.5px solid #DCE7E5;background:#fff;color:#0B655D;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;")}
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- SETTINGS ----------------
  // หน้าตั้งค่า — ยังไม่ทำเนื้อหา แสดงแค่หัวข้อที่จะทำ (placeholder · มี badge "เร็ว ๆ นี้")
  function renderManage() {
    const mCard = "background:#fff;border:1px solid #E3EFEC;border-radius:16px;padding:18px 20px;display:flex;align-items:flex-start;gap:13px;";
    const soon = "flex:none;background:#FEF3E2;color:#B45309;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;white-space:nowrap;";
    const items = [
      { icon: "👥", title: "จัดการรายชื่อผู้รายงาน", desc: "เพิ่ม / ลบ / แก้ไขรายชื่อผู้รายงานเองได้ (ตอนนี้มี 16 คน)" },
      { icon: "🔽", title: "จัดการตัวเลือกในฟอร์ม", desc: "ประเภท Error · ประเภท DRP · จุดที่พบ · การ Intervention" },
      { icon: "🏥", title: "ข้อมูลหน่วยงาน", desc: "ชื่อโรงพยาบาล · ห้องยา · สำหรับหัวรายงานและไฟล์ส่งออก" },
    ];
    return (
      <div style={css("max-width:640px;margin:0 auto;padding:24px 16px 60px;display:flex;flex-direction:column;gap:14px;")}>
        <div style={css("padding:2px 2px 2px;")}>
          <div style={css("font-size:22px;font-weight:800;color:#0B655D;")}>⚙️ ตั้งค่า</div>
          <div style={css("font-size:12.5px;color:#64748B;margin-top:4px;line-height:1.5;")}>
            จัดการถังขยะได้ที่นี่ · หัวข้ออื่นด้านล่างกำลังพัฒนา ยังใช้งานไม่ได้
          </div>
        </div>

        {/* ถังขยะ — รายงานที่ลบแบบซ่อน (กู้คืน / ลบถาวร) */}
        <div style={css("background:#fff;border:1px solid #E3EFEC;border-radius:16px;padding:18px 20px;")}>
          <div style={css("font-size:15px;font-weight:800;color:#0B655D;")}>🗑 ถังขยะ</div>
          <div style={css("font-size:12px;color:#64748B;margin-top:3px;line-height:1.5;")}>
            รายงานที่ถูกลบ · เก็บไว้ให้กู้คืน จนกว่าจะลบถาวร
          </div>
          {S.trash.length === 0 ? (
            <div style={css("text-align:center;color:#94A3B8;font-size:13px;padding:20px 0 6px;")}>ไม่มีรายงานในถังขยะ</div>
          ) : (
            <div style={css("display:flex;flex-direction:column;gap:11px;margin-top:14px;")}>
              {S.trash.map((t) => {
                const isMed = t.type === "med";
                return (
                  <div key={t.id} style={css("border:1px solid #E3EFEC;border-radius:13px;padding:13px 15px;")}>
                    <div style={css("display:flex;align-items:center;gap:9px;margin-bottom:4px;")}>
                      <span
                        style={css(
                          "font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px;" +
                            (isMed ? "background:#E7F3F1;color:#0B655D;" : "background:#FDECE8;color:#B4341C;")
                        )}
                      >
                        {isMed ? "Med Error" : "DRP"}
                      </span>
                      <span style={css("font-size:14px;font-weight:700;color:#0F172A;")}>HN {t.hn || "—"}</span>
                    </div>
                    <div style={css("font-size:12px;color:#64748B;margin-bottom:11px;")}>
                      {t.occurred_at || ""} · {t.reporter || "—"} · ลบเมื่อ {fmtThaiDateTime(t.deleted_at || undefined)}
                    </div>
                    <div style={css("display:flex;gap:9px;")}>
                      <HButton
                        onClick={() => !S.trashBusy && doRestore(t.id)}
                        base={
                          "border:1.5px solid #DCE7E5;background:#fff;color:#0B655D;font-size:13px;font-weight:700;padding:8px 14px;border-radius:9px;cursor:pointer;" +
                          (S.trashBusy ? "opacity:.5;pointer-events:none;" : "")
                        }
                        hover="background:#F5FAF9"
                      >
                        ↩ กู้คืน
                      </HButton>
                      <HButton
                        onClick={() => !S.trashBusy && setState({ hardTarget: t, hardInput: "" })}
                        base={
                          "border:1.5px solid #F3C5C2;background:#fff;color:#B91C1C;font-size:13px;font-weight:700;padding:8px 14px;border-radius:9px;cursor:pointer;" +
                          (S.trashBusy ? "opacity:.5;pointer-events:none;" : "")
                        }
                        hover="background:#FDECEC"
                      >
                        ลบถาวร
                      </HButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {items.map((it) => (
          <div key={it.title} style={css(mCard)}>
            <div style={css("font-size:23px;line-height:1;")}>{it.icon}</div>
            <div style={css("flex:1;min-width:0;")}>
              <div style={css("font-size:14.5px;font-weight:700;color:#0F172A;")}>{it.title}</div>
              <div style={css("font-size:12.5px;color:#64748B;margin-top:3px;line-height:1.5;")}>{it.desc}</div>
            </div>
            <span style={css(soon)}>เร็ว ๆ นี้</span>
          </div>
        ))}
      </div>
    );
  }

  function renderSettings() {
    const medCount = S.records.filter((r) => r.type === "med").length;
    const drpCount = S.records.filter((r) => r.type === "drp").length;
    const card = "background:#fff;border:1px solid #E3EFEC;border-radius:16px;padding:20px 22px;";
    const cTitle = "font-size:15px;font-weight:700;color:#0B655D;margin-bottom:14px;";
    const kvL = "color:#64748B;font-size:13.5px;";
    const kvR = "color:#0F172A;font-size:13.5px;font-weight:600;";
    const kvRow = "display:flex;justify-content:space-between;gap:12px;padding:5px 0;";
    const chip = "display:flex;align-items:center;gap:8px;background:#F6FAF9;border:1px solid #E3EFEC;border-radius:10px;padding:8px 13px;";
    const chipTx = "font-size:12.5px;font-weight:600;color:#334155;";
    // โลโก้ Supabase (สามเหลี่ยมเขียว) ใช้ซ้ำได้ ปรับขนาดผ่าน size
    const supaLogo = (size: number) => (
      <svg width={size} height={size} viewBox="0 0 109 113" fill="none">
        <path d="M63.7 110.28c-2.85 3.59-8.64 1.62-8.7-2.96l-.9-67.01h45.05c8.16 0 12.71 9.42 7.63 15.81L63.7 110.28z" fill="#3ECF8E" />
        <path d="M45.32 2.71c2.85-3.59 8.64-1.62 8.7 2.96l.39 67.01H9.94c-8.16 0-12.71-9.42-7.63-15.81L45.32 2.71z" fill="#3ECF8E" fillOpacity=".62" />
      </svg>
    );
    return (
      <div style={css("max-width:640px;margin:0 auto;padding:24px 16px 60px;display:flex;flex-direction:column;gap:15px;")}>
        {/* หัวเรื่อง */}
        <div style={css("text-align:center;padding:6px 0 2px;")}>
          <div style={css("font-size:25px;font-weight:800;color:#0B655D;letter-spacing:-.3px;")}>Med Error &amp; DRP</div>
          <div style={css("font-size:12.5px;color:#64748B;margin-top:5px;line-height:1.55;text-wrap:balance;")}>
            ระบบบันทึกความคลาดเคลื่อนทางยา (Med Error) และปัญหาจากการใช้ยา (DRP) · ห้องยา โรงพยาบาลปรางค์กู่
          </div>
        </div>

        {/* ผู้พัฒนา — การ์ดเด่น อยู่บนสุด จัดกึ่งกลางกล่องเดียว */}
        <div style={css(card + "text-align:center;")}>
          <div style={css(cTitle)}>👤 ผู้พัฒนา</div>
          <div style={css("font-size:22px;font-weight:800;color:#0B655D;margin-top:6px;line-height:1.25;letter-spacing:-.2px;")}>เภสัชกร สิรวิชญ์ เผ่าผา</div>
          <div style={css("font-size:12.5px;color:#64748B;margin-top:5px;")}>เลขที่ใบประกอบวิชาชีพเภสัชกรรม 47186</div>
          <div style={css("font-size:12.5px;color:#64748B;margin-top:3px;line-height:1.55;")}>
            กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค
            <br />
            โรงพยาบาลปรางค์กู่
          </div>
          <a
            href="mailto:siravitphoapha9928@hotmail.com"
            style={css(
              "display:inline-flex;align-items:center;gap:8px;margin-top:14px;background:#E7F3F1;color:#0B655D;font-size:13px;font-weight:600;padding:9px 15px;border-radius:10px;text-decoration:none;"
            )}
          >
            ✉️ siravitphoapha9928@hotmail.com
          </a>
        </div>

        {/* ข้อมูลแอป */}
        <div style={css(card)}>
          <div style={css(cTitle)}>📱 ข้อมูลแอป</div>
          <div style={css(kvRow)}>
            <span style={css(kvL)}>เวอร์ชันปัจจุบัน</span>
            <span style={css("color:#0B655D;font-size:13.5px;font-weight:700;")}>v{APP_VERSION}</span>
          </div>
          <div style={css(kvRow)}>
            <span style={css(kvL)}>เผยแพร่ครั้งแรก</span>
            <span style={css(kvR)}>8 กรกฎาคม 2569</span>
          </div>
          <div style={css(kvRow)}>
            <span style={css(kvL)}>อัปเดตล่าสุด</span>
            <span style={css(kvR)}>10 กรกฎาคม 2569</span>
          </div>
        </div>

        {/* เก็บข้อมูลที่ไหน */}
        <div style={css(card)}>
          <div style={css(cTitle)}>🗄️ ข้อมูลเก็บที่ไหน</div>
          <div style={css("display:flex;align-items:center;gap:13px;")}>
            {supaLogo(34)}
            <div>
              <div style={css("font-size:15px;font-weight:700;color:#0F172A;")}>Supabase</div>
              <div style={css("font-size:12px;color:#64748B;line-height:1.4;")}>ฐานข้อมูล PostgreSQL บนคลาวด์{isMobile ? <br /> : " · "}เข้ารหัส · สำรองข้อมูลอัตโนมัติ</div>
            </div>
          </div>
          <div style={css("margin-top:15px;padding-top:14px;border-top:1px solid #EAF3F1;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;")}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: cfgConfigured ? "#0F8A80" : "#B45309" }}>
              {cfgConfigured ? "● เชื่อมต่อฐานข้อมูลแล้ว" : "● โหมด demo (เก็บในเครื่อง)"}
            </span>
            <span style={css("font-size:12.5px;color:#64748B;")}>
              ในระบบ: Med {medCount} · DRP {drpCount} เคส
            </span>
          </div>
        </div>

        {/* สร้างด้วยอะไร */}
        <div style={css(card)}>
          <div style={css(cTitle)}>🛠️ สร้างด้วยเทคโนโลยี</div>
          <div style={css("display:flex;flex-direction:column;gap:8px;align-items:center;")}>
            <div style={css("display:flex;gap:8px;flex-wrap:wrap;justify-content:center;")}>
              <div style={css(chip)}>
                <svg width="19" height="19" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="12" fill="#000" />
                  <text x="12" y="16.5" fontSize="11" fontWeight="700" fill="#fff" textAnchor="middle" fontFamily="Arial">
                    N
                  </text>
                </svg>
                <span style={css(chipTx)}>Next.js 15</span>
              </div>
              <div style={css(chip)}>
                <svg width="21" height="21" viewBox="-11.5 -10.23 23 20.46">
                  <circle r="2.05" fill="#61DAFB" />
                  <g stroke="#61DAFB" strokeWidth="1.1" fill="none">
                    <ellipse rx="11" ry="4.2" />
                    <ellipse rx="11" ry="4.2" transform="rotate(60)" />
                    <ellipse rx="11" ry="4.2" transform="rotate(120)" />
                  </g>
                </svg>
                <span style={css(chipTx)}>React 19</span>
              </div>
              <div style={css(chip)}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <rect width="24" height="24" rx="4" fill="#3178C6" />
                  <text x="12" y="16.5" fontSize="10" fontWeight="700" fill="#fff" textAnchor="middle" fontFamily="Arial">
                    TS
                  </text>
                </svg>
                <span style={css(chipTx)}>TypeScript</span>
              </div>
            </div>
            <div style={css("display:flex;gap:8px;flex-wrap:wrap;justify-content:center;")}>
              <div style={css(chip)}>
                {supaLogo(17)}
                <span style={css(chipTx)}>Supabase</span>
              </div>
              <div style={css(chip)}>
                <svg width="24" height="17" viewBox="0 0 48 30">
                  <path d="M33 27H12.5A9 9 0 1 1 15 9.5 12 12 0 0 1 37.5 22.5c3.5.2 4.5 4.5-4.5 4.5z" fill="#F38020" />
                </svg>
                <span style={css(chipTx)}>Cloudflare</span>
              </div>
            </div>
          </div>
          <div style={css("margin-top:15px;padding-top:14px;border-top:1px solid #EAF3F1;display:flex;align-items:center;justify-content:center;gap:8px;font-size:12.5px;color:#64748B;line-height:1.5;")}>
            <svg width="17" height="17" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
              <g stroke="#D97757" strokeWidth="11" strokeLinecap="round">
                <line x1="50" y1="13" x2="50" y2="87" />
                <line x1="13" y1="50" x2="87" y2="50" />
                <line x1="23.8" y1="23.8" x2="76.2" y2="76.2" />
                <line x1="76.2" y1="23.8" x2="23.8" y2="76.2" />
              </g>
            </svg>
            พัฒนาด้วย <b style={css("color:#334155;")}>Claude Code</b>
          </div>
        </div>

        {/* PDPA */}
        <div style={css("background:#FEF7EC;border:1px solid #F6D89A;border-radius:16px;padding:16px 20px;")}>
          <div style={css("font-size:13px;font-weight:700;color:#B45309;margin-bottom:6px;")}>🔒 ความปลอดภัยข้อมูล (PDPA)</div>
          <div style={css("font-size:12.5px;color:#92400E;line-height:1.65;")}>
            ข้อมูลผู้ป่วย (HN / AN) ใช้เฉพาะงานบริบาลเภสัชกรรมภายในโรงพยาบาล จัดเก็บอย่างปลอดภัยตามหลักคุ้มครองข้อมูลส่วนบุคคล (PDPA) ห้ามเผยแพร่นอกวัตถุประสงค์
          </div>
        </div>
      </div>
    );
  }
}

// สไตล์ที่ใช้ซ้ำในโหมดแก้ไข
const editLabel = css("font-size:12.5px;font-weight:600;color:#475569;display:block;margin-bottom:5px;");
const editInput =
  "width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:10px 12px;font-size:14px;outline:none;";
const editInputSelect =
  "width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:10px 32px 10px 12px;font-size:14px;background-color:#fff;outline:none;";
const editTextarea =
  "width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:10px 12px;font-size:14px;outline:none;resize:vertical;line-height:1.5;";
