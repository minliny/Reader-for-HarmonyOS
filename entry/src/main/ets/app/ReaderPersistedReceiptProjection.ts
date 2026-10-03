import {
  projectCommitReadback,
  projectOperationFacts,
  type CommitConfirmationKind,
  type CommitReadbackPhase,
  type CommitReadbackSummary,
  type OperationFacts,
} from './ReaderOperationFacts';

/**
 * Input for a persisted-write projection. The write confirmation and the
 * follow-up read are intentionally independent. A refresh failure therefore
 * cannot erase a confirmed write, and a lost reply cannot be guessed from a
 * later read that happens to return the same value.
 */
export interface PersistedReceiptProjectionInput<T> {
  confirmation: CommitConfirmationKind;
  readback: CommitReadbackPhase;
  value?: T;
  refreshError?: string;
  stale?: boolean;
  canRetry?: boolean;
  canCancel?: boolean;
  generation?: number;
  message?: string;
  blockedReason?: string;
}

/**
 * Shared result contract for domains that have durable data and a subsequent
 * refresh/read-back. `receipt` is the canonical write/read fact; `facts` is a
 * presentation-neutral lifecycle projection that can be consumed by a page
 * or a public status surface.
 */
export interface PersistedReceiptProjection<T> {
  receipt: CommitReadbackSummary;
  facts: OperationFacts<T>;
  value: T | undefined;
  hasValue: boolean;
  refreshError?: string;
}

function operationPhaseForReceipt(
  confirmation: CommitConfirmationKind,
  readback: CommitReadbackPhase,
): 'idle' | 'refreshing' | 'succeeded' | 'failed' | 'pendingReconciliation' {
  if (confirmation === 'unknown') return 'pendingReconciliation';
  if (confirmation === 'undispatched') return 'idle';
  if (readback === 'failed') return 'failed';
  if (readback === 'succeeded') return 'succeeded';
  return 'refreshing';
}

/**
 * Build a durable-write/read-back projection without issuing a retry or
 * changing the domain's confirmation level. The returned action flags are
 * copied from the owner; this function does not decide whether retrying is
 * safe or whether a cancellation should stop Core/native work.
 */
export function projectPersistedReceipt<T>(
  input: PersistedReceiptProjectionInput<T>,
): PersistedReceiptProjection<T> {
  const receipt = projectCommitReadback(input.confirmation, input.readback);
  const facts = projectOperationFacts({
    phase: operationPhaseForReceipt(input.confirmation, input.readback),
    value: input.value,
    stale: input.stale,
    blockedReason: input.blockedReason,
    canRetry: input.canRetry,
    canCancel: input.canCancel,
    generation: input.generation,
    message: input.message ?? input.refreshError ?? receipt.message,
  });
  return {
    receipt,
    facts,
    value: input.value,
    hasValue: input.value !== undefined,
    refreshError: input.refreshError,
  };
}
