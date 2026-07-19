"use client";
// ร่างอัตโนมัติ (auto-save draft ลง localStorage) — ยกออกจาก MedDrpApp.tsx (Phase 3 · Step 2) · ตรรกะเดิม
import { MutableRefObject, useCallback, useEffect, useRef } from "react";
import { AppState } from "@/components/MedDrpApp.types";
import { FormState } from "@/lib/types";

export function useDraft(stateRef: MutableRefObject<AppState>, draftKey: string) {
  const dtRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ type: stateRef.current.type, form: stateRef.current.form }));
    } catch {}
  }, [draftKey, stateRef]);
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
    } catch {}
  }, [draftKey]);
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
  // เคลียร์ timer ตอน unmount (เดิมอยู่ใน mount effect cleanup ของ MedDrpApp)
  useEffect(() => () => {
    if (dtRef.current) clearTimeout(dtRef.current);
  }, []);
  return { saveDraft, clearDraft, draftSoon, hasDraftContent };
}
