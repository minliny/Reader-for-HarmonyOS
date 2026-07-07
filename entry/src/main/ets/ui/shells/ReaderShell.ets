// ReaderShell — 5-slot shell for the reading surface.
// Slots: readingSurface · readerOverlayHost · bottomSheetHost · readerModuleNav · readerStateHost.
// The reading surface is a Stack of background / text flow / info layer / tap zones;
// control layer, overlays, bottom sheet and state all hang off shell slots.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { ReadingBackgroundLayer, ReadingTextFlow, ReadingInfoLayer, TapZones, ReaderModuleNav } from '../components/ReaderComponents';
import { OverlayHost } from '../slots/OverlayHost';
import { StateHost } from '../slots/StateHost';

@Component
export struct ReaderShell {
  static readonly SLOT_NAMES: string[] = ['readingSurface', 'readerOverlayHost', 'bottomSheetHost', 'readerModuleNav', 'readerStateHost'];
  @StorageProp('reader.overlay') overlayKind: string = '';

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      // 1. readingSurface (z=0)
      Stack() {
        ReadingBackgroundLayer()
        ReadingTextFlow()
        ReadingInfoLayer()
        TapZones()
      }
      .width('100%')
      .height('100%')
      .zIndex(ZIndexTokens.content)

      // 2. bottomSheetHost (Phase 2 fills; placeholder slot kept for slot discipline)
      Column() { }
      .width('100%')
      .zIndex(ZIndexTokens.bottomSheet)

      // 3. readerModuleNav — only when the control-layer overlay is active.
      //    Contract: reader is immersive by default; module-nav is part of the
      //    control-layer, not the base reading surface.
      if (this.overlayKind === 'reader-control') {
        ReaderModuleNav()
          .zIndex(ZIndexTokens.readerModuleNav)
      }

      // 4. readerOverlayHost
      OverlayHost()
        .zIndex(ZIndexTokens.overlay)

      // 5. readerStateHost
      StateHost()
        .zIndex(ZIndexTokens.mainNav)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(ColorTokens.paper)
  }
}
