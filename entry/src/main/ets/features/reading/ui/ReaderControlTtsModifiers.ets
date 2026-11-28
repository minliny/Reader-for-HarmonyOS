import { FrameCallback } from '@kit.ArkUI';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { ReaderRectVp } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import type { ReaderTtsConfigField } from '../presentation/ReaderTtsConfigOptions';
import type { ReaderControlTransportKind } from './ReaderControlPlaybackGeometry';
import { readerTtsPlayGradientStart } from './ReaderControlTtsStyle';

export type ReaderControlTtsSection = 'playback' | 'timer' | 'speed';
export type ReaderControlTtsField = 'voice' | 'engine' | 'language' | 'session' | 'failure';
export type ReaderControlTtsToggle = 'followHighlight' | 'pauseOnInterruption' | 'allowMixing' |
  'backgroundPlayback' | 'keepScreenOn';

export interface ReaderTtsSectionHeader {
  title: string;
  meta: string;
}

export interface ReaderTtsConfigurationReturnFocus {
  identity: string;
  generation: number;
  origin: ReaderTtsConfigField | 'manage';
}

export interface ReaderTtsInlineConfigurationGeometry {
  host: ReaderRectVp | undefined;
  anchor: ReaderRectVp | undefined;
}

export class ReaderTtsConfigurationFocusFrame extends FrameCallback {
  private readonly applyFocus: () => void;
  constructor(applyFocus: () => void) { super(); this.applyFocus = applyFocus; }
  onFrame(): void { this.applyFocus(); }
  onIdle(): void {}
}

export function readerTtsPresetLabelColor(selected: boolean, scheme: string): ResourceColor {
  return readerAppColor(selected ? 'TOK_TTS_PAPER' : 'app.control.paint.5B5046', scheme);
}

export function readerTtsShadow(radiusVp: number, offsetYVp: number, color: ResourceColor): ShadowOptions {
  const observedDensity = ReaderWindowCoordinator.metrics().densityPixels;
  const density = Number.isFinite(observedDensity) && observedDensity > 0 ? observedDensity : 1;
  return { radius: radiusVp * density, offsetY: offsetYVp * density, color };
}

/** The native preset frame and its decorative label keep separate recipes. */
export class ReaderTtsPresetModifier implements AttributeModifier<CommonAttribute> {
  private readonly selected: boolean;
  private readonly scheme: string;
  private readonly feedback: ReaderPressFeedback;

  constructor(selected: boolean, scheme: string, enabled: boolean) {
    this.selected = selected;
    this.scheme = scheme;
    this.feedback = new ReaderPressFeedback(readerAppColor(selected ? 'TOK_TTS_TEAL' : 'TOK_TTS_FIELD', scheme),
      scheme, 10, 10, enabled);
  }

  applyNormalAttribute(instance: CommonAttribute): void {
    this.feedback.applyNormalAttribute(instance);
    instance.border({ width: this.selected ? 0 : 0.5, color: readerAppColor('TOK_TTS_LINE', this.scheme) })
      .shadow(readerTtsShadow(7, 2, this.selected ? readerAppColor('app.control.paint.472F6373', this.scheme) : Color.Transparent));
  }

  applyPressedAttribute(instance: CommonAttribute): void { this.feedback.applyPressedAttribute(instance); }
  applyDisabledAttribute(instance: CommonAttribute): void { this.applyNormalAttribute(instance); }
}

export class ReaderTtsTransportModifier implements AttributeModifier<CommonAttribute> {
  private readonly kind: ReaderControlTransportKind;
  private readonly progress: number;
  private readonly scheme: string;
  private readonly radius: number;

  constructor(kind: ReaderControlTransportKind, progress: number, scheme: string, radius: number) {
    this.kind = kind;
    this.progress = progress;
    this.scheme = scheme;
    this.radius = radius;
  }

  applyNormalAttribute(instance: CommonAttribute): void { this.paint(instance, false); }
  applyPressedAttribute(instance: CommonAttribute): void { this.paint(instance, true); }
  applyDisabledAttribute(instance: CommonAttribute): void { this.paint(instance, false); }

  private paint(instance: CommonAttribute, pressed: boolean): void {
    if (this.kind === 'toggle') {
      const start = readerTtsPlayGradientStart(this.progress, this.scheme);
      const end = readerAppColor('TOK_TTS_PLAY_END', this.scheme);
      instance.borderRadius(this.radius).linearGradient({ angle: 155, colors: [
        [pressed ? new ReaderPressFeedback(start, this.scheme).pressedSurface() : start, 0],
        [pressed ? new ReaderPressFeedback(end, this.scheme).pressedSurface() : end, 1],
      ] }).border({ width: { top: 0.5 }, color: readerAppColor('app.control.paint.33FFFFFF', this.scheme) })
        .shadow(readerTtsShadow(6 + 2 * this.progress, 4, readerAppColor('app.control.paint.5C2F6373', this.scheme)));
      return;
    }
    const stop = this.kind === 'stop';
    new ReaderPressFeedback(stop ? readerAppColor('TOK_TTS_CLAY_SOFT', this.scheme) : Color.Transparent,
      this.scheme, this.radius, this.radius, true, pressed).applyNormalAttribute(instance);
    instance.border({ width: stop ? 0.5 : 0, color: readerAppColor('TOK_TTS_CLAY_LINE', this.scheme) });
  }
}

/** No modifier is applied before an actual selected natural-text receipt. */
export class ReaderTtsNaturalRangeFrame implements AttributeModifier<TextAttribute> {
  private readonly heightVp: number | undefined;
  private readonly widthVp: number | undefined;
  constructor(heightVp: number | undefined, widthVp: number | undefined) {
    this.heightVp = heightVp; this.widthVp = widthVp;
  }
  applyNormalAttribute(instance: TextAttribute): void {
    if (this.heightVp !== undefined) instance.height(this.heightVp);
    if (this.widthVp !== undefined) instance.width(this.widthVp);
  }
}
