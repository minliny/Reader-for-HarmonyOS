# PH56–59：当前实现审计、定点修复与证据边界

本报告对应用户对 `84cdc4ef` 的人工审视；包为 `run20260914T012243Z-84cdc4ef-eed02cc4`，其生产源码与本轮修改起点 `d4d8e73a` 相同。没有因本次修复操作真机、VM、HDC，未安装或启动新包。下述代码/本地回归已完成，Harmony 完整构建与后续用户审视由根任务单独记账。

## PH56：控制栏唤出时系统状态栏背景错误

**包源码事实和定位范围。** 原 `applyWindowChrome()` 已把 `readerAppearanceThemeStyle(activeTheme).paperStart/ink` 请求给 Window；不能把“没有请求阅读色”当根因。原阅读根容器没有独立的状态栏背景层，系统全屏区域依赖其下内容合成；控制栏目标 top 又只读当前可见 avoid-area，在栏隐藏且待异步显示期间，该 avoid-area 可以为 0。代码侧确认的是：阅读色底层没有明确独立所有者，以及显栏前的控栏几何没有使用已经测得的状态栏区域。未取得当前 OEM 实际合成帧，不能证明某一次错误颜色是 Window 忽略属性、属性被重置，或具体系统渲染器缺陷。

**实施。** `LocalReadingExperience.ets:7212` 的 `readerStatusBarUnderlay()` 在阅读 Window 有效且系统栏应显示时，以实际 `statusBarRect` 宽/坐标、高度创建背景层。色值直接取阅读主题 `paperStart`；zIndex 10，高于同一根树中 zIndex 7 的应用色控栏，且不接收触摸。其不属于可平移正文，也不跟 App 日夜色改色。开启拓展且控制栏隐藏时不生成该层。`ReaderLayoutGeometry.ts:313` 的控制栏 target safeTop 同时参考已测 status region 底边，避免等待系统显栏造成顶部重叠。原系统背景/文字颜色请求、单开关和窗口异步串行所有权继续保留。

**本地证据。** 新专项执行实际 SDK 编译后的 Builder，在单开关开/关、控栏开/关、退出阅读四种状态核对层是否存在、实际高度/色值/zIndex。不是仅检查代码里有颜色字符串。旧 `test-reader-window-chrome-p0` 和窗口去重回归通过。

**未由本地证明。** OEM 最终状态栏背景像素、文字图标着色及开合过程的合成帧仍需用户看新包；本报告不将请求值/Builder 属性冒充真机验收。公开能力依据：[HarmonyOS 沉浸式窗口说明](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/immersive-window-feature)、[系统栏背景适配说明](https://developer.huawei.com/consumer/cn/doc/doccenter-dev-faq/faqs-arkui-1652)。

## PH57：隐藏状态栏时顶部信息按设备实时指标布局

**根因。** 原实现仅保留状态栏高度，未保留该区域原点/宽度、挖孔矩形、屏幕圆角；自绘顶部左右坐标仍走固定 25vp 的设计边距，Y 主要是固定 inset + safe gap，无法随不同状态栏形态变化。仅监听 size/avoid 还漏了只移动不缩放的窗口；原测量 key 没有 display.rotation，同尺寸 180° 旋转可能复用不适合的旧隐藏区域。

**实施及真实能力范围。**

- `ReaderWindowMetrics.ts` 增加公开测量投影 `statusBarRect/statusBarCutoutRect/topLeftCorner/topRightCorner`。圆角是区域圆心/半径，所有值由 px 统一变为当前 Window vp，不写机型名称或坐标表。
- `ReaderWindowCoordinator.ts:457` 在运行时能力存在时调用 API 22 `getWindowAvoidAreaIgnoringVisibility(TYPE_SYSTEM)`。接口不存在、窗口不支持或异常时，退回原可见 avoid-area 与本 Window/方向的已测矩形缓存；从未测到时保持未知 0，不暂时显栏取值，也不猜高度。
- `topCornersVp():470` 仅在 API 23 `getRoundedCorner` 可用时读取，其异常/缺失不阻塞 API 21 路径。SDK 对 position 的说明是圆心，不是角点顶点；实现按圆心/半径换算窗口坐标。没有读取或声称读取系统文字基线。
- `ReaderStatusBarMeasurement.observeRect()` 保留完整实测矩形；`statusMeasurementKey:394` 含窗口/全局坐标、尺寸、密度、display ID 和 rotation，防跨窗/分屏/方向借用旧值。
- `registerWindowListeners():272` 新订阅 `windowRectChange`、`rectChangeInGlobalDisplay` 和 display `change`。所有事件经过同一个 refresh/equality gate；相同内容不增长 revision。detach 分别解订阅，旧窗口回调也有对象身份门禁。
- `ReaderLayoutGeometry.ts:265` 让隐藏状态下顶部信息占用实测系统栏区域；不拓展时移到区域下方。`ReaderPageChromeLayout.ts:123` 使用当前文字实际测高做垂直居中，左右结合该区域高度、圆角边界和挖孔进行留白与最大宽度约束；过长标题/时间按各自区域省略。footer 的既有设计边距不变。

**已证明。** 新专项调用未改写的生产静态方法验证 API21、API22 不支持/成功、API23 不支持/成功、px/vp 与圆心坐标；验证公开矩形的窗口隔离、横竖屏、可见 0 的权威性；按 1×/1.5×文字尺度检查文字在实测区域内、无挖孔交叠。另执行完整 refreshMetrics 与真实注册/解除方法，模拟仅移动、重复通知、隐藏时同尺寸 180° 旋转和旧回调，验证 revision 去重和旧区域失效。

**边界必须保留。** 公开 `Window`/`Display` API 只提供区域几何，不提供 OEM 状态栏时间/电池/信号字形的精确 x、baseline、字体内部 leading。因此这次完成的是可用公开指标驱动的动态布局及安全退回，不能声称“与所有机型系统文字逐像素重合”。API21 若该方向从未有可见测量，且隐藏期间没有忽略可见性的接口，不能凭空恢复该方向高度。后续用户新包审视可判断实际视觉位置是否满足要求；如仍需精确 OEM baseline，必须先记录具体设备差异，不能添加未经证实的机型常数。

公开本机 SDK 依据：`@ohos.window.d.ts` 的 `getWindowAvoidAreaIgnoringVisibility`（since22）、`windowRectChange`（since12）、`rectChangeInGlobalDisplay`（since20）；`@ohos.display.d.ts:1359–1397` 的 RoundedCorner 圆心/半径（since23）、display change（既有接口）。所有新增高版本调用有运行时存在性/异常回退。

## PH58：More 两项与真实刷新本章

**根因。** 原 More 包含信息/书签/目录/网络书换源，后面三项已有独立入口；没有刷新 action。现有 `loadSessionChapter()` 优先返回 Host chapterWindow，Core `chapter.content` 又优先读持久缓存，单纯重新调用旧方法无法做到用户要求的真实刷新。

**实施链路。** `ReaderControlPanel.ets:996–1035` More 仅“书籍信息 / 刷新本章”，两行 100vp，沿现有最大高度 Scroll。刷新项由当前阅读是否 ready 且没有翻页手指/结算占用控制，点击只进入一次现有 action 门禁。独立目录/书签/换源功能不受影响。

`LocalReadingExperience.refreshCurrentChapter():9304` 暂停自动翻页，捕获原章索引及当前页 startScalar，进入既有 `selectChapterAnchor`，保持控栏打开。`ReaderDeferredChapterSelection` 保存 `refreshContent`，等待旧写入、重试和延迟执行时均透传同一值。既有 selection origin/recovery/commit 路径保护原可读页、锚点及请求身份；未另建刷新业务引擎。

`loadSessionChapter():3170` 仅显式刷新跳过 Host 章缓存。`ReadingSessionFlowGateway.loadChapter` 透传给远程；本地书仍重新读取当前本地章节材料化，不声称进行网络请求。`RemoteReadingFlowGateway.ts:419` 按原源/书 ID/章URL/Legado上下文调用同一个 `chapter.content`，仅显式意图添加 `forceRefresh:true`。在线刷新不被 offline-only 缓存探针挡住；源版本/延续变量已失效时复用原详情/TOC 更新，并校验原 canonical index + URL，目录不再匹配时停止并保留原阅读位置。普通读取不发送此字段，行为不变。

Core `ChapterContentParams.force_refresh`（serde default false）与 JSON schema 可选 `forceRefresh:boolean`，`cached_chapter_content_result():9223` 仅在 true 时跳过读取旧 body。仍使用既有源规则、HTTP continuation、页拼接、抽取/发布逻辑。没有 delete-cache、Host 重造 Legado 请求或另一个缓存引擎；更新失败保留旧缓存，成功才按原 Core 发布边界更新。刷新失败向原错误恢复/重试传播，不把旧缓存当作“刷新成功”。

**实际回归。** Core `explicit_chapter_refresh_bypasses_cache_without_deleting_body_or_anchor` 验证默认 cache-first、force 真正 Pending 到原 transport、失败旧 body 不删除、重试发布新正文、阅读进度/位置不变、参数类型校验。根任务随后完整 Core gate（见 `PH58-core-gates.json`）已完成。Host 新专项执行真实 More/refresh/load 方法和 SDK Builder；实际 RemoteReadingFlowGateway + ReadingSessionFlowGateway 测试验证远程在线/离线显式 force、源书身份、错误传播和普通请求字段不变。既有 selection recovery/transaction/internal tests 通过。

**Native 一致性交付。** Core 已提交 `bf3e2682051f0c5d84103800c1cec4e7140b203c` 且 clean 后，使用现有 `build-harmony-napi.sh` 重建，SDK smoke PASS。`PH58-native-staging.json` 保存全部关系：

|层|SHA256|字节|
|---|---|---|
|Core package SO / entry/libs 原始 SO|`fb5e106db5cac6d5838fbca51f263b32678c508f85a72ca5f35f253620b882dd`|19120736|
|既定 `llvm-objcopy --strip-all` 预期 HAP 内嵌 SO|`812fa3dcac426473f28991ccd7697a30d8b30113ee6be7cd9adf9a55320adbd3`|14582400|

Core identity buildId `d513bd21c808a32b0bbc8fc66d2c1e949cb8e52170fa7d1c165f8f6a5626f761`；identity SHA `c47aea9aad86d5d904ed66babe9241cb237ed55bd8d2c92297af82d191bfa5ed`。vendor 的 Index.ts 适配与 SDK 文件对比均相同，未写入 vendor/libs。正确关系是原 package SO = app 输入，再将 HAP 内嵌 SO 与 objcopy 副本比较；未把预先 stripped 副本错误放入 app。新 HAP 的最终内嵌核对由根 pipeline 执行，本阶段不冒称已通过。

## PH59：下拉书签填充/回弹/持久确认

**明确根因。** 原 `reader_directory_marker_bookmark_active.svg` 同 `Icon__Bookmark.svg`（Figma component `271:73`）只有描边 `path`，root `fill="none"`；名字 active 不能证明实心。原 `bookmarkCornerFeedback` 只在拖动或已有书签时挂载，空页静态没有空心图；填充没有独立资源；160ms 回弹结束先撤 preview，而写入和 Core 投影后来才到，存在视觉空档。

**实施。** 新 `reader_page_bookmark_filled.svg` 沿既有 Figma/Tabler contour，唯一几何内变换是明确用户 PH59 要求的 interior fill。没有手绘新 path、没有 Image.fillColor 或更改目录 marker；沿现有生成器/许可/来源清单记录，Night 复用既有 `reader_directory_marker_bookmark_active` 的 App 图标颜色角色，不新增主题颜色。原 48 viewBox、描边几何和24vp显示不变，Night/Day 各一份。

`pageBookmarkFeedbackFilled():10424` 消费同一手势 preview（无书签→填充，已有书签→空心），原回弹曲线/160ms/触摸所有权保留。空页有已准入投影时静态显示空心。释放达到阈值才走原 toggle，pending target 按源/书/章/页边界及 generation 捕获，覆盖回弹到 Core 结果之间的空档；同页 pending 禁止重复提交。未触发/反向取消不发写入。

`ReaderPageBookmarkToggleRequest.onSettled` 是 Host 回调，不进入 Core JSON。Index 仍用原源/书/章校验、确认存在的 bookmark.time、原正文 text、原 CRUD/完整投影流程。创建确认或全部删除确认会保留相应目标状态，直到真实投影接管；**已确认写入但列表失败不会当作写失败撤回填充**。部分删除/不确定写入继续用原 unknown 投影和提示，不能伪造确定状态或重放写入。API拒绝和身份失败返回未确认，释放 pending。退出使 generation 失效，换书/换页完成也不能填错页。

**实际回归。** 新专项使用生产方法/Index 方法覆盖：阈值预览、回弹保持、反向删除、ACK先到/投影先到、重复点击拒绝、失败/未知、已写成功但投影失败、换书迟到结果；SDK Builder 验证最后一项仍实际生成 filled Image，同时禁止再次写入。路径 d 比较证明与原轮廓一致。SVG provenance 和 Night 生成器漂移检查通过。未知结果的后台真实源读写和系统触摸帧没有被此本地回归当作真机完成。

## 受影响测试、首轮失败与冻结

新增 `tools/test-reader-physical-window-bookmark-refresh.mjs`，使用已有 SDK AST/Builder 探针与未改写生产方法；已经被 `check-local.sh` 的 test-*.mjs 自动发现。旧探针对带 id 的条件节点错误地把 `If.canRetake` 返回代理对象当 true，导致本地完全跳过节点；已定点返回 false（新建探针树无 retained node），未改生产布局来迎合探针。

本轮已见证通过的本地组：新增专项；remote-reading-flow-runtime / gateway；reader-status-measurement；reader-page-chrome；reader-physical-reading-repair；reader-content-business；reader-control-internal-selection / selection-recovery / selection-transaction；reader-window-chrome-p0；window-flicker-dedup；reader-motion-repair；reader-control-p0 / geometry；reader-layout-architecture；reader-directory-data-snapshot / markers；reader-control-bookmark-load / mutation-recovery；theme-dynamic-icons；svg-provenance；generate-theme-icons --check。此前既有方法探针漏新增依赖（pageBookmarkFeedbackAnchor、reconcile）、Node扩展名解析、旧More/空页marker预期及 canRetake 失败已记录并按新明确行为补回归；没有把红例算成通过。Core 全量首次 fixture 缺默认字段与沙箱模拟服务端口失败由根单独保留，后续3727项完整通过，见独立JSON。

生产、测试、Native staging 已全部冻结，后续由根统一提交/构建；本报告不修改总账，不重启或占用设备。PH56–59 无需用户重新决定原产品意图；仍未证明的是 OEM 实际合成与文字像素，以及新包中该交互的用户体验。PH57 的公开系统字形基线能力边界不能通过代码测试消除。
