/**
 * Shared commit/readback fact projection.
 *
 * Feature flows (local import, source JSON save, …) first establish identity,
 * confirmation level, and the canonical Core result in their own domain. Only
 * then do they call this common mapping to describe how the committed write
 * and its subsequent read-back combine into one presentable fact. The helper
 * performs no IO, never decides whether a rewrite is allowed, and does not
 * handle batch transactions or cleanup eligibility — those stay with the
 * owning flow.
 */

/**
 * How much the flow knows about the write it dispatched.
 * - `confirmed`: the owning Core command acknowledged the commit.
 * - `unknown`: the commit reply was lost; the durable state is not yet
 *   reconciled. Never presented as failure or success.
 * - `undispatched`: the confirmation was never even sent (for example the
 *   admission gate refused the write). Must not masquerade as an unknown
 *   commit.
 */
export type CommitConfirmationKind = 'confirmed' | 'unknown' | 'undispatched';

/**
 * The read-back that follows a committed write. `idle` means no read-back has
 * been started or reported yet; it is only meaningful together with
 * `confirmed`.
 */
export type CommitReadbackPhase = 'idle' | 'reading' | 'failed' | 'succeeded';

/**
 * The request lifecycle known by a domain owner. This is deliberately a
 * finite vocabulary instead of a page-level `loading/error/success` boolean
 * pair. A domain adapter supplies the value and whether a recovery action is
 * actually admitted; this module only maps those facts for consumers.
 */
export type OperationRequestPhase =
  | 'idle'
  | 'loading'
  | 'refreshing'
  | 'succeeded'
  | 'empty'
  | 'partial'
  | 'failed'
  | 'cancelled'
  | 'pendingReconciliation';

/**
 * Presentable operation facts shared by domain projections. `refreshFailed`
 * means the retained value is still usable but the newer read failed; it must
 * never be collapsed into `failed`. `blocked` is an explicit platform or
 * capability gate supplied by the owner, not an inferred network error.
 */
export type OperationFactKind =
  | 'idle'
  | 'loading'
  | 'refreshing'
  | 'current'
  | 'empty'
  | 'partial'
  | 'failed'
  | 'refreshFailed'
  | 'cancelled'
  | 'stale'
  | 'blocked'
  | 'pendingReconciliation';

export interface OperationFacts<T> {
  fact: OperationFactKind;
  value: T | undefined;
  hasValue: boolean;
  stale: boolean;
  blocked: boolean;
  canRetry: boolean;
  canCancel: boolean;
  generation: number;
  message?: string;
  blockedReason?: string;
}

export interface OperationFactsInput<T> {
  phase: OperationRequestPhase;
  value?: T;
  stale?: boolean;
  blockedReason?: string;
  canRetry?: boolean;
  canCancel?: boolean;
  generation?: number;
  message?: string;
}

/**
 * Convert owner facts into the shared finite vocabulary. The owner remains
 * responsible for identity, receipt confirmation, retry admission and
 * cancellation. No IO, Promise, timer, storage or ArkUI dependency belongs
 * here.
 */
export function projectOperationFacts<T>(input: OperationFactsInput<T>): OperationFacts<T> {
  const hasValue = input.value !== undefined;
  const blockedReason = input.blockedReason !== undefined && input.blockedReason.length > 0
    ? input.blockedReason : undefined;
  const canRetry = input.canRetry === true;
  const canCancel = input.canCancel === true;
  const generation = input.generation ?? 0;
  let fact: OperationFactKind;
  let stale = input.stale === true;
  let blocked = false;

  if (blockedReason !== undefined) {
    fact = 'blocked';
    blocked = true;
  } else {
    switch (input.phase) {
      case 'loading':
        fact = hasValue ? 'refreshing' : 'loading';
        break;
      case 'refreshing':
        fact = 'refreshing';
        break;
      case 'succeeded':
        fact = hasValue ? (stale ? 'stale' : 'current') : 'empty';
        break;
      case 'empty':
        fact = 'empty';
        break;
      case 'partial':
        fact = 'partial';
        break;
      case 'failed':
        fact = hasValue ? 'refreshFailed' : 'failed';
        stale = hasValue || stale;
        break;
      case 'cancelled':
        fact = 'cancelled';
        stale = hasValue || stale;
        break;
      case 'pendingReconciliation':
        fact = 'pendingReconciliation';
        stale = hasValue || stale;
        break;
      case 'idle':
      default:
        fact = hasValue ? (stale ? 'stale' : 'current') : 'idle';
        break;
    }
  }

  return {
    fact,
    value: input.value,
    hasValue,
    stale,
    blocked,
    canRetry,
    canCancel,
    generation,
    message: input.message,
    blockedReason,
  };
}

/**
 * The single fact a page may present for a committed write plus its
 * read-back. The `message` strings are fixed by the shared contract so two
 * flows never phrase the same fact differently.
 */
export type CommitReadbackSummary = {
  confirmation: CommitConfirmationKind;
  readback: CommitReadbackPhase;
  fact:
    | 'confirmedRefreshing'
    | 'confirmedRefreshFailed'
    | 'confirmedCurrent'
    | 'pendingReconciliation'
    | 'notDispatched';
  message: string;
};

const MESSAGE_CONFIRMED_REFRESHING = '已确认，正在刷新';
const MESSAGE_CONFIRMED_REFRESH_FAILED = '已确认，刷新失败';
const MESSAGE_CONFIRMED_CURRENT = '已确认，当前读取结果可用';
const MESSAGE_PENDING_RECONCILIATION = '等待核对';
const MESSAGE_NOT_DISPATCHED = '尚未执行';

/**
 * Project a confirmation level and a read-back phase into the one fact a page
 * may show. The mapping is fixed:
 *
 * | input                    | fact                    |
 * |--------------------------|-------------------------|
 * | confirmed + reading/idle | confirmedRefreshing     |
 * | confirmed + failed       | confirmedRefreshFailed  |
 * | confirmed + succeeded    | confirmedCurrent        |
 * | unknown (any readback)   | pendingReconciliation   |
 * | undispatched (any)       | notDispatched           |
 *
 * A lost commit reply never collapses into "refresh failed": reconciliation
 * must establish the durable truth first. An undispatched confirmation is not
 * an unknown commit either — nothing was sent, so nothing is pending.
 */
export function projectCommitReadback(
  confirmationKind: CommitConfirmationKind,
  readbackPhase: CommitReadbackPhase,
): CommitReadbackSummary {
  if (confirmationKind === 'undispatched') {
    return {
      confirmation: confirmationKind,
      readback: readbackPhase,
      fact: 'notDispatched',
      message: MESSAGE_NOT_DISPATCHED,
    };
  }
  if (confirmationKind === 'unknown') {
    return {
      confirmation: confirmationKind,
      readback: readbackPhase,
      fact: 'pendingReconciliation',
      message: MESSAGE_PENDING_RECONCILIATION,
    };
  }
  if (readbackPhase === 'failed') {
    return {
      confirmation: confirmationKind,
      readback: readbackPhase,
      fact: 'confirmedRefreshFailed',
      message: MESSAGE_CONFIRMED_REFRESH_FAILED,
    };
  }
  if (readbackPhase === 'succeeded') {
    return {
      confirmation: confirmationKind,
      readback: readbackPhase,
      fact: 'confirmedCurrent',
      message: MESSAGE_CONFIRMED_CURRENT,
    };
  }
  return {
    confirmation: confirmationKind,
    readback: readbackPhase,
    fact: 'confirmedRefreshing',
    message: MESSAGE_CONFIRMED_REFRESHING,
  };
}
