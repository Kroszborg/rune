// @vitest-environment node
import { describe, expect, it } from 'vitest';

// Guards against the regression where `class extends HTMLElement` at module
// load crashed any Node/SSR `import` of this package.
describe('SSR / Node import safety', () => {
  it('imports with no DOM present, and register() is a harmless no-op', async () => {
    expect(typeof globalThis.HTMLElement).toBe('undefined');
    const mod = await import('./index.js');
    expect(typeof mod.renderRune).toBe('function');
    expect(typeof mod.register).toBe('function');
    expect(() => mod.register()).not.toThrow();
    expect(mod.toSVGString({ value: 'x' }).startsWith('<svg')).toBe(true);
  });
});
