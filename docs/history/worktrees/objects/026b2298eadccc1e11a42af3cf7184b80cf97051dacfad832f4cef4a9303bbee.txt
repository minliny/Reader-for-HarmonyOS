# Phase 2 Dialog 消费者边界

日期：2026-10-02  
工作包：WP04 Dialog 纵切  
分支：`feat/phase2-dialog-20261002`

## 已迁移的同规格自绘消费者

本阶段的共享实现是 `features/common/ReaderDialogSurface.ets`。当前应用树中登记并由它承载的自绘消费者正好三个：

| 消费者 | 源文件 | 本阶段结论 |
|---|---|---|
| 删除确认 | `features/bookshelf/BookRemovalDialog.ets` | 已接入，共享删除确认规格 |
| JSON 导入 | `features/common/JsonImportDialog.ets` | 已接入，共享导入规格 |
| 书架默认分组 | `pages/Index.ets` | 已接入，共享分组规格 |

这三个消费者共用标题区、内容区布局、操作区和表面规格；业务状态、草稿、校验、关闭回调仍由各自 owner 保持。当前视觉以既有应用效果为基线，视觉细调留在后续统一回归阶段。

## 明确排除并登记的入口

### 平台原生 `showAlertDialog`：19 处

以下调用仍是平台宿主 AlertDialog 合同，不能用自绘 `ReaderDialogSurface` 的数量替代，也不能在本阶段声称已迁移。数量由 `tools/test-dialog-consumer-boundary.mjs` 对源码调用点锁定为 19：

| 宿主 | 数量 | 当前归属/后续处理 |
|---|---:|---|
| `pages/Index.ets` | 9 | 书源、RSS、离线缓存和阅读恢复提示；保留平台宿主，后续按 WP05/WP06 或专门平台合同评估 |
| `features/settings/SettingsPage.ets` | 1 | 设置操作提示；保留平台宿主，随设置域统一评估 |
| `features/source/SourceToolsPage.ets` | 1 | 书源工具提示；保留平台宿主，随书源域统一评估 |
| `features/reading/LocalReadingExperience.ets` | 8 | 阅读恢复、进度、缓存和资源错误提示；保留平台宿主，随阅读域及平台合同评估 |

这些入口存在不同的系统行为、按钮结果回调和生命周期要求；是否迁移必须先分别证明原生宿主能力、键盘/返回/外侧关闭和错误恢复合同，不能因外观相似直接归入 WP04。

### 其他不属于 WP04 的表面

- `LocalImportDialog` 是持续导入任务的动态表面，包含进度、迟到结果和重新打开语义，归 WP09。
- Sheet、Popup、选择器和菜单归 WP05/WP06；它们的宿主、锚点和关闭语义不同于本阶段自绘 Dialog。
- 原生系统 AlertDialog 保留其平台调用边界，直到对应工作包完成能力核定与迁移验收。

## 完整性判定

本清单证明 WP04 的源代码消费者边界没有漏登记：三个自绘消费者必须共用 `ReaderDialogSurface`，19 个平台原生 AlertDialog 必须可追溯，`LocalImportDialog` 必须继续留在 WP09。它不宣称原生 AlertDialog、持续导入、Sheet/Popup 已迁移，也不代替 HAP、VM、视觉和用户验收。
