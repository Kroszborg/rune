import {
  type AlignmentStyle,
  type DotStyle,
  type EclInput,
  type FinderDotStyle,
  type FinderSquareStyle,
  type FrameOptions,
  type RenderOptions,
  toSVGString,
} from '@kroszborg/rune';

/**
 * Render a QR code into a DOM element (vanilla JS, no framework).
 *
 * @example
 * renderRune(document.querySelector('#qr')!, { value: 'https://example.com' });
 */
export function renderRune(target: Element, options: RenderOptions): void {
  target.innerHTML = toSVGString(options);
}

/**
 * Attributes `<rune-qr>` reads. Everything else (gradients, background images,
 * logo plate colour, pinned version/mask, …) is set through the `.options`
 * property, which is merged over these.
 */
export const RUNE_QR_ATTRIBUTES = [
  'value',
  'size',
  'margin',
  'preset',
  'aria-label',
  'title',
  'dot-style',
  'dot-color',
  'corner-style',
  'corner-dot-style',
  'corner-color',
  'alignment-style',
  'background',
  'ecl',
  'logo',
  'logo-size',
  'frame-style',
  'frame-text',
  'frame-color',
] as const;

/** Parse the observed attributes of a `<rune-qr>` element into RenderOptions. */
function attrsToOptions(el: Element, override?: Partial<RenderOptions>): RenderOptions {
  const get = (name: string) => el.getAttribute(name) ?? undefined;
  // Numeric attributes: absent or blank → undefined (the core applies its
  // default); anything non-numeric is passed through so the core reports it.
  const num = (name: string) => {
    const v = get(name);
    if (v == null || v.trim() === '') return undefined;
    return Number(v);
  };
  const cornerColor = get('corner-color');
  const hasCorners =
    get('corner-style') || get('corner-dot-style') || cornerColor || get('alignment-style');
  const hasFrame = get('frame-style') || get('frame-text');
  const options: RenderOptions = {
    value: get('value') ?? '',
    size: num('size'),
    margin: num('margin'),
    preset: get('preset'),
    ariaLabel: get('aria-label'),
    title: get('title'),
    dots:
      get('dot-style') || get('dot-color')
        ? { style: get('dot-style') as DotStyle | undefined, color: get('dot-color') }
        : undefined,
    corners: hasCorners
      ? {
          square: {
            style: get('corner-style') as FinderSquareStyle | undefined,
            color: cornerColor,
          },
          dot: { style: get('corner-dot-style') as FinderDotStyle | undefined, color: cornerColor },
          alignment: { style: get('alignment-style') as AlignmentStyle | undefined },
        }
      : undefined,
    background: get('background'),
    qr: get('ecl') ? { errorCorrectionLevel: get('ecl') as EclInput } : undefined,
    logo: get('logo') ? { src: get('logo'), size: num('logo-size') } : undefined,
    frame: hasFrame
      ? {
          style: get('frame-style') as FrameOptions['style'],
          text: get('frame-text'),
          color: get('frame-color'),
        }
      : undefined,
    ...override,
  };
  return options;
}

/**
 * `<rune-qr>` custom element.
 *
 * Simple usage via attributes:
 * `<rune-qr value="https://example.com" dot-style="rounded" preset="mint"></rune-qr>`
 *
 * Advanced usage: set the `.options` property to a full {@link RenderOptions}.
 *
 * Rendering is coalesced into one pass per microtask and skipped while the
 * element is disconnected, so setting ten attributes costs one render. Invalid
 * input never throws out of a lifecycle callback: the element clears itself,
 * logs the error, and dispatches a bubbling `rune-error` CustomEvent whose
 * `detail` is the `Error`.
 */
// Extend a real HTMLElement in the browser, or a harmless stub server-side, so
// this module can be imported during SSR / in Node without a ReferenceError.
const ElementBase: typeof HTMLElement =
  typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as unknown as typeof HTMLElement);

export class RuneQRElement extends ElementBase {
  static get observedAttributes(): string[] {
    return [...RUNE_QR_ATTRIBUTES];
  }

  private _options?: Partial<RenderOptions>;
  private _scheduled = false;

  /** Full option override; merged over parsed attributes. */
  get options(): Partial<RenderOptions> | undefined {
    return this._options;
  }
  set options(value: Partial<RenderOptions> | undefined) {
    this._options = value;
    this.scheduleRender();
  }

  connectedCallback(): void {
    // A property assigned before the element was upgraded lands as an own
    // property that shadows the accessor above; re-apply it through the setter.
    if (Object.prototype.hasOwnProperty.call(this, 'options')) {
      const value = (this as { options?: Partial<RenderOptions> }).options;
      Reflect.deleteProperty(this, 'options');
      this._options = value;
    }
    this.scheduleRender();
  }

  attributeChangedCallback(): void {
    this.scheduleRender();
  }

  /** Render synchronously now. Normally not needed: renders are coalesced. */
  render(): void {
    this._scheduled = false;
    if (!this.isConnected) return;
    const options = attrsToOptions(this, this._options);
    // An empty value renders nothing (the core would throw).
    if (!options.value) {
      this.innerHTML = '';
      return;
    }
    try {
      renderRune(this, options);
    } catch (err) {
      this.innerHTML = '';
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[rune-qr]', error.message);
      this.dispatchEvent(new CustomEvent('rune-error', { detail: error, bubbles: true }));
    }
  }

  private scheduleRender(): void {
    if (this._scheduled) return;
    this._scheduled = true;
    queueMicrotask(() => this.render());
  }
}

/** Register the `<rune-qr>` custom element (idempotent). */
export function register(tagName = 'rune-qr'): void {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(tagName)) {
    customElements.define(tagName, RuneQRElement);
  }
}

// Re-export the entire core API alongside the WC-specific helpers above.
export * from '@kroszborg/rune';
