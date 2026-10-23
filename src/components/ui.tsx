"use client";

import Link from "next/link";
import { useState, type ComponentProps, type ReactNode } from "react";
import { CheckIcon, CopyIcon } from "./icons";

const BUTTON_VARIANTS = {
  primary: "bg-white text-black hover:bg-zinc-200",
  secondary: "border border-white/15 text-zinc-100 hover:bg-white/5",
  ghost: "text-zinc-400 hover:bg-white/5 hover:text-white",
  danger: "border border-red-500/30 text-red-300 hover:bg-red-500/10",
};

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

type ButtonStyle = {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
};

function buttonClass({ variant = "primary", size = "md" }: ButtonStyle, className = "") {
  return `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`;
}

export function Button({
  variant,
  size,
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ComponentProps<"button"> & ButtonStyle & { loading?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={buttonClass({ variant, size }, className)}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link className={buttonClass({ variant, size }, className)} {...props} />;
}

export function Spinner({ className = "size-3.5" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-zinc-200">{label}</span>
      {children}
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

const CONTROL =
  "h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-signal/60";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${CONTROL} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={`min-h-20 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-signal/60 ${className}`}
      {...props}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition ${checked ? "bg-signal" : "bg-white/15"}`}
    >
      <span
        className={`inline-block size-4 rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-1"}`}
      />
    </button>
  );
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${CONTROL} appearance-none ${className}`} {...props} />;
}

const BADGE_TONES = {
  neutral: "border-white/10 text-zinc-300",
  signal: "border-signal/40 bg-signal/10 text-orange-200",
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  danger: "border-red-400/30 bg-red-400/10 text-red-300",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof BADGE_TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.02] ${className}`}>
      {children}
    </section>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-red-300">
      {children}
    </p>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => undefined,
        );
      }}
      aria-label={label}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/5 hover:text-white"
    >
      {copied ? <CheckIcon className="size-4 text-emerald-400" /> : <CopyIcon className="size-4" />}
    </button>
  );
}

export function CodeLine({ value, secret = false }: { value: string; secret?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-panel py-1 pr-1 pl-3">
      <code
        className={`min-w-0 flex-1 truncate font-mono text-xs ${secret ? "text-orange-200" : "text-zinc-200"}`}
      >
        {value}
      </code>
      <CopyButton value={value} />
    </div>
  );
}
