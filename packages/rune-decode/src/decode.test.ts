import { encode, toSVGString } from '@kroszborg/rune';
import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { decode } from './image.js';
import { decodeMatrix } from './matrix-decode.js';
import { rsDecode } from './reedsolomon.js';

describe('matrix round-trip (encode → decodeMatrix)', () => {
  const samples = [
    '01234567',
    'HELLO WORLD',
    'https://rune.kroszborg.co',
    'Rune QR — ünïcödé ✓',
    'a'.repeat(300),
    '9'.repeat(200),
    'AC-42 $%*+-./: TEST',
    'mailto:a@b.com?subject=Hi',
  ];
  const ecls = ['L', 'M', 'Q', 'H'] as const;

  for (const text of samples) {
    for (const ecl of ecls) {
      it(`decodes ${JSON.stringify(text.slice(0, 20))} @ ${ecl}`, () => {
        const m = encode(text, { errorCorrectionLevel: ecl, boostEcl: false });
        const result = decodeMatrix(m.modules);
        expect(result.text).toBe(text);
        expect(result.ecl).toBe(ecl);
        expect(result.mask).toBe(m.mask);
      });
    }
  }
});

describe('Reed–Solomon error correction', () => {
  it('recovers data modules corrupted within correction capacity', () => {
    // Version-1 M: one block, 10 EC codewords → corrects up to 5 symbol errors.
    // Flip 3 well-separated data modules (distinct codewords, within capacity).
    const m = encode('HELLO WORLD', { errorCorrectionLevel: 'M', version: 1, boostEcl: false });
    const modules = m.modules.map((r) => [...r]);
    for (const [x, y] of [
      [10, 10],
      [13, 16],
      [16, 13],
    ] as const) {
      modules[y]![x] = !modules[y]![x];
    }
    expect(decodeMatrix(modules).text).toBe('HELLO WORLD');
  });

  it('rsDecode leaves a clean codeword untouched (zero syndromes)', () => {
    // rsDecode with nsym=0 has no EC and must return the input verbatim.
    const data = [1, 2, 3, 4, 5];
    expect(rsDecode([...data], 0)).toEqual(data);
  });
});

describe('image round-trip (render → rasterize → decode)', () => {
  function scanRune(options: Parameters<typeof toSVGString>[0], px = 480): string | null {
    const svg = toSVGString({ ...options, size: px });
    const r = new Resvg(svg, { fitTo: { mode: 'width', value: px } });
    const rendered = r.render();
    return (
      decode({ data: rendered.pixels, width: rendered.width, height: rendered.height })?.text ??
      null
    );
  }

  const value = 'https://rune.kroszborg.co/decode';
  const variants: Array<[string, Parameters<typeof toSVGString>[0]]> = [
    ['square', { value, dots: { style: 'square' } }],
    ['rounded', { value, dots: { style: 'rounded' } }],
    ['dot', { value, dots: { style: 'dot' } }],
    ['gradient', { value, preset: 'fluid' }],
    [
      'extra-rounded finders',
      { value, corners: { square: { style: 'extra-rounded' }, dot: { style: 'dot' } } },
    ],
  ];

  for (const [name, options] of variants) {
    it(`decodes rendered image: ${name}`, () => {
      expect(scanRune(options)).toBe(value);
    });
  }

  it('decodes numeric and alphanumeric rendered images', () => {
    expect(scanRune({ value: '8675309', dots: { style: 'rounded' } })).toBe('8675309');
    expect(scanRune({ value: 'HELLO WORLD 42', dots: { style: 'dot' } })).toBe('HELLO WORLD 42');
  });

  // Robustness sweep across sizes: spurious finder candidates from data/alignment
  // patterns must not derail detection (regression guard for the triple selector).
  for (const px of [300, 400, 512, 640]) {
    it(`decodes at ${px}px across styles`, () => {
      expect(
        scanRune({ value: `https://rune.kroszborg.co/s${px}`, dots: { style: 'square' } }, px),
      ).toBe(`https://rune.kroszborg.co/s${px}`);
      expect(scanRune({ value: `https://rune.kroszborg.co/f${px}`, preset: 'fluid' }, px)).toBe(
        `https://rune.kroszborg.co/f${px}`,
      );
    });
  }
});

describe('multi-segment and ECI payloads round-trip', () => {
  const mixed = [
    'https://x.co/r/1234567890123',
    'Tel: +91 98765 43210 ext 42',
    'WIFI:T:WPA;S:MyNet;P:12345678901234567890;;',
    'ABC123abc456DEF789012345678',
  ];
  for (const text of mixed) {
    it(`decodes ${JSON.stringify(text.slice(0, 24))} split across modes`, () => {
      expect(decodeMatrix(encode(text).modules).text).toBe(text);
    });
  }

  it('decodes UTF-8 text carrying an ECI header', () => {
    const text = 'Rune ✓ ünïcödé — 日本語';
    expect(decodeMatrix(encode(text, { eci: true }).modules).text).toBe(text);
  });
});

describe('decoder limits and input validation (audit regressions)', () => {
  it('decodes Kanji-mode symbols produced by another encoder', async () => {
    const QRCode = (await import('qrcode')).default;
    // @ts-expect-error: helper has no type declarations
    const toSJIS = (await import('qrcode/helper/to-sjis')).default as (c: string) => number;
    const ref = QRCode.create([{ data: '日本語', mode: 'kanji' }], {
      errorCorrectionLevel: 'm',
      toSJISFunc: toSJIS,
    });
    const size = ref.modules.size;
    const grid: boolean[][] = [];
    for (let y = 0; y < size; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < size; x++) row.push(Boolean(ref.modules.data[y * size + x]));
      grid.push(row);
    }
    expect(decodeMatrix(grid).text).toBe('日本語');
  });

  it('decodes a transparent-background render (alpha composited over white)', () => {
    const svg = toSVGString({
      value: 'https://rune.kroszborg.co/alpha',
      background: 'transparent',
      size: 320,
    });
    const r = new Resvg(svg, { fitTo: { mode: 'width', value: 320 } }).render();
    const result = decode({
      data: new Uint8ClampedArray(r.pixels),
      width: r.width,
      height: r.height,
    });
    expect(result?.text).toBe('https://rune.kroszborg.co/alpha');
  });

  it('rejects ragged matrices and malformed image input with clear errors', () => {
    expect(() => decodeMatrix(new Array(21) as boolean[][])).toThrow(/row 0/);
    expect(() => decode({ data: new Uint8ClampedArray(10), width: 100, height: 100 })).toThrow(
      /bytes/,
    );
    expect(() => decode({ data: new Uint8ClampedArray(0), width: 0, height: 0 })).toThrow(
      /dimensions/,
    );
  });
});
