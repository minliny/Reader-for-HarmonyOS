import type { ReaderNavigationPreferences, ReaderSurfaceMaterialDecision } from '../../app/HarmonyCapabilityPolicy';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { READER_GLASS_BLUR_VP, READER_HEAVY_GLASS_BLUR_VP, readerSurfaceElevation,
  resolvePopupSpec, resolveSheetSpec, resolveDialogSpec, resolveDrawerSpec,
  type SheetSpecId } from './ReaderSurfaceSpecs';
import { ReaderInsetsVp } from '../foundation/ReaderWindowMetrics';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { READER_LAYOUT_DEBUG_BUILD, READER_LAYOUT_SURFACE_HINT, newReaderLayoutModalId } from '../foundation/ReaderLayoutInvariantSignals';
import { readerBeginTransition, readerTransitionsEnabled } from '../foundation/ReaderTransitionSignals';
import type { LayoutInvariantSurfaceHint } from '../layout/LayoutInvariantNativeAudit';
import type { ReaderTransitionAxis } from '../layout/TransitionInvariantEvaluator';
import { applyReaderImmersiveMaterial, defaultNavigationPreferences, readerSurfaceMaterialDecision,
  READER_NO_SHADOW } from './ReaderSurfaceMaterial';

export type ReaderBoundedSurfaceId = 'source-switch-window' | 'source-switch-drawer' | 'reader-action-sheet' | 'tts-config-manager' | 'tts-config-picker' | SheetSpecId | 'local-import-selection' | 'local-import-progress' | 'local-import-result-content' | 'reader-replace-editor';

/** Bounded existing modal/popup frames only. Width/height are the original
 * owner's measured viewport geometry; visual choices are finite spec IDs.
 * The native/content-cover host, tasks and lifecycle stay with the caller. */
/** Finite spec adapter shared by both column and fixed-position stack
 * roots. Geometry inputs belong to bounded modal owners. */
export class ReaderBoundedFrameModifier implements AttributeModifier<CommonAttribute> {
  private readonly id: ReaderBoundedSurfaceId;
  private readonly width: number | string;
  private readonly height: number;
  private readonly scheme: string;
  private readonly placement: 'bottom' | 'side';
  private readonly maxHeight: number;
  private readonly insets: ReaderInsetsVp;
  private readonly material: ReaderSurfaceMaterialDecision | undefined;
  constructor(id: ReaderBoundedSurfaceId, width: number | string, height: number, scheme: string,
    placement: 'bottom' | 'side' = 'bottom', maxHeight: number = 0,
    insets: ReaderInsetsVp = new ReaderInsetsVp(0, 0, 0, 0), material?: ReaderSurfaceMaterialDecision) {
    this.id = id; this.width = width; this.height = height; this.scheme = scheme;
    this.placement = placement; this.maxHeight = maxHeight; this.insets = insets;
    this.material = material;
  }
  applyNormalAttribute(instance: CommonAttribute): void {
    const maxHeight = this.maxHeight > 0 ? this.maxHeight : '100%';
    const height = this.height > 0 ? this.height : undefined;
    if (this.id === 'source-switch-drawer') {
      const spec = resolveDrawerSpec(this.id);
      instance.width(this.width).height(height).constraintSize({ maxWidth: '100%', maxHeight });
      this.applyMaterialFrame(instance, { radius: READER_HEAVY_GLASS_BLUR_VP, color: readerAppColor(spec.surfaceRole, this.scheme) },
        { width: this.placement === 'side' ? { left: 1 } : { top: 1 }, color: readerAppColor(spec.lineRole, this.scheme) },
        readerSurfaceElevation('sheet', this.scheme));
      instance.borderRadius(this.placement === 'side' ? { topLeft: 22, bottomLeft: 22, topRight: 0, bottomRight: 0 } :
        { topLeft: spec.cornerRadius, topRight: spec.cornerRadius }).clip(true);
      return;
    }
    if (this.id === 'reader-action-sheet') {
      const spec = resolveDrawerSpec(this.id); const side = this.placement === 'side';
      const paddingTop = this.maxHeight > 0 ? Math.min(this.insets.top, this.maxHeight) : this.insets.top;
      const paddingBottom = this.maxHeight > 0 ? Math.min(this.insets.bottom, this.maxHeight - paddingTop) : this.insets.bottom;
      const insetHeight = paddingTop + paddingBottom;
      const minimumHeight = this.maxHeight > 0 ? Math.min(this.maxHeight, spec.minimumContentHeight + insetHeight) : insetHeight;
      instance.width(this.width).height(side ? height : undefined)
        .constraintSize({ maxWidth: '100%', minHeight: side ? 0 : minimumHeight, maxHeight })
        .padding({ left: this.insets.left, right: this.insets.right, top: paddingTop, bottom: paddingBottom });
      this.applyMaterialFrame(instance, { radius: READER_HEAVY_GLASS_BLUR_VP, color: readerAppColor(spec.surfaceRole, this.scheme) },
        side ? { width: { left: 1 }, color: readerAppColor(spec.lineRole, this.scheme) } : undefined, READER_NO_SHADOW);
      instance.borderRadius({ topLeft: side ? 0 : spec.cornerRadius, topRight: side ? 0 : spec.cornerRadius, bottomLeft: 0, bottomRight: 0 })
        .hitTestBehavior(HitTestMode.Default).clip(true);
      return;
    }
    if (this.id === 'source-switch-window') {
      const spec = resolvePopupSpec(this.id);
      instance.width(this.width).height(height).constraintSize({ maxWidth: '100%', maxHeight });
      this.applyMaterialFrame(instance, { radius: READER_GLASS_BLUR_VP, color: readerAppColor(spec.surfaceBackgroundRole, this.scheme) },
        { width: spec.borderWidth, color: readerAppColor(spec.surfaceBorderRole, this.scheme) });
      instance.borderRadius(spec.borderRadius);
      return;
    }
    if (this.id === 'local-import-selection' || this.id === 'local-import-progress' || this.id === 'local-import-result-content') {
      const spec = resolveDialogSpec('local-import');
      instance.width(this.width).height(height).constraintSize({ maxWidth: '100%', maxHeight });
      if (this.id !== 'local-import-result-content') instance.backgroundColor(readerAppColor(spec.backgroundRole, this.scheme))
        .border({ width: 1, color: readerAppColor('TOK_LINE', this.scheme) })
        .borderRadius(spec.borderRadius).shadow(readerSurfaceElevation('dialog', this.scheme));
      return;
    }
    if (this.id === 'reader-replace-editor') {
      instance.width(this.width).height(height).constraintSize({ maxWidth: '100%', maxHeight }).padding(12)
        .backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.scheme)).borderRadius(12);
      return;
    }
    if (this.id === 'bookshelf-book-action' || this.id === 'search-result-filter' || this.id === 'search-task-status') {
      const spec = resolveSheetSpec(this.id);
      // ReaderBottomSheet owns the one frame and safe bottom.
      instance.width('100%').padding({ bottom: spec.contentBottom });
      return;
    }
    const spec = resolvePopupSpec('tts-config-manager');
    const density = readerWindowMetrics().densityPixels;
    instance.width(this.width).height(height)
      .backgroundColor(readerAppColor(spec.surfaceBackgroundRole, this.scheme))
      .border({ width: spec.borderWidth, color: readerAppColor(spec.surfaceBorderRole, this.scheme) })
      .borderRadius(this.id === 'tts-config-picker' ? 14 : spec.borderRadius)
      .constraintSize({ maxWidth: '100%', maxHeight }).shadow({
        radius: (this.id === 'tts-config-picker' ? 36 : spec.shadowRadius) * density,
        color: readerAppColor(this.id === 'tts-config-picker' ? 'app.shadow.readerConfigSecondary' : spec.surfaceShadowRole, this.scheme),
        offsetY: (this.id === 'tts-config-picker' ? 14 : spec.shadowOffsetY) * density,
      }).clip(true);
  }

  private applyMaterialFrame(instance: CommonAttribute, background: BackgroundEffectOptions,
    border: BorderOptions | undefined, shadow?: ShadowOptions): void {
    const native = this.material?.native === true;
    const solidFallback = !native && this.material?.performanceMode === true;
    instance.backgroundEffect(native || solidFallback ? undefined : background)
      .backgroundColor(solidFallback ? readerAppColor('TOK_SURFACE_SOLID', this.scheme) : Color.Transparent)
      .border(native ? { width: 0, color: Color.Transparent } : border)
      .shadow(native ? undefined : shadow);
    applyReaderImmersiveMaterial(instance, this.material);
  }
}

@Component
export struct ReaderBoundedSurface {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerSystemScheme') private systemScheme: string = 'day';
  @StorageProp('readerNavigationAppearancePreferences') private appearancePreferences: ReaderNavigationPreferences =
    defaultNavigationPreferences();
  @Prop specId: ReaderBoundedSurfaceId = 'source-switch-window';
  @Prop surfaceWidth: number | string = 300;
  @Prop surfaceHeight: number = 385;
  @Prop maxSurfaceHeight: number = 0;
  @Prop placement: 'bottom' | 'side' = 'bottom';
  @Prop scheme: 'auto' | 'day' | 'night' = 'auto';
  @Prop safeInsets: ReaderInsetsVp = new ReaderInsetsVp(0, 0, 0, 0);
  @BuilderParam header: () => void = this.emptySlot;
  @BuilderParam body: () => void = this.emptySlot;
  @BuilderParam actions: () => void = this.emptySlot;
  private readonly transitionId: number = READER_LAYOUT_DEBUG_BUILD ? newReaderLayoutModalId() : 0;

  @Builder private emptySlot() {}

  private transitionNativeId(): string | undefined {
    if (!readerTransitionsEnabled() || this.specId === 'tts-config-picker' || this.specId === 'tts-config-manager') return undefined;
    return `reader-transition-bounded:${this.transitionId}`;
  }

  private observeMount(): void {
    const id = this.transitionNativeId();
    if (id === undefined) return;
    const drawer = this.specId === 'source-switch-drawer' || this.specId === 'reader-action-sheet';
    const axis: ReaderTransitionAxis = drawer ? this.placement === 'side' ? 'x' : 'y' : 'none';
    readerBeginTransition({ kind: 'surface', action: 'mount', subject: this.specId, scope: id, nodes: [id], axis,
      layoutBounds: this.specId === 'local-import-selection' || this.specId === 'local-import-progress' });
  }

  private layoutAuditHint(): LayoutInvariantSurfaceHint | undefined {
    if (!READER_LAYOUT_DEBUG_BUILD) return undefined;
    if (this.specId === 'local-import-selection') return { placement: 'center', dialog: true, contentMeasured: true };
    if (this.specId === 'source-switch-drawer') return {
      placement: this.placement === 'side' ? 'side-end' : 'bottom-center', dialog: true, windowEdge: true,
    };
    return undefined;
  }

  build() {
    if (this.specId === 'bookshelf-book-action' || this.specId === 'search-result-filter' || this.specId === 'search-task-status') {
      Column({ space: 0 }) { this.header(); this.body(); this.actions(); }.alignItems(HorizontalAlign.Start)
        .attributeModifier(this.frameModifier()).id(this.transitionNativeId()).onAppear((): void => this.observeMount());
    } else if (this.specId === 'local-import-progress') {
      Stack({ alignContent: Alignment.Center }) { this.header(); this.body(); this.actions(); }
        .attributeModifier(this.frameModifier()).id(this.transitionNativeId()).onAppear((): void => this.observeMount());
    } else if (this.specId === 'local-import-result-content') {
      Column() { this.header(); this.body(); this.actions(); }.alignItems(HorizontalAlign.Start)
        .attributeModifier(this.frameModifier()).id(this.transitionNativeId()).onAppear((): void => this.observeMount());
    } else {
      Column({ space: this.specId === 'reader-replace-editor' ? 8 : 0 }) { this.header(); this.body(); this.actions(); }
        .attributeModifier(this.frameModifier()).id(this.transitionNativeId())
        .customProperty(READER_LAYOUT_SURFACE_HINT, this.layoutAuditHint()).onAppear((): void => this.observeMount());
    }
  }

  private frameModifier(): AttributeModifier<CommonAttribute> {
    const role = this.specId === 'source-switch-window' ? 'popoverMenu' :
      this.specId === 'source-switch-drawer' || this.specId === 'reader-action-sheet' ? 'modalSheet' : undefined;
    const effectiveScheme = this.scheme === 'auto' ? this.appThemeScheme : this.scheme;
    return new ReaderBoundedFrameModifier(this.specId, this.surfaceWidth, this.surfaceHeight,
      effectiveScheme, this.placement, this.maxSurfaceHeight, this.safeInsets,
      role === undefined ? undefined : readerSurfaceMaterialDecision(role, this.appearancePreferences,
        effectiveScheme, this.systemScheme));
  }
}
