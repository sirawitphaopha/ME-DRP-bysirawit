"use client";
// หน้าต่างรายละเอียดเคส + โหมดแก้ไข (S.detail) — แยกจาก MedDrpApp.tsx (Phase 2e) · JSX เดิมทุกอย่าง
import React from "react";
import { CONSULT_DOCTOR, DRP_TYPES, ERROR_NATURE, ERROR_TYPES, INTERVENTIONS, IPD_LOCATION, LOCATIONS, OUTCOMES, SEVERITY, SHIFTS, SOURCE_UNITS } from "@/lib/constants";
import { fmtThaiDateTime, shiftOf } from "@/lib/helpers";
import { formatAn } from "@/lib/records";
import { css } from "@/lib/style";
import { chip, editInput, editInputSelect, editLabel, editTextarea, INPUT_FOCUS, SHIFT_TIME, shiftBtn } from "@/lib/styles";
import { HButton, HInput, HTextarea } from "@/components/ui";
import { useMedDrp } from "@/components/MedDrpContext";
import { computeDetailData } from "@/components/views/detailData";

export default function DetailModal() {
  const {
    S,
    setState,
    flash,
    doSoftDelete,
    startEdit,
    cancelEdit,
    saveEdit,
    setEf,
    setEfLocation,
    efArr,
    efToggleArr,
    setEfDrugAt,
    pickEfDrug,
    addEfDrug,
    removeEfDrug,
    renderReporterDD,
    drugPickerUI,
  } = useMedDrp();
  const { dt2, isMed2, detailRows, detailBadgeStyle, historyList } = computeDetailData(S);
  const ef = S.editForm || {};
  const severityOpts = SEVERITY.map((s) => s.code);
  const drpTypeOpts = DRP_TYPES.map((t) => ({ value: t.key, label: t.label || t.key }));
  const outcomeOpts = OUTCOMES.map((o) => ({ value: o.key, label: o.label }));
  if (!dt2) return null;
  const detailTitle = isMed2 ? "Med Error" : "DRP";
  const detailHeading = S.editMode ? "แก้ไขรายการ" : "รายละเอียดที่บันทึก";
  const hasHistory = !!(dt2.history && dt2.history.length);
  // 🚨 คลิกพื้นที่ว่าง (backdrop) = ไม่ปิดหน้าต่างเด็ดขาด ต้องกดปุ่มปิดเอง (กันเผลอปิดทับงานที่ยังไม่บันทึก)
  // กดปุ่ม × ขณะแก้ไขค้างอยู่ → ถามยืนยันก่อนทิ้ง
  const closeDetail = () => setState({ detail: null, editMode: false, showHistory: false, confirmDiscard: false });
  const onBackdrop = () => {
    if (S.editMode) flash("กำลังแก้ไขอยู่ กดบันทึกหรือยกเลิกก่อนปิดหน้าต่าง");
  };
  const onCloseBtn = () => {
    if (S.editMode) {
      setState({ confirmDiscard: true });
      return;
    }
    closeDetail();
  };

  // หน่วยงานต้นเหตุ ในโหมดแก้ไข — ชิปเลือกหลายอัน + "อื่น ๆ" พิมพ์ระบุ (ใช้ efArr/efToggleArr · ร่วม Med/DRP)
  const renderEfSourceUnits = () => {
    const sel = efArr("source_units");
    return (
      <div>
        <label style={editLabel}>
          หน่วยงานต้นเหตุ <span style={css("color:#94A3B8;font-weight:400;")}>เลือกได้หลายอัน</span>
        </label>
        <div style={css("display:flex;flex-wrap:wrap;gap:7px;")}>
          {SOURCE_UNITS.map((u) => (
            <button key={u} type="button" onClick={() => efToggleArr("source_units", u)} style={css(chip(sel.includes(u)))}>
              {u}
            </button>
          ))}
        </div>
        {sel.includes("อื่น ๆ") && (
          <HInput
            value={(ef.source_unit_other as string) || ""}
            onChange={(e) => setEf("source_unit_other", e.target.value)}
            placeholder="ระบุหน่วยงาน/วิชาชีพเพิ่มเติม…"
            base={editInput + "margin-top:8px;"}
            focus={INPUT_FOCUS}
          />
        )}
      </div>
    );
  };

  const renderEditMode = () => {
    const isEditMed = ef.type === "med";
    return (
      <div style={css("padding:14px 22px 22px;display:flex;flex-direction:column;gap:13px;")}>
        <div style={css("display:flex;gap:10px;")}>
          <div style={css("flex:1;")}>
            <label style={editLabel}>วันที่</label>
            <HInput type="date" value={ef.occurred_at || ""} onChange={(e) => setEf("occurred_at", e.target.value)} base={editInput} focus={INPUT_FOCUS} />
          </div>
          <div style={css("flex:1;")}>
            <label style={editLabel}>เวร</label>
            <div style={css("display:flex;gap:6px;")}>
              {SHIFTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setEf("occurred_time", SHIFT_TIME[s])}
                  style={css(shiftBtn(shiftOf(ef.occurred_time) === s))}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label style={editLabel}>HN ผู้ป่วย</label>
          <HInput value={ef.hn || ""} onChange={(e) => setEf("hn", e.target.value.replace(/\D/g, ""))} type="tel" inputMode="numeric" base={editInput} focus={INPUT_FOCUS} />
        </div>

        {isEditMed ? (
          <div style={css("display:flex;flex-direction:column;gap:13px;")}>
            <div>
              <label style={editLabel}>จุดที่พบ</label>
              <select value={ef.location || ""} onChange={(e) => setEfLocation(e.target.value)} style={css(editInputSelect)}>
                {LOCATIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            {ef.location === IPD_LOCATION && (
              <div>
                <label style={editLabel}>AN (เลขที่ผู้ป่วยใน)</label>
                <HInput value={(ef.an as string) || ""} onChange={(e) => setEf("an", e.target.value.replace(/[^0-9-]/g, ""))} onBlur={() => setEf("an", formatAn((ef.an as string) || "", ef.occurred_at))} placeholder="เช่น 69-01234" base={editInput} focus={INPUT_FOCUS} />
              </div>
            )}
            {renderEfSourceUnits()}
            <div>
              <label style={editLabel}>
                ประเภท Error <span style={css("color:#94A3B8;font-weight:400;")}>เลือกได้หลายอัน</span>
              </label>
              <div style={css("display:flex;flex-wrap:wrap;gap:7px;")}>
                {ERROR_TYPES.map((t) => (
                  <button key={t.key} type="button" onClick={() => efToggleArr("error_type", t.key)} style={css(chip(efArr("error_type").includes(t.key)))}>
                    {t.key}
                    {t.th ? " (" + t.th + ")" : ""}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={editLabel}>
                ลักษณะความคลาดเคลื่อน <span style={css("color:#94A3B8;font-weight:400;")}>เลือกได้หลายอัน</span>
              </label>
              <div style={css("display:flex;flex-wrap:wrap;gap:7px;")}>
                {ERROR_NATURE.map((n) => (
                  <button key={n.key} type="button" onClick={() => efToggleArr("error_nature", n.key)} style={css(chip(efArr("error_nature").includes(n.key)))}>
                    {n.key}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={editLabel}>ระดับ NCC MERP</label>
              <select value={ef.severity || ""} onChange={(e) => setEf("severity", e.target.value)} style={css(editInputSelect)}>
                <option value="">—</option>
                {severityOpts.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div style={css("display:flex;flex-direction:column;gap:13px;")}>
            <div>
              <label style={editLabel}>จุดที่พบ</label>
              <select value={ef.location || ""} onChange={(e) => setEfLocation(e.target.value)} style={css(editInputSelect)}>
                {LOCATIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            {ef.location === IPD_LOCATION && (
              <div>
                <label style={editLabel}>AN (เลขที่ผู้ป่วยใน)</label>
                <HInput value={(ef.an as string) || ""} onChange={(e) => setEf("an", e.target.value.replace(/[^0-9-]/g, ""))} onBlur={() => setEf("an", formatAn((ef.an as string) || "", ef.occurred_at))} placeholder="เช่น 69-01234" base={editInput} focus={INPUT_FOCUS} />
              </div>
            )}
            {renderEfSourceUnits()}
            <div>
              <label style={editLabel}>
                ประเภท Error <span style={css("color:#94A3B8;font-weight:400;")}>เลือกได้หลายอัน</span>
              </label>
              <div style={css("display:flex;flex-wrap:wrap;gap:7px;")}>
                {ERROR_TYPES.map((t) => (
                  <button key={t.key} type="button" onClick={() => efToggleArr("error_type", t.key)} style={css(chip(efArr("error_type").includes(t.key)))}>
                    {t.key}
                    {t.th ? " (" + t.th + ")" : ""}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={editLabel}>ประเภทปัญหาจากการใช้ยา (DRP)</label>
              <select value={ef.drp_type || ""} onChange={(e) => setEf("drp_type", e.target.value)} style={css(editInputSelect)}>
                <option value="">—</option>
                {drpTypeOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={editLabel}>รายละเอียดเหตุการณ์ / สาเหตุ</label>
              <HTextarea value={ef.cause || ""} onChange={(e) => setEf("cause", e.target.value)} rows={3} base={editTextarea} focus={INPUT_FOCUS} />
            </div>
            <div>
              <label style={editLabel}>ระดับ NCC MERP</label>
              <select value={ef.severity || ""} onChange={(e) => setEf("severity", e.target.value)} style={css(editInputSelect)}>
                <option value="">—</option>
                {severityOpts.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <HButton
                onClick={() => {
                  const next = !ef.pharmacist_only;
                  setEf("pharmacist_only", next);
                  if (next) setEf("outcome", "");
                }}
                base={
                  "width:100%;box-sizing:border-box;display:flex;align-items:center;gap:10px;text-align:left;padding:10px 13px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;" +
                  (ef.pharmacist_only
                    ? "border:1.5px solid #F5A623;background:#FEF7EC;color:#B45309;"
                    : "border:1.5px solid #DCE7E5;background:#fff;color:#64748B;")
                }
                hover={ef.pharmacist_only ? "background:#FDEFD6;" : "border-color:#F5A623;color:#B45309;"}
              >
                <span
                  style={css(
                    "width:19px;height:19px;flex:0 0 19px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;" +
                      (ef.pharmacist_only ? "background:#F5A623;color:#3B2200;" : "background:#fff;border:1.5px solid #CBD5E1;color:transparent;")
                  )}
                >
                  ✓
                </span>
                เภสัชกรแก้ไขเอง ไม่ผ่านแพทย์
              </HButton>
            </div>
            <div>
              <label style={editLabel}>การแก้ไข (Intervention)</label>
              <select
                value={ef.intervention || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setEf("intervention", v);
                  if (v !== CONSULT_DOCTOR) setEf("outcome", "");
                }}
                style={css(editInputSelect)}
              >
                <option value="">— เลือกการแก้ไข —</option>
                {INTERVENTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            {!ef.pharmacist_only && ef.intervention === CONSULT_DOCTOR && (
              <div>
                <label style={editLabel}>ผลตอบรับจากแพทย์</label>
                <select value={ef.outcome || ""} onChange={(e) => setEf("outcome", e.target.value)} style={css(editInputSelect)}>
                  <option value="">—</option>
                  {outcomeOpts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={editLabel}>การแก้ไข / จัดการ</label>
              <HTextarea
                value={ef.management || ""}
                onChange={(e) => setEf("management", e.target.value)}
                rows={2}
                base={editTextarea}
                focus={INPUT_FOCUS}
              />
            </div>
          </div>
        )}

        <div>
          <label style={editLabel}>
            ยาที่เกี่ยวข้อง <span style={css("color:#94A3B8;font-weight:400;")}>เลือกจากคลัง (ผูกรหัสยา) หรือพิมพ์เอง</span>
          </label>
          {drugPickerUI({
            rows: ef.drugs || [""],
            sug: S.efDrugSug,
            onSug: (v) => setState({ efDrugSug: v }),
            onBlur: (i) => setState((s) => (s.efDrugSug && s.efDrugSug.i === i ? { efDrugSug: null } : {})),
            onChangeAt: setEfDrugAt,
            onPick: pickEfDrug,
            onRemove: removeEfDrug,
            onAdd: addEfDrug,
            placeholder: "พิมพ์ค้นหายาจากคลัง…",
          })}
        </div>
        <div style={css("display:flex;gap:8px;")}>
          <button onClick={() => setEf("high_alert", !ef.high_alert)} style={css(chip(!!ef.high_alert))}>
            ⚠ High-alert
          </button>
          <button onClick={() => setEf("lasa", !ef.lasa)} style={css(chip(!!ef.lasa))}>
            🔁 LASA
          </button>
        </div>
        <div>
          <label style={editLabel}>รายละเอียด</label>
          <HTextarea value={ef.detail || ""} onChange={(e) => setEf("detail", e.target.value)} rows={2} base={editTextarea} focus={INPUT_FOCUS} />
        </div>
        {isEditMed && (
          <div>
            <label style={editLabel}>การแก้ไข / จัดการ</label>
            <HButton
              onClick={() => setEf("managed", !ef.managed)}
              base={
                "width:100%;box-sizing:border-box;display:flex;align-items:center;gap:10px;text-align:left;margin-bottom:8px;padding:10px 13px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;" +
                (ef.managed
                  ? "border:1.5px solid #0F8A80;background:#E8F5F3;color:#0B655D;"
                  : "border:1.5px solid #DCE7E5;background:#fff;color:#64748B;")
              }
              hover={ef.managed ? "background:#DDEFEC;" : "border-color:#0F8A80;color:#0F8A80;"}
            >
              <span
                style={css(
                  "width:19px;height:19px;flex:0 0 19px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;" +
                    (ef.managed ? "background:#0F8A80;color:#fff;" : "background:#fff;border:1.5px solid #CBD5E1;color:transparent;")
                )}
              >
                ✓
              </span>
              แก้ไขเรียบร้อยแล้ว
            </HButton>
            <HTextarea value={ef.management || ""} onChange={(e) => setEf("management", e.target.value)} rows={2} base={editTextarea} focus={INPUT_FOCUS} />
          </div>
        )}
        <div>
          <label style={editLabel}>ผู้รายงาน</label>
          {renderReporterDD("edit-reporter", ef.reporter || "", (v) => setEf("reporter", v), false)}
        </div>

        <div style={css("display:flex;gap:10px;margin-top:6px;")}>
          <button
            onClick={() => cancelEdit()}
            style={css("flex:none;border:1.5px solid #DCE7E5;background:#fff;color:#475569;font-size:14px;font-weight:600;padding:12px 20px;border-radius:11px;cursor:pointer;")}
          >
            ยกเลิก
          </button>
          <HButton
            onClick={() => saveEdit()}
            base="flex:1;border:none;background:#F5A623;color:#3B2200;font-size:15px;font-weight:700;padding:12px;border-radius:11px;cursor:pointer;"
            hover="background:#E4980E"
          >
            บันทึกการแก้ไข
          </HButton>
        </div>
      </div>
    );
  };

  return (
    <div
      onClick={onBackdrop}
      style={css(
        "position:fixed;inset:0;background:rgba(11,101,93,.35);backdrop-filter:blur(2px);z-index:60;display:flex;align-items:center;justify-content:center;padding:20px;"
      )}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={css("background:#fff;border-radius:18px;width:540px;max-width:100%;max-height:88vh;overflow:auto;box-shadow:0 30px 70px -20px rgba(11,101,93,.6);")}
      >
        {/* ยืนยันทิ้งการแก้ไข — คลิกนอกป๊อปไม่ปิด ต้องกดปุ่มเลือกเอง */}
        {S.confirmDiscard && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={css(
              "position:fixed;inset:0;background:rgba(11,101,93,.45);z-index:70;display:flex;align-items:center;justify-content:center;padding:20px;"
            )}
          >
            <div style={css("background:#fff;border-radius:16px;width:390px;max-width:100%;padding:22px;box-shadow:0 30px 70px -20px rgba(11,101,93,.6);")}>
              <div style={css("font-size:16px;font-weight:700;color:#0B655D;margin-bottom:8px;")}>ปิดโดยไม่บันทึกการแก้ไข</div>
              <div style={css("font-size:14px;color:#475569;line-height:1.55;margin-bottom:18px;")}>
                รายงานนี้กำลังแก้ไขอยู่ ถ้าปิดตอนนี้ สิ่งที่แก้ไว้จะหายทั้งหมด
              </div>
              <div style={css("display:flex;gap:10px;")}>
                <HButton
                  onClick={closeDetail}
                  base="flex:1;border:none;background:#DC2626;color:#fff;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;"
                  hover="background:#B91C1C"
                >
                  ทิ้งการแก้ไข
                </HButton>
                <HButton
                  onClick={() => setState({ confirmDiscard: false })}
                  base="flex:1;border:1.5px solid #DCE7E5;background:#fff;color:#0B655D;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;"
                  hover="background:#F5FAF9"
                >
                  กลับไปแก้ต่อ
                </HButton>
              </div>
            </div>
          </div>
        )}
        {/* ยืนยันย้ายไปถังขยะ (ลบชั้น 1) — คลิกนอกป๊อปไม่ปิด ต้องกดปุ่มเอง */}
        {S.askDelete && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={css(
              "position:fixed;inset:0;background:rgba(11,101,93,.45);z-index:70;display:flex;align-items:center;justify-content:center;padding:20px;"
            )}
          >
            <div style={css("background:#fff;border-radius:16px;border-top:4px solid #F5A623;width:400px;max-width:100%;padding:22px;box-shadow:0 30px 70px -20px rgba(11,101,93,.6);")}>
              <div style={css("font-size:16px;font-weight:800;color:#B45309;margin-bottom:8px;")}>ย้ายรายงานนี้ไปถังขยะ</div>
              <div style={css("font-size:13.5px;color:#475569;line-height:1.6;margin-bottom:13px;")}>
                รายงานจะถูกซ่อนจากรายการ แต่ยังกู้คืนได้จากถังขยะในหน้าตั้งค่า
              </div>
              <div style={css("background:#F6FAF9;border:1px solid #E3EFEC;border-radius:11px;padding:10px 13px;font-size:12.5px;color:#334155;margin-bottom:16px;")}>
                {detailTitle} · HN {dt2.hn || "—"} · {dt2.occurred_at || ""}
              </div>
              <div style={css("display:flex;gap:10px;")}>
                <HButton
                  onClick={() => doSoftDelete()}
                  base="flex:1;border:none;background:#F5A623;color:#3B2200;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;"
                  hover="background:#E4980E"
                >
                  ย้ายไปถังขยะ
                </HButton>
                <HButton
                  onClick={() => setState({ askDelete: false })}
                  base="flex:1;border:1.5px solid #DCE7E5;background:#fff;color:#0B655D;font-size:14px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer;"
                  hover="background:#F5FAF9"
                >
                  ยกเลิก
                </HButton>
              </div>
            </div>
          </div>
        )}
        <div style={css("position:sticky;top:0;background:#fff;display:flex;align-items:center;gap:12px;padding:18px 22px;border-bottom:1px solid #EEF3F1;z-index:2;")}>
          <span style={css(detailBadgeStyle)}>{detailTitle}</span>
          <div style={css("font-size:15px;font-weight:700;color:#0B655D;")}>{detailHeading}</div>
          <button
            onClick={onCloseBtn}
            style={css("margin-left:auto;border:none;background:#EEF3F1;color:#475569;width:32px;height:32px;border-radius:9px;font-size:18px;cursor:pointer;line-height:1;")}
          >
            ×
          </button>
        </div>

        {!S.editMode ? (
          <div style={css("padding:14px 22px 22px;display:flex;flex-direction:column;")}>
            {dt2.edited && (
              <div style={css("display:flex;align-items:center;gap:8px;background:#FEF7EC;border:1px solid #F6D89A;border-radius:10px;padding:9px 12px;margin-bottom:10px;font-size:12.5px;color:#92400E;font-weight:600;")}>
                ✎ รายการนี้มีการแก้ไข {dt2.edit_count || 0} ครั้ง · ล่าสุด {fmtThaiDateTime(dt2.edited_at)}
              </div>
            )}
            {detailRows.map((d, i) => (
              <div key={i} style={css("display:flex;gap:14px;padding:11px 0;border-bottom:1px solid #F4F8F7;")}>
                <div style={css("flex:none;width:150px;font-size:13px;color:#64748B;font-weight:600;")}>{d.label}</div>
                <div style={css("flex:1;font-size:14px;color:#0F172A;line-height:1.5;")}>
                  {d.ok && (
                    <span
                      style={css(
                        "display:inline-block;font-size:12.5px;font-weight:700;padding:3px 10px;border-radius:999px;margin-right:8px;" +
                          // เภสัชกรแก้เอง = อำพัน (ตรงกับปุ่มติ๊กในฟอร์ม) · แก้ไขแล้ว (ME) = เทล
                          (d.ok.includes("เภสัชกร") ? "background:#FEF7EC;color:#B45309;" : "background:#E8F5F3;color:#0B655D;")
                      )}
                    >
                      {d.ok}
                    </span>
                  )}
                  {d.ok && d.value === "—" ? null : d.value}
                </div>
              </div>
            ))}
            {dt2.attachment && (
              <div style={css("padding:14px 0 4px;")}>
                <div style={css("font-size:13px;color:#64748B;font-weight:600;margin-bottom:8px;")}>รูปแนบ</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={dt2.attachment} alt="แนบ" style={{ maxWidth: "100%", borderRadius: "12px", border: "1px solid #DCE7E5", display: "block" }} />
              </div>
            )}

            {hasHistory && (
              <div style={css("margin-top:14px;padding-top:14px;border-top:1px dashed #DCE7E5;")}>
                <HButton
                  onClick={() => setState((st) => ({ showHistory: !st.showHistory }))}
                  base="border:none;background:#F5FAF9;color:#0B655D;font-size:13px;font-weight:600;padding:9px 13px;border-radius:9px;cursor:pointer;width:100%;text-align:left;"
                  hover="background:#EAF3F1"
                >
                  🕘 {(S.showHistory ? "ซ่อน" : "ดู") + "ประวัติก่อนแก้ไข (" + (dt2.history ? dt2.history.length : 0) + " เวอร์ชัน)"}
                </HButton>
                {S.showHistory && (
                  <div style={css("display:flex;flex-direction:column;gap:10px;margin-top:10px;")}>
                    {historyList.map((h) => (
                      <div key={h.no} style={css("background:#FBFDFC;border:1px solid #E3EFEC;border-radius:12px;padding:12px 14px;")}>
                        <div style={css("font-size:12px;font-weight:700;color:#94A3B8;margin-bottom:8px;")}>
                          เวอร์ชัน {h.no} · บันทึกเมื่อ {h.at}
                        </div>
                        {h.rows.map((hr, j) => (
                          <div key={j} style={css("display:flex;gap:12px;padding:5px 0;")}>
                            <div style={css("flex:none;width:140px;font-size:12px;color:#94A3B8;")}>{hr.label}</div>
                            <div style={css("flex:1;font-size:12.5px;color:#475569;line-height:1.45;")}>{hr.value}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <HButton
              onClick={() => startEdit()}
              base="margin-top:16px;border:none;background:#0F8A80;color:#fff;font-size:15px;font-weight:700;padding:13px;border-radius:12px;cursor:pointer;"
              hover="background:#0B655D"
            >
              ✎ แก้ไขรายการนี้
            </HButton>
            {/* ปุ่มลบ — สีจาง แยกจากปุ่มหลัก กันเผลอกด · เปิดป๊อปยืนยันย้ายไปถังขยะ (ชั้น 1) */}
            <HButton
              onClick={() => setState({ askDelete: true })}
              base="margin-top:10px;width:100%;box-sizing:border-box;border:none;background:none;color:#C0563F;font-size:13.5px;font-weight:600;padding:9px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;"
              hover="background:#FDECE8;"
            >
              🗑 ลบรายงาน
            </HButton>
          </div>
        ) : (
          renderEditMode()
        )}
      </div>
    </div>
  );
}
