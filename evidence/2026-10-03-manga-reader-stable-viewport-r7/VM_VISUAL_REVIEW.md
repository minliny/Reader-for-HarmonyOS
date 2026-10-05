# R7 independent VM pixel review — stage record

This review is mechanical supporting evidence for the existing production-code/SDK regressions. It is not a standalone visual acceptance. The recorded A/B endpoints support stable manga image placement when controls are shown; A/D are exactly equal after directory closure and controls hiding. **Full-screen content origin remains OPEN.** The approximately 72–80 px light band at the top has not been compared against the current source image or first decoded tile. The earlier tentative interpretation that its color established an original-image margin is withdrawn.

## Bound scenario and delivery

The supplied build/deployment record identifies run `20261003T154124Z-568ec4e3-a61c8e77`, signed HAP SHA-256 `cb3cbf1a615edc8b1822290fd778cb4fd3ef3ef1fd0e45d4961c09c583c5f778`, manifest SHA-256 `d1d85d95beeb104d57aef5d7b4799cc5559697703a916e33273027b5113ad6f2`, and preserve-data VM install/launch. This reviewer did not independently run artifact verification or HDC. The artifact is an iteration build, with `acceptanceEligible: false`.

Actual restored content is **《斗破苍穹》02话，1 / 24 页**. It is not the planned 05话，5 / 32 页 fixture. The saved sequence is A immersive → B controls → C directory without selecting a chapter → D close directory and hide controls → return to bookshelf. No chapter, source, reading preference, zoom, rotation, or scroll change was introduced in this sequence. The bookshelf exit shows `02 · 1 页 / 24 页`; this is an endpoint observation, not cold-start persistence acceptance.

Inputs are saved native JPEGs of 1280 × 2832 and their native UI trees. Original images were visually inspected, with additional original-scale crops for system bars. `pixel-check.py` reads saved inputs only, compares decoded RGB at unchanged coordinates, and records native `bounds` separately from `origBounds`. No originals were edited; no resizing, interpolation, invented frames, HDC, or product/test changes were performed by this reviewer.

## Observations paired with code evidence

Existing `SOURCE_REVIEW.md` and `../2026-10-03-manga-reader-system-bars-r7/sdk/REVIEW.md` document the manga-only full-window roots, overlay-only safe insets, unchanged image/row/anchor requests on the actual SDK actor, transparent system-bar policy and App restoration. The SDK evidence uses controlled area/scroll inputs and does not emulate the native compositor. The following raw observations support those bounded code results; they cannot independently close data-origin or native temporal questions.

| Check | Existing code/SDK boundary | Raw saved observation | Bounded conclusion |
| --- | --- | --- | --- |
| A → B image stability | Actual SDK production builder/property regression keeps canvas, image/row requests and anchor unchanged under controls/insets | Three uncovered same-coordinate RGB regions have zero difference | PASS for the recorded endpoint stability scope, supported by both code and pixels |
| A → C underlying geometry | Existing state/overlay regression keeps image projection fixed | All body image `origBounds` match; three darkened textured patches have best integer shift (0,0) | Supports unchanged geometry at visible patches; opaque sheet hides the remainder |
| A → D endpoint restoration | Production state regression keeps the viewport stable | Full 1280 × 2832 RGB is exactly equal; original JPEG SHA also identical | PASS for endpoint restoration, not transient animation |
| System bars | Existing real Coordinator/window-order SDK covers manga hide/show and App restoration | A/D have no status icons or bottom indicator; B/C show status icons and bottom indicator; exit shows both on the bookshelf | Static native observation supports the existing code branch; no exact timing claim |
| Full-screen content origin | Current production input-to-image origin proof is a separate pending gate | Top uniform color band remains in A/D despite full `origBounds` | OPEN; neither bounds nor similar color proves whether these pixels belong to the input |

### Exact A/B and A/D pixel comparisons

Pillow `ImageChops.difference` gives `differenceBBox: null` and R/G/B extrema `(0,0)` for each A/B rectangle:

| Rectangle (left, top, right, bottom), original pixels | Pixel count | Difference |
| --- | ---: | --- |
| (0,440,1280,2180) | 2,227,200 | 0 RGB values |
| (300,600,1000,1900) | 910,000 | 0 RGB values |
| (0,500,100,2000) | 150,000 | 0 RGB values |

The smaller rectangles overlap the full-width comparison and are not counted as independent samples. The same textures are at the same coordinates and scale in these unobscured regions.

A/D comparison covers all 3,624,960 pixels. It gives `differenceBBox: null`, all channel extrema zero, and equal original JPEG hashes. This includes the same immersive page counter and the top color band. Equality proves that the saved final image returned to the saved initial image; it does not establish what produced the band's pixels.

### C masking and geometry

Directory C darkens the exposed reader and covers the lower content with its sheet. Direct A/C RGB equality is therefore not the criterion. Three original 80 × 80 textured patches were checked using an integer displacement search of ±8 px and a luminance linear fit to tolerate darkening. No image was resampled or changed.

| Original A patch | Best (dx,dy) | Best fit RMSE | Best nonzero candidate RMSE |
| --- | --- | ---: | ---: |
| (600,450,680,530) | (0,0) | 3.3543 | 11.2673 |
| (850,570,930,650) | (0,0) | 3.9535 | 18.0390 |
| (180,480,260,560) | (0,0) | 5.9139 | 17.8187 |

These measurements support unchanged positions at those three patches. Their fitted slopes of about 0.655–0.659 are not a calibrated compositor opacity measurement and do not establish the demo's precise mask curve. C's hidden lower image cannot be visually compared through the opaque sheet.

### Native tree bounds are not source pixels

Across all four samples the manga Scroll/List `origBounds` are `[0,0][1280,2832]`. A/D visible `bounds` are also that rectangle. B/C visible `bounds` are **`[0,137][1280,2832]`**, with the same `origBounds`. The first Image's B/C visible rectangle is `[0,137][1280,524]`, while its original rectangle remains `[0,0][1280,524]`. B's native status WindowScene is `[0,0][1280,136]`.

It would be incorrect to call B's visible tree bounds full-window or infer that the first tile moved down 137 px. The following image boundaries remain 524, 1048, 1572, 2096, 2133 and 2657 in A/B/C/D. The last Image is originally `[0,2657][1280,3181]` and is clipped to 2832 in each sample. This tree evidence agrees with the same-coordinate pixel comparisons, but cannot prove where a uniformly colored first row came from.

## Unresolved top-band content origin

The A/D upper region is light blue. At y = 0,10,20,40,60, all 1280 sampled pixels are within 2 RGB units of reference (238,247,255). The count falls to 1071 at y70, 676 at y72, 250 at y75, 62 at y79 and 42 at y80. At x640, y79 is (255,249,251), y80 is (255,231,235), and y81 is (199,160,165). A textured transition therefore occurs near 72–80 original screenshot pixels; the region is visually consistent with the user's observation of approximately half a status-band height.

**No actual source-image or first-tile pixels were inspected by this reviewer.** The present data cannot decide between an input margin and an unaccounted native paint/offset boundary. Prior color-only attribution to source material is withdrawn. Full-window SDK layout requests, full `origBounds`, equal A/B body pixels, and equal A/D full images do not close this question. The parent owns the pending production-code origin regression and any separately authorized source/tile retrieval. A later result must be added as a separately bound version/addendum, retaining this stage's OPEN finding.

## Limits and preservation

This is a static portrait VM sequence for the actual 02 / 1-of-24 restoration. It does not prove animation duration, easing, spring, intermediate-frame geometry, native status/gesture transition timing, physical-device or landscape behavior, every reader background mode, other pages, or user acceptance. The user requires production-code regression before acceptance; raw screenshots alone are not accepted. Source-origin acceptance is still pending even though the existing bounded state/viewport regressions passed.

Original R4/R5/R6 evidence remains unchanged. This review creates only this report; the already bound local pixel script/output remain unchanged. The parent records that shelf-exit reception completed and the VM lease was released. No device action was taken for this independent review.

## Frozen raw-input and mechanical-output SHA-256

| Relative file | SHA-256 |
| --- | --- |
| vm/immersive-a.jpeg | 3244afdb60f09f1b253454e1b18691f5d8d4ea8d3c2c6a2015d33433b8894914 |
| vm/immersive-a.json | 05dc4a1c93d190fdb83cb6f478982bbd97bbdb8ac52e6f3eb61d6b8b571429c1 |
| vm/controls-b.jpeg | 4acbc64c89ce2d0772e755e479a4ad2d1957c94c15c4193147cfebc3a504a861 |
| vm/controls-b.json | 44cab2e076ba6d19456cef73e3758fc10fe5ef86165ff94802e040ac9bed1f88 |
| vm/directory-c.jpeg | 9b79a860fca108c5c9e052d783c6700556f45a5ceaf6877a2e87e71ceae696b3 |
| vm/directory-c.json | 2168676bc0edf6faa1f43b330cd4502ce4d692c7ef384702647eb7d56893953d |
| vm/immersive-d.jpeg | 3244afdb60f09f1b253454e1b18691f5d8d4ea8d3c2c6a2015d33433b8894914 |
| vm/immersive-d.json | 2a66460a9767bc8d067d1d3d93bd3905e0168e3e6f86f79e818b06f1499fa6f2 |
| vm/shelf-exit.jpeg | 285ff646d79841cd11d5e7a5489f043a472119bc55af21a26e9b4659b1c42d0e |
| vm/shelf-exit.json | 7b2eb7265b460fec78f0726e0a852b16bd625f5ffc6b6c00c719311504f4dab5 |
| pixel-check.py | a1ef0f25fb7c1a02d17413971809b9441782475e362d76e0d368612958fc464e |
| pixel-check.json | 31c6ebae90b7dcccc693c541642ca9887519600c9613a55704396f9e711bb7d7 |

