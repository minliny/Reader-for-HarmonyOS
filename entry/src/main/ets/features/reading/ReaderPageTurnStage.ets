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
import { readerAppearanceChromeTone } from './ReaderAppearanceRenderStyle';

// A cover page casts contact occlusion onto the newly revealed paper directly
// to the right of its trailing edge. These semantic lighting values are kept
// together so cover modes do not invent independent direction-specific shade.
const COVER_OCCLUSION_RADIUS_VP = 16;
const COVER_OCCLUSION_OFFSET_X_VP = 6;
const COVER_OCCLUSION_DAY_MAX_ALPHA = 56;
const COVER_OCCLUSION_NIGHT_MAX_ALPHA = 34;

/**
 * Immutable-by-convention input for one already measured physical page.
 *
 * Pagination and progress remain owned by LocalReadingExperience. The stage
 * only places these presentation models next to one another for the selected
 * flat-page transition.
 */
export class ReaderPageTurnRenderPage {
  /** Stable mounted ArkUI subtree ID used only by ComponentSnapshot. */
  identity: string;
  /** Visual-content identity stored beside the native texture handle. */
  textureIdentity: string;
  /** Owner epoch used to invalidate ArkUI props without changing the stable snapshot ID. */
  renderRevision: number;
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

  constructor(
    identity: string,
    textureIdentity: string,
    renderRevision: number,
    chapterTitle: string,
    showChapterTitle: boolean,
    fragments: ReadingSurfacePageFragment[],
    bottomJustifyGap: number = 0,
    chrome: ReaderPageChromeSnapshot = new ReaderPageChromeSnapshot(),
  ) {
    this.identity = identity;
    this.textureIdentity = textureIdentity;
    this.renderRevision = renderRevision;
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
  @Prop shadowStrength: number = 0;
  @Prop compositorIsolation: boolean = false;
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
        });
      }
      .width('100%')
      .height('100%');
    }
    .width('100%')
    .height('100%')
    .id(this.pageIdentity)
    .renderGroup(this.compositorIsolation)
    .translate({ x: this.translateX })
    .shadow({
      radius: COVER_OCCLUSION_RADIUS_VP * this.shadowStrength,
      color: this.shadowColor(),
      offsetX: COVER_OCCLUSION_OFFSET_X_VP * this.shadowStrength,
      offsetY: 0,
    });
  }

  private shadowColor(): string {
    const maxAlpha = readerAppearanceChromeTone(this.appearance.activeTheme) === 'light' ?
      COVER_OCCLUSION_NIGHT_MAX_ALPHA : COVER_OCCLUSION_DAY_MAX_ALPHA;
    const alpha = Math.round(Math.max(0, Math.min(1, this.shadowStrength)) * maxAlpha);
    return `#${alpha.toString(16).padStart(2, '0')}000000`;
  }

}

/**
 * Presentation-only stage for all admitted page-transition modes.
 *
 * The owner supplies both gesture offset and live viewport width. This
 * component deliberately has no gesture, animation, pagination, Core command,
 * or progress side effect. In `none` mode, with an invalid width, or without
 * the requested adjacent page, it paints exactly the current page.
 */
@Component
export struct ReaderPageTurnStage {
  @Prop currentPage: ReaderPageTurnRenderPage;
  /** Short stable ID used only to snapshot the live simulation page. */
  @Prop currentPageSnapshotId: string = '';
  @Prop previousPage: ReaderPageTurnRenderPage | undefined = undefined;
  @Prop nextPage: ReaderPageTurnRenderPage | undefined = undefined;
  @Prop pageTurnStyle: ReaderPageTurnStyle = readerPageTurnStyle(createDefaultReaderSettingsSnapshot());
  @Prop turnDirection: ReaderPageTurnStageDirection | undefined = undefined;
  @Prop offsetX: number = 0;
  @Prop viewportWidth: number = 0;
  @Prop translateY: number = 0;
  @Prop layout: ReaderReadingLayoutSnapshot = createDefaultReaderReadingLayout();
  @Prop appearance: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop ttsHighlightStart: number | undefined = undefined;
  @Prop ttsHighlightEnd: number | undefined = undefined;
  @Prop autoPageHighlightStart: number | undefined = undefined;
  @Prop autoPageHighlightEnd: number | undefined = undefined;
  @Prop longPressSelectText: boolean = false;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.pageTurnStyle === 'simulation') {
        // Only the live page stays mounted. previous/current/next textures are
        // built by the dedicated offscreen builder while idle, avoiding three
        // permanently mounted full Text trees on low-end devices.
        ReaderPageTurnSurface({
          pageIdentity: this.currentPageSnapshotId.length > 0 ?
            this.currentPageSnapshotId : this.currentPage.identity,
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
          ttsHighlightStart: this.ttsHighlightStart,
          ttsHighlightEnd: this.ttsHighlightEnd,
          autoPageHighlightStart: this.autoPageHighlightStart,
          autoPageHighlightEnd: this.autoPageHighlightEnd,
        });
      } else if (this.hasLiveTurnWidth() && this.pageTurnStyle === 'cover' &&
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
          shadowStrength: this.coverOcclusionStrength(),
          compositorIsolation: true,
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
          shadowStrength: this.coverOcclusionStrength(),
          compositorIsolation: true,
          ttsHighlightStart: this.ttsHighlightStart,
          ttsHighlightEnd: this.ttsHighlightEnd,
          autoPageHighlightStart: this.autoPageHighlightStart,
          autoPageHighlightEnd: this.autoPageHighlightEnd,
        });
      } else if (this.hasLiveTurnWidth() && this.pageTurnStyle === 'slide' &&
        this.turnDirection === 'previous' && this.previousPage !== undefined) {
        // The destination is painted first and the moving current page last.
        // Their edges stay exactly one live viewport apart, while this order
        // also gives the shared edge a stable foreground owner.
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
          compositorIsolation: true,
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
          compositorIsolation: true,
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
          compositorIsolation: true,
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
          compositorIsolation: true,
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
    .translate({ y: this.translateY })
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

  private turnProgress(): number {
    return Math.max(0, Math.min(1, Math.abs(this.offsetX) / this.viewportWidth));
  }

  private coverOcclusionStrength(): number {
    const progress = this.turnProgress();
    // The moving edge is clipped at both endpoints. Fade the occlusion there
    // and peak around mid-turn, where the revealed seam is most exposed.
    return 4 * progress * (1 - progress);
  }

}
