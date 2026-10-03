# Reader layout and physical pagination ownership

Baseline: configuration and motion lifecycle commits on `cf56c662`.
This slice moves two real producers out of the persistent ArkUI component;
it does not introduce a second text layout engine or remount a reading tree.

`ReaderParagraphLayoutOwner` owns current paragraph ranges, the temporary batch,
its cursor and restored-scalar intent. Its bounded planning method preserves
whole original paragraphs, including a paragraph exceeding the byte target.
The component supplies the native controller/measurement factory. Native line
shaping, bidi, graphemes, recipes, disposal and image geometry remain in the
existing platform resource owners. Speculative adjacent chapter contexts keep
their own immutable/captured range and draft identity.

`ReaderPhysicalPaginationOwner` owns in-progress fragment/height/scalar packing,
exact page receipt admission and the existing `ReadingPaginationIndex`.
The component delegates its three forward fit decisions and prefix admission.
The owner uses `ReadingPaginationPrefix` for exact continuity; suffix or partial
resident measurements cannot become complete canonical chapter manifests.
Retained page receipts cannot silently change their original request, layout
or content key. LRE still owns public reactive fragments and page-turn publication.
No handwritten accessors were added to the ArkUI V1 struct: real owner properties
and ordinary methods survive SDK lowering.

Local evidence: actual SDK first-page member lowering, production native batch,
reverse-page/prepared-window, retained-page, indentation/Unicode, known and
unknown image geometry, continuous input, recoverable entry and appearance
publication contracts. The added owner test executes both real owners and
SDK-parsed LRE consumers with a missing-admission negative control. Existing
fixtures route their old field assignments to actual owner state; they contain
no copied batching or prefix algorithm.

Full ArkTS type checking, HAP, native device paint and visual/user acceptance
remain separate exits. Progress producers are the following slice. The whole
reading-runtime package is not declared closed by this extraction.

Rollback unit: both new owner classes, LRE delegation and matching fixtures/tests.
Reverting it does not change Core progress, stored data, native resources or UI
numbers; it returns planning and admission to their previous component location.
