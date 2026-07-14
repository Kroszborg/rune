import { BitBuffer } from './bit-buffer.js';
import { reedSolomonGenerator, reedSolomonRemainder } from './galois.js';
import {
  type Segment,
  charCountBits,
  makeSegment,
  segmentBitLength,
  writeSegment,
} from './segment.js';
import {
  ECC_CODEWORDS_PER_BLOCK,
  ECL_INDEX,
  MAX_VERSION,
  MIN_VERSION,
  NUM_ERROR_CORRECTION_BLOCKS,
  alignmentPatternPositions,
  numDataCodewords,
  numRawDataModules,
  versionSize,
} from './tables.js';
import type { Ecl, EncodeOptions, RuneMatrix } from './types.js';

/** 2-bit format value per ECL (ISO/IEC 18004 Table 12): M=0, L=1, H=2, Q=3. */
const ECL_FORMAT_BITS: Record<Ecl, number> = { M: 0, L: 1, H: 2, Q: 3 };

const PAD_BYTES = [0xec, 0x11] as const;

function getBit(value: number, i: number): boolean {
  return ((value >>> i) & 1) !== 0;
}

/**
 * Encode `text` into a fully-masked QR symbol.
 *
 * Throws if the data does not fit in the largest allowed version.
 */
export function encode(text: string, options: EncodeOptions = {}): RuneMatrix {
  const requestedEcl = options.errorCorrectionLevel ?? 'M';
  const minV = Math.max(MIN_VERSION, options.version ?? MIN_VERSION);
  const maxV = Math.min(MAX_VERSION, options.version ?? options.maxVersion ?? MAX_VERSION);
  const boostEcl = options.boostEcl ?? true;

  const segment = makeSegment(text);
  const version = selectVersion(segment, requestedEcl, minV, maxV);

  // Boost ECL for free if the data still fits at the chosen version.
  let ecl = requestedEcl;
  if (boostEcl) {
    for (const candidate of ['M', 'Q', 'H'] as const) {
      if (segmentBitLength(segment, version) <= numDataCodewords(version, candidate) * 8) {
        ecl = candidate;
      }
    }
  }

  const dataCodewords = buildDataCodewords(segment, version, ecl);
  const allCodewords = addEccAndInterleave(dataCodewords, version, ecl);

  return buildMatrix(version, ecl, allCodewords, options.mask);
}

function selectVersion(segment: Segment, ecl: Ecl, minV: number, maxV: number): number {
  for (let v = minV; v <= maxV; v++) {
    if (segmentBitLength(segment, v) <= numDataCodewords(v, ecl) * 8) return v;
  }
  const needed = segmentBitLength(segment, maxV);
  throw new Error(
    `Data too long: needs ${needed} bits but version ${maxV} (ECL ${ecl}) holds ${
      numDataCodewords(maxV, ecl) * 8
    }`,
  );
}

/** Assemble the padded data codeword byte array for a version + ECL. */
function buildDataCodewords(segment: Segment, version: number, ecl: Ecl): Uint8Array {
  const capacityBits = numDataCodewords(version, ecl) * 8;
  const bb = new BitBuffer();
  writeSegment(bb, segment, version);

  // Terminator: up to four 0 bits.
  const terminator = Math.min(4, capacityBits - bb.length);
  bb.append(0, terminator);
  // Pad to a byte boundary.
  bb.append(0, (8 - (bb.length % 8)) % 8);

  const bytes = new Uint8Array(capacityBits / 8);
  for (let i = 0; i < bb.length; i++) {
    if (bb.bits[i]) bytes[i >>> 3]! |= 0x80 >>> (i & 7);
  }
  // Alternating pad bytes fill the remainder.
  for (let i = bb.length / 8, p = 0; i < bytes.length; i++, p ^= 1) {
    bytes[i] = PAD_BYTES[p]!;
  }
  return bytes;
}

/** Split into blocks, compute Reed–Solomon EC codewords, and interleave. */
function addEccAndInterleave(data: Uint8Array, version: number, ecl: Ecl): Uint8Array {
  const e = ECL_INDEX[ecl];
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e]![version]!;
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[e]![version]!;
  const rawCodewords = Math.floor(numRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const generator = reedSolomonGenerator(blockEccLen);
  const blocks: Uint8Array[] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const dat = data.slice(k, k + datLen);
    k += datLen;
    const ecc = reedSolomonRemainder(dat, generator);
    // Short blocks get a placeholder byte so every block has equal length.
    const block = new Uint8Array(shortBlockLen + 1);
    block.set(dat, 0);
    block.set(ecc, block.length - blockEccLen);
    blocks.push(block);
  }

  const result = new Uint8Array(rawCodewords);
  let idx = 0;
  const maxLen = shortBlockLen + 1;
  for (let i = 0; i < maxLen; i++) {
    for (let j = 0; j < blocks.length; j++) {
      // Skip the padding column that only exists in short blocks.
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
        result[idx++] = blocks[j]![i]!;
      }
    }
  }
  return result;
}

/** Draw all modules and select the mask, returning the final matrix. */
function buildMatrix(
  version: number,
  ecl: Ecl,
  codewords: Uint8Array,
  forcedMask: number | undefined,
): RuneMatrix {
  const size = versionSize(version);
  const modules = createGrid(size);
  const reserved = createGrid(size);

  const setFn = (x: number, y: number, dark: boolean) => {
    modules[y]![x] = dark;
    reserved[y]![x] = true;
  };

  drawFunctionPatterns(size, version, ecl, setFn, reserved, modules);
  drawCodewords(size, codewords, reserved, modules);

  const mask = selectMask(size, ecl, forcedMask, reserved, modules);
  applyMask(size, mask, reserved, modules);
  drawFormatBits(size, ecl, mask, modules);

  return { size, modules, version, ecl, mask, reserved };
}

function createGrid(size: number): boolean[][] {
  return Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
}

function drawFunctionPatterns(
  size: number,
  version: number,
  ecl: Ecl,
  setFn: (x: number, y: number, dark: boolean) => void,
  reserved: boolean[][],
  modules: boolean[][],
): void {
  // Timing patterns.
  for (let i = 0; i < size; i++) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }

  // Finder patterns (with surrounding separators).
  drawFinder(3, 3, size, setFn);
  drawFinder(size - 4, 3, size, setFn);
  drawFinder(3, size - 4, size, setFn);

  // Alignment patterns, skipping the three finder corners.
  const positions = alignmentPatternPositions(version);
  const n = positions.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) {
        continue;
      }
      drawAlignment(positions[i]!, positions[j]!, setFn);
    }
  }

  // Reserve format/version areas (real bits drawn later).
  drawFormatBits(size, ecl, 0, modules, reserved);
  drawVersion(size, version, setFn);
}

function drawFinder(
  cx: number,
  cy: number,
  size: number,
  setFn: (x: number, y: number, dark: boolean) => void,
): void {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) {
        setFn(x, y, dist !== 2 && dist !== 4);
      }
    }
  }
}

function drawAlignment(
  cx: number,
  cy: number,
  setFn: (x: number, y: number, dark: boolean) => void,
): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

/**
 * Draw the 15 format-information bits for the given mask. When `reserved` is
 * supplied the call only reserves the region (used during construction);
 * otherwise it writes the real bits post-masking.
 */
function drawFormatBits(
  size: number,
  ecl: Ecl,
  mask: number,
  modules: boolean[][],
  reserved?: boolean[][],
): void {
  const data = (ECL_FORMAT_BITS[ecl] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412; // 15 bits, BCH-coded

  const set = (x: number, y: number, i: number) => {
    modules[y]![x] = getBit(bits, i);
    if (reserved) reserved[y]![x] = true;
  };

  // First copy, around the top-left finder.
  for (let i = 0; i <= 5; i++) set(8, i, i);
  set(8, 7, 6);
  set(8, 8, 7);
  set(7, 8, 8);
  for (let i = 9; i < 15; i++) set(14 - i, 8, i);

  // Second copy, split across the other two finders.
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, i);
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, i);
  // Always-dark module.
  modules[size - 8]![8] = true;
  if (reserved) reserved[size - 8]![8] = true;
}

function drawVersion(
  size: number,
  version: number,
  setFn: (x: number, y: number, dark: boolean) => void,
): void {
  if (version < 7) return;
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (version << 12) | rem; // 18 bits, BCH-coded

  for (let i = 0; i < 18; i++) {
    const bit = getBit(bits, i);
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setFn(a, b, bit);
    setFn(b, a, bit);
  }
}

/** Place data + EC codewords into the matrix along the zigzag path. */
function drawCodewords(
  size: number,
  codewords: Uint8Array,
  reserved: boolean[][],
  modules: boolean[][],
): void {
  let i = 0; // bit index
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip the vertical timing column
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!reserved[y]![x] && i < codewords.length * 8) {
          modules[y]![x] = getBit(codewords[i >>> 3]!, 7 - (i & 7));
          i++;
        }
      }
    }
  }
}

/** The invert predicate for a mask pattern (ISO/IEC 18004 §7.8.2). */
function maskPredicate(mask: number): (x: number, y: number) => boolean {
  switch (mask) {
    case 0:
      return (x, y) => (x + y) % 2 === 0;
    case 1:
      return (_x, y) => y % 2 === 0;
    case 2:
      return (x) => x % 3 === 0;
    case 3:
      return (x, y) => (x + y) % 3 === 0;
    case 4:
      return (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7:
      return (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      throw new RangeError('Invalid mask');
  }
}

/** XOR the data modules against mask pattern `mask`. */
function applyMask(size: number, mask: number, reserved: boolean[][], modules: boolean[][]): void {
  const invert = maskPredicate(mask);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!reserved[y]![x] && invert(x, y)) modules[y]![x] = !modules[y]![x];
    }
  }
}

/** Choose the mask with the lowest penalty, or honour a forced mask. */
function selectMask(
  size: number,
  ecl: Ecl,
  forced: number | undefined,
  reserved: boolean[][],
  modules: boolean[][],
): number {
  if (forced !== undefined) {
    if (forced < 0 || forced > 7) throw new RangeError('Mask must be 0–7');
    return forced;
  }
  let best = 0;
  let minPenalty = Number.POSITIVE_INFINITY;
  for (let m = 0; m < 8; m++) {
    applyMask(size, m, reserved, modules);
    drawFormatBits(size, ecl, m, modules);
    const penalty = penaltyScore(size, modules);
    if (penalty < minPenalty) {
      minPenalty = penalty;
      best = m;
    }
    applyMask(size, m, reserved, modules); // undo
  }
  return best;
}

const N1 = 3;
const N2 = 3;
const N3 = 40;
const N4 = 10;

/**
 * Rule-1/N3 penalty for a single line (row or column). `get(i)` reads the i-th
 * module along the line; `runHistory` is a caller-owned scratch buffer, reset
 * here, so the double loop below allocates it only once.
 */
function penaltyLine(size: number, get: (i: number) => boolean, runHistory: number[]): number {
  runHistory.fill(0);
  let result = 0;
  let run = 0;
  let color = false;
  for (let i = 0; i < size; i++) {
    if (get(i) === color) {
      run++;
      if (run === 5) result += N1;
      else if (run > 5) result++;
    } else {
      finderPenaltyAddHistory(run, runHistory);
      if (!color) result += finderPenaltyCount(runHistory) * N3;
      color = get(i);
      run = 1;
    }
  }
  result += finderPenaltyTerminate(color, run, size, runHistory) * N3;
  return result;
}

/** Compute the total masking penalty (ISO/IEC 18004 §7.8.3, rules N1–N4). */
function penaltyScore(size: number, modules: boolean[][]): number {
  let result = 0;

  // Rule 1: runs of 5+ same-colour modules in every row, then every column.
  const runHistory = new Array<number>(7).fill(0);
  for (let y = 0; y < size; y++) result += penaltyLine(size, (x) => modules[y]![x]!, runHistory);
  for (let x = 0; x < size; x++) result += penaltyLine(size, (y) => modules[y]![x]!, runHistory);

  // Rule 2: 2×2 blocks of the same colour.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = modules[y]![x]!;
      if (c === modules[y]![x + 1] && c === modules[y + 1]![x] && c === modules[y + 1]![x + 1]) {
        result += N2;
      }
    }
  }

  // Rule 4: proportion of dark modules deviating from 50%.
  let dark = 0;
  for (const row of modules) for (const cell of row) if (cell) dark++;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  result += k * N4;

  return result;
}

function finderPenaltyAddHistory(currentRun: number, history: number[]): void {
  history.pop();
  history.unshift(currentRun);
}

function finderPenaltyCount(history: number[]): number {
  const n = history[1]!;
  const core =
    n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
  let count = 0;
  if (core && history[0]! >= n * 4 && history[6]! >= n) count++;
  if (core && history[6]! >= n * 4 && history[0]! >= n) count++;
  return count;
}

function finderPenaltyTerminate(
  currentColor: boolean,
  currentRun: number,
  size: number,
  history: number[],
): number {
  let run = currentRun;
  if (currentColor) {
    finderPenaltyAddHistory(run, history);
    run = 0;
  }
  run += size;
  finderPenaltyAddHistory(run, history);
  return finderPenaltyCount(history);
}
