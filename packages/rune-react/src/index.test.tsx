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
