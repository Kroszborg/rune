import { describe, expect, it } from 'vitest';
import { parseArgs } from './args.js';

describe('parseArgs', () => {
  it('returns help with no args', () => {
    expect(parseArgs([]).command).toBe('help');
    expect(parseArgs(['-h']).command).toBe('help');
  });

  it('parses a value and output', () => {
    const p = parseArgs(['https://x.com', '-o', 'qr.png']);
    expect(p.command).toBe('generate');
    expect(p.value).toBe('https://x.com');
    expect(p.output).toBe('qr.png');
  });

  it('maps style flags into options', () => {
    const p = parseArgs([
      'HELLO',
      '--dots',
      'rounded',
      '--square',
      'leaf',
      '--ecl',
      'h',
      '--size',
      '512',
    ]);
    expect(p.options.dots?.style).toBe('rounded');
    expect(p.options.corners?.square?.style).toBe('leaf');
    expect(p.options.qr?.errorCorrectionLevel).toBe('H');
    expect(p.options.size).toBe(512);
  });

  it('parses a gradient flag', () => {
    const p = parseArgs(['X', '--gradient', '#000,#fff,90']);
    expect(p.options.dots?.gradient).toEqual({
      type: 'linear',
      rotation: 90,
      stops: [
        { offset: 0, color: '#000' },
        { offset: 1, color: '#fff' },
      ],
    });
  });

  it('joins multi-word positional values', () => {
    expect(parseArgs(['HELLO', 'WORLD']).value).toBe('HELLO WORLD');
  });
});
