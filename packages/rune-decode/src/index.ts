/**
 * @kroszborg/rune-decode — a from-scratch QR decoder.
 *
 * `decodeMatrix` decodes a sampled module grid (the algorithmic core: format,
 * unmask, de-interleave, Reed–Solomon correction, segment parse). `decode`
 * decodes raw RGBA pixels via finder detection + affine grid sampling.
 */
export { decodeMatrix } from './matrix-decode.js';
export type { MatrixDecodeResult } from './matrix-decode.js';
export { decode } from './image.js';
export type { ImageInput } from './image.js';
export type { Ecl } from './tables.js';
