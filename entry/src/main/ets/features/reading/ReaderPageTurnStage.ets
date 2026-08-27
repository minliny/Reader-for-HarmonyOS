import {
  createDefaultReaderAppearanceSnapshot,
  type ReaderAppearanceSnapshot,
} from './ReaderAppearanceState';
import {
  createDefaultReaderReadingLayout,
  type ReaderReadingLayoutSnapshot,
} from './ReaderLayoutGeometry';
import {
  createDefaultReaderSettingsSnapshot,
  readerPageTurnStyle,
  type ReaderPageTurnStyle,
} from './ReaderSettingsState';
import {
  ReadingSurface,
  type ReadingSurfacePageFragment,
} from './ReadingSurface';
import { ReaderPageChromeSnapshot } from './ReaderPageChromeModel';
import {
  ReaderNativePageCurlSurface,
  type ReaderNativePageCurlContext,
} from './ReaderNativePageCurlSurface';

/**
 * Immutable-by-convention input for one already measured physical page.
 *
 * Pagination and progress remain owned by LocalReadingExperience. The stage
 * only places these presentation models next to one another for a slide.
 */
export class ReaderPageTurnRenderPage {
  identity: string;
  chapterTitle: string;
  showChapterTitle: boolean;
  fragments: ReadingSurfacePageFragment[];
  bottomJustifyGap: number;
  chromeTopStartText: string;
  chromeTopEndText: string;
  chromeBottomStartText: string;
  chromeBottomEndText: string;
  chromeSessionVisible: boolean;
  chromeSessionWidth: number;
  chromeSessionHeight: number;
  bodyRasterKey: string;
  chromeRasterKey: string;
  composedTextureKey: string;

  constructor(
    identity: string,
    chapterTitle: string,
    showChapterTitle: boolean,
    fragments: ReadingSurfacePageFragment[],
    bottomJustifyGap: number = 0,
    chrome: ReaderPageChromeSnapshot = new ReaderPageChromeSnapshot(),
    bodyRasterKey: string = '',
    chromeRasterKey: string = '',
    composedTextureKey: string = '',
  ) {
    this.identity = identity;
    this.chapterTitle = chapterTitle;
    this.showChapterTitle = showChapterTitle;
    this.fragments = fragments;
    this.bottomJustifyGap = bottomJustifyGap;
    this.chromeTopStartText = chrome.topStartText;
    this.chromeTopEndText = chrome.topEndText;
    this.chromeBottomStartText = chrome.bottomStartText;
    this.chromeBottomEndText = chrome.bottomEndText;
    this.chromeSessionVisible = chrome.sessionVisible;
    this.chromeSessionWidth = chrome.sessionWidth;
    this.chromeSessionHeight = chrome.sessionHeight;
    this.bodyRasterKey = bodyRasterKey;
    this.chromeRasterKey = chromeRasterKey;
    this.composedTextureKey = composedTextureKey;
  }

  bodyComponentId(): string {
    return `${this.identity}:body`;
  }

  chromeComponentId(): string {
    return `${this.identity}:chrome`;
  }

  composedComponentId(): string {
    return `${this.identity}:composed`;
  }
}

export type ReaderPageTurnStageDirection = 'previous' | 'next';

/**
 * One stage slot with only primitive/array inputs.
 *
 * ArkUI V1 parameterized @Builder functions copy complex objects by value;
 * forwarding ReaderPageTurnRenderPage through that path and then mounting a
 * child @Component can leave the first frame permanently bound to the empty
 * wrapper. A real component keeps each field on ArkUI's normal @Prop update
 * path and makes the stage safe for both the current and adjacent pages.
 */
@Component
struct ReaderPageTurnSurface {
  @Prop @Watch('onPageIdentityChanged') pageIdentity: string = '';
  @Prop @Watch('onRasterIdentityChanged') rasterIdentity: string = '';
  @Prop chapterTitle: string = '';
  @Prop showChapterTitle: boolean = false;
  @Prop pageFragments: ReadingSurfacePageFragment[] = [];
  @Prop layout: ReaderReadingLayoutSnapshot = createDefaultReaderReadingLayout();
  @Prop appearance: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop translateX: number = 0;
  @Prop shadowStrength: number = 0;
  @Prop ttsHighlightStart: number | undefined = undefined;
  @Prop ttsHighlightEnd: number | undefined = undefined;
  @Prop autoPageHighlightStart: number | undefined = undefined;
  @Prop autoPageHighlightEnd: number | undefined = undefined;
  @Prop bottomJustifyGap: number = 0;
  @Prop longPressSelectText: boolean = false;
  @Prop chromeTopStartText: string = '';
  @Prop chromeTopEndText: string = '';
  @Prop chromeBottomStartText: string = '';
  @Prop chromeBottomEndText: string = '';
  @Prop chromeSessionVisible: boolean = false;
  @Prop chromeSessionWidth: number = 0;
  @Prop chromeSessionHeight: number = 0;
  onPageReady: (identity: string) => void = (_identity: string): void => {};

  aboutToAppear(): void {
    this.signalPageReadyAfterRenderAdmission();
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        ReadingSurface({
          chapterTitle: this.chapterTitle,
          showChapterTitle: this.showChapterTitle,
          pageFragments: this.pageFragments,
          layout: this.layout,
          appearance: this.appearance,
          ttsHighlightStart: this.ttsHighlightStart,
          ttsHighlightEnd: this.ttsHighlightEnd,
          autoPageHighlightStart: this.autoPageHighlightStart,
          autoPageHighlightEnd: this.autoPageHighlightEnd,
          bottomJustifyGap: this.bottomJustifyGap,
          longPressSelectText: this.longPressSelectText,
          chromeTopStartText: this.chromeTopStartText,
          chromeTopEndText: this.chromeTopEndText,
          chromeBottomStartText: this.chromeBottomStartText,
          chromeBottomEndText: this.chromeBottomEndText,
          chromeSessionVisible: this.chromeSessionVisible,
          chromeSessionWidth: this.chromeSessionWidth,
          chromeSessionHeight: this.chromeSessionHeight,
          bodyComponentId: `${this.pageIdentity}:body`,
          chromeComponentId: `${this.pageIdentity}:chrome`,
        });
      }
      .width('100%')
      .height('100%')
      .id(`${this.pageIdentity}:composed`);
    }
    .width('100%')
    .height('100%')
    .id(this.pageIdentity)
    .translate({ x: this.translateX })
    .shadow({
      radius: 18 * this.shadowStrength,
      color: this.shadowColor(),
      offsetX: -8 * this.shadowStrength,
      offsetY: 0,
    })
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      const width = typeof newValue.width === 'number' ? newValue.width : Number.parseFloat(`${newValue.width}`);
      const height = typeof newValue.height === 'number' ? newValue.height : Number.parseFloat(`${newValue.height}`);
      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        this.onPageReady(this.pageIdentity);
      }
    });
  }

  private shadowColor(): string {
    const alpha = Math.round(Math.max(0, Math.min(1, this.shadowStrength)) * 64);
    return `#${alpha.toString(16).padStart(2, '0')}000000`;
  }

  private onPageIdentityChanged(): void {
    this.signalPageReadyAfterRenderAdmission();
  }

  private onRasterIdentityChanged(): void {
    this.signalPageReadyAfterRenderAdmission();
  }

  private signalPageReadyAfterRenderAdmission(): void {
    const identity = this.pageIdentity;
    setTimeout((): void => {
      if (identity === this.pageIdentity) this.onPageReady(identity);
    }, 0);
  }
}

/**
 * Presentation-only two-page stage for the admitted horizontal slide mode.
 *
 * The owner supplies both gesture offset and live viewport width. This
 * component deliberately has no gesture, animation, pagination, Core command,
 * or progress side effect. In `none` mode, with an invalid width, or without
 * the requested adjacent page, it paints exactly the current page.
 */
@Component
export struct ReaderPageTurnStage {
  @Prop currentPage: ReaderPageTurnRenderPage;
  @Prop previousPage: ReaderPageTurnRenderPage | undefined = undefined;
  @Prop nextPage: ReaderPageTurnRenderPage | undefined = undefined;
  @Prop pageTurnStyle: ReaderPageTurnStyle = readerPageTurnStyle(createDefaultReaderSettingsSnapshot());
  @Prop turnDirection: ReaderPageTurnStageDirection | undefined = undefined;
  @Prop offsetX: number = 0;
  @Prop viewportWidth: number = 0;
  @Prop layout: ReaderReadingLayoutSnapshot = createDefaultReaderReadingLayout();
  @Prop appearance: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop ttsHighlightStart: number | undefined = undefined;
  @Prop ttsHighlightEnd: number | undefined = undefined;
  @Prop autoPageHighlightStart: number | undefined = undefined;
  @Prop autoPageHighlightEnd: number | undefined = undefined;
  @Prop longPressSelectText: boolean = false;
  @Prop nativeCurlVisible: boolean = false;
  /**
   * Fixed for one admitted gesture. When native textures are cold, the same
   * already measured pages follow the finger as a flat slide; the stage never
   * swaps from this fallback into curl halfway through the drag.
   */
  @Prop simulationFallbackActive: boolean = false;
  onNativeCurlContextReady: (context: ReaderNativePageCurlContext | undefined) => void =
    (_context: ReaderNativePageCurlContext | undefined): void => {};
  onPageReady: (identity: string) => void = (_identity: string): void => {};

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.hasLiveTurnWidth() && this.pageTurnStyle === 'cover' &&
        this.turnDirection === 'previous' && this.previousPage !== undefined) {
        ReaderPageTurnSurface({
          pageIdentity: this.currentPage.identity,
          chapterTitle: this.currentPage.chapterTitle,
          showChapterTitle: this.currentPage.showChapterTitle,
          pageFragments: this.currentPage.fragments,
          bottomJustifyGap: this.currentPage.bottomJustifyGap,
          chromeTopStartText: this.currentPage.chromeTopStartText,
          chromeTopEndText: this.currentPage.chromeTopEndText,
          chromeBottomStartText: this.currentPage.chromeBottomStartText,
          chromeBottomEndText: this.currentPage.chromeBottomEndText,
          chromeSessionVisible: this.currentPage.chromeSessionVisible,
          chromeSessionWidth: this.currentPage.chromeSessionWidth,
          chromeSessionHeight: this.currentPage.chromeSessionHeight,
          layout: this.layout,
          appearance: this.appearance,
          longPressSelectText: this.longPressSelectText,
          translateX: 0,
          ttsHighlightStart: this.ttsHighlightStart,
          ttsHighlightEnd: this.ttsHighlightEnd,
          autoPageHighlightStart: this.autoPageHighlightStart,
          autoPageHighlightEnd: this.autoPageHighlightEnd,
        });
        ReaderPageTurnSurface({
          pageIdentity: this.previousPage.identity,
          chapterTitle: this.previousPage.chapterTitle,
          showChapterTitle: this.previousPage.showChapterTitle,
          pageFragments: this.previousPage.fragments,
          bottomJustifyGap: this.previousPage.bottomJustifyGap,
          chromeTopStartText: this.previousPage.chromeTopStartText,
          chromeTopEndText: this.previousPage.chromeTopEndText,
          chromeBottomStartText: this.previousPage.chromeBottomStartText,
          chromeBottomEndText: this.previousPage.chromeBottomEndText,
          chromeSessionVisible: this.previousPage.chromeSessionVisible,
          chromeSessionWidth: this.previousPage.chromeSessionWidth,
          chromeSessionHeight: this.previousPage.chromeSessionHeight,
          layout: this.layout,
          appearance: this.appearance,
          longPressSelectText: this.longPressSelectText,
          translateX: this.previousPageX(),
          shadowStrength: this.turnProgress(),
        });
      } else if (this.hasLiveTurnWidth() && this.pageTurnStyle === 'cover' &&
        this.turnDirection === 'next' && this.nextPage !== undefined) {
        ReaderPageTurnSurface({
          pageIdentity: this.nextPage.identity,
          chapterTitle: this.nextPage.chapterTitle,
          showChapterTitle: this.nextPage.showChapterTitle,
          pageFragments: this.nextPage.fragments,
          bottomJustifyGap: this.nextPage.bottomJustifyGap,
          chromeTopStartText: this.nextPage.chromeTopStartText,
          chromeTopEndText: this.nextPage.chromeTopEndText,
          chromeBottomStartText: this.nextPage.chromeBottomStartText,
          chromeBottomEndText: this.nextPage.chromeBottomEndText,
          chromeSessionVisible: this.nextPage.chromeSessionVisible,
          chromeSessionWidth: this.nextPage.chromeSessionWidth,
          chromeSessionHeight: this.nextPage.chromeSessionHeight,
          layout: this.layout,
          appearance: this.appearance,
          longPressSelectText: this.longPressSelectText,
          translateX: 0,
        });
        ReaderPageTurnSurface({
          pageIdentity: this.currentPage.identity,
          chapterTitle: this.currentPage.chapterTitle,
          showChapterTitle: this.currentPage.showChapterTitle,
          pageFragments: this.currentPage.fragments,
          bottomJustifyGap: this.currentPage.bottomJustifyGap,
          chromeTopStartText: this.currentPage.chromeTopStartText,
          chromeTopEndText: this.currentPage.chromeTopEndText,
          chromeBottomStartText: this.currentPage.chromeBottomStartText,
          chromeBottomEndText: this.currentPage.chromeBottomEndText,
          chromeSessionVisible: this.currentPage.chromeSessionVisible,
          chromeSessionWidth: this.currentPage.chromeSessionWidth,
          chromeSessionHeight: this.currentPage.chromeSessionHeight,
          layout: this.layout,
          appearance: this.appearance,
          longPressSelectText: this.longPressSelectText,
          translateX: this.offsetX,
          shadowStrength: this.turnProgress(),
          ttsHighlightStart: this.ttsHighlightStart,
          ttsHighlightEnd: this.ttsHighlightEnd,
          autoPageHighlightStart: this.autoPageHighlightStart,
          autoPageHighlightEnd: this.autoPageHighlightEnd,
        });
      } else if (this.hasLiveTurnWidth() && this.pageTurnStyle === 'slide' &&
        this.turnDirection === 'previous' && this.previousPage !== undefined) {
        // The destination is painted first and the moving current page last.
        // Their edges stay exactly one live viewport apart, while this order
        // also gives the shared rasterized edge a stable foreground owner.
        ReaderPageTurnSurface({
          pageIdentity: this.previousPage.identity,
          chapterTitle: this.previousPage.chapterTitle,
          showChapterTitle: this.previousPage.showChapterTitle,
          pageFragments: this.previousPage.fragments,
          bottomJustifyGap: this.previousPage.bottomJustifyGap,
          chromeTopStartText: this.previousPage.chromeTopStartText,
          chromeTopEndText: this.previousPage.chromeTopEndText,
          chromeBottomStartText: this.previousPage.chromeBottomStartText,
          chromeBottomEndText: this.previousPage.chromeBottomEndText,
          chromeSessionVisible: this.previousPage.chromeSessionVisible,
          chromeSessionWidth: this.previousPage.chromeSessionWidth,
          chromeSessionHeight: this.previousPage.chromeSessionHeight,
          layout: this.layout,
          appearance: this.appearance,
          longPressSelectText: this.longPressSelectText,
          translateX: this.previousPageX(),
        });
        ReaderPageTurnSurface({
          pageIdentity: this.currentPage.identity,
          chapterTitle: this.currentPage.chapterTitle,
          showChapterTitle: this.currentPage.showChapterTitle,
          pageFragments: this.currentPage.fragments,
          bottomJustifyGap: this.currentPage.bottomJustifyGap,
          chromeTopStartText: this.currentPage.chromeTopStartText,
          chromeTopEndText: this.currentPage.chromeTopEndText,
          chromeBottomStartText: this.currentPage.chromeBottomStartText,
          chromeBottomEndText: this.currentPage.chromeBottomEndText,
          chromeSessionVisible: this.currentPage.chromeSessionVisible,
          chromeSessionWidth: this.currentPage.chromeSessionWidth,
          chromeSessionHeight: this.currentPage.chromeSessionHeight,
          layout: this.layout,
          appearance: this.appearance,
          longPressSelectText: this.longPressSelectText,
          translateX: this.offsetX,
          ttsHighlightStart: this.ttsHighlightStart,
          ttsHighlightEnd: this.ttsHighlightEnd,
          autoPageHighlightStart: this.autoPageHighlightStart,
          autoPageHighlightEnd: this.autoPageHighlightEnd,
        });
      } else if (this.hasLiveTurnWidth() && this.pageTurnStyle === 'slide' &&
        this.turnDirection === 'next' && this.nextPage !== undefined) {
        ReaderPageTurnSurface({
          pageIdentity: this.nextPage.identity,
          chapterTitle: this.nextPage.chapterTitle,
          showChapterTitle: this.nextPage.showChapterTitle,
          pageFragments: this.nextPage.fragments,
          bottomJustifyGap: this.nextPage.bottomJustifyGap,
          chromeTopStartText: this.nextPage.chromeTopStartText,
          chromeTopEndText: this.nextPage.chromeTopEndText,
          chromeBottomStartText: this.nextPage.chromeBottomStartText,
          chromeBottomEndText: this.nextPage.chromeBottomEndText,
          chromeSessionVisible: this.nextPage.chromeSessionVisible,
          chromeSessionWidth: this.nextPage.chromeSessionWidth,
          chromeSessionHeight: this.nextPage.chromeSessionHeight,
          layout: this.layout,
          appearance: this.appearance,
          longPressSelectText: this.longPressSelectText,
          translateX: this.nextPageX(),
        });
        ReaderPageTurnSurface({
          pageIdentity: this.currentPage.identity,
          chapterTitle: this.currentPage.chapterTitle,
          showChapterTitle: this.currentPage.showChapterTitle,
          pageFragments: this.currentPage.fragments,
          bottomJustifyGap: this.currentPage.bottomJustifyGap,
          chromeTopStartText: this.currentPage.chromeTopStartText,
          chromeTopEndText: this.currentPage.chromeTopEndText,
          chromeBottomStartText: this.currentPage.chromeBottomStartText,
          chromeBottomEndText: this.currentPage.chromeBottomEndText,
          chromeSessionVisible: this.currentPage.chromeSessionVisible,
          chromeSessionWidth: this.currentPage.chromeSessionWidth,
          chromeSessionHeight: this.currentPage.chromeSessionHeight,
          layout: this.layout,
          appearance: this.appearance,
          longPressSelectText: this.longPressSelectText,
          translateX: this.offsetX,
          ttsHighlightStart: this.ttsHighlightStart,
          ttsHighlightEnd: this.ttsHighlightEnd,
          autoPageHighlightStart: this.autoPageHighlightStart,
          autoPageHighlightEnd: this.autoPageHighlightEnd,
        });
      } else if (this.pageTurnStyle === 'simulation') {
        if (!this.nativeCurlVisible && this.previousPage !== undefined) {
          ReaderPageTurnSurface({
            pageIdentity: this.previousPage.identity,
            rasterIdentity: this.previousPage.composedTextureKey,
            chapterTitle: this.previousPage.chapterTitle,
            showChapterTitle: this.previousPage.showChapterTitle,
            pageFragments: this.previousPage.fragments,
            bottomJustifyGap: this.previousPage.bottomJustifyGap,
            chromeTopStartText: this.previousPage.chromeTopStartText,
            chromeTopEndText: this.previousPage.chromeTopEndText,
            chromeBottomStartText: this.previousPage.chromeBottomStartText,
            chromeBottomEndText: this.previousPage.chromeBottomEndText,
            chromeSessionVisible: this.previousPage.chromeSessionVisible,
            chromeSessionWidth: this.previousPage.chromeSessionWidth,
            chromeSessionHeight: this.previousPage.chromeSessionHeight,
            layout: this.layout,
            appearance: this.appearance,
            longPressSelectText: this.longPressSelectText,
            translateX: this.simulationPreviousPageX(),
            onPageReady: (identity: string): void => this.onPageReady(identity),
          });
        }
        if (!this.nativeCurlVisible && this.nextPage !== undefined) {
          ReaderPageTurnSurface({
            pageIdentity: this.nextPage.identity,
            rasterIdentity: this.nextPage.composedTextureKey,
            chapterTitle: this.nextPage.chapterTitle,
            showChapterTitle: this.nextPage.showChapterTitle,
            pageFragments: this.nextPage.fragments,
            bottomJustifyGap: this.nextPage.bottomJustifyGap,
            chromeTopStartText: this.nextPage.chromeTopStartText,
            chromeTopEndText: this.nextPage.chromeTopEndText,
            chromeBottomStartText: this.nextPage.chromeBottomStartText,
            chromeBottomEndText: this.nextPage.chromeBottomEndText,
            chromeSessionVisible: this.nextPage.chromeSessionVisible,
            chromeSessionWidth: this.nextPage.chromeSessionWidth,
            chromeSessionHeight: this.nextPage.chromeSessionHeight,
            layout: this.layout,
            appearance: this.appearance,
            longPressSelectText: this.longPressSelectText,
            translateX: this.simulationNextPageX(),
            onPageReady: (identity: string): void => this.onPageReady(identity),
          });
        }
        ReaderPageTurnSurface({
          pageIdentity: this.currentPage.identity,
          rasterIdentity: this.currentPage.composedTextureKey,
          chapterTitle: this.currentPage.chapterTitle,
          showChapterTitle: this.currentPage.showChapterTitle,
          pageFragments: this.currentPage.fragments,
          bottomJustifyGap: this.currentPage.bottomJustifyGap,
          chromeTopStartText: this.currentPage.chromeTopStartText,
          chromeTopEndText: this.currentPage.chromeTopEndText,
          chromeBottomStartText: this.currentPage.chromeBottomStartText,
          chromeBottomEndText: this.currentPage.chromeBottomEndText,
          chromeSessionVisible: this.currentPage.chromeSessionVisible,
          chromeSessionWidth: this.currentPage.chromeSessionWidth,
          chromeSessionHeight: this.currentPage.chromeSessionHeight,
          layout: this.layout,
          appearance: this.appearance,
          longPressSelectText: this.longPressSelectText,
          translateX: this.simulationCurrentPageX(),
          ttsHighlightStart: this.ttsHighlightStart,
          ttsHighlightEnd: this.ttsHighlightEnd,
          autoPageHighlightStart: this.autoPageHighlightStart,
          autoPageHighlightEnd: this.autoPageHighlightEnd,
          onPageReady: (identity: string): void => this.onPageReady(identity),
        });
        ReaderNativePageCurlSurface({
          rendererVisible: this.nativeCurlVisible,
          onContextReady: (context: ReaderNativePageCurlContext | undefined): void =>
            this.onNativeCurlContextReady(context),
        });
      } else {
        ReaderPageTurnSurface({
          pageIdentity: this.currentPage.identity,
          chapterTitle: this.currentPage.chapterTitle,
          showChapterTitle: this.currentPage.showChapterTitle,
          pageFragments: this.currentPage.fragments,
          bottomJustifyGap: this.currentPage.bottomJustifyGap,
          chromeTopStartText: this.currentPage.chromeTopStartText,
          chromeTopEndText: this.currentPage.chromeTopEndText,
          chromeBottomStartText: this.currentPage.chromeBottomStartText,
          chromeBottomEndText: this.currentPage.chromeBottomEndText,
          chromeSessionVisible: this.currentPage.chromeSessionVisible,
          chromeSessionWidth: this.currentPage.chromeSessionWidth,
          chromeSessionHeight: this.currentPage.chromeSessionHeight,
          layout: this.layout,
          appearance: this.appearance,
          longPressSelectText: this.longPressSelectText,
          translateX: 0,
          ttsHighlightStart: this.ttsHighlightStart,
          ttsHighlightEnd: this.ttsHighlightEnd,
          autoPageHighlightStart: this.autoPageHighlightStart,
          autoPageHighlightEnd: this.autoPageHighlightEnd,
        });
      }
    }
    .width('100%')
    .height('100%')
    .clip(true);
  }

  private hasLiveTurnWidth(): boolean {
    return (this.pageTurnStyle === 'slide' || this.pageTurnStyle === 'cover') &&
      Number.isFinite(this.viewportWidth) && this.viewportWidth > 0;
  }

  private previousPageX(): number {
    return this.offsetX - this.viewportWidth;
  }

  private nextPageX(): number {
    return this.viewportWidth + this.offsetX;
  }

  private simulationPreviousPageX(): number {
    return this.hasSimulationFallbackWidth() && this.turnDirection === 'previous' ?
      this.previousPageX() : 0;
  }

  private simulationNextPageX(): number {
    return this.hasSimulationFallbackWidth() && this.turnDirection === 'next' ?
      this.nextPageX() : 0;
  }

  private simulationCurrentPageX(): number {
    return this.hasSimulationFallbackWidth() ? this.offsetX : 0;
  }

  private hasSimulationFallbackWidth(): boolean {
    return this.pageTurnStyle === 'simulation' && this.simulationFallbackActive &&
      Number.isFinite(this.viewportWidth) && this.viewportWidth > 0;
  }

  private turnProgress(): number {
    return Math.max(0, Math.min(1, Math.abs(this.offsetX) / this.viewportWidth));
  }

}
