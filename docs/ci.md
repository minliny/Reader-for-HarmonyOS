# HarmonyOS source and integration checks

HarmonyOS CI runs affected, qualified pure-Node Host checks on branch pushes and pull requests, including fork PRs. Changes limited to documentation or `.reader-artifacts/` are skipped. Checks with no applicable case report `NOT_RUN`.

Trusted runs on pushes to `main`, same-repository PRs, and the default manual or weekly trigger build and verify an unsigned arm64 HAP with the pinned `api26r` SDK. Manual `api23` and `api24` runs compile Core Native only. The public artifact contains the manifest, source snapshot and build summary, with five-day retention. Native outputs stay in the build job's temporary workspace. Signed builds and device acceptance have separate evidence.

The manual `contracts.yml` workflow retains exact test and case selection and an explicit source-hygiene option. For local work, use the task table in [`../../GATE_INDEX.md`](../../GATE_INDEX.md) and select checks by ID, `--stages` or `--tests`. Unselected checks are `NOT_RUN`. A selected check with a missing tool, a failure or a missing result remains failed or incomplete.

Native synchronization uses `node scripts/hap-pipeline.mjs sync-native`. The previous `sync-core` spelling delegates to the same provenance checker and transactional replacement. Inputs must come from a fresh matching Core build, with `core-input-snapshot.json` and SDK smoke evidence. Older generated SO/SDK packages are retained for recovery and are not accepted as inputs for new source.
