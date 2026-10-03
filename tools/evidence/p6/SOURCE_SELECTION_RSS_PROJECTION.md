# Source tools canonical selection and RSS information projection

Input baseline: `706d8af4`. Existing SourceToolsOrchestrator remains the only
selection/business coordinator. `selectAll`, `toggleSelection` and
`consumeSelection` now read/change its canonical selection and authoritative
source list rather than making a page read-modify-write copy. Consumption uses
the existing normalization and original busy/pending/runtime/session guard.
Batch checking still preserves its selected scope. No second selection store,
generic selector or source parsing/serialization implementation is introduced.

RSS feed/subscriptions/unread and management row metadata now have one pure
`RssPresentationProjection` over the existing full Core DTOs. It preserves the
current app's exact sourceGroup/customOrder/rule marker/site-or-feed URL/local
last-fetch date/disabled copy and ordering. It neither creates fake health nor
opens hidden All/Favorites/Rules product modes; existing RSS owners retain IO,
receipts, recovery, subscription/entry binding and lifetime.

The original Index methods were actually compared against the new projection
before they were removed. The continuing gate pins that characterized UI
contract independently of old method locations, including all four existing
presentation states and complete/empty optional metadata. Selection tests run
the full actual Orchestrator and its actual constants; a stale UI copy, rapid
toggle, duplicate/unknown IDs, busy/pending and retired consumption are covered.
Existing full batch progress, source tools and RSS architecture tests pass.

Integration still requires Index delegate consumption and deleting its old
selection calculation/date/metadata body. The factory must capture Runtime and
presentation lifetime: a route-only predicate/default Runtime is insufficient
for publication after a retired page. Actual Index/SDK actors and final ArkTS,
artifact, target and postponed visual/user evidence remain separate exits.
