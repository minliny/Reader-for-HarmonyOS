import type { ReaderNavigationPreferences, ReaderSurfaceMaterialDecision } from '../../app/HarmonyCapabilityPolicy';
import { READER_LAYOUT_DEBUG_BUILD, ReaderLayoutOverlayRoot, newReaderLayoutModalId, publishReaderLayoutModal }
  from '../../ui/foundation/ReaderLayoutInvariantSignals';
import type { LayoutInvariantTag } from '../../ui/layout/LayoutInvariantEvaluator';
import { readerBeginTransition, readerTransitionsEnabled } from '../foundation/ReaderTransitionSignals';
import { READER_REDUCED_FADE_MS, READER_SHEET_CLOSE_MS } from '../foundation/ProductMotionTiming';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { readerMotionAnimateParam, readerMotionReducedFadeParam } from '../foundation/ReaderMotionPolicy';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { ReaderRectVp } from '../foundation/ReaderWindowMetrics';
import { readerOverlayViewport } from '../layout/ReaderOverlayGeometry';
import { readerSurfaceElevation, resolveSheetSpec, type SheetSpecId, type SheetSurfaceSpec } from './ReaderSurfaceSpecs';
import { defaultNavigationPreferences, ReaderImmersiveMaterialModifier, ReaderModalScrimModifier, readerNativeSurfaceOutline,
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
  private readonly layoutOverlay = ReaderLayoutOverlayRoot.diagnostic('bottom-sheet');
  private coverReady: boolean = false;
  private coverAppearance: number = 0;
  private frameAttached: boolean = false;
  private frameGeneration: number = 0;
  private visibilityGeneration: number = 0;
  private opened: boolean = false;
  private readonly layoutModalId: number = newReaderLayoutModalId();
  private closeTimeout: number | undefined = undefined;

  aboutToAppear(): void {
    this.mounted = true;
    this.onVisibilityChanged();
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.coverAppearance += 1;
    this.frameGeneration += 1;
    this.clearCloseTimeout();
    if (typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD) {
      publishReaderLayoutModal(this.layoutModalId, false, false, 0);
    }
  }

  private onVisibilityChanged(): void {
    if (!this.mounted) return;
    const visibility = ++this.visibilityGeneration;
    this.clearCloseTimeout();
    if (this.visible) {
      this.coverVisible = true;
      if (this.coverReady) this.presentFrame();
    } else {
      this.frameVisible = false;
      if (this.coverReady && !this.frameAttached) this.coverVisible = false;
      if (this.coverVisible) {
        const frame = this.frameGeneration;
        this.closeTimeout = setTimeout((): void => {
          if (this.visibilityGeneration === visibility) this.finishMotion(false, frame);
        }, this.closeDurationMs() + 120);
      }
    }
    this.reportLayoutModal();
  }

  private reportLayoutModal(): void {
    if (typeof READER_LAYOUT_DEBUG_BUILD !== 'boolean' || !READER_LAYOUT_DEBUG_BUILD) return;
    publishReaderLayoutModal(this.layoutModalId, this.visible, this.coverVisible || this.coverReady, this.closeDurationMs());
  }

  private closeDurationMs(): number {
    return this.reduceMotion ? READER_REDUCED_FADE_MS : READER_SHEET_CLOSE_MS;
  }

  private clearCloseTimeout(): void {
    if (this.closeTimeout === undefined) return;
    clearTimeout(this.closeTimeout);
    this.closeTimeout = undefined;
  }

  private presentFrame(): void {
    if (this.frameVisible) return;
    this.frameGeneration += 1;
    this.frameAttached = false;
    this.frameVisible = true;
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
          if (this.visible) this.presentFrame();
          else this.coverVisible = false;
        });
      },
      onWillDismiss: (_action: DismissContentCoverAction): void => {
        if (this.mounted && this.visible) this.onRequestClose();
      },
      onDisappear: (): void => {
        const appearance = ++this.coverAppearance;
        this.clearCloseTimeout();
        this.coverReady = false;
        this.frameVisible = false;
        this.frameGeneration += 1;
        this.frameAttached = false;
        this.opened = false;
        this.coverVisible = false;
        this.reportLayoutModal();
        if (!this.mounted) return;
        if (!this.visible) this.onClosed();
        else {
          // Reopen after native retirement if visibility changed during dismissal.
          void Promise.resolve().then((): void => {
            if (this.mounted && this.visible && appearance === this.coverAppearance) this.onVisibilityChanged();
          });
        }
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
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.frameVisible) {
        Stack().width('100%').height('100%')
          .attributeModifier(new ReaderModalScrimModifier(this.appearancePreferences, this.scheme,
            readerAppColor(this.spec().hostMaskRole, this.scheme), this.frameMaterial().native))
          .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
          .accessibilityLevel('no')
          .onClick((): void => {
            if (this.mounted && this.visible && this.opened) this.onRequestClose();
          })
          .transition(TransitionEffect.OPACITY.animation(this.reduceMotion ? readerMotionReducedFadeParam() :
            readerMotionAnimateParam('app.sheet.scrim', false)));
        if (this.frameViewport().width > 0 && this.frameViewport().height > 0) {
          Stack({ alignContent: Alignment.Bottom }) {
            ForEach([this.frameGeneration], (generation: number): void => { this.frame(generation); },
              (generation: number): string => generation.toString());
          }
            .width(this.frameViewport().width).height(this.frameViewport().height)
            .position({ x: this.frameViewport().left, y: this.frameViewport().top })
            .hitTestBehavior(HitTestMode.Transparent);
        }
      }
    }.id(this.layoutOverlay?.id()).width('100%').height('100%').hitTestBehavior(HitTestMode.Default)
      .onAppear((): void => this.layoutOverlay?.mount(this.getUIContext()))
      .onDisAppear((): void => this.layoutOverlay?.unmount())
      .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.ALL])
      .customProperty('readerLayoutInvariant', typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD
        ? { role: 'modal-overlay', id: 'bottom-sheet', active: this.visible,
          intercepts: this.coverVisible, closeDurationMs: this.closeDurationMs() } as LayoutInvariantTag : undefined);
  }

  @Builder
  private frame(generation: number) {
    Column() {
      if (this.specId === 'bookshelf-book-action') {
        Scroll() { this.content(); }.width('100%').align(Alignment.TopStart).scrollBar(BarState.Auto);
      } else {
        this.content();
      }
    }.id(this.transitionNativeId()).width(Math.min(this.surfaceWidth, this.spec().maxWidth, this.frameViewport().width))
      .renderGroup(!this.opened || !this.visible)
      .constraintSize({ maxHeight: this.frameViewport().height })
      .backgroundEffect(undefined)
      .backgroundColor(this.frameMaterial().native ? Color.Transparent : readerAppColor(this.spec().hostBackgroundRole, this.scheme))
      .border(this.frameMaterial().native ? { width: 0, color: Color.Transparent } :
        { width: { top: this.spec().hostBorderWidth }, color: readerAppColor(this.spec().hostBorderRole, this.scheme) })
      .borderRadius({ topLeft: this.spec().borderRadius, topRight: this.spec().borderRadius })
      .shadow(this.frameMaterial().native ? undefined : this.frameShadow())
      .attributeModifier(new ReaderImmersiveMaterialModifier(this.frameMaterial(), readerNativeSurfaceOutline(this.scheme,
        { topLeft: this.spec().borderRadius, topRight: this.spec().borderRadius }, 'top'))).clip(true)
      .hitTestBehavior(HitTestMode.Default).focusable(true).focusScopeId(this.transitionNativeId(), true, false)
      .onAppear((): void => {
        if (!this.mounted || generation !== this.frameGeneration) return;
        this.frameAttached = true;
        if (readerTransitionsEnabled()) {
          const id = this.transitionNativeId();
          readerBeginTransition({ kind: 'surface', action: 'mount', subject: this.specId,
            scope: id, nodes: [id], axis: this.reduceMotion ? 'none' : 'y' });
        }
      })
      .onDisAppear((): void => {
        if (!this.mounted || generation !== this.frameGeneration) return;
        this.frameAttached = false;
        if (!this.visible && this.coverVisible) this.finishMotion(false, generation);
      })
      .transition(this.reduceMotion ? TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam()) :
        TransitionEffect.asymmetric(
          TransitionEffect.move(TransitionEdge.BOTTOM).animation(readerMotionAnimateParam('app.sheet.open', false)),
          TransitionEffect.move(TransitionEdge.BOTTOM).animation(readerMotionAnimateParam('app.sheet.close', false))),
        (entering: boolean): void => this.finishMotion(entering, generation));
  }

  private transitionNativeId(): string {
    return this.nativeId.length > 0 ? this.nativeId : `reader-transition-sheet:${this.layoutModalId}`;
  }

  private finishMotion(entering: boolean, generation: number): void {
    if (!this.mounted || generation !== this.frameGeneration) return;
    if (!entering && !this.visible) {
      this.clearCloseTimeout();
      this.frameAttached = false;
      this.coverVisible = false;
      this.reportLayoutModal();
    } else if (entering && this.visible && this.coverVisible && this.coverReady && !this.opened) {
      this.opened = true;
      try { this.getUIContext().getFocusController().requestFocus(this.transitionNativeId()); } catch (_) {}
      this.onOpened();
    }
  }

  private spec(): SheetSurfaceSpec { return resolveSheetSpec(this.specId); }

  private frameMaterial(): ReaderSurfaceMaterialDecision {
    return readerSurfaceMaterialDecision('modalSheet', this.appearancePreferences, this.scheme, this.systemScheme);
  }

  private frameViewport(): ReaderRectVp {
    this.metricsRevision;
    return readerOverlayViewport(readerWindowMetrics());
  }

  private frameShadow(): ShadowOptions {
    this.metricsRevision;
    return readerSurfaceElevation(this.spec().hostElevation, this.scheme);
  }

}
