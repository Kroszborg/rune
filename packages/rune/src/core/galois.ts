/**
 * Reed–Solomon error correction over GF(256) with the QR Code primitive
 * polynomial (x^8 + x^4 + x^3 + x^2 + 1 = 0x11D).
 *
 * All arithmetic is byte-wide. Adapted from the public-domain algorithm
 * described in ISO/IEC 18004 Annex A and Nayuki's reference implementation.
 */

const PRIMITIVE = 0x11d;

/** Multiply two field elements modulo the QR primitive polynomial. */
export function fieldMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * PRIMITIVE);
    z ^= ((y >>> i) & 1) * x;
  }
  if (z >>> 8 !== 0) throw new Error('Galois multiply overflow');
  return z;
}

/**
 * Compute the Reed–Solomon generator polynomial coefficients for `degree`
 * error correction codewords. Returned high-order-first, monic term omitted.
 */
export function reedSolomonGenerator(degree: number): Uint8Array {
  if (degree < 1 || degree > 255) throw new RangeError('Invalid RS degree');
  // Coefficients stored low-to-high; starts as the polynomial "1".
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;

  // Repeatedly multiply by (x - r^i) where r = 0x02 is a generator of GF(256).
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = fieldMultiply(result[j]!, root);
      if (j + 1 < degree) result[j]! ^= result[j + 1]!;
    }
    root = fieldMultiply(root, 0x02);
  }
  return result;
}

/**
 * Compute the `generator.length` error correction codewords for `data` using
 * the given RS generator polynomial.
 */
export function reedSolomonRemainder(data: Uint8Array, generator: Uint8Array): Uint8Array {
  const degree = generator.length;
  const result = new Uint8Array(degree);
  for (const b of data) {
    const factor = b ^ result[0]!;
    result.copyWithin(0, 1);
    result[degree - 1] = 0;
    for (let j = 0; j < degree; j++) {
      result[j]! ^= fieldMultiply(generator[j]!, factor);
    }
  }
  return result;
}
