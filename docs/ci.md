# HarmonyOS source and integration checks

Repository-only CI runs `node tools/run-contract-tests.mjs --source` with Node 22 and pinned Actions. The explicit test-tier manifest classifies every discovered regression; tests requiring the official SDK, current Core CLI or sibling repository inputs remain in the full local gate.

Run `bash scripts/check-local.sh` for complete current discovery in the approved development workspace. Source checks do not establish ArkTS compilation, matching OHOS Native, signed HAP or device behavior.

Native synchronization uses `node scripts/hap-pipeline.mjs sync-native`; the previous `sync-core` spelling delegates to the same provenance checker and transactional replacement. Inputs must come from a fresh matching local Core build, with `core-input-snapshot.json` and SDK smoke evidence. Older generated SO/SDK packages are retained for recovery and are not accepted as inputs for new source.

The source CI does not download a private SDK link, use signing credentials, build or install a package, change repository protection, or access a device. Cross-repository review branches and prior CI configurations remain recoverable in retained local refs.
