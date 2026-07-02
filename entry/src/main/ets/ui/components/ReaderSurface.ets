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
  onStopSession: () => void = () => {};
  onOpenPresentation: (route: string) => void = (_route: string) => {};
  onToggleMore: () => void = () => {};
  onCloseMore: () => void = () => {};

  private contentText(): string {
    return this.uiState.readerContext.contentPreview;
  }

  private bodyPadding(): Padding {
    if (this.uiState.adaptive.widthVp < 360) {
      return { left: 24, right: 24, top: ReaderTypography.bodyTopInsetCompact, bottom: 48 };
    }
    if (this.uiState.adaptive.readerContentMode === 'single') {
      return { left: 32, right: 32, top: ReaderTypography.bodyTopInset, bottom: 48 };
    }
    return { left: 44, right: 44, top: ReaderTypography.bodyTopInsetWide, bottom: 56 };
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
        this.TextSelectionLayer()
      }

      if (this.uiState.readerMode !== ReaderMode.immersive) {
        ReaderControlLayer({
          uiState: this.uiState,
          onDismiss: this.onDismissControls,
          onBack: this.onBack,
          onStartSession: this.onStartSession,
          onStopSession: this.onStopSession,
          onOpenPresentation: this.onOpenPresentation,
          onToggleMore: this.onToggleMore,
          onCloseMore: this.onCloseMore
        })
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F1E8D8')
    .animation({ duration: ReaderMotion.durationReaderEntry(this.uiState.reducedMotion), curve: Curve.EaseOut })
  }

  @Builder
  ReadingBackgroundLayer() {
    Column()
      .width('100%')
      .height('100%')
      .backgroundColor('#F1E8D8')
  }

  @Builder
  ReadingTextLayer() {
    Column() {
      if (this.readingHeadingTitle().length > 0) {
        Text(this.readingHeadingTitle())
          .fontSize(ReaderTypography.bodyTitleFontSize)
          .lineHeight(ReaderTypography.bodyTitleLineHeight)
          .fontWeight(FontWeight.Bold)
          .fontColor('#2B241D')
          .fontFamily(ReaderTypography.readerFontFamily)
          .textAlign(TextAlign.Center)
          .width('100%')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ bottom: ReaderTypography.bodyTitleBottom })
      }
      ForEach(this.contentParagraphs(), (paragraph: string) => {
        Text(this.readingParagraphText(paragraph))
          .fontSize(ReaderTypography.bodyFontSize)
          .fontColor('#2B241D')
          .fontFamily(ReaderTypography.readerFontFamily)
          .fontWeight(FontWeight.Regular)
          .lineHeight(ReaderTypography.bodyLineHeight())
          .width('100%')
          .textAlign(TextAlign.Start)
          .margin({ bottom: ReaderTypography.bodyParagraphGap })
      }, (paragraph: string) => paragraph)
      Blank()
    }
    .width(ReaderAdaptive.readerBodyWidth(this.uiState.adaptive))
    .height('100%')
    .padding(this.bodyPadding())
    .backgroundColor('#FFF9EE')
    .borderRadius(this.uiState.adaptive.readerContentMode === 'single' ? 0 : 8)
  }

  @Builder
  BrightnessDimLayer() {
    Column()
      .width('100%')
      .height('100%')
      .backgroundColor('#00000000')
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

      Row() {
        Text(this.currentProgress())
          .fontSize(ReaderTypography.immersiveInfoFontSize)
          .lineHeight(ReaderTypography.immersiveInfoLineHeight)
          .fontColor('#766C61')
        Blank()
        if (this.uiState.activeSession.capsuleVisible) {
          this.SessionCapsule()
        } else {
          Text('')
            .fontSize(ReaderTypography.immersiveInfoFontSize)
            .lineHeight(ReaderTypography.immersiveInfoLineHeight)
            .fontColor('#766C61')
        }
      }
      .width('100%')
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
  SessionCapsule() {
    Row() {
      Text(this.uiState.activeSession.label)
        .fontSize(12)
        .fontColor('#F7EFE4')
      Text(this.uiState.activeSession.statusText)
        .fontSize(12)
        .fontColor('#D7C6AA')
        .margin({ left: 8 })
      Text(this.uiState.activeSession.playing ? '暂停' : '继续')
        .fontSize(12)
        .fontColor('#FFFFFF')
        .margin({ left: 10 })
        .onClick(() => this.onStopSession())
    }
    .height(34)
    .padding({ left: 12, right: 12 })
    .backgroundColor('#4A3327')
    .borderRadius(8)
    .animation({ duration: ReaderMotion.durationReaderSession(this.uiState.reducedMotion), curve: Curve.EaseOut })
  }
}
