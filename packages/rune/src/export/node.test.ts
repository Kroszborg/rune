import jsQR from 'jsqr';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { toBuffer, toPDF } from './node.js';

const value = 'https://rune.kroszborg.co/export-test';
const magic = (b: Uint8Array, n: number) => Array.from(b.subarray(0, n));

describe('toBuffer (Node)', () => {
  it('writes a PNG that decodes back to the value', async () => {
    const png = await toBuffer({ value, size: 320 });
    expect(magic(png, 4)).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const { data, info } = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(320);
    const result = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    expect(result?.data).toBe(value);
  });

  it('honours scale and keeps frame proportions', async () => {
    const png = await toBuffer({ value, size: 200, frame: { text: 'SCAN ME' } }, { scale: 2 });
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(440); // (200 + 2*10 pad) * 2
    expect(meta.height).toBeGreaterThan(meta.width!);
  });

  it('writes JPEG (flattened) and WebP (alpha preserved)', async () => {
    const jpeg = await toBuffer({ value, background: 'transparent' }, { format: 'jpeg' });
    expect(magic(jpeg, 2)).toEqual([0xff, 0xd8]);
    expect((await sharp(jpeg).metadata()).hasAlpha).toBe(false);

    const webp = await toBuffer({ value, background: 'transparent' }, { format: 'webp' });
    expect(String.fromCharCode(...webp.subarray(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...webp.subarray(8, 12))).toBe('WEBP');
    expect((await sharp(webp).metadata()).hasAlpha).toBe(true);
  });

  it('rejects bad raster options with clear errors', async () => {
    await expect(toBuffer({ value }, { quality: 92 })).rejects.toThrow(/quality/);
    await expect(toBuffer({ value }, { format: 'gif' as 'png' })).rejects.toThrow(/format/);
    await expect(toBuffer({ value, size: 20000 })).rejects.toThrow(/size/);
    await expect(toBuffer({ value, size: 4096 }, { scale: 8 })).rejects.toThrow(/exceeds/);
  });

  it('embeds a data: URI logo and refuses unreachable remote logos', async () => {
    const pixel =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
    const png = await toBuffer({ value, logo: { src: pixel, size: 0.15 } });
    expect(png.length).toBeGreaterThan(100);
    await expect(
      toBuffer({ value, logo: { src: 'http://127.0.0.1:9/logo.png', size: 0.15 } }),
    ).rejects.toThrow();
  });
});

describe('toPDF (Node)', () => {
  it('produces a one-page PDF sized to the code, rendered at 4x for print', async () => {
    const bytes = await toPDF({ value, size: 256 });
    expect(String.fromCharCode(...bytes.subarray(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(256, 0);
    expect(height).toBeCloseTo(256, 0);
  });

  it('centres the code on a custom page at a custom print size', async () => {
    const bytes = await toPDF({ value }, { page: { width: 595, height: 842 }, printSize: 200 });
    const doc = await PDFDocument.load(bytes);
    const { width, height } = doc.getPage(0).getSize();
    expect([width, height]).toEqual([595, 842]);
  });
});
