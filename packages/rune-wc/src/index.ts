import { type DotStyle, type Ecl, type RenderOptions, toSVGString } from '@kroszborg/rune';

/**
 * Render a QR code into a DOM element (vanilla JS, no framework).
 *
 * @example
 * renderRune(document.querySelector('#qr')!, { value: 'https://example.com' });
 */
export function renderRune(target: Element, options: RenderOptions): void {
  target.innerHTML = toSVGString(options);
}

/** Parse the observed attributes of a `<rune-qr>` element into RenderOptions. */
function attrsToOptions(el: Element, override?: Partial<RenderOptions>): RenderOptions {
  const get = (name: string) => el.getAttribute(name) ?? undefined;
  const num = (name: string) => {
    const v = get(name);
    return v == null ? undefined : Number(v);
  };
  const options: RenderOptions = {
    value: get('value') ?? '',
    size: num('size'),
    margin: num('margin'),
    preset: get('preset'),
    ariaLabel: get('aria-label'),
    dots:
      get('dot-style') || get('dot-color')
        ? { style: get('dot-style') as DotStyle | undefined, color: get('dot-color') }
        : undefined,
    background: get('background'),
    qr: get('ecl') ? { errorCorrectionLevel: get('ecl') as Ecl } : undefined,
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
 */
// Extend a real HTMLElement in the browser, or a harmless stub server-side, so
// this module can be imported during SSR / in Node without a ReferenceError.
const ElementBase: typeof HTMLElement =
  typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as unknown as typeof HTMLElement);

export class RuneQRElement extends ElementBase {
  static get observedAttributes(): string[] {
    return [
      'value',
      'size',
      'margin',
      'dot-style',
      'dot-color',
      'background',
      'ecl',
      'preset',
      'aria-label',
    ];
  }

  private _options?: Partial<RenderOptions>;

  /** Full option override; merged over parsed attributes. */
  get options(): Partial<RenderOptions> | undefined {
    return this._options;
  }
  set options(value: Partial<RenderOptions> | undefined) {
    this._options = value;
    this.render();
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    this.render();
  }

  private render(): void {
    const options = attrsToOptions(this, this._options);
    if (!options.value) {
      this.innerHTML = '';
      return;
    }
    renderRune(this, options);
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
