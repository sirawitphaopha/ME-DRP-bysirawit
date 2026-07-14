"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AM,
  AMT,
  APP_VERSION,
  DRP_TYPES,
  ERROR_NATURE,
  ERROR_TYPES,
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
} from "@/lib/helpers";
import { seed } from "@/lib/seed";
import {
  envConfig,
  fetchDrugs,
  fetchIncidents,
  insertIncident,
  isConfigured,
  subscribeIncidents,
  updateIncident,
} from "@/lib/data";
import { css } from "@/lib/style";
import { HButton, HDiv, HFileLabel, HInput, HSelect, HTextarea, HTr } from "@/components/ui";
import { DashRange, Drug, FormState, Incident, RecordFilter, SupabaseCfg, ViewName } from "@/lib/types";

const ORG_NAME = "ห้องยา รพ.ปรางค์กู่";
const DEFAULT_REPORTER = "";
const START_VIEW: ViewName = "form";

const REC_KEY = "meddrp_records_v6"; // v6: ล้าง demo ที่ค้างในเครื่อง (เอา seed ออกจากโค้ดแล้ว · ข้อมูลจริงดึงจาก Supabase)
const CFG_KEY = "meddrp_cfg";
const DRAFT_KEY = "meddrp_draft";

interface AppState {
  view: ViewName;
  type: "med" | "drp";
  form: FormState;
  records: Incident[];
  search: string;
  dashType: "all" | "med" | "drp";
  cfg: SupabaseCfg;
  toast: string;
  saving: boolean;
  rf: RecordFilter;
  detail: Incident | null;
  editMode: boolean;
  editForm: Partial<Incident> & { drug?: string };
  showHistory: boolean;
  kpiAnim: number[];
  showSevLegend: boolean;
  showNatureLegend: boolean;
  showDrpLegend: boolean;
  errors: Record<string, boolean>;
  dashRange: DashRange;
  dd: string | null; // custom dropdown ที่เปิดอยู่ (id) เช่น "reporter" / "edit-reporter"
  ddUp: boolean; // เมนู dropdown เด้งขึ้นบน (true) เมื่อช่องอยู่ครึ่งล่างจอ
  drugs: Drug[]; // คลังยา (autocomplete · โหลดครั้งเดียวแล้ว cache)
  drugSug: { i: number; term: string } | null; // ช่องยาแถวที่เปิด suggest + คำค้น
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
    cfg: { url: "", key: "" },
    toast: "",
    saving: false,
    rf: emptyFilter(),
    detail: null,
    editMode: false,
    editForm: {},
    showHistory: false,
    kpiAnim: [0, 0, 0, 0],
    showSevLegend: false,
    showNatureLegend: false,
    showDrpLegend: false,
    errors: {},
    dashRange: { preset: "all", from: "", to: "" },
    dd: null,
    ddUp: false,
    drugs: [],
    drugSug: null,
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
        (f.error_nature && f.error_nature.length) ||
        (f.drugs && f.drugs.some((x) => x && String(x).trim())))
    );

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

  // ---------- records I/O ----------
  const loadRecords = useCallback(async () => {
    const cfg = stateRef.current.cfg;
    // 1) โชว์ข้อมูลในเครื่องทันที (ไม่บล็อกด้วย network)
    let local: Incident[] | null = null;
    try {
      local = JSON.parse(localStorage.getItem(REC_KEY) || "null");
    } catch {}
    // เอา demo seed ออก — ผู้ใช้จริงไม่ต้องมีข้อมูลปลอม (ถ้ายังไม่เชื่อม Supabase = หน้ารายการว่าง)
    if (local && local.length) setState({ records: local });
    // 2) ถ้าตั้งค่า Supabase แล้ว → ดึงข้อมูลจริงมาทับเบื้องหลัง
    if (isConfigured(cfg)) {
      try {
        const d = await fetchIncidents(cfg);
        setState({ records: d });
        try {
          localStorage.setItem(REC_KEY, JSON.stringify(d));
        } catch {}
      } catch {}
    }
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
    setState({ cfg, view: sv, type, form });
    setMounted(true);
    // load records after cfg is set
    setTimeout(() => loadRecords(), 0);
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
      const same = JSON.stringify(d) === JSON.stringify(stateRef.current.records || []);
      if (same) return;
      setState({ records: d });
      // ถ้ากำลังเปิดหน้ารายละเอียดของเคสที่เพิ่งถูกแก้จากอีกเครื่อง → อัปเดตหน้าที่เปิดอยู่ด้วย
      const open = stateRef.current.detail;
      if (open) {
        const fresh = d.find((r) => r.id === open.id);
        if (fresh) setState({ detail: fresh });
      }
      try {
        localStorage.setItem(REC_KEY, JSON.stringify(d));
      } catch {}
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
    const schedule = () => {
      if (deb) clearTimeout(deb);
      deb = setTimeout(() => refreshRecords(), 400);
    };

    const unsub = subscribeIncidents(cfg, schedule);

    // กันสัญญาณหลุด (โน้ตบุ๊กพับจอ / เน็ตวืบ) — กลับมาที่แท็บเมื่อไหร่ ดึงข้อมูลใหม่รอบหนึ่ง
    const onVis = () => {
      if (document.visibilityState === "visible") refreshRecords();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", refreshRecords);

    return () => {
      if (deb) clearTimeout(deb);
      unsub();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", refreshRecords);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, state.cfg.url, state.cfg.key, refreshRecords]);

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


  // ---------- form mutations ----------
  const setField = (k: keyof FormState, v: unknown) => {
    setState((s) => {
      const errors = { ...s.errors };
      delete errors[k as string];
      return { form: { ...s.form, [k]: v } as FormState, errors };
    });
    draftSoon();
  };
  const setDrugAt = (i: number, v: string) => {
    setState((s) => {
      const d = (s.form.drugs || [""]).slice();
      d[i] = v;
      return { form: { ...s.form, drugs: d } };
    });
    draftSoon();
  };
  const addDrug = () => {
    setState((s) => ({ form: { ...s.form, drugs: [...(s.form.drugs || [""]), ""] } }));
    draftSoon();
  };
  // เลือกยาจากรายการ suggest → ใส่เป็นข้อความบรรทัดเดียว + ปิด suggest
  const pickDrug = (i: number, d: Drug) => {
    setDrugAt(i, drugFlatLine(d));
    setState({ drugSug: null });
  };
  const removeDrug = (i: number) => {
    setState((s) => {
      const d = (s.form.drugs || [""]).slice();
      d.splice(i, 1);
      if (!d.length) d.push("");
      return { form: { ...s.form, drugs: d } };
    });
    draftSoon();
  };
  const toggleNature = (k: string) => {
    setState((s) => {
      const cur = Array.isArray(s.form.error_nature) ? s.form.error_nature.slice() : [];
      const i = cur.indexOf(k);
      if (i >= 0) cur.splice(i, 1);
      else cur.push(k);
      return { form: { ...s.form, error_nature: cur } };
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
    const f = stateRef.current.form,
      type = stateRef.current.type;
    const errs: Record<string, boolean> = {};
    // ---- ช่องบังคับร่วม (ทั้ง Med + DRP) ----
    if (!String(f.hn || "").trim()) errs.hn = true;
    if (!f.occurred_at) errs.occurred_at = true;
    if (!f.location) errs.location = true;
    if (f.location === IPD_LOCATION && !String(f.an || "").trim()) errs.an = true; // IPD → ต้องมี AN
    if (!f.reporter) errs.reporter = true;
    if (type === "med") {
      if (!(Array.isArray(f.error_type) ? f.error_type.length : f.error_type)) errs.error_type = true;
      if (!(Array.isArray(f.error_nature) ? f.error_nature.length : f.error_nature)) errs.error_nature = true; // ลักษณะความคลาดเคลื่อน
      if (!f.severity) errs.severity = true;
      if (!String(f.detail || "").trim()) errs.detail = true; // รายละเอียดเหตุการณ์
    } else {
      if (!f.drp_type) errs.drp_type = true;
      if (!f.pharmacist_only && !f.outcome) errs.outcome = true; // เภสัชกรแก้เอง = ไม่มีผลตอบรับจากแพทย์
      if (!String(f.cause || "").trim()) errs.cause = true; // รายละเอียดเหตุการณ์ / สาเหตุ (ยุบรวมช่องเดิม 2 ช่อง)
      if (!f.intervention) errs.intervention = true; // การแก้ไข (Intervention)
    }
    if (Object.keys(errs).length) {
      setState({ errors: errs });
      flash("กรุณากรอกช่องที่จำเป็น (ไฮไลต์สีแดง)");
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
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "r" + Date.now(),
      created_at: new Date().toISOString(),
    };
    const cfg = stateRef.current.cfg;
    if (isConfigured(cfg)) {
      try {
        await insertIncident(cfg, rec);
      } catch {}
    }
    const recs = [rec, ...stateRef.current.records];
    try {
      localStorage.setItem(REC_KEY, JSON.stringify(recs));
    } catch {}
    clearDraft();
    setState({ records: recs, saving: false, form: emptyForm(DEFAULT_REPORTER, { hn: "", reporter: f.reporter }) });
    flash("บันทึกแล้ว ✓");
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
  const saveEdit = async () => {
    const ef = stateRef.current.editForm,
      det = stateRef.current.detail!;
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
      shift: shiftOf(ef.occurred_time),
      edited: true,
      edited_at: new Date().toISOString(),
      edit_count: (det.edit_count || 0) + 1,
      history: [...(det.history || []), snap],
    };
    const recs = (stateRef.current.records || []).map((r) => (r.id === updated.id ? updated : r));
    try {
      localStorage.setItem(REC_KEY, JSON.stringify(recs));
    } catch {}
    const cfg = stateRef.current.cfg;
    if (isConfigured(cfg)) {
      try {
        await updateIncident(cfg, updated);
      } catch {}
    }
    setState({ records: recs, detail: updated, editMode: false });
    flash("บันทึกการแก้ไขแล้ว ✓");
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
    const esc = (v: unknown) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
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
  const accepted = recs.filter((r) => r.type === "drp" && r.outcome === "Accepted").length;
  const acceptRate = drpCount ? Math.round((accepted / drpCount) * 100) : 0;
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

  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), label: THMON[d.getMonth()] });
  }
  const mc = months.map((m) => recs.filter((r) => (r.occurred_at || "").slice(0, 7) === m.key).length);
  const mmax = Math.max(1, ...mc);
  const monthBars = months.map((m, i) => ({
    label: m.label,
    count: mc[i],
    barStyle:
      "width:62%;border-radius:6px 6px 0 0;background:linear-gradient(#12A093,#0B655D);transition:height .6s cubic-bezier(.22,1,.36,1),filter .15s;cursor:pointer;height:" +
      Math.max(4, Math.round((mc[i] / mmax) * 118)) +
      "px;",
  }));

  const bySev: Record<string, number> = {};
  recs.filter((r) => r.type === "med").forEach((r) => {
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
  const recentFiltered = recs.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q));
  const recent = recentFiltered.slice(0, 14).map((r) => ({
    date: r.occurred_at,
    typeLabel: r.type === "med" ? "Med Error" : "DRP",
    badgeStyle: r.type === "med" ? badgeMed : badgeDrp,
    hn: r.hn || "—",
    cat: r.type === "med" ? r.error_type || "—" : drpLabel(r.drp_type) || "—",
    severity: r.type === "med" ? r.severity || "—" : "—",
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
    if (rq && !JSON.stringify(r).toLowerCase().includes(rq)) return false;
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
    place: r.type === "med" ? r.location || "—" : "—",
    cat:
      r.type === "med"
        ? natureText(r.error_type)
        : r.drp_type === "อื่น ๆ" && r.drp_type_other
        ? "อื่น ๆ: " + r.drp_type_other
        : drpLabel(r.drp_type) || "—",
    severity: r.type === "med" ? r.severity || "—" : "—",
    drug: (r.drug || "—") + (r.high_alert ? " ⚠" : "") + (r.lasa ? " 🔁" : ""),
    reporter: r.reporter || "—",
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
          ["ยาที่เกี่ยวข้อง", drugDisp],
          ["ธงเตือนยา", flags],
          ["รายละเอียดเหตุการณ์ / สาเหตุ", dt2.cause],
          ["การแก้ไข (Intervention)", dt2.intervention],
          // เภสัชกรแก้เอง = ไม่ได้เสนอแพทย์ จึงไม่มีผลตอบรับ
          ["ผลตอบรับจากแพทย์", dt2.pharmacist_only ? "เภสัชกรแก้ไขเอง ไม่ผ่านแพทย์" : outcomeLabel(dt2.outcome)],
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
          ["รายละเอียดเหตุการณ์ / สาเหตุ", h.cause],
          ["Intervention", h.intervention],
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
  const efNatureVal = (Array.isArray(ef.error_nature) ? ef.error_nature[0] : ef.error_nature) || "";
  const efErrTypeVal = (Array.isArray(ef.error_type) ? ef.error_type[0] : ef.error_type) || "";

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
              รายการ
            </button>
            <button onClick={() => setState({ view: "dashboard" })} style={css(navM(S.view === "dashboard"))}>
              สรุป
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
              รายการ
            </button>
            <button onClick={() => setState({ view: "dashboard" })} style={css(nav(S.view === "dashboard"))}>
              Dashboard
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

      {S.view === "form" && renderForm()}
      {S.view === "dashboard" && renderDashboard()}
      {S.view === "records" && renderRecords()}
      {S.view === "settings" && renderSettings()}
      {S.view === "manage" && renderManage()}
      {dt2 && renderDetailModal()}

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
              <button
                onClick={() => {
                  setState((st) => ({ type: "med", form: emptyForm(DEFAULT_REPORTER, st.form), errors: {} }));
                  draftSoon();
                }}
                style={css(seg(type === "med"))}
              >
                Med Error
              </button>
              <button
                onClick={() => {
                  setState((st) => ({ type: "drp", form: emptyForm(DEFAULT_REPORTER, st.form), errors: {} }));
                  draftSoon();
                }}
                style={css(seg(type === "drp"))}
              >
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
                <button onClick={() => setField("high_alert", !f.high_alert)} style={css(chip(!!f.high_alert))}>
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
              base="width:100%;border:none;background:#F5A623;color:#3B2200;font-size:16px;font-weight:700;padding:15px;border-radius:13px;cursor:pointer;box-shadow:0 10px 22px -8px rgba(245,166,35,.7);"
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
          onChange={(e) => setField("location", e.target.value)}
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
            <HInput
              value={f.error_nature_other}
              onChange={(e) => setField("error_nature_other", e.target.value)}
              placeholder="ระบุลักษณะเพิ่มเติม…"
              base="width:100%;box-sizing:border-box;margin-top:8px;border:1.5px solid #DCE7E5;border-radius:11px;padding:11px 14px;font-size:15px;color:#0F172A;background:#fff;outline:none;"
              focus={INPUT_FOCUS}
            />
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

        {/* ระดับความรุนแรง */}
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
                onClick={() => setField("drp_type", f.drp_type === t.key ? "" : t.key)}
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
            <HInput
              value={f.drp_type_other}
              onChange={(e) => setField("drp_type_other", e.target.value)}
              placeholder="ระบุปัญหา DRP เพิ่มเติม…"
              base="width:100%;box-sizing:border-box;margin-top:8px;border:1.5px solid #DCE7E5;border-radius:11px;padding:11px 14px;font-size:15px;color:#0F172A;background:#fff;outline:none;"
              focus={INPUT_FOCUS}
            />
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

        <div style={css("margin-bottom:16px;")}>
          <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
            การแก้ไข (Intervention) <span style={css("color:#DC2626;")}>*</span>
          </label>
          <HSelect
            value={f.intervention}
            onChange={(e) => setField("intervention", e.target.value)}
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
                ? "border:1.5px solid #0F8A80;background:#E8F5F3;color:#0B655D;"
                : "border:1.5px solid #DCE7E5;background:#fff;color:#64748B;")
            }
            hover={f.pharmacist_only ? "background:#DDEFEC;" : "border-color:#0F8A80;color:#0F8A80;"}
          >
            <span
              style={css(
                "width:20px;height:20px;flex:0 0 20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;" +
                  (f.pharmacist_only ? "background:#0F8A80;color:#fff;" : "background:#fff;border:1.5px solid #CBD5E1;color:transparent;")
              )}
            >
              ✓
            </span>
            เภสัชกรแก้ไขเอง ไม่ผ่านแพทย์
          </HButton>
        </div>

        {!f.pharmacist_only && (
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
              onClick={() => exportCsv()}
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
            <div style={css("font-size:15px;font-weight:700;color:#0B655D;margin-bottom:16px;")}>จำนวนเคสรายเดือน (6 เดือน)</div>
            <div style={css("display:flex;align-items:flex-end;gap:12px;height:150px;padding-top:6px;")}>
              {monthBars.map((b, i) => (
                <div key={i} style={css("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:6px;")}>
                  <div style={css("font-size:12px;font-weight:700;color:#0B655D;")}>{b.count}</div>
                  <HDiv base={b.barStyle} hover="filter:brightness(1.14)" />
                  <div style={css("font-size:11px;color:#64748B;")}>{b.label}</div>
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
            <div style={css("font-size:15px;font-weight:700;color:#0B655D;")}>รายการล่าสุด</div>
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
                    {r.severity ? (
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
                <div style={css("padding:26px;text-align:center;color:#94A3B8;font-size:14px;")}>ไม่พบรายการ</div>
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
                <div style={css("padding:26px;text-align:center;color:#94A3B8;font-size:14px;")}>ไม่พบรายการ</div>
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
            <div style={css("font-size:24px;font-weight:700;color:#0B655D;")}>รายการทั้งหมด</div>
            <div style={css("font-size:13px;color:#64748B;margin-top:2px;")}>
              แสดง {rlist.length} จาก {(S.records || []).length} รายการ
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
                </div>
              </div>
            ))}
            {rlist.length === 0 && (
              <div style={css("padding:34px;text-align:center;color:#94A3B8;font-size:14px;background:#fff;border:1px solid #DEEBE8;border-radius:14px;")}>
                ไม่พบรายการตามเงื่อนไข
              </div>
            )}
          </div>
        ) : (
          <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:8px 8px 12px;")}>
            <div style={css("overflow-x:auto;")}>
              <table style={css("width:100%;border-collapse:collapse;font-size:13px;min-width:860px;")}>
                <thead>
                  <tr style={css("text-align:left;color:#64748B;border-bottom:1.5px solid #EAF3F1;")}>
                    {["วันที่", "ประเภท", "HN", "จุดที่พบ", "หมวด", "ระดับ", "ยา", "ผู้รายงาน", ""].map((h, i) => (
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
                      <td style={css("padding:10px 12px;color:#475569;")}>{r.reporter}</td>
                      <td style={css("padding:10px 12px;color:#0F8A80;font-weight:600;white-space:nowrap;")}>ดู →</td>
                    </HTr>
                  ))}
                </tbody>
              </table>
              {rlist.length === 0 && (
                <div style={css("padding:34px;text-align:center;color:#94A3B8;font-size:14px;")}>ไม่พบรายการตามเงื่อนไข</div>
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
    return (
      <div
        onClick={() => setState({ detail: null, editMode: false, showHistory: false })}
        style={css(
          "position:fixed;inset:0;background:rgba(11,101,93,.35);backdrop-filter:blur(2px);z-index:60;display:flex;align-items:center;justify-content:center;padding:20px;"
        )}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={css("background:#fff;border-radius:18px;width:540px;max-width:100%;max-height:88vh;overflow:auto;box-shadow:0 30px 70px -20px rgba(11,101,93,.6);")}
        >
          <div style={css("position:sticky;top:0;background:#fff;display:flex;align-items:center;gap:12px;padding:18px 22px;border-bottom:1px solid #EEF3F1;z-index:2;")}>
            <span style={css(detailBadgeStyle)}>{detailTitle}</span>
            <div style={css("font-size:15px;font-weight:700;color:#0B655D;")}>{detailHeading}</div>
            <button
              onClick={() => setState({ detail: null, editMode: false, showHistory: false })}
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
                          "display:inline-block;background:#E8F5F3;color:#0B655D;font-size:12.5px;font-weight:700;padding:3px 10px;border-radius:999px;margin-right:8px;"
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
              <select value={ef.location || ""} onChange={(e) => setEf("location", e.target.value)} style={css(editInputSelect)}>
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
                <HInput value={(ef.an as string) || ""} onChange={(e) => setEf("an", e.target.value.replace(/[^0-9-]/g, ""))} placeholder="เช่น 69-01234" base={editInput} focus={INPUT_FOCUS} />
              </div>
            )}
            <div>
              <label style={editLabel}>ประเภท Error</label>
              <select value={efErrTypeVal} onChange={(e) => setEf("error_type", e.target.value ? [e.target.value] : [])} style={css(editInputSelect)}>
                <option value="">—</option>
                {errorTypeOpts.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={editLabel}>ลักษณะความคลาดเคลื่อน</label>
              <select value={efNatureVal} onChange={(e) => setEf("error_nature", e.target.value ? [e.target.value] : [])} style={css(editInputSelect)}>
                <option value="">—</option>
                {errorNatureOpts.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
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
              <select value={ef.location || ""} onChange={(e) => setEf("location", e.target.value)} style={css(editInputSelect)}>
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
                <HInput value={(ef.an as string) || ""} onChange={(e) => setEf("an", e.target.value.replace(/[^0-9-]/g, ""))} placeholder="เช่น 69-01234" base={editInput} focus={INPUT_FOCUS} />
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
              <label style={editLabel}>การแก้ไข (Intervention)</label>
              <select value={ef.intervention || ""} onChange={(e) => setEf("intervention", e.target.value)} style={css(editInputSelect)}>
                <option value="">— เลือกการแก้ไข —</option>
                {INTERVENTIONS.map((o) => (
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
                    ? "border:1.5px solid #0F8A80;background:#E8F5F3;color:#0B655D;"
                    : "border:1.5px solid #DCE7E5;background:#fff;color:#64748B;")
                }
                hover={ef.pharmacist_only ? "background:#DDEFEC;" : "border-color:#0F8A80;color:#0F8A80;"}
              >
                <span
                  style={css(
                    "width:19px;height:19px;flex:0 0 19px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;" +
                      (ef.pharmacist_only ? "background:#0F8A80;color:#fff;" : "background:#fff;border:1.5px solid #CBD5E1;color:transparent;")
                  )}
                >
                  ✓
                </span>
                เภสัชกรแก้ไขเอง ไม่ผ่านแพทย์
              </HButton>
            </div>
            {!ef.pharmacist_only && (
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
            ปรับแต่งค่าต่าง ๆ ของระบบ · หัวข้อด้านล่างกำลังพัฒนา ยังใช้งานไม่ได้
          </div>
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
