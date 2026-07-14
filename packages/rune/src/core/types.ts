/** Error correction level per ISO/IEC 18004. */
export type Ecl = 'L' | 'M' | 'Q' | 'H';

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
}

/** Options accepted by the low-level {@link encode} function. */
export interface EncodeOptions {
  /** Error correction level. Default `'M'`. */
  errorCorrectionLevel?: Ecl;
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
}
