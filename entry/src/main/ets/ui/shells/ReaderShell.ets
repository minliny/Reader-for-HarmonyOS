// ReaderShell — 5-slot shell for the reading surface.
// Slots: readingSurface · readerOverlayHost · bottomSheetHost · readerModuleNav · readerStateHost.
// The reading surface is a Stack of background / text flow / info layer / tap zones;
// control layer, overlays, bottom sheet and state all hang off shell slots.
//
// Immersive: the outermost Stack and the readingSurface Stack both expand their
// background behind the system status / nav bars so the reading paper owns the
// whole screen (correct under a future night theme, not just the default paper).
// Control-layer components (ReaderModuleNav, info layer) avoid the bars via the
// real insets in their own padding — see ReaderComponents.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { ReadingBackgroundLayer, ReadingTextFlow, ReadingInfoLayer, TapZones, ReaderControlDock, ReaderModuleSheet, SessionCapsule } from '../components/ReaderComponents';
import { OverlayHost } from '../slots/OverlayHost';
import { StateHost } from '../slots/StateHost';

@Component
export struct ReaderShell {
  static readonly SLOT_NAMES: string[] = ['readingSurface', 'readerOverlayHost', 'bottomSheetHost', 'readerModuleNav', 'readerStateHost'];
  @StorageProp('reader.overlay') overlayKind: string = '';

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      // 1. readingSurface (z=0) — expands behind the status / nav bars (immersive).
      Stack() {
        ReadingBackgroundLayer()
        ReadingTextFlow()
        ReadingInfoLayer()
        TapZones()
        SessionCapsule()
      }
      .width('100%')
      .height('100%')
      .zIndex(ZIndexTokens.content)
      .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
        [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])

      // 2/3. bottomSheetHost + readerModuleNav — visible only when the reader
      //      control layer is active. The dock owns the grabber, compact controls,
      //      module nav, and bottom safe-area avoidance as one reader control unit.
      if (this.overlayKind === 'reader-control') {
        ReaderControlDock()
          .zIndex(ZIndexTokens.readerModuleNav)
      }

      // 2b. reader module bottom sheets (目录/外观/朗读/设置) — rendered above the
      //     dock when a module is open. Closing returns to the reader-control dock.
      ReaderModuleSheet()
        .zIndex(ZIndexTokens.bottomSheet)

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
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}
