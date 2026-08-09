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

  build() {
    Column({ space: this.isTablet ? 6 : 5 }) {
      this.header();
      this.playbackControls();
      this.speedControl();
    }
    .width('100%')
    .height(this.isTablet ? 190 : 196)
    .padding({ left: 11, right: 11, top: 13, bottom: 13 })
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
    .borderRadius(8)
    .clip(true);
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
      .height(24)
      .padding({ left: 9, right: 9 })
      .backgroundColor(TOK_SURFACE_PANEL)
      .borderRadius(8)
      .alignItems(VerticalAlign.Center)
      .accessibilityText('返回阅读控制首页')
      .onClick((): void => this.onBack());
    }
    .width('100%')
    .height(24)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private playbackControls() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.chapterControl(true);
      this.runningControl();
      this.chapterControl(false);
      this.stopControl();
    }
    .width('100%')
    .height(this.isTablet ? 94 : 104)
    .backgroundColor(TOK_SURFACE_PANEL_SOFT)
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private chapterControl(previous: boolean) {
    Column() {
      Stack({ alignContent: Alignment.Center }) {
        Image($r(previous ?
          'app.media.reader_auto_previous_chapter' : 'app.media.reader_auto_next_chapter'))
          .width(25)
          .height(17);
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
    .width(this.isTablet ? 56 : 62)
    .height(52)
    .alignItems(HorizontalAlign.Center)
    .position({
      x: previous ? 7.75 : (this.isTablet ? 174.25 : 192.25),
      y: this.isTablet ? 20 : 25,
    })
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
        Image($r('app.media.reader_auto_play'))
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
    .width(this.isTablet ? 74 : 82)
    .height(52)
    .alignItems(HorizontalAlign.Center)
    .position({ x: this.isTablet ? 82 : 90, y: this.isTablet ? 20 : 25 })
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
    .position({ x: this.isTablet ? 144 : 160, y: this.isTablet ? 30.5 : 35.5 })
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
    .height(this.isTablet ? 34 : 32)
    .padding({ left: this.isTablet ? 8 : 7, right: this.isTablet ? 8 : 7 })
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
}
