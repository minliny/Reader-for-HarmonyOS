# Local image first-frame wire fixture

`reader-local-image-core-first-frame.json` contains nine unmodified JSON results
from the real Core `Runtime::read_prepared_entry` method, three chapters in each
state. It is consumed by `tools/test-reader-local-image-core-contract.mjs`, which
is included by the ordinary `scripts/check-local.sh` test glob.

The input is the self-authored, three-chapter image test book at
`evidence/2026-09-10-page-turn-vm-followup/fixtures/ReaderImageAudit20260911.epub`,
SHA-256 `9938cc64a39d8ed210ff344d2ea3d32dfd95e61bf4ed25d6d7d0871a619dad41`.
Its three PNG files are 720 × 480. Each chapter has 901 canonical scalars and
three image anchors at 110, 407, and 704. This fixture contains no downloaded
novel text or device database.

The producer is preserved at
`evidence/2026-09-23-epub-performance/image-audit-readonly-core-probe.rs`.
It accepts the EPUB path and an existing output directory. It copies the EPUB
into a fresh temporary directory, opens production storage there, and executes:

1. `import.parse`, `import.persist`, `bookshelf.add`, `import.finalize`, then
   `local_book.chapter.content` and the synchronous first-frame API for `fresh`.
2. Remove only the two intrinsic-size attributes from the temporary raw rows,
   use `reading.entry.prepare` without a source path, then read `legacy`.
3. Use `reading.entry.prepare` with the identical private `localSourcePath`,
   then read `repaired`. Assert the raw rows, canonical content and position
   scope remain exactly those of `legacy`.

Every first-frame call supplies `sourceId: "local"`, the SHA-bound book ID,
the chapter index and `windowScalarLimit: 16384`. Its response is the Core
`kind: "ready"` DTO, not a screenshot or proof of platform paint readiness.
The producer verifies that the source file is unchanged and removes its
temporary database when finished. The original individual outputs, producer
summary and Host pre-fix failure are retained in the same evidence directory.

To refresh this fixture after a deliberate wire-contract change, run that
producer against current Core, review all nine responses, and copy each
response verbatim into its matching `cases[].dto`. Do not remove Base64 padding
or manufacture Host-formatted image addresses: the regression was caused by
Host-only fixtures silently using unpadded addresses while Core emits padded
URL-safe Base64 for both locator segments.

`fresh` raw content includes geometry attributes; the simulated legacy raw
does not. Their body hashes may therefore differ. Only the `legacy` to
`repaired` overlay transition is required to preserve the original position
scope. Pixel acquisition remains pending in all three states.

Run the permanent consumer with:

```sh
node tools/test-reader-local-image-core-contract.mjs
```
