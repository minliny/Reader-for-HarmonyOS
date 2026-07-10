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
import { SpacingTokens, RadiusTokens, ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { InteractionDebugAdapter } from '../adapters/InteractionDebugAdapter';
import { TokenAdapter } from '../adapters/TokenAdapter';
import { MotionAdapter } from '../adapters/MotionAdapter';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { FontTokens } from '../../contract/generated/TypeTokens';
import { ReaderThemeResolver, ReaderThemePalette } from '../tokens/ReaderThemeResolver';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { InteractionDebugBadge, InteractionDebugFrame } from './InteractionDebugComponents';
import { ReaderSelectionToolbar } from './ReaderSelectionToolbar';

// .fd-ir-background-layer: full-bleed paper bg (night theme -> paperNight).
@Component
export struct ReadingBackgroundLayer {
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @StorageProp('reader.readerTheme') readerTheme: string = 'paper';
  @StorageProp('reader.appThemeMode') appThemeMode: string = 'system';

  private palette(): ReaderThemePalette {
    return ReaderThemeResolver.palette(this.readerTheme, this.appThemeMode);
  }

  private textureLines(): number[] {
    const lines: number[] = [];
    const count = Math.ceil(Math.max(this.viewportHeight, ViewportAdapter.DEFAULT_HEIGHT) / 7) + 4;
    for (let line = 0; line < count; line++) {
      lines.push(line);
    }
    return lines;
  }

  private textureColor(): string {
    return this.palette().textureColor;
  }

  private textureOpacity(): number {
    return this.palette().textureOpacity;
  }

  // 夜读星点：11 颗固定相对坐标（视口百分比），近似 B 的
  // .fd-ir-background-layer::before 星点 radial-gradient 序列。
  private starPoints(): number[][] {
    const raw: number[][] = [
      [0.12, 0.08], [0.28, 0.15], [0.42, 0.06], [0.55, 0.12],
      [0.68, 0.18], [0.78, 0.09], [0.88, 0.14], [0.35, 0.22],
      [0.62, 0.25], [0.18, 0.28], [0.82, 0.28]
    ];
    return raw.map((p: number[]): number[] => [p[0] * this.viewportWidth, p[1] * this.viewportHeight]);
  }

  build() {
    Stack() {
      // 纸色 linear-gradient（B L2498）。
      Column()
        .width('100%')
        .height('100%')
        .backgroundColor(this.palette().paper)
        .linearGradient({
          angle: 180,
          colors: [
            [this.palette().paperBright, 0],
            [this.palette().paper, 100],
          ],
        })
      // 顶部高光：顶部中心柔光（B L2499 radial-gradient 顶部高光的 linearGradient 近似）。
      Column()
        .width('100%')
        .height('50%')
        .linearGradient({
          angle: 180,
          colors: [
            [this.palette().scheme === 'night' ? TokenAdapter.colorWithAlpha(this.palette().primary, 0.12) : TokenAdapter.colorWithAlpha(this.palette().paperBright, 0.5), 0],
            [TokenAdapter.colorWithAlpha(this.palette().paperBright, 0), 1.0],
          ],
        })
      // 四周暗角 vignette：中心透明，四周加深（B L2500 radial-gradient 暗角）。
      Column()
        .width('100%')
        .height('100%')
        .radialGradient({
          center: ['50%', '50%'],
          radius: '75%',
          colors: [
            [TokenAdapter.colorWithAlpha(this.palette().ink, 0), 0.55],
            [this.palette().scheme === 'night' ? TokenAdapter.colorWithAlpha(this.palette().ink, 0.45) : TokenAdapter.colorWithAlpha(this.palette().muted, 0.14), 1.0],
          ],
        })
      // 夜读极光 signature moment：顶部紫蓝渐变光晕（B L2504-2510 ::before 极光）。
      if (this.palette().scheme === 'night') {
        Column()
          .width('100%')
          .height('45%')
          .linearGradient({
            angle: 135,
            colors: [
              [TokenAdapter.colorWithAlpha(this.palette().primary, 0.18), 0],
              [TokenAdapter.colorWithAlpha(this.palette().primary, 0.12), 0.3],
              [TokenAdapter.colorWithAlpha(this.palette().primary, 0.06), 0.6],
              [TokenAdapter.colorWithAlpha(this.palette().ink, 0), 1.0],
            ],
          })
      }
      // 夜读星点：顶部随机分布的微小光点（B L2511-2521 星点序列）。
      if (this.palette().scheme === 'night') {
        ForEach(this.starPoints(), (pt: number[]) => {
          Circle()
            .width(2)
            .height(2)
            .fill(TokenAdapter.colorWithAlpha(this.palette().primary, 0.6))
            .position({ x: pt[0], y: pt[1] })
        }, (pt: number[], i: number) => `star-${i}`)
      }
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
  @StorageProp('reader.pageSpace.bottomMargin') bottomMargin: number = 16;
  @StorageProp('reader.pageSpace.paragraphIndent') paragraphIndent: number = 2;
  @StorageProp('reader.readerTheme') readerTheme: string = 'paper';
  @StorageProp('reader.appThemeMode') appThemeMode: string = 'system';

  private fallbackParagraphs: string[] = [
    '雨声在窗外连成一片，像无数细小的针，密密地刺在玻璃上，汇成一层朦胧的水幕，将城市的灯光晕成模糊的光团。',
    '他站在窗前，手里握着那封被雨水润湿的信。纸页边角微微卷起，字迹却依旧清晰，像某个迟到许久的答案终于抵达。',
    '这座城市在夜里显得格外安静，街道尽头偶尔有车灯掠过，又很快被雨幕吞没，只留下短暂而摇晃的光。',
    '他曾经以为自己已经习惯等待，习惯在没有回音的日子里把所有疑问折起来，塞进抽屉最深处。',
    '可真正看到信上那行字时，他才发现那些被压下去的情绪并没有消失，只是一直在暗处积蓄，等着这一刻重新涌上来。',
    '远处的灯光像被雾气揉碎，只剩下一团模糊的暖色。也许有些选择，从一开始就注定要在某个雨夜到来。'
  ];

  private inkColor(): string {
    return ReaderThemeResolver.palette(this.readerTheme, this.appThemeMode).ink;
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
        return FontTokens.kai;
      case 'fangsong':
        return FontTokens.fangsong;
      case 'mono':
        return FontTokens.mono;
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

  // ArkUI 实际渲染行高比 fontSize * lineHeightRatio 偏低约 12%
  //（dumpLayout 实测：4 行占 436px / density 3.5 = 124.5vp，每行 31vp，
  // 而估算 35.28vp）。分页估算若直接用 paragraphLineHeight 会高估段落高度，
  // 导致少放段落、底部留白过大。这里乘 0.88 系数补偿。
  private estimatedLineHeight(): number {
    return this.paragraphLineHeight() * 0.88;
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
    return lines * this.estimatedLineHeight() + this.paragraphGap;
  }

  private firstPageTitleReserve(): number {
    // 标题用 titleLineHeight 渲染，但估算分页时同样需要补偿实际渲染偏低。
    return this.titleLineHeight() * 0.88 + 24;
  }

  // Use real chapter content from the reducer when available; fall back to
  // fixture paragraphs so the reader page still renders in demo flows.
  private paragraphs(): string[] {
    if (this.chapterContent.length > 0) {
      return this.chapterContent;
    }
    return this.fallbackParagraphs;
  }

  // 二分法估算能放入 availableHeight 的最大字符数（参照 demo render-runtime.js fitSplitIndex）。
  // ArkUI 无 DOM 测量 API，用估算高度代替 scrollHeight。
  private splitParagraphToFit(text: string, availableHeight: number): number {
    if (availableHeight <= 0) return 0;
    let low = 1;
    let high = text.length;
    let best = 0;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = text.slice(0, middle).trim();
      if (candidate.length === 0) {
        low = middle + 1;
        continue;
      }
      const candidateHeight = this.estimatedParagraphHeight(candidate);
      if (candidateHeight <= availableHeight) {
        best = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return best;
  }

  private horizontalPages(): string[][] {
    // 参照 demo render-runtime.js updateReaderPagination 的分页+分割逻辑。
    // 当整段放不下时，用二分法分割段落，前半部分填满当前页，后半部分放下一页。
    const pages: string[][] = [];
    const source = this.paragraphs();
    let page: string[] = [];
    let used = this.firstPageTitleReserve();
    const pageHeight = Math.max(this.paragraphLineHeight() * 3, this.textLayerHeight());

    let blockIndex = 0;
    let offset = 0;
    while (blockIndex < source.length) {
      const sourceText = source[blockIndex];
      const remaining = offset === 0 ? sourceText : sourceText.slice(offset);
      if (remaining.trim().length === 0) {
        blockIndex += 1;
        offset = 0;
        continue;
      }

      const nextHeight = this.estimatedParagraphHeight(remaining);
      if (page.length === 0 || used + nextHeight <= pageHeight) {
        // 整段能放下
        page.push(remaining);
        used += nextHeight;
        blockIndex += 1;
        offset = 0;
      } else {
        // 整段放不下，尝试分割填满当前页剩余空间
        const available = Math.max(0, pageHeight - used);
        const splitIdx = this.splitParagraphToFit(remaining, available);
        if (splitIdx > 0) {
          page.push(remaining.slice(0, splitIdx).trim());
          pages.push(page);
          page = [];
          used = 0;
          offset += splitIdx;
          // 继续处理剩余部分（不递增 blockIndex）
        } else if (page.length > 0) {
          // 当前页有内容但分割失败（剩余空间太小），换页重试
          pages.push(page);
          page = [];
          used = 0;
        } else {
          // 当前页空且放不下，强制放1字符避免死循环
          const forced = remaining.slice(0, 1);
          page.push(forced);
          used += this.estimatedParagraphHeight(forced);
          offset += 1;
          blockIndex += 0; // 不递增，继续处理剩余
          // 但如果 forced 已用尽 remaining
          if (offset >= sourceText.length) {
            blockIndex += 1;
            offset = 0;
          }
        }
      }
    }
    if (page.length > 0) {
      pages.push(page);
    }
    return pages.length > 0 ? pages : [[]];
  }

  private textTopInset(): number {
    // 宽屏下顶部下限从 92 降至 48，增加每页可用文本高度，减少底部留白。
    const baseTop = this.wideReaderLayout() ? Math.max(this.topMargin, 48) : this.topMargin;
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
    // 底部仅依赖 safeAreaBottom + bottomMargin，避免宽屏下被强制抬高到 56+ 造成底部过远。
    return this.safeAreaBottom + this.bottomMargin;
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
              .padding({ right: pageIndex === this.horizontalPages().length - 1 ? 0 : SpacingTokens.lg })
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
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @StorageProp('reader.readerTheme') readerTheme: string = 'paper';
  @StorageProp('reader.appThemeMode') appThemeMode: string = 'system';
  @StorageProp('reader.activeSession') activeSession: string = '';

  private mutedColor(): string {
    return ReaderThemeResolver.palette(this.readerTheme, this.appThemeMode).muted;
  }

  // 四角绝对定位锚点：top-left / top-right / bottom-left / bottom-right
  private cornerLeft(): number {
    return 24;
  }
  private cornerRightX(): number {
    return this.viewportWidth - 24;
  }
  private cornerTopY(): number {
    return this.safeAreaTop + 26;
  }
  private cornerBottomY(): number {
    return this.viewportHeight - this.safeAreaBottom - 22;
  }
  private pageRightOffset(): number {
    return this.activeSession !== '' ? 100 : 0;
  }

  build() {
    Stack() {
      // top-left: book · chapter
      Text('长夜余火 · 第 32 章 雨夜')
        .fontSize(12)
        .fontColor(this.mutedColor())
        .fontFamily(ReaderTypography.sansFamily())
        .position({ x: this.cornerLeft(), y: this.cornerTopY() })
        .markAnchor({ x: 0, y: 0 })
      // top-right: time
      Text('10:30')
        .fontSize(12)
        .fontColor(this.mutedColor())
        .fontFamily(ReaderTypography.sansFamily())
        .position({ x: this.cornerRightX(), y: this.cornerTopY() })
        .markAnchor({ x: '100%', y: 0 })
      // bottom-left: progress
      Text('38%')
        .fontSize(12)
        .fontColor(this.mutedColor())
        .fontFamily(ReaderTypography.sansFamily())
        .position({ x: this.cornerLeft(), y: this.cornerBottomY() })
        .markAnchor({ x: 0, y: '100%' })
      // bottom-right: page label (capsule-aware right offset)
      Text('第 1 / 8 页')
        .fontSize(12)
        .fontColor(this.mutedColor())
        .fontFamily(ReaderTypography.sansFamily())
        .position({ x: this.cornerRightX() - this.pageRightOffset(), y: this.cornerBottomY() })
        .markAnchor({ x: '100%', y: '100%' })
      InteractionDebugFrame({ label: 'ImmersiveInfoLayer', tone: 'module' })
    }
    .width('100%')
    .height('100%')
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
              .onClick(() => ReaderUiStore.dispatch({ type: 'reader-exit' }))
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
              .onClick(() => ReaderUiStore.dispatch({ type: 'set-overlay', overlay: 'book-action' }))
              InteractionDebugBadge({ label: 'more', tone: 'action' })
            }
            .width(34)
            .height(42)
          }
          .width('100%')
          .height(54)
          .padding({ left: SpacingTokens.sm, right: SpacingTokens.sm })
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
      .padding({ left: SpacingTokens.cardPadding, right: SpacingTokens.cardPadding })
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
        .onClick(() => ReaderUiStore.dispatch({ type: 'reader-page-prev' }))
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
// Batch 1.4: interactive — play/pause control + click-to-expand + countdown.
@Component
export struct SessionCapsule {
  @StorageProp('reader.activeSession') activeSession: string = '';
  @StorageProp('reader.ttsSession.playback') ttsPlayback: string = 'idle';
  @StorageProp('reader.autoPageSession.playing') autoPagePlaying: boolean = false;
  @StorageProp('reader.autoPageSession.countdownSeconds') countdown: number = 0;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  private sessionLabel(): string {
    switch (this.activeSession) {
      case 'tts': return '朗读中';
      case 'auto-page': return '自动翻页';
      case 'reading': return '阅读中';
      default: return '';
    }
  }

  private isPlaying(): boolean {
    if (this.activeSession === 'tts') return this.ttsPlayback === 'playing';
    if (this.activeSession === 'auto-page') return this.autoPagePlaying;
    return false;
  }

  build() {
    if (this.activeSession !== '') {
      Stack({ alignContent: Alignment.BottomEnd }) {
        Row() {
          if (this.activeSession === 'tts') {
            Text('🔊').fontSize(11).margin({ right: 4 })
          }
          Circle().width(6).height(6)
            .fill(this.isPlaying() ? ColorTokens.primary : ColorTokens.muted)
            .margin({ right: 6 })
          Text(this.sessionLabel())
            .fontSize(11).fontWeight(700).fontColor(ColorTokens.controlInk)
          if (this.activeSession === 'auto-page' && this.countdown > 0) {
            Text(`${this.countdown}s`)
              .fontSize(11).fontColor(ColorTokens.accent)
              .margin({ left: 4 })
          }
          Text(this.isPlaying() ? '⏸' : '▶')
            .fontSize(12)
            .margin({ left: 6 })
            .onClick(() => {
              MotionAdapter.apply('reader.session.capsule.control.press-toggle', this.reducedMotion, () => {
                if (this.activeSession === 'tts') {
                  ReaderUiStore.dispatch({ type: 'tts-toggle' });
                } else if (this.activeSession === 'auto-page') {
                  ReaderUiStore.dispatch({ type: 'auto-page-toggle' });
                }
              });
            })
        }
        .padding({ left: SpacingTokens.xs, right: SpacingTokens.xs, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
        .borderRadius(RadiusTokens.control)
        .backgroundColor(DemoAliasTokens.surface)
        .border({ width: 1, color: ColorTokens.border })
        .onClick(() => {
          MotionAdapter.apply('reader.session.capsule.update', this.reducedMotion, () => {
            if (this.activeSession === 'tts') {
              ReaderUiStore.dispatch({ type: 'route-push', id: 'reader-full-tts' });
            } else if (this.activeSession === 'auto-page') {
              ReaderUiStore.dispatch({ type: 'route-push', id: 'reader-full-settings' });
            }
          });
        })
      }
      .width('100%')
      .height('100%')
      .padding({ right: SpacingTokens.lg, bottom: this.safeAreaBottom + SpacingTokens.lg })
      .hitTestBehavior(HitTestMode.Transparent)
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
    .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
  }
}

// ReaderBase — factored reading base (background + text + info + tap zones +
// session capsule). Composite used by every reader route's view-state body so
// the base is declared once in the contract, not repeated per overlay route.
// Theme is read from state (reader.readerTheme + reader.appThemeMode) by each
// child layer via ReaderThemeResolver — no prop wiring needed.
@Component
export struct ReaderBase {
  @StorageProp('reader.displayedRouteId') routeId: string = 'reader';

  private controlLayer(): boolean {
    return this.routeId !== 'immersive-reading' && this.routeId !== 'reader_content';
  }

  build() {
    Stack() {
      ReadingBackgroundLayer()
      ReadingTextFlow()
      if (this.controlLayer()) {
        ControlDismissZone()
        SessionCapsule()
      } else {
        ReadingInfoLayer()
        TapZones()
        SessionCapsule()
        ReaderSelectionToolbar()
      }
    }
    .width('100%')
    .height('100%')
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}
