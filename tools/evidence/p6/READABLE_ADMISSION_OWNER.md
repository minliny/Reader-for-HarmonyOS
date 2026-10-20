# Readable admission: canonical preparation + finite button owner

Baseline: Host 706d8af4. The prior add/cancel generation and five UI fields in Index were an independent owner. Add success refreshed the current page before its guard; cancellation reacquired a Runtime for its shelf lookup. Those paths could publish into a successor route or Runtime.

## Actual responsibilities

- BookAcquisitionCoordinator remains the sole durable `reading.preparation` and readable-body admission owner. Its original exact revision, body verification, tombstone, scheduling, progress and cancellation implementation is reused.
- ReaderCoreGateway retains the composite receipt decoder and complete shelf decoder. No protocol parsing was duplicated.
- BookshelfReadableAdmissionOwner owns only per-book accepted add/cancel button coordination, confirmation/membership facts, duplicate suppression, error and cancellation readback. It captures one exact Runtime, retains accepted tasks after UI retirement, and never substitutes a later current Runtime.
- BookshelfHost holds one feature-local exact Runtime lane and finite subscriber leases. Same-Runtime Index reconstruction sees the same pending task and cannot initiate another add. New Runtime obtains a different owner; old Host cannot replace the new cache.
- Index projects snapshots, emits admitted intents, and applies membership effects only for the originating live Runtime/navigation/book. A retained receipt on a reconstructed page is not used as current shelf membership: the existing detail owner must read its current canonical row.
- LocalBookDetail keeps the original scroll tree and reading button. Only the right-hand shelf actor keys by `admissionIdentity`; phase/label changes retain it, while another book/navigation/mount creates a small fresh actor. Both regular callbacks pass the immutable identity to Index. Actual V1 Prop update cannot promote an old physical handler.

## Honest facts and recovery

A verified add receipt is `confirmed` only after actual Coordinator completion and Gateway decoding. `BOOK_ALREADY_ON_SHELF` is a rejected addition and preserves the actual existing work/source. Generic failures and malformed receipt identities are `unknown`: they cannot initiate a second add. The existing explicit cancel action remains available.

Cancellation reuses Coordinator status/revision cancellation, then reads `bookshelf.get` in the captured Runtime. Gateway uses the captured current predicate before queue dispatch and after ACK; an abandoned query never becomes an absent-book fact. The result is current membership only; an existing row never acknowledges this add. A read failure retains cancellation uncertainty and permits explicit cancellation/status retry. An accepted body task still owns its slot until its promise settles, even after cancellation status has completed. No removal, progress reset, asset finalization or automatic add replay is introduced.

Accepted per-book tasks are limited to 16; active/unknown tasks are not evicted. Only 32 settled button snapshots remain. This is feature-local Reader business admission, not a second general scheduler or error bus.

## Validation

`test-readable-admission-index-owner.mjs` executes actual Coordinator → ReaderCoreGateway → BookshelfHost initializer → Index → SDK-emitted LocalBookDetail physical button for readable-body ACK and cancellation. Controlled actual methods also cover malformed/generic/duplicate results, nav/book/route/unmount/unavailable/replacement Runtime, same-Runtime reconstruction, independent books, cancellation read failures, capacity, synchronous subscriber retirement and immutable physical callback negative control. Existing detail scroll/geometry/actor, import/removal receipt, search identity, typography and preparation regression gates remain required.

Evidence is source/local/SDK extraction. HAP/native focus/layout, VM/device, visual and user acceptance are not claimed here. The remaining Index families and exact source-switch protocol are separate work; this slice does not close all P2/P6.
