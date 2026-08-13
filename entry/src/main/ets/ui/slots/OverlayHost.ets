// OverlayHost — shell slot for generic transient overlays (dropdown / sheet /
// toast / source-switch). Reader overlays are routes now (Batch 1) — they do
// NOT come through here; they render via ViewStateRenderer(stack) as the
// reader route's body. Reads `overlay` from AppStorage. Appear/disappear uses
// the motion-duration overlay token (centralized here, never animateTo in
// pages). Admitted overlay visuals come exclusively from the Reader-UI
// revision-bound token contract; there is no local fallback overlay skin.
import { MotionDurationTokens } from '../../contract/generated/MotionTokens';
import { ReaderUiVisualTokens } from '../../contract/reader_ui/VisualAdmission';
import { ReaderUiVisualAdmission } from '../../contract/reader_ui/VisualAdmission';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { BookshelfSelectionTarget, CoreBookshelfBook, LocalImportDialogResult } from '../store/ReaderUiState';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { BookCover } from '../components/BookshelfComponents';

interface BookActionEntry {
  action: 'multi-select' | 'book-info' | 'remove';
  title: string;
  destructive: boolean;
}

@Component
export struct OverlayHost {
  @StorageProp('reader.overlay') overlayKind: string = '';
  @StorageProp(ViewportAdapter.K_CLASS) viewportClass: string = 'phone';
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp('reader.bookshelfBooks') bookshelfBooks: CoreBookshelfBook[] = [];
  @StorageProp('reader.pendingBookshelfActionSourceId') pendingBookshelfActionSourceId: string = '';
  @StorageProp('reader.pendingBookshelfActionBookId') pendingBookshelfActionBookId: string = '';
  @StorageProp('reader.pendingBookshelfRemovalSourceId') pendingBookshelfRemovalSourceId: string = '';
  @StorageProp('reader.pendingBookshelfRemovalBookId') pendingBookshelfRemovalBookId: string = '';
  @StorageProp('reader.bookshelfSelectedTargets') bookshelfSelectedTargets: BookshelfSelectionTarget[] = [];
  @StorageProp('reader.bookshelfRemovalDialogPhase') bookshelfRemovalDialogPhase: string = 'idle';
  @StorageProp('reader.bookshelfRemovalScope') bookshelfRemovalScope: string = 'single';
  @StorageProp('reader.localImportDialogPhase') localImportDialogPhase: string = 'idle';
  @StorageProp('reader.localImportDialogResults') localImportDialogResults: LocalImportDialogResult[] = [];
  private bookActions: BookActionEntry[] = [
    { action: 'multi-select', title: '多选', destructive: false },
    { action: 'book-info', title: '书籍信息', destructive: false },
    { action: 'remove', title: '移除书架', destructive: true },
  ];

  build() {
    // sort-filter 由 BookshelfShelfSection 内部渲染筛选浮层（契约 fixture view-state 设计），不在此全局浮层显示
    if (this.overlayKind === '' || this.overlayKind === 'sort-filter') {
      Column().width(0).height(0)
    } else if (!ReaderUiVisualAdmission.isOverlayAdmitted(this.overlayKind)) {
      // The Reader-UI generated admission table is the only authority.
      // `isOverlayAdmitted` returns true ONLY for `implementation-ready`
      // overlays; `candidate-backport` overlays (source bound but not yet
      // delivered) fail closed here too. Do not turn an unbound or
      // not-yet-delivered overlay into a native generic card or a duplicate
      // Figma-specific policy; it remains visually inert until Reader-UI marks
      // the family implementation-ready.
      Column().width(0).height(0)
    } else if (this.overlayKind === 'bookshelf-multiselect') {
      this.renderBookshelfMultiSelect()
    } else if (this.overlayKind === 'local-import') {
      this.renderLocalImportDialog()
    } else {
      Stack() {
        if (this.overlayKind === 'book-action') {
          this.renderBookActionSheet()
        } else if (this.overlayKind === 'dialog') {
          this.renderBookshelfRemovalConfirm()
        }
      }
      .width('100%').height('100%')
      .transition(TransitionEffect.OPACITY.animation({ duration: MotionDurationTokens.overlay, curve: Curve.EaseInOut }))
    }
  }

  @Builder renderBookActionSheet() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
        Column()
          .width(42)
          .height(4)
          .backgroundColor(ReaderUiVisualTokens.actionSheetHandle)
          .borderRadius(2)
          .margin({ top: 9, bottom: 21 })
        Text('书籍操作')
          .fontSize(17)
          .fontWeight(700)
          .fontFamily(ReaderUiVisualTokens.actionSheetControlFontFamily)
          .fontColor(ReaderUiVisualTokens.bookshelfInk)
          .width('100%')
          .margin({ bottom: 16 })
        ForEach(this.bookActions, (entry: BookActionEntry, idx: number) => {
          Text(entry.title)
            .fontSize(13)
            .fontWeight(700)
            .fontFamily(ReaderUiVisualTokens.actionSheetControlFontFamily)
            .fontColor(entry.destructive
              ? ReaderUiVisualTokens.actionDangerLabel
              : ReaderUiVisualTokens.bookshelfActionPrimary)
            .textAlign(TextAlign.Start)
          .width('100%')
          .height(40)
          .padding({ left: 12, right: 12 })
          .borderRadius(12)
          .backgroundColor(entry.destructive
            ? ReaderUiVisualTokens.actionDangerSoft
            : ReaderUiVisualTokens.actionPrimarySoft)
          .margin({ bottom: idx === this.bookActions.length - 1 ? 0 : 6 })
          .onClick(() => this.openAction(entry))
        }, (entry: BookActionEntry, idx: number) => `${entry.title}-${idx}`)
      }
      .width(this.viewportClass === 'tablet' ? 720 : 366)
      .height(224)
      .padding({ left: 14, right: 14 })
      .backgroundColor(ReaderUiVisualTokens.actionSheetSurface)
      .border({ width: 1, color: ReaderUiVisualTokens.actionSheetBorder })
      .borderRadius({ topLeft: 24, topRight: 24 })
      .shadow({ radius: 46, color: ReaderUiVisualTokens.actionSheetShadow, offsetX: 0, offsetY: 18 })
    }
    .width('100%')
    .height('100%')
  }

  private openAction(entry: BookActionEntry): void {
    const sourceId = this.pendingBookshelfActionSourceId;
    const bookId = this.pendingBookshelfActionBookId;
    if (sourceId.length === 0 || bookId.length === 0) return;
    if (entry.action === 'multi-select') {
      ReaderUiStore.dispatch({ type: 'book-action', bookAction: 'multi-select', sourceId: sourceId, bookId: bookId });
      return;
    }
    if (entry.action === 'book-info') {
      ReaderUiStore.openBookshelfBookDetail(bookId, sourceId);
      return;
    }
    ReaderUiStore.dispatch({ type: 'book-action', bookAction: 'delete', sourceId: sourceId, bookId: bookId });
  }

  private isSelected(book: CoreBookshelfBook): boolean {
    for (let index = 0; index < this.bookshelfSelectedTargets.length; index += 1) {
      const selected = this.bookshelfSelectedTargets[index];
      if (selected.sourceId === book.sourceId && selected.bookId === book.bookId) return true;
    }
    return false;
  }

  private allBooksSelected(): boolean {
    return this.bookshelfBooks.length > 0 && this.bookshelfSelectedTargets.length === this.bookshelfBooks.length;
  }

  private selectedBookCountLabel(): string {
    return `已选择 ${this.bookshelfSelectedTargets.length} 本`;
  }

  @Builder renderBookshelfMultiSelectCard(book: CoreBookshelfBook) {
    Column() {
      Stack({ alignContent: Alignment.BottomEnd }) {
        BookCover({
          sourceId: book.sourceId,
          coverKey: '',
          coverUrl: book.coverUrl,
        })
        Stack({ alignContent: Alignment.Center }) {
          if (this.isSelected(book)) {
            Text('✓')
              .fontSize(14)
              .fontWeight(700)
              .fontFamily(ReaderUiVisualTokens.localImportControlFontFamily)
              .fontColor(ReaderUiVisualTokens.multiSelectCheckboxLabel)
          }
        }
        .width(22)
        .height(22)
        .borderRadius(11)
        .backgroundColor(this.isSelected(book)
          ? ReaderUiVisualTokens.multiSelectSelectedFill
          : ReaderUiVisualTokens.multiSelectUnselectedSurface)
        .border({ width: this.isSelected(book) ? 0 : 1, color: ReaderUiVisualTokens.multiSelectCheckboxBorder })
        .shadow({ radius: 4, color: ReaderUiVisualTokens.multiSelectCheckboxShadow, offsetX: 0, offsetY: 2 })
        .margin({ right: 4, bottom: 4 })
      }
      .width('100%')
      Text(book.title)
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ReaderUiVisualTokens.bookshelfInk)
        .fontFamily(ReaderUiVisualTokens.bookshelfBookTitleFontFamily)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 6 })
      Text(book.author)
        .fontSize(12)
        .fontFamily(ReaderUiVisualTokens.bookshelfControlFontFamily)
        .fontColor(ReaderUiVisualTokens.bookshelfMuted)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .alignItems(HorizontalAlign.Start)
    .onClick(() => {
      ReaderUiStore.dispatch({
        type: 'bookshelf-multiselect-toggle', sourceId: book.sourceId, bookId: book.bookId,
      });
    })
  }

  @Builder renderBookshelfMultiSelect() {
    Column() {
      Row() {
        Text('取消')
          .fontSize(13)
          .fontWeight(700)
          .fontFamily(ReaderUiVisualTokens.bookshelfControlFontFamily)
          .fontColor(ReaderUiVisualTokens.bookshelfActionPrimary)
          .width(44)
          .height(44)
          .lineHeight(44)
          .textAlign(TextAlign.Start)
          .onClick(() => ReaderUiStore.dispatch({ type: 'bookshelf-multiselect-exit' }))
        Text(this.selectedBookCountLabel())
          .fontSize(24)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.bookshelfInk)
          .fontFamily(ReaderUiVisualTokens.multiSelectTitleFontFamily)
          .layoutWeight(1)
          .height(44)
          .lineHeight(44)
          .textAlign(TextAlign.Center)
        Text(this.allBooksSelected() ? '取消全选' : '全选')
          .fontSize(13)
          .fontWeight(700)
          .fontFamily(ReaderUiVisualTokens.bookshelfControlFontFamily)
          .fontColor(ReaderUiVisualTokens.bookshelfActionPrimary)
          .width(this.allBooksSelected() ? 60 : 44)
          .height(44)
          .lineHeight(44)
          .textAlign(TextAlign.End)
          .onClick(() => {
            ReaderUiStore.dispatch({
              type: this.allBooksSelected() ? 'bookshelf-multiselect-clear-all' : 'bookshelf-multiselect-select-all',
            });
          })
      }
      .height(56)
      .width('100%')
      .padding({ left: 20, right: 20, top: 6, bottom: 6 })
      .alignItems(VerticalAlign.Center)

      Scroll() {
        Grid() {
          ForEach(this.bookshelfBooks, (book: CoreBookshelfBook, index: number) => {
            GridItem() {
              this.renderBookshelfMultiSelectCard(book)
            }
          }, (book: CoreBookshelfBook, index: number) => `${book.sourceId}-${book.bookId}-${index}`)
        }
        .columnsTemplate('1fr 1fr 1fr')
        .columnsGap(30)
        .rowsGap(12)
        .width(this.viewportClass === 'tablet' ? 622 : '100%')
      }
      .layoutWeight(1)
      .width('100%')
      .align(Alignment.Top)
      .padding({ left: this.viewportClass === 'tablet' ? 69 : 19, right: this.viewportClass === 'tablet' ? 69 : 19, top: 12, bottom: 20 })

      Column() {
        Image($r('app.media.ui_icon_trash_dark'))
          .width(22)
          .height(22)
        Text('移除书架')
          .fontSize(11)
          .fontWeight(700)
          .fontFamily(ReaderUiVisualTokens.localImportControlFontFamily)
          .fontColor(ReaderUiVisualTokens.actionDangerLabel)
          .margin({ top: 6 })
      }
      .width('100%')
      .height(82)
      .justifyContent(FlexAlign.Center)
      .backgroundColor(ReaderUiVisualTokens.actionSheetSurface)
      .border({ width: { top: 1 }, color: ReaderUiVisualTokens.multiSelectBorder })
      .onClick(() => {
        if (this.bookshelfSelectedTargets.length === 0) return;
        ReaderUiStore.dispatch({ type: 'bookshelf-multiselect-remove-request' });
      })
    }
    .width('100%')
    .height('100%')
    // This overlay expands with the shell into the system status-bar region.
    // The Figma canvas records that region, while ArkUI renders the real status
    // bar above us; reserve the measured inset so the actual header begins
    // below it rather than being clipped by the platform bar.
    .padding({ top: this.safeAreaTop })
    .backgroundColor(ReaderUiVisualTokens.multiSelectSurface)
  }

  private importedBookCount(): number {
    let count = 0;
    for (let index = 0; index < this.localImportDialogResults.length; index += 1) {
      if (this.localImportDialogResults[index].status === 'success') count += 1;
    }
    return count;
  }

  private failedBookCount(): number {
    return this.localImportDialogResults.length - this.importedBookCount();
  }

  private importResultSummary(): string {
    return `${this.importedBookCount()} 本已导入 · ${this.failedBookCount()} 本失败`;
  }

  @Builder renderLocalImportSpinner() {
    Stack({ alignContent: Alignment.Center }) {
      Column()
        .width(56)
        .height(56)
        .backgroundColor(ReaderUiVisualTokens.localImportSpinnerHalo)
        .border({ width: 1, color: ReaderUiVisualTokens.localImportSpinnerTrack })
        .borderRadius(28)
      LoadingProgress()
        .color(ReaderUiVisualTokens.bookshelfActionPrimary)
        .width(32)
        .height(32)
    }
    .width(56)
    .height(56)
  }

  @Builder renderLocalImportLoading() {
    Column() {
      Column() {
        this.renderLocalImportSpinner()
      }
        .margin({ top: 35, bottom: 20 })
      Text('正在导入')
        .fontSize(14)
        .fontWeight(600)
        .fontFamily(ReaderUiVisualTokens.localImportControlFontFamily)
        .fontColor(ReaderUiVisualTokens.bookshelfInk)
        .margin({ bottom: 8 })
      Text('请稍候')
        .fontSize(11)
        .fontFamily(ReaderUiVisualTokens.localImportControlFontFamily)
        .fontColor(ReaderUiVisualTokens.bookshelfMuted)
    }
    .width(350)
    .height(228)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(ReaderUiVisualTokens.localImportDialogSurface)
    .borderRadius(20)
    .shadow({ radius: 50, color: ReaderUiVisualTokens.localImportDialogShadow, offsetX: 0, offsetY: 25 })
  }

  @Builder renderLocalImportResultRow(result: LocalImportDialogResult) {
    Row() {
      Column() {
        Image($r('app.media.reader_icon_file'))
          .width(16)
          .height(16)
      }
      .width(32)
      .height(32)
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .borderRadius(8)
      .backgroundColor(ReaderUiVisualTokens.localImportInsetSurface)
      Column() {
        Text(result.fileName)
          .fontSize(12)
          .fontWeight(600)
          .fontFamily(ReaderUiVisualTokens.localImportControlFontFamily)
          .fontColor(ReaderUiVisualTokens.bookshelfInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(result.status === 'success' ? '成功' : '失败')
          .fontSize(10)
          .fontWeight(700)
          .fontFamily(ReaderUiVisualTokens.localImportControlFontFamily)
          .fontColor(ReaderUiVisualTokens.bookshelfActionLabel)
          .height(19)
          .padding({ left: 6, right: 6, top: 2, bottom: 2 })
          .borderRadius(4)
          .backgroundColor(result.status === 'success'
            ? ReaderUiVisualTokens.bookshelfActionPrimary
            : ReaderUiVisualTokens.localImportFailureBadge)
          .margin({ top: 3 })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      .margin({ left: 12 })
      Image(result.status === 'success' ? $r('app.media.ui_icon_check_primary') : $r('app.media.ui_icon_info_dark'))
        .width(17)
        .height(17)
    }
    .width('100%')
    .height(61)
    .padding({ left: 16, right: 16, top: 10, bottom: 10 })
    .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.localImportBorder })
  }

  @Builder renderLocalImportResult() {
    Column() {
      Text('导入结果')
        .fontSize(18)
        .fontWeight(700)
        .fontFamily(ReaderUiVisualTokens.localImportTitleFontFamily)
        .fontColor(ReaderUiVisualTokens.bookshelfInk)
        .width('100%')
        .height(62)
        .padding({ left: 20, top: 20, bottom: 16 })
        .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.localImportBorder })
      Row() {
        Column() {
          Image(this.failedBookCount() > 0 ? $r('app.media.ui_icon_info_dark') : $r('app.media.ui_icon_check_primary'))
            .width(18)
            .height(18)
        }
        .width(36)
        .height(36)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .borderRadius(18)
        .backgroundColor(ReaderUiVisualTokens.localImportSummaryWarningSurface)
        Column() {
          Text('导入完成')
            .fontSize(13)
            .fontWeight(700)
            .fontFamily(ReaderUiVisualTokens.localImportControlFontFamily)
            .fontColor(ReaderUiVisualTokens.bookshelfInk)
          Text(this.importResultSummary())
            .fontSize(11)
            .fontFamily(ReaderUiVisualTokens.localImportControlFontFamily)
            .fontColor(ReaderUiVisualTokens.bookshelfMuted)
            .margin({ top: 2 })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        .margin({ left: 12 })
      }
      .width(318)
      .height(52)
      .padding({ left: 16, right: 16, top: 8, bottom: 8 })
      .backgroundColor(ReaderUiVisualTokens.localImportInsetSurface)
      .border({ width: 1, color: ReaderUiVisualTokens.localImportBorder })
      .borderRadius(12)
      .margin({ left: 16, right: 16, top: 16, bottom: 12 })
      Scroll() {
        Column() {
          ForEach(this.localImportDialogResults, (result: LocalImportDialogResult, index: number) => {
            this.renderLocalImportResultRow(result)
          }, (result: LocalImportDialogResult, index: number) => result.id ?? `${result.fileName}-${index}`)
        }
        .width('100%')
      }
      .width(318)
      .height(410)
      .border({ width: 1, color: ReaderUiVisualTokens.localImportBorder })
      .borderRadius(12)
      .margin({ left: 16, right: 16 })
      Row() {
        Image($r('app.media.ui_icon_check_white'))
          .width(14)
          .height(14)
        Text('完成')
          .fontSize(13)
          .fontWeight(800)
          .fontFamily(ReaderUiVisualTokens.localImportControlFontFamily)
          .fontColor(ReaderUiVisualTokens.bookshelfActionLabel)
          .margin({ left: 8 })
      }
      .width(318)
      .height(40)
      .justifyContent(FlexAlign.Center)
      .backgroundColor(ReaderUiVisualTokens.bookshelfActionPrimary)
      .borderRadius(20)
      .margin({ left: 16, right: 16, top: 16, bottom: 20 })
      .onClick(() => ReaderUiStore.dispatch({ type: 'local-import-dialog-confirm' }))
    }
    .width(350)
    .height(636)
    .backgroundColor(ReaderUiVisualTokens.localImportDialogSurface)
    .borderRadius(20)
    .shadow({ radius: 50, color: ReaderUiVisualTokens.localImportDialogShadow, offsetX: 0, offsetY: 25 })
  }

  @Builder renderLocalImportDialog() {
    Stack({ alignContent: Alignment.Center }) {
      Column()
        .width('100%')
        .height('100%')
        .backgroundColor(ReaderUiVisualTokens.localImportScrim)
      if (this.localImportDialogPhase === 'loading') {
        this.renderLocalImportLoading()
      } else if (this.localImportDialogPhase === 'result') {
        this.renderLocalImportResult()
      }
    }
    .width('100%')
    .height('100%')
  }

  private pendingBookshelfBook(): CoreBookshelfBook | null {
    const sourceId = this.pendingBookshelfRemovalSourceId;
    const bookId = this.pendingBookshelfRemovalBookId;
    if (sourceId.length === 0 || bookId.length === 0) return null;
    for (let i = 0; i < this.bookshelfBooks.length; i++) {
      const book = this.bookshelfBooks[i];
      if (book.sourceId === sourceId && book.bookId === bookId) return book;
    }
    return null;
  }

  private removalTitle(): string {
    if (this.bookshelfRemovalDialogPhase === 'loading') return '正在移除';
    if (this.bookshelfRemovalDialogPhase === 'failed') return '移除失败';
    return '移除书架';
  }

  private removalBody(): string {
    if (this.bookshelfRemovalDialogPhase === 'loading') return '正在更新书架，请稍候。';
    if (this.bookshelfRemovalDialogPhase === 'failed') return '暂时无法移除，请检查网络后重试。';
    if (this.bookshelfRemovalScope === 'batch') return '确认移除已选择的书籍？阅读记录将保留。';
    const book = this.pendingBookshelfBook();
    return book === null
      ? '确认移除这本书？阅读记录将保留。'
      : `确认将《${book.title}》移出书架？阅读记录将保留。`;
  }

  private removalConfirmLabel(): string {
    if (this.bookshelfRemovalDialogPhase === 'loading') return '移除中…';
    if (this.bookshelfRemovalDialogPhase === 'failed') return '重试';
    return '移除';
  }

  private confirmBookshelfRemoval(): void {
    if (this.bookshelfRemovalDialogPhase === 'loading') return;
    if (this.bookshelfRemovalScope === 'batch') {
      ReaderUiStore.dispatch({ type: 'bookshelf-remove-confirm' });
      return;
    }
    const target = this.pendingBookshelfBook();
    if (target === null) return;
    ReaderUiStore.dispatch({
      type: 'bookshelf-remove-confirm', sourceId: target.sourceId, bookId: target.bookId,
    });
  }

  private dismiss(): void {
    if (this.overlayKind === 'dialog') {
      ReaderUiStore.dispatch({ type: 'bookshelf-remove-cancel' });
      return;
    }
    ReaderUiStore.dispatch({ type: 'set-overlay', overlay: '' });
  }

  @Builder renderBookshelfRemovalConfirm() {
    Stack({ alignContent: Alignment.Center }) {
      Column() {
        Text(this.removalTitle())
          .fontSize(17)
          .fontWeight(700)
          .fontFamily(ReaderUiVisualTokens.actionSheetControlFontFamily)
          .fontColor(ReaderUiVisualTokens.bookshelfInk)
          .height(20)
          .width('100%')
          .margin({ bottom: 16 })
        Text(this.removalBody())
          .fontSize(13)
          .lineHeight(18)
          .fontFamily(ReaderUiVisualTokens.actionSheetControlFontFamily)
          .fontColor(ReaderUiVisualTokens.bookshelfMuted)
          .height(50)
          .width('100%')
          .maxLines(3)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Row({ space: 10 }) {
          Text('取消')
            .fontSize(13)
            .fontWeight(700)
            .fontFamily(ReaderUiVisualTokens.actionSheetControlFontFamily)
            .fontColor(ReaderUiVisualTokens.bookshelfInk)
            .width(130)
            .height(38)
            .textAlign(TextAlign.Center)
            .borderRadius(12)
            .backgroundColor(ReaderUiVisualTokens.actionSheetDialogCancelSurface)
            .onClick(() => {
              if (this.bookshelfRemovalDialogPhase !== 'loading') this.dismiss();
            })
          Text(this.removalConfirmLabel())
            .fontSize(13)
            .fontWeight(700)
            .fontFamily(ReaderUiVisualTokens.actionSheetControlFontFamily)
            .fontColor(ReaderUiVisualTokens.actionSheetSurface)
            .width(130)
            .height(38)
            .textAlign(TextAlign.Center)
            .borderRadius(12)
            .backgroundColor(ReaderUiVisualTokens.actionSheetDialogDanger)
            .onClick(() => this.confirmBookshelfRemoval())
        }
        .width('100%')
        .height(38)
        .margin({ top: 30 })
      }
      .width(306)
      .height(190)
      .padding(18)
      .backgroundColor(ReaderUiVisualTokens.actionSheetSurface)
      .border({ width: 1, color: ReaderUiVisualTokens.actionSheetBorder })
      .borderRadius(12)
      .shadow({ radius: 46, color: ReaderUiVisualTokens.actionSheetShadow, offsetX: 0, offsetY: 18 })
    }
    .width('100%')
    .height('100%')
  }

}
