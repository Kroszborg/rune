import { Resvg } from '@resvg/resvg-js';
import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { renderToParts, toSVGString } from './render.js';
import type { DotStyle, FinderSquareStyle, RuneOptions } from './types.js';

const PNG_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

/** Render options to PNG pixels and decode with jsQR; returns decoded text. */
function scan(options: RuneOptions & { id?: string }, px = 512): string | null {
  const svg = toSVGString({ ...options, size: px });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: px } });
  const rendered = resvg.render();
  const result = jsQR(new Uint8ClampedArray(rendered.pixels), rendered.width, rendered.height);
  return result?.data ?? null;
}

const value = 'https://rune.kroszborg.co/scan-test';

const DOT_STYLES: DotStyle[] = [
  'square',
  'dot',
  'rounded',
  'extra-rounded',
  'classy',
  'classy-rounded',
  'leaf',
  'diamond',
  'star',
];
const FINDER_STYLES: FinderSquareStyle[] = ['square', 'rounded', 'extra-rounded', 'circle', 'leaf'];

describe('scan-back: every dot style decodes', () => {
  for (const style of DOT_STYLES) {
    it(`decodes dots: ${style}`, () => {
      expect(scan({ value, dots: { style } })).toBe(value);
    });
  }

  // A long payload lands at version 30+: small cells and ornate shapes fail
  // there first, so every style must also survive a dense symbol.
  const dense = `https://rune.kroszborg.co/dense?payload=${'0123456789abcdefghij'.repeat(66)}`;
  for (const style of DOT_STYLES) {
    it(`decodes dots at version 30+: ${style}`, () => {
      const parts = renderToParts({ value: dense, dots: { style } });
      expect(parts.version).toBeGreaterThanOrEqual(30);
      expect(scan({ value: dense, dots: { style } }, 1400)).toBe(dense);
    });
  }
});

describe('scan-back: every finder style decodes, dark-on-light and light-on-dark', () => {
  for (const style of FINDER_STYLES) {
    it(`decodes finders: ${style} (dark on light)`, () => {
      expect(scan({ value, corners: { square: { style } } })).toBe(value);
    });
    it(`decodes finders: ${style} (light on dark)`, () => {
      expect(
        scan({
          value,
          dots: { color: '#ffffff' },
          corners: { square: { style } },
          background: '#0b0b0f',
        }),
      ).toBe(value);
    });
  }
});

describe('scan-back: styles, presets, logos and frames', () => {
  const variants: Array<[string, RuneOptions]> = [
    [
      'gradient dots',
      {
        value,
        dots: {
          style: 'rounded',
          gradient: {
            type: 'linear',
            rotation: 45,
            stops: [
              { offset: 0, color: '#2bbd8a' },
              { offset: 1, color: '#0b6b4f' },
            ],
          },
        },
      },
    ],
    ['preset:mint', { value, preset: 'mint' }],
    ['preset:fluid', { value, preset: 'fluid' }],
    ['preset:midnight', { value, preset: 'midnight' }],
    ['preset:sunset', { value, preset: 'sunset' }],
    ['alignment: rounded', { value, corners: { alignment: { style: 'rounded' } } }],
    ['alignment: circle', { value, corners: { alignment: { style: 'circle' } } }],
    [
      'per-corner finders',
      {
        value,
        corners: {
          square: { style: 'rounded' },
          topLeft: { square: { style: 'circle', color: '#0b6b4f' }, dot: { style: 'dot' } },
          topRight: { square: { style: 'leaf' } },
          bottomLeft: { dot: { style: 'rounded', color: '#7a1f3d' } },
        },
      },
    ],
    ['kanji mode', { value: '日本語のテキスト 123' }],
    [
      'logo + ECL H',
      { value, qr: { errorCorrectionLevel: 'H' }, logo: { src: PNG_PIXEL, size: 0.22 } },
    ],
    // No explicit ECL: the renderer picks the lowest level that covers the
    // logo and clamps an oversized logo (regression guard for the coupling).
    ['logo auto-ECL (small, stays M)', { value, logo: { src: PNG_PIXEL, size: 0.1 } }],
    ['logo auto-ECL (large, clamped)', { value, logo: { src: PNG_PIXEL, size: 0.4 } }],
    ['logo circle plate', { value, logo: { src: PNG_PIXEL, size: 0.2, shape: 'circle' } }],
    // A src-less logo is a bare plate for an adapter overlay: still cleared,
    // still scannable.
    ['logo plate without src', { value, logo: { size: 0.22 } }],
    ['logo plate + frame', { value, logo: { size: 0.2 }, frame: { text: 'SCAN ME' } }],
    ['frame + CTA', { value, frame: { style: 'rounded', text: 'SCAN ME' } }],
    [
      'frame + overlong CTA',
      { value, frame: { style: 'square', text: 'SCAN THIS CODE TO OPEN THE MENU AND ORDER' } },
    ],
    ['ECI header (utf-8)', { value: 'Rune ✓ ünïcödé — 日本', qr: { eci: true } }],
    ['multi-segment', { value: 'https://x.co/r/1234567890123' }],
  ];

  for (const [name, options] of variants) {
    it(`decodes: ${name}`, () => {
      expect(scan(options)).toBe(options.value);
    });
  }

  it('decodes numeric, alphanumeric, and long unicode payloads', () => {
    expect(scan({ value: '8675309', dots: { style: 'rounded' } })).toBe('8675309');
    expect(scan({ value: 'HELLO WORLD 123', dots: { style: 'dot' } })).toBe('HELLO WORLD 123');
    const long = 'Rune ✓ — the QR library. '.repeat(6);
    expect(scan({ value: long, qr: { errorCorrectionLevel: 'M' } }, 640)).toBe(long);
  });
});
