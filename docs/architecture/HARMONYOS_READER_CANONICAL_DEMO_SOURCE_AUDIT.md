# Reader UI canonical demo 源码全量阅读审计

审计日期：2026-07-03

本文件是后续 HarmonyOS ArkUI UI 开发的源码基准。它只从 canonical demo 源码提取结构、布局关系、状态和 motion 语义，不从截图反推实现。截图和录屏只能用于最后验收。

## 0. 结论

当前 HarmonyOS ArkUI 实现已经有四主 Tab、书架进入沉浸阅读、ReaderShell、ReaderSharedSurface、ReaderControlLayer、source-switch 初版 FlowShell、ReaderMotion、ReaderUiState 和 ReaderAdaptive。

但还不能宣称“严格按照 demo 实现”。2026-07-03 本轮已先修复源码审计中暴露的 P0 实现偏差，剩余问题集中在 P1 视觉 token 和设备证据：

| 等级 | 状态 | 问题 | 结果 / 影响 |
|---|---|---|---|
| P0 | 已修复 | 自适应触发规则没有完整复刻 demo 的 `viewportClassSnapshot()`，尤其 `source-switch` 三槽 FlowShell 触发条件偏宽 | `ReaderAdaptiveState` 已增加 demo width/height/viewport class；`sourceSwitchUsesFlowLayout()` 只按 `tablet-expanded` / `compact-landscape` 触发 |
| P0 | 已修复 | `source-switch` 的 reader slot 在 ArkUI 里仍以局部 Stack 近似，demo 里它是 FlowShell 的完整 `stepRegion` / `reader` grid area | `SourceSwitchReaderSlot()`、顶栏和 reader dock 已改为同一 reader slot 原点，不再用 window slot 裁切 |
| P0 | 已修复 | 旧文档里部分“已完成”是阶段性修复记录，不等于当前 demo 源码严格对齐 | 已补充 canonical 审计文档并修正设备 profile / gap / source matrix 口径 |
| P1 | 部分修复 | Reader 控制层布局 token 仍分散在 `ReaderControlLayer.ets` 中，未形成 demo CSS 到 ArkUI slot 的集中转译层 | `ReaderControlLayout.ets` 已承接 sheet、rail、module nav、top bar、source-switch FlowShell、动作区、章节区、dropdown、更多菜单、full/utility host、session/controlSpace 胶囊和 utility 行距几何；完整页/utility 内部内容 token 仍需继续抽 |
| P1 | 待修复 | 文本、颜色、阴影、边框、图标资源仍有多处硬编码或近似值 | 视觉会继续和 demo 拉开差距 |

后续修改顺序必须是：先按本文件修源码映射和 layout token，再做视觉截图。不要再从单张截图开始改。

## 1. 审计输入

canonical demo 源码：

| 类型 | 文件 | 本次使用的源码位置 |
|---|---|---|
| 自适应断点 | `/Users/minliny/Documents/Reader UI/frontend-demo/render-runtime.js` | `viewportClassSnapshot()`，约 `179-225` |
| Shell slot | `/Users/minliny/Documents/Reader UI/frontend-demo/shared-shell-kit/kit.js` | `renderMainTabShell()`、`renderLibraryShell()`、`renderReaderShell()`、`renderFlowShell()`，约 `100-172` |
| 路由归属 | `/Users/minliny/Documents/Reader UI/frontend-demo/route-contract.js` | routes，约 `1-133` |
| 主 Tab 数据 | `/Users/minliny/Documents/Reader UI/frontend-demo/fixture.js` | `mainTabs.nav`，约 `81-87` |
| 书架入口 | `/Users/minliny/Documents/Reader UI/frontend-demo/render-runtime.js` | `mainTabBookshelf()`，约 `439-472`；封面点击绑定，约 `9895-9960` |
| Reader route state | `/Users/minliny/Documents/Reader UI/frontend-demo/render-runtime.js` | `readerStateByRoute`，约 `2474-2484` |
| Reader surface | `/Users/minliny/Documents/Reader UI/frontend-demo/render-runtime.js` | `sharedReaderSurface()`、`readerInfoOverlay()`、`readerTextSelectionLayer()`、`readerTapZones()`，约 `3251-3355`、`3979-3986` |
| Reader 控制层 | `/Users/minliny/Documents/Reader UI/frontend-demo/render-runtime.js` | `readerTopOverlay()`、`readerQuickActionPanel()`、`readerModulePanel()`、`readerBrightnessRail()`、`readerControlMain()`、`readerBottomSheetHtml()`，约 `4008-4572` |
| source-switch | `/Users/minliny/Documents/Reader UI/frontend-demo/render-runtime.js` | `flowScreen()`，约 `7624-7678` |
| 基础响应式变量 | `/Users/minliny/Documents/Reader UI/frontend-demo/styles/00-foundation.css` | runtime width/height 与 keyboard，约 `238-290`、`939-950` |
| Shell / Reader 基础 CSS | `/Users/minliny/Documents/Reader UI/frontend-demo/styles/01-shell-layout.css` | MainTab nav rail、reading layer、info layer、topbar，约 `138-178`、`2492-3055` |
| Reader sheet CSS | `/Users/minliny/Documents/Reader UI/frontend-demo/styles/02-main-library.css` | sheet、grabber、control main、actions、chapter panel，约 `7-540` |
| Reader module CSS | `/Users/minliny/Documents/Reader UI/frontend-demo/styles/03-reader.css` | setting dropdown、compact-landscape、module nav、wide dock，约 `620-1365` |
| Brightness rail CSS | `/Users/minliny/Documents/Reader UI/frontend-demo/styles/04-settings-source.css` | `.fd-brightness-rail`，约 `174-215` |
| source-switch phone CSS | `/Users/minliny/Documents/Reader UI/frontend-demo/styles/05-flow-adaptive.css` | `.fd-source-reader-continuation`，约 `1458-1705` |
| source-switch responsive CSS | `/Users/minliny/Documents/Reader UI/frontend-demo/styles/06-responsive.css` | tablet / compact-landscape 三槽，约 `90-260` |
| motion 合同 | `/Users/minliny/Documents/Reader UI/frontend-demo/MOTION_CONTRACT.md` | 主 Tab、route、reader entry、reader module、session、source-switch |
| motion 细则 | `/Users/minliny/Documents/Reader UI/frontend-demo/MOTION_EFFECTS.md` | reduced-motion、interrupt、session、source-switch |

HarmonyOS 当前对照：

| 类型 | 文件 |
|---|---|
| App 入口 | `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/pages/Index.ets` |
| 主 Tab Shell | `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/shells/MainTabShell.ets` |
| Reader Shell | `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/shells/ReaderShell.ets` |
| Reader surface | `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/components/ReaderSurface.ets` |
| 共用正文层 | `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/components/ReaderSharedSurface.ets` |
| Reader 控制层 | `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/components/ReaderControlLayer.ets` |
| 自适应 | `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/ReaderAdaptive.ets` |
| 状态机 | `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/ReaderUiState.ets` |
| route mapping | `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/ReaderRouteMapping.ets` |
| motion token | `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/ReaderMotion.ets` |

## 2. demo 自适应规则

demo 的响应式入口是 `viewportClassSnapshot()`，不是固定手机、固定平板、固定 DPI。

demo 规则：

| 字段 | 源码规则 |
|---|---|
| `orientation` | `width > height ? landscape : portrait` |
| `widthClass` | `<360 compact`，`<480 standard`，`<600 large`，`<840 expanded`，否则 `tablet` |
| `heightClass` | `<520 compact`，`<720 short`，否则 `regular` |
| `viewportClass` | `landscape && height < 520` 为 `compact-landscape` |
| `viewportClass` | 否则 `width >= 840` 为 `tablet-expanded` |
| `viewportClass` | 否则 `width >= 600` 为 `expanded-width` |
| `viewportClass` | 否则 portrait 下按 `large-portrait` / `standard-portrait` / `compact-portrait` |

demo runtime 尺寸变量：

| viewport class | demo 变量 |
|---|---|
| 默认 regular | `--fd-runtime-phone-width = min(390px, 100vw)`；`--fd-runtime-phone-height = min(844px, 100vh)` |
| `expanded-width` | phone/flow width `min(560px, calc(100vw - 40px))` |
| `tablet-expanded` | phone/flow width `min(760px, calc(100vw - 64px))`，height `min(960px, calc(100vh - 68px))` |
| `compact-landscape` source/settings 特定场景 | 可铺满 `100vw / 100vh` |

HarmonyOS 必须翻译成 ArkUI-native `ReaderAdaptiveState`，但触发语义不能改写。2026-07-03 修复状态：

| 编号 | 当前 ArkUI | demo 规则 | 结论 |
|---|---|---|---|
| A-01 | 保留平台 `widthClass`，新增 `demoWidthClass` 和 `demoViewportClass` | demo 明确有 `<360 compact`、`<480 standard`、`<600 large`、`<840 expanded`、`tablet` | 已修复：平台分支和 demo 分支分开，避免互相污染 |
| A-02 | `heightClass` 已增加 `shortHeight`，同时新增 `demoHeightClass` | demo 有 `<520 compact`、`<720 short`、`regular` | 已修复：`compact-landscape` / keyboard / panel 可按 demo 高度语义继续扩展 |
| A-03 | `sourceSwitchUsesFlowLayout()` 已改为读取 `demoViewportClass` | demo 只有 `tablet-expanded` 或 `compact-landscape` 使用 source-switch 三槽 | 已修复：等价于 `width >= 840 || (landscape && height < 520)` |
| A-04 | 文档已把 `1320x2856/560dpi`、`2560x1600/360dpi` 改成代表样本 | demo 只认 viewport class；设备只是代表样本 | 已修复文档口径；真实设备截图仍按 viewport class 补证据 |

## 3. Shell 与 route 归属

demo Shell slot：

| Shell | 固定 slot | 用途 |
|---|---|---|
| `MainTabShell` | `appFrame`、`statusBar`、`appTopBar`、`contentRegion`、`stateHost`、`mainNav` | 书架、发现、RSS、设置主 Tab |
| `LibraryShell` | `stackFrame`、`statusBar`、`backTopBar`、`contentRegion`、`bottomActionHost`、`sheetHost`、`dialogHost`、`stateHost` | 书架/RSS 二级链路 |
| `ReaderShell` | `readerFrame`、`readingSurface`、`readerOverlayHost`、`bottomSheetHost`、`readerModuleNav`、`readerStateHost` | 阅读沉浸、控制层、模块、full/utility |
| `SettingsShell` | `settingsFrame`、`settingsContent`、`bottomActionHost`、`sheetHost`、`toastHost`、`dialogHost`、`settingsStateHost` | 设置与书源管理链路 |
| `FlowShell` | `flowFrame`、`stepRegion`、`comparisonRegion`、`resultRegion`、`stateHost` | 横向流程，当前关键是 `source-switch` |

主 Tab 严格只有四个：

```text
书架 / 发现 / RSS / 设置
```

不能成为主 Tab 的页面：

| 页面 | demo route shell |
|---|---|
| 搜索 | `book-search` 为 `LibraryShell`，`content-search` 为 `ReaderShell` |
| 阅读页 | `immersive-reading` / `reader` / `reader-*` 为 `ReaderShell` |
| 书源管理 | `source-management` / `source-*` 为 `SettingsShell` |
| 换源 | `source-switch` 为 `FlowShell` |

当前 ArkUI 主 Tab 数量是对的：`MainTabShell.ets` 只渲染 `bookshelf / discover / rss / settings`。但 nav rail 的触发要按 demo `tablet-expanded` 语义复核，不能用当前 `large` 或 landscape 抽象替代。

## 4. 书架到沉浸阅读

demo 结构：

```text
mainTabBookshelf
  ContinueCard
    button.fd-continue-cover-button[data-book-cover][data-route="immersive-reading"]
    button.fd-continue-action-button[data-route="immersive-reading"]
  BookshelfShelfSection
    BookGrid
      BookCard / BookListRow
```

demo 交互：

| 入口 | Motion ID | route 结果 | 约束 |
|---|---|---|---|
| 封面 | `reader.entry.coverToImmersive` | push `immersive-reading` | 默认不打开控制层；返回栈保留来源 |
| 继续阅读 / 阅读按钮 | `reader.entry.actionToImmersive` 或 route handoff | push `immersive-reading` | 无 shared element 时轻量进入 |
| 长按封面 | `book-focus` 类 overlay | 不进入阅读 | focus layer 不应污染 route stack |

当前 ArkUI 对齐情况：

| 项 | 状态 |
|---|---|
| 封面和继续阅读入口 | 已有 `BookshelfTab.openBook(..., cover/action)` 到 reducer |
| 最终沉浸态 | 已有 `ReaderUiReducer.enterReader(...)`，进入后 `readerMode=immersive` |
| 返回来源页 | reducer 有 route stack，但仍要用设备录屏验证视觉和栈一致 |
| 连续点击只保留最后目标 | reducer 有 interrupt 字段，仍需加入专项测试或设备脚本 |
| 书架视觉 | 仍未严格按 demo `mainTabBookshelf()` + CSS 逐项复刻，属于 P1 后续 |

## 5. ReaderShell 分层

demo ReaderShell 的稳定结构：

```text
ReaderShell
  readingSurface
    sharedReaderSurface
      fd-ir-background-layer
      fd-ir-reading-layer
      fd-reader-brightness-dim
      fd-reader-dismiss-zone（仅非沉浸态）
  readerOverlayHost
    immersive: info layer + text selection layer + tap zones
    non-immersive: top overlay + session control space
    bottomSheetHost
    readerModuleNav
  readerStateHost
```

Reader route state：

| route | demo state |
|---|---|
| `immersive-reading` | `mode=immersive` |
| `reader` | `mode=control` |
| `toc-bookmarks` | `mode=module`，`module=directory` |
| `tts` | `mode=module`，`module=tts` |
| `reader-appearance` | `mode=module`，`module=appearance` |
| `reader-settings` | `mode=module`，`module=settings` |
| `content-search` | `mode=quick`，`quick=search` |
| `auto-page` | `mode=quick`，`quick=auto-page` |
| `content-replacement` | `mode=quick`，`quick=replace` |

Reader surface 源码规则：

| 层 | demo 源码 / CSS | ArkUI 当前状态 | 偏差 |
|---|---|---|---|
| background | `.fd-ir-background-layer` 绝对 `inset:0`，纸张渐变/纹理 | `ReaderSharedSurface.ReadingBackgroundLayer()` | 颜色近似；纹理/渐变未完整实现 |
| reading layer | `.fd-ir-reading-layer` 绝对 `inset: top side bottom` | `ReaderSharedSurface.ReadingTextLayer()` 用 `padding` 近似 | phone 近似；wide/dock/source-switch 需按 slot inset 重新计算 |
| 标题 | 只在 page index `0` 输出；去掉 `第 N 章` 前缀 | 已按 pageIndex 控制 | 真实分页未接 |
| 正文 | `18px`、line-height `1.96`、段距 `16`、首行缩进 `2em` | token 基本对齐 | 字体和 textIndent 需真机确认 |
| brightness dim | readingSurface 内 dim + stateHost 全局 dim | ArkUI 有 dim | 需要统一 dim 层级和 source-switch slot 下的 dim |
| dismiss zone | 非沉浸态才有，有边界 `left/right 24 top 92 bottom 360` | 当前已做有界 zone | 需要保持不覆盖顶栏、sheet、nav |

## 6. 沉浸阅读层

demo 沉浸态只有：

```text
sharedReaderSurface
readerInfoOverlay
readerTextSelectionLayer（仅打开时）
readerTapZones
```

不能自动显示：

```text
ReaderTopBar
BottomSheetHost
BrightnessRail
ReaderModuleNav
SourceSwitchWindow
MoreMenu
```

demo 关键位置：

| 元素 | demo 值 |
|---|---|
| info layer | `inset: 26px 24px 22px`，两列三行 |
| info 文本 | `12px`，line-height `1.2`，单行省略 |
| tap zones | prev / center / next 三按钮，center 打开 `reader` |
| session capsule | footer 右侧；autoPage 宽 `96`，tts 宽 `94`，高 `24` |

当前 ArkUI：

| 项 | 状态 |
|---|---|
| info layer | 基本对齐 |
| tap zones | 已按 26/48/26 写入，并有 prev/next/cener 行为 |
| text selection | 仅长按 seam，工具栏结构未完整实现 |
| session capsule | 有沉浸胶囊和控制层胶囊，但业务生命周期未完整接 Host |

## 7. Reader 控制层

demo 非沉浸控制层组成：

```text
readerTopOverlay
readerSessionControlSpaceHtml（有运行会话时）
readerBottomSheetHtml
  fd-reader-grabber
  body: control main / quick panel / module panel / loading panel
  readerBrightnessRail
readerModuleNavHtml
```

顶栏 demo 规则：

| 项 | demo 值 |
|---|---|
| 位置 | top `18`，left/right `14`；tablet-expanded left/right `28`；compact-landscape top `12` |
| 高度 | min-height `54`；compact-landscape `48` |
| columns | portrait `44px 1fr 62px 34px`；compact-landscape `40px 1fr 58px 32px` |
| 标题 | `data.reader.title`，`16px`，最多 2 行 |
| 副标题 | `data.reader.sourceLine`，`12px`，最多 2 行 |
| 按钮 | min-height `42`，font `12px`，weight `800` |
| 换源按钮 | icon + `换源` 文本，进入 `source-switch` route |

底部控制 demo 规则：

| 元素 | demo 值 |
|---|---|
| sheet | left/right `12`，bottom `18`，height `330`，radius `24` |
| grabber | top `9`，width `42`，height `4`，left `calc(50% - 26px)` |
| control main | left `12`，right `12 + railWidth + railGap`，top `28`，bottom `110` |
| actions | 3 列；gap `8`；padding `9 8`；button 字号 `11` weight `800` |
| chapter row | columns `34 / 1fr / 34`，min-height `52`；title `13 / 1.25` |
| progress row | label `9px`，track height `5`，thumb `12` |
| brightness rail | right `12`，top/bottom 同 control main；width `38`；track `8 x 92`；auto 按钮 `A` |
| module nav | left/right `24`，bottom `32`，min-height `78`；4 列 |

当前 ArkUI：

| 编号 | 当前状态 | 结论 |
|---|---|---|
| C-01 | `ReaderControlLayer.ets` 已承载顶栏、sheet、rail、module、source-switch | P1：组件过大，后续必须拆 slot/token |
| C-02 | sheet / rail / nav 几何大多在 helper 方法中，但 token 分散 | P1：抽 `ReaderLayoutSlots.ets` |
| C-03 | 颜色和边框多处硬编码 | P1：抽 `ReaderVisualTokens.ets` |
| C-04 | 顶栏 `sourceLine` 没有真实字段 | P1：未接 Host 数据前只能标注 fixture/derived |
| C-05 | 文本选择层、TTS 当前句、真实目录/搜索/替换仍未完成 | P2：不阻塞 first vertical slice，但不能宣称完成 |

## 8. source-switch 是 FlowShell，不是普通 overlay

demo `source-switch` 源码：

```text
renderFlowShell
  frameClass: fd-flow-frame fd-source-phone-flow fd-source-reader-continuation
  stepClass: fd-flow-step fd-source-continuity-slot
  comparisonClass: fd-flow-comparison fd-source-window-slot
  resultClass: fd-flow-result fd-source-result-slot
```

step slot 内容：

```text
fd-source-reader-continuity fd-source-control-continuity
  sharedReaderSurface(disableTurnAnimation=true)
  fd-source-control-overlay
    readerTopOverlay
    fd-reader-sheet fd-source-control-sheet
      readerBottomSheetHtml(reader)
    nav.fd-reader-module-nav fd-source-control-nav
      readerModuleNavHtml
```

comparison slot 内容：

```text
fd-source-switch-window
  fd-source-window-info
    source-switch icon
    strong 换源
    span 按延迟排序
    close icon button
  fd-source-candidate-list
```

result slot 内容：

```text
fd-source-switch-result
  check icon
  selected source
  selected.state · selected.speed/latency · selected.latestChapter
  说明文字
  确认换源
```

phone 默认结构：

| 元素 | demo 值 |
|---|---|
| frame | `fd-source-phone-flow` 单列，width/height 为 runtime phone |
| continuity slot | absolute `inset:0`，pointer-events none |
| window slot | absolute `left/right 12`，`top 92`，`bottom 360`，z-index `6` |
| result slot | `display:none` |
| source window | padding `7 9`，header min-height `32`，header columns `20 / 1fr / auto / 24` |

`tablet-expanded` / `compact-landscape` 结构：

| 元素 | demo 值 |
|---|---|
| frame | width `--fd-runtime-flow-width` |
| layout | grid columns `minmax(300px,1fr) minmax(260px,300px) minmax(160px,200px)` |
| areas | `"reader window result"` |
| gap / padding | `12 / 12` |
| all slots | relative，display block，grid-area 分别为 reader/window/result |
| reader topbar | tablet top `18`；compact-landscape top `12` |
| reader nav | tablet top `112`；compact-landscape top `74` |
| reader reading layer | tablet inset `206 24 260`；compact-landscape inset `136 24 48` |
| reader sheet | right `12`，bottom `18`，width `min(340px, calc(100% - 24px))`，height tablet `230` / landscape `196` |

当前 ArkUI 修复状态：

| 编号 | 当前代码 | demo 要求 | 结论 |
|---|---|---|---|
| S-01 | `ReaderAdaptive.sourceSwitchUsesFlowLayout()` 已按 `demoViewportClass` 触发 | 只由 `tablet-expanded` 或 `compact-landscape` 触发 | 已修复 |
| S-02 | `SourceSwitchReaderSlot()`、`ControlTopBar()`、`SourceSwitchReaderDock()` 已共享 reader slot 原点和高度 | reader slot 是完整 grid cell，内部再控制 top/nav/sheet/reading inset | 已修复 |
| S-03 | `SourceSwitchFlowShell()` 用 Stack 手算 x/y | demo 是三槽 grid，slot 先占位，再在 slot 内定位内容 | P1：可用 ArkUI Stack/Row 实现，但必须语义等价 |
| S-04 | `ReaderSurface` 在 source-switch FlowShell 打开时不再渲染全局 `ReaderSharedSurface`，由 `SourceSwitchReaderSlot()` 承载 reader continuity | demo 的 source-switch FlowShell 自己承载 reader continuity | 源码结构已修复；真实横屏/平板设备 z-order 证据仍待补 |
| S-05 | result slot 已有本地结果，但真实书源切换未接 | demo 只是 proof，Host 仍需业务数据 | P2 |
| S-06 | `ReaderControlLayout.ets` 已集中 FlowShell 三槽几何 | demo CSS 值通过 ArkUI token adapter 使用 | 已补 headless 几何断言；仍需设备截图/录屏验证 |

## 9. 共用结构和交互变化矩阵

| 共用结构 | 使用页面 / route | 哪些交互会改变它 | demo 约束 |
|---|---|---|---|
| MainTabShell | `bookshelf`、`discover`、`rss`、`settings` 和部分 MainTabShell 子状态 | `app.tab.switch` 只换 activeTab/content，不 push 二级 route 作为 Tab | main nav 尺寸稳定 |
| ReaderShell readingSurface | 所有 ReaderShell route | 翻页、亮度、主题、字号、session 高亮 | 控制层/模块切换不能重建正文上下文 |
| Reader overlay host | `immersive-reading` / 非沉浸 reader routes | 中间热区、dismiss、more、text selection | 沉浸和控制层是同一 ReaderShell 的不同 overlay 状态 |
| BottomSheetHost | `reader`、quick、module | quick/module/setting/dropdown/grabber | sheet 外框稳定，内部 body 替换 |
| BrightnessRail | 非沉浸 compact 控制层和 quick/module | brightness track/auto、quick route bottom | 固定在右侧 rail，不是章节栏一部分 |
| ReaderModuleNav | 非沉浸 control/module | `reader.module.switch` | nav 几何不动，只改 active 和 sheet body |
| Session capsule | 沉浸 footer / 控制层上方 | TTS/autoPage start/toggle/switch/stop | 同一 activeSession 互斥，不能同时显示两套主控 |
| FlowShell source-switch | `source-switch` | open/close/select/confirm、viewportClass 切换 | 返回栈不残留 `source-switch`，阅读控制面 continuity 保留 |

## 10. Motion 与最终状态

必须继续对齐的 Motion ID：

| Motion ID | demo 语义 | ArkUI 要求 |
|---|---|---|
| `tab.item.press/select/switch` | Tab 按压、选中、切换；不推动布局 | 主 Tab 和 ReaderModuleNav 分开处理 |
| `app.tab.switch` | 主 Tab 原地切换 | 不做二级 route push |
| `app.route.push/pop/replace` | 原生导航栈 push/pop/replace | 视觉页面和 backStack 一致 |
| `reader.entry.coverToImmersive` | 书架封面进入沉浸 | 最终 `immersive-reading`，不打开控制层 |
| `reader.entry.actionToImmersive` | 继续阅读/按钮进入沉浸 | 无封面 shared element 时轻量 handoff |
| `reader.module.switch` | 目录/朗读/外观/设置切换 | nav 几何不变，只换 body |
| `dropdown.menu.expand/collapse/reposition` | TTS/设置/筛选等 anchored menu | 同层只允许一个 open，键盘/方向变化要重算 |
| `reader.session.*` | autoPage/TTS 互斥、胶囊进入/更新/切换/退出 | activeSession 单一来源 |
| `reader.sourceSwitch.open/close` | Reader 交互平面内打开/关闭换源 | 无全屏变暗，返回栈不残留 |

reduced-motion：

| 场景 | demo 规则 |
|---|---|
| reader entry | 可即时或短 feedback，不保留长位移 |
| Tab / route | 布局不动，缩短或取消动效 |
| session capsule | 禁用循环 pulse，内部状态仍可即时更新 |
| source-switch | 保持最终状态正确，不能用 reduced-motion 跳过 reducer |

## 11. 当前修复清单

P0 已修复：

| 编号 | 修复项 | 落点 |
|---|---|---|
| P0-01 | 增加 demo viewport class 等价推导，至少覆盖 `compact-landscape`、`tablet-expanded`、`expanded-width`、portrait 三类 | 已落到 `ReaderAdaptive.ets` |
| P0-02 | `sourceSwitchUsesFlowLayout()` 改为 demo 条件：`width >= 840 || (orientation=landscape && height < 520)` | 已落到 `ReaderAdaptive.ets` |
| P0-03 | `SourceSwitchReaderSlot()` 变成完整 reader slot；不要用 window slot 的 top/height 裁掉 reader slot | 已落到 `ReaderControlLayer.ets` |
| P0-04 | 清理旧文档中把代表机型写成实现边界的表述；后续按 viewport class 验收 | 已落到 docs |
| P0-05 | 确认 `source-switch` close/confirm 都是 replace/pop 语义，返回栈不残留 `source-switch` | 已有 `ReaderUiState.ets` + tests 覆盖 |

P1：

| 编号 | 修复项 | 落点 |
|---|---|---|
| P1-01 | 抽 `ReaderLayoutSlots.ets`，集中计算 topbar/sheet/nav/rail/source-switch slot | 部分完成：已新增 `ReaderControlLayout.ets`，覆盖 topbar/sheet/nav/rail/source-switch slot、动作区、章节区、dropdown、更多菜单、full/utility host、session/controlSpace 胶囊 |
| P1-02 | 抽 `ReaderVisualTokens.ets`，承接 demo 的控制层颜色、边框、阴影、圆角 | ui layer |
| P1-03 | 拆 `ReaderControlLayer.ets` 为顶栏、sheet、rail、module nav、source-switch、session capsule 子组件 | components |
| P1-04 | 书架页按 `mainTabBookshelf()` 和 CSS 逐项校准 cover/grid/title/author/progress/filter/focus layer | `BookshelfTab.ets` |
| P1-05 | Reader 模块面板按 `readerModulePanel()` 补齐目录/TTS/外观/设置的文本层级、dropdown anchor、drop-up | `ReaderControlLayer` 子组件 |
| P1-06 | `sourceLine`、章节、正文、候选 source 文案来源标注清楚，未接真实 Host 数据时不能伪装已接 | state/context |

P2：

| 编号 | 修复项 |
|---|---|
| P2-01 | 真实业务数据：书架、章节、目录、搜索、替换、书源切换 |
| P2-02 | fold posture / hinge / 多窗 |
| P2-03 | 键盘安全区真实事件 |
| P2-04 | 无障碍完整验收 |
| P2-05 | 性能工具和滚动/动画 profiling |

## 12. 后续执行规则

1. 每次 UI 修改必须先写明对应 demo 源码函数和 CSS 规则。
2. 不允许再从截图裁位置；截图只检查最终视觉。
3. 不允许把 DOM、CSS selector、`data-*` 当作 ArkUI 接口；只能把结构语义、slot、token、状态、motion 映射到原生组件。
4. 设备证据按 viewport class 收集：phone portrait、expanded-width、tablet-expanded、compact-landscape。具体物理分辨率只是代表样本。
5. 主 Tab 永远只保留书架 / 发现 / RSS / 设置。
6. 阅读页、搜索、书源管理不进入主 Tab。
7. 书架进入阅读后的最终状态必须是 `immersive-reading`，不自动打开控制层。
8. source-switch 必须作为 FlowShell continuity，不得改成全屏 modal 或普通顶栏 dropdown。
