'use client';

import { useState } from 'react';

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy to clipboard"
      className={`text-ink-faint transition-colors hover:text-ink ${className ?? ''}`}
    >
      {copied ? (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
    </button>
  );
}

export function InstallCommand({
  command = 'pnpm add @kroszborg/rune-react',
}: { command?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-line bg-panel px-4 py-3 font-mono text-sm">
      <span className="select-none text-mint">$</span>
      <code className="text-ink">{command}</code>
      <span className="ml-auto">
        <CopyButton text={command} />
      </span>
    </div>
  );
}
