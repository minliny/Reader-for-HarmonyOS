import { readerThemeDefinition } from '../common/ReaderThemeRegistry';
import { readerHighlightCanvasColor, readerDynamicHighlightRectsEqual, ReaderHighlightTextCache,
  type ReaderHighlightTextSlice, type ReaderDynamicHighlightRect } from './ReaderDynamicHighlight';
import { FrameCallback } from '@kit.ArkUI';
import { text as graphicsText } from '@kit.ArkGraphics2D';
import type { image } from '@kit.ImageKit';
import { copyReaderSelection } from '../../app/ReaderClipboardHost';
import { readerSelectedOriginalText } from './ReaderTextSelectionProjection';
import { registerReaderFonts } from '../common/ReaderFonts';
import { TYPE_READER_CHAPTER_TITLE } from '../common/ReaderTypography';
import {
  createDefaultReaderAppearanceSnapshot,
  type ReaderAppearanceSnapshot,
} from './ReaderAppearanceState';
import {
  readerAppearanceSnapshotFontFamily,
  readerAppearanceLineHeight,
  readerAppearanceParagraphIndentPrefix,
  readerAppearanceThemeStyle,
  readerAppearanceUsesJustify,
  type ReaderAppearanceThemeStyle,
} from './ReaderAppearanceRenderStyle';
import {
  ReaderReadingLayoutSnapshot,
  createDefaultReaderReadingLayout,
} from './ReaderLayoutGeometry';
import { ReaderPageChrome } from './ReaderPageChrome';

export type { ReaderDynamicHighlightRect } from './ReaderDynamicHighlight';

class ReaderHighlightFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_time: number): void {}
}

/**
 * Figma-backed static reading body for `15 · Reader 2`:
 * - Phone `1023:18355` (390 × 844)
 * - TabletExpanded `1023:18371` (760 × 960)
 *
 * This is deliberately a presentation-only component. Its caller supplies
 * Core-materialized page text and the exact exported Figma PaperLayer assets;
 * it has no Core commands, navigation, controls, pagination, or motion.
 *
 * The paper texture and two lighting overlays are direct Figma exports for
 * each viewport. They are static paint layers, not a motion implementation.
 */
/**
 * One already-measured physical page fragment. `isParagraphStart` preserves
 * the Figma paragraph contract when a single Core paragraph crosses a page:
 * only the original first line receives the configured 2em indent, and the
 * 15.8px gap belongs only between original paragraphs.
 */
export class ReadingSurfacePageFragment {
  id: string;
  text: string;
  isParagraphStart: boolean;
  startScalar: number;
  endScalar: number;
  imageSource: image.PixelMap | undefined;
  fileUri: string | undefined;
  imageHeight: number;
  layoutHeight: number;

  constructor(
    id: string,
    text: string,
    isParagraphStart: boolean,
    startScalar: number = 0,
    endScalar?: number,
    imageSource?: image.PixelMap,
    imageHeight: number = 0,
    fileUri?: string,
    layoutHeight: number = imageHeight,
  ) {
    this.id = id;
    this.text = text;
    this.isParagraphStart = isParagraphStart;
    this.startScalar = startScalar;
    this.endScalar = endScalar ?? startScalar + text.length;
    this.imageSource = imageSource;
    this.imageHeight = imageHeight;
    this.fileUri = fileUri;
    this.layoutHeight = layoutHeight;
  }
}

/** Shared scalar-aware text primitive for paged and continuous reading. */
@Component
export struct ReaderReadingTextFragment {
  @Prop @Watch('scheduleHighlightGeometry') text: string = '';
  @Prop isParagraphStart: boolean = false;
  @Prop @Watch('scheduleHighlightGeometry') startScalar: number = 0;
  @Prop @Watch('scheduleHighlightGeometry') endScalar: number = 0;
  @Prop @Watch('scheduleHighlightGeometry') appearance: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop @Watch('scheduleHighlightGeometry') ttsHighlightStart: number | undefined = undefined;
  @Prop @Watch('scheduleHighlightGeometry') ttsHighlightEnd: number | undefined = undefined;
  @Prop @Watch('scheduleHighlightGeometry') autoPageHighlightStart: number | undefined = undefined;
  @Prop @Watch('scheduleHighlightGeometry') autoPageHighlightEnd: number | undefined = undefined;
  @Prop @Watch('onTextSelectionEnabledChanged') longPressSelectText: boolean = false;
  @Prop @Watch('scheduleHighlightGeometry') separateHighlight: boolean = false;
  onHighlightGeometry: (key: number, rects: ReaderDynamicHighlightRect[]) => void =
    (_key: number, _rects: ReaderDynamicHighlightRect[]): void => {};
  queueHighlightMeasurement: ((action: () => void) => void) | undefined = undefined;
  private highlightTextCache: ReaderHighlightTextCache = new ReaderHighlightTextCache();
  private highlightHadGeometry: boolean = false;
  private highlightLifecycle: number = 0;
  private highlightMounted: boolean = false;
  private highlightQueued: boolean = false;
  private highlightGlobalX: number = 0;
  private highlightGlobalY: number = 0;
  aboutToAppear(): void { this.highlightMounted = true; this.highlightLifecycle += 1; this.scheduleHighlightGeometry(); }
  private readonly textController: TextController = new TextController();

  aboutToDisappear(): void {
    this.highlightMounted = false; this.highlightLifecycle += 1; this.highlightQueued = false;
    this.highlightHadGeometry = false;
    if (this.separateHighlight) this.onHighlightGeometry(this.startScalar, []);
    this.textController.closeSelectionMenu();
  }

  build() {
    Text(undefined, { controller: this.textController }) {
      if (this.indentPrefix().length > 0) {
        Span(this.indentPrefix());
      }
      if (this.highlightPrefix().length > 0) {
        Span(this.highlightPrefix());
      }
      if (this.highlightBody().length > 0) {
        if (this.separateHighlight) {
          Span(this.highlightBody());
        } else if (this.usesTtsHighlight()) {
          Span(this.highlightBody())
            .decoration({ type: TextDecorationType.Underline, color: this.themeStyle().ink });
        } else {
          Span(this.highlightBody())
            .textBackgroundStyle({ color: readerThemeDefinition(this.appearance.activeTheme).selection, radius: 2 });
        }
      }
      if (this.highlightSuffix().length > 0) {
        Span(this.highlightSuffix());
      }
    }
      .width('100%')
      .fontFamily(readerAppearanceSnapshotFontFamily(this.appearance))
      .fontWeight(FontWeight.Regular)
      .fontSize(this.appearance.fontSize)
      .lineHeight(readerAppearanceLineHeight(this.appearance))
      .letterSpacing(this.appearance.letterSpacing)
      .fontColor(this.themeStyle().ink)
      .copyOption(this.longPressSelectText ? CopyOptions.InApp : CopyOptions.None)
      .editMenuOptions({
        onCreateMenu: (items: Array<TextMenuItem>): Array<TextMenuItem> => items,
        onMenuItemClick: (item: TextMenuItem, range: TextRange): boolean => this.onTextMenuItemClick(item, range),
      })
      .selectedBackgroundColor(readerThemeDefinition(this.appearance.activeTheme).selection)
      .textAlign(readerAppearanceUsesJustify(this.appearance.alignment) ? TextAlign.JUSTIFY : TextAlign.Start)
      .onAreaChange((_old: Area, area: Area): void => {
        this.highlightGlobalX = Number.parseFloat(`${area.globalPosition.x}`);
        this.highlightGlobalY = Number.parseFloat(`${area.globalPosition.y}`);
        this.scheduleHighlightGeometry();
      });
  }

  private scheduleHighlightGeometry(): void {
    if (!this.highlightMounted || !this.separateHighlight || this.highlightQueued) return;
    const range = this.highlightRange();
    if (range.endUtf16 <= range.startUtf16 && !this.highlightHadGeometry) return;
    this.highlightQueued = true;
    const lifecycle = this.highlightLifecycle;
    const action = (): void => {
      if (!this.highlightMounted || lifecycle !== this.highlightLifecycle) return;
      this.highlightQueued = false;
      if (this.separateHighlight) this.measureHighlightGeometry();
    };
    // All fragments measure and paint in their page owner's single frame.
    if (this.queueHighlightMeasurement !== undefined) this.queueHighlightMeasurement(action);
    else this.getUIContext().postFrameCallback(new ReaderHighlightFrame(action));
  }

  private measureHighlightGeometry(): void {
    const range = this.highlightRange();
    const rects: ReaderDynamicHighlightRect[] = [];
    if (range.endUtf16 > range.startUtf16) {
      try {
        const inset = this.indentPrefix().length;
        const boxes = this.textController.getLayoutManager().getRectsForRange(
          { start: range.startUtf16 + inset, end: range.endUtf16 + inset },
          graphicsText.RectWidthStyle.TIGHT, graphicsText.RectHeightStyle.TIGHT);
        const context = this.getUIContext();
        const underline = this.usesTtsHighlight();
        for (const box of boxes) {
          const rect = box.rect;
          const bottom = this.highlightGlobalY + context.px2vp(rect.bottom);
          rects.push({ left: this.highlightGlobalX + context.px2vp(rect.left),
            top: underline ? bottom - 1.5 : this.highlightGlobalY + context.px2vp(rect.top),
            right: this.highlightGlobalX + context.px2vp(rect.right), bottom,
            color: underline ? this.themeStyle().ink : readerThemeDefinition(this.appearance.activeTheme).selection, multiply: !underline });
        }
      } catch (_error) { /* The next layout callback supplies exact glyph bounds. */ }
    }
    this.highlightHadGeometry = rects.length > 0;
    this.onHighlightGeometry(this.startScalar, rects);
  }

  private onTextSelectionEnabledChanged(): void {
    if (!this.longPressSelectText) {
      this.textController.closeSelectionMenu();
    }
  }

  private onTextMenuItemClick(item: TextMenuItem, range: TextRange): boolean {
    if (!item.id.equals(TextMenuItemId.COPY)) return false;
    // Consume stale copy actions too, so a dismissed selection cannot copy
    // a newly rendered fragment or fall through to the synthetic display text.
    if (!this.longPressSelectText) return true;
    const selected = readerSelectedOriginalText(this.text, this.indentPrefix().length, range.start, range.end);
    if (selected === undefined || selected.length === 0) return true;
    try {
      copyReaderSelection(selected);
      this.textController.closeSelectionMenu();
    } catch (_) {
      this.getUIContext().getPromptAction().showToast({ message: '复制失败，请重试' });
    }
    return true;
  }

  private indentPrefix(): string {
    return this.isParagraphStart ? readerAppearanceParagraphIndentPrefix(this.appearance.indent) : '';
  }

  private highlightPrefix(): string { return this.highlightRange().prefix; }
  private highlightBody(): string { return this.highlightRange().body; }
  private highlightSuffix(): string { return this.highlightRange().suffix; }

  private usesTtsHighlight(): boolean {
    const start = this.ttsHighlightStart;
    const end = this.ttsHighlightEnd;
    return start !== undefined && end !== undefined && Number.isFinite(start) &&
      Number.isFinite(end) && end > start;
  }

  private highlightRange(): ReaderHighlightTextSlice {
    return this.highlightTextCache.sample(this.text, this.startScalar, this.endScalar,
      this.usesTtsHighlight() ? this.ttsHighlightStart : this.autoPageHighlightStart,
      this.usesTtsHighlight() ? this.ttsHighlightEnd : this.autoPageHighlightEnd);
  }

  private themeStyle(): ReaderAppearanceThemeStyle {
    return readerAppearanceThemeStyle(this.appearance.activeTheme);
  }
}

@Component
export struct ReadingSurface {
  // Only the idle offscreen snapshot lane opts in; ordinary reading remains asynchronous.
  @Prop snapshotSynchronousImages: boolean = false;
  /** Core-materialized title for the current pagination-manifest page. */
  @Prop chapterTitle: string;
  /** The semantic chapter heading belongs only to the first physical page. */
  @Prop showChapterTitle: boolean = true;
  /**
   * Exact paragraph slices selected by the local pagination manifest for this
   * page. Each string is rendered verbatim: Core/newline/scalar normalization
   * is never repeated by the presentation layer.
   */
  @Prop pageParagraphs: string[] = [];
  /**
   * Preferred physical-page input. It is produced by the feature-local
   * measurement pass, rather than by this presentation component.
   */
  @Prop @Watch('onHighlightContentChanged') pageFragments: ReadingSurfacePageFragment[] = [];
  @Prop @Watch('onHighlightContentChanged') contentRevision: number = 0;
  @Prop @Watch('onHighlightContentChanged') staticSnapshotId: string = '';
  @Prop @Watch('onHighlightContentChanged') highlightTextureIdentity: string = '';
  onDynamicHighlights: (identity: string, rects: ReaderDynamicHighlightRect[]) => void =
    (_identity: string, _rects: ReaderDynamicHighlightRect[]): void => {};
  private highlightRects: Map<string, ReaderDynamicHighlightRect[]> = new Map();
  private readonly highlightCanvas: CanvasRenderingContext2D = new CanvasRenderingContext2D(new RenderingContextSettings(true));
  private highlightCanvasReady: boolean = false;
  private highlightMounted: boolean = false;
  private highlightLifecycle: number = 0;
  private highlightDrawQueued: boolean = false;
  private highlightDraining: boolean = false;
  private highlightMeasurements: Array<() => void> = [];
  private highlightLiveRevision: number = -1;
  private highlightLiveFragments: ReadingSurfacePageFragment[] | undefined = undefined;
  private highlightLiveIds: Set<string> = new Set();
  private highlightPainted: ReaderDynamicHighlightRect[] = [];
  private highlightPaintWidth: number = -1;
  private highlightPaintHeight: number = -1;
  private highlightPublishedIdentity: string = '';
  private highlightPublished: ReaderDynamicHighlightRect[] = [];
  private highlightPublishWidth: number = -1;
  private highlightPublishHeight: number = -1;
  private highlightRootX: number = 0;
  private highlightRootY: number = 0;
  fragmentsProvider: (() => ReadingSurfacePageFragment[]) | undefined = undefined;
  /** One owner-computed viewport/safe-area contract shared with pagination. */
  @Prop @Watch('onHighlightContentChanged') layout: ReaderReadingLayoutSnapshot = createDefaultReaderReadingLayout();
  /** UI-owned persisted appearance snapshot; no business/content state lives here. */
  @Prop appearance: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop ttsHighlightStart: number | undefined = undefined;
  @Prop ttsHighlightEnd: number | undefined = undefined;
  @Prop autoPageHighlightStart: number | undefined = undefined;
  @Prop autoPageHighlightEnd: number | undefined = undefined;
  /** Per-gap full-page adjustment; zero for short/image-ending pages. */
  @Prop bottomJustifyGap: number = 0;
  @Prop longPressSelectText: boolean = false;
  @Prop chromeTopStartText: string = '';
  @Prop chromeTopEndText: string = '';
  @Prop chromeBottomStartText: string = '';
  @Prop chromeBottomEndText: string = '';
  @Prop chromeSessionVisible: boolean = false;
  @Prop chromeSessionWidth: number = 0;
  @Prop chromeSessionHeight: number = 0;

  aboutToAppear(): void {
    this.highlightMounted = true; this.highlightLifecycle += 1;
    registerReaderFonts(this.getUIContext().getFont());
  }

  aboutToDisappear(): void {
    this.highlightMounted = false; this.highlightLifecycle += 1;
    this.highlightDrawQueued = false; this.highlightCanvasReady = false;
    this.highlightMeasurements = []; this.highlightRects.clear();
    this.highlightLiveFragments = undefined; this.highlightLiveIds.clear();
    this.highlightPublishedIdentity = ''; this.highlightPaintWidth = -1;
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
      // The Figma background-image list is painted front-to-back: texture,
      // gradient, highlight, shade. Stack children paint back-to-front, so
      // keep the equivalent order explicit here rather than coalescing the
      // texture with the gradient and accidentally covering it with lighting.
      if (this.themeStyle().sourcePaperLighting) {
        Image(this.paperShade())
          .syncLoad(this.snapshotSynchronousImages)
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Fill)
          .interpolation(ImageInterpolation.High);

        Image(this.paperHighlight())
          .syncLoad(this.snapshotSynchronousImages)
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Fill)
          .interpolation(ImageInterpolation.High);
      }

      Stack() {
      }
        .width('100%')
        .height('100%')
        .linearGradient({
          direction: GradientDirection.Bottom,
          colors: [[this.themeStyle().paperStart, 0], [this.themeStyle().paperEnd, 1]],
        });

      if (this.themeStyle().paperTexture) {
        Stack() {
        }
          .width('100%')
          .height('100%')
          .backgroundImage(this.paperTexture(), ImageRepeat.XY)
          .backgroundImageSize({ width: 100, height: 100 })
          .backgroundImagePosition(Alignment.TopStart);
      }

      Column({ space: this.layout.titleToBodySpacingVp }) {
        if (this.showChapterTitle) {
          Text(this.chapterTitle)
            .width('100%')
            .fontFamily(TYPE_READER_CHAPTER_TITLE.fontFamily)
            .fontWeight(TYPE_READER_CHAPTER_TITLE.fontWeight)
            .fontSize(TYPE_READER_CHAPTER_TITLE.fontSizeFp)
            .lineHeight(this.layout.titleLineHeightFp)
            .fontColor(this.themeStyle().ink)
            .textAlign(TextAlign.Center)
            .wordBreak(WordBreak.BREAK_ALL);
        }

        Column() {
          if (this.renderFragments().length > 0) {
            ForEach(this.renderFragments(), (fragment: ReadingSurfacePageFragment, index: number) => {
              if (index > 0 && this.bottomJustifyGap > 0) {
                Blank().height(this.bottomJustifyGap);
              }
              // A continuation is not a new semantic paragraph: it must not
              // acquire either a fresh 15.8px gap or a second 2em indent.
              if (index > 0 && fragment.isParagraphStart) {
                Blank().height(this.appearance.paragraphSpacing);
              }
              if (fragment.fileUri !== undefined && fragment.fileUri.length > 0) {
                Image(fragment.fileUri)
          .syncLoad(this.snapshotSynchronousImages)
                  .width('100%')
                  .height(fragment.imageHeight)
                  .objectFit(ImageFit.Contain)
                  .interpolation(ImageInterpolation.High);
              } else if (fragment.imageSource !== undefined) {
                Image(fragment.imageSource)
          .syncLoad(this.snapshotSynchronousImages)
                  .width('100%')
                  .height(fragment.imageHeight)
                  .objectFit(ImageFit.Contain)
                  .interpolation(ImageInterpolation.High);
              } else if (fragment.imageHeight > 0) {
                // One stable, measurable failed-resource block. Resource
                // failure must not discard the rest of the chapter.
                Blank().height(fragment.imageHeight);
              } else {
                ReaderReadingTextFragment({
                  text: fragment.text,
                  isParagraphStart: fragment.isParagraphStart,
                  startScalar: fragment.startScalar,
                  endScalar: fragment.endScalar,
                  appearance: this.appearance,
                  ttsHighlightStart: this.ttsHighlightStart,
                  ttsHighlightEnd: this.ttsHighlightEnd,
                  autoPageHighlightStart: this.autoPageHighlightStart,
                  autoPageHighlightEnd: this.autoPageHighlightEnd,
                  longPressSelectText: this.longPressSelectText,
                  separateHighlight: this.staticSnapshotId.length > 0,
                  queueHighlightMeasurement: (action: () => void): void => this.enqueueHighlightMeasurement(action),
                  onHighlightGeometry: (key: number, rects: ReaderDynamicHighlightRect[]): void => {
                    this.acceptHighlightGeometry(fragment.id, rects);
                  },
                });
              }
            }, (fragment: ReadingSurfacePageFragment): string => fragment.id);
          } else {
            // Retain the original public input for existing static callers.
            ForEach(this.pageParagraphs, (paragraph: string, index: number) => {
              if (index > 0) {
                Blank().height(this.appearance.paragraphSpacing);
              }
              ReaderReadingTextFragment({
                text: paragraph,
                isParagraphStart: true,
                startScalar: 0,
                endScalar: Array.from(paragraph).length,
                appearance: this.appearance,
                ttsHighlightStart: this.ttsHighlightStart,
                ttsHighlightEnd: this.ttsHighlightEnd,
                autoPageHighlightStart: this.autoPageHighlightStart,
                autoPageHighlightEnd: this.autoPageHighlightEnd,
                longPressSelectText: this.longPressSelectText,
              });
            }, (paragraph: string, index: number): string => `${index}:${paragraph}`);
          }
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start);
      }
      .width('100%')
      .height('100%')
      .padding(this.contentInsets())
      .clip(true);
      }
      .width('100%')
      .height('100%')
      .clip(true);

      ReaderPageChrome({
        topStartText: this.chromeTopStartText,
        topEndText: this.chromeTopEndText,
        bottomStartText: this.chromeBottomStartText,
        bottomEndText: this.chromeBottomEndText,
        sessionVisible: this.chromeSessionVisible,
        sessionWidth: this.chromeSessionWidth,
        sessionHeight: this.chromeSessionHeight,
        layout: this.layout,
        appearance: this.appearance,
      });
      }
      .width('100%').height('100%')
      .backgroundColor(this.themeStyle().paperStart)
      .id(this.staticSnapshotId.length > 0 ? this.staticSnapshotId : undefined);
      // Offscreen static rasters and ordinary inline-highlight pages do not
      // need a full-viewport Canvas. Hidden Canvas nodes still carry native
      // backing resources and add GC/disposal work after texture capture.
      if (this.staticSnapshotId.length > 0) {
      Canvas(this.highlightCanvas)
        .blendMode(this.dynamicHighlightBlend(), BlendApplyType.FAST)
        .width('100%').height('100%').enabled(false).hitTestBehavior(HitTestMode.None)
        .onReady((): void => {
          this.highlightCanvasReady = true; this.highlightPaintWidth = -1; this.scheduleDynamicHighlights();
        });
      }
    }
    .width('100%')
    .height('100%')
    .onAreaChange((_old: Area, area: Area): void => {
      this.highlightRootX = Number.parseFloat(`${area.globalPosition.x}`);
      this.highlightRootY = Number.parseFloat(`${area.globalPosition.y}`);
      this.scheduleDynamicHighlights();
    })
    // Keep the reading surface opaque while text/images are being reconciled.
    // This theme-owned paper base prevents a transient empty child tree from
    // revealing the Index/root background during page promotion.
    .backgroundColor(this.themeStyle().paperStart)
    .clip(true);
  }

  private onHighlightContentChanged(): void {
    if (this.staticSnapshotId.length === 0) this.highlightCanvasReady = false;
    this.scheduleDynamicHighlights();
  }

  private enqueueHighlightMeasurement(action: () => void): void {
    if (!this.highlightMounted) return;
    this.highlightMeasurements.push(action);
    this.scheduleDynamicHighlights();
  }

  private acceptHighlightGeometry(key: string, rects: ReaderDynamicHighlightRect[]): void {
    const previous = this.highlightRects.get(key);
    if (rects.length === 0 && previous === undefined) return;
    if (previous !== undefined && readerDynamicHighlightRectsEqual(previous, rects)) return;
    if (rects.length === 0) this.highlightRects.delete(key);
    else this.highlightRects.set(key, rects);
    if (!this.highlightDraining) this.scheduleDynamicHighlights();
  }

  private scheduleDynamicHighlights(): void {
    if (!this.highlightMounted || !this.highlightCanvasReady || this.staticSnapshotId.length === 0 ||
      this.highlightDrawQueued || this.highlightDraining) return;
    this.highlightDrawQueued = true;
    const lifecycle = this.highlightLifecycle;
    this.getUIContext().postFrameCallback(new ReaderHighlightFrame((): void => {
      if (!this.highlightMounted || lifecycle !== this.highlightLifecycle) return;
      this.highlightDrawQueued = false;
      const pending = this.highlightMeasurements;
      this.highlightMeasurements = [];
      this.highlightDraining = true;
      try {
        for (const action of pending) action();
        this.drawDynamicHighlights();
      } finally { this.highlightDraining = false; }
    }));
  }

  private dynamicHighlightBlend(): BlendMode {
    const start = this.ttsHighlightStart;
    const end = this.ttsHighlightEnd;
    return start !== undefined && end !== undefined && Number.isFinite(start) &&
      Number.isFinite(end) && end > start ? BlendMode.SRC_OVER : BlendMode.MULTIPLY;
  }

  private drawDynamicHighlights(): void {
    if (!this.highlightCanvasReady || this.staticSnapshotId.length === 0) return;
    const canvas = this.highlightCanvas;
    const result: ReaderDynamicHighlightRect[] = [];
    if (this.highlightRects.size > 0) {
      const fragments = this.renderFragments();
      if (this.highlightLiveRevision !== this.contentRevision || this.highlightLiveFragments !== fragments) {
        this.highlightLiveRevision = this.contentRevision; this.highlightLiveFragments = fragments;
        this.highlightLiveIds = new Set<string>(fragments.map((fragment: ReadingSurfacePageFragment): string => fragment.id));
      }
      const live = this.highlightLiveIds;
      this.highlightRects.forEach((rects: ReaderDynamicHighlightRect[], key: string): void => {
        if (!live.has(key)) { this.highlightRects.delete(key); return; }
        for (const source of rects) {
          const rect: ReaderDynamicHighlightRect = {
            left: Math.max(0, source.left - this.highlightRootX), top: Math.max(0, source.top - this.highlightRootY),
            right: Math.min(this.layout.viewportWidth, source.right - this.highlightRootX),
            bottom: Math.min(this.layout.viewportHeight, source.bottom - this.highlightRootY),
            color: source.color, multiply: source.multiply };
          if (rect.right <= rect.left || rect.bottom <= rect.top) continue;
          result.push(rect);
        }
      });
    }
    const width = this.layout.viewportWidth;
    const height = this.layout.viewportHeight;
    if (this.highlightPaintWidth !== width || this.highlightPaintHeight !== height ||
      !readerDynamicHighlightRectsEqual(this.highlightPainted, result)) {
      canvas.clearRect(0, 0, width, height);
      for (const rect of result) {
        canvas.globalCompositeOperation = 'source-over';
        canvas.fillStyle = readerHighlightCanvasColor(rect.color);
        canvas.fillRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
      }
      this.highlightPainted = result; this.highlightPaintWidth = width; this.highlightPaintHeight = height;
    }
    if (this.highlightPublishedIdentity !== this.highlightTextureIdentity || this.highlightPublishWidth !== width ||
      this.highlightPublishHeight !== height || !readerDynamicHighlightRectsEqual(this.highlightPublished, result)) {
      this.highlightPublishedIdentity = this.highlightTextureIdentity; this.highlightPublished = result;
      this.highlightPublishWidth = width; this.highlightPublishHeight = height;
      this.onDynamicHighlights(this.highlightTextureIdentity, result);
    }
  }

  private renderFragments(): ReadingSurfacePageFragment[] {
    // Primitive revision invalidates the slot; the provider reads its current
    // owner rather than a complex array copied when the slot first mounted.
    return this.contentRevision >= 0 && this.fragmentsProvider !== undefined ?
      this.fragmentsProvider() : this.pageFragments;
  }

  private contentInsets(): Padding {
    return {
      top: this.layout.contentTop,
      right: this.layout.contentRight,
      bottom: this.layout.contentBottom,
      left: this.layout.contentLeft,
    };
  }

  private paperTexture(): Resource {
    return this.layout.widthClass === 'expanded' ?
      $r('app.media.reading_paper_tablet') : $r('app.media.reading_paper_phone');
  }

  private paperHighlight(): Resource {
    return this.layout.widthClass === 'expanded' ? $r('app.media.reading_paper_tablet_highlight') :
      $r('app.media.reading_paper_phone_highlight');
  }

  private paperShade(): Resource {
    return this.layout.widthClass === 'expanded' ? $r('app.media.reading_paper_tablet_shade') :
      $r('app.media.reading_paper_phone_shade');
  }

  private themeStyle(): ReaderAppearanceThemeStyle {
    return readerAppearanceThemeStyle(this.appearance.activeTheme);
  }
}
