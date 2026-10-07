# 漫画目录严格视觉转换与自适应修复

用户授权：将可保证一致的视觉全部对齐 demo，同时保留自适应。仅在既有独立 worktree codex/manga-directory-native-20261006 修改；未合入主线。Host 基线 e16f41ad，已有目录落地改动保留。

## 发现即记录

| 编号 | 现象与触发 | 代码定位 | 修复及验证状态 |
|---|---|---|---|
| VP-01 | 两套颜色、边线和夜间输入底色不同 | 通用TOK_GREEN/TOK_LINE与demo palette不同 | 共享有限视觉定义，待回归 |
| VP-02 | 搜索13/20变为自动行高，placeholder颜色偏差 | ReaderTypography undefined、ReaderSearchField AUTO分支 | 显式行盒+同scale几何，待回归 |
| VP-03 | 全目录工具固定、短窗书名强制截成1行 | BookDirectoryPage固定overlay与413阈值 | 与列表同offset滚动、自然换行，待回归 |
| VP-04 | fallback named/group间距及数字run margins不同 | EntryRow统一padding/gap；Grid与fallback两套间距 | 共享参数/自然高度/同run外边距，待回归 |
| VP-05 | 字体轴/字重和基线缺乏明确paint证明 | header900子集与650不同；脚本只检参数 | 静态400/500/550/600/650字形与halfLeading，设备paint待验证 |
| VP-06 | 大字数字格可能省略分篇、短sheet固定预算 | fixed列数/ellipsis、quick减215 | 有限降列与剩余高度预算，待回归 |
| REF-01 | 恢复demo有full-footer JSX但基础CSS缺失 | reference Prototype.tsx及prototype.css闭包审查 | 查找原规则；若缺失，沿用已有48vp栏作为明示补充规范，两端生成，不能称为历史原稿 |

## 依据与生成边界

Reader-UI/design/manga-directory/visual.json 为由冻结demo提取的有限视觉定义。字体、颜色、几何、断点生成 ArkTS 常量和 CSS；业务目标/分页/权限/下载事实仍来自 Core。只使用已有ArkUI Grid/List/LazyForEach及FontTools固定实例，不新增通用CSS转换器或解析引擎。

记录source/local/ArkTS/HAP/VM/native visual/user acceptance各层。构建前完成代码侧回归；当前仍未对本次修复产物做VM操作。截图需相同内容尺寸、density、safe-area、fontScale、主题、数据和字体加载状态。抗锯齿/物理spring不得声称零像素差。

## 转换后的独立复核

VP-07：发现V2 scrollOffset仅声明未转发，以及搜索空态清除未接线；代码侧补齐实际回调，不增加Core展示索引。VP-08：320vp/3.2倍字时底栏可能挤掉标题；共享底栏按可用宽度分行，按真实测量高度避让。VP-09：初始工具高度计算应175；浏览器getComputedStyle确认工具行高16.5（继承1.5），更正此前21的提取错误。VP-10：原生宽屏540内容/548栏限制需要同步CSS；quick额外14只能属于quick，不能带入full。VP-11：生成定义中的字重必须真正消费，不能存在不生效的冗余参数。上述均先记录后修复，回归结果后补。

VP-12：详情预览封面仍104×150/gap16/radius10，而demo84×122/gap18/radius8；本轮修正漫画专用预览与首次字体准入，小说不变。VP-13：新增几何watch曾调用不存在的isManga成员，代码审查后改成真实book.contentKind事实。VP-14：ReaderSearchField新增分支重复paint导致旧共享producer背景调用预算7>5；复用公共Styles后降为2，不提高预算、不改旧owner哈希。工具首次提取16.5由浏览器实测确认。完整头栏下载入口/单章下载为已有业务能力，参考尚未覆盖的真实业务状态另记，不用假样本取代Core状态。

本轮新增完整650字重、精确Radix ArrowLeft图形（固定@radix-ui/react-icons1.3.2、MIT来源/hash、只换有限颜色）。NPM安装提示安全告警正在核对，禁止force批量升级。

VP-15：SDK明确Text.lineHeight(number)使用fp；Row/Nav此前手工乘fontScale会重复缩放。行盒恢复基准fp，只有框体和布局预算使用vp乘scale，针对性setter测试同步纠正。VP-16：大字号短窗口quick预算可为0且外Column clip，目录可能不可达；保留至少一个最小格，并使用外层Scroll容纳工具/底栏。VP-17：仅清空本轮测量缓存还不足以保证超长页码，footer按真实高度回调避让；不使用上一字体/宽度的旧48vp结果。

VP-18：生成样式从Prototype模块导入时会早于main的基础CSS，后者覆盖适配参数。尝试调整main触发保护文件校验，立即恢复；改为应用owned prototype.css尾部受hash保护的生成区，保护runtime28文件不变。固定PostCSS8.5.16审计命中已知map读取漏洞，新增依赖改为8.5.29，NPM审计0漏洞；不force升级原项目其它依赖。资源：收到下载任务优先VM验收协调，本线程未占用VM，本地继续，安装/截图待目标释放。
# VP-19 浏览器实渲染宽度和详情避让

2026-10-07 当前未构建候选：生成样式为 grid 子项加入自动外边距，未显式设置 width，393px 窗口的完整目录内容收缩至270.6px；截图和 computed style 已复现。详情避让选择器误写 page-preview，而实际入口为 page-detail，且缺少底栏15px底部位置。修复须限生成样式，保留保护的设备预览代码；以实际渲染尺寸复核。
# VP-20 浏览器分篇自适应列数

2026-10-07 320px/3.2字号详情预览实渲染：共享 helper 判定应降为1列，但旧 .triplet 选择器优先级高于生成通用规则，仍呈现3列。补充变体选择器消费同一 --directory-columns，并在浏览器读取实际 gridTemplateColumns 验证；此问题不是 Core 目录身份问题。
# VP-21 自适应详情和交互状态复审

2026-10-07 当前候选：独立复审定位大字号工具区原生比浏览器多8px、阅读位置标签仍固定字号、详情目录数量原生同行而参考独立第二行、简介展开字号和箭头颜色未消费共同定义。修复统一生成规则；阅读位置按共享宽度预算分行，保留完整页数和章节宽度。简介展开为既有业务功能，补充参考可交互状态而非声称原始HTML已有该按钮。

# VP-22 按压和滚动指示

2026-10-07 当前候选：Demo按压opacity .73，原生未消费；新增有限官方AttributeModifier只设置opacity，平台负责release/cancel，不自研手势状态。Demo滚动时出现4px/28%黑色滚动条，原生Off，改漫画专用Auto/4px/同色。ArkUI系统thumb最小长度、右侧轨道位置、退隐曲线和CSS描边没有同等公开控制接口，此部分必须留待原生截图界定，不能以setter或构建通过声明完全一致。
# VP-23 零匹配结果被浮层遮挡

2026-10-07 代码审计：NavigationSurface 的漫画零结果Column置于Stack TopStart，未消费listPaddingTop/X/Bottom；full fallback独立Text也不在目录滚动容器，空结果会被顶部工具遮挡且无法清除。修复将空态放入原Grid/List的真实空槽，统一164px最小高度、12/18fp、36/12内距和清除回调；保留原目录Scroller、Core target身份及小说路径。
# VP-24 焦点及宽屏目录标题

2026-10-07 代码侧复审：Demo键盘焦点描边2px accent/外距3，原生未设；使用官方focusBox有限映射，不自研焦点状态。宽屏目录标题仍15/24及固定66高度，字号3.2时受截，改目录专用18/27/900、自然高度且66最小值，并测量标题供正文预算；保其他面板原路径。

# VP-25 下载控制占用大字体格宽

2026-10-07 代码侧复审：原生数字格右侧24vp独立下载入口未计入列数，3.2字体时3列各88vp无法容纳标题和下载。共享列数/完整标签预算增加默认0的accessoryWidth，由真实下载能力传24，改能力时刷新有限布局。Demo原始样本没有下载与书源额外入口，此类原生业务附属动作保留，不能把无对应参考状态称为已像素验收；几何在SDK大字号下载用例覆盖。
# VP-26 行命中区域与父子原生手势

2026-10-07 代码侧审计：named/number外观主体的共享按压适配在外层，但点击只在内层文字；参考按钮整行可点击。将主体click移至外层，独立下载/折叠子控件继续通过官方默认父子手势仲裁隔离，不编造ClickEvent.stopPropagation（本SDK不存在），不写触摸状态机。原生物理仲裁仍须目标平台取证；SDK只证明父/子回调和canonical target保持。

# VP-27 长组计数自适应

2026-10-07 代码侧审计：组计数固定nowrap/flexShrink0，极长计数与大字号会超过目录列。允许计数按实际列宽自然换行，原有短计数行不变。修改原生和生成CSS同一状态，保Core计数事实不缩短/重写。
# VP-28 首次宽度和持久侧栏字体准入

2026-10-07 最后代码审计：NavigationList初始 measuredWidth=0，数字格在首次area事件前按1vp绘制。父Surface现在透传真实已知父容器宽，完整目录用窗口/root几何，快捷面板扣除安全区和实际padding，持久侧栏用真实列宽；实际测量仍优先。持久侧栏80固定高度也改为80最小自然高度、同一系统字号，保原CSS款式；显式checked Ser­ifBold准备后才准入，不能依赖其他页面恰好先加载。首次区域、原生文字和合成时序仍须平台证据，SDK仅证明准确参数和生命周期围栏。
# 最终本地冻结记录

共享定义224项尺寸/排版/交互指标、16个绘制角色，SHA256 `6333cddd0d35bb1a32e229b89850d6b0e78f0d5308c8483821f4b13d678a8631`。原始CSS/JSX参考保留，缺失footer与自适应补充有单独provenance。实际浏览器验证393px内容353px、13/20搜索、11/16.5工具、空态164px/12/18及清除恢复；320px/3.2字号分篇降为1列、阅读位置分行。28项保护runtime校验、TypeScript检查及生成新鲜度通过。

共享行/Layout/Grid/fallback/详情完整矩阵、font readiness、父子回调canonical保留、full chrome、quick/motion/empty/header/search/modifier实际SDK针对性回归均通过。保留硬件手势/键盘派发、原生字体栅格和blur阴影合成、系统滚动条时机、未驻留前序页runphase以及宽屏未渲染DOM的证据边界；未把SDK setter或浏览器截图当原生验收。

最终有限capture无source/carrier/budget漂移；93条旧预算、7项可逆迁移、16个有限producer保持原约束。新增QA准确分层，全量发现658=202 source+456 integration。回归中实际出现的旧probe接线/声明断言失败包括SharedFooter组件未挂载、emptyBuilder decorator、fontWeight第二参、directoryHeaderChrome/InitialWidth依赖及Serif receipt I/O port；分别补真实组件/方法/准确声明和相应负控，不豁免生产诊断或放宽旧预算。

下面进入唯一规范iteration signed HAP构建。冻结后构建/目标端结果写在工作区外层 `evidence/manga-directory-20261007/`，不更改本源码记录；最新产物不得沿用10-06的旧HAP哈希。

# 首轮全量门禁与解冻修订

2026-10-07T03:40 UTC：首轮规范流水线完成658项合同门禁，627项通过、31项失败、没有超时，正常退出1；未进入HAP编译或发布。逐项首次失败保留在工作区外层 `evidence/manga-directory-20261007/full-gate-issues-round1.json`，后续针对性通过不覆盖首次记录。

旧partial SDK/pure evaluator主要缺少实际Visual、Footer、Builder/BuilderParam或当前点击actor；旧fixed-height/width断言也需按漫画/小说分支严格证明。修复复用真实SDK成员与生产依赖，保留原小说、图像、业务与生命周期回归及负控。另发现实际生产或来源问题：

- VP-29：900固定标题字体缺少“本书下载/本话下载”的5个字。使用正式FontTools生成器补入六标题覆盖；550/600/650保持字节一致。
- VP-30：8处冗余Image.fillColor全部移除（BookDirectory2/LocalDetail2/MangaSurface3/Search1）。清除图标改用固定ink日夜变体，其他固定色资源保持。
- VP-31：新增SVG进入既有严格来源registry，使用固定Radix上游及共享palette。规范SVG生成入口独占资源输出，视觉生成器不重复写同一文件；来源集合和负控保持严格。
- VP-32：旧chevron-right资源是faint、chevron-down是muted，不能把移除tint等同于颜色已经一致。目录工具和详情操作单独使用accent日夜变体，命名行/卷组原faint/muted资源保留；检查实际SVG填充与共享palette。

本次解冻用于上述修复。共享构建席位已交给下载页任务；等待构建和VM分别释放后继续规范构建及原生对照。default/day、detail/day、quick/day、320px/3.2/night截图均为当前浏览器参考，不代表原生验收。受控漫画取证输入通过实际Core书源导入/检索/阅读路径，只有单级卷组，不作为原生多级树证明。

# 第二轮源码冻结

首轮31项已知失败对应的实际依赖/SDK/行为检查已针对性通过，未删除原小说、图像、权限、生命周期和负控。常规架构、Typography严格carrier/导入/预算检查均通过，预算未放宽。完整658项仍须在此冻结后由规范流水线重新验证。

SVG严格集合388项，固定Radix来源11项；本次新增10个有限日夜变体，规范SVG入口唯一写入，Visual生成检查通过。900字体SHA256为 `bb589e9472aa1bfc3626725464584c9ffcdc4f95cc40de08f04e08a6734ca38a`，6740字节、19字符/20glyph、六标题覆盖，550/600/650字节保持。共享Visual仍为224项指标/16绘制角色、原定义SHA6333cddd不变。

受控在线书源经本配套隔离Core既有CLI内联离线审查：漫画type2、11目录行、3卷组、8可读target、24页抽取正确；CLI无HAP/NAPI来源清单绑定，该记录只证明输入/抽取契约，不替代目标运行或多级树取证。第二輪构建/签名/目标/截图结果继续只写工作区外层证据目录。

# 第二轮完整结果及最后独立复审

第二轮规范流水线正常返回退出1：658项合同检查全部通过（202 source、456 integration），随后真实ArkTS编译失败，7条诊断、编译器计8 ERROR；没有成功HAP。外层日志`hap-pipeline-round2.log`保留，不能把合同PASS等同于编译、目标或视觉完成。

| 编号 | 代码侧定位与实际复现 | 本轮修复范围 |
|---|---|---|
| VP-33 | Detail头栏在800vp为768而参考最大548；非对称安全区没有复用内容frame | 漫画头栏由真实contentFrame扩展4vp，两端保持540/548限制 |
| VP-34 | Detail加入书架字色accent，参考add/remove均muted | 只改漫画次按钮，小说原绿色行为保持 |
| VP-35 | Quick三流子节点只出现footer前17间距，tools后少17；Native/demo预算都只扣一段 | Column space17，去footer重复margin，共同helper计两段34；短窗保留外Scroll |
| VP-36 | Fallback宽度360→580或0→353未跨340时不刷新列数 | 按有限有效宽度变化重新投影，保留原List/Scroller/目标及定位事务 |
| VP-37 | Fallback空态仍Stack overlay，缺显式行盒与按压/焦点 | 现有List真实emptyBuilder，164最小高度、12/18、36/12内距，保清除/全目录业务 |
| VP-38 | Detail同index17更名，父row新而保留child.row/Text旧 | 同key observer从当前mangaPreviewRows取真实row，保留actor和位置 |
| VP-39 | SharedRow更新Prop仍画/点击旧entry、numeric/parts label、download/AX | 当前row按index解析最新entry/label；成员移出不可回退旧target |
| VP-40 | V2 named稳定Core entry:index ID，同key保留旧item.node.title/parent | 每个绘制/动作观察路径读取当前已发布node，保留LazyForEach/Scroller |
| VP-41 | V2下载watch已更新普通Map和changedChapters，绘制未订阅它 | 利用现有可观察presentationRevision发布绘制变化，保业务通知 |
| VP-42 | Search早return后重复比较被类型收窄；Detail色角色string；Footer position/scale撞CustomComponent | 删除冗余死比较、有限ReaderAppColorRole参数、pagePosition/footerFontScale明确成员名 |

独立复审使用真实SDK observer和V1属性代理，同key保留actor后更新，而不是每次重新build的模拟。V2 group已有当前lookup+revision可刷新，已排除；Fallback父layoutRow确能传最新row，故内部EntryRow旧闭包单列修复。仍必须原生验证实际依赖调度、物理回调、字体栅格/阴影与滚动表现。

Quick新实际SDK正负控已检查三流子节点的两段17间距与300vp窗口67vp列表预算（30 handle+41 header+56 tools+48 footer+34 gaps+24 bottom=233）；漏首gap、重复footer margin、只扣一gap均拒绝。首版新增测试误用了padding14及预算68，已先记入外层`root-local-repair-results.json`，按实际定义24和算术67修正测试；未为此改生产几何。生成定义仍224字段/16角色/原SHA，新增有限helper使用既有quickGap。保护runtime28文件与demo TS检查通过。

后续源码冻结/完整构建仍待本批修复收束，以及共享下载任务释放构建和VM席位；无真机操作、无主线合入。后续结果继续写外层证据，不在成功产物绑定源码后改本文。

VP-43（新增代码侧复审）：手机快捷面板的作者遮罩覆盖完整页面，但applyWindowChrome把任何nonempty panel视为presented并请求不透明paper系统栏，Coordinator实际写出的status/navigation band盖住作者遮罩。现有chrome-order主动断言opaque，而其它sheet probe禁用window identity，故未覆盖合成。先记录后修复，使用已有窗口协调器与作者全窗口绘制，不增加颜色解析/遮罩状态机；需证明phone opening/open/drag/closing、close restore、live resize到宽屏、identity撤销和其它页面不受污染。Full/Detail日夜paper与app.window.background RGB/alpha等价，本次没有发现颜色偏差。原生系统图标/Animator合成仍须平台截图。

# 第三轮修复收束与最终冻结

VP33–42已完成源修复与针对性实际SDK正/负控。Detail：320/390/800及镜像安全区44/12、最大548、漫画次按钮日夜muted、小说原几何/颜色均保持；同child/Scroll更新row、metadata、kind、label和当前回调，撤销/禁用保持盾。EntryRow：samekey当前entry/label、glyph、AX、点击及移出/reorder更新；Fallback：实际List area360→580、580→360、0→353和无效/jitter输入、deferred empty ListItem矩阵均通过，字体私有预算保持10/2。V2：当前节点title/parent/depth/current/download Watch、fold actor和撤销/view/Quick membership盾，经保留observer实际SDK回归通过，未全List/Grid/Scroller重建。

VP43已用手机内部作者遮罩期间的transparentSystemBars例外修复，外部overlay、宽屏、shown-controls与关闭后的原配色保持；viewport两值、actual stage两值及metrics Watch均重发既有当前identity窗口请求。真正Coordinator serialized Window writer组合32 cases、累计9负控通过，另外12相关回归通过。新增fixture首次漏真实Builder/header metadata以及尝试超出probe的native分支移除，已先记录并按既有实际SDK helper边界修正fixture；没有伪造Window/state Watch或删除原断言。真实分支移除与连续帧合成仍留给Native。

本次有限capture统一由root更新，所有93条历史业务预算、7个迁移见证及无关producer/carrier仍不可改；原生新成员/实际call expressions精确入收据，不放宽预算。Root Footer合法成员pagePosition/footerFontScale、Quick两gap和Search编译死比较都经过相关实际SDK重新验证。第三轮完整658门禁及ArkTS尚未启动，仍尊重共享下载任务先构建/验收的明确占用；只有其释放席位后才进入规范iteration/local signing流水线和精确VM目标的preserve-data安装。此后结果继续仅写工作区外层evidence，本冻结源不再改文档来追认产物。

# VP-44 阅读完整目录入口遗漏漫画排版

2026-10-07 新一轮用户反馈后的源码解冻：MangaReadingSurface“完整目录”经Index.openReaderControlDirectory、ReaderShell、ReaderFullDirectory进入FullDirectoryPanel.chapterList，但该调用链没有传递漫画展示事实，ReaderDirectoryNavigationSurface的mangaDisplay默认为false。完整Core投影和分页仍保留，条目因此由普通阅读目录renderer绘制；详情BookDirectoryPage已显式mangaDisplay=true，两个入口不能共用视觉通过结论。先记录后修复，限定传递当前readingContentKind事实及既有漫画renderer/fallback，小说和书签分支保持，目标/Scroller/分页继续由已有目录层负责。源码和实际SDK回归待补；本条不声明当前native像素已经通过，也不修改用户最新要求的Quick完整列表任务范围。

# VP-46 阅读完整目录使用小说整页入口

Root本轮已捕获native/reader-control-manga-full-baseline.png/json：Quick“完整目录”打开小说浮动顶栏与目录/书签tabs，而权威漫画Full页面是章节目录PageBackBar、书籍summary与搜索。VP44仅补条目renderer仍保留错误整页框架，不能满足完整视觉还原。代码侧修复改ReaderShell漫画directory路由复用既有BookDirectoryPage，小说仍用ReaderFullDirectory；不新写FullChrome或保留无实际漫画消费者的重复adapter。页码由performPanelAction完成Core确认后的MangaBookPresentation快照，经Index现成refreshDetailMangaPosition与同章节校验传递；缺失/不符保持未知，不查DB或推断页数。VP44初版新SDK fixture因缺真实Builder及ReadingExperience metadata被SDK拒绝，未改生产以迁就fixture；最终入口probe须使用真实组件声明和全部被选Builder。源码/SDK验证待补，当前产物及native后修复截图仍OPEN。

VP44/46最终源修复统一为ReaderShell已有BookDirectoryPage复用，唯一小说消费者继续ReaderFullDirectory；初版Full/Panel漫画adapter撤回，原两文件修复保留。test-manga-reader-full-entry-sdk实际SDK入口回归通过：681项完整已准入TOC、当前/未知/错章节Core确认快照、精确Index页码表达式、canonical target proof、下载/恢复/返回和小说入口，4个缺接线/错页码负控拒绝。已复用SDK真实Builder名prepass和ReadingExperience组件声明，保留其它阅读/换源绘制的明确受控边界；没有伪造BookDirectoryPage实际native布局。另6项关联回归全部通过：control-directory-content、bookmark-panels、direct-entry-recovery、book-directory-page、readable-progress、module-selection。正式类型编译/HAP/新native截图仍由root随后验证，本文不将本地通过扩写为平台通过。

# VP45 Quick directory chapter truncation

- Trigger and new authorization: user clarified 2026-10-07 that the Quick directory shows too few chapters and wants to scroll the complete directory inside the existing compact demo height. This supersedes the demo's original nearby-only projection.
- Pre-fix source finding: ReaderDirectoryNavigationDataSource.refreshQuickProjection inspects at most 64 visible slots and returns named before2/after3 or numeric before4/after7; at the beginning this yields only 4 named or 8 numeric targets. MangaReadingDirectoryFallback.publishProjection makes the same nearby-only canonical slice.
- Recorded source-side reproduction: /private/tmp/manga-directory-full-quick-scope-audit.json executes the real DataSource and unmodified production layout methods. It also confirms that Quick and Full supply different runs to the same classifier. This synthetic probe is not a finding about current VM pixels or the real 斗破苍穹 TOC.
- Repair scope: Quick and Full share Core visible ranks/count and loaded resident run layout; retain 256-page fetches, existing 12-page LRU, canonical node/chapter/proof identities, loading/failure and stale callback guards. Quick's compact frame/tools/footer stay intact. Core groups remain actual groups; no synthetic chapter/context slots. Opening Quick initially locates current; search uses the Core projection and clearing restores the complete projection. Fallback displays its complete already-admitted canonical set and preserves disabled rows and folding.
- Out of scope: no full-catalog fetch, new cache/parser, Core modification, HAP build/install, VM/HDC operation, direct database change or native visual claim. Fullentry routing is separately owned by audit_fidelity_directory_generator.
- Status: source issue recorded before production edit; SDK regression work pending.

- Iteration failures recorded: old SDK Grid probe still requested removed mangaContextRow; old fallback expected nearby6/12/15 and failed after full target admission. These are test-seam/obsolete scope expectations, not permission to weaken canonical actions. New matrix initially expected context11/18 and failed actual10/16; frozen CSS line156 and shared master confirm10/16 with11/10/7padding+bottom1. Root accepted correction; production consumes shared visual values.
- Final role: Quick opens an existing explicit collapsedNodeIds=[] view without modifying Full fold/anchor state. Real Core group slots paint shared read-only breadcrumb; all Core ranks remain intact. Fallback Quick uses all admitted legacy-readable/explicit targets and complete original presentation; Full/search policy stays intact.

- Additional test issues: repeated negative cases initially reused a session-state scope and toggled a prior fold off; fixture scope now unique per independent case. Canonical-rank negative assertion now names its exact failed fact instead of relying on an unlabeled equality. Font readiness partial SDK probe needed the real default Quick Prop and subsequently Root's newly factored directoryCurrentIndex production method; no production UI was stubbed.
- Source audit: Core local_navigation/v2.rs open_v2 consumes collapsedNodeIds in immutable request/projection keys and rows_for_checked; local_navigation.rs applies a request-local HashSet. No fold writeback was found. Host shared revision invalidation remains authoritative; an actual new Core revision may still invalidate obsolete Full fold ids.

- Completed source behavior: removed Quick nearby index/slot projection entirely; Quick uses the exact Core visible count/rank and the same adjacent resident run layout as Full. Real group slots display master context typography10/16 with11/10/7padding+bottom1; they own no read/fold callback. Context observers read the current presentation revision and current authoritative ancestors, preserving the same native Text actor. Explicit empty fold override does not clear Full anchor or mutate Full fold ids on the same revision. Fallback retains the full admitted legacy-readable/explicit-target catalog, exact current-row mapping, complete search, and existing full presentation.
- Full fallback interface: optional ordinary `scroller` uses the caller's exact native object via activeScroller for both first/current/top positioning and ReaderDirectoryList; `onListFirstLayout` runs after the internal first-layout admission and existing current positioning request. Actual native SDK List area callback proves the external object and one first-layout notification; bypass/callback omission negatives rejected.
- Verification: new actual SDK test-manga-directory-quick-complete-sdk executes9000 first/middle/end, true SDK open/prepare/search/clear dispatch, exact Core rank initial scroll and Grid callbacks, equal resident Full placement, 256-page loading and twelve-page cache, same-revision Full folds/anchor preserved, read-only context, retained title/AX update, five negative controls. Existing Grid/fallback/parity/navigation/viewport/fonts/metadata/download/floating tests pass. No actual renderer pixels, scrolling hardware behavior, current HAP/artifact, VM or user acceptance is claimed. Fallback can expose only the canonical entries already admitted by its parent; it creates no catalog fetch when v2 is unavailable.
- Status: producer files frozen for Root canonical registry/capture/build integration; no global typography capture performed by this subagent.


## VP47 — 正文载入失败时快捷目录丢失已确认阅读位置

原生旧产物73b的斗破苍穹漫画：Full footer为06 /6 of681，Quick footer只有当前章节，Quick opening currentChapterIndex为-1；证据native-baseline-user-quantity-issue.json。源码MangaReadingSurface直接取controller.chapter，正文规则失败使它缺失。现有MangaBookPresentation已按source/book、manifest和Core confirmed location维护可用的章节/页显示事实。

修复仅显示回退：当前controller.chapter优先；缺失时使用同身份的rich confirmed snapshot。bare location只有pageOrdinal时不制造chapter/index/total；未知显示保持空。回退不改Core位置、正文ready、跳转证明或保存行为。原生需在新manifest上复验。


## VP48 — 短窗大字号的快捷列表预算不足一行文字

浏览器真实验证320×480/systemFontScale3.2：现有budget floor44小于文字行盒70.4，numeric row92.4/named169.82不能完整展示；quick-full-directory-adaptive-browser-gate.json已保留失败。

代码审计：原生panelOverlay已经使用外层Scroll容纳工具/目录/footer，maxHeight仅约束窗口内viewport，不需要新滚动框架。拟共享最小可读列表高度=max(gridHeight,namedMinHeight)*scale（受330上限），让既有外层Scroll承担短窗内容溢出。默认窗口和全部色彩/字体/间距参数保持；Browser须复用对应body Scroll并实测全文字可见、目录首末/当前定位/footer可达，SDK须验证真实floor与父约束。待两侧验证后记PASS。

# VP49 Full directory adaptive scroll geometry

- User constraint: preserve all controllable demo visual roles and font scaling while ensuring continuous reading at small/short windows. Read-only browser evidence results[1] in quick-adaptive-readonly-before-comparison.json covers320×480/font3.2.
- Observed browser geometry: outer preview scale≈.6692759, current row≈169.8125vp, title two lines≈140.8vp. Fixed header bottom159.6vp; footer top250.4vp; unreserved band90.8vp. Demo centerCurrent additionally removes12 physical pixels at each side, leaving≈54.952vp. The earlier≈73 estimate removed only one side and is corrected.
- Source issue before repair: ReaderDirectoryNavigationList Grid puts all measured header/tools and footer clearance into ordinary main-axis padding. Official GridIrregularLayoutAlgorithm.MeasureSelf subtracts padding from frame size before defining scrollable main size. This is fixed inner-frame subtraction, unlike demo scroll-content padding. Large/scaled chrome can consume the native Grid viewport even while toolbar translation follows its Scroller.
- API audit correction: initially inspected only grid.d.ts and incorrectly concluded content offsets absent. GridAttribute inherits ScrollableCommonMethod; local common.d.ts31482/31496 exposes contentStartOffset/contentEndOffset sinceAPI22. Installed SDK is24(6.1.1.125), current app compatible/target23. Existing official APIs are available, no new viewport framework or SDK upgrade needed.
- Proposed repair: preserve horizontal Grid padding; use inherited official scroll-content offsets vertically without adding a header/GridItem/Core-rank mapping. Full current positioning receives the actual fixed header bottom from its parent. Explicit locate/current start aligns to the unoccluded header+inset, saved anchors retain actual Scroller coordinates. Verify initial currentOffset origin before normalizing toolbar translation.
- Short-window Full predicate: footerTop-HheaderBottom < max(namedMinHeight, namedLineHeight*scale+2*namedPaddingY+border), using actual/measured footer height and safe insets. For320×480/font3.2/safe54/34/footer183.6,90.8<99.4. Flow-footer mode inserts the unchanged existing Footer producer into the existing toolbar flow; its measured height contributes to existing start offset and the fixed bottom overlay is absent. Normal Full remains fixed. Root owns visual generator/demo predicate.
- Verification boundary: actual SDK compiler/property callbacks can establish official attribute and parenting/identity requests, not renderer geometry, current HAP engine values or VM pixels. Root will bind native confirmation to a new artifact after source/SDK checks. No Core change, full-catalog fetch, parser, direct storage modification or HDC/HAP operation by this agent.
- Status: issue/API correction recorded before production edits; official currentOffset/START semantics audit and SDK tests pending.

## First local checks after offset/flow edits
- `test-manga-book-directory-chrome`: first failure was missing newly real `mangaCurrentFooter` Builder from the scoped SDK member extraction; no production syntax conclusion. Add its production member.
- `test-manga-directory-grid-sdk`: first failure expected old raw137 offset; actual normalized142 when startOffset5. Update precise asserted origin and add initial-zero/bounce controls; do not drop scroll callback assertions.
- Official ListPattern source (`CalculateCurrentOffset`, first materialized index0) returns `-startPos`; ListLayoutAlgorithm `HandleJumpStart` positions at `contentStartOffset`. Natural fallback shares the negative offset origin and BookPage alone normalizes it by actual top content offset; no novel/global List change.

- Follow-up strict Grid geometry fixture correctly observed official Grid.create takes two arguments (same Scroller, irregular layout options); initial assertion incorrectly expected one. Fix test to compare argument0 identity without discarding its layout-options argument.
- Far-page position scoped fixture lacked newly real startOffset helper/defaults; callback silently caught its missing method. Added actual helper plus true0 content geometry. Font-readiness scoped MangaSurface fallback similarly required newly owned Surface outer-identity and finite Quick-height methods; included those actual methods and published field defaults instead of stubbing them.

BookPage dependent regression: `test-book-directory-page` first failed scoped SDK missing new mangaCurrentFooter Builder; `test-manga-directory-shared-hierarchy` first failed missing real scrollMangaCurrent. Both now select real helper chain/imports and assert official header-aware START extra183 rather than retired CENTER; both PASS with novel/rules/hierarchy/canonical assertions intact.

`test-manga-metadata-ui` first failed obsolete literal checks expecting Grid main-axis padding to own header/footer clearance. Updated exact inherited API/helper source assertions plus its existing actual SDK Grid/List and Surface→empty GridItem assertions to require verticalpadding0/contentStart37 or182/contentEnd53. Kept metadata, canonical/fold, empty callback and negative checks.

## Local repair frozen
Production and relevant SDK regressions PASS; exact file/test hashes in `manga-directory-vp49-vp50-repair-result.json`. API/setter/callback evidence does not close physical renderer/native acceptance. Root owns global exact capture and later manifest-bound HAP/native engine confirmation.

# VP50: parent width class must not be replaced by inner-content width

Detected before repair: `ReaderDirectoryNavigationList.mangaGridNarrow` ORs an explicit `mangaCatalogNarrow=false` with native Grid area width<=340. A phone app365.7 has Quick body329.7, so the already explicit wide app class is replaced with narrow and numeric layout falls to3 instead of demo4. Full Grid includes outer horizontal insets in its measured width and can remain4. Fallback prepareLayout has the same OR and therefore the same loss of explicit false. This is a source-side condition, not a new inference from native screenshot output or book source failure.

Planned minimum adaptation: make the existing narrow prop optional (undefined by default); an explicit parent true or false is authoritative. Unspecified generic caller preserves prior measured-width fallback. Real available contentWidth still goes to shared `mangaDirectoryColumns` and can independently reduce columns for font/label/download budgets. BookPage publishes true/false from actual whole page width (actual measured area, otherwise current WindowCoordinator width). MangaReadingSurface is owned by the other agent, who updates its phone parent width input; do not edit it here.

Evidence boundaries: actual SDK producer/prop/retained-update tests prove class and shared-layout inputs plus canonical/scroller preservation. Native pixel reproduction and visual acceptance remain Root's separate artifact/engine evidence.

First targeted follow-up: fallback optional-Prop/source OR negative PASS. New Grid width-class probe initially reused a process-global resident page evicted by the earlier twelve-page-LRU test, correctly refusing an extra fetch; replace the test IO fixture with a fresh bounded production DataSource/view page rather than weakening the no-fetch assertion. Generic older probe defaults now supply actual `undefined`, preserving measured-width behavior while dedicated cases explicitly deliver false/true.

## Local repair frozen
Production and relevant SDK regressions PASS; exact file/test hashes in `manga-directory-vp49-vp50-repair-result.json`. API/setter/callback evidence does not close physical renderer/native acceptance. Root owns global exact capture and later manifest-bound HAP/native engine confirmation.

最终本批源码与本地证明：VP44–50均已有准确scope收据；最新Visual definition c4a5f2dda1598d4651e03e3af95acd8ba107ce769733bb4d3880e5ffde959be4，224个数值/16绘制角色未变，补充了短窗滚动策略。回归不替代新签名产物和原生画面。


## VP51 原生命名行自然高度

新候选 a7449d5d/run20261007T081409Z 保数据安装后，Quick numeric 四列44/8、330vp列表/current06页5/24，以及拆分三列已实测。继续滚入命名章节“✿·\n105（下)”时，真实 ListItem/Column/Body Row均1155px=330vp，Title Flex仅154px=44vp，显示大空白。首失证据 VP51-native-named-stretch-first-failure.json、原始PNG和布局均已保留；quick-after256文件名不证明rank已过256，不作分页归因。

代码审计定位共享 MangaDirectoryEntryRow.fullWidthEntryBody root layoutWeight1 在竖轴Column内撑满。单表达式修为仅 readableParent+branchControlsEnabled 水平sibling保留1，其余为0自然高度；内部标题Column、数字格横向权重保持。旧源实际SDK红测复现1≠0；新源9类状态×日夜×1/3.2和4负控，以及fallback/demo parity/font/download/metadata五项回归通过。源码f3427d889b8309cf7a5863451ebf6779bf6171de58215a9ced4ef6d7ce4f91a7已冻结。修复同时覆盖共用该组件的Full/detail natural fallback；新的HAP和原生行高/末端/Full仍须单独验证。
