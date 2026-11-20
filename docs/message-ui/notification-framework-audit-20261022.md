# 通知框架源码审计附表

> 2026-10-23：以下 F01–F12 和旧入口表保留为修复前审计快照；本轮 main 的逐项实施、最终检查与构建结果见 [全量接入记录](integration-20261023.md)。旧计数/哈希不代表当前源码。

这是用户要求“所有通知是否走框架内对应消息提醒模式”的源码证据，不是新的待办或验收账本。审阅对象为当前 HarmonyOS dirty 工作树；2026-10-23 更新仅记录已获授权的全局短反馈接入及其验证边界，不改变已确认的业务类别。

## 2026-10-23 main 执行更新

已按原始确认稿完成全局短反馈的源码接入：`ReaderTransientFeedback` 不再调用系统 Toast，统一向根页面挂载的 `ReaderTransientToast` 发布 generation 状态；安全区、前台、旧定时器和宿主退役由公共适配与宿主处理。阅读换源保留原有揭示动画，但完成文案改走全局短反馈；自动播放/翻页的专用胶囊未改。入口登记同步移除 `native.toast` 适配桥，直接系统 Toast 现在一律视为违规旁路。

本次只读取源码、登记、设计参考及已有记录，未执行消息检查脚本、业务测试、构建、设备操作或通知触发。登记分组不是业务场景数量；调用公共组件也不等于原生视觉、交互或用户验收通过。普通元信息、封面缺省、更新章数、来源/类型标签、阅读进度和正常播放状态不计作通知。

## 结论

不能把当前状态称为“所有通知已按确认设计统一”。主要区别是：

- 公共入口的接入已大量完成，普通短反馈目前全部经同一个适配层；literal 原生 API 扫描没有发现页面直接绕过它调用 Toast。
- 普通短反馈现在由根页面唯一的 `ReaderTransientToast` 自绘，确认稿的全局短反馈样式已接入；自动播放/翻页仍保留各自专用胶囊。源码呈现已完成，但设备视觉和整体验收仍需单独记账。
- 已登记的公共页态、恢复浮层与既定 Dialog 变体能定位到实际组件；但登记表未覆盖数个仍可达的自绘页态、规则恢复、配置错误和确认入口。
- 关闭或未消费模块保留原实现，不能计入当前可达通知的整合率。本文附表逐项列明登记状态，不用总数证明业务覆盖或验收。

## 具体发现

| ID | 已确认源码事实与触发 | 影响与最小处理 |
| --- | --- | --- |
| F01 | 原实现只向系统 `showToast` 传 `message/duration`；本轮已替换为 `ReaderTransientFeedback` → 根页面 `ReaderTransientToast`。 | 已完成源码侧统一呈现：近全宽、15圆角、22状态标记、标题/正文层级、220ms上浮、前台和安全区处理；`SourceSwitchCompletionOverlay` 的完成文案也已移除为独立底部提示，自动播放/翻页胶囊继续保留专用宿主。仍需按本次定向检查、HAP/设备和视觉验收分别记账。 |
| F02 | `ReaderNativeAlertOwner.ets:2` 明示 OS 仍绘制 Alert；`:97-107` 仅复制 title/message/button/autoCancel，保留原生 AUTO 字体/几何。当前5组 `native.alert` 均在 owner 的 show 回调内，未发现裸旁路。`confirmation-demo.html:79-85` 则画有17内距、12圆角、明确字级及动作。 | 此处不是未经登记的系统调用。当前框架允许原生确认，设计参考与具体可保留平台变体的范围仍需明确；报告列为“视觉规则待核定”，不自行将所有 Alert 改为另一套弹窗。既有自绘删除书籍等4组 Dialog 已走 `ReaderDialogSurface`。 |
| F03 | `SourceSwitchWindow.ets:552-566` 的 `recoveryNotice` 以 Text+Button 自绘，同一分支处理普通 `errorText`、`rollbackRequired`、`requiresReconciliation`；`:770` 有当前调用，`SourceSwitchPanel.ets:56` 消费该 Window。`:535` 的查找中/无其他书源也自绘且由`:515/530`调用。没有公共 Recovery/PageState 接入，也不在现有专用例外中。 | 当前可达的分类/登记缺口。先按原 transaction 事实分出普通读取失败、原切换待核对、需撤销；原操作未决接公共恢复浮层/动作，普通失败按有无旧候选分别短反馈或页态；候选加载/空可以用局部页态或登记专用窗体变体。保留 source-switch 身份及原 rollback/retry 语义。 |
| F04 | `ReaderControlReplaceContent.ets:453-464` 自绘规则 idle/loading/error/empty；`:512-537` 在同一 `ReaderBoundedSurface` 内显示删除/导入确认、local error、`writeUncertain/writeBlocked` 的恢复文字及“正在等待确认”。`ReaderControlPanel.ets:1456` 当前接入；登记只覆盖其他目录规则组件，未覆盖此替换规则入口。 | 已确认可达且未按类别接入/登记。原写入未知不能只留在可关闭工具层；应保留原 operationId、session/revision 并接公共恢复投影。删除/导入确认用已认可确认变体或为这个专用编辑器登记明确例外；首次失败/空与普通校验分别处理，不能全部替换为 Toast。 |
| F05 | `ReaderChapterLoadingState.ets:23-35` 自绘32vp加载及章节标题，`LocalReadingExperience.ets:2745` 当前调用；同文件 `readingFailureContent:14553-14595` 仍手写标题/正文/动作，虽已复用 `MESSAGE_*` 与 `ReaderRecoveryAction`，未复用 `ReaderPageState`，也无此专用例外。 | 共用部分字体/按钮不等于页态接入完成。保留阅读纸色、body范围、章节取消和各原动作，优先用公共页态薄变体；确需保留专用阅读导航表面则补具体原因与生命周期登记。不能改动用户已确认的阅读/换源业务流程。 |
| F06 | `MangaDownloadOperationsPanel.ets:22-37` 自绘“读取下载状态”及失败+重试，失败按钮高32；由 `MangaReadingSurface.ets:2372` 和 `ReaderMangaDownloadPopup.ets:40` 当前消费。无公共页态接入/专用例外。 | 这是下载面板的局部首次读状态，应复用公共局部页态/恢复动作，保留既有面板和 action gateway；至少补当前事实、重试身份与专用保留原因。32vp按钮也不符合公共44vp目标下限，需检查真实可触范围。 |
| F07 | `ReaderDirectoryNavigationList.ets:958-978` 与 `MangaReadingDirectoryFallback.ets:263-279` 手写“没有匹配/暂无章节”及清除搜索；当前分别在`:1280`、`:307`消费，后者又由漫画阅读`:2608`调用。未在登记或例外中。 | 已确认登记缺口。目录 quiet empty 有既有漫画设计，不应盲目用一套大空态覆盖；应选择公共无padding页态适配，或登记漫画目录专用 empty 及真实查询/清除准入。 |
| F08 | `ReaderTtsConfigOverlay.ets:202/217/356` 用同一 message/errorText承载配置说明、操作错误与管理表单错误；`ReaderControlTtsContent.ets:434/446` 当前消费。`ReaderControlTtsContent.ets:591` 还用固定24vp框显示最多两行播放错误。均无对应通知入口/例外。 | 配置字段校验可以留在字段上下文；首次列表失败、普通操作失败、未知配置写入需要各自类别，不能按 errorText 统一决定。先追原host receipt事实补分类登记；两行文字固定24vp有裁切风险，需按自然高度/既有空间实际约束处理。播放错误属于专用任务时登记具体宿主，不强制变成 Toast。 |
| F09 | `BookshelfManagementPage.statusCard:149-158`、`SourceToolsPage.statusCard:508-524`、`SettingsPage.operationFeedback:266-277`、`BookshelfMultiSelectPage:221-229` 保留原动作/内容位置的真实任务忙态，多数已使用 `MESSAGE_*` 和18/32vp原生加载，但专用例外表没有这些成员。 | 源码形态基本符合专用任务原则，属于覆盖登记不足，不认定必须重新设计。按 owner、实际任务/确认范围及退出条件补登记；原动作忙态不增加全局进度弹层。书架“检查更新中”正在由主任务修复，见当前新增专用例外。 |
| F10 | `LocalReadingExperience.ets:2663/2670` 用 `busy: !...canRetry` 驱动阅读/朗读设置恢复浮层；`FRAMEWORK.md:25` 明确禁止把 canRetry=false 自动解释成忙态。已读 setters 的false用于开始核对/保存，因此本轮未证明已出现错误忙态。 | 已确认表达耦合，实际错误表现待验证。用原 gateway/host 的真实正在执行事实单独传 busy，保留 canRetry 为动作准入；不因为按钮不可重试就显示旋转。 |
| F11 | `LocalReadingExperience.ets:8557-8561` 在 TTS configuration selection receipt=`pendingReconciliation` 时仍发 `error.message` 短反馈；朗读偏好恢复浮层读取的却是另一套 `ttsPreferencesGateway.writeFacts`。`ReaderTtsConfigurationHost.ts:449` 直接回传 Error.message/字符串。 | 这是具体分类风险：须核对 configuration 原写入未知是否有持续可达的核对宿主，不能用短反馈自动替代。当前源码不能保证所有外部错误都是用户可理解文案；不得据此声称已实际泄露凭据。最小修复是沿原配置receipt投影原操作恢复事项，并将用户短文案与诊断分开。 |
| F12 | 源码清单明文自限为“source entry groups，不是完整业务场景总账”，其已登记125组不会发现所有 Text/Error/Loading 自绘出口；`ReaderReplaceQuickPanel`、`ReaderTtsFullPanel` 未发现当前消费，`SourceManagementPage.statusBanner` 也无调用。 | 登记/扫描通过不能升级为全App覆盖。未消费旧组件列入保留范围，不能混入当前问题数量；当前可达遗漏须按上述分类补齐后再选择有必要的局部验证。 |

## 业务与生命周期审阅边界

普通短反馈适配层已做前台检查、空文案拒绝、同key短时去重、延迟取得UIContext、捕获渲染异常；它不拥有业务操作、重试、取消或ACK。Index、阅读、漫画等调用保留 runtime/nav/session/source/book/operation 等现有谓词，实例退场和导航等位置能找到 reset/retire。本文不以静态存在这些谓词替代迟到回调测试，也不把登记里泛化的 retireRule 当作每个业务分支已验证。

`ReaderRecoveryNotice` 真实渲染标签、标题、末行右动作、长标题三行折叠/展开；`ReaderRecoveryAction` 使用原生18vp loading并守卫generation；`ReaderPageState` 使用32vp loading、MESSAGE标题/正文及公共动作；`ReaderDialogSurface` 使用规定变体，业务决定留在原宿主。OS锁屏/后台朗读由专用媒体/后台session承接，不应改成应用内Toast。

下面附表来自本次读取的登记与真实源码定位。结论中的“接入”只证明源码消费公共呈现；所有条目的原生像素、交互和用户验收均未执行。动态业务反射和运行时可达性不因本表完整列举而得到证明。

## 当前登记逐项覆盖

<!-- inventory appended below from the currently read registration and source definitions -->
读取时点：2026-10-21T16:20:28.552Z；source groups=125，专用例外=13，原登记保留范围=6。

| source group（文件/owner.member，定义行） | 框架类别 | 实际 renderer | 审阅结论 |
| --- | --- | --- | --- |
| `entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets:226#BookDirectoryPage.fontPreparationContent` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets:607#BookDirectoryPage.mangaEmptyState` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets:190#BookDirectoryPage.pageRecoveryOverlay` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets:298#BookDirectoryPage.standardContent` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/BookRemovalDialog.ets:24#BookRemovalDialog.build` | shared.dialog-surface | ReaderDialogSurface → 既定自绘确认/输入变体 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/BookshelfEmptyCard.ets:10#BookshelfEmptyCard.build` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/BookshelfManagementPage.ets:207#BookshelfManagementPage.groupsCard` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/BookshelfManagementPage.ets:129#BookshelfManagementPage.onSnapshotChanged` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/bookshelf/BookshelfManagementPage.ets:88#BookshelfManagementPage.pageContent` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/BookshelfManagementPage.ets:117#BookshelfManagementPage.pendingOverlay` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/BookshelfManagementPage.ets:318#BookshelfManagementPage.recordsCard` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/BookshelfPage.ets:554#BookshelfPage.bookshelfList` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/BookshelfPage.ets:344#BookshelfPage.bookshelfTabContent` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/BookshelfPage.ets:261#BookshelfPage.modeFeedback` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/bookshelf/BookshelfSettingsPage.ets:132#BookshelfSettingsPage.modeFeedback` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/bookshelf/BookshelfSettingsPage.ets:121#BookshelfSettingsPage.onOperationChanged` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/bookshelf/BookshelfSettingsPage.ets:156#BookshelfSettingsPage.pageContent` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/BookshelfSettingsPage.ets:93#BookshelfSettingsPage.pendingOverlay` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/BookshelfSettingsPage.ets:105#BookshelfSettingsPage.settingsRecovery` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/BookshelfShell.ets:234#BookshelfShell.onReadRecoveryChanged` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/bookshelf/BookshelfShell.ets:212#BookshelfShell.recoveryNoticeContent` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/BookshelfStatusContent.ets:20#BookshelfStatusContent.build` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/LocalBookDetail.ets:469#LocalBookDetail.catalog` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/LocalBookDetail.ets:175#LocalBookDetail.detailScroll` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/LocalBookDetail.ets:142#LocalBookDetail.fontPreparationContent` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/LocalBookDetail.ets:782#LocalBookDetail.onShelfMessageChanged` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/bookshelf/LocalImportDialog.ets:106#LocalImportDialog.build` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/bookshelf/LocalImportDialog.ets:541#LocalImportDialog.onRecoveryChanged` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/common/JsonImportDialog.ets:50#JsonImportDialog.build` | shared.dialog-surface | ReaderDialogSurface → 既定自绘确认/输入变体 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/common/ReaderTransientFeedback.ts#ReaderTransientFeedback.show` | shared.transient | ReaderTransientToast 发布适配 | 出口已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/discover/DiscoverPage.ets:93#DiscoverPage.onPresentationChanged` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 关闭范围保留；不计当前可达整合；renderer同F01 |
| `entry/src/main/ets/features/discover/DiscoverPage.ets:295#DiscoverPage.resultList` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 关闭范围保留；不计当前可达整合 |
| `entry/src/main/ets/features/downloads/SharedDownloadPage.ets:340#SharedDownloadPage.bookPage` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/downloads/SharedDownloadPage.ets:625#SharedDownloadPage.chapterPage` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/downloads/SharedDownloadPage.ets:1292#SharedDownloadPage.confirmationOverlay` | shared.dialog-surface | ReaderDialogSurface → 既定自绘确认/输入变体 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/downloads/SharedDownloadPage.ets:273#SharedDownloadPage.onBooksChanged` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/downloads/SharedDownloadPage.ets:267#SharedDownloadPage.onErrorChanged` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/downloads/SharedDownloadPage.ets:225#SharedDownloadPage.pageContent` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/downloads/SharedDownloadPage.ets:253#SharedDownloadPage.pageOverlays` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/manga/MangaReadingSurface.ets:1933#MangaReadingSurface.chapterLoadState` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/manga/MangaReadingSurface.ets:1193#MangaReadingSurface.notifyOpenedError` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/manga/MangaReadingSurface.ets:533#MangaReadingSurface.notifyPreparationFailure` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/manga/MangaReadingSurface.ets:2735#MangaReadingSurface.performMoreAction` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/manga/MangaReadingSurface.ets:2136#MangaReadingSurface.topControls` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/manga/MangaReadingSurface.ets:1367#MangaReadingSurface.turnBoundaryChapter` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/FullDirectoryPanel.ets:436#FullDirectoryPanel.directoryBody` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/reading/LocalReadingExperience.ets:9353#ReadingExperience.changeChineseConversionMode` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/LocalReadingExperience.ets:9690#ReadingExperience.changeReaderPageTurnStyle` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/LocalReadingExperience.ets:8537#ReadingExperience.changeTtsRate` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/LocalReadingExperience.ets:4329#ReadingExperience.hydrateEntryCatalog` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/LocalReadingExperience.ets:4833#ReadingExperience.notifyPreservedContentRefresh` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/LocalReadingExperience.ets:9209#ReadingExperience.onControlBookmarkFailureChanged` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/LocalReadingExperience.ets:13012#ReadingExperience.onReaderBookmarkGestureUnavailable` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/LocalReadingExperience.ets:2647#ReadingExperience.readerRecoveryContent` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 浮层已接；真实busy耦合见 F10 |
| `entry/src/main/ets/features/reading/LocalReadingExperience.ets:4945#ReadingExperience.requestPageTurnChapter` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/LocalReadingExperience.ets:8721#ReadingExperience.requireTtsConfigurationHost` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/LocalReadingExperience.ets:11451#ReadingExperience.selectBookmarkAnchor` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/LocalReadingExperience.ets:9879#ReadingExperience.showAppearanceFailure` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/LocalReadingExperience.ets:2006#ReadingExperience.showReaderAlert` | native.alert | owner回调内的系统Alert绘制桥 | 登记桥/owner已接；原生外观边界 F02 |
| `entry/src/main/ets/features/reading/LocalReadingExperience.ets:2006#ReadingExperience.showReaderAlert` | shared.alert-owner | ReaderNativeAlertOwner → 决策lease；OS绘制 | 登记桥/owner已接；原生外观边界 F02 |
| `entry/src/main/ets/features/reading/LocalReadingExperience.ets:9559#ReadingExperience.showReaderSettingsFailure` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/LocalReadingExperience.ets:8886#ReadingExperience.toggleAutoPage` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/ReaderBookmarkEmptyState.ets:9#ReaderBookmarkEmptyState.build` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/reading/ReaderBookmarkErrorState.ets:9#ReaderBookmarkErrorState.build` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/reading/ReaderBookmarkLoadingState.ets:12#ReaderBookmarkLoadingState.build` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/reading/ReaderControlAppearanceContent.ets:499#ReaderControlAppearanceContent.requestDefaultTheme` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets:415#ReaderControlDirectoryContent.flatCatalog` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets:438#ReaderControlDirectoryContent.listBody` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/reading/ReaderControlSearchContent.ets:441#ReaderControlSearchContent.resultsBody` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets:491#ReaderDirectoryNavigationSurface.build` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets:454#ReaderDirectoryNavigationSurface.notifyReadFailure` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/ReaderDirectoryRecoverySurface.ets:80#ReaderDirectoryRecoverySurface.build` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/reading/ReaderDirectoryRecoverySurface.ets:53#ReaderDirectoryRecoverySurface.notifyReadbackFailures` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/ReaderDirectoryRules.ets:182#ReaderDirectoryRules.notifyApplied` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/ReaderNativeParagraphView.ets:87#ReaderNativeParagraphView.updateSelection` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/reading/ReadingSurface.ets:229#ReaderReadingTextFragment.onTextMenuItemClick` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/rss/RssEntryDetailPage.ets:102#RssEntryDetailPage.operationFeedback` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 关闭范围保留；不计当前可达整合 |
| `entry/src/main/ets/features/rss/RssOriginalRecoverySurface.ets:62#RssOriginalRecoverySurface.build` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 关闭范围保留；不计当前可达整合 |
| `entry/src/main/ets/features/rss/RssPage.ets:286#RssPage.readFeedback` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 关闭范围保留；不计当前可达整合 |
| `entry/src/main/ets/features/rss/RssSourceFeedPage.ets:86#RssSourceFeedPage.operationFeedback` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 关闭范围保留；不计当前可达整合 |
| `entry/src/main/ets/features/rss/RssSubscriptionManagementPage.ets:90#RssSubscriptionManagementPage.pageContent` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 关闭范围保留；不计当前可达整合 |
| `entry/src/main/ets/features/search/SearchPage.ets:1672#SearchPage.emptyContent` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/search/SearchPage.ets:1799#SearchPage.errorContent` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/search/SearchPage.ets:958#SearchPage.initialContent` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/search/SearchPage.ets:1407#SearchPage.resultsContent` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/search/SearchPage.ets:1746#SearchPage.sourceLoadErrorContent` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/search/SearchPage.ets:1724#SearchPage.sourceRequiredContent` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/settings/SettingsPage.ets:300#SettingsPage.pendingFeedback` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/settings/SettingsPage.ets:595#SettingsPage.requestClearTextCache` | native.alert | owner回调内的系统Alert绘制桥 | 登记桥/owner已接；原生外观边界 F02 |
| `entry/src/main/ets/features/settings/SettingsPage.ets:595#SettingsPage.requestClearTextCache` | shared.alert-owner | ReaderNativeAlertOwner → 决策lease；OS绘制 | 登记桥/owner已接；原生外观边界 F02 |
| `entry/src/main/ets/features/settings/SettingsPage.ets:778#SettingsPage.requestRestoreDefaults` | native.alert | owner回调内的系统Alert绘制桥 | 登记桥/owner已接；原生外观边界 F02 |
| `entry/src/main/ets/features/settings/SettingsPage.ets:778#SettingsPage.requestRestoreDefaults` | shared.alert-owner | ReaderNativeAlertOwner → 决策lease；OS绘制 | 登记桥/owner已接；原生外观边界 F02 |
| `entry/src/main/ets/features/settings/SettingsPage.ets:535#SettingsPage.selectAppTheme` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/settings/SettingsPage.ets:353#SettingsPage.showFeedbackToast` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/source/SourceManagementPage.ets:381#SourceManagementPage.onMessageChanged` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/source/SourceManagementPage.ets:351#SourceManagementPage.originalRecovery` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/source/SourceManagementPage.ets:363#SourceManagementPage.pendingOverlay` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/source/SourceManagementPage.ets:536#SourceManagementPage.sourceList` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/source/SourceToolsPage.ets:760#SourceToolsPage.confirmExportThen` | native.alert | owner回调内的系统Alert绘制桥 | 登记桥/owner已接；原生外观边界 F02 |
| `entry/src/main/ets/features/source/SourceToolsPage.ets:760#SourceToolsPage.confirmExportThen` | shared.alert-owner | ReaderNativeAlertOwner → 决策lease；OS绘制 | 登记桥/owner已接；原生外观边界 F02 |
| `entry/src/main/ets/features/source/SourceToolsPage.ets:477#SourceToolsPage.originalRecoveryActions` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/source/SourceToolsPage.ets:486#SourceToolsPage.recoveryAction` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/source/SourceToolsPage.ets:792#SourceToolsPage.showTransientFeedback` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/features/source/SourceToolsPage.ets:508#SourceToolsPage.statusCard` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/features/sync/SyncPage.ets:239#SyncPage.manualActionsSection` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 关闭范围保留；不计当前可达整合 |
| `entry/src/main/ets/pages/Index.ets:7149#Index.applyBookshelfCatalogSnapshot` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/pages/Index.ets:2314#Index.assignShelfDefaultGroup` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/pages/Index.ets:630#Index.bookshelfHost` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/pages/Index.ets:6445#Index.chooseCachedChapterRefresh` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/pages/Index.ets:4729#Index.detailOperationNoticeContent` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/pages/Index.ets:6546#Index.indexRecoveryNoticeContent` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/pages/Index.ets:6751#Index.mountSystemFileOpenNavigation` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/pages/Index.ets:5119#Index.onReaderBookmarkSelected` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/pages/Index.ets:4831#Index.openBookRemovalDialog` | native.custom-dialog | CustomDialogController → BookRemovalDialog → ReaderDialogSurface | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/pages/Index.ets:2634#Index.openBookshelfMultiSelect` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/pages/Index.ets:6200#Index.performMangaPreviewSourceSwitch` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/pages/Index.ets:6324#Index.performSourceSwitchSeam` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/pages/Index.ets:6175#Index.presentMangaSourceSwitchCommitRecovery` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/pages/Index.ets:2263#Index.shelfGroupRecoveryContent` | shared.recovery-notice | ReaderRecoveryNotice → 标签/标题/公共恢复动作 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/pages/Index.ets:2227#Index.shelfGroupSurface` | shared.dialog-surface | ReaderDialogSurface → 既定自绘确认/输入变体 | 公共类别已接；仅源码接入证据 |
| `entry/src/main/ets/pages/Index.ets:3167#Index.showIndexAlert` | native.alert | owner回调内的系统Alert绘制桥 | 登记桥/owner已接；原生外观边界 F02 |
| `entry/src/main/ets/pages/Index.ets:3167#Index.showIndexAlert` | shared.alert-owner | ReaderNativeAlertOwner → 决策lease；OS绘制 | 登记桥/owner已接；原生外观边界 F02 |
| `entry/src/main/ets/pages/Index.ets:4627#Index.showOfflineDownloadFeedback` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/pages/Index.ets:6489#Index.showReadingFailure` | shared.transient | ReaderTransientFeedback → ReaderTransientToast 自绘 | 出口已接；公共呈现已接；本轮视觉/设备另记 |
| `entry/src/main/ets/pages/ReaderStartupRecovery.ets:23#ReaderStartupRecovery.build` | shared.page-state | ReaderPageState → MESSAGE_* / 原生32vp加载 / 公共动作 | 公共类别已接；仅源码接入证据 |

## 当前专用例外逐项覆盖

| ID / 当前成员 | 类别与实际实现 | 生命周期/边界与结论 |
| --- | --- | --- |
| `DEDICATED-BOOKSHELF-CATALOG-UPDATE-ACTION`<br>`entry/src/main/ets/features/bookshelf/BookshelfMoreMenu.ets:148#BookshelfMoreMenu.menuActions` | 检查更新原动作的执行状态 | 检查更新点击保持菜单；执行中禁重复派发，完成恢复检查更新。菜单可由用户关闭，关闭不取消任务；退场或closeInFlight拒绝旧点击，Shell保留原临时返回/selection身份守卫。后台或减少动态效果停止动画，不改变任务事实；其它导航仍沿原菜单收起。；已登记专用宿主，未作原生验收。 |
| `DEDICATED-SEARCH-SESSION-PROGRESS`<br>`entry/src/main/ets/features/search/SearchPage.ets:524#SearchPage.filterProgressRow` | 搜索任务真实进度 | 新查询、呈现身份或页面退场使旧进度退役；停止仍由原owner及canCancel准入。进度展示不拥有取消、重试或确认任务的状态。；已登记专用宿主，未作原生验收。 |
| `DEDICATED-SEARCH-SESSION-NOTICES`<br>`entry/src/main/ets/features/search/SearchPage.ets:1367#SearchPage.searchProgressDetails` | 搜索任务分支失败及跳过结果 | results List在按住或用户滚动busy期间冻结已接纳提示快照，交互空闲后接纳当前任务事实；empty/error读取当前终态事实。新operation generation立即禁用旧动作并拒绝旧回调，results旧视图只在交互结束后接纳新事实；新query、mount退役或页面退出清理旧快照并拒绝旧动作。partial/failed共用一个重试入口，存在partial时由该行承载，否则在failed行；展示、点击均复核live canRetry且搜索已结束。skipped仅说明不派发重试；全失败正文不重复已存在的重试。业务仍由原owner处理，展示或滚动不取消、重试或确认任务。；已登记专用宿主，未作原生验收。 |
| `DEDICATED-SOURCE-SWITCH-COMPLETION`<br>`entry/src/main/ets/features/source/SourceSwitchCompletionOverlay.ets:22#SourceSwitchCompletionOverlay.build` | 换源已确认后的纸面短反馈/纸面过渡 | 原 reader completion owner 控制原 2200ms 期限、身份变化及退场清理；组件本身不建计时器/ACK。；已登记专用宿主，未作原生验收。 |
| `DEDICATED-BOOKMARK-GESTURE`<br>`entry/src/main/ets/features/reading/LocalReadingExperience.ets:13050#ReadingExperience.bookmarkCornerFeedback` | 书签下拉的纸面手势反馈 | 松手、回弹、当前页/实体代次变化或退场按原 gesture/feedback owner 清理，拒绝旧回调。；已登记专用宿主，未作原生验收。 |
| `DEDICATED-TEXT-CHAPTER-BOUNDARY`<br>`entry/src/main/ets/features/reading/LocalReadingExperience.ets:3707#ReadingExperience.onContinuousBoundaryDrag` | 小说章末/章首的拖动反馈 | 拖动不足回弹、达到阈值松手才换章；章节/呈现代次失效或退出清理原手势反馈。；已登记专用宿主，未作原生验收。 |
| `DEDICATED-MANGA-CHAPTER-BOUNDARY`<br>`entry/src/main/ets/features/manga/MangaReadingSurface.ets:2031#MangaReadingSurface.boundaryHint` | 漫画章末/章首拖动提示 | 不足阈值回弹，阈值合格松手才换章；退场/新边界代次清理旧提示，失败保留原章节回退。；已登记专用宿主，未作原生验收。 |
| `DEDICATED-MANGA-IMAGE-UNAVAILABLE`<br>`entry/src/main/ets/features/manga/MangaReadingSurface.ets:2058#MangaReadingSurface.imageViewport` | 漫画单图/多图不可用占位 | 图像新请求/renderKey/章节变化后重绘；单图失败不触发全局消息，书源/整章失败由 ReaderPageState。；已登记专用宿主，未作原生验收。 |
| `DEDICATED-IMPORT-PROGRESS`<br>`entry/src/main/ets/features/bookshelf/LocalImportDialog.ets:260#LocalImportDialog.importingPanel` | 本地导入进度和任务结果 | 原导入阶段完成/切换后更新；弹层关闭不擅自取消或确认后台原操作。；已登记专用宿主，未作原生验收。 |
| `DEDICATED-SOURCE-CHECK-PROGRESS`<br>`entry/src/main/ets/features/source/SourceToolsPage.ets:323#SourceToolsPage.batchCheckCard` | 书源检测进度及分项结果 | 原 run 退役、停止/完成或页面退场时保留原清理/结果规则；不让消息组件驱动检测重试。；已登记专用宿主，未作原生验收。 |
| `DEDICATED-SOURCE-DEBUG-LOG`<br>`entry/src/main/ets/features/source/SourceToolsPage.ets:703#SourceToolsPage.debugLogRow` | 书源调试日志 | 原 debug session/投影变化更新日志；退场取消原订阅/分派，不把日志显示当作任务完成。；已登记专用宿主，未作原生验收。 |
| `DEDICATED-SOURCE-SWITCH-PROGRESS`<br>`entry/src/main/ets/features/source/SourceSwitchProgress.ets:43#SourceSwitchProgress.build` | 换源准备/试读任务进度 | 原换源状态/呈现身份退役后停止加载展示；原取消/提交仍归 source-switch owner。；已登记专用宿主，未作原生验收。 |
| `DEDICATED-TTS-SYSTEM-MEDIA`<br>`entry/src/main/ets/app/HarmonyTtsMediaSession.ts:14#HarmonyTtsMediaSession.publish` | 系统锁屏/耳机/后台媒体状态 | close 标记 retired 并解除事件/释放原 AVSession；失败仍按原 optional 系统能力处理。；已登记专用宿主，未作原生验收。 |

书架检查更新的 `DEDICATED-BOOKSHELF-CATALOG-UPDATE-ACTION` 是本轮主任务正在补齐的入口：普通结果Toast的F01不因菜单busy修复而一并消失。原生加载动画、无进度文案、菜单保持及重复点击准入应由本轮局部验证单独证明。

## 保留与未消费范围

| 范围 | 当前状态/依据 | 处理边界 |
| --- | --- | --- |
| `discover` | retained-disabled；`entry/src/main/ets/app/ReaderProductScope.ts` | L0 disables discover; its registered source entries do not count as currently reachable notification scenes. |
| `rss` | retained-disabled；`entry/src/main/ets/app/ReaderProductScope.ts` | L0 disables RSS; register retained source only, no route restoration. |
| `sync` | retained-disabled；`entry/src/main/ets/app/ReaderProductScope.ts` | L0 disables sync; register retained source only, no route restoration. |
| `unimplementedSettings` | retained-disabled；`entry/src/main/ets/app/ReaderProductScope.ts` | Only real persisted settings are reachable; disabled setting sections and their messages are not claimed as accepted integration. |
| `SourceManagementPage.statusBanner` | retained-unreachable；`entry/src/main/ets/features/source/SourceManagementPage.ets` | No consumed call site; retained hand-drawn legacy banner is not a current reachable unified entry and must not be reintroduced. |
| `RulesManagementPage` | retained-unconsumed；`entry/src/main/ets/features/settings/RulesManagementPage.ets` | No consumed current route/Host entry; no message integration or feature restoration is inferred from component source. |
| `ReaderReplaceQuickPanel` | rg未发现当前构造调用，仅组件声明/主题角色 | 作为未消费兼容界面；不算当前已整合，也不因本审计恢复入口。 |
| `ReaderTtsFullPanel` | rg未发现当前构造调用，仅组件声明/主题角色 | 当前TTS使用ReaderControlTtsContent；兼容面板不算当前可达通知。 |

## 本次来源与证据限制

当前入口检查已观察到0个系统Toast调用、5个系统Alert桥和1个CustomDialogController宿主；未观察到页面直接Toast旁路。此结论不覆盖任意运行时反射/动态跨模块调用。登记对应API桥有重复owner记录，不把10组Alert登记说成10次原生调用。

| 输入 | SHA256 |
| --- | --- |
| `tools/message-entrypoints.json` | `b53bd806e2848efa843189cb6d2c2261b430fd3c837d58cc2618accc8cc24613` |
| `docs/message-ui/FRAMEWORK.md` | `56f98a5ade08a300571be8cff4aeb613bb57549caf4cec08c5e147e15c28faf8` |
| `docs/message-ui/approved-scope-20261019.json` | `f99fb50be5e66fdd6eb8e34fef69bc40162042d4385b6cb2755960cf93ddc6f7` |
| `entry/src/main/ets/features/common/ReaderTransientFeedback.ts` | `8c2b9c27ba2f4f52a21ebca1fd784461c00229893ee62a5351f211cc66e04f4e` |
| `entry/src/main/ets/app/ReaderNativeAlertOwner.ets` | `da0a68aa5300d1b395a6e8e6d4ae70d5e6f08f86bdfc86f75f4c88e7f63ec32a` |
| `entry/src/main/ets/features/common/ReaderRecoveryNotice.ets` | `ad456061cb318aa3b81a59a16642e8bc22c602729f4c94fde08dc63066fe742f` |
| `entry/src/main/ets/features/common/ReaderRecoveryAction.ets` | `5a7f9d8a68cb34facd1c40b3d00326b5eb1c43f0bc90285f25cb6621ad44217d` |
| `entry/src/main/ets/features/common/ReaderPageState.ets` | `5460cb185c8dae686d5c3e1cc74a0fa9b2e28059877a33a4d86694e214b058fe` |
| `entry/src/main/ets/features/common/ReaderDialogSurface.ets` | `669a951e4bb8c4c99e6fc07686591c212edc4b51e7bafb3cdb2d58544828ffcb` |

本轮执行了 `node tools/check-message-entrypoints.mjs --check`（125/125，PASS）、短反馈发布/去重/reset 的最小方法探针（PASS）和全源 ETS AST 解析；消息样式 SDK 用例因本机缺少 Python `fontTools` 未完成。未执行构建、签名、安装、通知触发或设备取证；表中未覆盖的真实异步时序、可达子状态和原生视觉保持未验证，不能用本报告作设备或全量验收回执。
