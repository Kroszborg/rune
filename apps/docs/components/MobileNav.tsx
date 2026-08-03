'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface NavLink {
  href: string;
  label: string;
}

/**
 * Mobile-only navigation. The desktop nav links are `hidden md:flex`, so on
 * phones this hamburger is the only way to reach the other pages. Renders a
 * disclosure panel below the sticky header; closes on navigation.
 */
export function MobileNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the panel whenever the route changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: close on path change.
  useEffect(() => setOpen(false), [pathname]);

  // Prevent the page behind the open panel from scrolling.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-[10px] border border-line text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
      >
        {open ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        )}
      </button>

      {open && (
        <>
          {/* Scrim below the header */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 bottom-0 top-16 z-40 bg-paper/60 backdrop-blur-sm [animation:fadeUp_.2s_ease-out]"
          />
          <nav className="absolute inset-x-0 top-16 z-50 border-b border-line bg-paper/95 backdrop-blur-xl [animation:fadeUp_.2s_ease-out]">
            <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-[10px] px-3 py-2.5 text-sm text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
                >
                  {l.label}
                </Link>
              ))}
              <a
                href="https://github.com/Kroszborg/rune"
                target="_blank"
                rel="noreferrer"
                className="rounded-[10px] px-3 py-2.5 text-sm text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
              >
                GitHub
              </a>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
