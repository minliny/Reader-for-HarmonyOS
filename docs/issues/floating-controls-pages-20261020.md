# 普通页面悬浮栏与正文边界审计（2026-10-20）

- 触发：用户指出下载页底部悬浮栏的实际占用大于外轮廓、外轮廓与内容近乎同宽，并要求所有页面排查；随后确认控件 Demo，授权落实生产 UI。
- 本分工源码起点：`8a8328822d9002a8f6fb044ed508a7cc6b000bac`，当前 dirty 工作区。开始前已有文档、构建工具及测试工具修改，保留原样；本分工仅改下列五个 UI 文件及本记录。
- 范围：书架、小说详情、普通目录/管理/工具/搜索/设置/书源及保留的 RSS/发现/同步页面。下载页由主任务修改；阅读/漫画由并行分工处理；选择控件家族由另一分工处理。
- 证据：当前源码、调用方、页面/子状态与滚动宿主属性。未进行设备抓取、编译、HAP 或交互验收；不能由源码推定圆角外原生命中或阴影像素已通过。

## 本次问题与最小修改

| 问题 | 当前源码定位 | 修改 | 边界 |
| --- | --- | --- | --- |
| 书架浮动标题栏外侧16vp，而手机正文/空态卡侧边19vp，仅3vp差；栏内侧仅4vp | `BookshelfShell.ets:126-144`、`AppTopBar.ets:92-104`、`BookshelfPage.ets:1091-1094`、`BookshelfEmptyPage.ets:127-140` | 标题栏外侧改为 `max(8, interactiveSafeSide)`，浮动变体内侧4→9vp | 保留正文共享19vp与352vp限宽、顶栏52vp、内部44vp动作槽；普通非浮动 AppTopBar 不变 |
| 小说详情标题栏外侧16vp、正文20vp，仅4vp差 | `LocalBookDetail.ets:150-159,695-708`、`PageBackBar.ets:99-115` | 小说顶栏改为 `max(8, visualSafeSide)`；小说正文侧边20→18vp；标准浮动返回栏内侧4→9vp | 漫画详情的 headerFrame、正文20vp、visual规格不变；非浮动 PageBackBar 不变 |
| 书源底部定位宿主与首帧滚动尾距按44vp操作行预算，而实际操作行高48vp | `SourceManagementPage.ets:238-242,581-586,703-716` | 宿主与未测量时的尾距均改为48vp操作行预算 | 不增背景或统一外框，不改变两个按钮动作、选择控件、回执或状态 |

手机390vp、无左右安全区时，修后书架外栏374vp、正文352vp，每侧差11vp；小说详情外栏374vp、正文354vp、底部dock330vp。小说顶部内侧9vp、正文侧边18vp、底部侧边30vp，分别有明确轮廓层级。

书架正文保持既有19vp共享token，未为追求 Demo 数字完全相等而改变全局token及所有固定页面。宽屏顶部栏是窗口导航层，正文可以是左导航轨右侧内容栏或受限宽卡片；不能把手机边距直接套在宽屏内容轨上。小说详情继续正文最大720vp、dock最大680vp，未缩小到单一固定宽度。

## 绘制、命中和滚动分开核对

1. `AppTopBar`、`PageBackBar` 的浮动背景、边框、圆角在同一实际节点，保留 `clip(true)`；全屏定位宿主不应因此获得实体背景。
2. `ReaderPageScaffold` 的 header/footer/overlay 定位层为透明命中；浮动 footer 默认 `footerSurface:'transparent'`。不能仅凭全宽 Column/Stack 就断言背景覆盖全宽，也不能把显式模态遮罩当作浮栏溢出。
3. 本分工未改 `ReaderPageScaffold`、`ReaderPageShell` 或全局 `TOK_SCREEN_INSET`。其余分工对共享宿主的变更由主任务统一复核。
4. 书架/书源/搜索结果等 List 使用 `contentStartOffset`、`contentEndOffset`；普通 Scroll 的上下净空位于内部内容 Column。没有把浮栏高度作为原生滚动视口大段 padding。
5. 小说详情尾部原为 `bottomInset + 104`，等于dock68 + dock底间距12 + 可滚到的末尾空隙24；保留该内容padding。dock本身侧边30vp、padding9、内部按钮高48、外高68、clip(true)，无需重做。
6. 原生圆角外点击、边缘滑动穿透、阴影实际像素和尾项滚动可达仍属于后续目标验收，不在本源码审计中标PASS。

## 全页面与子状态清单

表中“保留”表示本次源码未发现同类问题或属于不同页面契约，不表示已做设备验收。

| 页面/状态 | 宿主与边界依据 | 本次处理 |
| --- | --- | --- |
| 书架：加载、失败、空架、有书封面/列表、筛选展开、无匹配、返回保留列表位置 | 同一个 `BookshelfShell` 浮动标题栏；有书 `BookshelfPage.ets:611-614` 用内容offset，空态 `BookshelfEmptyPage.ets:48-64` 与加载/失败 `BookshelfStatusContent.ets:21-37` 的上下净空在Scroll内部Column | 共用标题栏边距修复覆盖全部状态；列表/状态与导航业务不变 |
| 书架手机主导航：上述全部状态 | `MainTabBar.ets:75-95` 外宽由tab数与安全区解析，68高、padding8、radius34、clip(true)，透明命中；`ReaderFloatingBarMetrics.ts` 将68高+底间距+16尾隙放入滚动内容 | 保留；当前l0两tab为196vp紧凑胶囊，并非全屏底板 |
| 书架宽屏：有书轨道、无书/加载/失败保留手机导航 | `BookshelfShell.ets:281-287`；`MainTabShell.ets:66-95` 与 `MainTabBar.ets:99-112`；轨道82×332，子项66vp，不挤占列表视口 | 标题仅统一浮动内/外边距；保留轨道与各状态既有装配 |
| 小说详情：本地/在线、已入架/未入架、加入/取消/移除中、书籍已移出、简介展开/收起 | `LocalBookDetail.ets:150-188,582-647,695-708`；正文高100%Scroll，内容内top/bottom padding，底部dock独立绘制并裁剪 | 仅小说顶栏与正文横向关系修复；底部dock为正例保留 |
| 漫画详情：字体准备/失败、已入架/未入架、加入/移除、简介/目录预览 | `LocalBookDetail` 漫画显式分支：headerFrame、正文visual规格、dock30类层级和padding/clip均独立 | 本文件漫画分支未改；由阅读/漫画分工登记 |
| 书架多选：未选/部分/全选、删除处理中 | `BookshelfMultiSelectPage.ets:60-68,99-105,213-247`；全宽直角固定删除条有明确上分界，List用内容offset | 保留固定dock契约，不将其误改成悬浮胶囊；不改多选/删除逻辑 |
| 书架设置：显示方式读取/失败/封面/列表、恢复消息 | `BookshelfSettingsPage.ets:137-148` 接 `ReaderStandardPage`，普通58vp返回栏，无浮动footer | 保留 |
| 书架数据管理：初读/失败/已有数据、分组、书籍分配、阅读记录、原事项待处理 | `BookshelfManagementPage.ets:68-79`；内部有限高度List在外层内容中，无悬浮底栏 | 保留 |
| 书源管理：首读/失败/筛选/分组选择/空结果/检测/登录/原事项待处理 | `SourceManagementPage.ets:201-242,534-586,703-716`；footer透明、两独立操作按钮，List用内容offset | 修复实际48vp行与宿主/尾距预算4vp不一致；不增加统一背景 |
| 书源工具：批量操作/检测结果、书源编辑、调试、失败与恢复 | `SourceToolsPage.ets:225-236` 接 `ReaderStandardPage`；三个局部List只是卡片内部有限视口 | 保留；无浮动footer |
| 搜索：初始、加载、结果、空结果、错误、需要书源、书源读取失败 | `SearchPage.ets:431-476,722-743,1059-1072,1272-1342,1464-1494`；复合固定header，结果List用内容offset，其余Scroll上下padding在内部Column；activity全屏定位层无背景且HitTestMode.None | 保留；未把搜索层改成悬浮标题栏 |
| 设置主页与通用设置：菜单、切换、缓存动作、恢复提示 | `SettingsShell.ets:33-70`；主页普通AppTopBar+MainTabBar，通用页普通PageBackBar；`ReaderStandardPage.ets:36-43`上下padding在Scroll内容Column | 保留；手机导航复用已正确的MainTabBar |
| 规则实体管理：已有/空/失败/编辑与订阅 | `RulesManagementPage.ets:95-105` 接 `ReaderStandardPage`；普通返回栏，无浮动footer | 保留 |
| RSS主页：feed/刷新、无未读、全失败，以及来源筛选展开 | 当前l0不开放；`RssPage.ets:299-315,613-667`上下padding位于内容Column；主页导航复用MainTabBar，筛选为内联展开 | 源码保留，不声称当前产品入口可达；无同类源码修改 |
| RSS订阅管理、新增/编辑、全部条目 | 当前l0不开放；`RssSubscriptionManagementPage.ets:80-86`、`RssSubscriptionEditorPage.ets:52-57`、`RssSourceFeedPage.ets:60-65` 均为普通ReaderStandardPage | 保留 |
| RSS条目详情：有/无原文、正文/摘要及打开失败 | 当前l0不开放；`RssEntryDetailPage.ets:72-78,322-334` 两独立底部按钮无外包圆角壳；ReaderStandardPage按实际footer高留尾距 | 保留；不能把独立按钮组的正文同宽当作浮栏外壳重合 |
| 发现：首读/失败/空、分类、排行结果 | 当前l0不开放；`DiscoverPage.ets:128-145`上下padding在Scroll内部Column，普通header，共用导航 | 保留 |
| 同步：WebDAV/本地、记录/空、任务状态/配置 | 当前l0不开放；`SyncPage.ets:88-93` 接ReaderStandardPage，无浮动footer | 保留 |
| 普通小说目录旧分支：加载/错误/搜索/规则展开/平铺 | `BookDirectoryPage.ets:179-284,695-708`；当前小说入口已走ReaderFullDirectory，旧普通分支仅保留；上下净空传给目录内容offset | 不计当前可达页面，不在本分工修改；实际ReaderFullDirectory由阅读分工登记 |
| 漫画完整目录：字体/空/列表/分组/当前底栏/短窗flow | `BookDirectoryPage` 漫画分支由阅读/漫画分工处理；本分工只读发现其旧固定footer会用Scaffold.contentEndInset裁视口 | 移交，不在此重复修改 |
| 书架更多菜单、书籍动作sheet、本地导入/移除对话框 | `BookshelfMoreMenu.ets:77-146`、`ReaderActionMenuSurface.ets:63-104`及各原生sheet/有限对话框；全屏dismiss层为显式模态语义，菜单内容在其边界内，导入紧凑结果减footer仅限模态内部 | 保留，不当作普通页面底栏问题 |
| 换源抽屉、切换进行页、完成提示 | `SourceSwitchWindow.ets:755-800` 抽屉背景/圆角同节点且clip；`SourceSwitchProgress.ets:75-80`只有系统安全区padding；`SourceSwitchCompletionOverlay.ets:30-45`父层HitTestMode.None | 本分工只读保留；抽屉/准备页/非交互提示不是普通浮动操作栏 |

## 验证范围与未决项

- 实际入口：只读 `rg`/源码与本次五文件diff；`git diff --check -- <这五个UI文件>` 与新记录的 `git diff --no-index --check /dev/null <本记录>` 仅检查本次补丁空白错误，无嵌套测试、不占SDK/构建/设备资源。当前必要依据：避免并行dirty工作区中局部补丁格式出错。
- 执行结果：五个UI文件的 `git diff --check` exit0，无输出；新文件的no-index检查exit1、无空白错误输出（1表示该文件相对空文件有新增差异）。这只是补丁格式复核，不是布局、业务或原生交互测试。
- 按 `GATE_INDEX.md` 的普通开发条目，本分工不执行门禁、SDK lowering、构建、签名、HAP、安装或设备操作；它们均为 `NOT_RUN`，不得记为PASS。
- 已确认的源码问题：标题栏近同宽与内边距不足、书源宿主4vp预算错位。当前结论为源码已修复；原生渲染/命中/滚动行为与用户验收仍OPEN。
- 后续目标验证需覆盖：书架有书/空/失败、小说详情入架状态、书源长列表尾项，检查浮栏周边内容可绘制/可滚动、点击目标不越界和尾项能露出。设备是否占用及本次构建/安装授权由主任务另行处理。

## 下载容量底栏专项（2026-10-20，`33f7c7b` + 既有 UI dirty）

- 触发：用户报告下载管理页底部栏文字、图标排版异常。本节接手 `SharedDownloadPage.ets` 的容量底栏局部；本节之前下载页的浮栏、书籍动作和章节业务修改均为既有 WIP，保留原样。夜间色板由主任务处理，本节不修改颜色或生成规格。
- 用户随后确认入口是书架“更多”里的下载管理。实际调用链：`BookshelfMoreMenu.ets:150,160,172` → `BookshelfShell.ets:204-206` → `Index.ets:1085-1086` 的 `openDownloads()`；`Index.ets:1922,1934-1938,1944` 将 detailKey 设为空并切到 downloads 路由，`1235,2050,2058` 装配 `SharedDownloadPage`。初始 managing=false、无章节详情，`SharedDownloadPage.ets:245-249` 显示本次修复的 storageDock；高度不足时 `331-337` 的 compactDock 复用它。该路径没有 MainTabBar。
- 当前源码定位：`SharedDownloadPage.ets:776-802` 的 `storageDock`。宿主默认透明 footer，左右各 `max(30, safeSide)`，背景/边框/圆角/裁剪在实际 Row；高度回执经 `recordDockHeight`、`contentBottom` 留入 List 内容尾距，不需要再给 native viewport 加 padding。
- 确认的问题：提示未显示时仍存在空 Text 和固定 `20 × fontScale` 高度；提示有字时实际字样角色为 21fp 行高，却被限制在 `20 × fontScale` 高度，窄屏换行也不能增高。图标布局槽为36vp，命中却从 x=-4vp 扩成44vp，使文字、图标的布局预算和真实点击槽不一致。
- 最小修复：只有确实存在未知容量时才渲染原提示；提示使用自然文字高度和原字号/行高。摘要 Column 明确左对齐、`minWidth:0`，仍按剩余宽度布局。图标保持原18vp图形，Button 分配真实44×44vp槽，取消外扩 responseRegion；Row 明确垂直居中。原设置文案、资源、无障碍名称、打开设置的回调与容量策略同步均不变。
- 宽度预算：320vp、左右安全区不超过30vp时，外栏260vp；扣边框2、左右内距28、间隔8及真实图标槽44后，摘要可用178vp。大字或更窄窗口下允许提示自然换行；外栏实测增高会继续进入既有可滚动尾距，不压缩正文视口。
- 管理态边界：`selectionDock` 的两列/三列按钮、等权、原文字、全选、章节多选、目标捕获与发送方法未改。其窄屏大字换行风险仅记录，用户确认的是书籍列表容量栏，因此本次不扩大到管理态；没有上线纵排、重新分配权重或新增流程。
- 必要局部验证入口：`node tools/evidence/floating-controls-20261020/syntax.mjs downloads/SharedDownloadPage.ets` 只用已安装 SDK parser 解析本文件；`node tools/evidence/floating-controls-20261020/download-storage-dock-probe.mjs` 只降低实际 `storageDock` 及八个直接辅助方法，复用 Builder 工具的组件/字体元数据注册，执行容量已知/未知/空列表 × 日/夜 × 1/2倍字号十二组输入，记录实际 SDK 发出的属性及设置回调；静态对比原始 `8a832882` 的 `selectionDock`/`actionButton`/`quickSelectChapters`/`captureSelection`/`sendAction`，仅忽略既有圆角 clip 变更。两项均 exit0。`git diff --check -- entry/src/main/ets/features/downloads/SharedDownloadPage.ets` 无空白错误；本分工接手快照与当前源码对比只差上述容量栏局部。
- 证据边界：探针可确认提示节点有无、没有硬高度、真实图标槽、Row/Column 对齐属性、设置回调和实测高度进入尾距；不执行 ArkUI 原生排版或绘制，不能把 1/2倍输入当作设备大字、窄屏截字、像素或命中验收。未运行门禁全集、构建、HAP、安装或设备操作。

## 搜索与书籍详情加载期布局跳动（2026-10-20）

用户在本任务真机更新后报告：搜索页和书籍详情页加载时顶部排版变化，带动下方书籍列表闪烁换位。报告对应包runId为`20261020T111343Z-33f7c7b2-32fe32c5`，本次源码基线为Host `33f7c7b21474a76a042ebda911c5f0ff2d73cf54`加现有dirty UI；先代码定位，不重复真机抓取。

| 范围 | 当前代码定位 | 最小处理与边界 |
| --- | --- | --- |
| 搜索顶部高度回执 | SearchPage未传Scaffold的headerMeasurementKey，旧loading测量可能在results回调时被当前layoutKey盖章并采用；公共ReaderFixedHeaderHost已有旧key拒绝，页面未接入 | 由搜索页明确布局代次并透传，父回调拒绝旧代；不修改全局Scaffold或业务搜索状态 |
| 搜索实时统计 | resultStats的FlexWrap.Wrap随进度、失败、跳过文案增删换行，经resultStatsHeight及fixedHeaderHeight双回执多次改变List.contentStartOffset | 稳定原统计行高度，按实际字体缩放；长状态水平可达，保留原文与重试动作，不新增提示或控制项；初始/加载不常驻空筛选行 |
| 详情简介 | LocalBookDetail.measureIntro先清空introMeasured/introOverflow，再在Promise微任务实测；两个简介Builder在!introMeasured时maxLines10000，随后收回3行。远程种子书籍、详情补全和宽度更新均可能触发 | 原生MeasureUtils本来同步，首帧与同实体更新直接完成测量再一次性发布，保留默认三行/主动展开和异常全文可读降级；不改变封面、目录、路由或加载业务事实 |

公共侧已排除：PageBackBar实际高度已明确（标准浮栏52），Scaffold没有将详情header回执写回正文；封面固定84×122，不按图片返回尺寸改变布局。字体由既有启动checked receipts准备，暂未发现这两页正常首帧依赖未等待的独有字体。真实书籍元数据补全可能改变合法内容高度，此项不等同于上述可消除的临时展开/测量回跳。

本次执行前选择：搜索`tools/evidence/loading-layout-20261020/search-probe.mjs`与详情`detail-probe.mjs`，分别仅复用现有installed SDK/component lowering、实际生产方法和显式原生测量端口，无旧门禁/网络/Core/构建/设备子调用。必要性：回放旧header回调与流式统计状态，核对字号/窄屏高度和原动作；回放长/短简介、metadata/宽度更新、主动展开、卸载失效与测量失败可读性。仅解析本次两个生产ETS和新探针的Node语法/补丁格式，不扩大套件。与新目标相冲突的旧stats-wrap及queued-only合同不改断言、不重拍定义指纹、不冒充本轮PASS。检查结果与后续包/设备证据另记。

开发交付仅在以上局部证据通过后执行：规范`hap-pipeline.mjs build --class iteration --contracts-scope none`（当前源码快照、SDK/Native配套、官方依赖解析、隔离非增量ArkTS编译、指定证书/包字节核验）→`verify --manifest`→当前准确物理目标的`inspect/install`（boot/SceneBoard与已装身份、保数据覆盖、安装后身份和启动）。这些是让用户在本任务已指定真机查看本次修复的必要动作，不附带业务门禁或UI取证。先只读确认Native身份；配套有效时不重复Native编译；不为取得新deploy回执而重装上一个包。各层结果单独记录。

源码实施和局部结果：

- 搜索仅改SearchPage：透传结构/window/tablet绑定的measurementKey，父回调也拒绝旧代；统计保留原文、顺序、按钮和业务回调，原生横向Scroll承载长内容，槽高按20fp行预算＋12vp上下内距随系统字体变化；取消stats第二套高度回写。`search-probe.mjs`实际SDK PASS：旧loading/旧window回执拒绝、当前回执接纳；320/390/736宽×1/1.3/2/3.2字号与进度、失败、跳过、停止等输入保持同一List起点，原retry调用保留；单文件SDK parse、探针Node语法和定向格式PASS。
- 详情仅改measureIntro一个方法：同步MeasureUtils完成后发布，不再异步清空旧测量事实；两个简介Builder、尺寸、目录和动作不改。`detail-probe.mjs`实际SDK PASS：12组text/manga×320/390/800宽×1/2字号，首帧、同key metadata、字宽/字体变化、主动展开/收起、短/空内容、失败全文降级、mounted/generation/signature失效；替回旧queued方法的负对照被拒绝。单文件SDK parse、探针Node语法与定向格式PASS。
- 详情新探针两次准备失败保留：旧helper缺ReaderTransientFeedback构造依赖；记录型helper保留历史node表，不能用来断言原生已删除节点。已仅在本次探针补明确消息生命周期端口、改用当前生产事实与fresh SDK短简介build判断，没有修改公共helper/旧门禁；最终入口exit0（6.37s）。
- 上述为源码/SDK与受控原生测量端口的证据，不能冒充原生字形、触摸或设备视觉验收。旧wrap/queued-only门禁未运行，未改其断言或定义指纹，其他业务套件NOT_RUN。
- 打包输入只读复核：Core `2a301653c140eef457e786fd6ab3bb9b8e3045c8` clean与Native identity/input snapshot一致，SDK六文件逐字节匹配、Host/package SO均为`3c9ab79e6280105fc9020a2e062229d577c722145f7d9d5b6fd1ba4f2f94b99d`。配套有效，本轮直接开发构建，不重复Native编译或sync。

加载布局修复包构建PASS（Hvigor 47s460ms，现有编译警告保留）；runId `20261020T113315Z-33f7c7b2-b8c47809`，manifest：`.reader-artifacts/hap/20261020T113315Z-33f7c7b2-b8c47809/manifest.json`。signed HAP SHA256 `54ebdf9317426a2215eb1485c4cfbed3cd4cb56f5642c9e0f35b4945e41b611b`，指定`minliny_HarmonyOS`证书`3A563778...B676DC4`、debug Profile验签PASS；manifest离线verify PASS。来源Harmony `33f7c7b21474a76a042ebda911c5f0ff2d73cf54` dirty / Core `2a301653c140eef457e786fd6ab3bb9b8e3045c8` clean；输入指纹`b8c4780918315b5e987d93334ff1a8c501acb7cd485d6def3470f511bd38a7ef`，业务合同/全量NOT_RUN。

当前同一物理目标发现为Connected，目标引用`fcd0dc18a65b`；新manifest的inspect PASS：boot完成、SceneBoard稳定、已装appId/appIdentifier与Profile相同，允许保数据更新。已开始规范install；安装、启动与用户视觉验收分别记录，不将inspect冒充安装成功。

本次规范安装与启动PASS，保留应用数据；部署回执`.reader-artifacts/hap/20261020T113315Z-33f7c7b2-b8c47809/deploy-physical-fcd0dc18a65b-20261020T113445Z.json`。本次问题记录的独立no-index格式检查exit1、无空白错误（文件相对空文件有新增差异）。源码、局部SDK、工程编译、签名/包校验、物理安装/启动各层已取得上述回执；未做额外真机UI取证，功能交互与用户视觉验收仍OPEN，不能由安装成功声称闪动像素已验收。

### 用户否定横向统计方案，先设计展开收起（后续反馈）

用户报告本包搜索统计文字仍被遮挡，并明确指出只取消换行并不能解决问题，要求先设计展开/收起按钮，再固定文本渲染空间。该项用户视觉验收未通过；前述SDK属性检查与安装/启动PASS不能替代此项失败。当前resultStats的横向Row仍含maxLines(1)，partial failure整段还作为按钮渲染，既有局部属性探针未证明原生完整文字可见。

本轮仅做设计预览，不修改生产源码/业务/门禁、不构建或安装。设计方向：摘要“找到N本”与常驻展开按钮分槽；收起固定摘要空间，展开使用按实际字体行高计算的固定多行视窗，正文换行、超长在内部纵向滚动；失败详情与短“重试”动作分离。仅用户开合或窗口/字级变化改变外框，同一搜索进度更新不自动开合或增减外高。后续若获实施指示，须把展开状态纳入现有测量身份并保留原operation/canRetry/回调边界。

设计预览只选择：Node VM解析该单个HTML片段内脚本；本地visualize render包装并在浏览器核对开合、文字换行、固定视窗与列表起点。无SDK/Core/门禁/网络业务/构建/设备子调用；必要性仅为防止此次设计继续用单行或容器裁切遮挡长内容。它不是生产实现或原生验收。

预览`search-progress-disclosure.html`脚本解析PASS；浏览器已打开并确认摘要右侧按钮可开合、详情为正常换行（white-space:normal），标准字级视窗clientHeight固定112、长内容scrollHeight150且overflow-y:auto；收起高度0、aria-hidden=true。自动滚动输入两次未观察到scrollTop变化，后续拖动因UI适配拒绝fractional iframe输入而停止，未将其计为“末项实际滚动已验证”，也未用脚本修改浏览器滚动状态绕过。此轮没有修改/安装应用，设计中的末项与大字原生可达性仍待后续实际实现验证。

用户补充“筛选也放在展开内容里面”。本次仅调整同一预览：范围、类型置于展开区进度之前，共用一个固定高度的纵向滚动视窗；收起只保留搜索栏、结果数量与展开按钮。筛选选项自然换行、字号随倍率变化，去掉筛选行自身的裁切与重复左右内距。展开视窗的尺寸由字级预算决定（标准212px，最高300px），不随进度文案或选项换行增长；本轮没有修改生产源码或安装应用。

本次预览脚本解析PASS；浏览器开合核对PASS：展开区域包含两组筛选，标准字级clientHeight212、scrollHeight256、overflow-y:auto，选项容器flex-wrap:wrap；收起后筛选与进度一起从无障碍树移除，shell高度0、aria-hidden=true。截图已确认标准宽度布局；320px/2倍字与实际末项滚动未新增执行，不计为本轮实测PASS。

### 搜索全状态重新设计预览

用户指出上一版遗漏搜索中状态，要求先梳理，随后授权重画更美观的demo。新增独立预览`search-states-demo.html`，生产源码不变：常驻两行结果数/状态摘要，展开区按进度→原来源/类型筛选→异常详情排列，取消内嵌深色卡片、大圆筛选；覆盖已有结果搜索中、首本前、完成、部分失败、停止、无结果、失败、搜索前及320px/1.6倍字场景。所有场景沿用相同框架，标准展开视窗176px，字级变化时统一调整；具体尺寸仍为待评审设计参数。

必要验证仅此单片段Node脚本解析与本地浏览器视觉/交互，无其他测试或构建。准备阶段发现sandbox环境中form提交未触发停止回调，改为普通按钮的显式本地事件；停止后实测状态为“已停止”、4条示例结果保留，列表起点378.09px与停止前一致。首本前显示搜索中与准备阶段、不显示0/0或无结果结论；场景选择器可用。窄屏场景实测clientWidth319、倍率1.6，展开clientHeight265/scrollHeight367、无横向溢出，选项自然换行、点击槽约44px。截图核对夜间标准与窄屏布局；日间、2倍字、原生触摸及真实网络搜索未计为实测通过。仅设计预览，不修改/安装应用，不代表原生或用户验收。

用户随后指出“没有一个清晰的边界”。本次只改同一预览的边界：摘要和展开内容共用完整轻边框、14px圆角及独立明度底色，外侧18px留白、与列表间12px，框内文字/按钮16px留白、滚动条离框约6px；展开时摘要底部显示内分隔线，折叠保留同一外壳。去掉重试按钮负margin，避免有效区域越过所在行；窄屏摘要精简为“N本”以保留展开按钮空间。Node脚本解析PASS；浏览器日间展开/折叠截图核对，外框与页面背景为不同颜色、列表间距12px；320px/1.6倍字实测toggle在框内、无横向溢出、纵向内容421px在265px视窗内滚动。未新增生产修改、业务检查或设备验收；2倍字与夜间新边界未计为本轮实测通过。

用户对该圆角外框版本明确评价“很丑”，不能视为设计接受。另建`search-refined-demo.html`保留比较：齐边分区用全宽浅底及底边界，轻量工具栏用横向摘要、小圆角轮廓和文字选中底线；去除重复的书源进度标题，已知完成数统一放在摘要状态中。标准摘要64px、展开142px，保持所有业务状态使用同一结构；搜索前/首本前/流式/结束/失败等由预览设计控件选择，未改任何生产实现。

必要验证仍限单片段脚本解析和本地浏览器。脚本解析PASS；日间两布局截图、折叠与停止交互已核对，展开控制区约207.1px，停止后4条示例结果保留且区域高度不变。后续补充结束态摘要计数及窄屏字级高度预算通过脚本解析，未追加浏览器大字或夜间实测；Tweak跨状态切换、真实搜索和原生行为未计为本轮通过。该稿仍待用户评审。

### 用户指定参考现有 RSS 与订阅展开

用户再次否定两种新设计，要求查看“RSS和订阅的下拉展开”。已只读定位当前代码：`RssPage.subscriptionSection/filterExpand`为独立筛选触发行（筛选图标/文字＋当前值/箭头，8vp圆角、独立边框），下面在页面流中插入另一8vp圆角内容框；筛选项使用`rss-filter`既有主色胶囊，选后保持展开。`RssSubscriptionManagementPage.subscriptionList/subscriptionItem/actionBar`为整组8vp圆角外框，保留56vp主行，右44vp箭头槽旋转180度，下方插入带顶分隔线的44vp操作区。`RulesManagementPage`的规则订阅表单始终展开，不作为此参考；`SourceManagementPage`覆盖式分组菜单也不混用。

仅在新预览`search-rss-style-demo.html`沿用RSS触发行和独立展开框：数量/搜索中状态常驻框外，筛选整行可点、右侧保留当前来源/类型与箭头，进度和原两组筛选在展开框内，选后不收起；展开视窗标准160px，字级变化时统一调整。色值按当前RSS角色与公共ThemeRegistry投影，不另创两种布局。必要检查仅此片段的Node脚本解析及本地浏览器开合/筛选/边界核对，无业务套件、SDK、构建、安装或设备动作；未将源码还原预览当作原生截图或用户验收。

本次脚本解析PASS；日间浏览器截图核对触发行/展开框均8px圆角、触发槽约44px（示意使用真实44px边框槽，不复制源码34px视觉框外扩响应区），展开内容约160px、无横向溢出。点本地后当前值变为“本地·全部类型”、选中状态更新且仍展开；再次点击整行后展开内容退出无障碍树，当前值、数量及搜索中状态保留。未执行夜间/大字/真实搜索/原生设备验证，仍待用户评审。

### 用户撤销展开收起，恢复原筛选与进度常驻

用户明确要求不再做展开收起，保持当前“找到***本”和“搜索中”，把应用原本的筛选条与进度放在下面。此前展开方案不再作为实施方向。仅更新独立预览`search-inline-demo.html`：原摘要样式保持，下面依次为来源（全部/本地/在线）、内容类型（全部类型/小说/漫画）、原文字进度、书籍列表；取消触发行、箭头、独立展开框及所有开合状态。筛选恢复原小胶囊的纸色细边框/实色选中与单行横向滚动。已确认当前SearchPage没有线性Progress组件，原“进度”是resultStats文字，因此删除demo自创横线，不把它说成原应用样式。进度保留按字号计算的两行固定文本槽，超长事实内部纵滚，避免再次靠截断或异步增高移动列表。

本轮必要检查仍只有单片段Node语法与本地浏览器核对，均完成：无aria-expanded/开合控件，摘要仍“找到128本／搜索中”，两组原标签和选项常驻，进度为“正在搜索76/120个书源，已返回128个”。停止后筛选仍可见、4条示例结果保留、列表起点309.51px不变，进度槽48px。仅日间标准字级预览证据；其他字级/夜间/实际网络和原生行为未验收。未改生产或安装应用。

用户再次指出常驻稿“完全看不见边界”。此次局部修正范围仅为摘要下方的两组筛选与文字进度：共用一层明确不透明轮廓、分层底色和12px横向内距，进度前加内分隔线；摘要不纳入外框，不恢复开合或新布局。只通过同一预览的本地浏览器核对外框/留白/内容是否在框内，不增加业务、SDK、构建或设备检查。

日间标准字级截图已核对：外框为不透明`#9C9385`实线、内容底为`#FEFBF7`、8px圆角；两筛选行及进度的实际边界均在外框内，摘要在框外、无aria-expanded。轮廓CSS1.5px，当前浏览器栅格化回读约1.11px；JS未改，不重复既有脚本解析或交互检查。夜间/大字/原生效果及用户接受仍未验收。

### 用户否定外框补丁，要求整体重画

用户明确评价多次修改都难看并要求重画，以上外框稿不计为接受。新预览`search-clean-redraw.html`保留既定顺序、字段与常驻筛选，重新处理字体层级/点击槽/间距：顶部工具区共用完整底色，搜索框与停止按钮统一12px圆角，筛选标签12px/选项14px，选中实底、未选柔和底色，取消大外框和每个选项的描边。工具区底部用8px横向层差与列表划界；无展开收起，不改应用源码或交互业务。

必要验证仅新片段Node解析及浏览器视觉/局部交互。解析PASS，日间390px与夜间320px/2倍字（部分失败）截图已核对；夜间无页面横向溢出、原选项横滚保留、进度84px视窗承载284px详情。首次摘要边界布尔读取false，经完整坐标核对仅右边界约0.000008px浮点差，内容与状态实际未相交，也未据此修改实现或扩大检查。标准态停止前后列表起点均331.08px、4条示例结果保留。大字检查通过临时默认值生成本地包装快照，随后恢复正式默认值；前后源文件SHA256同为`33fca16314eaf00c358f14fc1c6717b9948ec64b713acea52c2c81dacdf53ac9`。内部末项滚动、真实网络与原生设备未验证，不把浏览器排版视为用户视觉接受。

### 用户否定空间、排版与颜色边界，压紧原有结构

用户指出上一稿空间空、排版不对、颜色和边框违和；该稿撤回，不能作为接受的设计。代码侧定位预览参数为摘要46px、两行筛选各48px、进度48px，再叠加尾部留白、8px色带及列表首行20px，且工具区和正文使用不同底色、多种新色值。当前仅按用户要求提供优化demo，不改生产源码或设备。

新增search-compact-demo.html：保留搜索栏、找到数量/搜索中、原来源、原内容类型、原文字进度及列表顺序；统一原paper底色和主题角色，恢复原小胶囊轮廓；摘要34px、筛选按钮独占44px槽、进度按两行18px加4px预算，取消粗色带，使用原边框角色的规则线，列表首行内距14px。没有展开收起、新选项或业务流程。

本轮检查条目预先限定为：(1) Node VM仅解析新片段内script，无嵌套套件，用于排除复制/修改导致预览无法加载；(2) visualize的render.py仅包装此片段并临时本地提供浏览器预览，无构建或业务门禁；(3) 浏览器只检查日间默认排版、停止/筛选、列表起点稳定、窄屏夜间大字布局与长内容可滚动性。必要性是本次交付本身为可交互UI demo，必须确认能渲染且不重现用户报告的遮挡/跳位。未授权或不需要的SDK、全量门禁、打包、签名和设备动作均不执行。

准备检查的两次工具编排因JavaScript参数引号错误未执行，修正调用后重新执行下列局部检查；编排失败不计为预览脚本失败或通过。

本轮结果：单片段script解析PASS（1段，27,280字节）；日间390px浏览器截图核对PASS，顶部实际227.18px，较上一稿269.53px减少约42px，筛选槽各约44px且互不重叠；顶部和正文同为paper色，无横向溢出。停止前后及切换本地/全部筛选时列表起点均288.72px；停止保留4条示例结果，本地筛选为1条，恢复全部为4条。浏览器首屏取图时图标初始化尚未显示，后续DOM和截图确认Lucide图标已渲染，不改为自制SVG。

夜间320px/2倍字/部分失败通过独立QA副本包装检查，正式片段默认值保持390px/1倍/跟随主题/搜索中。夜间无整页横向溢出，摘要两侧间隔43.23px；原选项横向滚动，文字进度76px视窗承载220px内容。一次AX容器滚动调用未改变scrollTop，未计为触摸滚动通过；随后以标准键盘Tab聚焦两条原重试按钮，视窗滚至143.89px（最大约144px），最后一条信息底部368.12px位于视窗底部370.02px以内，确认键盘可达末项。真实触摸滚动、真实网络和原生设备仍未验证；此demo尚未获用户设计接受。

### 用户批准紧凑demo，实施搜索页

用户明确“按这个进行修改”，实施依据为search-compact-demo.html（SHA256 9968b1a5999a8c9fe0618ec7fd2c9c624ecfce44bcd623008e128dc847c43eb9）。当前Harmony HEAD仍33f7c7b21474a76a042ebda911c5f0ff2d73cf54且有既有dirty WIP；本轮保留这些修改，不重置、不扩大到章节或其他页面。

实施仅SearchPage及它独占消费的bookPage输入/search-field/search-scope有限规格：统一paper底、原主题边框，紧凑摘要/筛选/两行进度。loading/results/empty/error从首本前保留同一骨架；首本前仅原搜索中说明，不为凑UI投影虚假0/0或改变operation.value。已存在的列表分组、排序、选择和运行逻辑不在此次排版中调整。进度分支归原搜索专用任务表面，更新消息入口登记；文本正常换行，长信息纵向滚动，重试仍转原回调和权限。

本轮必要检查仅独立compact-search-probe.mjs：Node入口→现有SDK lowering/helper→本次实际生产方法与其ReaderPageScaffold/FixedHeaderHost/ReaderButton/SearchField闭包，显式窗口/几何与空数据源端口；验证首本前后/结束/空/失败/停止的header高度与List inset、旧测量拒绝、完整进度属性、原停止/重试/筛选回调。另对本次四个生产ETS做SDK语法/必要lowering（探针已触达的公共组件不重复）和变更文本空白检查、消息登记JSON解析。这些只证明源码/SDK属性和方法，不等于原生字形、触摸或用户视觉验收。无业务全量、Core测试、HAP构建、签名、安装或设备动作。

### 新增审计：搜索结果持续重排与点击身份风险

用户报告搜索过程中列表快速筛选闪烁，以及目标书在点击时刷新可能打开错误书籍。现阶段为代码审计，尚未复现某次设备误点。已定位：SearchResultProjection每批新组或score/order变化重新排序；可见前6组warmup还经Coordinator→SearchOrchestrator.refreshSharedBooks回读关系和元信息，重选代表源、可能合/拆组并再次排序。DataSource.update就地更新retained.book/variants，SearchResultCard.onClick执行时读取可变group，按下到松开间没有选择快照；List.onTouch仅停滚动恢复，不冻结数据接纳。点击后未入架搜索作品还会走同书候选准入，候选catalogReady/failed排序可切换同书源。后者是另一项策略，不等于已证明打开另一作品，也不作为本次排版顺带修改。

建议独立修复范围：同次查询内已展示组保持稳定顺序、新组追加、结束不自动重排；触摸期间暂缓成员/代表身份变更；TouchDown捕获原sourceId/bookId/searchRequestId/ruleVersion、groupKey、variants副本和封面，onClick提交该快照，Cancel/退役清理并保留键盘路径；新结果采用有界批次接纳，后台warmup仅补数据，不直接让可见行换位。策略及准确回归范围待后续实施决定，不能写成此轮已修复。

排版实施结果：独立compact-search-probe.mjs最终exit0（约0.80s），覆盖320/390/736宽×1/1.3/2/3.2字号的12组输入及7类活动/终态，验证实际生产SDK闭包中的同骨架/inset、初始入口差异、旧entry/window测量拒绝、纵向进度无maxLines/ellipsis、原停止/提交/重试回调。准备阶段3次接线失败保留：两处公共探针端口缺新规格实际使用的ReaderTextStyle类，一处缺刚新增的searchSummaryStacked方法选择；仅本探针绑定生产真实类、补成员名单，未改公共helper或生产来迁就断言。未出现生产断言失败；不把SDK属性记录当原生排版/触摸结果。

源码复核时另发现平板搜索动作按22fp增长，输入按21fp增长；已让搜索栏按两者最大值预算，避免大字边界裁切。极大字级窄屏的摘要按窗口宽度与字级改为上下两行，几何不依赖实时数量/状态；正常字级仍为demo左右摘要。搜索卡片只对齐16vp横内距和14vp上下内距，不改结果身份/业务。五个变更生产/登记文件的定向diff空白检查与登记JSON解析均PASS。HAP构建/签名、安装、设备交互和本次原生视觉验收均NOT_RUN。

本轮来源SHA256：SearchPage=f0a1bd366614b90bc3255efb71d6c02c477b17393fec1aa1ef3629103e7dcdab；ReaderButton=0aa03f6a4cbda9d6a22d0a718f6fbc5b396a63876108cad282f334bcd8a6af3a；ReaderControlSpecs=a8ebf15481d0532dfb203653c1b2481723ae68b1bafcdc23e9f48e2c3b53f993；ReaderSearchField=f3d1bdb8b6080f26f73b7b85d287ca122fe11657a6d07f80e752614b731d5bab；独立probe=45ac44e92d84ab8b54765e9acadc249a11bd77b8af33be6da98e2067a6956acf。

列表审计补充：原网络发布已100ms间隔、最大200ms预算，首本/收尾立即发；refreshSharedBooks的两条present路径绕过该timer，refreshPending/refreshAgain只串行化回读，不限制发布频率。候选最新章节/简介/可换行tags和书架标记条件出现可使行高增长；refreshVisibleResults对任意changedKeys都可能scheduleScrollRestore，恢复先scrollToIndex START、下一帧scrollBy纠偏，因此普通字段补齐也可能产生微跳。建议复用同一查询批次合并网络与元信息patch，保留现有captured identity/sourceVersion/resultGeneration守卫，不另建计时器或直接把present替换成schedule（rawResultsInput快路径可能复用旧结果）；首本、停止、结束立即flush，但单纯补齐不因run已结束而每次直发。滚动恢复仅用于实际结构/几何位移，已测得锚点时布局后一次scrollBy，不重复先跳START。以上仍为审计建议，列表相关生产源码没有实施。

### 用户要求避免列表持续快速闪烁，实施稳定展示

用户追问“能否避免列表的持续快速闪烁”，本轮落实上述具体修复，不改变已接受排版或点击后的同书择源策略。开始时Harmony HEAD已由外部推进到6b1bd7534b61a8ebfac10150fd308eae8430606e；既有dirty内容保留。本轮新增修改范围限定SearchOrchestrator、SearchResultProjection/SearchViewState及SearchPage的列表接纳/交互/锚点/点击身份。

执行前选择的检查：(1) orchestration专用Node生产方法probe，虚拟时钟/gateway端口验证同一timer合并网络+warmup、即时首本/停止/结束、旧身份拒绝与raw输入快路径，必要性为异步patch可能丢失或污染新query；(2) projection专用Node直import生产TS及纯依赖，验证已展示顺序保留、后续新组追加、reset与remove/merge/split/redirect、详情返回保持query序列，必要性为修改排序不能破坏实体完整性；(3) SearchPage专用SDK/生产方法probe，显式postFrame与Scroller几何端口验证触摸延迟接纳、Down→更新→Up→Click身份固定、Cancel/退役/新查询失效、无位移零scroll/有位移单次纠偏/未实现锚点才定位。仅上述入口及其说明的嵌套依赖，不执行旧header探针、其他业务套件、全量、构建或设备。各项失败及最终源码/本地结果分别记录，不能把这些端口证据当设备像素验收。

源码实施：Projection首批沿用相关度，后续仅新组追加，displayedKeys归当前query持有并在reset清理；真实删除/合组/拆组保留原实体及redirect事实。Orchestrator的已核验元信息patch进入run.publicationChanges，与网络结果共用原timer；flush重新核验captured/sourceVersion/request，首本/停止/结束/显式重试即时消费合法待发数据，完成后的元信息不逐条直发。SearchPage触摸/惯性滚动时仅保留最新presentation待接纳，Up/停止滑动后以page/query/flush epoch守卫在事件派发后的frame释放；Card在Down复制当前书籍身份和候选数组，Click消费原快照，Cancel/退役/新query拒旧，触屏无有效Down不得转选最新行；无Down的键盘/辅助点击保持当前可见选择。原点击后的同书择源不改。

滚动恢复改为布局后先读取已实现锚点，偏移大于0.5vp才单次scrollBy；仅实际未实现锚点首次scrollToIndex，后续最多2帧测量。代码复核发现尝试耗尽可能永久scrollRestored=false、停止采集新锚点，已明确在上限结束本次恢复并恢复采集，纳入本项检查。

已完成两项局部结果：projection-probe.mjs的7组生产行为验证exit0；6b1bd753旧Projection负对照在“晚到匹配不插前”的实际顺序断言exit1，非缺成员/依赖错误。Orchestrator生产方法probe的17条回执PASS，并以旧代码复现补齐直发；来源fe2c01200e9fab5f473afddb4b40abcebb4ca5b35761578ee219de24b7582797，结果见tools/evidence/search-stream-stability-20261020/orchestrator-batch-result.json。其准备阶段Node26不支持transform模式，在生产执行前被拒，改用支持的strip模式后通过；未改共享helper或旧断言。四个变更搜索源文件定向diff空白检查PASS。设备/HAP/原生像素/用户验收仍NOT_RUN。

SearchPage专用SDK探针最终7场景PASS（exit0，约0.62s）：触摸中多次publication仅更新进度事实、列表仍保留原2行；Up/Click选中Down时原身份，派发后一次接纳最新3行；惯性滑动后释放、下一次Down使旧释放frame失效；Cancel、组件退役及query reset拒旧点击；metadata无位移零scroll、24vp位移仅一次scrollBy；持续不可测矩形最多3帧/1次index定位，收尾恢复scrollRestored并允许下一次onScrollIndex采集新锚点。两项负对照均在真实行为断言exit1：旧click选中new-book而应a，旧restore在rect未变时调用scrollToIndex(0,false,START)+scrollBy(0,0)而应零调用。准备失败2次（SDK历史ObjectLink别名、真实ObservedObject包装缺失）仅在此probe的原生端口接线修正，未改业务类体、生产或公共helper迁就检查。

最终SearchPage SHA256=33b94b4714b62db09f7e72b238e0e66634902f2456b8973c41ce5bf406733388；Projection=fdba8e64b2cebe7af0fb56eae8088a412022e438f594d9126f96758ce55f6820；ViewState=3f802bea3a25460ae14c712eaca5ffdf32f6151770b10e12b2dac84c7de8b088；本轮list probe=6468ab083e53b7018f86c2ef199223be88b069425937191e9d96eaab423b7497。本轮完成源码与所列局部方法/SDK验证；未构建或安装，没有以端口测试声称真实原生调度、触摸、像素或用户验收完成。

### 用户批注要求将五项与点击后择源一起优化

用户选中此前完整审计及同书择源未处理说明，要求“这几个问题也一起优化”。已实时核对前轮四个搜索源SHA256均未变化，前轮局部结果仍绑定这些输入，不重复原探针。继续保留dirty WIP，本轮补以下具体遗漏。

1. 前景候选不得因其他源已有目录而跳过用户点击的primary；其余候选仍原ready/failed顺序，后台排序/失败跳过/未验证数量预算不变。仅既有canTryAnotherCandidate允许的真实失败才fallback。保留primary已取目录的早呈现，以免全部正文失败时用户丢失已有目录；fallback目录仅在原正文/漫画资源准入通过且current有效后发布，不让未验证候选反复替换详情。书架/换源单源路径不改。
2. Card的条件章节、简介及可换行标签仍可能撑高；为保持现有UI且不制造空白槽或再裁文字，可视Card锁定当前展示元信息（book/sourceCount/inBookshelf），退出可视区后再接纳补齐。封面仍用原固定几何，点击以当前展示身份为准并保留当前候选。query/lifecycle失效不能沿用旧展示。
3. List滚轮/键盘等OTHER_USER_INPUT没有TouchDown，原onScrollStart只对userInteracting置busy，需依原生onWillScroll的用户scrollSource冻结列表，不把SCROLLER程序恢复当用户手势。
4. resultGroupKey的fallback漏传authorIdentity/sourceRuleVersion，而Projection/DataSource均传；合法作者归一化可能使同一行Lazy/anchor键漂移。统一同一身份投影。

本轮拟选必要验证（执行前）：新增候选策略Node生产方法probe，只以acquireBook/verify异步effect为端口核对primary优先、fallback呈现时机、全失败保primary及后台规则；另准确选择既有H-search-candidate-acquisition的fatal-fallback/environment/deadline/unknown-author四case，分别保护真实Gateway的取消/身份/版本/存储、网络环境、全局预算及作者替换边界，不加载兄弟case/Index SDK。新增Card/key/scroll场景用本地SDK与显式visible/scroll/frame端口，只证明当前可视元信息稳定、离屏/新query接纳、键一致与用户滚动冻结。旧搜索排序relevance及progressive-anchor断言仍基于晚到exact置顶，与用户本轮稳定顺序授权冲突，本轮不运行/不修改为绿。无全量、构建、签名或设备动作。

本轮源码补齐过程中进一步按本机SDK确认maintainVisibleContentPosition只承诺离屏插入/删除，不能据此假设离屏metadata变高一定被平台补偿。因此Card同query离屏换快照还受canRefreshDisplay交互空闲准入，换前onDisplayFactsChange采旧锚点并复用原有单次实际位移检查。仅plain callback在手势结束无后续事实时不能唤醒pending，故父级以displayIdleRevision状态/子级Prop Watch在Touch Up/Cancel或ScrollStop后的下一次UI更新释放离屏待补齐；可见行仍保持原快照，不增轮询、计时器或重复目录。无变化的同一事实引用/书源数/书架标记不重复换State或安排纠偏，避免visibility循环。

Query Prop与ObjectLink可以以不同顺序到达，display快照退役同时核验queryRevision和book.searchRequestId（Gateway本来为该run的local/online统一requestId），避免先到的新revision把旧book误锁成新查询。新增SDK场景须验证实际父绑定的idle释放、busy状态继续冻结、两种prop/link更新顺序、旧visibility/lifecycle回调拒绝及点击当前展示身份。源码主改仅SearchPage和BookAcquisitionCoordinator；前轮batch/Projection/ViewState内容未改，旧结果不重复执行。工作跨越本地2026-10-21，沿原问题记录及证据目录连续记账。

候选策略本轮局部结果：candidate-policy-probe.mjs首跑PASS，15条回执包括primary优先（含旧failed标记）、允许失败后fallback、fallback正文验证后发布、全部正文失败仅保留primary目录、后台原排序/去重/failed跳过/三次未验证预算、catalog-only、回调取消/迟到验证/总预算。两项真实旧源码负对照分别在“ready源抢先”和“fallback目录提前发布”的行为断言失败。四个准确索引case fatal-fallback/environment/deadline/unknown-author全部PASS，子日志仅包含各自case；未运行candidate-budget、Index SDK或其他兄弟项。来源Coordinator SHA256=029a350239eeeaf238e74f9c420bb658d6c29eb7fcbce207c77d0bce44fd1109。只读准备曾查找不存在的历史fixture路径，非测试失败；未改生产/旧测试迁就检查。证据见tools/evidence/search-selection-stability-20261020/candidate-policy-plan.md、candidate-policy-result.json及candidate-gate-results.json。

收尾只对本轮两份生产源码执行git diff --check（准确path，无嵌套检查），用于排除当前增量的空白错误；并计算最终输入SHA256绑定上述局部结果。此文本检查不追加业务/构建门禁，也不代表原生排版与交互验收。

新增Card/key/scroll SDK探针8/8 PASS（exit0）。实际生产SearchPage与实际lowering输入SHA256均为96c6172fc4e24dcb145208dffb58926204a229255746152727ec9308888f300a，未改写生产shorthand。覆盖可视文本/标签与点击displayBook、idle离屏补齐（矩形未变零滚动/真实位移单次scrollBy）、busy离屏等待及无新publication的idle唤醒、新Down拦住待交付idle、Prop/ObjectLink两种查询更新顺序、旧查询/旧挂载可视回调拒绝、有效作者proof的三层键一致和旧proof拒绝、五类用户滚动源与程序SCROLLER/ANIMATION区分。父级唤醒由真实List.Stop修改State，SDK依赖回放经updateStateVarsOfChildByElmtId发出新Prop，再触发子Watch，断言检查实际payload与display结果，没有手动赋idle Prop代替父绑定。

本SDK探针准备阶段5次失败均保留在search-card-visibility-results.json：缺前端ObjectLink metadata导致group缺席、共享helper把既有nonfatal WARN视为硬失败、查询排序fixture遗漏完整group payload、退役后fixture误复用旧可视回调、作者fixture使用不存在的proof规则。只在本探针补齐与真实前端对应的metadata/原生端口，按生产实际DTO修正fixture；最终精确记录并仅允许既有regular-group到ObjectLink-group WARN，其余诊断仍硬失败。曾试等价展开group: group后撤回，最终验证保持原生产源码。未改生产或共享helper迁就断言，这些准备失败未确认生产缺陷。证据见tools/evidence/loading-layout-20261020/search-card-visibility-results.json，probe SHA256=2e83259161084f621f6efe94affe670eadc2397e916886549088824be472926a。

收尾两份生产源定向diff --check PASS。最终Coordinator SHA256=029a350239eeeaf238e74f9c420bb658d6c29eb7fcbce207c77d0bce44fd1109，SearchPage=96c6172fc4e24dcb145208dffb58926204a229255746152727ec9308888f300a；前轮SearchOrchestrator.ets=fe2c01200e9fab5f473afddb4b40abcebb4ca5b35761578ee219de24b7582797、Projection=fdba8e64b2cebe7af0fb56eae8088a412022e438f594d9126f96758ce55f6820、ViewState=3f802bea3a25460ae14c712eaca5ffdf32f6151770b10e12b2dac84c7de8b088均未变。哈希准备输入曾误用Orchestrator.ts后纠正为现有.ets，未据失败输入声称通过。此次完成源码与所列方法/SDK定向验证；HAP构建/签名/安装、原生像素/真实触摸时序、真机行为和用户验收仍NOT_RUN。

### 真机交付构建：现有 BiSheng 数值转换诊断

2026-10-21用户要求安装到真机。Core身份配套已由交付owner处理后，第二次HAP尝试1792513549774-9a6d28f8-dd54-4da2-b3c1-f3d6d3ed0da2在Host现有reader_bookturn_napi的BuildNativeWithNinja失败：bookturn_host.cpp:59的float→size_t及bookturn_napi.cpp中13处double→uint64_t/int32_t触发-Werror,-Wfloat-to-int-overflow。该尝试无成功manifest，不计为构建或安装通过；失败回执保留于.reader-artifacts/hap-attempts/该ID/stages.json及2.log。

代码审计确认跟踪的build-profile.json5明确nativeCompiler=BiSheng（早于本轮搜索修改），Host使用同一default SDK容器的hms/native/BiSheng编译器与openharmony/native/sysroot；Core按相同SDK选器使用openharmony/native/llvm，不构成临时错选SDK。CMake已有-Wall/-Wextra/-Werror，不能切编译器或关闭诊断绕过。此次最小修复仅bookturn_host.cpp与bookturn_napi.cpp：generation先检查有限、整数、0..JS安全整数上限后复用NAPI int64读取，programmatic direction/profile与automatic token按原合法域使用typed int32读取；不改通用GetInt32或翻页状态机。Percentile唯一调用方EmitFrameDiag的数据来自容量512的RecordFrameDiag，实际fraction为0.5/0.95/1；有效域保持原float乘法+0.5F的中间舍入，用标准floor/lround的整数结果替代未证范围的直接浮点转换。无效/溢出数值新增拒绝，不能将其描述为原全部无效输入语义保持。

执行前限定必要验证：(1) issue-local数值probe抽取上述实际生产小helper及Percentile，本机clang只编译并运行局部fixture；NAPI typed读取是明确effect端口，验证合法安全整数与各字段原合法域、NaN/Inf/负值/小数/超过2^53-1的拒绝，以及n=1..512实际分位值和半值临界与旧表达式差分。(2) 用此次失败命令的实际BiSheng、同SDK头文件/target/sysroot及现有-Wall/-Wextra/-Werror，对两份实际TU执行-fsyntax-only，无链接或原生运行，用于确认原14条编译诊断解除。真实编译通过现有Core build-resource-lock.mjs --入口持共享lease，抽取/fixture不另加门禁。收尾仅两份C++的git diff --check及五份搜索源码指纹核对，保护本次修改与先前验证绑定。不会运行既有翻页整套、业务合同、HAP构建、签名、网络或设备；原生行为仍由交付owner另记，不能以该局部probe声称真机翻页验收。

实际局部入口为READER_CONTRACT_TEST_WORKERS=2 node ../Reader-Core/scripts/lib/build-resource-lock.mjs -- node tools/evidence/native-bookturn-numeric-20261021/probe.mjs；嵌套仅本机clang编译临时fixture→运行该fixture→两次当前SDK BiSheng -fsyntax-only。首轮exit0，四项均PASS，未发生需要调整生产或fixture迁就断言的失败。7组数值回执验证了安全generation原合法输入（含0哨兵、2^53-1）、无效generation在typed读取前拒绝、typed失败/负返回拒绝，以及实际StartProgrammatic/StartAutomaticTimeline生产函数原合法域及拒绝域、无效值不调用host effect。Percentile在n=1..512的0/p50/p95/p100和半值上下邻点共3581次与旧生产表达式差分一致；空/超容量/非法fraction按新增诊断防御路径返回0且不选择元素。

两份实际TU的BiSheng语法检查保留-Wall/-Wextra/-Werror及既有unused-command-line-argument豁免，均exit0，没有原float-to-int诊断。每份仍保留工具链既有“--gcc-toolchain参数未使用”warning，没有关闭新warning或改编译器/SDK/CMake。证据为tools/evidence/native-bookturn-numeric-20261021/results.json及其四份日志，probe SHA256=c5f88dd387e55c0d040f020a27f5f71fa04e64ec9821e61e33334b69804b6f25。收尾两份C++定向diff --check PASS；host.cpp SHA256=8cebfd6ec8a6bd99d52e8f12da802b0b2a22d897dc25bae0aa756e0a81d22d60，napi.cpp=815cc677797606087346e76f1ed8846323d8034aef75f0f51a13845856f7897e，五份搜索源码均保持前述验证指纹。

合法输入语义：programmatic generation仍须>0、direction仍仅-1/1、profile仍0/1/2且省略时0；automatic generation仍须>0、token仍1..INT32_MAX整数；其他原generation入口仍允许0交由原Host语义处理。新增拒绝范围仅此前未设安全整数边界的generation/previousGeneration（非数字、NaN/Inf、负数、小数、>2^53-1）以及诊断函数不可能由当前生产调用方产生的超512/非法fraction。此前对负generation钳至0或对小数截断的未定义/无效入口不再沿用；不把该变化写成无效输入完全兼容。未运行翻页整套、HAP重建或设备，真实原生状态机/像素与安装验收仍由后续交付结果分别证明。

### 2026-10-21 用户授权安装到真机

本轮动作是将当前修改作为iteration安装到现场连接的物理机，默认启动并保留应用数据，不包含功能取证或用户验收。已完整阅读当前HAP_BUILD_SYSTEM.md、Host AGENTS、pipeline技能及build/deploy引用、GATE_INDEX任务表。Harmony HEAD=6b1bd7534b61a8ebfac10150fd308eae8430606e（既有dirty UI/脚本WIP均保留），Core HEAD=2a301653c140eef457e786fd6ab3bb9b8e3045c8（仅治理backlog dirty）；五份搜索修复源指纹与上述最后验证输入相同。

执行前必要动作范围：(1)唯一hap-pipeline build --class iteration --signing local --contracts-scope none，嵌套仅当前Core/Native/SDK配套输入、指定证书/Profile和包名、输入快照、隔离OHPM解析、非增量Hvigor编译打包、包内资源/Native字节/签名校验与manifest发布，必要性为当前修复尚无可安装产物，禁止用旧包替代；不运行任何业务合同/主题/全量或实时书源检查。(2)经reader-hdc-lease发现当前HDC列表，再用准确物理目标执行pipeline inspect；嵌套manifest包校验、连接/boot/SceneBoard稳定性、已装包appId/appIdentifier和Profile准入，必要性为防止目标选错或损失更新身份。(3)inspect通过后同manifest/准确物理目标pipeline install，嵌套install -r、安装后身份复核、默认aa start和脱敏部署回执；不卸载、清数据、换签名或操作其它目标。仅安装与启动分层记录，功能/视觉/触摸验收保持OPEN。签名/系统就绪/身份失败停止，不以扩大业务测试或换历史包绕过。

首次build在Native preflight失败，尚未生成可安装manifest：Core build identity does not match the Core worktree used for the manifest；失败回执.reader-artifacts/hap-attempts/1792513275777-03ca71d4-1002-4022-9caa-2e13c4bd7874/stages.json。已代码定位为generate-build-provenance-manifest.mjs比较Core真实gitCommit/gitDirty与已生成identity不一致，不能靠改identity或旧SO绕过。必要补充动作限定现有Core scripts/build-harmony-napi.sh默认入口（资源租约、输入capture、cargo rustc --locked reader-ffi OHOS staticlib、CMake/Ninja NAPI及配套SDK打包/字节证据；host probe/sdk smoke均NOT_RUN），随后Host唯一pipeline sync-native以preflight身份验证后同步当前生成的SDK/SO，再重试同一iteration build。理由仅为此次可安装包的Native输入硬性条件，不修改Core源码、不跑Core业务/协议或其他回归。

HDC初次列表仅有模拟器。通过租约重新连接用户本对话指定的真机地址成功，随后现场列表出现该准确目标；最小只读设备参数确认phone/HUAWEI VYG-AL30（不使用旧地址直接推定已连接或设备身份）。后续仅对该现场确认物理目标执行inspect/install，原模拟器不操作。

Native失败只读复核：producer与当前Core gitCommit均为2a301653c140eef457e786fd6ab3bb9b8e3045c8，差异仅gitDirty=false→true，当前唯一dirty为治理iOS待办记录；1149项实际构建file records与producer完全相同，fingerprint=baef9dcc2dec65ed8866873c527693c553e32d3b46485c894ea3b728c699b12e。Core默认Native入口允许如实记录dirty，runtime build.rs监视包含Git身份的输入snapshot，会通过真实重编译更新嵌入身份；未清理用户待办或手改identity绕过。此次Native再生不代表发生Core业务代码修改或执行了Core测试。

后续实际执行：当前Reader-Core默认Harmony NAPI生产构建PASS（Rust release约2m42s），Host sync-native PASS，新SO SHA256=d854c085824310f03c18e9059c6415ba8a3f00c3255f4d57c0078be8c19032fd；host probe/sdk smoke仍NOT_RUN。用户追问Native仓库归档，已明确此处仅指当前Rust Reader-Core生成的HarmonyOS NAPI动态库，不是归档仓库，没有恢复旧仓库。

第三次HAP尝试1792514117378-bdb25c4b-be45-408b-893c-41c799368d7b已通过Host C++构建，但实际CompileArkTS失败（2.log保留）：SearchPage三个对象spread快照违反arkts-no-spread，Orchestrator两处Map循环解构违反arkts-no-destruct-decls。前轮方法/SDK lowering证据不包含完整ArkTS限制检查，不能将其提升为编译通过。此次必要兼容修复仅将原浅拷贝放到类型明确的纯TS SearchBookSnapshot函数，Page调用该函数；Map循环用entry[0]/entry[1]替代解构，保留发布/身份/计时语义。不开关编译限制，不改列表设计。

执行前限定回归：(1)原issue-local orchestrator-batch-probe单入口，仅实际Orchestrator+ReaderOperationFacts、旧源码负对照文本、VM与虚拟gateway/timer端口，17回执覆盖本次更改的refreshBooks fallback及pending flush两处迭代和其captured/stop/query/close守卫，无兄弟套件/SDK/构建/网络。(2)原search-card-visibility-probe的8个新增SDK场景，注入新的实际纯TS浅拷贝函数，保护本次改写的展示/点击快照仍与可变书籍对象分离及原idle/query传递；只改此独立探针依赖，不改共享helper，不补跑旧header/旧7组/其他套件。(3)上述变更源定向空白与SHA绑定；成功后仍由唯一pipeline实际完整ArkTS编译决定能否生成HAP。理由是已发现的具体编译兼容改写需要确认原异步/身份行为未改变，不因失败扩大业务门禁。

兼容改写局部结果：Orchestrator单入口17回执全部PASS，无新增准备/断言失败；只反向还原两处循环即可精确回到前轮原hash，确认没有其他语义改动，新hash=c6d6b9689e95e922520097eea9d934a1d8a0e5c801d79d94a7a30edf9a634029。Card原8个新增SDK场景一次执行8/8 PASS，实际注入纯TS浅拷贝函数，原源码与实际lowering指纹一致；新结果独立保存在tools/evidence/loading-layout-20261020/search-card-visibility-results-20261021-snapshot-helper.json，旧结果保留，无新增准备失败/其他probe执行。最终Page=1a26ccb63a3c1d57d18d2f159c831278ed1eb0df12e892b88f5c3a8ae75e2cfe，SearchBookSnapshot.ts=99f3b3d23355b7bbdc473480d67c27f14d4986a62acb79df9272b17f9b1a386f，probe=cb7a89f9f91a3ff3844066992cde564049507252ba6d190e5477067fb0872e94。两份变更既有搜索源定向diff空白PASS。当前仅方法/SDK层通过，下一次完整ArkTS/HAP结果与设备仍待实际执行。

最终交付结果（本地2026-10-21）：第四次唯一pipeline构建PASS，完整ArkTS编译、非增量Hvigor打包、指定证书/Debug Profile验签及包内资源/Native配套校验通过；runId=20261020T164125Z-6b1bd753-b8185385，manifest=.reader-artifacts/hap/该runId/manifest.json，signed HAP SHA256=dba42f0ac50e3a1569c80708c07e794db04afedf4b98c1048c8491f766f92e2a，证书指纹匹配用户minliny_HarmonyOS权威3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4。Harmony 6b1bd7534b61a8ebfac10150fd308eae8430606e与Core 2a301653c140eef457e786fd6ab3bb9b8e3045c8均如实记录dirty，未清理WIP。构建输入fingerprint=b8185385250124d90b74a1540809012d44c7d2df612df2e5afe3afad5eebf55a；已读immutable source-snapshot核对Page/Orchestrator/新helper/两份C++均与上列最后验证hash一致。

同manifest signed产物对现场物理目标（脱敏ref=fcd0dc18a65b）inspect PASS：boot completed/SceneBoard稳定、已装io.reader.minliny与Profile appId/appIdentifier匹配、保数据覆盖更新允许。随后pipeline install PASS，安装后身份复核PASS，launch PASS，dataPolicy=preserve；部署回执=.reader-artifacts/hap/20261020T164125Z-6b1bd753-b8185385/deploy-physical-fcd0dc18a65b-20261020T164329Z.json（UTC完成16:43:29，本地00:43:29）。未卸载、清数据、操作模拟器或恢复归档仓库。实际设备功能/像素/触摸时序与用户验收仍OPEN；本轮没有真机功能抓取。业务全量、Core业务测试、主题检查与实时书源检查保持NOT_RUN，不能把构建/安装成功提升为这些层通过。

### 安装后用户反馈：进度两行空间却出现三行，需要局部翻页

用户在上述signed HAP安装后报告“正在搜索、重试、搜索失败”区域排版超出两行，需要在该局部翻页。本条为用户真机反馈与当前源码审计，未追加真机抓取。源码Page仍为1a26ccb63a3c1d57d18d2f159c831278ed1eb0df12e892b88f5c3a8ae75e2cfe：resultStats固定Scroll高4+36*fontScale（默认40vp），但进度一行18vp，每条notice带minHeight44vp重试按钮；一条notice最低66vp，进度两行时84vp，三notice最低154vp，长partial原因/大字还会更高。原获批compact demo同为40px+overflow-y:auto，原probe只验证允许换行/局部滚动，并未证明消息与按钮全部同时可见，不能作为此次无局部翻页的通过证据。

已只读审查header高度/Scroll/notice权限与原探针。保持完整文本、44vp操作、顶部绝对同高且不局部滚动，不能通过简单把40改64/84覆盖所有notice组合。用户此前明确要求顶部稳定，因此异步询问具体布局偏好：推荐保留固定进度，把失败提示/重试放在主内容上方随主滚动；备选为全部留顶部、自然增高并只在实际高度变化时保持书籍锚点。两者分别涉及主列表首项索引/交互冻结适配或头部自然测量/迟到回执守卫；待用户选定后再实施，避免自行改变既定布局。尚未修改生产源码、未执行新检查/构建/设备动作。

### 用户选定固定顶部、提示随主内容滚动，实施宿主调整

用户明确选择推荐方案。仅修改SearchPage与消息入口登记：resultStats只保留真实进度，不再承载失败/重试或局部Scroll；“已返回”与上方找到数量重复，移除进度句中的重复数量，顶部找到数量/搜索中摘要保留。进度高度至少两行，并按当前窗口/字号用原生MeasureUtils对完整安全计数模板一次测量、缓存预算，不随实时进度或notice变高；失败时使用保守初始预算，首次有效预算同样冻结到当前布局key，测量稍后恢复不再使同一布局跳高。显式fp/vp单位与当前SDK MeasureOptions一致。

results的List第0项始终为提示宿主，无notice时无文字/垂直padding/边框高度，三类提示自然换行、沿原ReaderButton保留44vp操作槽；筛选空态移到同一List的条件ListItem，避免Stack层与提示重叠。所有书籍与native索引分别保持bookIndex与bookIndex+1，Lazy DataSource内部通知索引不变；只提示可见时warmup为空，顶部/提示区域保留offset而不选邻书隐藏提示。empty/error将相同详情移入原主Scroll第一项，保留原页态/建议/终态动作，删除重复长partial按钮/重复详情消息。未创建新消息外框或开合控件。

提示为原任务事实的视图快照，复用列表按住/用户滚动期间的延期接纳；空闲后只接纳最新事实、换前保存原几何，仅真实位移时单次补偿。顶部进度/状态仍读live事实。重试回调核验page/query/operation generation和当前notice，partial/failed继续由retryOperation复核canRetry，skipped保留原onRetry。页面退场清快照，不操作原任务。登记新增DEDICATED-SEARCH-SESSION-NOTICES，原进度登记改为固定顶部专用进度。

执行前必要验证限定：(1)新增唯一issue-local入口tools/evidence/loading-layout-20261020/search-main-notices-probe.mjs，嵌套当前Page选定生产方法/Builder的实际SDK lowering、真实Publication/ViewState/Projection/Group/DataSource、SDK属性runtime及真实ReaderButton规格/build/commit，Card只作为Lazy闭包依赖，不执行旧8/7/header场景。原生端口明确为List首项/事件、getItemRect/scrollBy/scrollToIndex/currentOffset、帧队列、测量结果和Scroll/Column/Text属性记录；覆盖宿主/自然高度属性、320/390与字号1/2/3.2的固定进度测量预算、prefix映射/warmup/锚点、交互冻结/一次补偿及旧代回调/三类权限，必要性为本轮移动宿主新增索引、几何与动作生命周期风险；不能声称原生像素/文字实际高度验收。(2)仅两份变更文件定向diff空白、登记JSON解析和最终hash绑定，确保此次源/登记可编译解析；不运行全量message checker。(3)局部结果通过后依当前唯一HAP pipeline重新signed iteration构建、manifest preflight与现场确认物理目标保数据安装/默认启动；仅构建所需Core/Native/SDK配套、ArkTS、资源和签名、目标身份/系统就绪条件，不重复业务测试或操作VM，不做真机功能抓取。此为继续当前已授权真机交付，实际包/安装/功能/用户验收分层记录。

局部验证新增发现及修复：原生测量首次失败后未缓存保守预算，同布局下一次测量成功仍可改变顶部高度；已让首次有效fallback预算走共同缓存，同key不再重测。真实SDK lowering还证明ReaderButton的regular onAction不随Prop更新：新operation generation空闲接纳后虽重新enabled，仍调用旧代guard，导致点击无效。仅在该重试动作周围增加按page/query/displayed operation generation/kind的单元素ForEach身份；新代重建按钮，旧回调仍拒绝，新权限同代继续更新Prop，不改公共ReaderButton。生产Page修复指纹f4d4b2776d73908b1f894bb91702d2f615c73cebd6fa31d78d697296e7f5416f。probe准备阶段因未实现ListItem deferred callback及SDK If节点记录顺序而失败的尝试与真实旧回调失败分别保留，不能混为产品通过。登记冻结措辞限定results List，empty/error读取终态事实。静态审阅曾声称进度仍含“已返回”，但当前源码已移除该重复文案，因此该项不是当前缺陷。

构建输入现场发生并行提交漂移：Core现为fe2b4e7524cda6bc0d21f96ea60a7fc6a7dedf58 clean，仅提交iOS/工作区治理文档；现存生成库identity仍为2a301653 dirty，不能将旧库冒充当前提交产物。执行前将必要动作限定为Reader-Core/scripts/build-harmony-napi.sh默认参数（嵌套input snapshot、Rust release、CMake/Ninja、SDK包/字节身份；host probe与SDK smoke均NOT_RUN），随后Host唯一hap-pipeline sync-native同步配套。理由仅为本次HAP直接要求的Core提交/库身份一致；不修改Core源码、不恢复或调用归档Native仓库、不运行Core业务门禁。

Native首次调用在租约准入被当前共享build lock拒绝，未开始编译。只读检查时该lock已由原owner释放且无相关在运行构建进程；未删除或抢占锁。允许按原入口重新取得租约，仍不扩大验证。

本次唯一新probe最终5/5组PASS、exit0，durable回执为tools/evidence/loading-layout-20261020/search-main-notices-results-20261021.json；probe指纹25668a38ddd952b183dbf17075577a487133606d66faf46342056ee15695e46e，准确绑定Page f4d4b2776d73908b1f894bb91702d2f615c73cebd6fa31d78d697296e7f5416f及snapshot helper 99f3b3d23355b7bbdc473480d67c27f14d4986a62acb79df9272b17f9b1a386f。最终attempt07通过；01–03为probe deferred内容未消费、04为native端口未提供，05–06为真实regular callback旧代缺陷，失败均保留。固定测量预算/失败预算缓存、主Scroll宿主属性、prefix索引/空warmup/offset锚点、交互冻结/最新接纳/仅真实位移一次补偿、实际ReaderButton native click新旧代及权限均在本次范围通过。SDK端口不证明字体实际换行/零像素高度/原生旧节点移除或完整List物理布局，HAP/设备交互/用户验收仍分层。仅定向diff空白和登记JSON解析通过；未执行其他套件。

当前Core默认构建与Host sync-native均exit0：Core fe2b4e7524cda6bc0d21f96ea60a7fc6a7dedf58 clean，新SO 1a297018dfa810b507c34adb035cb77669b36f60f8b0fed61e19deddbe6f9019，identity SHA256 34b9d0e81ac97f9665a65035ccc87276df02f35ea0828712db9ac6e62eeb02c5；host probe/SDK smoke均NOT_RUN。Host同步回执.reader-local/native-sync/sync-uiVVTG。所有新probe写入已停止；Page仍f4d4b277…、消息登记f370245cb666ee66b5aa3d1e49aee64af849dd0a6216173828db6b15b1516cd9，准备按上列唯一pipeline作signed iteration，contracts none。

HAP首次调用在共享租约准入拒绝，未编译、无成功产物；失败回执.reader-artifacts/hap-attempts/1792517260210-5f660fe0-8fd7-439f-8d85-3f2676658930/stages.json。只读确认owner为另一个正在执行准确Core case的活进程，等待其正常释放，不终止、不删锁、不运行其case。本轮选中检查仍只有上述新probe。

共享租约正常释放后，唯一pipeline重试成功：run 20261020T172859Z-6b1bd753-632e3b4b，manifest .reader-artifacts/hap/20261020T172859Z-6b1bd753-632e3b4b/manifest.json；signed HAP SHA256 4c02052f3f0556bf9d998141007250a4aea17038fcdec089e3785f017fd74e2a。完整ArkTS、隔离非增量构建、资源/打包字节/Native provenance及签名均PASS；contracts none，Core/Harmony业务套件NOT_RUN。source snapshot确认Page仍f4d4b2776d73908b1f894bb91702d2f615c73cebd6fa31d78d697296e7f5416f，helper仍99f3b3d…，新SO 1a297018…；Harmony 6b1bd7534b61a8ebfac10150fd308eae8430606e dirty，Core fe2b4e7524cda6bc0d21f96ea60a7fc6a7dedf58 clean。签名证书SHA256为指定3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4，Profile debug，io.reader.minliny且身份与现有应用匹配。现有编译WARN保持记录，不计为业务或视觉验收。

本轮现场重新发现当前物理目标，pipeline inspect核验boot/SceneBoard就绪及签名覆盖更新路线后，install执行保数据覆盖安装及默认启动；部署回执 .reader-artifacts/hap/20261020T172859Z-6b1bd753-632e3b4b/deploy-physical-fcd0dc18a65b-20261020T173049Z.json：targetRef fcd0dc18a65b，install PASS、launch PASS、dataPolicy preserve，postInstall应用身份匹配。未卸载、清数据或操作VM，未真机截图/功能抓取。manifest的设备OPEN为构建时不可变基线，本次安装/启动以该部署回执为准；主Scroll实际换行/排版与原生交互、用户验收仍OPEN。

### 用户拒绝信息栏被拆分（2026-10-21）

用户在上述交付后指出“不对，你把一栏拆成了两栏”。此为新用户布局反馈，推翻上次把progress留顶部、notices迁入主内容的结构结果；安装PASS不构成布局获批。源码对照确认原compact demo的progress/notices同处一个rs-progress-block，当前为header resultStats与List/Scroll的mainSearchNotices两个宿主，且新宿主有额外底边线。正在只读确认“一栏”所指同一信息区还是同一水平行；尚未再次修改生产或执行构建/设备，不能因纠正拆分再引入截字、局部翻页、额外按钮或未经用户确认的新结构。

用户澄清为“仍放在同一个信息区，区内可分行”，不是强制所有内容同一水平行；此前固定进度/提示沿主页面滚动的选择仍保留。本轮收敛为视觉边界与间距的最小修正：有notice时移除header在progress末尾的边线，只在notice末尾保留一条底边线；无notice时由header收口。上下两部分统一TOK_PAPER及既有16/20vp内容对齐，notice无新增上留白，底留白从8减至4vp。保留固定progress空间、自然高度完整提示、44vp按钮、正文Scroll/List、三类权限和防误点，不改header高度/索引/生命周期。没有把整个自然高度notice放进不可滚动的固定header，避免长文/大字超过viewport后不可达。

执行前验证限定：本轮为可逆低影响边界/间距调整，不新增或重复业务测试，不重跑此前5组probe（它只证明旧指纹，其旧padding断言不是当前设计要求）。只做SearchPage/消息登记定向diff空白、登记JSON解析与源码指纹，必要性为这两处实际变更的语法/空白身份核对；之后按既有唯一pipeline执行signed iteration、contracts none，实际完整ArkTS/资源/输入配套/指定证书/Profile核验，再现场物理目标inspect与保数据install/default launch。没有其他门禁、Core重建或真机功能抓取的预授权；若构建必要输入出现变化先记录具体错配。

上述定向diff空白、消息JSON解析均通过；Page SHA256 4494f12f156fe74896f50092ff2579757170512488abb0c77bc6cbb578f47067，登记9843be9b3f4b88cd6cd0d6485d6f8da080a68ebb0981bbd11d4342c4c20fde50。现场Harmony提交仍6b1bd753 dirty、Core仍fe2b4e75 clean，无Core源码变更，沿已有当前配套输入构建；局部SDK旧回执不提高到本轮新指纹通过。

本轮signed iteration构建PASS，run 20261021T002742Z-6b1bd753-e00e2996，manifest .reader-artifacts/hap/该run/manifest.json；signed SHA256 14dbd1298e12491115b623457f94f367e818a49792cb8c308d47d3cc797b6d1e。source snapshot与Page 4494f12f…一致，完整ArkTS/非增量构建/资源与包校验PASS，指定证书与debug Profile核验PASS，Core与Harmony业务套件NOT_RUN。HDC现场原物理连接Offline，经过单次exact endpoint tconn返回Connect OK；随后该manifest的physical inspect就绪/身份/保数据路线PASS。install首次调用报spawnSync node ETIMEDOUT，尚不能据此认定已安装或已启动；正在从控制器/已有回执定位阶段，不重复安装、不操作VM或清数据。

代码与已有HDC lease事件定位：install在resolveDeployment的10秒readiness query `param get ohos.boot.time.samgr.ready` 超时，发生在retention-install保护标记写入、hdc install -r之前；该run无部署回执/保护标记，故本次尚未下发安装。最后lease owner pid60551已不存在，未手删锁；没有SceneBoard故障或应用崩溃证据，不能归因Reader。下一步仅通过既有lease入口重新列当前连接；若仍Connected，仅复核一次pipeline inspect系统就绪，复核通过后才可尝试原保数据install；若掉线或就绪再次失败则停止，不重启HDC/手机，不改变超时预算或跳过就绪检查。

最小连接复核显示物理目标Offline，已停止设备动作，没有第二次inspect/install。已向用户说明本轮尚未下发更新，并请求恢复连接或当前连接地址端口；待回复后从现场连接/就绪重新确认继续同manifest，不重复构建或业务检查。代码只读复核确认：有notice时中间接缝消除、同纸色/对齐、仅notice末尾边界；无notice时仅header边界。提示滚出后其末尾边界随内容滚走，固定顶部不额外补一条边线，这是此前固定进度/主内容提示的滚动选择；不声称两个宿主变成同一滚动实体。源码/签名包PASS，物理安装/启动、本轮视觉交互和用户验收仍OPEN。

用户再次明确“安装”后恢复交付（本地2026-10-21 12:29）：仅重新发现连接、单次exact tconn Connect OK，沿既定manifest 20261021T002742Z-6b1bd753-e00e2996执行canonical inspect PASS、install PASS、launch PASS。部署回执.reader-artifacts/hap/该run/deploy-physical-fcd0dc18a65b-20261021T042936Z.json，dataPolicy preserve，postInstall io.reader.minliny的appId/appIdentifier哈希仍与已验签debug Profile一致。signed SHA256仍14dbd1298e12491115b623457f94f367e818a49792cb8c308d47d3cc797b6d1e，指定minliny_HarmonyOS证书核验通过。未卸载、清数据、操作VM或做真机功能抓取；视觉/交互与用户验收仍OPEN。

此为既定签名包的安装，未重建、未重复业务测试。当前Host Page仍4494f12f…、HEAD6b1bd753 dirty；当前Core checkout已另行推进到f1c12c254b70c19b53874486521cc23314a5ec8b clean（iOS需求治理提交），与本包构建时Core fe2b4e75 clean分开记录，不改选包或冒称包含后续提交。候选manifest/source-snapshot的Page/HAP/证书及构建来源经只读审阅匹配，真正包验签、目标就绪及安装身份以本轮pipeline回执为准。

### 搜索顶部面板与单列表结构实施（2026-10-21）

用户批准本线程最终 search-list-header-demo：搜索输入与文字动作合用一层卡片轮廓；卡片第二行左侧是真实书源进度，右侧仅“筛选＋箭头”，删除“全部”摘要和筛选图标；筛选默认收起，展开保留原来源/内容类型选项，选项立即过滤但不重启搜索、不自动收起。此最新选择明确覆盖此前“进度也全部随列表滚动”的中间方案。数量、状态、失败/跳过及重试统一位于主列表第0项，加载、结果、空、失败、停止共用同一List/Scroller；等待首批仅使用面板进度及搜索动作内原生反馈，正文不新增第二套加载面板，撤销全屏底部activity actor。

修改前定位：Host HEAD 6b1bd753 dirty，SearchPage SHA256 4494f12f156fe74896f50092ff2579757170512488abb0c77bc6cbb578f47067。固定顶部仍含常开两行筛选及数量/状态；loading用Blank、results用List、empty/error用Scroll。旧Page的native滚动回调没有固定query/page身份，能够回写新query已重置的共享锚点；空key恢复将带contentStartOffset的List直接scrollTo(0)，不能表达包含完整第0项的语义顶部。这是代码侧可修风险，尚未证明本次手机恰好停在第三四本的实际native事件顺序。

本轮只改SearchPage、SearchViewState、共享搜索输入bookPanel薄变体及这两个搜索文字动作规格，保留现有dirty WIP和搜索/重试业务owner。新query走第0项语义顶部；同query返回及批量更新继续保留锚点；筛选开合保留书籍相对可见区位置，选择条件才回顶。新增入口更新消息登记。

执行前验证范围：唯一新增issue-local入口 tools/evidence/loading-layout-20261020/search-list-header-probe.mjs，嵌套当前Page所需生产方法/Builder实际SDK lowering、Publication/ViewState/Projection/Group/DataSource/Snapshot、实际ReaderButton与SDK属性runtime；显式端口限Scaffold测量回执、List deferred/Lazy节点、Scroller rect/调用、帧队列和原生事件。仅验证本次改变的开合/inset/旧测量拒绝、统一List/第0项信息归属、首批语义顶部、旧query回写拒绝、展开保位、重试及点击身份；不导入旧测试文件、不跑旧8/7/整header或业务全量。旧probe所要求的常开筛选、MAX_SAFE固定进度预算、空prefix零高、empty/error独立Scroll已被用户新设计替代，不作为本轮验收依据。另做所改文件定向diff空白及消息JSON解析；SDK结构/方法证据不冒充HAP、设备像素/动效或用户验收。当前未安排设备操作。

最终新增probe attempt04 exit0、4/4组PASS，回执为 tools/evidence/loading-layout-20261020/search-list-header-attempt-04-20261021.json；Page完整lowered源码SHA256与当前生产一致，均为d62551fb614a6a5bc29a9c25bc37a29fb6ca8d2e675409c67a74baed5cdb46a7，ViewState为8244298b2e08718f63bfba2276036cec9a304ec39d3e42c154c57c10badab0c6。实际SDK/属性与公共控件回调覆盖：390/1、320/2与320/3.2的筛选开合与旧高度回执；五种查询状态同List/Scroller/常驻首项；第0项语义START、开合相对位置与仅真实位移补偿；同值来源无操作、内容类型仍过滤回顶；按下身份、旧页/旧query滚动及IME/筛选/停止回调拒绝写入新owner。前3次失败分别为probe过宽文案匹配、有限native If退役接线、未区分退役前合法warmup清理，原回执保留，不计为生产故障。所有断言只证明上述SDK/显式端口边界；retained ObjectLink regular-property编译WARN原样记录，不声称原生像素/字体/布局/动画/滚动物理或完整native节点生命周期通过。

本轮新增代码审阅还发现并修复：重复点击已选来源曾可将scrollRestored锁为false而没有数据变更触发恢复；现同值早退，类型变更走独立公共reset。旧页的延迟输入/submit曾可能先reset共享ViewState再被Index拒绝；现所有该类写入入口先核验固定page/query身份。定向diff空白与消息登记JSON解析PASS；ReaderSearchField指纹00a1464ebfc667163b03022b497d97ad32dd70758bada03541d4f244b5efa315，ReaderControlSpecs为2b3498a7d3abd2ece30b3d63843af56c4433445ec7677b5204d22605bf085c90，登记为e7d05279660c32a691f56a14a5c0f6ae88a2a0c2fa0b4bb5db01621f9d6c778b。本轮未构建HAP、未安装或操作设备；实际视觉、动效、手机首次结果起点及用户验收仍OPEN。

用户随后明确要求“安装啊”。本轮交付入口限定为canonical hap-pipeline build --class iteration --signing local（contracts none），嵌套隔离输入快照、当前Core/Native/SDK配套、完整ArkTS/Native工程编译、资源/包字节和指定minliny_HarmonyOS证书/Profile校验；这是把刚修改源码打包为可安装产物的直接必要条件，不重跑4组业务probe或任何全量。随后仅按现场发现的此前物理目标执行同manifest inspect（boot/SceneBoard、签名应用身份与覆盖路线）及install/default launch（保数据并生成回执）。当前Core为15e3b971 dirty（两份iOS治理文档），Host仍6b1bd753 dirty；以本次manifest快照为准，不能借用旧包或旧Native身份，不能接触归档Native仓。设备安装启动与视觉/用户验收分层记录，不安排真机功能抓取。

首次canonical build在Core配套身份准入失败，失败回执.reader-artifacts/hap-attempts/1792580783603-5a755e6b-ac87-4f69-9637-dac6d3a7aa9d/stages.json，错误为Core build identity与当前worktree不匹配；没有新HAP。只读定位producer仍fe2b4e75 clean，当前Core为15e3b971 dirty。必要修复限定为在当前Reader-Core执行scripts/build-harmony-napi.sh默认入口：共享lease/input capture、OHOS静态库Cargo构建、CMake/Ninja桥接库、SDK/SO package及snapshot verify/evidence；host probe与SDK smoke均未选，不扩大业务验证、不处理dirty文档。成功后才允许Host sync-native与原iteration重试。HDC最小list显示此前物理endpoint Offline；单次exact tconn返回Connect OK，后续就绪/身份由实际manifest inspect核验，没有操作VM或读取应用内容。

Core首次再生完成Rust release（6m02s）和NAPI链接，但最终snapshot verify因并行任务将Core从15e3b971 dirty推进到4b46df0e clean而拒绝；不能把部分生成的package/evidence作为成功配套。只读差分证明前后构建输入fingerprint均为2c78f40505bf4f64af4be6136db6447c7f82f405e50ceb7f73133420f7c00f50，changed paths为空，仅gitIdentity变化；最新提交为iOS交付文档。由同一当前Core默认入口重新捕获并生成匹配身份，不伪造或手改identity、不回退/删除并行提交，不增加测试。

第二次当前Core默认再生PASS（release 3m51s），input verify与完整package/evidence均完成，Core身份4b46df0e clean；新SO SHA256 e18bba01bc6f201e0a54d0b7b3a07a0df759c0ffdfe2760ec10e8ab7f7095255。host_probe/sdk_smoke保持NOT_RUN。Host canonical sync-native PASS，恢复目录.reader-local/native-sync/sync-JLKg1w；随后只重试原signed iteration、contracts none，仍未开始设备应用操作。

第二次HAP尝试在Hvigor阶段因ENOSPC失败，回执.reader-artifacts/hap-attempts/1792581483935-5541e6f4-4525-465f-ac26-fe2f476cff45/stages.json；2.log也因空间不足未写成功，stage2残留RUNNING不是通过，整次status为FAIL，无新manifest/HAP。流水线按既定10包上限移除了未保护run 20261020T164125Z-6b1bd753-b8185385的431893102 bytes；失败sandbox reader-hap-build-ISItKf已自动删除。当前磁盘仅749MiB可用，现存9个HAP均受恢复保护，prune --keep-runs 5预览拒绝，未删除受保护HAP或改pins。只读发现当前Core target/debug/deps有约7.4GiB可再生调试产物，无正在运行的Cargo/rustc/Hvigor。已向用户请求仅清理该目录再继续安装的确认；未获确认前不删除已有编译产物，不动源码、设备数据或当前release/NAPI产物。

用户明确批准“允许清理这些编译产物并继续安装”。在共享build-resource lease内核对目标为普通目录、无符号链接且realpath精确匹配后，仅清空Reader-Core/target/debug/deps并重建空目录；删除4969个目录项，可用空间由5827911680增至13273067520 bytes，实际增加7445155840 bytes。未触及其他debug目录、release静态库/NAPI package、源码、受保护HAP或手机数据。清理前Core仍4b46df0e clean，无Cargo/rustc/Hvigor在运行；继续原canonical signed iteration（contracts none）及指定物理目标inspect/install/default launch，不扩大检查。

清理后canonical signed iteration构建PASS：runId 20261021T114010Z-6b1bd753-4d835535，manifest .reader-artifacts/hap/20261021T114010Z-6b1bd753-4d835535/manifest.json，signed HAP SHA256 9f82aeaa53c8b3974369b8664f69ae7cc57424148582e7a4a2aceeb26bac6d71。完整ArkTS、隔离非增量构建、必需资源/包内Native字节与provenance、签名校验通过；指定minliny_HarmonyOS证书SHA256为3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4，Profile为debug。Harmony 6b1bd7534b61a8ebfac10150fd308eae8430606e dirty、Core 4b46df0e7a6d1ece0e3f7d2bef89a19a8d96661e clean，包内Core NAPI仍e18bba01bc6f201e0a54d0b7b3a07a0df759c0ffdfe2760ec10e8ab7f7095255。已有编译WARN保留；业务套件与完整验收均NOT_RUN，不重跑已完成的issue-local probe。

本轮重新发现物理目标Connected，未操作同时在线VM。同manifest physical inspect PASS：系统就绪、SceneBoard稳定、已装io.reader.minliny与指定签名Profile的appId/appIdentifier匹配，允许保数据覆盖。canonical install/default launch PASS，部署回执 .reader-artifacts/hap/20261021T114010Z-6b1bd753-4d835535/deploy-physical-fcd0dc18a65b-20261021T114110Z.json；targetRef fcd0dc18a65b，dataPolicy preserve，postInstall身份匹配，完成UTC 2026-10-21T11:41:10.045Z（本地19:41:10）。未卸载或清数据；本轮仅交付安装，实际搜索页像素/动画、滚动/误点场景与用户验收仍OPEN。安装完成后本机可用11823435776 bytes；未扩大清理范围。

安装后只读核对该run的immutable source-snapshot：SearchPage d62551fb…、SearchViewState 8244298b…、ReaderSearchField 00a1464e…、ReaderControlSpecs 2b3498a7…均精确匹配本轮最终实施与已完成局部probe所绑定的完整SHA256，不用文件mtime或旧HAP推断来源。

### 真机反馈：顶部内容高低不齐与筛选箭头方向（2026-10-21）

用户在run 20261021T114010Z-6b1bd753-4d835535安装后报告顶部悬浮栏内容高度不统一、筛选应使用上下展开箭头。代码侧定位：bookPanel原生TextInput使用14/21行盒但未halfLeading，搜索动作13/20（平板14/22）已有halfLeading；进度12/18与筛选13/19.5均未halfLeading。几何容器虽居中，字体/leading度量不一致；busy图形24vp高于动作20vp行盒。rss_filter_chevron的SVG路径M18 12L30 24L18 36本身朝右，0/180旋转实际为左右而非上下。此为用户设备反馈与源码定位，未追加真机抓取；不能从源码直接断言像素偏移量。

本轮修复限定为现有bookPanel输入的对称leading、进度/筛选文本统一对称leading与筛选20fp行高、原生loading图形缩至16vp、同一SVG使用90/270度表示下/上。保留已批准卡片结构、搜索/筛选行的56/44vp分层、自然增高规则、44vp触摸下限、动画、List/锚点/点击身份与业务生命周期。可逆样式修正不新增或重跑业务测试；仅对变更文件执行git diff --check，随后canonical signed iteration（contracts none）实际完整编译/输入与Native配套/资源与签名校验及同manifest现场物理inspect、保数据install/default launch。上述动作分别保护本次样式语法/可打包性、指定签名与当前源码产物身份及准确目标/数据保留；不附带旧probe或全量门禁。实际像素与用户验收仍待交付后确认。

定向diff --check通过；只读独立审阅确认无业务/筛选状态/锚点逻辑变动，现有TextInput相邻变体已使用halfLeading原生API，进度/筛选仍可自然增高。canonical signed iteration PASS：run 20261021T121634Z-6b1bd753-a0fbbaba，manifest .reader-artifacts/hap/20261021T121634Z-6b1bd753-a0fbbaba/manifest.json，signed SHA256 5843ed8865297af373c195683717e5db74fa8002b4a57908d238304cf3500d05，指定minliny_HarmonyOS证书及debug Profile验签PASS。完整ArkTS、隔离非增量构建、资源/Native provenance与包字节PASS；Core/Harmony业务门禁NOT_RUN，已有编译WARN保留。Harmony 6b1bd7534b61a8ebfac10150fd308eae8430606e dirty、Core 4b46df0e7a6d1ece0e3f7d2bef89a19a8d96661e clean、包内NAPI e18bba01bc6f201e0a54d0b7b3a07a0df759c0ffdfe2760ec10e8ab7f7095255。immutable source-snapshot的Page a2bf54d4037a03c369b51e2343b3784ab03d1d49ce9c6559ddedfef981203ed6、field dc8ae26b5bb960ee6af08fec09cca302b3adef6d9c64a3e870417e248826e023均与最终源码一致。

现场物理targetRef fcd0dc18a65b仍Connected，同manifest inspect的boot/SceneBoard、签名身份与保数据更新路线PASS；install/default launch PASS，部署回执 .reader-artifacts/hap/20261021T121634Z-6b1bd753-a0fbbaba/deploy-physical-fcd0dc18a65b-20261021T121744Z.json，dataPolicy preserve、postInstall io.reader.minliny身份与指定Profile一致，完成UTC 2026-10-21T12:17:44.076Z（本地20:17:44）。未卸载、清数据或操作VM，未真机抓取；字体实际居中、箭头动效与用户验收仍OPEN，不能把安装/启动PASS提升为视觉交互通过。

### 齐边搜索面板 demo 实施（2026-10-21）

用户在恢复返回/加载图标常规大小并调整对齐、留白的 `search-aligned-demo.html` 后明确要求“按这个方案修改”。本轮来源为 Harmony HEAD `6b1bd753` 的既有 dirty 工作树；保留全部并行内容，未接触归档 Native 仓。修改前 Page SHA256 为 `a2bf54d4037a03c369b51e2343b3784ab03d1d49ce9c6559ddedfef981203ed6`，ReaderSearchField 为 `dc8ae26b5bb960ee6af08fec09cca302b3adef6d9c64a3e870417e248826e023`。

代码侧确认差异：搜索栏 right6、筛选层 right12；动作宽度依 busy 增删 leading 而变化，筛选仅 min44；顶栏外缩16/20，而第0项与书籍分隔线仍全宽；bookPanel 的清除图形只有14vp点击区；动作字重800，输入14/21与确认版16/24不符；每条失败/跳过提示各有重试，全失败正文另有重新搜索。以上为当前源码定位，不推断设备像素。

实施范围：顶栏与列表共用外16/20、内12边界，常规动作槽72vp并随系统字体增长，两行右对齐，忙闲保留原生LoadingProgress位置；bookPanel输入16/24、清除图形14与独立44vp目标；顶栏52vp基础搜索行、44vp基础进度行、6vp列表间距，摘要自然最小34vp；沿canonical主题新增仅搜索面板使用的不透明底色/中性边界/轻阴影角色。保留单List第0项、筛选开合保位、原生loading、列表批量更新/防误点/可视元信息与query/page守卫。分支失败只保留一个重试入口，跳过仅说明；搜索中禁用重试，全部失败避免重复恢复按钮。业务工作仍归原owner，不把demo模拟计时器或筛选样例搬入生产。

执行前仅选择：

| 实际入口 | 嵌套范围与本次必要依据 |
| --- | --- |
| `node tools/generate-theme-registry.mjs` | 从当前 canonical JSON生成两份App主题及既有selection投影；本轮新增搜索专用角色必须生成可编译的类型/颜色，不运行主题/业务全量。 |
| `node tools/evidence/loading-layout-20261020/search-aligned-controls-probe.mjs` | 新窄SDK/生产方法探针，仅相关Builder与公共按钮/输入、真实重试准入与失效；保护稳定动作槽、44vp清除、单重试及busy/旧代拒绝。原list-header探针无选择器且硬要求3个重试，不为绿修改旧回执或执行其4组。 |
| 所改文件定向 `git diff --check`、消息登记JSON解析及来源指纹 | 仅本轮补丁/登记/生成投影，保护实际编辑的格式及消息生命周期登记，无嵌套业务套件。 |

边界/间距属于可逆样式，结合源码和SDK属性审阅，不新增镜像几何测试。当前未选择HAP构建、签名、安装或设备操作；SDK属性不证明原生字体/像素/动效，设备交互与用户验收继续OPEN。

实施中只读复核还发现：已批准demo对展开选项区设独立高度上限，而原生产Column可被任意多书源分组/大字撑出屏幕，且固定宿主无法滚到后面的选项。按同一demo补原生Scroll，仅包裹展开选项；上限从现有window/safe/keyboard事实扣除固定两行、6vp间距与180vp结果空间，极短窗口保留88vp可滚选项目标。进度与失败提示仍不做局部滚动。所选窄SDK探针同时核对该Scroll准入/上限接线，不扩大至旧列表/交互套件。公共控件探针的纯模块导出仅补两个实际新geometry helper，未改旧断言或公共行为。

当前SDK枚举源码复核发现新增代码误用 `Alignment.CenterEnd`；本机 `ets/component/enums.d.ts` 的原生居中靠右枚举实际为 `Alignment.End`。已在Page及公共Button两处改正，发生于编译/设备之前；不能以Builder lowering不检查枚举名称认定完整ArkTS类型已通过。

本轮于本地2026-10-22完成源码和所选局部验证。最终窄SDK/生产方法probe 6/6组PASS、exit0（0.636s），绑定Page SHA256 `b4d5beef4f6f20515e074d04269dabf6f0e330397f55da992d2696235c49d317`；探针SHA256 `3ed863a97ae1f0bd7a2208794ff1b794bfe46ec65fdb2d0231a7c0d9d124a601`，回执 `tools/evidence/loading-layout-20261020/search-aligned-controls-result.json`。最后复核receipt各源指纹均与当前文件一致。

覆盖实际phone/wide busy/idle在1/1.6/3.2字号下的稳定尺寸、500字重及原生End=5对齐；bookPanel16/24与独立44vp清除、bookPage原14/21未变；partial+failed+skipped/failed+skipped各1重试、skipped0、全失败正文不重复、既有结果身份保留；搜索中/旧page/query/generation/权限或事实失效拒绝动作，终态点击派发1次；实际14vp原生LoadingProgress隐藏/启用；展开选项唯一Scroll与真实安全区/键盘上限接线。窗口790/650/480vp（后两组有键盘）得到457/88/88vp选项上限。未将上述SDK属性或显式原生端口当作真实字体/像素/动画/滚动验收。

全部5次局部尝试保留：首轮5组PASS仅绑定中间源码；随后旧Alignment预期、隐式SDK枚举解析遗漏、header漏选依赖method导致3次准备FAIL；补测试边界后当前最终6组PASS。不改产品规避断言，不覆盖失败历史，不重跑旧4组。公共helper仅导出新生产函数。全部本轮已跟踪源/主题补丁定向空白检查PASS；未跟踪probe以no-index检查exit1且无错误输出，属差异状态；消息/canonical JSON解析PASS。

最终主题生成含6个仅搜索使用的角色：面板不透明底/边/阴影、齐边分隔线、部分失败和失败状态。后两者采用确认demo的暖色与红色，不误用通用消息面底颜色；通用消息family与其他页面色板未修改。canonical SHA256 `4cbdbf8ed34f7894f54d3647667b90a9e18d5f08e24b00860de6794c398b2fd8`，Host主题投影 `aeea7e0727261f768a40a83ab53830eb0a74273e1b50f8118830c8e02fa0a7ef`，消息登记 `c18f56bb0dec4e2ae7b8e380e17cf973030a44a98502838d2497c82cd5496050`。既有dirty主题/其他模块内容保留。

本次未构建、签名、安装或操作设备；当前手机上的旧HAP不包含此新源码。工程完整编译、原生视觉/交互及用户验收均未执行，不能借前次安装或本次demo/SDK结果标记通过。

### 齐边搜索页真机开发更新（2026-10-22）

用户随后明确要求“安装”，沿此前指定物理目标，采用当前源码的signed iteration并保留数据。本轮所选入口仅：canonical `hap-pipeline.mjs build --class iteration --signing local --contracts-scope none`（隔离输入、Core/Native/SDK配套、官方依赖、完整ArkTS/Native工程编译、资源/包字节与指定证书/Profile）；本次manifest的`verify`；现场HDC共享lease下精确目标发现及同manifest `inspect`（boot/SceneBoard、已装身份/覆盖路线）→`install`默认启动（保数据、安装后身份与部署回执）。这些均为本次打包安装的直接必要条件，不重复6组局部probe或业务/完整门禁，不操作VM或真机功能取证。当前Harmony `6b1bd753` dirty、Core `9131ddcf` clean，最终来源以manifest为准；约120GiB可用，无需清理。

首次canonical build在Core输入身份准入FAIL，失败回执 `.reader-artifacts/hap-attempts/1792598718987-1a89eeed-b7ae-4a9e-9bf6-77fa6a7927bd/stages.json`；当前producer identity仍4b46df0e clean，而Core已9131ddcf clean，不能以SO字节相同豁免。必要修复选当前Reader-Core的 `bash scripts/build-harmony-napi.sh` 默认入口（共享build lease、当前输入快照、OHOS release静态库及NAPI、SDK package/身份和snapshot verify），不传host-probe/sdk-smoke；成功后Host `hap-pipeline.mjs sync-native`，再重试原构建。不改identity、回退当前Core、使用归档Native或附带业务测试。HDC最小发现原物理endpoint Offline，单次同endpoint tconn已Connect OK，稍后由实际manifest inspect重新核验就绪/身份。

Core再生在用户追加任务期间完成，exit0：release编译5m16s，新SO `1579e0e2c66bd62c8492d3803bd54aca539f78b9b33adc9c8ec238a4aa2e8422`，producer/package/identity/snapshot/evidence一致，绑定9131ddcf clean；host_probe/sdk_smoke均NOT_RUN。尚未sync-native或下发设备更新。用户追加书架更多“检查更新”忙态与全通知框架审计，先完成这一UI补充，再将同一当前源码一起打包安装，原安装请求继续保留。

### 书架更多检查更新执行态（2026-10-22）

用户要求执行中固定显示“检查更新中”、不显示进度、点击后不直接关闭菜单、图标动态。代码侧定位：BookshelfMoreMenu.actionLabel展示done/total；update与导航动作共用commitAction触发收起，BookshelfShell.requestCheckUpdates又主动dismiss，两层都会导致菜单离开；ReaderActionMenuSurface只渲染静态Image。当前更新任务仍由原CatalogOwner持有manual/automatic状态、并发及生命周期。

修复限定：菜单中manual/automatic忙态统一文案；仅检查更新动作保留当前菜单，用户点外部或其它导航动作仍沿原关闭语义；公共菜单action增加默认false的busy投影，在原图标槽使用原生LoadingProgress，前台/减少动态效果控制动画，忙态保持可见但拒绝再次派发。进度事实仍留原业务owner，不为去掉UI计数改业务任务。

执行前选择唯一新增 `tools/evidence/loading-layout-20261020/bookshelf-update-menu-probe.mjs`：只用当前生产Menu/Shell选定方法和实际公共Menu Builder/SDK验证不自动dismiss、busy/idle文案和禁重复、原生动态槽及foreground/reduceMotion、其它导航仍关闭；不跑旧全量manual-update/shell套件，不改其历史断言。另做本轮变更文件定向格式与登记JSON解析。此检查保护本次改变的触发/关闭/忙态接线，不声称设备视觉。后续沿前段已选唯一pipeline打包安装，不附带其他门禁。

菜单窄探针最终5/5组PASS、exit0（0.796s）：更新派发后Menu/面板高/子actor保持；manual/automatic固定“检查更新中”、无计数、忙态禁重复；无在线目标、mounted/close/selection身份退役拒绝旧点击；其余四个导航仍单次收起；24vp原生LoadingProgress保留原图标槽和50vp行高，前台/减少动态效果控制动画，文字不因busy变淡。回执 `tools/evidence/loading-layout-20261020/bookshelf-update-menu-result.json` 保留两次准备FAIL（SDK观测符号初始化缺失、漏选Surface.build），仅补新probe接线，不改生产迁就测试。最后source binding MATCH：Menu `ab65354060b03d28221a8ee8ef940218d73fb13b179b7fb1f16432b08f150c7a`、Shell `be1adde47ec667ef3f02f22e64da053a27fbcabaa35bf016c7610f2d39460da3`、Surface `5b913b984de622fb6fe9d47537c8b705d5957ab4012332f9464d0647da6f5ad6`；probe `7bb63fc219d41d761d7dc8c370d522eae239c9d516f3c773ea641b1f8724f0d9`。本轮定向diff与登记JSON通过；未跟踪probe no-index空白检查exit1无错误，为差异状态。

用户追问普通Toast为何未用确认外观，并明确要求额外子agent全通知审计。独立只读定位确认：CatalogOwner终态→Index.applyBookshelfCatalogSnapshot→ReaderTransientFeedback.show→裸系统showToast；确认的transient-feedback-demo主题胶囊仅在SourceSwitchCompletionOverlay落地。FRAMEWORK/integration后来明文采用系统Toast，构成公共展示规范与确认稿不一致；不能把“经过统一入口”说成“已还原确认外观”。本轮菜单修改不另造书架专属Toast，通用短反馈保持现状，审计另列全部同类缺口及最小统一修复方案，不以此次安装声明Toast已修复。

Core规范sync-native已PASS，恢复副本 `.reader-local/native-sync/sync-efu1bU`；新SO仍1579e0e2…。当前开始上述搜索+菜单同包signed iteration（contracts none）。流水线按既定10包策略移除未保护旧run 20261021T002742Z-6b1bd753-e00e2996的431920070 bytes，非额外磁盘清理；旧部署记录仍保留。

本次HAP尝试的完整ArkTS/Native工程编译与签名完成（Hvigor 1m15s116ms、stage2 PASS），但发布前Git身份护栏FAIL：`.reader-artifacts/hap-attempts/1792599534468-360f52f5-01ae-43f4-bc0f-cccb35a1cedd/stages.json`。根任务把通知审计报告生成与打包并行，唯一git status差异为新增 `?? docs/message-ui/notification-framework-audit-20261022.md`，HEAD未变、无移除路径。不能以编译成功复用未发布包或绕过status保护。报告现已完成并冻结；在当前稳定现场重试同一canonical构建，不删除报告、不改忽略、不增加门禁。此前尝试保留FAIL，无manifest、未下发设备更新。报告125登记/13例外/6保留范围及12项发现是源码审计，不是额外业务测试或设备验收。

稳定现场重新canonical signed iteration构建及离线verify均PASS，runId `20261021T162303Z-6b1bd753-5e3c70e8`；immutable manifest `.reader-artifacts/hap/20261021T162303Z-6b1bd753-5e3c70e8/manifest.json`。signed HAP 216837153 bytes，SHA256 `93a0b6cf17611bfddc66224b43d2f8c008acaf495e22a3d3487a2dcbd3458d0b`；指定minliny_HarmonyOS证书及debug Profile验签PASS。来源Harmony `6b1bd7534b61a8ebfac10150fd308eae8430606e` dirty、Core `9131ddcfeef1922620c6867f88fe82608e51a079` clean，输入fingerprint `5e3c70e8666f7f70300d31bb6ee6dae181b0084501b398d21e6b6bca30e72b11`。Page/Menu/Shell/Surface四文件snapshot与本轮最终源码精确匹配；Native输入1579e0e2…经规范strip输出958e624b…，转换provenance与包内记录一致。实际完整ArkTS/Native编译、资源/字节与签名校验PASS，已有WARN保留；业务/完整门禁和Core probe/smoke均NOT_RUN。

现场重新发现此前指定物理目标Connected，同manifest inspect就绪/SceneBoard、已装应用身份与保数据覆盖路线PASS；canonical install与默认launch均PASS，部署回执 `.reader-artifacts/hap/20261021T162303Z-6b1bd753-5e3c70e8/deploy-physical-fcd0dc18a65b-20261021T162506Z.json`，targetRef `fcd0dc18a65b`、dataPolicy preserve、pre/post io.reader.minliny身份匹配。完成于本地2026-10-22 00:25:06（UTC 2026-10-21T16:25:06.246Z）。未卸载、清数据、操作VM或做真机功能取证；真实页面/动画/任务交互与用户验收继续OPEN。此包包含齐边搜索页及书架检查更新菜单执行态；普通Toast及全通知审计所列其他问题尚未修改，不得宣称已在本包修复。
