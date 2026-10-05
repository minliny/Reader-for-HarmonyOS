# RSS editor original owner and dispatch

Baseline: Host 7b56cd4b. The current application UI, hidden RSS entry policy and canonical Core source validation remain the baseline.

## Ownership

`RssSubscriptionEditorOrchestrator.forRuntime(runtime, originalRss.runSerialized)` retains one finite editor for the exact warm Runtime in a native WeakMap. Drafts, revisions, pending writes and confirmed/unknown receipts remain in that original editor when an Index is rebuilt. This is warm retention, not a durable Core receipt or a cold recovery journal. A matching subscription from a pure list read never settles an unknown write.

Index attaches an immutable physical identity using `attachPresentation(identity, emit, onSaved, isCurrent, admitted)`. `detachPresentation(identity)` only retires the matching attachment; an older view cannot detach its successor. Index callbacks capture the original editor, Runtime, mount and navigation identity and check them before editing or saving. Attach/detach do not cancel accepted Core writes or erase their receipts. The editor uses the original RSS serial lane rather than constructing a second mutation queue after view replacement.

## Dispatch and results

`RssGateway.observeWrites(evidence, admitted)` captures the original call admission. All RSS mutations check the captured Runtime and physical admission after Runtime startup, immediately before the synchronous Core call. The dispatch hook runs once at that boundary. Import picker acquisition and startup waiting are not dispatch. Qualified Core ACKs remain distinct from current-data reads; typed Core non-execution responses can reject that current dispatch, generic errors cannot.

Late ACK settlement belongs to the original editor. It retains its original revision and returned Core identity, but cannot navigate or replace a newer editor. A newer draft remains editable, and a confirmed create is subsequently updated by its returned identity. Observer and logger errors do not turn a confirmed task into a business failure. Unknown writes remain blocked; refresh/read retry remains a pure read. No automatic replay, compensation, new global task bus or new parser is introduced.

## Evidence

`test-rss-editor-retained-admission.mjs` uses installed SDK emission of the entire production editor/Gateway, the actual Runtime requestDirect method and a controlled native IO boundary. It covers warm reconstruction with lost ACK, shared lane retention, precise old detach, actual startup retirement, original late ACK versus newer draft, observer/logger failure and import dispatch timing. Two production negative controls remove final admission and retained owner lookup, and are detected by those journeys.

The existing editor, route, management, Index/SDK, runtime retirement, typography, projection, responsive and page architecture checks pass in this isolated lane. Index's new factory/physical consumer migration is separately required before closing the family. Full ArkTS/HAP, filesystem/native target behavior and cold Core RSS receipts are not proven by these controlled tests. Visual/user acceptance remains deferred by the user.
