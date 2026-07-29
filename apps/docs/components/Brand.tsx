import Link from 'next/link';

/**
 * Rune wordmark. The mark is a stylized QR finder pattern (the square-in-square
 * corner marker every QR code has) — instantly reads as "QR", and is distinct
 * from other projects' logos.
 */
export function Brand() {
  return (
    <Link href="/" className="group flex items-center gap-2.5 text-ink" aria-label="Rune home">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="text-mint transition-transform duration-300 ease-out group-hover:rotate-[-6deg]"
      >
        <title>Rune</title>
        <rect
          x="2.5"
          y="2.5"
          width="19"
          height="19"
          rx="5.5"
          stroke="currentColor"
          strokeWidth="2.4"
        />
        <rect x="8" y="8" width="8" height="8" rx="2.2" fill="currentColor" />
      </svg>
      <span className="font-display text-[1.35rem] leading-none tracking-tight">Rune</span>
    </Link>
  );
}
