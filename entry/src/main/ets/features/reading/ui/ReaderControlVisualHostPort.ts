import { copyReaderControlSessionState, type ReaderControlSessionState } from './ReaderControlSessionState.ts';
import { readerControlHostClosing } from './ReaderControlHostSession.ts';

/** Sparse decision handoff only. The receiver stores a plain snapshot; it
 * does not own the visual clock, reducer, module drafts or business writes. */
export interface ReaderControlVisualHostPort {
  presentedForWindow: () => boolean;
  capture: (state: ReaderControlSessionState) => void;
  closing: (value: boolean) => void;
  chromeOwnerChanged: () => void;
}

export function admitReaderControlVisualSnapshot(state: ReaderControlSessionState,
  port: ReaderControlVisualHostPort): void {
  const wasPresented = port.presentedForWindow();
  port.capture(copyReaderControlSessionState(state));
  port.closing(readerControlHostClosing(state));
  if (wasPresented !== port.presentedForWindow()) port.chromeOwnerChanged();
}
