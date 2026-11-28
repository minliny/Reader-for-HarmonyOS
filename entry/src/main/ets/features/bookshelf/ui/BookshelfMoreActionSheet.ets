import { ReaderBoundedSurface } from '../../../ui/surfaces/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../../../ui/surfaces/ReaderBoundedSurfaceHeader';
import { ReaderActionMenuSurface, ReaderMenuActionView } from '../../../ui/surfaces/ReaderActionMenuSurface';
import { SheetSurfaceSpec, resolveSheetSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { readerActionIcon } from '../../../ui/foundation/ReaderActionIconResources';

/** Content and presentation token for the bookshelf More actions. */
@Component
export struct BookshelfMoreActionSheet {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop presentationId: string = '';
  @Prop canBatchManage: boolean = false;
  @Prop canCheckUpdates: boolean = false;
  @Prop updateRunning: boolean = false;
  @Prop backgroundUpdateRunning: boolean = false;
  isCurrent: (presentationId: string) => boolean = (_id: string): boolean => false;
  onBatchManage: () => void = (): void => {};
  onLocalImport: () => void = (): void => {};
  onCheckUpdates: () => void = (): void => {};
  onDownloadsRequested: () => void = (): void => {};
  onBookshelfSettings: () => void = (): void => {};
  onBookshelfManagement: () => void = (): void => {};
  private mounted: boolean = false;
  private dispatchedId: string = '';

  aboutToAppear(): void { this.mounted = true; this.dispatchedId = ''; }
  aboutToDisappear(): void { this.mounted = false; }

  private surfaceSpec(): SheetSurfaceSpec { return resolveSheetSpec('bookshelf-book-action'); }
  private updatesRunning(): boolean { return this.updateRunning || this.backgroundUpdateRunning; }
  private actionToken(actionId: string): string { return `${this.presentationId}::${actionId}`; }

  private actionItems(): ReaderMenuActionView[] {
    const updateBusy = this.updatesRunning();
    const updateLabel = updateBusy ? '检查更新中' : '检查更新';
    return [
      new ReaderMenuActionView(this.actionToken('batch'), '批量管理', this.canBatchManage,
        readerActionIcon('check', this.appThemeScheme)),
      new ReaderMenuActionView(this.actionToken('import'), '本地导入', true,
        readerActionIcon('import', this.appThemeScheme)),
      new ReaderMenuActionView(this.actionToken('update'), updateLabel, this.canCheckUpdates && !updateBusy,
        readerActionIcon('refresh', this.appThemeScheme), updateLabel, '', !this.canCheckUpdates && !updateBusy ? '没有在线书籍' : ''),
      new ReaderMenuActionView(this.actionToken('downloads'), '下载管理', true,
        readerActionIcon('download', this.appThemeScheme)),
      new ReaderMenuActionView(this.actionToken('settings'), '书架设置', true,
        readerActionIcon('settings', this.appThemeScheme)),
      new ReaderMenuActionView(this.actionToken('management'), '书架数据管理', true,
        readerActionIcon('folder', this.appThemeScheme)),
    ];
  }

  build() {
    ReaderBoundedSurface({ specId: 'bookshelf-book-action',
      header: (): void => { this.sheetHeader(); },
      actions: (): void => { this.sheetActions(); },
    });
  }

  @Builder
  private sheetHeader() {
    ReaderBoundedSurfaceHeader({ specId: 'bookshelf-book-action', title: '书架操作' });
  }

  @Builder
  private sheetActions() {
    Column() {
      ReaderActionMenuSurface({ variant: 'bookshelf', actions: this.actionItems(), scheme: 'auto',
        actionIdPrefix: 'reader-bookshelf-more-action-',
        onAction: (token: string): void => this.dispatchToken(token) });
    }.width('100%').padding({ left: this.surfaceSpec().horizontalInset, right: this.surfaceSpec().horizontalInset });
  }

  private dispatchToken(token: string): void {
    const separator = token.lastIndexOf('::');
    const identity = separator < 0 ? '' : token.slice(0, separator);
    const actionId = separator < 0 ? '' : token.slice(separator + 2);
    if (!this.mounted || identity.length === 0 || identity !== this.presentationId || this.dispatchedId === identity) return;
    try { if (!this.isCurrent(identity)) return; } catch (_error) { return; }
    if (actionId === 'batch' && !this.canBatchManage) return;
    this.dispatchedId = identity;
    if (actionId === 'batch') this.onBatchManage();
    else if (actionId === 'import') this.onLocalImport();
    else if (actionId === 'update') this.onCheckUpdates();
    else if (actionId === 'downloads') this.onDownloadsRequested();
    else if (actionId === 'settings') this.onBookshelfSettings();
    else if (actionId === 'management') this.onBookshelfManagement();
  }
}
