// ReaderShell — 5-slot shell for the reading surface.
// Slots: readingSurface · readerOverlayHost · bottomSheetHost · readerModuleNav · readerStateHost.
// The reading surface is a Stack of background / text flow / info layer / tap zones;
// control layer, overlays, bottom sheet and state all hang off shell slots.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { ReadingBackgroundLayer, ReadingTextFlow, ReadingInfoLayer, TapZones, ReaderModuleNav } from '../components/ReaderComponents';
import { OverlayHost } from '../slots/OverlayHost';
import { StateHost } from '../slots/StateHost';

@Component
export struct ReaderShell {
  static readonly SLOT_NAMES: string[] = ['readingSurface', 'readerOverlayHost', 'bottomSheetHost', 'readerModuleNav', 'readerStateHost'];

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      // 1. readingSurface
      Stack() {
        ReadingBackgroundLayer()
        ReadingTextFlow()
        ReadingInfoLayer()
        TapZones()
      }
      .width('100%')
      .height('100%')

      // 2. bottomSheetHost (Phase 2 fills; placeholder slot kept for slot discipline)
      Column() { }
      .width('100%')

      // 3. readerModuleNav
      ReaderModuleNav()

      // 4. readerOverlayHost
      OverlayHost()

      // 5. readerStateHost
      StateHost()
    }
    .width('100%')
    .height('100%')
    .backgroundColor(ColorTokens.paper)
  }
}
