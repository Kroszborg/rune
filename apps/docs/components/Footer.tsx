import { Brand } from './Brand';

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Brand />
          <p className="text-sm text-ink-faint">
            Pure SVG · Zero dependencies · Built from scratch per ISO/IEC 18004.
          </p>
        </div>
        <div className="flex items-center gap-5 text-sm text-ink-soft">
          <a className="link-ul" href="https://github.com/Kroszborg/rune">
            GitHub
          </a>
          <a className="link-ul" href="https://www.npmjs.com/package/@kroszborg/rune">
            npm
          </a>
          <span className="text-ink-faint">© 2026 Abhiman Panwar · MIT</span>
        </div>
      </div>
    </footer>
  );
}
