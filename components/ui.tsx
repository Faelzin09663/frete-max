"use client";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icons";

export function PageHead({ eyebrow, title, lead }: { eyebrow?: string; title: string; lead?: string }) {
  return (
    <header className="page-head">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {lead && <p className="lead">{lead}</p>}
    </header>
  );
}

/** Rótulo + campo (+ unidade à direita e dica embaixo). */
export function Field({
  label,
  htmlFor,
  unit,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  unit?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      <div className={unit ? "inp has-unit" : "inp"}>
        {children}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="seg-btn" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Note({ tone = "warn", icon, children }: { tone?: "warn" | "loss" | "gain"; icon?: IconName; children: ReactNode }) {
  return (
    <div className={`note ${tone}`} role={tone === "loss" ? "alert" : undefined}>
      <Icon name={icon ?? (tone === "gain" ? "check" : "alert")} size={18} />
      <div>{children}</div>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ic">
        <Icon name={icon} size={24} />
      </div>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
