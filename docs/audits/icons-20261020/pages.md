# 页面交互图标与显示图标审计（2026-10-20）

本表只读核对当前源码、SVG 和主题表。未修改产品、未运行门禁、未构建或操作设备。基线为 `codex/message-ui-unification-20261019` / HEAD `5a01ec1cdbd5ec864046e1b9202963ead23a513a` 上的既有 dirty WIP；HEAD 不能代表全部本地内容。源代码结论不等同当前 HAP 像素或原生交互验收。

## 范围与判定方法

本分册负责 `features/bookshelf`、`downloads`、`search`、`settings`、`source`（排除 SourceSwitch 家族、CandidateRow、LatencyBar）、`discover`、`rss`、`sync`，以及 `ReaderStartupRecovery`、`ArkWebExecutionHost`。既看直接 `Image`，也沿 `ReaderIconButton`、`ReaderActionMenuSurface`、`CategoryRow`、`ReaderLabeledIconAction`、`PageBackBar`、搜索框、选择控件、恢复组件追到实际渲染责任。

页面目录内共 49 个 ETS 文件，19 个直接引用 media 资源，242 处 media 引用、193 个唯一资源名（含夜间资源）、99 个不带 `_theme_` 的资源名。该数字是本分册文本资源盘点口径，包含未调用方法；不是“193 个用户可见图标”，也不包含公共组件内部资源、远程封面或全部跨平台图标。

当前可见入口以 [导航对照](../../architecture/interaction-wiring-20261019/navigation-comparison.md) 和 `ReaderProductScope.ts:17–30` 为准：全应用 11 个有可见入口路由；本分册覆盖其中 bookshelf、bookshelfMultiSelect、bookshelfSettings、settings、source、sourceTools、search、downloads、detail、directory，reading 由阅读分册负责。`bookshelfManagement`、独立 `rulesManagement` 是另 2 个无当前可见入口的保留分支。Discover、RSS 的 5 个路由和 Sync 共 7 个 l0 关闭路由另列，不以其缺口阻断当前页面，也不擅自开放。

判定分开记：**确定不一致**表示相同容器、相同语义层级已有不同颜色/几何/主题来源；**规则缺口**表示代码确实不同，但现有文档没有定义必须统一成哪个目标；**合理差异**表示状态或背景语义明确需要差异；**待原生确认**表示代码不足以证明实际绘制/可访问性结果。

## 1. 下载入口为什么不同色

| 入口与实际调用链 | 日间 / 夜间 SVG 颜色 | 几何与公共层实际行为 | 结论 |
| --- | --- | --- | --- |
| 书架 More → `BookshelfMoreMenu.ets:150–182` → `ReaderMenuActionView` → `ReaderActionMenuSurface.ets:78–84` | 下载 `#756F69 / #ABA99F`；批量、本地导入、设置 `#1F1B17 / #EADFCE`；检查更新 `#2D4A3E / #D2BD96` | More spec `ReaderSurfaceSpecs.ets:412–423` 全部显示 24vp；下载 SVG 24 viewBox / stroke 2；批量、本地导入、设置 24 viewBox / stroke 1.75；检查更新 48 viewBox / stroke 3.5，换算到 24vp 也是 1.75。menu 分支只应用透明度，**没有重着色或图标色语义参数**。 | **PAGE-01 确定不一致**：下载借用了下载列表的次级灰，带入普通菜单；并比兄弟线宽厚约 14%。接入同一框架并没有统一图标颜色。检查更新为绿色也是此菜单原有独立分支，需一起明确普通动作色。 |
| 设置 → `SettingsPage.ets:193–201` → `navRow:394` → `CategoryRow.ets:28–36` | 下载 `reader_directory_marker_download` 为 `#5B5046 / #BAAD9C`；通用设置、书源、书架设置 `settings_row_*` 为 `#2D4A3E / #D2BD96` | 全部 leading 15vp，28vp 圆底 `TOK_SETTING_ICON_BG`；SVG 都 48 viewBox / stroke 3.5，实际约 1.094vp。CategoryRow 不重着色。 | **PAGE-02 确定不一致**：复用的是阅读目录“下载标记”颜色，不是设置导航的语义色。同圆底、同尺寸仍异色；不是背景或 disabled 导致。 |
| 下载页内部 `SharedDownloadPage.ets:559–582,1527–1553` | 未开始下载灰；暂停/继续/完成绿；失败重试红；普通导航墨色 | 14vp 状态图标、18vp More/关闭/存储、16vp 搜索、13vp 标题箭头；`download_visual_*` 原生 24 viewBox / stroke 2。 | **合理差异**：这是状态/内容层级，不应把全部图标强行染成一种颜色。问题在调用者把状态灰资源借给导航入口。 |

依据资源（均在 `entry/src/main/resources/base/media/`）：`download_visual_download.svg:1` / `_theme_night.svg:1`、`bookshelf_more_batch.svg:5`、`bookshelf_more_import.svg:5–7`、`bookshelf_more_settings.svg:5–6`、`settings_gen_refresh.svg:3–4`、`reader_directory_marker_download.svg:3–5`、`settings_row_general.svg:3–4`。颜色不能只看文件名、公共组件名称或 `ReaderThemeRegistry` 中存在的 role；要看 Image 实际是否消费该 role。

## 2. 当前可见页的全部图标族与状态

| 页面/组件与位置 | 交互图标 / 显示图标 | 状态、颜色、尺寸与背景核对 |
| --- | --- | --- |
| 书架 `BookshelfShell:247–250` | 顶部 More `rc_dots`，经 ReaderIconButton | day/night 配对，toolbar-standard；公共组件负责点击准入与按钮 role。不会自动改传入 SVG 的颜色。 |
| `BookshelfPage:787–832` | 网格、列表、筛选 | 各 active/inactive 资源配对；20vp glyph / 34vp 视觉容器，responseRegion 44vp。选态绿色/夜间金色，未选灰；选态底和边框跟主题。属于合理状态差异。|
| `BookshelfPage:1000–1010` | 列表每本 More `bookshelf_more` | 资源自身是 44×44 完整按钮画面，Image 与容器同 44；不是把纯 24vp glyph 无故放大。隐藏的封面/列表过渡子树有 enabled 与 hitTest 排除；图标有书名+操作的可访问标签。|
| `BookshelfEmptyPage:103–128` | 空书架网格/列表/筛选图标 | 20/34，整体 .42，不挂点击；是禁用显示，不应计成漏接按钮。空状态主体通过 BookshelfEmptyCard → ReaderPageState。|
| `BookshelfMoreMenu:150–182` | 批量、本地导入、检查更新、下载、书架设置 | 24vp；下载/更新颜色混用见 PAGE-01；updateRunning/backgroundRunning 会禁用并改标题，公共 menu 图标 .45、文字 muted。图标不换 native busy，进度在标签表达。|
| `BookshelfBookActionSheet:17–27` → `ReaderSheetActionList:36–48` | 多选、书籍信息、分组、移除 | 通过 ReaderActionSheetContent → ReaderActionMenuSurface 的 action-sheet 分支统一 colorFilter，普通绿底/危险红底，对比文字色图标一致；与 menu 分支机制不同。危险背景差异合理；不能按原 SVG 原色判断此处颜色。|
| `BookshelfMultiSelectPage:155–185,226–240,356–365` | 选中勾；移除；busy | **PAGE-03 规则缺口/未统一**：勾仍为 `Text('✓')`，22vp 圆底、选中固定橙 `#F58517`，非共享 SVG/系统 Checkbox；下载多选则是主题 green 原生 Checkbox。字体 glyph 的形态/基线与 SVG 无共同约束。移除为 22vp 固定红资源 `#D7473E`，busy 改 18vp native LoadingProgress、不可用透明度 .38；危险语义正确，但原色日夜固定，未使用通用 danger 的夜间映射。未经确认不把原有橙色基线直接认定应删除。|
| `BookshelfSettingsPage:148–166` | 返回；自动更新开关 | 返回由 PageBackBar；开关直接 native Toggle，仅 selectedColor=主题 TOK_GREEN；与 ReaderToggle 的关闭轨道/thumb/busy 处理不是同一规格。记录统一规则缺口，不把 native Toggle 自身判为错误。|
| `LocalImportDialog:189–194,235–238,261,366–367` | 系统文件、信息、文件；导入 busy | 20/44 圆底、13vp info、16vp doc；日夜资源配对；导入 32vp LoadingProgress 跟 message muted。文件信息/操作主图标层级差异合理。`summaryIcon:464–465` 只定义未调用，`import_summary` 无夜版**不构成当前已展示缺陷**。|
| `NoCoverCover:21–51` | 无封面显示占位 | 两条线 + “暂无封面”，按封面宽高比例缩放；不是交互图标，不误计成用文字代替错误/加载图标。主题底/ink 均由角色解析。真实 book.coverUrl 是内容，不纳入界面图标一致色。|
| `LocalBookDetail:193–196,429–430,511–512,532–534` | 返回、简介展开/收起、目录前进、目录章标 | novel back 48 viewBox / manga back 15 viewBox；PageBackBar variant 分开提供尺寸。简介箭头旋转 180° 表达收起；前进为右箭头，未全部复用下拉。manga 图标取同 accent 族；加载/失败走 ReaderPageState 或 native LoadingProgress。|
| `BookDirectoryPage:197–236` | novel 返回、目录工具、导航标记、搜索、下载 | 经 PageBackBar、ReaderDirectoryToolbar、ReaderDirectoryNavigationSurface、ReaderDirectoryList/ChapterRow、ReaderMangaDownloadPopup，公共与阅读分册承担内部图标细目。本页给业务准入和当前条目，不在本地重绘通用图标。|
| `BookDirectoryPage:356–425` | manga 返回、搜索、排序、定位 | sort 16vp/32vp；locate 15vp、没有当前项时 .36+disabled。**PAGE-04 确定混用/目标待定**：排序借 reader_directory_sort_* 的 `#2F6373 / #D2BD96`，定位与 manga accent 是 `#425D45 / #B9CEB1`。同工具区出现两套强调调色来源；不是 busy/selected 切换。sort 无 44vp 扩展触区见 PAGE-07。|
| `SharedDownloadPage:285–302,373–451,478,736–782,949–951` | 返回、筛选、搜索、清除、排序上下、书名前进、More、存储、关闭 | 通过 visualIcon 每项 day/night 配对；几何来自 SharedDownloadVisualSpec：普通18、搜索16、筛选14、排序18、标题箭头13。导航点击大多显式44触区；不是所有 glyph 都必须24。排序按 asc/desc资源切换。|
| `SharedDownloadPage:559–582,675–707,1037–1041` | 状态按钮、书/章选择勾、范围单选 | 完成是非点击Row，其他状态为Button；失败显示retry红与短“重试”，原因另列；管理态禁用状态按钮并 .5；unknown章动作禁止，未伪装成功。Checkbox仅selectedColor，Radio明确checkedBackground/uncheckedBorder/indicator。**PAGE-05 待原生确认**：Checkbox未指定mark/unselectedColor，夜间浅色green底上的mark实际随系统主题，源代码不能证明对比结果。|
| `SharedDownloadPage:1053–1063,1171–1198` | 操作面板暂停/下载/取消/删除、存储清理 | 操作面板经统一 action-sheet tint；存储清理单独使用 trash greenInk/disabled灰资源，和按钮背景green/soft配对，像素层非交互，透明native Button承接动作与语义。这种删图标为浅色是主按钮背景需要，不能误判“删除必须红图”。|
| `SharedDownloadPage:596–604,1002–1021,1092–1110,1215` | 快捷选择/下载状态/来源/存储/范围的下拉箭头 | 实际使用 ReaderInlineSelect → ReaderSelect 的 chevron；本页 `selectArrowModifier:1902–1905` 的sys.symbol定义没有实际调用，不是页面上当前渲染箭头。不能据死方法另算一套活跃系统图标。|
| `SearchPage:673–716`、`SearchSpinner:18–25` | 返回、搜索框搜索/清除、搜索/停止busy | 返回通过ReaderIconButton；搜索框图标在ReaderSearchField。native LoadingProgress：按钮28vp onPrimary、活动区36vp green；active/foreground/reduceMotion控制动画，active控制可见。这是大小依上下文改变的合理差异。|
| `SearchPage:1274–1277,1353–1355,1394,1466` | 空搜索/无结果插图、搜索错误插图 | 成对day/night资源、80vp错误插图；大插图是显示状态，不与18–24vp操作图标互换。其多色阴影不能按“单色交互图标”统一染色。|
| `SettingsPage:193–203,358–388`、`CategoryRow:28–36` | 设置home与general各leading图标、尾部右箭头、选择/开关 | leading15/28圆底与chevron14；一般leading均settings_* green族，下载例外见PAGE-02。日夜资源在render闭包调用，非构造冻结。General依赖ReaderSelect/SegmentedControl/Toggle提供内部图形。|
| `SettingsPage:569,666–674,808–838` | 清缓存、同形iconBox、恢复默认 | iconBox与CategoryRow几何一致；“恢复默认”为危险文字但仍green刷新图标+通用蓝灰圆底，属于**PAGE-06 规则缺口**：是否让危险行图标和文案同tone未在调用协议定义。不能只因是绿色就断言事件接错。pending清理/重置为32vp native LoadingProgress。|
| `SettingsSelectOverlay:174,204` | 已选项标记 | 通过ReaderChoiceRow，各Phone/Tablet宿主共用选态；没有本地用文本重画勾。|
| `SourceManagementPage:267–309,500–518,590–591,685–707` | 返回、More、搜索/清除、增加、分组文件夹、下拉、状态点、开关、底部增加 | More走ReaderIconButton；新增纯图40/40、glyph18，白色source_add与dark主背景成对；底部同图经ReaderLabeledIconAction=18/44，白图固定是onPrimary语义，有意与默认green图不同。状态点StatusBadge按检查状态，不是按钮。开关使用ReaderToggle含busy。纯图新增没有额外44触区/按钮role见PAGE-07。|
| `SourceToolsPage:226–236,507–516,618–660` | 返回、载入、选择/深度下拉 | 本页无直接media：PageBackBar、ReaderPageState/native LoadingProgress、ReaderInlineSelect、ReaderFormField、ReaderButton。选中行用业务按钮/底色，不是遗漏SVG；不可凭“没Image”判没有图标。|

## 3. 尺寸、状态和可访问性问题边界

**PAGE-07 确定接入不一致**：`SourceManagementPage:296–309` 的纯图增加按钮为40×40，无额外responseRegion；`BookDirectoryPage:388–390`排序为32×32，无额外responseRegion。对比已采用的`ReaderIconButton` 44vp及`BookshelfPage:825–832`34视觉/44触区，未遵循相同最小点击区域策略。并非要求把可见glyph放大到44。触区实际是否被父节点扩大，需要原生树佐证，源码未提供主动扩展。

**PAGE-08 可访问性声明缺口**：`PageBackBar:45–54`的纯返回Stack没有显式accessibilityText/Role/focusable；source纯新增有accessibilityText但未接ReaderIconButton公共role/focusable/pressed；漫画排序有accessibilityText但未接公共role/focusable。相比`ReaderIconButton:35–40`，它们没有同一声明协议。这里只判声明缺失，不声称原生默认推导必然完全不可访问。影响标准/漫画的各二级页返回以及这两个局部操作。

**不能合并成同一种状态**：loading动画、选中态、不可用态、无内容装饰、危险操作、进度事实、当前阅读标记、列表前进箭头分别有语义。当前阅读已是10fp标签，不需要再堆一个图标；当前项与“本地完整/已下载”的勾不能互相代替。busy原生加载不以旋转任意refresh SVG替代。

## 4. 保留分支与 l0 关闭页面

| 层级/组件 | 全部图标族、参数和问题 |
| --- | --- |
| 保留 BookshelfManagementPage | PageBackBar、ReaderPageState、ReaderRecoveryNotice、18vp native LoadingProgress、RecoveryAction；没有直接media。不可算作当前书架More“批量管理”，后者实际打开MultiSelect。|
| 保留 独立RulesManagementPage | PageBackBar、RecoveryAction、ReaderToggle、FormField、Button；没有直接media。不可替代Reader Full规则管理actor计数。|
| l0 DiscoverPage | refresh20/44经ReaderIconButton；source-stack20/34圆底、source-chevron20；filter20、filter-chevron20；apply20经ReaderLabeledIconAction，white on gradient；封面为内容。day/night配对，white apply固定语义合理。**关闭分支缺口**：filter行带下拉箭头却未挂onClick，当前只是展示值；refresh loading禁用但公共IconButton不提供disabled像素。不能当当前用户下载问题根因。|
| l0 RssPage | refresh18；manage16经公共labeled；search/clear经公共搜索框；filter20、filter-chevron20；source20；view-all20；item-chevron20；empty/error28显示状态。均day/night资源；refresh不同于nativebusy，状态文案另行表达，不升格当前通过。|
| l0 RssEntryDetailPage | external20/32×44、bookmark20/32×44（favorited资源+底色；loading .45、enabled业务准入）、source20、bottom源设置16、link20；media均day/night。external和favorite纯图未显式accessibilityText/role，容器宽32无44扩展；记录关闭分支，不擅自改。|
| l0 RssSourceFeedPage | source20；refresh/edit16经ReaderLabeledIconAction rss-feed（44高触区）；源操作manage16经rss-source-operations。day/night配对。|
| l0 RssSubscriptionManagementPage | add14/60×32+44responseRegion、source20、disclosure chevron20/44旋转180；展开动作view/edit/refresh/delete16经rss-management。删除固定`#AB2E28`，无night资源；isDanger只染文字，公共labeled不染图标。是保留实现主题不一致，不能归当前l0路径。|
| l0 RssSubscriptionEditorPage / RssOriginalRecoverySurface | PageBackBar、ReaderToggle、RecoveryAction/Notice、Button/FormField，没有本地media。|
| l0 SyncPage | WebDAV server/account/password/backup-password/folder均15/28圆底并配day/night；scope-chevron12×8；返回、loading/action/recovery均公共组件。没有发现同组资源颜色分叉；需原生结果才能确认所有运行状态。|
| l0 unimplementedSettings | notification资源灰，其他permission资源green；这是额外设置项整段产品关闭。不能统计成当前可点击功能漏接；状态点通过StatusBadge，权限文字与图标不是同一业务事实。|

## 5. 启动与 ArkWeb

`pages/ReaderStartupRecovery.ets:30–35`只有ReaderPageState，加载/失败/动作图标由公共组件提供；没有本地自建图标。`app/ArkWebExecutionHost.ets:141–177`交互头使用“取消”“完成”文字按钮，不是以符号字符伪造图标；Web内网站自己的图标属于外部内容，无法当Reader设计资源统一染色。背景隐藏Web无图标动作，不计一张额外UI页。

## 6. 本分册建议的约束边界

先把**普通导航图标、状态图标、onPrimary图标、危险图标、内容插图**作为不同角色；同容器普通导航应消费同一角色，不由调用者随机借用次级状态灰资源。菜单/操作面板已经是两种实际着色机制，需显式区分：menu保留SVG原色，action-sheet统一colorFilter；不应依据公共组件名称假定已统一。颜色/几何/显示状态由现有有限spec与主题绑定，业务准入由原owner提供，纯图动作补齐44触区、label/role/focus；保留现有原生LoadingProgress。上述为审计收敛方向，未授权替换用户已认可的橙色选态或全部旧样式。

## 7. 完整文件与资源引用清单

下表列本范围所有49个ETS及两个宿主；`@数字`为本次源码引用行，`theme`统一省略重复夜间名，实际day/night与未调用边界见上文。公共依赖列同时包含无本地Image的页面，避免漏掉通过公共组件渲染的图标。完整资源像素另见主审计图册。

| File | Direct media references (base variant) | Icon / state carriers |
| --- | --- | --- |
| `features/bookshelf/BookDirectoryPage.ets` | `manga_directory_back@357`, `manga_sheet_locate@395`, `reader_directory_sort_ascending@424`, `reader_directory_sort_descending@424` | `ReaderPageState@170`, `PageBackBar@197`, `ReaderDirectoryToolbar@209`, `ReaderDirectoryNavigationSurface@236`, `ReaderPageState@272`, `ReaderDirectoryNavigationSurface@318`, `PageBackBar@356`, `ReaderSearchField@382`, `ReaderDirectoryList@507`, `ReaderPageState@524`, `ReaderMangaDownloadPopup@603`, `ReaderDirectoryList@693`, `ReaderDirectoryChapterRow@710` |
| `features/bookshelf/BookRemovalDialog.ets` | none | none |
| `features/bookshelf/BookshelfBookActionSheet.ets` | none | `ReaderSheetActionList@20` |
| `features/bookshelf/BookshelfEmptyCard.ets` | none | `ReaderPageState@11` |
| `features/bookshelf/BookshelfEmptyPage.ets` | `bookshelf_grid_outline@105`, `bookshelf_list@108`, `bookshelf_filter@111`, `bookshelf_filter@113` | none |
| `features/bookshelf/BookshelfGroupSelector.ets` | none | none |
| `features/bookshelf/BookshelfHost.ets` | none | none |
| `features/bookshelf/BookshelfManagementOrchestrator.ets` | none | none |
| `features/bookshelf/BookshelfManagementPage.ets` | none | `PageBackBar@79`, `ReaderPageState@85`, `ReaderRecoveryNotice@115`, `LoadingProgress@146`, `ReaderRecoveryAction@152`, `ReaderPageState@205`, `ReaderButton@244`, `ReaderButton@306`, `ReaderPageState@316`, `ReaderButton@367`, `ReaderButton@374` |
| `features/bookshelf/BookshelfMoreMenu.ets` | `bookshelf_more_batch@178`, `bookshelf_more_import@179`, `settings_gen_refresh@180`, `download_visual_download@181`, `bookshelf_more_settings@182` | `ReaderActionMenuSurface@141` |
| `features/bookshelf/BookshelfMultiSelectPage.ets` | `bookshelf_multiselect_trash@226` | `NoCoverCover@166`, `LoadingProgress@229`, `NoCoverCover@338` |
| `features/bookshelf/BookshelfPage.ets` | `bookshelf_filter_active@791`, `bookshelf_grid@800`, `bookshelf_grid_outline@800`, `bookshelf_list_active@804`, `bookshelf_list@804`, `bookshelf_filter@809`, `bookshelf_filter@811`, `bookshelf_more@1003` | `ReaderRecoveryNotice@348`, `NoCoverCover@471`, `ReaderPageState@597`, `NoCoverCover@918` |
| `features/bookshelf/BookshelfSettingsPage.ets` | none | `ReaderRecoveryNotice@94`, `ReaderRecoveryNotice@105`, `PageBackBar@148`, `ReaderPageState@155`, `Toggle@166`, `ReaderPageState@178` |
| `features/bookshelf/BookshelfShell.ets` | `rc_dots@248` | `MainTabShell@127`, `ReaderRecoveryNotice@213`, `AppTopBar@243`, `ReaderIconButton@247` |
| `features/bookshelf/BookshelfStatusContent.ets` | none | `ReaderPageState@23` |
| `features/bookshelf/LocalBookDetail.ets` | `manga_directory_back@195`, `book_detail_back@196`, `manga_directory_chevron_down_accent@429`, `manga_directory_chevron_right_accent@511`, `book_detail_directory@533` | `ReaderPageState@141`, `ReaderPageState@180`, `PageBackBar@193`, `NoCoverCover@303`, `ReaderPageState@487`, `LoadingProgress@626` |
| `features/bookshelf/LocalImportDialog.ets` | `import_select_system@189`, `import_info@235`, `import_doc@366`, `import_success@465`, `import_summary@465` | `ReaderRecoveryNotice@124`, `ReaderRecoveryAction@176`, `ReaderRecoveryAction@178`, `LoadingProgress@261`, `ReaderRecoveryAction@314` |
| `features/bookshelf/NoCoverCover.ets` | none | none |
| `features/bookshelf/ShelfBookListDetails.ets` | none | none |
| `features/downloads/SharedDownloadPage.ets` | `download_visual_back@1535`, `download_visual_search@1536`, `download_visual_clear@1537`, `download_visual_filter@1538`, `download_visual_storage@1539`, `download_visual_trash@1540`, `download_visual_trash_disabled@1541`, `download_visual_more@1542`, `download_visual_close@1543`, `download_visual_download@1544`, `download_visual_pause@1545`, `download_visual_play@1546`, `download_visual_retry@1547`, `download_visual_check@1548`, `download_visual_chevron@1549`, `download_visual_empty@1550`, `download_visual_sort_asc@1551`, `download_visual_sort_desc@1552`, `download_visual_more@1553` | `ReaderPageState@222`, `ReaderRecoveryNotice@250`, `ReaderPageState@338`, `ReaderPageState@340`, `ReaderPageState@345`, `Checkbox@493`, `ReaderInlineSelect@596`, `ReaderPageState@622`, `ReaderPageState@624`, `Checkbox@675`, `ReaderInlineSelect@1002`, `ReaderInlineSelect@1015`, `Radio@1037`, `ReaderActionSheetContent@1053`, `ReaderInlineSelect@1092`, `ReaderInlineSelect@1105`, `ReaderInlineSelect@1215` |
| `features/search/SearchHost.ets` | none | none |
| `features/search/SearchOrchestrator.ets` | none | none |
| `features/search/SearchPage.ets` | `search_back@673`, `search_empty@1274`, `search_empty@1353`, `search_error@1394`, `search_error@1466` | `SearchSpinner@467`, `ReaderIconButton@673`, `ReaderSearchField@677`, `ReaderButton@701`, `SearchSpinner@715`, `ReaderButton@787`, `ReaderButton@797`, `ReaderButton@863`, `ReaderButton@991`, `ReaderButton@1017`, `ReaderButton@1304`, `ReaderButton@1428`, `ReaderButton@1433`, `ReaderButton@1487`, `ReaderButton@1489` |
| `features/search/SearchSpinner.ets` | none | `LoadingProgress@18` |
| `features/settings/CategoryRow.ets` | `reader_chevron_right@22` | none |
| `features/settings/CategorySection.ets` | none | none |
| `features/settings/RulesManagementOrchestrator.ets` | none | none |
| `features/settings/RulesManagementPage.ets` | none | `PageBackBar@105`, `ReaderRecoveryAction@123`, `ReaderToggle@301`, `ReaderButton@310`, `ReaderButton@350` |
| `features/settings/SettingsHost.ets` | none | none |
| `features/settings/SettingsOrchestrator.ets` | none | none |
| `features/settings/SettingsPage.ets` | `settings_row_general@193`, `settings_row_source@196`, `settings_row_sync@198`, `settings_row_shelf_search@200`, `reader_directory_marker_download@201`, `settings_row_about@203`, `settings_gen_theme@358`, `settings_gen_language@360`, `settings_gen_startup@362`, `settings_gen_update@371`, `settings_gen_motion@372`, `settings_gen_tap_top@374`, `settings_gen_crash@375`, `settings_gen_animation@376`, `settings_gen_animation@378`, `settings_gen_file@386`, `settings_gen_notification@387`, `settings_gen_battery@388`, `reader_chevron_right@396`, `settings_gen_cache@569`, `reader_chevron_right@654`, `settings_gen_refresh@810`, `reader_chevron_right@826` | `LoadingProgress@266`, `ReaderRecoveryAction@274`, `ReaderRecoveryNotice@302`, `ReaderRecoveryNotice@313`, `ReaderToggle@407`, `ReaderSelect@473`, `StatusBadge@771` |
| `features/settings/SettingsSelectOverlay.ets` | none | `ReaderChoiceRow@174`, `ReaderChoiceRow@204` |
| `features/source/SourceHost.ets` | none | none |
| `features/source/SourceManagementPage.ets` | `bookshelf_more@271`, `source_add@297`, `source_group_folder@500`, `source_group_folder@590`, `source_add@707` | `ReaderSelectPanel@249`, `PageBackBar@267`, `ReaderIconButton@271`, `ReaderSearchField@280`, `ReaderRecoveryNotice@347`, `ReaderRecoveryNotice@361`, `ReaderButton@404`, `ReaderButton@412`, `ReaderRecoveryAction@428`, `ReaderButton@460`, `ReaderButton@492`, `ReaderSelect@508`, `ReaderRecoveryAction@540`, `LoadingProgress@544`, `ReaderPageState@556`, `ReaderButton@666`, `ReaderButton@673`, `StatusBadge@679`, `ReaderToggle@685`, `ReaderButton@704`, `ReaderLabeledIconAction@706` |
| `features/source/SourceOrchestrator.ets` | none | none |
| `features/source/SourceToolsOrchestrator.ets` | none | none |
| `features/source/SourceToolsPage.ets` | none | `PageBackBar@236`, `ReaderRecoveryNotice@475`, `ReaderRecoveryNotice@489`, `ReaderRecoveryAction@491`, `ReaderPageState@507`, `LoadingProgress@516`, `ReaderInlineSelect@644`, `ReaderInlineSelect@652`, `ReaderButton@733`, `ReaderButton@738`, `ReaderButton@748` |
| `features/discover/DiscoverOrchestrator.ets` | none | none |
| `features/discover/DiscoverPage.ets` | `discover_refresh@117`, `discover_source_stack@172`, `discover_source_chevron@205`, `discover_filter@240`, `discover_filter_chevron@260`, `discover_apply@271` | `MainTabShell@101`, `AppTopBar@115`, `ReaderIconButton@116`, `ReaderRecoveryAction@158`, `ReaderButton@222`, `ReaderLabeledIconAction@270`, `ReaderPageState@295`, `ReaderButton@335` |
| `features/rss/RssEntryDetailPage.ets` | `rss_external@132`, `rss_bookmark_active@149`, `rss_bookmark@149`, `rss_source@167`, `rss_manage@230`, `rss_link@274` | `ReaderRecoveryNotice@108`, `PageBackBar@124`, `ReaderButton@195`, `ReaderLabeledIconAction@239`, `ReaderButton@325`, `ReaderButton@327` |
| `features/rss/RssOrchestrator.ets` | none | none |
| `features/rss/RssOriginalRecoverySurface.ets` | none | `ReaderRecoveryNotice@64`, `ReaderRecoveryAction@66`, `ReaderRecoveryAction@70` |
| `features/rss/RssPage.ets` | `rss_refresh@228`, `rss_manage@245`, `rss_filter@360`, `rss_filter_chevron@377`, `rss_source@447`, `rss_view_all@536`, `rss_item_chevron@589`, `rss_empty@634`, `rss_error@649` | `MainTabShell@110`, `ReaderLabeledIconAction@244`, `ReaderSearchField@252`, `ReaderButton@281`, `ReaderRecoveryNotice@290`, `ReaderButton@439`, `StatusBadge@484`, `ReaderLabeledIconAction@535`, `ReaderButton@757`, `ReaderButton@758` |
| `features/rss/RssSourceFeedPage.ets` | `rss_source@109`, `rss_refresh@162`, `rss_edit@163`, `rss_manage@186` | `PageBackBar@70`, `ReaderRecoveryNotice@91`, `ReaderLabeledIconAction@172`, `ReaderLabeledIconAction@185` |
| `features/rss/RssSubscriptionEditorOrchestrator.ets` | none | none |
| `features/rss/RssSubscriptionEditorPage.ets` | none | `PageBackBar@62`, `ReaderToggle@104`, `ReaderToggle@129`, `ReaderRecoveryAction@193`, `ReaderButton@200` |
| `features/rss/RssSubscriptionManagementPage.ets` | `rss_add@106`, `rss_source@239`, `rss_filter_chevron@294`, `rss_manage_view_all@319`, `rss_manage_edit@321`, `rss_manage_refresh@323`, `rss_manage_delete@325` | `ReaderRecoveryNotice@92`, `PageBackBar@101`, `ReaderRecoveryAction@142`, `ReaderButton@209`, `ReaderToggle@277`, `ReaderLabeledIconAction@337` |
| `features/sync/SyncOrchestrator.ets` | none | none |
| `features/sync/SyncPage.ets` | `sync_server@161`, `sync_account@166`, `sync_password@171`, `sync_backup_password@175`, `sync_folder@179`, `sync_scope_chevron@384` | `PageBackBar@113`, `ReaderButton@231`, `ReaderButton@233`, `ReaderRecoveryNotice@245`, `ReaderRecoveryAction@249`, `ReaderRecoveryAction@260`, `ReaderButton@291`, `ReaderButton@439` |
| `pages/ReaderStartupRecovery.ets` | none | `ReaderPageState@26` |
| `app/ArkWebExecutionHost.ets` | none | none |
