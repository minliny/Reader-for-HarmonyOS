import { ReaderActionSheetAction, ReaderActionSheetContent } from './ReaderActionSheetContent';
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
  private actionToken(id: string, actionId: string): string {
    return `${id}::${actionId}`;
  }

  private actionId(token: string): string {
    const separator = token.lastIndexOf('::');
    return separator < 0 ? '' : token.slice(separator + 2);
  }

  private presentationFromToken(token: string): string {
    const separator = token.lastIndexOf('::');
    return separator < 0 ? '' : token.slice(0, separator);
  }

  private actionItems(id: string): ReaderActionSheetAction[] {
    const night = this.appThemeScheme === 'night';
    return [
      new ReaderActionSheetAction(this.actionToken(id, 'multi-select'), '多选', '', '', '', true,
        night ? $r('app.media.bookshelf_more_batch_theme_night') : $r('app.media.bookshelf_more_batch'), 'default', false),
      new ReaderActionSheetAction(this.actionToken(id, 'book-info'), '书籍信息', '', '', '', true,
        night ? $r('app.media.import_info_theme_night') : $r('app.media.import_info'), 'default', false),
      new ReaderActionSheetAction(this.actionToken(id, 'edit-group'), '编辑分组', '', '', '', true,
        night ? $r('app.media.source_group_folder_theme_night') : $r('app.media.source_group_folder'), 'default', false),
      new ReaderActionSheetAction(this.actionToken(id, 'remove'), '移除书架', '书架', '移除后可在书籍详情中重新加入', '', true,
        night ? $r('app.media.download_visual_trash_theme_night') : $r('app.media.download_visual_trash'), 'danger', false),
    ];
  }

  private dispatch(id: string, action: () => void): void {
    if (!this.mounted || id.length === 0 || id !== this.presentationId ||
      this.dispatchedId === id) return;
    try { if (!this.isCurrent(id)) return; } catch (_error) { return; }
    this.dispatchedId = id;
    action();
  }

  private dispatchToken(token: string): void {
    const id = this.presentationFromToken(token);
    const actionId = this.actionId(token);
    if (actionId === 'multi-select') this.dispatch(id, (): void => this.onMultiSelect());
    else if (actionId === 'book-info') this.dispatch(id, (): void => this.onBookInfo());
    else if (actionId === 'edit-group') this.dispatch(id, (): void => this.onEditGroup());
    else if (actionId === 'remove') this.dispatch(id, (): void => this.onRemoveFromBookshelf());
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Scroll() {
      Column() {
      ForEach([this.presentationId], (id: string): void => {
        ReaderActionSheetContent({
          variant: 'quick',
          actions: this.actionItems(id),
          onAction: (token: string): void => this.dispatchToken(token),
        });
      }, (id: string): string => `book-action-content:${id}`);
      }.width('100%');
      }.width('100%').height('100%').scrollBar(BarState.Auto);
    }.width('100%').height(Math.max(0, this.surfaceSpec().height - this.surfaceSpec().actionStart))
      .padding({ left: this.surfaceSpec().horizontalInset, right: this.surfaceSpec().horizontalInset })
      .position({ x: 0, y: this.surfaceSpec().actionStart });
  }
}
