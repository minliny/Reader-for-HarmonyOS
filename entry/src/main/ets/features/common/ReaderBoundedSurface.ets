import { readerAppColor } from './ReaderThemeRegistry';
import { PopupSurfaceSpec, resolvePopupSpec, resolveSheetSpec, resolveDialogSpec, resolveDrawerSpec } from './ReaderSurfaceSpecs';
import { ReaderInsetsVp } from './ReaderWindowMetrics';

export type ReaderBoundedSurfaceId = 'source-switch-window' | 'source-switch-drawer' | 'reader-action-sheet' | 'tts-config-manager' | 'tts-config-picker' | 'bookshelf-book-action' | 'local-import-selection' | 'local-import-progress' | 'local-import-result-content' | 'reader-replace-editor';

/** Bounded existing modal/popup frames only. Width/height are the original
 * owner's measured viewport geometry; visual choices are finite spec IDs.
 * The native/content-cover host, tasks and lifecycle stay with the caller. */
/** Finite spec adapter shared by both column and fixed-position stack
 * roots. Geometry inputs belong to bounded modal owners; the native book
 * Sheet paints its one frame and measures its normal-flow content. */
export class ReaderBoundedFrameModifier implements AttributeModifier<CommonAttribute> {
  private readonly id: ReaderBoundedSurfaceId;
  private readonly width: number | string;
  private readonly height: number;
  private readonly scheme: string;
  private readonly placement: 'bottom' | 'side';
  private readonly maxHeight: number;
  private readonly insets: ReaderInsetsVp;
  constructor(id: ReaderBoundedSurfaceId, width: number | string, height: number, scheme: string,
    placement: 'bottom' | 'side' = 'bottom', maxHeight: number = 0, insets: ReaderInsetsVp = new ReaderInsetsVp(0, 0, 0, 0)) {
    this.id = id; this.width = width; this.height = height; this.scheme = scheme;
    this.placement = placement; this.maxHeight = maxHeight; this.insets = insets;
  }
  applyNormalAttribute(instance: CommonAttribute): void {
    if (this.id === 'source-switch-drawer') {
      const spec = resolveDrawerSpec(this.id);
      instance.width(this.width).height(this.height).constraintSize({ maxWidth: spec.maxWidth })
        .backgroundColor(readerAppColor(spec.surfaceRole, this.scheme))
        .borderRadius({ topLeft: spec.cornerRadius, topRight: spec.cornerRadius }).clip(true);
      return;
    }
    if (this.id === 'reader-action-sheet') {
      const spec = resolveDrawerSpec(this.id); const side = this.placement === 'side';
      const contentMax = Math.max(1, this.maxHeight - this.insets.top - this.insets.bottom);
      instance.width(this.width).height(side ? this.height : undefined)
        .constraintSize({ minHeight: side ? 0 : Math.min(spec.minimumContentHeight, contentMax) + this.insets.top + this.insets.bottom, maxHeight: this.maxHeight })
        .padding({ left: this.insets.left, right: this.insets.right, top: this.insets.top, bottom: this.insets.bottom })
        .backgroundColor(readerAppColor(spec.surfaceRole, this.scheme))
        .border(side ? { width: { left: 1 }, color: readerAppColor(spec.lineRole, this.scheme) } : undefined)
        .borderRadius({ topLeft: side ? 0 : spec.cornerRadius, topRight: side ? 0 : spec.cornerRadius, bottomLeft: 0, bottomRight: 0 })
        .hitTestBehavior(HitTestMode.Block)
        .shadow({ radius: 0, color: Color.Transparent, offsetX: 0, offsetY: 0 })
        .clip(true);
      return;
    }
    if (this.id === 'local-import-selection' || this.id === 'local-import-progress' || this.id === 'local-import-result-content') {
      const spec = resolveDialogSpec('local-import');
      instance.width(this.width).height(this.height);
      if (this.id !== 'local-import-result-content') instance.backgroundColor(readerAppColor(spec.backgroundRole, this.scheme))
        .borderRadius(spec.borderRadius).shadow({ radius: 50,
          color: readerAppColor(this.id === 'local-import-selection' ? 'app.shadow.dialog' : 'app.shadow.dialog', this.scheme), offsetX: 0, offsetY: 25 });
      return;
    }
    if (this.id === 'reader-replace-editor') {
      instance.width(this.width).height(this.height).padding(12)
        .backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.scheme)).borderRadius(12);
      return;
    }
    if (this.id === 'bookshelf-book-action') {
      const spec = resolveSheetSpec('bookshelf-book-action');
      // Native bindSheet owns the opaque paper, radius, clipping and safe
      // bottom. A second fixed box would distort FIT_CONTENT and crop rows.
      instance.width('100%').padding({ bottom: spec.contentBottom });
      return;
    }
    const spec = resolvePopupSpec(this.id === 'source-switch-window' ? 'source-switch-window' : 'tts-config-manager');
    instance.width(this.width).height(this.height)

      .backgroundColor(readerAppColor(spec.surfaceBackgroundRole, this.scheme))
      .border({ width: spec.borderWidth, color: readerAppColor(spec.surfaceBorderRole, this.scheme) })
      .borderRadius(this.id === 'tts-config-picker' ? 14 : spec.borderRadius)
;
    if (this.id !== 'source-switch-window') instance.constraintSize({
      maxWidth: this.id === 'tts-config-manager' ? spec.width : this.width, maxHeight: '100%',
    }).shadow({
        radius: this.id === 'tts-config-picker' ? 36 : spec.shadowRadius,
        color: readerAppColor(this.id === 'tts-config-picker' ? 'app.shadow.readerConfigSecondary' : spec.surfaceShadowRole, this.scheme),
        offsetY: this.id === 'tts-config-picker' ? 14 : spec.shadowOffsetY,
      }).clip(true);
  }
}

@Component
export struct ReaderBoundedSurface {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
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
    if (this.specId === 'bookshelf-book-action') {
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
    return new ReaderBoundedFrameModifier(this.specId, this.surfaceWidth, this.surfaceHeight,
      this.scheme === 'auto' ? this.appThemeScheme : this.scheme, this.placement, this.maxSurfaceHeight, this.safeInsets);
  }
}
