# Search list stability: issue-local source evidence

User report: streaming search results reorder/flicker while the user is choosing a book; a refresh during a tap may open a different book. This evidence covers the ordered projection only. Pointer identity and publication pacing belong to the separate SearchPage/Orchestrator changes.

Source diagnosis: SearchResultProjection.update previously sorted all visible groups whenever an existing row's relevance score or admission order changed, and when any new group arrived. Consequently a late exact match could move all existing rows. SearchViewState retained admission ranks but no displayed sequence, so remounting the projection could repeat that reorder.

Implementation scope: SearchResultProjection.ts and query-owned displayed-order state in SearchViewState.ts. Preserve all source identities, same-book grouping, media boundaries, representative-source ranking, variants, shelf facts, and anchor redirects. Sort the first batch by the existing relevance comparator; retain already displayed groups and append newly admitted groups afterward. A genuine replacement key may take the removed key's place, whereas a merge into an already displayed key retains that target's existing place. Persist only currently live displayed keys and clear the sequence on query reset.

Exact local validation entry: node tools/evidence/search-list-stability-20261020/projection-probe.mjs. Nested calls are only direct imports of the production Projection/ViewState and their pure TypeScript dependencies: author identity, media identity, relevance, acquisition candidate policy, and bookshelf identity. A Node resolve hook supplies omitted .ts extensions. No SDK, other test file, build, HAP, device, network, or default gate is invoked.

Selected risks: late exact-match insertion; enriched representative/score changes; removal, merge, split and redirect integrity; missed-delta reconstruction; duplicate publications; query reset and Detail remount; shelf/media identity preservation. These are necessary because the changed order policy must stabilize positions without losing or inventing books. This does not prove native pixels, pointer handling, publication timing, or user acceptance.

Negative control: invoke the same entry with --baseline to load the exact pre-change Projection from commit 6b1bd7534b61a8ebfac10150fd308eae8430606e in memory via a Node load hook. It must fail the late-result position assertion. This does not edit production files or rewrite any old gate's assertions.

Observed results (2026-10-20): production probe exit 0; all seven printed groups passed, including query-owned order after a Detail remount, candidate enrichment, live removal/replacement/merge/split, fallback reconstruction, and query reset. The baseline control exited 1 at the intended late-exact-match assertion: old source produced `[a, late, b, c]` while the user-facing stability contract requires `[a, b, c, late]`. No other test, SDK compilation, HAP, or device operation was executed in this subtask.

The retained displayed sequence is rewritten with live canonical keys after each structural change; removed keys do not accumulate there. The pre-existing anchor redirect map remains separately owned by navigation until reset, because it must still resolve anchors captured before a genuine merge or canonical replacement.
