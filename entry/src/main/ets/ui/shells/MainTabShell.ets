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
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { SpacingTokens, SizeTokens, ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { AppTopBar, BottomNav } from '../components/SharedComponents';
import { ViewStateRenderer } from '../components/ViewStateRenderer';
import { OverlayHost } from '../slots/OverlayHost';
import { StateHost } from '../slots/StateHost';
import { MotionAdapter } from '../adapters/MotionAdapter';
import { ReaderUiStore } from '../store/ReaderUiStore';

type MainTabKind = 'bookshelf' | 'discover' | 'rss' | 'settings';

@Component
export struct MainTabShell {
  static readonly SLOT_NAMES: string[] = ['topArea', 'content', 'tabNav', 'overlayHost', 'stateHost'];
  // These are the approved Tablet main-navigation dimensions from the Figma
  // shell: 82 vp rail, with the content shell beginning at x=100 on a 760 vp
  // canvas. The Row below derives that relationship without absolute offsets.
  static readonly TABLET_NAV_WIDTH: number = 82;
  static readonly TABLET_NAV_FOOTPRINT: number = 100;
  static readonly TABLET_NAV_TRAILING_INSET: number =
    MainTabShell.TABLET_NAV_FOOTPRINT - MainTabShell.TABLET_NAV_WIDTH - SpacingTokens.safeAreaHorizontal;
  static readonly TABLET_NAV_ITEM_HEIGHT: number = 58;
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp(ViewportAdapter.K_CLASS) viewportClass: string = 'phone';
  @StorageProp('reader.tab') tab: string = 'bookshelf';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  private usesTabletShell(): boolean {
    return this.viewportClass === 'tablet';
  }

  private activeTab(): MainTabKind {
    if (this.tab === 'discover' || this.tab === 'rss' || this.tab === 'settings') {
      return this.tab as MainTabKind;
    }
    return 'bookshelf';
  }

  private iconFor(tab: MainTabKind, active: boolean): Resource {
    switch (tab) {
      case 'bookshelf':
        return active ? $r('app.media.main_tab_icon_bookshelf_active') : $r('app.media.main_tab_icon_bookshelf_muted');
      case 'discover':
        return active ? $r('app.media.main_tab_icon_discover_active') : $r('app.media.main_tab_icon_discover_muted');
      case 'rss':
        return active ? $r('app.media.main_tab_icon_rss_active') : $r('app.media.main_tab_icon_rss_muted');
      case 'settings':
        return active ? $r('app.media.main_tab_icon_settings_active') : $r('app.media.main_tab_icon_settings_muted');
      default:
        return $r('app.media.main_tab_icon_bookshelf_muted');
    }
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // Figma has exactly two responsive shells. Tablet replaces the floating
      // bottom navigation with the same four destinations in a centered side
      // rail; Phone retains the existing bottom navigation below.
      Row() {
        if (this.usesTabletShell()) {
          Column() {
            this.renderTabletMainNav()
          }
          .width(MainTabShell.TABLET_NAV_FOOTPRINT)
          .height('100%')
          .padding({ left: SpacingTokens.safeAreaHorizontal, right: MainTabShell.TABLET_NAV_TRAILING_INSET })
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Start)
        }

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
            // 19/21 produces the Figma 350px Phone and 620px Tablet inner
            // content widths after the shell's measured outer geometry.
            right: SpacingTokens.safeAreaHorizontal + 5,
            // Tablet replaces the floating bottom nav with its side rail, so
            // it must not retain Phone-only bottom-nav whitespace.
            bottom: this.usesTabletShell()
              ? this.safeAreaBottom + 8
              : SizeTokens.mainNavHeight + this.safeAreaBottom + 34,
          })
          .backgroundColor(ColorTokens.paper)
        }
        .layoutWeight(1)
        .height('100%')
        .padding({ top: this.safeAreaTop })
        .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
          [SafeAreaEdge.TOP, SafeAreaEdge.START, SafeAreaEdge.END])
      }
      .width('100%')
      .height('100%')
      .zIndex(ZIndexTokens.content)

      if (!this.usesTabletShell()) {
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
      }

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

  @Builder renderTabletMainNav() {
    Column({ space: 6 }) {
      this.tabletNavItem('bookshelf', '书架')
      this.tabletNavItem('discover', '发现')
      this.tabletNavItem('rss', 'RSS')
      this.tabletNavItem('settings', '设置')
    }
    .width(MainTabShell.TABLET_NAV_WIDTH)
    .padding(8)
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusXl)
    .backgroundColor(DemoAliasTokens.surface)
  }

  @Builder tabletNavItem(tab: MainTabKind, label: string) {
    Column() {
      Stack({ alignContent: Alignment.Center }) {
        Image(this.iconFor(tab, this.activeTab() === tab)).width(24).height(24)
      }
      .width(32).height(32)
      .borderRadius(DemoAliasTokens.radiusPill)
      Text(label)
        .fontSize(11)
        .fontWeight(800)
        .fontColor(this.activeTab() === tab ? DemoAliasTokens.onPrimary : ColorTokens.muted)
        .margin({ top: 2 })
    }
    .width('100%')
    .height(MainTabShell.TABLET_NAV_ITEM_HEIGHT)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .borderRadius(DemoAliasTokens.radiusXl)
    .backgroundColor(this.activeTab() === tab ? ColorTokens.primaryDark : ColorTokens.paper)
    .accessibilityText(label)
    .accessibilityDescription(this.activeTab() === tab ? '已选中标签' : '未选中标签')
    .onClick(() => {
      MotionAdapter.apply('tab.switch', this.reducedMotion, this.getUIContext(), () => {
        ReaderUiStore.dispatch({ type: 'switch-tab', tab: tab });
      });
    })
  }
}
