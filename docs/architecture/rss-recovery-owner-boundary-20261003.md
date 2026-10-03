# RSS receipt and recovery boundary — 2026-10-03

## Source and write ownership

Isolated Host checkout begins at integration `73cc7de1e7cdd7d6fea8fbc892ad65242e8e5ee2`, branch `codex/p6-rss-recovery-20261003`. No dirty-tree copy, Index edit, common Typography/SurfaceSpec edit, native/Core change, HAP or target operation. The production source/config parser, RSS XML/Atom/HTML engines, native storage/transactions and SDK transport are reused. This is Reader-specific receipt, route admission, UI projection and draft ownership, not a new RSS engine.

P5 exclusively owns Index. This commit closes the domain-side current main feed/source/detail/editor/favorite recovery contracts, not integrated P6 acceptance for the whole app.

## Current journeys and final behavior

| Journey | Data/receipt owner | Result and recovery |
|---|---|---|
| Main subscription list | RssOrchestrator `feedValue/feedRead`, actual `rss-source.list` | First-load and refresh facts are distinct; failed reload retains prior rows. Generation-qualified retry is a read. No `rss.entries.query` or hidden global refresh is opened. |
| Single-source list | RssRouteOperationHost source identity + existing orchestrator snapshot readers | Emits loading/current/failed with retained snapshot. Read retry carries latest generation. |
| Single-source refresh | Actual Gateway dispatch/decoded ACK + source receipt | Confirmed write followed by list/items failure is `confirmedRefreshFailed`. Recovery reads, never refreshes twice. Lost ACK remains unknown after a matching read. |
| Entry open/mark read | Host `(subscriptionId,guid)` state + existing Core mark-read/items/favorite readers | Read state comes from Core. Post-write read failure is independently visible. A retained unknown cannot be overwritten by mark-read/favorite replay. |
| Favorite add/remove | Host entity receipt + authoritative membership read | Recheck route admission after membership read and before dispatch. Successful favorite ACK and failed list/membership refresh remain separate facts. Failure cannot create optimistic favorite status. |
| Source editor initial load | Editor owner/session/key + actual full-source list | Loading/read failure and retry; typed drafts survive retry. Missing source is an explicit read failure, not a made-up empty source. |
| Source create/update | Editor captured draft revision, actual Gateway `rss-source.put` evidence | Draft validation before dispatch is undispatched. Save ACK followed by list failure remains saved with a read-only recovery. A newer draft is not replaced or auto-closed. Confirmed create identity is reused for subsequent explicit updates instead of duplicate create. |
| Editor close/reentry/runtime replacement | Shared serial lane, owner+session admission, keyed drafts/receipts | Unsent old session does not dispatch. Accepted durable writes settle despite closing; old ACK cannot publish/navigate the new editor. Same-key reentry waits accepted work; unknown remains locked with draft retained. |
| Management toggle/refresh/remove/import | Existing management receipt, now actual write evidence + dequeue session guard | Retained unknown blocks later management writes and import replacement; later intent does a read only and cannot overwrite the unknown. Confirmed writes survive refresh failure and retired UI. |
| File/URL source acquisition and export | Existing Host acquisition/save and management route guard | Picker cancel creates no receipt, acquisition failure dispatches no import, late selection cannot import. Export cancel leaves `destination` absent; current Index already avoids a success alert. Export does not mutate Core state. |

Normal page sizes, colors, typography roles, shell geometry and icon assets remain their current values. New shared recovery content appears for real loading/failure/unknown facts. Existing source and detail business actions now guard those facts; persistent main-page shell is retained. These are source/SDK claims, not fresh pixel evidence.

## Actual interfaces for Index (P5)

`RssRouteOperationProjection<T>` carries `action`, `subscriptionId`, `guid`, `projection: PersistedReceiptProjection<T>`. `RssRouteBinding<T>` carries `emit`, `failed`, `current`, optional `emitOperation`, `emitRead`.

Existing `loadSourceFeed/refreshSourceFeed/openEntry/setEntryFavorite` argument order is retained. Append the typed operation and read emitters. Every emitter must recheck the original navigation generation and subscription/guid identity before updating Index fields. Initial entry projection has its own loading/read facts; never fabricate a `favoriteState` from a write intent.

Child Props are `operation`, `readFacts`, `onReconcile`, `onRetryRead`. All Prop fields must be present in the SDK child update payload; SDK V1 one-way Prop resets omitted fields. Use:

- `reconcileSourceOperation(expected, binding)` / `reconcileEntryOperation(expected, binding)`;
- `retrySourceRead(id, expectedFacts, binding)` / `retryEntryRead(id, guid, expectedFacts, binding)`.

Main page Props are `readFacts`, `onRetryRead`. Replace direct new Gateway list reads with `loadFeed(emitSubs, emitFacts, routeGuard, expectedGeneration?)`. Preserve the existing empty `recentUnread` until an admitted aggregate query contract exists. Generation is an owner-created scalar, valid across actual ArkUI cloned Props.

Construct/reuse `RssSubscriptionEditorOrchestrator` only while `.owns(ReaderRuntimeOwner.current())` is true. Constructor parameters 4/5 are owner and `task => getRssOrchestrator().runSerialized(task)`; this reuses the real single RSS mutation lane. The snapshot adds `canSave`, `readFacts`, `operation`; pass it intact to the page. Recovery callbacks are `editor.reconcile(generation)` and `editor.retryLoad(generation)`.

UI delivery exceptions are logged locally and cannot change durable/write/read facts. Domain state is committed before guarded delivery. No global error bus is added.

## Lifecycle and resources

Queued route/editor operations check current runtime and original session/route again at the actual dequeue/dispatch boundary. Typed SDK `TRANSACTION_PENDING` is proven nonexecution and may safely wait/retry; all other dispatched uncertain outcomes remain unknown. Arbitrary snapshot equality never synthesizes a missing ACK.

Route snapshots retain at most eight settled full snapshots per map. Queued entities are protected. Unresolved records retain identities and exact facts even after large old values are released. Editor drafts are deliberately retained until a confirmed current revision completes, rather than silently dropping user input. Runtime retirement stops UI delivery, not already accepted native work.

## Verification and explicit remaining limits

Eight RSS scripts pass: architecture/static, persisted projection, management page, management typography, responsive layout, actual management Gateway→Index→SDK, new route recovery, and new editor recovery. Test registration also passes. The two new scripts execute actual complete production Gateway/owners, typed SDK errors, SDK-emitted closures and installed SDK observable/property proxy classes. RPC faults occur at actual method boundaries; the fixture replaces platform/native I/O only. Omission controls remove the real route/session guard and demonstrate that the late-ACK detector fails safely.

Covered faults include confirmed-save/read failure; lost ACK; typed noexecution; invalid local draft; malformed echoed ACK; membership-read retirement; queued retirement; close/reopen after accepted write; runtime replacement; newer draft during save; stale cloned recovery generation; repeated recovery; live @Prop replacement of action guards; UI delivery exceptions; retained unknown after snapshot release. This does not simulate native dependency scheduling, physical layout, OS lifecycles, real endpoint/permission behavior or pixels.

Still open:

1. P5 actual new Index operation/read emitter wiring and full Gateway→Index→page tests for the new consumers. Existing management integration is tested here; new consumers deliberately do not assume unpublished Index fields.
2. Full integrated source/local/ArkTS/build/artifact checks, then the separately authorized target layer. No HAP/VM/device use in this lane. Visual/user acceptance remain deferred.
3. RSS protocol has no operation-ID/final-receipt query for unknown mutations. Read-only reconciliation displays current truth but cannot declare the lost command confirmed, canceled, or safely replayable. Unknowns survive this runtime and reentry; there is no durable cross-process Host journal or cross-owner RSS tombstone. Their behavior across process restart remains a native/protocol contract gap, not a completed receipt-resolution feature.
4. Existing aggregate All/Favorites/Rules modes, global RSS refresh, full-article/webview Host navigation, system picker/storage/network permission execution and background refresh are not opened by this change. Favorite membership in the existing detail page is covered; the unsupported top-level Favorites mode is not.
5. Management unknown barrier, entity unknown barrier and editor unknown barrier are scoped; they are not a new global transaction journal across every RSS subdomain. Core still owns actual transaction exclusion. Stronger cross-domain/cross-restart unknown resolution requires an admitted Core final-receipt contract and tests, not a matching list read.

Rollback is the isolated RSS commit plus P5's separate matching Index wiring commit. No schema/native/storage mutation is introduced. Reverting UI/owners preserves saved Core data; it cannot undo a native command already dispatched.

## Runtime-unset retirement admission follow-up

A read-side audit found a real teardown gap: `ReaderRuntimeOwner.close()` unsets the installed singleton, and `current()` then throws. RSS owner comparisons previously called this throwing accessor inside UI admission, including after a write ACK. That could enter an error catch after durable confirmation and re-enable a pending editor draft.

`RssOrchestrator` and `RssSubscriptionEditorOrchestrator` now use private, bounded `ownsRuntime()` comparisons that return false on teardown. `RssRouteOperationHost` safely admits both runtime and route callbacks. This changes only admission: the Gateway remains the receipt source, dispatched writes still settle, unknown remains unknown, and a retired UI receives no late update or navigation.

`test-rss-runtime-retirement-admission.mjs` executes the exact production static `current()` with the singleton unset, then real Gateway/owners with deferred ACK and lost ACK. It proves retained confirmed/unknown receipt, released pending state, preserved locked draft, skipped follow-up read, no replay/callback, and a removed-guard negative control. Existing route/editor/management directed gates also pass. Native shutdown behavior and target evidence remain separate.
