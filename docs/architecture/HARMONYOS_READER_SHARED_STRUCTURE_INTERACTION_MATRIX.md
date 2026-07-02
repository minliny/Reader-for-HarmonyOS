# ReaderShell 共用结构、模块归属和交互变化矩阵

本文档补齐 `HARMONYOS_READER_DEMO_STRUCTURE_REAUDIT.md` 和 `HARMONYOS_READER_DEMO_LAYOUT_RELATIONSHIP_AUDIT.md` 的缺口：不只列出结构内容，也明确哪些结构是共用的、每个结构对应哪些模块、交互按钮会导致哪些结构变化。

本结论只基于当前磁盘上的规范 demo（`frontend-demo`）：

- `/Users/minliny/Documents/Reader UI/frontend-demo/shared-shell-kit/kit.js`
- `/Users/minliny/Documents/Reader UI/frontend-demo/render-runtime.js`
- `/Users/minliny/Documents/Reader UI/frontend-demo/MOTION_CONTRACT.md`
- `/Users/minliny/Documents/Reader UI/frontend-demo/MOTION_EFFECTS.md`
- `/Users/minliny/Documents/Reader UI/frontend-demo/route-contract.js`

边界：

- ArkUI 侧不能复制 Web DOM、CSS、`data-*` selector 或 query fixture。
- 可以继承的是结构语义、slot 关系、route/mode 状态、Motion ID、互斥规则、打断规则、reduced-motion 规则和最终状态约束。
- 本文档是 HarmonyOS 原生组件拆分、单一 UI reducer 和自适应布局实现的输入，不代表 demo 证明已经等于 HarmonyOS 实现完成。

## 1. 共用结构清单

| 共用结构 | demo slot / 语义 | 覆盖 route / mode | 承载模块 | 不应承载 | 会被哪些交互改变 |
|---|---|---|---|---|---|
| `ReaderFrame` | `ReaderShell / readerFrame` | 所有 ReaderShell route；不含 MainTabShell 和 FlowShell | 阅读页整体宿主、断点语义、dock 偏移状态 | 主 Tab、书架、发现、RSS、设置 | route 进入/退出 ReaderShell；窗口断点变化只改变布局，不改变语义 |
| `ReadingSurface` | `readingSurface` | `immersive`、`control`、`module`、`quick`、`full`、`utility` | 正文背景、正文排版层、亮度 dim、非沉浸 dismiss zone | 顶栏、控制面板、模块导航、更多菜单 | 章节跳转、分页、进度拖动、主题、字号、页边距、亮度；route 面板切换不应重建语义 |
| `ReadingTextLayer` | `ReadingTextLayer` | 所有 ReaderShell route | 章节标题、段落、分页 readout、翻页方向状态 | 控制按钮、模块列表 | 上一页/下一页、上一章/下一章、目录条目、章节进度、排版设置 |
| `BrightnessDim` | `ReadingSurface` 内局部 dim + `ReaderStateHost` 全局 dim | 所有 ReaderShell route | 亮度遮罩状态 | 亮度控制按钮本体 | 亮度 rail 拖动、自动亮度开关；不改变 route |
| `ImmersiveInfoLayer` | `readerOverlayHost` 的沉浸态 overlay | 仅 `immersive-reading` | 书名/章节、时间、底部进度、session capsule | 顶部阅读栏、底部控制层、模块导航 | TTS / 自动翻页 session 开始、暂停、继续、倒计时 |
| `ImmersiveTapZones` | `readerOverlayHost` 的透明热区层 | 仅 `immersive-reading` | 左右翻页热区、中间打开控制层热区 | 真实按钮面板、模块导航 | 左/右热区翻页；中间热区进入 `reader` 控制层 |
| `ReaderTopBar` | 非沉浸 `readerOverlayHost` | `reader`、module、quick、full、utility | 返回、书名/书源、换源、更多 | 沉浸阅读态；主 Tab 顶栏 | 返回退出 ReaderShell；换源进入 FlowShell；更多开关只显示/隐藏 MoreMenu |
| `MoreMenu` | `ReaderTopBar` 同层浮层 | 非沉浸 ReaderShell | 刷新、本章链接、书籍缓存、调试信息等动作 | 底部控制主体、模块导航 | 更多按钮展开/收起；菜单路由进入 utility 或其他页面 |
| `BottomSheetHost` | `bottomSheetHost` | `control`、`module`、`quick`、`loading`；full/utility 使用同一 slot 但 class 为 full host | compact sheet 背板、顶部小横条、主体 slot、右侧 Rail | 模块导航本体；沉浸信息层 | 控制层打开/隐藏、模块切换、快捷入口、grabber 展开/收起、异步 loading 完成 |
| `BottomSheetGrabber` | `BottomSheetHost` 顶部独立定位 | compact `control`、`module`、`quick`、`loading` | 42x4 小横条和展开点击热区 | `PanelBodyFrame`、`BrightnessRail`、`ReaderFullHost` 内收起横条 | 点击进入 full presentation；不能占用左侧主体高度 |
| `PanelBodyFrame` | `BottomSheetHost` 内主体 | `control`、`module`、`quick`、`loading` | `BottomControlPanel`、`ReaderModulePanel`、`ReaderQuickPanel`、`ReaderLoadingPanel` | 竖向亮度 rail、模块导航 | route/mode 改变时替换主体；局部设置只替换主体内部状态 |
| `BrightnessRail` | `BottomSheetHost` 内固定竖向 rail | 非沉浸 compact 控制态、module、quick、loading | 太阳图标、竖向 slider、自动亮度按钮 | 横向设置项；全屏面板的普通内容 | 拖动或自动开关只改亮度状态；不改 route/mode |
| `ReaderModuleNav` | `readerModuleNav`，与 sheet 同级 | 非沉浸 compact 控制态、module、quick、loading | 目录、朗读、界面、设置四模块入口 | BottomSheetHost 的子内容；阅读页主 Tab | 模块入口切换 active；当前模块再次点击回到 control |
| `ReaderFullHost` | `BottomSheetHost` 的 full host 变体 | `reader-full-directory`、`reader-full-tts`、`reader-full-appearance`、`reader-full-settings`、utility | 大半屏/全屏模块内容、收起 grabber、完成按钮 | 底部模块导航、固定亮度 rail | grabber 展开/收起；full 内设置项只改正文或 session 状态 |
| `ReaderStateHost` | `readerStateHost` | 所有 ReaderShell route | 全局亮度 dim、motion/async 状态承载 | 普通面板内容、模块导航 | 异步加载、亮度状态、motion interrupt 状态 |
| `SourceSwitchContinuity` | `FlowShell` 的 `stepRegion` | `source-switch` | 保留一份可操作阅读控制层背景、换源窗口、结果确认 | ReaderShell 的普通 quick/module 面板 | 换源按钮进入；关闭/确认 replace 回 `reader` |

## 2. route / mode 到结构矩阵

| route | mode | ReadingSurface | Immersive overlay | TopBar | BottomSheetHost 主体 | BrightnessRail | ModuleNav | FullHost / Utility | 备注 |
|---|---|---|---|---|---|---|---|---|---|
| `immersive-reading` | `immersive` | 显示 | `InfoLayer + SelectionLayer + TapZones` | 隐藏 | 空 | 隐藏 | 隐藏 | 无 | 最终沉浸态；不自动打开控制层 |
| `reader` | `control` | 显示 | 无 | 显示 | `BottomControlPanel` | 显示 | 显示，无 active | 无 | 控制层主态 |
| `toc-bookmarks` | `module/directory` | 显示 | 无 | 显示 | 目录/书签 module panel | 显示 | 显示，目录 active | 无 | 目录条目点击回沉浸阅读 |
| `tts` | `module/tts` | 显示 | 无 | 显示 | 朗读 module panel | 显示 | 显示，朗读 active | 无 | 启动朗读后回沉浸，显示 session capsule |
| `reader-appearance` | `module/appearance` | 显示 | 无 | 显示 | 界面 module panel | 显示 | 显示，界面 active | 无 | 主题/字号直接影响 ReadingSurface |
| `reader-settings` | `module/settings` | 显示 | 无 | 显示 | 阅读设置 module panel | 显示 | 显示，设置 active | 无 | 自动翻页启动后回沉浸 |
| `content-search` | `quick/search` | 显示 | 无 | 显示 | 内容搜索 quick panel | 显示 | 显示，无 active | 无 | 搜索结果点击回沉浸 |
| `auto-page` | `quick/auto-page` | 显示 | 无 | 显示 | 自动翻页 quick panel | 显示 | 显示，无 active | 无 | 自动翻页启动后回沉浸 |
| `content-replacement` | `quick/replace` | 显示 | 无 | 显示 | 内容替换 quick panel | 显示 | 显示，无 active | 无 | 规则开关只改 quick panel 内部状态 |
| `reader-full-directory` | `full/directory` | 显示 | 无 | 显示 | full host | 隐藏 | 隐藏 | 完整目录 | 收起回 `toc-bookmarks` |
| `reader-full-tts` | `full/tts` | 显示 | 无 | 显示 | full host | 隐藏 | 隐藏 | 完整朗读 | 收起回 `tts` |
| `reader-full-appearance` | `full/appearance` | 显示 | 无 | 显示 | full host | 隐藏 | 隐藏 | 完整界面 | 收起回 `reader-appearance` |
| `reader-full-settings` | `full/settings` | 显示 | 无 | 显示 | full host | 隐藏 | 隐藏 | 完整设置 | 收起回 `reader-settings` |
| `reader-book-cache` | `utility/cache` | 显示 | 无 | 显示 | utility full host | 隐藏 | 隐藏 | 书籍缓存 | 从 MoreMenu 进入，完成回 `reader` |
| `reader-debug-info` | `utility/debug` | 显示 | 无 | 显示 | utility full host | 隐藏 | 隐藏 | 调试信息 | 从 MoreMenu 进入，完成回 `reader` |
| `source-switch` | `FlowShell` | continuity 区域显示 | 无 | continuity 内显示 | continuity 内 `reader` 控制层 | continuity 内显示 | continuity 内显示 | 换源窗口/结果区 | 不是 ReaderShell 普通 overlay |

## 3. 模块到共用结构的归属

| 模块 | 所属结构 | 进入入口 | 退出/切换 | 结构变化 |
|---|---|---|---|---|
| 控制层主面板 | `BottomSheetHost -> BottomControlPanel` | 沉浸中间热区、module 再次点击、quick 关闭、full 收起 | dismiss zone 回沉浸；grabber 展开；返回退出 ReaderShell | 显示 TopBar、BottomSheet、BrightnessRail、ModuleNav |
| 快捷操作栏 | `BottomControlPanel -> fd-reader-actions` | `reader` 控制层 | 点击搜索/自动翻页/内容替换 | 不改变 shell，只把 sheet 主体替换为 quick panel |
| 章节进度面板 | `BottomControlPanel -> fd-reader-chapter-panel` | `reader` 控制层 | 章节按钮、进度拖动 | ReadingTextLayer 和进度状态改变；shell 不变 |
| 目录/书签模块 | `ReaderModulePanel(directory)` | ModuleNav 目录 | 目录条目点击；grabber 展开；再次点目录回 control | sheet 主体换目录，ModuleNav active；条目点击 replace 到沉浸 |
| 朗读模块 | `ReaderModulePanel(tts)` | ModuleNav 朗读 | TTS toggle、grabber、再次点朗读 | toggle 启动时回沉浸并显示 session capsule；参数变化不改 shell |
| 界面模块 | `ReaderModulePanel(appearance)` | ModuleNav 界面 | 主题/字号/排版、grabber、再次点界面 | ReadingSurface 样式状态改变；shell 不变 |
| 阅读设置模块 | `ReaderModulePanel(settings)` | ModuleNav 设置 | setting toggle/option、grabber、再次点设置 | 普通开关只改内部状态；自动翻页启动回沉浸并显示 capsule |
| 搜索 quick panel | `ReaderQuickPanel(search)` | 控制层搜索按钮 | 关闭、搜索结果点击 | sheet 主体换搜索；结果点击进入沉浸 |
| 自动翻页 quick panel | `ReaderQuickPanel(auto-page)` | 控制层自动翻页按钮 | toggle 启动、关闭 | 启动时 sheet/nav/topbar 消失，沉浸 capsule 出现 |
| 内容替换 quick panel | `ReaderQuickPanel(replace)` | 控制层替换按钮 | 关闭、规则开关 | 规则开关只替换 quick panel 内部状态 |
| 完整目录/朗读/界面/设置 | `ReaderFullHost` | compact grabber 或 full route | full grabber/收起按钮 | 隐藏 ModuleNav 和 BrightnessRail，保留 TopBar 和 ReadingSurface |
| 书籍缓存/调试信息 | `ReaderFullHost` utility | MoreMenu 条目 | 完成/回到控制层 | utility host 替换普通 sheet；不显示 ModuleNav/Rail |
| 换源流程 | `FlowShell + SourceSwitchContinuity` | TopBar 换源 | 关闭/确认 replace 回 `reader` | 跳出 ReaderShell；保留阅读控制层 continuity 背景和换源窗口 |

## 4. 交互按钮导致的结构变化

| 交互入口 | demo 语义 / Motion ID | state / route 变化 | 结构变化 | 必须保持的不变量 |
|---|---|---|---|---|
| 书架封面 | `reader.entry.coverToImmersive` | push `immersive-reading`；记录 entry motion；关闭书籍 focus | MainTabShell 退出，进入 ReaderShell 沉浸结构 | 最终是 `immersive-reading`；不自动打开控制层；返回回来源页 |
| 继续阅读入口 | `reader.entry.coverToImmersive` | push `immersive-reading` | 同封面入口 | 连续点击只保留最后目标；pending route 被打断/替换 |
| 非封面动作进入阅读 | `reader.entry.actionToImmersive` | push/replace `immersive-reading` | 进入沉浸 ReaderShell | reduced-motion 下即时或短反馈后到最终沉浸态 |
| 沉浸中间热区 | `app.route.push` + `reader` | 从 `immersive-reading` push/replace 到 `reader` | 增加 TopBar、BottomSheet、BrightnessRail、ModuleNav；沉浸 info/tap zones 隐藏 | ReadingSurface 共用，不重建为另一页 |
| 沉浸左右热区 | `reader.page.turn.next/prev` | `readerPageIndex`、`readerTurnDirection` 改变 | 只替换 ReadingTextLayer readout/段落状态 | 不打开控制层；不改变 route stack |
| 非沉浸 dismiss zone | `reader.control.hide` | replace top route 为 `immersive-reading` | TopBar、BottomSheet、BrightnessRail、ModuleNav 消失；沉浸 overlay 出现 | 返回栈不新增一层 |
| 顶栏返回 | `app.route.pop` / `exitReader` | pop 掉连续 ReaderState route，回来源 route；无来源则回 `bookshelf` | 退出 ReaderShell，恢复来源 shell | 视觉页面必须和 backStack 一致 |
| 顶栏换源 | `app.route.push` 到 `source-switch` | 进入 FlowShell | ReaderShell 变为 FlowShell continuity + 换源窗口 + 结果区 | 不是主 Tab，不是普通 Reader overlay |
| 顶栏更多 | `dropdown.trigger.press` | `readerMoreOpen` true/false | MoreMenu 浮层出现/消失 | 不改变 BottomSheetHost、ModuleNav、route |
| MoreMenu 书籍缓存/调试信息 | `dropdown.option.select` + route push | push utility route | BottomSheetHost 变 utility full host；ModuleNav/Rail 隐藏 | TopBar 和 ReadingSurface 保留 |
| 模块导航点目录/朗读/界面/设置 | `reader.module.switch` | route 到 `toc-bookmarks` / `tts` / `reader-appearance` / `reader-settings` | sheet 主体替换为模块面板；ModuleNav active 改变；Rail 保持 | ModuleNav 与 sheet 同级，按钮数量和命中区稳定 |
| 当前 active 模块再次点击 | `reader.module.switch/select` | replace 到 `reader` | sheet 主体回控制主面板；ModuleNav active 清空 | 不新增 route 层 |
| 控制层搜索/自动翻页/替换按钮 | `reader.quick.promote` | route 到 `content-search` / `auto-page` / `content-replacement` | sheet 主体替换为 quick panel；Rail 和 ModuleNav 保持 | quick panel 不是主 Tab，也不是 full route |
| quick panel 关闭 | `app.route.push/replace` 到 `reader` | 回控制层 | sheet 主体回 `BottomControlPanel` | ReadingSurface 保持 |
| 控制层 grabber | `reader.control.handle.press/release` | compact route 到 full route | BottomSheetHost 切 full host；ModuleNav/Rail 隐藏 | TopBar、ReadingSurface 保留；reduced-motion 下直接 settle |
| full grabber / 收起 | `reader.control.handle.release` + replace | full route replace 回 compact module route | full host 回 sheet + Rail + ModuleNav | route 不堆叠 |
| full 目录条目 | `reader.chapter.jump` | `readerChapterIndex`、progress、pageIndex 更新，replace `immersive-reading` | full host/topbar/nav/rail 消失，回沉浸 | 最终只显示沉浸阅读 |
| 目录模块条目 | `reader.chapter.jump` | 同 full 目录 | module sheet 消失，回沉浸 | ReadingSurface 更新到目标章节 |
| TTS 播放 toggle | `reader.session.tts.start` | `readerTtsSession=true`，TTS playing；关闭 autoPage session；replace `immersive-reading` | 控制结构消失，沉浸底部出现 TTS capsule | TTS 与自动翻页互斥 |
| 自动翻页 toggle | `reader.session.autoPage.start` | `readerAutoPageSession=true`，autoPage on；关闭 TTS session；replace `immersive-reading` | 控制结构消失，沉浸底部出现自动翻页 capsule | TTS 与自动翻页互斥 |
| capsule 暂停/继续 | `reader.session.capsule.control.press/toggle` | session playing 状态变化 | 只更新 capsule 或 control running space | 不改变 route |
| session 运行时打开控制层 | `reader.session.controlSpace.enter/update/exit` | route 可到 `reader`，session 仍存在 | `BottomControlPanel` 顶部插入 running space | session capsule 和 control space 是同一 session 的两种呈现 |
| 亮度 rail 拖动 | `slider.drag.start/update/release` | `readerBrightness`、`readerBrightnessAuto=false` | 只更新 Rail thumb 和 dim layer | 亮度条固定竖向，不能变成普通横向设置行 |
| 自动亮度按钮 | `toggle.switch` | `readerBrightnessAuto` toggle | 只更新 Rail 按钮 active 和 dim state | 不改变 route/mode |
| 章节上一章/下一章 | `reader.chapter.jump` | chapter index、progress、page index、turn direction | ReadingTextLayer 替换，控制结构保留 | 禁用态不触发 |
| 章节进度拖动 | `slider.drag.start/update/release` | progress 和 page index 更新 | 拖动中更新进度条，释放后重渲染正文状态 | 不改变 route |
| 主题/字号/页面空间 | `segment.item.switch` / `stepper.press/value.change` | typography/theme/pageSpace 状态更新 | ReadingSurface 样式和正文测量状态更新 | 不改变 shell slot |
| 文本长按/选择 | `selection.range.show` | `readerTextSelectionOpen=true` | 沉浸 overlay 加 SelectionLayer | 不打开控制层 |
| 异步 reader route 加载 | `motion.interrupt.completeThenReplace` | pending route request，完成后 render target | 临时 `ReaderLoadingPanel` 替换 sheet 主体，完成后换目标 panel | 连续点击取消旧 pending，只保留最后目标 |
| dock 长按拖动 | `reader.control.dock.*` | dock offset per viewport 更新 | 在可移动断点移动 sheet/nav dock 坐标 | 只改变 dock 位置，不改变 active route |
| 主 Tab 切换 | `tab.item.press/select/switch` / `app.tab.switch` | routeStack 清空为目标主 Tab | MainTabShell 主内容切换 | 主 Tab 只有书架/发现/RSS/设置；阅读页不是主 Tab |

## 5. reducer 必须能解释的最终状态

HarmonyOS 侧单一 UI state 至少需要这些字段，才能解释 route、session、overlay、focus 和 async result 的最终结构：

| 字段 | 必须解释的问题 |
|---|---|
| `activeTab` | 当前主 Tab，只允许 `bookshelf`、`discover`、`rss`、`settings` |
| `currentRoute` | 当前视觉 route；ReaderShell route、FlowShell route 和 MainTab route 要能区分 |
| `backStack` | 返回来源页、ReaderState route pop、replace 是否一致 |
| `readerMode` | `immersive`、`control`、`module`、`quick`、`full`、`utility`、`loading` |
| `activeReaderModule` | 目录、朗读、界面、设置；只在 module/full module 有意义 |
| `activeQuickPanel` | 搜索、自动翻页、内容替换；只在 quick mode 有意义 |
| `ReaderContext` | 书籍、章节、页码、进度、正文、来源、主题、排版、页面空间 |
| `overlayState` | MoreMenu、文本选择、换源窗口、系统 overlay 预留 |
| `activeSession` | `none`、`tts`、`autoPage`，包含 playing/countdown/voice 等 |
| `motionInterrupt` | route push/pop/replace、loading complete、连续点击、reduced-motion 的打断结果 |
| `asyncResult` | loading route 请求、完成后目标、取消原因 |
| `focusState` | 当前焦点恢复、文本选择、弹层初始焦点、返回焦点 |
| `adaptiveState` | width class、height class、orientation、fold posture 预留、safe area |

互斥规则：

- `readerMode=immersive` 时：TopBar、BottomSheetHost 主体、BrightnessRail、ReaderModuleNav 必须不可见；只保留 ReadingSurface、ImmersiveInfoLayer、TapZones、可选 SelectionLayer。
- `readerMode=control|module|quick|loading` 时：TopBar、BottomSheetHost、BrightnessRail、ReaderModuleNav 必须可见；sheet 主体按 mode 替换。
- `readerMode=full|utility` 时：TopBar、ReadingSurface、ReaderFullHost 可见；BrightnessRail 和 ReaderModuleNav 不可见。
- `currentRoute=source-switch` 时：进入 FlowShell；不能当成 ReaderShell quick panel。
- `activeSession=tts` 与 `activeSession=autoPage` 互斥；任一 session 启动后的最终视觉态都是 `immersive-reading`。
- route replace 不增加 backStack；route push 增加 backStack；主 Tab 切换清空为目标 Tab。

## 6. ArkUI 原生组件拆分建议

第一阶段不需要迁移所有 route，但 ReaderShell 骨架要按共用结构拆，避免后续二次开发：

| ArkUI 组件 | 对应 demo 结构 | 输入 state | 输出 action |
|---|---|---|---|
| `ReaderFrame` | `ReaderFrame` | `currentRoute`、`readerMode`、`adaptiveState` | 无；负责组合 slot |
| `ReaderReadingSurface` | `ReadingSurface` | `ReaderContext`、`brightness`、`typography`、`pageSpace` | page turn、text selection |
| `ReaderImmersiveOverlay` | `ImmersiveInfoLayer + TapZones` | `ReaderContext`、`activeSession`、`readerMode` | open control、page prev/next、capsule toggle |
| `ReaderTopBar` | `ReaderTopBar + MoreMenu` | `ReaderContext`、`overlayState` | exit、sourceSwitch、more toggle、utility route |
| `ReaderBottomSheetHost` | `BottomSheetHost` | `readerMode`、`activeReaderModule`、`activeQuickPanel`、`asyncResult` | route/module/quick/full actions |
| `ReaderControlPanel` | `BottomControlPanel` | `ReaderContext`、`activeSession` | quick promote、chapter jump、progress drag |
| `ReaderModulePanel` | directory/tts/appearance/settings module | `activeReaderModule`、`ReaderContext`、`activeSession` | module setting、session start、chapter jump |
| `ReaderQuickPanel` | search/auto-page/replace quick | `activeQuickPanel`、`ReaderContext` | close、search result、autoPage start、replace rule toggle |
| `ReaderBrightnessRail` | `BrightnessRail` | `brightness`、`readerBrightnessAuto` | brightness drag、auto toggle |
| `ReaderModuleNav` | `ReaderModuleNav` | `activeReaderModule`、`readerMode` | module switch/select |
| `ReaderFullHost` | full/utility host | `readerMode`、`activeReaderModule`、`currentRoute` | collapse、utility complete、full settings |
| `ReaderStateHost` | global dim/motion/async host | `brightness`、`motionInterrupt`、`asyncResult` | 无；只呈现状态 |
| `SourceSwitchFlow` | `FlowShell + SourceSwitchContinuity` | `ReaderContext`、`sourceSwitchState` | close、select source、confirm |

拆分约束：

- `ReaderModuleNav` 不放进 `ReaderBottomSheetHost` 内部，二者是同级控制 dock 的两个结构。
- `ReaderBrightnessRail` 固定竖向，属于非沉浸控制 dock；不能作为设置模块的一行普通横向 slider。
- `ReaderReadingSurface` 是所有 ReaderShell route 的共用正文底层，模块切换和 quick 切换不应销毁其语义状态。
- `ReaderTopBar` 不属于沉浸态；沉浸态只显示阅读信息层和透明热区。
- `ReaderFullHost` 是 compact 控制层展开后的结构，不能当成单独主页面或主 Tab。

## 7. 首批 Slice 验收路径

Slice 1 主 Tab：

- 主 Tab 仅有书架、发现、RSS、设置。
- Tab 切换使用 `tab.item.press/select/switch` / `app.tab.switch` 语义，不能 push 二级 route。
- 搜索、阅读页、书源管理都不能出现在主 Tab。

Slice 2 书架到沉浸阅读：

- 书架封面或继续阅读入口触发 `reader.entry.coverToImmersive`。
- route 最终为 `immersive-reading`，`readerMode=immersive`。
- TopBar、BottomSheetHost、BrightnessRail、ReaderModuleNav 均不可见。
- 返回回来源页，backStack 和视觉页面一致。
- 连续点击取消旧 pending，最终只保留最后目标。
- reduced-motion 下可以即时进入或只保留短状态反馈。

下一步 Reader 控制层骨架：

- 沉浸中间热区进入 `reader`。
- `reader` 显示 TopBar、BottomSheetHost、固定竖向 BrightnessRail、ReaderModuleNav。
- ModuleNav 四入口切换 sheet 主体，不能重建阅读面。
- dismiss zone replace 回 `immersive-reading`。
- TTS/自动翻页启动后回沉浸并显示 session capsule。
