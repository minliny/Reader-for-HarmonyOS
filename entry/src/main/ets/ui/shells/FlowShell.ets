// FlowShell — shell for global state screens (global-loading / global-empty / global-error /
// offline-state). Single content slot rendering the ViewState component for the route.
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
  }
}
