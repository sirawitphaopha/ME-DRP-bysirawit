"use client";
// Dashboard — ช่วงเวลา (dashRange) + อนิเมชันตัวเลข KPI · ยกออกจาก MedDrpApp.tsx (Phase 3 · Step 5) · ตรรกะเดิม
import { useCallback, useEffect, useRef } from "react";
import { dashRecs } from "@/components/views/dashData";
import { AppState } from "@/components/MedDrpApp.types";
import { Core } from "@/components/hooks/core";
import { DashRange } from "@/lib/types";

export function useDashboard({ setState, stateRef }: Core) {
  const ivRef = useRef<Record<number, ReturnType<typeof setInterval> | null>>({});
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
  const setDashPreset = (p: DashRange["preset"]) => setState((s) => ({ dashRange: { ...s.dashRange, preset: p } }));
  // เคลียร์ interval ทั้งหมดตอน unmount (เดิมอยู่ใน mount effect cleanup ของ MedDrpApp)
  useEffect(() => () => {
    Object.values(ivRef.current).forEach((iv) => iv && clearInterval(iv));
  }, []);
  return { animateKpi, animateKpis, setDashPreset };
}
