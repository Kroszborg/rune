import bench from '@/lib/benchmark.json';

export const metadata = { title: 'Benchmark - Rune' };

const LIBS = ['Rune', 'qrcode.react', 'qr-code-styling', 'react-qr-code'];

// Feature matrix - verifiable capability comparison (not performance).
const FEATURES: Array<[string, (boolean | string)[]]> = [
  ['SVG output', [true, true, true, true]],
  ['PNG / JPEG / WebP export', ['PNG·JPEG·WebP', 'PNG', 'PNG', false]],
  ['PDF export', [true, false, false, false]],
  ['toSVGString - sync, no DOM', [true, false, false, false]],
  ['SSR / Edge safe', [true, true, false, true]],
  ['Zero dependencies (core)', [true, true, false, false]],
  ['Dot shape styles', ['9', false, '~6', false]],
  ['Finder/corner styles', ['5 × 3', false, '3 × 2', false]],
  ['Gradient fills', [true, false, true, false]],
  ['Frames + CTA text', [true, false, false, false]],
  ['Background image', [true, false, true, false]],
  ['Logo - image', [true, true, true, false]],
  ['Logo - framework node', [true, false, false, false]],
  ['Data builders (WiFi/vCard/…)', [true, false, false, false]],
  ['Frameworks', ['4', 'React', 'any', 'React']],
  ['Error correction level', [true, true, true, true]],
  ['QR version control', [true, true, true, false]],
  ['TypeScript built-in', [true, true, true, true]],
  ['ESM + CJS dual export', [true, true, false, true]],
  ['Accessibility (aria/role)', [true, true, false, true]],
];

function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <span className="text-mint">✓</span>;
  if (v === false) return <span className="text-ink-faint">-</span>;
  return <span className="text-ink">{v}</span>;
}

function PerfSection() {
  const renderers = Object.entries(bench.renderers);
  const maxRps = Math.max(...renderers.map(([, r]) => r.throughput));
  const bundles = Object.entries(bench.bundle);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Throughput */}
      <div className="glass p-6">
        <p className="eyebrow mb-1">Throughput</p>
        <h3 className="mb-4 font-sans text-base font-semibold tracking-normal text-ink">
          SVG renders / second - unique input, higher is better
        </h3>
        <div className="flex flex-col gap-3">
          {renderers
            .sort((a, b) => b[1].throughput - a[1].throughput)
            .map(([name, r]) => {
              const isRune = name.startsWith('Rune');
              return (
                <div key={name} className="flex items-center gap-2 sm:gap-3">
                  <span className="w-24 shrink-0 text-xs text-ink-soft sm:w-40">{name}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded-full bg-paper-2">
                    <div
                      className={`h-full rounded-full ${isRune ? 'bg-mint' : 'bg-line-strong'}`}
                      style={{ width: `${(r.throughput / maxRps) * 100}%` }}
                    />
                  </div>
                  <span
                    className={`w-14 shrink-0 text-right font-mono text-xs sm:w-16 ${isRune ? 'text-mint' : 'text-ink-soft'}`}
                  >
                    {r.throughput.toLocaleString()}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* SSR latency + bundle */}
      <div className="flex flex-col gap-6">
        <div className="glass p-6">
          <p className="eyebrow mb-1">SSR latency</p>
          <h3 className="mb-4 font-sans text-base font-semibold tracking-normal text-ink">
            ms per render - lower is better
          </h3>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-ink-faint">
                <th className="pb-2 font-medium">Library</th>
                <th className="pb-2 text-right font-medium">median</th>
                <th className="pb-2 text-right font-medium">p95</th>
              </tr>
            </thead>
            <tbody>
              {renderers.map(([name, r]) => (
                <tr key={name} className="border-t border-line">
                  <td
                    className={`py-1.5 ${name.startsWith('Rune') ? 'text-mint' : 'text-ink-soft'}`}
                  >
                    {name}
                  </td>
                  <td className="py-1.5 text-right font-mono text-xs text-ink">{r.ssrMedian}</td>
                  <td className="py-1.5 text-right font-mono text-xs text-ink-soft">{r.ssrP95}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="glass p-6">
          <p className="eyebrow mb-1">Bundle size</p>
          <h3 className="mb-4 font-sans text-base font-semibold tracking-normal text-ink">
            minified + gzip, React external
          </h3>
          <table className="w-full text-left text-sm">
            <tbody>
              {bundles.map(([name, b]) => (
                <tr key={name} className="border-t border-line first:border-0">
                  <td
                    className={`py-1.5 ${name.startsWith('Rune') ? 'text-mint' : 'text-ink-soft'}`}
                  >
                    {name}
                  </td>
                  <td className="py-1.5 text-right font-mono text-xs text-ink">
                    {b.gzipKB} KB gzip
                  </td>
                  <td className="py-1.5 text-right font-mono text-xs text-ink-faint">
                    {b.minKB} KB min
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Benchmark() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <p className="eyebrow mb-2">Benchmark</p>
      <h1 className="mb-3 text-4xl">How Rune compares.</h1>
      <p className="mb-3 max-w-2xl text-ink-soft">
        Real, in-process measurements against the popular React QR libraries - no synthetic or
        placeholder numbers. Reproduce them yourself with{' '}
        <code className="text-mint">pnpm bench</code> (source in{' '}
        <code className="text-mint">/bench</code>).
      </p>
      <p className="mb-10 max-w-2xl text-sm text-ink-faint">
        <span className="text-mint">toSVGString</span> is the apples-to-apples SVG-generation path,
        and it&apos;s the fastest here. The React adapter is on par with qrcode.react while
        rendering a fully-styled SVG element. Absolute numbers depend on the machine (measured on
        Node {bench.node}); the ranking is what matters.
      </p>

      <PerfSection />

      <h2 className="mt-16 mb-4 text-2xl">Feature comparison</h2>

      <div className="overflow-x-auto rounded-[14px] border border-line">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line-strong">
              <th className="p-3 font-medium text-ink-faint">Feature</th>
              {LIBS.map((l) => (
                <th
                  key={l}
                  className={`p-3 font-medium ${l === 'Rune' ? 'text-mint' : 'text-ink-soft'}`}
                >
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map(([feature, values]) => (
              <tr key={feature} className="border-b border-line">
                <td className="p-3 text-ink-soft">{feature}</td>
                {values.map((v, i) => (
                  <td key={`${feature}-${LIBS[i]}`} className="p-3 font-mono text-[13px]">
                    <Cell v={v} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs text-ink-faint">
        Comparison compiled July 2026 from each library&apos;s public API. Corrections welcome via
        GitHub.
      </p>
    </div>
  );
}
