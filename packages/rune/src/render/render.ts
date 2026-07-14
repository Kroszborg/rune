import { encode } from '../core/qr.js';
import type { Ecl, RuneMatrix } from '../core/types.js';
import { type Neighbours, dataModulePath, finderDotPath, finderRingPath } from './geometry.js';
import { PaintRegistry } from './paint.js';
import { getPreset } from './presets.js';
import { el, textEl } from './svg-builder.js';
import {
  type BackgroundOptions,
  DEFAULTS,
  type FinderDotStyle,
  type FinderSquareStyle,
  type RuneOptions,
} from './types.js';

const SAFE_IMAGE_SRC = /^(https?:|blob:|data:image\/|\/|\.\/|\.\.\/)/i;

/** Options to {@link toSVGString}, plus an optional id namespace for gradients. */
export interface RenderOptions extends RuneOptions {
  /** Namespace for generated element ids. Default `'rune'`. Set per instance
   *  when rendering several QR codes on one page. */
  id?: string;
}

/** The pieces needed to build an `<svg>` in any framework. */
export interface SvgParts {
  /** Attributes for the root `<svg>` element (SVG attribute names). */
  attributes: Record<string, string | number | undefined>;
  /** Inner markup (defs + shapes), safe to inject as innerHTML. */
  body: string;
  width: number;
  height: number;
}

/**
 * Render a QR code to a standalone SVG markup string. Synchronous, DOM-free,
 * and SSR/edge-safe.
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

  // A center logo clears part of the code, so it needs error-correction
  // headroom: when the caller hasn't chosen an ECL, default to 'H' so the
  // result stays scannable.
  const logoSrc = o.logo?.src ? sanitizeSrc(o.logo.src) : undefined;
  const matrix = encode(o.value, {
    errorCorrectionLevel: o.qr?.errorCorrectionLevel ?? (logoSrc ? 'H' : undefined),
    version: o.qr?.version,
    mask: o.qr?.mask,
  });

  // Only namespace gradient ids by a hash when a gradient is actually present
  // (ids are otherwise never referenced), keeping the common no-gradient path
  // free of a per-render JSON.stringify.
  const idPrefix = options.id ?? (hasGradient(o) ? hashOptions(o) : 'rune');
  const paint = new PaintRegistry(idPrefix);

  const count = matrix.size;
  const size = o.size;
  const margin = o.margin;
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

  // 2) Logo clear-area (used both to hide dots and to size the plate).
  const logo = o.logo?.src ? resolveLogo(o, size, cell, count, margin, matrix.ecl) : undefined;

  const inFinder = (x: number, y: number): boolean =>
    (x < 7 && y < 7) || (x >= count - 7 && y < 7) || (x < 7 && y >= count - 7);

  // Precompute which modules are drawable in one pass, so the emit loop below
  // reads neighbours from the grid instead of re-running the checks ~5× each.
  const grid: boolean[][] = new Array(count);
  for (let y = 0; y < count; y++) {
    const row: boolean[] = new Array(count);
    for (let x = 0; x < count; x++) {
      row[x] = !!matrix.modules[y]![x] && !inFinder(x, y) && !(logo?.hideDots && logo.covers(x, y));
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
  if (dataPath) {
    parts.push(
      el('path', {
        d: dataPath,
        fill: paint.resolve(o.dots?.gradient ?? o.dots?.color, o.dots?.color ?? DEFAULTS.dotColor),
      }),
    );
  }

  // 4) Finder patterns (three corners, shared style).
  const finder = resolveFinderStyles(o);
  const ringFill = paint.resolve(
    o.corners?.square?.gradient ?? o.corners?.square?.color,
    o.corners?.square?.color ?? o.dots?.color ?? DEFAULTS.dotColor,
  );
  const dotFill = paint.resolve(
    o.corners?.dot?.gradient ?? o.corners?.dot?.color,
    o.corners?.dot?.color ?? o.dots?.color ?? DEFAULTS.dotColor,
  );
  const finderCorners: Array<[number, number]> = [
    [0, 0],
    [count - 7, 0],
    [0, count - 7],
  ];
  for (const [fx, fy] of finderCorners) {
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

  // 5) Logo plate + image.
  if (logo) parts.push(logo.markup(paint, bg));

  const inner = parts.join('');
  return buildSvgParts(o, inner, paint.serializeDefs(), size, matrix);
}

/** Merge defaults + preset + explicit options. */
function mergeOptions(
  options: RenderOptions,
): Required<Pick<RuneOptions, 'value' | 'size' | 'margin'>> & RuneOptions {
  const preset = options.preset ? getPreset(options.preset) : undefined;
  return {
    ...preset,
    ...options,
    dots: { ...preset?.dots, ...options.dots },
    corners: {
      dot: { ...preset?.corners?.dot, ...options.corners?.dot },
      square: { ...preset?.corners?.square, ...options.corners?.square },
    },
    value: options.value,
    size: options.size ?? preset?.size ?? DEFAULTS.size,
    margin: options.margin ?? preset?.margin ?? DEFAULTS.margin,
  };
}

/** True when any element uses a gradient fill (so a unique id namespace matters). */
function hasGradient(o: RuneOptions): boolean {
  return Boolean(
    o.dots?.gradient ||
      o.corners?.square?.gradient ||
      o.corners?.dot?.gradient ||
      (typeof o.background === 'object' && o.background?.gradient),
  );
}

/** Max logo size (fraction of width) that stays scannable at each ECL. */
const ECL_LOGO_MAX: Record<Ecl, number> = { L: 0.15, M: 0.2, Q: 0.25, H: 0.3 };

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
function resolveFinderStyles(o: RuneOptions): { square: FinderSquareStyle; dot: FinderDotStyle } {
  const square = o.corners?.square?.style ?? 'square';
  let dot = o.corners?.dot?.style;
  if (!dot) {
    if (square === 'extra-rounded') dot = 'rounded';
    else if (square === 'circle') dot = 'dot';
    else dot = 'square';
  }
  return { square, dot };
}

function sanitizeSrc(src: string): string | undefined {
  return SAFE_IMAGE_SRC.test(src.trim()) ? src.trim() : undefined;
}

interface ResolvedLogo {
  hideDots: boolean;
  covers(x: number, y: number): boolean;
  markup(paint: PaintRegistry, bg: BackgroundOptions): string;
}

function resolveLogo(
  o: RuneOptions,
  size: number,
  cell: number,
  count: number,
  margin: number,
  ecl: Ecl,
): ResolvedLogo | undefined {
  const src = o.logo?.src ? sanitizeSrc(o.logo.src) : undefined;
  if (!src) return undefined;
  // Clamp to the largest size that stays scannable at the chosen ECL.
  const rel = Math.min(Math.max(o.logo?.size ?? 0.25, 0), ECL_LOGO_MAX[ecl]);
  const logoPx = size * rel;
  const marginModules = o.logo?.margin ?? 1;
  const clearHalf = logoPx / 2 + marginModules * cell;
  const center = margin * cell + (count * cell) / 2;
  const shape = o.logo?.shape ?? 'square';
  const hideDots = o.logo?.hideDots ?? true;

  const covers = (x: number, y: number): boolean => {
    const mcx = margin * cell + (x + 0.5) * cell;
    const mcy = margin * cell + (y + 0.5) * cell;
    // Match the plate shape so no dots are stranded outside a circular plate.
    if (shape === 'circle') return Math.hypot(mcx - center, mcy - center) <= clearHalf;
    return Math.abs(mcx - center) <= clearHalf && Math.abs(mcy - center) <= clearHalf;
  };

  const markup = (paint: PaintRegistry, bg: BackgroundOptions): string => {
    let out = '';
    if (hideDots) {
      const plateSize = clearHalf * 2;
      const plateX = center - clearHalf;
      const plateY = center - clearHalf;
      const plateFill = o.logo?.background ?? bg.color ?? DEFAULTS.backgroundColor;
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
    out += el('image', {
      href: src,
      x: center - logoPx / 2,
      y: center - logoPx / 2,
      width: logoPx,
      height: logoPx,
      preserveAspectRatio: 'xMidYMid meet',
    });
    return out;
  };

  return { hideDots, covers, markup };
}

/** Assemble the root <svg> attributes + body, applying any frame + defs. */
function buildSvgParts(
  o: RuneOptions,
  inner: string,
  defs: string,
  size: number,
  matrix: RuneMatrix,
): SvgParts {
  const label = o.ariaLabel ?? `QR code: ${o.value}`;
  const frame = o.frame;
  const hasFrame = frame && ((frame.style && frame.style !== 'none') || frame.text);

  let viewW = size;
  let viewH = size;
  let contentGroup = inner;

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
      framed += textEl(
        {
          x: viewW / 2,
          y: ty,
          fill: frame.textColor ?? frameColor,
          'font-family': frame.font ?? 'ui-sans-serif, system-ui, sans-serif',
          'font-size': Math.round(band * 0.42),
          'font-weight': 700,
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          'letter-spacing': '0.12em',
        },
        frame.text,
      );
    }
    contentGroup = `<g transform="translate(${qx},${qy})">${inner}</g>${framed}`;
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

  const body = (defs ? `<defs>${defs}</defs>` : '') + contentGroup;
  return { attributes: svgAttrs, body, width: viewW, height: viewH };
}
