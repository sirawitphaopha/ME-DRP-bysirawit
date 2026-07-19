"use client";
// ป๊อปเพิ่ม/แก้ยา (S.drugEdit) — แยกจาก MedDrpApp.tsx (Phase 2b) · JSX เดิมทุกอย่าง
import React from "react";
import { css } from "@/lib/style";
import { chip, INPUT_FOCUS } from "@/lib/styles";
import { HButton, HInput, HSelect } from "@/components/ui";
import { Drug } from "@/lib/types";
import { useMedDrp } from "@/components/MedDrpContext";

export default function DrugEditModal() {
  const { S, setState, setDrugField, requestCloseDrugEdit, saveDrug, forceCloseDrugEdit } = useMedDrp();
  const d = S.drugEdit!;
  const fld = "width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:10px 12px;font-size:14px;outline:none;";
  const lab = "font-size:12.5px;font-weight:700;color:#475569;display:block;margin-bottom:5px;";
  const tchip = (on: boolean) => chip(on) + "flex:1;text-align:center;";
  // ตัวเลือก dropdown จากค่าที่มีอยู่จริงในคลัง (กันพิมพ์ไม่ตรงกัน) · ถ้าค่าปัจจุบันไม่อยู่ในลิสต์ ก็เติมเข้าไป
  const distinct = (key: keyof Drug) => {
    const set = new Set<string>();
    (S.drugs || []).forEach((x) => {
      const v = x[key];
      if (v) set.add(String(v));
    });
    const cur = d[key];
    if (cur && !set.has(String(cur))) set.add(String(cur));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  };
  const unitOpts = distinct("unit");
  const formOpts = distinct("form");
  const routeOpts = distinct("route");
  const dropdown = (label: string, key: keyof Drug, opts: string[]) => (
    <div style={css("flex:1;")}>
      <label style={css(lab)}>{label}</label>
      <HSelect value={(d[key] as string) || ""} onChange={(e) => setDrugField(key, e.target.value)} base={fld} focus={INPUT_FOCUS}>
        <option value="">— เลือก —</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </HSelect>
    </div>
  );
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={css("position:fixed;inset:0;background:rgba(11,101,93,.4);backdrop-filter:blur(2px);z-index:85;display:flex;align-items:center;justify-content:center;padding:20px;")}
    >
      <div style={css("background:#fff;border-radius:18px;width:460px;max-width:100%;max-height:90vh;overflow:auto;box-shadow:0 30px 70px -20px rgba(11,101,93,.6);")}>
        <div style={css("background:linear-gradient(150deg,#0F8A80,#0B655D);color:#fff;padding:16px 20px;font-weight:800;font-size:17px;")}>{S.drugEditNew ? "เพิ่มยา" : "แก้ไขยา"}</div>
        <div style={css("padding:18px 20px;display:flex;flex-direction:column;gap:12px;")}>
          <div>
            <label style={css(lab)}>
              ชื่อยา (generic) <span style={css("color:#DC2626;")}>*</span>
            </label>
            <HInput value={d.generic || ""} onChange={(e) => setDrugField("generic", e.target.value)} base={fld} focus={INPUT_FOCUS} />
          </div>
          <div style={css("display:flex;gap:10px;")}>
            <div style={css("flex:1;")}>
              <label style={css(lab)}>ความแรง</label>
              <HInput value={d.strength || ""} onChange={(e) => setDrugField("strength", e.target.value)} placeholder="500" base={fld} focus={INPUT_FOCUS} />
            </div>
            {dropdown("หน่วย", "unit", unitOpts)}
            <div style={css("flex:1;")}>
              <label style={css(lab)}>เข้มข้น (%)</label>
              <HInput value={d.percent || ""} onChange={(e) => setDrugField("percent", e.target.value)} base={fld} focus={INPUT_FOCUS} />
            </div>
          </div>
          <div style={css("display:flex;gap:10px;")}>
            {dropdown("รูปแบบ", "form", formOpts)}
            {dropdown("ทางให้ยา", "route", routeOpts)}
            <div style={css("flex:1;")}>
              <label style={css(lab)}>ปลดปล่อย</label>
              <HInput value={d.release || ""} onChange={(e) => setDrugField("release", e.target.value)} placeholder="ER, SR" base={fld} focus={INPUT_FOCUS} />
            </div>
          </div>
          <div>
            <label style={css(lab)}>ชื่อการค้า</label>
            <HInput value={d.brand || ""} onChange={(e) => setDrugField("brand", e.target.value)} base={fld} focus={INPUT_FOCUS} />
          </div>
          <div style={css("display:flex;gap:10px;")}>
            <div style={css("flex:1;")}>
              <label style={css(lab)}>Preg category</label>
              <HSelect value={d.preg || ""} onChange={(e) => setDrugField("preg", e.target.value)} base={fld} focus={INPUT_FOCUS}>
                {["", "A", "B", "C", "D", "X"].map((p) => (
                  <option key={p} value={p}>
                    {p || "—"}
                  </option>
                ))}
              </HSelect>
            </div>
            <div style={css("flex:1;")}>
              <label style={css(lab)}>ปรับขนาดตามไต</label>
              <div style={css("display:flex;gap:8px;")}>
                <button onClick={() => setDrugField("renal", false)} style={css(tchip(!d.renal))}>ไม่</button>
                <button onClick={() => setDrugField("renal", true)} style={css(tchip(!!d.renal))}>ใช่</button>
              </div>
            </div>
          </div>
          <div>
            <label style={css(lab)}>ยา High-alert (HAD)</label>
            <div style={css("display:flex;gap:8px;")}>
              <button onClick={() => setDrugField("had", false)} style={css(tchip(!d.had))}>ไม่ใช่ HAD</button>
              <button onClick={() => setDrugField("had", true)} style={css(tchip(!!d.had))}>เป็น HAD</button>
            </div>
          </div>
          <div style={css("display:flex;gap:10px;margin-top:6px;")}>
            <HButton onClick={() => requestCloseDrugEdit()} base="flex:1;border:1.5px solid #DCE7E5;background:#fff;color:#0B655D;font-size:14px;font-weight:700;padding:12px;border-radius:11px;cursor:pointer;" hover="background:#F5FAF9">
              ยกเลิก
            </HButton>
            <HButton
              onClick={() => saveDrug()}
              base={"flex:1;border:none;background:#0F8A80;color:#fff;font-size:14px;font-weight:700;padding:12px;border-radius:11px;cursor:pointer;" + (S.drugBusy ? "opacity:.6;pointer-events:none;" : "")}
              hover="background:#0B655D"
            >
              {S.drugBusy ? "กำลังบันทึก…" : "บันทึก"}
            </HButton>
          </div>
        </div>
      </div>
      {/* ยืนยันปิดทั้งที่แก้ค้าง — คลิกนอกป๊อปไม่ปิด ต้องกดปุ่มเอง */}
      {S.drugEditConfirmClose && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={css("position:fixed;inset:0;background:rgba(11,101,93,.5);z-index:87;display:flex;align-items:center;justify-content:center;padding:20px;")}
        >
          <div style={css("background:#fff;border-radius:16px;width:380px;max-width:100%;padding:22px;box-shadow:0 30px 70px -20px rgba(11,101,93,.6);")}>
            <div style={css("font-size:16px;font-weight:800;color:#0B655D;margin-bottom:8px;")}>ปิดโดยไม่บันทึก</div>
            <div style={css("font-size:14px;color:#475569;line-height:1.55;margin-bottom:18px;")}>กำลังแก้ไขข้อมูลยาอยู่ ถ้าปิดตอนนี้ สิ่งที่แก้ไว้จะหาย</div>
            <div style={css("display:flex;gap:10px;")}>
              <HButton onClick={() => forceCloseDrugEdit()} base="flex:1;border:none;background:#DC2626;color:#fff;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;" hover="background:#B91C1C">
                ทิ้งการแก้ไข
              </HButton>
              <HButton onClick={() => setState({ drugEditConfirmClose: false })} base="flex:1;border:1.5px solid #DCE7E5;background:#fff;color:#0B655D;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;" hover="background:#F5FAF9">
                กลับไปแก้ต่อ
              </HButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
