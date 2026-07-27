# HarmonyOS 基线审计报告（PR #4 合并后）

## 快照元数据
- 快照时间：2026-07-27T06:07:34.694Z
- main commit：`192ab79c17480cbf82723a177698f9ac6b80fbd7`
- PR #4 merge commit：`192ab79c17480cbf82723a177698f9ac6b80fbd7`（squash-merge，parent = `d0abdfdb45b285451bae6df89a9daf40f73c1679`）
- 总文件数：561
- PR #4 引入文件数：534 新增 + 17 修改 = 551

## 分类汇总
| 类别 | 文件数 | PR #4 引入 | 路由可达 |
|------|--------|-----------|---------|
| gate | 32 | 32 | 0 |
| arkts-contract | 21 | 21 | 21 |
| core-host-bridge | 45 | 45 | 45 |
| page-ui | 86 | 86 | 86 |
| visual-resource | 292 | 287 | 292 |
| test | 57 | 57 | 0 |
| planning-doc | 9 | 9 | 0 |
| archive | 0 | 0 | 0 |
| config | 15 | 10 | 1 |
| other | 4 | 4 | 0 |
| **合计** | **561** | **551** | **445** |

## 路由可达性说明

路由系统架构（基于实际读取的配置文件）：

1. **单一 @Entry 页面**：`entry/src/main/resources/base/profile/main_pages.json` 仅注册 `pages/Index`。
2. **EntryAbility**（`entryability/EntryAbility.ets`）初始化 `ReaderUiStore`、`CoreRuntime`、Host 适配器，加载 `pages/Index`。
3. **RouteRenderer**（`ui/router/RouteRenderer.ets`）读取 `AppStorage['reader.routeId']`，通过 `RouteTable.shellOf()` 解析到 5 个 Shell：`MainTabShell` / `ReaderShell` / `LibraryShell` / `SettingsShell` / `FlowShell`。
4. **VisualAdmission 执行门**：`RouteRenderer.isDisplayedRouteImplementationReady()` 调用 `ReaderUiVisualAdmission.isRouteAdmittedForViewport(routeId, viewportClass)`，仅 `implementation-ready` 路由才渲染；`candidate-backport` 路由 fail-closed 为空柱。
5. **RouteTable**（`contract/generated/RouteTable.ets`）列出 ~270 个 RouteId，全部映射到 5 个 Shell 之一。

路由可达性判定：
- `entry/src/main/ets/` 下所有 `.ets` / `.ts` 源文件：**true**（从 EntryAbility/Index → RouteRenderer → shells → components/store/adapters/contract 可达）
- `entry/src/main/resources/` 下资源文件：**true**（被 ArkTS 通过 `$r()` / `$rawfile()` / token registry 引用）
- `entry/libs/` 下 NAPI .so：**true**（被 `bridge/CoreRuntime.ets` 加载）
- `entry/src/test/` / `entry/src/ohosTest/` / `host/tests/`：**false**（测试代码，不在运行时路由图内）
- 其他（docs / scripts / .github / config / AGENTS.md 等）：**null**（不适用）

## gate（32 个文件）

| 文件 | PR#4 | 状态 | 可达 | 权威来源 | 处置 | 依据 |
|------|------|------|------|---------|------|------|
| `.github/workflows/reader-contract-gate.yml` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `.github/workflows/reader-ui-consumer.yml` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `READER_UI_CONSUMER.json` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/book_detail_retry_status.test.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/check_device_signing_profile.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/check_figma_shadow_allowlist.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/check_reader_ui_shadow_allowlist.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/collect_device_evidence.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/device_evidence_install_result.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/device_evidence_install_result.test.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/device_signing_profile.test.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/encrypt-signing-pwds.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/enforce-implementation-ready-gate.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/figma_book_search_static_contract.test.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/figma_settings_general_static_contract.test.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/gen-debug-signing.sh` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/gen_contracts.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/lint_tokens.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/publish-host-bump-pr.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/reader_ui_release_lock.test.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/reader_ui_release_lock_lib.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/run_ohos_device_tests.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/slice10_contract.test.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/slice11_contract.test.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/slice12_contract.test.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/slice9_host_contract.test.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/sync_reader_ui_screen_graph.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/test.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/test_contracts.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/update_reader_ui_package_lock.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/verify_figma_live_source_snapshot.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |
| `scripts/verify_reader_vm_layout.mjs` | ✓ | added | — | PR #4 | 待定 | CI/执行门/契约检查器（PR #4 引入） |

## arkts-contract（21 个文件）

| 文件 | PR#4 | 状态 | 可达 | 权威来源 | 处置 | 依据 |
|------|------|------|------|---------|------|------|
| `entry/src/main/ets/contract/generated/ColorTokens.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/generated/DemoAliasTokens.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/generated/DimensionTokens.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/generated/HostRequestTable.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/generated/MotionPolicyTable.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/generated/MotionSpecTable.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/generated/MotionTokens.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/generated/RouteTable.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/generated/ShadowTokens.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/generated/TextConstraintTokens.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/generated/TokenRegistry.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/generated/TypeTokens.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/generated/ViewStateTable.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/reader_ui/Appearance.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/reader_ui/ReaderUiVisualTokenAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/reader_ui/Route.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/reader_ui/ScreenGraph.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/reader_ui/UiEvent.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/reader_ui/UiState.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/reader_ui/ViewState.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |
| `entry/src/main/ets/contract/reader_ui/VisualAdmission.ets` | ✓ | added | ✓ | Reader-UI 契约（generated/ + reader_ui/） | 待定 | Reader-UI 生成契约（gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer） |

## core-host-bridge（45 个文件）

| 文件 | PR#4 | 状态 | 可达 | 权威来源 | 处置 | 依据 |
|------|------|------|------|---------|------|------|
| `entry/libs/arm64-v8a/PROVENANCE.md` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/libs/arm64-v8a/libc++_shared.so` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/libs/arm64-v8a/libreader_core_napi.so` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/bridge/CoreRuntime.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/bridge/SourceDebugTranscriptRecorder.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/bridge/core/Index.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/bridge/core/sdk/reader_core.ts` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/bridge/core/sdk/smoke_report.ts` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/HarmonyReaderUiHostPlatform.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/HostCapabilityManifest.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/HostCapabilityRegistry.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/HostDispatcher.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/LocalBookFormatPolicy.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/ReaderUiHostCapabilityManifest.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/ReaderUiHostContract.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/ReaderUiHostDispatcher.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/BackgroundHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/ClipboardHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/CookieHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/CoreHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/CredentialHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/DeviceHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/FileHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/FileSelectionHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/FontHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/ForegroundTimerHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/HttpHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/NetworkHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/NotificationHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/PermissionHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/ReaderUiPreferenceHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/ScreenHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/ShareHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/SourceImageCache.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/SourceSessionHostStore.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/TtsHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/WebDavHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/WebViewHostAdapter.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/adapters/index.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/index.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/types/HostError.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/types/HostRequest.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/types/HostResult.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/host/types/index.ets` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |
| `entry/src/main/ets/libreader_core_napi.d.ts` | ✓ | added | ✓ | Reader-UI 契约 + Core 协议 | 待定 | Reader-UI 契约 + Reader-Core-Native C ABI 协议 |

## page-ui（86 个文件）

| 文件 | PR#4 | 状态 | 可达 | 权威来源 | 处置 | 依据 |
|------|------|------|------|---------|------|------|
| `entry/src/main/ets/entryability/EntryAbility.ets` | M | modified | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/pages/Index.ets` | M | modified | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/adapters/InteractionDebugAdapter.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/adapters/MotionAdapter.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/adapters/SafeAreaAdapter.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/adapters/TokenAdapter.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/adapters/ViewportAdapter.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/BookDetailComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/BookshelfComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/Contract25RouteComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/ContractComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/DiscoverComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/InteractionDebugComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/LibraryComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/ReaderComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/ReaderOverlayComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/ReaderSelectionToolbar.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/RssComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/RssSelectionProjection.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/SettingsComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/SharedComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/Slice12LifecycleComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/SourceCoverImage.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/SourceSwitchFlowComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/StructuralPageComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/ViewStateRenderer.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/W1ImportFlowComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/W2ReaderStateComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/components/W5ReplaceRuleComponents.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/fixtures/DemoUiState.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/fixtures/DemoViewState.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/motion/MotionSerialMetadataRegistry.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/motion/MotionSpecRegistry.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/motion/ReaderControlMotionCoordinator.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/motion/ReaderDirectoryToTtsMotionCoordinator.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/motion/ReaderMotionResolver.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/motion/RestoreBackupOverlayMotionCoordinator.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/router/ReaderCapabilityClosureRouteRegistry.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/router/ReaderContract25RouteRegistry.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphButtonAdapter.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphContentAdapter.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphCoverage.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphDialogAdapter.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphEmptyAdapter.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphRetirementRegistry.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphShadowRegistry.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphStatePrimitiveAdapter.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphTapZoneAdapter.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphTerminalStateAdapter.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/router/RouteRenderer.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/shells/FlowShell.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/shells/LibraryShell.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/shells/MainTabShell.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/shells/ReaderShell.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/shells/SettingsShell.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/slots/OverlayHost.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/slots/StateHost.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/BookSourceRegistry.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/CoreSlice10Service.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/CoreStorageBackupHistory.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/LocalBookImportBatchCoordinator.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderBookOpenDomainMapper.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderBookOpenPilot.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderBookOpenPilotProjection.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderControlCandidateAdapter.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderDirectoryPilotProjection.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderEffects.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderImportPilotExecutor.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderPlaybackDomainMapper.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderPlaybackPilot.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderPlaybackPilotProjection.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderReducer.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderReplaceRulePilotExecutor.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderRssPilotExecutor.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderSlice10LivePayloadResolver.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderSourceSwitchPilotExecutor.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderSyncPilotExecutor.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderUIRuntimeShadowCoordinator.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderUiState.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/ReaderUiStore.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/Slice10CapabilityPolicy.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/Slice11CapabilityPolicy.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/store/Slice12CapabilityPolicy.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/tokens/ReaderThemeResolver.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/tokens/ReaderThemeState.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |
| `entry/src/main/ets/ui/tokens/ReaderTypography.ets` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma → Reader-UI source-side → HarmonyOS 消费（按 Figma 比对） |

## visual-resource（292 个文件）

| 文件 | PR#4 | 状态 | 可达 | 权威来源 | 处置 | 依据 |
|------|------|------|------|---------|------|------|
| `AppScope/resources/base/media/app_icon.png` |  | preexisting | ✓ | PR #4（modified） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `AppScope/resources/base/media/background.png` |  | preexisting | ✓ | PR #4（modified） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `AppScope/resources/base/media/foreground.png` |  | preexisting | ✓ | PR #4（modified） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `AppScope/resources/base/media/layered_image.json` |  | preexisting | ✓ | PR #4（modified） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/element/color.json` | M | modified | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/element/float.json` |  | preexisting | ✓ | PR #4（modified） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/element/string.json` | M | modified | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/bookshelf_cover_android_notes.png` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/bookshelf_cover_bright_moon.png` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/bookshelf_cover_long_night.png` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/bookshelf_cover_mystery_lord.png` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/bookshelf_cover_renjian_cihua.png` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/bookshelf_cover_three_body.png` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/bookshelf_icon_book_open_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/bookshelf_icon_filter_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/bookshelf_icon_gear_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/bookshelf_icon_grid_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/bookshelf_icon_list_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/bookshelf_icon_people_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/bookshelf_icon_search_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/discover_filter.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/discover_filter_apply_check.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/discover_filter_caret.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/discover_source_layers.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_bookshelf_empty_icon.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_directory_bookmark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_directory_bottom.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_directory_order.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_directory_search.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_directory_search_active.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_directory_top.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_full_appearance.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_full_directory.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_full_settings.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_full_tts.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_immersive_battery.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_immersive_signal.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_immersive_wifi.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_paper_tile.png` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_replace_close.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_session_pause.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_session_play.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_reader_session_tts.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/figma_search_result_cover_placeholder.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/main_tab_icon_bookshelf_active.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/main_tab_icon_bookshelf_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/main_tab_icon_discover_active.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/main_tab_icon_discover_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/main_tab_icon_rss_active.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/main_tab_icon_rss_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/main_tab_icon_settings_active.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/main_tab_icon_settings_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_brightness_sun.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_chapter_next.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_chapter_prev.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_compact_next.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_compact_prev.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_module_appearance_active.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_module_appearance_default.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_module_directory_active.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_module_directory_default.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_module_settings_active.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_module_settings_default.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_module_tts_active.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_module_tts_default.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_play.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_quick_auto_page.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_quick_replace.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_quick_search.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_top_back.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_top_more.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_top_source_switch.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_tts_caret_down.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_tts_clock.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_tts_playback.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_tts_speed.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_control_tts_stop.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_activity.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_add.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_appearance.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_assist.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_auto_page.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_back.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_back_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_badge.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_battery.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_bell.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_book.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_book_open.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_bookmark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_bookshelf.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_bug.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_check.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_checkmark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_chevron.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_chevron_chapter.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_chevron_left.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_chevron_left_chapter.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_clear.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_clock.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_close.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_close_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_cloud.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_code.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_columns.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_copy.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_current_location.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_database.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_directory.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_discover.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_download.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_edit.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_eye_off.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_file.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_filter.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_folder.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_folder_off.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_gear.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_gesture.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_globe.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_grid.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_help.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_home.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_image.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_info.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_link.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_list.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_log.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_mail.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_message.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_monitor.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_moon_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_more.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_more_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_motion.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_nav_list.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_night_mode.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_offline.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_palette.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_pause.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_pause_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_people.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_permission.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_phone.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_play.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_play_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_progress.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_auto_page.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_auto_page_action.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_content_replace.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_content_replace_action.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_content_search.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_content_search_action.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_module_appearance.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_module_appearance_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_module_appearance_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_module_directory.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_module_directory_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_module_directory_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_module_settings.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_module_settings_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_module_settings_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_module_tts.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_module_tts_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_reader_module_tts_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_refresh.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_replace.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_rss.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_search.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_settings.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_shield.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_signal.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_sort.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_source.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_source_stack.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_source_switch.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_source_switch_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_source_switch_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_source_switch_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_sparkle.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_stop.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_storage.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_sun.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_sun_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_sync.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_text.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_top.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_trash.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_tts.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_tts_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_typo.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_upload.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_volume.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_warning.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/reader_icon_wifi.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/restore_backup_check.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/restore_backup_refresh.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/search_page_back.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/search_page_clear.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/search_page_magnifier.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/source_management_group_folder.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/source_management_search_handle.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/source_management_search_ring.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_add_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_add_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_add_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_add_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_bookmark_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_bookmark_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_bookmark_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_bookmark_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_bookshelf_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_bookshelf_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_bookshelf_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_bookshelf_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_check_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_check_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_check_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_check_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_chevron_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_chevron_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_chevron_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_chevron_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_clock_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_current_location_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_download_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_file_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_gear_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_gear_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_gear_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_gear_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_gesture_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_info_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_info_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_info_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_info_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_list_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_list_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_list_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_list_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_motion_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_permission_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_progress_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_refresh_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_refresh_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_refresh_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_refresh_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_rss_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_rss_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_rss_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_rss_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_search_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_search_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_search_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_search_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_source_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_source_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_source_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_source_stack_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_source_stack_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_source_stack_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_source_stack_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_source_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_sun_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_sync_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_sync_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_sync_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_sync_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_trash_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_upload_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_upload_muted.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_upload_primary.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_upload_white.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/ui_icon_volume_dark.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/webdav_account.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/webdav_folder.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/webdav_metric_backups.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/webdav_metric_folder.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/webdav_metric_status.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/webdav_metric_time.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/webdav_password.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/webdav_save.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/webdav_server.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/base/media/webdav_test.svg` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/dark/element/color.json` | M | modified | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/rawfile/font/Inter-OFL.txt` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/rawfile/font/InterVariable-provenance.json` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/rawfile/font/InterVariable.ttf` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/rawfile/font/NotoSerifCJK-spdx-manifest.json` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/rawfile/font/NotoSerifCJKsc-Regular.otf` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/rawfile/sample.epub` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |
| `entry/src/main/resources/rawfile/sample.txt` | ✓ | added | ✓ | Figma 节点 ID（via Reader-UI 生成契约） | 待定 | Figma 视觉资源（via Reader-UI admission） |

## test（57 个文件）

| 文件 | PR#4 | 状态 | 可达 | 权威来源 | 处置 | 依据 |
|------|------|------|------|---------|------|------|
| `entry/src/main/ets/host/tests/HostSmoke.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/ohosTest/ets/pages/Index.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/ohosTest/ets/test/List.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/ohosTest/ets/testability/TestAbility.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/ohosTest/ets/testability/pages/Index.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/ohosTest/ets/testrunner/OpenHarmonyTestRunner.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/ohosTest/module.json5` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/ohosTest/resources/base/element/string.json` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/ohosTest/resources/base/media/test_icon.svg` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/ohosTest/resources/base/profile/test_pages.json` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/AppearanceSpec.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/BookDetailViewState.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/BookshelfViewState.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/CapabilityClosureRouteRegistry.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/Contract25RouteRegistry.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/CoreSlice10Service.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/DestructiveFlow.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/EntryAbilityReadingChainSelfCheck.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/List.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/LocalBookFormatPolicy.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/LocalBookImportBatchCoordinator.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/MotionRegistryExact.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/MotionResolver.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderBookOpenDomainMapper.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderBookOpenPilotExecutor.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderContinueRecovery.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderControlCandidateAdapter.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderEffects.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderImportPilotExecutor.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderOverlayDispatch.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderOverlayViewState.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderPlaybackPilotExecutor.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderReplaceRulePilotExecutor.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderRssPilotExecutor.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderSlice10LivePayloadResolver.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderSourceSwitchPilotExecutor.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderSyncPilotExecutor.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderUIDirectoryPilot.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderUIRuntimePilot.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderUIRuntimeShadow.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderUi25HostDispatcher.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ReaderUi25WebDavHostAdapter.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/RouteDispatch.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ScreenGraphButtonAdapter.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ScreenGraphContentAdapter.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ScreenGraphCoverage.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ScreenGraphDialogAdapter.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ScreenGraphEmptyAdapter.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ScreenGraphShadowRegistry.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ScreenGraphStatePrimitiveAdapter.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ScreenGraphTapZoneAdapter.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ScreenGraphTerminalStateAdapter.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/SettingsViewState.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/ShellSlot.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/SourceDebugTranscriptRecorder.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/SourceSwitchViewState.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |
| `entry/src/test/TokenCoverage.test.ets` | ✓ | added | ✗ | Reader-UI / Core 协议 | 待定 | Hypium 单元测试（按 Reader-UI / Core 协议比对） |

## planning-doc（9 个文件）

| 文件 | PR#4 | 状态 | 可达 | 权威来源 | 处置 | 依据 |
|------|------|------|------|---------|------|------|
| `docs/PLANNING/DEVICE_READY_CHECKLIST.md` | ✓ | added | — | PR #4 | 待定 | PR #4 引入的规划文档 |
| `docs/PLANNING/LAYER4_UNFROZEN_BINDINGS.md` | ✓ | added | — | PR #4 | 待定 | PR #4 引入的规划文档 |
| `docs/PLANNING/LAYER5_FUNCTIONAL_BUGS.md` | ✓ | added | — | PR #4 | 待定 | PR #4 引入的规划文档 |
| `docs/PLANNING/REPAIR_ROADMAP.md` | ✓ | added | — | PR #4 | 待定 | PR #4 引入的规划文档 |
| `docs/PLANNING/device-evidence-af2137d.json` | ✓ | added | — | PR #4 | 待定 | PR #4 引入的规划文档 |
| `docs/PLANNING/device-evidence.json` | ✓ | added | — | PR #4 | 待定 | PR #4 引入的规划文档 |
| `docs/PLANNING/device-hilog-emulator-raw.txt` | ✓ | added | — | PR #4 | 待定 | PR #4 引入的规划文档 |
| `docs/PLANNING/device-hilog-raw.txt` | ✓ | added | — | PR #4 | 待定 | PR #4 引入的规划文档 |
| `docs/superpowers/plans/2026-07-07-host-integration.md` | ✓ | added | — | PR #4 | 待定 | PR #4 引入的规划文档 |

## config（15 个文件）

| 文件 | PR#4 | 状态 | 可达 | 权威来源 | 处置 | 依据 |
|------|------|------|------|---------|------|------|
| `.gitignore` | M | modified | — | PR #4 | 待定 | 构建/包/模块配置（PR #4 修改或新增） |
| `AppScope/app.json5` | M | modified | — | PR #4 | 待定 | 构建/包/模块配置（PR #4 修改或新增） |
| `build-profile.json5` | M | modified | — | PR #4 | 待定 | 构建/包/模块配置（PR #4 修改或新增） |
| `entry/build-profile.json5` | M | modified | — | PR #4 | 待定 | 构建/包/模块配置（PR #4 修改或新增） |
| `entry/hvigorfile.ts` |  | preexisting | — | PR #4（modified） | 待定 | 构建/包/模块配置（PR #4 修改或新增） |
| `entry/oh-package-lock.json5` | ✓ | added | — | PR #4 | 待定 | 构建/包/模块配置（PR #4 修改或新增） |
| `entry/oh-package.json5` | M | modified | — | PR #4 | 待定 | 构建/包/模块配置（PR #4 修改或新增） |
| `entry/src/main/module.json5` | M | modified | — | PR #4 | 待定 | 构建/包/模块配置（PR #4 修改或新增） |
| `entry/src/main/resources/base/profile/main_pages.json` | M | modified | ✓ | PR #4 | 待定 | 构建/包/模块配置（PR #4 修改或新增） |
| `hvigor/hvigor-config.json5` |  | preexisting | — | PR #4（modified） | 待定 | 构建/包/模块配置（PR #4 修改或新增） |
| `hvigorfile.ts` |  | preexisting | — | PR #4（modified） | 待定 | 构建/包/模块配置（PR #4 修改或新增） |
| `hvigorw` |  | preexisting | — | PR #4（modified） | 待定 | 构建/包/模块配置（PR #4 修改或新增） |
| `oh-package-lock.json5` | ✓ | added | — | PR #4 | 待定 | 构建/包/模块配置（PR #4 修改或新增） |
| `oh-package.json5` |  | preexisting | — | PR #4（modified） | 待定 | 构建/包/模块配置（PR #4 修改或新增） |
| `package.json` | M | modified | — | PR #4 | 待定 | 构建/包/模块配置（PR #4 修改或新增） |

## other（4 个文件）

| 文件 | PR#4 | 状态 | 可达 | 权威来源 | 处置 | 依据 |
|------|------|------|------|---------|------|------|
| `.claude/commands/harmonyos-loop.md` | M | modified | — | PR #4 | 待定 | 项目规则/命令文件 |
| `AGENTS.md` | M | modified | — | PR #4 | 待定 | 项目规则/命令文件 |
| `CLAUDE.md` | M | modified | — | PR #4 | 待定 | 项目规则/命令文件 |
| `README.md` | M | modified | — | PR #4 | 待定 | 项目规则/命令文件 |

## 已知问题

1. PR #4 是一次 squash-merge，单次引入 534 个新增文件 + 17 个修改文件，影响面极大。建议 A2 阶段按子系统（gate / contract / bridge / host / ui / resources）拆分处置。
2. archive 类别在当前 main 为空（PR #4 删除了 _archived_planning_2026-06-24/ 下的 ~150 个历史归档文件）。
3. RouteRenderer 执行门依赖 contract/reader_ui/VisualAdmission.ets（由 Reader-UI 生成），Gate G2 要求 upstream==consumer SHA-256 一致。若 Reader-UI 侧未完成 source-side conversion，candidate-backport 路由会 fail-closed。
4. RouteTable.ALL 列出 ~270 个 RouteId，但 RouteRenderer 仅渲染 isRouteAdmittedForViewport==true 的路由。当前 rollout 7 Pilot / 28 Shadow / 0 Authoritative（per AGENTS.md），大部分路由在运行时为 inert 空柱。
5. scripts/ 下全部 29 个文件归类为 gate（含 .test.mjs 契约测试、enforce-*.mjs 执行门、gen_contracts.mjs 生成器、check_*.mjs 检查器、signing 相关）。若 A2 需要区分"执行门"与"契约测试"，可进一步拆分子类。
6. entry/libs/arm64-v8a/libreader_core_napi.so 与 libc++_shared.so 作为二进制 blob 入库。PROVENANCE.md 标注来源，但二进制无源码可审计，需在 A2 确认其与 Reader-Core-Native 当前 ABI 版本一致。
7. AGENTS.md / CLAUDE.md / README.md / .claude/commands/harmonyos-loop.md 归类为 other（项目规则与命令文件），非 gate、非代码、非资源。
8. entry/src/main/resources/base/profile/main_pages.json 仅注册单一 @Entry 页面 pages/Index；所有路由通过 RouteRenderer 在 ArkTS 内部分发，不使用 ArkUI Router/Navigation 多页面栈。

## 处置说明

本审计仅做分类与标注，**所有文件处置标记为"待定"**，留待 A2 阶段决定保留/修改/删除/归档。

---

*生成时间：2026-07-27T06:07:34.694Z · main commit：`192ab79c17480cbf82723a177698f9ac6b80fbd7` · PR #4：`192ab79c17480cbf82723a177698f9ac6b80fbd7`*