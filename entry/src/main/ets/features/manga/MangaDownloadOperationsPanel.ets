import { readerAppColor } from '../common/ReaderThemeRegistry';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../common/ReaderFontFamilies';
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
        ForEach(this.actions, (item: MangaDownloadAction) => {
          Button(item.label).height(48).width('100%').fontSize(13).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
            .fontWeight(400).fontColor(this.ink()).backgroundColor(this.paper()).borderRadius(14)
            .accessibilityText(item.label).onClick((): void => this.onAction(item.id));
        }, (item: MangaDownloadAction): string => item.id);
      }
    }.width('100%');
  }
  private ink(): string { return this.panelInkColor || readerAppColor('TOK_INK', this.appThemeScheme); }
  private paper(): string { return this.panelPaperColor || readerAppColor('TOK_PAPER', this.appThemeScheme); }
}
