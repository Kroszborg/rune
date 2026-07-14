import { type RenderOptions, toSVGString } from '../render/index.js';
import type { RasterOptions } from './index.js';

/**
 * Node-only raster + PDF export. These use the optional peer dependencies
 * `@resvg/resvg-js` (PNG), `sharp` (JPEG/WebP), and `pdf-lib` (PDF), imported
 * lazily so the browser/SSR entry point stays free of native binaries.
 */

/** Rasterize to a binary buffer in Node. */
export async function toBuffer(
  options: RenderOptions,
  raster: RasterOptions = {},
): Promise<Uint8Array> {
  const format = raster.format ?? 'png';
  const svg = toSVGString(options);
  const size = options.size ?? 256;

  let resvg: typeof import('@resvg/resvg-js');
  try {
    resvg = await import('@resvg/resvg-js');
  } catch {
    throw new Error("toBuffer() needs the optional '@resvg/resvg-js' dependency.");
  }
  const r = new resvg.Resvg(svg, { fitTo: { mode: 'width', value: size } });
  const png = r.render().asPng();
  if (format === 'png') return png;

  let sharp: (input: Uint8Array) => import('sharp').Sharp;
  try {
    const mod = await import('sharp');
    sharp = mod.default as unknown as (input: Uint8Array) => import('sharp').Sharp;
  } catch {
    throw new Error("JPEG/WebP output needs the optional 'sharp' dependency.");
  }
  const pipeline = sharp(png).flatten({ background: raster.background ?? '#ffffff' });
  const quality = Math.round((raster.quality ?? 0.92) * 100);
  const out = format === 'jpeg' ? pipeline.jpeg({ quality }) : pipeline.webp({ quality });
  return new Uint8Array(await out.toBuffer());
}

/** Produce a single-page PDF containing the QR code (Node). */
export async function toPDF(options: RenderOptions): Promise<Uint8Array> {
  let pdfLib: typeof import('pdf-lib');
  try {
    pdfLib = await import('pdf-lib');
  } catch {
    throw new Error("toPDF() needs the optional 'pdf-lib' dependency.");
  }
  const png = await toBuffer(options, { format: 'png' });
  const doc = await pdfLib.PDFDocument.create();
  const image = await doc.embedPng(png);
  // Match the page to the image's real dimensions (which include any frame),
  // so framed codes are not stretched into a square page.
  const page = doc.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  return doc.save();
}
