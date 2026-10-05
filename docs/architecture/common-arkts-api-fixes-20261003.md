# Common ArkTS API correction

## Observed failure

The actual complete ArkTS candidate at Host `8d0e6037` / Core `e5518d77`
reported 74 diagnostics. This slice addresses its 15 diagnostics within the
assigned common UI boundary: seven object spreads in `ReaderChoiceSpecs`, seven
inherited `CustomComponent` member collisions, and the object spread in
`ReaderDirectoryRecoverySurface`. Source evidence is
`evidence/2026-10-03-full-architecture-execution/sdk-candidate-2137/ARKTS_ERRORS.json`
in the enclosing Reader workspace. Other diagnostics remain separate work.

## Exact changes

- `ReaderRecoveryAction` and `ReaderChoiceRow`: public `enabled` becomes
  `actionEnabled`.
- `ReaderBoundedSurface`: public `width`/`height` become
  `surfaceWidth`/`surfaceHeight`.
- `ReaderBoundedSurfaceHeader`: public `width`/`enabled` become
  `surfaceWidth`/`actionEnabled`.
- `ReaderBoundedSurfaceActions`: the private action predicate becomes
  `actionEnabled`.
- Every actual leaf caller and selected SDK fixture changes the matching input
  key. Native `.enabled`, `.width`, `.height`, and native geometry assertions keep
  their original meaning and values. Index contains no direct matching caller.
- The eight finite choice variants now use an explicit typed base copy followed
  by their original assignments. No specification, typography role, inherited
  AUTO value, selection rule or geometry changes.
- The directory notice constructs its four declared `ReaderRecoveryView` fields
  explicitly and disables only that notice's own retry, retaining the original
  separate recovery actions and generation/identity checks.
- The finite shared-producer registry records the actual changed interfaces and
  consumer input keys. The original 100 business budgets and legacy owner hash
  remain unchanged.

## Verification

Local production SDK suites pass: shared frame/header, eight choice variants,
startup recovery, bounded Source/TTS, Local Import, Replace, bookshelf Sheet,
and directory owner/Core/Index/native action consumers. The directory suite uses
`READER_READING_RECEIPT_CORE_ROOT=/private/tmp/reader-full-architecture-delivery-20261003-1845/Reader-Core-Native`
and passes all 12 scenarios, including cold SQLite receipts, unknown ACK pure
query, explicit original continuation, stale physical actions and warm owner
recreation. The earlier run with the isolated workspace's absent sibling Core
stopped before first dispatch; it is not recorded as a production regression.

The exact producer, consumer budget, native-default and conventional typography
gates also pass: 100 unchanged business budgets, 8 bounded shared owners, 19
retained UI policies; conventional typography retains 248 original contracts /
818 parameters including AUTO and dynamic variants.

These are source and local SDK results. The complete ArkTS compiler, signed HAP,
target behavior, visual review and user acceptance still require their own
evidence. This document does not close the remaining 59 candidate diagnostics.
