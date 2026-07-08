"use client";
import React, { useState } from "react";
import { css } from "@/lib/style";

// ---- ปุ่มที่มี hover style (แทน attribute style-hover ของ DC) ----
type HButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style"> & {
  base: string;
  hover?: string;
  extra?: React.CSSProperties;
};
export function HButton({ base, hover, extra, onMouseEnter, onMouseLeave, ...rest }: HButtonProps) {
  const [h, setH] = useState(false);
  return (
    <button
      {...rest}
      onMouseEnter={(e) => {
        setH(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setH(false);
        onMouseLeave?.(e);
      }}
      style={{ ...css(base), ...(h && hover ? css(hover) : {}), ...extra }}
    />
  );
}

// ---- input ที่มี focus style ----
type HInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "style"> & {
  base: string;
  focus?: string;
};
export function HInput({ base, focus, onFocus, onBlur, ...rest }: HInputProps) {
  const [f, setF] = useState(false);
  return (
    <input
      {...rest}
      onFocus={(e) => {
        setF(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setF(false);
        onBlur?.(e);
      }}
      style={{ ...css(base), ...(f && focus ? css(focus) : {}) }}
    />
  );
}

type HTextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "style"> & {
  base: string;
  focus?: string;
};
export function HTextarea({ base, focus, onFocus, onBlur, ...rest }: HTextareaProps) {
  const [f, setF] = useState(false);
  return (
    <textarea
      {...rest}
      onFocus={(e) => {
        setF(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setF(false);
        onBlur?.(e);
      }}
      style={{ ...css(base), ...(f && focus ? css(focus) : {}) }}
    />
  );
}

type HSelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "style"> & {
  base: string;
  focus?: string;
};
export function HSelect({ base, focus, onFocus, onBlur, children, ...rest }: HSelectProps) {
  const [f, setF] = useState(false);
  return (
    <select
      {...rest}
      onFocus={(e) => {
        setF(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setF(false);
        onBlur?.(e);
      }}
      style={{ ...css(base), ...(f && focus ? css(focus) : {}) }}
    >
      {children}
    </select>
  );
}

// ---- div ที่มี hover style (การ์ด KPI, แท่งกราฟ, แถวตาราง) ----
type HDivProps = Omit<React.HTMLAttributes<HTMLDivElement>, "style"> & {
  base: string;
  hover?: string;
  extra?: React.CSSProperties;
};
export function HDiv({ base, hover, extra, onMouseEnter, onMouseLeave, children, ...rest }: HDivProps) {
  const [h, setH] = useState(false);
  return (
    <div
      {...rest}
      onMouseEnter={(e) => {
        setH(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setH(false);
        onMouseLeave?.(e);
      }}
      style={{ ...css(base), ...(h && hover ? css(hover) : {}), ...extra }}
    >
      {children}
    </div>
  );
}

// ---- แถว <tr> ที่มี hover ----
type HTrProps = Omit<React.HTMLAttributes<HTMLTableRowElement>, "style"> & {
  base: string;
  hover?: string;
};
export function HTr({ base, hover, onMouseEnter, onMouseLeave, children, ...rest }: HTrProps) {
  const [h, setH] = useState(false);
  return (
    <tr
      {...rest}
      onMouseEnter={(e) => {
        setH(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setH(false);
        onMouseLeave?.(e);
      }}
      style={{ ...css(base), ...(h && hover ? css(hover) : {}) }}
    >
      {children}
    </tr>
  );
}

// ---- label ที่ครอบ input file (ปุ่มแนบรูป) ----
type HFileLabelProps = {
  base: string;
  hover?: string;
  children: React.ReactNode;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};
export function HFileLabel({ base, hover, children, onChange }: HFileLabelProps) {
  const [h, setH] = useState(false);
  return (
    <label
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{ ...css(base), ...(h && hover ? css(hover) : {}) }}
    >
      {children}
      <input type="file" accept="image/*" onChange={onChange} style={{ display: "none" }} />
    </label>
  );
}
