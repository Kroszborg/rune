import { type RenderOptions, renderToParts } from '@kroszborg/rune';
import * as React from 'react';

export interface QRCodeProps extends RenderOptions {
  /** Inline style on the root `<svg>` (or wrapper when `logoElement` is set). */
  style?: React.CSSProperties;
  /**
   * A React node rendered centered on top of the QR (logo). Takes visual
   * priority over `logo.src`. Pair with `logo.hideDots` / `qr.errorCorrectionLevel: 'H'`
   * for a clean, scannable result.
   */
  logoElement?: React.ReactNode;
}

/** Stable dependency key for memoization without deep-compare libraries. */
function useStableKey(options: RenderOptions): string {
  return React.useMemo(() => JSON.stringify(options), [options]);
}

/**
 * Render a fully-customizable QR code as a real SVG element.
 *
 * @example
 * <QRCode value="https://example.com" dots={{ style: 'rounded' }} />
 */
export const QRCode = React.forwardRef<SVGSVGElement, QRCodeProps>(function QRCode(props, ref) {
  const { style, className, logoElement, ...options } = props;
  const key = useStableKey(options);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` captures all option changes.
  const parts = React.useMemo(() => renderToParts(options), [key]);

  const { class: _class, ...svgAttrs } = parts.attributes;
  const svg = (
    <svg
      ref={ref}
      {...(svgAttrs as React.SVGProps<SVGSVGElement>)}
      className={className}
      style={logoElement ? undefined : style}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: content is library-generated SVG.
      dangerouslySetInnerHTML={{ __html: parts.body }}
    />
  );

  if (!logoElement) return svg;

  const logoPct = Math.min(Math.max(options.logo?.size ?? 0.25, 0), 0.5) * 100;
  return (
    <span style={{ position: 'relative', display: 'inline-block', lineHeight: 0, ...style }}>
      {svg}
      <span
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${logoPct}%`,
          height: `${logoPct}%`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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
