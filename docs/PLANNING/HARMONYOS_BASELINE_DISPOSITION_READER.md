# HarmonyOS 基线处置报告 · A2 · 阅读页（reader.reading-surface）

> 本报告由 A2 阶段只读审计 agent 产出。未修改任何代码文件、git 状态、registry、LOCAL_READY_FOR_FIGMA.json、local.status 或 harmony.status。
> 产出时间（UTC）: 2026-07-27T13:30:00Z
> 作用域: 路由族 `reader.reading-surface`（routeIds: `immersive-reading`、`reader`、`reader_content`）
> 前置: A0 快照 `HARMONYOS_BASELINE_SNAPSHOT_POST_PR4.json`、A1 审计 `HARMONYOS_BASELINE_AUDIT_POST_PR4.md`
> 仓库: HarmonyOS `/Users/minliny/Documents/Reader/Reader-for-HarmonyOS`（处置对象）；Reader-UI `/Users/minliny/Documents/Reader/Reader-UI`（只读契约比对）

---

## 1. 执行摘要

### 1.1 闭包规模

| 类别 | 文件数 | 路由可达 | 备注 |
|------|--------|---------|------|
| Shell & Slots（直接入口） | 3 | ✓ | ReaderShell + 2 个共享 slot |
| 阅读页专属组件（page-ui） | 4 | ✓ | ReaderComponents / ReaderOverlayComponents / ReaderSelectionToolbar / InteractionDebugComponents（共享） |
| 阅读页专属 tokens | 3 | ✓ | ReaderThemeResolver / ReaderThemeState / ReaderTypography |
| 阅读页专属 motion | 3 | ✓ | ReaderMotionResolver / ReaderControlMotionCoordinator / ReaderDirectoryToTtsMotionCoordinator |
| 阅读页专属 router/ScreenGraph | 1 | ✓ | ReaderUIScreenGraphTapZoneAdapter（其余 ScreenGraph 适配器为共享） |
| 阅读页专属 store/pilot | 6 | ✓ | ReaderBookOpenPilot(+Projection+DomainMapper) / ReaderPlaybackPilot(+Projection+DomainMapper) / ReaderDirectoryPilotProjection / ReaderControlCandidateAdapter |
| 共享 page-ui（被 ViewStateRenderer 引入） | ~15 | ✓ | SharedComponents / BookshelfComponents / StructuralPageComponents 等 |
| 共享 store | ~10 | ✓ | ReaderUiStore / ReaderUiState / ReaderReducer / ReaderEffects / ReaderUIRuntimeShadowCoordinator 等 |
| 共享 adapters | 5 | ✓ | SafeAreaAdapter / ViewportAdapter / MotionAdapter / TokenAdapter / InteractionDebugAdapter |
| 共享 motion | 2 | ✓ | MotionSpecRegistry / MotionSerialMetadataRegistry |
| 共享 router/ScreenGraph | ~11 | ✓ | RouteRenderer / ReaderUIScreenGraphShadowRegistry / ReaderCapabilityClosureRouteRegistry 等 |
| arkts-contract（generated + reader_ui） | 21 | ✓ | VisualAdmission / ColorTokens / RouteTable / ViewStateTable 等 |
| core-host-bridge | 45 | ✓ | CoreRuntime / HostDispatcher / 各 HostAdapter |
| 阅读页专属视觉资源 | ~35 | ✓ | figma_reader_* / reader_control_* SVG/PNG |
| 共享视觉资源 | ~10 | ✓ | ui_icon_chevron_dark / 字体等 |
| entry/bootstrap | 4 | ✓ | EntryAbility / pages/Index / main_pages.json / DemoUiState |
| gate/test（非路由可达） | 89 | ✗ | CI 执行门 + Hypium 测试 |
| **闭包内合计（路由可达）** | **~178** | **✓** | — |

### 1.2 处置汇总

| 处置 | 文件数（路由可达） | 说明 |
|------|------------------|------|
| 保留 | ~140 | 对齐 Reader-UI/Core 协议（contract/host/bridge/shared infra）或为共享基础设施 |
| 隔离 | ~23 | 阅读页专属 page-ui/tokens/motion/router/store，当前依赖 width(0) fail-closed，须改为显式路由摘除 |
| 删除 | 0 | 闭包内未发现与 Figma 冲突或 bypass 产物 |
| 待定 | ~15 | 阅读页专属视觉资源，须待 Reader-UI 源端重建后逐个比对 Figma |

### 1.3 关键发现

1. **reader.reading-surface 路由族当前不可渲染**：`VisualAdmission.ets` 将 `immersive-reading`、`reader`、`reader_content` 三路由标记为 `candidate-backport`（sourceBound=true, implementationReady=false）。`RouteRenderer.isDisplayedRouteImplementationReady()` 对这三路由返回 false，shell 渲染为空柱。
2. **全 registry 无 implementation-ready 路由**：grep `admission: 'implementation-ready'` 在 `VisualAdmission.ets` 中 0 条实际条目命中（仅在类型定义与注释中出现）。当前 HarmonyOS 全 app 所有路由均 fail-closed，不限于阅读页。
3. **当前"隔离"机制违反硬约束**：`OverlayHost.ets` 与 `StateHost.ets` 使用 `Column().width(0).height(0)` 作为 fail-closed 实现（第 47、56、32 行），这正是硬约束禁止的"width(0) 隔离"。须改为显式路由摘除。
4. **harmony.targets 绑定 ReaderComponents.ets#ReaderBase**：registry 将阅读页 HarmonyOS 目标绑定为 `Reader-for-HarmonyOS/entry/src/main/ets/ui/components/ReaderComponents.ets#ReaderBase`，该文件不可删除，否则破坏 registry 绑定。
5. **源端重建未在 main 闭合**：Reader-UI 侧 `READER_READING_SURFACE_LINEAGE_CORRECTION.md` 确认旧证据包 `LOCAL_READY_FOR_FIGMA.json` 的 `implementationCommit`（`06fc096...`）位于 `codex/motion-demo-optimizations` 分支，**不是当前 Reader-UI main（`88069f6...`）的祖先**，源端转换证据包未在 main 闭合。
6. **Figma 冻结 pending-token**：`READER_READING_SURFACE_FIGMA_FREEZE.json` 的 `freezeDecision: "pending-token"`，REST 复核因 `NO_FIGMA_TOKEN` 阻塞，但 MCP 实时只读已确认 master（1023:18354）/ Phone（1023:18355）/ Tablet（1023:18371）三节点存在、可见、类型与尺寸与登记一致。

---

## 2. 闭包识别方法

### 2.1 起点路由

- 路由族: `reader.reading-surface`
- routeIds: `immersive-reading`、`reader`、`reader_content`
- 来源: `Reader-UI/docs/design/FIGMA_VISUAL_ADMISSION_REGISTRY.json` 记录 `id: "reader.reading-surface"`
- Shell 映射: `contract/generated/RouteTable.ets` → `ReaderShell`
- 渲染门: `contract/reader_ui/VisualAdmission.ets` → `ReaderUiVisualAdmission.isRouteAdmittedForViewport(routeId, viewport)` 仅 `implementation-ready` 通过

### 2.2 追踪路径

```
main_pages.json (单一 @Entry: pages/Index)
  └─ EntryAbility.ets → 加载 pages/Index
      └─ Index.ets → RouteRenderer
          └─ RouteRenderer.ets → RouteTable.shellOf(routeId)
              └─ ReaderShell.ets (reader.reading-surface 对应 shell)
                  ├─ ViewStateRenderer.ets (content slot, layoutMode='stack')
                  │   ├─ ReaderComponents.ets (ReadingBackgroundLayer/ReadingTextFlow/ReadingInfoLayer/TapZones/ReaderBase/ReaderTopArea)
                  │   │   ├─ ReaderSelectionToolbar.ets
                  │   │   ├─ ReaderUIScreenGraphTapZoneAdapter.ets
                  │   │   ├─ InteractionDebugComponents.ets
                  │   │   ├─ ReaderTypography.ets / ReaderThemeResolver.ets
                  │   │   ├─ adapters: SafeAreaAdapter/ViewportAdapter/InteractionDebugAdapter/TokenAdapter/MotionAdapter
                  │   │   ├─ store: ReaderUiStore/ReaderUiState
                  │   │   ├─ contract: ColorTokens/DimensionTokens/TypeTokens/ViewStateTable/VisualAdmission/Appearance
                  │   │   └─ 资源: figma_reader_paper_tile/figma_reader_immersive_*/reader_control_top_*/figma_reader_session_*
                  │   ├─ ReaderOverlayComponents.ets (ReaderControlSheet/ReaderBottomBar/ReaderDirectoryPanel/ReaderAppearancePanel/ReaderTtsPanel/ReaderSettingsPanel/ReaderFullDirectoryPage/ReaderFullTtsPage/ReaderFullAppearancePage/ReaderFullSettingsPage/ReaderBookCachePage/ReaderDebugInfoPage/ReaderSearchPanel/ReaderReplacePanel/ReaderAutoScrollPanel/NightToast)
                  │   │   ├─ ReaderSlice10LivePayloadResolver.ets
                  │   │   ├─ ReaderThemeResolver.ets / MotionAdapter.ets
                  │   │   ├─ contract: ColorTokens/DemoAliasTokens/DimensionTokens/RouteTable/Appearance/VisualAdmission
                  │   │   └─ 资源: reader_control_*/figma_reader_directory_*/figma_reader_full_*/figma_reader_replace_close/ui_icon_*
                  │   └─ 共享组件（SharedComponents/BookshelfComponents/BookDetailComponents/StructuralPageComponents/...）作为 ViewStateTable body 渲染候选
                  ├─ OverlayHost.ets (overlayHost slot)
                  │   └─ 使用 width(0).height(0) 作为未授权 overlay 的 fail-closed（违反硬约束）
                  └─ StateHost.ets (stateHost slot)
                      └─ 使用 width(0).height(0) 作为未授权 state 的 fail-closed（违反硬约束）
```

### 2.3 阅读页专属路由清单（VisualAdmission.ets 标注）

| routeId | admission | sourceBound | implementationReady | recordIds |
|---------|-----------|-------------|---------------------|-----------|
| immersive-reading | candidate-backport | true | false | reader.reading-surface |
| reader | candidate-backport | true | false | reader.reading-surface |
| reader_content | candidate-backport | true | false | reader.reading-surface |
| reader-appearance | candidate-backport | true | false | reader.module.appearance |
| reader-settings | candidate-backport | true | false | reader.module.settings |
| toc-bookmarks | candidate-backport | true | false | reader.module.directory |
| tts | candidate-backport | true | false | reader.module.tts |
| content-search | candidate-backport | true | false | reader.quick.content-search |
| control-layer-base-v2 | candidate-backport | true | false | reader.control-home |
| reader-appearance-overlay-v2 | candidate-backport | true | false | reader.control-home |
| reader-auto-scroll-overlay-v2 | candidate-backport | true | false | reader.control-home |
| reader-directory-overlay-v2 | candidate-backport | true | false | reader.control-home |
| reader-replace-overlay-v2 | candidate-backport | true | false | reader.control-home |
| reader-search-overlay-v2 | candidate-backport | true | false | reader.control-home |
| reader-settings-overlay-v2 | candidate-backport | true | false | reader.control-home |
| reader-tts-overlay-v2 | candidate-backport | true | false | reader.control-home |

**以上 16 路由全部为 candidate-backport，implementation-ready=false。** 路由可达但运行时 fail-closed。

---

## 3. 处置结论

### 3.1 保留（Retain）— 对齐 Reader-UI/Core 协议，有明确证据

#### 3.1.1 arkts-contract（21 个文件，全部保留）

| 文件 | 保留依据 |
|------|---------|
| `entry/src/main/ets/contract/generated/ColorTokens.ets` | Reader-UI gen_contracts.mjs 产物，Gate G2 校验 upstream==consumer SHA-256 |
| `entry/src/main/ets/contract/generated/DemoAliasTokens.ets` | 同上 |
| `entry/src/main/ets/contract/generated/DimensionTokens.ets` | 同上 |
| `entry/src/main/ets/contract/generated/HostRequestTable.ets` | 同上 |
| `entry/src/main/ets/contract/generated/MotionPolicyTable.ets` | 同上 |
| `entry/src/main/ets/contract/generated/MotionSpecTable.ets` | 同上 |
| `entry/src/main/ets/contract/generated/MotionTokens.ets` | 同上 |
| `entry/src/main/ets/contract/generated/RouteTable.ets` | 同上（reader.reading-surface 三路由在此登记） |
| `entry/src/main/ets/contract/generated/ShadowTokens.ets` | 同上 |
| `entry/src/main/ets/contract/generated/TextConstraintTokens.ets` | 同上 |
| `entry/src/main/ets/contract/generated/TokenRegistry.ets` | 同上 |
| `entry/src/main/ets/contract/generated/TypeTokens.ets` | 同上 |
| `entry/src/main/ets/contract/generated/ViewStateTable.ets` | 同上 |
| `entry/src/main/ets/contract/reader_ui/Appearance.ets` | Reader-UI 生成契约 |
| `entry/src/main/ets/contract/reader_ui/ReaderUiVisualTokenAdapter.ets` | Reader-UI 生成契约 |
| `entry/src/main/ets/contract/reader_ui/Route.ets` | Reader-UI 生成契约 |
| `entry/src/main/ets/contract/reader_ui/ScreenGraph.ets` | Reader-UI 生成契约 |
| `entry/src/main/ets/contract/reader_ui/UiEvent.ets` | Reader-UI 生成契约 |
| `entry/src/main/ets/contract/reader_ui/UiState.ets` | Reader-UI 生成契约 |
| `entry/src/main/ets/contract/reader_ui/ViewState.ets` | Reader-UI 生成契约 |
| `entry/src/main/ets/contract/reader_ui/VisualAdmission.ets` | Reader-UI 生成契约（fail-closed 执行门权威） |

#### 3.1.2 core-host-bridge（45 个文件，全部保留）

完整清单见 A1 审计报告。保留依据：Reader-UI 契约 + Reader-Core-Native C ABI 协议。包括 `CoreRuntime.ets`、`bridge/core/*`、`host/*`（含 `HostDispatcher`、`ReaderUiHostDispatcher`、所有 `host/adapters/*`）、`libreader_core_napi.d.ts`、`entry/libs/arm64-v8a/*`。

#### 3.1.3 共享基础设施（保留）

| 文件 | 保留依据 |
|------|---------|
| `entry/src/main/ets/entryability/EntryAbility.ets` | 应用入口，初始化 ReaderUiStore/CoreRuntime/Host 适配器 |
| `entry/src/main/ets/pages/Index.ets` | 单一 @Entry 页面，加载 RouteRenderer |
| `entry/src/main/ets/ui/router/RouteRenderer.ets` | 路由分发器，fail-closed 执行门所在地 |
| `entry/src/main/ets/ui/components/ViewStateRenderer.ets` | 共享 body 渲染器，按 ViewStateTable 渲染 |
| `entry/src/main/ets/ui/components/SharedComponents.ets` | 共享组件（AppTopBar/BackTopBar/BottomNav/...） |
| `entry/src/main/ets/ui/components/BookshelfComponents.ets` | 被 ViewStateRenderer 引入（共享） |
| `entry/src/main/ets/ui/components/BookDetailComponents.ets` | 同上 |
| `entry/src/main/ets/ui/components/ContractComponents.ets` | 同上 |
| `entry/src/main/ets/ui/components/Contract25RouteComponents.ets` | 同上 |
| `entry/src/main/ets/ui/components/DiscoverComponents.ets` | 同上 |
| `entry/src/main/ets/ui/components/LibraryComponents.ets` | 同上 |
| `entry/src/main/ets/ui/components/RssComponents.ets` | 同上 |
| `entry/src/main/ets/ui/components/SettingsComponents.ets` | 同上 |
| `entry/src/main/ets/ui/components/Slice12LifecycleComponents.ets` | 同上 |
| `entry/src/main/ets/ui/components/SourceCoverImage.ets` | 同上 |
| `entry/src/main/ets/ui/components/SourceSwitchFlowComponents.ets` | 同上 |
| `entry/src/main/ets/ui/components/StructuralPageComponents.ets` | 同上 |
| `entry/src/main/ets/ui/components/W1ImportFlowComponents.ets` | 同上 |
| `entry/src/main/ets/ui/components/W2ReaderStateComponents.ets` | 同上 |
| `entry/src/main/ets/ui/components/W5ReplaceRuleComponents.ets` | 同上 |
| `entry/src/main/ets/ui/components/InteractionDebugComponents.ets` | 调试框架组件（共享，被 ReaderComponents 引入） |
| `entry/src/main/ets/ui/adapters/SafeAreaAdapter.ets` | 共享 runtime 适配器 |
| `entry/src/main/ets/ui/adapters/ViewportAdapter.ets` | 共享 viewport 适配器 |
| `entry/src/main/ets/ui/adapters/MotionAdapter.ets` | 共享 motion 适配器（唯一 animateTo 入口） |
| `entry/src/main/ets/ui/adapters/TokenAdapter.ets` | 共享 token 适配器 |
| `entry/src/main/ets/ui/adapters/InteractionDebugAdapter.ets` | 共享调试适配器 |
| `entry/src/main/ets/ui/store/ReaderUiStore.ets` | 共享 UI store（AppStorage bridge） |
| `entry/src/main/ets/ui/store/ReaderUiState.ets` | 共享 UI state 类型定义 |
| `entry/src/main/ets/ui/store/ReaderReducer.ets` | 共享 reducer |
| `entry/src/main/ets/ui/store/ReaderEffects.ets` | 共享 effects |
| `entry/src/main/ets/ui/store/ReaderUIRuntimeShadowCoordinator.ets` | 共享 runtime shadow 协调器 |
| `entry/src/main/ets/ui/store/ReaderSlice10LivePayloadResolver.ets` | 共享 live payload 解析器 |
| `entry/src/main/ets/ui/store/BookSourceRegistry.ets` | 共享书源注册表 |
| `entry/src/main/ets/ui/store/CoreSlice10Service.ets` | 共享 core slice10 服务 |
| `entry/src/main/ets/ui/store/Slice10CapabilityPolicy.ets` / `Slice11CapabilityPolicy.ets` / `Slice12CapabilityPolicy.ets` | 共享能力策略 |
| `entry/src/main/ets/ui/store/ReaderControlCandidateAdapter.ets` | 共享 control 候选适配器 |
| `entry/src/main/ets/ui/store/ReaderImportPilotExecutor.ets` / `ReaderReplaceRulePilotExecutor.ets` / `ReaderRssPilotExecutor.ets` / `ReaderSourceSwitchPilotExecutor.ets` / `ReaderSyncPilotExecutor.ets` | 共享 pilot 执行器 |
| `entry/src/main/ets/ui/store/LocalBookImportBatchCoordinator.ets` / `CoreStorageBackupHistory.ets` | 共享服务 |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphShadowRegistry.ets` | 共享 ScreenGraph shadow 注册表 |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphButtonAdapter.ets` | 共享 ScreenGraph 按钮适配器 |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphContentAdapter.ets` | 共享 ScreenGraph 内容适配器 |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphDialogAdapter.ets` | 共享 ScreenGraph 对话框适配器 |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphEmptyAdapter.ets` | 共享 ScreenGraph 空态适配器 |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphStatePrimitiveAdapter.ets` | 共享 ScreenGraph 状态原语适配器 |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphTerminalStateAdapter.ets` | 共享 ScreenGraph 终态适配器 |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphCoverage.ets` | 共享 ScreenGraph 覆盖率 |
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphRetirementRegistry.ets` | 共享 ScreenGraph 退役注册表 |
| `entry/src/main/ets/ui/router/ReaderCapabilityClosureRouteRegistry.ets` | 共享能力闭包路由注册表 |
| `entry/src/main/ets/ui/router/ReaderContract25RouteRegistry.ets` | 共享 Contract25 路由注册表 |
| `entry/src/main/ets/ui/motion/MotionSpecRegistry.ets` | 共享 motion spec 注册表 |
| `entry/src/main/ets/ui/motion/MotionSerialMetadataRegistry.ets` | 共享 motion 序列元数据注册表 |
| `entry/src/main/ets/ui/motion/RestoreBackupOverlayMotionCoordinator.ets` | 共享恢复备份 motion 协调器 |
| `entry/src/main/ets/ui/fixtures/DemoUiState.ets` / `DemoViewState.ets` | 共享 fixture |
| `entry/src/main/ets/ui/shells/MainTabShell.ets` / `LibraryShell.ets` / `SettingsShell.ets` / `FlowShell.ets` | 共享 shells（RouteTable 多 shell 映射） |
| `entry/src/main/resources/base/profile/main_pages.json` | 单一 @Entry 页面配置 |
| `entry/src/main/resources/base/element/color.json` / `float.json` / `string.json` | 共享资源元素 |
| `entry/src/main/resources/dark/element/color.json` | 共享暗色资源 |
| `entry/src/main/resources/rawfile/font/InterVariable.ttf` / `InterVariable-provenance.json` / `Inter-OFL.txt` | 共享 UI 字体 |
| `entry/src/main/resources/rawfile/sample.epub` / `sample.txt` | 共享示例文件 |

#### 3.1.4 gate / test / planning-doc / config / other（非路由可达，保留）

完整清单见 A1 审计报告。gate（32）、test（57）、planning-doc（9）、config（15）、other（4）全部保留，不参与阅读页路由可达闭包。

---

### 3.2 隔离（Isolate）— 阅读页专属，须显式路由摘除

> **硬约束提醒**：当前 `OverlayHost.ets` 第 47/56 行与 `StateHost.ets` 第 32 行使用 `Column().width(0).height(0)` 作为 fail-closed 实现，这是硬约束禁止的"width(0) 隔离"。下列文件的隔离必须是**显式路由摘除**或**代码删除**，不得依赖 width(0)/隐藏节点/并行 Figma*Root 层。

#### 3.2.1 阅读页专属 Shell & 直接依赖

| 文件 | 当前状态 | 隔离方式 | 替换时机 |
|------|---------|---------|---------|
| `entry/src/main/ets/ui/shells/ReaderShell.ets` | 渲染空柱（fail-closed） | **路由摘除**：在 Reader-UI 源端 `contracts/route.schema.json` 中将 `immersive-reading`/`reader`/`reader_content` 三路由移至 `retired` 或从 enum 摘除，重新生成 `RouteTable.ets`，使 `RouteTable.shellOf()` 对这三路由返回 null，`RouteRenderer` 不再解析到 `ReaderShell`。ReaderShell.ets 文件本身可保留作为待重建骨架。 | Reader-UI 源端阅读页重建完成后，重新登记路由并绑定到新 shell |

#### 3.2.2 阅读页专属 page-ui 组件（registry harmony.targets 绑定）

| 文件 | registry 绑定 | 隔离方式 | 替换时机 |
|------|--------------|---------|---------|
| `entry/src/main/ets/ui/components/ReaderComponents.ets` | `reader.reading-surface` → `ReaderComponents.ets#ReaderBase` | **路由摘除 + 绑定冻结**：(1) 上述路由摘除后，ViewStateTable 不再为这三路由生成 body 组件绑定；(2) 在 Reader-UI `FIGMA_VISUAL_ADMISSION_REGISTRY.json` 中将 `reader.reading-surface` 的 `harmony.targets` 标注为 `pending-reconstruction`（不可删除，破坏 registry 绑定）。文件保留作为重建参考。 | Reader-UI 源端转换闭合后，由源端生成新 ReaderComponents 实现，再更新 harmony.targets |
| `entry/src/main/ets/ui/components/ReaderOverlayComponents.ets` | 隐式（reader.*-overlay-v2 路由的 body） | **路由摘除**：将 7 个 `reader-*-overlay-v2` 路由与 `control-layer-base-v2` 在源端 schema 中移至 `retired`，重新生成 `RouteTable.ets` 与 `ViewStateTable.ets`。文件保留作为重建参考。 | 同上 |
| `entry/src/main/ets/ui/components/ReaderSelectionToolbar.ets` | 无直接 registry 绑定，由 `ReadingTextFlow` 通过 `bindSelectionMenu` 调用 | **代码隔离**：随 `ReaderComponents.ets` 一并隔离（路由摘除后 ReadingTextFlow 不再渲染，本组件自然不可达）。文件保留。 | 随 ReaderComponents 重建一并更新 |

#### 3.2.3 阅读页专属 tokens

| 文件 | 隔离方式 | 替换时机 |
|------|---------|---------|
| `entry/src/main/ets/ui/tokens/ReaderThemeResolver.ets` | 随 ReaderComponents 隔离（仅 ReaderComponents/ReaderOverlayComponents 引用）。文件保留。 | 源端重建后由 Reader-UI token 生成器对齐 |
| `entry/src/main/ets/ui/tokens/ReaderThemeState.ets` | 同上 | 同上 |
| `entry/src/main/ets/ui/tokens/ReaderTypography.ets` | 同上（也被 TokenAdapter 引用，但 TokenAdapter 为共享，reader 路由摘除后 TokenAdapter 仍服务其他路由） | 同上 |

#### 3.2.4 阅读页专属 motion

| 文件 | 隔离方式 | 替换时机 |
|------|---------|---------|
| `entry/src/main/ets/ui/motion/ReaderMotionResolver.ets` | 随 ReaderComponents/ReaderOverlayComponents 隔离（仅阅读页组件引用）。文件保留。 | 源端重建后由 MotionSpecTable 生成器对齐 |
| `entry/src/main/ets/ui/motion/ReaderControlMotionCoordinator.ets` | 同上 | 同上 |
| `entry/src/main/ets/ui/motion/ReaderDirectoryToTtsMotionCoordinator.ets` | 同上 | 同上 |

#### 3.2.5 阅读页专属 router/ScreenGraph

| 文件 | 隔离方式 | 替换时机 |
|------|---------|---------|
| `entry/src/main/ets/ui/router/ReaderUIScreenGraphTapZoneAdapter.ets` | 随 ReaderComponents 隔离（仅 `ReaderComponents.ets#TapZones` 引用）。文件保留。 | 源端重建后由 ScreenGraph 生成器对齐 |

#### 3.2.6 阅读页专属 store/pilot

| 文件 | 隔离方式 | 替换时机 |
|------|---------|---------|
| `entry/src/main/ets/ui/store/ReaderBookOpenPilot.ets` | 随 reader 路由摘除隔离（pilot 由 ReaderUiStore 在 reader 路由 dispatch 时调用）。文件保留。 | 源端重建后由 Reader-UI pilot 生成器对齐 |
| `entry/src/main/ets/ui/store/ReaderBookOpenPilotProjection.ets` | 同上 | 同上 |
| `entry/src/main/ets/ui/store/ReaderBookOpenDomainMapper.ets` | 同上 | 同上 |
| `entry/src/main/ets/ui/store/ReaderPlaybackPilot.ets` | 同上（TTS pilot） | 同上 |
| `entry/src/main/ets/ui/store/ReaderPlaybackPilotProjection.ets` | 同上 | 同上 |
| `entry/src/main/ets/ui/store/ReaderPlaybackDomainMapper.ets` | 同上 | 同上 |
| `entry/src/main/ets/ui/store/ReaderDirectoryPilotProjection.ets` | 同上 | 同上 |

**隔离方式统一说明**：上述 23 个文件的隔离**不是**在 HarmonyOS 侧删除代码或修改 width(0)，而是**在 Reader-UI 源端 route schema 中摘除阅读页路由**，使 `RouteTable.ets` 与 `ViewStateTable.ets` 重新生成后不再包含 `immersive-reading`/`reader`/`reader_content` 等路由的 shell 映射与 body 组件绑定。路由摘除后，这些文件变为不可达的死代码（保留待重建），符合"隔离=暂时保留代码但从路由摘除"的定义。

---

### 3.3 删除（Delete）— 与 Figma 冲突或 bypass 产物

**闭包内未发现需要删除的文件。**

理由：
1. 阅读页专属文件均为 registry 登记的 `harmony.targets` 绑定目标，不是 bypass 产物。
2. 无并行 Figma*Root / FigmaVisual*AdmissionPolicy / 本地近似层（符合硬约束"HarmonyOS must not create or revive Figma*Root..."）。
3. `OverlayHost.ets` 与 `StateHost.ets` 中的 `width(0).height(0)` 模式是**共享 slot 文件**的 fail-closed 实现，不是阅读页 bypass 产物——但该模式违反硬约束，须在 A3 阶段替换为显式路由摘除（见第 5 节建议）。

---

### 3.4 待定（Pending）— 证据不足，需更多信息

#### 3.4.1 阅读页专属视觉资源（~35 个，须待源端重建后比对 Figma）

下列资源被 `ReaderComponents.ets` 与 `ReaderOverlayComponents.ets` 通过 `$r('app.media.*')` 引用。当前无法判定是否与 Figma master（1023:18354 ReadingSurface 及其子节点）一致，因为：

- **缺失信息 1**：Reader-UI 源端阅读页重建未闭合，无新的 `LOCAL_READY_FOR_FIGMA.json` 证据包。
- **缺失信息 2**：Figma REST 复核因 `NO_FIGMA_TOKEN` 阻塞（`freezeDecision: "pending-token"`），无法获取最新 revision 的节点导出资源。
- **缺失信息 3**：F0 证据 observedAt 为 2026-07-24（3 天前），不满足 `requiresFreshFigmaRevisionRead: true`。

| 资源类别 | 文件列表 | 缺失信息 |
|---------|---------|---------|
| ReadingSurface 纸张纹理 | `figma_reader_paper_tile.png` | 源端重建后比对 Figma master 1023:18354 子节点的 fill image |
| 沉浸式状态栏图标 | `figma_reader_immersive_signal.svg` / `figma_reader_immersive_wifi.svg` / `figma_reader_immersive_battery.svg` | 比对 Figma Reader/Immersive/StatusBar 节点 |
| TTS 会话图标 | `figma_reader_session_tts.svg` / `figma_reader_session_pause.svg` / `figma_reader_session_play.svg` | 比对 Figma Reader/TTS/Session 节点 |
| 全屏页图标 | `figma_reader_full_directory.svg` / `figma_reader_full_tts.svg` / `figma_reader_full_appearance.svg` / `figma_reader_full_settings.svg` | 比对 Figma Reader/Full/* 节点 |
| 目录面板图标 | `figma_reader_directory_bookmark.svg` / `figma_reader_directory_top.svg` / `figma_reader_directory_bottom.svg` / `figma_reader_directory_order.svg` / `figma_reader_directory_search.svg` / `figma_reader_directory_search_active.svg` | 比对 Figma Reader/Directory/* 节点 |
| 替换面板图标 | `figma_reader_replace_close.svg` | 比对 Figma Reader/Replace/* 节点 |
| 顶部栏图标 | `reader_control_top_back.svg` / `reader_control_top_more.svg` / `reader_control_top_source_switch.svg` | 比对 Figma Reader/ControlBar/Top/* 节点 |
| 章节导航图标 | `reader_control_chapter_next.svg` / `reader_control_chapter_prev.svg` | 比对 Figma Reader/ControlBar/ChapterNav/* 节点 |
| 紧凑导航图标 | `reader_control_compact_next.svg` / `reader_control_compact_prev.svg` | 比对 Figma Reader/ControlBar/CompactNav/* 节点 |
| 模块 dock 图标 | `reader_control_module_directory_active.svg` / `reader_control_module_directory_default.svg` / `reader_control_module_appearance_active.svg` / `reader_control_module_appearance_default.svg` / `reader_control_module_tts_active.svg` / `reader_control_module_tts_default.svg` / `reader_control_module_settings_active.svg` / `reader_control_module_settings_default.svg` | 比对 Figma Reader/ControlBar/ModuleDock/* 节点 |
| TTS 控制图标 | `reader_control_play.svg` / `reader_control_tts_playback.svg` / `reader_control_tts_stop.svg` / `reader_control_tts_clock.svg` / `reader_control_tts_caret_down.svg` / `reader_control_tts_speed.svg` | 比对 Figma Reader/TTS/Controls/* 节点 |
| 亮度图标 | `reader_control_brightness_sun.svg` | 比对 Figma Reader/Appearance/Brightness 节点 |
| 快捷动作图标 | `reader_control_quick_auto_page.svg` / `reader_control_quick_replace.svg` / `reader_control_quick_search.svg` | 比对 Figma Reader/ControlBar/QuickActions/* 节点 |
| 阅读页专属字体 | `entry/src/main/resources/rawfile/font/NotoSerifCJKsc-Regular.otf` / `NotoSerifCJK-spdx-manifest.json` | 比对 Figma Reader/ReadingSurface/Typography 节点的 fontFamily 字段 |

**待定处理方式**：在 Reader-UI 源端阅读页重建闭合 + Figma REST 复核完成后，逐个资源比对 Figma master 子节点。若一致则**保留**；若不一致则**删除**并由源端重新导出。

#### 3.4.2 共享视觉资源（被阅读页引用，但也被其他页族引用）

| 文件 | 待定原因 |
|------|---------|
| `entry/src/main/resources/base/media/ui_icon_chevron_dark.svg` | 被 ReaderOverlayComponents 引用，也被其他页族引用。须在各页族 A2 审计全部完成后汇总比对 |
| `entry/src/main/resources/base/media/ui_icon_info_dark.svg` | 同上 |
| `entry/src/main/resources/base/media/ui_icon_check_primary.svg` | 同上 |
| `entry/src/main/resources/base/media/ui_icon_search_primary.svg` | 同上 |

---

## 4. 共享依赖识别

### 4.1 共享依赖清单（被多个页族引用，处置须考虑全局影响）

| 共享依赖 | 引用方 | 处置影响 |
|---------|-------|---------|
| `contract/generated/*`（21 文件） | 全部页族 | **保留**，Gate G2 强制 upstream==consumer |
| `contract/reader_ui/VisualAdmission.ets` | 全部页族（执行门） | **保留**，fail-closed 权威 |
| `host/*` + `bridge/*`（45 文件） | 全部页族 | **保留**，Core/Native 协议 |
| `ui/router/RouteRenderer.ets` | 全部页族 | **保留**，路由分发器 |
| `ui/components/ViewStateRenderer.ets` | 全部页族（body 渲染） | **保留**；但内部对 ReaderComponents/ReaderOverlayComponents 的 import 在阅读页路由摘除后变为死引用，须在源端 ViewStateTable 重新生成时清理 |
| `ui/store/ReaderUiStore.ets` + `ReaderUiState.ets` + `ReaderReducer.ets` | 全部页族 | **保留** |
| `ui/adapters/SafeAreaAdapter.ets` / `ViewportAdapter.ets` / `MotionAdapter.ets` / `TokenAdapter.ets` / `InteractionDebugAdapter.ets` | 全部页族 | **保留** |
| `ui/components/InteractionDebugComponents.ets` | 多页族调试 | **保留** |
| `ui/motion/MotionSpecRegistry.ets` / `MotionSerialMetadataRegistry.ets` | 全部页族 | **保留** |
| `ui/slots/OverlayHost.ets` | 全部 shell（ReaderShell/MainTabShell/LibraryShell/SettingsShell/FlowShell） | **保留**；但 width(0) fail-closed 须在 A3 替换 |
| `ui/slots/StateHost.ets` | 同上 | 同上 |
| `ui/tokens/ReaderTypography.ets` | ReaderComponents + TokenAdapter | **隔离**（随阅读页），但 TokenAdapter 为共享——须确认 TokenAdapter 对 ReaderTypography 的引用在阅读页摘除后是否仍需保留 |
| 共享视觉资源（ui_icon_*） | 多页族 | **待定**，须全局汇总 |

### 4.2 共享依赖替换计划

若共享依赖需要替换（如 `OverlayHost.ets` 的 width(0) 模式），须遵循以下顺序：

1. **源端先行**：Reader-UI 源端完成阅读页重建，生成新 `RouteTable.ets` / `ViewStateTable.ets` / `VisualAdmission.ets`。
2. **HarmonyOS 消费**：更新 HarmonyOS 侧 generated 契约（Gate G2 校验 SHA-256）。
3. **共享 slot 重构**：`OverlayHost.ets` 与 `StateHost.ets` 的 width(0) fail-closed 替换为基于新 `VisualAdmission` 的显式路由摘除逻辑（未在 `VisualAdmission.routeAdmissions` 中登记的路由，`RouteRenderer` 不解析 shell，slot 不渲染）。
4. **回滚保护**：若源端重建未闭合，当前 width(0) fail-closed 作为临时保护保留，但须在 A3 报告中标注为"技术债"。

---

## 5. 建议与后续行动

### 5.1 立即行动（A2 阶段可执行）

1. **本报告作为 A2 产出归档**：不修改任何代码，仅作为 A3 处置执行的输入。
2. **标注 width(0) 违规**：`OverlayHost.ets` 第 47/56 行、`StateHost.ets` 第 32 行的 `Column().width(0).height(0)` 模式违反硬约束"隔离必须是明确的代码删除或路由摘除"，须在 A3 阶段替换。

### 5.2 A3 阶段建议（处置执行）

1. **阅读页路由摘除**：在 Reader-UI 源端 `contracts/route.schema.json` 中将 `immersive-reading`、`reader`、`reader_content` 等 16 个阅读页路由移至 `retired` 或从 enum 摘除，重新生成 `RouteTable.ets` 与 `ViewStateTable.ets`，使 HarmonyOS 侧 `RouteRenderer` 不再解析到 `ReaderShell`。
2. **harmony.targets 冻结**：在 `FIGMA_VISUAL_ADMISSION_REGISTRY.json` 中将 `reader.reading-surface` 等 7 个阅读页 record 的 `harmony.targets` 标注为 `pending-reconstruction`（不删除绑定，保留待重建）。
3. **死代码保留**：23 个阅读页专属文件保留在代码库中，不删除（作为重建参考），但通过路由摘除使其不可达。
4. **视觉资源待定**：35 个阅读页专属视觉资源保留，待源端重建后逐个比对 Figma 决定保留/删除。

### 5.3 源端重建前置条件（Reader-UI 侧）

1. **Figma REST 复核**：提供 `FIGMA_API_TOKEN` 或 `FIGMA_ACCESS_TOKEN`，完成 `READER_READING_SURFACE_FIGMA_FREEZE.json` 的 REST 复核，将 `freezeDecision` 从 `pending-token` 升级为 `frozen` 或 `drift-detected`。
2. **源端转换闭合**：在当前 Reader-UI main（`88069f6...`）上新建源端转换分支，完成阅读页 source-side conversion，生成新 `LOCAL_READY_FOR_FIGMA.json`（`implementationCommit` 指向 main 祖先，`evidenceCommit` 闭环）。
3. **promote-family.mjs 执行**：通过四文件原子事务（registry + LOCAL_READY_FOR_FIGMA + local.status + harmony.status），将 `reader.reading-surface` 的 `harmony.status` 从 `candidate-backport` 提升为 `implementation-ready`。

### 5.4 不建议的行动

1. **不建议删除阅读页专属文件**：这些文件是 registry 登记的 `harmony.targets`，删除会破坏 binding 一致性。
2. **不建议在 HarmonyOS 侧本地修改 VisualAdmission.ets**：该文件由 Reader-UI 生成，Gate G2 强制 upstream==consumer SHA-256，本地修改会导致 CI 失败。
3. **不建议在 HarmonyOS 侧本地新增 Figma*Root / FigmaVisual*AdmissionPolicy / 本地近似层**：违反硬约束"Figma is the only visual authority"。

---

## 6. 处置结论总表

| 处置 | 文件类别 | 文件数 | 关键依据 |
|------|---------|--------|---------|
| **保留** | arkts-contract | 21 | Gate G2 强制 upstream==consumer |
| **保留** | core-host-bridge | 45 | Core/Native C ABI 协议 |
| **保留** | 共享 page-ui / adapters / store / router / motion / entry | ~70 | 多页族共享基础设施 |
| **保留** | gate / test / planning-doc / config / other | 107 | 非路由可达，CI/测试/配置 |
| **隔离** | 阅读页专属 Shell | 1 (ReaderShell) | 路由摘除（源端 schema） |
| **隔离** | 阅读页专属 page-ui | 3 (ReaderComponents/ReaderOverlayComponents/ReaderSelectionToolbar) | 路由摘除 + harmony.targets 冻结 |
| **隔离** | 阅读页专属 tokens | 3 (ReaderThemeResolver/ReaderThemeState/ReaderTypography) | 随阅读页路由摘除 |
| **隔离** | 阅读页专属 motion | 3 (ReaderMotionResolver/ReaderControlMotionCoordinator/ReaderDirectoryToTtsMotionCoordinator) | 同上 |
| **隔离** | 阅读页专属 router | 1 (ReaderUIScreenGraphTapZoneAdapter) | 同上 |
| **隔离** | 阅读页专属 store/pilot | 7 (BookOpen/Playback/Directory Pilot 系列) | 同上 |
| **隔离** | 共享 slot（技术债） | 2 (OverlayHost/StateHost) | width(0) 须在 A3 替换为显式路由摘除 |
| **删除** | — | 0 | 闭包内无 Figma 冲突或 bypass 产物 |
| **待定** | 阅读页专属视觉资源 | ~35 | 须源端重建 + Figma REST 复核后比对 |
| **待定** | 共享视觉资源（被阅读页引用） | 4 | 须全局汇总比对 |

---

*生成时间：2026-07-27T13:30:00Z · A2 阶段只读审计 · 仓库：Reader-for-HarmonyOS @ PR #4 post-merge main（`192ab79c17480cbf82723a177698f9ac6b80fbd7`）· Reader-UI 参考只读（`88069f6df3bec6ad040a6c6f9f7cebc815548342`）*
