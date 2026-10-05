# Directory fixed-font follow-up

This record supersedes the earlier VF parameter acceptance at the code / local SDK layer only. The installed prior HAP's observed thin glyphs remain a visual FAIL. No HAP, signing or VM action was performed by this directory owner.

## Code changes

- Manga normal / parent / count / reading-state / empty text uses the existing static 400 face. Current chapter title selects `READER_FONT_NOTO_SANS_SC_UI_550`; group title selects `READER_FONT_NOTO_SANS_SC_UI_600`. The 550 outline is already instantiated, so its native styling is normal 400 rather than a non-hundred request with a disabled VF switch. No manga row relies on a variable-weight flag. Novel row styling is preserved.
- `ReaderDirectoryNavigationSurface.openTree` awaits the root-owned four-face checked `prepareMangaSheetFonts()` receipt before admitting manga text, including the permanent tablet catalog and flat fallback. Font completion is fenced by mount, generation, source, book and interaction state. Closing before / after its Watch defers a retry without claiming missing navigation. Novel callers retain the direct opening task.
- Search results have left padding 10, matching `Prototype.tsx:134` and `prototype.css:85`; normal tree child padding remains 26 after one v2 depth normalization. Core depth, parent and canonical chapter index are retained; the visual search projection is flat.
- Dedicated `mangaRowMinHeight` is 58 by default and accepts 50 for the wide overlay from the surface owner. Group min-height remains 48. This prop does not alter the novel `rowHeight` contract.
- The top line is on the real rank-zero content row, rather than the List viewport. A stable group actor uses its current node ID in the existing bounded 12-page window, so rank 256 / 0 / 1 and same-view page admission update line / spacing in place. Empty content keeps its own boundary because it has no first row. No synthetic group or volume identity is introduced.

## Verification

Eight targeted gates passed; their exact commands and output are in `directory-static-font-sdk.log`. The parity gate rejects 13 old implementation mutations. The new font readiness gate rejects an unguarded text admission and an always-400 current title. Its unmodified production methods test deferred checked receipts, rejected / false readiness, source / book / generation / unmount changes, both closing races and the unchanged novel task. Actual installed SDK property classes and compiler observers update the same title actor from fixed 400 to fixed 550 and back through `@Prop`, and observe the ready state before native text admission.

The parity gate executes a real v2 gateway search projection with original depth / parent / chapter identity, then native SDK row output. It checks phone 58 / wide 50, first-rank line versus fixed List frame, and retained group rank changes through real State / Prop observers. These demonstrate property / identity / native attribute ownership, not compositor glyphs or scroll pixels.

Two initial local probe errors were test setup defects: the new readiness probe referenced a non-existent helper `subscriptions` member (replaced by actual `reads` with observer IDs), and its isolated `build` probe omitted the real `row` Builder declaration (included the production Builders). The fallback parity fixture also needed the owner's new default row-height prop because SDK probe extraction does not copy omitted fields. All are corrected; the final captured gates pass. No product failure was hidden by those fixture corrections.

## Pre-catalog source snapshot

This snapshot records the completed fixed-face / floating-panel pass. The root subsequently authorized a separate permanent catalog variant; final frozen hashes are below.

```text
b0cc2b5ffb6eb74c52800f516431e6e41d23e304df42c6606b32b9e7a1635cae  entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets
33240f31ad05168b21eed105a69f76988ed755f7ae3a71ca4c8ecda85d236f91  entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets
df3a12f4a83d4c9b79b58f0b83a633040f7dc4602a4113dc4bb6ce74c204a762  tools/test-manga-directory-demo-parity-sdk.mjs
57cf1f3609fb84d9aac92614136c6e064e606efa39db1a28330abe8b8427c210  tools/test-manga-directory-font-readiness-sdk.mjs
8cd46cc533b6ee7a9b5e65988c3661f9849a3b1c355cc0042da43e35d965c5ae  tools/test-manga-metadata-ui.mjs
```

Root-owned font dependencies at verification: `ReaderFontFamilies.ts` SHA256 `05adea3ef1d7150e7c7c8efdc077672b6772b2875fd3c3be774a8397a3467ba5`; `ReaderFonts.ets` SHA256 `192254e9784600898271943442de45ba5d9c13fe4cf9af4a015a77f47be93ead`. Asset provenance / loader ownership belongs to the root's separate font record. The fallback / sheet surface owner supplies their own source hashes and tests.

## Remaining acceptance boundary

New HAP / signed artifact / preserve-data installation / physical fixed-font glyphs / compositor animation frames / scroll appearance remain the root's pending canonical and target gates. Production has no authoritative readable-volume kind, so the demo's `整卷可读` copy remains an explicit metadata OPEN; no title or URL guessing was added. Earlier SVG / font parameter or declared-dimension PASS is not a substitute for target visual evidence.

## Permanent catalog variant and final freeze

The same List and NavigationSurface now forward two manga-only presentation Props, `mangaCatalogDisplay` and `mangaCatalogNarrow`. The permanent catalog uses target min-height 48, padding 11 / 15, child inset 28, title 12 / 20 and state size 9; group min-height 44, padding 10 / 15. At viewport 700 or narrower, target horizontal padding is 12 / 10, child inset 20, title size 11, state size 8, row gap 5. Narrow group title / count use the demo's vertical span with a 1 gap. Catalog tree has no top line and its internal bottom clearance is 18. Phone 58 and wide floating min-height 50 retain their earlier styles. The surface owner supplies actual catalog / narrow flags, query suppression and container geometry; these list Props do not alter novel layout.

The final eight-gate capture is `directory-static-font-variants-sdk.log`, all PASS. Parity now rejects 15 old implementation variants, including using phone styles for the catalog and ignoring narrow layout. Actual SDK child emission forwards both flags, and a retained title / row receives the complete parent Prop payload through phone 58 → floating 50 → catalog 48 → narrow catalog → phone; title size / line-height, padding, min-height, gap, top line and family all update without remounting the title. The actual native List changes content-end offset 14 → 18 → 14. The fixture explicitly sends the complete parent payload because installed SDK `updateStateVars` resets omitted Props; the earlier partial fixture's `13 !== 11` was corrected to the real parent contract, not accommodated by product changes. The transient Python patch string parse failure wrote no source; missing newly factored helper / outdated source regex probes were updated to include the real helper and new catalog branch before the final PASS capture.

```text
f809214df76948601a747e5e25b559315e0692a36564f617f5861ab537540054  entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets
41ec47fc990891c1ac8be26d9e83164020a6af0b2dc4622fa0332b296b032759  entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets
9df88f0c4ad6ed8159929e57454f6b80901484dbfb7e66363239a0544c34198a  tools/test-manga-directory-demo-parity-sdk.mjs
e2b9b773f9df43c1827dac77cef28b56954e9fe9cd8e3ad6eeed0d70a6d91fc1  tools/test-manga-directory-font-readiness-sdk.mjs
91970cb4a6b595abe86f6da2294645a71899176bd4f2a5e6135a91f03d0c9913  tools/test-manga-metadata-ui.mjs
```

These owned source / test files are frozen pending the root's independent review. Root-owned font dependency hashes above are unchanged. `git diff --check` on the owned source / tests also passed. This freeze still makes no artifact / VM / physical glyph acceptance claim.

## Final caller opening-inset follow-up

Independent review identified one additional deterministic wide caller mismatch: the fixed wide header and margin consume 66 + 17 = 83, so the phone's 50 List inset puts the current target at 133 rather than the demo's panel-top 90. The root explicitly authorized this last bounded correction. `ReaderDirectoryNavigationSurface` adds manga-only `mangaCurrentOpenInset`, default 50, and publishes it for initial manga positioning; the surface owner passes 7 to the right floating wide panel and 50 to phone / permanent catalog. Explicit `locateCurrent` remains 12 and smooth; the existing user-anchor restoration branch and novel center path are unchanged. `ReaderDirectoryNavigationList` has no new source change in this follow-up.

The unmodified actual SDK Surface opening method and Prop default feed their returned ready view into the unmodified SDK List positioning methods. The eight cases cover initial 50 / 7, explicit locate enabled / disabled, manga / novel: initial manga makes START non-smooth requests with -50 or -7, explicit locate makes START smooth -12, novel keeps CENTER and does not publish manga inset metadata. A hardcoded phone-50 mutation fails. Readiness now has three negative controls. All three affected gates (font-readiness SDK, metadata SDK, navigation UI) and owned `git diff --check` pass; exact output is `directory-open-inset-sdk.log`.

Latest final frozen hashes supersede the earlier Surface / readiness hashes; other owned hashes remain unchanged:

```text
f809214df76948601a747e5e25b559315e0692a36564f617f5861ab537540054  entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets
0cebb24ce4796a20da30e9f55952b7365a2380c1d0dbeec5d34120abf700578d  entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets
2cfff33a8a906f8489c7e088436e1119b79f3a52fde802e139cfa250d04a033b  tools/test-manga-directory-font-readiness-sdk.mjs
```

Source / tests are refrozen after the root-authorized correction. Caller wiring, canonical HAP and target glyph / scroll / compositor evidence belong to their assigned owners; no such acceptance is implied by these SDK requests.
