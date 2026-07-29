import { Resvg } from '@resvg/resvg-js';
import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { toSVGString } from './render.js';
import type { RuneOptions } from './types.js';

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

describe('scan-back: rendered QR codes actually decode', () => {
  const value = 'https://rune.kroszborg.co/scan-test';

  const variants: Array<[string, RuneOptions]> = [
    ['square', { value, dots: { style: 'square' } }],
    ['dot', { value, dots: { style: 'dot' } }],
    ['rounded/fluid', { value, dots: { style: 'rounded' } }],
    ['extra-rounded', { value, dots: { style: 'extra-rounded' } }],
    ['classy', { value, dots: { style: 'classy' } }],
    ['classy-rounded', { value, dots: { style: 'classy-rounded' } }],
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
    [
      'extra-rounded finders',
      { value, corners: { square: { style: 'extra-rounded' }, dot: { style: 'dot' } } },
    ],
    ['circle finders', { value, corners: { square: { style: 'circle' } } }],
    ['leaf finders', { value, corners: { square: { style: 'leaf' } } }],
    [
      'dark background',
      { value, dots: { color: '#ffffff' }, background: '#0b0b0f' } as RuneOptions,
    ],
    ['preset:mint', { value, preset: 'mint' }],
    ['preset:fluid', { value, preset: 'fluid' }],
    [
      'logo + ECL H',
      { value, qr: { errorCorrectionLevel: 'H' }, logo: { src: PNG_PIXEL, size: 0.22 } },
    ],
    // No explicit ECL: the renderer must auto-raise to H and clamp the logo so
    // it stays scannable (regression guard for the logo/ECL coupling).
    ['logo auto-ECL', { value, logo: { src: PNG_PIXEL, size: 0.4 } }],
    ['frame + CTA', { value, frame: { style: 'rounded', text: 'SCAN ME' } }],
  ];

  for (const [name, options] of variants) {
    it(`decodes: ${name}`, () => {
      expect(scan(options)).toBe(value);
    });
  }

  it('decodes numeric, alphanumeric, and long unicode payloads', () => {
    expect(scan({ value: '8675309', dots: { style: 'rounded' } })).toBe('8675309');
    expect(scan({ value: 'HELLO WORLD 123', dots: { style: 'dot' } })).toBe('HELLO WORLD 123');
    const long = 'Rune ✓ — the QR library. '.repeat(6);
    expect(scan({ value: long, qr: { errorCorrectionLevel: 'M' } }, 640)).toBe(long);
  });
});
