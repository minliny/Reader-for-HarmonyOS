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
