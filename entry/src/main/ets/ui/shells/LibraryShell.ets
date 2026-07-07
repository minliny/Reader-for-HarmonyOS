// LibraryShell — shell for library/secondary pages (book-detail, search, rss-detail, …).
// Slots: topArea (BackTopBar) · content (ViewStateRenderer) · overlayHost · stateHost.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { SpacingTokens, ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { BackTopBar } from '../components/SharedComponents';
import { ViewStateRenderer } from '../components/ViewStateRenderer';
import { OverlayHost } from '../slots/OverlayHost';
import { StateHost } from '../slots/StateHost';

@Component
export struct LibraryShell {
  static readonly SLOT_NAMES: string[] = ['topArea', 'content', 'overlayHost', 'stateHost'];

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        BackTopBar()
        Scroll() {
          ViewStateRenderer()
        }
        .layoutWeight(1)
        .align(Alignment.Top)
        .padding({ left: SpacingTokens.screenPadding, right: SpacingTokens.screenPadding })
        .backgroundColor(ColorTokens.paper)
      }
      .width('100%')
      .height('100%')
      .zIndex(ZIndexTokens.content)

      OverlayHost()
        .zIndex(ZIndexTokens.overlay)
      StateHost()
        .zIndex(ZIndexTokens.mainNav)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(ColorTokens.paper)
  }
}
