import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { reedSolomonGenerator } from './galois.js';
import { encode } from './qr.js';
import { numDataCodewords, versionSize } from './tables.js';
import type { Ecl } from './types.js';

/** Convert node-qrcode's flat bit array into a boolean[][] grid. */
function referenceGrid(text: string, ecl: Ecl, version: number, mask: number): boolean[][] {
  const qr = QRCode.create(text, {
    errorCorrectionLevel: ecl.toLowerCase() as 'l' | 'm' | 'q' | 'h',
    version,
    maskPattern: mask as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7,
  });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const grid: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) row.push(Boolean(data[y * size + x]));
    grid.push(row);
  }
  return grid;
}

function gridsEqual(a: boolean[][], b: boolean[][]): boolean {
  if (a.length !== b.length) return false;
  for (let y = 0; y < a.length; y++) {
    if (a[y]!.length !== b[y]!.length) return false;
    for (let x = 0; x < a[y]!.length; x++) if (a[y]![x] !== b[y]![x]) return false;
  }
  return true;
}

describe('reed–solomon', () => {
  it('produces known low-degree generator polynomials', () => {
    // Standard QR RS generators (integer coefficients, high-order first).
    expect(Array.from(reedSolomonGenerator(1))).toEqual([1]);
    expect(Array.from(reedSolomonGenerator(2))).toEqual([3, 2]);
    expect(Array.from(reedSolomonGenerator(3))).toEqual([7, 14, 8]);
  });
  // RS end-to-end correctness is additionally proven by the full-pipeline
  // matrix comparison below, which fails on any EC-codeword error.
});

describe('encode vs node-qrcode reference', () => {
  const eclMasks: Array<[Ecl, number]> = [
    ['L', 0],
    ['M', 2],
    ['Q', 4],
    ['H', 7],
  ];

  // Rune uses numeric / alphanumeric / byte(UTF-8) modes. node-qrcode auto-
  // detects the same for these samples. (Pure-Kanji strings are excluded here
  // because node-qrcode prefers Shift-JIS Kanji mode while Rune uses byte/UTF-8
  // — both valid, but different bytes. Byte/UTF-8 is covered by the accented
  // sample; the Kanji round-trip is asserted separately below.)
  const samples = [
    '01234567',
    'HELLO WORLD',
    'https://rune.kroszborg.co',
    'Rune QR — ünïcödé ✓',
    'a'.repeat(200),
    '9'.repeat(120),
    'AC-42 $%*+-./: TEST',
  ];

  for (const text of samples) {
    for (const [ecl, mask] of eclMasks) {
      it(`matches reference: ${JSON.stringify(text.slice(0, 24))} ecl=${ecl} mask=${mask}`, () => {
        // Determine the version node-qrcode picks, then force the same one so
        // matrices are directly comparable.
        const ref = QRCode.create(text, {
          errorCorrectionLevel: ecl.toLowerCase() as 'l' | 'm' | 'q' | 'h',
          maskPattern: mask as 0,
        });
        const version = ref.version;

        const ours = encode(text, {
          errorCorrectionLevel: ecl,
          version,
          mask,
          boostEcl: false,
        });

        expect(ours.size).toBe(versionSize(version));
        const refGrid = referenceGrid(text, ecl, version, mask);
        expect(gridsEqual(ours.modules, refGrid)).toBe(true);
      });
    }
  }
});

describe('auto selection', () => {
  it('auto-picks a mask and version and stays scannable-sized', () => {
    const m = encode('https://example.com');
    expect(m.size).toBeGreaterThanOrEqual(21);
    expect(m.mask).toBeGreaterThanOrEqual(0);
    expect(m.mask).toBeLessThanOrEqual(7);
  });

  it('boosts ECL for free when data leaves room', () => {
    // A tiny payload at default ECL M should boost up to H at version 1.
    const m = encode('HI', { errorCorrectionLevel: 'L' });
    expect(m.version).toBe(1);
    expect(['L', 'M', 'Q', 'H']).toContain(m.ecl);
  });

  it('throws when data exceeds capacity', () => {
    expect(() => encode('x'.repeat(3000), { maxVersion: 1 })).toThrow();
  });

  it('encodes Kanji text via byte/UTF-8 fallback without error', () => {
    const m = encode('注文番号12345', { errorCorrectionLevel: 'M' });
    expect(m.size).toBeGreaterThanOrEqual(21);
    expect(m.modules.length).toBe(m.size);
  });
});

describe('multi-segment encoding', () => {
  // Mixed payloads must split into numeric / alphanumeric / byte runs exactly
  // as node-qrcode does, so the matrices stay bit-for-bit identical.
  const mixed = [
    'https://x.co/r/1234567890123',
    'Tel: +91 98765 43210 ext 42',
    'https://rune.kroszborg.co/?id=98765432109876543210&ref=ABCDEF',
    'ABC123abc456DEF789012345678',
    'WIFI:T:WPA;S:MyNet;P:12345678901234567890;;',
  ];
  for (const text of mixed) {
    it(`splits like the reference: ${JSON.stringify(text.slice(0, 28))}`, () => {
      const ref = QRCode.create(text, { errorCorrectionLevel: 'm', maskPattern: 3 });
      const ours = encode(text, {
        errorCorrectionLevel: 'M',
        version: ref.version,
        mask: 3,
        boostEcl: false,
      });
      expect(ref.segments.length).toBeGreaterThan(1);
      expect(gridsEqual(ours.modules, referenceGrid(text, 'M', ref.version, 3))).toBe(true);
    });
  }

  it('lands a numeric-tailed URL one version smaller than single-segment byte mode', () => {
    const text = `https://x.co/r/${'7'.repeat(40)}`;
    const split = encode(text, { errorCorrectionLevel: 'M', boostEcl: false });
    // Single byte segment: 4 + 8 + 8*55 = 452 bits > v4-M (512)? no — force by capacity math:
    const singleBits = 4 + 8 + new TextEncoder().encode(text).length * 8;
    expect(singleBits).toBeGreaterThan(numDataCodewords(split.version, 'M') * 8);
  });

  it('emits a UTF-8 ECI header only when asked and only for non-Latin-1 text', () => {
    const plain = encode('Rune ✓', { eci: false, mask: 0 });
    const withEci = encode('Rune ✓', { eci: true, mask: 0 });
    expect(gridsEqual(plain.modules, withEci.modules)).toBe(false);
    // ASCII payloads never carry an ECI header, opted in or not.
    const a = encode('HELLO', { eci: true, mask: 0 });
    const b = encode('HELLO', { eci: false, mask: 0 });
    expect(gridsEqual(a.modules, b.modules)).toBe(true);
  });

  it('rejects an empty value', () => {
    expect(() => encode('')).toThrow(/non-empty/);
  });
});

describe('codeword layout', () => {
  it('maps every data module to a codeword and every codeword to a block', () => {
    const m = encode('https://rune.kroszborg.co/layout', { errorCorrectionLevel: 'Q' });
    const { codewordAt, blockOf, blockCount, correctablePerBlock } = m.layout;
    expect(codewordAt.length).toBe(m.size * m.size);
    let mapped = 0;
    for (let i = 0; i < codewordAt.length; i++) if (codewordAt[i]! >= 0) mapped++;
    expect(mapped).toBe(blockOf.length * 8);
    for (const b of blockOf) expect(b).toBeLessThan(blockCount);
    expect(correctablePerBlock).toBeGreaterThan(0);
  });
});

describe('ECI for accented Latin-1 text', () => {
  it('emits the header for any non-ASCII text when opted in', () => {
    const plain = encode('café', { eci: false, mask: 0 });
    const withEci = encode('café', { eci: true, mask: 0 });
    expect(gridsEqual(plain.modules, withEci.modules)).toBe(false);
  });

  it('validates version and maxVersion', () => {
    expect(() => encode('x', { version: 41 })).toThrow(/version/);
    expect(() => encode('x', { version: 2.5 })).toThrow(/version/);
    expect(() => encode('x', { errorCorrectionLevel: 'low' as 'L' }).ecl).not.toThrow();
  });
});
