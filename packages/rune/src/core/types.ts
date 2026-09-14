/** Error correction level per ISO/IEC 18004. */
export type Ecl = 'L' | 'M' | 'Q' | 'H';

/**
 * Any spelling of an error-correction level accepted at runtime: the letters
 * in either case, or the names `low` / `medium` / `quartile` / `high`.
 */
export type EclInput = Ecl | 'l' | 'm' | 'q' | 'h' | 'low' | 'medium' | 'quartile' | 'high';

/** Encoding mode for a QR segment. */
export type Mode = 'numeric' | 'alphanumeric' | 'byte' | 'kanji';

/**
 * A fully-encoded QR symbol: the boolean module matrix plus the metadata a
 * renderer needs. `modules[y][x]` is `true` for a dark module.
 */
export interface RuneMatrix {
  /** Side length in modules (21 for version 1 … 177 for version 40). */
  readonly size: number;
  /** Row-major grid of modules; `true` = dark. */
  readonly modules: boolean[][];
  /** Symbol version, 1–40. */
  readonly version: number;
  /** Error correction level actually used. */
  readonly ecl: Ecl;
  /** Mask pattern applied, 0–7. */
  readonly mask: number;
  /** `true` for the fixed-function modules (finders, timing, format, …). */
  readonly reserved: boolean[][];
  /**
   * Codeword layout, for damage analysis such as sizing a centre logo: which
   * codeword each module carries and which Reed–Solomon block owns it.
   */
  readonly layout: CodewordLayout;
}

/** Where every codeword lives in the symbol (advanced; see {@link RuneMatrix}). */
export interface CodewordLayout {
  /** Per module (row-major, `y * size + x`): the codeword index, or -1. */
  readonly codewordAt: Int32Array;
  /** Per codeword: the index of the Reed–Solomon block it belongs to. */
  readonly blockOf: Uint8Array;
  /** Number of Reed–Solomon blocks. */
  readonly blockCount: number;
  /**
   * Codewords per block a decoder can repair when it does not know where the
   * damage is (half the block's error-correction codewords).
   */
  readonly correctablePerBlock: number;
}

/** Options accepted by the low-level {@link encode} function. */
export interface EncodeOptions {
  /** Error correction level (any spelling in {@link EclInput}). Default `'M'`. */
  errorCorrectionLevel?: EclInput;
  /** Force a specific version 1–40. Auto-selected (smallest that fits) if omitted. */
  version?: number;
  /** Upper bound for auto version selection. Default 40. */
  maxVersion?: number;
  /** Force a mask pattern 0–7. Auto-selected (lowest penalty) if omitted. */
  mask?: number;
  /**
   * When true, allow the error correction level to be boosted for free if the
   * data still fits at the chosen version. Default `true`.
   */
  boostEcl?: boolean;
  /**
   * Emit a UTF-8 ECI designator before any non-ASCII text (ISO/IEC 18004
   * §7.4.2). Strict readers then decode accents/emoji correctly; a few legacy
   * readers choke on ECI, which is why this is opt-in. Default `false`.
   */
  eci?: boolean;
  /**
   * Use Kanji mode (13 bits per character) for runs of Shift_JIS double-byte
   * characters, which is far smaller than UTF-8 bytes. Requires a Shift_JIS
   * `TextDecoder` in the runtime (browsers and full-ICU Node have one); falls
   * back to byte mode otherwise. Default `true`.
   */
  kanji?: boolean;
}
