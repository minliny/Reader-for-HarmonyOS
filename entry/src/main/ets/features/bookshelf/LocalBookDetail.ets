import { TYPE_APP_COMPACT_PRIMARY_ACTION, TYPE_APP_INHERITED_BODY, TYPE_APP_SECTION_LABEL, TYPE_BOOK_DETAIL_ACTION, TYPE_BOOK_DETAIL_AUTHOR, TYPE_BOOK_DETAIL_DESCRIPTION, TYPE_BOOK_DETAIL_EMPTY, TYPE_BOOK_DETAIL_META, TYPE_BOOK_DETAIL_SOURCE_ACTION, TYPE_BOOK_DETAIL_TITLE, TYPE_BOOK_DIRECTORY_ENTRY } from '../common/ReaderTypography';
import { bookAuthorLabel } from '../common/BookAuthorMetadata';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import type { ReadingBookDetail } from '../reading/ReadingBookDetail';
import { bookIntroText } from '../common/BookIntroText';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  READER_FLOATING_TOP_BAR_HEIGHT,
  readerFloatingBarBottomInset,
} from '../common/ReaderFloatingBarMetrics';
import {
  readerVisualSafeLeft,
  readerVisualSafeRight, readerInteractiveSafeTop, readerInteractiveSafeBottom,
} from '../common/ReaderWindowMetrics';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  TOK_ACTION_DIVIDER,
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_CARD_BG_HI,
  TOK_CHAPTER_DIVIDER,
  TOK_CONTENT_MAX_W_TABLET,
  TOK_DANGER,
  TOK_GREEN,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_PRIMARY_DARK,
  TOK_SETTING_ACTION_BG,
  TOK_SPACE_CARD_PADDING,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';

import type { LocalReadingTocEntry } from '../reading/LocalReadingFlowGateway';
import { NoCoverCover } from './NoCoverCover';
import { registerReaderFonts } from '../common/ReaderFonts';
import { PageBackBar } from '../common/PageBackBar';
import { mangaDirectoryIsGroup, mangaDirectoryPresentation, mangaDirectoryVisibleEntries } from '../manga/MangaDirectoryPresentation';

const PHONE_SUMMARY_HEIGHT = 120.313;
const TABLET_SUMMARY_HEIGHT = 98.875;
const CHAPTER_SECTION_HEIGHT = 282;
const CHAPTER_ROW_HEIGHT = 58;
const CHAPTER_PREVIEW_LIMIT = 20;
const DETAIL_ACTION_AREA_HEIGHT = 77;

/** Shared detail presentation. Core facts decide the type and readable rows. */
@Component
export struct LocalBookDetail {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onBookChanged') book: ReadingBookDetail;
  @Prop @Watch('onTocChanged') toc: LocalReadingTocEntry[] = [];
  @Prop sourceSwitchEnabled: boolean = false;
  @Prop readingEnabled: boolean = true;
  @Prop readingBlockedReason: string = '';
  @Prop inBookshelf: boolean = true;
  @Prop removalEnabled: boolean = true;
  @Prop removing: boolean = false;
  @Prop adding: boolean = false;
  @Prop cancellingAdd: boolean = false;
  @Prop shelfMessage: string = '';
  @Prop admissionIdentity: string = '';
  @Prop loadingMessage: string = '';
  onContinue: () => void = (): void => {};
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onOpenDirectory: () => void = (): void => {};
  onSwitchSource: () => void = (): void => {};
  onRemove: (identity?: string) => void = (_identity?: string): void => {};
  onCancelAdd: (identity?: string) => void = (_identity?: string): void => {};
  onBack: () => void = (): void => {};
  @State private viewportWidth: number = 0;
  @State private introExpanded: boolean = false;
  @State private collapsedGroups: number[] = [];
  private collapseIdentity: string = '';
  private collapseEntries: LocalReadingTocEntry[] = [];

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.onBookChanged();
  }

  build() {
    Stack({ alignContent: Alignment.Top }) {
      // Bars float over one full-viewport scroll owner. Only content inside
      // Scroll receives clearance; corner pixels remain paintable and draggable.
      Scroll() {
        Column({ space: 24 }) {
          this.hero();
          this.readingFacts();
          this.summary();
          this.catalog();
          if (this.shelfMessage.length > 0) {
            Text(this.shelfMessage).width('100%').fontSize(12)
              .fontColor(readerAppColor('TOK_DANGER', this.appThemeScheme));
          }
        }.width(this.contentFrame().width).alignItems(HorizontalAlign.Start)
          .margin({ left: this.contentFrame().left, right: this.contentFrame().right })
          .padding({ top: this.topInset() + 76, bottom: this.bottomInset() + 104 });
      }.width('100%').height('100%').scrollBar(BarState.Off);
      Row() {
        PageBackBar({ title: '书籍详情', floating: true, centered: true,
          backIcon: this.appThemeScheme === 'night' ? $r('app.media.book_detail_back_theme_night') : $r('app.media.book_detail_back'),
          onBack: (): void => this.onBack() });
      }.width('100%').padding({ left: 16 + this.safeLeft(), right: 16 + this.safeRight(), top: this.topInset() + 8 })
        .align(Alignment.Top).hitTestBehavior(HitTestMode.Transparent);
      // Keep the action dock in a full-viewport bottom-aligned owner. The
      // detail surface itself is top-aligned so the scroll and header retain
      // their coordinate space; aligning the dock row directly against that
      // stack placed it at the top edge on HarmonyOS.
      Stack({ alignContent: Alignment.Bottom }) {
        this.actionArea();
      }.width('100%').height('100%').hitTestBehavior(HitTestMode.Transparent);
    }.width('100%').height('100%')
      .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
      .onAreaChange((_old: Area, area: Area): void => {
        const width = Number(area.width);
        if (Number.isFinite(width) && width > 0) this.viewportWidth = width;
      });
  }

  @Builder
  private hero() {
    Row({ space: this.book.contentKind === 'manga' ? 16 : 18 }) {
      if (this.hasCover()) {
        Image(this.book.coverUrl as string)
          .width(this.book.contentKind === 'manga' ? 104 : 84)
          .height(this.book.contentKind === 'manga' ? 150 : 122)
          .objectFit(ImageFit.Cover).borderRadius(this.book.contentKind === 'manga' ? 10 : 8);
      } else {
        NoCoverCover({ coverWidth: this.book.contentKind === 'manga' ? 104 : 84,
          coverHeight: this.book.contentKind === 'manga' ? 150 : 122 });
      }
      Column({ space: 8 }) {
        if (this.book.contentKind === 'manga') {
          Row({ space: 6 }) {
            this.metadataTag('漫画');
            this.metadataTag(this.book.sourceId === 'local' ? '本地' : '在线');
          }.width('100%');
        }
        Text(this.book.title).width('100%').fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold).fontSize(24).lineHeight(34)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(bookAuthorLabel(this.book.author)).width('100%').fontFamily('ReaderNotoSansSC')
          .fontSize(13).lineHeight(20).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        if (this.book.contentKind !== 'manga') {
          Row({ space: 6 }) {
            this.metadataTag(this.book.contentKind === 'audio' ? '有声' : '小说');
            this.metadataTag(this.book.sourceId === 'local' ? '本地' : '在线');
          }.width('100%');
        }
        if (this.book.contentKind === 'manga') {
          // The manga design keeps source and latest chapter in the hero
          // information block. This makes the cover, identity, source and
          // latest item one scan before the independent reading-position card.
          Row({ space: 8 }) {
            Text(`当前来源：${this.book.sourceName}`).layoutWeight(1).constraintSize({ minWidth: 0 })
              .fontSize(12).lineHeight(18).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
              .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
            if (this.sourceSwitchEnabled) {
              Text('换源').height(28).padding({ left: 10, right: 10 }).fontSize(11)
                .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
                .backgroundColor(readerAppColor('TOK_SETTING_ACTION_BG', this.appThemeScheme)).borderRadius(9)
                .textAlign(TextAlign.Center).onClick((): void => this.onSwitchSource());
            }
          }.width('100%');
          Text(`最新：${this.book.lastChapter?.trim() || '暂无最新章节'}`).width('100%')
            .fontSize(11).lineHeight(18).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        }
      }.layoutWeight(1).constraintSize({ minWidth: 0 }).alignItems(HorizontalAlign.Start);
    }.width('100%').constraintSize({ minHeight: this.book.contentKind === 'manga' ? 150 : 122 }).alignItems(VerticalAlign.Top);
  }

  @Builder
  private metadataTag(label: string) {
    Text(label).fontSize(10).lineHeight(18).padding({ left: 7, right: 7 })
      .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
      .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .border({ width: 0.5, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(4);
  }

  @Builder
  private readingFacts() {
    if (this.book.contentKind === 'manga') {
      // Keep the position separate from source metadata. When Core has no
      // admitted location, show an explicit empty state and never fabricate a
      // page number or chapter title.
      Column({ space: 6 }) {
        Text('上次读到').width('100%').fontSize(10).lineHeight(16)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        Row({ space: 8 }) {
          Text(this.book.mangaPosition?.chapterTitle?.trim() || '尚未开始阅读')
            .layoutWeight(1).constraintSize({ minWidth: 0 }).fontSize(13).lineHeight(20)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
          Text(this.book.mangaPosition === undefined ? '—' :
            `${this.book.mangaPosition.pageOrdinal + 1}${this.book.mangaPosition.totalPages !== undefined ? ` / ${this.book.mangaPosition.totalPages}` : ''} 页`)
            .flexShrink(0).fontSize(11).lineHeight(20)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).textAlign(TextAlign.End);
        }.width('100%');
      }.width('100%').padding({ left: 14, right: 14, top: 12, bottom: 12 })
        .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) }).borderRadius(12)
        .alignItems(HorizontalAlign.Start);
    } else {
      Column({ space: 9 }) {
        Row({ space: 12 }) {
          Text(`当前来源：${this.book.sourceName}`).layoutWeight(1).constraintSize({ minWidth: 0 })
            .fontSize(13).lineHeight(20).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
          if (this.sourceSwitchEnabled) {
            Text('换源').height(32).padding({ left: 12, right: 12 }).fontSize(12)
              .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
              .backgroundColor(readerAppColor('TOK_SETTING_ACTION_BG', this.appThemeScheme)).borderRadius(10)
              .textAlign(TextAlign.Center).onClick((): void => { if (this.sourceSwitchEnabled) this.onSwitchSource(); });
          }
        }.width('100%');
        Text(`最新：${this.book.lastChapter?.trim() || '暂无最新章节'}`).width('100%')
          .fontSize(12).lineHeight(20).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      }.width('100%').alignItems(HorizontalAlign.Start);
    }
  }

  @Builder
  private summary() {
    Column({ space: 8 }) {
      Text('简介').fontSize(15).fontWeight(FontWeight.Bold).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
      Text(this.displayIntro() || '暂无简介').width('100%').fontFamily('ReaderNotoSansSC')
        .fontSize(13).lineHeight(24).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(this.introExpanded ? 10000 : 3).textOverflow({ overflow: TextOverflow.Ellipsis });
      if (this.displayIntro().length > 0) {
        Text(this.introExpanded ? '收起' : '展开').height(32).fontSize(12)
          .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
          .onClick((): void => { this.introExpanded = !this.introExpanded; });
      }
    }.width('100%').padding({ top: this.book.contentKind === 'manga' ? 16 : 0, bottom: this.book.contentKind === 'manga' ? 16 : 0 })
      .border({ width: { top: this.book.contentKind === 'manga' ? TOK_BORDER_W : 0,
        bottom: this.book.contentKind === 'manga' ? TOK_BORDER_W : 0 }, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
      .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private catalog() {
    Column() {
      Row({ space: 8 }) {
        Text(this.book !== undefined && this.book.contentKind === 'manga' ? '章节目录' : '目录').fontSize(15).fontWeight(FontWeight.Bold).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
        Text(this.book !== undefined && this.book.contentKind === 'manga' ?
          `${this.toc.filter((entry: LocalReadingTocEntry): boolean => entry.navigable !== false).length} 个可读条目${this.toc.filter((entry: LocalReadingTocEntry): boolean => entry.navigable === false).length > 0 ? ` · ${this.toc.filter((entry: LocalReadingTocEntry): boolean => entry.navigable === false).length} 个卷组` : ''}` :
          `${this.toc.filter((entry: LocalReadingTocEntry): boolean => entry.navigable !== false).length} 个可读条目`)
          .layoutWeight(1).fontSize(11).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        // Keep the 44vp hit target separate from the 30vp painted capsule.
        // The SVG is a real production asset; selecting the theme variant here
        // also keeps the action legible when the detail surface switches to
        // the night palette.
        Stack({ alignContent: Alignment.Center }) {
          Row({ space: 6 }) {
            Image(this.appThemeScheme === 'night' ? $r('app.media.book_detail_directory_theme_night') :
              $r('app.media.book_detail_directory')).width(20).height(20);
            Text('完整目录').fontFamily('ReaderInter').fontWeight(900).fontSize(12)
              .fontColor(readerAppColor(this.appThemeScheme === 'night' ? 'TOK_GREEN' : 'TOK_PRIMARY_DARK', this.appThemeScheme))
              .maxLines(1);
          }.width(94).height(30).padding({ left: 11, right: 11 })
            .backgroundColor(readerAppColor('app.LocalBookDetail.chapterSection.backgroundColor.A3FFFCF8', this.appThemeScheme))
            .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
            .borderRadius(999).alignItems(VerticalAlign.Center);
        }.width(94).height(44).enabled(!this.removing)
          .onClick((): void => { if (!this.removing) this.onOpenDirectory(); });
      }.width('100%').constraintSize({ minHeight: 44 });
      ForEach(this.visibleToc(), (entry: LocalReadingTocEntry) => {
        this.chapterRow(entry);
      }, (entry: LocalReadingTocEntry): string => JSON.stringify([this.book.sourceId, this.book.bookId,
        entry.index, entry.title, entry.level ?? null, entry.navigable ?? null]));
      if (this.toc.length === 0) {
        Text(this.chapterEmptyMessage()).width('100%').padding({ top: 16, bottom: 16 })
          .fontSize(13).lineHeight(22).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      }
    }.width('100%');
  }

  @Builder
  private chapterRow(entry: LocalReadingTocEntry) {
    Row({ space: 8 }) {
      Text(this.book.contentKind === 'manga' &&
        (entry.title.trim().length === 0 || entry.title.trim() === '第话' || entry.title.trim() === '第 话') ?
        `第${Math.max(1, entry.index + 1)}话` : entry.title)
        .layoutWeight(1).constraintSize({ minWidth: 0 })
        .fontFamily('ReaderNotoSansSC').fontSize(14).lineHeight(22)
        .fontWeight(entry.navigable === false ? FontWeight.Medium : FontWeight.Regular)
        .fontColor(readerAppColor(entry.navigable === false ? 'TOK_MUTED' : 'TOK_INK', this.appThemeScheme));
      if (entry.navigable === false && (this.book.contentKind !== 'manga' || this.chapterIsGroup(entry))) {
        Text(this.collapsedGroups.includes(entry.index) ? '›' : '⌄').width(24).fontSize(18)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      } else if (this.isCurrentChapter(entry)) {
        Text('正在读').fontSize(11).fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme));
      }
    }.width('100%').constraintSize({ minHeight: entry.navigable === false ? 44 : 58 })
      .padding({ left: this.chapterIndent(entry), right: 10, top: 10, bottom: 10 })
      .border({ width: { bottom: 0.5 }, color: { bottom: readerAppColor('TOK_CHAPTER_DIVIDER', this.appThemeScheme) } })
      .backgroundColor(this.isCurrentChapter(entry) ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) :
        entry.navigable === false ? readerAppColor('TOK_CARD_BG', this.appThemeScheme) : Color.Transparent)
      .borderRadius(this.isCurrentChapter(entry) || entry.navigable === false ? 8 : 0)
      .enabled(!this.removing).onClick((): void => {
        if (this.removing) return;
        const current = this.toc.find((row: LocalReadingTocEntry): boolean => row.index === entry.index);
        if (current === undefined || current.title !== entry.title || current.level !== entry.level ||
          current.navigable !== entry.navigable) return;
        if (entry.navigable === false) {
          if (this.book.contentKind === 'manga' && !this.chapterIsGroup(entry)) return;
          this.collapsedGroups = this.collapsedGroups.includes(entry.index) ?
            this.collapsedGroups.filter((index: number): boolean => index !== entry.index) : [...this.collapsedGroups, entry.index];
        } else this.onSelectChapter(entry.index);
      });
  }

  @Builder
  private actionArea() {
    // Measure the 48vp action row independently from the 68vp painted dock;
    // horizontal insets must not shrink its vertical button bounds.
    Stack({ alignContent: Alignment.Center }) {
      Row({ space: 12 }) {
        Text(this.readingActionLabel()).layoutWeight(1).height(48).fontFamily('ReaderNotoSansSCUIBold')
          .fontSize(14).fontWeight(FontWeight.Bold)
          .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme))
          .textAlign(TextAlign.Center).backgroundColor(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme)).borderRadius(16)
          .enabled(!this.removing).opacity(this.removing ? 0.5 : 1)
          .onClick((): void => { if (!this.removing) this.onContinue(); });
        ForEach([this.admissionIdentity], (identity: string) => {
        Text(this.shelfActionLabel()).width(94).height(48).fontFamily('ReaderNotoSansSCUIMedium')
          .fontSize(12).fontWeight(500)
          // Removing is a quiet secondary action; adding remains the positive
          // green affordance used by the shelf entry surface.
          .textAlign(TextAlign.Center).fontColor(readerAppColor(this.inBookshelf ? 'TOK_MUTED' : 'TOK_GREEN', this.appThemeScheme))
          .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme)).borderRadius(16)
          .border({ width: 1, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
          .enabled(this.removalEnabled && !this.removing && !this.cancellingAdd)
          .opacity(this.removalEnabled && !this.removing && !this.cancellingAdd ? 1 : 0.4)
          .onClick((): void => {
            if (this.removalEnabled && !this.removing && !this.cancellingAdd) {
              if (this.adding) this.onCancelAdd(identity); else this.onRemove(identity);
            }
          });
        }, (identity: string): string => identity);
      }.width('100%').height(48).alignItems(VerticalAlign.Center);
    // The design dock reserves 9vp on every side. The viewport-bottom owner
    // aligns this entire 68vp surface; this Stack centers the 48vp row inside
    // the painted capsule and must not apply a second bottom alignment.
    }.width(this.dockFrame().width).height(68).padding(9)
      .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme)).borderRadius(24)
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
      .clip(true)
      .shadow({ radius: this.appThemeScheme === 'night' ? 0 : 18, color: '#14000000', offsetY: 5 })
      .margin({ bottom: this.bottomInset() + 12 });
  }

  private contentFrame(): SurfaceHorizontalFrame {
    return resolveHorizontalFrame(this.liveWidth(), this.safeLeft(), this.safeRight(),
      new SurfaceWidthSpec(720, 20, 20, 'center'));
  }
  private dockFrame(): SurfaceHorizontalFrame {
    return resolveHorizontalFrame(this.liveWidth(), this.safeLeft(), this.safeRight(),
      new SurfaceWidthSpec(680, 30, 30, 'center'));
  }
  private liveWidth(): number {
    if (this.viewportWidth > 0) return this.viewportWidth;
    return this.readerWindowMetricsRevision < 0 ? 0 : ReaderWindowCoordinator.metrics().windowRect.width;
  }
  private safeLeft(): number { return readerVisualSafeLeft(ReaderWindowCoordinator.metrics()); }
  private safeRight(): number { return readerVisualSafeRight(ReaderWindowCoordinator.metrics()); }
  private topInset(): number { return readerInteractiveSafeTop(ReaderWindowCoordinator.metrics()); }
  private bottomInset(): number { return readerInteractiveSafeBottom(ReaderWindowCoordinator.metrics()); }
  private displayIntro(): string { return bookIntroText(this.book.intro); }
  private chapterEmptyMessage(): string {
    return this.loadingMessage.trim() || (!this.readingEnabled ? this.readingBlockedReason.trim() : '') || '暂无章节信息';
  }
  private isCurrentChapter(entry: LocalReadingTocEntry): boolean {
    return entry.navigable !== false && this.book.contentKind === 'manga' && this.book.mangaPosition?.chapterIndex === entry.index;
  }
  private chapterIndent(entry: LocalReadingTocEntry): number {
    if (this.book.contentKind === 'manga') return 10 + Math.min(4, Math.max(0, (entry.level ?? 1) - 1)) * 16;
    if (entry.navigable === false) return 10;
    if ((entry.level ?? 1) > 1) return 26;
    const priorGroup = this.toc.slice(0, this.toc.indexOf(entry)).some((row: LocalReadingTocEntry): boolean => row.navigable === false);
    return priorGroup ? 26 : 10;
  }
  private visibleToc(): LocalReadingTocEntry[] {
    if (this.book.contentKind === 'manga') {
      const visible = mangaDirectoryVisibleEntries(this.toc, mangaDirectoryPresentation(this.toc), this.collapsedGroups);
      return visible.slice(0, CHAPTER_PREVIEW_LIMIT);
    }
    let collapsed: boolean = false;
    return this.toc.slice(0, CHAPTER_PREVIEW_LIMIT).filter((entry: LocalReadingTocEntry): boolean => {
      if (entry.navigable === false) { collapsed = this.collapsedGroups.includes(entry.index); return true; }
      return !collapsed;
    });
  }
  private chapterIsGroup(entry: LocalReadingTocEntry): boolean {
    return mangaDirectoryIsGroup(this.toc, this.toc.findIndex((row: LocalReadingTocEntry): boolean => row.index === entry.index));
  }
  private onBookChanged(): void {
    const identity = `${this.book.sourceId}\u0000${this.book.bookId}`;
    if (identity === this.collapseIdentity) return;
    this.collapseIdentity = identity;
    this.collapsedGroups = [];
    this.collapseEntries = this.toc.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => ({
      index: entry.index, title: entry.title, level: entry.level, navigable: entry.navigable, downloadState: entry.downloadState }));
  }
  private onTocChanged(): void {
    const previous = this.collapseEntries;
    this.collapsedGroups = this.collapsedGroups.filter((index: number): boolean => {
      const before = previous.find((entry: LocalReadingTocEntry): boolean => entry.index === index);
      const after = this.toc.find((entry: LocalReadingTocEntry): boolean => entry.index === index);
      return before !== undefined && after !== undefined && this.chapterIsGroup(after) &&
        before.title === after.title && before.level === after.level && before.navigable === after.navigable;
    });
    this.collapseEntries = this.toc.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => ({
      index: entry.index, title: entry.title, level: entry.level, navigable: entry.navigable, downloadState: entry.downloadState }));
  }
  private readingActionLabel(): string {
    if (this.book.contentKind === 'manga') return this.book.mangaPosition === undefined ? '开始阅读' : '继续阅读';
    return this.inBookshelf ? '继续阅读' : '开始阅读';
  }
  private shelfActionLabel(): string {
    if (this.cancellingAdd) return '正在取消…';
    if (this.adding) return '取消加入';
    if (this.removing) return this.inBookshelf ? '正在移除…' : '正在加入…';
    return this.inBookshelf ? '移除书架' : '加入书架';
  }
  private hasCover(): boolean {
    return this.book.coverUrl !== undefined && /^(https?:\/\/|data:image\/(png|jpeg|bmp|webp);base64,|file:\/\/)/.test(this.book.coverUrl.trim());
  }
}
