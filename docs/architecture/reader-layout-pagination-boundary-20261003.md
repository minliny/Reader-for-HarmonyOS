# Reader layout and physical pagination ownership

Baseline: configuration and motion lifecycle commits on `cf56c662`.
This slice moves two real producers out of the persistent ArkUI component;
it does not introduce a second text layout engine or remount a reading tree.

`ReaderParagraphLayoutOwner` owns current paragraph ranges, the temporary batch,
its cursor and restored-scalar intent. Its forward/reverse planning methods preserve
whole original paragraphs, including a paragraph exceeding the byte target.
The component supplies the native controller/measurement factory. Native line
shaping, bidi, graphemes, recipes, disposal and image geometry remain in the
existing platform resource owners. Speculative adjacent chapter contexts keep
their own immutable/captured range and draft identity.

`ReaderPhysicalPaginationOwner` owns in-progress fragment/height/scalar packing,
exact page receipt admission and the existing `ReadingPaginationIndex`.
The component delegates forward image/line fit, reverse image/line fit (including
provisional selected native lines), append/prepend packing transitions and prefix
admission. The owner applies paragraph spacing once, admits the first overflowing
native line as before, and preserves the observed reverse end seam. LRE supplies
native geometry and transferred resources without mutating packing height or
inserting/removing fragment sequences itself.
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

The later progress slice is `172a76d8`; forward and reverse paragraph/physical
packing consumers then received the same real-owner transitions. Native metrics,
immutable prepared contexts, visible reactive projection and transaction-level
page publication remain at their existing platform/persistent-tree boundary.
Full integrated ArkTS type checking, HAP, native device paint and visual/user
acceptance remain separate exits. The whole reading-runtime package is not
declared closed by field extraction or local probes alone.

Rollback unit: both new owner classes, LRE delegation and matching fixtures/tests.
Reverting it does not change Core progress, stored data, native resources or UI
numbers; it returns planning and admission to their previous component location.
