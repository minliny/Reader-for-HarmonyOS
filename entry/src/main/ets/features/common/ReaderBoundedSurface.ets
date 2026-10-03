import { readerAppColor } from './ReaderThemeRegistry';
import { PopupSurfaceSpec, resolvePopupSpec, resolveSheetSpec, resolveDialogSpec } from './ReaderSurfaceSpecs';

export type ReaderBoundedSurfaceId = 'source-switch-window' | 'tts-config-manager' | 'tts-config-picker' | 'bookshelf-book-action' | 'local-import-selection' | 'local-import-progress' | 'local-import-result-content' | 'reader-replace-editor';

/** Bounded existing modal/popup frames only. Width/height are the original
 * owner's measured viewport geometry; visual choices are finite spec IDs.
 * The native/content-cover host, tasks and lifecycle stay with the caller. */
/** Finite spec adapter shared by both column and fixed-position stack
 * roots. Geometry inputs belong to bounded modal owners; the book sheet
 * always consumes its registered height and full-width native host contract. */
export class ReaderBoundedFrameModifier implements AttributeModifier<CommonAttribute> {
  private readonly id: ReaderBoundedSurfaceId;
  private readonly width: number | string;
  private readonly height: number;
  private readonly scheme: string;
  constructor(id: ReaderBoundedSurfaceId, width: number | string, height: number, scheme: string) {
    this.id = id; this.width = width; this.height = height; this.scheme = scheme;
  }
  applyNormalAttribute(instance: CommonAttribute): void {
    if (this.id === 'local-import-selection' || this.id === 'local-import-progress' || this.id === 'local-import-result-content') {
      const spec = resolveDialogSpec('local-import');
      instance.width(this.width).height(this.height);
      if (this.id !== 'local-import-result-content') instance.backgroundColor(readerAppColor(spec.backgroundRole, this.scheme))
        .borderRadius(spec.borderRadius).shadow({ radius: 50,
          color: readerAppColor(this.id === 'local-import-selection' ? 'app.LocalImportDialog.fileSelectionPanel.color.40000000' : 'app.LocalImportDialog.build.color.40000000', this.scheme), offsetX: 0, offsetY: 25 });
      return;
    }
    if (this.id === 'reader-replace-editor') {
      instance.width(this.width).height(this.height).padding(12)
        .backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.scheme)).borderRadius(12);
      return;
    }
    if (this.id === 'bookshelf-book-action') {
      const spec = resolveSheetSpec('bookshelf-book-action');
      instance.width('100%').height(spec.height)
        .backgroundColor(readerAppColor(spec.backgroundRole, this.scheme))
        .border({ width: spec.borderWidth, color: readerAppColor(spec.borderRole, this.scheme) })
        .borderRadius({ topLeft: spec.borderRadius, topRight: spec.borderRadius, bottomLeft: 0, bottomRight: 0 })
        .shadow({ radius: spec.shadowRadius, color: readerAppColor(spec.shadowRole, this.scheme), offsetX: 0, offsetY: spec.shadowOffsetY }).clip(true);
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
        color: readerAppColor(this.id === 'tts-config-picker' ? 'app.ReaderTtsConfigOverlay.build.color.381F1B17' : spec.surfaceShadowRole, this.scheme),
        offsetY: this.id === 'tts-config-picker' ? 14 : spec.shadowOffsetY,
      }).clip(true);
  }
}

@Component
export struct ReaderBoundedSurface {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop specId: ReaderBoundedSurfaceId = 'source-switch-window';
  @Prop width: number | string = 300;
  @Prop height: number = 385;
  @BuilderParam header: () => void = this.emptySlot;
  @BuilderParam body: () => void = this.emptySlot;
  @BuilderParam actions: () => void = this.emptySlot;

  @Builder private emptySlot() {}

  build() {
    if (this.specId === 'bookshelf-book-action') {
      Stack({ alignContent: Alignment.TopStart }) { this.header(); this.body(); this.actions(); }
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
    return new ReaderBoundedFrameModifier(this.specId, this.width, this.height, this.appThemeScheme);
  }
}
