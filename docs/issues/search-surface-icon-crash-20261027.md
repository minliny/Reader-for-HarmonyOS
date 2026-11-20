# 搜索入口图标与点击退出（2026-10-27）

> 当前统一方案见文末“全量修改方案（用户最新要求汇总）”。此前各节保留定位和讨论过程；发生冲突时以统一方案及其中明确标记的要求/建议/待定边界为准。

用户在真机安装 `20261027T044135Z-3b297fdc-be2949b8` 后反馈搜索图标异常、点击直接闪退。该候选此前 install/launch PASS，尚无搜索交互验收；不得将安装成功视为此问题通过。

## 代码侧初查

- 图标已定位：原 AppTopBar 的 bookshelf_search.svg 圆形放大镜被 ReaderLibrarySearchSurface.morphPath 的手写双 cubic 路径替代；起始端点构成扁形，且未保留原圆端点。需要恢复原资源几何并修正单时间轴的端点。
- 闪退已审计 Index.openSearch、librarySearchSurface/results Builder、SearchPage aboutToAppear/bindSurface/publishSurface、ReaderLibrarySearchModel 及 Surface 的 Watch/帧驱动。源码尚不足以判断此次实际异常是 ArkUI 状态更新、构建树绑定或设备 API 异常，现有安装回执没有异常栈。
- 最小设备取证：在已授权本机真机/同 server 租约下，限时读取现有 JSERROR/应用崩溃日志；不先重现点击、不重装、不清日志、不清数据。取得异常栈即停止取证并回到源码修复。普通 HDC 操作最多 30 秒，本次采样 15 秒。

## 验证范围

先定位真实栈，再按根因选择生产方法回归与 ArkTS 编译；不运行全量。图标端点单独核验。修复后的签名候选与保数据安装、实际搜索操作分别记录。

现有 Reader 过滤日志未提供异常栈。一次 hilog 调用误将 `-x` 与 `-z` 合用，设备明确返回参数冲突；已纠正为非阻塞 `-x`。Error/Fatal 现有缓冲未找到 Reader 崩溃。剩余具体问题为“点击打开搜索时哪个运行时调用退出”；允许一次原候选启动、读取布局、点击搜索和读取对应日志，最多 2 分钟；一旦异常出现停止交互，不搜索网络、不改书架数据。

## 后续定位与用户约束

- 用户在针对约一分钟触控复现的提问中选择“先只修代码，暂不操作手机”。当时已停止 UI probe 并释放租约，没有发出点击搜索。agent 随后把该临时操作限制扩展解释为修复后也不安装，并错误归因为用户要求；用户后续明确纠正没有要求不安装。原安装授权继续适用，触控复验仍暂缓。
- 图标的另一确定缺陷：本地 SDK `Path.commands` 规定坐标单位为 px，旧代码按 24vp 直接给出数字导致高密度屏缩小。修复用 UIContext.vp2px 转换，恢复原 SVG 控制点、圆端点、线宽与主题角色。
- 确定的点击路径异常：现有实际 CompileArkTS 产物 `ReaderLibrarySearchSurface.ts` 中 ReaderButton.leading 保留 `SearchSpinner({...})` 普通函数调用；SearchSpinner 是 ViewPU 组件类，ReaderButton 在输入分支首次挂载就会调用该 slot。改为具名 `@Builder searchActivityIndicator`，由 ArkUI 编译器生成组件实例化。此为代码侧可重现异常，尚无设备退出栈对照。
- 搜索内容的 `results` 普通回调内联 if 同样未变成 ArkUI If 节点，无法可靠响应 shelf→search；改具名 Builder。持续挂载期间的 identity/navigation/mounting 参数闭包同步也纳入实际生成更新闭包回归。
- 选定本地检查：图标端点与密度1/3生产适配；SDK lowering 的 retained-route/state 回归；实际搜索按钮 leading 初次挂载及旧内联组件调用负控；同类历史失败操作 slot；最后仅 `default@CompileArkTS` 核验 ArkTS 接入。各入口无嵌套全量套件、HDC、签装，保护本次确切图标/构建树/组件实例化风险。

## 点击搜索异常的本地编译级复现

实际 `default@CompileArkTS` 输出保留了 `ReaderButton.leading` 内的普通 `SearchSpinner({...})` 调用。`SearchSpinner` 运行时是 `ViewPU` 子类，不能作为函数调用；该 slot 在搜索输入分支第一次创建按钮时执行，即使 spinner 当前不可见也会执行。

显式最小验证 `node tools/test-library-search-activity-builder.mjs --case activity-slot` PASS：运行实际 SDK 编译的 Surface.bar → ReaderButton.build → leading → SearchSpinner 类和实际 V1 property/proxy，旧内联调用负控在 searchMounted=true 时确定抛 `TypeError: Class constructor ... cannot be invoked without 'new'`，searchMounted=false 时不触发；当前具名 Builder 创建组件及 LoadingProgress 成功。无嵌套测试、Hvigor、HDC 或设备操作；原生绘制/布局和本次用户手机异常栈仍不是本地探针覆盖的证据。

## 集成编译结果

`node scripts/deveco-build.mjs --mode module -p module=entry@default -p product=default -p buildMode=debug default@CompileArkTS --incremental --daemon` PASS，Hvigor 报告 8.363 秒，未执行 HAP 签装。实际新编译产物的 searchActivityIndicator 中已生成 `new SearchSpinner` 与 `ViewPU.create`，ReaderButton.leading 只调用具名 Builder；历史失败操作同样生成 `new ReaderButton`。日志保留 `.reader-artifacts/search-surface-crash-20261027/compile-arkts.log`。

Index 两项实际SDK lowering回归 retained-route、retained-inputs及原回调身份回归PASS。图标原SVG控制点/线宽/主题角色、density1/3生产适配PASS。旧inline指示器负控确定TypeError，修复后实际Button/Spinner/LoadingProgress挂载PASS。手机仍保留上一安装包；本次没有重新打包、安装或点击搜索，真机复验与视觉验收保持OPEN。
- 同类历史失败slot回归 `test-library-search-history-builder.mjs --case failure-action-slot` PASS：loadFailed/clearFailed 的实际SDK Builder→PageState→操作slot路径均创建正确重试按钮，旧inline负控均抛class constructor without new。该探针的输入状态显式注入，不替代上面的完整CompileArkTS类型检查或真机结果。

## 用户澄清后的修复版交付

用户指出没有要求“不安装”；此前“先只修代码，暂不操作手机”来自触控复现提问，不能归因为取消原安装任务。本轮继续原授权的保数据安装，触控复验暂缓。

- 新签名候选 `20261027T111632Z-3b297fdc-95ea00db` 构建与包内验证 PASS；contracts none，已有准确回归复用，不重跑全量。Harmony `3b297fdc` / Core `80d614e9` 均 dirty；manifest 保存实际输入与状态。
- signed SHA-256 `76f1296efa2e2217f1d6eaafd0610d5eb52c7b365725907f8b8beefe68464e82`，指定 `minliny_HarmonyOS` 证书、debug Profile 验证 PASS。新增图标几何与三个修改文件逐文件确认纳入该 source snapshot。
- 通过本机 `127.0.0.1:8710`、清除大小写代理环境变量，精确真机目标 Connected；physical inspect PASS、签名身份匹配。
- install PASS、launch PASS、dataPolicy preserve。回执 `.reader-artifacts/hap/20261027T111632Z-3b297fdc-95ea00db/deploy-physical-2a10c2b26b06-20261027T111744Z.json`。未点击搜索或进行其他触控；featureInteraction、视觉与用户验收仍 OPEN。

## 历史下拉栏静态问题盘点（用户要求先弄清楚、暂不修复）

用户看到外轮廓不完整/区分度不足、下拉栏与继续阅读区域边界混合/遮挡/尺寸不合适、历史词按钮和字号偏大及后续行裁切。当前只读审计；不把现象直接等同某个固定高度根因。已审 header外框/Scroll/隐藏测量、HistoryPanel Flex及按钮spec；源码可见边框已绘制、内部Flex存在73vp上限，但不能回答实际像素轮廓与书架的视觉关系。

用户明确要求“一点点来”“看真实截图”。最小设备取证仅为当前画面的一张截图，核本机server/准确target及稳定系统状态，不先点击搜索、不重现、不构建或安装；若当前画面不处于问题态则停止并请用户停在该画面。此张截图首先回答外轮廓与继续阅读的视觉边界，不据其推断全部交互原因。

静态截图取证：首次画面是其他应用，不用于Reader结论；用户随后主动停在Reader问题态，2026-10-27T14:26:14Z读取截图 `.reader-artifacts/history-static-audit-20261027/reader-control-history-expanded.png`，SHA256 `e2ff0c8489ad8fdc71a58e5b97c51f1c25daef17803b6015756ab4b1f20f155c`。只截图/接收文件，没有点击、重装或清数据，租约已释放。`-top.png`仅截取原图上1000px，不重绘。

按用户要求先只核第一处可见现象：历史区底部的白/灰直线横贯屏幕，与更下方圆角轮廓不是同一下边界，第三排按钮在直线处被截断。底色边界、圆角轮廓和内容裁剪不重合是截图事实；各线对应哪一个实际节点尚未证明。已装回执run20261027T133047Z-3b297fdc-13ee2e75；当前Surface/HistoryPanel与其source snapshot不相同，不能把当前73vp内部裁切直接归因为该截图。当前没有实施修复。

## 从已安装代码闭合静态根因（继续只读，未修复）

本轮以部署回执绑定的 `20261027T133047Z-3b297fdc-13ee2e75` 为实际候选。signed HAP一次SHA256 `512bf69d6d952dfd74d5e56399f163c0b9a14c843d9bade0424817193ed897aa` 与manifest/部署回执一致。Surface/HistoryPanel当前源码不同，故直接读取包内 `modules.abc` 的官方SDK反汇编；只保留12个选定函数，证据 `.reader-artifacts/history-static-audit-20261027/installed-abc-surface-history.pa.txt`，不执行App或测试。

| 源 → 消费者 → 实际绘制/尺寸owner | 已确认的问题 |
| --- | --- |
| Index.librarySearchResults：route=search即挂载SearchPage → SearchPage.frameStyle：普通初始输入态返回TOK_PAPER → ReaderPageScaffold → ReaderPageFrameModifier绘整页底色 | headerVisible=false仅取消旧header，不取消SearchPage根背景。 |
| Surface结果slot：height=headerBottom+contentHeight()*resultsProgress()，clip=true，普通zIndex=2 → 输入态resultsProgress=0仍留下headerBottom高的整屏宽背景 | scrim zIndex=1、圆角header zIndex=4。整页纸色在遮罩上方，延伸到圆角面板左右边距并以矩形下边结束；截图整屏白/灰直线可由此链解释。以上已装ABC已确认。 |
| Surface.header：panelSurface+spec.borderWidth/panelBorderColor+spec.panelRadius+clip(true) | 边框实际存在；day硬编码#FFD9D4CC（night#FF6C7364）。应把弱色描边与结果层额外背景责任分开，不能只说缺border属性或只加粗描边。 |
| BookshelfPage.continueReadingCard独立100vp Row、radius18 → Index在route=search继续保留Bookshelf | 与历史面板没有高度引用/绑定关系；两个独立矩形发生覆盖。下方弧线的像素owner尚未唯一核验，不用28px差值推算应补高度。 |
| 已装HistoryPanel Flex：maxHeight73，无clip(true) → 隐藏测量副本也是同一组件 → Surface.historyHeight → 外层Scroll.height/Stack.clip(true) | 布局先被限高，词按钮可在内部溢出；外层拿不到完整行的自然高度，溢出后在外部被截断。当前工作树新增的内部clip不是该安装包事实。 |
| TYPE_SEARCH_HISTORY_KEYWORD13fp/19行高 → ReaderButton水平11/垂直6padding、右/下margin7、自然宽度Flex顺序换行 | 密度/换行与73vp上限未建立按实际整行测量的共同合同。第二行半空可能因下一个长词无法容纳而整项换行，不能简单当Flex少渲染；第三行截断则有明确限高/测量链。 |

结论范围：代码责任及已装ABC常量已确认，截图作为边界/裁切表现的辅助对照。未改生产代码、未构建/安装、未继续设备交互；先按用户要求与其逐点核对。

## 下拉栏渲染分析与卡片宽度要求（仍先分析）

用户补充继续阅读卡片需要缩窄。已确认手机搜索外框左右16vp、书架内容左右19vp，卡片当前仅每侧比搜索框多内缩3vp。卡片Row和包含标题的外Column都消费shelfContentWidth；该宽度还服务全List/分区标题/网格和视图投影。后续若实施，应只收窄继续阅读卡片自身背景Row并显式居中，不能为单张卡修改共用书架宽度。当前不擅定新数值，不改生产代码。

下拉栏稳定态渲染链：

1. model.history → HistoryPanel中的Flex按每个完整关键词自然宽度顺序Wrap；按钮配方13fp/19fp、水平11vp/垂直6vp内距、右/下间距7vp。它只限制单个词最大宽度，不会为了填满一行拆词/重排；第二行半空可以由后续长词放不下而整体换到下一行造成。
2. 已装HistoryPanel把词区Flex.maxHeight固定为73vp，无词区内部Scroll；子项仍可能向外溢出。
3. 隐藏测量副本同样使用此限高HistoryPanel，测到受限布局矩形，经historyHeight→displayedHistoryViewport→外Scroll.height→外Stack.clip(true)成为可见高度。完整溢出行没有成为外Scroll的完整内容范围。
4. 原complete demo的.history-terms恰为max-height:73px + overflow:auto。移植时保留73上限，丢了词区自身滚动语义；套在整个面板外的Scroll不是该结构的等价实现。官方SDK text.d.ts确认数字lineHeight默认fp，字体与19fp行高会跟系统字体比例，73vp高度却没有与实际行高/整行数建立适配合同。
5. 因此应将“词按钮密度偏大”“普通顺序换行造成行尾留空”“词区限高/测量/滚动层错置造成第三排裁断”分别处理，不能只缩字号或补固定高度。可视外框与结果整屏背景的重复绘制仍是另一条独立问题。

未继续抓设备，复用已有准确包/反汇编/截图；未测试、未构建签装、未修改生产代码。

## 最新布局要求与四类交互入口审查

用户已否决滚动建议，明确：整个下拉栏先增高，使下沿越过继续阅读卡片底边并留清楚间隔；固定排版，只展示按面板可用高度/按钮大小动态算出的最新N条；每条支持删除，删除交互模式后续规划。继续阅读卡片独立缩窄。等宽网格是agent建议，尚不冒充已定的具体列数/尺寸。当前仍处问题定位与方案讨论，未修改生产代码。

交互结论基于已装run133047 ABC和同字节公共组件，未继续操作设备：

- 返回：40×40vp、无扩展responseRegion；一按mode先变idle，图标/label/action立即切为搜索，route要等390ms回程结束才回bookshelf。回程期间可见“搜索”与onOpen的bookshelf准入不同步。业务最终返回未发现失败证据。
- 输入：只有TextInput本体有原生聚焦，外胶囊/左图标/内留白未接点击聚焦。Field会随系统字号增高，lane Row和clip Stack却固定36vp，大字时父子高度冲突。输入X出现时条件创建20×26vp按钮，占用原文本宽；无扩大触控区，也未主动恢复TextInput焦点。IME清空后的键盘行为尚未真机验证。
- 搜索：已装仍使用ReaderButton，具有enabled与action守卫，不能归因当前DIFF源码手写Stack缺enabled。实际宽度缺陷是spec leadingSlot=false、fixedWidth=0、horizontalPadding=0，宽度只按文字intrinsic；Surface却按58+5预留槽。canSubmit不检查keyword，空串时按钮仍可用，最终submitSearch静默return。扫源后的“停止”还受inputInteractive结果揭示门禁影响，出现与可点时间不同步。
- 历史清空：已装Row高22vp，loading时opacity0但仍保留focusable/hitTest默认，onClick仅用loading guard拒绝。Index.clearSearchHistory会nextNavigationGeneration，触发fieldIdentity变化/输入框重挂；Orchestrator.clearHistory还清run/结果projection/停止sweep再删history，超过单独删除历史词的作用范围。
- 生命周期缺口：已装textAction/submitAction执行时读取当前model.currentOwner，而不是捕获字段原owner；Field的onChange/clear/submit未检查mounted。旧字段迟到事件可借新owner通过模型准入。历史动作则捕获owner，有旧owner拒绝。代码缺口已确认，未将其报为已发生的真机症状。

补证文件：installed-search-lane-heights.pa.txt、installed-input-actions.pa.txt，以及本目录共享installed-modules.pa（官方SDK只读反汇编）。未发现maxLength截断长词或手动重置原生选择区的代码，不将拼音组合/光标问题无证归因。

## Demo依据补核与此前方案分类纠正

用户询问交互评估和先前方案是否参考demo。本轮只读逐项核对恢复的原第三版HTML，不把代码可用性建议当作原demo的要求。

| 项目 | 原demo事实 | 已装应用/结论分类 |
| --- | --- | --- |
| 搜索按钮宽度 | .submit-button明确width58px | 已装ReaderButton丢掉action width，仅文字intrinsic；确定偏离。 |
| 空输入 | updateInput: disabled=!trim && !loading | 已装canSubmit不核keyword，空输入仍可用；确定偏离。 |
| 输入X | 清文字、updateInput、input.focus(preventScroll) | 已装只dispatch文字和caret reveal；缺明确恢复焦点的合同，最终原生键盘行为未证。 |
| 历史清空 | 只改historyTerms并renderHistory/调整header，不清results | 已装增加navigationGeneration并清run/results/sweep；确定业务副作用偏离。 |
| 返回完成边界 | goBack的390ms结束后才data-search=false、label搜索、state=shelf | 已装一开始mode=idle，控件先变搜索、route尚未bookshelf；确定偏离。 |
| 返回/X尺寸 | 原本40×40 / 20×26px | 先前指出的小命中区是可用性改进建议，不能称应用偏离demo。 |
| 整胶囊点击 | demo的.search-field同样没有整个胶囊聚焦handler | 全胶囊聚焦是额外建议；并非丢失demo行为。 |
| 搜索行36高 | demo原本固定36px | native字号fp增长而祖先36vp固定属于平台适配缺口。 |
| 提交期间停止 | demo先显示停止，但submitting态submit直接return | 700ms揭示期间停止暂无动作是原demo已有局限，不是应用单独引入的差异。 |

此前方案依据：恢复词区内部滚动对应原demo73px/overflow:auto；“默认两整行”“等宽网格”均是agent提出的新方案，不来自已确认demo。用户最新明确要求面板增高、固定排版、最新动态N、后续规划单条删除，已取代滚动建议。继续阅读独立缩窄也是本轮用户新增要求。原demo图标为两独立SVG交接，Path几何插值属先前实现重解释；原demo返回为独立390ms动作，不能用全程倒放导致历史重开/两段返回来冒充对齐。

后续采用demo的结构和动作依据时，需要逐条说明原参考、平台适配与用户新要求；原demo自身返回放大镜透明度遗漏等缺陷仍保留为历史问题，不盲目复制。本轮未修改生产代码、未运行测试或设备操作。

## 当前问题定位与修复方案（重新整理，以本节为准）

依据为已装run133047的HAP/ABC、同字节公共源及已有实屏；原第三版demo用于核对已有动作和移植差异，用户最新静态布局要求优先。当前只给方案，不改生产代码。

### 定位与对应修复

1. 外轮廓：输入态SearchPage整屏TOK_PAPER仍在，结果slot进度0仍有headerBottom高且z2在scrim z1上；圆角header另在z4绘制。修复为SearchPage根透明、结果底色只在结果内容范围；Surface唯一持有搜索+历史完整底色/描边/圆角/裁剪，避免全宽白带。边框角色和对比度在单一外框成立后再校准。
2. 面板与继续阅读关系：两者当前独立几何，无面板下沿越过卡片底边约束；卡片宽度与整书架共用，仅比搜索框每侧内缩3vp。按新要求，Surface以同坐标系卡片实测可见矩形、窗口/安全区/IME可用空间解算更高面板；空/少记录保持外框。继续阅读只缩内部背景Row并居中，外Column/标题/List/网格宽保持原合同。不能借缩card宽掩盖panel高度问题。
3. 历史渲染：原demo词区73px+overflow:auto，被移植为Flex maxHeight73vp且外面再套Scroll；隐藏副本测的是限高布局，后续整行溢出被祖先clip。按新要求移除这套限高Flex/外Scroll/独立测宽回路；Surface统一提供内容宽高、按钮尺寸、间距和可见条目。固定排版、无滚动、只摆完整按钮；容量不足不绘半行。
4. 动态容量：先固定由面板几何决定的内容区，再由排版模式计算最新前缀N，不从历史条数反向撑面板。推荐等宽网格（仍是提案），按可用宽/最小可读按钮宽解列数，实际字体和padding解行高，再解完整行数；该模式下N=行数×列数。完整历史保留，界面只投影最新N条，长词省略显示但动作绑定完整词，删除后补下一条。不固定两行或固定N。间距由布局容器单独持有。
5. 搜索栏：恢复demo搜索按钮明确action width并与父槽共用spec；可提交=sweeping或非空关键词且有效scope。输入框及祖先共用随字号解析的高度，消除固定36与fp增高冲突。输入X清草稿后明确恢复当前字段焦点，不动查询事实；返回保持closing表现至结束再转书架搜索入口。显示状态、enabled/hitTest/无障碍状态同步。40×40/20×26等原demo尺寸、全胶囊聚焦与停止即时可用，单列为平台/可用性增强，不冒充demo偏离。
6. 历史操作：复用现有historyRevision/historyClearTask解耦历史与query，不再通过nextNavigationGeneration重挂输入或清run/results/sweep来刷新历史。历史读写投影需能在保留results会话时独立更新；清空仅变历史，保持关键词/结果/焦点。协议目前仅list/add/clear，单条删除需补Core/Host命令和真实持久化能力；删除UI入口后续规划。
7. 回调：字段事件绑定原字段identity/owner并检查mounted/当前呈现，旧事件不能读取新currentOwner借壳通过。保留现有route、navigation、mount、runtime、host和历史操作revision守卫，不为简化重构而撤掉。

### 执行与验证范围建议

先统一绘制与几何 → 固定容量历史布局和卡片宽度 → 四类动作与历史数据生命周期 → 对照demo检查动效。先看静态完整外框/高低关系/整行按钮，再查输入、搜索、返回、清空与删除数据效果。只选受影响的具体方法/编译项，复用准确不变证据，不跑全量。构建、签装、实屏和交互各自记录；本轮尚未执行。

## 搜索结果页截图与分析（用户请求）

用户要求再取一张真机搜索结果页截图。已有代码审查覆盖Surface结果层与SearchPage背景/页几何，尚无当前结果态的准确画面；本次唯一问题是结果态有哪些可见异常，再对应布局/状态代码定位。最小取证为当前屏幕一张截图，不输入、不点击、不重现、不安装；若画面不是结果态，先停止并请用户停好。只读系统就绪核验后通过同一本机server租约采集；截图不能单独代替源码根因。

## 搜索结果页实屏分析结论

取证2026-10-27T15:36:11Z，本机直连、统一租约，只screenCap/recv，未点击/输入/停止搜索。原图 `.reader-artifacts/history-static-audit-20261027/reader-control-search-results.png`，1280×2832，SHA256 `1a4e552ef887cc370933c5fd7f4d92a8f24c60a4acb6d94b11886970d29f6b0b`。画面为夜间搜索进行中：关键词“重生后我只做正确选择”，88/113、找到290本、40源失败。原图不能视为完成态。

已知最新部署仍run133047；本轮核SearchPage、Projection、Orchestrator、Gateway、FilterPanel、Geometry、Typography等与其snapshot MATCH。无新构建/测试/安装。

- 卡片密度：手机coverWidth88vp、height约120vp，原demo结果cover67×100.5px；文字Column minHeight绑定coverHeight，行上下padding各14vp，因此短简介也被封面撑高。截图首屏约4条。应用标题15fp、demo17px，不能把所有“大”泛化为标题字号比demo大；简介应用12fp/18fp vs demo11px/1.8。
- 横向空间：List外侧16vp，卡片内再左右各12vp，封面起点约28vp；比demo结果区额外内收，大封面再压缩文字列。两者各有代码owner，不直接称重复padding的程序错误，属于版式密度差异。
- 状态层级：Surface固定header画进度/筛选，List首项画结果数/搜索中/失败信息，形成两块较厚且分散的信息区。原demo结果数量、进度、类别筛选在结果内容带，shared bar提交后收回单行。
- 筛选：demo常驻全部/小说/漫画并另展来源；应用全放进header折叠入口，改变可见性和操作成本。单截图不能证明filter失效。
- 已定位的窄“停止”按钮仍在：已装ReaderButton缺58vp实际宽度，而不是截图阶段临时变形。
- 相关性：SearchResultRelevance只评分0–5，没有对弱相关结果做硬剔除；Projection仅对新批次排序，保留先前显示顺序，后到精确结果不能自动升首位。因此首屏不同书名符合当前策略，不能无原始回包就断言传错query/旧结果串入/目标书缺失。找到290=visibleGroups.length，属于筛选后合并书组数，不是290精确匹配。
- 状态语义：88 completed包含失败40；重试明确在!isSweeping时才可用，当前灰色符合代码。失败具体原因和完成后的状态未取证，不归UI渲染故障。界面未直说需等搜索完成再重试，属于操作状态表达可改进项。
- 发现来源数只是去重sourceId发现数，包含带失败事实候选，不等于可阅读来源数；截图“已发现5个书源”文案未宣称可用。
- 不报无证问题：缺章节行需要原数据，代码只在非空时绘；底部没有额外预留隐藏导航68vp，仅max(20,safeBottom)。没有证据支持整页缓存串页。

本轮只新增分析记录，未修复。

## 结果页与Demo的视觉对照补核

用户追问是否实际对照demo。本轮读取已打开原demo的现有结果态（关键词诡秘之主、日间样例、搜索完成），未重写数据或改变原HTML。保存DOM实测几何 `demo-results-geometry.json` 与 `demo-results-viewport.png`；从截图裁取phone并将双方画面宽度统一390px，生成 `results-demo-device-comparison.png`（左demo、右既有夜间真机搜索中截图）。只统一画面宽度，不声称同主题、字号环境、关键词、数据或搜索阶段。

demo DOM实测：phone约390×844、sharedBar约358×52、submit约58×36、结果封面约67×100.5、类别筛选实际可见。已确认差异是结果态顶栏单行vs应用双行进度/筛选、类别常驻vs折叠、真实提交按钮丢固定宽度；卡片左右内距/封面大小为尺寸差异，不能未经同条件把88vp/67px直接算大31%并判错。应用标题15fp、demo17px同样不可笼统评定应用字号更大。

demo没有40个真实书源失败的同等状态，失败提示多出的高度不全属于实现偏差；生产源的模糊回包/增量排序也不能由样例includes过滤证明算法错误或漏书。两图主题不同，配色本轮不作优劣判断。此前结果页“问题”清单收紧为已确认移植差异、可用性评估项和未证数据问题，不能混称全部为UI程序bug。

本轮只读浏览器现有结果态和DOM并保存对照图，无新真机采样、测试套件、构建或安装。

## 结果页具体收口方案（2026-10-27，待实施）

用户要求具体分析与方案。本节基于上面的准确包、实屏和原demo对照，仍不修改生产代码。按用户随后明确的筛选要求，推荐结果结构为：固定单行搜索栏 → 同一个可滚动结果头（数量/状态、处理进度、单一筛选图标、失败摘要）→ 结果书目；输入态历史面板沿用用户此前单独提出的新要求。此前“常驻全部/小说/漫画”的建议已被用户本轮选择替代。

1. **固定栏只拥有查询控件。** 已装Surface的进度/筛选第二行移入SearchPage现有唯一首项ListItem；结果栏保留返回、输入、清空、搜索/停止。恢复原demo按钮58宽的明确槽位合同，按钮和父槽消费同一个随字级解析的规格，不能仅改视觉或以有无spinner决定是否给宽。52/36仅是demo常规字级基准，原生大字下由共同规格增高。
2. **结果信息形成一个层级。** 首行“搜索结果 · N”与搜索中/完成/已停止，下一行显示“已处理88/113个书源”，细进度条辅助；筛选收起时只保留一个图标，不常驻类别按钮或筛选条件文字。点击图标展开下拉选项，分为“内容：全部/小说/漫画”和“来源：全部/本地/在线”两组。复用现有每组单选、组间组合的条件模型；默认两组为全部，选择后即时筛选当前会话，再次点击图标或点击面板外收起。下拉面板锚定图标，不撑高固定搜索栏；条件生效时图标高亮或带状态点，无障碍文本读出具体条件。失败40属于已处理88的一部分，与失败/跳过任务事实一起在同一头部紧凑展示，不以成功88误述。搜索中明确重试需等本轮结束；完成/停止后仍按原operation.canRetry决定，不自行放开重试。真实任务进度/逐项结果按消息框架登记的任务展示边界接入，不另造Toast或错误外框。
3. **卡片统一横向几何。** List外16、卡片内12、封面88分别来自不同位置，叠加后缩窄文字；Row使用TOK_SPACE_SM，已核其真实值为12。同390逻辑宽预算下，应用文字约234（390−32−24−88−12），demo约271（390−40−67−12），不代表真机px测量。统一结果内容边距与封面/图文间距的resolver；提案以demo手机390基准的左右20、封面67×100.5、图文距12校准，运行时按实际内容宽/布局模式/系统字级解算，不能跨窗口硬写67。去掉卡片第二层横向内收。封面和文字自然取较大高度，卡片不设固定高；只删文字minHeight并不会缩小仍被封面撑起的Row，必须连封面规格一起处理。大字允许卡高增加，不以缩小系统字号换取首屏条数。
4. **信息密度有明确顺序。** 提案为书名最多两行、作者/类型一行、有数据时的最新章节一行、简介最多两行、底部来源数及来源名/在架状态；各行缺数据时不占空白。来源数是发现数，不改成可读数。减少多枚同权重绿色底标签对书名的竞争，长内容不越界，真实来源与合并数不删。标题15fp并非已证明过大，先修正文宽分配，再按共同字级和行高评估，不能整体再缩一轮字体。
5. **相关性作为独立行为调整。** 当前评分0–5只给新增批次排序，后到精确结果不能前移，确实不满足始终优先呈现精确命中的目标；截图尚不能证明目标书已经返回。推荐复用现有评分与发现顺序做全局稳定排序：列表在顶部且无触控/滚动时允许发布新的排序；用户离开顶部或按住卡片时保留显示次序，延后至返回顶部并空闲时合入。完成/停止不强制在用户阅读途中重排。不移植demo样例includes硬过滤，不把弱相关返回直接删除，不改网络查询或分组身份。该项单独记录为推荐产品策略，不能混称已确认的绘制bug。
6. **保护发布和位置。** 全部结果头仍是原首项ListItem，保持resultNativeIndex(bookIndex)=bookIndex+1。固定栏的实际测量高度只进入一次List起始偏移；结果头本身占列表高度，不再额外计入外部header。筛选展开、失败说明换行、字级变化走现有交互冻结及锚点补偿。后台更新保持当前书目key及屏内位置，用户主动改筛选才回到筛选结果顶部。queryRevision/operationGeneration/pageEpoch、按下书目身份、重试owner及离页清理保持原归属。

实施建议顺序：先归并结果头和几何owner → 恢复搜索按钮槽位、单一筛选图标与两组下拉选项 → 收紧卡片版式 → 独立实现相关性发布策略。选择与这些改动直接相关的本地布局/状态/锚点方法检查及ArkTS编译；不运行全量，不借此调整网络或Core协议。验收覆盖默认/大字、长书名/缺简介/多来源、搜索中/完成/停止/失败、筛选展开与列表中途更新；准确未变证据复用，后续构建签装与真机行为分别记账。本轮仅记录分析方案，未执行上述实现或验证。

## 全量修改方案（用户最新要求汇总）

### 1. 范围、依据与状态

覆盖书架→展开搜索/历史→输入与提交→结果/筛选→编辑或返回书架的完整搜索动线，以及这条动线直接涉及的继续阅读卡片、历史持久化和公共几何/动效接入。开书/阅读动效保留原独立记录；本次整理不新增一轮开书重构，也不声称存在一个搜索→详情→阅读的全流程demo。

依据为恢复的原第三版 `docs/ui-design/demos/bookshelf-search-complete-demo-20261025.html`、本记录绑定的已装HAP/ABC、历史展开与结果页实屏，以及对应生产源。用户后续明确的新要求优先于原demo。Surface/HistoryPanel的工作树与已装包不同，已装根因引用ABC；实施前需比较当时工作树，不把旧审计直接当作最新源码状态。

此节汇总待实施方案。原图标密度、具名Builder及持续挂载绑定的既有修复/检查/部署仍保留原记录，不重新宣称本轮已修复或已完成设备验收。

### 2. 共用结构与唯一尺寸责任

| 对象 | 唯一责任 | 消费者与边界 |
| --- | --- | --- |
| 搜索/历史外框 | Surface解析的同一GeometrySpec，统一底色、描边、圆角、裁剪及可见边界 | 搜索行、历史标题与按钮区都在此框内；不再由整页背景补外观 |
| 搜索行控件 | 共享控件规格解析实际高度、动作槽宽和触控区域 | TextInput、父Row/Stack和按钮消费同一个结果；字级变化不能只长子节点 |
| 继续阅读卡片 | 书架原owner提供真实同坐标系矩形；卡片自身拥有缩窄后的宽度与居中布局 | 不修改服务标题、列表、网格的共用shelfContentWidth；不从截图像素差猜卡片底边 |
| 结果页面偏移 | 固定搜索栏实测bottom进入List起始偏移一次 | 结果信息头是列表原首项，自占列表高度；不重复加进外部headerHeight |
| 历史条目投影 | 原历史owner保留完整数据；Surface布局投影算最新N | 渲染不反向写持久化；少记录不决定面板高度 |
| 查询与结果事实 | 现有SearchHost/Orchestrator、SearchViewState及操作owner | 展示组件不另建查询、取消或重试状态机；保留原代次准入 |
| 动效几何与播放 | 复用已有矩形/时间轴/动效规格，每个表面只有一个播放owner | 不新增并行计时器，不从onAreaChange反推逐帧transform位置 |

### 3. 输入态外框与继续阅读卡片

**已确认要求和对应修复：**

- 搜索行与历史区形成一个完整、有区分度的外轮廓。消除输入态SearchPage整屏TOK_PAPER及结果slot在零结果进度时仍覆盖headerBottom高度的矩形背景；Surface统一绘制完整圆角外框。结果底色只在其实际内容范围出现，scrim保持在表面下方。
- 先修正背景/裁剪/边界的责任，再统一明暗主题描边角色和对比度；不靠额外一圈亮框掩盖重复背景。
- 整个下拉栏增高，其下沿完整越过继续阅读卡片底边并留间隔；按同一坐标系的卡片矩形、窗口/安全区/IME空间解算，不补一个任意固定高度。空历史或少记录维持这套外框几何。
- 继续阅读卡片独立缩窄、居中，增加与搜索外框的宽度区分；卡片内容与背景一起适配，书架标题、列表、网格对齐不变。具体缩窄值是待校准参数，不冒充用户已选尺寸。
- 书架保持原滚动位置，不因搜索展开而整体下移或重建。隐藏层、测量副本与关闭中的表面同步管理触控、焦点和无障碍可见性，opacity为0不等于不可交互。

#### 最近阅读卡片专项（界面文案“继续阅读”）

用户追问最近阅读卡片。当前书架顶部对应的是BookshelfPage.continueReadingCard，并未发现另一套名为“最近阅读”的书架卡片；此处按这张最近阅读卡单独列项。源码Row与外Column同用shelfContentWidth，Row固定100高，封面48×72、文字列固定72高、阅读外观54×40；缩窄不能只改外框而放任内部继续占旧宽。

1. **卡片自身缩窄并居中。** 为卡片内容Row解析独立宽度，外层分区与“继续阅读”标题仍保持书架公共对齐；缩窄量按真实内容宽/布局模式校准，不改全书架宽度。背景、边框与实际可点击矩形同步缩窄。
2. **内部同时重排。** 封面、图文间距、文字列和阅读入口共用卡片规格；正文分配剩余宽度，书名/作者/阅读位置有明确省略规则，阅读入口保留可读文字和触控空间。不得仅缩整卡scale，也不以压小所有字体塞回原排版。
3. **高度适配内容和系统字级。** 审查固定100高Row及72高文字列在缩窄/大字时的容纳关系，改为共同规格与内容最小高度解算；常规字级保持紧凑，大字需要时增高。此为代码约束风险及推荐适配，不冒充已有大字实屏缺陷。
4. **与历史面板联动。** 以独立整卡测量身份输出缩窄后、同一宿主坐标系的真实外框矩形；历史面板下沿完整越过它并留间隔，不能只盖住卡片上半部。卡片因字级/内容变化增高时，面板几何一并重新解算，使用当前身份的矩形回执。整卡外框不是开书使用的封面矩形，两者不能混用。
5. **阅读动作与封面起点保留。** 整卡及阅读入口复用原选书身份/动作准入，保持真实阅读位置，不新增重复点击路径。封面继续使用原bookCoverMotionId和真实窗口测量，跟随布局后的封面位置；不另补横向偏移。开书与关闭回程均消费缩窄后真实封面位置，书架滚动锚点与返回位置保持原合同。

极小窗口/大字/IME若导致“越过卡片”与完整可见空间无法同时成立，需要明确响应式降级方案。不能静默退回半行裁切、面板落在卡片中间或历史滚动；该极端态处理仍待规划。

### 4. 历史区固定排版与动态N

**已确认：**历史区不滚动、只显示最新动态N条、按钮完整呈现，支持单条删除能力。取消旧73vp词区上限、外套Scroll与受限隐藏测量形成的裁切链。

**用户最新纠正：按钮宽随书名自然变化；此前等宽网格方案作废。** 面板区域和排版规则固定，逐项以真实字体测量结果加内距/边框解宽，按最近顺序整项换行。推荐单行等高，普通书名完整显示；单个书名超过整行宽时才占满一行并省略，动作仍使用完整关键词。

`按钮宽=min(词区可用宽, ceil(完整词真实文字宽)+左右内距+左右边框)`。

逐个放入当前行，剩余宽不足则开下一行；下一行完整高度放不下时即停止。N是实际已放入的最新连续前缀长度，不再使用列数×行数，也不跳过新长词来塞旧短词。行尾留白保持自然，不拉伸按钮或两端分散。由同一个测量/布局投影提供每行条目及各项宽度，渲染层不再按固定列切片或layout full。

- 按钮规格采用紧凑的共享字级/行高/内距，先满足可读性和触控区，再算容量；不是只缩字体，也不固定“两行”“三列”或某个N。
- 可用高需扣除搜索行、历史标题/清空操作、分隔与上下内距；尺寸变化时一起重新解算，不让显示区与测量副本各算一套。
- 最新N条按时间顺序取前缀；长词显示省略但点击绑定完整关键词。未显示的记录仍完整保存；删一条后从后续历史补位。
- 记录不足只留下空余位置，不收缩外框；装不下一整行就不画半行。间距由布局容器持有，避免按钮margin与容器gap重复叠加。
- 单条删除需要Core/Host/Gateway真实持久化接口与历史revision更新；当前已审计协议只有list/add/clear。删除入口、长按/编辑模式或按钮形式仍待规划，本轮不擅定。

### 5. 返回、输入、搜索/停止与两类清空

| 元素/动作 | 修改方案 |
| --- | --- |
| 返回箭头 | 关闭过程保持返回图标、语义和动作，结束后才恢复书架搜索入口。input/results按原第三版demo单段回书架，不先重新展开历史再要求第二次返回。关闭期间防重复触发；书架滚动位置保留。 |
| 输入框 | 原生TextInput及其父Row/裁剪Stack共用随系统字级解算的高度，消除子节点增高而父节点固定36的问题。避免为动画把原生输入框宽度逐帧缩到0或反复重挂；外层负责视觉揭示，实际原生可行性需编译/最小行为验证。 |
| 输入X | 仅清当前草稿并明确恢复当前字段焦点/光标；不把它当作清历史、提交空查询或清空已提交结果。若用户从结果态进入编辑，原有edit转态与搜索停止语义另由原业务owner负责，不能借X回调暗中替换查询。 |
| 搜索/停止 | 恢复与父槽同源的明确动作宽度，原demo常规基准58×36；大字适配。无运行操作时，trim空草稿不可提交；运行时展示停止并绑定原操作，不能因草稿为空禁用停止。点击与键盘提交走同一个准入。 |
| 清空历史 | 只修改历史及其投影，保持当前草稿、已提交查询和结果归属；去掉借navigationGeneration重建字段及clearRun/停止扫源/清结果刷新历史的副作用。复用已有historyRevision/historyClearTask。 |
| 历史加载/清空中 | 显示、enabled、hitTest、focusable和无障碍状态保持一致；隐藏清空操作不能留下透明焦点或命中区。历史失败/重试复用公共消息类别和原历史任务身份。 |
| 旧字段事件 | 回调捕获原字段identity/owner并检查mounted与当前呈现，拒绝退役实例的onChange/clear/submit。不得在迟到事件发生时读取新的currentOwner借用新身份。 |

平台可用性增强建议包括：全输入胶囊点击聚焦、扩大返回/X真实触控范围、停止从操作开始即可用。前两项在原demo中也未完整实现，提交揭示期间停止被拦也属于demo既有局限；这些是推荐增强，不能称为全部丢失demo行为。扩大触控区须避免相邻按钮重叠。

历史成功提交、清空、删除或进入编辑后的展示，应由历史revision独立更新；不能仅在initial/sourceRequired等状态发布，否则保留结果会话时仍看见旧历史。进入编辑时刷新最新历史是推荐行为，不借刷新重建查询。

### 6. 结果页层级、进度与失败

- 固定搜索栏收成单行，只保留返回/输入/X/搜索或停止；进度和筛选不再形成固定栏第二行。
- 原唯一List首项集中显示“搜索结果·N”、搜索中/完成/停止、来源处理进度、筛选图标及真实失败/跳过摘要；随后才是书目列表。可滚动结果头与固定搜索栏责任明确。
- 88/113是已处理数，40失败包含在88中；290是当前筛选后的合并书组数，不代表精确匹配数。展示文案必须与这两个口径一致。
- 搜索中保留失败事实，明确何时可重试；完成或停止后仍由原operation.canRetry及query/operation身份决定。不得为贴近无真实失败样例的demo隐藏失败，也不得把灰色重试直接报为失效。
- 无结果、筛选无结果、来源不可用、加载与明确失败复用既有ReaderPageState等类别；有部分结果时保留结果。任务进度与逐项失败继续遵守消息框架登记的专用任务边界，展示不拥有重试/取消事实。

### 7. 筛选：用户确定的单图标与两组下拉

**用户已确定：**正常收起时只保留一个筛选图标；点击后展开下拉面板，提供小说/漫画和本地/在线按钮。替代此前“类别常驻”的建议。

推荐交互细则：

- 两组分别为“内容：全部/小说/漫画”“来源：全部/本地/在线”。组内单选、组间组合，默认均为全部；不用具体书源名动态扩展此面板。
- 点击即时筛当前会话，不立即重发网络搜索；面板保持展开以便组合选择。再次点击图标或面板外部收起，保留条件；生效时图标高亮，选中按钮明确反馈，无障碍文本读出具体条件。
- 面板锚定图标，不撑高固定搜索栏。外部点击只关闭面板，不穿透点击书目；窗口、滚动或宿主变化时关闭或重新定位，旧面板不得跨查询操作新数据。
- 系统返回优先关闭已展开筛选面板，再按搜索返回规则处理，是推荐的分层返回规则。来源选择的空间不足处理不等于历史滚动要求，不能混为一项。
- 当前源码submitSearch先取scopeSourceIds，随后才把界面筛选重置为全部，所以本地/在线还会限制下一次请求，存在隐性耦合。推荐解耦：结果筛选只作用当前结果；新查询按既定默认本地+在线执行并重置结果筛选。同查询详情往返保留筛选。该后续查询策略是本轮提出的明确建议，尚不能记为用户已批准的新业务要求。

### 8. 结果卡片与信息密度

- 统一结果内容内距、封面宽高、图文间距、文字宽度和行间距的几何来源，取消卡片内部额外横向内收。当前同390逻辑宽预算约234正文宽，demo约271；这说明空间分配差异，不是把真机px当vp换算。
- 推荐以demo手机390基准的左右20、封面67×100.5、图文距12校准，再按真实内容宽、宽屏布局和系统字级解析；不跨设备写死67，也不线性放大到整宽平板。
- 封面与文字自然取较大高度，卡片不锁高。仅删除文字minHeight不足以降低仍被封面撑起的整行；封面规格必须一起处理。
- 推荐书名最多两行、作者/类型一行、有数据时最新章节一行、简介最多两行、底部来源数与来源名/在架状态。无数据的行不占空位，保留原真实信息与同书合并语义，弱化多枚同权重标签对标题的竞争。
- 标题15fp并非已证明比demo17px更大。先给正文空间，再校准共同字级/行高；大字允许卡片增高，不以缩字号或裁切换首屏条数。
- “已发现N个书源”仍是发现数，不写成可阅读数。封面失败和迟到元数据保持原卡片身份、展示冻结与点击准入，不能滚动中切换成另一部书。

### 9. 相关性：独立推荐行为

当前代码只对新批次按相关性排序，后到精确匹配不前移。推荐复用既有精确书名→作者→前缀→包含→其他评分，加原发现顺序作稳定次序；列表在顶部且无触控/滚动时允许合入新的全局排序。用户离开顶部或按住卡片时保留次序，返回顶部且空闲后再发布。完成/停止不强制在用户阅读途中重排。

这项是推荐产品策略，不是已确认绘制bug。保留真实模糊回包，不移植demo样例includes硬过滤；不改网络请求、分组身份或自行补一套通用模糊匹配引擎。没有实际回包不能断言目标书已返回、被漏掉或旧查询混入。

### 10. 动效和生命周期收口

- 静态几何和控件行为先收口，再校对打开、提交和返回。书架不位移；搜索与历史属于同一表面；提交先收历史，再揭示结果，结果内容起点不被两个不同测量源反复拉动。
- 返回按原第三版独立关闭动作处理，不能把open+submit整条轴倒放成先结果→历史→书架的两段过程；正常关闭结束前不提前切书架入口表现。
- 原demo图标是两个SVG交接，并非已证明必须用Path几何插值。恢复原图形端点、密度、线宽与角色，不再以手绘近似形状冒充对齐。原demo返回放大镜透明度遗漏等自身缺陷也应修正，而不是照抄。
- 真实IME来自系统inset；不从demo假键盘推算高度。字体、窗口或IME变化不能先把历史测高清零造成可见塌陷。新一轮几何只更新当前身份，过期矩形与帧回执丢弃。
- 减少动效走同一目标态和操作完成边界；不会因跳过动画留下遮罩、焦点或不可点击状态。每帧成本与实际IME行为没有本轮新证据，保持未验证。
- 保留queryRevision、operationGeneration、pageEpoch、runtime/host、mount/navigation及按下书目身份守卫；已修过的具名Builder和持续挂载状态绑定不得在重构时退回普通闭包冻结行为。

### 11. 列表与弹层位置保护

全部结果头仍在原唯一首项ListItem，保持bookIndex+1映射。结果头高度变化与固定栏高度变化分别处理；固定栏只计入起始偏移一次。后台结果、失败说明或卡片元数据更新保留当前书目key和屏内位置；用户主动切筛选才回筛选结果顶部。

浮动筛选下拉不应作为额外ListItem插入，也不把其浮层高度加入结果起始偏移。其窗口/滚动定位、外部点击和返回处理归当前筛选呈现；查询与筛选条件仍归原SearchPage/viewState。历史面板、筛选下拉和结果列表不能各持有一份相互补偿的滚动状态。

### 12. 实施顺序与验收边界

建议顺序：

1. 统一外框/背景/裁剪与几何责任，处理下拉高度和继续阅读卡片自身宽度。
2. 接入固定容量历史布局、紧凑按钮规格、历史独立刷新；补单条删除真实数据能力，交互入口另行规划。
3. 修四类控件、草稿/已提交查询/历史的动作边界、旧字段回调和隐藏命中。
4. 合并结果头，落实单图标两组下拉，统一卡片版式与列表位置保护。
5. 独立评估并实施相关性发布策略及下一次查询范围策略。
6. 对照原demo收口动效，再记录最小必要编译、构建/签装与设备行为证据。

验收清单覆盖：无/少/多历史、长词和大字下完整行；下拉下沿与卡片关系；清空/删除不影响草稿与已提交会话；空输入、X聚焦、搜索/停止、返回与重复操作；筛选两组各含“全部”的3×3状态组合、两组重置及收起/不穿透；搜索中/完成/停止/部分失败；长书名、无简介、多来源与封面失败；列表中途更新、筛选回顶部、详情往返保留条件/位置；打开/提交/返回/减少动效与IME/窗口变化。

上述为验收范围，不授权执行全量套件。真正执行时先列唯一待答问题、准确入口、嵌套范围、必要理由与停止条件，复用不变证据。代码、本地检查、ArkTS编译、签名产物、保数据安装/启动、真机交互、视觉和用户验收逐层记账。后续交付仍走规范HAP pipeline及指定签名，准确本机server/真机target和无代理路径；本轮汇总未发起任何构建或设备操作。

**仍待明确或校准：**自然宽历史按钮规格及超长词呈现、继续阅读缩窄量及外框间隔、单条删除交互、极端可用高度降级；推荐的相关性重排和下一次查询范围策略。它们不改变已经确定的无滚动动态N、完整外框/更高面板、卡片独立缩窄以及单图标两组筛选要求。

## 静态优先实施（2026-10-28）

用户授权全量实施，明确先达成静态页面再考虑动效。当前保留dirty WIP，分工实施继续阅读卡片、历史数据/生命周期、结果/筛选与Surface/历史固定排版；不改动效规格和时间安排。本轮复用了Core已有search-keyword.delete，无新增协议或Core重编。

选定最小检查：历史数据6个准确生产方法case，保护清空不停止活动查询、旧读回、失败恢复、重开及删除串行；结果geometry/query-actions/relevance/filter-popup/header-facts，保护卡片空间、准入、排序发布与SDK popup绑定；卡片实际规格40组宽度/字级组合，保护内缩/换行/自然高度。结果与历史检查的边界/原失败分别保留各自记录。历史索引因既有SDK probe定义变化返回REVIEW_NEEDED，未重拍指纹；审读准确分支后直接执行对应case，本地结果不冒充索引通过。

Root新增 `tools/test-search-history-static.mjs --case capacity,field-owners,history-render`：只调用实际几何/AST选定生产方法及SDK lowering挂载，无嵌套套件、网络、HDC或HAP。capacity回答完整行、卡片覆盖和极短空间是否溢出；field-owners回答退役字段/owner和异步焦点是否被拒绝；history-render回答真实Builder是否只挂载最新N条且没有Scroll。本次不可省略，因为旧限高测量与回调归属均改变。之后仅统一default@CompileArkTS核验原生组件接线和类型；构建与安装的指定签名/准确目标/保数据核验留在对应动作。

极短IME/窗口的静态处理选用：若可用面板底边确实无法越过卡片底边，临时隐藏底层最近阅读卡片的视觉/命中/无障碍，但保留书架布局占位与整卡测量；空间恢复即恢复。标题/历史状态装不下完整内容时不渲染半行。常规空间以实测整卡下沿约束面板，记录数不反向缩面板。

本轮本地结果：历史数据六case PASS；结果五case PASS；卡片40组实际规格组合PASS。Root的capacity、field-owners PASS；history-render先后暴露探针未接入新公共字级依赖、错误导入及缺自定义组件源登记，均修正为实际依赖后只重跑该项PASS。公共动作宽度不再依赖leadingSlot，补选control-frames实际Modifier case，证明phone/wide动作槽和历史行实际高度同规格，PASS；history-render跟随相关方法改名复验PASS。上述均非原生像素证明。

统一CompileArkTS第一轮失败：Orchestrator catch任意类型throw、对象spread，HistoryPanel.enabled与系统属性重名，Surface的PathShape缺值导入。分别修为明确Error/按kind复制、actionsEnabled、官方shape导入。一次复编被短暂构建租约占用拦下；只读检查时该租约已自然释放，未清锁/杀服务。随后default@CompileArkTS PASS，Hvigor 4.769秒；存在既有编译warnings，未声称warning-clean。最后只变更历史反馈测量的尺寸/身份拒绝，随下一次实际HAP编译统一核验，不重复此前无影响case。

静态设备验证的剩余问题：本地方法及SDK lowering不能证明原生布局像素、真实字级下文本裁剪、整卡测量坐标、外框/底色边界和popup遮罩命中。完成上述代码侧定位/最小回归后，拟一次签名iteration候选按指定证书与保数据规则安装，读取目标真实窗口/字级和Reader静态历史/结果画面；仅在本应用内展开搜索、选择已有历史、展开/关闭筛选，不清历史、不改书架/阅读数据，不采动效帧率。不符合Reader前台或系统未就绪则停止无关触控并归因。安装、启动、静态画面与用户验收各自记录。

首个签名候选run20261027T162940Z-3b297fdc-560000c9构建/验签PASS，但交叉审查发现Surface局部坐标与窗口IME可用下沿混用，尚未安装。修正为卡片、IME下沿及结果viewport统一减去Surface真实windowY；列表实际高度同步改为宿主局部高度，防顶部安全区被重复当作可用空间。新增surface-coordinates准确生产方法case（非零40vp宿主偏移、真实窗口/IME端口）PASS，旧坐标算法会错误判定卡片可完整覆盖。仅此修正使前候选源码不再当前，需新iteration候选；其他未变场景复用，不重跑套件。

本机HDC server的精确旧target列为Offline；直接TCP连接同设备端口23ms成功，说明端口可达，尚不代表HDC握手。按新证据仅尝试一次受控tconn，清除全部大小写代理环境变量；不重启共享服务、不循环重连，也不推断授权/签名问题。

静态交付当前候选：run `20261027T163228Z-3b297fdc-af228b29`，manifest `.reader-artifacts/hap/20261027T163228Z-3b297fdc-af228b29/manifest.json`，signed SHA256 `b6b69c85aee92bc98f23167e3a5a59bfd5c009e0599c6460c0a70023a2f8c2b2`。隔离非增量编译、包校验、指定minliny_HarmonyOS证书与debug Profile验签PASS；Harmony3b297fdc/Core80d614e9均dirty如实记录，未改版本或重编Core。19个受影响生产文件当前字节与候选source-snapshot逐项MATCH。未执行全量套件，动效规格与时序保持本轮前状态。

设备阶段尚未开始安装：本机127.0.0.1:8710列表中目标引用2a10c2b26b06仍Offline；直连TCP23ms成功，单次tconn在30秒被入口终止（exit124），其后一次状态读取仍Offline。真实路由interface=en0，大小写代理环境变量均清除；server本机listener存在。未据此推断手机未授权/签名错误，未杀服务、循环重连、清数据或占用UI probe。已向用户询问当前无线调试地址及连接页状态，等新证据后继续准确候选保数据安装。当前package PASS，physicalInstall/launch/staticVisual/userAcceptance OPEN；不能声称静态实屏已达标。

## 用户授权重试后的真机交付（2026-10-28）

用户明确“重试，注意不要连接代理”。本轮所有HDC调用清除大小写HTTP/HTTPS/ALL代理变量，server固定127.0.0.1:8710，精确目标引用2a10c2b26b06；route查询为en0，直接TCP128ms成功。未使用远程VM服务或改装当前server中的其他目标。

首次tconn返回Connect OK，inspect在physical boot timestamp解析处停止。随后精确target查询返回`[Fail]Not match target founded`但SDK进程exit0；这证明后续查询时连接不可用，不能反推当次uptime原文（当次日志未保存stdout）。同时观察到旧本机listener PID71476消失、新listener PID84941启动，无法归因具体操作者；本任务未start/kill/reconnect共享server。保持当前服务不动，仅重新接入同真机后读到合法UTC uptime `2026-10-26 07:48:27`，因此不修改日期解析或放宽门禁。HDC exit0错误文本可被包装成日期错误的诊断缺口另记，未为此更改当前交付控制器。

第二次inspect PASS：准确候选run20261027T163228Z-3b297fdc-af228b29、签名/Profile身份匹配；route为matching-identity-signed-update-candidate，preservesData=true；boot completed、两次boot identity与SceneBoard稳定观察PASS。install及launch均PASS，dataPolicy=preserve。部署回执：`.reader-artifacts/hap/20261027T163228Z-3b297fdc-af228b29/deploy-physical-2a10c2b26b06-20261028T002414Z.json`。没有卸载、清数据或重新构建同一候选。

静态取证：安装后首次画面实际为恢复的搜索结果态（文件名带shelf不是画面判定），`.reader-artifacts/search-static-20261028/device/reader-control-static-shelf-20261028.png`，1280×2832，SHA256 `2e420e40f63f2481e40efaec46cccc09ac83e5332287d5b333e60f5370e4aa43`。日间、仍在搜索，已处理10/113、结果60；不可当作完成态。实际可见：单行搜索栏/明确宽度停止按钮完整；结果数/状态/进度/单筛选图标归栏下同一区域；封面缩小、正文变宽；完整可见卡片无重叠裁切。源码与实屏独立复核一致，尚未覆盖长标题两行、失败说明、筛选展开和历史面板。

后续00:26Z只读布局/截图不再包含Reader页面内容；屏幕截图为黑底及系统手势条。最小系统归因确认PowerManager为AWAKE，Reader进程仍存在；任务列表明确Reader为BACKGROUND、另一应用为FOREGROUND，因此该黑图不作为Reader渲染失败。此前未发出任何点击、输入或导航；立即结束UI probe并释放租约，没有抢回前台。physicalInstall/launch PASS；staticVisual仅结果基础布局有证据，历史/筛选展开、完整交互及userAcceptance仍OPEN；动效尚未进入本轮改造。

## 历史自然宽与筛选弹窗重新梳理（2026-10-28，用户纠正）

用户明确历史按钮应根据书名动态调整大小，当前等宽网格不符合要求。SearchHistoryGeometry先按92×scale解列数、平均buttonWidth并以列×行取N；HistoryPanel按列切片、layout full并给全部按钮相同width。等宽网格建议/实现至此撤回，后续按逐词真实文字宽+内距/边框解单个按钮宽，按最近顺序整项换行，可用高装不下完整新行即停止，N取实际最新连续前缀；不跳过较长新词去填较短旧词。面板外框高度与原历史持久化owner保持既有归属。单行等高、超整行长词才省略为推荐显示规则，非等宽。

筛选样式代码审计：popupWidth=min(contentWidth,320×scale)与六短选项实际宽度无关；两组均“标签独占行＋按钮独占行”再套Flex.Wrap/Scroll；search-scope圆角999及选中深绿主动作fill，与轻量筛选语义不符。推荐两条紧凑选择行，按标签和三选项真实尺寸解自然宽高；选中浅底+绿字/描边；正常无须滚动，大字空间不足再组内响应式换排。popupHeight是maxHeight，不视为固定192高；mask=true不能单独证明深色遮罩。

代码已定位布局/配方责任，尚不能确认当前真机popup额外外壳、阴影、实际留白和锚点/裁切。因此本次辅助取证仅为当前画面一帧及布局，只读、不展开/点击、不安装；若并非Reader或没有展开筛选，不继续触控复现。先按既有入口核准确本机目标与就绪，保持无代理；本轮仍仅梳理方案，不改生产代码。

本次辅助取证在最小系统只读就绪查询即返回 `[Fail][E001005] Device not found or connected`，未执行截图、触控或重连。不能据当前源码断言原生popup外壳/阴影/实际裁切。当前确认的是过宽规则、四行组结构和深色主动作选中配方；建议紧凑两组选项，待展开实屏补核平台宿主表现。本轮只更新分析与统一方案，没有修改生产源码或安装新包。

## 自然宽历史与紧凑筛选实施（2026-10-28）

用户已明确“按方案实施”。范围为历史逐书名自然宽、最近连续前缀整项换行、完整行准入，以及内容/来源两组紧凑筛选。保持面板高度 owner、持久化/删除能力和现有查询生命周期；本轮继续先静态，不修改动效。

执行前验证选择：旧等宽 capacity/history-render 断言不能复用，需改为实际文字测量接线与逐项宽度/连续前缀/完整行验证；入口 `node tools/test-search-history-static.mjs --case capacity,measurement,history-render`。measurement 直接调用生产度量方法，核 fp 与共享字体配方、padding/border、缓存失效及系统小字体下限，避免纯投影假宽度掩盖接线错误。筛选几何与真实 Builder 结构发生变化，选择 `node tools/test-search-results-static.mjs --case geometry,filter-popup` 验证自然宽约束、六选项、选中配方和退役 owner 拒绝。两入口仅执行显式 case（纯几何、生产方法或 SDK lowering），无网络/HDC/隐式构建/其他测试。既有查询动作、历史持久化、卡片等未改逻辑保留原证据，不重复运行。原生类型/组件接线由本次唯一隔离 HAP 构建编译验证，不额外重复完整编译。

交付仍使用 canonical iteration pipeline（contracts none）生成新 manifest；指定证书/Profile、包字节、准确物理 target 和保数据语义在对应动作处核验。初次本机 discovery：127.0.0.1:8710 存在、准确手机 target Offline；所有调用清除大小写代理变量。代码工作不依赖连接，安装前按当前路由/TCP/连接新证据做一次有界接入，失败保留证据而不循环重试。

源码回归后若连接可用，实屏仅回答代码侧无法证明的平台 popup 壳/锚点、实际字体测量和整行裁切。限本次两个静态状态、会话不超过10分钟，界面前提不符/切到别的应用立即停；不改测试数据、不清数据、不以截图代替代码定位。安装/启动/本地测试/实屏/用户验收分别记录。

本轮直连诊断：route 为 en0，本机 server listener PID84941 仍在127.0.0.1:8710，独立 TCP connect 到准确手机端口105ms成功。一次 tconn 在30秒由租约入口终止（exit124、无业务输出），后续列表仍Offline；server实际设备socket为192.168.1.17:60775→192.168.1.6:38379、SYN_SENT。本次由此只能确认 HDC server 的设备TCP建连未完成，不能把独立TCP探测成功等同于该socket握手成功；不是包/签名/安装失败证据，不能推断未授权。已停止重复连接，无服务kill/start/reconnect、无代理或数据变更。

实施与本地结果：HistoryGeometry只拥有面板可用行预算，逐项投影用共享按钮字体的原生fp测量值+内距+边框求宽，最新连续前缀贪心换行；系统字号小于1时使用vp匹配公共按钮最小可读字号，仅超整行书名clamp并由原生单行省略。行key含完整词/宽度/行高以退休旧捕获。SearchFilterGeometry拥有菜单自然宽/两组布局，常态两行；空间不足标签上置且选项整项换行，极短窗口才启用有界滚动。新增公共有限search-filter-option配方（浅选中底/绿字描边）复用ReaderButton，不改search-scope；壳圆角/阴影复用bookshelf-more-menu，显式BlurStyle.NONE，保留遮罩与owner回调边界。

实际执行上述history三case全部PASS（1.17s），后仅行key修正时复跑history-render PASS；results两case geometry/filter-popup PASS。独立只读复核确认小字号及popup identity/geometry闭包key修复后无构建阻塞。没有重跑查询、持久化、卡片或全量测试。SDK/方法探针不证明原生像素效果。canonical iteration构建已开始，contracts none；生产源码冻结，等待完整编译/签名/HAP校验回执。

首次隔离构建FAIL（36.995s）：两个新面板使用MeasureOptions但缺少显式SDK类型导入，纯方法/lowering探针不能验证全项目类型名称解析。依据当前SDK @ohos.measure及仓内ReaderSelect既有接入，两处补`import type { MeasureOptions } from '@ohos.measure'`，仅补类型导入、不改运行逻辑；不重复运行方法用例，只重试必要的canonical构建。失败回执保留在`.reader-artifacts/hap-attempts/1793161627195-0ba07132-b6bc-4837-9e21-60e8239c1f3c/stages.json`，失败不计为产物。

第二次canonical构建PASS：run `20261028T042850Z-3b297fdc-e2131d8e`，manifest `.reader-artifacts/hap/20261028T042850Z-3b297fdc-e2131d8e/manifest.json`；signed SHA256 `88ab4284a0d3745db156b55c2a24d8f808fd91b98e5263545c39bc833746e03f`。隔离非增量完整编译、包内容/Native校验、指定minliny_HarmonyOS证书及debug Profile验签PASS，contracts none。Harmony commit `3b297fdc7e724cf655eca3bac2a8efeda2001c56` / Core `80d614e929ae9e320ab767a1dc04579363c361d7` 均dirty，如实冻结；本轮7个生产文件与新source-snapshot逐项MATCH，产品版本未改，Core未重编。日志`.reader-artifacts/search-intrinsic-static-build-20261028-retry.log`。

新包生成后仅做一次只读discovery用于准确安装身份核验，手机target引用2a10c2b26b06仍Offline。本次新包尚未inspect/install/launch，没有设备数据变更；旧包安装PASS不能移用到本run。连接当前定位仍为本机server到手机TCP建连未完成，用户无线调试页当前地址/状态待核对，未重复连接或重启服务。当前本地五case/构建/签名PASS，physicalInstall、launch、history/filter实屏及userAcceptance OPEN；动效不进入本轮改造。

## 用户再次要求安装（2026-10-28）

继续交付同一run，不重复构建或业务测试。现场本机server PID84941仍监听127.0.0.1:8710，准确手机target仍Offline，route为en0。此前server残留该设备SYN_SENT而独立TCP可达；待检验原因是server保留失效设备连接，普通tconn未替换它。最小恢复仅移除该Offline target后重新tconn一次，不重启共享server、不影响另一VM target。所有调用清除大小写HTTP/HTTPS/ALL/SOCKS代理变量，调用链NO_PROXY/no_proxy=*；设备TCP与系统代理路径另做只读核验。连接成功才进入canonical inspect/install，超时/状态不符即保留原始证据定位，不循环。

实际恢复：tconn -remove退出0；新tconn仍30秒exit124。server新socket为本机LAN→准确手机端口、SYN_SENT，同期Python同源IP独立TCP connect为30ms成功。hdc.log 12:40:34旧目标session清理handshakeOK:0，12:40:42新session start tcp connect后无成功回调，排除仅旧列表条目残留。当前实际阻塞是HDC server的设备TCP建连，尚未到HDC设备握手、Profile或安装；根因仍未确认。

无代理独立核验：scutil系统HTTP/HTTPS/SOCKS/PAC均关闭；本机Mihomo虽启用TUN，但准确手机地址内核路由为en0、localhost为lo0，配置命中192.168.0.0/16 DIRECT，未发现hdc/Python进程规则，Mihomo没有持有对应8710/38379连接。HDC实际socket为LAN→LAN，没有代理介入证据；不把TUN启用等同于此路径经过TUN。进程级局域网权限日志无明确允许/拒绝证据，不据此猜测权限未开。只读抓包因BPF权限不足失败，sudo -n也需密码，未抓到包、未修改系统权限；Settings入口未派发成功、无设置操作。

占用核验发现另一任务native-goal-final正对本机VM5555做probe/hilog，同一server近期仍有实际使用者，故未在未协调情况下重启共享server；没有清数据或改用远程服务。签名候选七个受影响生产文件仍与run20261028T042850Z-3b297fdc-e2131d8e快照MATCH。不重复构建。当前physicalInstall/launch仍OPEN，须先恢复准确手机HDC连接；用户尚未给出无线调试页当前端点/状态。

## 用户纠正后的本机执行链审计（2026-10-28）

用户明确手机正常，要求查本机错误路径。前轮把进一步排查转给手机过早；只清理当前客户端env，不能代表已运行server环境；普通权限观察UID0 Mihomo的lsof空输出也不能证明无连接。这两点诊断不足撤回，后续不再让用户反复检查手机。

实际argv原始记录为本机SDK→-p -s127.0.0.1:8710→准确手机tconn，无192.168.1.10回退；actual listener84941的IPv4-mapped argv对应127监听。该PID08:21启动，08:23已对同手机连接成功、08:24旧run保数据安装与启动PASS，所以其他worktree cwd/::ffff/当前SDK均不能直接认定为本次根因。foreground.json仍为旧PID71476，不能用它认定新服务归属。当前server无HTTP/HTTPS/ALL/SOCKS变量但仅no_proxy=localhost,127.0.0.1,::1，未继承新客户端NO_PROXY=*；这本身仍不证明经过代理。

已读取Mihomo本地Unix API实际configs/rules/connections，mode=rule，LAN DIRECT启用，无相关进程规则；Python实连在nettop确为en0/Established。API连接缺席仅辅助，不能单独证明未接管。HDC原pending socket已退出，尚缺它的实际interface样本；下一次仅8秒受控tconn诊断配合nettop，唯一要回答HDC手机socket走en0还是utun，非再次盲等30秒。仍不做应用安装前的BM/设备查询，不重启有人使用的server。

8秒诊断实际23ms退出0并返回`Target is connected, repeat operation`，立即只读列表仍Offline，lsof该手机socket为CLOSED、nettop没有该手机连接。故未取得新interface样本，不能把tconn这句成功提示当真实Connected。当前可确定本机server仍保留已关闭但重复接入被判连接存在的session状态，阻止普通tconn重新创建有效连接；最初设备TCP失败的原因仍待证。

当前核占用：没有活动HDC客户端/租约/UI probe，另一VM的采样会话均已退出，其任务当前在处理已采集日志；server仍持有VM通道但没有正在执行的命令。下一步按已授权服务恢复规则在同一server-key维护租约下恢复本机server一次，保持127.0.0.1:8710不变，并按现场原列表恢复VM通道；不改VM运行或App数据。原server日志/argv/env差异及PID保留，启动新server全链清代理变量/NO_PROXY=*，核唯一listener与新child一致后仅尝试准确手机一次。这样同时去除旧session和未验证的旧服务环境，不以换端口绕过占用。

第一次服务恢复发现本机自动拉起竞争：kill退出0且84941确已退出，但在后续foreground helper启动前，另一个入口已于同秒自动创建53346（同旧隔离工作区cwd、::ffff argv，租约事件中无对应start），helper正确拒绝替换现有listener。VM通道自动恢复。新服务的手机TCP仍失败；nettop这次明确为en0/SynSent，所以不是换到了远程server或utun。不能把kill退出0、自动拉起或tconn成功短语当恢复成功。

取得执行上下文差异：系统responsibility_get_pid_responsible_for_pid读到HDC53346→自身，当前exec31813/Python→主app31735；launchctl显示HDC jetsam coalition341285/terminated，当前exec为350261/active（resource coalition名称相同不足以判断）。该自动拉起服务仍来自旧后台执行链，而成功Python来自当前app链。SBPL network-outbound均允许；系统nehelper有main app allowed，也有旧已退出PID6707的blocked通知，不能据单句allowed证明此HDC进程已允许。zsh的log为内建命令，所有系统日志核验改用绝对/usr/bin/log；先前空输出论断撤回。

下一步只对该具体上下文假设做一次受控复验：同一exec紧接租约kill、观察原listener退出、租约foreground -m，缩小外部自动拉起窗口；helper仍须核唯一child listener，不抢占已被其他PID占用端口。先核新server责任PID/active上下文，再准确手机tconn。无其他目标App操作、无权限/代理/责任token篡改，HAP保持同包。

本机启动上下文复验成功：同一exec内维护租约kill→原listener退出→租约foreground -m，总357ms；helper确认唯一listener为自身child57259。只读responsibility查询新HDC→当前主app31735，jetsam coalition350261/active；区别于自动后台server53346→自身、341285/terminated。准确手机tconn在521ms返回Connect OK，立即列表Connected，nettop为本机LAN→手机LAN、en0/Established（已收499/发1523字节）；本地VM5555通道也已自动恢复Connected。SDK、手机、目标、端口、网络规则均未改；没有改权限或责任token。先前新建但旧上下文的server仍失败，此次受控当前上下文server成功，验证本次阻塞与本机HDC后台启动执行上下文有关；具体内核/NECP拒绝机制未单独证明，不夸大为代理或手机故障。

诊断责任归属：root先前只清理客户端env/看路由、放任未知后台server接管、把tconn提示与真实状态混淆，导致重复等待并过早向用户要求检查手机；这些是本机交付编排错误。新服务已通过正确前台启动链恢复，后续复用该准确服务与同一signed run进入canonical inspect/install，不重建、不改设备数据、不扩大业务测试。

实际交付：canonical inspect PASS（matching-identity-signed-update-candidate，preservesData=true，boot/SceneBoard稳定）；同一run的install通过Bundle Manager成功响应与安装后身份核验，install-r语义保数据。随后launch FAIL：系统返回10106102，明确The device screen is locked during the application launch，开发者模式不能自动解锁。这是当前真实系统回执，不再推测手机网络/无线调试问题，不关闭开发者模式或绕过密码。

canonical退出码3未生成完整deploy组合回执，但实际安装结果已被其核销记录保存：`.reader-artifacts/hap/20261028T042850Z-3b297fdc-e2131d8e/resolved-retention-install-physical-2a10c2b26b06-c41514d2-3e4f-4cd8-8744-cb0c4220f02b.json.resolution.json` 的installOutcome=PASS；日志`.reader-artifacts/search-intrinsic-static-install-20261028.log`保存明确launch失败原文。不能把组合命令exit3改写成安装失败，也不能伪造完整deploy PASS。当前physicalInstall的实际BM/身份层PASS，完整部署回执及launch/静态实屏/用户验收OPEN。已请求用户仅解锁，后续只补启动，不为补回执重复安装。HDC根因与恢复经验已同步受控源、根AGENTS及Harmony AGENTS，30投影0 stale。

用户回复已解锁后的启动续接：准确target仍Connected、原受控server57259保持；复用同一安装/就绪证据，不重建不重装。首次aa仍返回10106102（SDK exit0不能计成功）；随后最小只读ScreenlockService -all明确deviceLocked=false、screenLocked=false（user100），紧接aa start返回`start ability successfully.`，pidof io.reader.minliny确认为65144。最终launch PASS，未继续触控/截屏或扩展业务测试。补充事实回执`.reader-artifacts/hap/20261028T042850Z-3b297fdc-e2131d8e/launch-continuation-physical-2a10c2b26b06-20261028.json`绑定原包/安装核销与本次启动/进程观察，明确为supplementalReceipt，不伪装原canonical组合回执。当前安装/启动实际层均PASS；历史/筛选实屏与用户验收仍OPEN。

## 搜索任务摘要、底部筛选与搜索入口纠正（2026-10-28）

用户新要求：结果右侧不显示搜索中，评估下方跳过/书源不可用样式；筛选点击改屏幕底部弹层（已明确确认）；输入框去掉内置搜索图标并向左利用该空间；书架普通态左侧应搜索图标。先静态，保持已安装数据/查询owner与动效时序。

代码定位：SearchPage resultSummary常驻searchStatusLabel，进行中返回搜索中，与resultProgress文本/进度条/停止动作重复；searchProgressDetails把partial/failed/skipped分成同色裸行，failed附较高重试槽、skipped只有18行文本且组无统一gap，进行中也挂禁用重试。失败是本轮请求失败，跳过是healthFailed/cooldown导致未请求，不能合并成错误数。Orchestrator允许skip-only终态重试，页面却忽略该入口，备用文案仍承诺可重试。原demo没有真实失败/跳过设计，仅作为标题/进度层级参考，不把其缺失当认可。任务摘要继续归DEDICATED-SEARCH-SESSION-NOTICES，复用公共MESSAGE字体/动作，不新增Toast/Recovery或独立消息外框；随代码更新旧登记中的filterProgressRow等过期描述。

ReaderSearchField.bookPanel原有22图标+7gap占据29vp，移除该分支并保留正常9vp内距，输入按现有layoutWeight向左扩充；不影响其他SearchField变体。外侧Shelf icon稳定idle原代码/资源已是search，但presentedSearch把mode已idle的back过渡仍判返回；本轮把图标/AX直接绑定mode，使返回书架时立刻恢复search，同时保留活动搜索返回和原点击拦截。具体实屏持久idle异常未有新截图，不把代码推断冒充现场证实。

本次最小验证选择：`tools/test-search-status-summary.mjs --case status-labels,task-summary,retry-owner,summary-builder`核进行中不重复状态、不挂禁用重试、失败/跳过分层和唯一终态owner动作（含skip-only/旧query拒绝）；`tools/test-search-results-static.mjs --case filter-popup`更新为底部sheet真实SDK Builder/共享壳与dismiss旧身份校验；输入/入口使用实际Builder及mode/action方法的精确case（由实施时登记）。所有仅本地生产方法/SDK lowering，无HDC/网络/隐式构建/兄弟套件；其他不受影响历史排版、查询、卡片保持旧证据。之后canonical iteration构建自身验证完整编译/指定签名与内容，不另跑重复CompileArkTS或全量。

后续实屏只回答代码不能证明的native底部sheet外壳/安全区/选项大字裁切与单行摘要视觉，先完成上述修复/本地检查。若真机交付则复用已恢复的本机server，禁代理/不清数据，不例行重启或重复核验无关场景。

输入/图标准确入口：`node tools/test-search-field-icons.mjs --case book-panel-content,shelf-leading-state`。前者真实SDK挂载验证bookPanel不再占图标/间距、清空与bookPage变体保留；后者验证真实bar/事件方法的idle、idle-closing、input/results及昼夜资源选择和关闭阶段拒重复点击。两个case已PASS；测试SDK缺依赖注册首次失败修复后仅重跑相关case，非生产构建错误。LibrarySearchIconGeometry未改；审Index未找到第二套书架标题栏或错误稳定idle图标资产。底部筛选另选geometry case：旧锚点popup算法已经无生产消费者，本次删除旧分支、改由共享sheet宽度/body预算统一解整组选项换排，需验证窄窗/大字完整选择和body cap；不为此重跑结果卡/查询用例。

本次本地八case全部PASS：status四case、filter geometry/filter-popup两case、field/icon两case。独立只读复核没有新的阻塞；公共header测量已实接入，sheet几何缓存包括header实测/可用body预算，旧popup生产分支删除；MESSAGE_ACTION公共有限spec与入口登记已同步。canonical iteration/none构建中。

安装路由预检发现原服务57259仍在但手机Offline。先查上下文而非重试：当前应用已换为主app25086、jetsam353291/active，旧HDC57259 jetsam350261已terminated、responsible退回自身；同一准确手机独立TCP136ms成功，route仍en0。与刚刚验证的旧应用退出后后台HDC失效一致。现场无HDC活动客户端或租约owner，本轮按已有恢复经验用同一有界执行链将原服务切回当前应用上下文，不换端口/目标，不重建或重复30秒盲连。

已按前次经验一次恢复为server38557，responsible=当前app25086、jetsam353291/active；准确手机160ms Connect OK，未让用户核手机或重复连接。canonical iteration构建PASS：run `20261028T105245Z-3b297fdc-337f869b`，signed SHA256 `63ba7d1d096e51c45421fc01cff1d7fb3ff2b67efd12d19b00c70fcc0b3d988b`；完整隔离非增量编译、指定minliny_HarmonyOS证书/debug Profile、Native/包内容PASS，contracts none。Harmony3b297fdc/Core80d614e9均dirty如实冻结；本次9个修改生产文件与source-snapshot逐项MATCH，未改版本/重编Core。canonical inspect PASS、same-identity保数据路径允许、boot/SceneBoard稳定，开始同一signed run覆盖安装与启动。日志`.reader-artifacts/search-controls-sheet-{build,inspect,install}-20261028.log`。

该run安装/启动PASS，canonical部署回执`deploy-physical-2a10c2b26b06-20261028T105410Z.json`。已依前述最小取证范围抓Reader结果一帧（未主动提交查询，App恢复已有任务）：画面无右侧搜索中、输入内放大镜移除、正在处理13/113。随后准确筛选触控槽[1056,380][1210,534]点击中心1135,457，ACK No Error；新布局/截图没有Sheet或筛选搜索结果标题，用户同时反馈“筛选不生效”。不能把本地filter Builder PASS或安装成功当真实筛选通过。当前停止派发后续点击并立即回代码定位，未改选项/读书/清数据。

截图/布局：`.reader-artifacts/search-controls-sheet-20261028/device/reader-control-search-controls-initial-20261028.{json,png}`；点击后`.reader-artifacts/search-controls-sheet-20261028/device/reader-control-search-filter-sheet-20261028.{json,png}`，后者实际并无sheet，文件名不作为状态判断。剩余问题分层检查点击owner→expanded→bindSheet入场/metrics→选项callback→投影，不继续真机盲点。

代码定位两处接线缺陷：①当前普通sheetBuilder(identity)工厂返回CustomBuilder，经实际SDK lowering后原样变成bindSheet(bool, function, options)，而项目已工作的书架原生弹层直接@Builder方法引用会变为bindSheet(bool,{builder:method.bind(this)},options)。现探针手动调用function绕开了真实nativebuilder包装，导致局部PASS漏测；改直接@Builder引用，在内容内部用ForEach按presentationIdentity捕获原身份，测试必须验证native第二参builder对象。②metricsChanged继承原popup任意窗口度量变化即onDismiss，旧代码在模拟原生入场metrics广播的真实属性更新探针中FAIL（expanded由true变false），已证为独立自动关闭缺陷；改仅失效几何/header缓存、保持sheet。并未取得实机该次metrics触发日志，不把该注入等同现场原因。

本次最小验证仅`tools/test-search-results-static.mjs --case filter-sheet-opening,filter-popup`：真实SDK lowering的builder对象、父false→true更新/当前identity、原生onWillAppear触发metrics广播保持展开、六选择和退出/旧回调隔离。opening旧代码先FAIL再修复；现还需针对builder包装修后再跑上述两个准确case，不重跑几何/结果/状态/输入套件。唯一剩余设备问题是修复后真实native sheet能否展开并选项生效；允许一次有界展开→改一个筛选→确认结果范围→还原/关闭采样，不重提查询、不改测试数据，非Reader或其他错误即停止。

两处修复完成后上述两个case最终PASS，约1秒。测试改为强制读取原生builder对象的.builder，拒绝rawfunction，不再让JS手动调用掩盖native接线。生产只改ReaderSearchFilterPanel（sheetBuilder工厂删除，直接@Builder引用与内容内keyed identity、metrics只重排），旧消息/图标/几何均不重跑；新canonical iteration/none构建中。

修复包构建/验签PASS：run `20261028T105918Z-3b297fdc-7338d95b`，signed SHA256 `b5f447c89e635a31d6be8dd44c0d1ec92a1fb423f7fe197ce96f5c68583cded5`，指定minliny_HarmonyOS debug证书/Profile通过，contracts none。Harmony3b297fdc/Core80d614e9均dirty如实记录，Panel当前字节与source-snapshot MATCH。canonical inspect、保数据覆盖安装、启动全部PASS，部署回执`deploy-physical-2a10c2b26b06-20261028T110010Z.json`。未重编Core、改版本、清数据或重新提交查询；App启动恢复原查询属于其既有行为。

首次复验取证途中用户切到其他应用，截图含其他应用而非Reader，立即停止并释放；不把该画面当Reader渲染错误或筛选成功，也没有继续触控。用户重新确认“已停”后，只在现有Reader结果做单一有界场景：

- `reader-control-filter-confirm-current-20261028.json`确认当前Reader及筛选触控槽；点击后`reader-control-filter-confirm-open-20261028.{json,png}`明确出现SheetWrapper/SheetPage（[0,2044][1280,2832]）、标题和六选项。日间纸底/握柄/遮罩/安全区完整，正文两组无裁切；打开截图SHA256 `b2ff1bbc787e1a3b987176e541129afc56236f761b8c36c65e500394e49ab9f6`。
- 点击真实“漫画”选项中心651,2433，`reader-control-filter-confirm-comic-20261028.json`含搜索结果0及“当前筛选（全部 · 漫画）下暂无结果，搜索仍在继续”，SheetPage保持展开；证明选项已真正作用到结果投影，不是仅改选中颜色。
- 点击“全部”还原，再点击遮罩100,1000，`reader-control-filter-confirm-restored-20261028.json`确认结果423、无SheetPage、Reader仍前台、查询文字未变。期间原任务继续返回，不能把打开时376与还原时423视为筛选丢失或新提交。遮罩未穿透打开书籍。采样结束释放租约，没有扩测其他页面。

以上文件均在`.reader-artifacts/search-controls-sheet-20261028/device/`。本次准确内容筛选场景与native底部展开/关闭PASS；来源组合、夜间/系统大字的真机实屏没有新运行，保持本地几何/Builder证据，不夸大整套筛选或用户验收。当前修复安装/启动及该场景PASS，用户视觉验收仍OPEN。
