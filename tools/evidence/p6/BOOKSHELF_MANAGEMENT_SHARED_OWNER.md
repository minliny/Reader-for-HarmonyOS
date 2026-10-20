# Bookshelf management / default-group shared owner

Scope: the existing BookshelfHost → BookshelfManagementOrchestrator → BookshelfManagementGateway domain. This slice preserves the normal current Dialog/Selector and management-page layout, labels, typography and dimensions. It adds the existing shared Notice/Action only when actual operation/read facts require recovery.

## Production chain

- Every original create/update/show/delete/assign intent, including the default-group quick Dialog, uses one exact Runtime's existing Management Orchestrator. BookshelfHost retains that original lane with a native WeakMap. Reconstructed Index presentations attach/detach only their immutable ID; they do not create a second tail or reset accepted facts.
- The original owner reserves one mutation before enqueue. It retains `operationTail`, `ReaderWriteEvidence`, busy/read/receipt facts and an unknown barrier together. New mutations are rejected while a write is reserved or the original ACK is unknown; draft changes remain separate.
- The Gateway marks dispatched only in actual Runtime `onDispatch`, with captured original Runtime/presentation `canDispatch`. There is no shouldCancel on accepted durable commands. Canonical composite book identity and desired group are qualified before confirmed.
- Accepted late ACK/error settles the original domain facts even after its UI retires. Observers publish only to the currently admitted attachment. Current list equality cannot confirm an old operation. Old Index rebinding and matching detach cannot steal/clear the successor attachment.
- Index uses immutable Runtime/nav/mount/Host/identity callbacks for the management Page and immutable opening/book tuple callbacks for the quick group. Closing a presentation cannot remove another opening. A saved write followed by failed reading retains confirmed truth; recovery refreshes groups/books/records only and never repeats assign/create/update/delete.
- The normal quick-group success still refreshes the existing shelf and closes its original Dialog. Unknown and confirmed-refresh-failed keep the existing surface with shared honest feedback and the explicitly read-only “核对分组” action.

## Verification

`test-bookshelf-management-shared-owner.mjs`: 15 actual Host / existing Orchestrator / actual Gateway and ReaderCore decoding / Index / installed SDK Selector + Notice/Recovery and real management Page native-button groups. Covers the five mutation intentions, exact tuple, last startup admission, double action, confirmed/readback failure, lost/malformed ACK, pure recovery, unknown barrier across domains, same Runtime Index reconstruction, stale attach/detach, late ACK, unavailable Runtime and a last-dispatch guard-removal negative control.

Existing strict tests retained: management receipt consumers (including actual Rules AtomicFile/Core SQLite fixture), book removal, JSON real surface/layout/spec propagation, Bookshelf view/menu, management typography, Host wiring and Core ownership. Architecture has the original 100 business budgets, 8 shared owners and 19 policies; the actual native-call gate counts type annotations separately and does not increase budgets. Private typography remains unchanged.

The controllable transport in the new warm-owner test is a test seam; it is not a Core SQLite/cold receipt proof or a native scheduling/device/focus acceptance. Installed SDK transformation and physical handler tests do not claim device rendering acceptance.

## Required next slice — not closed by this commit

Legacy Core `book-group.create/update/delete` and `bookshelf.group.assign` have canonical ACK payloads but no caller operation lineage/query. The original `show` intent uses update. A process restart currently cannot prove an old lost ACK, and this is a required architecture capability, not an OS limitation.

Core agent is implementing `bookshelf.management.mutation.apply/query` with original complete caller ID/sequence/DTO and bounded exact receipt/head, preserving legacy commands. Host must then retain one complete fixed-domain AtomicFile pending intent across Runtime/Ability/process reconstruction; pure query must use the exact original tuple; explicit same-ID continuation must be permitted only by its Core qualification. Matching current entities and a missing/higher unrelated head must never unlock an unknown write. These cold contracts, actual SQLite restart and all real consumers remain required before full family/P2 closure.
