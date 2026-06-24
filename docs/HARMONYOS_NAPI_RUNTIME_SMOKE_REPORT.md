# HarmonyOS NAPI Runtime Smoke Report

Branch: `codex/harmony-napi-runtime`
Date: 2026-06-24
Core branch: `origin/codex/core-protocol-runtime`

## Scope

First-version HarmonyOS NAPI module + ArkTS bridge wiring the Reader-Core-Native
C ABI JSON protocol. This is a **HAP/package-level** smoke. No device or
simulator was connected (`hdc list targets` → `[Empty]`), so this report does
NOT claim device-real runtime, ArkWeb, session, or device-CI passage.

## What was wired

### NAPI layer (`entry/src/main/cpp/reader_napi.cpp`)

Calls the Reader-Core C ABI (`rc_abi_version`, `rc_runtime_create`,
`rc_runtime_send`, `rc_runtime_destroy`) over the JSON protocol. Exports:

- `abiVersion()` — `rc_abi_version()`
- `pingSmoke()` — legacy `core.ping` convenience (kept for the FFI/Harmony smoke
  binaries and the POC validator)
- `sendJsonCommand(command: string): string` — generic JSON-protocol entry:
  creates a fresh runtime, sends one reader-command, returns the JSON of the
  first event Core emits back (result / error / host.request)

The `.so` is built from `libreader_core.a` (Reader-Core-Native OHOS staticlib)
and linked against `libace_napi.z.so` + `libc++_shared.so`.

### ArkTS bridge (`entry/src/main/ets/cabi/ReaderCoreNapiBridge.ets`)

Exposes a clean API on top of `sendJsonCommand`:

- `getCoreInfo()` → `core.info` structured result
- `pingRuntime()` → `runtime.ping` structured result (`pong`, `method`)
- `sendJsonCommand(method, params, requestId?)` → generic protocol response
- `sendUnknownMethod()` → unknown-method structured error
- `runHostSmokeShape()` → `runtime.hostSmoke` host.request shape verification
- `runReaderCoreNativeSmoke()` → toolchain + ABI smoke (legacy `core.ping`)

### Validator (`entry/src/main/ets/__tests__/CAbiPocValidator.ets`)

Asserts, through the real NAPI → C ABI → Rust runtime path:

- `core.info` returns a structured result with `abiVersion=1`,
  `protocolVersion=1`, non-empty `buildVersion`, and capabilities including
  `core.info`, `runtime.ping`, `runtime.hostSmoke`
- `runtime.ping` returns `pong=true`, `method="runtime.ping"`
- unknown method (`definitely.not.a.method`) returns a structured error with
  `code="UNKNOWN_METHOD"` and a non-empty message
- `runtime.hostSmoke` emits a `host.request` event with the echoed capability
  (`host.smoke.echo`), a non-null `operationId`, and the echoed params
- the existing POC gate still marks `toolchain`/`abi` as ready while keeping
  `memory`/`threading`/`ci` blocked

## Verification

```
$ DEVECO_SDK_HOME="/Applications/DevEco-Studio.app/Contents" ./hvigorw assembleHap --no-daemon
> hvigor Finished :entry:default@BuildNativeWithNinja... after 889 ms
> hvigor Finished :entry:default@CompileArkTS... after 8 s 422 ms
> hvigor Finished :entry:default@PackageHap... after 828 ms
> hvigor BUILD SUCCESSFUL in 3 s 608 ms
```

```
$ unzip -l entry/build/default/outputs/default/entry-default-unsigned.hap | rg "libreader_core_napi.so|libc\+\+_shared.so"
   492488  06-24 2026  libs/arm64-v8a/libreader_core_napi.so
  1262248  06-24 2026  libs/arm64-v8a/libc++_shared.so
```

The packaged `libreader_core_napi.so` exports `RegisterReaderCoreNapiModule`
and links the Rust std condition-variable timed-wait path used by the
`sendJsonCommand` event-capture loop, confirming the `.so` was rebuilt from the
current C++ source and drives the real C ABI.

```
$ git diff --check -- entry/build-profile.json5 entry/src/main/cpp entry/src/main/ets/cabi entry/src/main/ets/__tests__/CAbiPocValidator.ets
(exit 0, no whitespace/conflict issues)
```

## Capability gate status (unchanged posture)

| Gate              | Status        | Evidence                                   |
|-------------------|---------------|--------------------------------------------|
| toolchain         | PASS          | `.so` built and packaged into HAP          |
| native ABI smoke  | PASS          | `abiVersion=1`, `runtime.ping`/`core.ping` |
| core.info shape   | PASS (pkg)    | structured result via NAPI → C ABI         |
| unknown method    | PASS (pkg)    | structured `UNKNOWN_METHOD` error          |
| host-smoke shape  | PASS (pkg)    | `host.request` event shape verified        |
| memory            | BLOCKED       | ownership not verified on a real device    |
| threading         | BLOCKED       | safety not verified on a real device       |
| security          | gated (decl)  | no http/file/cookie/credential ABI surface |
| CI / device       | NOT MEASURED  | no device/simulator connected              |
| ArkWeb / session  | NOT MEASURED  | out of scope for this smoke                |

## Not verified (still blocked)

- **Device-real runtime**: `hdc list targets` returned `[Empty]`. The ArkTS
  validator was compiled into the module graph but was NOT executed on a device
  or simulator. The structured-result/error assertions above are proven at
  compile + package level only.
- **Memory ownership**, **threading safety**: still BLOCKED pending real-device
  evidence.
- **CI / device gate**: NOT MEASURED.
- **ArkWeb / session / device runtime**: NOT claimed as passing.
