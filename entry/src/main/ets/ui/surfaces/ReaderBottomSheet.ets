import type { ReaderNavigationPreferences, ReaderSurfaceMaterialDecision } from '../../app/HarmonyCapabilityPolicy';
import { READER_LAYOUT_DEBUG_BUILD, newReaderLayoutModalId, publishReaderLayoutModal } from '../../ui/foundation/ReaderLayoutInvariantSignals';
import type { LayoutInvariantTag } from '../../ui/layout/LayoutInvariantEvaluator';
import { READER_REDUCED_FADE_MS, READER_SHEET_CLOSE_MS } from '../foundation/ProductMotionTiming';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { readerMotionAnimateParam, readerMotionReducedFadeParam } from '../foundation/ReaderMotionPolicy';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { readerInteractiveSafeTop, readerVisualSafeBottom, readerVisualSafeLeft, readerVisualSafeRight }
  from '../foundation/ReaderWindowMetrics';
import { readerSurfaceElevation, resolveSheetSpec, type SheetSpecId, type SheetSurfaceSpec } from './ReaderSurfaceSpecs';
import { defaultNavigationPreferences, readerImmersiveMaterial, ReaderModalScrimModifier,
  readerSurfaceMaterialDecision } from './ReaderSurfaceMaterial';

/** The cover owns native modal isolation and system Back. The scrim and
 * independently timed sheet are drawn over the live page inside that cover. */
@Component
export struct ReaderBottomSheet {
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @StorageLink('readerSystemScheme') private systemScheme: string = 'day';
  @StorageProp('readerNavigationAppearancePreferences') private appearancePreferences: ReaderNavigationPreferences =
    defaultNavigationPreferences();
  @Prop @Watch('onVisibilityChanged') visible: boolean = false;
  @Prop specId: SheetSpecId = 'bookshelf-book-action';
  @Prop surfaceWidth: number = 390;
  @Prop scheme: string = 'day';
  @Prop reduceMotion: boolean = false;
  @Prop nativeId: string = '';
  @Prop drainPendingClose: boolean = false;
  @BuilderParam content: () => void = this.emptyContent;
  onRequestClose: () => void = (): void => {};
  onOpening: () => void = (): void => {};
  onOpened: () => void = (): void => {};
  onClosed: () => void = (): void => {};

  @State private coverVisible: boolean = false;
  @State private frameVisible: boolean = false;
  private mounted: boolean = false;
  private coverReady: boolean = false;
  private coverAppearance: number = 0;
  private frameAttached: boolean = false;
  private opened: boolean = false;
  private layoutModalId: number = 0;

  aboutToAppear(): void {
    this.mounted = true;
    this.onVisibilityChanged();
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.coverAppearance += 1;
    if (this.layoutModalId > 0) publishReaderLayoutModal(this.layoutModalId, false, false, 0);
  }

  private onVisibilityChanged(): void {
    if (!this.mounted) return;
    if (this.visible) {
      this.coverVisible = true;
    } else {
      this.frameVisible = false;
      if (this.coverReady && !this.frameAttached) this.coverVisible = false;
    }
    this.reportLayoutModal();
  }

  private reportLayoutModal(): void {
    if (typeof READER_LAYOUT_DEBUG_BUILD !== 'boolean' || !READER_LAYOUT_DEBUG_BUILD) return;
    if (this.layoutModalId === 0) this.layoutModalId = newReaderLayoutModalId();
    publishReaderLayoutModal(this.layoutModalId, this.visible, this.coverVisible || this.coverReady,
      this.reduceMotion ? READER_REDUCED_FADE_MS : READER_SHEET_CLOSE_MS);
  }

  private coverOptions(): ContentCoverOptions {
    return {
      modalTransition: ModalTransition.NONE,
      backgroundColor: Color.Transparent,
      onWillAppear: (): void => { if (this.mounted) this.onOpening(); },
      onAppear: (): void => {
        if (!this.mounted) return;
        this.coverReady = true;
        this.reportLayoutModal();
        const appearance = ++this.coverAppearance;
        // The native cover may announce appearance during its first render.
        void Promise.resolve().then((): void => {
          if (!this.mounted || appearance !== this.coverAppearance || !this.coverVisible) return;
          if (this.visible) this.frameVisible = true;
          else this.coverVisible = false;
        });
      },
      onWillDismiss: (_action: DismissContentCoverAction): void => {
        if (this.mounted && this.visible) this.onRequestClose();
      },
      onDisappear: (): void => {
        this.coverAppearance += 1;
        this.coverReady = false;
        this.frameVisible = false;
        this.frameAttached = false;
        this.opened = false;
        this.reportLayoutModal();
        if (this.mounted) this.onClosed();
      },
    };
  }

  @Builder private emptyContent() {}

  build() {
    Column().width(0).height(0).hitTestBehavior(HitTestMode.None).accessibilityLevel('no')
      .onAppear((): void => {
        if (this.mounted && this.drainPendingClose && !this.visible && !this.coverVisible) this.onClosed();
      })
      .bindContentCover(this.coverVisible, this.sheetCoverContent, this.coverOptions());
  }

  @Builder
  private sheetCoverContent() {
    Stack({ alignContent: Alignment.Bottom }) {
      if (this.frameVisible) {
        Stack().width('100%').height('100%')
          .attributeModifier(new ReaderModalScrimModifier(this.appearancePreferences, this.scheme,
            readerAppColor(this.spec().hostMaskRole, this.scheme), this.frameMaterial().native))
          .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
          .accessibilityLevel('no')
          .onClick((): void => {
            if (this.mounted && this.visible && this.opened) this.onRequestClose();
          })
          .transition(TransitionEffect.OPACITY.animation(this.reduceMotion ? readerMotionReducedFadeParam() :
            readerMotionAnimateParam('app.sheet.scrim', false)));
        this.frame();
      }
    }.width('100%').height('100%').hitTestBehavior(HitTestMode.Default)
      .customProperty('readerLayoutInvariant', typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD
        ? { role: 'modal-overlay', id: 'bottom-sheet', active: this.visible,
          intercepts: this.coverVisible, closeDurationMs: this.reduceMotion ? READER_REDUCED_FADE_MS : READER_SHEET_CLOSE_MS } as LayoutInvariantTag : undefined);
  }

  @Builder
  private frame() {
    Column() {
      if (this.specId === 'bookshelf-book-action') {
        Scroll() { this.content(); }.width('100%').align(Alignment.TopStart).scrollBar(BarState.Auto);
      } else {
        this.content();
      }
    }.id(this.nativeId).width(this.surfaceWidth)
      .constraintSize({ maxHeight: this.frameMaxHeight() })
      .padding({ bottom: this.safeBottom() })
      .translate({ x: this.safeCenterOffset() })
      .backgroundEffect(undefined)
      .backgroundColor(this.frameMaterial().native ? Color.Transparent : readerAppColor(this.spec().hostBackgroundRole, this.scheme))
      .border(this.frameMaterial().native ? { width: 0, color: Color.Transparent } :
        { width: { top: this.spec().hostBorderWidth }, color: readerAppColor(this.spec().hostBorderRole, this.scheme) })
      .borderRadius({ topLeft: this.spec().borderRadius, topRight: this.spec().borderRadius })
      .shadow(this.frameMaterial().native ? undefined : this.frameShadow())
      .systemMaterial(readerImmersiveMaterial(this.frameMaterial())).clip(true)
      .hitTestBehavior(HitTestMode.Default).focusable(true).focusScopeId(this.nativeId, true, false)
      .onAppear((): void => { this.frameAttached = true; })
      .transition(this.reduceMotion ? TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam()) :
        TransitionEffect.asymmetric(
          TransitionEffect.move(TransitionEdge.BOTTOM).animation(readerMotionAnimateParam('app.sheet.open', false)),
          TransitionEffect.move(TransitionEdge.BOTTOM).animation(readerMotionAnimateParam('app.sheet.close', false))),
        (entering: boolean): void => this.finishMotion(entering));
  }

  private finishMotion(entering: boolean): void {
    if (!this.mounted) return;
    if (!entering && !this.visible) {
      this.coverVisible = false;
    } else if (entering && this.visible) {
      this.opened = true;
      if (this.nativeId.length > 0) {
        try { this.getUIContext().getFocusController().requestFocus(this.nativeId); } catch (_) {}
      }
      this.onOpened();
    }
  }

  private spec(): SheetSurfaceSpec { return resolveSheetSpec(this.specId); }

  private frameMaterial(): ReaderSurfaceMaterialDecision {
    return readerSurfaceMaterialDecision('modalSheet', this.appearancePreferences, this.scheme, this.systemScheme);
  }

  private frameMaxHeight(): Length {
    this.metricsRevision;
    const metrics = readerWindowMetrics();
    if (metrics.windowRect.height <= 0) return '100%';
    return Math.max(1, metrics.windowRect.height - readerInteractiveSafeTop(metrics, false));
  }

  private safeBottom(): number {
    this.metricsRevision;
    return readerVisualSafeBottom(readerWindowMetrics());
  }

  private frameShadow(): ShadowOptions {
    this.metricsRevision;
    return readerSurfaceElevation(this.spec().hostElevation, this.scheme);
  }

  private safeCenterOffset(): number {
    this.metricsRevision;
    const metrics = readerWindowMetrics();
    return (readerVisualSafeLeft(metrics) - readerVisualSafeRight(metrics)) / 2;
  }
}
