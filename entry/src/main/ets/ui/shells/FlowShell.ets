// FlowShell — shell for global state screens (global-loading / global-empty / global-error /
// offline-state). Single content slot rendering the ViewState component for the route.
//
// Immersive: the outermost Column expands its paper background behind the system
// bars so state screens own the whole screen; content is centered so it needs no
// explicit bar avoidance.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { ViewStateRenderer } from '../components/ViewStateRenderer';

@Component
export struct FlowShell {
  static readonly SLOT_NAMES: string[] = ['content'];

  build() {
    Column() {
      ViewStateRenderer()
    }
    .width('100%')
    .height('100%')
    .backgroundColor(ColorTokens.paper)
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}
