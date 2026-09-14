import type { EclInput } from '../core/types.js';
import type { PresetName } from './presets.js';

/** Every data-module shape, in display order. */
export const DOT_STYLES = [
  'square',
  'dot',
  'rounded',
  'extra-rounded',
  'classy',
  'classy-rounded',
  'leaf',
  'diamond',
  'star',
] as const;

/** Data-module shapes. `rounded`/`extra-rounded` connect adjacent modules (fluid). */
export type DotStyle = (typeof DOT_STYLES)[number];

/** Every outer finder-ring shape. */
export const FINDER_SQUARE_STYLES = [
  'square',
  'rounded',
  'extra-rounded',
  'circle',
  'leaf',
] as const;

/** Outer 7×7 finder ring shapes. */
export type FinderSquareStyle = (typeof FINDER_SQUARE_STYLES)[number];

/** Every inner finder-block shape. */
export const FINDER_DOT_STYLES = ['square', 'rounded', 'dot'] as const;

/** Inner 3×3 finder block shapes. */
export type FinderDotStyle = (typeof FINDER_DOT_STYLES)[number];

/** Every alignment-pattern shape. */
export const ALIGNMENT_STYLES = ['square', 'rounded', 'circle', 'inherit'] as const;

/**
 * 5×5 alignment-pattern shapes (versions 2+). Decoders use these to correct
 * perspective, so they are drawn as plain, solid geometry by default rather
 * than in the data-module style. `'inherit'` styles them like the data.
 */
export type AlignmentStyle = (typeof ALIGNMENT_STYLES)[number];

/** A gradient stop; `offset` is 0–1. */
export interface GradientStop {
  offset: number;
  color: string;
}

/** A linear or radial gradient fill. Needs at least one stop. */
export interface Gradient {
  type: 'linear' | 'radial';
  /** Rotation in degrees for linear gradients. Default 0. */
  rotation?: number;
  stops: GradientStop[];
}

/** A solid color or a gradient. */
export type Fill = string | Gradient;

/** Per-position finder override: ring and/or core for one corner. */
export interface FinderCornerOptions {
  /** Inner 3×3 block. */
  dot?: { style?: FinderDotStyle; color?: string; gradient?: Gradient };
  /** Outer 7×7 ring. */
  square?: { style?: FinderSquareStyle; color?: string; gradient?: Gradient };
}

/** The three finder positions. */
export const FINDER_CORNERS = ['topLeft', 'topRight', 'bottomLeft'] as const;
export type FinderCorner = (typeof FINDER_CORNERS)[number];

export interface CornerOptions extends FinderCornerOptions {
  /** Alignment patterns (versions 2+). Default style `'square'`, color = dots. */
  alignment?: { style?: AlignmentStyle; color?: string; gradient?: Gradient };
  /** Override ring/core for the top-left finder only (falls back to `square`/`dot`). */
  topLeft?: FinderCornerOptions;
  /** Override ring/core for the top-right finder only. */
  topRight?: FinderCornerOptions;
  /** Override ring/core for the bottom-left finder only. */
  bottomLeft?: FinderCornerOptions;
}

/**
 * Center logo. With `src` the image is drawn into the SVG. Without `src` the
 * renderer still clears a plate and picks the error-correction level, so a
 * framework adapter can overlay its own element (see `SvgParts.logo`).
 */
export interface LogoOptions {
  /** Image URL: https, relative, blob:, or data:image/… */
  src?: string;
  /**
   * Size relative to the QR width, 0–0.3. Default 0.25.
   *
   * The renderer counts exactly how many codewords the logo hides in each
   * Reed–Solomon block. When `qr.errorCorrectionLevel` is unset it steps the
   * level up M → Q → H only as far as that damage requires; if even H cannot
   * absorb it (small symbols have little redundancy) the logo is shrunk to the
   * largest safe size, unless `clamp` is false.
   */
  size?: number;
  /**
   * Shrink the logo when it would exceed the safe damage budget. Default true.
   * Set false to keep the exact requested size at your own risk.
   */
  clamp?: boolean;
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
  qr?: {
    /**
     * Error correction level, any spelling (`'H'`, `'h'`, `'high'`). Default
     * `'M'`, or the lowest level that covers the logo.
     */
    errorCorrectionLevel?: EclInput;
    /** Pin a symbol version 1–40 (default: smallest that fits). */
    version?: number;
    /** Pin a mask pattern 0–7 (default: lowest penalty). */
    mask?: number;
    /** Emit a UTF-8 ECI header for non-ASCII text. Default `false`. */
    eci?: boolean;
    /** Raise the level for free when the version has room. Default `true`. */
    boostEcl?: boolean;
    /** Use Kanji mode for Shift_JIS text (smaller symbols). Default `true`. */
    kanji?: boolean;
  };
  /** Named preset applied as a base (explicit options win). Unknown names throw. */
  preset?: PresetName | (string & {});
  /**
   * Accessible label. Defaults to `QR code: {value}` for short http(s) URLs
   * and to plain `QR code` otherwise, so WiFi passwords and long payloads are
   * not read aloud by screen readers.
   */
  ariaLabel?: string;
  /** Tooltip / `<title>` element inside the SVG. Omitted by default. */
  title?: string;
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
