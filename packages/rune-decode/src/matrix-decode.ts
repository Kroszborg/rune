import { parseSegments } from './bits.js';
import { decodeFormatBits, readFormat, readFormatSecondary } from './format.js';
import { rsDecode } from './reedsolomon.js';
import {
  ECC_CODEWORDS_PER_BLOCK,
  ECL_INDEX,
  type Ecl,
  NUM_ERROR_CORRECTION_BLOCKS,
  alignmentPatternPositions,
  numRawDataModules,
  versionForSize,
} from './tables.js';

export interface MatrixDecodeResult {
  text: string;
  version: number;
  ecl: Ecl;
  mask: number;
}

/** Build the function-pattern (reserved) map for a version, matching the encoder. */
function functionMap(version: number, size: number): boolean[][] {
  const reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number) => {
    if (x >= 0 && x < size && y >= 0 && y < size) reserved[y]![x] = true;
  };

  // Timing.
  for (let i = 0; i < size; i++) {
    set(6, i);
    set(i, 6);
  }
  // Finders + separators (9×9 around each corner center).
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ] as const) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) set(cx + dx, cy + dy);
  }
  // Alignment patterns.
  const pos = alignmentPatternPositions(version);
  const n = pos.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) set(pos[i]! + dx, pos[j]! + dy);
    }
  }
  // Format info areas + dark module.
  for (let i = 0; i <= 5; i++) set(8, i);
  set(8, 7);
  set(8, 8);
  set(7, 8);
  for (let i = 9; i < 15; i++) set(14 - i, 8);
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8);
  for (let i = 8; i < 15; i++) set(8, size - 15 + i);
  set(8, size - 8);
  // Version info (v ≥ 7): two 6×3 blocks.
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b);
      set(b, a);
    }
  }
  return reserved;
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return false;
  }
}

/** Read codewords along the encoder's zigzag path (unmasked modules). */
function readCodewords(
  modules: boolean[][],
  reserved: boolean[][],
  size: number,
  mask: number,
  count: number,
): number[] {
  const bytes = new Array<number>(count).fill(0);
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!reserved[y]![x] && bitIndex < count * 8) {
          const dark = modules[y]![x]! !== maskBit(mask, x, y);
          if (dark) bytes[bitIndex >> 3]! |= 0x80 >> (bitIndex & 7);
          bitIndex++;
        }
      }
    }
  }
  return bytes;
}

/** De-interleave codewords back into per-block (data+ecc) received words. */
function deinterleave(codewords: number[], version: number, ecl: Ecl): number[][] {
  const e = ECL_INDEX[ecl];
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e]![version]!;
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[e]![version]!;
  const rawCodewords = Math.floor(numRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const shortDataLen = shortBlockLen - blockEccLen;
  const maxLen = shortBlockLen + 1;

  const blocks = Array.from({ length: numBlocks }, () => new Array<number>(maxLen).fill(0));
  let idx = 0;
  for (let i = 0; i < maxLen; i++) {
    for (let j = 0; j < numBlocks; j++) {
      if (i === shortDataLen && j < numShortBlocks) continue;
      blocks[j]![i] = codewords[idx++]!;
    }
  }

  const received: number[][] = [];
  for (let j = 0; j < numBlocks; j++) {
    const dataLen = shortDataLen + (j < numShortBlocks ? 0 : 1);
    const data = blocks[j]!.slice(0, dataLen);
    const ecc = blocks[j]!.slice(maxLen - blockEccLen);
    received.push([...data, ...ecc]);
  }
  return received;
}

/**
 * Decode a sampled module matrix (`modules[y][x]`, true = dark) into text.
 * This is the full algorithmic decode: format → unmask → de-interleave →
 * Reed–Solomon correction → segment parse. Throws on unrecoverable data.
 */
export function decodeMatrix(modules: boolean[][]): MatrixDecodeResult {
  const size = modules.length;
  if (size < 21 || (size - 17) % 4 !== 0) throw new Error(`Invalid matrix size ${size}`);
  const version = versionForSize(size);

  const format =
    decodeFormatBits(readFormat(modules, size)) ??
    decodeFormatBits(readFormatSecondary(modules, size));
  if (!format) throw new Error('Unreadable format information');
  const { ecl, mask } = format;

  const reserved = functionMap(version, size);
  const rawCodewords = Math.floor(numRawDataModules(version) / 8);
  const codewords = readCodewords(modules, reserved, size, mask, rawCodewords);

  const blocks = deinterleave(codewords, version, ecl);
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ECL_INDEX[ecl]]![version]!;
  const data: number[] = [];
  for (const block of blocks) data.push(...rsDecode(block, blockEccLen));

  const text = parseSegments(data, version);
  return { text, version, ecl, mask };
}
