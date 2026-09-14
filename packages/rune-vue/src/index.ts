import { type RenderOptions, renderToParts } from '@kroszborg/rune';
import { type PropType, computed, defineComponent, h } from 'vue';

let instanceCounter = 0;

/**
 * Vue 3 QR code component. Accepts the full {@link RenderOptions} as props and
 * renders a real `<svg>`. Non-prop attributes (`id`, `class`, listeners, …)
 * fall through to the root element as usual. Renders nothing while `value`
 * is empty, so a bound input can start blank.
 *
 * Put a node in the default slot to use it as the centre logo: the core clears
 * the modules behind it and picks the error-correction level exactly as it
 * does for `logo.src` (size, margin, shape and plate colour come from `logo`).
 *
 * @example
 * <QRCode value="https://example.com" :dots="{ style: 'rounded' }" />
 * <QRCode value="..." :logo="{ size: 0.2 }"><img src="/logo.svg" /></QRCode>
 */
export const QRCode = defineComponent({
  name: 'RuneQRCode',
  props: {
    value: { type: String, required: true },
    size: { type: Number, default: undefined },
    margin: { type: Number, default: undefined },
    dots: { type: Object as PropType<RenderOptions['dots']>, default: undefined },
    corners: { type: Object as PropType<RenderOptions['corners']>, default: undefined },
    background: {
      type: [String, Object] as PropType<RenderOptions['background']>,
      default: undefined,
    },
    logo: { type: Object as PropType<RenderOptions['logo']>, default: undefined },
    frame: { type: Object as PropType<RenderOptions['frame']>, default: undefined },
    qr: { type: Object as PropType<RenderOptions['qr']>, default: undefined },
    preset: { type: String as PropType<RenderOptions['preset']>, default: undefined },
    ariaLabel: { type: String, default: undefined },
    title: { type: String, default: undefined },
    /** Namespace for gradient ids; defaults to a per-instance prefix. */
    idPrefix: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    const instanceId = `rune-v${instanceCounter++}`;
    // Spreading inside the computed still tracks each reactive prop; the core
    // ignores keys whose value is undefined, so presets are not overridden.
    const parts = computed(() => {
      if (!props.value) return null;
      const options: RenderOptions = { ...props, idPrefix: props.idPrefix ?? instanceId };
      if (slots.default) {
        // A slotted logo needs a cleared plate but no <image>.
        const { src: _src, ...plate } = props.logo ?? {};
        options.logo = plate;
      }
      return renderToParts(options);
    });

    return () => {
      const p = parts.value;
      if (!p) return null;
      const { class: _class, ...attrs } = p.attributes;
      const svg = h('svg', {
        ...attrs,
        innerHTML: p.body,
        style: slots.default ? { display: 'block', width: '100%', height: 'auto' } : undefined,
      });
      if (!slots.default) return svg;

      const box = p.logo ?? {
        x: p.width * 0.375,
        y: p.height * 0.375,
        width: p.width * 0.25,
        height: p.height * 0.25,
      };
      const pct = (n: number, of: number) => `${(n / of) * 100}%`;
      return h(
        'span',
        {
          style: {
            position: 'relative',
            display: 'inline-block',
            width: `${p.width}px`,
            lineHeight: 0,
          },
        },
        [
          svg,
          h(
            'span',
            {
              style: {
                position: 'absolute',
                left: pct(box.x, p.width),
                top: pct(box.y, p.height),
                width: pct(box.width, p.width),
                height: pct(box.height, p.height),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 'normal',
              },
            },
            slots.default(),
          ),
        ],
      );
    };
  },
});

export * from '@kroszborg/rune';
