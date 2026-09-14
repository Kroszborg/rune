import { type RenderOptions, renderToParts } from '../render/index.js';
import { el } from '../render/svg-builder.js';

export type RasterFormat = 'png' | 'jpeg' | 'webp';

export interface RasterOptions {
  /** Output encoding. Default `'png'`. */
  format?: RasterFormat;
  /** JPEG/WebP quality 0–1. Ignored for PNG. Default 0.92. */
  quality?: number;
  /** Background painted under transparent areas for JPEG (which has no alpha). Default white. */
  background?: string;
  /**
   * Pixel density multiplier: the bitmap is `size × scale` pixels wide. In the
   * browser this defaults to `devicePixelRatio`; in Node it defaults to 1.
   */
  scale?: number;
  /**
   * Fetch `http(s):` logo / background images and inline them as data URIs
   * before rasterising, since neither Canvas (`<img>` in secure mode) nor
   * resvg will load remote images. Default `true`. Requires `fetch`.
   */
  inlineRemoteImages?: boolean;
}

const RASTER_FORMATS: readonly RasterFormat[] = ['png', 'jpeg', 'webp'];

/** Normalise + validate raster options shared by the browser and Node paths. */
export function resolveRasterOptions(
  raster: RasterOptions,
  defaultScale: number,
): Required<Pick<RasterOptions, 'format' | 'quality' | 'scale' | 'inlineRemoteImages'>> &
  RasterOptions {
  const format = raster.format ?? 'png';
  if (!RASTER_FORMATS.includes(format)) {
    throw new RangeError(`Rune: unsupported raster format ${JSON.stringify(format)}`);
  }
  const quality = raster.quality ?? 0.92;
  if (!(quality > 0 && quality <= 1)) {
    throw new RangeError(`Rune: raster quality must be in (0, 1], got ${String(quality)}`);
  }
  const scale = raster.scale ?? defaultScale;
  if (!(Number.isFinite(scale) && scale > 0 && scale <= 16)) {
    throw new RangeError(`Rune: raster scale must be in (0, 16], got ${String(scale)}`);
  }
  return {
    ...raster,
    format,
    quality,
    scale,
    inlineRemoteImages: raster.inlineRemoteImages ?? true,
  };
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  const B = (globalThis as { Buffer?: { from(b: Uint8Array): { toString(enc: string): string } } })
    .Buffer;
  if (B) return B.from(bytes).toString('base64');
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

async function fetchAsDataUri(src: string): Promise<string> {
  const f = (globalThis as { fetch?: typeof fetch }).fetch;
  if (!f) {
    throw new Error(
      `Rune: cannot inline remote image ${src}: fetch is unavailable. Pass a data: URI instead.`,
    );
  }
  const res = await f(src);
  if (!res.ok) throw new Error(`Rune: failed to fetch image ${src} (HTTP ${res.status})`);
  const type = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
  if (!type.startsWith('image/')) {
    throw new Error(`Rune: ${src} is not an image (content-type ${type})`);
  }
  return `data:${type};base64,${bytesToBase64(new Uint8Array(await res.arrayBuffer()))}`;
}

/**
 * Return a copy of `options` whose `http(s):` logo and background images have
 * been fetched and inlined as data URIs, so raster exporters embed them.
 */
export async function inlineRemoteImages(options: RenderOptions): Promise<RenderOptions> {
  const isRemote = (s: string | undefined): s is string => !!s && /^https?:/i.test(s);
  let out = options;
  if (isRemote(options.logo?.src)) {
    out = { ...out, logo: { ...options.logo, src: await fetchAsDataUri(options.logo.src) } };
  }
  const bg = options.background;
  if (typeof bg === 'object' && bg && isRemote(bg.image)) {
    out = { ...out, background: { ...bg, image: await fetchAsDataUri(bg.image) } };
  }
  return out;
}

const hasDOM = (): boolean =>
  typeof globalThis !== 'undefined' &&
  typeof (globalThis as any).document !== 'undefined' &&
  typeof (globalThis as any).Image !== 'undefined';

/**
 * Rasterize a QR code to a data URL. Browser-only (uses Canvas). For Node use
 * `toBuffer` / `toPDF` from `@kroszborg/rune/node`. JPEG fills a solid
 * background when the QR background is transparent; PNG and WebP keep alpha.
 */
export async function toDataURL(
  options: RenderOptions,
  raster: RasterOptions = {},
): Promise<string> {
  if (!hasDOM()) {
    const worker = typeof (globalThis as any).OffscreenCanvas !== 'undefined';
    throw new Error(
      worker
        ? 'toDataURL needs a document (it rasterizes through <img>); call it from the main thread.'
        : "toDataURL requires a browser (Canvas). Use toBuffer() from '@kroszborg/rune/node' in Node.",
    );
  }
  const r = resolveRasterOptions(raster, (globalThis as any).devicePixelRatio || 1);
  const opts = r.inlineRemoteImages ? await inlineRemoteImages(options) : options;
  // Use the rendered dimensions (which include any frame) so framed codes are
  // not squished into a square canvas.
  const parts = renderToParts(opts);
  const svg = el('svg', parts.attributes, parts.body);

  const canvas = (globalThis as any).document.createElement('canvas') as HTMLCanvasElement;
  canvas.width = Math.round(parts.width * r.scale);
  canvas.height = Math.round(parts.height * r.scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not acquire a 2D canvas context');

  if (r.format === 'jpeg') {
    ctx.fillStyle = r.background ?? '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  await new Promise<void>((resolve, reject) => {
    const img = new (globalThis as any).Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve();
    };
    img.onerror = () => reject(new Error('Failed to rasterize SVG'));
    img.src = svgDataUri(svg);
  });

  return canvas.toDataURL(`image/${r.format}`, r.quality);
}
