"use client";
// หน้า "สรุป/Dashboard" (view "dashboard") — แยกจาก MedDrpApp.tsx (Phase 2c) · JSX เดิมทุกอย่าง
// ค่าสรุปคำนวณจาก computeDashData(S) (ยกออกมาเป็น pure function · ตรรกะเดิม)
import React from "react";
import { SHIFTS } from "@/lib/constants";
import { css } from "@/lib/style";
import { filt, INPUT_FOCUS } from "@/lib/styles";
import { HDiv, HInput } from "@/components/ui";
import { useMedDrp } from "@/components/MedDrpContext";
import { computeDashData } from "@/components/views/dashData";

export default function DashboardView() {
  const { S, isMobile, setState, orgName, animateKpi, exportCsv, setDashPreset } = useMedDrp();
  const {
    recs,
    dr,
    kpis,
    tg,
    selYear,
    yearOpts,
    monthBars,
    sevBars,
    breakTitle,
    typeBreak,
    topDrugs,
    interv,
    locBreak,
    shiftBreak,
    reporterBreak,
    unitBreak,
    natureBreak,
    nearMissPct,
    nmN,
    medRecs2,
    haCount,
    laCount,
    HM_DAYS,
    hmMatrix,
    hmColor,
    hmMax,
    hmTotal,
    rangeLabel,
    recent,
    recentFiltered,
  } = computeDashData(S);

  const renderBarList = (items: { label: string; count: number; barStyle: string }[], gap = 11) => {
    const total = items.reduce((a, b) => a + b.count, 0);
    return (
      <div style={css("display:flex;flex-direction:column;gap:" + gap + "px;")}>
        {items.map((t, i) => {
          const pct = total ? Math.round((t.count / total) * 100) : 0;
          return (
            <div key={i}>
              <div style={css("display:flex;justify-content:space-between;align-items:baseline;font-size:13px;margin-bottom:5px;")}>
                <span style={css("color:#334155;")}>{t.label}</span>
                <span>
                  <span style={css("color:#0B655D;font-weight:700;")}>{t.count}</span>
                  <span style={css("color:#94A3B8;font-weight:500;font-size:12px;margin-left:6px;")}>{pct}%</span>
                </span>
              </div>
              <div style={css("height:10px;background:#EAF3F1;border-radius:999px;overflow:hidden;")}>
                <div style={css(t.barStyle)} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={css("max-width:1140px;margin:0 auto;padding:24px 18px 70px;")}>
      <div style={css("display:flex;align-items:flex-end;flex-wrap:wrap;gap:14px;margin-bottom:16px;")}>
        <div>
          <div style={css("font-size:24px;font-weight:700;color:#0B655D;")}>ภาพรวมข้อมูล</div>
          <div style={css("font-size:13px;color:#64748B;margin-top:2px;")}>
            Med Error &amp; DRP · {orgName} · <span style={css("color:#0F8A80;font-weight:600;")}>{rangeLabel}</span>
          </div>
        </div>
        <div
          className="no-print"
          style={css("margin-left:auto;display:flex;gap:6px;background:#E3F0ED;padding:4px;border-radius:11px;align-items:center;")}
        >
          <button onClick={() => setState({ dashType: "all" })} style={css(filt(S.dashType === "all"))}>
            ทั้งหมด
          </button>
          <button onClick={() => setState({ dashType: "med" })} style={css(filt(S.dashType === "med"))}>
            Med Error
          </button>
          <button onClick={() => setState({ dashType: "drp" })} style={css(filt(S.dashType === "drp"))}>
            DRP
          </button>
          <button
            onClick={() => exportCsv(recs)}
            style={css("margin-left:4px;border:none;background:#0B655D;color:#fff;font-size:13px;font-weight:600;padding:8px 14px;border-radius:9px;cursor:pointer;")}
          >
            ↓ CSV
          </button>
          <button
            onClick={() => {
              try {
                window.print();
              } catch {}
            }}
            style={css("border:none;background:#F5A623;color:#3B2200;font-size:13px;font-weight:700;padding:8px 14px;border-radius:9px;cursor:pointer;")}
          >
            🖨 พิมพ์สรุป
          </button>
        </div>
      </div>

      {/* range selector */}
      <div className="no-print" style={css("display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:20px;")}>
        <span style={css("font-size:13px;color:#64748B;font-weight:600;margin-right:2px;")}>ช่วงเวลา:</span>
        <div style={css("display:flex;gap:6px;background:#EAF3F1;padding:4px;border-radius:11px;")}>
          <button onClick={() => setDashPreset("all")} style={css(filt(dr.preset === "all"))}>
            ทั้งหมด
          </button>
          <button onClick={() => setDashPreset("month")} style={css(filt(dr.preset === "month"))}>
            เดือนนี้
          </button>
          <button onClick={() => setDashPreset("quarter")} style={css(filt(dr.preset === "quarter"))}>
            ไตรมาส
          </button>
          <button onClick={() => setDashPreset("year")} style={css(filt(dr.preset === "year"))}>
            ปีนี้
          </button>
          <button onClick={() => setDashPreset("custom")} style={css(filt(dr.preset === "custom"))}>
            กำหนดเอง
          </button>
        </div>
        {dr.preset === "custom" && (
          <div style={css("display:flex;gap:6px;align-items:center;")}>
            <HInput
              type="date"
              value={dr.from}
              onChange={(e) => setState((s) => ({ dashRange: { ...s.dashRange, preset: "custom", from: e.target.value } }))}
              base="border:1.5px solid #DCE7E5;border-radius:9px;padding:7px 11px;font-size:13px;outline:none;"
              focus="border:1.5px solid #F5A623"
            />
            <span style={css("color:#94A3B8;font-size:13px;")}>ถึง</span>
            <HInput
              type="date"
              value={dr.to}
              onChange={(e) => setState((s) => ({ dashRange: { ...s.dashRange, preset: "custom", to: e.target.value } }))}
              base="border:1.5px solid #DCE7E5;border-radius:9px;padding:7px 11px;font-size:13px;outline:none;"
              focus="border:1.5px solid #F5A623"
            />
          </div>
        )}
      </div>

      {/* KPI */}
      <div style={css("display:grid;grid-template-columns:" + (isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)") + ";gap:" + (isMobile ? "10px" : "14px") + ";margin-bottom:16px;")}>
        {kpis.map((k) => (
          <HDiv
            key={k.label}
            onMouseEnter={() => animateKpi(k.idx, tg[k.idx])}
            base="background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:16px 18px;cursor:default;transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease;"
            hover="transform:translateY(-4px);box-shadow:0 14px 30px -14px rgba(11,101,93,.45);border-color:#F5A623"
          >
            <div style={css("font-size:12.5px;color:#64748B;font-weight:500;")}>{k.label}</div>
            <div style={css("font-size:30px;font-weight:700;color:#0B655D;line-height:1.2;margin-top:4px;")}>{k.value}</div>
            <div style={css("font-size:12px;color:#B45309;font-weight:600;margin-top:2px;")}>{k.sub}</div>
          </HDiv>
        ))}
      </div>

      {/* month + severity */}
      <div style={css("display:grid;grid-template-columns:" + (isMobile ? "1fr" : "1.3fr 1fr") + ";gap:14px;margin-bottom:16px;")}>
        <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;")}>
          <div style={css("display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px;")}>
            <div style={css("font-size:15px;font-weight:700;color:#0B655D;")}>จำนวนเคสรายเดือน · ปี {selYear + 543}</div>
            {/* ปุ่มเลือกปี (พ.ศ.) — โชว์เฉพาะปีที่มีข้อมูล + ปีปัจจุบัน */}
            <div style={css("display:flex;gap:6px;flex-wrap:wrap;")}>
              {yearOpts.map((y) => {
                const on = y === selYear;
                return (
                  <button
                    key={y}
                    onClick={() => setState({ dashYear: y })}
                    style={css(
                      "border:none;cursor:pointer;font-size:12.5px;font-weight:700;padding:5px 11px;border-radius:8px;" +
                        (on ? "background:#0B655D;color:#fff;" : "background:#EAF4F1;color:#0B655D;")
                    )}
                  >
                    {y + 543}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={css("display:flex;align-items:flex-end;gap:" + (isMobile ? "3px" : "6px") + ";height:150px;padding-top:6px;")}>
            {monthBars.map((b, i) => (
              <div key={i} style={css("flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:5px;")}>
                <div style={css("font-size:" + (isMobile ? "9.5px" : "11px") + ";font-weight:700;color:#0B655D;")}>{b.count}</div>
                <HDiv base={b.barStyle} hover="filter:brightness(1.14)" />
                <div style={css("font-size:" + (isMobile ? "8.5px" : "10px") + ";color:#64748B;")}>{b.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;")}>
          <div style={css("font-size:15px;font-weight:700;color:#0B655D;margin-bottom:16px;")}>ระดับความรุนแรง (NCC MERP)</div>
          <div style={css("display:flex;align-items:flex-end;gap:5px;height:120px;")}>
            {sevBars.map((s) => (
              <div key={s.code} style={css("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:4px;")}>
                <div style={css("font-size:11px;font-weight:700;color:#0B655D;")}>{s.count}</div>
                <HDiv base={s.barStyle} hover="filter:brightness(1.12)" />
                <div style={css("font-size:11px;color:#64748B;font-weight:600;")}>{s.code}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* type break + top drugs */}
      <div style={css("display:grid;grid-template-columns:" + (isMobile ? "1fr" : "1fr 1fr") + ";gap:14px;margin-bottom:16px;")}>
        <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;")}>
          <div style={css("font-size:15px;font-weight:700;color:#0B655D;margin-bottom:14px;")}>{breakTitle}</div>
          {renderBarList(typeBreak.map((t) => ({ label: t.label, count: t.count, barStyle: t.barStyle })))}
        </div>
        <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;")}>
          <div style={css("font-size:15px;font-weight:700;color:#0B655D;margin-bottom:14px;")}>ยาที่พบปัญหาบ่อยที่สุด</div>
          {renderBarList(topDrugs.map((d) => ({ label: d.name, count: d.count, barStyle: d.barStyle })))}
        </div>
      </div>

      {/* intervention outcome */}
      <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;margin-bottom:16px;")}>
        <div style={css("font-size:15px;font-weight:700;color:#0B655D;margin-bottom:14px;")}>ผลตอบรับจากแพทย์ (DRP)</div>
        <div style={css("display:grid;grid-template-columns:repeat(3,1fr);gap:12px;")}>
          {interv.map((i) => (
            <div key={i.label} style={css(i.cardStyle)}>
              <div style={css("font-size:26px;font-weight:700;")}>{i.count}</div>
              <div style={css("font-size:12.5px;font-weight:500;margin-top:2px;")}>{i.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* loc + shift */}
      <div style={css("display:grid;grid-template-columns:" + (isMobile ? "1fr" : "1fr 1fr") + ";gap:14px;margin-bottom:16px;")}>
        <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;")}>
          <div style={css("font-size:15px;font-weight:700;color:#0B655D;margin-bottom:14px;")}>แยกตามจุดที่พบ (OPD)</div>
          {renderBarList(locBreak.map((t) => ({ label: t.label, count: t.count, barStyle: t.barStyle })))}
        </div>
        <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;")}>
          <div style={css("font-size:15px;font-weight:700;color:#0B655D;margin-bottom:14px;")}>แยกตามช่วงเวร</div>
          {renderBarList(shiftBreak.map((t) => ({ label: t.label, count: t.count, barStyle: t.barStyle })))}
        </div>
      </div>

      {/* แยกตามผู้รายงาน — สีสดคนละสีต่อคน เรียงมากไปน้อย */}
      <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;margin-bottom:16px;")}>
        <div style={css("display:flex;align-items:baseline;gap:8px;margin-bottom:14px;")}>
          <div style={css("font-size:15px;font-weight:700;color:#0B655D;")}>แยกตามผู้รายงาน</div>
          <div style={css("font-size:12.5px;color:#94A3B8;")}>{reporterBreak.length} คน · เรียงจากมากไปน้อย</div>
        </div>
        {reporterBreak.length ? (
          renderBarList(
            reporterBreak.map((t) => ({ label: t.label, count: t.count, barStyle: t.barStyle })),
            10
          )
        ) : (
          <div style={css("padding:14px;text-align:center;color:#94A3B8;font-size:13.5px;")}>ยังไม่มีข้อมูลในช่วงเวลาที่เลือก</div>
        )}
      </div>

      {/* แยกตามหน่วยงานต้นเหตุ — นับทั้ง Med + DRP (1 เคสเลือกได้หลายหน่วย) */}
      <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;margin-bottom:16px;")}>
        <div style={css("display:flex;align-items:baseline;gap:8px;margin-bottom:14px;")}>
          <div style={css("font-size:15px;font-weight:700;color:#0B655D;")}>แยกตามหน่วยงานต้นเหตุ</div>
          <div style={css("font-size:12.5px;color:#94A3B8;")}>Med + DRP · 1 เคสนับได้หลายหน่วย</div>
        </div>
        {unitBreak.some((t) => t.count > 0) ? (
          renderBarList(unitBreak.map((t) => ({ label: t.label, count: t.count, barStyle: t.barStyle })))
        ) : (
          <div style={css("padding:14px;text-align:center;color:#94A3B8;font-size:13.5px;")}>ยังไม่มีข้อมูลในช่วงเวลาที่เลือก</div>
        )}
      </div>

      {/* nature + near miss / HA / LASA */}
      <div style={css("display:grid;grid-template-columns:" + (isMobile ? "1fr" : "1.4fr 1fr") + ";gap:14px;margin-bottom:16px;")}>
        <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;")}>
          <div style={css("font-size:15px;font-weight:700;color:#0B655D;margin-bottom:14px;")}>ลักษณะความคลาดเคลื่อน (Med Error)</div>
          {renderBarList(natureBreak.map((t) => ({ label: t.label, count: t.count, barStyle: t.barStyle })), 10)}
        </div>
        <div style={css("display:flex;flex-direction:column;gap:12px;")}>
          <div style={css("background:#EAF6EF;border:1px solid #CBEAD6;border-radius:15px;padding:16px 18px;")}>
            <div style={css("font-size:12.5px;color:#15803D;font-weight:600;")}>Near miss (A–B: ยังไม่ถึงผู้ป่วย)</div>
            <div style={css("font-size:30px;font-weight:700;color:#15803D;line-height:1.2;margin-top:4px;")}>{nearMissPct}%</div>
            <div style={css("font-size:12px;color:#3F8F5F;margin-top:2px;")}>
              {nmN} จาก {medRecs2.length} เคส Med Error
            </div>
          </div>
          <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:12px;")}>
            <div style={css("background:#FEF3E5;border:1px solid #F5D6A6;border-radius:15px;padding:16px 18px;")}>
              <div style={css("font-size:12.5px;color:#B45309;font-weight:600;")}>⚠ High-alert</div>
              <div style={css("font-size:28px;font-weight:700;color:#B45309;line-height:1.2;margin-top:4px;")}>{haCount}</div>
              <div style={css("font-size:11.5px;color:#C2620E;")}>เคส</div>
            </div>
            <div style={css("background:#FDEBEB;border:1px solid #F3C5C2;border-radius:15px;padding:16px 18px;")}>
              <div style={css("font-size:12.5px;color:#B42318;font-weight:600;")}>🔁 LASA</div>
              <div style={css("font-size:28px;font-weight:700;color:#B42318;line-height:1.2;margin-top:4px;")}>{laCount}</div>
              <div style={css("font-size:11.5px;color:#C0453C;")}>เคส</div>
            </div>
          </div>
        </div>
      </div>

      {/* heatmap เวร × วันในสัปดาห์ */}
      <div style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;margin-bottom:16px;")}>
        <div style={css("font-size:15px;font-weight:700;color:#0B655D;")}>ช่วงเวลาที่เกิดเหตุบ่อย</div>
        <div style={css("font-size:12.5px;color:#64748B;margin-top:2px;margin-bottom:14px;")}>
          เวร × วันในสัปดาห์ · สีเข้ม = เกิดบ่อย{hmTotal === 0 ? " · ยังไม่มีข้อมูลในช่วงนี้" : ""}
        </div>
        <div style={css("display:grid;grid-template-columns:46px repeat(7,1fr);gap:5px;")}>
          <div />
          {HM_DAYS.map((d) => (
            <div key={"h" + d} style={css("font-size:11px;color:#64748B;text-align:center;font-weight:600;padding-bottom:2px;")}>
              {d}
            </div>
          ))}
          {SHIFTS.map((s, ri) => (
            <React.Fragment key={s}>
              <div style={css("font-size:12px;color:#475569;font-weight:600;display:flex;align-items:center;")}>{s.replace("เวร", "")}</div>
              {HM_DAYS.map((d, ci) => {
                const v = hmMatrix[ri][ci];
                return (
                  <div
                    key={s + d}
                    title={s + " · " + d + " · " + v + " เคส"}
                    style={css(
                      "aspect-ratio:1/1;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;background:" +
                        hmColor(v) +
                        ";color:" +
                        (v / hmMax > 0.6 ? "#EAF6F3" : "#0B655D") +
                        ";"
                    )}
                  >
                    {v || ""}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div style={css("display:flex;align-items:center;gap:6px;margin-top:12px;font-size:11px;color:#64748B;")}>
          <span>น้อย</span>
          {["#EAF6F3", "#BFE3DA", "#7FC7B8", "#3DA593", "#0B655D"].map((c) => (
            <span key={c} style={css("width:18px;height:12px;border-radius:3px;display:inline-block;background:" + c + ";")} />
          ))}
          <span>มาก</span>
        </div>
      </div>

      {/* recent table */}
      <div className="no-print" style={css("background:#fff;border:1px solid #DEEBE8;border-radius:15px;padding:18px 20px;")}>
        <div style={css("display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;")}>
          <div style={css("font-size:15px;font-weight:700;color:#0B655D;")}>รายงานล่าสุด</div>
          <HInput
            value={S.search}
            onChange={(e) => setState({ search: e.target.value })}
            placeholder="ค้นหา ยา / HN / ผู้รายงาน / ประเภท…"
            base="margin-left:auto;width:280px;max-width:100%;border:1.5px solid #DCE7E5;border-radius:10px;padding:9px 13px;font-size:14px;outline:none;"
            focus={INPUT_FOCUS}
          />
        </div>
        {isMobile ? (
          <div style={css("display:flex;flex-direction:column;gap:9px;")}>
            {recent.map((r, i) => (
              <div key={i} style={css("border:1px solid #EAF3F1;border-radius:12px;padding:11px 13px;")}>
                <div style={css("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;")}>
                  <span style={css(r.badgeStyle)}>{r.typeLabel}</span>
                  <span style={css("font-size:13px;color:#0F172A;font-weight:600;")}>{r.date}</span>
                  {r.severity && r.severity !== "—" ? (
                    <span style={css("margin-left:auto;font-size:12.5px;color:#B45309;font-weight:600;")}>ระดับ {r.severity}</span>
                  ) : null}
                </div>
                <div style={css("font-size:12.5px;color:#475569;line-height:1.55;")}>
                  <div>
                    <span style={css("color:#94A3B8;")}>HN</span> {r.hn}
                    {r.cat ? " · " + r.cat : ""}
                  </div>
                  {r.drug ? <div>{r.drug}</div> : null}
                  <div>
                    <span style={css("color:#94A3B8;")}>ผู้รายงาน</span> {r.reporter}
                  </div>
                </div>
              </div>
            ))}
            {recentFiltered.length === 0 && (
              <div style={css("padding:26px;text-align:center;color:#94A3B8;font-size:14px;")}>ไม่พบรายงาน</div>
            )}
          </div>
        ) : (
          <div style={css("overflow-x:auto;")}>
            <table style={css("width:100%;border-collapse:collapse;font-size:13px;min-width:760px;")}>
              <thead>
                <tr style={css("text-align:left;color:#64748B;border-bottom:1.5px solid #EAF3F1;")}>
                  {["วันที่", "ประเภท", "HN", "หมวด", "ระดับ", "ยา", "ผู้รายงาน"].map((h) => (
                    <th key={h} style={css("padding:8px 10px;font-weight:600;")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((r, i) => (
                  <tr key={i} style={css("border-bottom:1px solid #F1F6F5;")}>
                    <td style={css("padding:9px 10px;color:#0F172A;white-space:nowrap;")}>{r.date}</td>
                    <td style={css("padding:9px 10px;")}>
                      <span style={css(r.badgeStyle)}>{r.typeLabel}</span>
                    </td>
                    <td style={css("padding:9px 10px;color:#475569;")}>{r.hn}</td>
                    <td style={css("padding:9px 10px;color:#334155;")}>{r.cat}</td>
                    <td style={css("padding:9px 10px;color:#B45309;font-weight:600;")}>{r.severity}</td>
                    <td style={css("padding:9px 10px;color:#334155;")}>{r.drug}</td>
                    <td style={css("padding:9px 10px;color:#475569;")}>{r.reporter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recentFiltered.length === 0 && (
              <div style={css("padding:26px;text-align:center;color:#94A3B8;font-size:14px;")}>ไม่พบรายงาน</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
