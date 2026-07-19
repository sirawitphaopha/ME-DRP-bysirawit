"use client";
// หน้า "เกี่ยวกับ" (view "settings") — แยกออกจาก MedDrpApp.tsx (Phase 2a) · เนื้อหา JSX เดิมทุกอย่าง
import React from "react";
import { APP_VERSION } from "@/lib/constants";
import { css } from "@/lib/style";
import { useMedDrp } from "@/components/MedDrpContext";

export default function SettingsView() {
  const { S, isMobile, cfgConfigured } = useMedDrp();
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
