// Reproducible benchmark harness — Rune vs popular React QR libraries.
// Measures SVG-generation throughput, SSR latency, and minified+gzip bundle
// size with the SAME methodology for every library. Honest, in-process, and
// re-runnable with `pnpm bench`. Results are written to
// apps/docs/lib/benchmark.json for the docs Benchmark page.

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import esbuild from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { toSVGString } from '@kroszborg/rune';
import { QRCode as RuneReact } from '@kroszborg/rune-react';
import { QRCodeSVG } from 'qrcode.react';
import ReactQRCode from 'react-qr-code';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Renderers under test (all produce SVG markup) ──────────────────────────
const RENDERERS = {
  'Rune (toSVGString)': (value) => toSVGString({ value, size: 256 }),
  'Rune (React)': (value) => renderToStaticMarkup(createElement(RuneReact, { value, size: 256 })),
  'qrcode.react': (value) => renderToStaticMarkup(createElement(QRCodeSVG, { value, size: 256 })),
  'react-qr-code': (value) =>
    renderToStaticMarkup(createElement(ReactQRCode, { value, size: 256 })),
};

const PAYLOADS = [
  'https://example.com',
  'HELLO WORLD 12345',
  '8675309',
  'https://rune.kroszborg.co/very/long/path?with=query&and=more#hash-fragment-here',
  'WIFI:T:WPA;S:Home;P:hunter2;;',
  'mailto:a@b.com?subject=Hi',
  'BEGIN:VCARD\nVERSION:3.0\nFN:Ada Lovelace\nEND:VCARD',
  'tel:+15551234567',
];

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function percentile(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// ── 1) Throughput: unique input each call, best of N short windows ──────────
// Best-of-N reports peak sustained throughput, which is far less sensitive to
// transient machine load than a single window.
function throughput(fn, windowMs = 800, runs = 5) {
  for (let i = 0; i < 200; i++) fn(`warmup-${i}`); // warm the JIT
  let best = 0;
  for (let r = 0; r < runs; r++) {
    let ops = 0;
    const start = performance.now();
    while (performance.now() - start < windowMs) {
      fn(`https://ex.com/${r}-${ops}-${Math.floor(ops * 2654435761) % 100000}`);
      ops++;
    }
    const rps = ops / ((performance.now() - start) / 1000);
    if (rps > best) best = rps;
  }
  return Math.round(best);
}

// ── 2) SSR latency: per-payload render time ─────────────────────────────────
function ssrLatency(fn) {
  for (let i = 0; i < 50; i++) fn(PAYLOADS[i % PAYLOADS.length]);
  const times = [];
  for (let round = 0; round < 200; round++) {
    for (const p of PAYLOADS) {
      const t = performance.now();
      fn(p);
      times.push(performance.now() - t);
    }
  }
  return { median: round(median(times), 4), p95: round(percentile(times, 95), 4) };
}

// ── 3) Bundle size: esbuild bundle + minify + gzip, react external ──────────
async function bundleSize(entry) {
  const out = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'esm',
    write: false,
    external: ['react', 'react-dom'],
    logLevel: 'silent',
  });
  const code = out.outputFiles[0].contents;
  return { minKB: round(code.length / 1024, 1), gzipKB: round(gzipSync(code).length / 1024, 1) };
}

async function main() {
  console.log('Running benchmarks (Node ' + process.version + ')…\n');

  const results = {};
  for (const [name, fn] of Object.entries(RENDERERS)) {
    const rps = throughput(fn);
    const ssr = ssrLatency(fn);
    results[name] = { throughput: rps, ssrMedian: ssr.median, ssrP95: ssr.p95 };
    console.log(
      `${name.padEnd(22)} ${String(rps).padStart(7)} r/s   SSR ${ssr.median}ms (p95 ${ssr.p95}ms)`,
    );
  }

  // Bundle sizes for the core packages (library code, react external).
  const sizeTargets = {
    'Rune (core)': require.resolve('@kroszborg/rune'),
    'qrcode.react': require.resolve('qrcode.react'),
    'react-qr-code': require.resolve('react-qr-code'),
  };
  console.log('\nBundle sizes (minified + gzip, react external):');
  const sizes = {};
  for (const [name, entry] of Object.entries(sizeTargets)) {
    try {
      sizes[name] = await bundleSize(entry);
      console.log(`${name.padEnd(22)} ${sizes[name].gzipKB} KB gzip (${sizes[name].minKB} KB min)`);
    } catch (e) {
      console.log(`${name.padEnd(22)} n/a (${e.message})`);
    }
  }

  const output = {
    generatedNote: 'Measured in-process with performance.now(); re-run via `pnpm bench`.',
    node: process.version,
    payloads: PAYLOADS.length,
    throughputWindowMs: 2000,
    renderers: results,
    bundle: sizes,
  };

  const outPath = resolve(__dirname, '../apps/docs/lib/benchmark.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
