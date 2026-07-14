import { type RenderOptions, renderToParts } from '../render/index.js';
import { el } from '../render/svg-builder.js';

export type RasterFormat = 'png' | 'jpeg' | 'webp';

export interface RasterOptions {
  format?: RasterFormat;
  /** JPEG/WebP quality 0–1. Ignored for PNG. */
  quality?: number;
  /** Background painted under transparent areas for JPEG. Default white. */
  background?: string;
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const hasDOM = (): boolean =>
  typeof globalThis !== 'undefined' &&
  typeof (globalThis as any).document !== 'undefined' &&
  typeof (globalThis as any).Image !== 'undefined';

/**
 * Rasterize a QR code to a data URL. Browser-only (uses Canvas). For Node use
 * `toBuffer` / `toPDF` from `@kroszborg/rune/node`. JPEG fills a solid
 * background when the QR background is transparent.
 */
export async function toDataURL(
  options: RenderOptions,
  raster: RasterOptions = {},
): Promise<string> {
  if (!hasDOM()) {
    throw new Error(
      "toDataURL requires a browser (Canvas). Use toBuffer() from '@kroszborg/rune/node' in Node.",
    );
  }
  const format = raster.format ?? 'png';
  // Use the rendered dimensions (which include any frame) so framed codes are
  // not squished into a square canvas.
  const parts = renderToParts(options);
  const svg = el('svg', parts.attributes, parts.body);

  const canvas = (globalThis as any).document.createElement('canvas') as HTMLCanvasElement;
  const scale = (globalThis as any).devicePixelRatio || 1;
  canvas.width = Math.round(parts.width * scale);
  canvas.height = Math.round(parts.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not acquire a 2D canvas context');

  if (format !== 'png') {
    ctx.fillStyle = raster.background ?? '#ffffff';
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

  return canvas.toDataURL(`image/${format}`, raster.quality);
}
