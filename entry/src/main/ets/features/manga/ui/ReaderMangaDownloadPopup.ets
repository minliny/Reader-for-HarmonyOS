import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { READER_MANGA_DOWNLOAD_POPUP, ReaderMangaDownloadPopupRecipe } from './ReaderMangaDownloadPopupSpec';
import { MangaDownloadOperationsPanel } from './MangaDownloadOperationsPanel';
import type { MangaDownloadAction, MangaDownloadActionId } from '../application/MangaDownloadActionsGateway';

/** Finite catalog popup adapter. The parent owns session/generation admission
 * and all download mutations; the existing panel owns loading/error/actions. */
@Component
export struct ReaderMangaDownloadPopup {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop specId: 'manga-download' = 'manga-download';
  @Prop visible: boolean = false;
  @Prop generation: number = 0;
  @Prop focusId: string = '';
  @Prop availableWidth: number = 240;
  @Prop actions: MangaDownloadAction[] = [];
  @Prop loading: boolean = false;
  @Prop failureMessage: string = '';
  onOpen: () => void = (): void => {};
  onClosed: (generation: number) => void = (_generation: number): void => {};
  onAction: (action: MangaDownloadActionId, generation: number) => void = (_action: MangaDownloadActionId, _generation: number): void => {};
  onRetry: (generation: number) => void = (_generation: number): void => {};

  build() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Image(this.appThemeScheme === 'night' ? $r('app.media.reader_directory_more_theme_night') : $r('app.media.reader_directory_more'))
        .width(this.spec().iconSize).height(this.spec().iconSize).accessibilityLevel('no');
    }.id(this.focusId).width(this.spec().anchorSize).height(this.spec().anchorSize).padding(0)
      .backgroundColor(Color.Transparent).borderRadius(0).accessibilityText('漫画下载管理')
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
