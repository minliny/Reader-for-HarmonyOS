// ReaderComponents — reader immersive base + ReaderBase composite.
// Ported from frontend-demo (styles/00-foundation.css .fd-reading-surface /
// .fd-ir-reading-layer / .fd-ir-info-layer / .fd-immersive-hotzone).
//
// Batch 1: the legacy reader.overlay control dock + module sheets are retired
// — Reader overlays are routes now (route-push / route-pop), rendered via
// ViewStateRenderer(stack) from ViewStateTable. ReaderBase is the factored
// base composite used by every reader route's view-state body; theme='night'
// switches to night-theme tokens (step 3c-2 / D11).
//
// Immersive: each layer expands behind the system status / nav bars
// (expandSafeArea) so the reading paper owns the whole screen — correct under
// the night theme, not just the default paper. Layers then pad with the real
// device insets (safeAreaTop / safeAreaBottom from AppStorage via
// SafeAreaAdapter, written by EntryAbility) so the body text and the 4-corner
// info clear the bars. Each layer expandSafeArea on its own (the attribute does
// not propagate from the parent), which also disables implicit safe-area
// avoidance so the explicit padding is the single source of truth — no double
// inset.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { RadiusTokens, ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { InteractionDebugAdapter } from '../adapters/InteractionDebugAdapter';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { InteractionDebugBadge, InteractionDebugFrame } from './InteractionDebugComponents';

// .fd-ir-background-layer: full-bleed paper bg (night theme -> paperNight).
@Component
export struct ReadingBackgroundLayer {
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @Prop theme: string = 'paper';

  private textureLines(): number[] {
    const lines: number[] = [];
    const count = Math.ceil(Math.max(this.viewportHeight, ViewportAdapter.DEFAULT_HEIGHT) / 7) + 4;
    for (let line = 0; line < count; line++) {
      lines.push(line);
    }
    return lines;
  }

  private textureColor(): string {
    return this.theme === 'night' ? ColorTokens.controlInkNight : ColorTokens.muted;
  }

  private textureOpacity(): number {
    return this.theme === 'night' ? 0.026 : 0.034;
  }

  build() {
    Stack() {
      Column()
        .width('100%')
        .height('100%')
        .backgroundColor(this.theme === 'night' ? ColorTokens.paperNight : ColorTokens.paper)
        .linearGradient({
          angle: 180,
          colors: [
            [this.theme === 'night' ? ColorTokens.paperNight : ColorTokens.paperBright, 0],
            [this.theme === 'night' ? ColorTokens.paperNight : ColorTokens.paper, 100],
          ],
        })
      ForEach(this.textureLines(), (line: number) => {
        Row()
          .width('100%')
          .height(1)
          .backgroundColor(this.textureColor())
          .opacity(this.textureOpacity())
          .position({ x: 0, y: line * 7 })
      }, (line: number) => `${line}`)
      InteractionDebugFrame({ label: 'ReadingBackground', tone: 'module' })
    }
    .width('100%')
    .height('100%')
      .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
        [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}

// .fd-ir-reading-layer: text frame is driven by reader.pageSpace.*. h1 uses
//   reader-font-size + 5, centered. p uses reader.typography.* and
//   reader.pageSpace.paragraphIndent.
@Component
export struct ReadingTextFlow {
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @StorageProp('reader.displayedRouteId') routeId: string = 'reader';
  @StorageProp('reader.chapterContent') chapterContent: string[] = [];
  @StorageProp('reader.paginationMode') paginationMode: string = 'horizontal';
  @StorageProp('reader.typography.fontSize') fontSize: number = 18;
  @StorageProp('reader.typography.lineHeight') lineHeightRatio: number = 1.96;
  @StorageProp('reader.typography.paragraphGap') paragraphGap: number = 16;
  @StorageProp('reader.typography.letterSpacing') letterSpacing: number = 0;
  @StorageProp('reader.typography.fontFamily') fontFamily: string = 'serif';
  @StorageProp('reader.pageSpace.topMargin') topMargin: number = 72;
  @StorageProp('reader.pageSpace.sideMargin') sideMargin: number = 32;
  @StorageProp('reader.pageSpace.bottomMargin') bottomMargin: number = 48;
  @StorageProp('reader.pageSpace.paragraphIndent') paragraphIndent: number = 2;
  @Prop theme: string = 'paper';

  private fallbackParagraphs: string[] = [
    '雨声在窗外连成一片，像无数细小的针，密密地刺在玻璃上，汇成一层朦胧的水幕，将城市的灯光晕成模糊的光团。',
    '他站在窗前，手里握着那封被雨水润湿的信。纸页边角微微卷起，字迹却依旧清晰，像某个迟到许久的答案终于抵达。',
    '这座城市在夜里显得格外安静，街道尽头偶尔有车灯掠过，又很快被雨幕吞没，只留下短暂而摇晃的光。',
    '他曾经以为自己已经习惯等待，习惯在没有回音的日子里把所有疑问折起来，塞进抽屉最深处。',
    '可真正看到信上那行字时，他才发现那些被压下去的情绪并没有消失，只是一直在暗处积蓄，等着这一刻重新涌上来。',
    '远处的灯光像被雾气揉碎，只剩下一团模糊的暖色。也许有些选择，从一开始就注定要在某个雨夜到来。'
  ];

  private inkColor(): string {
    return this.theme === 'night' ? ColorTokens.inkNight : ColorTokens.ink;
  }

  private controlLayer(): boolean {
    return this.routeId !== 'immersive-reading' && this.routeId !== 'reader_content';
  }

  private wideControlDock(): boolean {
    return this.controlLayer() && ViewportAdapter.isWide(this.viewportWidth, this.viewportHeight);
  }

  private wideReaderLayout(): boolean {
    return ViewportAdapter.isWide(this.viewportWidth, this.viewportHeight);
  }

  private title(): string {
    return '雨夜';
  }

  private readerFontFamily(): string {
    switch (this.fontFamily) {
      case 'system':
        return ReaderTypography.sansFamily();
      case 'sans':
        return ReaderTypography.sansFamily();
      case 'kai':
        return '"Kaiti SC", "KaiTi", serif';
      case 'fangsong':
        return '"FangSong", "STFangsong", serif';
      case 'mono':
        return '"SFMono-Regular", "HarmonyOS Sans Mono", monospace';
      case 'serif':
      default:
        return ReaderTypography.serifFamily();
    }
  }

  private titleFontSize(): number {
    return this.fontSize + 5;
  }

  private titleLineHeight(): number {
    return this.titleFontSize() * 1.25;
  }

  private paragraphLineHeight(): number {
    return this.fontSize * this.lineHeightRatio;
  }

  private paragraphIndentValue(): number {
    return this.paragraphIndent * this.fontSize;
  }

  private textLayerHeight(): number {
    return Math.max(0, this.viewportHeight - this.textTopInset() - this.textBottomInset());
  }

  private estimatedCharsPerLine(): number {
    const charAdvance = Math.max(1, this.fontSize + this.letterSpacing);
    return Math.max(8, Math.floor(this.textLayerWidth() / charAdvance));
  }

  private estimatedParagraphHeight(text: string): number {
    const lines = Math.max(1, Math.ceil(text.length / this.estimatedCharsPerLine()));
    return lines * this.paragraphLineHeight() + this.paragraphGap;
  }

  private firstPageTitleReserve(): number {
    return this.titleLineHeight() + 24;
  }

  // Use real chapter content from the reducer when available; fall back to
  // fixture paragraphs so the reader page still renders in demo flows.
  private paragraphs(): string[] {
    if (this.chapterContent.length > 0) {
      return this.chapterContent;
    }
    return this.fallbackParagraphs;
  }

  private horizontalPages(): string[][] {
    const pages: string[][] = [];
    const source = this.paragraphs();
    let page: string[] = [];
    let used = this.firstPageTitleReserve();
    const pageHeight = Math.max(this.paragraphLineHeight() * 3, this.textLayerHeight());
    for (let index = 0; index < source.length; index++) {
      const paragraph = source[index];
      const nextHeight = this.estimatedParagraphHeight(paragraph);
      if (page.length > 0 && used + nextHeight > pageHeight) {
        pages.push(page);
        page = [];
        used = 0;
      }
      page.push(paragraph);
      used += nextHeight;
    }
    if (page.length > 0) {
      pages.push(page);
    }
    return pages.length > 0 ? pages : [[]];
  }

  private textTopInset(): number {
    const baseTop = this.wideReaderLayout() ? Math.max(this.topMargin, 92) : this.topMargin;
    return this.safeAreaTop + baseTop;
  }

  private textLeftInset(): number {
    return this.wideReaderLayout() ? Math.max(this.sideMargin, 44) : this.sideMargin;
  }

  private textRightInset(): number {
    if (this.wideControlDock()) {
      return 400;
    }
    return this.wideReaderLayout() ? Math.max(this.sideMargin, 44) : this.sideMargin;
  }

  private textBottomInset(): number {
    const baseBottom = this.wideReaderLayout() ? Math.max(this.bottomMargin, 56) : this.bottomMargin;
    return this.safeAreaBottom + baseBottom;
  }

  private textLayerWidth(): number {
    return Math.max(0, this.viewportWidth - this.textLeftInset() - this.textRightInset());
  }

  private verticalReading(): boolean {
    return this.paginationMode === 'vertical';
  }

  @Builder ReaderParagraphs(paragraphs: string[], pageIndex: number) {
    Column() {
      if (pageIndex === 0) {
        Text(this.title())
          .fontSize(this.titleFontSize())
          .fontWeight(700)
          .fontColor(this.inkColor())
          .fontFamily(this.readerFontFamily())
          .lineHeight(this.titleLineHeight())
          .textAlign(TextAlign.Center)
          .width('100%')
          .margin({ bottom: 24 })
      }
      ForEach(paragraphs, (p: string, i: number) => {
        Text(p)
          .fontSize(this.fontSize)
          .fontColor(this.inkColor())
          .fontFamily(this.readerFontFamily())
          .lineHeight(this.paragraphLineHeight())
          .letterSpacing(this.letterSpacing)
          .textIndent(this.paragraphIndentValue())
          .textAlign(TextAlign.Start)
          .margin({ bottom: this.paragraphGap })
      }, (p: string, i: number) => `${pageIndex}-${i}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  build() {
    Stack() {
      if (this.verticalReading()) {
        Scroll() {
          this.ReaderParagraphs(this.paragraphs(), 0)
        }
        .width('100%')
        .height('100%')
        .scrollBar(BarState.Off)
      } else {
        Scroll() {
          Row() {
            ForEach(this.horizontalPages(), (page: string[], pageIndex: number) => {
              Column() {
                this.ReaderParagraphs(page, pageIndex)
              }
              .width(this.textLayerWidth())
              .height('100%')
              .padding({ right: pageIndex === this.horizontalPages().length - 1 ? 0 : 24 })
            }, (page: string[], pageIndex: number) => `${pageIndex}`)
          }
          .height('100%')
        }
        .width('100%')
        .height('100%')
        .scrollable(ScrollDirection.Horizontal)
        .scrollBar(BarState.Off)
      }
      InteractionDebugFrame({ label: this.verticalReading() ? 'ReadingTextLayer:V' : 'ReadingTextLayer:H', tone: 'module' })
    }
    .width('100%')
    .height('100%')
    .padding({
      top: this.textTopInset(),
      left: this.textLeftInset(),
      right: this.textRightInset(),
      bottom: this.textBottomInset(),
    })
    .clip(true)
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}

// .fd-ir-info-layer: inset 26 24 22, 4-corner overlay (top-left book·chapter,
//   top-right time, bottom-left progress, bottom-right page label). 12px sans
//   muted. pointer-events none (taps pass through to TapZones).
@Component
export struct ReadingInfoLayer {
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @Prop theme: string = 'paper';

  private mutedColor(): string {
    return this.theme === 'night' ? ColorTokens.controlInkNight : ColorTokens.muted;
  }

  build() {
    Stack() {
      Column() {
        Row() {
          Text('长夜余火 · 第 32 章 雨夜')
            .fontSize(12)
            .fontColor(this.mutedColor())
            .fontFamily(ReaderTypography.sansFamily())
            .layoutWeight(1)
          Text('10:30')
            .fontSize(12)
            .fontColor(this.mutedColor())
            .fontFamily(ReaderTypography.sansFamily())
        }
        .width('100%')
        Blank()
        Row() {
          Text('38%')
            .fontSize(12)
            .fontColor(this.mutedColor())
            .fontFamily(ReaderTypography.sansFamily())
            .layoutWeight(1)
          Text('第 1 / 8 页')
            .fontSize(12)
            .fontColor(this.mutedColor())
            .fontFamily(ReaderTypography.sansFamily())
        }
        .width('100%')
      }
      .width('100%')
      .height('100%')
      InteractionDebugFrame({ label: 'ImmersiveInfoLayer', tone: 'module' })
    }
    .width('100%')
    .height('100%')
    .padding({ top: this.safeAreaTop + 26, left: 24, right: 24, bottom: this.safeAreaBottom + 22 })
    .hitTestBehavior(HitTestMode.None)
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}

// .fd-reader-top: top control chrome shown on reader/control-layer and overlay routes.
// Live demo shape: one floating rounded bar with back, book title/source line,
// source-switch action, and more. The immersive routes keep ReadingInfoLayer.
@Component
export struct ReaderTopArea {
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;

  build() {
    Stack({ alignContent: Alignment.Top }) {
      Column() {
        Stack({ alignContent: Alignment.TopStart }) {
          Row({ space: 8 }) {
            Stack({ alignContent: Alignment.TopStart }) {
              Row() {
                Image($r('app.media.reader_icon_back_dark'))
                  .width(28)
                  .height(28)
              }
              .width(40)
              .height(42)
              .justifyContent(FlexAlign.Start)
              .alignItems(VerticalAlign.Center)
              .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
              InteractionDebugBadge({ label: 'back', tone: 'action', offsetTop: 22 })
            }
            .width(40)
            .height(42)

            Stack({ alignContent: Alignment.TopStart }) {
              Column({ space: 5 }) {
                Text('长夜余火')
                  .fontSize(16)
                  .fontWeight(700)
                  .fontColor(ColorTokens.controlInk)
                  .fontFamily(ReaderTypography.sansFamily())
                  .maxLines(2)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
                Text('第 32 章 雨夜 · 优书网')
                  .fontSize(12)
                  .fontColor(ColorTokens.muted)
                  .fontFamily(ReaderTypography.sansFamily())
                  .maxLines(2)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
              }
              .width('100%')
              .height(42)
              .justifyContent(FlexAlign.Center)
              .alignItems(HorizontalAlign.Start)
            }
            .layoutWeight(1)
            .height(42)

            Stack({ alignContent: Alignment.TopStart }) {
              Row({ space: 4 }) {
                Image($r('app.media.reader_icon_source_switch_dark'))
                  .width(20)
                  .height(20)
                Text('换源')
                  .fontSize(12)
                  .fontWeight(800)
                  .fontColor(ColorTokens.controlInk)
                  .fontFamily(ReaderTypography.sansFamily())
              }
              .width(62)
              .height(42)
              .justifyContent(FlexAlign.Center)
              .alignItems(VerticalAlign.Center)
              .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'source-switch' }))
              InteractionDebugBadge({ label: 'source', tone: 'action' })
            }
            .width(62)
            .height(42)

            Stack({ alignContent: Alignment.TopStart }) {
              Row() {
                Image($r('app.media.reader_icon_more_dark')).width(24).height(24)
              }
              .width(34)
              .height(42)
              .justifyContent(FlexAlign.Center)
              .alignItems(VerticalAlign.Center)
              InteractionDebugBadge({ label: 'more', tone: 'action' })
            }
            .width(34)
            .height(42)
          }
          .width('100%')
          .height(54)
          .padding({ left: 12, right: 12 })
          .border({ width: 1, color: ColorTokens.border })
          .borderRadius(DemoAliasTokens.radiusXl)
          .backgroundColor(DemoAliasTokens.surface)
          .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
          InteractionDebugFrame({ label: 'ReaderTopBar', tone: 'module' })
        }
        .width('100%')
        .height(54)
      }
      .width('100%')
      .padding({ left: 14, right: 14 })
      .margin({ top: this.safeAreaTop + 18 })
    }
    .width('100%')
    .height('100%')
  }
}

// .fd-immersive-hotzone: prev 26% / center 48% / next 26%. Center opens the
// live reader control layer (route-push reader); prev pops back.
@Component
export struct TapZones {
  @StorageProp(InteractionDebugAdapter.K_VISIBLE) interactionDebugVisible: boolean = InteractionDebugAdapter.DEFAULT_VISIBLE;

  private zoneOpacity(): number {
    return this.interactionDebugVisible ? 0.42 : 0.01;
  }

  private zoneColor(kind: string): string {
    if (kind === 'center') return ColorTokens.primary;
    if (kind === 'prev') return ColorTokens.accent;
    return ColorTokens.primaryDark;
  }

  @Builder zoneLabel(label: string) {
    if (this.interactionDebugVisible) {
      Text(label)
        .fontSize(12)
        .fontWeight(800)
        .fontColor(ColorTokens.paper)
        .fontFamily(ReaderTypography.sansFamily())
        .textAlign(TextAlign.Center)
        .maxLines(2)
    }
  }

  build() {
    Row() {
      Column() {
        this.zoneLabel('PrevPageHotzone')
      }
      .width('26%')
      .height('100%')
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .backgroundColor(this.zoneColor('prev'))
      .opacity(this.zoneOpacity())
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      Column() {
        this.zoneLabel('ControlLayerHotzone')
      }
      .width('48%')
      .height('100%')
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .backgroundColor(this.zoneColor('center'))
      .opacity(this.zoneOpacity())
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'reader' }))
      Column() {
        this.zoneLabel('NextPageHotzone')
      }
      .width('26%')
      .height('100%')
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .backgroundColor(this.zoneColor('next'))
      .opacity(this.zoneOpacity())
    }
    .width('100%')
    .height('100%')
    .zIndex(ZIndexTokens.dialog)
  }
}

// Session capsule — reflects reader.activeSession (reading / tts / auto-page).
@Component
export struct SessionCapsule {
  @StorageProp('reader.activeSession') activeSession: string = '';
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;

  private sessionLabel(): string {
    switch (this.activeSession) {
      case 'tts': return '朗读中';
      case 'auto-page': return '自动翻页';
      case 'reading': return '阅读中';
      default: return '';
    }
  }

  build() {
    if (this.activeSession !== '') {
      Row() {
        Circle().width(6).height(6).fill(ColorTokens.primary)
        Text(this.sessionLabel())
          .fontSize(11).fontWeight(700).fontColor(ColorTokens.controlInk)
          .margin({ left: 6 })
      }
      .padding({ left: 10, right: 10, top: 5, bottom: 5 })
      .borderRadius(RadiusTokens.control)
      .backgroundColor(DemoAliasTokens.surface)
      .border({ width: 1, color: ColorTokens.border })
      .position({ x: 24, y: this.safeAreaTop + 14 })
    }
  }
}

@Component
struct ControlDismissZone {
  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      InteractionDebugFrame({ label: 'ControlDismissZone', tone: 'module' })
    }
    .width('100%')
    .height('100%')
    .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'immersive-reading' }))
  }
}

// ReaderBase — factored reading base (background + text + info + tap zones +
// session capsule). Composite used by every reader route's view-state body so
// the base is declared once in the contract, not repeated per overlay route.
// theme prop: 'paper' (default) | 'night' (night-theme tokens — step 3c-2).
@Component
export struct ReaderBase {
  @Prop theme: string = 'paper';
  @StorageProp('reader.displayedRouteId') routeId: string = 'reader';

  private controlLayer(): boolean {
    return this.routeId !== 'immersive-reading' && this.routeId !== 'reader_content';
  }

  build() {
    Stack() {
      ReadingBackgroundLayer({ theme: this.theme })
      ReadingTextFlow({ theme: this.theme })
      if (this.controlLayer()) {
        ControlDismissZone()
      } else {
        ReadingInfoLayer({ theme: this.theme })
        TapZones()
        SessionCapsule()
      }
    }
    .width('100%')
    .height('100%')
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}
