import { readerLayoutCarrierResponseRegion } from '../../../ui/layout/ReaderPageNativeAttributes';
import { PageBackBar } from '../../../ui/chrome/PageBackBar';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { readerActionTouchRegion, readerUnionTouchRegion } from '../../../ui/controls/ReaderActionAccessibility';
import { readerScaledControlHeight, readerScaledWidth } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { TOK_CONTENT_MAX_W_TABLET } from '../../../ui/foundation/ReaderTokens';
import { DOWNLOAD_HEADER_ACTION_WIDTH, DOWNLOAD_HEADER_ACTION_HEIGHT } from '../../../ui/foundation/ReaderHeaderMetrics';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { ReaderEditingScrollBinding } from '../../../ui/layout/ReaderEditingScrollBinding';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { readerAppColor } from '../../../ui/foundation/ReaderAppColors';
import { ReaderScrollLayout, readerScrollEndOffset, readerScrollStartOffset } from '../../../ui/layout/ReaderScrollLayout';
import { ReaderSearchField } from '../../../ui/controls/ReaderSearchField';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { DOWNLOAD_VISUAL, downloadVisualColor } from './SharedDownloadVisualSpec';
import { TYPE_DOWNLOAD_BODY, TYPE_SELECT_DEFAULT_VALUE } from '../../../ui/foundation/ReaderTypography';
import { SharedDownloadBookCover } from './SharedDownloadBookCover';
import { TYPE_DOWNLOAD_CONTROL, TYPE_DOWNLOAD_META, TYPE_DOWNLOAD_TAG, TYPE_DOWNLOAD_BOOK_TITLE, TYPE_DOWNLOAD_META_LINE, TYPE_DOWNLOAD_STORAGE_META, TYPE_DOWNLOAD_TAB, TYPE_DOWNLOAD_TAB_SELECTED, TYPE_DOWNLOAD_LIST_TOOLS, TYPE_DOWNLOAD_SOURCE } from './DownloadTypography';
import { ReaderWindowMetricsSnapshot } from '../../../ui/foundation/ReaderWindowMetrics';
import type { DownloadBookView, DownloadChapterView, SharedDownloadFilters } from '../presentation/SharedDownloadProjection';
import { currentDownloadReadingChapterIndex, filterDownloadBooks, downloadChapterBookTitle, downloadsProvenEmpty } from '../presentation/SharedDownloadProjection';
import { ReaderInlineSelect } from '../../../ui/controls/ReaderInlineSelect';
import { readerSurfaceElevation } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import type { SharedDownloadReadingFocus, SharedDownloadUiBookTarget, SharedDownloadUiIntent, SharedDownloadUiAction } from '../presentation/SharedDownloadUiContract';
import type { SharedDownloadExpectedChapter } from '../application/SharedDownloadCoordinator';

export interface DownloadChoice { id: string; label: string; }
interface SharedDownloadScrollAnchor {
  detailKey: string;
  offset: number;
  managing: boolean;
  identity: string;
  presentation: number;
  fonts: number;
  windowRevision: number;
  viewportWidth: number;
  viewportHeight: number;
}
interface SharedDownloadListRestore {
  epoch: number;
  offset: number;
  identity: string;
  presentation: number;
  fonts: number;
  windowRevision: number;
  viewportWidth: number;
  viewportHeight: number;
  fontScale: number;
  managing: boolean;
}
export class SharedDownloadIdleFrame extends ReaderPostLayoutFrame {}

/** Individual reads track the mounted ArkUI properties used by each native node. */
export interface SharedDownloadMountFacts {
  readonly mounted: () => boolean;
  readonly mountedIdentity: () => string;
  readonly presentationGeneration: () => number;
  readonly fontsReady: () => boolean;
  readonly fontPreparationGeneration: () => number;
  readonly detailKey: () => string;
  readonly managing: () => boolean;
  readonly pageWidth: () => number;
  readonly pageHeight: () => number;
  readonly pageOriginX: () => number;
  readonly pageOriginY: () => number;
  readonly readerWindowMetricsRevision: () => number;
}

export interface SharedDownloadViewport {
  readonly pageViewportWidth: () => number;
  readonly availableHeight: () => number;
  readonly leftInset: () => number;
  readonly rightInset: () => number;
  readonly contentLeftInset: () => number;
  readonly contentRightInset: () => number;
  readonly contentTop: () => number;
  readonly bottomInset: () => number;
  readonly scrollLayout: () => ReaderScrollLayout;
  readonly fixedSelectionDockVisible: () => boolean;
  readonly dockMaterialRadius: (selection: boolean) => number;
  readonly raisedDockAreaChangeHandler: (selection: boolean) => (_old: Area, area: Area) => void;
}

export interface SharedDownloadChrome {
  readonly headerTop: () => number;
  readonly resolvedHeaderHeight: () => number;
  readonly dockLeftInset: () => number;
  readonly dockRightInset: () => number;
  readonly canEnterManaging: () => boolean;
  readonly headerHeightChangeHandler: () => ((height: number) => void);
  readonly back: () => void;
  readonly selectionLabel: () => string;
  readonly allSelected: () => boolean;
  readonly manageSelectAllAction: (generation: number) => (() => void);
  readonly managementGeneration: () => number;
  readonly renderManageAction: () => void;
}

export type SharedDownloadFilterField = 'query' | 'type' | 'state' | 'sourceId' | 'sort' | 'direction';

export interface SharedDownloadFrameView {
  readonly mount: SharedDownloadMountFacts;
  readonly layout: SharedDownloadViewport;
  readonly scheme: () => string;
  readonly getUIContext: () => UIContext;
  readonly metrics: () => ReaderWindowMetricsSnapshot;
  readonly fontScale: () => number;
  readonly presentationIsCurrent: (generation?: number) => boolean;
  readonly uiInputIsCurrent: (generation?: number) => boolean;
  readonly syncOverlayFocus: (preferred?: string, managing?: boolean, readingReturn?: SharedDownloadReadingFocus) => void;
}

export interface SharedDownloadBookFacts {
  readonly books: () => DownloadBookView[];
  readonly embeddedWide: () => boolean;
  readonly loading: () => boolean;
  readonly error: () => string;
}

export interface SharedDownloadBookChapterNavigation {
  readonly cancelChapterScrollRestore: () => void;
  readonly captureChapterOffset: () => number | undefined;
  readonly restoreManagementPosition: (offset: number) => void;
  readonly retireReadingReturnFocus: () => void;
  readonly currentChapter: () => DownloadChapterView | undefined;
  readonly locateCurrent: () => void;
  readonly selectedChapterActionAvailable: (action: SharedDownloadUiAction) => boolean;
  readonly selectedCount: () => number;
}

export interface SharedDownloadBookActions {
  readonly modalBlocking: () => boolean;
  readonly openTool: (kind: 'filter' | 'sort' | 'settings', trigger: string) => void;
  readonly openBookActions: (bookKey: string) => void;
  readonly activateBookStatus: (book: DownloadBookView) => void;
  readonly canRemoveBooks: (books: DownloadBookView[]) => boolean;
  readonly runSelectedChapters: (action: 'download' | 'pause') => void;
  readonly openSelectionActions: (chapters: boolean) => void;
}

export interface SharedDownloadBookListView {
  readonly frame: SharedDownloadFrameView;
  readonly input: SharedDownloadBookFacts;
  readonly chrome: SharedDownloadChrome;
  readonly chapters: SharedDownloadBookChapterNavigation;
  readonly actions: SharedDownloadBookActions;
  readonly filters: () => SharedDownloadFilters;
  readonly setFilter: (field: SharedDownloadFilterField, value: string) => void;
  readonly focusGeneration: () => number;
  readonly advanceFocusGeneration: () => number;
  readonly setManaging: (managing: boolean, trigger?: string) => void;
  readonly openBook: (book: DownloadBookView, generation?: number) => void;
  readonly publishViewState: () => void;
  readonly onRefresh: () => void;
  readonly onRefreshStorage: () => void;
  readonly onIntent: (intent: SharedDownloadUiIntent) => void;
}

export function sharedDownloadSelectWidth(frame: SharedDownloadFrameView, value: string, maximum: number, rowLabel: string,
  quick: boolean = false): number {
  const context = frame.getUIContext();
  const measure = context.getMeasureUtils();
  // ReaderInlineSelect uses ReaderSelect's default trigger, including its
  // 12fp face and 20vp padding + 8vp gap + 12vp chevron + 2vp border.
  const style = TYPE_SELECT_DEFAULT_VALUE;
  const measured = measure.measureText({ textContent: value, fontSize: style.fontSizeFp,
    fontFamily: style.fontFamily, fontWeight: style.fontWeight });
  const valuePx = Number.isFinite(measured) && measured > 0 ? measured : 0;
  const labelStyle = quick ? TYPE_DOWNLOAD_BOOK_TITLE : TYPE_DOWNLOAD_BODY;
  const labelPx = measure.measureText({ textContent: rowLabel, fontSize: labelStyle.fontSizeFp,
    fontFamily: labelStyle.fontFamily, fontWeight: labelStyle.fontWeight });
  const metrics = frame.metrics();
  const side = quick ? frame.layout.contentLeftInset() + frame.layout.contentRightInset() : DOWNLOAD_VISUAL.sheetBodySide * 2;
  const gap = quick ? DOWNLOAD_VISUAL.chapterToolbarGap : DOWNLOAD_VISUAL.settingsGap;
  const paneWidth = Math.min(TOK_CONTENT_MAX_W_TABLET, frame.layout.pageViewportWidth() > 0 ? frame.layout.pageViewportWidth() : metrics.windowRect.width);
  const available = Math.max(0, paneWidth - side - gap - Math.max(0, context.px2vp(labelPx)));
  const desired = Math.ceil(context.px2vp(valuePx)) + 42;
  return Math.min(maximum, available, desired);
}

function sharedDownloadTextUnits(text: string): number {
  let units = 0;
  for (let i = 0; i < text.length; i += 1) {
    units += text.charCodeAt(i) <= 0x7F ? 0.62 : 1;
  }
  return units;
}

export function sharedDownloadPrimaryInk(scheme: string): string { return downloadVisualColor('green', scheme); }

export function sharedDownloadControlHeight(scale: number, minimum: number, lineHeight: number, paddingY: number): number {
  return Math.max(minimum, lineHeight * scale + paddingY);
}

export function sharedDownloadFontScale(metrics: ReaderWindowMetricsSnapshot): number {
  const scale = metrics.systemFontScale;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export function sharedDownloadChapterProof(chapter: DownloadChapterView): SharedDownloadExpectedChapter {
    return { chapterIndex: chapter.index, chapterId: chapter.chapterId };
  }

export function sharedDownloadChapterIsRunning(chapter: DownloadChapterView): boolean {
    return !chapter.localComplete && (chapter.queueState === 'inProgress' || chapter.queueState === 'queued');
  }

export function sharedDownloadCurrentChapter(book: DownloadBookView): DownloadChapterView | undefined {
    const index = currentDownloadReadingChapterIndex(book);
    return index === undefined ? undefined : book.chapters.find((chapter: DownloadChapterView): boolean => chapter.navigable && chapter.index === index);
  }

export function sharedDownloadFocusKey(target: string): string { return target.length > 0 ? 'reader-download:' + target : ''; }

export function sharedDownloadChapterUnit(book: DownloadBookView | undefined): string {
    return book?.contentKind === 'novel' ? '章' : book?.contentKind === 'manga' ? '个条目' : '';
  }

export function sharedDownloadVisualIcon(name: string, scheme: string): Resource {
    if (name === 'filter') return scheme === 'night' ? $r('app.media.download_visual_filter_theme_night') : $r('app.media.download_visual_filter');
    if (name === 'storage') return scheme === 'night' ? $r('app.media.download_visual_storage_theme_night') : $r('app.media.download_visual_storage');
    if (name === 'trash') return scheme === 'night' ? $r('app.media.download_visual_trash_theme_night') : $r('app.media.download_visual_trash');
    if (name === 'trash_disabled') return scheme === 'night' ? $r('app.media.download_visual_trash_disabled_theme_night') : $r('app.media.download_visual_trash_disabled');
    if (name === 'more') return scheme === 'night' ? $r('app.media.download_visual_more_theme_night') : $r('app.media.download_visual_more');
    if (name === 'close') return scheme === 'night' ? $r('app.media.download_visual_close_theme_night') : $r('app.media.download_visual_close');
    if (name === 'download') return scheme === 'night' ? $r('app.media.download_visual_download_theme_night') : $r('app.media.download_visual_download');
    if (name === 'pause') return scheme === 'night' ? $r('app.media.download_visual_pause_theme_night') : $r('app.media.download_visual_pause');
    if (name === 'play') return scheme === 'night' ? $r('app.media.download_visual_play_theme_night') : $r('app.media.download_visual_play');
    if (name === 'retry') return scheme === 'night' ? $r('app.media.download_visual_retry_theme_night') : $r('app.media.download_visual_retry');
    if (name === 'check') return scheme === 'night' ? $r('app.media.download_visual_check_theme_night') : $r('app.media.download_visual_check');
    if (name === 'chevron') return scheme === 'night' ? $r('app.media.download_visual_chevron_theme_night') : $r('app.media.download_visual_chevron');
    if (name === 'empty') return scheme === 'night' ? $r('app.media.download_visual_empty_theme_night') : $r('app.media.download_visual_empty');
    if (name === 'sort_asc') return scheme === 'night' ? $r('app.media.download_visual_sort_asc_theme_night') : $r('app.media.download_visual_sort_asc');
    if (name === 'sort_desc') return scheme === 'night' ? $r('app.media.download_visual_sort_desc_theme_night') : $r('app.media.download_visual_sort_desc');
    return scheme === 'night' ? $r('app.media.download_visual_more_theme_night') : $r('app.media.download_visual_more');
  }

@Observed
export class SharedDownloadBookListPaint {
  @Track searchInputRevision: number = 0;
  @Track selectedBookKeys: string[] = [];
  @Track bookCopyHeights: Map<string, number> = new Map<string, number>();
  @Track bookContentHeights: Map<string, number> = new Map<string, number>();
}

/** Owns the book-list native scroll leases, visible selection and retained card paint. */
export class SharedDownloadBookListOwner {
  readonly view: SharedDownloadBookListView;
  readonly paint: () => SharedDownloadBookListPaint;

  constructor(view: SharedDownloadBookListView, paint: () => SharedDownloadBookListPaint) {
    this.view = view;
    this.paint = paint;
  }

  readonly editingHost: ReaderEditingVisibility = new ReaderEditingVisibility();

  readonly editingScroll: ReaderEditingScrollBinding = new ReaderEditingScrollBinding();

  private closeSelectionAfterRemoval: boolean = false;

  listScroller: Scroller = new Scroller();

  listOffset: number = 0;
  private listScrollRestoreEpoch: number = 0;
  private listScrollRestorePending: SharedDownloadListRestore | undefined;

  private managingScrollRestore: SharedDownloadScrollAnchor | undefined;

  private managingScrollAnchor: SharedDownloadScrollAnchor | undefined;

  private browseScrollBeforeManaging: SharedDownloadScrollAnchor | undefined;

  private managingDockMeasured: boolean = false;

  manageHeaderActionWidth(): number {
    return Math.max(DOWNLOAD_HEADER_ACTION_WIDTH, Math.ceil(2 * TYPE_DOWNLOAD_CONTROL.fontSizeFp * this.view.frame.fontScale() + 12));
  }

  private listToolsAvailableWidth(): number {
    return Math.max(0, this.view.frame.layout.pageViewportWidth() - this.view.frame.layout.contentLeftInset() - this.view.frame.layout.contentRightInset());
  }

  listToolControlHeight(): number {
    return sharedDownloadControlHeight(this.view.frame.fontScale(), DOWNLOAD_VISUAL.touchTarget, TYPE_DOWNLOAD_LIST_TOOLS.lineHeightFp as number,
      DOWNLOAD_VISUAL.toolPaddingY * 2);
  }

  listFilterWidth(): number {
    return Math.min(Math.max(0, this.listToolsAvailableWidth() - DOWNLOAD_VISUAL.listToolsGap),
      Math.max(DOWNLOAD_VISUAL.touchTarget, Math.ceil(sharedDownloadTextUnits(this.filterLabel()) * TYPE_DOWNLOAD_LIST_TOOLS.fontSizeFp * this.view.frame.fontScale()) +
        DOWNLOAD_VISUAL.listToolIconSize + DOWNLOAD_VISUAL.listToolIconGap));
  }

  listSortLabelWidth(): number {
    return Math.min(Math.max(0, this.listToolsAvailableWidth() - DOWNLOAD_VISUAL.listToolsGap -
      DOWNLOAD_VISUAL.touchTarget - DOWNLOAD_VISUAL.sortPairGap),
      Math.max(DOWNLOAD_VISUAL.touchTarget, Math.ceil(sharedDownloadTextUnits(this.sortLabel()) * TYPE_DOWNLOAD_LIST_TOOLS.fontSizeFp * this.view.frame.fontScale()) + 6));
  }

  listSortWidth(): number { return DOWNLOAD_VISUAL.touchTarget + DOWNLOAD_VISUAL.sortPairGap + this.listSortLabelWidth(); }

  listToolCountWidth(): number {
    return Math.min(this.listToolsAvailableWidth(), Math.ceil(sharedDownloadTextUnits(`${this.visibleBooks().length} / ${this.view.input.books().length} 本书`) *
      TYPE_DOWNLOAD_META.fontSizeFp * this.view.frame.fontScale()));
  }

  listToolsInline(): boolean {
    return this.listFilterWidth() + this.listSortWidth() + this.listToolCountWidth() + DOWNLOAD_VISUAL.listToolsGap * 3 <=
      this.listToolsAvailableWidth();
  }

  searchInputIdentity(): string {
    return JSON.stringify([this.view.frame.mount.mountedIdentity(), this.view.frame.mount.presentationGeneration(), this.paint().searchInputRevision]);
  }

  private ownsSearchInput(identity: string): boolean {
    return this.view.frame.presentationIsCurrent() && this.view.frame.mount.detailKey().length === 0 && identity === this.searchInputIdentity();
  }

  searchInputIsCurrent(identity: string): boolean {
    return this.ownsSearchInput(identity) && this.view.frame.uiInputIsCurrent() && !this.view.actions.modalBlocking();
  }

  changeSearchInput(value: string, identity: string): void {
    if (!this.ownsSearchInput(identity)) return;
    if (!this.searchInputIsCurrent(identity)) {
      // A native edit may have painted before its callback lost input rights.
      // Replace only this current field; an old opening cannot rebuild its successor.
      if (value !== this.view.filters().query) this.paint().searchInputRevision += 1;
      return;
    }
    this.cancelManagingScroll();
    this.view.setFilter('query', value); this.listScroller.scrollTo({ xOffset: 0, yOffset: 0 });
  }

  clearSearchInput(identity: string): void {
    if (!this.searchInputIsCurrent(identity) || this.view.filters().query.length === 0) return;
    this.view.setFilter('query', '');
  }

  tabInk(id: string): string {
    return downloadVisualColor(this.view.filters().type === id ? 'green' : 'ink', this.view.frame.scheme());
  }

  statusInk(book: DownloadBookView): string {
    return downloadVisualColor(book.stateLabel === '下载失败' ? 'danger' : book.stateLabel === '未下载' ? 'muted' : 'green', this.view.frame.scheme());
  }

  bookGetter(snapshot: DownloadBookView): () => DownloadBookView {
    return (): DownloadBookView => this.currentBook(snapshot);
  }

  private currentBook(snapshot: DownloadBookView): DownloadBookView {
    return this.findCurrentBook(snapshot) ?? snapshot;
  }

  findCurrentBook(snapshot: DownloadBookView): DownloadBookView | undefined {
    return this.view.input.books().find((current: DownloadBookView): boolean => current.key === snapshot.key &&
      current.sourceId === snapshot.sourceId && current.bookId === snapshot.bookId);
  }

  eventBook(book: () => DownloadBookView, generation: number = this.view.frame.mount.presentationGeneration()): DownloadBookView | undefined {
    return this.view.frame.uiInputIsCurrent(generation) && !this.view.actions.modalBlocking() ? this.findCurrentBook(book()) : undefined;
  }

  clearFilters(ownerGeneration: number = this.view.frame.mount.presentationGeneration()): void {
    if (!this.view.frame.uiInputIsCurrent(ownerGeneration) || this.view.actions.modalBlocking()) return;
    this.cancelListScrollRestore();
    this.view.chapters.cancelChapterScrollRestore();
    this.cancelManagingScroll();
    this.view.setFilter('query', ''); this.view.setFilter('type', 'all'); this.view.setFilter('state', 'all'); this.view.setFilter('sourceId', 'all');
    this.listScroller.scrollTo({ xOffset: 0, yOffset: 0 });
    this.view.publishViewState();
  }

  visibleBooks(): DownloadBookView[] { return filterDownloadBooks(this.view.input.books(), this.view.filters()); }

  detail(): DownloadBookView | undefined { return this.view.input.books().find((book: DownloadBookView): boolean => book.key === this.view.frame.mount.detailKey()); }

  visibleSelectedBooks(): DownloadBookView[] {
    const selected = new Set<string>(this.paint().selectedBookKeys);
    return this.visibleBooks().filter((book: DownloadBookView): boolean => selected.has(book.key));
  }

  downloadTasksEmpty(): boolean {
    return !this.view.input.loading() && this.view.input.error().length === 0 && downloadsProvenEmpty(this.view.input.books());
  }

  retireEmptyBookSelection(): void {
    if (!this.closeSelectionAfterRemoval || !this.view.frame.mount.managing() || this.view.frame.mount.detailKey().length > 0 ||
      !this.downloadTasksEmpty() || this.view.actions.modalBlocking()) return;
    this.view.setManaging(false);
    if (!this.view.frame.mount.managing()) this.closeSelectionAfterRemoval = false;
  }

  authorSource(book: DownloadBookView): string {
    return [book.author, book.sourceLabel].filter((value: string): boolean => value.trim().length > 0).join(' · ');
  }

  downloadCount(book: DownloadBookView, secondary: boolean): string {
    if (book.downloadedChapters === undefined) return '';
    if (secondary || book.totalChapters === undefined) return `已下载 ${book.downloadedChapters}${sharedDownloadChapterUnit(book)}`;
    return `已下载 ${book.downloadedChapters} / ${book.totalChapters} ${sharedDownloadChapterUnit(book)}`;
  }

  totalBytesLabel(): string {
    const known = this.view.input.books().filter((book: DownloadBookView): boolean => book.bytes !== undefined);
    if (known.length !== this.view.input.books().length) return '已下载内容';
    const bytes = known.reduce((sum: number, book: DownloadBookView): number => sum + (book.bytes ?? 0), 0);
    if (bytes >= 1024 * 1024 * 1024) return `已下载 ${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    return `已下载 ${Math.round(bytes / (1024 * 1024))} MB`;
  }

  sortLabel(): string { return this.sortChoices().find((choice: DownloadChoice): boolean => choice.id === this.view.filters().sort)?.label ?? '最近阅读'; }

  filterLabel(): string {
    const count = Number(this.view.filters().state !== 'all') + Number(this.view.filters().sourceId !== 'all'); return count > 0 ? `筛选 · ${count}` : '筛选';
  }

  stateChoices(): DownloadChoice[] {
    return [{ id: 'all', label: '全部状态' }, { id: 'downloading', label: '下载中' }, { id: 'downloaded', label: '已下载' }, { id: 'none', label: '未下载' }];
  }

  sortChoices(): DownloadChoice[] {
    return [{ id: 'recent', label: '最近阅读' }, { id: 'title', label: '书名' }, { id: 'progress', label: '下载比例' }, { id: 'size', label: '下载大小' }];
  }

  sourceChoices(): DownloadChoice[] {
    const names = new Map<string, string>();
    for (const book of this.view.input.books()) {
      if (book.sourceId !== 'all' && !names.has(book.sourceId)) names.set(book.sourceId, book.sourceLabel || book.sourceId);
    }
    // ReaderInlineSelect reports the displayed value. Keep it unique for
    // this opening even when sources have identical user-facing names.
    const choices: DownloadChoice[] = [{ id: 'all', label: '全部书源' }];
    const assigned = new Set<string>(['全部书源']);
    const reserved = new Set<string>(names.values());
    names.forEach((name: string, id: string): void => {
      let label = name;
      let ordinal = 2;
      if (assigned.has(label)) {
        do {
          label = `${name} (${ordinal})`;
          ordinal += 1;
        } while (assigned.has(label) || reserved.has(label));
      }
      assigned.add(label);
      choices.push({ id, label });
    });
    return choices;
  }

  statusActionLabel(book: DownloadBookView): string {
    const action = book.statusAction;
    return action === 'pause' ? '暂停' : action === 'retry' ? '重试' : book.stateLabel;
  }

  statusActionAccessibility(book: DownloadBookView): string {
    const actionLabel = this.statusActionLabel(book);
    const status = book.stateLabel === actionLabel ? actionLabel : `${book.stateLabel}，${actionLabel}`;
    return `${book.title}，${status}`;
  }

  statusIcon(book: DownloadBookView): Resource {
    const action = book.statusAction;
    if (action === 'completed') return sharedDownloadVisualIcon('check', this.view.frame.scheme());
    if (action === 'pause' || action === 'retry') return sharedDownloadVisualIcon(action, this.view.frame.scheme());
    if (book.chapters.some((chapter: DownloadChapterView): boolean => chapter.queueState === 'paused' && !chapter.localComplete)) return sharedDownloadVisualIcon('play', this.view.frame.scheme());
    return sharedDownloadVisualIcon('download', this.view.frame.scheme());
  }

  toggleBook(key: string, selected: boolean): void {
    if (!this.visibleBooks().some((book: DownloadBookView): boolean => book.key === key)) return;
    this.paint().selectedBookKeys = selected ? this.paint().selectedBookKeys.concat([key]).filter((value: string, index: number, all: string[]): boolean => all.indexOf(value) === index)
      : this.paint().selectedBookKeys.filter((value: string): boolean => value !== key);
  }

  beginOpening(offset: number): void {
    this.listOffset = offset;
    this.closeSelectionAfterRemoval = false;
  }

  resetRemovalClosure(): void { this.closeSelectionAfterRemoval = false; }

  deferSelectionCloseAfterRemoval(): void { this.closeSelectionAfterRemoval = true; }

  retireSearchInput(): void { this.paint().searchInputRevision += 1; }

  retainCurrentBookSelection(): void {
    const keys = new Set<string>(this.view.input.books().map((book: DownloadBookView): string => book.key));
    const old = this.paint().selectedBookKeys;
    const retained = old.filter((key: string): boolean => keys.has(key));
    if (retained.length !== old.length) this.paint().selectedBookKeys = retained;
  }

  resetSelection(): void { this.paint().selectedBookKeys = []; }

  toggleBookSelection(key: string): void { this.toggleBook(key, !this.paint().selectedBookKeys.includes(key)); }

  toggleVisibleSelection(allSelected: boolean): void {
    const visible = this.visibleBooks().map((item: DownloadBookView): string => item.key);
    const matching = new Set<string>(visible);
    const hidden = this.paint().selectedBookKeys.filter((key: string): boolean => !matching.has(key));
    this.paint().selectedBookKeys = allSelected ? hidden : hidden.concat(visible);
  }

  captureManagingOffset(): number | undefined {
    const retained = this.managingScrollAnchor ?? this.browseScrollBeforeManaging;
    if (retained !== undefined && this.managingScrollIsCurrent(retained)) return retained.offset;
    return this.view.frame.mount.detailKey().length > 0 ? this.view.chapters.captureChapterOffset() : this.captureListOffset();
  }

  restoreManagementPosition(offset: number | undefined, managing: boolean): void {
    // A detached controller supplies no proven position for a future List.
    if (offset === undefined) return;
    const mount = this.view.frame.mount;
    const anchor: SharedDownloadScrollAnchor = {
      detailKey: mount.detailKey(), offset, managing, identity: mount.mountedIdentity(),
      presentation: mount.presentationGeneration(), fonts: mount.fontPreparationGeneration(),
      windowRevision: mount.readerWindowMetricsRevision(),
      viewportWidth: this.view.frame.layout.pageViewportWidth(), viewportHeight: this.view.frame.layout.availableHeight(),
    };
    // A shorter management List can clamp this offset. Retain the browsing
    // position until direct scrolling or a different view invalidates it.
    if (managing) this.browseScrollBeforeManaging = anchor;
    this.managingScrollAnchor = anchor;
    this.managingScrollRestore = anchor;
    this.managingDockMeasured = false;
    this.restoreManagingScroll();
  }

  onManagementDockMeasured(): void {
    const anchor = this.managingScrollAnchor;
    if (anchor === undefined) return;
    if (!this.managingScrollIsCurrent(anchor)) { this.cancelManagingScroll(); return; }
    if (!this.view.frame.layout.fixedSelectionDockVisible()) return;
    // The dock can finish measuring after the first restored frame.
    this.managingDockMeasured = true;
    if (this.managingScrollRestore === undefined) {
      this.managingScrollRestore = anchor;
      this.restoreManagingScroll();
    }
  }

  private managingScrollIsCurrent(anchor: SharedDownloadScrollAnchor): boolean {
    return this.view.frame.presentationIsCurrent(anchor.presentation) && this.view.frame.mount.fontsReady() &&
      this.view.frame.mount.mountedIdentity() === anchor.identity && this.view.frame.mount.fontPreparationGeneration() === anchor.fonts &&
      this.view.frame.mount.readerWindowMetricsRevision() === anchor.windowRevision && this.view.frame.layout.pageViewportWidth() === anchor.viewportWidth &&
      this.view.frame.layout.availableHeight() === anchor.viewportHeight && this.view.frame.mount.managing() === anchor.managing &&
      this.view.frame.mount.detailKey() === anchor.detailKey && (anchor.detailKey.length === 0 || this.detail() !== undefined);
  }

  private restoreManagingScroll(): void {
    const pending = this.managingScrollRestore;
    if (pending === undefined) return;
    if (!this.managingScrollIsCurrent(pending)) { this.cancelManagingScroll(); return; }
    this.view.frame.getUIContext().postFrameCallback(new SharedDownloadIdleFrame(this.view.frame.getUIContext(), (): void => {
      if (this.managingScrollRestore !== pending) return;
      if (!this.managingScrollIsCurrent(pending)) { this.cancelManagingScroll(); return; }
      try {
        if (pending.detailKey.length > 0) this.view.chapters.restoreManagementPosition(pending.offset);
        else this.listScroller.scrollTo({ xOffset: 0, yOffset: pending.offset });
      } catch (_error) {
        this.cancelManagingScroll();
        return;
      }
      this.managingScrollRestore = undefined;
      if (this.managingDockMeasured || !this.view.frame.layout.fixedSelectionDockVisible()) this.managingScrollAnchor = undefined;
    }));
  }

  cancelManagingScroll(retireBrowseAnchor: boolean = true): void {
    this.managingScrollRestore = undefined;
    this.managingScrollAnchor = undefined;
    if (retireBrowseAnchor) this.browseScrollBeforeManaging = undefined;
  }

  onListWillScroll(offset: number, source: ScrollSource, presentation: number, detailKey: string): void {
    if (!Number.isFinite(offset) || offset === 0 || !this.view.frame.presentationIsCurrent(presentation) ||
      this.view.frame.mount.detailKey() !== detailKey) return;
    if (source === ScrollSource.DRAG || source === ScrollSource.FLING || source === ScrollSource.OTHER_USER_INPUT ||
      source === ScrollSource.SCROLL_BAR || source === ScrollSource.SCROLL_BAR_FLING) this.cancelManagingScroll();
  }

  onListTouch(event: TouchEvent): void {
    if (event.type === TouchType.Down) {
      this.cancelListScrollRestore();
      this.cancelManagingScroll(false);
      this.view.chapters.cancelChapterScrollRestore();
      this.view.chapters.retireReadingReturnFocus();
    }
  }

  onListFilterChanged(): void {
    // Keyboard edits and overlay selections do not necessarily touch the
    // List. Their new content owns the viewport just like a direct gesture.
    this.cancelListScrollRestore();
    this.view.chapters.cancelChapterScrollRestore();
    this.cancelManagingScroll();
    this.view.publishViewState();
  }

  selectedQueueTargets(resume: boolean): SharedDownloadUiBookTarget[] {
    const targets: SharedDownloadUiBookTarget[] = [];
    for (const book of this.visibleSelectedBooks()) {
      if (book.projectionStatus !== 'ready') continue;
      const chapters = book.chapters.filter((chapter: DownloadChapterView): boolean =>
        chapter.navigable && chapter.chapterId.length > 0 && !chapter.localComplete &&
        (resume ? chapter.queueState === 'paused' || chapter.queueState === 'failed' : sharedDownloadChapterIsRunning(chapter)));
      if (chapters.length === 0) continue;
      targets.push({ sourceId: book.sourceId, bookId: book.bookId,
        chapterIndices: chapters.map((chapter: DownloadChapterView): number => chapter.index),
        expectedChapters: chapters.map((chapter: DownloadChapterView): SharedDownloadExpectedChapter => sharedDownloadChapterProof(chapter)) });
    }
    return targets;
  }

  selectedBooksCanBeRemoved(): boolean {
    const books = this.visibleSelectedBooks();
    return this.view.actions.canRemoveBooks(books);
  }

  sendSelectedQueueAction(resume: boolean): void {
    if (!this.view.frame.uiInputIsCurrent() || !this.view.frame.mount.managing() || this.view.frame.mount.detailKey().length > 0 || this.view.actions.modalBlocking()) return;
    const books = this.selectedQueueTargets(resume);
    if (books.length > 0) this.view.onIntent({ action: resume ? 'download' : 'pause', scope: 'books', books });
  }

  captureListOffset(): number | undefined {
    // @Watch runs synchronously before the main List is reattached when
    // returning from chapters. The platform may have no current offset then;
    // retain the last proven position instead of dereferencing an empty result.
    try {
      const offset = this.listScroller.currentOffset();
      if (offset !== undefined && Number.isFinite(offset.yOffset)) {
        this.listOffset = offset.yOffset;
        return offset.yOffset;
      }
    } catch (_error) {
      // A retired/unbound native controller cannot replace a saved position.
    }
    return undefined;
  }

  restoreListOffset(offset: number = this.listOffset, focusTarget: string = ''): void {
    if (!this.view.frame.presentationIsCurrent() || !this.view.frame.mount.fontsReady() || this.view.frame.mount.detailKey().length > 0) return;
    this.cancelListScrollRestore();
    const focusGeneration = focusTarget.length > 0 ? this.view.advanceFocusGeneration() : this.view.focusGeneration();
    const pending: SharedDownloadListRestore = { epoch: this.listScrollRestoreEpoch, offset,
      identity: this.view.frame.mount.mountedIdentity(), presentation: this.view.frame.mount.presentationGeneration(), fonts: this.view.frame.mount.fontPreparationGeneration(),
      windowRevision: this.view.frame.mount.readerWindowMetricsRevision(), viewportWidth: this.view.frame.layout.pageViewportWidth(),
      viewportHeight: this.view.frame.layout.availableHeight(), fontScale: this.view.frame.fontScale(), managing: this.view.frame.mount.managing() };
    this.listScrollRestorePending = pending;
    try {
      this.view.frame.getUIContext().postFrameCallback(new SharedDownloadIdleFrame(this.view.frame.getUIContext(), (): void => {
        if (this.listScrollRestorePending !== pending || this.listScrollRestoreEpoch !== pending.epoch) return;
        if (!this.view.frame.presentationIsCurrent(pending.presentation) || !this.view.frame.mount.fontsReady() || this.view.frame.mount.mountedIdentity() !== pending.identity ||
          this.view.frame.mount.fontPreparationGeneration() !== pending.fonts || this.view.frame.mount.detailKey().length > 0 || this.view.frame.mount.managing() !== pending.managing ||
          this.view.frame.mount.readerWindowMetricsRevision() !== pending.windowRevision || this.view.frame.layout.pageViewportWidth() !== pending.viewportWidth ||
          this.view.frame.layout.availableHeight() !== pending.viewportHeight || this.view.frame.fontScale() !== pending.fontScale ||
          (focusTarget.length > 0 && focusGeneration !== this.view.focusGeneration())) {
          this.cancelListScrollRestore(); return;
        }
        this.listScrollRestorePending = undefined;
        try { this.listScroller.scrollTo({ xOffset: 0, yOffset: pending.offset }); } catch (_unboundList) { return; }
        if (focusTarget.length > 0 && !this.view.actions.modalBlocking() && !this.view.frame.mount.managing()) this.view.frame.syncOverlayFocus(focusTarget);
      }));
    } catch (_unmounted) { this.cancelListScrollRestore(); }
  }

  cancelListScrollRestore(): void {
    this.listScrollRestoreEpoch += 1;
    this.listScrollRestorePending = undefined;
  }

  onListGeometryChanged(): void {
    const pending = this.listScrollRestorePending;
    if (pending !== undefined && (this.view.frame.mount.readerWindowMetricsRevision() !== pending.windowRevision ||
      this.view.frame.layout.pageViewportWidth() !== pending.viewportWidth || this.view.frame.layout.availableHeight() !== pending.viewportHeight ||
      this.view.frame.fontScale() !== pending.fontScale)) this.cancelListScrollRestore();
  }

  bookHeight(key: string): number { return Math.max(DOWNLOAD_VISUAL.coverHeight, this.paint().bookCopyHeights.get(key) ?? DOWNLOAD_VISUAL.coverHeight); }

  bookProgressSpacer(key: string): number {
    return Math.max(0, DOWNLOAD_VISUAL.bookMinHeight - (this.paint().bookContentHeights.get(key) ??
      DOWNLOAD_VISUAL.bookTopHeight + DOWNLOAD_VISUAL.sourceLineHeight + DOWNLOAD_VISUAL.sourceTop + DOWNLOAD_VISUAL.statusHeight + DOWNLOAD_VISUAL.progressTop) - DOWNLOAD_VISUAL.progressHeight);
  }

  recordBookHeight(key: string, height: number): void {
    if (!Number.isFinite(height) || height <= 0 || Math.abs(height - (this.paint().bookCopyHeights.get(key) ?? 0)) < 0.5) return;
    const values = new Map(this.paint().bookCopyHeights); values.set(key, height); this.paint().bookCopyHeights = values;
  }

  recordBookContentHeight(key: string, height: number): void {
    if (!Number.isFinite(height) || height <= 0 || Math.abs(height - (this.paint().bookContentHeights.get(key) ?? 0)) < 0.5) return;
    const values = new Map(this.paint().bookContentHeights); values.set(key, height); this.paint().bookContentHeights = values;
  }
}

interface SharedDownloadBookListOwnerSlot {
  readonly owner: SharedDownloadBookListOwner;
}

interface SharedDownloadBookListInput {
  readonly ownerGeneration: number;
}

@Builder
export function SharedDownloadBookList(owner: SharedDownloadBookListOwner, input: SharedDownloadBookListInput) {
  List({ scroller: owner.listScroller }) {
    if (!owner.view.input.embeddedWide()) { ListItem() { SharedDownloadCompactHeader({ owner: owner }); } }
    ListItem() { Column() { DownloadListControls({ owner }); }.width('100%').padding({ left: owner.view.frame.layout.contentLeftInset(), right: owner.view.frame.layout.contentRightInset() }); }
    if (owner.view.input.loading() && owner.view.input.books().length === 0) {
      ListItem() { Column() { ReaderPageState({ title: '正在读取书架…', loading: true }); }.width('100%').padding({ left: owner.view.frame.layout.contentLeftInset(), right: owner.view.frame.layout.contentRightInset() }); }
    } else if (owner.view.input.error().length > 0 && owner.view.input.books().length === 0) {
      ListItem() { Column() { ReaderPageState({ title: '下载信息读取失败', message: owner.view.input.error(), actionLabel: '重试', onAction: (): void => { if (owner.view.frame.uiInputIsCurrent()) owner.view.onRefresh(); } }); }.width('100%').padding({ left: owner.view.frame.layout.contentLeftInset(), right: owner.view.frame.layout.contentRightInset() }); }
    }
    if (owner.visibleBooks().length === 0 && !owner.view.input.loading() && !(owner.view.input.error().length > 0 && owner.view.input.books().length === 0)) {
      ListItem() {
        Column() {
          ReaderPageState({ title: owner.view.input.books().length === 0 ? '书架为空' : '没有匹配的书籍',
            message: owner.view.input.books().length === 0 ? '加入书架后，可在这里管理下载' : '调整搜索关键词或筛选条件',
            actionLabel: owner.view.input.books().length === 0 ? '' : '清除筛选',
            onAction: (): void => owner.clearFilters(input.ownerGeneration) });
        }.width('100%').padding({ left: owner.view.frame.layout.contentLeftInset(), right: owner.view.frame.layout.contentRightInset() });
      }
    }
    if (!owner.view.frame.mount.managing() && owner.visibleBooks().length > 0 && owner.downloadTasksEmpty()) {
      ListItem() {
        Column() {
          ReaderPageState({ title: '暂无下载任务', message: '打开书籍，选择要下载的章节。' });
        }.width('100%').padding({ left: owner.view.frame.layout.contentLeftInset(), right: owner.view.frame.layout.contentRightInset() });
      }
    }
    ForEach(owner.visibleBooks(), (book: DownloadBookView) => {
      ListItem() { Column() { SharedDownloadBookRow(owner, { book: owner.bookGetter(book), secondary: false, ownerGeneration: owner.view.frame.mount.presentationGeneration() }); }.width('100%').padding({ left: owner.view.frame.layout.contentLeftInset(), right: owner.view.frame.layout.contentRightInset() }); }
    }, (book: DownloadBookView): string => book.key);
    if (!owner.view.frame.layout.fixedSelectionDockVisible()) { ListItem() { SharedDownloadCompactDock({ owner: owner }); } }
  }.width('100%').height('100%').scrollBar(BarState.Auto).onScrollStop((): void => owner.view.publishViewState())
    .id(owner.editingScroll.id)
    .onAppear((): void => owner.editingScroll.mount(owner.view.frame.getUIContext(), owner.editingHost, owner.listScroller,
      (): number => readerScrollStartOffset(owner.view.frame.layout.scrollLayout())))
    .onDisAppear((): void => owner.editingScroll.unmount())
    .onAreaChange((): void => owner.editingHost.refresh())
    .onTouch((event: TouchEvent): void => owner.onListTouch(event))
    .onWillScroll((offset: number, _state: ScrollState, source: ScrollSource): void =>
      owner.onListWillScroll(offset, source, input.ownerGeneration, ''))
    .contentStartOffset(readerScrollStartOffset(owner.view.frame.layout.scrollLayout()))
    .contentEndOffset(readerScrollEndOffset(owner.view.frame.layout.scrollLayout()));
}

@Builder
function DownloadListControls($$: SharedDownloadBookListOwnerSlot) {
  ForEach([$$.owner.searchInputIdentity()], (identity: string): void => {
  Column({ space: 0 }) {
    DownloadSearchField($$.owner, { identity: identity });
    Row({ space: DOWNLOAD_VISUAL.tabsGap }) {
      DownloadTypeTab($$.owner, { id: 'all', label: '全部', identity: identity });
      DownloadTypeTab($$.owner, { id: 'manga', label: '漫画', identity: identity });
      DownloadTypeTab($$.owner, { id: 'novel', label: '小说', identity: identity });
    }.width('100%').padding(DOWNLOAD_VISUAL.tabsPadding).backgroundColor(downloadVisualColor('soft', $$.owner.view.frame.scheme())).borderRadius(DOWNLOAD_VISUAL.tabsRadius)
      .margin({ top: DOWNLOAD_VISUAL.tabsTop, bottom: DOWNLOAD_VISUAL.tabsBottom });
    DownloadListTools($$.owner, { identity: identity });
  }.width('100%');
  }, (identity: string): string => identity);
}

interface DownloadListToolsInput {
  readonly identity: string;
}

@Builder
function DownloadListTools(owner: SharedDownloadBookListOwner, input: DownloadListToolsInput) {
  if (owner.listToolsInline()) {
    Row({ space: DOWNLOAD_VISUAL.listToolsGap }) {
      DownloadListFilterControl(owner, { identity: input.identity });
      DownloadListSortControls(owner, { identity: input.identity });
      Blank().layoutWeight(1);
      DownloadListToolCount({ owner });
    }.width('100%').constraintSize({ minHeight: owner.listToolControlHeight() })
      .margin({ bottom: DOWNLOAD_VISUAL.listToolsBottom });
  } else {
    Column({ space: DOWNLOAD_VISUAL.listToolsGap }) {
      Flex({ wrap: FlexWrap.Wrap }) {
        Column() { DownloadListFilterControl(owner, { identity: input.identity }); }.width(owner.listFilterWidth())
          .margin({ right: DOWNLOAD_VISUAL.listToolsGap, bottom: DOWNLOAD_VISUAL.listToolsGap });
        Column() { DownloadListSortControls(owner, { identity: input.identity }); }.width(owner.listSortWidth())
          .margin({ right: DOWNLOAD_VISUAL.listToolsGap, bottom: DOWNLOAD_VISUAL.listToolsGap });
      }.width('100%').constraintSize({ minHeight: owner.listToolControlHeight() });
      Row() { Blank().layoutWeight(1); DownloadListToolCount({ owner }); }.width('100%');
    }.width('100%').margin({ bottom: DOWNLOAD_VISUAL.listToolsBottom });
  }
}

interface DownloadListFilterControlInput {
  readonly identity: string;
}

@Builder
function DownloadListFilterControl(owner: SharedDownloadBookListOwner, input: DownloadListFilterControlInput) {
  Button({ type: ButtonType.Normal }) {
    Row({ space: DOWNLOAD_VISUAL.listToolIconGap }) {
      Image(sharedDownloadVisualIcon('filter', owner.view.frame.scheme())).width(DOWNLOAD_VISUAL.listToolIconSize).height(DOWNLOAD_VISUAL.listToolIconSize);
      Text(owner.filterLabel()).fontFamily(TYPE_DOWNLOAD_LIST_TOOLS.fontFamily).fontWeight(TYPE_DOWNLOAD_LIST_TOOLS.fontWeight)
        .fontSize(TYPE_DOWNLOAD_LIST_TOOLS.fontSizeFp).lineHeight(TYPE_DOWNLOAD_LIST_TOOLS.lineHeightFp as number).halfLeading(true)
        .minFontScale(1).maxFontScale(owner.view.frame.fontScale()).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .fontColor(downloadVisualColor('ink', owner.view.frame.scheme())).layoutWeight(1);
    }.width('100%').alignItems(VerticalAlign.Center);
  }.width(owner.listFilterWidth()).padding({ top: DOWNLOAD_VISUAL.toolPaddingY, bottom: DOWNLOAD_VISUAL.toolPaddingY })
    .constraintSize({ minHeight: owner.listToolControlHeight() }).borderRadius(0).backgroundColor(Color.Transparent)
    .accessibilityText('筛选书籍').id(sharedDownloadFocusKey('filter')).onClick((): void => {
      if (owner.searchInputIsCurrent(input.identity)) owner.view.actions.openTool('filter', 'filter');
    });
}

interface DownloadListSortControlsInput {
  readonly identity: string;
}

@Builder
function DownloadListSortControls(owner: SharedDownloadBookListOwner, input: DownloadListSortControlsInput) {
  Row({ space: DOWNLOAD_VISUAL.sortPairGap }) {
    Button({ type: ButtonType.Normal }) {
      Stack({ alignContent: Alignment.Center }) { DownloadSortBars({ owner }); }.width(DOWNLOAD_VISUAL.sortWidth).height(DOWNLOAD_VISUAL.sortWidth);
    }.width(DOWNLOAD_VISUAL.touchTarget).constraintSize({ minHeight: owner.listToolControlHeight() }).padding(0)
      .borderRadius(0).backgroundColor(Color.Transparent)
      .accessibilityText(owner.view.filters().direction === 'asc' ? '当前正序，切换为倒序' : '当前倒序，切换为正序')
      .onClick((): void => {
        if (owner.searchInputIsCurrent(input.identity)) owner.view.setFilter('direction', owner.view.filters().direction === 'asc' ? 'desc' : 'asc');
      });
    Button({ type: ButtonType.Normal }) {
      Text(owner.sortLabel()).fontFamily(TYPE_DOWNLOAD_LIST_TOOLS.fontFamily).fontWeight(TYPE_DOWNLOAD_LIST_TOOLS.fontWeight)
        .fontSize(TYPE_DOWNLOAD_LIST_TOOLS.fontSizeFp).lineHeight(TYPE_DOWNLOAD_LIST_TOOLS.lineHeightFp as number).halfLeading(true)
        .minFontScale(1).maxFontScale(owner.view.frame.fontScale()).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .fontColor(downloadVisualColor('ink', owner.view.frame.scheme()));
    }.width(owner.listSortLabelWidth()).padding({ top: DOWNLOAD_VISUAL.toolPaddingY, bottom: DOWNLOAD_VISUAL.toolPaddingY })
      .constraintSize({ minHeight: owner.listToolControlHeight() }).borderRadius(0).backgroundColor(Color.Transparent)
      .accessibilityText('选择排序字段').id(sharedDownloadFocusKey('sort')).onClick((): void => {
        if (owner.searchInputIsCurrent(input.identity)) owner.view.actions.openTool('sort', 'sort');
      });
  }.width(owner.listSortWidth()).constraintSize({ minHeight: owner.listToolControlHeight() }).alignItems(VerticalAlign.Center);
}

@Builder
function DownloadListToolCount($$: SharedDownloadBookListOwnerSlot) {
  Text(`${$$.owner.visibleBooks().length} / ${$$.owner.view.input.books().length} 本书`)
    .fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
    .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
    .minFontScale(1).maxFontScale($$.owner.view.frame.fontScale()).width($$.owner.listToolCountWidth()).textAlign(TextAlign.End)
    .fontColor(downloadVisualColor('muted', $$.owner.view.frame.scheme()));
}

interface DownloadSearchFieldInput {
  readonly identity: string;
}

@Builder
function DownloadSearchField(owner: SharedDownloadBookListOwner, input: DownloadSearchFieldInput) {
  ReaderSearchField({ editingHost: owner.editingHost, variant: 'pageForm', mode: 'live', text: owner.view.filters().query,
    editingCurrent: (): boolean => owner.searchInputIsCurrent(input.identity),
    placeholder: '筛选下载书籍', accessibilityLabel: '按书名、作者或书源筛选下载书籍', clearAccessibilityLabel: '清除搜索',
    onTextChange: (value: string): void => owner.changeSearchInput(value, input.identity),
    onClear: (): void => owner.clearSearchInput(input.identity) });
}

interface DownloadTypeTabInput {
  readonly id: string;
  readonly label: string;
  readonly identity: string;
}

@Builder
function DownloadTypeTab(owner: SharedDownloadBookListOwner, input: DownloadTypeTabInput) {
  Button({ type: ButtonType.Normal }) {
    Text(input.label).fontFamily(owner.view.filters().type === input.id ? TYPE_DOWNLOAD_TAB_SELECTED.fontFamily : TYPE_DOWNLOAD_TAB.fontFamily)
      .fontWeight(owner.view.filters().type === input.id ? TYPE_DOWNLOAD_TAB_SELECTED.fontWeight : TYPE_DOWNLOAD_TAB.fontWeight)
      .fontSize(TYPE_DOWNLOAD_TAB.fontSizeFp).lineHeight(TYPE_DOWNLOAD_TAB.lineHeightFp as number).halfLeading(true)
      .fontColor(owner.tabInk(input.id));
  }.constraintSize({ minHeight: DOWNLOAD_VISUAL.touchTarget }).padding({ top: DOWNLOAD_VISUAL.tabPaddingY, bottom: DOWNLOAD_VISUAL.tabPaddingY, left: DOWNLOAD_VISUAL.tabPaddingX, right: DOWNLOAD_VISUAL.tabPaddingX }).layoutWeight(1).borderRadius(DOWNLOAD_VISUAL.tabRadius)
    .fontColor(owner.tabInk(input.id))
    .backgroundColor(owner.view.filters().type === input.id ? downloadVisualColor('surface', owner.view.frame.scheme()) : Color.Transparent)
    .shadow(readerSurfaceElevation(owner.view.filters().type === input.id ? 'card' : 'embedded', owner.view.frame.scheme()))
    .accessibilityText(`${input.label}${owner.view.filters().type === input.id ? '，已选择' : ''}`)
    .onClick((): void => {
      if (!owner.searchInputIsCurrent(input.identity)) return;
      owner.view.setFilter('type', input.id);
    });
}

@Builder
function DownloadSortBars($$: SharedDownloadBookListOwnerSlot) {
  Image(sharedDownloadVisualIcon($$.owner.view.filters().direction === 'asc' ? 'sort_asc' : 'sort_desc', $$.owner.view.frame.scheme()))
    .width(DOWNLOAD_VISUAL.sortIconSize).height(DOWNLOAD_VISUAL.sortIconSize);
}

interface SharedDownloadBookRowInput {
  readonly book: () => DownloadBookView;
  readonly secondary: boolean;
  readonly ownerGeneration: number;
}

@Builder
export function SharedDownloadBookRow(owner: SharedDownloadBookListOwner, input: SharedDownloadBookRowInput) {
  Row({ space: DOWNLOAD_VISUAL.bookGap }) {
    Stack() {
      SharedDownloadBookCover({ bookKey: input.book().key, coverUrl: input.book().coverUrl ?? '',
        presentationGeneration: input.ownerGeneration, coverWidth: DOWNLOAD_VISUAL.coverWidth,
        coverHeight: DOWNLOAD_VISUAL.coverHeight, bookTitle: input.book().title,
        kindLabel: input.book().contentKind === undefined ? '' : input.book().contentKind === 'manga' ? '漫画' : '小说' });
    }.width(DOWNLOAD_VISUAL.coverWidth).height(DOWNLOAD_VISUAL.coverHeight).borderRadius(DOWNLOAD_VISUAL.coverRadius).clip(true)
      .border({ width: DOWNLOAD_VISUAL.borderWidth, color: downloadVisualColor('line', owner.view.frame.scheme()) })
      .backgroundColor(downloadVisualColor(input.book().contentKind === 'manga' ? 'softGreen' : 'soft', owner.view.frame.scheme()));
    Column({ space: 0 }) {
      Column({ space: 0 }) {
      Row({ space: DOWNLOAD_VISUAL.bookTopGap }) {
        Flex({ direction: FlexDirection.Row, justifyContent: FlexAlign.Start, alignItems: ItemAlign.Center }) {
          Text(input.secondary ? downloadChapterBookTitle(input.book()) : input.book().title).fontFamily(TYPE_DOWNLOAD_BOOK_TITLE.fontFamily).fontWeight(TYPE_DOWNLOAD_BOOK_TITLE.fontWeight)
            .fontSize(TYPE_DOWNLOAD_BOOK_TITLE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BOOK_TITLE.lineHeightFp as number).halfLeading(true)
            .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
            .fontColor(downloadVisualColor('ink', owner.view.frame.scheme())).flexShrink(1).textAlign(TextAlign.Start).wordBreak(WordBreak.BREAK_WORD);
          if (!input.secondary) {
            Image(sharedDownloadVisualIcon('chevron', owner.view.frame.scheme())).width(DOWNLOAD_VISUAL.titleChevronSize).height(DOWNLOAD_VISUAL.titleChevronSize)
              .flexShrink(0).margin({ left: DOWNLOAD_VISUAL.statusGap });
          }
        }.layoutWeight(1).constraintSize({ minHeight: Math.max(DOWNLOAD_VISUAL.bookTopHeight, Math.ceil(DOWNLOAD_VISUAL.bookTitleLineHeight * owner.view.frame.fontScale())) });
        if (!input.secondary && input.book().contentKind !== undefined) {
          Text(input.book().contentKind === 'manga' ? '漫画' : '小说')
            .fontFamily(TYPE_DOWNLOAD_TAG.fontFamily).fontWeight(TYPE_DOWNLOAD_TAG.fontWeight)
            .fontSize(TYPE_DOWNLOAD_TAG.fontSizeFp).lineHeight(TYPE_DOWNLOAD_TAG.lineHeightFp as number).halfLeading(true)
            .fontColor(downloadVisualColor('greenInk', owner.view.frame.scheme()))
            .padding({ left: DOWNLOAD_VISUAL.tagPaddingX, right: DOWNLOAD_VISUAL.tagPaddingX }).backgroundColor(downloadVisualColor('green', owner.view.frame.scheme())).borderRadius(DOWNLOAD_VISUAL.tagRadius);
        }
        if (!input.secondary) {
          if (owner.view.frame.mount.managing()) {
            Stack({ alignContent: Alignment.Center }) {
            Checkbox().select(owner.paint().selectedBookKeys.includes(input.book().key)).width(DOWNLOAD_VISUAL.chapterCheckSize).height(DOWNLOAD_VISUAL.chapterCheckSize)
              .accessibilityText(`选择书籍：${input.book().title}，${owner.authorSource(input.book())}`)
              .responseRegion(readerActionTouchRegion(DOWNLOAD_VISUAL.chapterCheckSize, DOWNLOAD_VISUAL.chapterCheckSize))
              .selectedColor(downloadVisualColor('green', owner.view.frame.scheme()))
              .unselectedColor(downloadVisualColor('muted', owner.view.frame.scheme()))
              .mark({ strokeColor: downloadVisualColor('greenInk', owner.view.frame.scheme()) })
              .onChange((selected: boolean): void => {
                const current = owner.eventBook(input.book, input.ownerGeneration);
                if (current !== undefined) owner.toggleBook(current.key, selected);
              });
            }.width(DOWNLOAD_VISUAL.touchTarget).constraintSize({ minHeight: Math.max(DOWNLOAD_VISUAL.bookTopHeight, Math.ceil(DOWNLOAD_VISUAL.bookTitleLineHeight * owner.view.frame.fontScale())) });
          } else {
            Stack({ alignContent: Alignment.Center }) {
              SharedDownloadMoreButton(owner.view.frame, { label: (): string => `${input.book().title}的书籍操作`, action: (): void => {
                const current = owner.eventBook(input.book, input.ownerGeneration);
                if (current === undefined) return;
                owner.view.actions.openBookActions(current.key);
              }, chapter: false, focusTarget: (): string => 'book-menu:' + input.book().key });
            }.width(DOWNLOAD_VISUAL.touchTarget).constraintSize({ minHeight: Math.max(DOWNLOAD_VISUAL.bookTopHeight, Math.ceil(DOWNLOAD_VISUAL.bookTitleLineHeight * owner.view.frame.fontScale())) });
          }
        }
      }.constraintSize({ minHeight: Math.max(DOWNLOAD_VISUAL.bookTopHeight, Math.ceil(DOWNLOAD_VISUAL.bookTitleLineHeight * owner.view.frame.fontScale())) }).width('100%').alignItems(VerticalAlign.Center);
      Text(owner.authorSource(input.book())).fontFamily(TYPE_DOWNLOAD_SOURCE.fontFamily).fontWeight(TYPE_DOWNLOAD_SOURCE.fontWeight)
        .fontSize(TYPE_DOWNLOAD_SOURCE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_SOURCE.lineHeightFp as number).halfLeading(true)
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .fontColor(downloadVisualColor('muted', owner.view.frame.scheme())).width('100%')
        .constraintSize({ minHeight: DOWNLOAD_VISUAL.sourceLineHeight * owner.view.frame.fontScale() }).margin({ top: DOWNLOAD_VISUAL.sourceTop });
      Row({ space: DOWNLOAD_VISUAL.bookTopGap }) {
        Text(owner.downloadCount(input.book(), input.secondary)).fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
          .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor('muted', owner.view.frame.scheme())).layoutWeight(1)
          .constraintSize({ minHeight: DOWNLOAD_VISUAL.sourceLineHeight * owner.view.frame.fontScale() });
        if (input.secondary) {
          Text(input.book().stateLabel === '下载失败' ? '下载失败' : input.book().totalChapters === undefined ? '' : `目录 ${input.book().totalChapters}${sharedDownloadChapterUnit(input.book())}`)
            .fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
            .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
            .fontColor(downloadVisualColor(input.book().stateLabel === '下载失败' ? 'danger' : 'green', owner.view.frame.scheme()))
            .constraintSize({ minHeight: DOWNLOAD_VISUAL.statusHeight });
        } else if (input.book().stateLabel.length > 0) {
          DownloadStatusButton(owner, { book: input.book, ownerGeneration: input.ownerGeneration });
        } else {
          Blank().width(DOWNLOAD_VISUAL.statusWidth).height(DOWNLOAD_VISUAL.statusHeight);
        }
      }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.statusHeight }).margin({ top: DOWNLOAD_VISUAL.progressTop });
      if (input.book().stateLabel === '下载失败' && (input.book().downloadError?.trim().length ?? 0) > 0) {
        Text(input.book().downloadError ?? '').fontFamily(TYPE_DOWNLOAD_META_LINE.fontFamily).fontWeight(TYPE_DOWNLOAD_META_LINE.fontWeight)
          .fontSize(TYPE_DOWNLOAD_META_LINE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META_LINE.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor('danger', owner.view.frame.scheme())).width('100%').wordBreak(WordBreak.BREAK_WORD)
          .margin({ top: DOWNLOAD_VISUAL.progressGap });
      }
      }.width('100%').alignItems(HorizontalAlign.Start)
        .onAreaChange((_old: Area, area: Area): void => {
          if (!owner.view.frame.presentationIsCurrent(input.ownerGeneration)) return;
          const current = owner.findCurrentBook(input.book());
          if (current !== undefined) owner.recordBookContentHeight(current.key, readerPageAreaLength(area.height));
        });
      Blank().height(owner.bookProgressSpacer(input.book().key));
      Progress({ value: input.book().progressPercent ?? 0, total: 100, type: ProgressType.Linear })
        .width('100%').height(DOWNLOAD_VISUAL.progressHeight).color(downloadVisualColor('green', owner.view.frame.scheme()))
        .backgroundColor(downloadVisualColor('soft', owner.view.frame.scheme()))
        .style({ strokeWidth: DOWNLOAD_VISUAL.progressHeight, enableSmoothEffect: false }).visibility(input.book().progressPercent === undefined ? Visibility.Hidden : Visibility.Visible);
    }.layoutWeight(1).constraintSize({ minHeight: DOWNLOAD_VISUAL.bookMinHeight }).alignItems(HorizontalAlign.Start)
      .onAreaChange((_old: Area, area: Area): void => {
        if (!owner.view.frame.presentationIsCurrent(input.ownerGeneration)) return;
        const current = owner.findCurrentBook(input.book());
        if (current !== undefined) owner.recordBookHeight(current.key, readerPageAreaLength(area.height));
      });
  }.width('100%').alignItems(VerticalAlign.Top).padding({ top: DOWNLOAD_VISUAL.bookPaddingY, bottom: DOWNLOAD_VISUAL.bookPaddingY })
    .id(input.secondary ? '' : sharedDownloadFocusKey('book-title:' + input.book().key))
    .accessibilityRole(AccessibilityRoleType.BUTTON)
    .accessibilityText(input.secondary ? '' : `${input.book().title}，${owner.authorSource(input.book())}，${owner.downloadCount(input.book(), false)}` +
      (owner.view.frame.mount.managing() ? `，${owner.paint().selectedBookKeys.includes(input.book().key) ? '取消选择' : '选择'}` : '，打开书籍'))
    .accessibilitySelected(owner.view.frame.mount.managing() && owner.paint().selectedBookKeys.includes(input.book().key))
    .accessibilityLevel(input.secondary ? 'no' : 'yes')
    .focusable(!input.secondary && owner.view.frame.uiInputIsCurrent(input.ownerGeneration) && !owner.view.actions.modalBlocking())
    .enabled(input.secondary || (owner.view.frame.uiInputIsCurrent(input.ownerGeneration) && !owner.view.actions.modalBlocking()))
    .onClick((): void => { if (!input.secondary) owner.view.openBook(input.book(), input.ownerGeneration); })
    .border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', owner.view.frame.scheme()) });
}

interface DownloadStatusButtonInput {
  readonly book: () => DownloadBookView;
  readonly ownerGeneration: number;
}

@Builder
function DownloadStatusButton(owner: SharedDownloadBookListOwner, input: DownloadStatusButtonInput) {
  if (input.book().statusAction === 'completed') {
    Row({ space: DOWNLOAD_VISUAL.statusGap }) {
      Image(owner.statusIcon(input.book())).width(DOWNLOAD_VISUAL.statusIconSize).height(DOWNLOAD_VISUAL.statusIconSize);
      Text(input.book().stateLabel).fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
        .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .fontColor(owner.statusInk(input.book())).textAlign(TextAlign.Center).layoutWeight(1);
    }.constraintSize({
      minWidth: readerScaledWidth(DOWNLOAD_VISUAL.statusWidth, owner.view.frame.fontScale(), 128),
      minHeight: readerScaledControlHeight(DOWNLOAD_VISUAL.statusHeight, 16, owner.view.frame.fontScale()),
    }).padding({ left: DOWNLOAD_VISUAL.statusPaddingX, right: DOWNLOAD_VISUAL.statusPaddingX }).borderRadius(DOWNLOAD_VISUAL.statusRadius)
      .backgroundColor(downloadVisualColor('soft', owner.view.frame.scheme()));
  } else {
  Button({ type: ButtonType.Normal }) {
    Row({ space: DOWNLOAD_VISUAL.statusGap }) {
      Image(owner.statusIcon(input.book())).width(DOWNLOAD_VISUAL.statusIconSize).height(DOWNLOAD_VISUAL.statusIconSize);
      Text(owner.statusActionLabel(input.book())).fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
        .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .fontColor(owner.statusInk(input.book()))
        .textAlign(TextAlign.Center).layoutWeight(1);
    }.width('100%');
  }.id(sharedDownloadFocusKey('book-status:' + input.book().key))
    .constraintSize({
      minWidth: readerScaledWidth(DOWNLOAD_VISUAL.statusWidth, owner.view.frame.fontScale(), 128),
      minHeight: readerScaledControlHeight(DOWNLOAD_VISUAL.statusHeight, 16, owner.view.frame.fontScale()),
    })
    .responseRegion(readerUnionTouchRegion(
      readerScaledWidth(DOWNLOAD_VISUAL.statusWidth, owner.view.frame.fontScale(), 128),
      readerScaledControlHeight(DOWNLOAD_VISUAL.statusHeight, 16, owner.view.frame.fontScale()),
    ))
    .padding({ left: DOWNLOAD_VISUAL.statusPaddingX, right: DOWNLOAD_VISUAL.statusPaddingX }).borderRadius(DOWNLOAD_VISUAL.statusRadius)
    .backgroundColor(downloadVisualColor('soft', owner.view.frame.scheme()))
    .enabled(!owner.view.frame.mount.managing()).opacity(owner.view.frame.mount.managing() ? DOWNLOAD_VISUAL.disabledOpacity : 1)
    .accessibilityText(owner.statusActionAccessibility(input.book()))
    .onClick((): void => {
      const current = owner.eventBook(input.book, input.ownerGeneration);
      if (owner.view.frame.mount.managing() || current === undefined || current.statusAction === 'completed') return;
      owner.view.actions.activateBookStatus(current);
    });
  }
}

interface SharedDownloadMoreButtonInput {
  readonly label: () => string;
  readonly action: () => void;
  readonly chapter: boolean;
  readonly focusTarget: () => string;
}

@Builder
export function SharedDownloadMoreButton(frame: SharedDownloadFrameView, input: SharedDownloadMoreButtonInput) {
  Button({ type: ButtonType.Normal }) {
    Image(sharedDownloadVisualIcon('more', frame.scheme()))
      .width(DOWNLOAD_VISUAL.moreIconSize).height(DOWNLOAD_VISUAL.moreIconSize);
  }.id(sharedDownloadFocusKey(input.focusTarget())).width(input.chapter ? DOWNLOAD_VISUAL.touchTarget : DOWNLOAD_VISUAL.moreWidth)
    .height(input.chapter ? DOWNLOAD_VISUAL.touchTarget : DOWNLOAD_VISUAL.moreHeight)
    .responseRegion(readerActionTouchRegion(input.chapter ? DOWNLOAD_VISUAL.touchTarget : DOWNLOAD_VISUAL.moreWidth,
      input.chapter ? DOWNLOAD_VISUAL.touchTarget : DOWNLOAD_VISUAL.moreHeight))
    .padding(0).borderRadius(0).backgroundColor(Color.Transparent)
    .accessibilityText(input.label()).onClick((): void => input.action());
}

@Builder
export function SharedDownloadStorageDock($$: SharedDownloadBookListOwnerSlot) {
  Stack({ alignContent: Alignment.TopStart }) {
  Row({ space: DOWNLOAD_VISUAL.dockGap }) {
    Column({ space: 0 }) {
      Text($$.owner.totalBytesLabel()).fontFamily(TYPE_DOWNLOAD_STORAGE_META.fontFamily).fontWeight(TYPE_DOWNLOAD_STORAGE_META.fontWeight)
        .fontSize(TYPE_DOWNLOAD_STORAGE_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_STORAGE_META.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('ink', $$.owner.view.frame.scheme())).width('100%')
        .constraintSize({ minHeight: DOWNLOAD_VISUAL.storageLineHeight * $$.owner.view.frame.fontScale() });
      if ($$.owner.view.input.books().some((book: DownloadBookView): boolean => book.bytes === undefined)) {
        Text('容量暂未统计完整')
          .fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
          .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor('muted', $$.owner.view.frame.scheme())).width('100%');
      }
    }.layoutWeight(1).constraintSize({ minWidth: 0 }).alignItems(HorizontalAlign.Start);
    Button({ type: ButtonType.Normal }) {
      Image(sharedDownloadVisualIcon('storage', $$.owner.view.frame.scheme()))
        .width(DOWNLOAD_VISUAL.moreIconSize).height(DOWNLOAD_VISUAL.moreIconSize);
    }.width(DOWNLOAD_VISUAL.touchTarget).height(DOWNLOAD_VISUAL.touchTarget).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
      .id(sharedDownloadFocusKey('storage')).accessibilityText('存储管理')
      .onClick((): void => {
        if (!$$.owner.view.frame.uiInputIsCurrent() || $$.owner.view.actions.modalBlocking()) return;
        $$.owner.view.actions.openTool('settings', 'storage');
        $$.owner.view.onRefreshStorage();
      });
  }.width('100%').padding({ left: DOWNLOAD_VISUAL.dockPaddingX, right: DOWNLOAD_VISUAL.dockPaddingX,
    top: DOWNLOAD_VISUAL.dockPaddingY, bottom: DOWNLOAD_VISUAL.dockPaddingY })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(readerAppColor('app.surface.dock', $$.owner.view.frame.scheme()))
    .border({ width: DOWNLOAD_VISUAL.borderWidth, color: readerAppColor('app.navigation.floatingBorder', $$.owner.view.frame.scheme()) }).borderRadius($$.owner.view.frame.layout.dockMaterialRadius(false)).clip(false)
    .shadow(readerSurfaceElevation('raised', $$.owner.view.frame.scheme()))
    .onAreaChange($$.owner.view.frame.layout.raisedDockAreaChangeHandler(false));
  }.width('100%').clip(false);
}

interface SharedDownloadActionButtonInput {
  readonly modalBlocking: () => boolean;
  readonly label: () => string;
  readonly primary: boolean;
  readonly enabled: () => boolean;
  readonly action: () => void;
  readonly focusTarget: string;
  readonly inSheet: boolean;
  readonly ownerGeneration: number;
}

@Builder
export function SharedDownloadActionButton(frame: SharedDownloadFrameView, input: SharedDownloadActionButtonInput) {
  ReaderButton({ scheme: frame.scheme(), variant: input.primary ? 'primary' : 'tonal',
    visualSize: input.inSheet ? 'large' : 'medium', label: input.label(), focusId: sharedDownloadFocusKey(input.focusTarget),
    layout: 'equal', actionEnabled: input.enabled(), onAction: (): void => {
      if (frame.uiInputIsCurrent(input.ownerGeneration) && (input.inSheet || !input.modalBlocking()) && input.enabled()) input.action();
    } });
}

@Builder
export function SharedDownloadHeader($$: SharedDownloadBookListOwnerSlot) {
  PageBackBar({ variant: $$.owner.view.input.embeddedWide() ? 'standard' : 'download', floating: $$.owner.view.input.embeddedWide(),
    layoutExpectedTopGapVp: $$.owner.view.chrome.headerTop(),
    centered: $$.owner.view.input.embeddedWide(), elevation: $$.owner.view.input.embeddedWide() ? 'floating' : 'fixed', trailingWidthVp: $$.owner.manageHeaderActionWidth(),
    showBack: !$$.owner.view.input.embeddedWide() || $$.owner.view.frame.mount.detailKey().length > 0 || $$.owner.view.frame.mount.managing(),
    title: $$.owner.view.frame.mount.detailKey().length === 0 ? '下载管理' : '章节下载',
    backFocusId: sharedDownloadFocusKey('page-back'),
    backLabel: $$.owner.view.frame.mount.managing() ? '退出管理' : $$.owner.view.frame.mount.detailKey().length > 0 ? '返回书籍列表' : '返回',
    onBack: (): void => $$.owner.view.chrome.back(), onHeightChange: $$.owner.view.chrome.headerHeightChangeHandler(),
    trailing: (): void => { $$.owner.view.chrome.renderManageAction(); },
  });
}

@Builder
export function SharedDownloadManageHeaderAction($$: SharedDownloadBookListOwnerSlot) {
  Button({ type: ButtonType.Normal }) {
    Text($$.owner.view.frame.mount.managing() ? '完成' : '管理').fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily)
      .fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight).fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp)
      .lineHeight(`${TYPE_DOWNLOAD_CONTROL.lineHeightFp}fp`).halfLeading(true).fontColor(sharedDownloadPrimaryInk($$.owner.view.frame.scheme()))
      .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
  }.id(sharedDownloadFocusKey('manage')).width($$.owner.manageHeaderActionWidth())
    .constraintSize({ minHeight: DOWNLOAD_HEADER_ACTION_HEIGHT }).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
    .responseRegion(readerActionTouchRegion($$.owner.manageHeaderActionWidth(), DOWNLOAD_HEADER_ACTION_HEIGHT))
    .enabled($$.owner.view.frame.mount.managing() || $$.owner.view.chrome.canEnterManaging())
    .opacity($$.owner.view.frame.mount.managing() || $$.owner.view.chrome.canEnterManaging() ? 1 : DOWNLOAD_VISUAL.disabledOpacity).onClick((): void => {
      if ($$.owner.view.frame.uiInputIsCurrent()) $$.owner.view.setManaging(!$$.owner.view.frame.mount.managing());
    });
}

@Builder
export function SharedDownloadCompactHeader($$: SharedDownloadBookListOwnerSlot) {
  Column() { SharedDownloadHeader($$); }.width('100%').padding({ left: $$.owner.view.frame.layout.leftInset(), right: $$.owner.view.frame.layout.rightInset(),
    top: $$.owner.view.chrome.headerTop(), bottom: $$.owner.view.frame.layout.contentTop() - $$.owner.view.chrome.headerTop() - $$.owner.view.chrome.resolvedHeaderHeight() });
}

@Builder
export function SharedDownloadCompactDock($$: SharedDownloadBookListOwnerSlot) {
  Column() {
    if ($$.owner.view.frame.mount.managing() || $$.owner.detail() !== undefined) { SharedDownloadSelectionDock($$); }
    else { SharedDownloadStorageDock({ owner: $$.owner }); }
  }.width('100%').padding({ left: $$.owner.view.chrome.dockLeftInset(), right: $$.owner.view.chrome.dockRightInset(),
    top: DOWNLOAD_VISUAL.dockBottom, bottom: $$.owner.view.frame.layout.bottomInset() });
}

@Builder
export function SharedDownloadSelectionDock($$: SharedDownloadBookListOwnerSlot) {
  Stack({ alignContent: Alignment.TopStart }) {
  Column({ space: DOWNLOAD_VISUAL.selectionSummaryBottom }) {
    Flex({ wrap: FlexWrap.Wrap, alignItems: ItemAlign.Center }) {
      Text($$.owner.view.chrome.selectionLabel()).fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily).fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight)
        .fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('ink', $$.owner.view.frame.scheme())).flexGrow(1).flexShrink(0)
        .constraintSize({ maxWidth: '100%' }).padding({ right: DOWNLOAD_VISUAL.selectionSummaryGap });
      if ($$.owner.view.frame.mount.managing()) {
        ReaderButton({ scheme: $$.owner.view.frame.scheme(), variant: 'subtle', visualSize: 'small',
          label: $$.owner.view.chrome.allSelected() ? '取消全选' : '全选', focusId: sharedDownloadFocusKey('select-all'),
          actionEnabled: $$.owner.detail() !== undefined || $$.owner.visibleBooks().length > 0,
          onAction: $$.owner.view.chrome.manageSelectAllAction($$.owner.view.chrome.managementGeneration()) });
        DownloadManagementDone($$.owner, $$.owner.view.chrome.managementGeneration());
      }
    }.width('100%');
    Row({ space: DOWNLOAD_VISUAL.actionGap }) {
      if ($$.owner.detail() !== undefined && !$$.owner.view.frame.mount.managing()) {
        ForEach([$$.owner.view.frame.mount.detailKey()], (bookKey: string): void => {
          SharedDownloadActionButton($$.owner.view.frame, { modalBlocking: $$.owner.view.actions.modalBlocking, label: (): string => '选择章节', primary: true, enabled: (): boolean => $$.owner.view.frame.mount.detailKey() === bookKey && $$.owner.view.chrome.canEnterManaging() && !$$.owner.view.frame.mount.managing(), action: (): void => $$.owner.view.setManaging(true, 'select-chapters:' + bookKey), focusTarget: 'select-chapters:' + bookKey, inSheet: false, ownerGeneration: $$.owner.view.frame.mount.presentationGeneration() });
        }, (bookKey: string): string => bookKey);
        SharedDownloadActionButton($$.owner.view.frame, { modalBlocking: $$.owner.view.actions.modalBlocking, label: (): string => '定位当前', primary: false, enabled: (): boolean => $$.owner.view.chapters.currentChapter() !== undefined, action: (): void => $$.owner.view.chapters.locateCurrent(), focusTarget: '', inSheet: false, ownerGeneration: $$.owner.view.frame.mount.presentationGeneration() });
      } else if ($$.owner.detail() !== undefined) {
        SharedDownloadActionButton($$.owner.view.frame, { modalBlocking: $$.owner.view.actions.modalBlocking, label: (): string => '下载所选', primary: true, enabled: (): boolean => $$.owner.view.chapters.selectedChapterActionAvailable('download'), action: (): void => {
          $$.owner.view.actions.runSelectedChapters('download');
        }, focusTarget: '', inSheet: false, ownerGeneration: $$.owner.view.frame.mount.presentationGeneration() });
        SharedDownloadActionButton($$.owner.view.frame, { modalBlocking: $$.owner.view.actions.modalBlocking, label: (): string => '暂停所选', primary: false, enabled: (): boolean => $$.owner.view.chapters.selectedChapterActionAvailable('pause'), action: (): void => {
          $$.owner.view.actions.runSelectedChapters('pause');
        }, focusTarget: '', inSheet: false, ownerGeneration: $$.owner.view.frame.mount.presentationGeneration() });
        SharedDownloadActionButton($$.owner.view.frame, { modalBlocking: $$.owner.view.actions.modalBlocking, label: (): string => '更多', primary: false, enabled: (): boolean => $$.owner.view.chapters.selectedCount() > 0, action: (): void => {
          $$.owner.view.actions.openSelectionActions(true);
        }, focusTarget: 'selection-more', inSheet: false, ownerGeneration: $$.owner.view.frame.mount.presentationGeneration() });
      } else {
        SharedDownloadActionButton($$.owner.view.frame, { modalBlocking: $$.owner.view.actions.modalBlocking, label: (): string => '暂停所选', primary: false, enabled: (): boolean => $$.owner.selectedQueueTargets(false).length > 0, action: (): void => $$.owner.sendSelectedQueueAction(false), focusTarget: '', inSheet: false, ownerGeneration: $$.owner.view.frame.mount.presentationGeneration() });
        SharedDownloadActionButton($$.owner.view.frame, { modalBlocking: $$.owner.view.actions.modalBlocking, label: (): string => '继续所选', primary: true, enabled: (): boolean => $$.owner.selectedQueueTargets(true).length > 0, action: (): void => $$.owner.sendSelectedQueueAction(true), focusTarget: '', inSheet: false, ownerGeneration: $$.owner.view.frame.mount.presentationGeneration() });
        SharedDownloadActionButton($$.owner.view.frame, { modalBlocking: $$.owner.view.actions.modalBlocking, label: (): string => '移除', primary: false, enabled: (): boolean => $$.owner.selectedBooksCanBeRemoved(), action: (): void => {
          $$.owner.view.actions.openSelectionActions(false);
        }, focusTarget: 'selection-more', inSheet: false, ownerGeneration: $$.owner.view.frame.mount.presentationGeneration() });
      }
    }.width('100%');
  }.width('100%').padding(DOWNLOAD_VISUAL.selectionPadding).backgroundColor(readerAppColor('app.surface.dock', $$.owner.view.frame.scheme()))
    .border({ width: DOWNLOAD_VISUAL.borderWidth, color: readerAppColor('app.navigation.floatingBorder', $$.owner.view.frame.scheme()) }).borderRadius($$.owner.view.frame.layout.dockMaterialRadius(true)).clip(false)
    .shadow(readerSurfaceElevation('raised', $$.owner.view.frame.scheme()))
    .hitTestBehavior(HitTestMode.Default)
    .onTouch((): void => {})
    .onAreaChange($$.owner.view.frame.layout.raisedDockAreaChangeHandler(true));
  }.width('100%').clip(false).hitTestBehavior(HitTestMode.Default)
    .responseRegion(readerLayoutCarrierResponseRegion());
}

@Builder
function DownloadManagementDone(owner: SharedDownloadBookListOwner, management: number) {
  ReaderButton({ scheme: owner.view.frame.scheme(), variant: 'tonal', visualSize: 'small', label: '完成',
    actionAccessibilityLabel: '完成批量管理', onAction: (): void => {
      if (owner.view.frame.uiInputIsCurrent() && !owner.view.actions.modalBlocking() && owner.view.frame.mount.managing() && management === owner.view.chrome.managementGeneration())
        owner.view.setManaging(false);
    } });
}
