import Link from 'next/link';

/** Rune wordmark with a small runic four-point spark. */
export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-ink" aria-label="Rune home">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <title>Rune</title>
        <path
          d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"
          fill="currentColor"
          className="text-mint"
        />
      </svg>
      <span className="font-display text-[1.35rem] leading-none tracking-tight">Rune</span>
    </Link>
  );
}
