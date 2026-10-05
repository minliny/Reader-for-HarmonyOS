# Bookshelf action Sheet shared surface

The migration retains the application's current physical surface. Its immutable
baseline is Host `6b906c5d`, embedded and SHA-256 checked in
`tools/fixtures/design/bookshelf-sheet-shared-baseline.json`.

`BookshelfBookActionSheet` now owns only the four business callbacks and the
presentation identity. `ReaderBoundedSurface` owns the existing frame,
`ReaderBoundedSurfaceHeader` owns the handle and title, and
`ReaderSheetActionList` owns the finite four-row action layout. All native and
inner geometry remains sourced from `resolveSheetSpec('bookshelf-book-action')`.
Slots use lexical closures so SDK-generated Builder binding cannot replace the
business receiver. No persistent reader subtree is remounted.

Each temporary opening must receive an opaque presentation ID and an admission
predicate from its actual native host. The four native action handlers capture
that ID, require a mounted/current opening, and claim one action before invoking
the business callback. An unavailable predicate retires the action; business
exceptions still propagate and never trigger replay. The host must bind the book
and callbacks to the same opening. A small keyed host subtree is required when
replacing regular V1 callback fields; updating only a Prop is insufficient proof
that those callback fields changed.

`test-bookshelf-sheet-shared-composition.mjs` runs actual installed SDK emitted
components and V1 property classes through the leaf → shared frame/header/actions.
It compares all original day/night node properties, including AUTO omissions,
row order and danger colors. It covers all four operations, exclusive dispatch,
stale captured handlers after a new ID, teardown, unavailable owner, callback
failure, lexical binding negative control, and finite variant isolation.

Code and local composition proof are separate from native-host wiring, SDK HAP
compilation, native dismissal/focus/layout and device acceptance. Those exits are
OPEN until their respective evidence is recorded.
