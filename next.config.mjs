/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // รูปแนบเก็บเป็น data URL อยู่แล้ว จึงไม่ต้องใช้ next/image optimizer
  images: { unoptimized: true },
  // ยังไม่ตั้ง ESLint config ในโปรเจกต์ (ใช้ inline-style จากดีไซน์) — ข้าม lint ตอน build
  eslint: { ignoreDuringBuilds: true },
  // อนุญาตให้เปิดผ่าน IP เครื่องในวง LAN (เทสจากมือถือวายฟายเดียวกัน) — กัน Next.js บล็อก cross-origin dev/HMR
  allowedDevOrigins: ["192.168.31.200"],
};

export default nextConfig;

// เปิดใช้ dev bindings ของ Cloudflare ตอน `next dev` (ปลอดภัยแม้ยังไม่ตั้ง binding)
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
