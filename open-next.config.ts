import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// การตั้งค่า OpenNext สำหรับ Cloudflare Workers
// (ยังไม่เปิด incremental cache / R2 — เพิ่มภายหลังได้ถ้าต้องการ ISR)
export default defineCloudflareConfig();
