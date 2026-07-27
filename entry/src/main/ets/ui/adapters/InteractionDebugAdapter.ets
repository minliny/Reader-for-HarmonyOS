// Development-only interaction visualization switch.
//
// Production/test-package launches must stay visually identical to the regular
// Reader UI demo. Debug frames are therefore opt-in: launch with
// `--ps interactionDebug true` during VM interaction-zone checks. During visual
// parity work, combine it with `--ps initialRoute <routeId>` to open a specific
// route directly with the debug overlays.
export class InteractionDebugAdapter {
  static readonly K_VISIBLE: string = 'reader.devInteractionVisible';
  static readonly K_INITIAL_ROUTE: string = 'initialRoute';
  static readonly DEFAULT_VISIBLE: boolean = false;
}
