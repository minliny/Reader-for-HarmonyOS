import { ReaderAdaptive } from '../ReaderAdaptive';
import { ReaderAccessibility } from '../ReaderAccessibility';
import { ReaderMotion } from '../ReaderMotion';
import { ReaderUiState } from '../ReaderUiState';
import { ReaderTypography } from '../ReaderTypography';

@Component
export struct ReaderSharedSurface {
  @Prop uiState: ReaderUiState;
  @Prop disableTurnAnimation: boolean = false;
  @Prop surfaceWidth: Length = '100%';
  @Prop surfaceHeight: Length = '100%';
  @Prop topInsetOverride: number = -1;
  @Prop sideInsetOverride: number = -1;
  @Prop bottomInsetOverride: number = -1;

  private contentText(): string {
    return this.uiState.readerContext.contentPreview;
  }

  private sideInset(): number {
    if (this.sideInsetOverride >= 0) {
      return this.sideInsetOverride;
    }
    if (this.uiState.adaptive.widthVp < 360) {
      return Math.min(28, this.uiState.readerPageSpace.sideMargin);
    }
    return this.uiState.readerPageSpace.sideMargin;
  }

  private topInset(): number {
    return this.topInsetOverride >= 0 ? this.topInsetOverride : this.uiState.readerPageSpace.topMargin;
  }

  private bottomInset(): number {
    return this.bottomInsetOverride >= 0 ? this.bottomInsetOverride : ReaderTypography.bodyBottomInset;
  }

  private bodyPadding(): Padding {
    return {
      left: this.sideInset(),
      right: this.sideInset(),
      top: this.topInset(),
      bottom: this.bottomInset()
    };
  }

  private bodyLineHeight(): number {
    return Math.round(this.uiState.readerTypography.fontSize * this.uiState.readerTypography.lineHeightRatio);
  }

  private readerFontFamily(): string {
    if (this.uiState.readerTypography.fontFamily === 'sans' || this.uiState.readerTypography.fontFamily === 'system') {
      return ReaderTypography.sansFontFamily;
    }
    if (this.uiState.readerTypography.fontFamily === 'serif') {
      return ReaderTypography.serifFontFamily;
    }
    return this.uiState.readerTypography.fontFamily;
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

  private readingHeadingTitle(): string {
    if (this.uiState.readerPagination.pageIndex > 0) {
      return '';
    }
    return this.uiState.readerContext.chapterTitle.replace(/^第\s*\d+\s*章\s*/, '');
  }

  private readingParagraphText(paragraph: string): string {
    return paragraph.trim();
  }

  private pageTurnDuration(): number {
    if (this.disableTurnAnimation) {
      return 0;
    }
    return ReaderMotion.durationPageTurn(this.uiState.reducedMotion);
  }

  build() {
    Stack() {
      this.ReadingBackgroundLayer()
      this.ReadingTextLayer()
      this.AnnotationLayer()
      this.TtsCursorLayer()
      this.BrightnessDimLayer()
    }
    .width(this.surfaceWidth)
    .height(this.surfaceHeight)
    .backgroundColor(this.uiState.readerTheme.paperEnd)
    .clip(true)
    .animation({ duration: this.pageTurnDuration(), curve: Curve.EaseOut })
    .accessibilityText('正文排版层')
    .accessibilityRole(ReaderAccessibility.listItemRole)
    .accessibilityDescription(ReaderAccessibility.readerBodyDescription)
  }

  // demo .fd-ir-background-layer:
  //   repeating-linear-gradient(0deg, texture 0 1px, transparent 1px 7px),
  //   linear-gradient(180deg, paper-start, paper-end),
  //   radial-gradient(circle at 50% 18%, rgba(255,255,255,0.7), transparent 42%);
  // Three stacked layers: paper linear gradient → radial highlight → texture (opacity-gated).
  @Builder
  ReadingBackgroundLayer() {
    // Layer 1: paper linear gradient (readerPaperStart → readerPaperEnd)
    Column()
      .width('100%')
      .height('100%')
      .linearGradient({
        angle: 180,
        colors: [[this.uiState.readerTheme.readerPaperStart, 0.0], [this.uiState.readerTheme.readerPaperEnd, 1.0]],
        repeating: false
      })
      .hitTestBehavior(HitTestMode.None)

    // Layer 2: radial highlight (white 0.7 at 50% 18%, fading to transparent at 42%)
    Column()
      .width('100%')
      .height('100%')
      .radialGradient({
        center: ['50%', '18%'],
        radius: Math.max(this.uiState.adaptive.widthVp * 0.42, 120),
        colors: [[this.uiState.readerTheme.readerRadialHighlight, 0.0], ['#00FFFFFF', 1.0]],
        repeating: false
      })
      .hitTestBehavior(HitTestMode.None)

    // Layer 3: paper texture (repeating horizontal lines, only when opacity > 0)
    if (this.uiState.readerTheme.paperTextureOpacity > 0) {
      this.PaperTextureLayer()
    }
  }

  // demo repeating-linear-gradient(0deg, texture-color 0 1px, transparent 1px 7px).
  // ArkUI has no native repeating gradient; approximated by a Column with the
  // texture tint at low opacity so horizontal bands are implied without drawing
  // dozens of dividers (matches the demo default of opacity 0 = invisible).
  // True repeating bands would require ~100 thin Divider components for a
  // typical viewport height — cost-prohibitive for a background layer.
  @Builder
  PaperTextureLayer() {
    Column()
      .width('100%')
      .height('100%')
      .backgroundColor(this.uiState.readerTheme.paperTextureColor)
      .opacity(this.uiState.readerTheme.paperTextureOpacity)
      .hitTestBehavior(HitTestMode.None)
  }

  // demo .fd-reader-annotation — text-decoration: underline with
  // var(--reader-annotation-line) color, 0.07em thickness, 0.18em offset.
  // Variants: .is-dashed (dashed), .is-wavy (wavy, 0.06em, 0.2em offset).
  // Annotation rendering requires inline text spans (Span/RichText) and an
  // annotation data model — not yet available in the skeleton phase. This
  // builder is a structural placeholder per demo contract slot parity.
  @Builder
  AnnotationLayer() {
    // Annotation spans will be rendered here when the annotation data model
    // and inline Span rendering are available.
  }

  // demo .fd-reader-tts-segment.is-tts-current::before — 3px cursor bar with
  // a soft halo (box-shadow: 0 0 0 4px var(--reader-tts-cursor-soft)).
  // Visible when TTS session is active (data-reader-tts-active="true"),
  // including both playing and paused states. Pulses opacity 0.42↔0.82 over
  // 1400ms when playing (data-reader-tts-playing="true"); static 0.58 when
  // paused. Pulse animation requires a driven property (deferred to motion
  // layer); static opacity is used as the baseline approximation.
  // demo ::after — arrow triangle (5px wide, 8px tall) pointing right.
  @Builder
  TtsCursorLayer() {
    if (this.ttsActive()) {
      Row() {
        // demo ::before — cursor bar + halo
        Stack() {
          // Halo: 4px spread around cursor bar (demo box-shadow)
          Column()
            .width(3 + 8)
            .height(this.bodyLineHeight() * 1.28 + 8)
            .backgroundColor(this.uiState.readerTheme.ttsCursorSoft)
            .borderRadius(999)
          // Cursor bar (demo: 3px wide, 1.28em tall, pill radius)
          Column()
            .width(3)
            .height(this.bodyLineHeight() * 1.28)
            .backgroundColor(this.uiState.readerTheme.ttsCursor)
            .borderRadius(999)
            .opacity(this.ttsCursorBarOpacity())
        }
        .width(11)
        .height(this.bodyLineHeight() * 1.28 + 8)
        .alignContent(Alignment.Center)
        .margin({ left: Math.max(this.sideInset() - 17, 0) })

        // demo ::after — arrow triangle (border-left 5px, top/bottom 4px transparent)
        Column()
          .width(0)
          .height(0)
          .border({
            width: { top: 4, bottom: 4, left: 5, right: 0 },
            color: {
              top: '#00000000',
              bottom: '#00000000',
              left: this.uiState.readerTheme.ttsCursor,
              right: '#00000000'
            }
          })
          .margin({ left: 1, top: this.bodyLineHeight() * 0.34 })

        Blank()
      }
      .width('100%')
      .height('100%')
      .alignItems(VerticalAlign.Top)
      .padding({ top: this.topInset() + this.bodyLineHeight() * 0.24 - 4 })
      .opacity(this.ttsCursorLayerOpacity())
      .hitTestBehavior(HitTestMode.None)
    }
  }

  private ttsActive(): boolean {
    return this.uiState.activeSessionState.kind === 'tts';
  }

  // demo: paused → layer opacity 0.86; playing → 1.0
  private ttsCursorLayerOpacity(): number {
    return this.uiState.readerTts.playing ? 1.0 : 0.86;
  }

  // demo ::before: playing → pulse 0.42↔0.82 (1400ms); paused → static 0.58
  private ttsCursorBarOpacity(): number {
    return this.uiState.readerTts.playing ? 0.82 : 0.58;
  }

  @Builder
  ReadingTextLayer() {
    Column() {
      Column() {
        if (this.readingHeadingTitle().length > 0) {
          Text(this.readingHeadingTitle())
            .fontSize(ReaderTypography.bodyTitleFontSize)
            .lineHeight(ReaderTypography.bodyTitleLineHeight)
            .fontWeight(800)
            .fontColor(this.uiState.readerTheme.ink)
            .fontFamily(this.readerFontFamily())
            .textAlign(TextAlign.Center)
            .width('100%')
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .margin({ bottom: ReaderTypography.bodyTitleBottom })
        }
        ForEach(this.contentParagraphs(), (paragraph: string) => {
          Text(this.readingParagraphText(paragraph))
            .fontSize(this.uiState.readerTypography.fontSize)
            .fontColor(this.uiState.readerTheme.ink)
            .fontFamily(this.readerFontFamily())
            .fontWeight(400)
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
      .alignItems(HorizontalAlign.Center)
    }
    .width('100%')
    .height('100%')
    .padding(this.bodyPadding())
    .alignItems(HorizontalAlign.Center)
    .backgroundColor('#00000000')
    .clip(true)
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
}
