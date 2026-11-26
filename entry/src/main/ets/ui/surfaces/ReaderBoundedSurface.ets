import type { ReaderNavigationPreferences, ReaderSurfaceMaterialDecision } from '../../app/HarmonyCapabilityPolicy';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { READER_GLASS_BLUR_VP, READER_HEAVY_GLASS_BLUR_VP, readerSurfaceElevation,
  resolvePopupSpec, resolveSheetSpec, resolveDialogSpec, resolveDrawerSpec,
  type SheetSpecId } from './ReaderSurfaceSpecs';
import { ReaderInsetsVp } from '../foundation/ReaderWindowMetrics';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
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
    if (this.id === 'source-switch-drawer') {
      const spec = resolveDrawerSpec(this.id);
      instance.width(this.width).height(this.height);
      this.applyMaterialFrame(instance, { radius: READER_HEAVY_GLASS_BLUR_VP, color: readerAppColor(spec.surfaceRole, this.scheme) },
        { width: this.placement === 'side' ? { left: 1 } : { top: 1 }, color: readerAppColor(spec.lineRole, this.scheme) },
        readerSurfaceElevation('sheet', this.scheme));
      instance.borderRadius(this.placement === 'side' ? { topLeft: 22, bottomLeft: 22, topRight: 0, bottomRight: 0 } :
        { topLeft: spec.cornerRadius, topRight: spec.cornerRadius }).clip(true);
      return;
    }
    if (this.id === 'reader-action-sheet') {
      const spec = resolveDrawerSpec(this.id); const side = this.placement === 'side';
      const contentMax = Math.max(1, this.maxHeight - this.insets.top - this.insets.bottom);
      instance.width(this.width).height(side ? this.height : undefined)
        .constraintSize({ minHeight: side ? 0 : Math.min(spec.minimumContentHeight, contentMax) + this.insets.top + this.insets.bottom, maxHeight: this.maxHeight })
        .padding({ left: this.insets.left, right: this.insets.right, top: this.insets.top, bottom: this.insets.bottom });
      this.applyMaterialFrame(instance, { radius: READER_HEAVY_GLASS_BLUR_VP, color: readerAppColor(spec.surfaceRole, this.scheme) },
        side ? { width: { left: 1 }, color: readerAppColor(spec.lineRole, this.scheme) } : undefined, READER_NO_SHADOW);
      instance.borderRadius({ topLeft: side ? 0 : spec.cornerRadius, topRight: side ? 0 : spec.cornerRadius, bottomLeft: 0, bottomRight: 0 })
        .hitTestBehavior(HitTestMode.Default).clip(true);
      return;
    }
    if (this.id === 'source-switch-window') {
      const spec = resolvePopupSpec(this.id);
      instance.width(this.width).height(this.height);
      this.applyMaterialFrame(instance, { radius: READER_GLASS_BLUR_VP, color: readerAppColor(spec.surfaceBackgroundRole, this.scheme) },
        { width: spec.borderWidth, color: readerAppColor(spec.surfaceBorderRole, this.scheme) });
      instance.borderRadius(spec.borderRadius);
      return;
    }
    if (this.id === 'local-import-selection' || this.id === 'local-import-progress' || this.id === 'local-import-result-content') {
      const spec = resolveDialogSpec('local-import');
      instance.width(this.width).height(this.height);
      if (this.id !== 'local-import-result-content') instance.backgroundColor(readerAppColor(spec.backgroundRole, this.scheme))
        .border({ width: 1, color: readerAppColor('TOK_LINE', this.scheme) })
        .borderRadius(spec.borderRadius).shadow(readerSurfaceElevation('dialog', this.scheme));
      return;
    }
    if (this.id === 'reader-replace-editor') {
      instance.width(this.width).height(this.height).padding(12)
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
    instance.width(this.width).height(this.height)
      .backgroundColor(readerAppColor(spec.surfaceBackgroundRole, this.scheme))
      .border({ width: spec.borderWidth, color: readerAppColor(spec.surfaceBorderRole, this.scheme) })
      .borderRadius(this.id === 'tts-config-picker' ? 14 : spec.borderRadius)
      .constraintSize({ maxWidth: this.id === 'tts-config-manager' ? spec.width : this.width, maxHeight: '100%' }).shadow({
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

  @Builder private emptySlot() {}

  build() {
    if (this.specId === 'bookshelf-book-action' || this.specId === 'search-result-filter' || this.specId === 'search-task-status') {
      Column({ space: 0 }) { this.header(); this.body(); this.actions(); }.alignItems(HorizontalAlign.Start)
        .attributeModifier(this.frameModifier());
    } else if (this.specId === 'local-import-progress') {
      Stack({ alignContent: Alignment.Center }) { this.header(); this.body(); this.actions(); }
        .attributeModifier(this.frameModifier());
    } else if (this.specId === 'local-import-result-content') {
      Column() { this.header(); this.body(); this.actions(); }.alignItems(HorizontalAlign.Start)
        .attributeModifier(this.frameModifier());
    } else {
      Column({ space: this.specId === 'reader-replace-editor' ? 8 : 0 }) { this.header(); this.body(); this.actions(); }
        .attributeModifier(this.frameModifier());
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
