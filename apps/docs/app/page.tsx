import { InstallCommand } from '@/components/CopyButton';
import { Reveal } from '@/components/Reveal';
import { StaticQR } from '@/components/StaticQR';
import Link from 'next/link';

// The hero's job is to show the *range* of customization - one payload, four
// visibly different treatments. All are real presets, all verified scannable.
const SHOWCASE = [
  { preset: 'mint', label: 'gradient' },
  { preset: 'sunset', label: 'leaf' },
  { preset: 'fluid', label: 'fluid' },
  { preset: 'dots', label: 'dots' },
] as const;

const FEATURES = [
  ['Pure SVG', 'No canvas, no raster. Scales perfectly at any resolution - print or screen.'],
  [
    'Zero dependencies',
    'QR encoding built from scratch per ISO/IEC 18004. The core has no runtime deps.',
  ],
  [
    'Any framework',
    'React, Vue, vanilla and a <rune-qr> Web Component. Everything else renders via toSVGString.',
  ],
  ['Every shape', 'Nine dot styles, five finder rings, three finder cores - mix freely.'],
  [
    'Gradients & frames',
    'Linear/radial gradients per element, background images, frames with CTA text.',
  ],
  ['Logos, safely', 'Embed any image or React node; size auto-clamped per ECL to stay scannable.'],
  ['Data builders', 'WiFi, vCard, email, SMS, geo, calendar, crypto - correctly escaped for you.'],
  ['Export anywhere', 'toSVGString (sync/SSR), plus PNG · JPEG · WebP · PDF via optional peers.'],
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-6 pt-20 pb-16 text-center sm:pt-28">
        <p className="eyebrow rise rise-1">Framework-agnostic · ISO/IEC 18004</p>
        <h1 className="rise rise-1 max-w-3xl text-[2.75rem] leading-[1.02] sm:text-6xl">
          Beautiful QR codes,
          <br />
          <span className="serif-italic text-mint">fully</span> under your control.
        </h1>
        <p className="rise rise-2 max-w-xl text-lg text-ink-soft">
          Rune is a lightweight, fully customizable QR code library. Custom shapes, gradients,
          logos, and frames. Clean, scannable, and built from scratch.
        </p>

        <div className="rise rise-3 w-full max-w-md">
          <InstallCommand />
        </div>

        <div className="rise rise-3 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/playground"
            className="rounded-[11px] bg-signal px-5 py-3 text-sm font-semibold text-signal-contrast transition-opacity hover:opacity-90"
          >
            Open the playground
          </Link>
          <Link
            href="/docs"
            className="rounded-[11px] border border-line-strong px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-paper-2"
          >
            Read the API
          </Link>
        </div>

        <div className="rise rise-4 mt-4 grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {SHOWCASE.map((s) => (
            <figure key={s.label} className="flex flex-col items-center gap-3">
              <div className="w-full rounded-[18px] border border-line bg-white p-4 transition-transform duration-300 ease-out hover:-translate-y-1.5">
                <StaticQR
                  value="https://rune.kroszborg.co"
                  preset={s.preset}
                  size={150}
                  id={`hero-${s.preset}`}
                  className="block [&>svg]:h-auto [&>svg]:w-full"
                />
              </div>
              <figcaption className="text-xs text-ink-faint">{s.label}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Features */}
      <Reveal>
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="eyebrow mb-2">What&apos;s included</p>
              <h2 className="text-3xl sm:text-4xl">Everything a QR needs, and more.</h2>
            </div>
          </div>
          <div className="grid gap-px overflow-hidden rounded-[16px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(([title, body]) => (
              <div
                key={title}
                className="bg-paper p-6 transition-colors duration-300 hover:bg-paper-2"
              >
                <h3 className="mb-2 font-sans text-base font-semibold tracking-normal text-ink">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-ink-soft">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* Compare */}
      <Reveal>
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="glass p-8 sm:p-10">
            <p className="eyebrow mb-2">Why Rune</p>
            <h2 className="mb-6 text-2xl sm:text-3xl">
              More frameworks, more styles, more output.
            </h2>
            <div className="grid gap-6 text-sm sm:grid-cols-3">
              <Stat n="4" label="frameworks - React, Vue, vanilla, Web Component" />
              <Stat n="9 × 5" label="dot styles × finder ring styles, freely mixed" />
              <Stat n="5" label="output formats - SVG, PNG, JPEG, WebP, PDF" />
            </div>
          </div>
        </section>
      </Reveal>
    </>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="rounded-[12px] border border-line bg-paper p-5">
      <div className="font-display text-3xl text-mint">{n}</div>
      <div className="mt-1 text-ink-soft">{label}</div>
    </div>
  );
}
