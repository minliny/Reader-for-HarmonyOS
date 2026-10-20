# Discover actual read owner and presentation contract — 2026-10-03

## Located fault and effect

The previous Index factory captured Runtime plus `route === discover`, and physical callbacks dynamically fetched the current factory. Returning to the same route, or constructing a new Index with the same Runtime, could let an old native/ordinary callback operate through a new presentation. Capturing nav/mount alone is also insufficient while an old Index is still alive: the successor may already have attached to the same shared business owner. The added actual SDK negative control demonstrates this case; removing the Index presentation guard makes the old recovery button issue a new read.

## Final boundary

The existing DiscoverOrchestrator now has a feature-local WeakMap factory for the exact current Runtime, one finite attach/detach lease, current canonical source/kind/page/operation, and the existing serialized read tail. The old constructor remains compatible. No global bus, new source algorithm or read executor is added. A replaced lease invalidates old read session eligibility; normal open retains the original known source selection while refreshing. A rejected/throwing attach cannot replace the current lease, and an old detach cannot clear a newer one. Closed Runtime lookup cannot replace a successor owner.

Index captures Runtime/navigation/mount/instance/host; only this temporary Discover page is keyed by its real navigation. All page operations target the captured original host. Physical/ordinary callbacks additionally check the owner's exact active presentation identity. The factory's attach predicate is deliberately only base scope, preventing recursive identity predicates. Navigation/disappear detach only the matching lease. Normal current UI geometry/assets/fonts/labels, existing product gate and persistent bookshelf/reader trees remain unchanged.

The existing DiscoverGateway explore reads and SourceGateway's optional `loadSources` read hook carry the original session/generation current predicate to actual Runtime last `canDispatch`/`canContinue`. The SourceGateway change is limited to that read method and is backwards compatible. A UI close during Runtime startup cannot start source/explore IO afterward. No capability or source-write receipt is inferred from a read.

## Verification

`test-discover-operation-consumers.mjs` preserves its original sources/kinds/pages/partial/malformed/empty/failed/scope retention/retry/concurrency/close/Runtime matrix. It now executes the whole actual classes via the installed SDK TS emitter. Its added actual Index → decorated feedback Page → real shared Notice/Action tests cover same-Runtime reconstruction, current physical pure-read retry, matching old detach, old same-route navigation callback rejection, wrong/throwing attachment and replaced/absent Runtime. The guard-removal negative control preserves the observed failure.

Three actual Gateway → production `ReaderRuntimeOwner.requestDirect` → controlled native Core transport journeys hold real `Runtime.start`, retire the original navigation, then release it. `source.list`, `source.exploreKinds` and `source.explore` each record zero new native IO for that old request; the current open remains usable. No cloned dispatch predicate is used.

Product-flow, source-tools existing receipt consumers, private Typography budget and full architecture consumer baseline remain required. The original 100 business budgets are not raised. This evidence proves code/local/SDK-emitted contracts; full canonical ArkTS/HAP, artifact, native layout/removal/pixels, target and user acceptance remain distinct exits.
