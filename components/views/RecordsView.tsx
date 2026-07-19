"use client";
// หน้า "รายงาน" (view "records") — ตัวกรอง + ตาราง/การ์ดรายงาน · แยกจาก MedDrpApp.tsx (Phase 2d) · JSX เดิม
import React from "react";
import { DRP_TYPES, ERROR_TYPES, LOCATIONS, OUTCOMES, SEVERITY } from "@/lib/constants";
import { emptyFilter } from "@/lib/helpers";
import { css } from "@/lib/style";
import { filt, INPUT_FOCUS } from "@/lib/styles";
import { HButton, HInput, HTr } from "@/components/ui";
import { useMedDrp } from "@/components/MedDrpContext";
import { computeRecordsData } from "@/components/views/recordsData";

export default function RecordsView() {
  const { S, isMobile, setState, exportCsv } = useMedDrp();
  const { rlist, recRows } = computeRecordsData(S);
  const rf = S.rf;
  const setRF = (k: keyof typeof rf, v: string) => setState((s) => ({ rf: { ...s.rf, [k]: v } }));
  const reporterOpts = Array.from(new Set((S.records || []).map((r) => r.reporter).filter(Boolean))).sort() as string[];
  const errorTypeOpts = ERROR_TYPES.map((t) => t.key);
  // value = ค่าที่เก็บในฐานข้อมูล · label = ป้ายที่โชว์ (ไทย + วงเล็บอังกฤษ)
  const drpTypeOpts = DRP_TYPES.map((t) => ({ value: t.key, label: t.label || t.key }));
  const severityOpts = SEVERITY.map((s) => s.code);
  const outcomeOpts = OUTCOMES.map((o) => ({ value: o.key, label: o.label }));

  const renderFilterField = (label: string, child: React.ReactNode) => (
    <div>
      <label style={css("font-size:12px;font-weight:600;color:#64748B;display:block;margin-bottom:4px;")}>{label}</label>
      {child}
    </div>
  );
  // opts รับได้ทั้งข้อความล้วน และแบบแยก value (ค่าที่เก็บ) / label (ป้ายที่โชว์)
  const renderFilterSelect = (value: string, onChange: (v: string) => void, opts: (string | { value: string; label: string })[]) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={css("width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:9px 32px 9px 12px;font-size:14px;background-color:#fff;outline:none;")}
    >
      <option value="">ทั้งหมด</option>
      {opts.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const lb = typeof o === "string" ? o : o.label;
        return (
          <option key={v} value={v}>
            {lb}
          </option>
        );
      })}
    </select>
  );

  return (
    <div style={css("max-width:1180px;margin:0 auto;padding:24px 18px 70px;")}>
      <div style={css("display:flex;align-items:flex-end;flex-wrap:wrap;gap:14px;margin-bottom:18px;")}>
        <div>
          <div style={css("font-size:24px;font-weight:700;color:#0B655D;")}>รายงานทั้งหมด</div>
          <div style={css("font-size:13px;color:#64748B;margin-top:2px;")}>
            แสดง {rlist.length} จาก {(S.records || []).length} รายงาน
          </div>
        </div>
        <div style={css("margin-left:auto;display:flex;gap:8px;")}>
          <HButton
            onClick={() => setState({ rf: emptyFilter() })}
            base="border:1.5px solid #DCE7E5;background:#fff;color:#475569;font-size:13px;font-weight:600;padding:9px 15px;border-radius:10px;cursor:pointer;"
            hover="border-color:#F5A623;color:#B45309"
          >
            ล้างตัวกรอง
          </HButton>
          <button
            onClick={() => exportCsv(rlist)}
            style={css("border:none;background:#0B655D;color:#fff;font-size:13px;font-weight:600;padding:9px 16px;border-radius:10px;cursor:pointer;")}
          >
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* filter bar */}
      <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:16px 18px;margin-bottom:16px;")}>
        <div style={css("display:flex;gap:6px;background:#EAF3F1;padding:4px;border-radius:11px;width:fit-content;margin-bottom:14px;")}>
          <button onClick={() => setRF("type", "all")} style={css(filt(rf.type === "all"))}>
            ทั้งหมด
          </button>
          <button onClick={() => setRF("type", "med")} style={css(filt(rf.type === "med"))}>
            Med Error
          </button>
          <button onClick={() => setRF("type", "drp")} style={css(filt(rf.type === "drp"))}>
            DRP
          </button>
        </div>
        <div style={css("display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;")}>
          {renderFilterField("ค้นหา", (
            <HInput
              value={rf.q}
              onChange={(e) => setRF("q", e.target.value)}
              placeholder="ยา / HN / ข้อความ…"
              base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:9px 12px;font-size:14px;outline:none;"
              focus={INPUT_FOCUS}
            />
          ))}
          {renderFilterField("จุดที่พบ", renderFilterSelect(rf.location, (v) => setRF("location", v), LOCATIONS))}
          {renderFilterField("ประเภท Error", renderFilterSelect(rf.error_type, (v) => setRF("error_type", v), errorTypeOpts))}
          {renderFilterField("ระดับ NCC MERP", renderFilterSelect(rf.severity, (v) => setRF("severity", v), severityOpts))}
          {renderFilterField("ประเภท DRP", renderFilterSelect(rf.drp_type, (v) => setRF("drp_type", v), drpTypeOpts))}
          {renderFilterField(
            "ผลตอบรับจากแพทย์",
            <select
              value={rf.outcome}
              onChange={(e) => setRF("outcome", e.target.value)}
              style={css("width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:9px 32px 9px 12px;font-size:14px;background-color:#fff;outline:none;")}
            >
              <option value="">ทั้งหมด</option>
              {outcomeOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {renderFilterField("ผู้รายงาน", renderFilterSelect(rf.reporter, (v) => setRF("reporter", v), reporterOpts))}
          {renderFilterField(
            "ตั้งแต่วันที่",
            <HInput
              type="date"
              value={rf.from}
              onChange={(e) => setRF("from", e.target.value)}
              base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:8px 12px;font-size:14px;outline:none;"
              focus={INPUT_FOCUS}
            />
          )}
          {renderFilterField(
            "ถึงวันที่",
            <HInput
              type="date"
              value={rf.to}
              onChange={(e) => setRF("to", e.target.value)}
              base="width:100%;box-sizing:border-box;border:1.5px solid #DCE7E5;border-radius:10px;padding:8px 12px;font-size:14px;outline:none;"
              focus={INPUT_FOCUS}
            />
          )}
        </div>
      </div>

      {/* รายการ: การ์ด (มือถือ) / ตาราง (เดสก์ท็อป) */}
      {isMobile ? (
        <div style={css("display:flex;flex-direction:column;gap:10px;")}>
          {recRows.map((r, i) => (
            <div
              key={i}
              onClick={() => setState({ detail: r.r })}
              style={css("background:#fff;border:1px solid #DEEBE8;border-radius:14px;padding:13px 15px;cursor:pointer;box-shadow:0 1px 3px rgba(11,101,93,.06);")}
            >
              <div style={css("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;")}>
                <span style={css(r.badgeStyle)}>{r.typeLabel}</span>
                <span style={css("font-size:13px;color:#0F172A;font-weight:600;")}>{r.date}</span>
                {r.edited && (
                  <span style={css("background:#FEF7EC;color:#B45309;font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px;")}>
                    ✎ แก้ไข
                  </span>
                )}
                <span style={css("margin-left:auto;font-size:13px;color:#0F8A80;font-weight:600;white-space:nowrap;")}>ดู →</span>
              </div>
              <div style={css("font-size:13px;color:#334155;line-height:1.6;")}>
                <div>
                  <span style={css("color:#94A3B8;")}>HN</span> {r.hn}
                  {r.place ? " · " + r.place : ""}
                </div>
                {r.cat ? (
                  <div>
                    <span style={css("color:#94A3B8;")}>หมวด</span> {r.cat}
                  </div>
                ) : null}
                {r.severity || r.drug ? (
                  <div>
                    {r.severity ? <span style={css("color:#B45309;font-weight:600;")}>ระดับ {r.severity}</span> : null}
                    {r.severity && r.drug ? " · " : ""}
                    {r.drug || ""}
                  </div>
                ) : null}
                <div>
                  <span style={css("color:#94A3B8;")}>ผู้รายงาน</span> {r.reporter}
                </div>
                {r.detailText ? (
                  <div style={css("margin-top:5px;padding-top:6px;border-top:1px dashed #E3EFEC;color:#475569;")}>
                    <span style={css("color:#94A3B8;")}>รายละเอียด</span> {r.detailText}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {rlist.length === 0 && (
            <div style={css("padding:34px;text-align:center;color:#94A3B8;font-size:14px;background:#fff;border:1px solid #DEEBE8;border-radius:14px;")}>
              ไม่พบรายงานตามเงื่อนไข
            </div>
          )}
        </div>
      ) : (
        <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:8px 8px 12px;")}>
          <div style={css("overflow-x:auto;")}>
            <table style={css("width:100%;border-collapse:collapse;font-size:13px;min-width:1040px;")}>
              <thead>
                <tr style={css("text-align:left;color:#64748B;border-bottom:1.5px solid #EAF3F1;")}>
                  {["วันที่", "ประเภท", "HN", "จุดที่พบ", "หมวด", "ระดับ", "ยา", "รายละเอียด", "ผู้รายงาน", ""].map((h, i) => (
                    <th key={i} style={css("padding:10px 12px;font-weight:600;")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recRows.map((r, i) => (
                  <HTr
                    key={i}
                    onClick={() => setState({ detail: r.r })}
                    base="border-bottom:1px solid #F1F6F5;cursor:pointer;transition:background .12s;"
                    hover="background:#F5FAF9"
                  >
                    <td style={css("padding:10px 12px;color:#0F172A;white-space:nowrap;")}>
                      {r.date}
                      {r.edited && (
                        <span style={css("margin-left:6px;background:#FEF7EC;color:#B45309;font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px;")}>
                          ✎ แก้ไข
                        </span>
                      )}
                    </td>
                    <td style={css("padding:10px 12px;")}>
                      <span style={css(r.badgeStyle)}>{r.typeLabel}</span>
                    </td>
                    <td style={css("padding:10px 12px;color:#475569;")}>{r.hn}</td>
                    <td style={css("padding:10px 12px;color:#334155;")}>{r.place}</td>
                    <td style={css("padding:10px 12px;color:#334155;")}>{r.cat}</td>
                    <td style={css("padding:10px 12px;color:#B45309;font-weight:600;")}>{r.severity}</td>
                    <td style={css("padding:10px 12px;color:#334155;")}>{r.drug}</td>
                    <td style={css("padding:10px 12px;color:#475569;max-width:260px;")}>
                      {r.detailText ? (
                        <div
                          title={r.detailText}
                          style={css(
                            "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.45;"
                          )}
                        >
                          {r.detailText}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={css("padding:10px 12px;color:#475569;")}>{r.reporter}</td>
                    <td style={css("padding:10px 12px;color:#0F8A80;font-weight:600;white-space:nowrap;")}>ดู →</td>
                  </HTr>
                ))}
              </tbody>
            </table>
            {rlist.length === 0 && (
              <div style={css("padding:34px;text-align:center;color:#94A3B8;font-size:14px;")}>ไม่พบรายงานตามเงื่อนไข</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
