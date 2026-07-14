import type {
  DotStyle,
  Ecl,
  FinderDotStyle,
  FinderSquareStyle,
  Gradient,
  RenderOptions,
} from '@kroszborg/rune';

export interface ParsedArgs {
  command: 'generate' | 'decode' | 'help' | 'version';
  value?: string;
  output?: string;
  /** Input image path for the `decode` command. */
  input?: string;
  options: RenderOptions;
}

const FLAGS_WITH_VALUE = new Set([
  '--out',
  '-o',
  '--size',
  '-s',
  '--margin',
  '-m',
  '--ecl',
  '--dots',
  '--dot-color',
  '--bg',
  '--square',
  '--core',
  '--preset',
  '--gradient',
  '--frame',
  '--logo',
]);

/** Parse argv (without node/script) into a structured command. */
export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    return { command: 'help', options: { value: '' } };
  }
  if (argv[0] === '--version' || argv[0] === '-v') {
    return { command: 'version', options: { value: '' } };
  }
  if (argv[0] === 'decode') {
    return { command: 'decode', input: argv[1], options: { value: '' } };
  }

  const flags: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith('-')) {
      if (FLAGS_WITH_VALUE.has(arg)) flags[arg] = argv[++i] ?? '';
      else flags[arg] = 'true';
    } else {
      positional.push(arg);
    }
  }

  const value = positional.join(' ');
  const out = flags['--out'] ?? flags['-o'];
  const gradient = parseGradient(flags['--gradient']);

  const dotStyle = flags['--dots'] as DotStyle | undefined;
  const dots =
    dotStyle || flags['--dot-color'] || gradient
      ? { style: dotStyle, color: flags['--dot-color'], gradient }
      : undefined;

  const squareStyle = flags['--square'] as FinderSquareStyle | undefined;
  const coreStyle = flags['--core'] as FinderDotStyle | undefined;
  const corners =
    squareStyle || coreStyle
      ? {
          square: squareStyle ? { style: squareStyle } : undefined,
          dot: coreStyle ? { style: coreStyle } : undefined,
        }
      : undefined;

  const options: RenderOptions = {
    value,
    size: num(flags['--size'] ?? flags['-s']),
    margin: num(flags['--margin'] ?? flags['-m']),
    preset: flags['--preset'],
    dots,
    corners,
    background: flags['--bg'],
    qr: flags['--ecl'] ? { errorCorrectionLevel: flags['--ecl'].toUpperCase() as Ecl } : undefined,
    frame: flags['--frame'] ? { style: 'rounded', text: flags['--frame'] } : undefined,
    logo: flags['--logo'] ? { src: flags['--logo'] } : undefined,
  };

  return { command: 'generate', value, output: out, options };
}

function num(v: string | undefined): number | undefined {
  return v == null ? undefined : Number(v);
}

function parseGradient(v: string | undefined): Gradient | undefined {
  if (!v) return undefined;
  const [from, to, rot] = v.split(',');
  if (!from || !to) return undefined;
  return {
    type: 'linear',
    rotation: rot ? Number(rot) : 45,
    stops: [
      { offset: 0, color: from },
      { offset: 1, color: to },
    ],
  };
}
