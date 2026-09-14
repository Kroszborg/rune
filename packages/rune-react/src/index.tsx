import { type RenderOptions, type RuneOptions, renderToParts } from '@kroszborg/rune';
import * as React from 'react';

/** Option keys that belong to the renderer; everything else goes to the `<svg>`. */
const RENDER_KEYS = new Set<string>([
  'value',
  'size',
  'margin',
  'dots',
  'corners',
  'background',
  'logo',
  'frame',
  'qr',
  'preset',
  'ariaLabel',
  'title',
  'idPrefix',
]);

type SvgPassthrough = Omit<
  React.SVGProps<SVGSVGElement>,
  keyof RuneOptions | 'ref' | 'children' | 'dangerouslySetInnerHTML'
>;

export interface QRCodeProps extends RuneOptions, SvgPassthrough {
  /**
   * Namespace for generated gradient ids. Defaults to a React `useId()`-based
   * prefix so several identical codes on one page never share ids.
   */
  idPrefix?: string;
  /** Inline style on the root `<svg>` (or wrapper when `logoElement` is set). */
  style?: React.CSSProperties;
  /**
   * A React node rendered as the centre logo. The core clears the modules
   * behind it and picks the error-correction level exactly as it does for
   * `logo.src`; size, margin, shape and plate colour come from `logo`. When
   * both are given, `logoElement` replaces the image.
   */
  logoElement?: React.ReactNode;
}

/** Structural equality for plain option trees (objects, arrays, primitives). */
function optionsEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!optionsEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) {
      return false;
    }
  }
  return true;
}

/**
 * Return the previous options object while the new one is structurally equal,
 * so inline object literals do not defeat memoisation and no JSON.stringify
 * runs per render. The ref is only written when the value changes, and the
 * write is idempotent, so a discarded render cannot leave stale state.
 */
function useStableOptions(options: RenderOptions): RenderOptions {
  const ref = React.useRef(options);
  if (!optionsEqual(ref.current, options)) ref.current = options;
  return ref.current;
}

/** `useId()` yields `:r0:`-style ids; keep the namespace safe inside `url(#…)`. */
function useGradientPrefix(explicit: string | undefined): string {
  const id = React.useId();
  return explicit ?? `rune${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/**
 * Render a fully-customizable QR code as a real SVG element. Unknown props
 * (`id`, `onClick`, `data-*`, `tabIndex`, …) are forwarded to the `<svg>`.
 * Renders nothing while `value` is empty, so controlled inputs can start blank.
 *
 * @example
 * <QRCode value="https://example.com" dots={{ style: 'rounded' }} />
 */
export const QRCode = React.forwardRef<SVGSVGElement, QRCodeProps>(function QRCode(props, ref) {
  const { style, className, logoElement, idPrefix, ...rest } = props;
  const hasOverlay = logoElement !== undefined && logoElement !== null;

  const renderOptions: Record<string, unknown> = {};
  const svgProps: Record<string, unknown> = {};
  for (const key of Object.keys(rest)) {
    (RENDER_KEYS.has(key) ? renderOptions : svgProps)[key] = (rest as Record<string, unknown>)[key];
  }

  // An overlaid node needs a cleared plate but no <image>: drop `src` so the
  // core treats the logo as a bare plate.
  if (hasOverlay) {
    const { src: _src, ...plate } = (renderOptions.logo as RuneOptions['logo']) ?? {};
    renderOptions.logo = plate;
  }
  renderOptions.idPrefix = useGradientPrefix(idPrefix);

  const stable = useStableOptions(renderOptions as unknown as RenderOptions);
  const parts = React.useMemo(() => (stable.value ? renderToParts(stable) : null), [stable]);
  if (!parts) return null;

  const { class: _class, ...svgAttrs } = parts.attributes;
  const svg = (
    <svg
      ref={ref}
      {...(svgAttrs as React.SVGProps<SVGSVGElement>)}
      {...(svgProps as React.SVGProps<SVGSVGElement>)}
      className={className}
      style={hasOverlay ? { display: 'block', width: '100%', height: 'auto' } : style}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: content is library-generated SVG.
      dangerouslySetInnerHTML={{ __html: parts.body }}
    />
  );

  if (!hasOverlay) return svg;

  // Position the node over the cleared plate, in percentages so the wrapper
  // may be resized freely (and so a frame's padding/CTA band is accounted for).
  const box = parts.logo ?? {
    x: parts.width * 0.375,
    y: parts.height * 0.375,
    width: parts.width * 0.25,
    height: parts.height * 0.25,
  };
  const pct = (n: number, of: number) => `${(n / of) * 100}%`;
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        width: parts.width,
        lineHeight: 0,
        ...style,
      }}
    >
      {svg}
      <span
        style={{
          position: 'absolute',
          left: pct(box.x, parts.width),
          top: pct(box.y, parts.height),
          width: pct(box.width, parts.width),
          height: pct(box.height, parts.height),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 'normal',
        }}
      >
        {logoElement}
      </span>
    </span>
  );
});

// Re-export the entire core API so consumers can import from one place and new
// core exports propagate automatically.
export * from '@kroszborg/rune';
