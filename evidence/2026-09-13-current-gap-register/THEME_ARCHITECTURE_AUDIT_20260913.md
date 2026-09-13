> 历史快照说明（2026-09-13复核）：本文保留当时日志/判断，不维护当前待办。当前实施合同见 [READER_REPAIR_SPEC](../../docs/READER_REPAIR_SPEC.md)，实时状态见工作区 DEVELOPMENT_BACKLOG §11。下文旧“CODE FIXED/未实现/需决定”不自动继承；尤其胶囊时值、Night不存在/强改不透明、More=书签/整理=CRUD、201固定按钮宽及整组翻页缺实现已被当前源码/Figma/原始用户决定纠正。

# 主题模块架构审计（2026-09-13）

## 已确定

- 一个共享 ThemeRegistry；应用日间/夜间两套 AppPalette；阅读主题数量可扩展。
- 书架、搜索、导入、设置、控制栏和播放胶囊使用 AppPalette。
- 正文及阅读专属 chrome 使用 ReaderPalette；每个阅读主题显式标记 day/night。
- 阅读主题选择与应用主题双向联动：同明暗保留 followSystem，异明暗切换为对应显式模式并取消 followSystem。
- 应用切换日间/夜间使用对应默认阅读主题；默认日间/夜间阅读主题可在完整控制页设置。
- 备份同步只传选择状态，不传展开后的颜色和平台渲染结果。

## 代码侧缺口

- 当前 HEAD 仍是硬编码 ReaderAppearanceTheme、重复 themeColor 和固定 TOK_READ_*；尚未有唯一 ThemeRegistry。
- 应用夜间完整色板不存在；当前多数应用页面仍固定日间色。
- 当前阅读主题只含页面基础字段，阅读专属 meta、状态栏、进度、高亮、翻页效果角色不完整。
- 半透明控制栏/胶囊如直接透出正文，会使应用界面视觉上继续被阅读主题染色；需要独立应用色底板或明确的遮罩采样边界。
- 联动必须由单一事件归约器处理，防止派生更新再次触发“用户选择主题”事件造成循环和默认值覆盖。
- 默认主题修改的立即生效规则、备份字段集合、运行时自定义颜色是否属于本期仍需明确。

## 未决产品边界

1. 阅读页顶部信息和状态栏是否继续使用 ReaderPalette（当前按此前要求保留）；播放胶囊已确定使用 AppPalette。
2. 修改当前明暗模式的默认阅读主题后，是立即替换当前阅读主题，还是下次应用模式切换才生效。
3. 备份是否同步 `appThemeMode`、`readerThemeId`、`defaultDayReaderThemeId`、`defaultNightReaderThemeId` 四个选择字段；若只同步一个 ID，两个默认值无法跨设备恢复。
4. 本期是否提供用户逐项改色的编辑入口；若不提供，只实现配置侧可调整和主题数量扩展。
5. 控制栏保留 Figma 半透明动效时，是否允许正文透色；推荐保留动效透明轨道，但在应用色底板上合成。

## 用户修正（2026-09-13）

- 阅读主题修改以“已选择并已切换为该主题”为前提，不存在修改默认主题后是否意外替换当前主题的产品歧义。
- 备份同步只同步主题 ID/选择状态，不同步颜色配置。
- 本期不设计用户逐项改色入口；“可调整颜色”指统一配置可调整和主题数量可扩展。
- 控制栏按当前设计全部使用不透明表面；此前关于半透明控制栏透出正文的未决项作废，现有带透明度的控制栏 Token 属于实现残留，需要替换为不透明应用配色。
- 阅读页顶部信息和状态栏跟随当前阅读主题；播放胶囊跟随应用日间/夜间主题。

上述修正覆盖并废止此前同一文档中关于“默认主题修改是否立即替换当前主题”“半透明控制栏透色”“用户逐项改色入口”和“顶部信息/状态栏归属”的待决描述。当前按最新用户规则执行：主题切换是显式选择并立即生效；控制栏完全不透明且使用应用日/夜色；顶部信息和状态栏使用阅读主题；本期不提供逐项改色 UI。

## 当前 HEAD 源码复核（2026-09-13）

- 当前实现确实存在半透明控制表面：`TOK_SURFACE_PANEL=#9EFFFCF8`（alpha 62%）、`TOK_SURFACE_PANEL_SOFT=#A3EEE6DB`（alpha 64%）、`TOK_SURFACE_ELEVATED=#C7FFFFFF`（alpha 78%）；`ReaderControlPanel.ets` 的 full content、quick action、chapter progress、brightness rail 等直接使用这些值，并叠加动效 opacity。
- `ReaderControlAppearanceStyle.ts` 的 8 个颜色是选择器 swatch，不是完整控制栏色板；`ReaderControlThemeStyle.ets` 忽略 themeId，`ReaderControlPanel` 传入的主题 prop 未被内部颜色消费。
- 当前控制栏没有 backdrop blur/背景采样 API；透明表面直接合成在阅读正文后，因此最终像素会被阅读背景染色。
- `SettingsPage.ets` 的应用主题选择仍为局部 `@State themeValue`，未进入 SettingsSnapshot/Gateway；应用主题未形成运行时闭环。
- 当前工作树 dirty，任何历史 HAP/VM 截图均不能证明这些源码事实已经在最新产物中修复。
