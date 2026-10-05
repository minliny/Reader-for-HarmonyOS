# R7 content-origin unresolved after user review

User observed A/B originals still show a light strip reaching only halfway through the status band; full-screen-content acceptance withdrawn. R7 canonical build, production state regression, and same-image-position checks are separate from this remaining origin question. No new source changes yet.

Code-side audited: Index/Shell/Surface roots manga-only ignoreLayoutSafeArea+expandSafeArea; no root safe padding; imageViewport List space0, first loaded Image Fill with dimensions identical to row, source/width fit no centering offset; body decoder selects x0/y0 region, exact native dimension validation, PNG packing. Current code shows no creation of paper-colored bars but cannot identify the actual top pixels without current original bytes.

Remaining question: does the first source/tile image itself contain the approximately 80-screen-pixel light-blue border, or is a native paint offset applied despite full origBounds? UI bounds and pixel stability alone are not acceptance proof. Minimal already-authorized VM follow-up is read-only listing of only Reader image display/durable-cache paths, then retrieving only the matching first tile/source image. No preference/chapter/source change, no clearing, no second install. Acceptance must include production-code regression and verified input-to-render origin, per user 2026-10-03; screenshot alone is insufficient.

2026-10-03 23:57 user response: do not extract current image cache, continue code-side diagnosis. Cache extraction remains prohibited; request is resolved as denied, not pending. Root and code agent audited deeper window/decoder/graphics/anchor paths without HDC or user-file reads. No source-content attribution or full-screen acceptance inferred.
