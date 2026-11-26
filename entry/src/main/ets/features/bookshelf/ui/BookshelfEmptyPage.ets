import { readerMainViewport } from '../../shell/MainNavigationSpec';
/**
 * Empty shelf, rebuilt 2026-08-06 against live Figma node `State/BookshelfEmpty`
 * (`286:31`, icon `Icon/Bookshelf` `271:96`). The 352×350 card replaces the old
 * `574:198` reference geometry (which had swapped action roles, blue icon frame,
 * pills, and wrong card size). The top bar shares the populated shelf's text
 * title and actions. Empty-state text uses ReaderNotoSansSC per Figma.
 */
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { bookshelfHeaderSpec } from '../../../ui/foundation/ReaderHeaderSpecs';
import { readerFloatingTabContentInset } from '../../../ui/layout/ReaderFloatingBarMetrics';
import { SurfaceHorizontalFrame } from '../../../ui/layout/SurfaceHorizontalGeometry';
import { ReaderPageGeometryInput, resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import {
  TOK_CONTENT_MAX_W_PHONE,
  TOK_CONTENT_RAIL_W_TABLET,
  TOK_SCREEN_INSET,
  TOK_SPACE_XS,
  TOK_SPACE_MD,
} from '../../../ui/foundation/ReaderTokens';
import {
  readerMainNavigationMode,
  readerMainRailBottomInset,
  readerMainRailContentLeft,
  readerMainRailContentRight,
} from '../../shell/MainNavigationSpec';

import { registerReaderShelfFonts } from '../../../ui/foundation/ReaderFonts';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { BookshelfSectionHeader } from './BookshelfSectionHeader';
import { bookshelfFileDropHint } from './BookshelfPage';
import { bookshelfFileDropTypes, type BookshelfFileDrop } from '../application/BookshelfFileDrop';
import { dispatchBookshelfFileDrop, showBookshelfFileDropFeedback } from './BookshelfFileDropEvent';

@Component
export struct BookshelfEmptyPage {
  @StorageLink('readerMainViewportRevision') private mainViewportRevision: number = 0;
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerWideNavigationRail') private wideNavigationRail: boolean = false;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  /** Presented header bottom (top + measured height), owned by the route. */
  @Prop headerBottom: number = bookshelfHeaderSpec().frameHeight;
  @Prop measuredFooterHeight: number = 0;
  @Prop @Watch('resetFileDropHover') fileDropEnabled: boolean = false;
  @Prop @Watch('resetFileDropHover') navigationGeneration: number = 0;
  @Prop reduceMotion: boolean = false;
  @State private fileDropHover: boolean = false;
  isCurrentShelfInput: (navigation: number) => boolean = (_navigation: number): boolean => false;
  onFilesDropped: (drop: BookshelfFileDrop, navigation: number) => boolean =
    (_drop: BookshelfFileDrop, _navigation: number): boolean => false;
  private readonly importFocusId: string = 'reader-bookshelf-import-entry';
  onImportRequested: (focusTarget: string) => void = (_focusTarget: string): void => {};
  onSearchRequested: () => void = (): void => {};

  aboutToAppear(): void {
    registerReaderShelfFonts(this.getUIContext().getFont());
  }

  aboutToDisappear(): void { this.resetFileDropHover(); }

  private resetFileDropHover(): void { this.fileDropHover = false; }

  private fileDropCurrent(): boolean {
    return this.fileDropEnabled && this.isCurrentShelfInput(this.navigationGeneration);
  }

  private onFileDrag(event: DragEvent): void {
    this.fileDropHover = showBookshelfFileDropFeedback(event, this.fileDropCurrent());
  }

  private onFileDrop(event: DragEvent): void {
    this.resetFileDropHover();
    dispatchBookshelfFileDrop(event, this.fileDropCurrent(), this.reduceMotion,
      (drop: BookshelfFileDrop): boolean => this.onFilesDropped(drop, this.navigationGeneration));
  }

  @Builder
  private fileDropOverlay() {
    if (this.fileDropHover && this.fileDropEnabled) {
      bookshelfFileDropHint(this.headerBottom, this.appThemeScheme);
    }
  }

  build() {
    Scroll() {
      Column({ space: 9 }) {
        this.sectionHeader();
        ReaderPageState({ title: '书架还是空的', message: '导入本地书籍或通过搜索加入书架。',
          titleTextId: 'reader-bookshelf-empty-title',
          actionLabel: '导入本地书籍', actionFocusId: this.importFocusId,
          onAction: (): void => this.onImportRequested(this.importFocusId),
          secondaryActionLabel: '搜索书籍', secondaryActionFocusId: 'reader-bookshelf-empty-search-entry',
          onSecondaryAction: (): void => this.onSearchRequested() })
          .width(this.emptyCardWidth());
      }
      .width(this.contentFrame().width)
      .alignItems(HorizontalAlign.Center)
      .padding({ top: this.headerBottom + TOK_SPACE_XS, bottom: this.bottomContentInset() });
    }
    .id('reader-bookshelf-empty-scroll')
    .width('100%')
    .height('100%')
    .align(Alignment.Top)
    .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
    .allowDrop(this.fileDropEnabled ? bookshelfFileDropTypes() : null)
    .onDragEnter((event: DragEvent): void => this.onFileDrag(event))
    .onDragMove((event: DragEvent): void => this.onFileDrag(event))
    .onDragLeave((): void => this.resetFileDropHover())
    .onDrop((event: DragEvent): void => this.onFileDrop(event))
    .overlay((): void => { this.fileDropOverlay(); }, { align: Alignment.Top })
    .scrollBar(BarState.Off);
  }

  private bottomContentInset(): number {
    if (this.readerWindowMetricsRevision < 0) return TOK_SPACE_MD;
    return this.railActive() ? readerMainRailBottomInset() :
      readerFloatingTabContentInset(ReaderWindowCoordinator.metrics(), this.measuredFooterHeight);
  }

  private railActive(): boolean {
    return readerMainNavigationMode(this.wideNavigationRail, this.mainViewportRevision, this.readerWindowMetricsRevision) === 'rail';
  }

  private emptyCardWidth(): number {
    return Math.min(TOK_CONTENT_MAX_W_PHONE, this.contentFrame().width);
  }

  @Builder
  private sectionHeader() {
    BookshelfSectionHeader({
      contentWidth: this.contentFrame().width,
      actionsEnabled: false,
      actionsOpacity: 0.42,
    });
  }

  private contentFrame(): SurfaceHorizontalFrame {
    // Figma supplies only the Phone `State/BookshelfEmpty` card; the card keeps
    // its 352 width. In rail mode the surrounding content column adopts the
    // shelf rail frame and the card stays centered inside it.
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const containerWidth = readerMainViewport(this.mainViewportRevision).width;
    if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const rail = this.railActive();
    const input = new ReaderPageGeometryInput(ReaderWindowCoordinator.metrics());
    input.viewportWidth = containerWidth;
    input.contentMaxWidth = rail ? TOK_CONTENT_RAIL_W_TABLET : TOK_CONTENT_MAX_W_PHONE;
    input.contentLeftGap = rail ? readerMainRailContentLeft() : TOK_SCREEN_INSET;
    input.contentRightGap = rail ? readerMainRailContentRight() : TOK_SCREEN_INSET;
    return resolveReaderPageGeometry(input).content.frame;
  }
}
