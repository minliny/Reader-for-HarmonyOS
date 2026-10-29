# UI 参数契约（2026-10-25）

本契约解决两个原始问题：

1. 参数复用不足、新元素未纳入整体框架；
2. 参数写死为常量，不能随视口、字体缩放、安全区、内容测量和展开状态动态调整。

## 1. 参数分类

每个布局参数只能属于一类；消费方必须按类别读取，不能把 token 直接当作动态布局高度。

| 类别 | 来源 | 示例 | 消费规则 |
|---|---|---|---|
| 设计 token | 设计稿 | 颜色、圆角、24 图标、44 触控下限 | 可直接使用；不得直接充当会随内容/字号变化的高度 |
| 环境推导 | 窗口事实 + resolver | 内容框、安全区、顶栏高度、弹窗最大高度 | 必须经 `ReaderPageGeometry` 或 `ReaderSurfaceResolvers` |
| 内容实测 | 原生测量 | header/footer/dock/sheet 高度 | 只能经 `ReaderMeasurementStore` 写入，带 generation |
| 状态推导 | 页面状态机 | 展开/收起、管理态、选择态 | 状态 → 几何；不得为两个状态各写一套常量 |
| 动效 | `MotionSpec` / `ReaderMotionPolicy` | 时长、曲线、actor 端点、reduceMotion | 时长/曲线必须登记；actor 端点随条目登记；控制栏端点由 `ReaderControlMotionGeometry` 空间采样拥有 |

## 2. 单一几何契约

`ReaderPageGeometryInput` → `resolveReaderPageGeometry()` → `ReaderPageGeometry`

- 输入只表达设计意图和实测事实：`headerHeight`、`footerHeight`、`contentGap`、`contentMaxWidth`、`contentEndInset`、`chromeMode`。
- resolver 统一计算：`header.bottom = top + height`、`header.clearance = bottom + gap`、`footer.top`、`content.startInset/endInset`、内容水平框、width class。
- `ReaderPageScaffold` 只消费 `geometry + frameStyle`；过渡标量 API 已删除，两者都是必传 prop。全部 14 个调用点都显式提供；其中 4 个由宿主自己拥有完整 frame 的准备态/阅读壳路径（ReaderShell、LocalBookDetail/BookDirectoryPage 字体准备态、Index 同步准备态）显式调用 `readerEmptyPageGeometry()`，不是隐藏默认值。完整目录已改为解析自己的 geometry。
- `MainTabShell`、标准页、搜索、下载、书架详情/目录/多选、源码管理各自解析几何和 frame style 后传入；漫画详情与漫画目录也通过同一路径解析，不再保留独立标量通路。
- `ReaderPageGeometryInput.variant` 已删除；它未参与几何计算。页面类型对视觉的影响由 `ReaderFrameStyle` 表达。
- 首帧 fallback 与实测后结果必须由同一 resolver 产生；禁止第二套加法。

## 2.1 Frame style 契约

`ReaderFrameStyle` 由页面/Feature 解析，Scaffold 只消费：

- `backgroundColor`、`clip`、`alignment`；
- `safeArea: 'none' | 'systemVertical' | 'systemCutoutAll'`；
- `header` / `footer` 的 solid/transparent、clip 和背景色。

`ReaderPageScaffold` 不再接收 `variant`、`headerKind`、`readingContentKind`，也不再直接映射 `TOK_*` 业务色。`ReaderPageShell` 只保留几何算术、标准页 spec 和 frame modifier；路由到视觉的映射留在各 Feature 的 `frameStyle()`。阅读页的 underlay、system/cutout safe-area 和隐藏态由 `ReaderShell` 生成 reading style，不再污染通用 Scaffold。

## 3. 测量契约

`ReaderMeasurementStore.record(key, height, generation)`：

- 只接受有限、非负高度；
- generation 倒退的旧回执拒收；
- 同一 key、同一 generation、同一高度不触发重渲染；
- 页面只保留一个 `measurementRevision` 作为渲染依赖，不再为每个高度各留一份 `@State`。

key 采用 `<route>:<surface>`，例如 `search:header`、`download:dock`、`shelf:header`。

## 4. 断点契约

`ReaderWidthClass = 'compact' | 'expanded'`，唯一阈值 600vp，入口 `readerWidthClass()` / `readerIsExpandedWidth()`。

页面不得再定义 600 常量，也不得用 `deviceInfo.deviceType` 决定布局。`ReaderLayoutCapability.ts#readerExpandedLayout(metrics)` 只从窗口宽度产生 `expandedLayout` 能力；Index、搜索、发现、RSS、设置、阅读控制等宿主把它作为 prop 下发。漫画持久目录只使用 `mangaUsesPersistentDirectory(width, height)`，不再接收设备类型输入。

## 5. 动态尺寸契约

`ReaderSurfaceResolvers` 提供：

- `readerReadableFontScale(fontScale)`：统一字体缩放下限；
- `readerScaledBarHeight(base, lineHeight, fontScale, paddingY)`：固定顶栏改为 `minHeight`；
- `readerScaledControlHeight(baseHeight, lineHeight, fontScale)`：按钮、表单、选择行、弹窗动作行、菜单行共享同一高度增长公式；
- `readerAvailableWindowHeight(metrics, pageHeight)`；
- `readerSurfaceMaxHeight(available, reserved, minimum)`；
- `readerDynamicSurfaceWidth(max, available, minimum)`。

`ReaderButton`、`ReaderFormField`、`ReaderChoiceRow`、`ReaderDialogSurface`、`ReaderActionMenuSurface`、`ReaderBoundedSurfaceActions` 全部消费 `readerScaledControlHeight`；`PopupSurfaceSpec.actionHeightFor/expandedHeightFor/collapsedHeightFor` 让书架更多菜单等派生面板随字体缩放。弹窗、面板、菜单、表单在内容或字体放大时使用最大高度 + 内部滚动，不裁剪整块内容。

生产接入点：`SharedDownloadPage` 使用 `readerAvailableWindowHeight()`（键盘/窗口实测优先）、`readerDynamicSurfaceWidth()`（操作面板宽度）和 `readerSurfaceMaxHeight()`（sheet/dialog 主体高度）；`LocalImportDialog` 使用 `readerSurfaceMaxHeight()` 扣除安全区与固定保留高度。三个 resolver 不再是无调用点的基础设施。

## 5.1 滚动布局契约

`ReaderScrollLayout` 统一表达 `startInset / endInset / mode`：

- `mode: 'padding'`：标准页面 `Scroll` 使用上下 padding；
- `mode: 'contentOffset'`：Search、Bookshelf、Download、SourceManagement、MultiSelect 的原生 List 使用 `contentStartOffset/contentEndOffset`。

`ReaderPageScrollHost` 是标准页面的薄 Scroll 宿主，只应用垂直 inset；页面仍拥有内容、横向 frame 和滚动状态。Search、Bookshelf、Download、SourceManagement、MultiSelect 保留各自原生 List/锚点/生命周期，只通过 `readerScrollStartOffset/readerScrollEndOffset(scrollLayout)` 消费同一契约。

阅读/目录专用宿主：`ReaderDirectoryList`、`ReaderDirectoryNavigationList` 和 `ReaderDirectoryNavigationSurface` 的 numeric `contentStartInset/contentEndInset` props 已替换为 `scrollLayout: ReaderScrollLayout`；它们仍拥有原生 List/Grid、LazyForEach 和锚点生命周期，但 inset 来源统一。阅读 page-turn/reader 宿主继续保留原生滚动所有权，只消费自身几何。

滚动例外已收口：`SourceSwitchWindow` 已接入 `ReaderScrollLayout`；`ReaderControlSearchContent` 的 `contentEndOffsetVp` 是 `visualToNativeRatio` 归一化后的原生 List 坐标，不能当作页面几何，已在源码和检查器中登记为 feature 专用滚动例外。完整目录不再使用空几何，`pageGeometry()` 将 `headerMeasurements` 的实测值与 `topBarTop + panelGap` 组合为 `content.startInset`。

## 5.2 固定尺寸分类

`docs/architecture/fixed-size-policy-20261025.json` 对 TTS、ControlTTS、阅读控制面板、阅读外观面板、搜索结果、RSS、Manga、完整目录、目录导航九个 feature 文件的**全部** 212 处数字 `.height()` 做显式分类：

- Text 链：逐项按 `design-token` / `icon` / `touch` / `feature-panel` 登记；
- 非 Text 高度：按 `design-token`（≤15）、`icon`（16–32）、`touch`（33–52）、`feature-panel`（>52）分类；
- 内容文字行必须使用 `constraintSize({ minHeight })` 或动态 resolver，不允许 `content-text` 固定高度；
- 新增任一数字 `.height()` 未登记会使检查器失败。

当前已将 TTS 的在线/系统标签、服务描述、Tab 容器，以及控制面板服务标签和卡片改为 `constraintSize(minHeight)`；其余高度均登记为图标、触控、设计 token 或 feature panel 内部几何。该分类覆盖九个已审计 feature，不做全局高度搬迁，也不把这些值提升为全局 token。

## 6. 动效契约

- `MotionSpec` 是 `reader.*`、`dropdown.*`、`bookshelf.*`、`source.switch.*`、`manga.*`、`search.*`、`message.*` 时长与曲线的唯一注册表；源码中不得出现数字型 `animateTo({ duration: N })` / `animation({ duration: N })`（`duration: 0` 的立即提交除外）。
- 生成型视觉稿（`SourceSwitchVisual`、`MangaDirectoryVisual`）继续拥有原始数值，`MotionSpec` 只负责登记和曲线重建，消费点不再各自 `cubicBezierCurve(...)`。
- `MotionSpec` 只保留 duration / curve / reduceMotion / contract id。panel actor 的 `fromY` / `delayMs` 已下沉到 `ReaderPanelMotionContract.ts`，`panelActorTransition(id)` 从该 contract 读取；本地导入的接力 delay 由 `LocalImportMotion.ts` 拥有，`motionAnimateParamDelayed` 只负责把 feature delay 与注册时长/曲线组合。
- `ReaderMotionPolicy.ets` 是 reduceMotion 的唯一入口：`readerReduceMotionFromStorage()`、`readerMotionDurationMs(id, reduceMotion)`、`readerMotionAnimateParam(id, reduceMotion, onFinish)`、`readerMotionCurve(id)`。设置写入与 `@StorageLink` 共享 `READER_REDUCE_MOTION_STORAGE_KEY`；控制栏的 0 时长收敛由 `readerControlMotionMs(token, reduceMotion)` 负责。
- 页面翻页落位继续由 `ReaderPageSettlementTimeline` 的距离/速度时钟拥有；`ProductMotionTiming` 只保存 rapid/min/max/宽度系数，不建立第二套补间动画。
- 非 ArkUI 采样器单独登记：`ReaderSessionLaunchTimeline.ts` 拥有启动 3500ms 时间轴的全部 beat、阶段边界、24vp 点尺寸和 4vp 暂停间距；`ReaderSessionLaunchPresentation.ts` 不再内联时间数字。`ReaderTtsWaveformModel.ts` 拥有波形高度/颜色/尾迹/循环/错峰常量。两者都是纯 TS，不能跨 ArkTS 边界导入 `MotionSpec`，因此由各自 owner 文件登记并纳入检查器。
- `ReaderControlMotionGeometry.ts` 的 140/70/13/52/57/93/20 等组合系数已命名为 `READER_CONTROL_MOTION_*`；亮度轨道、190vp 高度和 13.56vp 间距继续来自 `ReaderControlGeometry`。
- 消息显示时长属于消息框架，不属于动效注册表：`ReaderTransientFeedback.ts` 导出 `READER_FEEDBACK_BRIEF_MS`（2000）、`READER_FEEDBACK_EXTENDED_MS`（2200）和 `READER_FEEDBACK_DEDUPE_MS`（2000），调用点不得再传字面量。消息类别、宿主和生命周期不变。

## 7. 迁移状态

| 阶段 | 内容 | 状态 |
|---|---|---|
| S0 | 分类、契约、owner 规则 | 完成 |
| S1 | geometry / measurements / width class / surface resolvers | 完成 |
| S2 | Search / Download / Bookshelf 试点 | 完成 |
| S3 | StandardPage 与其余路由 | 完成 |
| S4 | 弹窗/面板/菜单/表单动态化 | 完成 |
| S5 | 动效端点与 reduceMotion 统一 | 完成 |
| S6 | 删除过渡 API、扩展不变量检查 | 完成 |
| S7 | 非 ArkUI 时钟、窗口能力、动态表面、控制系数、Scaffold 例外、纯函数矩阵 | 完成 |
| S8 | Frame style 拆分、滚动契约/标准宿主、目录测量例外、固定尺寸分类 | 完成 |
| S9 | MotionSpec actor 端点下沉、全量固定高度分类、目录/阅读专用滚动宿主 | 完成 |
| S10 | 滚动例外收口、固定高度范围扩展、完整目录统一测量 | 完成 |

静态不变量由 `node scripts/check-header-geometry.mjs --rationale <本次理由>` 显式核验，共 32 项，新增 frame style、滚动契约、目录测量例外、固定尺寸分类。纯函数场景矩阵由 `node scripts/check-ui-parameter-matrix.mjs` 显式执行，共 12 组：宽度 600 边界、窗口能力、字体缩放、键盘/安全区、弹窗宽高、滚动 layout 两种模式、frame style 默认值、翻页落位、启动动效 p=0/1、控制栏展开/收起端点、TTS reduceMotion/尾迹、消息窗口。两个脚本都不接入构建、CI 或其他默认门禁。

本阶段验证边界：源码迁移、ArkTS 编译、静态契约检查和纯函数矩阵已执行；HAP 打包/签名/安装、HDC 设备验证和真机截图未执行，不能据此宣称设备行为已验收。矩阵证明纯函数端点，不证明原生布局、首帧、字体测量或交互。

## 8. 不做的事

- 不改消息框架的类别、宿主和生命周期；几何不拥有消息位置。
- 不合并 `.worktrees/library-search-morph` 的未完成动效，不 cherry-pick。
- 不引入拥有业务状态的“万能页面组件”。
