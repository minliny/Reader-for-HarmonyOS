import { readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { TYPE_APP_SECTION_LABEL, TYPE_SHELF_LIST_STATUS } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { TOK_SPACE_XS } from '../../../ui/foundation/ReaderTokens';
import { ReaderIconButton } from '../../../ui/controls/ReaderIconButton';
import { motionAnimateParam } from '../../../ui/foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';

const SHELF_SECTION_ACTION_SIZE = 30;
const SHELF_SECTION_TRACK_HEIGHT = 34;
const SHELF_SECTION_TRACK_INSET = 3;
const SHELF_SECTION_PILL_HEIGHT = SHELF_SECTION_TRACK_HEIGHT - 2 * SHELF_SECTION_TRACK_INSET;
const SHELF_SECTION_PILL_WIDTH = 30;
const SHELF_FILTER_SIZE = 34;
type BookshelfSectionAction = 'bookshelf_grid' | 'bookshelf_list' | 'bookshelf_filter';

/** The font-scaled shelf section header shared by the populated list and the empty
 * state. The empty state omits unavailable actions; the
 * populated shelf owns the view-mode and filter actions. */
@Component
export struct BookshelfSectionHeader {
  @StorageLink('readerWindowMetricsRevision') private windowRevision: number = 0;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageProp('readerReduceMotion') @Watch('syncViewModePill') private reduceMotion: boolean = false;
  @Prop contentWidth: number = 0;
  @Prop titleOpacity: number = 1;
  @Prop actionsEnabled: boolean = true;
  @Prop actionsOpacity: number = 1;
  @Prop @Watch('moveViewModePill') viewMode: 'cover' | 'list' = 'list';
  @Prop filterExpanded: boolean = false;
  @Prop hasActiveFilters: boolean = false;
  @Prop bookCount: number = -1;
  onCover: () => void = (): void => {};
  onList: () => void = (): void => {};
  onFilter: () => void = (): void => {};
  @State private pillLane: number = 0;
  @State private pillOpacity: number = 1;
  private pillGeneration: number = 0;
  private mounted: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    this.syncViewModePill();
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.pillGeneration += 1;
  }

  build() {
    Row() {
      Row({ space: 6 }) {
        Text('我的书架')
          .fontFamily(TYPE_APP_SECTION_LABEL.fontFamily)
          .fontWeight(TYPE_APP_SECTION_LABEL.fontWeight)
          .fontSize(TYPE_APP_SECTION_LABEL.fontSizeFp)
          .lineHeight(`${TYPE_APP_SECTION_LABEL.lineHeightFp}fp`)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).flexShrink(1);
        if (this.bookCount >= 0) {
          Text(`${this.bookCount} 本`).fontFamily(TYPE_SHELF_LIST_STATUS.fontFamily)
            .fontSize(TYPE_SHELF_LIST_STATUS.fontSizeFp).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        }
      }.layoutWeight(1).constraintSize({ minWidth: 0 }).opacity(this.titleOpacity);

      if (this.actionsEnabled) {
        Row({ space: 6 }) {
          this.viewModeSegments();
          this.filterButton();
        }
        .height(SHELF_FILTER_SIZE)
        .opacity(this.actionsOpacity);
      }
    }
    .width(this.contentWidth)
    .constraintSize({ minHeight: Math.max(this.actionsEnabled ? 44 : 0, readerScaledControlHeight(34, TYPE_APP_SECTION_LABEL.lineHeightFp as number,
      this.windowRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale)) })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private viewModeSegments() {
    Stack({ alignContent: Alignment.Center }) {
      // Bottom rim catchlight beneath the recessed groove.
      Row().width('100%').height(SHELF_SECTION_TRACK_HEIGHT).borderRadius(SHELF_SECTION_TRACK_HEIGHT / 2)
        .translate({ y: 0.75 })
        .backgroundColor(readerAppColor(this.appThemeScheme === 'night' ? 'TOK_LINE' : 'TOK_SURFACE_ELEVATED', this.appThemeScheme))
        .opacity(this.appThemeScheme === 'night' ? 1 : 0.85)
        .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
      // Recessed groove track (darker than page canvas with subtle top inner shade).
      Row().width('100%').height(SHELF_SECTION_TRACK_HEIGHT).borderRadius(SHELF_SECTION_TRACK_HEIGHT / 2)
        .clip(true)
        .backgroundColor(readerAppColor('app.segment.surface', this.appThemeScheme))
        .linearGradient({
          direction: GradientDirection.Bottom,
          colors: [
            [readerAppColor(this.appThemeScheme === 'night' ? 'app.segment.border' : 'app.chrome.raisedShadowAmbient', this.appThemeScheme), 0.0],
            [readerAppColor('app.surface.transparent', this.appThemeScheme), 0.36],
          ],
        })
        .border({ width: 0.75, color: readerAppColor('app.segment.border', this.appThemeScheme) })
        .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
      // Elevated sliding thumb inside the groove.
      Stack({ alignContent: Alignment.Start }) {
        Row().width(SHELF_SECTION_PILL_WIDTH).height(SHELF_SECTION_PILL_HEIGHT)
          .borderRadius(SHELF_SECTION_PILL_HEIGHT / 2)
          .backgroundColor(readerAppColor('app.segment.selected', this.appThemeScheme))
          .border({ width: 0.5, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
          .shadow(this.thumbShadow())
          .translate({ x: this.pillLane * SHELF_SECTION_ACTION_SIZE })
          .opacity(this.pillOpacity).accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
      }.width('100%').height(SHELF_SECTION_PILL_HEIGHT)
        .padding({ left: SHELF_SECTION_TRACK_INSET, right: SHELF_SECTION_TRACK_INSET })
        .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
      Row() {
        this.sectionAction('bookshelf_grid', 'reader-bookshelf-view-cover');
        this.sectionAction('bookshelf_list', 'reader-bookshelf-view-list');
      }.height(SHELF_SECTION_TRACK_HEIGHT).padding({ left: SHELF_SECTION_TRACK_INSET, right: SHELF_SECTION_TRACK_INSET });
    }.width(SHELF_SECTION_ACTION_SIZE * 2 + SHELF_SECTION_TRACK_INSET * 2).height(SHELF_SECTION_TRACK_HEIGHT)
      .hitTestBehavior(HitTestMode.Transparent);
  }

  private thumbShadow(): ShadowOptions {
    const observed = this.windowRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().densityPixels;
    const density = Number.isFinite(observed) && observed > 0 ? observed : 1;
    return {
      radius: 3.5 * density,
      color: readerAppColor('app.shadow.cover', this.appThemeScheme),
      offsetX: 0,
      offsetY: 1.5 * density,
    };
  }

  private currentPillLane(): number { return this.viewMode === 'cover' ? 0 : 1; }

  private syncViewModePill(): void {
    this.pillGeneration += 1;
    this.pillLane = this.currentPillLane();
    this.pillOpacity = 1;
  }

  private moveViewModePill(): void {
    if (!this.mounted) return;
    const lane = this.currentPillLane();
    if (lane === this.pillLane) return;
    const context = this.getUIContext();
    if (!this.reduceMotion) {
      try {
        context.animateTo(motionAnimateParam('app.navigation.pill'), (): void => { this.pillLane = lane; });
      } catch (_) { this.syncViewModePill(); }
      return;
    }
    const generation = ++this.pillGeneration;
    this.pillOpacity = 0;
    this.pillLane = lane;
    try {
      context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
        if (!this.mounted || generation !== this.pillGeneration) return;
        try {
          context.animateTo(readerMotionReducedFadeParam(), (): void => { this.pillOpacity = 1; });
        } catch (_) { this.pillOpacity = 1; }
      }));
    } catch (_) { this.pillOpacity = 1; }
  }

  @Builder
  private filterButton() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.sectionAction('bookshelf_filter', 'reader-bookshelf-filter-toggle');
      Row().width(6).height(6).borderRadius(3)
        .position({ x: 24, y: 6 })
        .backgroundColor(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme))
        .opacity(this.hasActiveFilters && !this.filterExpanded ? 1 : 0)
        .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
    }.width(SHELF_FILTER_SIZE).height(SHELF_FILTER_SIZE)
      .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private sectionAction(assetName: BookshelfSectionAction, focusId: string) {
    ReaderIconButton({ specId: assetName === 'bookshelf_filter' ? 'shelf-section' : 'shelf-view-segment',
      icon: this.sectionActionAsset(assetName),
      focusId,
      accessibilityLabel: this.actionLabel(assetName), actionEnabled: this.actionsEnabled, scheme: this.appThemeScheme,
      selectionState: this.isActive(assetName) ? 'selected' : 'none',
      onTap: (): void => this.activate(assetName) });
  }

  private isActive(assetName: BookshelfSectionAction): boolean {
    if (assetName === 'bookshelf_grid') return this.viewMode === 'cover';
    if (assetName === 'bookshelf_list') return this.viewMode === 'list';
    return this.filterExpanded;
  }

  private sectionActionAsset(assetName: BookshelfSectionAction): Resource {
    if (assetName === 'bookshelf_grid') {
      return this.actionsEnabled && this.viewMode === 'cover'
        ? (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_grid_theme_night') : $r('app.media.bookshelf_grid'))
        : (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_grid_outline_theme_night') : $r('app.media.bookshelf_grid_outline'));
    }
    if (assetName === 'bookshelf_list') {
      return this.actionsEnabled && this.viewMode === 'list'
        ? (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_list_active_theme_night') : $r('app.media.bookshelf_list_active'))
        : (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_list_theme_night') : $r('app.media.bookshelf_list'));
    }
    if (this.actionsEnabled && this.filterExpanded) {
      return this.appThemeScheme === 'night' ? $r('app.media.bookshelf_filter_active_theme_night') : $r('app.media.bookshelf_filter_active');
    }
    return this.appThemeScheme === 'night' ? $r('app.media.bookshelf_filter_theme_night') : $r('app.media.bookshelf_filter');
  }

  private actionLabel(assetName: BookshelfSectionAction): string {
    if (assetName === 'bookshelf_grid') {
      return '封面模式';
    }
    if (assetName === 'bookshelf_list') {
      return '列表模式';
    }
    return `${this.filterExpanded ? '收起筛选' : '展开筛选'}${this.hasActiveFilters ? '，已有筛选条件' : ''}`;
  }

  private activate(assetName: BookshelfSectionAction): void {
    if (!this.actionsEnabled) return;
    if (assetName === 'bookshelf_grid') this.onCover();
    else if (assetName === 'bookshelf_list') this.onList();
    else if (assetName === 'bookshelf_filter') this.onFilter();
  }
}
