import { InstallCommand } from '@/components/CopyButton';
import { DocsSidebar } from '@/components/DocsSidebar';
import { StaticQR } from '@/components/StaticQR';
import type { RenderOptions } from '@kroszborg/rune';

export const metadata = { title: 'Docs - Rune' };

const V = 'https://rune.kroszborg.co';

/* ── small building blocks ─────────────────────────────────────────────── */

function Section({
  id,
  title,
  children,
}: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-16 scroll-mt-24">
      <h2 className="mb-4 border-b border-line pb-2 text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-[12px] border border-line bg-panel p-4 font-mono text-[13px] leading-relaxed text-ink">
      <code>{children}</code>
    </pre>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 leading-relaxed text-ink-soft">{children}</p>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[0.85em] text-mint">{children}</code>;
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="mb-4 overflow-x-auto rounded-[12px] border border-line bg-panel">
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line-strong text-xs text-ink-faint">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static rows
            <tr key={i} className="border-b border-line align-top last:border-0">
              {r.map((c, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static cells
                <td key={j} className="px-4 py-3 align-top text-ink-soft [&_code]:text-mint">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Swatch({ label, options }: { label: string; options: RenderOptions }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="rounded-[12px] bg-white p-3">
        <StaticQR {...options} size={104} className="block [&>svg]:h-auto [&>svg]:w-full" />
      </div>
      <figcaption className="font-mono text-[11px] text-ink-faint">{label}</figcaption>
    </figure>
  );
}

/* ── data ──────────────────────────────────────────────────────────────── */

const DOT_STYLES = [
  'square',
  'dot',
  'rounded',
  'extra-rounded',
  'classy',
  'classy-rounded',
  'diamond',
  'star',
] as const;

const RING_STYLES = ['square', 'rounded', 'extra-rounded', 'circle', 'leaf'] as const;
const CORE_STYLES = ['square', 'rounded', 'dot'] as const;
const PRESETS = ['minimal', 'dots', 'fluid', 'mint', 'midnight', 'sunset'] as const;

/* ── page ──────────────────────────────────────────────────────────────── */

export default function Docs() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-14">
      <div className="grid gap-10 lg:grid-cols-[210px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="eyebrow mb-3">Documentation</p>
            <DocsSidebar />
          </div>
        </aside>

        <div className="min-w-0 max-w-3xl">
          <p className="eyebrow mb-2">Reference</p>
          <h1 className="mb-10 text-4xl">Rune documentation.</h1>

          <Section id="getting-started" title="Getting started">
            <P>
              Rune is a framework-agnostic QR code library. Install the adapter for your framework,
              or the core for a plain SVG string that works anywhere.
            </P>
            <div className="mb-4 flex flex-col gap-2">
              <InstallCommand command="pnpm add @kroszborg/rune-react" />
              <InstallCommand command="pnpm add @kroszborg/rune-vue" />
              <InstallCommand command="pnpm add @kroszborg/rune-wc" />
              <InstallCommand command="pnpm add @kroszborg/rune   # core / SSR string API" />
            </div>
            <P>React:</P>
            <Code>{`import { QRCode } from '@kroszborg/rune-react';

export default function App() {
  return (
    <QRCode
      value="https://example.com"
      dots={{ style: 'rounded' }}
      corners={{ square: { style: 'extra-rounded' } }}
    />
  );
}`}</Code>
            <P>Anywhere (server, edge, Node, workers):</P>
            <Code>{`import { toSVGString } from '@kroszborg/rune';

const svg = toSVGString({ value: 'https://example.com', dots: { style: 'rounded' } });`}</Code>
            <P>
              Every package (below) accepts the exact same <Mono>RuneOptions</Mono> object.
            </P>
            <Table
              head={['Package', 'What it is']}
              rows={[
                [
                  <code key="a">@kroszborg/rune</code>,
                  'Core: encoder, renderer, exports, data builders, presets. Zero runtime deps.',
                ],
                [
                  <code key="b">@kroszborg/rune-react</code>,
                  'React <QRCode> (web). Also the base for React Native.',
                ],
                [<code key="c">@kroszborg/rune-vue</code>, 'Vue 3 <QRCode>.'],
                [
                  <code key="d">@kroszborg/rune-wc</code>,
                  'Vanilla renderRune() + a <rune-qr> Web Component.',
                ],
                [
                  <code key="e">@kroszborg/rune-decode</code>,
                  'Decoder: read a QR back from a matrix or image.',
                ],
                [
                  <code key="f">@kroszborg/rune-cli</code>,
                  'The rune CLI: generate or decode from the terminal.',
                ],
              ]}
            />
          </Section>

          <Section id="options" title="RuneOptions">
            <P>The single options object accepted by every renderer and adapter.</P>
            <Table
              head={['Prop', 'Type', 'Default', 'Description']}
              rows={[
                [
                  <code key="1">value</code>,
                  <code key="2">string</code>,
                  '-',
                  'Data to encode (required).',
                ],
                [
                  <code key="3">size</code>,
                  <code key="4">number</code>,
                  '256',
                  'Output width/height in px.',
                ],
                [
                  <code key="5">margin</code>,
                  <code key="6">number</code>,
                  '4',
                  'Quiet zone in modules.',
                ],
                [
                  <code key="7">dots</code>,
                  <code key="8">{'{ style, color, gradient }'}</code>,
                  '-',
                  'Data-module style and fill.',
                ],
                [
                  <code key="9">corners</code>,
                  <code key="10">CornerOptions</code>,
                  '-',
                  'Finder ring + core styles and fills.',
                ],
                [
                  <code key="11">background</code>,
                  <code key="12">string | BackgroundOptions</code>,
                  "'#ffffff'",
                  "Color, gradient, or image. 'transparent' allowed.",
                ],
                [
                  <code key="13">logo</code>,
                  <code key="14">LogoOptions</code>,
                  '-',
                  'Center logo (auto-raises ECL).',
                ],
                [
                  <code key="15">frame</code>,
                  <code key="16">FrameOptions</code>,
                  '-',
                  'Outer frame + CTA text.',
                ],
                [
                  <code key="17">qr</code>,
                  <code key="18">{'{ errorCorrectionLevel, version, mask }'}</code>,
                  '-',
                  'Encoding controls.',
                ],
                [
                  <code key="19">preset</code>,
                  <code key="20">PresetName</code>,
                  '-',
                  'Named base style; explicit options win.',
                ],
                [
                  <code key="21">ariaLabel</code>,
                  <code key="22">string</code>,
                  "'QR code: {value}'",
                  'Accessible label on the <svg>.',
                ],
              ]}
            />
          </Section>

          <Section id="dots" title="Dot styles">
            <P>
              Set with <Mono>dots.style</Mono>. Eight styles; <Mono>rounded</Mono> and{' '}
              <Mono>extra-rounded</Mono> connect adjacent modules for a fluid look.
            </P>
            <div className="mb-4 grid grid-cols-2 gap-4 rounded-[16px] border border-line bg-panel p-6 sm:grid-cols-4">
              {DOT_STYLES.map((style) => (
                <Swatch
                  key={style}
                  label={style}
                  options={{ value: V, dots: { style, color: '#0b0b0f' }, id: `dot-${style}` }}
                />
              ))}
            </div>
            <Code>{`<QRCode value="..." dots={{ style: 'classy-rounded' }} />`}</Code>
          </Section>

          <Section id="finders" title="Finder styles">
            <P>
              The three corner markers. <Mono>corners.square</Mono> styles the 7×7 ring;{' '}
              <Mono>corners.dot</Mono> styles the inner 3×3 block. Each takes its own{' '}
              <Mono>color</Mono> or <Mono>gradient</Mono>.
            </P>
            <p className="mb-2 text-sm font-medium text-ink">Ring (corners.square.style)</p>
            <div className="mb-6 grid grid-cols-2 gap-4 rounded-[16px] border border-line bg-panel p-6 sm:grid-cols-5">
              {RING_STYLES.map((style) => (
                <Swatch
                  key={style}
                  label={style}
                  options={{ value: V, corners: { square: { style } }, id: `ring-${style}` }}
                />
              ))}
            </div>
            <p className="mb-2 text-sm font-medium text-ink">Core (corners.dot.style)</p>
            <div className="mb-4 grid grid-cols-2 gap-4 rounded-[16px] border border-line bg-panel p-6 sm:grid-cols-3">
              {CORE_STYLES.map((style) => (
                <Swatch
                  key={style}
                  label={style}
                  options={{
                    value: V,
                    corners: { dot: { style }, square: { style: 'square' } },
                    id: `core-${style}`,
                  }}
                />
              ))}
            </div>
            <Table
              head={['Field', 'Type']}
              rows={[
                [
                  <code key="1">corners.square.style</code>,
                  <code key="2">'square' | 'rounded' | 'extra-rounded' | 'circle' | 'leaf'</code>,
                ],
                [<code key="3">corners.square.color</code>, <code key="4">string</code>],
                [<code key="5">corners.square.gradient</code>, <code key="6">Gradient</code>],
                [
                  <code key="7">corners.dot.style</code>,
                  <code key="8">'square' | 'rounded' | 'dot'</code>,
                ],
                [
                  <code key="9">corners.dot.color / gradient</code>,
                  <code key="10">string | Gradient</code>,
                ],
              ]}
            />
          </Section>

          <Section id="colors" title="Colors & gradients">
            <P>
              Every element (dots, each finder part, background) takes a solid <Mono>color</Mono> or
              a <Mono>gradient</Mono>. A gradient is linear or radial with any number of stops.
            </P>
            <div className="mb-4 grid grid-cols-2 gap-4 rounded-[16px] border border-line bg-panel p-6 sm:grid-cols-3">
              <Swatch
                label="solid"
                options={{ value: V, dots: { color: '#0f7a5c' }, id: 'c-solid' }}
              />
              <Swatch
                label="linear"
                options={{
                  value: V,
                  dots: {
                    gradient: {
                      type: 'linear',
                      rotation: 45,
                      stops: [
                        { offset: 0, color: '#0f7a5c' },
                        { offset: 1, color: '#0b6b4f' },
                      ],
                    },
                  },
                  id: 'c-linear',
                }}
              />
              <Swatch
                label="radial"
                options={{
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
                  id: 'c-radial',
                }}
              />
            </div>
            <Table
              head={['Gradient field', 'Type', 'Notes']}
              rows={[
                [<code key="1">type</code>, <code key="2">'linear' | 'radial'</code>, ''],
                [
                  <code key="3">rotation</code>,
                  <code key="4">number</code>,
                  'Degrees, linear only.',
                ],
                [
                  <code key="5">stops</code>,
                  <code key="6">{'{ offset, color }[]'}</code>,
                  'offset is 0-1.',
                ],
              ]}
            />
            <Code>{`dots={{ gradient: {
  type: 'linear', rotation: 45,
  stops: [{ offset: 0, color: '#0f7a5c' }, { offset: 1, color: '#0b6b4f' }],
} }}`}</Code>
          </Section>

          <Section id="background" title="Background">
            <P>
              Pass a color string, or a <Mono>BackgroundOptions</Mono> object for a gradient or
              image. <Mono>'transparent'</Mono> is accepted (useful for overlaying).
            </P>
            <Table
              head={['Field', 'Type', 'Description']}
              rows={[
                [
                  <code key="1">color</code>,
                  <code key="2">string</code>,
                  "Solid fill, or 'transparent'.",
                ],
                [
                  <code key="3">gradient</code>,
                  <code key="4">Gradient</code>,
                  'Gradient fill behind the modules.',
                ],
                [
                  <code key="5">image</code>,
                  <code key="6">string</code>,
                  'Image URL rendered behind the modules.',
                ],
              ]}
            />
            <Code>{`background="transparent"
// or
background={{ gradient: { type: 'radial', stops: [...] } }}`}</Code>
          </Section>

          <Section id="logo" title="Logo">
            <P>
              A center logo. Rune automatically raises the error-correction level to <Mono>H</Mono>{' '}
              when a logo is present (unless you set one) and clamps the logo size to what stays
              scannable at that level, so you cannot accidentally produce an unreadable code.
            </P>
            <Table
              head={['Field', 'Type', 'Default', 'Description']}
              rows={[
                [
                  <code key="1">src</code>,
                  <code key="2">string</code>,
                  '-',
                  'https, blob:, data:image/…, or a path.',
                ],
                [
                  <code key="3">size</code>,
                  <code key="4">number</code>,
                  '0.25',
                  'Fraction of width (clamped per ECL).',
                ],
                [
                  <code key="5">margin</code>,
                  <code key="6">number</code>,
                  '1',
                  'Clear space around the logo, in modules.',
                ],
                [
                  <code key="7">hideDots</code>,
                  <code key="8">boolean</code>,
                  'true',
                  'Clear the modules behind the logo.',
                ],
                [
                  <code key="9">shape</code>,
                  <code key="10">'square' | 'rounded' | 'circle'</code>,
                  "'square'",
                  'Backing plate shape.',
                ],
                [
                  <code key="11">background</code>,
                  <code key="12">string</code>,
                  'bg color',
                  'Backing plate color.',
                ],
              ]}
            />
            <Code>{`<QRCode value="..." logo={{ src: '/logo.png', size: 0.28, shape: 'circle' }} />`}</Code>
            <P>
              In React you can pass a live React node instead of an image with{' '}
              <Mono>logoElement</Mono> (see Frameworks).
            </P>
          </Section>

          <Section id="frame" title="Frame & CTA">
            <P>An outer frame with an optional call-to-action label.</P>
            <div className="mb-4 rounded-[16px] border border-line bg-panel p-6">
              <div className="mx-auto w-fit rounded-[12px] bg-white p-3">
                <StaticQR
                  value={V}
                  size={160}
                  dots={{ style: 'rounded', color: '#0b0b0f' }}
                  frame={{ style: 'rounded', text: 'SCAN ME' }}
                  id="frame-demo"
                  className="block"
                />
              </div>
            </div>
            <Table
              head={['Field', 'Type', 'Description']}
              rows={[
                [
                  <code key="1">style</code>,
                  <code key="2">'none' | 'square' | 'rounded'</code>,
                  "Border shape. 'none' draws text only.",
                ],
                [
                  <code key="3">text</code>,
                  <code key="4">string</code>,
                  'CTA label, e.g. "SCAN ME".',
                ],
                [
                  <code key="5">position</code>,
                  <code key="6">'bottom' | 'top'</code>,
                  'Where the text band sits.',
                ],
                [
                  <code key="7">color / textColor</code>,
                  <code key="8">string</code>,
                  'Frame and text colors.',
                ],
                [
                  <code key="9">font</code>,
                  <code key="10">string</code>,
                  'CSS font-family for the label.',
                ],
              ]}
            />
          </Section>

          <Section id="ecl" title="Error correction">
            <P>
              Higher levels recover from more damage but hold less data. Set with{' '}
              <Mono>qr.errorCorrectionLevel</Mono>. You can also pin the <Mono>version</Mono> (1-40)
              and <Mono>mask</Mono> (0-7); both are chosen automatically by default.
            </P>
            <Table
              head={['Level', 'Recovery', 'Use when']}
              rows={[
                [<code key="1">L</code>, '~7%', 'Clean environments, minimal data.'],
                [<code key="2">M</code>, '~15%', 'General purpose (default).'],
                [<code key="3">Q</code>, '~25%', 'Print, harsher conditions.'],
                [<code key="4">H</code>, '~30%', 'Codes with a center logo.'],
              ]}
            />
          </Section>

          <Section id="presets" title="Presets">
            <P>
              Named starting styles. Pass <Mono>preset</Mono>; any explicit option you also set wins
              over the preset.
            </P>
            <div className="mb-4 grid grid-cols-2 gap-4 rounded-[16px] border border-line bg-panel p-6 sm:grid-cols-3">
              {PRESETS.map((preset) => (
                <Swatch
                  key={preset}
                  label={preset}
                  options={{ value: V, preset, id: `preset-${preset}` }}
                />
              ))}
            </div>
            <Code>{`<QRCode value="..." preset="mint" />`}</Code>
          </Section>

          <Section id="data" title="Data builders">
            <P>
              Turn structured input into correctly-escaped QR content. Import with{' '}
              <Mono>{"import { data } from '@kroszborg/rune'"}</Mono> and pass the result as{' '}
              <Mono>value</Mono>.
            </P>
            <Code>{`data.url('example.com')
data.wifi({ ssid: 'Home', password: 'hunter2', encryption: 'WPA' })
data.email({ to: 'a@b.com', subject: 'Hi', body: '...' })
data.sms({ to: '+15551234', body: 'hi' })
data.tel('+15551234')
data.geo({ lat: 26.9124, lng: 75.7873 })
data.vcard({ fullName: 'Ada Lovelace', email: 'ada@x.com', phone: '+1555' })
data.mecard({ fullName: 'Ada Lovelace', phone: '+1555' })
data.event({ title: 'Launch', start: '2026-07-14T09:00Z', end: '2026-07-14T10:00Z' })
data.crypto({ coin: 'bitcoin', address: '1abc', amount: 0.5 })`}</Code>
          </Section>

          <Section id="export" title="Export">
            <P>
              The core exports SVG anywhere; raster and PDF live in{' '}
              <Mono>@kroszborg/rune/node</Mono> so the browser bundle stays free of native binaries.
            </P>
            <Table
              head={['Function', 'Returns', 'Where']}
              rows={[
                [
                  <code key="1">toSVGString(o)</code>,
                  <code key="2">string</code>,
                  'anywhere (sync)',
                ],
                [
                  <code key="3">renderToParts(o)</code>,
                  <code key="4">SvgParts</code>,
                  'anywhere (adapters)',
                ],
                [
                  <code key="5">toDataURL(o, r?)</code>,
                  <code key="6">Promise&lt;string&gt;</code>,
                  'browser (Canvas)',
                ],
                [
                  <code key="7">toBuffer(o, r?)</code>,
                  <code key="8">Promise&lt;Uint8Array&gt;</code>,
                  'node (/node)',
                ],
                [
                  <code key="9">toPDF(o)</code>,
                  <code key="10">Promise&lt;Uint8Array&gt;</code>,
                  'node (/node)',
                ],
              ]}
            />
            <P>
              <Mono>RasterOptions</Mono>: <Mono>format</Mono> ('png' | 'jpeg' | 'webp'),{' '}
              <Mono>quality</Mono> (0-1), <Mono>background</Mono>.
            </P>
            <Code>{`import { toBuffer, toPDF } from '@kroszborg/rune/node';

const png = await toBuffer({ value: '...', size: 512 }, { format: 'png' });
const pdf = await toPDF({ value: '...', size: 512 });`}</Code>
          </Section>

          <Section id="decode" title="Decoding">
            <P>
              <Mono>@kroszborg/rune-decode</Mono> reads a QR back into its data, with full
              Reed-Solomon error correction.
            </P>
            <Code>{`import { decode, decodeMatrix } from '@kroszborg/rune-decode';

// From raw RGBA pixels (e.g. a canvas ImageData)
const result = decode({ data, width, height });
if (result) console.log(result.text, result.version, result.ecl);

// From a boolean module matrix
const { text } = decodeMatrix(modules); // modules[y][x], true = dark`}</Code>
            <Table
              head={['Function', 'Input', 'Returns']}
              rows={[
                [
                  <code key="1">decode(img)</code>,
                  <code key="2">{'{ data, width, height }'}</code>,
                  <code key="3">MatrixDecodeResult | null</code>,
                ],
                [
                  <code key="4">decodeMatrix(m)</code>,
                  <code key="5">boolean[][]</code>,
                  <code key="6">MatrixDecodeResult</code>,
                ],
              ]}
            />
            <P>
              <Mono>MatrixDecodeResult</Mono> = <Mono>{'{ text, version, ecl, mask }'}</Mono>.
            </P>
          </Section>

          <Section id="cli" title="CLI">
            <P>
              <Mono>@kroszborg/rune-cli</Mono> generates and decodes from the terminal.
            </P>
            <Code>{`# generate
rune "https://example.com" -o qr.png --dots rounded --preset mint
rune "https://example.com" --gradient "#0f7a5c,#12946e,45" -o qr.pdf
rune "SCAN ME" --frame "SCAN ME" -o cta.svg     # no -o prints SVG to stdout

# decode
rune decode qr.png`}</Code>
            <Table
              head={['Flag', 'Description']}
              rows={[
                [
                  <code key="1">-o, --out</code>,
                  'Output file (.svg .png .jpeg .webp .pdf). Stdout SVG if omitted.',
                ],
                [
                  <code key="2">-s, --size / -m, --margin</code>,
                  'Size in px / quiet-zone modules.',
                ],
                [<code key="3">--ecl</code>, 'L | M | Q | H.'],
                [<code key="4">--dots / --dot-color</code>, 'Dot style / color.'],
                [<code key="5">--gradient "a,b,r"</code>, 'Linear gradient from,to,rotation.'],
                [<code key="6">--square / --core</code>, 'Finder ring / core style.'],
                [
                  <code key="7">--bg / --frame / --logo / --preset</code>,
                  'Background, CTA frame, logo, preset.',
                ],
              ]}
            />
          </Section>

          <Section id="frameworks" title="Frameworks">
            <p className="mb-2 text-sm font-medium text-ink">React</p>
            <P>
              Accepts every RuneOptions prop, plus <Mono>style</Mono>, <Mono>className</Mono>, and{' '}
              <Mono>logoElement</Mono> (a React node overlaid in the center).
            </P>
            <Code>{`import { QRCode } from '@kroszborg/rune-react';
<QRCode value="..." dots={{ style: 'rounded' }} logoElement={<MyLogo />} qr={{ errorCorrectionLevel: 'H' }} />`}</Code>

            <p className="mb-2 mt-6 text-sm font-medium text-ink">Vue 3</p>
            <Code>{`<script setup>
import { QRCode } from '@kroszborg/rune-vue';
</script>
<template>
  <QRCode value="..." :dots="{ style: 'rounded' }" />
</template>`}</Code>

            <p className="mb-2 mt-6 text-sm font-medium text-ink">Web Component (vanilla)</p>
            <P>
              Attributes for simple cases; set the <Mono>.options</Mono> property for the full
              object.
            </P>
            <Code>{`import { register } from '@kroszborg/rune-wc';
register();
// <rune-qr value="..." dot-style="rounded" preset="mint"></rune-qr>
// el.options = { value: '...', dots: { gradient: {...} }, frame: { text: 'SCAN ME' } };`}</Code>

            <p className="mb-2 mt-6 text-sm font-medium text-ink">React Native</p>
            <Code>{`import { SvgXml } from 'react-native-svg';
import { toSVGString } from '@kroszborg/rune';
const svg = toSVGString({ value: '...', dots: { style: 'rounded' } });
export default () => <SvgXml xml={svg} width={256} height={256} />;`}</Code>

            <p className="mb-2 mt-6 text-sm font-medium text-ink">
              Svelte, Solid, Astro, Angular, Lit
            </p>
            <P>
              No dedicated package needed - inject the string from <Mono>toSVGString</Mono>, or use
              the <Mono>&lt;rune-qr&gt;</Mono> Web Component.
            </P>
            <Code>{`const svg = toSVGString({ value: '...', dots: { style: 'rounded' } });

{@html svg}                 // Svelte
<div innerHTML={svg} />      // Solid
<Fragment set:html={svg} /> // Astro
<div [innerHTML]="svg">     // Angular (sanitizer-bypassed)
<rune-qr value="..."></rune-qr> // Lit / Alpine / plain HTML`}</Code>
          </Section>
        </div>
      </div>
    </div>
  );
}
