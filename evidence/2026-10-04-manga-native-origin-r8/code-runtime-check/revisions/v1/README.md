# R8 file-only numeric runtime check

Prepared without running VM, HDC, product tests or a HAP build. This namespace is evidence tooling, outside the canonical product/tools inputs. Existing R7 and R8 frozen materials are unchanged.

Supply actual canonical manifest and its adjacent `source-snapshot.json`, the numeric helper's `numeric-session.jsonl`, received A/B/D UI trees, fixed runtime metadata, and the exact production `MangaImageOriginGeometry.ts` admitted by that manifest. This script does not accept images, screenshots, image-cache files, or device operations.

```sh
node --experimental-strip-types /Users/minliny/Documents/Reader/.reader-isolated/manga-ui-20261002/Reader-for-HarmonyOS/evidence/2026-10-04-manga-native-origin-r8/code-runtime-check/check-native-runtime.mjs \
  --manifest /absolute/canonical/run/manifest.json \
  --session /absolute/r8/vm/numeric-session.jsonl \
  --a /absolute/r8/vm/a.json \
  --b /absolute/r8/vm/b.json \
  --d /absolute/r8/vm/d.json \
  --metadata /absolute/r8/vm/runtime-metadata.json \
  --validator /absolute/delivery/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaImageOriginGeometry.ts \
  --output /absolute/r8/code-runtime-check/runtime-result.json
```

Minimum fixed metadata, supplied by Root from the actual session:

```json
{
  "pid": 12345,
  "guestEpochStartSeconds": 1790000000,
  "manifestRunId": "ACTUAL_RUN_ID",
  "signedHapSha256": "ACTUAL_64_LOWERCASE_HEX_SHA256"
}
```

The numbers above are format examples and must not be used as runtime values. `guestEpochEndSeconds` may additionally bound the session. To establish association to each actual A/B/D capture, add measured guest epoch windows (milliseconds), covering the relevant observation and tree capture:

```json
{
  "phaseWindows": {
    "a": { "startMs": 1790000000123, "endMs": 1790000000456 },
    "b": { "startMs": 1790000001000, "endMs": 1790000001500 },
    "d": { "startMs": 1790000002000, "endMs": 1790000002500 }
  }
}
```

No phase windows means phase association is OPEN. A phase that has only retained native receipts stays OPEN even when its UI original layout is unchanged. The script does not turn a post-frame read of an old callback into a new native paint receipt.

The same transcript must include the existing pre-probe `log` baseline, followed by `stop` → one `startProbe` → `readerPid` / `guestEpoch` with numeric stdout matching the fixed metadata. Exact PID + numeric JSON already present in that baseline is excluded. Missing baseline or cold-start/PID/epoch attribution stays OPEN. The guest `date +%s` observation has one-second resolution; metadata must use the actually observed start second, not a host timestamp. No new collection command or input interface is added.

Checks remain separate:

- The manifest run, signed HAP identity, source snapshot, and actual production validator SHA must agree. This is an input-binding check; Root's canonical verification remains the authority for HAP signature/package verification.
- The production validator runs on fresh current-PID, post-start, decoded numeric callbacks with matching state/receipt generations. Missing or retained callbacks are OPEN. Logged `destinationStatus` is not trusted as the verdict.
- A/B/D UI trees must identify the Reader bundle, Index page and EntryAbility. Only images inside that exact Reader root subtree are eligible; another window cannot contribute coverage. The image Scroll/List original bounds cover the entire root window; visible image rows cover the top and bottom; the same Image/ListItem/List/Scroll actors and their original rectangles remain unchanged across A/B/D. A/D separately require visible image edge coverage. B's clipped `bounds` are reported separately and cannot be treated as image reflow.
- Area coordinates are independently converted from VP using density in that exact log record. Production native component/content geometry is compared in its shared native-event unit, without mixing it with VP. A unique UI-image match requires current Area generations and a measured phase window. Each phase acceptance additionally requires that match to be the first visible UI image; a successful callback for another tile cannot substitute for the first image.

Exit codes: `0` bounded numeric/layout/phase checks PASS; `1` a definite check FAIL; `2` evidence incomplete/OPEN. Malformed inputs abort rather than provide a PASS. A PASS in this scope still does **not** prove submitted-paint completion or the source image's first-pixel color. No image bytes are read.
