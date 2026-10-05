# R8 independent production-code/SDK acceptance

Frozen at 2026-10-04 00:25 CST. Scope is the numeric diagnostics implementation and actual SDK Image callback registration; it is not visual or cache-based acceptance.

**PASS: 65 positive/rejection/lifecycle cases and two narrow in-memory mutations of real production source.** Executed command `node tools/test-manga-native-image-geometry-sdk.mjs` exited 0. Log is `native-image-geometry-sdk.log`. Existing source-owner regressions and the parent canonical HAP pipeline are separate; this reviewer did not build, sign, install, use HDC, take screenshots, or access source/cache/userdata.

**OPEN: actual native caller numeric delivery and source-content origin.** SDK callbacks below receive controlled values. They do not prove a submitted frame, ancestor screen placement, the first source pixel, or a physical-device rendering result. This report does not close or overwrite the frozen R7 top-band OPEN finding.

## Execution boundary

The installed SDK parses and lowers the complete current `MangaReadingSurface.ets`, including its actual Builder, LazyForEach item/key callbacks and Image registrations. `createReaderBuilderProbe` runs that emitted output. The installed SDK property/proxy classes run real value get/set/reset logic; subscriber/dependency delivery is instrumented. Tests invoke the functions recorded by actual emitted `Image.onComplete`, `Image.onAreaChange`, and the existing viewport `Scroll.onAreaChange`. They do not call a test substitute for the production recorder or manually invoke the decorated Watch.

The frame delivery, Controller tile facts, Area/Scroller values, hilog receiver, and window-request recorder are native/host boundaries. The production validator is the current exported `checkMangaImageOriginGeometry`. Logging is captured through the actual production `hilog.info` call, parsed as JSON, and checked against an explicit output-key whitelist. No renderer is simulated.

Entry opt-in is executable proof: the installed SDK parser identifies the exact production `onCreate` AppStorage statement and executes its unmodified code with controlled DEBUG, BUILD_MODE_NAME and Want inputs. The exact `onDestroy` reset statement is also executed. The production `onNewWant` body executes against the file-Want receiver boundary and does not arm diagnostics. Other Entry startup/shutdown services are outside this narrow guard test.

## Cases and outcomes

- Native `loadingStatus=1`, finite positive source/component/content dimensions, matching content size and zero offset produce destination-only PASS. Status 0 or unknown status produce OPEN. Missing event, missing offset, NaN, Infinity, zero/negative dimensions and a numeric string remain OPEN.
- Native content x/y offsets and content/component size differences produce FAIL. The explicit 0.5-native-unit rounding boundary is checked on both sides; tests never subtract a status/gesture height or fabricate a zero offset.
- Extra URI/password-like fields supplied in the controlled native event are excluded. Output contains only the declared numeric/presentation fields; source/book/chapter identity, opaque presentation key and lease URI are absent. `submittedPaintEvidence` is always 0.
- Actual image Area and unchanged viewport Area callbacks report their separate vp width/height/global position. Missing/nonfinite/zero Area is not fabricated into a receipt. Nonzero image and viewport global coordinates are preserved verbatim. Destination-only PASS does not assert a global origin.
- Actual State/StorageLink changes deliver the production Watch, followed by SDK property-observer flush. Window-metrics diagnosis produces no additional ReaderWindowCoordinator semantic chrome/policy request. Ordinary controls changes retain the existing request behavior. Metrics/control/panel changes make a retained native receipt OPEN with `retained-native-receipt`; a new onComplete receipt is required before destination-only PASS can recur.
- The production Entry guard allows only primitive `DEBUG === true`, `BUILD_MODE_NAME === 'debug'`, and primitive Want parameter true. Release/profile, false, missing parameters, strings, numbers, boxed boolean and null cannot arm the flag. A prior stored true value is overwritten by each cold start; destroy resets false; warm Wants cannot arm it.
- The actual SDK compiled StorageLink default is false. False, undefined, numeric and string values produce no diagnostic log/frame. Already queued frames recheck the flag after reset, clear old samples, and do not log; later callbacks stay inert.
- Captured callbacks reject replacement tile/image, a new URI/revision image object, Controller/chapter replacement, lost reader identity, unmount, exit, changed row geometry, and changed opaque published presentation. They do not overwrite a newer owner's sample. Production dispose invalidates pending frame delivery; identity lost between receipt and frame also cannot yield PASS.
- Before/after snapshots preserve the same Image/ListItem actors and admitted dimensions/fit, business/render key, projected row, viewport, native Scroller offsets, normalized anchor, layout/presentation/viewport generations and scroll-request list. The diagnostic callbacks request no restore/scroll and do not modify the existing native drag suppression.

The opaque published-presentation test supplies a changed Map ownership value. It does not assert a fabricated production path that mutates a lease URI in place. Current production uses replacement image objects; only opaque identity enters the diagnostic fence, never its contents in the log.

## Negative controls

Both mutations exist only in memory for actual SDK recompilation, not on disk in product source:

1. Replace the production assignment from the validator with an unconditional PASS. A delivered nonzero native offset fails the same event-driven status assertion.
2. Remove the captured-owner guard at both actual Image callback factories. A callback from the replaced tile fails the same no-late-report assertion.

These controls demonstrate that correct declared layout or a self-written PASS cannot substitute for the delivered event and its owning lifecycle.

## SDK declaration and units

Installed `ets/component/image.d.ts:1682–1945` defines onComplete's source width/height, component width/height, loadingStatus, actual drawn content width/height, and component-relative content offsets. Its loading-status description distinguishes successful data loading (0) from successful decode (1). The supplied declaration does not state a complete conversion convention for every field; the validator therefore compares only native content/component fields from the same event. It does not compare those dimensions to vp projection.

Installed `ets/component/units.d.ts` defines Area width/height and local/global positions as Length/Position. The logger keeps Area observations separate under vp-named fields and reports window density independently. An actual native caller sample remains required to bind these declarations to runtime delivery. A receipt after decode is not compositor-submission evidence.

## Frozen bindings

| Input/output | SHA-256 |
| --- | --- |
| tools/test-manga-native-image-geometry-sdk.mjs | 36522f7a479f3b18a1b0165aea2a92d12f53962d50f89e5928d2fe7c328c4994 |
| entry/src/main/ets/features/manga/MangaReadingSurface.ets | b16c0207277a58ab13d00c076085371b24adf20d11fcce2a6e8f373b61694fe3 |
| entry/src/main/ets/features/manga/MangaImageOriginGeometry.ts | bf19329bb7371939324b50fdd3d081882b2fb851a853ce1528bb79c002453a0b |
| entry/src/main/ets/entryability/EntryAbility.ets | f21073d3703a24ae8f01a85dc2bb15f1b3ef517c6de59772b47352b73acac533 |
| tools/lib/manga-surface-sdk-probe.mjs | 670446eee86859281b45c4693abde30b1ac2382dfd7af64399eb58741cfb2332 |
| tools/lib/reader-control-builder-probe.mjs | ef3b77ee13b462bda5c43a162c843e3f7ae5e478a810f3acea66b078c651ad49 |
| tools/lib/arkui-property-runtime-probe.mjs | 70671c006f1fde5aab7b8259e0e4647071df1ebf0755f92d4a87ccee30bf75ce |
| SDK-emitted tested component | d7d4bad6cc18de58594e19af18f529c4a0583590d10b9e6d8202260536c789bb |
| Executed SDK property/proxy classes | 6140bfa5cf6705ddee40349c2e082083778a920f0ff870cc51dccb0f030ccbd5 |
| sdk/native-image-geometry-sdk.log | 3162c7c7473313d5150b7e61a13602240ed2486ce458074be3a05e20e04d228c |

Source owner separately confirmed the four production/helper inputs frozen. This reviewer freezes the new tool and this evidence. Production files, shared helpers, previous R7 report, SDK assertions, and existing 437 groups were not edited by this reviewer. Parent canonical build/runtime results require their own manifest-bound records.

