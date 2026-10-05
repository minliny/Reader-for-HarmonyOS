import { readerAppColor } from './ReaderThemeRegistry';
import { SheetSurfaceSpec, resolveSheetSpec } from './ReaderSurfaceSpecs';

/** Finite per-book actions. The native host owns presentation identity;
 * this small keyed subtree captures it for every physical callback. */
@Component
export struct ReaderSheetActionList {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop presentationId: string = '';
  isCurrent: (presentationId: string) => boolean = (_id: string): boolean => false;
  onMultiSelect: () => void = (): void => {};
  onBookInfo: () => void = (): void => {};
  onEditGroup: () => void = (): void => {};
  onRemoveFromBookshelf: () => void = (): void => {};
  private mounted: boolean = false;
  private dispatchedId: string = '';

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }
  private surfaceSpec(): SheetSurfaceSpec { return resolveSheetSpec('bookshelf-book-action'); }
  private dispatch(id: string, action: () => void): void {
    if (!this.mounted || id.length === 0 || id !== this.presentationId ||
      this.dispatchedId === id) return;
    try { if (!this.isCurrent(id)) return; } catch (_error) { return; }
    this.dispatchedId = id;
    action();
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      ForEach([this.presentationId], (id: string): void => {
        this.actionSlot('多选', false, 0, id, (): void => this.onMultiSelect());
        this.actionSlot('书籍信息', false, 1, id, (): void => this.onBookInfo());
        this.actionSlot('编辑分组', false, 2, id, (): void => this.onEditGroup());
        this.actionSlot('移除书架', true, 3, id, (): void => this.onRemoveFromBookshelf());
      }, (id: string): string => `book-action:${id}`);
    }.width('100%').height(this.surfaceSpec().height);
  }

  @Builder
  private actionSlot(label: string, danger: boolean, index: number, id: string, action: () => void) {
    Row() {
      Row() {
        Text(label).fontFamily(this.surfaceSpec().actionLabelFontFamily)
          .fontWeight(this.surfaceSpec().actionLabelFontWeight).fontSize(this.surfaceSpec().actionLabelFontSize)
          .lineHeight(this.surfaceSpec().actionLabelLineHeight)
          .fontColor(readerAppColor(danger ? this.surfaceSpec().dangerTextRole : this.surfaceSpec().actionTextRole, this.appThemeScheme))
          .maxLines(1);
      }.layoutWeight(1).height(this.surfaceSpec().actionHeight)
        .padding({ left: this.surfaceSpec().actionPaddingLeft }).alignItems(VerticalAlign.Center)
        .backgroundColor(readerAppColor(danger ? this.surfaceSpec().dangerBackgroundRole : this.surfaceSpec().actionBackgroundRole, this.appThemeScheme))
        .borderRadius(this.surfaceSpec().actionBorderRadius).accessibilityText(label)
        .onClick((): void => this.dispatch(id, action));
    }.width('100%').height(this.surfaceSpec().actionHeight)
      .padding({ left: this.surfaceSpec().horizontalInset, right: this.surfaceSpec().horizontalInset })
      .position({ x: 0, y: this.surfaceSpec().actionY(index) });
  }
}
