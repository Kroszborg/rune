import { writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { toSVGString } from '@kroszborg/rune';
import { parseArgs } from './args.js';

const HELP = `rune — generate customizable QR codes

Usage:
  rune <value> [options]
  rune "https://example.com" -o qr.png --dots rounded --preset mint
  rune decode <image>        Decode a QR code from a PNG/JPEG image

Options:
  -o, --out <file>       Output file (.svg .png .jpeg .webp .pdf). Prints SVG to stdout if omitted.
  -s, --size <px>        Size in pixels (default 256)
  -m, --margin <n>       Quiet-zone modules (default 4)
      --ecl <L|M|Q|H>    Error correction level (default M)
      --dots <style>     square | dot | rounded | classy | diamond | star
      --dot-color <c>    Data-module color
      --gradient <a,b,r> Linear gradient "from,to[,rotation]"
      --bg <color>       Background color ('transparent' allowed)
      --square <style>   Finder ring: square | rounded | extra-rounded | circle | leaf
      --core <style>     Finder core: square | rounded | dot
      --frame <text>     Frame with CTA text (e.g. "SCAN ME")
      --logo <src>       Logo image URL/path
      --preset <name>    minimal | dots | fluid | mint | midnight | sunset
  -h, --help             Show this help
  -v, --version          Show version
`;

const VERSION = '0.1.0';

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
  if (!parsed.value) {
    process.stderr.write('error: no value to encode. Try `rune --help`.\n');
    process.exitCode = 1;
    return;
  }

  const { options, output } = parsed;

  if (!output) {
    process.stdout.write(`${toSVGString(options)}\n`);
    return;
  }

  const ext = extname(output).toLowerCase();
  if (ext === '.svg') {
    await writeFile(output, toSVGString(options), 'utf8');
  } else if (ext === '.pdf') {
    const { toPDF } = await import('@kroszborg/rune/node');
    await writeFile(output, await toPDF(options));
  } else if (ext === '.png' || ext === '.jpeg' || ext === '.jpg' || ext === '.webp') {
    const { toBuffer } = await import('@kroszborg/rune/node');
    const format = ext === '.jpg' ? 'jpeg' : (ext.slice(1) as 'png' | 'jpeg' | 'webp');
    await writeFile(output, await toBuffer(options, { format }));
  } else {
    process.stderr.write(`error: unsupported output extension '${ext}'.\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`Wrote ${output}\n`);
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
  } catch {
    process.stderr.write("error: `rune decode` needs the optional 'sharp' dependency.\n");
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

main().catch((err) => {
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
