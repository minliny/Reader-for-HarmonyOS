export interface ReaderTtsAudioSessionDriver {
  activate(allowMixing: boolean): Promise<void>;
  deactivate(): Promise<void>;
}

/** One process audio session; speech transports own admission, never a copy of
 * the native active flag. Native ACK cannot be cancelled, so retired admission
 * releases its lease before a successor can acquire the same platform object. */
export class ReaderTtsAudioSessionLease {
  private readonly driver: ReaderTtsAudioSessionDriver;
  private operationTail: Promise<void> = Promise.resolve();
  private revision: number = 0;
  private nextOwner: number = 0;
  private requestedOwner: string | undefined = undefined;
  private activeOwner: string | undefined = undefined;
  private activeAllowMixing: boolean | undefined = undefined;
  private pendingOwner: string | undefined = undefined;
  private pendingAllowMixing: boolean | undefined = undefined;
  private pendingActivation: Promise<void> | undefined = undefined;

  constructor(driver: ReaderTtsAudioSessionDriver) { this.driver = driver; }

  createOwner(transport: string): string { return `${transport}:${++this.nextOwner}`; }

  activate(owner: string, allowMixing: boolean): Promise<void> {
    if (this.requestedOwner === owner && this.pendingOwner === owner &&
      this.pendingAllowMixing === allowMixing && this.pendingActivation !== undefined) {
      return this.pendingActivation;
    }
    const revision = ++this.revision;
    this.requestedOwner = owner;
    const task = this.operationTail.then(async (): Promise<void> => {
      this.assertCurrent(owner, revision);
      if (this.activeOwner === owner && this.activeAllowMixing === allowMixing) return;
      // Reapply mixing policy on the same transport in place. Explicitly
      // deactivating first would emit a platform interruption during playback.
      if (this.activeOwner !== owner) await this.releaseActive();
      this.assertCurrent(owner, revision);
      await this.driver.activate(allowMixing);
      // Remember acquired native resources even when the request was retired;
      // a failed release remains recorded and is retried before any successor.
      this.activeOwner = owner;
      this.activeAllowMixing = allowMixing;
      if (!this.isCurrent(owner, revision)) {
        await this.releaseActive();
        throw new Error('Reader TTS audio admission retired');
      }
    });
    const admission = task.finally((): void => {
      if (this.pendingActivation === admission) {
        this.pendingActivation = undefined;
        this.pendingOwner = undefined;
        this.pendingAllowMixing = undefined;
      }
    });
    this.pendingOwner = owner;
    this.pendingAllowMixing = allowMixing;
    this.pendingActivation = admission;
    this.operationTail = admission.catch((): void => {});
    return admission;
  }

  deactivate(owner: string): Promise<void> {
    if (this.requestedOwner === owner) {
      this.requestedOwner = undefined;
      this.revision += 1;
    }
    const task = this.operationTail.then(async (): Promise<void> => {
      if (this.activeOwner === owner) await this.releaseActive();
    });
    this.operationTail = task.catch((): void => {});
    return task;
  }

  private isCurrent(owner: string, revision: number): boolean {
    return this.requestedOwner === owner && this.revision === revision;
  }

  private assertCurrent(owner: string, revision: number): void {
    if (!this.isCurrent(owner, revision)) throw new Error('Reader TTS audio admission retired');
  }

  private async releaseActive(): Promise<void> {
    if (this.activeOwner === undefined) return;
    await this.driver.deactivate();
    this.activeOwner = undefined;
    this.activeAllowMixing = undefined;
  }
}
