# ReaderShell demo 结构重读审计

本审计只基于当前磁盘上的规范 demo（`frontend-demo`）：

- `/Users/minliny/Documents/Reader UI/frontend-demo/shared-shell-kit/kit.js`
- `/Users/minliny/Documents/Reader UI/frontend-demo/render-runtime.js`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/01-shell-layout.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/02-main-library.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/03-reader.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/04-settings-source.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/README.md`
- `/Users/minliny/Documents/Reader UI/frontend-demo/MOTION_CONTRACT.md`
- `/Users/minliny/Documents/Reader UI/frontend-demo/MOTION_EFFECTS.md`
- `/Users/minliny/Documents/Reader UI/frontend-demo/route-contract.js`

它不沿用之前 ArkUI 骨架的假设。结论用于后续重构 HarmonyOS 原生 UI，不代表可以复制 Web DOM、CSS 或 selector。

布局尺寸、锚点、层级、命中区和断点关系见同目录的 `HARMONYOS_READER_DEMO_LAYOUT_RELATIONSHIP_AUDIT.md`。共用结构、模块归属和按钮交互导致的结构变化见 `HARMONYOS_READER_SHARED_STRUCTURE_INTERACTION_MATRIX.md`。本文件只描述结构和状态归属，不能单独作为 ArkUI 布局实现依据。

## 1. demo 的 ReaderShell slot 关系

`shared-shell-kit/kit.js` 的 `renderReaderShell(...)` 是结构源头。ReaderShell 不是单个控制层组件，而是稳定 slot 宿主：

```text
ReaderShell / readerFrame
  ReadingSurface / readingSurface
    ReadingBackground
    ReadingTextLayer
    BrightnessDim
    ControlDismissZone（非沉浸态才存在）
  ReaderOverlayHost / readerOverlayHost
    沉浸态：ImmersiveInfoLayer + TextSelectionLayer + ImmersiveTapZones
    非沉浸态：ReaderTopBar + MoreMenu（可选）
    BottomSheetHost
      reader / quick / module / loading / full / utility 的面板主体
    ReaderModuleNav
      目录 / 朗读 / 界面 / 设置
  ReaderStateHost / readerStateHost
    全局亮度 dim、异步/loading/动效状态承载
```

关键点：

- `ReadingSurface` 始终是正文底层，控制层、模块、快捷、完整页都不重建正文。
- `ReaderOverlayHost` 是同一交互平面；顶部阅读栏、底部控制面板、模块导航都在这个宿主内。
- `BottomSheetHost` 和 `ReaderModuleNav` 是同级 slot，不应把模块导航塞进控制面板内部。
- `ReaderStateHost` 不属于底部面板，用来放全局状态层，例如亮度 dim。

## 2. route 到 reader state 的映射

`render-runtime.js` 的 `readerStateByRoute` 定义了 ReaderShell 内部状态：

| route | demo mode | 结构含义 |
|---|---|---|
| `immersive-reading` | `immersive` | 只显示正文、沉浸信息层、文本选择层、三段点击热区 |
| `reader` | `control` | 显示顶部阅读栏、底部控制面板、亮度 Rail、模块导航 |
| `toc-bookmarks` | `module/directory` | 替换底部面板主体为目录/书签模块，模块导航保持同位置 |
| `tts` | `module/tts` | 替换底部面板主体为朗读模块，模块导航保持同位置 |
| `reader-appearance` | `module/appearance` | 替换底部面板主体为界面模块，模块导航保持同位置 |
| `reader-settings` | `module/settings` | 替换底部面板主体为阅读设置模块，模块导航保持同位置 |
| `content-search` | `quick/search` | 替换底部面板主体为快捷搜索面板 |
| `auto-page` | `quick/auto-page` | 替换底部面板主体为自动翻页快捷面板 |
| `content-replacement` | `quick/replace` | 替换底部面板主体为内容替换快捷面板 |
| `reader-full-*` | full page | 仍在 ReaderShell，使用 full host/panel，不显示四模块 nav |
| `reader-book-cache` / `reader-debug-info` | utility | 仍在 ReaderShell，使用 utility panel，不显示四模块 nav |
| `source-switch` | FlowShell | 不是普通 ReaderShell 快捷面板；从阅读顶栏进入换源流程 |

结构含义：

- `reader`、模块、快捷都是 ReaderShell 内的 presentation replace，不应该作为新的主 Tab。
- 模块按钮重复点击当前 active 模块时回到 `reader`。
- 自动翻页和朗读启动后使用 replace 回 `immersive-reading`，显示沉浸态运行胶囊。

## 3. 沉浸阅读结构

沉浸态由 `readerStateScreen(... isImmersive)` 组合：

- `readingSurfaceHtml = sharedReaderSurface(data, "", appState)`
- `overlayHtml = readerInfoOverlay + readerTextSelectionLayer + readerTapZones`
- `bottomSheetHostClass = fd-reader-sheet fd-reader-sheet-empty`
- `moduleNavClass = fd-reader-module-nav fd-reader-module-nav-empty`
- `bottomSheetHtml = ""`
- `moduleNavHtml = ""`

沉浸态应有：

- 正文背景层。
- 正文排版层。
- 亮度 dim 层。
- 顶部/底部阅读信息。
- 文本选择层，仅在选择态显示。
- 左/中/右三段点击热区：上一页、打开控制层、下一页。

沉浸态不应有：

- 顶部阅读控制栏。
- 底部控制面板。
- 右侧亮度 Rail。
- 四模块导航。

## 4. 普通控制层结构

`reader` 状态的非沉浸结构是：

```text
ReaderOverlayHost
  ReaderTopBar
  BottomSheetHost / fd-reader-sheet
    Grabber
    BottomControlPanel
      RunningSpace（有 session 时）
      QuickActions（三个快捷动作）
      ChapterPanel（上一章 / 当前章节 / 下一章 + 章节进度）
    BrightnessRail
  ReaderModuleNav
    目录 / 朗读 / 界面 / 设置
```

关键点：

- 顶部阅读栏不是底部面板的一部分。
- `BottomControlPanel`、`ReaderModulePanel`、`ReaderQuickPanel`、`ReaderLoadingPanel` 互斥替换同一个 bottom sheet 主体区域。
- 亮度 Rail 是 bottom sheet 内的右侧固定竖向 rail，右侧占位由 `--reader-quick-rail-width` 和 `--reader-quick-rail-gap` 预留。
- 章节进度是横向 progress，亮度是右侧竖向 slider；二者不是同一行，也不互相替代。
- 控制层显示/隐藏不改变正文层的排版、透明度和边距。

## 5. 模块面板结构

模块面板仍使用同一个 bottom sheet 和同一个 module nav：

```text
BottomSheetHost
  Grabber
  ReaderModulePanel（目录 / 朗读 / 界面 / 设置）
  BrightnessRail
ReaderModuleNav（同级，不移动、不变尺寸）
```

模块面板主体结构：

- 目录：目录/书签 segment + 章节行；章节行以章节名和标记为主，不展示长摘要。
- 朗读：播放控制、语速、音色、范围、定时。
- 界面：主题色块、字号/行距/字体等快速设置。
- 设置：自动翻页、点击方式、音量键、翻页动画、横屏锁定、常亮、页脚信息、触摸反馈、自动缓存等常用项。

模块切换规则：

- 模块导航几何不变，只切换选中态和底部面板内容。
- 点击当前 active 模块回到 `reader`。
- 快速连续切换时，旧面板被新目标接管，不留下两个可点面板。

## 6. 快捷面板和完整页结构

快捷面板：

- `content-search`：面板内搜索结果，结果可回到 `immersive-reading`。
- `auto-page`：自动翻页控制、速度、模式；启动后 replace 回沉浸态并显示运行胶囊。
- `content-replacement`：替换规则开关列表。

完整页：

```text
ReaderOverlayHost
  ReaderTopBar
  FullHost / FullPagePanel
    FullGrabber
    FullHead
    FullContent
  ReaderModuleNavEmpty
ReaderStateHost
  GlobalBrightnessDim
```

完整页仍归 ReaderShell，不跳到 SettingsShell；但它不显示四模块导航，也不使用普通 compact bottom sheet 的几何。

## 7. 换源窗口结构

换源从 Reader 顶栏进入 `source-switch`，shell 是 `FlowShell`，不是 ReaderShell 的普通快捷面板。

demo 的语义要求：

- 保留进入前的阅读控制层连续性。
- 不使用全屏黑色遮罩。
- 不阻断顶部阅读栏、底部控制面板、模块导航操作。
- 关闭或切模块时替换当前换源 route，不把 `source-switch` 留在返回栈。
- 书源管理、书源编辑、批量检测属于 SettingsShell，不塞进阅读中的换源窗口。

第一阶段可以先不实现换源窗口，但不能把“换源”临时接到调试页或缓存页后继续当作正确结构。

## 8. 当前 HarmonyOS 骨架状态（2026-07-02 验证后）

当前 ArkUI 文件：

- `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/components/ReaderSurface.ets`
- `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/components/ReaderControlLayer.ets`
- `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/shells/ReaderShell.ets`

已修正的结构关系：

1. phone 控制层顶栏已从深色整宽 Row 改为 demo 语义的浮动 `ReaderTopBar`：top `18vp`，左右 inset，浅色卡片。
2. phone `BottomSheetHost` 已按 demo 几何锚定：left/right `12vp`、bottom `18vp`、height `330vp`。
3. `ReaderModuleNav` 已从 sheet 内容流中拆出，作为与 sheet 同级的独立 slot：left/right `24vp`、bottom `32vp`、height `78vp`。
4. `BrightnessRail` 已放回 sheet 内右侧固定竖向 rail，主体区通过 `railWidth + railGap` 预留右侧空间。
5. 更多菜单已按 `ReaderTopBar` 同层浮层实现，6 个 demo 菜单项，右上锚定；外部点击关闭已验证；不再使用可见全屏半透明蒙版。
6. full/utility host 已按 top `88vp`、bottom `18vp` 的 full panel 方式承载，并隐藏 module nav / rail。

本轮验证证据：

- `artifacts/reader-ui-slice/layout-current-immersive.json`：进入阅读后只保留沉浸阅读信息层，无 TopBar、BottomSheet、BrightnessRail、ReaderModuleNav。
- `artifacts/reader-ui-slice/layout-current-control.json`：控制层包含 `换源`、`搜索`、`自动翻页`、`内容替换`、右侧 `亮`、底部 `目录/朗读/界面/设置`。
- `artifacts/reader-ui-slice/layout-current-more.json`：更多菜单 6 项存在，底层控制层仍存在。
- `artifacts/reader-ui-slice/layout-current-more-closed.json`：外部点击后更多菜单项消失，控制层仍存在。
- `artifacts/reader-ui-slice/layout-current-return-bookshelf.json`：点击顶栏返回后回到书架来源页。
- `artifacts/reader-ui-slice/layout-current-reduced-motion.json`：`减少动态效果` 开关开启后文案为 `关闭大幅位移和长过渡。`。

仍未完成的偏差：

1. `ReaderControlLayer` 仍是阶段性单体组件，后续应拆成 `ReaderTopBar`、`ReaderBottomSheetHost`、`ReaderBrightnessRail`、`ReaderModuleNav`、`ReaderFullHost` 等独立 ArkUI 文件。
2. MoreMenu 自身外部点击已关闭；但非沉浸控制层的正文 dismiss zone 仍未完全恢复为 ReadingSurface 共享 dismiss 区，当前主要依赖系统返回和显式按钮。
3. “换源”仍是占位按钮，尚未进入 `FlowShell + SourceSwitchContinuity`。
4. 沉浸左右热区仍未接入上一页/下一页，当前只保证中部打开控制层。
5. 阅读正文层仍是骨架文本，缺少 demo 的分页层、页码、主题、字体、行距、页边距等运行态锚点。
6. state 已覆盖 route、activeTab、ReaderContext、overlay、activeSession、motionInterrupt、reader mode、active module、quick type；仍缺 page index/count、brightness value/auto、typography/page space、loading request guard 的真实业务状态。

实现注意：

- ArkUI 颜色不要沿用 Web 的 `#RRGGBBAA` 写法；HarmonyOS 侧本轮改为 6 位色或明确 ARGB，避免透明度字节被解释成 RGB 导致偏黄。

## 9. HarmonyOS 下一步应按 slot 模型重构

建议先重构 ReaderShell 骨架，再细化视觉：

```text
ReaderShell.ets
  ReaderReadingSurfaceSlot.ets
    ReaderBackgroundLayer
    ReaderTextLayer
    ReaderBrightnessDimLayer
    ReaderDismissZone（非沉浸态）
  ReaderOverlayHost.ets
    immersive:
      ReaderImmersiveInfoLayer
      ReaderSelectionLayer
      ReaderTapZones
    non-immersive:
      ReaderTopBar
      ReaderBottomSheetHost
      ReaderModuleNav
  ReaderStateHost.ets
```

底部/侧边控制应拆成：

- `ReaderBottomSheetHost.ets`：负责 phone bottom sheet、landscape/expanded dock、full host 三种容器。
- `ReaderControlMainPanel.ets`：快捷动作 + 章节进度。
- `ReaderQuickPanel.ets`：搜索、自动翻页、内容替换。
- `ReaderModulePanel.ets`：目录、朗读、界面、设置。
- `ReaderFullPanel.ets`：reader-full-*。
- `ReaderBrightnessRail.ets`：只负责亮度 Rail，不再放进横向进度或面板内部 Column。
- `ReaderModuleNav.ets`：独立 slot，保持四个按钮尺寸、间距、点击热区稳定。
- `ReaderTopBar.ets`：返回、书名/来源、换源、更多。

状态模型应补充：

- `readerMode`: `immersive | control | module | quick | full | utility`
- `activeReaderModule`: `directory | tts | appearance | settings | none`
- `activeQuickPanel`: `search | autoPage | replacement | none`
- `activeFullPanel`: `directory | tts | appearance | settings | cache | debug | none`
- `readerPage`: `pageIndex/pageCount/chapterProgress/turnDirection`
- `readerBrightness`: `value/auto/dim`
- `readerTypography`: `theme/fontSize/lineHeight/fontFamily/pageSpace`
- `readerLoading`: `requestId/status/targetRoute`

## 10. 重构验收顺序

第一轮只做结构，不追求全量业务数据：

1. `immersive-reading`：只显示 ReadingSurface、InfoLayer、TapZones；无顶部栏、无底部面板、无模块导航、无亮度 Rail。
2. `reader`：显示 ReaderTopBar、BottomControlPanel、BrightnessRail、ReaderModuleNav；正文层不重排。
3. `toc-bookmarks` / `tts` / `reader-appearance` / `reader-settings`：只替换 bottom sheet 主体；module nav 几何不变。
4. `content-search` / `auto-page` / `content-replacement`：替换 bottom sheet 主体；可关闭回 `reader`。
5. `reader-full-*`：进入 full host；ReaderModuleNav 为空；收起回对应 quick/module route。
6. 返回来源：从任何 ReaderShell presentation 返回来源页，route stack 与视觉一致。
7. reduced motion：route/控制层/模块切换即时或短反馈，最终状态一致。

暂不做：

- 真实分页测量。
- 真实书源数据。
- 换源 FlowShell 完整实现。
- fold posture、键盘安全区、无障碍、性能专项。

## 11. 对后续开发的约束

- 不再把 ReaderShell 继续扩成一个巨大的 `ReaderControlLayer`。
- 不复制 Web CSS/DOM/data selector，但必须保留 slot 关系、state 字段语义、Motion ID 和最终状态约束。
- 每次改 ReaderShell 都必须同时提供竖屏控制层截图、沉浸态截图、模块切换截图、返回来源截图。
- 任何“看起来可用”的临时跳转，如果违背 demo route/shell 关系，必须标成未完成，不能当作已对齐。
