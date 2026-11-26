import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from '../../reading/presentation/ReadingDirectoryRecovery';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerSurfaceElevation } from '../../../ui/surfaces/ReaderSurfaceSpecs';
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
  @Prop reduceMotion: boolean = false;
  @Prop generation: number = 0;
  @Prop focusId: string = '';
  @Prop availableWidth: number = 240;
  @Prop actions: MangaDownloadAction[] = [];
  @Prop loading: boolean = false;
  @Prop directoryRecovery: ReadingDirectoryRecovery = EMPTY_READING_DIRECTORY_RECOVERY;
  @Prop recoveryActive: boolean = true;
  onReconcileOffline: (generation: number, presentationId: string, popupGeneration: number) => void = (): void => {};
  onContinueOffline: (generation: number, presentationId: string, popupGeneration: number) => void = (): void => {};
  @Prop failureMessage: string = '';
  onOpen: () => void = (): void => {};
  onClosed: (generation: number) => void = (_generation: number): void => {};
  onAction: (action: MangaDownloadActionId, generation: number) => void = (_action: MangaDownloadActionId, _generation: number): void => {};
  onRetry: (generation: number) => void = (_generation: number): void => {};
  private mounted: boolean = false;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  private isCurrent(generation: number): boolean {
    return this.mounted && generation === this.generation;
  }

  build() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Image(this.appThemeScheme === 'night' ? $r('app.media.reader_directory_more_theme_night') : $r('app.media.reader_directory_more'))
        .width(this.spec().iconSize).height(this.spec().iconSize).accessibilityLevel('no');
    }.id(this.focusId).width(this.spec().anchorSize).height(this.spec().anchorSize).padding(0)
      .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, this.spec().anchorSize / 2))
      .accessibilityText('漫画下载管理')
      .onClick((): void => { if (this.mounted) this.onOpen(); })
      .bindPopup(this.mounted && this.visible, this.popupOptions(this.generation));
  }
  private popupOptions(generation: number): CustomPopupOptions {
    const spec = this.spec();
    const border = readerAppColor('app.border.menu', this.appThemeScheme);
    return { builder: (): void => { this.popupContent(generation); },
      placement: Placement.BottomLeft, enableArrow: false,
      popupColor: readerAppColor('TOK_CARD_BG', this.appThemeScheme),
      backgroundBlurStyle: BlurStyle.NONE,
      radius: spec.radius, borderWidth: spec.borderWidth,
      borderLinearGradient: { colors: [[border, 0], [border, 1]] },
      shadow: readerSurfaceElevation('popover', this.appThemeScheme),
      mask: true, autoCancel: true, focusable: true, followTransformOfTarget: true,
      transition: this.reduceMotion ? TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam()) : undefined,
      onStateChange: (event: PopupStateChangeParam): void => {
        if (!event.isVisible && this.isCurrent(generation)) this.onClosed(generation);
      } };
  }
  @Builder
  private popupContent(generation: number) {
    Scroll() {
      MangaDownloadOperationsPanel({ reduceMotion: this.reduceMotion,
        actions: this.actions, loading: this.loading, failureMessage: this.failureMessage,
        directoryRecovery: this.directoryRecovery, recoveryActive: this.isCurrent(generation) && this.visible && this.recoveryActive,
        onReconcileOffline: (expected: number, presentation: string): void => {
          if (this.isCurrent(generation) && this.visible) this.onReconcileOffline(expected, presentation, generation);
        },
        onContinueOffline: (expected: number, presentation: string): void => {
          if (this.isCurrent(generation) && this.visible) this.onContinueOffline(expected, presentation, generation);
        },
        onAction: (action: MangaDownloadActionId): void => {
          if (this.isCurrent(generation) && this.visible) this.onAction(action, generation);
        },
        onRetry: (): void => { if (this.isCurrent(generation) && this.visible) this.onRetry(generation); } });
    }.width(Math.min(this.spec().maxWidth, this.availableWidth))
      .constraintSize({ maxHeight: this.spec().maxHeight }).padding(this.spec().padding).scrollBar(BarState.Off);
  }
  private spec(): ReaderMangaDownloadPopupRecipe {
    if (this.specId !== 'manga-download') throw new Error('Unsupported manga download popup specification');
    return READER_MANGA_DOWNLOAD_POPUP;
  }
}
