"use client";
// หน้าผลการส่งเต็มจอ (สำเร็จ / ไม่สำเร็จ) หลังกดบันทึก — แยกจาก MedDrpApp.tsx (Phase 2f) · JSX เดิม
import React from "react";
import { css } from "@/lib/style";
import { HButton } from "@/components/ui";
import { useMedDrp } from "@/components/MedDrpContext";

function chromeLogo(size: number) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ flex: "none" }} aria-hidden="true">
      <path fill="#EA4335" d="M24 24 L7.42 12.82 A20 20 0 0 1 40.58 12.82 Z" />
      <path fill="#FBBC04" d="M24 24 L41.98 15.23 A20 20 0 0 1 25.40 43.95 Z" />
      <path fill="#34A853" d="M24 24 L22.60 43.95 A20 20 0 0 1 6.02 15.23 Z" />
      <circle cx="24" cy="24" r="9.5" fill="#fff" />
      <circle cx="24" cy="24" r="7.5" fill="#4285F4" />
    </svg>
  );
}

export default function ResultOverlay() {
  const { S, setState, resendResult } = useMedDrp();
  const ok = S.result === "ok";
  return (
    <div
      style={css(
        "position:fixed;inset:0;z-index:90;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px 26px;background:" +
          (ok ? "linear-gradient(180deg,#F3FAF8,#EAF6F2)" : "linear-gradient(180deg,#FEF2F2,#FDE7E7)") +
          ";"
      )}
    >
      {ok ? (
        <>
          <div
            style={css(
              "width:108px;height:108px;border-radius:999px;background:#E4F5EF;display:flex;align-items:center;justify-content:center;margin-bottom:22px;box-shadow:0 0 0 10px rgba(16,161,140,.10);"
            )}
          >
            <span style={css("font-size:60px;color:#12A093;line-height:1;")}>✓</span>
          </div>
          <div style={css("font-size:27px;font-weight:800;color:#0B655D;letter-spacing:-.3px;")}>ส่งสำเร็จ</div>
          <div style={css("font-size:14px;color:#5B7A73;margin-top:8px;line-height:1.55;")}>บันทึกและส่งขึ้นระบบส่วนกลางเรียบร้อย</div>
          <div style={css("width:100%;max-width:340px;margin-top:30px;display:flex;flex-direction:column;gap:11px;")}>
            <HButton
              onClick={() => {
                // กลับหน้ากรอกใหม่ (view คงเป็น form อยู่แล้ว → effect scrollTo ไม่ทำงาน) จึงเด้งขึ้นบนสุดเอง
                setState({ result: null, resultRec: null });
                if (typeof window !== "undefined") window.scrollTo(0, 0);
              }}
              base="border:none;border-radius:13px;font-size:16px;font-weight:700;padding:15px;cursor:pointer;background:#0F8A80;color:#fff;box-shadow:0 10px 22px -8px rgba(15,138,128,.6);"
              hover="background:#0B655D"
            >
              ส่งรายงานใหม่
            </HButton>
            <HButton
              onClick={() => setState({ result: null, resultRec: null, view: "records" })}
              base="background:transparent;border:none;color:#0B655D;font-size:14.5px;font-weight:600;padding:11px;border-radius:11px;cursor:pointer;"
              hover="background:rgba(15,138,128,.08)"
            >
              ดูรายงานทั้งหมด
            </HButton>
          </div>
        </>
      ) : (
        <>
          <div
            style={css(
              "width:108px;height:108px;border-radius:999px;background:#FBDCDC;display:flex;align-items:center;justify-content:center;margin-bottom:20px;box-shadow:0 0 0 10px rgba(220,38,38,.10);"
            )}
          >
            <span style={css("font-size:58px;color:#DC2626;line-height:1;")}>✕</span>
          </div>
          <div style={css("font-size:30px;font-weight:800;color:#B91C1C;letter-spacing:-.4px;")}>ส่งไม่สำเร็จ</div>
          <div style={css("font-size:14px;color:#9B4444;margin-top:9px;line-height:1.55;")}>
            ข้อมูลถูกเก็บไว้ในเครื่องนี้แล้ว
            <br />
            แต่ยังไม่ขึ้นระบบส่วนกลาง
          </div>
          {/* คำแนะนำ Chrome ตัวใหญ่ + โลโก้ Chrome */}
          <div
            style={css(
              "margin-top:20px;width:100%;max-width:380px;box-sizing:border-box;background:#FEF3E5;border:1.5px solid #F5D6A6;border-radius:14px;padding:15px 18px;display:flex;align-items:center;gap:13px;"
            )}
          >
            {chromeLogo(38)}
            <div style={css("text-align:left;font-size:15.5px;font-weight:700;color:#B45309;line-height:1.45;")}>
              หากยังส่งไม่ได้ แนะนำให้เปิดผ่าน Google Chrome
            </div>
          </div>
          <div style={css("width:100%;max-width:340px;margin-top:24px;display:flex;flex-direction:column;gap:11px;")}>
            <HButton
              onClick={() => resendResult()}
              base={
                "border:none;border-radius:13px;font-size:16px;font-weight:700;padding:15px;cursor:pointer;background:#F5A623;color:#3B2200;box-shadow:0 10px 22px -8px rgba(245,166,35,.6);" +
                (S.resending ? "opacity:.6;pointer-events:none;" : "")
              }
              hover="background:#E4980E"
            >
              {S.resending ? "กำลังส่ง…" : "ส่งอีกครั้ง"}
            </HButton>
            <HButton
              onClick={() => setState({ result: null, resultRec: null })}
              base="background:#fff;border:1.5px solid #F3C5C2;color:#B91C1C;font-size:14.5px;font-weight:600;padding:12px;border-radius:13px;cursor:pointer;"
              hover="background:#FDECEC"
            >
              เก็บไว้ส่งทีหลัง
            </HButton>
          </div>
        </>
      )}
    </div>
  );
}
