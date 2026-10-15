import { readerAppColor } from '../common/ReaderThemeRegistry';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../common/ReaderFontFamilies';
import { ReaderActionSheetAction, ReaderActionSheetContent } from '../common/ReaderActionSheetContent';
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

  build() {
    Column({ space: 8 }) {
      if (this.loading) {
        Text('正在读取下载状态…').fontSize(13).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
          .fontColor(this.ink()).width('100%').height(48).textAlign(TextAlign.Center);
      } else if (this.failureMessage.length > 0) {
        Text(this.failureMessage).fontSize(13).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
          .fontColor(this.ink()).width('100%');
        Button('重试').height(48).width('100%').fontSize(13).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
          .fontColor(this.ink()).backgroundColor(this.paper()).borderRadius(14).onClick((): void => this.onRetry());
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
      return new ReaderActionSheetAction(item.id, item.label, cleanup ? '存储清理' : '下载任务', '', '', true,
        this.actionIcon(item.id), danger ? 'danger' : 'default');
    });
  }
  private actionIcon(id: MangaDownloadActionId): Resource {
    const night = this.effectiveScheme() === 'night';
    if (id === 'pause') return night ? $r('app.media.download_visual_pause_theme_night') : $r('app.media.download_visual_pause');
    if (id === 'resume') return night ? $r('app.media.download_visual_play_theme_night') : $r('app.media.download_visual_play');
    if (id === 'cancel') return night ? $r('app.media.download_visual_close_theme_night') : $r('app.media.download_visual_close');
    if (id === 'updateChapter') return night ? $r('app.media.download_visual_retry_theme_night') : $r('app.media.download_visual_retry');
    if (id === 'releaseRetention') return night ? $r('app.media.download_visual_storage_theme_night') : $r('app.media.download_visual_storage');
    if (id === 'deleteDownloads') return night ? $r('app.media.download_visual_trash_theme_night') : $r('app.media.download_visual_trash');
    if (id === 'clearCache') return night ? $r('app.media.download_visual_clear_theme_night') : $r('app.media.download_visual_clear');
    return night ? $r('app.media.download_visual_download_theme_night') : $r('app.media.download_visual_download');
  }
  private performAction(id: string): void {
    if (this.loading || this.failureMessage.length > 0) return;
    const current = this.actions.find((item: MangaDownloadAction): boolean => item.id === id);
    if (current !== undefined) this.onAction(current.id);
  }
  private effectiveScheme(): string { return this.panelScheme === 'auto' ? this.appThemeScheme : this.panelScheme; }
  private ink(): string { return this.panelInkColor || readerAppColor('TOK_INK', this.effectiveScheme()); }
  private paper(): string { return this.panelPaperColor || readerAppColor('TOK_PAPER', this.effectiveScheme()); }
}
