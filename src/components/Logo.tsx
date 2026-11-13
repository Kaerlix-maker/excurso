import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-ink">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#0e6b62" />
        <circle cx="21" cy="11" r="4" fill="#f2a33a" />
        <path d="M5 23c3.5-3 6.5-3 10 0s6.5 3 10 0" stroke="#fffdf8" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </svg>
      <span className="h-display text-xl">Excurso</span>
    </Link>
  );
}
