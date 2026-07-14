import { describe, expect, it } from 'vitest';
import { register, renderRune } from './index.js';

describe('renderRune', () => {
  it('injects an <svg> into a target element', () => {
    const div = document.createElement('div');
    renderRune(div, { value: 'https://rune.kroszborg.co', dots: { style: 'rounded' } });
    const svg = div.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(div.querySelectorAll('path').length).toBeGreaterThanOrEqual(7);
  });
});

describe('<rune-qr> custom element', () => {
  it('renders from attributes and updates reactively', () => {
    register();
    const el = document.createElement('rune-qr');
    el.setAttribute('value', 'HELLO');
    el.setAttribute('preset', 'mint');
    document.body.appendChild(el);
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.innerHTML).toContain('linearGradient');

    el.setAttribute('value', 'CHANGED');
    expect(el.querySelector('svg')).not.toBeNull();
    document.body.removeChild(el);
  });

  it('supports the .options property for full config', () => {
    register();
    const el = document.createElement('rune-qr') as HTMLElement & {
      options?: import('./index.js').RenderOptions;
    };
    document.body.appendChild(el);
    el.options = { value: 'PROP', frame: { style: 'rounded', text: 'SCAN ME' } };
    expect(el.innerHTML).toContain('SCAN ME');
    document.body.removeChild(el);
  });
});
