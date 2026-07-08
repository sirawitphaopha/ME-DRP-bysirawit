import type { CSSProperties } from "react";

// แปลง CSS declaration string (จากดีไซน์ DC) → React.CSSProperties
// ใช้กับ inline style เท่านั้น (ค่าเรียบง่าย ไม่มี data URI ที่มี ';')
export function css(s: string): CSSProperties {
  const obj: Record<string, string> = {};
  if (!s) return obj as CSSProperties;
  for (const decl of s.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!prop) continue;
    const camel = prop.replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
    obj[camel] = val;
  }
  return obj as CSSProperties;
}
