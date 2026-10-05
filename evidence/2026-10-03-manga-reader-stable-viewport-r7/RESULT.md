# R7 status: partial, content-origin acceptance open

## Implemented and code verified

The R6 reader applied changing safe insets to the full manga root, so OS bar visibility changed image viewport constraints and could invoke resize/anchor restoration. Some ancestors still consumed layout safe areas, and native bars plus shell overlay used opaque paper. R7 makes the manga image branch own all window edges; only controls/panels consume safe insets, and manga native bar backgrounds are transparent. Text/application policies keep their existing defaults.

Actual SDK compiler/property-class regressions pass: original image actor, URI, row geometry, anchor and controlled Scroller offset remain unchanged across controls and delayed avoid-area events; R6 exact negative fixtures reject root padding and missing ancestor layout-safe policy. Additional `code-origin/image-origin-sdk.mjs` invokes the actual production Image Builder/Projection, asserts Fill and zero sourceY/rowTop/left and no artificial padding/margin/offset/translate, and rejects injected real Image top-margin and Contain mutations. Supplied Area and Scroller values are controlled; no native layout or raster engine is simulated.

Canonical build passed all 437 gates and real ArkTS signed package creation. Verify and target inspect passed. Signed R7 HAP `cb3cbf1a615edc8b1822290fd778cb4fd3ef3ef1fd0e45d4961c09c583c5f778`, run `20261003T154124Z-568ec4e3-a61c8e77`, installed/started on VM `127.0.0.1:5555` using the designated minliny_HarmonyOS certificate; preserve-data receipt is in canonical-delivery. No second package, mainline integration or physical-device acceptance is claimed.

## Mechanical VM support, not pure visual acceptance

Actual current continue-reading entry was 斗破苍穹 02, 1/24. No source/chapter/fit/scroll change was made. Original A/B static screenshots have byte-identical decoded pixels in three unobscured regions; A/D whole JPEG SHA and decoded pixels match exactly. Native tree origBounds of Scroll/List/image rows remain identical through A/B/C/D. Visible bounds of the first row clip under displayed native bars while origBounds and same-coordinate picture pixels stay fixed. C changes brightness due to scrim and keeps texture positions. Returning to the shelf restored native system bars and released the target lease. This supports the production-state regression for non-reflow but does not by itself prove every image-origin case or motion curve.

## Remaining failure/open issue

The user correctly identified an approximately 80px light-blue strip at the top of A/D originals. The initial interpretation that full origBounds also proved full-screen content was withdrawn. Current code audits show no authored blue strip and request first source pixel at zero, but origin ownership cannot be accepted before matching the actual source/tile first pixels to the paint result. `CONTENT_ORIGIN_ISSUE.md` records audited paths and the exact unresolved question.

User requires every acceptance to pass production-code regressions; screenshots alone cannot close acceptance. Read-only current-first-image cache extraction was rejected by automatic approval review because the earlier device scope authorized screenshots/page navigation, not cache contents. The user explicitly declined extraction and requested continued code-side diagnosis. No extraction was performed and no alternative bypass used. Source/tile origin, complete full-screen-content acceptance, native motion timing, other devices and user acceptance stay OPEN. No unsolicited source cropping or fixed pixel offset has been introduced.

Source preservation v1 path drift and reconstructed v1 evidence are disclosed in SOURCE_PRESERVATION_DRIFT_AUDIT / source-v1-reconstruction records; v2 canonical source-to-HAP binding remains PASS. Extra duplicated v1 SDK filenames are separately recorded and excluded from frozen v2 inputs. No frozen R4/R5/R6 archive or R7 production source/test input was rewritten.

2026-10-03 23:57 user response: do not extract current image cache, continue code-side diagnosis. Cache extraction remains prohibited; request is resolved as denied, not pending. Root and code agent audited deeper window/decoder/graphics/anchor paths without HDC or user-file reads. Window-chain follow-up is in code-origin/WINDOW_CHAIN_FOLLOWUP.json; the image-chain follow-up is separately appended, rather than editing prior frozen code/visual reports. No source-content attribution or full-screen acceptance inferred.
