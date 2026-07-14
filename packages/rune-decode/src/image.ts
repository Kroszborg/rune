import { type MatrixDecodeResult, decodeMatrix } from './matrix-decode.js';

/** Minimal image input: RGBA pixel data (like `ImageData`). */
export interface ImageInput {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
  moduleSize: number;
}

/** Grayscale + Otsu threshold → a dark-module bitmap (1 = dark). */
function binarize(img: ImageInput): Uint8Array {
  const { data, width, height } = img;
  const n = width * height;
  const gray = new Uint8Array(n);
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    const v = (r * 77 + g * 150 + b * 29) >> 8;
    gray[i] = v;
    histogram[v]!++;
  }
  // Otsu's method.
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t]!;
  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += histogram[t]!;
    if (wB === 0) continue;
    const wF = n - wB;
    if (wF === 0) break;
    sumB += t * histogram[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  const dark = new Uint8Array(n);
  for (let i = 0; i < n; i++) dark[i] = gray[i]! < threshold ? 1 : 0;
  return dark;
}

/** True if 5 runs approximate the finder ratio 1:1:3:1:1. */
function matchesFinder(runs: number[]): number {
  const total = runs[0]! + runs[1]! + runs[2]! + runs[3]! + runs[4]!;
  if (total < 7) return 0;
  const m = total / 7;
  const tol = m / 2 + 0.5;
  if (
    Math.abs(runs[0]! - m) < tol &&
    Math.abs(runs[1]! - m) < tol &&
    Math.abs(runs[2]! - 3 * m) < 3 * tol &&
    Math.abs(runs[3]! - m) < tol &&
    Math.abs(runs[4]! - m) < tol
  ) {
    return m;
  }
  return 0;
}

/** Vertically confirm a finder centered near (cx, cy). */
function confirmVertical(
  dark: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
): boolean {
  const at = (x: number, y: number): boolean =>
    x >= 0 && x < width && y >= 0 && y < height && dark[y * width + x] === 1;
  if (!at(cx, cy)) return false;
  // Grow up/down through the center dark run, then the light+dark rings.
  const runs = [0, 0, 0, 0, 0];
  let y = cy;
  while (y >= 0 && at(cx, y)) {
    runs[2]!++;
    y--;
  }
  while (y >= 0 && !at(cx, y)) {
    runs[1]!++;
    y--;
  }
  while (y >= 0 && at(cx, y)) {
    runs[0]!++;
    y--;
  }
  y = cy + 1;
  while (y < height && at(cx, y)) {
    runs[2]!++;
    y++;
  }
  while (y < height && !at(cx, y)) {
    runs[3]!++;
    y++;
  }
  while (y < height && at(cx, y)) {
    runs[4]!++;
    y++;
  }
  return matchesFinder(runs) > 0;
}

/**
 * Locate finder-pattern centers via horizontal run scanning + vertical
 * confirmation, using the canonical zxing state-machine.
 */
function locateFinders(dark: Uint8Array, width: number, height: number): Point[] {
  const candidates: Point[] = [];
  for (let y = 0; y < height; y++) {
    const s = [0, 0, 0, 0, 0];
    let state = 0;
    for (let x = 0; x < width; x++) {
      const isDark = dark[y * width + x] === 1;
      if (isDark) {
        if ((state & 1) === 1) state++; // white → black boundary
        s[state]!++;
      } else if ((state & 1) === 0) {
        // Was counting black.
        if (state === 4) {
          const m = matchesFinder(s);
          if (m > 0) {
            const centerX = x - s[4]! - s[3]! - s[2]! / 2;
            if (confirmVertical(dark, width, height, Math.round(centerX), y)) {
              candidates.push({ x: centerX, y, moduleSize: m });
            }
          }
          // Shift the trailing black-white-black to the front and continue.
          s[0] = s[2]!;
          s[1] = s[3]!;
          s[2] = s[4]!;
          s[3] = 1;
          s[4] = 0;
          state = 3;
        } else {
          state++;
          s[state]!++;
        }
      } else {
        s[state]!++; // continue counting white
      }
    }
  }
  return clusterFinders(candidates);
}

function clusterFinders(points: Point[]): Point[] {
  const clusters: { x: number; y: number; moduleSize: number; n: number }[] = [];
  for (const p of points) {
    const c = clusters.find(
      (cl) =>
        Math.abs(cl.x / cl.n - p.x) < p.moduleSize * 2 &&
        Math.abs(cl.y / cl.n - p.y) < p.moduleSize * 2,
    );
    if (c) {
      c.x += p.x;
      c.y += p.y;
      c.moduleSize += p.moduleSize;
      c.n++;
    } else {
      clusters.push({ x: p.x, y: p.y, moduleSize: p.moduleSize, n: 1 });
    }
  }
  return clusters
    .filter((c) => c.n >= 2)
    .map((c) => ({ x: c.x / c.n, y: c.y / c.n, moduleSize: c.moduleSize / c.n }));
}

/**
 * Choose the three candidates that best form a QR finder arrangement: two equal
 * legs, a hypotenuse ≈ leg·√2, and similar module sizes. Guards against spurious
 * candidates from alignment/data patterns.
 */
function selectFinderTriple(cands: Point[]): Point[] | null {
  if (cands.length < 3) return null;
  if (cands.length === 3) return cands;

  let best: Point[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 0; i < cands.length; i++) {
    for (let j = i + 1; j < cands.length; j++) {
      for (let k = j + 1; k < cands.length; k++) {
        const tri = [cands[i]!, cands[j]!, cands[k]!];
        const d = [dist(tri[0]!, tri[1]!), dist(tri[0]!, tri[2]!), dist(tri[1]!, tri[2]!)].sort(
          (a, b) => a - b,
        );
        const [leg1, leg2, hyp] = d as [number, number, number];
        if (hyp === 0) continue;
        const avgLeg = (leg1 + leg2) / 2;
        const ms = tri.map((t) => t.moduleSize);
        const msSpread = (Math.max(...ms) - Math.min(...ms)) / (avgLeg > 0 ? Math.min(...ms) : 1);
        const legScore = Math.abs(leg1 - leg2) / leg2;
        const hypScore = Math.abs(hyp - avgLeg * Math.SQRT2) / hyp;
        const score = legScore + hypScore + msSpread;
        if (score < bestScore) {
          bestScore = score;
          best = tri;
        }
      }
    }
  }
  return bestScore < 0.5 ? best : null;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Order finders into [topLeft, topRight, bottomLeft]. */
function orderFinders(f: Point[]): [Point, Point, Point] | null {
  if (f.length < 3) return null;
  const [a, b, c] = f;
  const dAB = dist(a!, b!);
  const dAC = dist(a!, c!);
  const dBC = dist(b!, c!);
  // The corner (TL) is opposite the hypotenuse (largest distance).
  let tl: Point;
  let p1: Point;
  let p2: Point;
  if (dBC >= dAB && dBC >= dAC) {
    tl = a!;
    p1 = b!;
    p2 = c!;
  } else if (dAC >= dAB && dAC >= dBC) {
    tl = b!;
    p1 = a!;
    p2 = c!;
  } else {
    tl = c!;
    p1 = a!;
    p2 = b!;
  }
  // Orient: in screen coords (y down), (TR−TL)×(BL−TL) > 0 for an upright code.
  const cross = (p1.x - tl.x) * (p2.y - tl.y) - (p1.y - tl.y) * (p2.x - tl.x);
  const [tr, bl] = cross > 0 ? [p1, p2] : [p2, p1];
  return [tl, tr, bl];
}

/** Solve px = a·ux + b·uy + c for three correspondences (Cramer's rule). */
function solveAffine(u: [number, number][], p: number[]): [number, number, number] {
  const u0 = u[0]![0];
  const v0 = u[0]![1];
  const u1 = u[1]![0];
  const v1 = u[1]![1];
  const u2 = u[2]![0];
  const v2 = u[2]![1];
  const det = u0 * (v1 - v2) - v0 * (u1 - u2) + (u1 * v2 - u2 * v1);
  const a = (p[0]! * (v1 - v2) - v0 * (p[1]! - p[2]!) + (p[1]! * v2 - p[2]! * v1)) / det;
  const b = (u0 * (p[1]! - p[2]!) - p[0]! * (u1 - u2) + (u1 * p[2]! - u2 * p[1]!)) / det;
  const c =
    (u0 * (v1 * p[2]! - v2 * p[1]!) -
      v0 * (u1 * p[2]! - u2 * p[1]!) +
      p[0]! * (u1 * v2 - u2 * v1)) /
    det;
  return [a, b, c];
}

/**
 * Decode a QR code from raw RGBA pixels. Handles clean, upright (and rotated)
 * images via finder detection + affine grid sampling. Returns null if no
 * decodable symbol is found.
 */
export function decode(img: ImageInput): MatrixDecodeResult | null {
  try {
    const dark = binarize(img);
    const candidates = locateFinders(dark, img.width, img.height);
    const finders = selectFinderTriple(candidates);
    if (!finders) return null;
    const ordered = orderFinders(finders);
    if (!ordered) return null;
    const [tl, tr, bl] = ordered;

    const moduleSize = (tl.moduleSize + tr.moduleSize + bl.moduleSize) / 3;
    const est = Math.round(dist(tl, tr) / moduleSize) + 7;
    const base = Math.round((est - 21) / 4) * 4 + 21;

    // Try the estimate and a few neighbours. A wrong grid is rejected two ways:
    // the timing pattern must alternate, and decodeMatrix's Reed–Solomon check
    // must pass — so a coincidental wrong-dimension decode is not returned.
    const seen = new Set<number>();
    for (const delta of [0, 4, -4, 8, -8, 12, -12]) {
      const size = base + delta;
      if (size < 21 || size > 177 || (size - 17) % 4 !== 0 || seen.has(size)) continue;
      seen.add(size);
      try {
        const modules = sampleGrid(dark, img.width, img.height, tl, tr, bl, size);
        if (!timingPatternValid(modules, size)) continue;
        return decodeMatrix(modules);
      } catch {
        // Wrong dimension or unrecoverable at this size — try the next.
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * The timing patterns (row 6 and column 6) alternate dark/light. If a sampled
 * grid doesn't show that, the dimension/alignment is wrong — reject it before
 * trusting a possibly-coincidental Reed–Solomon decode.
 */
function timingPatternValid(modules: boolean[][], size: number): boolean {
  let mismatches = 0;
  const budget = Math.floor((size - 16) * 0.1); // tolerate a little sampling noise
  for (let i = 8; i < size - 8; i++) {
    const expected = i % 2 === 0;
    if (modules[6]![i] !== expected) mismatches++;
    if (modules[i]![6] !== expected) mismatches++;
    if (mismatches > budget) return false;
  }
  return true;
}

/** Sample a `size`×`size` module grid via affine mapping from finder centers. */
function sampleGrid(
  dark: Uint8Array,
  width: number,
  height: number,
  tl: Point,
  tr: Point,
  bl: Point,
  size: number,
): boolean[][] {
  // Finder centers map to module coords (3.5,3.5), (size-3.5,3.5), (3.5,size-3.5).
  const uCoords: [number, number][] = [
    [3.5, 3.5],
    [size - 3.5, 3.5],
    [3.5, size - 3.5],
  ];
  const ax = solveAffine(uCoords, [tl.x, tr.x, bl.x]);
  const ay = solveAffine(uCoords, [tl.y, tr.y, bl.y]);

  const modules: boolean[][] = new Array(size);
  for (let y = 0; y < size; y++) {
    const row: boolean[] = new Array(size);
    for (let x = 0; x < size; x++) {
      const ux = x + 0.5;
      const uy = y + 0.5;
      const px = Math.round(ax[0] * ux + ax[1] * uy + ax[2]);
      const py = Math.round(ay[0] * ux + ay[1] * uy + ay[2]);
      row[x] = px >= 0 && px < width && py >= 0 && py < height && dark[py * width + px] === 1;
    }
    modules[y] = row;
  }
  return modules;
}
