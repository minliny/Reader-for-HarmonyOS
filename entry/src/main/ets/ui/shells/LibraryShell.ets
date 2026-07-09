// LibraryShell — shell for library/secondary pages (book-detail, search, rss-detail, …).
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
import { ReaderUiStore } from '../store/ReaderUiStore';

@Component
struct LibraryFixedActionButton {
  @Prop label: string = '操作';
  @Prop variant: string = 'primary';

  private fillColor(): string {
    if (this.variant === 'dangerSoft') {
      return DemoAliasTokens.surface;
    }
    if (this.variant === 'danger') {
      return ColorTokens.accent;
    }
    if (this.variant === 'secondary') {
      return DemoAliasTokens.surface;
    }
    return ColorTokens.primary;
  }

  private textColor(): string {
    if (this.variant === 'dangerSoft') {
      return ColorTokens.accent;
    }
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
      .border({ width: this.variant === 'secondary' || this.variant === 'dangerSoft' ? 1 : 0, color: ColorTokens.border })
      .textAlign(TextAlign.Center)
  }
}

@Component
export struct LibraryShell {
  static readonly SLOT_NAMES: string[] = ['topArea', 'content', 'overlayHost', 'stateHost'];
  @StorageProp('reader.displayedRouteId') routeId: string = 'book-detail';
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;

  private hasFixedActionBar(): boolean {
    return this.routeId === 'book-batch-management'
      || this.routeId === 'group-management'
      || this.routeId === 'book-detail'
      || this.routeId === 'book-detail-toc-preview';
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
    if (this.routeId === 'book-batch-management') {
      Row({ space: 10 }) {
        LibraryFixedActionButton({ label: '移动分组', variant: 'secondary' })
          .layoutWeight(1)
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'group-management' }))
        LibraryFixedActionButton({ label: '删除所选', variant: 'danger' })
          .layoutWeight(1)
      }
      .width('100%')
      .height(this.actionBarHeight())
      .padding({ left: SpacingTokens.safeAreaHorizontal + 3, right: SpacingTokens.safeAreaHorizontal + 3, top: 10, bottom: this.safeAreaBottom + 10 })
      .linearGradient({
        angle: 180,
        colors: [
          ['rgba(249,240,230,0)', 0],
          ['rgba(249,240,230,0.96)', 0.42],
          ['rgba(249,240,230,1)', 1.0]
        ]
      })
      .zIndex(ZIndexTokens.mainNav)
    } else if (this.routeId === 'group-management') {
      Row({ space: 10 }) {
        LibraryFixedActionButton({ label: '新建分组', variant: 'secondary' })
          .layoutWeight(1)
        LibraryFixedActionButton({ label: '完成' })
          .layoutWeight(1)
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      }
      .width('100%')
      .height(this.actionBarHeight())
      .padding({ left: SpacingTokens.safeAreaHorizontal + 3, right: SpacingTokens.safeAreaHorizontal + 3, top: 10, bottom: this.safeAreaBottom + 10 })
      .linearGradient({
        angle: 180,
        colors: [
          ['rgba(249,240,230,0)', 0],
          ['rgba(249,240,230,0.96)', 0.42],
          ['rgba(249,240,230,1)', 1.0]
        ]
      })
      .zIndex(ZIndexTokens.mainNav)
    } else if (this.routeId === 'book-detail' || this.routeId === 'book-detail-toc-preview') {
      Row({ space: 10 }) {
        LibraryFixedActionButton({ label: '继续阅读' })
          .layoutWeight(1)
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'immersive-reading' }))
        LibraryFixedActionButton({ label: '移除书架', variant: 'dangerSoft' })
          .layoutWeight(1)
      }
      .width('100%')
      .height(this.actionBarHeight())
      .padding({ left: SpacingTokens.safeAreaHorizontal + 3, right: SpacingTokens.safeAreaHorizontal + 3, top: 10, bottom: this.safeAreaBottom + 10 })
      .linearGradient({
        angle: 180,
        colors: [
          ['rgba(249,240,230,0)', 0],
          ['rgba(249,240,230,0.96)', 0.42],
          ['rgba(249,240,230,1)', 1.0]
        ]
      })
      .zIndex(ZIndexTokens.mainNav)
    }
  }
}
