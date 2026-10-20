# HarmonyOS source and integration checks

CI keeps manual selection only. Select the checks required by the current task using the task table in [`../../GATE_INDEX.md`](../../GATE_INDEX.md) and explicit IDs / `--stages` / `--tests`. Unselected checks are `NOT_RUN`; full sets require an explicit release or overall acceptance plan.

Local checks follow the same required selection. A selected check with a missing tool, failure or missing result remains `FAIL` / incomplete. Source checks do not establish ArkTS compilation, matching OHOS Native, signed HAP or device behavior.

Native synchronization uses `node scripts/hap-pipeline.mjs sync-native`; the previous `sync-core` spelling delegates to the same provenance checker and transactional replacement. Inputs must come from a fresh matching local Core build, with `core-input-snapshot.json` and SDK smoke evidence. Older generated SO/SDK packages are retained for recovery and are not accepted as inputs for new source.

The source CI does not download a private SDK link, use signing credentials, build or install a package, change repository protection, or access a device. Cross-repository review branches and prior CI configurations remain recoverable in retained local refs.
