'use client';

import { CopyButton } from '@/components/CopyButton';
import { QRCode, type RenderOptions, toDataURL, toSVGString } from '@kroszborg/rune-react';
import { useMemo, useRef, useState } from 'react';

const DOT_STYLES = [
  'square',
  'dot',
  'rounded',
  'extra-rounded',
  'classy',
  'classy-rounded',
  'leaf',
  'diamond',
  'star',
] as const;
const SQUARE_STYLES = ['square', 'rounded', 'extra-rounded', 'circle', 'leaf'] as const;
const CORE_STYLES = ['square', 'rounded', 'dot'] as const;
const ECLS = ['L', 'M', 'Q', 'H'] as const;
const PRESETS = ['', 'minimal', 'dots', 'fluid', 'mint', 'midnight', 'sunset'] as const;

interface State {
  value: string;
  dotStyle: (typeof DOT_STYLES)[number];
  dotColor: string;
  useGradient: boolean;
  gradFrom: string;
  gradTo: string;
  gradRotation: number;
  background: string;
  squareStyle: (typeof SQUARE_STYLES)[number];
  coreStyle: (typeof CORE_STYLES)[number];
  ecl: (typeof ECLS)[number];
  margin: number;
  frameText: string;
  logoSrc: string;
  logoSize: number;
}

const INITIAL: State = {
  value: 'https://rune.kroszborg.co',
  dotStyle: 'rounded',
  dotColor: '#0b0b0f',
  useGradient: false,
  gradFrom: '#0f7a5c',
  gradTo: '#12946e',
  gradRotation: 45,
  background: '#ffffff',
  squareStyle: 'extra-rounded',
  coreStyle: 'dot',
  ecl: 'M',
  margin: 4,
  frameText: '',
  logoSrc: '',
  logoSize: 0.25,
};

// Selecting a preset loads its full look into the controls (a starting point
// you can then tweak) so the preview updates immediately.
const PRESET_STATE: Record<string, Partial<State>> = {
  minimal: {
    dotStyle: 'square',
    dotColor: '#0b0b0f',
    useGradient: false,
    squareStyle: 'square',
    coreStyle: 'square',
    background: '#ffffff',
  },
  dots: {
    dotStyle: 'dot',
    dotColor: '#0b0b0f',
    useGradient: false,
    squareStyle: 'extra-rounded',
    coreStyle: 'dot',
    background: '#ffffff',
  },
  fluid: {
    dotStyle: 'rounded',
    dotColor: '#111827',
    useGradient: false,
    squareStyle: 'extra-rounded',
    coreStyle: 'rounded',
    background: '#ffffff',
  },
  mint: {
    dotStyle: 'rounded',
    useGradient: true,
    gradFrom: '#0b6b4f',
    gradTo: '#127a5c',
    gradRotation: 45,
    squareStyle: 'extra-rounded',
    coreStyle: 'dot',
    background: '#ffffff',
  },
  midnight: {
    dotStyle: 'rounded',
    dotColor: '#e6e6ea',
    useGradient: false,
    squareStyle: 'rounded',
    coreStyle: 'rounded',
    background: '#0b0b0f',
  },
  sunset: {
    dotStyle: 'classy',
    useGradient: true,
    gradFrom: '#f0686a',
    gradTo: '#f4a259',
    gradRotation: 90,
    squareStyle: 'leaf',
    coreStyle: 'rounded',
    background: '#fffdfb',
  },
};

function buildOptions(s: State): RenderOptions {
  const gradient = s.useGradient
    ? {
        type: 'linear' as const,
        rotation: s.gradRotation,
        stops: [
          { offset: 0, color: s.gradFrom },
          { offset: 1, color: s.gradTo },
        ],
      }
    : undefined;
  return {
    value: s.value || ' ',
    size: 300,
    margin: s.margin,
    dots: { style: s.dotStyle, color: s.dotColor, gradient },
    corners: { square: { style: s.squareStyle }, dot: { style: s.coreStyle } },
    background: s.background,
    qr: { errorCorrectionLevel: s.ecl },
    frame: s.frameText ? { style: 'rounded', text: s.frameText } : undefined,
    logo: s.logoSrc ? { src: s.logoSrc, size: s.logoSize } : undefined,
  };
}

function codeSnippet(s: State): string {
  const parts: string[] = [`  value="${s.value}"`];
  parts.push(
    `  dots={{ style: '${s.dotStyle}'${
      s.useGradient
        ? `, gradient: { type: 'linear', rotation: ${s.gradRotation}, stops: [{ offset: 0, color: '${s.gradFrom}' }, { offset: 1, color: '${s.gradTo}' }] }`
        : `, color: '${s.dotColor}'`
    } }}`,
  );
  parts.push(
    `  corners={{ square: { style: '${s.squareStyle}' }, dot: { style: '${s.coreStyle}' } }}`,
  );
  if (s.background !== '#ffffff') parts.push(`  background="${s.background}"`);
  parts.push(`  qr={{ errorCorrectionLevel: '${s.ecl}' }}`);
  if (s.frameText) parts.push(`  frame={{ style: 'rounded', text: '${s.frameText}' }}`);
  if (s.logoSrc) parts.push(`  logo={{ src: '/your-logo.png', size: ${s.logoSize} }}`);
  return `import { QRCode } from '@kroszborg/rune-react';\n\n<QRCode\n${parts.join('\n')}\n/>`;
}

export default function Playground() {
  const [s, setS] = useState<State>(INITIAL);
  const [preset, setPreset] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const options = useMemo(() => buildOptions(s), [s]);
  const code = useMemo(() => codeSnippet(s), [s]);
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));

  const applyPreset = (name: string) => {
    setPreset(name);
    if (name && PRESET_STATE[name]) setS((p) => ({ ...p, ...PRESET_STATE[name] }));
  };

  const onLogoFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      set('logoSrc', String(reader.result));
      if (s.ecl !== 'H') set('ecl', 'H'); // logos need high error correction
    };
    reader.readAsDataURL(file);
  };

  const download = async (format: 'svg' | 'png') => {
    let href: string;
    if (format === 'svg') {
      href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(toSVGString({ ...options, size: 1024 }))}`;
    } else {
      href = await toDataURL({ ...options, size: 1024 }, { format: 'png' });
    }
    const a = document.createElement('a');
    a.href = href;
    a.download = `rune-qr.${format}`;
    a.click();
  };

  const reset = () => {
    setS(INITIAL);
    setPreset('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 [animation:fadeUp_.5s_ease-out]">
      <p className="eyebrow mb-2">Playground</p>
      <h1 className="mb-8 text-3xl sm:text-4xl">Try it live.</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:gap-8">
        {/* Preview + code */}
        <div className="flex min-w-0 flex-col gap-6">
          <div className="grid min-h-[300px] place-items-center rounded-[20px] border border-line bg-panel p-4 sm:min-h-[360px] sm:p-8">
            {/* Neutral card so both light- and dark-background codes stay visible */}
            <div className="w-full max-w-[300px] rounded-[16px] bg-[#f4f4f6] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)] sm:p-5">
              <QRCode {...options} className="block h-auto w-full" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => download('svg')}
              className="rounded-[11px] border border-line-strong px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-paper-2"
            >
              Download SVG
            </button>
            <button
              type="button"
              onClick={() => download('png')}
              className="rounded-[11px] border border-line-strong px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-paper-2"
            >
              Download PNG
            </button>
            <button
              type="button"
              onClick={reset}
              className="ml-auto rounded-[11px] px-4 py-2.5 text-sm text-ink-soft transition-colors hover:text-ink"
            >
              Reset
            </button>
          </div>
          <div className="relative rounded-[14px] border border-line bg-panel">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="eyebrow">React</span>
              <CopyButton text={code} />
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-ink">
              <code>{code}</code>
            </pre>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-5 rounded-[16px] border border-line bg-panel p-5">
          <Field label="Value">
            <input
              value={s.value}
              onChange={(e) => set('value', e.target.value)}
              className="w-full rounded-[9px] border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-mint"
            />
          </Field>
          <Field label="Preset (loads a starting style)">
            <Select
              value={preset}
              onChange={applyPreset}
              options={PRESETS.map((p) => [p, p || 'none'])}
            />
          </Field>
          <Field label="Dot style">
            <Select
              value={s.dotStyle}
              onChange={(v) => set('dotStyle', v as State['dotStyle'])}
              options={DOT_STYLES.map((d) => [d, d])}
            />
          </Field>
          <div className="flex items-center justify-between">
            <label className="text-sm text-ink-soft" htmlFor="grad">
              Gradient fill
            </label>
            <input
              id="grad"
              type="checkbox"
              checked={s.useGradient}
              onChange={(e) => set('useGradient', e.target.checked)}
              className="h-4 w-4 accent-mint"
            />
          </div>
          {s.useGradient ? (
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="From" value={s.gradFrom} onChange={(v) => set('gradFrom', v)} />
              <ColorField label="To" value={s.gradTo} onChange={(v) => set('gradTo', v)} />
              <Field label={`Rotation ${s.gradRotation}°`}>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={s.gradRotation}
                  onChange={(e) => set('gradRotation', Number(e.target.value))}
                  className="w-full accent-mint"
                />
              </Field>
            </div>
          ) : (
            <ColorField label="Dot color" value={s.dotColor} onChange={(v) => set('dotColor', v)} />
          )}
          <ColorField
            label="Background"
            value={s.background}
            onChange={(v) => set('background', v)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Finder ring">
              <Select
                value={s.squareStyle}
                onChange={(v) => set('squareStyle', v as State['squareStyle'])}
                options={SQUARE_STYLES.map((d) => [d, d])}
              />
            </Field>
            <Field label="Finder core">
              <Select
                value={s.coreStyle}
                onChange={(v) => set('coreStyle', v as State['coreStyle'])}
                options={CORE_STYLES.map((d) => [d, d])}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Error correction">
              <Select
                value={s.ecl}
                onChange={(v) => set('ecl', v as State['ecl'])}
                options={ECLS.map((d) => [d, d])}
              />
            </Field>
            <Field label={`Margin ${s.margin}`}>
              <input
                type="range"
                min={0}
                max={10}
                value={s.margin}
                onChange={(e) => set('margin', Number(e.target.value))}
                className="w-full accent-mint"
              />
            </Field>
          </div>
          <Field label="Frame text (CTA)">
            <input
              value={s.frameText}
              onChange={(e) => set('frameText', e.target.value)}
              placeholder="e.g. SCAN ME"
              className="w-full rounded-[9px] border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-mint"
            />
          </Field>

          {/* Logo */}
          <div className="flex flex-col gap-2 rounded-[10px] border border-line bg-paper p-3">
            <span className="text-xs font-medium text-ink-soft">Center logo (auto-uses ECL H)</span>
            {s.logoSrc ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.logoSrc}
                  alt="logo preview"
                  className="h-9 w-9 rounded-md object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    set('logoSrc', '');
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                  className="text-xs text-danger hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-[9px] border border-dashed border-line-strong px-3 py-2 text-sm text-ink-soft transition-colors hover:border-mint hover:text-ink"
              >
                Upload an image…
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onLogoFile(e.target.files?.[0])}
            />
            {s.logoSrc && (
              <label className="mt-1 flex flex-col gap-1">
                <span className="text-[11px] text-ink-faint">
                  Size {Math.round(s.logoSize * 100)}%
                </span>
                <input
                  type="range"
                  min={0.1}
                  max={0.4}
                  step={0.01}
                  value={s.logoSize}
                  onChange={(e) => set('logoSize', Number(e.target.value))}
                  className="w-full accent-mint"
                />
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-[9px] border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-mint"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffffff';
  return (
    <Field label={label}>
      <div className="flex items-center gap-2 rounded-[9px] border border-line bg-paper px-2 py-1.5 focus-within:border-mint">
        <label
          className="relative block h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-md border border-line-strong"
          style={{ background: hex }}
          aria-label="Pick color"
        >
          <input
            type="color"
            value={hex}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent font-mono text-sm text-ink outline-none"
        />
      </div>
    </Field>
  );
}
