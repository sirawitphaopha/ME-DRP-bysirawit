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
  "deleted_at",
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
    .is("deleted_at", null) // เอาเฉพาะที่ยังใช้งานอยู่ (ไม่เอาที่อยู่ในถังขยะ)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Incident[];
}

// ดึงรายงานในถังขยะ (ที่ถูกลบแบบซ่อน) — เรียงตามเวลาที่ลบ ล่าสุดขึ้นก่อน
export async function fetchDeletedIncidents(cfg: SupabaseCfg): Promise<Incident[]> {
  const c = getClient(cfg);
  const { data, error } = await c
    .from("incidents")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Incident[];
}

// ลบแบบซ่อน (ชั้น 1) — ตั้ง deleted_at = ตอนนี้ · ยังกู้คืนได้
export async function softDeleteIncident(cfg: SupabaseCfg, id: string): Promise<void> {
  const c = getClient(cfg);
  const { error } = await c.from("incidents").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// กู้คืนจากถังขยะ — ล้าง deleted_at กลับเป็น null · คืน true เมื่อมีแถวถูกกู้คืนจริง
// (ถ้าเครื่องอื่นลบถาวรไปแล้ว จะ update โดน 0 แถว → คืน false ไม่หลอกว่า "กู้คืนแล้ว")
export async function restoreIncident(cfg: SupabaseCfg, id: string): Promise<boolean> {
  const c = getClient(cfg);
  const { data, error } = await c.from("incidents").update({ deleted_at: null }).eq("id", id).select("id");
  if (error) throw error;
  return !!(data && data.length);
}

// ลบถาวร (ชั้น 2) — ลบแถวออกจากฐานข้อมูลจริง กู้คืนไม่ได้
export async function hardDeleteIncident(cfg: SupabaseCfg, id: string): Promise<void> {
  const c = getClient(cfg);
  const { error } = await c.from("incidents").delete().eq("id", id);
  if (error) throw error;
}

export async function insertIncident(cfg: SupabaseCfg, rec: Incident): Promise<void> {
  const c = getClient(cfg);
  const { error } = await c.from("incidents").insert(toRow(rec));
  if (error) throw error;
}

// ส่ง incident ขึ้น Supabase แบบ "ยืนยันผลจริง + ลองซ้ำอัตโนมัติในครั้งเดียว" — คืน true เฉพาะเมื่อขึ้นระบบสำเร็จ (หรือมีอยู่แล้ว)
// 🐛 บั๊ก cross-browser (Safari): คำขอ POST "ครั้งแรก" บางทีสะดุดที่ฝั่งเบราว์เซอร์ (cold start / ITP / เน็ตวืบ)
//    ก่อนถึง server → กดครั้งเดียวไม่ไป แต่กดซ้ำแล้วไป (log ฝั่ง server เห็นแต่ POST 201 ไม่มี error)
//    แก้: ลองส่งซ้ำเองในการกดครั้งเดียว (idempotent — id เดิม → 23505 = สำเร็จ ไม่เกิดซ้ำ)
//    per-attempt timeout ใช้ AbortController ยกเลิกคำขอที่ค้างจริง ๆ ก่อนลองใหม่ (กันคำขอซ้อน)
export async function pushIncident(
  cfg: SupabaseCfg,
  rec: Incident,
  opts: { attempts?: number; timeoutMs?: number } = {}
): Promise<boolean> {
  const attempts = opts.attempts ?? 3;
  const timeoutMs = opts.timeoutMs ?? 9000;
  const c = getClient(cfg);
  const row = toRow(rec);
  for (let a = 0; a < attempts; a++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const { error } = (await c.from("incidents").insert(row).abortSignal(ctrl.signal)) as {
        error: { code?: string } | null;
      };
      clearTimeout(timer);
      if (!error) return true;
      if (error.code === "23505") return true; // แถวนี้อยู่ในระบบแล้ว (PK ซ้ำ) = ถือว่าสำเร็จ
      // error อื่น (เครือข่ายวืบ ฯลฯ) → ตกไปลองใหม่
    } catch {
      clearTimeout(timer); // abort / network error → ลองใหม่
    }
    if (a < attempts - 1) await new Promise((r) => setTimeout(r, 500 * (a + 1))); // backoff 0.5s, 1s
  }
  return false;
}

export async function updateIncident(cfg: SupabaseCfg, rec: Incident): Promise<void> {
  const c = getClient(cfg);
  const { error } = await c.from("incidents").update(toRow(rec)).eq("id", rec.id);
  if (error) throw error;
}

// อัปเดต incident ขึ้น Supabase แบบ "ยืนยันผล + ลองซ้ำอัตโนมัติ" (เหมือน pushIncident) — คืน true ถ้าสำเร็จ
// แก้บั๊ก: เดิม saveEdit ดัก error เงียบแล้วขึ้น "บันทึกการแก้ไขแล้ว" หลอก (การแก้ไขไม่ขึ้น server แล้วหาย)
export async function pushUpdate(
  cfg: SupabaseCfg,
  rec: Incident,
  opts: { attempts?: number; timeoutMs?: number } = {}
): Promise<boolean> {
  const attempts = opts.attempts ?? 3;
  const timeoutMs = opts.timeoutMs ?? 9000;
  const c = getClient(cfg);
  const row = toRow(rec);
  for (let a = 0; a < attempts; a++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const { error } = (await c.from("incidents").update(row).eq("id", rec.id).abortSignal(ctrl.signal)) as {
        error: { code?: string } | null;
      };
      clearTimeout(timer);
      if (!error) return true;
    } catch {
      clearTimeout(timer);
    }
    if (a < attempts - 1) await new Promise((r) => setTimeout(r, 500 * (a + 1)));
  }
  return false;
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
