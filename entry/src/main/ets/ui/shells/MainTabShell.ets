// MainTabShell — 5-slot shell for the 4 main tabs (bookshelf / discover / rss / settings).
// Skeleton ported from frontend-demo: .fd-phone-content (grid, gap 8, padding
// 8 / safeAreaH+3 / mainNav+safeBottom+34) + .fd-main-nav (absolute, floats at
// bottom: safeAreaBottom, left/right: safeAreaHorizontal-2).
//
// Immersive: the outermost Stack expands its paper background behind the system
// status / nav bars (expandSafeArea). The content Column and the floating-nav
// wrapper also expandSafeArea (so they own the full screen rather than the
// implicit safe-area box) and then pad with the real device insets (safeAreaTop /
// safeAreaBottom from AppStorage, written by EntryAbility via SafeAreaAdapter) —
// AppTopBar clears the status bar, BottomNav floats above the navigation bar.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { SpacingTokens, SizeTokens, ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { AppTopBar, BottomNav } from '../components/SharedComponents';
import { ViewStateRenderer } from '../components/ViewStateRenderer';
import { OverlayHost } from '../slots/OverlayHost';
import { StateHost } from '../slots/StateHost';

@Component
export struct MainTabShell {
  static readonly SLOT_NAMES: string[] = ['topArea', 'content', 'tabNav', 'overlayHost', 'stateHost'];
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // content layer: top bar + scrollable body (.fd-phone-content)
      Column() {
        AppTopBar()
        Scroll() {
          Column() {
            ViewStateRenderer()
          }
          .width('100%')
        }
        .layoutWeight(1)
        .scrollable(ScrollDirection.Vertical)
        .scrollBar(BarState.Auto)
        .align(Alignment.Top)
        .padding({
          top: 8,
          left: SpacingTokens.safeAreaHorizontal + 3,
          right: SpacingTokens.safeAreaHorizontal + 3,
          bottom: SizeTokens.mainNavHeight + this.safeAreaBottom + 34,
        })
        .backgroundColor(ColorTokens.paper)
      }
      .width('100%')
      .height('100%')
      .padding({ top: this.safeAreaTop })
      .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
        [SafeAreaEdge.TOP, SafeAreaEdge.START, SafeAreaEdge.END])
      .zIndex(ZIndexTokens.content)

      // floating main nav (.fd-main-nav: absolute, bottom safeAreaBottom,
      // left/right safeAreaHorizontal-2). Blank fills the top so the nav sits at
      // the bottom; hitTestBehavior Transparent lets taps pass through to content.
      // Inset is on this wrapper's padding so the nav width matches the demo
      // left/right offset without width + margin overflow. Bottom is only the
      // effective safe area; do not add a second fixed visual gap above the
      // platform gesture/navigation indicator.
      Column() {
        Blank()
          .layoutWeight(1)
        BottomNav()
      }
      .width('100%')
      .height('100%')
      .padding({
        left: SpacingTokens.safeAreaHorizontal - 2,
        right: SpacingTokens.safeAreaHorizontal - 2,
        bottom: this.safeAreaBottom,
      })
      .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
        [SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
      .zIndex(ZIndexTokens.mainNav)
      .hitTestBehavior(HitTestMode.Transparent)

      OverlayHost()
        .zIndex(ZIndexTokens.dialog)
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
