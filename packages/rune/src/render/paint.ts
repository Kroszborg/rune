import { el } from './svg-builder.js';
import type { Fill, Gradient } from './types.js';

/**
 * Collects gradient definitions during a render and hands out paint references
 * (`url(#id)`) or plain color strings. Ids are namespaced per render so
 * multiple QR codes can coexist on one page.
 */
export class PaintRegistry {
  private readonly defs: string[] = [];
  private counter = 0;

  constructor(private readonly idPrefix: string) {}

  /** Resolve a color/gradient to an SVG paint value. */
  resolve(fill: Fill | undefined, fallback: string): string {
    if (fill === undefined) return fallback;
    if (typeof fill === 'string') return fill;
    return this.gradient(fill);
  }

  /** Register a gradient and return its `url(#…)` reference. */
  gradient(g: Gradient): string {
    const id = `${this.idPrefix}-g${this.counter++}`;
    const stops = g.stops
      .map((s) =>
        el('stop', { offset: `${Math.round(s.offset * 1000) / 10}%`, 'stop-color': s.color }),
      )
      .join('');

    if (g.type === 'radial') {
      this.defs.push(el('radialGradient', { id, cx: '50%', cy: '50%', r: '50%' }, stops));
    } else {
      const rad = ((g.rotation ?? 0) * Math.PI) / 180;
      const x1 = 50 - Math.cos(rad) * 50;
      const y1 = 50 - Math.sin(rad) * 50;
      const x2 = 50 + Math.cos(rad) * 50;
      const y2 = 50 + Math.sin(rad) * 50;
      this.defs.push(
        el(
          'linearGradient',
          {
            id,
            x1: `${round(x1)}%`,
            y1: `${round(y1)}%`,
            x2: `${round(x2)}%`,
            y2: `${round(y2)}%`,
          },
          stops,
        ),
      );
    }
    return `url(#${id})`;
  }

  serializeDefs(): string {
    return this.defs.join('');
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
