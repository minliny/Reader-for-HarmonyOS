# HarmonyOS Slice 1 Evidence Manifest

Status: `ENTRY_READY_DEVICE_BLOCKED`

Date: 2026-07-04

Scope: HarmonyOS native ArkUI Slice 1 AppShell reducer validator evidence. This manifest separates compile/build, headless validator, and simulator/real-device evidence. It does not claim device proof.

Latest local result:
- `npm run validate:frontend-slice1` -> `PASS_STATIC_DEVICE_BLOCKED`, `11P 0F / 11`.
- Artifact: `artifacts/frontend-slice1-headless/latest/summary.json`.
- `hdc list targets` -> `[Empty]`, so runtime headless and device/simulator proof remain blocked.
- `runtimeExecuted` is `false`; this artifact proves source inclusion and bridge wiring only.

## Compile/build proof

Command:

```bash
./hvigorw --mode module -p module=entry assembleHap
```

Expected proof:
- HAP build completes.
- `entry/src/main/ets/__tests__/AppShellReducerValidator.ets` compiles through `TestInfra.ets`.
- `entry/src/main/ets/ui/store/ReaderReducer.ets`, `ReaderUiStore.ets`, `ReaderUiState.ets`, `MotionAdapter.ets`, and `TokenAdapter.ets` compile in the native ArkUI app.

Boundary:
- Compile success is not runtime execution.
- Compile success is not simulator or real-device evidence.

## Headless validator entry

### Local static validator

Command:

```bash
npm run validate:frontend-slice1
```

Artifact:

```text
artifacts/frontend-slice1-headless/latest/summary.json
```

Expected proof:
- `AppShellReducerValidator.ets` exports a Slice 1 coverage manifest.
- `TestInfra.ets` registers `Frontend Slice 0/1 AppShell Reducer`.
- `EntryAbility.ets` keeps the `readerHeadlessTest=1` runtime hook and `HEADLESS_TEST_JSON` log marker.
- `MotionAdapter.ets` resolves duration/easing from generated `getMotionSpec`.
- `TokenAdapter.ets` resolves generated token values from `tokens` / `getToken`.
- `AppShellStateFlow.ets` consumes platform adapters instead of hard-coded shell constants.

Boundary:
- This is source/contract inclusion evidence, not ArkUI runtime execution.
- A `PASS_STATIC_DEVICE_BLOCKED` result is acceptable only for this no-device slice.
- It must not be promoted into simulator or real-device proof.

Existing broad validator note:
- `npm run validate:gap-matrix` currently fails because `docs/PLANNING/HARMONYOS_CORE_LEGADO_CAPABILITY_GAP_MATRIX.json` is missing.
- That failure belongs to the older Core/Legado planning matrix lane and is not AppShell reducer bridge evidence.

### Runtime headless validator

Prerequisites:
- A connected HarmonyOS simulator or device visible to `hdc`.
- A built and installed HAP for bundle `com.reader.harmonyos`.

Command:

```bash
hdc shell aa start -b com.reader.harmonyos -a EntryAbility --ps readerHeadlessTest 1
hdc shell hilog | grep HEADLESS_TEST_JSON
```

Expected AppShell suite:
- `Frontend Slice 0/1 AppShell Reducer` is listed in `HEADLESS_TEST_JSON`.
- The suite covers tab switch, reduced motion, pageState loading, overlay mutex, activeSession mutex, async latest-intent/loading guard, and focus restore.

Boundary:
- Headless execution is runtime validator evidence only.
- Headless execution does not prove visible tab switching, overlay rendering, focus behavior for screen readers, or device gesture behavior.
- If the broader `TestInfra` suite reports unrelated legacy failures, report those separately from the AppShell reducer suite.

## Simulator/device evidence entry

Candidate commands:

```bash
scripts/run_unified_evidence_simulator.sh
scripts/run_device_runtime_smoke.sh
```

Required fresh artifacts before marking Slice 1 device-complete:
- cold start recording
- tab switch recording
- state-layer screenshot or recording
- overlay/focus restore recording
- session capsule recording

Boundary:
- Simulator and real-device tiers must be reported separately.
- Do not promote old screenshots, headless logs, or build logs into fresh Slice 1 device proof.
