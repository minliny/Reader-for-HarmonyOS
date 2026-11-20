# 书架搜索连续表面（2026-10-27）

## 范围和现状

用户要求执行搜索面、开书动效的共用基座及单 owner 方案。当前 Host 为共享 dirty 工作树，保留并行改动。现有书架与搜索分别持有 `ReaderPageScaffold`；搜索页面把历史、输入、筛选与结果投影/滚动锚点放在同一组件，书架更多菜单由自身的挂载与 navigation generation 守卫。仅改变路由或隐藏原顶栏会产生重复 header，或丢失菜单和搜索操作的身份保护。

本次先将历史呈现提取到 `ReaderSearchHistoryPanel`，历史事实仍由 SearchHost 的 publication 提供；选择、清空、重试仍由 SearchPage 的当前 query 守卫。该提取不声称单 owner、动效或视觉验收已完成。

## 选定验证

- `H-search-history-layout-lifecycle#history-feedback`：实际入口为 `node tools/gate-index.mjs --id H-search-history-layout-lifecycle#history-feedback --run --change '提取历史面板后保留加载、失败和重试'`，嵌套只有选中的 SDK 层和假端口。回答提取是否保留三个历史状态和重试；不可省略，因为历史 builder 跨组件迁移。旧检查绑定原 builder，可能需要按新生产接线修复，失败不降级为通过。
- ArkTS 编译由本任务主 agent 在整合后统一执行；不重复构建。未选择 HAP、安装或设备验证。

执行结果：索引在执行 case 前返回 `REVIEW_NEEDED for changed definition tools/lib/bounded-surface-sdk-probe.mjs`，测试未运行。差异将 `TOK_SCREEN_INSET` 改从 `ReaderLayoutTokens.ts` 导入，并处理 `ReaderTokens` 的 re-export，不能重拍受控指纹替代审查。现有 `history-feedback` 探针直接提取旧 SearchPage builder，尚不装配新的历史子组件；需修改并审定真实父子装配后再执行。无原生像素、设备或用户验收结论。

## 当前 owner 与迁移约束

| 数据或对象 | 当前来源 | 消费与身份 | 待迁移的唯一责任 |
| --- | --- | --- | --- |
| 书架标题、搜索、更多 | BookshelfShell.topBar / MainTabShell header | navigationGeneration；更多菜单的临时 Back 与 sheet identity 同属 BookshelfShell | 常驻 bar，同时让更多菜单继续按原 identity 授权 |
| 搜索输入、筛选、统计 | SearchPage.searchHeader | SearchHost publication、SearchViewState 和 pageEpoch/queryAtMount | 常驻 bar；结果与筛选原事实仅由 SearchHost/现有 viewState 发布 |
| 头部测高与滚动起点 | MainTabShell、SearchPage 各自的 ReaderPageScaffold | 书架结果报给 Index，搜索结果用于 result List 锚点补偿 | 一个实测 host 和一条 header bottom 回执，按身份拒绝过期值 |
| 搜索结果及预热 | SearchPage 的 result data source、SearchHost | query revision、page/list epoch 和 Index 的 search presentation guard | 结果层，仍可为新 query 独立换 key；不重建常驻 bar |
| 进出及系统 Back | Index 路由和 SearchHost.close | 提交先推进 navigationGeneration，再为新 query 挂载 SearchPage；退出立即 close | 明确区分动画播放身份与业务 query 身份，倒放结束后退出；详情返回使用 resume |

本阶段未实现单一常驻表面、timeline、结果裁剪、滚动保持或 Back 倒放；不应将历史面板拆分作为这些行为完成的证据。

### 拆分进度

`ReaderLibrarySearchBar` 将输入、返回、提交/停止的内容视图参数化，实际事实和操作仍在 SearchPage。`BookshelfShell.onMoreBridge` 提供受 mount、temporaryBackIdentity 与 navigationGeneration 保护的菜单打开回调，并在换代和卸载时撤销。`ReaderPageScaffold.headerVisible`、`MainTabShell.headerVisible`、`BookshelfShell.externalHeader` 提供不挂载内层固定 header 的可选接入，默认路径不变；新宿主未连接前不可启用。以上属于准备代码，编译与关联 case 尚待验证。

### 新候选最小逻辑回归

`node tools/evidence/search-surface-20261027/probe.mjs` 选择实际 `ReaderLibrarySearchModel` 类及 `ReaderLibrarySearchSurface` 的普通时钟方法，仅使用受控帧/焦点端口。待回答的问题：旧 query 释放能否误清新 owner、中断倒放能否接续、旧帧失效、减少动效切换能否收敛；无网络、其他门禁或设备。它不证明 ArkUI builder 装配、原生排版、真实键盘或视觉一致性。

结果：上述定向探针 PASS（真实普通方法，受控时间和帧）。历史反馈原索引 case 仍为 REVIEW_NEEDED / 未运行；新探针不替代它，也不证明原生布局。

### 源码 owner 显式检查（2026-10-27，进行中）

新入口为 `node scripts/check-header-geometry.mjs --checks search-surface-mounted-owner,search-surface-source-single-owner --rationale '核验搜索的实际固定头宿主和剩余源码所有权' --json`，仅执行这两个静态项，未调用构建或设备，其他 33 项 NOT_RUN。检查目的是分别回答当前路由中是否只挂载一个固定头，以及旧生产源码和动画 owner 是否真正迁走；不能因为前者通过而把后者记为通过。

结果：`search-surface-mounted-owner` PASS；`search-surface-source-single-owner` FAIL。当前 `BookshelfShell` 仍保留 AppTopBar 和搜索回调渲染分支，`SearchPage` 仍保留 header/bar builder 和独立 header 高度 fallback，并由 `toggleSearchFilters` 发起独立 `animateTo`。这些与方案要求的源级单 owner、唯一时钟及筛选动画交接不一致，需修改后按相同最小入口重验；FAIL 不代表设备渲染结果。

### Index 接线探针夹具更新

Index 为 surface 增加 `queryOwner` 后，`node tools/test-library-search-index.mjs` 首次执行在读取 `currentOwner()` 时失败：测试 model stub 缺少该方法，未进入断言。补齐 stub 后同一入口 PASS；未修改生产逻辑或放宽既有身份负对照。该入口仅提取实际 Index 方法和回调并使用受控端口，不能证明 ArkUI 对保留子组件的回调更新、布局、键盘或设备表现。

### 更新后的 owner 静态检查与受控测试入口

本轮旧 bar/header 和筛选独立 `animateTo` 已迁出，表面统计与筛选几何也迁至 surface。重新运行 `node scripts/check-header-geometry.mjs --checks search-surface-mounted-owner,search-surface-source-single-owner,search-filter-motion-registered-and-consumed --rationale '核验搜索固定头、几何所有权及筛选时钟' --json`：三项 PASS，其他 32 项 NOT_RUN。静态检查只验证源码所有权及接线，不证明可见像素、搜索交互或 ArkTS 编译。

显式请求 `H-search-index-action-attachment` 时，索引因 `tools/lib/bounded-surface-sdk-probe.mjs` 定义与已审指纹不同而返回 REVIEW_NEEDED：该测试未执行，没有重拍指纹或绕过审查。之前历史 feedback 同因该 helper 漂移未运行；两个缺口均保持 OPEN。

### 无书源与书源读取失败的叠层（2026-10-27）

现象：input 阶段需要保留原 ReaderPageState 管理/重试入口，但原 SearchPage 不透明全屏纸色盖住 scrim 和书架。仅对 sourceRequired/sourceLoadError 使用透明 scaffold 与透明内容命中；原 ReaderPageState 和原业务意图保留在内容范围有限的纸色区域，results 与 loading 继续原纸色。最小回归需实际 SearchPage frameStyle 的源方法与状态 builder/入口装配，并检查两种状态透明、结果不透明、恢复操作保留及外部 scrim 层命中策略；不调用其他门禁、设备或签装。原生事件穿透与实际亮暗对比另记 OPEN。

本次 `source-recovery-probe.mjs` 首次运行在装配前失败：共享 foundationControls 初始化整套规格时缺 `ReaderTextStyle` 绑定；产品状态检查未执行。失败与既有 search-surface-edge 局部探针所记边界一致，下面收窄为当前恢复卡实际使用的 SDK 节点/端口，不修改共享测试定义。

第二次局部装配尝试：补充实际 ReaderTextStyle 后，旧 ReaderButton 测试 fixture 未选择其当前 `fontScale` 方法而失败，未触及产品检查；未更改共享门禁。收窄为实际 SearchPage SDK 状态 builder、实际 ReaderPageState 与受控 ReaderButton 端口后，`node tools/evidence/search-surface-20261027/source-recovery-probe.mjs` PASS：两种 source 恢复状态 frame 透明、Scroll 透明、状态区域原纸色且管理/重试入口可调用；initial/loading/results/empty/error frame 保持纸色。此为 SDK builder 与受控端口，不等于原生 hit-test 穿透、暗色对比、真实 IME 或视觉验收。另 `node tools/evidence/search-surface-20261027/probe.mjs` PASS 覆盖 owner/旧事件、field 稳定端点 key、可逆时钟与筛选中断；不覆盖 SDK 组件生命周期或输入法组合文本。

### 编译后 WIP 指纹

最终候选的共享 lease 内 `default@CompileArkTS` 日志保存在 `.reader-artifacts/search-motion-20261027/compile-arkts.log`，记录 `Finished :entry:default@CompileArkTS... after 12 s 332 ms`、`BUILD SUCCESSFUL in 15 s 237 ms`；warnings 未做基线差分。`docs/architecture/ui-porting-baseline-20261025.json` 的新增 `wipCandidate20261027` 单独记录当前 dirty worktree 的 26 个关键文件哈希、当前 owner 与逻辑几何，历史 2026-10-25 快照保留。编译前没有冻结全部输入指纹，该 WIP 指纹是编译后的当前身份，不声称编译输入已经和它做过快照绑定；实际帧、键盘、设备和用户验收仍 OPEN。

## 独立审计（2026-10-27，执行后复核）

范围：本次 28 个改动文件对应的源码、静态检查与受控探针；不含新构建、HAP、安装、VM/真机或 IME。源码 `mtimes` 均不晚于 08:38，编译日志时间 08:40，日志覆盖当前源码，但没有冻结输入哈希。

### 复核入口与结果

- 执行记录声明的 `search-surface-mounted-owner`、`search-surface-source-single-owner`、`search-filter-motion-registered-and-consumed` 与 `bookshelf-opening-geometry-and-clock`：独立重跑 PASS。
- `tools/evidence/search-surface-20261027/probe.mjs`、`source-recovery-probe.mjs`、`tools/test-library-search-index.mjs`：独立重跑 PASS。
- `node scripts/check-header-geometry.mjs --rationale ...` 全量 35 项：**4 FAIL / 31 PASS**，与记录中的“其他 32 项 NOT_RUN”不同。FAIL 项：
  - `search-pure-fallback-formula`：断言 `SearchPage` 仍拥有 `searchHeaderHeight()` 和 4 处 `readerSearchHeaderHeight(`；迁移后该 pure 公式由 surface 的 `filterMaxHeight()` / `statsHeight()` 消费，检查锚点过期。
  - `search-builder-consumes-spec`：断言 `SearchPage` 使用 `.borderRadius(this.headerSpec.panelRadius)`；实际已迁到 surface 的 `this.spec.panelRadius`，检查锚点过期。
  - `motion-registry-single-policy`：断言 `SearchPage` 含 `readerMotionAnimateParam(`；搜索动效现在由 surface 的 `ReversibleMotionTimeline` 直接消费 `motionSpecGet`，并在本地判断 `reduceMotion`。这既是锚点过期，也涉及“是否需要为 search surface 登记 reduce-motion 策略例外”的取舍。
  - `fixed-size-classification`：`ReaderControlTtsContent.ets` 2 处 44vp Text 未分类；该文件最后修改 2026-10-26 21:11，属迁移前既有失败，不由本次改动引入。
- 结论：前 3 项必须重新锚定到新 owner 并经审查，不能删除或跳过；第 4 项单独登记为迁移前失败。静态检查仍不证明可见像素、键盘或命中穿透。

### 行为与视觉差异

- **搜索返回为两段式（P1）**：`backLibrarySearch()` 在 results 时先进入 input，第二次返回才退出书架；系统 `onBackPress` 走同一路径。已确认的 `bookshelf-search-complete-demo-20261025.html` 文案“返回与点击遮罩都会恢复完整书架”和动效条目 06 要求 results 单段返回书架（390ms）。两段式还会让 `historyProgress = openProgress * (1 - resultProgress)` 在 results→input 倒放时让历史面板重新展开，同时结果层收缩；该画面没有任何证据。若改成单段返回，不能只改 mode：同一公式会在 1350→650 段先展开历史再收起，需要独立的 back 进度轨或门控。
- **`search.surface.back` 曲线未被消费（P2）**：`backSpec` 只提供 390ms 时长；倒放复用 open/submit 曲线的时间反演，不是按 back 曲线正向播放。若设计意图是独立曲线，需要实现；否则应删除该曲线字段或登记原因。
- **隐藏测量清零（P2）**：`metricsChanged()` 直接把 `historyHeight` / `filterHeight` 置 0；旋转或 IME 尺寸变化时可能有一帧历史/筛选塌陷，再靠隐藏测量副本恢复。IME 交互本身仍是 OPEN。
- **返回动效的 4 帧预算（P2）**：关闭时先覆盖页面，再等书架上报原点；`resolveShelfReturnMotionFallback(..., 4)` 在 4 帧后把请求降为 `fadeOnly`，而书架要等 `viewportRestored` 后才测量真实封面。书架在阅读期间是卸载的，冷挂载超过 4 帧时“合书飞回封面”会退化为 180ms 淡出，需设备统计实际命中率。
- **缺少书架暗化层（P2）**：demo 在 carry 期间把书架压到 0.86 暗度，并让不透明纸面淡入；应用没有暗化层，改用整个 `ReaderShell` opacity 0→1 交叉淡入（`Index.ets` 的 `.opacity(this.shelfOpeningReaderOpacity)`）。搜索栏和书架封面会透过半透明阅读页可见，这是与 demo 最可能不一致的一处，需视觉验收。
- **`queryOwner` 非响应式（P2）**：Index 以 `this.librarySearchModel.currentOwner()` 传入 surface 的 `@Prop queryOwner`，surface 的 `scheduleInputFocus` 用它做 guard。当前依赖 header 高度动画期间持续触发 Index 重建来刷新该 prop；若某次打开时 header 高度不变（历史高度为 0），自动聚焦可能不触发。建议 surface 内部直接读 `model.currentOwner()`。
- **编译 warning（P3，既有）**：`SearchPage.ets:1204` 的 `@ObjectLink group` 由普通 LazyForEach 变量初始化；HEAD 已存在该写法，不是本次引入，但编译记录不能视为 warning-clean。
- **参考 demo 自身缺陷（P3）**：`bookshelf-open-fixed-spine-demo-20261026.html` 的速度选择把 `dt` 除以 `sp`，0.35× 实际约 2.86× 更快；只影响 demo 复核，应用未复制该错误。

### 搜索动效专项分析（2026-10-27，补充）

以下只列前面未单列的项，不重复两段返回、back 曲线、metrics 清零和 queryOwner 的既有记录。分镜文本以 `docs/ui-design/demos/bookshelf-search-complete-demo-20261025.html` 第 50–55 行为准。

- **输入区没有横向展开（P1）**：分镜 02 要求输入区“从搜索图标向右展开”。现状 `ReaderSearchField` 在中间 `Stack` 中始终占满 `layoutWeight(1)`，仅以 `openProgress()` 整体淡入（surface 376–394）；同一进度上还叠加标题淡出、Path morph（251–255）和尾槽宽度混合（247–250），中间帧是两段文字叠影，没有随边界外扩的裁切。
- **提交没有“历史先收回、结果再展开”（P1）**：分镜 06 的顺序未实现。`historyProgress = openProgress * (1 - resultProgress)`（232）与结果高度 `headerBottom + contentHeight * resultProgress`（517–518）共用一条 700ms 轨道，历史从 t=0 开始收、结果同时开始展。
- **结果可见区上沿跟着当前 header 每帧移动（P1）**：结果带的上沿取 `headerBottom`，而 header 因历史收缩每帧变矮，结果首行就每帧上移；`captureHeader`（352–357）→ Index `librarySearchHeaderBottom`（1338–1343）→ SearchPage `externalHeaderChanged`（638–642）每帧记录并递增 `measurementRevision`，再进入 `pageGeometry`（644–653）；`anchorAtStart` 时还会每帧 `scheduleScrollRestore`（604–608）。结果没有独立的内容淡入或位移，只在做 clip。
- **焦点与 IME 不在时间轴内（P1）**：首次打开在 650ms 结束后才请求焦点（185–201），键盘出现改变 keyboardInsets 后 `metricsChanged` 把 `historyHeight` 清零（157–161），已展开的历史塌到 0 再按 `historyLimit()`（309–314）重开；提交时 `modeChanged` 立即 `clearFocus()`（138），键盘收起与 700ms 揭示并行，可能再次触发尺寸变化。
- **反向的加减速方向相反（P1，补充 back 曲线未消费的可见后果）**：反向按前向曲线时间反演并把虚拟时钟压缩到 390ms（146–147、179–181）；前向 open/submit 曲线约 20% 时间走完约 65% 距离，反向后这段成为末段，表现为慢起、末段加速撞停，两段返回各重复一次。
- **scrim 绑定历史而不是覆盖关系（P2）**：`opacity(.32 * historyProgress)`（525–528）。提交时历史一收，下半屏书架在仍可见时先变亮；scrim zIndex 2 高于结果层 1，新揭示的结果先被压暗，而顶栏 zIndex 4 始终不暗；返回两段会让书架亮度在 780ms 内亮→暗→亮。与分镜 04“亮面只限顶栏轮廓”不符。
- **反向首帧的全屏透明命中（P2）**：input 模式 scrim 全窗口 `HitTestMode.Default`（527–528）；results→input 反向开始时 opacity 为 0 仍可点，第二次点击会直接把目标改成 idle，跳过 input 稳定态。
- **筛选过渡会被 mode 变化截断（P2）**：`setMeasuredFilterHeight` 用新的 180ms 时间轴替换共享实例（217–228）；`modeChanged` 遇到进行中的 filter 只采样一次并丢弃过渡（127–132），`displayedFilterHeight` 可能停在中间值，直到下一次测量 identity 变化才恢复。揭示未完成时测得高度直接赋值（213–215），没有 180ms 过渡。
- **可交互时间预算（P2）**：表面在 `openProgress/resultProgress` 到 1 之前不可交互（262–265）。首次打开 650ms 后才可聚焦，提交后 700ms 内结果不可点，返回 390×2；单次“打开→提交→返回”纯动效约 2.1s，未计 IME。
- **每帧成本未量化（P2）**：每帧 `@State elapsed` 重建整块 surface；`morphPath()` 每帧拼接近 50 段 Path 字符串（251–255、LibrarySearchIconGeometry 29–47）；header area change 每帧写 Index 状态并驱动 SearchPage 几何/滚动恢复。60/120Hz 的实际掉帧需设备证据。

### 与方案一致的部分

- 阶段 0 基座：`MotionTimeline` 可逆采样、`ReaderSurfaceRect` identity/host 归一、`ReaderSurfaceRectMeasurement` 的 px→vp 与 scale/rotate 拒绝均落地；探针 PASS。
- 搜索单 owner：`BookshelfShell` / `SearchPage` 不再渲染内层 header（`headerVisible:false`），书架不再挂 `AppTopBar`；surface 是唯一 `ReaderFixedHeaderHost`；搜索期间书架 `.enabled(false)`、`HitTestMode.None`、`accessibilityLevel('no-hide-descendants')`；模型 claim/dispatch/release 有 owner 守卫。
- 固定书脊开书：目标取实测 `reader-bookshelf-page-slot`，失败回退布局；开书请求带 identity 回填 4 帧；`fadeOnly` 覆盖未测原点和非文本内容；角度 `-78`/`-18`、handoff 只改透明度；关闭在 carry 边界停在覆盖页面的位置等待书架原点；书架原点由真实封面节点测量并做视口裁剪。
- 搜索表面结构：结果从 header 下沿裁剪展开、scrim、历史/筛选隐藏测量副本、history 的 loading/error/retry 三态保留。
- `MotionSpec` 新增条目存在且被 transition/surface 消费。

### 证据边界

本轮只复核源码、静态检查、受控探针和既有编译日志；未新跑编译、HAP、签名、安装、VM/真机或 IME。源码 PASS/FAIL 不等于可见像素、真实命中穿透或用户验收；上述 P1/P2 的设备侧结论仍需在获得授权后单独安排。

## 全量修复执行（2026-10-27）

上节 P1/P2 中的两段返回、`search.surface.back` 未消费、提交未排序、输入区未横向展开、scrim 层级/绑定/透明命中、`metricsChanged` 清零、筛选过渡被打断、焦点/IME 在时间轴外以及非响应式 `queryOwner` 已在本次落地；上节记录保留为修复前快照。

### 生产源码

- `ReaderLibrarySearchSurface.ets`
  - 用显式 `open / submit / edit / back` 转场和每轨 `from/to` 取代 0–1350 单一可逆游标；反向不再时间压缩，`search.surface.back` 曲线正放。
  - 提交先在最前 30%（210ms）收回历史并安装结果 chrome，再从单行顶栏下沿展开结果；结果揭示期间 header 高度稳定，历史不再逐帧拖动结果首行。
  - 返回结果态直接单段 390ms 回书架；点输入框走独立 390ms edit，把结果带交还历史，焦点字段不重建。
  - 输入区按宽度百分比从图标右缘横向展开，标题在 45% 前退出；图标 morph、尾槽和 bar 高度共用 surface 进度。
  - scrim 改为 `mode==='input'` 时绑定输入遮罩、结果层位于其上方；提交只随结果揭示淡出，返回时先压暗再在末 45% 释放，opacity≈0 时不接收命中。
  - 历史视口与 keyboard 限高各用独立 `SurfaceValueTrack`（`search.history.resize` 180ms），筛选 180ms 轨道可被后续 retarget 打断并从当前采样继续；`metricsChanged` 不再清零。
  - 打开到 55% 时请求字段焦点，使 IME 与面板展开并行；`scheduledToken` 确保测量 retarget 复用同一帧循环，不复制回调链。
  - 移除 `queryOwner` prop 与 `@Watch`，焦点使用 `model.currentOwner()`；字段 key 不再包含 mode，edit 保留焦点实例。
- `Index.ets`：`backLibrarySearch()` 一律单段回书架；新增 `editLibrarySearch()`（停止 live sweep、保留部分结果会话后回输入）；移除 `librarySearchReturningToInput`、两段 settle 的 `endSearch/prepareEntry/open` 以及 `queryOwner` 传参。
- `MotionSpec.ets`：新增 `search.history.resize`（180ms）。
- `scripts/check-header-geometry.mjs`：把 `search-surface-mounted-owner`、`search-pure-fallback-formula`、`search-builder-consumes-spec`、`search-filter-motion-registered-and-consumed`、`motion-registry-single-policy` 重锚定到 surface 新 owner；登记搜索表面的 reduce-motion 例外；修正 `search-spec-values` 误读 BookshelfHeaderSpec 的 `panelRadius`。
- `tools/evidence/search-surface-20261027/probe.mjs`：重写为 open/submit/edit/back、焦点、遮罩、历史/筛选轨道、reduce-motion 与 stale frame 的受控时钟探针。
- `tools/test-library-search-index.mjs`：改为单段返回、edit 保留会话、无 `queryOwner` prop 的新链路。

### 验证

- ArkTS 定向编译：`.reader-artifacts/search-motion-fix-20261027/compile-arkts.log`，`Finished :entry:default@CompileArkTS... after 4 s 582 ms`，`BUILD SUCCESSFUL in 5 s 958 ms`；warning 未做基线差分。
- 搜索表面探针、source recovery 探针、Index 链路测试：全部 PASS（日志同目录）。
- 定向静态检查 11 项 PASS：`search-surface-mounted-owner`、`search-surface-source-single-owner`、`search-spec-values`、`search-pure-fallback-formula`、`search-builder-consumes-spec`、`search-filter-motion-registered-and-consumed`、`motion-registry-single-policy`、`motion-registry-consumers`、`motion-actors-registry-owned`、`no-literal-motion-durations`、`non-arkui-motion-clocks`。
- 未重跑 35 项全量；上次审计的另外三项失败已由上述重锚定转为 PASS，`fixed-size-classification` 仍是迁移前 `ReaderControlTtsContent.ets` 的既有失败。

### 未决与边界

- 真机（2026-10-27）：run `20261027T121112Z-3b297fdc-8b78b7dc` 的 signed iteration HAP 已保数据安装并启动成功；deployment receipt `deploy-physical-2a10c2b26b06-20261027T121332Z.json`（install/launch PASS，`dataPreserved: true`，featureInteraction/userAcceptance OPEN）。IME 实际时序、120Hz 掉帧、透明命中、scrim 观感、搜索/开书交互与用户验收仍 OPEN。
- edit 现在保留原搜索会话并停止 live sweep：部分结果仍在，动作回到“搜索”；历史面板不会立即包含刚提交的关键词（旧两段流程会重载 entry history）。是否在 edit 时刷新历史需要产品决定。
- 结果 chrome（摘要/筛选）的测量若晚于 210ms retract 完成，仍可能带来一次小幅 inset 变化；需设备视觉确认。
- 每帧 surface 重建与 `morphPath()` 字符串成本未量化。
- 参考 demo `bookshelf-search-complete-demo-20261025.html` 在本轮开始时已不在工作树（`docs/ui-design/demos` 目录于 19:44 变化），分镜文案沿用本记录引用的第 50–55 行；未重建 demo。
- `SearchPage.ets` 的 `@ObjectLink group` warning 仍是既有编译 warning。

## 真机搜索闪退（2026-10-27）

- 现象：用户在刚安装的 run `20261027T121112Z-3b297fdc-8b78b7dc` 上点击搜索框，应用直接闪退；启动 PASS 不证明搜索可用。
- 产物：signed iteration HAP SHA-256 `936015a2…5647`，bundle `io.reader.minliny` 0.2.0/1000000，targetRef `2a10c2b26b06`。
- 已有证据：仅用户口述；尚未取得崩溃栈，不能归因到某个组件。
- 与本轮改动相关的待排除面：open 时字段以 `0%` 宽度 + `Visibility.Hidden` 挂载；55% 进度在宽度动画中请求焦点；字段 ForEach key 在 owner 变化时重建；新增 `SurfaceValueTrack`/metrics 轨道和 `scheduledToken` 帧循环；结果层 zIndex 与 scrim 命中调整。
- 代码侧初查待核对：字段宽度的百分比/Visibility 是否触发 native TextInput 布局或焦点崩溃；55% 聚焦时 IME 与宽度动画并发；`modeChanged`/`completeTransition` 是否在字段重建期间调用焦点控制器；帧回调是否抛异常。
- 最小取证问题：本次是 JS 异常还是 native crash，栈指向哪里。
- 取证范围：同一 HDC 租约内只读 `pidof`、最新 faultlogger/hilog；不重启应用、不重复点击、不清数据。取得日志后先按当前源码定位，再决定修复；重新编译/构建/安装按各自授权执行。
- 初步处理（20:40）：移除本轮新增的两个 native 风险路径——open 时字段以 `0%` 宽度 + `Visibility.Hidden` 挂载，以及 55% 进度在宽度动画中请求焦点；字段恢复全宽 + opacity，焦点改到 open settle 后；字段 key 不再包含 owner，避免 owner claim 时重建 TextInput。横向展开暂缓，待稳定性确认后再做。
- 新构建 run `20261027T123846Z-3b297fdc-a8aa876c`，signed HAP SHA-256 `03a1a123…df0c`；inspect PASS，保数据 install PASS；launch 因锁屏再次失败（`10106102`）。设备上已是该构建，但闪退是否消失尚未确认。
- 设备上另有旧包 `io.reader.harmonyos`；复测必须打开 `io.reader.minliny`，避免把旧包闪退误判为本次构建。faultlogger 目录当前对 shell 为 `Permission denied`；若复测仍闪退，需在点击前后抓取 hilog。

## 结构返工（2026-10-27，对照 demo 证据）

- 真机截图确认前台是 `io.reader.minliny`，不是旧包；但输入展开态卡片右侧越界、搜索按钮被裁，输入框是透明全宽区域、没有内部搜索图标，前导仍是放大镜，搜索按钮不是 demo 的紧凑填充胶囊。用户判定不合格，结论成立。
- 按 `docs/ui-design/demos/evidence/bookshelf-search-complete-20261025/` 的 390px 证据和 `verify-demo.py` 的固定几何要求返工：卡片固定左右 16 内侧、20 圆角、52 高搜索行；搜索行内边距 16；输入胶囊 36 高、999 圆角、内部搜索图标、12 内边距；搜索按钮 52×32 填充胶囊；前导在 input/results 使用返回箭头；历史区 `清空`、分隔线、16 底部内边距；卡片色遮罩从左侧展开输入框，避免逐帧改 TextInput 宽度。
- 结果态仍未对齐 demo：固定卡仍保留筛选 chrome，折叠高度不是 52；demo 把结果标题/筛选放在卡片下方的结果内容里。该项保持 OPEN，下一步迁移。
- 新构建 run `20261027T130449Z-3b297fdc-f711632f`，signed SHA-256 `996fb167…403b`；inspect PASS、保数据 install PASS；launch 因锁屏再次失败（`10106102`）。需要解锁后启动 `io.reader.minliny` 并截取展开态确认。
