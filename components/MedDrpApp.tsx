"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AM,
  AMT,
  APP_VERSION,
  DRP_TYPES,
  ERROR_NATURE,
  ERROR_TYPES,
  SOURCE_UNITS,
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
  resolveDrugLines,
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
import { dedupUnsynced, formatAn, matchSearch, readList, validateIncident, writeList } from "@/lib/records";
import {
  INPUT_BASE,
  INPUT_FOCUS,
  SHIFT_TIME,
  badgeDrp,
  badgeMed,
  chip,
  editInput,
  editInputSelect,
  editLabel,
  editTextarea,
  filt,
  nav,
  navM,
  pregColor,
  seg,
  shiftBtn,
} from "@/lib/styles";

const ORG_NAME = "ห้องยา รพ.ปรางค์กู่";
const DEFAULT_REPORTER = "";
const START_VIEW: ViewName = "form";

const REC_KEY = "meddrp_records_v6"; // v6: ล้าง demo ที่ค้างในเครื่อง (เอา seed ออกจากโค้ดแล้ว · ข้อมูลจริงดึงจาก Supabase)
const CFG_KEY = "meddrp_cfg";
const DRAFT_KEY = "meddrp_draft";
// คิวรายงานที่ยังส่งขึ้นระบบส่วนกลางไม่สำเร็จ (เก็บไว้ในเครื่องเพื่อลองส่งใหม่อัตโนมัติ · กันข้อมูลหาย)
const PENDING_KEY = "meddrp_pending_v1";


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

  // สลับประเภทฟอร์ม ME↔DRP · เคลียร์ค่าเดิม (เก็บแค่ HN/ผู้รายงาน) แล้วเริ่มฟอร์มประเภทใหม่
  const doSwitchType = (target: "med" | "drp") => {
    setState((st) => ({ type: target, form: emptyForm(DEFAULT_REPORTER, st.form), errors: {}, confirmSwitch: null, hadAuto: false, shiftAuto: true }));
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

  // Phase 2: จับคู่รหัสยาให้เคสเก่าอัตโนมัติ (best-effort · ครั้งเดียวต่อเครื่อง)
  // แมตช์เฉพาะข้อความยาที่ "ตรงเป๊ะ" กับ drugFlatLine ของยาในคลังปัจจุบัน (ยาที่ยังไม่เคยเปลี่ยนชื่อ)
  // เคสที่แมตช์ไม่ได้ (ยาเปลี่ยนชื่อไปแล้ว/พิมพ์เอง) พี่กันปรับเองใน Phase 3
  const backfillDrugIds = useCallback(async () => {
    const cfg = stateRef.current.cfg;
    if (!isConfigured(cfg)) return;
    try {
      if (localStorage.getItem("meddrp_drugid_backfill_v1")) return;
    } catch {}
    const drugs = stateRef.current.drugs || [];
    if (!drugs.length) return; // คลังยายังไม่โหลด รอรอบหน้า
    const byLine = new Map<string, number>();
    drugs.forEach((d) => byLine.set(drugFlatLine(d), d.id));
    const recs = stateRef.current.records || [];
    const toUpdate: Incident[] = [];
    recs.forEach((r) => {
      if (!isUuid(r.id)) return; // เฉพาะเคสที่ขึ้น server แล้ว
      const texts = drugArr(r);
      if (!texts.length) return;
      const existing = r.drug_ids || [];
      if (existing.length >= texts.length && existing.every((x) => x != null)) return; // ผูกครบแล้ว
      const ids = texts.map((t, i) => (existing[i] != null ? existing[i] : byLine.has(t) ? (byLine.get(t) as number) : null));
      if (ids.some((x, i) => x !== (existing[i] ?? null))) toUpdate.push({ ...r, drug_ids: ids });
    });
    if (toUpdate.length) {
      for (const rec of toUpdate) {
        try {
          await pushUpdate(cfg, rec);
        } catch {}
      }
      refreshRecords();
    }
    try {
      localStorage.setItem("meddrp_drugid_backfill_v1", "1");
    } catch {}
  }, [refreshRecords]);

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
  // จัด drug_ids ให้ยาวเท่า drugs เสมอ (เผื่อร่างเก่า/ฟอร์มไม่มี)
  const alignIds = (ids: (number | null)[], len: number): (number | null)[] => {
    const a = ids.slice();
    while (a.length < len) a.push(null);
    return a;
  };
  const setDrugAt = (i: number, v: string) => {
    setState((s) => {
      const d = (s.form.drugs || [""]).slice();
      d[i] = v;
      const ids = alignIds(s.form.drug_ids || [], d.length);
      ids[i] = null; // พิมพ์เอง = ไม่ผูกรหัสยาแล้ว (Phase 2)
      const form = { ...s.form, drugs: d, drug_ids: ids } as FormState;
      return { form, hadAuto: clearAutoHad(s, form) };
    });
    draftSoon();
  };
  const addDrug = () => {
    setState((s) => ({ form: { ...s.form, drugs: [...(s.form.drugs || [""]), ""], drug_ids: [...(s.form.drug_ids || []), null] } }));
    draftSoon();
  };
  // เลือกยาจากรายการ suggest → ใส่เป็นข้อความบรรทัดเดียว + ผูกรหัสยา (id) + ปิด suggest
  const pickDrug = (i: number, d: Drug) => {
    setState((s) => {
      const arr = (s.form.drugs || [""]).slice();
      arr[i] = drugFlatLine(d);
      const ids = alignIds(s.form.drug_ids || [], arr.length);
      ids[i] = d.id; // ผูกรหัสยา → เปลี่ยนชื่อยาในคลังแล้วเคสตามทั้งหมด + Dashboard ไม่นับซ้ำ
      const form = { ...s.form, drugs: arr, drug_ids: ids } as FormState;
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
      const ids = alignIds(s.form.drug_ids || [], d.length);
      d.splice(i, 1);
      ids.splice(i, 1);
      if (!d.length) {
        d.push("");
        ids.push(null);
      }
      const form = { ...s.form, drugs: d, drug_ids: ids } as FormState;
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
  // หน่วยงานต้นเหตุ (เลือกหลายอัน · ใช้ทั้ง Med/DRP) — เลิกเลือก "อื่น ๆ" ล้างข้อความระบุ
  const toggleSourceUnit = (k: string) => {
    setState((s) => {
      const cur = Array.isArray(s.form.source_units) ? s.form.source_units.slice() : [];
      const i = cur.indexOf(k);
      if (i >= 0) cur.splice(i, 1);
      else cur.push(k);
      const form = { ...s.form, source_units: cur } as FormState;
      if (!cur.includes("อื่น ๆ")) form.source_unit_other = "";
      const errors = { ...s.errors };
      delete errors.source_units;
      delete errors.source_unit_other;
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
    // จับคู่ข้อความยา + รหัสยา (drug_ids) ให้ตรง index แล้วค่อยกรองช่องว่างออกพร้อมกัน (คงการผูก id)
    const drugPairs = (f.drugs || [])
      .map((x, i) => ({ text: String(x).trim(), id: (f.drug_ids || [])[i] ?? null }))
      .filter((p) => p.text);
    const drugsArr = drugPairs.map((p) => p.text);
    const drugIdsArr = drugPairs.map((p) => p.id);
    const rec: Incident = {
      ...f,
      type,
      shift: shiftOf(f.occurred_time),
      drugs: drugsArr,
      drug_ids: drugIdsArr,
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
    setState({ saving: false, form: emptyForm(DEFAULT_REPORTER, { hn: "", reporter: f.reporter }), hadAuto: false, shiftAuto: true });
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
  // เปิดโหมดแก้ไข — normalize drugs/drug_ids ให้เป็น array พร้อมใช้ picker (Phase 3)
  const startEdit = () =>
    setState((s) => {
      const det = s.detail!;
      const drugs = det.drugs && det.drugs.length ? det.drugs.slice() : det.drug ? String(det.drug).split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean) : [];
      if (!drugs.length) drugs.push("");
      const ids = (det.drug_ids || []).slice();
      while (ids.length < drugs.length) ids.push(null);
      return { editMode: true, showHistory: false, efDrugSug: null, editForm: { ...det, drugs, drug_ids: ids } };
    });
  const cancelEdit = () => setState({ editMode: false });
  const setEf = (k: string, v: unknown) => setState((s) => ({ editForm: { ...s.editForm, [k]: v } }));
  // ช่องยาในโหมดแก้ไข (Phase 3) — ใช้ picker เดียวกับหน้ากรอก · ผูก drug_ids เหมือนกัน
  const setEfDrugAt = (i: number, v: string) =>
    setState((s) => {
      const d = (s.editForm.drugs || [""]).slice();
      d[i] = v;
      const ids = alignIds(s.editForm.drug_ids || [], d.length);
      ids[i] = null;
      return { editForm: { ...s.editForm, drugs: d, drug_ids: ids } };
    });
  const addEfDrug = () =>
    setState((s) => ({ editForm: { ...s.editForm, drugs: [...(s.editForm.drugs || [""]), ""], drug_ids: [...(s.editForm.drug_ids || []), null] } }));
  const pickEfDrug = (i: number, d: Drug) =>
    setState((s) => {
      const arr = (s.editForm.drugs || [""]).slice();
      arr[i] = drugFlatLine(d);
      const ids = alignIds(s.editForm.drug_ids || [], arr.length);
      ids[i] = d.id;
      const ef2 = { ...s.editForm, drugs: arr, drug_ids: ids };
      if (d.had) ef2.high_alert = true; // เลือกยา HAD → ติดธงให้
      return { editForm: ef2, efDrugSug: null };
    });
  const removeEfDrug = (i: number) =>
    setState((s) => {
      const d = (s.editForm.drugs || [""]).slice();
      const ids = alignIds(s.editForm.drug_ids || [], d.length);
      d.splice(i, 1);
      ids.splice(i, 1);
      if (!d.length) {
        d.push("");
        ids.push(null);
      }
      return { editForm: { ...s.editForm, drugs: d, drug_ids: ids } };
    });
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
  const efArr = (field: "error_type" | "error_nature" | "source_units"): string[] => {
    const v = (stateRef.current.editForm || {})[field];
    return Array.isArray(v) ? (v as string[]) : v ? [String(v)] : [];
  };
  const efToggleArr = (field: "error_type" | "error_nature" | "source_units", val: string) =>
    setState((s) => {
      const raw = s.editForm[field];
      const cur = Array.isArray(raw) ? (raw as string[]) : raw ? [String(raw)] : [];
      const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
      const ef2 = { ...s.editForm, [field]: next };
      // "อื่น ๆ" ของ source_units — เลิกเลือกล้างข้อความระบุ
      if (field === "source_units" && !next.includes("อื่น ๆ")) ef2.source_unit_other = "";
      return { editForm: ef2 };
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
    // Phase 3: โหมดแก้ไขใช้ picker เลือกยาจากคลังแล้ว → เอา ข้อความ+รหัสยา (drug_ids) ที่ผูกไว้มาใช้ตรง ๆ (กรองช่องว่างพร้อมกัน)
    const dPairs = (ef.drugs || []).map((x, i) => ({ text: String(x).trim(), id: (ef.drug_ids || [])[i] ?? null })).filter((p) => p.text);
    const dArr = dPairs.map((p) => p.text);
    const dIds = dPairs.map((p) => p.id);
    const updated: Incident = {
      ...(ef as Incident),
      drugs: dArr,
      drug_ids: dIds,
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
      "source_units",
      "source_unit_other",
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
    // Phase 2: คอลัมน์ "drug" ใน CSV ใช้ชื่อล่าสุดจากรหัสยา (สอดคล้องกับที่แสดงบนหน้าจอ)
    const rows = data.map((r) =>
      cols
        .map((c) => {
          if (c === "drug") return esc(resolveDrugLines(r, drugsById).join(", ") || r.drug || "");
          return esc((r as unknown as Record<string, unknown>)[c]);
        })
        .join(",")
    );
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

  if (!mounted) return <div style={{ minHeight: "100vh" }} />;

  // =========================================================
  //  DERIVED VALUES (พอร์ตจาก renderVals)
  // =========================================================
  const S = state;
  const f = S.form;
  const type = S.type;
  // แผนที่ รหัสยา → ยาในคลังปัจจุบัน (Phase 2) — ใช้แปลงเคสให้แสดง/นับด้วย "ชื่อล่าสุด"
  const drugsById = new Map<number, Drug>((S.drugs || []).map((d) => [d.id, d]));
  const orgName = ORG_NAME;

  // ตัวเลือก dropdown ใช้ในโหมดแก้ไข (EditMode ยังอยู่ในไฟล์นี้) · value = ค่าที่เก็บ · label = ป้ายที่โชว์
  const drpTypeOpts = DRP_TYPES.map((t) => ({ value: t.key, label: t.label || t.key }));
  const severityOpts = SEVERITY.map((s) => s.code);
  const outcomeOpts = OUTCOMES.map((o) => ({ value: o.key, label: o.label }));

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
