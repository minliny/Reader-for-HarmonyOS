import type { SourceSwitchCompletionPresentation } from '../../source/presentation/SourceSwitchCompletionPresentation';

/** Admits a canonical source-switch receipt against the actual presentation
 * revision. Core write confirmation and native visual effects have their own owners. */
export class ReaderSourceSwitchReveal {
  private epoch: number = 0;
  private readonly consumedKeys: Set<string> = new Set();
  private presentedRevision: number = -1;
  private presentedSelection: number = -1;
  private presentedContinuous: boolean = false;
  private pendingKey: string = '';
  private pendingSelection: number = -1;
  private pendingLifecycle: number = -1;

  key(completion: SourceSwitchCompletionPresentation): string {
    return JSON.stringify([completion.transactionId, completion.sourceId, completion.bookId,
      completion.readingReadyGeneration]);
  }

  bind(completion: SourceSwitchCompletionPresentation, selection: number, lifecycle: number): string {
    const key = this.key(completion);
    if (this.pendingKey !== key) {
      this.pendingKey = key;
      this.pendingSelection = selection;
      this.pendingLifecycle = lifecycle;
    }
    return key;
  }

  pendingAt(selection: number, lifecycle: number): boolean {
    return this.pendingSelection === selection && this.pendingLifecycle === lifecycle;
  }

  clearPending(): void {
    this.pendingKey = '';
    this.pendingSelection = -1;
    this.pendingLifecycle = -1;
  }

  present(revision: number, selection: number, continuous: boolean): void {
    this.presentedRevision = revision;
    this.presentedSelection = selection;
    this.presentedContinuous = continuous;
  }

  matches(completion: SourceSwitchCompletionPresentation, selection: number, lifecycle: number,
    revision: number, continuous: boolean): boolean {
    return this.pendingKey === this.key(completion) && this.pendingAt(selection, lifecycle) &&
      this.presentedSelection === selection && this.presentedRevision === revision &&
      this.presentedContinuous === continuous;
  }

  retire(completion: SourceSwitchCompletionPresentation | undefined): void {
    if (completion !== undefined) this.consumedKeys.add(this.key(completion));
    this.epoch += 1;
  }

  consumed(key: string): boolean {
    return this.consumedKeys.has(key);
  }

  consume(key: string): number {
    this.consumedKeys.add(key);
    return this.epoch;
  }

  isEpoch(epoch: number): boolean {
    return this.epoch === epoch;
  }
}
