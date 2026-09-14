import type { ReaderQuickSearchState } from './ReaderQuickSearchPanel';

/** Reading-session-owned immutable result snapshots. Only the numeric revision
 * crosses ArkUI @Prop; morph frames never deep-copy accumulated result rows. */
export class ReaderContentSearchPublication {
  private state: ReaderQuickSearchState = { kind: 'idle' };

  publish(state: ReaderQuickSearchState): void { this.state = state; }
  stateAt(_revision: number): ReaderQuickSearchState { return this.state; }
}
