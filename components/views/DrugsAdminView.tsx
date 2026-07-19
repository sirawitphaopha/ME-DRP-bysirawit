"use client";
// หน้า "คลังยา" (view "drugs") — จัดการ master data · แยกจาก MedDrpApp.tsx (Phase 2b) · JSX เดิมทุกอย่าง
import React from "react";
import { AM, AMT } from "@/lib/constants";
import { css } from "@/lib/style";
import { INPUT_FOCUS } from "@/lib/styles";
import { HButton, HInput, HTr } from "@/components/ui";
import { Drug } from "@/lib/types";
import { useMedDrp } from "@/components/MedDrpContext";

export default function DrugsAdminView() {
  const {
    S,
    isMobile,
    setState,
    getFilteredDrugs,
    exportDrugsCsv,
    openAddDrug,
    openEditDrug,
    openDrugLog,
    setDrugHidden,
    toggleDrugFilter,
    clearDrugFilters,
    toggleDrugSort,
  } = useMedDrp();
  const list = getFilteredDrugs(S);
  const total = (S.drugs || []).filter((d) => !d.hidden).length;
  const hiddenCount = (S.drugs || []).filter((d) => d.hidden).length;
  // ตัวกรองรูปแบบยา — เอา form ที่มีจริงในคลัง (บ่อยสุด 6 อันแรก)
  const formCounts: Record<string, number> = {};
  (S.drugs || []).forEach((d) => {
    if (d.form) formCounts[d.form] = (formCounts[d.form] || 0) + 1;
  });
  const forms = Object.keys(formCounts)
    .sort((a, b) => formCounts[b] - formCounts[a])
    .slice(0, 6);
  const filters: { key: string; label: string }[] = [
    { key: "had", label: "HAD" },
    ...forms.map((fm) => ({ key: "form:" + fm, label: fm })),
    { key: "pregDX", label: "Preg D/X" },
  ];
  const fchip = (on: boolean) =>
    on
      ? "border:1px solid " + AM + ";background:" + AM + ";color:" + AMT + ";border-radius:999px;padding:7px 13px;font-size:13px;font-weight:600;cursor:pointer;"
      : "border:1px solid #CFE7E2;background:#EAF4F1;color:#0B655D;border-radius:999px;padding:7px 13px;font-size:13px;font-weight:600;cursor:pointer;";
  const tag = (bg: string, fg: string) => "font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px;background:" + bg + ";color:" + fg + ";";
  const rowBtn = "border:1px solid #DCE7E5;background:#fff;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;color:#0B655D;";
  const hideBtn = "border:1px solid #F0D8AE;background:#FEF7EC;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;color:#B45309;";
  const doseText = (d: Drug) => [d.strength, d.unit].filter(Boolean).join(" ") + (d.percent ? " " + d.percent + "%" : "");
  const stickyTop = isMobile ? 94 : 58; // ตรึงแถบค้นหา/กรองใต้หัวเมนู
  // คอลัมน์ตาราง (กดหัวเรียงได้) — ชื่อการค้าย้ายมาที่ 2 · เพิ่ม ID · "ธง"→"HAD"
  const cols: { key: string; label: string; w: string; sortable: boolean }[] = [
    { key: "id", label: "ID", w: "58px", sortable: true },
    { key: "generic", label: "ชื่อยา (generic)", w: "auto", sortable: true },
    { key: "brand", label: "ชื่อการค้า", w: "150px", sortable: true },
    { key: "strength", label: "ความแรง", w: "104px", sortable: true },
    { key: "form", label: "รูปแบบ", w: "90px", sortable: true },
    { key: "route", label: "ทางให้", w: "78px", sortable: true },
    { key: "had", label: "HAD", w: "66px", sortable: true },
    { key: "preg", label: "Preg", w: "64px", sortable: true },
    { key: "_actions", label: "", w: "212px", sortable: false },
  ];
  const sortArrow = (key: string) =>
    S.drugSort?.key === key ? (S.drugSort.dir === "asc" ? " ▲" : " ▼") : <span style={css("opacity:.4;")}> ↕</span>;

  return (
    <div style={css("max-width:1080px;margin:0 auto;padding:22px 16px 80px;")}>
      <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:16px;padding:18px 20px;")}>
        {/* หัวข้อ + ปุ่ม (ไม่ตรึง) */}
        <div style={css("display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:10px;")}>
          <div>
            <div style={css("font-size:22px;font-weight:800;color:#0B655D;")}>💊 คลังยา</div>
            <div style={css("font-size:12.5px;color:#64748B;margin-top:4px;")}>รายการยาทั้งหมดในระบบ · แก้ไขแล้วเข้า Supabase ทันที · ทุกเครื่องเห็นสด</div>
          </div>
          <div style={css("display:flex;gap:9px;")}>
            <HButton onClick={() => exportDrugsCsv()} base="border:1.5px solid #DCE7E5;background:#fff;color:#0B655D;font-size:13.5px;font-weight:700;padding:10px 16px;border-radius:10px;cursor:pointer;" hover="background:#F5FAF9">
              ↓ ส่งออก CSV
            </HButton>
            <HButton onClick={() => openAddDrug()} base="border:none;background:#0F8A80;color:#fff;font-size:13.5px;font-weight:700;padding:10px 16px;border-radius:10px;cursor:pointer;" hover="background:#0B655D">
              ＋ เพิ่มยา
            </HButton>
          </div>
        </div>

        {/* แถบค้นหา + ตัวกรอง (ตรึงไว้ด้านบน) */}
        <div style={css("position:sticky;top:" + stickyTop + "px;z-index:15;background:#fff;padding:14px 0 12px;margin:6px 0 4px;border-bottom:1px solid #EEF4F2;display:flex;flex-direction:column;gap:10px;")}>
          <HInput
            value={S.drugSearch}
            onChange={(e) => setState({ drugSearch: e.target.value })}
            placeholder="ค้นหาชื่อยา / ชื่อการค้า"
            base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:11px 14px;font-size:14px;outline:none;"
            focus={INPUT_FOCUS}
          />
          <div style={css("display:flex;gap:7px;flex-wrap:wrap;align-items:center;")}>
            {filters.map((fl) => (
              <button key={fl.key} onClick={() => toggleDrugFilter(fl.key)} style={css(fchip(S.drugFilters.includes(fl.key)))}>
                {fl.label}
              </button>
            ))}
            {S.drugFilters.length > 0 && (
              <button onClick={() => clearDrugFilters()} style={css("border:1px solid #F3C5C2;background:#fff;color:#B91C1C;border-radius:999px;padding:7px 13px;font-size:13px;font-weight:700;cursor:pointer;")}>
                ✕ ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>

        {isMobile ? (
          <div style={css("display:flex;flex-direction:column;gap:10px;")}>
            {list.map((d) => (
              <div key={d.id} style={css("border:1px solid #DEEBE8;border-radius:13px;padding:12px 14px;")}>
                <div style={css("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px;")}>
                  <span style={css("font-size:11px;font-weight:700;color:#94A3B8;")}>#{d.id}</span>
                  <span style={css("font-weight:800;color:#0F172A;font-size:15px;")}>{d.generic}</span>
                  {d.had && <span style={css(tag("#FDECEC", "#B42318"))}>HAD</span>}
                  {d.preg && <span style={css(tag("#EEF2FF", "#3730A3"))}>Preg {d.preg}</span>}
                </div>
                <div style={css("font-size:12.5px;color:#475569;line-height:1.6;")}>
                  {d.brand ? d.brand + " · " : ""}
                  {[doseText(d), d.form, d.route].filter(Boolean).join(" · ")}
                </div>
                <div style={css("display:flex;gap:8px;margin-top:10px;")}>
                  <button onClick={() => openEditDrug(d)} style={css(rowBtn)}>แก้ไข</button>
                  <button onClick={() => openDrugLog(d)} style={css(rowBtn)}>ประวัติ</button>
                  <button onClick={() => setDrugHidden(d, true)} style={css(hideBtn)}>ซ่อน</button>
                </div>
              </div>
            ))}
            {list.length === 0 && <div style={css("padding:30px;text-align:center;color:#94A3B8;font-size:14px;")}>ไม่พบยาตามเงื่อนไข</div>}
          </div>
        ) : (
          <div style={css("overflow-x:auto;")}>
            <table style={css("width:100%;border-collapse:collapse;font-size:13px;min-width:980px;table-layout:fixed;")}>
              <colgroup>
                {cols.map((c) => (
                  <col key={c.key} style={c.w === "auto" ? undefined : { width: c.w }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {cols.map((c, i) => (
                    <th
                      key={c.key}
                      onClick={c.sortable ? () => toggleDrugSort(c.key) : undefined}
                      style={css(
                        "padding:11px 12px;text-align:left;font-weight:700;color:#fff;background:#0B655D;white-space:nowrap;" +
                          (c.sortable ? "cursor:pointer;" : "") +
                          (i === 0 ? "border-radius:9px 0 0 9px;" : "") +
                          (i === cols.length - 1 ? "border-radius:0 9px 9px 0;" : "")
                      )}
                    >
                      {c.label}
                      {c.sortable ? sortArrow(c.key) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((d) => (
                  <HTr key={d.id} base="border-bottom:1px solid #F1F6F5;" hover="background:#F9FCFB">
                    <td style={css("padding:11px 12px;color:#94A3B8;font-size:12px;")}>{d.id}</td>
                    <td style={css("padding:11px 12px;color:#0F172A;font-weight:700;")}>{d.generic}</td>
                    <td style={css("padding:11px 12px;color:#334155;")}>{d.brand || "—"}</td>
                    <td style={css("padding:11px 12px;color:#334155;")}>{doseText(d) || "—"}</td>
                    <td style={css("padding:11px 12px;color:#334155;")}>
                      {d.form || "—"}
                      {d.release ? " " + d.release : ""}
                    </td>
                    <td style={css("padding:11px 12px;color:#334155;")}>{d.route || "—"}</td>
                    <td style={css("padding:11px 12px;")}>{d.had ? <span style={css(tag("#FDECEC", "#B42318"))}>HAD</span> : ""}</td>
                    <td style={css("padding:11px 12px;")}>{d.preg ? <span style={css(tag("#EEF2FF", "#3730A3"))}>{d.preg}</span> : "—"}</td>
                    <td style={css("padding:11px 12px;white-space:nowrap;")}>
                      <button onClick={() => openEditDrug(d)} style={css(rowBtn + "margin-right:6px;")}>แก้ไข</button>
                      <button onClick={() => openDrugLog(d)} style={css(rowBtn + "margin-right:6px;")}>ประวัติ</button>
                      <button onClick={() => setDrugHidden(d, true)} style={css(hideBtn)}>ซ่อน</button>
                    </td>
                  </HTr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && <div style={css("padding:30px;text-align:center;color:#94A3B8;font-size:14px;")}>ไม่พบยาตามเงื่อนไข</div>}
          </div>
        )}
        <div style={css("font-size:12px;color:#64748B;margin-top:12px;")}>
          แสดง {list.length} จาก {total} รายการ
          {hiddenCount > 0 ? (
            <span>
              {" · ซ่อนอยู่ " + hiddenCount + " รายการ ("}
              <span onClick={() => setState({ view: "manage" })} style={css("color:#0F8A80;font-weight:700;cursor:pointer;text-decoration:underline;")}>
                ดูที่ตั้งค่า
              </span>
              {")"}
            </span>
          ) : null}
        </div>
      </div>

      {/* ปุ่มเลื่อนขึ้นบนสุด / ลงล่างสุด (ลอยมุมขวาล่าง) */}
      <div style={css("position:fixed;right:18px;bottom:22px;z-index:40;display:flex;flex-direction:column;gap:8px;")}>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="ขึ้นบนสุด"
          style={css("width:42px;height:42px;border-radius:999px;border:none;cursor:pointer;background:#0B655D;color:#fff;font-size:18px;box-shadow:0 8px 20px -6px rgba(11,101,93,.6);")}
        >
          ↑
        </button>
        <button
          onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
          aria-label="ลงล่างสุด"
          style={css("width:42px;height:42px;border-radius:999px;border:none;cursor:pointer;background:#0B655D;color:#fff;font-size:18px;box-shadow:0 8px 20px -6px rgba(11,101,93,.6);")}
        >
          ↓
        </button>
      </div>
    </div>
  );
}
