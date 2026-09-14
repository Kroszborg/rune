import { describe, expect, it } from 'vitest';
import { type RenderOptions, register, renderRune } from './index.js';

/** Renders are coalesced into a microtask; flush it. */
const tick = () => new Promise<void>((r) => queueMicrotask(r));

const PNG_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

describe('renderRune', () => {
  it('injects an <svg> into a target element', () => {
    const div = document.createElement('div');
    renderRune(div, { value: 'https://rune.kroszborg.co', dots: { style: 'rounded' } });
    expect(div.querySelector('svg')).not.toBeNull();
    expect(div.querySelectorAll('path').length).toBeGreaterThanOrEqual(7);
  });
});

describe('<rune-qr> custom element', () => {
  it('renders from attributes and updates reactively', async () => {
    register();
    const el = document.createElement('rune-qr');
    el.setAttribute('value', 'HELLO');
    el.setAttribute('preset', 'mint');
    document.body.appendChild(el);
    await tick();
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.innerHTML).toContain('linearGradient');

    el.setAttribute('value', 'CHANGED');
    await tick();
    expect(el.getAttribute('value')).toBe('CHANGED');
    expect(el.querySelector('svg')).not.toBeNull();
    document.body.removeChild(el);
  });

  it('supports the .options property for full config', async () => {
    register();
    const el = document.createElement('rune-qr') as HTMLElement & { options?: RenderOptions };
    document.body.appendChild(el);
    el.options = { value: 'PROP', frame: { style: 'rounded', text: 'SCAN ME' } };
    await tick();
    expect(el.innerHTML).toContain('SCAN ME');
    document.body.removeChild(el);
  });

  it('coalesces many attribute changes into one render and skips detached elements', async () => {
    register();
    const el = document.createElement('rune-qr') as HTMLElement & { render(): void };
    let renders = 0;
    const original = el.render.bind(el);
    el.render = () => {
      renders++;
      original();
    };
    el.setAttribute('value', 'A');
    el.setAttribute('size', '128');
    el.setAttribute('dot-style', 'rounded');
    await tick();
    expect(el.innerHTML).toBe(''); // not connected: nothing rendered
    document.body.appendChild(el);
    el.setAttribute('margin', '2');
    el.setAttribute('preset', 'fluid');
    await tick();
    expect(el.querySelector('svg')).not.toBeNull();
    expect(renders).toBeLessThanOrEqual(2);
    document.body.removeChild(el);
  });

  it('does not let a preset be overridden by absent attributes', async () => {
    register();
    const el = document.createElement('rune-qr');
    el.setAttribute('value', 'X');
    el.setAttribute('preset', 'midnight');
    document.body.appendChild(el);
    await tick();
    // midnight = light dots on a dark background; the background must survive.
    expect(el.innerHTML).toContain('fill="#0b0b0f"');
    document.body.removeChild(el);
  });
});

describe('<rune-qr> extended attributes', () => {
  it('reads corner, alignment, logo and frame attributes', async () => {
    register();
    const el = document.createElement('rune-qr');
    el.setAttribute('value', 'https://rune.kroszborg.co');
    el.setAttribute('corner-style', 'extra-rounded');
    el.setAttribute('corner-color', '#123456');
    el.setAttribute('frame-text', 'SCAN ME');
    el.setAttribute('logo', PNG_PIXEL);
    el.setAttribute('logo-size', '0.15');
    document.body.appendChild(el);
    await tick();
    expect(el.innerHTML).toContain('#123456');
    expect(el.innerHTML).toContain('SCAN ME');
    expect(el.innerHTML).toContain('<image');
    document.body.removeChild(el);
  });

  it('renders nothing for an empty value instead of throwing', async () => {
    register();
    const el = document.createElement('rune-qr');
    document.body.appendChild(el);
    await tick();
    expect(el.innerHTML).toBe('');
    document.body.removeChild(el);
  });

  it('reports invalid input through a rune-error event instead of throwing', async () => {
    register();
    const el = document.createElement('rune-qr');
    const errors: string[] = [];
    el.addEventListener('rune-error', (e) => errors.push((e as CustomEvent<Error>).detail.message));
    el.setAttribute('value', 'X');
    el.setAttribute('ecl', 'Z');
    document.body.appendChild(el);
    await tick();
    expect(el.innerHTML).toBe('');
    expect(errors[0]).toMatch(/errorCorrectionLevel/);

    el.setAttribute('ecl', 'h'); // lowercase is accepted
    el.setAttribute('size', 'abc');
    await tick();
    expect(errors[1]).toMatch(/size/);
    document.body.removeChild(el);
  });
});
