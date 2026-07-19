"use client";
// ข้อความเด้ง (toast) — ยกออกจาก MedDrpApp.tsx (Phase 3 · Step 3) · ตรรกะเดิม (โชว์ 2.2 วิ แล้วหาย)
import { useCallback, useEffect, useRef } from "react";
import { SetState } from "@/components/MedDrpContext";

export function useToast(setState: SetState) {
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback(
    (msg: string) => {
      setState({ toast: msg });
      if (tRef.current) clearTimeout(tRef.current);
      tRef.current = setTimeout(() => setState({ toast: "" }), 2200);
    },
    [setState]
  );
  // เคลียร์ timer ตอน unmount (เดิมอยู่ใน mount effect cleanup ของ MedDrpApp)
  useEffect(() => () => {
    if (tRef.current) clearTimeout(tRef.current);
  }, []);
  return { flash };
}
