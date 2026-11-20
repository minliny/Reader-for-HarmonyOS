import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ReaderPageState } from '../common/ReaderPageState';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import { ReaderActionSheetAction, ReaderActionSheetContent } from '../common/ReaderActionSheetContent';
import { readerActionIcon } from '../common/ReaderActionIconResources';
import type { MangaDownloadAction, MangaDownloadActionId } from './MangaDownloadActionsGateway';

/** Content reused inside the existing manga operation sheet/catalog popup. */
@Component
export struct MangaDownloadOperationsPanel {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop actions: MangaDownloadAction[] = [];
  @Prop loading: boolean = false;
  @Prop failureMessage: string = '';
  @Prop panelInkColor: string = '';
  @Prop panelPaperColor: string = '';
  @Prop panelScheme: 'auto' | 'day' | 'night' = 'auto';
  onAction: (action: MangaDownloadActionId) => void = (_action: MangaDownloadActionId): void => {};
  onRetry: () => void = (): void => {};

  @Builder
  private retryAction() {
    Row() {
      ReaderRecoveryAction({ label: '重试', variant: 'text', scheme: this.effectiveScheme(),
        actionEnabled: !this.loading && this.failureMessage.length > 0,
        onReconcile: (): void => { if (!this.loading && this.failureMessage.length > 0) this.onRetry(); } });
    }.width('100%').justifyContent(FlexAlign.End);
  }

  build() {
    Column({ space: 8 }) {
      if (this.loading) {
        ReaderPageState({ message: '正在读取下载状态…', loading: true, padded: false,
          inkColor: this.ink(), mutedColor: this.ink() });
      } else if (this.failureMessage.length > 0) {
        ReaderPageState({ message: this.failureMessage, padded: false,
          inkColor: this.ink(), mutedColor: this.ink(), customActions: true,
          actionContent: (): void => this.retryAction() });
      } else {
        ReaderActionSheetContent({ variant: 'grouped', actions: this.sheetActions(), scheme: this.panelScheme,
          onAction: (id: string): void => this.performAction(id) });
      }
    }.width('100%');
  }
  private sheetActions(): ReaderActionSheetAction[] {
    return this.actions.map((item: MangaDownloadAction): ReaderActionSheetAction => {
      const cleanup = item.id === 'releaseRetention' || item.id === 'deleteDownloads' || item.id === 'clearCache';
      const danger = item.id === 'deleteDownloads' || item.id === 'clearCache';
      return new ReaderActionSheetAction(item.id, item.label, cleanup ? '存储清理' : '下载任务', '', '', item.enabled !== false,
        this.actionIcon(item.id), danger ? 'danger' : 'default');
    });
  }
  private actionIcon(id: MangaDownloadActionId): Resource {
    const scheme = this.effectiveScheme();
    if (id === 'pause') return readerActionIcon('pause', scheme);
    if (id === 'resume') return readerActionIcon('play', scheme);
    if (id === 'cancel' || id === 'clearCache') return readerActionIcon('close', scheme);
    if (id === 'updateChapter') return readerActionIcon('refresh', scheme);
    if (id === 'releaseRetention') return readerActionIcon('storage', scheme);
    if (id === 'deleteDownloads') return readerActionIcon('trash', scheme);
    return readerActionIcon('download', scheme);
  }
  private performAction(id: string): void {
    if (this.loading || this.failureMessage.length > 0) return;
    const current = this.actions.find((item: MangaDownloadAction): boolean => item.id === id);
    if (current !== undefined && current.enabled !== false) this.onAction(current.id);
  }
  private effectiveScheme(): string { return this.panelScheme === 'auto' ? this.appThemeScheme : this.panelScheme; }
  private ink(): string { return this.panelInkColor || readerAppColor('TOK_INK', this.effectiveScheme()); }
}
