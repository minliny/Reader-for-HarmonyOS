import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import type { OperationFacts } from '../../app/ReaderOperationFacts';
import type { PersistedReceiptProjection } from '../../app/ReaderPersistedReceiptProjection';

let syncWriteGeneration: number = 0;

export type SyncOperationAction = 'saveConfig' | 'testConnection' | 'backup' | 'restore' | 'resolveRestore';
/** Non-secret summary. Physical IO and ACK boundaries are marked by the gateway. */
export class SyncWriteObservation {
  writeGeneration: number = ++syncWriteGeneration;
  /** Qualified config-save identity; never contains URL/user/secrets. */
  operationId: string | undefined;
  readonly write: ReaderWriteEvidence = new ReaderWriteEvidence();
  coreApplied: boolean = false;
  hostApplied: boolean = false;
  completed: boolean = false;
  remoteConfirmedCount: number = 0;
}
export interface SyncOperationProjection {
  action: SyncOperationAction;
  writeGeneration: number;
  operationId?: string;
  projection: PersistedReceiptProjection<boolean>;
  coreApplied: boolean;
  hostApplied: boolean;
  completed: boolean;
  remoteConfirmedCount: number;
}
export interface SyncPresentationFacts {
  read: OperationFacts<boolean>;
  operation?: SyncOperationProjection;
  request?: OperationFacts<boolean>;
  busy: boolean;
  canMutate: boolean;
}
