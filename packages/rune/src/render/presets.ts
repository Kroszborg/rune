import type { RuneOptions } from './types.js';

/** A preset is a partial set of style options applied as a base. */
export type Preset = Partial<Omit<RuneOptions, 'value'>>;

/** Built-in named presets shown in the docs gallery. */
export const PRESETS: Record<string, Preset> = {
  minimal: {
    dots: { style: 'square', color: '#0b0b0f' },
    background: '#ffffff',
  },
  dots: {
    dots: { style: 'dot', color: '#0b0b0f' },
    corners: { square: { style: 'extra-rounded' }, dot: { style: 'dot' } },
    background: '#ffffff',
  },
  fluid: {
    dots: { style: 'rounded', color: '#111827' },
    corners: { square: { style: 'extra-rounded' }, dot: { style: 'rounded' } },
    background: '#ffffff',
  },
  mint: {
    // Kept minty but dark enough to stay high-contrast + scannable on white.
    dots: {
      style: 'rounded',
      gradient: {
        type: 'linear',
        rotation: 45,
        stops: [
          { offset: 0, color: '#0b6b4f' },
          { offset: 1, color: '#127a5c' },
        ],
      },
    },
    corners: {
      square: { style: 'extra-rounded', color: '#0b6b4f' },
      dot: { style: 'dot', color: '#127a5c' },
    },
    background: '#ffffff',
  },
  midnight: {
    dots: { style: 'rounded', color: '#e6e6ea' },
    corners: {
      square: { style: 'rounded', color: '#54d6a6' },
      dot: { style: 'rounded', color: '#54d6a6' },
    },
    background: '#0b0b0f',
  },
  sunset: {
    dots: {
      style: 'classy',
      gradient: {
        type: 'linear',
        rotation: 90,
        stops: [
          { offset: 0, color: '#f0686a' },
          { offset: 1, color: '#f4a259' },
        ],
      },
    },
    corners: { square: { style: 'leaf' }, dot: { style: 'rounded' } },
    background: '#fffdfb',
  },
};

/** Preset names, for docs/typing. */
export type PresetName = keyof typeof PRESETS;

export function getPreset(name: string): Preset | undefined {
  return PRESETS[name];
}
