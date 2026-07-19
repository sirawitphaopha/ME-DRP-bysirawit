"use client";
// การแก้ค่าในฟอร์มกรอก (Med/DRP) — setField/toggle ต่าง ๆ/เลือกยา/สลับประเภท
// ยกออกจาก MedDrpApp.tsx (Phase 3 · Step 6) · ตรรกะเดิมทุกอย่าง
import React from "react";
import { IPD_LOCATION } from "@/lib/constants";
import { drugFlatLine, emptyForm } from "@/lib/helpers";
import { AppState } from "@/components/MedDrpApp.types";
import { alignIds, Core } from "@/components/hooks/core";
import { Drug, FormState } from "@/lib/types";

interface FormMutDeps {
  draftSoon: () => void;
  hasDraftContent: (f: FormState | undefined) => boolean;
}

export function useFormMutations({ setState, stateRef }: Core, { draftSoon, hasDraftContent }: FormMutDeps) {
  // สลับประเภทฟอร์ม ME↔DRP · เคลียร์ค่าเดิม (เก็บแค่ HN/ผู้รายงาน) แล้วเริ่มฟอร์มประเภทใหม่
  const doSwitchType = (target: "med" | "drp") => {
    setState((st) => ({ type: target, form: emptyForm("", st.form), errors: {}, confirmSwitch: null, hadAuto: false, shiftAuto: true }));
    draftSoon();
  };
  // #7: ถ้ากรอกฟอร์มค้างอยู่ กดสลับประเภท → เตือนก่อน (กันเผลอกดแล้วข้อมูลที่กรอกหาย) · ฟอร์มว่าง = สลับได้เลย
  const requestSwitchType = (target: "med" | "drp") => {
    if (stateRef.current.type === target) return;
    if (hasDraftContent(stateRef.current.form)) {
      setState({ confirmSwitch: target });
      return;
    }
    doSwitchType(target);
  };

  const setField = (k: keyof FormState, v: unknown) => {
    setState((s) => {
      const errors = { ...s.errors };
      delete errors[k as string];
      return { form: { ...s.form, [k]: v } as FormState, errors };
    });
    draftSoon();
  };
  // #12: เปลี่ยนจุดที่พบ — ถ้าไม่ใช่ IPD ให้ล้าง AN ทิ้ง (กันค่า AN ค้างติดเคสที่ไม่ใช่ IPD)
  const setLocation = (v: string) => {
    setState((s) => {
      const errors = { ...s.errors };
      delete errors.location;
      const form = { ...s.form, location: v } as FormState;
      if (v !== IPD_LOCATION) {
        form.an = "";
        delete errors.an;
      }
      return { form, errors };
    });
    draftSoon();
  };
  // ยา HAD จาก drugFlatLine จะมี "(HAD)" ต่อท้าย → ใช้ตรวจว่ายังมียา HAD เหลือในรายการไหม
  const hasHadDrug = (drugs?: string[]) => (drugs || []).some((x) => /\(HAD\)/.test(String(x)));
  // #13: ถ้าธง High-alert ถูกติดอัตโนมัติจากยา HAD แล้วยา HAD ถูกลบ/แก้ออกจนไม่เหลือ → ปลดธงให้ (ผู้ใช้ติ๊กเอง hadAuto=false จะไม่แตะ)
  const clearAutoHad = (s: AppState, form: FormState) => {
    if (s.hadAuto && !hasHadDrug(form.drugs)) {
      form.high_alert = false;
      return false;
    }
    return s.hadAuto;
  };
  const setDrugAt = (i: number, v: string) => {
    setState((s) => {
      const d = (s.form.drugs || [""]).slice();
      d[i] = v;
      const ids = alignIds(s.form.drug_ids || [], d.length);
      ids[i] = null; // พิมพ์เอง = ไม่ผูกรหัสยาแล้ว (Phase 2)
      const form = { ...s.form, drugs: d, drug_ids: ids } as FormState;
      return { form, hadAuto: clearAutoHad(s, form) };
    });
    draftSoon();
  };
  const addDrug = () => {
    setState((s) => ({ form: { ...s.form, drugs: [...(s.form.drugs || [""]), ""], drug_ids: [...(s.form.drug_ids || []), null] } }));
    draftSoon();
  };
  // เลือกยาจากรายการ suggest → ใส่เป็นข้อความบรรทัดเดียว + ผูกรหัสยา (id) + ปิด suggest
  const pickDrug = (i: number, d: Drug) => {
    setState((s) => {
      const arr = (s.form.drugs || [""]).slice();
      arr[i] = drugFlatLine(d);
      const ids = alignIds(s.form.drug_ids || [], arr.length);
      ids[i] = d.id; // ผูกรหัสยา → เปลี่ยนชื่อยาในคลังแล้วเคสตามทั้งหมด + Dashboard ไม่นับซ้ำ
      const form = { ...s.form, drugs: arr, drug_ids: ids } as FormState;
      let hadAuto = s.hadAuto;
      // ยา HAD (High Alert Drug) จากคลังยา → ติดธง High-alert ให้อัตโนมัติ (ผู้ใช้ปลดเองได้ถ้าไม่ต้องการ)
      if (d.had) {
        form.high_alert = true;
        hadAuto = true;
      } else {
        hadAuto = clearAutoHad(s, form); // เปลี่ยนเป็นยาไม่ HAD → ถ้าธงมาจาก auto และไม่เหลือ HAD ให้ปลด
      }
      return { form, hadAuto, drugSug: null };
    });
    draftSoon();
  };
  const removeDrug = (i: number) => {
    setState((s) => {
      const d = (s.form.drugs || [""]).slice();
      const ids = alignIds(s.form.drug_ids || [], d.length);
      d.splice(i, 1);
      ids.splice(i, 1);
      if (!d.length) {
        d.push("");
        ids.push(null);
      }
      const form = { ...s.form, drugs: d, drug_ids: ids } as FormState;
      return { form, hadAuto: clearAutoHad(s, form) };
    });
    draftSoon();
  };
  // ติ๊กธง High-alert เอง → ถือเป็นการเลือกด้วยตัวเอง (ปลด hadAuto เพื่อไม่ให้ระบบมาปลดธงให้ทีหลัง)
  const toggleHighAlert = () => {
    setState((s) => ({ form: { ...s.form, high_alert: !s.form.high_alert }, hadAuto: false }));
    draftSoon();
  };
  const toggleNature = (k: string) => {
    setState((s) => {
      const cur = Array.isArray(s.form.error_nature) ? s.form.error_nature.slice() : [];
      const i = cur.indexOf(k);
      if (i >= 0) cur.splice(i, 1);
      else cur.push(k);
      const form = { ...s.form, error_nature: cur } as FormState;
      // #14: เลิกเลือก "อื่น ๆ" → ล้างข้อความระบุทิ้ง (กันข้อความค้างติดเคสทั้งที่ไม่ได้เลือกอื่น ๆ แล้ว)
      if (!cur.includes("อื่น ๆ")) form.error_nature_other = "";
      const errors = { ...s.errors };
      delete errors.error_nature;
      delete errors.error_nature_other;
      return { form, errors };
    });
    draftSoon();
  };
  // หน่วยงานต้นเหตุ (เลือกหลายอัน · ใช้ทั้ง Med/DRP) — เลิกเลือก "อื่น ๆ" ล้างข้อความระบุ
  const toggleSourceUnit = (k: string) => {
    setState((s) => {
      const cur = Array.isArray(s.form.source_units) ? s.form.source_units.slice() : [];
      const i = cur.indexOf(k);
      if (i >= 0) cur.splice(i, 1);
      else cur.push(k);
      const form = { ...s.form, source_units: cur } as FormState;
      if (!cur.includes("อื่น ๆ")) form.source_unit_other = "";
      const errors = { ...s.errors };
      delete errors.source_units;
      delete errors.source_unit_other;
      return { form, errors };
    });
    draftSoon();
  };
  const toggleErrType = (k: string) => {
    setState((s) => {
      const cur = Array.isArray(s.form.error_type) ? s.form.error_type.slice() : s.form.error_type ? [s.form.error_type] : [];
      const i = cur.indexOf(k);
      if (i >= 0) cur.splice(i, 1);
      else cur.push(k);
      return { form: { ...s.form, error_type: cur } };
    });
    draftSoon();
  };
  // #14: เลือกประเภท DRP — กดซ้ำ= ยกเลิก · เปลี่ยนออกจาก "อื่น ๆ" ให้ล้างข้อความระบุทิ้ง
  const setDrpType = (k: string) => {
    setState((s) => {
      const next = s.form.drp_type === k ? "" : k;
      const form = { ...s.form, drp_type: next } as FormState;
      if (next !== "อื่น ๆ") form.drp_type_other = "";
      const errors = { ...s.errors };
      delete errors.drp_type;
      delete errors.drp_type_other;
      return { form, errors };
    });
    draftSoon();
  };
  const onAttachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target && e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const max = 1000;
        let w = img.width,
          h = img.height;
        if (w > max || h > max) {
          const r = Math.min(max / w, max / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d")!.drawImage(img, 0, 0, w, h);
        setField("attachment", c.toDataURL("image/jpeg", 0.7));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return {
    doSwitchType,
    requestSwitchType,
    setField,
    setLocation,
    setDrugAt,
    addDrug,
    pickDrug,
    removeDrug,
    toggleHighAlert,
    toggleNature,
    toggleSourceUnit,
    toggleErrType,
    setDrpType,
    onAttachFile,
  };
}
