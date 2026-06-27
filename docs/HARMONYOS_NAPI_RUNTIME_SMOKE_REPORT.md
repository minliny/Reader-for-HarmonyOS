# HarmonyOS NAPI Runtime Smoke Report

Branch: `codex/harmony-signed-device-runtime`
Core branch: `origin/codex/core-protocol-runtime`
Last updated: 2026-06-25 (originally 2026-06-24)

> 本报告按三级 evidence 标注：**headless** / **模拟器 (simulator)** / **真机 (real device)**。
> 某级暂无证据时写 "no evidence yet"，不得含糊暗示。三级定义与最新状态以
> `docs/CORE_ADAPTER_EVIDENCE_TIERS.md` 为准；若冲突以该文档为准。

## Scope

HarmonyOS NAPI module + ArkTS bridge wiring the Reader-Core-Native C ABI JSON
protocol. The 2026-06-24 baseline was a **HAP/package-level** smoke (no device or
simulator connected). As of 2026-06-25 the smoke has been executed on the
HarmonyOS emulator (simulator tier) and via a headless entry path; the
real-device tier remains **no evidence yet**. This report does NOT claim
device-real runtime, ArkWeb, session, or device-CI passage.

## What was wired

### NAPI layer (`entry/src/main/cpp/reader_napi.cpp`)

Calls the Reader-Core C ABI (`rc_abi_version`, `rc_runtime_create`,
`rc_runtime_send`, `rc_runtime_cancel`, `rc_runtime_destroy`) over the JSON
protocol. The 2026-06-24 baseline exported `abiVersion` / `pingSmoke` /
`sendJsonCommand` (one-shot, first-event, no persistent runtime). The 2026-06-25
round added a persistent-runtime + thread-safe event queue + host-bus closed-loop
surface, aligned to the Reader-Core-Native `bindings/harmony` reference (ABI-only,
no Core edits). Current exports:

- `abiVersion()` — `rc_abi_version()`
- `pingSmoke()` — legacy `core.ping` convenience (kept for the FFI/Harmony smoke
  binaries and the POC validator)
- `sendJsonCommand(command: string): string` — generic one-shot JSON-protocol entry
- `createRuntime(config?)` / `releaseRuntime(handle)` — persistent runtime handle
- `sendCommand(handle, cmd)` — send JSON command to a persistent runtime
- `cancelRequest(handle, requestId)` — `rc_runtime_cancel`, idempotent
- `readEvent(handle, timeoutMs?)` / `pendingEventCount(handle)` — poll the
  thread-safe event queue
- `completeHostRequest(handle, opId, result, requestId?)` — send `host.complete`
  JSON command via `rc_runtime_send`
- `failHostRequest(handle, opId, error, requestId?)` — send `host.error` JSON command
- `hostSmoke()` — closed-loop host bus smoke (create → `runtime.hostSmoke` → capture
  `host.request` → `host.complete` → capture final result)
- `lifecycleSmoke(iterations?)` — repeated create/ping/destroy, worker-join check

The `.so` is built from `libreader_core.a` (Reader-Core-Native OHOS staticlib)
and linked against `libace_napi.z.so` + `libc++_shared.so`.

### ArkTS bridge (`entry/src/main/ets/cabi/ReaderCoreNapiBridge.ets`)

- `getCoreInfo()` → `core.info` structured result
- `pingRuntime()` → `runtime.ping` structured result (`pong`, `method`)
- `sendJsonCommand(method, params, requestId?)` → generic protocol response
- `sendUnknownMethod()` → unknown-method structured error
- `runHostSmokeShape()` → `runtime.hostSmoke` host.request shape verification
- `runReaderCoreNativeSmoke()` → toolchain + ABI smoke (legacy `core.ping`)
- `ReaderCoreRuntime` class — persistent-runtime wrapper (`create` / `sendCommand`
  / `cancelRequest` / `readEvent` / `pendingEventCount` / `completeHostRequest` /
  `failHostRequest` / `release`)
- `runHostSmokeClosedLoop()` — calls native `hostSmoke()`, parses
  `{hostRequest, completion}`, verifies host.request + final-result closed loop
- `parseHostSmokePayload(raw)` — pure-function parser factored out for headless
  testing with canned payloads (no `.so` dependency)

### Validators (`entry/src/main/ets/__tests__/`)

- `CAbiPocValidator.ets` — asserts through the real NAPI → C ABI → Rust runtime
  path: `core.info` shape, `runtime.ping` pong, unknown-method `UNKNOWN_METHOD`
  error, `runtime.hostSmoke` `host.request` event with echoed capability
  (`host.smoke.echo`), non-null `operationId`, echoed params.
- `HostBusClosedLoopValidator.ets` (new 2026-06-25, **HEADLESS tier**) — feeds
  canned payloads to `parseHostSmokePayload`: well-formed closed loop
  (operationId=7), `host.error` path, missing completion / missing hostRequest /
  non-JSON top-level / non-JSON inner event all rejected.

## Three-tier evidence status

| Tier | Smoke coverage | Status |
|------|----------------|--------|
| headless | `parseHostSmokePayload` closed-loop parsing + malformed rejection (`HostBusClosedLoopValidator`); `assembleHap` compile + package | ✅ PASS (718P/4F of 722 across 16 suites; 4 failures are pre-existing fixture issues) |
| 模拟器 (simulator) | native `hostSmoke()` real `host.request` → `host.complete` round-trip via `HostBus` pill; `CAbiPocValidator` real native path | ✅ PASS (runtime smoke 20260625T094901Z, `tier: simulator`, `HostBus` pill `PASS op:1`) |
| 真机 (real device) | signed HAP `captureHarmonyNapiSmokeArtifact` on physical device + `scripts/run_real_device_runtime_evidence.sh` summary wrapping `tier: "device"` runtime smoke | ⏳ no evidence yet (`scripts/run_real_device_runtime_evidence.sh` returns `BLOCKED` on this machine: no non-loopback `hdc` target and no signed HAP/signing env) |

Headless entry: `EntryAbility.ets` detects `want.parameters['readerHeadlessTest']
=== '1'` → `TestInfra.runAllDomainTests()` → emits `HEADLESS_TEST_JSON` via hilog
→ `terminateSelf()`. Invoked on emulator `127.0.0.1:5555` via
`aa start --ps readerHeadlessTest 1`; artifact
`artifacts/headless-test/20260625T093220Z/` → 718P 4F / 722.

Simulator runtime smoke: `scripts/run_device_runtime_smoke.sh` derives
`tier: "simulator"` for loopback targets; `RuntimeDeviceEvidencePanel` `HostBus`
pill calls `runHostSmokeClosedLoop()`; layout shows `HostBus` pill = `PASS op:1`
(operationId=1 passes through). Artifact
`artifacts/device-runtime-smoke/20260625T094901Z/` → `status: PASS`.

## Verification

```
$ JAVA_HOME="/Applications/DevEco-Studio.app/Contents/jbr/Contents/Home" \
  DEVECO_SDK_HOME="/Applications/DevEco-Studio.app/Contents" ./hvigorw assembleHap --no-daemon
> hvigor Finished :entry:default@BuildNativeWithNinja...
> hvigor Finished :entry:default@CompileArkTS...
> hvigor Finished :entry:default@PackageHap...
> hvigor BUILD SUCCESSFUL
```

Packaged `libreader_core_napi.so` (4255104 bytes, extracted from HAP) contains
all 13 export names (`strings`-verified: `abiVersion` / `createRuntime` /
`releaseRuntime` / `sendCommand` / `cancelRequest` / `readEvent` /
`pendingEventCount` / `completeHostRequest` / `failHostRequest` / `pingSmoke` /
`hostSmoke` / `lifecycleSmoke` / `sendJsonCommand`) plus the `host.complete` /
`host.error` command strings and Core protocol validation strings (e.g.
`host.complete operationId must be greater than 0`,
`host.error error must be a JSON object`), confirming the `.so` was rebuilt from
the current C++ source and links the real Rust runtime.

This is **compile + package** tier evidence. Runtime execution (`hostSmoke()`
actually closing the `host.request` → `host.complete` round-trip) is proven at
the simulator tier (see above), not at the real-device tier.

## Capability gate status

| Gate              | Status          | Tier      | Evidence                                            |
|-------------------|-----------------|-----------|-----------------------------------------------------|
| toolchain         | PASS            | headless  | `.so` built and packaged into HAP                   |
| native ABI smoke  | PASS            | simulator | `abiVersion=1`, `runtime.ping`/`core.ping` executed |
| core.info shape   | PASS            | simulator | structured result via NAPI → C ABI, executed        |
| unknown method    | PASS            | simulator | structured `UNKNOWN_METHOD` error, executed         |
| host-smoke shape  | PASS            | simulator | `host.request` event shape + closed loop `PASS op:1`|
| host-bus closed loop | PASS         | simulator | `host.request` → `host.complete` round-trip         |
| host-bus parser   | PASS            | headless  | `HostBusClosedLoopValidator` 21P/0F                 |
| memory            | BLOCKED         | —         | ownership not verified on a real device             |
| threading         | BLOCKED         | —         | safety not verified on a real device                |
| security          | gated (decl)    | —         | no http/file/cookie/credential ABI surface          |
| CI / device       | NOT MEASURED    | —         | no real device connected this session               |
| ArkWeb / session  | NOT MEASURED    | —         | out of scope for this smoke                         |

## Not verified (still blocked)

- **Real-device runtime**: no physical device this session (`hdc list targets`
  returned `[Empty]` at report time). Simulator PASS is labeled simulator; it is
  NOT promoted to device tier. The structured-result/error/host-bus assertions
  are proven at headless + simulator tiers only.
- **Real-device preflight**: `scripts/preflight_real_device_runtime_smoke.sh`
  is now the repeatable gate before real-device smoke. It checks `hdc`,
  target tier, HAP/signing config, packaged `libreader_core_napi.so` tokens, and
  HostBus smoke entrypoints, then writes
  `artifacts/real-device-preflight/latest/real_device_preflight_summary.json`.
  On this machine the status is `BLOCKED`, not PASS.
- **Signed HAP + one-shot real-device wrapper**:
  `scripts/build_signed_hap.sh` can build a signed HAP from local signing config
  or `HARMONYOS_SIGNING_*` env vars, and
  `scripts/run_real_device_runtime_evidence.sh` chains signed-HAP acquisition,
  real-device preflight, runtime smoke, and
  `scripts/validate_real_device_runtime_smoke_artifact.py`. With no physical
  target or signing material, it writes `BLOCKED` evidence only.
- **Memory ownership**, **threading safety**: still BLOCKED pending real-device
  evidence.
- **CI / device gate**: NOT MEASURED.
- **ArkWeb / session / device runtime**: NOT claimed as passing.

## Next (real-device lane)

1. Connect a physical device (`hdc` target = device serial, not loopback), provide
   a signed HAP or signing env, then run
   `scripts/run_real_device_runtime_evidence.sh`; preflight must be `READY`.
2. The nested `scripts/run_device_runtime_smoke.sh` summary must show
   `tier: "device"` and pass `scripts/validate_real_device_runtime_smoke_artifact.py`.
3. Run `captureHarmonyNapiSmokeArtifact` (see Reader-Core-Native
   `bindings/harmony/README.md`) on a signed HAP; archive the formatted artifact
   output labeled `tier=real-device`.
4. Backfill `HarmonyOSReleaseGate` device-evidence items: nativeHTTP → arkWeb →
   cookie/session → HUKS → RDB → WebDAV → TTS.
