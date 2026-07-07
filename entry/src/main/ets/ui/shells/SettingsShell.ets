// SettingsShell — shell for settings secondary pages (source-management, webdav-config, …).
// Slots: topArea (BackTopBar) · content (ViewStateRenderer) · overlayHost · stateHost.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { BackTopBar } from '../components/SharedComponents';
import { ViewStateRenderer } from '../components/ViewStateRenderer';
import { OverlayHost } from '../slots/OverlayHost';
import { StateHost } from '../slots/StateHost';

@Component
export struct SettingsShell {
  static readonly SLOT_NAMES: string[] = ['topArea', 'content', 'overlayHost', 'stateHost'];

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        BackTopBar()
        Scroll() {
          ViewStateRenderer()
        }
        .layoutWeight(1)
        .align(Alignment.Top)
        .backgroundColor(ColorTokens.paper)
      }
      .width('100%')
      .height('100%')

      OverlayHost()
      StateHost()
    }
    .width('100%')
    .height('100%')
    .backgroundColor(ColorTokens.paper)
  }
}
