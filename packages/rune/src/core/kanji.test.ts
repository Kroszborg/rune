import QRCode from 'qrcode';
// @ts-expect-error: helper has no type declarations
import toSJIS from 'qrcode/helper/to-sjis';
import { describe, expect, it } from 'vitest';
import { encode } from './qr.js';
import { kanjiTable, makeSegments } from './segment.js';

function refGrid(
  segments: Array<{ data: string; mode: string }>,
  ecl: 'L' | 'M' | 'Q' | 'H',
  mask: number,
) {
  const qr = QRCode.create(segments as never, {
    errorCorrectionLevel: ecl.toLowerCase() as 'l',
    maskPattern: mask as 0,
    toSJISFunc: toSJIS as (c: string) => number,
  });
  const size = qr.modules.size;
  const grid: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) row.push(Boolean(qr.modules.data[y * size + x]));
    grid.push(row);
  }
  return { grid, version: qr.version };
}

describe('Kanji mode', () => {
  const runtimeHasShiftJis = kanjiTable() !== null;

  it('builds the Shift_JIS table from the runtime decoder', () => {
    expect(runtimeHasShiftJis).toBe(true);
    const table = kanjiTable()!;
    expect(table.get('日'.charCodeAt(0))).toBe(
      ((0x93fa - 0x8140) >> 8) * 0xc0 + ((0x93fa - 0x8140) & 0xff),
    );
    expect(table.has('A'.charCodeAt(0))).toBe(false);
  });

  it('encodes pure Japanese text bit-for-bit like node-qrcode in Kanji mode', () => {
    const text = '日本語のテキスト';
    for (const [ecl, mask] of [
      ['M', 2],
      ['H', 5],
    ] as const) {
      const ref = refGrid([{ data: text, mode: 'kanji' }], ecl, mask);
      const ours = encode(text, {
        errorCorrectionLevel: ecl,
        version: ref.version,
        mask,
        boostEcl: false,
      });
      expect(ours.modules).toEqual(ref.grid);
    }
  });

  it('produces a smaller symbol than byte mode and can be disabled', () => {
    const text = '日本語のテキストをエンコードします。二次元コード';
    const kanji = encode(text, { errorCorrectionLevel: 'M', boostEcl: false });
    const bytes = encode(text, { errorCorrectionLevel: 'M', boostEcl: false, kanji: false });
    expect(kanji.version).toBeLessThan(bytes.version);
  });

  it('splits mixed payloads into kanji + numeric + byte runs', () => {
    const segs = makeSegments('注文番号12345678 ok 日本', 1);
    expect(segs.map((s) => s.mode)).toEqual(['kanji', 'numeric', 'byte', 'kanji']);
  });

  it('leaves the lone em dash in a Latin sentence in byte mode (headers cost more than it saves)', () => {
    const segs = makeSegments('Rune QR — ünïcödé ✓', 1);
    expect(segs.every((s) => s.mode !== 'kanji')).toBe(true);
  });
});
