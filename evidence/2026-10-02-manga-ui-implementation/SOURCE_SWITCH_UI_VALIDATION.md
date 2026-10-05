# Source switch UI chain review

Scope: source/production-method tests in isolated `codex/manga-ui-20261002`.
No build, VM/device operation, push or product-source edit is performed by
this final audit. Current source and test hashes will be recorded at completion.

## Findings recorded before verification

- `Index.sourceSwitchProbeQuery` scopes a session to exact source/book identity,
  but its non-empty TOC branch currently derives content kind from only that
  session, unlike the empty TOC branch's session-or-book fallback. A manga shelf
  detail with retained TOC and no matching session can be probed as text.
  Root was notified to resolve the product branch; this agent edits tests and
  evidence only.
- `Index.onPickSource` currently selects the manga transaction solely by the
  unscoped `remoteReadingSession.contentKind`; use the same exact identity and
  durable book content kind, then require a matching ready manga session for
  prepare/commit. This prevents an unrelated stale session owning a choice.
- `test-manga-source-switch.mjs` still expects a second approximate-position
  dialog, while the approved source-choice interaction authorizes the prepared
  approximate landing directly. Existing prepare/first-image/landing-image,
  progress CAS, identity and unknown-commit reconciliation protections stay.
  Tests will be updated only after recording the initial stale expectation.

## Verification plan

Each Node command is limited to 120 seconds and uses actual production methods
or gateway code, without native builds or device access:

- `tools/test-manga-ui-source-switch-discovery.mjs`
- `tools/test-manga-ui-source-switch-window.mjs`
- `tools/test-source-switch-gateway.mjs`
- `tools/test-source-switch-transaction.mjs`
- `tools/test-manga-source-switch.mjs`

Follow-up focused Index coverage checks exact identity/type, stop retention,
incremental/late callbacks, direct preview, and manga prepare/commit/reconcile.
Final outcomes and limitations are appended after execution.

Initial execution: discovery/window tests passed in 0.120/0.336 seconds. The
legacy gateway test failed after its gateway/PH70 groups at the known-first-paint
Index assertion: the new `refreshCandidates` begins with an empty candidate set
and omits the already-painted cached/live Search seeds. A later empty relation
projection can erase them; root was notified to retain them through a compatible
initial-candidate parameter. This is a product regression, not a removed test.

The transaction UI assertions still target the old disabled local source pill
and old `Repeat(this.candidates())`/`CandidateRow` composition. Approved UI now
uses a conditional guarded action and the live-row Window. Those assertions
will target current real behavior, retaining exact composite identity and
transaction/rollback checks. Initial result exit 1, 0.057 seconds.

The manga gateway image/CAS tests passed, then its Index fake `commit` asserted
the removed second-dialog consent callback had run. Initial result exit 1,
0.345 seconds. The updated Index test will model source-choice authorization,
cancel during preparation, preparation failure, lost response and navigation
fences; no prepare/image/CAS requirement is removed.

## Final outcomes

Root's follow-up was re-audited. The TOC-backed probe now uses
`(session?.contentKind ?? book.contentKind)` and the exact source/book session
identity. Manga selection now rejects an unrelated session, restores a typed
manga catalog when the in-memory session is missing, and checks the restored
identity before progress/prepare. Preview seeds preserve candidate content kind.
`refreshCandidates` accepts prior/cached initial candidates; Index passes those
seeds after clearing only stale search timing, so incremental callbacks cannot
erase the known first paint. The live Window retains composite `(sourceId,
bookUrl)` keys, stop/late-callback guards, measured search latency, and
transaction rollback state.

Final production-method tests all passed within one second each:

- `test-manga-ui-source-switch-discovery.mjs`
- `test-manga-ui-source-switch-window.mjs`
- `test-source-switch-gateway.mjs`
- `test-source-switch-transaction.mjs`
- `test-manga-source-switch.mjs`

The final logs and SHA-256 inputs are in `SOURCE_SWITCH_UI_VALIDATION.json` and
`source-switch-ui-logs/*-final3.log`. The initial failures remain alongside the
final logs to preserve the audit boundary. No Native/HAP/device result is
inferred from these Node and ETS method checks.
