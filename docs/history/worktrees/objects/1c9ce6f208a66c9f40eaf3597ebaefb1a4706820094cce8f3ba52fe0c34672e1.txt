# Search layout and displayed cover successor

The user reported the current VM search page losing its structure and authorized
the complete feedback fix on 2026-10-08. The captured page shows the result stats
overlapping the content-type row: the header reserved two rows while rendering
three. Source and type filters, query ownership, cancellation, result identity,
navigation admission and the original icon geometry remain the same.

The search bar now uses its scale-aware minimum height and lets the existing
book-search input measure its natural height. Native header measurements own
subsequent list and status offsets. The first-frame fallback accounts for both
filter rows and current text scaling. Only ReaderSearchField's bookPage variant
and ReaderButton's search-field-phone/search-field-wide variants grow their
original line boxes. Font-scale 1 retains the original dimensions; other finite
button and input variants keep their existing recipes.

The historical icon-family original-consumers.json and ReaderIconButton.before.ets
remain immutable. approved-search-layout-20261008.json records only removal of
the input wrapper's fixed height and replacement of the search bar's fixed
height by its measured minimum. It binds the original search witness hash and
the exact successor height helper. The icon contract still verifies the
navigation-back tuple, callback, accessibility identity and finite input fields.

The same witness preserves the exact predecessor ReaderButton shape. Only the
ReaderButton entry in architecture-shared-producers.json is updated to its
current SDK AST shape, with the existing search-physical-layout SDK proof added.
Other producers, specifications, consumer edges, public inputs, historical
business budgets and transfer origins are unchanged.

Search selection carries displayCoverUrl separately from the selected source's
canonical coverUrl. The shared detail input may retain the visible group image
without changing sourceId/bookId, seed metadata, RPCs or persistent ownership.
The actual SDK Card → Page → Index proof and saved/unsaved admission proofs are
in the existing search-index-action-attachment, search-cover-continuity and
search-shelf-identity tests.

This records authorized source and test-definition changes. Passing contract
gates, signed artifact provenance, native VM rendering and user acceptance remain
separate evidence. The first unified batch failed on predecessor witnesses;
the next unified batch will verify these narrowly updated contracts.
