// MainTabShell — 5-slot shell for the 4 main tabs (bookshelf / discover / rss / settings).
// Slots: topArea (AppTopBar) · content (ViewStateRenderer) · tabNav (BottomNav) ·
// overlayHost (OverlayHost) · stateHost (StateHost).
// Overlays and page-state layers hang off shell slots, never inside page components.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { SpacingTokens, ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { AppTopBar, BottomNav } from '../components/SharedComponents';
import { ViewStateRenderer } from '../components/ViewStateRenderer';
import { OverlayHost } from '../slots/OverlayHost';
import { StateHost } from '../slots/StateHost';

@Component
export struct MainTabShell {
  static readonly SLOT_NAMES: string[] = ['topArea', 'content', 'tabNav', 'overlayHost', 'stateHost'];

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        AppTopBar()
        Scroll() {
          ViewStateRenderer()
        }
        .layoutWeight(1)
        .align(Alignment.Top)
        .padding({ left: SpacingTokens.screenPadding, right: SpacingTokens.screenPadding })
        .backgroundColor(ColorTokens.paper)
        BottomNav()
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
