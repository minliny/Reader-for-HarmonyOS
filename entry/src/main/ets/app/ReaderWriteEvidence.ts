import type { CommitConfirmationKind } from './ReaderOperationFacts';

/** IO-free evidence, marked by the gateway at the real dispatch/ACK boundary.
 * It never executes a command, infers dispatch from an exception, retries or
 * confirms a lost ACK from a later read. Domain owners retain task identity. */
export class ReaderWriteEvidence {
  dispatchedCount: number = 0;
  confirmedCount: number = 0;

  dispatched(): void { this.dispatchedCount += 1; }
  confirmed(): void { this.confirmedCount += 1; }

  /** Only a gateway's typed Core admission response may call this. */
  rejectedBeforeExecution(): void {
    if (this.dispatchedCount > this.confirmedCount) this.dispatchedCount -= 1;
  }

  confirmation(): CommitConfirmationKind {
    if (this.dispatchedCount === 0) return 'undispatched';
    return this.confirmedCount === this.dispatchedCount ? 'confirmed' : 'unknown';
  }

  hasConfirmedPart(): boolean { return this.confirmedCount > 0; }
}
