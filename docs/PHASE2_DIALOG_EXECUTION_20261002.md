# Phase 2 Dialog 纵切执行回执

日期：2026-10-02
工作包：WP04 Dialog（第一条生产迁移纵切）
分支：`feat/phase2-dialog-20261002`
worktree：`/Users/minliny/Documents/Reader/.reader-isolated/phase2-dialog-20261002/Reader-for-HarmonyOS`

## 起点

本 worktree 从干净的 Dialog 候选 `0c225539fc0ac010d8478ae0c79dcc560431722a` 分出，并带入 WP00 回执 `ec12262726b3e9b0f0ce3d54565d1bb2593dd452`。没有从 Host 主树复制 85 项 dirty，也没有接入 Core 主树的 46 项 dirty。

当前候选的三个同规格真实消费者是：删除确认、JSON 导入和书架默认分组。连续导入 `LocalImportDialog` 仍由 WP09 负责；系统 `showAlertDialog` 属于平台宿主合同，不混入自绘 Dialog 家族。

## 本次推进

候选原有的共享 `ReaderDialogSurface` 只把 `bodyActionsOwnMargin` 暴露为 helper 读数。本次补充真实 Builder probe 的节点级断言：

- 删除确认的 30vp 间距必须写在唯一的内层 body `Column` 上。
- 外层 framed root `Column` 不得收到该间距作为外边距。
- JSON 导入和书架分组必须各自保留空的内层 body margin，不得继承删除确认规格。
- 这些断言在同一候选的不同窗口宽度/规格重放中保持成立。

这一步只增强验证，不改变当前应用视觉基线，也没有把第三阶段的视觉细调提前混入迁移。

## 已执行验证

| 命令 | 结果 | 证据边界 |
|---|---|---|
| `node tools/test-book-removal-dialog.mjs` | PASS | 真实 SDK Builder probe、状态回调、三规格节点级间距与变体隔离 |
| `node tools/test-json-import-dialog-real.mjs` | PASS | JSON 草稿/校验/关闭链、共享规格传播和宿主接线 |
| `node tools/test-responsive-surface-widths.mjs` | PASS | Dialog 与页面横向几何静态回归 |
| `node tools/run-contract-tests.mjs --source` | PASS，173 个 source，236 个 integration 分类 | Host 源码合同；不代替 SDK/HAP/VM/视觉/用户验收 |

另外通过四项静态交付门禁：`test-hap-pipeline-contract.mjs`、`test-native-input-preflight.mjs`、`test-build-input-safety.mjs` 和 `test-hap-source-inputs.mjs`。这些只证明输入、签名身份绑定和流水线防护仍可执行，不生成新的 HAP，也不改变当前 VM 安装。

## 未关闭出口

WP04 仍是候选状态。完整 ArkTS/SDK parent integration、规范 HAP、VM 运行表现、视觉比较、用户接受和主树合入尚未在本回执中关闭。下一步应在同一 worktree 继续做完整 parent integration 与适用 Dialog 对账；只有这些证据分层闭合后才允许合并。
