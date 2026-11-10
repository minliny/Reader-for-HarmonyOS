import { ReaderActionMenuSurface, ReaderMenuActionView } from '../../../ui/surfaces/ReaderActionMenuSurface';
import { SheetSurfaceSpec, resolveSheetSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { readerActionIcon } from '../../../ui/foundation/ReaderActionIconResources';

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

  private actionItems(id: string): ReaderMenuActionView[] {
    return [
      new ReaderMenuActionView(this.actionToken(id, 'multi-select'), '多选', true,
        readerActionIcon('check', this.appThemeScheme)),
      new ReaderMenuActionView(this.actionToken(id, 'book-info'), '书籍信息', true,
        readerActionIcon('info', this.appThemeScheme)),
      new ReaderMenuActionView(this.actionToken(id, 'edit-group'), '编辑分组', true,
        readerActionIcon('folder', this.appThemeScheme)),
      new ReaderMenuActionView(this.actionToken(id, 'remove'), '移除书架', true,
        readerActionIcon('trash', this.appThemeScheme), '移除书架', '', '', '', 'danger'),
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
    Column() {
      ForEach([this.presentationId], (id: string): void => {
        ReaderActionMenuSurface({
          variant: 'bookshelf',
          actions: this.actionItems(id),
          scheme: 'auto',
          onAction: (token: string): void => this.dispatchToken(token),
        });
      }, (id: string): string => `book-action-content:${id}`);
    }.width('100%')
      .padding({ left: this.surfaceSpec().horizontalInset, right: this.surfaceSpec().horizontalInset });
  }
}
