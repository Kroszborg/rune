import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * End-to-end tests against the built binary (`dist/cli.js`). The package
 * `test` task builds first (see package.json), so dist is always fresh.
 */
const BIN = resolve(__dirname, '../dist/cli.js');

function run(args: string[], input?: string) {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    input,
    env: { ...process.env, NO_COLOR: '1' },
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

let dir: string;
beforeAll(() => {
  if (!existsSync(BIN)) throw new Error(`CLI not built: ${BIN}`);
  dir = mkdtempSync(join(tmpdir(), 'rune-cli-'));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('rune CLI', () => {
  it('prints help and the real package version', () => {
    expect(run(['--help']).out).toContain('Usage:');
    expect(run(['hello', '-h']).out).toContain('Usage:'); // -h anywhere
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));
    expect(run(['--version']).out.trim()).toBe(pkg.version);
  });

  it('writes SVG to stdout and files of every supported type', () => {
    const svg = run(['https://rune.kroszborg.co/cli', '--dots', 'leaf']);
    expect(svg.code).toBe(0);
    expect(svg.out.startsWith('<svg')).toBe(true);

    for (const ext of ['svg', 'png', 'jpg', 'webp', 'pdf']) {
      const file = join(dir, `out.${ext}`);
      const r = run(['https://rune.kroszborg.co/cli', '-o', file, '--preset', 'fluid']);
      expect(r.code, r.err).toBe(0);
      expect(existsSync(file)).toBe(true);
    }
  });

  it('decodes the PNG it wrote', () => {
    const file = join(dir, 'roundtrip.png');
    expect(run(['https://rune.kroszborg.co/roundtrip', '-o', file, '-s', '320']).code).toBe(0);
    const r = run(['decode', file]);
    expect(r.code).toBe(0);
    expect(r.out.trim()).toBe('https://rune.kroszborg.co/roundtrip');
  });

  it('rejects unknown flags instead of encoding them into the payload', () => {
    const r = run(['https://x.co', '--dot', 'rounded']);
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/unknown flag '--dot'/);
    expect(r.out).toBe('');
  });

  it('fails fast with a clear message on bad values', () => {
    expect(run(['X', '--size', 'abc']).err).toMatch(/--size expects a number/);
    expect(run(['X', '--dots', 'nope']).err).toMatch(/dots\.style/);
    expect(run(['X', '--ecl', 'Z']).err).toMatch(/errorCorrectionLevel/);
    expect(run(['X', '--ecl', 'Z']).code).toBe(1);
    expect(run(['X', '-o']).err).toMatch(/needs a value/);
  });

  it('reads the value from stdin and supports -- for dash-prefixed values', () => {
    const fromStdin = run(['-'], 'https://rune.kroszborg.co/stdin\n');
    expect(fromStdin.code).toBe(0);
    expect(fromStdin.out).toContain('aria-label="QR code: https://rune.kroszborg.co/stdin"');

    const dashed = run(['--', '-not-a-flag']);
    expect(dashed.code).toBe(0);
    expect(dashed.out.startsWith('<svg')).toBe(true);
  });

  it('accepts the new style and encoding flags', () => {
    const r = run([
      'HELLO',
      '--dots',
      'classy-rounded',
      '--alignment',
      'rounded',
      '--frame',
      'SCAN',
      '--frame-style',
      'square',
      '--ecl',
      'high',
      '--eci',
      '--title',
      'Menu',
    ]);
    expect(r.code, r.err).toBe(0);
    expect(r.out).toContain('<title>Menu</title>');
    expect(r.out).toContain('SCAN');
  });
});
