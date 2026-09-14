# 真机人工审视：搜索、通用设置与主题界面审计

> PH31更正：用户后续明确错误在正文背景，不在原主题色块；下文“色块追随paperStart/paperEnd”的处理已被驳回。[PH43](FOLLOWUP_43_47.md)恢复原色块并修改阅读基色，新增独立原稿色值回归，不能把本报告当时的同源互等PASS继续当作正确修复证据。

## 证据与结论边界

用户反馈对应物理设备上的 `9509d4feb410ce559d67b77785e2248e88485f4e`，run `20260913T160039Z-9509d4fe-25529e1f`，signed SHA256 `b9ef64ece51c02c865ca1740fee52ca7efebe162495fb784fa000fae1aacf2fd`。VYG-AL30于2026-09-14 01:01:11.393 CST保数据安装启动。当前补修未在该包内。本分项不操作HDC/VM、不构建、不提交；先记录用户现象和新增同源发现，再审计源码、已存Make、只读Git历史、生产方法和实际SDK生成的Builder。代码/本地检查不能替代新包、设备像素或用户验收。

本表同时列唯一PH编号和用户原编号，避免17/19重复编号导致后续条目错位。PH25的排序缺陷已修复，实际那次“找不到原版”的来源覆盖结论仍OPEN；没有要求用户重新决定既定样式。

| ID / 原编号 | 当前源证据与原因 | 本轮变更及本地结论 |
|---|---|---|
| PH07 / 7 | `ReaderControlAppearanceContent.themeAction`两个按钮始终显示静态文案；`ReaderAppearanceState.setReaderAppearanceDayTheme/NightTheme`对不匹配类型静默返回，未向用户解释。 | 按已接受的snapshot显示“已设为日间/夜间”；选择其他主题后恢复“设为…”；点错日夜类型显示先选择正确类型的明确提示。只修改已选择主题；沿用持久保存链与保存失败提示，不抢先宣称写盘成功。实际SDK按钮→生产setter→snapshot→保留Text更新PASS，动画期间禁止派发也PASS。 |
| PH22 / 20 | `9509 SearchPage.stateContent`的初始Scroll没有顶对齐；历史测宽依赖按可见数量生成的内容，初值0可使一条历史全部被折叠。 | `c398cafe`已修独立测宽容器及TopStart，保留该补修。本轮复查6组真实SDK/实际测量生命周期PASS；该提交尚未进入用户9509包。 |
| PH23 / 21 | `SearchHistoryLayout.collapsedHistoryCount`已有两行算法；旧moreChip可见文案为“X条更多”。 | 固定可见文案“展开/收起”，辅助访问仍描述剩余条数；≤两行没有按钮。实际13fp字体测宽、手机/平板内距、宽度收缩、空→有历史、长项、展开/收起状态回调6组PASS。 |
| PH24 / 22 | `818056bb`将SearchPage原生LoadingProgress替换为自绘Circle/Path转角；父版本实际是正文36、顶栏13的原生指示器。详见下面来源。 | 恢复原生LoadingProgress的既有样式和系统动效，尺寸/颜色保留；仍使用一个持续挂载的SearchSpinner容器，依据active/foreground/reduceMotion启停，取消自绘圆弧/自建旋转驱动。真实SDK验证13/36、两个颜色、前后台/减少动效/停止响应及不重挂载PASS。原生逐帧观感仍待新包用户验收。 |
| PH25 / 23 | `SearchPage.groupResults`只以首次到达rank排序，完全没有关联度；准确标题来自慢源时可排在同人之后。源覆盖边界见下节。 | 新增薄业务排序：精确书名、精确作者、书名前缀、书名包含、作者包含、其余；同等级仍按首次rank，合并组保留所有源身份并选更匹配代表；query加入投影缓存键。真实生产groupResults红→绿，迟到准确标题、别名合并、类别过滤、缓存更新PASS；Orchestrator证明7个启用文本源都被调用，单源失败不丢迟到准确结果。实际源响应缺失未定位，不与排序PASS混写。 |
| PH31 / 29 | `ReaderControlAppearanceStyle`使用独立`swatch`色，正文通过`ReaderAppearanceRenderStyle/ReadingSurface`读取paperStart/paperEnd，两套值本来就不同。 | 色块改读正文同一registry的paperStart，当前主题库同时预览paperEnd渐变；8主题不再另设色块色。SDK断言8套渐变端点与正文定义一致。正文纸张纹理、设备色彩和像素视觉仍是设备层，不把端点检查写成整屏像素相同。 |
| PH32 / 30 | 完整外观页重复pageTurn/alignment入口。已查实际Make V9与历史patch；不是用户授权再放一套，详细来源见下节。 | reading agent移除重复两行、对应悬空选择分支，收缩84vp布局预算；保留完整设置中的翻页/对齐状态与业务回调。其对应选择/几何测试由reading agent更新。此分项不以旧的“8行完整照搬”断言阻止去重。 |
| PH34 / 32 | General全高Scroll未声明顶部对齐。扩审全features的30个含Scroll组件文件，另定位5个同源表单。 | General、Rules、SourceTools、BookshelfManagement、Sync、RSS编辑器六处明确TopStart。实际SDK分别编译执行六个根Builder后检查Scroll属性PASS。完整范围和未改原因见下节，未宣称所有Scroll一律需要修改。 |
| PH35 / 33 | `SettingsPage.cacheActionRow`在固定66×34框内渲染6字11fp文案，没有适应字宽/字号缩放的空间。 | 66为最小宽、55%为最大宽、34为最小高，文字可两行且居中，增加内边距。生产SDK验证无固定width/height，pending/success/failure标签保留更新；重复点击只发一次清缓存请求PASS。实际极端系统字体大小仍需像素验收。 |
| PH36 / 34 | PageBackBar回调原来正确，但Index系统Back分支把所有settings直接送回书架；General为SettingsPage私有state，Index看不到。 | section提升为Index受控状态，SettingsPage→SettingsShell透传；系统Back先General→Settings，再Settings→Bookshelf。生产onBackPress链PASS，已有换源覆盖层优先级不变。 |
| PH37 / 35 | ReaderToggle关闭轨道复用TOK_BORDER，夜间为#FFE2D1B9，与浅色旋钮很接近。 | root在统一registry新增app.toggle.offTrack：日间保留#FFC1C7CD，夜间复用既定TOK_LINE_STRONG的#57E2D1B9。本分项只改关闭消费者；四种日夜×开关状态SDK回归包含44×24轨道、20旋钮、左右位置、点击回调PASS。阅读Morph的独立SwitchTrack已有独立深色轨道，未改其既定运动。 |
| PH41 / 39 | LocalBookDetail.chapterSection的“完整目录”旧fontColor误用TOK_PRIMARY_DARK夜间实体底色；05c39cf7修订为TOK_PRIMARY_TEXT但未进入9509。 | 确認同源；保留已完成41处统一前景角色修复。本轮21个真实SDK保留状态+41处前景AST检查PASS。详情组件尺寸/章节空态的新修改归书架agent，未覆盖。 |

## PH24：旧生产版本与Make的区别

只读`git show 818056bb^:entry/src/main/ets/features/search/SearchPage.ets`确认原版为正文36、顶栏13的`LoadingProgress().enableLoading(true)`。`818056bb`引入`SearchSpinner`的Circle/Path与1000ms线性旋转。

已存`../2026-09-13-current-gap-register/import-search-motion-current-audit.md`及其`import-search-motion-raw/make-search-source/src/app/App.tsx`包含Make Spinner1000ms证据。因此不能说原设计缺少动效。本次用户明确要求“参考当前修改前版本，仅优化渲染”，按该最新指示恢复旧生产的原生LoadingProgress，而非继续自绘近似。组件保留与可见性启停优化继续存在；不改变搜索请求调度来掩盖动效问题。

## PH25：已审计的来源覆盖与尚未确认的事实

- `SearchPage.scopeSourceIds`为undefined；在线/本地标签是列表过滤，不会偷偷缩小书源网络查询范围。
- `SearchOrchestrator.performSearch`过滤启用、有名称、文本类别的源，4 worker执行全部候选；晚到源不会因早到结果停止；失败单源隔离，停止/切换查询/隐藏时按既有生命周期处理。
- `flattenCollected`保留本次searchRequestId对应的所有源bucket；`SearchGateway.refreshBooks`只丰富已准入身份，不向当前查询伪造无关缓存结果；本地导入单独查书架，远程书架成员不会冒充“本地导入”。分组保留sourceId/bookId/detailUrl/variants，不按书名丢掉可打开的源身份。
- `SearchGateway.searchBySource`调用`book.search{sourceId,keyword}`，没有page；Core `reader-runtime/src/remote.rs:6110`默认page1。当前覆盖所有启用文本源的第一页，**不等于覆盖每个源的全部分页**。没有证据证明这次原版就在后页，因此不猜测这是该次根因，也不擅自发起无界分页网络请求。
- Gateway要求合法标题/远程ID/variables；同源任一非法条目使该源返回显式失败，当前不会静默混入损坏条目。Core `reader-content::search_book_source`使用源规则解析，空列表可按Legado规则回退详情；JS搜索URL守卫也可以显式产生空结果。这些是核查过的实际分支，不代表已证发生于用户该次搜索。
- 现有真机反馈没有对应源ID/版本、每源响应或失败记录。无法从列表截图证明原版从哪一层消失。后续只在还需要定位时，关联**同次keyword/searchRequestId、候选源清单/版本、page、Core返回标题与ID/失败原因**检查；不再重复抓一张列表截图替代源侧定位，不把此项标全闭环。

新增回归用真实Gateway+Orchestrator执行7个启用文本源+停用源+音频源；第7源延迟返回准确书名、第3源失败，验证7个文本源均被请求且准确书身份最终保留。此为控制输入的源码回归，不能充当那次真实书源可用证明。

## PH32：重复条目的来源与误用

参考为Make `LOYUJr93KwespD5j7N6icw` **Version 9**，已存`../2026-09-12-make-full-audit/AUDIT.md`记录ZIP SHA256 `23e6046f8be80bab9f6467262a971317f9a1b15b47d54cd11a5521662a6fa72c`；`../2026-09-11-make-style-parity/appearance-reference/src/App.tsx:1122`起的selects数组确有缩进、简繁、翻页动画、文字两端对齐。

但V9不是重复入口第一次出现：`../2026-09-11-appearance-make-v9/task-only.patch`明确显示修改前已经有pageTurn/alignment（y158/210），V9只是保留并挪到y122/164。当前Content路径可见Git提交`d6966fc9`已包含这些行；更早保留FullPanel的历史也含同类入口。`../2026-09-11-appearance-make-v9/README.md`把排版库记为8行，后续`make-full-audit/MATRIX.md` G04主要核对该局部下拉选项，并未完成与完整设置页的产品职责去重。

错误在于继续把局部参考内的功能清单当作当前外观页职责，而未与已经存在的完整设置统一，不能归因用户要求重复。现在按明确要求去掉外观页的重复入口，保留完整设置中的有效翻页/对齐能力和持久状态；不删除业务状态来“消除重复”。reader agent独占去重与几何/菜单回归。旧FullPanel目前仅被无外部生产入口的ReaderAppearanceMotionStage引用，按保留诊断分支处理，不能把它当当前正式入口证明。

## PH34：Scroll扩审范围及处理依据

代码枚举全features中30个含Scroll组件文件。按实际作用区分，而非仅匹配Scroll就改。

- **同源修复6处**：SettingsShell.General、RulesManagement、SourceTools、BookshelfManagement根管理页、Sync根配置页、RssSubscriptionEditor根表单。全部填满余高且缺顶对齐，短内容/宽大窗口存在默认居中条件。本次观察先在本文初始扩审记录落盘，再定点加TopStart。后4处是源码发现，不声称真机复现。
- **已有明确Top的正文/列表5文件**：DiscoverPage.results、RssPage的两种正文结果、RssSourceFeed、RssEntryDetail、RssSubscriptionManagement；SettingsShell.Home已有Top。源码无需同类补修。
- **SearchPage**：initial为已补TopStart；history/group条为Horizontal Scroll，保留横向逻辑；empty/sourceRequired是居中插画、说明与行动按钮页面，已有自身top50/bottom40留白，未把它们当表单去改。结果为List，使用保留可见位置策略。
- **书架/导入**：BookshelfManagement的第二Scroll与SourceManagement标签为横向条；BookshelfEmpty是空态插画；LocalBookDetail包含详情封面等专门排版，归书架agent；LocalImportDialog两个结果Scroll由实际内容/面板预算决定高度，不能直接套全高表单判断。
- **阅读域**：14个含Scroll的组件文件为Quick/Full/Morph、TTS配置覆盖层等专用容器，受现有几何、进度和滚动偏移同步合同约束。由reading agent专项审计；本分项没有通过批量加TopStart改其运动。该边界不写成阅读Scroll已经全部验收。

实际SDK回归执行六个被修复表单的生产根Builder；检查原生Scroll收到TopStart、布局仍使用余高。SDK探针记录属性和回调，不能模拟真正的原生测量与像素布局。

## 本地回归与红绿证据

- `tools/test-search-settings-physical-feedback.mjs`：7组PASS（含六个表单Builder、两种原生搜索尺寸、四种Toggle、8个主题色块、默认主题动作、Back链、异步缓存标签）。对9509源快照执行，同7组均FAIL；失败为旧Indicator类型、静态反馈文案、错误轨道/渐变/Scroll约束、错误Back目的地/固定缓存边界，不是字符串存在性当行为。
- `tools/test-search-history-layout-lifecycle.mjs`：6组PASS；≤两行没有折叠入口、超过两行展开/收起文案与状态一致。
- `tools/test-search-view-state.mjs`：PASS；对9509实际groupResults新增迟到准确书回归为FAIL（实际首项fan1，预期original），修复后PASS。保留8000项稳定对象/无反复线性查找检查。
- `tools/test-search-orchestrator.mjs` / `test-search-gateway.mjs`：PASS，包含新增准确书迟到+单源失败+所有启用文本源覆盖用例。
- `tools/test-surface-repair.mjs` / `test-settings-cache-cleanup.mjs`：PASS。
- `tools/test-theme-primary-text.mjs`：41处生产前景AST、21个SDK保留状态PASS；`test-theme-local-consumers.mjs` 76处绑定/46角色PASS；`test-reader-theme-selection.mjs`主题真值表、失败回滚、删除回退PASS。
- appearance Make/extension在本分项色块改动后局部PASS；reading agent随后删重复菜单并收缩几何，旧菜单/高度断言由该agent同步更新并复跑，不拿早先PASS冒充最终整体验证。

[新7组PASS](./search-settings-regression-green.log)、[9509新7组FAIL](./search-settings-regression-red9509.log)、[9509关联度FAIL](./search-relevance-red9509.log)、[关联度PASS](./search-relevance-green.log)、[历史6组PASS](./search-history-green.log)、[全源调度PASS](./search-orchestrator-green.log)。其他简短检查日志在本目录同前缀保存。

生产修改已冻结。未打新包、未占用设备、未获得本批用户视觉验收；PH25实际源缺失保留OPEN，其他项本地结论如上，后续统一构建/交付由root负责。

### 统一门禁首次失败：旧排序源码形状断言

root启动整合pipeline后在`test-legado-product-logic.mjs:72`失败，原日志`/private/tmp/reader-physical-feedback-build-20260914.log`保留。断言要求字面形式`rank(resultGroupKey(left.book))`，当前实际生产比较器先计算leftKey/rightKey，再以关联度为主、rank差为同级排序；并非失去了first-seen tie order，也没有移除滚动锚。此处按源码确认，当前不存在所谓compareSearchResultRelevance方法，不能在证据中虚构新方法名。接下来只修该测试的旧形状依赖，增加真实同等级重排/迟到准确书/锚点行为约束，不改生产。


定点结果：旧固定表达式正则改为执行现有真实生产排序回归，新增同等级两书在后续源bucket反序时仍保持最初顺序、迟到精确书可前插、同书源计数更新不替换已观察行、实测anchorKey/offset/itemY不变、真正重挂载按保存key及偏移恢复。原本的`maintainVisibleContentPosition(true)`和实际itemY纠偏约束仍保留。`test-legado-product-logic.mjs`通过（包含上述生产回归），[回归日志](legado-order-contract-green.log)。仅测试与证据变化；没有放松来源身份/分组/恢复业务要求，没有修改生产或重跑整套pipeline。顺带纠正旧测试注释“点分类会重搜”为实际单会话Local/Online过滤，其准入断言保留；此处没有新增来源scope产品缺陷。
