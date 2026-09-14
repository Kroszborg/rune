import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QRCode } from './index.js';

describe('<QRCode>', () => {
  it('server-renders a real <svg> with data + finders', () => {
    const html = renderToStaticMarkup(
      <QRCode value="https://rune.kroszborg.co" dots={{ style: 'rounded' }} />,
    );
    expect(html.startsWith('<svg')).toBe(true);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="QR code: https://rune.kroszborg.co"');
    expect((html.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(7);
  });

  it('applies className and gradients', () => {
    const html = renderToStaticMarkup(
      <QRCode
        value="X"
        className="my-qr"
        dots={{
          gradient: {
            type: 'linear',
            stops: [
              { offset: 0, color: '#000' },
              { offset: 1, color: '#333' },
            ],
          },
        }}
      />,
    );
    expect(html).toContain('class="my-qr"');
    expect(html).toContain('linearGradient');
  });

  it('wraps with an overlay when logoElement is provided', () => {
    const html = renderToStaticMarkup(
      <QRCode value="X" qr={{ errorCorrectionLevel: 'H' }} logoElement={<span>logo</span>} />,
    );
    expect(html).toContain('<span');
    expect(html).toContain('logo');
    expect(html).toContain('<svg');
  });
});

describe('<QRCode logoElement>', () => {
  it('clears a plate in the SVG and positions the node over it', () => {
    const html = renderToStaticMarkup(
      <QRCode value="https://rune.kroszborg.co" logo={{ size: 0.2 }} logoElement={<b>R</b>} />,
    );
    expect(html).not.toContain('<image');
    // Overlay uses percentage geometry from the core's logo box (~40%…60%;
    // the damage model may trim the size by a percent or two).
    const overlay = html.slice(html.indexOf('position:absolute'));
    const left = Number(/left:([\d.]+)%/.exec(overlay)?.[1]);
    const width = Number(/width:([\d.]+)%/.exec(overlay)?.[1]);
    expect(left).toBeGreaterThan(39);
    expect(left).toBeLessThan(41.5);
    expect(width).toBeGreaterThan(17);
    expect(width).toBeLessThanOrEqual(20);
    expect(html).toContain('<b>R</b>');
  });

  it('keeps the node centred on the QR when a frame adds a CTA band', () => {
    const html = renderToStaticMarkup(
      <QRCode
        value="X"
        logo={{ size: 0.2 }}
        logoElement={<b>R</b>}
        frame={{ style: 'square', text: 'SCAN ME', position: 'top' }}
      />,
    );
    // Horizontal centre unchanged; vertical position pushed below the band.
    const overlay = html.slice(html.indexOf('position:absolute'));
    const left = Number(/left:([\d.]+)%/.exec(overlay)?.[1]);
    const width = Number(/width:([\d.]+)%/.exec(overlay)?.[1]);
    expect(left + width / 2).toBeCloseTo(50, 1);
    const top = Number(/top:([\d.]+)%/.exec(overlay)?.[1]);
    expect(top).toBeGreaterThan(left + 2);
  });

  it('replaces logo.src with the node when both are given', () => {
    const html = renderToStaticMarkup(
      <QRCode value="X" logo={{ src: 'https://example.com/a.png' }} logoElement={<b>R</b>} />,
    );
    expect(html).not.toContain('<image');
  });
});

describe('<QRCode> prop handling (audit regressions)', () => {
  it('forwards DOM props and id to the <svg>, and namespaces gradient ids per instance', () => {
    const html = renderToStaticMarkup(
      <div>
        <QRCode value="X" id="qr-1" data-testid="qr" tabIndex={0} preset="mint" />
        <QRCode value="X" preset="mint" />
      </div>,
    );
    expect(html).toContain('id="qr-1"');
    expect(html).toContain('data-testid="qr"');
    expect(html).toContain('tabindex="0"');
    const ids = [...html.matchAll(/<linearGradient id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBe(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('renders nothing for an empty value instead of throwing', () => {
    expect(renderToStaticMarkup(<QRCode value="" />)).toBe('');
  });

  it('does not let undefined props override a preset', () => {
    const html = renderToStaticMarkup(
      <QRCode value="X" preset="midnight" background={undefined} />,
    );
    expect(html).toContain('fill="#0b0b0f"');
  });
});
