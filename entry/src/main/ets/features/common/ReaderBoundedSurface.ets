import { readerAppColor } from './ReaderThemeRegistry';
import { PopupSurfaceSpec, resolvePopupSpec, resolveSheetSpec } from './ReaderSurfaceSpecs';

export type ReaderBoundedSurfaceId = 'source-switch-window' | 'tts-config-manager' | 'tts-config-picker' | 'bookshelf-book-action';

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
      .constraintSize(this.id === 'source-switch-window' ? {} : {
        maxWidth: this.id === 'tts-config-manager' ? spec.width : this.width, maxHeight: '100%',
      })
      .backgroundColor(readerAppColor(spec.surfaceBackgroundRole, this.scheme))
      .border({ width: spec.borderWidth, color: readerAppColor(spec.surfaceBorderRole, this.scheme) })
      .borderRadius(this.id === 'tts-config-picker' ? 14 : spec.borderRadius)
      .shadow(this.id === 'source-switch-window' ? undefined : {
        radius: this.id === 'tts-config-picker' ? 36 : spec.shadowRadius,
        color: readerAppColor(this.id === 'tts-config-picker' ? 'app.ReaderTtsConfigOverlay.build.color.381F1B17' : spec.surfaceShadowRole, this.scheme),
        offsetY: this.id === 'tts-config-picker' ? 14 : spec.shadowOffsetY,
      }).clip(this.id !== 'source-switch-window');
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
    } else {
      Column({ space: 0 }) { this.header(); this.body(); this.actions(); }
        .attributeModifier(this.frameModifier());
    }
  }

  private frameModifier(): AttributeModifier<CommonAttribute> {
    return new ReaderBoundedFrameModifier(this.specId, this.width, this.height, this.appThemeScheme);
  }
}
