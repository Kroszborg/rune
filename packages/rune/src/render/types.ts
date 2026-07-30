import type { Ecl } from '../core/types.js';

/** Data-module shapes. `rounded`/`extra-rounded` connect adjacent modules (fluid). */
export type DotStyle =
  | 'square'
  | 'dot'
  | 'rounded'
  | 'extra-rounded'
  | 'classy'
  | 'classy-rounded'
  | 'leaf'
  | 'diamond'
  | 'star';

/** Outer 7×7 finder ring shapes. */
export type FinderSquareStyle = 'square' | 'rounded' | 'extra-rounded' | 'circle' | 'leaf';

/** Inner 3×3 finder block shapes. */
export type FinderDotStyle = 'square' | 'rounded' | 'dot';

/** A gradient stop; `offset` is 0–1. */
export interface GradientStop {
  offset: number;
  color: string;
}

/** A linear or radial gradient fill. */
export interface Gradient {
  type: 'linear' | 'radial';
  /** Rotation in degrees for linear gradients. Default 0. */
  rotation?: number;
  stops: GradientStop[];
}

/** A solid color or a gradient. */
export type Fill = string | Gradient;

export interface CornerOptions {
  /** Inner 3×3 block. */
  dot?: { style?: FinderDotStyle; color?: string; gradient?: Gradient };
  /** Outer 7×7 ring. */
  square?: { style?: FinderSquareStyle; color?: string; gradient?: Gradient };
}

export interface LogoOptions {
  /** Image URL: https, relative, blob:, or data:image/… */
  src?: string;
  /** Size relative to the QR width, 0–1. Default 0.25. */
  size?: number;
  /** Extra clear space (in modules) around the logo. Default 1. */
  margin?: number;
  /** Clear the data modules behind the logo. Default true. */
  hideDots?: boolean;
  /** Backing plate shape behind the logo. Default 'square'. */
  shape?: 'square' | 'rounded' | 'circle';
  /** Backing plate color. Default matches the background. */
  background?: string;
}

export interface FrameOptions {
  style?: 'none' | 'square' | 'rounded';
  /** Call-to-action label, e.g. "SCAN ME". */
  text?: string;
  textColor?: string;
  /** Frame + CTA band color. */
  color?: string;
  font?: string;
  position?: 'bottom' | 'top';
}

export interface BackgroundOptions {
  color?: string;
  gradient?: Gradient;
  /** Image URL rendered behind the modules. */
  image?: string;
}

/** Full rendering options. `value` is required; everything else has a default. */
export interface RuneOptions {
  /** Data to encode. */
  value: string;
  /** Output width/height in px. Default 256. */
  size?: number;
  /** Quiet zone in modules. Default 4. */
  margin?: number;
  /** Data-module style + fill. */
  dots?: { style?: DotStyle; color?: string; gradient?: Gradient };
  /** Finder-pattern styles + fills. */
  corners?: CornerOptions;
  /** Background color / gradient / image, or a plain color string. */
  background?: BackgroundOptions | string;
  /** Center logo. */
  logo?: LogoOptions;
  /** Outer frame + CTA text. */
  frame?: FrameOptions;
  /** QR encoding controls. */
  qr?: { errorCorrectionLevel?: Ecl; version?: number; mask?: number };
  /** Named preset applied as a base (explicit options win). */
  preset?: string;
  /** Accessible label. Defaults to `QR code: {value}`. */
  ariaLabel?: string;
  /** CSS class on the root <svg> (adapters). */
  className?: string;
}

/** Resolved default values for a `RuneOptions`. */
export const DEFAULTS = {
  size: 256,
  margin: 4,
  dotStyle: 'square' as DotStyle,
  dotColor: '#0b0b0f',
  backgroundColor: '#ffffff',
} as const;
