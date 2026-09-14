import { describe, expect, it } from 'vitest';
import { renderToParts, toSVGString } from './render.js';

const PNG_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

describe('toSVGString', () => {
  it('produces a well-formed standalone SVG', () => {
    const svg = toSVGString({ value: 'https://rune.kroszborg.co' });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="QR code: https://rune.kroszborg.co"');
  });

  it('emits data modules and three finder patterns (ring + inner dot each)', () => {
    const svg = toSVGString({ value: 'HELLO' });
    const paths = svg.match(/<path /g) ?? [];
    // 1 combined data path + 3 rings + 3 inner dots = at least 7 paths.
    expect(paths.length).toBeGreaterThanOrEqual(7);
    expect(svg).toContain('fill-rule="evenodd"');
  });

  it('renders gradients into <defs>', () => {
    const svg = toSVGString({
      value: 'GRADIENT',
      dots: {
        style: 'rounded',
        gradient: {
          type: 'linear',
          rotation: 45,
          stops: [
            { offset: 0, color: '#2bbd8a' },
            { offset: 1, color: '#54d6a6' },
          ],
        },
      },
    });
    expect(svg).toContain('<defs>');
    expect(svg).toContain('<linearGradient');
    expect(svg).toContain('stop-color="#2bbd8a"');
  });

  it('embeds a safe logo image and rejects unsafe sources', () => {
    const ok = toSVGString({ value: 'LOGO', logo: { src: PNG_PIXEL, size: 0.25 } });
    expect(ok).toContain('<image');

    const unsafe = toSVGString({ value: 'LOGO', logo: { src: 'javascript:alert(1)' } });
    expect(unsafe).not.toContain('<image');
  });

  it('does not double-escape the aria-label', () => {
    const svg = toSVGString({ value: 'https://x.com?a=1&b=2' });
    expect(svg).toContain('aria-label="QR code: https://x.com?a=1&amp;b=2"');
    expect(svg).not.toContain('&amp;amp;');
  });

  it('frame text without a border style draws no border rect', () => {
    const noBorder = toSVGString({ value: 'X', frame: { style: 'none', text: 'SCAN ME' } });
    expect(noBorder).toContain('<text');
    expect(noBorder).not.toContain('stroke=');
    const withBorder = toSVGString({ value: 'X', frame: { style: 'rounded', text: 'SCAN ME' } });
    expect(withBorder).toContain('stroke=');
  });

  it('framed output is taller than wide (aspect preserved for export)', () => {
    const svg = toSVGString({
      value: 'X',
      size: 300,
      frame: { style: 'rounded', text: 'SCAN ME' },
    });
    const w = Number(svg.match(/width="(\d+)"/)?.[1]);
    const h = Number(svg.match(/height="(\d+)"/)?.[1]);
    expect(h).toBeGreaterThan(w);
  });

  it('a solid-color QR emits no gradient defs (and needs no hashed id)', () => {
    const svg = toSVGString({ value: 'X', dots: { color: '#123456' } });
    expect(svg).not.toContain('<defs>');
    expect(svg).not.toContain('linearGradient');
  });

  it('renders a frame with CTA text', () => {
    const svg = toSVGString({ value: 'FRAME', frame: { style: 'rounded', text: 'SCAN ME' } });
    expect(svg).toContain('<text');
    expect(svg).toContain('SCAN ME');
    expect(svg).toContain('<g transform="translate(');
  });

  it('applies a named preset as a base', () => {
    const svg = toSVGString({ value: 'PRESET', preset: 'mint' });
    expect(svg).toContain('<linearGradient');
  });

  it('supports transparent background (no background rect)', () => {
    const svg = toSVGString({ value: 'X', background: 'transparent' });
    // First element after optional defs should not be a full-size background rect.
    expect(svg).not.toContain('width="256" height="256" fill="#ffffff"');
  });

  it('gives two different QR codes distinct default gradient ids', () => {
    const grad = (color: string) => ({
      type: 'linear' as const,
      stops: [
        { offset: 0, color },
        { offset: 1, color: '#000' },
      ],
    });
    const a = toSVGString({ value: 'A', dots: { gradient: grad('#0f7a5c') } });
    const b = toSVGString({ value: 'A', dots: { gradient: grad('#f0686a') } });
    const idA = a.match(/id="(rune[^"]+)"/)?.[1];
    const idB = b.match(/id="(rune[^"]+)"/)?.[1];
    expect(idA).toBeTruthy();
    expect(idA).not.toBe(idB); // different gradients → different id namespaces
  });

  it('namespaces gradient ids per instance', () => {
    const a = toSVGString({
      value: 'A',
      id: 'qa',
      dots: {
        gradient: {
          type: 'radial',
          stops: [
            { offset: 0, color: '#000' },
            { offset: 1, color: '#fff' },
          ],
        },
      },
    });
    expect(a).toContain('id="qa-g0"');
  });
});

describe('logo + error correction', () => {
  it('keeps ECL M for a small logo instead of forcing H', () => {
    const value = 'https://rune.kroszborg.co/branded';
    const plain = renderToParts({ value });
    const small = renderToParts({ value, logo: { src: PNG_PIXEL, size: 0.1 } });
    expect(small.ecl).toBe('M');
    expect(small.version).toBe(plain.version);
  });

  it('steps the ECL up only as far as the logo needs', () => {
    const value = 'https://rune.kroszborg.co/branded?utm_source=flyer&utm_campaign=autumn';
    const mid = renderToParts({ value, logo: { src: PNG_PIXEL, size: 0.2 } });
    expect(mid.ecl).toBe('Q');
    expect(mid.logo?.width).toBeCloseTo(256 * 0.2, 5);
    const big = renderToParts({ value, logo: { src: PNG_PIXEL, size: 0.25 } });
    expect(big.ecl).toBe('H');
    expect(big.logo?.width).toBeCloseTo(256 * 0.25, 5);
  });

  it('shrinks a logo that even ECL H cannot absorb on a small symbol', () => {
    const value = 'https://rune.kroszborg.co/branded';
    const big = renderToParts({ value, logo: { src: PNG_PIXEL, size: 0.3 } });
    expect(big.ecl).toBe('H');
    expect(big.logo!.width).toBeLessThan(256 * 0.3);
    // Opting out of the clamp keeps the exact size.
    const raw = renderToParts({ value, logo: { src: PNG_PIXEL, size: 0.3, clamp: false } });
    expect(raw.logo!.width).toBeCloseTo(256 * 0.3, 5);
  });

  it('shrinks the logo when the caller pins a level too low for it', () => {
    const value = 'https://rune.kroszborg.co/branded';
    const pinned = renderToParts({
      value,
      qr: { errorCorrectionLevel: 'L' },
      logo: { src: PNG_PIXEL, size: 0.3 },
    });
    expect(['L', 'M']).toContain(pinned.ecl); // L may be boosted to M for free
    expect(pinned.logo!.width).toBeLessThan(256 * 0.3);
  });

  it('clears a plate for a src-less logo and reports its box', () => {
    const parts = renderToParts({ value: 'PLATE', logo: { size: 0.2 } });
    expect(parts.body).not.toContain('<image');
    expect(parts.body).toContain('<rect'); // background + plate
    expect(parts.logo).toBeDefined();
    const box = parts.logo!;
    expect(box.x + box.width / 2).toBeCloseTo(128, 5);
    expect(box.y + box.height / 2).toBeCloseTo(128, 5);
  });

  it('offsets the logo box by the frame padding and CTA band', () => {
    const bare = renderToParts({ value: 'PLATE', logo: { size: 0.2 } });
    const top = renderToParts({
      value: 'PLATE',
      logo: { size: 0.2 },
      frame: { style: 'square', text: 'SCAN', position: 'top' },
    });
    expect(top.logo!.x).toBeGreaterThan(bare.logo!.x);
    expect(top.logo!.y - bare.logo!.y).toBeGreaterThan(top.logo!.x - bare.logo!.x);
    // The logo still sits on the QR's centre line horizontally.
    expect(top.logo!.x + top.logo!.width / 2).toBeCloseTo(top.width / 2, 5);
  });
});

describe('alignment patterns', () => {
  const value = 'https://rune.kroszborg.co/alignment-patterns-need-a-version-two-or-higher';

  it('draws alignment patterns as their own solid path by default', () => {
    const parts = renderToParts({ value, dots: { style: 'star' } });
    expect(parts.version).toBeGreaterThanOrEqual(2);
    // data path + alignment path + 3 rings + 3 dots
    expect((parts.body.match(/<path /g) ?? []).length).toBe(8);
  });

  it("styles them like data with corners.alignment.style 'inherit'", () => {
    const parts = renderToParts({
      value,
      dots: { style: 'star' },
      corners: { alignment: { style: 'inherit' } },
    });
    expect((parts.body.match(/<path /g) ?? []).length).toBe(7);
  });
});

describe('frame CTA fitting', () => {
  const fontSize = (svg: string) => Number(/font-size="(\d+)"/.exec(svg)?.[1]);

  it('shrinks long labels and ellipsises the truly overlong', () => {
    const short = toSVGString({ value: 'X', frame: { text: 'SCAN ME' } });
    const long = toSVGString({ value: 'X', frame: { text: 'SCAN THIS CODE TO SEE THE MENU' } });
    const huge = toSVGString({ value: 'X', frame: { text: 'A'.repeat(200) } });
    expect(fontSize(long)).toBeLessThan(fontSize(short));
    expect(huge).toContain('…');
    expect(huge).not.toContain('A'.repeat(64));
  });
});

describe('input validation', () => {
  it('throws on an empty value rather than rendering a blank symbol', () => {
    expect(() => toSVGString({ value: '' })).toThrow(/non-empty/);
  });
});

describe('option merging and validation (audit regressions)', () => {
  it('does not let undefined keys override a preset (adapters forward every prop)', () => {
    const svg = toSVGString({
      value: 'X',
      preset: 'midnight',
      background: undefined,
      frame: undefined,
    });
    expect(svg).toContain('fill="#0b0b0f"'); // midnight background survives
    const dots = toSVGString({ value: 'X', preset: 'mint', dots: { style: undefined } });
    expect(dots).toContain('linearGradient');
  });

  it('keeps rendering when a higher ECL would no longer fit the data', () => {
    const value = 'x'.repeat(1800);
    const parts = renderToParts({ value, logo: { src: PNG_PIXEL, size: 0.3 } });
    expect(parts.ecl).toBe('M');
    expect(parts.logo!.width).toBeLessThan(256 * 0.3); // shrunk instead of thrown
    const pinned = renderToParts({
      value: 'A'.repeat(38),
      qr: { version: 2 },
      logo: { size: 0.3 },
    });
    expect(pinned.version).toBe(2);
  });

  it('accepts any ECL spelling and rejects nonsense', () => {
    expect(renderToParts({ value: 'X', qr: { errorCorrectionLevel: 'h' } }).ecl).toBe('H');
    expect(
      renderToParts({ value: 'X', qr: { errorCorrectionLevel: 'quartile', boostEcl: false } }).ecl,
    ).toBe('Q');
    expect(() => toSVGString({ value: 'X', qr: { errorCorrectionLevel: 'Z' as 'H' } })).toThrow(
      /errorCorrectionLevel/,
    );
  });

  it('rejects unknown style names, presets and broken numbers with RangeErrors', () => {
    expect(() => toSVGString({ value: 'X', dots: { style: 'round' as 'dot' } })).toThrow(
      /dots\.style/,
    );
    expect(() =>
      toSVGString({ value: 'X', corners: { square: { style: 'oops' as 'leaf' } } }),
    ).toThrow(/corners\.square\.style/);
    expect(() => toSVGString({ value: 'X', preset: 'nope' })).toThrow(/unknown preset/);
    expect(() => toSVGString({ value: 'X', size: Number.NaN })).toThrow(/size/);
    expect(() => toSVGString({ value: 'X', size: -10 })).toThrow(/size/);
    expect(() => toSVGString({ value: 'X', margin: -1 })).toThrow(/margin/);
    expect(() =>
      toSVGString({ value: 'X', dots: { gradient: { type: 'linear', stops: [] } } }),
    ).toThrow(/stops/);
    expect(() => toSVGString({ value: 'X', logo: { size: Number.NaN } })).toThrow(/logo\.size/);
  });

  it('keeps payloads out of the default aria-label unless they are short URLs', () => {
    expect(toSVGString({ value: 'https://rune.kroszborg.co' })).toContain(
      'aria-label="QR code: https://rune.kroszborg.co"',
    );
    expect(toSVGString({ value: 'WIFI:T:WPA;S:Home;P:hunter2;;' })).toContain(
      'aria-label="QR code"',
    );
    expect(toSVGString({ value: 'WIFI:T:WPA;S:Home;P:hunter2;;' })).not.toContain('hunter2');
  });

  it('emits a <title> and honours idPrefix for gradient ids', () => {
    const svg = toSVGString({
      value: 'X',
      title: 'Menu <QR>',
      idPrefix: 'abc',
      dots: { gradient: { type: 'linear', stops: [{ offset: 0, color: '#000' }] } },
    });
    expect(svg).toContain('<title>Menu &lt;QR&gt;</title>');
    expect(svg).toContain('id="abc-g0"');
  });
});
