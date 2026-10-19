# 阅读与漫画消息样式实施验证

日期：2026-10-19。工作树：`/Users/minliny/Documents/Reader/Reader-for-HarmonyOS`，分支 `codex/message-ui-unification-20261019`。本分工已冻结。未提交、未操作 VM 或设备。

## 覆盖

| 原编号/范围 | 实施结果 | 源码位置（相对 entry/src/main/ets） |
| --- | --- | --- |
| C01 | 保留正文真正就绪后显示、2200ms、原消息与一次消费机制；独立 renderer 由书源分工负责 | `features/reading/LocalReadingExperience.ets` 的 sourceSwitchCompletionChanged/sourceSwitchCompletionToast |
| C03 | 32px 原生 LoadingProgress；空态正确说明“在阅读页面下拉，收藏当前位置。”；空/失败共用 ReaderPageState 和原动作 | `features/reading/ReaderBookmarkLoadingState.ets:15`、`ReaderBookmarkEmptyState.ets:13`、`ReaderBookmarkErrorState.ets:11` |
| C06 | 阅读纸上书签图标 + 下拉/松手文字 + 固定尺度方向图标；继续使用真实阈值、松手、回弹和 ACK；不转成 Toast | `features/reading/LocalReadingExperience.ets` 的 bookmarkCornerLayout/bookmarkCornerFeedback |
| C07 | 保留关键词和已得结果，尾部失败文字与原后续操作；18px 局部忙态。能重放同一 cursor 时仅重试后续；已失效 cursor/旧无 cursor 协议只提供真实“重新搜索” | `features/reading/ReaderControlSearchContent.ets:488`、`ReaderContentSearchPublication.ets:78` |
| C15 | 同纸面上拉/松手/进入下一章反馈，消息字体共用，方向图标固定尺度；不改变拉动释放门槛 | `features/manga/MangaBoundaryTurnFeedback.ets`、`MangaReadingSurface.ets` 的 boundaryHint |
| C17 | 每个未知失败逻辑图是透明短占位、淡边框、32px image-off，无可见文字和逐图按钮；390宽时内容358×179，间距12。已知尺寸不缩短。长图多 tile 的整图失败仅外轮廓及逻辑中点一个图标；已可读片段优先保留；局部 tile 失败仅影响该片段 | `features/manga/MangaReadingSurface.ets` 的 unavailableImageWidth/Height、rowHasError、unavailableMarkerTile/Top、imageViewport |
| C18 | 按真实目录/书源获取阶段与章节打开阶段使用页面级失败；未通过失败图片数量推断书源不可用。原重试/换源/现有登录与内容更新确认能力保留 | `features/manga/MangaReadingSurface.ets` 的 open/chapterLoadState/topControls |
| A04/阅读待处理 | 阅读设置/TTS真实未确认或失败在根层顶部浮层，各自保留代次与原保存重试；关闭工具面板不丢失入口。普通自动保存开始静默。主动核对/重试的动作进入忙态 | `features/reading/LocalReadingExperience.ets:2613`、`readerRecoveryContent` |
| A13/目录待处理 | 真实 unknown/可继续原操作才分别显示顶部浮层；明确 partial 使用原结果区，confirmed readback failure 使用短 Toast + 原只读入口；目录原尺寸不因提示重排 | `features/reading/ReaderDirectoryRecoverySurface.ets:50`、`ReaderFullDirectory.ets:171` |
| 普通刷新失败 | 已有正文/图片继续保留；漫画普通刷新失败用 Toast，未增加常驻待处理 | `features/manga/MangaReadingSurface.ets` 的 performMoreAction |
| 阅读正文/换源失败 | 共用消息字阶与软色原动作；保持实际阅读纸色及原恢复调用 | `features/reading/LocalReadingExperience.ets` 的 readingFailureContent |

图片资源从已批准 demo 的 Lucide image-off 资产复制，仅改日夜 stroke，来源与 ISC 许可记录于 `features/manga/IMAGE_UNAVAILABLE_ICON.md`；资源为 `resources/base/media/reader_image_unavailable.svg` 和 `_theme_night.svg`。

## 已通过的验证

- `node tools/test-manga-ui-assembly-sdk.mjs`：最终 Manga opened/error 分流后通过；全生产 ETS/TS 解析、实际组件属性/SDK lowering 与既有设置装配检查。日志 `/tmp/reader-message-sdk-final3.log`。
- `node tools/test-reader-content-search-cursor.mjs`：同 cursor 丢响应重放、结果保留/去重、失效游标关闭和晚到清理。
- `node tools/test-reader-content-search-publication.mjs`、`test-reader-content-search-error-boundary.mjs`：真实 SDK 发布/保留列表及错误边界。
- `node tools/test-reader-page-gesture-state.mjs`、`test-reader-bookmark-top-info.mjs`：真实书签 Builder 几何、原生图标可见性、系统栏/时钟避让、释放/回弹/ACK 与过期回调。最终日志 `/tmp/reader-bookmark-top-info.log`。
- `node tools/test-reader-bookmark-panels.mjs`、`test-reader-control-bookmark-load.mjs`、`test-reader-control-bookmark-content.mjs`、`test-reader-control-bookmark-mutation-recovery.mjs`：空态/原返回目录、加载重试、实际结果合并、历史锚点及原 CRUD 回读恢复。
- `node tools/test-manga-error-recovery.mjs`：新增真实 2000 高三 tile 场景，整图失败仅一个中点图标、已知尺寸保持、已有可读中片保留、局部片段失败隔离；原打开/恢复/导航退出归属测试继续通过。日志 `/tmp/reader-manga-errors.log`。
- `node tools/test-manga-chapter-transition.mjs`、`test-reader-known-image-geometry.mjs`：原翻章事务、显示交付、旧内容/位置保留与固有几何约束。
- `node tools/test-reader-nonblocking-recovery.mjs`、`test-reader-presentation-recovery.mjs`：不阻塞原阅读、缺 ACK 与过期代次隔离。
- 本分工改动的 `git diff --check` 通过。

## 已纠正的中间失败与边界

1. 首次 SDK 检出 ReaderFullDirectory overlay arrow 内直接写 DSL 的语法错误，已改为独立 `@Builder directoryOverlay`，重跑通过。
2. 旧书签测试期待“点按书签图标”；已随批准的下拉文案更新断言。书签几何 fixture 随方向图标 + caption 组正确读取父 Row 几何，原避让断言保持。
3. 旧漫画错误测试约束“一屏一个可转移重试卡”；已替换为批准的逐逻辑图占位与多 tile 回归，原恢复归属与退出用例保留。
4. 字体审计曾检出新增箭头字面量16，已全部改用 `MESSAGE_GESTURE_ICON`。主分工负责将精确 successor 快照刷新至最终字体/缩放链；本分工未放宽审计，最终全局结果由主分工记录。
5. C07最初 UI 不能重试：publication 失败后关闭 cursor 并置 hasMore=false。Core `remote/content_search.rs:248` 支持同 sequence 重放最后 receipt；本次仅保留安全的精确 cursor 重放，没有 offset 回退或新快照混并。明确失效仍须重新搜索。

上述是源码/本地和 SDK compiler/property 证据；完整 ArkTS/HAP 编译由主分工进行。本记录不声称原生布局、VM/设备或用户视觉验收已完成。被排除的元信息、正常状态标记、正常播放器控件未改动。

## 最终分流复核后的补齐（2026-10-19）

主分工安全取消尚未发布产物的 pipeline 后，修正了两项已证实遗漏；本分工源码与专属测试再次冻结。

- `ReadingDirectoryRecovery.ts:54`：新增纯展示 channel（pending/result/readback/none）与已确认读回失败标记，不改变 receipt、计数、mutex、continuation 或事实准入。真实 unknown/可继续原操作才进待处理浮层；已完成无剩余事项及正常派发开始不显示常驻通知。
- `ReaderDirectoryRecoverySurface.ets:75`：pending 仍使用共享浮层；书签明确 partial 只保留原区域的简短事实 `Text(MESSAGE_BODY)` 和 `ReaderRecoveryAction(variant:'text', label:'知道了')`，关闭只改变本地展示。离线明确 partial/物化失败复用 Index 现有 finished/failed 任务反馈，不新建结果卡、不重复提示。
- `ReaderDirectoryRecoverySurface.ets:45`：confirmed readback failure 发一次短 Toast，并保留同位置原 reconcile 的只读动作“重新读取书签/离线状态”；成功读回后移除。不会重复写入，也不再使用待处理 Notice 背景。
- `MangaReadingSurface.ets:524`：已打开漫画的后台准备失败使用去重短 Toast，保留图片、位置和原 More 入口，不写全局 error 因而不再进入旧嵌入错误块；初次打开失败仍由原页面失败负责，其他错误事实不被覆盖。

新增/更新验证：

- `node tools/test-reading-directory-message-routing.mjs` PASS：生产 DTO + 实际 SDK 分流、已确认读回 Toast 去重、原代次只读动作、已确认 partial 事实、unknown/continue 浮层、原离线结果反馈、不改 receipt、初始派发不误判终态。
- `node tools/test-reader-directory-host.mjs` PASS：真实 Gateway/Host 的 confirmedRefreshFailed 与冷 partial 使用正确 channel，原归属/事务回归保持。
- `node tools/test-reading-offline-host.mjs` PASS：真实离线 Host/Owner、确认/物化/读回分离；已确认失败不进入 pending，原下载操作与物化测试通过。
- `node tools/test-reading-directory-index-sdk.mjs` PASS：真实 Core SQLite + SDK Index→目录恢复动作 12 项；已确认读回只读刷新不重复写、cold partial、unknown exact 核对/继续、旧宿主/Runtime 代次隔离及负控。专属 fixture 的36px旧动作断言同步为已批准的28/44px宿主。
- `node tools/test-manga-error-recovery.mjs` PASS：补充后台准备失败短反馈、重复发布去重、保留已打开图片与无关错误事实。
- `node tools/test-manga-ui-assembly-sdk.mjs` PASS：补齐后的全生产解析/实际字段绑定/SDK lowering；日志 `/tmp/reader-message-sdk-final2.log`。
- `git diff --check` PASS。

## 最终 opened/error 与原操作入口回归（2026-10-19）

- `MangaReadingSurface.ets` 已删除 `topControls` 的全部 `opened && error` 旧背景/圆角嵌块。真实 `error/opened` 展示 Watch 对已打开、当前归属的普通操作失败发送一次安全短 Toast；不清除 error 事实，不改变 presentationGeneration，保留已读图片与原操作。初次 source/chapter 失败仍用 PageState；真实 recovery/现有 login 判定保留。与实际失败图片一致的局部错误仍只显示图片占位，不上冒为全局 Toast。
- `node tools/test-manga-error-recovery.mjs` PASS：实际 SDK State Watch 证明上述分流、同 presentation 去重、换 presentation 可再次反馈、旧归属/销毁/未打开静默、error 与 image 事实不变、普通错误不钉住 controls。临时负控重新插回旧嵌块会被同一实际 SDK 断言拒绝。日志 `/tmp/reader-manga-error-sdk-final.log`。
- `node tools/test-manga-ui-state.mjs` PASS：使用真实 `nativeImageFailures/nativeFailureKey/wholeImageUnavailable/unavailableMarkerTile` 几何与 render-key 依赖，原位置/状态断言保持。日志 `/tmp/reader-manga-ui-state-final.log`。
- `node tools/test-manga-auth-recovery.mjs` PASS：原受限鉴权类型、当前/过期归属与原 login 入口；无按图片数量或笼统 403 推断书源登录失败。日志 `/tmp/reader-manga-auth-final.log`。
- `node tools/test-reader-chapter-download-feedback.mjs` PASS：更新了过时的 Index Notice 断言。真实 Host 终态分类保持；confirmed readback failure 使用一个安全短 Toast，原下载刷新与漫画重开入口各读两次仍只写一次；失败留在原入口，过期入口和晚到结果静默。原 cache 决定通过实际 `runIndexRecoveryAction` 消费后，明确刷新失败用短 Toast 并重建同一原决定的 fresh generation/action；旧 generation 不可消费，第二次原操作可继续，失效 current/晚到失败不重建。日志 `/tmp/reader-chapter-feedback-final.log`。
- `node tools/test-manga-boundary-feedback-sdk.mjs` PASS：实际 SDK 两个 Text actor 分别使用 `MESSAGE_GESTURE_ICON` 与 `MESSAGE_META`，释放/准备文案、日夜主题、保留页 paint 与既有负控通过。日志 `/tmp/reader-boundary-feedback-final.log`。

production 与专属测试已冻结；Index 生产由主分工独占，本分工仅读取真实方法适配回归。新测试 contract tier 与共享字体/架构 successor 由主分工维护。完整 ArkTS/HAP 与设备验收仍不在本分工证据范围。


## 收口修复：已确认取消不再被晚到 add 失败降级

源码定位：`features/bookshelf/BookshelfReadableAdmissionOwner.ts:70` 的无 receipt catch 无条件改为 unknown；反顺序（add 先失败）在取消和 shelf read 都成功后也未清 unknown。当前 Index 仅对 unknown 隐藏原详情文案，因此出现取消已确认却丢失“已取消加入书架”文案。最小修复限该 owner 与 `test-readable-admission-index-owner.mjs`：严格取消成功并完成原只读 shelf 观察后，无 add receipt 恢复 none；晚到 add reject 不降级已确认取消。保留独立 membership、真实 add receipt、取消未确认/失败重试及过期 Runtime 约束；不以列表观察升级 add 结果。不操作设备。

回归结果：`node tools/test-readable-admission-index-owner.mjs` PASS，日志 `/tmp/reader-readable-cancel-after.log`。新增用例先在原实现复现 `cancel-first: late add failure cannot downgrade cancellation`（unknown != none，日志 `/tmp/reader-readable-cancel-before.log`）。修复仅 owner 两处：无 receipt 的 catch 在 cancelConfirmed 后不降级；严格取消 + shelf 读回成功后无 receipt 设 none，有真实 receipt 保持 confirmed。

覆盖两种 settle 顺序 × 独立 membership 有/无、取消请求失败和 shelf 读回失败后原取消重试（均不 replay add）、ACK 在取消读回前/后到达、旧 Runtime 无读回不能声称取消确认；原 Coordinator + Core DTO fixture 的物理详情按钮用例也断言 add 先失败→严格取消、严格取消→晚到 body reject 都保持 none 与“已取消加入书架”。原 cold manga、busy/unknown barrier、Runtime/navigation、same-runtime 重建、真实 receipt 与 membership 分离断言保留。

最终 owner 测试还检出旧 keyed-secondary actor 的 +1 计数已不符合获批原生忙态结构；仅在本次指定 test 内按实际 Stack/Text/If 三 actor 更新精确断言，旧物理回调不能操作新书籍、原写次数等保护均保留。pages 分工另确认 `test-reading-entry-index-sdk.mjs` 28组通过，已取消原文案断言恢复。owner 与指定测试已冻结，无其他 production 变更、无设备操作。

## 收口修复：目录 pending 核对动作保留原位忙态

`ReaderDirectoryRecoverySurface` 的 pending Notice 未传 busy，核对时 canRetry=false 会移除原按钮。仅根据现有 BookmarkMutation/Offline snapshot 的 checking/loading fact增加纯展示忙态，透传同一原动作的18px原生 LoadingProgress，保持文案与几何；不从 !canRetry 猜忙，unsupported/单纯 unknown 不显示 spinner，不新增调度或写入。

最终字段与接线：`ReadingDirectoryRecovery` 新增可选 `bookmarksBusy/offlineBusy`，空 DTO 显式 false；仅匹配当前书籍的原 operation 的 `projection.receipt.readback === 'reading'` 为 true。两个 Host 已发布该真实读回事实，未添加新的 Host checking/loading 状态。Surface 只透传原 Notice.busy，并在原 reconcile 入口拒绝 busy 的旧动作投递。单纯 unknown、unsupported、!canRetry 均不提供 busy 依据；缺少真实 reading 事实时不硬加 spinner。

`test-reading-directory-message-routing.mjs` 先在原实现复现缺失字段（undefined != true，日志 `/tmp/reader-directory-busy-before.log`）。修后 PASS，日志 `/tmp/reader-directory-busy-actual-sdk.log`：覆盖生产 projector、真实 Core SQLite / SDK-emitted Host / Index / 目录叶子 / RecoverySurface / Notice / Action，暂停原 canonical read IO，原 label 和28px动作几何保留，实际原生 LoadingProgress 为18×18；保留的 pre-busy native 回调双击与 direct stale delivery 均不增加 dispatch，原 write 次数保持1，读回完成仍不把 unknown 伪造为 ACK。unsupported unknown（无 reading 事实）没有 loader。

`test-reader-directory-host.mjs`、`test-reading-offline-host.mjs` 与本分工所有新增/更新文件的 `git diff --check` 均 PASS。仅 DTO、Surface 与专属 test 修改；生产与测试已再次冻结，未操作设备。

## 703 项完整回归后的专属 fixture 适配（2026-10-19）

本轮完整 runner 已退出后，主分工授权仅修改 tests/helpers/docs，生产源码保持冻结。原完整 runner 日志目录为 `/var/folders/53/6tc2ktbd19dbwxd5pmbp0d_w0000gn/T/reader-contract-run-yb7R5L`；以下定向重跑日志统一位于 `/tmp/reader-message-fixture-reading-20261019/<名称>.log`。

| 测试名称（均为 tools/test-<名称>.mjs） | 定向结果 |
| --- | --- |
| manga-boundary-surface-sdk | PASS |
| manga-cancelled-banner | PASS |
| manga-chapter-preparation | PASS |
| manga-candidate-visible-metadata-sdk | PASS |
| manga-motion-progress | PASS |
| manga-scroll-stability-sdk | PASS |
| manga-session | PASS |
| manga-surface-render-key-sdk | PASS |
| manga-tile-window | PASS |
| reader-controls-ph104-108 | PASS |
| reader-directory-rules | PASS（30组） |
| reader-recoverable-entry | PASS |
| reader-source-failure-p0 | PASS |
| reader-tts-preference-lifecycle | PASS |
| source-switch-index-owner-sdk | PASS |
| source-switch-reader-ack | PASS |

适配内容与保留约束：

- `tools/lib/reader-motion-method-probe.mjs` 的有限闭包补入真实 `notifyPreparationFailure/displayError`、逻辑图 marker/尺寸 helper，以及生产声明中的 nativeImageFailures/去重 Set 初值；执行原方法和真实 MangaUserError，无几何算法或事务 stub。边界翻章、取消保存、位置、chapter preparation、tile window 与会话归属旧断言保留。
- 三个漫画 SDK fixture 将旧逐图重试 Button/文本断言改为实际32px image-off资源，区分 file:// 内容像素与资源图标。每个局部失败保留自己的单元格，滚动不再转移一张错误卡；保留实际日夜资源依赖、已知几何、render key、锚点、20-region 回看和缓存租约释放断言。Controller 原 retry API 的缓存回归仅作为已有领域 API 调用，UI 明确断言无逐图按钮/回调，不增加用户流程。
- 后台整章容量失败验证保留 `controller.preparationError`、已读图片与原 error 事实，改验一次真实安全 Toast，继续验证旧章节隔离、空间恢复和完成清理。PH105 的 Notice 直接转发原 owner retry authority，原只读核对、write一次、正文缓存和过期物理入口约束保留。
- 阅读失败与换源 ACK fixture 沿实际 ReaderRecoveryAction 子组件的 native Stack 获取回调；重试、设置、继续当前书源与换源原分支完整保留。换源原 scope/旧 scope、错误/丢失/晚到 ACK、真实 Index→Shell→阅读链和负对照继续执行。
- TTS 生命周期 fixture 使用真实初始空通知状态；普通保存中/成功静默，七种设置分别验证当前明确失败/unknown才出现原重试入口，选择保留且不重写。原 restore/序列化/store/read 准入、native晚到ACK、已派发耐久完成、旧生命周期/书籍/coordinator/generation 和 generation-only 负对照均保留。
- 目录规则 fixture 改取共享动作真实 native Stack，且交付 constructor 的 book Prop Watch 后才建立 mounted loaded-editor fixture，防止构造 Watch 延迟进入已挂载阶段。有限 probe 不模拟 native removal，保留了旧 ForEach key 的 child；当前动作按真实 actionEnabled 与 operation generation 唯一选择，并验证 native.enabled，不再误取历史 disabled 节点。新增核对实际派发 `rules.mutation.query` 的断言，同时保留 journal字节、原write次数、精确原操作、目录刷新原动作和退役物理动作约束。

指定16项均已完整退出并 PASS；本轮更新文件的 `git diff --check` PASS，tests/helpers/docs 已冻结。以上为源码/本地官方SDK与既有Core/Owner证据，不代表完整703项第二轮已通过，也不代表HAP、VM/设备或用户视觉验收。
