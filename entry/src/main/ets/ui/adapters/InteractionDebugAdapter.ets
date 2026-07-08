// Development-only interaction visualization switch.
//
// Default is on for the current demo migration phase so hit zones and invisible
// interaction modules are visible during VM checks. Launch with
// `--ps interactionDebug false` to get production-like visuals. During visual
// parity work, launch with `--ps initialRoute <routeId>` to open a specific
// route directly with the same debug overlays.
export class InteractionDebugAdapter {
  static readonly K_VISIBLE: string = 'reader.devInteractionVisible';
  static readonly K_INITIAL_ROUTE: string = 'initialRoute';
  static readonly DEFAULT_VISIBLE: boolean = true;
}
