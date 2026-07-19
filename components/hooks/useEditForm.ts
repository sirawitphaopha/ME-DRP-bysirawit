"use client";
// โหมดแก้ไขเคส — startEdit/setEf/efArr/efToggleArr/เลือกยาในโหมดแก้ไข
// ยกออกจาก MedDrpApp.tsx (Phase 3 · Step 7) · ตรรกะเดิมทุกอย่าง (saveEdit ยังอยู่ Step 8)
import { IPD_LOCATION } from "@/lib/constants";
import { drugFlatLine } from "@/lib/helpers";
import { alignIds, Core } from "@/components/hooks/core";
import { Drug } from "@/lib/types";

export function useEditForm({ setState, stateRef }: Core) {
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

  return {
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
  };
}
