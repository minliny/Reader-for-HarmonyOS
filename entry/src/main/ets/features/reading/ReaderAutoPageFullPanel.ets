import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_BORDER_W,
  TOK_LINE,
  TOK_LINE_STRONG,
  TOK_READ_ELEVATED,
  TOK_READ_HANDLE,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_READ_SURFACE,
  TOK_SURFACE_PANEL,
  TOK_SURFACE_PANEL_SOFT,
} from '../common/ReaderTokens';
import type { ReaderAutoPageStatus } from './ReaderAutoPageState';
import {
  formatReaderAutoPageFullWheelValue,
  READER_AUTO_PAGE_FULL_MAX_MINUTES,
  READER_AUTO_PAGE_FULL_MAX_SECONDS,
  READER_AUTO_PAGE_FULL_MAX_SPEED_SECONDS,
  READER_AUTO_PAGE_FULL_MIN_MINUTES,
  READER_AUTO_PAGE_FULL_MIN_SECONDS,
  READER_AUTO_PAGE_FULL_MIN_SPEED_SECONDS,
} from './ReaderAutoPageFullState';

/**
 * Figma Full Auto Page sheet / Phone only.
 *
 * Static sources:
 * - Phone final page `1771:10277`
 * - Full panel instance `1771:10280`
 * - Content master `1764:10223`
 *
 * Motion sources `1938:6245` and `1979:21744` coordinate sixteen actors
 * spanning the Quick sheet, Full sheet, BrightnessRail, ModuleNav, and Back.
 * `ReaderControlPanel` owns the shared registry and production timing. This
 * component exposes the thirteen sheet-local actors; the owner supplies one
 * expansion endpoint so the source tracks remain individually addressable.
 *
 * Figma contains no Tablet Full Auto Page master. When `isTablet` is true the
 * component deliberately emits no layout instead of scaling the Phone sheet.
 */
@Component
export struct ReaderAutoPageFullPanel {
  @Prop isTablet: boolean = false;
  @Prop status: ReaderAutoPageStatus = 'stopped';
  @Prop timerSummaryText: string = '15:00';
  @Prop timerMinutes: number = 15;
  @Prop timerSeconds: number = 0;
  @Prop speedSeconds: number = 8;
  @Prop followHighlight: boolean = true;
  /** True only while mounted inside ReaderControlPanel's unified sheet actor. */
  @Prop embeddedInUnifiedSurface: boolean = false;
  /** False is the exact Quick endpoint; true is the exact Phone Full endpoint. */
  @Prop motionExpanded: boolean = true;
  @Prop interactionEnabled: boolean = true;
  @State private speedPreviewSeconds: number = -1;

  onCollapse: () => void = (): void => {};
  onPreviousChapter: () => void = (): void => {};
  onToggleRunning: () => void = (): void => {};
  onStop: () => void = (): void => {};
  onNextChapter: () => void = (): void => {};
  onTimerChange: (minutes: number, seconds: number) => void =
    (_minutes: number, _seconds: number): void => {};
  onSpeedChange: (seconds: number) => void = (_seconds: number): void => {};
  onFollowHighlightChange: (enabled: boolean) => void = (_enabled: boolean): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    if (!this.isTablet) {
      this.phonePanel();
    }
  }

  @Builder
  private phonePanel() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width(42)
        .height(4)
        .backgroundColor(TOK_READ_HANDLE)
        .borderRadius(999)
        .position({ x: 160, y: 9 });

      this.header();

      // OutgoingActor/Back is part of both source timelines even though it
      // does not exist in the Full static endpoint. Keep it in this registry
      // at its Quick coordinates and drive only the source opacity/y track.
      this.collapsedBackActor();

      Row()
        .width(336)
        .height(665)
        .backgroundColor(TOK_SURFACE_PANEL)
        .border({ width: TOK_BORDER_W, color: TOK_LINE })
        .borderRadius(12)
        .position({ x: 14, y: 58 });

      Stack({ alignContent: Alignment.TopStart }) {
        this.controlSection();
        this.timerSection();
        this.detailsSection();
      }
      .width(314)
      .height(435.17)
      .position({ x: 25, y: 69 });
    }
    .width(364)
    .height(736)
    .backgroundColor(this.embeddedInUnifiedSurface ? Color.Transparent : TOK_READ_SURFACE)
    .border({
      width: this.embeddedInUnifiedSurface ? 0 : TOK_BORDER_W,
      color: TOK_LINE_STRONG,
    })
    .borderRadius(this.embeddedInUnifiedSurface ? 0 : 24)
    .clip(true)
    .enabled(this.interactionEnabled);
  }

  @Builder
  private header() {
    Row() {
      Row({ space: 8 }) {
        Image($r('app.media.reader_auto_full_header'))
          .width(16)
          .height(16);
        Text('自动翻页')
          .width(56)
          .height(17)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(14)
          .lineHeight(16.8)
          .fontColor(TOK_READ_INK)
          .maxLines(1);
      }
      .width(286)
      .height(30)
      .alignItems(VerticalAlign.Center);

      Text('收起')
        .width(40)
        .height(26)
          .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(13)
        .fontColor(TOK_READ_PRIMARY)
        .textAlign(TextAlign.Center)
        .backgroundColor(TOK_SURFACE_PANEL_SOFT)
        .borderRadius(8)
        .accessibilityText('收起自动翻页完整控制')
        .onClick((): void => this.onCollapse());
    }
    .width(336)
    .height(30)
    .alignItems(VerticalAlign.Center)
    .position({ x: 14, y: 20 })
    .opacity(this.addedActorOpacity())
    .translate({ y: this.addedActorTranslateY(18) });
  }

  @Builder
  private collapsedBackActor() {
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
    .position({ x: 23.44, y: 41 })
    .opacity(this.outgoingActorOpacity())
    .translate({ y: this.outgoingActorTranslateY(14) })
    .enabled(false)
    .accessibilityText('返回阅读控制首页');
  }

  @Builder
  private controlSection() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        Text('自动翻页控制')
          .width(268)
          .height(14.4)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .lineHeight(14.4)
          .fontColor(TOK_READ_INK)
          .maxLines(1);
        Text('未开始')
          .width(30)
          .height(14)
          .margin({ left: 8 })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Medium)
          .fontSize(10)
          .lineHeight(12)
          .fontColor(TOK_READ_MUTED)
          .textAlign(TextAlign.End)
          .maxLines(1);
      }
      .width(306)
      .height(14.4)
      .position({ x: 4, y: 10 })
      .opacity(this.addedActorOpacity())
      .translate({ y: this.addedActorTranslateY(14) });

      Stack({ alignContent: Alignment.TopStart }) {
        this.chapterButton(true);
        this.runningButton();
        this.stopButton();
        this.chapterButton(false);
      }
      .width(306)
      .height(62)
      .borderRadius(8)
      .clip(true)
      .position({ x: 4, y: 32.4 });
    }
    .width(314)
    .height(104.39)
    .position({ x: 0, y: 0 });
  }

  @Builder
  private chapterButton(previous: boolean) {
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
      .backgroundColor(TOK_READ_ELEVATED)
      .borderRadius(8);

      Text(previous ? '上一章' : '下一章')
        .width(27)
        .height(9)
        .margin({ top: 7 })
          .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(9)
        .lineHeight(9)
        .fontColor(TOK_READ_INK)
        .textAlign(TextAlign.Center)
        .maxLines(1);
    }
    .width(this.persistentChapterWidth())
    .height(52)
    .alignItems(HorizontalAlign.Center)
    .position({ x: previous ? 9.75 : 224.25, y: 5 })
    .translate({
      x: this.persistentChapterTranslateX(previous),
      y: this.persistentActorTranslateY(-9.841),
    })
    .accessibilityText(previous ? '上一章' : '下一章')
    .onClick((): void => {
      if (previous) {
        this.onPreviousChapter();
      } else {
        this.onNextChapter();
      }
    });
  }

  @Builder
  private runningButton() {
    Column() {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.reader_auto_full_play'))
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
          .fontFamily('ReaderInter')
        .fontWeight(800)
        .fontSize(9)
        .lineHeight(9)
        .fontColor(TOK_READ_INK)
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .translate({
          x: this.persistentActorTranslateX(-31.492),
          y: this.persistentActorTranslateY(-2.5),
        });
    }
    .width(this.persistentPlayWidth())
    .height(this.persistentPlayHeight())
    .alignItems(HorizontalAlign.Center)
    .position({ x: 105.49, y: 5 })
    .translate({
      x: this.persistentActorTranslateX(5.058),
      y: this.persistentActorTranslateY(-7.341),
    })
    .accessibilityText(this.status === 'running' ? '暂停自动翻页' :
      (this.status === 'paused' ? '继续自动翻页' : '开始自动翻页'))
    .onClick((): void => this.onToggleRunning());
  }

  @Builder
  private stopButton() {
    Column() {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.reader_auto_full_stop'))
          .width(17)
          .height(17);
      }
      .width(24)
      .height(24)
      .borderRadius(12)
      .translate({
        x: this.persistentActorTranslateX(-33.106),
        y: this.persistentActorTranslateY(-9.841),
      });
      Text('停止')
        .width(18)
        .height(9)
        .margin({ top: 4.5 })
          .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(9)
        .lineHeight(9)
        .fontColor('#8C3D36')
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .translate({
          x: this.persistentActorTranslateX(-33.106),
          y: this.persistentActorTranslateY(-9.841),
        });
    }
    .width(24)
    .height(42)
    .alignItems(HorizontalAlign.Center)
    .position({ x: 188.66, y: 15.5 })
    .accessibilityText('停止自动翻页')
    .onClick((): void => this.onStop());
  }

  @Builder
  private timerSection() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        Text('定时')
          .width(270.2)
          .height(14.4)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .lineHeight(14.4)
          .fontColor(TOK_READ_INK)
          .maxLines(1);
        Text(this.timerSummaryText)
          .width(27.8)
          .height(12)
          .margin({ left: 8 })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Medium)
          .fontSize(10)
          .lineHeight(12)
          .fontColor(TOK_READ_MUTED)
          .textAlign(TextAlign.End)
          .maxLines(1);
      }
      .width(306)
      .height(14.4)
      .position({ x: 4, y: 11 });

      Stack({ alignContent: Alignment.TopStart }) {
        Row({ space: 8 }) {
          Stack({ alignContent: Alignment.Center }) {
            Image($r('app.media.reader_auto_full_clock'))
              .width(18)
              .height(18);
          }
          .width(30)
          .height(30)
          .borderRadius(15);
          Text('自动停止')
          .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(11)
            .lineHeight(11)
            .fontColor(TOK_READ_INK)
            .maxLines(1);
        }
        .width(84)
        .height(30)
        .alignItems(VerticalAlign.Center)
        .position({ x: 15, y: 54 });

        Stack({ alignContent: Alignment.TopStart }) {
          this.timerWheel(true);
          Text(':')
            .width(8)
            .height(22)
          .fontFamily('ReaderInter')
            .fontWeight(800)
            .fontSize(18)
            .lineHeight(22)
            .fontColor(TOK_READ_PRIMARY)
            .textAlign(TextAlign.Center)
            .position({ x: 84, y: 40.5 });
          this.timerWheel(false);
        }
        .width(176)
        .height(114)
        .position({ x: 115, y: 12 });
      }
      .width(306)
      .height(138)
      .backgroundColor(TOK_SURFACE_PANEL_SOFT)
      .border({ width: TOK_BORDER_W, color: TOK_LINE })
      .borderRadius(10)
      .position({ x: 4, y: 33.39 });
    }
    .width(314)
    .height(181.39)
    .border({ width: { top: TOK_BORDER_W }, color: TOK_LINE })
    .position({ x: 0, y: 104.39 })
    .opacity(this.addedActorOpacity())
    .translate({ y: this.addedActorTranslateY(22) });
  }

  @Builder
  private timerWheel(minutes: boolean) {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.hasAdjacentTimerValue(minutes, -1)) {
        this.timerWheelText(this.adjacentTimerValue(minutes, -1), 0, false, minutes, -1);
      }
      this.timerWheelText(this.currentTimerValue(minutes), 34, true, minutes, 0);
      if (this.hasAdjacentTimerValue(minutes, 1)) {
        this.timerWheelText(this.adjacentTimerValue(minutes, 1), 68, false, minutes, 1);
      }
    }
    .width(76)
    .height(102)
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
    .borderRadius(8)
    .clip(true)
    .position({ x: minutes ? 0 : 100, y: 0 });

    Text(minutes ? '分' : '秒')
      .width(76)
      .height(8)
          .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Bold)
      .fontSize(8)
      .lineHeight(8)
      .fontColor(TOK_READ_MUTED)
      .textAlign(TextAlign.Center)
      .position({ x: minutes ? 0 : 100, y: 106 });
  }

  @Builder
  private timerWheelText(value: number, y: number, selected: boolean, minutes: boolean, delta: number) {
    Text(formatReaderAutoPageFullWheelValue(value))
      .width(76)
      .height(34)
          .fontFamily('ReaderInter')
      .fontWeight(selected ? 800 : 600)
      .fontSize(selected ? 17 : 11)
      .lineHeight(selected ? 17 : 11)
      .fontColor(selected ? TOK_READ_INK : TOK_READ_MUTED)
      .opacity(selected ? 1 : 0.42)
      .textAlign(TextAlign.Center)
      .position({ x: 0, y })
      .accessibilityText(`${minutes ? '分钟' : '秒数'}，${value}`)
      .onClick((): void => {
        if (delta !== 0) {
          this.commitTimerStep(minutes, delta);
        }
      });
  }

  @Builder
  private detailsSection() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        Text('详细配置')
          .width(258)
          .height(14.4)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .lineHeight(14.4)
          .fontColor(TOK_READ_INK)
          .maxLines(1);
        Text('即时生效')
          .width(40)
          .height(14)
          .margin({ left: 8 })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Medium)
          .fontSize(10)
          .lineHeight(12)
          .fontColor(TOK_READ_MUTED)
          .textAlign(TextAlign.End)
          .maxLines(1);
      }
      .width(306)
      .height(14.4)
      .position({ x: 4, y: 11 })
      .opacity(this.addedActorOpacity())
      .translate({ y: this.addedActorTranslateY(18) });

      this.speedRow();
      this.followHighlightRow();
    }
    .width(314)
    .height(149.39)
    .border({ width: { top: TOK_BORDER_W }, color: TOK_LINE })
    .position({ x: 0, y: 285.78 });
  }

  @Builder
  private speedRow() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        Text('翻页速度')
          .width(80.56)
          .height(14)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(10)
          .lineHeight(13)
          .fontColor(TOK_READ_INK)
          .maxLines(1);
        Text(`${this.effectiveSpeedSeconds()} 秒`)
          .width(19.44)
          .height(14)
          .margin({ left: 8 })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(10)
          .lineHeight(13)
          .fontColor(TOK_READ_MUTED)
          .maxLines(1);
      }
      .width(108)
      .height(44)
      .alignItems(VerticalAlign.Center)
      .position({ x: 11, y: 10 });

      Stack({ alignContent: Alignment.TopStart }) {
        Text('2 秒')
          .width(17.3)
          .height(13)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(9)
          .lineHeight(13)
          .fontColor(TOK_READ_MUTED)
          .maxLines(1)
          .position({ x: 0, y: 15.5 });

        // Figma node `1764:11058` is an intentionally empty 109×44 frame.
        // The nearly-transparent native slider supplies semantics without
        // inventing a visible track or thumb absent from the source design.
        Slider({
          value: this.effectiveSpeedSeconds(),
          min: READER_AUTO_PAGE_FULL_MIN_SPEED_SECONDS,
          max: READER_AUTO_PAGE_FULL_MAX_SPEED_SECONDS,
          step: 1,
          style: SliderStyle.OutSet,
          direction: Axis.Horizontal,
          reverse: false,
        })
          .width(109)
          .height(44)
          .opacity(0.001)
          .accessibilityText('调整自动翻页速度')
          .onChange((value: number, mode: SliderChangeMode): void => {
            this.speedPreviewSeconds = Math.round(value);
            if (mode === SliderChangeMode.End) {
              const committed = this.speedPreviewSeconds;
              this.speedPreviewSeconds = -1;
              this.onSpeedChange(committed);
            }
          })
          .position({ x: 26.3, y: 0 });

        Text('20 秒')
          .width(23.14)
          .height(13)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(9)
          .lineHeight(13)
          .fontColor(TOK_READ_MUTED)
          .textAlign(TextAlign.End)
          .maxLines(1)
          .position({ x: 143.86, y: 15.5 });
      }
      .width(167)
      .height(44)
      .position({ x: 128, y: 10 });
    }
    .width(this.persistentPageSpeedWidth())
    .height(this.persistentPageSpeedHeight())
    .backgroundColor(TOK_READ_SURFACE)
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
    .borderRadius(6)
    .position({ x: 4, y: 33.39 })
    .translate({
      x: this.persistentActorTranslateX(-5.45),
      y: this.persistentActorTranslateY(-208.623),
    });
  }

  @Builder
  private followHighlightRow() {
    Row() {
      Text('跟随高亮')
        .width(236)
        .height(13)
          .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(13)
        .fontColor(TOK_READ_INK)
        .maxLines(1);
      Stack({ alignContent: Alignment.TopStart }) {
        Row()
          .width(20)
          .height(20)
          .backgroundColor(TOK_READ_ELEVATED)
          .borderRadius(10)
          .position({ x: this.followHighlight ? 22 : 2, y: 2 });
      }
      .width(44)
      .height(24)
      .margin({ left: 8 })
      .backgroundColor(this.followHighlight ? TOK_READ_PRIMARY : TOK_SURFACE_PANEL_SOFT)
      .borderRadius(999)
      .accessibilityText(`跟随高亮，${this.followHighlight ? '已开启' : '已关闭'}`)
      .onClick((): void => this.onFollowHighlightChange(!this.followHighlight));
    }
    .width(306)
    .height(36)
    .padding({ left: 9, right: 9, top: 6, bottom: 6 })
    .backgroundColor(TOK_READ_SURFACE)
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
    .borderRadius(6)
    .alignItems(VerticalAlign.Center)
    .position({ x: 4, y: 103.39 })
    .opacity(this.addedActorOpacity())
    .translate({ y: this.addedActorTranslateY(18) });
  }

  // The values below are copied from the authoritative paired timelines:
  // expand `1938:6245`, collapse `1979:21744`. ReaderControlPanel supplies
  // the hold/easing schedule; this component supplies each actor endpoint.
  private addedActorOpacity(): number {
    return this.motionExpanded ? 1 : 0;
  }

  private outgoingActorOpacity(): number {
    return this.motionExpanded ? 0 : 1;
  }

  private addedActorTranslateY(collapsedY: number): number {
    return this.motionExpanded ? 0 : collapsedY;
  }

  private outgoingActorTranslateY(expandedY: number): number {
    return this.motionExpanded ? expandedY : 0;
  }

  private persistentActorTranslateX(collapsedX: number): number {
    return this.motionExpanded ? 0 : collapsedX;
  }

  private persistentActorTranslateY(collapsedY: number): number {
    return this.motionExpanded ? 0 : collapsedY;
  }

  private persistentChapterWidth(): number {
    return this.motionExpanded ? 72 : 62;
  }

  private persistentChapterTranslateX(previous: boolean): number {
    return this.persistentActorTranslateX(previous ? -6.45 : -36.4);
  }

  private persistentPlayWidth(): number {
    return this.motionExpanded ? 95 : 32;
  }

  private persistentPlayHeight(): number {
    return this.motionExpanded ? 52 : 32;
  }

  private persistentPageSpeedWidth(): number {
    return this.motionExpanded ? 306 : 264;
  }

  private persistentPageSpeedHeight(): number {
    return this.motionExpanded ? 64 : 32;
  }

  private effectiveSpeedSeconds(): number {
    if (this.speedPreviewSeconds >= READER_AUTO_PAGE_FULL_MIN_SPEED_SECONDS) {
      return this.speedPreviewSeconds;
    }
    return Math.max(READER_AUTO_PAGE_FULL_MIN_SPEED_SECONDS,
      Math.min(READER_AUTO_PAGE_FULL_MAX_SPEED_SECONDS, Math.round(this.speedSeconds)));
  }

  private currentTimerValue(minutes: boolean): number {
    const raw = minutes ? this.timerMinutes : this.timerSeconds;
    const minimum = minutes ? READER_AUTO_PAGE_FULL_MIN_MINUTES : READER_AUTO_PAGE_FULL_MIN_SECONDS;
    const maximum = minutes ? READER_AUTO_PAGE_FULL_MAX_MINUTES : READER_AUTO_PAGE_FULL_MAX_SECONDS;
    if (!Number.isFinite(raw)) {
      return minimum;
    }
    return Math.max(minimum, Math.min(maximum, Math.trunc(raw)));
  }

  private adjacentTimerValue(minutes: boolean, delta: number): number {
    return this.currentTimerValue(minutes) + delta;
  }

  private hasAdjacentTimerValue(minutes: boolean, delta: number): boolean {
    const next = this.adjacentTimerValue(minutes, delta);
    const minimum = minutes ? READER_AUTO_PAGE_FULL_MIN_MINUTES : READER_AUTO_PAGE_FULL_MIN_SECONDS;
    const maximum = minutes ? READER_AUTO_PAGE_FULL_MAX_MINUTES : READER_AUTO_PAGE_FULL_MAX_SECONDS;
    return next >= minimum && next <= maximum;
  }

  private commitTimerStep(minutes: boolean, delta: number): void {
    if (minutes) {
      this.onTimerChange(this.adjacentTimerValue(true, delta), this.currentTimerValue(false));
    } else {
      this.onTimerChange(this.currentTimerValue(true), this.adjacentTimerValue(false, delta));
    }
  }
}
