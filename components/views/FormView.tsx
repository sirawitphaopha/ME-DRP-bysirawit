"use client";
// หน้ากรอกรายงาน (view "form") — Med Error / DRP · แยกจาก MedDrpApp.tsx (Phase 2f) · JSX เดิมทุกอย่าง
import React from "react";
import { CONSULT_DOCTOR, DRP_TYPES, ERROR_NATURE, ERROR_TYPES, INTERVENTIONS, IPD_LOCATION, LOCATIONS, OUTCOMES, SEV_TIERS, SEVERITY, SHIFTS, SOURCE_UNITS } from "@/lib/constants";
import { natureToArray, shiftOf, today } from "@/lib/helpers";
import { formatAn } from "@/lib/records";
import { css } from "@/lib/style";
import { chip, INPUT_BASE, INPUT_FOCUS, seg, SHIFT_TIME, shiftBtn } from "@/lib/styles";
import { HButton, HInput, HSelect, HTextarea } from "@/components/ui";
import { useMedDrp } from "@/components/MedDrpContext";

export default function FormView() {
  const {
    S,
    isMobile,
    clock,
    setState,
    setField,
    requestSwitchType,
    toggleHighAlert,
    save,
    toggleSourceUnit,
    toggleErrType,
    toggleNature,
    setLocation,
    setDrpType,
    setDrugAt,
    pickDrug,
    removeDrug,
    addDrug,
    renderReporterDD,
    drugPickerUI,
  } = useMedDrp();
  const f = S.form;
  const type = S.type;
  const errTypeSel = ERROR_TYPES.filter((t) => natureToArray(f.error_type).includes(t.key));
  const sevObj = SEVERITY.find((s) => s.code === f.severity);
  const drpObj = DRP_TYPES.find((t) => t.key === f.drp_type);

  // ช่องเลือกระดับความรุนแรง A–I (NCC MERP) — ใช้ร่วมทั้ง Med Error และ DRP (บังคับกรอกทั้งคู่)
  const renderSeverityField = () => (
    <div style={css("margin-bottom:16px;")}>
      <div style={css("display:flex;align-items:center;margin-bottom:8px;gap:8px;")}>
        <label style={css("font-size:13px;font-weight:600;color:#475569;")}>
          ระดับความรุนแรง <span style={css("color:#94A3B8;font-weight:400;")}>NCC MERP</span>{" "}
          <span style={css("color:#DC2626;")}>*</span>
        </label>
        <HButton
          onClick={() => setState((st) => ({ showSevLegend: !st.showSevLegend }))}
          base="margin-left:auto;border:1px solid #F6D89A;background:#FEF7EC;color:#B45309;font-size:12px;font-weight:600;padding:4px 11px;border-radius:999px;cursor:pointer;display:flex;align-items:center;gap:5px;"
          hover="background:#FDEFD6"
        >
          ⓘ {S.showSevLegend ? "ซ่อนความหมาย A–I" : "ดูความหมาย A–I"}
        </HButton>
      </div>
      <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:8px;")}>
        {SEV_TIERS.map((gm) => (
          <div key={gm.label} style={css("border:1px solid " + gm.bd + ";background:" + gm.base + ";border-radius:11px;padding:8px 10px;")}>
            <div style={css("font-size:11px;font-weight:700;color:" + gm.tx + ";margin-bottom:6px;")}>{gm.label}</div>
            <div style={css("display:flex;gap:5px;")}>
              {gm.codes.map((code) => {
                const sl = f.severity === code;
                const stStr = sl
                  ? "flex:1;min-width:0;height:40px;display:flex;align-items:center;justify-content:center;border-radius:8px;border:1.5px solid " +
                    gm.sel +
                    ";background:" +
                    gm.sel +
                    ";color:#fff;font-weight:700;font-size:15px;cursor:pointer;transition:all .12s;box-shadow:0 5px 12px -3px " +
                    gm.sel +
                    "99;"
                  : "flex:1;min-width:0;height:40px;display:flex;align-items:center;justify-content:center;border-radius:8px;border:1.5px solid " +
                    gm.bd +
                    ";background:#fff;color:" +
                    gm.tx +
                    ";font-weight:700;font-size:15px;cursor:pointer;transition:all .12s;";
                return (
                  <button key={code} onClick={() => setField("severity", sl ? "" : code)} style={css(stStr)}>
                    {code}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {sevObj && <div style={css("margin-top:9px;font-size:13px;color:#B45309;font-weight:500;line-height:1.5;")}>{sevObj.desc}</div>}
      {S.errors.severity && (
        <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาเลือกระดับความรุนแรง</div>
      )}
      {S.showSevLegend && (
        <div
          style={css(
            "margin-top:10px;background:#FBFDFC;border:1px solid #E3EFEC;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;"
          )}
        >
          <div style={css("font-size:12.5px;font-weight:700;color:#0B655D;")}>ความหมายระดับความรุนแรง (NCC MERP Index)</div>
          {SEVERITY.map((s) => {
            const gm = SEV_TIERS.find((t) => t.codes.includes(s.code))!;
            return (
              <div key={s.code} style={css("display:flex;gap:10px;align-items:flex-start;")}>
                <span
                  style={css(
                    "flex:none;width:24px;height:24px;border-radius:7px;background:" +
                      gm.sel +
                      ";color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;"
                  )}
                >
                  {s.code}
                </span>
                <span style={css("font-size:12.5px;color:#475569;line-height:1.45;padding-top:3px;")}>{s.desc}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderDrugRows = () =>
    drugPickerUI({
      rows: f.drugs || [""],
      sug: S.drugSug,
      onSug: (v) => setState({ drugSug: v }),
      onBlur: (i) => setState((s) => (s.drugSug && s.drugSug.i === i ? { drugSug: null } : {})),
      onChangeAt: setDrugAt,
      onPick: pickDrug,
      onRemove: removeDrug,
      onAdd: addDrug,
      placeholder: type === "med" ? "พิมพ์ค้นหายา เช่น Amox…" : "พิมพ์ค้นหายา เช่น Warfarin…",
    });

  // จุดที่พบ — ใช้ร่วมทั้ง Med และ DRP (วางก่อน HN · เลือก IPD แล้วจึงกรอก AN ได้)
  const renderLocationField = () => (
    <div style={css("margin-bottom:16px;")}>
      <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
        จุดที่พบ <span style={css("color:#DC2626;")}>*</span>
      </label>
      <HSelect
        value={f.location}
        onChange={(e) => setLocation(e.target.value)}
        base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:12px 40px 12px 14px;font-size:15px;color:#0F172A;background-color:#fff;outline:none;"
        focus={INPUT_FOCUS}
      >
        {LOCATIONS.map((loc) => (
          <option key={loc} value={loc}>
            {loc}
          </option>
        ))}
      </HSelect>
      {S.errors.location && (
        <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาเลือกจุดที่พบ</div>
      )}
    </div>
  );

  // หน่วยงาน/วิชาชีพต้นเหตุ — ช่องร่วม Med/DRP (ชิปเลือกหลายอัน + "อื่น ๆ" พิมพ์ระบุ · บังคับกรอก)
  const renderSourceUnitsField = () => {
    const sel = Array.isArray(f.source_units) ? f.source_units : [];
    const showOther = sel.includes("อื่น ๆ");
    return (
      <div style={css("margin-bottom:16px;")}>
        <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:8px;")}>
          หน่วยงานต้นเหตุ <span style={css("color:#94A3B8;font-weight:400;")}>เกิดจากใคร/หน่วยไหน · เลือกได้หลายอัน</span> <span style={css("color:#DC2626;")}>*</span>
        </label>
        <div style={css("display:flex;flex-wrap:wrap;gap:8px;")}>
          {SOURCE_UNITS.map((u) => (
            <button key={u} onClick={() => toggleSourceUnit(u)} style={css(chip(sel.includes(u)))}>
              {u}
            </button>
          ))}
        </div>
        {showOther && (
          <>
            <HInput
              value={f.source_unit_other}
              onChange={(e) => setField("source_unit_other", e.target.value)}
              placeholder="ระบุหน่วยงาน/วิชาชีพเพิ่มเติม…"
              base="width:100%;box-sizing:border-box;margin-top:8px;border:1.5px solid #DCE7E5;border-radius:11px;padding:11px 14px;font-size:15px;color:#0F172A;background:#fff;outline:none;"
              focus={INPUT_FOCUS}
            />
            {S.errors.source_unit_other && (
              <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาระบุหน่วยงานต้นเหตุ</div>
            )}
          </>
        )}
        {S.errors.source_units && (
          <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาเลือกหน่วยงานต้นเหตุ</div>
        )}
      </div>
    );
  };

  // บล็อกเลือก "ประเภท Error" (ขั้นตอนที่พลาด) — ใช้ร่วมทั้งฟอร์ม Med Error และ DRP
  const renderErrorTypeField = () => (
    <div style={css("margin-bottom:16px;")}>
      <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:8px;")}>
        ประเภท Error <span style={css("color:#DC2626;")}>*</span>{" "}
        <span style={css("color:#94A3B8;font-weight:400;")}>ขั้นตอนที่พลาด · เลือกได้หลายอัน</span>
      </label>
      <div style={css(isMobile ? "display:grid;grid-template-columns:1fr 1fr;gap:8px;" : "display:flex;flex-wrap:wrap;gap:8px;")}>
        {ERROR_TYPES.map((t, i) => {
          const sel = natureToArray(f.error_type).includes(t.key);
          // ปุ่มตัวสุดท้ายที่เหลือเดี่ยว (จำนวนคี่) → span เต็มแถว อยู่กลาง สมมาตร + ไม่ลดฟอนต์
          const lastOdd = isMobile && i === ERROR_TYPES.length - 1 && ERROR_TYPES.length % 2 === 1;
          return (
            <button
              key={t.key}
              onClick={() => toggleErrType(t.key)}
              style={css(
                chip(sel) +
                  (isMobile
                    ? lastOdd
                      ? "grid-column:1 / -1;width:100%;box-sizing:border-box;text-align:center;white-space:normal;line-height:1.25;padding:10px 8px;"
                      : "width:100%;box-sizing:border-box;text-align:center;font-size:12.5px;white-space:normal;line-height:1.25;padding:10px 8px;"
                    : "")
              )}
            >
              {t.key}
              {t.th ? (
                <>
                  {" "}
                  <span style={{ whiteSpace: "nowrap" }}>({t.th})</span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
      {errTypeSel.length > 0 && (
        <div
          style={css(
            "margin-top:9px;background:#FEF7EC;border:1px solid #F6D89A;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:9px;"
          )}
        >
          {errTypeSel.map((t) => (
            <div key={t.key} style={css("display:flex;gap:9px;align-items:flex-start;")}>
              <span
                style={css(
                  "flex:none;background:#F5A623;color:#3B2200;font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;white-space:nowrap;"
                )}
              >
                {t.th || t.key}
              </span>
              <span style={css("font-size:12.5px;color:#92400E;line-height:1.5;")}>{t.desc}</span>
            </div>
          ))}
        </div>
      )}
      {S.errors.error_type && (
        <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาเลือกประเภท Error</div>
      )}
    </div>
  );

  const renderMedFields = () => {
    const natureSel = ERROR_NATURE.filter((n) => Array.isArray(f.error_nature) && f.error_nature.includes(n.key));
    const hasNatureSel = Array.isArray(f.error_nature) && f.error_nature.length > 0;
    const showNatureOther = Array.isArray(f.error_nature) && f.error_nature.includes("อื่น ๆ");
    return (
      <div>
        {/* ประเภท Error (ช่องร่วม Med/DRP) */}
        {renderErrorTypeField()}

        {/* ลักษณะความคลาดเคลื่อน (multi) */}
        <div style={css("margin-bottom:16px;")}>
          <div style={css("display:flex;align-items:center;margin-bottom:8px;gap:8px;")}>
            <label style={css("font-size:13px;font-weight:600;color:#475569;")}>
              ลักษณะความคลาดเคลื่อน <span style={css("color:#DC2626;")}>*</span> <span style={css("color:#94A3B8;font-weight:400;")}>ผิดอะไร · เลือกได้หลายอัน</span>
            </label>
            <HButton
              onClick={() => setState((st) => ({ showNatureLegend: !st.showNatureLegend }))}
              base="margin-left:auto;border:1px solid #F6D89A;background:#FEF7EC;color:#B45309;font-size:12px;font-weight:600;padding:4px 11px;border-radius:999px;cursor:pointer;display:flex;align-items:center;gap:5px;white-space:nowrap;"
              hover="background:#FDEFD6"
            >
              ⓘ {S.showNatureLegend ? "ซ่อนความหมาย" : "ดูความหมาย"}
            </HButton>
          </div>
          <div style={css("display:flex;flex-wrap:wrap;gap:8px;")}>
            {ERROR_NATURE.map((n) => (
              <button
                key={n.key}
                onClick={() => toggleNature(n.key)}
                style={css(chip(Array.isArray(f.error_nature) && f.error_nature.includes(n.key)))}
              >
                {n.key}
              </button>
            ))}
          </div>
          {hasNatureSel && (
            <div
              style={css(
                "margin-top:9px;background:#FEF7EC;border:1px solid #F6D89A;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:9px;"
              )}
            >
              {natureSel.map((n) => (
                <div key={n.key} style={css("display:flex;gap:9px;align-items:flex-start;")}>
                  <span
                    style={css(
                      "flex:none;background:#F5A623;color:#3B2200;font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;white-space:nowrap;"
                    )}
                  >
                    {n.key}
                  </span>
                  <span style={css("font-size:12.5px;color:#92400E;line-height:1.5;")}>{n.desc}</span>
                </div>
              ))}
            </div>
          )}
          {showNatureOther && (
            <>
              <HInput
                value={f.error_nature_other}
                onChange={(e) => setField("error_nature_other", e.target.value)}
                placeholder="ระบุลักษณะเพิ่มเติม…"
                base="width:100%;box-sizing:border-box;margin-top:8px;border:1.5px solid #DCE7E5;border-radius:11px;padding:11px 14px;font-size:15px;color:#0F172A;background:#fff;outline:none;"
                focus={INPUT_FOCUS}
              />
              {S.errors.error_nature_other && (
                <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาระบุลักษณะเพิ่มเติม</div>
              )}
            </>
          )}
          {S.errors.error_nature && (
            <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาเลือกลักษณะความคลาดเคลื่อน</div>
          )}
          {S.showNatureLegend && (
            <div
              style={css(
                "margin-top:10px;background:#FBFDFC;border:1px solid #E3EFEC;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;"
              )}
            >
              <div style={css("font-size:12.5px;font-weight:700;color:#0B655D;")}>ความหมายลักษณะความคลาดเคลื่อน</div>
              {ERROR_NATURE.map((n) => (
                <div key={n.key} style={css("display:flex;gap:10px;align-items:flex-start;")}>
                  <span
                    style={css(
                      "flex:none;background:#F5A623;color:#3B2200;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;white-space:nowrap;"
                    )}
                  >
                    {n.key}
                  </span>
                  <span style={css("font-size:12.5px;color:#475569;line-height:1.45;padding-top:2px;")}>{n.desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ระดับความรุนแรง A–I (ใช้ช่องร่วมกับ DRP) */}
        {renderSeverityField()}

        {/* ชื่อยา */}
        <div style={css("margin-bottom:16px;")}>
          <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
            ชื่อยาที่เกี่ยวข้อง <span style={css("color:#94A3B8;font-weight:400;")}>เพิ่มได้หลายตัว</span>
          </label>
          {renderDrugRows()}
        </div>

        {/* รายละเอียด */}
        <div style={css("margin-bottom:16px;")}>
          <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
            รายละเอียดเหตุการณ์ <span style={css("color:#DC2626;")}>*</span>
          </label>
          <HTextarea
            value={f.detail}
            onChange={(e) => setField("detail", e.target.value)}
            rows={3}
            placeholder="พิมพ์คร่าว ๆ ว่าเกิดอะไรขึ้น…"
            base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:12px 14px;font-size:15px;color:#0F172A;background:#fff;outline:none;resize:vertical;line-height:1.55;"
            focus={INPUT_FOCUS}
          />
          {S.errors.detail && (
            <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณากรอกรายละเอียดเหตุการณ์</div>
          )}
        </div>
        <div style={css("margin-bottom:18px;")}>
          <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>การแก้ไข / จัดการ</label>
          {/* ติ๊กพอ = ถือว่าจัดการเรียบร้อย (บางเคสไม่มีอะไรต้องบรรยาย) · จะพิมพ์รายละเอียดเพิ่มด้วยก็ได้ */}
          <HButton
            onClick={() => setField("managed", !f.managed)}
            base={
              "width:100%;box-sizing:border-box;display:flex;align-items:center;gap:10px;text-align:left;margin-bottom:8px;padding:11px 14px;border-radius:11px;font-size:14.5px;font-weight:600;cursor:pointer;transition:all .15s;" +
              (f.managed
                ? "border:1.5px solid #0F8A80;background:#E8F5F3;color:#0B655D;"
                : "border:1.5px solid #DCE7E5;background:#fff;color:#64748B;")
            }
            hover={f.managed ? "background:#DDEFEC;" : "border-color:#0F8A80;color:#0F8A80;"}
          >
            <span
              style={css(
                "width:20px;height:20px;flex:0 0 20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;" +
                  (f.managed ? "background:#0F8A80;color:#fff;" : "background:#fff;border:1.5px solid #CBD5E1;color:transparent;")
              )}
            >
              ✓
            </span>
            แก้ไขเรียบร้อยแล้ว
          </HButton>
          <HTextarea
            value={f.management}
            onChange={(e) => setField("management", e.target.value)}
            rows={2}
            placeholder="ดำเนินการอย่างไรต่อ… (จะพิมพ์เพิ่มหรือไม่ก็ได้)"
            base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:12px 14px;font-size:15px;color:#0F172A;background:#fff;outline:none;resize:vertical;line-height:1.55;"
            focus={INPUT_FOCUS}
          />
        </div>
      </div>
    );
  };

  const renderDrpFields = () => {
    const showDrpOther = f.drp_type === "อื่น ๆ";
    return (
      <div>
        {/* ประเภท Error (ช่องร่วม Med/DRP) — วางเป็นช่องแรกเหมือนหน้า ME · ระบุขั้นตอนที่พลาด */}
        {renderErrorTypeField()}

        <div style={css("margin-bottom:16px;")}>
          <div style={css("display:flex;align-items:center;margin-bottom:8px;gap:8px;")}>
            <label style={css("font-size:13px;font-weight:600;color:#475569;")}>
              ประเภทปัญหาจากการใช้ยา (DRP) <span style={css("color:#DC2626;")}>*</span>
            </label>
            <HButton
              onClick={() => setState((st) => ({ showDrpLegend: !st.showDrpLegend }))}
              base="margin-left:auto;border:1px solid #F6D89A;background:#FEF7EC;color:#B45309;font-size:12px;font-weight:600;padding:4px 11px;border-radius:999px;cursor:pointer;display:flex;align-items:center;gap:5px;white-space:nowrap;"
              hover="background:#FDEFD6"
            >
              ⓘ {S.showDrpLegend ? "ซ่อนความหมาย" : "ดูความหมาย"}
            </HButton>
          </div>
          {/* ความหมายฉบับเต็มทั้ง 10 หมวด — รูปแบบเดียวกับฝั่ง Med Error */}
          {S.showDrpLegend && (
            <div
              style={css(
                "margin-bottom:10px;background:#FBFDFC;border:1px solid #E3EFEC;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:9px;"
              )}
            >
              <div style={css("font-size:12.5px;font-weight:700;color:#0B655D;")}>ความหมายประเภทปัญหาจากการใช้ยา (DRP)</div>
              {DRP_TYPES.map((t) => (
                <div key={t.key} style={css("display:flex;flex-direction:column;gap:2px;")}>
                  <span style={css("font-size:12.5px;font-weight:700;color:#0B655D;")}>{t.label || t.key}</span>
                  <span style={css("font-size:12.5px;color:#475569;line-height:1.45;")}>{t.desc}</span>
                </div>
              ))}
            </div>
          )}
          <div style={css("display:flex;flex-wrap:wrap;gap:8px;")}>
            {DRP_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setDrpType(t.key)}
                style={css(chip(f.drp_type === t.key))}
              >
                {t.label || t.key}
              </button>
            ))}
          </div>
          {drpObj && (
            <div
              style={css(
                "margin-top:9px;background:#FEF7EC;border:1px solid #F6D89A;border-radius:10px;padding:9px 12px;font-size:13px;color:#92400E;line-height:1.5;"
              )}
            >
              {drpObj.desc}
            </div>
          )}
          {showDrpOther && (
            <>
              <HInput
                value={f.drp_type_other}
                onChange={(e) => setField("drp_type_other", e.target.value)}
                placeholder="ระบุปัญหา DRP เพิ่มเติม…"
                base="width:100%;box-sizing:border-box;margin-top:8px;border:1.5px solid #DCE7E5;border-radius:11px;padding:11px 14px;font-size:15px;color:#0F172A;background:#fff;outline:none;"
                focus={INPUT_FOCUS}
              />
              {S.errors.drp_type_other && (
                <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาระบุรายละเอียดปัญหา DRP</div>
              )}
            </>
          )}
          {S.errors.drp_type && (
            <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาเลือกประเภทปัญหา DRP</div>
          )}
        </div>

        <div style={css("margin-bottom:16px;")}>
          <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
            ยาที่เกี่ยวข้อง <span style={css("color:#94A3B8;font-weight:400;")}>เพิ่มได้หลายตัว</span>
          </label>
          {renderDrugRows()}
        </div>

        {/* ยุบ "สาเหตุของปัญหา" + "รายละเอียดเพิ่มเติม" เหลือช่องเดียว — เดิมซ้ำซ้อน คนกรอกงงว่าอะไรลงช่องไหน
            ยังเก็บลงคอลัมน์ cause เหมือนเดิม เคสเก่าจึงอ่านได้ตามปกติ */}
        <div style={css("margin-bottom:16px;")}>
          <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
            รายละเอียดเหตุการณ์ / สาเหตุ <span style={css("color:#DC2626;")}>*</span>
          </label>
          <HTextarea
            value={f.cause}
            onChange={(e) => setField("cause", e.target.value)}
            rows={3}
            placeholder="เล่าว่าพบปัญหาอะไร และเกิดจากอะไร…"
            base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:12px 14px;font-size:15px;color:#0F172A;background:#fff;outline:none;resize:vertical;line-height:1.55;"
            focus={INPUT_FOCUS}
          />
          {S.errors.cause && (
            <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณากรอกรายละเอียดเหตุการณ์ / สาเหตุ</div>
          )}
        </div>

        {/* ระดับความรุนแรง A–I — DRP ก็ให้เลือกได้เหมือน ME (บังคับกรอก) · บรรยายเหตุการณ์เสร็จ → ให้คะแนนความรุนแรง */}
        {renderSeverityField()}

        {/* เภสัชกรจัดการเอง → ไม่ได้เสนอแพทย์ จึงไม่มีผลตอบรับจากแพทย์ (ซ่อนช่อง + ล้างค่าเดิม) */}
        <div style={css("margin-bottom:16px;")}>
          <HButton
            onClick={() => {
              const next = !f.pharmacist_only;
              setField("pharmacist_only", next);
              if (next) setField("outcome", "");
            }}
            base={
              "width:100%;box-sizing:border-box;display:flex;align-items:center;gap:10px;text-align:left;padding:11px 14px;border-radius:11px;font-size:14.5px;font-weight:600;cursor:pointer;transition:all .15s;" +
              (f.pharmacist_only
                ? "border:1.5px solid #F5A623;background:#FEF7EC;color:#B45309;"
                : "border:1.5px solid #DCE7E5;background:#fff;color:#64748B;")
            }
            hover={f.pharmacist_only ? "background:#FDEFD6;" : "border-color:#F5A623;color:#B45309;"}
          >
            <span
              style={css(
                "width:20px;height:20px;flex:0 0 20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;" +
                  (f.pharmacist_only ? "background:#F5A623;color:#3B2200;" : "background:#fff;border:1.5px solid #CBD5E1;color:transparent;")
              )}
            >
              ✓
            </span>
            เภสัชกรแก้ไขเอง ไม่ผ่านแพทย์
          </HButton>
        </div>

        <div style={css("margin-bottom:16px;")}>
          <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
            การแก้ไข (Intervention) <span style={css("color:#DC2626;")}>*</span>
          </label>
          <HSelect
            value={f.intervention}
            onChange={(e) => {
              const v = e.target.value;
              setField("intervention", v);
              // เปลี่ยนไปการแก้ไขที่ไม่ได้เสนอแพทย์ → ล้างผลตอบรับที่เคยเลือกไว้ ไม่ให้ค้างติดไปกับเคส
              if (v !== CONSULT_DOCTOR) setField("outcome", "");
            }}
            base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:12px 40px 12px 14px;font-size:15px;color:#0F172A;background-color:#fff;outline:none;"
            focus={INPUT_FOCUS}
          >
            {/* ค่าเริ่มต้นต้องว่าง — เดิมค้างค่าแรกไว้ ทำให้บันทึกค่าที่ไม่ได้ตั้งใจเลือก */}
            <option value="">— เลือกการแก้ไข —</option>
            {INTERVENTIONS.map((iv) => (
              <option key={iv} value={iv}>
                {iv}
              </option>
            ))}
          </HSelect>
          {S.errors.intervention && (
            <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาเลือกการแก้ไข</div>
          )}
        </div>

        {/* ผลตอบรับจากแพทย์ = มีเฉพาะเมื่อเลือกการแก้ไขแบบ "ปรึกษาแพทย์ผู้สั่งใช้" (และไม่ได้ติ๊กว่าเภสัชกรแก้เอง) */}
        {!f.pharmacist_only && f.intervention === CONSULT_DOCTOR && (
          <div style={css("margin-bottom:16px;")}>
            <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:8px;")}>
              ผลตอบรับจากแพทย์ <span style={css("color:#DC2626;")}>*</span>
            </label>
            <div style={css("display:flex;gap:8px;flex-wrap:wrap;")}>
              {OUTCOMES.map((o) => (
                <button
                  key={o.key}
                  onClick={() => setField("outcome", f.outcome === o.key ? "" : o.key)}
                  style={css(chip(f.outcome === o.key))}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {S.errors.outcome && (
              <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาเลือกผลตอบรับจากแพทย์</div>
            )}
          </div>
        )}

        {/* รายละเอียดการจัดการ — ใช้คอลัมน์ management ร่วมกับฝั่ง Med Error · ไม่บังคับกรอก · อยู่ล่างสุด */}
        <div style={css("margin-bottom:18px;")}>
          <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>การแก้ไข / จัดการ</label>
          <HTextarea
            value={f.management}
            onChange={(e) => setField("management", e.target.value)}
            rows={2}
            placeholder="ดำเนินการอย่างไรต่อ… (จะพิมพ์เพิ่มหรือไม่ก็ได้)"
            base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:11px;padding:12px 14px;font-size:15px;color:#0F172A;background:#fff;outline:none;resize:vertical;line-height:1.55;"
            focus={INPUT_FOCUS}
          />
        </div>
      </div>
    );
  };

  const isMed = type === "med";
  return (
    <div style={css("max-width:600px;margin:0 auto;padding:22px 16px 60px;")}>
      <div
        style={css(
          "background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 12px 34px -18px rgba(11,101,93,.4);border:1px solid #D6EAE6;"
        )}
      >
        <div style={css("background:linear-gradient(150deg,#0F8A80,#0B655D);padding:22px 24px;color:#E6F5F2;")}>
          <div style={css("font-size:22px;font-weight:700;color:#fff;")}>แบบฟอร์มรายงาน</div>
          <div style={css("font-size:13px;color:#B4E1DB;margin-top:3px;")}>บันทึกได้รวดเร็ว · ใช้ได้ทั้งมือถือและเว็บ</div>
        </div>

        <div style={css("padding:18px 22px 26px;")}>
          <div style={css("background:#E8F4F1;border-radius:13px;padding:4px;display:flex;gap:4px;margin-bottom:20px;")}>
            <button onClick={() => requestSwitchType("med")} style={css(seg(type === "med"))}>
              Med Error
            </button>
            <button onClick={() => requestSwitchType("drp")} style={css(seg(type === "drp"))}>
              DRP
            </button>
          </div>

          {/* date + time */}
          <div style={css("display:flex;gap:12px;margin-bottom:16px;" + (isMobile ? "flex-direction:column;gap:14px;" : ""))}>
            <div style={css("flex:1;min-width:0;")}>
              <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>วันที่เกิดเหตุ <span style={css("color:#DC2626;")}>*</span></label>
              <div style={css("position:relative;")}>
                <HInput
                  type="date"
                  value={f.occurred_at}
                  onChange={(e) => setField("occurred_at", e.target.value)}
                  base={INPUT_BASE + (isMobile ? "text-align:left;" : "")}
                  focus={INPUT_FOCUS}
                />
                {f.occurred_at === today() && (
                  <span
                    style={css(
                      "position:absolute;right:" +
                        (isMobile ? "14px" : "40px") +
                        ";top:50%;transform:translateY(-50%);background:#FEF3E2;color:#B45309;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;pointer-events:none;"
                    )}
                  >
                    วันนี้
                  </span>
                )}
              </div>
            </div>
            <div style={css("flex:1;min-width:0;")}>
              <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
                เวลาที่พบ (เวร) <span style={css("color:#0F8A80;font-weight:600;")}>· ⏱ {clock}</span>
              </label>
              <div style={css("display:flex;gap:6px;")}>
                {SHIFTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setState({ shiftAuto: false });
                      setField("occurred_time", SHIFT_TIME[s]);
                    }}
                    style={css(shiftBtn(shiftOf(f.occurred_time) === s))}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* จุดที่พบ (มาก่อน HN — เลือก IPD แล้วจึงกรอก AN ได้) */}
          {renderLocationField()}

          {/* หน่วยงานต้นเหตุ (ช่องร่วม Med/DRP) */}
          {renderSourceUnitsField()}

          {/* HN + AN แถวเดียว · AN กดได้เมื่อจุดที่พบ = ห้องยา IPD */}
          <div style={css("margin-bottom:16px;")}>
            <div style={css("display:flex;gap:10px;")}>
              <div style={css("flex:1;min-width:0;")}>
                <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
                  HN ผู้ป่วย <span style={css("color:#DC2626;")}>*</span>
                </label>
                <HInput
                  value={f.hn}
                  onChange={(e) => setField("hn", e.target.value.replace(/\D/g, ""))}
                  placeholder="เช่น 1234567"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  base={INPUT_BASE}
                  focus={INPUT_FOCUS}
                />
              </div>
              <div style={css("flex:1;min-width:0;")}>
                <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
                  AN <span style={css("color:#94A3B8;font-weight:400;")}>ผู้ป่วยใน</span>
                  {f.location === IPD_LOCATION && <span style={css("color:#DC2626;")}> *</span>}
                </label>
                <HInput
                  value={f.an}
                  onChange={(e) => setField("an", e.target.value.replace(/[^0-9-]/g, ""))}
                  onBlur={() => setField("an", formatAn(f.an, f.occurred_at))}
                  placeholder={f.location === IPD_LOCATION ? "เช่น 69-01234" : "เลือกห้องยา IPD ก่อน"}
                  inputMode="numeric"
                  disabled={f.location !== IPD_LOCATION}
                  base={INPUT_BASE + (f.location !== IPD_LOCATION ? "background:#F1F5F4;color:#94A3B8;cursor:not-allowed;" : "")}
                  focus={INPUT_FOCUS}
                />
              </div>
            </div>
            {S.errors.hn && (
              <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณากรอก HN ผู้ป่วย</div>
            )}
            {S.errors.an && (
              <div style={css("margin-top:6px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณากรอกเลขที่ผู้ป่วยใน (AN)</div>
            )}
          </div>

          {isMed && renderMedFields()}
          {!isMed && renderDrpFields()}

          {/* ธงเตือนยา */}
          <div style={css("margin-bottom:16px;")}>
            <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:8px;")}>ธงเตือนยา</label>
            <div style={css("display:flex;flex-wrap:wrap;gap:8px;")}>
              <button onClick={() => toggleHighAlert()} style={css(chip(!!f.high_alert))}>
                ⚠ High-alert
              </button>
              <button onClick={() => setField("lasa", !f.lasa)} style={css(chip(!!f.lasa))}>
                🔁 LASA (ชื่อ/รูปคล้าย)
              </button>
            </div>
          </div>

          {/* แนบรูป */}
          <div style={css("margin-bottom:20px;")}>
            <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:8px;")}>
              แนบรูป <span style={css("color:#94A3B8;font-weight:400;")}>ฉลาก / ใบสั่งยา</span>
            </label>
            {f.attachment && (
              <div style={css("position:relative;display:inline-block;")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.attachment}
                  alt="แนบ"
                  style={{ maxWidth: "100%", maxHeight: "180px", borderRadius: "12px", border: "1px solid #DCE7E5", display: "block" }}
                />
                <button
                  onClick={() => setField("attachment", null)}
                  style={css(
                    "position:absolute;top:6px;right:6px;border:none;background:rgba(15,23,42,.7);color:#fff;width:26px;height:26px;border-radius:8px;font-size:15px;cursor:pointer;line-height:1;"
                  )}
                >
                  ×
                </button>
              </div>
            )}
            {/* ปิดใช้งานชั่วคราว — รอย้ายไปเก็บรูปที่ Cloudflare (แปลง webp + ย่อขนาด) แทนการฝัง base64 ลงฐานข้อมูล */}
            <div
              style={css(
                "display:flex;align-items:center;justify-content:center;gap:8px;border:1.5px dashed #E2E8F0;border-radius:12px;padding:14px;font-size:14px;color:#94A3B8;font-weight:600;margin-top:8px;background:#F8FAFC;cursor:not-allowed;user-select:none;"
              )}
            >
              📎 เลือกรูปเพื่อแนบ
              <span style={css("background:#E2E8F0;color:#64748B;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px;")}>
                ยังใช้ไม่ได้
              </span>
            </div>
          </div>

          {/* ผู้รายงาน */}
          <div style={css("margin-bottom:20px;")}>
            <label style={css("font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;")}>
              ผู้รายงาน <span style={css("color:#DC2626;")}>*</span>
            </label>
            {renderReporterDD("reporter", f.reporter, (v) => setField("reporter", v), !!S.errors.reporter)}
            {S.errors.reporter && (
              <div style={css("margin-top:5px;font-size:12.5px;color:#DC2626;font-weight:600;")}>⚠ กรุณาระบุผู้รายงาน</div>
            )}
          </div>

          <HButton
            onClick={() => save()}
            base={
              "width:100%;border:none;background:#F5A623;color:#3B2200;font-size:16px;font-weight:700;padding:15px;border-radius:13px;cursor:pointer;box-shadow:0 10px 22px -8px rgba(245,166,35,.7);" +
              (S.saving ? "opacity:.65;pointer-events:none;" : "") // #1 กันกดซ้ำ (ล็อกปุ่มระหว่างส่ง)
            }
            hover="background:#E4980E"
          >
            {S.saving ? "กำลังบันทึก…" : "บันทึกรายงาน"}
          </HButton>
        </div>
      </div>
    </div>
  );
}
