"use client";
// จัดการคลังยา (master data) — CRUD + ป๊อปแก้ยา + ประวัติ + กรอง/เรียง/ส่งออก CSV
// ยกออกจาก MedDrpApp.tsx (Phase 3 · Step 4) · ตรรกะเดิมทุกอย่าง
import { useCallback } from "react";
import { fetchDrugAudit, fetchDrugs, insertDrug, isConfigured, updateDrug } from "@/lib/data";
import { drugSearchText } from "@/lib/helpers";
import { AppState } from "@/components/MedDrpApp.types";
import { Core } from "@/components/hooks/core";
import { Drug } from "@/lib/types";

export function useDrugsAdmin({ setState, stateRef }: Core, flash: (msg: string) => void) {
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
  }, [setState, stateRef]);

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
  // ซ่อน / เอากลับมาแสดง — ผ่าน updateDrug (trigger จะเก็บ log ให้) · ลบจริงไม่ได้จากเว็บ
  const setDrugHidden = async (d: Drug, hidden: boolean) => {
    if (stateRef.current.drugBusy) return;
    const cfg = stateRef.current.cfg;
    if (!isConfigured(cfg)) {
      flash("ยังไม่ได้เชื่อมต่อ Supabase");
      return;
    }
    setState({ drugBusy: true });
    try {
      await updateDrug(cfg, { ...d, hidden });
    } catch {
      setState({ drugBusy: false });
      flash(hidden ? "ซ่อนไม่สำเร็จ ลองใหม่อีกครั้ง" : "เอากลับไม่สำเร็จ ลองใหม่อีกครั้ง");
      return;
    }
    await refreshDrugs();
    setState({ drugBusy: false });
    flash(hidden ? "ซ่อนยาแล้ว · ดูได้ที่ตั้งค่า" : "เอายากลับมาแสดงแล้ว ✓");
  };
  // ตัวกรองเลือกหลายอัน (กดซ้ำ = ยกเลิก) + ล้างค่า + เรียงตามคอลัมน์ (กดหัวคอลัมน์ · กดซ้ำสลับ asc/desc)
  const toggleDrugFilter = (key: string) =>
    setState((s) => {
      const cur = s.drugFilters || [];
      return { drugFilters: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key] };
    });
  const clearDrugFilters = () => setState({ drugFilters: [] });
  const toggleDrugSort = (key: string) =>
    setState((s) => {
      const cur = s.drugSort;
      if (cur && cur.key === key) return { drugSort: { key, dir: cur.dir === "asc" ? "desc" : "asc" } };
      return { drugSort: { key, dir: "asc" } };
    });
  // ตัวกรอง + ค้นหา (ใช้ทั้ง render และปุ่มส่งออก) — หน้าคลังยาโชว์เฉพาะยาที่ไม่ถูกซ่อน
  // ตัวกรองแบบหลายอัน: รูปแบบ (form:*) รวมกันแบบ OR · HAD / Preg D-X เป็นเงื่อนไข AND เพิ่ม
  const drugMatchesFilters = (d: Drug, filters: string[]): boolean => {
    if (!filters.length) return true;
    const forms = filters.filter((f) => f.startsWith("form:")).map((f) => f.slice(5));
    if (forms.length && !forms.includes(d.form || "")) return false;
    if (filters.includes("had") && !d.had) return false;
    if (filters.includes("pregDX") && !(d.preg === "D" || d.preg === "X")) return false;
    return true;
  };
  const sortDrugs = (arr: Drug[], sort: AppState["drugSort"]): Drug[] => {
    const key = sort?.key || "generic";
    const mul = sort?.dir === "desc" ? -1 : 1;
    return arr.slice().sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[key];
      const bv = (b as unknown as Record<string, unknown>)[key];
      if (key === "id") return (((av as number) || 0) - ((bv as number) || 0)) * mul;
      if (key === "had") return ((av ? 1 : 0) - (bv ? 1 : 0)) * mul;
      return String(av ?? "").localeCompare(String(bv ?? ""), "th") * mul;
    });
  };
  const getFilteredDrugs = (s: AppState): Drug[] => {
    const q = (s.drugSearch || "").trim().toLowerCase();
    const filtered = (s.drugs || [])
      .filter((d) => !d.hidden)
      .filter((d) => drugMatchesFilters(d, s.drugFilters))
      .filter((d) => !q || drugSearchText(d).includes(q));
    return sortDrugs(filtered, s.drugSort);
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

  return {
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
  };
}
