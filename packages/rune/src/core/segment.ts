import { BitBuffer } from './bit-buffer.js';
import type { Mode } from './types.js';

/** Mode indicator 4-bit values (ISO/IEC 18004 Table 2). */
const MODE_INDICATOR: Record<Mode, number> = {
  numeric: 0x1,
  alphanumeric: 0x2,
  byte: 0x4,
  kanji: 0x8,
};

/** Alphanumeric mode character set, index = value 0–44. */
const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

const NUMERIC_RE = /^[0-9]*$/;
const ALPHANUMERIC_RE = /^[0-9A-Z $%*+\-./:]*$/;

/** Number of bits in the character-count indicator for a mode + version. */
export function charCountBits(mode: Mode, version: number): number {
  const group = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  switch (mode) {
    case 'numeric':
      return [10, 12, 14][group]!;
    case 'alphanumeric':
      return [9, 11, 13][group]!;
    case 'byte':
      return [8, 16, 16][group]!;
    case 'kanji':
      return [8, 10, 12][group]!;
  }
}

/** A single encodable run of data in one mode. */
export interface Segment {
  readonly mode: Mode;
  /** Number of characters (numeric/alnum) or bytes (byte mode). */
  readonly count: number;
  /** Raw data bits (excluding mode + count indicators). */
  readonly data: number[];
}

function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Build the single most compact segment covering the whole string. */
export function makeSegment(text: string): Segment {
  if (text === '') {
    return { mode: 'byte', count: 0, data: [] };
  }
  if (NUMERIC_RE.test(text)) return makeNumeric(text);
  if (ALPHANUMERIC_RE.test(text)) return makeAlphanumeric(text);
  return makeByte(text);
}

function makeNumeric(text: string): Segment {
  const bb = new BitBuffer();
  for (let i = 0; i < text.length; i += 3) {
    const chunk = text.slice(i, i + 3);
    bb.append(Number.parseInt(chunk, 10), chunk.length * 3 + 1);
  }
  return { mode: 'numeric', count: text.length, data: bb.bits };
}

function makeAlphanumeric(text: string): Segment {
  const bb = new BitBuffer();
  for (let i = 0; i < text.length; i += 2) {
    if (i + 1 < text.length) {
      const v = ALPHANUMERIC.indexOf(text[i]!) * 45 + ALPHANUMERIC.indexOf(text[i + 1]!);
      bb.append(v, 11);
    } else {
      bb.append(ALPHANUMERIC.indexOf(text[i]!), 6);
    }
  }
  return { mode: 'alphanumeric', count: text.length, data: bb.bits };
}

function makeByte(text: string): Segment {
  const bytes = utf8Bytes(text);
  const bb = new BitBuffer();
  for (const b of bytes) bb.append(b, 8);
  return { mode: 'byte', count: bytes.length, data: bb.bits };
}

/** Total bits needed to encode `segment` at `version` (incl. headers). */
export function segmentBitLength(segment: Segment, version: number): number {
  return 4 + charCountBits(segment.mode, version) + segment.data.length;
}

/** Serialize a segment's header + data into a bit buffer. */
export function writeSegment(bb: BitBuffer, segment: Segment, version: number): void {
  bb.append(MODE_INDICATOR[segment.mode], 4);
  bb.append(segment.count, charCountBits(segment.mode, version));
  for (const bit of segment.data) bb.bits.push(bit);
}
