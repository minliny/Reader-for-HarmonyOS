import {
  TYPE_READER_SESSION_COUNTDOWN,
  TYPE_READER_SESSION_LABEL,
} from '../common/ReaderTypography';
import {
  createDefaultReaderAppearanceSnapshot,
  type ReaderAppearanceSnapshot,
} from './ReaderAppearanceState';
import { readerThemePalette, READER_THEME_PALETTES, type ReaderThemePalette } from './ReaderThemePalettes';
import type {
  ReaderSessionCapsuleState,
  ReaderSessionCapsuleType,
} from './ReaderSessionCapsuleModel';

const AUTO_PAGE_CAPSULE_MIN_WIDTH = 96;
const TTS_CAPSULE_MIN_WIDTH = 94;
export const READER_SESSION_CAPSULE_HEIGHT = 24;

export function readerSessionCapsuleMinimumWidth(type: ReaderSessionCapsuleType): number {
  return type === 'autoPage' ? AUTO_PAGE_CAPSULE_MIN_WIDTH : TTS_CAPSULE_MIN_WIDTH;
}

/**
 * Figma `Reader/SessionCapsule` (`1164:10275`).
 *
 * This component implements the four confirmed static variants and their
 * primary pause/resume actor. The separate panel-to-capsule flight review has
 * no production timeline, so the parent owns only stable placement here.
 */
@Component
export struct ReaderSessionCapsule {
  @Prop type: ReaderSessionCapsuleType = 'autoPage';
  @Prop sessionState: ReaderSessionCapsuleState = 'playing';
  @Prop countdown: number = 8;
  @Prop surfaceColor: string = READER_THEME_PALETTES.day.surface;
  @Prop textColor: string = READER_THEME_PALETTES.day.ink;
  @Prop surfaceBorderColor: string = READER_THEME_PALETTES.day.borderSoft;
  @Prop appearanceSnapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop interactionEnabled: boolean = true;
  onToggle: () => void = (): void => {};
  onMeasured: (width: number, height: number) => void =
    (_width: number, _height: number): void => {};

  private palette(): ReaderThemePalette {
    return readerThemePalette(this.appearanceSnapshot.activeTheme);
  }

  build() {
    Row({ space: 4 }) {
      if (this.type === 'autoPage') {
        Stack({ alignContent: Alignment.Center }) {
          Text(`${Math.max(0, Math.trunc(this.countdown))}`)
            .width(18)
            .height(8)
            .fontFamily(TYPE_READER_SESSION_COUNTDOWN.fontFamily)
            .fontWeight(TYPE_READER_SESSION_COUNTDOWN.fontWeight)
            .fontSize(TYPE_READER_SESSION_COUNTDOWN.fontSizeFp)
            .lineHeight(TYPE_READER_SESSION_COUNTDOWN.lineHeightFp)
            .fontColor(this.palette().onPrimary)
            .textAlign(TextAlign.Center)
            .maxLines(1);
        }
        .width(18)
        .height(16)
        .backgroundColor(this.palette().primary)
        .borderRadius(999);
      } else {
        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.reader_tts_headphones'))
            .width(11)
            .height(11);
        }
        .width(16)
        .height(16);
      }

      Text(this.type === 'autoPage' ? '自动翻页' : '朗读')
        .fontFamily(TYPE_READER_SESSION_LABEL.fontFamily)
        .fontWeight(TYPE_READER_SESSION_LABEL.fontWeight)
        .fontSize(TYPE_READER_SESSION_LABEL.fontSizeFp)
        .lineHeight(TYPE_READER_SESSION_LABEL.lineHeightFp)
        .fontColor(this.textColor)
        .textAlign(TextAlign.Center)
        .maxLines(1);

      Stack({ alignContent: Alignment.Center }) {
        if (this.sessionState === 'playing') {
          Image($r('app.media.reader_session_pause'))
            .width(8)
            .height(8);
        } else {
          Image($r('app.media.reader_tts_play'))
            .width(8)
            .height(8);
        }
      }
      .width(16)
      .height(16)
      .backgroundColor(this.palette().primary)
      .borderRadius(999);
    }
    .height(READER_SESSION_CAPSULE_HEIGHT)
    .constraintSize({ minWidth: this.capsuleMinimumWidth() })
    .padding({ left: 6, right: 6 })
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(this.surfaceColor)
    .border({ width: 1, color: this.surfaceBorderColor })
    .borderRadius(999)
    .shadow({ radius: 8, color: '#12463423', offsetX: 0, offsetY: 3 })
    // Keep the Figma-authored 24vp visual footprint while admitting a 44vp
    // vertical touch target above the full-screen page gesture layer.
    .responseRegion({ x: 0, y: -10, width: '100%', height: 44 })
    .hitTestBehavior(this.interactionEnabled ? HitTestMode.Block : HitTestMode.None)
    .accessibilityText(this.accessibilityLabel())
    .onClick((): void => {
      if (this.interactionEnabled) this.onToggle();
    })
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      this.onMeasured(this.numericAreaLength(newValue.width), this.numericAreaLength(newValue.height));
    });
  }

  private capsuleMinimumWidth(): number {
    return readerSessionCapsuleMinimumWidth(this.type);
  }

  private accessibilityLabel(): string {
    const label = this.type === 'autoPage' ? '自动翻页' : '朗读';
    if (!this.interactionEnabled) return `${label}，翻页中`;
    return `${label}${this.sessionState === 'playing' ? '播放中，点击暂停' : '已暂停，点击继续'}`;
  }

  private numericAreaLength(value: Length): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    }
    return 0;
  }
}
