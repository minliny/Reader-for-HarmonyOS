// SettingsShell — shell for settings secondary pages (source-management, webdav-config, …).
// Slots: topArea (BackTopBar) · content (ViewStateRenderer) · overlayHost · stateHost.
//
// Immersive: outermost Stack expands paper behind the system bars; the content
// Column expands into the status-bar region and pads with the real device inset
// (safeAreaTop) so BackTopBar clears the status bar, and the scroll body pads its
// bottom with safeAreaBottom so the last row clears the navigation bar.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { TokenAdapter } from '../adapters/TokenAdapter';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { SpacingTokens, ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { BackTopBar } from '../components/SharedComponents';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { RouteId } from '../../contract/generated/RouteTable';
import { ViewStateRenderer } from '../components/ViewStateRenderer';
import { OverlayHost } from '../slots/OverlayHost';
import { StateHost } from '../slots/StateHost';

@Component
struct SettingsFixedActionButton {
  @Prop label: string = '操作';
  @Prop variant: string = 'primary';
  @Prop route: RouteId = 'settings';

  private fillColor(): string {
    if (this.variant === 'danger') return ColorTokens.accent;
    return this.variant === 'secondary' ? DemoAliasTokens.surface : ColorTokens.primary;
  }

  private textColor(): string {
    if (this.variant === 'danger') return DemoAliasTokens.onPrimary;
    return this.variant === 'secondary' ? ColorTokens.primaryDark : DemoAliasTokens.onPrimary;
  }

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(800)
      .fontColor(this.textColor())
      .width('100%')
      .height(42)
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.fillColor())
      .border({ width: this.variant === 'secondary' ? 1 : 0, color: ColorTokens.border })
      .textAlign(TextAlign.Center)
      .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: this.route }))
  }
}

@Component
export struct SettingsShell {
  static readonly SLOT_NAMES: string[] = ['topArea', 'content', 'overlayHost', 'stateHost'];
  @StorageProp('reader.displayedRouteId') routeId: string = 'settings';
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;

  private hasFixedActionBar(): boolean {
    return this.routeId === 'discover-source-bulk'
      || this.routeId === 'source-management'
      || this.routeId === 'source-detail';
  }

  private scrollBottomPadding(): number {
    return this.hasFixedActionBar() ? 18 : 112 + this.safeAreaBottom;
  }

  private actionBarHeight(): number {
    return 62 + this.safeAreaBottom;
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        BackTopBar()
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
          bottom: this.scrollBottomPadding(),
        })
        .backgroundColor(ColorTokens.paper)
        this.renderBottomActionBar()
      }
      .width('100%')
      .height('100%')
      .padding({ top: this.safeAreaTop })
      .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
        [SafeAreaEdge.TOP, SafeAreaEdge.START, SafeAreaEdge.END])
      .zIndex(ZIndexTokens.content)

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

  @Builder renderBottomActionBar() {
    if (this.routeId === 'discover-source-bulk') {
      Row({ space: 10 }) {
        SettingsFixedActionButton({ label: '启用' })
          .layoutWeight(1)
        SettingsFixedActionButton({ label: '禁用', variant: 'secondary' })
          .layoutWeight(1)
        SettingsFixedActionButton({ label: '刷新', variant: 'secondary' })
          .layoutWeight(1)
      }
      .width('100%')
      .height(this.actionBarHeight())
      .padding({ left: SpacingTokens.safeAreaHorizontal + 3, right: SpacingTokens.safeAreaHorizontal + 3, top: 10, bottom: this.safeAreaBottom + 10 })
      .linearGradient({
        angle: 180,
        colors: [
          [TokenAdapter.colorWithAlpha(ColorTokens.bottomBarBg, 0), 0],
          [TokenAdapter.colorWithAlpha(ColorTokens.bottomBarBg, 0.96), 0.42],
          [TokenAdapter.colorWithAlpha(ColorTokens.bottomBarBg, 1.0), 1.0]
        ]
      })
      .zIndex(ZIndexTokens.mainNav)
    } else if (this.routeId === 'source-management') {
      Row({ space: 10 }) {
        SettingsFixedActionButton({ label: '批量管理', variant: 'secondary', route: 'source-batch' })
          .layoutWeight(1)
        SettingsFixedActionButton({ label: '新增书源', route: 'source-import-options' })
          .layoutWeight(1)
      }
      .width('100%')
      .height(this.actionBarHeight())
      .padding({ left: SpacingTokens.safeAreaHorizontal + 3, right: SpacingTokens.safeAreaHorizontal + 3, top: 10, bottom: this.safeAreaBottom + 10 })
      .linearGradient({
        angle: 180,
        colors: [
          [TokenAdapter.colorWithAlpha(ColorTokens.bottomBarBg, 0), 0],
          [TokenAdapter.colorWithAlpha(ColorTokens.bottomBarBg, 0.96), 0.42],
          [TokenAdapter.colorWithAlpha(ColorTokens.bottomBarBg, 1.0), 1.0]
        ]
      })
      .zIndex(ZIndexTokens.mainNav)
    } else if (this.routeId === 'source-detail') {
      Row({ space: 10 }) {
        SettingsFixedActionButton({ label: '检测此源', variant: 'secondary', route: 'source-detect' })
          .layoutWeight(1)
        SettingsFixedActionButton({ label: '编辑规则', route: 'source-rule-edit' })
          .layoutWeight(1)
        SettingsFixedActionButton({ label: '删除', variant: 'danger', route: 'source-delete-confirm' })
          .layoutWeight(1)
      }
      .width('100%')
      .height(this.actionBarHeight())
      .padding({ left: SpacingTokens.safeAreaHorizontal + 3, right: SpacingTokens.safeAreaHorizontal + 3, top: 10, bottom: this.safeAreaBottom + 10 })
      .linearGradient({
        angle: 180,
        colors: [
          [TokenAdapter.colorWithAlpha(ColorTokens.bottomBarBg, 0), 0],
          [TokenAdapter.colorWithAlpha(ColorTokens.bottomBarBg, 0.96), 0.42],
          [TokenAdapter.colorWithAlpha(ColorTokens.bottomBarBg, 1.0), 1.0]
        ]
      })
      .zIndex(ZIndexTokens.mainNav)
    }
  }
}
