import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { MANGA_DIRECTORY_VISUAL, mangaDirectoryColor, mangaDirectoryScale } from './MangaDirectoryVisual';
import { motionAnimateParam } from '../common/MotionSpec';
import { MangaDirectoryPressFeedback } from './MangaDirectoryPressFeedback';
import type { LocalReadingTocEntry } from '../reading/LocalReadingFlowGateway';
import type { MangaDirectoryRowPresentation } from './MangaDirectoryPresentation';
import { mangaDirectoryDisplay } from './MangaDirectoryDisplay';
import { mangaDirectoryDownloadStatusText } from './MangaDirectoryState';
import type { MangaDirectoryLayoutRow, MangaDirectoryLabel } from './MangaDirectoryLayout';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_550,
  READER_FONT_NOTO_SANS_SC_UI_600 } from '../common/ReaderFontFamilies';

/** Shared manga row content. The owning directory retains admission, folding,
 * download and canonical-target validation; this component owns only painting. */
@Component
export struct MangaDirectoryEntryRow {
  @Prop row: MangaDirectoryLayoutRow = { kind: 'row', columns: 1, startIndex: 0, entries: [], labels: [] };
  @Prop presentation: Map<number, MangaDirectoryRowPresentation> = new Map<number, MangaDirectoryRowPresentation>();
  @Prop scheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private windowMetricsRevision: number = 0;
  @Prop currentChapterIndex: number = -1;
  @Prop collapsedBranches: number[] = [];
  @Prop query: string = '';
  @Prop showContext: boolean = false;
  @Prop interactionEnabled: boolean = true;
  @Prop chapterDownloadEnabled: boolean = false;
  @Prop branchControlsEnabled: boolean = true;
  onSelectEntry: (entry: LocalReadingTocEntry) => void = (_entry: LocalReadingTocEntry): void => {};
  onToggleBranch: (entry: LocalReadingTocEntry) => void = (_entry: LocalReadingTocEntry): void => {};
  onDownloadEntry: (entry: LocalReadingTocEntry) => void = (_entry: LocalReadingTocEntry): void => {};

  /** ForEach retains its keyed Builder arguments. Only their canonical index
   * is stable; every painted fact and action must read the current row Prop. */
  private liveEntry(entry: LocalReadingTocEntry): LocalReadingTocEntry | undefined {
    return this.row.entries.find((current: LocalReadingTocEntry): boolean => current.index === entry.index);
  }

  private liveLabel(entry: LocalReadingTocEntry): MangaDirectoryLabel | undefined {
    const ordinal = this.row.entries.findIndex((current: LocalReadingTocEntry): boolean => current.index === entry.index);
    return ordinal >= 0 ? this.row.labels[ordinal] : undefined;
  }

  private facts(entry: LocalReadingTocEntry): MangaDirectoryRowPresentation | undefined {
    return this.liveEntry(entry) === undefined ? undefined : this.presentation.get(entry.index);
  }

  private color(role: string): string {
    return mangaDirectoryColor(role, this.scheme);
  }

  private fontScale(): number {
    const revision = this.windowMetricsRevision;
    return revision >= 0 ? mangaDirectoryScale(ReaderWindowCoordinator.metrics().systemFontScale) : 1;
  }

  private cellHeight(): number {
    return Math.max(MANGA_DIRECTORY_VISUAL.gridHeight,
      MANGA_DIRECTORY_VISUAL.gridPaddingY * 2 + MANGA_DIRECTORY_VISUAL.namedLineHeight * this.fontScale() +
      MANGA_DIRECTORY_VISUAL.gridBorder * 2);
  }

  private current(entry: LocalReadingTocEntry): boolean {
    const current = this.liveEntry(entry);
    return current !== undefined && current.navigable !== false && current.index === this.currentChapterIndex;
  }

  private expanded(entry: LocalReadingTocEntry): boolean {
    return this.query.trim().length > 0 || !this.collapsedBranches.includes(entry.index);
  }

  private downloadable(entry: LocalReadingTocEntry): boolean {
    const current = this.liveEntry(entry);
    return current !== undefined && this.chapterDownloadEnabled && current.navigable !== false && current.downloadState !== 'unknown';
  }

  private title(entry: LocalReadingTocEntry): string {
    const current = this.liveEntry(entry);
    return current === undefined ? '' : mangaDirectoryDisplay(current).title;
  }

  private contextTitle(entry: LocalReadingTocEntry): string {
    const current = this.liveEntry(entry);
    return current?.contextTitle?.trim().length ? current.contextTitle : this.facts(entry)?.contextTitle ?? '';
  }

  private status(entry: LocalReadingTocEntry): string {
    const current = this.liveEntry(entry);
    if (current === undefined) return '';
    return [mangaDirectoryDisplay(current).statusText,
      mangaDirectoryDownloadStatusText(current.downloadState, this.downloadable(entry))]
      .filter((text: string): boolean => text.length > 0).join(' · ');
  }

  private gridLabel(label: MangaDirectoryLabel): string {
    return label.kind === 'parts' ? `${label.numberText} · ${label.part}` : label.numberText ?? '';
  }

  private accessibility(entry: LocalReadingTocEntry): string {
    const facts = this.facts(entry);
    const context = this.contextTitle(entry) ? `${this.contextTitle(entry)}，` : '';
    const state = facts?.group === true ? `分组，${this.expanded(entry) ? '已展开' : '已折叠'}` :
      this.liveEntry(entry)?.navigable === false ? '暂不可读' : this.liveEntry(entry)?.navigable === undefined ? '状态待确认，打开章节' : '打开章节';
    const metadata = this.status(entry);
    return `${context}${this.title(entry)}，${state}${this.current(entry) ? '，正在读' : ''}${metadata ? `，${metadata}` : ''}${this.liveEntry(entry)?.downloadState === 'completed' && this.downloadable(entry) ? '，已下载' : ''}`;
  }

  private activateEntry(entry: LocalReadingTocEntry): void {
    const current = this.liveEntry(entry);
    if (!this.interactionEnabled || current === undefined) return;
    if (this.facts(current)?.group === true && this.branchControlsEnabled && this.query.trim().length === 0) this.onToggleBranch(current);
    else if (current.navigable !== false) this.onSelectEntry(current);
  }

  @Builder
  private download(entry: LocalReadingTocEntry, grid: boolean) {
    if (this.downloadable(entry)) {
      Stack() {
        Stack() {
          Image(this.liveEntry(entry)?.downloadState === 'completed' ?
          (this.scheme === 'night' ? $r('app.media.reader_directory_marker_check_theme_night') : $r('app.media.reader_directory_marker_check')) :
          (this.scheme === 'night' ? $r('app.media.reader_directory_marker_download_theme_night') : $r('app.media.reader_directory_marker_download')))
          .width(grid ? 12 : 15).height(grid ? 12 : 15);
      }.width(grid ? MANGA_DIRECTORY_VISUAL.downloadGridWidth : 28).height(grid ? this.cellHeight() - MANGA_DIRECTORY_VISUAL.gridBorder * 2 :
        Math.max(28, MANGA_DIRECTORY_VISUAL.namedLineHeight * this.fontScale()))
        .accessibilityText(`管理${this.title(entry)}下载`)
        .enabled(this.interactionEnabled)
        .onClick((): void => {
          const current = this.liveEntry(entry);
          if (current !== undefined && this.interactionEnabled && this.downloadable(current)) this.onDownloadEntry(current);
        });
      }.width(grid ? MANGA_DIRECTORY_VISUAL.downloadGridWidth : 28)
        .height(grid ? this.cellHeight() - MANGA_DIRECTORY_VISUAL.gridBorder * 2 : Math.max(28, MANGA_DIRECTORY_VISUAL.namedLineHeight * this.fontScale()))
        // Native child clicks win the default exclusive arena. If the child
        // is disabled, this inert actor prevents a chapter click behind it.
        .focusable(false).accessibilityLevel('no').onClick((): void => {});
    }
  }

  @Builder
  private numberCell(entry: LocalReadingTocEntry) {
    Stack({ alignContent: Alignment.TopEnd }) {
      Row() {
        Row({ space: 0 }) {
          Text(this.liveLabel(entry)?.numberText ?? '').constraintSize({ minWidth: 0 }).flexShrink(1)
            .fontFamily(this.current(entry) ? READER_FONT_NOTO_SANS_SC_UI_550 : READER_FONT_NOTO_SANS_SC_UI_REGULAR)
            .minFontScale(Math.min(1, this.fontScale())).maxFontScale(Math.max(1, this.fontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.namedFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.namedLineHeight)
            .fontWeight(this.current(entry) ? MANGA_DIRECTORY_VISUAL.currentFontWeight : MANGA_DIRECTORY_VISUAL.bodyFontWeight, { enableVariableFontWeight: true }).maxLines(1)
            .fontColor(this.color(this.current(entry) ? 'accent' : 'ink'));
          if (this.liveLabel(entry)?.kind === 'parts') {
            Text(` · ${this.liveLabel(entry)?.part ?? ''}`).flexShrink(0).maxLines(1)
              .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).minFontScale(Math.min(1, this.fontScale())).maxFontScale(Math.max(1, this.fontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.namedFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.namedLineHeight).fontWeight(MANGA_DIRECTORY_VISUAL.bodyFontWeight)
              .fontColor(this.color(this.current(entry) ? 'accent' : 'muted'));
          }
          if (this.status(entry).length > 0) {
            Text(this.status(entry)).flexShrink(0).maxLines(1)
              .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
              .minFontScale(Math.min(1, this.fontScale())).maxFontScale(Math.max(1, this.fontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.metaFontSize)
              .lineHeight(MANGA_DIRECTORY_VISUAL.metaLineHeight).fontColor(this.color('muted'))
              .margin({ left: MANGA_DIRECTORY_VISUAL.contentGap });
          }
        }.layoutWeight(1).constraintSize({ minWidth: 0 }).justifyContent(FlexAlign.Center)
          .height(this.cellHeight() - MANGA_DIRECTORY_VISUAL.gridBorder * 2).padding({ left: MANGA_DIRECTORY_VISUAL.gridPaddingX, right: MANGA_DIRECTORY_VISUAL.gridPaddingX });
        this.download(entry, true);
      }.width('100%').constraintSize({ minHeight: this.cellHeight() - MANGA_DIRECTORY_VISUAL.gridBorder * 2 });
      if (this.current(entry)) {
        Image(this.scheme === 'night' ? $r('app.media.manga_sheet_locate_theme_night') : $r('app.media.manga_sheet_locate'))
          .width(MANGA_DIRECTORY_VISUAL.gridMarkSize).height(MANGA_DIRECTORY_VISUAL.gridMarkSize)
          .margin({ top: MANGA_DIRECTORY_VISUAL.gridMarkInset, right: MANGA_DIRECTORY_VISUAL.gridMarkInset }).hitTestBehavior(HitTestMode.None)
          .accessibilityLevel('no');
      }
    }.layoutWeight(1).constraintSize({ minWidth: 0, minHeight: this.cellHeight() })
      .border({ width: MANGA_DIRECTORY_VISUAL.gridBorder, color: this.color('line') }).borderRadius(MANGA_DIRECTORY_VISUAL.gridRadius)
      .backgroundColor(this.color(this.current(entry) ? 'active' : 'soft'))
      .attributeModifier(new MangaDirectoryPressFeedback(this.interactionEnabled, true, this.scheme))
      .enabled(this.interactionEnabled).accessibilityText(this.accessibility(entry))
      .onClick((): void => this.activateEntry(entry));
  }

  @Builder
  private branchToggle(entry: LocalReadingTocEntry) {
    if (this.branchControlsEnabled && this.facts(entry)?.hasChildren === true) {
      Stack() {
        Image(this.scheme === 'night' ? $r('app.media.manga_sheet_chevron_down_theme_night') :
          $r('app.media.manga_sheet_chevron_down')).width(16).height(16)
          .rotate({ angle: this.expanded(entry) ? 0 : -90 }).animation(motionAnimateParam('manga.directory.fold'));
      }.width(this.facts(entry)?.group === true ? 16 : 32).height(this.facts(entry)?.group === true ? 16 : 32)
        .margin({ left: this.facts(entry)?.group === true ? 0 : 8, right: this.facts(entry)?.group === true ? 0 : 8 })
        .responseRegion({ x: this.facts(entry)?.group === true ? -10 : 0,
          y: this.facts(entry)?.group === true ? -14 : 0,
          width: this.facts(entry)?.group === true ? 36 : 32, height: this.facts(entry)?.group === true ? 44 : 32 })
        .enabled(this.interactionEnabled && this.query.trim().length === 0)
        .attributeModifier(new MangaDirectoryPressFeedback(this.interactionEnabled && this.query.trim().length === 0,
          this.facts(entry)?.group !== true, this.scheme))
        .accessibilityText(`${this.title(entry)}，${this.expanded(entry) ? '收起' : '展开'}子目录`)
        .onClick((): void => {
          const current = this.liveEntry(entry);
          if (current !== undefined && this.interactionEnabled && this.branchControlsEnabled &&
            this.query.trim().length === 0 && this.facts(current)?.hasChildren === true) this.onToggleBranch(current);
        });
    }
  }

  @Builder
  private fullWidthEntry(entry: LocalReadingTocEntry) {
    if (this.branchControlsEnabled && this.facts(entry)?.readableParent === true) {
      Row({ space: 0 }) {
        this.fullWidthEntryBody(entry);
        this.branchToggle(entry);
      }.width('100%').border({ width: { bottom: MANGA_DIRECTORY_VISUAL.gridBorder }, color: this.color('line') });
    } else {
      this.fullWidthEntryBody(entry);
    }
  }

  @Builder
  private fullWidthEntryBody(entry: LocalReadingTocEntry) {
    Row({ space: this.facts(entry)?.group === true ? MANGA_DIRECTORY_VISUAL.groupGap : MANGA_DIRECTORY_VISUAL.namedGap }) {
      Column({ space: MANGA_DIRECTORY_VISUAL.contentGap }) {
        Flex({ direction: FlexDirection.Row, wrap: FlexWrap.Wrap, alignItems: ItemAlign.Baseline }) {
          Text(this.title(entry)).wordBreak(WordBreak.BREAK_WORD).flexShrink(1).constraintSize({ minWidth: 0 })
            .fontFamily(this.facts(entry)?.group === true ? READER_FONT_NOTO_SANS_SC_UI_600 :
              this.current(entry) ? READER_FONT_NOTO_SANS_SC_UI_550 : READER_FONT_NOTO_SANS_SC_UI_REGULAR)
            .minFontScale(Math.min(1, this.fontScale())).maxFontScale(Math.max(1, this.fontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.namedFontSize)
            .lineHeight(this.facts(entry)?.group === true ? MANGA_DIRECTORY_VISUAL.groupLineHeight : MANGA_DIRECTORY_VISUAL.namedLineHeight)
            .fontWeight(this.facts(entry)?.group === true ? MANGA_DIRECTORY_VISUAL.groupFontWeight :
              this.current(entry) ? MANGA_DIRECTORY_VISUAL.currentFontWeight : MANGA_DIRECTORY_VISUAL.bodyFontWeight, { enableVariableFontWeight: true })
            .fontColor(this.color(this.current(entry) ? 'accent' : 'ink'));
          if (this.facts(entry)?.group === true && this.facts(entry)?.countComplete === true) {
            Text(`${this.facts(entry)?.readableDescendantCount} 个可读条目`)
              .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).minFontScale(Math.min(1, this.fontScale())).maxFontScale(Math.max(1, this.fontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.metaFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.metaLineHeight)
              .fontColor(this.color('muted')).margin({ left: MANGA_DIRECTORY_VISUAL.groupCountGap })
              .wordBreak(WordBreak.BREAK_WORD).constraintSize({ maxWidth: '100%' }).flexShrink(1);
          }
          if (this.status(entry).length > 0) {
            Text(this.status(entry)).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
              .minFontScale(Math.min(1, this.fontScale())).maxFontScale(Math.max(1, this.fontScale()))
              .halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.metaFontSize)
              .lineHeight(MANGA_DIRECTORY_VISUAL.metaLineHeight).fontColor(this.color('muted'))
              .margin({ left: MANGA_DIRECTORY_VISUAL.contentGap }).maxLines(1);
          }
        }.width('100%');
        if (this.facts(entry)?.readableParent === true) {
          Text('可阅读，含子目录').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).minFontScale(Math.min(1, this.fontScale())).maxFontScale(Math.max(1, this.fontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.metaFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.metaLineHeight)
            .fontColor(this.color('muted')).width('100%');
        }
        if (this.query.trim().length > 0 && this.contextTitle(entry).length > 0) {
          Text(this.contextTitle(entry)).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).minFontScale(Math.min(1, this.fontScale())).maxFontScale(Math.max(1, this.fontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.metaFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.metaLineHeight)
            .fontColor(this.color('muted')).width('100%');
        }
      }.layoutWeight(1).constraintSize({ minWidth: 0 }).alignItems(HorizontalAlign.Start);
      this.download(entry, false);
      if (this.branchControlsEnabled && this.facts(entry)?.group === true && this.facts(entry)?.hasChildren === true) {
        this.branchToggle(entry);
      } else if (this.liveEntry(entry)?.navigable === false) {
        Text('暂不可读').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).minFontScale(Math.min(1, this.fontScale())).maxFontScale(Math.max(1, this.fontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.stateFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.stateLineHeight)
          .fontColor(this.color('muted')).flexShrink(0);
      } else if (this.liveEntry(entry)?.navigable === undefined) {
        Text('状态待确认').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).minFontScale(Math.min(1, this.fontScale())).maxFontScale(Math.max(1, this.fontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.stateFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.stateLineHeight)
          .fontColor(this.color('muted')).flexShrink(0);
      } else if (this.current(entry)) {
        Text('正在读').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).minFontScale(Math.min(1, this.fontScale())).maxFontScale(Math.max(1, this.fontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.stateFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.stateLineHeight)
          .fontColor(this.color('accent')).flexShrink(0);
      } else {
        Image(this.scheme === 'night' ? $r('app.media.manga_sheet_chevron_right_theme_night') :
          $r('app.media.manga_sheet_chevron_right')).width(13).height(13);
      }
    }.width('100%').layoutWeight(this.branchControlsEnabled && this.facts(entry)?.readableParent === true ? 1 : 0)
      .constraintSize({ minHeight: this.facts(entry)?.group === true ? MANGA_DIRECTORY_VISUAL.groupMinHeight : MANGA_DIRECTORY_VISUAL.namedMinHeight })
      .padding({ left: this.facts(entry)?.group === true ? MANGA_DIRECTORY_VISUAL.groupPaddingX :
          this.query.trim().length > 0 || this.showContext || (this.liveEntry(entry)?.level ?? 1) <= 1 ? MANGA_DIRECTORY_VISUAL.namedPaddingX : MANGA_DIRECTORY_VISUAL.childPaddingLeft,
        right: this.facts(entry)?.group === true ? MANGA_DIRECTORY_VISUAL.groupPaddingX : MANGA_DIRECTORY_VISUAL.namedPaddingX,
        top: this.facts(entry)?.group === true ? MANGA_DIRECTORY_VISUAL.groupPaddingY : MANGA_DIRECTORY_VISUAL.namedPaddingY,
        bottom: this.facts(entry)?.group === true ? MANGA_DIRECTORY_VISUAL.groupPaddingY : MANGA_DIRECTORY_VISUAL.namedPaddingY })
      .margin({ top: this.row.groupSpacing ?? 0 })
      .border({ width: { bottom: this.facts(entry)?.group === true ||
        this.branchControlsEnabled && this.facts(entry)?.readableParent === true ? 0 : MANGA_DIRECTORY_VISUAL.gridBorder }, color: this.color('line') })
      .backgroundColor(this.current(entry) ? this.color('active') : this.facts(entry)?.group === true ? this.color('soft') : Color.Transparent)
      .opacity(this.liveEntry(entry)?.navigable === false && this.facts(entry)?.group !== true ? MANGA_DIRECTORY_VISUAL.disabledOpacity : 1)
      .attributeModifier(new MangaDirectoryPressFeedback(this.interactionEnabled &&
        (this.facts(entry)?.group === true ? this.branchControlsEnabled && this.query.trim().length === 0 : this.liveEntry(entry) !== undefined && this.liveEntry(entry)?.navigable !== false),
        this.facts(entry)?.group !== true || this.interactionEnabled && this.branchControlsEnabled && this.query.trim().length === 0, this.scheme))
      .enabled(this.interactionEnabled && (this.facts(entry)?.group === true ? this.branchControlsEnabled && this.query.trim().length === 0 : this.liveEntry(entry) !== undefined && this.liveEntry(entry)?.navigable !== false))
      .accessibilityText(this.accessibility(entry)).onClick((): void => this.activateEntry(entry));
  }

  private emptySlots(): number[] {
    const slots: number[] = [];
    const count = Math.max(0, this.row.columns - this.row.entries.length);
    for (let index = 0; index < count; index += 1) slots.push(index);
    return slots;
  }

  build() {
    Column() {
      if (this.showContext && this.row.entries.length > 0 && this.contextTitle(this.row.entries[0]).length > 0) {
        Text(this.contextTitle(this.row.entries[0])).width('100%')
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).minFontScale(Math.min(1, this.fontScale())).maxFontScale(Math.max(1, this.fontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.metaFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.metaLineHeight)
          .fontColor(this.color('muted')).padding({ left: MANGA_DIRECTORY_VISUAL.namedPaddingX, right: MANGA_DIRECTORY_VISUAL.namedPaddingX,
            top: MANGA_DIRECTORY_VISUAL.contextPaddingTop, bottom: MANGA_DIRECTORY_VISUAL.contextPaddingBottom })
          .border({ width: { bottom: 1 }, color: this.color('line') });
      }
      if (this.row.kind === 'row') {
        ForEach(this.row.entries, (entry: LocalReadingTocEntry) => { this.fullWidthEntry(entry); },
          (entry: LocalReadingTocEntry): string => `${entry.index}`);
      } else {
        Row({ space: MANGA_DIRECTORY_VISUAL.gridGap }) {
          ForEach(this.row.entries, (entry: LocalReadingTocEntry) => {
            this.numberCell(entry);
          }, (entry: LocalReadingTocEntry): string => `${entry.index}`);
          ForEach(this.emptySlots(),
            (_index: number) => { Blank().layoutWeight(1); }, (_index: number): string => `blank-${_index}`);
        }.width('100%').padding({ top: this.row.runStart === false ? 0 : MANGA_DIRECTORY_VISUAL.gridRunMargin,
          bottom: this.row.runEnd === false ? MANGA_DIRECTORY_VISUAL.gridGap : MANGA_DIRECTORY_VISUAL.gridRunMargin });
      }
    }.width('100%').alignItems(HorizontalAlign.Start)
      .border({ width: { top: this.row.startIndex === 0 ? MANGA_DIRECTORY_VISUAL.gridBorder : 0 }, color: this.color('line') });
  }
}
