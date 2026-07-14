/**
 * Reed–Solomon *decoder* (error correction) over GF(256) for QR Code.
 * QR uses first-consecutive-root fcr = 0 and generator base α = 2.
 *
 * Pipeline: syndromes → Berlekamp–Massey (error locator) → Chien search
 * (error positions) → Forney (error magnitudes) → correct. Polynomials are
 * high-order-first `number[]`. Adapted from the standard "RS for coders"
 * algorithm with fcr fixed to 0 to match Rune's encoder.
 */
import { div, inv, mul, pow } from './gf.js';

function polyScale(p: number[], x: number): number[] {
  return p.map((c) => mul(c, x));
}

function polyAdd(p: number[], q: number[]): number[] {
  const r = new Array<number>(Math.max(p.length, q.length)).fill(0);
  for (let i = 0; i < p.length; i++) r[r.length - p.length + i] = p[i]!;
  for (let i = 0; i < q.length; i++) r[r.length - q.length + i]! ^= q[i]!;
  return r;
}

function polyMul(p: number[], q: number[]): number[] {
  const r = new Array<number>(p.length + q.length - 1).fill(0);
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) r[i + j]! ^= mul(p[i]!, q[j]!);
  }
  return r;
}

function polyEval(p: number[], x: number): number {
  let y = p[0]!;
  for (let i = 1; i < p.length; i++) y = mul(y, x) ^ p[i]!;
  return y;
}

/** syndromes with a leading 0 pad; S_i = R(α^i), fcr = 0. */
function calcSyndromes(msg: number[], nsym: number): number[] {
  const synd = [0];
  for (let i = 0; i < nsym; i++) synd.push(polyEval(msg, pow(2, i)));
  return synd;
}

function findErrorLocator(synd: number[], nsym: number): number[] {
  let errLoc = [1];
  let oldLoc = [1];
  const syndShift = synd.length - nsym; // = 1 (leading pad)
  for (let i = 0; i < nsym; i++) {
    const K = i + syndShift;
    let delta = synd[K]!;
    for (let j = 1; j < errLoc.length; j++) {
      delta ^= mul(errLoc[errLoc.length - 1 - j]!, synd[K - j]!);
    }
    oldLoc = [...oldLoc, 0];
    if (delta !== 0) {
      if (oldLoc.length > errLoc.length) {
        const newLoc = polyScale(oldLoc, delta);
        oldLoc = polyScale(errLoc, inv(delta));
        errLoc = newLoc;
      }
      errLoc = polyAdd(errLoc, polyScale(oldLoc, delta));
    }
  }
  while (errLoc.length && errLoc[0] === 0) errLoc.shift();
  return errLoc;
}

function findErrors(errLoc: number[], nmess: number): number[] {
  const errs = errLoc.length - 1;
  const positions: number[] = [];
  // Chien search: the locator's roots are at α^(−k), so evaluate at α^(−i).
  for (let i = 0; i < nmess; i++) {
    if (polyEval(errLoc, pow(2, -i)) === 0) positions.push(nmess - 1 - i);
  }
  if (positions.length !== errs) {
    throw new Error('RS: could not locate all errors');
  }
  return positions;
}

function findErrataLocator(coefPos: number[]): number[] {
  let eLoc = [1];
  for (const i of coefPos) eLoc = polyMul(eLoc, polyAdd([1], [pow(2, i), 0]));
  return eLoc;
}

function findErrorEvaluator(synd: number[], errLoc: number[], nsym: number): number[] {
  const product = polyMul(synd, errLoc);
  // remainder of product / x^(nsym+1)
  return product.slice(product.length - (nsym + 1));
}

function correctErrata(msg: number[], synd: number[], errPos: number[]): number[] {
  const coefPos = errPos.map((p) => msg.length - 1 - p);
  const errLoc = findErrataLocator(coefPos);
  const reversedSynd = [...synd].reverse();
  const errEval = findErrorEvaluator(reversedSynd, errLoc, errLoc.length - 1).reverse();

  const X: number[] = [];
  for (const cp of coefPos) X.push(pow(2, cp));

  const E = new Array<number>(msg.length).fill(0);
  for (let i = 0; i < X.length; i++) {
    const Xi = X[i]!;
    const XiInv = inv(Xi);
    let errLocPrime = 1;
    for (let j = 0; j < X.length; j++) {
      if (j !== i) errLocPrime = mul(errLocPrime, 1 ^ mul(XiInv, X[j]!));
    }
    let y = polyEval([...errEval].reverse(), XiInv);
    y = mul(Xi, y); // fcr = 0 → factor Xi^(1-fcr) = Xi
    if (errLocPrime === 0) throw new Error('RS: Forney denominator zero');
    E[errPos[i]!] = div(y, errLocPrime);
  }
  return polyAdd(msg, E);
}

/**
 * Decode a received codeword block (data + EC, high-order first). Returns the
 * corrected data codewords (length `msg.length - nsym`). Throws if the errors
 * exceed the correction capacity.
 */
export function rsDecode(received: number[], nsym: number): number[] {
  const synd = calcSyndromes(received, nsym);
  if (synd.every((s) => s === 0)) {
    return received.slice(0, received.length - nsym);
  }
  const errLoc = findErrorLocator(synd, nsym);
  const errPos = findErrors(errLoc, received.length);
  const corrected = correctErrata(received, synd, errPos);
  // Verify the correction resolved all syndromes.
  const check = calcSyndromes(corrected, nsym);
  if (!check.every((s) => s === 0)) throw new Error('RS: correction failed');
  return corrected.slice(0, corrected.length - nsym);
}
