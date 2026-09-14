import type {
  AlignmentStyle,
  DotStyle,
  EclInput,
  FinderDotStyle,
  FinderSquareStyle,
  FrameOptions,
  Gradient,
  RenderOptions,
} from '@kroszborg/rune';

export interface ParsedArgs {
  command: 'generate' | 'decode' | 'help' | 'version';
  value?: string;
  /** Output path; `-` means binary/SVG to stdout. */
  output?: string;
  /** Read the value from stdin (`-` positional or `--stdin`). */
  stdin?: boolean;
  /** Input image path for the `decode` command. */
  input?: string;
  options: RenderOptions;
  /** Raster options for PNG/JPEG/WebP/PDF output. */
  raster: { quality?: number; scale?: number; background?: string };
}

/** Every flag the CLI understands, with its canonical spelling. */
const ALIASES: Record<string, string> = {
  '-o': '--out',
  '-s': '--size',
  '-m': '--margin',
  '-h': '--help',
  '-v': '--version',
};

const FLAGS_WITH_VALUE = new Set([
  '--out',
  '--size',
  '--margin',
  '--ecl',
  '--dots',
  '--dot-color',
  '--bg',
  '--square',
  '--core',
  '--alignment',
  '--preset',
  '--gradient',
  '--frame',
  '--frame-style',
  '--frame-color',
  '--logo',
  '--logo-size',
  '--logo-shape',
  '--qr-version',
  '--mask',
  '--quality',
  '--scale',
  '--title',
  '--aria-label',
]);

const BOOLEAN_FLAGS = new Set(['--help', '--version', '--eci', '--stdin', '--no-clamp']);

/** Parse argv (without node/script) into a structured command. Throws on unknown flags. */
export function parseArgs(argv: string[]): ParsedArgs {
  const empty: ParsedArgs = { command: 'help', options: { value: '' }, raster: {} };
  if (argv.length === 0) return empty;
  if (argv[0] === 'help') return empty;
  if (argv[0] === 'decode') {
    if (argv.length > 2) throw new Error(`unexpected argument '${argv[2]}' after decode <image>`);
    return { ...empty, command: 'decode', input: argv[1] };
  }

  const flags: Record<string, string> = {};
  const positional: string[] = [];
  let onlyPositional = false;
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i]!;
    if (onlyPositional || raw === '-' || !raw.startsWith('-')) {
      positional.push(raw);
      continue;
    }
    if (raw === '--') {
      onlyPositional = true;
      continue;
    }
    // Support --flag=value as well as --flag value.
    const eq = raw.indexOf('=');
    const name0 = eq > 0 ? raw.slice(0, eq) : raw;
    const arg = ALIASES[name0] ?? name0;
    if (BOOLEAN_FLAGS.has(arg)) {
      flags[arg] = 'true';
    } else if (FLAGS_WITH_VALUE.has(arg)) {
      const value = eq > 0 ? raw.slice(eq + 1) : argv[++i];
      if (value === undefined) throw new Error(`flag ${arg} needs a value`);
      flags[arg] = value;
    } else {
      throw new Error(`unknown flag '${raw}'. Try \`rune --help\`.`);
    }
  }

  if (flags['--help']) return empty;
  if (flags['--version']) return { ...empty, command: 'version' };

  const stdin = flags['--stdin'] === 'true' || positional.includes('-');
  const value = positional.filter((p) => p !== '-').join(' ');
  const gradient = parseGradient(flags['--gradient']);

  const dotStyle = flags['--dots'] as DotStyle | undefined;
  const dots =
    dotStyle || flags['--dot-color'] || gradient
      ? { style: dotStyle, color: flags['--dot-color'], gradient }
      : undefined;

  const squareStyle = flags['--square'] as FinderSquareStyle | undefined;
  const coreStyle = flags['--core'] as FinderDotStyle | undefined;
  const alignStyle = flags['--alignment'] as AlignmentStyle | undefined;
  const corners =
    squareStyle || coreStyle || alignStyle
      ? {
          square: squareStyle ? { style: squareStyle } : undefined,
          dot: coreStyle ? { style: coreStyle } : undefined,
          alignment: alignStyle ? { style: alignStyle } : undefined,
        }
      : undefined;

  const qr =
    flags['--ecl'] || flags['--qr-version'] || flags['--mask'] || flags['--eci']
      ? {
          errorCorrectionLevel: flags['--ecl'] as EclInput | undefined,
          version: num(flags['--qr-version'], '--qr-version'),
          mask: num(flags['--mask'], '--mask'),
          eci: flags['--eci'] === 'true' || undefined,
        }
      : undefined;

  const frame =
    flags['--frame'] || flags['--frame-style']
      ? {
          style: (flags['--frame-style'] as FrameOptions['style']) ?? 'rounded',
          text: flags['--frame'],
          color: flags['--frame-color'],
        }
      : undefined;

  const options: RenderOptions = {
    value,
    size: num(flags['--size'], '--size'),
    margin: num(flags['--margin'], '--margin'),
    preset: flags['--preset'],
    dots,
    corners,
    background: flags['--bg'],
    qr,
    frame,
    logo: flags['--logo']
      ? {
          src: flags['--logo'],
          size: num(flags['--logo-size'], '--logo-size'),
          shape: flags['--logo-shape'] as 'square' | 'rounded' | 'circle' | undefined,
          clamp: flags['--no-clamp'] ? false : undefined,
        }
      : undefined,
    title: flags['--title'],
    ariaLabel: flags['--aria-label'],
  };

  return {
    command: 'generate',
    value,
    stdin,
    output: flags['--out'],
    options,
    raster: {
      quality: num(flags['--quality'], '--quality'),
      scale: num(flags['--scale'], '--scale'),
    },
  };
}

function num(v: string | undefined, flag: string): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  if (v.trim() === '' || !Number.isFinite(n))
    throw new Error(`${flag} expects a number, got '${v}'`);
  return n;
}

function parseGradient(v: string | undefined): Gradient | undefined {
  if (!v) return undefined;
  const [from, to, rot] = v.split(',');
  if (!from || !to) throw new Error(`--gradient expects "from,to[,rotation]", got '${v}'`);
  return {
    type: 'linear',
    rotation: rot ? num(rot, '--gradient rotation') : 45,
    stops: [
      { offset: 0, color: from },
      { offset: 1, color: to },
    ],
  };
}
