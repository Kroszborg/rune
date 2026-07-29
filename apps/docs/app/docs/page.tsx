import { InstallCommand } from '@/components/CopyButton';

export const metadata = { title: 'API Reference — Rune' };

function Row({ prop, type, def, desc }: { prop: string; type: string; def: string; desc: string }) {
  return (
    <tr className="border-b border-line align-top last:border-0">
      <td className="whitespace-nowrap py-3 pl-4 pr-8 align-top font-mono text-[13px] text-mint">
        {prop}
      </td>
      <td className="whitespace-nowrap py-3 pr-8 align-top font-mono text-[12px] text-ink-soft">
        {type}
      </td>
      <td className="whitespace-nowrap py-3 pr-8 align-top font-mono text-[12px] text-ink-faint">
        {def}
      </td>
      <td className="py-3 pr-4 align-top text-sm leading-relaxed text-ink-soft">{desc}</td>
    </tr>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[12px] border border-line bg-panel">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line-strong text-xs text-ink-faint">
            <th className="py-3 pl-4 pr-8 font-medium">Prop</th>
            <th className="py-3 pr-8 font-medium">Type</th>
            <th className="py-3 pr-8 font-medium">Default</th>
            <th className="py-3 pr-4 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function Docs() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <p className="eyebrow mb-2">API Reference</p>
      <h1 className="mb-8 text-4xl">Everything Rune exposes.</h1>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl">Install</h2>
        <div className="flex flex-col gap-2">
          <InstallCommand command="pnpm add @kroszborg/rune-react" />
          <InstallCommand command="pnpm add @kroszborg/rune-vue" />
          <InstallCommand command="pnpm add @kroszborg/rune-wc" />
          <InstallCommand command="pnpm add @kroszborg/rune   # core / SSR string API" />
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl">Packages</h2>
        <p className="mb-4 text-ink-soft">
          Install only what you need — they all share one options API.
        </p>
        <div className="overflow-x-auto rounded-[12px] border border-line bg-panel">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <tbody>
              {[
                [
                  '@kroszborg/rune',
                  'Core engine: encoder + SVG renderer + export helpers + data builders + presets. Framework-agnostic, zero runtime deps. Use its toSVGString for SSR/any environment.',
                ],
                [
                  '@kroszborg/rune-react',
                  'React <QRCode> component (web). Also the path for React Native — see below.',
                ],
                ['@kroszborg/rune-vue', 'Vue 3 <QRCode> component.'],
                [
                  '@kroszborg/rune-wc',
                  'Vanilla renderRune() + a <rune-qr> Web Component — no framework.',
                ],
                [
                  '@kroszborg/rune-decode',
                  'From-scratch QR decoder: read a QR back from a module matrix or image, with Reed–Solomon correction.',
                ],
                [
                  '@kroszborg/rune-cli',
                  'The `rune` CLI: generate SVG/PNG/PDF or decode an image from the terminal.',
                ],
              ].map(([name, desc]) => (
                <tr key={name} className="border-b border-line align-top last:border-0">
                  <td className="whitespace-nowrap py-3 pl-4 pr-8 align-top font-mono text-[13px] text-mint">
                    {name}
                  </td>
                  <td className="py-3 pr-4 align-top text-sm leading-relaxed text-ink-soft">
                    {desc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl">React Native</h2>
        <p className="mb-4 text-ink-soft">
          The web <code className="text-mint">rune-react</code> component renders a DOM{' '}
          <code>&lt;svg&gt;</code>, which React Native doesn&apos;t have. In RN, use the core{' '}
          <code className="text-mint">toSVGString</code> with{' '}
          <a
            className="link-ul text-ink"
            href="https://github.com/software-mansion/react-native-svg"
          >
            react-native-svg
          </a>
          :
        </p>
        <pre className="overflow-x-auto rounded-[12px] border border-line bg-panel p-4 font-mono text-[13px] leading-relaxed text-ink">
          <code>{`import { SvgXml } from 'react-native-svg';
import { toSVGString } from '@kroszborg/rune';

const svg = toSVGString({ value: 'https://example.com', dots: { style: 'rounded' } });
export default () => <SvgXml xml={svg} width={256} height={256} />;`}</code>
        </pre>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl">RuneOptions</h2>
        <p className="mb-4 text-ink-soft">
          The single options object accepted by every renderer and adapter.
        </p>
        <Table>
          <Row prop="value" type="string" def="—" desc="Data to encode (required)." />
          <Row prop="size" type="number" def="256" desc="Output width/height in px." />
          <Row prop="margin" type="number" def="4" desc="Quiet zone in modules." />
          <Row
            prop="dots"
            type="{ style, color, gradient }"
            def="—"
            desc="Data-module style and fill."
          />
          <Row
            prop="corners"
            type="CornerOptions"
            def="—"
            desc="Finder ring + core styles/fills."
          />
          <Row
            prop="background"
            type="string | BackgroundOptions"
            def="'#ffffff'"
            desc="Color, gradient, or image. 'transparent' accepted."
          />
          <Row prop="logo" type="LogoOptions" def="—" desc="Center logo; auto-clamped per ECL." />
          <Row prop="frame" type="FrameOptions" def="—" desc="Outer frame + CTA text." />
          <Row
            prop="qr"
            type="{ errorCorrectionLevel, version, mask }"
            def="—"
            desc="Encoding controls."
          />
          <Row
            prop="preset"
            type="PresetName"
            def="—"
            desc="Named base style; explicit options win."
          />
          <Row prop="ariaLabel" type="string" def="'QR code: {value}'" desc="Accessible label." />
        </Table>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl">Styles</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="glass p-5">
            <div className="mb-1 font-medium text-ink">DotStyle</div>
            <code className="text-sm text-ink-soft">
              square · dot · rounded · extra-rounded · classy · classy-rounded · diamond · star
            </code>
          </div>
          <div className="glass p-5">
            <div className="mb-1 font-medium text-ink">Finder ring</div>
            <code className="text-sm text-ink-soft">
              square · rounded · extra-rounded · circle · leaf
            </code>
          </div>
          <div className="glass p-5">
            <div className="mb-1 font-medium text-ink">Finder core</div>
            <code className="text-sm text-ink-soft">square · rounded · dot</code>
          </div>
          <div className="glass p-5">
            <div className="mb-1 font-medium text-ink">Error correction</div>
            <code className="text-sm text-ink-soft">L (~7%) · M (~15%) · Q (~25%) · H (~30%)</code>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl">Export helpers</h2>
        <Table>
          <Row
            prop="toSVGString(o)"
            type="string"
            def="sync"
            desc="Standalone SVG markup. DOM-free, SSR/edge-safe."
          />
          <Row
            prop="renderToParts(o)"
            type="SvgParts"
            def="sync"
            desc="{ attributes, body, width, height } for framework adapters."
          />
          <Row
            prop="toDataURL(o, r)"
            type="Promise<string>"
            def="browser"
            desc="PNG/JPEG/WebP data URL via Canvas."
          />
          <Row
            prop="toBuffer(o, r)"
            type="Promise<Uint8Array>"
            def="node"
            desc="PNG/JPEG/WebP bytes via optional resvg/sharp."
          />
          <Row
            prop="toPDF(o)"
            type="Promise<Uint8Array>"
            def="node"
            desc="Single-page PDF via optional pdf-lib."
          />
        </Table>
      </section>

      <section>
        <h2 className="mb-4 text-2xl">Data builders</h2>
        <p className="mb-4 text-ink-soft">
          Imported as <code className="text-mint">{`import { data } from '@kroszborg/rune'`}</code>.
          Each returns a correctly-escaped payload string to pass as <code>value</code>.
        </p>
        <div className="glass p-5 font-mono text-sm text-ink-soft">
          data.wifi · data.url · data.email · data.sms · data.tel · data.geo · data.vcard ·
          data.mecard · data.event · data.crypto
        </div>
      </section>
    </div>
  );
}
