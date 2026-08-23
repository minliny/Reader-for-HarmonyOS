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

  constructor(
    identity: string,
    chapterTitle: string,
    showChapterTitle: boolean,
    fragments: ReadingSurfacePageFragment[],
    bottomJustifyGap: number = 0,
  ) {
    this.identity = identity;
    this.chapterTitle = chapterTitle;
    this.showChapterTitle = showChapterTitle;
    this.fragments = fragments;
    this.bottomJustifyGap = bottomJustifyGap;
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
  @Prop pageIdentity: string = '';
  @Prop chapterTitle: string = '';
  @Prop showChapterTitle: boolean = false;
  @Prop pageFragments: ReadingSurfacePageFragment[] = [];
  @Prop layout: ReaderReadingLayoutSnapshot = createDefaultReaderReadingLayout();
  @Prop appearance: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop translateX: number = 0;
  @Prop rotateY: number = 0;
  @Prop rotationCenterX: string = '50%';
  @Prop shadowStrength: number = 0;
  @Prop ttsHighlightStart: number | undefined = undefined;
  @Prop ttsHighlightEnd: number | undefined = undefined;
  @Prop autoPageHighlightStart: number | undefined = undefined;
  @Prop autoPageHighlightEnd: number | undefined = undefined;
  @Prop bottomJustifyGap: number = 0;
  @Prop longPressSelectText: boolean = false;

  build() {
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
      });
    }
    .width('100%')
    .height('100%')
    .id(this.pageIdentity)
    .translate({ x: this.translateX })
    .rotate({
      y: 1,
      angle: this.rotateY,
      centerX: this.rotationCenterX,
      centerY: '50%',
      perspective: 1000,
    })
    .shadow({
      radius: 18 * this.shadowStrength,
      color: this.shadowColor(),
      offsetX: this.rotateY <= 0 ? -8 * this.shadowStrength : 8 * this.shadowStrength,
      offsetY: 0,
    });
  }

  private shadowColor(): string {
    const alpha = Math.round(Math.max(0, Math.min(1, this.shadowStrength)) * 64);
    return `#${alpha.toString(16).padStart(2, '0')}000000`;
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
      } else if (this.hasLiveTurnWidth() && this.pageTurnStyle === 'simulation' &&
        this.turnDirection === 'previous' && this.previousPage !== undefined) {
        ReaderPageTurnSurface({
          pageIdentity: this.currentPage.identity,
          chapterTitle: this.currentPage.chapterTitle,
          showChapterTitle: this.currentPage.showChapterTitle,
          pageFragments: this.currentPage.fragments,
          bottomJustifyGap: this.currentPage.bottomJustifyGap,
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
          layout: this.layout,
          appearance: this.appearance,
          longPressSelectText: this.longPressSelectText,
          translateX: -this.viewportWidth * (1 - this.turnProgress()) * 0.08,
          rotateY: 88 * (1 - this.turnProgress()),
          rotationCenterX: '100%',
          shadowStrength: this.simulationShadowStrength(),
        });
      } else if (this.hasLiveTurnWidth() && this.pageTurnStyle === 'simulation' &&
        this.turnDirection === 'next' && this.nextPage !== undefined) {
        ReaderPageTurnSurface({
          pageIdentity: this.nextPage.identity,
          chapterTitle: this.nextPage.chapterTitle,
          showChapterTitle: this.nextPage.showChapterTitle,
          pageFragments: this.nextPage.fragments,
          bottomJustifyGap: this.nextPage.bottomJustifyGap,
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
          layout: this.layout,
          appearance: this.appearance,
          longPressSelectText: this.longPressSelectText,
          translateX: this.offsetX * 0.08,
          rotateY: -88 * this.turnProgress(),
          rotationCenterX: '0%',
          shadowStrength: this.simulationShadowStrength(),
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
          layout: this.layout,
          appearance: this.appearance,
          longPressSelectText: this.longPressSelectText,
          translateX: this.offsetX,
          ttsHighlightStart: this.ttsHighlightStart,
          ttsHighlightEnd: this.ttsHighlightEnd,
          autoPageHighlightStart: this.autoPageHighlightStart,
          autoPageHighlightEnd: this.autoPageHighlightEnd,
        });
      } else {
        ReaderPageTurnSurface({
          pageIdentity: this.currentPage.identity,
          chapterTitle: this.currentPage.chapterTitle,
          showChapterTitle: this.currentPage.showChapterTitle,
          pageFragments: this.currentPage.fragments,
          bottomJustifyGap: this.currentPage.bottomJustifyGap,
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
    return this.pageTurnStyle !== 'none' && this.pageTurnStyle !== 'scroll' &&
      Number.isFinite(this.viewportWidth) && this.viewportWidth > 0;
  }

  private previousPageX(): number {
    return this.offsetX - this.viewportWidth;
  }

  private nextPageX(): number {
    return this.viewportWidth + this.offsetX;
  }

  private turnProgress(): number {
    return Math.max(0, Math.min(1, Math.abs(this.offsetX) / this.viewportWidth));
  }

  private simulationShadowStrength(): number {
    const progress = this.turnProgress();
    return 1 - Math.abs(progress * 2 - 1);
  }
}
