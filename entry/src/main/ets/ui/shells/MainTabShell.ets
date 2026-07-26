// MainTabShell — the current Figma Phone/Tablet shell for bookshelf, discover,
// RSS, and settings. Visual geometry is generated from Reader-UI's revision-
// bound admission ledger; the only local adjustment is increasing a Figma
// minimum when the real system safe area is larger.
import { ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { AppTopBar, BottomNav } from '../components/SharedComponents';
import { ViewStateRenderer } from '../components/ViewStateRenderer';
import { OverlayHost } from '../slots/OverlayHost';
import { StateHost } from '../slots/StateHost';
import { MotionAdapter } from '../adapters/MotionAdapter';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { ReaderUiVisualTokens } from '../../contract/reader_ui/VisualAdmission';

type MainTabKind = 'bookshelf' | 'discover' | 'rss' | 'settings';

@Component
export struct MainTabShell {
  static readonly SLOT_NAMES: string[] = ['topArea', 'content', 'tabNav', 'overlayHost', 'stateHost'];
  // These are the approved Tablet main-navigation dimensions from the Figma
  // shell: 82 vp rail, with the content shell beginning at x=100 on a 760 vp
  // canvas. The Row below derives that relationship without absolute offsets.
  static readonly TABLET_NAV_WIDTH: number = ReaderUiVisualTokens.navigationMainNavTabletWidth;
  static readonly TABLET_NAV_FOOTPRINT: number = ReaderUiVisualTokens.navigationMainNavTabletRailFootprint;
  static readonly TABLET_NAV_TRAILING_INSET: number =
    MainTabShell.TABLET_NAV_FOOTPRINT - MainTabShell.TABLET_NAV_WIDTH -
    ReaderUiVisualTokens.navigationMainNavTabletHorizontalInset;
  static readonly TABLET_NAV_ITEM_HEIGHT: number = ReaderUiVisualTokens.navigationMainNavTabletItemHeight;
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

  // Discover and RSS are current exact-Figma route families. Their paper
  // surface is deliberately read from Reader-UI's generated admission
  // artifact rather than the older global demo palette.
  private routeSurface(): string {
    if (this.activeTab() === 'bookshelf') return ReaderUiVisualTokens.bookshelfPageSurface;
    if (this.activeTab() === 'discover') return ReaderUiVisualTokens.discoverPageSurface;
    if (this.activeTab() === 'rss') return ReaderUiVisualTokens.rssPageSurface;
    // `settings` is currently blocked by the generated admission contract,
    // but use the revision-bound Settings surface here as well so a future
    // admitted route cannot inherit the retired global paper fallback.
    return ReaderUiVisualTokens.settingsPageSurface;
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
          .padding({
            left: ReaderUiVisualTokens.navigationMainNavTabletHorizontalInset,
            right: MainTabShell.TABLET_NAV_TRAILING_INSET,
          })
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Start)
        }

        // content layer: source-bound header plus scrollable admitted body
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
            top: ReaderUiVisualTokens.navigationPageContentGap,
            // The current Figma shells have a 20px outer content inset. The
            // same inset produces 350px Phone and 620px Tablet content after
            // the 100px Tablet navigation rail is reserved.
            left: ReaderUiVisualTokens.navigationHeaderHorizontalInset,
            right: ReaderUiVisualTokens.navigationHeaderHorizontalInset,
            // Tablet replaces the floating bottom nav with its side rail, so
            // it must not retain Phone-only bottom-nav whitespace.
            bottom: this.usesTabletShell()
              ? this.safeAreaBottom + ReaderUiVisualTokens.navigationPageContentGap
              : ReaderUiVisualTokens.navigationMainNavPhoneItemHeight +
                Math.max(this.safeAreaBottom, ReaderUiVisualTokens.navigationMainNavPhoneBottomInset) +
                ReaderUiVisualTokens.navigationPageContentGap,
          })
          .backgroundColor(this.routeSurface())
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
        // Phone keeps the Figma floating navigation. It is positioned from the
        // recorded 15pt visual inset, while a larger platform safe area can only
        // move it farther from the physical gesture indicator.
        Column() {
          Blank()
            .layoutWeight(1)
          BottomNav()
        }
        .width('100%')
        .height('100%')
        .padding({
          left: ReaderUiVisualTokens.navigationMainNavPhoneHorizontalInset,
          right: ReaderUiVisualTokens.navigationMainNavPhoneHorizontalInset,
          bottom: Math.max(this.safeAreaBottom, ReaderUiVisualTokens.navigationMainNavPhoneBottomInset),
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
    .backgroundColor(this.routeSurface())
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }

  @Builder renderTabletMainNav() {
    Column({ space: ReaderUiVisualTokens.navigationMainNavTabletItemGap }) {
      this.tabletNavItem('bookshelf', '书架')
      this.tabletNavItem('discover', '发现')
      this.tabletNavItem('rss', 'RSS')
      this.tabletNavItem('settings', '设置')
    }
    .width(MainTabShell.TABLET_NAV_WIDTH)
    .height(ReaderUiVisualTokens.navigationMainNavTabletHeight)
    .padding({
      left: ReaderUiVisualTokens.navigationMainNavComponentPadding,
      right: ReaderUiVisualTokens.navigationMainNavComponentPadding,
      top: ReaderUiVisualTokens.navigationMainNavTabletVisualInset,
      bottom: ReaderUiVisualTokens.navigationMainNavTabletVisualInset,
    })
    .border({ width: 1, color: ReaderUiVisualTokens.bookshelfBorder })
    .borderRadius(ReaderUiVisualTokens.navigationMainNavRadius)
    .backgroundColor(ReaderUiVisualTokens.bookshelfMainNavSurface)
  }

  @Builder tabletNavItem(tab: MainTabKind, label: string) {
    Column() {
      Stack({ alignContent: Alignment.Center }) {
        Image(this.iconFor(tab, this.activeTab() === tab))
          .width(ReaderUiVisualTokens.navigationMainNavIconSize)
          .height(ReaderUiVisualTokens.navigationMainNavIconSize)
      }
      .width(ReaderUiVisualTokens.navigationMainNavTabletIconShellSize)
      .height(ReaderUiVisualTokens.navigationMainNavTabletIconShellSize)
      .borderRadius(999)
      Text(label)
        .fontSize(ReaderUiVisualTokens.navigationMainNavLabelSize)
        .fontWeight(700)
        .fontFamily(ReaderUiVisualTokens.bookshelfMainNavLabelFontFamily)
        .fontColor(this.activeTab() === tab
          ? ReaderUiVisualTokens.bookshelfActionLabel
          : ReaderUiVisualTokens.bookshelfMainNavInactiveLabel)
        .lineHeight(ReaderUiVisualTokens.navigationMainNavLabelLineHeight)
        .margin({ top: ReaderUiVisualTokens.navigationMainNavItemGap })
    }
    .width('100%')
    .height(MainTabShell.TABLET_NAV_ITEM_HEIGHT)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .borderRadius(ReaderUiVisualTokens.navigationMainNavRadius)
    .backgroundColor(this.activeTab() === tab ? ReaderUiVisualTokens.bookshelfMainNavActive : Color.Transparent)
    .accessibilityText(label)
    .accessibilityDescription(this.activeTab() === tab ? '已选中标签' : '未选中标签')
    .onClick(() => {
      MotionAdapter.apply('tab.switch', this.reducedMotion, this.getUIContext(), () => {
        ReaderUiStore.dispatch({ type: 'switch-tab', tab: tab });
      });
    })
  }
}
