import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ALIGNMENT_STYLES,
  DOT_STYLES,
  FINDER_SQUARE_STYLES,
  PRESETS,
  toSVGString,
  validateOptions,
} from '@kroszborg/rune';
import { parseArgs } from './args.js';

const HELP = `rune — generate customizable QR codes

Usage:
  rune <value> [options]
  rune "https://example.com" -o qr.png --dots rounded --preset mint
  echo "https://example.com" | rune - -o qr.svg
  rune decode <image>          Decode a QR code from a PNG/JPEG/WebP image

Output:
  -o, --out <file>       Output file (.svg .png .jpg .jpeg .webp .pdf). SVG to stdout if omitted;
                         "-o -" writes the chosen format to stdout (use with --format via extension).
  -s, --size <px>        Size in CSS pixels (default 256)
      --scale <n>        Raster pixel density multiplier (default 1; PDF default 4)
      --quality <0-1>    JPEG/WebP quality (default 0.92)
  -m, --margin <n>       Quiet-zone modules (default 4)

Style:
      --preset <name>    ${Object.keys(PRESETS).join(' | ')}
      --dots <style>     ${DOT_STYLES.join(' | ')}
      --dot-color <c>    Data-module color
      --gradient <a,b,r> Linear gradient "from,to[,rotation]" for the dots
      --bg <color>       Background color ('transparent' allowed)
      --square <style>   Finder ring: ${FINDER_SQUARE_STYLES.join(' | ')}
      --core <style>     Finder core: square | rounded | dot
      --alignment <s>    Alignment patterns: ${ALIGNMENT_STYLES.join(' | ')}
      --frame <text>     Frame with CTA text (e.g. "SCAN ME")
      --frame-style <s>  none | square | rounded (default rounded)
      --frame-color <c>  Frame + CTA color
      --logo <src>       Logo image: path, URL or data: URI (paths/URLs are inlined for raster output)
      --logo-size <0-.3> Logo width as a fraction of the QR (default 0.25)
      --logo-shape <s>   square | rounded | circle
      --no-clamp         Keep the exact logo size even if it exceeds the safe budget

Encoding:
      --ecl <L|M|Q|H>    Error correction level (default M, or the lowest level that covers the logo)
      --qr-version <n>   Pin symbol version 1-40
      --mask <0-7>       Pin mask pattern
      --eci              Emit a UTF-8 ECI header for non-ASCII text
      --title <text>     <title> element inside the SVG
      --aria-label <t>   Accessible label
  --                     Treat everything after as the value (for values starting with '-')

  -h, --help             Show this help
  -v, --version          Show version
`;

const require = createRequire(import.meta.url);
const VERSION: string = (require('../package.json') as { version: string }).version;

const RASTER_EXT: Record<string, 'png' | 'jpeg' | 'webp'> = {
  '.png': 'png',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.webp': 'webp',
};

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks)
    .toString('utf8')
    .replace(/\r?\n$/, '');
}

/** A local logo path is read and inlined so raster exporters can embed it. */
async function inlineLocalLogo(src: string): Promise<string> {
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  const path = isAbsolute(src) ? src : resolve(process.cwd(), src);
  const bytes = await readFile(path);
  const ext = extname(path).toLowerCase();
  const type =
    ext === '.svg'
      ? 'image/svg+xml'
      : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
          ? 'image/webp'
          : 'image/png';
  return `data:${type};base64,${bytes.toString('base64')}`;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.command === 'help') {
    process.stdout.write(HELP);
    return;
  }
  if (parsed.command === 'version') {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (parsed.command === 'decode') {
    await runDecode(parsed.input);
    return;
  }

  const options = { ...parsed.options };
  if (parsed.stdin || (!options.value && !process.stdin.isTTY)) {
    options.value = [options.value, await readStdin()].filter(Boolean).join(' ');
  }
  if (!options.value) {
    process.stderr.write('error: no value to encode. Try `rune --help`.\n');
    process.exitCode = 1;
    return;
  }
  // Surface bad option values before any output is written.
  validateOptions(options);
  if (options.logo?.src)
    options.logo = { ...options.logo, src: await inlineLocalLogo(options.logo.src) };

  const { output, raster } = parsed;

  if (!output) {
    process.stdout.write(`${toSVGString(options)}\n`);
    return;
  }

  const toStdout = output === '-';
  const ext = toStdout ? '.svg' : extname(output).toLowerCase();
  let bytes: Uint8Array | string;
  if (ext === '.svg') {
    bytes = toSVGString(options);
  } else if (ext === '.pdf') {
    const { toPDF } = await import('@kroszborg/rune/node');
    bytes = await toPDF(options, raster);
  } else if (RASTER_EXT[ext]) {
    const { toBuffer } = await import('@kroszborg/rune/node');
    bytes = await toBuffer(options, { ...raster, format: RASTER_EXT[ext] });
  } else {
    process.stderr.write(
      `error: unsupported output extension '${ext}'. Use .svg, .png, .jpg, .jpeg, .webp or .pdf.\n`,
    );
    process.exitCode = 1;
    return;
  }
  if (toStdout) {
    process.stdout.write(bytes);
    return;
  }
  await writeFile(output, bytes);
  process.stderr.write(`Wrote ${output}\n`);
}

/** Decode a QR code from an image file (needs the optional `sharp` dependency). */
async function runDecode(input: string | undefined): Promise<void> {
  if (!input) {
    process.stderr.write('error: `rune decode <image>` needs an image path.\n');
    process.exitCode = 1;
    return;
  }
  let sharpMod: (input: string) => import('sharp').Sharp;
  try {
    sharpMod = (await import('sharp')).default as unknown as (
      input: string,
    ) => import('sharp').Sharp;
  } catch (cause) {
    process.stderr.write(
      `error: \`rune decode\` needs the optional 'sharp' dependency (npm i -g sharp). ${
        cause instanceof Error ? cause.message : ''
      }\n`,
    );
    process.exitCode = 1;
    return;
  }
  const { decode } = await import('@kroszborg/rune-decode');
  const { data, info } = await sharpMod(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = decode({
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height,
  });
  if (!result) {
    process.stderr.write('error: no QR code found.\n');
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${result.text}\n`);
}

// Only run when executed directly (not when imported by tests).
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  // A closed pipe (`rune … | head`) is not an error.
  process.stdout.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EPIPE') process.exit(0);
  });
  main().catch((err) => {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}

export { main };
