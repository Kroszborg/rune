import { encode, toSVGString } from '@kroszborg/rune';
import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { parseSegments } from './bits.js';
import { decode } from './image.js';
import { decodeMatrix } from './matrix-decode.js';

interface Img {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

function render(value: string, px = 360, extra: Record<string, unknown> = {}): Img {
  const svg = toSVGString({ value, size: px, ...extra });
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: px } }).render();
  return { data: new Uint8ClampedArray(r.pixels), width: r.width, height: r.height };
}

function mirror(img: Img): Img {
  const out = new Uint8ClampedArray(img.data.length);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const s = (y * img.width + x) * 4;
      const d = (y * img.width + (img.width - 1 - x)) * 4;
      out.set(img.data.subarray(s, s + 4), d);
    }
  }
  return { ...img, data: out };
}

/** Inverse-map every output pixel through a homography (nearest neighbour), white outside. */
function warp(img: Img, h: number[]): Img {
  const out = new Uint8ClampedArray(img.data.length).fill(255);
  const [a, b, c, d, e, f, g, hh, i] = h as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const w = g * x + hh * y + i;
      const sx = Math.round((a * x + b * y + c) / w);
      const sy = Math.round((d * x + e * y + f) / w);
      if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) continue;
      const s = (sy * img.width + sx) * 4;
      out.set(img.data.subarray(s, s + 4), (y * img.width + x) * 4);
    }
  }
  return { ...img, data: out };
}

/** Darken the image progressively from left to right and add a soft vignette. */
function shade(img: Img): Img {
  const out = new Uint8ClampedArray(img.data);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const k = 0.35 + 0.65 * (1 - x / img.width); // 1.0 at left, 0.35 at right
      const vignette = 1 - 0.3 * Math.hypot(x / img.width - 0.5, y / img.height - 0.5);
      const o = (y * img.width + x) * 4;
      for (let ch = 0; ch < 3; ch++)
        out[o + ch] = Math.round(out[o + ch]! * k * vignette + 40 * (1 - k));
    }
  }
  return { ...img, data: out };
}

function bits(str: string): number[] {
  const clean = str.replace(/\s+/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 8) {
    bytes.push(Number.parseInt(clean.slice(i, i + 8).padEnd(8, '0'), 2));
  }
  return bytes;
}

const value = 'https://rune.kroszborg.co/robust?id=42';

describe('image decoding robustness', () => {
  it('decodes a mirrored image and reports it', () => {
    const result = decode(mirror(render(value)));
    expect(result?.text).toBe(value);
    expect(result?.mirrored).toBe(true);
  });

  it('decodes a perspective-warped image using the alignment pattern', () => {
    // A homography that tilts the top edge inwards (like a phone held at an angle).
    const src = render(value, 400);
    const w = src.width;
    const tilt = [1, 0.18, -0.09 * w, 0, 1.08, -0.02 * w, 0, 0.00045, 1];
    const result = decode(warp(src, tilt));
    expect(result?.text).toBe(value);
  });

  it('decodes under strong uneven lighting', () => {
    const result = decode(shade(render(value, 400)));
    expect(result?.text).toBe(value);
  });

  it('decodes a rotated + shaded + mirrored image', () => {
    const svg = toSVGString({ value, size: 400 });
    const rotated = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="520" viewBox="0 0 520 520"><rect width="520" height="520" fill="#fff"/><g transform="translate(260 260) rotate(33) translate(-200 -200)">${svg.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g></svg>`;
    const r = new Resvg(rotated, { fitTo: { mode: 'width', value: 520 } }).render();
    const img: Img = { data: new Uint8ClampedArray(r.pixels), width: r.width, height: r.height };
    expect(decode(shade(mirror(img)))?.text).toBe(value);
  });
});

describe('Kanji, Structured Append and FNC1', () => {
  it('round-trips Kanji-mode symbols from the Rune encoder', () => {
    for (const text of ['日本語', '注文番号12345678 ok 日本', '漢字とカタカナとひらがな。']) {
      const m = encode(text);
      expect(decodeMatrix(m.modules).text).toBe(text);
      expect(decode(render(text, 300))?.text).toBe(text);
    }
  });

  it('parses a Structured Append header and continues with the data', () => {
    // mode 0011, index 0010 (3rd), total 0011 (4 symbols), parity 10101011,
    // then numeric "12": mode 0001, count 0000000010, value 0001100, terminator.
    const data = bits('0011 0010 0011 10101011 0001 0000000010 0001100 0000');
    const parsed = parseSegments(data, 1);
    expect(parsed.text).toBe('12');
    expect(parsed.structuredAppend).toEqual({ index: 2, total: 4, parity: 0xab });
  });

  it('parses FNC1 indicators and continues with the data', () => {
    const first = parseSegments(bits('0101 0001 0000000010 0001100 0000'), 1);
    expect(first.text).toBe('12');
    expect(first.fnc1).toEqual({ position: 'first' });
    const second = parseSegments(bits('1001 00101010 0001 0000000010 0001100 0000'), 1);
    expect(second.fnc1).toEqual({ position: 'second', applicationIndicator: 42 });
    expect(second.text).toBe('12');
  });
});
