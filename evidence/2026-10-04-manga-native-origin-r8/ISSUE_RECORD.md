# Native image destination proof after R7 partial result

User observed remaining 72–80px top light area despite R7 hiding native bars and preserving image position. R7 exact source/HAP and evidence are frozen as PARTIAL; pure visual acceptance is rejected and the user explicitly declined extracting the current image cache. Source-layer review excluded authored padding, first tile Y offset, inserted canvas borders and width-fit centering, but JS layout requests do not prove native Image destination geometry.

This R8 step instruments existing production Image callbacks only. No cache/file/pixel/HTTP access is added. Opt-in cold-start exact boolean plus DEBUG/debug guards permit a numeric-only native destination sample: onComplete loadingStatus1 contentOffset and content/component sizes, plus actual Area global geometry and current window/fit/control metadata. Default launch and release builds keep diagnostic output off. The observer must not modify source identity, byte processing, row key, layout/fitting, settings, anchor or scrolling.

Installed SDK documents contentOffsetX/Y as actual draw offsets inside the component. Primary upstream ImagePattern constructs status1 success event from CalcImageContentPaintSize(geometryNode), based on dstRect plus content offset. This callback precedes MarkNeedRenderOnly, so its values are native destination geometry rather than proof of a submitted compositor frame or source pixel colors. Use current target UI tree bounds and automatic geometry assertions as additional code evidence, no screenshot visual pass.

Minimal remaining native question: is destination rect actually offset inside the image component, or do any current image ancestors reserve/clip away the top of the window? If nonzero, return to the exact code/fit/lifecycle path; if zero/full geometry, do not invent a claim about origin of light-blue source pixels. Data/source/codec color ownership stays outside this probe.

Canonical signed immutable manifest workflow remains required for changed production; R7 HAP remains bound only to R7 frozen inputs, not current R8 source. Shared VM exact target 127.0.0.1:5555 requires lease before install/interaction, preserve-data update only, no physical target or reset.

Official reference checked: https://raw.githubusercontent.com/openharmony/arkui_ace_engine/master/frameworks/core/components_ng/pattern/image/image_pattern.cpp (OnImageLoadSuccess, CalcImageContentPaintSize). Upstream master explains the public contract only; exact installed SDK/VM samples are separately verified.

## R8 v3 canonical compile and artifact

2026-10-04: current v3 passed 438 full Harmony contracts, actual CompileArkTS, isolated non-incremental build, canonical signing/native checks and independent verify. Manifest `20261004T002116Z-568ec4e3-3eec7853`; signed SHA `9b5f34be522060a84bb4e2e805e62ca538cc0d2ae4d68f1a81f716cdf2c1ac56`. Prior failures remain in `canonical-delivery/ATTEMPTS.json` and original logs. Iteration dirty inputs are not clean-workspace acceptance.

Shared VM is currently architecture-installed and native interactions were released there. Before any replacement, root is verifying explicit availability plus compatibility with that current artifact. No R8 HDC interaction, install, cache read, source pixel extraction or screenshot acceptance has occurred. Native destination/submitted-frame/color ownership remains OPEN.

## R8 actual native result and remaining boundary

Canonical signed update and launch on confirmed VM passed with data preserved. Actual cold opt-in process PID25061/guest epoch1791073903 is baseline-bound. Native decoded sequence2 reports offset(0,0), content/component1280x524, image Area origin(0,0), density3.5. Actual production validator accepts its local destination. This is not a submitted frame.

First raw A tree was taken before the last tile mount; it is retained as the earlier incomplete observation (`vm/a.json`). Settled A(`aSettled.json`), B and D have seven identical image actors/original positions, Scroll/List/root orig(0,0)-(1280,2832); images continuously cover edges. B visible top137 is native system-bar occlusion, not orig layout movement. A/D visible edge coverage passes.

Strict numeric phase association remains OPEN: viewport Area was reported at geometry generation2, first decoded receipt at generation4; B/D callbacks retain generation5 while current state advances. No callback is rewritten, forced or treated as a fresh paint. All submittedPaintEvidence remains0. Neither source pixels/cache nor screenshots were read. Remaining top color-band pixel origin is unproven.

Normal cold launch PID26139 has seven reader Image nodes and zero numeric records in its guest interval, confirming default probe-off path. Probe sessions and target lease released; current VM remains on R8 normal manga chapter02/page1/24. Source/full clean acceptance, physical-device and user acceptance are not claimed.

## R8 final source research and evidence boundary

Official RenderService master and OpenHarmony-6.1-Release dispatch/dump paths were reviewed and recorded in `rs-source-review/`. Their tree/surface state is not a per-Image draw destination plus compositor submission/presentation receipt; the current VM implementation was not inferred from a same-name release branch. ArkUI actor bridging was separately recorded in `rs-actor-bridge-review/`, without treating UITest id/hashcode as an RSNode ID. No further VM commands, image extraction, profiling capture or screenshot occurred. Submitted paint and top-band pixel origin remain OPEN. Current source/native geometry produces no concrete additional Reader defect to justify cropping content or applying a fixed negative offset.

Earlier reviewed helper exact bytes were recovered by reverting the two fixed tree-label additions and matching its pre-existing full SHA-256; new `helper-revisions/` records that reconstruction without changing the frozen review. Actual R8 covers A/B/D and default-off loaded reader, not a directory C observation. Rebuilt debug intermediates were audited then cleaned while preserving required CLI bytes, Native libraries, canonical HAP/source/evidence; the separate cleanup follow-up retains raw inventory and post-clean CLI verification.
