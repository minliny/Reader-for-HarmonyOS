# Reader UI demo 到 HarmonyOS ArkUI 当前差距审计

审计日期：2026-07-03

本审计只做校对和落差归档，不做界面代码修改。结论基于当前磁盘上的规范 demo 和当前 HarmonyOS ArkUI 实现，不沿用截图记忆，也不把 Web DOM / CSS selector / `data-*` 当作 HarmonyOS 实现接口。

最新源码基准以 `docs/architecture/HARMONYOS_READER_CANONICAL_DEMO_SOURCE_AUDIT.md` 为准。本文件中“已完成”只表示当时阶段性 ArkUI 修复记录，不等于已经通过当前 canonical demo 的全量结构和样式对齐。

## 1. 审计结论

当前 HarmonyOS 侧已经有原生 ArkUI Reader vertical slice 的基础结构：四主 Tab、书架进入沉浸阅读、ReaderSurface、ReaderControlLayer、motion token adapter、单一 UI state / reducer、部分自适应断点都已经存在。

但 Reader 页面族还没有达到“按 demo 结构开发”的标准。当前主要问题不是没有写 ArkUI，而是有多处结构关系、命中区域、route-specific layout、文字层级和交互状态没有从 `frontend-demo/render-runtime.js` 与 CSS 中系统转译，导致实现继续按截图局部修补会很慢。

本轮审计得到的改动规模：

| 等级 | 数量 | 含义 |
|---|---:|---|
| P0 | 8 | 结构/命中/状态关系错误，会直接导致控制层行为或视觉层级不可信 |
| P1 | 17 | 几何、文字、面板结构或交互未对齐，会导致 demo 对比明显偏差 |
| P2 | 9 | 自适应、完整模块、真实业务态和平台专项，首批 slice 可预留但不能宣称完成 |

下一步应该先修 P0，再按 P1 做页面族结构收敛。不要继续“截一张改一块”。

本轮修复状态：

| 等级 | 状态 |
|---|---|
| P0 | 已完成首轮代码修复：关闭热区、沉浸热区、quick bottom、小横条偏移、亮度轨道手势、章节/进度交互、换源 phone continuity 骨架、文本来源边界均已落地到 ArkUI / reducer |
| P1 | 已完成可低风险落地项：顶栏两行文本结构、顶栏文字按当前 demo 源码回到 `16/12/gap 6`、正文标题两行、圆角 token、模块导航圆角、session capsule 尺寸、快捷动作文案、搜索/替换 quick panel 第一版源码结构骨架、目录/朗读/界面/设置 compact module 第一版结构骨架、full/utility 独立容器和内容骨架 |
| P2 | 仍保持未完成：真实业务数据、source-switch ReadingSurface 归槽、phone portrait 与 tablet-expanded / compact-landscape 设备视觉验收、fold posture、键盘安全区、无障碍、性能和多设备录屏 |

## 2. 输入来源

规范 demo 来源：

- `/Users/minliny/Documents/Reader UI/frontend-demo/render-runtime.js`
  - `readerStateByRoute`
  - `sharedReaderSurface(...)`
  - `readerInfoOverlay(...)`
  - `readerTapZones(...)`
  - `readerTopOverlay(...)`
  - `readerModuleNavHtml(...)`
  - `readerBrightnessRail(...)`
  - `readerControlMain(...)`
  - `readerBottomSheetHtml(...)`
  - `readerFullPageScreen(...)`
  - `readerStateScreen(...)`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/00-foundation.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/01-shell-layout.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/02-main-library.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/03-reader.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/04-settings-source.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/MOTION_CONTRACT.md`
- `/Users/minliny/Documents/Reader UI/frontend-demo/MOTION_EFFECTS.md`
- `/Users/minliny/Documents/Reader UI/frontend-demo/route-contract.js`

当前 HarmonyOS 对照来源：

- `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/components/ReaderSurface.ets`
- `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/components/ReaderControlLayer.ets`
- `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/ReaderUiState.ets`
- `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/ReaderRouteMapping.ets`
- `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/ReaderMotion.ets`
- `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/ReaderAdaptive.ets`
- `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/ReaderTypography.ets`
- `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/resources/base/media/reader_icon_*.svg`

已有中文文档仍有效，但不够作为当前修复清单：

- `docs/architecture/HARMONYOS_READER_DEMO_STRUCTURE_REAUDIT.md`
- `docs/architecture/HARMONYOS_READER_DEMO_LAYOUT_RELATIONSHIP_AUDIT.md`
- `docs/architecture/HARMONYOS_READER_SHARED_STRUCTURE_INTERACTION_MATRIX.md`
- `docs/architecture/HARMONYOS_READER_TEXT_TYPOGRAPHY_AUDIT.md`

本文件补的是“当前 ArkUI 到当前 demo 的差距表”。

## 3. demo 结构源头

demo 的 ReaderShell 不是一个单独控制层，而是稳定 slot 组合：

```text
ReaderShell
  ReadingSurface
    ReadingBackground
    ReadingTextLayer
    BrightnessDim
    ControlDismissZone（非沉浸态）
  ReaderOverlayHost
    沉浸态：ImmersiveInfoLayer + TextSelectionLayer + ImmersiveTapZones
    非沉浸态：ReaderTopBar + MoreMenu + ReaderControlSessionHost
  BottomSheetHost
    Grabber
    BottomControlPanel / ReaderQuickPanel / ReaderModulePanel / LoadingPanel
    BrightnessRail
  ReaderModuleNav
  ReaderStateHost
```

必须保持的结构关系：

- `ReadingSurface` 是所有 ReaderShell route 的共用正文底层，控制层、模块、快捷、full panel 都不能重建为另一套页面。
- `BottomSheetHost` 与 `ReaderModuleNav` 是同级 dock 结构，模块导航不是 sheet 主体的一部分。
- `BrightnessRail` 是 `BottomSheetHost` 内右侧固定竖向 rail，不属于章节栏，也不是普通设置行。
- 沉浸态没有 `ReaderTopBar`、`BottomSheetHost`、`BrightnessRail`、`ReaderModuleNav`。
- 非沉浸态显示 `ReaderTopBar`、`BottomSheetHost`、`BrightnessRail`、`ReaderModuleNav`。
- full / utility route 保留 `ReadingSurface` 和 `ReaderTopBar`，但隐藏 `BrightnessRail` 与 `ReaderModuleNav`。

## 4. route / state 对齐审计

| route / 状态 | demo 语义 | 当前 ArkUI 状态 | 结论 |
|---|---|---|---|
| `immersive-reading` | `mode=immersive`，正文 + 信息层 + 点击热区 | `ReaderMode.immersive` 已存在 | 基础对齐，但热区比例和左右翻页行为不对 |
| `reader` | `mode=control`，顶栏 + 控制主面板 + 亮度 Rail + 模块导航 | `ReaderMode.control` 已存在 | 基础对齐，但 dismiss zone、grabber、rail、部分文字不对 |
| `toc-bookmarks` | `mode=module/directory` | `ReaderMode.module` + `ReaderModuleType.directory` | 路由对齐，模块内容骨架不完整 |
| `tts` | `mode=module/tts` | 已存在 | 路由对齐；toolbar、播放控制、四个 option row 和 dropdown 状态机已按 demo 源码落第一版，真实 TTS 引擎和当前句高亮未接 |
| `reader-appearance` | `mode=module/appearance` | 已存在 | 路由对齐，主题色块/排版控件缺失 |
| `reader-settings` | `mode=module/settings` | 已存在 | 路由对齐，设置项数量和层级不足 |
| `content-search` | `mode=quick/search` | 已存在 | 路由对齐，quick panel 几何和内容结构不足 |
| `auto-page` | `mode=quick/auto-page` | 已存在 | 路由对齐，但 portrait bottom/rail 高度和启动状态需修 |
| `content-replacement` | `mode=quick/replace` | 已存在 | 路由对齐，规则来源仍是占位 |
| `reader-full-*` | full host | 已存在 full route 和 full 容器 | 已按 demo 的 full head/content/section 建立第一版独立骨架；真实数据和完整控件仍未完成 |
| `reader-book-cache` / `reader-debug-info` | utility full host | 已存在 utility route 和 utility 容器 | 已按 demo 的 summary/action-grid/list/log 建立第一版骨架；真实缓存/调试数据未接 |
| `source-switch` | FlowShell continuity，不是 Reader quick panel，也不是顶栏下拉菜单 | 当前已有 phone overlay 和 tablet / landscape 三槽 ArkUI FlowShell 骨架，保留阅读顶栏和控制栏 continuity 背景 | no-op 已修复；reader/window/result slot 已落地；ReadingSurface 归槽、真实确认换源和多设备视觉验收仍未完成 |

单一 state / reducer 已覆盖的字段：

- `activeTab`
- `route` / `currentRoute`
- `routeStack` / `backStack`
- `ReaderContext`
- `readerPresentationRoute`
- `readerMode`
- `activeReaderModule`
- `activeQuickPanel`
- `overlayState`
- `activeSession`
- `asyncResult`
- `focusState`
- `motion` / `motionInterrupt`
- `reducedMotion`
- `adaptive`

状态层不是当前最大的阻塞。当前阻塞主要在 ArkUI 组件结构、命中区域、面板内容和 layout token 转译。

## 5. P0 必改项

| 编号 | 结构 | demo 约束 | 当前 ArkUI | 必须修复 |
|---|---|---|---|---|
| P0-01 | 非沉浸关闭热区 | `fd-reader-dismiss-zone` 只覆盖正文中部：left/right `24`、top `92`、bottom `360`、min-height `160` | `ControlDismissZone()` 是全屏 `Column`，`HitTestMode.Block` | 改成有边界正文关闭区，不得挡住顶栏、sheet、module nav、more menu |
| P0-02 | 沉浸点击热区 | 左 26%、中 48%、右 26%；左/右负责上一页/下一页，中间打开控制层 | `ImmersiveTapZones()` 三个 `layoutWeight(1)`，左/右无行为 | 改成 26/48/26，并补齐 page prev/next action 与禁用态 |
| P0-03 | quick panel 竖向边界 | portrait 下 `auto-page`、`content-search`、`content-replacement` 的面板和 brightness rail bottom 为 `104`；普通 control bottom 为 `110`；quick mode 默认变量 `12` 还被 route-specific CSS 覆盖 | `sheetBodyBottom()` 对所有 quick 返回 `12`，brightness rail 高度随之过高 | 引入 route-aware quick bottom：portrait quick panel 与 brightness rail 使用 `104`，不要把 Rail 拉到模块导航底部 |
| P0-04 | 小横条位置 | compact sheet grabber top `9`、width `42`、height `4`，left `calc(50% - 26px)`，为右侧 Rail 留视觉偏移 | `SheetGrabber()` 在 sheet 宽度正中 | 改成带 rail offset 的横向定位，不能继续居中 |
| P0-05 | 亮度 Rail 交互 | `i[data-reader-brightness-track]` 是 vertical slider，支持拖动/键盘值；自动按钮只负责 auto toggle | 轨道只有视觉，没有 onClick / drag；只有 `A` 按钮可切自动 | 实现本地 ArkUI vertical slider 或 gesture，更新 `readerBrightness.value` 和 dim |
| P0-06 | 顶栏换源 | `readerTopOverlay` 的换源按钮进入 `source-switch` FlowShell continuity；手机 window slot 为 left/right `12`、top `92`、bottom `360`；宽屏为 reader/window/result 三槽 | 已从 214vp 顶部小浮层改为手机比例 `source-switch-window`，并建立宽屏三槽 ArkUI FlowShell 骨架 | phone 槽位和宽屏三槽骨架已修；ReadingSurface 归槽、真实确认换源和多设备视觉验收仍未完成 |
| P0-07 | 章节进度交互 | 上一章/下一章与进度 slider 更新章节/page/progress，不改变 shell | `ChapterStepButton` 没有 onPress；progress 只是静态视觉 | 补 chapter jump / progress drag 的 action seam，真实数据未接入时也要能解释最终 state |
| P0-08 | 文本来源边界 | 正文、标题、章节、来源从 ReaderContext / demo contract 字段映射；不能为了截图改写文本内容 | 部分快捷/模块/full/utility 面板仍有占位文案和伪数据 | 区分 demo 文案、fixture 占位和真实业务字段；首批只保留必要占位并标注未接真实数据 |

## 6. P1 几何和视觉差距

| 编号 | 区域 | demo 值 / 关系 | 当前差距 |
|---|---|---|---|
| P1-01 | 顶栏圆角 | `--fd-radius-xl = 24px` | 当前 `ControlTopBar`、`ReaderBottomSheetHost` 多处使用 `18`，需要统一 token |
| P1-02 | 顶栏文本行数 | `strong`、`small` 都是两行 clamp，标题列左对齐 | 当前 title/subtitle 都 `maxLines(1)`，长标题和长来源会过早截断 |
| P1-03 | 顶栏副标题语义 | demo topbar small 来自 `data.reader.sourceLine` | 当前拼 `chapterTitle · sourceId`；需要按最新 demo 字段重新映射，避免再次误改文本 |
| P1-04 | 顶栏按钮热区 | 返回、换源、更多统一 42 高度，列宽 `44 / 62 / 34` 稳定 | 基础尺寸接近，但需在真实布局树验证每列高度一致、标题起点对齐返回列右侧 gap |
| P1-05 | ReadingTextLayer | portrait inset `72 / 32 / 48`，正文层绝对定位 | 当前用 `Column` 高度 100% + padding，portrait 近似；wide/dock 模式需要按 demo inset 和右侧避让重算 |
| P1-06 | 正文标题 | h1 字号 `fontSize + 5`，line-height `1.25`，bottom `24`，不属于顶栏 | 当前 token 大体对齐，但 `maxLines(1)` 可能导致章节标题错误截断 |
| P1-07 | 正文段落 | `18`、line-height `1.96`、段距 `16`、首行缩进 `2em` | 当前 token 基本对齐；仍需真机确认 `Text.textIndent` 行为 |
| P1-08 | BottomSheetHost | phone left/right `12`、bottom `18`、height `330`、radius `24` | 位置高度接近，圆角不对 |
| P1-09 | ControlMain 区域 | left `12`，right `12 + railWidth + railGap`，top `28`，bottom `110` | 当前通过 padding 实现，语义接近；需改为明确 frame/token，避免子组件流式挤压 |
| P1-10 | 快捷动作文案 | demo 三按钮：搜索、自动翻页、内容替换 | 当前第三按钮显示 `替换`，应恢复 `内容替换` 或使用 demo 最新 label |
| P1-11 | ChapterPanel | row `34 / 1fr / 34`，min-height `52`，title `13 / 1.25` | 基础尺寸接近；缺点击、禁用和真实章节总数来源 |
| P1-12 | Session capsule | autoPage 宽 `96`，grid `18 / 1fr / 16`，countdown `18 x 16`、font `8`；controls `16 x 16` | 沉浸胶囊较接近；控制层胶囊 countdown 是 `16 x 16`、font `10`，不一致 |
| P1-13 | MoreMenu | `ReaderTopBar` 同层浮层，不改变 route，不影响 sheet/nav | 当前有透明全屏 backdrop；视觉上接近，但需要确认不再出现可见蒙版和命中遮挡 |
| P1-14 | ModuleNav | left/right `24`、bottom `32`、min-height `78`、radius `12`、icon shell `42` | 几何接近；当前 radius `16`，compact landscape token 也需校准 |
| P1-15 | BrightnessRail 外观 | right `12`、width `38`、top/bottom 与 panel 同源；track `8 x 92`；auto `24 x 20` | 普通 control 接近；quick route 高度错误；icon 和 auto 按钮需按资源验收 |
| P1-16 | full / utility host | top `88`、bottom `18`、panel rows `30 / 1fr`、full grabber 独立 | 已改为独立 grabber、head、content scroll 和 route-specific section；仍需按真实数据补完整行为 |
| P1-17 | local icon asset | demo icon 是 proof；HarmonyOS 应使用本地资源或系统图标 | 当前使用 `reader_icon_*.svg` 本地资源，需要逐个和 demo icon 语义核对，不再手画新图标 |

## 7. 文本样式、大小和结构审计

本节补齐文本审计。来源是 `frontend-demo/render-runtime.js` 生成的文本结构和 CSS 中对应的字号、行高、位置关系；ArkUI 侧使用 `ReaderTypography.ets`、`ReaderSurface.ets`、`ReaderControlLayer.ets` 的本地 token 和原生 `Text` 实现。

### 7.1 正文阅读层

| 文本结构 | demo 来源 | demo 样式/位置 | ArkUI 落点 | 本轮状态 |
|---|---|---|---|---|
| 章节标题 | `.fd-ir-reading-layer h1`，只在 page index `0` 输出，并去掉 `第 N 章` 前缀 | 正文框内，居中；字号 `reader-font-size + 5`，默认 `23px`；line-height `1.25`；下边距 `24px` | `ReaderSurface.ReadingTextLayer()`，`ReaderTypography.bodyTitleFontSize=23`，`bodyTitleLineHeight=28.75`，`bodyTitleBottom=24` | 已按 demo 只在第 1 页显示正文标题，并去掉章节序号前缀 |
| 正文段落 | `.fd-ir-reading-layer p` | 正文框内；默认 `18px`；line-height `1.96`；段距 `16px`；首行缩进 `2em`；左对齐 | `ReaderSurface.ReadingTextLayer()`，`readerTypography.fontSize=18`，`lineHeightRatio=1.96`，`paragraphGap=16`，`textIndent=fontSize * paragraphIndent` | token 对齐；仍需真机确认 ArkUI `textIndent` 与 Web 首行缩进视觉差 |
| 正文字体 | `readerTypographyStyle(...)` | `reader-font-family`，默认 serif 语义；letter-spacing `0` | `ReaderTypography.readerFontFamily='Songti SC'` 和 `readerTypography.fontFamily='serif'` | 语义已保留；系统字体可用性仍需真机确认 |
| TTS 当前句 | `.fd-reader-tts-segment.is-tts-current` | 不改正文结构；用前置竖线和小三角标识当前句 | 当前未实现 TTS 段落切片，只保留 session 状态 | 未完成，属于 TTS 控制层后续项 |

### 7.2 沉浸信息层

| 文本结构 | demo 来源 | demo 样式/位置 | ArkUI 落点 | 本轮状态 |
|---|---|---|---|---|
| 左上书名/章节 | `.fd-ir-top-left` | info layer inset `26 / 24 / 22`，两列三行；`12px`，line-height `1.2`，单行省略 | `ImmersiveInfoLayer()`，`immersiveInfoFontSize=12`，`lineHeight=14.4` | 已对齐 |
| 右上时间 | `.fd-ir-top-right` | 右对齐；`12px` | `currentTimeText()` 本地时间 | 已对齐，时间不硬编码 demo 截图 |
| 左下进度 | `.fd-ir-bottom-left` | 底部左对齐；`12px` | `ImmersiveFooterStatusLayer()` 读取 `ReaderContext.progressText` | 已接入进度 reducer |
| 右下页码/胶囊 | `.fd-ir-bottom-right` | 右对齐；有 session 时可跨两列，保留 page label + capsule | `ImmersiveFooterStatusLayer()` + `SessionCapsule()` | 胶囊尺寸基本对齐；TTS/autoPage 真实 session 行为后续继续校准 |

### 7.3 顶部阅读栏文本

| 文本结构 | demo 来源 | demo 样式/位置 | ArkUI 落点 | 本轮状态 |
|---|---|---|---|---|
| 书名标题 | `.fd-reader-top strong` | 顶栏弹性列，左对齐；`16px`；最多 2 行；不挤压返回/换源/更多列；浏览器默认行高约 `1.2` | `ControlTopBar()`，`topBarTitleFontSize=16`，`topBarTitleLineHeight=19.2` | 已按当前 demo 源码回调，标题列保持左对齐 |
| 章节/来源副标题 | `.fd-reader-top small` | 标题下方；demo 为 `data.reader.sourceLine`；`12px`，最多 2 行；标题列 `gap 6px` | `topBarSubtitleText()` 当前用 `chapterTitle · sourceId`，`topBarSubtitleFontSize=12`，`lineHeight=14.4`，`gap=6` | 样式已按当前 demo 源码回调；sourceLine 真实字段未接入前不再造假 |
| 返回按钮 | `.fd-reader-top button:first` | 固定 `44px` 列，最小高 `42px`，图标按钮 | 本地 `reader_icon_back_dark.svg` | 热区保持 44x42 |
| 换源按钮 | `.fd-reader-top button[data-route=source-switch]` | 固定 `62px` 列，`12px` 文本，进入 FlowShell continuity；不是顶栏下拉 | `onOpenPresentation(ReaderRoute.sourceSwitch)` | no-op 已修复；phone source window 和宽屏三槽 FlowShell 骨架已落地，真实确认换源未接 |
| 更多按钮 | `.fd-reader-top button[data-reader-more-toggle]` | 固定 `34px` 列，42 高热区 | 本地 `reader_icon_more_dark.svg` | 已对齐基本热区 |

### 7.4 底部控制层文本

| 文本结构 | demo 来源 | demo 样式/位置 | ArkUI 落点 | 本轮状态 |
|---|---|---|---|---|
| 快捷动作标签 | `.fd-reader-actions button span` | 3 等分按钮；`11px`，weight `800`；标签为 `搜索 / 自动翻页 / 内容替换` | `ControlAction`，`actionLabelFontSize=11` | 已把第三项从 `替换` 改回 `内容替换` |
| 当前章节标题 | `.fd-reader-chapter-row strong` | 章节区中列居中；`13px`，line-height `1.25`，最多 2 行 | `ReaderControlMain()`，`chapterTitleFontSize=13`，line-height `16.25` | 已对齐，按钮点击接入 chapter jump reducer |
| 进度左右文本 | `.fd-reader-book-progress` / `.fd-reader-total-chapters` | progress 左右两端；`9px`，line-height `1` | `progressLabelFontSize=9` | 已接入 progress reducer 和 pan/click seam |
| 亮度自动标签 | `.fd-brightness-auto-toggle` | rail 底部 `24 x 20`，文本 `A` | `FixedBrightnessRail()`，`Text('A')` | 已保留原生文本按钮；轨道已接 pan/click |

### 7.5 胶囊、模块导航和菜单文本

| 文本结构 | demo 来源 | demo 样式/位置 | ArkUI 落点 | 本轮状态 |
|---|---|---|---|---|
| session label | `.fd-ir-status-capsule b` | `10px`，居中，单行省略 | `SessionCapsule()` | 已对齐 |
| autoPage countdown | `.fd-ir-countdown-dot` | `18 x 16`，font `8`，圆形深色底 | 沉浸和控制层 `SessionCountdownDot()` | 控制层已修成 `18 x 16 / 8` |
| session control icon | `.fd-ir-status-controls button` | `16 x 16`，图标 `8 x 8` | 控制层和沉浸层均使用 `16 x 16 / 8` | 已对齐 |
| 模块导航标签 | `.fd-reader-module small` | 图标 shell 下方，`12px`，weight `800`，行高区域 `16px` | `ModuleNavItem()`，`moduleNavLabelFontSize=12` | 基本对齐；圆角已改回 `12` |
| 更多菜单标题 | `.fd-reader-more-menu strong` | 菜单项第一行，`12px`，单行省略 | `MoreMenuItem.title` | 已对齐 |
| 更多菜单说明 | `.fd-reader-more-menu small` | 第二行，`10px` | `MoreMenuItem.detail` | 已对齐 |

### 7.6 仍未完全对齐的文本项

- `reader.sourceLine` 真实字段还没有 Host 数据来源，顶栏副标题暂由 `ReaderContext.chapterTitle/sourceId` 拼接，不能宣称与 demo 数据字段完全一致。
- quick 搜索/替换、compact module 面板、full panel、utility panel 已分别按 `readerQuickActionPanel(...)`、`readerModulePanel(...)`、`readerFullPagePanel(...)`、`readerUtilityPanel(...)` 落下第一版 ArkUI 原生骨架。
- TTS 当前句文本高亮、正文标注、选择工具栏文本结构尚未实现。
- full/utility 页里的缓存容量、目录列表、调试日志已经有结构占位，但仍未接入真实业务数据。

### 7.7 当前 demo 文本源码矩阵

这一节按当前 demo 源码逐项记录文本结构，避免后续继续靠截图猜。

| demo 函数 / CSS | 文本节点 | 样式和结构关系 | ArkUI 当前状态 |
|---|---|---|---|
| `sharedReaderSurface(...)` + `.fd-ir-reading-layer h1` | 章节标题，只在当前分页 index 为 0 时输出，并去掉 `第 N 章` 前缀 | 正文层内居中；`font-size = reader-font-size + 5`；`line-height 1.25`；下边距 `24` | `ReadingTextLayer()` 已按 `readerPagination.pageIndex` 控制显示，并去掉正文标题中的章节序号前缀；真实分页模型仍未接入 |
| `sharedReaderSurface(...)` + `.fd-ir-reading-layer p` | 正文段落 | `18px`、`line-height 1.96`、段距 `16`、首行缩进 `2em`、左对齐 | token 已对齐；真实分页和 TTS segment 未完成 |
| `readerInfoOverlay(...)` + `.fd-ir-info-layer` | 书名/章节、时间、进度、页码 | `12px`、`line-height 1.2`；绝对 inset `26/24/22`；右下有 session 时跨列 | 基本对齐；右下 session 胶囊已接状态 |
| `readerTopOverlay(...)` + `.fd-reader-top` | 返回、书名、sourceLine、换源、更多 | grid `44 / 1fr / 62 / 34`；按钮最小高 `42`；标题列 `gap 6`；strong `16`；small `12` | 结构和 token 已对齐；`sourceLine` 数据字段未接入 |
| `readerMoreMenuHtml(...)` + `.fd-reader-more-menu` | 更多菜单标题/说明 | 菜单宽 `214`；每项 `strong 12`、`small 10`；不改 route | 已对齐基本结构；点击动作仍是首批占位 |
| `readerControlMain(...)` + `.fd-reader-actions` | 搜索、自动翻页、内容替换 | 三等分；按钮 `11px`、weight `800`；图标与文字 `gap 6` | label 已修正；icon 使用本地 SVG 资源 |
| `readerControlMain(...)` + `.fd-reader-chapter-panel` | 当前章节、上一章、下一章、进度、总章数 | 章节 `13px / 1.25`，最多 2 行；进度/总章数 `9px`；row `34 / 1fr / 34` | 已接 chapter/progress reducer；真实章节列表未接 |
| `readerBrightnessRail(...)` + `.fd-brightness-rail` | 自动亮度 `A` | rail 右侧固定；`A` 为 `24 x 20`、`13px`、weight `500` | 已对齐尺寸和轨道手势；亮度 icon 来自本地资源，仍需与 demo icon 做资源级复核 |
| `readerImmersiveStatusCapsule(...)` + `.fd-ir-status-capsule` | `朗读` / `自动翻页` 和倒计时 | capsule `94/96 x 24`；倒计时 `18 x 16 / 8px`；控制按钮 `16 x 16`、图标 `8` | 已对齐尺寸；session 生命周期后续继续补 |
| `readerQuickActionPanel(...)` | quick toolbar、搜索 field、搜索结果、自动翻页控制、替换规则 | toolbar 按钮 `10px`；搜索 field `11px`；搜索结果标题 `11px`、说明 `9px`；自动翻页强按钮 `12/15/18` 混合 | 搜索和替换已落第一版 ArkUI 原生结构；自动翻页已存在；真实搜索/替换数据未接 |
| `readerModulePanel(...)` | 目录/朗读/界面/设置模块文本 | module header `13/8`；list strong `10`、small `8`；segment `9`；目录行与 TTS 行有专门结构 | compact 目录/朗读/界面/设置已落第一版结构骨架；TTS/设置 option dropdown 已按源码 anchor/drop-up 规则落地；真实目录、主题/字体真实写入未接 |
| `readerFullPagePanel(...)` / utility panel | full head、full setting block、cache/debug 文本 | full host 不是普通 quick panel 放大版，有独立 header/content/section | 已建立独立 header/content/section、setting block、choice grid、summary/action/list/log 骨架；真实数据和完整控件未接 |
| `readerTextSelectionLayer(...)` | 复制、划线、笔记、搜索 | selection toolbar `11px`、四等分、位置固定在选区上方 | 未实现 |

## 8. P1 面板结构差距

这些不是首屏沉浸阅读的最低门槛，但会影响控制层截图和后续交互：

| 面板 | demo 结构 | 当前 ArkUI 差距 |
|---|---|---|
| 搜索 quick panel | toolbar 返回 + 搜索按钮、搜索 field、结果列表；结果进入沉浸 | 已落 ArkUI 原生 toolbar、搜索 field、fixture 结果列表和结果点击回沉浸；真实搜索未接 |
| 自动翻页 quick panel | toolbar、上一章/下一章、primary toggle、速度、模式；启动后 replace 到沉浸并显示 session capsule | 结构有基础，但尺寸、portrait bottom、停止态和 session capsule 对齐不足 |
| 内容替换 quick panel | quick toolbar + 规则列表；规则来自 replacement rules | 已落 ArkUI 原生 toolbar + toggle list 容器；真实 replacement rules 未接 |
| 目录模块 | segment 目录/书签 + 当前章节/章节列表/标记 | 已落 segment + 6 行 fixture 目录，当前章节高亮；真实目录/书签未接 |
| 朗读模块 | 播放控制、语速、音色、范围、定时，启动后回沉浸 | 已落 toolbar、停止按钮、传输控制、四项 option row 和面板级 dropdown overlay；真实 TTS 引擎未接 |
| 界面模块 | 主题色块、字号、行距、字体、页面空间 | 已落主题色块、字号/行距、字体选择、页面空间入口；真实主题写入和完整控件未接 |
| 阅读设置模块 | 自动翻页、点击方式、音量键、翻页动画、常亮、状态信息、触摸反馈、缓存等 | 已补齐 demo 中首批设置项结构；真实设置持久化未接 |
| full directory / tts / appearance / settings | full host 内完整模块结构，隐藏 rail/nav | 已脱离 compact 复用，改为 full segment/list/playback/setting-block/choice-grid/toggle-list 骨架；真实目录、TTS、主题、设置写入未接 |
| cache/debug utility | demo 有摘要、动作网格、列表/日志 | 已补 summary card、动作网格、缓存列表、调试状态网格、日志列表和调试动作骨架；真实缓存/调试数据未接 |

## 9. 共用结构和交互变化

必须按这个交互矩阵实现，不得让按钮私自新建主 Tab 或新页面：

| 交互 | demo motion / route 语义 | 当前状态 |
|---|---|---|
| 书架封面/继续阅读 | `reader.entry.coverToImmersive`，push `immersive-reading`，最终沉浸 | reducer 已实现，需继续保持 |
| 非封面动作进入阅读 | `reader.entry.actionToImmersive` | reducer 已实现入口类型字段 |
| 沉浸中间热区 | `app.route.replace` / `reader.control.show` 到 `reader` | 已实现，热区比例已改为 26/48/26 |
| 沉浸左/右热区 | `reader.page.turn.prev/next` | 已接最小 page turn reducer seam |
| 非沉浸正文关闭 | `reader.control.hide` replace 回 `immersive-reading` | 已改为有边界关闭区，避免挡住顶栏和控制面板 |
| 顶栏返回 | `app.route.pop` 回来源页 | 已有 `popRoute`，需用真实设备验证视觉和 backStack 一致 |
| 顶栏更多 | dropdown open/close，不改 route | 已有基本实现 |
| 顶栏换源 | push `source-switch` FlowShell | 已有 phone continuity、候选选择状态、result slot 和 tablet / landscape 三槽 FlowShell 骨架；ReadingSurface 归槽和真实确认换源未完成 |
| 模块导航 | `reader.module.switch`，只替换 sheet 主体 | 已有 route replace，内容不完整 |
| quick 操作 | `reader.quick.promote`，只替换 sheet 主体 | 已有 route replace，内容不完整 |
| grabber | compact route 到 full route，不新增堆栈 | 已有 route replace，sheet 小横条已按 rail offset 调整；full grabber 接 full/compact 收起 |
| TTS / 自动翻页启动 | session 互斥，replace 回 `immersive-reading`，显示 capsule | reducer 已有互斥，视觉 capsule 需统一 |
| 亮度拖动 | update brightness + dim，不改 route | 已接 ArkUI pan/click seam |
| progress 拖动 | 更新 progress/page/chapter，不改 route | 已接 ArkUI pan/click seam |

## 10. 自适应审计

当前 HarmonyOS 已有 `ReaderAdaptiveState`，能根据 `widthVp / heightVp` 推导：

- `widthClass`
- `heightClass`
- `orientation`
- `mainTabMode`
- `readerPanelMode`
- `readerContentMode`
- `bookshelfColumns`
- `demoWidthClass`
- `demoHeightClass`
- `demoViewportClass`

这说明后续可以做多端自适应；`ReaderAdaptive` 已补齐 demo 的 `viewportClassSnapshot()` 等价字段。`source-switch` 三槽 FlowShell 的触发条件已回到 canonical demo 源码：只允许 `tablet-expanded` 或 `compact-landscape`。

当前差距：

| 项 | demo 要求 | 当前差距 |
|---|---|---|
| phone portrait | demo 类别为 `compact-portrait` / `standard-portrait` / `large-portrait`；`1320 x 2856 / 560dpi` 和当前 `1280 x 2832` 都只是 phone portrait 的设备样例 | 真实手机截图待补；实现仍需按新源码审计复核 |
| tablet / wide source-switch | demo 类别为 `tablet-expanded` 与 `compact-landscape`；右侧 dock / FlowShell 三槽按类别出现 | `ReaderAdaptive.sourceSwitchUsesFlowLayout()` 已修正；真实平板 / compact-landscape 截图待补 |
| 其他大屏专项 | 当前阶段不纳入验收 | 暂不处理 fold、2in1、freeform |
| fold posture | fold posture 只预留字段 | 未接系统 fold posture |
| safe area | demo 有参考安全区；HarmonyOS 应读原生 safe area | 当前 `safeArea` 字段存在，但未接真实系统 inset |
| keyboard | 搜索 quick panel 未来要避让键盘 | 当前 `keyboardInsetBottom` 字段和 reducer 验证钩子已补；未接真实键盘事件 |

后续截图必须至少覆盖：

- phone portrait 类：优先用 `1320 x 2856 / 560dpi`，当前 `1280 x 2832` 可作为同类近似证据。
- tablet-expanded 类：优先用 `2560 x 1600 / 360dpi / landscape`。
- reduced-motion on/off

不能用 phone portrait 截图替代 tablet-expanded / compact-landscape 的 FlowShell 证据。

## 11. 修复路线

第一批只修结构，不接真实业务数据：

1. 修 P0-01 到 P0-04：关闭热区、沉浸热区、quick bottom、grabber offset。
2. 修 P0-05 到 P0-07：亮度 slider、章节按钮、progress seam。
3. 修 P0-08：清理会误导审计的硬编码文本，把 fixture 文案和真实字段边界写清。
4. 修 P1 顶栏、sheet、module nav、session capsule 的 token 差异。
5. full/utility 面板第一版结构已重做；下一步继续补真实控件行为和资源图标，不急着接真实数据。
6. 做 phone portrait 与 tablet-expanded 两类截图、布局树或录屏证据；具体代表样机优先使用 `1320 x 2856 / 560dpi` 手机和 `2560 x 1600 / 360dpi` 平板。

第二批再做：

- source-switch FlowShell continuity 真实平板视觉验收。
- Reader 控制层 overlay/focus 的真实键盘事件接入。
- session capsule 真实朗读和自动翻页业务态。
- fold posture、safe area、keyboard、无障碍、性能工具验证。

## 12. 当前不能宣称完成的 Host 侧内容

- 真实业务数据：未完成。
- 真实目录列表、章节缓存、搜索结果、替换规则：未完成。
- source-switch / 书源切换连续性：phone continuity、tablet landscape 三槽 FlowShell 骨架、候选选择和本地确认 reducer 已完成；ReadingSurface 归槽、真实业务换源和目标设备视觉验收未完成。
- fold posture：仅字段预留，未完成。
- keyboard safe area：字段和 reducer 验证钩子已补，真实键盘事件接入未完成。
- 系统 safe area：仅字段预留，未完成。
- 无障碍完整验收：未完成。
- 性能工具验证：未完成。
- 真机/模拟器多视口录屏证据：需要在修复后重新产出。

## 13. 审计后的执行原则

- 先从 demo HTML 生成逻辑和 CSS token 抽结构，再写 ArkUI。
- ArkUI 只继承结构语义、slot、state、Motion ID、最终状态和互斥规则，不复制 DOM/CSS selector。
- 每次改动必须说明对应 demo 来源和 ArkUI 落点。
- 不再用截图临时猜结构；截图只用于验证实现是否对齐。
- 不一次迁移 131 routes；Reader 页面族先按 `immersive-reading`、`reader`、quick、module、full/utility 的顺序收敛。
