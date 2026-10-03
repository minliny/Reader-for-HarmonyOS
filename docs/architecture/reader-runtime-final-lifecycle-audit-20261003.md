# P3/A02 reading runtime exit audit — 2026-10-03

Baseline: Host `df14ecea9ed230a73b6f5dd54eb9ba4f270104ac`. Isolated lane `codex/p3-final-lifecycles-20261003`; the integrated source is frozen for the root's artifact gate. This audit evaluates responsibility and real producer→owner paths, not source line count.

| Original responsibility | Actual owner and consumer | Remaining required work |
| --- | --- | --- |
| Paragraph layout | ReaderParagraphLayoutOwner; LRE passes real measured ranges, forward/reverse whole-paragraph batches and cursor changes | Native measurement/rendering and performance remain separately verified; no further extraction justified by file size |
| Physical pagination | ReaderPhysicalPaginationOwner; real page fit, gaps, append/prepend, exact observed boundaries/index | LRE retains native metric→DTO adaptation and reactive publication |
| Progress | ReaderProgressProducerHost → ReadingSessionProgressOwner → real CAS gateway; continuous, TTS and accepted exit-visible progress share durable/unknown admission | Legacy no-CAS unknown writes remain blocked/read-only, explicitly not treated as confirmed by an ordinary snapshot |
| TTS config/playback | ConfigurationHost owns save/metadata/activation facts; SessionCoordinator and native host/router own playback/transport/resource leases | App-local preferences still need lifecycle/book/coordinator + predispatch admission (item 2 below) |
| Presentation/motion | Retained reading/control tree, sole motion progress and actual stage spec; mounted frame ACK and reduced-motion endpoints | Keep transactional visible/prepared page and UI publication in LRE; do not remount/extract solely for smaller files |
| Images | BodyImageHost owns native/file reference counts and decoding | Item 1: LRE cleanup looks up static Runtime after teardown; move session lease decisions to captured allocator owner |
| Duration/exit | Core atomically adds elapsed time, LRE currently owns clock/queue | Item 3: no durable operation ID/receipt; lost ACK replay double counts and two catches can allow an unconfirmed exit |

## 1. Image leases — implemented candidate

`ReaderReadingImageResources` owns only this reader's retained acquisitions, original URI/PixelMap identity, duplicate-acquisition balancing, pruning and close. It captures the actual allocator at construction. BodyImageHost remains the native/file refcount owner; no second cache, decoder, or refcount was introduced. LRE supplies its real retention predicate because current chapter, pending selection origin/candidate, retained chapter window and prepared/visible fragments belong to its presentation transaction.

All cleanup paths delegate to that captured owner, including unadmitted late acquisitions. Retiring the static Runtime cannot redirect cleanup to a new Runtime or interrupt paragraph/window/observer/coordinator/measurement cleanup. Thrown release calls are counted and diagnostics isolated; they have no atomic native release receipt, so they are not blindly replayed or claimed confirmed. Existing Ability-level display-file cleanup remains the fallback. The pool supports reuse after close without remounting the tree.

Evidence: `test-reader-image-resource-lifecycle.mjs` executes the actual owner and actual LRE cleanup/retention methods after static Runtime retirement, plus duplicate acquisitions, pending late images, close idempotence and release/diagnostic exceptions. `test-reader-known-image-geometry.mjs` continues the actual geometry→publication→lease path. Existing pagination and recoverable-entry regressions are unchanged in meaning. This is code/method evidence, not native deletion, ArkUI compositor, HAP, device, visual, or user acceptance.

Rollback: revert the image-owner commit as one unit (new owner, LRE callers, fixtures/tests/registration/document). Reverting only the leaf wrapper would reintroduce static Runtime teardown lookups.

## 2. TTS preferences — open until the next candidate

Seven preference mutations (mixing/background/keep-awake/failure policy/follow/pause-on-interruption/voice) currently guard only a mutation counter. A retired instance or changed book/coordinator can publish/rollback into a later lifecycle, and a queued gateway update may dispatch after retirement. Required fix: capture lifecycle, source/book, coordinator and operation counter; reject before actual dispatch after any restore/serialization/store-read waits. Once a real durable write was dispatched, retirement must not cancel its completion. Do not transplant playback state or policy to a global owner; retain the existing preferences gateway and coordinator owners.

## 3. Reading statistics — open, real Core contract gap

`ReadRecordAccumulateParams` has deviceId/bookName/author/elapsedMillis/readAt but no operation identity. `read_record_accumulate` delegates directly to storage addition. Both storage implementations atomically merge time; atomicity is not idempotency. Gateway only validates aggregate ACK, and LRE restores delta on any catch then repeats it. A missing ACK after commit can add the same delta twice. `flushReadingRecordForExit` retries once and then returns even when the second catch requeues data: the current failure path can therefore deliver route exit with unconfirmed duration.

Required minimum is a fixed operation ID per accepted delta, transactionally durable dedup/receipt with the same statistics update, exact-parameter admission and explicit unknown/error exit behavior. Ordinary aggregate reads cannot prove which operation committed. Receipt history must survive statistics clear/reset and config restore so stale replay cannot resurrect cleared totals; business backup must not transplant another installation's receipt authority. Shared Core DTO/schema/router files are coordinated with the P4 writer; no simultaneous edits.

## Acceptance boundary

Items 2 and 3 remain code/contract gaps; A02/P3 is not declared closed by item 1. Local/SDK/component, artifact, actual OS/native, performance/target, visual and user gates stay separate. Root holds HAP/VM; this lane has not used either.
