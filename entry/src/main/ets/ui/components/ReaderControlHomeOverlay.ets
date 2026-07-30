// ReaderControlHomeOverlay — canonical composition for the Figma-bound
// reader.control-home overlay.
//
// ReaderBase remains owned by the admitted reading-surface route. This
// component contributes only the three control-home layers that Figma composes
// over that surface. OverlayHost guards this component with generated visual
// admission, so candidate-backport remains non-emitting before B4 promotion.
import { ReaderTopArea } from './ReaderComponents';
import { ReaderBottomBar, ReaderControlSheet } from './ReaderOverlayComponents';

@Component
export struct ReaderControlHomeOverlay {
  build() {
    Stack() {
      ReaderTopArea()
      ReaderControlSheet()
      ReaderBottomBar()
    }
    .width('100%')
    .height('100%')
    .hitTestBehavior(HitTestMode.Transparent)
  }
}
