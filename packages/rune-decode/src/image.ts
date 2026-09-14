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

/* ────────────────────────────── binarization ────────────────────────────── */

/** Luma with alpha composited over white (a transparent background is light). */
function toGray(img: ImageInput): Uint8Array {
  const { data, width, height } = img;
  const n = width * height;
  const gray = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3]!;
    const r = data[i * 4]! * a + 255 * (255 - a);
    const g = data[i * 4 + 1]! * a + 255 * (255 - a);
    const b = data[i * 4 + 2]! * a + 255 * (255 - a);
    gray[i] = (((r * 77 + g * 150 + b * 29) >> 8) / 255) | 0;
  }
  return gray;
}

/** Global Otsu threshold → dark bitmap (1 = dark). Best for clean, evenly lit images. */
function binarizeGlobal(gray: Uint8Array): Uint8Array {
  const n = gray.length;
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < n; i++) histogram[gray[i]!]!++;
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

const BLOCK = 8;
const MIN_DYNAMIC_RANGE = 24;

/**
 * Local (block-adaptive) threshold in the style of zxing's HybridBinarizer:
 * each 8×8 block gets a black point from its own statistics, low-contrast
 * blocks inherit from their neighbours, and every pixel is thresholded
 * against the mean black point of the surrounding 5×5 blocks. This survives
 * shadows, vignetting and gradients that defeat a single global threshold.
 */
function binarizeLocal(gray: Uint8Array, width: number, height: number): Uint8Array {
  const bw = Math.ceil(width / BLOCK);
  const bh = Math.ceil(height / BLOCK);
  const blackPoints = new Int32Array(bw * bh);

  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let sum = 0;
      let min = 255;
      let max = 0;
      let count = 0;
      for (let y = by * BLOCK; y < Math.min(height, (by + 1) * BLOCK); y++) {
        for (let x = bx * BLOCK; x < Math.min(width, (bx + 1) * BLOCK); x++) {
          const v = gray[y * width + x]!;
          sum += v;
          if (v < min) min = v;
          if (v > max) max = v;
          count++;
        }
      }
      let average = count ? sum / count : 0;
      if (max - min <= MIN_DYNAMIC_RANGE) {
        // Flat block: assume light, unless neighbours above/left say the
        // surrounding area is dark (then this block is inside a dark region).
        average = min / 2;
        if (by > 0 && bx > 0) {
          const neighbours =
            (blackPoints[(by - 1) * bw + bx]! +
              2 * blackPoints[by * bw + bx - 1]! +
              blackPoints[(by - 1) * bw + bx - 1]!) /
            4;
          if (min < neighbours) average = neighbours;
        }
      }
      blackPoints[by * bw + bx] = average | 0;
    }
  }

  const dark = new Uint8Array(width * height);
  for (let by = 0; by < bh; by++) {
    const top = Math.min(Math.max(by, 2), bh - 3);
    for (let bx = 0; bx < bw; bx++) {
      const left = Math.min(Math.max(bx, 2), bw - 3);
      let sum = 0;
      let n = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = top + dy;
        if (yy < 0 || yy >= bh) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const xx = left + dx;
          if (xx < 0 || xx >= bw) continue;
          sum += blackPoints[yy * bw + xx]!;
          n++;
        }
      }
      const threshold = sum / n;
      for (let y = by * BLOCK; y < Math.min(height, (by + 1) * BLOCK); y++) {
        for (let x = bx * BLOCK; x < Math.min(width, (bx + 1) * BLOCK); x++) {
          dark[y * width + x] = gray[y * width + x]! <= threshold ? 1 : 0;
        }
      }
    }
  }
  return dark;
}

/* ────────────────────────────── finder patterns ─────────────────────────── */

/** True if 5 runs approximate the finder ratio 1:1:3:1:1; returns the module size. */
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
    const flush = (x: number) => {
      const m = matchesFinder(s);
      if (m > 0) {
        const centerX = x - s[4]! - s[3]! - s[2]! / 2;
        if (confirmVertical(dark, width, height, Math.round(centerX), y)) {
          candidates.push({ x: centerX, y, moduleSize: m });
        }
      }
    };
    for (let x = 0; x < width; x++) {
      const isDark = dark[y * width + x] === 1;
      if (isDark) {
        if ((state & 1) === 1) state++; // white → black boundary
        s[state]!++;
      } else if ((state & 1) === 0) {
        if (state === 4) {
          flush(x);
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
        s[state]!++;
      }
    }
    // A finder ending at the last pixel of the row still counts.
    if (state === 4) flush(width);
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
 * Rank candidate triples by how well they form a QR finder arrangement: two
 * equal legs, a hypotenuse ≈ leg·√2, similar module sizes. Perspective bends
 * that geometry, so the best score is not always right; callers try each
 * plausible triple in order until one decodes.
 */
function rankFinderTriples(cands: Point[], max = 6): Point[][] {
  if (cands.length < 3) return [];
  const scored: Array<{ tri: Point[]; score: number }> = [];
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
        const msSpread = (Math.max(...ms) - Math.min(...ms)) / Math.min(...ms);
        const legScore = Math.abs(leg1 - leg2) / leg2;
        const hypScore = Math.abs(hyp - avgLeg * Math.SQRT2) / hyp;
        // Finders sit 7 modules from the edge: leg / moduleSize must be at
        // least 14 (a version-1 symbol) or the trio is data noise.
        if (avgLeg / Math.min(...ms) < 12) continue;
        const score = legScore + hypScore + msSpread;
        if (score < 0.9) scored.push({ tri, score });
      }
    }
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, max).map((s) => s.tri);
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
  // In screen coords (y down), (TR−TL)×(BL−TL) > 0 for an upright code.
  const cross = (p1.x - tl.x) * (p2.y - tl.y) - (p1.y - tl.y) * (p2.x - tl.x);
  const [tr, bl] = cross > 0 ? [p1, p2] : [p2, p1];
  return [tl, tr, bl];
}

/* ───────────────────────────── perspective mapping ──────────────────────── */

/** 3×3 homography, row-major. Maps (x, y, 1) → (X, Y, W). */
type Homography = [number, number, number, number, number, number, number, number, number];

/** Unit square → quadrilateral (zxing's PerspectiveTransform.squareToQuadrilateral). */
function squareToQuad(q: [number, number][]): Homography {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q as [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];
  const dx3 = x0 - x1 + x2 - x3;
  const dy3 = y0 - y1 + y2 - y3;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    // Affine.
    return [x1 - x0, x2 - x1, x0, y1 - y0, y2 - y1, y0, 0, 0, 1];
  }
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  const a13 = (dx3 * dy2 - dx2 * dy3) / den;
  const a23 = (dx1 * dy3 - dx3 * dy1) / den;
  return [
    x1 - x0 + a13 * x1,
    x3 - x0 + a23 * x3,
    x0,
    y1 - y0 + a13 * y1,
    y3 - y0 + a23 * y3,
    y0,
    a13,
    a23,
    1,
  ];
}

function invert(h: Homography): Homography {
  const [a, b, c, d, e, f, g, hh, i] = h;
  return [
    e * i - f * hh,
    c * hh - b * i,
    b * f - c * e,
    f * g - d * i,
    a * i - c * g,
    c * d - a * f,
    d * hh - e * g,
    b * g - a * hh,
    a * e - b * d,
  ];
}

function multiply(a: Homography, b: Homography): Homography {
  const out = new Array<number>(9) as Homography;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] = a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!;
    }
  }
  return out;
}

/** Homography mapping module-space quad `src` onto image quad `dst`. */
function quadToQuad(src: [number, number][], dst: [number, number][]): Homography {
  return multiply(squareToQuad(dst), invert(squareToQuad(src)));
}

function apply(h: Homography, x: number, y: number): [number, number] {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

/* ───────────────────────────── alignment pattern ────────────────────────── */

/**
 * Find the centre of the bottom-right alignment pattern near the estimated
 * pixel position: a dark module surrounded by a light ring, each about one
 * module wide, checked along both axes. Returns null if nothing plausible.
 */
function findAlignment(
  dark: Uint8Array,
  width: number,
  height: number,
  estX: number,
  estY: number,
  moduleSize: number,
): [number, number] | null {
  const at = (x: number, y: number): boolean =>
    x >= 0 && x < width && y >= 0 && y < height && dark[y * width + x] === 1;
  const radius = Math.max(moduleSize * 3, 4);
  const x0 = Math.max(0, Math.floor(estX - radius));
  const x1 = Math.min(width - 1, Math.ceil(estX + radius));
  const y0 = Math.max(0, Math.floor(estY - radius));
  const y1 = Math.min(height - 1, Math.ceil(estY + radius));
  const tol = moduleSize * 0.6 + 1;
  const runFrom = (x: number, y: number, dx: number, dy: number, want: boolean): number => {
    let n = 0;
    let cx = x + dx;
    let cy = y + dy;
    while (
      cx >= 0 &&
      cy >= 0 &&
      cx < width &&
      cy < height &&
      at(cx, cy) === want &&
      n < radius * 2
    ) {
      n++;
      cx += dx;
      cy += dy;
    }
    return n;
  };

  let best: [number, number] | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!at(x, y)) continue;
      // Central dark run along x.
      const left = runFrom(x, y, -1, 0, true);
      const right = runFrom(x, y, 1, 0, true);
      const darkW = left + right + 1;
      if (Math.abs(darkW - moduleSize) > tol) continue;
      const cx = x - left + (darkW - 1) / 2;
      const lightL = runFrom(x - left, y, -1, 0, false);
      const lightR = runFrom(x + right, y, 1, 0, false);
      if (Math.abs(lightL - moduleSize) > tol || Math.abs(lightR - moduleSize) > tol) continue;
      // Same along y at the found centre column.
      const cxi = Math.round(cx);
      if (!at(cxi, y)) continue;
      const up = runFrom(cxi, y, 0, -1, true);
      const down = runFrom(cxi, y, 0, 1, true);
      const darkH = up + down + 1;
      if (Math.abs(darkH - moduleSize) > tol) continue;
      const lightU = runFrom(cxi, y - up, 0, -1, false);
      const lightD = runFrom(cxi, y + down, 0, 1, false);
      if (Math.abs(lightU - moduleSize) > tol || Math.abs(lightD - moduleSize) > tol) continue;
      const cy = y - up + (darkH - 1) / 2;
      const d = Math.hypot(cx - estX, cy - estY);
      if (d < bestDist) {
        bestDist = d;
        best = [cx, cy];
      }
    }
  }
  return best;
}

/* ─────────────────────────────── sampling ───────────────────────────────── */

/**
 * The timing patterns (row 6 and column 6) alternate dark/light. If a sampled
 * grid doesn't show that, the dimension/alignment is wrong.
 */
function timingPatternValid(modules: boolean[][], size: number): boolean {
  let mismatches = 0;
  const budget = Math.floor((size - 16) * 0.12);
  for (let i = 8; i < size - 8; i++) {
    const expected = i % 2 === 0;
    if (modules[6]![i] !== expected) mismatches++;
    if (modules[i]![6] !== expected) mismatches++;
    if (mismatches > budget) return false;
  }
  return true;
}

/** Sample a `size`×`size` module grid through a homography, majority-voting 5 sub-samples. */
function sampleGrid(
  dark: Uint8Array,
  width: number,
  height: number,
  h: Homography,
  size: number,
): boolean[][] {
  const at = (px: number, py: number): number => {
    const x = Math.round(px);
    const y = Math.round(py);
    return x >= 0 && x < width && y >= 0 && y < height && dark[y * width + x] === 1 ? 1 : 0;
  };
  const offsets: [number, number][] = [
    [0.5, 0.5],
    [0.3, 0.3],
    [0.7, 0.3],
    [0.3, 0.7],
    [0.7, 0.7],
  ];
  const modules: boolean[][] = new Array(size);
  for (let y = 0; y < size; y++) {
    const row: boolean[] = new Array(size);
    for (let x = 0; x < size; x++) {
      let votes = 0;
      for (const [ox, oy] of offsets) {
        const [px, py] = apply(h, x + ox, y + oy);
        votes += at(px, py);
      }
      row[x] = votes >= 3;
    }
    modules[y] = row;
  }
  return modules;
}

function transpose(m: boolean[][]): boolean[][] {
  const n = m.length;
  const out: boolean[][] = new Array(n);
  for (let y = 0; y < n; y++) {
    const row: boolean[] = new Array(n);
    for (let x = 0; x < n; x++) row[x] = m[x]![y]!;
    out[y] = row;
  }
  return out;
}

/* ──────────────────────────────── decode ────────────────────────────────── */

function decodeBitmap(dark: Uint8Array, width: number, height: number): MatrixDecodeResult | null {
  const candidates = locateFinders(dark, width, height);
  for (const finders of rankFinderTriples(candidates)) {
    const result = decodeWithFinders(dark, width, height, finders);
    if (result) return result;
  }
  return null;
}

function decodeWithFinders(
  dark: Uint8Array,
  width: number,
  height: number,
  finders: Point[],
): MatrixDecodeResult | null {
  const ordered = orderFinders(finders);
  if (!ordered) return null;
  const [tl, tr, bl] = ordered;

  const moduleSize = (tl.moduleSize + tr.moduleSize + bl.moduleSize) / 3;
  const est = Math.round((dist(tl, tr) + dist(tl, bl)) / 2 / moduleSize) + 7;
  const base = Math.round((est - 21) / 4) * 4 + 21;

  const seen = new Set<number>();
  for (const delta of [0, 4, -4, 8, -8, 12, -12]) {
    const size = base + delta;
    if (size < 21 || size > 177 || (size - 17) % 4 !== 0 || seen.has(size)) continue;
    seen.add(size);

    // Affine estimate from the three finders, then refine with the
    // bottom-right alignment pattern (versions 2+) into a full homography.
    const srcFinders: [number, number][] = [
      [3.5, 3.5],
      [size - 3.5, 3.5],
      [3.5, size - 3.5],
    ];
    const dstFinders: [number, number][] = [
      [tl.x, tl.y],
      [tr.x, tr.y],
      [bl.x, bl.y],
    ];
    // Fourth point for the affine guess: the parallelogram corner.
    const br4: [number, number] = [tr.x + bl.x - tl.x, tr.y + bl.y - tl.y];
    const affine = quadToQuad([...srcFinders, [size - 3.5, size - 3.5]], [...dstFinders, br4]);

    let h = affine;
    if (size >= 25) {
      const alignSrc: [number, number] = [size - 6.5, size - 6.5];
      const [ex, ey] = apply(affine, alignSrc[0], alignSrc[1]);
      const found = findAlignment(dark, width, height, ex, ey, moduleSize);
      if (found) h = quadToQuad([...srcFinders, alignSrc], [...dstFinders, found]);
    }

    for (const mapping of h === affine ? [affine] : [h, affine]) {
      let modules: boolean[][];
      try {
        modules = sampleGrid(dark, width, height, mapping, size);
      } catch {
        continue;
      }
      if (!timingPatternValid(modules, size)) continue;
      try {
        return decodeMatrix(modules);
      } catch {
        // Fall through: maybe the image is mirrored.
      }
      try {
        const result = decodeMatrix(transpose(modules));
        return { ...result, mirrored: true };
      } catch {
        // Wrong dimension or unrecoverable at this size — try the next.
      }
    }
  }
  return null;
}

/**
 * Decode a QR code from raw RGBA pixels. Locates the three finder patterns,
 * refines the grid with the bottom-right alignment pattern into a perspective
 * transform, and samples each module by majority vote. Tries a local
 * (shadow-tolerant) threshold first and a global one second, and retries the
 * grid mirrored (front-camera images). Returns null if nothing decodes.
 */
export function decode(img: ImageInput): MatrixDecodeResult | null {
  const { width, height, data } = img;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError(`rune-decode: invalid image dimensions ${width}×${height}`);
  }
  if (!data || data.length < width * height * 4) {
    throw new RangeError(
      `rune-decode: image data has ${data?.length ?? 0} bytes but ${width}×${height} RGBA needs ${width * height * 4}`,
    );
  }
  const gray = toGray(img);
  const bitmaps =
    width >= BLOCK * 5 && height >= BLOCK * 5
      ? [binarizeLocal(gray, width, height), binarizeGlobal(gray)]
      : [binarizeGlobal(gray)];
  for (const dark of bitmaps) {
    try {
      const result = decodeBitmap(dark, width, height);
      if (result) return result;
    } catch {
      // Try the next binarization.
    }
  }
  return null;
}
