# Bookshelf write/readback and local import presentation owner

Scope: preserve the current UI/layout/copy. Move the existing remove-single,
remove-batch and local-import lane from Index to the existing BookshelfHost.
This is a real state/dispatch/receipt descent, not an IO forwarding wrapper.

- BookshelfOperationOwner owns the exact Runtime, feature-wide mutation mutex,
  operation generation, retained ACK/readback/cleanup facts, read-only reconcile
  and import task. BookshelfFlowGateway, ReaderCoreGateway and the existing
  local import journal/asset implementation remain the authoritative IO paths.
- LocalImportPresentationOwner owns opening identity, close/reopen retirement,
  validation, restored data and atomic process-local serialization. Index keeps
  only one typed projection, route/entity/navigation admission, platform
  AppStorage publication and installing the current legal shelf DTO.
- One bounded exact-Runtime owner in BookshelfHost survives a new Index/Host
  after the system picker reconstructs the page. Each Host subscribes only its
  UI adapter and detaches on disappearance. A retired Host cannot replace the
  replacement Runtime's cached lane. There is no global task/error bus.
- A same-opening new Index may adopt the presentation lease for the accepted
  picker/task. Closing/reopening changes the identity: the old batch cannot
  become the new result, and the accepted mutex stays occupied until settlement.
- Late valid ACKs remain truthful domain receipts, including after navigation
  away; old route/entity callbacks cannot replace the new page's shelf. Runtime
  replacement suppresses every old publication while accepted work settles.
- Unknown write remains unknown after a later matching/missing shelf row; retry
  is a read only and never repeats remove/import/persist/finalize/asset cleanup.
- Follow-up read failure and retained EPUB cleanup failure cannot erase an ACK.
  Partial local imports retain the real per-file batch and existing usable books.
- Index keys only the temporary LocalImportDialog opening subtree. Phase changes
  keep the same dialog. Its ordinary V1 callbacks capture the opening/runtime/nav
  tuple; actual shared native primary/cancel handlers for an old actor are denied.
- Import fallback uncertainty is marked only by the gateway's actual
  import.persist invocation observer. A generic throw never proves undispatched.
  Restored AppStorage result is presentation data, not an ACK for a new operation.
  A new Runtime cannot resume a picker/task solely from a UI string.

Validation: actual gateway → Host owner → real Index Host field initializer →
SDK-extracted Index Builder → real LocalImportDialog shared Actions and public
RecoveryNotice/Action; controlled RPC/native boundaries. Cases include ACK/
refresh failure/cleanup failure/typed admission/partial or malformed payload,
unknown barrier, read-only retry, once-only/reentry, route/nav/owner teardown,
close/reopen and same-Runtime new Index at picker/mutation stages. The opening
callback guard has a negative control proving the old physical cancel would
close a successor if the guard were removed.

Source/local and SDK extraction are distinct from an ArkTS HAP build and target
behavior. This slice does not claim HAP/native picker lifecycle, device focus,
VM/real-device visual or user acceptance. No device operation was performed.

Remaining P2 families: readable-book admission/cancel is already executed by
BookAcquisitionCoordinator but still has Index button/error coordination to
move. SourceSwitch has an independent domain-owner candidate and awaits Index
migration. Offline/directory/reader seams must retain their actual existing
owners and be assessed individually; direct RPC count alone cannot close P2.
