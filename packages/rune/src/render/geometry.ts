import type { DotStyle, FinderDotStyle, FinderSquareStyle } from './types.js';

/** Rounded-corner flags for a rectangle. */
interface Corners {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

/** Corners with the same radius on all four sides. */
const uniform = (n: number): Corners => ({ tl: n, tr: n, br: n, bl: n });

const f = (n: number) => Math.round(n * 1000) / 1000;

/** SVG path data for a rectangle with per-corner radii. */
export function roundedRectPath(x: number, y: number, w: number, h: number, c: Corners): string {
  const max = Math.min(w, h) / 2;
  const tl = Math.min(c.tl, max);
  const tr = Math.min(c.tr, max);
  const br = Math.min(c.br, max);
  const bl = Math.min(c.bl, max);
  return (
    `M${f(x + tl)},${f(y)}` +
    `H${f(x + w - tr)}` +
    (tr ? `A${f(tr)},${f(tr)} 0 0 1 ${f(x + w)},${f(y + tr)}` : '') +
    `V${f(y + h - br)}` +
    (br ? `A${f(br)},${f(br)} 0 0 1 ${f(x + w - br)},${f(y + h)}` : '') +
    `H${f(x + bl)}` +
    (bl ? `A${f(bl)},${f(bl)} 0 0 1 ${f(x)},${f(y + h - bl)}` : '') +
    `V${f(y + tl)}` +
    (tl ? `A${f(tl)},${f(tl)} 0 0 1 ${f(x + tl)},${f(y)}` : '') +
    'Z'
  );
}

/** SVG path data for a circle (via two arcs). */
export function circlePath(cx: number, cy: number, r: number): string {
  return `M${f(cx - r)},${f(cy)}a${f(r)},${f(r)} 0 1,0 ${f(r * 2)},0a${f(r)},${f(r)} 0 1,0 ${f(-r * 2)},0Z`;
}

function diamondPath(x: number, y: number, s: number): string {
  const h = s / 2;
  return `M${f(x + h)},${f(y)}L${f(x + s)},${f(y + h)}L${f(x + h)},${f(y + s)}L${f(x)},${f(y + h)}Z`;
}

function starPath(x: number, y: number, s: number): string {
  const cx = x + s / 2;
  const cy = y + s / 2;
  const outer = s / 2;
  const inner = outer * 0.42;
  let d = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    d += `${i === 0 ? 'M' : 'L'}${f(px)},${f(py)}`;
  }
  return `${d}Z`;
}

/**
 * Neighbour flags for fluid ("rounded"/"classy") data modules. Each is `true`
 * when the adjacent module is also drawn.
 */
export interface Neighbours {
  n: boolean;
  s: boolean;
  e: boolean;
  w: boolean;
}

/** SVG path for a single data module of the given style. */
export function dataModulePath(
  style: DotStyle,
  x: number,
  y: number,
  cell: number,
  nb: Neighbours,
): string {
  switch (style) {
    case 'square':
      return roundedRectPath(x, y, cell, cell, uniform(0));
    case 'dot':
      return circlePath(x + cell / 2, y + cell / 2, cell / 2);
    case 'diamond':
      return diamondPath(x, y, cell);
    case 'star':
      return starPath(x, y, cell);
    case 'rounded': {
      const r = cell / 2;
      return roundedRectPath(x, y, cell, cell, {
        tl: !nb.n && !nb.w ? r : 0,
        tr: !nb.n && !nb.e ? r : 0,
        br: !nb.s && !nb.e ? r : 0,
        bl: !nb.s && !nb.w ? r : 0,
      });
    }
    case 'classy': {
      const r = cell * 0.5;
      // Round only the two "free" diagonal corners for an engraved, classy feel.
      return roundedRectPath(x, y, cell, cell, {
        tl: !nb.n && !nb.w ? r : 0,
        tr: 0,
        br: !nb.s && !nb.e ? r : 0,
        bl: 0,
      });
    }
  }
}

/** Corner radii for the outer finder ring, in cell units. */
function finderSquareCorners(style: FinderSquareStyle, cell: number): Corners {
  switch (style) {
    case 'square':
      return uniform(0);
    case 'rounded':
      return uniform(cell);
    case 'extra-rounded':
      return uniform(cell * 2);
    case 'leaf':
      return { tl: cell * 2.5, tr: 0, br: cell * 2.5, bl: 0 };
    case 'circle':
      return uniform(cell * 3.5);
  }
}

/**
 * Outer 7×7 finder ring as an even-odd path (outer shape minus inner hole).
 * `x`,`y` is the top-left of the 7×7 block in px; `cell` is module size.
 */
export function finderRingPath(
  style: FinderSquareStyle,
  x: number,
  y: number,
  cell: number,
): string {
  const size = cell * 7;
  const outer = finderSquareCorners(style, cell);
  // Inner hole sits one module in on every side (a 5×5 area).
  const innerStyle: FinderSquareStyle =
    style === 'square' ? 'square' : style === 'circle' ? 'circle' : 'rounded';
  const innerCorners = finderSquareCorners(innerStyle, cell);
  const scale = innerStyle === 'circle' ? 2.5 / 3.5 : 0.7;
  const inner: Corners = {
    tl: innerCorners.tl * scale,
    tr: innerCorners.tr * scale,
    br: innerCorners.br * scale,
    bl: innerCorners.bl * scale,
  };
  const outerPath = roundedRectPath(x, y, size, size, outer);
  const innerPath = roundedRectPath(x + cell, y + cell, cell * 5, cell * 5, inner);
  return `${outerPath}${innerPath}`;
}

/** Inner 3×3 finder block path. */
export function finderDotPath(style: FinderDotStyle, x: number, y: number, cell: number): string {
  const px = x + cell * 2;
  const py = y + cell * 2;
  const size = cell * 3;
  switch (style) {
    case 'square':
      return roundedRectPath(px, py, size, size, uniform(0));
    case 'rounded':
      return roundedRectPath(px, py, size, size, uniform(cell));
    case 'dot':
      return circlePath(px + size / 2, py + size / 2, size / 2);
  }
}
