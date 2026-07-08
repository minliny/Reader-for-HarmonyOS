// SettingsShell — shell for settings secondary pages (source-management, webdav-config, …).
// Slots: topArea (BackTopBar) · content (ViewStateRenderer) · overlayHost · stateHost.
//
// Immersive: outermost Stack expands paper behind the system bars; the content
// Column expands into the status-bar region and pads with the real device inset
// (safeAreaTop) so BackTopBar clears the status bar, and the scroll body pads its
// bottom with safeAreaBottom so the last row clears the navigation bar.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { SpacingTokens, ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { BackTopBar } from '../components/SharedComponents';
import { ViewStateRenderer } from '../components/ViewStateRenderer';
import { OverlayHost } from '../slots/OverlayHost';
import { StateHost } from '../slots/StateHost';

@Component
struct SettingsFixedActionButton {
  @Prop label: string = '操作';
  @Prop variant: string = 'primary';

  private fillColor(): string {
    return this.variant === 'secondary' ? DemoAliasTokens.surface : ColorTokens.primary;
  }

  private textColor(): string {
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
  }
}

@Component
export struct SettingsShell {
  static readonly SLOT_NAMES: string[] = ['topArea', 'content', 'overlayHost', 'stateHost'];
  @StorageProp('reader.displayedRouteId') routeId: string = 'settings';
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        BackTopBar()
        Scroll() {
          ViewStateRenderer()
        }
        .layoutWeight(1)
        .align(Alignment.Top)
        .padding({
          top: 8,
          left: SpacingTokens.safeAreaHorizontal + 3,
          right: SpacingTokens.safeAreaHorizontal + 3,
          bottom: 112 + this.safeAreaBottom,
        })
        .backgroundColor(ColorTokens.paper)
      }
      .width('100%')
      .height('100%')
      .padding({ top: this.safeAreaTop })
      .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
        [SafeAreaEdge.TOP, SafeAreaEdge.START, SafeAreaEdge.END])
      .zIndex(ZIndexTokens.content)

      this.renderBottomActionHost()

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

  @Builder renderBottomActionHost() {
    if (this.routeId === 'discover-source-bulk') {
      Column() {
        Blank()
          .layoutWeight(1)
        Row({ space: 10 }) {
          SettingsFixedActionButton({ label: '启用' })
            .layoutWeight(1)
          SettingsFixedActionButton({ label: '禁用', variant: 'secondary' })
            .layoutWeight(1)
          SettingsFixedActionButton({ label: '刷新', variant: 'secondary' })
            .layoutWeight(1)
        }
        .width('100%')
        .padding({ left: SpacingTokens.safeAreaHorizontal + 3, right: SpacingTokens.safeAreaHorizontal + 3, top: 10, bottom: this.safeAreaBottom + 10 })
        .backgroundColor(DemoAliasTokens.surface)
        .border({ width: { top: 1 }, color: ColorTokens.border })
      }
      .width('100%')
      .height('100%')
      .zIndex(ZIndexTokens.bottomSheet)
      .hitTestBehavior(HitTestMode.Transparent)
    }
  }
}
