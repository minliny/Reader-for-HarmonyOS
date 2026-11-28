import { LengthMetrics } from '@kit.ArkUI';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { readerScrollEndOffset, readerScrollStartOffset } from '../../../ui/layout/ReaderScrollLayout';
import { readerActionTouchRegion, readerUnionTouchRegion } from '../../../ui/controls/ReaderActionAccessibility';
import { readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { DOWNLOAD_VISUAL, downloadVisualColor } from './SharedDownloadVisualSpec';
import { TYPE_DOWNLOAD_META, TYPE_DOWNLOAD_TAG, TYPE_DOWNLOAD_BOOK_TITLE, TYPE_DOWNLOAD_META_LINE, TYPE_DOWNLOAD_CHAPTER_TITLE } from './DownloadTypography';
import type { DownloadBookView, DownloadChapterView, DownloadReadingTarget } from '../presentation/SharedDownloadProjection';
import { describeDownloadReadingTarget, downloadChapterDetailLabel } from '../presentation/SharedDownloadProjection';
import { ReaderInlineSelect } from '../../../ui/controls/ReaderInlineSelect';
import type { SharedDownloadReadingControl, SharedDownloadReadingFocus, SharedDownloadUiAction } from '../presentation/SharedDownloadUiContract';
import type { SharedDownloadExpectedChapter } from '../application/SharedDownloadCoordinator';
import { SharedDownloadCompactHeader, SharedDownloadCompactDock, SharedDownloadBookRow, SharedDownloadIdleFrame, SharedDownloadMoreButton, sharedDownloadChapterUnit, sharedDownloadFocusKey,
  sharedDownloadVisualIcon, sharedDownloadSelectWidth, sharedDownloadPrimaryInk, sharedDownloadCurrentChapter,
  sharedDownloadChapterProof, sharedDownloadChapterIsRunning, type SharedDownloadFrameView, type SharedDownloadBookListOwner } from './SharedDownloadBookList';

export interface SharedDownloadChapterFacts {
  readonly appForeground: () => boolean;
  readonly covered: () => boolean;
  readonly embeddedWide: () => boolean;
  readonly loading: () => boolean;
  readonly reduceMotion: () => boolean;
}

export interface SharedDownloadChapterBooks {
  readonly detail: () => DownloadBookView | undefined;
  readonly bookGetter: (book: DownloadBookView) => (() => DownloadBookView);
  readonly findCurrentBook: (book: DownloadBookView) => DownloadBookView | undefined;
  readonly eventBook: (book: () => DownloadBookView, generation?: number) => DownloadBookView | undefined;
  readonly cancelManagingScroll: () => void;
  readonly onListTouch: (event: TouchEvent) => void;
  readonly onListWillScroll: (offset: number, source: ScrollSource, generation: number, bookKey: string) => void;
}

export interface SharedDownloadChapterActions {
  readonly modalBlocking: () => boolean;
  readonly available: (action: SharedDownloadUiAction, books: DownloadBookView[], proofs: SharedDownloadExpectedChapter[]) => boolean;
  readonly runChapterAction: (bookKey: string, proof: SharedDownloadExpectedChapter, action: 'download' | 'pause') => void;
  readonly openChapterActions: (bookKey: string, proof: SharedDownloadExpectedChapter, trigger: string) => void;
}

export interface SharedDownloadChapterListView {
  readonly frame: SharedDownloadFrameView;
  readonly input: SharedDownloadChapterFacts;
  readonly books: SharedDownloadChapterBooks;
  readonly actions: SharedDownloadChapterActions;
  readonly onOpenBook: (book: DownloadBookView) => void;
  readonly onReadTarget: (target: DownloadReadingTarget, current: () => boolean, control: SharedDownloadReadingControl) => void;
  readonly publishViewState: () => void;
}

@Observed
export class SharedDownloadChapterListPaint {
  @Track selectedChapters: Map<number, string> = new Map<number, string>();
}

/** Owns the chapter scroller and exact chapter input, return focus and reading handoff proofs. */
export class SharedDownloadChapterListOwner {
  readonly view: SharedDownloadChapterListView;
  readonly paint: () => SharedDownloadChapterListPaint;

  constructor(view: SharedDownloadChapterListView, paint: () => SharedDownloadChapterListPaint) {
    this.view = view;
    this.paint = paint;
  }

  readonly chapterScroller: Scroller = new Scroller();

  chapterOffset: number = 0;

  private chapterLayoutReady: boolean = false;
  private chapterScrollRestoreEpoch: number = 0;

  chapterScrollRestorePending: boolean = false;

  chapterScrollRestoreScheduled: boolean = false;
  private readingHandoffRevision: number = 0;

  private readingReturnFocus: SharedDownloadReadingFocus | undefined;

  private chapterTextAvailableWidth(): number {
    return Math.max(0, this.view.frame.layout.pageViewportWidth() - this.view.frame.layout.contentLeftInset() - this.view.frame.layout.contentRightInset() -
      DOWNLOAD_VISUAL.chapterPaddingX * 2 - (this.view.frame.mount.managing() ? DOWNLOAD_VISUAL.touchTarget + DOWNLOAD_VISUAL.chapterGap : 0));
  }

  chapterTextMinimum(): number {
    return Math.min(this.chapterTextAvailableWidth(), 120 * this.view.frame.fontScale());
  }

  chapterRowWrap(): FlexWrap {
    const scale = this.view.frame.fontScale();
    const copyWidth = 120 * scale;
    if (this.view.frame.mount.managing()) {
      // The available width already excludes the checkbox and its gap.
      return this.chapterTextAvailableWidth() >= copyWidth ? FlexWrap.NoWrap : FlexWrap.Wrap;
    }
    // Every visible primary chapter action has two full-width glyphs.
    const primaryWidth = Math.max(DOWNLOAD_VISUAL.touchTarget,
      Math.ceil(2 * TYPE_DOWNLOAD_META.fontSizeFp * scale) + DOWNLOAD_VISUAL.chapterActionPaddingX * 2);
    const actionsWidth = primaryWidth + DOWNLOAD_VISUAL.chapterTailGap + DOWNLOAD_VISUAL.touchTarget;
    return this.chapterTextAvailableWidth() >= copyWidth + DOWNLOAD_VISUAL.chapterGap + actionsWidth ?
      FlexWrap.NoWrap : FlexWrap.Wrap;
  }

  chapterMenuFocusKey(chapter: DownloadChapterView): string {
    return 'chapter-menu:' + JSON.stringify([chapter.key, chapter.chapterId]);
  }

  chapterReadingFocusKey(chapter: DownloadChapterView, control: SharedDownloadReadingControl): string {
    return 'chapter-reading:' + JSON.stringify([chapter.key, chapter.chapterId, control]);
  }

  chapterReadingFocusTarget(focus: SharedDownloadReadingFocus): string {
    const book = this.view.books.detail();
    const chapter = book?.key === focus.bookKey && book.projectionStatus === 'ready' ?
      book.chapters.find((row: DownloadChapterView): boolean =>
        row.navigable && row.key === focus.chapterKey && row.chapterId === focus.chapterId) : undefined;
    return chapter !== undefined && (focus.control === 'title' || chapter.localComplete) ?
      this.chapterReadingFocusKey(chapter, focus.control) : 'page-back';
  }

  chapterGetter(book: () => DownloadBookView, snapshot: DownloadChapterView): () => DownloadChapterView {
    return (): DownloadChapterView => this.currentChapterView(book(), snapshot);
  }

  currentChapterView(book: DownloadBookView, snapshot: DownloadChapterView): DownloadChapterView {
    return this.view.books.findCurrentBook(book)?.chapters.find((current: DownloadChapterView): boolean =>
      current.key === snapshot.key && current.chapterId === snapshot.chapterId) ?? snapshot;
  }

  eventChapter(book: () => DownloadBookView, chapter: () => DownloadChapterView,
    generation: number = this.view.frame.mount.presentationGeneration()): DownloadChapterView | undefined {
    const currentBook = this.view.books.eventBook(book, generation);
    if (currentBook === undefined || currentBook.key !== this.view.frame.mount.detailKey()) return undefined;
    const expected = chapter();
    return currentBook.chapters.find((current: DownloadChapterView): boolean =>
      current.key === expected.key && current.chapterId === expected.chapterId);
  }

  chapterButtonLabel(chapter: DownloadChapterView): string {
    if (chapter.localComplete) return '阅读';
    if (sharedDownloadChapterIsRunning(chapter)) return '暂停';
    if (chapter.queueState === 'failed') return '重试';
    if (chapter.queueState === 'paused') return '继续';
    return chapter.queueState === 'unknown' ? '' : '下载';
  }

  initializePosition(offset: number, pending: boolean = false): void {
    this.chapterOffset = offset;
    this.chapterLayoutReady = false;
    this.chapterScrollRestorePending = pending;
    this.chapterScrollRestoreScheduled = false;
  }

  discardMeasuredPosition(): void {
    this.chapterLayoutReady = false;
    this.chapterScrollRestorePending = false;
  }

  releaseOldFontFrame(): void { this.chapterScrollRestoreScheduled = false; }

  recordLayoutArea(area: Area): void {
    const height = readerPageAreaLength(area.height);
    this.chapterLayoutReady = Number.isFinite(height) && height > 0;
    if (this.chapterLayoutReady) this.restoreChapterOffset();
  }

  captureVisiblePosition(): void {
    if (this.chapterLayoutReady) this.captureChapterOffset();
  }

  resetSelection(): void { this.paint().selectedChapters = new Map<number, string>(); }

  retainSelection(book: DownloadBookView | undefined): void {
    if (book?.projectionStatus !== 'ready' || this.paint().selectedChapters.size === 0) return;
    const retained = new Map<number, string>();
    for (const chapter of book.chapters) {
      if (chapter.navigable && this.chapterSelected(chapter)) retained.set(chapter.index, chapter.chapterId);
    }
    if (retained.size !== this.paint().selectedChapters.size) this.paint().selectedChapters = retained;
  }

  selectedCount(): number { return this.paint().selectedChapters.size; }

  acceptReturnFocus(focus: SharedDownloadReadingFocus | undefined): void { this.readingReturnFocus = focus; }

  retireReadingReturnFocus(): void { this.readingReturnFocus = undefined; }

  restoreManagementPosition(offset: number): void {
    this.chapterScroller.scrollTo({ xOffset: 0, yOffset: offset });
  }

  consumeReturnFocus(focus: SharedDownloadReadingFocus): boolean {
    if (this.readingReturnFocus !== focus || !this.view.input.appForeground() || this.view.input.covered()) return false;
    this.readingReturnFocus = undefined;
    return true;
  }

  captureChapterOffset(): number | undefined {
    if (this.chapterScrollRestorePending) return undefined;
    try {
      const offset = this.chapterScroller.currentOffset();
      if (offset !== undefined && Number.isFinite(offset.yOffset)) {
        this.chapterOffset = offset.yOffset;
        return offset.yOffset;
      }
    } catch (_error) {
      // The controller can detach while this page changes its content branch.
    }
    return undefined;
  }

  chapterSelected(chapter: DownloadChapterView): boolean {
    return this.paint().selectedChapters.get(chapter.index) === chapter.chapterId;
  }

  toggleChapter(chapter: DownloadChapterView, selected: boolean): void {
    if (chapter.chapterId.length === 0 || this.chapterSelected(chapter) === selected) return;
    const next = new Map<number, string>(this.paint().selectedChapters);
    if (selected) next.set(chapter.index, chapter.chapterId);
    else next.delete(chapter.index);
    this.paint().selectedChapters = next;
  }

  selectChapters(chapters: DownloadChapterView[], keepExisting: boolean = false): void {
    const next = keepExisting ? new Map<number, string>(this.paint().selectedChapters) : new Map<number, string>();
    for (const chapter of chapters) {
      if (chapter.navigable && chapter.chapterId.length > 0) next.set(chapter.index, chapter.chapterId);
    }
    this.paint().selectedChapters = next;
  }

  groupChapters(book: DownloadBookView, group: DownloadChapterView): DownloadChapterView[] {
    const offset = book.chapters.findIndex((chapter: DownloadChapterView): boolean => chapter.key === group.key);
    const chapters: DownloadChapterView[] = [];
    for (let index = offset + 1; index < book.chapters.length; index += 1) {
      const chapter = book.chapters[index];
      if (!chapter.navigable && (chapter.level ?? 0) <= (group.level ?? 0)) break;
      if (chapter.navigable) chapters.push(chapter);
    }
    return chapters;
  }

  currentChapter(): DownloadChapterView | undefined {
    const book = this.view.books.detail(); if (book === undefined) return undefined;
    return sharedDownloadCurrentChapter(book);
  }

  locateCurrent(): void {
    const chapter = this.currentChapter(); const book = this.view.books.detail(); if (chapter === undefined || book === undefined) return;
    const index = book.chapters.findIndex((item: DownloadChapterView): boolean => item.key === chapter.key);
    if (index < 0) return;
    this.cancelChapterScrollRestore();
    this.view.books.cancelManagingScroll();
    // The embedded page puts its heading outside the native list.
    this.chapterScroller.scrollToIndex((this.view.input.embeddedWide() ? 2 : 3) + index, !this.view.input.reduceMotion(), ScrollAlign.CENTER);
  }

  selectedChapterProofs(): SharedDownloadExpectedChapter[] {
    const proofs: SharedDownloadExpectedChapter[] = [];
    this.paint().selectedChapters.forEach((chapterId: string, chapterIndex: number): void => {
      proofs.push({ chapterIndex, chapterId });
    });
    return proofs;
  }

  selectedChapterActionAvailable(action: SharedDownloadUiAction): boolean {
    const book = this.view.books.detail();
    return book !== undefined && this.paint().selectedChapters.size > 0 &&
      this.view.actions.available(action, [book], this.selectedChapterProofs());
  }

  showReadTarget(snapshot: DownloadBookView, chapterSnapshot?: DownloadChapterView,
    generation: number = this.view.frame.mount.presentationGeneration(), control: SharedDownloadReadingControl = 'title'): void {
    const book = this.view.books.eventBook(this.view.books.bookGetter(snapshot), generation);
    if (book === undefined || this.view.frame.mount.detailKey() !== book.key || this.view.frame.mount.managing() || this.view.input.covered() || !this.view.input.appForeground()) return;
    const chapter = chapterSnapshot === undefined ? undefined : book.chapters.find((current: DownloadChapterView): boolean =>
      current.key === chapterSnapshot.key && current.chapterId === chapterSnapshot.chapterId);
    if (chapterSnapshot !== undefined && chapter === undefined) return;
    const target = describeDownloadReadingTarget(book, chapter);
    const revision = ++this.readingHandoffRevision;
    this.view.publishViewState();
    this.view.onReadTarget(target, (): boolean => this.view.frame.presentationIsCurrent(generation) &&
      revision === this.readingHandoffRevision && this.view.frame.mount.detailKey() === book.key &&
      !this.view.frame.mount.managing() && !this.view.actions.modalBlocking() && !this.view.input.covered() && this.view.input.appForeground() &&
      this.view.books.findCurrentBook(book)?.chapters.some((row: DownloadChapterView): boolean =>
        row.navigable && row.index === target.chapterIndex && row.chapterId === (target.chapterId ?? '')) === true, control);
  }

  invalidateReadingHandoff(): void {
    this.readingHandoffRevision += 1;
    this.readingReturnFocus = undefined;
  }

  quickSelectChapters(index: number): void {
    const book = this.view.books.detail(); if (book === undefined || index === 0) return;
    const current = this.currentChapter();
    if (index === 1) this.selectChapters(current === undefined ? [] : [current]);
    else if (index === 2) this.selectChapters(current === undefined ? [] : book.chapters
      .filter((chapter: DownloadChapterView): boolean => chapter.index >= current.index));
    else if (index === 3) this.selectChapters(book.chapters);
  }

  cancelChapterScrollRestore(): void {
    this.chapterScrollRestoreEpoch += 1;
    this.chapterScrollRestorePending = false;
    this.chapterScrollRestoreScheduled = false;
  }

  restoreChapterOffset(): void {
    if (!this.view.frame.mount.mounted() || !this.view.frame.mount.fontsReady() || !this.chapterScrollRestorePending || this.chapterScrollRestoreScheduled) return;
    if (this.view.books.detail()?.projectionStatus !== 'ready') {
      if (!this.view.input.loading() && this.readingReturnFocus !== undefined)
        this.view.frame.syncOverlayFocus('', false, this.readingReturnFocus);
      return;
    }
    if (!this.chapterLayoutReady) return;
    const identity = this.view.frame.mount.mountedIdentity();
    const generation = this.view.frame.mount.fontPreparationGeneration();
    const presentation = this.view.frame.mount.presentationGeneration();
    const detailKey = this.view.frame.mount.detailKey();
    const offset = this.chapterOffset;
    const epoch = this.chapterScrollRestoreEpoch;
    const windowRevision = this.view.frame.mount.readerWindowMetricsRevision();
    const viewportWidth = this.view.frame.layout.pageViewportWidth();
    const viewportHeight = this.view.frame.layout.availableHeight();
    const fontScale = this.view.frame.fontScale();
    const managing = this.view.frame.mount.managing();
    this.chapterScrollRestoreScheduled = true;
    this.view.frame.getUIContext().postFrameCallback(new SharedDownloadIdleFrame(this.view.frame.getUIContext(), (): void => {
      if (epoch !== this.chapterScrollRestoreEpoch || !this.view.frame.presentationIsCurrent(presentation) || this.view.frame.mount.mountedIdentity() !== identity ||
        generation !== this.view.frame.mount.fontPreparationGeneration()) return;
      this.chapterScrollRestoreScheduled = false;
      if (windowRevision !== this.view.frame.mount.readerWindowMetricsRevision() || viewportWidth !== this.view.frame.layout.pageViewportWidth() ||
        viewportHeight !== this.view.frame.layout.availableHeight() || fontScale !== this.view.frame.fontScale() || managing !== this.view.frame.mount.managing()) {
        this.cancelChapterScrollRestore(); return;
      }
      if (!this.view.frame.mount.fontsReady() || !this.chapterLayoutReady || !this.chapterScrollRestorePending ||
        this.view.frame.mount.detailKey() !== detailKey || this.view.books.detail()?.projectionStatus !== 'ready') return;
      try {
        this.chapterScroller.scrollTo({ xOffset: 0, yOffset: offset });
        this.chapterScrollRestorePending = false;
        if (this.readingReturnFocus !== undefined) this.view.frame.syncOverlayFocus('', false, this.readingReturnFocus);
      } catch (_) {
        // A not-yet-attached native List retains the pending position until
        // its next measured layout or book projection becomes available.
      }
    }));
  }
}

interface SharedDownloadChapterListOwnerSlot {
  readonly owner: SharedDownloadChapterListOwner;
}

interface DownloadChapterToolbarInput {
  readonly book: () => DownloadBookView;
  readonly ownerGeneration: number;
}

@Builder
function DownloadChapterToolbar(owner: SharedDownloadChapterListOwner, input: DownloadChapterToolbarInput) {
  Row({ space: DOWNLOAD_VISUAL.chapterToolbarGap }) {
    Text('章节内容').fontFamily(TYPE_DOWNLOAD_BOOK_TITLE.fontFamily).fontWeight(TYPE_DOWNLOAD_BOOK_TITLE.fontWeight)
      .fontSize(TYPE_DOWNLOAD_BOOK_TITLE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BOOK_TITLE.lineHeightFp as number).halfLeading(true)
      .fontColor(downloadVisualColor('muted', owner.view.frame.scheme())).layoutWeight(1);
    if (owner.view.frame.mount.managing()) {
      ReaderInlineSelect({ reduceMotion: owner.view.input.reduceMotion(),
        value: '快速选择',
        options: ['快速选择', '当前章节', '从当前往后', '全部章节'],
        controlWidth: sharedDownloadSelectWidth(owner.view.frame, '快速选择',
          DOWNLOAD_VISUAL.chapterToolbarSelectMaxWidth, '章节内容', true),
        onSelect: (index: number, _value: string): void => {
          const current = owner.view.books.eventBook(input.book, input.ownerGeneration);
          if (current !== undefined && owner.view.frame.mount.detailKey() === current.key) owner.quickSelectChapters(index);
        },
      });
    } else {
      Text(input.book().totalChapters === undefined ? '' : `共 ${input.book().totalChapters}${sharedDownloadChapterUnit(input.book())}`)
        .fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
        .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('muted', owner.view.frame.scheme()));
    }
  }.width('100%').padding({ top: DOWNLOAD_VISUAL.chapterToolbarTop, bottom: DOWNLOAD_VISUAL.chapterToolbarBottom });
}

interface SharedDownloadChapterListInput {
  readonly chromeOwner: SharedDownloadBookListOwner;
  readonly book: () => DownloadBookView;
  readonly ownerGeneration: number;
}

@Builder
export function SharedDownloadChapterList(owner: SharedDownloadChapterListOwner, input: SharedDownloadChapterListInput) {
  List({ scroller: owner.chapterScroller }) {
    if (!owner.view.input.embeddedWide()) { ListItem() { SharedDownloadCompactHeader({ owner: input.chromeOwner }); } }
    ListItem() { Column() { SharedDownloadBookRow(input.chromeOwner, { book: input.book, secondary: true, ownerGeneration: input.ownerGeneration }); }.width('100%').padding({ left: owner.view.frame.layout.contentLeftInset(), right: owner.view.frame.layout.contentRightInset() }); }
    ListItem() { Column() { DownloadChapterToolbar(owner, { book: input.book, ownerGeneration: input.ownerGeneration }); }.width('100%').padding({ left: owner.view.frame.layout.contentLeftInset(), right: owner.view.frame.layout.contentRightInset() }); }
    if (input.book().projectionStatus === 'unloaded' && input.book().chapters.length === 0) {
      ListItem() { Column() { ReaderPageState({ title: '正在读取章节下载情况…', loading: true }); }.width('100%').padding({ left: owner.view.frame.layout.contentLeftInset(), right: owner.view.frame.layout.contentRightInset() }); }
    } else if (input.book().projectionStatus === 'unavailable' && input.book().chapters.length === 0) {
      ListItem() { Column() { ReaderPageState({ title: '章节下载情况暂不可用', message: input.book().projectionError ?? '', actionLabel: '重试',
        onAction: (): void => {
          const current = owner.view.books.eventBook(input.book, input.ownerGeneration);
          if (current !== undefined && current.key === owner.view.frame.mount.detailKey() &&
            current.projectionStatus === 'unavailable' && current.chapters.length === 0) owner.view.onOpenBook(current);
        } }); }.width('100%').padding({ left: owner.view.frame.layout.contentLeftInset(), right: owner.view.frame.layout.contentRightInset() }); }
    } else if (input.book().projectionStatus === 'ready' && (input.book().chapters.length === 0 || input.book().totalChapters === 0)) {
      ListItem() {
        Column() {
          ReaderPageState({ title: input.book().totalChapters === 0 ? '暂无可下载章节' : '暂无章节下载信息' });
        }.width('100%').padding({ left: owner.view.frame.layout.contentLeftInset(), right: owner.view.frame.layout.contentRightInset() });
      }
    }
    ForEach(input.book().chapters, (chapter: DownloadChapterView) => {
      ListItem() {
        Column() {
          if (owner.currentChapterView(input.book(), chapter).navigable) { DownloadChapterRow(owner, { book: input.book, chapter: owner.chapterGetter(input.book, chapter), ownerGeneration: input.ownerGeneration }); }
          else { DownloadChapterGroup(owner, { book: input.book, chapter: owner.chapterGetter(input.book, chapter), ownerGeneration: input.ownerGeneration }); }
        }.width('100%').padding({ left: owner.view.frame.layout.contentLeftInset(), right: owner.view.frame.layout.contentRightInset() });
      }
    }, (chapter: DownloadChapterView): string => JSON.stringify([chapter.key, chapter.chapterId]));
    if (!owner.view.frame.layout.fixedSelectionDockVisible()) { ListItem() { SharedDownloadCompactDock({ owner: input.chromeOwner }); } }
  }.width('100%').height('100%').scrollBar(BarState.Auto)
    .onScrollStop((): void => { owner.captureChapterOffset(); owner.view.publishViewState(); })
    .onTouch((event: TouchEvent): void => owner.view.books.onListTouch(event))
    .onWillScroll((offset: number, _state: ScrollState, source: ScrollSource): void =>
      owner.view.books.onListWillScroll(offset, source, input.ownerGeneration, input.book().key))
    .onKeyEvent((): void => owner.retireReadingReturnFocus())
    .onAreaChange((_old: Area, area: Area): void => owner.recordLayoutArea(area))
    .contentStartOffset(readerScrollStartOffset(owner.view.frame.layout.scrollLayout()))
    .contentEndOffset(readerScrollEndOffset(owner.view.frame.layout.scrollLayout()));
}

interface DownloadChapterGroupInput {
  readonly book: () => DownloadBookView;
  readonly chapter: () => DownloadChapterView;
  readonly ownerGeneration: number;
}

@Builder
function DownloadChapterGroup(owner: SharedDownloadChapterListOwner, input: DownloadChapterGroupInput) {
  Row() {
    Text(input.chapter().title).fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
      .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
      .fontColor(downloadVisualColor('ink', owner.view.frame.scheme())).layoutWeight(1);
    if (owner.view.frame.mount.managing()) {
      Button({ type: ButtonType.Normal }) {
        Text('选择本卷').fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
          .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true).fontColor(sharedDownloadPrimaryInk(owner.view.frame.scheme()));
      }.constraintSize({
        minHeight: readerScaledControlHeight(28, 16, owner.view.frame.fontScale()),
        minWidth: DOWNLOAD_VISUAL.touchTarget,
      }).padding({ left: DOWNLOAD_VISUAL.progressGap, right: 0,
        top: DOWNLOAD_VISUAL.textActionPaddingY, bottom: DOWNLOAD_VISUAL.textActionPaddingY })
        .responseRegion(readerUnionTouchRegion('100%', readerScaledControlHeight(28, 16, owner.view.frame.fontScale())))
        .backgroundColor(Color.Transparent).borderRadius(0)
        .onClick((): void => {
          const currentBook = owner.view.books.eventBook(input.book, input.ownerGeneration);
          const currentChapter = owner.eventChapter(input.book, input.chapter, input.ownerGeneration);
          if (currentBook !== undefined && currentChapter !== undefined)
            owner.selectChapters(owner.groupChapters(currentBook, currentChapter), true);
        });
    }
  }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.chapterGroupHeight }).padding(DOWNLOAD_VISUAL.chapterGroupPadding).margin({ top: DOWNLOAD_VISUAL.chapterGroupTop }).backgroundColor(downloadVisualColor('soft', owner.view.frame.scheme()));
}

interface DownloadChapterRowInput {
  readonly book: () => DownloadBookView;
  readonly chapter: () => DownloadChapterView;
  readonly ownerGeneration: number;
}

@Builder
function DownloadChapterRow(owner: SharedDownloadChapterListOwner, input: DownloadChapterRowInput) {
  Flex({ wrap: owner.chapterRowWrap(), alignItems: ItemAlign.Start,
    space: { main: LengthMetrics.vp(DOWNLOAD_VISUAL.chapterGap), cross: LengthMetrics.vp(DOWNLOAD_VISUAL.chapterGap) } }) {
    if (owner.view.frame.mount.managing()) {
      Stack({ alignContent: Alignment.Center }) {
      Checkbox().select(owner.chapterSelected(input.chapter())).width(DOWNLOAD_VISUAL.chapterCheckSize).height(DOWNLOAD_VISUAL.chapterCheckSize)
        .accessibilityText(`选择章节：${input.chapter().title}，${input.book().title}`)
        .responseRegion(readerActionTouchRegion(DOWNLOAD_VISUAL.chapterCheckSize, DOWNLOAD_VISUAL.chapterCheckSize))
        .enabled(input.chapter().chapterId.length > 0)
        .selectedColor(downloadVisualColor('green', owner.view.frame.scheme()))
        .unselectedColor(downloadVisualColor('muted', owner.view.frame.scheme()))
        .mark({ strokeColor: downloadVisualColor('greenInk', owner.view.frame.scheme()) })
        .onChange((selected: boolean): void => {
          const current = owner.eventChapter(input.book, input.chapter, input.ownerGeneration);
          if (current !== undefined) owner.toggleChapter(current, selected);
        });
      }.width(DOWNLOAD_VISUAL.touchTarget).height(DOWNLOAD_VISUAL.touchTarget);
    }
    Column({ space: 0 }) {
      Flex({ wrap: FlexWrap.Wrap, alignItems: ItemAlign.Center,
        space: { main: LengthMetrics.vp(DOWNLOAD_VISUAL.statusGap), cross: LengthMetrics.vp(DOWNLOAD_VISUAL.statusGap) } }) {
        Text(input.chapter().title).fontFamily(TYPE_DOWNLOAD_CHAPTER_TITLE.fontFamily).fontWeight(TYPE_DOWNLOAD_CHAPTER_TITLE.fontWeight)
          .fontSize(TYPE_DOWNLOAD_CHAPTER_TITLE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CHAPTER_TITLE.lineHeightFp as number).halfLeading(true)
          .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
          .fontColor(downloadVisualColor(!input.chapter().localComplete && input.chapter().queueState === 'inProgress' ? 'green' : 'ink', owner.view.frame.scheme())).flexGrow(1).flexShrink(0).flexBasis(owner.chapterTextMinimum())
          .id(sharedDownloadFocusKey(owner.chapterReadingFocusKey(input.chapter(), 'title'))).focusable(!owner.view.frame.mount.managing())
          .accessibilityRole(AccessibilityRoleType.BUTTON)
          .accessibilityText(`打开章节：${input.chapter().title}，${input.book().title}`)
          .accessibilityLevel(owner.view.frame.mount.managing() ? 'no' : 'yes')
          .constraintSize({ minWidth: owner.chapterTextMinimum(), maxWidth: '100%' })
          .responseRegion(readerUnionTouchRegion('100%', readerScaledControlHeight(20, 18, owner.view.frame.fontScale())))
          .onClick((): void => { if (!owner.view.frame.mount.managing()) owner.showReadTarget(input.book(), input.chapter(), input.ownerGeneration); });
        if (sharedDownloadCurrentChapter(input.book())?.key === input.chapter().key) {
          Text('当前阅读').fontFamily(TYPE_DOWNLOAD_TAG.fontFamily).fontWeight(TYPE_DOWNLOAD_TAG.fontWeight)
            .fontSize(TYPE_DOWNLOAD_TAG.fontSizeFp).lineHeight(TYPE_DOWNLOAD_TAG.lineHeightFp as number).halfLeading(true)
            .fontColor(downloadVisualColor('green', owner.view.frame.scheme())).maxLines(1).flexShrink(0)
            .padding({ left: DOWNLOAD_VISUAL.tagPaddingX, right: DOWNLOAD_VISUAL.tagPaddingX })
            .backgroundColor(downloadVisualColor('softGreen', owner.view.frame.scheme())).borderRadius(DOWNLOAD_VISUAL.tagRadius);
        }
      }.width('100%');
      Text(downloadChapterDetailLabel(input.book().contentKind, input.chapter())).fontFamily(TYPE_DOWNLOAD_META_LINE.fontFamily).fontWeight(TYPE_DOWNLOAD_META_LINE.fontWeight)
        .fontSize(TYPE_DOWNLOAD_META_LINE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META_LINE.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('muted', owner.view.frame.scheme())).width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.sourceLineHeight });
    }.flexGrow(1).flexShrink(owner.view.frame.mount.managing() || owner.chapterRowWrap() === FlexWrap.NoWrap ? 1 : 0)
      .flexBasis(owner.chapterTextMinimum())
      .constraintSize({ minWidth: owner.chapterTextMinimum() }).alignItems(HorizontalAlign.Start);
    if (!owner.view.frame.mount.managing()) {
      Row({ space: DOWNLOAD_VISUAL.chapterTailGap }) {
      Button({ type: ButtonType.Normal }) {
        Text(owner.chapterButtonLabel(input.chapter())).fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
          .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true).fontColor(sharedDownloadPrimaryInk(owner.view.frame.scheme()));
      }.constraintSize({
        minHeight: readerScaledControlHeight(DOWNLOAD_VISUAL.chapterActionHeight, 16, owner.view.frame.fontScale()),
        minWidth: DOWNLOAD_VISUAL.touchTarget,
      }).responseRegion(readerUnionTouchRegion('100%', readerScaledControlHeight(DOWNLOAD_VISUAL.chapterActionHeight, 16, owner.view.frame.fontScale())))
        .id(input.chapter().localComplete ? sharedDownloadFocusKey(owner.chapterReadingFocusKey(input.chapter(), 'action')) : '')
        .fontColor(sharedDownloadPrimaryInk(owner.view.frame.scheme()))
        .backgroundColor(downloadVisualColor('soft', owner.view.frame.scheme()))
        .padding({ left: DOWNLOAD_VISUAL.chapterActionPaddingX, right: DOWNLOAD_VISUAL.chapterActionPaddingX, top: DOWNLOAD_VISUAL.chapterActionPaddingY, bottom: DOWNLOAD_VISUAL.chapterActionPaddingY }).borderRadius(DOWNLOAD_VISUAL.chapterActionRadius)
        .enabled(input.chapter().queueState !== 'unknown' || input.chapter().localComplete)
        .onClick((): void => {
          const currentBook = owner.view.books.eventBook(input.book, input.ownerGeneration);
          const currentChapter = owner.eventChapter(input.book, input.chapter, input.ownerGeneration);
          if (currentBook === undefined || currentChapter === undefined) return;
          if (currentChapter.localComplete) owner.showReadTarget(currentBook, currentChapter, input.ownerGeneration, 'action');
          else {
            owner.view.actions.runChapterAction(currentBook.key, sharedDownloadChapterProof(currentChapter),
              sharedDownloadChapterIsRunning(currentChapter) ? 'pause' : 'download');
          }
        });
      SharedDownloadMoreButton(owner.view.frame, { label: (): string => `${input.chapter().title}的章节操作`, action: (): void => {
        const currentBook = owner.view.books.eventBook(input.book, input.ownerGeneration);
        const currentChapter = owner.eventChapter(input.book, input.chapter, input.ownerGeneration);
        if (currentBook === undefined || currentChapter === undefined) return;
        owner.view.actions.openChapterActions(currentBook.key, sharedDownloadChapterProof(currentChapter), owner.chapterMenuFocusKey(currentChapter));
      }, chapter: true, focusTarget: (): string => owner.chapterMenuFocusKey(input.chapter()) });
      }.flexShrink(0);
    }
  }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.chapterHeight }).padding({ left: DOWNLOAD_VISUAL.chapterPaddingX, right: DOWNLOAD_VISUAL.chapterPaddingX, top: DOWNLOAD_VISUAL.chapterPaddingY, bottom: DOWNLOAD_VISUAL.chapterPaddingY })
    .border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', owner.view.frame.scheme()) });
}
