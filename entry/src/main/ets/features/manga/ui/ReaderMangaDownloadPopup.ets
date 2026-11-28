import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from '../../reading/presentation/ReadingDirectoryRecovery';
import { readerAppColor } from '../../../ui/foundation/ReaderAppColors';
import { READER_LAYOUT_SURFACE_HINT, ReaderLayoutOverlayRoot } from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import type { LayoutInvariantSurfaceHint } from '../../../ui/layout/LayoutInvariantNativeAudit';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { ReaderInsetsVp, ReaderRectVp } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerOverlayPanel, readerOverlayViewport } from '../../../ui/layout/ReaderOverlayGeometry';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
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
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @State private anchor: ReaderRectVp | undefined = undefined;
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
  private readonly layoutOverlay = ReaderLayoutOverlayRoot.diagnostic('manga-download');

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
      .onAreaChange((_old: Area, current: Area): void => this.recordAnchor(current))
      .bindPopup(this.mounted && this.visible, this.popupOptions(this.generation));
  }

  private recordAnchor(area: Area): void {
    const x = readerPageAreaLength(area.globalPosition.x);
    const y = readerPageAreaLength(area.globalPosition.y);
    const width = readerPageAreaLength(area.width);
    const height = readerPageAreaLength(area.height);
    if (Number.isFinite(x) && Number.isFinite(y) && width > 0 && height > 0) {
      this.anchor = new ReaderRectVp(x, y, width, height);
    }
  }

  private popupRect(): ReaderRectVp {
    this.metricsRevision;
    const viewport = readerOverlayViewport(readerWindowMetrics(), undefined, new ReaderInsetsVp(8, 8, 8, 8), this.anchor);
    return readerOverlayPanel(viewport, Math.min(this.spec().maxWidth, this.availableWidth),
      this.spec().maxHeight, 'anchor-start', this.anchor, 8);
  }

  private popupOptions(generation: number): CustomPopupOptions {
    const spec = this.spec();
    const border = readerAppColor('app.border.menu', this.appThemeScheme);
    const rect = this.popupRect();
    const anchor = this.anchor;
    return { builder: (): void => { this.popupContent(generation); },
      placement: anchor !== undefined && rect.top < anchor.top ? Placement.TopLeft : Placement.BottomLeft,
      width: rect.width, targetSpace: 8, enableArrow: false,
      offset: anchor === undefined ? undefined : { x: rect.left - anchor.left, y: 0 },
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

  private popupLayoutHint(): LayoutInvariantSurfaceHint | undefined {
    const anchor = this.anchor;
    if (this.layoutOverlay === undefined) return undefined;
    return { placement: 'anchor', dialog: true, nativeDismiss: true,
      anchor: anchor === undefined ? undefined : { x: anchor.left, y: anchor.top, width: anchor.width, height: anchor.height } };
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
    }.id(this.layoutOverlay?.id()).width(this.popupRect().width).constraintSize({ maxHeight: this.popupRect().height })
      .customProperty(READER_LAYOUT_SURFACE_HINT, this.popupLayoutHint())
      .padding(this.spec().padding).scrollBar(BarState.Auto)
      .onAppear((): void => this.layoutOverlay?.mount(this.getUIContext()))
      .onDisAppear((): void => this.layoutOverlay?.unmount());
  }
  private spec(): ReaderMangaDownloadPopupRecipe {
    if (this.specId !== 'manga-download') throw new Error('Unsupported manga download popup specification');
    return READER_MANGA_DOWNLOAD_POPUP;
  }
}
