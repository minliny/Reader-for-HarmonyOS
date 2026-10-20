# R3 — five RSS original-receipt consumers

Date: 2026-10-04. Existing UI is the migration baseline.

## Production chain

The existing Rules exact original authority and RSS Gateway/Orchestrator emit `RssOriginalMutationProjection`; Index only delivers the page DTO and captured intent callbacks. Management consumes `operation.original`, editor consumes `snapshot.original`, source feed/entry/main consume independent `emitOriginal` DTOs even when no ordinary page receipt exists. All five render the one actual `RssOriginalRecoverySurface`, which renders existing shared Notice/Action. Normal layouts and hidden aggregate/query product gates are preserved.

- Management: captured `reconcileOriginal(expected, presentationIdentity)` / `continueOriginal(expected, presentationIdentity)`.
- Editor: captured editor `reconcileOriginal(expected, presentationIdentity)` / `continueOriginal(expected, presentationIdentity)`. Draft/entity remain the original editor's responsibility.
- Entry: independent original DTO; `reconcileEntryOriginal(expected, capturedBinding, subscriptionId, guid)` pure query; `continueEntryOriginal(expected, capturedBinding)` only exact entry/original.
- Source feed: `reconcileSourceOriginal(expected, capturedBinding, subscriptionId)` pure query; no borrowed entry continuation.
- Main feed: `reconcileFeedOriginal(expected, emit, emitRead, current, emitOriginal)` pure query; no continuation on an unrelated feed.

Every physical callback captures Runtime, mounted Index identity, navigation, exact shared host, presentation attachment and entity. The tiny recovery action captures the complete typed original identity and qualification. The ordinary component tree remains intact. Native RSS delete/import confirmations and JSON import opening callbacks also carry the original attachment; an old same-Runtime callback cannot get or steal a new owner. The acknowledged business result survives unavailable native notice presentation.

## Executed code-level proof

`test-rss-cold-index-consumers.mjs`: **25 groups PASS**, actual Core SQLite/Atomic original → whole RSS Gateway/owners → actual Index methods/SDK bindings → all five fully decorated SDK-emitted pages → actual shared recovery controls/native physical click. Cold opening/reconcile causes zero apply; qualified continuation has the same operation ID and full original payload. Retired navigation/mount/Runtime/route/physical component and alive-A→B old getter/old detach are denied while B can act. A one-guard mutation negative control reproduces the original same-Runtime stale write.

Original matrices retained and passing: RSS Index ordinary read/write/readback/unknown/late-callback journeys; management owner closure; all nine Index native Alert consumers; RSS page architecture; portable local/online JSON import. Shared recovery's separate 17 groups remain passing. No capability is inferred from a current row or import snapshot.

These are installed-SDK transformation/real emitted component and actual Core code proofs. Native removal/layout/focus/animation scheduling, complete ArkTS frontend, HAP, device/visual and user acceptance remain separate evidence exits owned by the integrator.
