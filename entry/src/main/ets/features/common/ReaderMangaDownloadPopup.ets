import { readerAppColor } from './ReaderThemeRegistry';
import { READER_MANGA_DOWNLOAD_POPUP, ReaderMangaDownloadPopupRecipe } from './ReaderMangaDownloadPopupSpec';
import { MangaDownloadOperationsPanel } from '../manga/MangaDownloadOperationsPanel';
import type { MangaDownloadAction, MangaDownloadActionId } from '../manga/MangaDownloadActionsGateway';

/** Finite catalog popup adapter. The parent owns session/generation admission
 * and all download mutations; the existing panel owns loading/error/actions. */
@Component
export struct ReaderMangaDownloadPopup {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop specId: 'manga-download' = 'manga-download';
  @Prop visible: boolean = false;
  @Prop generation: number = 0;
  @Prop availableWidth: number = 240;
  @Prop actions: MangaDownloadAction[] = [];
  @Prop loading: boolean = false;
  @Prop failureMessage: string = '';
  onOpen: () => void = (): void => {};
  onClosed: (generation: number) => void = (_generation: number): void => {};
  onAction: (action: MangaDownloadActionId, generation: number) => void = (_action: MangaDownloadActionId, _generation: number): void => {};
  onRetry: (generation: number) => void = (_generation: number): void => {};

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Image(this.appThemeScheme === 'night' ? $r('app.media.reader_directory_more_theme_night') : $r('app.media.reader_directory_more'))
        .width(this.spec().iconSize).height(this.spec().iconSize);
    }.width(this.spec().anchorSize).height(this.spec().anchorSize).accessibilityText('漫画下载管理')
      .onClick((): void => this.onOpen())
      .bindPopup(this.visible, this.popupOptions(this.generation));
  }
  private popupOptions(generation: number): CustomPopupOptions {
    return { builder: (): void => { this.popupContent(generation); },
      placement: Placement.BottomLeft, enableArrow: false,
      popupColor: readerAppColor('TOK_CARD_BG', this.appThemeScheme),
      onStateChange: (event: PopupStateChangeParam): void => { if (!event.isVisible) this.onClosed(generation); } };
  }
  @Builder
  private popupContent(generation: number) {
    Scroll() {
      MangaDownloadOperationsPanel({ actions: this.actions, loading: this.loading, failureMessage: this.failureMessage,
        onAction: (action: MangaDownloadActionId): void => this.onAction(action, generation),
        onRetry: (): void => this.onRetry(generation) });
    }.width(Math.min(this.spec().maxWidth, this.availableWidth))
      .constraintSize({ maxHeight: this.spec().maxHeight }).padding(this.spec().padding).scrollBar(BarState.Off);
  }
  private spec(): ReaderMangaDownloadPopupRecipe {
    if (this.specId !== 'manga-download') throw new Error('Unsupported manga download popup specification');
    return READER_MANGA_DOWNLOAD_POPUP;
  }
}
