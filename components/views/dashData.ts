// คำนวณค่าสรุปทั้งหมดของหน้า Dashboard (kpis/กราฟ/breakdown/heatmap/recent) — ยกออกจาก
// MedDrpApp.tsx (Phase 2c) · เป็น pure function บน AppState · return type อนุมานเอง (ไม่ต้อง type มือ)
// ⚠️ พฤติกรรม/ตรรกะเดิมทุกอย่าง — เป็นแค่การย้ายที่อยู่โค้ด
import {
  AM,
  CONSULT_DOCTOR,
  DRP_TYPES,
  ERROR_NATURE,
  ERROR_TYPES,
  LOCATIONS,
  SEVERITY,
  SHIFTS,
  SOURCE_UNITS,
  THMON,
} from "@/lib/constants";
import { drpLabel, drugArr, drugFlatLine, natureText, natureToArray, resolveDrugLines, shiftOf } from "@/lib/helpers";
import { matchSearch } from "@/lib/records";
import { badgeDrp, badgeMed } from "@/lib/styles";
import { AppState } from "@/components/MedDrpApp.types";
import { Drug } from "@/lib/types";

// ช่วงวันของ dashRange (preset เดือน/ไตรมาส/ปี/กำหนดเอง) → ขอบเขต from/to (ISO)
export function dashBounds(s: AppState) {
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
}

// รายงานที่ผ่านตัวกรอง Dashboard (ประเภท med/drp/ทั้งหมด + ช่วงวัน)
export function dashRecs(s: AppState) {
  const all = s.records || [];
  const dt = s.dashType;
  let recs = dt === "all" ? all.slice() : all.filter((r) => r.type === dt);
  const b = dashBounds(s);
  if (b.fromD) recs = recs.filter((r) => (r.occurred_at || "") >= b.fromD);
  if (b.toD) recs = recs.filter((r) => (r.occurred_at || "") <= b.toD);
  return recs;
}

export function computeDashData(S: AppState) {
  // แผนที่ รหัสยา → ยาในคลังปัจจุบัน (ใช้แปลงเคสให้แสดง/นับด้วย "ชื่อล่าสุด")
  const drugsById = new Map<number, Drug>((S.drugs || []).map((d) => [d.id, d]));

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

  // #10: กราฟรายเดือนใช้ข้อมูลกรองแค่ประเภท (med/drp) ไม่เอาช่วงวันของ dashRange มาบีบ
  const monthScopeRecs = (S.records || []).filter((r) => S.dashType === "all" || r.type === S.dashType);
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

  // นับระดับความรุนแรง A–I รวมทั้ง Med Error และ DRP
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

  // ประเภท Error นับรวมทุกเคส (Med + DRP)
  const byErr: Record<string, number> = {};
  recs.forEach((r) => {
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
  const breakTitle = S.dashType === "drp" ? "แยกตามประเภท DRP" : "แยกตามประเภท Error";

  // Phase 2: นับยาบ่อยโดย group ด้วย "รหัสยา" (id) เมื่อมี → เปลี่ยนชื่อยาแล้วไม่นับซ้ำ · ป้าย = ชื่อล่าสุด
  const byDrugCount: Record<string, number> = {};
  const byDrugLabel: Record<string, string> = {};
  recs.forEach((r) => {
    const texts = drugArr(r);
    const ids = r.drug_ids || [];
    texts.forEach((t, i) => {
      const id = ids[i];
      const master = id != null ? drugsById.get(id) : undefined;
      const key = master ? "id:" + id : "txt:" + t;
      byDrugCount[key] = (byDrugCount[key] || 0) + 1;
      byDrugLabel[key] = master ? drugFlatLine(master) : t;
    });
  });
  const drugEntries = Object.entries(byDrugCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const gmax = Math.max(1, ...drugEntries.map((x) => x[1]), 1);
  const topDrugs = drugEntries.map(([key, count]) => ({
    name: byDrugLabel[key],
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
  // แยกตามหน่วยงานต้นเหตุ — นับแบบ array (1 เคสเลือกได้หลายหน่วย · ทั้ง Med + DRP · respect ตัวกรอง dashType)
  const byUnit: Record<string, number> = {};
  recs.forEach((r) => {
    const arr = Array.isArray(r.source_units) ? r.source_units : r.source_units ? [r.source_units] : [];
    arr.forEach((u) => {
      byUnit[u] = (byUnit[u] || 0) + 1;
    });
  });
  const unitMax = Math.max(1, ...Object.values(byUnit), 1);
  const unitBreak = SOURCE_UNITS.map((u) => ({
    label: u,
    count: byUnit[u] || 0,
    barStyle:
      "height:100%;border-radius:999px;background:linear-gradient(90deg,#12A093,#0B655D);transition:width .6s cubic-bezier(.22,1,.36,1);width:" +
      Math.round(((byUnit[u] || 0) / unitMax) * 100) +
      "%;",
  }));
  // แยกตามผู้รายงาน — เรียงมากไปน้อย · สีสดคนละสีต่อแท่ง
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
    drug: resolveDrugLines(r, drugsById).join(", ") || "—", // Phase 2: ชื่อล่าสุดจากรหัสยา
    reporter: r.reporter || "—",
  }));

  return {
    recs,
    dr,
    kpis,
    tg,
    selYear,
    yearOpts,
    monthBars,
    sevBars,
    breakTitle,
    typeBreak,
    topDrugs,
    interv,
    locBreak,
    shiftBreak,
    reporterBreak,
    unitBreak,
    natureBreak,
    nearMissPct,
    nmN,
    medRecs2,
    haCount,
    laCount,
    HM_DAYS,
    hmMatrix,
    hmColor,
    hmMax,
    hmTotal,
    rangeLabel,
    recent,
    recentFiltered,
  };
}
