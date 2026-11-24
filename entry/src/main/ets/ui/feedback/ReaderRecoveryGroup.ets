import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { readerSurfaceElevation } from '../surfaces/ReaderSurfaceSpecs';

/** One visual surface for independent original-operation notices in one host.
 * The supplied children retain their own identity, generation and admission. */
@Component
export struct ReaderRecoveryGroup {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @BuilderParam content: () => void = this.emptyContent;

  @Builder private emptyContent() {}

  build() {
    Column() { this.content(); }
      .width('100%').padding({ left: 12, right: 12, top: 10, bottom: 10 })
      .borderRadius(14).backgroundColor(readerAppColor('TOK_SURFACE_ELEVATED', this.appThemeScheme))
      .border({ width: 1, color: readerAppColor('TOK_PRIMARY_BORDER', this.appThemeScheme) })
      .shadow(readerSurfaceElevation('popover', this.appThemeScheme))
      .hitTestBehavior(HitTestMode.Default);
  }
}
