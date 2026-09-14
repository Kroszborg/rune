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

/** Thrown when a symbol uses a mode this decoder cannot handle in this runtime. */
export class UnsupportedModeError extends Error {
  constructor(
    readonly mode: string,
    readonly indicator: number,
  ) {
    super(`Unsupported QR mode: ${mode} (indicator 0x${indicator.toString(16)})`);
    this.name = 'UnsupportedModeError';
  }
}

/** Structured Append header: this symbol's position in a multi-symbol message. */
export interface StructuredAppend {
  /** 0-based index of this symbol. */
  index: number;
  /** Number of symbols in the message. */
  total: number;
  /** XOR parity over the whole message's bytes. */
  parity: number;
}

/** What the data segments of one symbol contained. */
export interface ParsedData {
  text: string;
  structuredAppend?: StructuredAppend;
  /** Set when the symbol carries an FNC1 indicator (GS1 or AIM application data). */
  fnc1?: { position: 'first' | 'second'; applicationIndicator?: number };
}

/** Character set for an ECI assignment number (ISO/IEC 18004 Annex; common subset). */
function eciCharset(assignment: number): string {
  if (assignment === 26) return 'utf-8';
  if (assignment >= 1 && assignment <= 3) return 'iso-8859-1';
  if (assignment >= 4 && assignment <= 16) return `iso-8859-${assignment - 2}`;
  if (assignment === 20) return 'shift_jis';
  if (assignment === 25) return 'utf-16be';
  if (assignment >= 27 && assignment <= 28) return 'us-ascii';
  if (assignment === 29) return 'gb18030';
  if (assignment === 30) return 'euc-kr';
  return 'utf-8';
}

let sjisDecoder: TextDecoder | null | undefined;
function shiftJis(): TextDecoder | null {
  if (sjisDecoder === undefined) {
    try {
      sjisDecoder = new TextDecoder('shift_jis');
    } catch {
      sjisDecoder = null;
    }
  }
  return sjisDecoder;
}

/**
 * Parse decoded data codewords into text plus any Structured Append / FNC1
 * headers. Byte segments are decoded with one streaming `TextDecoder` per
 * charset, so a multibyte character split across two segments still decodes;
 * the ECI header selects the charset (UTF-8 is assumed without one). Kanji
 * segments are decoded through the runtime's Shift_JIS `TextDecoder`; where
 * that is missing (Node built with small-icu) an {@link UnsupportedModeError}
 * is thrown rather than returning truncated text.
 */
export function parseSegments(data: number[], version: number): ParsedData {
  const reader = new BitReader(data);
  const out: ParsedData = { text: '' };
  let charset = 'utf-8';
  let decoder: TextDecoder | undefined;
  const flush = () => {
    if (decoder) out.text += decoder.decode();
    decoder = undefined;
  };

  while (reader.remaining >= 4) {
    const mode = reader.read(4);
    if (mode === 0) break; // terminator

    if (mode === 0x1) {
      flush();
      let count = reader.read(charCountBits(0x1, version));
      while (count >= 3) {
        out.text += String(reader.read(10)).padStart(3, '0');
        count -= 3;
      }
      if (count === 2) out.text += String(reader.read(7)).padStart(2, '0');
      else if (count === 1) out.text += String(reader.read(4));
    } else if (mode === 0x2) {
      flush();
      let count = reader.read(charCountBits(0x2, version));
      while (count >= 2) {
        const v = reader.read(11);
        out.text += ALPHANUMERIC[Math.floor(v / 45)]! + ALPHANUMERIC[v % 45]!;
        count -= 2;
      }
      if (count === 1) out.text += ALPHANUMERIC[reader.read(6)]!;
    } else if (mode === 0x4) {
      const count = reader.read(charCountBits(0x4, version));
      const bytes = new Uint8Array(count);
      for (let i = 0; i < count; i++) bytes[i] = reader.read(8);
      if (!decoder) {
        try {
          decoder = new TextDecoder(charset);
        } catch {
          decoder = new TextDecoder('utf-8');
        }
      }
      out.text += decoder.decode(bytes, { stream: true });
    } else if (mode === 0x8) {
      flush();
      const dec = shiftJis();
      if (!dec)
        throw new UnsupportedModeError('kanji (no Shift_JIS TextDecoder in this runtime)', mode);
      const count = reader.read(charCountBits(0x8, version));
      const bytes = new Uint8Array(count * 2);
      for (let i = 0; i < count; i++) {
        // Undo ISO/IEC 18004 §7.4.6: value = (msb-diff) * 0xC0 + lsb-diff.
        const v = reader.read(13);
        let c = (Math.floor(v / 0xc0) << 8) | (v % 0xc0);
        c += c < 0x1f00 ? 0x8140 : 0xc140;
        bytes[i * 2] = c >> 8;
        bytes[i * 2 + 1] = c & 0xff;
      }
      out.text += dec.decode(bytes);
    } else if (mode === 0x7) {
      // ECI designator: 1, 2 or 3 bytes depending on the leading bits.
      flush();
      const first = reader.read(8);
      let assignment: number;
      if ((first & 0x80) === 0) assignment = first;
      else if ((first & 0xc0) === 0x80) assignment = ((first & 0x3f) << 8) | reader.read(8);
      else assignment = ((first & 0x1f) << 16) | reader.read(16);
      charset = eciCharset(assignment);
    } else if (mode === 0x3) {
      // Structured Append: 4-bit index, 4-bit total (both 0-based), 8-bit parity.
      const index = reader.read(4);
      const total = reader.read(4) + 1;
      const parity = reader.read(8);
      out.structuredAppend = { index, total, parity };
    } else if (mode === 0x5) {
      out.fnc1 = { position: 'first' };
    } else if (mode === 0x9) {
      out.fnc1 = { position: 'second', applicationIndicator: reader.read(8) };
    } else {
      throw new UnsupportedModeError('unknown', mode);
    }
  }
  flush();
  return out;
}
