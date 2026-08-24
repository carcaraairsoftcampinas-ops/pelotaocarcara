import React from "react";

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label className={required ? "field-required" : ""}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Banner({ type, children }: { type: "error" | "success"; children: React.ReactNode }) {
  if (!children) return null;
  return <div className={`banner banner-${type}`}>{children}</div>;
}
