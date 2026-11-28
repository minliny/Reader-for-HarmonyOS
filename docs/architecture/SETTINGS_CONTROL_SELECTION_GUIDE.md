# HarmonyOS 设置页控件选型与视觉分层指导

> 上位跨端规范见 [`Reader-UI/docs/DESIGN_TOKENS_AND_STATES.md`](../../../Reader-UI/docs/DESIGN_TOKENS_AND_STATES.md) §5.1。本文档将 4 类语义选型规则与 3 条硬性红线映射到 HarmonyOS 现行组件。

## 1. 语义分类与 HarmonyOS 控件映射

| 语义类别 | 判断标准 | HarmonyOS 控件与组件 | 说明 |
| --- | --- | --- | --- |
| **1. 视觉 / 版式模式** | 2–3 项互斥且能用极简图形表达外观/版式差异，且为该分组主导设置 | `ReaderVisualChoiceStrip`（置于 `CategorySection` 首位） | 全宽 2 列或 3 列等分视觉选择卡，天然填满 390vp / 640vp 卡片宽度并建立视觉锚点 |
| **2. 二元开关 / 能力启用** | 开/关，或「默认 vs 启用某特性」 | `ReaderFormRow`（`onLabelAction`）+ `ReaderToggle` | 避免用 `162vp` 分段器硬撑 2 个字，保留整行点击、焦点保持和 1 句常驻短说明 |
| **3. 策略 / 动作枚举** | 依赖文字理解的运行策略或动作映射 | 默认：`ReaderFormRow`（`disclosure: true` + 主色当前值）+ `SettingsSelectOverlay`<br>特例：`ReaderSegmentedControl` | 仅在「选项 ≤3、每项 ≤3 字、无长说明、且同卡内无其他分段器」时允许使用行内 `ReaderSegmentedControl` |
| **4. 跳转 / 一次性动作** | 跳子页、清理缓存、重置默认 | `ReaderFormRow`（`disclosure` / `ReaderButton` / `kind: 'danger'`） | 保持既有消息框与确认弹窗宿主归属 |

## 2. 三条硬性红线

1. **单卡分段器上限 = 1 个**：同一张 `CategorySection` 卡片内禁止连续放置 2 个及以上 `ReaderSegmentedControl`。
2. **禁止 2×2 字塞进 `162vp`**：`READER_APP_THEME_SEGMENT_WIDTH`（`162vp`）只服务于 `3×≤2 字` 或 `2×3~4 字`；`2×2 字` 必须按类别 1 升格为 `ReaderVisualChoiceStrip`，或按类别 2 降级为 `ReaderToggle`。
3. **长说明行禁配宽分段器**：`secondaryText` 超过 10 字的行禁止右侧放置 `162vp` `ReaderSegmentedControl`，应改用 `ReaderToggle` 或 `ReaderFormRow` + `SettingsSelectOverlay`。

## 3. 现行设置页面权威落位表

| 页面 / 模块 | 设置项 | 语义类别 | 权威实现 |
| --- | --- | --- | --- |
| 通用设置 · 外观与显示（`SettingsPage`） | `App 主题`（跟随 / 浅色 / 深色） | 类别 1（视觉模式） | `ReaderVisualChoiceStrip`（3 列主题预览卡） |
| 通用设置 · 外观与显示（`NavigationAppearanceSettings`） | `系统原生外观`（原「界面外观」） | 类别 2（默认 vs 启用特性） | `ReaderFormRow` + `ReaderToggle`（性能优先时置灰提示回退） |
| 通用设置 · 外观与显示（`NavigationAppearanceSettings`） | `渲染模式`（效果优先 / 性能优先） | 类别 3（策略枚举 + 长说明） | `ReaderFormRow`（值 + 箭头）+ `SettingsSelectOverlay` |
| 通用设置 · 外观与显示（`SettingsPage`） | `减少动态效果` | 类别 2（二元开关） | `ReaderFormRow` + `ReaderToggle` |
| 通用设置 · 交互与布局（`SettingsPage` / `ReaderSmartGestureSettingsRows`） | `点击当前底栏回顶部`、`宽屏使用侧边导航`、`智慧手势` | 类别 2（二元开关） | `ReaderFormRow` + `ReaderToggle` |
| 通用设置 · 交互与布局（`SettingsPage` / `ReaderSmartGestureSettingsRows`） | `宽屏控制栏默认位置`、`敲一敲` | 类别 3（3 选短枚举） | `ReaderSegmentedControl`（若宽屏与手势同卡出现且需继续精简，优先将其中一个转为选择行） |
| 书架设置（`BookshelfSettingsPage`） | `显示方式`（封面 / 列表） | 类别 1（版式模式） | `ReaderVisualChoiceStrip`（2 列封面/列表预览卡） |
| 书架设置（`BookshelfSettingsPage`） | `自动检查书架更新` | 类别 2（二元开关） | `ReaderFormRow` + `ReaderToggle` |
| 本地备份与恢复（`SettingsPage`） | `系统备份包含本地原书` | 类别 2（二元开关） | `ReaderFormRow` + `ReaderToggle` |
| 阅读控制浮层（`ReaderControlSettingsContent`） | `双栏对开 / 单栏居中` | 类别 3 特例（2×4 字满排，非表单墙） | `ReaderSegmentedControl`（保持不动） |
