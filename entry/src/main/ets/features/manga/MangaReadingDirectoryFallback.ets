import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryColor, mangaDirectoryScale } from './MangaDirectoryVisual';
import { MangaDirectoryPressFeedback } from './MangaDirectoryPressFeedback';
import type { LocalReadingTocEntry } from '../reading/LocalReadingFlowGateway';
import { ReaderDirectoryList } from '../reading/ReaderDirectoryList';
import { projectReaderDirectoryEntries } from '../reading/ReaderDirectoryProjection';
import { sameReaderDirectoryData, snapshotReaderDirectoryData } from '../reading/ReaderDirectoryDataSnapshot';
import { mangaDirectoryPresentation, mangaDirectoryVisibleEntries,
  type MangaDirectoryRowPresentation } from './MangaDirectoryPresentation';
import { mangaDirectoryEntryRows, type MangaDirectoryLayoutRow } from './MangaDirectoryLayout';
import { MangaDirectoryEntryRow } from './MangaDirectoryEntryRow';
import { LengthMetrics } from '@kit.ArkUI';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../common/ReaderFontFamilies';

/** A source without explicit hierarchy facts still owns a usable canonical TOC.
 * Reuse the shared list/projection, preserving Core indexes and disabled rows. */
@Component
export struct MangaReadingDirectoryFallback {
  @StorageLink('readerWindowMetricsRevision') @Watch('onLayoutInputsChanged') private windowMetricsRevision: number = 0;
  @Prop @Watch('onIdentityChanged') sourceId: string = '';
  @Prop @Watch('onIdentityChanged') bookId: string = '';
  @Prop @Watch('onEntriesChanged') entries: LocalReadingTocEntry[] = [];
  @Prop @Watch('onViewInputsChanged') query: string = '';
  @Prop @Watch('onViewInputsChanged') ascending: boolean = true;
  @Prop @Watch('onCurrentChapterChanged') currentChapterIndex: number = -1;
  @Prop @Watch('onLocateCurrent') locateCurrentRevision: number = 0;
  @Prop mangaScheme: string = 'day';
  @Prop rowHeight: number = 58;
  @Prop @Watch('onLayoutInputsChanged') mangaCatalogDisplay: boolean = false;
  @Prop @Watch('onLayoutInputsChanged') mangaCatalogNarrow: boolean | undefined = undefined;
  @Prop currentOpenInset: number = 50;
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onOpenFullDirectory: () => void = (): void => {};
  onClearSearch: () => void = (): void => {};
  onListFirstLayout: () => void = (): void => {};
  onListUserScroll: () => void = (): void => {};
  @Prop @Watch('prepareLayout') chapterDownloadEnabled: boolean = false;
  onDownloadChapter: (index: number) => void = (_index: number): void => {};
  @State private projectedEntries: LocalReadingTocEntry[] = [];
  @State private layoutRows: MangaDirectoryLayoutRow[] = [];
  private viewportWidth: number = 0;
  @State private collapsedGroups: number[] = [];
  private admittedEntries: LocalReadingTocEntry[] = [];
  private admittedIdentity: string = '';
  private mounted: boolean = false;
  private listReady: boolean = false;
  private scrollGeneration: number = 0;
  private pendingScroll: 'opening' | 'current' | 'top' | undefined = undefined;
  @State private presentation: Map<number, MangaDirectoryRowPresentation> = new Map<number, MangaDirectoryRowPresentation>();
  /** Full tools and chapter content can share their existing native owner. */
  scroller: Scroller | undefined = undefined;
  private readonly listScroller: Scroller = new Scroller();

  private activeScroller(): Scroller { return this.scroller ?? this.listScroller; }

  aboutToAppear(): void {
    this.mounted = true;
    this.admitEntries(true);
    this.requestScroll('opening');
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.scrollGeneration += 1;
    this.pendingScroll = undefined;
  }

  private identity(): string { return `${this.sourceId}\u0000${this.bookId}`; }

  private admitEntries(force: boolean = false): boolean {
    if (!this.mounted) return false;
    if (!force && this.admittedIdentity === this.identity() &&
      sameReaderDirectoryData(this.admittedEntries, this.entries)) return false;
    const previousIdentity = this.admittedIdentity;
    const previousEntries = this.admittedEntries;
    this.admittedIdentity = this.identity();
    this.admittedEntries = snapshotReaderDirectoryData(this.entries);
    this.preparePresentation();
    // A collapse preference belongs to this exact canonical group. Reused
    // indexes, changed group facts, and a different book cannot inherit it.
    this.collapsedGroups = previousIdentity === this.admittedIdentity ? this.collapsedGroups.filter((index: number): boolean => {
      const previous = previousEntries.find((entry: LocalReadingTocEntry): boolean => entry.index === index);
      const current = this.admittedEntries.find((entry: LocalReadingTocEntry): boolean => entry.index === index);
      return previous !== undefined && current !== undefined && this.rowPresentation(current)?.hasChildren === true &&
        sameReaderDirectoryData([previous], [current]);
    }) : [];
    this.expandCurrentAncestors();
    this.publishProjection();
    return true;
  }

  private publishProjection(): void {
    // Search always sees the complete admitted catalog; collapse is a display
    // preference and never changes target indexes or full-tree presentation.
    const query = this.query.trim();
    const quick = query.length === 0 && !this.mangaCatalogDisplay;
    const visible = quick ? this.admittedEntries.filter((entry: LocalReadingTocEntry): boolean => entry.navigable !== false) :
      query.length > 0 ? this.admittedEntries : mangaDirectoryVisibleEntries(this.admittedEntries, this.presentation, this.collapsedGroups);
    // The compact Quick viewport can browse the entire admitted catalog.
    // Core target indexes, disabled rows and full-tree metadata remain intact.
    const projected = projectReaderDirectoryEntries(visible, query, this.ascending);
    if (!sameReaderDirectoryData(this.projectedEntries, projected)) this.projectedEntries = projected;
    this.prepareLayout();
  }

  /** Presentation only, from complete explicit depth/navigability facts.
   * Missing levels or unknown target admission never manufacture a group count. */
  private preparePresentation(): void {
    // Publish one immutable presentation snapshot. A filtered chapter array
    // may stay equal while a group's full-catalog count changes.
    this.presentation = mangaDirectoryPresentation(this.admittedEntries);
  }

  private rowPresentation(entry: LocalReadingTocEntry): MangaDirectoryRowPresentation | undefined {
    return this.presentation.get(entry.index);
  }

  private prepareLayout(): void {
    this.layoutRows = mangaDirectoryEntryRows(this.projectedEntries, this.presentation,
      this.mangaCatalogNarrow !== undefined ? this.mangaCatalogNarrow : (this.viewportWidth > 0 && this.viewportWidth <= visual.narrowWidth),
      this.fontScale(), this.viewportWidth, this.chapterDownloadEnabled ? visual.downloadGridWidth : 0);
  }

  private fontScale(): number {
    return mangaDirectoryScale(this.windowMetricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale);
  }

  private onViewportChanged(width: number): void {
    if (!this.mounted || !Number.isFinite(width) || width <= 0 || Math.abs(width - this.viewportWidth) <= 0.1) return;
    this.viewportWidth = width;
    this.prepareLayout();
  }

  private layoutEntryRows(): LocalReadingTocEntry[] {
    return this.layoutRows.map((row: MangaDirectoryLayoutRow): LocalReadingTocEntry => row.entries[0]);
  }

  private layoutRow(entry: LocalReadingTocEntry): MangaDirectoryLayoutRow {
    return this.layoutRows.find((row: MangaDirectoryLayoutRow): boolean => row.entries[0]?.index === entry.index) ??
      { kind: 'row', columns: 1, startIndex: 0, entries: [], labels: [] };
  }

  private showContext(entry: LocalReadingTocEntry): boolean {
    if (this.mangaCatalogDisplay || this.query.trim().length > 0) return false;
    const rowIndex = this.layoutRows.findIndex((row: MangaDirectoryLayoutRow): boolean => row.entries[0]?.index === entry.index);
    const previousEntry = rowIndex > 0 ? this.layoutRows[rowIndex - 1].entries[0] : undefined;
    return previousEntry === undefined || this.rowPresentation(previousEntry)?.contextTitle !== this.rowPresentation(entry)?.contextTitle;
  }

  private onLayoutInputsChanged(): void {
    if (!this.mounted) return;
    this.publishProjection();
  }

  private onCurrentChapterChanged(): void {
    if (!this.mounted) return;
    this.expandCurrentAncestors();
    this.publishProjection();
    this.requestScroll('opening');
  }

  private expandCurrentAncestors(): void {
    const ancestors = this.presentation.get(this.currentChapterIndex)?.ancestorGroupIndexes ?? [];
    this.collapsedGroups = this.collapsedGroups.filter((index: number): boolean => !ancestors.includes(index));
  }

  private onIdentityChanged(): void {
    if (this.admitEntries(true)) this.requestScroll('opening');
  }

  private onEntriesChanged(): void {
    if (this.admitEntries()) this.requestScroll('opening');
  }

  private onViewInputsChanged(): void {
    if (!this.mounted) return;
    this.publishProjection();
    this.requestScroll('top');
  }

  private onLocateCurrent(): void {
    if (!this.mounted) return;
    const current = this.admittedEntries.find((entry: LocalReadingTocEntry): boolean => entry.index === this.currentChapterIndex);
    const ancestors = current === undefined ? [] : this.rowPresentation(current)?.ancestorGroupIndexes ?? [];
    this.collapsedGroups = this.collapsedGroups.filter((index: number): boolean => !ancestors.includes(index));
    this.publishProjection();
    this.requestScroll('current');
  }

  private requestScroll(intent: 'opening' | 'current' | 'top'): void {
    this.pendingScroll = intent;
    const generation = ++this.scrollGeneration;
    setTimeout((): void => {
      if (!this.mounted || generation !== this.scrollGeneration || !this.listReady) return;
      const index = intent === 'top' ? 0 :
        this.layoutRows.findIndex((row: MangaDirectoryLayoutRow): boolean =>
          row.entries.some((entry: LocalReadingTocEntry): boolean => entry.index === this.currentChapterIndex));
      if (index >= 0 && index < this.layoutRows.length) {
        this.activeScroller().scrollToIndex(index, intent === 'current', ScrollAlign.START,
          { extraOffset: LengthMetrics.vp(intent === 'top' ? 0 : intent === 'current' ? -12 : -this.currentOpenInset) });
        this.pendingScroll = undefined;
      }
    }, 0);
  }

  private onFirstLayout(): void {
    this.listReady = true;
    if (this.pendingScroll !== undefined) this.requestScroll(this.pendingScroll);
    this.onListFirstLayout();
  }

  private onUserScrollIntent(): void {
    this.scrollGeneration += 1;
    this.pendingScroll = undefined;
    this.onListUserScroll();
  }

  private selectEntry(entry: LocalReadingTocEntry, identity: string): void {
    if (!this.mounted || identity !== this.identity() || identity !== this.admittedIdentity ||
      !sameReaderDirectoryData(this.admittedEntries, this.entries)) return;
    const current = this.projectedEntries.find((item: LocalReadingTocEntry): boolean => item.index === entry.index);
    if (current === undefined || !sameReaderDirectoryData([current], [entry])) return;
    if (current.navigable === false) return;
    this.onSelectChapter(entry.index);
  }

  private mangaColor(role: string): string {
    return mangaDirectoryColor(role, this.mangaScheme);
  }

  private toggleBranch(entry: LocalReadingTocEntry, identity: string): void {
    if (!this.mounted || this.query.trim().length > 0 || identity !== this.identity() || identity !== this.admittedIdentity ||
      !sameReaderDirectoryData(this.admittedEntries, this.entries) || this.rowPresentation(entry)?.hasChildren !== true) return;
    const current = this.projectedEntries.find((item: LocalReadingTocEntry): boolean => item.index === entry.index);
    if (current === undefined || !sameReaderDirectoryData([current], [entry])) return;
    this.collapsedGroups = this.collapsedGroups.includes(entry.index) ?
      this.collapsedGroups.filter((index: number): boolean => index !== entry.index) : [...this.collapsedGroups, entry.index];
    this.onUserScrollIntent();
    this.publishProjection();
  }

  private downloadEntry(entry: LocalReadingTocEntry, identity: string): void {
    if (!this.mounted || !this.chapterDownloadEnabled || entry.navigable === false || entry.downloadState === 'unknown' ||
      identity !== this.admittedIdentity || identity !== this.identity() || !sameReaderDirectoryData(this.admittedEntries, this.entries)) return;
    const current = this.projectedEntries.find((item: LocalReadingTocEntry): boolean => item.index === entry.index);
    if (current !== undefined && sameReaderDirectoryData([current], [entry])) this.onDownloadChapter(entry.index);
  }

  @Builder
  private emptyActionLabel(label: string) {
    Text(label).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(visual.bodyFontWeight)
      .fontSize(visual.quietEmptyFontSize).lineHeight(visual.quietEmptyLineHeight).halfLeading(true)
      .minFontScale(Math.min(1, this.fontScale())).maxFontScale(Math.max(1, this.fontScale()))
      .fontColor(this.mangaColor('accent')).textAlign(TextAlign.Center);
  }

  @Builder
  private emptyState() {
    Column({ space: visual.quietEmptyGap }) {
      Text(this.query.trim().length > 0 ? '没有匹配的章节' : '暂无章节信息').width('100%')
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(visual.bodyFontWeight)
        .fontSize(visual.quietEmptyFontSize).lineHeight(visual.quietEmptyLineHeight).halfLeading(true)
        .minFontScale(Math.min(1, this.fontScale())).maxFontScale(Math.max(1, this.fontScale()))
        .fontColor(this.mangaColor('muted')).textAlign(TextAlign.Center);
      if (this.query.trim().length > 0) {
        Stack() { this.emptyActionLabel('清除搜索'); }
          .constraintSize({ minHeight: visual.quietEmptyClearHeight })
          .attributeModifier(new MangaDirectoryPressFeedback(true, true, this.mangaScheme))
          .onClick((): void => this.onClearSearch()).accessibilityText('清除目录搜索');
      } else if (this.admittedEntries.length === 0) {
        Button() { this.emptyActionLabel('打开完整目录'); }.constraintSize({ minHeight: visual.gridHeight })
          .attributeModifier(new MangaDirectoryPressFeedback(true, true, this.mangaScheme))
          .onClick((): void => this.onOpenFullDirectory());
      }
    }.width('100%').constraintSize({ minHeight: visual.quietEmptyMinHeight })
      .padding({ left: visual.quietEmptyPaddingX, right: visual.quietEmptyPaddingX,
        top: visual.quietEmptyPaddingY, bottom: visual.quietEmptyPaddingY })
      .border({ width: { top: visual.gridBorder }, color: this.mangaColor('line') })
      .justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center);
  }

  @Builder
  private row(entry: LocalReadingTocEntry, identity: string) {
    MangaDirectoryEntryRow({ row: this.layoutRow(entry), presentation: this.presentation,
      scheme: this.mangaScheme, currentChapterIndex: this.currentChapterIndex,
      collapsedBranches: this.collapsedGroups, query: this.query,
      showContext: this.showContext(entry), branchControlsEnabled: this.mangaCatalogDisplay, chapterDownloadEnabled: this.chapterDownloadEnabled,
      onSelectEntry: (selected: LocalReadingTocEntry): void => this.selectEntry(selected, identity),
      onToggleBranch: (selected: LocalReadingTocEntry): void => this.toggleBranch(selected, identity),
      onDownloadEntry: (selected: LocalReadingTocEntry): void => this.downloadEntry(selected, identity),
    });
  }

  build() {
    ReaderDirectoryList({
      entries: this.layoutEntryRows(), rowHeight: 44, naturalRowHeight: true,
      listPaddingX: 0, listPaddingY: 0, listPaddingBottom: this.mangaCatalogDisplay ? 18 : 14, scroller: this.activeScroller(),
      onFirstLayout: (): void => this.onFirstLayout(),
      onViewportChanged: (width: number, _height: number): void => this.onViewportChanged(width),
      onUserScrollIntent: (): void => this.onUserScrollIntent(),
      rowBuilder: (item: RepeatItem<LocalReadingTocEntry>) => { this.row(item.item, this.admittedIdentity); },
      emptyBuilder: (): void => this.emptyState(),
    }).width('100%').height('100%');
  }
}
