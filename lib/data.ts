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
  "managed",
  "pharmacist_only",
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
  // fallback = ค่า Supabase จริง (คีย์ publishable · เปิดเผยได้ · คุมด้วย RLS) เผื่อ NEXT_PUBLIC ไม่ถูก inline เข้า client
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ryewggkhunpuipgkgbfv.supabase.co",
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_cSCNAQextpTq9SzUt189uw_lemUK6Ah",
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

// ส่ง incident ขึ้น Supabase แบบ "ยืนยันผลจริง" — คืน true เฉพาะเมื่อขึ้นระบบสำเร็จ (หรือมีอยู่แล้ว)
// มี timeout กันคำขอค้างนาน (เคสมือถือเน็ตช้า) เพื่อไม่ให้ UI ขึ้น "บันทึกแล้ว" หลอกทั้งที่ยังไม่ขึ้นระบบ
export async function pushIncident(cfg: SupabaseCfg, rec: Incident, timeoutMs = 12000): Promise<boolean> {
  const c = getClient(cfg);
  const insertP: Promise<{ error: { code?: string } | null }> = Promise.resolve(
    c.from("incidents").insert(toRow(rec))
  ).then((r) => ({ error: (r as { error: { code?: string } | null }).error }));
  const timeoutP = new Promise<{ error: { code?: string } | null }>((resolve) =>
    setTimeout(() => resolve({ error: { code: "TIMEOUT" } }), timeoutMs)
  );
  try {
    const { error } = await Promise.race([insertP, timeoutP]);
    if (!error) return true;
    if (error.code === "23505") return true; // แถวนี้อยู่ในระบบแล้ว (PK ซ้ำ) = ถือว่าสำเร็จ
    return false;
  } catch {
    return false;
  }
}

export async function updateIncident(cfg: SupabaseCfg, rec: Incident): Promise<void> {
  const c = getClient(cfg);
  const { error } = await c.from("incidents").update(toRow(rec)).eq("id", rec.id);
  if (error) throw error;
}

// ---------- Realtime (กระจายสัญญาณสด) ----------
// เปิดสายรับสัญญาณตาราง incidents · 1 ช่องต่อ 1 ตาราง (หลายช่องซ้อนตารางเดียว = ได้ event ไม่ครบ)
// พอมีเครื่องไหน insert/update/delete → เรียก onChange() ให้แอปดึงข้อมูลใหม่ทั้งชุด
// (ดึงใหม่ผ่าน API เชื่อถือได้กว่าการแปะค่าจาก payload — ได้ลำดับ/ตัวกรองตรงกับที่ server ให้)
// คืนค่า = ฟังก์ชันปิดสาย (เรียกตอน component unmount)
export function subscribeIncidents(
  cfg: SupabaseCfg,
  onChange: () => void,
  onStatus?: (connected: boolean) => void
): () => void {
  const c = getClient(cfg);
  const ch = c
    .channel("incidents-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => onChange())
    .subscribe((status) => {
      if (onStatus) onStatus(status === "SUBSCRIBED");
    });
  return () => {
    try {
      c.removeChannel(ch);
    } catch {}
  };
}

// โหลดคลังยาทั้งหมด (สำหรับ autocomplete · โหลดครั้งเดียวแล้ว cache ในเครื่อง)
export async function fetchDrugs(cfg: SupabaseCfg): Promise<Drug[]> {
  const c = getClient(cfg);
  const { data, error } = await c.from("drugs").select("*").order("generic");
  if (error) throw error;
  return (data || []) as Drug[];
}
