import { describe, expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { QRCode } from './index.js';

async function ssr(props: Record<string, unknown>): Promise<string> {
  const app = createSSRApp({ render: () => h(QRCode, props) });
  return renderToString(app);
}

describe('Vue <QRCode>', () => {
  it('server-renders an <svg> with data + finders', async () => {
    const html = await ssr({ value: 'https://rune.kroszborg.co', dots: { style: 'rounded' } });
    expect(html).toContain('<svg');
    expect(html).toContain('role="img"');
    expect((html.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(7);
  });

  it('renders gradients from a preset', async () => {
    const html = await ssr({ value: 'X', preset: 'mint' });
    expect(html).toContain('linearGradient');
  });
});

describe('Vue <QRCode> with a slotted logo', () => {
  it('clears a plate and overlays the slot content on it', async () => {
    const app = createSSRApp({
      render: () =>
        h(QRCode, { value: 'https://rune.kroszborg.co', logo: { size: 0.2 } }, () => h('b', 'R')),
    });
    const html = await renderToString(app);
    expect(html).not.toContain('<image');
    expect(html).toContain('<b>R</b>');
    const overlay = html.slice(html.indexOf('position:absolute'));
    const left = Number(/left:\s*([\d.]+)%/.exec(overlay)?.[1]);
    const width = Number(/width:\s*([\d.]+)%/.exec(overlay)?.[1]);
    expect(left + width / 2).toBeCloseTo(50, 1);
    expect(width).toBeGreaterThan(17);
    expect(width).toBeLessThanOrEqual(20);
  });
});

describe('Vue <QRCode> (audit regressions)', () => {
  it('keeps preset backgrounds although every prop is forwarded', async () => {
    const html = await ssr({ value: 'X', preset: 'midnight' });
    expect(html).toContain('fill="#0b0b0f"');
  });

  it('renders nothing for an empty value and passes id through as an attribute', async () => {
    expect(await ssr({ value: '' })).not.toContain('<svg');
    expect(await ssr({ value: 'X', id: 'qr-vue' })).toContain('id="qr-vue"');
  });
});
