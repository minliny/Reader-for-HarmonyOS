// ReaderComponents — reader immersive base + ReaderBase composite.
// Ported from frontend-demo (styles/00-foundation.css .fd-reading-surface /
// .fd-ir-reading-layer / .fd-ir-info-layer / .fd-immersive-hotzone).
//
// The retired route-backed control dock/module sheets are not reconstructed.
// Reader control modules preserve the canonical reading route and use semantic
// overlay state in their separately admitted consumer. ReaderBase is the
// factored base composite used by every reader route's view-state body; theme='night'
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
import { ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { InteractionDebugAdapter } from '../adapters/InteractionDebugAdapter';
import { TokenAdapter } from '../adapters/TokenAdapter';
import { MotionAdapter } from '../adapters/MotionAdapter';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { FontTokens } from '../../contract/generated/TypeTokens';
import { ReaderThemeResolver, ReaderThemePalette } from '../tokens/ReaderThemeResolver';
import { ReaderUiVisualTokens } from '../../contract/reader_ui/VisualAdmission';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { BookDetail, CoreReaderCanonicalLocation, ReaderContentIdentity, canSwitchBookSourceId } from '../store/ReaderUiState';
import type { ReaderUIJSONPayload } from 'reader_ui_runtime';
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

function requestReaderControlToggle(): void {
  const payload: ReaderUIJSONPayload = {};
  payload['overlay'] = 'reader-control';
  ReaderUiStore.dispatch({
    type: 'reader.control.toggle',
    readerUIJSONPayload: payload,
  });
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
  @StorageProp('reader.readerTheme') readerTheme: string = 'paper';
  @StorageProp('reader.appThemeMode') appThemeMode: string = 'system';
  @Prop theme: string = '';

  private palette(): ReaderThemePalette {
    const resolvedTheme: string = this.theme !== '' ? this.theme : this.readerTheme;
    return ReaderThemeResolver.palette(resolvedTheme, this.appThemeMode);
  }

  private usesCanonicalPaperLayer(): boolean {
    return (this.theme !== '' ? this.theme : this.readerTheme) === 'paper';
  }

  build() {
    Stack() {
      // Exact Figma ReadingSurface/PaperLayer (1023:18356 / 1023:18372).
      // Its four fills are kept as independent layers: linear paper base,
      // tiled source texture, the 10% outer vignette and the 70% highlight.
      // Do not approximate it with viewport-generated stripes, stars or a
      // theme-specific gradient: those caused the recurring top-left shadow
      // drift that does not exist in the canonical component.
      Column()
        .width('100%')
        .height('100%')
        .backgroundColor(this.usesCanonicalPaperLayer() ? ReaderUiVisualTokens.readerPaperBaseEnd : this.palette().paper)
      if (this.usesCanonicalPaperLayer()) {
        Column()
          .width('100%')
          .height('100%')
          .linearGradient({
            angle: 180,
            colors: [
              [ReaderUiVisualTokens.readerPaperBaseStart, 0],
              [ReaderUiVisualTokens.readerPaperBaseEnd, 100],
            ],
          })
        Image($r('app.media.figma_reader_paper_tile'))
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.None)
          .objectRepeat(ImageRepeat.XY)
        Column()
          .width('100%')
          .height('100%')
          .radialGradient({
            center: ['85.36%', '85.36%'],
            radius: '100%',
            colors: [
              [ReaderUiVisualTokens.readerPaperVignetteTransparent, 0.56],
              [ReaderUiVisualTokens.readerPaperVignette, 1],
            ],
          })
        Column()
          .width('100%')
          .height('100%')
          .radialGradient({
            center: ['60.57%', '63.54%'],
            radius: '42%',
            colors: [
              [ReaderUiVisualTokens.readerPaperHighlight, 0],
              [ReaderUiVisualTokens.readerPaperHighlightTransparent, 0.42],
            ],
          })
      }
      InteractionDebugFrame({ label: 'ReadingBackground', tone: 'module' })
    }
    .width('100%')
    .height('100%')
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}

// Reader/Responsive/ReadingSurface owns one exact text frame per admitted
// viewport. The Figma master fixes its outer geometry; typography controls may
// change the chapter's measured pagination, but may never squeeze the text
// frame when a floating control layer appears.
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
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @StorageProp(ReaderUiStore.K_READER_CHAPTER_OFFSET) readerChapterOffset: number = 0;
  @StorageProp(ReaderUiStore.K_READER_CHAPTER_PROGRESS) readerChapterProgress: number = 0;
  @StorageProp('reader.typography.fontSize') @Watch('onPaginationInputChange') fontSize: number = ReaderUiVisualTokens.readerContentBodySize;
  @StorageProp('reader.typography.lineHeight') @Watch('onPaginationInputChange') lineHeightRatio: number = ReaderUiVisualTokens.readerContentBodyLineHeight / ReaderUiVisualTokens.readerContentBodySize;
  @StorageProp('reader.typography.paragraphGap') @Watch('onPaginationInputChange') paragraphGap: number = ReaderUiVisualTokens.readerContentParagraphGap;
  @StorageProp('reader.typography.letterSpacing') @Watch('onPaginationInputChange') letterSpacing: number = 0;
  @StorageProp('reader.typography.fontFamily') @Watch('onPaginationInputChange') fontFamily: string = 'serif';
  @StorageProp('reader.pageSpace.paragraphIndent') @Watch('onPaginationInputChange') paragraphIndent: number = ReaderUiVisualTokens.readerContentParagraphIndent / ReaderUiVisualTokens.readerContentBodySize;
  @StorageProp(ReaderUiStore.K_CANONICAL_READER_LOCATION) @Watch('onCanonicalReaderLocationChange') canonicalLocation: CoreReaderCanonicalLocation | null = null;
  @StorageProp(ReaderUiStore.K_PLAYBACK_PAGE_CORRELATION) playbackPageCorrelation: string = '';
  @StorageProp(ReaderUiStore.K_PLAYBACK_PAGE_DIRECTION) playbackPageDirection: string = '';
  @StorageProp('reader.readerTheme') readerTheme: string = 'paper';
  @StorageProp('reader.appThemeMode') appThemeMode: string = 'system';
  @StorageProp('reader.theme.colorMode') systemColorMode: string = 'light';
  @State private horizontalPageData: ReaderPageModel[] = [{ fragments: [], chapterOffset: 0, chapterProgress: 0, contentIdentity: null }];
  @State private verticalFragmentLayouts: ReaderVerticalFragmentLayout[] = [];
  private verticalScroller: Scroller = new Scroller();
  private lastVerticalScrollOffset: number = 0;
  private pendingVerticalRestoreOffset: number = -1;
  private suppressNextHorizontalAnchor: boolean = false;
  private ignoreNextVerticalScrollAnchor: boolean = false;
  private restoredCanonicalLocationKey: string = '';
  // ArkUI StorageProp notifications are synchronous. Publishing a page anchor
  // writes the reducer snapshot back to AppStorage, including the same
  // pagination inputs watched by this component. Without a transaction guard
  // that write re-enters pagination before the first refresh returns and
  // eventually overflows the JS stack on a real device/emulator.
  private paginationRefreshInProgress: boolean = false;
  private lastPublishedHorizontalAnchorKey: string = '';
  // Layout changes must reflow from the reader's current measured anchor,
  // not from the initial canonical restore location. The latter intentionally
  // stays stable while the reader scrolls, so it can be older than the live
  // offset by many paragraphs.
  private pendingReflowAnchorOffset: number = -1;
  private pendingReflowAnchorProgress: number = 0;

  private inkColor(): string {
    if (this.readerTheme === 'paper') return ReaderUiVisualTokens.readerContentInk;
    return ReaderThemeResolver.palette(this.readerTheme, this.appThemeMode).ink;
  }

  private controlLayer(): boolean {
    return this.routeId !== 'immersive-reading' && this.routeId !== 'reader_content';
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
        // The appearance contract's Figma master names this face explicitly;
        // do not silently collapse it into the generic system serif role.
        return 'Noto Serif SC';
      case 'lxgw':
        // 霞鹜文楷 is not 楷体.  If the device lacks it ArkUI falls back
        // normally, but the requested face remains the Figma contract value.
        return 'LXGW WenKai';
      case 'serif':
      default:
        return ReaderUiVisualTokens.readerContentBodyFontFamily;
    }
  }

  private titleFontSize(): number {
    return this.fontSize + (ReaderUiVisualTokens.readerContentTitleSize -
      ReaderUiVisualTokens.readerContentBodySize);
  }

  private titleLineHeight(): number {
    return this.titleFontSize() * (ReaderUiVisualTokens.readerContentTitleLineHeight /
      ReaderUiVisualTokens.readerContentTitleSize);
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
    return this.title().length > 0
      ? this.titleLineHeight() + ReaderUiVisualTokens.readerContentSectionGap : 0;
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
    this.refreshPagination();
  }

  private onPaginationInputChange(): void {
    if (this.paginationRefreshInProgress) return;
    this.captureLiveReflowAnchor();
    // A viewport/font/mode change creates new page boundaries. Do not let a
    // prior canonical restore key suppress restoration in the new layout.
    this.restoredCanonicalLocationKey = '';
    this.refreshPagination();
  }

  private captureLiveReflowAnchor(): void {
    const canonical = this.canonicalLocation;
    const active = this.activeReaderContentIdentity;
    if (!this.hasReadableContent() || canonical === null || active === null ||
      canonical.bookId !== active.bookId || canonical.chapterIndex !== active.chapterIndex ||
      !Number.isSafeInteger(canonical.chapterOffset) || canonical.chapterOffset < 0 ||
      !Number.isFinite(canonical.chapterProgress) ||
      canonical.chapterProgress < 0 || canonical.chapterProgress > 1) {
      return;
    }
    this.pendingReflowAnchorOffset = canonical.chapterOffset;
    this.pendingReflowAnchorProgress = canonical.chapterProgress;
  }

  private refreshPagination(): void {
    if (this.paginationRefreshInProgress) return;
    this.paginationRefreshInProgress = true;
    try {
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
    } finally {
      this.paginationRefreshInProgress = false;
    }
  }

  private onReaderPageIndexChange(): void {
    if (this.suppressNextHorizontalAnchor) {
      this.suppressNextHorizontalAnchor = false;
      return;
    }
    this.publishVisibleHorizontalAnchor();
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
    if (this.verticalReading() || !this.hasReadableContent()) {
      this.lastPublishedHorizontalAnchorKey = '';
      return;
    }
    const page = this.horizontalPageData[this.currentPageIndex()];
    if (page === undefined || page.fragments.length === 0 || page.contentIdentity === null) return;
    const identity = page.contentIdentity;
    const key = identity.bookId + '|' + identity.sourceId + '|' + identity.chapterIndex +
      '|' + page.chapterOffset + '|' + page.chapterProgress;
    if (key === this.lastPublishedHorizontalAnchorKey) return;
    this.lastPublishedHorizontalAnchorKey = key;
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
    const sourceInset = this.wideReaderLayout()
      ? ReaderUiVisualTokens.readerContentTabletTop
      : ReaderUiVisualTokens.readerContentPhoneTop;
    return Math.max(sourceInset, this.safeAreaTop);
  }

  private textLeftInset(): number {
    const sourceInset = this.wideReaderLayout()
      ? ReaderUiVisualTokens.readerContentTabletLeft
      : ReaderUiVisualTokens.readerContentPhoneLeft;
    return Math.max(sourceInset, this.safeAreaStart);
  }

  private textRightInset(): number {
    const sourceInset = this.wideReaderLayout()
      ? ReaderUiVisualTokens.readerContentTabletRight
      : ReaderUiVisualTokens.readerContentPhoneRight;
    return Math.max(sourceInset, this.safeAreaEnd);
  }

  private textBottomInset(): number {
    const sourceInset = this.wideReaderLayout()
      ? ReaderUiVisualTokens.readerContentTabletBottom
      : ReaderUiVisualTokens.readerContentPhoneBottom;
    return Math.max(sourceInset, this.safeAreaBottom);
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
          .margin({ bottom: ReaderUiVisualTokens.readerContentSectionGap })
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
          // The Text node owns native long-press selection and is therefore
          // the actual hit target in vertical mode. Bind the deliberate tap
          // here instead of relying on an ancestor Scroll callback that never
          // receives the event once selection is enabled.
          .onClick(() => {
            if (this.verticalReading() && !this.controlLayer()) {
              requestReaderControlToggle();
            }
          })
          .onAreaChange((_oldArea: Area, newArea: Area) => {
            this.recordVerticalFragmentLayout(fragment, newArea);
          })
      }, (fragment: ReaderPageFragment, i: number) => `${pageIndex}-${fragment.sourceOffset}-${i}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder EmptyReadingState() {
    // There is no canonical Figma no-book / no-content reader page.  An
    // unavailable Core chapter must therefore stay visually inert instead of
    // being substituted with a locally-authored explanation panel. Preserve
    // the admitted paper surface without mounting a hidden zero-size node.
    Blank()
      .width('100%')
      .height('100%')
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
        // ArkUI vertically centers a short Scroll child by default. The
        // Figma reading surface fixes the text frame to its top inset, and a
        // real long chapter must begin from that same origin before scrolling.
        .align(Alignment.Top)
        .scrollBar(BarState.Off)
        .onScroll((xOffset: number, yOffset: number) => this.handleVerticalScroll(xOffset, yOffset))
        .onScrollStop(() => this.reportVerticalScrollAnchor(this.lastVerticalScrollOffset))
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

// Exact Reader/ImmersiveInfo (654:693) and Reader/ImmersiveFooterStatus
// (1167:10248).  These are a distinct Figma component, not a generic reader
// HUD: 24.55px inset, Noto Sans SC 12/14.4 metadata, and a bottom-right
// footer that incorporates the current session capsule when active.
@Component
export struct ReadingInfoLayer {
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @StorageProp('reader.activeSession') activeSession: string = '';
  @StorageProp('reader.paginationMode') paginationMode: string = 'horizontal';
  @StorageProp('reader.pageIndex') readerPageIndex: number = 0;
  @StorageProp('reader.pageCount') readerPageCount: number = 1;
  @StorageProp('reader.readerToggles.statusInfo') statusInfo: boolean = true;
  // Retained for ScreenGraph constructor compatibility. Reader/ImmersiveInfo's
  // current Figma default is the system-status row, so this alternate prop is
  // intentionally not drawn until its boolean variant is admitted.
  @Prop chapterTitle: string = '';
  @Prop progress: number = -1;

  private footerSessionVisible(): boolean {
    return this.activeSession === 'auto-page' || this.activeSession === 'tts';
  }

  private footerInset(): number {
    return ReaderUiVisualTokens.readerImmersiveInset;
  }

  private footerMetaY(): number {
    return this.viewportHeight - this.footerInset() - ReaderUiVisualTokens.readerImmersiveMetaLineHeight;
  }

  private footerSessionY(): number {
    return this.viewportHeight - ReaderUiVisualTokens.readerImmersiveFooterBottom -
      ReaderUiVisualTokens.readerSessionCapsuleHeight;
  }

  private pageLabel(): string {
    const count = Math.max(1, this.readerPageCount);
    const page = Math.max(0, Math.min(count - 1, this.readerPageIndex)) + 1;
    return `第 ${page} / ${count} 页`;
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

  @Builder systemStatus() {
    Text(this.clockLabel())
      .width(80)
      .height(ReaderUiVisualTokens.readerImmersiveStatusHeight)
      .fontSize(ReaderUiVisualTokens.readerImmersiveMetaSize)
      .lineHeight(ReaderUiVisualTokens.readerImmersiveMetaLineHeight)
      .fontWeight(400)
      .fontColor(ReaderUiVisualTokens.readerImmersiveMetaInk)
      .fontFamily(ReaderUiVisualTokens.readerImmersiveMetaFontFamily)
      .position({ x: this.footerInset(), y: this.footerInset() })
    Row({ space: ReaderUiVisualTokens.readerImmersiveStatusIconGap }) {
      Image($r('app.media.figma_reader_immersive_signal'))
        .width(ReaderUiVisualTokens.readerImmersiveStatusIconSize)
        .height(ReaderUiVisualTokens.readerImmersiveStatusIconSize)
      Image($r('app.media.figma_reader_immersive_wifi'))
        .width(ReaderUiVisualTokens.readerImmersiveStatusIconSize)
        .height(ReaderUiVisualTokens.readerImmersiveStatusIconSize)
      Image($r('app.media.figma_reader_immersive_battery'))
        .width(ReaderUiVisualTokens.readerImmersiveStatusIconSize)
        .height(ReaderUiVisualTokens.readerImmersiveStatusIconSize)
    }
    .position({
      x: this.viewportWidth - this.footerInset() -
        ReaderUiVisualTokens.readerImmersiveStatusIconSize * 3 -
        ReaderUiVisualTokens.readerImmersiveStatusIconGap * 2,
      y: this.footerInset() + ReaderUiVisualTokens.readerImmersiveStatusIconTop,
    })
  }

  @Builder footerStatus() {
    if (this.footerSessionVisible()) {
      Row({ space: ReaderUiVisualTokens.readerImmersiveFooterGap }) {
        if (this.paginationMode !== 'vertical') {
          Text(this.pageLabel())
            .fontSize(ReaderUiVisualTokens.readerImmersiveMetaSize)
            .lineHeight(ReaderUiVisualTokens.readerImmersiveMetaLineHeight)
            .fontWeight(400)
            .fontColor(ReaderUiVisualTokens.readerImmersiveMetaInk)
            .fontFamily(ReaderUiVisualTokens.readerImmersiveMetaFontFamily)
        }
        SessionCapsule()
      }
      .height(ReaderUiVisualTokens.readerSessionCapsuleHeight)
      .alignItems(VerticalAlign.Center)
      .position({ x: this.viewportWidth - this.footerInset(), y: this.footerSessionY() })
      .markAnchor({ x: '100%', y: 0 })
    } else if (this.paginationMode !== 'vertical') {
      Text(this.pageLabel())
        .fontSize(ReaderUiVisualTokens.readerImmersiveMetaSize)
        .lineHeight(ReaderUiVisualTokens.readerImmersiveMetaLineHeight)
        .fontWeight(400)
        .fontColor(ReaderUiVisualTokens.readerImmersiveMetaInk)
        .fontFamily(ReaderUiVisualTokens.readerImmersiveMetaFontFamily)
        .position({ x: this.viewportWidth - this.footerInset(), y: this.footerMetaY() })
        .markAnchor({ x: '100%', y: 0 })
    }
  }

  build() {
    Stack() {
      if (this.statusInfo) {
        this.systemStatus()
        Text(this.progressLabel())
          .fontSize(ReaderUiVisualTokens.readerImmersiveMetaSize)
          .lineHeight(ReaderUiVisualTokens.readerImmersiveMetaLineHeight)
          .fontWeight(400)
          .fontColor(ReaderUiVisualTokens.readerImmersiveMetaInk)
          .fontFamily(ReaderUiVisualTokens.readerImmersiveMetaFontFamily)
          .position({ x: this.footerInset(), y: this.footerMetaY() })
      }
      this.footerStatus()
      InteractionDebugFrame({ label: 'ImmersiveInfoLayer', tone: 'module' })
    }
    .width('100%')
    .height('100%')
    // The session capsule must remain above horizontal page-turn zones. In a
    // normal reading session, however, this full-screen metadata layer is
    // purely visual and must not sit over the vertical Scroll: doing so turns
    // the Figma “滚动” mode into a visually single but non-draggable page.
    .zIndex(this.footerSessionVisible() ? ZIndexTokens.dialog + 1 : 0)
    .hitTestBehavior(this.footerSessionVisible() ? HitTestMode.Transparent : HitTestMode.None)
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}

// .fd-reader-top: top control chrome shown on reader/control-layer and overlay routes.
// Live demo shape: one floating rounded bar with back, book title/source line,
// source-switch action, and more. The immersive routes keep ReadingInfoLayer.
@Component
export struct ReaderTopArea {
  // The reader surface intentionally expands behind the system status bar.
  // Its floating control chrome therefore needs the real measured top inset;
  // a fixed Figma-canvas margin alone places the title beneath the status
  // icons on an actual HarmonyOS window.
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @StorageProp('reader.displayedRouteId') routeId: string = 'reader';
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.currentChapterTitle') currentChapterTitle: string = '';

  private bookTitle(): string {
    if (this.currentBook === null) return '';
    return this.currentBook.title.length > 0 ? this.currentBook.title : '';
  }

  private bookMeta(): string {
    if (this.currentBook === null) return '';
    const chapter = this.currentChapterTitle.length > 0
      ? this.currentChapterTitle : this.currentBook.latestChapter;
    const source = this.currentBook.sourceName;
    if (chapter.length > 0 && source.length > 0) return `${chapter} · ${source}`;
    if (chapter.length > 0) return chapter;
    if (source.length > 0) return source;
    return '';
  }

  private handleBack(): void {
    if (this.routeId === 'source-switch' || this.routeId === 'source-switch-results') {
      ReaderUiStore.dispatch({ type: 'route-pop' });
      return;
    }
    ReaderUiStore.requestReaderExit();
  }

  private wideViewport(): boolean {
    return ViewportAdapter.isWide(this.viewportWidth, this.viewportHeight);
  }

  private horizontalInset(): number {
    // `1023:18739` / `1023:18747`: 390px Phone uses 15px; 760px Tablet uses
    // 29px.  This bar deliberately follows the Figma root rather than a
    // generic safe-area card token.
    return this.wideViewport() ? 29 : 15;
  }

  private topInset(): number {
    return this.safeAreaTop + 19;
  }

  build() {
    Stack({ alignContent: Alignment.Top }) {
      Column() {
        Stack({ alignContent: Alignment.TopStart }) {
          Row({ space: 8 }) {
            Stack({ alignContent: Alignment.TopStart }) {
              Row() {
                Image($r('app.media.reader_control_top_back'))
                  .width(24)
                  .height(24)
              }
              .width(44)
              .height(42)
              .justifyContent(FlexAlign.Center)
              .alignItems(VerticalAlign.Center)
              .onClick(() => this.handleBack())
              InteractionDebugBadge({ label: 'back', tone: 'action', offsetTop: 22 })
            }
            .width(44)
            .height(42)

            Stack({ alignContent: Alignment.TopStart }) {
              Column({ space: 1 }) {
                Text(this.bookTitle())
                  .fontSize(16)
                  .fontWeight(700)
                  .fontColor(ReaderUiVisualTokens.readerControlInk)
                  .fontFamily(ReaderUiVisualTokens.readerControlTopFontFamily)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
                Text(this.bookMeta())
                  .fontSize(12)
                  .fontColor(ReaderUiVisualTokens.readerControlMuted)
                  .fontFamily(ReaderUiVisualTokens.readerControlTopFontFamily)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
              }
              .width('100%')
              .height(45)
              .justifyContent(FlexAlign.Center)
              .alignItems(HorizontalAlign.Start)
            }
            .layoutWeight(1)
            .height(42)

            if (canSwitchBookSourceId(this.currentBook?.sourceId)) {
              Stack({ alignContent: Alignment.TopStart }) {
                Column({ space: 0 }) {
                  Image($r('app.media.reader_control_top_source_switch'))
                    .width(20)
                    .height(20)
                  Text('换源')
                    .fontSize(12)
                    .fontWeight(800)
                    .fontColor(ReaderUiVisualTokens.readerControlInk)
                    .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
                }
                .width(62)
                .height(42)
                .justifyContent(FlexAlign.Center)
                .alignItems(HorizontalAlign.Center)
                .onClick(() => ReaderUiStore.requestSourceSwitchOpen())
                InteractionDebugBadge({ label: 'source', tone: 'action' })
              }
              .width(62)
              .height(42)
            }

            Stack({ alignContent: Alignment.TopStart }) {
              Row() {
                Image($r('app.media.reader_control_top_more')).width(20).height(20)
              }
              .width(34)
              .height(42)
              .justifyContent(FlexAlign.Center)
              .alignItems(VerticalAlign.Center)
              // Reader-UI owns this as a semantic Reader control overlay.
              // This is deliberately not the bookshelf long-press/action menu
              // and it must not invent a route while control-home is blocked.
              .accessibilityText('打开阅读控制栏')
              .onClick(() => requestReaderControlToggle())
              InteractionDebugBadge({ label: 'more', tone: 'action' })
            }
            .width(34)
            .height(42)
          }
          .width('100%')
          .height(54)
          .padding({ left: 13, right: 13, top: 6, bottom: 6 })
          .border({ width: 1, color: ReaderUiVisualTokens.readerControlBorder })
          .borderRadius(24)
          .backgroundColor(ReaderUiVisualTokens.readerControlSurface)
          InteractionDebugFrame({ label: 'ReaderTopBar', tone: 'module' })
        }
        .width('100%')
        .height(54)
      }
      .width('100%')
      .padding({ left: this.horizontalInset(), right: this.horizontalInset() })
      .margin({ top: this.topInset() })
    }
    .width('100%')
    .height('100%')
    // Only the visible top-bar controls own taps. The full-screen positioning
    // host must let exposed reading-area taps reach ReaderControlDismissZone.
    .hitTestBehavior(HitTestMode.Transparent)
  }
}

// .fd-immersive-hotzone: prev 26% / center 48% / next 26%. Center toggles the
// semantic reader-control overlay without changing route identity; side zones
// dispatch page prev/next.
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
        requestReaderControlToggle();
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

// Exact Reader/SessionCapsule (1164:10275).  Hidden is owned by the footer;
// only AutoPage and TTS have a rendered capsule.  This intentionally has no
// generic "reading" state, emoji, or local surface tokens.
@Component
export struct SessionCapsule {
  @StorageProp('reader.activeSession') activeSession: string = '';
  @StorageProp('reader.ttsSession.playback') ttsPlayback: string = 'idle';
  @StorageProp('reader.autoPageSession.playing') autoPagePlaying: boolean = false;
  @StorageProp('reader.autoPageSession.countdownSeconds') countdown: number = 0;
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  private isVisible(): boolean {
    return this.activeSession === 'auto-page' || this.activeSession === 'tts';
  }

  private isAutoPage(): boolean {
    return this.activeSession === 'auto-page';
  }

  private capsuleWidth(): number {
    return this.isAutoPage()
      ? ReaderUiVisualTokens.readerSessionCapsuleAutoWidth
      : ReaderUiVisualTokens.readerSessionCapsuleTtsWidth;
  }

  private isPlaying(): boolean {
    if (this.activeSession === 'tts') return this.ttsPlayback === 'playing';
    if (this.activeSession === 'auto-page') return this.autoPagePlaying;
    return false;
  }

  private toggleTransport(): void {
    MotionAdapter.apply('reader.session.capsule.control.press-toggle', this.reducedMotion, this.getUIContext(), () => {
      if (this.activeSession === 'tts') {
        // The native TextToSpeechEngine exposes stop, not a reliable pause /
        // resume boundary. Never present a fake paused playback state.
        ReaderUiStore.dispatch({ type: 'reader-tts-stop' });
      } else if (this.activeSession === 'auto-page') {
        ReaderUiStore.dispatch({ type: 'auto-page-toggle' });
      }
    });
  }

  private openSessionPanel(): void {
    MotionAdapter.apply('reader.session.capsule.update', this.reducedMotion, this.getUIContext(), () => {
      if (this.activeSession === 'tts') {
        ReaderUiStore.dispatch({ type: 'route-push', id: 'reader-full-tts' });
      } else if (this.activeSession === 'auto-page') {
        ReaderUiStore.dispatch({ type: 'route-push', id: 'reader-full-settings' });
      }
    });
  }

  build() {
    if (this.isVisible()) {
      Row({ space: ReaderUiVisualTokens.readerSessionCapsuleGap }) {
        if (this.isAutoPage()) {
          Text(`${Math.max(0, this.countdown)}`)
            .width(ReaderUiVisualTokens.readerSessionCapsuleCountdownWidth)
            .height(ReaderUiVisualTokens.readerSessionCapsuleCountdownHeight)
            .fontSize(ReaderUiVisualTokens.readerSessionCapsuleCountdownSize)
            .lineHeight(ReaderUiVisualTokens.readerSessionCapsuleCountdownSize)
            .fontWeight(900)
            .fontColor(ReaderUiVisualTokens.readerSessionCapsulePrimaryInk)
            .fontFamily(ReaderUiVisualTokens.readerSessionCapsuleFontFamily)
            .textAlign(TextAlign.Center)
            .borderRadius(ReaderUiVisualTokens.readerSessionCapsuleRadius)
            .backgroundColor(ReaderUiVisualTokens.readerSessionCapsulePrimary)
        } else {
          Stack({ alignContent: Alignment.Center }) {
            Image($r('app.media.figma_reader_session_tts'))
              .width(ReaderUiVisualTokens.readerSessionCapsuleTtsIconSize)
              .height(ReaderUiVisualTokens.readerSessionCapsuleTtsIconSize)
          }
          .width(ReaderUiVisualTokens.readerSessionCapsuleCountdownHeight)
          .height(ReaderUiVisualTokens.readerSessionCapsuleCountdownHeight)
        }
        Text(this.isAutoPage() ? '自动翻页' : '朗读')
          .width(42)
          .height(ReaderUiVisualTokens.readerSessionCapsuleLabelLineHeight)
          .fontSize(ReaderUiVisualTokens.readerSessionCapsuleLabelSize)
          .lineHeight(ReaderUiVisualTokens.readerSessionCapsuleLabelLineHeight)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.readerSessionCapsuleInk)
          .fontFamily(ReaderUiVisualTokens.readerSessionCapsuleFontFamily)
          .textAlign(TextAlign.Center)
        Stack({ alignContent: Alignment.Center }) {
          if (this.isPlaying()) {
            Image($r('app.media.figma_reader_session_pause'))
              .width(ReaderUiVisualTokens.readerSessionCapsuleActionIconSize)
              .height(ReaderUiVisualTokens.readerSessionCapsuleActionIconSize)
          } else {
            Image($r('app.media.figma_reader_session_play'))
              .width(ReaderUiVisualTokens.readerSessionCapsuleActionIconSize)
              .height(ReaderUiVisualTokens.readerSessionCapsuleActionIconSize)
          }
        }
        .width(ReaderUiVisualTokens.readerSessionCapsuleActionSize)
        .height(ReaderUiVisualTokens.readerSessionCapsuleActionSize)
        .borderRadius(ReaderUiVisualTokens.readerSessionCapsuleRadius)
        .backgroundColor(ReaderUiVisualTokens.readerSessionCapsulePrimary)
        .onClick(() => this.toggleTransport())
      }
      .width(this.capsuleWidth())
      .height(ReaderUiVisualTokens.readerSessionCapsuleHeight)
      .padding({
        left: ReaderUiVisualTokens.readerSessionCapsuleHorizontalPadding,
        right: ReaderUiVisualTokens.readerSessionCapsuleHorizontalPadding,
      })
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .borderRadius(ReaderUiVisualTokens.readerSessionCapsuleRadius)
      .backgroundColor(ReaderUiVisualTokens.readerSessionCapsuleSurface)
      .border({ width: 1, color: ReaderUiVisualTokens.readerSessionCapsuleBorder })
      .shadow({ radius: 8, color: ReaderUiVisualTokens.readerSessionCapsuleShadow, offsetX: 0, offsetY: 3 })
      .onClick(() => this.openSessionPanel())
    }
  }
}

@Component
export struct ReaderControlDismissZone {
  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      InteractionDebugFrame({ label: 'ControlDismissZone', tone: 'module' })
    }
    .width('100%')
    .height('100%')
    .accessibilityText('隐藏阅读控制层')
    // Reader-UI renders this as the full-screen data-reader-dismiss zone
    // behind the visible control-home layers. Hiding the controls changes only
    // the semantic overlay and must never pop or replace the reading route.
    .onClick(() => requestReaderControlToggle())
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
  // `scroll` is the one Figma PageStyle choice that selects the native
  // vertical reading surface.  In that mode the Scroll must receive the
  // gesture directly; an invisible page-turn hot-zone above it would make a
  // long chapter look like a single, non-scrollable page.
  @StorageProp('reader.paginationMode') paginationMode: string = 'horizontal';
  // This flag comes only from the generated Reader-UI ViewState contract for
  // reader.reading-surface. It deliberately renders the frozen
  // Reader/Responsive/ReadingSurface and does not pull in the independently
  // quarantined control-home, top-area, footer, or generic state branches.
  @Prop canonicalReadingSurface: boolean = false;
  @Prop tapZoneContractBindingsDefined: boolean = false;
  @Prop tapZoneContractBindings: ViewStateExplicitBinding[] = [];

  private controlLayer(): boolean {
    return this.routeId !== 'immersive-reading' && this.routeId !== 'reader_content';
  }

  build() {
    Stack() {
      ReadingBackgroundLayer()
      ReadingTextFlow()
      if (this.canonicalReadingSurface) {
        // The canonical master contains the paper and text frame only. Tap
        // zones are invisible behavior-owned hit targets; they preserve the
        // existing Reader-UI pagination events without adding an unbound
        // visual control layer. Vertical reading receives gestures directly
        // from ReadingTextFlow's Scroll.
        if (this.paginationMode !== 'vertical') {
          TapZones({
            contractBindingsDefined: this.tapZoneContractBindingsDefined,
            contractBindings: this.tapZoneContractBindings,
          })
        }
      } else if (this.controlLayer()) {
        ReaderControlDismissZone()
      } else {
        // The Scroll's own click handler still opens the control layer in
        // vertical reading.  Do not layer horizontal page-turn targets over
        // it, otherwise their gesture recognizers intercept scrolling.
        if (this.paginationMode !== 'vertical') {
          TapZones({
            contractBindingsDefined: this.tapZoneContractBindingsDefined,
            contractBindings: this.tapZoneContractBindings,
          })
        }
        // Must sit above the transparent tap zones so the current Figma
        // footer session capsule remains an actual in-app control.
        ReadingInfoLayer()
      }
    }
    .width('100%')
    .height('100%')
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}
