import { type RenderOptions, renderToParts } from '../render/index.js';
import { el } from '../render/svg-builder.js';
import { type RasterOptions, inlineRemoteImages, resolveRasterOptions } from './index.js';

/**
 * Node-only raster + PDF export. These use the optional peer dependencies
 * `@resvg/resvg-js` (PNG), `sharp` (JPEG/WebP), and `pdf-lib` (PDF), imported
 * lazily so the browser/SSR entry point stays free of native binaries.
 */

/** Largest bitmap edge we will ask a rasterizer for. */
const MAX_PIXELS = 16384;

// Literal `import()` specifiers keep bundlers able to mark these external; a
// variable specifier would produce "critical dependency" warnings in webpack.
async function loadPeer<T>(load: () => Promise<T>, name: string, purpose: string): Promise<T> {
  try {
    return await load();
  } catch (cause) {
    const err = new Error(
      `Rune: ${purpose} needs the optional peer dependency '${name}'. Install it with \`npm i ${name}\`. ` +
        'If it is installed, its native binary failed to load (see the error cause).',
    );
    (err as Error & { cause?: unknown }).cause = cause;
    throw err;
  }
}

export interface PdfOptions extends RasterOptions {
  /**
   * Page width/height in PDF points. Defaults to the QR's rendered size at
   * 1 pt per CSS px. Pass e.g. `{ width: 595, height: 842 }` for A4 and the
   * code is centred.
   */
  page?: { width: number; height: number };
  /** Printed size of the QR on the page, in points. Defaults to the QR's rendered size. */
  printSize?: number;
}

/** Rasterize to a binary buffer in Node (PNG via resvg; JPEG/WebP via sharp). */
export async function toBuffer(
  options: RenderOptions,
  raster: RasterOptions = {},
): Promise<Uint8Array> {
  const r = resolveRasterOptions(raster, 1);
  const opts = r.inlineRemoteImages ? await inlineRemoteImages(options) : options;
  const parts = renderToParts(opts);
  const svg = el('svg', parts.attributes, parts.body);
  const widthPx = Math.round(parts.width * r.scale);
  if (widthPx > MAX_PIXELS || Math.round(parts.height * r.scale) > MAX_PIXELS) {
    throw new RangeError(`Rune: raster output exceeds ${MAX_PIXELS}px; lower size or scale`);
  }

  const resvg = await loadPeer(() => import('@resvg/resvg-js'), '@resvg/resvg-js', 'toBuffer()');
  const png = new resvg.Resvg(svg, { fitTo: { mode: 'width', value: widthPx } }).render().asPng();
  if (r.format === 'png') return png;

  const mod = await loadPeer(() => import('sharp'), 'sharp', 'JPEG/WebP output');
  const sharp = mod.default;
  const quality = Math.round(r.quality * 100);
  let pipeline = sharp(png);
  // JPEG has no alpha: flatten onto the requested background. WebP keeps it.
  if (r.format === 'jpeg') pipeline = pipeline.flatten({ background: r.background ?? '#ffffff' });
  const out = r.format === 'jpeg' ? pipeline.jpeg({ quality }) : pipeline.webp({ quality });
  return new Uint8Array(await out.toBuffer());
}

/**
 * Produce a single-page PDF containing the QR code (Node). The code is
 * embedded as a PNG rendered at `scale` (default 4, about 288 dpi at 1 pt per
 * px) so print output is crisp.
 */
export async function toPDF(options: RenderOptions, pdf: PdfOptions = {}): Promise<Uint8Array> {
  const pdfLib = await loadPeer(() => import('pdf-lib'), 'pdf-lib', 'toPDF()');
  const png = await toBuffer(options, { ...pdf, format: 'png', scale: pdf.scale ?? 4 });
  const doc = await pdfLib.PDFDocument.create();
  const image = await doc.embedPng(png);
  // Logical size in points is the CSS size (so a 256px QR prints 256pt wide),
  // regardless of the raster scale used for crispness.
  const scale = pdf.scale ?? 4;
  const logicalW = image.width / scale;
  const logicalH = image.height / scale;
  const printW = pdf.printSize ?? logicalW;
  const printH = printW * (logicalH / logicalW);
  const pageW = pdf.page?.width ?? printW;
  const pageH = pdf.page?.height ?? printH;
  const page = doc.addPage([pageW, pageH]);
  page.drawImage(image, {
    x: (pageW - printW) / 2,
    y: (pageH - printH) / 2,
    width: printW,
    height: printH,
  });
  return doc.save();
}
