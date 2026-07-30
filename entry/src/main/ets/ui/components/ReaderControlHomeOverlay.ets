// ReaderControlHomeOverlay — canonical composition for the Figma-bound
// reader.control-home overlay.
//
// ReaderBase remains owned by the admitted reading-surface route. This
// component contributes only the three control-home layers that Figma composes
// over that surface. OverlayHost guards this component with generated visual
// admission, so candidate-backport remains non-emitting before B4 promotion.
import { ReaderControlDismissZone, ReaderTopArea } from './ReaderComponents';
import { ReaderBottomBar, ReaderControlSheet } from './ReaderOverlayComponents';

@Component
export struct ReaderControlHomeOverlay {
  build() {
    Stack() {
      // Canonical Reader-UI `data-reader-dismiss` layer. It is deliberately
      // first in the Stack so the Figma-bound controls remain the foreground
      // hit targets while taps in the exposed reading area hide this overlay.
      ReaderControlDismissZone()
      ReaderTopArea()
      ReaderControlSheet()
      ReaderBottomBar()
    }
    .width('100%')
    .height('100%')
    // The dismiss zone is the sole owner of exposed-area taps while controls
    // are visible. Passing the same tap through to vertical ReadingTextFlow
    // would dispatch the toggle twice (hide, then immediately show again).
    .hitTestBehavior(HitTestMode.Default)
  }
}
