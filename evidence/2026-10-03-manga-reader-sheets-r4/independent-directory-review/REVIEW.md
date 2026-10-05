# R4 directory: independent image and motion review

Scope: read-only review of fetched original VM JPEG/UI tree. No product or test changes, no HDC/VM interaction. Motion conclusions require all nine original frames and timestamps; CLI command windows are not VSync/present timestamps.

## Package and source binding

- Manifest checked locally: run `20261003T115444Z-568ec4e3-60884895`, signed HAP SHA256 `d32fb81045c946c62030b3561eb1f9c4db34811ca5d98ef2c3331ea64e671de6`, canonical signature verified, certificate SHA256 `3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4`.
- Root performed preserve-data install/launch; this reviewer did not operate the VM. Surface frozen SHA256 `0f5e6d2654e8cc228b43b2ab2c9023e728db904193a147ce71da425113a6b897`.
- R4 original `../vm/directory.jpeg`: 1280×2832, SHA256 `1710062edc4577042ebf372d11e8b8de723b14b24eaf732b7bd44119ecc45f3a`.
- R4 original `../vm/directory.json`: SHA256 `3a9026d1804d5551657baa9e667385fa3f2f574c1ce252b3bdb0cb6f5deaf129`.

## Top corners: PASS for this R4 open directory scene

The original JPEG visibly has curved top corners at both left and right. Comic pixels and the darkened page remain visible outside the curved surface. The UI tree identifies the real cream sheet Stack at `[0,782][1280,2734]`, `clip=true`, enabled and opacity1. The JPEG curve extends from the sheet top around y782 to the full left/right width around y859, about77 native pixels. The target's text sizes show a3.5 native scale (18→63;10→35), so that observed extent agrees with22vp. JPEG antialiasing/compression prevents treating thresholded edge pixels as exact vector-radius measurements.

R3 `directory.jpeg` had a flat cream top edge continuing into both corners. The thin fix moved the existing border call before borderRadius/clip; all values remained unchanged. New native paint now confirms the corners recovered. This closes the R3 top-corner FAIL only for this bound R4 scene; it does not claim all orientations/themes or animation curves passed.

The four `r3/r4-corner-left/right-original-crop.png` files are mechanical160×160 crops copied from original JPEGs at left `[0,750,160,910]` and right `[1120,750,1280,910]`. No resizing, interpolation, reconstruction or inserted motion frames.

## Directory motion: original-image observations

Both complete series are in `../motion/dir-open` and `../motion/dir-close` (not under `vm/`). Admission was checked before reading: frame0–8 original JPEGs, timestamps, per-shot logs and click window present. All18 JPEGs decoded correctly at640×1416. Every original frame was visually inspected through six1:1 contact copies; labels sit outside original pixels. Each series has five decoded pixel groups, but semantic movement below comes from observed real contents and independently measured title/search anchors, not hashes alone.

| Scene / frame | Visible state | Title top y / search top y | Offset from settled open reference |
| --- | --- | --- | --- |
| dir-open0–2 | Directory absent, reader dock visible; exact same original pixels | — | — |
| dir-open3 | Title and search near bottom of screen, sheet partly visible |1196 /1282 |+743 /+744px |
| dir-open4 | Title/search/tools near settled position, still lower |476 /561 |+23 /+23px |
| dir-open6–8 | Actual04–09 rows,05 marked currently reading; exact same original pixels |453 /538 |0 /0px |
| dir-close0–2 | Actual populated directory fully open; exact same original pixels |453 /538 |0 /0px |
| dir-close3 | Title/search/tools and04–09/current05 rows retained while moving down |484 /569 |+31 /+31px |
| dir-close4 | Title/search/tools still drawn after substantial downward movement; rows now below screen |1104 /1189 |+651 /+651px |
| dir-close6–8 | Directory gone; same05 chapter and5/32 position, reader dock restored; exact same original pixels | — | — |

These are stored native JPEG coordinates, not the original1280×2832 display coordinates. Title and placeholder regions were identified by visual inspection; grayscale threshold bounding boxes in each actual JPEG provided their top-y values (title<120, placeholder<205). Independent anchors co-move within1 pixel in the early entering sample and exactly in the other meaningful samples. Search and title are two different rendered contents. The annotations and `*-metrics/report.json` preserve original/decoded hashes, measured coordinates and windows.

`dir-open5` is near final position with about1px residual search/glyph raster difference; it is excluded from the independent middle-position proof. `dir-close5` retains the handle and a real title fragment at y1406 clipped at1416; the search is offscreen, so it is excluded from two-anchor content-retention proof. No frames were inserted or interpolated.

- **Entering movement observed:** two clear nonendpoint positions are present in original frames3/4 before the settled populated directory6–8. This rules out a purely instantaneous absent→settled switch in this sampled run.
- **Exiting movement and retained content observed:** original frames3/4 retain real title/search while co-moving downward; frame3 also retains04–09/current05. Later frames6–8 show the sheet gone. This supports content retention in those sampled exit positions, not every unsampled instant.
- **Content admission observation:** dir-open4/5 have title/search/tools but no visible directory rows; actual rows appear in6. The samples alone do not locate the business-data admission timing or establish that its content populated simultaneously with the entering sheet. Do not treat the empty early body as a proven animation implementation cause.

## Scrim observations, separately from movement

The same static comic speech-bubble white patch at native JPEG ROI `[140,198,175,212]` was inspected above sheet/shadow and outside changing controls. Its grayscale-channel mean in dir-open0–2 is254.133, frame3 is238.176, and4–8 is167.176. In dir-close0–2 it is167.176, frame3 is169.176, frame4 is246.176, and5–8 is254.133. The same underlying comic remains in place, and the original images visibly darken/lift the page with the panel lifecycle.

Thus nonendpoint dimming/lifting samples are observed: open3, close3/4 (close3 is only a small2-level departure, so close4 is the stronger exit fade observation). These observations support real sampled scrim changes. They do not identify exact alpha,160ms duration, easing, full phase alignment or equivalence to the demo curve. The analyzer intentionally keeps `actual_curve_duration_scrim_equivalence=OPEN`.

## Timing and remaining boundary

All native capture and UITest commands exit0; timestamps have valid nine-digit fractional seconds and nondecreasing start/end. Shot command windows are104.311–204.830ms for dir-open and68.557–144.413ms for dir-close; click command windows are277.077ms and182.329ms respectively. These include command startup, capture, resize/encode and output. They are not animation duration or presentation timestamps.

Open shots1/2/3 have overlapping command windows; close1/2 overlap. Their ordinal sequence must not be fitted as a VSync trajectory. Remaining samples have separately recorded command windows, but can still capture an earlier committed buffer. Native snapshot contention may disturb rendering. Timing windows are valid evidence metadata; exact curve, duration and compositor/sample timing remain **OPEN**. No product/tests/HDC or app data were changed in this independent review.
