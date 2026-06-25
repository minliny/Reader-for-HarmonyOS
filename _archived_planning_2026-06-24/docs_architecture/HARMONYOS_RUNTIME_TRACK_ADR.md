# HarmonyOS 运行路线架构决策 (ADR)

**Date**: 2026-06-24
**Decision ID**: HOS-ADR-001
**Status**: ACCEPTED — 冻结边界，不允许把 localhost bridge 标为 release-capable
**Updated**: 2026-06-24 — Phase 0-4 产物全部就绪

## 1. 决策上下文

依据 [harmonyos_feasibility_evaluation.md](file:///Users/minliny/Documents/Reader-Core/docs/architecture/harmonyos_feasibility_evaluation.md) 已确认：

- HarmonyOS 无官方 Swift 支持，需要 C ABI/bridge 才能跑 Swift Core。
- [ReaderCoreBridge](file:///Users/minliny/Documents/Reader-Core/Sources/ReaderCoreBridge/main.swift) 自标注为 localhost dev bridge，无 auth/TLS/rate limit。
- 把 localhost bridge 当生产依赖会把所有能力卡在生命周期、安全、后台、部署和审核上。

必须先定一条主线，避免散点实现最后无法进入 Core release gate。

## 2. 路线裁决

| 路线 | 用途 | 结论 |
|---|---|---|
| localhost HTTP bridge 调 Swift Core | 本机调试、对照回归 | 保留为 dev-only，不进入发布包 |
| ArkTS Core-compatible runtime | 生产主线 | 推荐。实现成本高一些，但最符合 HarmonyOS 发布、生命周期和权限模型 |
| Swift Core C ABI + NAPI | 长期可选 | 先做 POC；只有 ABI、内存、错误码、真机 CI 都通过后才能进入主线 |
| 完全独立实现，只跑 contract runner | 可接受备选 | 如果 HarmonyOS 项目目标是快速产品化，这是最稳的交付方式 |

## 3. 冻结决策

```yaml
decision:
  productionRuntime: arkts_core_compatible
  devBridge: localhost_swift_bridge_dev_only
  optionalTrack: c_abi_napi_poc
  readerCoreOwnership:
    - contracts
    - DTOs
    - compatibility semantics
    - failure taxonomy
    - metadata_expected_matrix_gate
  harmonyOwnership:
    - ArkTS runtime implementation
    - native HTTP
    - ArkWeb
    - HUKS/SecurityKit
    - RDB/Preferences
    - TTS/audio
    - PDF/pagination
    - file permission lifecycle
```

### 3.1 localhost bridge 边界（硬约束）

- `BridgeHTTPClient`、`BridgeHealthCheck`、`FixtureReplayInterceptor` 只允许在 dev/debug 构建变体中编译。
- 任何 release 构建配置不得引用 bridge 模块。
- bridge 不得出现在 `HARMONYOS_CAPABILITY_MATRIX.yml` 的 `release_capable: true` 行。
- bridge 不计入 Core release gate 证据。

### 3.2 ArkTS Core-compatible runtime 主线

- 生产运行时由 ArkTS 实现的 Facade 组成：RulePipelineFacade、LocalBookFacade、ReadingStateFacade、ReplaceRuleFacade、SyncFacade、RuntimeHostFacade。
- 每个 Facade 输出 Core-compatible stage report，对齐 Core DTO/契约语义。
- 不复制 Legado Android 源码，clean-room 原则。

### 3.3 C ABI/NAPI POC 轨道

- POC 不接全量 Core，只接 3 个纯函数级能力：`reader_core_version`、`reader_core_apply_replace_rules`、`reader_core_parse_rule_chain`、`reader_core_free`。
- 硬性门槛：Toolchain/ABI/Memory/Threading/Security/CI 全部通过才能进入主线。
- POC 失败不阻塞产品，继续 ArkTS-compatible runtime。

## 4. Ownership 边界

### 4.1 Reader-Core 拥有（不复制实现到 HarmonyOS）

- 协议、DTO、failure taxonomy、兼容语义
- metadata/expected/matrix gate 接收逻辑
- `ReaderCorePlatformAdapterContractManifest.harmonyOSReference()` 定义（[PlatformAdapterContracts.swift](file:///Users/minliny/Documents/Reader-Core/Sources/ReaderCoreProtocols/PlatformAdapterContracts.swift)）
- `ReaderCorePlatformAdapterContractRunReport.canBeAcceptedByCoreGate` 校验

### 4.2 HarmonyOS 拥有

| 模块 | HarmonyOS 实现 | Core 对齐点 |
|---|---|---|
| RulePipelineFacade | ArkTS 实现 CSS/XPath/JSONPath/template/regex 调度 | 输出 Core-compatible stage report |
| RuntimeHostFacade | ArkWeb + nativeHTTP + cookie/session | 对齐 `runtimeHost` required features |
| LocalBookFacade | ZIP/EPUB/TXT detector/file token | 对齐 archive/localFileAccess/textEncodingDetector |
| ReplaceRuleFacade | ArkTS 版 ReplaceRuleEngine | 对齐 Core ReplaceRule 语义和样本 |
| StoreFacade | RDB/Preferences schema/migration | 对齐 group/bookmark/stat/progress DTO |
| SyncFacade | WebDAV PROPFIND/GET/PUT/DELETE + backup/retention | 输出同步矩阵 |
| CryptoFacade | HUKS AES/RSA 或 SecurityKit | 不导出明文 key/cookie/token |

## 5. 验收标准

### Phase 0 验收（本 ADR）

- [x] 三轨决策冻结
- [x] ownership 边界声明
- [x] localhost bridge 标记为 dev-only，不允许 release-capable
- [ ] HARMONYOS_CAPABILITY_MATRIX.yml 更新 bridge release_capable: false

### Phase 1 验收（Contract Runner 唯一验收口）

- HarmonyOS 项目输出统一 JSON：

```json
{
  "platformFamily": "HarmonyOS",
  "runnerIdentifier": "reader-core.harmonyos.adapter.contract-runner",
  "caseResults": [],
  "unsupportedCapabilityIDs": [],
  "evidenceArtifacts": ["metadata", "expected", "matrix", "regressionResult"],
  "cleanRoomMaintained": true,
  "externalGPLCodeCopied": false,
  "legadoSourceCopied": false
}
```

- Core 只导入 redacted run report。
- 缺 artifact、缺 required feature、把 unsupported 能力伪装成 pass，必须 fail-closed。

## 6. Release Gate 分档

```yaml
harmonyosGate:
  adapter_mvp:
    required: archive/localFileAccess/markupParser/feedParser/textEncodingDetector/runtimeHost
  product_runtime:
    required: nativeHTTP/ArkWeb/cookie/session/HUKS/RDB/WebDAV/TTS evidence
  release_candidate:
    required: rollback/credential_revocation/network_hardening/real_corpus_benchmark
```

当前 HarmonyOS 证据可作为局部运行证明，但不能直接改 release gate。`harmonyos_release_source_binding_20260623_expected.json` 仍保留 JS bridge、rollback、credential revocation、network hardening、real corpus benchmark 等 not-covered 项。

## 7. Clean Room 声明

- 兼容格式与行为，不复用实现代码。
- 禁止复制、翻译、改写 Legado Android 源码。
- ArkTS runtime 为 clean-room 实现。
- `externalGPLCodeCopied: false`、`legadoSourceCopied: false` 为硬约束。

## 8. 变更条件

本 ADR 仅在以下情况可变更：
1. C ABI/NAPI POC 全部门槛通过，且真机 CI 稳定 — 可把 C ABI 提升为主线或并列主线。
2. HarmonyOS 官方提供 Swift 运行时支持 — 可重新评估 bridge 路线。
3. 用户显式要求变更路线。

任何变更必须更新本 ADR 并重新冻结。

## 9. Phase 产物清单（2026-06-24 全部就绪）

### Phase 0：冻结边界

- [x] [HARMONYOS_RUNTIME_TRACK_ADR.md](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/docs/architecture/HARMONYOS_RUNTIME_TRACK_ADR.md) — 三轨决策 + ownership 边界
- [x] [HARMONYOS_CAPABILITY_MATRIX.yml](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/docs/PLANNING/HARMONYOS_CAPABILITY_MATRIX.yml) — bridge 全部 `release_capable: false`

### Phase 1：Contract Runner 唯一验收口

- [x] [HarmonyOSContractRunReportExporter.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/coreAdapter/HarmonyOSContractRunReportExporter.ets) — 唯一验收口 + fail-closed 校验器（13 类违规）
- [x] [ContractRunReportValidator.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/__tests__/ContractRunReportValidator.ets) — 测试覆盖
- [x] [samples/contract_runner/](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/samples/contract_runner) — metadata/expected/matrix/regressionResult + 完整 run report

### Phase 2：ArkTS Runtime MVP

- [x] [RuntimeStageReport.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/runtime/RuntimeStageReport.ets) — stage report 共享格式
- [x] [RulePipelineFacade.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/runtime/RulePipelineFacade.ets) — CSS/XPath/JSONPath/template/regex 调度
- [x] [LocalBookFacade.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/runtime/LocalBookFacade.ets) — ZIP/EPUB/TXT detector
- [x] [ReadingStateFacade.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/runtime/ReadingStateFacade.ets) — 阅读状态/书签
- [x] [ReplaceRuleFacade.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/runtime/ReplaceRuleFacade.ets) — 替换规则引擎
- [x] [StoreFacade.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/runtime/StoreFacade.ets) — RDB/Preferences schema/migration
- [x] [SyncFacade.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/runtime/SyncFacade.ets) — WebDAV + backup/retention
- [x] [RuntimeHostFacade.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/runtime/RuntimeHostFacade.ets) — ArkWeb + nativeHTTP + cookie/session
- [x] [CryptoFacade.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/runtime/CryptoFacade.ets) — HUKS AES/RSA
- [x] [HarmonyOSRuntimeKit.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/runtime/HarmonyOSRuntimeKit.ets) — 8 Facade 聚合入口
- [x] [RuntimeKitValidator.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/__tests__/RuntimeKitValidator.ets) — 测试覆盖

### Phase 3：C ABI/NAPI POC

- [x] [reader_core.h](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/native/reader_core_abi/include/reader_core.h) — C ABI 接口定义（3 纯函数 + free）
- [x] [ReaderCoreNapiBridge.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/cabi/ReaderCoreNapiBridge.ets) — NAPI 绑定骨架 + POC 门槛校验 + 模拟模块
- [x] [CAbiPocValidator.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/__tests__/CAbiPocValidator.ets) — 测试覆盖

POC 门槛状态: `canEnterMainline: false`（toolchain/abi/memory/threading/ci 未通过，security gated 已声明）。POC 失败不阻塞产品，继续 ArkTS-compatible runtime。

### Phase 4：Release Gate 分档

- [x] [HarmonyOSReleaseGate.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/coreAdapter/HarmonyOSReleaseGate.ets) — 三档递进校验器
- [x] [ReleaseGateValidator.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/__tests__/ReleaseGateValidator.ets) — 测试覆盖

当前 gate 状态:

| 档位 | accepted | 说明 |
|---|---|---|
| adapter_mvp | true | 6 adapter + contract run report + clean room 全部通过 |
| product_runtime | false | device evidence missing（nativeHTTP/arkWeb/cookie/huks/rdb/webdav/tts 待真机 CI） |
| release_candidate | false | rollback/credential.revocation/network.hardening/real.corpus.benchmark/product.gated.js.bridge missing |

`canMutateProductionReleaseGate: false` — HarmonyOS 证据不直接改 Core release gate。

### 测试基础设施

- [x] [TestInfra.ets](file:///Users/minliny/Documents/Reader%20for%20HarmonyOS/entry/src/main/ets/__tests__/TestInfra.ets) — 注册 4 个新测试套（Contract Run Report / Runtime Kit / Release Gate / C ABI POC）
