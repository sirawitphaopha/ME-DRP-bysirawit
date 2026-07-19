"use client";
// ป๊อปประวัติการแก้ไขของยา (audit log · อ่านอย่างเดียว · กดที่ว่างปิดได้) — แยกจาก MedDrpApp.tsx (Phase 2b)
import React from "react";
import { fmtThaiDateTime } from "@/lib/helpers";
import { css } from "@/lib/style";
import { Drug } from "@/lib/types";
import { useMedDrp } from "@/components/MedDrpContext";

export default function DrugLogModal() {
  const { S, setState } = useMedDrp();
  const lg = S.drugLog!;
  const FIELD_TH: Record<string, string> = {
    generic: "ชื่อยา",
    strength: "ความแรง",
    unit: "หน่วย",
    percent: "เข้มข้น(%)",
    form: "รูปแบบ",
    route: "ทางให้",
    release: "ปลดปล่อย",
    brand: "ชื่อการค้า",
    had: "HAD",
    preg: "Preg",
    renal: "ปรับตามไต",
    hidden: "การแสดงผล",
  };
  const fmtVal = (k: string, v: unknown) => {
    if (k === "hidden") return v ? "ซ่อน" : "แสดง";
    if (v === null || v === undefined || v === "") return "—";
    if (k === "had" || k === "renal") return v ? "ใช่" : "ไม่";
    return String(v);
  };
  const diffFields = (o?: Partial<Drug> | null, n?: Partial<Drug> | null) => {
    const out: { k: string; from: string; to: string }[] = [];
    Object.keys(FIELD_TH).forEach((k) => {
      const ov = (o || {})[k as keyof Drug];
      const nv = (n || {})[k as keyof Drug];
      if (String(ov ?? "") !== String(nv ?? "")) out.push({ k, from: fmtVal(k, ov), to: fmtVal(k, nv) });
    });
    return out;
  };
  const actionLabel = (a: string) => (a === "INSERT" ? "เพิ่มเข้าคลัง" : a === "DELETE" ? "ลบออกจากคลัง" : "แก้ไข");
  const actionStyle = (a: string) =>
    "font-size:11.5px;font-weight:800;padding:2px 9px;border-radius:999px;" +
    (a === "INSERT" ? "background:#E7F3F1;color:#0B655D;" : a === "DELETE" ? "background:#FDECEC;color:#B42318;" : "background:#FEF3E2;color:#B45309;");
  return (
    <div
      onClick={() => setState({ drugLog: null })}
      style={css("position:fixed;inset:0;background:rgba(11,101,93,.4);backdrop-filter:blur(2px);z-index:86;display:flex;align-items:center;justify-content:center;padding:20px;")}
    >
      <div onClick={(e) => e.stopPropagation()} style={css("background:#fff;border-radius:18px;width:480px;max-width:100%;max-height:88vh;overflow:auto;box-shadow:0 30px 70px -20px rgba(11,101,93,.6);")}>
        <div style={css("background:linear-gradient(150deg,#0F8A80,#0B655D);color:#fff;padding:16px 20px;")}>
          <div style={css("font-weight:800;font-size:17px;")}>ประวัติการแก้ไข</div>
          <div style={css("font-size:12.5px;color:#CDEBE5;margin-top:2px;")}>{lg.drug.generic}</div>
        </div>
        <div style={css("padding:16px 20px;")}>
          {S.drugLogLoading ? (
            <div style={css("text-align:center;color:#94A3B8;font-size:14px;padding:24px;")}>กำลังโหลด…</div>
          ) : lg.entries.length === 0 ? (
            <div style={css("text-align:center;color:#94A3B8;font-size:14px;padding:24px;")}>ยังไม่มีประวัติการแก้ไข</div>
          ) : (
            <div style={css("display:flex;flex-direction:column;gap:11px;")}>
              {lg.entries.map((e) => {
                const changes = e.action === "UPDATE" ? diffFields(e.old_data, e.new_data) : [];
                return (
                  <div key={e.id} style={css("border:1px solid #E3EFEC;border-radius:12px;padding:11px 13px;")}>
                    <div style={css("display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap;")}>
                      <span style={css(actionStyle(e.action))}>{actionLabel(e.action)}</span>
                      <span style={css("font-size:12px;color:#64748B;")}>{fmtThaiDateTime(e.changed_at)}</span>
                    </div>
                    {e.action === "UPDATE" ? (
                      changes.length ? (
                        <div style={css("display:flex;flex-direction:column;gap:3px;")}>
                          {changes.map((c) => (
                            <div key={c.k} style={css("font-size:12.5px;color:#334155;line-height:1.5;")}>
                              <span style={css("color:#94A3B8;")}>{FIELD_TH[c.k]}:</span> {c.from} <span style={css("color:#0F8A80;font-weight:700;")}>→</span> {c.to}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={css("font-size:12.5px;color:#94A3B8;")}>ไม่มีการเปลี่ยนแปลงข้อมูล</div>
                      )
                    ) : e.action === "INSERT" ? (
                      <div style={css("font-size:12.5px;color:#475569;")}>เพิ่ม “{e.new_data?.generic || lg.drug.generic}” เข้าคลัง</div>
                    ) : (
                      <div style={css("font-size:12.5px;color:#475569;")}>ลบ “{e.old_data?.generic || lg.drug.generic}” ออกจากคลัง</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <button
            onClick={() => setState({ drugLog: null })}
            style={css("width:100%;margin-top:14px;border:1.5px solid #DCE7E5;background:#fff;color:#0B655D;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;")}
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
