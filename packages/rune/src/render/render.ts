import { encode, normalizeEcl } from '../core/qr.js';
import { alignmentPatternPositions } from '../core/tables.js';
import type { Ecl, RuneMatrix } from '../core/types.js';
import {
  type Neighbours,
  alignmentPath,
  dataModulePath,
  finderDotPath,
  finderRingPath,
} from './geometry.js';
import { PaintRegistry } from './paint.js';
import { PRESETS, getPreset } from './presets.js';
import { el, escapeText, textEl } from './svg-builder.js';
import {
  ALIGNMENT_STYLES,
  type AlignmentStyle,
  type BackgroundOptions,
  DEFAULTS,
  DOT_STYLES,
  FINDER_CORNERS,
  FINDER_DOT_STYLES,
  FINDER_SQUARE_STYLES,
  type FinderCornerOptions,
  type FinderDotStyle,
  type FinderSquareStyle,
  type Gradient,
  type LogoOptions,
  type RuneOptions,
} from './types.js';

const SAFE_IMAGE_SRC = /^(https?:|blob:|data:image\/|\/|\.\/|\.\.\/)/i;

/** Options to {@link toSVGString}, plus an optional id namespace for gradients. */
export interface RenderOptions extends RuneOptions {
  /**
   * Namespace for generated element ids (gradient defs). Defaults to a hash of
   * the options when a gradient is present. Set per instance when rendering
   * several identical QR codes on one page.
   */
  idPrefix?: string;
  /** @deprecated Use `idPrefix`. Adapters treat `id` as the DOM id. */
  id?: string;
}

/** Where the logo sits, in the root SVG's viewBox coordinates. */
export interface LogoBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The pieces needed to build an `<svg>` in any framework. */
export interface SvgParts {
  /** Attributes for the root `<svg>` element (SVG attribute names). */
  attributes: Record<string, string | number | undefined>;
  /** Inner markup (defs + shapes), safe to inject as innerHTML. */
  body: string;
  width: number;
  height: number;
  /**
   * The cleared logo area when `logo` is set (frame offset included), so an
   * adapter can overlay its own element exactly where the modules were hidden.
   */
  logo?: LogoBox;
  /** The encoded symbol's version (1–40). */
  version: number;
  /** The error-correction level actually used. */
  ecl: Ecl;
}

/**
 * Render a QR code to a standalone SVG markup string. Synchronous, DOM-free,
 * and SSR/edge-safe. Throws when `value` is empty or too long to encode.
 */
export function toSVGString(options: RenderOptions): string {
  const { attributes, body } = renderToParts(options);
  return el('svg', attributes, body);
}

/**
 * Render a QR code to its constituent SVG parts. Framework adapters use this
 * to build a real `<svg>` element (rather than injecting a string).
 */
export function renderToParts(options: RenderOptions): SvgParts {
  const o = mergeOptions(options);

  // A centre logo hides part of the code. Rather than forcing ECL 'H' (which
  // makes the symbol denser and often *harder* to scan), encode at the
  // requested level and count exactly how many codewords per Reed–Solomon
  // block the logo would damage; step up M → Q → H only while it is too many,
  // and finally shrink the logo if even 'H' cannot absorb it.
  const logoReq = resolveLogoRequest(o.logo);
  const pinnedEcl = o.qr?.errorCorrectionLevel
    ? normalizeEcl(o.qr.errorCorrectionLevel)
    : undefined;
  const encodeAt = (ecl: Ecl | undefined): RuneMatrix =>
    encode(o.value, {
      errorCorrectionLevel: ecl,
      version: o.qr?.version,
      mask: o.qr?.mask,
      eci: o.qr?.eci,
      boostEcl: o.qr?.boostEcl,
      kanji: o.qr?.kanji,
    });

  const size = o.size;
  const margin = o.margin;
  let matrix = encodeAt(pinnedEcl);
  let logo: ResolvedLogo | undefined;
  if (logoReq) {
    const candidates: Ecl[] = pinnedEcl ? [pinnedEcl] : ['M', 'Q', 'H'];
    for (let i = 0; i < candidates.length; i++) {
      if (i > 0) {
        // A higher level may no longer fit the data (or a pinned version);
        // keep the previous level's shrunk fit rather than failing a render
        // that works without the logo.
        let next: RuneMatrix;
        try {
          next = encodeAt(candidates[i]);
        } catch {
          break;
        }
        matrix = next;
      }
      logo = fitLogo(logoReq, matrix, size, margin);
      if (!logo.shrunk) break;
    }
  }

  // Only namespace gradient ids by a hash when a gradient is actually present
  // (ids are otherwise never referenced), keeping the common no-gradient path
  // free of a per-render JSON.stringify.
  const idPrefix = options.idPrefix ?? options.id ?? (hasGradient(o) ? hashOptions(o) : 'rune');
  const paint = new PaintRegistry(idPrefix);

  const count = matrix.size;
  const cell = size / (count + margin * 2);
  const off = margin * cell;

  const parts: string[] = [];

  // 1) Background.
  const bg = resolveBackground(o.background);
  if (bg.image) {
    parts.push(
      el('image', {
        href: sanitizeSrc(bg.image) ?? '',
        x: 0,
        y: 0,
        width: size,
        height: size,
        preserveAspectRatio: 'xMidYMid slice',
      }),
    );
  } else if (bg.color && bg.color !== 'transparent') {
    parts.push(
      el('rect', {
        x: 0,
        y: 0,
        width: size,
        height: size,
        fill: paint.resolve(bg.gradient, bg.color),
      }),
    );
  } else if (bg.gradient) {
    parts.push(
      el('rect', { x: 0, y: 0, width: size, height: size, fill: paint.gradient(bg.gradient) }),
    );
  }

  // 2) The logo (resolved above) clears modules under its plate.
  const inFinder = (x: number, y: number): boolean =>
    (x < 7 && y < 7) || (x >= count - 7 && y < 7) || (x < 7 && y >= count - 7);

  // Alignment patterns are drawn as their own solid shapes (step 4) unless the
  // caller opts into styling them like data.
  const alignStyle: AlignmentStyle = o.corners?.alignment?.style ?? 'square';
  const alignCenters = alignStyle === 'inherit' ? [] : alignmentCenters(matrix.version);
  const inAlignment = (x: number, y: number): boolean => {
    for (const [ax, ay] of alignCenters) {
      if (Math.abs(x - ax) <= 2 && Math.abs(y - ay) <= 2) return true;
    }
    return false;
  };

  // Precompute which modules are drawable in one pass, so the emit loop below
  // reads neighbours from the grid instead of re-running the checks ~5× each.
  const grid: boolean[][] = new Array(count);
  for (let y = 0; y < count; y++) {
    const row: boolean[] = new Array(count);
    for (let x = 0; x < count; x++) {
      row[x] =
        !!matrix.modules[y]![x] &&
        !inFinder(x, y) &&
        !inAlignment(x, y) &&
        !(logo?.hideDots && logo.covers(x, y));
    }
    grid[y] = row;
  }
  const drawable = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < count && y < count && grid[y]![x]!;

  // 3) Data modules (single combined path per fill).
  const dotStyle = o.dots?.style ?? DEFAULTS.dotStyle;
  let dataPath = '';
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (!grid[y]![x]) continue;
      const nb: Neighbours = {
        n: drawable(x, y - 1),
        s: drawable(x, y + 1),
        e: drawable(x + 1, y),
        w: drawable(x - 1, y),
      };
      dataPath += dataModulePath(dotStyle, off + x * cell, off + y * cell, cell, nb);
    }
  }
  const dataFill = paint.resolve(
    o.dots?.gradient ?? o.dots?.color,
    o.dots?.color ?? DEFAULTS.dotColor,
  );
  if (dataPath) {
    parts.push(el('path', { d: dataPath, fill: dataFill }));
  }

  // 4) Alignment patterns (solid ring + centre, one path).
  if (alignCenters.length) {
    let alignPath = '';
    for (const [ax, ay] of alignCenters) {
      // A logo plate over the centre pattern hides it like the data around it.
      if (logo?.hideDots && logo.covers(ax, ay)) continue;
      alignPath += alignmentPath(
        alignStyle as Exclude<AlignmentStyle, 'inherit'>,
        off + (ax - 2) * cell,
        off + (ay - 2) * cell,
        cell,
      );
    }
    if (alignPath) {
      const a = o.corners?.alignment;
      const fill =
        a?.gradient || a?.color
          ? paint.resolve(a.gradient ?? a.color, a.color ?? DEFAULTS.dotColor)
          : dataFill;
      parts.push(el('path', { d: alignPath, fill, 'fill-rule': 'evenodd' }));
    }
  }

  // 5) Finder patterns: shared style, optionally overridden per corner.
  const finderCorners: Array<[number, number]> = [
    [0, 0],
    [count - 7, 0],
    [0, count - 7],
  ];
  for (let i = 0; i < 3; i++) {
    const [fx, fy] = finderCorners[i]!;
    const override = o.corners?.[FINDER_CORNERS[i]!];
    const square = { ...o.corners?.square, ...compact(override?.square) };
    const dot = { ...o.corners?.dot, ...compact(override?.dot) };
    const finder = resolveFinderStyles({ square, dot });
    const ringFill = paint.resolve(
      square.gradient ?? square.color,
      square.color ?? o.dots?.color ?? DEFAULTS.dotColor,
    );
    const dotFill = paint.resolve(
      dot.gradient ?? dot.color,
      dot.color ?? o.dots?.color ?? DEFAULTS.dotColor,
    );
    const px = off + fx * cell;
    const py = off + fy * cell;
    parts.push(
      el('path', {
        d: finderRingPath(finder.square, px, py, cell),
        fill: ringFill,
        'fill-rule': 'evenodd',
      }),
    );
    parts.push(el('path', { d: finderDotPath(finder.dot, px, py, cell), fill: dotFill }));
  }

  // 6) Logo plate + image.
  if (logo) parts.push(logo.markup(paint, bg));

  const inner = parts.join('');
  return buildSvgParts(o, inner, paint.serializeDefs(), size, matrix, logo?.box);
}

/** Shallow copy without `undefined` values, so they cannot mask preset values. */
function compact<T extends object>(obj: T | undefined): Partial<T> {
  const out: Partial<T> = {};
  if (!obj) return out;
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

/** Merge defaults + preset + explicit options, then validate the result. */
function mergeOptions(
  options: RenderOptions,
): Required<Pick<RuneOptions, 'value' | 'size' | 'margin'>> & RuneOptions {
  const preset = options.preset !== undefined ? getPreset(options.preset) : undefined;
  if (options.preset !== undefined && !preset) {
    throw new RangeError(
      `Rune: unknown preset ${JSON.stringify(options.preset)}; expected one of ${Object.keys(PRESETS).join(', ')}`,
    );
  }
  // Adapters often forward every declared prop, so `background: undefined`
  // must not override a preset's background (that made 'midnight' unscannable).
  const o = compact(options);
  const merged = {
    ...preset,
    ...o,
    dots: { ...preset?.dots, ...compact(o.dots) },
    corners: {
      dot: { ...preset?.corners?.dot, ...compact(o.corners?.dot) },
      square: { ...preset?.corners?.square, ...compact(o.corners?.square) },
      alignment: { ...preset?.corners?.alignment, ...compact(o.corners?.alignment) },
      ...Object.fromEntries(
        FINDER_CORNERS.filter((c) => preset?.corners?.[c] || o.corners?.[c]).map((c) => [
          c,
          {
            square: { ...preset?.corners?.[c]?.square, ...compact(o.corners?.[c]?.square) },
            dot: { ...preset?.corners?.[c]?.dot, ...compact(o.corners?.[c]?.dot) },
          },
        ]),
      ),
    },
    value: options.value,
    size: o.size ?? preset?.size ?? DEFAULTS.size,
    margin: o.margin ?? preset?.margin ?? DEFAULTS.margin,
  };
  validateOptions(merged);
  return merged;
}

function expectOneOf(name: string, value: unknown, allowed: readonly string[]): void {
  if (value !== undefined && !allowed.includes(value as string)) {
    throw new RangeError(
      `Rune: invalid ${name} ${JSON.stringify(value)}; expected one of ${allowed.join(', ')}`,
    );
  }
}

function expectNumber(
  name: string,
  value: unknown,
  min: number,
  max = Number.POSITIVE_INFINITY,
): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(
      `Rune: ${name} must be a finite number in [${min}, ${max}], got ${String(value)}`,
    );
  }
}

function expectGradient(name: string, g: Gradient | undefined): void {
  if (g === undefined) return;
  if (g.type !== 'linear' && g.type !== 'radial') {
    throw new RangeError(`Rune: ${name}.type must be 'linear' or 'radial'`);
  }
  if (!Array.isArray(g.stops) || g.stops.length === 0) {
    throw new RangeError(`Rune: ${name}.stops needs at least one stop`);
  }
  for (const s of g.stops) expectNumber(`${name}.stops[].offset`, s.offset, 0, 1);
  expectNumber(`${name}.rotation`, g.rotation, -3600, 3600);
}

/**
 * Throw a descriptive `RangeError` for any option that would otherwise produce
 * a broken SVG (NaN sizes, unknown style names, empty gradients, …). Called by
 * the renderer; exported so adapters and CLIs can validate ahead of time.
 */
export function validateOptions(o: RuneOptions): void {
  expectNumber('size', o.size, 1, 65536);
  expectNumber('margin', o.margin, 0, 64);
  expectOneOf('dots.style', o.dots?.style, DOT_STYLES);
  expectOneOf('corners.square.style', o.corners?.square?.style, FINDER_SQUARE_STYLES);
  expectOneOf('corners.dot.style', o.corners?.dot?.style, FINDER_DOT_STYLES);
  for (const c of FINDER_CORNERS) {
    expectOneOf(`corners.${c}.square.style`, o.corners?.[c]?.square?.style, FINDER_SQUARE_STYLES);
    expectOneOf(`corners.${c}.dot.style`, o.corners?.[c]?.dot?.style, FINDER_DOT_STYLES);
    expectGradient(`corners.${c}.square.gradient`, o.corners?.[c]?.square?.gradient);
    expectGradient(`corners.${c}.dot.gradient`, o.corners?.[c]?.dot?.gradient);
  }
  expectOneOf('corners.alignment.style', o.corners?.alignment?.style, ALIGNMENT_STYLES);
  expectGradient('dots.gradient', o.dots?.gradient);
  expectGradient('corners.square.gradient', o.corners?.square?.gradient);
  expectGradient('corners.dot.gradient', o.corners?.dot?.gradient);
  expectGradient('corners.alignment.gradient', o.corners?.alignment?.gradient);
  if (typeof o.background === 'object' && o.background) {
    expectGradient('background.gradient', o.background.gradient);
  }
  if (o.logo) {
    expectNumber('logo.size', o.logo.size, 0, 1);
    expectNumber('logo.margin', o.logo.margin, 0, 16);
    expectOneOf('logo.shape', o.logo.shape, ['square', 'rounded', 'circle']);
  }
  if (o.frame) {
    expectOneOf('frame.style', o.frame.style, ['none', 'square', 'rounded']);
    expectOneOf('frame.position', o.frame.position, ['bottom', 'top']);
  }
  if (o.qr) {
    if (o.qr.errorCorrectionLevel !== undefined) normalizeEcl(o.qr.errorCorrectionLevel);
    expectNumber('qr.version', o.qr.version, 1, 40);
    expectNumber('qr.mask', o.qr.mask, 0, 7);
  }
}

/** True when any element uses a gradient fill (so a unique id namespace matters). */
function hasGradient(o: RuneOptions): boolean {
  return Boolean(
    o.dots?.gradient ||
      o.corners?.square?.gradient ||
      o.corners?.dot?.gradient ||
      FINDER_CORNERS.some(
        (c) => o.corners?.[c]?.square?.gradient || o.corners?.[c]?.dot?.gradient,
      ) ||
      o.corners?.alignment?.gradient ||
      (typeof o.background === 'object' && o.background?.gradient),
  );
}

/**
 * Share of each Reed–Solomon block's repair capacity a logo may consume. The
 * rest is kept for real-world damage: print defects, glare, a tilted camera.
 */
const LOGO_DAMAGE_BUDGET = 0.7;

/** Largest logo the renderer will place, as a fraction of the QR width. */
const LOGO_MAX_SIZE = 0.3;

/**
 * Fraction of the worst block's correctable codewords that `covers` damages.
 * Codewords are interleaved across blocks, so a compact blob touches many of
 * them; counting distinct codewords per block is what a decoder actually sees.
 */
function logoDamageRatio(matrix: RuneMatrix, covers: (x: number, y: number) => boolean): number {
  const { codewordAt, blockOf, blockCount, correctablePerBlock } = matrix.layout;
  if (correctablePerBlock === 0) return Number.POSITIVE_INFINITY;
  const touched = new Uint8Array(blockOf.length);
  const perBlock = new Uint16Array(blockCount);
  const n = matrix.size;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const cw = codewordAt[y * n + x]!;
      if (cw < 0 || touched[cw] || !covers(x, y)) continue;
      touched[cw] = 1;
      perBlock[blockOf[cw]!]!++;
    }
  }
  let worst = 0;
  for (let b = 0; b < blockCount; b++) worst = Math.max(worst, perBlock[b]!);
  return worst / correctablePerBlock;
}

/** Stable short hash of the style-affecting options, for a unique id namespace. */
function hashOptions(o: RuneOptions): string {
  const input = JSON.stringify(o);
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = (h * 33) ^ input.charCodeAt(i);
  return `rune${(h >>> 0).toString(36)}`;
}

function resolveBackground(bg: BackgroundOptions | string | undefined): BackgroundOptions {
  if (bg === undefined) return { color: DEFAULTS.backgroundColor };
  if (typeof bg === 'string') return { color: bg };
  return bg;
}

/** Apply ttsalpha-compatible finder-style defaults. */
function resolveFinderStyles(o: FinderCornerOptions): {
  square: FinderSquareStyle;
  dot: FinderDotStyle;
} {
  const square = o.square?.style ?? 'square';
  let dot = o.dot?.style;
  if (!dot) {
    if (square === 'extra-rounded') dot = 'rounded';
    else if (square === 'circle') dot = 'dot';
    else dot = 'square';
  }
  return { square, dot };
}

/** Module centres of every alignment pattern that does not overlap a finder. */
function alignmentCenters(version: number): Array<[number, number]> {
  if (version < 2) return [];
  const positions = alignmentPatternPositions(version);
  const n = positions.length;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      out.push([positions[i]!, positions[j]!]);
    }
  }
  return out;
}

function sanitizeSrc(src: string): string | undefined {
  return SAFE_IMAGE_SRC.test(src.trim()) ? src.trim() : undefined;
}

/** A validated logo request: either an image, or a bare plate for an overlay. */
interface LogoRequest {
  src?: string;
  /** Requested size, clamped to 0–LOGO_MAX_SIZE. */
  size: number;
  marginModules: number;
  hideDots: boolean;
  clamp: boolean;
  shape: NonNullable<LogoOptions['shape']>;
  background?: string;
}

function resolveLogoRequest(logo: LogoOptions | undefined): LogoRequest | undefined {
  if (!logo) return undefined;
  let src: string | undefined;
  if (logo.src !== undefined) {
    // An unsafe URL (e.g. javascript:) disables the logo entirely.
    src = sanitizeSrc(logo.src);
    if (!src) return undefined;
  }
  return {
    src,
    size: Math.min(Math.max(logo.size ?? 0.25, 0), LOGO_MAX_SIZE),
    marginModules: logo.margin ?? 1,
    hideDots: logo.hideDots ?? true,
    clamp: logo.clamp ?? true,
    shape: logo.shape ?? 'square',
    background: logo.background,
  };
}

interface ResolvedLogo {
  hideDots: boolean;
  /** Logo image box in QR-local px (before any frame offset). */
  box: LogoBox;
  /** True when the requested size had to be reduced to stay decodable. */
  shrunk: boolean;
  covers(x: number, y: number): boolean;
  markup(paint: PaintRegistry, bg: BackgroundOptions): string;
}

/**
 * Place the logo at the requested size, or at the largest smaller size whose
 * damage stays within {@link LOGO_DAMAGE_BUDGET} for this matrix.
 */
function fitLogo(req: LogoRequest, matrix: RuneMatrix, size: number, margin: number): ResolvedLogo {
  const count = matrix.size;
  const cell = size / (count + margin * 2);
  const fits = (rel: number) =>
    logoDamageRatio(matrix, logoCoverage(req, rel, cell, count, margin).covers) <=
    LOGO_DAMAGE_BUDGET;

  if (!req.clamp || fits(req.size)) return resolveLogo(req, req.size, cell, count, margin, false);

  // Binary-search the largest size that fits (about 1% resolution).
  let lo = 0;
  let hi = req.size;
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return resolveLogo(req, lo, cell, count, margin, true);
}

/** Geometry of the logo + plate at relative size `rel`, and its module coverage test. */
function logoCoverage(req: LogoRequest, rel: number, cell: number, count: number, margin: number) {
  const size = cell * (count + margin * 2);
  const logoPx = size * rel;
  // Only the plate clears modules; with `hideDots: false` just the image covers.
  const clearHalf = logoPx / 2 + (req.hideDots ? req.marginModules * cell : 0);
  const center = margin * cell + (count * cell) / 2;
  const { shape } = req;
  const covers = (x: number, y: number): boolean => {
    if (logoPx <= 0) return false;
    const mcx = margin * cell + (x + 0.5) * cell;
    const mcy = margin * cell + (y + 0.5) * cell;
    // Match the plate shape so no dots are stranded outside a circular plate.
    if (shape === 'circle') return Math.hypot(mcx - center, mcy - center) <= clearHalf;
    return Math.abs(mcx - center) <= clearHalf && Math.abs(mcy - center) <= clearHalf;
  };
  return { logoPx, clearHalf, center, covers };
}

function resolveLogo(
  req: LogoRequest,
  rel: number,
  cell: number,
  count: number,
  margin: number,
  shrunk: boolean,
): ResolvedLogo {
  const { logoPx, clearHalf, center, covers } = logoCoverage(req, rel, cell, count, margin);
  const { shape, hideDots, src } = req;

  const box: LogoBox = {
    x: center - logoPx / 2,
    y: center - logoPx / 2,
    width: logoPx,
    height: logoPx,
  };

  const markup = (paint: PaintRegistry, bg: BackgroundOptions): string => {
    let out = '';
    if (hideDots && logoPx > 0) {
      const plateSize = clearHalf * 2;
      const plateX = center - clearHalf;
      const plateY = center - clearHalf;
      const plateFill = req.background ?? bg.color ?? DEFAULTS.backgroundColor;
      if (plateFill !== 'transparent') {
        const r = shape === 'circle' ? plateSize / 2 : shape === 'rounded' ? cell * 1.5 : 0;
        out += el('rect', {
          x: plateX,
          y: plateY,
          width: plateSize,
          height: plateSize,
          rx: r,
          ry: r,
          fill: plateFill,
        });
      }
    }
    if (src && logoPx > 0) {
      out += el('image', {
        href: src,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        preserveAspectRatio: 'xMidYMid meet',
      });
    }
    return out;
  };

  return { hideDots, box, shrunk, covers, markup };
}

/**
 * Default accessible name. Short http(s) URLs are useful to announce; anything
 * else (WiFi credentials, vCards, long payloads) is not read aloud.
 */
function defaultAriaLabel(value: string): string {
  return /^https?:\/\//i.test(value) && value.length <= 200 ? `QR code: ${value}` : 'QR code';
}

/** Longest CTA label the frame band will attempt to lay out. */
const MAX_CTA_CHARS = 64;
/** Average advance of a bold sans-serif glyph, as a fraction of font size. */
const CTA_GLYPH_EM = 0.66;
const CTA_TRACKING_EM = 0.12;

/**
 * Fit CTA text into `available` px: shrink the font down to a floor, then
 * ellipsise. Returns the text to draw and the font size.
 */
function fitCtaText(
  text: string,
  band: number,
  available: number,
): { text: string; fontSize: number } {
  let label = Array.from(text.trim());
  if (label.length > MAX_CTA_CHARS) label = [...label.slice(0, MAX_CTA_CHARS - 1), '…'];
  const widthAt = (chars: number, fs: number) =>
    fs * (chars * CTA_GLYPH_EM + Math.max(0, chars - 1) * CTA_TRACKING_EM);

  const maxFs = Math.round(band * 0.42);
  const minFs = Math.max(8, Math.round(band * 0.22));
  let fontSize = maxFs;
  if (widthAt(label.length, fontSize) > available) {
    fontSize = Math.max(minFs, Math.floor(available / widthAt(label.length, 1)));
  }
  if (widthAt(label.length, fontSize) > available) {
    // Still too wide at the smallest readable size: truncate with an ellipsis.
    let keep = label.length;
    while (keep > 1 && widthAt(keep + 1, fontSize) > available) keep--;
    label = [...label.slice(0, keep), '…'];
  }
  return { text: label.join(''), fontSize };
}

/** Assemble the root <svg> attributes + body, applying any frame + defs. */
function buildSvgParts(
  o: RuneOptions,
  inner: string,
  defs: string,
  size: number,
  matrix: RuneMatrix,
  logoBox: LogoBox | undefined,
): SvgParts {
  const label = o.ariaLabel ?? defaultAriaLabel(o.value);
  const frame = o.frame;
  const hasFrame = frame && ((frame.style && frame.style !== 'none') || frame.text);

  let viewW = size;
  let viewH = size;
  let contentGroup = inner;
  let logo = logoBox;

  if (hasFrame) {
    const pad = Math.round(size * 0.05);
    const band = frame.text ? Math.round(size * 0.15) : 0;
    viewW = size + pad * 2;
    viewH = size + pad * 2 + band;
    const topBand = frame.position === 'top' ? band : 0;
    const qx = pad;
    const qy = pad + topBand;
    const frameColor = frame.color ?? DEFAULTS.dotColor;
    const drawBorder = frame.style !== undefined && frame.style !== 'none';
    const r = frame.style === 'rounded' ? Math.round(size * 0.06) : 0;

    // Draw the border only when a border style is requested; text alone
    // (style 'none' or unset) renders just the CTA band.
    let framed = drawBorder
      ? el('rect', {
          x: 2,
          y: 2,
          width: viewW - 4,
          height: viewH - 4,
          rx: r,
          ry: r,
          fill: 'none',
          stroke: frameColor,
          'stroke-width': Math.max(2, Math.round(size * 0.012)),
        })
      : '';
    if (frame.text) {
      const ty = frame.position === 'top' ? pad + band / 2 : size + pad + band / 2;
      const fitted = fitCtaText(frame.text, band, viewW - pad * 2);
      framed += textEl(
        {
          x: viewW / 2,
          y: ty,
          fill: frame.textColor ?? frameColor,
          'font-family': frame.font ?? 'ui-sans-serif, system-ui, sans-serif',
          'font-size': fitted.fontSize,
          'font-weight': 700,
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          'letter-spacing': `${CTA_TRACKING_EM}em`,
        },
        fitted.text,
      );
    }
    contentGroup = `<g transform="translate(${qx},${qy})">${inner}</g>${framed}`;
    if (logo) logo = { ...logo, x: logo.x + qx, y: logo.y + qy };
  }

  const svgAttrs: Record<string, string | number | undefined> = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: viewW,
    height: viewH,
    viewBox: `0 0 ${viewW} ${viewH}`,
    role: 'img',
    // Not pre-escaped: el()/attrsToString escapes every attribute value once.
    'aria-label': label,
    class: o.className,
    'data-rune-version': matrix.version,
  };

  const title = o.title ? `<title>${escapeText(o.title)}</title>` : '';
  const body = title + (defs ? `<defs>${defs}</defs>` : '') + contentGroup;
  return {
    attributes: svgAttrs,
    body,
    width: viewW,
    height: viewH,
    logo,
    version: matrix.version,
    ecl: matrix.ecl,
  };
}
