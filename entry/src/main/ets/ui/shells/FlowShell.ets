// FlowShell — shell for FlowShell-routed screens (source-switch / source-switch-results
// / global-loading / global-empty / global-error / offline-state)。
//
// 合同驱动渲染（B1 P0 核心接线）：所有 FlowShell 路由都通过 ViewStateRenderer
// 渲染，不再绕过。ViewStateTable 已把 source-switch / source-switch-results 映射到
// SourceSwitchFlowPage（Reader-plane 层叠组件：ReaderBase + ReaderTopArea +
// ReaderControlSheet + ReaderBottomBar + SourceSwitchWindow），因此使用 layoutMode:
// 'stack'（与 ReaderShell 一致）。全局状态路由（global-loading 等）使用默认 'column'
// 模式渲染 Loading / Empty / ErrorState / Offline。
//
// Shell 读取 reader.displayedRouteId（RouteRenderer 用来挑选 shell 的 motion-delayed
// 值），保证 shell 变体与渲染器在转场期间看到的路由保持同步。
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { ViewStateRenderer } from '../components/ViewStateRenderer';

@Component
export struct FlowShell {
  static readonly SLOT_NAMES: string[] = ['content'];

  @StorageProp('reader.displayedRouteId') routeId: string = 'bookshelf';

  // 全局状态路由使用 column 布局；其余（source-switch 系列）使用 stack 布局，
  // 因为 SourceSwitchFlowPage 是层叠组件（ReaderBase + overlays）。
  private isGlobalStateRoute(): boolean {
    return this.routeId === 'global-loading'
      || this.routeId === 'global-empty'
      || this.routeId === 'global-error'
      || this.routeId === 'offline-state';
  }

  build() {
    Stack() {
      Column() {
        ViewStateRenderer({ layoutMode: this.isGlobalStateRoute() ? 'column' : 'stack' })
      }
      .width('100%')
      .height('100%')
      .backgroundColor(ColorTokens.paper)
      .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
        [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
    }
    .width('100%')
    .height('100%')
  }
}
