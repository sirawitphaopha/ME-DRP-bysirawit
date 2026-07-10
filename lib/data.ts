import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Drug, Incident, SupabaseCfg } from "./types";

// คอลัมน์ที่ sync กับตาราง public.incidents
const COLS = [
  "id",
  "type",
  "occurred_at",
  "occurred_time",
  "shift",
  "hn",
  "reporter",
  "drug",
  "drugs",
  "high_alert",
  "lasa",
  "attachment",
  "detail",
  "location",
  "an",
  "error_type",
  "error_nature",
  "error_nature_other",
  "severity",
  "management",
  "drp_type",
  "drp_type_other",
  "cause",
  "intervention",
  "outcome",
  "edited",
  "edited_at",
  "edit_count",
  "history",
  "created_at",
] as const;

export function toRow(o: Incident): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const c of COLS) {
    const v = (o as unknown as Record<string, unknown>)[c];
    if (v !== undefined) r[c] = v;
  }
  // error_nature / error_type ต้องเป็น array เสมอ (คอลัมน์ jsonb)
  if (r.error_nature !== undefined && !Array.isArray(r.error_nature)) {
    r.error_nature = r.error_nature ? [r.error_nature] : [];
  }
  if (r.error_type !== undefined && !Array.isArray(r.error_type)) {
    r.error_type = r.error_type ? [r.error_type] : [];
  }
  // severity/outcome มี CHECK constraint (severity ∈ A–I, outcome ∈ Accepted/Rejected/Pending)
  // ฟอร์มส่ง "" มาเมื่อไม่ได้กรอก (Med Error ไม่มีช่อง outcome / DRP ไม่มีช่อง severity)
  // ค่าว่าง "" ไม่ผ่าน constraint → ต้องแปลงเป็น null ก่อนส่ง Supabase ไม่งั้นโดนตีกลับ 400
  for (const c of ["severity", "outcome"] as const) {
    if (r[c] === "") r[c] = null;
  }
  return r;
}

// config จาก env (ค่า default ตอน build)
export function envConfig(): SupabaseCfg {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  };
}

export function isConfigured(cfg: SupabaseCfg): boolean {
  return !!(cfg.url && cfg.key);
}

const clientCache = new Map<string, SupabaseClient>();
function getClient(cfg: SupabaseCfg): SupabaseClient {
  const k = cfg.url + "|" + cfg.key;
  let c = clientCache.get(k);
  if (!c) {
    c = createClient(cfg.url.replace(/\/+$/, ""), cfg.key, {
      auth: { persistSession: false },
    });
    clientCache.set(k, c);
  }
  return c;
}

export async function fetchIncidents(cfg: SupabaseCfg): Promise<Incident[]> {
  const c = getClient(cfg);
  const { data, error } = await c
    .from("incidents")
    .select("*")
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Incident[];
}

export async function insertIncident(cfg: SupabaseCfg, rec: Incident): Promise<void> {
  const c = getClient(cfg);
  const { error } = await c.from("incidents").insert(toRow(rec));
  if (error) throw error;
}

export async function updateIncident(cfg: SupabaseCfg, rec: Incident): Promise<void> {
  const c = getClient(cfg);
  const { error } = await c.from("incidents").update(toRow(rec)).eq("id", rec.id);
  if (error) throw error;
}

// โหลดคลังยาทั้งหมด (สำหรับ autocomplete · โหลดครั้งเดียวแล้ว cache ในเครื่อง)
export async function fetchDrugs(cfg: SupabaseCfg): Promise<Drug[]> {
  const c = getClient(cfg);
  const { data, error } = await c.from("drugs").select("*").order("generic");
  if (error) throw error;
  return (data || []) as Drug[];
}
