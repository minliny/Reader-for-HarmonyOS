# R8 independent numeric runtime protocol review

Read-only review of the session helper and current production recorder. This is a preflight acceptance protocol, not a device-result claim. No helper, production, test, historical report or raw evidence was modified; no HDC, screenshot, cache/source-image or userdata action was executed.

## Inputs and fixed access

The temporary and preserved scripts have identical SHA-256 `5f4b676c6bd0b5da67a1011b2f27b7c486a1532bf37428cc19b11f4e801432f2`:

- `/private/tmp/manga-r8-numeric-vm-session.mjs`
- `/Users/minliny/Documents/Reader/.reader-isolated/manga-ui-20261002/Reader-for-HarmonyOS/evidence/2026-10-04-manga-native-origin-r8/numeric-vm-session.mjs`

The fixed allowlist runs against VM target `127.0.0.1:5555` and the specified HDC server. It serializes operations under a server/target lease and limits the session to ten minutes. It has no arbitrary shell command, screenshot operation, image/cache/source-file read or userdata export. File receive is limited to the UI-tree path created by the same session nonce and an allowed label. The additions are fixed `pidof io.reader.minliny` and `date +%s` queries. There is no package install/build interface in this helper.

Current audited production bindings:

| File | SHA-256 |
| --- | --- |
| MangaReadingSurface.ets | 282b5e26357252c0787881fcb34bf39b194fa7e2432258ed235a47618a0f973d |
| MangaImageOriginGeometry.ts | bf19329bb7371939324b50fdd3d081882b2fb851a853ce1528bb79c002453a0b |
| EntryAbility.ets | f21073d3703a24ae8f01a85dc2bb15f1b3ef517c6de59772b47352b73acac533 |

The source-owner v3 actual SDK log binds the 65-case/2-negative test to this Surface. Canonical package/run/signature/install binding is parent-owned and must be attached before runtime observations can be associated with this source. An older v1 SDK source hash must not be relabeled v3.

## Minimal numeric acceptance rules

1. **Opt-in and runtime identity.** Preserve the pre-probe numeric-log baseline, then cold stop/start with the primitive boolean probe flag. Query the current Reader PID and guest epoch around the phase. Parse only exact tag/prefix `MangaGeometry / READER_MANGA_GEOMETRY` records with valid JSON; retain the raw original log prefix, including PID/time. A tag alone, `sequence=1`, the current app name, or newest-looking JSON is insufficient provenance.
2. **Fresh destination scope.** Recompute the production validator from the record's nine native numbers, mapping `nativeWidth/nativeHeight` to `width/height`. A fresh destination-only PASS requires `loadingStatus === 1`, all relevant numbers finite, positive source/component/content dimensions, content offsets within ±0.5 of zero, and content/component dimension differences within 0.5. Also require `receiptGeneration > 0`, `retainedReceipt === 0` and `receiptStateGeneration === stateGeneration`. Missing/nonfinite data or status 0 stays OPEN; offset/size violations are FAIL. Do not rely on a recorded PASS without checking its delivered numbers.
3. **Retained receipts.** Controls, panel or window-metrics changes advance the state generation. If an old receipt is reported for that newer state, it must have `retainedReceipt=1`, `destinationStatus='OPEN'`, and `destinationReason='retained-native-receipt'`. A new `onComplete` receipt may establish a fresh destination-only result; absent such a receipt, the former PASS must not be promoted to a new-state native paint claim.
4. **Area scope.** Report image/viewport Area dimensions and global coordinates separately from native content/component fields. Compare only correctly attributed current Area observations; an old `imageAreaStateGeneration` or `viewportAreaStateGeneration` is not a fresh observation. Do not subtract system-bar height, fabricate y0, or assume event dimensions and vp Areas share a unit. Nonzero global coordinates are data to assess, not values to normalize away.
5. **Default-off scope.** After probe exit, cold stop/start without the geometry parameter and enter the actual manga reader, with loaded Image actors evidenced by the normal UI tree. In the new normal process/time window there must be no new geometry records. A normal shelf-only scene would make this absence check vacuous. A prior enabled process's buffered records are excluded by provenance, not counted as new logging.
6. **Submitted frame and source ownership.** Every geometry record must keep `submittedPaintEvidence=0`. Image.onComplete metadata describes decode/native destination geometry. The diagnostic postFrame callback is only a report scheduling boundary. Neither proves a compositor-submitted frame or the top pixels' source. R7 content-origin remains OPEN without a separately admissible production input-to-render proof; no cache/source extraction or screenshot is part of this protocol.

The live-sample result can close only the native caller's delivery of these numeric fields and their validator/owner behavior. It cannot alone close whole-page rendered pixels, motion timing, source-content ownership or user acceptance.

## History removal without deleting logs

The helper's `hilog -x -T MangaGeometry` reads buffered matching logs. It does not implement history filtering. The session nonce binds only the UI-tree paths; it is not emitted by the production geometry records. No log buffer should be cleared for this protocol.

Use the raw baseline plus **both** PID and native time:

- Save the matching baseline before the cold probe start. Preserve it unchanged.
- After the successful start, use the fixed Reader PID query and guest epoch query to bind the current process/window. A failed PID query stops this helper; absence should be recorded rather than worked around with an arbitrary command.
- Select exact matching process records whose `observedAtMs` is in the native phase interval. `date +%s` has one-second resolution: use lower `epoch*1000` and upper `(epoch+1)*1000`, retaining this uncertainty. Do not compare guest event timestamps directly to host wall-clock transcript timestamps.
- Exclude exact records already present in the baseline, even if a PID was reused or the lower-bound second overlaps prior rows. Preserve the baseline/exclusion counts and the selected original lines in separate derived evidence.
- Require internally consistent receipt/state/sequence progression within the attributed process. Sequence is local to a Surface and capped at 128; it is not a run identifier or a global clock. At most eight row samples are retained. A sequence reset does not identify a new launch by itself.
- Repeat the process/time separation for the normal cold start. If PID association, clock ordering, baseline capture or interval attribution is unavailable/ambiguous, leave runtime provenance OPEN. Do not fill the gap from source assertions, a decoded receipt from an earlier process or a stale Area.

The code does not carry a cryptographic run nonce in its logs. PID/time/baseline evidence therefore supports bounded process attribution and must be joined with the parent's canonical deployment and session action record.

## Minimal UI-tree checks

Use A immersive → B controls → C directory → D immersive and normal/exit trees for the same actual resumed manga, with no chapter selection, scroll, source or preference change. The saved labels are references to those actual scenes, not predetermined chapter/page fixtures.

For corresponding main-reader Scroll/List/ListItem/Image actors, compare `origBounds` and numeric dimensions/positions across phases. Record visible `bounds` separately: status-window clipping can change a visible top edge while original image rectangles remain unchanged. Verify that the viewport's original rectangle covers the app window and that corresponding image rows keep their original positions/sizes. A restored intra-image anchor may naturally place the first visible row above zero; do not blindly demand that every first visible Image begins at y0.

Controls/directory actors and system-bar scene presence may change independently. An opaque directory sheet prevents a visual image comparison, but it does not excuse a changed original image rectangle. UI-tree bounds are layout metadata; they do not prove draw submission, source margins or pixels. Same app-window identity and unchanged chapter/page labels support the stable-scene boundary, while source/SDK regression remains the required code layer.

## Session evidence caveats

- Commands are serialized, but the transcript is named `.jsonl` while raw stdout/stderr chunks are appended between operation JSON rows. Parse it as a mixed raw transcript, not as guaranteed one-JSON-object-per-line. Record command completion/exit separately; the helper prints those acknowledgements to its stdout.
- The `created` set and remote nonce constrain reads to session-created UI trees. They do not prevent repeating an allowed label or overwriting its local `a.json`/other filename across sessions. Use each label once and an empty evidence destination, or stop and preserve the previous attempt separately before rerunning. Do not overwrite already accepted raw trees.
- A command exit code 0 only proves CLI completion. Inspect expected tree scene, PID and numeric records before calling an operation's intended effect observed.
- Fixed click coordinates are not semantic selectors. Check the preceding tree's actual controls before each click; if the intended scene is absent, stop instead of repeating clicks blindly.
- The process is force-stopped only to make the cold-start exact-boolean gate observable. App data is not cleared or uninstalled. Progress/reading changes beyond the bounded protocol are not authorized by this review.

This review proposes no new production mechanism, CLI flag, arbitrary read port or extra sampling. The source and SDK gates are already frozen. New runtime records must be saved under their own provenance, and old R7/R8 evidence must remain intact.

