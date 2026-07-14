import type { Ecl } from './types.js';

/** Error correction levels in ascending redundancy order. */
export const ECLS: readonly Ecl[] = ['L', 'M', 'Q', 'H'] as const;

/** Index of an ECL within the canonical tables below. */
export const ECL_INDEX: Record<Ecl, number> = { L: 0, M: 1, Q: 2, H: 3 };

export const MIN_VERSION = 1;
export const MAX_VERSION = 40;

/**
 * Number of error correction codewords per block, indexed
 * `[eclIndex][version]`. Index 0 (version 0) is a padding placeholder.
 * Source: ISO/IEC 18004 Table 9 (canonical Nayuki table).
 */
// biome-ignore format: tabular data
export const ECC_CODEWORDS_PER_BLOCK: readonly (readonly number[])[] = [
  [-1,  7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // L
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28], // M
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // Q
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // H
];

/**
 * Number of error correction blocks, indexed `[eclIndex][version]`.
 * Source: ISO/IEC 18004 Table 9 (canonical Nayuki table).
 */
// biome-ignore format: tabular data
export const NUM_ERROR_CORRECTION_BLOCKS: readonly (readonly number[])[] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25], // L
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49], // M
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68], // Q
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81], // H
];

/** Total number of data modules (before function patterns) for a version. */
export function numRawDataModules(version: number): number {
  if (version < MIN_VERSION || version > MAX_VERSION) throw new RangeError('Invalid version');
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

/** Number of usable data codewords (8-bit) for a version + ECL. */
export function numDataCodewords(version: number, ecl: Ecl): number {
  const e = ECL_INDEX[ecl];
  return (
    Math.floor(numRawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[e]![version]! * NUM_ERROR_CORRECTION_BLOCKS[e]![version]!
  );
}

/**
 * Center coordinates of alignment patterns for a version (empty for v1).
 * Computed per ISO/IEC 18004 §6.3.6.
 */
export function alignmentPatternPositions(version: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result: number[] = [];
  for (let i = 0, pos = version * 4 + 10; i < numAlign - 1; i++, pos -= step) {
    result.unshift(pos);
  }
  result.unshift(6);
  return result;
}

/** Side length in modules for a version. */
export function versionSize(version: number): number {
  return version * 4 + 17;
}
