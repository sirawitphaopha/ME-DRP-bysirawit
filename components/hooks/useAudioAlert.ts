"use client";
// เสียง + สั่นเตือน (ตอนส่งไม่สำเร็จ) — ยกออกจาก MedDrpApp.tsx (Phase 3 · Step 1) · ตรรกะเดิมทุกอย่าง
// iOS ต้องปลดล็อกเสียง "ในจังหวะกดปุ่ม" (user gesture) → เรียก unlockAudio() ตอนต้น save/resend
import { useRef } from "react";

export function useAudioAlert() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const unlockAudio = () => {
    try {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctor = w.AudioContext || w.webkitAudioContext;
      if (!Ctor) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctor();
      if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume().catch(() => {});
    } catch {}
  };
  const alertFail = () => {
    // สั่น — ได้เฉพาะ Android (iOS/Safari ไม่รองรับ navigator.vibrate)
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate([220, 90, 220]);
    } catch {}
    // เสียงบี๊บ 2 จังหวะ (สังเคราะห์เอง ไม่ต้องมีไฟล์เสียง)
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const now = ctx.currentTime;
      [0, 0.28].forEach((t) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 640;
        g.gain.setValueAtTime(0.0001, now + t);
        g.gain.exponentialRampToValueAtTime(0.22, now + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.2);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + 0.22);
      });
    } catch {}
  };
  return { unlockAudio, alertFail };
}
