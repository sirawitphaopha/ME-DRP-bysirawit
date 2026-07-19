"use client";
// หน้า "ตั้งค่า" (view "manage") — ถังขยะ + ยาที่ซ่อน + placeholder · แยกจาก MedDrpApp.tsx (Phase 2a)
import React from "react";
import { fmtThaiDateTime } from "@/lib/helpers";
import { css } from "@/lib/style";
import { HButton } from "@/components/ui";
import { useMedDrp } from "@/components/MedDrpContext";

export default function ManageView() {
  const { S, setState, doRestore, setDrugHidden, openDrugLog } = useMedDrp();
  const mCard = "background:#fff;border:1px solid #E3EFEC;border-radius:16px;padding:18px 20px;display:flex;align-items:flex-start;gap:13px;";
  const soon = "flex:none;background:#FEF3E2;color:#B45309;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;white-space:nowrap;";
  const hiddenDrugs = (S.drugs || []).filter((d) => d.hidden).sort((a, b) => a.generic.localeCompare(b.generic));
  const items = [
    { icon: "👥", title: "จัดการรายชื่อผู้รายงาน", desc: "เพิ่ม / ลบ / แก้ไขรายชื่อผู้รายงานเองได้ (ตอนนี้มี 16 คน)" },
    { icon: "🔽", title: "จัดการตัวเลือกในฟอร์ม", desc: "ประเภท Error · ประเภท DRP · จุดที่พบ · การ Intervention" },
    { icon: "🏥", title: "ข้อมูลหน่วยงาน", desc: "ชื่อโรงพยาบาล · ห้องยา · สำหรับหัวรายงานและไฟล์ส่งออก" },
  ];
  return (
    <div style={css("max-width:640px;margin:0 auto;padding:24px 16px 60px;display:flex;flex-direction:column;gap:14px;")}>
      <div style={css("padding:2px 2px 2px;")}>
        <div style={css("font-size:22px;font-weight:800;color:#0B655D;")}>⚙️ ตั้งค่า</div>
        <div style={css("font-size:12.5px;color:#64748B;margin-top:4px;line-height:1.5;")}>
          จัดการถังขยะได้ที่นี่ · หัวข้ออื่นด้านล่างกำลังพัฒนา ยังใช้งานไม่ได้
        </div>
      </div>

      {/* ถังขยะ — รายงานที่ลบแบบซ่อน (กู้คืน / ลบถาวร) */}
      <div style={css("background:#fff;border:1px solid #E3EFEC;border-radius:16px;padding:18px 20px;")}>
        <div style={css("font-size:15px;font-weight:800;color:#0B655D;")}>🗑 ถังขยะ</div>
        <div style={css("font-size:12px;color:#64748B;margin-top:3px;line-height:1.5;")}>
          รายงานที่ถูกลบ · เก็บไว้ให้กู้คืน จนกว่าจะลบถาวร
        </div>
        {S.trash.length === 0 ? (
          <div style={css("text-align:center;color:#94A3B8;font-size:13px;padding:20px 0 6px;")}>ไม่มีรายงานในถังขยะ</div>
        ) : (
          <div style={css("display:flex;flex-direction:column;gap:11px;margin-top:14px;")}>
            {S.trash.map((t) => {
              const isMed = t.type === "med";
              return (
                <div key={t.id} style={css("border:1px solid #E3EFEC;border-radius:13px;padding:13px 15px;")}>
                  <div style={css("display:flex;align-items:center;gap:9px;margin-bottom:4px;")}>
                    <span
                      style={css(
                        "font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px;" +
                          (isMed ? "background:#E7F3F1;color:#0B655D;" : "background:#FDECE8;color:#B4341C;")
                      )}
                    >
                      {isMed ? "Med Error" : "DRP"}
                    </span>
                    <span style={css("font-size:14px;font-weight:700;color:#0F172A;")}>HN {t.hn || "—"}</span>
                  </div>
                  <div style={css("font-size:12px;color:#64748B;margin-bottom:11px;")}>
                    {t.occurred_at || ""} · {t.reporter || "—"} · ลบเมื่อ {fmtThaiDateTime(t.deleted_at || undefined)}
                  </div>
                  <div style={css("display:flex;gap:9px;")}>
                    <HButton
                      onClick={() => !S.trashBusy && doRestore(t.id)}
                      base={
                        "border:1.5px solid #DCE7E5;background:#fff;color:#0B655D;font-size:13px;font-weight:700;padding:8px 14px;border-radius:9px;cursor:pointer;" +
                        (S.trashBusy ? "opacity:.5;pointer-events:none;" : "")
                      }
                      hover="background:#F5FAF9"
                    >
                      ↩ กู้คืน
                    </HButton>
                    <HButton
                      onClick={() => !S.trashBusy && setState({ hardTarget: t, hardInput: "" })}
                      base={
                        "border:1.5px solid #F3C5C2;background:#fff;color:#B91C1C;font-size:13px;font-weight:700;padding:8px 14px;border-radius:9px;cursor:pointer;" +
                        (S.trashBusy ? "opacity:.5;pointer-events:none;" : "")
                      }
                      hover="background:#FDECEC"
                    >
                      ลบถาวร
                    </HButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ยาที่ซ่อนอยู่ — กดเอากลับมาแสดงได้ (ลบจริงต้องทำใน Supabase) */}
      <div style={css("background:#fff;border:1px solid #E3EFEC;border-radius:16px;padding:18px 20px;")}>
        <div style={css("font-size:15px;font-weight:800;color:#0B655D;")}>💊 ยาที่ซ่อนอยู่</div>
        <div style={css("font-size:12px;color:#64748B;margin-top:3px;line-height:1.5;")}>
          ยาที่ซ่อนจะไม่โผล่ในการค้นหา/ตอนกรอกรายงาน · กดเอากลับมาแสดงได้ (ลบจริงทำได้เฉพาะใน Supabase)
        </div>
        {hiddenDrugs.length === 0 ? (
          <div style={css("text-align:center;color:#94A3B8;font-size:13px;padding:20px 0 6px;")}>ไม่มียาที่ซ่อนอยู่</div>
        ) : (
          <div style={css("display:flex;flex-direction:column;gap:11px;margin-top:14px;")}>
            {hiddenDrugs.map((d) => (
              <div key={d.id} style={css("border:1px solid #E3EFEC;border-radius:13px;padding:12px 15px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;")}>
                <div style={css("flex:1;min-width:0;")}>
                  <div style={css("font-size:14.5px;font-weight:700;color:#0F172A;")}>{d.generic}</div>
                  <div style={css("font-size:12px;color:#64748B;margin-top:2px;")}>
                    {[[d.strength, d.unit].filter(Boolean).join(" "), d.form, d.route].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <HButton
                  onClick={() => setDrugHidden(d, false)}
                  base={
                    "border:1.5px solid #DCE7E5;background:#fff;color:#0B655D;font-size:13px;font-weight:700;padding:8px 14px;border-radius:9px;cursor:pointer;" +
                    (S.drugBusy ? "opacity:.5;pointer-events:none;" : "")
                  }
                  hover="background:#F5FAF9"
                >
                  ↩ เอากลับมาแสดง
                </HButton>
                <button onClick={() => openDrugLog(d)} style={css("border:1px solid #DCE7E5;background:#fff;border-radius:9px;padding:8px 12px;font-size:13px;font-weight:700;cursor:pointer;color:#0B655D;")}>
                  ประวัติ
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {items.map((it) => (
        <div key={it.title} style={css(mCard)}>
          <div style={css("font-size:23px;line-height:1;")}>{it.icon}</div>
          <div style={css("flex:1;min-width:0;")}>
            <div style={css("font-size:14.5px;font-weight:700;color:#0F172A;")}>{it.title}</div>
            <div style={css("font-size:12.5px;color:#64748B;margin-top:3px;line-height:1.5;")}>{it.desc}</div>
          </div>
          <span style={css(soon)}>เร็ว ๆ นี้</span>
        </div>
      ))}
    </div>
  );
}
