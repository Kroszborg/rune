import { StaticQR } from '@/components/StaticQR';
import type { RenderOptions } from '@kroszborg/rune';
import { data } from '@kroszborg/rune';

const V = 'https://rune.kroszborg.co';

const GALLERY: Array<{ title: string; note: string; options: RenderOptions }> = [
  { title: 'Minimal', note: "preset: 'minimal'", options: { value: V, preset: 'minimal' } },
  { title: 'Fluid', note: "preset: 'fluid'", options: { value: V, preset: 'fluid' } },
  { title: 'Mint', note: "preset: 'mint'", options: { value: V, preset: 'mint' } },
  { title: 'Midnight', note: "preset: 'midnight'", options: { value: V, preset: 'midnight' } },
  { title: 'Sunset', note: "preset: 'sunset'", options: { value: V, preset: 'sunset' } },
  { title: 'Dots', note: "preset: 'dots'", options: { value: V, preset: 'dots' } },
  {
    title: 'Radial gradient',
    note: 'radial gradient dots',
    options: {
      value: V,
      dots: {
        style: 'dot',
        gradient: {
          type: 'radial',
          stops: [
            { offset: 0, color: '#0f7a5c' },
            { offset: 1, color: '#0b0b0f' },
          ],
        },
      },
      corners: { square: { style: 'circle' } },
    },
  },
  {
    title: 'Leaf finders',
    note: "corners.square: 'leaf'",
    options: {
      value: V,
      dots: { style: 'classy', color: '#1f2937' },
      corners: { square: { style: 'leaf' } },
    },
  },
  {
    title: 'Frame + CTA',
    note: 'frame with SCAN ME',
    options: {
      value: V,
      dots: { style: 'rounded', color: '#0b0b0f' },
      frame: { style: 'rounded', text: 'SCAN ME' },
    },
  },
  {
    title: 'Extra-rounded',
    note: "dots: 'extra-rounded'",
    options: {
      value: V,
      dots: { style: 'extra-rounded', color: '#0b0b0f' },
      corners: { square: { style: 'extra-rounded' }, dot: { style: 'dot' } },
    },
  },
  {
    title: 'Classy rounded',
    note: "dots: 'classy-rounded'",
    options: {
      value: V,
      dots: { style: 'classy-rounded', color: '#1f2937' },
      corners: { square: { style: 'leaf' } },
    },
  },
];

const RECIPES: Array<{ title: string; code: string; options: RenderOptions }> = [
  {
    title: 'WiFi network',
    code: "data.wifi({ ssid: 'Rune', password: 'hunter2' })",
    options: { value: data.wifi({ ssid: 'Rune', password: 'hunter2' }), preset: 'fluid' },
  },
  {
    title: 'Contact (vCard)',
    code: "data.vcard({ fullName: 'Ada Lovelace', email: 'ada@x.com' })",
    options: {
      value: data.vcard({ fullName: 'Ada Lovelace', email: 'ada@x.com', phone: '+15551234' }),
      preset: 'minimal',
    },
  },
  {
    title: 'Geo location',
    code: 'data.geo({ lat: 26.9124, lng: 75.7873 })',
    options: { value: data.geo({ lat: 26.9124, lng: 75.7873 }), preset: 'mint' },
  },
];

export default function Examples() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <p className="eyebrow mb-2">Examples</p>
      <h1 className="mb-3 text-4xl">A gallery of the possible.</h1>
      <p className="mb-10 max-w-xl text-ink-soft">
        Every code below is one line — a preset or a small options object. All are verified
        scannable in CI.
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {GALLERY.map((g) => (
          <figure key={g.title} className="glass flex flex-col items-center gap-4 p-6">
            <div className="grid place-items-center rounded-[12px] bg-paper p-4">
              <StaticQR {...g.options} size={180} />
            </div>
            <figcaption className="text-center">
              <div className="font-medium text-ink">{g.title}</div>
              <code className="text-xs text-ink-faint">{g.note}</code>
            </figcaption>
          </figure>
        ))}
      </div>

      <h2 className="mt-16 mb-6 text-2xl">Data-builder recipes</h2>
      <div className="grid gap-6 sm:grid-cols-3">
        {RECIPES.map((r) => (
          <figure key={r.title} className="glass flex flex-col items-center gap-4 p-6">
            <div className="grid place-items-center rounded-[12px] bg-paper p-4">
              <StaticQR {...r.options} size={180} />
            </div>
            <figcaption className="w-full text-center">
              <div className="mb-1 font-medium text-ink">{r.title}</div>
              <code className="block overflow-x-auto whitespace-nowrap text-[11px] text-ink-faint">
                {r.code}
              </code>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
