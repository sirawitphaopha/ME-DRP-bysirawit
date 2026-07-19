"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AM, APP_VERSION, REPORTERS } from "@/lib/constants";
import {
  drugText,
  emptyFilter,
  emptyForm,
  drugSearchText,
  shiftOf,
} from "@/lib/helpers";
import { envConfig, fetchDrugs, isConfigured } from "@/lib/data";
import { css } from "@/lib/style";
import { HButton, HDiv, HInput } from "@/components/ui";
import { Drug, FormState, RecordFilter, ViewName } from "@/lib/types";
import { AppState } from "@/components/MedDrpApp.types";
import { MedDrpContext, MedDrpCtx } from "@/components/MedDrpContext";
import SettingsView from "@/components/views/SettingsView";
import ManageView from "@/components/views/ManageView";
import DrugsAdminView from "@/components/views/DrugsAdminView";
import DrugEditModal from "@/components/views/DrugEditModal";
import DrugLogModal from "@/components/views/DrugLogModal";
import DashboardView from "@/components/views/DashboardView";
import RecordsView from "@/components/views/RecordsView";
import DetailModal from "@/components/views/DetailModal";
import FormView from "@/components/views/FormView";
import ResultOverlay from "@/components/views/ResultOverlay";
import { useAudioAlert } from "@/components/hooks/useAudioAlert";
import { useDraft } from "@/components/hooks/useDraft";
import { useToast } from "@/components/hooks/useToast";
import { useDrugsAdmin } from "@/components/hooks/useDrugsAdmin";
import { useDashboard } from "@/components/hooks/useDashboard";
import { useFormMutations } from "@/components/hooks/useFormMutations";
import { useEditForm } from "@/components/hooks/useEditForm";
import { useRecords } from "@/components/hooks/useRecords";
import { useRealtime } from "@/components/hooks/useRealtime";
import { CFG_KEY, DRAFT_KEY, PENDING_KEY } from "@/components/hooks/keys";
import { readList } from "@/lib/records";
import { INPUT_FOCUS, nav, navM, pregColor } from "@/lib/styles";

const ORG_NAME = "ห้องยา รพ.ปรางค์กู่";
const DEFAULT_REPORTER = "";
const START_VIEW: ViewName = "form";


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
    shiftAuto: true,
    drugs: [],
    drugSug: null,
    efDrugSug: null,
    drugSearch: "",
    drugFilters: [],
    drugSort: null,
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

  const setState = useCallback((u: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    setS((prev) => {
      const patch = typeof u === "function" ? u(prev) : u;
      return { ...prev, ...patch };
    });
  }, []);

  // เสียง + สั่นเตือน (ตอนส่งไม่สำเร็จ) — Phase 3 Step 1 · ยกเป็น hook (iOS ปลดล็อกเสียงในจังหวะกดปุ่ม)
  const { unlockAudio, alertFail } = useAudioAlert();
  // ร่างอัตโนมัติ — Phase 3 Step 2 · ยกเป็น hook (auto-save draft · hook จัดการ timer/cleanup เอง)
  const { clearDraft, draftSoon, hasDraftContent } = useDraft(stateRef, DRAFT_KEY);
  // ข้อความเด้ง (toast) — Phase 3 Step 3 · ยกเป็น hook
  const { flash } = useToast(setState);
  // จัดการคลังยา (CRUD + ป๊อป + กรอง/เรียง/CSV) — Phase 3 Step 4 · ยกเป็น hook
  const {
    refreshDrugs,
    openAddDrug,
    openEditDrug,
    setDrugField,
    requestCloseDrugEdit,
    forceCloseDrugEdit,
    openDrugLog,
    saveDrug,
    setDrugHidden,
    toggleDrugFilter,
    clearDrugFilters,
    toggleDrugSort,
    getFilteredDrugs,
    exportDrugsCsv,
  } = useDrugsAdmin({ setState, stateRef }, flash);
  // Dashboard — ช่วงเวลา + อนิเมชัน KPI — Phase 3 Step 5 · ยกเป็น hook (hook จัดการ interval/cleanup เอง)
  const { animateKpi, animateKpis, setDashPreset } = useDashboard({ setState, stateRef });

  // การแก้ค่าในฟอร์มกรอก (Med/DRP) — setField/toggle/เลือกยา/สลับประเภท — Phase 3 Step 6 · ยกเป็น hook
  const {
    doSwitchType,
    requestSwitchType,
    setField,
    setLocation,
    setDrugAt,
    addDrug,
    pickDrug,
    removeDrug,
    toggleHighAlert,
    toggleNature,
    toggleSourceUnit,
    toggleErrType,
    setDrpType,
  } = useFormMutations({ setState, stateRef }, { draftSoon, hasDraftContent });
  // โหมดแก้ไขเคส — startEdit/setEf/efArr/efToggleArr/เลือกยา — Phase 3 Step 7 · ยกเป็น hook (saveEdit ยังอยู่ราก)
  const {
    startEdit,
    cancelEdit,
    setEf,
    setEfDrugAt,
    addEfDrug,
    pickEfDrug,
    removeEfDrug,
    setEfLocation,
    efArr,
    efToggleArr,
  } = useEditForm({ setState, stateRef });

  // records I/O + คิวส่ง + save/saveEdit/resendResult + ลบ 2 ชั้น + CSV — Phase 3 Step 8 · ยกเป็น hook (ก้อนใหญ่สุด)
  const {
    enqueuePending,
    dequeuePending,
    flushPending,
    loadRecords,
    loadTrash,
    refreshRecords,
    backfillDrugIds,
    save,
    resendResult,
    doSoftDelete,
    doRestore,
    doHardDelete,
    saveEdit,
    exportCsv,
  } = useRecords({ setState, stateRef }, { flash, unlockAudio, alertFail, clearDraft });


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
    // timer/interval cleanup ย้ายไปอยู่ใน hook แต่ละตัวแล้ว (useDraft/useToast/useDashboard)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime ข้ามเครื่อง (incidents + คลังยา) — Phase 3 Step 9 · ยกทั้ง 2 effect เป็น hook
  useRealtime({ mounted, cfg: state.cfg, stateRef, refreshRecords, flushPending, loadTrash, refreshDrugs });

  // ล็อกไม่ให้เพจด้านหลังเลื่อน ตอนเปิด "ทุก popup" — กันสโครลเมาส์/นิ้วแล้วเพจหลังเลื่อน
  // ครอบคลุม: รายละเอียด/แก้ไขเคส · หน้าผลการส่ง · ป๊อปลบถาวร · ป๊อปสลับ ME↔DRP · ป๊อปคลังยา (แก้ไข/ประวัติ)
  // (ป๊อปที่ซ้อนอยู่ในตัวอื่น เช่น confirmDiscard/askDelete อยู่ใน detail · drugEditConfirmClose อยู่ใน drugEdit — ตัวแม่ล็อกให้แล้ว)
  useEffect(() => {
    const open = !!(state.detail || state.result || state.hardTarget || state.confirmSwitch || state.drugEdit || state.drugLog);
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [state.detail, state.result, state.hardTarget, state.confirmSwitch, state.drugEdit, state.drugLog]);

  // Phase 2: จับคู่รหัสยาให้เคสเก่าอัตโนมัติ (ครั้งเดียว · เมื่อทั้งรายงานและคลังยาโหลดครบ)
  useEffect(() => {
    if (!mounted) return;
    if (!(state.records && state.records.length) || !(state.drugs && state.drugs.length)) return;
    backfillDrugIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, state.records.length, state.drugs.length]);

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
      // เวรตามเวลาจริงอัตโนมัติ (เปิดค้างทั้งวันไม่ต้องรีเฟรช) — เฉพาะตอนยังไม่ได้กดเลือกเวรเอง
      const st = stateRef.current;
      if (st.shiftAuto) {
        const nt = two(d.getHours()) + ":" + two(d.getMinutes());
        if (shiftOf(nt) !== shiftOf(st.form.occurred_time)) {
          setState((s) => ({ form: { ...s.form, occurred_time: nt } }));
        }
      }
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



  const setRF = (k: keyof RecordFilter, v: string) => setState((s) => ({ rf: { ...s.rf, [k]: v } }));

  if (!mounted) return <div style={{ minHeight: "100vh" }} />;

  // =========================================================
  //  DERIVED VALUES (พอร์ตจาก renderVals)
  // =========================================================
  const S = state;
  const f = S.form;
  const type = S.type;
  const orgName = ORG_NAME;

  const cfgConfigured = isConfigured(S.cfg);

  // ค่าที่ส่งให้ view ย่อยผ่าน Context (Phase 2) — จะขยายเพิ่มทีละหน้าที่แยกออกมา
  const ctx: MedDrpCtx = {
    S,
    isMobile,
    cfgConfigured,
    setState,
    doRestore,
    setDrugHidden,
    openDrugLog,
    getFilteredDrugs,
    exportDrugsCsv,
    openAddDrug,
    openEditDrug,
    toggleDrugFilter,
    clearDrugFilters,
    toggleDrugSort,
    setDrugField,
    requestCloseDrugEdit,
    saveDrug,
    forceCloseDrugEdit,
    orgName,
    animateKpi,
    exportCsv,
    setDashPreset,
    flash,
    doSoftDelete,
    startEdit,
    cancelEdit,
    saveEdit,
    setEf,
    setEfLocation,
    efArr,
    efToggleArr,
    setEfDrugAt,
    pickEfDrug,
    addEfDrug,
    removeEfDrug,
    renderReporterDD,
    drugPickerUI,
    clock,
    setField,
    requestSwitchType,
    toggleHighAlert,
    save,
    toggleSourceUnit,
    toggleErrType,
    toggleNature,
    setLocation,
    setDrpType,
    setDrugAt,
    pickDrug,
    removeDrug,
    addDrug,
    resendResult,
  };

  // =========================================================
  //  RENDER
  // =========================================================
  return (
    <MedDrpContext.Provider value={ctx}>
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

      {S.view === "form" && <FormView />}
      {S.view === "dashboard" && <DashboardView />}
      {S.view === "records" && <RecordsView />}
      {S.view === "settings" && <SettingsView />}
      {S.view === "manage" && <ManageView />}
      {S.view === "drugs" && <DrugsAdminView />}
      {S.detail && <DetailModal />}
      {S.drugEdit && <DrugEditModal />}
      {S.drugLog && <DrugLogModal />}

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
      {S.result && <ResultOverlay />}

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
    </MedDrpContext.Provider>
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

  // ช่องเลือกยาแบบ autocomplete (ใช้ร่วมทั้งหน้ากรอกและโหมดแก้ไข · Phase 3) — cfg บอกว่าอ่าน/เขียน state ชุดไหน
  function drugPickerUI(cfg: {
    rows: string[];
    sug: { i: number; term: string } | null;
    onSug: (v: { i: number; term: string } | null) => void;
    onBlur: (i: number) => void;
    onChangeAt: (i: number, v: string) => void;
    onPick: (i: number, d: Drug) => void;
    onRemove: (i: number) => void;
    onAdd: () => void;
    placeholder?: string;
  }) {
    const rows = cfg.rows.length ? cfg.rows : [""];
    const sug = cfg.sug;
    return (
      <div style={css("display:flex;flex-direction:column;gap:8px;")}>
        {rows.map((val, i) => {
          const active = !!(sug && sug.i === i && sug.term.trim() !== "");
          const term = active ? sug!.term.trim().toLowerCase() : "";
          const matches = active ? S.drugs.filter((d) => !d.hidden && drugSearchText(d).includes(term)).slice(0, 25) : [];
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
                    cfg.onChangeAt(i, e.target.value);
                    cfg.onSug({ i, term: e.target.value });
                  }}
                  onFocus={() => {
                    if (val && val.trim()) cfg.onSug({ i, term: val });
                  }}
                  onBlur={() => setTimeout(() => cfg.onBlur(i), 180)}
                  placeholder={cfg.placeholder || "พิมพ์ค้นหายา…"}
                  autoComplete="off"
                  base="flex:1;min-width:0;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:12px 14px;font-size:15px;color:#0F172A;background:#fff;outline:none;"
                  focus={INPUT_FOCUS}
                />
                {rows.length > 1 && (
                  <button
                    onClick={() => cfg.onRemove(i)}
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
                            cfg.onPick(i, d);
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
          onClick={() => cfg.onAdd()}
          base="align-self:flex-start;border:1.5px dashed #C6DED9;background:#F5FAF9;color:#0B655D;font-size:13.5px;font-weight:600;padding:9px 15px;border-radius:10px;cursor:pointer;"
          hover="border-color:#F5A623;color:#B45309"
        >
          + เพิ่มยา (พิมพ์เองถ้าไม่เจอในระบบ)
        </HButton>
      </div>
    );
  }
}
