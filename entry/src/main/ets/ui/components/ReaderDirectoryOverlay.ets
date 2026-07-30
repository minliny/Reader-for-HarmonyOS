// ReaderDirectoryOverlay — canonical composition for the Figma-bound
// reader.module.directory semantic overlay.
//
// ReaderBase remains owned by the admitted reading-surface route. This
// component contributes only the Directory overlay layers and is reachable
// exclusively through OverlayHost's generated admission gate.
import { ReaderControlDismissZone, ReaderTopArea } from './ReaderComponents';
import { ReaderBottomBar, ReaderDirectoryPanel } from './ReaderOverlayComponents';

@Component
export struct ReaderDirectoryOverlay {
  build() {
    Stack() {
      ReaderControlDismissZone()
      ReaderTopArea()
      ReaderDirectoryPanel()
      ReaderBottomBar()
    }
    .width('100%')
    .height('100%')
    .hitTestBehavior(HitTestMode.Default)
  }
}
