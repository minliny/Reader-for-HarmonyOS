# R0–R8: six shared-control consumer regressions

## Inputs and ownership

- Clean Host worktree: `/private/tmp/reader-p5-r0-r8-test-closeout-20261004`, branch `codex/p5-r0-r8-test-closeout-20261004`, input `7c1d12f6b255cb1094d3fc60b39867e11711a141`.
- Input production blobs match the authoritative canonical Host `b3bc6c4990d9c4a2c2920334bb800462659ed6e6` (`git diff --stat b3bc6c49 7c1d12f6` is empty).
- Existing Core CLI/source: `/private/tmp/reader-full-architecture-delivery-20261003-1845/Reader-Core-Native`, `888a3ef5af643ca1e11267c8b332ee7591b036af`. No Core rebuild.
- Original failed logs are retained under `/Users/minliny/Documents/Reader/evidence/2026-10-03-full-architecture-execution/r0-r8-closeout/canonical-b3bc6c49/contracts/`.
- This slice changes six assigned tests and dedicated test helpers. No production, Index, shared control, root-owned builder probe, central worktree, signing, installed application or canonical artifact is changed.

## Root causes and retained proof

| Test | Original failure | Actual replacement and retained contract |
| --- | --- | --- |
| `test-book-source-import` | Required a private Page `.onClick(onAddSource)` that the shared labeled Add now owns. | Actual Page `bottomActionBar` → `ReaderLabeledIconAction` finite `source-management-add` → native hit target. Import intent, disabled and retired actors, real registered feedback reset with zero import intent; complete original decoder, picker, serialization, dispatch, refresh and failure contracts retained. The historical decoder path explicitly disables the modern capability; it is not represented as a modern exact receipt proof. |
| `test-bookshelf-physical-feedback` | Two Source cases searched only parent Text/Stack nodes. Shared login/detect Text and native actions live in SDK children. | Real common components and creation order preserve distinct name/category/URL/error message, login before detect, both callbacks, exact 44×28/r7 targets. Busy `检测中` retains .62 opacity and cannot dispatch a second check; retired actors cannot dispatch. All original 19 cases retained. |
| `test-reader-feedback-regressions` | Required the old private search background/opacity/onClick topology. | Complete Index → SearchPage → actual ReaderButton native search/stop, exact dark fill, busy lexical leading → real 13px SearchSpinner/LoadingProgress, actual disabled Props/native state, retired actor and press/normal modifier reset. All unrelated original reported feedback contracts retained. |
| `test-search-operation-consumer` | Required retry `.onClick` directly in SearchPage. | Original seven owner capability cases retained. Error/partial/empty Page Builders → actual common buttons → native handlers, retry allowed/refused, disabled error/partial actors, retired controls, interrupted native result text. A compiled production negative control deleting `retryOperation`'s capability guard makes the same physical empty actor dispatch, demonstrating the guard's necessity. |
| `test-source-index-presentation-consumers` | Login/detect/Add/retry searched parent-only native nodes. | Locate exact finite shared actor then its real native hit target. Original actual Gateway/Orchestrator/Host/Index initializer and 11 physical current/old-owner/getter/ACK/read/unknown/remount/late picker/nav/mount/Runtime/native alert/negative-control cases remain unchanged. Recovery still performs reads and never repeats writes. |
| `test-source-settings-receipt-consumers` | Source recovery fixture used a dummy obsolete recovery component and parent-only Text lookup. | Actual Source `statusBanner`/`recovery` + full Index child payload → actual shared ReaderButton native retry. Original Source/Settings ACK versus refresh failure, unknown, read-only recovery, reopen, late, retired Runtime, malformed payload, typed admission, Preferences accepted choice and explicit retry matrix retained. Settings continues using its actual bounded recovery components. |

The helpers compose installed SDK emitted production classes and existing property runtimes. They do not reconstruct Page/Index action lambdas or introduce replacement production owners. Only native geometry, domain test transport/presentation DTOs, and the existing platform seams are controlled. Full decorated Prop updates preserve omitted-Prop reset semantics; ordinary callbacks remain constructor-bound.

## Results

- Six assigned tests: **6 PASS / 0 FAIL** after the final changes.
- Required existing helper regression `test-search-index-action-attachment`: **10 actual complete Page/Icon/Button/Index physical cases PASS**, including each independent Runtime/route/navigation/mount/Host guard-removal negative control. All nine old UI intents reject.
- `git diff --check`: PASS.
- Final logs and exit-code/hash record: `/Users/minliny/Documents/Reader/evidence/2026-10-03-full-architecture-execution/r0-r8-closeout/p5-shared-controls-20261004/RESULTS.json`.
- All six tests run with the existing private Core root supplied through `READER_CORE_ROOT`, `READER_RULES_RECEIPT_CORE_ROOT`, `READER_SOURCE_SWITCH_CORE_ROOT`, `READER_READING_RECEIPT_CORE_ROOT`, and `READER_BOOKSHELF_MANAGEMENT_CORE_ROOT`.
- The book-source test exclusively owns its temporary Core/files fixture and now retires/removes that exact fixture only after every accepted call is awaited. Shared CLI, other tasks' fixtures and all logs remain protected.

No production defect was found in these six reported failures. The first expanded feedback assertion also exposed a test assumption: a BuilderParam executes with the lexical parent owner, so its SearchSpinner is a real Page child rather than a child owned by ReaderButton. The corrected assertion locates the actual lexical child and requires active native LoadingProgress; no spinner code or acceptance assertion was removed.

## Evidence boundary

This is code/installed-SDK source execution, not a complete application gate or deployment. Pressed/normal modifier execution proves the actual finite tuple resets and issues no business intent; it does not prove HarmonyOS sends a physical Touch Cancel to that state. Actual native dispatch, focus, layout, compositor visuals, HAP, VM/physical device and user acceptance remain NOT_RUN here. This slice does not close those layers or the entire R0–R8 program.
