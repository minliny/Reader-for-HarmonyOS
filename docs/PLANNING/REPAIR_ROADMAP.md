# Repair Roadmap — Figma-first 偏离修复路线图

> 生成时间：2026-07-26
> 分支：`codex/harmony-signed-device-runtime`
> 当前 HEAD：`c9a6bdb`

## 背景

7/22-25 期间多 agent 并发导致 Figma 并行层回潮：一个 agent 拆除并行层（commit `668fc46`），另一个 agent 新增 9 个 `Figma*Root.ets` + 4 个 `FigmaVisual*AdmissionPolicy.ets`。根因是规划只存在于会话上下文，未写入仓库，且质量 gate 只防缺失不防倒退。

本路线图把修复计划固化到仓库，作为后续所有 agent 的共享上下文。

## 修复层级

### Layer 1-3：已完成 ✅

| Layer | 内容 | Commit | 验证 |
|-------|------|--------|------|
| 1 | 拆除 Figma*.ets 并行层 + 收敛单一视觉准入权威 | `668fc46` | check:reader-ui-consumer PASS |
| 2 | 隔离 commit A：并行层删除 + Reader-UI admission 消费 + hard gate + 质量基线 + 并发约束 | `0f90de9` | 36 文件，gate 全绿 |
| 3 | 隔离 commit B：行为改动 + media + font + device test runner | `c9a6bdb` | 99 文件，465 device tests pass |

### Layer 4：Unfrozen Bindings 收束 — 阻塞 ⏸️

- **状态**：28 个 `current-read-unfrozen` binding 需要真机证据冻结
- **阻塞原因**：device evidence + motion evidence 字段全空，本地无法生成
- **详细清单**：见 [LAYER4_UNFROZEN_BINDINGS.md](./LAYER4_UNFROZEN_BINDINGS.md)
- **解锁条件**：hdc 设备就绪 + 当前 release HAP 已安装
- **执行方**：Reader-UI 侧写入 registry，HarmonyOS 侧只消费

### Layer 5：功能 Bug 修复 + 设备复测 — 部分可推进 🔧

- **状态**：6 个功能 bug 已识别，3 个可本地修复，全部需设备复测
- **详细清单**：见 [LAYER5_FUNCTIONAL_BUGS.md](./LAYER5_FUNCTIONAL_BUGS.md)
- **可本地推进**：Bug 1 (HUKS 集成)、Bug 3 (注释清理)、Bug 5 (TTS 幂等)
- **必须设备**：Bug 2 (deviceVerified)、Bug 4 (verticalScrollCheck)、Bug 6 (settings 路由)

## 防回潮机制（已就位）

### Hard Gate

1. **`test_contracts.mjs`**：硬断言禁止 `Figma*Root.ets` / `FigmaVisual*Policy.ets` / `FigmaExactRouteRenderer.ets` / `ReaderControlIcon.ets` 回潮
2. **`COVERAGE_QUALITY_BASELINE`**（`sync_reader_ui_screen_graph.mjs:1649-1666`）：faithful 实例 < 285 或 partial 实例 > 52 即 fail
3. **`AGENTS.md` 并发纪律**：single-writer / isolation commit / stash 单一职责 / stop conditions

### 提交纪律

1. 结构/gate 改动独立提交（isolation commit A 模式）
2. 行为/资源改动独立提交（isolation commit B 模式）
3. 禁止混合提交 100+ 文件的 blob
4. stash 必须按"视觉准入 / 行为 / 设备证据"拆分

### 并发约束

1. 一个页面族/一个 repo 同时只能有一个 writer
2. 其他 agent 只读、出计划或做独立验证
3. `WORKTREE_FROZEN.md` 标记存在时禁止所有修改

## 执行优先级

1. **本地可推进**：Bug 1 (HUKS) + Bug 3 (注释) + Bug 5 (TTS 幂等)
2. **设备就绪后**：Layer 4 (28 binding 冻结) + Bug 2/4/6 (设备复测)
3. **暂缓**：Android/iOS 三端对齐（当前 HarmonyOS 修复未固化，扩大范围会重蹈覆辙）

## 不可做的

- 不得在 HarmonyOS 侧伪造 device evidence
- 不得用历史截图/日志冒充当前 release 证据
- 不得在 device evidence 缺失时将 binding 冻结
- 不得重建已拆除的 Figma*.ets 并行层
- 不得在未隔离的情况下混合提交结构/行为/资源改动
- 不得在 Layer 4/5 未完成时扩大到三端对齐

## 参考文档

- [FIGMA_TO_NATIVE_AGENT_EXECUTION_PROTOCOL.md](../../Reader-UI/docs/design/FIGMA_TO_NATIVE_AGENT_EXECUTION_PROTOCOL.md)
- [AGENTS.md](../../AGENTS.md) — 并发与提交纪律
- [LAYER4_UNFROZEN_BINDINGS.md](./LAYER4_UNFROZEN_BINDINGS.md)
- [LAYER5_FUNCTIONAL_BUGS.md](./LAYER5_FUNCTIONAL_BUGS.md)
