"use client";

// 2026/11/12 - Arlen - 共用 UI 元件。色彩一律用 theme.css 的 utility，禁止硬寫色碼

import Image from "next/image";
import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClass: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active shadow-sm hover:shadow-md",
  secondary: "bg-surface text-fg border border-neutral-300 hover:bg-muted",
  ghost: "text-fg-secondary hover:bg-muted hover:text-fg",
  danger: "bg-danger text-on-primary hover:opacity-90 shadow-sm",
};

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-4 text-sm font-medium transition-all duration-[var(--duration-base)] hover:-translate-y-px disabled:pointer-events-none disabled:opacity-50";

export function Button({
  variant = "primary", className = "", children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button type="button" {...rest} className={`${buttonBase} ${variantClass[variant]} ${className}`}>
      {children}
    </button>
  );
}

/** 外觀像按鈕的連結；不要用 <Link><Button/></Link>（巢狀互動元素） */
export function LinkButton({
  href, variant = "primary", className = "", download, children, ...rest
}: { href: string; variant?: Variant; className?: string; download?: boolean; children: ReactNode; "data-testid"?: string }) {
  const cls = `${buttonBase} ${variantClass[variant]} ${className}`;
  if (download) return <a href={href} download className={cls} {...rest}>{children}</a>;
  return <Link href={href} className={cls} {...rest}>{children}</Link>;
}

export function IconButton({
  label, className = "", children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-sm text-fg-secondary transition-colors hover:bg-muted hover:text-fg ${className}`}
    >
      {children}
    </button>
  );
}

const inputBase =
  "w-full rounded-sm border bg-surface px-3 text-sm text-fg placeholder:text-fg-muted transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-subtle";

export function Field({
  label, required, error, hint, htmlFor, children,
}: { label: string; required?: boolean; error?: string; hint?: ReactNode; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </label>
      {children}
      <div className="flex min-h-5 justify-between gap-2 text-xs">
        <span className="text-danger" role={error ? "alert" : undefined} data-testid={error ? `${htmlFor}-error` : undefined}>
          {error}
        </span>
        {hint && <span className="text-fg-muted">{hint}</span>}
      </div>
    </div>
  );
}

export function TextInput({ invalid, className = "", ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={`${inputBase} min-h-11 ${invalid ? "border-danger" : "border-neutral-300"} ${className}`}
    />
  );
}

export function TextArea({ invalid, className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...rest}
      aria-invalid={invalid || undefined}
      className={`${inputBase} min-h-24 py-2 ${invalid ? "border-danger" : "border-neutral-300"} ${className}`}
    />
  );
}

export function Select({ invalid, className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      {...rest}
      className={`${inputBase} min-h-11 ${invalid ? "border-danger" : "border-neutral-300"} ${className}`}
    >
      {children}
    </select>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-md bg-surface p-5 shadow-sm ${className}`}>{children}</section>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold leading-tight text-fg">{title}</h1>
        {description && <p className="mt-1 text-sm text-fg-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
const toneClass: Record<Tone, string> = {
  neutral: "bg-muted text-fg-secondary",
  primary: "bg-primary-subtle text-primary-text",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  info: "bg-info-subtle text-info",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center" data-testid="empty-state">
      <div className="img-fallback mb-4 h-40 w-40 rounded-lg">
        <Image src="/assets/empty-state.png" alt="" width={160} height={160} />
      </div>
      <p className="text-lg font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-secondary">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="載入中">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-sm bg-muted" />
      ))}
    </div>
  );
}
