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
