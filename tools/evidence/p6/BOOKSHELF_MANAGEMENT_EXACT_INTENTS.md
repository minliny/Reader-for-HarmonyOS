# Bookshelf Management: exact original write recovery

This vertical slice preserves the current group editor, rows, assignment selector, quick default-group Dialog specification and original operation ordering. It adds a bounded cold recovery contract to the existing Management Gateway/Orchestrator/BookshelfHost. Normal state retains the existing dimensions and text roles. Opening the quick selector now performs an independent original-intent read before allowing a new mutation.

## Actual consumers and single authority

- `BookshelfManagementGateway.ts` routes create/update/show/delete/assign through `BookshelfManagementIntentStore.ts`; it still decodes the existing original typed Core ACK and current lists.
- `BookshelfManagementIntentStore.ts` owns one fixed `reader-bookshelf-management-intent-v1.json`, full UUID/sequence/finite original DTO, actual AtomicFile fsync admission, an original qualified terminal receipt, and the existing SHA-256 implementation. It has one bounded IO tail across Runtime replacement; the original Orchestrator owns the business write tail/mutex.
- `BookshelfManagementOrchestrator.ets` keeps accepted business truth, exposes the original mutation state and explicitly qualified `continueOriginal(generation, presentationIdentity)`. Current list values never clear unknown. Ordinary `reconcile` remains read-only.
- `BookshelfHost.ets` retains its exact Runtime cached Management Orchestrator and delegates the explicit continuation; no second management owner was introduced.
- `Index.ets` binds page callbacks to the original Runtime/mount/navigation/Host/presentation identity. Quick-group opening restores the original receipt. Its continuation is available only for the exact original source/book/default-group tuple; pending book A cannot present continuation as book B.
- `BookshelfManagementPage.ets` renders the actual shared RecoveryAction. The explicit continuation label is `继续原分组操作`. Read and continuation actors use immutable original generations in a small keyed subtree; the persistent application tree is retained.

The added fault state may contain a second compact shared Action for qualified continuation. This necessary recovery state is registered for later visual refinement; current successful UI geometry is preserved. No private font, button background, radius or baseline budget was added.

## Protocol and factual distinctions

Paired Core: `4e7151eab05782b7bb642f6eef15fbea1accd67e`.
Capability: `bookshelf.managementMutation.v1`; original schema 34/protocol v1/ABI 1 remain unchanged.

`bookshelf.management.mutation.apply` sends the original UUID/sequence plus one finite `book-group.create`, `book-group.update`, `book-group.delete` or `bookshelf.group.assign` DTO. Show is the original update `show` field. The actual last boundary uses `canDispatch` and `onDispatch`; post-dispatch UI retirement does not erase the accepted write.

The returned direct receipt binds ID/sequence/typed payload fingerprint and the original typed result. Its ACK fingerprint is validated by the existing SHA-256 of `[method,outcome,data]`. Applied/rejected receipts have distinct facts. Losing local terminal cleanup does not turn a qualified Core ACK into a write failure.

`bookshelf.management.mutation.query` includes the complete original `expected` tuple. Receipt absent, higher head, unrelated ID and qualification failure stay blocked. Core `canApplySameOriginal` means safe idempotent admission of that same tuple, not proof of non-dispatch. A recovered exact receipt is settled without applying again, even if Core also permits an idempotent replay. Only the separate explicit continuation issues the same complete original ID/sequence/DTO.

Corrupt/unreadable original records stop new mutations and retain uncertainty. Current groups/books remain readable. Metadata cleanup and UI readback can be retried without another mutation. A known terminal receipt remains confirmed through Runtime retirement and local cleanup failures.

## Executed evidence

Core CLI: `/private/tmp/reader-bookshelf-management-receipts-20261003/target/debug/reader-cli`, SHA-256 `45008575f13c41b3ffcb397dcd93729694b9d4e33b0c829581683f0a1ccae38c`.

The thin native IO test adapter executes the actual `replaceReaderAtomicSnapshot`, SDK-emitted production Store/Gateway/Orchestrator/Host and actual SHA-256 code. Each RPC starts an independent Core CLI process against the same SQLite data directory, providing cold receipt evidence rather than an in-memory matching entity. Fixture initialization performs a separate read to avoid racing fresh SQLite migration files across CLI processes; production uses one native Core instance.

- `test-bookshelf-management-durable-intent.mjs`: **24 matrices PASS** — all five intents; actual Atomic fsync/rename lost ACK; before/after Core commit; current same-value entity not receipt; exact pure query; explicit same-ID original continuation; higher head; malformed tuple/ACK/record; qualified rejection; last dispatch admission; Runtime retirement; terminal cleanup.
- `test-bookshelf-management-shared-owner.mjs`: **20 matrices PASS** — original 15 scenarios retained and migrated to actual Core authority, plus unresolved no-effect original, actual cold Index→decorated Page→shared RecoveryAction, old retained physical generation, other-book scope, replacement presentation, and confirmed-write/local-cleanup recovery. Current actors work, stale actors refuse; no read retry repeats a write.
- Existing Management Gateway→Index→SDK read/write/unknown/retry/close/reopen/late/owner/malformed assertions pass for both Rules and Shelf consumers.
- Existing group/Dialog 11 Controller/SDK opening A/B assertions, management Core ownership, typography and unchanged architecture budgets pass.

Commands use `READER_BOOKSHELF_MANAGEMENT_CORE_ROOT=/private/tmp/reader-bookshelf-management-receipts-20261003`. The combined Rules/Shelf historical consumer gate additionally supplies its matching `READER_RULES_RECEIPT_CORE_ROOT`.

This is source/local/installed-SDK-emitter evidence, with actual cold native Core CLI. Full application ArkTS/HAP, device behavior, visual review and user acceptance remain independent exits; this slice does not claim them. Bookshelf remove/removeBatch cold authority and other domains remain separate required work and will share this same pending/tail, not create another sequence or journal.
