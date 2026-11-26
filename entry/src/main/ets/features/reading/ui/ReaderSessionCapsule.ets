import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerPressPointer } from '../../../ui/foundation/ReaderPressMotion';
import { TYPE_READER_SESSION_COUNTDOWN, TYPE_READER_SESSION_LABEL } from '../../../ui/foundation/ReaderTypography';
import type { ReaderSessionCapsuleState, ReaderSessionCapsuleType } from './ReaderSessionCapsuleModel';
import { readerSessionCapsuleColor } from './ReaderSessionCapsulePaint';
import type { UIContext } from '@ohos.arkui.UIContext';
import { measureReaderControlText } from './ReaderControlTextMeasurement';
import { READER_SESSION_CAPSULE_MIN_TARGET_HEIGHT } from './ReaderPageChromeLayout';
import type { ReaderNavigationPreferences, ReaderSurfaceMaterialDecision } from '../../../app/HarmonyCapabilityPolicy';
import { applyReaderImmersiveMaterial, defaultNavigationPreferences, readerSurfaceMaterialDecision } from '../../../ui/surfaces/ReaderSurfaceMaterial';

const AUTO_PAGE_CAPSULE_MIN_WIDTH = 96;
const TTS_CAPSULE_MIN_WIDTH = 94;
export const READER_SESSION_CAPSULE_HEIGHT = 24;
export const READER_SESSION_CAPSULE_RADIUS = 12;
interface ReaderSessionCapsuleShadow { radius: number; offsetY: number; }
export const READER_SESSION_CAPSULE_SHADOW: ReaderSessionCapsuleShadow = {
  radius: 8, offsetY: 3,
};
export function readerSessionCapsuleMinimumWidth(type: ReaderSessionCapsuleType): number {
  return type === 'autoPage' ? AUTO_PAGE_CAPSULE_MIN_WIDTH : TTS_CAPSULE_MIN_WIDTH;
}

export interface ReaderSessionCapsuleMetrics {
  width: number;
  paintHeight: number;
  targetHeight: number;
  labelWidth: number;
  labelHeight: number;
  countdownSize: number;
}

interface ReaderSessionCapsuleMeasurement {
  metrics: ReaderSessionCapsuleMetrics;
  measured: boolean;
}

/** The authored 24vp shell grows only when its production text needs more room. */
export function measureReaderSessionCapsule(context: UIContext, type: ReaderSessionCapsuleType,
  fontScale: number = 1): ReaderSessionCapsuleMetrics {
  return readReaderSessionCapsuleMeasurement(context, type, fontScale).metrics;
}

function readReaderSessionCapsuleMeasurement(context: UIContext, type: ReaderSessionCapsuleType,
  fontScale: number): ReaderSessionCapsuleMeasurement {
  const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  const label = measureReaderControlText(context, type === 'autoPage' ? '自动翻页' : '朗读',
    TYPE_READER_SESSION_LABEL, 4096);
  const countdown = type === 'autoPage' ? measureReaderControlText(context, '60', TYPE_READER_SESSION_COUNTDOWN, 4096) : undefined;
  const labelWidth = Math.max(42, label?.singleLineWidthVp ?? 42 * scale);
  const labelHeight = Math.max(16, label?.heightVp ?? 12.5 * scale);
  const countdownSize = type === 'autoPage' ? Math.max(16,
    (countdown?.singleLineWidthVp ?? 10 * scale) + 2, (countdown?.heightVp ?? 8 * scale) + 2) : 16;
  const paintHeight = Math.max(READER_SESSION_CAPSULE_HEIGHT, labelHeight + 8, countdownSize + 8);
  const metrics: ReaderSessionCapsuleMetrics = {
    width: readerSessionCapsuleMinimumWidth(type) + labelWidth - 42 + countdownSize - 16,
    paintHeight, targetHeight: Math.max(READER_SESSION_CAPSULE_MIN_TARGET_HEIGHT, paintHeight), labelWidth, labelHeight, countdownSize,
  };
  return { metrics, measured: label !== undefined && (type !== 'autoPage' || countdown !== undefined) };
}

export class ReaderSessionCapsuleMetricsCache {
  private type: ReaderSessionCapsuleType | undefined = undefined;
  private scale: number = 1;
  private revision: number = -1;
  private value: ReaderSessionCapsuleMetrics | undefined = undefined;

  resolve(context: UIContext, type: ReaderSessionCapsuleType, scale: number, revision: number): ReaderSessionCapsuleMetrics {
    const fontScale = Number.isFinite(scale) ? Math.max(1, scale) : 1;
    const cached = this.value;
    if (cached !== undefined && type === this.type && fontScale === this.scale && revision === this.revision) return cached;
    const next = readReaderSessionCapsuleMeasurement(context, type, fontScale);
    if (next.measured) {
      this.type = type;
      this.scale = fontScale;
      this.revision = revision;
      this.value = next.metrics;
    }
    return next.metrics;
  }
}

/** The static capsule and its launch actor share paint while retaining their own nodes. */
export class ReaderSessionCapsuleFrame implements AttributeModifier<CommonAttribute> {
  private readonly scheme: string;
  private readonly surface: string;
  private readonly border: string;
  private readonly shadow: string;
  private readonly density: number;
  private readonly pressed: boolean;
  private readonly material: ReaderSurfaceMaterialDecision | undefined;

  constructor(scheme: string, surface: string, border: string, shadow: string, density: number = 1, pressed: boolean = false,
    material?: ReaderSurfaceMaterialDecision) {
    this.scheme = scheme;
    this.surface = surface;
    this.border = border;
    this.shadow = shadow;
    this.density = density;
    this.pressed = pressed;
    this.material = material;
  }

  applyNormalAttribute(instance: CommonAttribute): void {
    if (this.material?.native === true) {
      instance.backgroundEffect(undefined).backgroundColor(Color.Transparent)
        .border({ width: 0, color: Color.Transparent }).borderRadius(READER_SESSION_CAPSULE_RADIUS)
        .shadow(undefined);
      applyReaderImmersiveMaterial(instance, this.material);
      return;
    }
    const fill = readerSessionCapsuleColor('surface', this.scheme, this.surface);
    applyReaderImmersiveMaterial(instance, undefined);
    new ReaderPressFeedback(fill, this.scheme, READER_SESSION_CAPSULE_RADIUS,
      READER_SESSION_CAPSULE_RADIUS, true, this.pressed).applyNormalAttribute(instance);
    instance.border({ width: 1, color: readerSessionCapsuleColor('border', this.scheme, this.border) })
      .shadow({ radius: READER_SESSION_CAPSULE_SHADOW.radius * this.density,
        color: this.shadow.length > 0 ? this.shadow : readerAppColor('app.shadow.menu', this.scheme),
        offsetX: 0, offsetY: READER_SESSION_CAPSULE_SHADOW.offsetY * this.density });
  }
}

/** Shared fixed leading actor. Pause is deliberately not a child of this row. */
@Component
export struct ReaderSessionCapsuleLeading {
  @Prop type: ReaderSessionCapsuleType = 'autoPage';
  @Prop countdown: number = 8;
  @Prop textColor: string = '';
  @Prop primaryColor: string = '';
  @Prop onPrimaryColor: string = '';
  @Prop themeScheme: string = 'day';
  @Prop capsuleWidth: number = 96;
  @Prop capsuleHeight: number = 24;
  @Prop labelWidth: number = 42;
  @Prop labelHeight: number = 16;
  @Prop countdownSize: number = 16;

  build() {
    Row({ space: 4 }) {
      if (this.type === 'autoPage') {
        Stack({ alignContent: Alignment.Center }) {
          Text(`${Math.max(0, Math.trunc(this.countdown))}`)
            .width(this.countdownSize).height(this.countdownSize)
            .fontFamily(TYPE_READER_SESSION_COUNTDOWN.fontFamily)
            .fontWeight(TYPE_READER_SESSION_COUNTDOWN.fontWeight)
            .fontSize(TYPE_READER_SESSION_COUNTDOWN.fontSizeFp)
            .lineHeight(TYPE_READER_SESSION_COUNTDOWN.lineHeightFp)
            // PH89: Noto Sans SC digits sit above the centred line box. Match
            // their ink centre to the circle; fp keeps the correction font-scaled.
            .baselineOffset('-0.65fp')
            .fontColor(this.effectiveOnPrimaryColor()).textAlign(TextAlign.Center).maxLines(1);
        }.width(this.countdownSize).height(this.countdownSize).backgroundColor(this.effectivePrimaryColor()).borderRadius(this.countdownSize / 2);
      } else {
        Stack({ alignContent: Alignment.Center }) {
          Image(this.themeScheme === 'night' ? $r('app.media.reader_tts_headphones_theme_night') :
            $r('app.media.reader_tts_headphones')).width(11).height(11);
        }.width(16).height(16);
      }
      Text(this.type === 'autoPage' ? '自动翻页' : '朗读')
        .width(this.labelWidth)
        .height(this.labelHeight)
        .fontFamily(TYPE_READER_SESSION_LABEL.fontFamily)
        .fontWeight(TYPE_READER_SESSION_LABEL.fontWeight)
        .fontSize(TYPE_READER_SESSION_LABEL.fontSizeFp)
        .lineHeight(TYPE_READER_SESSION_LABEL.lineHeightFp).halfLeading(true)
        .fontColor(this.effectiveTextColor()).textAlign(TextAlign.Center).maxLines(1);
    }
    .width(this.capsuleWidth).height(this.capsuleHeight).padding({ left: 6, right: 6 })
    .justifyContent(FlexAlign.Start).alignItems(VerticalAlign.Center)
    .hitTestBehavior(HitTestMode.None);
  }

  private effectiveTextColor(): string {
    return readerSessionCapsuleColor('ink', this.themeScheme, this.textColor);
  }

  private effectivePrimaryColor(): string {
    return readerSessionCapsuleColor('primary', this.themeScheme, this.primaryColor);
  }

  private effectiveOnPrimaryColor(): string {
    return readerSessionCapsuleColor('onPrimary', this.themeScheme, this.onPrimaryColor);
  }
}

/** Independent persistent circle: the dot owns it before the leading reveal. */
@Component
export struct ReaderSessionCapsulePause {
  @Prop themeScheme: string = 'day';
  @Prop sessionState: ReaderSessionCapsuleState = 'playing';
  @Prop desiredPlaying: boolean = true;
  @Prop primaryColor: string = '';
  @Prop onPrimaryColor: string = '';

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Image(this.sessionState === 'playing' ||
        (this.sessionState === 'preparing' && this.desiredPlaying) ?
        (this.themeScheme === 'night' ? $r('app.media.reader_session_pause_theme_night') : $r('app.media.reader_session_pause')) :
        (this.themeScheme === 'night' ? $r('app.media.reader_session_play_theme_night') : $r('app.media.reader_session_play')))
        .width(8).height(8);
    }
    .width(16).height(16).backgroundColor(readerSessionCapsuleColor('primary', this.themeScheme, this.primaryColor)).borderRadius(8)
    .hitTestBehavior(HitTestMode.None);
  }
}

export function readerSessionCapsuleAccessibility(
  type: ReaderSessionCapsuleType, state: ReaderSessionCapsuleState, desiredPlaying: boolean,
): string {
  const label = type === 'autoPage' ? '自动翻页' : '朗读';
  if (state === 'preparing') return `${label}正在准备，${desiredPlaying ? '点击准备后暂停' : '准备完成后暂停，点击继续'}`;
  return `${label}${state === 'playing' ? '播放中，点击暂停' : '已暂停，点击继续'}`;
}

/** Figma `Reader/SessionCapsule` (`1164:10275`), one stable static actor tree. */
@Component
export struct ReaderSessionCapsule {
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @StorageLink('readerSystemScheme') private systemScheme: string = 'day';
  @StorageProp('readerNavigationAppearancePreferences') private navigationPreferences: ReaderNavigationPreferences =
    defaultNavigationPreferences();
  @Prop type: ReaderSessionCapsuleType = 'autoPage';
  @Prop sessionState: ReaderSessionCapsuleState = 'playing';
  @Prop desiredPlaying: boolean = true;
  @Prop countdown: number = 8;
  @Prop surfaceColor: string = '';
  @Prop textColor: string = '';
  @Prop surfaceBorderColor: string = '';
  @Prop primaryColor: string = '';
  @Prop onPrimaryColor: string = '';
  @Prop themeScheme: string = 'day';
  @Prop shadowColor: string = '';
  @Prop @Watch('onInteractionChanged') interactionEnabled: boolean = true;
  @Prop capsuleWidth: number = 0;
  @Prop fontScale: number = 1;
  @Prop measurementIdentity: string = '';
  @State private pressPointer: number = -1;
  private readonly metricsCache: ReaderSessionCapsuleMetricsCache = new ReaderSessionCapsuleMetricsCache();
  onToggle: () => void = (): void => {};
  onMeasured: (width: number, height: number, identity: string, type: ReaderSessionCapsuleType) => void =
    (_width: number, _height: number, _identity: string, _type: ReaderSessionCapsuleType): void => {};

  private onInteractionChanged(): void {
    if (!this.interactionEnabled) this.pressPointer = -1;
  }

  aboutToDisappear(): void { this.pressPointer = -1; }

  build() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderSessionCapsuleLeading({
        type: this.type, countdown: this.countdown, textColor: this.textColor,
        primaryColor: this.primaryColor, onPrimaryColor: this.onPrimaryColor,
        themeScheme: this.themeScheme, capsuleWidth: this.finalWidth(), capsuleHeight: this.metrics().paintHeight,
        labelWidth: this.metrics().labelWidth, labelHeight: this.metrics().labelHeight, countdownSize: this.metrics().countdownSize,
      });
      ReaderSessionCapsulePause({ sessionState: this.sessionState, themeScheme: this.themeScheme, desiredPlaying: this.desiredPlaying,
        primaryColor: this.primaryColor, onPrimaryColor: this.onPrimaryColor })
        .position({ x: this.finalWidth() - 20, y: (this.metrics().paintHeight - 16) / 2 });
    }
    .width(this.finalWidth()).height(this.metrics().paintHeight)
    .attributeModifier(new ReaderSessionCapsuleFrame(this.themeScheme, this.surfaceColor, this.surfaceBorderColor, this.shadowColor,
      this.metricsRevision < 0 ? 1 : readerWindowMetrics().densityPixels, this.interactionEnabled && this.pressPointer >= 0,
      readerSurfaceMaterialDecision('sessionCapsule', this.navigationPreferences, this.themeScheme, this.systemScheme)))
    .hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
    }
    .padding(0)
    .width(this.finalWidth()).height(this.metrics().targetHeight).backgroundColor(Color.Transparent)
    .hitTestBehavior(this.interactionEnabled ? HitTestMode.Block : HitTestMode.None)
    .enabled(this.interactionEnabled)
    .accessibilityText(readerSessionCapsuleAccessibility(this.type, this.sessionState, this.desiredPlaying))
    // Keep capsule pointers out of the raw page handler, including UP/CANCEL
    // after playback state changes. Click recognition remains independent.
    .onTouch((event: TouchEvent): void => {
      event.stopPropagation();
      const pointer = readerPressPointer(event, this.pressPointer, this.interactionEnabled);
      if (pointer !== this.pressPointer) this.pressPointer = pointer;
    })
    .onClick((): void => { if (this.interactionEnabled) this.onToggle(); })
    .onAreaChange(this.measurementHandler());
  }

  private measurementHandler(): (_oldValue: Area, newValue: Area) => void {
    const identity = this.measurementIdentity, type = this.type, measured = this.onMeasured;
    return (_oldValue: Area, newValue: Area): void => {
      if (identity === this.measurementIdentity && type === this.type)
        measured(this.numericLength(newValue.width), this.numericLength(newValue.height), identity, type);
    };
  }

  private finalWidth(): number {
    return Math.max(this.metrics().width, this.capsuleWidth);
  }

  private metrics(): ReaderSessionCapsuleMetrics {
    return this.metricsCache.resolve(this.getUIContext(), this.type, this.fontScale, this.metricsRevision);
  }

  private numericLength(value: Length): number {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : 0;
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
}
