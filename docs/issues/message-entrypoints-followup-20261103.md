# 消息入口检查独立跟进（2026-11-03）

本账本承接页面结构方案14.13，owner为`harmony-message-ui`。它单独处理消息扫描/登记一致性，不并入Stage 4的局部SDK通过，也不代表全应用消息生命周期、可达性、视觉或设备验收。未开放的sync/RSS/discover等保持关闭；设置页对已有原同步journal的恢复入口是当前代码中的独立恢复通道，不能因sync产品开关关闭而误记不可达。

> 当前结果（2026-11-03）：原19项源入口/登记差异已关闭，修后全树201/201、0失败；后续Notice/SearchField及下载源码变化均有selected补验。运行生命周期和原生验收仍OPEN。下面的176组/19 FAIL是执行前历史基线，不是当前未解决数量；最新整体进度见主实施方案前部总览。

## 执行前基线（历史FAIL）

执行前已审读`tools/check-message-entrypoints.mjs`：它仅读取当前`entry/src/main/ets`的ETS/TS，用已安装官方ETS SDK AST解析、比较`tools/message-entrypoints.json`，不调用其他测试、Core、网络、构建或设备。

首次诊断命令为`node tools/check-message-entrypoints.mjs --check`，该次结果为exit 1 / FAIL，176个已登记组、176个已观察组、19条失败：7条未登记、7条过期登记、3条Alert owner边界错误、1条Dialog controller未登记、1条过期专用例外。总数组数相等不证明双方集合一致；修复后的另一次最终全树结果见本账本执行结果节。

原始输出固定在`.reader-artifacts/page-structure-stage4-followup-20261103/messages/global-check.json`。配套`audit-inputs.json`绑定检查器、登记表及本次实际审读的源码；不将旧全树结果当作本次运行，也不把本次AST结果扩写为业务运行证据。

## 19条失败逐项责任与修复边界

以下路径均相对`entry/src/main/ets`；表中“当前”表示存在当前消费者接线的代码事实，未证明设备触发。每项复审触发均为登记或扫描器修复进入本批、相应宿主/身份规则改变，以及后续开放前。

| ID | 检查失败及入口 | 事实owner / 宿主与退役条件 | 判断与退出条件 |
|---|---|---|---|
| MSG-01 | 未登记：`features/reading/ReaderOpeningPageState.ets#ReaderOpeningPageState.build::shared.page-state` | 当前`ReadingExperience.chapterLoadingContent`；实际章节/生命周期/selection、`openingSkeletonPending`与`windowChromeActive`。就绪、失败、新实体或退出由原ReadingExperience退役；组件只画placeholder，Back转交`beginExit`。 | P2登记缺失；可登记现有ReaderPageState，不能把骨架消失记作阅读位置提交。退出：入口可解析且保留上述owner。 |
| MSG-02 | 未登记：`features/search/ReaderSearchHistoryPanel.ets#ReaderSearchHistoryPanel.build::shared.page-state` | 当前`ReaderLibrarySearchSurface.header`按`model.currentOwner()` key挂载；SearchHost持有history加载/失败事实。父级history/retry/clear回调保存owner，组件Area另核status；输入区不可交互时父级关闭命中。 | P2登记缺失；页面/局部读取状态合规类别。退出：登记加载/读取失败/清空失败及原重试通道，不声称清空失败为未决写入确认。 |
| MSG-03 | 未登记：`features/settings/ReaderLibrarySyncRecoveryDialog.ets#ReaderLibrarySyncRecoveryDialog.requestConfirm::native.alert` | 当前原同步恢复Dialog的`gateway`；`owns()`、operationId、reviewRevision与`canConfirm`。确认前再核current；关闭/prepare/disappear退休confirmation并清内存password，原journal不因关窗完成。 | P2登记缺失；源码已经通过ReaderNativeAlertOwner.present。退出：同时登记对应shared.alert-owner与桥接边界；不改生产确认流程。 |
| MSG-04 | owner错误：同MSG-03 | 同MSG-03；native调用是`confirmation.present`第一个callback，非游离Alert。 | P2边界登记不完整；缺`bridge: owned-alert-native-callback`使检查保守FAIL，不是已证明生产绕过owner。退出：审阅后精确登记桥，不给任意Alert通行。 |
| MSG-05 | 未登记：`ReaderLibrarySyncRecoveryDialog.requestContinueCommit::native.alert` | gateway持有已确认原发布；operationId/reviewRevision、canContinueCommit、!busy。只继续核对/应用原同步，不重发新写入。关闭与宿主变化拒旧。 | P2登记缺失；退出：登记当前owner/守卫及native callback桥，继续动作仍由gateway准入。 |
| MSG-06 | owner错误：同MSG-05 | 同MSG-05，实际已走ReaderNativeAlertOwner.present。 | P2边界登记缺失；同MSG-04，不改确认几何或业务。 |
| MSG-07 | 未登记：`ReaderLibrarySyncRecoveryDialog.requestRebase::native.alert` | gateway持有原候选/远端读事实；operationId/reviewRevision、canRebase、!busy、当前密码；确认时再核current后转交原rebase。 | P2登记缺失；退出：精确登记，保留原候选和当前变更，不把重合并当重新上传。 |
| MSG-08 | owner错误：同MSG-07 | 同MSG-07，实际已走ReaderNativeAlertOwner.present。 | P2边界登记缺失；同MSG-04。 |
| MSG-09 | 未登记：`features/settings/SettingsPage.ets#SettingsPage.buildHome::shared.recovery-notice` | 当前Settings home；themeOwner/temporaryBackIdentity/mounted守卫本地journal读取；`originalSyncReadFailed`是真实读失败，未提供虚构operationId。成功读出更新入口，换Runtime/退出拒旧。 | P2 family漂移；旧`shared.recovery`不在扫描器类别，需原位替换为真实`shared.recovery-notice`，与MSG-14配对，不新增重复消息。 |
| MSG-10 | 未登记：`SettingsPage.openOriginalSync::native.custom-dialog` | 当前Settings mounted/home、有效原operationId与可配置恢复owner；重读journal后核operation匹配，再创建Dialog。current绑定Runtime、temporaryBackIdentity、originalSyncPresentation。 | P2登记缺失；退出：登记`registered-dialog-controller`桥，宿主为现有ReaderLibrarySyncRecoveryDialog/ReaderDialogSurface，不创建另一套外框。 |
| MSG-11 | controller未登记：同MSG-10 | 同MSG-10；Settings消失时递增presentation并close，Dialog退场退订gateway和retire确认，关窗不取消原操作。 | P2边界登记缺失；与MSG-10同一项修复，保留data/journal。 |
| MSG-12 | 过期：`ReaderLibrarySyncRecoveryDialog.body::shared.recovery-action` | 当前body仍实际调用ReaderRecoveryAction三处：继续应用、重新合并、失败重读，均保留原operation/reviewRevision/gateway准入。 | **扫描器缺口，不能删登记**：components Map未包含ReaderRecoveryAction，故未观察到现存调用。退出：补官方AST family识别及正反夹具，保留登记。新增识别可能暴露其他先前未扫描入口，须另账，不保证仍只有19项。 |
| MSG-13 | 过期：`ReaderLibrarySyncRecoveryDialog.review::shared.recovery-action` | 当前review实际ReaderRecoveryAction“显示更多冲突”；owns()、gateway !busy准入，visibleConflictCount本地分页，不提交选择/写入。 | 同MSG-12的扫描器漏识别，**不能盲删**。登记应明确分页非原操作重试，避免按组件名分类。 |
| MSG-14 | 过期：`SettingsPage.buildHome::shared.recovery` | 同MSG-09，实际组件为ReaderRecoveryNotice。 | P2旧family，无需删生产；将旧ID替换为真实family并保留读取/退役语义，与MSG-09成对关闭。 |
| MSG-15 | 过期：`features/source/SourceToolsPage.ets#SourceToolsPage.build::shared.page-state` | 当前build只装ReaderStandardPage，ReaderPageState已移到`statusCard`；原tools snapshot、busy、readFacts决定状态，检测另属专用任务。 | P2旧成员位置；核对statusCard既有登记后删除旧ID，**不删除实际状态**。退出：selected文件所有真实入口一致，现存statusCard/readFacts重试仍在。 |
| MSG-16 | 过期：`SourceToolsPage.resultsList::shared.page-state` | resultsList成员已不存在，真实检测进度/逐项结果在batchCheckCard/batchResultRow，snapshot.batchCheck与真实run负责事实。 | P2旧ID；删除已不存在入口登记，保留当前任务表面，不能把任务结果迁成Toast。退出：与MSG-19同步核实专用例外新宿主。 |
| MSG-17 | 过期：`SourceToolsPage.toolsList::shared.page-state` | toolsList成员已不存在；当前pageContent调用statusCard/sourceCard等真实内容。 | P2旧ID；移除旧登记，现有statusCard注册不能漏；不改工具/选择业务。 |
| MSG-18 | 过期：`pages/Index.ets#Index.confirmSourceExport::shared.transient` | confirmSourceExport成员已不存在，当前SourceTools.confirmExportThen及其既有ReaderNativeAlertOwner承担导出确认；导出原owner接回调，不由消息启动写入。 | P2旧ID；核对当前调用/既有登记后移除该旧条目，不改Index dirty WIP，不宣称导出真实交付已通过。 |
| MSG-19 | 专用例外过期：`DEDICATED-SOURCE-CHECK-PROGRESS` / `SourceToolsPage.resultsList` | 当前SourceTools.pageContent按batchProgressRenderKey挂载batchCheckCard，实际run的phase/计数/currentSourceName/results；关工具页不由消息取消/完成任务。 | P2宿主重命名；将例外member改为真实batchCheckCard、更新owner/退出依据，理由仍是已有持续检测任务与逐项结果，**不新造豁免**。 |

## 可执行的后续批次

1. **登记卫生**：MSG-01/02、MSG-03–11、MSG-14–19可以仅改登记表（包括三Alert和一个controller的准确桥、旧ID删除/替换和专用任务member更新），无需改生产。先冻结每条before/after及来源SHA，逐项人工分类；不能直接把扫描输出全量自动写入登记。
2. **扫描器修复**：MSG-12/13必须补`ReaderRecoveryAction -> shared.recovery-action`识别。先加安装SDK AST正反夹具，覆盖直接/别名/组件/同名普通字符串及不在本次family的API。这会扩展扫描实际能力，应将新增观察到的跨页action逐项登记/归类；不能删现存真入口只让检查通过。公共ReaderPageState/ReaderRecoveryNotice内部action桥也要区分组件适配边界与业务宿主，不能误报为新的独立业务owner。
3. **局部复验**：每个修改文件执行`node tools/check-message-entrypoints.mjs --check --file entry/src/main/ets/<准确文件>`；检查器增加family后，精确运行其新增fixture case。声明只证明源入口与登记一致；相关生命周期方法未变时复用既有准确证据，不因登记新增而跑业务全量。
4. **完成条件**：本账本每项留下对应真实ID与退役依据、selected对照结果、失败原因及仍未证明的行为。全树最终复验仅在本独立消息修复批次完成后再预登记一次；不得借选定文件PASS宣布全树PASS或Stage 4/产品验收完成。

以上为执行前定位。随后用户授权完成当前可做事项，父agent明确展开本独立消息工具/登记修复。白名单增加`tools/check-message-entrypoints.mjs`、`tools/message-entrypoints.json`、`tools/test-message-entrypoint-recovery-action.mjs`，不改任何生产ETS/TS。旧19条失败原始输出及before源码/登记保留。

本修复批次预登记精确入口：

- `node tools/check-message-entrypoints.mjs --inventory`：补family后只做一次新增观察清单，用于人工逐项分类；无业务运行，不自动写登记。
- `node tools/test-message-entrypoint-recovery-action.mjs --case recovery-actions`：官方SDK AST扫描真实Dialog/Action/Notice/PageState，核新family、已有owner callback及公共适配边界；缺登记、缺native bridge、游离callback和component定义无调用为负例。只此case，不导入业务测试。
- `node tools/check-message-entrypoints.mjs --check`：全部已审登记/工具变更后一次最终全树一致性检查，不附带生命周期/视觉/产品门禁。新增family观察范围有实际扩展，最终组数与失败数按真实结果记录，不承诺仍为176/19。

没有HAP、签名、安装、设备操作或业务网络。19条原诊断保持历史FAIL；新结果单独记账。工具或登记PASS不能证明运行时业务、原生层级或Stage 4的E2/E3。

## 本批新增Action观察组的审读清单

补识别后共观察到25个`shared.recovery-action`组：原Dialog的body/review两个有效登记保留，其余23组逐项新增，未用一个泛化宿主说明批量覆盖。组件本身的默认generation=0只保护同一组件的数字代次，不是route/entity/presentation身份证明；下表按实际调用明确这一区别。

| owner.member | 业务事实/当前边界 | 已核对的准入与仍需保留的限制 |
|---|---|---|
| BookshelfManagementPage.statusCard | 当前管理页已有列表的读取刷新 | 无originalPending、非busy、canRetry；携recovery generation转交原owner，跨Runtime由父级负责。 |
| LocalImportDialog.fileSelectionActions | 当前文件选择/取消 | pickerOpening忙态与selectionEnabled；选择、取消属于文件任务/关闭意图，非未决写入恢复。跨opening由原ImportPresentationOwner守卫，Action自身默认0不自证。 |
| LocalImportDialog.resultFooter | 当前批次结果关闭 | 完成只onClose，不代表所有项成功，不取消后台原操作。 |
| ReaderPageState.build | 公共状态动作适配 | 主/次enabled且非loading；只有转交意图，无独立业务owner。默认0不代替调用者身份守卫。 |
| ReaderRecoveryNotice.build | 公共原操作通知动作适配 | view.generation/busy/secondaryBusy；展开只改UI。主/次原operation最终准入由调用者负责。 |
| DiscoverPage.operationFeedback | L0关闭，保留 | 有旧books、failed/refreshFailed/partial且canRetry，携generation；开放前核实体/query准入。 |
| MangaDownloadOperationsPanel.retryAction | 当前漫画Sheet/目录popup的动作目录读取 | 非loading且真实failure；重读目录不自动派发下载/删除。默认0，跨Sheet准入保留在父owner，未做原生生命周期证明。 |
| ReadingExperience.readingFailureActions | 当前阅读/换源失败、设置及导航 | 换源scopeId与恢复generation各有ForEach key，普通retryReading由原reader守卫。未决进度仍沿原恢复，非任意重派写入。 |
| ReaderControlDirectoryContent.catalogStatus | 当前阅读控制目录保留旧条目 | 非loading、interactionEnabled，onRequireCompleteCatalog；跨presentation由reader owner负责，默认0不自证。 |
| ReaderControlSearchContent.loadMoreAction | 当前阅读内搜索分页失败 | results/hasMore、loadingMore忙态、交互及动效端点；点击复核results。旧query/operation最终由父owner负责。 |
| ReaderDirectoryNavigationSurface.build | 当前目录有旧条目的加载失败 | retryOpen核mounted/interactionEnabled，异步response核sourceId/bookId/generation；invalidate使旧response失效。 |
| ReaderDirectoryRecoverySurface.build | 当前书签结果隐藏和已确认写入的读回 | exact presentation/generation identity；isCurrent/!busy/canRetry复核，知道了仅本地隐藏。 |
| ReaderDirectoryRules.build | 当前规则读取/应用后的目录读回 | recoveryIdentity及operation generation，ownsRecovery；目录刷新不再次应用规则。 |
| RssOriginalRecoverySurface.build | L0关闭，保留 | 完整presentation/scope/operation/subscription/guid，mounted/!busy，continue另核qualified；不把unknown当新写入。 |
| RssSubscriptionEditorPage.operationRecovery | L0关闭，保留 | original.blocked使用专门原operation表面；普通write/read identity前缀和generation在dispatch再次核对。 |
| RssSubscriptionManagementPage.operationFeedback | L0关闭，保留 | retryFeedback读取live operation/readFacts并核canRetry；旧物理callback借新事实风险未由登记消除，开放前须做exact identity验证。 |
| RulesManagementPage.recoveryAction | 已有retainedScopes注明未开放 | snapshot ruleMutation/receipt/readFacts投影与generation；Index内有builder声明不代表当前路由可达。 |
| SettingsPage.operationFeedback | 当前设置只读刷新 | mounted/Runtime与完整read identity；无pendingSettings才展示，accepted/cache-continue另kind，读取不派未知写入。 |
| SourceGroupManagementPage.introFacts | 无当前组件调用，保留 | result/read=error且!busy；send只核mounted，缺完整captured operation身份，开放前补，不宣称已验收。 |
| SourceManagementPage.sourceList | 当前有旧sources的刷新 | original非blocked、receipt非unknown、canRetry与非空；携generation，跨presentation归Index/Source。 |
| SourceManagementPage.statusAction | 当前状态原动作转交 | label存在、original非blocked，ForEach捕获statusActionGeneration；不开放retained statusBanner。 |
| SourceToolsPage.recoveryAction | 当前工具只读刷新 | blocked/unknown走RecoveryNotice，该Action只在canRetry带原generation；不由消息取消任务或重派写入。 |
| SyncPage.manualActionsSection | L0关闭，保留 | configSave/backup retention各自原receipt identity key与generation，busy禁用；开放前核旧物理回调/Runtime准入。 |

注册状态采用`registered-adapter-boundary`与`retained-before-open`明确适配边界/保留源码；其余`registered-source-entry`仍只表示源入口登记。没有把disabled/无消费者模块接回产品，也没有把它们计作当前运行覆盖。

## 执行结果

- 扫描器仅补`ReaderRecoveryAction`组件family；未改变`nativeOwnerCallback`识别、桥校验、缺项或过期判定，不放宽原有断言。
- 登记表176组→201组：新增30、移除5条真过期ID，原Dialog两条Action保留；Settings family旧条目移除后以真实family新增计入上述数目。专用检测例外沿真实`batchCheckCard`重绑，既有理由保持持续任务/逐项结果。
- `recovery-actions`定向测试exit 0 / PASS：实际4组9个Action调用、3个已owner包裹的native callback；缺登记、真过期、缺bridge和标记游离callback均FAIL，组件声明/导入/文字本身不产生调用组。
- 变更后的唯一最终全树检查exit 0 / **PASS：201 registered / 201 observed / 0 failures**。原19条FAIL原样保留；不把原日志改成PASS。当前这19条源入口/登记问题均已关闭。

执行产物见`messages/registration-changes.json`、`recovery-actions-test.log`、`global-check-final.json`及`verification.json`；登记变更逐条包含before/after及相关生产源码SHA，整个过程没有改生产代码。没有依此重跑业务全量。

当前输入绑定：checker SHA `378ac062…`，registry SHA `102586d1…`，定向测试SHA `987b232a…`；verification SHA `d769ae04…`。另在最终检查结束后仅一次读取相同选择规则下的576个ETS/TS文件，`source-inputs-current.json` SHA `f3f22a9d…`；每个文件单次读取前后stat稳定。该清单是**检查后当前字节指纹**，不是原子前后快照：检查器运行时没有同步采集SHA，不能由此反推运行前已有这些哈希、运行期间从未变化或跨文件原子一致。父agent可按清单精确匹配当前文件，不再枚举/重复采整树；旧19条失败的before检查只绑定当时审读的准确输入，不补造历史全树快照。

消息**源入口与登记一致性**当前通过。以下继续OPEN：调用者跨route/entity/operation的运行行为、所有默认generation=0桥的具体父级准入验证、保留模块开放前验证、Settings原生Dialog实际退场、读屏/焦点/视觉/设备和用户验收。已有正确业务守卫没有被删除；上述账本也不把未执行行为写成已通过。E2/E3和Stage 4原生结论保持原FAIL/OPEN。

后续并行变更边界：全树检查完成后，父agent进一步发现公共Notice“展开/收起”Action的默认generation=0可能使旧按钮影响后继view；该项已交E2分支按授权白名单补view.generation/visible准入。这里的全树PASS仍固定本次旧Notice输入，不覆盖其后生产字节；最终Notice以父agent的准确selected检查及生命周期定向回执补验，其余未变文件按本清单复用，不能将后补结果追写成这次全树运行。此账本不再次运行全树。

父批次最终补验：Notice的展开Action已补visible/clipped/current-generation准入，SearchField只sourceManagement应用响应区；两文件在全树回执之后变化，分别执行准确selected检查PASS（1/1与0/0）。以原清单576路径做一次当前比较，另外574项指纹一致。组合结果维持源入口/登记一致性通过；原全树回执保持其真实时点，未重写成最终源码原子快照或原生生命周期证明。
