// MainTabShell — 5-slot shell for the 4 main tabs (bookshelf / discover / rss / settings).
// Skeleton ported from frontend-demo: .fd-phone-content (grid, gap 8, padding
// 8 / safeAreaH+3 / mainNav+safeBottom+34) + .fd-main-nav (absolute, floats at
// bottom: safeAreaBottom, left/right: safeAreaHorizontal-2).
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { SpacingTokens, SizeTokens, ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { AppTopBar, BottomNav } from '../components/SharedComponents';
import { ViewStateRenderer } from '../components/ViewStateRenderer';
import { OverlayHost } from '../slots/OverlayHost';
import { StateHost } from '../slots/StateHost';

@Component
export struct MainTabShell {
  static readonly SLOT_NAMES: string[] = ['topArea', 'content', 'tabNav', 'overlayHost', 'stateHost'];

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // content layer: top bar + scrollable body (.fd-phone-content)
      Column() {
        AppTopBar()
        Scroll() {
          ViewStateRenderer()
        }
        .layoutWeight(1)
        .align(Alignment.Top)
        .padding({
          top: 8,
          left: SpacingTokens.safeAreaHorizontal + 3,
          right: SpacingTokens.safeAreaHorizontal + 3,
          bottom: SizeTokens.mainNavHeight + SpacingTokens.safeAreaBottom + 34,
        })
        .backgroundColor(ColorTokens.paper)
      }
      .width('100%')
      .height('100%')
      .zIndex(ZIndexTokens.content)

      // floating main nav (.fd-main-nav: absolute, bottom safeAreaBottom,
      // left/right safeAreaHorizontal-2). Blank fills the top so the nav sits at
      // the bottom; hitTestBehavior Transparent lets taps pass through to content.
      // Inset (14px sides/bottom) is on this wrapper's padding so the nav width
      // = screen - 28 (width('100%') + margin would overflow, not inset).
      Column() {
        Blank()
          .layoutWeight(1)
        BottomNav()
      }
      .width('100%')
      .height('100%')
      .padding({ left: 14, right: 14, bottom: 14 })
      .zIndex(ZIndexTokens.mainNav)
      .hitTestBehavior(HitTestMode.Transparent)

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
