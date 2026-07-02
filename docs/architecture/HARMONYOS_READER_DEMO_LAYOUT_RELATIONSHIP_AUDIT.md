# ReaderShell demo 布局、大小和相互关系审计

本文件补充 `HARMONYOS_READER_DEMO_STRUCTURE_REAUDIT.md` 没覆盖的几何信息。共用结构、模块归属和按钮交互导致的结构变化见 `HARMONYOS_READER_SHARED_STRUCTURE_INTERACTION_MATRIX.md`。它记录的是规范 demo（`frontend-demo`）的布局约束、尺寸关系、层级关系和命中关系，用来指导 HarmonyOS ArkUI 原生实现。

重要边界：

- 这里的数值来自 Web demo 的 CSS/renderer，是设计和验收参照，不是 HarmonyOS 实现接口。
- ArkUI 侧不能复制 CSS/DOM/data selector，但应保留这些语义关系：slot 锚点、尺寸比例、互斥区域、点击热区、z 轴和最终状态。
- HarmonyOS 应用应把这些数值转成本地 token、vp、safe area、窗口断点和组件约束。

## 1. 来源文件

本审计读取：

- `/Users/minliny/Documents/Reader UI/frontend-demo/tokens.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/shared-shell-kit/kit.js`
- `/Users/minliny/Documents/Reader UI/frontend-demo/shared-shell-kit/kit.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/render-runtime.js`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/01-shell-layout.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/02-main-library.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/03-reader.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/04-settings-source.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/06-responsive.css`

文字层级、字号、行高和文本 bounds 另见：

- `/Users/minliny/Documents/Reader for HarmonyOS/docs/architecture/HARMONYOS_READER_TEXT_TYPOGRAPHY_AUDIT.md`

## 2. 基础设备画布和断点语义

demo 的基础设计画布：

| 项 | demo token / 值 | 含义 |
|---|---:|---|
| phone 宽度 | `390px` | 标准竖屏 ReaderFrame 宽度 |
| phone 高度 | `844px` | 标准竖屏 ReaderFrame 高度 |
| stack phone 高度 | `878px` | 普通 stack 页面高度 |
| reader bottom sheet 最小高度 | `284px` | 控制层底表最小语义高度 |
| reader module nav 高度 | `82px` | 模块导航语义高度 |
| 主导航高度 | `68px` | MainTabShell 主导航语义高度 |
| safe area top | `24px` | demo 安全区参考 |
| safe area bottom | `14px` | demo 安全区参考 |

断点语义：

| viewport class | 结构变化 |
|---|---|
| `standard-portrait` / phone | 竖屏底部控制层；sheet 横跨底部，模块导航在底部同一控制平面内 |
| `expanded-width` | reader dock 右侧锚定，控制 sheet 和模块 nav 使用同一 dock 宽度 |
| `tablet-expanded` | reader dock 右侧锚定；正文右侧避开 dock |
| `compact-landscape` | 全屏横屏；右侧 compact dock，正文右边界避开 dock |

## 3. z 轴与命中关系

demo 的层级 token：

| 层 | z token / 值 | 关系 |
|---|---:|---|
| content | `0` | 正文基础层 |
| overlay | `10` | ReaderOverlayHost |
| bottom sheet | `30` | BottomSheetHost / FullHost |
| reader module nav | `40` | 模块导航在 sheet 之上 |
| dialog | `60` | 更多菜单、弹窗等 |
| keyboard | `70` | 键盘最高 |

命中规则：

- `ReaderOverlayHost` 自身不应吞点击，只有内部 button、bottom sheet、module nav 接收点击。
- 沉浸态三段热区接收点击，信息层不接收点击。
- 非沉浸态正文中部 dismiss zone 接收点击，用来隐藏控制层。
- 亮度 Rail 只允许自身区域接收拖动/点击，不应使用全屏透明层挡住顶部栏、正文 dismiss 或模块导航。

## 4. 沉浸阅读布局

标准 phone 画布为 `390 x 844` 时，沉浸阅读的核心几何如下：

| 元素 | demo 约束 | phone 上的关系 |
|---|---|---|
| ReadingBackground | `inset: 0` | 覆盖整个 ReaderFrame |
| ReadingTextLayer | `top 72 / left 32 / right 32 / bottom 48` | 正文框约 `326 x 724` |
| BrightnessDim | `inset: 0`, z=2, pointer none | 覆盖全屏但不接收点击 |
| ImmersiveInfoLayer | `top 26 / left 24 / right 24 / bottom 22` | 两列三行：左上书名，右上时间，左下进度，右下页码/胶囊 |
| TapZones | `inset: 0` | 左 26%、中 48%、右 26% |

沉浸态关系：

- 正文层不因控制层出现而改变尺寸；控制层只是覆盖在上方。
- 运行胶囊位于 ImmersiveInfoLayer 右下区域；有 session 时右下区域可跨列但仍靠右。
- 打开控制层只替换 overlay 内容和 bottom sheet/nav 可见性，不重建 ReadingTextLayer。

ArkUI 约束：

- `ReaderReadingSurfaceSlot` 必须先绘制 background/text/dim。
- `ReaderImmersiveInfoLayer` 和 `ReaderTapZones` 应作为 overlay 子层，但 info layer hit test 关闭。
- 左/中/右热区应有稳定百分比宽度，不要用单个全屏 click handler 替代。

## 5. 标准 phone 控制层布局

### 5.1 顶部阅读栏

标准 phone：

| 项 | 值 |
|---|---:|
| top | `18px` |
| left/right | `14px` |
| min-height | `54px` |
| horizontal padding | `12px` |
| grid columns | `44px / 1fr / 62px / 34px` |
| gap | `8px` |

关系：

- 顶部阅读栏是 ReaderOverlayHost 的独立层，不属于 bottom sheet。
- 返回按钮、标题/来源、换源、更多的列宽稳定。
- 标题区域是唯一弹性列；按钮尺寸不被标题挤压。
- 标题列文本必须左对齐，起点在返回按钮 44vp 热区右侧的 8vp gap 后；不能在顶栏内整体居中。
- 返回、换源、更多都应使用同一 42vp 高度热区；不要让默认按钮内边距把任意一列撑高。

### 5.2 底部控制 sheet

标准 phone：

| 项 | 值 |
|---|---:|
| sheet left/right | `12px` |
| sheet bottom | `18px` |
| sheet height | `330px` |
| sheet border radius | 大圆角 |
| grabber top | `9px` |
| grabber size | `42 x 4px` |

小横条关系：

- compact 控制层的小横条属于 `BottomSheetHost` 顶部独立定位元素，不属于左侧 `BottomControlPanel` 的内容流。
- 小横条 top 为 `9px`，主体和 Rail 从 `reader-quick-top = 28px` 开始；因此小横条不能推高或压缩左侧动作区、章节区。
- full / utility 面板内的收起横条是另一套 `ReaderFullHost` 结构，不能和 compact 控制层的小横条共用布局语义。

sheet 内部局部变量：

| 变量 | 默认值 | 含义 |
|---|---:|---|
| `reader-quick-top` | `28px` | 面板主体和 Rail 的上边界 |
| `reader-quick-bottom` | `110px` | 为底部模块导航预留的下边界 |
| `reader-quick-rail-width` | `38px` | 亮度 Rail 宽度 |
| `reader-quick-rail-gap` | `14px` | 面板主体与 Rail 的间距 |

### 5.3 BottomControlPanel 与 Rail 的水平关系

标准 phone 下，sheet 宽度约为 `390 - 12 - 12 = 366px`。

| 元素 | sheet 内约束 | 页面上的近似位置 |
|---|---|---|
| BottomControlPanel | left `12px`, right `12 + 38 + 14 = 64px` | x `24px` 到 `314px` |
| BrightnessRail | right `12px`, width `38px` | x `328px` 到 `366px` |
| Panel 和 Rail 间距 | `14px` | x `314px` 到 `328px` |

垂直关系：

| 元素 | sheet 内约束 | 说明 |
|---|---|---|
| BottomControlPanel | top `28px`, bottom `110px` | 默认控制层主体，不碰模块导航 |
| BrightnessRail | top `28px`, bottom `110px` | 和主体同高，固定竖向在右侧 |
| quick mode | `reader-quick-bottom = 12px` | 快捷面板可使用更高区域 |

关键结论：

- 亮度条不是 bottom panel 里的一行；它是 sheet 内右侧独立竖向 Rail。
- 章节进度是 panel 内横向 progress；亮度是右侧竖向 slider，两者必须同时存在。
- panel 主体必须给 Rail 留出固定右侧宽度和 gap，不能靠覆盖到正文上“凑位置”。
- panel 主体和 Rail 的 top/bottom 必须同源；在 phone compact 控制层里，两者都从 `reader-quick-top` 到 `reader-quick-bottom`，不能让 Rail 高于或低于左侧两块主体的合并高度。

### 5.4 BottomControlPanel 内部关系

默认 reader 控制面板：

| 区域 | 约束 |
|---|---|
| 主体 grid | 两行：快捷动作区 + 章节进度区 |
| rows | `minmax(70px, 0.82fr)` + `minmax(96px, 1.18fr)` |
| gap | `6px` |
| 快捷动作 | 3 列等宽，gap `8px`, padding `9px 8px` |
| 章节进度 | 两行：章节控制 + 横向 progress |
| 章节控制列 | `34px / 1fr / 34px` |
| progress 行 | `auto / 1fr / auto` |

### 5.5 运行中 session 的控制层上方胶囊

当前 demo 不再把 running space 插入 `BottomControlPanel` 的内容流。控制层打开且存在朗读/自动翻页 session 时，复用沉浸态 session capsule 的视觉结构，并由 `ReaderControlSessionHost` 锚在 bottom sheet 上方：

| 区域 | 约束 |
|---|---|
| ReaderControlSessionHost | `position: absolute`，`right: 24px` |
| bottom | `18px + 330px + 8px`，即 sheet 顶部上方 `8px` |
| capsule | 高约 `26px`，宽约 `110px` |
| 关系 | 不占用 `BottomControlPanel` 高度，不推动 QuickActions / ChapterPanel |

ArkUI 约束：

- 运行胶囊是 session 的第二个锚点，不是另一个运行控制器。
- 打开控制层时，沉浸底部信息层消失，胶囊重锚到控制层上方。
- `BottomControlPanel` 的快捷动作区和章节进度区高度不因 session 存在而改变。

ArkUI 约束：

- 快捷动作按钮数量固定为 3，尺寸稳定。
- 章节上/下一章按钮固定方形；中间章节名弹性。
- progress 与 Rail 的 slider 不应共用组件实例。

## 6. 模块导航布局

标准 phone：

| 项 | 值 |
|---|---:|
| left/right | `24px` |
| bottom | `32px` |
| min-height | `78px` |
| padding | `8px` |
| columns | `repeat(4, 1fr)` |
| gap | `4px` |
| icon shell | `42 x 42px` |
| item rows | `42px / 16px` |
| item gap | `4px` |

关系：

- 模块导航是独立 slot，与 bottom sheet 同级，不是 panel 的子组件。
- 视觉上它位于 sheet 底部控制平面上方，z-index 高于 sheet。
- `reader`、模块、快捷、loading 状态下，模块导航的位置和按钮几何保持稳定。
- full page 和 utility page 下模块导航为空。

ArkUI 约束：

- `ReaderModuleNav` 必须独立组件渲染。
- 选中态只改颜色和图标背景，不改按钮宽高、gap、padding。
- 模块切换只替换 `BottomSheetHost` 主体，不移动 `ReaderModuleNav`。

## 7. 模块、快捷、loading 面板共用的主体边界

默认 phone 下，这些面板使用同一主体边界：

| 面板 | left | right | top | bottom |
|---|---:|---:|---:|---:|
| `ReaderControlMain` | `12px` | `12 + railWidth + railGap` | `reader-quick-top` | `reader-quick-bottom` |
| `ReaderModulePanel` | 同上 | 同上 | 同上 | 同上 |
| `ReaderQuickPanel` | 同上 | 同上 | 同上或 quick mode bottom | `12px` 或 `110px` |
| `ReaderLoadingPanel` | 同上 | 同上 | 同上 | 同上 |

关系：

- 这些面板互斥替换，不是上下叠加。
- 任何一个面板出现时，右侧 Rail 的占位关系不变。
- loading 是 ReaderShell 内联 loading，不是全屏 loading。

## 8. 完整页和 utility panel 布局

full page 使用 full host，不是普通 bottom sheet 的一部分。

标准 phone：

| 项 | 值 |
|---|---:|
| FullHost | `inset: 0`, z 与 bottom sheet 同级 |
| FullPagePanel left/right | `12px` |
| FullPagePanel top | `88px` |
| FullPagePanel bottom | `18px` |
| Panel rows | `30px / 1fr` |
| gap | `8px` |
| padding | `18px 12px 12px` |
| Full grabber | `42 x 4px`, top `9px`, centered |
| Full head | `1fr / auto` |
| 收起按钮 | min-height `26px`, horizontal padding `10px` |

关系：

- full page 保留 ReadingSurface 和 ReaderTopBar。
- full page 不显示模块导航。
- full page 不是 SettingsShell，也不是新的主页面。
- full content 是内部滚动区域；外层面板几何稳定。

ArkUI 约束：

- `ReaderFullPanel` 应由 `ReaderBottomSheetHost` 根据 `readerMode=full` 切换到 full container。
- 不要把 full panel 当成 compact panel 的普通内容。

## 9. compact-landscape 布局关系

compact-landscape 是右侧 dock，不是底部全宽 sheet。

关键变量：

| 项 | 值 |
|---|---:|
| frame width/height | `100vw / 100vh` |
| dock right | `16px` |
| dock width | `min(340px, 46%)` |
| dock nav bottom | `16px` |
| dock nav height | `54px` |
| dock gap | `-1px` |
| sheet bottom | `16 + 54 - 1 = 69px` |
| control sheet height | `230px` |
| module sheet height | `230px` |
| quick top | `18px` |
| rail width/gap | `30px / 8px` |
| brightness track | `58px` |

ReaderTop compact-landscape：

| 项 | 值 |
|---|---:|
| top | `12px` |
| left/right | `14px` |
| min-height | `48px` |
| grid columns | `40px / 1fr / 58px / 32px` |
| gap | `6px` |
| padding | `0 10px` |

ReadingTextLayer：

| 状态 | inset |
|---|---|
| compact-landscape | `top 74px / right reader-dock-reading-right / bottom 24px / left 30px` |
| dock reading right | `384px` |

模块导航 compact-landscape：

| 项 | 值 |
|---|---:|
| right | dock right |
| bottom | `16px` |
| width | dock width |
| min-height | `54px` |
| item rows | `28px / 12px` |
| icon shell | `28 x 28px` |
| font | `9px` |

关系：

- sheet 和 module nav 组成右侧连续 dock：module nav 在下，sheet 在上，二者宽度一致。
- `reader-dock-gap = -1px` 用来消除视觉断缝；ArkUI 侧应实现为同一 dock 容器内的连续上下分区，避免看起来像两个漂浮块。
- 正文右边界必须避开 dock，不能被右侧控制层遮住。
- compact-landscape 下 Rail 缩窄，track 缩短，不能保持 phone 竖屏尺寸。

## 10. expanded-width / tablet-expanded 布局关系

共同逻辑：

| 项 | expanded-width | tablet-expanded |
|---|---:|---:|
| dock right | `18px` | `24px` |
| dock width | `min(340px, frame - 36px)` | 同 |
| nav bottom | `32px` | `32px` |
| nav height | `79px` | `79px` |
| sheet bottom | `32 + 79 - 1 = 110px` | 同 |
| control sheet height | `252px` | `252px` |
| module sheet height | `min(252px, frameHeight - 212px)` | 同 |

ReadingTextLayer：

| 状态 | 约束 |
|---|---|
| expanded/tablet 基础 | `top 92px / left 44px / right 44px / bottom 56px` |
| tablet control/module | `right = dockRight + dockWidth + 36px` |

ReaderTop：

| 状态 | 约束 |
|---|---|
| tablet-expanded | left/right `28px` |

关系：

- expanded/tablet 下，控制 dock 锚定右侧，正文避开 dock。
- sheet 和 module nav 仍使用同一 dock width。
- 模块 nav 与 sheet 的视觉边界应连续，不应产生“上下两个独立卡片”的割裂。

## 11. source-switch continuity 布局关系

source-switch 是 FlowShell，但会保留阅读控制层连续性。

tablet/compact source continuity：

| 项 | tablet-expanded | compact-landscape |
|---|---:|---:|
| reader top | top `18px` | top `12px` |
| module nav | top `112px`, bottom auto | top `74px`, bottom auto |
| reading layer | `top 206 / right 24 / bottom 260 / left 24` | `top 136 / right 24 / bottom 48 / left 24` |
| sheet | right `12px`, bottom `18px`, width `min(340px, 100% - 24px)` | 同 |
| sheet height | `230px` | `196px` |
| quick bottom | `48px` | `48px` |
| module nav width | `min(320px, 100% - 48px)` | 同 |

关系：

- source-switch 不是遮罩全屏弹窗。
- 顶栏、控制面板、模块导航仍是同一阅读平面里的可操作对象。
- source-switch 窗口必须避开顶栏、控制面板和模块导航。

第一阶段如果不做 source-switch，应把按钮标为未实现或保留占位，不应临时跳到调试/缓存并宣称对齐。

## 12. HarmonyOS 当前布局状态（2026-07-02 验证后）

当前文件：

- `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/components/ReaderSurface.ets`
- `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/components/ReaderControlLayer.ets`

已落地到 ArkUI 的布局约束：

| 结构 | demo CSS 来源 | ArkUI 当前约束 |
|---|---|---|
| `ReaderTopBar` | `.fd-reader-top` | phone top `18vp`，left/right `14vp`，height `54vp`，浅色浮动卡片，列宽按返回/标题/换源/更多分配 |
| `ReaderBottomSheetHost` | `.fd-reader-sheet` | phone left/right `12vp`，bottom `18vp`，height `330vp`，浅色 sheet |
| `PanelBodyFrame` | `.fd-reader-control-main` / `.fd-reader-module-panel` | sheet 内 left `12vp`，top `28vp`，bottom `110vp`，right 预留 `12 + railWidth + railGap` |
| `BrightnessRail` | `.fd-brightness-rail` | sheet 内 right `12vp`，top `28vp`，height `sheetHeight - top - bottom`，固定竖向 |
| `ReaderModuleNav` | `.fd-reader-module-nav` | phone left/right `24vp`，bottom `32vp`，height `78vp`，与 sheet 同级，不进入主体内容流 |
| `MoreMenu` | `.fd-reader-more-menu` | top `74vp`，right `12vp`，width `214vp`，顶栏同层弹出，不加暗色蒙版 |
| `ReaderFullHost` | `.fd-reader-full-page-panel` | phone left/right `12vp`，top `88vp`，bottom `18vp`，隐藏 module nav 和 rail |
| right dock 预留 | `.fd-reader-frame` expanded/tablet/landscape token | 已建立 `ReaderPanelMode.sideDock` 下 sheet/nav 同宽同右锚点的基础，后续还要验证横屏/平板实机截图 |

当前 phone 验证取自 1280 x 2832 虚拟机截图；对应的是 ArkUI 实际 dump bounds，不是 Web CSS 直接复制。下表只记录结构和相对关系，具体书名、章节、进度、页码必须来自 `ReaderContext` 或真实平台状态：

| 结构 | 证据文件 | 关键 bounds / 状态 |
|---|---|---|
| 沉浸阅读 | `artifacts/reader-ui-slice/layout-current-immersive.json` | 只显示沉浸信息层和正文层；不出现 `换源`、`搜索`、`亮`、`目录/朗读/界面/设置` |
| 顶栏 | `artifacts/reader-ui-slice/layout-current-control.json` | `活着` `[496,237][602,299]`，`换源` `[850,220][1067,367]`，`⋯` `[1067,220][1186,367]` |
| 顶栏左对齐修正 | `artifacts/reader-ui-slice/layout-topbar-align-control.json` | 顶栏 `[49,199][1231,388]`；返回热区 `[94,220][248,367]`；标题列 `[276,220][794,367]`；换源 `[822,220][1039,367]`；更多 `[1067,220][1186,367]`，三处按钮热区同高，标题从返回热区右侧开始左对齐 |
| quick actions | `artifacts/reader-ui-slice/layout-current-control.json` | `搜索` `[118,1725][377,1908]`，`自动翻页` `[405,1725][665,1908]`，`内容替换` `[693,1725][952,1908]` |
| 章节控制 | `artifacts/reader-ui-slice/layout-current-control.json` | `上一章`、章节标题、`下一章` 三段同一行；进度条下方只显示真实进度，不写死总章节数 |
| 亮度 Rail | `artifacts/reader-ui-slice/layout-current-control.json` | `亮` `[1107,1662][1146,1707]`，位于 sheet 右侧固定竖向区域 |
| 小横条和 Rail 对齐修正 | `artifacts/reader-ui-slice/layout-rail-grabber-control.json` | 小横条 `[567,1585][714,1599]`；左侧主体 `[87,1617][1011,2283]`；亮度 Rail 容器 `[1060,1617][1193,2289]`，确认小横条不进入左侧主体流，Rail 与左侧主体同顶边 |
| 模块导航 | `artifacts/reader-ui-slice/layout-current-control.json` | `目录` `[197,2542][282,2591]`，`朗读` `[460,2542][545,2591]`，`界面` `[722,2542][807,2591]`，`设置` `[985,2542][1070,2591]` |
| 更多菜单 | `artifacts/reader-ui-slice/layout-current-more.json` | 菜单项从 `刷新本章` 到 `调试信息` 存在，控制层元素仍存在；截图无可见暗色蒙版 |
| 更多菜单关闭 | `artifacts/reader-ui-slice/layout-current-more-closed.json` | `刷新本章` 等菜单项消失，`换源`、`搜索`、`目录/朗读/界面/设置` 仍存在 |
| 返回来源 | `artifacts/reader-ui-slice/layout-current-return-bookshelf.json` | 回到 `书架`、`继续阅读`、`我的书架`，不再出现阅读控制元素 |
| reduced-motion | `artifacts/reader-ui-slice/layout-current-reduced-motion.json` | `减少动态效果` 开启，说明文案为 `关闭大幅位移和长过渡。`；`ReaderMotion.snapshot(true)` 将相关 duration 置 0 |

仍未完成的布局缺口：

1. 横屏/平板下正文层尚未按 `dockRight + dockWidth + 36` 完整避让右侧 dock。
2. source-switch continuity 还未实现；换源按钮仍是占位。
3. MoreMenu 的外部点击关闭已验证；但控制层整体 dismiss zone 还未完全回到 shared ReadingSurface hit-test 模型。
4. 模块面板、quick panel、full/utility 的内部密度和真实内容还只是骨架，不等于 demo 全量视觉完成。
5. 图标仍是 ArkUI 文本占位，后续应替换为原生图标组件或本地 vector asset。
6. ArkUI 颜色必须使用 6 位色或明确 `#AARRGGBB`；不能把 Web `#RRGGBBAA` 直接搬过来，否则透明度会被错误解释成颜色通道。

## 13. ArkUI 重构的布局落点

建议 ArkUI 用这些本地组件承接几何关系：

| ArkUI 组件 | 承接 demo 几何 |
|---|---|
| `ReaderFrame` | 设备画布、safe area、断点、reader dock token |
| `ReaderReadingSurfaceSlot` | background/text/dim/dismiss zone |
| `ReaderOverlayHost` | overlay 平面和 hit test 规则 |
| `ReaderTopBar` | top/left/right/minHeight/grid columns |
| `ReaderBottomSheetHost` | phone bottom sheet、right dock、full host |
| `ReaderPanelBodyFrame` | 主体 left/right/top/bottom，右侧 Rail reserve |
| `ReaderBrightnessRail` | sheet 内右侧竖向 rail |
| `ReaderModuleNav` | 独立 slot，四等分按钮，稳定几何 |
| `ReaderDockFrame` | landscape/tablet 下 sheet + nav 的连续右侧 dock |
| `ReaderFullPanel` | full host 几何 |

ArkUI token（来自 demo CSS 语义，单位按 ArkUI vp 落地）：

```text
readerFrame.phone.width = 390vp
readerFrame.phone.height = 844vp
readerTop.phone = { top: 18, left: 14, right: 14, minHeight: 54 }
readerSheet.phone = { left: 12, right: 12, bottom: 18, height: 330 }
readerSheet.body = { left: 12, top: 28, bottom: 110, railWidth: 38, railGap: 14 }
readerModuleNav.phone = { left: 24, right: 24, bottom: 32, minHeight: 78, padding: 8, gap: 4 }
readerDock.landscape = { right: 16, widthMax: 340, widthRatio: 0.46, navBottom: 16, navHeight: 54, sheetHeight: 230 }
readerDock.tablet = { right: 24, widthMax: 340, navBottom: 32, navHeight: 79, sheetHeight: 252 }
readerFullPanel.phone = { left: 12, right: 12, top: 88, bottom: 18 }
```

这些 token 是 ArkUI 本地设计 token；命名可调整，但关系不能丢。

## 14. 下一步验收必须看布局关系

下一轮实现不能只看“组件存在”，必须看这些证据：

1. phone `reader`：顶部栏浮动；底部 sheet 宽度和高度正确；Rail 在 sheet 内右侧；module nav 独立且位置稳定。
2. phone `toc-bookmarks`：sheet 主体替换为目录面板；Rail 和 module nav 不移动。
3. phone `content-search`：quick panel 使用正确高度；module nav 保持稳定或按 demo route 语义显示。
4. phone `immersive-reading`：无 top bar、无 sheet、无 module nav、无 Rail；只有沉浸信息和三段热区。
5. compact-landscape：右侧 dock 连续，正文避开 dock，不出现两个分裂浮块。
6. tablet-expanded：正文右边界避开右侧 dock；sheet 和 nav 同宽同锚点。
7. full panel：top `88`、bottom `18` 的 full host；无 module nav。
8. 返回来源：点击顶部返回能回到来源页，Rail/overlay 不拦截 hit test。

任何截图只证明“看见了元素”是不够的；必须同时证明位置、大小、层级、点击关系和 route state 一致。
