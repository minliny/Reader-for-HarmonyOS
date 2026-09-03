/**
 * One admission boundary for native Text selection in the immersive reader.
 *
 * Selection belongs only to a stable, manually controlled reading surface.
 * Any owner transition that can cover, move, replace, or automatically
 * advance that surface invalidates the system selection overlay. Returning to
 * reading never resurrects the old range; the user must long-press again.
 */
export type ReaderTextSelectionPolicyInput = {
  configured: boolean;
  mounted: boolean;
  exitRequested: boolean;
  pageReady: boolean;
  controlVisible: boolean;
  controlObscured: boolean;
  interactionBlocked: boolean;
  pageTurnActive: boolean;
  autoPageActive: boolean;
  ttsActive: boolean;
};

export function readerTextSelectionEnabled(input: ReaderTextSelectionPolicyInput): boolean {
  return input.configured && input.mounted && !input.exitRequested && input.pageReady &&
    !input.controlVisible && !input.controlObscured && !input.interactionBlocked &&
    !input.pageTurnActive && !input.autoPageActive && !input.ttsActive;
}
