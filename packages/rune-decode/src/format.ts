import { ECL_BY_FORMAT, type Ecl } from './tables.js';

/** All 32 valid 15-bit format codes, indexed by the 5-bit data (ecl<<3|mask). */
const VALID_FORMATS: number[] = (() => {
  const codes: number[] = [];
  for (let data = 0; data < 32; data++) {
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    codes.push((((data << 10) | rem) ^ 0x5412) & 0x7fff);
  }
  return codes;
})();

function hamming(a: number, b: number): number {
  let x = a ^ b;
  let count = 0;
  while (x) {
    count += x & 1;
    x >>>= 1;
  }
  return count;
}

/** Decode a 15-bit read format value → { ecl, mask }, or null if unrecoverable. */
export function decodeFormatBits(read: number): { ecl: Ecl; mask: number } | null {
  let bestData = -1;
  let bestDist = 4; // reject if Hamming distance > 3
  for (let data = 0; data < 32; data++) {
    const d = hamming(read, VALID_FORMATS[data]!);
    if (d < bestDist) {
      bestDist = d;
      bestData = data;
    }
  }
  if (bestData < 0) return null;
  return { ecl: ECL_BY_FORMAT[bestData >> 3]!, mask: bestData & 7 };
}

/** Read bit `i` of a format code from module (x, y). */
function bitAt(modules: boolean[][], x: number, y: number, i: number): number {
  return (modules[y]![x]! ? 1 : 0) << i;
}

/** Read the primary format-info copy (around the top-left finder). */
export function readFormat(modules: boolean[][], _size: number): number {
  let v = 0;
  for (let i = 0; i <= 5; i++) v |= bitAt(modules, 8, i, i);
  v |= bitAt(modules, 8, 7, 6);
  v |= bitAt(modules, 8, 8, 7);
  v |= bitAt(modules, 7, 8, 8);
  for (let i = 9; i < 15; i++) v |= bitAt(modules, 14 - i, 8, i);
  return v;
}

/** Read the secondary format-info copy (split across the other two finders). */
export function readFormatSecondary(modules: boolean[][], size: number): number {
  let v = 0;
  for (let i = 0; i < 8; i++) v |= bitAt(modules, size - 1 - i, 8, i);
  for (let i = 8; i < 15; i++) v |= bitAt(modules, 8, size - 15 + i, i);
  return v;
}
