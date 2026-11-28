import { ColorMetrics } from '@kit.ArkUI';
import { readerAppColor } from './ReaderAppColors';

/** The theme's neutral ink overlay is composited above the current surface.
 * ArkUI owns press/release/cancel state; ColorMetrics owns alpha composition.
 * Keep selected/disabled business state in the consuming component. */
export class ReaderPressFeedback implements AttributeModifier<CommonAttribute> {
  private readonly surface: ResourceColor;
  private readonly scheme: string;
  private readonly radius: number;
  private readonly pressedRadius: number;
  private readonly enabled: boolean;
  private readonly paintPressed: boolean;
  private readonly nativePress: boolean;

  /** `nativePress = false` ignores ArkUI's immediate touch-down state so a scroll
   * container can paint feedback through `paintPressed` only after a deliberate press. */
  constructor(surface: ResourceColor = Color.Transparent, scheme: string = 'day',
    radius: number = 0, pressedRadius: number = radius, enabled: boolean = true, paintPressed: boolean = false,
    nativePress: boolean = true) {
    this.surface = surface;
    this.scheme = scheme;
    this.radius = radius;
    this.pressedRadius = pressedRadius;
    this.enabled = enabled;
    this.paintPressed = paintPressed;
    this.nativePress = nativePress;
  }

  applyNormalAttribute(instance: CommonAttribute): void {
    if (this.paintPressed) this.applyPressedSurface(instance);
    else this.applyResting(instance);
  }

  private applyResting(instance: CommonAttribute): void {
    instance.backgroundColor(this.surface).borderRadius(this.radius);
  }

  // Reuse official alpha composition for finite gradient stops as well as
  // flat surfaces. Failure retains the exact original surface.
  pressedSurface(): ResourceColor {
    if (!this.enabled) return this.surface;
    try {
      return this.composePressedSurface();
    } catch (_) { return this.surface; }
  }

  private composePressedSurface(): ResourceColor {
    const overlay = ColorMetrics.resourceColor(readerAppColor('app.interaction.press', this.scheme));
    return ColorMetrics.resourceColor(this.surface).blendColor(overlay).color;
  }

  applyPressedAttribute(instance: CommonAttribute): void {
    if (!this.nativePress) {
      this.applyNormalAttribute(instance);
      return;
    }
    this.applyPressedSurface(instance);
  }

  private applyPressedSurface(instance: CommonAttribute): void {
    if (!this.enabled) {
      this.applyResting(instance);
      return;
    }
    try {
      instance.backgroundColor(this.composePressedSurface()).borderRadius(this.pressedRadius);
    } catch (_) {
      // Keep the original complete fallback, including geometry, when the
      // platform cannot produce the pressed surface.
      this.applyResting(instance);
    }
  }

  applyDisabledAttribute(instance: CommonAttribute): void {
    this.applyResting(instance);
  }
}
