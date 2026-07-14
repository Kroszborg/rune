import { type RenderOptions, renderToParts } from '@kroszborg/rune';
import { type PropType, computed, defineComponent, h } from 'vue';

/**
 * Vue 3 QR code component. Accepts the full {@link RenderOptions} as props and
 * renders a real `<svg>`.
 *
 * @example
 * <QRCode value="https://example.com" :dots="{ style: 'rounded' }" />
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
    preset: { type: String, default: undefined },
    ariaLabel: { type: String, default: undefined },
    id: { type: String, default: undefined },
  },
  setup(props) {
    // Spreading inside the computed still tracks each reactive prop; the prop
    // keys are exactly RenderOptions.
    const parts = computed(() => renderToParts({ ...props }));

    return () => {
      const { class: _class, ...attrs } = parts.value.attributes;
      return h('svg', { ...attrs, innerHTML: parts.value.body });
    };
  },
});

export * from '@kroszborg/rune';
