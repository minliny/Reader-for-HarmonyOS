import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { TYPE_READER_SESSION_COUNTDOWN, TYPE_READER_SESSION_LABEL } from '../../../ui/foundation/ReaderTypography';
import type { ReaderSessionCapsuleState, ReaderSessionCapsuleType } from './ReaderSessionCapsuleModel';

const AUTO_PAGE_CAPSULE_MIN_WIDTH = 96;
const TTS_CAPSULE_MIN_WIDTH = 94;
export const READER_SESSION_CAPSULE_HEIGHT = 24;
export const READER_SESSION_CAPSULE_RADIUS = 12;
export const READER_SESSION_CAPSULE_SHADOW: ShadowOptions = {
  radius: 8, color: '#12463423', offsetX: 0, offsetY: 3,
};
export function readerSessionCapsuleMinimumWidth(type: ReaderSessionCapsuleType): number {
  return type === 'autoPage' ? AUTO_PAGE_CAPSULE_MIN_WIDTH : TTS_CAPSULE_MIN_WIDTH;
}

/** The static capsule and its launch actor share paint while retaining their own nodes. */
export class ReaderSessionCapsuleFrame implements AttributeModifier<CommonAttribute> {
  private readonly scheme: string;
  private readonly surface: string;
  private readonly border: string;
  private readonly shadow: string;

  constructor(scheme: string, surface: string, border: string, shadow: string) {
    this.scheme = scheme;
    this.surface = surface;
    this.border = border;
    this.shadow = shadow;
  }

  applyNormalAttribute(instance: CommonAttribute): void {
    instance.backgroundColor(this.surface.length > 0 ? this.surface : readerAppColor('TOK_READ_SURFACE', this.scheme))
      .border({ width: 1, color: this.border.length > 0 ? this.border : readerAppColor('TOK_LINE', this.scheme) })
      .borderRadius(READER_SESSION_CAPSULE_RADIUS)
      .shadow({ radius: READER_SESSION_CAPSULE_SHADOW.radius, color: this.shadow,
        offsetX: READER_SESSION_CAPSULE_SHADOW.offsetX, offsetY: READER_SESSION_CAPSULE_SHADOW.offsetY });
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

  build() {
    Row({ space: 4 }) {
      if (this.type === 'autoPage') {
        Stack({ alignContent: Alignment.Center }) {
          Text(`${Math.max(0, Math.trunc(this.countdown))}`)
            .width(16).height(16)
            .fontFamily(TYPE_READER_SESSION_COUNTDOWN.fontFamily)
            .fontWeight(TYPE_READER_SESSION_COUNTDOWN.fontWeight)
            .fontSize(TYPE_READER_SESSION_COUNTDOWN.fontSizeFp)
            .lineHeight(TYPE_READER_SESSION_COUNTDOWN.lineHeightFp)
            // PH89: Noto Sans SC digits sit above the centred line box. Match
            // their ink centre to the circle; fp keeps the correction font-scaled.
            .baselineOffset('-0.65fp')
            .fontColor(this.effectiveOnPrimaryColor()).textAlign(TextAlign.Center).maxLines(1);
        }.width(16).height(16).backgroundColor(this.effectivePrimaryColor()).borderRadius(999);
      } else {
        Stack({ alignContent: Alignment.Center }) {
          Image(this.themeScheme === 'night' ? $r('app.media.reader_tts_headphones_theme_night') :
            $r('app.media.reader_tts_headphones')).width(11).height(11);
        }.width(16).height(16);
      }
      Text(this.type === 'autoPage' ? '自动翻页' : '朗读')
        .width(Math.max(42, this.capsuleWidth - readerSessionCapsuleMinimumWidth(this.type) + 42))
        .height(16)
        .fontFamily(TYPE_READER_SESSION_LABEL.fontFamily)
        .fontWeight(TYPE_READER_SESSION_LABEL.fontWeight)
        .fontSize(TYPE_READER_SESSION_LABEL.fontSizeFp)
        .lineHeight(TYPE_READER_SESSION_LABEL.lineHeightFp)
        .fontColor(this.effectiveTextColor()).textAlign(TextAlign.Center).maxLines(1);
    }
    .width(this.capsuleWidth).height(24).padding({ left: 6, right: 6 })
    .justifyContent(FlexAlign.Start).alignItems(VerticalAlign.Center)
    .hitTestBehavior(HitTestMode.None);
  }

  private effectiveTextColor(): string {
    return this.textColor.length > 0 ? this.textColor : readerAppColor('TOK_READ_INK', this.themeScheme);
  }

  private effectivePrimaryColor(): string {
    return this.primaryColor.length > 0 ? this.primaryColor : readerAppColor('TOK_READ_PRIMARY', this.themeScheme);
  }

  private effectiveOnPrimaryColor(): string {
    return this.onPrimaryColor.length > 0 ? this.onPrimaryColor : readerAppColor('app.control.onPrimary', this.themeScheme);
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
    .width(16).height(16).backgroundColor(this.primaryColor.length > 0 ? this.primaryColor : readerAppColor('TOK_READ_PRIMARY', this.themeScheme)).borderRadius(999)
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
  @Prop shadowColor: string = '#12463423';
  @Prop interactionEnabled: boolean = true;
  @Prop capsuleWidth: number = 0;
  onToggle: () => void = (): void => {};
  onMeasured: (width: number, height: number) => void = (_width: number, _height: number): void => {};

  build() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderSessionCapsuleLeading({
        type: this.type, countdown: this.countdown, textColor: this.effectiveTextColor(),
        primaryColor: this.effectivePrimaryColor(), onPrimaryColor: this.effectiveOnPrimaryColor(),
        themeScheme: this.themeScheme, capsuleWidth: this.finalWidth(),
      });
      ReaderSessionCapsulePause({ sessionState: this.sessionState, themeScheme: this.themeScheme, desiredPlaying: this.desiredPlaying,
        primaryColor: this.effectivePrimaryColor(), onPrimaryColor: this.effectiveOnPrimaryColor() })
        .position({ x: this.finalWidth() - 20, y: 4 });
    }
    .width(this.finalWidth()).height(READER_SESSION_CAPSULE_HEIGHT)
    .hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
    }
    .padding(0)
    .width(this.finalWidth()).height(READER_SESSION_CAPSULE_HEIGHT).clip(true)
    .attributeModifier(new ReaderSessionCapsuleFrame(this.themeScheme, this.surfaceColor, this.surfaceBorderColor, this.shadowColor))
    .responseRegion({ x: 0, y: -10, width: '100%', height: 44 })
    .hitTestBehavior(this.interactionEnabled ? HitTestMode.Block : HitTestMode.None)
    .enabled(this.interactionEnabled)
    .accessibilityText(readerSessionCapsuleAccessibility(this.type, this.sessionState, this.desiredPlaying))
    // Keep capsule pointers out of the raw page handler, including UP/CANCEL
    // after playback state changes. Click recognition remains independent.
    .onTouch((event: TouchEvent): void => event.stopPropagation())
    .onClick((): void => { if (this.interactionEnabled) this.onToggle(); })
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      this.onMeasured(this.numericLength(newValue.width), this.numericLength(newValue.height));
    });
  }

  private finalWidth(): number {
    return Math.max(readerSessionCapsuleMinimumWidth(this.type), this.capsuleWidth);
  }

  private effectiveTextColor(): string {
    return this.textColor.length > 0 ? this.textColor : readerAppColor('TOK_READ_INK', this.themeScheme);
  }

  private effectivePrimaryColor(): string {
    return this.primaryColor.length > 0 ? this.primaryColor : readerAppColor('TOK_READ_PRIMARY', this.themeScheme);
  }

  private effectiveOnPrimaryColor(): string {
    return this.onPrimaryColor.length > 0 ? this.onPrimaryColor : readerAppColor('app.control.onPrimary', this.themeScheme);
  }
  private numericLength(value: Length): number {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : 0;
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
}
