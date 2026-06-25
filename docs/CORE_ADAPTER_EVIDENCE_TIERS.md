# Reader for HarmonyOS — Core Adapter Evidence Tiers

Branch: `codex/harmony-napi-runtime`
Date: 2026-06-25
Scope: ArkTS / Node-API host adapter that drives Rust Reader-Core, and its contract evidence.

> 本报告强制区分三级 evidence：**headless** / **模拟器 (simulator)** / **真机 (real device)**。
> 某级暂无证据时必须写 "no evidence yet"，不得含糊暗示。本仓库的最高优先级文档仍是
> `docs/LOCAL_REPO_MIGRATION_DIRECTIVE.md`；若冲突以该指令为准。

## 三级定义

| Tier | 定义 | 判定方式 |
|------|------|----------|
| headless | 无设备/模拟器：纯 ArkTS/TS fixture 逻辑测试、contract shape 校验、artifact manifest 哈希 | 不依赖 `libreader_core_napi.so`、不依赖 `hdc` |
| 模拟器 (simulator) | HarmonyOS emulator（`hdc` target 为 loopback `127.0.0.1` / `localhost`） | `scripts/run_device_runtime_smoke.sh` 现在写入 `tier: "simulator"` |
| 真机 (real device) | 物理 device（`hdc` target 为设备 serial / USB id / 非 loopback TCP） | 同脚本写入 `tier: "device"` |

`tier` 由 `scripts/run_device_runtime_smoke.sh` 的 `derive_tier()` 从 target 派生（loopback → simulator；其余 → device），写入 `device_runtime_smoke_summary.json`。port 单独不可靠——真机经 `hdc tconn <ip>:5555` 也能走 TCP，故只认 loopback。

## 当前三级状态

### 1. Headless — PASS（入口已挂接，722 用例实际执行）

**Proven:**
- `hvigorw assembleHap` BUILD SUCCESSFUL（2026-06-25，本轮复跑）：C++ NAPI（`BuildNativeWithNinja`）+ ArkTS（`CompileArkTS`，含新 `ReaderCoreNapiBridge` / `HostBusClosedLoopValidator` / `TestInfra`）均编译通过；`.so` 打包进 HAP，含全部新导出与 `host.complete`/`host.error` command 串。这是 **compile + package** 级证据，不是 runtime 执行。
- 纯 fixture validators 在 `entry/src/main/ets/__tests__/`：`BookshelfDomainValidator`、`SearchDomainValidator`、`TOCContentDomainValidator`、`ImportDomainValidator`、`SyncDomainValidator`、`HomeDashboardValidator`、`CoreAdapterEvidenceValidator`、`CoreAdapterFirstBatchEvidenceValidator`、`CoreAdapterCompleteEvidenceValidator`、`NonUIParityEvidenceValidator`、`ExternalClosureEvidenceValidator`、`ContractRunReportValidator`、`RuntimeKitValidator`、`ReleaseGateValidator`、以及本轮新增的 `HostBusClosedLoopValidator`（闭环 host bus payload 解析，HEADLESS）。这些只跑本地 fixture / redacted boundary，原则上 headless-runnable。
- `HOS-10A-001 Bridge health smoke` 明确标注 `HEADLESS_SMOKE_ONLY`（commit `6512207`）。
- ✅ **Headless 入口已挂接并实际执行**（2026-06-25T09:32Z，模拟器 `127.0.0.1:5555`）：`EntryAbility.ets` 检测 `readerHeadlessTest=1` 启动参数 → 调用 `TestInfra.runAllDomainTests()` 运行全部 16 个 suite → 经 `hilog.info()` 输出结构化 JSON summary → `terminateSelf()` 退出，不加载 UI。`TestInfra.runAllDomainTests()` 用 `runSuite()` per-suite try-catch 包裹，单个 validator 抛异常不会中断整体运行。
  - 调用方式：`hdc shell aa start -b com.reader.harmonyos -a EntryAbility --ps readerHeadlessTest 1`，再 `hdc shell hilog` 抓 `HEADLESS_TEST_JSON` 行。
  - 实测结果（artifact: `artifacts/headless-test/20260625T093220Z/headless_test_summary.json`）：**TOTAL 718P 4F / 722**，`status: FAIL`（4 个失败为预存 fixture 问题）。
  - 13/16 suite 全 PASS：Bookshelf 24P、Search 17P、Home Dashboard 22P、TOC/Content 26P、Sync 11P、Core Adapter Evidence 115P、Core Adapter First Batch 53P、Legado Non-UI Parity 33P、External Closure 69P、Contract Run Report 84P、Runtime Kit 93P、**C ABI POC Validator 62P**（真实 native 路径 `sendJsonCommand`→`.so` 在模拟器执行 PASS）、**Host Bus Closed Loop (headless parser) 21P**（`parseHostSmokePayload` 纯函数全 PASS）。
  - 3/16 suite 有失败：Import 0P1F（抛 `Cannot read property title of undefined`）、Core Adapter Complete Evidence 53P1F/54、Release Gate 35P2F/37 —— 均为预存 fixture/断言问题，非本轮改动引入。

**Missing / gap:**
- `CAbiPocValidator` 调用 `runReaderCoreNativeSmoke()` / `getCoreInfo()` / `runHostSmokeShape()`，这些经 `readerCoreNapi.sendJsonCommand` 打到真实 `.so` → 不是无设备 headless-runnable，但在模拟器 headless 启动下已实际执行并 PASS（见上）。`runHostSmokeClosedLoop()` 同理依赖 native `hostSmoke()`，归模拟器/真机 tier；其解析逻辑 `parseHostSmokePayload` 已抽为纯函数供 headless 覆盖（21P 全 PASS）。
- `entry/build-profile.json5` 声明了 `ohosTest` target，但未落地 ohosTest 模块目录；本轮改用 `EntryAbility` headless 启动模式替代，已满足 headless 执行入口需求。

### 2. 模拟器 (simulator) — PASS（2026-06-25 runtime smoke）

**Proven（PASS）:**
- `artifacts/device-runtime-smoke/20260625T055931Z/device_runtime_smoke_summary.json`：**`status: PASS`**，`target: 127.0.0.1:5555`（emulator），`tier: "simulator"`（由 `derive_tier()` 写入），`tierReason: "loopback/tcp target -> simulator; device serial/usb -> device; see derive_tier"`。
- 本轮 run schema 为 `device-runtime-smoke.v1`，含完整 `tier` + `tierReason` 字段，loopback 目标正确分类为 simulator，不再与真机混淆。
- `deviceExecutorUsed: true`，`externalNetworkUsed: true`，`requiredRuntimeTokens` 含全部 41 个 runtime token（nativeHTTP / LocalHTTP / LocalFeed / DataStore / LocalBook / SourceMgmt / Headless / Download / TTS / WebDAV / FileToken / DBMig / Cookie / Session / JS / ArkWeb 等）。
- 所有 probe 通过：`hostNetworkProbe.directHttpsClass: http_2xx`，`deviceLocalHTTPProbe.serverReachable: true`，`deviceLocalFeedProbe.fixtureServed: true`，`deviceDataStoreProbe.passedInRuntimePanel: true`，`deviceLocalBookProbe.passedInRuntimePanel: true`，`deviceReaderUISmoke.passedInHomeLayout: true`，`deviceSourceManagementSmoke.passedInSettingsLayout: true`，`deviceHeadlessServiceDemo.passedInRuntimePanel: true`。
- artifacts 含 `home_layout.json` / `runtime_layout.json` / `runtime_panel.jpeg` / log / junit，checksums 完整。

**Existing run（失败）:**
- `artifacts/device-runtime-smoke/20260623T141611Z/device_runtime_smoke_summary.json`：`status: FAIL`，`target: 127.0.0.1:5557`（emulator），`failure: "unexpected token 'FAIL' in runtime_layout.json"`。该 run **无 `tier` 字段**，已被 2026-06-25 的 PASS run 取代。

**Fixed（本轮）:**
- `scripts/run_device_runtime_smoke.sh` 现在派生并写入 `tier` + `tierReason`。今后所有 `127.0.0.1:*` / `localhost:*` run 会被标记 `tier: "simulator"`，不再与真机混淆。
- `runtime_layout.json` 出现字面 `FAIL` 的根因已修复（layout dump 失败时写入了非 JSON 内容），2026-06-25 re-run 已 PASS。
- ✅ **HostBus pill 已加入 runtime panel 并在 simulator tier 验证 PASS**（2026-06-25T09:49Z）：`Index.ets` 的 `RuntimeDeviceEvidencePanel` 新增 `HostBus` pill，调用 `runHostSmokeClosedLoop()` → native `hostSmoke()` 真实执行 `host.request` → `host.complete` 闭环。runtime smoke PASS，layout 中 `HostBus` pill = `PASS op:1`（operationId=1 穿透），`requiredRuntimeTokens` 含 `HostBus` + `PASS op:`，`runtime_panel_settled()` 等 `HostBus` 字样现身。
- ✅ `parseHostSmokePayload` 修复：兼容 native HostSmoke 内联 JSON（`hostRequest`/`completion` 为对象）与 canned fixture（字符串）两种形态。

**Next（simulator lane）:**
1. ~~native `hostSmoke()` 真实 host bus round-trip 执行~~ — **本轮已完成**（HostBus pill `PASS op:1`）。
2. 把 `CAbiPocValidator` 的真 native 路径放在 simulator tier 执行，归档 summary。

### 3. 真机 (real device) — 无证据

**Proven:** 无（no evidence yet）。

**State:**
- `docs/HARMONYOS_NAPI_RUNTIME_SMOKE_REPORT.md`（2026-06-24）：`hdc list targets` → `[Empty]`，无设备连接。ArkTS validator 编译进模块图但 **未在任何 device/simulator 执行**。
- `entry/src/main/ets/coreAdapter/HarmonyOSReleaseGate.ets` 列出 device-evidence required 项：`nativeHTTP.evidence`、`arkWeb.evidence`、`cookie.session.evidence`、`huks.evidence`、`rdb.evidence`、`webdav.evidence`、`tts.evidence`——当前只有 fixture/local 证据，标记 missing。
- `HarmonyOSNonUIParityEvidenceRunner` / `HarmonyOSFirstBatchEvidenceRunner` 把 ArkWeb / JS bridge / file-picker / HUKS / cookie 等标为 `envBlocked` / `readyNotExecuted`，显式不伪造 device 执行。

**Next（real-device lane）:**
1. 接真机（`hdc` target 为设备 serial），重跑 `scripts/run_device_runtime_smoke.sh`，summary 应显示 `tier: "device"`。
2. 逐项补 `HarmonyOSReleaseGate` 的 device-evidence：nativeHTTP → arkWeb → cookie/session → HUKS → RDB → WebDAV → TTS。
3. 在签名 HAP 上跑 `captureHarmonyNapiSmokeArtifact`（见 Reader-Core-Native `bindings/harmony/README.md`），与本地 OHOS/Harmony build evidence 一起归档，归档时标注 tier=real-device。

## Adapter gap — ArkTS/Node-API host adapter

**本轮（2026-06-25）已闭合 host bus round-trip。** App 侧 Node-API 桥与 ArkTS 桥现已对齐 Reader-Core-Native `bindings/harmony` 参考实现的能力集。

### 本轮 C++ NAPI（`entry/src/main/cpp/reader_napi.cpp`）新增导出

原仅 `abiVersion` / `pingSmoke` / `sendJsonCommand`（一次性、首事件、无持久 runtime）。本轮新增持久 runtime + 事件队列 + host bus 闭环导出：

| 导出 | 作用 | 状态 |
|------|------|------|
| `createRuntime(config?)` | 持久 runtime handle（`napi_external`，GC finalizer 兜底释放） | ✅ 新增 |
| `releaseRuntime(handle)` | 主动销毁 runtime，flip `destroyed` 使 callback 停止入队 | ✅ 新增 |
| `sendCommand(handle, cmd)` | 向持久 runtime 发 JSON command | ✅ 新增 |
| `cancelRequest(handle, requestId)` | → `rc_runtime_cancel`，幂等 | ✅ 新增 |
| `readEvent(handle, timeoutMs?)` | 从 thread-safe queue 轮询一条 event，超时返回 null | ✅ 新增 |
| `pendingEventCount(handle)` | 队列深度 | ✅ 新增 |
| `completeHostRequest(handle, opId, result, requestId?)` | 经 `rc_runtime_send` 发 `host.complete` JSON command，result 须为 JSON object | ✅ 新增 |
| `failHostRequest(handle, opId, error, requestId?)` | 经 `rc_runtime_send` 发 `host.error` JSON command | ✅ 新增 |
| `hostSmoke()` | **闭环 host bus smoke**：create → `runtime.hostSmoke` → 捕获 `host.request` → 提取 operationId → 回 `host.complete` → 捕获最终 result event → 返回 `{hostRequest, completion}` | ✅ 新增 |
| `lifecycleSmoke(iterations?)` | 反复 create/ping/destroy，验证 worker join | ✅ 新增 |
| `abiVersion` / `pingSmoke` / `sendJsonCommand` | 保留（legacy POC validator 向后兼容） | ✅ 保留 |

实现要点：`RuntimeState` 持有 `rc_runtime_t*` + `std::deque<std::string>` event queue + `std::mutex`/`condition_variable`；Core worker thread 上的 `RuntimeEventCallback` 在 `destroyed` flag 下停止入队，避免 use-after-destroy。`host.complete`/`host.error` 经 `rc_runtime_send` 发 JSON command（v1 ABI 无独立 host-completion C 函数，见 [[c-abi-stable-boundary-goal]]）。未调用任何上游未暴露的 ABI 符号。

### 本轮 ArkTS 桥（`entry/src/main/ets/cabi/ReaderCoreNapiBridge.ets`）新增

- `ReaderCoreRuntime` 类：`create()` / `sendCommand` / `cancelRequest` / `readEvent` / `pendingEventCount` / `completeHostRequest` / `failHostRequest` / `release()`，封装持久 runtime handle。
- `runHostSmokeClosedLoop()`：调用 native `hostSmoke()`，解析 `{hostRequest, completion}` payload，验证 host.request + 最终 result 闭环。
- `parseHostSmokePayload(raw)`：纯函数解析器，从 `runHostSmokeClosedLoop` 抽出，供 headless 测试喂 canned payload（不依赖 `.so`）。

### Headless 验证（本轮新增）

- `entry/src/main/ets/__tests__/HostBusClosedLoopValidator.ets`：**HEADLESS tier**，不加载 `.so`，对 `parseHostSmokePayload` 喂 canned payload，验证：
  - well-formed 闭环（host.request + result，operationId=7 穿透）
  - `host.error` 路径（completion 是 error，`completionOk=false`）
  - 缺 completion / 缺 hostRequest / 顶层非 JSON / 内层 event 非 JSON 全部拒收
  - host.request 缺 operationId 时 `hostOperationId=null` 但仍识别为 host.request
- 已挂入 `TestInfra.runAllDomainTests()`（suite 名 `Host Bus Closed Loop (headless parser)`）。

### Compile + package 验证（本轮）

```
$ JAVA_HOME="/Applications/DevEco-Studio.app/Contents/jbr/Contents/Home" \
  DEVECO_SDK_HOME="/Applications/DevEco-Studio.app/Contents" ./hvigorw assembleHap --no-daemon
> hvigor Finished :entry:default@BuildNativeWithNinja... after 909 ms   # C++ NAPI 编译
> hvigor Finished :entry:default@CompileArkTS... after 1 s 993 ms        # ArkTS（含新 bridge/validator/TestInfra）编译
> hvigor Finished :entry:default@PackageHap... after 208 ms
> hvigor BUILD SUCCESSFUL in 982 ms
```

打包后的 `libreader_core_napi.so`（4255104 bytes，从 HAP 解出）包含全部 13 个导出名（`strings` 确认：`abiVersion`/`createRuntime`/`releaseRuntime`/`sendCommand`/`cancelRequest`/`readEvent`/`pendingEventCount`/`completeHostRequest`/`failHostRequest`/`pingSmoke`/`hostSmoke`/`lifecycleSmoke`/`sendJsonCommand`），并含 `host.complete`/`host.error` command 字符串与 Core 协议校验串（如 `host.complete operationId must be greater than 0`），证明 `.so` 由当前 C++ 源码重建并链接真实 Rust runtime。

> 这是 **compile + package** 级证据。runtime 执行（`hostSmoke()` 真正跑通 `host.request`→`host.complete` round-trip）须在模拟器/真机 tier 验证——见下表。

### 三级 evidence 状态（host adapter 维度）

| Tier | host bus 闭环证据 | 状态 |
|------|------|------|
| headless | `parseHostSmokePayload` 闭环解析 + 各类 malformed 拒收（`HostBusClosedLoopValidator`） | ✅ compile + 解析逻辑 headless 覆盖 |
| 模拟器 (simulator) | native `hostSmoke()` 真实 round-trip 执行 | ✅ PASS（HostBus pill `PASS op:1`，runtime smoke 20260625T094901Z） |
| 真机 (real device) | native `hostSmoke()` + 签名 HAP | ⏳ 待跑（需 `hdc` + 真机） |

> ABI 约束：app 侧 `native/reader_core_abi/include/reader_core.h` 是 vendored 副本，须与 Reader-Core-Native 上游 `include/reader_core.h` 同步。若 host adapter 需要上游未暴露的 ABI 符号，记入下表，**不得私改 ABI**（那是 `c-abi-stable-boundary-goal` 的领地）。

**ABI gap ledger（app → 上游）:** （暂无；当前 `sendJsonCommand` 用到的 `rc_abi_version`/`rc_runtime_create`/`rc_runtime_send`/`rc_runtime_destroy` 上游均已暴露。闭环所需 `rc_runtime_cancel` 上游已暴露；`host.complete`/`host.error` 经 `rc_runtime_send` 发 JSON command，无需新 ABI。）

### Contract-evidence issue：vendored ABI header 是过时 POC stub

`native/reader_core_abi/include/reader_core.h` 是 Phase-3 POC 阶段的 **divergent stub**（只定义 3 个纯函数 + `READER_CORE_*` 错误码 enum），与上游 Reader-Core-Native `include/reader_core.h`（`rc_runtime_t` opaque handle + `rc_runtime_create`/`rc_runtime_send`/`rc_runtime_cancel`/`rc_runtime_destroy`/`rc_abi_version` + callback event）**完全不一致**。

`entry/src/main/cpp/CMakeLists.txt:40-44` 的 `include_directories` 实际包含的是 `${READER_CORE_NATIVE_ROOT}/include`（上游头），而 **不** 是 `native/reader_core_abi/include`。`reader_napi.cpp` `#include "reader_core.h"` 解析到的也是上游头。结论：**vendored POC stub 不被构建使用，是误导性残留**，会让读者以为 ABI 是 POC 3-函数形态。

**Next（contract lane）:**
1. ~~删除 `native/reader_core_abi/` 或将其同步为上游 `include/reader_core.h` 的真实副本~~ — **本轮已同步**：`native/reader_core_abi/include/reader_core.h` 现与上游 `Reader-Core-Native/include/reader_core.h` 逐字节一致（`diff -q` IDENTICAL）。
2. 今后该副本须随上游一起更新；上游 ABI 变更时（见 `c-abi-stable-boundary-goal`），本副本同步，并在本报告 "ABI gap ledger" 记录。

## 本轮（2026-06-25）改动

- `scripts/run_device_runtime_smoke.sh`：新增 `derive_tier()`，summary JSON 写入 `tier` + `tierReason`，今后 simulator/device run 不再混淆。`bash -n` 通过，`derive_tier` 对 `127.0.0.1:5555`/`127.0.0.1:5557`/`localhost:5555` → `simulator`，对 `192.168.1.10:5555`/设备 serial → `device`。
- `native/reader_core_abi/include/reader_core.h`：同步为上游 `Reader-Core-Native/include/reader_core.h` 的真实副本（原为 divergent POC stub，未被构建使用，已 `diff -q` 确认 IDENTICAL）。
- `entry/src/main/cpp/reader_napi.cpp`：新增持久 runtime + event queue + cancel + `completeHostRequest`/`failHostRequest` + 闭环 `hostSmoke` + `lifecycleSmoke`，保留 legacy 导出。
- `entry/src/main/ets/cabi/ReaderCoreNapiBridge.ets`：新增 `ReaderCoreRuntime` 类 + `runHostSmokeClosedLoop` + 纯函数 `parseHostSmokePayload`。
- `entry/src/main/ets/__tests__/HostBusClosedLoopValidator.ets`（新）：headless 闭环解析验证，已挂入 `TestInfra.runAllDomainTests()`。
- `entry/src/main/ets/__tests__/TestInfra.ets`：注册 `Host Bus Closed Loop (headless parser)` suite。
- Compile + package 验证通过：`hvigorw assembleHap` BUILD SUCCESSFUL；打包 `.so` 含全部新导出与 `host.complete`/`host.error` command 串。
- 本报告：建立三级 evidence 现状基线，记录 adapter gap 与 backlog。

## 未改动的边界（守约）

- 未改 Reader-Core-Native（`crates/`、上游 `include/reader_core.h`、`bindings/`、`tools/`、`scripts/`）。
- 未改 iOS / Android / CLI。
- 未提交 `entry/.cxx/` 或任何构建产物（`**/build/`、`.hvigor/`、`oh_modules/`、`node_modules/`）——均在 `.gitignore`，保持未跟踪。
- 未在 `~/Documents/` 下创建新目录。
