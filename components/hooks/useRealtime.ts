"use client";
// Realtime ข้ามเครื่อง — subscribe incidents + drugs + กันสัญญาณหลุด (visibility/online)
// ยกออกจาก MedDrpApp.tsx (Phase 3 · Step 9) · ตรรกะ/effect-deps เดิมทุกอย่าง (ใช้ cfg.url/cfg.key เป็น dep กัน re-subscribe)
import { MutableRefObject, useEffect } from "react";
import { isConfigured, subscribeDrugs, subscribeIncidents } from "@/lib/data";
import { AppState } from "@/components/MedDrpApp.types";
import { SupabaseCfg } from "@/lib/types";

interface RealtimeDeps {
  mounted: boolean;
  cfg: SupabaseCfg;
  stateRef: MutableRefObject<AppState>;
  refreshRecords: () => void | Promise<void>;
  flushPending: () => void | Promise<void>;
  loadTrash: () => void | Promise<void>;
  refreshDrugs: () => void | Promise<void>;
}

export function useRealtime({ mounted, cfg, stateRef, refreshRecords, flushPending, loadTrash, refreshDrugs }: RealtimeDeps) {
  // ---------- Realtime: ข้อมูลสดข้ามเครื่อง (incidents) ----------
  useEffect(() => {
    if (!mounted) return;
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
  }, [mounted, cfg.url, cfg.key, refreshRecords, flushPending, loadTrash]);

  // ---------- Realtime คลังยา: มีคนเพิ่ม/แก้ยาในระบบ → ทุกเครื่องเห็นเองไม่ต้องรีเฟรช ----------
  useEffect(() => {
    if (!mounted) return;
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
  }, [mounted, cfg.url, cfg.key, refreshDrugs]);
}
