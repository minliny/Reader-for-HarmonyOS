import { ReaderAdaptive } from '../ReaderAdaptive';
import { ReaderControlLayer } from './ReaderControlLayer';
import { ReaderMotion } from '../ReaderMotion';
import { ReaderMode, ReaderUiState } from '../ReaderUiState';
import { ReaderTypography } from '../ReaderTypography';

@Component
export struct ImmersiveReaderSurface {
  @Prop uiState: ReaderUiState;
  onBack: () => void = () => {};
  onToggleControls: () => void = () => {};
  onDismissControls: () => void = () => {};
  onToggleReducedMotion: (enabled: boolean) => void = (_enabled: boolean) => {};
  onStartSession: (kind: string) => void = (_kind: string) => {};
  onToggleSession: () => void = () => {};
  onStopSession: () => void = () => {};
  onOpenPresentation: (route: string) => void = (_route: string) => {};
  onToggleMore: () => void = () => {};
  onCloseMore: () => void = () => {};
  onToggleBrightnessAuto: () => void = () => {};
  onAdjustBrightness: (delta: number) => void = (_delta: number) => {};

  private contentText(): string {
    return this.uiState.readerContext.contentPreview;
  }

  private bodyPadding(): Padding {
    const sideInset = this.uiState.adaptive.widthVp < 360 ?
      Math.min(28, this.uiState.readerPageSpace.sideMargin) :
      this.uiState.readerPageSpace.sideMargin;
    return {
      left: sideInset,
      right: sideInset,
      top: this.uiState.readerPageSpace.topMargin,
      bottom: ReaderTypography.bodyBottomInset
    };
  }

  private bodyLineHeight(): number {
    return Math.round(this.uiState.readerTypography.fontSize * this.uiState.readerTypography.lineHeightRatio);
  }

  private brightnessDimOpacity(): number {
    return Math.max(0, Math.min(0.56, (100 - this.uiState.readerBrightness.value) / 140));
  }

  private contentParagraphs(): string[] {
    const source = this.contentText();
    const parts = source.split('\n');
    const paragraphs: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      const item = parts[i].trim();
      if (item.length > 0) {
        paragraphs.push(item);
      }
    }
    return paragraphs;
  }

  private currentBookTitle(): string {
    return this.uiState.readerContext.bookTitle;
  }

  private currentChapterTitle(): string {
    return this.uiState.readerContext.chapterTitle;
  }

  private readingHeadingTitle(): string {
    return this.currentChapterTitle();
  }

  private readingParagraphText(paragraph: string): string {
    return paragraph.trim();
  }

  private currentProgress(): string {
    return this.uiState.readerContext.progressText;
  }

  private currentPageLabel(): string {
    if (this.uiState.readerContext.pageLabel.length > 0) {
      return this.uiState.readerContext.pageLabel;
    }
    return `${this.uiState.readerPagination.pageIndex + 1} / ${this.uiState.readerPagination.pageCount}`;
  }

  private currentInfoText(): string {
    const book = this.currentBookTitle();
    const chapter = this.currentChapterTitle();
    if (book.length > 0 && chapter.length > 0) {
      return `${book} · ${chapter}`;
    }
    return book.length > 0 ? book : chapter;
  }

  private currentTimeText(): string {
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    return `${hour}:${minute}`;
  }

  build() {
    Stack() {
      this.ReadingBackgroundLayer()
      this.ReadingTextLayer()
      this.BrightnessDimLayer()

      if (this.uiState.readerMode === ReaderMode.immersive) {
        this.ImmersiveInfoLayer()
        this.ImmersiveTapZones()
        this.ImmersiveFooterStatusLayer()
        this.TextSelectionLayer()
      }

      if (this.uiState.readerMode !== ReaderMode.immersive) {
        ReaderControlLayer({
          uiState: this.uiState,
          onDismiss: this.onDismissControls,
          onBack: this.onBack,
          onStartSession: this.onStartSession,
          onToggleSession: this.onToggleSession,
          onStopSession: this.onStopSession,
          onOpenPresentation: this.onOpenPresentation,
          onToggleMore: this.onToggleMore,
          onCloseMore: this.onCloseMore,
          onToggleBrightnessAuto: this.onToggleBrightnessAuto,
          onAdjustBrightness: this.onAdjustBrightness
        })
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.uiState.readerTheme.paperEnd)
    .animation({ duration: ReaderMotion.durationReaderEntry(this.uiState.reducedMotion), curve: Curve.EaseOut })
  }

  @Builder
  ReadingBackgroundLayer() {
    Column()
      .width('100%')
      .height('100%')
      .backgroundColor(this.uiState.readerTheme.paperEnd)
  }

  @Builder
  ReadingTextLayer() {
    Column() {
      if (this.readingHeadingTitle().length > 0) {
        Text(this.readingHeadingTitle())
          .fontSize(ReaderTypography.bodyTitleFontSize)
          .lineHeight(ReaderTypography.bodyTitleLineHeight)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.uiState.readerTheme.ink)
          .fontFamily(this.uiState.readerTypography.fontFamily)
          .textAlign(TextAlign.Center)
          .width('100%')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ bottom: ReaderTypography.bodyTitleBottom })
      }
      ForEach(this.contentParagraphs(), (paragraph: string) => {
        Text(this.readingParagraphText(paragraph))
          .fontSize(this.uiState.readerTypography.fontSize)
          .fontColor(this.uiState.readerTheme.ink)
          .fontFamily(this.uiState.readerTypography.fontFamily)
          .fontWeight(FontWeight.Regular)
          .lineHeight(this.bodyLineHeight())
          .width('100%')
          .textAlign(TextAlign.Start)
          .textIndent(this.uiState.readerTypography.fontSize * this.uiState.readerPageSpace.paragraphIndent)
          .margin({ bottom: this.uiState.readerTypography.paragraphGap })
      }, (paragraph: string) => paragraph)
      Blank()
    }
    .width(ReaderAdaptive.readerBodyWidth(this.uiState.adaptive))
    .height('100%')
    .padding(this.bodyPadding())
    .backgroundColor(this.uiState.readerTheme.paperStart)
    .borderRadius(this.uiState.adaptive.readerContentMode === 'single' ? 0 : 8)
  }

  @Builder
  BrightnessDimLayer() {
    Column()
      .width('100%')
      .height('100%')
      .backgroundColor('#000000')
      .opacity(this.brightnessDimOpacity())
      .hitTestBehavior(HitTestMode.None)
  }

  @Builder
  ImmersiveInfoLayer() {
    Column() {
      Row() {
        Text(this.currentInfoText())
          .fontSize(ReaderTypography.immersiveInfoFontSize)
          .lineHeight(ReaderTypography.immersiveInfoLineHeight)
          .fontColor('#766C61')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .layoutWeight(1)
        Text(this.currentTimeText())
          .fontSize(ReaderTypography.immersiveInfoFontSize)
          .lineHeight(ReaderTypography.immersiveInfoLineHeight)
          .fontColor('#766C61')
      }
      .width('100%')

      Blank()
    }
    .width('100%')
    .height('100%')
    .padding({
      left: ReaderTypography.immersiveInfoHorizontal,
      right: ReaderTypography.immersiveInfoHorizontal,
      top: ReaderTypography.immersiveInfoTop,
      bottom: ReaderTypography.immersiveInfoBottom
    })
    .hitTestBehavior(HitTestMode.None)
  }

  @Builder
  ImmersiveTapZones() {
    Row() {
      Column()
        .height('100%')
        .layoutWeight(1)
        .backgroundColor('#00000000')
      Column()
        .height('100%')
        .layoutWeight(1)
        .backgroundColor('#00000000')
        .onClick(() => this.onToggleControls())
      Column()
        .height('100%')
        .layoutWeight(1)
        .backgroundColor('#00000000')
    }
    .width('100%')
    .height('100%')
  }

  @Builder
  TextSelectionLayer() {
    Column()
      .width('100%')
      .height('100%')
      .backgroundColor('#00000000')
      .hitTestBehavior(HitTestMode.None)
  }

  @Builder
  ImmersiveFooterStatusLayer() {
    Column() {
      Blank()
      Row() {
        Text(this.currentProgress())
          .fontSize(ReaderTypography.immersiveInfoFontSize)
          .lineHeight(ReaderTypography.immersiveInfoLineHeight)
          .fontColor('#766C61')
        Blank()
        Row() {
          Text(this.currentPageLabel())
            .fontSize(ReaderTypography.immersiveInfoFontSize)
            .lineHeight(ReaderTypography.immersiveInfoLineHeight)
            .fontColor('#766C61')
          if (this.uiState.activeSession.capsuleVisible) {
            this.SessionCapsule()
          }
        }
        .height(24)
        .alignItems(VerticalAlign.Center)
        .justifyContent(FlexAlign.End)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .height('100%')
    .padding({
      left: ReaderTypography.immersiveInfoHorizontal,
      right: ReaderTypography.immersiveInfoHorizontal,
      bottom: ReaderTypography.immersiveInfoBottom
    })
    .hitTestBehavior(HitTestMode.Transparent)
  }

  @Builder
  SessionCapsule() {
    Row() {
      if (this.uiState.activeSession.kind === 'tts') {
        this.SessionVoiceIcon()
      } else {
        this.SessionCountdownDot()
      }
      Text(this.uiState.activeSession.label)
        .fontSize(10)
        .fontWeight(FontWeight.Bold)
        .fontColor('#4A4036')
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1)
      this.SessionControlButton()
    }
    .width(this.uiState.activeSession.kind === 'autoPage' ? 96 : 94)
    .height(24)
    .padding({ left: 5, right: 5 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor('#D1FFFAF4')
    .borderColor('#38766C61')
    .borderWidth(1)
    .borderRadius(999)
    .margin({ left: 5 })
    .shadow({ radius: 8, color: '#12463423', offsetX: 0, offsetY: 3 })
    .accessibilityText(`阅读会话胶囊 ${this.uiState.activeSession.kind} ${this.uiState.activeSession.statusText}`)
    .animation({ duration: ReaderMotion.durationReaderSession(this.uiState.reducedMotion), curve: Curve.EaseOut })
  }

  @Builder
  SessionCountdownDot() {
    Text(this.uiState.activeSession.countdown.toString())
      .width(18)
      .height(16)
      .fontSize(8)
      .fontWeight(FontWeight.Bold)
      .fontColor('#FFFFFF')
      .textAlign(TextAlign.Center)
      .backgroundColor('#274F66')
      .borderRadius(8)
      .margin({ right: 4 })
  }

  @Builder
  SessionVoiceIcon() {
    Image($r('app.media.reader_icon_tts_white'))
      .width(16)
      .height(16)
      .objectFit(ImageFit.Contain)
      .padding(2.5)
      .backgroundColor('#274F66')
      .borderRadius(8)
      .margin({ right: 4 })
  }

  @Builder
  SessionControlButton() {
    Button() {
      if (this.uiState.activeSession.playing) {
        Image($r('app.media.reader_icon_pause_white'))
          .width(8)
          .height(8)
          .objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.reader_icon_play_white'))
          .width(8)
          .height(8)
          .objectFit(ImageFit.Contain)
      }
    }
    .width(16)
    .height(16)
    .padding(0)
    .backgroundColor('#274F66')
    .borderRadius(8)
    .margin({ left: 4 })
    .onClick(() => this.onToggleSession())
    .accessibilityText(this.uiState.activeSession.playing ? '暂停自动翻页' : '继续自动翻页')
  }
}
