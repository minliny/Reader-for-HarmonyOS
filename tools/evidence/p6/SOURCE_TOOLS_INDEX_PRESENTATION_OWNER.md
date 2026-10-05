# SourceTools: canonical selection, accepted tail and physical consumer lease

## Result and ownership

The existing SourceToolsOrchestrator remains the only owner of selected source IDs, draft, receipt, write evidence, pending-operation exclusion and operation tail. Index no longer normalizes selections or calculates select-all/toggle/consume from its lagging @State copy.

A feature-local exact Runtime cache retains accepted tasks across Index reconstruction. Index attaches a finite identity made from its unique instance, mount and navigation generation; a matching detach retires only that delivery. Same Runtime reconstruction receives the original snapshot/mutex, and old Runtime lookup cannot evict the successor cached owner. No global task manager, selection store, error bus or Core rule/serialization implementation is added.

All real Index→SourceToolsPage ordinary callbacks close over the original Runtime, mount, navigation and Orchestrator. A small page subtree keyed by navigation refreshes V1 ordinary callbacks. Obsolete physical callbacks never call a current-owner factory. The persistent reader tree is untouched.

Queued dispatch captures the original presentation lease. Retirement before gateway dispatch cancels that intent honestly; accepted IO later settles in the original domain owner. View retirement controls delivery, never the acknowledged Core write. The same Runtime replacement view can receive that settled result; a different Runtime cannot.

Warm re-open cannot discard pending writes, unknown ACK or confirmed-write/failed-refresh evidence. Confirmed write and refresh remain separate. Unknown CRUD/editor writes are not replayed; recovery is actual source.list only, and matching rows never upgrade unknown to confirmed. The original batch control tuples remain, with write controls disabled while this finite uncertainty is known. Read/check/export access remains available. Unknown editor drafts are retained.

## Validation and corrections

The actual SourceGateway→Orchestrator→Index factory/Builder→SDK Page/recovery/action chain covers CRUD/editor, partial ACK counts, failed refresh/only-read retry, unknown ACK/read-only reconciliation, warm re-open, close/late reply, current Runtime unavailable/replaced, same Runtime reconstruction, stale detach, stale physical callback and original queued intent admission. Real SDK batch controls show original labels and disabled opacity for unknown writes. The streaming check tests still cover 1,777-row normalization, real completion counts and cancellation; retired checks release busy state with honest partial counters.

Additional defects corrected in this slice:
- Editor save checked uncertainty after setting busy; a rejected replay could strand busy. The guard now runs first.
- Unknown editor read retry used a confirmed-write failure phrase on read failure. It now preserves the unknown wording.
- Delivery callback/platform failure cannot turn accepted Core truth into a write failure.
- A cancelled queued initial read provides a real cancelled fact and read-only retry instead of indefinite loading.

Passing tests: test-source-tools-receipt-consumers, test-source-check-progress, test-commit-readback-facts, test-source-product-tools, test-source-selection-and-rss-projection, test-runtime-admission-teardown, test-index-native-alert-consumers, test-private-typography-budget, test-index-import-bindings, test-contract-test-tiers.

SDK evidence is emitted callback/Prop/ordinary-method behavior; it is not native scheduling, keyboard/focus or a signed HAP. The feature-local cache is warm process ownership, not a durable operation-receipt query. Core source mutations still lack an exact caller operation lineage query; this slice never calls a matching list row proof of an old uncertain mutation. Cold durable recovery must be separately established before claiming that stronger contract. Parent canonical paired SDK/HAP and target gates remain separate.
