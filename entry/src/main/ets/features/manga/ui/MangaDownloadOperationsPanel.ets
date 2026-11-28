import { ReaderDirectoryRecoverySurface } from '../../reading/ui/ReaderDirectoryRecoverySurface';
import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from '../../reading/presentation/ReadingDirectoryRecovery';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { ReaderActionMenuSurface, ReaderMenuActionView } from '../../../ui/surfaces/ReaderActionMenuSurface';
import { readerActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import type { MangaDownloadAction, MangaDownloadActionId } from '../application/MangaDownloadActionsGateway';

/** Content reused inside the existing manga operation sheet/catalog popup. */
@Component
export struct MangaDownloadOperationsPanel {
  @StorageProp('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageProp('readerAppForeground') private foreground: boolean = true;
  @Prop reduceMotion: boolean = false;
  @Prop directoryRecovery: ReadingDirectoryRecovery = EMPTY_READING_DIRECTORY_RECOVERY;
  @Prop recoveryActive: boolean = true;
  onReconcileOffline: (generation: number, presentationId: string) => void = (): void => {};
  onContinueOffline: (generation: number, presentationId: string) => void = (): void => {};
  @Prop actions: MangaDownloadAction[] = [];
  @Prop loading: boolean = false;
  @Prop failureMessage: string = '';
  @Prop panelScheme: 'auto' | 'day' | 'night' = 'auto';
  onAction: (action: MangaDownloadActionId) => void = (_action: MangaDownloadActionId): void => {};
  onRetry: () => void = (): void => {};

  build() {
    Column({ space: 8 }) {
      if (this.directoryRecovery.offline.visible && this.directoryRecovery.offlineKind !== 'result') {
        ReaderDirectoryRecoverySurface({ recovery: {
          presentationId: this.directoryRecovery.presentationId,
          bookmarks: EMPTY_READING_DIRECTORY_RECOVERY.bookmarks, canContinueBookmarks: false, bookmarkWriteEnabled: false,
          offline: this.directoryRecovery.offline, offlineKind: this.directoryRecovery.offlineKind,
          offlineReadbackFailed: this.directoryRecovery.offlineReadbackFailed, offlineBusy: this.directoryRecovery.offlineBusy,
          offlineRecoveryAction: this.directoryRecovery.offlineRecoveryAction, canContinueOffline: this.directoryRecovery.canContinueOffline,
        }, presentationActive: this.foreground && this.recoveryActive,
          isPresentationCurrent: (): boolean => this.foreground && this.recoveryActive,
          onReconcileOffline: (generation: number, presentation: string): void => this.onReconcileOffline(generation, presentation),
          onContinueOffline: (generation: number, presentation: string): void => this.onContinueOffline(generation, presentation) });
      }
      if (this.loading || this.failureMessage.length > 0) {
        ReaderPageState({ padded: false, loading: this.loading,
          loadingActive: this.foreground && !this.reduceMotion,
          message: this.loading ? '正在读取下载状态…' : this.failureMessage,
          actionLabel: this.loading ? '' : '重试',
          actionEnabled: !this.loading && this.failureMessage.length > 0,
          inkColor: readerAppColor('TOK_MESSAGE_INK', this.effectiveScheme()),
          mutedColor: readerAppColor('TOK_MESSAGE_MUTED', this.effectiveScheme()),
          onAction: (): void => { if (!this.loading && this.failureMessage.length > 0) this.onRetry(); } });
      } else {
        ReaderActionMenuSurface({ variant: 'grouped', actions: this.sheetActions(), scheme: this.panelScheme,
          reduceMotion: this.reduceMotion,
          onAction: (id: string): void => this.performAction(id) });
      }
    }.width('100%');
  }
  private sheetActions(): ReaderMenuActionView[] {
    return this.actions.map((item: MangaDownloadAction): ReaderMenuActionView => {
      const cleanup = item.id === 'releaseRetention' || item.id === 'deleteDownloads' || item.id === 'clearCache';
      const danger = item.id === 'deleteDownloads' || item.id === 'clearCache';
      return new ReaderMenuActionView(item.id, item.label, true, this.actionIcon(item.id), item.label,
        cleanup ? '存储清理' : '下载任务', '', '', danger ? 'danger' : 'default');
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
    if (current !== undefined) this.onAction(current.id);
  }
  private effectiveScheme(): string { return this.panelScheme === 'auto' ? this.appThemeScheme : this.panelScheme; }
}
