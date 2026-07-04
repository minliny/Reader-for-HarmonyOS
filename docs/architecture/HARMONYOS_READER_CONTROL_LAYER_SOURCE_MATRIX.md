# Reader 控制层源码转译矩阵

日期：2026-07-03

本文件只记录 `frontend-demo` 当前源码到 HarmonyOS ArkUI 的转译关系。截图只能作为验收证据，不能作为尺寸、结构或状态来源。

最新全量阅读审计以 `docs/architecture/HARMONYOS_READER_CANONICAL_DEMO_SOURCE_AUDIT.md` 为准。本文件是控制层局部转译矩阵；其中“已建立骨架”不等于 source-switch / Reader 控制层已经严格通过 demo 响应式结构验收。

## 输入源码

| 类型 | 文件 | 本轮使用内容 |
|---|---|---|
| 结构生成 | `/Users/minliny/Documents/Reader UI/frontend-demo/render-runtime.js` | `readerModulePanel(...)`、`readerTtsDropdownHtml(...)`、`readerSettingDropdownHtml(...)`、`normalizeReaderDropdowns()` |
| TTS 样式 | `/Users/minliny/Documents/Reader UI/frontend-demo/styles/02-main-library.css` | `.fd-reader-tts-panel`、`.fd-reader-tts-row`、`.fd-reader-tts-option-row`、`.fd-reader-tts-dropdown` |
| 设置样式 | `/Users/minliny/Documents/Reader UI/frontend-demo/styles/03-reader.css` | `.fd-reader-settings-list`、`.fd-reader-setting-row`、`.fd-reader-setting-dropdown` |
| 换源流程 | `/Users/minliny/Documents/Reader UI/frontend-demo/render-runtime.js` | `flowScreen(...)`、`sourceCandidateRow(...)` |
| 换源样式 | `/Users/minliny/Documents/Reader UI/frontend-demo/styles/05-flow-adaptive.css`、`06-responsive.css` | `.fd-source-reader-continuation`、`.fd-source-continuity-slot`、`.fd-source-window-slot`、`.fd-source-result-slot` |
| motion 合同 | `/Users/minliny/Documents/Reader UI/frontend-demo/MOTION_CONTRACT.md` | `dropdown.menu.expand`、`dropdown.menu.collapse`、`dropdown.option.select`、`state.content.replace` |

## TTS 面板

| demo 结构 | demo 源码/样式约束 | ArkUI 落点 | 当前状态 |
|---|---|---|---|
| 面板容器 | `fd-reader-module-panel fd-reader-tts-panel`，header `24px`，内容区 `minmax(0,1fr)` | `ReaderControlLayer.TtsPanel()` | 已改为 `Stack`：底层固定行结构，上层承载 dropdown overlay |
| header | `fd-reader-tts-toolbar`，标题 `朗读`，右侧 `停止朗读` | `TtsPanel()` header `Row` | 已保留 24 高度和停止按钮 |
| 播放控制行 | `fd-reader-tts-row fd-reader-tts-control-row`，行高 `32px`，列 `20px / 1fr / auto`，gap `9px` | `TtsControlLine` | 已实现 32 高度、20 图标位、右侧三按钮 |
| 语速 | `data-reader-tts-option-key="speed"`，dropdown 值来自 `options.speed` | `ReaderModuleDropdownLine(optionKey='speed')` | 触发行固定 32 高度，dropdown 由面板 overlay 绘制 |
| 音色 | `data-reader-tts-option-key="voice"` | `ReaderModuleDropdownLine(optionKey='voice')` | 同上 |
| 范围 | `data-reader-tts-option-key="scope"` | `ReaderModuleDropdownLine(optionKey='scope')` | 同上 |
| 定时 | `data-reader-tts-option-key="timer"` | `ReaderModuleDropdownLine(optionKey='timer')` | 同上 |

TTS 行顺序按 demo 保持：

```text
header 24
播放控制 32
语速 32
音色 32
范围 32
定时 32
```

## 设置面板

| demo 结构 | demo 源码/样式约束 | ArkUI 落点 | 当前状态 |
|---|---|---|---|
| 面板容器 | `fd-reader-settings-panel` 内 `fd-reader-settings-list`，滚动隐藏滚动条 | `ReaderSettingsPanel()` | 已改为 `Stack`：底层固定设置行，上层承载 dropdown overlay |
| 自动翻页 | 普通 toggle 行，`34px` | `ReaderModuleToggleLine(autoPage)` | 已实现 |
| 点击翻页方式 | `fd-reader-setting-row` + `data-reader-setting-option-key="tapMode"` | `ReaderModuleDropdownLine(optionKey='tapMode', rowHeight=34)` | 触发行固定 34 高度 |
| 音量键翻页 | 普通 toggle 行，`34px` | `ReaderModuleToggleLine(volumePage)` | 已实现 |
| 翻页动画 | `fd-reader-setting-row` + `data-reader-setting-option-key="pageAnimation"` | `ReaderModuleDropdownLine(optionKey='pageAnimation', rowHeight=34)` | 触发行固定 34 高度 |
| 后续开关 | 横屏锁定、屏幕常亮、页脚进度信息、触摸反馈、自动缓存后续章节 | `ReaderModuleToggleLine(...)` | 已实现结构骨架 |

设置行顺序按 demo 保持：

```text
自动翻页
点击翻页方式
音量键翻页
翻页动画
横屏锁定
屏幕常亮
页脚进度信息
触摸反馈
自动缓存后续章节
```

## dropdown 规则

| 规则 | demo 值 | ArkUI 转译 |
|---|---|---|
| TTS dropdown anchor | `top: 29px; right: 7px` | `readerDropdownDownOffset('tts') = 29`，overlay `paddingRight=7` |
| 设置 dropdown anchor | `top: 31px; right: 7px` | `readerDropdownDownOffset('settings') = 31`，overlay `paddingRight=7` |
| dropdown 宽度 | `min(144px, calc(100% - 42px))` | 当前 compact 面板使用 `144vp`，后续宽屏再接 `calc` 等价约束 |
| dropdown padding | `5px` | `ReaderModuleDropdownList` 内容 padding `5` |
| option 高度 | `min-height: 27px` | `ReaderModuleDropdownOption.height(27)` |
| option 间距 | 相邻按钮 `margin-top: 2px` | 每项 bottom `2`；高度计算使用 `27 + 2` |
| 选中态 | `is-selected`，浅主色背景 + check icon | `selectedValue` + `ReaderControlIcon('ui-check')` |
| 空间不足 | `normalizeReaderDropdowns()` 判断面板边界，空间不足且上方空间更多时加 `.is-drop-up` | `readerDropdownDropUp(...)` 以 module 内高、行 top/bottom 和 full height 计算向上/向下 |
| max-height | 用可用空间归一化到可见行数 | `normalizedReaderDropdownHeight(...)` 对可见高度做同等行数计算 |

## 状态与 motion

| 交互 | demo 语义 | ArkUI reducer | Motion ID |
|---|---|---|---|
| 展开 TTS option | `readerTtsExpandedOption = key` | `toggleReaderTtsOption(...)` | `dropdown.menu.expand` |
| 收起 TTS option | 清空展开 key | `toggleReaderTtsOption(...)` | `dropdown.menu.collapse` |
| 选择 TTS option | 写入 `readerTts[key]`，关闭 dropdown | `selectReaderTtsOption(...)` | `dropdown.option.select` |
| 展开设置 option | `readerSettingsExpandedOption = key` | `toggleReaderSettingsOption(...)` | `dropdown.menu.expand` |
| 选择设置 option | 写入 `readerSettings[key]`，关闭 dropdown | `selectReaderSettingsOption(...)` | `dropdown.option.select` |
| 换源候选选择 | 只替换本地换源结果内容，不提前写真实书源 | `selectSourceSwitchSource(...)` | `state.content.replace` |

## source-switch FlowShell

当前结构按 demo viewport class 翻译，不按单一设备尺寸硬编码：

- portrait phone，例如 `1320 x 2856 / 560dpi` 或当前 `1280 x 2832` 近似手机，source-switch 保持 phone overlay。
- demo `tablet-expanded` 和 `compact-landscape` 类，source-switch 使用三槽 FlowShell。
- `2560 x 1600 / 360dpi / landscape` 只是 tablet-expanded 的代表性回归样机。

| demo 结构 | demo 源码/样式约束 | ArkUI 落点 | 当前状态 |
|---|---|---|---|
| FlowShell frame | `fd-flow-frame fd-source-phone-flow fd-source-reader-continuation` | `ReaderControlLayer.SourceSwitchFlowShell()` | 已建立 ArkUI 原生 FlowShell 骨架，不使用 WebView |
| reader slot | `fd-flow-step fd-source-continuity-slot`，宽屏 grid-area 为 `reader` | `SourceSwitchReaderSlot()` + `ControlTopBar()` + `SourceSwitchReaderDock()` | 已承载正文、顶栏、控制 dock、模块导航的连续性；source-switch FlowShell 打开时全局 `ReaderSharedSurface` 不再重复绘制 |
| window slot | `fd-flow-comparison fd-source-window-slot`，phone 绝对定位 `left/right 12`、`top 92`、`bottom 360`，宽屏 grid-area 为 `window` | `SourceSwitchWindowSlot()` | 已承载换源 header、关闭按钮和候选书源列表 |
| result slot | `fd-flow-result fd-source-result-slot`，phone 隐藏，tablet / compact-landscape 显示 | `SourceSwitchResultSlot()` | 已在宽屏 FlowShell 显示确认面板；phone 保持隐藏 |
| 三列宽屏 | `tablet-expanded` / `compact-landscape` 下为 `minmax(300px,1fr) minmax(260px,300px) minmax(160px,200px)`，gap/padding `12px` | `sourceSwitchReaderWidth()`、`sourceSwitchWindowWidth()`、`sourceSwitchResultWidth()` | 已按同等 min/max 规则计算，并用代表平板和 medium landscape 做代码级断言；真实平板截图待补 |
| 候选排序 | `flow.candidates` 按 latency/speed 排序，选中源来自 `sourceSwitchSelectedSource` 或当前源 | `READER_SOURCE_CANDIDATES` + `sourceSwitchSelectedSource` | 当前仍是本地 fixture；已保留候选选择和结果替换状态 |
| 确认行为 | `data-route="reader" data-route-replace`，确认后回阅读控制层 | `confirmSourceSwitchSource(...)` + `onConfirmSourceSwitchSource` | 已接本地 reducer，提交 `ReaderContext.sourceId` 并回到来源 presentation；真实书源业务切换未接 |

## 当前未完成

- TTS 没有接真实朗读引擎、当前句切片和正文高亮。
- 设置 toggle 只保留结构与状态钩子，尚未接平台设置。
- dropdown 的行数、高度、drop-up 和 y 位置已集中到 `ReaderControlLayout.ets`；宽屏 `calc(100% - 42px)` 这一类横向宽度 token 后续仍需继续补。
- `source-switch` 已有 phone continuity、宽屏三槽 FlowShell 骨架、候选选择和本地确认状态；`ReaderAdaptive.sourceSwitchUsesFlowLayout()` 触发条件、`SourceSwitchReaderSlot()` slot 几何和 FlowShell 下正文归槽已按 canonical demo 源码修正，且已集中到 `ReaderControlLayout.ets`；phone 设备截图已补，横屏/平板 FlowShell 视觉证据仍待补。
- `ReaderControlLayout.ets` 已承接 sheet、rail、module nav、top bar、source-switch FlowShell、动作区、章节区、dropdown、更多菜单、full/utility host、session/controlSpace 胶囊和 utility 行距几何；完整页/utility 内部内容行 token 仍未全部集中。
- 真实业务换源和目标横屏/平板设备视觉验收仍未完成。
- 真实业务数据、fold posture、键盘安全区、无障碍和性能专项仍未开始。
