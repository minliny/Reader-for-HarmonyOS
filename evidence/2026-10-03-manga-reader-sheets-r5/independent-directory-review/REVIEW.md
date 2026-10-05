# R5 independent native directory entry and exit review

R5 visibly corrects the R4 entry-content failure in this bounded sample. In original opening frame4, the sheet is still about 177 raster pixels below its settled position and the real 04 / current 05 / 06 rows are already drawn. Their title and row ink anchors move together with the shell. Original closing frame3 retains those rows and the title at a real intermediate position. This is observed native rendering, limited to the captured frames; it is not full UI, continuous-motion or user acceptance.

## Scope, source and artifact

- Reviewer: manga_sheet_demo_contract. All 18 original 640×1416 native JPEGs were opened individually, as were the stable 1280×2832 directory-initial, directory and final-directory originals. Frozen R4 dir-open frame4/frame5 and preserved demo directory.png were also opened for comparison.
- Harmony delivery run: 20261003T123734Z-568ec4e3-52338352. Signed HAP SHA256: f00ebc4a15240832ee5decf39f660cf30eafcf7454759c85875dd94af4f74719. Canonical manifest SHA256: 34ff8b60a7892cf502dd0407a31dd189c22c7d68b94c20f2f8b1d0cb2fd78c5e.
- R5 NavigationSurface SHA256: 00087dbd1fc42a843b93242f4c450d17f7f70dde8bd7e1ea575431aebfce3685. Font SDK test SHA256: d70ab1686040b7a45408b6b87b951966106c934ec8a417be9287ad6cc9e22f67. Product and SDK code were not changed during this review.
- The preserved public deployment record relates that signed artifact to the VM target and records preserve-data install/launch PASS. The canonical artifact is iteration class with acceptanceEligible=false; this report does not promote it to a release or user-accepted artifact.
- Root supplied the mapping between these captures and that deployed run. Snapshot logs independently name the native remote directories ending 202610032100-dir-open and 202610032101-dir-close. The JPEGs and UI trees have no embedded HAP run field. The local originals are hashed in original-inventory-and-run-context.json; device-side byte hashes were not independently read by this reviewer.
- Root stated the ordinary first open/dump/full-resolution capture and close/dump were the precondition before the fixed motion sample, including checked-font preparation. This was not a repeated motion sampling attempt. Collector metadata records exactly one nine-frame opening scene and one nine-frame closing scene, with at most three native snapshot commands concurrently. Root saved final-directory separately and reported the lease released. This reviewer did not use HDC or operate the VM.

## Opening: content is visible before settling

All coordinates below are original 640×1416 JPEG raster pixels. Edge antialiasing and glyph rasterization can shift integer ink anchors by one pixel; these are not vp or continuous transform values.

| Opening original | Observed phase | Sheet top | Title ink top | 04 ink top | Current 05 ink top | 06 ink top |
|---|---|---:|---:|---:|---:|---:|
| frame0 / 1 / 2 | Closed endpoint, no directory sheet | — | — | — | — | — |
| frame3 | Small sheet edge/shadow at the bottom | — | — | — | — | — |
| frame4 | Clearly displaced intermediate sheet with real rows | ≈568 | 629 | 955 | 1057 | 1158 |
| frame5 | Near endpoint, real rows retained | 415 | 477 | 802 | 904 | 1005 |
| frame6 | Small tail displacement | ≈393 | 455 | 781 | 883 | 984 |
| frame7 / 8 | Matching settled endpoint | 391 | 453 | 779 | 880 | 982 |

In frame4, the shell, handle, title and 04/05/06 anchors differ from the settled frame by 176–177 pixels. The 05 soft-green band and 正在读 label are already visible. In frame5 the same anchors differ by 23–24 pixels; in frame6 by 2–3 pixels. Ordinary 04/06 arrows, the current highlight and the lower ordinary rows remain present. This is sufficient evidence that chapter content participates in the sampled sheet movement.

The frozen R4 originals show the previous failure: frame4 displays title/search/tools but no chapter rows, and frame5 still has a blank directory body at the endpoint. Those files were read without modification. R5 does not show that failure in its visible intermediate frame4/frame5. Different sample windows prevent a precise latency comparison between R4 and R5.

There is no claim about content during frames where the sheet is wholly offscreen or only its edge is visible. Actual native admission/first-paint timing between samples remains unmeasured.

## Closing: visible content is retained while moving out

| Closing original | Observed phase | Title/row observation |
|---|---|---|
| frame0 / 1 / 2 | Matching open endpoint | Title, search, tools, 04/05 current/06 and lower rows visible |
| frame3 | Intermediate, shell/title +31 px and row anchors +30–31 px | The actual title and 04/05 current/06 remain drawn and move together |
| frame4 | Large intermediate displacement, handle/title ≈+651 px | Title, search and tools remain on screen; the rows' expected translated positions are below the 1416 px image |
| frame5 | Edge/grabber sliver only | No meaningful title/row content is within the screen |
| frame6 / 7 / 8 | Matching closed endpoint | Reader controls and 5 / 32 页 are restored |

Frame4 does not prove early destruction of the rows: their corresponding open ink top positions plus the observed translation would be below the image boundary. Conversely, this evidence does not prove that every native node exists until exit completion. It proves that actual visible header and row content is retained at the photographed intermediate positions. Native clicks while closing were not injected in this sample; the separate R5 SDK test owns the interaction fence proof.

## Scrim: discrete intermediate opacity is observed

The manually inspected underlying comic region at x150–449 / y195–279 is static across the relevant originals, above the sheet and its shadow and outside the changing controls. RGB luma proxy measurements of that exact region are:

| Scene/frame | Luma proxy |
|---|---:|
| Closed reading endpoint | 182.682 |
| Open directory endpoint | 120.626 |
| Opening frame4 | 122.772 |
| Closing frame3 | 122.040 |
| Closing frame4 | 177.248 |

The underlying shapes remain in place while their brightness changes. Opening frame4 and closing frame4 therefore provide actual discrete nonendpoint scrim states. These measurements do not establish linearity, duration or an exact opacity curve. The small closing-frame3 difference is included rather than treated as a standalone smoothness proof.

## Native command windows and integrity

- Both scenes contain exactly 32 input files: nine original JPEGs, nine frame time files, nine snapshot logs and five control/aggregate files. All 18 JPEGs decode at 640×1416. All frame and click windows have valid decimal native clocks and exit=0; per-frame timestamps agree exactly with timestamps.txt. Snapshot logs report successful corresponding native writes. No missing or duplicate frame index was found.
- Opening snapshot-command durations: min 80.428 ms, median 116.916 ms, max 128.413 ms. Closing: min 81.228 ms, median 100.955 ms, max 182.785 ms.
- Opening frames1/2 overlap by 21.603 ms and frames2/3 by 58.096 ms; closing overlaps are 46.244 ms and 19.996 ms. Frame7→8 command gaps are 858.964 ms and 902.226 ms. The whole capture-command spans are 1870.122 ms and 1922.956 ms, including the planned late endpoint.
- Opening files0/1/2 are byte-identical and files7/8 are byte-identical. Closing files0/1/2 are byte-identical and files6/7/8 are byte-identical. Repeats were retained, not discarded to improve the result.
- Native date windows bracket CLI commands, not the exact touch instant, compositor commit, display present or VSync. Snapshot requests may serialize, reuse a committed buffer and perturb rendering. Their overlapping windows do not establish actual buffer-read order. Command spans and frame indices must not be presented as a measured animation duration or frame rate.

## Design comparison and current state

The preserved demo directory uses a rounded cream bottom sheet, handle, strong title, search, locate/order tools, ordinary chapter rows with faint right arrows and a soft-green current row with 正在读. The actual stable directory and sampled entry frame4 retain these visible distinctions. Full-resolution final-directory shows top corners, a strong title, regular ordinary numerals and a stronger green current 05. This review does not claim pixel-exact typography or new whole-page parity.

The source is a real flat directory with original 04/05/06 titles. Absence of demo fixture volume headings is a data/scenario boundary, not a style pass or a request to invent groups. Group rotation, long-title wrapping, page metadata, empty/search, ink theme and responsive catalog variants are outside this R5 phone sample. Exact font outline equivalence is owned by the previously frozen font audit; visible weight distinction is observed here without claiming a numerical weight from pixels alone.

The current demo BottomSheet source mounts the content within the animated sheet, keeps it mounted for exit through AnimatePresence and uses maxHeight plus36 for the offscreen target. R5's observed content translation/retention and discrete scrim change are consistent with that behavior. The source motion parameters are not substituted for physical curve/timing proof. Existing native Slider/Toggle paint differences and adjacent night-shell contrast boundaries from R4 are not closed by a directory-only sample.

Stable UI JSONs parse at root bounds [0,0][1280,2832] and identify io.reader.minliny / EntryAbility / pages/Index. The native originals visibly keep the current chapter 05; closed endpoint originals show 5 / 32 页. Root's final saved directory has the same 05 current highlight. An additional relaunch/progress restoration or chapter-switch proof was not performed here.

## Frozen outputs and remaining boundaries

- dir-open-annotations.json and dir-close-annotations.json declare only manually inspected original-image phases and anchors.
- dir-open-analysis/report.json and dir-close-analysis/report.json record every original SHA, decoded RGB SHA, command window, anchor displacement and scrim proxy. They label real middle positions and closing content retention as observed, while curve/duration equivalence remains OPEN.
- Each original-contact.png is a derived contact sheet. Every decoded original is pasted at 1:1; labels sit outside the pixels. No resizing, interpolated frame, UI reconstruction, inserted transition or altered original is used. Verification checks every pasted image block against the decoded original.
- original-inventory-and-run-context.json freezes all 64 scene input files, six stable native originals/trees and the explicitly read design/R4 references. SHA256SUMS.json freezes this review package; it excludes only itself to avoid a self-referential hash.

Resolved within this sample: R4 entry body Blank while a visibly displaced directory sheet is already on screen. Observed within this sample: actual intermediate entry/exit positions, row/title co-translation, current-row retention and discrete scrim change. Still OPEN: exact spring curve, duration, continuous smoothness, first-paint between samples, all-node exit retention, native interaction while closing, device-side/local-byte hash equivalence, absent data scenarios, other responsive/theme variants and user acceptance. No further sample is requested by this review.
