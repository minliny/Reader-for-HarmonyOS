import { readerAppColor } from '../common/ReaderThemeRegistry';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../common/ReaderFontFamilies';
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

  build() {
    Column({ space: 8 }) {
      if (this.loading) {
        Row({ space: 10 }) {
          LoadingProgress().width(32).height(32)
            .color(readerAppColor('TOK_GREEN', this.effectiveScheme()));
          Text('正在读取下载状态…').fontSize(13).lineHeight(20).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
            .fontColor(this.ink());
        }.width('100%').constraintSize({ minHeight: 44 }).justifyContent(FlexAlign.Center);
      } else if (this.failureMessage.length > 0) {
        Text(this.failureMessage).fontSize(13).lineHeight(20).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
          .fontColor(this.ink()).width('100%');
        Row() {
          Button('重试').height(32).padding({ left: 12, right: 12 }).fontSize(13).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
            .fontColor(readerAppColor('TOK_GREEN', this.effectiveScheme())).backgroundColor(Color.Transparent).borderRadius(8)
            .onClick((): void => this.onRetry());
        }.width('100%').justifyContent(FlexAlign.End);
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
  private ink(): string { return this.panelInkColor || readerAppColor('TOK_INK', this.effectiveScheme()); }
}
