// FlowShell — shell for FlowShell-routed screens. Renders either:
//   • a single Column + ViewStateRenderer for global-state routes
//     (global-loading / global-empty / global-error / offline-state) — preserved
//     legacy behavior; OR
//   • a full-screen 3-column SourceSwitchFlowFrame for the source-switch flow
//     (300px context | 1fr candidate list | 320px result panel) per B's
//     .fd-flow-frame spec (Reader UI/frontend-demo-optimized/styles/05-flow-adaptive.css).
//
// The shell reads reader.displayedRouteId (the motion-delayed value RouteRenderer
// uses to pick the shell) so the shell variant stays in sync with the route the
// renderer thinks it is rendering during the transition.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { ViewStateRenderer } from '../components/ViewStateRenderer';
import { SourceSwitchFlowFrame } from '../components/SourceSwitchFlowComponents';

@Component
export struct FlowShell {
  static readonly SLOT_NAMES: string[] = ['content'];

  @StorageProp('reader.displayedRouteId') routeId: string = 'bookshelf';

  private isGlobalStateRoute(): boolean {
    return this.routeId === 'global-loading'
      || this.routeId === 'global-empty'
      || this.routeId === 'global-error'
      || this.routeId === 'offline-state';
  }

  build() {
    Stack() {
      if (this.isGlobalStateRoute()) {
        Column() {
          ViewStateRenderer()
        }
        .width('100%')
        .height('100%')
        .backgroundColor(ColorTokens.paper)
        .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
          [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
      } else {
        SourceSwitchFlowFrame()
      }
    }
    .width('100%')
    .height('100%')
  }
}
