/**
 * @kroszborg/rune — framework-agnostic QR code core.
 *
 * The encoder produces a {@link RuneMatrix}; the renderer turns that plus a
 * {@link RuneOptions} into an SVG string. Export helpers rasterize to PNG /
 * JPEG / WebP / PDF. All rendering is synchronous, DOM-free, and SSR-safe.
 */

// Encoder
export {
  alignmentPatternPositions,
  encode,
  MAX_VERSION,
  MIN_VERSION,
  numDataCodewords,
  versionSize,
} from './core/index.js';
export type { Ecl, EncodeOptions, Mode, RuneMatrix } from './core/index.js';

// Renderer + options
export { getPreset, PRESETS, renderToParts, toSVGString } from './render/index.js';
export type { SvgParts } from './render/index.js';
export type {
  BackgroundOptions,
  CornerOptions,
  DotStyle,
  Fill,
  FinderDotStyle,
  FinderSquareStyle,
  FrameOptions,
  Gradient,
  GradientStop,
  LogoOptions,
  Preset,
  PresetName,
  RenderOptions,
  RuneOptions,
} from './render/index.js';

// Browser raster export (Canvas). Node raster/PDF live in `@kroszborg/rune/node`.
export { svgDataUri, toDataURL } from './export/index.js';
export type { RasterFormat, RasterOptions } from './export/index.js';

// Payload builders (WiFi, vCard, email, …)
export * as data from './data/index.js';
