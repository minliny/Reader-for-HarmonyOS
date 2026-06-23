# Reader-for-HarmonyOS

## Device Runtime Smoke

Run the repeatable emulator/device runtime smoke from the repo root:

```bash
npm run smoke:device-runtime
```

Run the CI-consumable gate:

```bash
npm run ci:device-runtime
```

Validate the current fail-closed runtime artifact without treating it as a pass:

```bash
npm run ci:device-runtime:validate-fail
```

Defaults:

- target: `127.0.0.1:5555`
- bundle: `com.reader.harmonyos`
- module: `entry`
- runtime wait: `240` seconds, polled every `5` seconds
- runtime proxy: `HARMONYOS_RUNTIME_PROXY_MODE=auto` detects host proxy env;
  set `off` to disable or `HARMONYOS_RUNTIME_PROXY_HOST/PORT` to override
- output: `artifacts/device-runtime-smoke/<utc-timestamp>/`
- latest pointer: `artifacts/device-runtime-smoke/latest`

The runner builds the HAP, installs and starts the app through `hdc`, dumps the
home layout, opens the Settings runtime panel, polls the runtime layout until it
settles, captures a runtime-panel screenshot, and fails unless the runtime layout
contains `nativeHTTP`, `PASS 2xx`, `ArkWeb`, `Cookie`, `Session`, `JS`,
`Secure`, `Corpus`, and `raw:false` with no `FAIL` or `RUNNING` token. The
generated summary is redacted and records no raw URL, cookie, credential,
session, or response body material. When a runtime proxy is injected for an
emulator smoke, the summary records only proxy mode/source, host hashes, port,
endpoint rewrite status, listen-scope classification, local port reachability,
and whether the runtime panel confirmed app-level proxy application.

CI artifacts include `device_runtime_smoke_summary.json`,
`device_runtime_smoke.junit.xml`, home/runtime layout dumps, a runtime-panel
screenshot, and the hdc/hvigor log. The offline validator re-checks summary
flags, layout tokens, redaction fields, and checksums.

## HarmonyOS + Core vs Legado Gap Matrix

The current capability gap snapshot is tracked in:

```bash
docs/PLANNING/HARMONYOS_CORE_LEGADO_CAPABILITY_GAP_MATRIX.json
```

Validate it with:

```bash
npm run validate:gap-matrix
```

The validator checks the clean-room flags, the nine tracked capability domains,
the latest device-runtime CI artifact, and the rule that the current
nativeHTTP/corpus failure is not treated as a runtime parity pass.
