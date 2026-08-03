import Link from 'next/link';
import { Brand } from './Brand';
import { MobileNav } from './MobileNav';
import { ThemeToggle } from './ThemeToggle';

const LINKS = [
  { href: '/playground', label: 'Playground' },
  { href: '/docs', label: 'API' },
  { href: '/examples', label: 'Examples' },
  { href: '/benchmark', label: 'Benchmark' },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Brand />
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-[10px] px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/Kroszborg/rune"
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-[10px] px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink md:block"
          >
            GitHub
          </a>
          <ThemeToggle />
          <MobileNav links={LINKS} />
        </div>
      </div>
    </header>
  );
}
