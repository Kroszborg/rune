/**
 * GF(256) arithmetic with full exp/log tables (QR primitive 0x11D), including
 * the operations a Reed–Solomon *decoder* needs: inverse, polynomial eval,
 * multiply, and division.
 */

const PRIMITIVE = 0x11d;

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= PRIMITIVE;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
})();

export function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a]! + LOG[b]!]!;
}

export function div(a: number, b: number): number {
  if (b === 0) throw new Error('GF divide by zero');
  if (a === 0) return 0;
  return EXP[(LOG[a]! + 255 - LOG[b]!) % 255]!;
}

export function inv(a: number): number {
  if (a === 0) throw new Error('GF inverse of zero');
  return EXP[255 - LOG[a]!]!;
}

export function pow(a: number, e: number): number {
  if (a === 0) return 0;
  const idx = (((LOG[a]! * e) % 255) + 255) % 255;
  return EXP[idx]!;
}

/** Evaluate polynomial `poly` (high-order first) at `x`. */
export function polyEval(poly: Uint8Array, x: number): number {
  let result = 0;
  for (const c of poly) result = mul(result, x) ^ c;
  return result;
}

export { EXP, LOG };
