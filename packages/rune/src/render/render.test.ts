import { describe, expect, it } from 'vitest';
import { toSVGString } from './render.js';

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
