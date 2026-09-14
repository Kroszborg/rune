import { BitBuffer } from './bit-buffer.js';
import type { Mode } from './types.js';

/** Mode indicator 4-bit values (ISO/IEC 18004 Table 2). */
const MODE_INDICATOR: Record<Mode, number> = {
  numeric: 0x1,
  alphanumeric: 0x2,
  byte: 0x4,
  kanji: 0x8,
};

/** ECI mode indicator + the ECI assignment number for UTF-8 (ISO/IEC 18004 §7.4.2). */
const ECI_MODE_INDICATOR = 0x7;
export const ECI_UTF8 = 26;

/** Alphanumeric mode character set, index = value 0–44. */
const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

const NUMERIC_RE = /^[0-9]*$/;
const ALPHANUMERIC_RE = /^[0-9A-Z $%*+\-./:]*$/;

/** Number of bits in the character-count indicator for a mode + version. */
export function charCountBits(mode: Mode, version: number): number {
  const group = versionGroup(version);
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

/** Versions share character-count widths in three groups: 1–9, 10–26, 27–40. */
export function versionGroup(version: number): 0 | 1 | 2 {
  return version <= 9 ? 0 : version <= 26 ? 1 : 2;
}

/** A single encodable run of data in one mode. */
export interface Segment {
  readonly mode: Mode;
  /** Number of characters (numeric/alnum) or bytes (byte mode). */
  readonly count: number;
  /** Raw data bits (excluding mode + count indicators). */
  readonly data: number[];
}

const UTF8 = new TextEncoder();

function utf8Bytes(text: string): Uint8Array {
  return UTF8.encode(text);
}

/** True when every character is 7-bit ASCII (byte mode then needs no ECI). */
export function isAscii(text: string): boolean {
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) > 0x7f) return false;
  return true;
}

let kanjiMap: Map<number, number> | null | undefined;

/**
 * Code point → 13-bit Kanji-mode value (ISO/IEC 18004 §7.4.6), for every
 * double-byte Shift_JIS character in the two Kanji ranges. Built once, lazily,
 * by decoding each candidate byte pair with the runtime's own Shift_JIS
 * `TextDecoder`, so no conversion table ships in the bundle. Returns `null`
 * where the runtime lacks that decoder (Node built with small-icu): Kanji
 * mode is then simply not used and text falls back to byte/UTF-8.
 */
export function kanjiTable(): Map<number, number> | null {
  if (kanjiMap !== undefined) return kanjiMap;
  try {
    const dec = new TextDecoder('shift_jis', { fatal: true });
    const map = new Map<number, number>();
    const pair = new Uint8Array(2);
    const scan = (lo: number, hi: number, base: number) => {
      for (let b = lo; b <= hi; b++) {
        const b2 = b & 0xff;
        if (b2 < 0x40 || b2 === 0x7f || b2 > 0xfc) continue;
        pair[0] = b >> 8;
        pair[1] = b2;
        let s: string;
        try {
          s = dec.decode(pair);
        } catch {
          continue;
        }
        if (s.length !== 1 || s.charCodeAt(0) < 0x80) continue;
        const cp = s.charCodeAt(0);
        if (!map.has(cp)) {
          const d = b - base;
          map.set(cp, (d >> 8) * 0xc0 + (d & 0xff));
        }
      }
    };
    scan(0x8140, 0x9ffc, 0x8140);
    scan(0xe040, 0xebbf, 0xc140);
    kanjiMap = map.size > 1000 ? map : null;
  } catch {
    kanjiMap = null;
  }
  return kanjiMap;
}

/** Build the single most compact segment covering the whole string. */
export function makeSegment(text: string, allowKanji = true): Segment {
  if (text === '') {
    return { mode: 'byte', count: 0, data: [] };
  }
  if (NUMERIC_RE.test(text)) return makeNumeric(text);
  if (ALPHANUMERIC_RE.test(text)) return makeAlphanumeric(text);
  if (allowKanji && !isAscii(text)) {
    const table = kanjiTable();
    if (table && Array.from(text).every((c) => c.length === 1 && table.has(c.charCodeAt(0)))) {
      return makeKanji(text, table);
    }
  }
  return makeByte(text);
}

/**
 * Split `text` into the sequence of segments that needs the fewest bits for a
 * symbol in `version`'s character-count group (ISO/IEC 18004 Annex J, solved
 * exactly with dynamic programming rather than the heuristic look-ahead).
 *
 * Mixed payloads such as `https://x.co/r/1234567890123` come out as a byte
 * segment followed by a numeric one, often saving a whole version.
 */
export function makeSegments(text: string, version: number, allowKanji = true): Segment[] {
  if (text === '') return [makeSegment('')];
  const chars = Array.from(text);
  if (chars.length === 1) return [makeSegment(text, allowKanji)];

  // Costs are in sixths of a bit so that numeric (10/3) and alphanumeric
  // (11/2) per-character costs stay integral.
  const MODES = ['numeric', 'alphanumeric', 'byte', 'kanji'] as const;
  const headerCost = MODES.map((m) => (4 + charCountBits(m, version)) * 6);
  const n = chars.length;
  const kanji = allowKanji && !isAscii(text) ? kanjiTable() : null;

  // charCost[i][m] = cost of encoding chars[i] in mode m, or Infinity.
  const charCost = new Array<Int32Array>(n);
  for (let i = 0; i < n; i++) {
    const c = chars[i]!;
    const costs = new Int32Array(4);
    costs[0] = NUMERIC_RE.test(c) && c !== '' ? 20 : 0x7fffffff;
    costs[1] = ALPHANUMERIC_RE.test(c) ? 33 : 0x7fffffff;
    costs[2] = utf8Bytes(c).length * 48;
    costs[3] = kanji && c.length === 1 && kanji.has(c.charCodeAt(0)) ? 78 : 0x7fffffff;
    charCost[i] = costs;
  }

  // dp[i][m] = min cost to encode chars[0..i] with chars[i] in mode m.
  const INF = Number.POSITIVE_INFINITY;
  const dp: number[][] = Array.from({ length: n }, () => [INF, INF, INF, INF]);
  const prev: number[][] = Array.from({ length: n }, () => [-1, -1, -1, -1]);

  for (let m = 0; m < 4; m++) {
    const cc = charCost[0]![m]!;
    if (cc < 0x7fffffff) dp[0]![m] = headerCost[m]! + cc;
  }
  for (let i = 1; i < n; i++) {
    for (let m = 0; m < 4; m++) {
      const cc = charCost[i]![m]!;
      if (cc >= 0x7fffffff) continue;
      // Continue the same mode (no new header), or switch from any other.
      let best = dp[i - 1]![m]! + cc;
      let from = m;
      for (let k = 0; k < 4; k++) {
        if (k === m) continue;
        // A numeric/alphanumeric run must end on a whole-character boundary,
        // so round the previous run's fractional bits up before switching.
        const cand = Math.ceil(dp[i - 1]![k]! / 6) * 6 + headerCost[m]! + cc;
        if (cand < best) {
          best = cand;
          from = k;
        }
      }
      dp[i]![m] = best;
      prev[i]![m] = from;
    }
  }

  // Pick the cheapest final mode, then walk back to recover the mode per char.
  let mode = 0;
  for (let m = 1; m < 4; m++) if (dp[n - 1]![m]! < dp[n - 1]![mode]!) mode = m;
  const modes = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    modes[i] = mode;
    mode = prev[i]![mode]!;
  }

  // Group consecutive characters with the same mode into segments.
  const segments: Segment[] = [];
  let start = 0;
  for (let i = 1; i <= n; i++) {
    if (i === n || modes[i] !== modes[start]) {
      const run = chars.slice(start, i).join('');
      const m = MODES[modes[start]!]!;
      segments.push(
        m === 'numeric'
          ? makeNumeric(run)
          : m === 'alphanumeric'
            ? makeAlphanumeric(run)
            : m === 'kanji'
              ? makeKanji(run, kanji!)
              : makeByte(run),
      );
      start = i;
    }
  }
  return segments;
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

/** 13 bits per character, per ISO/IEC 18004 §7.4.6. */
function makeKanji(text: string, table: Map<number, number>): Segment {
  const bb = new BitBuffer();
  for (const ch of text) bb.append(table.get(ch.charCodeAt(0))!, 13);
  return { mode: 'kanji', count: Array.from(text).length, data: bb.bits };
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

/** Total bits for a whole segment list (plus an optional ECI header). */
export function segmentsBitLength(segments: Segment[], version: number, eci: boolean): number {
  let total = eci ? 12 : 0;
  for (const s of segments) total += segmentBitLength(s, version);
  return total;
}

/** Serialize a segment's header + data into a bit buffer. */
export function writeSegment(bb: BitBuffer, segment: Segment, version: number): void {
  bb.append(MODE_INDICATOR[segment.mode], 4);
  bb.append(segment.count, charCountBits(segment.mode, version));
  for (const bit of segment.data) bb.bits.push(bit);
}

/** Write the UTF-8 ECI designator (4-bit mode + 8-bit assignment number). */
export function writeEciUtf8(bb: BitBuffer): void {
  bb.append(ECI_MODE_INDICATOR, 4);
  bb.append(ECI_UTF8, 8);
}
