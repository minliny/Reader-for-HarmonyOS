# Sync Runtime owner and presentation retirement

The previous Index factory created one SyncOrchestrator per Index. Although the
credential Store was shared, the operation chain, busy mutex and latest receipt
were independent. A same-Runtime replacement could start another write while
the original task remained in flight, or lose its unknown barrier.

`SyncOrchestrator.forRuntime` now uses the platform WeakMap, as the existing RSS
owners do, to return the same finite feature owner for the exact current Runtime.
No static strong reference solely pins a retired Runtime. This is ownership
discipline, not a GC or memory-budget measurement.

`attachPresentation(identity, emit, read, current)` replaces only presentation
callbacks. Matching `detachPresentation(identity)` releases those callbacks;
an obsolete detach cannot retire the successor. `open` while busy replays the
same task facts without resetting the mutex or starting another load/write.

Index must capture the original mount/navigation attachment ID and guard every
physical callback with `isPresentationCurrent(id)`. Its attach predicate checks
only base Runtime/mount/route admission, avoiding recursive guards. In particular,
a previous Index that has not yet disappeared cannot reattach itself or borrow
the successor's lease. Index integration is owned by its separate single writer.

The original write contracts remain:

- A config preparation whose native Asset add returns after its presentation
  retired cannot use a successor lease to write the current head. It retains
  the original operation ID and unknown fact; the successor explicitly continues
  that same configuration and ID. Pure reads do not acknowledge the write.
- A backup/restore already dispatched continues its accepted original transaction
  under the original Runtime. No second queue is created by page replacement.
- A retired Runtime cannot dispatch through the replacement Runtime. Late facts
  cannot publish to the retired presentation. Password fields remain excluded
  from emitted snapshots.

`test-sync-runtime-presentation-owner.mjs` executes complete production
Store/Gateway/owner methods through the existing real AtomicFile adapter, plus
the installed SDK transformation of SyncPage. It covers replacement during
native add, one mutex, exact unknown/explicit continuation, original parameters,
matching cleanup, accepted restore late ACK, secret omission and Runtime removal.
Nine original Sync/credential suites also passed without removing their cold,
unknown, durable-ID or stale-actor assertions.

Initial exploration incorrectly allowed config head writes after UI retirement;
three original suites rejected it. Their assertions were retained and the
production admission was restored. That failed experiment is not a deliverable.

Full application ArkTS/HAP, OS native scheduling, immutable artifact provenance
and target behavior remain separate exits. This slice alone does not close P2.
