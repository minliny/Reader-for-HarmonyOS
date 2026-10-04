import { TYPE_MANGA_DIRECTORY_CATALOG_CURRENT, TYPE_MANGA_DIRECTORY_CATALOG_CURRENT_NARROW, TYPE_MANGA_DIRECTORY_CATALOG_TITLE, TYPE_MANGA_DIRECTORY_CATALOG_TITLE_NARROW, TYPE_MANGA_DIRECTORY_CURRENT, TYPE_MANGA_DIRECTORY_CURRENT_TITLE, TYPE_MANGA_DIRECTORY_EMPTY, TYPE_MANGA_DIRECTORY_META, TYPE_MANGA_DIRECTORY_TITLE, TYPE_MANGA_SHEET_INPUT, TYPE_MANGA_SHEET_SECTION } from '../common/ReaderTypography';
import type { LocalReadingTocEntry } from '../reading/LocalReadingFlowGateway';
import { ReaderDirectoryList } from '../reading/ReaderDirectoryList';
import { projectReaderDirectoryEntries } from '../reading/ReaderDirectoryProjection';
import { sameReaderDirectoryData, snapshotReaderDirectoryData } from '../reading/ReaderDirectoryDataSnapshot';
import { readerDirectoryAccessibilityText } from '../reading/ReaderDirectoryHierarchy';
import { LengthMetrics } from '@kit.ArkUI';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_550,
  READER_FONT_NOTO_SANS_SC_UI_600 } from '../common/ReaderFontFamilies';

interface MangaFallbackRowPresentation {
  parentTitle?: string;
  readableDescendantCount?: number;
  ancestorGroupIndexes: number[];
  group: boolean;
  countComplete: boolean;
}

/** A source without explicit hierarchy facts still owns a usable canonical TOC.
 * Reuse the shared list/projection, preserving Core indexes and disabled rows. */
@Component
export struct MangaReadingDirectoryFallback {
  @Prop @Watch('onIdentityChanged') sourceId: string = '';
  @Prop @Watch('onIdentityChanged') bookId: string = '';
  @Prop @Watch('onEntriesChanged') entries: LocalReadingTocEntry[] = [];
  @Prop @Watch('onViewInputsChanged') query: string = '';
  @Prop @Watch('onViewInputsChanged') ascending: boolean = true;
  @Prop currentChapterIndex: number = -1;
  @Prop @Watch('onLocateCurrent') locateCurrentRevision: number = 0;
  @Prop mangaScheme: string = 'day';
  @Prop rowHeight: number = 58;
  @Prop mangaCatalogDisplay: boolean = false;
  @Prop mangaCatalogNarrow: boolean = false;
  @Prop currentOpenInset: number = 50;
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onOpenFullDirectory: () => void = (): void => {};
  onClearSearch: () => void = (): void => {};
  @State private projectedEntries: LocalReadingTocEntry[] = [];
  @State private collapsedGroups: number[] = [];
  private admittedEntries: LocalReadingTocEntry[] = [];
  private admittedIdentity: string = '';
  private mounted: boolean = false;
  private listReady: boolean = false;
  private scrollGeneration: number = 0;
  private pendingScroll: 'opening' | 'current' | 'top' | undefined = undefined;
  @State private presentation: Map<number, MangaFallbackRowPresentation> = new Map<number, MangaFallbackRowPresentation>();
  private readonly listScroller: Scroller = new Scroller();

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
      return previous !== undefined && current !== undefined && this.rowPresentation(current)?.group === true &&
        sameReaderDirectoryData([previous], [current]);
    }) : [];
    this.publishProjection();
    return true;
  }

  private publishProjection(): void {
    // Search always sees the complete admitted catalog; collapse is a display
    // preference and never changes target indexes or full-tree presentation.
    const query = this.query.trim();
    const visible = query.length > 0 ? this.admittedEntries : this.admittedEntries.filter((entry: LocalReadingTocEntry): boolean =>
      !(this.rowPresentation(entry)?.ancestorGroupIndexes ?? []).some((index: number): boolean => this.collapsedGroups.includes(index)));
    const projected = projectReaderDirectoryEntries(visible, query, this.ascending);
    if (!sameReaderDirectoryData(this.projectedEntries, projected)) this.projectedEntries = projected;
  }

  /** Presentation only, from complete explicit depth/navigability facts.
   * Missing levels or unknown target admission never manufacture a group count. */
  private preparePresentation(): void {
    const presentation: Map<number, MangaFallbackRowPresentation> = new Map<number, MangaFallbackRowPresentation>();
    const ancestors: LocalReadingTocEntry[] = [];
    for (let ordinal = 0; ordinal < this.admittedEntries.length; ordinal += 1) {
      const entry = this.admittedEntries[ordinal];
      const level = entry.level;
      if (level === undefined || !Number.isInteger(level) || level < 1) {
        for (const ancestor of ancestors) {
          const value = presentation.get(ancestor.index);
          if (value !== undefined) value.countComplete = false;
        }
        ancestors.length = 0;
        continue;
      }
      while (ancestors.length > 0 && (ancestors[ancestors.length - 1].level ?? 1) >= level) ancestors.pop();
      const parent = ancestors.length === 0 ? undefined : ancestors[ancestors.length - 1];
      const nextLevel = this.admittedEntries[ordinal + 1]?.level;
      const group = entry.navigable === false && nextLevel !== undefined && Number.isInteger(nextLevel) && nextLevel > level;
      presentation.set(entry.index, { group, countComplete: true,
        ancestorGroupIndexes: ancestors.map((ancestor: LocalReadingTocEntry): number => ancestor.index),
        parentTitle: parent?.title, readableDescendantCount: group ? 0 : undefined });
      for (const ancestor of ancestors) {
        const value = presentation.get(ancestor.index);
        if (value === undefined) continue;
        if (entry.navigable === true) value.readableDescendantCount = (value.readableDescendantCount ?? 0) + 1;
        else if (entry.navigable === undefined) value.countComplete = false;
      }
      if (group) ancestors.push(entry);
    }
    // Publish one immutable presentation snapshot. A filtered chapter array
    // may stay equal while a group's full-catalog count changes.
    this.presentation = presentation;
  }

  private rowPresentation(entry: LocalReadingTocEntry): MangaFallbackRowPresentation | undefined {
    return this.presentation.get(entry.index);
  }

  private groupSpacing(entry: LocalReadingTocEntry): number {
    return this.rowPresentation(entry)?.group === true && this.query.trim().length === 0 &&
      this.projectedEntries[0]?.index !== entry.index ? 12 : 0;
  }

  private groupExpanded(entry: LocalReadingTocEntry): boolean {
    return !this.collapsedGroups.includes(entry.index);
  }

  private rowFontFamily(entry: LocalReadingTocEntry): string {
    return this.rowPresentation(entry)?.group === true ? READER_FONT_NOTO_SANS_SC_UI_600 :
      entry.navigable !== false && entry.index === this.currentChapterIndex ? READER_FONT_NOTO_SANS_SC_UI_550 :
        READER_FONT_NOTO_SANS_SC_UI_REGULAR;
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
        this.projectedEntries.findIndex((entry: LocalReadingTocEntry): boolean => entry.index === this.currentChapterIndex);
      if (index >= 0 && index < this.projectedEntries.length) {
        this.listScroller.scrollToIndex(index, intent === 'current', ScrollAlign.START,
          { extraOffset: LengthMetrics.vp(intent === 'top' ? 0 : intent === 'current' ? -12 : -this.currentOpenInset) });
        this.pendingScroll = undefined;
      }
    }, 0);
  }

  private onFirstLayout(): void {
    this.listReady = true;
    if (this.pendingScroll !== undefined) this.requestScroll(this.pendingScroll);
  }

  private onUserScrollIntent(): void {
    this.scrollGeneration += 1;
    this.pendingScroll = undefined;
  }

  private selectEntry(entry: LocalReadingTocEntry, identity: string): void {
    if (!this.mounted || identity !== this.identity() || identity !== this.admittedIdentity ||
      !sameReaderDirectoryData(this.admittedEntries, this.entries)) return;
    const current = this.projectedEntries.find((item: LocalReadingTocEntry): boolean => item.index === entry.index);
    if (current === undefined || !sameReaderDirectoryData([current], [entry])) return;
    if (this.rowPresentation(current)?.group === true) {
      this.collapsedGroups = this.groupExpanded(current) ? [...this.collapsedGroups, current.index] :
        this.collapsedGroups.filter((index: number): boolean => index !== current.index);
      this.onUserScrollIntent();
      this.publishProjection();
      return;
    }
    if (current.navigable === false) return;
    this.onSelectChapter(entry.index);
  }

  private mangaColor(role: string): string {
    const night = this.mangaScheme === 'night';
    if (role === 'accent') return night ? '#B9CEB1' : '#425D45';
    if (role === 'muted') return night ? '#ABA99F' : '#756F69';
    if (role === 'faint') return night ? '#767D71' : '#A39C90';
    if (role === 'line') return night ? '#3B4036' : '#E7E0D5';
    if (role === 'active') return night ? '#303C2D' : '#E8EDE2';
    if (role === 'soft') return night ? '#30342D' : '#F0ECE3';
    return night ? '#EAE7DE' : '#1F1B17';
  }

  @Builder
  private row(entry: LocalReadingTocEntry, identity: string) {
    Row({ space: this.rowPresentation(entry)?.group === true ? 14 : this.mangaCatalogDisplay && this.mangaCatalogNarrow ? 5 : 12 }) {
      Column({ space: 4 }) {
        Flex({ direction: this.mangaCatalogDisplay && this.mangaCatalogNarrow ? FlexDirection.Column : FlexDirection.Row,
          alignItems: this.mangaCatalogDisplay && this.mangaCatalogNarrow ? ItemAlign.Start : ItemAlign.Baseline }) {
          Text(entry.title.trim().length > 0 && entry.title.trim() !== '第话' && entry.title.trim() !== '第 话' ?
            entry.title : `第${Math.max(1, entry.index + 1)}话`).flexShrink(1)
            .fontFamily(this.rowPresentation(entry)?.group === true ? TYPE_MANGA_SHEET_SECTION.fontFamily : entry.navigable !== false && entry.index === this.currentChapterIndex ? TYPE_MANGA_DIRECTORY_CURRENT_TITLE.fontFamily : TYPE_MANGA_DIRECTORY_TITLE.fontFamily)
            .fontSize(this.rowPresentation(entry)?.group === true ? TYPE_MANGA_SHEET_SECTION.fontSizeFp : this.mangaCatalogDisplay ? this.mangaCatalogNarrow ? TYPE_MANGA_DIRECTORY_CATALOG_TITLE_NARROW.fontSizeFp : TYPE_MANGA_DIRECTORY_CATALOG_TITLE.fontSizeFp : TYPE_MANGA_DIRECTORY_TITLE.fontSizeFp)
            .lineHeight((this.rowPresentation(entry)?.group === true ? TYPE_MANGA_SHEET_SECTION.lineHeightFp : this.mangaCatalogDisplay ? TYPE_MANGA_DIRECTORY_CATALOG_TITLE.lineHeightFp : TYPE_MANGA_DIRECTORY_TITLE.lineHeightFp) as number)
            .fontWeight(this.rowPresentation(entry)?.group === true ? TYPE_MANGA_SHEET_SECTION.fontWeight : TYPE_MANGA_DIRECTORY_TITLE.fontWeight)
            .fontColor(this.mangaColor(entry.navigable !== false && entry.index === this.currentChapterIndex ? 'accent' :
              entry.navigable === false && this.rowPresentation(entry)?.group !== true ? 'muted' : 'ink'));
          if (this.rowPresentation(entry)?.group === true && this.rowPresentation(entry)?.countComplete === true) {
            Text(`${this.rowPresentation(entry)?.readableDescendantCount} 个可读条目`).fontFamily(TYPE_MANGA_DIRECTORY_META.fontFamily)
              .fontWeight(TYPE_MANGA_DIRECTORY_META.fontWeight).fontSize(TYPE_MANGA_DIRECTORY_META.fontSizeFp).lineHeight((TYPE_MANGA_DIRECTORY_META.lineHeightFp) as number)
              .fontColor(this.mangaColor('muted')).maxLines(1).flexShrink(0)
              .margin({ left: this.mangaCatalogDisplay && this.mangaCatalogNarrow ? 0 : 9,
                top: this.mangaCatalogDisplay && this.mangaCatalogNarrow ? 1 : 0 });
          }
        }.width('100%');
        if (this.query.trim().length > 0 && this.rowPresentation(entry)?.parentTitle !== undefined) {
          Text(this.rowPresentation(entry)?.parentTitle).fontFamily(TYPE_MANGA_DIRECTORY_META.fontFamily)
            .fontWeight(TYPE_MANGA_DIRECTORY_META.fontWeight).fontSize(TYPE_MANGA_DIRECTORY_META.fontSizeFp).lineHeight((TYPE_MANGA_DIRECTORY_META.lineHeightFp) as number)
            .fontColor(this.mangaColor('muted')).width('100%');
        }
      }.layoutWeight(1).alignItems(HorizontalAlign.Start);
      if (this.rowPresentation(entry)?.group === true) {
        Image(this.mangaScheme === 'night' ? $r('app.media.manga_sheet_chevron_down_theme_night') :
          $r('app.media.manga_sheet_chevron_down')).width(16).height(16)
          .rotate({ angle: this.groupExpanded(entry) ? 0 : -90 }).animation({ duration: 180, curve: 'ease' });
      } else if (entry.navigable !== false && entry.index === this.currentChapterIndex) {
        Text('正在读').fontFamily(TYPE_MANGA_DIRECTORY_CURRENT.fontFamily).fontWeight(TYPE_MANGA_DIRECTORY_CURRENT.fontWeight)
          .fontSize(this.mangaCatalogDisplay ? (this.mangaCatalogNarrow ? TYPE_MANGA_DIRECTORY_CATALOG_CURRENT_NARROW.fontSizeFp : TYPE_MANGA_DIRECTORY_CATALOG_CURRENT.fontSizeFp) : TYPE_MANGA_DIRECTORY_CURRENT.fontSizeFp).lineHeight((TYPE_MANGA_DIRECTORY_CURRENT.lineHeightFp) as number).fontColor(this.mangaColor('accent'));
      } else if (entry.navigable !== false) {
        Image(this.mangaScheme === 'night' ? $r('app.media.manga_sheet_chevron_right_theme_night') :
          $r('app.media.manga_sheet_chevron_right')).width(13).height(13);
      }
    }.width('100%').constraintSize({ minHeight: this.rowPresentation(entry)?.group === true ? this.mangaCatalogDisplay ? 44 : 48 :
        this.mangaCatalogDisplay ? 48 : this.rowHeight })
      .padding({ left: this.rowPresentation(entry)?.group === true ? this.mangaCatalogDisplay ? 15 : 12 :
          this.mangaCatalogDisplay ? this.mangaCatalogNarrow ? (entry.level ?? 1) > 1 ? 20 : 12 : (entry.level ?? 1) > 1 ? 28 : 15 :
            this.query.trim().length > 0 ? 10 : 10 + Math.min(4, Math.max(0, (entry.level ?? 1) - 1)) * 16,
        right: this.rowPresentation(entry)?.group === true ? this.mangaCatalogDisplay ? 15 : 12 : this.mangaCatalogDisplay && !this.mangaCatalogNarrow ? 15 : 10,
        top: this.rowPresentation(entry)?.group === true ? this.mangaCatalogDisplay ? 10 : 11 : this.mangaCatalogDisplay ? 11 : 14,
        bottom: this.rowPresentation(entry)?.group === true ? this.mangaCatalogDisplay ? 10 : 11 : this.mangaCatalogDisplay ? 11 : 14 })
      .margin({ top: this.groupSpacing(entry) })
      .border({ width: { top: !this.mangaCatalogDisplay && this.projectedEntries[0]?.index === entry.index ? 1 : 0,
        bottom: this.rowPresentation(entry)?.group === true ? 0 : 1 }, color: this.mangaColor('line') })
      .backgroundColor(entry.navigable !== false && entry.index === this.currentChapterIndex ?
        this.mangaColor('active') : this.rowPresentation(entry)?.group === true ? this.mangaColor('soft') : Color.Transparent)
      .accessibilityText(this.rowPresentation(entry)?.group === true ?
        `${entry.title}，分组，${this.groupExpanded(entry) ? '已展开' : '已折叠'}` : readerDirectoryAccessibilityText(entry))
      .enabled(this.rowPresentation(entry)?.group === true || entry.navigable !== false)
      .onClick((): void => this.selectEntry(entry, identity));
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderDirectoryList({
        entries: this.projectedEntries, rowHeight: this.rowHeight, naturalRowHeight: true,
        listPaddingX: 0, listPaddingY: 0, listPaddingBottom: this.mangaCatalogDisplay ? 18 : 14, scroller: this.listScroller,
        onFirstLayout: (): void => this.onFirstLayout(),
        onUserScrollIntent: (): void => this.onUserScrollIntent(),
        rowBuilder: (item: RepeatItem<LocalReadingTocEntry>) => { this.row(item.item, this.admittedIdentity); },
      }).width('100%').height('100%');
      if (this.projectedEntries.length === 0) {
        Column({ space: 8 }) {
          Text(this.query.trim().length > 0 ? '没有匹配的章节' : '暂无章节信息')
            .fontFamily(TYPE_MANGA_DIRECTORY_EMPTY.fontFamily).fontWeight(TYPE_MANGA_DIRECTORY_EMPTY.fontWeight)
            .fontSize(TYPE_MANGA_DIRECTORY_EMPTY.fontSizeFp).fontColor(this.mangaColor('muted'));
          if (this.query.trim().length > 0) {
            Text('清除搜索').fontSize(TYPE_MANGA_DIRECTORY_EMPTY.fontSizeFp).fontColor(this.mangaColor('accent'))
              .fontFamily(TYPE_MANGA_DIRECTORY_EMPTY.fontFamily).fontWeight(TYPE_MANGA_DIRECTORY_EMPTY.fontWeight)
              .height(36).onClick((): void => this.onClearSearch()).accessibilityText('清除目录搜索');
          } else if (this.admittedEntries.length === 0) {
            Button('打开完整目录').fontFamily(TYPE_MANGA_SHEET_INPUT.fontFamily).fontWeight(TYPE_MANGA_SHEET_INPUT.fontWeight).height(44).onClick((): void => this.onOpenFullDirectory());
          }
        }.width('100%').constraintSize({ minHeight: 164 }).padding({ left: 12, right: 12, top: 36, bottom: 36 })
          .border({ width: { top: this.mangaCatalogDisplay ? 0 : 1 }, color: this.mangaColor('line') })
          .justifyContent(FlexAlign.Center);
      }
    }.width('100%').height('100%');
  }
}
