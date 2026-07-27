// ReaderShell — thin shell for the reading surface.
//
// Contract-driven (Batch 1): the reading base (ReaderBase) + overlay panels come
// from ViewStateTable.bodyComponentsFor(routeId, pageState), rendered in a layered
// Stack by ViewStateRenderer(layoutMode: 'stack'). The shell no longer hardcodes
// ReadingBackgroundLayer/ReadingTextFlow/… (would double-render the base that the
// contract body already declares) and no longer dispatches Reader overlays via
// the reader.overlay field — overlays are routes now (route-push / route-pop).
//
// Slots: content · overlayHost · stateHost.
//   - content: ViewStateRenderer (stack) — reader route body (base + overlay).
//   - overlayHost: generic transient overlays (book-action / sort-filter / …)
//     still driven by reader.overlay — NOT Reader overlays (those are routes).
//   - stateHost: loading / empty / error / offline page-state overlays.
//
// Immersive: the outermost Stack expands its paper background behind the system
// status / nav bars so the reading paper owns the whole screen.
import { ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { ReaderUiVisualTokens } from '../../contract/reader_ui/VisualAdmission';
import { ViewStateRenderer } from '../components/ViewStateRenderer';
import { OverlayHost } from '../slots/OverlayHost';
import { StateHost } from '../slots/StateHost';

@Component
export struct ReaderShell {
  static readonly SLOT_NAMES: string[] = ['content', 'overlayHost', 'stateHost'];

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // content (z=0) — contract body for the current reader routeId, layered.
      // ReaderBase + overlay panel(s) come from ViewStateTable; the base renders
      // exactly once per route (no double-render).
      ViewStateRenderer({ layoutMode: 'stack' })
        .width('100%')
        .height('100%')
        .zIndex(ZIndexTokens.content)

      // overlayHost (dialog layer) — generic transient overlays only (book-action /
      // sort-filter / group-management / …). Reader overlays are NOT here; they
      // are route-driven and render inside the content slot above.
      OverlayHost()
        .zIndex(ZIndexTokens.dialog)

      // stateHost (z=20) — loading / empty / error / offline page states.
      StateHost()
        .zIndex(ZIndexTokens.mainNav)
    }
    .width('100%')
    .height('100%')
    // The shell is visible during the first reader frame, before the layered
    // ReadingSurface mounts. It must therefore start on the Figma paper base,
    // not the older generic app paper that caused a visible flash.
    .backgroundColor(ReaderUiVisualTokens.readerPaperBaseEnd)
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}
