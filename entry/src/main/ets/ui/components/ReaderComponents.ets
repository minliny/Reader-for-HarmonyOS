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
import { BookDetail, CoreReaderCanonicalLocation, ReaderContentIdentity } from '../store/ReaderUiState';
import { ViewStateExplicitBinding } from '../../contract/generated/ViewStateTable';
import {
  ReaderUIScreenGraphTapZoneAdapter,
  ReaderUIScreenGraphTapZoneTarget,
} from '../router/ReaderUIScreenGraphTapZoneAdapter';
import { InteractionDebugBadge, InteractionDebugFrame } from './InteractionDebugComponents';
import { ReaderSelectionToolbar } from './ReaderSelectionToolbar';

interface ReaderPageFragment {
  text: string;
  sourceOffset: number;
  contentIdentity: ReaderContentIdentity;
}

interface ReaderPageModel {
  fragments: ReaderPageFragment[];
  chapterOffset: number;
  chapterProgress: number;
  contentIdentity: ReaderContentIdentity | null;
}

// Measurements are kept only for the vertical Scroll surface. `sourceOffset`
// remains a Unicode-scalar Core anchor, while `top`/`height` come from ArkUI's
// actual laid-out Text nodes rather than a page or line-count estimate.
interface ReaderVerticalFragmentLayout {
  sourceOffset: number;
  top: number;
  height: number;
  contentIdentity: ReaderContentIdentity;
}

// .fd-ir-background-layer: full-bleed paper bg (night theme -> paperNight).
@Component
export struct ReadingBackgroundLayer {
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @StorageProp('reader.readerTheme') readerTheme: string = 'paper';
  @StorageProp('reader.appThemeMode') appThemeMode: string = 'system';
  @StorageProp('reader.theme.colorMode') systemColorMode: string = 'light';
  @Prop theme: string = '';

  private palette(): ReaderThemePalette {
    const resolvedTheme: string = this.theme !== '' ? this.theme : this.readerTheme;
    return ReaderThemeResolver.palette(resolvedTheme, this.appThemeMode);
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
  @StorageProp(SafeAreaAdapter.K_TOP) @Watch('onPaginationInputChange') safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) @Watch('onPaginationInputChange') safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp(SafeAreaAdapter.K_START) @Watch('onPaginationInputChange') safeAreaStart: number = SafeAreaAdapter.DEFAULT_START;
  @StorageProp(SafeAreaAdapter.K_END) @Watch('onPaginationInputChange') safeAreaEnd: number = SafeAreaAdapter.DEFAULT_END;
  @StorageProp(ViewportAdapter.K_WIDTH) @Watch('onPaginationInputChange') viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) @Watch('onPaginationInputChange') viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @StorageProp('reader.displayedRouteId') @Watch('onPaginationInputChange') routeId: string = 'reader';
  @StorageProp('reader.chapterContent') @Watch('onPaginationInputChange') chapterContent: string[] = [];
  @StorageProp('reader.currentBook') @Watch('onPaginationInputChange') currentBook: BookDetail | null = null;
  @StorageProp('reader.currentChapterTitle') @Watch('onPaginationInputChange') currentChapterTitle: string = '';
  @StorageProp(ReaderUiStore.K_ACTIVE_READER_CONTENT_IDENTITY) @Watch('onPaginationInputChange') activeReaderContentIdentity: ReaderContentIdentity | null = null;
  @StorageProp('reader.loading') @Watch('onPaginationInputChange') loading: boolean = false;
  @StorageProp('reader.paginationMode') @Watch('onPaginationInputChange') paginationMode: string = 'horizontal';
  @StorageProp('reader.pageIndex') @Watch('onReaderPageIndexChange') readerPageIndex: number = 0;
  @StorageProp('reader.pageCount') readerPageCount: number = 1;
  @StorageProp('reader.readerSettingOptions.pageAnimation') pageAnimation: string = 'slide';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @StorageProp(ReaderUiStore.K_READER_CHAPTER_OFFSET) readerChapterOffset: number = 0;
  @StorageProp(ReaderUiStore.K_READER_CHAPTER_PROGRESS) readerChapterProgress: number = 0;
  @StorageProp('reader.typography.fontSize') @Watch('onPaginationInputChange') fontSize: number = 18;
  @StorageProp('reader.typography.lineHeight') @Watch('onPaginationInputChange') lineHeightRatio: number = 1.96;
  @StorageProp('reader.typography.paragraphGap') @Watch('onPaginationInputChange') paragraphGap: number = 16;
  @StorageProp('reader.typography.letterSpacing') @Watch('onPaginationInputChange') letterSpacing: number = 0;
  @StorageProp('reader.typography.fontFamily') @Watch('onPaginationInputChange') fontFamily: string = 'serif';
  @StorageProp('reader.pageSpace.topMargin') @Watch('onPaginationInputChange') topMargin: number = 72;
  @StorageProp('reader.pageSpace.sideMargin') @Watch('onPaginationInputChange') sideMargin: number = 32;
  @StorageProp('reader.pageSpace.paragraphIndent') @Watch('onPaginationInputChange') paragraphIndent: number = 2;
  @StorageProp(ReaderUiStore.K_CANONICAL_READER_LOCATION) @Watch('onCanonicalReaderLocationChange') canonicalLocation: CoreReaderCanonicalLocation | null = null;
  @StorageProp(ReaderUiStore.K_PLAYBACK_PAGE_CORRELATION) playbackPageCorrelation: string = '';
  @StorageProp(ReaderUiStore.K_PLAYBACK_PAGE_DIRECTION) playbackPageDirection: string = '';
  @StorageProp('reader.readerTheme') readerTheme: string = 'paper';
  @StorageProp('reader.appThemeMode') appThemeMode: string = 'system';
  @StorageProp('reader.theme.colorMode') systemColorMode: string = 'light';
  @State private horizontalPageData: ReaderPageModel[] = [{ fragments: [], chapterOffset: 0, chapterProgress: 0, contentIdentity: null }];
  @State private verticalFragmentLayouts: ReaderVerticalFragmentLayout[] = [];
  @State private pageTurnOffset: number = 0;
  @State private pageTurnOpacity: number = 1;
  private verticalScroller: Scroller = new Scroller();
  private lastVerticalScrollOffset: number = 0;
  private pendingVerticalRestoreOffset: number = -1;
  private suppressNextHorizontalAnchor: boolean = false;
  private ignoreNextVerticalScrollAnchor: boolean = false;
  private restoredCanonicalLocationKey: string = '';
  // Layout changes must reflow from the reader's current measured anchor,
  // not from the initial canonical restore location. The latter intentionally
  // stays stable while the reader scrolls, so it can be older than the live
  // offset by many paragraphs.
  private pendingReflowAnchorOffset: number = -1;
  private pendingReflowAnchorProgress: number = 0;
  private lastAnimatedPageIndex: number = 0;

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
    if (this.currentChapterTitle.length > 0) return this.currentChapterTitle;
    if (this.currentBook !== null && this.currentBook.latestChapter.length > 0) return this.currentBook.latestChapter;
    return '';
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
      case 'sourceSerif':
        return ReaderTypography.serifFamily();
      case 'lxgw':
        return FontTokens.kai;
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

  private fallbackCharsPerLine(): number {
    const charAdvance = Math.max(1, this.fontSize + this.letterSpacing);
    return Math.max(8, Math.floor(this.textLayerWidth() / charAdvance));
  }

  private fallbackParagraphHeight(text: string): number {
    const charAdvance = Math.max(1, this.fontSize + this.letterSpacing);
    const lineCapacity = this.fallbackCharsPerLine();
    const firstLineCapacity = Math.max(1,
      Math.floor((this.textLayerWidth() - this.paragraphIndentValue()) / charAdvance));
    const remaining = Math.max(0, text.length - firstLineCapacity);
    const lines = 1 + Math.ceil(remaining / lineCapacity);
    return lines * this.paragraphLineHeight() + this.paragraphGap;
  }

  // Match the demo's DOM scrollHeight pagination with ArkUI's native text
  // measurement. The previous 0.88 line-height correction was calibrated
  // against an obsolete font/layout and under-counted the current Noto Serif
  // rendering by roughly one line per long paragraph.
  private measuredParagraphHeight(text: string): number {
    try {
      const size = this.getUIContext().getMeasureUtils().measureTextSize({
        textContent: text,
        constraintWidth: `${this.textLayerWidth()}vp`,
        fontSize: `${this.fontSize}fp`,
        fontFamily: this.readerFontFamily(),
        letterSpacing: `${this.letterSpacing}fp`,
        lineHeight: `${this.paragraphLineHeight()}fp`,
        textIndent: `${this.paragraphIndentValue()}vp`,
        textAlign: TextAlign.Start,
        wordBreak: WordBreak.NORMAL,
      });
      const measuredHeight = this.getUIContext().px2vp(Number(size.height));
      if (Number.isFinite(measuredHeight) && measuredHeight > 0) {
        return measuredHeight + this.paragraphGap;
      }
    } catch (e) {
      // The deterministic fallback below keeps pagination safe during the first
      // frame if UIContext measurement is temporarily unavailable.
    }
    return this.fallbackParagraphHeight(text);
  }

  private firstPageTitleReserve(): number {
    return this.title().length > 0 ? this.titleLineHeight() + SpacingTokens.lg : 0;
  }

  // A reader surface may only draw paragraphs that came from the selected
  // Core book.  A route with no book or an empty Core result is a state, not a
  // permission to render fixture prose.
  private paragraphs(): string[] {
    return this.currentBook === null ? [] : this.chapterContent;
  }

  private hasReadableContent(): boolean {
    if (this.currentBook === null) return false;
    for (let i = 0; i < this.chapterContent.length; i++) {
      if (this.chapterContent[i].trim().length > 0) return true;
    }
    return false;
  }

  private emptyTitle(): string {
    if (this.currentBook === null) return '尚未选择书籍';
    return this.loading ? '正在加载章节正文…' : '暂无可显示正文';
  }

  private emptyMessage(): string {
    if (this.currentBook === null) return '请从书架、搜索或发现结果选择一本书后开始阅读。';
    return this.loading ? 'Core 正在读取所选章节。' : 'Core 未返回本章正文。';
  }

  private readerSplitIndex(text: string, bestIndex: number): number {
    if (bestIndex >= text.length) return text.length;
    const start = Math.max(1, bestIndex - 12);
    const punctuation = '，。！？；：、,.!?;:';
    for (let index = bestIndex; index >= start; index -= 1) {
      if (punctuation.includes(text.charAt(index - 1))) return this.scalarBoundaryBefore(text, index);
    }
    return Math.max(1, this.scalarBoundaryBefore(text, bestIndex));
  }

  // Pagination measures strings in UTF-16 code units, while Core locations
  // count Unicode scalars. Never split between a high/low-surrogate pair or a
  // later page's Core offset would drift for every supplementary character.
  private scalarBoundaryBefore(text: string, index: number): number {
    let boundary = Math.max(0, Math.min(text.length, Math.floor(index)));
    if (boundary > 0 && boundary < text.length) {
      const previous = text.charCodeAt(boundary - 1);
      const current = text.charCodeAt(boundary);
      if (previous >= 0xD800 && previous <= 0xDBFF && current >= 0xDC00 && current <= 0xDFFF) {
        boundary -= 1;
      }
    }
    return boundary;
  }

  private firstScalarEnd(text: string): number {
    if (text.length === 0) return 0;
    const first = text.charCodeAt(0);
    if (first >= 0xD800 && first <= 0xDBFF && text.length > 1) {
      const second = text.charCodeAt(1);
      if (second >= 0xDC00 && second <= 0xDFFF) return 2;
    }
    return 1;
  }

  // Binary-search the largest fragment that the same ArkUI text engine can fit,
  // then prefer a nearby punctuation boundary like the Reader UI demo.
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
      const candidateHeight = this.measuredParagraphHeight(candidate);
      if (candidateHeight <= availableHeight) {
        best = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return best > 0 ? this.readerSplitIndex(text, best) : 0;
  }

  private appendPageFragment(page: ReaderPageFragment[], rawText: string,
    sourceOffset: number, contentIdentity: ReaderContentIdentity): void {
    let start = 0;
    let end = rawText.length;
    while (start < end && rawText.charAt(start).trim().length === 0) start += 1;
    while (end > start && rawText.charAt(end - 1).trim().length === 0) end -= 1;
    if (start >= end) return;
    page.push({
      text: rawText.slice(start, end),
      sourceOffset: sourceOffset + this.sourceCharacterCount(rawText.slice(0, start)),
      contentIdentity: contentIdentity,
    });
  }

  // Core chapter offsets count Unicode scalar values. JavaScript string
  // indices count UTF-16 code units, so supplementary characters must not
  // shift every later page anchor by one.
  private sourceCharacterCount(text: string): number {
    let count = 0;
    for (let index = 0; index < text.length; index += 1) {
      const first = text.charCodeAt(index);
      if (first >= 0xD800 && first <= 0xDBFF && index + 1 < text.length) {
        const second = text.charCodeAt(index + 1);
        if (second >= 0xDC00 && second <= 0xDFFF) index += 1;
      }
      count += 1;
    }
    return count;
  }

  private pageModel(fragments: ReaderPageFragment[], sourceLength: number,
    contentIdentity: ReaderContentIdentity | null): ReaderPageModel {
    const offset = fragments.length > 0 ? fragments[0].sourceOffset : 0;
    return {
      fragments: fragments,
      chapterOffset: offset,
      chapterProgress: sourceLength > 0 ? Math.min(1, Math.max(0, offset / sourceLength)) : 0,
      contentIdentity: contentIdentity,
    };
  }

  private horizontalPages(): ReaderPageModel[] {
    // 参照 demo render-runtime.js updateReaderPagination 的分页+分割逻辑。
    // 当整段放不下时，用二分法分割段落，前半部分填满当前页，后半部分放下一页。
    const pages: ReaderPageModel[] = [];
    const identity = this.activeReaderContentIdentity;
    if (identity === null) return [{ fragments: [], chapterOffset: 0, chapterProgress: 0, contentIdentity: null }];
    const source = this.paragraphs();
    const paragraphOffsets: number[] = [];
    let sourceLength = 0;
    for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
      paragraphOffsets.push(sourceLength);
      sourceLength += this.sourceCharacterCount(source[sourceIndex]);
      if (sourceIndex + 1 < source.length) sourceLength += 1;
    }
    let page: ReaderPageFragment[] = [];
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

      const nextHeight = this.measuredParagraphHeight(remaining);
      if (page.length === 0 || used + nextHeight <= pageHeight) {
        // 整段能放下
        this.appendPageFragment(page, remaining, paragraphOffsets[blockIndex] +
          this.sourceCharacterCount(sourceText.slice(0, offset)), identity);
        used += nextHeight;
        blockIndex += 1;
        offset = 0;
      } else {
        // 整段放不下，尝试分割填满当前页剩余空间
        const available = Math.max(0, pageHeight - used);
        const splitIdx = this.splitParagraphToFit(remaining, available);
        if (splitIdx > 0) {
          this.appendPageFragment(
            page, remaining.slice(0, splitIdx), paragraphOffsets[blockIndex] +
              this.sourceCharacterCount(sourceText.slice(0, offset)),
            identity,
          );
          pages.push(this.pageModel(page, sourceLength, identity));
          page = [];
          used = 0;
          offset += splitIdx;
          // 继续处理剩余部分（不递增 blockIndex）
        } else if (page.length > 0) {
          // 当前页有内容但分割失败（剩余空间太小），换页重试
          pages.push(this.pageModel(page, sourceLength, identity));
          page = [];
          used = 0;
        } else {
          // 当前页空且放不下，强制放1字符避免死循环
          const forcedLength = this.firstScalarEnd(remaining);
          const forced = remaining.slice(0, forcedLength);
          this.appendPageFragment(page, forced, paragraphOffsets[blockIndex] +
            this.sourceCharacterCount(sourceText.slice(0, offset)), identity);
          used += this.measuredParagraphHeight(forced);
          offset += forcedLength;
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
      pages.push(this.pageModel(page, sourceLength, identity));
    }
    return pages.length > 0 ? pages : [this.pageModel([], sourceLength, identity)];
  }

  aboutToAppear(): void {
    this.lastAnimatedPageIndex = this.readerPageIndex;
    this.refreshPagination();
  }

  private onPaginationInputChange(): void {
    this.captureLiveReflowAnchor();
    // A viewport/font/mode change creates new page boundaries. Do not let a
    // prior canonical restore key suppress restoration in the new layout.
    this.restoredCanonicalLocationKey = '';
    this.refreshPagination();
  }

  private captureLiveReflowAnchor(): void {
    if (!this.hasReadableContent() || !Number.isFinite(this.readerChapterOffset) ||
      this.readerChapterOffset < 0 || !Number.isFinite(this.readerChapterProgress)) {
      return;
    }
    this.pendingReflowAnchorOffset = Math.floor(this.readerChapterOffset);
    this.pendingReflowAnchorProgress = Math.max(0, Math.min(1, this.readerChapterProgress));
  }

  private refreshPagination(): void {
    let pages: ReaderPageModel[];
    if (this.verticalReading()) {
      const fragments: ReaderPageFragment[] = [];
      const identity = this.activeReaderContentIdentity;
      let offset = 0;
      const paragraphs = this.paragraphs();
      if (identity !== null) {
        for (let index = 0; index < paragraphs.length; index += 1) {
          fragments.push({ text: paragraphs[index], sourceOffset: offset, contentIdentity: identity });
          offset += this.sourceCharacterCount(paragraphs[index]) + (index + 1 < paragraphs.length ? 1 : 0);
        }
      }
      pages = [this.pageModel(fragments, offset, identity)];
    } else {
      pages = this.horizontalPages();
    }
    this.horizontalPageData = pages.length > 0 ? pages : [this.pageModel([], 0, null)];
    if (this.verticalReading()) {
      this.verticalFragmentLayouts = [];
      this.lastVerticalScrollOffset = 0;
    }
    const nextCount = this.verticalReading() ? 1 : this.horizontalPageData.length;
    const state = ReaderUiStore.snapshot();
    if (state.readerPageCount !== nextCount) {
      ReaderUiStore.dispatch({ type: 'set-reader-page-count', readerPageCount: nextCount });
    }
    if (!this.applyLiveReflowAnchor() && !this.applyCanonicalLocationRestore()) {
      this.publishVisibleHorizontalAnchor();
    }
  }

  private onReaderPageIndexChange(): void {
    const previousIndex = this.lastAnimatedPageIndex;
    this.lastAnimatedPageIndex = this.readerPageIndex;
    if (this.suppressNextHorizontalAnchor) {
      this.suppressNextHorizontalAnchor = false;
      this.resetPageTurnVisualState();
      return;
    }
    this.animatePageTurn(previousIndex);
    this.publishVisibleHorizontalAnchor();
  }

  private normalizedPageAnimation(): string {
    switch (this.pageAnimation) {
      case 'none':
      case '无':
      case '无动画':
        return 'none';
      case 'cover':
      case '覆盖':
        return 'cover';
      case 'slide':
      case 'smooth':
      case '平滑':
      case '平移':
      case '滑动':
      default:
        return 'slide';
    }
  }

  private resetPageTurnVisualState(): void {
    this.pageTurnOffset = 0;
    this.pageTurnOpacity = 1;
  }

  // The page index is reducer-owned. This method only animates the newly
  // committed page subtree and never advances content or invents an anchor.
  // Reduced-motion and the explicit "none" option settle synchronously.
  private animatePageTurn(previousIndex: number): void {
    const animation = this.normalizedPageAnimation();
    if (this.verticalReading() || animation === 'none' || previousIndex === this.readerPageIndex) {
      this.resetPageTurnVisualState();
      return;
    }
    this.pageTurnOffset = animation === 'cover' ? 0 : (this.readerPageIndex > previousIndex ? 28 : -28);
    this.pageTurnOpacity = animation === 'cover' ? 0.28 : 0.7;
    MotionAdapter.apply('reader.page.turn.next-prev', this.reducedMotion, this.getUIContext(), () => {
      this.pageTurnOffset = 0;
      this.pageTurnOpacity = 1;
    });
  }

  private onCanonicalReaderLocationChange(): void {
    this.applyCanonicalLocationRestore();
  }

  private applyLiveReflowAnchor(): boolean {
    if (this.pendingReflowAnchorOffset < 0) return false;
    const offset = this.pendingReflowAnchorOffset;
    // Progress remains in state for the Core fallback contract; visual reflow
    // deliberately uses the exact scalar offset whenever it is available.
    this.pendingReflowAnchorOffset = -1;
    this.pendingReflowAnchorProgress = 0;
    return this.applyVisualAnchorRestore(offset);
  }

  private applyVisualAnchorRestore(offset: number): boolean {
    if (!this.hasReadableContent()) return false;
    const normalizedOffset = Math.max(0, Math.floor(offset));
    if (this.verticalReading()) {
      this.pendingVerticalRestoreOffset = normalizedOffset;
      this.restoreVerticalScrollIfReady();
      return true;
    }
    let targetIndex = 0;
    for (let index = 0; index < this.horizontalPageData.length; index += 1) {
      const page = this.horizontalPageData[index];
      if (page.fragments.length === 0 || page.chapterOffset > normalizedOffset) break;
      targetIndex = index;
    }
    if (targetIndex !== this.currentPageIndex()) {
      this.suppressNextHorizontalAnchor = true;
      ReaderUiStore.dispatch({ type: 'set-reader-page-index', readerPageIndex: targetIndex });
    }
    return true;
  }

  // Core owns the durable location. On first render after a resume, choose the
  // actual horizontal page containing that anchor or restore the vertical
  // Scroll to its containing paragraph. User-driven anchors never update the
  // canonical location, so ordinary scrolling cannot snap backwards.
  private applyCanonicalLocationRestore(): boolean {
    const location = this.canonicalLocation;
    if (location === null) {
      this.restoredCanonicalLocationKey = '';
      return false;
    }
    if (!this.hasReadableContent()) return false;
    const offset = Math.max(0, Math.floor(location.chapterOffset));
    const key = `${location.bookId}|${location.chapterIndex}|${offset}|${location.locationRevision}`;
    if (this.restoredCanonicalLocationKey === key) return false;
    this.restoredCanonicalLocationKey = key;
    return this.applyVisualAnchorRestore(offset);
  }

  // Horizontal pagination owns an exact page-start scalar offset. Report it
  // only after the page model is present; the Effects layer persists that
  // anchor, never the visual `readerPageIndex`.
  private publishVisibleHorizontalAnchor(): void {
    if (this.verticalReading() || !this.hasReadableContent()) return;
    const page = this.horizontalPageData[this.currentPageIndex()];
    if (page === undefined || page.fragments.length === 0 || page.contentIdentity === null) return;
    ReaderUiStore.reportReadingAnchor(page.contentIdentity, page.chapterOffset, page.chapterProgress);
  }

  private verticalSourceLength(): number {
    const paragraphs = this.paragraphs();
    let length = 0;
    for (let index = 0; index < paragraphs.length; index += 1) {
      length += this.sourceCharacterCount(paragraphs[index]);
      if (index + 1 < paragraphs.length) length += 1;
    }
    return length;
  }

  private recordVerticalFragmentLayout(fragment: ReaderPageFragment, area: Area): void {
    if (!this.verticalReading()) return;
    const active = this.activeReaderContentIdentity;
    if (active === null || fragment.contentIdentity.bookId !== active.bookId ||
      fragment.contentIdentity.sourceId !== active.sourceId ||
      fragment.contentIdentity.chapterIndex !== active.chapterIndex) {
      return;
    }
    const rawTop = area.position.y;
    const top = rawTop === undefined ? 0 : Number(rawTop);
    const height = Number(area.height);
    if (!Number.isFinite(top) || !Number.isFinite(height) || height <= 0) return;
    const existing = this.verticalFragmentLayouts.findIndex((item: ReaderVerticalFragmentLayout) =>
      item.sourceOffset === fragment.sourceOffset);
    if (existing >= 0) {
      const previous = this.verticalFragmentLayouts[existing];
      if (Math.abs(previous.top - top) < 0.25 && Math.abs(previous.height - height) < 0.25) return;
    }
    const next: ReaderVerticalFragmentLayout[] = this.verticalFragmentLayouts.filter(
      (item: ReaderVerticalFragmentLayout) => item.sourceOffset !== fragment.sourceOffset,
    );
    next.push({ sourceOffset: fragment.sourceOffset, top: top, height: height,
      contentIdentity: fragment.contentIdentity });
    this.verticalFragmentLayouts = next;
    this.restoreVerticalScrollIfReady();
  }

  private restoreVerticalScrollIfReady(): void {
    if (!this.verticalReading() || this.pendingVerticalRestoreOffset < 0) return;
    const fragments = this.horizontalPageData[0]?.fragments ?? [];
    if (fragments.length === 0 || this.verticalFragmentLayouts.length < fragments.length) return;
    let target: ReaderVerticalFragmentLayout | null = null;
    for (let index = 0; index < this.verticalFragmentLayouts.length; index += 1) {
      const item = this.verticalFragmentLayouts[index];
      if (item.sourceOffset <= this.pendingVerticalRestoreOffset &&
        (target === null || item.sourceOffset > target.sourceOffset)) {
        target = item;
      }
    }
    if (target === null) return;
    this.pendingVerticalRestoreOffset = -1;
    this.ignoreNextVerticalScrollAnchor = true;
    this.lastVerticalScrollOffset = Math.max(0, target.top);
    try {
      this.verticalScroller.scrollTo({ xOffset: 0, yOffset: this.lastVerticalScrollOffset, animation: false });
    } catch (e) {
      // The controller is unbound only during teardown; retaining Core's
      // anchor is safer than replacing it with a visual estimate.
      this.ignoreNextVerticalScrollAnchor = false;
    }
  }

  // A vertical Scroll does not have pages. Use the first actual paragraph
  // intersecting the viewport as a stable, exact Unicode-scalar anchor. This
  // intentionally prefers a paragraph boundary over inventing a proportional
  // intra-line character index from a pixel offset.
  private reportVerticalScrollAnchor(scrollOffset: number): void {
    if (!this.verticalReading() || this.verticalFragmentLayouts.length === 0) return;
    const y = Math.max(0, scrollOffset);
    let anchor: ReaderVerticalFragmentLayout | null = null;
    let nearestBefore: ReaderVerticalFragmentLayout | null = null;
    let first: ReaderVerticalFragmentLayout | null = null;
    for (let index = 0; index < this.verticalFragmentLayouts.length; index += 1) {
      const item = this.verticalFragmentLayouts[index];
      if (first === null || item.top < first.top) first = item;
      if (item.top <= y && (nearestBefore === null || item.top > nearestBefore.top)) {
        nearestBefore = item;
      }
      if (item.top <= y && item.top + item.height > y) {
        anchor = item;
        break;
      }
    }
    const selected = anchor ?? nearestBefore ?? first;
    if (selected === null) return;
    const length = this.verticalSourceLength();
    const progress = length > 0 ? Math.max(0, Math.min(1, selected.sourceOffset / length)) : 0;
    ReaderUiStore.reportReadingAnchor(selected.contentIdentity, selected.sourceOffset, progress);
  }

  private handleVerticalScroll(_xOffset: number, yOffset: number): void {
    this.lastVerticalScrollOffset = Math.max(0, yOffset);
    if (this.ignoreNextVerticalScrollAnchor) {
      this.ignoreNextVerticalScrollAnchor = false;
      return;
    }
    this.reportVerticalScrollAnchor(this.lastVerticalScrollOffset);
  }

  private currentPageIndex(): number {
    return Math.max(0, Math.min(this.horizontalPageData.length - 1, this.readerPageIndex));
  }

  private currentPage(): ReaderPageFragment[] {
    return this.horizontalPageData[this.currentPageIndex()]?.fragments ?? [];
  }

  private textTopInset(): number {
    const baseTop = this.wideReaderLayout() ? Math.max(this.topMargin, 48) : this.topMargin;
    return Math.max(baseTop, this.safeAreaTop + SpacingTokens.lg);
  }

  private textLeftInset(): number {
    const designInset = this.wideReaderLayout() ? Math.max(this.sideMargin, 44) : this.sideMargin;
    return Math.max(designInset, this.safeAreaStart + designInset);
  }

  private textRightInset(): number {
    const designInset = this.wideReaderLayout() ? Math.max(this.sideMargin, 44) : this.sideMargin;
    // The Tablet ControlDock is a floating overlay, not a permanent second
    // column. Keep the same bilateral reading edges as the frozen Reader 2
    // master; reserving 400vp here collapsed the entire chapter into the left
    // half of the tablet whenever the control layer was open.
    return Math.max(designInset, this.safeAreaEnd + designInset);
  }

  private textBottomInset(): number {
    // The demo owns a fixed 48vp body bottom inset. Safe area is a floor, not an
    // additive second margin, so ordinary navigation bars do not move the body.
    return Math.max(SpacingTokens.xl, this.safeAreaBottom + SpacingTokens.lg);
  }

  private textLayerWidth(): number {
    return Math.max(0, this.viewportWidth - this.textLeftInset() - this.textRightInset());
  }

  private verticalReading(): boolean {
    return this.paginationMode === 'vertical';
  }

  // ArkUI reports offsets for the concrete Text node that the user selected.
  // Keep the exact paragraph slice (rather than any demo text or a rendered
  // page approximation) as the only source for copy/search actions.
  private selectedTextForRange(paragraph: string, selectionStart: number, selectionEnd: number): string {
    if (!Number.isFinite(selectionStart) || !Number.isFinite(selectionEnd)) return '';
    const start = Math.max(0, Math.min(paragraph.length, Math.floor(selectionStart)));
    const end = Math.max(0, Math.min(paragraph.length, Math.floor(selectionEnd)));
    if (start >= end) return '';
    const selected = paragraph.slice(start, end);
    return selected.trim().length > 0 ? selected : '';
  }

  private reportNativeSelection(paragraph: string, selectionStart: number, selectionEnd: number): void {
    const selectedText = this.selectedTextForRange(paragraph, selectionStart, selectionEnd);
    if (selectedText.length === 0) {
      ReaderUiStore.dispatch({ type: 'selection-close' });
      return;
    }
    ReaderUiStore.dispatch({ type: 'selection-show', selectedText: selectedText });
  }

  // onCopy covers platform/accessibility copy paths in addition to our custom
  // long-press menu. It first records the actual callback value and then uses
  // the same Host-backed action as the visible “复制” item.
  private handleNativeCopy(value: string): void {
    if (value.trim().length === 0) return;
    ReaderUiStore.dispatch({ type: 'selection-show', selectedText: value });
    ReaderUiStore.dispatch({ type: 'selection-action', selectionAction: 'copy' });
  }

  // Text.bindSelectionMenu requires a CustomBuilder. The menu is attached to
  // each actual paragraph below, so it cannot appear until ArkUI has created a
  // native selection for that paragraph.
  @Builder NativeSelectionMenu() {
    ReaderSelectionToolbar()
  }

  @Builder ReaderParagraphs(paragraphs: ReaderPageFragment[], pageIndex: number) {
    Column() {
      if (pageIndex === 0 && this.title().length > 0) {
        Text(this.title())
          .fontSize(this.titleFontSize())
          .fontWeight(700)
          .fontColor(this.inkColor())
          .fontFamily(this.readerFontFamily())
          .lineHeight(this.titleLineHeight())
          .textAlign(TextAlign.Center)
          .width('100%')
          .margin({ bottom: SpacingTokens.lg })
      }
      ForEach(paragraphs, (fragment: ReaderPageFragment, i: number) => {
        Text(fragment.text)
          .fontSize(this.fontSize)
          .fontColor(this.inkColor())
          .fontFamily(this.readerFontFamily())
          .lineHeight(this.paragraphLineHeight())
          .letterSpacing(this.letterSpacing)
          .textIndent(this.paragraphIndentValue())
          .textAlign(TextAlign.Start)
          .wordBreak(WordBreak.NORMAL)
          .margin({ bottom: this.paragraphGap })
          .copyOption(CopyOptions.InApp)
          .bindSelectionMenu(TextSpanType.TEXT, this.NativeSelectionMenu, TextResponseType.LONG_PRESS)
          .onTextSelectionChange((selectionStart: number, selectionEnd: number) => {
            this.reportNativeSelection(fragment.text, selectionStart, selectionEnd);
          })
          .onCopy((value: string) => this.handleNativeCopy(value))
          .onAreaChange((_oldArea: Area, newArea: Area) => {
            this.recordVerticalFragmentLayout(fragment, newArea);
          })
      }, (fragment: ReaderPageFragment, i: number) => `${pageIndex}-${fragment.sourceOffset}-${i}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder EmptyReadingState() {
    Column({ space: 10 }) {
      Text(this.emptyTitle())
        .fontSize(Math.max(16, this.fontSize))
        .fontWeight(700)
        .fontColor(this.inkColor())
        .fontFamily(this.readerFontFamily())
        .textAlign(TextAlign.Center)
      Text(this.emptyMessage())
        .fontSize(13)
        .lineHeight(13 * 1.5)
        .fontColor(this.inkColor())
        .opacity(0.68)
        .fontFamily(ReaderTypography.sansFamily())
        .textAlign(TextAlign.Center)
        .maxLines(3)
        .width('100%')
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
  }

  /**
   * The runtime may advance from content.load only after ArkUI has measured
   * the displayed reader surface. Do not use viewport defaults, page/paragraph
   * estimates, or a synthetic phone-size fallback as layout proof.
   */
  private publishMeasuredBookOpenLayout(correlationId: string, contentGeneration: number,
    width: number, height: number): void {
    if (correlationId.length === 0 || contentGeneration <= 0 || !this.hasReadableContent() ||
      !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return;
    }
    ReaderUiStore.provideBookOpenMeasuredLayout(correlationId, contentGeneration, {
      // book.open enters the selected chapter at its real initial anchor; the
      // renderer must not invent a paragraph-derived offset before a later
      // reader-location measurement protocol exists.
      chapterOffset: 0,
      chapterProgress: 0,
      viewportWidth: width,
      viewportHeight: height,
      fontScale: this.fontSize / 17,
    });
  }

  private publishMeasuredPlaybackLayout(correlationId: string, direction: string,
    width: number, height: number): void {
    if (correlationId.length === 0 || (direction !== 'next' && direction !== 'previous') ||
      this.verticalReading() || this.canonicalLocation === null ||
      !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    const targetPageIndex = this.readerPageIndex + (direction === 'next' ? 1 : -1);
    if (targetPageIndex < 0 || targetPageIndex >= this.horizontalPageData.length) {
      ReaderUiStore.rejectPlaybackPageProposal(
        correlationId,
        direction === 'next' ? 'PAGE_BOUNDARY_NEXT_CHAPTER_REQUIRED' : 'PAGE_BOUNDARY_PREVIOUS_CHAPTER_REQUIRED',
      );
      return;
    }
    const page = this.horizontalPageData[targetPageIndex];
    if (page.fragments.length === 0) return;
    ReaderUiStore.providePlaybackMeasuredLayout(correlationId, {
      anchor: `${this.canonicalLocation.bookId}:${this.canonicalLocation.chapterIndex}:${page.chapterOffset}`,
      targetPageIndex: targetPageIndex,
      chapterIndex: this.canonicalLocation.chapterIndex,
      chapterOffset: page.chapterOffset,
      chapterProgress: page.chapterProgress,
      viewportWidth: width,
      viewportHeight: height,
      fontScale: this.fontSize / 17,
    });
  }

  @Builder MeasuredReadingSurface(correlationId: string, contentGeneration: number,
    playbackCorrelationId: string, playbackDirection: string) {
    Stack() {
      if (!this.hasReadableContent()) {
        this.EmptyReadingState()
      } else if (this.verticalReading()) {
        Scroll(this.verticalScroller) {
          this.ReaderParagraphs(this.horizontalPageData[0]?.fragments ?? [], 0)
        }
        .width('100%')
        .height('100%')
        .scrollBar(BarState.Off)
        .onScroll((xOffset: number, yOffset: number) => this.handleVerticalScroll(xOffset, yOffset))
        .onScrollStop(() => this.reportVerticalScrollAnchor(this.lastVerticalScrollOffset))
        .onClick(() => {
          if (!this.controlLayer()) {
            ReaderUiStore.dispatch({ type: 'route-push', id: 'reader' });
          }
        })
      } else {
        Column() {
          // Key the rendered subtree by the logical page. Without this keyed
          // wrapper ArkUI reuses the page-0 Builder nodes when only the
          // StorageProp index changes: the footer advances while the body
          // remains visually stuck on the first page.
          ForEach([this.currentPageIndex()], (pageIndex: number) => {
            this.ReaderParagraphs(this.horizontalPageData[pageIndex]?.fragments ?? [], pageIndex)
          }, (pageIndex: number) => pageIndex.toString())
        }
        .width('100%')
        .height('100%')
        .translate({ x: this.pageTurnOffset })
        .opacity(this.pageTurnOpacity)
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
    .onAreaChange((_oldArea: Area, newArea: Area) => {
      // correlationId + contentGeneration are Builder arguments captured by
      // this rendered subtree. A late callback from an old reader cannot feed
      // layout into a superseding book.open transaction.
      this.publishMeasuredBookOpenLayout(
        correlationId,
        contentGeneration,
        Number(newArea.width),
        Number(newArea.height),
      );
      this.publishMeasuredPlaybackLayout(
        playbackCorrelationId,
        playbackDirection,
        Number(newArea.width),
        Number(newArea.height),
      );
    })
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }

  private measurementKey(): string {
    const snapshot = ReaderUiStore.bookOpenPilotSnapshot();
    return `${snapshot.activeCorrelationId}|${snapshot.contentGeneration}` +
      `|${this.playbackPageCorrelation}|${this.playbackPageDirection}`;
  }

  build() {
    // A concrete container remains the single ArkUI build root. The Builder
    // arguments are captured by its measured child, not read back from global
    // state inside the asynchronous onAreaChange callback.
    Stack() {
      ForEach([this.measurementKey()], (_key: string) => {
        this.MeasuredReadingSurface(
          ReaderUiStore.bookOpenPilotSnapshot().activeCorrelationId,
          ReaderUiStore.bookOpenPilotSnapshot().contentGeneration,
          this.playbackPageCorrelation,
          this.playbackPageDirection,
        )
      }, (key: string) => key)
    }
    .width('100%')
    .height('100%')
  }
}

// .fd-ir-info-layer: inset 26 24 22, 4-corner overlay (top-left book·chapter,
//   top-right time, bottom-left progress, bottom-right page label). 12px sans
//   muted. pointer-events none (taps pass through to TapZones).
@Component
export struct ReadingInfoLayer {
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp(SafeAreaAdapter.K_START) safeAreaStart: number = SafeAreaAdapter.DEFAULT_START;
  @StorageProp(SafeAreaAdapter.K_END) safeAreaEnd: number = SafeAreaAdapter.DEFAULT_END;
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @StorageProp('reader.readerTheme') readerTheme: string = 'paper';
  @StorageProp('reader.appThemeMode') appThemeMode: string = 'system';
  @StorageProp('reader.theme.colorMode') systemColorMode: string = 'light';
  @StorageProp('reader.activeSession') activeSession: string = '';
  @StorageProp('reader.paginationMode') paginationMode: string = 'horizontal';
  @StorageProp('reader.pageIndex') readerPageIndex: number = 0;
  @StorageProp('reader.pageCount') readerPageCount: number = 1;
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.currentChapterTitle') currentChapterTitle: string = '';
  @StorageProp('reader.readerToggles.statusInfo') statusInfo: boolean = true;
  @Prop chapterTitle: string = '';
  @Prop progress: number = -1;

  private mutedColor(): string {
    return ReaderThemeResolver.palette(this.readerTheme, this.appThemeMode).muted;
  }

  // 四角绝对定位锚点：top-left / top-right / bottom-left / bottom-right
  private cornerLeft(): number {
    return Math.max(24, this.safeAreaStart + 24);
  }
  private cornerRightX(): number {
    return this.viewportWidth - Math.max(24, this.safeAreaEnd + 24);
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

  private pageLabel(): string {
    const count = Math.max(1, this.readerPageCount);
    const page = Math.max(0, Math.min(count - 1, this.readerPageIndex)) + 1;
    return `第 ${page} / ${count} 页`;
  }

  private bookChapterLabel(): string {
    const canonicalChapter: string = this.chapterTitle !== '' ? this.chapterTitle : this.currentChapterTitle;
    if (this.currentBook === null) return canonicalChapter !== '' ? canonicalChapter : '未选择书籍';
    const title = this.currentBook.title.length > 0 ? this.currentBook.title : '未命名书籍';
    const chapter = canonicalChapter.length > 0 ? canonicalChapter : this.currentBook.latestChapter;
    if (chapter.length === 0) return `${title} · 正文未加载`;
    return `${title} · ${chapter}`;
  }

  private progressLabel(): string {
    if (this.progress >= 0 && this.progress <= 1) return `${Math.round(this.progress * 100)}%`;
    const count = Math.max(1, this.readerPageCount);
    const page = Math.max(0, Math.min(count - 1, this.readerPageIndex)) + 1;
    return `${Math.round((page / count) * 100)}%`;
  }

  private clockLabel(): string {
    const now = new Date();
    const minute = now.getMinutes();
    return `${now.getHours()}:${minute < 10 ? '0' : ''}${minute}`;
  }

  build() {
    Stack() {
      if (this.statusInfo) {
        // top-left: book · chapter
        Text(this.bookChapterLabel())
          .fontSize(12)
          .fontColor(this.mutedColor())
          .fontFamily(ReaderTypography.sansFamily())
          .position({ x: this.cornerLeft(), y: this.cornerTopY() })
          .markAnchor({ x: 0, y: 0 })
        // top-right: current device time, never a demo fixture.
        Text(this.clockLabel())
          .fontSize(12)
          .fontColor(this.mutedColor())
          .fontFamily(ReaderTypography.sansFamily())
          .position({ x: this.cornerRightX(), y: this.cornerTopY() })
          .markAnchor({ x: '100%', y: 0 })
        // bottom-left: progress
        Text(this.progressLabel())
          .fontSize(12)
          .fontColor(this.mutedColor())
          .fontFamily(ReaderTypography.sansFamily())
          .position({ x: this.cornerLeft(), y: this.cornerBottomY() })
          .markAnchor({ x: 0, y: '100%' })
        // Vertical continuous reading has no page-number concept.
        if (this.paginationMode !== 'vertical') {
          Text(this.pageLabel())
            .fontSize(12)
            .fontColor(this.mutedColor())
            .fontFamily(ReaderTypography.sansFamily())
            .position({ x: this.cornerRightX() - this.pageRightOffset(), y: this.cornerBottomY() })
            .markAnchor({ x: '100%', y: '100%' })
        }
      }
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
  @StorageProp(SafeAreaAdapter.K_START) safeAreaStart: number = SafeAreaAdapter.DEFAULT_START;
  @StorageProp(SafeAreaAdapter.K_END) safeAreaEnd: number = SafeAreaAdapter.DEFAULT_END;
  @StorageProp('reader.displayedRouteId') routeId: string = 'reader';
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.currentChapterTitle') currentChapterTitle: string = '';

  private bookTitle(): string {
    if (this.currentBook === null) return '未选择书籍';
    return this.currentBook.title.length > 0 ? this.currentBook.title : '未命名书籍';
  }

  private bookMeta(): string {
    if (this.currentBook === null) return '请选择书籍后开始阅读';
    const chapter = this.currentChapterTitle.length > 0
      ? this.currentChapterTitle : this.currentBook.latestChapter;
    const source = this.currentBook.sourceName;
    if (chapter.length > 0 && source.length > 0) return `${chapter} · ${source}`;
    if (chapter.length > 0) return chapter;
    if (source.length > 0) return source;
    return '正文未加载';
  }

  private handleBack(): void {
    if (this.routeId === 'source-switch' || this.routeId === 'source-switch-results') {
      ReaderUiStore.dispatch({ type: 'route-pop' });
      return;
    }
    ReaderUiStore.dispatch({ type: 'reader-exit' });
  }

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
              .onClick(() => this.handleBack())
              InteractionDebugBadge({ label: 'back', tone: 'action', offsetTop: 22 })
            }
            .width(40)
            .height(42)

            Stack({ alignContent: Alignment.TopStart }) {
              Column({ space: 5 }) {
                Text(this.bookTitle())
                  .fontSize(16)
                  .fontWeight(700)
                  .fontColor(ColorTokens.controlInk)
                  .fontFamily(ReaderTypography.sansFamily())
                  .maxLines(2)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
                Text(this.bookMeta())
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

            if (this.currentBook !== null) {
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
            }

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
      .padding({
        left: Math.max(SpacingTokens.cardPadding, this.safeAreaStart + SpacingTokens.cardPadding),
        right: Math.max(SpacingTokens.cardPadding, this.safeAreaEnd + SpacingTokens.cardPadding),
      })
      .margin({ top: this.safeAreaTop + 18 })
    }
    .width('100%')
    .height('100%')
  }
}

// .fd-immersive-hotzone: prev 26% / center 48% / next 26%. Center opens the
// live reader control layer (route-push reader); side zones dispatch page prev/next.
@Component
export struct TapZones {
  @StorageProp(InteractionDebugAdapter.K_VISIBLE) interactionDebugVisible: boolean = InteractionDebugAdapter.DEFAULT_VISIBLE;
  @StorageProp('reader.paginationMode') paginationMode: string = 'horizontal';
  // This is a real consumer of ReaderFullSettings/ReaderSettingsPanel's
  // `tapMode`, not a decorative preference.  Each mode keeps a center control
  // region while changing how much of the page advances/retreats on a tap.
  @StorageProp('reader.readerSettingOptions.tapMode') tapMode: string = '左右区域';
  @Prop zoneEnabled: boolean = true;
  // `contractBindingsDefined` distinguishes a host-composite node with an
  // intentionally empty binding list (for example loading) from legacy live
  // immersive routes which have no TapZones contract node at all.
  @Prop contractBindingsDefined: boolean = false;
  @Prop contractBindings: ViewStateExplicitBinding[] = [];

  private dispatchTarget(target: ReaderUIScreenGraphTapZoneTarget): void {
    if (!this.zoneEnabled) return;
    // The live immersive surface predates a TapZones contract node. Keep its
    // reducer actions explicit here so the right/left zones remain production
    // pagination even when no ScreenGraph binding is present. Contract-backed
    // composite states continue through the strict adapter and fail closed on
    // malformed or missing target bindings.
    if (!this.contractBindingsDefined) {
      if (target === 'previous') {
        ReaderUiStore.dispatch({ type: 'reader-page-prev' });
      } else if (target === 'next') {
        ReaderUiStore.dispatch({ type: 'reader-page-next' });
      } else {
        ReaderUiStore.dispatch({ type: 'route-push', id: 'reader' });
      }
      return;
    }
    const event = ReaderUIScreenGraphTapZoneAdapter.explicitEvent(this.contractBindings, target);
    if (event !== null) ReaderUiStore.dispatch(event);
  }

  private zoneOpacity(): number {
    return this.interactionDebugVisible ? 0.42 : 0;
  }

  private zoneColor(kind: string): string {
    if (kind === 'center') return ColorTokens.primary;
    if (kind === 'prev') return ColorTokens.accent;
    return ColorTokens.primaryDark;
  }

  private sideZoneWidth(): string {
    if (this.tapMode === '中间') return '38%';
    if (this.tapMode === '边缘') return '18%';
    return '26%';
  }

  private centerZoneWidth(): string {
    if (this.tapMode === '中间') return '24%';
    if (this.tapMode === '边缘') return '64%';
    return '48%';
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
    if (this.paginationMode !== 'vertical') {
      Row() {
        Column() {
          this.zoneLabel('PrevPageHotzone')
        }
        .width(this.sideZoneWidth())
        .height('100%')
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .backgroundColor(this.zoneColor('prev'))
        .opacity(this.zoneOpacity())
        .onClick(() => this.dispatchTarget('previous'))
        Column() {
          this.zoneLabel('ControlLayerHotzone')
        }
        .width(this.centerZoneWidth())
        .height('100%')
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .backgroundColor(this.zoneColor('center'))
        .opacity(this.zoneOpacity())
        .onClick(() => this.dispatchTarget('control'))
        Column() {
          this.zoneLabel('NextPageHotzone')
        }
        .width(this.sideZoneWidth())
        .height('100%')
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .backgroundColor(this.zoneColor('next'))
        .opacity(this.zoneOpacity())
        .onClick(() => this.dispatchTarget('next'))
      }
      .width('100%')
      .height('100%')
      .zIndex(ZIndexTokens.dialog)
      // The hot zones still receive ordinary tap gestures, but must not mask
      // the Text layer's long-press / selection recognizer above them.
      .hitTestBehavior(HitTestMode.Transparent)
    }
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
  @StorageProp(SafeAreaAdapter.K_END) safeAreaEnd: number = SafeAreaAdapter.DEFAULT_END;
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
              MotionAdapter.apply('reader.session.capsule.control.press-toggle', this.reducedMotion, this.getUIContext(), () => {
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
          MotionAdapter.apply('reader.session.capsule.update', this.reducedMotion, this.getUIContext(), () => {
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
      .padding({
        right: Math.max(SpacingTokens.lg, this.safeAreaEnd + SpacingTokens.lg),
        bottom: this.safeAreaBottom + SpacingTokens.lg,
      })
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
  @Prop tapZoneContractBindingsDefined: boolean = false;
  @Prop tapZoneContractBindings: ViewStateExplicitBinding[] = [];

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
        TapZones({
          contractBindingsDefined: this.tapZoneContractBindingsDefined,
          contractBindings: this.tapZoneContractBindings,
        })
        SessionCapsule()
      }
    }
    .width('100%')
    .height('100%')
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}
