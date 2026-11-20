# Stage 5 目录与下载页登记：准备基线与正式接入

14.17/18后当前active修订为Source/目录/下载11/3/3、control6/navigation2。下文14.16数字是当次冻结点；当前唯一页面事实源是register.json，stage5/作者输入不作为第二套active登记。

当前状态：`ACTIVE_REGISTERED / CONFORMANCE_OPEN`。目录/下载已按主方案14.16进入正式登记；下文准备阶段表格作为历史输入保留，末尾正式接入记录为当前状态。静态登记完成不代表原生或操作生命周期通过。前一批21项只读基线保存在Stage 4 follow-up的`stage5-inputs.json`，冻结不改。用户随后裁决下载页常态列表，实施与新输入见主方案14.15/`.reader-artifacts/download-list-layout-20261103/`；早期草案同步装配事实，不能单独证明正式登记或原生合规；正式接入见文末。

## 先确认实际宿主

目录不能登记成单个 `BookDirectoryPage`，须区分四类实际宿主：

- 详情完整目录：`Index.externalDirectory` 的文字分支为 `ReaderFullDirectory → FullDirectoryPanel`，漫画分支为 `BookDirectoryPage`。
- 阅读中完整目录：`entry/src/main/ets/features/shell/ReaderShell.ets` 的 `readingOverlay` 根据内容类型挂载同样两条文字/漫画分支；保留的阅读实例位于其下方。
- 阅读控制目录模块：`ReaderControlPanel.controlContent → ReaderControlDirectoryContent`，Quick/Full 使用同一内容树。`FullDirectoryPanel.embeddedInControl` 是保留分支，当前生产控制面板未接线，不能拿它替代实际模块登记。
- 漫画换源目标目录：Index 复用 `BookDirectoryPage`，属于选择上下文，不能继承详情浏览的全部操作。

下载使用 `SharedDownloadPage`。D3已由用户裁决为常态列表：页头恒在书籍/章节List首项，普通dock在尾项；管理态selectionDock在足以保留有效任务内容空间时固定，否则仍在尾项。管理态“完成”迁到操作区摘要，普通“管理”仍在页头。header与footer位置各自拥有条件，不再由一个overflow值同时迁移头尾；旧hybrid公式属于14.14历史基线。搜索/筛选/排序即时策略、返回顺序和原操作owner不变。

## 目录的 16 层草案

| 层 | 当前事实与唯一 owner | 待补引用或证据 |
|---|---|---|
| 1 路由与返回 | `nav.directory`，父路由为 detail / reading；`directoryReturnTarget` 为 detail / readerControl。详情分支见 Index.externalDirectory，阅读中完整目录见 ReaderShell.readingOverlay，关闭见 Index.closeDirectory | navigation registry 的静态 resolved 不等于设备 Back；ReaderControlPanel 内的目录模块不是独立路由；换源选择身份单列 |
| 2 页面骨架 | 完整目录浏览原型候选 `SecondaryCollectionPage`；文字 `ReaderFullDirectory` 的 scaffold 承载 FullDirectoryPanel；漫画 `BookDirectoryPage` 有独立 scaffold；控制模块实际为 ReaderControlPanel → ReaderControlDirectoryContent | 控制模块外框/handle归 ReaderControlPanel，不能画第二个外框，也不引用未接线的 FullDirectoryPanel.embeddedInControl 充当现状；换源选择是否 `SelectionPage` 需用实际 brief 推导 |
| 3 信息架构 | 文字全目录：父 topBar、目录/书签、查找/排序/定位、列表；漫画：固定标题、随目录滚动的工具/统计、当前章节 dock；控制模块：目录/书签tab、ReaderDirectoryToolbar、目录状态和活动列表 | 各宿主/上下文的首屏预算尚未采样，不能沿用旧书源数值 |
| 4 页头 | 文字 `ReaderFullDirectory.topBar` 与 panel 内部工具分别有 owner；漫画 `BookDirectoryPage.mangaHeader`；保留 standardPage 不能计当前文字详情宿主 | 逐 variant 记录实际 presentation/surface/contentGap，不套成统一 PageBackBar |
| 5 滚动与容器 | FullDirectoryPanel 根据目录/书签选择一个活动列表，使用 ReaderControlListPositioning；实际控制模块 ReaderControlDirectoryContent 使用 ReaderControlDirectoryPosition（ReaderControlDirectoryModel.ts）及 leading correction；各自的 ReaderDirectoryNavigationSurface 在树/flat fallback 中选择 | List owner 与外框动画 clip 各有边界；漫画工具栏为列表 sibling，通过 -mangaScrollOffset 跟随主列表移动，不是第二个主滚动。逐宿主列首次定位、主动滚动、投影变更、收起/重开证据，未跑记 NOT_RUN |
| 6 内容单元 | 真实目录节点、可导航章节、分组标题和书签分离；文字/漫画行各自实现；下载/书签 marker 是独立动作 | 各行内容最小宽度、trailing预算、全部交互 controlRefs 尚未登记，不能把 row 整体尺寸替代 marker |
| 7 查找与筛选 | 文字完整目录 FullDirectoryPanel 为 searchDraft → applySearch → searchQuery；漫画完整目录 ReaderSearchField 为 live；控制模块 ReaderControlDirectoryContent 为 draft → search → query，目录尚未完整时 deferCatalogAction 暂缓搜索/排序/边缘滚动并请求完整目录 | 不能把所有目录写成“即时”：各宿主模式不同；完整目录到达后的待执行动作、过滤空/清除/排序保留逐一登记；SHARED-FONT-CAP-01代码/SDK已修，2×原生仍OPEN |
| 8 页脚与主操作 | 漫画当前章节 footer 有 fixed/flow 条件与实测预算；文字 FullDirectoryPanel 的 collapse 与 topBar/offline菜单各有职责 | 分别登记 footer 条件、安全区、动作准入；不因相近控件先删入口 |
| 9 覆盖层 | `ReaderDirectoryRecoverySurface`、rules recovery、漫画下载 popup、文字 offline menu；平台宿主不得因“下载”虚构 file picker | message entryId需从消息登记解析；弹出与退出身份分别引用实际 owner；焦点返回未执行 |
| 10 状态矩阵 | 目录加载/空/失败、树降级、书签加载/空/错误、漫画字体准备、原操作恢复分别来自父事实；控制模块区分 catalogComplete/loading/loadFailed、已有条目和待执行目录动作 | 旧目录存在时继续展示；控制模块请求完整目录后的执行/失败状态需独立覆盖；原写未知与读取失败不合并；离线/部分失败覆盖需补矩阵 |
| 11 视觉 | ReaderTypography、MangaDirectoryVisual 与 FullDirectoryPanel既有token/资源；不迁移样式 | 生产字体正确字形、对比度、文字换行/裁切尚无本轮原生验收 |
| 12 交互 | 章节选择、marker、书签、排序、定位、下载菜单、收起；由捕获目录/阅读身份转交 intent | control registry当前仅书源最小集，不冒用source控件ID；四字号目标声明/原生命中分开 |
| 13 适配 | 完整文字目录panelWidth/HeightOverride、expanded与漫画flow footer/真实安全区分别由既有计算决定；实际控制模块接收availableWidth/Height及progress；保留embeddedInControl分支另记未接线 | 320/366和四字号尚未对各宿主执行；无高度时的预算及键盘关系需单独核，不借书源PASS |
| 14 可访问性 | 行层级名称与marker label已有局部实现；active宿主通过Index可见/禁用/隐藏后代 | 焦点顺序、模态焦点恢复、重复名称和读屏均NOT_RUN；引用缺口显式记录 |
| 15 测量 | ReaderFullDirectory/BookDirectoryPage使用ReaderMeasurementStore；FullDirectoryPanel与控制模块定位实现分别登记；ReaderControlDirectoryContent有session/ticket、行高变化与leading correction，宽高由control传入 | 按variant列key/revision/width/font/identity及旧回执处理，不复制成新测量事实源，也不把控制模块定位写成旧FullDirectoryPanel实现 |
| 16 数据与生命周期 | Core目录事实经Index/RuntimeOwner/Gateway投影；navigation opening/query generation、阅读定位、下载/书签原操作身份独立；控制模块另有sessionKey/lifecycle/placement ticket及pendingCatalogAction | operationRefs与原回执/陈旧回调需绑定实际方法；完整目录到达后暂缓动作仍核对lifecycle/session；UI关闭不取消原操作，不能把列表读回当写入ACK |

## 下载页的 16 层草案

| 层 | 当前事实与唯一 owner | 待补引用或证据 |
|---|---|---|
| 1 路由与返回 | `nav.downloads`；Index捕获父级；页面 `onTemporaryBackBridge` 注册当前presentation的consumeBack | 页面实际顺序为 confirmation → sheet → managing → detailKey → publishViewState/Index captured parent；系统Back/状态恢复未执行 |
| 2 页面骨架 | `SecondaryCollectionPage`候选；一个scaffold，书籍列表/章节列表择一，overlay承载已有sheet/confirmation；header恒inflow，footer独立按任务放置 | D3已裁决不等于active登记/原生合规；不复制第二个页面根骨架 |
| 3 信息架构 | List首项topBar、查询/书籍或章节上下文、内容、普通dock；管理态操作区独立fixed或短高降级 | 首屏与无内容状态仍需原生预算证据；书籍与章节两上下文分别登记 |
| 4 页头 | topBar自身实测且恒为List首项，scaffold固定header隐藏；语义仍Back，presentation为ScrollAway | 普通非沉浸列表通过navigationPersistence=optional/titleCanExit=true推导，无需伪报沉浸内容；定位当前需计入恒定首项 |
| 5 滚动与容器 | 活动listScroller/chapterScroller，另一上下文不作为第二个主滚动；List使用contentOffset | 初始ViewState、管理前锚点、章列表恢复分别有generation/font/window约束；原生稳定性NOT_RUN |
| 6 内容单元 | 书籍/章节不同投影、下载状态、选择与动作按钮；正文行height有原生内容/复制测量 | 不按一个通用source行套用；每个真实目标/文本区/按钮密度仍需登记 |
| 7 查找与筛选 | initialViewState恢复query/type/state/source/sort/direction；query由TextInput.onChange即时更新并经Watch发布，无onSubmit等待；filter/sort选项直接修改stateFilter/sourceFilter/sortField，页脚“完成”只关闭sheet | 无匹配与全书架为空已有不同文字；当前没有filter/sort draft、Apply或关闭回滚，不能借用搜索筛选面板的提交契约；方向按钮也即时切换 |
| 8 页脚与主操作 | 普通storage/章节dock为List尾项；managing=true才可固定selectionDock，管理完成/所选数/全选/业务操作保持当前任务可达，短高降级尾项 | fixed/inflow最多一处；只有fixed额外避让footer真实预算与safe，inflow不重复扣；真实边缘命中/极短窗口仍待原生验收 |
| 9 覆盖层 | BoundedSurface/actionSheet、InlineSelect、ReaderDialogSurface confirmation、RecoveryNotice与transient owner | 均需解析实际message entryId；不新建消息或平台外框；native焦点/层级未执行 |
| 10 状态矩阵 | 字体准备/失败、书架读取/错误、空/筛选空、章节projection失败、pendingMessage、queued/running/paused/failed/unknown | 未知下载队列不能显示可重派按钮；部分失败/读回与原写入需按Host事实登记 |
| 11 视觉 | SharedDownloadVisualSpec与TYPE_DOWNLOAD_*，已有approved范围注释不能推广为本轮设备验收 | 生产字形/对比度/材质/2×仍OPEN，不替换字体制造通过 |
| 12 交互 | SharedDownloadUiIntent仅意图，页面不写队列/文件/书架；current book/chapter在派发前重新定位 | 当前control registry无该页完整控件，须逐项新增而非复用source ID；目标命中未执行 |
| 13 适配 | availableHeight消耗实际pageHeight，键盘resize不二扣；管理fixed footer必须留有效任务单元预算；sheet/dialog各自chromeOverflow独立 | 代码/SDK矩阵与真实系统字号/原生窗口证据分开，不把context标签当渲染；无滚动方向自动显隐 |
| 14 可访问性 | 既有各行/选择/动作label需逐个审，sheet/confirmation焦点由现存宿主承担 | 角色/checked/busy/禁用、读屏与焦点旅程未验；不把message已登记当a11y通过 |
| 15 测量 | ReaderMeasurementStore、measurementRevision、dock与sheet/dialog/body实测各有边界 | 列实际key/generation/允许回执，检查overflow跨界后同高回执和重排；当前只做源码清单 |
| 16 数据与生命周期 | SharedDownloadHost/Coordinator/Gateway持有队列与事务；mountedIdentity/presentationGeneration退役UI；ViewState发布回Index | operationRefs须精确绑定队列/存储动作及原回执；fonts/sheet/chrome异步世代与业务身份分开 |

## 上游引用与准入

已存在且可直接引用：`tools/contracts/navigation-registry.json` 的 nav.directory/nav.downloads；`ReaderOperationFacts.ts`及其实际Host；消息登记中当前目录/下载入口（本轮消息工具修复后只以最终登记逐项解析）；共享几何/测量/字体/token事实源。

仍缺：两页实际控件的controlRefs及对应source symbol、操作绑定、a11y block、16层类型化facts和每variant budget。目录输入须固定 ReaderShell.ets、ReaderControlPanel.ets、ReaderControlDirectoryContent.ets、ReaderControlDirectoryModel.ts、ReaderDirectoryToolbar.ets，以及完整目录两类实现；不得只固定保留的FullDirectoryPanel嵌入分支。platformHosts只能按真实入口添加；当前草案不把任何下载操作推定为平台host。没有这些引用时不向active register追加半张表，也不填假的bindingStatus=bound。

Stage 5正式登记前仍须补：目录真实variants和Brief推导、上述缺失上游引用、当前输入固定。D3已裁决并按14.15实施，不再列为未决。这里的静态准备可独立使用；共享规格迁移与原生证据各自审查，不能搬用书源SDK数据宣称下载合规。以上是准备阶段结论；正式接入后的页面/控件修订与边界以文末为准。

## 正式接入结果（2026-11-03，主方案14.16）

目录与下载已进入`tools/page-structure/register.json`，不再是准备稿。当前3个页面族、15个额外变体，共18个登记主体；页面族不是新业务路由。Source revision9只同步control消费修订，16层事实与生产字节未变。directory/downloads各revision1，control registry revision5共88个控件族：原25 + 目录27 + 下载36。所有新操作引用均partial+knownGap，未使用空例外或假bound。

| 页面族 | 实际登记上下文 | 关键开放项 |
|---|---|---|
| directory（11上下文） | 默认详情text；详情manga、阅读text/manga、文字控制模块、详情/阅读漫画换源选择；四个manga宿主各拆固定/入流footer | 已知不足44目标E2；仅control-text保留1.1/1.07字号上限E3；Selection实际Back/直接选行与现有原型不符；读屏/焦点、动态遮挡及操作生命周期NOT_RUN |
| downloads（6上下文） | book/chapter × 普通浏览/管理fixed/管理inflow；默认book-browse不重复登记 | E2；book无一键清全部筛选B3；存储选项只改草稿，configureStorage API存在但UI没有派发；原生/E3/操作生命周期NOT_RUN |

目录每个主体绑定40个实际源码输入，下载每个主体绑定33个；host.factSource必须有源码SHA。嵌入模块使用content-only scope，继承reading路由，无独立页头/固定外框；适用层G09/E2等照常校验。完整文字目录经ReaderBookmarkList走legacyBody，不受motionBody上限影响，不能连带判E3 FAIL；其真实大字号仍未验收。

本批`validate-model`、`check-contract-refs`及两项新正反fixture均PASS。`check-register`按真实问题保持FAIL：31条FAIL诊断为各上下文重复展开的已知规则问题，不是31个新业务缺陷；另有11条NOT_RUN诊断、342个manual规则/主体项。无SOURCE_DRIFT、INPUT或布局报告漂移。schema/引用通过只证明登记可解析，不提高操作、消息生命周期或原生结果。

既有筛选六case、compact-sheet与下载D3 SDK回执按相关生产/测试字节未变复用；本批无生产修改、HAP、构建、签名、安装或设备操作。P0内容归档与Stage 5新候选指纹分别保留在`.reader-artifacts/page-structure-stage5-20261103/`。新增缺口不在登记批次偷偷修复，后续仍按主方案分别裁决与执行。
