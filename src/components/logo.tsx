/**
 * The mark: an open ring around a dot. Reads as a "C", as an abstract "@" (a dot inside a ring)
 * and as a station on the air. The dot is the only colored part.
 */
export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <path
        d="M24.43 8.93A11 11 0 1 0 24.43 23.07"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="4" className="fill-signal" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-white">
      <LogoMark className="size-[22px]" />
      <span className="text-[17px] font-semibold tracking-[-0.03em]">callsign</span>
    </span>
  );
}
