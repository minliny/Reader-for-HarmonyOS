import { FrameCallback } from '@kit.ArkUI';
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
  type ReaderDynamicHighlightRect,
} from './ReadingSurface';
import { ReaderPageChromeSnapshot } from './ReaderPageChromeModel';
import { readerAppearanceChromeTone } from './ReaderAppearanceRenderStyle';

class ReaderPageTurnFrameCallback extends FrameCallback {
  private callback: () => void;
  constructor(callback: () => void) { super(); this.callback = callback; }
  onFrame(_time: number): void { this.callback(); }
  onIdle(_remaining: number): void {}
}

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
 * Physical page slots are deliberately independent from page roles.  A page
 * may move from adjacent to current after a commit, but its ArkUI subtree must
 * stay mounted in the same slot so the commit cannot expose an empty tree.
 */
export type ReaderPageTurnSlot = 'a' | 'b';
export const READER_PAGE_TURN_SLOT_A = 'reader-page-slot-a';
export const READER_PAGE_TURN_SLOT_B = 'reader-page-slot-b';

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
  /** Semantic page identity; retained for diagnostics/content revisions. */
  @Prop pageIdentity: string = '';
  @Prop staticSnapshotId: string = '';
  @Prop highlightTextureIdentity: string = '';
  onDynamicHighlights: (identity: string, rects: ReaderDynamicHighlightRect[]) => void =
    (_identity: string, _rects: ReaderDynamicHighlightRect[]): void => {};
  /** Monotonic owner revision used to acknowledge a promoted page frame. */
  @Prop @Watch('onRenderRevisionChanged') renderRevision: number = 0;
  /** Stable physical slot identity used by ArkUI component reconciliation. */
  @Prop slotIdentity: string = '';
  @Prop chapterTitle: string = '';
  @Prop showChapterTitle: boolean = false;
  @Prop pageFragments: ReadingSurfacePageFragment[] = [];
  pageFragmentsProvider: () => ReadingSurfacePageFragment[] = (): ReadingSurfacePageFragment[] => this.pageFragments;
  @Prop layout: ReaderReadingLayoutSnapshot = createDefaultReaderReadingLayout();
  @Prop appearance: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop translateX: number = 0;
  @Prop shadowStrength: number = 0;
  @Prop compositorIsolation: boolean = false;
  @Prop pageVisible: boolean = true;
  @Prop layerOrder: number = 0;
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
  /** Called after ArkUI has had a frame to compose this slot's new content. */
  onPresented: (revision: number) => void = (_revision: number): void => {};

  aboutToAppear(): void {
    this.onRenderRevisionChanged();
  }

  private onRenderRevisionChanged(): void {
    const revision = this.renderRevision;
    // Defer until the next frame: the owner must not hide the retained Native
    // terminal frame before this slot has entered a compositor frame.
    this.getUIContext().postFrameCallback(new ReaderPageTurnFrameCallback((): void => {
      this.onPresented(revision);
    }));
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        ReadingSurface({
          chapterTitle: this.chapterTitle,
          showChapterTitle: this.showChapterTitle,
          fragmentsProvider: (): ReadingSurfacePageFragment[] => this.pageFragmentsProvider(),
          contentRevision: this.renderRevision,
          staticSnapshotId: this.staticSnapshotId,
          highlightTextureIdentity: this.highlightTextureIdentity,
          onDynamicHighlights: this.onDynamicHighlights,
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
    // Never key the mounted subtree by current/next/previous role.  Role keys
    // cause a successful promotion to unmount the destination page and mount
    // a fresh current page, creating a transparent/empty frame in between.
    .id(this.slotIdentity.length > 0 ? this.slotIdentity : this.pageIdentity)
    .opacity(this.pageVisible ? 1 : 0)
    .enabled(this.pageVisible)
    .hitTestBehavior(this.pageVisible ? HitTestMode.Default : HitTestMode.None)
    .accessibilityLevel(this.pageVisible ? 'auto' : 'no-hide-descendants')
    .zIndex(this.layerOrder)
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
  // A primitive revision invalidates content. Providers avoid ArkUI V1
  // deep-copying full page arrays every time the gesture offset changes.
  @Prop contentRevision: number = 0;
  currentPageProvider: () => ReaderPageTurnRenderPage = (): ReaderPageTurnRenderPage => this.emptyPage;
  previousPageProvider: () => ReaderPageTurnRenderPage | undefined = (): ReaderPageTurnRenderPage | undefined => undefined;
  nextPageProvider: () => ReaderPageTurnRenderPage | undefined = (): ReaderPageTurnRenderPage | undefined => undefined;
  /** Short stable ID used only to snapshot the live simulation page. */
  @Prop currentPageSnapshotId: string = '';
  /** Slot currently owning the logical current page. */
  @Prop currentPageSlot: ReaderPageTurnSlot = 'a';
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
  /** Optional acknowledgement that the promoted current page composed. */
  onCurrentPagePresented: (revision: number) => void = (_revision: number): void => {};

  private slotPageA: ReaderPageTurnRenderPage | undefined = undefined;
  private slotPageB: ReaderPageTurnRenderPage | undefined = undefined;
  private renderPagesRevision: number = -1;
  private cachedCurrentPage: ReaderPageTurnRenderPage | undefined = undefined;
  private cachedPreviousPage: ReaderPageTurnRenderPage | undefined = undefined;
  private cachedNextPage: ReaderPageTurnRenderPage | undefined = undefined;
  private emptyPage: ReaderPageTurnRenderPage = new ReaderPageTurnRenderPage('', '', 0, '', false, []);

  onDynamicHighlights: (identity: string, rects: ReaderDynamicHighlightRect[]) => void =
    (_identity: string, _rects: ReaderDynamicHighlightRect[]): void => {};

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderPageTurnSurface({
        pageIdentity: this.slotPage('a').identity,
        slotIdentity: this.slotIdentity('a'),
        staticSnapshotId: this.slotSnapshotId('a'),
        highlightTextureIdentity: this.slotPage('a').textureIdentity,
        onDynamicHighlights: this.onDynamicHighlights,
        renderRevision: this.slotPage('a').renderRevision,
        onPresented: (revision: number): void => this.slotPresented('a', revision),
        chapterTitle: this.slotPage('a').chapterTitle,
        showChapterTitle: this.slotPage('a').showChapterTitle,
        bottomJustifyGap: this.slotPage('a').bottomJustifyGap,
        chromeTopStartText: this.slotPage('a').chromeTopStartText,
        chromeTopEndText: this.slotPage('a').chromeTopEndText,
        chromeBottomStartText: this.slotPage('a').chromeBottomStartText,
        chromeBottomEndText: this.slotPage('a').chromeBottomEndText,
        chromeSessionVisible: this.slotPage('a').chromeSessionVisible,
        chromeSessionWidth: this.slotPage('a').chromeSessionWidth,
        chromeSessionHeight: this.slotPage('a').chromeSessionHeight,
        pageFragmentsProvider: (): ReadingSurfacePageFragment[] => this.slotPage('a').fragments,
        layout: this.layout,
        appearance: this.appearance,
        longPressSelectText: this.currentPageSlot === 'a' && this.longPressSelectText,
        translateX: this.slotX('a'),
        pageVisible: this.slotVisible('a'),
        layerOrder: this.slotLayer('a'),
        shadowStrength: this.slotShadow('a'),
        // Keep idle pages in the parent stacking context so sibling controls
        // can occlude them; isolate only while an active turn is presented.
        compositorIsolation: this.hasActiveTurn(),
        ttsHighlightStart: this.currentPageSlot === 'a' ? this.ttsHighlightStart : undefined,
        ttsHighlightEnd: this.currentPageSlot === 'a' ? this.ttsHighlightEnd : undefined,
        autoPageHighlightStart: this.currentPageSlot === 'a' ? this.autoPageHighlightStart : undefined,
        autoPageHighlightEnd: this.currentPageSlot === 'a' ? this.autoPageHighlightEnd : undefined,
      });
      ReaderPageTurnSurface({
        pageIdentity: this.slotPage('b').identity,
        slotIdentity: this.slotIdentity('b'),
        staticSnapshotId: this.slotSnapshotId('b'),
        highlightTextureIdentity: this.slotPage('b').textureIdentity,
        onDynamicHighlights: this.onDynamicHighlights,
        renderRevision: this.slotPage('b').renderRevision,
        onPresented: (revision: number): void => this.slotPresented('b', revision),
        chapterTitle: this.slotPage('b').chapterTitle,
        showChapterTitle: this.slotPage('b').showChapterTitle,
        bottomJustifyGap: this.slotPage('b').bottomJustifyGap,
        chromeTopStartText: this.slotPage('b').chromeTopStartText,
        chromeTopEndText: this.slotPage('b').chromeTopEndText,
        chromeBottomStartText: this.slotPage('b').chromeBottomStartText,
        chromeBottomEndText: this.slotPage('b').chromeBottomEndText,
        chromeSessionVisible: this.slotPage('b').chromeSessionVisible,
        chromeSessionWidth: this.slotPage('b').chromeSessionWidth,
        chromeSessionHeight: this.slotPage('b').chromeSessionHeight,
        pageFragmentsProvider: (): ReadingSurfacePageFragment[] => this.slotPage('b').fragments,
        layout: this.layout,
        appearance: this.appearance,
        longPressSelectText: this.currentPageSlot === 'b' && this.longPressSelectText,
        translateX: this.slotX('b'),
        pageVisible: this.slotVisible('b'),
        layerOrder: this.slotLayer('b'),
        shadowStrength: this.slotShadow('b'),
        compositorIsolation: this.hasActiveTurn(),
        ttsHighlightStart: this.currentPageSlot === 'b' ? this.ttsHighlightStart : undefined,
        ttsHighlightEnd: this.currentPageSlot === 'b' ? this.ttsHighlightEnd : undefined,
        autoPageHighlightStart: this.currentPageSlot === 'b' ? this.autoPageHighlightStart : undefined,
        autoPageHighlightEnd: this.currentPageSlot === 'b' ? this.autoPageHighlightEnd : undefined,
      });
    }
    .width('100%')
    .height('100%')
    .translate({ y: this.translateY })
    .clip(true);
  }

  private slotPage(slot: ReaderPageTurnSlot): ReaderPageTurnRenderPage {
    let page = slot === 'a' ? this.slotPageA : this.slotPageB;
    if (slot === this.currentPageSlot) {
      page = this.currentRenderPage();
    } else {
      // Native/none still rotate the same two physical slots. Keep an
      // already-bound outgoing page hidden instead of clearing all its text
      // and rebuilding it on the next promotion. Do not prepare a spare page
      // for these modes; only the current slot can publish an acknowledgement.
      if (!this.hasLiveTurnWidth()) return page ?? this.emptyPage;
      // Keep the outgoing physical page after promotion. Replacing it with
      // speculative NEXT while idle forces a second full rebind on reversal.
      const adjacent = this.turnDirection === 'previous' ? this.adjacentRenderPage('previous') :
        (this.turnDirection === 'next' ? this.adjacentRenderPage('next') : undefined);
      if (adjacent !== undefined) page = adjacent;
      else if (page === undefined) page = this.adjacentRenderPage('next') ?? this.adjacentRenderPage('previous');
    }
    if (slot === 'a') this.slotPageA = page;
    else this.slotPageB = page;
    return page ?? this.emptyPage;
  }

  private refreshRenderPages(): void {
    const revision = this.contentRevision;
    if (revision === this.renderPagesRevision && this.cachedCurrentPage !== undefined) return;
    this.cachedCurrentPage = revision >= 0 ? this.currentPageProvider() : this.emptyPage;
    this.cachedPreviousPage = revision >= 0 ? this.previousPageProvider() : undefined;
    this.cachedNextPage = revision >= 0 ? this.nextPageProvider() : undefined;
    this.renderPagesRevision = revision;
  }

  private currentRenderPage(): ReaderPageTurnRenderPage {
    this.refreshRenderPages();
    return this.cachedCurrentPage ?? this.emptyPage;
  }

  private adjacentRenderPage(direction: ReaderPageTurnStageDirection): ReaderPageTurnRenderPage | undefined {
    this.refreshRenderPages();
    return direction === 'previous' ? this.cachedPreviousPage : this.cachedNextPage;
  }

  private slotIdentity(slot: ReaderPageTurnSlot): string {
    return slot === 'a' ? READER_PAGE_TURN_SLOT_A : READER_PAGE_TURN_SLOT_B;
  }

  private slotSnapshotId(slot: ReaderPageTurnSlot): string {
    // ComponentSnapshot resolves an element ID, not the current-page role.
    // Keep a unique ID on each mounted static subtree; transferring one ID
    // between slots can resolve the hidden empty reserve after promotion.
    return this.currentPageSnapshotId.length > 0 ? `${this.currentPageSnapshotId}-${slot}` : '';
  }

  private slotPresented(slot: ReaderPageTurnSlot, revision: number): void {
    if (slot === this.currentPageSlot && revision === this.currentRenderPage().renderRevision) {
      this.onCurrentPagePresented(revision);
    }
  }

  private hasActiveTurn(): boolean {
    return this.hasLiveTurnWidth() && ((this.turnDirection === 'previous' && this.adjacentRenderPage('previous') !== undefined) ||
      (this.turnDirection === 'next' && this.adjacentRenderPage('next') !== undefined));
  }

  private slotVisible(slot: ReaderPageTurnSlot): boolean {
    return slot === this.currentPageSlot || this.hasActiveTurn();
  }

  private slotX(slot: ReaderPageTurnSlot): number {
    if (!this.hasActiveTurn()) return 0;
    if (slot === this.currentPageSlot) {
      return this.pageTurnStyle === 'cover' && this.turnDirection === 'previous' ? 0 : this.offsetX;
    }
    if (this.pageTurnStyle === 'cover' && this.turnDirection === 'next') return 0;
    return this.turnDirection === 'previous' ? this.previousPageX() : this.nextPageX();
  }

  private slotLayer(slot: ReaderPageTurnSlot): number {
    const adjacentOnTop = this.hasActiveTurn() && this.pageTurnStyle === 'cover' &&
      this.turnDirection === 'previous';
    return (slot === this.currentPageSlot) !== adjacentOnTop ? 1 : 0;
  }

  private slotShadow(slot: ReaderPageTurnSlot): number {
    if (!this.hasActiveTurn() || this.pageTurnStyle !== 'cover' || this.slotLayer(slot) === 0) return 0;
    return this.coverOcclusionStrength();
  }

  private hasLiveTurnWidth(): boolean {
    return (this.pageTurnStyle === 'slide' || this.pageTurnStyle === 'cover') &&
      Number.isFinite(this.viewportWidth) && this.viewportWidth > 0;
  }

  private currentSlotIdentity(): string {
    return this.currentPageSlot === 'b' ? READER_PAGE_TURN_SLOT_B : READER_PAGE_TURN_SLOT_A;
  }

  private adjacentSlotIdentity(): string {
    return this.currentPageSlot === 'b' ? READER_PAGE_TURN_SLOT_A : READER_PAGE_TURN_SLOT_B;
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
