/** A growable sequence of bits, most-significant-first. */
export class BitBuffer {
  readonly bits: number[] = [];

  /** Append the low `length` bits of `value` (big-endian). */
  append(value: number, length: number): void {
    if (length < 0 || length > 32) throw new RangeError('Invalid bit length');
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }

  get length(): number {
    return this.bits.length;
  }
}
