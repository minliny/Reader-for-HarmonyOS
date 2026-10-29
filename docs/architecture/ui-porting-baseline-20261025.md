# UI 移植基线（临时快照，2026-10-25）

机器可读清单：[ui-porting-baseline-20261025.json](ui-porting-baseline-20261025.json)。显式检查入口：
`node scripts/check-header-geometry.mjs --rationale '<本次刚需原因>'`。

## 状态

- 基线仓：`Reader-for-HarmonyOS`，分支 `main`，提交 `6b1bd7534b61a8ebfac10150fd308eae8430606e`。
- 工作树为 dirty：快照时 `216 modified / 828 deleted / 135 untracked`。本清单只覆盖列出的 header 文件，不代表整仓稳定。
- `BookshelfPage.ets` 在快照期间被并行编辑；清单记录其当前内容指纹，但只校验 header 契约相关行。
- 文件身份以 SHA-256 内容指纹为准；提交号不能单独描述当前工作树。
- `default@CompileArkTS` 已通过（`BUILD SUCCESSFUL in 8 s 391 ms`，2026-10-25 S5 复核后重编译）；本次也完成了 signed HAP 的开发产物复验，但仅是开发构建证据，不代表设备安装或用户验收。
- `node scripts/check-header-geometry.mjs --rationale '<本次理由>'` 已显式通过 32 项；`node scripts/check-ui-parameter-matrix.mjs` 已通过 12 组纯函数场景。清单指纹已按 S8 源码更新。
- 本清单尚未产生 HAP 构建、签名、安装、设备截图或逐帧证据；S6/S7 后也没有新的隔离反向对照运行。

## 两条路线的边界

| 路线 | 位置 | 用途 | 约束 |
| --- | --- | --- | --- |
| 结构/移植基线 | `Reader-for-HarmonyOS`（`main`） | 其他平台的结构、几何和普通 UI 移植标准 | 后续在此树接入已完成的鸿蒙特效 |
| 鸿蒙动效开发 | `.worktrees/library-search-morph`（`codex/library-search-morph`） | 未完成的鸿蒙原生动效 | 不整体合并其 `BookshelfShell` / `SearchPage` / `Index` / scaffold 副本；特效不得拥有 header 高度、历史视口、结果顶部、inset 或 clearance |

动效 worktree 当前没有超出基线提交的新 commit，且其 `docs/issues/search-demo-parity-audit-20261025.md` 明确结论是：现有实现仍由多个 owner 互相补偿，不能作为合格方案，应先建立单一 `ReaderLibrarySearchSurface` owner。因此当前没有可移植且已验收完成的特效，P5 状态为 `BLOCKED`；禁止把该 worktree 的 WIP 直接 cherry-pick 到基线。

## Header 契约

### 回执语义（所有 scaffold 消费者）

- `ReaderFixedHeaderHost` 只测量 header 内容自身的高度；`ReaderPageScaffold` 不再接收 `headerTop`/inset/bottom 标量，只消费一个必传的 `ReaderPageGeometry`。
- 14 个 Scaffold 调用点全部显式提供 `geometry + frameStyle`：10 个走页面 resolver，4 个由宿主拥有完整 frame 的准备态/阅读壳路径显式使用 `readerEmptyPageGeometry()`（ReaderShell、LocalBookDetail/BookDirectoryPage 字体准备态、Index 同步准备态）。后者是受控例外，检查器逐点核对。完整目录已改为 `pageGeometry()`。
- Scaffold 不再接收 `variant/headerKind/readingContentKind`；阅读 underlay、system/cutout safe-area 和隐藏态由 `ReaderShell` 生成 reading `ReaderFrameStyle`。`ReaderPageShell` 只保留几何算术、标准页 spec 和 style-based modifiers。
- `header.top` 是宿主写进几何的 caller-owned margin，不包含在回执内。从 scaffold 顶边清除内容时，必须通过 `ReaderPageShell.ts#readerPresentedHeaderBottom(headerTop, headerHeight)` 合入 `headerTop`。
- 已接入：`MainTabShell`（解析 `mainTab` 几何）与 `SharedDownloadPage#contentTop`。`LocalBookDetail` 的标准/漫画详情、`BookDirectoryPage` 的标准/漫画目录都解析自己的几何。
- `ReaderFullDirectory` 用 `topBarTop()` 作为 measurement key 和原点，测量进入 `headerMeasurements`；它不从 scaffold 取顶边距离。

### 书架

- `ReaderHeaderMetrics.ts`：`floating = 52`，`standard = 58`，`APP_FLOATING_HEADER_TOP_GAP = 8`。
- `ReaderHeaderSpecs.ets#BookshelfHeaderSpec`：`barHeight = 52`、`topInset = 8`、`contentGap = 14`。
- 派生值：`frameHeight = 60`，`contentClearance = 74`。
- 唯一实测 owner：`Index.ets#shelfHeaderHeight`。`BookshelfShell` / `BookshelfPage` 只接收 `headerBottom`，内容起点为 `headerBottom + contentGap` 或 `ReaderPageGeometry.content.startInset`，不再保存第二份高度或 `headerClearance`。
- `MainTabShell` 通过 `readerPresentedHeaderBottom` 将 `headerTop = 8` 加到实测 header 上，因此实测值也是 60，首帧无跳变。

### 标准页

- `ReaderPageShell.ts#READER_STANDARD_PAGE_CONTENT_GAP = 8`，`readerStandardPageContentStart(headerHeight)` 是该 gap 的唯一算式。
- 首帧 fallback 读取 `readerPageInitialHeaderHeight('standard') = 58`，不再由页面重复写 58。
- 唯一实测 owner：`ReaderStandardPage.ets#measurements('standard:header')`，由 `ReaderPageScaffold → ReaderFixedHeaderHost` 提供，再经 `pageGeometry()` 计算 `content.startInset`。
- `ReaderMessagePreviewPage` 的顶部 overlay 复用同一标准页宿主与几何，不再写 `58/8`。

### 详情

- `ReaderHeaderSpecs.ets#DetailHeaderSpec`：`topGap = 8`、`barHeight = APP_FLOATING_HEADER_BAR_HEIGHT (52)`、`contentGap = 16`。
- 唯一实测 owner：`LocalBookDetail.ets#headerMeasurements('detail:header')`，由 `ReaderPageScaffold → ReaderFixedHeaderHost` 提供。
- `pageGeometry()` 对标准详情使用 `standardGeometry()`；对漫画详情解析 `mangaDetail` 输入（`headerTop`、header/footer insets、`footerBottom`）。`headerTop = topInset + topGap`，标准内容起点 = `headerTop + 实测高度 + contentGap`；首帧即 76，不再写 `topInset + 76` 或隐藏的 `8 + 52 + 16`。
- 漫画详情的 `mangaDirectoryContentTop` 保持既有独立 spec，不复用标准详情 gap。

### 目录

#### 全屏目录浮层

- `ReaderHeaderSpecs.ets#DirectoryHeaderSpec`：`barHeight = 54`、`radius = 24`、`topGap = 18`、`panelGap = 16`、`controlHeight = 42`、`menuGap = 2`、`menuRowHeight = 42`。
- 唯一实测 owner：`ReaderFullDirectory.ets#headerMeasurements(headerMeasurementKey())`，由 `ReaderFixedHeaderHost` 按 `topBarTop` measurement key 提供。
- 面板顶部 fallback 为 `topBarTop + barHeight + panelGap`（54 + 16），实测后为 `measured + panelGap`；离线菜单顶部为 `topBarTop + barHeight + menuGap`。不再出现 `70/56` 推导字面量。

#### 详情所属标准文本目录页

- `BookDirectoryPage.ets#BookDirectoryPageHeaderSpec`：`barHeight = APP_HEADER_BAR_HEIGHT (58)`、`toolbarHeight = READER_DIRECTORY_TOOLBAR_HEIGHT (50)`、`dividerHeight = TOK_BORDER_W (1)`、`contentGap = 5`。
- 首帧 fallback = `58 + 50 + 1 = 109`；列表起点 = 实测 + 5。
- 唯一实测 owner：`BookDirectoryPage.ets#standardMeasurements('bookDirectory:header')`。可选的目录规则按钮、筛选展开后的高度都只通过实测进入，不再由 `58 + 51` 预估；列表起点读取 `standardDirectoryScrollLayout()`。
- 恢复提示不属于本 header spec：它仍由既有消息框架 `ReaderDirectoryRecoverySurface → ReaderRecoveryNotice` 的宿主放置，本轮没有修改消息入口、样式或位置。header 检查只断言 spec 不吸收 `recoveryGap` / `recoveryTop`，不约束消息宿主位置。
- `ReaderDirectoryToolbar` 的 50vp 高度由自身导出常量提供，spec 只消费该常量。

### 下载

- 代码侧复核：`SharedDownloadPage` 没有 inline `ReaderHeaderFrame`，实际是 `ReaderPageScaffold` + `fixedHeader()`/`topBar()`。
- `measurements('download:header')` 的唯一写入点是 `topBar` 自身的 `onAreaChange`；因为 topBar 会在固定 host 与溢出内联的 `compactHeader` 之间迁移，必须由实际渲染位置量测。
- `contentTop` 通过 `readerPresentedHeaderBottom(headerTop, max(DOWNLOAD_VISUAL.headerHeight, resolvedHeaderHeight()))` 合入顶部偏移；Scaffold 的 header 回执仍故意不接入。
- 动态表面尺寸接入公共 resolver：`availableHeight()` 使用 `readerAvailableWindowHeight()`（实测 pageHeight 优先，键盘 RESIZE 不二次扣除），操作面板宽度使用 `readerDynamicSurfaceWidth()`，sheet/dialog 主体高度使用 `readerSurfaceMaxHeight()`。
- `LocalImportDialog` 的可用高度同样使用 `readerSurfaceMaxHeight()` 扣除上/下安全区和固定保留高度。

### 搜索

- `ReaderHeaderSpecs.ets#SearchHeaderSpec` 统一 panel、筛选、摘要和统计区域。
- 关键值：外侧 inset `16/20`、圆角 `13`、边框 `1`、panel 底距 `6`、bar padding `6/12/4/4`、筛选最小高 `44`、标签行高 `17`、筛选预留 `12/8/88/180/300`、摘要 `34/21/39/158`、统计 fallback `36`。
- 自然高度 fallback 只允许走 `readerSearchHeaderHeight`，并保留无会话、筛选收起、筛选展开三个惰性分支。
- 唯一实测 owner：`SearchPage.ets#fixedHeaderHeight`，由 `ReaderFixedHeaderHost` 通过 `searchHeaderMeasurementKey` 提供。
- 控制高度与动作宽度继续由 `ReaderControlSpecs.ets` 提供，不复制进 `SearchHeaderSpec`。

### 动效

- `MotionSpec.ets` 是 `reader.*`、`dropdown.*`、`bookshelf.*`、`source.switch.*`、`manga.*`、`search.*`、`message.*` 的唯一时长/曲线注册表；源码禁止数字型 `animateTo({ duration: N })` / `animation({ duration: N })`。
- `ReaderMotionPolicy.ets` 是 reduceMotion 唯一入口；持久化 key、0 时长收缩、曲线保留都在此实现。控制栏的 0 时长由 `ReaderControlMotionPolicy#readerControlMotionMs` 收敛。
- 筛选展开/收起使用 `search.filters.toggle`（180ms，`Curve.EaseInOut`）；减少动效时时长置 0，保留曲线。
- 源开关、漫画目录折叠/面板 scrim/下拉复位、本地导入接力、消息 toast 分别消费已登记条目；生成型视觉稿只提供原始数值，消费点不再重复构造曲线。
- MotionSpec 只保留 duration/curve/reduceMotion/contract id；panel actor 的 `fromY/delay` 由 `ReaderPanelMotionContract.ts` 拥有，本地导入 delay 由 `LocalImportMotion.ts` 拥有。控制栏 TopBar/Dock 端点由 `ReaderControlMotionGeometry` 的空间采样拥有。
- 页面落位由 `ReaderPageSettlementTimeline` 的距离/速度时钟拥有；`ProductMotionTiming` 只保存 rapid/min/max/宽度系数。
- 非 ArkUI 采样器单独登记：`ReaderSessionLaunchTimeline.ts` 拥有 3500ms 启动时间轴全部 beat / 阶段边界 / 24vp 点尺寸 / 4vp 暂停间距；`ReaderTtsWaveformModel.ts` 拥有波形高度、颜色、尾迹、循环、错峰常量。Launch presentation 和 waveform sampler 不再内联这些时间数字。
- 控制动效的 140/70/13/52/57/93/20 等组合系数已命名为 `READER_CONTROL_MOTION_*`；亮度轨道/190vp/13.56vp 继续由 `ReaderControlGeometry` 拥有。
- 消息显示时长由 `ReaderTransientFeedback.ts` 的三个命名常量拥有（brief 2000 / extended 2200 / dedupe 2000）；调用点不写字面量，消息类别、宿主与生命周期不变。

## 移植规则

1. 每个 surface 只有一个已解析 spec。
2. 只有一个实测 owner；消费者只读已解析几何。
3. fallback 必须是同一 spec 的纯函数。
4. 动效只消费已登记 timing，不拥有几何。
5. 其他平台使用本清单的逻辑值，通过目标平台原生 token/adapter 实现；不导入鸿蒙类型。
6. 鸿蒙特效若需要不同几何，先登记基线 contract request，不能让特效自己持有几何。

## Frame / Scroll / 固定尺寸

- `ReaderFrameStyle.ts`：Feature 解析背景、clip、alignment、safe-area 和 header/footer surface；Scaffold 只消费样式对象。
- `ReaderScrollLayout.ts`：统一 `startInset/endInset/mode`。标准页由 `ReaderPageScrollHost` 应用 padding；Search、Bookshelf、Download、SourceManagement、MultiSelect 的原生 List 使用 `contentOffset` 契约；`ReaderDirectoryList`、`ReaderDirectoryNavigationList`、`ReaderDirectoryNavigationSurface` 的 numeric inset props 已替换为 `scrollLayout`，原生 List/Grid、LazyForEach 和锚点生命周期仍由目录宿主持有；阅读 page-turn/reader 保留原生滚动所有权。
- `docs/architecture/fixed-size-policy-20261025.json`：九个 feature 文件的全部 212 处数字 `.height()` 已按 `design-token/icon/touch/feature-panel` 分类；内容文字行改为 `constraintSize(minHeight)`；新增未登记高度会使检查器失败。
- 完整目录已接入统一测量链：`pageGeometry()` 读取 `ReaderMeasurementStore` 的实测 header，`fullPanelTop()` 返回 `geometry.content.startInset`，不再使用空几何例外。
- `SourceSwitchWindow` 已接入 `ReaderScrollLayout`；`ReaderControlSearchContent` 的 native normalized end offset 已在源码和检查器中登记为 feature 专用滚动例外。

## 检查边界

`scripts/check-header-geometry.mjs` 是源码级显式检查，包含 32 项：常量单 owner、返回栏消费共享高度、书架单实测 owner、scaffold 仅消费 geometry+frameStyle、14 个调用点显式几何与 4 个空几何例外、回执不含 headerTop、详情/标准文本目录/标准页 content start、全屏目录 spec、下载单量测 owner、搜索 spec/纯 fallback/builder、筛选动效登记、reduceMotion 单入口、控制专用时长复用公共 reduceMotion、控制端点常量单 owner、动效条目与消费、panel actor 端点、无字面量动效时长、非 ArkUI 启动/波形时钟、单宽断点、页面落位常量、消息显示时长、动态表面 resolver 生产接入、控制动效组合系数、frame style 拆分、滚动契约与例外、完整目录测量链、固定尺寸分类、动态控件高度。

`scripts/check-ui-parameter-matrix.mjs` 是显式纯函数场景矩阵，包含 12 组：宽度 600 边界、窗口能力、字体缩放、键盘/安全区可用高度、弹窗宽高、滚动 layout 两种模式、frame style 默认值、翻页落位时钟、启动动效 p=0/1 端点、控制栏展开/收起端点、TTS reduceMotion/尾迹、消息窗口常量。矩阵直接执行生产 TS 模块，不复制实现。

- 不会由构建、CI、contract tier、scope 或默认门禁自动执行；必须提供 `--rationale`。
- 证明源码所有权与重复字面量规则，不证明真机布局、首帧绘制、文本测量或 HAP 产物。
- 修改清单内文件后，先运行该检查；接受变更时同步更新 JSON 中的 SHA-256。
- 旧版 13 项检查曾做三项反向对照（详情 `topInset + 76`、目录列表起点 `standardHeaderHeight + 5`、Shell `height + headerTop`）；S6–S9 重写为 32 项并新增 12 组纯函数矩阵后尚未重新运行隔离反向对照，结果记为 `NOT_RUN`，不能沿用旧结论。消息宿主位置不在本检查范围内。

## 尚未完成

- P5：阻塞。动效 worktree 尚无已完成特效，其自身复审结论也要求先建立单一 surface owner；当前不得把 WIP 直接移植到基线。
- P6：在明确刚需下选择局部回归项；不自动补跑全量。
- 其他平台尚未消费本清单；每个平台仍需自己的原生适配与视觉验证。
- S7 后交互式演示已覆盖几何、字号、断点、动效与消息窗口；设备/HAP 验收仍未执行。源码、编译、静态检查和纯函数矩阵通过不代表原生画面、首帧、字体测量或交互已验收。
- `.worktrees/library-search-morph` 仍不在本轮输入内。
