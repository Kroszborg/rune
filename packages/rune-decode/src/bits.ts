/** MSB-first bit reader over a byte array, and the QR data-segment parser. */

const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

class BitReader {
  private pos = 0;
  constructor(private readonly bytes: number[]) {}

  read(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const byte = this.bytes[this.pos >> 3] ?? 0;
      const bit = (byte >> (7 - (this.pos & 7))) & 1;
      v = (v << 1) | bit;
      this.pos++;
    }
    return v;
  }

  get remaining(): number {
    return this.bytes.length * 8 - this.pos;
  }
}

function charCountBits(mode: number, version: number): number {
  const group = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  switch (mode) {
    case 0x1:
      return [10, 12, 14][group]!;
    case 0x2:
      return [9, 11, 13][group]!;
    case 0x4:
      return [8, 16, 16][group]!;
    case 0x8:
      return [8, 10, 12][group]!;
    default:
      return 0;
  }
}

/** Parse decoded data codewords into the original string. */
export function parseSegments(data: number[], version: number): string {
  const reader = new BitReader(data);
  let out = '';

  while (reader.remaining >= 4) {
    const mode = reader.read(4);
    if (mode === 0) break; // terminator

    if (mode === 0x1) {
      let count = reader.read(charCountBits(0x1, version));
      while (count >= 3) {
        out += String(reader.read(10)).padStart(3, '0');
        count -= 3;
      }
      if (count === 2) out += String(reader.read(7)).padStart(2, '0');
      else if (count === 1) out += String(reader.read(4));
    } else if (mode === 0x2) {
      let count = reader.read(charCountBits(0x2, version));
      while (count >= 2) {
        const v = reader.read(11);
        out += ALPHANUMERIC[Math.floor(v / 45)]! + ALPHANUMERIC[v % 45]!;
        count -= 2;
      }
      if (count === 1) out += ALPHANUMERIC[reader.read(6)]!;
    } else if (mode === 0x4) {
      const count = reader.read(charCountBits(0x4, version));
      const bytes = new Uint8Array(count);
      for (let i = 0; i < count; i++) bytes[i] = reader.read(8);
      out += new TextDecoder('utf-8').decode(bytes);
    } else if (mode === 0x7) {
      // ECI designator — read and ignore (assume UTF-8/byte follows).
      reader.read(8);
    } else {
      // Unknown/unsupported mode (e.g. Kanji) — stop parsing.
      break;
    }
  }
  return out;
}
