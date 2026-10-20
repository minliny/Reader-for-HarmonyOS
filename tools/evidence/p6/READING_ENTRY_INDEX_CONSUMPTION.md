# Reading entry: actual Index consumer closure

Scope: the existing reading entry owner is now consumed by Index. The current
UI geometry, labels and persistent ReaderShell tree remain the baseline.
This is source/local SDK-emitter evidence; no HAP/device/visual acceptance is
claimed here.

## Actual chain

- `ReadingEntryHost.forRuntime(capturedMountedRuntime)` is the single feature
  owner for detail catalog/acquisition/candidate body admission, semantic session
  install, bounded content probe, cache refresh publication, optional canonical
  projection freshness and idle/visible shelf preparation.
- Index retains current presentation DTOs, its native Alert decision adapter,
  exact runtime/mount/navigation admission lease, reader physical-ready seam and
  original route/reader callbacks. `remoteSessionGeneration` is a projected domain
  token; it is not incremented by a second Index session owner.
- Deleted Index's detail projection active/pending queue, candidate/probe state,
  remote semantic evidence algorithm, background source/name/body freshness IO,
  local directory/bookmark IO and preparation IO/seed selection.
- Persisted/visible preparation reuses the existing exact revision seeds promise
  from the bookshelf catalog owner, and continues using Runtime's existing
  preparation coordinator. No new global owner or scheduling executor is added.
- Explicit membership uses a derived JSON tuple of the original bookshelf write
  generation and original readable-admission generation. A delayed independent
  catalog/body/name publish cannot overwrite a later explicit add/cancel/remove.
  `ReadingEntryMembership.generation` accepts existing numeric tokens and exact
  tuple strings; no hash, fresh acknowledgement or duplicate membership store.

## Presentation and callback contracts

- Shelf resume mounts reading immediately and executes no parent detail/body IO.
- A local first-frame TOC calls `replaceDirectory` in the same entry scope;
  native physical ready later invokes the captured owner directory closure.
- `recoverCachedChapter` is a finite public delegation to the existing owner's
  cache refresh algorithm. Index's `chooseCachedChapterRefresh` only settles the
  native primary/secondary decision. Runtime unavailable, native failure,
  navigation retirement, changed processing revision and old choices return
  safely without publishing a stale prepared body.
- Different detail admissions key the temporary LocalBookDetail child by its
  already-existing admission identity. Async state updates for one admission
  retain that child and deliver all decorated Props via the real SDK update
  payload. Old ordinary native continue/chapter/back/source callbacks require
  the captured identity and Runtime, and cannot borrow the next entry's book.
  The persistent reading subtree is unchanged.
- A recreated Index in the same Runtime uses the same Entry owner. Old Index
  teardown only retires its own matching scope, never the successor's lease.
- Physical directory/bookmark chapter navigation rebinds the presentation lease
  without acquiring a new body or mounting another whole reader.

## Verification

- `test-reading-entry-host.mjs`: all original 27 actual full owner/Gateway/
  coordinator/preparation journeys and 2 owner negative controls pass. Its full
  fixture moved to `tools/lib/reading-entry-index-fixture.mjs` without copying a
  production algorithm. Core SDK lookup now locates the actual isolated layout.
- `test-reading-entry-index-sdk.mjs`: 12 actual producer-to-consumer groups pass,
  including actual decorated LocalBookDetail and native action closures; first
  reader no-parent-IO; local post-frame/same scope; async Prop update without
  remount; old IO/native callbacks; same Runtime successor; removed-admission-
  guard negative control; 5 native cache decision/retirement/revision outcomes;
  actual visible/idle preparation and pause.
- `test-source-switch-index-owner-sdk.mjs`: all 11 existing actual SourceSwitch
  Host/Gateway/Index/Window/ReaderShell/LRE/Offline journeys pass with the actual
  Entry owner in the reader seam fixture. Exact finalized transaction ACK
  semantics remain unchanged.
- Test-tier registration and `git diff --check` pass.

## Required follow-up, not hidden as success

A read-only audit of historical probes is stored in
`/private/tmp/reader-entry-consumer-legacy-audit/RESULTS.json` with per-test raw
logs. Some legacy tests select deleted Index algorithms/classes or manually
construct a pre-owner component. They must migrate their original journeys and
assertions to the actual Entry owner, not restore a duplicate Index algorithm or
relax the business guards. New consumer tests do not count those old gates as
passed. The parent integrator owns the shared method-probe helper.

Directory/Offline persisted mutation consumer closure and their new exact
operation intent authority are a separate next slice. RSS editor warm ownership
is being implemented by the parent and remains an explicit follow-up. Final
combined full SDK/HAP/target acceptance is separate from these local claims.
