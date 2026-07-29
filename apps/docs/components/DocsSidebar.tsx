'use client';

import { useEffect, useState } from 'react';

export const DOC_SECTIONS = [
  { id: 'getting-started', title: 'Getting started' },
  { id: 'options', title: 'RuneOptions' },
  { id: 'dots', title: 'Dot styles' },
  { id: 'finders', title: 'Finder styles' },
  { id: 'colors', title: 'Colors & gradients' },
  { id: 'background', title: 'Background' },
  { id: 'logo', title: 'Logo' },
  { id: 'frame', title: 'Frame & CTA' },
  { id: 'ecl', title: 'Error correction' },
  { id: 'presets', title: 'Presets' },
  { id: 'data', title: 'Data builders' },
  { id: 'export', title: 'Export' },
  { id: 'decode', title: 'Decoding' },
  { id: 'cli', title: 'CLI' },
  { id: 'frameworks', title: 'Frameworks' },
] as const;

export function DocsSidebar() {
  const [active, setActive] = useState<string>(DOC_SECTIONS[0].id);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-15% 0px -75% 0px', threshold: 0 },
    );
    for (const s of DOC_SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);

  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      {DOC_SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={`rounded-md px-3 py-1.5 transition-colors ${
            active === s.id
              ? 'bg-paper-2 font-medium text-ink'
              : 'text-ink-soft hover:bg-paper-2 hover:text-ink'
          }`}
        >
          {s.title}
        </a>
      ))}
    </nav>
  );
}
