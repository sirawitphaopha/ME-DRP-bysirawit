"use client";
// records I/O + คิวส่งขึ้นระบบ + save/saveEdit/resendResult + ลบ 2 ชั้น + CSV
// ยกออกจาก MedDrpApp.tsx (Phase 3 · Step 8) · ตรรกะเดิมทุกอย่าง (ก้อนใหญ่สุด · คิว↔records↔save พันกัน จึงรวมเป็น hook เดียว)
import { useCallback, useRef } from "react";
import { IPD_LOCATION } from "@/lib/constants";
import { drugArr, drugFlatLine, emptyForm, isUuid, resolveDrugLines, shiftOf, uuid } from "@/lib/helpers";
import { dedupUnsynced, formatAn, readList, validateIncident, writeList } from "@/lib/records";
import {
  fetchDeletedIncidents,
  fetchIncidents,
  hardDeleteIncident,
  isConfigured,
  pushIncident,
  pushUpdate,
  restoreIncident,
  softDeleteIncident,
} from "@/lib/data";
import { Core } from "@/components/hooks/core";
import { CFG_KEY, PENDING_KEY, REC_KEY } from "@/components/hooks/keys";
import { Drug, FormState, Incident } from "@/lib/types";

const DEFAULT_REPORTER = "";

interface RecordsDeps {
  flash: (msg: string) => void;
  unlockAudio: () => void;
  alertFail: () => void;
  clearDraft: () => void;
}

export function useRecords({ setState, stateRef }: Core, { flash, unlockAudio, alertFail, clearDraft }: RecordsDeps) {
  const flushingRef = useRef(false);
  const savingRef = useRef(false); // #1 กันกดปุ่มบันทึกซ้ำระหว่างกำลังส่ง (stateRef อัปเดตหลัง render จึงต้องใช้ ref แยก)

  // อ่าน-แก้-เขียนคิว PENDING แบบ re-read ล่าสุดทุกครั้ง (กัน race: ไม่เขียนทับของที่เพิ่งเข้าคิวระหว่าง await)
  const mutatePending = useCallback(
    (fn: (list: Incident[]) => Incident[]) => {
      const next = fn(readList(PENDING_KEY));
      writeList(PENDING_KEY, next);
      setState({ pending: next });
      return next;
    },
    [setState]
  );

  // เพิ่มรายงานเข้าคิว "รอส่งขึ้นระบบ" (กันซ้ำด้วย id · re-read ล่าสุด)
  const enqueuePending = useCallback(
    (list: Incident[]) => {
      mutatePending((cur) => {
        const ids = new Set(cur.map((r) => r.id));
        const add = list.filter((r) => r && !ids.has(r.id));
        return add.length ? [...cur, ...add] : cur;
      });
    },
    [mutatePending]
  );

  // เอารายการออกจากคิว (re-read ล่าสุด · ไม่ทับทั้งชุด)
  const dequeuePending = useCallback((id: string) => mutatePending((list) => list.filter((r) => r.id !== id)), [mutatePending]);

  // ลองส่งคิวที่ค้างขึ้นระบบส่วนกลาง — เอาออก "ทีละตัวที่สำเร็จ" (re-read) ไม่เขียนทับทั้งชุด (กัน race)
  const flushPending = useCallback(async () => {
    if (flushingRef.current) return;
    const cfg = stateRef.current.cfg;
    if (!isConfigured(cfg)) return;
    const snapshot = readList(PENDING_KEY);
    if (!snapshot.length) return;
    flushingRef.current = true;
    setState({ syncing: true });
    let synced = 0;
    for (const p of snapshot) {
      let rec = p;
      let curId = p.id;
      // id เก่าที่ไม่ใช่ uuid (รายงานเก่าที่เคยส่งไม่ผ่าน) → ออกใหม่ + อัปเดตทั้ง records และ pending ก่อนส่ง
      if (!isUuid(curId)) {
        const nid = uuid();
        const oldId = curId;
        const recs = (stateRef.current.records || []).map((r) => (r.id === oldId ? { ...r, id: nid } : r));
        writeList(REC_KEY, recs);
        setState({ records: recs });
        mutatePending((list) => list.map((r) => (r.id === oldId ? { ...r, id: nid } : r)));
        rec = { ...rec, id: nid };
        curId = nid;
      }
      const ok = await pushIncident(cfg, rec);
      if (ok) {
        synced++;
        dequeuePending(curId);
      }
    }
    flushingRef.current = false;
    setState({ syncing: false });
    if (synced > 0) {
      flash(synced + " รายงานที่ค้างส่งขึ้นระบบเรียบร้อยแล้ว ✓");
      // #22: ถ้าหน้าผล "ส่งไม่สำเร็จ" ยังค้าง และเคสนั้นเพิ่งซิงก์สำเร็จ → สลับเป็นหน้าสำเร็จ
      const rr = stateRef.current.resultRec;
      if (stateRef.current.result === "fail" && rr && !readList(PENDING_KEY).some((r) => r.id === rr.id)) {
        setState({ result: "ok", resultRec: null });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setState, mutatePending, dequeuePending]);

  const loadRecords = useCallback(async () => {
    const cfg = stateRef.current.cfg;
    // 1) โชว์ข้อมูลในเครื่องทันที (ไม่บล็อกด้วย network)
    const local = readList(REC_KEY);
    if (local.length) setState({ records: local });
    // 2) ถ้าตั้งค่า Supabase แล้ว → ดึงข้อมูลจริง แล้ว "รวม" กับของในเครื่อง (ไม่ทับทิ้ง)
    if (isConfigured(cfg)) {
      try {
        const d = await fetchIncidents(cfg);
        const serverIds = new Set(d.map((r) => r.id));
        // เคสที่ยังไม่ขึ้น server = อยู่ในคิว pending (แหล่งความจริง) หรือเป็น local ที่ id ยังไม่ใช่ uuid (เคสเก่า)
        // — เคสที่ลบไปถังขยะ (มีบน server แต่ deleted_at ไม่ null) ไม่เข้าเงื่อนไขนี้ ไม่ถูกดึงกลับ
        const unsynced = dedupUnsynced(readList(PENDING_KEY), local, serverIds);
        const merged = unsynced.length ? [...unsynced, ...d] : d;
        setState({ records: merged });
        writeList(REC_KEY, merged);
        if (unsynced.length) {
          enqueuePending(unsynced);
          flushPending();
        }
      } catch {}
    }
  }, [setState, enqueuePending, flushPending]);

  // โหลดรายงานในถังขยะ (ลบแบบซ่อน) — ใช้ในหน้าตั้งค่า
  const loadTrash = useCallback(async () => {
    const cfg = stateRef.current.cfg;
    if (!isConfigured(cfg)) return;
    try {
      const d = await fetchDeletedIncidents(cfg);
      setState({ trash: d });
    } catch {}
  }, [setState]);

  // ---------- Realtime: ข้อมูลสดข้ามเครื่อง ----------
  // ดึงข้อมูลใหม่ทั้งชุดแบบเงียบ (ไม่ล้างหน้าจอระหว่างรอ) แล้วทับ state + cache ในเครื่อง
  // แจ้งเตือนเฉพาะตอนข้อมูลเปลี่ยนจริง — เครื่องที่เป็นคนบันทึกเองจะไม่เด้งซ้ำ (state ตรงกับ server อยู่แล้ว)
  const refreshRecords = useCallback(async () => {
    const cfg = stateRef.current.cfg;
    if (!isConfigured(cfg)) return;
    try {
      const d = await fetchIncidents(cfg);
      const cur = stateRef.current.records || [];
      const serverIds = new Set(d.map((r) => r.id));
      // เคสที่ยังไม่ขึ้น server (คิว pending = แหล่งความจริง) + local ที่ id ยังไม่ใช่ uuid → คงไว้บนสุด
      // เคสที่ลบไปถังขยะจะหลุดจาก server active และไม่อยู่ในคิว → หายจากหน้าจอตามจริง
      const unsynced = dedupUnsynced(readList(PENDING_KEY), cur, serverIds);
      const merged = unsynced.length ? [...unsynced, ...d] : d;
      const same = JSON.stringify(merged) === JSON.stringify(cur);
      if (same) return;
      setState({ records: merged });
      // ถ้ากำลังเปิดหน้ารายละเอียดของเคสที่เพิ่งถูกแก้จากอีกเครื่อง → อัปเดตหน้าที่เปิดอยู่ด้วย
      // #23: แต่ถ้ากำลังแก้ไขค้างอยู่ ห้ามทับ detail (กันประวัติเวอร์ชันปนกับเวอร์ชันของเครื่องอื่น)
      const open = stateRef.current.detail;
      if (open && !stateRef.current.editMode) {
        const fresh = d.find((r) => r.id === open.id);
        if (fresh) setState({ detail: fresh });
      }
      writeList(REC_KEY, merged);
      flash("อัปเดตข้อมูลล่าสุดจากเครื่องอื่นแล้ว ✓");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setState]);

  // Phase 2: จับคู่รหัสยาให้เคสเก่าอัตโนมัติ (best-effort · ครั้งเดียวต่อเครื่อง)
  // แมตช์เฉพาะข้อความยาที่ "ตรงเป๊ะ" กับ drugFlatLine ของยาในคลังปัจจุบัน (ยาที่ยังไม่เคยเปลี่ยนชื่อ)
  // เคสที่แมตช์ไม่ได้ (ยาเปลี่ยนชื่อไปแล้ว/พิมพ์เอง) พี่กันปรับเองใน Phase 3
  const backfillDrugIds = useCallback(async () => {
    const cfg = stateRef.current.cfg;
    if (!isConfigured(cfg)) return;
    try {
      if (localStorage.getItem("meddrp_drugid_backfill_v1")) return;
    } catch {}
    const drugs = stateRef.current.drugs || [];
    if (!drugs.length) return; // คลังยายังไม่โหลด รอรอบหน้า
    const byLine = new Map<string, number>();
    drugs.forEach((d) => byLine.set(drugFlatLine(d), d.id));
    const recs = stateRef.current.records || [];
    const toUpdate: Incident[] = [];
    recs.forEach((r) => {
      if (!isUuid(r.id)) return; // เฉพาะเคสที่ขึ้น server แล้ว
      const texts = drugArr(r);
      if (!texts.length) return;
      const existing = r.drug_ids || [];
      if (existing.length >= texts.length && existing.every((x) => x != null)) return; // ผูกครบแล้ว
      const ids = texts.map((t, i) => (existing[i] != null ? existing[i] : byLine.has(t) ? (byLine.get(t) as number) : null));
      if (ids.some((x, i) => x !== (existing[i] ?? null))) toUpdate.push({ ...r, drug_ids: ids });
    });
    if (toUpdate.length) {
      for (const rec of toUpdate) {
        try {
          await pushUpdate(cfg, rec);
        } catch {}
      }
      refreshRecords();
    }
    try {
      localStorage.setItem("meddrp_drugid_backfill_v1", "1");
    } catch {}
  }, [refreshRecords]);

  // ---------- save new ----------
  const save = async () => {
    if (savingRef.current) return; // #1 กันกดปุ่มบันทึกซ้ำระหว่างกำลังส่ง (กันได้เคสซ้ำ)
    savingRef.current = true;
    unlockAudio(); // ปลดล็อกเสียงในจังหวะกดปุ่ม (เผื่อผลออกมาไม่สำเร็จ จะได้มีเสียงเตือน)
    const f = stateRef.current.form,
      type = stateRef.current.type;
    const errs = validateIncident(f, type);
    if (Object.keys(errs).length) {
      setState({ errors: errs });
      flash("กรุณากรอกช่องที่จำเป็น (ไฮไลต์สีแดง)");
      savingRef.current = false;
      return;
    }
    setState({ saving: true, errors: {} });
    // จับคู่ข้อความยา + รหัสยา (drug_ids) ให้ตรง index แล้วค่อยกรองช่องว่างออกพร้อมกัน (คงการผูก id)
    const drugPairs = (f.drugs || [])
      .map((x, i) => ({ text: String(x).trim(), id: (f.drug_ids || [])[i] ?? null }))
      .filter((p) => p.text);
    const drugsArr = drugPairs.map((p) => p.text);
    const drugIdsArr = drugPairs.map((p) => p.id);
    const rec: Incident = {
      ...f,
      type,
      shift: shiftOf(f.occurred_time),
      drugs: drugsArr,
      drug_ids: drugIdsArr,
      drug: drugsArr.join(", "),
      // #15: AN เก็บในรูปแบบมาตรฐาน "YY-NNNNN" เสมอ (เผื่อกดบันทึกโดยยังไม่ blur ช่อง AN) · ไม่ใช่ IPD = ไม่เก็บ AN
      an: f.location === IPD_LOCATION ? formatAn(f.an, f.occurred_at) : "",
      id: uuid(), // UUID ที่ถูกต้องเสมอทุกเบราว์เซอร์ (แก้บั๊ก Safari กรอกแล้วไม่ขึ้นระบบ)
      created_at: new Date().toISOString(),
    };
    // #6: เก็บลงเครื่อง + เพิ่มเข้า state + เข้าคิว "ก่อน" await เสมอ
    //     (ถ้าปิดแท็บ/มี reconcile ระหว่างรอส่ง เคสจะยังอยู่ในคิว = แหล่งความจริง ไม่หาย)
    const recs = [rec, ...stateRef.current.records];
    writeList(REC_KEY, recs);
    setState({ records: recs });
    clearDraft();
    enqueuePending([rec]);
    // ส่งขึ้นระบบส่วนกลาง แล้ว "ยืนยันผลจริง" · สำเร็จค่อยเอาออกจากคิว
    const cfg = stateRef.current.cfg;
    let sent = true;
    if (isConfigured(cfg)) sent = await pushIncident(cfg, rec);
    if (sent) dequeuePending(rec.id);
    setState({ saving: false, form: emptyForm(DEFAULT_REPORTER, { hn: "", reporter: f.reporter }), hadAuto: false, shiftAuto: true });
    savingRef.current = false;
    if (sent) {
      setState({ result: "ok", resultRec: null }); // หน้าผล "ส่งสำเร็จ" เต็มจอ
    } else {
      // ยังอยู่ในคิว (auto-flush ทำงานต่อ) + หน้าผล "ส่งไม่สำเร็จ" (ตัวโต ไม่หายเอง) + สั่น/เสียงเตือน
      setState({ result: "fail", resultRec: rec });
      alertFail();
    }
  };

  // กด "ส่งอีกครั้ง" จากหน้าผลที่ส่งไม่สำเร็จ — ส่งเคสเดิมซ้ำ (id เดิม = idempotent)
  const resendResult = async () => {
    const rec = stateRef.current.resultRec;
    if (!rec || stateRef.current.resending) return;
    unlockAudio();
    setState({ resending: true });
    const cfg = stateRef.current.cfg;
    const ok = isConfigured(cfg) ? await pushIncident(cfg, rec) : true;
    if (ok) {
      dequeuePending(rec.id);
      setState({ result: "ok", resultRec: null, resending: false });
      refreshRecords();
    } else {
      setState({ resending: false });
      alertFail(); // ยังไม่ไป → เตือนอีกรอบ
    }
  };

  // ---------- ลบรายงาน (2 ชั้น) ----------
  // ชั้น 1: ลบแบบซ่อน (ย้ายไปถังขยะ) — จากหน้ารายละเอียด · ยังกู้คืนได้
  const doSoftDelete = async () => {
    const rec = stateRef.current.detail;
    if (!rec) return;
    const cfg = stateRef.current.cfg;
    if (isConfigured(cfg)) {
      try {
        await softDeleteIncident(cfg, rec.id);
      } catch {
        flash("ลบไม่สำเร็จ ลองใหม่อีกครั้ง");
        return;
      }
    }
    const recs = (stateRef.current.records || []).filter((r) => r.id !== rec.id);
    writeList(REC_KEY, recs);
    dequeuePending(rec.id); // #3: เอาออกจากคิวด้วย ไม่งั้น flushPending จะส่งกลับขึ้นระบบเป็นเคสใช้งาน (เด้งกลับ)
    setState({ records: recs, detail: null, editMode: false, askDelete: false, showHistory: false });
    flash("ย้ายไปถังขยะแล้ว ✓");
    loadTrash();
  };

  // กู้คืนจากถังขยะ — กลับมาแสดงในรายการปกติ
  const doRestore = async (id: string) => {
    if (stateRef.current.trashBusy) return;
    const cfg = stateRef.current.cfg;
    setState({ trashBusy: true });
    if (isConfigured(cfg)) {
      try {
        // #19: ถ้าเครื่องอื่นลบถาวรไปแล้ว restoreIncident จะคืน false (ไม่มีแถวให้กู้) → บอกตามจริง ไม่ขึ้น "กู้คืนแล้ว" หลอก
        const ok = await restoreIncident(cfg, id);
        if (!ok) {
          setState({ trash: (stateRef.current.trash || []).filter((r) => r.id !== id), trashBusy: false });
          flash("รายงานนี้ถูกลบถาวรไปแล้ว (กู้คืนไม่ได้)");
          return;
        }
      } catch {
        flash("กู้คืนไม่สำเร็จ ลองใหม่อีกครั้ง");
        setState({ trashBusy: false });
        return;
      }
    }
    setState({ trash: (stateRef.current.trash || []).filter((r) => r.id !== id), trashBusy: false });
    flash("กู้คืนรายงานแล้ว ✓");
    refreshRecords();
  };

  // ชั้น 2: ลบถาวร — จากถังขยะ · ต้องพิมพ์ HN ยืนยันแล้วเท่านั้น (guard ที่ปุ่มด้วย)
  const doHardDelete = async () => {
    const t = stateRef.current.hardTarget;
    if (!t || stateRef.current.trashBusy) return;
    const cfg = stateRef.current.cfg;
    setState({ trashBusy: true });
    if (isConfigured(cfg)) {
      try {
        await hardDeleteIncident(cfg, t.id);
      } catch {
        flash("ลบถาวรไม่สำเร็จ ลองใหม่อีกครั้ง");
        setState({ trashBusy: false });
        return;
      }
    }
    setState({
      trash: (stateRef.current.trash || []).filter((r) => r.id !== t.id),
      hardTarget: null,
      hardInput: "",
      trashBusy: false,
    });
    flash("ลบถาวรแล้ว");
  };

  // ---------- settings ----------
  const saveCfg = () => {
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify(stateRef.current.cfg));
    } catch {}
    flash("บันทึกการตั้งค่าแล้ว ✓");
    loadRecords();
  };

  // ---------- edit (บันทึกการแก้ไข) ----------
  const saveEdit = async () => {
    if (savingRef.current) return; // กันกดบันทึกซ้ำ
    const ef = stateRef.current.editForm,
      det = stateRef.current.detail!;
    // #5: ตรวจช่องบังคับก่อนบันทึก (เหมือนหน้ากรอกใหม่) — กันลบข้อมูลจำเป็นทิ้งแล้วบันทึก
    const errs = validateIncident(ef as unknown as Partial<FormState>, det.type);
    if (Object.keys(errs).length) {
      flash("กรุณากรอกช่องที่จำเป็นให้ครบก่อนบันทึก");
      return;
    }
    savingRef.current = true;
    const snap: Incident = { ...det };
    delete snap.history;
    snap.saved_at = new Date().toISOString();
    // Phase 3: โหมดแก้ไขใช้ picker เลือกยาจากคลังแล้ว → เอา ข้อความ+รหัสยา (drug_ids) ที่ผูกไว้มาใช้ตรง ๆ (กรองช่องว่างพร้อมกัน)
    const dPairs = (ef.drugs || []).map((x, i) => ({ text: String(x).trim(), id: (ef.drug_ids || [])[i] ?? null })).filter((p) => p.text);
    const dArr = dPairs.map((p) => p.text);
    const dIds = dPairs.map((p) => p.id);
    const updated: Incident = {
      ...(ef as Incident),
      drugs: dArr,
      drug_ids: dIds,
      drug: dArr.join(", "),
      shift: shiftOf(ef.occurred_time) || ef.shift || det.shift, // #24: ไม่ล้างเวรถ้าเคสไม่มีเวลา (เคสเก่า)
      edited: true,
      edited_at: new Date().toISOString(),
      edit_count: (det.edit_count || 0) + 1,
      history: [...(det.history || []), snap],
    };
    const recs = (stateRef.current.records || []).map((r) => (r.id === updated.id ? updated : r));
    writeList(REC_KEY, recs);
    setState({ records: recs, detail: updated, saving: true });
    // #4: ยืนยันผลจริง + ลองซ้ำอัตโนมัติ (ไม่ขึ้น "บันทึกการแก้ไขแล้ว" หลอกอีกต่อไป)
    const cfg = stateRef.current.cfg;
    let ok = true;
    if (isConfigured(cfg)) ok = await pushUpdate(cfg, updated);
    setState({ saving: false, editMode: false });
    savingRef.current = false;
    if (ok) {
      flash("บันทึกการแก้ไขและส่งขึ้นระบบเรียบร้อย ✓");
    } else {
      flash("บันทึกในเครื่องแล้ว แต่ยังไม่ขึ้นระบบส่วนกลาง — เปิดแก้ไขแล้วบันทึกอีกครั้งเมื่อเน็ตกลับมา");
      alertFail();
    }
  };

  // ---------- CSV export ----------
  const exportCsv = (subset?: Incident[]) => {
    const data = subset && subset.length != null ? subset : stateRef.current.records;
    // แผนที่ รหัสยา → ยาในคลังปัจจุบัน (Phase 2) — ใช้ชื่อล่าสุดในคอลัมน์ drug
    const drugsById = new Map<number, Drug>((stateRef.current.drugs || []).map((d) => [d.id, d]));
    const cols = [
      "type",
      "occurred_at",
      "occurred_time",
      "shift",
      "hn",
      "location",
      "an",
      "error_type",
      "error_nature",
      "error_nature_other",
      "source_units",
      "source_unit_other",
      "severity",
      "drp_type",
      "drp_type_other",
      "intervention",
      "outcome",
      "drug",
      "high_alert",
      "lasa",
      "detail",
      "management",
      "managed",
      "pharmacist_only",
      "cause",
      "reporter",
      "edited",
      "edited_at",
      "edit_count",
      "created_at",
    ];
    const esc = (v: unknown) => {
      let s = String(v == null ? "" : v);
      if (/^[=+\-@]/.test(s)) s = "'" + s; // #18: กัน formula injection ใน Excel/Sheets (ช่องขึ้นต้น = + - @)
      return '"' + s.replace(/"/g, '""') + '"';
    };
    // Phase 2: คอลัมน์ "drug" ใน CSV ใช้ชื่อล่าสุดจากรหัสยา (สอดคล้องกับที่แสดงบนหน้าจอ)
    const rows = data.map((r) =>
      cols
        .map((c) => {
          if (c === "drug") return esc(resolveDrugLines(r, drugsById).join(", ") || r.drug || "");
          return esc((r as unknown as Record<string, unknown>)[c]);
        })
        .join(",")
    );
    const csv = cols.join(",") + "\n" + rows.join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "med_drp_export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return {
    mutatePending,
    enqueuePending,
    dequeuePending,
    flushPending,
    loadRecords,
    loadTrash,
    refreshRecords,
    backfillDrugIds,
    save,
    resendResult,
    doSoftDelete,
    doRestore,
    doHardDelete,
    saveCfg,
    saveEdit,
    exportCsv,
  };
}
