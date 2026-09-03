import type { ReaderAutoPageStatus } from './ReaderAutoPageState';
import {
  TOK_BORDER_W,
  TOK_LINE,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_SURFACE_PANEL,
  TOK_SURFACE_PANEL_SOFT,
} from '../common/ReaderTokens';

const QUICK_AUTO_PAGE_PANEL_PADDING_X = 11;
const QUICK_AUTO_PAGE_PANEL_PADDING_Y = 13;
const QUICK_AUTO_PAGE_PANEL_WIDTH_PHONE = 286;
const QUICK_AUTO_PAGE_PANEL_WIDTH_TABLET = 262;
const QUICK_AUTO_PAGE_HEADER_HEIGHT = 24;
const QUICK_AUTO_PAGE_GAP_PHONE = 5;
const QUICK_AUTO_PAGE_GAP_TABLET = 6;
const QUICK_AUTO_PAGE_PLAYBACK_HEIGHT_PHONE = 104;
const QUICK_AUTO_PAGE_PLAYBACK_HEIGHT_TABLET = 94;
const QUICK_AUTO_PAGE_SPEED_HEIGHT_PHONE = 32;
const QUICK_AUTO_PAGE_SPEED_HEIGHT_TABLET = 34;
const QUICK_AUTO_PAGE_PANEL_HEIGHT_PHONE = QUICK_AUTO_PAGE_PANEL_PADDING_Y * 2 +
  QUICK_AUTO_PAGE_HEADER_HEIGHT + QUICK_AUTO_PAGE_GAP_PHONE * 2 +
  QUICK_AUTO_PAGE_PLAYBACK_HEIGHT_PHONE + QUICK_AUTO_PAGE_SPEED_HEIGHT_PHONE;
const QUICK_AUTO_PAGE_PANEL_HEIGHT_TABLET = QUICK_AUTO_PAGE_PANEL_PADDING_Y * 2 +
  QUICK_AUTO_PAGE_HEADER_HEIGHT + QUICK_AUTO_PAGE_GAP_TABLET * 2 +
  QUICK_AUTO_PAGE_PLAYBACK_HEIGHT_TABLET + QUICK_AUTO_PAGE_SPEED_HEIGHT_TABLET;
const QUICK_AUTO_PAGE_CHAPTER_WIDTH_PHONE = 62;
const QUICK_AUTO_PAGE_CHAPTER_WIDTH_TABLET = 56;
const QUICK_AUTO_PAGE_PREVIOUS_X = 7.75;
const QUICK_AUTO_PAGE_NEXT_X_PHONE = 192.25;
const QUICK_AUTO_PAGE_NEXT_X_TABLET = 174.25;
const QUICK_AUTO_PAGE_CONTROL_Y_PHONE = 25;
const QUICK_AUTO_PAGE_CONTROL_Y_TABLET = 20;
const QUICK_AUTO_PAGE_RUNNING_WIDTH_PHONE = 82;
const QUICK_AUTO_PAGE_RUNNING_WIDTH_TABLET = 74;
const QUICK_AUTO_PAGE_RUNNING_X_PHONE = 90;
const QUICK_AUTO_PAGE_RUNNING_X_TABLET = 82;
const QUICK_AUTO_PAGE_STOP_X_PHONE = 160;
const QUICK_AUTO_PAGE_STOP_X_TABLET = 144;
const QUICK_AUTO_PAGE_STOP_Y_PHONE = 35.5;
const QUICK_AUTO_PAGE_STOP_Y_TABLET = 30.5;
const QUICK_AUTO_PAGE_SPEED_PADDING_PHONE = 7;
const QUICK_AUTO_PAGE_SPEED_PADDING_TABLET = 8;

/**
 * Figma Reader Quick Auto Page content area.
 *
 * Sources:
 * - Phone `942:50` / panel `909:69`
 * - Tablet `942:52` / panel `911:65`
 *
 * This component owns no timer or reading command. The reading experience is
 * the single session owner and supplies state plus callbacks.
 */
@Component
export struct ReaderAutoPagePanel {
  @Prop morphActorId: string = 'reader-session-morph-quickAutoPage';
  @Prop isTablet: boolean = false;
  @Prop status: ReaderAutoPageStatus = 'stopped';
  @Prop speedSeconds: number = 8;
  @Prop canPreviousChapter: boolean = false;
  @Prop canNextChapter: boolean = false;
  onBack: () => void = (): void => {};
  onPreviousChapter: () => void = (): void => {};
  onToggleRunning: () => void = (): void => {};
  onStop: () => void = (): void => {};
  onNextChapter: () => void = (): void => {};
  onSlowDown: () => void = (): void => {};
  onSpeedUp: () => void = (): void => {};
  onMorphActorMeasured: (left: number, top: number, width: number, height: number) => void =
    (_left: number, _top: number, _width: number, _height: number): void => {};

  build() {
    Column({ space: this.isTablet ? QUICK_AUTO_PAGE_GAP_TABLET : QUICK_AUTO_PAGE_GAP_PHONE }) {
      this.header();
      this.playbackControls();
      this.speedControl();
    }
    .width('100%')
    .constraintSize({ maxWidth: this.panelWidth() })
    .height(this.isTablet ? QUICK_AUTO_PAGE_PANEL_HEIGHT_TABLET : QUICK_AUTO_PAGE_PANEL_HEIGHT_PHONE)
    .padding({
      left: QUICK_AUTO_PAGE_PANEL_PADDING_X,
      right: QUICK_AUTO_PAGE_PANEL_PADDING_X,
      top: QUICK_AUTO_PAGE_PANEL_PADDING_Y,
      bottom: QUICK_AUTO_PAGE_PANEL_PADDING_Y,
    })
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
    .borderRadius(8)
    .clip(true)
    .id(this.morphActorId)
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      this.onMorphActorMeasured(
        Number(newValue.globalPosition.x),
        Number(newValue.globalPosition.y),
        Number(newValue.width),
        Number(newValue.height),
      );
    });
  }

  @Builder
  private header() {
    Row() {
      Row({ space: 4 }) {
        Image($r('app.media.reader_quick_back'))
          .width(11)
          .height(11);
        Text('返回')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(10)
          .lineHeight(10)
          .fontColor(TOK_READ_PRIMARY);
      }
      .height(QUICK_AUTO_PAGE_HEADER_HEIGHT)
      .padding({ left: 9, right: 9 })
      .backgroundColor(TOK_SURFACE_PANEL)
      .borderRadius(8)
      .alignItems(VerticalAlign.Center)
      .accessibilityText('返回阅读控制首页')
      .onClick((): void => this.onBack());
    }
    .width('100%')
    .height(QUICK_AUTO_PAGE_HEADER_HEIGHT)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private playbackControls() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.primaryControls();
      this.stopTrack();
    }
    .width('100%')
    .height(this.isTablet ? QUICK_AUTO_PAGE_PLAYBACK_HEIGHT_TABLET :
      QUICK_AUTO_PAGE_PLAYBACK_HEIGHT_PHONE)
    .backgroundColor(TOK_SURFACE_PANEL_SOFT)
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private primaryControls() {
    Row({ space: this.primaryActorGap() }) {
      this.chapterControl(true);
      this.runningControl();
      this.chapterControl(false);
    }
    .width('100%')
    .height(52)
    .padding({ left: QUICK_AUTO_PAGE_PREVIOUS_X, right: this.chapterRightGap() })
    .alignItems(VerticalAlign.Top)
    .position({
      x: 0,
      y: this.isTablet ? QUICK_AUTO_PAGE_CONTROL_Y_TABLET : QUICK_AUTO_PAGE_CONTROL_Y_PHONE,
    });
  }

  @Builder
  private stopTrack() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.stopControl();
    }
    .width(24)
    .height(42)
    .position({
      x: this.isTablet ? QUICK_AUTO_PAGE_STOP_X_TABLET : QUICK_AUTO_PAGE_STOP_X_PHONE,
      y: this.isTablet ? QUICK_AUTO_PAGE_STOP_Y_TABLET : QUICK_AUTO_PAGE_STOP_Y_PHONE,
    });
  }

  @Builder
  private chapterControl(previous: boolean) {
    Column() {
      Stack({ alignContent: Alignment.TopStart }) {
        Image($r(previous ?
          'app.media.reader_auto_full_chevron_left' : 'app.media.reader_auto_full_chevron_right'))
          .width(16)
          .height(16)
          .position({ x: 3, y: 5.5 });
        Image($r(previous ?
          'app.media.reader_auto_full_chevron_left' : 'app.media.reader_auto_full_chevron_right'))
          .width(16)
          .height(16)
          .position({ x: 8, y: 5.5 });
      }
      .width(27)
      .height(27)
      .backgroundColor(TOK_SURFACE_PANEL_SOFT)
      .border({ width: TOK_BORDER_W, color: TOK_LINE })
      .borderRadius(8);

      Text(previous ? '上一章' : '下一章')
        .width(27)
        .height(9)
        .margin({ top: 7 })
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(9)
        .lineHeight(9)
        .fontColor(TOK_READ_INK)
        .textAlign(TextAlign.Center)
        .maxLines(1);
    }
    .layoutWeight(this.isTablet ? QUICK_AUTO_PAGE_CHAPTER_WIDTH_TABLET : QUICK_AUTO_PAGE_CHAPTER_WIDTH_PHONE)
    .constraintSize({
      maxWidth: this.isTablet ? QUICK_AUTO_PAGE_CHAPTER_WIDTH_TABLET : QUICK_AUTO_PAGE_CHAPTER_WIDTH_PHONE,
    })
    .height(52)
    .alignItems(HorizontalAlign.Center)
    .enabled(previous ? this.canPreviousChapter : this.canNextChapter)
    .opacity((previous ? this.canPreviousChapter : this.canNextChapter) ? 1 : 0.4)
    .accessibilityText(previous ? '上一章' : '下一章')
    .onClick((): void => {
      if (previous && this.canPreviousChapter) {
        this.onPreviousChapter();
      } else if (!previous && this.canNextChapter) {
        this.onNextChapter();
      }
    });
  }

  @Builder
  private runningControl() {
    Column() {
      Stack({ alignContent: Alignment.Center }) {
        Image($r(this.status === 'running' ?
          'app.media.reader_session_pause' : 'app.media.reader_auto_play'))
          .width(20)
          .height(20);
      }
      .width(32)
      .height(32)
      .backgroundColor(TOK_READ_PRIMARY)
      .borderRadius(16);

      Text('自动翻页')
        .width(36)
        .height(9)
        .margin({ top: 4.5 })
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(9)
        .lineHeight(9)
        .fontColor(TOK_READ_INK)
        .textAlign(TextAlign.Center)
        .maxLines(1);
    }
    .layoutWeight(this.isTablet ? QUICK_AUTO_PAGE_RUNNING_WIDTH_TABLET : QUICK_AUTO_PAGE_RUNNING_WIDTH_PHONE)
    .constraintSize({
      maxWidth: this.isTablet ? QUICK_AUTO_PAGE_RUNNING_WIDTH_TABLET : QUICK_AUTO_PAGE_RUNNING_WIDTH_PHONE,
    })
    .height(52)
    .alignItems(HorizontalAlign.Center)
    .accessibilityText(this.status === 'running' ? '暂停自动翻页' :
      (this.status === 'paused' ? '继续自动翻页' : '开始自动翻页'))
    .onClick((): void => this.onToggleRunning());
  }

  @Builder
  private stopControl() {
    Column() {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.reader_auto_stop'))
          .width(17)
          .height(17);
      }
      .width(24)
      .height(24)
      .borderRadius(12);
      Text('停止')
        .width(18)
        .height(9)
        .margin({ top: 4.5 })
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(9)
        .lineHeight(9)
        .fontColor('#8C3D36')
        .textAlign(TextAlign.Center)
        .maxLines(1);
    }
    .width(24)
    .height(42)
    .alignItems(HorizontalAlign.Center)
    .enabled(this.status !== 'stopped')
    .opacity(this.status === 'stopped' ? 0.4 : 1)
    .accessibilityText('停止自动翻页')
    .onClick((): void => {
      if (this.status !== 'stopped') {
        this.onStop();
      }
    });
  }

  @Builder
  private speedControl() {
    Row() {
      Text('翻页速度')
        .layoutWeight(1)
        .height(16)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(11)
        .fontColor(TOK_READ_INK)
        .maxLines(1);

      this.speedButton('-', '减慢自动翻页', true);
      Text(`${this.speedSeconds} 秒`)
        .width(48)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(900)
        .fontSize(11)
        .lineHeight(11)
        .fontColor(TOK_READ_PRIMARY)
        .textAlign(TextAlign.Center)
        .maxLines(1);
      this.speedButton('+', '加快自动翻页', false);
    }
    .width('100%')
    .height(this.isTablet ? QUICK_AUTO_PAGE_SPEED_HEIGHT_TABLET : QUICK_AUTO_PAGE_SPEED_HEIGHT_PHONE)
    .padding({
      left: this.isTablet ? QUICK_AUTO_PAGE_SPEED_PADDING_TABLET : QUICK_AUTO_PAGE_SPEED_PADDING_PHONE,
      right: this.isTablet ? QUICK_AUTO_PAGE_SPEED_PADDING_TABLET : QUICK_AUTO_PAGE_SPEED_PADDING_PHONE,
    })
    .backgroundColor(TOK_SURFACE_PANEL_SOFT)
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
    .borderRadius(6)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private speedButton(label: string, accessibility: string, slower: boolean) {
    Stack({ alignContent: Alignment.Center }) {
      Text(label)
        .fontFamily('ReaderInter')
        .fontWeight(800)
        .fontSize(18)
        .lineHeight(18)
        .fontColor(TOK_READ_MUTED)
        .textAlign(TextAlign.Center);
    }
    .width(24)
    .height(24)
    .backgroundColor(TOK_SURFACE_PANEL_SOFT)
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
    .borderRadius(12)
    .accessibilityText(accessibility)
    .onClick((): void => {
      if (slower) {
        this.onSlowDown();
      } else {
        this.onSpeedUp();
      }
    });
  }

  private panelWidth(): number {
    return this.isTablet ? QUICK_AUTO_PAGE_PANEL_WIDTH_TABLET : QUICK_AUTO_PAGE_PANEL_WIDTH_PHONE;
  }

  private chapterRightGap(): number {
    const designPanelWidth = this.panelWidth();
    const chapterWidth = this.isTablet ? QUICK_AUTO_PAGE_CHAPTER_WIDTH_TABLET :
      QUICK_AUTO_PAGE_CHAPTER_WIDTH_PHONE;
    const nextX = this.isTablet ? QUICK_AUTO_PAGE_NEXT_X_TABLET : QUICK_AUTO_PAGE_NEXT_X_PHONE;
    return designPanelWidth - QUICK_AUTO_PAGE_PANEL_PADDING_X * 2 - nextX - chapterWidth;
  }

  private primaryActorGap(): number {
    const chapterWidth = this.isTablet ? QUICK_AUTO_PAGE_CHAPTER_WIDTH_TABLET :
      QUICK_AUTO_PAGE_CHAPTER_WIDTH_PHONE;
    const runningX = this.isTablet ? QUICK_AUTO_PAGE_RUNNING_X_TABLET : QUICK_AUTO_PAGE_RUNNING_X_PHONE;
    return runningX - QUICK_AUTO_PAGE_PREVIOUS_X - chapterWidth;
  }

}
