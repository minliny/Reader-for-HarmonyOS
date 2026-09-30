import { ColorMetrics } from '@kit.ArkUI';
import { readerAppColor } from './ReaderThemeRegistry';

/** Figma InteractionStateLayer: accent at 12%, above the current surface.
 * ArkUI owns press/release/cancel state; ColorMetrics owns alpha composition.
 * Keep selected/disabled business state in the consuming component. */
export class ReaderPressFeedback implements AttributeModifier<CommonAttribute> {
  private readonly surface: ResourceColor;
  private readonly scheme: string;
  private readonly radius: number;
  private readonly pressedRadius: number;
  private readonly enabled: boolean;

  constructor(surface: ResourceColor = Color.Transparent, scheme: string = 'day',
    radius: number = 0, pressedRadius: number = radius, enabled: boolean = true) {
    this.surface = surface;
    this.scheme = scheme;
    this.radius = radius;
    this.pressedRadius = pressedRadius;
    this.enabled = enabled;
  }

  applyNormalAttribute(instance: CommonAttribute): void {
    instance.backgroundColor(this.surface).borderRadius(this.radius);
  }

  applyPressedAttribute(instance: CommonAttribute): void {
    if (!this.enabled) {
      this.applyNormalAttribute(instance);
      return;
    }
    try {
      const accent = ColorMetrics.resourceColor(readerAppColor('TOK_ACCENT', this.scheme));
      const overlay = ColorMetrics.rgba(accent.red, accent.green, accent.blue, 0.12);
      instance.backgroundColor(ColorMetrics.resourceColor(this.surface).blendColor(overlay).color)
        .borderRadius(this.pressedRadius);
    } catch (_) {
      // A missing platform color resource must not interrupt the button action.
      this.applyNormalAttribute(instance);
    }
  }

  applyDisabledAttribute(instance: CommonAttribute): void {
    this.applyNormalAttribute(instance);
  }
}
